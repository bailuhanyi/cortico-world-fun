#!/usr/bin/env node
/**
 * 打包后验证：按 `files` 白名单**自己**组一个包目录，从安装形态真加载一次。
 *
 * 为什么非做不可：`npm pack --dry-run` 只列文件名，不证明包里的东西能跑。
 * 常见的翻车是「本机能跑、发出去不能跑」——
 *   - `files` 白名单漏了某个 `src/` 下的文件（import 直接失败）
 *   - `describe.json` 没进包（市场的卡片是空的）
 *   - `main` / `exports` 指向的文件不在包里
 *   - 依赖了本机有、包里没有的东西（`.tmp`、`test/`、`tools/`）
 *
 * 为什么不 spawn `npm pack`：受限沙箱里 spawn 子进程会 EPERM，而且 npm 在这台机器上
 * 是个 shim（不在 PATH 里）。所以这里**照 npm 的 files 规则自己复制**——
 * npm 的规则很简单：`files` 里的路径 + `package.json` / `README` / `LICENSE` 等总是包含的。
 *
 * 用法：node tools/verify-tarball.mjs [--keep]
 */
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadStandaloneWebUi } from './load-webui.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = process.argv.includes('--keep');

let failures = 0;
const ok = (cond, what, extra = '') => {
  if (cond) console.log(`  ok   ${what}`);
  else { failures += 1; console.log(`  FAIL ${what}${extra ? ` -> ${extra}` : ''}`); }
};

const work = await mkdtemp(join(tmpdir(), 'fun-tarball-'));
let totalBytes = 0;

