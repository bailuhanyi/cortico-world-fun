import { randomUUID, randomInt } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink, open, lstat } from 'node:fs/promises';
import { join } from 'node:path';

export const STORY_IMAGE_TIMEOUT_MS = 30_000;
export const STORY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** 自定义工作流是用户自己贴的 ComfyUI「API 格式」JSON。 */
export const STORY_WORKFLOW_MAX_CHARS = 32 * 1024;
export const STORY_WORKFLOW_PROMPT_TOKEN = '{{prompt}}';
export const STORY_WORKFLOW_SEED_TOKEN = '{{seed}}';
const STORY_WORKFLOW_MAX_NODES = 200;
const WORKFLOW_NODE_KEYS = new Set(['class_type', 'inputs', '_meta']);
const JSON_MAX_BYTES = 1024 * 1024;
const ID = /^[a-f0-9-]{36}\.(png|jpg|webp)$/;
const UNKNOWN = '未验证是否安装鱼的生图包；主对话若无 imggen_draw 应提示未安装。';
const OFF = '剧情图片生成已关闭，只使用本地预制插画或显式导入；文字故事可继续。';
const error = (message) => Object.assign(new Error(message), { safe: true });
const bounded = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';

/** No discovery, host event, World tool, internal HTTP or other World data access is assumed. */
export function validateStoryImageSource(value) {
  if (typeof value !== 'string' || value.length > 300 || /[\x00-\x1f\x7f]/.test(value)) {
    return { ok: false, error: '图片来源须为不超过 300 字符的单行文本或本机 ComfyUI 根地址。' };
  }
  const source = value.trim();
  if (!source) return { ok: true, source, kind: 'plugin' };
  const urlLike = /^[a-z][a-z\d+.-]*:\/\//i.test(source)
    || /^(?:https?|file|data|javascript):/i.test(source) || source.startsWith('//');
  if (!urlLike) return { ok: true, source, kind: 'delegate' };
  try {
    const url = new URL(source);
    const loopback = url.hostname === 'localhost' || url.hostname === '[::1]'
      || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname);
    if (!/^https?:$/.test(url.protocol) || !loopback || url.username || url.password
      || /[?#\\]/.test(source) || url.pathname !== '/') throw error('invalid');
    return { ok: true, source, kind: 'comfyui', origin: url.origin };
  } catch {
    return { ok: false, error: '直连仅支持显式填写的 loopback HTTP/HTTPS ComfyUI 根地址；不允许凭据、查询、片段或宿主工具/API 路径。' };
  }
}

/**
 * 用户贴进来的 ComfyUI「Save (API Format)」工作流。
 * 只接受 API 格式（节点 ID → { class_type, inputs }），不做任何节点语义推断；
 * 唯一要求是文本里至少有一个 {{prompt}} 占位符，出图按第一个返回 images 的节点取。
 */
export function validateStoryWorkflow(value) {
  if (value === undefined || value === null) return { ok: true, workflow: '' };
  if (typeof value !== 'string') return { ok: false, error: '工作流要贴 ComfyUI 的 API 格式 JSON 文本。' };
  const text = value.trim();
  if (!text) return { ok: true, workflow: '' };
  if (text.length > STORY_WORKFLOW_MAX_CHARS) {
    return { ok: false, error: `工作流 JSON 最多 ${Math.round(STORY_WORKFLOW_MAX_CHARS / 1024)} KB，请删掉不用的节点。` };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: '工作流 JSON 解析失败：请在 ComfyUI 里用「Save (API Format)」导出，别贴界面格式的工作流。' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '工作流必须是以节点 ID 为键的对象（API 格式）。' };
  }
  const entries = Object.entries(parsed);
  if (!entries.length) return { ok: false, error: '工作流是空的。' };
  if (entries.length > STORY_WORKFLOW_MAX_NODES) {
    return { ok: false, error: `工作流节点太多（最多 ${STORY_WORKFLOW_MAX_NODES} 个）。` };
  }
  for (const [id, node] of entries) {
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(id)) return { ok: false, error: `节点 ID 不合法：${bounded(id, 40)}。` };
    if (!node || typeof node !== 'object' || Array.isArray(node)) return { ok: false, error: `节点 ${id} 必须是对象。` };
    for (const key of Object.keys(node)) {
      if (!WORKFLOW_NODE_KEYS.has(key)) return { ok: false, error: `节点 ${id} 里有多余的键：${bounded(key, 40)}（只接受 class_type / inputs）。` };
    }
    if (typeof node.class_type !== 'string' || !node.class_type || node.class_type.length > 100) {
      return { ok: false, error: `节点 ${id} 缺少 class_type。` };
    }
    if (!node.inputs || typeof node.inputs !== 'object' || Array.isArray(node.inputs)) {
      return { ok: false, error: `节点 ${id} 缺少 inputs 对象。` };
    }
  }
  if (!text.includes(STORY_WORKFLOW_PROMPT_TOKEN)) {
    return { ok: false, error: `工作流里要有一个 ${STORY_WORKFLOW_PROMPT_TOKEN} 占位符，用来放这一段的正向提示词。` };
  }
  return { ok: true, workflow: text };
}

