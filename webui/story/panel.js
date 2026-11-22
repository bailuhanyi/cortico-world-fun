import { createStoryController } from './controller.js';
import { createArtworkStore, RESOURCE_SLOTS } from './resources.js';
import { illustration, icon } from './artwork.js';
import { STYLES } from './styles.js';
import { mountStories } from '../stories.js';
import { storyText } from '../ui-text.js';

function node(tag, attrs, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') element.className = value;
    else if (name === 'text') element.textContent = String(value);
    else if (name === 'disabled' || name === 'checked' || name === 'open') element[name] = Boolean(value);
    else if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  return element;
}
const text = (value, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
const list = (value) => Array.isArray(value) ? value : [];
const badge = (label, warm = false) => node('span', { class: `sw-badge${warm ? ' sw-badge-warm' : ''}` }, label);
const actionRow = (...children) => node('div', { class: 'sw-actions' }, children);
const note = (message) => node('p', { class: 'sw-note' }, message);
const sectionHead = (title, suffix) => node('div', { class: 'sw-section-head' }, node('h3', {}, title), suffix);
function button(label, handler, options = {}) {
  return node('button', { type: 'button', class: `sw-btn ${options.primary ? 'sw-btn-primary ' : ''}${options.quiet ? 'sw-btn-quiet ' : ''}${options.small ? 'sw-btn-small ' : ''}${options.danger ? 'sw-btn-danger ' : ''}${options.block ? 'sw-btn-block ' : ''}`,
    onclick: handler, disabled: options.disabled, 'data-focus': options.key, 'aria-label': options.ariaLabel, 'aria-pressed': options.pressed === undefined ? undefined : String(options.pressed) },
  options.icon ? icon(options.icon) : null, label);
}
const date = (value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed) : '时间未记录';
};
const actor = (value) => value === 'fish' ? '鱼选择' : value === 'owner' ? '你选择' : '选择者未标注';

/**
 * Own-panel renderer. The embedding owner supplies ctx.storyCall; this module does
 * not know another World's RPC URL, filesystem or transport envelope.
 * @returns {{dispose:Function,refresh:Function}}
 */
