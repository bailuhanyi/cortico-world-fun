import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { DEFAULTS, configGroup } from '../src/config.js';

function fakeSecrets() {
  let saved = false;
  let loaded = false;
  const store = {
    get status() { return { saved, supported: true, available: saved, apiUrlMask: saved ? '••••••••' : '', apiKeyMask: saved ? '••••••••' : '', model: '' }; },
    async load() { loaded = true; return { ok: true, dm: store.status }; },
    async legacyEndpoint() { return { apiUrl: '', model: '' }; },
    async rewriteKeyOnly() { return { ok: true, dm: store.status }; },
    async cognition(host) { await store.load(); return saved ? { storyDmDirect: true, request: async () => ({ text: 'OK' }) } : host; },
    async testConnection() { return saved ? { ok: true, message: '连接成功。' } : { ok: false, error: '请先保存 API Key。' }; },
    async save() { saved = true; return { ok: true, dm: store.status }; },
    async clear() { saved = false; return { ok: true, dm: store.status }; },
    get loaded() { return loaded; },
  };
  return store;
}

async function boot(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-config-08-'));
  const world = new FunWorld({ dataDir: dir, cfg: options.cfg ?? {}, persist: options.persist,
    ...(options.storySecretsFactory ? { storySecretsFactory: options.storySecretsFactory } : {}) });
  await world.start({ cognition: { request: async () => ({ text: 'host' }) }, log: { info() {}, warn() {} } });
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
  return { dir, world, call: (method, payload = {}) => world.webUi().invoke('story', method, [payload]) };
}

test('0.8 defaults and host config expose three ordinary settings plus fifteen advanced settings', () => {
  assert.equal(DEFAULTS.funStoryFree, true);
  assert.equal(DEFAULTS.funStoryFreeTurns, 200);
  assert.equal(DEFAULTS.funAutoOuting, false);
  assert.equal(DEFAULTS.funShareAfter, true);
  const schema = configGroup().schema.properties;
  assert.equal(Object.keys(schema).length, 18);
  const regular = Object.entries(schema).filter(([, value]) => !String(value.title).startsWith('高级 · '));
  assert.deepEqual(regular.map(([key]) => key), ['worlds.fun.funOn', 'worlds.fun.funAutoOuting', 'worlds.fun.funShareAfter']);
  assert.deepEqual(Object.entries(schema).filter(([, value]) => value['x-hot']).map(([key]) => key),
    ['worlds.fun.funStoryTextOn', 'worlds.fun.funStoryAuthorInChat']);
  assert.equal(schema['worlds.fun.funStoryFreeTurns'].default, undefined);
  assert.equal(schema['worlds.fun.funStoryFreeTurns'].maximum, 200);
});

test('legacy outing/report keys migrate to the new names and writes keep both aliases synchronized', async (t) => {
  const cfg = { funHomeAutoGo: true, funAskReport: false };
  const writes = [];
  const r = await boot(t, { cfg, persist: (patch) => { writes.push({ ...patch }); Object.assign(cfg, patch); } });
  assert.equal(cfg.funAutoOuting, true);
  assert.equal(cfg.funHomeAutoGo, true);
  assert.equal(cfg.funShareAfter, false);
  assert.equal(cfg.funAskReport, false);
  assert.ok(writes.some((patch) => patch.funAutoOuting === true && patch.funHomeAutoGo === true));
  assert.ok(writes.some((patch) => patch.funShareAfter === false && patch.funAskReport === false));
  cfg.funAutoOuting = false;
  r.world.envPromptVars();
  assert.equal(cfg.funHomeAutoGo, false);
});

test('host-default mode never constructs or reads the DPAPI store, including settings and test RPC', async (t) => {
  let constructed = 0;
  const r = await boot(t, { storySecretsFactory: () => { constructed += 1; return fakeSecrets(); } });
  assert.equal(constructed, 0);
  const settings = await r.call('storySettings');
  assert.equal(settings.dmEnabled, false);
  assert.equal(constructed, 0);
  const tested = await r.call('testStoryDm');
  assert.equal(tested.ok, false);
  assert.equal(constructed, 0);
});

test('external DM selector is hot, persists configuration, and exposes a safe connection test', async (t) => {
  const cfg = {};
  let store;
  const r = await boot(t, { cfg, persist: (patch) => Object.assign(cfg, patch),
    storySecretsFactory: () => { store = fakeSecrets(); return store; } });
  const saved = await r.call('saveStorySettings', { dmEnabled: true, apiUrl: 'https://example.test/v1', model: 'test-model' });
  assert.equal(saved.ok, true, saved.error);
  assert.equal(cfg.funStoryDM, true);
  assert.equal(cfg.funStoryDmUrl, 'https://example.test/v1');
  assert.equal(cfg.funStoryDmModel, 'test-model');
  assert.ok(store?.loaded);
  await r.call('saveStorySettings', { apiKey: 'offline-test-key' });
  const tested = await r.call('testStoryDm');
  assert.deepEqual(tested, { ok: true, message: '连接成功。' });
});

test('image selector maps off, delegation, and direct modes without losing loopback validation', async (t) => {
  const cfg = {};
  const r = await boot(t, { cfg, persist: (patch) => Object.assign(cfg, patch) });
  assert.equal((await r.call('saveStorySettings', { imageMode: 'off' })).ok, true);
  assert.equal(cfg.funStoryImages, false);
  assert.equal((await r.call('saveStorySettings', { imageMode: 'delegate' })).ok, true);
  assert.equal(cfg.funStoryImages, true);
  assert.equal(cfg.funStoryImageSource, '');
  const invalid = await r.call('saveStorySettings', { imageMode: 'comfyui', imageSource: 'https://example.test' });
  assert.equal(invalid.ok, false);
  const direct = await r.call('saveStorySettings', { imageMode: 'comfyui', imageSource: 'http://127.0.0.1:8188' });
  assert.equal(direct.ok, true, direct.error);
  assert.equal(cfg.funStoryImages, true);
  assert.equal(cfg.funStoryImageSource, 'http://127.0.0.1:8188');
});
