import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const DEFAULT_STORY_NODE_LIMIT = 16;
export const MAX_STORY_NODE_LIMIT = Number.MAX_SAFE_INTEGER;

export function isValidStoryNodeLimit(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_STORY_NODE_LIMIT;
}

/** Independent, durable setting for author-time story validation. */
export class StoryNodeLimit {
  #file;
  #value = DEFAULT_STORY_NODE_LIMIT;

  constructor({ dataDir } = {}) {
    if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('StoryNodeLimit requires dataDir.');
    this.#file = join(dataDir, 'fun', 'story-node-limit.json');
  }

  get value() { return this.#value; }

  status() { return { nodeLimit: this.#value }; }

  async load() {
    this.#value = DEFAULT_STORY_NODE_LIMIT;
    try {
      const info = await lstat(this.#file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) return this.status();
      const saved = JSON.parse(await readFile(this.#file, 'utf8'));
      if (saved?.version === 1 && isValidStoryNodeLimit(saved.nodeLimit)) this.#value = saved.nodeLimit;
    } catch { /* Missing or malformed preferences keep the safe default. */ }
    return this.status();
  }

  async save(value) {
    if (!isValidStoryNodeLimit(value)) {
      return { ok: false, error: `节点上限必须是 0 到 ${MAX_STORY_NODE_LIMIT} 之间的整数。` };
    }
    const temporary = `${this.#file}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(this.#file), { recursive: true });
      await writeFile(temporary, JSON.stringify({ version: 1, nodeLimit: value }, null, 2), { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, this.#file);
      this.#value = value;
      return { ok: true, ...this.status() };
    } catch {
      return { ok: false, error: '节点上限保存失败；原设置保持不变，请检查本地数据目录后重试。' };
    } finally { await rm(temporary, { force: true }).catch(() => {}); }
  }
}