function fillWorkflowTokens(value, tokens, state) {
  if (typeof value === 'string') {
    let out = value;
    for (const [token, replacement] of Object.entries(tokens)) {
      if (!out.includes(token)) continue;
      out = out.split(token).join(String(replacement));
      if (token === STORY_WORKFLOW_PROMPT_TOKEN) state.prompted = true;
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => fillWorkflowTokens(item, tokens, state));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = fillWorkflowTokens(item, tokens, state);
    return out;
  }
  return value;
}

/**
 * 把占位符填进工作流，并给采样器一个随机 seed（除非用户自己写了 {{seed}}）。
 * 返回可直接 POST /prompt 的 graph。
 */
export function materializeWorkflow(workflow, { prompt = '', seed } = {}) {
  const checked = validateStoryWorkflow(workflow);
  if (!checked.ok || !checked.workflow) throw error(checked.error ?? '工作流无效。');
  const graph = JSON.parse(checked.workflow);
  const state = { prompted: false };
  const filled = fillWorkflowTokens(graph, { [STORY_WORKFLOW_PROMPT_TOKEN]: prompt, [STORY_WORKFLOW_SEED_TOKEN]: seed ?? '' }, state);
  if (!state.prompted) throw error(`工作流里没有可用的 ${STORY_WORKFLOW_PROMPT_TOKEN} 占位符。`);
  const requested = Number(seed);
  const value = Number.isSafeInteger(requested) && requested >= 0 ? requested : randomInt(0, 2 ** 32);
  for (const node of Object.values(filled)) {
    const inputs = node?.inputs;
    if (!inputs) continue;
    if (typeof inputs.seed === 'number') inputs.seed = value;
    else if (typeof inputs.noise_seed === 'number') inputs.noise_seed = value;
  }
  return filled;
}

/** 自定义工作流的 SaveImage 节点 ID 由用户决定，取第一个带回图片的输出。 */
function firstOutputImage(outputs) {
  if (!outputs || typeof outputs !== 'object') return null;
  for (const node of Object.values(outputs)) {
    const images = Array.isArray(node?.images) ? node.images : [];
    for (const image of images) {
      if (image && typeof image === 'object' && typeof image.filename === 'string' && image.filename) return image;
    }
  }
  return null;
}

function imageType(bytes) {
  if (bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR'
    && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0
    && bytes.toString('ascii', bytes.length - 8, bytes.length - 4) === 'IEND') return { ext: 'png', mime: 'image/png' };
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    && bytes.at(-2) === 255 && bytes.at(-1) === 217) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.readUInt32LE(4) + 8 === bytes.length && bytes.toString('ascii', 8, 12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return { ext: 'webp', mime: 'image/webp' };
  return null;
}

