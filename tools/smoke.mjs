#!/usr/bin/env node
/**
 * dry-mount 冒烟：按宿主的调用顺序，把扩展**真加载一遍**，看契约有没有踩线。
 *
 * 宿主加载一个 World 大致是：
 *   1. `import(包入口)` 拿 default export（必须是 WorldDefinition）
 *   2. 读 `id` / `label` / `defaults()` / `preflight()`
 *   3. `create(ctx)` 拿实例（**必须纯**：不读盘、不建目录、不起定时器）
 *   4. `start(host)` 之后才 `tools()` / `envPromptVars()` / `webUi()`
 *   5. 停的时候 `stop()`
 *
 * 这里把这套顺序跑一遍，重点验：
 *   - default export 的形状对不对（认证会查）
 *   - `create()` 纯不纯（目录里不能多出东西）
 *   - `envPromptVars()` 在我们的模板文件在/不在两种情况下都不抛错
 *   - 六个工具拿得到、`fun_go` 能进门
 *   - `webUi()` 的 config 路径都在 `worlds.fun.` 段里
 *
 * 不用 `node --test`，直接 `node tools/smoke.mjs`，退出码 0 = 全过。
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import definition, { funDefinition, FUN_TOOL_DECLS, FunWorld, VENUES } from '../src/index.js';
import { DEFAULTS } from '../src/config.js';
import { hasScene } from '../src/venues.js';

const TZ = 'Asia/Shanghai';
let failures = 0;
const ok = (cond, what, extra = '') => {
  if (cond) {
    console.log(`  ok   ${what}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${what}${extra ? ` → ${extra}` : ''}`);
  }
};

console.log('1) 入口形状');
ok(definition === funDefinition, 'default export 就是 funDefinition');
ok(funDefinition.id === 'fun', 'id 是 fun');
ok(funDefinition.label === '娱乐时间', 'label 是 娱乐时间');
ok(typeof funDefinition.defaults === 'function', 'defaults 是函数');
ok(typeof funDefinition.preflight === 'function', 'preflight 是函数');
ok(typeof funDefinition.create === 'function', 'create 是函数');
ok(Array.isArray(funDefinition.describe?.tools), 'describe.tools 是数组');
ok(Array.isArray(funDefinition.describe?.events) && funDefinition.describe.events.length === 0, 'describe.events 为空（不推事件）');

console.log('2) defaults / preflight');
const d = funDefinition.defaults();
ok(typeof d === 'object' && d !== null, 'defaults() 返回对象');
ok(d.enabled === false, 'defaults().enabled 恒为 false（启用由部署决定）');
// 数量绑到 DEFAULTS / configGroup 本身：加配置项时这条不该红，
// 红的是「某个配置项没出现在面板上」那种真问题。
ok(Object.keys(d).length === Object.keys(DEFAULTS).length,
  `defaults 与 DEFAULTS 键数一致（实际 ${Object.keys(d).length}）`);
funDefinition.preflight({ cfg: {} });
ok(true, 'preflight 不抛');
const d2 = funDefinition.defaults();
ok(typeof d.enabled === 'boolean' && typeof Object.isFrozen === 'function' && d !== d2, 'defaults() 每次给新对象（不改共享 DEFAULTS）');

console.log('3) create() 必须是纯的');
const pureDir = await mkdtemp(join(tmpdir(), 'fun-smoke-pure-'));
const ctx = { cfg: {}, dataDir: pureDir, timezone: TZ, persist: () => { throw new Error('create 期间不该 persist'); } };
const ghost = funDefinition.create(ctx);
ok(ghost instanceof FunWorld, 'create 返回 FunWorld 实例');
ok((await readdir(pureDir)).length === 0, 'create 之后目录还是空的（不建目录）');
await rm(pureDir, { recursive: true, force: true });

console.log('4) start / tools / envPromptVars / webUi');
const dir = await mkdtemp(join(tmpdir(), 'fun-smoke-'));
const logged = [];
const host = { log: { info: (m, meta) => logged.push([m, meta]), warn: (m) => logged.push([`WARN ${m}`]), error() {} } };
const world = new FunWorld({ cfg: { enabled: true }, dataDir: dir, timezone: TZ, persist: () => {} });
await world.start(host);
ok(logged.some(([m]) => /娱乐时间已启动/.test(m)), 'start 打了启动日志');

const names = world.tools().map((t) => t.name).sort();
// 七个工具：0.1.6 加了 fun_shelf（纪念品架）。
// 这里不写死条数，只钉住「该有的都有」——加工具时不该因为数字变了就红。
const MUST_HAVE = ['fun_go', 'fun_home', 'fun_places', 'fun_shelf', 'fun_start', 'fun_view', 'fun_wander'];
const missing = MUST_HAVE.filter((n) => !names.includes(n));
ok(!missing.length, `工具都在：${names.join(',')}${missing.length ? `（缺 ${missing.join(',')}）` : ''}`);
ok(FUN_TOOL_DECLS.length === names.length, `FUN_TOOL_DECLS 与 tools() 条数一致（${names.length} 条）`);
for (const t of world.tools()) {
  ok(typeof t.handler === 'function', `${t.name} 有 handler`);
  ok(typeof t.description === 'string' && t.description.length > 10, `${t.name} 有描述`);
  ok(t.parameters?.type === 'object', `${t.name} 有 parameters`);
}

// envPromptVars 两次调用都不抛，且把全部预设场所都带上了
let vars;
try {
  vars = world.envPromptVars();
  ok(true, 'envPromptVars() 不抛');
} catch (err) {
  ok(false, 'envPromptVars() 不抛', err.message);
  vars = {};
}
ok(typeof vars.fun_places_block === 'string', 'fun_places_block 是字符串');
for (const v of VENUES) ok(vars.fun_places_block.includes(v.name), `场所清单里有 ${v.name}`);
// 只有素材库里确实有场景的那几处才该点名 scene；其余一处都不能出现，否则等于教她编名字。
for (const v of VENUES.filter(hasScene)) {
  ok(vars.fun_places_block.includes(`scene 填「${v.scene}」`), `清单里点名了 ${v.name} 的 scene「${v.scene}」`);
}
for (const v of VENUES.filter((x) => !hasScene(x))) {
  ok(!vars.fun_places_block.includes(`scene 填「${v.name}」`), `${v.name} 没有场景，清单里不该点名 scene`);
}

// 关掉 funOn：不注入
const offWorld = new FunWorld({ cfg: { enabled: true, funOn: false }, dataDir: dir, timezone: TZ });
await offWorld.start(host);
ok(offWorld.envPromptVars().fun_places_block === '', 'funOn 关掉后不注入场所清单');
await offWorld.stop();

const ui = world.webUi('zh');
ok(ui.label === '娱乐时间', 'webUi label');
ok(Array.isArray(ui.lamps) && ui.lamps.length === 1, 'webUi 有一盏灯');
ok(Array.isArray(ui.config) && ui.config.length === 1, 'webUi 一组配置');
ok(ui.promptDocs?.[0]?.key === 'worlds.fun.env', 'webUi 的 promptDocs key 是 worlds.fun.env');
const cfgPaths = Object.keys(ui.config[0].schema.properties);
ok(cfgPaths.every((p) => p.startsWith('worlds.fun.')), `配置路径都在 worlds.fun. 段：${cfgPaths.join(',')}`);
ok(cfgPaths.length === Object.keys(DEFAULTS).length - 1,
  `面板配置项数量 = DEFAULTS 去掉 enabled（实际 ${cfgPaths.length}）`);
for (const key of Object.keys(DEFAULTS)) {
  if (key === 'enabled') continue;
  ok(cfgPaths.includes(`worlds.fun.${key}`), `面板上声明了 ${key}`);
}

console.log('5) 真跑一趟');
const tool = (n) => world.tools().find((t) => t.name === n).handler;
const places = await tool('fun_places')({});
ok(/能去逛的/.test(places.text), 'fun_places 有正文');
const go = await tool('fun_go')({ place: '海洋馆' });
ok(/进了海洋馆/.test(go.text), 'fun_go 进门');
const wander = await tool('fun_wander')({ buy: '鲸鱼挂件', photo: '海底隧道正中间' });
ok(/海洋馆 · /.test(wander.text), 'fun_wander 逛了一处');
const home = await tool('fun_home')({});
ok(/收摊：这一趟在海洋馆/.test(home.text), 'fun_home 收摊');
ok(/scene 填「水族馆」/.test(home.text), '收摊回执里的 scene 是水族馆');
ok(/feast_life_play/.test(home.text), '收摊回执指向 feast_life_play');
const view = await tool('fun_view')({});
ok(/海洋馆/.test(view.text), '纪念册记得住');
const start = await tool('fun_start')({});
ok(/fun_go 进门/.test(start.text), 'fun_start 给出走法');

console.log('6) 坏输入不炸');
const bad1 = await tool('fun_go')({ place: '火星' });
ok(bad1.failed === true && /没听说过/.test(bad1.text), '报不存在的地方：failed 但不抛');
const bad2 = await tool('fun_wander')({ area: { evil: true } });
ok(typeof bad2.text === 'string', 'object 当 area：给字符串回执');
const bad3 = await tool('fun_places')({ count: 'abc' });
ok(typeof bad3.text === 'string' && !bad3.failed, 'count 坏值回落默认');

console.log('7) stop');
await world.stop();
const r = await tool('fun_places')({});
ok(r.failed === true && /失败/.test(r.text), '停之后再调工具：failed 回执，不抛');
ok(logged.every(([m]) => typeof m === 'string'), '输出是字符串');

await rm(dir, { recursive: true, force: true });

console.log('');
if (failures) {
  console.log(`X ${failures} 项没过`);
  process.exit(1);
}
console.log('全部通过');
