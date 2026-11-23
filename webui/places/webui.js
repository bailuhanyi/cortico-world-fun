import { dom, hasSafeImage, list, pictureData, styleDescription } from './helpers.js';
import { createMigrationView } from './migration.js';
import { STYLES } from './styles.js';
import { createArtworkStore, RESOURCE_SLOTS } from '../story/resources.js';

const split = (value) => [...new Set(value.split(/[\n，、,；;]+/u).map((item) => item.trim()).filter(Boolean))];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const kinds = { home: '家', around: '附近', frequent: '常去', travel: '旅行', venue: '娱乐场所', place: '普通地点' };
const kindLabel = (place) => place.kindLabel || kinds[place.kind] || place.kind || (place.playable ? '自填场所' : '普通地点');
// 分类下拉按大类分组；键是场所的 kind，故事地点单独成组。
const CATEGORY_GROUPS = [
  ['玩乐与热闹', ['amusement', 'arcade', 'ktv', 'cinema', 'con', 'templefair', 'market', 'bathhouse', 'thrift', 'venue']],
  ['自然与户外', ['zoo', 'park', 'nature']],
  ['文化与展馆', ['aquarium', 'museum', 'library']],
  ['吃喝与休息', ['food', 'catcafe']],
  ['故事地点', ['story']],
  ['其他地点', ['__none__', 'home', 'around', 'frequent', 'travel', 'place']],
];
const categoryValue = (place) => place.kind || '__none__';
const QUICK_FILTERS = [
  ['', '全部'],
  ['story', '故事地点'],
  ['customStory', '我的故事地点'],
  ['regular', '常规地点'],
  ['playable', '可玩场所'],
  ['mine', '我的地点'],
  ['home', '住所'],
];
const quickMatch = (place, quick) => {
  switch (quick) {
    case 'story': return place.storyBound === true;
    case 'customStory': return place.customStoryBound === true;
    case 'regular': return place.playable === true && place.storyBound !== true;
    case 'playable': return place.playable === true;
    case 'mine': return place.userPlace === true;
    case 'home': return place.isHome === true;
    default: return true;
  }
};

