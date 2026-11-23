import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const MASK = '••••••••';
const MAX_FILE_BYTES = 64 * 1024;
const SCHEME = 'windows-dpapi-current-user';
const MESSAGES = Object.freeze({
  WINDOWS_ONLY: '仅 Windows 支持本机 DPAPI 加密；此平台不能保存或使用自定义主持密钥，请沿用宿主模型。',
  INVALID_PAIR: '接口地址和 API Key 必须成对填写，或同时留空以清除。',
  INVALID_URL: '接口地址格式无效；请填写不含用户名、密码、查询或片段的 HTTP(S) 接口地址。',
  INVALID_KEY: 'API Key 格式无效，请重新填写。',
  SECRET_STORAGE: '主持加密设置无法读写，请检查本机存储后重试。',
  SECRET_CRYPTO: '主持加密设置无法在当前 Windows 用户下解密，请清除后重新填写。',
  SECRET_REVOKED: '主持密钥已清除或变更；本次请求及迟到结果已失效。',
  API_TIMEOUT: '主持接口等待超时；上游可能仍计费，可以有限重试。',
  API_UNAUTHORIZED: '主持接口认证失败（401/403），请重新填写地址和密钥。',
  API_QUOTA: '主持接口额度不足或请求过于频繁（429），请稍后重试。',
  API_HTTP: '主持接口返回失败状态，请检查接口设置后有限重试。',
  API_NETWORK: '主持接口连接失败，请检查地址和网络后有限重试。',
  API_FORMAT: '主持接口返回格式无效；需要 OpenAI 兼容的 chat/completions JSON 响应。',
  API_MODEL: '主持模型未设置或格式无效，请使用现有宿主所选模型。',
  NO_URL: '主持接口地址还没填；请到「配置 → 从0开始的肥鱼大冒险」填写接口地址与模型名。API Key 仍只存在本机，不放进配置。',
});

class StorySecretError extends Error {
  constructor(code) {
    super(MESSAGES[code] ?? MESSAGES.SECRET_STORAGE);
    this.name = 'StorySecretError';
    this.code = Object.hasOwn(MESSAGES, code) ? code : 'SECRET_STORAGE';
  }
}
const reject = (code) => { throw new StorySecretError(code); };
/** Only fixed, credential-free messages may cross the StoryDM error boundary. */
export function storyDmErrorMessage(error) {
  return error instanceof StorySecretError ? MESSAGES[error.code] : null;
}

function credentials(input) {
  if (!input || typeof input.apiUrl !== 'string' || typeof input.apiKey !== 'string') reject('INVALID_PAIR');
  const apiUrl = input.apiUrl.trim();
  const apiKey = input.apiKey.trim();
  if (!apiUrl && !apiKey) return null;
  if (!apiUrl || !apiKey) reject('INVALID_PAIR');
  assertUrl(apiUrl);
  assertKey(apiKey);
  // 模型名由用户填写，不预设任何厂商；留空表示交给接口自己的默认模型。
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (model.length > 200 || /[\u0000-\u001f\u007f]/u.test(model)) reject('API_MODEL');
  return { apiUrl, apiKey, model };
}

/** 只有密钥的记录（0.7.3 起地址与模型在配置里，密钥仍单独加密保存）。 */
function keyOnly(input) {
  if (!input || typeof input.apiKey !== 'string') reject('INVALID_KEY');
  const apiKey = input.apiKey.trim();
  if (!apiKey) return null;
  assertKey(apiKey);
  return { apiUrl: '', apiKey, model: '' };
}

function assertKey(apiKey) {
  if (apiKey.length > 4096 || /[\u0000-\u0020\u007f]/u.test(apiKey)) reject('INVALID_KEY');
}

