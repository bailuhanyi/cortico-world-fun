/**
 * 面板的冒烟测试。
 *
 * `dist/webui.js` 只在 Coo 里跑，测试里跑不到——**最容易藏错误的地方**：
 * 服务端声明了面板但客户端没导出，宿主里点进去就是一片空白，不会报错。
 *
 * 这里用一个够用的极简 DOM 桩，把各个面板都真挂一遍，喂真实的 `invoke()`，
 * 断言：往 ctx.root 里写了东西、内容来自服务端数据、搜索能筛、详情能展开、
 * 失败时有错误卡、面板 id 与服务端声明一一对上。
 *
 * 照 `feed-world/test/panels.test.mjs` 的做法（那里已经顶着 47 项面板测试跑过很多版本）。
 * 不用 `node --test`：受限沙箱里它要 spawn 子进程会被 EPERM 挡住。
 */
import { test, report } from './harness.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadStandaloneWebUi } from '../tools/load-webui.mjs';
import { tempDir, trackWorld } from './tmp.mjs';

const loadPanelClient = () => loadStandaloneWebUi(new URL('../dist/webui.js', import.meta.url));

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
    this.ownerDocument = globalThis.document;
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
    // 真 DOM 的 append 接受字符串（会转成文本节点）；桩里也照做，否则地点册这类
    // 用原生 append 写文本的面板一挂就炸。
    if (node === null || node === undefined) return node;
    if (typeof node !== 'object') node = globalThis.document.createTextNode(String(node));
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

  contains(node) {
    return [...this.walk()].includes(node);
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
  createElementNS: (_namespace, tag) => new Node(tag),
  createTextNode: (t) => Object.assign(new Node('#text'), { _text: String(t) }),
  activeElement: null,
  addEventListener() {},
  removeEventListener() {},
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

async function mountPanels({ language = 'zh', failList = false, cfg = {}, nowMs, random = () => 0.42, dataDir: existingDataDir } = {}) {
  // 每个用例一个独立目录：共用的话，上一趟的 session 会漏到下一个用例里。
  const dataDir = existingDataDir ?? await tempDir(`fun-panels-${run}-${seq += 1}-`);
  let now = nowMs ?? Date.parse('2026-11-15T14:00:00+08:00');
  const world = trackWorld(new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, ...cfg },
    dataDir,
    timezone: 'Asia/Shanghai',
    now: () => now,
    random,
    persist: () => {},
  }));
  await world.start({ log: { info() {}, warn() {} } });
  const rawDecl = world.webUi(language);
  const legacyPanel = { places: ['outing', 'places'], locations: ['outing', 'locations'], book: ['journal', 'book'], shelf: ['journal', 'shelf'], stories: ['story', null] };
  const decl = { ...rawDecl, raw: rawDecl, async invoke(panel, method, args = []) {
    const [target, source] = legacyPanel[panel] ?? [panel, null];
    return rawDecl.invoke(target, method, source ? [...args, { __panelSource: source }] : args);
  } };

  const bundle = await loadPanelClient();
  const root = new Node('div');
  intervalBox.list.length = 0;
  const invocations = [];
  const ctx = {
    pageId: 'world:fun',
    panelId: '',
    language,
    root,
    signal: { aborted: false, addEventListener() {}, removeEventListener() {} },
    timeout() { return { dispose() {} }; },
    interval(fn, ms) {
      const entry = { fn, ms, disposed: false };
      intervalBox.list.push(entry);
      return { dispose() { entry.disposed = true; } };
    },
    async invoke(method, args) {
      const record = { method, args };
      invocations.push(record);
      if (method === 'list' && (typeof failList === 'function' ? failList() : failList)) throw new Error('boom');
      const result = await decl.invoke(ctx.panelId, method, args ?? []);
      record.result = result;
      return result;
    },
  };

  let mounted;
  async function mount(id) {
    const merged = { 'merged-outing': 'outing', 'merged-story': 'story', 'merged-journal': 'journal' };
    const panelId = merged[id] ?? id;
    ctx.panelId = panelId;
    root.replaceChildren();
    invocations.length = 0;
    const mount = merged[id] ? bundle.default.panels[panelId].mount : bundle.testMounts[id] ?? bundle.default.panels[id].mount;
    mounted = await mount(ctx);
    return root;
  }

  return { world, bundle, decl, mount, setNow: (value) => { now = value; }, refresh: () => mounted.refresh(), root, invocations, intervals: intervalBox.list, dataDir, tool: (n) => world.tools().find((t) => t.name === n).handler };
}

// ---------------------------------------------------------------------------

test('单文件验包会拒绝仍依赖相邻模块的源码入口', async () => {
  await assert.rejects(
    loadStandaloneWebUi(new URL('../webui/webui.js', import.meta.url)),
    { code: 'ERR_UNSUPPORTED_RESOLVE_REQUEST' },
  );
});

test('bundle 单文件加载：面板 id 与服务端声明一一对上，mount 都是函数', async () => {
  const b = await loadPanelClient();
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

test('故事手账移除作品区外层折叠，并保留唯一「更多故事」入口及内容', async () => {
  const { mount, root } = await mountPanels();
  await mount('merged-story');
  // 面板首屏是异步取数的：等折叠入口出现，别用固定次数的 tick 赌时序。
  const moreStories = await waitFor(() => {
    const found = [...root.querySelectorAll('details')]
      .filter((item) => item.querySelector('summary')?.textContent.trim() === '更多故事');
    return found.length ? found : null;
  }, '故事手账的「更多故事」折叠入口');
  assert.equal(moreStories.length, 1, '选项式故事只保留目录内的折叠入口');
  assert.ok(moreStories[0].querySelector('.sw-story-grid'), '折叠内的选项式故事卡仍渲染');
  assert.equal(root.querySelector('.fun-more-stories'), null, '作品区不再被「更多故事」折叠包裹');
  assert.equal(root.childNodes.length, 2, '自由故事区与作品区都直接呈现');
  assert.equal(root.childNodes[1].tagName, 'SECTION');
  assert.ok(root.childNodes[1].textContent.trim().length > 0, '作品与作者功能仍挂载');
});

test('服务端面板声明带 getMethods，且声明的方法真的能调', async () => {
  const { decl, tool } = await mountPanels();
  await tool('fun_go')({ place: '海洋馆' });
  await tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼挂件' });
  await tool('fun_home')({});
  const trip = (await decl.invoke('book', 'list', [])).trips[0];
  const storyList = await decl.invoke('stories', 'list', []);
  assert.equal(storyList.ok, true, storyList.error);
  assert.deepEqual(storyList.packs.filter(({ formatVersion }) => formatVersion < 3).map(({ id, builtin }) => [id, builtin]), [
    ['foldtide-reply-lite', true], ['drizzled-list', true], ['bridge-echo-solo', true], ['swapped-plaque-riddle', true],
  ], '新装附带四篇获批内置故事');
  const template = await decl.invoke('stories', 'template', []);
  assert.equal(template.ok, true, template.error);
  const authored = { ...JSON.parse(template.json), id: 'user-rpc-story' };
  assert.equal((await decl.invoke('stories', 'import', [{ json: JSON.stringify(authored) }])).ok, true);
  const builtin = authored;
  // 页签顺序：家 → 去哪儿 → 地点册 → 出游 → 纪念册 → 纪念品架 → 故事工坊。
  assert.deepEqual(decl.panels.map((p) => p.id), ['home', 'outing', 'story', 'journal']);
  for (const p of decl.panels) {
    assert.ok(p.title && p.description, `${p.id} 缺标题或说明`);
    assert.ok(Array.isArray(p.getMethods) && p.getMethods.length, `${p.id} 没声明 getMethods`);
    if (p.id === 'stories') {
      assert.deepEqual(p.getMethods, ['list', 'template', 'validate', 'preview', 'playtest', 'export']);
      assert.deepEqual(p.methods, ['import', 'rebind', 'enable', 'disable', 'remove']);
    }
    for (const m of p.getMethods) {
      let args = [];
      if (m === 'history') args = [{ placeId: 'aquarium' }];
      else if (m === 'trip') args = [{ id: trip.id }];
      else if ((p.id === 'story' && m === 'template') || m === 'authorTemplate') args = [{ placeId: builtin.placeId }];
      else if ((p.id === 'story' && m === 'validate') || m === 'authorValidate') args = [{ json: template.json }];
      else if ((p.id === 'story' && ['preview', 'playtest', 'export'].includes(m)) || ['authorPreview', 'authorPlaytest', 'authorExport'].includes(m)) args = [{ id: builtin.id }];
      const r = await decl.invoke(p.id, m, args);
      if (m === 'storyImageRead') assert.equal(r.ok, false, '未传图片 ID 时安全返回失败');
      else assert.equal(r.ok, true, `${p.id}.${m} 失败了：${r.error}`);
    }
  }
});

test('家：出门中只读显示，切姿势不改行程，也不写旧存档', async () => {
  const { decl, tool, dataDir } = await mountPanels();
  const stateFile = join(dataDir, 'fun', 'state.json');

  const idle = await decl.invoke('home', 'state', []);
  assert.equal(idle.ok, true, idle.error);
  assert.equal(idle.trip.mode, 'home');
  assert.equal(idle.activities.length, 10);
  assert.equal(idle.place, null, '没设住所时明确说没有，而不是编一个');
  // 固定 now 是 14:00 → 时段默认「读书」；room.json 里仍不写这个活动。
  assert.equal(idle.room.activity, 'reading');
  assert.equal(idle.room.source, 'default');
  // 没传角色图时给内置 Q 版立绘（不是 null）：面板据此画人，不留破图标。
  const art = await decl.invoke('home', 'art', [{ slot: 'character' }]);
  assert.equal(art.image.builtin, 'idle');
  assert.match(art.image.dataUrl, /^data:image\/webp;base64,/);

  await tool('fun_go')({ place: '海洋馆' });
  const before = await readFile(stateFile);
  const out = await decl.invoke('home', 'state', []);
  assert.equal(out.trip.mode, 'out');
  assert.equal(out.trip.placeName, '海洋馆');
  assert.ok(out.trip.total > 0, '出门中要能算出逛了几处');

  const switched = await decl.invoke('home', 'setActivity', [{ activity: 'reading', revision: out.revision }]);
  assert.equal(switched.ok, true, switched.error);
  assert.equal(switched.room.activity, 'reading');
  assert.equal(switched.room.source, 'panel', '点一下之后固定成 panel');
  assert.equal(switched.trip.mode, 'out', '在房间里换姿势不该影响出门状态');
  assert.deepEqual(await readFile(stateFile), before, '房间只写 fun/home，行程存档一个字节都不动');

  const stale = await decl.invoke('home', 'setActivity', [{ activity: 'gaming', revision: 0 }]);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'STALE_ROOM');
  const unknown = await decl.invoke('home', 'setActivity', [{ activity: 'flying', revision: switched.revision }]);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, 'INVALID_ACTIVITY');
});

