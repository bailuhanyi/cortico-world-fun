#!/usr/bin/env node
/**
 * 发版前自查 —— 按 Coo 扩展市场的收录口径逐条核对。
 *
 * 口径来自 `feed-world/PUBLISHING.md`（那边已发过 13 个版本）：
 * 市场 Action 每 30 分钟搜一次 npm 上带 `cortico-world` 关键字的包，
 * 解包读 `cortico` 块、`describe.json`、`CHANGELOG.md`、图标，写进索引仓。
 *
 * 所以这里查的就是「解包之后市场会看到什么」，以及会不会被拒：
 *   - `cortico.kind/id/api/displayName` 齐全，api 是 6
 *   - `keywords` 里有 `cortico-world`（没有就搜不到）
 *   - `cortico.describe` 指向的文件真的存在，且内容能解析、工具数对得上
 *   - `CHANGELOG.md` 有当前版本的 `## x.y.z` 段（缺了市场「历史版本」是空的）
 *   - 图标路径在 `assets/` 下、≤512KB、真的是 PNG
 *   - `files` 白名单真的把上面这些东西包进去了（漏了等于白做）
 *   - 标签都在市场词表里（写了词表外的等于没写）
 *   - `repository` 在**顶层**而不是 `cortico` 块里（Action 从顶层读）
 *   - `--online` 额外查 npm 包名占用
 *
 * 用法：node tools/publish-check.mjs [--online]
 * 退出码 0 = 可以发；1 = 有硬问题（市场会缺块或被拒）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDescribe, DESCRIBE_PATH, ROOT_DIR } from './make-describe.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ONLINE = process.argv.includes('--online');

const rows = [];
const pass = (what, note = '') => rows.push(['ok', what, note]);
const warn = (what, note = '') => rows.push(['warn', what, note]);
const fail = (what, note = '') => rows.push(['fail', what, note]);

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const cortico = pkg.cortico ?? {};

// ---- 1. 基本元数据 ----
if (pkg.name === 'cortico-world-fun') pass('包名', pkg.name);
else fail('包名', `应为 cortico-world-fun，实际 ${pkg.name}`);

if (/^\d+\.\d+\.\d+$/.test(pkg.version ?? '')) pass('版本号', pkg.version);
else fail('版本号', `不是 x.y.z：${pkg.version}`);

if (cortico.kind === 'world') pass('cortico.kind', 'world');
else fail('cortico.kind', `应为 world，实际 ${cortico.kind}`);

if (cortico.api === 6) pass('cortico.api', '6（当前 world 契约版本）');
else fail('cortico.api', `应为 6，实际 ${cortico.api}——版本不符装不上`);

if (cortico.displayName) pass('cortico.displayName', cortico.displayName);
else fail('cortico.displayName', '缺了市场卡片没标题');

if (cortico.locales?.zh?.displayName && cortico.locales?.zh?.description) pass('中文本地化', cortico.locales.zh.displayName);
else fail('中文本地化', 'market 详情页中文会缺');
if (cortico.locales?.en?.displayName) pass('英文本地化', cortico.locales.en.displayName);
else warn('英文本地化', '只有中文也能上，但英文界面会显示中文');

// ---- 2. 关键字：没有 cortico-world 市场就搜不到 ----
const kw = Array.isArray(pkg.keywords) ? pkg.keywords : [];
if (kw.includes('cortico-world')) pass('keywords 含 cortico-world', '市场靠它搜到');
else fail('keywords 含 cortico-world', '缺了市场搜不到这个包');

// ---- 3. 顶层 repository（Action 从顶层读，不读 cortico 块）----
if (pkg.repository?.url) pass('repository（顶层）', pkg.repository.url);
else fail('repository（顶层）', '详情页「源代码仓库」会空，认证也要求仓库在你自己名下');
if (cortico.repository) fail('repository 写进了 cortico 块', 'Action 不读那里，挪到顶层');
if (pkg.homepage) pass('homepage', pkg.homepage); else warn('homepage', '详情页「项目主页」会空');
if (pkg.bugs?.url) pass('bugs', pkg.bugs.url); else warn('bugs', '详情页「问题反馈」会空');

// ---- 4. describe.json：市场展示的就是这一份 ----
if (cortico.describe === 'describe.json') pass('cortico.describe', 'describe.json');
else fail('cortico.describe', `应指向 describe.json，实际 ${cortico.describe}`);

if (!existsSync(DESCRIBE_PATH)) {
  fail('describe.json 存在', '没生成；市场卡片的能力摘要会是空的');
} else {
  const { file, missing } = await buildDescribe();
  const onDisk = JSON.parse(readFileSync(DESCRIBE_PATH, 'utf8'));
  const same = JSON.stringify(onDisk) === JSON.stringify(file);
  if (same) pass('describe.json 与代码一致', `${onDisk.tools.length} 个工具、${onDisk.events.length} 个事件`);
  else fail('describe.json 与代码一致', '过期了，重跑 node tools/make-describe.mjs');

  if (!missing.length) pass('工具声明齐全', '实例给的工具都在 describe 里');
  else fail('工具声明齐全', `漏了：${missing.join(', ')}`);

  // 详情页「环境提示词」栏：prompts 空着那一栏就是空的
  if (Array.isArray(onDisk.prompts) && onDisk.prompts.length) {
    pass('describe.json 带提示词', `${onDisk.prompts.length} 份，详情页「环境提示词」有内容`);
  } else {
    fail('describe.json 带提示词', 'prompts 空了，详情页那一栏会空着');
  }
}

// ---- 5. CHANGELOG：缺当前版本段，「历史版本」是空的 ----
const changelog = existsSync(join(ROOT, 'CHANGELOG.md')) ? readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8') : '';
if (!changelog) {
  fail('CHANGELOG.md', '没有这个文件，市场「历史版本」空着');
} else if (new RegExp(`^##\\s+${pkg.version.replace(/\./g, '\\.')}\\s*$`, 'm').test(changelog)) {
  pass('CHANGELOG.md 有当前版本段', `## ${pkg.version}`);
} else {
  fail('CHANGELOG.md 有当前版本段', `缺 ## ${pkg.version}`);
}

// ---- 6. 图标：assets/ 下、真 PNG、≤512KB ----
const iconRel = cortico.icon ?? '';
if (!iconRel) {
  fail('cortico.icon', '没声明图标，市场卡片没图');
} else {
  const iconPath = join(ROOT, iconRel);
  if (!iconRel.startsWith('assets/')) fail('图标在 assets/ 下', `实际 ${iconRel}`);
  else if (!existsSync(iconPath)) fail('图标文件存在', iconRel);
  else {
    const buf = readFileSync(iconPath);
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const kb = statSync(iconPath).size / 1024;
    if (!isPng) fail('图标是 PNG', `${iconRel} 文件头不是 PNG`);
    else if (kb > 512) fail('图标 ≤512KB', `${kb.toFixed(1)}KB`);
    else pass('图标', `${iconRel} ${kb.toFixed(1)}KB PNG`);
  }
}

// ---- 7. files 白名单：漏了等于白做 ----
const files = Array.isArray(pkg.files) ? pkg.files : [];
for (const need of ['src', 'assets', 'describe.json', 'CHANGELOG.md', 'README.md']) {
  if (files.includes(need)) pass(`files 含 ${need}`);
  else fail(`files 含 ${need}`, '没白名单的话包里没有它');
}
// 面板 bundle：声明了 webUiClient 就必须真的进包，否则装到 Coo 里点进去是空白。
if (cortico.webUiClient) {
  if (files.includes('dist')) pass('files 含 dist', '面板 bundle 要跟着发出去');
  else fail('files 含 dist', `声明了 webUiClient=${cortico.webUiClient} 却没把 dist 打进包`);
  const clientPath = join(ROOT, cortico.webUiClient);
  if (existsSync(clientPath)) pass('webUiClient 文件存在', cortico.webUiClient);
  else fail('webUiClient 文件存在', `${cortico.webUiClient} 不在仓库里`);
}
// 不该进包的：测试、工具脚本、装机脚本（这些是我们的工具，不是用户要的）
for (const unwanted of ['test', 'tools', 'install.ps1']) {
  if (files.includes(unwanted)) warn(`files 含 ${unwanted}`, '这是开发用的，通常不该发出去');
}

// ---- 8. 标签词表 ----
const KNOWN_TAGS = new Set([
  'companion', 'internal-state', 'experimental', 'high-cost', 'requires-key',
  'external-setup', 'unofficial-api', 'injection-risk', 'im', 'qq', 'internet',
  'creative', 'local',
]);
const tags = Array.isArray(cortico.tags) ? cortico.tags : [];
for (const t of tags) {
  if (KNOWN_TAGS.has(t)) pass(`标签 ${t}`, '在词表内');
  else fail(`标签 ${t}`, '不在市场词表里，写了等于没写');
}
if (tags.includes('local')) warn('标签 local', 'local 指「本机跑模型要算力」，本插件不跑推理——建议删');

// ---- 9. 提示词与事件的自洽 ----
if (Array.isArray(cortico.screenshots)) pass('screenshots', `${cortico.screenshots.length} 张`);
else warn('screenshots', '详情页只有图标和文字；截图要自己截（见 PUBLISHING.md）');

// ---- 10. --online：包名占用 ----
if (ONLINE) {
  try {
    execFileSync('npm', ['view', pkg.name, 'version'], { stdio: 'pipe', timeout: 30000 });
    warn('包名占用', `${pkg.name} 在 npm 上已存在——这是发新版本，不是首发`);
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (/E404|404 Not Found/.test(out)) pass('包名可用', `${pkg.name} 在 npm 上还没有，可以首发`);
    else warn('包名占用查询', `查不到结果（可能没网或没登录）：${out.split('\n')[0]}`);
  }
}

// ---- 输出 ----
let fails = 0;
let warns = 0;
for (const [level, what, note] of rows) {
  const mark = level === 'ok' ? 'ok  ' : (level === 'warn' ? 'WARN' : 'FAIL');
  if (level === 'fail') fails += 1;
  if (level === 'warn') warns += 1;
  console.log(`${mark} ${what}${note ? ` — ${note}` : ''}`);
}
console.log('');
console.log(`${rows.length - fails - warns} 项通过、${fails} 失败、${warns} 警告`);
if (fails) {
  console.log(`\n有 ${fails} 项硬问题，现在发出去市场会缺块或被拒。`);
  process.exitCode = 1;
} else {
  console.log('\n可以发。');
}