async function limitedBody(response, max, signal) {
  const declared = response.headers?.get('content-length');
  if (declared !== null && declared !== undefined && Number(declared) > max) {
    throw error(max === STORY_IMAGE_MAX_BYTES ? '图片超过 8 MiB 限制。' : 'ComfyUI 响应过大。');
  }
  if (!response.body?.getReader) throw error('ComfyUI 响应格式无效。');
  const reader = response.body.getReader();
  const cancelReader = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancelReader, { once: true });
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw error(max === STORY_IMAGE_MAX_BYTES ? '图片超过 8 MiB 限制。' : 'ComfyUI 响应过大。');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, size);
  } finally {
    // Do not await cancellation: a provider may ignore abort or never settle its stream.
    signal.removeEventListener('abort', cancelReader);
    cancelReader();
    reader.releaseLock();
  }
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, ms);
    const aborted = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', aborted, { once: true });
  });
}

function workflow(checkpoint, prompt) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0],
      latent_image: ['4', 0], seed: randomInt(0, 2 ** 32), steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'fun-story' } },
  };
}

/**
 * init/configure only use <dataDir>/fun/story-images, never World state/config.
 * The image source itself is injected (`source: () => cfg.funStoryImageSource`) since
 * 0.7.3; settings.json keeps only the custom ComfyUI workflow.
 * detectPlugin is an optional verified, synchronous boolean capability callback.
 * With no callback the installation status is explicitly unknown.
 * generate must be awaited outside the World's story-action serialization lock.
 */
export class StoryImages {
  #dir;
  #sourceFrom;
  #workflow = '';
  /** 旧 settings.json 里的来源，只供启动时一次性迁移到配置。 */
  #legacySource = '';
  #fetch;
  #detect;
  #timeout;
  #poll;
  #epoch = 0;
  #active;
  #writes = Promise.resolve();

  constructor({ dataDir, source, fetchImpl = globalThis.fetch, detectPlugin, timeoutMs = STORY_IMAGE_TIMEOUT_MS, pollIntervalMs = 250 } = {}) {
    if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('StoryImages requires dataDir.');
    this.#dir = join(dataDir, 'fun', 'story-images');
    this.#sourceFrom = typeof source === 'function' ? source : typeof source === 'string' ? () => source : () => '';
    this.#fetch = fetchImpl;
    this.#detect = detectPlugin;
    this.#timeout = Math.min(STORY_IMAGE_TIMEOUT_MS, Math.max(1, Number(timeoutMs) || STORY_IMAGE_TIMEOUT_MS));
    this.#poll = Math.max(1, Math.min(1000, Number(pollIntervalMs) || 250));
  }