async function mountStoriesView(decl, options = {}) {
  const bundle = await loadPanelClient();
  const root = new Node('div');
  const invocations = [];
  const ctx = { root, signal: { aborted: false }, ...options, async invoke(method, args = []) {
    const call = { method, args };
    invocations.push(call);
    call.result = await decl.invoke('stories', method, args);
    return call.result;
  } };
  const mounted = bundle.testMounts.stories(ctx);
  await waitFor(() => invocations.some((call) => call.method === 'list' && call.result), '故事包列表加载');
  return { root, invocations, mounted };
}

test('stories 校验与预览只读；畸形 JSON 和无效包可见且不保存', async () => {
  const { decl, dataDir, tool } = await mountPanels();
  await tool('fun_go')({ place: '公园' });
  await tool('fun_home')({});
  const stateBefore = await readFile(join(dataDir, 'fun', 'state.json'), 'utf8');
  const { root, invocations } = await mountStoriesView(decl);
  const initial = await decl.invoke('stories', 'list', []);
  const advanced = root.querySelector('.fun-story-advanced');
  const editor = advanced.querySelector('.fun-story-json');
  const location = advanced.querySelector('.fun-story-place');
  location.value = initial.places[0].id;
  root.findByText('填入模板').fire();
  await waitFor(() => editor.value.includes(initial.places[0].id), '模板填入 JSON');
  const template = JSON.parse(editor.value);
  const before = (await decl.invoke('stories', 'list', [])).packs.map((pack) => pack.id).sort();

  root.findByText('校验 JSON').fire();
  await waitFor(() => invocations.filter((call) => call.method === 'validate').length === 1, '校验请求');
  await waitFor(() => root.textContent.includes('校验通过'), '校验成功状态');
  root.findByText('预览草稿').fire();
  await waitFor(() => root.querySelector('.fun-story-graph'), '只读故事图');
  assert.deepEqual((await decl.invoke('stories', 'list', [])).packs.map((pack) => pack.id).sort(), before,
    '模板、校验、预览不应该保存故事包');
  assert.equal(template.placeId, initial.places[0].id, '模板应绑定选中的真实地点');

  editor.value = '{'; editor.fire('input');
  root.findByText('校验 JSON').fire();
  await waitFor(() => root.textContent.includes('JSON 格式不正确'), '畸形 JSON 错误');
  assert.deepEqual((await decl.invoke('stories', 'list', [])).packs.map((pack) => pack.id).sort(), before);

  editor.value = JSON.stringify({ version: 1, id: 'user-invalid', title: '', placeId: initial.places[0].id, start: 'start', nodes: [] });
  editor.fire('input');
  root.findByText('导入故事包').fire();
  await waitFor(() => root.textContent.includes('导入失败'), '无效包导入错误');
  assert.deepEqual((await decl.invoke('stories', 'list', [])).packs.map((pack) => pack.id).sort(), before,
    '无效包不得写入');
  assert.equal(await readFile(join(dataDir, 'fun', 'state.json'), 'utf8'), stateBefore, '校验预览不得推进真实行程或修改历史');
  assert.deepEqual(invocations.filter((call) => call.method === 'import').map((call) => call.result.ok), [false],
    '校验与预览没有偷偷 import；唯一导入是明确点击的无效包');
});

test('stories 简单表单支持自填地点，显式保存/停用/启用/确认移除', async () => {
  const { decl } = await mountPanels();
  const venue = await decl.invoke('places', 'save', [{ name: '自己的小院', areas: ['花圃', '廊下'] }]);
  assert.equal(venue.ok, true, venue.error);
  const { root, invocations } = await mountStoriesView(decl);
  const field = (name) => root.querySelector(`.fun-story-author-${name}`);
  assert.match(field('id').value, /^user-[a-z0-9_-]{1,19}$/);
  assert.equal(field('event').value, '', '简单表单的故事内容由用户自己填写');
  const customTemplatePlace = root.querySelector('.fun-story-place'); customTemplatePlace.value = venue.venue.id;
  root.findByText('填入模板').fire();
  await waitFor(() => root.querySelector('.fun-story-json').value.includes(venue.venue.id), '自填地点模板');
  assert.equal(JSON.parse(root.querySelector('.fun-story-json').value).placeId, venue.venue.id);
  const storyCard = (id) => root.querySelectorAll('.fun-story-pack').find((node) => node.getAttribute('data-pack-id') === id);
  const place = field('place'); place.value = venue.venue.id; place.fire('change');
  const area = field('area'); area.value = '花圃';
  const values = {
    id: 'user-garden-story', title: '院子里的小风', author: '本地作者', release: '1.0.0', genre: '日常', synopsis: '院子里的一个安静下午', event: '花叶间传来轻轻的沙沙声', prompt: '想怎么继续？',
    'a-label': '停下来听', 'a-result': '决定多听一会儿', 'a-event': '风慢慢停了', 'a-area': '花圃',
    'b-label': '去廊下看看', 'b-result': '决定走去廊下', 'b-event': '廊下挂着一串风铃', 'b-area': '廊下',
  };
  for (const [name, value] of Object.entries(values)) field(name).value = value;
  assert.ok([...place.querySelectorAll('option')].some((option) => option.value === venue.venue.id));
  assert.ok([...field('a-area').querySelectorAll('option')].some((option) => option.value === '廊下'), '自填地点的真实区域可选');
  assert.equal((await decl.invoke('stories', 'list', [])).packs.some((pack) => pack.id === values.id), false,
    '编辑表单本身不保存');

  root.findByText('保存新故事包').fire();
  await waitFor(() => storyCard(values.id), '保存自填地点故事');
  const card = storyCard(values.id);
  assert.match(card.textContent, /自己的小院/);
  assert.match(card.textContent, /3 个节点/);
  const exported = await decl.invoke('stories', 'export', [{ id: values.id }]);
  const saved = JSON.parse(exported.json);
  assert.equal(saved.placeId, venue.venue.id);
  assert.deepEqual(saved.nodes.map((node) => node.area), ['花圃', '花圃', '廊下']);
  assert.ok(invocations.some((call) => call.method === 'import'), '保存操作调用 import');

  card.findByText('停用').fire();
  await waitFor(() => storyCard(values.id)?.textContent.includes('已停用'), '停用故事');
  storyCard(values.id).findByText('启用').fire();
  await waitFor(() => storyCard(values.id)?.textContent.includes('已启用'), '重新启用故事');
  storyCard(values.id).findByText('移除').fire();
  assert.ok(root.textContent.includes('确认移除'), '移除前需要显式确认');
  root.findByText('确认移除').fire();
  await waitFor(() => !storyCard(values.id), '确认移除故事定义');
  assert.equal((await decl.invoke('stories', 'list', [])).packs.some((pack) => pack.id === values.id), false);
  assert.deepEqual(invocations.filter((call) => ['import', 'disable', 'enable', 'remove'].includes(call.method)).map((call) => call.method),
    ['import', 'disable', 'enable', 'remove']);
});


test('stories 高级 JSON 显式覆盖；导出只读并保留草稿，新装无内置包', async () => {
  const { decl } = await mountPanels();
  const { root, invocations } = await mountStoriesView(decl);
  const template = await decl.invoke('stories', 'template', []);
  const pack = { ...JSON.parse(template.json), id: 'user-json-story', title: '自己的故事' };
  const draft = root.querySelector('.fun-story-json');
  const overwrite = root.querySelector('.fun-story-overwrite');
  const card = () => root.querySelectorAll('.fun-story-pack').find((node) => node.getAttribute('data-pack-id') === pack.id);
  draft.value = JSON.stringify(pack); draft.fire('input');
  assert.equal(Boolean(overwrite.checked), false, '覆盖默认不勾选');
  root.findByText('导入故事包').fire();
  await waitFor(card, '导入 JSON 故事');
  pack.title = '更新自己的故事'; draft.value = JSON.stringify(pack); draft.fire('input');
  root.findByText('导入故事包').fire();
  await waitFor(() => root.textContent.includes('已有同 ID'), '拒绝默认覆盖');
  let exported = await decl.invoke('stories', 'export', [{ id: pack.id }]);
  assert.equal(JSON.parse(exported.json).title, '自己的故事');
  assert.equal(invocations.filter((call) => call.method === 'import').at(-1).args[0].replace, undefined);

  overwrite.checked = true;
  root.findByText('导入故事包').fire();
  await waitFor(() => card()?.textContent.includes(pack.title), '明确勾选后覆盖');
  assert.equal(invocations.filter((call) => call.method === 'import').at(-1).args[0].replace, true);
  assert.equal(overwrite.checked, false, '成功后取消覆盖勾选');
  const retained = draft.value;
  card().findByText('导出 JSON').fire();
  await waitFor(() => card().querySelector('.fun-story-export'), '只读导出 JSON');
  const output = card().querySelector('.fun-story-export');
  assert.equal(JSON.parse(output.value).title, pack.title);
  assert.notEqual(output.getAttribute('readonly'), undefined);
  assert.equal(draft.value, retained, '导出不替换编辑中的 JSON');
  const list = await decl.invoke('stories', 'list', []);
  assert.deepEqual(list.packs.filter((item) => !item.builtin).map((item) => item.id), [pack.id], '新装有四篇内置故事和这篇明确导入的作者故事');
  assert.ok(card().findByText('移除'));
});

