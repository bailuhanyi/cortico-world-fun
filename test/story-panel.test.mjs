import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { FunWorld } from '../src/world.js';
import { SAMPLE_STORY, SAMPLE_VENUE } from './fixtures/story-presets.mjs';
const TEST_VENUE = { ...SAMPLE_VENUE, id: 'user-panel-creek' };
const TEST_STORY = { ...SAMPLE_STORY, id: 'user-panel-letter', placeId: TEST_VENUE.id };
import { requestStoryDecision, StoryAutonomy } from '../src/story-panel.js';
import { cleanup } from './tmp.mjs';

const base = 'fun-world-story-';
async function rig(t, cognition) {
  const dir = await mkdtemp(join(process.cwd(), base));
  cleanup(t, dir);
  const clock = { now: Date.parse('2026-11-20T13:00:00+08:00') };
  const create = async () => {
    const world = new FunWorld({ dataDir: dir, now: () => clock.now, random: () => 0 });
    const panel = (id, method, payload = {}) => world.webUi().invoke(id, method, [payload]);
    await world.start({ cognition });
    const rpc = (method, payload) => panel('story', method, payload);
    rpc.installStory = async () => {
      expectOk(await panel('places', 'save', TEST_VENUE));
      expectOk(await panel('stories', 'import', { json: JSON.stringify(TEST_STORY), replace: true }));
      return rpc('status');
    };
    return { world, rpc, panel };
  };
  return { dir, clock, create, ...await create() };
}
const step = (s) => ({ tripId: s.trip.id, stamp: s.trip.stamp });
const withToken = (s) => ({ ...step(s), token: s.autonomy.token });
const startPayload = (s, card = s.catalog.find((item) => item.id === TEST_STORY.id)) => ({ packId: card.id, revision: card.revision, startStamp: s.startStamp });
const choose = (s, optionId) => ({ ...step(s), choiceId: s.trip.pending.id, optionId });
const expectOk = (value) => { assert.equal(value.ok, true, value.error); return value; };

async function arrive(rpc) {
  const installed = expectOk(await rpc.installStory());
  const started = expectOk(await rpc('start', startPayload(installed)));
  assert.equal(started.trip.nextArea, '旧木桥');
  const state = expectOk(await rpc('move', step(started)));
  assert.deepEqual(state.trip.pending.options.map(({ id }) => id), ['follow', 'keep']);
  return state;
}

test('autonomy stops at twenty steps while reporting the exact remaining budget', () => {
  const autonomy = new StoryAutonomy();
  const cognition = { request() {} };
  const now = 1_000_000;
  const trip = { id: 'budget-trip', state: 'active', step: 'move', budget: { steps: 19, calls: 0 } };
  const grant = expectOk(autonomy.enable(trip, cognition, now));
  assert.equal(autonomy.view(trip, cognition, now, grant.token).remaining, 1);
  expectOk(autonomy.take(trip, grant.token, undefined, now));
  trip.budget.steps = 20;
  assert.equal(autonomy.view(trip, cognition, now, grant.token).remaining, 0);
  assert.equal(autonomy.take(trip, grant.token, undefined, now).ok, false);
  assert.equal(autonomy.enable(trip, cognition, now).ok, false);
});

test('the sixth cognition reservation can commit but a seventh request is refused', () => {
  const autonomy = new StoryAutonomy();
  const cognition = { request() {} };
  const now = 1_000_000;
  const trip = { id: 'calls-trip', state: 'active', step: 'choose', stamp: 'a'.repeat(43), budget: { steps: 0, calls: 5 } };
  const grant = expectOk(autonomy.enable(trip, cognition, now));
  const reserved = expectOk(autonomy.reserve(trip, grant.token, now));
  assert.equal(reserved.budget.calls, 6);
  trip.budget = reserved.budget;
  const decision = expectOk(autonomy.finish(trip, grant.token, now, { ok: true, optionId: 'follow', reason: 'A choice' }, reserved.attemptId));
  expectOk(autonomy.take(trip, grant.token, decision.ticket, now));
  trip.stamp = 'b'.repeat(43);
  assert.equal(autonomy.view(trip, cognition, now, grant.token).remainingCalls, 0);
  assert.equal(autonomy.reserve(trip, grant.token, now).ok, false);
  assert.equal(autonomy.enable(trip, cognition, now).ok, false);
});

