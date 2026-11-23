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
  const now = options.now ?? (() => Date.parse(AT));
  const world = new FunWorld({ dataDir: dir, cfg, timezone: 'Asia/Shanghai', now, random: () => 0 });
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

function jointPack(placeId) {
  return {
    version: 2, id: 'joint-test', title: '两席同票', placeId,
    metadata: { author: '测试', release: '1.0.0', genre: '日常', synopsis: '两个人一起选一处。', participation: 'duo', jointResolution: 'require-agreement' },
    start: 'a',
    nodes: [
      { id: 'a', area: '步道', event: '两个人站在步道上', prompt: '往哪边走？', actor: 'owner', choices: [
        { id: 'left', label: '往左走', result: '决定往左', next: 'b' },
        { id: 'right', label: '往右走', result: '决定往右', next: 'b' }] },
      { id: 'b', area: '栏杆边', event: '两处都可以去', prompt: '两席各自明确选一项。', actor: 'joint', choices: [
        { id: 'rail', label: '一起看栏杆', result: '一起看栏杆', next: 'c' },
        { id: 'bench', label: '一起坐长椅', result: '一起坐长椅', next: 'c' }] },
      { id: 'c', area: '长椅上', event: '天暗下来了' },
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

/** 走到共同决定那一步：进门、用户选一次、再走一步。 */
async function reachJoint(b, started) {
  const move = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '往里走' });
  assert.equal(move.ok, true, move.error);
  const owner = await b.json('fun_story_act', { tripId: started.tripId, stamp: move.stamp, intent: 'say', say: '往左走' });
  assert.equal(owner.ok, true, owner.error);
  const into = await b.json('fun_story_act', { tripId: started.tripId, stamp: owner.stamp, intent: 'say', say: '鱼走过去' });
  assert.equal(into.ok, true, into.error);
  const status = await b.panel('story', 'status');
  assert.equal(status.trip.pending.actor, 'joint');
  assert.equal(status.trip.actor, 'owner');
  return status;
}

test('文字通道：共同决定先记用户那一票，再让鱼自己投她那一票', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, jointPack(b.venue.id));
  const status = await reachJoint(b, started);
  const voted = await b.panel('story', 'choose', { tripId: status.trip.id, stamp: status.trip.stamp, choiceId: status.trip.pending.id, optionId: 'rail' });
  assert.equal(voted.ok, true, voted.error);
  assert.equal(voted.trip.actor, 'fish', '用户投完就轮到鱼');
  assert.deepEqual(voted.trip.jointVotes, { owner: 'rail' });

  const fish = await b.tool('fun_story_act', { tripId: voted.trip.id, stamp: voted.trip.stamp, intent: 'say', say: '一起看栏杆' });
  assert.equal(fish.failed, undefined, fish.text);
  const payload = JSON.parse(fish.text);
  assert.equal(payload.as, 'fish', '这一票要记在鱼名下');
  assert.equal(payload.chosen, 'rail');
  const after = await b.panel('story', 'status');
  assert.equal(after.trip.pending, null, '同票后这一段继续往下走');
  const last = after.trip.choices.at(-1);
  assert.equal(last.actor, 'joint');
  assert.deepEqual(last.votes, [{ actor: 'owner', option: 'rail' }, { actor: 'fish', option: 'rail' }]);
});

test('文字通道：共同决定轮到鱼时，用户没指定就由鱼按角色决定', async (t) => {
  const b = await boot(t, { cognition: { request: async () => ({ text: JSON.stringify({ optionId: 'rail', reason: '想一起看栏杆' }) }) } });
  const started = await startPack(b, jointPack(b.venue.id));
  const status = await reachJoint(b, started);
  const voted = await b.panel('story', 'choose', { tripId: status.trip.id, stamp: status.trip.stamp, choiceId: status.trip.pending.id, optionId: 'rail' });
  assert.equal(voted.ok, true, voted.error);
  const fish = await b.json('fun_story_act', { tripId: voted.trip.id, stamp: voted.trip.stamp, intent: 'say', say: '你来定吧' });
  assert.equal(fish.ok, true, fish.error);
  assert.equal(fish.as, 'fish');
  assert.equal(fish.chosen, 'rail', '没指定时鱼自己决定，不再让用户代投');
});

test('文字通道：共同决定的票和该谁投能从 fun_story_current 读到', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, jointPack(b.venue.id));
  const status = await reachJoint(b, started);
  const voted = await b.panel('story', 'choose', { tripId: status.trip.id, stamp: status.trip.stamp, choiceId: status.trip.pending.id, optionId: 'rail' });
  assert.equal(voted.ok, true, voted.error);
  const current = await b.json('fun_story_current');
  assert.equal(current.trip.actor, 'fish');
  assert.equal(current.trip.pending.actor, 'joint');
  assert.deepEqual(current.trip.pending.votes, { owner: 'rail' });
  assert.match(current.trip.hint, /鱼/);
});

