/**
 * 面板的冒烟测试。
 *
 * `dist/webui.js` 只在 Coo 里跑，测试里跑不到——**最容易藏错误的地方**：
 * 服务端声明了面板但客户端没导出，宿主里点进去就是一片空白，不会报错。
 *
 * 这里用一个够用的极简 DOM 桩，把两个面板都真挂一遍，喂真实的 `invoke()`，
 * 断言：往 ctx.root 里写了东西、内容来自服务端数据、搜索能筛、详情能展开、
 * 失败时有错误卡、面板 id 与服务端声明一一对上。
 *
 * 照 `feed-world/test/panels.test.mjs` 的做法（那里已经顶着 47 项面板测试跑过很多版本）。
 * 不用 `node --test`：受限沙箱里它要 spawn 子进程会被 EPERM 挡住。
 */
import { test, report } from './harness.mjs';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULTS } from '../src/config.js';
import { FunWorld } from '../src/world.js';
import { VENUES } from '../src/venues.js';

// ---------------------------------------------------------------------------
// 极简 DOM
// ---------------------------------------------------------------------------

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.className = '';
    this._text = '';
    this.style = {};
    this.attributes = {};
    this._listeners = {};
    // 真 DOM 的 <input>/<select> 一律有 value（默认 ''）。桩里不给的话，
    // 面板里 `input.value.trim()` 会炸，而那是面板的正常写法。
    this._value = '';
    this.selected = false;
    this.placeholder = '';
    this.disabled = false;
    this.parentNode = null;
  }

  get value() {
    if (this.tagName === 'SELECT') {
      const options = this.querySelectorAll('option');
      return (options.find((option) => option.selected) ?? (this._noSelection ? null : options[0]))?.value ?? '';
    }
    return this._value;
  }

  set value(value) {
    this._value = String(value);
    if (this.tagName === 'SELECT') {
      for (const option of this.querySelectorAll('option')) option.selected = option.value === this._value;
      // 浏览器在 value 不匹配任何 option 时保持未选中。
      this._noSelection = !this.querySelectorAll('option').some((option) => option.selected);
    }
  }

  get textContent() {
    if (this.childNodes.length) return this.childNodes.map((c) => c.textContent).join('');
    return this._text;
  }

  set textContent(v) {
    this.childNodes = [];
    this._text = v === null || v === undefined ? '' : String(v);
  }

  appendChild(node) {
    this.childNodes.push(node);
    node.parentNode = this;
    this._text = '';
    return node;
  }

  append(...nodes) {
    for (const n of nodes) this.appendChild(n);
  }

  replaceChildren(...nodes) {
    this.childNodes = [];
    this._text = '';
    for (const n of nodes) this.appendChild(n);
  }

  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.childNodes.indexOf(this);
    if (i >= 0) this.parentNode.childNodes.splice(i, 1);
    this.parentNode = null;
  }

  get classList() {
    const self = this;
    return {
      add: (...names) => {
        const set = new Set(self.className.split(' ').filter(Boolean));
        for (const n of names) set.add(n);
        self.className = [...set].join(' ');
      },
      remove: (...names) => {
        const drop = new Set(names);
        self.className = self.className.split(' ').filter((n) => n && !drop.has(n)).join(' ');
      },
      contains: (n) => self.className.split(' ').includes(n),
    };
  }

  setAttribute(k, v) {
    this.attributes[k] = v;
    if (k === 'class') this.className = v;
    if (k === 'value') this.value = v;
    if (k === 'placeholder') this.placeholder = v;
    if (k === 'disabled') this.disabled = true;
  }

  getAttribute(k) { return this.attributes[k]; }

  addEventListener(type, fn) {
    (this._listeners[type] ??= []).push(fn);
  }

  focus() { document.activeElement = this; }

  /**
   * 触发一个事件。
   *
   * 第二个参数可以带额外字段（例如键盘的 `key`）：真 DOM 的事件对象上有它，
   * 桩里不传的话面板里 `ev.key === 'Enter'` 永远不成立，测出来是假绿。
   */
  fire(type = 'click', extra = null) {
    const ev = { type, target: this, ...(extra ?? {}) };
    for (const fn of this._listeners[type] ?? []) fn(ev);
    const prop = this[`on${type}`];
    if (typeof prop === 'function') prop(ev);
  }

  *walk() {
    yield this;
    for (const c of this.childNodes) yield* c.walk();
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] ?? null;
  }

  querySelectorAll(sel) {
    const isTag = !sel.startsWith('.') && !sel.startsWith('style');
    const cls = (sel.startsWith('.') || sel.startsWith('style.')) ? sel.replace(/^style/, '').split('.').filter(Boolean) : [];
    return [...this.walk()].filter((n) => {
      if (n === this) return false;
      if (isTag) return n.tagName === sel.toUpperCase();
      return cls.every((c) => c && n.classList.contains(c));
    });
  }

  findAll(pred) { return [...this.walk()].filter(pred); }

  findByText(text) {
    return [...this.walk()].find((n) => n.tagName === 'BUTTON' && n.textContent === text) ?? null;
  }
}

globalThis.document = {
  createElement: (tag) => new Node(tag),
  createTextNode: (t) => Object.assign(new Node('#text'), { _text: String(t) }),
  activeElement: null,
};

/** 等条件成立，而不是「等 0 毫秒若干次」——固定次数是竞态。 */
async function waitFor(check, what = '条件', timeoutMs = 2000) {
  const start = performance.now();
  for (;;) {
    const value = check();
    if (value) return value;
    if (performance.now() - start > timeoutMs) throw new Error(`等 ${what} 超时（${timeoutMs}ms）`);
    await new Promise((r) => setTimeout(r, 2));
  }
}

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

const intervalBox = { list: [] };
let seq = 0;
const run = `${process.pid}-${Date.now().toString(36)}`;

