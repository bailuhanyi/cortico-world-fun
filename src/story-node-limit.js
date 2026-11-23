import { lstat, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_STORY_NODE_LIMIT = 16;
export const MAX_STORY_NODE_LIMIT = Number.MAX_SAFE_INTEGER;

export function isValidStoryNodeLimit(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_STORY_NODE_LIMIT;
}

/**
 * 旧 `fun/story-node-limit.json` 的读取器。
 *
 * 0.7.3 起故事长度以配置 `funStoryNodeLimit` 为准，面板不再有输入框；
 * 这个类只负责启动时读一次旧文件，供 World 做一次性迁移（`found` 表示盘上有值）。
 * 迁移之后以配置为准，旧文件原样留着，不再写。
 */
export class StoryNodeLimit {
  #file;
  #value = DEFAULT_STORY_NODE_LIMIT;
  #found = false;

  constructor({ dataDir } = {}) {
    if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('StoryNodeLimit requires dataDir.');
    this.#file = join(dataDir, 'fun', 'story-node-limit.json');
  }

  get value() { return this.#value; }

  /** 旧文件里是否有合法值（迁移只看这个，不看默认值）。 */
  get found() { return this.#found; }

  status() { return { nodeLimit: this.#value, found: this.#found }; }

  async load() {
    this.#value = DEFAULT_STORY_NODE_LIMIT;
    this.#found = false;
    try {
      const info = await lstat(this.#file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) return this.status();
      const saved = JSON.parse(await readFile(this.#file, 'utf8'));
      if (saved?.version === 1 && isValidStoryNodeLimit(saved.nodeLimit)) {
        this.#value = saved.nodeLimit;
        this.#found = true;
      }
    } catch { /* Missing or malformed preferences leave no migration value. */ }
    return this.status();
  }

  /** 迁移写进配置之后删掉旧文件，避免下一次启动再搬一遍。 */
  async clear() {
    try { await rm(this.#file, { force: true }); } catch { /* 删不掉就留着，下次启动会再判断。 */ }
    this.#found = false;
  }
}