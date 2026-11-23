import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { StorySecrets, createDpapiCrypto, storyDmErrorMessage } from '../src/story-secrets.js';

const API = 'https://private-api.invalid/v1';
const KEY = 'r1-only-super-secret-key';
const LEAK = `${API} ${KEY} private request body`;
const root = resolve(import.meta.dirname, '..', '..');
const fixtures = [];
test.after(async () => {
  for (const dir of fixtures) {
    assert.equal(dir.startsWith(join(root, '.r1-secrets-')), true);
    await rm(dir, { recursive: true, force: true });
  }
});
async function fixture() {
  const dir = await mkdtemp(join(root, '.r1-secrets-'));
  fixtures.push(dir);
  return dir;
}
function encryption() {
  // Test key is memory-only. No OS credential store or real API is touched.
  const key = randomBytes(32);
  return {
    supported: true,
    async protect(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
    },
    async unprotect(ciphertext) {
      const bytes = Buffer.from(ciphertext, 'base64');
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
    },
  };
}
function response(overrides = {}) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ narration: '主持只提出待确认的选项。', optionId: 'keep' }) } }],
    usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 },
    ...overrides,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function noLeak(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of [API, KEY, LEAK]) assert.equal(serialized.includes(secret), false);
}
const deferred = () => {
  let resolvePromise;
  const promise = new Promise((resolveValue) => { resolvePromise = resolveValue; });
  return { promise, resolve: resolvePromise };
};

 test('both values are encrypted, masked, restart-readable, and never written into config/state', async () => {
  const dataDir = await fixture();
  const crypto = encryption();
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); return response(); };
  const first = new StorySecrets({ dataDir, crypto, fetch });
  assert.deepEqual(await first.load(), { ok: true, dm: first.status });
  const saved = await first.save({ apiUrl: API, apiKey: KEY });
  assert.equal(saved.ok, true);
  assert.equal(saved.dm.saved, true);
  assert.equal(saved.dm.apiUrlMask, '••••••••');
  assert.equal(saved.dm.apiKeyMask, '••••••••');
  noLeak(saved);
  const raw = await readFile(join(dataDir, 'fun', 'story-secrets.json'), 'utf8');
  noLeak(raw);
  assert.equal(JSON.parse(raw).scheme, 'windows-dpapi-current-user');
  assert.deepEqual(await readdir(join(dataDir, 'fun')), ['story-secrets.json']);
  const second = new StorySecrets({ dataDir, crypto, fetch });
  assert.equal((await second.load()).ok, true);
  const provider = await second.cognition(null);
  assert.deepEqual(Object.keys(provider).sort(), ['request', 'storyDmDirect']);
  noLeak(provider);
  const result = await provider.request({ brief: '只返回当前选项', tools: [], hint: { rounds: 1 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${API}/chat/completions`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${KEY}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    messages: [{ role: 'user', content: '只返回当前选项' }], stream: false,
  });
  assert.deepEqual(result.usage, { inputTokens: 11, outputTokens: 5, totalTokens: 16 });
  noLeak(result);
});

test('model name belongs to the user: set sends it, blank omits it, later edits keep credentials', async () => {
  const dataDir = await fixture();
  const calls = [];
  const store = new StorySecrets({ dataDir, crypto: encryption(), fetch: async (url, init) => { calls.push(init); return response(); } });
  const saved = await store.save({ apiUrl: API, apiKey: KEY, model: 'my-local-model' });
  assert.equal(saved.ok, true);
  assert.equal(saved.dm.model, 'my-local-model');
  const provider = await store.cognition(null);
  await provider.request({ brief: 'x' });
  assert.equal(JSON.parse(calls.at(-1).body).model, 'my-local-model');
  const changed = await store.save({ model: '' });
  assert.equal(changed.ok, true, 'model-only change reuses the saved credentials');
  assert.equal(changed.dm.model, '');
  const after = await store.cognition(null);
  await after.request({ brief: 'x' });
  assert.equal(Object.hasOwn(JSON.parse(calls.at(-1).body), 'model'), false, 'blank model sends no model field');
});

test('0.7.3 key-only ciphertext: endpoint and model come from config, legacy record migrates once', async () => {
  const dataDir = await fixture();
  const crypto = encryption();
  const config = { url: '', model: '' };
  const calls = [];
  const store = new StorySecrets({ dataDir, crypto, url: () => config.url, model: () => config.model,
    fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body), headers: init.headers }); return response(); } });
  await store.load();
  const saved = await store.save({ apiKey: KEY });
  assert.equal(saved.ok, true);
  assert.equal(saved.dm.saved, true);
  assert.equal(saved.dm.model, '', '密钥记录不再带模型');
  noLeak(await readFile(join(dataDir, 'fun', 'story-secrets.json'), 'utf8'));
  const provider = await store.cognition(null);
  await assert.rejects(provider.request({ brief: 'x' }), { code: 'NO_URL' });
  config.url = API; config.model = 'config-model';
  await provider.request({ brief: 'x' });
  assert.equal(calls[0].url, `${API}/chat/completions`);
  assert.equal(calls[0].body.model, 'config-model');
  assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
  noLeak(calls[0].body);

  // 旧密文（地址 + 模型在里面）先读出、再重写成只含密钥。
  const legacyDir = await fixture();
  const older = new StorySecrets({ dataDir: legacyDir, crypto });
  await older.save({ apiUrl: API, apiKey: KEY, model: 'legacy-model' });
  assert.deepEqual(await older.legacyEndpoint(), { apiUrl: API, model: 'legacy-model' });
  assert.equal((await older.rewriteKeyOnly()).ok, true);
  assert.deepEqual(await older.legacyEndpoint(), { apiUrl: '', model: '' });
  const rewritten = await readFile(join(legacyDir, 'fun', 'story-secrets.json'), 'utf8');
  noLeak(rewritten);
  assert.equal(rewritten.includes(Buffer.from(API).toString('base64').slice(0, 8)), false);
  const moved = new StorySecrets({ dataDir: legacyDir, crypto, url: () => API, model: () => 'moved-model',
    fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return response(); } });
  const movedProvider = await moved.cognition(null);
  await movedProvider.request({ brief: 'x' });
  assert.equal(calls.at(-1).url, `${API}/chat/completions`);
  assert.equal(calls.at(-1).body.model, 'moved-model');
});

test('host cognition is unchanged when unset, omitted values preserve, paired blanks clear', async () => {
  const dataDir = await fixture();
  const host = { request: async () => ({ text: 'host' }) };
  const store = new StorySecrets({ dataDir, crypto: encryption(), fetch: () => assert.fail('no real network') });
  assert.equal(await store.cognition(host), host);
  assert.equal((await store.save({})).ok, true);
  assert.equal((await store.save({ apiUrl: API, apiKey: KEY })).ok, true);
  assert.equal((await store.save({})).dm.saved, true);
  for (const input of [{ apiUrl: API }, { apiUrl: API, apiKey: '' }]) {
    const result = await store.save(input);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_PAIR');
    noLeak(result);
  }
  // 0.7.3：只提交 API Key 是正常路径（地址与模型在配置里）。
  assert.equal((await store.save({ apiKey: KEY })).ok, true);
  assert.equal(store.status.saved, true);
  assert.equal((await store.save({ apiUrl: '', apiKey: '' })).ok, true);
  assert.equal(store.status.saved, false);
  assert.equal(await store.cognition(host), host);
  assert.deepEqual(await readdir(join(dataDir, 'fun')), []);
});

test('invalid URL/key fields never reach encryption, disk, or fetch', async () => {
  const dataDir = await fixture();
  const crypto = encryption();
  crypto.protect = () => assert.fail('invalid input reached encryption');
  const store = new StorySecrets({ dataDir, crypto, fetch: () => assert.fail('no network') });
  for (const apiUrl of ['file:///secret', 'not-a-url', 'https://name:password@private-api.invalid', `${API}?key=${KEY}`, `${API}#${KEY}`, `${API}\r\nHeader: value`]) {
    const result = await store.save({ apiUrl, apiKey: KEY });
    assert.equal(result.code, 'INVALID_URL');
    noLeak(result);
  }
  for (const apiKey of [`${KEY}\r\nInjected: header`, 'a'.repeat(4097)]) {
    assert.equal((await store.save({ apiUrl: API, apiKey })).code, 'INVALID_KEY');
  }
  assert.deepEqual(await readdir(dataDir), []);
});

