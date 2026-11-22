/**
 * 「家」面板（第七个面板，页签名「家」）。
 *
 * 约定与其它面板一致：
 *   · 只往 `ctx.root` 里写 DOM，不碰 document.body；样式注入一个 `<style>`（shadow root 也吃得到）。
 *   · 数据一律走 `ctx.invoke`，不读私有状态、不算时间——「23 分钟」是服务端算好给的。
 *   · 只读接口是 `state` / `art`；写只有切活动、改备注、换图、清图、落热点、恢复默认。
 *
 * 三条产品边界写死在界面里：
 *   1. 这里显示的是**房间里的样子**，不是她真的做过这件事（底部常驻一行说明）。
 *   2. 面板不提供任何「记进生活」的入口，也不自动出发。
 *   3. 出门状态只读自本 World 的行程，切姿势不会改动行程。
 */
import { pictureData } from '../places/helpers.js';
import { HOME_LAYOUT, positionOf } from './layout.js';
import { HOME_STYLES } from './styles.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp';
/** 画架选图：和 attachPainting 认的 MIME 一致。 */
const PICKER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
/** 按内容寻址的图片引用缓存：切回面板不重复拉同一张图。 */
const artCache = new Map();
/** 纪念品固定摆位：票根/杂项→书架、杯子→茶几、玩偶→沙发边、花草→窗台。 */
const KEEPSAKE_SLOTS = {
  ticket: { left: 50, top: 40, icon: '🎫' },
  shelf: { left: 55, top: 44, icon: '🧩' },
  cup: { left: 47, top: 70, icon: '☕' },
  doll: { left: 85, top: 72, icon: '🧸' },
  plant: { left: 16, top: 58, icon: '🪴' },
};

function monthDay(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ''));
  return match ? `${Number(match[2])} 月 ${Number(match[3])} 日` : '';
}

/**
 * 批量导入按文件名分拣（任务书 §4.6）：
 *   `bg-*` → 背景；`ch-idle*` → 待机；`act-<activity>*` → 对应活动；
 *   `act-outside` = `looking_outside`；`chibi-*` 与其他 → 「未使用」。
 */
export function classifyHomeFile(name) {
  const base = String(name ?? '').toLowerCase().replace(/\.[a-z0-9]+$/, '');
  if (!base) return null;
  if (base.startsWith('bg-')) return { kind: 'background' };
  if (base.startsWith('ch-idle')) return { kind: 'character', activity: 'idle' };
  if (!base.startsWith('act-')) return null;
  const rest = base.slice(4);
  const ids = Object.keys(HOME_LAYOUT).filter((id) => id !== 'idle').sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (rest === id || rest.startsWith(`${id}-`) || rest.startsWith(`${id}_`)) {
      return { kind: 'character', activity: id };
    }
  }
  if (rest === 'outside' || rest.startsWith('outside-') || rest.startsWith('outside_')) {
    return { kind: 'character', activity: 'looking_outside' };
  }
  return null;
}

function el(document, tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') element.className = value;
    else if (name === 'text') element.textContent = String(value);
    else if (name === 'style') element.setAttribute('style', value);
    else if (name === 'hidden') element.hidden = Boolean(value);
    else if (name.startsWith('on') && typeof value === 'function') element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'object' ? child : String(child));
  }
  return element;
}

function relativeTime(minutes) {
  if (minutes === null || minutes === undefined) return '';
  if (minutes < 1) return '刚开始';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}

function statusOf(snapshot) {
  const trip = snapshot.trip ?? { mode: 'home' };
  if (trip.mode === 'out') {
    const walked = trip.total ? `（逛了 ${trip.visited}/${trip.total}）` : '';
    return `出门中 · ${trip.placeName}${walked}`;
  }
  if (trip.mode === 'draft') return `还没逛完 · ${trip.placeName}`;
  const label = snapshot.room?.label ?? '发呆';
  const time = relativeTime(snapshot.room?.elapsedMinutes);
  return time ? `${label} · ${time}` : label;
}

function placeOf(snapshot) {
  if (snapshot.trip?.mode === 'out') return { text: `在外 · ${snapshot.trip.placeName}`, out: true };
  if (snapshot.place?.name) return { text: snapshot.place.name, out: false };
  return { text: '还没设住所', out: false };
}

