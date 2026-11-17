#!/usr/bin/env node
/**
 * 提示词模板自检：ENV_PROMPT.md 里的 `{{变量}}` 必须和 `envPromptVars()` 的键一一对上。
 *
 * 为什么要这一项：宿主把 `envPromptVars()` 的返回值填进模板里的 `{{key}}`。
 * 键名打错（写了 `{{fun_places}}` 但给的是 `fun_places_block`）**不会报错**——
 * 占位符原样留在提示词里，她就真的看到一行 `{{fun_places}}`。
 * feast 那边同样有这个风险，所以这个检查值得单独跑一次。
 *
 * 用法：node tools/check-prompt.mjs
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { DEFAULTS } from '../src/config.js';
import { FunWorld } from '../src/world.js';

const PROMPT = fileURLToPath(new URL('../src/ENV_PROMPT.md', import.meta.url));
const TZ = 'Asia/Shanghai';

let failures = 0;
const ok = (cond, what, extra = '') => {
  if (cond) console.log(`  ok   ${what}`);
  else { failures += 1; console.log(`  FAIL ${what}${extra ? ` → ${extra}` : ''}`); }
};

const template = await readFile(PROMPT, 'utf8');
const used = [...new Set([...template.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];

const world = new FunWorld({ cfg: { ...DEFAULTS, enabled: true }, dataDir: process.cwd(), timezone: TZ });
await world.start({ log: { info() {}, warn() {} } });
const provided = Object.keys(world.envPromptVars());

console.log('ENV_PROMPT.md 里用到的占位符：', used.join(', ') || '（无）');
console.log('envPromptVars() 提供的键：', provided.join(', ') || '（无）');

for (const key of used) {
  ok(provided.includes(key), `模板里的 {{${key}}} 有对应返回值`);
}
for (const key of provided) {
  ok(used.includes(key), `envPromptVars 的 ${key} 在模板里被用到（没有白算）`);
}

// 模板本身不能残留未闭合的花括号或占位符拼写痕迹。
ok(!/\{\{[^}]*$/.test(template), '没有未闭合的 {{');
ok(!/\uFFFD/.test(template), '模板里没有替换字符（编码没坏）');

// 三处互指得真的在文件里（这是联动的骨架，删了就断）。
for (const [needle, why] of [
  ['feast_life_now', '出门前查日程'],
  ['feast_life_play', '逛完记一笔'],
  ['imggen_draw', '发图填参数'],
  ['scene', '把 scene 正名递到嘴边'],
]) {
  ok(template.includes(needle), `ENV_PROMPT 里写了 ${needle}（${why}）`);
}

// 瘦身时最容易误删的红线：教程式说明可以砍，约束一个字都不能少。
// 这些是「不编味道 / 不探测别的扩展 / 不编库里没有的名字」的落点，
// 少了模板还在、行为却会悄悄跑偏（她开始自己形容味道、硬填 scene）。
for (const [needle, why] of [
  ['别形容味道', '吃喝不编味道'],
  ['不会探测', '不探测别的扩展装没装'],
  ['库里没找到', '不替她编库里没有的场景名'],
  ['预设删不掉', '预设只能恢复不能删'],
]) {
  ok(template.includes(needle), `ENV_PROMPT 里留着红线：${why}`);
}

await world.stop();

console.log('');
if (failures) {
  console.log(`X ${failures} 项没过`);
  process.exit(1);
}
console.log('全部通过');
