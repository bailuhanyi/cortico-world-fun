#!/usr/bin/env node
/**
 * 验证「npm 上那个包」里真有什么 —— 下载 tarball、解包、从安装形态加载。
 *
 * 为什么不能只信 registry 的元数据：`cortico.webUiClient` 字段写得再对，
 * 包里没有 `dist/webui.js` 的话，装到 Coo 里点面板就是**一片空白**。
 * 元数据只能证明「声明了」，解包才能证明「东西在」。
 *
 * 用法：node tools/verify-published.mjs [版本号]
 *       node tools/verify-published.mjs --file <本地 tgz>
 *   默认查 package.json 里当前的 version。
 *
 * 只读：下载到系统临时目录，验完删掉。不污染仓库。
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 在 Node 里解 tar（不 spawn `tar`：受限沙箱里子进程会 EPERM）。
 *
 * 只认 npm 包用的那种最普通的 ustar/GNU tar：每个条目 512 字节头 + 内容 + 补零，
 * 名字在偏移 0 的 100 字节里，类型在 156。够用，也不需要引依赖。
 */
function untar(buf, destDir) {
  const out = [];
  let off = 0;
  const readStr = (b, start, len) => {
    const slice = b.subarray(start, start + len);
    const nul = slice.indexOf(0);
    return slice.subarray(0, nul < 0 ? slice.length : nul).toString('utf8');
  };
  while (off + 512 <= buf.length) {
    const name = readStr(buf, off, 100);
    if (!name) { off += 512; continue; }          // 块尾的全零
    const sizeStr = readStr(buf, off + 124, 12).trim();
    const size = parseInt(sizeStr, 8) || 0;
    const type = String.fromCharCode(buf[off + 156] || 0x30);
    const dataStart = off + 512;
    const rel = name.replace(/^package\//, '').replace(/\/$/, '');
    if (rel && (isAbsolute(rel) || rel.includes('\\') || rel.split('/').includes('..') || !name.startsWith('package/'))) throw new Error('非法 tar 条目：' + name);
    if (dataStart + size > buf.length || !Number.isSafeInteger(size) || size < 0) throw new Error('截断或非法 tar 条目');
    if (type === '0' || type === '\0' || type === '0' || type === '') {
      if (rel) {
        const target = join(destDir, rel);
        out.push({ rel, mkdir: false, data: buf.subarray(dataStart, dataStart + size) });
      }
    } else if (type === '5') {
      if (rel) out.push({ rel, mkdir: true });
    }
    off = dataStart + Math.ceil(size / 512) * 512;
  }
  return out;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const localIndex = process.argv.indexOf('--file');
const localFile = localIndex >= 0 ? process.argv[localIndex + 1] : null;
if (localIndex >= 0 && !localFile) throw new Error('--file 需要压缩包路径');
const version = localFile ? pkg.version : (process.argv[2] || pkg.version);
const sourceLabel = localFile ? '本地压缩包' : 'npm 上的包';
const NAME = pkg.name;

let failures = 0;
const ok = (cond, what, extra = '') => {
  if (cond) console.log(`  ok   ${what}`);
  else { failures += 1; console.log(`  FAIL ${what}${extra ? ` -> ${extra}` : ''}`); }
};

function checkNames(entries, key, label) {
  const names = Array.isArray(entries) ? entries.map((entry) => entry?.[key]) : [];
  const valid = names.length > 0 && names.every((name) => typeof name === 'string' && name.trim().length > 0);
  const unique = new Set(names).size === names.length;
  ok(valid && unique, `${label}非空且不重复`, JSON.stringify(names));
  return valid && unique ? names.sort() : null;
}

function sameNames(left, right) {
  return left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right);
}

const tarballUrl = `https://registry.npmjs.org/${NAME}/-/${NAME}-${version}.tgz`;
console.log(`验证 ${sourceLabel} ${NAME}@${version}`);
console.log(`  ${localFile ? resolve(localFile) : tarballUrl}`);
console.log('');

const work = await mkdtemp(join(tmpdir(), 'fun-published-'));

try {
  console.log(localFile ? '1) 读取本地实际压缩包' : '1) 下载');
  let buf;
  if (localFile) buf = await readFile(resolve(localFile));
  else {
    const res = await fetch(tarballUrl);
    if (!res.ok) throw new Error('下载失败：HTTP ' + res.status);
    buf = Buffer.from(await res.arrayBuffer());
  }
  await writeFile(join(work, 'pkg.tgz'), buf);
  ok(true, `${localFile ? '读取' : '下载'}成功（${(buf.length / 1024).toFixed(1)} KB）`);

  console.log('2) 解包');
  const pkgDir = join(work, 'package');
  await mkdir(pkgDir, { recursive: true });
  const entries = untar(gunzipSync(buf), pkgDir);
  for (const e of entries) {
    const target = join(pkgDir, e.rel);
    if (e.mkdir) await mkdir(target, { recursive: true });
    else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, e.data);
    }
  }
  ok(entries.length > 0, `解出 ${entries.length} 个条目`);

  const files = await readdir(pkgDir);
  const published = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
  ok(published.version === version, `包里的 version 是 ${version}`);

  console.log('3) 作者与元数据');
  const authorName = typeof published.author === 'string' ? published.author : published.author?.name;
  ok(authorName === '青', `作者是「青」（实际 ${JSON.stringify(published.author)}）`);
  ok(published.cortico?.displayName === '娱乐时间', 'displayName 是娱乐时间');
  ok(published.cortico?.api === 6, 'api 是 6');
  ok(files.includes('describe.json'), 'describe.json 在包里（市场读它）');
  ok(files.includes('CHANGELOG.md'), 'CHANGELOG.md 在包里');

  console.log('4) 面板真的在包里（不是只有声明）');
  const clientRel = published.cortico?.webUiClient;
  ok(Boolean(clientRel), `cortico.webUiClient 有值（${clientRel}）`);
  if (clientRel) {
    const clientPath = join(pkgDir, clientRel);
    ok(existsSync(clientPath), `${clientRel} 文件真的在`);
    if (existsSync(clientPath)) {
      const src = await readFile(clientPath, 'utf8');
      ok(src.includes('panels:'), 'bundle 导出了 panels');
      ok(src.includes('mount'), 'bundle 有 mount');
      const kb = (await import('node:fs')).statSync(clientPath).size / 1024;
      console.log(`       ${clientRel} ${kb.toFixed(1)} KB`);
    }
  }

  console.log('5) 不该进包的一个都不能进');
  for (const unwanted of ['test', 'tools', 'install.ps1', 'fun']) {
    ok(!files.includes(unwanted), `没有把 ${unwanted} 发出去`);
  }

  console.log('6) 从安装形态真加载并跑一趟');
  const mod = await import(pathToFileURL(join(pkgDir, published.main)).href);
  const def = mod.default;
  ok(def?.id === 'fun', 'default export 有 id=fun');
  const dataDir = join(work, 'data');
  const world = def.create({ cfg: def.defaults(), dataDir, timezone: 'Asia/Shanghai', persist: () => {} });
  await world.start({ log: { info() {}, warn() {}, error() {} } });
  const marketDescribe = JSON.parse(await readFile(join(pkgDir, 'describe.json'), 'utf8'));
  const tools = world.tools();
  const marketNames = checkNames(marketDescribe.tools, 'name', 'describe.json 工具名称');
  const definitionNames = checkNames(def.describe?.tools, 'name', 'WorldDefinition 工具名称');
  const runtimeNames = checkNames(tools, 'name', '运行时工具名称');
  ok(sameNames(marketNames, definitionNames), 'describe.json 与 WorldDefinition 工具名称一致',
    `describe.json=${JSON.stringify(marketNames)}，WorldDefinition=${JSON.stringify(definitionNames)}`);
  ok(sameNames(definitionNames, runtimeNames), 'WorldDefinition 与运行时工具名称一致',
    `WorldDefinition=${JSON.stringify(definitionNames)}，运行时=${JSON.stringify(runtimeNames)}`);

  const tool = (name) => {
    const handler = tools.find((entry) => entry.name === name)?.handler;
    if (typeof handler !== 'function') throw new Error(`工具 ${name} 缺少 handler`);
    return handler;
  };
  const go = await tool('fun_go')({ place: '海洋馆' });
  ok(!go.failed && /进了海洋馆/.test(go.text), '进门正常', go.text);
  const wander = await tool('fun_wander')({ area: '海底隧道', buy: '鲸鱼挂件' });
  ok(!wander.failed, '游逛工具执行成功', wander.text);
  // 待选择事件只拦下一次游逛，仍可直接收摊。
  const home = await tool('fun_home')({});
  ok(!home.failed && /scene 填「水族馆」/.test(home.text), '收摊回执带 scene', home.text);

  console.log('7) 面板数据面能跑（服务端那半边）');
  const ui = world.webUi('zh');
  const declared = checkNames(ui.panels, 'id', '服务端面板 ID');
  const lists = new Map();
  for (const id of declared ?? []) {
    const { getMethods } = ui.panels.find((panel) => panel.id === id);
    const hasList = Array.isArray(getMethods) && getMethods.includes('list');
    ok(hasList, `${id} 在 getMethods 中声明 list`);
    if (!hasList) continue;
    try {
      const result = await ui.invoke(id, 'list', []);
      ok(result?.ok === true, `${id} 面板取数成功`, result?.error);
      lists.set(id, result);
    } catch (error) {
      ok(false, `${id} 面板取数成功`, error?.message ?? String(error));
    }
  }
  const places = lists.get('places');
  // 绑包里那份预设库，别写死数字：0.1.4 从 12 处加到 20 处时，写死的 12 让验包一直红。
  // dataDir 是临时空目录，纯预设、没有用户自填，total 应当正好等于预设数。
  const presetCount = Array.isArray(mod.VENUES) ? mod.VENUES.length : null;
  ok(presetCount !== null, '包里导出了 VENUES（能拿到预设场所数）');
  ok(presetCount !== null && places?.total === presetCount,
    `${presetCount ?? '?'} 处预设场所（实际 ${places?.total}）`);
  const book = lists.get('book');
  ok(book?.total === 1, `纪念册里有一趟（实际 ${book?.total}）`);
  ok(book?.trips?.[0]?.visited?.includes('海底隧道'), '纪念册记下游逛项目');
  ok(book?.trips?.[0]?.souvenirs?.includes('鲸鱼挂件'), '纪念册记下所买纪念品');
  await world.stop();

  console.log('8) 面板 bundle 能对上线上的服务端');
  if (clientRel && existsSync(join(pkgDir, clientRel))) {
    const bundle = await import(pathToFileURL(join(pkgDir, clientRel)).href);
    const panels = bundle.default?.panels;
    const exported = panels && typeof panels === 'object' && !Array.isArray(panels)
      ? Object.keys(panels).sort()
      : null;
    ok(sameNames(exported, declared), '客户端导出与服务端声明的面板 ID 一致',
      `客户端=${JSON.stringify(exported)}，服务端=${JSON.stringify(declared)}`);
    for (const id of declared ?? []) {
      ok(typeof panels?.[id]?.mount === 'function', `${id} 有 mount`);
    }
  }
} catch (err) {
  if (failures === 0) {
    failures += 1;
    console.log(`  FAIL ${err?.message ?? err}`);
  }
} finally {
  await rm(work, { recursive: true, force: true });
}

console.log('');
if (failures) {
  console.log(`X ${failures} 项没过`);
  process.exit(1);
}
console.log(`${sourceLabel} ${NAME}@${version} 验证通过：面板真在包里，从安装形态跑通了`);
