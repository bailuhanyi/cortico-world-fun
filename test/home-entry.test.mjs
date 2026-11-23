/**
 * M2「家作为入口」的服务端验收：纪念品、未完行程、心愿便签、手写计划。
 *
 * 只读断言之外，重点守两条边界：
 *   · 房间展示/切活动/写 plan **不动 `state.json`**；
 *   · `resume` 是唯一会推进行程的入口（复用 `#resumeTool`，同一趟 id 不变），
 *     不提供「替她回家」。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS } from '../src/config.js';
import { FunWorld } from '../src/world.js';
import { cleanup } from './tmp.mjs';

const TZ = 'Asia/Shanghai';
const NOW = Date.parse('2026-11-22T21:30:00+08:00');
const HOUR = 60 * 60 * 1000;

const TRIPS = [
  {
    id: 'trip-aquarium', placeId: 'aquarium', placeName: '海洋馆', enteredAt: NOW - 5 * HOUR, leftAt: NOW - 4 * HOUR,
    visited: [{ area: '海底隧道' }], souvenirs: ['鲸鱼挂件', '一张门票'], photos: [], events: [],
  },
  {
    id: 'trip-cafe', placeId: 'cafe', placeName: '咖啡店', enteredAt: NOW - 30 * HOUR, leftAt: NOW - 29 * HOUR,
    visited: [{ area: '靠窗座位' }], souvenirs: ['一杯特调', '一小束野花'], photos: [], events: [],
  },
];

const DRAFT = {
  id: 'draft-1', placeId: 'aquarium', placeName: '海洋馆', enteredAt: NOW - 2 * HOUR, lastAt: NOW - 90 * 60000,
  visited: [{ area: '海底隧道', note: '看了很久' }], souvenirs: [], photos: [], events: [],
};

async function mount(t, { seed = null } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-entry-'));
  if (seed) {
    await mkdir(join(dir, 'fun'), { recursive: true });
    await writeFile(join(dir, 'fun', 'state.json'), JSON.stringify(seed), 'utf8');
  }
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true }, dataDir: dir, timezone: TZ, now: () => NOW, persist: () => {},
  });
  await world.start({ log: { info() {}, warn() {} } });
  cleanup(t, dir, world);
  const call = (method, payload) => world.webUi('zh').invoke('home', method, payload === undefined ? [] : [payload]);
  return { dir, world, call, stateFile: join(dir, 'fun', 'state.json') };
}

test('空数据：不硬摆纪念品、没有未完行程、没有心愿；房间不退化', async (t) => {
  const { call } = await mount(t);
  const state = await call('state');
  assert.equal(state.ok, true, state.error);
  assert.deepEqual(state.keepsakes, []);
  assert.equal(state.resume, null);
  assert.equal(state.wish, null);
  assert.equal(state.activities.length, 10);
});

test('纪念品：取最新 3–5 件并归到票根/杯子/玩偶/植物/书架', async (t) => {
  const { call } = await mount(t, { seed: { day: '2026-11-22', session: null, draft: null, trips: TRIPS, wishes: [] } });
  const state = await call('state');
  assert.equal(state.keepsakes.length, 4, '两趟各两件，共 4 件');
  const byName = Object.fromEntries(state.keepsakes.map((item) => [item.name, item]));
  assert.equal(byName['鲸鱼挂件'].category, 'doll');
  assert.equal(byName['一张门票'].category, 'ticket');
  assert.equal(byName['一杯特调'].category, 'cup');
  assert.equal(byName['一小束野花'].category, 'plant');
  assert.equal(byName['鲸鱼挂件'].placeName, '海洋馆');
  assert.equal(byName['鲸鱼挂件'].day, '2026-11-22');
});

test('未完行程：票笺列出地点与进度；继续后同一趟 id、runId 不变', async (t) => {
  const { call, stateFile } = await mount(t, {
    seed: { day: '2026-11-22', session: null, draft: DRAFT, trips: [], wishes: [] },
  });
  const before = await readFile(stateFile);
  const state = await call('state');
  assert.equal(state.trip.mode, 'draft');
  assert.deepEqual(state.resume, { id: 'draft-1', placeName: '海洋馆', visited: 1, total: 6 });
  assert.deepEqual(await readFile(stateFile), before, '只读展示不落盘');

  const resumed = await call('resume', { id: 'draft-1' });
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal(resumed.trip.mode, 'out');
  const stored = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(stored.session.id, 'draft-1', '同一趟 id / runId 不变');
  assert.equal(stored.draft, null);
  assert.equal(stored.session.visited.length, 1, '进度没有丢');
});

test('心愿便签：只读第一个未完成的；管理仍在纪念册（不提供新写入口）', async (t) => {
  const { call } = await mount(t, {
    seed: {
      day: '2026-11-22', session: null, draft: null, trips: [],
      wishes: [
        { id: 'w-done', placeId: 'aquarium', placeName: '海洋馆', type: 'visit', status: 'completed' },
        { id: 'w-active', placeId: 'cafe', placeName: '咖啡店', type: 'souvenir', target: '一杯特调', status: 'active', reason: '想再喝一次' },
      ],
    },
  });
  const state = await call('state');
  assert.equal(state.wish.id, 'w-active');
  assert.equal(state.wish.placeName, '咖啡店');
  assert.equal(state.wish.target, '一杯特调');
  assert.equal(state.wish.reason, '想再喝一次');
});

test('手写计划：非空才写进 room.json；空串整条省略；≤60 字；不动 state.json', async (t) => {
  const { call, dir, stateFile } = await mount(t, { seed: { day: '2026-11-22', session: null, draft: null, trips: [], wishes: [] } });
  const roomFile = join(dir, 'fun', 'home', 'room.json');
  const before = await readFile(stateFile);
  const empty = await call('setPlan', { plan: '   ', revision: 0 });
  assert.equal(empty.ok, true, empty.error);
  assert.equal(empty.room.plan, '');
  await assert.rejects(readFile(roomFile), { code: 'ENOENT' }, '空计划连房间文件都不写');

  const saved = await call('setPlan', { plan: ' 想读半小时书 ', revision: empty.revision });
  assert.equal(saved.ok, true, saved.error);
  assert.equal(saved.room.plan, '想读半小时书');
  assert.equal(JSON.parse(await readFile(roomFile, 'utf8')).room.plan, '想读半小时书');
  assert.deepEqual(await readFile(stateFile), before, '写计划不碰行程存档');

  const tooLong = await call('setPlan', { plan: '字'.repeat(61), revision: saved.revision });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.code, 'INVALID_ROOM');

  const cleared = await call('setPlan', { plan: '', revision: saved.revision });
  assert.equal(cleared.ok, true, cleared.error);
  assert.equal(Object.hasOwn(JSON.parse(await readFile(roomFile, 'utf8')).room, 'plan'), false);
});

test('普通房间操作：切活动 / 读写图片接口 / 看纪念品都不改动 state.json', async (t) => {
  const { call, stateFile } = await mount(t, { seed: { day: '2026-11-22', session: null, draft: null, trips: TRIPS, wishes: [] } });
  const before = await readFile(stateFile);
  await call('state');
  const picked = await call('setActivity', { activity: 'reading', revision: 0 });
  await call('art', { slot: 'character', activity: 'reading' });
  assert.equal(picked.ok, true, picked.error);
  assert.deepEqual(await readFile(stateFile), before);
});

test('resume 坏 id：可读失败，不写盘', async (t) => {
  const { call, stateFile } = await mount(t, { seed: { day: '2026-11-22', session: null, draft: DRAFT, trips: [], wishes: [] } });
  const before = await readFile(stateFile);
  const bad = await call('resume', { id: 'nope' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /找不到/);
  assert.deepEqual(await readFile(stateFile), before);
});