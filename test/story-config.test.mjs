import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { StorySecrets } from '../src/story-secrets.js';
import { DEFAULTS, configGroup, text } from '../src/config.js';
import { SAMPLE_STORY, SAMPLE_VENUE } from './fixtures/story-presets.mjs';
import { cleanup } from './tmp.mjs';

const VENUE = { ...SAMPLE_VENUE, id: 'user-config-venue' };
const STORY = { ...SAMPLE_STORY, id: 'user-config-story', placeId: VENUE.id };
function longStory(count = 20) {
  const area = VENUE.areas[0];
  const nodes = Array.from({ length: count }, (_, index) => ({ id: `node-${index}`, area, event: `A small event at node ${index}.`,
    ...(index + 1 < count ? { next: `node-${index + 1}` } : {}) }));
  return { version: 1, id: 'long-config-story', title: 'A longer configurable story', placeId: VENUE.id, start: 'node-0', nodes };
}
const success = (result) => { assert.equal(result?.ok, true, result?.error); return result; };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const step = (state) => ({ tripId: state.trip.id, stamp: state.trip.stamp });
const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

async function rig(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-config-033-'));
  const cfg = { funStoryDM: true, funStoryImages: true, ...options.cfg };
  const entries = [];
  const host = { cognition: options.cognition, log: { info: (...args) => entries.push(args), warn: (...args) => entries.push(args) } };
  const world = new FunWorld({ dataDir: dir, cfg, now: () => Date.parse('2026-11-21T13:00:00+08:00'), ...(options.persist ? { persist: options.persist } : {}) });
  await world.start(host);
  const call = (method, payload = {}) => world.webUi().invoke('story', method, [payload]);
  const panel = (id, method, payload = {}) => world.webUi().invoke(id, method, [payload]);
  cleanup(t, dir, world);
  const start = async () => {
    success(await panel('places', 'save', VENUE));
    success(await call('authorImport', { json: JSON.stringify(STORY), replace: true }));
    const state = success(await call('status'));
    const card = state.catalog.find((item) => item.id === STORY.id);
    return success(await call('start', { packId: card.id, revision: card.revision, startStamp: state.startStamp }));
  };
  return { dir, cfg, host, entries, world, call, panel, start };
}

test('new install ships the four approved built-in stories and settings reads do not create data', async (t) => {
  const r = await rig(t);
  const state = success(await r.call('status'));
  assert.deepEqual(state.catalog.map((entry) => entry.id), ['foldtide-reply-lite', 'drizzled-list', 'bridge-echo-solo', 'swapped-plaque-riddle']);
  assert.ok(state.catalog.every((entry) => entry.builtin === true));
  assert.equal(Object.hasOwn(state, 'sample'), false);
  assert.equal((await r.call('installSample')).ok, false);
  const settings = success(await r.call('storySettings'));
  assert.equal(settings.dm.saved, false);
  assert.equal(settings.imageSource, '');
  assert.deepEqual(await readdir(r.dir), []);
  const schema = Object.keys(configGroup().schema.properties);
  assert.equal(schema.some((name) => /apiUrl|apiKey/i.test(name)), false);
  for (const lang of ['zh', 'en']) {
    const strings = text(lang).config;
    for (const key of ['storyDmApiUrl', 'storyDmApiKey', 'storyImageSource', 'storyEditorDirty', 'storyEmptyBody']) assert.equal(typeof strings[key], 'string');
  }
});

