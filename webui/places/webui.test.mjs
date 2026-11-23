import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../../src/world.js';
import { hasSafeImage, pictureData, selectedMappings, styleDescription } from './helpers.js';
import { mountPlaces } from './webui.js';

const oldPlaces = [{ sourceId: 'home', name: '旧家' }, { sourceId: 'river', name: '河畔' }];

import { createShimDom } from '../../test/dom-shim.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));
// Minimal DOM for actual form/RPC interactions, not browser layout validation.
const { createDocument } = createShimDom();
async function mountLibrary(t, prepare, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-locations-ui-'));
  const world = new FunWorld({ dataDir: dir });
  await world.start({});
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
  const rpc = (method, payload) => world.webUi().invoke('locations', method, payload === undefined ? [] : [payload]);
  if (prepare) await prepare(rpc);
  const document = createDocument();
  const root = document.createElement('div');
  const calls = [];
  let pending = 0;
  const mounted = mountPlaces({ root, memo: options.memo, async invoke(method, args) {
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
  const click = (label) => { const button = root.querySelectorAll('button').find((item) => item.textContent.trim().startsWith(label)); assert.ok(button, label); button.click(); };
  const submit = async () => { root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true })); await settled(); };
  return { root, rpc, calls, mounted, settled, click, submit };
}