test('autoplay limits come from settings and name which limit stopped the fish', () => {
  const autonomy = new StoryAutonomy();
  const cognition = { request() {} };
  const now = 1_000_000;
  const trip = { id: 'limits-trip', state: 'active', step: 'choose', stamp: 'c'.repeat(43), budget: { steps: 0, calls: 2 } };
  const spent = autonomy.view(trip, cognition, now, undefined, { steps: 50, calls: 2 });
  assert.equal(spent.limit.steps, 50);
  assert.equal(spent.limit.calls, 2);
  assert.equal(spent.stop, 'calls');
  assert.equal(spent.canContinue, true);
  assert.match(spent.reason, /自己决定了 2 次/);
  assert.equal(autonomy.enable(trip, cognition, now, { steps: 50, calls: 2 }).ok, false);
  const roomy = autonomy.view(trip, cognition, now, undefined, { steps: 50, calls: 6 });
  assert.equal(roomy.stop, undefined);
  assert.equal(roomy.remainingCalls, 4);
});

test('two failed attempts on one step can be handed to the owner, and say so', () => {
  const autonomy = new StoryAutonomy();
  const now = 1_000_000;
  const stamp = 'e'.repeat(43);
  const trip = { id: 'attempts-trip', state: 'active', step: 'choose', stamp, actor: 'fish', budget: { steps: 0, calls: 2, attemptStep: stamp, attempts: 2 } };
  const view = autonomy.view(trip, { request() {} }, now, undefined, { steps: 20, calls: 6 });
  assert.equal(view.stop, 'attempts');
  assert.equal(view.canSubstitute, true);
  assert.equal(view.canContinue, true, '这一段还能再开一段');
  assert.match(view.reason, /两次/);
});

test('a new segment resets only its own counters and stops after three', () => {
  const autonomy = new StoryAutonomy();
  const now = 1_000_000;
  const limits = { steps: 3, calls: 2 };
  const stamp = 'f'.repeat(43);
  const fresh = { steps: 0, calls: 0, attemptStep: '', attempts: 0, segment: 0 };
  assert.equal(autonomy.continueSegment({ id: 'segment-trip', state: 'active', step: 'choose', stamp, budget: fresh }, now, limits).ok, false, '没用完不需要新的一段');
  const spent = { steps: 3, calls: 2, attemptStep: stamp, attempts: 1, segment: 0 };
  const second = expectOk(autonomy.continueSegment({ id: 'segment-trip', state: 'active', step: 'choose', stamp, budget: spent }, now, limits));
  assert.deepEqual(second.budget, { steps: 0, calls: 0, attemptStep: '', attempts: 0, segment: 1 });
  const third = expectOk(autonomy.continueSegment({ id: 'segment-trip', state: 'active', step: 'choose', stamp, budget: { ...spent, segment: 1 } }, now, limits));
  assert.equal(third.budget.segment, 2);
  const refused = autonomy.continueSegment({ id: 'segment-trip', state: 'active', step: 'choose', stamp, budget: { ...spent, segment: 2 } }, now, limits);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /3 段/);
});

test('an active autoplay lease renews while used and expires after idle', () => {
  const autonomy = new StoryAutonomy();
  const cognition = { request() {} };
  const now = 1_000_000;
  const trip = { id: 'lease-trip', state: 'active', step: 'move', budget: { steps: 0, calls: 0 } };
  const grant = expectOk(autonomy.enable(trip, cognition, now));
  expectOk(autonomy.take(trip, grant.token, undefined, now + 40_000));
  expectOk(autonomy.take(trip, grant.token, undefined, now + 80_000));
  assert.equal(autonomy.view(trip, cognition, now + 89_999, grant.token).enabled, true);
  expectOk(autonomy.take(trip, grant.token, undefined, now + 90_000));
  assert.equal(autonomy.view(trip, cognition, now + 90_000 + 44_000, grant.token).enabled, true, '用过一次就往后顺延');
  assert.equal(autonomy.view(trip, cognition, now + 90_000 + 45_000, grant.token).enabled, false, '闲置到期');
  const renewed = expectOk(autonomy.enable(trip, cognition, now + 90_000 + 45_000));
  assert.notEqual(renewed.token, grant.token);
  autonomy.pause(trip.id, grant.token);
  assert.equal(autonomy.view(trip, cognition, now + 90_000 + 45_000, renewed.token).enabled, true);
  assert.equal(autonomy.take(trip, grant.token, undefined, now + 90_000 + 45_000).ok, false);
});

