import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoryImages, STORY_IMAGE_MAX_BYTES, validateStoryImageSource, validateStoryWorkflow, materializeWorkflow } from '../src/story-images.js';
import { cleanup } from './tmp.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=', 'base64');
const draft = { enabled: true, scene: '窗边', outfits: '蓝色外套', prompt: '温暖的午后，水彩画' };
const json = (body, init) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

/**
 * 0.7.3：图片来源住在配置里，StoryImages 只注入一个读取器。
 * 测试用一个可变对象模拟 `worlds.fun.funStoryImageSource`。
 */
async function setup(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'fun-r2-images-'));
  cleanup(t, dataDir);
  const { source: initialSource = '', ...rest } = options;
  const config = { source: initialSource };
  const images = new StoryImages({ dataDir, ...rest, source: () => config.source });
  await images.init();
  return { images, dataDir, config, directory: join(dataDir, 'fun', 'story-images') };
}

function mockComfy(overrides = {}) {
  const calls = [];
  let polls = 0;
  const fetchImpl = async (address, options) => {
    const url = new URL(address);
    calls.push({ url, options });
    if (overrides.fetch) return overrides.fetch(url, options, calls);
    if (url.pathname === '/object_info/CheckpointLoaderSimple') return overrides.catalog?.() ?? json({
      CheckpointLoaderSimple: { input: { required: { ckpt_name: [['first.safetensors', 'default.safetensors'], { default: 'default.safetensors' }] } } },
    });
    if (url.pathname === '/prompt') return overrides.submit?.() ?? json({ prompt_id: 'test-job-123' });
    if (url.pathname === '/history/test-job-123') {
      polls++;
      if (overrides.polls && polls < overrides.polls) return json({});
      return overrides.history?.() ?? json({ 'test-job-123': { outputs: { '7': { images: [{ filename: 'result.png', subfolder: '', type: 'output' }] } } } });
    }
    if (url.pathname === '/view') return overrides.view?.() ?? new Response(PNG, { headers: { 'content-type': 'image/png' } });
    assert.fail(`Unexpected mock route: ${url.pathname}`);
  };
  return { fetchImpl, calls };
}

async function direct(t, options = {}, overrides = {}) {
  const mock = mockComfy(overrides);
  const context = await setup(t, { fetchImpl: mock.fetchImpl, pollIntervalMs: 1, ...options });
  context.config.source = 'http://127.0.0.1:8188';
  // 生产里 settings.json 由工作流保存创建；测试也先落一个，目录断言才稳定。
  assert.equal((await context.images.configure({})).ok, true);
  return { ...context, ...mock };
}

function assertSafeFailure(result) {
  assert.equal(result.status, 'error');
  assert.equal(result.source, 'local-comfyui');
  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /127\.0\.0\.1|8188|secret-response|sensitive-provider-error/);
  assert.equal(result.imageId, undefined);
}

test('off never invokes fetch or plugin detection, including when a local endpoint is configured', async (t) => {
  let requests = 0;
  let detections = 0;
  const { images, config } = await setup(t, { fetchImpl: () => { requests++; throw new Error('forbidden'); }, detectPlugin: () => { detections++; return true; } });
  assert.equal(images.status(false).state, 'off');
  assert.equal((await images.generate({ ...draft, enabled: false })).status, 'off');
  config.source = 'http://127.0.0.1:8188';
  assert.equal((await images.generate({ ...draft, enabled: false })).status, 'off');
  assert.equal(requests, 0);
  assert.equal(detections, 0);
});

test('unknown installation is an honest receipt delegation without pretending to discover a plugin', async (t) => {
  const { images } = await setup(t, { fetchImpl: () => assert.fail('delegation cannot fetch') });
  assert.equal(images.status(true).pluginStatus, 'unknown');
  assert.equal(images.status(true).generationAvailable, false);
  const result = await images.generate(draft);
  assert.equal(result.status, 'delegated');
  assert.equal(result.tool, 'imggen_draw');
  assert.equal(result.scene, draft.scene);
  assert.equal(result.outfits, draft.outfits);
  assert.equal(result.prompt, draft.prompt);
  assert.match(result.message, /未验证是否安装/);
  assert.match(result.message, /主对话若无 imggen_draw 应提示未安装/);
  assert.match(result.message, /主对话调用 imggen_draw/);
});

