import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FunWorld } from '../src/world.js';
import { normalizeState } from '../src/state.js';
import { cleanup } from './tmp.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const clock = Date.parse('2026-11-24T14:00:00+08:00');
const day = '2026-11-24';
const zone = 'Asia/Shanghai';
const logger = { log: { info() {}, warn() {} } };
const legacy = {
  day, tripSeq: 1, routeSeq: 1,
  session: {
    id: 'old-outing', placeId: 'aquarium', placeName: '海洋馆', enteredAt: clock - 60_000,
    lastAt: clock, routeId: 'old-route', routeOrder: 1,
    visited: [{ area: '海底隧道', note: '', at: clock }],
    pendingChoice: { id: 'old-branch', event: '旧岔路', area: '海底隧道', prompt: '还要等吗？',
      options: [{ id: 'wait', label: '等一会儿', result: '在隧道等了一会儿' }] },
    timeline: [{ kind: 'area', text: '海底隧道', at: clock, area: '海底隧道', event: '' }],
  },
  trips: [{ id: 'old-trip', placeId: 'park', placeName: '公园', enteredAt: clock - 3600_000, leftAt: clock - 1800_000,
    timeline: [{ kind: 'event', text: '旧回忆', at: null, area: '湖边', event: '旧回忆' }] }],
  route: { id: 'old-route', stops: [{ placeId: 'aquarium', placeName: '海洋馆' }, { placeId: 'park', placeName: '公园' }],
    status: 'active', nextIndex: 0, company: '小鱼', startedAt: clock - 60_000, tripIds: [] },
  wishes: [{ id: 'old-wish', placeId: 'park', placeName: '公园', type: 'visit', target: '', reason: '想散步',
    status: 'active', createdAt: '2026-11-23T10:00:00.000Z', updatedAt: '2026-11-23T10:00:00.000Z', completedAt: '' }],
};

const load = (world) => readFile(world.stateFile(), 'utf8').then(JSON.parse);
const tool = (world, name, args = {}) => {
  const row = world.tools().find((entry) => entry.name === name);
  assert.ok(row, 'missing tool ' + name);
  return row.handler(args);
};
async function boot(t, World, root, now = clock) {
  const world = new World({ dataDir: root, cfg: { enabled: true }, timezone: zone, now: () => now, random: () => 0 });
  cleanup(t, world);
  await world.start(logger);
  return world;
}
async function seed(t, fixture = legacy) {
  const root = await mkdtemp(join(tmpdir(), 'fun-compat-'));
  cleanup(t, root);
  await mkdir(join(root, 'fun'));
  await writeFile(join(root, 'fun', 'state.json'), JSON.stringify(fixture));
  return root;
}

test('升级：旧岔路不会锁住未完出游，心愿、两站联程和时间线按原格式保存', async (t) => {
  const normalized = normalizeState(legacy, day, clock, 90, zone);
  assert.equal(normalized.session.pendingChoice, null);
  assert.equal(normalized.notices.choiceDropped, '这一趟的岔路已跳过');
  assert.deepEqual(normalized.wishes, legacy.wishes);
  assert.deepEqual(normalized.route, legacy.route);
  assert.deepEqual(normalized.session.timeline, legacy.session.timeline);
  const root = await seed(t);
  const world = await boot(t, FunWorld, root);
  assert.equal((await tool(world, 'fun_wander', { area: '水母缸' })).failed, undefined);
  assert.match((await tool(world, 'fun_home')).text, /下一站|公园/);
  assert.match((await tool(world, 'fun_go', { place: '公园' })).text, /第2站/);
  assert.match((await tool(world, 'fun_home')).text, /回家/);
  const disk = await load(world);
  const route = disk.routes.find(({ id }) => id === legacy.route.id);
  assert.deepEqual(route.stops, legacy.route.stops);
  assert.equal(route.status, 'completed');
  assert.equal(route.tripIds.length, 2);
  assert.deepEqual(disk.wishes, legacy.wishes);
  assert.deepEqual(disk.trips.find(({ id }) => id === 'old-trip').timeline, legacy.trips[0].timeline);
  assert.deepEqual(disk.trips.find(({ routeOrder }) => routeOrder === 1).timeline[0], legacy.session.timeline[0]);
  assert.equal(disk.notices.choiceDropped, '这一趟的岔路已跳过');
});