test('explicit import, exact pack, both real branches and independent memories', async (t) => {
  const { dir, rpc, panel } = await rig(t);
  const first = expectOk(await rpc('status'));
  assert.equal(first.sample, undefined);
  assert.deepEqual(first.catalog.filter(({ mode }) => mode !== 'free').map(({ id }) => id), ['foldtide-reply-lite', 'drizzled-list', 'bridge-echo-solo', 'swapped-plaque-riddle']);
  assert.equal(first.autonomy.available, false);
  assert.equal((await rpc('start', { packId: 'missing', revision: 'missing', startStamp: first.startStamp })).ok, false);
  await rpc.installStory();
  const competing = { ...TEST_STORY, id: 'older-creek-pack', title: '同区域的另一篇', nodes: TEST_STORY.nodes.map((n) => ({ ...n, event: '别的故事内容' })) };
  expectOk(await panel('stories', 'import', { json: JSON.stringify(competing) }));
  for (const [option, area, ending] of [['follow', '芦苇滩', 'reeds-ending'], ['keep', '河岸长椅', 'bench-ending']]) {
    const state = await arrive(rpc);
    assert.match(state.trip.pending.event, /玻璃瓶/);
    const outcomes = await Promise.all([rpc('choose', { ...choose(state, option), actor: 'fish' }), rpc('choose', choose(state, option))]);
    for (const outcome of outcomes) expectOk(outcome);
    assert.deepEqual(outcomes[0].receipt, outcomes[1].receipt);
    assert.equal(outcomes.filter(({ replayed }) => replayed).length, 1);
    assert.equal((await rpc('choose', choose(state, option === 'follow' ? 'keep' : 'follow'))).code, 'STORY_STEP_CONFLICT');
    const next = outcomes[0];
    assert.equal(next.trip.nextArea, area);
    assert.equal(next.trip.choices[0].actor, 'owner');
    const ended = expectOk(await rpc('move', step(next)));
    assert.equal(ended.trip.area, area);
    assert.equal(ended.trip.endingNodeId, ending);
    assert.equal(ended.trip.complete, true);
    expectOk(await rpc('close', step(ended)));
  }
  const state = expectOk(await rpc('status'));
  assert.equal(state.memories.length, 2);
  assert.equal(new Set(state.memories.map(({ id }) => id)).size, 2);
  const disk = JSON.parse(await readFile(join(dir, 'fun', 'state.json'), 'utf8'));
  const book = expectOk(await panel('book', 'list'));
  for (const memory of state.memories) {
    assert.ok(book.trips.some(({ id }) => id === memory.id));
    assert.deepEqual(disk.trips.find(({ id }) => id === memory.id).timeline, memory.timeline);
  }
});

test('restart before and after choice, draft resume, and early close preserve only actual facts', async (t) => {
  const rigged = await rig(t);
  const atBridge = await arrive(rigged.rpc);
  const beforeClose = await rigged.create();
  const pending = expectOk(await beforeClose.rpc('status'));
  assert.equal(pending.trip.id, atBridge.trip.id);
  assert.deepEqual(pending.trip.pending, atBridge.trip.pending);
  expectOk(await beforeClose.rpc('choose', choose(pending, 'keep')));
  rigged.clock.now += 24 * 60 * 60 * 1000;
  const afterChoice = await rigged.create();
  const draft = expectOk(await afterChoice.rpc('status'));
  assert.equal(draft.trip.step, 'resume');
  assert.equal(draft.autonomy.enabled, false);
  const resumed = expectOk(await afterChoice.rpc('resume', step(draft)));
  assert.equal(resumed.trip.nextArea, '河岸长椅');
  assert.equal(resumed.trip.choices.length, 1);
  const closed = expectOk(await afterChoice.rpc('close', step(resumed)));
  assert.equal(closed.memories[0].complete, false);
  assert.equal(closed.memories[0].endingNodeId, null);
  assert.equal(closed.memories[0].timeline.filter(({ kind }) => kind === 'event').length, 1);
  assert.equal((await afterChoice.rpc('start', startPayload(draft))).ok, false);
});