test('verified installed/absent capability gives structured delegation or explicit not installed', async (t) => {
  for (const found of [true, false]) {
    const { images } = await setup(t, { detectPlugin: () => found, fetchImpl: () => assert.fail('cannot fetch') });
    const state = images.status(true);
    assert.equal(state.pluginStatus, found ? 'installed' : 'absent');
    assert.equal(state.generationAvailable, found);
    const result = await images.generate(draft);
    assert.equal(result.status, found ? 'delegated' : 'unavailable');
    if (found) {
      assert.equal(result.tool, 'imggen_draw');
      assert.equal(result.scene, draft.scene);
      assert.equal(result.outfits, draft.outfits);
    } else assert.match(result.message, /未安装鱼的生图包/);
  }
});

test('failed or nonboolean capability detection remains unknown', async (t) => {
  for (const detectPlugin of [() => { throw new Error('secret-response'); }, () => ({ installed: true })]) {
    const { images } = await setup(t, { detectPlugin });
    assert.equal(images.status(true).pluginStatus, 'unknown');
    assert.match((await images.generate(draft)).message, /未验证是否安装/);
  }
});

test('plain text names and instructions delegate to the main conversation with zero HTTP', async (t) => {
  const { images, config, dataDir, directory } = await setup(t, { fetchImpl: () => assert.fail('cannot fetch') });
  const source = '其他绘图插件，请画成水彩';
  config.source = source;
  const result = await images.generate(draft);
  assert.equal(result.status, 'delegated');
  assert.equal(result.source, source);
  assert.match(result.message, /未验证其安装或接口/);
  // 来源在配置里：settings.json 即使已经存在，也只该有工作流。
  const saved = JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8').catch(() => '{}'));
  assert.equal(Object.hasOwn(saved, 'source'), false);
  const reloaded = new StoryImages({ dataDir, source: () => config.source, fetchImpl: () => assert.fail('cannot fetch') });
  await reloaded.init();
  assert.equal(reloaded.status(true).source, source);
  config.source = '';
  assert.equal(reloaded.status(true).source, '');
  assert.equal((await reloaded.generate(draft)).tool, 'imggen_draw');
});

test('source validation rejects remote origins, credentials, host API paths and ambiguous input before any request', async (t) => {
  const { images } = await setup(t, { fetchImpl: () => assert.fail('cannot fetch') });
  for (const source of [
    'https://example.com', 'http://192.168.0.2:8188', 'http://0.0.0.0:8188',
    'ftp://127.0.0.1', 'file:///etc/passwd', 'javascript:alert(1)', '//127.0.0.1:8188',
    'http://user:password@127.0.0.1:8188', 'http://127.0.0.1:8188/?token=secret',
    'http://127.0.0.1:8188/?', 'http://127.0.0.1:8188/#', 'http://127.0.0.1:8188/#secret',
    'http://127.0.0.1:8188/api/tools', 'http://localhost:8188/object_info',
    'http://127.0.0.1:8188/\\api', 'http://localhost.evil.test:8188',
    'x'.repeat(301), 'plugin\nother', null,
  ]) {
    const result = await images.configure({ source });
    assert.equal(result.ok, false, String(source));
    assert.doesNotMatch(result.error, /password|secret|example\.com|127\.0\.0\.1/);
    assert.equal(images.status().source, '');
  }
  for (const source of ['http://127.0.0.1:8188', 'https://localhost:8188/', 'http://[::1]:8188', 'http://127.1.2.3:8188']) {
    assert.equal(validateStoryImageSource(source).ok, true, source);
  }
});

