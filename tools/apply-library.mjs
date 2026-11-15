#!/usr/bin/env node
/**
 * D 补库：往 imggen 素材库的 `scenes/` 补场景与别名。
 *
 * 为什么单独做成脚本而不是手改：这一步动的是 **live 素材库**
 * （`<数据目录>/imggen-library/scenes/`），改错了会直接影响她画图，
 * 所以写成**幂等 + 先预演**的脚本，跑两遍结果一样，跑之前能看清要动什么。
 *
 * 用法（在用户自己的 PowerShell 里跑，不要走沙箱）：
 *
 *   node tools/apply-library.mjs --root "E:\Coopanion\data\home\companion\data\imggen-library"
 *   node tools/apply-library.mjs --root "…" --write      # 真写
 *
 * 不带 `--write` 就是预演（默认）。
 *
 * 只做三件事，全在既有 `scenes/` 里，**不新建目录层级、不改 entry.json 字段**：
 *
 *   1. 新建 `scenes/游乐场/entry.json`
 *   2. 新建 `scenes/漫展/entry.json`
 *   3. `scenes/神社/entry.json` 的 aliases 补「庙会 / 夏日祭 / 夏夜祭」
 *
 * 水族馆**不用动**：现有别名里已经有「海洋馆」和「看鱼」了（2026-11-15 实读），
 * 定稿文档里那句「补别名」落地时发现已经补过了，脚本按实读判断，重复补只会报「已存在」。
 *
 * 封面图：`cover` 留空。往条目的文件夹里丢一张图，imggen 自己会认（`cover` 为空时取第一张）。
 * 要立刻有封面就生成两张，大约 0.24 元；不生成也能用——条目有描述，出图时当文字设定。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const WRITE = argv.includes('--write');
const ROOT = getArg('root', join(process.cwd(), 'imggen-library'));

const say = (line = '') => process.stdout.write(`${line}\n`);

/** 新条目的完整字段，跟库里现有条目**一模一样**（空值写 "" / {}，不写 null）。 */
function newEntry({ name, aliases, tags, desc }) {
  return {
    name,
    aliases,
    tags,
    desc,
    persona: '',
    expressions: '',
    defaultOutfit: '',
    outfitByContext: {},
    cover: '',
  };
}

/**
 * 要补的两条新场景。
 *
 * desc 只写**空间 + 陈设 + 配色 + 风格**，不写姿势表情——写了她会跟
 * imggen 的 pose / expression 打架（扩充方案 §7 实测）。
 */
const NEW_SCENES = [
  {
    dir: '游乐场',
    entry: newEntry({
      name: '游乐场',
      aliases: ['游乐园', '主题乐园', '过山车'],
      tags: ['游乐场', '摩天轮', '彩灯', '户外', '热闹'],
      desc: '游乐场：彩色铁架与彩旗在头顶交错，水泥地上画着褪色的排队线，远处过山车爬坡时链条咯咯响；摩天轮一圈一圈慢慢转，旋转木马亮着暖黄的灯泡；傍晚铁架上的彩灯沿着曲线一路铺到门口；整体是塑料感的鲜亮红黄蓝，加一点晚霞的橘。',
    }),
  },
  {
    dir: '漫展',
    entry: newEntry({
      name: '漫展',
      aliases: ['同人展', '展子', '逛展'],
      tags: ['漫展', '海报', '展台', '室内', '人多'],
      desc: '漫展：巨大的展馆里一排排白色隔板搭成摊位，顶部是冷白的工业照明，地面是灰色地胶；墙上贴满海报与色纸，通道里排着队伍；空气里有新印刷品的油墨味，远处舞台的音响隔着人群传过来；整体白底加大片高饱和的海报色。',
    }),
  },
];

/** 要补进现有条目的别名。 */
const ALIAS_PATCHES = [
  { dir: '神社', add: ['庙会', '夏日祭', '夏夜祭'], why: '庙会这一档借神社的场景（festival 情境本来就用神社）' },
  { dir: '水族馆', add: ['海洋馆', '看鱼'], why: '海洋馆这一档借水族馆的场景' },
];

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  say(`素材库根目录：${ROOT}`);
  say(`模式：${WRITE ? '真写' : '预演（加 --write 才落盘）'}`);
  say();

  const scenesDir = join(ROOT, 'scenes');
  const existing = await readJson(join(scenesDir, '书房', 'entry.json'));
  if (!existing) {
    say(`✗ 在 ${scenesDir} 下读不到任何场景条目——库路径不对？先确认目录里有 scenes/书房/entry.json。`);
    process.exitCode = 1;
    return;
  }
  say('✓ 库路径看起来是对的（读到了 scenes/书房/entry.json）');
  say();

  // ---- 1. 新建两个场景 ----
  for (const { dir, entry } of NEW_SCENES) {
    const target = join(scenesDir, dir);
    const file = join(target, 'entry.json');
    const current = await readJson(file);
    if (current) {
      say(`= scenes/${dir}/ 已存在（name=${current.name}），跳过，不覆盖`);
      continue;
    }
    say(`+ 新建 scenes/${dir}/entry.json（${entry.name}，别名 ${entry.aliases.join('/')}）`);
    if (WRITE) {
      await mkdir(target, { recursive: true });
      await writeFile(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
      say(`  已写入。cover 留空——丢一张图进这个文件夹就成了封面。`);
    }
  }
  say();

  // ---- 2. 补别名 ----
  for (const patch of ALIAS_PATCHES) {
    const file = join(scenesDir, patch.dir, 'entry.json');
    const current = await readJson(file);
    if (!current) {
      say(`! scenes/${patch.dir}/ 不存在，跳过（${patch.why}）`);
      continue;
    }
    const aliases = Array.isArray(current.aliases) ? [...current.aliases] : [];
    const missing = patch.add.filter((a) => !aliases.includes(a));
    if (!missing.length) {
      say(`= scenes/${patch.dir}/ 别名齐了（${aliases.join('/')}），跳过`);
      continue;
    }
    say(`~ scenes/${patch.dir}/ 别名补 ${missing.join('/')}（原有 ${aliases.join('/')}）`);
    if (WRITE) {
      current.aliases = [...aliases, ...missing];
      await writeFile(file, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
      say('  已写入。');
    }
  }
  say();

  if (!WRITE) {
    say('以上是预演。确认没问题后加 --write 再跑一遍。');
  } else {
    say('改完了。不用重启：feast 的素材库有 mtime 缓存，目录一变就会重扫。');
    say('封面要补的话：把图丢进 scenes/游乐场/ 和 scenes/漫展/，文件名随意，条目里 cover 留空就行。');
  }
}

main().catch((err) => {
  say(`✗ 出错：${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