function assertUrl(apiUrl) {
  if (apiUrl.length > 2048 || /[\u0000-\u0020\u007f]/u.test(apiUrl)) reject('INVALID_URL');
  let url;
  try { url = new URL(apiUrl); } catch { reject('INVALID_URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) reject('INVALID_URL');
}

function endpoint(apiUrl) {
  const url = new URL(apiUrl);
  const path = url.pathname.replace(/\/+$/u, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return url.href;
}

/** Static commands contain no secret; plaintext travels solely through child stdin. */
const DPAPI_PROTECT = `$ErrorActionPreference='Stop'; try { [Console]::InputEncoding=New-Object Text.UTF8Encoding($false); [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd(); $b=[Text.Encoding]::UTF8.GetBytes($s); $c=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($c)) } catch { exit 1 }`;
const DPAPI_UNPROTECT = `$ErrorActionPreference='Stop'; try { [Console]::InputEncoding=New-Object Text.UTF8Encoding($false); [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd(); $b=[Convert]::FromBase64String($s); $c=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($c)) } catch { exit 1 }`;

export function createDpapiCrypto({ platform = process.platform, spawnImpl = spawn, timeout = 10_000 } = {}) {
  const run = (command, input) => new Promise((resolve, rejectPromise) => {
    if (platform !== 'win32') return rejectPromise(new StorySecretError('WINDOWS_ONLY'));
    let child;
    let timer;
    let output = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectPromise(new StorySecretError('SECRET_CRYPTO'));
      else resolve(value);
    };
    try {
      const executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      child = spawnImpl(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
        windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
      });
      timer = setTimeout(() => { finish(true); child.kill(); }, timeout);
      child.on('error', () => finish(true));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        output += chunk;
        if (Buffer.byteLength(output) > MAX_FILE_BYTES) { finish(true); child.kill(); }
      });
      child.stdout.on('error', () => finish(true));
      child.stdin.on('error', () => finish(true));
      child.on('close', (code) => finish(code !== 0 || !output, output));
      child.stdin.end(input, 'utf8');
    } catch { finish(true); }
  });
  return Object.freeze({
    supported: platform === 'win32', scheme: SCHEME,
    protect: (plaintext) => run(DPAPI_PROTECT, plaintext),
    unprotect: (ciphertext) => run(DPAPI_UNPROTECT, ciphertext),
  });
}

async function safeDirectory(path, create = false) {
  if (create) await mkdir(path, { recursive: true, mode: 0o700 });
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) reject('SECRET_STORAGE');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' && !create) return false;
    throw error;
  }
}