test('successful ComfyUI execution uses a default checkpoint and fixed 512 workflow, stores an ID, reads a data URL', async (t) => {
  const { images, calls, directory, dataDir } = await direct(t, {}, { polls: 2 });
  const result = await images.generate(draft);
  assert.equal(result.status, 'ready', result.message);
  assert.match(result.imageId, /^[a-f0-9-]{36}\.png$/);
  assert.equal(result.source, 'local-comfyui');
  assert.equal(images.status(true).busy, false);
  const submission = JSON.parse(calls.find(({ url }) => url.pathname === '/prompt').options.body);
  assert.equal(submission.prompt['1'].inputs.ckpt_name, 'default.safetensors');
  assert.deepEqual(submission.prompt['4'].inputs, { width: 512, height: 512, batch_size: 1 });
  assert.match(submission.prompt['2'].inputs.text, /窗边\n蓝色外套\n温暖/);
  const signal = calls[0].options.signal;
  for (const { url, options } of calls) {
    assert.equal(url.origin, 'http://127.0.0.1:8188');
    assert.equal(options.signal, signal);
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
  }
  assert.equal(calls.filter(({ url }) => url.pathname.startsWith('/history/')).length, 2);
  const read = await images.read(result.imageId);
  assert.equal(read.ok, true);
  assert.equal(read.dataUrl, `data:image/png;base64,${PNG.toString('base64')}`);
  assert.deepEqual((await readdir(directory)).sort(), [result.imageId, 'settings.json'].sort());
  assert.equal((await images.read('../settings.json')).ok, false);
  assert.equal((await images.read(join(dataDir, 'fun', 'state.json'))).ok, false);
  assert.equal((await images.read('settings.json')).ok, false);
  assert.doesNotMatch(JSON.stringify(result), /[A-Z]:\\|dataDir/);
  const restarted = new StoryImages({ dataDir });
  await restarted.init();
  assert.equal((await restarted.read(result.imageId)).dataUrl, read.dataUrl);
});

test('checkpoint discovery chooses the first available when no default is provided', async (t) => {
  const { images, calls } = await direct(t, {}, { catalog: () => json({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['only.safetensors']] } } } }) });
  assert.equal((await images.generate(draft)).status, 'ready');
  assert.equal(JSON.parse(calls[1].options.body).prompt['1'].inputs.ckpt_name, 'only.safetensors');
});

test('401/403 and provider exceptions are safe and never echo endpoint or response', async (t) => {
  for (const status of [401, 403]) {
    const { images } = await direct(t, {}, { catalog: () => new Response('secret-response', { status }) });
    const result = await images.generate(draft);
    assertSafeFailure(result);
    assert.match(result.message, /401\/403/);
  }
  const { images } = await direct(t, {}, { fetch: async () => { throw new Error('sensitive-provider-error http://127.0.0.1:8188 secret-response'); } });
  assertSafeFailure(await images.generate(draft));
});

test('malformed catalog, task, history and image metadata fail without following returned URLs', async (t) => {
  for (const overrides of [
    { catalog: () => new Response('secret-response') },
    { catalog: () => json({}) },
    { submit: () => json({ prompt_id: 'http://evil.test/secret-response' }) },
    { history: () => json({ 'test-job-123': { status: { status_str: 'error', messages: ['secret-response'] } } }) },
    { history: () => json({ 'test-job-123': { status: { completed: true }, outputs: {} } }) },
    { history: () => json({ 'test-job-123': { outputs: { '7': { images: [{ url: 'https://evil.test/image.png' }] } } } }) },
    { history: () => json({ 'test-job-123': { outputs: { '7': { images: [{ filename: '../private.png' }] } } } }) },
    { history: () => json({ 'test-job-123': { outputs: { '7': { images: [{ filename: 'image.png', subfolder: '../private' }] } } } }) },
  ]) {
    const { images, calls } = await direct(t, {}, overrides);
    assertSafeFailure(await images.generate(draft));
    assert.equal(calls.some(({ url }) => url.pathname === '/view'), false);
  }
});

test('redirect response and cross-origin response URL are refused even by a fetch mock ignoring redirect:error', async (t) => {
  for (const properties of [{ redirected: true }, { url: 'http://evil.test/secret-response' }]) {
    const response = json({});
    for (const [key, value] of Object.entries(properties)) Object.defineProperty(response, key, { value });
    const { images, calls } = await direct(t, {}, { catalog: () => response });
    assertSafeFailure(await images.generate(draft));
    assert.equal(calls.length, 1);
  }
});