test('persisted choice and close receipts replay after restart without duplicating progress', async (t) => {
  const rigged = await rig(t);
  const atChoice = await arrive(rigged.rpc);
  const choicePayload = choose(atChoice, 'follow');
  const chosen = expectOk(await rigged.rpc('choose', choicePayload));
  assert.equal(chosen.receipt.optionId, 'follow');

  // Do not stop the old instance: stop itself saves, so it could mask a non-durable commit.
  const { rpc } = await rigged.create();
  const choiceReplay = expectOk(await rpc('choose', choicePayload));
  assert.equal(choiceReplay.replayed, true);
  assert.deepEqual(choiceReplay.receipt, chosen.receipt);
  assert.deepEqual(choiceReplay.trip, chosen.trip);
  const conflict = await rpc('choose', choose(atChoice, 'keep'));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, 'STORY_STEP_CONFLICT');
  assert.deepEqual(expectOk(await rpc('status')).trip, chosen.trip);

  const ended = expectOk(await rpc('move', step(choiceReplay)));
  const closePayload = step(ended);
  const closed = expectOk(await rpc('close', closePayload));
  assert.equal(closed.trip, null);
  assert.equal(closed.memories.length, 1);
  assert.equal(closed.receipt.memoryId, closed.memories[0].id);

  const restarted = await rigged.create();
  const closeReplay = expectOk(await restarted.rpc('close', closePayload));
  assert.equal(closeReplay.replayed, true);
  assert.deepEqual(closeReplay.receipt, closed.receipt);
  assert.equal(closeReplay.trip, null);
  assert.deepEqual(closeReplay.memories, closed.memories);
});

test('cognition reservations are durable before dispatch and exhaust the same choice across restarts', async (t) => {
  const budgetsAtDispatch = [];
  let stateFile;
  const rigged = await rig(t, {
    async request() {
      const state = JSON.parse(await readFile(stateFile, 'utf8'));
      budgetsAtDispatch.push(state.session.storyRun.budget);
      return { text: '{"optionId":"follow","reason":"找记号。"}' };
    },
  });
  stateFile = rigged.world.stateFile();
  const atChoice = await arrive(rigged.rpc);
  const initialBudget = atChoice.trip.budget;
  let { rpc } = rigged;
  let current = atChoice;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const enabled = expectOk(await rpc('mode', { ...step(current), enabled: true }));
    const decided = expectOk(await rpc('decide', withToken(enabled)));
    const expected = { ...initialBudget, calls: initialBudget.calls + attempt, attemptStep: atChoice.trip.stamp, attempts: attempt };
    assert.deepEqual(budgetsAtDispatch[attempt - 1], expected);
    const submit = { ...withToken(decided), ticket: decided.ticket };

    // An unsubmitted ticket disappears with the old process, but its spent reservation does not.
    ({ rpc } = await rigged.create());
    current = expectOk(await rpc('status', submit));
    assert.equal(current.autonomy.enabled, false);
    assert.equal(current.autonomy.remainingCalls, atChoice.autonomy.remainingCalls - attempt);
    assert.equal(current.autonomy.remaining, atChoice.autonomy.remaining);
    assert.deepEqual(current.trip, { ...atChoice.trip, budget: expected });
    assert.equal((await rpc('auto', submit)).ok, false);
  }
  assert.equal((await rpc('mode', { ...step(current), enabled: true })).ok, false);
  assert.equal(budgetsAtDispatch.length, 2);
  expectOk(await rpc('choose', choose(current, 'keep')));
});

