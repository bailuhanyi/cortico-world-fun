import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DM_CALL_LIMIT,
  DM_ATTEMPT_LIMIT,
  StoryDM,
  addDmUsage,
  dmBudget,
  dmUsage,
  validateDmProposal,
} from '../src/story-dm.js';

function trip(overrides = {}) {
  return {
    id: 'trip-1', state: 'active', step: 'choose', stamp: 'choice-stamp-1',
    title: '测试故事', placeName: '测试地点', area: '窗边', actor: 'owner',
    dmBudget: dmBudget(),
    pending: {
      event: '窗边落下一片叶子。', prompt: '接下来怎么做？',
      options: [{ id: 'keep', label: '收好' }, { id: 'leave', label: '放在原处' }],
    },
    ...overrides,
  };
}
const cognition = (optionId = 'keep', usage = { inputTokens: 12, outputTokens: 7, totalTokens: 19 }) => ({
  request: async () => ({ text: JSON.stringify({ narration: '主持只描述眼前场景。', optionId }), usage }),
});

 test('DM proposals accept only the exact bounded schema and a current option', () => {
  const current = trip();
  assert.deepEqual(validateDmProposal({ text: JSON.stringify({ narration: '可供确认的提议。', optionId: 'keep' }) }, current),
    { ok: true, narration: '可供确认的提议。', optionId: 'keep' });
  for (const text of [
    'not json',
    JSON.stringify({ narration: '未知选项', optionId: 'secret-ending' }),
    JSON.stringify({ narration: '合法提议', optionId: 'keep', result: '直接更改事实' }),
    JSON.stringify({ narration: ' '.repeat(801), optionId: 'keep' }),
  ]) assert.equal(validateDmProposal({ text }, current).ok, false);
  assert.equal(validateDmProposal({ text: 'x'.repeat(2501) }, current).ok, false);
});

test('every request reserves a durable call before dispatch, including failures and retries', async () => {
  const dm = new StoryDM();
  let current = trip();
  let budget = dmBudget();
  for (let index = 0; index < DM_CALL_LIMIT; index++) {
    current = trip({ stamp: `choice-${index}`, dmBudget: budget });
    const reservation = dm.reserve(current, cognition(), true, `request-token-${String(index).padStart(16, '0')}`);
    assert.equal(reservation.ok, true);
    assert.equal(reservation.budget.calls, index + 1);
    assert.equal(reservation.budget.unknownUsageCalls, index + 1);
    budget = reservation.budget;
    const outcome = await dm.generate(cognition('not-an-option'), current, reservation.attempt, async () => {});
    assert.equal(outcome.ok, false);
    assert.equal(dm.finish(current, reservation.attempt, outcome, true).ok, false);
  }
  current = trip({ stamp: 'choice-final', dmBudget: budget });
  assert.equal(dm.reserve(current, cognition(), true, 'request-token-final-0001').ok, false);
  assert.equal(budget.calls, DM_CALL_LIMIT);
  assert.equal(DM_ATTEMPT_LIMIT, 2);
});

test('a structured proposal needs explicit current-actor submission and reports actual usage', async () => {
  const dm = new StoryDM();
  const current = trip();
  const requestId = 'request-token-00000001';
  const reservation = dm.reserve(current, cognition(), true, requestId);
  assert.equal(reservation.ok, true);
  const usageRows = [];
  const outcome = await dm.generate(cognition(), current, reservation.attempt, async (usage) => usageRows.push(usage));
  assert.deepEqual(usageRows, [{ inputTokens: 12, outputTokens: 7, totalTokens: 19 }]);
  assert.equal(dm.finish(current, reservation.attempt, outcome, true).ok, true);
  const proposal = dm.view(current, cognition(), true).proposal;
  assert.equal(proposal.optionId, 'keep');
  assert.equal(dm.validateApply(current, proposal.id).optionId, 'keep');
  assert.equal(dm.validateApply(current, 'unknown-proposal').ok, false);
  assert.deepEqual(dmUsage({ usage: { prompt_tokens: 3, completion_tokens: 2 } }),
    { inputTokens: 3, outputTokens: 2, totalTokens: 5 });
  assert.deepEqual(addDmUsage(reservation.budget, usageRows[0]), {
    ...reservation.budget, knownUsageCalls: 1, unknownUsageCalls: 0, inputTokens: 12, outputTokens: 7, totalTokens: 19,
  });

  const fishDM = new StoryDM();
  const fishTrip = trip({ actor: 'fish' });
  const fishReservation = fishDM.reserve(fishTrip, cognition(), true, 'request-token-00000002');
  const fishOutcome = await fishDM.generate(cognition(), fishTrip, fishReservation.attempt, async () => {});
  fishDM.finish(fishTrip, fishReservation.attempt, fishOutcome, true);
  const fishProposal = fishDM.view(fishTrip, cognition(), true).proposal;
  assert.equal(fishDM.validateApply(fishTrip, fishProposal.id).ok, false);
});

