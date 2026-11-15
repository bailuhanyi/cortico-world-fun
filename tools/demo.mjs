#!/usr/bin/env node
/**
 * 把一趟完整的出游「按她真实的视角」打出来看一眼。
 *
 * 单测断言的是结构；这个脚本断言的是**读起来对不对**——
 * 回执是不是人话、有没有系统腔、该递到她嘴边的话在不在。
 *
 * 用法：node tools/demo.mjs [漫展|海洋馆|庙会|游乐场]
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULTS } from '../src/config.js';
import { FunWorld } from '../src/world.js';

const TZ = 'Asia/Shanghai';
const place = process.argv[2] || '漫展';
const dir = await mkdtemp(join(tmpdir(), 'fun-demo-'));
let now = Date.parse('2026-11-15T14:00:00+08:00');

const world = new FunWorld({
  cfg: { ...DEFAULTS, enabled: true },
  dataDir: dir,
  timezone: TZ,
  now: () => now,
  random: () => 0.42,
});
await world.start({ log: { info() {}, warn() {} } });
const tool = (n) => world.tools().find((t) => t.name === n).handler;

const show = (title, res) => {
  console.log(`\n${'─'.repeat(64)}\n【${title}】\n${'─'.repeat(64)}`);
  console.log(res.text);
};

console.log(`\n=== 她这一趟：${place}（时分 14:00 起）===`);

show('fun_places（先看看今天能去哪）', await tool('fun_places')({}));
show(`fun_go { place: "${place}" }`, await tool('fun_go')({ place }));

now += 12 * 60000;
show('fun_wander（第一处）', await tool('fun_wander')({}));
now += 8 * 60000;
show('fun_wander（买点东西 + 拍张照）', await tool('fun_wander')({ buy: '吧唧', photo: '海报墙前' }));
now += 15 * 60000;
show('fun_wander（再逛一处，记一句）', await tool('fun_wander')({ note: '排本子排到腿酸' }));

now += 25 * 60000;
show('fun_home（收摊）', await tool('fun_home')({ note: '腿有点酸，但值' }));

now += 5 * 60000;
show('fun_view（纪念册）', await tool('fun_view')({}));

console.log('\n=== 系统提示词里注入的那段（envPromptVars） ===\n');
console.log(world.envPromptVars().fun_places_block);

await world.stop();
await rm(dir, { recursive: true, force: true });