async function responseText(response, controller) {
  if (Number(response.headers?.get?.('content-length')) > MAX_FILE_BYTES) reject('API_FORMAT');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_FILE_BYTES) reject('API_FORMAT');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_BYTES) { reader.cancel().catch(() => {}); reject('API_FORMAT'); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

/**
 * Dedicated local encrypted storage. Never put this object, its provider, or input
 * credentials in config/state/receipts. Public callers receive only `status`.
 * crypto/fetch injection exists for offline tests; production defaults to DPAPI.
 */
export class StorySecrets {
  #dir;
  #file;
  #crypto;
  #fetch;
  #model = '';
  #urlFrom;
  #modelFrom;
  #timeout;
  #onInvalidate;
  #loaded = false;
  #saved = false;
  #error = null;
  #revoked = false;
  #revision = 0;
  #queue = Promise.resolve();
  #requests = new Set();

  constructor({ dataDir, crypto = createDpapiCrypto(), fetch = globalThis.fetch,
    timeout = 20_000, onInvalidate = () => {}, url, model } = {}) {
    if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) reject('SECRET_STORAGE');
    this.#dir = join(dataDir, 'fun');
    this.#file = join(this.#dir, 'story-secrets.json');
    this.#crypto = crypto;
    this.#fetch = fetch;
    this.#timeout = timeout;
    this.#onInvalidate = onInvalidate;
    // 0.7.3：地址与模型在配置里现读；密钥仍只存本机密文。
    this.#urlFrom = typeof url === 'function' ? url : null;
    this.#modelFrom = typeof model === 'function' ? model : null;
  }

  get status() {
    return { saved: this.#saved, supported: this.#crypto?.supported === true,
      available: this.#saved && !this.#revoked && !this.#error && this.#crypto?.supported === true,
      apiUrlMask: this.#saved ? MASK : '', apiKeyMask: this.#saved ? MASK : '', model: this.#model,
      ...(this.#error ? { error: MESSAGES[this.#error] } : {}),
    };
  }

  #run(task) {
    const result = this.#queue.then(task, task);
    this.#queue = result.catch(() => {});
    return result;
  }

  #invalidate() {
    this.#revision++;
    this.#revoked = true;
    for (const controller of this.#requests) controller.abort();
    try { this.#onInvalidate(); } catch { /* Never expose a host callback's error. */ }
    return this.#revision;
  }

  #failure(error) {
    const code = error instanceof StorySecretError ? error.code : 'SECRET_STORAGE';
    return { ok: false, code, error: MESSAGES[code], dm: this.status };
  }

  async #read() {
    if (!(await safeDirectory(this.#dir))) return null;
    let info;
    try { info = await lstat(this.#file); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE_BYTES) reject('SECRET_STORAGE');
    let saved;
    try { saved = JSON.parse(await readFile(this.#file, 'utf8')); }
    catch { reject('SECRET_STORAGE'); }
    if (saved?.version !== 1 || saved?.scheme !== SCHEME || typeof saved.ciphertext !== 'string'
      || !/^[A-Za-z0-9+/]+={0,2}$/u.test(saved.ciphertext) || saved.ciphertext.length > MAX_FILE_BYTES) reject('SECRET_CRYPTO');
    return saved.ciphertext;
  }

  async #decrypt(ciphertext) {
    if (this.#crypto?.supported !== true) reject('WINDOWS_ONLY');
    try {
      const decoded = await this.#crypto.unprotect(ciphertext);
      if (typeof decoded !== 'string' || Buffer.byteLength(decoded) > 16 * 1024) reject('SECRET_CRYPTO');
      const parsed = JSON.parse(decoded);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.apiKey !== 'string' || !parsed.apiKey.trim()) reject('SECRET_CRYPTO');
      // 旧记录带地址与模型（成对校验）；新记录只有密钥，地址与模型从配置读。
      const value = typeof parsed.apiUrl === 'string' && parsed.apiUrl.trim()
        ? credentials(parsed)
        : { apiUrl: '', apiKey: parsed.apiKey.trim(), model: '' };
      if (!value) reject('SECRET_CRYPTO');
      return value;
    } catch { reject('SECRET_CRYPTO'); }
  }

  /** Call during world.start(); status then stays synchronous for panel views. */
  load() {
    return this.#run(async () => {
      if (this.#loaded) return { ok: !this.#error, dm: this.status };
      try {
        const ciphertext = await this.#read();
        this.#saved = ciphertext !== null;
        if (ciphertext !== null) {
          const value = await this.#decrypt(ciphertext);
          this.#model = value.model;
        }
        this.#error = null;
      } catch (error) {
        this.#saved = true; // An unreadable file is never silently treated as host fallback.
        this.#error = error instanceof StorySecretError ? error.code : 'SECRET_STORAGE';
      }
      this.#loaded = true;
      return this.#error ? this.#failure(new StorySecretError(this.#error)) : { ok: true, dm: this.status };
    });
  }

  save(input = {}) {
    const hasUrl = Object.hasOwn(input, 'apiUrl');
    const hasKey = Object.hasOwn(input, 'apiKey');
    const hasModel = Object.hasOwn(input, 'model');
    if (!hasUrl && !hasKey && !hasModel) return this.load();
    // 0.7.3：面板只提交 API Key；地址与模型在配置里。
    if (hasKey && !hasUrl && !hasModel) {
      let value;
      try { value = keyOnly(input); } catch (error) { return Promise.resolve(this.#failure(error)); }
      if (!value) return this.clear();
      return this.#write(value);
    }
    if (hasUrl || hasKey) {
      if (!hasUrl || !hasKey) return Promise.resolve(this.#failure(new StorySecretError('INVALID_PAIR')));
      let value;
      try { value = credentials(input); } catch (error) { return Promise.resolve(this.#failure(error)); }
      if (!value) return this.clear();
      return this.#write(value);
    }
    // 只改模型名：沿用已保存的地址和密钥，重新加密写回同一份密文。
    return (async () => {
      try {
        const ciphertext = await this.#read();
        if (!ciphertext) reject('SECRET_STORAGE');
        const current = await this.#decrypt(ciphertext);
        return this.#write(credentials({ apiUrl: current.apiUrl, apiKey: current.apiKey, model: input.model }));
      } catch (error) { return this.#failure(error); }
    })();
  }

  /** Internal only: the saved endpoint and model, for the one-time 0.7.3 config migration. */
  async legacyEndpoint() {
    try {
      const ciphertext = await this.#read();
      if (!ciphertext) return { apiUrl: '', model: '' };
      const value = await this.#decrypt(ciphertext);
      return { apiUrl: value.apiUrl, model: value.model };
    } catch { return { apiUrl: '', model: '' }; }
  }

  /**
   * 迁移写完配置后调用：把旧记录重写成「只含密钥」的密文。
   * 地址与模型不再留在密文里；密钥本身仍是 DPAPI 密文。
   */
  async rewriteKeyOnly() {
    try {
      const ciphertext = await this.#read();
      if (!ciphertext) return { ok: true, dm: this.status };
      const value = await this.#decrypt(ciphertext);
      return this.#write({ apiKey: value.apiKey });
    } catch (error) {
      return this.#failure(error);
    }
  }

  #write(value) {
    if (this.#crypto?.supported !== true) return Promise.resolve(this.#failure(new StorySecretError('WINDOWS_ONLY')));
    const revision = this.#invalidate();
    return this.#run(async () => {
      let temporary;
      try {
        if (revision !== this.#revision) reject('SECRET_REVOKED');
        let ciphertext;
        try { ciphertext = await this.#crypto.protect(JSON.stringify(value)); }
        catch { reject('SECRET_CRYPTO'); }
        if (revision !== this.#revision) reject('SECRET_REVOKED');
        if (typeof ciphertext !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/u.test(ciphertext)
          || ciphertext.length > MAX_FILE_BYTES - 256 || (value.apiKey && ciphertext.includes(value.apiKey))
          || (value.apiUrl && ciphertext.includes(value.apiUrl))) reject('SECRET_CRYPTO');
        await safeDirectory(this.#dir, true);
        // Reject an existing symlink before replacing the file.
        await this.#read();
        temporary = join(this.#dir, `.story-secrets-${randomUUID()}.tmp`);
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(JSON.stringify({ version: 1, scheme: SCHEME, ciphertext }), 'utf8');
          await file.sync();
        } finally { await file.close(); }
        if (revision !== this.#revision) reject('SECRET_REVOKED');
        await rename(temporary, this.#file);
        temporary = undefined;
        if (revision !== this.#revision) reject('SECRET_REVOKED');
        this.#loaded = true;
        this.#saved = true;
        this.#model = value.model;
        this.#error = null;
        this.#revoked = false;
        return { ok: true, dm: this.status };
      } catch (error) {
        if (revision === this.#revision) this.#error = error instanceof StorySecretError ? error.code : 'SECRET_STORAGE';
        return this.#failure(error);
      } finally {
        if (temporary) await unlink(temporary).catch(() => {});
        value = null;
      }
    });
  }

  /** Invalidates captured providers and active fetches immediately, before disk I/O. */
  clear() {
    const revision = this.#invalidate();
    return this.#run(async () => {
      try {
        if (await safeDirectory(this.#dir)) {
          const info = await lstat(this.#file).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
          if (info && (!info.isFile() || info.isSymbolicLink())) reject('SECRET_STORAGE');
          if (info) await unlink(this.#file);
        }
        if (revision === this.#revision) {
          this.#loaded = true;
          this.#saved = false;
          this.#model = '';
          this.#error = null;
          this.#revoked = false;
        }
        return { ok: true, dm: this.status };
      } catch (error) {
        if (revision === this.#revision) this.#error = 'SECRET_STORAGE';
        return this.#failure(error);
      }
    });
  }

  /** Internal only: resolves an adapter, never the decrypted URL/key themselves. */
  async cognition(hostCognition) {
    await this.load();
    if (!this.#saved && !this.#revoked) return hostCognition;
    const revision = this.#revision;
    const unavailable = this.#error;
    return Object.freeze({
      storyDmDirect: true,
      request: (request) => this.#request(revision, unavailable, request),
    });
  }

  async #request(revision, unavailable, request) {
    const current = () => {
      if (revision !== this.#revision || this.#revoked) reject('SECRET_REVOKED');
      if (unavailable) reject(unavailable);
      if (this.#crypto?.supported !== true) reject('WINDOWS_ONLY');
    };
    current();
    if (typeof this.#fetch !== 'function') reject('API_NETWORK');
    const controller = new AbortController();
    this.#requests.add(controller);
    const abort = () => controller.abort();
    let timer;
    let timedOut = false;
    let onAbort;
    const aborted = new Promise((_, rejectPromise) => {
      onAbort = () => rejectPromise(new StorySecretError(timedOut ? 'API_TIMEOUT' : 'SECRET_REVOKED'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    request?.signal?.addEventListener('abort', abort, { once: true });
    if (request?.signal?.aborted) controller.abort();
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.#timeout);
    try {
      const task = (async () => {
        const ciphertext = await this.#read();
        current();
        if (!ciphertext) reject('SECRET_REVOKED');
        const value = await this.#decrypt(ciphertext);
        current();
        if (controller.signal.aborted) reject(timedOut ? 'API_TIMEOUT' : 'SECRET_REVOKED');
        const model = String(this.#modelFrom?.() ?? '').trim() || value.model;
        if (model && (typeof model !== 'string' || model.length > 200 || /[\u0000-\u001f\u007f]/u.test(model))) reject('API_MODEL');
        // 0.7.3：地址优先读配置；旧密文里的地址只作迁移前的回退。
        const configured = String(this.#urlFrom?.() ?? '').trim();
        const apiUrl = configured || value.apiUrl;
        if (!apiUrl) reject('NO_URL');
        try { assertUrl(apiUrl); } catch { reject('INVALID_URL'); }
        const url = endpoint(apiUrl);
        let response;
        try {
          response = await this.#fetch(url, {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${value.apiKey}` },
            // 没填模型名就不发 model 字段，交给接口自己的默认模型。
            body: JSON.stringify({ ...(model ? { model } : {}), messages: [{ role: 'user', content: request?.brief ?? '' }], stream: false }),
          });
        } catch { current(); reject(timedOut ? 'API_TIMEOUT' : controller.signal.aborted ? 'SECRET_REVOKED' : 'API_NETWORK'); }
        current();
        if (response?.status === 401 || response?.status === 403) reject('API_UNAUTHORIZED');
        if (response?.status === 429) reject('API_QUOTA');
        if (!response?.ok) reject('API_HTTP');
        let parsed;
        try { parsed = JSON.parse(await responseText(response, controller)); }
        catch (error) { if (error instanceof StorySecretError) throw error; reject('API_FORMAT'); }
        current();
        const text = parsed?.choices?.[0]?.message?.content;
        // A malicious upstream must not turn its response into a secret echo.
        if (typeof text !== 'string' || !text.trim() || text.length > 2500
          || [value.apiKey, apiUrl, url].filter(Boolean).some((secret) => text.includes(secret))) reject('API_FORMAT');
        const usage = parsed.usage;
        const input = usage?.prompt_tokens;
        const output = usage?.completion_tokens;
        const total = usage?.total_tokens ?? input + output;
        const known = Number.isSafeInteger(input) && input >= 0 && Number.isSafeInteger(output) && output >= 0
          && Number.isSafeInteger(total) && total >= input + output;
        return { text, ...(known ? { usage: { inputTokens: input, outputTokens: output, totalTokens: total } } : {}) };
      })();
      return await Promise.race([task, aborted]);
    } catch (error) {
      if (error instanceof StorySecretError) throw error;
      reject('API_NETWORK');
    } finally {
      clearTimeout(timer);
      this.#requests.delete(controller);
      controller.signal.removeEventListener('abort', onAbort);
      request?.signal?.removeEventListener('abort', abort);
    }
  }
}
