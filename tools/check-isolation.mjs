#!/usr/bin/env node
/**
 * 契约审计：这个插件**绝不能**出现对别的 World 的运行时依赖。
 *
 * 为什么单独一个工具：World 契约里最容易被打破的一条是「一个 World 依赖另一个扩展」，
 * 认证会查它。而违反它的方式很隐蔽——`readFileSync('../feast/state.json')`、
 * `import('cortico-world-feast')`、去 `imggen-library` 读条目……每一条都是「能跑，
 * 但等于偷偷装了个依赖」。
 *
 * 这个脚本只读源码做静态检查，不执行任何东西。查四件事：
 *
 *   1. src/ 下不出现别的 World 的包名（cortico-world-*）
 *   2. src/ 下不读 imggen-library / feast 的数据目录
 *   3. src/ 下不 import 任何非 node: 内置、非本包的文件
 *   4. 吃/喝相关的数据里没有味道词（味道是 feast 的，不是我们的）
 *
 * 用法：node tools/check-isolation.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

let failures = 0;
const ok = (cond, what, extra = '') => {
  if (cond) console.log(`  ok   ${what}`);
  else { failures += 1; console.log(`  FAIL ${what}${extra ? ` -> ${extra}` : ''}`); }
};

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

const files = walk(SRC).filter((f) => /\.(js|mjs|json)$/.test(f));
console.log(`检查 ${files.length} 个源文件（src/ 下）`);
console.log('');

/** 只查代码，不查注释：注释里提到 feast 是在解释「为什么不读它」，那是好事。 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

console.log('1) 不出现别的 World 的包名');
for (const f of files) {
  const code = stripComments(readFileSync(f, 'utf8'));
  const rel = relative(ROOT, f);
  // JSON 数据文件里出现包名不算（那可能是关键词），所以只查代码。
  if (!/\.(js|mjs)$/.test(f)) continue;
  const hit = [...code.matchAll(/cortico-world-[\w-]+/g)].map((m) => m[0]);
  // 允许出现自己的包名（cortico-world-fun），别的一概不许。
  const foreign = hit.filter((name) => name !== 'cortico-world-fun');
  ok(!foreign.length, `${rel} 没有引用别的 World 包名`, foreign.join(', '));
}

console.log('2) 不读别人的数据目录 / 素材库');
for (const f of files) {
  const code = stripComments(readFileSync(f, 'utf8'));
  const rel = relative(ROOT, f);
  for (const pattern of [/imggen-library/, /['"]feast['"]\s*[,\]]/, /feast\/state\.json/, /feast\/life/]) {
    ok(!pattern.test(code), `${rel} 没有碰 ${pattern}`, '');
  }
}

console.log('3) 只 import node: 内置或本包内的文件');
const ALLOWED = new Set(['node:fs', 'node:fs/promises', 'node:path', 'node:url', 'node:zlib', 'node:os']);
for (const f of files) {
  if (!/\.(js|mjs)$/.test(f)) continue;
  const code = stripComments(readFileSync(f, 'utf8'));
  const rel = relative(ROOT, f);
  const specs = [
    ...[...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
  const bad = specs.filter((s) => !ALLOWED.has(s) && !s.startsWith('.'));
  ok(!bad.length, `${rel} 的 import 都在白名单内`, bad.join(', '));
}

console.log('4) 吃喝数据里没有味道词（味道是鱼的每一天的）');
const venuesPath = join(SRC, 'venues.js');
const venuesCode = readFileSync(venuesPath, 'utf8');
// 取 food 区块：从 `food: {` 到匹配的 `}`，粗粒度过得去。
const foodBlocks = [...venuesCode.matchAll(/food:\s*\{[\s\S]*?\n    \}/g)].map((m) => m[0]);
ok(foodBlocks.length >= 3, `找到 ${foodBlocks.length} 处 food 区块（应当 >= 3）`);
const TASTE = /香|甜度|顺滑|回甘|浓郁|醇厚|弹牙|滋味|口感/;
for (const block of foodBlocks) {
  const itemsLine = /items:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? '';
  const hit = itemsLine.match(TASTE);
  ok(!hit, `food.items 里没有味道词${hit ? `（发现「${hit[0]}」）` : ''}`, hit ? itemsLine.slice(0, 80) : '');
}

console.log('');
if (failures) {
  console.log(`X ${failures} 项没过——这个插件偷偷依赖了别的 World`);
  process.exit(1);
}
console.log('隔离审计通过：没有运行时依赖别的 World，吃喝数据里也没有味道');