test('corrupted outing state is retained and unavailable to story actions after restart', async (t) => {
  const rigged = await rig(t);
  const atChoice = await arrive(rigged.rpc);
  const stateFile = rigged.world.stateFile();
  const corrupt = '{"trips":[';
  await writeFile(stateFile, corrupt, 'utf8');

  const { world, rpc } = await rigged.create();
  const state = await rpc('status');
  assert.equal(state.ok, false);
  assert.match(state.error, /存档.*未改动/);
  const attempted = await rpc('choose', choose(atChoice, 'keep'));
  assert.equal(attempted.ok, false);
  assert.equal(attempted.error, state.error);
  assert.equal(attempted.receipt, undefined);
  assert.equal(await readFile(stateFile, 'utf8'), corrupt);
  await world.stop();
  assert.equal(await readFile(stateFile, 'utf8'), corrupt);
});

test('failed atomic rename exposes neither advanced progress nor a committed receipt', async (t) => {
  const rigged = await rig(t);
  const atChoice = await arrive(rigged.rpc);
  const payload = choose(atChoice, 'keep');
  const stateFile = rigged.world.stateFile();
  const before = await readFile(stateFile, 'utf8');
  const backup = `${stateFile}.before-failed-rename`;

  // Let the temporary write succeed, then block its rename with a directory at the destination.
  await rename(stateFile, backup);
  await mkdir(stateFile);
  try {
    const attempted = await rigged.rpc('choose', payload);
    assert.equal(attempted.ok, false);
    assert.match(attempted.error, /\brename\b/);
    assert.equal(attempted.receipt, undefined);
    assert.deepEqual(expectOk(await rigged.rpc('status')).trip, atChoice.trip);
  } finally {
    await rmdir(stateFile);
    await rename(backup, stateFile);
  }
  assert.equal(await readFile(stateFile, 'utf8'), before);
  const { rpc: restarted } = await rigged.create();
  assert.deepEqual(expectOk(await restarted('status')).trip, atChoice.trip);

  const committed = expectOk(await rigged.rpc('choose', payload));
  assert.notEqual(committed.replayed, true);
  assert.equal(committed.receipt.optionId, 'keep');
  assert.deepEqual(committed.trip.choices.map(({ option }) => option), ['keep']);
});

test('cognition is not dispatched if its reservation cannot be written', async (t) => {
  let calls = 0;
  const rigged = await rig(t, { async request() {
    calls++;
    return { text: JSON.stringify({ optionId: 'follow', reason: '找记号。' }) };
  } });
  const atChoice = await arrive(rigged.rpc);
  const stateFile = rigged.world.stateFile();
  const enabled = expectOk(await rigged.rpc('mode', { ...step(atChoice), enabled: true }));
  // 开启偏好本身会写一次盘；之后的失败操作不能再写。
  const before = await readFile(stateFile, 'utf8');
  const blocker = `${stateFile}.tmp`;
  await mkdir(blocker);
  try {
    const attempted = await rigged.rpc('decide', withToken(enabled));
    assert.equal(attempted.ok, false);
    assert.match(attempted.error, /state\.json\.tmp/);
    assert.equal(attempted.ticket, undefined);
    assert.equal(calls, 0);
    assert.deepEqual(expectOk(await rigged.rpc('status')).trip, atChoice.trip);
    assert.equal(await readFile(stateFile, 'utf8'), before);
  } finally {
    await rmdir(blocker);
  }

  const retry = expectOk(await rigged.rpc('mode', { ...step(atChoice), enabled: true }));
  const decided = expectOk(await rigged.rpc('decide', withToken(retry)));
  assert.equal(calls, 1);
  assert.equal(decided.trip.budget.calls, atChoice.trip.budget.calls + 1);
  assert.equal(decided.trip.budget.attempts, 1);
});

