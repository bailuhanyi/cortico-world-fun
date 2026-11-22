import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../../src/world.js';
import { mountHome } from './webui.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

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
  const world = new FunWorld({ dataDir: dir });
  await world.start({});
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
  const call = (method, payload) => world.webUi().invoke('home', method, payload === undefined ? [] : [payload]);
  if (prepare) await prepare({ dir, world, call });

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
  return { root, calls, mounted, button, buttons, settle, document };
}

test('没素材也能打开：CSS 房间、十个活动、当前是发呆', async (t) => {
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
  assert.equal(active[0].textContent, '发呆');
  assert.equal(h.root.querySelectorAll('img').length, 0, '缺图时不要留一个破图标');
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
  assert.equal(inputs.length, 11, '一个背景 + 十个活动');
  const textarea = h.root.querySelectorAll('textarea')[0];
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

test('恢复默认把活动收回发呆，已上传的图不删', async (t) => {
  const h = await mountHomePanel(t);
  h.button('读书').click();
  await h.settle();
  h.button('恢复默认').click();
  await h.settle();
  const pressed = h.buttons().filter((item) => item.getAttribute('aria-pressed') === 'true');
  assert.equal(pressed.length, 1);
  assert.equal(pressed[0].textContent, '发呆');
  assert.ok(h.calls.some((call) => call.method === 'resetRoom'));
});