export function mountPlaces(ctx) {
  const root = ctx.root;
  const document = root.ownerDocument;
  const { node, row, note, button, field, option, chip } = dom(document);
  const section = node('section', { class: 'fpl', 'aria-label': '地点册' });
  const feedback = node('div', { class: 'fpl-feedback', role: 'status' });
  const navigation = node('nav', { class: 'fpl-row fpl-nav', 'aria-label': '地点导航' });
  const main = node('div', { class: 'fpl-stack' });
  section.append(node('style', {}, STYLES), node('header', { class: 'fpl-header' }, node('p', { class: 'fpl-kicker' }, '从0开始的肥鱼大冒险 · 把喜欢的地方，记在这里。'), node('h2', {}, '把喜欢的地方，记在这里。'),
    note('管理地点、游玩内容、封面与关联。')), navigation, feedback, main);
  root.replaceChildren(section);

  let snapshot;
  let view = 'browse';
  let busy = false;
  let disposed = false;
  let focusAfterRender = false;
  let browseFilter = { text: '', kind: '', quick: '' };
  let detailId;
  let detail;
  let editRevision;
  let image;
  let imageError;
  let confirmAction;
  let artworkBusy = '';
  let artworkNotice = '';
  let artworkError = '';
  /** 图片解码失败的槽位：仍要留「恢复示意」，否则坏图会把唯一的出口也藏掉。 */
  const artworkFailed = new Set();
  const artwork = createArtworkStore(ctx, () => { if (live() && view === 'artwork') render(); });
  const live = () => !disposed && !ctx.signal?.aborted;
  const places = () => list(snapshot?.places);
  const find = (id) => places().find((place) => place.id === id);
  const isHome = (place) => Boolean(place && (place.isHome || snapshot?.homeId === place.id));
  const tell = (message = '', error = false) => {
    feedback.setAttribute('role', error ? 'alert' : 'status');
    feedback.textContent = message;
  };
  async function call(method, payload) {
    const response = await ctx.invoke(method, payload === undefined ? [] : [payload]);
    if (response?.ok === false) throw new Error(response.error || '宿主拒绝了请求。');
    if (response?.ok !== true) throw new Error('宿主未返回有效结果。');
    return response;
  }
  function accept(result) {
    const next = result.snapshot ?? result;
    if (Array.isArray(next.places)) snapshot = next;
  }
  async function refreshSnapshot() {
    const result = await call('list');
    if (!Array.isArray((result.snapshot ?? result).places)) throw new Error('没有收到地点列表。');
    accept(result);
  }
  function lock(value) {
    busy = value;
    section.setAttribute('aria-busy', String(value));
    const controls = section.querySelectorAll('button, input, select, textarea');
    for (const control of controls) {
      if (value && !control.disabled) {
        control.disabled = true;
        control.dataset.fplLocked = 'true';
      } else if (!value && control.dataset.fplLocked) {
        control.disabled = false;
        delete control.dataset.fplLocked;
      }
    }
  }
  async function run(operation, { write = false, onError } = {}) {
    if (busy || !live()) return;
    tell();
    lock(true);
    try { await operation(); }
    catch (error) {
      if (!live()) return;
      if (write) {
        try { await refreshSnapshot(); } catch { /* A manual refresh remains available. */ }
      }
      if (!live()) return;
      onError?.();
      tell(`${error?.message || '操作失败。'}${write ? ' 请核对当前地点与恢复点，系统不会自动重试写入。' : ''}`, true);
    } finally {
      if (live()) lock(false);
    }
  }
  async function readDetail(id) {
    const result = await call('get', { id });
    if (!live()) return;
    detail = result.place;
    if (!detail) throw new Error('这处地点已找不到。');
    image = undefined;
    imageError = '';
    if (detail.cover) {
      try {
        const result = await call('cover', { id });
        if (hasSafeImage(result.image?.dataUrl)) image = result.image.dataUrl;
        else imageError = '封面文件暂不可用。';
      } catch { imageError = '封面暂时无法读取。'; }
    }
  }
  function open(id) {
    void run(async () => {
      await readDetail(id);
      if (!live()) return;
      detailId = id;
      go('detail');
    });
  }
  async function submit(method, payload, message, onSuccess) {
    await run(async () => {
      const data = typeof payload === 'function' ? await payload() : payload;
      if (!live()) return;
      const result = await call(method, { ...data, revision: editRevision ?? snapshot?.revision });
      if (!live()) return;
      accept(result);
      await onSuccess?.(result);
      if (!live()) return;
      tell(message);
    }, { write: true });
  }
  function go(next) {
    if (!live()) return;
    view = next;
    editRevision = ['edit', 'create', 'cover', 'settings'].includes(next) ? snapshot?.revision : undefined;
    confirmAction = undefined;
    focusAfterRender = true;
    render();
  }
  function thumbnail(place) {
    const badges = [place.playable ? '可玩场所' : '只是地点', kindLabel(place)];
    if (isHome(place)) badges.unshift('住所');
    return node('button', { type: 'button', class: 'fpl-tile', onclick: () => open(place.id) },
      node('strong', {}, place.name), row(badges.map(chip)), place.desc ? note(place.desc) : note('还没有地点描写'));
  }
  /** 列表里的一行摘要：名字、状态、分类、画风与关联数，右侧一个编辑入口。 */
  function listRow(place) {
    const meta = [
      place.playable ? '可玩场所' : '只是地点',
      kindLabel(place),
      list(place.areas).length ? `${list(place.areas).length} 处能逛的` : null,
      place.style ? '有地点画风' : null,
      list(place.relations).length ? `${list(place.relations).length} 条关联` : null,
      place.isHome ? '住所' : null,
      place.storyBound ? '有故事' : null,
    ].filter(Boolean);
    return node('article', { class: 'fpl-listrow', 'data-place-id': place.id },
      node('div', { class: 'fpl-listrow-main' },
        node('strong', {}, place.name),
        node('div', { class: 'fpl-listrow-meta' }, meta.map((item) => node('span', {}, item))),
        place.desc ? note(place.desc) : null),
      node('div', { class: 'fpl-row' },
        button('看看', () => open(place.id)),
        button('编辑这处', () => { detail = place; detailId = place.id; go('edit'); }, { class: 'fpl-primary' })));
  }
  function browse() {
    const search = node('input', { type: 'search', value: browseFilter.text, placeholder: '名称、别名、标签或描写' });
    const present = [...new Set(places().map(categoryValue))];
    const labelFor = (key) => {
      const place = places().find((item) => categoryValue(item) === key);
      return place ? kindLabel(place) : key === '__none__' ? '普通地点' : key;
    };
    const used = new Set();
    const groups = [];
    for (const [label, keys] of CATEGORY_GROUPS) {
      const entries = keys.filter((key) => present.includes(key));
      if (!entries.length) continue;
      for (const key of entries) used.add(key);
      groups.push(node('optgroup', { label }, entries.map((key) => option(key, labelFor(key)))));
    }
    const rest = present.filter((key) => !used.has(key)).sort();
    if (rest.length) groups.push(node('optgroup', { label: '其他地点' }, rest.map((key) => option(key, labelFor(key)))));
    const category = node('select', { 'aria-label': '按分类筛选' }, option('', '所有分类'), groups);
    category.value = browseFilter.kind;
    const quickButtons = new Map(QUICK_FILTERS.map(([value, label]) => [value,
      button(label, () => { browseFilter.quick = value; display(); }, { class: 'fpl-chip-toggle' })]));
    const paintQuick = () => {
      for (const [value, control] of quickButtons) control.setAttribute('aria-pressed', String(browseFilter.quick === value));
    };
    // 平铺的格子留给窄屏；宽屏用摘要列表，一行一处更好扫。
    const tileResults = node('div', { class: 'fpl-grid' });
    const listResults = node('div', { class: 'fpl-row-list' });
    const count = node('p', { class: 'fpl-muted', role: 'status' });
    const display = () => {
      const query = browseFilter.text.trim().toLocaleLowerCase();
      const matches = places().filter((place) => quickMatch(place, browseFilter.quick)
        && (!browseFilter.kind || categoryValue(place) === browseFilter.kind)
        && (!query || [place.name, place.desc, ...list(place.aliases), ...list(place.tags)].some((text) => String(text ?? '').toLocaleLowerCase().includes(query))));
      count.textContent = `${matches.length} 处地点`;
      // 两套视图都填：CSS 按宽度决定显示哪一套，窄屏自动回落到卡片。
      tileResults.replaceChildren(...(matches.length ? matches.map(thumbnail) : [node('p', { class: 'fpl-empty' }, '没有符合条件的地点。')]));
      listResults.replaceChildren(...(matches.length ? matches.map(listRow) : [node('p', { class: 'fpl-empty' }, '没有符合条件的地点。')]));
      paintQuick();
    };
    search.addEventListener('input', () => { browseFilter.text = search.value; display(); });
    category.addEventListener('change', () => { browseFilter.kind = category.value; display(); });
    display();
    return node('section', { class: 'fpl-stack' }, row(node('h3', { tabindex: -1 }, '浏览地点'),
      button('添加地点', () => go('create'), { class: 'fpl-primary' })),
    node('div', { class: 'fpl-filters', role: 'group', 'aria-label': '快捷筛选' }, [...quickButtons.values()]),
    node('div', { class: 'fpl-grid' }, field('搜索地点', search), field('按分类筛选', category)), count, listResults, tileResults);
  }
  function confirm(label, message, action) {
    return button(label, () => { confirmAction = { label, message, action }; render(); main.querySelector('[data-confirm]')?.focus(); });
  }
  function confirmation() {
    if (!confirmAction) return null;
    const entry = confirmAction;
    return node('section', { class: 'fpl-card fpl-stack', 'aria-label': entry.label }, node('p', {}, entry.message),
      row(button(`确认${entry.label}`, () => { confirmAction = undefined; render(); void entry.action(); }, { class: 'fpl-primary', 'data-confirm': '' }),
        button('取消', () => { confirmAction = undefined; render(); main.querySelector('h3')?.focus(); })));
  }
  function coverPreview(place) {
    const preview = node('div', { class: 'fpl-cover' });
    if (!image) {
      preview.append(note(imageError || '没有封面 · 仍可阅读地点描写'));
      return preview;
    }
    const picture = node('img', { src: image, alt: `${place.name}的封面`, decoding: 'async' });
    const original = node('details', {}, node('summary', {}, '查看原图'), node('img', { class: 'fpl-original', src: image, loading: 'lazy', alt: `${place.name}的完整封面` }));
    picture.style.objectPosition = `${place.coverFocus?.x ?? 50}% ${place.coverFocus?.y ?? 50}%`;
    picture.addEventListener('error', () => { preview.replaceChildren(note('封面无法显示。')); original.remove(); }, { once: true });
    preview.append(picture);
    return node('div', { class: 'fpl-stack' }, preview, original);
  }
  function coverEditor(place) {
    const file = node('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp' });
    const focalX = node('input', { type: 'range', min: 0, max: 100, value: place.coverFocus?.x ?? 50 });
    const focalY = node('input', { type: 'range', min: 0, max: 100, value: place.coverFocus?.y ?? 50 });
    const readFocus = () => ({ x: Number(focalX.value), y: Number(focalY.value) });
    const focusStatus = note('');
    const preview = coverPreview(place);
    const updatePreview = () => {
      const { x, y } = readFocus();
      focusStatus.textContent = `裁切焦点 ${x}% 横向，${y}% 纵向`;
      const cover = preview.querySelector('img');
      if (cover) cover.style.objectPosition = `${x}% ${y}%`;
    };
    focalX.addEventListener('input', updatePreview);
    focalY.addEventListener('input', updatePreview);
    updatePreview();
    const reload = async () => { await readDetail(place.id); if (live()) { editRevision = snapshot?.revision; render(); } };
    const upload = button(place.cover ? '替换封面' : '上传封面', () => {
      const chosen = file.files?.[0];
      if (!chosen) { tell('请选择要上传的封面图片。', true); return; }
      void submit('setCover', async () => ({ id: place.id, dataUrl: await pictureData(chosen, MAX_IMAGE_BYTES, document.defaultView?.FileReader), coverFocus: readFocus() }), '已保存封面。', reload);
    });
    return node('section', { class: 'fpl-card fpl-stack' }, node('h4', {}, '编辑封面'), preview,
      field('选择图片', file, 'PNG、JPEG、GIF 或 WebP，最大 8 MiB。'),
      node('div', { class: 'fpl-grid' }, field('水平焦点', focalX), field('垂直焦点', focalY)), focusStatus,
      row(upload, place.cover ? button('保存焦点', () => submit('update', { id: place.id, patch: { coverFocus: readFocus() } }, '已保存封面焦点。', reload)) : null,
        place.coverFocus ? button('重置焦点', () => submit('update', { id: place.id, patch: { coverFocus: null } }, '封面已恢复默认居中。', reload)) : null,
        place.cover ? confirm('清空封面', `清空「${place.name}」当前展示的封面？`, () => submit('clearCover', { id: place.id }, '已清空封面。', reload)) : null,
        button('返回地点', () => go('detail'))));
  }
  const CROWD_LABEL = { quiet: '人不多', normal: '人不算多', packed: '人很多' };
  /** 编辑器里的一份值：载入时用它做「有没有改动」的比对，保存前也用它组请求。 */
  function editorValues(place, controls) {
    if (!controls) {
      return {
        name: place?.name ?? '', aliases: list(place?.aliases), tags: list(place?.tags), desc: place?.desc ?? '',
        scene: place?.scene ?? '', kind: place?.kind ?? '', hours: place?.hours ?? null, crowd: place?.crowd ?? 'normal',
        outfit: place?.recommendedOutfit ?? '', areas: list(place?.areas), souvenirs: list(place?.souvenirs),
        photoSpots: list(place?.photoSpots), randomEvents: list(place?.randomEvents), food: place?.food ?? null,
        style: place?.style ?? '', relations: list(place?.relations),
      };
    }
    const { name, aliases, tags, desc, scene, kind, open, close, crowd, outfit, areas, souvenirs, photoSpots,
      randomEvents, foodVerb, foodItems, style, relationRows } = controls;
    return {
      name: name.value.trim(), aliases: split(aliases.value), tags: split(tags.value), desc: desc.value.trim(),
      scene: scene.value.trim(), kind: kind.value.trim(), hours: { open: open.value.trim(), close: close.value.trim() },
      crowd: crowd.value, outfit: outfit.value.trim(), areas: split(areas.value), souvenirs: split(souvenirs.value),
      photoSpots: split(photoSpots.value), randomEvents: split(randomEvents.value),
      food: foodVerb.value === 'none' ? null : { verb: foodVerb.value, items: split(foodItems.value) },
      style: style.value.trim(),
      relations: relationRows.map(({ target, annotation }) => ({ placeId: target.value, note: annotation.value.trim() })),
    };
  }
  const lines = (value) => list(value).join('\n');
  /** 编辑器的四个分组：同一份草稿，切组不重建控件。 */
  const GROUPS = [
    ['基础资料', '先说明这是一处什么样的地方。'],
    ['游玩内容', '开放时间、能逛的地方与收获都在这儿。'],
    ['画风与封面', '这一处看起来是什么样子。'],
    ['地点关联', '记录两处地点之间的联系。'],
  ];
  function detailSection(title, items) {
    return list(items).length
      ? node('div', { class: 'fpl-stack' }, node('h4', {}, title), node('ul', { class: 'fpl-list' }, items.map((item) => node('li', {}, item))))
      : null;
  }
  function describePlace(place) {
    const facts = [
      isHome(place) ? '住所' : '',
      place.playable ? '可玩场所' : '只是地点',
      kindLabel(place),
      place.overridden ? '改过预设' : '',
    ].filter(Boolean);
    const food = place.food && list(place.food.items).length
      ? node('div', { class: 'fpl-stack' }, node('h4', {}, place.food.verb === '喝' ? '能喝的' : '能吃的'),
        row(place.food.items.map(chip)))
      : null;
    return node('section', { class: 'fpl-card fpl-stack' }, row(node('h3', { tabindex: -1 }, place.name), ...facts.map(chip)),
      coverPreview(place), node('p', { class: 'fpl-wrap' }, place.desc || '还没有地点描写。'),
      node('div', { class: 'fpl-stack' },
        note(`开放时间：${place.hours?.open || '—'}–${place.hours?.close || '—'} · ${CROWD_LABEL[place.crowd] ?? '人不算多'}`),
        place.recommendedOutfit ? note(`推荐穿搭：${place.recommendedOutfit}`) : null,
        place.scene ? note(`场景名：${place.scene}`) : null,
        list(place.aliases).length ? note(`别名：${place.aliases.join('、')}`) : null,
        list(place.tags).length ? row(place.tags.map(chip)) : null,
        node('p', { class: 'fpl-wrap' }, `有效画风：${place.effectiveStyle || place.style || '未设置'}`, place.effectiveStyle || place.style ? `（${styleDescription(place)}）` : ''),
        list(place.relations).length ? node('div', {}, node('h4', {}, '地点关联'), node('ul', {}, place.relations.map((relation) => node('li', {}, `${find(relation.placeId)?.name ?? relation.placeId} · ${relation.note}`)))) : null,
        node('div', { class: 'fpl-grid' },
          detailSection('能逛的', place.areas),
          detailSection('纪念品', place.souvenirs),
          detailSection('拍照点', place.photoSpots),
          detailSection('可能碰上的小事', place.randomEvents),
          food),
        note(`地点 ID：${place.id}`)),
      row(button('编辑地点', () => go('edit'), { class: 'fpl-primary' }), button('编辑封面', () => go('cover')),
        isHome(place) ? confirm('取消住所', `取消把「${place.name}」设为住所？`, () => submit('setHome', { id: null }, '已取消住所。', () => { detail = find(place.id) ?? detail; render(); }))
          : confirm('设为住所', `将「${place.name}」设为住所？当前出游位置会保持原样。`, () => submit('setHome', { id: place.id }, '已更新住所。', () => { detail = find(place.id) ?? detail; render(); })),
        !place.preset ? confirm('删除这处', `删除「${place.name}」？它会从地点表里移除，历史行程与回忆不受影响。`, () => submit('remove', { id: place.id }, '已删除地点。', () => { detail = undefined; detailId = undefined; go('browse'); })) : null,
        place.preset && place.overridden ? confirm('恢复预设', `把「${place.name}」恢复成预设？你改过的字段会丢掉。`, () => submit('reset', { id: place.id }, '已恢复预设。', async () => { await readDetail(place.id); render(); })) : null,
        button('返回浏览', () => go('browse'))));
  }
  function editor(place) {
    // 预设的分类和场景名是内置定义的一部分（覆盖层只开放叙事/场所字段），这里锁住。
    const locked = Boolean(place?.preset);
    const name = node('input', { value: place?.name || '', required: true, maxlength: 40 });
    const aliases = node('input', { value: list(place?.aliases).join('、') });
    const kind = node('input', { value: place?.kind || '', placeholder: '例如：附近', maxlength: 40, ...(locked ? { readonly: '' } : {}) });
    const desc = node('textarea', { rows: 4, maxlength: 400 }, place?.desc || '');
    const tags = node('input', { value: list(place?.tags).join('、') });
    const scene = node('input', { value: place?.scene || '', maxlength: 40, ...(locked ? { readonly: '' } : {}) });
    const open = node('input', { value: place?.hours?.open || '09:00', placeholder: 'HH:MM', maxlength: 5 });
    const close = node('input', { value: place?.hours?.close || '21:00', placeholder: 'HH:MM', maxlength: 5 });
    const crowd = node('select', {}, option('quiet', '人不多'), option('normal', '人不算多'), option('packed', '人很多'));
    crowd.value = place?.crowd ?? 'normal';
    const outfit = node('input', { value: place?.recommendedOutfit || '', maxlength: 40, placeholder: '可选，例如「外出外套」' });
    const areas = node('textarea', { rows: 4, placeholder: '一行一处，至少一处才算能逛的场所' }, lines(place?.areas));
    const souvenirs = node('textarea', { rows: 2, placeholder: '一行一样' }, lines(place?.souvenirs));
    const photoSpots = node('textarea', { rows: 2, placeholder: '一行一处' }, lines(place?.photoSpots));
    const randomEvents = node('textarea', { rows: 2, placeholder: '一行一条，可选' }, lines(place?.randomEvents));
    const foodVerb = node('select', {}, option('none', '没有'), option('喝', '喝的'), option('吃', '吃的'));
    foodVerb.value = place?.food?.verb === '喝' ? '喝' : (place?.food?.verb === '吃' ? '吃' : 'none');
    const foodItems = node('textarea', { rows: 2, placeholder: '品类名，一行一样；别写味道' }, lines(place?.food?.items));
    const style = node('textarea', { rows: 2, maxlength: 160 }, place?.style || '');
    const relations = node('div', { class: 'fpl-stack' });
    const relationRows = [];
    const addRelation = (existing) => {
      const target = node('select', { required: true }, option('', '选择已登记的地点'), places().filter((item) => item.id !== place?.id)
        .map((item) => option(item.id, `${item.name} (${item.id})`)));
      target.value = existing?.placeId ?? '';
      const annotation = node('input', { value: existing?.note ?? '', required: true });
      const entry = { target, annotation };
      relationRows.push(entry);
      const line = node('div', { class: 'fpl-relation fpl-stack' }, node('div', { class: 'fpl-grid' }, field('关联地点', target), field('关联说明', annotation)),
        row(button('移除这条关联', () => { relationRows.splice(relationRows.indexOf(entry), 1); line.remove(); addButton.focus(); })));
      relations.append(line);
      return target;
    };
    const addButton = button('添加地点关联', () => addRelation()?.focus(), { disabled: !places().some((item) => item.id !== place?.id) });
    for (const existing of list(place?.relations)) addRelation(existing);

    // 四组控件只建一次，切组只切显隐：未保存的内容不会因为换组丢掉。
    let group = 0;
    const panels = [];
    const statusText = node('span', {});
    const statusLine = node('div', { class: 'fpl-savebar-status' }, node('span', { class: 'fpl-dirty-dot' }), statusText);
    const nav = node('nav', { class: 'fpl-editnav', 'aria-label': '编辑分组' });
    const headTitle = node('h4', {});
    const headNote = node('small', {});
    const body = node('div', { class: 'fpl-stack' }, node('div', { class: 'fpl-grouphead' }, headTitle, headNote));
    const savebar = node('div', { class: 'fpl-savebar' });
    const groupPanel = (index, ...content) => {
      const panel = node('section', { class: 'fpl-formgroup fpl-stack', 'data-group': String(index) }, ...content);
      panels.push(panel);
      return panel;
    };
    // 草稿是否与载入值不同：只用来提示，不阻止保存（服务端仍会校验）。
    const controls = () => ({ name, aliases, tags, desc, scene, kind, open, close, crowd, outfit, areas, souvenirs,
      photoSpots, randomEvents, foodVerb, foodItems, style, relationRows });
    const initial = JSON.stringify(editorValues(place));
    const dirty = () => JSON.stringify(editorValues(place, controls())) !== initial;
    function paint() {
      for (const [index, panel] of panels.entries()) panel.hidden = index !== group;
      headTitle.textContent = GROUPS[group][0];
      headNote.textContent = GROUPS[group][1];
      statusText.textContent = dirty() ? '有未保存的修改' : '还没有改动';
      statusLine.setAttribute('data-dirty', String(dirty()));
    }
    nav.append(...GROUPS.map(([label], index) => button(`${index + 1}. ${label}`, () => { group = index; paint(); }, { 'aria-current': group === index ? 'page' : null })));

    const form = node('form', { class: 'fpl-stack', onsubmit: (event) => {
      event.preventDefault();
      const relationValues = relationRows.map(({ target, annotation }) => ({ placeId: target.value, note: annotation.value.trim() }));
      if (!name.value.trim() || relationValues.some((rel) => !rel.note || !rel.placeId)) {
        group = name.value.trim() ? 3 : 0; paint();
        tell('请补全地点名称和关联说明。', true);
        return;
      }
      if (new Set(relationValues.map((item) => item.placeId)).size !== relationValues.length) {
        group = 3; paint();
        tell('请为每个关联地点保留一条说明。', true);
        return;
      }
      const venue = {
        name: name.value.trim(),
        aliases: split(aliases.value),
        tags: split(tags.value),
        desc: desc.value.trim(),
        scene: scene.value.trim(),
        hours: { open: open.value.trim(), close: close.value.trim() },
        crowd: crowd.value,
        recommendedOutfit: outfit.value.trim(),
        areas: split(areas.value),
        souvenirs: split(souvenirs.value),
        photoSpots: split(photoSpots.value),
        randomEvents: split(randomEvents.value),
        food: foodVerb.value === 'none' ? null : { verb: foodVerb.value, items: split(foodItems.value) },
      };
      if (!locked) venue.kind = kind.value.trim();
      const values = { venue, style: style.value.trim(), relations: relationValues };
      void submit(place ? 'update' : 'create', place ? { id: place.id, patch: values } : { input: { ...venue, style: values.style, relations: values.relations } },
        place ? '已保存地点。' : '已添加地点。', async (result) => {
          const id = place?.id ?? result.place?.id ?? result.id;
          if (!id) { go('browse'); return; }
          await readDetail(id);
          if (live()) { detailId = id; go('detail'); }
        });
    } });

    body.append(
      groupPanel(0,
        node('div', { class: 'fpl-grid' }, field('名字', name), field('别名', aliases, '用顿号或逗号分隔。'), field('分类', kind, locked ? '预设分类由内置定义决定。' : null), field('标签', tags, '用顿号或逗号分隔。')),
        field('描写', desc, '只写空间与陈设，别写她在干什么。'),
        field('场景名（可选）', scene, locked ? '预设的场景名由内置素材决定。' : '素材库里的正名；不知道就留空。'),
        locked ? note('这是预设地点：改名、描写、时间、能逛的、纪念品这些会存成覆盖层，预设本身不动；分类和场景名由内置定义决定。') : null),
      groupPanel(1,
        node('div', { class: 'fpl-grid' }, field('开门时间', open, 'HH:MM'), field('关门时间', close, 'HH:MM'), field('人多不多', crowd), field('推荐穿搭', outfit)),
        field('能逛的', areas, '一行一处。至少一处才算可玩场所；留空就是地图上的一个点。'),
        node('div', { class: 'fpl-grid' }, field('纪念品', souvenirs), field('拍照点', photoSpots)),
        field('可能碰上的小事', randomEvents),
        node('div', { class: 'fpl-grid' }, field('能吃能喝', foodVerb), field('能吃能喝的品类', foodItems, '只写品类名，味道归「鱼的每一天」。'))),
      groupPanel(2,
        field('地点画风', style, '留空时使用全局默认画风。画风更新后，封面仍使用已保存的图片。'),
        note('封面在浏览列表里打开一处地点后点「编辑封面」上传；这里只改画风。')),
      groupPanel(3,
        note('以文字记录两处地点的联系，不生成路线或距离。'),
        relations, row(addButton)),
    );

    for (const control of [name, aliases, tags, desc, scene, kind, open, close, crowd, outfit, areas, souvenirs, photoSpots, randomEvents, foodVerb, foodItems, style]) {
      control.addEventListener?.('input', paint);
      control.addEventListener?.('change', paint);
    }

    savebar.append(statusLine,
      row(node('button', { type: 'submit', class: 'fpl-primary' }, place ? '保存地点' : '添加地点'),
        place?.preset && place.overridden ? button('恢复预设', () => confirm('恢复预设', `把「${place.name}」恢复成预设？你改过的字段会丢掉。`, () => submit('reset', { id: place.id }, '已恢复预设。', async () => { await readDetail(place.id); render(); }))) : null,
        !place?.preset && place ? button('删除这处', () => confirm('删除这处', `删除「${place.name}」？它会从地点表里移除，历史行程与回忆不受影响。`, () => submit('remove', { id: place.id }, '已删除地点。', () => { detail = undefined; detailId = undefined; go('browse'); }))) : null,
        button('取消编辑', () => go(place ? 'detail' : 'browse'))));
    form.append(body, savebar);

    const wrapper = node('div', { class: 'fpl-editor' },
      node('div', { class: 'fpl-stack' },
        node('div', { class: 'fpl-editnav-meta' }, node('h3', { tabindex: -1 }, place ? `编辑地点：${place.name}` : '添加地点'),
          note(place ? `${place.preset ? '预设地点' : '自己的地点'} · ${place.playable ? '可玩场所' : '只是地点'}` : '填名字就能存；填了「能逛的」才算可玩场所。'),
          place?.preset ? note('改的是覆盖层：只存你真改过的字段，预设本身不动；分类和场景名由内置定义决定。') : null),
        nav),
      form);
    paint();
    return wrapper;
  }
  /** 本地插画：槽位与校验复用出游面板那一套，存储键不变，已导入的图不会丢。 */
  async function importArtwork(slot, input) {
    const picked = input.files?.[0];
    if (!picked || artworkBusy) return;
    artworkBusy = slot.id; artworkError = ''; artworkNotice = '';
    render();
    try {
      const result = await artwork.import(slot.id, picked);
      if (!live()) return;
      artworkFailed.delete(slot.id);
      artworkNotice = result?.persistent
        ? '插画已应用，并保存在这台浏览器里。'
        : '插画已应用；这个浏览器不允许长期保存，刷新后会没有。';
    } catch (error) {
      if (!live()) return;
      artworkError = error?.message || '图片导入失败。';
    } finally {
      artworkBusy = '';
      if (live()) render();
    }
  }
  function artworkView() {
    const slots = RESOURCE_SLOTS.filter((slot) => slot.id !== 'creek-letter-ending');
    const cards = slots.map((slot) => {
      const saved = artwork.get(slot.id);
      const failed = artworkFailed.has(slot.id);
      const hasArt = Boolean(saved || failed);
      const file = node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, 'aria-label': `导入${slot.title}插画` });
      file.addEventListener('change', () => void importArtwork(slot, file));
      const preview = node('div', { class: 'fpl-artwork-preview' });
      if (saved) {
        const picture = node('img', { src: saved, alt: `${slot.title}的本地插画`, decoding: 'async' });
        // 坏图：标记后回落到示意场景，下一次渲染就不再挂这张图。
        picture.addEventListener('error', () => {
          artwork.markFailed(slot.id);
          artworkFailed.add(slot.id);
          artworkError = '这张图没能显示，已回到示意场景。';
          if (live()) render();
        }, { once: true });
        preview.append(picture);
      } else {
        preview.append(node('p', { class: 'fpl-muted' }, failed ? '图片未能加载 · 默认示意场景' : '默认示意场景'));
      }
      return node('section', { class: 'fpl-card fpl-artwork-card' },
        node('div', {}, node('h4', {}, slot.title), node('p', { class: 'fpl-muted' }, slot.description)),
        preview,
        node('code', {}, `story-artwork-v1:${slot.id}`),
        row(button(artworkBusy === slot.id ? '正在读取…' : saved ? '换一张本地图' : '选择本地图', () => file.click(), { disabled: Boolean(artworkBusy) }),
          hasArt ? button('恢复示意', () => {
            artwork.clear(slot.id);
            artworkFailed.delete(slot.id);
            artworkError = '';
            artworkNotice = '已恢复示意场景。';
            render();
          }) : null),
        file);
    });
    return node('section', { class: 'fpl-stack' },
      node('h3', { tabindex: -1 }, '本地插画'),
      note('只存在这台浏览器里，不上传；换浏览器或清缓存会没有。导入后回到这里、或重新进一次出游面板就能看到。'),
      artworkNotice ? node('p', { class: 'fpl-notice', role: 'status' }, artworkNotice) : null,
      artworkError ? node('p', { class: 'fpl-error', role: 'alert' }, artworkError) : null,
      node('div', { class: 'fpl-artwork-grid' }, cards),
      node('section', { class: 'fpl-card fpl-stack' }, node('h4', {}, '关于本地插画'),
        node('p', {}, '仅接受 PNG、JPEG、WebP，每张不超过 2 MB、1600 万像素；会检查文件类型与内容，不接受 SVG。图片不会上传，请只导入你有权使用的素材。'),
        note('清理浏览器数据可能移除插画；图片加载失败时会回到文字与示意场景，操作入口照常保留。')));
  }
  function settings() {
    // This form is rebuilt from the snapshot, so its revision must match the displayed values.
    editRevision = snapshot.revision;
    const style = node('textarea', { rows: 3 }, snapshot.defaultStyle || '');
    const home = find(snapshot.homeId);
    const overridden = places().filter((place) => place.overridden).length;
    const card = node('section', { class: 'fpl-card fpl-stack' }, node('h3', { tabindex: -1 }, '住所与画风'),
      node('p', {}, `当前住所：${home?.name ?? '未设置'}`), note('打开一个地点即可设置住所。故事首页会展示住所，出游位置单独记录。'),
      node('form', { class: 'fpl-stack', onsubmit: (event) => {
        event.preventDefault();
        void submit('setDefaultStyle', { style: style.value.trim() }, '已保存默认画风。', render);
      } }, field('全局默认画风', style, '仅在地点画风留空时使用。清空后保存即可移除默认画风。'),
      row(node('button', { type: 'submit', class: 'fpl-primary' }, '保存默认画风'))));
    if (!overridden) return card;
    // 恢复预设的入口已从「去哪儿」挪到这里（逐处恢复在详情页）。
    return node('div', { class: 'fpl-stack' }, card,
      node('section', { class: 'fpl-card fpl-stack' }, node('h4', {}, '预设地点'),
        note(`有 ${overridden} 处预设被改过。打开那一处可以单独恢复；也可以一次全部恢复。`),
        row(confirm(`恢复全部预设（${overridden} 处）`, '把所有改过的预设恢复成插件自带的版本？你自己加的地点不受影响。',
          () => submit('resetAll', {}, '已恢复全部预设。', render)))));
  }
  const migration = createMigrationView({ document, places, snapshot: () => snapshot, run, call, tell, render, refreshSnapshot, live });
  function render() {
    if (!live()) return;
    const active = ['detail', 'edit', 'create', 'cover', 'browse'].includes(view) ? 'browse' : view;
    navigation.replaceChildren(...[['browse', '浏览地点'], ['settings', '住所与画风'], ['artwork', '本地插画'], ['migration', '从小世界迁入']].map(([id, label]) =>
      button(label, () => { tell(); go(id); }, { 'aria-current': active === id ? 'page' : null })), button('刷新', refresh));
    let contents;
    if (!snapshot) contents = node('p', { class: 'fpl-empty' }, '正在读取地点库…');
    else if (view === 'settings') contents = settings();
    else if (view === 'artwork') contents = artworkView();
    else if (view === 'migration') contents = migration.render();
    else if (view === 'create') contents = editor();
    else if (view === 'edit' && detail) contents = editor(detail);
    else if (view === 'cover' && detail) contents = coverEditor(detail);
    else if (view === 'detail' && detail) contents = describePlace(detail);
    else contents = browse();
    const pending = confirmation();
    main.replaceChildren(...(pending ? [pending, contents] : [contents]));
    if (busy) lock(true);
    if (focusAfterRender) { focusAfterRender = false; main.querySelector('h3')?.focus(); }
  }
  async function refresh() {
    await run(async () => {
      await refreshSnapshot();
      if (!live()) return;
      if (detailId && view === 'detail') {
        if (find(detailId)) await readDetail(detailId);
        else { detail = undefined; detailId = undefined; view = 'browse'; }
      }
      if (live() && !['create', 'edit', 'cover'].includes(view)) render();
    }, { onError: () => { if (!snapshot) main.replaceChildren(node('p', { class: 'fpl-empty' }, '暂时读不到地点库，请刷新重试。')); } });
  }
  function dispose() {
    disposed = true;
    ctx.signal?.removeEventListener('abort', dispose);
    if (section.parentNode === root) section.remove();
  }
  ctx.signal?.addEventListener('abort', dispose, { once: true });
  render();
  void refresh();
  return { refresh, dispose };
}