export function mountHome(ctx) {
  const root = ctx.root;
  const document = root.ownerDocument ?? globalThis.document;
  const section = el(document, 'section', { class: 'fun fhm', 'aria-label': '鱼的家' });
  const style = el(document, 'style');
  style.textContent = HOME_STYLES;
  section.append(style);
  root.replaceChildren(section);

  let disposed = false;
  let busy = false;
  let snapshot = null;
  let ticker = null;
  const view = {
    editing: false, noteDraft: null, planDraft: null, feedback: '', tone: '', batch: null, copyFallback: '',
    placements: null, hotspots: null, snapshots: [], exportText: '',
  };
  const live = () => !disposed && !ctx.signal?.aborted;

  function call(method, payload) {
    return ctx.invoke(method, payload === undefined ? [] : [payload]);
  }

  function accept(result) {
    if (result && Array.isArray(result.activities) && result.room) snapshot = result;
    return snapshot;
  }

  function tell(text, tone = '') {
    view.feedback = text;
    view.tone = tone;
  }

  async function loadArt(slot, activity) {
    const key = slot === 'background' ? snapshot?.art?.background
      : slot === 'foreground' ? snapshot?.art?.foreground
        : slot === 'painting' ? snapshot?.art?.painting
          : (snapshot?.art?.characters?.[activity] ?? snapshot?.art?.characters?.idle);
    // 没传过角色图时服务端会回内置 Q 版：没有 key 也要去取，缓存按内置活动记。
    const builtin = snapshot?.art?.builtin ?? [];
    const useBuiltin = slot === 'character' && !key && (builtin.includes(activity) || builtin.includes('idle'));
    if (!key && !useBuiltin) return null;
    const cacheKey = key || `builtin:${activity}`;
    if (artCache.has(cacheKey)) return artCache.get(cacheKey);
    try {
      const result = await call('art', { slot, activity });
      const image = result?.image?.dataUrl ?? null;
      if (image) artCache.set(cacheKey, image);
      return image;
    } catch {
      return null;
    }
  }

  async function loadSnapshots() {
    try {
      const result = await call('snapshotList');
      view.snapshots = result?.ok === true && Array.isArray(result.items) ? result.items : [];
    } catch {
      view.snapshots = [];
    }
  }

  async function refresh() {
    if (disposed) return;
    try {
      accept(await call('state'));
      tell('');
    } catch (error) {
      tell(error?.message ?? '房间暂时读不出来。', 'error');
    }
    await loadSnapshots();
    render();
  }

  async function write(method, payload, okText = '') {
    if (busy || !live()) return null;
    busy = true;
    section.setAttribute('aria-busy', 'true');
    try {
      const result = await call(method, payload);
      if (result?.ok === false) throw new Error(result.error || '宿主拒绝了这次修改。');
      if (result?.ok !== true) throw new Error('宿主没有返回结果。');
      accept(result);
      tell(okText, okText ? 'ok' : '');
      return result;
    } catch (error) {
      tell(error?.message ?? '这次修改没成功。', 'error');
      return null;
    } finally {
      busy = false;
      section.setAttribute('aria-busy', 'false');
      if (!view.editing) render();
      else render({ keepFocus: true });
    }
  }

  async function tick() {
    if (!live() || busy || view.editing) return;
    try {
      const result = await call('state');
      if (result?.ok === false) return;
      accept(result);
      if (refs.status) refs.status.textContent = statusOf(snapshot);
      if (refs.place) {
        const place = placeOf(snapshot);
        refs.place.textContent = place.text;
        refs.place.setAttribute('data-out', place.out ? '1' : '0');
      }
    } catch { /* 定时刷新失败不打扰；下一次手动刷新还在。 */ }
  }

  const refs = {};

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const round3 = (value) => Math.round(value * 1000) / 1000;

  /** 当前活动实际站位：默认表 + `room.placements` 里的覆盖（有才用）。 */
  function effectiveSpot(activity) {
    const base = positionOf(activity);
    const override = (view.placements ?? snapshot.placements ?? {})[activity];
    return override ? { ...base, ...override } : base;
  }

  function placementDraft() {
    return { ...(view.placements ?? snapshot.placements ?? {}) };
  }

  /** 只把「和默认值不同」的活动写进 placements；改回默认就删掉这一条。 */
  function setPlacement(activity, next) {
    const base = positionOf(activity);
    const draft = placementDraft();
    const same = Math.abs(next.x - base.x) < 0.0005 && Math.abs(next.y - base.y) < 0.0005
      && Math.abs(next.scale - base.scale) < 0.0005;
    if (same) delete draft[activity];
    else draft[activity] = { x: round3(next.x), y: round3(next.y), scale: round3(next.scale) };
    view.placements = draft;
  }

  function savePlacementsDraft() {
    void write('savePlacements', { placements: placementDraft(), revision: snapshot.revision }, '位置存好了。');
  }

  function hotspotDraft() {
    return (view.hotspots ?? snapshot.art?.hotspots ?? []).map((item) => ({ ...item }));
  }

  function saveHotspotsDraft() {
    void write('saveHotspots', { hotspots: hotspotDraft(), revision: snapshot.revision }, '热点存好了。');
  }

  function stagePoint(stage, event) {
    const rect = stage?.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return null;
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) };
  }

  function attachCharacterDrag(img, activity, shadow) {
    let drag = null;
    img.addEventListener('pointerdown', (event) => {
      if (!view.editing || busy) return;
      drag = { rect: img.parentNode?.getBoundingClientRect?.() ?? null };
      event.preventDefault?.();
    });
    const move = (event) => {
      if (!drag) return;
      const rect = drag.rect;
      if (!rect?.width || !rect?.height) return;
      const x = clamp01((event.clientX - rect.left) / rect.width);
      const y = clamp01((event.clientY - rect.top) / rect.height);
      const next = { x, y, scale: effectiveSpot(activity).scale };
      setPlacement(activity, next);
      img.style.left = `${(x * 100).toFixed(2)}%`;
      img.style.bottom = `${((1 - y) * 100).toFixed(2)}%`;
      shadow.style.left = `${(x * 100).toFixed(2)}%`;
      shadow.style.bottom = `${((1 - y) * 100).toFixed(2)}%`;
    };
    const up = () => {
      if (!drag) return;
      drag = null;
      savePlacementsDraft();
    };
    img.addEventListener('pointermove', move);
    img.addEventListener('pointerup', up);
    img.addEventListener('pointercancel', up);
  }

  function attachHotspotDrag(node, id, stage) {
    let drag = null;
    node.addEventListener('pointerdown', (event) => {
      if (!view.editing || busy) return;
      drag = true;
      event.preventDefault?.();
    });
    const move = (event) => {
      if (!drag) return;
      const point = stagePoint(stage, event);
      if (!point) return;
      view.hotspots = hotspotDraft().map((item) => (item.id === id
        ? { ...item, x: round3(point.x), y: round3(point.y) } : item));
      node.style.left = `${(point.x * 100).toFixed(2)}%`;
      node.style.top = `${(point.y * 100).toFixed(2)}%`;
    };
    const up = () => {
      if (!drag) return;
      drag = null;
      saveHotspotsDraft();
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }

  function renderStage() {
    const stage = el(document, 'div', {
      class: 'fhm-stage',
      tabindex: '0',
      role: 'img',
      'aria-label': `鱼的家，正在${snapshot.room.label}`,
    });
    const bgRef = snapshot.art?.background;
    if (bgRef) {
      const img = el(document, 'img', { class: 'fhm-bg', alt: '', decoding: 'async' });
      stage.append(img);
      loadArt('background').then((src) => { if (src && live()) img.setAttribute('src', src); });
    } else {
      stage.append(el(document, 'div', { class: 'fhm-room' },
        el(document, 'div', { class: 'fhm-window' }),
        el(document, 'div', { class: 'fhm-baseboard' }),
        el(document, 'div', { class: 'fhm-sofa' }),
        el(document, 'div', { class: 'fhm-rug' }),
        el(document, 'p', { class: 'fhm-room-note' },
          el(document, 'b', { text: '还没有房间图' }),
          '点「布置房间」换一张。没有她的图也行，一样看得到她在做什么。')));
    }

    const status = el(document, 'p', { class: 'fhm-status', text: statusOf(snapshot) });
    const place = placeOf(snapshot);
    const placeNode = el(document, 'p', { class: 'fhm-place', 'data-out': place.out ? '1' : '0', text: place.text });
    refs.status = status;
    refs.place = placeNode;
    stage.append(status, placeNode);

    // 时段色罩：纯 CSS，不依赖素材；四段光由服务端算。
    stage.append(el(document, 'div', {
      class: 'fhm-light',
      'data-phase': snapshot.phase ?? 'day',
      'aria-hidden': 'true',
    }));

    // 画架/相框：固定位置、只读；图是用户自己选的本地图，复制进 art/。
    if (snapshot.art?.painting) {
      const frame = el(document, 'img', { class: 'fhm-painting', alt: '画架上的画', decoding: 'async' });
      stage.append(frame);
      loadArt('painting').then((src) => { if (src && live()) frame.setAttribute('src', src); });
    }

    const builtin = snapshot.art?.builtin ?? [];
    const hasCharacter = Boolean(snapshot.art?.characters?.[snapshot.room.activity]
      ?? snapshot.art?.characters?.idle)
      || builtin.includes(snapshot.room.activity) || builtin.includes('idle');
    const spot = effectiveSpot(snapshot.room.activity);
    // 接触阴影：有图没图都在，角色才不像贴纸。位置跟脚底走，大小跟缩放走。
    const shadow = el(document, 'div', {
      class: 'fhm-char-shadow',
      'aria-hidden': 'true',
      style: `left:${(spot.x * 100).toFixed(2)}%;bottom:${((1 - spot.y) * 100).toFixed(2)}%;width:${(spot.scale * 62).toFixed(2)}%`,
    });
    stage.append(shadow);
    if (hasCharacter) {
      const char = el(document, 'img', {
        class: 'fhm-char',
        alt: `鱼在家的样子：${snapshot.room.label}`,
        decoding: 'async',
        // 站位：水平居中、底边落在 y 上；高度按角色高度/舞台高。不再有 76% 硬上限。
        style: `left:${(spot.x * 100).toFixed(2)}%;bottom:${((1 - spot.y) * 100).toFixed(2)}%;height:${(spot.scale * 100).toFixed(2)}%`,
      });
      stage.append(char);
      loadArt('character', snapshot.room.activity).then((src) => {
        if (src && live()) char.setAttribute('src', src);
      });
      if (view.editing) attachCharacterDrag(char, snapshot.room.activity, shadow);
    }

    // 前景层：可选图，叠在角色前面。
    if (snapshot.art?.foreground) {
      const front = el(document, 'img', { class: 'fhm-foreground', alt: '', decoding: 'async' });
      stage.append(front);
      loadArt('foreground').then((src) => { if (src && live()) front.setAttribute('src', src); });
    }

    // 热点：按钮可 Tab、Enter 打开；布置态可拖。点开是只读气泡（家具名 + 那一句）。
    const spotBubbles = [];
    for (const item of snapshot.art?.hotspots ?? []) {
      const bubble = el(document, 'span', {
        class: 'fhm-spot-bubble',
        hidden: true,
        text: `${item.label || item.id}${item.note ? `：${item.note}` : ''}`,
        style: `left:${(item.x * 100).toFixed(2)}%;top:${(item.y * 100).toFixed(2)}%`,
      });
      spotBubbles.push(bubble);
      const dot = el(document, 'button', {
        type: 'button',
        class: 'fhm-spot',
        'aria-label': `房间热点：${item.label || item.id}`,
        title: item.label || item.id,
        text: '·',
        style: `left:${(item.x * 100).toFixed(2)}%;top:${(item.y * 100).toFixed(2)}%`,
        onclick: () => {
          if (view.editing) return;
          const open = bubble.hidden;
          for (const other of spotBubbles) other.hidden = true;
          bubble.hidden = !open;
        },
      });
      stage.append(dot, bubble);
      if (view.editing) attachHotspotDrag(dot, item.id, stage);
    }

    if (snapshot.room.note) stage.append(el(document, 'p', { class: 'fhm-note', text: snapshot.room.note }));

    // 纪念品：最新 3–5 件按类别落固定摆位；点一下只读气泡，不发任何写请求。
    const used = {};
    const bubbles = [];
    for (const item of snapshot.keepsakes ?? []) {
      const slot = KEEPSAKE_SLOTS[item.category] ?? KEEPSAKE_SLOTS.shelf;
      const offset = used[item.category] ?? 0;
      used[item.category] = offset + 1;
      const left = slot.left + offset * 3;
      const top = slot.top + offset * 3;
      const bubble = el(document, 'span', {
        class: 'fhm-keepsake-bubble',
        hidden: true,
        text: `${item.name} · 来自${item.placeName}${monthDay(item.day) ? ` · ${monthDay(item.day)}` : ''}`,
        style: `left:${left}%;top:${top}%`,
      });
      bubbles.push(bubble);
      stage.append(el(document, 'button', {
        type: 'button',
        class: 'fhm-keepsake',
        'aria-label': `${item.name}，来自${item.placeName}`,
        title: `${item.name} · 来自${item.placeName}`,
        text: slot.icon,
        style: `left:${left}%;top:${top}%`,
        onclick: () => {
          const open = bubble.hidden;
          for (const other of bubbles) other.hidden = true;
          bubble.hidden = !open;
        },
      }), bubble);
    }
    return stage;
  }

  function renderChips() {
    const row = el(document, 'div', { class: 'fhm-chips', role: 'group', 'aria-label': '她在家的样子' });
    for (const activity of snapshot.activities) {
      const current = activity.id === snapshot.room.activity;
      row.append(el(document, 'button', {
        type: 'button',
        class: 'fhm-chip',
        'aria-pressed': current ? 'true' : 'false',
        title: activity.hint,
        disabled: Boolean(snapshot.damaged) || busy,
        onclick: () => {
          if (activity.id === snapshot.room.activity) return;
          void write('setActivity', { activity: activity.id, revision: snapshot.revision },
            `换成「${activity.label}」了。`);
        },
      }, activity.label));
    }
    return row;
  }

  function renderActions() {
    const row = el(document, 'div', { class: 'fhm-actions' },
      el(document, 'button', {
        type: 'button',
        text: view.editing ? '收起布置' : '布置房间',
        onclick: () => {
          view.editing = !view.editing;
          if (view.editing) {
            view.noteDraft = snapshot.room.note;
            view.placements = { ...(snapshot.placements ?? {}) };
            view.hotspots = (snapshot.art?.hotspots ?? []).map((item) => ({ ...item }));
          } else {
            view.placements = null;
            view.hotspots = null;
          }
          render();
        },
      }),
      el(document, 'button', {
        type: 'button',
        text: '恢复默认',
        disabled: Boolean(snapshot.damaged) || busy,
        onclick: () => {
          if (typeof globalThis.confirm === 'function' && !globalThis.confirm('把活动、备注、热点和位置恢复默认？活动会改回「随时段变」，已上传的图片会保留。')) return;
          void write('resetRoom', { revision: snapshot.revision }, '已恢复默认。');
        },
      }),
      el(document, 'span', { class: 'fhm-fine', text: 'ⓘ 这里显示的是房间里的样子，不是记录' }));
    return row;
  }

  async function upload(kind, activity, input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';
    try {
      const dataUrl = await pictureData(file, MAX_IMAGE_BYTES, document.defaultView?.FileReader ?? globalThis.FileReader);
      if (kind === 'background') await write('setBackground', { dataUrl, revision: snapshot.revision }, '背景换好了。');
      else if (kind === 'foreground') await write('setForeground', { dataUrl, revision: snapshot.revision }, '前景换好了。');
      else await write('setCharacter', { activity, dataUrl, revision: snapshot.revision }, '这张图换好了。');
    } catch (error) {
      tell(error?.message ?? '这张图没读出来。', 'error');
      render();
    }
  }

  /**
   * 批量导入：一次选多张，按文件名分拣，串行写（每次带最新 revision）。
   * 单张失败只跳过并汇总，不中断其余文件；认不出的进「未使用」，不上传。
   */
  async function importMany(input) {
    const files = [...(input?.files ?? [])];
    input.value = '';
    if (!files.length) return;
    const placed = [];
    const unused = [];
    const failed = [];
    for (const file of files) {
      const slot = classifyHomeFile(file.name);
      if (!slot) { unused.push(file.name); continue; }
      try {
        const dataUrl = await pictureData(file, MAX_IMAGE_BYTES, document.defaultView?.FileReader ?? globalThis.FileReader);
        const result = slot.kind === 'background'
          ? await write('setBackground', { dataUrl, revision: snapshot.revision }, '')
          : await write('setCharacter', { activity: slot.activity, dataUrl, revision: snapshot.revision }, '');
        if (result) placed.push(file.name);
        else failed.push(file.name);
      } catch {
        failed.push(file.name);
      }
    }
    view.batch = { placed, unused, failed };
    const bits = [`批量导入 ${files.length} 张：${placed.length} 张已就位`];
    if (unused.length) bits.push(`${unused.length} 张未使用（${unused.join('、')}）`);
    if (failed.length) bits.push(`${failed.length} 张失败（${failed.join('、')}）`);
    tell(bits.join('；') + '。', failed.length ? 'error' : 'ok');
    render();
  }

  async function choosePainting() {
    if (typeof ctx.pickPath !== 'function') {
      tell('这个宿主不支持选本地图片。', 'error');
      render();
      return;
    }
    try {
      // 宿主的 pickPath 必须带 kind：Coo 校验 kind 只能是 file 或 directory，缺了直接 400。
      const picked = await ctx.pickPath({ kind: 'file', title: '选一张图挂到画架', extensions: PICKER_EXTENSIONS });
      const path = typeof picked === 'string' ? picked : (picked?.path ?? picked?.filePath ?? '');
      if (!path) return;
      await write('setPainting', { path, revision: snapshot.revision }, '挂到画架上了。');
    } catch (error) {
      tell(error?.message ?? '这张图没选成。', 'error');
      render();
    }
  }

  async function saveSnapshotNow() {
    const result = await write('snapshotSave', {}, '快照存好了。');
    if (result) await loadSnapshots();
    render();
  }

  async function removeSnapshotNow(id) {
    const result = await write('snapshotRemove', { id }, '快照删掉了。');
    if (result) await loadSnapshots();
    render();
  }

  function downloadJson(data) {
    const text = JSON.stringify(data, null, 2);
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fish-home-export.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL?.(url), 0);
      tell('备份已导出（只有引用，没有图片字节）。', 'ok');
    } catch {
      view.exportText = text;
      tell('浏览器不给下载，备份内容放进下面的文本框了。', '');
    }
    render();
  }

  async function exportBackup() {
    try {
      const result = await call('exportRoom');
      if (result?.ok !== true) throw new Error(result?.error ?? '导出失败。');
      downloadJson(result);
    } catch (error) {
      tell(error?.message ?? '导出失败。', 'error');
      render();
    }
  }

  async function importBackup(input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';
    try {
      const text = await new Promise((resolve, reject) => {
        const Reader = document.defaultView?.FileReader ?? globalThis.FileReader;
        if (!Reader) { reject(new Error('这个环境读不了文件。')); return; }
        const reader = new Reader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('读不了这个文件。'));
        reader.readAsText(file);
      });
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('这不是一份备份 JSON。'); }
      await write('importRoom', { data, revision: snapshot.revision }, '导入完成。');
    } catch (error) {
      tell(error?.message ?? '导入失败。', 'error');
      render();
    }
  }

  function snapshotWhen(at) {
    if (!Number.isFinite(at)) return '';
    const date = new Date(at);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderSnapshots() {
    const box = el(document, 'div', { class: 'fhm-snaps' },
      el(document, 'div', { class: 'fhm-snaps-head' },
        el(document, 'span', { class: 'fhm-plan-label', text: '快照' }),
        el(document, 'button', { type: 'button', text: '存快照', onclick: () => { void saveSnapshotNow(); } })),
      el(document, 'p', { class: 'fhm-fine', text: '只记那一刻的房间；图按 digest 引用，不复制字节。删快照不影响当前房间。' }));
    if (!view.snapshots.length) {
      box.append(el(document, 'p', { class: 'fhm-deps-empty', text: '还没有快照。' }));
    } else {
      for (const item of view.snapshots) {
        box.append(el(document, 'div', { class: 'fhm-snap-row' },
          el(document, 'span', { class: 'fhm-snap-main', text: `${snapshotWhen(item.at)} · ${item.label || '发呆'}${item.note ? ` · ${item.note}` : ''}` }),
          item.missing ? el(document, 'span', { class: 'fhm-snap-missing', text: '这张图不在了' }) : null,
          el(document, 'button', {
            type: 'button',
            text: '删除',
            'aria-label': `删除快照 ${item.id}`,
            onclick: () => { void removeSnapshotNow(item.id); },
          })));
      }
    }
    box.append(el(document, 'div', { class: 'fhm-row-actions' },
      el(document, 'button', { type: 'button', text: '导出备份', onclick: () => { void exportBackup(); } }),
      el(document, 'label', { class: 'fhm-import' }, '导入备份',
        el(document, 'input', {
          type: 'file', accept: '.json,application/json', 'aria-label': '导入房间备份',
          onchange: (event) => { void importBackup(event.target); },
        }))));
    if (view.exportText) {
      const out = el(document, 'textarea', { readonly: '', rows: '3', 'aria-label': '导出内容' });
      out.value = view.exportText;
      box.append(out);
    }
    return box;
  }

  function renderDress() {
    if (!view.editing) return null;
    const box = el(document, 'div', { class: 'fhm-dress' },
      el(document, 'h3', { text: '布置房间' }),
      el(document, 'p', {
        class: 'fhm-dress-note',
        text: '没传角色图时用内置的 Q 版立绘（十个活动都有，透明边已裁掉）；想换就传自己的图。背景 1920×1080；角色图十个活动同一张画布、底边对齐。单张不超过 8 MiB，支持 PNG / JPG / WebP / GIF。批量导入按文件名认领：bg-* 背景、ch-idle* 待机、act-<活动>* 对应活动；chibi-* 与其他会列进未使用（内置已经有了，不用再导）。',
      }));

    const bgRow = el(document, 'div', { class: 'fhm-row' },
      el(document, 'span', { class: 'fhm-row-name', text: '房间背景' }),
      el(document, 'input', { type: 'file', accept: ACCEPT, 'aria-label': '选择房间背景' , onchange: (event) => { void upload('background', '', event.target); } }),
      el(document, 'span', { class: 'fhm-row-name', text: snapshot.art?.background ? '已设置' : '未设置' }),
      el(document, 'button', {
        type: 'button',
        text: '清空',
        disabled: !snapshot.art?.background || busy,
        'aria-label': '清空房间背景',
        onclick: () => { void write('clearBackground', { revision: snapshot.revision }, '背景清掉了。'); },
      }));
    box.append(bgRow);

    box.append(el(document, 'div', { class: 'fhm-row' },
      el(document, 'span', { class: 'fhm-row-name', text: '前景层（可选）' }),
      el(document, 'input', {
        type: 'file', accept: ACCEPT, 'aria-label': '选择前景层图片',
        onchange: (event) => { void upload('foreground', '', event.target); },
      }),
      el(document, 'span', { class: 'fhm-row-name', text: snapshot.art?.foreground ? '已设置' : '未设置' }),
      el(document, 'button', {
        type: 'button',
        text: '清空',
        disabled: !snapshot.art?.foreground || busy,
        'aria-label': '清空前景层图片',
        onclick: () => { void write('clearForeground', { revision: snapshot.revision }, '前景清掉了。'); },
      })));

    box.append(el(document, 'div', { class: 'fhm-row' },
      el(document, 'span', { class: 'fhm-row-name', text: '画架 / 相框' }),
      el(document, 'button', {
        type: 'button', text: '选一张本地图', 'aria-label': '选一张本地图挂到画架',
        onclick: () => { void choosePainting(); },
      }),
      el(document, 'span', { class: 'fhm-row-name', text: snapshot.art?.painting ? '已设置' : '未设置' }),
      el(document, 'button', {
        type: 'button', text: '清空',
        disabled: !snapshot.art?.painting || busy,
        'aria-label': '清空画架图片',
        onclick: () => { void write('clearPainting', { revision: snapshot.revision }, '画架清空了。'); },
      })));
    box.append(el(document, 'div', { class: 'fhm-row fhm-batch' },
      el(document, 'span', { class: 'fhm-row-name', text: '批量导入' }),
      el(document, 'input', {
        type: 'file',
        multiple: '',
        accept: ACCEPT,
        'aria-label': '批量导入房间素材',
        onchange: (event) => { void importMany(event.target); },
      })));
    if (view.batch) {
      const bits = [`已就位 ${view.batch.placed.length} 张`];
      if (view.batch.unused.length) bits.push(`未使用：${view.batch.unused.join('、')}`);
      if (view.batch.failed.length) bits.push(`失败：${view.batch.failed.join('、')}`);
      box.append(el(document, 'p', { class: 'fhm-batch-result', text: bits.join('；') }));
    }

    for (const activity of snapshot.activities) {
      const has = Boolean(snapshot.art?.characters?.[activity.id]);
      const usingBuiltin = !has && ((snapshot.art?.builtin ?? []).includes(activity.id)
        || (snapshot.art?.builtin ?? []).includes('idle'));
      box.append(el(document, 'div', { class: 'fhm-row' },
        el(document, 'span', { class: 'fhm-row-name', text: activity.label }),
        el(document, 'input', {
          type: 'file',
          accept: ACCEPT,
          'aria-label': `选择「${activity.label}」的角色图`,
          onchange: (event) => { void upload('character', activity.id, event.target); },
        }),
        el(document, 'span', { class: 'fhm-row-name', text: has ? '已设置' : (usingBuiltin ? '内置 Q 版' : '未设置') }),
        el(document, 'button', {
          type: 'button',
          text: '清空',
          disabled: !has || busy,
          'aria-label': `清空「${activity.label}」的角色图`,
          onclick: () => { void write('clearCharacter', { activity: activity.id, revision: snapshot.revision }, '这张图清掉了。'); },
        })));
    }

    // ---- 热点编辑：增 / 删 / 改名 / 改一句；舞台上的点也能拖 ----
    const hotspotList = view.hotspots ?? [];
    const spotRows = hotspotList.map((item) => {
      const label = el(document, 'input', { type: 'text', maxlength: '24', 'aria-label': '热点名称' });
      label.value = item.label ?? '';
      label.addEventListener('input', () => { item.label = label.value; });
      const noteInput = el(document, 'input', { type: 'text', maxlength: '60', 'aria-label': '热点那句话' });
      noteInput.value = item.note ?? '';
      noteInput.addEventListener('input', () => { item.note = noteInput.value; });
      return el(document, 'div', { class: 'fhm-hotspot-row' }, label, noteInput,
        el(document, 'button', {
          type: 'button',
          text: '删除',
          'aria-label': `删除热点 ${item.label || item.id}`,
          onclick: () => {
            view.hotspots = hotspotList.filter((row) => row.id !== item.id);
            render();
          },
        }));
    });
    const spotSection = el(document, 'div', { class: 'fhm-dress-section' },
      el(document, 'h4', { text: '热点' }),
      el(document, 'p', { class: 'fhm-dress-note', text: '家具名 + 一句说明；点画面上的圆点能看，布置时能拖；最多 12 个。' }),
      ...spotRows,
      el(document, 'div', { class: 'fhm-row-actions' },
        el(document, 'button', {
          type: 'button',
          text: '添加热点',
          disabled: hotspotList.length >= 12 || busy,
          onclick: () => {
            const list = hotspotList;
            let n = 1;
            const ids = new Set(list.map((row) => row.id));
            while (ids.has(`spot-${n}`)) n += 1;
            view.hotspots = [...list, { id: `spot-${n}`, x: 0.5, y: 0.5, label: '新热点', note: '' }];
            render();
          },
        }),
        el(document, 'button', {
          type: 'button',
          text: '保存热点',
          disabled: busy,
          onclick: () => { saveHotspotsDraft(); },
        })));
    box.append(spotSection);

    // ---- 位置微调：每个活动可改 x/y/scale；只存和默认值不同的 ----
    const placementRows = snapshot.activities.map((activity) => {
      const current = effectiveSpot(activity.id);
      const makeNumber = (key, value, min, max, step) => {
        const input = el(document, 'input', {
          type: 'number', min: String(min), max: String(max), step: String(step),
          'aria-label': `「${activity.label}」${key}`,
        });
        input.value = String(value);
        return input;
      };
      const x = makeNumber('x', current.x, 0, 1, 0.001);
      const y = makeNumber('y', current.y, 0, 1, 0.001);
      const scale = makeNumber('scale', current.scale, 0.1, 2, 0.001);
      const update = () => {
        const next = { x: Number(x.value), y: Number(y.value), scale: Number(scale.value) };
        if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.scale)) return;
        setPlacement(activity.id, next);
      };
      x.addEventListener('input', update);
      y.addEventListener('input', update);
      scale.addEventListener('input', update);
      return el(document, 'div', { class: 'fhm-place-row' },
        el(document, 'span', { class: 'fhm-row-name', text: activity.label }),
        x, y, scale,
        el(document, 'button', {
          type: 'button',
          text: '还原',
          'aria-label': `还原「${activity.label}」的位置`,
          onclick: () => {
            const draft = placementDraft();
            delete draft[activity.id];
            view.placements = draft;
            render();
          },
        }));
    });
    const placeSection = el(document, 'div', { class: 'fhm-dress-section' },
      el(document, 'h4', { text: '位置微调' }),
      el(document, 'p', { class: 'fhm-dress-note', text: 'x / y / 缩放（x、y 是 0–1，缩放 0.1–2）。也可以直接在画面上拖角色。只保存和默认站位不同的。' }),
      ...placementRows,
      el(document, 'div', { class: 'fhm-row-actions' },
        el(document, 'button', {
          type: 'button',
          text: '全部还原',
          onclick: () => { view.placements = {}; render(); },
        }),
        el(document, 'button', {
          type: 'button',
          text: '保存位置',
          disabled: busy,
          onclick: () => { savePlacementsDraft(); },
        })));
    box.append(placeSection);

    const note = el(document, 'textarea', {
      maxlength: '120',
      placeholder: '一句房间里的备注，比如「在沙发上翻一本旧书」',
      'aria-label': '房间备注',
    });
    note.value = view.noteDraft ?? snapshot.room.note;
    note.addEventListener('input', () => { view.noteDraft = note.value; });
    box.append(el(document, 'div', { class: 'fhm-note-form' }, note,
      el(document, 'button', {
        type: 'button',
        text: '保存备注',
        disabled: busy,
        onclick: () => {
          void write('setNote', { note: note.value, revision: snapshot.revision }, '备注记下了。').then(() => {
            view.noteDraft = null;
          });
        },
      })));
    return box;
  }

  async function copyPending() {
    const text = snapshot.pendingLine;
    if (!text) return;
    try {
      const clipboard = document.defaultView?.navigator?.clipboard ?? globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error('no clipboard');
      await clipboard.writeText(text);
      view.copyFallback = '';
      tell('已复制「待记一条」。', 'ok');
    } catch {
      // 拿不到剪贴板（无权限 / 宿主没给）就退回只读文本框，不假装复制成功。
      view.copyFallback = text;
      tell('剪贴板用不了，这行可以直接选中复制。', '');
    }
    render();
  }

  function renderPending() {
    if (!snapshot.pendingLine) return null;
    const row = el(document, 'div', { class: 'fhm-pending' },
      el(document, 'span', { class: 'fhm-pending-label', text: '待记一条' }),
      el(document, 'span', { class: 'fhm-pending-text', text: snapshot.pendingLine }),
      el(document, 'button', { type: 'button', text: '记一笔', onclick: () => { void copyPending(); } }),
      el(document, 'span', { class: 'fhm-fine', text: '只复制文本，不会自动记录' }));
    if (view.copyFallback) {
      const box = el(document, 'textarea', { readonly: '', rows: '1', 'aria-label': '待记一条文本' });
      box.value = view.copyFallback;
      row.append(box);
    }
    return row;
  }

  function renderEntry() {
    const nodes = [];
    if (snapshot.resume) {
      const r = snapshot.resume;
      nodes.push(el(document, 'div', { class: 'fhm-draft' },
        el(document, 'p', {
          class: 'fhm-draft-text',
          text: `还留着一趟 · ${r.placeName}（逛了 ${r.visited}/${r.total}）`,
        }),
        el(document, 'button', {
          type: 'button',
          text: '继续',
          disabled: busy,
          onclick: () => { void write('resume', { id: r.id }, '接着逛这趟。'); },
        }),
        el(document, 'span', { class: 'fhm-fine', text: '只接着逛；回不回家由你决定' })));
    }
    if (snapshot.wish) {
      const w = snapshot.wish;
      nodes.push(el(document, 'p', {
        class: 'fhm-wish',
        text: `心愿 · ${w.placeName}${w.target ? ` · ${w.target}` : ''}${w.reason ? `：${w.reason}` : ''}`,
      }));
    }
    return nodes;
  }

  function renderPlan() {
    const plan = el(document, 'textarea', {
      maxlength: '60',
      rows: '1',
      placeholder: '今天想做什么？写一句，比如「想读半小时书」',
      'aria-label': '今天想做什么',
    });
    plan.value = view.planDraft ?? snapshot.room.plan ?? '';
    plan.addEventListener('input', () => { view.planDraft = plan.value; });
    return el(document, 'div', { class: 'fhm-plan' },
      el(document, 'span', { class: 'fhm-plan-label', text: '今天想做什么' }),
      plan,
      el(document, 'button', {
        type: 'button',
        text: '保存',
        disabled: busy,
        onclick: () => {
          void write('setPlan', { plan: plan.value, revision: snapshot.revision }).then((result) => {
            if (result) { view.planDraft = null; render(); }
          });
        },
      }),
      el(document, 'span', { class: 'fhm-fine', text: '只显示你写的，不会自动变成她做过的事' }));
  }

  function render() {
    if (disposed || !snapshot) return;
    const head = el(document, 'header', { class: 'fhm-head' },
      el(document, 'p', { class: 'fhm-kicker', text: '从0开始的肥鱼大冒险 · 回家看看' }),
      el(document, 'h2', { class: 'fhm-title', text: '鱼的家' }),
      el(document, 'p', { class: 'fhm-sub', text: '她此刻在家做什么，换一个姿势，或者看看她在不在外面。' }));
    const feedback = el(document, 'div', {
      class: 'fhm-feedback',
      role: view.tone === 'error' ? 'alert' : 'status',
      'data-tone': view.tone,
      text: snapshot.warning || view.feedback,
    });
    const nodes = [head, feedback, renderStage(), ...renderEntry(), renderChips(), renderActions(), renderPlan(), renderSnapshots(), renderPending()];
    const dress = renderDress();
    if (dress) nodes.push(dress);
    nodes.push(el(document, 'p', { class: 'fhm-foot', text: '出门在「去哪儿」，故事在「出游」。这里只记她在家里的样子。' }));
    section.replaceChildren(style, ...nodes);
    section.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (typeof ticker === 'function') ticker();
    ctx.signal?.removeEventListener('abort', dispose);
  }

  ctx.signal?.addEventListener('abort', dispose, { once: true });
  if (typeof ctx.interval === 'function') {
    const handle = ctx.interval(tick, 60_000);
    if (typeof handle === 'function') ticker = handle;
    else if (handle && typeof handle.dispose === 'function') ticker = () => handle.dispose();
  }

  const ready = refresh();
  return { refresh, dispose, ready };
}
