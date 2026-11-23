/**
 * 测试临时目录与 World 的统一清理。
 *
 * 为什么要有这个：`mkdtemp` 只创建不登记，用例结束（或进程被杀）时没人删；
 * 更麻烦的是 World 还有写队列——`t.after` 立刻 `rm` 会撞上迟到的 `fun/state.json`
 * 保存，Windows 的 rmdir 返回 ENOTEMPTY（`force: true` 只吞 ENOENT，不重试这个错误码），
 * node:test 就把这次清理失败算到当轮正在收尾的任意一条用例头上。
 *
 * 用法：
 *   - 目录：`const dir = await tempDir('fun-story-')`（不要再用 mkdtemp）；
 *   - 会起 World 的用例：`trackWorld(world)`，清理时先 `stop()` 排空写队列再删目录；
 *   - node:test 文件末尾：`after(cleanupAll)`；
 *   - 自建 harness（test/harness.mjs）：`report()` 末尾已经统一调用。
 *
 * 只删自己登记过的目录，不扫系统临时目录；清理失败只告警，不影响断言。
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dirs = [];
const worlds = [];

/** 建一个本进程内登记的临时目录。 */
export async function tempDir(prefix = 'fun-') {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

/** 登记一个 World：清理时先 stop（排空写队列），再删它用的目录。 */
export function trackWorld(world) {
  if (world && typeof world.stop === 'function') worlds.push(world);
  return world;
}

/**
 * node:test 用例的清理钩子：`cleanup(t, dir, world)`。
 * 先停传入的 World（排空写队列），再删传入的目录；ENOTEMPTY 重试。
 * 清理失败只告警、不抛——否则清理失败会被 node:test 记到当前用例头上。
 */
export function cleanup(t, ...items) {
  t.after(async () => {
    for (const item of [...items].reverse()) {
      if (item && typeof item.stop === 'function') { try { await item.stop(); } catch {} }
    }
    for (const item of items) {
      if (typeof item !== 'string') continue;
      try { await rm(item, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch {}
    }
  });
}

/** 清掉本进程登记过的全部 World 与临时目录；可重复调用。 */
export async function cleanupAll() {
  let failures = 0;
  for (const world of worlds.splice(0).reverse()) {
    try { await world.stop(); } catch { failures += 1; }
  }
  for (const dir of dirs.splice(0)) {
    try { await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); }
    catch { failures += 1; }
  }
  if (failures) console.warn(`! 临时目录清理：${failures} 项未完成（不影响断言）`);
}