import { createHash } from 'node:crypto';

/** 默认值；用户可以在设置里改（`worlds.fun.funAutoSteps` / `funAutoCalls`）。 */
export const AUTO_STEPS = 20;
export const AUTO_CALLS = 6;
/** 硬上限：设置项最多只能到这儿，存档里的计数也按它收口。 */
export const AUTO_STEPS_MAX = 200;
export const AUTO_CALLS_MAX = 120;
/** 一趟最多几段；段与段之间必须由用户显式点「再来一段」，不自动续。 */
export const AUTO_SEGMENTS = 3;
const MAX_RECEIPTS = 512;
const RECEIPT_MS = 7 * 24 * 60 * 60 * 1000;
const DIGEST = /^[\w-]{43}$/;
export const hashStoryValue = (data) => createHash('sha256').update(JSON.stringify(data)).digest('base64url');
const counter = (value, max) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : 0;
const clampInt = (value, min, max, fallback) => Number.isSafeInteger(value) ? Math.min(Math.max(value, min), max) : fallback;

/**
 * 这一趟的自主游玩上限。
 *
 * 显式传进来的 `limits` 永远优先（测试与设置项都走这里）；设置项缺失或类型不对时
 * 回落到默认的 20 步 / 6 次，不会因为一个坏配置变成「无限」。
 */
export function autoLimits(raw) {
  return {
    steps: clampInt(raw?.steps ?? raw?.funAutoSteps, 1, AUTO_STEPS_MAX, AUTO_STEPS),
    calls: clampInt(raw?.calls ?? raw?.funAutoCalls, 1, AUTO_CALLS_MAX, AUTO_CALLS),
  };
}

export function storyBudget(raw) {
  return {
    steps: counter(raw?.steps, AUTO_STEPS_MAX), calls: counter(raw?.calls, AUTO_CALLS_MAX),
    attemptStep: DIGEST.test(raw?.attemptStep ?? '') ? raw.attemptStep : '',
    attempts: counter(raw?.attempts, 2),
    segment: counter(raw?.segment, AUTO_SEGMENTS - 1),
  };
}

/** 这一趟现在还差什么才算「走不动」。返回 null 表示没撞上限。 */
export function budgetStop(budget, limits, { step, stamp } = {}) {
  const spent = storyBudget(budget);
  if (spent.steps >= limits.steps) return 'steps';
  if (step === 'choose' && spent.calls >= limits.calls) return 'calls';
  if (step === 'choose' && stamp && spent.attemptStep === stamp && spent.attempts >= 2) return 'attempts';
  return null;
}

export function normalizeStoryReceipts(raw, now) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && DIGEST.test(r.key) && DIGEST.test(r.digest)
    && Number.isSafeInteger(r.at) && r.at > 0 && (!now || now - r.at <= RECEIPT_MS)
    && ['start', 'move', 'choose', 'resume', 'close', 'say', 'redo'].includes(r.action)
    && ['owner', 'fish', 'joint'].includes(r.actor)
    && typeof r.runId === 'string' && r.runId.length <= 100)
    .slice(-MAX_RECEIPTS)
    .map(({ key, digest, at, action, actor, runId, stepId, stamp, revision, area, optionId, memoryId, votes, substituted,
      turn, recorded, report, rewound, unstructured, reply }) => ({
      key, digest, at, action, actor, runId,
      stepId: String(stepId ?? '').slice(0, 43), revision: String(revision ?? '').slice(0, 60),
      ...(DIGEST.test(stamp ?? '') ? { stamp } : {}),
      ...(Number.isSafeInteger(turn) && turn >= 0 ? { turn: Math.min(turn, 600) } : {}),
      ...(Number.isSafeInteger(recorded) && recorded >= 0 ? { recorded: Math.min(recorded, 20) } : {}),
      ...(typeof report === 'string' ? { report: report.replace(/[\r\n]+/g, ' ').slice(0, 400) } : {}),
      ...(rewound === true ? { rewound: true } : {}),
      ...(['say', 'redo'].includes(action) && typeof reply === 'string' && reply.length <= 8192 ? { reply } : {}),
      ...(unstructured === true ? { unstructured: true } : {}),
      ...(typeof area === 'string' ? { area: area.slice(0, 80) } : {}),
      ...(typeof optionId === 'string' ? { optionId: optionId.slice(0, 60) } : {}),
      ...(substituted === true ? { substituted: true } : {}),
      ...(typeof memoryId === 'string' ? { memoryId: memoryId.slice(0, 100) } : {}),
      ...(actor === 'joint' && Array.isArray(votes) ? { votes: votes.filter((vote) => ['owner', 'fish'].includes(vote.actor) && typeof vote.option === 'string').slice(0, 2).map((vote) => ({ actor: vote.actor, option: vote.option.slice(0, 24) })) } : {}),
    }));
}

const normalizeSay = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 200) : '');

export function storyRequestKey(method, payload) {
  if (method === 'start') {
    if (!DIGEST.test(payload.startStamp ?? '') || typeof payload.packId !== 'string' || typeof payload.revision !== 'string'
      || payload.packId.length > 24 || payload.revision.length > 60) return null;
    return { key: hashStoryValue(['start', payload.startStamp]), digest: hashStoryValue(['start', payload.packId, payload.revision, payload.party ?? []]) };
  }
  if (!['move', 'choose', 'resume', 'close', 'auto', 'say'].includes(method)
    || typeof payload.tripId !== 'string' || payload.tripId.length > 100 || !DIGEST.test(payload.stamp ?? '')) return null;
  if (method === 'choose' && (typeof payload.choiceId !== 'string' || payload.choiceId.length > 100
    || typeof payload.optionId !== 'string' || payload.optionId.length > 60)) return null;
  if (method === 'auto' && (typeof payload.token !== 'string' || payload.token.length > 40
    || (payload.ticket !== undefined && (typeof payload.ticket !== 'string' || payload.ticket.length > 40)))) return null;
  if (method === 'say' && (typeof payload.say !== 'string' || !normalizeSay(payload.say))) return null;
  return {
    key: hashStoryValue([payload.tripId, payload.stamp]),
    digest: hashStoryValue(method === 'choose' ? [method, payload.choiceId, payload.optionId]
      : method === 'auto' ? [method, payload.token, payload.ticket]
        : method === 'say' ? [method, normalizeSay(payload.say), typeof payload.from === 'string' ? payload.from.slice(0, 40) : '']
          : [method]),
  };
}

/** Free-story input identity: the redo counter prevents a replay after rewind colliding with its old receipt. */
export function storyFreeRequestKey(tripId, turn, redo, input) {
  if (typeof tripId !== 'string' || tripId.length > 100 || !Number.isSafeInteger(turn) || turn < 0
    || !Number.isSafeInteger(redo) || redo < 0) return null;
  const digest = hashStoryValue(input);
  return { key: hashStoryValue([tripId, turn, redo, digest]), digest };
}

export function publicStoryReceipt(row) {
  const { key: _key, digest: _digest, ...receipt } = normalizeStoryReceipts([row])[0];
  return receipt;
}