test('cancellation invalidates late proposals while still accounting for reported usage', async () => {
  const dm = new StoryDM();
  const current = trip();
  let resolveRequest;
  const provider = { request: () => new Promise((resolve) => { resolveRequest = resolve; }) };
  const reservation = dm.reserve(current, provider, true, 'request-token-00000003');
  let recordedUsage;
  const pending = dm.generate(provider, current, reservation.attempt, async (usage) => { recordedUsage = usage; }, 1000);
  dm.cancel();
  const cancelled = await pending;
  assert.equal(cancelled.ok, false);
  assert.match(cancelled.error, /取消/);
  resolveRequest({ text: JSON.stringify({ narration: '迟到的提议。', optionId: 'keep' }), usage: { inputTokens: 2, outputTokens: 1 } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(recordedUsage, { inputTokens: 2, outputTokens: 1, totalTokens: 3 });
  assert.equal(dm.finish(current, reservation.attempt, { ok: true, narration: '迟到', optionId: 'keep' }, true).ok, false);
});

test('timeout stays local, leaves the failed request counted, and keeps button play available', async () => {
  const dm = new StoryDM();
  const current = trip();
  const reservation = dm.reserve(current, { request: async () => new Promise(() => {}) }, true, 'request-token-00000004');
  const result = await dm.generate({ request: async () => new Promise(() => {}) }, current, reservation.attempt, async () => {}, 2);
  assert.equal(result.ok, false);
  assert.match(result.error, /超时/);
  assert.equal(reservation.budget.calls, 1);
  assert.equal(dm.finish(current, reservation.attempt, result, true).ok, false);
});

test('host cognition retains its request contract and arbitrary errors stay private', async () => {
  const dm = new StoryDM();
  const current = trip();
  let captured;
  const provider = { request: async (request) => {
    captured = request;
    throw new Error('https://private-api.invalid key-secret private-body');
  } };
  const reservation = dm.reserve(current, provider, true, 'request-token-00000005');
  const result = await dm.generate(provider, current, reservation.attempt, async () => {});
  assert.deepEqual(Object.keys(captured).sort(), ['brief', 'hint', 'tools']);
  assert.deepEqual(captured.tools, []);
  assert.deepEqual(captured.hint, { rounds: 1 });
  assert.match(captured.brief, /optionId/);
  assert.equal(result.ok, false);
  assert.equal(result.error.includes('private'), false);
  assert.equal(result.error.includes('key-secret'), false);
});

test('direct adapter cancellation receives AbortSignal and rejects a late proposal', async () => {
  const dm = new StoryDM();
  const current = trip();
  let signal;
  let resolveRequest;
  const provider = { storyDmDirect: true, request: (request) => {
    signal = request.signal;
    return new Promise((resolve) => { resolveRequest = resolve; });
  } };
  const reservation = dm.reserve(current, provider, true, 'request-token-00000006');
  const pending = dm.generate(provider, current, reservation.attempt, async () => {});
  assert.equal(signal.aborted, false);
  dm.cancel();
  assert.equal(signal.aborted, true);
  assert.match((await pending).error, /取消/);
  resolveRequest({ text: JSON.stringify({ narration: '迟到提议', optionId: 'keep' }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(dm.finish(current, reservation.attempt, { ok: true, narration: '迟到', optionId: 'keep' }, true).ok, false);
  assert.equal(dm.view(current, provider, true).proposal, null);
});

test('direct adapter timeout aborts its request and keeps the durable charge', async () => {
  const dm = new StoryDM();
  const current = trip();
  let signal;
  const provider = { storyDmDirect: true, request: (request) => {
    signal = request.signal;
    return new Promise(() => {});
  } };
  const reservation = dm.reserve(current, provider, true, 'request-token-00000007');
  const result = await dm.generate(provider, current, reservation.attempt, async () => {}, 2);
  assert.match(result.error, /超时/);
  assert.equal(signal.aborted, true);
  assert.equal(reservation.budget.calls, 1);
  assert.equal(reservation.budget.attempts, 1);
});
