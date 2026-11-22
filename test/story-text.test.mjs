import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';

const AT = '2026-11-22T14:00:00+08:00';

async function boot(t, options = {}) {
  const dir = await mkdtemp(join(process.env.TEMP || process.cwd(), 'fun-text-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cognition = options.cognition ?? { request: async () => ({ text: JSON.stringify({ optionId: 'left', reason: '随便' }) }) };
  const cfg = { enabled: true, funStoryTextOn: true, ...(options.cfg ?? {}) };
  const world = new FunWorld({ dataDir: dir, cfg, timezone: 'Asia/Shanghai', now: () => Date.parse(AT), random: () => 0 });
  await world.start({ cognition, log: { info() {}, warn() {} } });
  const tool = (name, args = {}) => world.tools().find((row) => row.name === name).handler(args);
  const panel = (id, method, payload = {}) => world.webUi().invoke(id, method, [payload]);
  const json = async (name, args = {}) => JSON.parse((await tool(name, args)).text);
  const place = await panel('places', 'save', { name: '测试步道', areas: ['步道', '栏杆边', '长椅上'], hours: { open: '00:00', close: '23:59' }, randomEvents: [] });
  assert.equal(place.ok, true, place.error);
  const venue = (await panel('places', 'list')).places.find((row) => row.name === '测试步道');
  return { world, dir, tool, panel, json, venue };
}

function duoPack(placeId) {
  return {
    version: 2, id: 'duo-test', title: '桥边的两个人', placeId,
    metadata: { author: '测试', release: '1.0.0', genre: '日常', synopsis: '两个人在桥边做决定。', participation: 'duo', jointResolution: 'require-agreement' },
    start: 'a',
    nodes: [
      { id: 'a', area: '步道', event: '两个人站在步道上', prompt: '往哪边走？', actor: 'owner', choices: [
        { id: 'left', label: '往左走', result: '决定往左', next: 'b' },
        { id: 'right', label: '往右走', result: '决定往右', next: 'b' }] },
      { id: 'b', area: '栏杆边', event: '到了栏杆边，鱼想停下来', prompt: '鱼要做什么？', actor: 'fish', choices: [
        { id: 'stay', label: '停下来', result: '鱼决定停下来', next: 'c' },
        { id: 'go', label: '继续走', result: '鱼决定继续走', next: 'c' }] },
      { id: 'c', area: '栏杆边', event: '天暗下来了' },
    ],
  };
}

function soloPack(placeId) {
  return {
    version: 1, id: 'solo-test', title: '窗边的一页', placeId, start: 'a',
    nodes: [
      { id: 'a', area: '步道', event: '步道上有一页纸', prompt: '捡起来还是继续走？', choices: [
        { id: 'pick', label: '捡起来看', result: '捡起了纸', next: 'b' },
        { id: 'walk', label: '继续走', result: '继续往前走', next: 'b' }] },
      { id: 'b', area: '步道', event: '风把纸吹走了' },
    ],
  };
}

async function startPack(b, pack) {
  const imported = await b.panel('stories', 'import', { json: JSON.stringify(pack) });
  assert.equal(imported.ok, true, imported.error);
  const cards = await b.json('fun_story_candidates');
  const card = cards.candidates.find((row) => row.id === pack.id);
  const current = await b.json('fun_story_current');
  const started = await b.json('fun_story_start', { packId: card.id, revision: card.revision, startStamp: current.startStamp, confirm: true });
  assert.equal(started.ok, true, started.error);
  return started;
}

test('文字通道：用户回合可以按原话替用户提交，鱼的回合以鱼身份提交', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, duoPack(b.venue.id));
  const move = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '往里走' });
  assert.equal(move.ok, true, move.error);
  assert.ok(move.pending, '走一步后出现待选');
  const chosen = await b.json('fun_story_act', { tripId: started.tripId, stamp: move.stamp, intent: 'say', say: '往左走' });
  assert.equal(chosen.ok, true, chosen.error);
  assert.equal(chosen.as, 'owner');
  const current = await b.panel('story', 'status');
  assert.equal(current.trip.choices.at(-1).actor, 'owner', '替用户提交记为 owner');
  // 轮到鱼：以 fish 身份走一步、再选一次。
  const fishMove = await b.json('fun_story_act', { tripId: current.trip.id, stamp: current.trip.stamp, intent: 'say', say: '鱼走过去' });
  assert.equal(fishMove.ok, true, fishMove.error);
  const fishChoice = await b.json('fun_story_act', { tripId: current.trip.id, stamp: fishMove.stamp, intent: 'say', say: '停下来' });
  assert.equal(fishChoice.ok, true, fishChoice.error);
  assert.equal(fishChoice.as, 'fish');
  const after = await b.panel('story', 'status');
  const actors = after.trip.choices.map((row) => row.actor);
  assert.deepEqual(actors.slice(-2), ['owner', 'fish']);
});