async function mountPanels({ language = 'zh', failList = false, cfg = {}, nowMs } = {}) {
  // 每个用例一个独立目录：共用的话，上一趟的 session 会漏到下一个用例里。
  const dataDir = await mkdtemp(join(tmpdir(), `fun-panels-${run}-${seq += 1}-`));
  const now = nowMs ?? Date.parse('2026-11-15T14:00:00+08:00');
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, ...cfg },
    dataDir,
    timezone: 'Asia/Shanghai',
    now: () => now,
    random: () => 0.42,
    persist: () => {},
  });
  await world.start({ log: { info() {}, warn() {} } });
  const decl = world.webUi(language);

  const bundle = await import('../dist/webui.js?' + Math.random());
  const root = new Node('div');
  intervalBox.list.length = 0;
  const invocations = [];
  const ctx = {
    pageId: 'world:fun',
    panelId: '',
    language,
    root,
    signal: { aborted: false },
    timeout() { return { dispose() {} }; },
    interval(fn, ms) {
      const entry = { fn, ms, disposed: false };
      intervalBox.list.push(entry);
      return { dispose() { entry.disposed = true; } };
    },
    async invoke(method, args) {
      const record = { method, args };
      invocations.push(record);
      if (failList && method === 'list') throw new Error('boom');
      const result = await decl.invoke(ctx.panelId, method, args ?? []);
      record.result = result;
      return result;
    },
  };

  async function mount(id) {
    ctx.panelId = id;
    root.replaceChildren();
    invocations.length = 0;
    await bundle.default.panels[id].mount(ctx);
    return root;
  }

  return { world, bundle, decl, mount, root, invocations, intervals: intervalBox.list, dataDir, tool: (n) => world.tools().find((t) => t.name === n).handler };
}

// ---------------------------------------------------------------------------

test('bundle 形状对：面板 id 与服务端声明一一对上，mount 都是函数', async () => {
  const b = await import('../dist/webui.js');
  const { decl } = await mountPanels();
  // 不写死面板数：webUi() 声明了几个就要求客户端导出几个。
  // 对不上不会报错，只会点进去一片空白——所以这条必须钉住。
  const declared = decl.panels.map((p) => p.id).sort();
  assert.deepEqual(Object.keys(b.default.panels).sort(), declared,
    `客户端导出的 ${Object.keys(b.default.panels).sort().join('、')} 与服务端声明的 ${declared.join('、')} 对不上`);
  for (const id of declared) {
    assert.equal(typeof b.default.panels[id].mount, 'function', `${id} 缺 mount`);
  }
  assert.ok(!Array.isArray(b.default.panels));
});

test('服务端面板声明带 getMethods，且声明的方法真的能调', async () => {
  const { decl } = await mountPanels();
  // 三张面板：去哪儿 / 纪念册 / 纪念品架（0.1.6 加的）。
  assert.deepEqual(decl.panels.map((p) => p.id), ['places', 'book', 'shelf']);
  for (const p of decl.panels) {
    assert.ok(p.title && p.description, `${p.id} 缺标题或说明`);
    assert.ok(Array.isArray(p.getMethods) && p.getMethods.length, `${p.id} 没声明 getMethods`);
    for (const m of p.getMethods) {
      const r = await decl.invoke(p.id, m, []);
      assert.equal(r.ok, true, `${p.id}.${m} 失败了：${r.error}`);
    }
  }
});

test('places 面板真挂：画出了全部场所、标了开没开、有一趟正在逛', async () => {
  const { mount, world, tool } = await mountPanels();
  await tool('fun_go')({ place: '漫展' });
  await tool('fun_wander')({ area: '同人展台', buy: '吧唧' });

  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  const cards = root.querySelectorAll('.fun-card');
  const names = cards.map((c) => c.querySelector('.fun-card-name').textContent);
  for (const n of ['游乐场', '海洋馆', '庙会', '漫展', '电影院', '动物园', '公园', '电玩城', 'KTV', '博物馆', '猫咖', '爬山', '咖啡店', '奶茶店', '餐厅']) {
    assert.ok(names.includes(n), `缺 ${n}`);
  }

  // 开着的在前：14:00 时漫展开着，卡上应带 fun-card-open
  const conCard = cards.find((c) => c.querySelector('.fun-card-name').textContent === '漫展');
  assert.ok(conCard.classList.contains('fun-card-open'), '开着的卡要有 open 样式');

  // 正在逛那一条
  const live = root.querySelector('.fun-live');
  assert.ok(live, '缺少「正在逛」那一条');
  assert.ok(live.textContent.includes('正在漫展逛'), `实际：${live.textContent}`);
  assert.ok(live.textContent.includes('同人展台'), '要写出逛过哪儿');
  assert.ok(live.textContent.includes('买了 吧唧'), '要写出买了什么');
  void world;
});

test('places 面板：没在逛时给的是「这会儿没在逛」而不是空', async () => {
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelector('.fun-live'), '画出「没在逛」那一条');
  const live = root.querySelector('.fun-live');
  assert.ok(live.textContent.includes('这会儿没在逛'));
  assert.ok(live.textContent.includes('14:00'), '要报当前时间');
  assert.ok(live.classList.contains('fun-live-idle'));
});

test('places 面板：点卡片能展开详情，再点收起', async () => {
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  const find = (name) => root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === name);

  find('猫咖').fire('click');
  await waitFor(() => root.querySelector('.fun-detail'), '展开详情');
  const detail = root.querySelector('.fun-detail');
  assert.ok(detail.textContent.includes('猫咖'));
  assert.ok(detail.textContent.includes('猫爬架'), '详情要列能逛的项目');
  assert.ok(detail.textContent.includes('一包猫条'), '详情要列纪念品');
  // 猫咖在素材库里没有场景，必须明说 scene 不用填
  assert.ok(detail.textContent.includes('scene 不用填'), `实际：${detail.textContent.slice(-120)}`);
  assert.ok(!detail.textContent.includes('scene 填「猫咖」'), '不能编库里没有的场景');

  find('漫展').fire('click');
  await waitFor(() => root.querySelector('.fun-detail')?.textContent.includes('漫展'), '切到漫展');
  assert.ok(root.querySelector('.fun-detail').textContent.includes('scene 填「漫展」'), '漫展有场景，要指名');

  find('漫展').fire('click');
  await waitFor(() => !root.querySelector('.fun-detail'), '再点一次收起');
});