test('story node limit reads configuration, zero means unlimited, and lowering it keeps existing stories', async (t) => {
  const r = await rig(t);
  const declaration = r.world.webUi().panels.find((panel) => panel.id === 'story');
  assert.equal(declaration.methods.includes('saveStoryNodeLimit'), false, '节点上限改在配置页，面板不再有入口');
  const defaults = success(await r.call('storySettings'));
  assert.equal(defaults.nodeLimit, 16);
  assert.equal(await readFile(join(r.dir, 'fun', 'story-node-limit.json')).catch(() => null), null,
    'reading the default setting must not create a file');

  const long = longStory();
  assert.equal((await r.call('authorValidate', { json: JSON.stringify(long) })).ok, false);
  r.cfg.funStoryNodeLimit = 20;
  assert.equal(success(await r.call('storySettings')).nodeLimit, 20, '配置热改立即生效');
  assert.equal(success(await r.call('authorValidate', { json: JSON.stringify(long) })).pack.nodes.length, 20);
  r.cfg.funStoryNodeLimit = -1;
  assert.equal(success(await r.call('storySettings')).nodeLimit, 0, '坏值回落到不限而不是抛错');

  r.cfg.funStoryNodeLimit = 0;
  // 故事包必须绑在一处真实地点上（0.7.8 起地点不存在的包会被导入拒收）。
  success(await r.panel('places', 'save', VENUE));
  success(await r.call('authorImport', { json: JSON.stringify(long) }));
  await r.world.stop();
  await r.world.start(r.host);
  assert.equal(success(await r.call('storySettings')).nodeLimit, 0);
  assert.ok(success(await r.call('authorList')).packs.some((pack) => pack.id === long.id));
  r.cfg.funStoryNodeLimit = 16;
  assert.ok(success(await r.call('authorList')).packs.some((pack) => pack.id === long.id),
    'lowering the authoring limit must not remove existing stories');
});

test('old story-node-limit.json migrates into config once and a configured value always wins', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-node-limit-migrate-'));
  cleanup(t, dir);
  await mkdir(join(dir, 'fun'), { recursive: true });
  await writeFile(join(dir, 'fun', 'story-node-limit.json'), JSON.stringify({ version: 1, nodeLimit: 22 }));
  const patches = [];
  const cfg = {};
  const world = new FunWorld({ dataDir: dir, cfg, persist: (patch) => { patches.push(patch); Object.assign(cfg, patch); } });
  await world.start({ log: { info() {}, warn() {} } });
  assert.equal(cfg.funStoryNodeLimit, 22, '旧文件的 22 个节点不能丢');
  assert.equal(patches.filter((patch) => 'funStoryNodeLimit' in patch).length, 1);
  assert.equal(await readFile(join(dir, 'fun', 'story-node-limit.json')).catch(() => null), null, '迁移后旧文件清掉，不会每次启动重搬');
  await world.stop();
  await world.start({ log: { info() {}, warn() {} } });
  assert.equal(patches.filter((patch) => 'funStoryNodeLimit' in patch).length, 1, '第二次启动不再写故事长度');
  assert.equal(success(await world.webUi().invoke('story', 'storySettings', [{}])).nodeLimit, 22);
  await world.stop();

  // 宿主会把「默认值」合并进 cfg：旧文件仍要能搬，不能被「键已存在」挡住。
  const merged = await mkdtemp(join(tmpdir(), 'fun-node-limit-merged-'));
  cleanup(t, merged);
  await mkdir(join(merged, 'fun'), { recursive: true });
  await writeFile(join(merged, 'fun', 'story-node-limit.json'), JSON.stringify({ version: 1, nodeLimit: 22 }));
  const mergedPatches = [];
  const mergedCfg = { ...DEFAULTS };
  const mergedWorld = new FunWorld({ dataDir: merged, cfg: mergedCfg, persist: (patch) => { mergedPatches.push(patch); Object.assign(mergedCfg, patch); } });
  await mergedWorld.start({ log: { info() {}, warn() {} } });
  assert.equal(mergedCfg.funStoryNodeLimit, 22, '合并默认值的 cfg 下也要迁移');
  assert.equal(await readFile(join(merged, 'fun', 'story-node-limit.json')).catch(() => null), null);
  await mergedWorld.stop();
  await mergedWorld.start({ log: { info() {}, warn() {} } });
  assert.equal(mergedPatches.filter((patch) => 'funStoryNodeLimit' in patch).length, 1, '只搬一次');
  await mergedWorld.stop();

  const configured = { funStoryNodeLimit: 5 };
  const other = await mkdtemp(join(tmpdir(), 'fun-node-limit-config-'));
  cleanup(t, other);
  await mkdir(join(other, 'fun'), { recursive: true });
  await writeFile(join(other, 'fun', 'story-node-limit.json'), JSON.stringify({ version: 1, nodeLimit: 22 }));
  const second = new FunWorld({ dataDir: other, cfg: configured, persist: () => { throw new Error('configured value must not be overwritten'); } });
  await second.start({ log: { info() {}, warn() {} } });
  assert.equal(success(await second.webUi().invoke('story', 'storySettings', [{}])).nodeLimit, 5);
  assert.equal(await readFile(join(other, 'fun', 'story-node-limit.json')).catch(() => null), null, '配置里已有非默认值时，旧文件清掉但不覆盖');
  await second.stop();
});