test('Windows-only implementation fails closed without spawning or selecting another model', async () => {
  const crypto = createDpapiCrypto({ platform: 'linux', spawnImpl: () => assert.fail('must not spawn') });
  await assert.rejects(crypto.protect(LEAK), (error) => {
    assert.equal(error.code, 'WINDOWS_ONLY');
    noLeak(error.message);
    return true;
  });
  const dataDir = await fixture();
  const store = new StorySecrets({ dataDir, crypto, fetch: () => assert.fail('must not fetch') });
  const result = await store.save({ apiUrl: API, apiKey: KEY });
  assert.equal(result.code, 'WINDOWS_ONLY');
  assert.match(result.error, /仅 Windows/);
  assert.equal(result.dm.supported, false);
  noLeak(result);
  assert.deepEqual(await readdir(dataDir), []);
  const host = { request() {} };
  assert.equal(await store.cognition(host), host);
});

test('a saved encrypted file on an unsupported platform is unavailable, never host fallback', async () => {
  const dataDir = await fixture();
  const windows = new StorySecrets({ dataDir, crypto: encryption() });
  await windows.save({ apiUrl: API, apiKey: KEY });
  const store = new StorySecrets({ dataDir, crypto: createDpapiCrypto({ platform: 'linux' }), fetch: () => assert.fail('no network') });
  const loaded = await store.load();
  assert.equal(loaded.ok, false);
  assert.equal(loaded.dm.saved, true);
  assert.equal(loaded.dm.available, false);
  assert.equal(loaded.code, 'WINDOWS_ONLY');
  const provider = await store.cognition({ request() { assert.fail('must not fall back'); } });
  await assert.rejects(provider.request({ brief: LEAK }), { code: 'WINDOWS_ONLY' });
  noLeak(loaded);
});