test('places 面板：详情贴在它自己那张卡下面，不是跑到列表末尾', async () => {
  // 这条钉的是 0.1.1 的真实体验问题：详情被 append 到整个列表最后，
  // 点第一张卡要滑过十二张才看得见。改成「就地展开」之后，必须保证：
  //   ① 详情是紧跟在卡片后面的那个兄弟节点
  //   ② 包住它们的格子跨满整行
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  const firstCard = root.querySelectorAll('.fun-card')[0];
  const firstName = firstCard.querySelector('.fun-card-name').textContent;
  firstCard.fire('click');
  await waitFor(() => root.querySelector('.fun-detail'), '展开详情');

  const card = root.querySelector('.fun-card-active');
  assert.ok(card, '展开的那张卡要带 active 标记');
  assert.equal(card.querySelector('.fun-card-name').textContent, firstName, '展开的应当就是点的那张');

  // ① 详情紧跟在卡后面（父节点是同一个 cell，且是它的下一个兄弟）
  const cell = card.parentNode;
  assert.ok(cell.classList.contains('fun-cell'), '卡片应当被包在 fun-cell 里');
  assert.ok(cell.classList.contains('fun-cell-open'), '展开的 cell 要跨满整行');
  const detailNode = cell.querySelector('.fun-detail');
  assert.ok(detailNode, '详情要在这个 cell 里，而不是别的格子');
  const kids = cell.childNodes;
  const cardIdx = kids.indexOf(card);
  assert.equal(kids.indexOf(detailNode), cardIdx + 1, '详情必须是卡片的下一个兄弟节点');

  // ③ 详情不在列表最末尾（这是 0.1.1 的病）
  const listBox = cell.parentNode;           // .fun-grid
  const allCells = listBox.querySelectorAll('.fun-cell');
  const lastCell = allCells[allCells.length - 1];
  if (allCells.length > 1) {
    assert.notEqual(cell, lastCell, '展开的格子不该被挪到最后一个');
  }
});

test('places 面板：键盘也能开合（Enter / 空格）', async () => {
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  const card = root.querySelectorAll('.fun-card').find(
    (c) => c.querySelector('.fun-card-name').textContent === '博物馆');
  assert.equal(card.getAttribute('role'), 'button', '卡片要能被当成按钮');
  assert.equal(card.getAttribute('aria-expanded'), 'false');

  card.fire('keydown', { key: 'Enter' });
  await waitFor(() => root.querySelector('.fun-detail'), '回车展开');
  assert.ok(root.querySelector('.fun-detail').textContent.includes('博物馆'));

  const opened = root.querySelector('.fun-card-active');
  assert.equal(opened.getAttribute('aria-expanded'), 'true');
  opened.fire('keydown', { key: ' ' });
  await waitFor(() => !root.querySelector('.fun-detail'), '空格收起');
});

test('places 面板：收起按钮点的不是卡片，不会把刚收起的又展开', async () => {
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  root.querySelectorAll('.fun-card').find(
    (c) => c.querySelector('.fun-card-name').textContent === '公园').fire('click');
  await waitFor(() => root.querySelector('.fun-detail'), '展开');

  const closeBtn = root.querySelectorAll('.fun-detail-close')[0];
  assert.ok(closeBtn, '缺「收起」按钮');
  closeBtn.fire('click');
  await waitFor(() => !root.querySelector('.fun-detail'), '点「收起」应当收起');
});

test('places 面板：展开后滚的是整格（卡 + 详情），不是只滚卡片', async () => {
  // 卡片恰好贴在视口底部时，只保证卡片可见 = 详情还在屏幕外，等于没解决。
  // 桩里给 scrollIntoView 打桩，记下到底滚的是谁。
  //
  // 注意：面板每次开合都会 renderList() 重建节点，所以桩必须打在**重建之后**的节点上——
  // 打在点击前的旧节点上，新节点没有这个方法，永远调不到（这条测试第一版就这么假绿过）。
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  const scrolled = [];
  // 全局兜底：任何节点被调 scrollIntoView 都记下来（重建出来的新节点也一样）。
  const proto = Object.getPrototypeOf(root.querySelector('.fun-card'));
  const original = proto.scrollIntoView;
  proto.scrollIntoView = function patched(opts) {
    scrolled.push({ cls: this.className, opts });
  };

  try {
    root.querySelectorAll('.fun-card').find(
      (c) => c.querySelector('.fun-card-name').textContent === '电玩城').fire('click');
    await waitFor(() => root.querySelector('.fun-detail'), '展开');
    await waitFor(() => scrolled.length > 0, '调了 scrollIntoView');
  } finally {
    proto.scrollIntoView = original;
  }

  const first = scrolled[0];
  assert.ok(first.cls.includes('fun-cell'), `应当滚整格，实际滚的是：${first.cls}`);
  assert.ok(first.cls.includes('fun-cell-open'), '滚的应当是那个已展开的格子');
  assert.equal(first.opts?.block, 'nearest', '要用 nearest，已经在视野里就别跳');
});

test('places 面板：搜索能按名字/别名/标签筛', async () => {
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  const input = root.querySelector('.fun-search');
  assert.ok(input, '缺搜索框');

  input.value = '同人展';   // 别名
  input.fire('input');
  await waitFor(() => root.querySelectorAll('.fun-card').length === 1, '按别名筛出 1 处');
  assert.equal(root.querySelector('.fun-card-name').textContent, '漫展');

  input.value = '夜';       // 标签
  input.fire('input');
  await waitFor(() => root.querySelectorAll('.fun-card').length > 1, '按标签筛');

  input.value = '月球';
  input.fire('input');
  await waitFor(() => root.querySelector('.fun-empty'), '筛不到时给空状态');
  assert.ok(root.querySelector('.fun-empty').textContent.includes('月球'));
});