export function mountPanel(root, ctx) {
  if (!root?.replaceChildren) throw new Error('故事面板缺少有效的 DOM 根。');
  const t = storyText(ctx.language);
  let disposed = false;
  let controller;
  let authorRoot;
  let authorPanel;
  let privateSettings;
  let nodeLimitSettings;
  let imageBusy = false;
  let imageResult;
  const imageOutput = node('div', { class: 'sw-image-result', role: 'status' });
  async function ownCall(method, payload) {
    if (typeof ctx.storyCall === 'function') return ctx.storyCall(method, payload, { signal: ctx.signal, timeoutMs: method === 'storyImage' ? 65000 : 20000 });
    if (typeof ctx.invoke === 'function') return ctx.invoke(method, payload === undefined ? [] : [payload]);
    throw new Error('Story adapter unavailable');
  }
  function authorView() {
    if (!authorRoot) {
      authorRoot = node('div', { class: 'sw-authoring-view' });
      authorPanel = mountStories({ ...ctx, root: authorRoot, invoke: (method, args = []) =>
        ownCall(`author${method[0].toUpperCase()}${method.slice(1)}`, args[0]) });
    }
    return authorRoot;
  }
  // 进作者视图不替用户展开：编辑区默认收起，展开状态由用户上次的选择决定。
  function openAuthor(expand = false) { navigate('author'); if (expand) authorPanel?.expand(); }
  let view = 'home';
  let memoryFilter = 'all';
  let autoPreset = true;
  // 出游页的两种读法：默认对话式（钉住头尾、中间滚），顶栏可切到「沉浸」的一屏一幕。
  let immersive = false;
  let drawerOpen = false;
  let playScroll = { key: '', top: 0, atBottom: true };
  let localNotice = '';
  let localError = '';
  let importing = '';
  const openDetails = new Set();
  const shell = node('section', { class: 'sw', 'aria-label': '故事工坊' });
  const style = node('style', { text: STYLES });
  const top = node('header', { class: 'sw-top' });
  const nav = node('nav', { class: 'sw-tabs', 'aria-label': '故事世界导航' });
  const feedback = node('div', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  const main = node('main', { class: 'sw-main', id: 'story-panel-content' });
  shell.append(style, top, nav, feedback, main, node('footer', { class: 'sw-bottom-note' }, '在熟悉的日常里，留一点位置给新的故事。'));
  root.replaceChildren(shell);
  const artwork = createArtworkStore(ctx, () => render());
  const locationCovers = new Map();
  function locationCover(art) {
    if (!art?.id || !art.cover || typeof ctx.storyCall !== 'function') return null;
    if (!locationCovers.has(art.cover)) {
      if (locationCovers.size >= 8) locationCovers.delete(locationCovers.keys().next().value);
      locationCovers.set(art.cover, Promise.resolve().then(() => ctx.storyCall('locationCover', { id: art.id }))
        .then(({ ok, image }) => ok && image?.cover === art.cover
          && /^data:image\/(?:png|jpe?g|gif|webp);base64,/.test(image.dataUrl) ? image.dataUrl : null)
        .catch(() => null));
    }
    return locationCovers.get(art.cover);
  }

  function navigate(next) { view = next; localNotice = ''; localError = ''; if (next !== 'play') drawerOpen = false; render(); }
  function scene(slot, title, description, options = {}) {
    const home = slot === 'home-day';
    const element = node('div', { class: `sw-scene ${options.class ?? ''}`, 'data-resource-slot': slot });
    element.append(illustration(home ? 'home' : slot === 'creek-letter-ending' ? 'ending' : 'creek'));
    const source = slot ? artwork.get(slot) : null;
    if (source) {
      const image = node('img', { src: source, alt: `${title}的本地插画`, decoding: 'async' });
      image.addEventListener('error', () => {
        image.remove(); artwork.markFailed(slot);
        const marker = element.querySelector('.sw-scene-art-note');
        if (marker) marker.textContent = '图片未能加载 · 文字场景';
      }, { once: true });
      element.append(image);
    }
    const shared = options.preferSlot && source ? null : locationCover(options.location);
    if (shared) void shared.then((dataUrl) => {
      if (!dataUrl || disposed || ctx.signal?.aborted || !shell.contains(element)) return;
      const image = node('img', { src: dataUrl, alt: `${title}的地点封面`, decoding: 'async' });
      const focus = options.location.coverFocus;
      if (Number.isFinite(focus?.x) && Number.isFinite(focus?.y)) image.style.objectPosition = `${focus.x}% ${focus.y}%`;
      image.addEventListener('error', () => image.remove(), { once: true });
      element.append(image);
    });
    element.append(node('span', { class: 'sw-scene-tag' }, options.tag ?? (home ? '此刻 · 在家' : '故事场景')),
      node('span', { class: 'sw-scene-art-note' }, source ? '本地插画' : '文字场景 · 原创示意'),
      node('div', { class: 'sw-scene-label' }, node('h2', {}, title), description ? node('p', {}, description) : null));
    return element;
  }
  function trackedDetails(key, summary, ...content) {
    const element = node('details', { class: 'sw-details', open: openDetails.has(key), 'data-details': key }, summary, content);
    element.addEventListener('toggle', () => { if (element.open) openDetails.add(key); else openDetails.delete(key); });
    return element;
  }
  function conflict(snapshot) {
    return text(snapshot?.conflict);
  }
  function canAct(state) {
    return state.ready && !state.loading && !state.busy && !state.recovering && !state.autoAuthorized && !state.autoRunning;
  }
  async function startStory(story) {
    if (!controller || !canAct(controller.state)) return;
    const wantsAuto = autoPreset;
    await controller.mutate('start', { packId: story.id, revision: story.revision });
    if (disposed || ctx.signal?.aborted) return;
    if (controller.state.snapshot?.trip) {
      view = 'play'; render();
      // Mode is explicitly enabled only after the explicit start succeeds.
      if (wantsAuto && !controller.state.error && controller.state.snapshot.trip.state === 'active') await controller.setMode(true);
    }
  }
  function timeline(items, empty = '还没有发生的片段。') {
    if (!list(items).length) return note(empty);
    return node('ol', { class: 'sw-route' }, list(items).map((item) => node('li', {},
      item.area ? node('small', {}, text(item.area)) : null, node('p', {}, text(item.text)))));
  }
  function choiceRecords(items) {
    return list(items).map((choice) => node('div', { class: 'sw-choice-record' },
      node('strong', {}, text(choice.label, text(choice.option, '已确认选择'))),
      choice.result ? node('p', {}, text(choice.result)) : null,
      node('small', {}, actor(choice.actor)),
      choice.reason ? node('p', { class: 'sw-note' }, `当时的想法：${text(choice.reason)}`) : null));
  }
  function empty(title, message, action) {
    return node('div', { class: 'sw-empty' }, icon('book'), node('strong', {}, title), node('p', {}, message), action ? actionRow(action) : null);
  }

  function storyCard(story, state, compact = false) {
    const snapshot = state.snapshot;
    const playable = story.available;
    const blockedByTrip = Boolean(snapshot.trip) || Boolean(conflict(snapshot));
    const card = node('article', { class: 'sw-card sw-story-card' });
    card.append(scene(null, text(story.placeName, '故事地点'), '', { location: story.locationArt, tag: t.storyEnabled }));
    const info = node('div', { class: 'sw-story-info' },
      node('h3', {}, text(story.title, '未命名故事')), node('p', {}, text(story.description, '从这个地方，开始一段新的经历。')));
    if (!compact && story.placeDescription) info.append(trackedDetails(`place-${story.id}`,
      node('summary', {}, '看看这个地方'), node('p', { class: 'sw-card-note' }, text(story.placeDescription))));
    info.append(node('div', { class: 'sw-story-meta' },
      badge(text(story.placeName, '地点待配置')), story.style ? badge(text(story.style), true) : null,
      story.mode === 'free' ? badge('自由模式', true) : null, badge(t.storyCustom, true)));
    if (story.metadata) info.append(node('p', { class: 'sw-card-note' },
      `作者：${text(story.metadata.author)} · 版本：${text(story.metadata.release)} · 类型：${text(story.metadata.genre)} · ${story.participation === 'duo' ? '双人' : '单人'} · 时长：${story.durationMinutes == null ? '未知' : `${story.durationMinutes} 分钟`}`),
      list(story.metadata.requirements).length ? note(`能力要求：${story.metadata.requirements.join('；')}`) : note('能力要求：无额外要求'));
    else info.append(note('作者与类型未标注 · 单人 · 时长未知'));
    if (story.problem) info.append(note(text(story.problem)));
    const primary = button(blockedByTrip ? t.storyContinue : t.storyStart, () => blockedByTrip ? navigate('play') : startStory(story),
      { icon: 'arrow', primary: true, disabled: blockedByTrip ? !snapshot.trip : !playable || !canAct(state), key: `start-${story.id}` });
    info.append(node('div', { class: 'sw-story-footer' }, node('small', {}, playable ? t.storyProgress : t.storyBlocked), primary));
    card.append(info);
    return card;
  }

  function home(state) {
    const snapshot = state.snapshot;
    const current = snapshot.trip;
    const memories = list(snapshot.memories);
    const left = node('div', { class: 'sw-stack' });
    const hero = node('article', { class: 'sw-card' }, scene('home-day', snapshot.home?.name || '鱼的家', snapshot.home?.desc || (current ? '有一段旅程，还等着继续。' : '门外有新的故事，家里也有安稳的日常。'), { location: snapshot.home, tag: current ? '住所 · 行程未结束' : '此刻 · 在家' }),
      node('div', { class: 'sw-home-caption' }, node('div', {}, node('strong', {}, current ? '上次的故事，还在这里' : '今天，想去哪里走走？'),
        node('p', {}, current ? `${text(current.placeName)} · ${text(current.area, '等待继续')}` : '选一个地方，亲自出发；也可以让鱼自己走一趟。')),
      button(current ? '继续这趟故事' : '看看地点与故事', () => navigate(current ? 'play' : 'stories'), { primary: true, icon: 'arrow', key: 'home-primary' })));
    left.append(hero);
    const firstStory = list(snapshot.catalog)[0];
    left.append(firstStory
      ? node('section', {}, sectionHead(t.storyCatalogTitle), storyCard(firstStory, state, true))
      : empty(t.storyEmptyTitle, t.storyEmptyBody, button(t.storyWrite, () => openAuthor(true), { primary: true, icon: 'book', key: 'home-write' })));
    const right = node('aside', { class: 'sw-stack sw-aside', 'aria-label': '在家小记' });
    right.append(node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-side-title' }, icon('leaf'), '家里的小记'),
      node('div', { class: 'sw-quotation' }, '有些故事不用走很远。沿着溪水，或者坐一会儿，就会遇见。', node('small', {}, '写给下一次出发')),
      node('hr', { class: 'sw-divider' }), node('div', { class: 'sw-stat-row' },
        node('div', {}, node('strong', {}, memories.length), node('span', {}, '趟已留下的回忆')),
        node('div', {}, node('strong', {}, memories.filter((memory) => memory.complete).length), node('span', {}, '趟完整的故事')))));
    const latest = memories[0];
    right.append(node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-side-title' }, icon('book'), '最近的回忆'),
      latest ? node('div', {}, node('h4', {}, text(latest.title, latest.placeName)), node('p', { class: 'sw-card-note' }, text(list(latest.timeline).at(-1)?.text, '这段经历已被妥善收好。')),
        node('p', { class: 'sw-memory-date' }, date(latest.endedAt)), node('hr', { class: 'sw-divider' }), button('翻开回忆', () => navigate('memories'), { small: true, icon: 'arrow', key: 'latest-memory' }))
        : node('div', {}, node('p', { class: 'sw-card-note' }, '第一趟出游结束后，走过的地方、真实发生的事和做过的选择，会留在这里。'))));
    right.append(node('section', { class: 'sw-card sw-card-pad sw-side-secondary' }, node('div', { class: 'sw-side-title' }, icon('clock'), '关于日程与日常'),
      node('p', { class: 'sw-card-note' }, '今天的安排仍在「鱼的每一天」中查看。故事需要你明确出发，不会到了时间自动开始。'),
      note('读书、视频与其他居家活动，继续从对应 World 或会话入口使用。')));
    return node('div', { class: 'sw-grid' }, left, right);
  }

  function stories(state) {
    const snapshot = state.snapshot;
    const all = list(snapshot.catalog);
    const intro = node('div', { class: 'sw-lead' }, node('h2', {}, t.storyCatalogTitle), node('p', {}, t.storyCatalogIntro));
    const preset = node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-mode' },
      node('div', {}, node('strong', {}, '这次，想让鱼自己游玩吗？'), node('small', {}, '默认让鱼自己往下走；出发后你随时可以接管。')),
      node('button', { type: 'button', class: 'sw-switch', role: 'switch', 'aria-label': '出发后开启鱼自己游玩', 'aria-checked': String(autoPreset),
        disabled: !snapshot.autonomy.available || Boolean(snapshot.trip), 'data-focus': 'auto-preset', onclick: () => { autoPreset = !autoPreset; render(); } })),
      note(snapshot.autonomy.available ? '可以随时接管。关闭窗口、切走页面或遇到错误时会暂停。' : text(snapshot.autonomy.reason, '自主游玩暂不可用，手动玩法不受影响。')));
    return node('div', { class: 'sw-stack' }, intro, preset,
      all.length ? node('div', { class: 'sw-story-grid' }, all.map((story) => storyCard(story, state)))
        : empty(t.storyEmptyTitle, t.storyEmptyBody),
      node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-side-title' }, icon('settings'), t.storyWrite),
        node('p', { class: 'sw-card-note' }, t.storyAuthorHint), button(t.storyWrite, () => openAuthor(true), { primary: true, key: 'stories-write' })));
  }

  /**
   * 出游页的入口：默认对话式（A），顶栏「沉浸」切到一屏一幕（B）。
   * 两种读法共用同一套状态、同一个控制器，切的只是排版。
   */
  function play(state) {
    const current = state.snapshot?.trip;
    if (!current) return empty('故事还没有开始', '先选一篇故事，确认后再出发。已结束的行程可以在回忆里翻看。', button('去看看故事', () => navigate('stories'), { primary: true, icon: 'arrow', key: 'empty-play' }));
    if (current.mode === 'free') return immersive ? playFreeImmersive(state, current) : playFree(state, current);
    return immersive ? playImmersive(state, current) : playChat(state, current);
  }

  /** 当前这一步谁在行动、选项能不能点、点了走哪条路——两种排版权衡都只从这里取。 */
  function pendingPicker(state, current, cls) {
    const pending = current.pending;
    const isDraft = current.state === 'draft';
    const manually = canAct(state) && !state.snapshot.autonomy.enabled;
    const ownerTurn = manually && current.actor !== 'fish';
    const canSubstitute = !isDraft && current.step === 'choose' && !state.autoAuthorized && state.snapshot.autonomy.canSubstitute === true;
    const pick = async (option) => {
      if (!canSubstitute) return controller.mutate('choose', { choiceId: pending.id, optionId: option.id });
      const label = text(option.label, option.id);
      const confirmed = ctx.ui?.confirm
        ? await ctx.ui.confirm({ title: `替鱼选「${label}」？`, body: '鱼这一步没法自己决定（额度用完，或者两次都没给出有效选项）。选了会记为「由你替选」，进度照常推进。' })
        : globalThis.confirm?.(`替鱼选「${label}」？会记为「由你替选」。`);
      if (confirmed && !disposed) await controller.substitute(option.id);
    };
    const block = node('div', { class: cls }, list(pending.options).map((option, index) =>
      node('button', { type: 'button', class: 'sw-choice', disabled: !(ownerTurn || canSubstitute) || isDraft || current.step !== 'choose', 'data-focus': `option-${option.id}`,
        onclick: () => { void pick(option); } },
      node('span', { class: 'sw-choice-index', 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')), node('span', {}, text(option.label, option.id)), icon('arrow'))));
    return { block, canSubstitute, ownerTurn, manually, isDraft };
  }

  function optionsHint(state, current, canSubstitute) {
    if (current.state === 'draft') return '先继续行程，再选择下一步。';
    if (state.autoAuthorized) return '鱼正在考虑这些有效选项。你可以随时关闭右侧开关接管。';
    if (canSubstitute) return '鱼这一步没法自己决定：你可以替她选一个，点下去会先问你确认；也可以先收尾，或者点右侧「再来一段」。';
    if (current.pending?.actor === 'joint') return '双方都明确提交才会前进；等待与超时都不算同意。';
    return '选一条你想走的路。点击后会等待保存确认。';
  }

  /** 没有待选项时的那一个主动作（继续 / 往前走 / 回家）。 */
  function advanceButton(state, current, opts = {}) {
    const manually = canAct(state) && !state.snapshot.autonomy.enabled;
    const ownerTurn = manually && current.actor !== 'fish';
    if (current.state === 'draft' || current.step === 'resume') return button('继续这趟行程', () => controller.mutate('resume'), { primary: true, icon: 'arrow', disabled: !manually, key: 'resume', block: opts.block });
    if (current.step === 'move') return button(current.nextArea ? `前往${text(current.nextArea)}` : '向前走一走', () => controller.mutate('move'), { primary: true, icon: 'arrow', disabled: !ownerTurn, key: 'move', block: opts.block });
    if (current.step === 'close') return button('回家，收好这段回忆', () => controller.mutate('close'), { primary: true, icon: 'home', disabled: !manually, key: 'close-complete', block: opts.block });
    return null;
  }

  function closeEarlyButton(state, opts = {}) {
    const manually = canAct(state) && !state.snapshot.autonomy.enabled;
    return button('先回家', async () => {
      const confirmed = ctx.ui?.confirm
        ? await ctx.ui.confirm({ title: '现在先回家吗？', body: '按已经发生的片段结束这一趟。未走到的结局不会记入回忆。' })
        : globalThis.confirm?.('按已经发生的片段结束这一趟？未走到的结局不会记入回忆。');
      if (confirmed && !disposed) await controller.mutate('close');
    }, { quiet: opts.quiet ?? true, small: opts.small, disabled: !manually, key: 'close-early' });
  }

  function autoplaySwitch(state) {
    const checked = state.autoplay === true;
    const busy = state.busy === '正在开启自主游玩' || state.busy === '正在关闭自主游玩';
    const trip = state.snapshot?.trip;
    return node('button', { type: 'button', class: 'sw-switch', role: 'switch', 'aria-label': '鱼自己游玩', 'aria-checked': String(checked),
      disabled: busy || (!checked && (!state.snapshot.autonomy.available || trip?.state === 'draft' || !state.ready || state.loading || state.recovering || Boolean(state.busy))),
      'data-focus': 'trip-mode', onclick: () => controller.setMode(!checked) });
  }

  /** 沉浸模式的「回看」：把整趟发生过的事放进一张覆盖层，不挤占这一屏。 */
  function historyDrawer(state, current) {
    const body = node('div', { class: 'sw-drawer-body' });
    const events = list(current.events);
    const choices = list(current.choices);
    if (events.length) body.append(node('ul', { class: 'sw-event-history' }, events.map((event) => node('li', {}, node('p', { class: 'sw-prose' }, text(event))))));
    else body.append(note('还没有发生的片段。'));
    if (choices.length) body.append(...choiceRecords(choices));
    for (const reference of list(current.references)) body.append(note(reference));
    return node('div', { class: 'sw-drawer', role: 'dialog', 'aria-label': '这一趟的回看' },
      node('div', { class: 'sw-drawer-head' },
        node('div', {}, node('div', { class: 'sw-kicker' }, '这一趟'), node('strong', {}, `回看 · ${events.length} 个片段 · ${choices.length} 次选择`)),
        button('回到此刻', () => { drawerOpen = false; render(); }, { small: true, key: 'imm-drawer-close' })),
      body);
  }

  function immersiveBar(state, current, ...primary) {
    const events = list(current.events);
    return node('div', { class: 'sw-imm-bar' },
      button(`回看 ${events.length}`, () => { drawerOpen = !drawerOpen; render(); }, { small: true, key: 'imm-history', pressed: drawerOpen }),
      node('div', { class: 'sw-imm-bar-mode' }, node('small', {}, '鱼自己游玩'), autoplaySwitch(state)),
      node('div', { class: 'sw-imm-bar-actions' }, ...primary, current.step === 'close' ? null : closeEarlyButton(state, { small: true })));
  }

  function playFree(state, current) {
    const isDraft = current.state === 'draft';
    const free = current.free ?? { turn: 0, maxTurns: 0, log: [], summary: '', facts: {}, flags: {}, counters: {}, ended: null };
    const turnsLeft = Number.isInteger(free.turnsLeft) ? free.turnsLeft : Math.max(0, Number(free.maxTurns) - Number(free.turn));
    // 这一段的回合说完：输入框收起，只留「再来一段」或收尾。
    const capped = !free.ended && turnsLeft === 0;
    const left = node('article', { class: 'sw-card sw-play-main' });
    left.append(node('div', { class: 'sw-play-head' },
      node('div', {}, node('div', { class: 'sw-kicker' }, isDraft ? '等待继续' : '自由模式 · 场景包'),
        node('h2', {}, text(current.title, text(current.placeName, '自由故事')))),
      badge(free.ended ? '已收尾' : capped ? `第 ${text(free.segment, 1)} 段 · 这段说完了` : `第 ${text(free.segment, 1)} 段 · 还剩 ${turnsLeft} 回合`, !free.ended)));
    left.append(node('div', { class: 'sw-play-context' }, `此刻 · ${text(current.areaName, text(current.placeName))}`,
      node('span', { class: 'sw-dot-sep', 'aria-hidden': 'true' }, '·'), `第 ${text(free.turn, 0)} / ${text(free.limit, free.maxTurns)} 回合`));
    left.append(scene(null, text(current.placeName), '', { location: current.locationArt, class: 'sw-play-scene sw-play-strip', tag: '场景包' }));
    const reading = node('div', { class: 'sw-reading', 'data-focus': 'play-reading' });
    if (free.summary) reading.append(note(`到目前为止：${free.summary}`));
    const log = list(free.log);
    if (!log.length) reading.append(node('p', { class: 'sw-prose' }, '开场已经在那里了。说一句想做的事，故事就会往下走。'));
    else {
      const render = (entry) => node('li', {},
        node('small', {}, text(entry.from, '这一回合')),
        entry.say ? node('p', { class: 'sw-free-say' }, `「${text(entry.say)}」`) : null,
        node('p', { class: 'sw-prose' }, text(entry.narration)));
      const earlier = log.slice(0, -6);
      if (earlier.length) reading.append(trackedDetails('free-earlier', node('summary', {}, `更早的 ${earlier.length} 回合`),
        node('ol', { class: 'sw-free-log' }, earlier.map(render))));
      reading.append(node('ol', { class: 'sw-free-log' }, log.slice(-6).map(render)));
    }
    const chips = node('div', { class: 'sw-story-meta' });
    for (const [id, value] of Object.entries(free.facts ?? {})) chips.append(badge(`${id} · ${text(value)}`, true));
    for (const [id, value] of Object.entries(free.flags ?? {})) if (value) chips.append(badge(id, true));
    for (const [id, value] of Object.entries(free.counters ?? {})) chips.append(badge(`${id} ${text(value)}`, true));
    if (chips.childNodes.length) reading.append(node('div', { class: 'sw-free-state' }, node('div', { class: 'sw-kicker' }, '正在起作用的状态'), chips));
    if (list(current.blocked).length || current.blocked) reading.append(node('div', { class: 'sw-notice sw-notice-error' }, icon('info'), node('p', {}, text(current.blocked))));
    left.append(reading);

    const input = node('textarea', { class: 'sw-free-input', rows: '2', placeholder: capped ? '这一段说完了，可以再来一段。' : '这一回合你想做什么？', 'aria-label': '这一回合做什么', disabled: isDraft || Boolean(free.ended) || capped });
    const send = button('说这一句', async () => {
      const say = input.value.trim();
      if (!say || !canAct(state)) return;
      await controller.mutate('say', { say });
    }, { primary: true, key: 'free-say', disabled: !canAct(state) || isDraft || Boolean(free.ended) || capped });
    left.append(node('div', { class: 'sw-play-action sw-free-compose' }, input,
      actionRow(send, free.canContinue ? button(`再来一段 · 还能 ${text(free.segmentsLeft, 0)} 段`, () => controller.continueSegment(),
        { primary: true, icon: 'arrow', key: 'free-segment', disabled: !canAct(state) || state.loading || state.recovering || Boolean(state.busy) }) : null)));
    left.append(node('div', { class: 'sw-play-foot' },
      node('div', { class: 'sw-status', role: 'status' }, icon(state.busy ? 'clock' : 'check'), state.busy || '实际进度已同步'),
      actionRow(free.ended ? button('收起这一段', () => controller.mutate('close'), { primary: true, icon: 'home', disabled: !canAct(state), key: 'free-close' }) : null,
        !free.ended ? button('先收起', () => controller.mutate('close'), { quiet: true, disabled: !canAct(state), key: 'free-close-early' }) : null,
        Number(free.turn) > 0 ? button('退回上一回合', async () => {
          const question = '退回上一回合？这一回合发生的事会撤回，已经花掉的模型调用不退。';
          const confirmed = ctx.ui?.confirm ? await ctx.ui.confirm({ title: '退回上一回合？', body: question }) : globalThis.confirm?.(question);
          if (confirmed && !disposed) await controller.mutate('rewind');
        }, { quiet: true, disabled: !canAct(state), key: 'free-rewind' }) : null)));
    const right = node('aside', { class: 'sw-stack sw-aside', 'aria-label': '自由模式说明' });
    right.append(node('section', { class: 'sw-card sw-card-pad' },
      node('div', { class: 'sw-side-title' }, icon('book'), '这一段怎么走'),
      note('作者只定下大方向和不能改的事实；每一回合怎么演，交给主持。你随时可以停。'),
      free.ended ? note('这一段已经收尾：收起后会按实际发生的内容存进回忆。')
        : capped ? note(`这一段的 ${free.maxTurns} 回合说完了。可以「再来一段」接着走（这一趟最多三段，已经走到第 ${text(free.segment, 1)} 段），也可以收起进回忆。`)
          : note(`这一段的第 ${text(free.segment, 1)} 段，还剩 ${turnsLeft} 回合。`)));
    if (list(current.ends).length) right.append(node('section', { class: 'sw-card sw-card-pad sw-side-secondary' },
      node('div', { class: 'sw-side-title' }, icon('pin'), '可能的收尾'),
      node('ul', { class: 'sw-route' }, list(current.ends).map((end) => node('li', {}, node('p', {}, text(end.text)))))));
    right.append(node('section', { class: 'sw-card sw-card-pad sw-side-secondary' },
      node('div', { class: 'sw-side-title' }, icon('clock'), '和选项式故事的区别'),
      node('p', { class: 'sw-card-note' }, '选项式故事由作者写好分支，你从选项里挑；自由模式只写设定与收尾条件，每一步由你用自己的话说。')));
    return node('div', { class: 'sw-grid sw-play' }, left, right);
  }

  function playChat(state) {
    const snapshot = state.snapshot;
    const current = snapshot.trip;
    const isDraft = current.state === 'draft';
    const pending = current.pending;
    const manually = canAct(state) && !snapshot.autonomy.enabled;
    const ownerTurn = manually && current.actor !== 'fish';
    const left = node('article', { class: 'sw-card sw-play-main' });
    left.append(node('div', { class: 'sw-play-head' }, node('div', {}, node('div', { class: 'sw-kicker' }, isDraft ? '等待继续' : '当前行程'),
      node('h2', {}, text(current.title, text(current.placeName, '正在出游')))), badge(isDraft ? '等待继续' : current.step === 'blocked' ? '暂时受阻' : state.autoAuthorized ? '鱼自己游玩中' : '由你亲自选择', isDraft || current.step === 'blocked')));
    const events = list(current.events);
    const choices = list(current.choices);
    left.append(node('div', { class: 'sw-play-context' }, `此刻 · ${text(current.area, current.placeName)}`,
      node('span', { class: 'sw-dot-sep', 'aria-hidden': 'true' }, '·'), `${events.length} 个片段 · ${choices.length} 次选择`));
    left.append(scene(null, text(current.area, current.placeName), '', { location: current.locationArt, class: 'sw-play-scene sw-play-strip', tag: text(current.placeName, '当前地点') }));
    const reading = node('div', { class: 'sw-reading', 'data-focus': 'play-reading' });
    reading.append(node('div', { class: 'sw-kicker' }, '已经发生的片段'));
    // 选择记录整体折起来：聊天区只滚「发生了什么」，最新一条事件才是底部。
    if (choices.length) reading.append(trackedDetails('play-choices', node('summary', {}, `这趟的 ${choices.length} 次选择`), ...choiceRecords(choices)));
    if (events.length) {
      // 只展开最近三条；更早的收成一行，长故事也不会把当前这一步顶走。
      const earlier = events.slice(0, -3);
      if (earlier.length) reading.append(trackedDetails('play-earlier', node('summary', {}, `更早的 ${earlier.length} 条片段`),
        node('ul', { class: 'sw-event-history' }, earlier.map((event) => node('li', {}, node('p', { class: 'sw-prose' }, text(event)))))));
      reading.append(node('ul', { class: 'sw-event-history' }, events.slice(-3).map((event) => node('li', {}, node('p', { class: 'sw-prose' }, text(event))))));
    } else reading.append(node('p', { class: 'sw-prose' }, current.step === 'move' ? '路就在眼前。走近一点，看看会遇见什么。' : '这一趟的故事，将随着真实的行动在这里展开。'));
    if (current.actor) reading.append(note(`当前行动者：${current.actor === 'fish' ? '鱼' : '你'}${pending?.actor === 'joint' ? ` · 共同决定：${pending.jointResolution === 'require-agreement' ? '双方必须明确同意；分歧保持待定' : pending.jointResolution === 'owner-final' ? '分歧按你的明确选择' : '分歧按鱼的明确选择'}` : ''}。等待不会当作同意。`));
    for (const reference of list(current.references)) reading.append(note(reference));
    if (current.blocked) reading.append(node('div', { class: 'sw-notice sw-notice-error' }, icon('info'), node('p', {}, text(current.blocked, '当前无法推进，请核对场所与故事条件。'))));
    if (current.complete) reading.append(node('div', { class: 'sw-reason' }, '这一段故事已经走到结尾。确认回家后，会按实际发生的内容收进回忆。'));
    left.append(reading);
    // 当前这一步钉在底部：选项就在手边，不用先滚到底。
    const action = node('div', { class: 'sw-play-action', 'aria-label': '当前这一步' });
    if (pending) {
      const { block, canSubstitute } = pendingPicker(state, current, 'sw-choices');
      action.append(node('div', { class: 'sw-kicker' }, '现在轮到你了'));
      if (pending.prompt) action.append(node('p', { class: 'sw-prose' }, text(pending.prompt)));
      action.append(block, note(optionsHint(state, current, canSubstitute)));
    } else {
      const advance = advanceButton(state, current, { block: true });
      action.append(node('div', { class: 'sw-kicker' }, isDraft || current.step === 'resume' ? '下一步' : current.step === 'close' ? '收尾' : '下一处'));
      if (advance) action.append(advance);
      if (current.step === 'blocked' && !current.blocked) action.append(note('这一步暂时没有可用的动作。'));
    }
    left.append(action);
    left.append(node('div', { class: 'sw-play-foot' },
      node('div', { class: 'sw-status', role: 'status' }, icon(state.busy ? 'clock' : 'check'), state.busy || (state.autoAuthorized ? '正在逐步继续这趟旅程' : '实际进度已同步')),
      actionRow(current.step !== 'close' ? closeEarlyButton(state, { quiet: true }) : null)));
    const right = node('aside', { class: 'sw-stack sw-aside', 'aria-label': '行程控制' });
    const modeCard = node('section', { class: 'sw-card sw-card-pad' });
    const checked = state.autoplay === true;
    const running = state.autoAuthorized === true;
    const stopped = Boolean(snapshot.autonomy.stop);
    const modeSubtitle = stopped
      ? (snapshot.autonomy.canContinue ? '这一段走完了，可以再来一段' : '这一段走完了，等你收尾')
      : running ? '这一趟，由鱼自己决定'
        : checked ? (current.actor === 'owner' ? '轮到你选择；选完鱼会接着走' : '鱼会接着往下走')
          : '下一步，等你来选择';
    modeCard.append(node('div', { class: 'sw-mode' }, node('div', {}, node('strong', {}, '鱼自己游玩'), node('small', {}, modeSubtitle)),
      autoplaySwitch(state)));
    modeCard.append(note(checked
      ? '这是一次持久偏好：轮到你时会暂停，你选完鱼会接着走；切走页面只暂停当下。关掉开关即可接管。'
      : '打开后鱼会自己往下走；轮到你时暂停，随时可以接管。'));
    if (snapshot.autonomy.reason && snapshot.autonomy.available) modeCard.append(note(snapshot.autonomy.reason));
    if (snapshot.autonomy.remaining !== undefined) modeCard.append(node('div', { class: 'sw-budget' }, node('span', {}, '本趟剩余预算'), node('b', {}, `${text(snapshot.autonomy.remaining)} 步${Number.isInteger(snapshot.autonomy.remainingCalls) ? ` · ${snapshot.autonomy.remainingCalls} 次决定` : ''}${Number.isInteger(snapshot.autonomy.segment) ? ` · 第 ${snapshot.autonomy.segment} 段` : ''}`)));
    if (snapshot.autonomy.canContinue) {
      modeCard.append(button(`再来一段（鱼自己玩）· 还能 ${snapshot.autonomy.segmentsLeft} 段`, () => controller.continueSegment(),
        { small: true, primary: true, key: 'segment', disabled: !snapshot.autonomy.available || !canAct(state) || state.loading || state.recovering || Boolean(state.busy) }));
      modeCard.append(note('再来一段会把这一段的步数和决定次数都归零，已经发生的事和回忆不动；一趟最多三段，要你亲手点。'));
    }
    if (state.reason) modeCard.append(node('div', { class: 'sw-reason' }, node('div', { class: 'sw-kicker' }, '鱼此刻的想法'), node('p', {}, state.reason)));
    right.append(modeCard);
    const dm = snapshot.dm;
    if (dm) {
      const dmCard = node('section', { class: 'sw-card sw-card-pad' },
        node('div', { class: 'sw-side-title' }, icon('book'), '可选文本主持'),
        note(dm.message), note('主持文字是待确认的提议。鱼的偏好与用户选择各自提交；自由聊天不改变进度。'));
      if (dm.enabled) {
        dmCard.append(node('div', { class: 'sw-budget' }, node('span', {}, '本趟主持额度'), node('b', {}, `${dm.remainingCalls} 次剩余`)),
          note(`已发起 ${dm.budget?.calls ?? 0} 次 · 已报告 ${dm.budget?.totalTokens ?? 0} token · ${dm.budget?.unknownUsageCalls ?? 0} 次用量未知`),
          actionRow(button(state.dmBusy ? '主持正在提议…' : '请主持提议', () => controller.proposeDM(),
            { small: true, disabled: !canAct(state) || !dm.available || isDraft || current.step !== 'choose' || state.dmBusy || snapshot.autonomy.enabled || dm.remainingCalls <= 0, key: 'dm-propose' }),
          state.dmBusy || dm.pending || dm.proposal ? button('取消主持提议', () => controller.cancelDM(), { small: true, quiet: true, key: 'dm-cancel' }) : null));
        if (dm.proposal) {
          const label = pending?.options.find((option) => option.id === dm.proposal.optionId)?.label ?? dm.proposal.optionId;
          dmCard.append(node('div', { class: 'sw-reason' }, node('div', { class: 'sw-kicker' }, '主持提议 · 尚未发生'),
            node('p', {}, dm.proposal.narration), node('p', {}, `建议选项：${label}`)),
            button('明确采用这个选项', () => controller.applyDM(), { small: true, primary: true, disabled: !ownerTurn || isDraft || state.dmBusy || current.step !== 'choose', key: 'dm-apply' }));
        }
      }
      right.append(dmCard);
    }
    right.append(node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-side-title' }, icon('pin'), '这一趟的足迹'), timeline(current.timeline),
      note('这里只记录已经发生的片段。')));
    return node('div', { class: 'sw-grid sw-play' }, left, right);
  }

  /** 沉浸模式：一屏只有这一幕——大图、这一回合的正文、这一步的选项；历史收进「回看」。 */
  function playImmersive(state, current) {
    const isDraft = current.state === 'draft';
    const pending = current.pending;
    const events = list(current.events);
    const wrap = node('div', { class: 'sw-imm' });
    wrap.append(scene(null, text(current.area, current.placeName), '', { location: current.locationArt, class: 'sw-imm-scene', tag: text(current.placeName, '当前地点') }));
    wrap.append(node('div', { class: 'sw-imm-body' },
      node('div', { class: 'sw-kicker' }, isDraft ? '等待继续' : `此刻 · ${text(current.area, current.placeName)}`),
      node('p', { class: 'sw-imm-lead' }, text(events.at(-1), current.step === 'move' ? '路就在眼前。走近一点，看看会遇见什么。' : '这一趟的故事，将随着真实的行动在这里展开。')),
      pending?.prompt ? node('p', { class: 'sw-imm-ask' }, text(pending.prompt)) : null,
      current.actor === 'joint' || pending?.actor === 'joint'
        ? note('共同决定：双方都明确提交后才会前进；等待与超时都不算同意。') : null));
    if (pending) {
      const { block, canSubstitute } = pendingPicker(state, current, 'sw-imm-choices');
      wrap.append(block, note(optionsHint(state, current, canSubstitute)));
    } else {
      const advance = advanceButton(state, current, { block: true });
      if (advance) wrap.append(node('div', { class: 'sw-imm-solo' }, advance));
    }
    wrap.append(immersiveBar(state, current));
    if (drawerOpen) wrap.append(historyDrawer(state, current));
    return wrap;
  }

  function playFreeImmersive(state, current) {
    const free = current.free ?? { turn: 0, maxTurns: 0, log: [], summary: '', ended: null };
    const turnsLeft = Number.isInteger(free.turnsLeft) ? free.turnsLeft : Math.max(0, Number(free.maxTurns) - Number(free.turn));
    const capped = !free.ended && turnsLeft === 0;
    const isDraft = current.state === 'draft';
    const log = list(free.log);
    const last = log.at(-1);
    const wrap = node('div', { class: 'sw-imm' });
    wrap.append(scene(null, text(current.placeName), '', { location: current.locationArt, class: 'sw-imm-scene', tag: '场景包' }));
    wrap.append(node('div', { class: 'sw-imm-body' },
      node('div', { class: 'sw-kicker' }, free.ended ? '已收尾' : `第 ${text(free.segment, 1)} 段 · 还剩 ${turnsLeft} 回合`),
      node('p', { class: 'sw-imm-lead' }, text(last?.narration, '开场已经在那里了。说一句想做的事，故事就会往下走。')),
      last?.say ? node('p', { class: 'sw-imm-ask' }, `你刚才说：「${text(last.say)}」`) : null,
      free.summary ? note(`到目前为止：${free.summary}`) : null));
    const input = node('textarea', { class: 'sw-free-input', rows: '2', placeholder: capped ? '这一段说完了，可以再来一段。' : '这一回合你想做什么？', 'aria-label': '这一回合做什么', disabled: isDraft || Boolean(free.ended) || capped });
    const send = button('说这一句', async () => {
      const say = input.value.trim();
      if (!say || !canAct(state)) return;
      await controller.mutate('say', { say });
    }, { primary: true, key: 'free-say', disabled: !canAct(state) || isDraft || Boolean(free.ended) || capped });
    wrap.append(node('div', { class: 'sw-imm-compose' }, input,
      actionRow(send, free.canContinue ? button(`再来一段 · 还能 ${text(free.segmentsLeft, 0)} 段`, () => controller.continueSegment(),
        { primary: true, icon: 'arrow', key: 'free-segment', disabled: !canAct(state) || state.loading || state.recovering || Boolean(state.busy) }) : null)));
    wrap.append(node('div', { class: 'sw-imm-bar' },
      button(`回看 ${log.length}`, () => { drawerOpen = !drawerOpen; render(); }, { small: true, key: 'imm-history', pressed: drawerOpen }),
      node('div', { class: 'sw-imm-bar-actions' },
        free.ended ? button('收起这一段', () => controller.mutate('close'), { primary: true, icon: 'home', disabled: !canAct(state), key: 'free-close' })
          : button('先收起', () => controller.mutate('close'), { small: true, quiet: true, disabled: !canAct(state), key: 'free-close-early' }))));
    if (drawerOpen) {
      const body = node('div', { class: 'sw-drawer-body' });
      if (log.length) body.append(node('ol', { class: 'sw-free-log' }, log.map((entry) => node('li', {},
        node('small', {}, text(entry.from, '这一回合')),
        entry.say ? node('p', { class: 'sw-free-say' }, `「${text(entry.say)}」`) : null,
        node('p', { class: 'sw-prose' }, text(entry.narration))))));
      else body.append(note('还没有发生的回合。'));
      wrap.append(node('div', { class: 'sw-drawer', role: 'dialog', 'aria-label': '这一段的回看' },
        node('div', { class: 'sw-drawer-head' }, node('div', {}, node('div', { class: 'sw-kicker' }, '这一段'), node('strong', {}, `回看 · ${log.length} 回合`)),
          button('回到此刻', () => { drawerOpen = false; render(); }, { small: true, key: 'imm-drawer-close' })),
        body));
    }
    return wrap;
  }

  async function askConfirm(title, body) {
    if (ctx.ui?.confirm) return Boolean(await ctx.ui.confirm({ title, body }));
    if (typeof globalThis.confirm === 'function') return Boolean(globalThis.confirm(body));
    return true;
  }
  async function removeMemory(memory) {
    if (!(await askConfirm('移到回收站？', `把《${text(memory.title, '这条回忆')}》移到回收站？这趟行程会从回忆和纪念册里消失，可以在回收站恢复。`))) return;
    try {
      await ownCall('deleteMemory', { memoryId: memory.id });
      localNotice = '已移到回收站，可以在那里恢复。'; localError = '';
      await controller.refresh();
    } catch (error) { localError = error?.message ?? '删除失败，请重试。'; localNotice = ''; render(); }
  }
  async function restoreTrash(entry) {
    try {
      await ownCall('restoreMemory', { trashId: entry.id });
      localNotice = '这条回忆已经放回纪念册。'; localError = '';
      await controller.refresh();
    } catch (error) { localError = error?.message ?? '恢复失败，请重试。'; localNotice = ''; render(); }
  }
  async function purgeTrash(entry) {
    if (!(await askConfirm('彻底删除？', `《${text(entry.title, '这条回忆')}》会从回收站里彻底删掉，不能恢复。`))) return;
    try {
      await ownCall('purgeMemory', { trashId: entry.id });
      localNotice = '已彻底删除。'; localError = '';
      await controller.refresh();
    } catch (error) { localError = error?.message ?? '删除失败，请重试。'; localNotice = ''; render(); }
  }
  async function emptyTrash() {
    if (!(await askConfirm('清空回收站？', '回收站里的回忆会全部彻底删除，不能恢复。'))) return;
    try {
      await ownCall('emptyTrash');
      localNotice = '回收站已清空。'; localError = '';
      await controller.refresh();
    } catch (error) { localError = error?.message ?? '清空失败，请重试。'; localNotice = ''; render(); }
  }
  function trashSection(trash) {
    const rows = trash.length ? trash.map((entry) => node('div', { class: 'sw-trash-row' },
      node('div', { class: 'sw-trash-meta' }, node('strong', {}, text(entry.title, '一条回忆')),
        node('small', {}, `${text(entry.placeName)} · 删除于 ${date(entry.deletedAt)}`),
        entry.complete ? badge('当时已完结') : null),
      actionRow(button('恢复', () => void restoreTrash(entry), { small: true, key: `restore-${entry.id}` }),
        button('彻底删除', () => void purgeTrash(entry), { small: true, quiet: true, danger: true, key: `purge-${entry.id}` }))))
      : [note('回收站是空的。')];
    return node('details', { class: 'sw-details sw-trash' },
      node('summary', {}, `回收站（${trash.length}）`),
      node('div', { class: 'sw-card sw-card-pad sw-trash-body' }, node('p', { class: 'sw-card-note' }, '删掉的回忆先放这里；可以恢复，也可以彻底删除。纪念品架是独立账本，不跟着这一趟消失。'),
        node('div', { class: 'sw-trash-list' }, rows),
        trash.length ? actionRow(button('清空回收站', () => void emptyTrash(), { small: true, quiet: true, danger: true, key: 'empty-trash' })) : null));
  }

  function memories(state) {
    const items = list(state.snapshot.memories);
    const trash = list(state.snapshot.trash);
    const filtered = items.filter((item) => memoryFilter === 'all' || (memoryFilter === 'complete' ? item.complete : !item.complete));
    const fragment = node('div', {}, node('div', { class: 'sw-lead' }, node('h2', {}, '走过的路，都有回声'), node('p', {}, '只收录真实发生的片段。每次出发，都会留下自己的一页。')),
      node('div', { class: 'sw-filter', 'aria-label': '筛选回忆' }, [['all', `全部 ${items.length}`], ['complete', '完整故事'], ['partial', '中途回家']].map(([id, title]) =>
        node('button', { type: 'button', class: 'sw-btn', 'aria-pressed': String(memoryFilter === id), 'data-focus': `filter-${id}`, onclick: () => { memoryFilter = id; render(); } }, title))));
    if (!filtered.length) {
      fragment.append(empty(items.length ? '这里暂时没有这样的回忆' : '纪念册的第一页，留给下一次出发', items.length ? '换一个筛选条件看看。' : '完成一趟短短的旅程，或中途回家，已经发生的片段都会留在这里。', button('看看故事', () => navigate('stories'), { icon: 'arrow', primary: true, key: 'memories-start' })));
      fragment.append(trashSection(trash));
      return fragment;
    }
    fragment.append(node('div', { class: 'sw-memory-grid' }, filtered.map((memory) => {
      const details = trackedDetails(`memory-${memory.id}`, node('summary', {}, icon('chevron'), '翻开这一页'), timeline(memory.timeline, '这趟没有记录到事件片段。'), choiceRecords(memory.choices));
      details.classList.add('sw-memory-details');
      const actions = [];
      if (memory.summary) actions.push(button('复制事实摘要', async () => {
        try {
          const clipboard = root.ownerDocument?.defaultView?.navigator?.clipboard;
          if (!clipboard?.writeText) throw new Error('剪贴板不可用');
          await clipboard.writeText(memory.summary); localNotice = '已复制事实摘要；没有写入日程或长期记忆。'; localError = ''; render();
        } catch { localNotice = '复制不可用。事实摘要可从下方文本中手动复制；没有写入日程或长期记忆。'; localError = ''; render(); }
      }, { small: true, key: `copy-recap-${memory.id}` }));
      const forkable = (memory.checkpoints ?? []).filter((checkpoint) => checkpoint.resumable === true);
      if (forkable.length && !state.snapshot.trip) actions.push(button('从最近可继续检查点开分支', () => {
        const checkpoint = forkable.at(-1);
        if (checkpoint) void controller.fork(memory.id, checkpoint.id);
      }, { small: true, key: `fork-${memory.id}` }));
      actions.push(button('移到回收站', () => void removeMemory(memory), { small: true, quiet: true, danger: true, key: `delete-${memory.id}` }));
      return node('article', { class: 'sw-card sw-memory' }, node('div', { class: 'sw-card-pad' }, badge(memory.complete ? '故事完成' : '中途回家', !memory.complete),
        node('h3', {}, text(memory.title, '这一趟的回忆')), node('div', { class: 'sw-memory-place' }, text(memory.placeName)),
        node('p', { class: 'sw-memory-preview' }, text(memory.summary, list(memory.timeline).at(-1)?.text ?? '按实际发生的经历收好，未发生的结局不会补写。')),
        memory.sourceRunId ? note(`分支来源 runId：${memory.sourceRunId} · ${memory.canonical ? '正史' : '隔离分支'}`) : null,
        node('div', { class: 'sw-memory-date' }, date(memory.endedAt)), actionRow(...actions), details));
    })));
    fragment.append(trashSection(trash));
    return fragment;
  }

  function buildNodeLimitSettings() {
    const model = { value: 16, loaded: false, busy: false };
    const input = node('input', { type: 'number', min: '0', max: String(Number.MAX_SAFE_INTEGER), step: '1', inputmode: 'numeric',
      'data-focus': 'story-node-limit', 'aria-label': t.storyNodeLimitField });
    input.value = '16';
    const status = node('p', { class: 'sw-note', role: 'status', 'aria-live': 'polite' });
    const error = node('p', { class: 'sw-settings-error', role: 'alert' });
    const save = button(t.storyNodeLimitSave, async () => {
      if (model.busy) return;
      if (!input.value.trim() || !Number.isSafeInteger(Number(input.value)) || Number(input.value) < 0) {
        error.textContent = t.storyNodeLimitInvalid; return;
      }
      model.busy = true; error.textContent = ''; status.textContent = t.storyNodeLimitSaving; paint();
      try {
        const result = await ownCall('saveStoryNodeLimit', { nodeLimit: Number(input.value) });
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok || !Number.isSafeInteger(result.nodeLimit)) throw new Error();
        model.value = result.nodeLimit; input.value = String(model.value); status.textContent = t.storyNodeLimitSaved;
      } catch { if (!disposed) { error.textContent = t.storyNodeLimitSaveFailed; status.textContent = ''; } }
      finally { model.busy = false; if (!disposed) paint(); }
    }, { primary: true, key: 'story-node-limit-save' });
    const restore = button(t.storyNodeLimitDefault, () => {
      input.value = '16'; error.textContent = ''; status.textContent = ''; paint();
    }, { quiet: true, key: 'story-node-limit-default' });
    input.addEventListener('input', () => { error.textContent = ''; status.textContent = ''; paint(); });
    function paint() {
      input.disabled = model.busy || !model.loaded;
      save.disabled = model.busy || !model.loaded || input.value === String(model.value);
      restore.disabled = model.busy || !model.loaded || input.value === '16';
    }
    async function load() {
      if (model.busy || model.loaded) return;
      model.busy = true; status.textContent = t.storyNodeLimitLoading; paint();
      try {
        const result = await ownCall('storySettings');
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok || !Number.isSafeInteger(result.nodeLimit) || result.nodeLimit < 0) throw new Error();
        model.value = result.nodeLimit; input.value = String(model.value); model.loaded = true; status.textContent = '';
      } catch { if (!disposed) { error.textContent = t.storyNodeLimitLoadFailed; status.textContent = ''; } }
      finally { model.busy = false; if (!disposed) paint(); }
    }
    const container = node('section', { class: 'sw-card sw-card-pad sw-node-limit-settings' },
      node('div', { class: 'sw-settings-card-title' }, icon('settings'), node('div', {}, node('h3', {}, t.storyNodeLimitTitle), node('p', { class: 'sw-card-summary' }, t.storyNodeLimitSummary))),
      node('label', { class: 'sw-setting-field' }, t.storyNodeLimitField, input),
      actionRow(save, restore), status, error);
    paint();
    return { node: container, load };
  }

  function buildPrivateSettings() {
    const mask = '••••••••';
    const model = { saved: false, supported: true, loaded: false, busy: '', imageSource: '', imageTouched: false, imagesEnabled: false, revision: 0,
      modelName: '', savedModel: '', modelTouched: false, modelRevision: 0,
      apiUrl: { value: '', touched: false, revision: 0 }, apiKey: { value: '', touched: false, revision: 0 } };
    const status = node('p', { class: 'sw-note', role: 'status', 'aria-live': 'polite' });
    const error = node('p', { class: 'sw-settings-error', role: 'alert' });
    const support = note('');
    const saved = node('span', { class: 'sw-badge', 'data-settings-saved': '' });
    const imageBadge = node('span', { class: 'sw-badge sw-settings-state', 'data-settings-image-state': '' });
    const fields = {};
    const privateField = (key, title) => {
      const input = node('input', { type: 'password', autocomplete: 'new-password', spellcheck: 'false',
        'data-focus': `settings-${key}`, 'aria-label': title, 'data-private-setting': key });
      const repaint = () => { input.value = model[key].value || model.saved ? mask : ''; };
      input.addEventListener('input', () => {
        model[key].value = input.value; model[key].touched = true; ++model[key].revision; ++model.revision; paint();
      });
      // Never reveal a previous value when refocusing a masked input.
      input.addEventListener('focus', () => { if (input.value === mask) input.value = ''; });
      input.addEventListener('blur', repaint);
      fields[key] = { input, repaint };
      return node('label', { class: 'sw-setting-field' }, title, input);
    };
    const url = privateField('apiUrl', t.storyDmApiUrl);
    const key = privateField('apiKey', t.storyDmApiKey);
    const modelInput = node('input', { type: 'text', maxlength: '200', autocomplete: 'off', spellcheck: 'false',
      'data-focus': 'settings-model', 'aria-label': t.storyDmModel, placeholder: t.storyDmModelHint });
    modelInput.addEventListener('input', () => {
      model.modelName = modelInput.value; model.modelTouched = true; ++model.modelRevision; ++model.revision; paint();
    });
    const source = node('input', { type: 'text', maxlength: '300', 'data-focus': 'settings-imageSource', 'aria-label': t.storyImageSource, autocomplete: 'off' });
    source.addEventListener('input', () => { model.imageSource = source.value; model.imageTouched = true; ++model.revision; paint(); });
    const save = button(t.settingsSave, async () => {
      if (model.busy) return;
      const args = { imageSource: model.imageSource.trim() };
      const credentialsTouched = model.apiUrl.touched || model.apiKey.touched;
      if (model.modelTouched && (model.modelName.length > 200 || /[\u0000-\u001f\u007f]/u.test(model.modelName))) { error.textContent = t.storyDmModelInvalid; return; }
      if (model.modelTouched && !model.saved && !credentialsTouched) { error.textContent = t.storyDmModelNeedsApi; return; }
      if (model.supported && (credentialsTouched || model.modelTouched)) {
        args.model = model.modelName.trim();
      }
      if (model.supported && credentialsTouched) {
        args.apiUrl = model.apiUrl.value.trim(); args.apiKey = model.apiKey.value.trim();
        try {
          if (Boolean(args.apiUrl) !== Boolean(args.apiKey)) throw new Error();
          if (args.apiUrl) {
            const parsed = new URL(args.apiUrl);
            if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
          }
        } catch { error.textContent = t.storyDmApiInvalid; return; }
      }
      if (!validImageSource(args.imageSource)) { error.textContent = t.storyImageInvalid; return; }
      const revision = model.revision;
      const modelRevision = model.modelRevision;
      const privateRevisions = { apiUrl: model.apiUrl.revision, apiKey: model.apiKey.revision };
      model.busy = 'save'; status.textContent = t.settingsSaving; error.textContent = ''; paint();
      for (const field of Object.values(fields)) field.repaint();
      try {
        const result = await ownCall('saveStorySettings', args);
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok) {
          if (result) applySafeView(result);
          if (result?.partial !== 'dm') throw new Error();
          if (model.modelRevision === modelRevision) {
            model.modelTouched = false;
            if (Object.hasOwn(args, 'model')) model.savedModel = model.modelName = modelInput.value = args.model;
          }
          for (const name of ['apiUrl', 'apiKey']) if (model[name].revision === privateRevisions[name]) {
            model[name].value = ''; model[name].touched = false; fields[name].repaint();
          }
          error.textContent = t.settingsPartialDm;
          return;
        }
        if (model.modelRevision === modelRevision) {
          model.modelTouched = false;
          if (Object.hasOwn(args, 'model')) model.savedModel = model.modelName = modelInput.value = args.model;
        }
        applySafeView(result);
        // Remove submitted plaintext even if an unrelated source field changed.
        // A newer private input remains a masked, unsaved draft.
        for (const name of ['apiUrl', 'apiKey']) if (model[name].revision === privateRevisions[name]) {
          model[name].value = ''; model[name].touched = false; fields[name].repaint();
        }
        if (revision === model.revision || model.imageSource.trim() === args.imageSource) {
          model.imageTouched = false;
          source.value = model.imageSource = savedImageSource;
        }
        status.textContent = t.settingsSaved;
      } catch { if (!disposed) error.textContent = t.settingsFailure; }
      finally { if (!disposed) { model.busy = ''; paint(); for (const field of Object.values(fields)) field.repaint(); } }
    }, { primary: true, key: 'settings-save' });
    const cancel = button(t.settingsCancel, () => {
      clearPrivate(); model.modelName = model.savedModel; modelInput.value = model.savedModel;
      model.imageTouched = false; source.value = model.imageSource = savedImageSource;
      ++model.revision; error.textContent = ''; status.textContent = t.settingsCancelled; paint();
    }, { quiet: true, key: 'settings-cancel' });
    const clear = button(t.storyDmApiClear, async () => {
      if (model.busy) return;
      clearPrivate(); ++model.revision; model.busy = 'clear'; error.textContent = ''; status.textContent = t.settingsClearing; paint();
      try {
        const result = await ownCall('clearStoryKey');
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok) throw new Error();
        applySafeView(result); model.saved = false; clearPrivate(); status.textContent = t.settingsCleared;
      } catch { if (!disposed) error.textContent = t.settingsClearFailure; }
      finally { if (!disposed) { model.busy = ''; paint(); for (const field of Object.values(fields)) field.repaint(); } }
    }, { danger: true, key: 'settings-clear' });
    const reload = button(t.settingsReload, () => void load(), { quiet: true, key: 'settings-reload' });
    let savedImageSource = '';
    function applySafeView(result) {
      // Deliberately read only public status, never credential values from a response.
      if (typeof result.dm?.saved === 'boolean') model.saved = result.dm.saved;
      if (typeof result.dm?.supported === 'boolean') model.supported = result.dm.supported;
      if (typeof result.imageSource === 'string') {
        savedImageSource = result.imageSource;
        if (!model.imageTouched) source.value = model.imageSource = savedImageSource;
      }
      if (typeof result.dm?.model === 'string') {
        model.savedModel = result.dm.model;
        if (!model.modelTouched) modelInput.value = model.modelName = model.savedModel;
      }
      if (typeof result.imagesEnabled === 'boolean') setImageEnabled(result.imagesEnabled);
    }
    function clearPrivate() {
      for (const name of ['apiUrl', 'apiKey']) { model[name].value = ''; model[name].touched = false; fields[name].repaint(); }
      model.modelName = ''; model.modelTouched = false; modelInput.value = '';
    }
    function paint() {
      const dirty = model.apiUrl.touched || model.apiKey.touched || model.imageTouched || model.modelTouched;
      saved.textContent = dirty ? t.storyDmApiPending : model.saved ? t.storyDmApiSaved : t.storyDmApiUnset;
      support.textContent = model.supported ? '' : t.storyDmApiUnsupported;
      save.disabled = Boolean(model.busy) || !model.loaded || !dirty;
      clear.disabled = Boolean(model.busy) || !model.loaded || !model.saved;
      cancel.disabled = Boolean(model.busy) || !dirty;
      reload.disabled = Boolean(model.busy);
      fields.apiUrl.input.disabled = !model.supported;
      fields.apiKey.input.disabled = !model.supported;
      container.setAttribute('aria-busy', String(Boolean(model.busy)));
    }
    function setImageEnabled(enabled) {
      model.imagesEnabled = enabled === true;
      imageBadge.textContent = model.imagesEnabled ? t.storyImageOn : t.storyImageOff;
      imageBadge.className = model.imagesEnabled ? 'sw-badge sw-settings-state sw-settings-state-on' : 'sw-badge sw-settings-state';
    }
    async function load() {
      if (model.busy) return;
      model.busy = 'read'; status.textContent = t.settingsLoading; error.textContent = ''; paint();
      try {
        const result = await ownCall('storySettings');
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok) throw new Error();
        applySafeView(result); model.loaded = true; status.textContent = '';
        for (const field of Object.values(fields)) if (!model[field.input.getAttribute('data-private-setting')].touched) field.repaint();
      } catch { if (!disposed) error.textContent = t.settingsLoadFailure; }
      finally { if (!disposed) { model.busy = ''; paint(); } }
    }
    const saveBar = node('div', { class: 'sw-settings-actions' }, actionRow(save, cancel, clear, reload));
    const dmCard = node('section', { class: 'sw-card sw-card-pad sw-private-settings-card' },
      node('div', { class: 'sw-settings-card-head' },
        node('div', { class: 'sw-settings-card-title' }, icon('settings'), node('div', {}, node('h3', {}, t.storyDmTitle), node('p', { class: 'sw-card-summary' }, t.storyDmSummary))), saved),
      node('div', { class: 'sw-private-grid' }, url, key),
      node('label', { class: 'sw-setting-field' }, t.storyDmModel, modelInput),
      support,
      node('details', { class: 'sw-settings-help' }, node('summary', {}, t.storyDmHelpSummary), note(t.storyDmApiHint)),
      saveBar, status, error);
    const imageCard = node('section', { class: 'sw-card sw-card-pad sw-settings-image-card' },
      node('div', { class: 'sw-settings-subhead' }, node('div', {}, node('h3', {}, t.storyImageTitle), node('p', { class: 'sw-card-summary' }, t.storyImageSummary)), imageBadge),
      node('label', { class: 'sw-setting-field' }, t.storyImageSource, source),
      node('details', { class: 'sw-settings-help' }, node('summary', {}, t.storyImageHelpSummary), note(t.storyImageSourceHint)),
      note(t.storyImageSettingsHint));
    const container = node('div', { class: 'sw-settings-stack sw-private-settings' }, dmCard, imageCard);
    paint();
    return { node: container, load, clear: clearPrivate, setImageEnabled };
  }
  function validImageSource(value) {
    const urls = value.match(/[a-z][a-z\d+.-]*:\/\/\S+/ig) ?? [];
    return urls.every((address) => {
      try {
        const url = new URL(address);
        const local = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127\./.test(url.hostname);
        return ['http:', 'https:'].includes(url.protocol) && local && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash;
      } catch { return false; }
    });
  }
  async function requestImage() {
    if (imageBusy) return;
    const previousImage = imageOutput.querySelector('.sw-generated-image');
    const previousDelegation = imageOutput.querySelector('.sw-delegation');
    const show = (message) => imageOutput.replaceChildren(note(message), ...[previousDelegation, previousImage].filter(Boolean));
    imageBusy = true; show(t.storyImagePending); render();
    try {
      const result = await ownCall('storyImage');
      if (disposed || ctx.signal?.aborted) return;
      if (!result?.ok || !result.image) throw new Error();
      imageResult = result.image;
      const image = imageResult;
      show(image.status === 'delegated' ? t.storyImageDelegated : image.status === 'ready' ? t.storyImageDirect : t.storyImageUnavailable);
      if (image.message) imageOutput.append(note(text(image.message)));
      if (image.status === 'delegated') {
        const output = node('textarea', { class: 'sw-delegation', rows: '7', readonly: '', 'aria-label': t.storyImageParams });
        output.value = JSON.stringify({ source: image.source, scene: image.scene, outfits: image.outfits, prompt: image.prompt }, null, 2);
        previousDelegation?.remove();
        imageOutput.append(output);
      }
      if (image.status === 'ready' && image.imageId) {
        const read = await ownCall('storyImageRead', { id: image.imageId });
        if (disposed || ctx.signal?.aborted) return;
        if (!read?.ok || !/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z\d+/]+=*$/.test(read.image?.dataUrl ?? '')) throw new Error();
        const picture = node('img', { class: 'sw-generated-image', src: read.image.dataUrl, alt: t.storyImageAlt });
        picture.addEventListener('error', () => { picture.remove(); show(t.storyImageFailed); }, { once: true });
        previousImage?.remove();
        imageOutput.append(picture);
      }
    } catch { if (!disposed) show(t.storyImageFailed); }
    finally { imageBusy = false; if (!disposed) render(); }
  }

  function settings(state) {
    if (!nodeLimitSettings) nodeLimitSettings = buildNodeLimitSettings();
    void nodeLimitSettings.load();
    if (!privateSettings) { privateSettings = buildPrivateSettings(); void privateSettings.load(); }
    privateSettings.setImageEnabled(state?.snapshot?.images?.enabled === true);
    return node('div', { class: 'sw-stack' }, node('div', { class: 'sw-lead' }, node('h2', {}, t.settingsTitle), node('p', {}, t.settingsIntro)),
    nodeLimitSettings.node,
    privateSettings.node,
    node('div', { class: 'sw-settings-grid' }, RESOURCE_SLOTS.filter((slot) => slot.id !== 'creek-letter-ending').map((slot) => {
      const file = node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, 'aria-label': `导入${slot.title}插画` });
      file.addEventListener('change', async () => {
        const picked = file.files?.[0]; if (!picked || importing) return;
        importing = slot.id; localError = ''; localNotice = ''; render();
        try {
          await artwork.import(slot.id, picked);
          if (!disposed) localNotice = '插画已应用。浏览器允许时会保留在本面板的本地存储中。';
        } catch (error) { if (!disposed) localError = error.message ?? '图片导入失败。'; }
        finally { importing = ''; if (!disposed) render(); }
      });
      return node('section', { class: 'sw-card sw-resource' }, scene(slot.id, slot.title, '', { tag: artwork.get(slot.id) ? '已设置插画' : '默认示意场景' }),
        node('div', { class: 'sw-card-pad' }, node('code', {}, slot.id), node('p', {}, slot.description), file,
          actionRow(button(importing === slot.id ? '正在读取…' : '选择本地图', () => file.click(), { icon: 'image', small: true, disabled: Boolean(importing), key: `import-${slot.id}` }),
            artwork.get(slot.id) ? button('恢复示意', () => artwork.clear(slot.id), { quiet: true, small: true, key: `clear-${slot.id}` }) : null)));
    })),
    node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-side-title' }, icon('image'), t.storyImageTitle),
      node('p', { class: 'sw-card-note' }, state?.snapshot?.images?.message ?? t.storyImageUnavailable),
      actionRow(button(imageBusy ? t.storyImagePending : t.storyImageGenerate, () => void requestImage(),
        { disabled: imageBusy || !state?.snapshot?.images?.enabled && !state?.snapshot?.images?.generationAvailable, key: 'story-image' })), imageOutput),
    node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-side-title' }, icon('info'), '关于本地插画'),
      node('p', { class: 'sw-card-note' }, '仅接受 PNG、JPEG、WebP，每张不超过 2 MB、1600 万像素。文件类型与内容会经过检查，不接受 SVG。图片不会上传；请只导入你有权使用的素材。'),
      note(t.localStorageHint),
      note('清理浏览器数据可能移除插画。图片加载失败时会回到文字与示意场景，操作入口照常保留。')),
    node('section', { class: 'sw-card sw-card-pad' }, node('div', { class: 'sw-side-title' }, icon('settings'), '地点、日程与故事创作'),
      node('p', { class: 'sw-card-note' }, '地点、住所与画风：娱乐时间的「地点册」。场所与分支：娱乐时间。今日安排与生活记录：鱼的每一天。')));
  }

  /** 这一段的「第几步」：两个值一变，就说明发生了新的事，可以自动滚到底。 */
  const playKey = (current) => current ? `${current.id}:${text(current.stamp)}:${list(current.events).length}:${list(current.free?.log).length}` : '';

  function render() {
    if (disposed || ctx.signal?.aborted) return;
    const state = controller?.state;
    const snapshot = state?.snapshot;
    const focused = root.ownerDocument?.activeElement;
    const focusKey = shell.contains(focused) ? focused?.getAttribute?.('data-focus') : null;
    // Details are retained through live status renders, without storing progress.
    for (const detail of main.querySelectorAll('details[data-details]')) {
      if (detail.open) openDetails.add(detail.getAttribute('data-details')); else openDetails.delete(detail.getAttribute('data-details'));
    }
    // 重建 DOM 会把滚动位置清零：先记下来，重建后再放回去（用户正在往上翻历史时不抢）。
    const scroller = main.querySelector('[data-focus="play-reading"]');
    if (scroller) {
      const top = Number(scroller.scrollTop) || 0;
      const height = Number(scroller.clientHeight) || 0;
      const total = Number(scroller.scrollHeight) || 0;
      playScroll = { key: playKey(snapshot?.trip), top, atBottom: top + height >= total - 24 };
    } else if (view !== 'play') {
      playScroll = { key: '', top: 0, atBottom: true };
    }
    top.replaceChildren(node('div', { class: 'sw-brand' }, node('span', { class: 'sw-logo' }, icon('fish')), node('div', {}, node('strong', {}, '故事工坊'), node('small', {}, '把日常，慢慢过成故事'))),
      node('div', { class: 'sw-top-actions' }, node('span', { class: 'sw-status' }, node('span', { class: 'sw-dot' }), snapshot?.trip ? '旅途进行中' : '欢迎回家'),
        button(immersive ? '沉浸中' : '沉浸', () => { immersive = !immersive; drawerOpen = false; render(); },
          { quiet: !immersive, primary: immersive, small: true, icon: immersive ? 'book' : 'image', key: 'immersive', pressed: immersive, ariaLabel: immersive ? '退出沉浸模式，回到对话式' : '切换沉浸模式：一屏一幕' }),
        button('刷新', () => controller?.refresh(), { quiet: true, small: true, icon: 'refresh', disabled: !state || state.loading || Boolean(state.busy) || state.recovering, key: 'refresh' })));
    nav.replaceChildren(...[['home', '鱼的家', 'home'], ['stories', '作品库', 'leaf'], ['play', '出游', 'pin'], ['memories', '行程回忆', 'book'], ['settings', t.settingsTab, 'image'], ['author', t.storyWrite, 'book']].map(([id, title, glyph]) =>
      node('button', { type: 'button', class: 'sw-tab', 'aria-current': view === id ? 'page' : undefined, 'aria-controls': 'story-panel-content', 'data-focus': `nav-${id}`, onclick: () => navigate(id) }, icon(glyph), title,
        id === 'memories' && list(snapshot?.memories).length ? node('span', { class: 'sw-count' }, list(snapshot.memories).length) : null)));
    const notices = [];
    if (state?.loading || state?.recovering) notices.push(node('div', { class: 'sw-loader', role: 'progressbar', 'aria-label': state.recovering ? '正在核对实际进度' : '正在读取故事状态' }));
    for (const [message, error] of [[state?.error, true], [localError, true], [conflict(snapshot), true], [localNotice || state?.notice, false]]) {
      if (!message) continue;
      notices.push(node('div', { class: `sw-notice${error ? ' sw-notice-error' : ''}`, role: error ? 'alert' : 'status' }, icon('info'), node('p', {}, message),
        error ? button('读取最新进度', () => controller?.refresh(), { small: true, disabled: state?.loading || Boolean(state?.busy) || state?.recovering, key: 'retry-status' }) : null));
    }
    feedback.replaceChildren(...notices);
    if (view === 'author') main.replaceChildren(authorView());
    else if (view === 'settings') main.replaceChildren(settings(state));
    else if (!snapshot) main.replaceChildren(empty(state?.loading ? '正在打开故事世界' : '暂时没有读到故事状态', state?.loading ? '从实际记录中，找回这一刻。' : '请检查故事调用适配器或服务连接，再读取最新进度。'));
    else main.replaceChildren(({ home, stories, play, memories }[view] ?? home)(state));
    main.setAttribute('aria-busy', String(Boolean(state?.loading || state?.recovering)));
    const nextScroller = main.querySelector('[data-focus="play-reading"]');
    if (nextScroller) {
      const key = playKey(snapshot?.trip);
      const fresh = key !== playScroll.key;
      if (fresh || playScroll.atBottom) nextScroller.scrollTop = Number(nextScroller.scrollHeight) || 0;
      else nextScroller.scrollTop = playScroll.top;
      playScroll = { key, top: Number(nextScroller.scrollTop) || 0, atBottom: fresh || playScroll.atBottom };
    }
    if (focusKey) for (const candidate of shell.querySelectorAll('[data-focus]')) {
      if (candidate.getAttribute('data-focus') === focusKey && !candidate.disabled) { candidate.focus({ preventScroll: true }); break; }
    }
  }
  controller = createStoryController(ctx, render);
  render();
  function dispose() {
    if (disposed) return;
    privateSettings?.clear();
    controller.dispose(); disposed = true;
    ctx.signal?.removeEventListener('abort', dispose);
    if (shell.parentNode === root) shell.remove();
  }
  ctx.signal?.addEventListener('abort', dispose, { once: true });
  return { dispose, refresh: () => controller.refresh() };
}