test('bad magic and mismatched MIME are rejected rather than saved', async (t) => {
  for (const view of [
    () => new Response('<html>secret-response</html>', { headers: { 'content-type': 'image/png' } }),
    () => new Response(PNG, { headers: { 'content-type': 'image/jpeg' } }),
    () => new Response(Buffer.from('GIF89a'), { headers: { 'content-type': 'image/gif' } }),
    () => new Response(PNG.subarray(0, 20), { headers: { 'content-type': 'image/png' } }),
  ]) {
    const { images, directory } = await direct(t, {}, { view });
    assertSafeFailure(await images.generate(draft));
    assert.deepEqual(await readdir(directory), ['settings.json']);
  }
});

test('PNG, JPEG and WebP signatures are checked and their data URL MIME is preserved', async (t) => {
  // Container validation deliberately does not decode pixels; browser rendering does that.
  const webp = Buffer.alloc(20);
  webp.write('RIFF', 0); webp.writeUInt32LE(12, 4); webp.write('WEBPVP8L', 8);
  for (const [bytes, mime, extension] of [
    [PNG, 'image/png', 'png'], [Buffer.from([255, 216, 255, 217]), 'image/jpeg', 'jpg'], [webp, 'image/webp', 'webp'],
  ]) {
    const { images } = await direct(t, {}, { view: () => new Response(bytes, { headers: { 'content-type': mime } }) });
    const result = await images.generate(draft);
    assert.equal(result.status, 'ready', result.message);
    assert.equal(result.imageId.endsWith(`.${extension}`), true);
    assert.equal((await images.read(result.imageId)).dataUrl.startsWith(`data:${mime};base64,`), true);
  }
});

test('oversize images are bounded by both Content-Length and actual streamed bytes', async (t) => {
  for (const view of [
    () => new Response(PNG, { headers: { 'content-length': String(STORY_IMAGE_MAX_BYTES + 1) } }),
    () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(STORY_IMAGE_MAX_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close(); } })),
  ]) {
    const { images, directory } = await direct(t, {}, { view });
    const result = await images.generate(draft);
    assertSafeFailure(result);
    assert.match(result.message, /8 MiB/);
    assert.deepEqual(await readdir(directory), ['settings.json']);
  }
});

test('one total timeout bounds polling and fetch that ignores abort, with the same signal aborted', async (t) => {
  const gate = deferred();
  const { images, calls, directory } = await direct(t, { timeoutMs: 15 }, { fetch: async () => gate.promise });
  const result = await images.generate(draft);
  assertSafeFailure(result);
  assert.match(result.message, /超时/);
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(images.status(true).busy, false);
  gate.resolve(json({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['late']] } } } }));
  await tick();
  assert.equal(calls.length, 1);
  assert.deepEqual(await readdir(directory), ['settings.json']);
  const polling = await direct(t, { timeoutMs: 15 }, { history: () => json({}) });
  const polled = await polling.images.generate(draft);
  assertSafeFailure(polled);
  assert.match(polled.message, /超时/);
  assert.equal(polling.calls.at(-1).options.signal.aborted, true);
});

test('a stalled image stream also respects the total timeout', async (t) => {
  let cancelCalled = false;
  const { images } = await direct(t, { timeoutMs: 15 }, { view: () => new Response(new ReadableStream({ cancel() { cancelCalled = true; } })) });
  const result = await images.generate(draft);
  assertSafeFailure(result);
  assert.match(result.message, /超时/);
  assert.equal(cancelCalled, true);
});