test('places 面板：失败时出错误卡，不是白屏', async () => {
  const { mount } = await mountPanels({ failList: true });
  const root = await mount('places');
  await waitFor(() => root.querySelector('.fun-err'), '出错误卡');
  assert.ok(root.querySelector('.fun-err').textContent.includes('boom'));
});

test('places 面板：有时段的场所标出此刻属于哪一段，并列出全部时段', async () => {
  const { mount } = await mountPanels({ nowMs: Date.parse('2026-11-15T06:30:00+08:00') });
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部场所');

  const find = (name) => root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === name);

  // 卡片上直接标了时段
  const river = find('江边');
  assert.ok(river.textContent.includes('清早'), `卡片上应当标着「清早」，实际：${river.textContent.slice(0, 80)}`);

  // 没用时段的场所不标
  const aquarium = find('海洋馆');
  assert.ok(!aquarium.textContent.includes('清早'), '没有时段的场所不该冒时段标签');

  // 展开详情能看到全部时段
  river.fire('click');
  await waitFor(() => root.querySelector('.fun-detail'), '展开江边');
  const detail = root.querySelector('.fun-detail');
  assert.ok(detail.textContent.includes('不同时段'), '详情里要有「不同时段」一节');
  for (const label of ['清早', '白天', '傍晚', '夜里']) {
    assert.ok(detail.textContent.includes(label), `详情里应当列出 ${label}`);
  }
  // 此刻那段要高亮
  const chips = detail.querySelectorAll('.fun-chip-phase');
  const active = chips.filter((c) => c.classList.contains('fun-chip-on'));
  assert.equal(active.length, 1, `应当只有一段是当前，实际 ${active.length}`);
  assert.ok(active[0].textContent.includes('清早'));
});

test('places 面板：详情里的描写是「此刻那段」，不是通用那段', async () => {
  const dawn = await mountPanels({ nowMs: Date.parse('2026-11-15T06:30:00+08:00') });
  const rootDawn = await dawn.mount('places');
  await waitFor(() => rootDawn.querySelectorAll('.fun-card').length === VENUES.length, '画出全部');
  rootDawn.querySelectorAll('.fun-card').find(
    (c) => c.querySelector('.fun-card-name').textContent === '江边').fire('click');
  await waitFor(() => rootDawn.querySelector('.fun-detail-desc'), '展开');
  const dawnText = rootDawn.querySelector('.fun-detail-desc').textContent;
  assert.ok(/雾/.test(dawnText), `清早应当有雾，实际：${dawnText.slice(0, 60)}`);

  const night = await mountPanels({ nowMs: Date.parse('2026-11-15T22:00:00+08:00') });
  const rootNight = await night.mount('places');
  await waitFor(() => rootNight.querySelectorAll('.fun-card').length === VENUES.length, '画出全部');
  rootNight.querySelectorAll('.fun-card').find(
    (c) => c.querySelector('.fun-card-name').textContent === '江边').fire('click');
  await waitFor(() => rootNight.querySelector('.fun-detail-desc'), '展开');
  const nightText = rootNight.querySelector('.fun-detail-desc').textContent;
  assert.notEqual(dawnText, nightText, '清早和夜里不能显示同一段描写');
  assert.ok(/航灯|路灯|黑/.test(nightText), `夜里应当是另一副样子，实际：${nightText.slice(0, 60)}`);
});

test('places 面板：去过的场所标出「去过 N 次」', async () => {
  const { mount, tool } = await mountPanels();
  // 先去一趟并收摊
  await tool('fun_go')({ place: '漫展' });
  await tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  await tool('fun_home')({});

  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部');
  const find = (name) => root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === name);

  assert.ok(find('漫展').textContent.includes('去过 1 次'), '去过的要标次数');
  assert.ok(!find('江边').textContent.includes('去过'), '没去过的不能标');
});

test('places 面板：能添加自填地点，表单填完保存后卡片出现', async () => {
  const { mount, invocations, world } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部');

  const add = root.findAll((n) => n.tagName === 'BUTTON' && n.textContent.includes('添加地点'))[0];
  assert.ok(add, '缺「添加地点」按钮');
  add.fire('click');
  const form = root.querySelector('.fun-form');
  assert.ok(form, '点开后要有表单');
  assert.ok(form.textContent.includes('添加一处自己的地方'));
  assert.ok(root.querySelector('.fun-hint').textContent.includes('现在也能改'), '要说清预设现在可编辑');

  // 填最小必填项：名字 + 能逛的
  const inputs = form.findAll((n) => n.tagName === 'INPUT');
  const nameInput = inputs.find((i) => i.placeholder.includes('巷子里'));
  assert.ok(nameInput, '缺名字输入框');
  nameInput.value = '我的小院';
  const areas = form.findAll((n) => n.tagName === 'TEXTAREA')
    .find((t) => String(t.placeholder).includes('一行一处'));
  assert.ok(areas, '缺「能逛的」输入框');
  areas.value = '藤椅\n花架';

  const save = form.findAll((n) => n.tagName === 'BUTTON' && n.textContent === '保存')[0];
  assert.ok(save);
  save.fire('click');

  await waitFor(() => invocations.find((x) => x.method === 'save')?.result, 'save 有回执');
  const saveCall = invocations.find((x) => x.method === 'save');
  assert.equal(saveCall.result.ok, true);
  await waitFor(() => {
    const cards = root.querySelectorAll('.fun-card-name').map((n) => n.textContent);
    return cards.includes('我的小院');
  }, '新地点出现在卡片里');

  // 服务端确实存了
  const data = await world.webUi('zh').invoke('places', 'list', []);
  assert.equal(data.userVenueCount, 1);
  assert.equal(data.total, VENUES.length + 1);
});