test('地点编号对不上的故事包不会静默入库：导入当场拒收，可一次导入改绑，已入库的可 rebind', async () => {
  const { decl } = await mountPanels();
  const venue = await decl.invoke('places', 'save', [{ name: '温泉旅馆', areas: ['大厅', '汤池'] }]);
  assert.equal(venue.ok, true, venue.error);
  const elsewhere = await decl.invoke('places', 'save', [{ name: '旧书店', areas: ['书架间'] }]);
  assert.equal(elsewhere.ok, true, elsewhere.error);
  const template = await decl.invoke('stories', 'template', [{ placeId: venue.venue.id }]);
  const pack = { ...JSON.parse(template.json), id: 'winter-onsen', title: '温泉旅馆的一夜' };

  // 照「像预设的编号」写成下划线：地点册的 id 规则造不出这种编号，原来导入后会永久失效。
  pack.placeId = 'winter_onsen_inn';
  const rejected = await decl.invoke('stories', 'import', [{ json: JSON.stringify(pack) }]);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.placeMissing, true);
  assert.equal(rejected.placeId, 'winter_onsen_inn');
  assert.match(rejected.error, /在地点册里没有/);
  assert.equal((await decl.invoke('stories', 'list', [])).packs.some((item) => item.id === pack.id), false,
    '永远不触发的包不能留在库里');

  const checked = await decl.invoke('stories', 'validate', [{ json: JSON.stringify(pack) }]);
  assert.equal(checked.ok, true);
  assert.equal(checked.placeMissing, true, '校验阶段就要告诉面板地点缺失，面板才能当场摆出绑定');

  const bound = await decl.invoke('stories', 'import', [{ json: JSON.stringify(pack), bindPlaceId: venue.venue.id }]);
  assert.equal(bound.ok, true, bound.error);
  assert.equal(bound.placeId, venue.venue.id);
  const saved = JSON.parse((await decl.invoke('stories', 'export', [{ id: pack.id }])).json);
  assert.equal(saved.placeId, venue.venue.id, '落盘的是改绑后的地点编号');
  const listed = (await decl.invoke('stories', 'list', [])).packs.find((item) => item.id === pack.id);
  assert.equal(listed.available, true);
  assert.equal(listed.placeMissing, false);
  assert.equal(listed.placeId, venue.venue.id);

  // 已入库的包可以改绑到另一处；区域对不上要如实给警告，而不是假装可用。
  const moved = await decl.invoke('stories', 'rebind', [{ id: pack.id, placeId: elsewhere.venue.id }]);
  assert.equal(moved.ok, true, moved.error);
  assert.equal(moved.available, false);
  assert.ok(moved.warnings.some((warning) => warning.includes('大厅')), '缺的区域要如实说出来');
  const after = JSON.parse((await decl.invoke('stories', 'export', [{ id: pack.id }])).json);
  assert.equal(after.placeId, elsewhere.venue.id);
  assert.notEqual(moved.revision, listed.revision, '改绑会重算 revision，旧进度按规矩暂停');

  const missingTarget = await decl.invoke('stories', 'rebind', [{ id: pack.id, placeId: 'user-gone' }]);
  assert.equal(missingTarget.ok, false);
  assert.match(missingTarget.error, /已经不在地点册/);

  // 同一套操作也从「出游」面板的作者区走（那里嵌的就是故事工坊）：映射漏一版会静默变成 list。
  const viaOuting = await decl.invoke('story', 'authorRebind', [{ id: pack.id, placeId: venue.venue.id }]);
  assert.equal(viaOuting.ok, true, viaOuting.error);
  assert.equal(JSON.parse((await decl.invoke('stories', 'export', [{ id: pack.id }])).json).placeId, venue.venue.id);
});

const storyViewData = () => ({ ok: true, packs: [{ id: 'user-offline', title: '暂存故事', description: '留待地点恢复', placeId: 'user-gone', placeName: '',
  enabled: true, builtin: false, available: false, warnings: ['地点已移除；区域「木桥」不可用'], revision: 'rev-1', nodeCount: 1 }],
  places: [{ id: 'user-yard', name: '自己的院子', areas: ['树下', '门口'] }], warnings: [] });

test('stories 列表 ok:false 可重试；缺失地点或区域标暂不可用且给出原因', async () => {
  let ready = false;
  const { root, invocations, mounted } = await mountStoriesView({ invoke: async () => ready ? storyViewData() : { ok: false, error: '故事文件暂不可读' } });
  assert.ok(root.textContent.includes('故事文件暂不可读'));
  const draft = root.querySelector('.fun-story-json'); draft.value = '尚未完成的草稿'; draft.focus();
  ready = true; root.findByText('重试').fire();
  await waitFor(() => root.querySelector('.fun-story-pack'), '重试加载故事');
  assert.match(root.querySelector('.fun-story-pack').textContent, /暂不可用.*地点已移除/);
  assert.equal(root.querySelector('.fun-story-json'), draft);
  assert.equal(draft.value, '尚未完成的草稿'); assert.equal(document.activeElement, draft);
  await mounted.refresh();
  assert.equal(root.querySelector('.fun-story-json'), draft);
  assert.deepEqual(invocations.map((call) => call.method), ['list', 'list', 'list']);
});

test('stories 地点编号对不上时，导入处与作品卡都能就地改绑', async () => {
  const data = storyViewData();
  Object.assign(data.packs[0], {
    placeId: 'winter_onsen_inn', placeName: '', placeMissing: true, available: false,
    warnings: ['这处地点「winter_onsen_inn」在地点册里没有。先新建它，或把故事包绑到已有地点。'],
  });
  const calls = [];
  const { root } = await mountStoriesView({ invoke: async (_panel, method, args) => {
    calls.push({ method, args });
    if (method === 'list') return data;
    if (method === 'import') return { ok: false, placeMissing: true, placeId: 'winter_onsen_inn',
      error: '这个包绑定的地点「winter_onsen_inn」在地点册里没有。先在地点册新建这处，或导入时把它绑到已有地点。' };
    if (method === 'rebind') return { ok: true, id: 'user-offline', placeId: args[0].placeId, message: '已把「暂存故事」绑到「自己的院子」。' };
    return { ok: true };
  } });

  // 作品卡：说清包里写的编号，并给出同页改绑。（导入区的空壳先出现在 DOM 里，按类名排掉）
  const bind = root.findAll((node) => node.classList.contains('fun-story-bind') && !node.classList.contains('fun-story-bind-import'))[0];
  assert.match(bind.textContent, /winter_onsen_inn/);
  const select = bind.querySelector('select');
  assert.ok([...select.querySelectorAll('option')].some((option) => option.value === 'user-yard'));
  select.value = 'user-yard'; select.fire('change');
  bind.findByText('绑定到此处').fire();
  await waitFor(() => calls.some((call) => call.method === 'rebind'), '改绑请求');
  assert.deepEqual(calls.find((call) => call.method === 'rebind').args, [{ id: 'user-offline', placeId: 'user-yard' }]);
  await waitFor(() => root.findByText('导入故事包').getAttribute('aria-disabled') !== 'true', '改绑请求收尾');

  // 导入：包被拒后原地给出绑定下拉；选好再点一次导入，请求里带上 bindPlaceId。
  const draft = root.querySelector('.fun-story-json');
  draft.value = '{"id":"winter-onsen"}'; draft.fire('input');
  root.findByText('导入故事包').fire();
  await waitFor(() => root.querySelector('.fun-story-bind-import')?.hidden === false, '导入失败后出现改绑下拉');
  const importSelect = root.querySelector('.fun-story-bind-import').querySelector('select');
  importSelect.value = 'user-yard'; importSelect.fire('change');
  root.findByText('导入故事包').fire();
  await waitFor(() => calls.filter((call) => call.method === 'import').length === 2, '第二次导入');
  assert.equal(calls.filter((call) => call.method === 'import')[1].args[0].bindPlaceId, 'user-yard');
});