test('settings saves twice with the latest committed revision on the same page', async (t) => {
  const h = await mountLibrary(t);
  h.click('住所与默认画风');
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
  h.click('住所与默认画风');
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

test('左栏六项筛选与三项整理入口：计数按快照现算，切换后 aria-current 正确', async (t) => {
  const h = await mountLibrary(t);
  const places = (await h.rpc('list')).places;
  const expected = {
    全部地点: places.length,
    可玩场所: places.filter((place) => place.playable === true).length,
    只是地点: places.filter((place) => place.playable !== true).length,
    故事地点: places.filter((place) => place.storyBound === true).length,
    我的地点: places.filter((place) => place.userPlace === true).length,
    住所: places.filter((place) => place.isHome === true).length,
  };
  const railButton = (label) => {
    const button = h.root.querySelectorAll('button').find((item) => item.textContent.trim().startsWith(label));
    assert.ok(button, `左栏应有「${label}」`);
    return button;
  };
  for (const [label, count] of Object.entries(expected)) {
    assert.equal(Number(railButton(label).textContent.trim().slice(label.length)), count, `${label} 计数`);
  }
  for (const label of ['住所与默认画风', '本地插画', '从小世界迁入']) assert.ok(railButton(label), label);
  assert.equal(Number(railButton('全部地点').getAttribute('aria-current') === 'true'), 1, '默认停在全部地点');

  railButton('故事地点').click(); await h.settled();
  assert.equal(railButton('故事地点').getAttribute('aria-current'), 'true');
  assert.equal(railButton('全部地点').getAttribute('aria-current'), null);
  assert.match(h.root.textContent, new RegExp(`${expected.故事地点} 处地点`));
  assert.match(h.root.textContent, /折潮港/);
  assert.match(h.root.textContent, /折角巷/);

  railButton('只是地点').click(); await h.settled();
  assert.match(h.root.textContent, /0 处地点/);
  assert.match(h.root.textContent, /没有符合条件的地点/);

  railButton('全部地点').click(); await h.settled();
  assert.match(h.root.textContent, new RegExp(`${expected.全部地点} 处地点`));
  assert.match(h.root.textContent, /所有分类/);
  assert.match(h.root.textContent, /游乐场/);
  assert.doesNotMatch(h.root.textContent, /amusement|aquarium|arcade/);
});

test('列表行有封面缩略图与「编辑地点」，名字进详情、编辑进编辑器', async (t) => {
  const cover = `data:image/png;base64,${PNG.toString('base64')}`;
  const h = await mountLibrary(t, async (rpc) => {
    const created = await rpc('create', { input: { name: 'Cover place', desc: '有封面的一处。' }, revision: 0 });
    assert.equal(created.ok, true);
    const id = created.place?.id ?? created.id;
    const revision = (await rpc('list')).revision;
    assert.equal((await rpc('setCover', { id, dataUrl: cover, revision })).ok, true);
  });
  const picture = h.root.querySelectorAll('img').find((item) => item.getAttribute('alt')?.includes('Cover place'));
  assert.ok(picture, '列表行应读取并显示封面缩略图');
  const row = h.root.querySelectorAll('article').find((item) => item.textContent.includes('Cover place'));
  assert.ok(row);
  assert.ok(row.querySelectorAll('button').some((item) => item.textContent === '编辑地点'));

  h.click('Cover place'); await h.settled();
  assert.match(h.root.textContent, /编辑封面/);
  h.click('返回浏览'); await h.settled();
  h.click('编辑地点'); await h.settled();
  assert.ok(h.root.querySelector('form'), '编辑地点应进入编辑器');
});

test('列表/卡片是显式切换，aria-pressed 与面板存储同步', async (t) => {
  const memo = memoStore();
  const h = await mountLibrary(t, null, { memo });
  const toggle = () => h.root.querySelectorAll('button').find((item) => ['列表视图', '卡片视图'].includes(item.textContent.trim()));
  assert.ok(toggle());
  assert.equal(toggle().getAttribute('aria-pressed'), 'false');
  toggle().click(); await h.settled();
  assert.equal(toggle().textContent, '卡片视图');
  assert.equal(toggle().getAttribute('aria-pressed'), 'true');
  assert.equal(memo.map.get('fpl-browse-view'), 'grid');
  assert.match(h.root.textContent, /江边|游乐场/);
});

test('窄屏结构：左栏仍是一组按钮，列表行带缩略图容器与编辑入口', async (t) => {
  const h = await mountLibrary(t);
  const [rail] = h.root.querySelectorAll('aside');
  assert.ok(rail, '应有左栏');
  assert.match(rail.className, /fpl-rail/);
  assert.ok(rail.querySelectorAll('button').length >= 9, '六项筛选 + 三项设置 + 刷新');
  const rows = h.root.querySelectorAll('article').filter((item) => /fpl-listrow/.test(item.className));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(row.querySelectorAll('button').some((item) => item.textContent === '编辑地点'));
  }
  assert.ok(h.root.querySelectorAll('button').some((item) => item.textContent === '添加地点'));
});

test('host-native locations module exports a mount function', () => {
  assert.equal(typeof mountPlaces, 'function');
});

/* ------------------------------ 本地插画 ------------------------------ */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=', 'base64');
function memoStore() {
  const map = new Map();
  return { map, get: (key, fallback) => map.has(key) ? map.get(key) : fallback, set: (key, value) => { if (value === null) map.delete(key); else map.set(key, value); } };
}
function browserFileStubs(t) {
  const previous = { FileReader: globalThis.FileReader, Image: globalThis.Image };
  globalThis.FileReader = class {
    readAsDataURL(file) { this.result = file.dataUrl; queueMicrotask(() => this.onload?.()); }
  };
  globalThis.Image = class {
    set src(_value) { queueMicrotask(() => { this.naturalWidth = 100; this.naturalHeight = 100; this.onload?.(); }); }
  };
  t.after(() => { globalThis.FileReader = previous.FileReader; globalThis.Image = previous.Image; });
}
const artworkFile = (type = 'image/png', bytes = PNG) => ({
  type, size: bytes.length, dataUrl: `data:${type};base64,${bytes.toString('base64')}`,
  arrayBuffer: async () => bytes,
});
const wait = async () => { for (let i = 0; i < 20; i++) { await flush(); await new Promise((resolve) => setTimeout(resolve, 1)); } };

test('本地插画在地点册：导航进入、导入后刷新仍在、恢复示意', async (t) => {
  browserFileStubs(t);
  const memo = memoStore();
  const h = await mountLibrary(t, null, { memo });
  assert.ok(h.root.textContent.includes('本地插画'));
  h.click('本地插画'); await h.settled();
  assert.match(h.root.textContent, /只存在这台浏览器里，不上传/);
  assert.match(h.root.textContent, /鱼的家/);
  assert.match(h.root.textContent, /傍晚溪边/);
  assert.doesNotMatch(h.root.textContent, /蓝绳与便笺/, 'creek-letter-ending 不显示');

  const input = h.root.querySelectorAll('input').find((item) => item.getAttribute('aria-label')?.includes('鱼的家'));
  assert.ok(input);
  input.files = [artworkFile()];
  input.dispatchEvent(new Event('change'));
  await wait();
  assert.equal(memo.map.get('story-artwork-v1:home-day'), artworkFile().dataUrl);
  assert.match(h.root.textContent, /插画已应用/);
  assert.equal(h.root.querySelectorAll('img').length, 1);

  h.mounted.dispose();
  const reopened = await mountLibrary(t, null, { memo });
  reopened.click('本地插画'); await reopened.settled();
  assert.equal(reopened.root.querySelectorAll('img').length, 1, '刷新（重挂载）后插画仍在');
  const image = reopened.root.querySelectorAll('img')[0];
  image.dispatchEvent(new Event('error'));
  await wait();
  assert.equal(reopened.root.querySelectorAll('img').length, 0, '坏图回落到示意场景');
  assert.match(reopened.root.textContent, /没能显示/);
  reopened.click('恢复示意'); await wait();
  assert.equal(memo.map.has('story-artwork-v1:home-day'), false);
  assert.match(reopened.root.textContent, /已恢复示意/);
});

test('本地插画拒绝不支持的格式，不写浏览器存储', async (t) => {
  browserFileStubs(t);
  const memo = memoStore();
  const h = await mountLibrary(t, null, { memo });
  h.click('本地插画'); await h.settled();
  const input = h.root.querySelectorAll('input').find((item) => item.getAttribute('aria-label')?.includes('鱼的家'));
  input.files = [{ type: 'image/svg+xml', size: 10, arrayBuffer: async () => Buffer.from('<svg/>') }];
  input.dispatchEvent(new Event('change'));
  await wait();
  assert.match(h.root.textContent, /PNG、JPEG 或 WebP/);
  assert.equal(memo.map.size, 0);
  assert.equal(h.root.querySelectorAll('img').length, 0);
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