test('places 面板：自填地点和预设都有「编辑」按钮（B 阶段）', async () => {
  const { mount, world } = await mountPanels();
  await world.webUi('zh').invoke('places', 'save', [{ name: '我的小院', areas: ['藤椅'] }]);
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length + 1, '画出全部');

  const find = (name) => root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === name);
  find('我的小院').fire('click');
  await waitFor(() => root.querySelector('.fun-detail-edit'), '自填地点要有编辑按钮');
  assert.ok(root.querySelector('.fun-detail').textContent.includes('我的小院'));

  // B 阶段起预设也能编辑
  find('漫展').fire('click');
  await waitFor(() => root.querySelector('.fun-detail')?.textContent.includes('漫展'), '切到漫展');
  assert.ok(root.querySelector('.fun-detail-edit'), '预设也要能编辑');
});

test('places 面板：编辑自填地点时表单带出原值，改完生效', async () => {
  const { mount, world } = await mountPanels();
  const made = await world.webUi('zh').invoke('places', 'save', [{
    name: '我的小院', areas: ['藤椅'], souvenirs: ['一片叶子'],
  }]);
  assert.equal(made.ok, true);

  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length + 1, '画出全部');
  const mine = root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === '我的小院');
  mine.fire('click');
  await waitFor(() => root.querySelector('.fun-detail-edit'), '有编辑按钮');
  root.querySelector('.fun-detail-edit').fire('click');

  const form = root.querySelector('.fun-form');
  assert.ok(form, '打开编辑表单');
  assert.ok(form.textContent.includes('编辑：我的小院'));
  const areaBox = form.findAll((n) => n.tagName === 'TEXTAREA')
    .find((t) => String(t.placeholder).includes('一行一处'));
  assert.ok(areaBox.value.includes('藤椅'), '表单要带出原值');
  assert.ok(form.textContent.includes('删除这处'), '编辑态有删除按钮');
});

test('places 面板：编辑预设时表单带出原值，且是「恢复预设」不是「删除」', async () => {
  const { mount } = await mountPanels();
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部');

  const card = root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === '漫展');
  card.fire('click');
  await waitFor(() => root.querySelector('.fun-detail-edit'), '预设要有编辑按钮');
  root.querySelector('.fun-detail-edit').fire('click');

  const form = root.querySelector('.fun-form');
  assert.ok(form, '打开编辑表单');
  assert.ok(form.textContent.includes('编辑预设：漫展'), '标题要写清是预设');
  assert.ok(form.textContent.includes('覆盖层'), '要说明改的是覆盖层');
  assert.ok(form.textContent.includes('恢复预设'), '预设不能删，给的是恢复');
  assert.ok(!form.textContent.includes('删除这处'), '预设不该出现删除');
  const areaBox = form.findAll((n) => n.tagName === 'TEXTAREA')
    .find((t) => String(t.placeholder).includes('一行一处'));
  assert.ok(areaBox.value.includes('同人展台'), '表单要带出预设原值');
});

test('places 面板：时段预设编辑明确标出通用字段范围，保存后保留阶段描写与可逛清单', async () => {
  const river = VENUES.find((v) => v.id === 'riverside');
  for (const [time, phase] of [['06:30', '清早'], ['22:00', '夜里'], ['02:00', null]]) {
    const { mount, world, invocations } = await mountPanels({ nowMs: Date.parse(`2026-11-15T${time}:00+08:00`) });
    const root = await mount('places');
    await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出场所');
    root.querySelectorAll('.fun-card').find((c) => c.querySelector('.fun-card-name').textContent === '江边').fire('click');
    await waitFor(() => root.querySelector('.fun-detail-edit'), '展开江边');
    root.querySelector('.fun-detail-edit').fire('click');
    const form = root.querySelector('.fun-form');
    const phaseInfo = form.querySelector('.fun-form-phases');
    assert.ok(phaseInfo, '时段预设表单要列出阶段信息');
    assert.ok(phaseInfo.textContent.includes(`现在 ${time}`));
    assert.ok(phaseInfo.textContent.includes(phase ? `当前阶段：${phase}` : '当前未命中预设时段，使用通用内容'));
    for (const ph of river.phases) {
      assert.ok(phaseInfo.textContent.includes(`${ph.label} ${ph.from}–${ph.to}`));
    }
    assert.equal(phaseInfo.querySelectorAll('li').length, river.phases.length);
    assert.ok(phaseInfo.querySelectorAll('li').every((li) => li.textContent.includes('覆盖通用描写（desc）、能逛的（areas）')));
    const descField = form.querySelectorAll('.fun-field').find((f) => f.textContent.includes('通用描写（desc）'));
    const areasField = form.querySelectorAll('.fun-field').find((f) => f.textContent.includes('通用可逛清单（areas）'));
    assert.equal(descField.querySelector('textarea').value, river.desc, '编辑应带出通用描写');
    assert.equal(areasField.querySelector('textarea').value, river.areas.join('\n'), '编辑应带出完整通用清单');
    for (const field of [descField, areasField]) {
      const scope = field.querySelector('.fun-field-scope').textContent;
      assert.ok(scope.includes('未命中这些时段时才使用这里的内容'));
      assert.ok(scope.includes('保存不会同步修改时段'));
    }
    descField.querySelector('textarea').value = '通用江边：新铺的步道与白栏杆。';
    areasField.querySelector('textarea').value = '新步道\n新长椅';
    form.findByText('保存').fire('click');
    await waitFor(() => invocations.find((x) => x.method === 'save')?.result, '保存通用字段');
    const save = invocations.find((x) => x.method === 'save');
    assert.equal(save.result.ok, true, save.result.error);
    assert.equal('phases' in save.args[0], false, '保存通用字段不提交阶段覆盖');
    const data = await world.webUi('zh').invoke('places', 'list', []);
    const saved = data.places.find((p) => p.id === river.id);
    assert.equal(saved.descAll, '通用江边：新铺的步道与白栏杆。');
    assert.deepEqual(saved.allAreas, ['新步道', '新长椅']);
    assert.deepEqual(saved.phases.map(({ key, label, from, to }) => ({ key, label, from, to })),
      river.phases.map(({ key, label, from, to }) => ({ key, label, from, to })), '保存通用字段保留预设时段边界');
    if (phase) {
      const preset = river.phases.find((ph) => ph.label === phase);
      assert.equal(saved.desc, preset.desc, '通用保存不覆盖阶段描写');
      assert.deepEqual(saved.areas, preset.areas, '通用保存不覆盖阶段可逛清单');
    } else {
      assert.equal(saved.desc, saved.descAll, '未命中阶段时使用保存的通用描写');
      assert.deepEqual(saved.areas, saved.allAreas);
    }
  }
});