test('DPAPI uses a fixed command, secrets only on stdin, ciphertext only on stdout', async () => {
  const calls = [];
  const spawnImpl = (file, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new Writable({ write(chunk, encoding, done) { calls.at(-1).stdin += chunk.toString(); done(); } });
    child.kill = () => {};
    calls.push({ file, args, options, stdin: '' });
    child.stdin.on('finish', () => {
      child.stdout.end(args.at(-1).includes('::Unprotect(') ? LEAK : Buffer.from('opaque-ciphertext').toString('base64'));
      queueMicrotask(() => child.emit('close', 0));
    });
    return child;
  };
  const crypto = createDpapiCrypto({ platform: 'win32', spawnImpl });
  const ciphertext = await crypto.protect(LEAK);
  assert.equal(ciphertext, Buffer.from('opaque-ciphertext').toString('base64'));
  assert.equal(calls[0].stdin, LEAK);
  noLeak({ file: calls[0].file, args: calls[0].args, options: calls[0].options });
  assert.deepEqual(calls[0].options.stdio, ['pipe', 'pipe', 'ignore']);
  assert.equal(calls[0].options.windowsHide, true);
  assert.match(calls[0].args.at(-1), /CurrentUser/);
  assert.match(calls[0].args.at(-1), /InputEncoding/);
  assert.equal(await crypto.unprotect(ciphertext), LEAK);
  assert.equal(calls[1].stdin, ciphertext);
  noLeak(calls[1].args);
});

test('DPAPI spawn failure, stderr, and timeout errors never echo child input or output', async () => {
  const failed = createDpapiCrypto({ platform: 'win32', spawnImpl() { throw new Error(LEAK); } });
  await assert.rejects(failed.protect(LEAK), (error) => {
    assert.equal(error.code, 'SECRET_CRYPTO');
    noLeak(error.message);
    return true;
  });
  let killed = false;
  const stalled = createDpapiCrypto({ platform: 'win32', timeout: 2, spawnImpl() {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => { killed = true; };
    return child;
  } });
  await assert.rejects(stalled.protect(LEAK), { code: 'SECRET_CRYPTO' });
  assert.equal(killed, true);
});

test('adapter sends the model the user saved and accepts the full completion endpoint', async () => {
  const dataDir = await fixture();
  let requested;
  const store = new StorySecrets({ dataDir, crypto: encryption(), fetch: async (url, init) => {
    requested = { url, body: JSON.parse(init.body) };
    return response({ usage: { prompt_tokens: 2 } });
  } });
  await store.save({ apiUrl: `${API}/chat/completions/`, apiKey: KEY, model: 'host-selected-model' });
  const provider = await store.cognition(null);
  const result = await provider.request({ brief: 'current scene' });
  assert.equal(requested.url, `${API}/chat/completions`);
  assert.equal(requested.body.model, 'host-selected-model');
  assert.equal(Object.hasOwn(result, 'usage'), false);
});