test('共同决定：异票不吞任何一席，两边改到一致才前进', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, jointPack(b.venue.id));
  const status = await reachJoint(b, started);
  const owner = await b.panel('story', 'choose', { tripId: status.trip.id, stamp: status.trip.stamp, choiceId: status.trip.pending.id, optionId: 'rail' });
  assert.equal(owner.ok, true, owner.error);
  const fish = await b.json('fun_story_act', { tripId: owner.trip.id, stamp: owner.trip.stamp, intent: 'say', say: '一起坐长椅' });
  assert.equal(fish.ok, true, fish.error);
  assert.equal(fish.as, 'fish');
  const disagree = (await b.panel('story', 'status')).trip;
  assert.ok(disagree.pending, '异票不前进');
  assert.deepEqual(disagree.pending.votes, { owner: 'rail', fish: 'bench' }, '鱼投的票不能把主人那一票顶掉');
  assert.equal(disagree.actor, 'owner', '两票都在时回到主人这一席');
  const merged = await b.panel('story', 'choose', { tripId: disagree.id, stamp: disagree.stamp, choiceId: disagree.pending.id, optionId: 'bench' });
  assert.equal(merged.ok, true, merged.error);
  assert.equal(merged.trip.pending, null, '两边一致才前进');
  assert.deepEqual(merged.trip.choices.at(-1).votes, [{ actor: 'owner', option: 'bench' }, { actor: 'fish', option: 'bench' }]);
});

test('共同决定：鱼可以改自己那一票，主人那一票也不会被顶掉', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, jointPack(b.venue.id));
  const status = await reachJoint(b, started);
  const owner = await b.panel('story', 'choose', { tripId: status.trip.id, stamp: status.trip.stamp, choiceId: status.trip.pending.id, optionId: 'rail' });
  const fish = await b.json('fun_story_act', { tripId: owner.trip.id, stamp: owner.trip.stamp, intent: 'say', say: '一起坐长椅' });
  assert.equal(fish.as, 'fish');
  const disagree = (await b.panel('story', 'status')).trip;
  const changed = await b.json('fun_story_act', { tripId: disagree.id, stamp: disagree.stamp, intent: 'say', say: '一起看栏杆', as: 'fish' });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(changed.as, 'fish');
  const after = (await b.panel('story', 'status')).trip;
  assert.equal(after.pending, null, '鱼改成和主人一样就前进');
  assert.deepEqual(after.choices.at(-1).votes, [{ actor: 'owner', option: 'rail' }, { actor: 'fish', option: 'rail' }]);
});

test('共同决定：异票僵住时也回得了家', async (t) => {
  const b = await boot(t);
  const started = await startPack(b, jointPack(b.venue.id));
  const status = await reachJoint(b, started);
  const owner = await b.panel('story', 'choose', { tripId: status.trip.id, stamp: status.trip.stamp, choiceId: status.trip.pending.id, optionId: 'rail' });
  await b.json('fun_story_act', { tripId: owner.trip.id, stamp: owner.trip.stamp, intent: 'say', say: '一起坐长椅' });
  const stuck = (await b.panel('story', 'status')).trip;
  assert.ok(stuck.pending, '确实停在异票状态');
  const home = await b.panel('story', 'close', { tripId: stuck.id, stamp: stuck.stamp });
  assert.equal(home.ok, true, home.error);
  const after = await b.panel('story', 'status');
  assert.equal(after.trip, null, '回家成功，不再卡在这一步');
});

test('主人在面板上点的配图会进她的提示词，45 分钟后自己消失', async (t) => {
  const clock = { now: Date.parse(AT) };
  const b = await boot(t, { cfg: { funStoryImages: true }, now: () => clock.now });
  assert.equal(b.world.envPromptVars().fun_places_block, '', '没点之前提示词不多一句');
  const image = await b.panel('story', 'storyImage');
  assert.equal(image.ok, true, image.error);
  assert.equal(image.image.status, 'delegated');
  const block = b.world.envPromptVars().fun_places_block;
  assert.match(block, /imggen_draw/, '委派参数要递到她眼前，否则这一下点了等于没点');
  assert.match(block, /主人刚在面板上/);
  assert.match(block, /鱼的家/, 'prompt 用的是真实场景描述');
  clock.now += 46 * 60 * 1000;
  assert.equal(b.world.envPromptVars().fun_places_block, '', '过期后不再反复提');
});

test('自动配图：普通出游走到一处就把参数写进回执，不用去面板点', async (t) => {
  const b = await boot(t, { cfg: { funStoryImages: true } });
  const go = await b.tool('fun_go', { place: '测试步道' });
  assert.equal(go.failed, undefined, go.text);
  const walk = await b.tool('fun_wander', {});
  assert.equal(walk.failed, undefined, walk.text);
  assert.match(walk.text, /imggen_draw/, '不用点按钮也会把参数递到她手边');
  assert.match(walk.text, /仅描绘已发生的场景/);

  const off = await boot(t, { cfg: { funStoryImages: true, funStoryAutoImages: false } });
  await off.tool('fun_go', { place: '测试步道' });
  const quiet = await off.tool('fun_wander', {});
  assert.doesNotMatch(quiet.text, /imggen_draw/, '关掉自动准备就回到旧回执');
});

test('自动配图：故事翻页也会准备一份，只对委派来源生效', async (t) => {
  const b = await boot(t, { cfg: { funStoryImages: true } });
  const started = await startPack(b, duoPack(b.venue.id));
  const before = b.world.envPromptVars().fun_places_block;
  assert.match(before, /自动准备的参数/, '开局这一屏也自动备好参数');
  assert.match(before, /imggen_draw/);
  const move = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '往里走' });
  assert.equal(move.ok, true, move.error);
  const block = b.world.envPromptVars().fun_places_block;
  assert.match(block, /自动准备的参数/, '翻到新的一屏会换一份参数');
  assert.notEqual(block, before);

  const quiet = await boot(t, { cfg: { funStoryImages: true, funStoryAutoImages: false } });
  const quietStart = await startPack(quiet, duoPack(quiet.venue.id));
  await quiet.json('fun_story_act', { tripId: quietStart.tripId, stamp: quietStart.stamp, intent: 'say', say: '往里走' });
  assert.equal(quiet.world.envPromptVars().fun_places_block, '');
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