test('places 面板：无时段预设与自填表单不显示时段覆盖提示', async () => {
  const { mount, world } = await mountPanels();
  await world.webUi('zh').invoke('places', 'save', [{ name: '我的小院', areas: ['藤椅'] }]);
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length + 1, '画出场所');
  for (const name of ['漫展', '我的小院']) {
    root.querySelectorAll('.fun-card').find((c) => c.querySelector('.fun-card-name').textContent === name).fire('click');
    await waitFor(() => root.querySelector('.fun-detail-edit'), '展开详情');
    root.querySelector('.fun-detail-edit').fire('click');
    const form = root.querySelector('.fun-form');
    assert.equal(form.querySelector('.fun-form-phases'), null);
    assert.equal(form.querySelector('.fun-field-scope'), null);
    form.findByText('取消').fire('click');
  }
});

test('places 面板：改过的预设标「已改」，并能一键恢复全部', async () => {
  const { mount, invocations, world } = await mountPanels();
  // 直接通过服务端改一处预设（改纪念品）
  const con = VENUES.find((v) => v.id === 'con');
  const saved = await world.webUi('zh').invoke('places', 'save', [{
    id: 'con', name: con.name, aliases: con.aliases, tags: con.tags, desc: con.desc,
    recommendedOutfit: con.recommendedOutfit, crowd: con.crowd, hours: con.hours,
    areas: con.areas, souvenirs: ['我自己写的吧唧'], photoSpots: con.photoSpots,
    randomEvents: con.randomEvents,
  }]);
  assert.equal(saved.ok, true, saved.error);

  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '画出全部');
  const conCard = root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === '漫展');
  conCard.fire('click');
  await waitFor(() => root.querySelector('.fun-detail'), '展开详情');
  assert.ok(root.querySelector('.fun-detail').textContent.includes('已改'), '改过的预设要标「已改」');

  const resetBtn = root.findAll((n) => n.tagName === 'BUTTON' && n.textContent.includes('恢复全部预设'))[0];
  assert.ok(resetBtn, '要有「恢复全部预设」按钮');
  resetBtn.fire('click');
  await waitFor(() => invocations.find((x) => x.method === 'resetAll')?.result, 'resetAll 有回执');
  assert.equal(invocations.find((x) => x.method === 'resetAll').result.ok, true);

  const data = await world.webUi('zh').invoke('places', 'list', []);
  assert.equal(data.overriddenCount, 0, '恢复之后覆盖层清空');
  assert.equal(data.places.find((p) => p.id === 'con').souvenirs.includes('我自己写的吧唧'), false,
    '恢复之后纪念品回到预设');
});

test('book 面板：空册子给一句话；逛完一趟之后能查回来', async () => {
  const { mount, tool } = await mountPanels();
  let root = await mount('book');
  await waitFor(() => root.querySelector('.fun-empty'), '空册子');
  assert.ok(root.querySelector('.fun-empty').textContent.includes('纪念册还是空的'));

  await tool('fun_go')({ place: '海洋馆' });
  await tool('fun_wander')({ area: '鲸豚湾', buy: '鲸鱼挂件', photo: '海底隧道正中间' });
  await tool('fun_home')({});

  root.replaceChildren();
  root = await mount('book');
  await waitFor(() => root.querySelector('.fun-trip'), '画出那一趟');
  const trip = root.querySelector('.fun-trip');
  assert.ok(trip.textContent.includes('海洋馆'));
  assert.ok(trip.textContent.includes('鲸豚湾'));
  assert.ok(trip.textContent.includes('鲸鱼挂件'));
  assert.ok(trip.textContent.includes('scene：水族馆'), '有场景的要在纪念册里标出 scene');

  // 统计条
  const stats = root.querySelector('.fun-stats');
  assert.ok(stats.textContent.includes('1'), '趟数应当是 1');
});

test('book 面板：多趟按地方汇总出「常去的」', async () => {
  const { mount, tool } = await mountPanels();
  for (const place of ['漫展', '漫展', '海洋馆']) {
    await tool('fun_go')({ place });
    await tool('fun_wander')({});
    await tool('fun_home')({});
  }
  const root = await mount('book');
  await waitFor(() => root.querySelectorAll('.fun-trip').length === 3, '画出三趟');
  const chips = root.querySelectorAll('.fun-chip').map((c) => c.textContent);
  assert.ok(chips.some((c) => c.startsWith('漫展 ×2')), `常去的排序不对：${chips.join('、')}`);
});

test('面板不写盘：invoke("list") 是只读的', async () => {
  const { mount, dataDir, tool } = await mountPanels();
  await tool('fun_go')({ place: '庙会' });
  const before = await import('node:fs/promises').then((fs) => fs.readFile(join(dataDir, 'fun', 'state.json'), 'utf8'));
  await mount('places');
  await mount('book');
  await new Promise((r) => setTimeout(r, 20));
  const after = await import('node:fs/promises').then((fs) => fs.readFile(join(dataDir, 'fun', 'state.json'), 'utf8'));
  assert.equal(before, after, '面板只读不该改动状态文件');
});

test('面板登记了定时刷新，并且能被宿主 dispose', async () => {
  const { mount, intervals } = await mountPanels();
  await mount('places');
  assert.ok(intervals.length >= 1, 'places 面板应当登记一个刷新定时器');
  assert.equal(intervals[0].ms, 60000);
});