test('host cognition decisions are scoped, validated and committed exactly once', async (t) => {
  const requests = [];
  const { rpc } = await rig(t, { async request(task) { requests.push(task); return { text: '{"optionId":"follow","reason":"我想找蓝绳。"}' }; } });
  const bridge = await arrive(rpc);
  const enabled = expectOk(await rpc('mode', { ...step(bridge), enabled: true }));
  assert.equal((await rpc('status')).autonomy.enabled, false);
  assert.equal((await rpc('auto', { ...withToken(enabled), ticket: 'forged' })).ok, false);
  const decided = expectOk(await rpc('decide', withToken(enabled)));
  assert.deepEqual(requests[0].tools, []);
  assert.doesNotMatch(requests[0].brief, /便笺|回信一起放回瓶里/);
  assert.equal(decided.trip.choices.length, 0);
  const submit = { ...withToken(decided), ticket: decided.ticket };
  let state = expectOk(await rpc('auto', submit));
  const replay = expectOk(await rpc('auto', submit));
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.receipt, state.receipt);
  assert.equal(state.trip.choices[0].actor, 'fish');
  assert.equal(state.trip.choices[0].reason, '我想找蓝绳。');
  state = expectOk(await rpc('auto', withToken(state)));
  state = expectOk(await rpc('auto', withToken(state)));
  assert.equal(state.memories[0].endingNodeId, 'reeds-ending');
  assert.equal(state.autonomy.enabled, false);
  assert.equal(requests.length, 1);
});

test('turning off during a pending decision invalidates the late reply and allows handoff', async (t) => {
  let finish;
  let entered;
  const requested = new Promise((resolve) => { entered = resolve; });
  const { rpc } = await rig(t, { request() { return new Promise((resolve) => { finish = resolve; entered(); }); } });
  const bridge = await arrive(rpc);
  const enabled = expectOk(await rpc('mode', { ...step(bridge), enabled: true }));
  const deciding = rpc('decide', withToken(enabled));
  await requested;
  const manual = expectOk(await rpc('mode', { ...withToken(enabled), enabled: false }));
  finish({ text: '{"optionId":"follow","reason":"找记号。"}' });
  assert.equal((await deciding).ok, false);
  assert.equal((await rpc('auto', withToken(enabled))).ok, false);
  const continued = expectOk(await rpc('choose', choose(manual, 'keep')));
  assert.deepEqual(continued.trip.choices.map(({ option, actor }) => [option, actor]), [['keep', 'owner']]);
});

test('invalid output and timeout stay at the choice', async (t) => {
  const { rpc } = await rig(t, { async request() { return { text: '{"optionId":"outside","reason":"other"}' }; } });
  const bridge = await arrive(rpc);
  const enabled = expectOk(await rpc('mode', { ...step(bridge), enabled: true }));
  assert.equal((await rpc('decide', withToken(enabled))).ok, false);
  const state = expectOk(await rpc('status', withToken(enabled)));
  assert.equal(state.autonomy.enabled, false);
  assert.equal(state.trip.step, 'choose');
  const timeout = await requestStoryDecision({ request: () => new Promise(() => {}) }, state.trip, 5);
  assert.equal(timeout.ok, false);
  assert.match(timeout.error, /超时/);
});

test('author-created venue and story use stable IDs after the venue is renamed', async (t) => {
  const { rpc, panel } = await rig(t);
  const venue = { id: 'user-author-trial', name: '林边', areas: ['旧木桥', '芦苇滩', '河岸长椅'], hours: { open: '00:00', close: '23:59' } };
  expectOk(await panel('places', 'save', venue));
  const authored = { ...SAMPLE_STORY, id: 'author-trial', placeId: venue.id, title: '林边第一章' };
  expectOk(await panel('stories', 'import', { json: JSON.stringify(authored) }));
  expectOk(await panel('places', 'save', { ...venue, name: '林边小径' }));
  const current = expectOk(await rpc('status'));
  const card = current.catalog.find(({ id }) => id === authored.id);
  assert.equal(card.placeName, '林边小径');
  const started = expectOk(await rpc('start', startPayload(current, card)));
  const atChoice = expectOk(await rpc('move', step(started)));
  assert.equal(atChoice.trip.packId, authored.id);
  assert.match(atChoice.trip.pending.event, /玻璃瓶/);
});