test('busy rejects another request and cancel invalidates late results without writing an image', async (t) => {
  const gate = deferred();
  const started = deferred();
  const { images, calls, directory } = await direct(t, {}, { view: async () => { started.resolve(); return gate.promise; } });
  const pending = images.generate(draft);
  await started.promise;
  assert.equal(images.status(true).busy, true);
  const count = calls.length;
  assert.equal((await images.generate(draft)).status, 'unavailable');
  assert.equal(calls.length, count);
  images.cancel();
  const cancelled = await pending;
  assertSafeFailure(cancelled);
  assert.match(cancelled.message, /取消|过期/);
  gate.resolve(new Response(PNG, { headers: { 'content-type': 'image/png' } }));
  await tick();
  assert.deepEqual(await readdir(directory), ['settings.json']);
  assert.equal(images.status(true).busy, false);
});

test('external signal, disabling, and changing source invalidate in-flight image requests', async (t) => {
  for (const action of ['signal', 'disable', 'source']) {
    const gate = deferred();
    const started = deferred();
    const { images, calls, directory } = await direct(t, {}, { view: async () => { started.resolve(); return gate.promise; } });
    const controller = new AbortController();
    const pending = images.generate({ ...draft, signal: controller.signal });
    await started.promise;
    if (action === 'signal') controller.abort();
    else if (action === 'disable') assert.equal((await images.generate({ enabled: false })).status, 'off');
    else assert.equal((await images.configure({ source: '另一绘图插件' })).ok, true);
    assertSafeFailure(await pending);
    assert.equal(calls[0].options.signal.aborted, true);
    gate.resolve(new Response(PNG));
    await tick();
    assert.deepEqual(await readdir(directory), ['settings.json']);
  }
});

test('an already aborted signal performs zero network requests', async (t) => {
  const { images, calls } = await direct(t);
  const controller = new AbortController();
  controller.abort();
  assertSafeFailure(await images.generate({ ...draft, signal: controller.signal }));
  assert.equal(calls.length, 0);
});

test('malformed independent settings fall back safely, writes serialize, and settings.json keeps only the workflow', async (t) => {
  const { images, dataDir, directory, config } = await direct(t);
  const saved = await Promise.all([images.configure({ workflow: WORKFLOW }), images.configure({ workflow: '' })]);
  assert.equal(saved.every(({ ok }) => ok), true);
  const stored = JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8'));
  assert.deepEqual(Object.keys(stored), ['workflow']);
  assert.equal(stored.workflow, '');
  await writeFile(join(directory, 'settings.json'), '{malformed');
  const fresh = new StoryImages({ dataDir, source: () => config.source });
  await fresh.init();
  assert.equal(fresh.status(true).hasWorkflow, false);
  assert.equal(fresh.status(true).source, 'http://127.0.0.1:8188', '来源来自配置，不读旧文件');
});

const WORKFLOW = JSON.stringify({
  '3': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'mine.safetensors' } },
  '5': { class_type: 'CLIPTextEncode', inputs: { text: '前缀 {{prompt}} 后缀', clip: ['3', 0] } },
  '77': { class_type: 'SaveImage', inputs: { images: ['5', 0] } },
});

test('自定义工作流：只收 API 格式，必须有 {{prompt}}，并有体积与结构上限', () => {
  assert.equal(validateStoryWorkflow(undefined).ok, true);
  assert.equal(validateStoryWorkflow('   ').ok, true);
  assert.equal(validateStoryWorkflow('{').ok, false, '畸形 JSON');
  assert.equal(validateStoryWorkflow('[]').ok, false, '数组不是工作流');
  assert.equal(validateStoryWorkflow(JSON.stringify({ 1: { class_type: 'X', inputs: {} } })).ok, false, '缺占位符');
  assert.equal(validateStoryWorkflow(JSON.stringify({ 1: { class_type: 'X', inputs: {}, extra: 1, __proto__x: 2 } })).ok, false, '多余键');
  assert.equal(validateStoryWorkflow(JSON.stringify({ 1: { inputs: {} } })).ok, false, '缺 class_type');
  assert.equal(validateStoryWorkflow(JSON.stringify({ 1: { class_type: 'X' } })).ok, false, '缺 inputs');
  assert.equal(validateStoryWorkflow(JSON.stringify({ 'a b': { class_type: 'X', inputs: {} } })).ok, false, '节点 ID 不合法');
  assert.equal(validateStoryWorkflow('x'.repeat(33 * 1024)).ok, false, '超过 32 KB');
  const good = validateStoryWorkflow(WORKFLOW);
  assert.equal(good.ok, true);
  assert.equal(good.workflow, WORKFLOW);
});