test('author aliases preserve read/write permissions and preview/playtest isolation', async (t) => {
  const r = await rig(t);
  const declaration = r.world.webUi().panels.find((panel) => panel.id === 'story');
  for (const method of ['storySettings', 'storyImageRead', 'authorList', 'authorValidate', 'authorPreview', 'authorPlaytest', 'authorExport']) assert.ok(declaration.getMethods.includes(method));
  for (const method of ['saveStorySettings', 'clearStoryKey', 'storyImage', 'authorImport', 'authorRemove']) {
    assert.ok(declaration.methods.includes(method));
    assert.equal(declaration.getMethods.includes(method), false);
  }
  success(await r.panel('places', 'save', VENUE));
  const before = await readFile(r.world.stateFile()).catch(() => null);
  success(await r.call('authorValidate', { json: JSON.stringify(STORY) }));
  success(await r.call('authorPreview', { json: JSON.stringify(STORY) }));
  success(await r.call('authorPlaytest', { json: JSON.stringify(STORY), path: [] }));
  assert.deepEqual(await readFile(r.world.stateFile()).catch(() => null), before);
  assert.equal(success(await r.call('authorList')).packs.filter((pack) => !pack.builtin).length, 0);
  success(await r.call('authorImport', { json: JSON.stringify(STORY) }));
  assert.equal(success(await r.call('authorList')).packs.filter((pack) => !pack.builtin).length, 1);
});

test('host cognition remains the default and failures keep manual story actions available', async (t) => {
  let requests = 0;
  const r = await rig(t, { cognition: { request: async () => { requests++; throw new Error('host error must remain private'); } } });
  const started = await r.start();
  const state = success(await r.call('move', step(started)));
  const failed = await r.call('dmPropose', { ...step(state), requestId: 'host-failure-request-0001' });
  assert.equal(failed.ok, false);
  assert.equal(requests, 1);
  assert.equal(JSON.stringify(failed).includes('host error'), false);
  const current = success(await r.call('status'));
  assert.equal(current.dm.budget.calls, 1);
  success(await r.call('choose', { ...step(current), choiceId: current.trip.pending.id, optionId: 'follow' }));
});

