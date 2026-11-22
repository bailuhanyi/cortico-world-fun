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
import { positionOf } from './layout.js';
import { HOME_STYLES } from './styles.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp';
/** 按内容寻址的图片引用缓存：切回面板不重复拉同一张图。 */
const artCache = new Map();

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
  const view = { editing: false, noteDraft: null, feedback: '', tone: '' };
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
    const key = slot === 'background' ? snapshot?.art?.background : (snapshot?.art?.characters?.[activity] ?? snapshot?.art?.characters?.idle);
    if (!key) return null;
    if (artCache.has(key)) return artCache.get(key);
    try {
      const result = await call('art', { slot, activity });
      const image = result?.image?.dataUrl ?? null;
      if (image) artCache.set(key, image);
      return image;
    } catch {
      return null;
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

    const hasCharacter = Boolean(snapshot.art?.characters?.[snapshot.room.activity]
      ?? snapshot.art?.characters?.idle);
    if (hasCharacter) {
      const spot = positionOf(snapshot.room.activity);
      const char = el(document, 'img', {
        class: 'fhm-char',
        alt: `鱼在家的样子：${snapshot.room.label}`,
        decoding: 'async',
        style: `left:${(spot.x * 100).toFixed(2)}%;bottom:${((1 - spot.y) * 100).toFixed(2)}%`,
      });
      stage.append(char);
      loadArt('character', snapshot.room.activity).then((src) => {
        if (src && live()) char.setAttribute('src', src);
      });
    } else {
      stage.append(el(document, 'div', { class: 'fhm-char-empty' }));
    }

    for (const spot of snapshot.art?.hotspots ?? []) {
      stage.append(el(document, 'span', {
        class: 'fhm-spot',
        title: spot.label || spot.id,
        style: `left:${(spot.x * 100).toFixed(2)}%;top:${(spot.y * 100).toFixed(2)}%`,
      }));
      if (spot.label) {
        stage.append(el(document, 'span', {
          class: 'fhm-spot-label',
          text: spot.label,
          style: `left:${(spot.x * 100).toFixed(2)}%;top:${(spot.y * 100).toFixed(2)}%`,
        }));
      }
    }

    if (snapshot.room.note) stage.append(el(document, 'p', { class: 'fhm-note', text: snapshot.room.note }));
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
          if (view.editing) view.noteDraft = snapshot.room.note;
          render();
        },
      }),
      el(document, 'button', {
        type: 'button',
        text: '恢复默认',
        disabled: Boolean(snapshot.damaged) || busy,
        onclick: () => {
          if (typeof globalThis.confirm === 'function' && !globalThis.confirm('把活动、备注和热点恢复默认？已上传的图片会保留。')) return;
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
      else await write('setCharacter', { activity, dataUrl, revision: snapshot.revision }, '这张图换好了。');
    } catch (error) {
      tell(error?.message ?? '这张图没读出来。', 'error');
      render();
    }
  }

  function renderDress() {
    if (!view.editing) return null;
    const box = el(document, 'div', { class: 'fhm-dress' },
      el(document, 'h3', { text: '布置房间' }),
      el(document, 'p', {
        class: 'fhm-dress-note',
        text: '背景 1920×1080；角色图十个活动同一张画布、底边对齐（见素材单）。单张不超过 8 MiB，支持 PNG / JPG / WebP / GIF。',
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

    for (const activity of snapshot.activities) {
      const has = Boolean(snapshot.art?.characters?.[activity.id]);
      box.append(el(document, 'div', { class: 'fhm-row' },
        el(document, 'span', { class: 'fhm-row-name', text: activity.label }),
        el(document, 'input', {
          type: 'file',
          accept: ACCEPT,
          'aria-label': `选择「${activity.label}」的角色图`,
          onchange: (event) => { void upload('character', activity.id, event.target); },
        }),
        el(document, 'span', { class: 'fhm-row-name', text: has ? '已设置' : '未设置' }),
        el(document, 'button', {
          type: 'button',
          text: '清空',
          disabled: !has || busy,
          'aria-label': `清空「${activity.label}」的角色图`,
          onclick: () => { void write('clearCharacter', { activity: activity.id, revision: snapshot.revision }, '这张图清掉了。'); },
        })));
    }

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
    const nodes = [head, feedback, renderStage(), renderChips(), renderActions()];
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