test('英文界面也有标题，不回落成中文', async () => {
  const { mount, decl } = await mountPanels({ language: 'en' });
  assert.equal(decl.panels.find((p) => p.id === 'places').title, 'Where to go');
  assert.equal(decl.panels.find((p) => p.id === 'book').title, 'Trip book');
  const root = await mount('book');
  await waitFor(() => root.querySelector('.fun-empty'), '渲染出来');
  assert.ok(root.childNodes.length > 0);
});

test('shelf 面板：空架子给一句话', async () => {
  const { mount } = await mountPanels();
  const root = await mount('shelf');
  await waitFor(() => root.querySelector('.fun-empty'), '渲染出空架子提示');
  assert.match(root.querySelector('.fun-empty').textContent, /架子上还什么都没有/);
});

test('shelf 面板：买过东西之后按地方归着，带件数和最早日期', async () => {
  const { mount, tool } = await mountPanels();
  await tool('fun_go')({ place: '漫展' });
  await tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  await tool('fun_home')({});

  const root = await mount('shelf');
  await waitFor(() => root.querySelectorAll('.fun-trip').length > 0, '画出架子');

  const text = root.textContent;
  assert.match(text, /漫展/, '要按地方归着');
  assert.match(text, /吧唧/, '要列出东西');
  assert.match(text, /1 样/, '要显示这一处有几样');
  assert.ok(root.querySelectorAll('.fun-stat').length >= 3, '顶部要有统计数');
});

test('shelf 面板：每件物品可展开对应行程、同行人与收摊备注', async () => {
  const { mount, tool } = await mountPanels();
  await tool('fun_go')({ place: '漫展', company: '阿岚' });
  await tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  await tool('fun_home')({ note: '排了很久，但很开心' });
  const root = await mount('shelf');
  await waitFor(() => root.querySelector('details'), '物品提供原生可开合的详情');
  const detail = root.querySelector('details');
  assert.match(detail.textContent, /吧唧/);
  assert.match(detail.textContent, /阿岚/);
  assert.match(detail.textContent, /排了很久，但很开心/);
  assert.match(root.textContent, /最近 40 趟/);
  const receipt = await tool('fun_shelf')({ place: '漫展' });
  assert.match(receipt.text, /阿岚/);
  assert.match(receipt.text, /排了很久，但很开心/);
});

test('shelf 面板：进度里点出还差哪些没逛', async () => {
  const { mount, tool } = await mountPanels();
  await tool('fun_go')({ place: '漫展' });
  await tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  await tool('fun_home')({});

  const root = await mount('shelf');
  await waitFor(() => root.querySelectorAll('.fun-trip').length > 1, '画出去过的地方');
  assert.match(root.textContent, /还差：/, '要具体点出还差什么');
  assert.match(root.textContent, /逛过 1\/6/, '要有进度分母');
});

test('book 面板可珍藏和取消珍藏，重载后仍保留', async () => {
  const { mount, tool, world } = await mountPanels();
  await tool('fun_go')({ place: '海洋馆' });
  await tool('fun_wander')({ area: '鲸豚湾', buy: '鲸鱼挂件' });
  await tool('fun_home')({ note: '看到鲸影，很安静' });
  let data = await world.webUi('zh').invoke('book', 'list', []);
  const trip = data.trips[0];
  assert.ok(trip.id);
  const root = await mount('book');
  await waitFor(() => root.querySelector('.fun-trip-actions')?.querySelectorAll('button').length > 0, '珍藏按钮已挂载');
  root.querySelector('.fun-trip-actions').querySelector('button').fire('click');
  await waitFor(() => root.querySelector('.fun-trip-actions')?.querySelector('button')?.textContent === '取消珍藏', '服务端写入珍藏');
  await world.stop();
  const restarted = new FunWorld({ cfg: { enabled: true }, dataDir: world.dataDir, timezone: 'Asia/Shanghai' });
  await restarted.start({ log: { info() {}, warn() {} } });
  data = await restarted.webUi('zh').invoke('book', 'list', []);
  assert.equal(data.keepsakeCount, 1);
  assert.equal(data.trips[0].kept, true);
  const unkeep = await restarted.webUi('zh').invoke('book', 'favorite', [{ id: trip.id, keep: false }]);
  assert.equal(unkeep.ok, true);
  assert.equal((await restarted.webUi('zh').invoke('book', 'list', [])).trips[0].kept, false);
});

test('shelf 面板：英文界面也有标题', async () => {
  const { decl } = await mountPanels({ language: 'en' });
  assert.equal(decl.panels.find((p) => p.id === 'shelf').title, 'Shelf');
});

async function mountWishPanel(invokeWish = async () => ({ ok: true })) {
  const bundle = await import('../dist/webui.js?' + Math.random());
  const root = new Node('div');
  const calls = [];
  const data = { ok: true, total: 0, session: null, wishes: [], places: [
    { id: 'river', name: '江边', areas: ['步道'], phaseNames: ['清早', '夜里'], souvenirs: ['明信片'] },
    { id: 'yard', name: '小院', areas: ['藤椅'], phaseNames: [], souvenirs: [] },
  ] };
  const mounted = bundle.default.panels.book.mount({ root, async invoke(method, args) {
    calls.push({ method, args });
    if (method === 'list') return structuredClone(data);
    return invokeWish(args[0], data);
  } });
  await waitFor(() => root.querySelector('.fun-wish-form'), '心愿表单');
  const choose = (cls, value) => {
    const select = root.querySelector(cls);
    select.value = value;
    assert.equal(select.value, value, '桩必须能选中真实 option');
    select.fire('change');
  };
  return { root, calls, data, mounted, choose };
}

test('DOM 桩 select/value 读取真实选项，替换选项不会留下旧值', () => {
  const select = new Node('select');
  const option = (value) => { const n = new Node('option'); n.setAttribute('value', value); return n; };
  select.append(option(''), option('area'));
  assert.equal(select.value, '');
  select.value = 'area';
  assert.equal(select.value, 'area');
  select.value = '不存在';
  assert.equal(select.value, '');
  select.replaceChildren(option('phase'));
  select.value = 'phase';
  assert.equal(select.value, 'phase');
});