test('stories pending 与刷新保留同一 textarea、光标内容；节点只按文本显示', async () => {
  let resolveTemplate;
  let templateCalls = 0;
  const { root, invocations, mounted } = await mountStoriesView({ invoke: async (_panel, method, args) => {
    if (method === 'list') return storyViewData();
    if (method === 'template') { templateCalls += 1; assert.deepEqual(args, [{ placeId: 'user-yard' }]); return new Promise((resolve) => { resolveTemplate = resolve; }); }
    if (method === 'preview') return { ok: true, eligible: false, title: '预览', nodes: [{ id: 'only', area: '树下', event: '<img src=x onerror=alert(1)>', when: {}, next: '', choices: [{ id: 'a', label: '看一看', next: 'end' }] }], warnings: [] };
    throw new Error('Unexpected ' + method);
  } });
  const place = root.querySelector('.fun-story-place'); place.value = 'user-yard';
  const draft = root.querySelector('.fun-story-json'); draft.value = '最初草稿'; draft.focus();
  root.findByText('填入模板').fire(); root.findByText('填入模板').fire();
  assert.equal(templateCalls, 1, 'pending 按钮不能重复提交');
  draft.value = '请求期间继续写的内容'; draft.selectionStart = 3; draft.selectionEnd = 5; draft.fire('input');
  await mounted.refresh();
  assert.equal(root.querySelector('.fun-story-json'), draft);
  assert.equal(draft.value, '请求期间继续写的内容');
  assert.equal(draft.selectionStart, 3); assert.equal(draft.selectionEnd, 5);
  resolveTemplate({ ok: true, json: '{"template":true}' });
  await waitFor(() => root.textContent.includes('草稿已修改'), '模板响应保留新草稿');
  assert.equal(draft.value, '请求期间继续写的内容'); assert.equal(document.activeElement, draft);
  root.findByText('预览草稿').fire();
  await waitFor(() => root.querySelector('.fun-story-graph'), '纯文本节点图');
  assert.match(root.querySelector('.fun-story-graph').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(root.querySelector('.fun-story-graph').querySelector('img'), null);
  assert.equal(root.querySelector('.fun-story-graph').querySelectorAll('button').length, 0, '图中分支是说明文字而非游戏选择按钮');
  assert.deepEqual(invocations.map((call) => call.method), ['list', 'template', 'list', 'preview']);
});

test('R3 作者默认收起、按 World 记忆、输入后收起保留 dirty 与同一控件', async () => {
  const previousStorage = globalThis.localStorage;
  const entries = new Map();
  globalThis.localStorage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  try {
    const decl = { invoke: async () => ({ ...storyViewData(), packs: [] }) };
    const first = await mountStoriesView(decl, { pageId: 'world:author-a' });
    const toggle = first.root.querySelector('.fun-story-editor-toggle');
    const content = first.root.querySelector('.fun-story-author-content');
    assert.equal(toggle.tagName, 'BUTTON', '原生button支持Enter/空格，且可以键盘聚焦');
    assert.equal(toggle.getAttribute('type'), 'button');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(toggle.getAttribute('aria-controls'), content.getAttribute('id'));
    assert.equal(content.hidden, true);
    assert.match(first.root.textContent, /还没有故事.*点「编写故事」写第一篇/s);
    toggle.fire(); assert.equal(content.hidden, false);
    const title = first.root.querySelector('.fun-story-author-title');
    title.value = '尚未保存的表单'; title.fire('input');
    const json = first.root.querySelector('.fun-story-json');
    json.value = '{"unfinished":true}'; json.fire('input');
    toggle.fire();
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(first.root.querySelector('.fun-story-dirty').textContent, '有未保存修改');
    await first.mounted.refresh();
    assert.equal(first.root.querySelector('.fun-story-author-title'), title);
    assert.equal(title.value, '尚未保存的表单');
    assert.equal(first.root.querySelector('.fun-story-json'), json);
    assert.equal(json.value, '{"unfinished":true}');
    toggle.fire();
    const reopened = await mountStoriesView(decl, { pageId: 'world:author-a' });
    assert.equal(reopened.root.querySelector('.fun-story-editor-toggle').getAttribute('aria-expanded'), 'true');
    const otherWorld = await mountStoriesView(decl, { pageId: 'world:author-b' });
    assert.equal(otherWorld.root.querySelector('.fun-story-editor-toggle').getAttribute('aria-expanded'), 'false');
    assert.ok([...entries.values()].every((value) => ['expanded', 'collapsed'].includes(value)), 'localStorage只写折叠偏好');
    const css = first.root.querySelector('style').textContent;
    assert.match(css, /minmax\(min\(160px,100%\),1fr\)/);
    assert.match(css, /min-width:0;max-width:100%/);
  } finally { globalThis.localStorage = previousStorage; }
});

test('R3 列表编辑导出完整复杂 JSON、自动展开滚动，并保留每份未保存草稿', async () => {
  const data = storyViewData();
  data.packs.push({ ...data.packs[0], id: 'user-second', title: '另一篇故事' });
  const complex = { version: 2, id: 'user-offline', title: '复杂故事', placeId: 'user-yard', start: 'first',
    metadata: { author: '作者', custom: { tags: ['保留'] } }, flags: { opened: false },
    nodes: [{ id: 'first', when: { flags: { opened: false } }, effects: { flags: { opened: true } }, choices: [{ id: 'a', next: 'loop' }] }, { id: 'loop', next: 'first' }] };
  const exported = (id) => JSON.stringify({ ...complex, id }, null, 2);
  const scrolled = [];
  const priorScroll = Node.prototype.scrollIntoView;
  Node.prototype.scrollIntoView = function (options) { scrolled.push({ node: this, options }); };
  try {
    const { root, invocations } = await mountStoriesView({ invoke: async (_panel, method, args) => {
      if (method === 'list') return data;
      if (method === 'export') return { ok: true, json: exported(args[0].id) };
      return { ok: false, error: '预演测试失败' };
    } });
    const draft = root.querySelector('.fun-story-json');
    const formTitle = root.querySelector('.fun-story-author-title'); formTitle.value = '自己的新表单'; formTitle.fire('input');
    draft.value = '{"newDraft":"保留"}'; draft.fire('input');
    const card = (id) => root.querySelectorAll('.fun-story-pack').find((node) => node.getAttribute('data-pack-id') === id);
    card('user-offline').findByText('编辑').fire();
    await waitFor(() => draft.value === exported('user-offline'), '复杂故事完整加载');
    assert.deepEqual(JSON.parse(draft.value), complex);
    assert.equal(root.querySelector('.fun-story-editor-toggle').getAttribute('aria-expanded'), 'true');
    assert.equal(root.querySelector('.fun-story-json-pane').hidden, false, '编辑故事要切到「从文件导入」那个起点');
    assert.equal(root.querySelector('.fun-story-overwrite').checked, true);
    assert.equal(document.activeElement, draft);
    assert.ok(scrolled.some(({ node }) => node.className.includes('fun-story-authoring')));
    draft.value = draft.value.replace('复杂故事', '尚未保存的修改'); draft.fire('input');
    const edited = draft.value;
    card('user-second').findByText('编辑').fire();
    await waitFor(() => draft.value === exported('user-second'), '切换其他故事');
    formTitle.value = ''; formTitle.fire('input');
    assert.equal(root.querySelector('.fun-story-dirty').textContent, '有未保存修改', '标题也提示暂存在其他故事中的未保存草稿');
    formTitle.value = '自己的新表单'; formTitle.fire('input');
    card('user-offline').findByText('编辑').fire();
    await waitFor(() => draft.value === edited, '恢复编辑草稿');
    root.findByText('预览草稿').fire();
    await waitFor(() => root.textContent.includes('预演测试失败'), '预览失败仍保留草稿');
    assert.equal(draft.value, edited);
    root.findByText('新建 JSON 草稿').fire();
    assert.equal(draft.value, '{"newDraft":"保留"}');
    assert.equal(formTitle.value, '自己的新表单');
    assert.ok(invocations.some((call) => call.method === 'export'));
  } finally { Node.prototype.scrollIntoView = priorScroll; }
});

test('R3 保存期间继续编辑、保存失败与读取编辑失败均不清空 JSON 或 dirty', async () => {
  let finish;
  let fail = false;
  const { root } = await mountStoriesView({ invoke: async (_panel, method) => {
    if (method === 'list') return storyViewData();
    if (method === 'import') return fail ? { ok: false, error: '保存测试失败' } : new Promise((resolve) => { finish = resolve; });
    if (method === 'export') throw new Error('读取测试失败');
  } });
  const draft = root.querySelector('.fun-story-json'); draft.value = '{"submitted":1}'; draft.fire('input');
  root.findByText('导入故事包').fire();
  draft.value = '{"newer":2}'; draft.fire('input');
  finish({ ok: true, id: 'user-offline' });
  await waitFor(() => root.textContent.includes('已导入'), '提交成功');
  assert.equal(draft.value, '{"newer":2}');
  assert.equal(root.querySelector('.fun-story-dirty').textContent, '有未保存修改');
  fail = true; root.findByText('导入故事包').fire();
  await waitFor(() => root.textContent.includes('保存测试失败'), '保存失败');
  root.querySelector('.fun-story-pack').findByText('编辑').fire();
  await waitFor(() => root.textContent.includes('读取测试失败'), '编辑读取失败');
  assert.equal(draft.value, '{"newer":2}');
  assert.equal(root.querySelector('.fun-story-dirty').textContent, '有未保存修改');
});

test('R3 故事工坊：三个起点都在、右栏已移除，窄屏同一组按钮可达', async () => {
  const { root } = await mountStoriesView({ invoke: async () => ({ ...storyViewData(), packs: [] }) });
  assert.equal(root.querySelector('.fun-story-rail'), null, '右侧「从一个小片段开始」已移除');
  assert.deepEqual(root.querySelectorAll('.fun-story-mode-tab').map((node) => node.textContent),
    ['选项式故事', '自由场景包', '从文件导入']);
  const content = root.querySelector('.fun-story-author-content');
  assert.equal(content.hidden, true, '默认收起');
  root.findByText('＋ 编写故事').fire();
  assert.equal(content.hidden, false);
  assert.equal(root.querySelector('.fun-story-simple').hidden, false, '默认停在选项式');
  assert.equal(root.querySelector('.fun-story-json-pane').hidden, true);
  root.findByText('从文件导入').fire();
  assert.equal(root.querySelector('.fun-story-json-pane').hidden, false);
  assert.equal(root.querySelector('.fun-story-simple').hidden, true, '同一时间只显示一个起点');
  root.findByText('自由场景包').fire();
  assert.equal(root.querySelector('.fun-story-json-pane').hidden, true);
  assert.equal(root.querySelector('.fun-story-simple').hidden, true);
});

test('R3 从文件导入：读进草稿；超 32 KB 与坏 JSON 不覆盖原内容', async () => {
  const { root } = await mountStoriesView({ invoke: async () => ({ ...storyViewData(), packs: [] }) });
  root.findByText('＋ 编写故事').fire();
  root.findByText('从文件导入').fire();
  const input = root.querySelector('.fun-story-json-file');
  const draft = root.querySelector('.fun-story-json');
  draft.value = '{"keep":true}'; draft.fire('input');
  const pick = (text, size) => ({ name: 'story.json', size: size ?? text.length, text: async () => text });
  input.files = [pick('\uFEFF{"version":2,"id":"user-a"}')];
  input.fire('change');
  await waitFor(() => draft.value === '{"version":2,"id":"user-a"}', '文件读进草稿');
  assert.match(root.textContent, /已选 story\.json/);
  input.files = [pick('{"bad":', 20)];
  input.fire('change');
  await waitFor(() => root.textContent.includes('不是有效的 JSON'), '坏 JSON 提示');
  assert.equal(draft.value, '{"version":2,"id":"user-a"}', '坏文件不清空原草稿');
  input.files = [pick('{}', 33 * 1024)];
  input.fire('change');
  await waitFor(() => root.textContent.includes('超过 32 KB'), '超限提示');
  assert.equal(draft.value, '{"version":2,"id":"user-a"}', '超限不清空原草稿');
});

test('R3 英文新增作者文案与存储不可用回退', async () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
  try {
    const { root } = await mountStoriesView({ invoke: async () => ({ ...storyViewData(), packs: [] }) }, { language: 'en' });
    assert.match(root.textContent, /No stories yet/);
    const toggle = root.querySelector('.fun-story-editor-toggle'); assert.equal(toggle.textContent, 'Expand'); toggle.fire();
    const title = root.querySelector('.fun-story-author-title'); title.value = 'Draft'; title.fire('input');
    toggle.fire(); assert.equal(root.querySelector('.fun-story-dirty').textContent, 'Unsaved changes');
    assert.equal(toggle.textContent, 'Expand');
  } finally { globalThis.localStorage = previousStorage; }
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

test('places 面板：快捷筛选单选，并与当前搜索取交集', async () => {
  const { mount, decl } = await mountPanels();
  const saved = await decl.invoke('places', 'save', [{ name: '我的小院', areas: ['藤椅'] }]);
  assert.equal(saved.ok, true, saved.error);
  const root = await mount('places');
  const names = () => root.querySelectorAll('.fun-card-name').map((n) => n.textContent);
  await waitFor(() => names().length === VENUES.length + 1, '默认展示全部地点');

  const allNames = names();
  const click = (label) => {
    const button = root.findByText(label);
    assert.ok(button, `缺少「${label}」快捷筛选`);
    button.fire();
  };
  click('现在开着');
  assert.ok(names().includes('海洋馆'));
  assert.ok(!names().includes('夜市'), '14:00 尚未开门');
  click('室内');
  assert.ok(names().includes('海洋馆'));
  assert.ok(!names().includes('公园'));
  click('户外');
  assert.ok(names().includes('公园'), '切换户外后撤销室内条件');
  assert.ok(!names().includes('海洋馆'));
  click('夜游');
  assert.ok(names().includes('夜市'), '夜游不叠加先前的营业状态条件');
  assert.ok(!names().includes('海洋馆'));
  click('我的地点');
  assert.deepEqual(names(), ['我的小院']);

  const input = root.querySelector('.fun-search');
  input.value = '海洋馆';
  input.fire('input');
  assert.deepEqual(names(), [], '搜索不能绕过当前筛选');
  click('全部');
  assert.deepEqual(names(), ['海洋馆'], '切换筛选应保留搜索词');
  const currentInput = root.querySelector('.fun-search');
  currentInput.value = '';
  currentInput.fire('input');
  assert.deepEqual(names(), allNames);
});

test('places 面板：初次加载失败时可以重试', async () => {
  let fail = true;
  const { mount } = await mountPanels({ failList: () => fail });
  const root = await mount('places');
  const error = await waitFor(() => root.querySelector('.fun-err'), '出错误卡');
  assert.match(error.textContent, /boom/);
  fail = false;
  error.findByText('重试').fire();
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length, '重试后画出地点');
  assert.equal(root.querySelector('.fun-err'), null);
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
  // 先去一趟并回家
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

test('places 面板：去哪儿只负责看与出发，编辑和添加入口都收进地点册', async () => {
  const { mount, world } = await mountPanels();
  await world.webUi('zh').invoke('places', 'save', [{ name: '我的小院', areas: ['藤椅'] }]);
  const root = await mount('places');
  await waitFor(() => root.querySelectorAll('.fun-card').length === VENUES.length + 1, '画出全部');
  assert.equal(root.findByText('＋ 添加地点'), null, '去哪儿不再有添加入口');
  const card = root.querySelectorAll('.fun-card')
    .find((c) => c.querySelector('.fun-card-name').textContent === '我的小院');
  card.fire('click');
  await waitFor(() => root.querySelector('.fun-detail'), '展开详情');
  assert.equal(root.querySelector('.fun-detail-edit'), null, '去哪儿不再有编辑按钮');
  assert.ok(root.querySelector('.fun-detail').textContent.includes('地点册'), '详情要把人指到地点册');
  assert.ok(root.querySelector('.fun-management').textContent.includes('地点册'), '管理说明也要指到地点册');
});

/** 地点册里按名字找一张卡。 */
const locationTile = (root, name) => root.querySelectorAll('.fpl-tile')
  .find((tile) => tile.textContent.startsWith(name));

async function openLocationEditor(root, name) {
  // 保存后会停在详情页；再编辑同一处（或别的）先回到列表。
  const back = root.findByText('返回浏览');
  if (back) back.fire('click');
  const tile = await waitFor(() => locationTile(root, name), `画出「${name}」`);
  tile.fire('click');
  // 列表行上也有「编辑地点」，先等详情页出现（返回浏览 只在详情里），别点成别的行。
  await waitFor(() => root.findByText('返回浏览'), `「${name}」详情`);
  const edit = await waitFor(() => root.findByText('编辑地点'), `「${name}」的编辑入口`);
  edit.fire('click');
  return waitFor(() => root.querySelector('form'), '地点编辑表单');
}

test('地点册：能添加地点并填全部场所字段，填了「能逛的」就是可玩场所', async () => {
  const { mount, decl, invocations } = await mountPanels();
  const root = await mount('locations');
  await waitFor(() => root.querySelectorAll('.fpl-tile').length === VENUES.length, '画出地点');
  assert.ok(root.findByText('添加地点'), '地点册要有添加入口');
  root.findByText('添加地点').fire('click');
  const form = await waitFor(() => root.querySelector('form'), '添加表单');
  const inputs = form.querySelectorAll('input');
  inputs[0].value = '我的小院';
  const hours = inputs.filter((input) => input.placeholder === 'HH:MM');
  hours[0].value = '08:00';
  hours[1].value = '20:00';
  const textareas = form.querySelectorAll('textarea');
  textareas.find((t) => String(t.placeholder).includes('至少一处')).value = '藤椅\n花架';
  textareas.find((t) => t.placeholder === '一行一样').value = '一片叶子';
  textareas.find((t) => t.placeholder === '一行一处').value = '门口';
  textareas.find((t) => String(t.placeholder).includes('品类名')).value = '柠檬水';
  const selects = form.querySelectorAll('select');
  selects.find((s) => s.querySelectorAll('option').some((o) => o.value === 'quiet')).value = 'quiet';
  selects.find((s) => s.querySelectorAll('option').some((o) => o.value === '喝')).value = '喝';
  form.fire('submit', { preventDefault() {} });
  const saved = await waitFor(() => invocations.find((call) => call.method === 'create')?.result, 'create 回执');
  assert.equal(saved.ok, true, saved.error);
  await waitFor(() => root.textContent.includes('我的小院'), '保存后进详情');

  const place = (await decl.invoke('locations', 'list', [])).places.find((item) => item.name === '我的小院');
  assert.equal(place.playable, true);
  assert.deepEqual(place.areas, ['藤椅', '花架']);
  assert.deepEqual(place.hours, { open: '08:00', close: '20:00' });
  assert.equal(place.crowd, 'quiet');
  assert.deepEqual(place.souvenirs, ['一片叶子']);
  assert.deepEqual(place.photoSpots, ['门口']);
  assert.ok(place.food && place.food.verb === '喝' && place.food.items.includes('柠檬水'));
  const going = await decl.invoke('places', 'list', []);
  assert.ok(going.places.some((item) => item.name === '我的小院'), '可玩场所要出现在去哪儿');
});

test('地点册：改预设存成覆盖层，能单处恢复，设置里能全部恢复', async () => {
  const { mount, decl, invocations, refresh } = await mountPanels();
  const root = await mount('locations');
  await waitFor(() => root.querySelectorAll('.fpl-tile').length === VENUES.length, '画出地点');
  const form = await openLocationEditor(root, '漫展');
  assert.ok(form.textContent.includes('预设地点'), '要说明改的是预设');
  assert.ok(form.textContent.includes('覆盖层'), '要说明落的是覆盖层');
  form.querySelectorAll('textarea').find((t) => t.placeholder === '一行一样').value = '自己写的吧唧';
  form.fire('submit', { preventDefault() {} });
  const updated = await waitFor(() => invocations.find((call) => call.method === 'update')?.result, 'update 回执');
  assert.equal(updated.ok, true, updated.error);
  let con = (await decl.invoke('locations', 'list', [])).places.find((item) => item.id === 'con');
  assert.ok(con.souvenirs.includes('自己写的吧唧'));
  assert.equal(con.overridden, true);
  assert.ok(root.textContent.includes('改过预设'));

  // 单处恢复
  (await waitFor(() => root.findByText('恢复预设'), '恢复预设按钮')).fire('click');
  (await waitFor(() => root.findByText('确认恢复预设'), '确认恢复')).fire('click');
  await waitFor(() => invocations.find((call) => call.method === 'reset')?.result, 'reset 回执');
  con = (await decl.invoke('locations', 'list', [])).places.find((item) => item.id === 'con');
  assert.equal(con.overridden, false);
  assert.ok(!con.souvenirs.includes('自己写的吧唧'));

  // 再改一处，然后从设置里全部恢复
  const revision = (await decl.invoke('locations', 'list', [])).revision;
  assert.equal((await decl.invoke('locations', 'update', [{ id: 'con', revision,
    patch: { venue: { souvenirs: ['第二版'] } } }])).ok, true);
  await waitFor(() => root.childNodes[0]?.getAttribute('aria-busy') === 'false', '地点册空闲');
  await refresh();
  root.findByText('住所与默认画风').fire('click');
  const resetAll = await waitFor(() => root.findAll((node) => node.tagName === 'BUTTON'
    && node.textContent.startsWith('恢复全部预设'))[0], '恢复全部预设按钮');
  resetAll.fire('click');
  (await waitFor(() => root.findByText('确认恢复全部预设（1 处）'), '确认恢复全部')).fire('click');
  await waitFor(() => invocations.find((call) => call.method === 'resetAll')?.result, 'resetAll 回执');
  const after = (await decl.invoke('places', 'list', [])).overriddenCount;
  assert.equal(after, 0, '恢复之后覆盖层清空');
});

test('地点册：改预设通用描写与可逛清单不动时段，去哪儿仍按此刻阶段显示', async () => {
  const { mount, decl, invocations } = await mountPanels();
  const river = VENUES.find((venue) => venue.id === 'riverside');
  const root = await mount('locations');
  await waitFor(() => root.querySelectorAll('.fpl-tile').length === VENUES.length, '画出地点');
  const form = await openLocationEditor(root, '江边');
  const textareas = form.querySelectorAll('textarea');
  textareas[0].value = '通用江边：新铺的步道与白栏杆。';
  textareas.find((t) => String(t.placeholder).includes('至少一处')).value = '新步道\n新长椅';
  form.fire('submit', { preventDefault() {} });
  const updated = await waitFor(() => invocations.find((call) => call.method === 'update')?.result, 'update 回执');
  assert.equal(updated.ok, true, updated.error);

  const saved = (await decl.invoke('locations', 'list', [])).places.find((item) => item.id === 'riverside');
  assert.equal(saved.desc, '通用江边：新铺的步道与白栏杆。');
  assert.deepEqual(saved.areas, ['新步道', '新长椅']);

  const going = (await decl.invoke('places', 'list', [])).places.find((item) => item.id === 'riverside');
  assert.equal(going.descAll, '通用江边：新铺的步道与白栏杆。');
  assert.equal(going.phases.length, river.phases.length, '保存通用字段保留预设时段边界');
  const day = river.phases.find((phase) => phase.label === '白天');
  assert.equal(going.phase, '白天');
  assert.equal(going.desc, day.desc, '当前时段仍用预设的阶段描写');
  assert.deepEqual(going.areas, day.areas, '当前时段仍用预设的阶段可逛清单');
});

test('地点册：不可玩地点填了「能逛的」就变成可玩场所，清空又退回', async () => {
  const { mount, decl, invocations } = await mountPanels();
  const revision0 = (await decl.invoke('locations', 'list', [])).revision;
  const made = await decl.invoke('locations', 'create', [{ revision: revision0, input: { name: '巷口' } }]);
  assert.equal(made.ok, true, made.error);
  const id = made.place.id;
  assert.equal((await decl.invoke('locations', 'list', [])).places.find((item) => item.id === id).playable, false);
  assert.ok(!(await decl.invoke('places', 'list', [])).places.some((item) => item.id === id), '不可玩不进去哪儿');

  const root = await mount('locations');
  await waitFor(() => root.querySelectorAll('.fpl-tile').length === VENUES.length + 1, '画出地点');
  let form = await openLocationEditor(root, '巷口');
  form.querySelectorAll('textarea').find((t) => String(t.placeholder).includes('至少一处')).value = '石阶';
  form.fire('submit', { preventDefault() {} });
  await waitFor(() => invocations.find((call) => call.method === 'update')?.result, 'update 回执');
  assert.equal((await decl.invoke('locations', 'list', [])).places.find((item) => item.id === id).playable, true);
  assert.ok((await decl.invoke('places', 'list', [])).places.some((item) => item.id === id), '填了能逛的就进哪儿');

  form = await openLocationEditor(root, '巷口');
  form.querySelectorAll('textarea').find((t) => String(t.placeholder).includes('至少一处')).value = '';
  form.fire('submit', { preventDefault() {} });
  await waitFor(() => invocations.filter((call) => call.method === 'update').length >= 2, '第二次 update');
  assert.equal((await decl.invoke('locations', 'list', [])).places.find((item) => item.id === id).playable, false);
  assert.ok(!(await decl.invoke('places', 'list', [])).places.some((item) => item.id === id), '清空就退回不可玩');
});

test('地点册：自己加的地点能删（可玩也行），预设只给恢复', async () => {
  const { mount, decl, invocations } = await mountPanels();
  const revision0 = (await decl.invoke('locations', 'list', [])).revision;
  const plain = await decl.invoke('locations', 'create', [{ revision: revision0, input: { name: '要删的点' } }]);
  const revision1 = (await decl.invoke('locations', 'list', [])).revision;
  const yard = await decl.invoke('locations', 'create', [{ revision: revision1, input: { name: '要删的院', areas: ['院子'] } }]);
  assert.equal(plain.ok, true, plain.error);
  assert.equal(yard.ok, true, yard.error);

  const root = await mount('locations');
  await waitFor(() => root.querySelectorAll('.fpl-tile').length === VENUES.length + 2, '画出地点');
  (await waitFor(() => locationTile(root, '要删的点'), '要删的点')).fire('click');
  (await waitFor(() => root.findByText('删除这处'), '删除按钮')).fire('click');
  (await waitFor(() => root.findByText('确认删除这处'), '确认删除')).fire('click');
  await waitFor(() => invocations.find((call) => call.method === 'remove')?.result, 'remove 回执');
  assert.ok(!(await decl.invoke('locations', 'list', [])).places.some((item) => item.id === plain.place.id));

  // 可玩的自建地点也能删（带默认画风/封面等 extras 一起清）
  const revision = (await decl.invoke('locations', 'list', [])).revision;
  const removed = await decl.invoke('locations', 'remove', [{ id: yard.place.id, revision }]);
  assert.equal(removed.ok, true, removed.error);
  assert.ok(!(await decl.invoke('locations', 'list', [])).places.some((item) => item.id === yard.place.id));

  // 预设删不掉，只能恢复
  const presetRevision = (await decl.invoke('locations', 'list', [])).revision;
  const preset = await decl.invoke('locations', 'remove', [{ id: 'con', revision: presetRevision }]);
  assert.equal(preset.ok, false);
  assert.match(preset.error, /预设/);
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
  trip.findByText('查看详情').fire();
  assert.ok(root.querySelector('.fun-trip').textContent.includes('scene：水族馆'), '有场景的要在行程详情里标出 scene');

  // 统计条
  const stats = root.querySelector('.fun-stats');
  assert.ok(stats.textContent.includes('1'), '趟数应当是 1');
});

test('book 面板：行程卡可展开完整事件和回家备注，再收起', async () => {
  const { mount, decl, tool } = await mountPanels({ random: () => 0 });
  await tool('fun_go')({ place: '海洋馆' });
  await tool('fun_wander')({ area: '海底隧道' });
  await tool('fun_wander')({ area: '触摸池' });
  await tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼挂件' });
  await tool('fun_home')({ note: '穿过最后一段蓝光再回家' });

  const { trips: [trip] } = await decl.invoke('book', 'list', []);
  assert.ok(trip.events.length > 2, '夹具需要超过摘要截取的两条事件');
  assert.deepEqual(trip.choices, []);
  const root = await mount('book');
  const card = () => root.querySelector('.fun-trip');
  const open = await waitFor(() => card()?.findByText('查看详情'), '查看详情按钮');
  const lastEvent = trip.events.at(-1);
  assert.equal(open.getAttribute('aria-expanded'), 'false');
  assert.ok(!card().textContent.includes(lastEvent));
  assert.ok(!card().textContent.includes(trip.note));
  open.fire();

  const close = await waitFor(() => card()?.findByText('收起详情'), '收起详情按钮');
  assert.equal(close.getAttribute('aria-expanded'), 'true');
  for (const text of [...trip.events, ...trip.visited, ...trip.souvenirs, trip.note]) {
    assert.ok(card().textContent.includes(text), `行程详情缺少 ${text}`);
  }
  close.fire();
  assert.equal(card().findByText('查看详情').getAttribute('aria-expanded'), 'false');
  assert.ok(!card().textContent.includes(lastEvent));
  assert.ok(!card().textContent.includes(trip.note));
});

test('book 面板：珍藏页仅显示珍藏行程，切回全部行程能恢复列表', async () => {
  const { mount, decl, tool } = await mountPanels();
  for (const place of ['漫展', '海洋馆']) {
    await tool('fun_go')({ place });
    await tool('fun_wander')({});
    await tool('fun_home')({});
  }
  const { trips } = await decl.invoke('book', 'list', []);
  const { id } = trips.find((trip) => trip.placeName === '海洋馆');
  const favorite = await decl.invoke('book', 'favorite', [{ id, keep: true }]);
  assert.equal(favorite.ok, true, favorite.error);
  const root = await mount('book');
  const names = () => root.querySelectorAll('.fun-trip-name').map((n) => n.textContent);
  await waitFor(() => names().length === 2, '默认显示两趟行程');
  root.querySelector('.fun-tabs').findByText('珍藏').fire();
  assert.deepEqual(names(), ['海洋馆']);
  root.querySelector('.fun-tabs').findByText('全部行程').fire();
  assert.deepEqual(names().sort(), ['海洋馆', '漫展'].sort());
});

test('book 面板：刷新失败保留当前行程，可以重试并更新列表', async () => {
  let fail = false;
  const { mount, refresh, tool } = await mountPanels({ failList: () => fail });
  const visit = async (place) => {
    await tool('fun_go')({ place });
    await tool('fun_wander')({});
    await tool('fun_home')({});
  };
  await visit('漫展');
  const root = await mount('book');
  const names = () => root.querySelectorAll('.fun-trip-name').map((n) => n.textContent);
  await waitFor(() => names().includes('漫展'), '画出首趟行程');
  await visit('海洋馆');
  fail = true;
  await refresh();
  const error = root.querySelector('.fun-err');
  assert.match(error.textContent, /刷新失败.*boom/);
  assert.deepEqual(names(), ['漫展']);
  fail = false;
  error.findByText('重试').fire();
  await waitFor(() => names().includes('海洋馆'), '重试后画出新行程');
  assert.equal(root.querySelector('.fun-err'), null);
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
  assert.equal(decl.panels.find((p) => p.id === 'outing').title, 'Go explore');
  assert.equal(decl.panels.find((p) => p.id === 'journal').title, 'Memory Journal');
  const root = await mount('book');
  await waitFor(() => root.querySelector('.fun-empty'), '渲染出来');
  assert.ok(root.childNodes.length > 0);
});

test('面板标题互不相同：两个故事面板不能都叫「故事工坊」', async () => {
  // 宿主把面板标题直接排成页签；同名就会变成两个一模一样的「故事工坊」，点哪个都像点错。
  // 按方案图：从鱼的家出发玩故事的那个叫「出游」，写作/导入作品的那个才叫「故事工坊」。
  const { decl, mount } = await mountPanels();
  const titles = decl.panels.map((panel) => panel.title);
  assert.equal(new Set(titles).size, titles.length, `面板标题重复：${titles.join('、')}`);
  assert.deepEqual(titles, ['家', '自己去逛', '故事手账', '回忆手账']);
  assert.deepEqual(Object.keys((await loadPanelClient()).default.panels).sort(), ['home', 'journal', 'outing', 'story']);
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
  await waitFor(() => root.querySelector('.fun-keepsake'), '画出展示柜');

  const text = root.textContent;
  assert.match(text, /漫展/, '要按地方归着');
  assert.match(text, /吧唧/, '要列出东西');
  assert.match(text, /1 样/, '要显示这一处有几样');
  assert.ok(root.querySelectorAll('.fun-stat').length >= 3, '顶部要有统计数');
});

test('shelf 面板：每件物品可展开对应行程、同行人与回家备注', async () => {
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
  assert.equal((root.textContent.match(/最近 40 趟/g) ?? []).length, 1, '收藏账本与详细行程保留范围只说明一次');
  const receipt = await tool('fun_journal')({ view: 'shelf' });
  assert.match(receipt.text, /吧唧/);
});

test('shelf 面板：进度里点出还差哪些没逛', async () => {
  const { mount, tool } = await mountPanels();
  await tool('fun_go')({ place: '漫展' });
  await tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  await tool('fun_home')({});

  const root = await mount('shelf');
  await waitFor(() => root.querySelector('.fun-progress-card'), '画出去过的地方');
  assert.ok(root.querySelector('.fun-keepsake'), '展示柜与进度同时在场');
  assert.match(root.textContent, /还差：/, '要具体点出还差什么');
  assert.match(root.textContent, /逛过 1\/6/, '要有进度分母');
});

test('shelf 面板：逛过但没买纪念品也显示探索进度', async () => {
  const { mount, tool } = await mountPanels();
  await tool('fun_go')({ place: '漫展' });
  await tool('fun_wander')({ area: '同人展台' });
  await tool('fun_home')({});

  const root = await mount('shelf');
  await waitFor(() => root.querySelector('.fun-empty'), '显示收藏为空的提示');
  assert.match(root.textContent, /漫展/);
  assert.match(root.textContent, /逛过 1\/6/);
  assert.match(root.textContent, /还差：/);
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
  const favorite = await waitFor(() => root.querySelector('.fun-trip')?.findByText('珍藏'), '珍藏行程按钮已挂载');
  favorite.fire();
  await waitFor(() => root.querySelector('.fun-trip')?.findByText('取消珍藏'), '服务端写入珍藏');
  await world.stop();
  const restarted = trackWorld(new FunWorld({ cfg: { enabled: true }, dataDir: world.dataDir, timezone: 'Asia/Shanghai' }));
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
  assert.equal(decl.panels.find((p) => p.id === 'journal').title, 'Memory Journal');
});

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

test('book 面板隐藏已下线的心愿入口，旧字段不展示也不发起写入', async () => {
  const data = albumFixture([]);
  data.wishes = [{ id: 'legacy-wish', placeId: 'river', placeName: '江边', type: 'visit', target: '', status: 'active' }];
  const { root, calls } = await mountView('book', data);
  assert.deepEqual(root.querySelector('.fun-tabs').querySelectorAll('button').map((button) => button.textContent), ['全部行程', '珍藏']);
  assert.equal(root.findByText('记个心愿'), null);
  assert.equal(root.querySelector('.fun-wishes'), null);
  assert.equal(calls.filter((call) => call.method === 'wish').length, 0);
});
test('places 面板：未完行程可续逛，不显示下线的普通岔路', async () => {
  const b = await mountPanels({ random: () => 0 });
  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '海底隧道' });
  b.setNow(Date.parse('2026-11-16T10:00:00+08:00'));
  const root = await b.mount('places');
  await waitFor(() => root.querySelector('.fun-draft'), '未完行程出现');
  assert.match(root.querySelector('.fun-draft').textContent, /海底隧道/);
  assert.equal(root.querySelector('.fun-choice'), null);
  const button = root.findByText('继续逛');
  button.fire(); button.fire();
  await waitFor(() => root.querySelector('.fun-live')?.textContent.includes('正在海洋馆逛'), '恢复成功');
  assert.equal(root.querySelector('.fun-draft'), null);
  assert.equal(root.querySelector('.fun-choice'), null);
  assert.equal(b.invocations.filter((x) => x.method === 'resume').length, 1);
  assert.equal(b.invocations.filter((x) => x.method === 'choice').length, 0);
});

test('places 面板：按已有记录回家后更新画面和纪念册', async () => {
  const b = await mountPanels();
  await b.tool('fun_go')({ place: '漫展' });
  await b.tool('fun_wander')({ area: '同人展台' });
  b.setNow(Date.parse('2026-11-16T10:00:00+08:00'));
  const root = await b.mount('places');
  const button = await waitFor(() => root.findByText('按已有记录回家'), '回家入口');
  button.fire();
  await waitFor(() => root.querySelector('.fun-outing-result')?.textContent.includes('回家'), '回家反馈');
  assert.equal(root.querySelector('.fun-draft'), null);
  assert.equal((await b.decl.invoke('book', 'list', [])).trips.length, 1);
});

test('places 面板：照常展示重游理由，不再展示旧心愿', async () => {
  const b = await mountPanels({ nowMs: Date.parse('2026-11-15T17:30:00+08:00') });
  await b.tool('fun_go')({ place: '夜市' });
  await b.tool('fun_wander')({});
  await b.tool('fun_home')({});
  const night = VENUES.find((v) => v.name === '夜市');
  const statePath = join(b.dataDir, 'fun', 'state.json');
  await b.world.stop();
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  state.wishes = [
    { id: 'legacy-night', placeId: night.id, placeName: night.name, type: 'phase', target: night.phases[1].label,
      reason: '', status: 'active', createdAt: '2026-11-15T09:00:00.000Z', updatedAt: '2026-11-15T09:00:00.000Z', completedAt: '' },
    { id: 'legacy-park', placeId: 'park', placeName: '公园', type: 'visit', target: '', reason: '', status: 'active',
      createdAt: '2026-11-15T09:00:00.000Z', updatedAt: '2026-11-15T09:00:00.000Z', completedAt: '' },
  ];
  await writeFile(statePath, JSON.stringify(state, null, 2));
  const restarted = await mountPanels({ nowMs: Date.parse('2026-11-15T17:30:00+08:00'), dataDir: b.dataDir });
  const root = await restarted.mount('places');
  await waitFor(() => root.querySelector('.fun-card'), '地点列表');
  assert.equal(root.querySelector('.fun-upcoming-wish'), null);
  assert.ok(root.querySelectorAll('.fun-card').every((card) => !card.textContent.includes('心愿')));
  assert.match(root.textContent, /还没去过/);
});

test('places 面板：续逛失败保留草稿，重试后只恢复一次', async () => {
  const b = await mountPanels();
  await b.tool('fun_go')({ place: '漫展' });
  b.setNow(Date.parse('2026-11-16T10:00:00+08:00'));
  const original = b.decl.invoke;
  let fails = true;
  b.decl.invoke = (panel, method, args) => method === 'resume' && fails
    ? Promise.resolve({ ok: false, error: '暂时无法保存行程' }) : original(panel, method, args);
  const root = await b.mount('places');
  (await waitFor(() => root.findByText('继续逛'), '续逛入口')).fire();
  await waitFor(() => root.querySelector('.fun-outing-result')?.textContent.includes('暂时无法保存行程'), '显示保存错误');
  assert.ok(root.querySelector('.fun-draft'));
  assert.equal(root.findByText('继续逛').disabled, false);
  fails = false;
  root.findByText('继续逛').fire();
  await waitFor(() => root.querySelector('.fun-live')?.textContent.includes('正在漫展逛'), '重试成功');
  assert.equal(root.querySelector('.fun-draft'), null);
});

// Focused view-contract fixtures let the UI test new read-only APIs independently
// of backend deployment order. Real-world integration tests above stay in place.
async function mountView(panel, data, handlers = {}) {
  const bundle = await loadPanelClient();
  const root = new Node('div');
  const calls = [];
  const mounted = bundle.testMounts[panel]({ root, signal: { aborted: false },
    interval() { return { dispose() {} }; }, timeout() { return { dispose() {} }; },
    async invoke(method, args = []) {
      calls.push({ method, args });
      if (handlers[method]) return handlers[method](args);
      if (method === 'list') return structuredClone(data);
      throw new Error('Unexpected UI invocation: ' + method);
    } });
  await waitFor(() => root.querySelector('.fun-heading'), panel + ' fixture');
  return { root, calls, mounted };
}
const tripFixture = (overrides = {}) => ({ id: 'trip-1', placeId: 'park', placeName: '公园', day: '2026-11-15',
  enteredHm: '14:00', leftHm: '15:00', stayedMin: 60, summary: '沿着湖边慢慢逛', company: '', note: '',
  visited: ['湖边'], events: [], choices: [], souvenirs: [], photos: [], ate: [], timeline: [], routeId: '', routeOrder: 0, ...overrides });
const albumFixture = (trips, routes = []) => ({ ok: true, total: trips.length, totalRecent: trips.length,
  keepsakeCount: trips.filter((trip) => trip.kept).length, visitedAreaCount: 1, souvenirCount: 0, photoCount: 0,
  trips, routes, places: [], wishes: [] });

test('原创 SVG：每处地点都有不同本地线稿，自填地点用通用图且没有外部素材请求', async () => {
  const { venueArtwork, souvenirArtwork } = await import('../webui/artwork.js');
  const drawings = VENUES.map((place) => venueArtwork(place.id));
  assert.equal(new Set(drawings).size, VENUES.length);
  for (const drawing of [...drawings, venueArtwork('custom-place'), souvenirArtwork('未知物品')]) {
    assert.match(drawing, /<svg/);
    assert.match(drawing, /aria-hidden="true"/);
    assert.match(drawing, /focusable="false"/);
    assert.doesNotMatch(drawing, /<image|<script|href=|url\(|<foreignObject|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  }
  assert.notEqual(venueArtwork('custom-place'), venueArtwork('park'));
});

test('places 推荐：只用服务端开放 ID，当前行程在前、推荐其次、全部搜索与管理随后', async () => {
  const fixture = await mountPanels();
  const data = await fixture.decl.invoke('places', 'list', []);
  const open = data.places.filter((place) => place.state !== 'closed').slice(0, 3);
  const closed = data.places.find((place) => place.state === 'closed');
  data.recommendationIds = [open[0].id, 'missing-id', closed.id, open[1].id, open[0].id];
  data.route = { id: 'route-live', status: 'between', stops: open.slice(0, 2).map((place) => ({ placeId: place.id, placeName: place.name })), tripIds: [] };
  const { root, calls } = await mountView('places', data);
  assert.equal(root.querySelectorAll('.fun-card').length, VENUES.length, '完整地点列表仍在');
  assert.deepEqual(root.querySelectorAll('.fun-recommend-name').map((node) => node.textContent), open.slice(0, 2).map((place) => place.name));
  const walk = [...root.walk()];
  assert.ok(walk.indexOf(root.querySelector('.fun-live')) < walk.indexOf(root.querySelector('.fun-recommendations')));
  assert.ok(walk.indexOf(root.querySelector('.fun-recommendations')) < walk.indexOf(root.querySelector('.fun-search')));
  assert.ok(walk.indexOf(root.querySelector('.fun-grid')) < walk.indexOf(root.querySelector('.fun-management')));
  assert.equal(root.querySelector('.fun-route'), null, '路线入口已下线');
  assert.equal(root.querySelector('.fun-management').getAttribute('open'), undefined);
  assert.equal(root.findByText('＋ 添加地点'), null, '去哪儿不再有添加入口');
  assert.ok(root.querySelector('.fun-management').textContent.includes('地点册'), '管理说明指向地点册');
  const recommended = root.querySelector('.fun-recommend-card');
  recommended.fire('keydown', { key: 'Enter', preventDefault() {} });
  assert.ok(root.querySelector('.fun-detail').textContent.includes(open[0].name));
  assert.equal(root.querySelectorAll('.fun-detail').length, 1);
  assert.equal(calls.filter((call) => call.method !== 'list').length, 0, '看推荐不会替她出发或选择');
  assert.ok(root.querySelectorAll('.fun-art').every((node) => node.getAttribute('aria-hidden') === 'true'));
});

test('places 搜索与自动刷新保留输入焦点；没有推荐数据时不自行挑选', async () => {
  const fixture = await mountPanels();
  const data = await fixture.decl.invoke('places', 'list', []);
  delete data.recommendationIds;
  const { root, mounted } = await mountView('places', data);
  assert.equal(root.querySelectorAll('.fun-recommend-card').length, 0);
  const input = root.querySelector('.fun-search'); input.focus(); input.value = '室内'; input.fire('input');
  assert.equal(root.querySelector('.fun-search'), input);
  assert.equal(document.activeElement, input);
  await mounted.refresh();
  assert.equal(root.querySelector('.fun-search').value, '室内');
  assert.equal(document.activeElement, root.querySelector('.fun-search'));
});

test('纪念品图标：票根、钥匙扣、书签等分类清楚，未知物品只加装饰性通用图', async () => {
  const { souvenirCategory, souvenirArtwork } = await import('../webui/artwork.js');
  const categories = [['旋转木马票根', 'ticket'], ['钥匙扣', 'keychain'], ['鲸鱼挂件', 'keychain'], ['银杏书签', 'bookmark'],
    ['江边明信片', 'postcard'], ['企鹅贴纸', 'sticker'], ['一枚纪念币', 'coin'], ['玻璃杯', 'cup'], ['水母小夜灯', 'light'], ['小熊玩偶', 'plush'], ['御守', 'charm'], ['一枚贝壳', 'generic']];
  for (const [name, category] of categories) assert.equal(souvenirCategory(name), category, name);
  assert.equal(souvenirArtwork('<img src=x onerror=alert(1)>'), souvenirArtwork('未知物品'));
  const data = { ok: true, total: 1, pieces: 1, places: 1, completePlaces: 0, progress: [], byPlace: [{ placeName: '公园', firstDay: '2026-11-15', items: [{ name: '银杏书签', times: 1, firstDay: '2026-11-15', memories: [] }] }] };
  const { root } = await mountView('shelf', data);
  const icon = root.querySelector('.fun-icon');
  assert.equal(icon.getAttribute('data-category'), 'bookmark');
  assert.equal(icon.getAttribute('aria-hidden'), 'true');
  assert.match(root.querySelector('.fun-keepsake').textContent, /银杏书签/);
});

test('纪念册搜索地点、同行、日期与备注；地点日期取交集，逐字输入保留同一个搜索框', async () => {
  const data = albumFixture([
    tripFixture({ id: 'a', company: '小鱼', note: '带走最后一片落叶' }),
    tripFixture({ id: 'b', placeId: 'museum', placeName: '博物馆', day: '2026-11-16', company: '同行乙', note: '抬头看穹顶' }),
    tripFixture({ id: 'c', day: '2026-11-16', note: '下过一阵雨' }),
  ]);
  const { root, mounted } = await mountView('book', data);
  const search = root.querySelector('.fun-book-search'); search.focus();
  const names = () => root.querySelectorAll('.fun-trip-name').map((node) => node.textContent);
  for (const [keyword, expected] of [['小鱼', ['公园']], ['穹顶', ['博物馆']], ['2026-11-15', ['公园']], ['博物馆', ['博物馆']]]) {
    search.value = keyword; search.fire('input'); assert.deepEqual(names(), expected);
    assert.equal(root.querySelector('.fun-book-search'), search); assert.equal(document.activeElement, search);
  }
  search.value = ''; search.fire('input');
  const place = root.querySelector('.fun-book-place'); place.value = 'park'; place.fire('change');
  const date = root.querySelector('.fun-book-date'); date.value = '2026-11-16'; date.fire('change');
  assert.deepEqual(names(), ['公园']);
  root.findByText('查看详情').fire();
  assert.match(root.querySelector('.fun-trip-detail').textContent, /下过一阵雨/);
  search.focus(); search.value = '没有的备注'; search.fire('input'); assert.match(root.querySelector('.fun-book-results').textContent, /没有匹配/);
  await mounted.refresh();
  assert.equal(document.activeElement, root.querySelector('.fun-book-search'));
  assert.equal(root.querySelector('.fun-book-place').value, 'park');
  assert.equal(root.querySelector('.fun-book-date').value, '2026-11-16');
  assert.equal(root.querySelector('.fun-book-search').value, '没有的备注');
});

test('时间线：区域下的小事带对应选择，只显示已保存的逐项时间，空时间明确不详', async () => {
  const timeline = [
    { kind: 'enter', text: '来到公园', at: 100, day: '2026-11-15', hm: '14:00', area: '', event: '' },
    { kind: 'area', text: '湖边', at: 200, day: '2026-11-15', hm: '14:06', area: '湖边', event: '' },
    { kind: 'event', text: '碰到卖花的人', at: 300, day: '2026-11-15', hm: '14:07', area: '湖边', event: '卖花人' },
    { kind: 'choice', text: '留下一束花', at: 400, day: '2026-11-15', hm: '14:09', area: '湖边', event: '卖花人' },
    { kind: 'buy', text: '银杏书签', at: null, day: '2026-11-15', hm: '23:59', area: '湖边', event: '' },
    { kind: 'area', text: '林间小路', at: 600, day: '2026-11-15', hm: '14:20', area: '林间小路', event: '' },
    { kind: 'close', text: '回家', at: 700, day: '2026-11-15', hm: '15:00', area: '', event: '' },
  ];
  const { root } = await mountView('book', albumFixture([tripFixture({ timeline })]));
  root.findByText('查看详情').fire();
  const blocks = root.querySelectorAll('.fun-timeline-block');
  assert.deepEqual(blocks.map((node) => node.getAttribute('data-area')), ['出发与进门', '湖边', '林间小路', '回家']);
  const event = root.querySelector('.fun-timeline-event');
  assert.equal(event.getAttribute('data-event'), '卖花人');
  assert.match(event.textContent, /14:07.*碰到卖花的人.*14:09.*留下一束花/);
  assert.equal(event.querySelector('.fun-timeline-choice').getAttribute('data-event'), '卖花人');
  const unknown = root.querySelectorAll('.fun-timeline-row').find((row) => row.getAttribute('data-kind') === 'buy');
  assert.match(unknown.textContent, /时间不详/); assert.doesNotMatch(unknown.textContent, /23:59/);
  assert.equal(unknown.getAttribute('data-at'), 'unknown');
});

test('旧行程没有 timeline 时保留所有事件和选择，并且不把进门时刻当成逐项时间', async () => {
  const trip = tripFixture({ events: ['旧时遇到一只猫'], choices: [{ event: '旧时遇到一只猫', result: '在远处看一眼' }], souvenirs: ['旧书签'], photos: ['旧桥'], ate: [{ verb: '喝', item: '茶' }] });
  delete trip.timeline;
  const { root } = await mountView('book', albumFixture([trip])); root.findByText('查看详情').fire();
  const detail = root.querySelector('.fun-trip-detail');
  for (const text of ['湖边', '旧时遇到一只猫', '在远处看一眼', '旧书签', '旧桥', '茶', '没有保存逐项时间']) assert.ok(detail.textContent.includes(text), text);
  assert.ok(root.querySelectorAll('.fun-timeline-row').every((row) => row.getAttribute('data-at') === 'unknown'));
  assert.ok(root.querySelector('.fun-timeline-event').querySelector('.fun-timeline-choice'));
  assert.doesNotMatch(detail.textContent, /14:00/);
});

test('旧联程中的两趟仍可独立回看和搜索，不再显示联程分组', async () => {
  const a = tripFixture({ id: 'route-a', routeId: 'route-1', routeOrder: 1, company: '同行小鱼' });
  const b = tripFixture({ id: 'route-b', placeId: 'cafe', placeName: '咖啡店', routeId: 'route-1', routeOrder: 2, summary: '坐在窗边', company: '' });
  const route = { id: 'route-1', status: 'completed', stops: [{ placeId: 'park', placeName: '公园' }, { placeId: 'cafe', placeName: '咖啡店' }], tripIds: [a.id, b.id] };
  const { root, calls } = await mountView('book', albumFixture([b, a], [route]));
  assert.equal(root.querySelector('.fun-route-group'), null);
  assert.equal(root.querySelectorAll('.fun-ticket').length, 2);
  const search = root.querySelector('.fun-book-search'); search.value = '同行小鱼'; search.fire('input');
  const [ticket] = root.querySelectorAll('.fun-ticket');
  assert.equal(root.querySelectorAll('.fun-ticket').length, 1);
  assert.equal(ticket.getAttribute('data-trip-id'), a.id);
  ticket.querySelector('.fun-detail-toggle').fire();
  assert.ok(root.querySelector('.fun-trip-detail'));
  assert.equal(calls.length, 1, '回看详情不会触发写入');
});

test('地点历史只读链接支持 pending、失败与重试，并在原详情内回看且不动搜索焦点', async () => {
  const fixture = await mountPanels(); const data = await fixture.decl.invoke('places', 'list', []);
  let resolve; let count = 0;
  const trip = tripFixture({ note: '那天的晚风' });
  const { root, calls } = await mountView('places', data, { history(args) {
    assert.deepEqual(args, [{ placeId: 'park' }]); count += 1;
    return count === 1 ? new Promise((done) => { resolve = done; }) : { ok: true, trips: [trip] };
  } });
  const search = root.querySelector('.fun-search'); search.value = '公园'; search.fire('input'); search.focus();
  root.querySelector('.fun-card').fire();
  const history = root.findByText('回看这里的行程'); history.fire(); history.fire();
  assert.equal(count, 1); assert.equal(root.findByText('读取中…').disabled, true);
  resolve({ ok: false, error: '暂时读不到旧行程' });
  await waitFor(() => root.querySelector('.fun-history').textContent.includes('暂时读不到旧行程'), '历史失败');
  root.querySelector('.fun-history').findByText('重试').fire();
  await waitFor(() => root.querySelector('.fun-inspector'), '历史重试成功');
  assert.match(root.querySelector('.fun-inspector').textContent, /那天的晚风/);
  assert.equal(root.querySelector('.fun-search'), search); assert.equal(document.activeElement, search);
  assert.deepEqual(calls.filter((call) => call.method !== 'list').map((call) => call.method), ['history', 'history']);
});

test('纪念品只为保留 ID 的回忆给行程链接，已归档没有假链接；错误可重试打开内联详情', async () => {
  const trip = tripFixture({ id: 'kept-trip', company: '老朋友', note: '夹在书里的秋天' });
  const data = { ok: true, total: 1, pieces: 3, places: 1, completePlaces: 0, progress: [], byPlace: [{ placeName: '公园', firstDay: '2026-11-15', items: [{ name: '银杏书签', times: 3, firstDay: '2026-11-15', archivedCount: 1,
    memories: [{ id: trip.id, day: trip.day, summary: trip.summary }, { day: '2025-11-15', summary: '仅账本记录' }] }] }] };
  let fail = true;
  const { root, calls } = await mountView('shelf', data, { trip(args) { assert.deepEqual(args, [{ id: trip.id }]); if (fail) throw new Error('回忆暂时不可用'); return { ok: true, trips: [trip] }; } });
  assert.equal(root.querySelectorAll('.fun-history-toggle').length, 1);
  root.findByText('回看这趟行程').fire();
  await waitFor(() => root.querySelector('.fun-history').textContent.includes('回忆暂时不可用'), '物品行程失败');
  fail = false; root.querySelector('.fun-history').findByText('重试').fire();
  await waitFor(() => root.querySelector('.fun-inspector'), '物品行程重试');
  assert.match(root.querySelector('.fun-inspector').textContent, /老朋友.*夹在书里的秋天/);
  assert.deepEqual(calls.filter((call) => call.method !== 'list').map((call) => call.method), ['trip', 'trip']);
});

test('时间线有穿插动作时仍按保存顺序展示，后来的选择保留对应事件标签', async () => {
  const timeline = [
    { kind: 'area', text: '湖边', area: '湖边', at: 1, hm: '14:01' },
    { kind: 'event', text: '一阵风', event: '风', area: '湖边', at: 2, hm: '14:02' },
    { kind: 'photo', text: '波纹', area: '湖边', at: 3, hm: '14:03' },
    { kind: 'choice', text: '坐一会儿', event: '风', area: '湖边', at: 4, hm: '14:04' },
  ];
  const { root } = await mountView('book', albumFixture([tripFixture({ timeline })]));
  root.findByText('查看详情').fire();
  assert.deepEqual(root.querySelectorAll('.fun-timeline-row').map((row) => row.getAttribute('data-at')), ['1', '2', '3', '4']);
  assert.match(root.querySelector('.fun-timeline-choice').textContent, /对应小事：风/);
});

test('同一趟关联多件纪念品时各处链接同步加载，并展示服务端保存的去过时段', async () => {
  const trip = tripFixture();
  const data = { ok: true, total: 2, pieces: 2, places: 1, completePlaces: 0,
    byPlace: [{ placeName: '公园', items: ['票根', '书签'].map((name) => ({ name, times: 1, memories: [{ id: trip.id, day: trip.day, summary: trip.summary }] })) }],
    progress: [{ placeName: '公园', visits: 1, percent: 50, phases: ['清早', '夜里'], areas: { done: 1, total: 2, left: ['林间'] }, souvenirs: { done: 2, total: 2 }, photos: { done: 0, total: 0 } }] };
  const { root, calls } = await mountView('shelf', data, { trip: () => ({ ok: true, trips: [trip] }) });
  const first = root.querySelector('.fun-keepsake'); first.findByText('回看这趟行程').fire();
  await waitFor(() => first.querySelector('.fun-inspector'), '第一件物品自己的回看详情');
  assert.equal(root.querySelectorAll('.fun-inspector').length, 2, '相同保留行程 ID 的状态一致');
  assert.equal(calls.filter((call) => call.method === 'trip').length, 1);
  assert.equal(root.querySelector('.fun-visited-phases').textContent, '去过的时段：清早、夜里');
});

report();
