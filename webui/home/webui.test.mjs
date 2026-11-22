import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../../src/world.js';
import { DEFAULTS } from '../../src/config.js';
import { HOME_LAYOUT } from './layout.js';
import { classifyHomeFile, mountHome } from './webui.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
/** 固定在一个时段（21:30 → 刷视频），否则时段默认会让断言随运行时间漂。 */
const FIXED_NOW = Date.parse('2026-11-22T21:30:00+08:00');
const NOON = Date.parse('2026-11-22T12:00:00+08:00');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_URL = `data:image/png;base64,${PNG}`;

/** 极简 DOM：够挂载面板、点按钮、读文字；不做布局。 */
class Node extends EventTarget {
  constructor(tag, document) {
    super();
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = document;
    this.childNodes = [];
    this.attributes = new Map();
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this._text = '';
    this._value = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get textContent() { return this._text + this.childNodes.map((child) => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.childNodes = []; }
  get value() { return this._value || this.textContent; }
  set value(value) { this._value = String(value); }
  append(...children) {
    for (let child of children) {
      if (typeof child !== 'object') { const text = this.ownerDocument.createElement('#text'); text.textContent = child; child = text; }
      this.childNodes.push(child); child.parentNode = this;
    }
  }
  replaceChildren(...children) { for (const child of this.childNodes) child.parentNode = null; this.childNodes = []; this._text = ''; this.append(...children); }
  remove() { if (this.parentNode) { const list = this.parentNode.childNodes; list.splice(list.indexOf(this), 1); this.parentNode = null; } }
  click() { this.dispatchEvent(new Event('click')); }
  querySelectorAll(selector) {
    const tags = selector.split(',').map((tag) => tag.trim().toUpperCase());
    return this.childNodes.flatMap((child) => [...(tags.includes(child.tagName) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

async function mountHomePanel(t, prepare, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-ui-'));
  const clock = { now: options.now ?? FIXED_NOW };
  const world = new FunWorld({
    dataDir: dir,
    now: () => clock.now,
    cfg: { ...DEFAULTS, enabled: true, ...(options.cfg ?? {}) },
    persist: () => {},
  });
  await world.start({});
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
  const call = (method, payload) => world.webUi().invoke('home', method, payload === undefined ? [] : [payload]);
  if (prepare) await prepare({ dir, world, call, clock });

  const document = { createElement(tag) { return new Node(tag, this); } };
  const root = document.createElement('div');
  const calls = [];
  let pending = 0;
  const mounted = mountHome({
    root,
    signal: { aborted: false, addEventListener() {}, removeEventListener() {} },
    interval() { return { dispose() {} }; },
    async invoke(method, args) {
      calls.push({ method, args });
      pending += 1;
      try { return await call(method, args?.[0]); } finally { pending -= 1; }
    },
    ...(options.pickPath ? { pickPath: options.pickPath } : {}),
  });
  await mounted.ready;
  await flush();
  const settle = async () => {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      await flush();
      if (!pending) {
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (!pending) return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.fail('面板还没结算。');
  };

  const buttons = () => root.querySelectorAll('button');
  const button = (label) => {
    const found = buttons().find((item) => item.textContent === label);
    assert.ok(found, `找不到按钮：${label}`);
    return found;
  };
  return { root, calls, mounted, button, buttons, settle, document, clock, dir, world };
}

test('没素材也能打开：CSS 房间、十个活动、时段默认活动', async (t) => {
  const h = await mountHomePanel(t);
  const text = h.root.textContent;
  assert.match(text, /从0开始的肥鱼大冒险 · 回家看看/);
  assert.match(text, /鱼的家/);
  assert.match(text, /还没有房间图/);
  assert.match(text, /这里显示的是房间里的样子，不是记录/);
  const chips = h.buttons().filter((item) => item.getAttribute('aria-pressed') !== null);
  assert.equal(chips.length, 10);
  const active = chips.filter((item) => item.getAttribute('aria-pressed') === 'true');
  assert.equal(active.length, 1);
  // 21:30 属于 21:00–23:59 → 刷视频；这是服务端算的，没写进 room.json。
  assert.equal(active[0].textContent, '刷视频');
  await h.settle();
  const imgs = h.root.querySelectorAll('img');
  assert.equal(imgs.length, 1, '没传图时画内置 Q 版立绘');
  assert.equal(imgs[0].className, 'fhm-char');
  for (let i = 0; i < 50 && !imgs[0].getAttribute('src'); i += 1) await flush();
  assert.match(imgs[0].getAttribute('src') ?? '', /^data:image\/webp;base64,/, '内置立绘要真的取到图，不留破图标');
});

test('十个站位都带缩放，且按素材实测表落地板', () => {
  assert.deepEqual(Object.keys(HOME_LAYOUT).sort(), ['cards', 'chatting', 'cooking', 'gaming', 'idle',
    'looking_outside', 'painting', 'reading', 'sleeping', 'watching']);
  // 0.7.1：内置 Q 版立绘裁掉透明边后整体调小（旧值是按带留白的半写实立绘量的）。
  const expected = {
    idle: [0.52, 0.93, 0.40], reading: [0.40, 0.92, 0.30], watching: [0.60, 0.93, 0.30],
    cards: [0.34, 0.93, 0.30], gaming: [0.50, 0.955, 0.28], chatting: [0.62, 0.93, 0.32],
    cooking: [0.13, 0.93, 0.40], painting: [0.30, 0.93, 0.36],
    looking_outside: [0.21, 0.93, 0.40], sleeping: [0.45, 0.94, 0.26],
  };
  for (const [id, [x, y, scale]] of Object.entries(expected)) {
    assert.equal(HOME_LAYOUT[id].x, x, `${id} x`);
    assert.equal(HOME_LAYOUT[id].y, y, `${id} y`);
    assert.equal(HOME_LAYOUT[id].scale, scale, `${id} scale`);
    assert.ok(HOME_LAYOUT[id].scale >= 0.2 && HOME_LAYOUT[id].scale <= 0.45, `${id} 比例在 Q 版范围内`);
  }
});

test('批量导入按文件名分拣：10 个落位、chibi 与其他进未使用', () => {
  assert.deepEqual(classifyHomeFile('bg-day-bastyle.png'), { kind: 'background' });
  assert.deepEqual(classifyHomeFile('ch-idle.png'), { kind: 'character', activity: 'idle' });
  assert.deepEqual(classifyHomeFile('act-reading.png'), { kind: 'character', activity: 'reading' });
  assert.deepEqual(classifyHomeFile('act-looking_outside.png'), { kind: 'character', activity: 'looking_outside' });
  assert.deepEqual(classifyHomeFile('act-outside.png'), { kind: 'character', activity: 'looking_outside' });
  assert.deepEqual(classifyHomeFile('act-watching.gif'), { kind: 'character', activity: 'watching' });
  assert.equal(classifyHomeFile('chibi-idle.png'), null);
  assert.equal(classifyHomeFile('notes.txt'), null);
  const files = ['bg-day-bastyle.png', 'ch-idle.png', 'act-reading.png', 'act-watching.png', 'act-cards.png',
    'act-gaming.png', 'act-chatting.png', 'act-cooking.png', 'act-painting.png', 'act-outside.png',
    'chibi-idle.png'];
  const slots = files.map(classifyHomeFile);
  assert.equal(slots.filter(Boolean).length, 10, '10 张认出槽位');
  assert.equal(slots.filter((slot) => !slot).length, 1, '1 张进未使用');
});

test('点一个活动：只发一次 setActivity，按钮与状态一起跟上', async (t) => {
  const h = await mountHomePanel(t);
  h.button('读书').click();
  await h.settle();
  const writes = h.calls.filter((call) => call.method === 'setActivity');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].args[0].activity, 'reading');
  const pressed = h.buttons().filter((item) => item.getAttribute('aria-pressed') === 'true');
  assert.equal(pressed.length, 1);
  assert.equal(pressed[0].textContent, '读书');
  assert.match(h.root.textContent, /读书/);
});

test('布置房间：背景与十个活动各一个文件入口，备注能存进去', async (t) => {
  const h = await mountHomePanel(t);
  h.button('布置房间').click();
  await h.settle();
  const inputs = h.root.querySelectorAll('input');
  const files = inputs.filter((item) => item.getAttribute('type') === 'file');
  assert.equal(files.length, 14, '批量导入 1 + 背景 1 + 前景 1 + 备份导入 1 + 十个活动');
  const textarea = h.root.querySelectorAll('textarea').find((item) => item.getAttribute('aria-label') === '房间备注');
  assert.ok(textarea, '备注输入框要在');
  textarea.value = '在沙发上翻一本旧书';
  h.button('保存备注').click();
  await h.settle();
  const write = h.calls.find((call) => call.method === 'setNote');
  assert.ok(write);
  assert.equal(write.args[0].note, '在沙发上翻一本旧书');
  assert.match(h.root.textContent, /在沙发上翻一本旧书/);
});

test('出门中：状态改成出门，活动不被覆盖，也不多出写操作', async (t) => {
  const h = await mountHomePanel(t, async ({ world }) => {
    const go = world.tools().find((tool) => tool.name === 'fun_go');
    await go.handler({ place: '海洋馆' });
  });
  const text = h.root.textContent;
  assert.match(text, /出门中 · 海洋馆/);
  assert.match(text, /在外 · 海洋馆/);
  assert.equal(h.calls.filter((call) => !['state', 'art', 'snapshotList', 'exportRoom'].includes(call.method)).length, 0);
});

test('房间档案损坏：说清楚是只读，按钮全禁用，不假装是空房间', async (t) => {
  const h = await mountHomePanel(t, async ({ dir }) => {
    await mkdir(join(dir, 'fun', 'home'), { recursive: true });
    await writeFile(join(dir, 'fun', 'home', 'room.json'), '{"version":1,', 'utf8');
  });
  assert.match(h.root.textContent, /损坏/);
  const chips = h.buttons().filter((item) => item.getAttribute('aria-pressed') !== null);
  assert.equal(chips.length, 10);
  for (const chip of chips) assert.equal(chip.getAttribute('disabled'), 'true');
});

test('恢复默认把活动改回随时段变，已上传的图不删', async (t) => {
  const h = await mountHomePanel(t);
  h.button('读书').click();
  await h.settle();
  h.button('恢复默认').click();
  await h.settle();
  const pressed = h.buttons().filter((item) => item.getAttribute('aria-pressed') === 'true');
  assert.equal(pressed.length, 1);
  assert.equal(pressed[0].textContent, '刷视频', '固定 21:30，恢复默认后回到时段默认');
  assert.ok(h.calls.some((call) => call.method === 'resetRoom'));
});

test('纪念品：先不摆（等排版完善），数据仍在 snapshot 里', async (t) => {
  const h = await mountHomePanel(t, async ({ world }) => {
    const tool = (name) => world.tools().find((item) => item.name === name).handler;
    await tool('fun_go')({ place: '海洋馆' });
    await tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼挂件' });
    await tool('fun_home')({});
    await tool('fun_go')({ place: '咖啡店' });
    await tool('fun_wander')({ buy: '店里的杯垫' });
    await tool('fun_home')({});
  });
  // 图标会和空白房间的说明文字打架，先把摆件关掉；改回 SHOW_KEEPSAKES=true 才恢复。
  assert.equal(h.buttons().filter((item) => item.className === 'fhm-keepsake').length, 0);
  const state = await h.world.webUi('zh').invoke('home', 'state', []);
  assert.equal(state.keepsakes.length, 2, '后端照常返回纪念品，只是面板不摆');
});

test('未完行程：显示票笺与继续，继续用同一个 id', async (t) => {
  const h = await mountHomePanel(t, async ({ world, clock }) => {
    await world.tools().find((item) => item.name === 'fun_go').handler({ place: '海洋馆' });
    // 跨两天 → 正在逛的那趟变成「还没逛完」的 draft。
    clock.now += 2 * 24 * 60 * 60 * 1000;
  });
  assert.match(h.root.textContent, /还留着一趟 · 海洋馆/);
  const before = JSON.parse(await readFile(join(h.dir, 'fun', 'state.json'), 'utf8'));
  // 过期只在读的时候判成 draft；文件里仍是当时那趟 session。
  assert.ok(before.session?.id);
  h.button('继续').click();
  await h.settle();
  const call = h.calls.find((item) => item.method === 'resume');
  assert.ok(call);
  assert.equal(call.args[0].id, before.session.id);
  const after = JSON.parse(await readFile(join(h.dir, 'fun', 'state.json'), 'utf8'));
  assert.equal(after.session.id, before.session.id, '同一趟 id 不变');
  assert.match(h.root.textContent, /出门中 · 海洋馆/);
});

test('记一笔：拿不到剪贴板就退回只读文本，不产生写请求', async (t) => {
  const h = await mountHomePanel(t);
  assert.match(h.root.textContent, /待记一条/);
  assert.match(h.root.textContent, /11 月 22 日 21:30 · 在家刷视频/);
  h.button('记一笔').click();
  await h.settle();
  const box = h.root.querySelectorAll('textarea').find((item) => item.getAttribute('aria-label') === '待记一条文本');
  assert.ok(box, '没有剪贴板时要出现只读文本框');
  assert.match(box.value, /11 月 22 日 21:30 · 在家刷视频/);
  assert.equal(h.calls.filter((call) => !['state', 'art', 'snapshotList', 'exportRoom'].includes(call.method)).length, 0, '复制不是写操作');
});

test('今天想做什么：≤60 字、只写非空；旁边写明不会变成经历', async (t) => {
  const h = await mountHomePanel(t);
  const plan = h.root.querySelectorAll('textarea').find((item) => item.getAttribute('aria-label') === '今天想做什么');
  assert.ok(plan, '计划输入框要在');
  plan.value = '想读半小时书';
  h.button('保存').click();
  await h.settle();
  const write = h.calls.find((call) => call.method === 'setPlan');
  assert.ok(write);
  assert.equal(write.args[0].plan, '想读半小时书');
  assert.match(h.root.textContent, /不会自动变成她做过的事/);
  const room = JSON.parse(await readFile(join(h.dir, 'fun', 'home', 'room.json'), 'utf8'));
  assert.equal(room.room.plan, '想读半小时书');
});

test('时段色罩：21:30 是 night，画面上有一层 data-phase', async (t) => {
  const h = await mountHomePanel(t);
  const light = h.root.querySelectorAll('div').find((item) => item.getAttribute('data-phase'));
  assert.ok(light);
  assert.equal(light.getAttribute('data-phase'), 'night');
});

test('热点：渲染成按钮、Enter 可开只读气泡；布置页能改名并保存', async (t) => {
  const h = await mountHomePanel(t, async ({ call }) => {
    await call('saveHotspots', { hotspots: [{ id: 'sofa', x: 0.5, y: 0.6, label: '沙发', note: '坐这儿' }], revision: 0 });
  });
  const dot = h.buttons().find((item) => item.className === 'fhm-spot');
  assert.ok(dot, '热点要渲染成按钮');
  dot.click();
  await h.settle();
  const bubble = h.root.querySelectorAll('span').find((item) => item.className === 'fhm-spot-bubble');
  assert.ok(bubble);
  assert.equal(bubble.hidden, false);
  assert.match(bubble.textContent, /沙发：坐这儿/);

  h.button('布置房间').click();
  await h.settle();
  const label = h.root.querySelectorAll('input').find((item) => item.getAttribute('aria-label') === '热点名称');
  assert.ok(label);
  label.value = '沙发边';
  label.dispatchEvent(new Event('input'));
  h.button('保存热点').click();
  await h.settle();
  const write = h.calls.find((call) => call.method === 'saveHotspots');
  assert.ok(write);
  assert.equal(write.args[0].hotspots[0].label, '沙发边');
});

test('位置微调：只保存改过的活动，能单个/全部还原', async (t) => {
  const h = await mountHomePanel(t);
  h.button('布置房间').click();
  await h.settle();
  const x = h.root.querySelectorAll('input').find((item) => item.getAttribute('aria-label') === '「读书」x');
  assert.ok(x);
  x.value = '0.42';
  x.dispatchEvent(new Event('input'));
  h.button('保存位置').click();
  await h.settle();
  const write = h.calls.find((call) => call.method === 'savePlacements');
  assert.ok(write);
  assert.deepEqual(write.args[0].placements, { reading: { x: 0.42, y: 0.92, scale: 0.3 } });

  h.buttons().find((item) => item.getAttribute('aria-label') === '还原「读书」的位置').click();
  await h.settle();
  h.button('保存位置').click();
  await h.settle();
  const writes = h.calls.filter((call) => call.method === 'savePlacements');
  assert.deepEqual(writes.at(-1).args[0].placements, {});
});

test('快照：存一张、列表可见、能删；删了不影响当前房间', async (t) => {
  const h = await mountHomePanel(t);
  assert.match(h.root.textContent, /还没有快照/);
  h.button('存快照').click();
  await h.settle();
  assert.ok(h.calls.some((call) => call.method === 'snapshotSave'));
  assert.ok(h.root.querySelectorAll('div').some((item) => item.className === 'fhm-snap-row'), '列表里要出现一张快照');
  const remove = h.buttons().find((item) => /^删除快照 \d+$/.test(item.getAttribute('aria-label') ?? ''));
  assert.ok(remove, '快照列表要有删除按钮');
  remove.click();
  await h.settle();
  assert.ok(h.calls.some((call) => call.method === 'snapshotRemove'));
  assert.match(h.root.textContent, /还没有快照/);
});

test('布置页有画架选图与备份导出/导入入口', async (t) => {
  const h = await mountHomePanel(t);
  h.button('布置房间').click();
  await h.settle();
  assert.ok(h.buttons().some((item) => item.getAttribute('aria-label') === '选一张本地图挂到画架'));
  assert.ok(h.buttons().some((item) => item.textContent === '导出备份'));
  assert.ok(h.root.querySelectorAll('input').some((item) => item.getAttribute('aria-label') === '导入房间备份'));
});

test('画架选图：选择器必须收到 kind=file，选中的图落到 art.painting', async (t) => {
  const seen = [];
  let pickedFile = '';
  const h = await mountHomePanel(t, async ({ dir }) => {
    pickedFile = join(dir, 'wall.png');
    await writeFile(pickedFile, Buffer.from(PNG, 'base64'));
  }, {
    pickPath: async (options) => { seen.push(options); return pickedFile; },
  });
  h.button('布置房间').click();
  await h.settle();
  h.button('选一张本地图').click();
  await flush();
  await h.settle();
  // Coo 的 /api/path-picker 只认 kind: file | directory，缺了会回 400「kind 必须是 file 或 directory」。
  assert.equal(seen.length, 1, '点一次只该弹一次选择器');
  assert.equal(seen[0]?.kind, 'file');
  assert.deepEqual(seen[0]?.extensions, ['.png', '.jpg', '.jpeg', '.gif', '.webp']);
  const write = h.calls.find((item) => item.method === 'setPainting');
  assert.equal(write?.args?.[0]?.path, pickedFile);
  assert.match(h.root.textContent, /挂到画架上了。/);
  assert.doesNotMatch(h.root.textContent, /kind 必须/);
});

test('前景层：可选图叠在角色前面', async (t) => {
  const h = await mountHomePanel(t, async ({ call }) => {
    await call('setForeground', { dataUrl: PNG_URL, revision: 0 });
  });
  await h.settle();
  const front = h.root.querySelectorAll('img').find((item) => item.className === 'fhm-foreground');
  assert.ok(front, '前景图要在');
  assert.match(front.getAttribute('src') ?? '', /^data:image\/png;base64,/);
});
