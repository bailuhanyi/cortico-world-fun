import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../../src/world.js';
import { hasSafeImage, pictureData, selectedMappings, styleDescription } from './helpers.js';
import { mountPlaces } from './webui.js';

const oldPlaces = [{ sourceId: 'home', name: '旧家' }, { sourceId: 'river', name: '河畔' }];

const flush = () => new Promise((resolve) => setImmediate(resolve));
// Minimal DOM for actual form/RPC interactions, not browser layout validation.
class FormElement extends EventTarget {
  constructor(tag, document) {
    super();
    this.tagName = tag.toUpperCase(); this.ownerDocument = document; this.childNodes = [];
    this.attributes = new Map(); this.dataset = {}; this.disabled = false; this.className = ''; this._text = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'value') this.value = String(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get textContent() { return this._text + this.childNodes.map((child) => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.childNodes = []; }
  get value() { return this._value ?? (this.tagName === 'TEXTAREA' ? this.textContent : ''); }
  set value(value) { this._value = String(value); }
  append(...children) {
    for (let child of children) {
      if (typeof child !== 'object') { const text = this.ownerDocument.createElement('#text'); text.textContent = child; child = text; }
      this.childNodes.push(child); child.parentNode = this;
    }
  }
  replaceChildren(...children) { for (const child of this.childNodes) child.parentNode = null; this.childNodes = []; this._text = ''; this.append(...children); }
  remove() { if (this.parentNode) { const siblings = this.parentNode.childNodes; siblings.splice(siblings.indexOf(this), 1); this.parentNode = null; } }
  focus() { this.ownerDocument.activeElement = this; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  querySelectorAll(selector) {
    const tags = selector.split(',').map((tag) => tag.trim().toUpperCase());
    return this.childNodes.flatMap((child) => [...(tags.includes(child.tagName) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
async function mountLibrary(t, prepare) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-locations-ui-'));
  const world = new FunWorld({ dataDir: dir });
  await world.start({});
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
  const rpc = (method, payload) => world.webUi().invoke('locations', method, payload === undefined ? [] : [payload]);
  if (prepare) await prepare(rpc);
  const document = { createElement(tag) { return new FormElement(tag, this); } };
  const root = document.createElement('div');
  const calls = [];
  let pending = 0;
  const mounted = mountPlaces({ root, async invoke(method, args) {
    calls.push({ method, payload: structuredClone(args[0]) }); pending++;
    try { return await rpc(method, args[0]); } finally { pending--; }
  } });
  t.after(() => mounted.dispose());
  const settled = async () => {
    for (let attempt = 0; attempt < 1000; attempt++) {
      await flush();
      if (!pending && root.childNodes[0]?.getAttribute('aria-busy') === 'false') return;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    assert.fail('The locations UI did not settle.');
  };
  await settled();
  const click = (label) => { const button = root.querySelectorAll('button').find((item) => item.textContent === label); assert.ok(button, label); button.click(); };
  const submit = async () => { root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true })); await settled(); };
  return { root, rpc, calls, mounted, settled, click, submit };
}

test('settings saves twice with the latest committed revision on the same page', async (t) => {
  const h = await mountLibrary(t);
  h.click('住所与画风');
  for (const style of ['First style', 'Second style']) {
    h.root.querySelector('textarea').value = style;
    await h.submit();
    assert.match(h.root.textContent, /已保存默认画风/);
    assert.equal((await h.rpc('list')).defaultStyle, style);
  }
  assert.deepEqual(h.calls.filter(({ method }) => method === 'setDefaultStyle').map(({ payload }) => payload.revision), [0, 1]);
});

test('refreshing settings replaces the form and updates its revision', async (t) => {
  const h = await mountLibrary(t);
  h.click('住所与画风');
  const firstForm = h.root.querySelector('form');
  await h.rpc('setDefaultStyle', { style: 'External edit', revision: 0 });
  await h.mounted.refresh();
  assert.notEqual(h.root.querySelector('form'), firstForm);
  assert.equal(h.root.querySelector('textarea').value, 'External edit');
  h.root.querySelector('textarea').value = 'After refresh';
  await h.submit();
  assert.equal((await h.rpc('list')).defaultStyle, 'After refresh');
  assert.equal(h.calls.find(({ method }) => method === 'setDefaultStyle').payload.revision, 1);
});

test('refreshing during a place edit retains the draft revision and rejects a stale write', async (t) => {
  const h = await mountLibrary(t, async (rpc) => {
    assert.equal((await rpc('create', { input: { name: 'Local place' }, revision: 0 })).ok, true);
  });
  const tile = h.root.querySelectorAll('button').find((item) => item.textContent.startsWith('Local place'));
  assert.ok(tile); tile.click(); await h.settled();
  h.click('编辑地点');
  const form = h.root.querySelector('form');
  const name = form.querySelector('input'); name.value = 'Unsaved draft';
  await h.rpc('setDefaultStyle', { style: 'External edit', revision: 1 });
  await h.mounted.refresh();
  assert.equal(h.root.querySelector('form'), form);
  assert.equal(name.value, 'Unsaved draft');
  await h.submit();
  assert.match(h.root.textContent, /地点册已变更/);
  assert.equal(h.calls.find(({ method }) => method === 'update').payload.revision, 1);
  assert.ok((await h.rpc('list')).places.some((place) => place.name === 'Local place'));
  assert.equal(name.value, 'Unsaved draft');
});

test('地点图鉴的分类显示中文并按大类分组，快捷筛选能分出故事地点与常规地点', async (t) => {
  const h = await mountLibrary(t);
  const text = () => h.root.textContent;
  assert.match(text(), /所有分类/);
  assert.match(text(), /游乐场/);
  assert.match(text(), /故事地点/);
  assert.doesNotMatch(text(), /amusement|aquarium|arcade/);
  assert.match(text(), /22 处地点/);
  h.click('故事地点');
  assert.match(text(), /4 处地点/);
  assert.match(text(), /折潮港/);
  assert.match(text(), /折角巷/);
  h.click('常规地点');
  assert.match(text(), /18 处地点/);
  h.click('我的故事地点');
  assert.match(text(), /0 处地点/);
  assert.match(text(), /没有符合条件的地点/);
  h.click('全部');
  assert.match(text(), /22 处地点/);
});

test('host-native locations module exports a mount function', () => {
  assert.equal(typeof mountPlaces, 'function');
});

test('migration requires decisions, never maps a missing or duplicate target, and preserves explicit policy', () => {
  const choices = new Map([['home', { action: 'bind', targetId: 'new-home' }]]);
  assert.throws(() => selectedMappings(oldPlaces, choices), /河畔/);
  choices.set('river', { action: 'bind' });
  assert.throws(() => selectedMappings(oldPlaces, choices), /接收地点/);
  choices.set('river', { action: 'bind', targetId: 'new-home' });
  assert.throws(() => selectedMappings(oldPlaces, choices), /只能接收一条/);
  choices.set('river', { action: 'bind', targetId: 'new-river', policy: 'overwrite' });
  assert.deepEqual(selectedMappings(oldPlaces, choices), [
    { sourceId: 'home', action: 'bind', targetId: 'new-home', policy: 'keep' },
    { sourceId: 'river', action: 'bind', targetId: 'new-river', policy: 'overwrite' },
  ]);
  choices.set('home', { action: 'new', targetId: 'never-bind', policy: 'overwrite' });
  choices.set('river', { action: 'skip', targetId: 'never-bind' });
  assert.deepEqual(selectedMappings(oldPlaces, choices), [{ sourceId: 'home', action: 'new' }, { sourceId: 'river', action: 'skip' }]);
});

test('text identifies a place style, old default, local default, or no style', () => {
  assert.equal(styleDescription({ style: '水彩', styleSource: 'place' }), '地点画风');
  assert.equal(styleDescription({ effectiveStyle: '旧画风', styleSource: 'source-default' }), '补录的旧世界默认画风');
  assert.equal(styleDescription({ effectiveStyle: '当前兜底', styleSource: 'local-default' }), '从0开始的肥鱼大冒险默认画风');
  assert.equal(styleDescription({}), '未设置');
});

test('cover display and upload use bounded local raster data rather than external or SVG URLs', async () => {
  assert.equal(hasSafeImage('data:image/png;base64,AA=='), true);
  assert.equal(hasSafeImage('data:image/webp;base64,AA=='), true);
  for (const invalid of ['https://host/image.png', 'file:///image.png', 'data:image/svg+xml;base64,AA==', 'data:image/png;base64,','data:image/png;base64,AA==\n']) {
    assert.equal(hasSafeImage(invalid), false);
  }
  assert.throws(() => pictureData({ name: 'cover.png', size: 2 }, 1), /MiB/);
  assert.throws(() => pictureData({ name: 'cover.svg', size: 1, type: 'image/svg+xml' }, 1), /PNG/);
  class FileReaderStub {
    readAsDataURL(file) { this.result = file.contents; this.onload(); }
  }
  assert.equal(await pictureData({ name: 'cover.png', size: 1, contents: 'data:application/octet-stream;base64,AA==' }, 1024, FileReaderStub), 'data:image/png;base64,AA==');
});
