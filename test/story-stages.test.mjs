import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { BUILTIN_STORY_PACKS, SAMPLE_STORY, SAMPLE_VENUE, storyFixtureJson } from './fixtures/story-presets.mjs';

const ok = (r) => { assert.equal(r.ok, true, r.error); return r; };
const step = (s) => ({ tripId: s.trip.id, stamp: s.trip.stamp });
const choice = (s, optionId) => ({ ...step(s), choiceId: s.trip.pending.id, optionId });
async function rig(t, options = {}) {
  const dir = await mkdtemp(join(process.env.TEMP || process.cwd(), 'fun-stages-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const clock = { now: Date.parse('2026-11-21T13:00:00+08:00') };
  let answer = 'follow';
  const requests = [];
  const cognition = options.cognition || { request: async (payload) => { requests.push(payload); return { text: JSON.stringify({ optionId: answer, reason: '这是鱼自己的明确选择' }) }; } };
  let seeded = false;
  async function create(cfg = options.cfg || {}) {
    const world = new FunWorld({ dataDir: dir, cfg, timezone: 'Asia/Shanghai', now: () => clock.now, random: () => 0 });
    await world.start({ cognition });
    const panel = (id, method, payload = {}) => world.webUi().invoke(id, method, [payload]);
    if (!seeded) {
      for (const pack of BUILTIN_STORY_PACKS) ok(await panel('stories', 'import', { json: storyFixtureJson(pack) }));
      seeded = true;
    }
    const rpc = (method, payload) => panel('story', method, payload);
    const tool = (name, args = {}) => world.tools().find((row) => row.name === name).handler(args);
    return { world, panel, rpc, tool };
  }
  return { dir, clock, requests, answer: (value) => { answer = value; }, create, ...await create() };
}
async function start(r, id) {
  const status = ok(await r.rpc('status'));
  const card = status.catalog.find((row) => row.id === id);
  assert.ok(card, id);
  return ok(await r.rpc('start', { startStamp: status.startStamp, packId: id, revision: card.revision }));
}
async function auto(r, s, answer) {
  if (answer) r.answer(answer);
  const enabled = ok(await r.rpc('mode', { ...step(s), enabled: true }));
  const payload = { ...step(enabled), token: enabled.autonomy.token };
  if (enabled.trip.step === 'choose') {
    const decided = ok(await r.rpc('decide', payload));
    return ok(await r.rpc('auto', { ...payload, ticket: decided.ticket }));
  }
  return ok(await r.rpc('auto', payload));
}
async function installCreek(r) {
  if (ok(await r.panel('stories', 'list')).packs.some(({ id }) => id === SAMPLE_STORY.id)) return;
  ok(await r.panel('places', 'save', SAMPLE_VENUE));
  ok(await r.panel('stories', 'import', { json: storyFixtureJson(SAMPLE_STORY) }));
}
async function creek(r, option = 'follow') {
  await installCreek(r);
  let s = await start(r, 'creek-drift-letter');
  s = ok(await r.rpc('move', step(s)));
  s = await auto(r, s, option);
  s = ok(await r.rpc('move', step(s)));
  return ok(await r.rpc('close', step(s)));
}

// Public queries and author preview must stay observational even with saved files.
test('all six public queries preserve persisted bytes and hide unplayed outcomes', async (t) => {
  const r = await rig(t);
  await installCreek(r);
  const before = await readFile(r.world.stateFile()).catch(() => null);
  const stories = await readFile(r.world.storiesFile());
  const names = ['fun_story_places', 'fun_story_candidates', 'fun_story_detail', 'fun_story_current', 'fun_story_recap', 'fun_story_schedule'];
  for (const name of names) {
    const result = await r.tool(name, name === 'fun_story_detail' || name === 'fun_story_schedule' ? { id: 'duo-cafe-date' } : {});
    assert.doesNotMatch(JSON.stringify(result), /鱼把书合上|date-ending-reading|reeds-ending/);
    const { text, failed, ...fields } = result;
    const receipt = JSON.parse(text);
    for (const key of Object.keys(fields)) assert.deepEqual(receipt[key], fields[key]);
    assert.equal(Boolean(failed), !result.ok);
    assert.ok(r.world.tools().find((row) => row.name === name).tags.includes('read'));
  }
  assert.deepEqual(await readFile(r.world.stateFile()).catch(() => null), before);
  assert.deepEqual(await readFile(r.world.storiesFile()), stories);
  assert.equal((await r.tool('fun_story_current')).state, 'none');
  const missing = await r.tool('fun_story_detail', { id: 'no-such-story' });
  assert.equal(missing.failed, true);
  assert.equal(JSON.parse(missing.text).code, 'NOT_FOUND');
  const legacy = await r.tool('fun_story_detail', { id: 'riverside-late-lights' });
  assert.equal(legacy.story.duration, '未知');
  assert.equal(legacy.story.durationMinutes, null);
});

test('reference audiences, actual node and choice gates stay separate across restart', async (t) => {
  const calls = [];
  const cognition = { request: async ({ brief }) => {
    const input = JSON.parse(brief.slice(brief.indexOf('\n') + 1));
    const dm = Boolean(input.title);
    calls.push({ input, dm });
    return { text: JSON.stringify(dm ? { optionId: 'end', narration: '主持私有资料' } : { optionId: 'end', reason: '鱼的私有资料' }) };
  } };
  const r = await rig(t, { cfg: { funStoryDM: true }, cognition });
  const here = '角落的双人座', there = '靠窗的位子';
  const options = (a, b, target) => [a, b].map((id) => ({ id, label: id, result: '已选择此项。', next: target }));
  const ref = (audience, text, gate = {}) => ({ area: here, afterNode: 'first', afterChoice: 'read', audience, text, ...gate });
  const pack = { version: 2, id: 'private-reference-test', title: '读线索', placeId: 'cafe', start: 'first',
    metadata: { author: '作者', release: '1.0', genre: '日常', synopsis: '查看眼前的卡片。', participation: 'solo' },
    nodes: [
      { id: 'first', area: here, event: '桌上有张卡片。', choices: options('read', 'pass', 'second') },
      { id: 'second', area: here, event: '你又坐了一会儿。', choices: options('end', 'stay', 'ending') },
      { id: 'ending', area: there, event: '大家走到窗边。' },
    ],
    references: [ref('player', '玩家可读线索'), ref('fish', '鱼的私有资料'), ref('dm', '主持私有资料'),
      ref('dm', '不同区域资料', { area: there }), ref('dm', '未来结尾资料', { afterNode: 'ending', afterChoice: undefined }),
      ref('player', '未选路径资料', { afterChoice: 'pass' })],
  };
  assert.equal((await r.panel('stories', 'validate', { json: JSON.stringify({ ...pack, references: [ref('dm', '坏线索', { afterChoice: 'end' })] }) })).ok, false);
  ok(await r.panel('stories', 'import', { json: JSON.stringify(pack) }));
  let s = await start(r, pack.id);
  assert.deepEqual(s.trip.references, []);
  s = ok(await r.rpc('move', step(s)));
  assert.deepEqual(s.trip.references, []);
  s = ok(await r.rpc('choose', choice(s, 'read')));
  const restarted = await r.create();
  s = ok(await restarted.rpc('status'));
  assert.deepEqual(s.trip.references, ['玩家可读线索']);
  s = ok(await restarted.rpc('move', step(s)));
  assert.deepEqual(s.trip.references, ['玩家可读线索']);
  const queried = ok(await restarted.tool('fun_story_current'));
  assert.doesNotMatch(queried.text, /私有资料|未来结尾资料|玩家可读线索|未选路径资料/);
  s = ok(await restarted.rpc('dmPropose', { ...step(s), requestId: 'reference-dm-000001' }));
  assert.deepEqual(calls[0].input.references, ['主持私有资料']);
  assert.doesNotMatch(JSON.stringify(s), /私有资料|不同区域资料|未来结尾资料|未选路径资料/);
  s = await auto({ ...r, ...restarted }, s);
  assert.deepEqual(calls[1].input.references, ['鱼的私有资料']);
  assert.doesNotMatch(JSON.stringify(s), /私有资料|不同区域资料|未来结尾资料|未选路径资料/);
  s = ok(await restarted.rpc('move', step(s)));
  assert.deepEqual(s.trip.references, []);
});

test('duo owner, joint disagreement, fish and ending use explicit actors across restart', async (t) => {
  const r = await rig(t);
  let s = await start(r, 'duo-cafe-date');
  assert.equal(s.trip.actor, 'owner');
  const ownerMode = await r.rpc('mode', { ...step(s), enabled: true });
  assert.equal(ownerMode.ok, true, '用户回合也记住"让鱼自己玩"');
  assert.equal(ownerMode.autoplay, true);
  assert.equal(ownerMode.autonomy.enabled, false, '用户回合不发授权');
  assert.equal(ownerMode.autonomy.token, undefined);
  const forged = await r.tool('fun_wander', { area: s.trip.nextArea });
  assert.equal(forged.failed, true);
  s = ok(await r.rpc('move', step(s)));
  assert.equal((await r.tool('fun_choice', { choiceId: s.trip.pending.id, optionId: 'window-seat' })).failed, true);
  s = ok(await r.rpc('choose', choice(s, 'window-seat')));
  s = ok(await r.rpc('move', step(s)));
  assert.equal(s.trip.actor, 'owner');
  s = ok(await r.rpc('choose', choice(s, 'write-note')));
  assert.equal(s.trip.actor, 'fish');
  assert.equal((await r.rpc('choose', choice(s, 'keep-card'))).ok, false);
  s = await auto(r, s, 'keep-card');
  assert.ok(s.trip.pending, 'disagreement must remain pending');
  assert.equal(s.trip.actor, 'owner');
  r.clock.now += 5_000;
  const restarted = await r.create();
  s = ok(await restarted.rpc('status'));
  assert.ok(s.trip.pending, 'time and restart are never consent');
  s = ok(await restarted.rpc('choose', choice(s, 'keep-card')));
  s = await auto({ ...r, ...restarted }, s);
  assert.equal(s.trip.actor, 'fish');
  assert.equal((await restarted.rpc('choose', choice(s, 'share-book'))).ok, false);
  s = await auto({ ...r, ...restarted }, s, 'share-book');
  s = ok(await restarted.rpc('move', step(s)));
  s = ok(await restarted.rpc('close', step(s)));
  assert.equal(s.memories[0].complete, true);
  const rows = s.memories[0].choices;
  assert.ok(rows.some((row) => row.actor === 'owner'));
  assert.ok(rows.some((row) => row.actor === 'fish'));
  assert.ok(rows.some((row) => row.actor === 'joint' && row.votes.length === 2));
  for (const request of r.requests) {
    assert.deepEqual(request.tools, []);
    assert.doesNotMatch(request.brief, /date-ending|鱼把书合上|next\":|result\":/);
  }
});

test('fork preserves spent budget, lineage and idempotence without global effects', async (t) => {
  const r = await rig(t);
  const finished = await creek(r);
  const memory = finished.memories[0];
  const sourceDisk = JSON.parse(await readFile(r.world.stateFile(), 'utf8'));
  const sourceTrip = sourceDisk.trips.find((row) => row.id === memory.id);
  const checkpoint = sourceTrip.storyRun.checkpoints.find((row) => row.pendingChoice);
  assert.ok(checkpoint);
  const payload = { memoryId: memory.id, checkpointId: checkpoint.id, forkToken: 'branch-operation-0000001' };
  let s = ok(await r.rpc('fork', payload));
  assert.equal(s.fork.canonical, false);
  assert.notEqual(s.fork.runId, sourceTrip.storyRun.runId);
  const branchRunId = s.fork.runId;
  assert.equal(s.fork.sourceRunId, sourceTrip.storyRun.runId);
  assert.equal(s.trip.budget.calls, sourceTrip.storyRun.budget.calls);
  const restarted = await r.create();
  s = ok(await restarted.rpc('fork', payload));
  assert.equal(s.replayed, true);
  s = ok(await restarted.rpc('choose', choice(s, 'keep')));
  s = ok(await restarted.rpc('move', step(s)));
  s = ok(await restarted.rpc('close', step(s)));
  const disk = JSON.parse(await readFile(r.world.stateFile(), 'utf8'));
  assert.deepEqual(disk.exploration, sourceDisk.exploration);
  assert.deepEqual(disk.collection, sourceDisk.collection);
  assert.deepEqual(disk.wishes, sourceDisk.wishes);
  assert.deepEqual(disk.trips.find((row) => row.id === memory.id), sourceTrip);
  assert.equal(s.memories[0].canonical, false);
  const replay = ok(await restarted.rpc('fork', payload));
  assert.equal(replay.replayed, true);
  assert.equal(replay.fork.runId, branchRunId);
  assert.ok(Array.isArray(replay.catalog));
  assert.ok(replay.memories.some((row) => row.id === s.memories[0].id));
  const recap = ok(await restarted.tool('fun_story_recap', { id: s.memories[0].id }));
  assert.match(recap.memory.summary, /实际选择/);
  assert.doesNotMatch(recap.memory.summary, /芦苇滩/);
});

test('changed content and resources refuse incompatible checkpoint forks', async (t) => {
  const r = await rig(t);
  const finished = await creek(r);
  const memory = finished.memories[0];
  const payload = { memoryId: memory.id, checkpointId: memory.checkpoints[1].id, forkToken: 'branch-operation-0000002' };
  const exported = ok(await r.panel('stories', 'export', { id: memory.packId }));
  const pack = JSON.parse(exported.json);
  pack.title += '修订';
  ok(await r.panel('stories', 'import', { json: JSON.stringify(pack), replace: true }));
  assert.equal((await r.rpc('fork', payload)).code, 'CONTENT_STALE');
  pack.title = memory.title;
  ok(await r.panel('stories', 'import', { json: JSON.stringify(pack), replace: true }));
  const places = ok(await r.panel('places', 'list'));
  const venue = places.places.find((row) => row.id === 'user-story-creek-letter');
  assert.ok(venue);
  ok(await r.panel('places', 'save', { ...venue, desc: '修改后的场所说明' }));
  assert.equal((await r.rpc('fork', payload)).code, 'RESOURCE_STALE');
});

test('first completion remains canonical across divergent replays and record trimming', async (t) => {
  const r = await rig(t);
  const first = await creek(r, 'follow');
  const before = JSON.parse(await readFile(r.world.stateFile(), 'utf8'));
  assert.equal(first.memories[0].canonical, true);
  assert.equal(before.storyCanon.length, 1);
  const replay = await creek(r, 'keep');
  assert.equal(replay.memories[0].canonical, false);
  const disk = JSON.parse(await readFile(r.world.stateFile(), 'utf8'));
  assert.deepEqual(disk.storyCanon, before.storyCanon);
  assert.deepEqual(disk.exploration, before.exploration);
  assert.deepEqual(disk.collection, before.collection);
  const { normalizeState } = await import('../src/state.js');
  const normalized = normalizeState({ ...disk, trips: [], keepsakeTrips: [] }, '2026-11-21', r.clock.now, 90, 'Asia/Shanghai');
  assert.deepEqual(normalized.storyCanon, before.storyCanon);
  const sequel = { version: 2, id: 'creek-sequel', title: '溪边续章', placeId: 'user-story-creek-letter', start: 'end',
    metadata: { author: '测试作者', release: '1.0.0', genre: '日常', synopsis: '明确前篇经历之后再来溪边。', participation: 'solo', requirements: [], seriesId: 'creek-series', chapter: 2, requiresCompleted: ['creek-drift-letter'] },
    nodes: [{ id: 'end', area: '旧木桥', event: '你带着前篇的记忆回到桥边。' }] };
  ok(await r.panel('stories', 'import', { json: JSON.stringify(sequel) }));
  assert.equal(ok(await r.tool('fun_story_detail', { id: sequel.id })).story.available, true);
});

test('images remain independent and default off without blocking text or dispatching requests', async (t) => {
  const r = await rig(t);
  let s = ok(await r.rpc('status'));
  assert.equal(s.images.state, 'off');
  const enabled = await r.create({ funStoryImages: true });
  s = ok(await enabled.rpc('status'));
  assert.equal(s.images.state, 'delegated');
  assert.equal(s.images.generationAvailable, false);
  s = await start(enabled, 'duo-cafe-date');
  s = ok(await enabled.rpc('move', step(s)));
  assert.equal(s.trip.step, 'choose');
  assert.equal(r.requests.length, 0);
});

test('live DM config disable cancels pending proposal and rejects a late result', async (t) => {
  let release, dispatched;
  const sent = new Promise((resolve) => { dispatched = resolve; });
  const rawCfg = { funStoryDM: true };
  const cognition = { request: () => { dispatched(); return new Promise((resolve) => { release = resolve; }); } };
  const r = await rig(t, { cfg: rawCfg, cognition });
  let s = await start(r, 'duo-cafe-date');
  s = ok(await r.rpc('move', step(s)));
  const pending = r.rpc('dmPropose', { ...step(s), requestId: 'dm-live-config-000001' });
  await sent;
  rawCfg.funStoryDM = false;
  s = ok(await r.rpc('status'));
  assert.equal(s.dm.enabled, false);
  assert.equal(s.dm.pending, false);
  release({ text: JSON.stringify({ narration: 'A stale proposal.', optionId: 'window-seat' }), usage: { inputTokens: 3, outputTokens: 2 } });
  const stale = await pending;
  assert.equal(stale.ok, false);
  s = ok(await r.rpc('status'));
  assert.equal(s.dm.proposal, null);
  assert.equal(s.dm.enabled, false);
  assert.equal(s.dm.budget.calls, 1);
  assert.equal(s.dm.budget.totalTokens, 5, 'reportable usage remains accounted after cancellation');
  assert.equal(s.trip.actor, 'owner', 'cancelled DM never submits an owner action');
});

test('World DM reserves before dispatch, requires confirmation and preserves usage across restart', async (t) => {
  let r;
  const cognition = { request: async (payload) => {
    const disk = JSON.parse(await readFile(r.world.stateFile(), 'utf8'));
    assert.equal(disk.session.storyRun.dmBudget.calls, 1, 'reservation must precede host dispatch');
    assert.deepEqual(payload.tools, []);
    assert.doesNotMatch(payload.brief, /date-ending|鱼把书合上|next\":|result\":/);
    return { text: JSON.stringify({ narration: '提议在窗边坐下，尚待用户决定。', optionId: 'window-seat' }), usage: { inputTokens: 11, outputTokens: 5 } };
  } };
  r = await rig(t, { cfg: { funStoryDM: true }, cognition });
  let s = await start(r, 'duo-cafe-date');
  s = ok(await r.rpc('move', step(s)));
  const before = s.trip.stamp;
  s = ok(await r.rpc('dmPropose', { ...step(s), requestId: 'world-dm-request-000001' }));
  assert.equal(s.trip.stamp, before, 'a proposal does not advance the story');
  assert.equal(s.dm.budget.calls, 1);
  assert.equal(s.dm.budget.knownUsageCalls, 1);
  assert.equal(s.dm.budget.unknownUsageCalls, 0);
  assert.equal(s.dm.budget.totalTokens, 16);
  const proposal = s.dm.proposal;
  assert.equal(proposal.optionId, 'window-seat');
  s = ok(await r.rpc('choose', { ...choice(s, proposal.optionId), dmProposalId: proposal.id }));
  assert.notEqual(s.trip.stamp, before);
  const restarted = await r.create();
  s = ok(await restarted.rpc('status'));
  assert.equal(s.dm.budget.calls, 1);
  assert.equal(s.dm.budget.totalTokens, 16);
  assert.equal(s.dm.proposal, null, 'old proposals are never resumed after restart');
  const disabled = await r.create({ funStoryDM: false });
  assert.equal((await disabled.rpc('dmPropose', { ...step(s), requestId: 'world-dm-request-000002' })).ok, false);
  assert.equal(ok(await disabled.rpc('status')).dm.budget.calls, 1);
});

test('autoplay honours the configured step budget and only an explicit segment resets it', async (t) => {
  const r = await rig(t, { cfg: { funAutoSteps: 1 } });
  let s = await start(r, 'duo-cafe-date');
  s = ok(await r.rpc('move', step(s)));
  s = ok(await r.rpc('choose', choice(s, 'window-seat')));
  s = ok(await r.rpc('move', step(s)));
  s = ok(await r.rpc('choose', choice(s, 'write-note')));
  assert.equal(s.trip.actor, 'fish');
  s = await auto(r, s, 'keep-card');
  let status = ok(await r.rpc('status'));
  assert.equal(status.autonomy.stop, 'steps', '设置项 1 步生效，而不是默认的 20');
  assert.equal(status.autonomy.remaining, 0);
  assert.equal(status.autonomy.limit.steps, 1);
  assert.equal(status.autonomy.canContinue, true);
  assert.equal((await r.rpc('segment', step(status))).ok, false, '开新的一段必须显式确认');
  status = ok(await r.rpc('segment', { ...step(status), confirm: true }));
  assert.equal(status.trip.budget.segment, 1, '段号从 0 开始，第一段结束后是 1');
  assert.equal(status.autonomy.segment, 2, '面板看到的是第 2 段');
  assert.equal(status.trip.budget.steps, 0);
  assert.equal(status.autonomy.stop, undefined);
  assert.equal((await r.rpc('segment', { ...step(status), confirm: true })).ok, false, '没用完不需要新的一段');
  const restarted = await r.create();
  const after = ok(await restarted.rpc('status'));
  assert.equal(after.trip.budget.segment, 1, '段号与重置后的计数都落盘');
  assert.equal(after.trip.budget.steps, 0);
});

test('the owner may substitute for the fish only once it cannot decide, and it is recorded', async (t) => {
  const r = await rig(t);
  let s = await start(r, 'duo-cafe-date');
  s = ok(await r.rpc('move', step(s)));
  s = ok(await r.rpc('choose', choice(s, 'window-seat')));
  s = ok(await r.rpc('move', step(s)));
  s = ok(await r.rpc('choose', choice(s, 'write-note')));
  s = await auto(r, s, 'keep-card');
  s = ok(await r.rpc('choose', choice(s, 'keep-card')));
  s = await auto(r, s);
  assert.equal(s.trip.actor, 'fish');
  assert.equal(s.trip.pending?.actor, 'fish');
  assert.equal((await r.rpc('choose', choice(s, 'share-book'))).ok, false, '鱼还能决定时不许代选');
  r.answer('not-a-real-option');
  for (let attempt = 0; attempt < 2; attempt++) {
    const enabled = ok(await r.rpc('mode', { ...step(s), enabled: true }));
    const decided = await r.rpc('decide', { ...step(enabled), token: enabled.autonomy.token });
    assert.equal(decided.ok, false, '无效选项不算决定');
  }
  const status = ok(await r.rpc('status'));
  assert.equal(status.autonomy.stop, 'attempts');
  assert.equal(status.autonomy.canSubstitute, true);
  assert.equal((await r.rpc('choose', choice(status, 'share-book'))).ok, false, '不加显式代标志仍拒绝');
  const substituted = ok(await r.rpc('choose', { ...choice(status, 'share-book'), substitute: true }));
  assert.equal(substituted.receipt.substituted, true);
  assert.equal(substituted.receipt.actor, 'owner');
  assert.equal(substituted.trip.choices.at(-1).actor, 'owner');
  assert.equal(substituted.trip.choices.at(-1).substituted, true);
});