test('HTTP, network, and malformed responses use readable safe errors without reading failed bodies', async () => {
  const dataDir = await fixture();
  const outcomes = [
    ['API_UNAUTHORIZED', () => ({ ok: false, status: 401, text: () => assert.fail('do not read credential-bearing error body') })],
    ['API_UNAUTHORIZED', () => ({ ok: false, status: 403 })],
    ['API_QUOTA', () => ({ ok: false, status: 429 })],
    ['API_HTTP', () => ({ ok: false, status: 500 })],
    ['API_NETWORK', () => { throw new Error(LEAK); }],
    ['API_FORMAT', () => new Response(LEAK)],
    ['API_FORMAT', () => response({ choices: [] })],
    ['API_FORMAT', () => response({ choices: [{ message: { content: LEAK } }] })],
    ['API_FORMAT', () => response({ choices: [{ message: { content: 'x'.repeat(2501) } }] })],
    ['API_FORMAT', () => new Response('x'.repeat(70 * 1024))],
  ];
  let action;
  const store = new StorySecrets({ dataDir, crypto: encryption(), fetch: async () => action() });
  await store.save({ apiUrl: API, apiKey: KEY });
  const provider = await store.cognition();
  for (const [code, run] of outcomes) {
    action = run;
    await assert.rejects(provider.request({ brief: 'current scene' }), (error) => {
      assert.equal(error.code, code);
      assert.equal(storyDmErrorMessage(error), error.message);
      noLeak(error.message);
      assert.equal(Object.hasOwn(error, 'cause'), false);
      return true;
    });
  }
  assert.equal(storyDmErrorMessage(new Error(LEAK)), null);
});

test('local API timeout settles even when injected fetch ignores AbortSignal', async () => {
  const dataDir = await fixture();
  const entered = deferred();
  let signal;
  const store = new StorySecrets({ dataDir, crypto: encryption(), timeout: 200,
    fetch: async (url, init) => { signal = init.signal; entered.resolve(); return new Promise(() => {}); } });
  await store.save({ apiUrl: API, apiKey: KEY });
  const provider = await store.cognition();
  const pending = provider.request({ brief: 'scene' });
  await entered.promise;
  await assert.rejects(pending, (error) => {
    assert.equal(error.code, 'API_TIMEOUT');
    assert.match(error.message, /超时/);
    noLeak(error.message);
    return true;
  });
  assert.equal(signal.aborted, true);
});

test('clear immediately aborts pending requests, invalidates captured adapters, deletes ciphertext, and falls back', async () => {
  const dataDir = await fixture();
  const entered = deferred();
  const late = deferred();
  let signal;
  let invalidations = 0;
  const store = new StorySecrets({ dataDir, crypto: encryption(), onInvalidate: () => invalidations++,
    fetch: async (url, init) => { signal = init.signal; entered.resolve(); return late.promise; } });
  await store.save({ apiUrl: API, apiKey: KEY });
  const provider = await store.cognition();
  const request = provider.request({ brief: 'scene' });
  await entered.promise;
  const clearing = store.clear();
  assert.equal(signal.aborted, true);
  assert.equal(invalidations, 2);
  await assert.rejects(request, { code: 'SECRET_REVOKED' });
  assert.equal((await clearing).ok, true);
  assert.equal(store.status.saved, false);
  await assert.rejects(provider.request({ brief: 'scene' }), { code: 'SECRET_REVOKED' });
  late.resolve(response());
  const host = { request() {} };
  assert.equal(await store.cognition(host), host);
  assert.deepEqual(await readdir(join(dataDir, 'fun')), []);
  const restarted = new StorySecrets({ dataDir, crypto: encryption() });
  assert.equal((await restarted.load()).dm.saved, false);
});

test('a clear during encryption prevents a pending save from resurrecting credentials', async () => {
  const dataDir = await fixture();
  const crypto = encryption();
  const encrypt = crypto.protect;
  const entered = deferred();
  const resume = deferred();
  crypto.protect = async (plaintext) => { entered.resolve(); await resume.promise; return encrypt(plaintext); };
  const store = new StorySecrets({ dataDir, crypto });
  const saving = store.save({ apiUrl: API, apiKey: KEY });
  await entered.promise;
  const clearing = store.clear();
  resume.resolve();
  assert.equal((await saving).code, 'SECRET_REVOKED');
  assert.equal((await clearing).ok, true);
  assert.equal(store.status.saved, false);
  assert.deepEqual(await readdir(dataDir), []);
});

test('corrupt or wrong-user ciphertext fails closed with no plaintext or network activity', async () => {
  const dataDir = await fixture();
  const store = new StorySecrets({ dataDir, crypto: encryption() });
  await store.save({ apiUrl: API, apiKey: KEY });
  const wrongUser = new StorySecrets({ dataDir, crypto: encryption(), fetch: () => assert.fail('must not fetch') });
  const result = await wrongUser.load();
  assert.equal(result.code, 'SECRET_CRYPTO');
  noLeak(result);
  await assert.rejects((await wrongUser.cognition()).request({ brief: 'scene' }), { code: 'SECRET_CRYPTO' });
  await writeFile(join(dataDir, 'fun', 'story-secrets.json'), LEAK, 'utf8');
  const damaged = new StorySecrets({ dataDir, crypto: encryption() });
  const bad = await damaged.load();
  assert.equal(bad.code, 'SECRET_STORAGE');
  noLeak(bad);
  assert.equal((await damaged.clear()).ok, true);
});
