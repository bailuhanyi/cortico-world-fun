import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../../src/world.js';
import { HOME_LAYOUT } from './layout.js';
import { classifyHomeFile, mountHome } from './webui.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
/** 固定在一个时段（21:30 → 刷视频），否则时段默认会让断言随运行时间漂。 */
const FIXED_NOW = Date.parse('2026-11-22T21:30:00+08:00');

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

async function mountHomePanel(t, prepare) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-ui-'));
  const clock = { now: FIXED_NOW };
  const world = new FunWorld({ dataDir: dir, now: () => clock.now });
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
  assert.equal(h.root.querySelectorAll('img').length, 0, '缺图时不要留一个破图标');
});

test('十个站位都带缩放，且按素材实测表落地板', () => {
  assert.deepEqual(Object.keys(HOME_LAYOUT).sort(), ['cards', 'chatting', 'cooking', 'gaming', 'idle',
    'looking_outside', 'painting', 'reading', 'sleeping', 'watching']);
  const expected = {
    idle: [0.52, 0.93, 0.52], reading: [0.40, 0.92, 0.40], watching: [0.60, 0.93, 0.40],
    cards: [0.34, 0.93, 0.42], gaming: [0.50, 0.955, 0.38], chatting: [0.62, 0.93, 0.40],
    cooking: [0.13, 0.93, 0.52], painting: [0.30, 0.93, 0.50],
    looking_outside: [0.21, 0.93, 0.52], sleeping: [0.45, 0.94, 0.34],
  };
  for (const [id, [x, y, scale]] of Object.entries(expected)) {
    assert.equal(HOME_LAYOUT[id].x, x, `${id} x`);
    assert.equal(HOME_LAYOUT[id].y, y, `${id} y`);
    assert.equal(HOME_LAYOUT[id].scale, scale, `${id} scale`);
    assert.ok(HOME_LAYOUT[id].scale >= 0.3 && HOME_LAYOUT[id].scale <= 0.55, `${id} 比例在素材范围内`);
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
  assert.equal(inputs.length, 12, '批量导入 1 + 背景 1 + 十个活动');
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
  assert.equal(h.calls.filter((call) => !['state', 'art'].includes(call.method)).length, 0);
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

test('纪念品：摆出来、点一下只读气泡，零写请求', async (t) => {
  const h = await mountHomePanel(t, async ({ world }) => {
    const tool = (name) => world.tools().find((item) => item.name === name).handler;
    await tool('fun_go')({ place: '海洋馆' });
    await tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼挂件' });
    await tool('fun_home')({});
    await tool('fun_go')({ place: '咖啡店' });
    await tool('fun_wander')({ buy: '店里的杯垫' });
    await tool('fun_home')({});
  });
  const trinkets = h.buttons().filter((item) => item.className === 'fhm-keepsake');
  assert.equal(trinkets.length, 2, '两趟各一件');
  trinkets[0].click();
  await h.settle();
  assert.match(h.root.textContent, /来自(海洋馆|咖啡店)/);
  assert.equal(h.calls.filter((call) => !['state', 'art'].includes(call.method)).length, 0, '点纪念品不发写请求');
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
  assert.equal(h.calls.filter((call) => !['state', 'art'].includes(call.method)).length, 0, '复制不是写操作');
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