test('文字通道：说「第二个」也能落到对应选项', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, soloPack(b.venue.id));
  const moved = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '往前走' });
  assert.equal(moved.ok, true, moved.error);
  const picked = await b.json('fun_story_act', { tripId: started.tripId, stamp: moved.stamp, intent: 'say', say: '那就第二个' });
  assert.equal(picked.ok, true, picked.error);
  assert.equal(picked.chosen, 'walk');
});

test('文字通道：轮到鱼而用户没指定时，鱼按自己角色决定', async (t) => {
  const b = await boot(t, { cognition: { request: async () => ({ text: JSON.stringify({ optionId: 'stay', reason: '想停下来' }) }) } });
  const started = await startPack(b, duoPack(b.venue.id));
  const move = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '往里走' });
  await b.json('fun_story_act', { tripId: started.tripId, stamp: move.stamp, intent: 'say', say: '往左走' });
  const status = await b.panel('story', 'status');
  const fishMove = await b.json('fun_story_act', { tripId: status.trip.id, stamp: status.trip.stamp, intent: 'say', say: '你走过去' });
  const decided = await b.json('fun_story_act', { tripId: status.trip.id, stamp: fishMove.stamp, intent: 'say', say: '你来决定吧' });
  assert.equal(decided.ok, true, decided.error);
  assert.equal(decided.as, 'fish');
  assert.equal(decided.chosen, 'stay');
});

test('鱼自己游玩是持久偏好：用户回合也记住，轮到鱼自动可用', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, duoPack(b.venue.id));
  const status = await b.panel('story', 'status');
  const enabled = await b.panel('story', 'mode', { tripId: status.trip.id, stamp: status.trip.stamp, enabled: true });
  assert.equal(enabled.ok, true, enabled.error);
  assert.equal(enabled.autoplay, true, '用户回合先记住偏好');
  assert.equal(enabled.autonomy.enabled, false, '用户回合不发授权');
  assert.equal(enabled.autonomy.token, undefined);

  const move = await b.json('fun_story_act', { tripId: status.trip.id, stamp: status.trip.stamp, intent: 'say', say: '往里走' });
  const chosen = await b.json('fun_story_act', { tripId: status.trip.id, stamp: move.stamp, intent: 'say', say: '往左走' });
  assert.equal(chosen.ok, true, chosen.error);
  const fishTurn = await b.panel('story', 'status');
  assert.equal(fishTurn.trip.actor, 'fish');
  const granted = await b.panel('story', 'mode', { tripId: fishTurn.trip.id, stamp: fishTurn.trip.stamp, enabled: true });
  assert.equal(granted.autonomy.enabled, true, '轮到鱼时能拿到授权');
  assert.equal(typeof granted.autonomy.token, 'string');

  const reopened = new FunWorld({ dataDir: b.dir, cfg: { enabled: true, funStoryTextOn: true }, timezone: 'Asia/Shanghai', now: () => Date.parse(AT), random: () => 0 });
  await reopened.start({ cognition: { request: async () => ({ text: '{}' }) }, log: { info() {}, warn() {} } });
  const restarted = await reopened.webUi().invoke('story', 'status');
  assert.equal(restarted.autoplay, true, '重启后偏好还在');
});