test('自定义工作流：{{prompt}} 与 {{seed}} 填进去，没写 {{seed}} 时自动给采样器随机种子', () => {
  const filled = materializeWorkflow(WORKFLOW, { prompt: '一句话', seed: 42 });
  assert.equal(filled['5'].inputs.text, '前缀 一句话 后缀');
  assert.equal(filled['3'].inputs.ckpt_name, 'mine.safetensors');
  assert.equal(filled['77'].class_type, 'SaveImage');
  const seeded = materializeWorkflow(JSON.stringify({
    '1': { class_type: 'KSampler', inputs: { seed: 1, steps: 30 } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: '{{prompt}}' } },
  }), { prompt: 'x', seed: 7 });
  assert.equal(seeded['1'].inputs.seed, 7);
  const token = materializeWorkflow(JSON.stringify({
    '1': { class_type: 'Note', inputs: { text: 'seed={{seed}}' } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: '{{prompt}}' } },
  }), { prompt: 'x', seed: 123456 });
  assert.equal(token['1'].inputs.text, 'seed=123456');
  assert.throws(() => materializeWorkflow(JSON.stringify({ '1': { class_type: 'X', inputs: {} } }), { prompt: 'x' }));
});

test('自定义工作流直连：不再问 checkpoint，工作流原样提交，SaveImage 节点 ID 随意', async (t) => {
  const { images, calls } = await direct(t, {}, {
    history: () => json({ 'test-job-123': { outputs: { '77': { images: [{ filename: 'x.png', subfolder: '', type: 'output' }] } } } }),
  });
  assert.equal((await images.configure({ workflow: WORKFLOW })).ok, true);
  assert.equal(images.status(true).hasWorkflow, true);
  assert.match(images.status(true).message, /你自己贴的工作流/);
  const result = await images.generate(draft);
  assert.equal(result.status, 'ready', result.message);
  assert.equal(calls.some(({ url }) => url.pathname === '/object_info/CheckpointLoaderSimple'), false, '自定义工作流不查 checkpoint');
  const submission = JSON.parse(calls.find(({ url }) => url.pathname === '/prompt').options.body);
  assert.equal(submission.prompt['3'].inputs.ckpt_name, 'mine.safetensors');
  assert.match(submission.prompt['5'].inputs.text, /窗边\n蓝色外套\n温暖/);
  assert.equal(submission.prompt['77'].class_type, 'SaveImage');
  assert.ok((await images.read(result.imageId)).ok);
});

test('自定义工作流：保存后可重启读回，清空即回到内置，坏工作流不覆盖已保存的工作流', async (t) => {
  const { images, dataDir, directory, config } = await setup(t, { fetchImpl: () => assert.fail('cannot fetch') });
  config.source = 'http://127.0.0.1:8188';
  assert.equal((await images.configure({ workflow: '{' })).ok, false);
  assert.equal(images.status().hasWorkflow, false, '坏工作流不应写入');
  assert.equal(images.status().source, 'http://127.0.0.1:8188', '来源不受工作流影响');
  assert.equal((await images.configure({ workflow: WORKFLOW })).ok, true);
  assert.match(JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8')).workflow, /\{\{prompt\}\}/);
  const reloaded = new StoryImages({ dataDir, source: () => config.source });
  await reloaded.init();
  assert.equal(reloaded.status(true).hasWorkflow, true);
  assert.equal(reloaded.status(true).workflow, WORKFLOW);
  assert.equal((await reloaded.configure({ workflow: '' })).ok, true);
  assert.equal(reloaded.status(true).hasWorkflow, false);
  const plain = new StoryImages({ dataDir, source: () => config.source });
  await plain.init();
  assert.equal(plain.status(true).hasWorkflow, false);
  assert.equal(JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8')).workflow, '');
});