test('旧联程改去另一处后不再拦住出游，重启也保留尚未绑定行程的旧路线', async (t) => {
  const fixture = { ...legacy, session: null, route: { ...legacy.route, status: 'planned' } };
  const root = await seed(t, fixture);
  const world = await boot(t, FunWorld, root);
  assert.match((await tool(world, 'fun_go', { place: '江边' })).text, /旧联程已停止继续/);
  await world.stop();
  const again = await boot(t, FunWorld, root);
  assert.match((await tool(again, 'fun_home')).text, /回家/);
  const disk = await load(again);
  assert.equal(disk.route, null);
  assert.deepEqual(disk.routes.find(({ id }) => id === fixture.route.id), { ...fixture.route, status: 'cancelled' });
});

test('回退：历史 World 实际读取 0.8.0 写过的存档，能续、能结束、能重新开局', async (t) => {
  const hasRef = (ref) => spawnSync('git', ['rev-parse', '--verify', ref + '^{commit}'], { cwd: repo }).status === 0;
  // 0.7.8 地点绑定未单独发布；缺标签时使用最后的 0.7.7 提交。其状态归一化及
  // wishes/journeys 与合并了 0.7.8 地点绑定修复的 d2b7daa 三个文件逐字节一致。
  const ref = hasRef('v0.7.8') ? 'v0.7.8' : '12aedb7';
  if (!hasRef(ref)) return t.skip('源码副本没有 v0.7.8 或可用的历史 Git 对象');
  if (ref === '12aedb7') {
    const fromGit = (hash, file) => execFileSync('git', ['show', hash + ':' + file], { cwd: repo });
    for (const file of ['src/state.js', 'src/wishes.js', 'src/journeys.js']) {
      assert.deepEqual(fromGit(ref, file), fromGit('d2b7daa', file), file);
    }
    t.diagnostic('无 v0.7.8 标签：实际回退到 0.7.7（12aedb7）；与含 0.7.8 地点修复的提交对照了状态模块字节');
  }
  const source = await mkdtemp(join(tmpdir(), 'fun-old-source-'));
  cleanup(t, source);
  const archive = execFileSync('git', ['archive', '--format=tar', ref, 'src', 'package.json'], { cwd: repo, maxBuffer: 8 * 1024 * 1024 });
  execFileSync('tar', ['-xf', '-', '-C', source], { input: archive, maxBuffer: 8 * 1024 * 1024 });
  const { FunWorld: OldWorld } = await import(pathToFileURL(join(source, 'src', 'world.js')));
  const { normalizeState: oldNormalize } = await import(pathToFileURL(join(source, 'src', 'state.js')));

  const root = await seed(t);
  const upgraded = await boot(t, FunWorld, root);
  assert.equal((await tool(upgraded, 'fun_wander', { area: '水母缸' })).failed, undefined);
  await upgraded.stop();
  const nextDay = clock + 24 * 3600_000;
  const before = await load(upgraded);
  const parsed = oldNormalize(before, '2026-11-25', nextDay, 90, zone);
  assert.equal(parsed.draft.id, legacy.session.id);
  assert.deepEqual(parsed.draft.timeline, before.session.timeline);
  assert.deepEqual(parsed.wishes, legacy.wishes);
  assert.deepEqual(parsed.route, legacy.route);

  const rolledBack = await boot(t, OldWorld, root, nextDay);
  assert.match((await tool(rolledBack, 'fun_resume', { id: legacy.session.id })).text, /接着逛/);
  assert.match((await tool(rolledBack, 'fun_home')).text, /回家/);
  const roundTrip = await load(rolledBack);
  assert.deepEqual(roundTrip.wishes, legacy.wishes);
  assert.deepEqual(roundTrip.trips.find(({ id }) => id === 'old-trip').timeline, legacy.trips[0].timeline);
  assert.equal(roundTrip.route.status, 'between');
  assert.match((await tool(rolledBack, 'fun_route', { action: 'next', id: legacy.route.id })).text, /进了公园/);
  assert.match((await tool(rolledBack, 'fun_home')).text, /回家/);
  const final = await load(rolledBack);
  assert.equal(final.routes.find(({ id }) => id === legacy.route.id).status, 'completed');
  assert.ok(final.trips[0].timeline.some(({ kind }) => kind === 'close'));
});