  /** 现读配置里的来源（面板不需要重新载入）。 */
  #source() {
    const value = this.#sourceFrom();
    return typeof value === 'string' ? value : '';
  }

  /** 仅启动迁移用：旧文件里保存过的来源；迁移后不再读写文件里的 source。 */
  legacySource() { return this.#legacySource; }

  async init() {
    try {
      const file = join(this.#dir, 'settings.json');
      const stat = await lstat(file);
      // settings.json 里只剩自定义工作流（上限 32 KB）。
      if (!stat.isFile() || stat.size > STORY_WORKFLOW_MAX_CHARS + 8192) return this.status();
      const parsed = JSON.parse(await readFile(file, 'utf8'));
      const legacy = validateStoryImageSource(parsed?.source);
      if (legacy.ok) this.#legacySource = legacy.source;
      const workflow = validateStoryWorkflow(parsed?.workflow);
      if (workflow.ok) this.#workflow = workflow.workflow;
    } catch { /* Missing or malformed independent settings fall back to delegation. */ }
    return this.status();
  }

  #pluginStatus() {
    try {
      const found = typeof this.#detect === 'function' ? this.#detect() : this.#detect;
      return found === true ? 'installed' : found === false ? 'absent' : 'unknown';
    } catch { return 'unknown'; }
  }

  status(enabled = false) {
    const source = this.#source();
    const checked = validateStoryImageSource(source);
    const kind = checked.ok ? checked.kind : 'invalid';
    const pluginStatus = enabled === true && kind === 'plugin' ? this.#pluginStatus() : 'unknown';
    const custom = kind === 'comfyui' && Boolean(this.#workflow);
    const message = !enabled ? OFF
      : kind === 'invalid' ? '图片来源设置无效：只接受留空、本机 loopback ComfyUI 地址或一段插件说明文本。请到配置页修改；文字故事可继续。'
        : kind === 'comfyui' ? (custom
          ? '可选直连本机 ComfyUI，当前使用你自己贴的工作流（模型与节点由你负责）；总计最多 30 秒、图片最多 8 MiB，失败可继续文字故事。图片保存在本 World dataDir/fun/story-images。'
          : '可选直连本机 ComfyUI（固定 512×512）；总计最多 30 秒、图片最多 8 MiB，失败可继续文字故事。图片保存在本 World dataDir/fun/story-images，通过图片 ID 读取。')
          : kind === 'delegate' ? '由主对话或指定插件执行图片委派；fun 不调用该插件，图片由执行方保存。'
            : pluginStatus === 'absent' ? '未安装鱼的生图包，无法使用 imggen_draw；请安装后由主对话执行，文字故事可继续。'
              : pluginStatus === 'installed' ? '已确认安装鱼的生图包；fun 只返回 imggen_draw 参数，由主对话调用，图片由生图包保存。'
                : `${UNKNOWN} fun 只给回执委派，图片由执行方保存；文字故事可继续。`;
    const state = !enabled ? 'off'
      : kind === 'invalid' || pluginStatus === 'absent' ? 'unavailable'
        : kind === 'comfyui' ? 'direct' : 'delegated';
    return { enabled: enabled === true, state, message,
      generationAvailable: enabled === true && (kind === 'comfyui' ? typeof this.#fetch === 'function'
        : kind === 'delegate' || pluginStatus === 'installed'), source, sourceKind: kind, workflow: this.#workflow,
      hasWorkflow: Boolean(this.#workflow), pluginStatus, busy: Boolean(this.#active) };
  }

  async configure({ source, workflow } = {}) {
    // 来源住在配置里：这里只校验，不落盘（面板/配置页改了立即生效）。
    if (source !== undefined) {
      const checked = validateStoryImageSource(source);
      if (!checked.ok) return checked;
    }
    // workflow 没传就保持原样；传空字符串表示清掉，回到内置工作流。
    const custom = workflow === undefined ? null : validateStoryWorkflow(workflow);
    if (custom && !custom.ok) return custom;
    const nextWorkflow = custom ? custom.workflow : this.#workflow;
    // Invalidate immediately, including while the independent settings write is queued.
    this.cancel();
    const save = async () => {
      const temp = join(this.#dir, `settings-${randomUUID()}.tmp`);
      try {
        await mkdir(this.#dir, { recursive: true });
        await writeFile(temp, `${JSON.stringify({ workflow: nextWorkflow })}\n`, { flag: 'wx', mode: 0o600 });
        await rename(temp, join(this.#dir, 'settings.json'));
        this.cancel();
        this.#workflow = nextWorkflow;
        return { ok: true, ...this.status() };
      } catch {
        await unlink(temp).catch(() => {});
        return { ok: false, error: '图片来源设置保存失败。' };
      }
    };
    const saved = this.#writes.then(save, save);
    this.#writes = saved.then(() => {});
    return saved;
  }

  cancel() {
    this.#epoch++;
    const active = this.#active;
    this.#active = undefined;
    active?.controller.abort(error('图片请求已取消或过期；迟到结果不会应用。'));
  }

  async generate({ enabled = false, scene = '', outfits = '', prompt = '', signal } = {}) {
    const chosen = validateStoryImageSource(this.#source());
    const info = { scene: bounded(scene, 1000), outfits: bounded(outfits, 1000), prompt: bounded(prompt, 6000),
      source: chosen.kind === 'comfyui' ? 'local-comfyui' : chosen.source || '鱼的生图包' };
    const result = (status, message, extra = {}) => ({ status, message, ...info, ...extra });
    if (enabled !== true) { this.cancel(); return result('off', OFF); }
    if (!chosen.ok) return result('unavailable', this.status(true).message);
    if (signal?.aborted) return result('error', '图片请求已取消或过期；迟到结果不会应用。');
    if (this.#active) return result('unavailable', '已有图片请求进行中；请先取消或等待，文字故事可继续。');
    if (chosen.kind !== 'comfyui') {
      const state = this.status(true);
      if (state.pluginStatus === 'absent') return result('unavailable', state.message);
      return result('delegated', chosen.kind === 'plugin'
        ? `${state.message} 请主对话调用 imggen_draw，并使用本回执的 scene、outfits、prompt。`
        : `请主对话把 scene、outfits、prompt 委派给所填写的插件或按来源说明绘图；fun 未验证其安装或接口，不会自动执行。`,
      chosen.kind === 'plugin' ? { tool: 'imggen_draw' } : {});
    }
    if (typeof this.#fetch !== 'function') return result('unavailable', '当前运行环境不支持本机 ComfyUI 请求，文字故事可继续。');
    const controller = new AbortController();
    const active = { epoch: this.#epoch, controller };
    this.#active = active;
    const abort = () => controller.abort(error('图片请求已取消或过期；迟到结果不会应用。'));
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(error('图片请求总计等待超时（最多 30 秒）；文字故事可继续。')), this.#timeout);
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = () => reject(controller.signal.reason); });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    const current = () => {
      controller.signal.throwIfAborted();
      if (this.#epoch !== active.epoch || this.#active !== active) throw error('图片结果已过期；迟到结果不会应用。');
    };
    try {
      const task = this.#direct(chosen.origin, info, controller.signal, current);
      const imageId = await Promise.race([task, aborted]);
      current();
      return result('ready', '图片已保存到本 World 的 fun/story-images，可通过图片 ID 读取。', { imageId });
    } catch (cause) {
      return result('error', cause?.safe === true ? cause.message : '本机 ComfyUI 请求失败或响应格式无效；文字故事可继续，可改用回执委派。');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', rejectAbort);
      if (this.#active === active) this.#active = undefined;
    }
  }

  async #direct(origin, info, signal, current) {
    const request = async (path, options = {}) => {
      current();
      const target = new URL(path, origin);
      if (target.origin !== origin) throw error('ComfyUI 响应格式无效。');
      const response = await this.#fetch(target.href, { ...options, signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' });
      current();
      // A custom fetch may ignore redirect:error; never consume such a response.
      if (response.redirected || (response.url && new URL(response.url).origin !== origin)) throw error('ComfyUI 不允许重定向或跨来源结果。');
      if (response.status === 401 || response.status === 403) throw error('ComfyUI 拒绝授权（401/403）；本模块不保存或发送凭据。');
      if (!response.ok) throw error('ComfyUI 请求未成功；请检查本地服务与模型，文字故事可继续。');
      return response;
    };
    const json = async (path, options) => {
      const response = await request(path, options);
      const bytes = await limitedBody(response, JSON_MAX_BYTES, signal);
      current();
      try { return JSON.parse(bytes.toString('utf8')); } catch { throw error('ComfyUI 响应格式无效。'); }
    };
    const catalog = this.#workflow ? null : await json('/object_info/CheckpointLoaderSimple');
    let graph;
    if (this.#workflow) {
      // 自定义工作流自带模型与节点，不再询问 /object_info。
      graph = materializeWorkflow(this.#workflow, { prompt: [info.scene, info.outfits, info.prompt].filter(Boolean).join('\n') });
    } else {
      const spec = catalog?.CheckpointLoaderSimple?.input?.required?.ckpt_name;
      const checkpoints = spec?.[0];
      if (!Array.isArray(checkpoints) || !checkpoints.length) throw error('ComfyUI 未提供可用 checkpoint；请先在本地安装兼容模型。');
      const checkpoint = checkpoints.includes(spec?.[1]?.default) ? spec[1].default : checkpoints[0];
      if (typeof checkpoint !== 'string' || !checkpoint || checkpoint.length > 300 || /[\x00-\x1f]/.test(checkpoint)) throw error('ComfyUI checkpoint 格式无效。');
      graph = workflow(checkpoint, [info.scene, info.outfits, info.prompt].filter(Boolean).join('\n'));
    }
    const submitted = await json('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: randomUUID(), prompt: graph }) });
    if (typeof submitted?.prompt_id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(submitted.prompt_id)) throw error('ComfyUI 未返回有效任务标识。');
    let image;
    while (!image) {
      current();
      const history = await json(`/history/${encodeURIComponent(submitted.prompt_id)}`);
      const job = history?.[submitted.prompt_id];
      if (job?.status?.status_str === 'error') throw error('ComfyUI 生成失败；请检查本地模型与工作流，文字故事可继续。');
      image = firstOutputImage(job?.outputs);
      if (!image) {
        if (job?.status?.completed === true) throw error('ComfyUI 任务完成但未返回图片，响应格式无效。');
        await pause(this.#poll, signal);
      }
    }
    const safePart = (value, max) => typeof value === 'string' && value.length <= max
      && !/[\x00-\x1f\\]/.test(value) && !value.split('/').some((part) => part === '..' || part === '.')
      && !value.startsWith('/') && !value.includes(':');
    if (!safePart(image.filename, 255) || !image.filename || image.filename.includes('/')
      || !safePart(image.subfolder ?? '', 500) || !['output', 'temp', 'input'].includes(image.type ?? 'output')) {
      throw error('ComfyUI 图片记录格式无效；不接受返回的远程 URL 或文件路径。');
    }
    // Construct /view ourselves, never follow a URL returned by the endpoint.
    const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' });
    const response = await request(`/view?${query}`);
    const bytes = await limitedBody(response, STORY_IMAGE_MAX_BYTES, signal);
    current();
    const type = imageType(bytes);
    if (!type) throw error('ComfyUI 图片格式无效；仅接受 PNG、JPEG 或 WebP。');
    const declared = (response.headers?.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (declared && declared !== 'application/octet-stream' && declared !== type.mime) throw error('ComfyUI 图片格式与响应类型不一致。');
    await mkdir(this.#dir, { recursive: true });
    current();
    const imageId = `${randomUUID()}.${type.ext}`;
    const file = join(this.#dir, imageId);
    let handle;
    let saved = false;
    try {
      handle = await open(file, 'wx', 0o600);
      current();
      await handle.writeFile(bytes);
      await handle.close();
      handle = undefined;
      current();
      saved = true;
      return imageId;
    } finally {
      await handle?.close().catch(() => {});
      if (!saved) await unlink(file).catch(() => {});
    }
  }

  async read(id) {
    if (typeof id !== 'string' || !ID.test(id)) return { ok: false, error: '无效图片标识。' };
    try {
      const file = join(this.#dir, id);
      const stat = await lstat(file);
      if (!stat.isFile() || stat.size > STORY_IMAGE_MAX_BYTES) throw error('invalid');
      const bytes = await readFile(file);
      if (bytes.length > STORY_IMAGE_MAX_BYTES) throw error('invalid');
      const type = imageType(bytes);
      if (!type || !id.endsWith(`.${type.ext}`)) throw error('invalid');
      return { ok: true, dataUrl: `data:${type.mime};base64,${bytes.toString('base64')}` };
    } catch { return { ok: false, error: '图片不存在、过大或格式无效。' }; }
  }
}
