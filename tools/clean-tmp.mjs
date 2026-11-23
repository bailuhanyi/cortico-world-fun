#!/usr/bin/env node
/**
 * 清掉测试在系统临时目录里留下的 `fun-*` 目录。
 *
 * 为什么要有这个：`mkdtemp` 本身不登记清理，用例失败 / 进程被杀 / 删目录撞上
 * 迟到的写盘（Windows 的 ENOTEMPTY）都会留下整棵数据目录。攒到一万多个之后
 * 每轮全量都在为扫描和删除付时间，竞态窗口也被放大。
 *
 * 安全边界（删东西之前逐条核对）：
 *   - 只看 `os.tmpdir()` 这一层，不递归猜别处；
 *   - 目录名必须以 `--prefix` 开头（默认 `fun-`）；
 *   - 只删修改时间早于 `--older-than-min`（默认 60）分钟的；
 *   - 不跟随符号链接；解析后的绝对路径必须正好是 tmpdir 的直接子目录；
 *   - 默认 dry-run，要真删必须显式 `--apply`。
 *
 * 用法：
 *   node tools/clean-tmp.mjs                 # 只统计
 *   node tools/clean-tmp.mjs --apply         # 删 60 分钟前的
 *   node tools/clean-tmp.mjs --apply --older-than-min 30 --prefix fun-
 */
import { lstat, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const apply = args.includes('--apply');
const prefix = String(flag('prefix', 'fun-'));
const olderThanMin = Number(flag('older-than-min', 60));
if (!Number.isFinite(olderThanMin) || olderThanMin < 0) throw new Error('--older-than-min 需要非负数字');

const root = resolve(tmpdir());
const cutoff = Date.now() - olderThanMin * 60_000;
console.log(`临时目录：${root}`);
console.log(`条件：名字以「${prefix}」开头、修改时间早于 ${new Date(cutoff).toISOString()}（${olderThanMin} 分钟前）`);
console.log(apply ? '模式：真删（--apply）' : '模式：只统计（加 --apply 才真删）');
console.log('');

const entries = await readdir(root, { withFileTypes: true });
let matched = 0;
let skipped = 0;
const failures = [];
for (const entry of entries) {
  if (!entry.name.startsWith(prefix)) continue;
  const path = join(root, entry.name);
  if (dirname(resolve(path)) !== root || basename(resolve(path)) !== entry.name) { skipped += 1; continue; }
  let stat;
  try { stat = await lstat(path); } catch { skipped += 1; continue; }
  if (!stat.isDirectory() || stat.isSymbolicLink()) { skipped += 1; continue; }
  if (stat.mtimeMs >= cutoff) { skipped += 1; continue; }
  matched += 1;
  if (!apply) continue;
  try { await rm(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); }
  catch (err) { failures.push({ path, message: err?.message ?? String(err) }); }
}

console.log(`${apply ? '删除' : '可删除'} ${matched} 个目录；跳过 ${skipped} 个（太新 / 不是目录 / 名字不符）`);
if (!apply) console.log('确认无误后加 --apply 再跑一次。');
if (failures.length) {
  console.log(`\n${failures.length} 个没删掉（可能被杀毒/索引占用）：`);
  for (const failure of failures.slice(0, 10)) console.log(`  ${failure.path} -> ${failure.message}`);
  process.exitCode = 1;
}