test('book 心愿：空册仍可填写，不默认选择；四类目标联动且切换清空目标', async () => {
  const { root, calls, choose } = await mountWishPanel();
  assert.match(root.textContent, /纪念册还是空的/);
  for (const cls of ['.fun-wish-place', '.fun-wish-type', '.fun-wish-target']) assert.equal(root.querySelector(cls).value, '');
  assert.equal(calls.filter((c) => c.method === 'wish').length, 0);
  root.findByText('保存心愿').fire();
  assert.match(root.querySelector('.fun-form-error').textContent, /请选择/);
  assert.equal(calls.filter((c) => c.method === 'wish').length, 0);
  choose('.fun-wish-place', 'river');
  const expected = { area: ['步道'], phase: ['清早', '夜里'], souvenir: ['明信片'], visit: [] };
  for (const [type, targets] of Object.entries(expected)) {
    choose('.fun-wish-type', type);
    const target = root.querySelector('.fun-wish-target');
    assert.equal(target.value, '');
    assert.deepEqual(target.querySelectorAll('option').slice(1).map((n) => n.value), targets);
    if (targets.length) choose('.fun-wish-target', targets[0]);
    else assert.equal(target.disabled, true);
  }
  choose('.fun-wish-type', 'area');
  choose('.fun-wish-target', '步道');
  choose('.fun-wish-place', 'yard');
  assert.equal(root.querySelector('.fun-wish-target').value, '');
  assert.deepEqual(root.querySelector('.fun-wish-target').querySelectorAll('option').slice(1).map((n) => n.value), ['藤椅']);
  choose('.fun-wish-type', 'phase');
  assert.equal(root.querySelector('.fun-wish-target').disabled, true);
  assert.match(root.querySelector('.fun-wish-target').textContent, /没有可选目标/);
  assert.equal(calls.filter((c) => c.method === 'wish').length, 0);
});

test('book 心愿：保存必须点击，进行中拦重复提交；失败保留选择和缘由并可重试', async () => {
  let resolve;
  let count = 0;
  const { root, calls, choose } = await mountWishPanel(async (payload, data) => {
    count += 1;
    if (count === 1) return new Promise((r) => { resolve = r; });
    data.wishes.push({ ...payload, id: 'w1', status: 'active' });
    return { ok: true };
  });
  choose('.fun-wish-place', 'river');
  choose('.fun-wish-type', 'phase');
  choose('.fun-wish-target', '夜里');
  const reason = root.querySelector('.fun-wish-reason');
  reason.value = '  想看看航灯  ';
  reason.fire('input');
  assert.equal(count, 0);
  const save = root.findByText('保存心愿');
  save.fire(); save.fire();
  root.findByText('保存中…').fire();
  assert.equal(count, 1);
  assert.equal(root.findByText('保存中…').disabled, true);
  assert.deepEqual(calls.find((c) => c.method === 'wish').args, [{ action: 'add', placeId: 'river', type: 'phase', target: '夜里', reason: '想看看航灯' }]);
  resolve({ ok: false, error: '暂时存不下来' });
  await waitFor(() => root.querySelector('.fun-form-error').textContent.includes('暂时存不下来'), '保存错误');
  assert.equal(root.querySelector('.fun-wish-target').value, '夜里');
  assert.equal(root.querySelector('.fun-wish-reason').value, '  想看看航灯  ');
  root.findByText('保存心愿').fire();
  await waitFor(() => root.querySelector('.fun-wish'), '保存成功');
  assert.match(root.querySelector('.fun-wish').textContent, /待实现.*在某个时段去.*夜里.*想看看航灯/);
  assert.equal(root.querySelector('.fun-wish-place').value, '');
  assert.equal(root.querySelector('.fun-wish-type').value, '');
});

test('book 心愿：visit 发送空目标，暂缓/恢复/取消含状态与错误，已实现没有操作', async () => {
  let resolve;
  let fail = true;
  const { root, data, mounted, choose } = await mountWishPanel(async (payload, data) => {
    if (payload.action === 'add') {
      data.wishes.push({ ...payload, id: 'w1', status: 'active', reason: '想散步' });
      return { ok: true };
    }
    if (fail) return new Promise((r) => { resolve = r; });
    data.wishes[0].status = { pause: 'paused', resume: 'active', cancel: 'cancelled' }[payload.action];
    return { ok: true };
  });
  choose('.fun-wish-place', 'river'); choose('.fun-wish-type', 'visit');
  root.findByText('保存心愿').fire();
  await waitFor(() => root.findByText('暂缓'), '待实现操作');
  assert.equal(data.wishes[0].target, '');
  const pause = root.findByText('暂缓'); pause.fire(); pause.fire();
  assert.equal(root.findByText('暂缓').disabled, true);
  resolve({ ok: false, error: '操作被拒绝' });
  await waitFor(() => root.querySelector('.fun-trip-error'), '列表错误');
  assert.match(root.querySelector('.fun-trip-error').textContent, /操作被拒绝/);
  fail = false;
  root.findByText('暂缓').fire();
  await waitFor(() => root.findByText('恢复'), '暂缓完成');
  assert.match(root.querySelector('.fun-wish').textContent, /已暂缓/);
  root.findByText('恢复').fire();
  await waitFor(() => root.findByText('暂缓'), '恢复完成');
  root.findByText('取消').fire();
  await waitFor(() => root.querySelector('.fun-wish-status').textContent === '已取消', '取消完成');
  assert.equal(root.querySelector('.fun-wish').querySelectorAll('button').length, 0);
  data.wishes[0].status = 'completed';
  await mounted.refresh();
  assert.match(root.querySelector('.fun-wish').textContent, /已实现/);
  assert.equal(root.querySelector('.fun-wish').querySelectorAll('button').length, 0);
});

report();