test('real DPAPI key survives restart, never echoes, and clear invalidates pending direct requests', { skip: process.platform !== 'win32' }, async (t) => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  let pending;
  let entered;
  let protocolValid = false;
  const secret = ['only', 'synthetic', 'test', 'credential', '033'].join('-');
  const address = 'https://dm.example.invalid/v1';
  globalThis.fetch = async (url, init) => {
    requestCount++;
    const body = JSON.parse(init.body);
    protocolValid = url.endsWith('/v1/chat/completions') && body.model === 'test-model-033' && init.headers.Authorization === `Bearer ${secret}`;
    if (pending) { entered.resolve(); return pending.promise; }
    return json({ choices: [{ message: { content: JSON.stringify({ narration: '主持建议沿溪看看，尚未执行。', optionId: 'follow' }) } }], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const r = await rig(t);
  // 地址与模型在配置里；密钥仍只走 DPAPI。
  r.cfg.funStoryDmUrl = address;
  r.cfg.funStoryDmModel = 'test-model-033';
  const saved = success(await r.call('saveStorySettings', { apiKey: secret }));
  assert.equal(saved.dm.saved, true);
  assert.equal(saved.dm.apiKeyMask, '••••••••');
  assert.equal(Object.hasOwn(saved.dm, 'apiUrl'), false);
  assert.equal(r.cfg.funStoryDmUrl, address);
  assert.equal(r.cfg.funStoryDmModel, 'test-model-033');
  const file = join(r.dir, 'fun', 'story-secrets.json');
  const persisted = await readFile(file, 'utf8');
  assert.equal(persisted.includes(secret), false, 'ciphertext must not contain the plaintext key');
  const reopened = new StorySecrets({ dataDir: r.dir });
  success(await reopened.load());
  assert.equal(reopened.status.available, true, 'new instance must decrypt the saved DPAPI ciphertext');
  await r.world.stop();
  await r.world.start(r.host);
  assert.equal(success(await r.call('storySettings')).dm.saved, true);
  const started = await r.start();
  const state = success(await r.call('move', step(started)));
  const proposed = success(await r.call('dmPropose', { ...step(state), requestId: 'direct-first-request-0001' }));
  assert.equal(requestCount, 1);
  assert.equal(protocolValid, true);
  assert.equal(proposed.dm.budget.calls, 1);
  assert.equal(proposed.dm.proposal.optionId, 'follow');
  assert.equal(proposed.trip.stamp, state.trip.stamp);
  pending = deferred(); entered = deferred();
  const waiting = r.call('dmPropose', { ...step(state), requestId: 'direct-second-request-0002' });
  await entered.promise;
  const cleared = success(await r.call('clearStoryKey'));
  assert.equal(cleared.dm.saved, false);
  assert.equal((await waiting).ok, false);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
  pending.resolve(json({ choices: [{ message: { content: JSON.stringify({ narration: '迟到提议。', optionId: 'follow' }) } }] }));
  const current = success(await r.call('status'));
  assert.equal(current.dm.proposal, null);
  assert.equal(current.dm.budget.calls, 2);
  success(await r.call('choose', { ...step(current), choiceId: current.trip.pending.id, optionId: 'follow' }));
  const outputs = JSON.stringify([saved, cleared, proposed, current, r.entries, r.world.envPromptVars(), await r.call('authorExport', { id: STORY.id })]);
  const stateBytes = await readFile(r.world.stateFile(), 'utf8');
  const configText = JSON.stringify(r.cfg);
  assert.equal(outputs.includes(secret) || stateBytes.includes(secret), false, 'no key in public/state/export/log outputs');
  assert.equal(configText.includes(secret), false, 'no key in ordinary configuration');
  // 工作流写失败时密钥仍算保存成功，返回 partial: dm。
  await writeFile(join(r.dir, 'fun', 'story-images'), 'injected storage obstacle');
  const workflow = JSON.stringify({ '1': { class_type: 'CLIPTextEncode', inputs: { text: '{{prompt}}' } } });
  const partial = await r.call('saveStorySettings', { apiKey: secret, workflow });
  assert.equal(partial.ok, false);
  assert.equal(partial.partial, 'dm');
  assert.equal(partial.dm.saved, true);
  assert.equal(partial.imageWorkflow, '');
  assert.equal(JSON.stringify(partial).includes(secret), false);
  success(await r.call('clearStoryKey'));
});

test('image source comes from configuration; the panel no longer writes it', async (t) => {
  const r = await rig(t);
  const receipt = success(await r.call('storyImage')).image;
  assert.equal(receipt.status, 'delegated');
  assert.equal(receipt.tool, 'imggen_draw');
  assert.match(receipt.message, /未验证.*安装/);
  r.cfg.funStoryImageSource = '指定绘图插件';
  assert.equal(success(await r.call('storyImage')).image.source, '指定绘图插件');
  assert.equal(success(await r.call('storySettings')).imageSource, '指定绘图插件');
  // 老入口必须明确报错，不能悄悄忽略。
  const moved = await r.call('saveStorySettings', { imageSource: '指定绘图插件' });
  assert.equal(moved.ok, false);
  assert.match(moved.error, /配置/);
  r.cfg.funStoryImageSource = 'http://name:password@127.0.0.1:8188';
  const invalid = success(await r.call('storyImage')).image;
  assert.equal(invalid.status, 'unavailable');
  assert.match(invalid.message, /图片来源设置无效/);
  r.cfg.funStoryImageSource = '指定绘图插件';
  await r.world.stop();
  await r.world.start(r.host);
  assert.equal(success(await r.call('storySettings')).imageSource, '指定绘图插件');
  r.cfg.funStoryImages = false;
  assert.equal(success(await r.call('storyImage')).image.status, 'off');
});

test('legacy story-images settings.json migrates its source into config and keeps the workflow only', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-image-source-migrate-'));
  cleanup(t, dir);
  await mkdir(join(dir, 'fun', 'story-images'), { recursive: true });
  await writeFile(join(dir, 'fun', 'story-images', 'settings.json'), JSON.stringify({ source: '旧的绘图插件', workflow: '' }));
  const patches = [];
  const cfg = {};
  const world = new FunWorld({ dataDir: dir, cfg, persist: (patch) => { patches.push(patch); Object.assign(cfg, patch); } });
  await world.start({ log: { info() {}, warn() {} } });
  assert.equal(cfg.funStoryImageSource, '旧的绘图插件', '旧来源不能丢');
  const stored = JSON.parse(await readFile(join(dir, 'fun', 'story-images', 'settings.json'), 'utf8'));
  assert.deepEqual(Object.keys(stored), ['workflow'], 'settings.json 只留工作流');
  assert.equal(patches.filter((patch) => 'funStoryImageSource' in patch).length, 1);
  await world.stop();
  await world.start({ log: { info() {}, warn() {} } });
  assert.equal(patches.filter((patch) => 'funStoryImageSource' in patch).length, 1, '第二次启动不再写来源');
  assert.equal(success(await world.webUi().invoke('story', 'storySettings', [{}])).imageSource, '旧的绘图插件');
  await world.stop();
});

test('top-bar auto-image switch persists, validates, and rolls back a failed write', async (t) => {
  const patches = [];
  const r = await rig(t, { persist: (patch) => { patches.push(patch); } });
  const before = success(await r.call('status'));
  assert.equal(before.images.auto, true);
  assert.equal(before.images.masterOn, true);
  const off = success(await r.call('saveStoryAutoImages', { auto: false }));
  assert.equal(off.autoImages, false);
  assert.equal(r.cfg.funStoryAutoImages, false);
  assert.equal(patches.filter((patch) => 'funStoryAutoImages' in patch).at(-1).funStoryAutoImages, false);
  assert.equal(success(await r.call('status')).images.auto, false);
  const bad = await r.call('saveStoryAutoImages', { auto: 'yes' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /只接受/);
  success(await r.call('saveStoryAutoImages', { auto: true }));
  assert.equal(success(await r.call('status')).images.auto, true);

  const dir = await mkdtemp(join(tmpdir(), 'fun-auto-images-fail-'));
  cleanup(t, dir);
  const cfg = { funStoryAutoImages: true };
  const failing = new FunWorld({ dataDir: dir, cfg, persist: () => { throw new Error('disk full'); } });
  await failing.start({ log: { info() {}, warn() {} } });
  const failed = await failing.webUi().invoke('story', 'saveStoryAutoImages', [{ auto: false }]);
  assert.equal(failed.ok, false);
  assert.equal(failed.autoImages, true, '落盘失败时回滚到原值');
  assert.equal(cfg.funStoryAutoImages, true);
  await failing.stop();
});

test('pending ComfyUI generation never holds the story queue; story movement cancels late results', async (t) => {
  const originalFetch = globalThis.fetch;
  const entered = deferred(); const response = deferred();
  let calls = 0;
  globalThis.fetch = async () => { calls++; entered.resolve(); return response.promise; };
  t.after(() => { globalThis.fetch = originalFetch; });
  const r = await rig(t);
  r.cfg.funStoryImageSource = 'http://127.0.0.1:8188';
  const state = await r.start();
  const imagePromise = r.call('storyImage');
  await entered.promise;
  const moved = await Promise.race([r.call('move', step(state)), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('story queue blocked by images')), 1000); timer.unref(); })]);
  success(moved);
  const image = await imagePromise;
  assert.ok(image.ok === false || image.image.status === 'error');
  response.resolve(json({}));
  assert.equal(calls, 1);
  const files = await readdir(join(r.dir, 'fun', 'story-images')).catch(() => []);
  assert.equal(files.some((name) => /\.(png|jpg|webp)$/.test(name)), false);
  r.cfg.funStoryImages = false;
  success(await r.call('storyImage'));
  assert.equal(calls, 1);
});
