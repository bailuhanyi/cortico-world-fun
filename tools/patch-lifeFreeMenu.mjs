#!/usr/bin/env node
/**
 * 给「鱼的每一天」的 `lifeFreeMenu` 补一行 `fun_*` 的指引。
 *
 * 这是方案 §二② 的落地：**改配置值，不是改代码**。
 * 不动 feast 的 22 个未提交文件、不动版本、不动 describe.json、不用重跑 make-describe。
 *
 * 为什么是脚本而不是手改：
 *   - `config.json` 是 Coo 整份重写的，手改容易在中途撞上写入；
 *   - 这个值是**多行字符串**，手打容易把 `\n` 弄成真换行、或者把后面的行吃掉；
 *   - 脚本幂等：已经有一行提到 `fun_go` 就跳过，跑两遍不会加两条。
 *
 * 用法（用户自己的 PowerShell，**先完全退出 Coo**）：
 *
 *   node tools/patch-lifeFreeMenu.mjs --config "E:\Coopanion\data\home\companion\config.json"
 *   node tools/patch-lifeFreeMenu.mjs --config "…" --write
 *
 * 不带 `--write` 就是预演。**默认会先备份**成 `config.json.bak-fun-<时间戳>`。
 *
 * 红线：只碰 `worlds.feast.lifeFreeMenu` 这一个字符串。其余键、其余 World 一律不碰；
 * 写回前把整份 JSON 解析一遍，解析不过就放弃，绝不写坏 config。
 */

import { copyFile, readFile, writeFile } from 'node:fs/promises';

const argv = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const WRITE = argv.includes('--write');
const CONFIG = getArg('config');

const say = (line = '') => process.stdout.write(`${line}\n`);

/**
 * 要补的那一行。
 *
 * 写法照 feast 配置描述里的官方建议：「想让她真用上某个工具，在这里写明」。
 * 一行里把四个动作串成一句，别写成四条——`lifeFreeMenu` 是「例子」，不是待办清单。
 *
 * **刻意不点名具体场所**：场所库以后还会加（v0.1.0 已从 4 处扩到 12 处），
 * 写死「游乐场 / 海洋馆 / 庙会 / 漫展」的话，每加一处都得回来改这行配置。
 * 让 `fun_places` 自己去列，这一行就长期有效。
 */
const FUN_LINE = '- 出门逛逛：fun_places 看今天能去哪（游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山……）→ fun_go 进门 → fun_wander 逛一处 → fun_home 收摊';

/**
 * 老版本写死四类场所的那一行。已经写过的话要**替换**掉，不能只追加，
 * 否则菜单里会出现两条几乎一样的「出门逛逛」。
 */
const LEGACY_LINE_RE = /^.*去游乐场 \/ 海洋馆 \/ 庙会 \/ 漫展逛逛.*$/m;

async function main() {
  if (!CONFIG) {
    say('缺 --config。例：node tools/patch-lifeFreeMenu.mjs --config "E:\\Coopanion\\data\\home\\companion\\config.json"');
    process.exitCode = 1;
    return;
  }

  let raw;
  try {
    raw = await readFile(CONFIG, 'utf8');
  } catch (err) {
    say(`✗ 读不到 ${CONFIG}：${err instanceof Error ? err.message : String(err)}`);
    say('  （Coo 没初始化过？或者路径写错了。）');
    process.exitCode = 1;
    return;
  }

  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    say(`✗ ${CONFIG} 不是合法 JSON：${err instanceof Error ? err.message : String(err)}`);
    say('  不动它。先确认 Coo 不是正在写这个文件。');
    process.exitCode = 1;
    return;
  }

  const feast = cfg?.worlds?.feast;
  if (!feast || typeof feast !== 'object') {
    say('✗ 这份 config 里没有 worlds.feast 段——鱼的每一天没装？还是装到别的数据目录了？');
    process.exitCode = 1;
    return;
  }

  const current = typeof feast.lifeFreeMenu === 'string' ? feast.lifeFreeMenu : '';
  // 已经是新版那一行：什么都不用做。
  if (current.includes(FUN_LINE)) {
    say('= lifeFreeMenu 里已经是最新的 fun_* 那一行了，跳过。');
    return;
  }
  if (!current.trim()) {
    say('! lifeFreeMenu 是空的。这一项是「她自己的时间」叫醒时贴给她的例子，');
    say('  空着等于那一档没有例子可参考。这个脚本只**追加**一行，不会凭空造一份菜单——');
    say('  建议先在 Coo 的配置页把这一项填回默认的四条通用说法，再跑这个脚本。');
    process.exitCode = 1;
    return;
  }

  // 老版本（写死四类场所）那一行要替换掉，不能只追加。
  const isLegacy = LEGACY_LINE_RE.test(current);
  const next = isLegacy
    ? current.replace(LEGACY_LINE_RE, FUN_LINE)
    : `${current.replace(/\s+$/, '')}\n${FUN_LINE}`;

  say(`配置：${CONFIG}`);
  say(`模式：${WRITE ? '真写' : '预演（加 --write 才落盘）'}`);
  say();
  if (isLegacy) {
    say('检测到老版本那一行（写死了四类场所），会被**替换**成新的这行：');
  } else {
    say('将要追加的一行：');
  }
  say(`  ${FUN_LINE}`);
  say();
  say(`${isLegacy ? '替换' : '追加'}之后 lifeFreeMenu 的样子：`);
  for (const line of next.split('\n')) say(`  ${line}`);
  say();

  if (!WRITE) {
    say('以上是预演。确认没问题后加 --write 再跑一遍。');
    return;
  }

  // 备份 → 只改一个键 → 整份重新序列化 → 自检 → 落盘。
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const bak = `${CONFIG}.bak-fun-${stamp}`;
  await copyFile(CONFIG, bak);
  say(`已备份：${bak}`);

  feast.lifeFreeMenu = next;
  const out = `${JSON.stringify(cfg, null, 2)}\n`;

  // 自检：能解析回来、且确实只多了这一行。
  let check;
  try {
    check = JSON.parse(out);
  } catch (err) {
    say(`✗ 序列化后解析失败，已放弃（备份还在：${bak}）：${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }
  if (check?.worlds?.feast?.lifeFreeMenu !== next) {
    say('✗ 自检不通过（写回去的值和预期不一致），已放弃。');
    process.exitCode = 1;
    return;
  }

  await writeFile(CONFIG, out, 'utf8');
  say('✓ 写回完成。改完下一档生效，不用重启（但要重启才会读到新的 config——建议重启 Coo）。');
}

main().catch((err) => {
  say(`✗ 出错：${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