try {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

  console.log('1) 按 files 白名单组包（复刻 npm 的规则）');
  const pkgDir = join(work, 'package');
  await mkdir(pkgDir, { recursive: true });

  // npm 的规则：files 列出的路径 + 总会被带上的几个文件。
  const include = [];
  for (const entry of pkg.files ?? []) {
    const full = join(ROOT, entry);
    if (!existsSync(full)) {
      failures += 1;
      console.log(`  FAIL files 里的 ${entry} 在仓库里不存在`);
      continue;
    }
    include.push(entry);
  }
  for (const always of ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE']) {
    if (existsSync(join(ROOT, always))) include.push(always);
  }

  for (const rel of include) {
    const src = join(ROOT, rel);
    const dst = join(pkgDir, rel);
    await cp(src, dst, { recursive: true });
  }

  const walk = async (dir) => {
    const out = [];
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) out.push(...await walk(full));
      else out.push(full);
    }
    return out;
  };
  const packed = await walk(pkgDir);
  for (const f of packed) totalBytes += (await stat(f)).size;
  console.log(`       ${packed.length} 个文件，解包 ${(totalBytes / 1024).toFixed(1)} KB`);
  for (const f of packed.map((x) => relative(pkgDir, x).replace(/\\/g, '/')).sort()) {
    console.log(`       - ${f}`);
  }

  console.log('2) 不该进包的一个都不能进');
  for (const unwanted of ['test', 'tools', 'install.ps1', 'fun', '.tmp']) {
    ok(!existsSync(join(pkgDir, unwanted)), `没有把 ${unwanted} 发出去`);
  }

  console.log('3) 包完整性：main / exports / cortico 指向的文件都在');
  const mustExist = [pkg.main, pkg.exports?.['.'], pkg.cortico?.icon, pkg.cortico?.describe]
    .filter((x) => typeof x === 'string');
  for (const rel of mustExist) ok(existsSync(join(pkgDir, rel)), `${rel} 在包里`);
  // 面板 bundle：声明了就必须进包，否则装到 Coo 里点进去是空白。
  if (pkg.cortico?.webUiClient) {
    const clientRel = pkg.cortico.webUiClient;
    ok(existsSync(join(pkgDir, clientRel)), `${clientRel} 在包里（面板能挂上）`);
    const clientSrc = await readFile(join(pkgDir, clientRel), 'utf8');
    ok(clientSrc.includes('panels:'), 'bundle 导出了 panels');
    const client = await loadStandaloneWebUi(join(pkgDir, clientRel));
    ok(Object.values(client.default?.panels ?? {}).every((panel) => typeof panel.mount === 'function'),
      '客户端可单文件加载，所有面板都有 mount');
  }

  console.log('4) 从安装形态真加载');
  const mod = await import(pathToFileURL(join(pkgDir, pkg.main)).href);
  const def = mod.default;
  ok(def?.id === 'fun', 'default export 有 id=fun');
  ok(typeof def.create === 'function', 'create 是函数');

  const dataDir = join(work, 'data');
  const world = def.create({ cfg: def.defaults(), dataDir, timezone: 'Asia/Shanghai', persist: () => {} });
  await world.start({ log: { info() {}, warn() {}, error() {} } });
  const tool = (n) => world.tools().find((t) => t.name === n).handler;
  // 不写死条数：0.1.6 加了 fun_shelf 之后，写死的 6 让验包一直红。
  // 真正要查的是「该有的工具都在、describe 和代码一致」。
  const MUST_HAVE = ['fun_go', 'fun_home', 'fun_places', 'fun_shelf', 'fun_start', 'fun_view', 'fun_wander'];
  const missing = MUST_HAVE.filter((n) => !world.tools().some((t) => t.name === n));
  ok(!missing.length, `工具都在${missing.length ? `（缺 ${missing.join(',')}）` : ''}`);
  const toolCount = world.tools().length;

  const go = await tool('fun_go')({ place: '海洋馆' });
  ok(/进了海洋馆/.test(go.text), '进门正常');
  const w1 = await tool('fun_wander')({ area: '海底隧道', buy: '鲸鱼挂件' });
  ok(/鲸鱼挂件/.test(w1.text), '逛 + 买正常');
  const home = await tool('fun_home')({});
  ok(/scene 填「水族馆」/.test(home.text), '收摊回执带 scene');
  ok(/feast_life_play/.test(home.text), '收摊回执指向 feast_life_play');
  const vars = world.envPromptVars();
  ok(vars.fun_places_block === '', 'envPromptVars 不常驻地点清单');
  const places = await tool('fun_places')({ all: true });
  ok(places.text.includes('游乐场') && places.text.includes('海洋馆'), '地点清单可按需查询');
  await world.stop();

  console.log('5) 包里的 describe.json 自洽');
  const onDisk = JSON.parse(await readFile(join(pkgDir, 'describe.json'), 'utf8'));
  ok(Array.isArray(onDisk.tools) && onDisk.tools.length === toolCount, `describe 里的工具数与代码一致（${onDisk.tools?.length} / ${toolCount}）`);
  ok(Array.isArray(onDisk.events) && onDisk.events.length === 1 && onDisk.events[0].type === 'fun.home.free',
    'describe 里只有「自己出门时段」那 1 个事件');
  ok(Array.isArray(onDisk.prompts) && onDisk.prompts.length === 1, 'describe 里有 1 份提示词');
  ok(onDisk.prompts[0].content.includes('feast_life_now'), '提示词内容是完整模板');
  ok(onDisk.prompts[0].content.includes('{{fun_places_block}}'), '模板里保留了占位符（由宿主替换）');

  console.log('6) 空目录里也能跑（证明不依赖 imggen-library 或仓库里的别的文件）');
  const lonely = await mkdtemp(join(tmpdir(), 'fun-lonely-'));
  const solo = def.create({ cfg: def.defaults(), dataDir: lonely, timezone: 'Asia/Shanghai', persist: () => {} });
  await solo.start({ log: { info() {}, warn() {} } });
  const soloGo = await solo.tools().find((t) => t.name === 'fun_go').handler({ place: '电影院' });
  ok(/进了电影院/.test(soloGo.text), '空目录里也能进门');
  const soloHome = await solo.tools().find((t) => t.name === 'fun_home').handler({});
  ok(/scene 不用填/.test(soloHome.text), '没有素材库时不提 scene');
  await solo.stop();
  await rm(lonely, { recursive: true, force: true });
} finally {
  if (!KEEP) await rm(work, { recursive: true, force: true });
  else console.log(`\n（保留在 ${work}）`);
}

console.log('');
if (failures) {
  console.log(`X ${failures} 项没过——这个包发出去会出问题`);
  process.exit(1);
}
console.log('打包验证全部通过：按 files 白名单组出来的包，从安装形态真跑通了一遍');
