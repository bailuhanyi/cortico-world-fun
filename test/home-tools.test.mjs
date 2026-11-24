import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS } from '../src/config.js';
import { funDefinition } from '../src/definition.js';
import { FunWorld } from '../src/world.js';
import { cleanup } from './tmp.mjs';

const TZ = 'Asia/Shanghai';
const NOW = Date.parse('2026-11-22T21:30:00+08:00');

async function mount(t) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-tools-'));
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true }, dataDir: dir, timezone: TZ, now: () => NOW, persist: () => {},
  });
  await world.start({ log: { info() {}, warn() {} } });
  cleanup(t, dir, world);
  const tool = (name) => world.tools().find((item) => item.name === name).handler;
  return { dir, world, tool, stateFile: join(dir, 'fun', 'state.json'), roomFile: join(dir, 'fun', 'home', 'room.json') };
}

test('工具声明：房间状态与更新合并为 fun_home_room，旧工具不再暴露', async () => {
  const names = funDefinition.describe.tools.map((tool) => tool.name);
  assert.ok(names.includes('fun_home_room'));
  assert.ok(!names.includes('fun_home_state'));
  assert.ok(!names.includes('fun_home_activity'));
  assert.equal(names.filter((name) => name === 'fun_home').length, 1, '回家的 fun_home 只能有一个');
  const decl = funDefinition.describe.tools.find((tool) => tool.name === 'fun_home_room');
  assert.deepEqual(Object.keys(decl.parameters.properties).sort(), ['activity', 'note', 'pose']);
  assert.equal(decl.parameters.additionalProperties, false);
  assert.equal(names.some((name) => /chat/i.test(name)), false, '没有聊天工具');
});

test('只读：fun_home_room 返回房间、待记一条与外出状态，且不写盘', async (t) => {
  const { tool, roomFile, stateFile } = await mount(t);
  const beforeRoom = await stat(roomFile).catch(() => null);
  const beforeState = await readFile(stateFile).catch(() => null);
  const result = await tool('fun_home_room')({});
  assert.match(result.text, /在家：刷视频/);
  assert.match(result.text, /现在在家，没有进行中的行程/);
  assert.match(result.text, /待记一条：11 月 22 日 21:30 · 在家刷视频/);
  assert.doesNotMatch(result.text, /data:image/);
  assert.equal(await stat(roomFile).catch(() => null), beforeRoom, '只读不建房间文件');
  assert.deepEqual(await readFile(stateFile).catch(() => null), beforeState);
});

test('写：fun_home_room 切活动并记备注，只改 room.json', async (t) => {
  const { tool, roomFile, stateFile } = await mount(t);
  const beforeState = await readFile(stateFile).catch(() => null);
  const result = await tool('fun_home_room')({ activity: 'reading', note: '在沙发上翻一本旧书' });
  assert.equal(result.failed, undefined, result.text);
  assert.match(result.text, /换成「读书」了/);
  assert.match(result.text, /11 月 22 日 21:30 · 在家读书 · 在沙发上翻一本旧书/);
  const stored = JSON.parse(await readFile(roomFile, 'utf8'));
  assert.equal(stored.room.activity, 'reading');
  assert.equal(stored.room.note, '在沙发上翻一本旧书');
  assert.deepEqual(await readFile(stateFile).catch(() => null), beforeState, '不写 state.json');
});

test('坏活动拒绝且不落盘；省略更新字段时只读', async (t) => {
  const { tool, roomFile } = await mount(t);
  const bad = await tool('fun_home_room')({ activity: 'flying' });
  assert.equal(bad.failed, true);
  assert.match(bad.text, /十个固定 id/);
  const read = await tool('fun_home_room')({});
  assert.match(read.text, /在家：刷视频/);
  await assert.rejects(readFile(roomFile), { code: 'ENOENT' }, '无效输入与只读调用都不建房间文件');
});

test('在外面：待记一条写地点和进度；没有备注就不多最后一段', async (t) => {
  const { tool } = await mount(t);
  const go = await tool('fun_go')({ place: '海洋馆' });
  assert.equal(go.failed, undefined, go.text);
  const state = await tool('fun_home_room')({});
  assert.match(state.text, /现在在外面：海洋馆/);
  assert.match(state.text, /待记一条：11 月 22 日 21:30 · 在海洋馆（逛了 0\/6）/);
  assert.doesNotMatch(state.text, /在家刷视频/);
});
