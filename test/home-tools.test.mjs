/**
 * M3「工具与待记一条」验收：fun_home_state（只读）与 fun_home_activity（写）。
 *
 * 两条边界：
 *   · 只读工具一个字都不写盘，也不返回图片字节；
 *   · 写工具只改 `fun/home/room.json`，不写生活记录、不推进 `state.json`；
 *     revision 冲突给可读原因，不自动重试。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS } from '../src/config.js';
import { funDefinition } from '../src/definition.js';
import { FunWorld } from '../src/world.js';

const TZ = 'Asia/Shanghai';
const NOW = Date.parse('2026-11-22T21:30:00+08:00');

async function mount(t) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-tools-'));
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true }, dataDir: dir, timezone: TZ, now: () => NOW, persist: () => {},
  });
  await world.start({ log: { info() {}, warn() {} } });
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
  const tool = (name) => world.tools().find((item) => item.name === name).handler;
  return { dir, world, tool, stateFile: join(dir, 'fun', 'state.json'), roomFile: join(dir, 'fun', 'home', 'room.json') };
}

test('工具声明：两个新工具都在，schema 没有 not，也没有聊天入口', async () => {
  const names = funDefinition.describe.tools.map((tool) => tool.name);
  assert.ok(names.includes('fun_home_state'));
  assert.ok(names.includes('fun_home_activity'));
  assert.equal(names.filter((name) => name === 'fun_home').length, 1, '回家的 fun_home 只能有一个');
  const findNot = (value) => {
    if (Array.isArray(value)) return value.some(findNot);
    if (value && typeof value === 'object') {
      if (Object.hasOwn(value, 'not')) return true;
      return Object.values(value).some(findNot);
    }
    return false;
  };
  for (const name of ['fun_home_state', 'fun_home_activity']) {
    const decl = funDefinition.describe.tools.find((tool) => tool.name === name);
    assert.ok(decl, `${name} 在 describe 里`);
    assert.equal(findNot(decl.parameters), false, `${name} 的 schema 不含 not`);
    assert.ok(decl.tags.includes(name === 'fun_home_state' ? 'read' : 'write'));
  }
  assert.equal(names.some((name) => /chat/i.test(name)), false, '没有聊天工具');
});

test('只读：fun_home_state 有活动/备注/计划/待记一条/住所/在不在外面，且不写盘', async (t) => {
  const { tool, roomFile, stateFile } = await mount(t);
  const beforeRoom = await stat(roomFile).catch(() => null);
  const beforeState = await readFile(stateFile).catch(() => null);
  const result = await tool('fun_home_state')({});
  assert.match(result.text, /在家：刷视频/);
  assert.match(result.text, /现在在家，没有进行中的行程/);
  assert.match(result.text, /待记一条：11 月 22 日 21:30 · 在家刷视频/);
  assert.doesNotMatch(result.text, /data:image/);
  assert.equal(await stat(roomFile).catch(() => null), beforeRoom, '只读不建房间文件');
  assert.deepEqual(await readFile(stateFile).catch(() => null), beforeState);
});

test('写：fun_home_activity 切活动+备注，只改 room.json，返回新的待记一条', async (t) => {
  const { tool, roomFile, stateFile } = await mount(t);
  const state = await tool('fun_home_state')({});
  const beforeState = await readFile(stateFile).catch(() => null);
  const result = await tool('fun_home_activity')({
    activity: 'reading', note: '在沙发上翻一本旧书', expectedRevision: state.revision,
  });
  assert.equal(result.failed, undefined, result.text);
  assert.match(result.text, /换成「读书」了/);
  assert.match(result.text, /11 月 22 日 21:30 · 在家读书 · 在沙发上翻一本旧书/);
  const stored = JSON.parse(await readFile(roomFile, 'utf8'));
  assert.equal(stored.room.activity, 'reading');
  assert.equal(stored.room.note, '在沙发上翻一本旧书');
  assert.deepEqual(await readFile(stateFile).catch(() => null), beforeState, '不写 state.json');
});

test('冲突：旧 revision 返回可读原因、不自动重试、不再写一次', async (t) => {
  const { tool, roomFile } = await mount(t);
  const state = await tool('fun_home_state')({});
  const first = await tool('fun_home_activity')({ activity: 'reading', expectedRevision: state.revision });
  assert.equal(first.failed, undefined, first.text);
  const revision = JSON.parse(await readFile(roomFile, 'utf8')).revision;
  const before = await readFile(roomFile);
  const stale = await tool('fun_home_activity')({ activity: 'gaming', expectedRevision: state.revision });
  assert.equal(stale.failed, true);
  assert.match(stale.text, /revision/);
  assert.match(stale.text, /没有自动重试/);
  assert.deepEqual(await readFile(roomFile), before, '冲突后没有再写');
  assert.equal(JSON.parse(await readFile(roomFile, 'utf8')).revision, revision);
});

test('坏活动与缺 revision 都拒绝，房间不变', async (t) => {
  const { tool, roomFile } = await mount(t);
  const state = await tool('fun_home_state')({});
  const bad = await tool('fun_home_activity')({ activity: 'flying', expectedRevision: state.revision });
  assert.equal(bad.failed, true);
  assert.match(bad.text, /十个固定 id/);
  const missing = await tool('fun_home_activity')({ activity: 'reading' });
  assert.equal(missing.failed, true);
  await assert.rejects(readFile(roomFile), { code: 'ENOENT' }, '坏输入没有建房间文件');
});

test('在外面：待记一条写地点和进度；没有备注就不多最后一段', async (t) => {
  const { tool } = await mount(t);
  const go = await tool('fun_go')({ place: '海洋馆' });
  assert.equal(go.failed, undefined, go.text);
  const state = await tool('fun_home_state')({});
  assert.match(state.text, /现在在外面：海洋馆/);
  assert.match(state.text, /待记一条：11 月 22 日 21:30 · 在海洋馆（逛了 0\/6）/);
  assert.doesNotMatch(state.text, /在家刷视频/);
});