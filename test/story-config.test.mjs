import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { StorySecrets } from '../src/story-secrets.js';
import { configGroup, text } from '../src/config.js';
import { SAMPLE_STORY, SAMPLE_VENUE } from './fixtures/story-presets.mjs';

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
  const world = new FunWorld({ dataDir: dir, cfg, now: () => Date.parse('2026-11-21T13:00:00+08:00') });
  await world.start(host);
  const call = (method, payload = {}) => world.webUi().invoke('story', method, [payload]);
  const panel = (id, method, payload = {}) => world.webUi().invoke(id, method, [payload]);
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
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

test('story node limit is editable, zero means unlimited, and the preference survives restart', async (t) => {
  const r = await rig(t);
  const declaration = r.world.webUi().panels.find((panel) => panel.id === 'story');
  assert.ok(declaration.methods.includes('saveStoryNodeLimit'));
  const defaults = success(await r.call('storySettings'));
  assert.equal(defaults.nodeLimit, 16);
  assert.equal(await readFile(join(r.dir, 'fun', 'story-node-limit.json')).catch(() => null), null,
    'reading the default setting must not create a file');

  const long = longStory();
  assert.equal((await r.call('authorValidate', { json: JSON.stringify(long) })).ok, false);
  success(await r.call('saveStoryNodeLimit', { nodeLimit: 20 }));
  assert.equal(success(await r.call('storySettings')).nodeLimit, 20);
  assert.equal(success(await r.call('authorValidate', { json: JSON.stringify(long) })).pack.nodes.length, 20);
  assert.equal((await r.call('saveStoryNodeLimit', { nodeLimit: -1 })).ok, false);
  assert.equal((await r.call('saveStoryNodeLimit', { nodeLimit: 1.5 })).ok, false);

  success(await r.call('saveStoryNodeLimit', { nodeLimit: 0 }));
  success(await r.call('authorImport', { json: JSON.stringify(long) }));
  await r.world.stop();
  await r.world.start(r.host);
  assert.equal(success(await r.call('storySettings')).nodeLimit, 0);
  assert.ok(success(await r.call('authorList')).packs.some((pack) => pack.id === long.id));
  success(await r.call('saveStoryNodeLimit', { nodeLimit: 16 }));
  assert.ok(success(await r.call('authorList')).packs.some((pack) => pack.id === long.id),
    'lowering the authoring limit must not remove existing stories');
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

test('real DPAPI settings survive restart, never echo, and clear invalidates pending direct requests', { skip: process.platform !== 'win32' }, async (t) => {
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
  const saved = success(await r.call('saveStorySettings', { apiUrl: address, apiKey: secret, model: 'test-model-033', imageSource: '' }));
  assert.equal(saved.dm.saved, true);
  assert.equal(saved.dm.model, 'test-model-033');
  assert.equal(saved.dm.apiKeyMask, '••••••••');
  assert.equal(Object.hasOwn(saved.dm, 'apiUrl'), false);
  const file = join(r.dir, 'fun', 'story-secrets.json');
  const persisted = await readFile(file, 'utf8');
  assert.equal(persisted.includes(secret) || persisted.includes(address), false, 'ciphertext must not contain either plaintext value');
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
  assert.equal(outputs.includes(secret) || outputs.includes(address) || stateBytes.includes(secret) || stateBytes.includes(address), false, 'no plaintext in public/state/export/log outputs');
  await writeFile(join(r.dir, 'fun', 'story-images'), 'injected storage obstacle');
  const partial = await r.call('saveStorySettings', { apiUrl: address, apiKey: secret, imageSource: 'another plugin' });
  assert.equal(partial.ok, false);
  assert.equal(partial.partial, 'dm');
  assert.equal(partial.dm.saved, true);
  assert.equal(partial.imageSource, '');
  assert.equal(JSON.stringify(partial).includes(secret) || JSON.stringify(partial).includes(address), false);
  success(await r.call('clearStoryKey'));
});

test('image source settings persist; default receipt is explicit about unknown installation', async (t) => {
  const r = await rig(t);
  const receipt = success(await r.call('storyImage')).image;
  assert.equal(receipt.status, 'delegated');
  assert.equal(receipt.tool, 'imggen_draw');
  assert.match(receipt.message, /未验证.*安装/);
  success(await r.call('saveStorySettings', { imageSource: '指定绘图插件' }));
  assert.equal(success(await r.call('storyImage')).image.source, '指定绘图插件');
  assert.equal((await r.call('saveStorySettings', { imageSource: 'http://name:password@127.0.0.1:8188' })).ok, false);
  await r.world.stop();
  await r.world.start(r.host);
  assert.equal(success(await r.call('storySettings')).imageSource, '指定绘图插件');
  r.cfg.funStoryImages = false;
  assert.equal(success(await r.call('storyImage')).image.status, 'off');
});

test('pending ComfyUI generation never holds the story queue; story movement cancels late results', async (t) => {
  const originalFetch = globalThis.fetch;
  const entered = deferred(); const response = deferred();
  let calls = 0;
  globalThis.fetch = async () => { calls++; entered.resolve(); return response.promise; };
  t.after(() => { globalThis.fetch = originalFetch; });
  const r = await rig(t);
  success(await r.call('saveStorySettings', { imageSource: 'http://127.0.0.1:8188' }));
  const state = await r.start();
  const imagePromise = r.call('storyImage');
  await entered.promise;
  const moved = await Promise.race([r.call('move', step(state)), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('story queue blocked by images')), 1000); timer.unref(); })]);
  success(moved);
  const image = await imagePromise;
  assert.ok(image.ok === false || image.image.status === 'error');
  response.resolve(json({}));
  assert.equal(calls, 1);
  const files = await readdir(join(r.dir, 'fun', 'story-images'));
  assert.equal(files.some((name) => /\.(png|jpg|webp)$/.test(name)), false);
  r.cfg.funStoryImages = false;
  success(await r.call('storyImage'));
  assert.equal(calls, 1);
});
