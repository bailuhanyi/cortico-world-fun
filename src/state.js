/**
 * 出游状态的纯逻辑：一趟从进门到回家。
 *
 * 不碰文件、不碰定时器、不碰宿主，便于单测；World 只负责把结果变成工具回执。
 *
 * 状态形状（落 `<dataDir>/fun/state.json`）：
 * {
 *   day: '2026-11-15',            // 本地日期
 *   session: null | {             // 正在逛的这一趟；null = 没在逛
 *     id, placeId, placeName, scene, outfit,
 *     enteredAt, lastAt,          // ms
 *     visited: [{ area, note, at }],
 *     souvenirs: [string],
 *     photos: [string],
 *     events: [string],
 *   },
 *   draft: null,                  // 跨天超时、等待处理的行程
 *   trips: [{ placeId, placeName, scene, outfit, enteredAt, leftAt, visited, souvenirs, photos, events }],
 * }
 *
 * `trips` 只留最近若干条，给 `fun_view` 看；**不回家不落 trips**——
 * 中途关掉应用等于这趟没逛完，不该在纪念册里出现半趟。
 */

import { VENUES, hoursState, pickSome } from './venues.js';
import { normalizeWishes } from './wishes.js';
import { normalizeStoryProgress } from './story-packs.js';
import { normalizeExploration, recordExploration } from './exploration.js';
import { normalizeTimeline, normalizeRoute, normalizeRoutes, addMoment, timelineFor } from './journeys.js';
import { normalizeStoryCanon } from './story-canon.js';
import { dmBudget } from './story-dm.js';
import { normalizeStoryReceipts, storyBudget, AUTO_SEGMENTS } from './story-reliability.js';
import { FREE_TURN_CAP } from './story-free.js';

/** 纪念册最多留几趟。 */
export const MAX_TRIPS = 40;

const dayFormatterCache = new Map();

function dayFormatter(tz) {
  let f = dayFormatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    dayFormatterCache.set(tz, f);
  }
  return f;
}

const hmFormatterCache = new Map();

function hmFormatter(tz) {
  let f = hmFormatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    hmFormatterCache.set(tz, f);
  }
  return f;
}

/** 本地日期 YYYY-MM-DD。 */
export function dayIn(tz, nowMs) {
  return dayFormatter(tz).format(new Date(nowMs));
}

/** 本地时刻 HH:MM。 */
export function hmIn(tz, nowMs) {
  return hmFormatter(tz).format(new Date(nowMs));
}

/** 本地当天第几分钟（0–1439）。 */
export function minutesIn(tz, nowMs) {
  const [h, m] = hmIn(tz, nowMs).split(':').map(Number);
  return h * 60 + m;
}

/** 当天的新状态。 */
export function newState(day) {
  return { day, session: null, draft: null, route: null, routes: [], routeSeq: 0, exploration: [], storyCanon: [], trips: [], collection: [], keepsakeTrips: [], tripSeq: 0, wishes: [], trash: [] };
}

export function newTripId(placeId, enteredAt, leftAt) {
  return `${text(placeId, 40)}-${Number(enteredAt) || 0}-${Number(leftAt) || 0}`;
}

function seedCollection(trips, timezone = 'Asia/Shanghai') {
  const entries = [];
  for (const trip of Array.isArray(trips) ? trips : []) {
    if (trip?.storyRun?.canonical === false) continue;
    const placeId = text(trip?.placeId, 40);
    const placeName = text(trip?.placeName, 40) || placeId;
    const day = tripDay(trip, timezone);
    for (const name of new Set(textList(trip?.souvenirs, 12, 40))) {
      entries.push({ placeId, placeName, name, day, at: Number(trip.leftAt) || 0, tripId: text(trip.id, 100) });
    }
  }
  return mergeCollection([], entries);
}

function mergeKeptTrips(kept, recent) {
  const map = new Map();
  for (const raw of [...(Array.isArray(kept) ? kept : []), ...(Array.isArray(recent) ? recent.filter((t) => t?.favorite) : [])]) {
    const key = stableTripId(raw);
    const trip = normalizeTrip(raw, key);
    if (trip) map.set(trip.id, trip);
  }
  return [...map.values()].sort((a, b) => b.leftAt - a.leftAt);
}

function stableTripId(raw) {
  const id = text(raw?.id, 100);
  return id || newTripId(raw?.placeId, raw?.enteredAt, raw?.leftAt);
}

function mergeCollection(existing, additions) {
  const map = new Map();
  for (const item of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(additions) ? additions : [])]) {
    const placeId = text(item?.placeId, 40);
    const name = text(item?.name, 40);
    if (!placeId || !name) continue;
    const key = `${placeId}::${name}`;
    const day = text(item.day, 10);
    const at = Number(item.at) || 0;
    const cur = map.get(key);
    if (!cur) map.set(key, { key, placeId, placeName: text(item.placeName, 40) || placeId, name, firstDay: text(item.firstDay, 10) || day, lastDay: text(item.lastDay, 10) || day, firstAt: Number(item.firstAt) || at, lastAt: Number(item.lastAt) || at, times: Math.max(1, Number(item.times) || 1), tripIds: Array.isArray(item.tripIds) ? textList(item.tripIds, 100, 100) : (item.tripId ? [text(item.tripId, 100)] : []) });
    else {
      cur.times += Math.max(1, Number(item.times) || 1);
      if (Array.isArray(item.tripIds)) for (const tripId of item.tripIds) if (!cur.tripIds.includes(tripId)) cur.tripIds.push(text(tripId, 100));
      if (day && (!cur.firstDay || day < cur.firstDay)) { cur.firstDay = day; cur.firstAt = at; }
      if (day && (!cur.lastDay || day > cur.lastDay)) { cur.lastDay = day; cur.lastAt = at; }
      if (item.tripId && !cur.tripIds.includes(item.tripId)) cur.tripIds.push(text(item.tripId, 100));
    }
  }
  return [...map.values()].sort((a, b) => b.lastAt - a.lastAt || a.name.localeCompare(b.name));
}

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** 本地日期形状：`YYYY-MM-DD`。存在 trip 上，读回来时校验形状而不是重新换算。 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function textList(v, maxItems, maxLen) {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => text(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

function normalizeVisited(v) {
  const arr = Array.isArray(v) ? v : [];
  const out = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const area = text(it.area, 40);
    if (!area) continue;
    out.push({
      area,
      note: text(it.note, 120),
      at: Number.isFinite(Number(it.at)) ? Number(it.at) : 0,
    });
    if (out.length >= 30) break;
  }
  return out;
}

function normalizeAte(v) {
  const arr = Array.isArray(v) ? v : [];
  const out = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const item = text(it.item, 30);
    if (!item) continue;
    out.push({
      item,
      verb: text(it.verb, 4) || '吃',
      at: Number.isFinite(Number(it.at)) ? Number(it.at) : 0,
    });
    if (out.length >= 20) break;
  }
  return out;
}

function normalizeChoices(v) {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => ({
    event: text(x?.event, 120), option: text(x?.option, 60), result: text(x?.result, 160), at: Number(x?.at) || 0,
    ...(['owner', 'fish', 'joint'].includes(x?.actor) ? { actor: x.actor, label: text(x.label, 100) } : {}),
    ...(x?.actor === 'fish' && x.reason ? { reason: text(x.reason, 120) } : {}),
    ...(x?.substituted === true ? { substituted: true } : {}),
    ...(x?.actor === 'joint' && Array.isArray(x.votes) ? { votes: x.votes.filter((vote) => ['owner', 'fish'].includes(vote.actor) && typeof vote.option === 'string').slice(0, 2).map((vote) => ({ actor: vote.actor, option: text(vote.option, 24) })) } : {}),
  })).filter((x) => x.event && x.option).slice(0, 20);
}

const FREE_NAME_RE = /^[a-z0-9_-]{1,24}$/;

/** 自由模式那一趟的持久状态；槽位合法性在读取时按场景包再裁一次。 */
function normalizeFreeRun(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const turnCeiling = FREE_TURN_CAP * AUTO_SEGMENTS;
  const turn = Number.isSafeInteger(raw.turn) && raw.turn >= 0 ? Math.min(raw.turn, turnCeiling) : 0;
  const turnBase = Number.isSafeInteger(raw.turnBase) && raw.turnBase >= 0 ? Math.min(raw.turnBase, turnCeiling) : 0;
  const segment = Number.isSafeInteger(raw.segment) && raw.segment >= 0 ? Math.min(raw.segment, AUTO_SEGMENTS - 1) : 0;
  const facts = {};
  if (raw.facts && typeof raw.facts === 'object' && !Array.isArray(raw.facts)) {
    for (const [id, value] of Object.entries(raw.facts).slice(0, 24)) {
      if (FREE_NAME_RE.test(id) && typeof value === 'string') facts[id] = text(value, 200);
    }
  }
  const flags = {};
  if (raw.flags && typeof raw.flags === 'object' && !Array.isArray(raw.flags)) {
    for (const [id, value] of Object.entries(raw.flags).slice(0, 24)) {
      if (FREE_NAME_RE.test(id) && typeof value === 'boolean') flags[id] = value;
    }
  }
  const counters = {};
  if (raw.counters && typeof raw.counters === 'object' && !Array.isArray(raw.counters)) {
    for (const [id, value] of Object.entries(raw.counters).slice(0, 24)) {
      if (FREE_NAME_RE.test(id) && Number.isSafeInteger(value)) counters[id] = Math.min(100, Math.max(0, value));
    }
  }
  const log = (Array.isArray(raw.log) ? raw.log : []).slice(-40).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const narration = text(entry.narration, 900);
    if (!narration) return [];
    return [{ turn: Number.isSafeInteger(entry.turn) && entry.turn >= 0 ? entry.turn : 0, from: text(entry.from, 40),
      say: text(entry.say, 200), narration, at: Number.isFinite(Number(entry.at)) ? Number(entry.at) : 0 }];
  });
  return { turn, turnBase, segment, facts, flags, counters, summary: text(raw.summary, 200), log,
    ended: typeof raw.ended === 'string' && FREE_NAME_RE.test(raw.ended) ? raw.ended : null };
}

function normalizeStoryRun(raw) {
  const packId = text(raw?.packId, 24);
  const revision = text(raw?.revision, 60);
  const title = text(raw?.title, 80);
  if (!packId || !revision || !title) return {};
  const seq = Number.isSafeInteger(raw.seq) && raw.seq >= 0 ? raw.seq : 0;
  const checkpoints = (Array.isArray(raw.checkpoints) ? raw.checkpoints : []).slice(-32).map((item) => {
    const id = text(item?.id, 80); const nodeId = text(item?.nodeId, 24);
    if (!id || !nodeId) return null;
    return { id, nodeId, packId: text(item?.packId, 24) || packId, runId: text(item?.runId, 100) || null, revision: text(item?.revision, 60) || revision,
      resourceVersion: text(item?.resourceVersion, 80) || 'legacy-unknown',
      seq: Number.isSafeInteger(item?.seq) && item.seq >= 0 ? item.seq : 0,
      budget: storyBudget(item?.budget),
      progress: normalizeStoryProgress(item?.progress), events: textList(item?.events, 16, 120),
      visited: normalizeVisited(item?.visited), choices: normalizeChoices(item?.choices), timeline: normalizeTimeline(item?.timeline),
      ...(normalizeFreeRun(item?.free) ? { free: normalizeFreeRun(item?.free) } : {}),
      pendingChoice: normalizePendingChoice(item?.pendingChoice), at: Number.isFinite(Number(item?.at)) ? Number(item.at) : 0 };
  }).filter(Boolean);
  const free = normalizeFreeRun(raw.free);
  return { storyRun: { packId, revision, title, endingNodeId: text(raw.endingNodeId, 24) || null, seq, budget: storyBudget(raw.budget), dmBudget: dmBudget(raw.dmBudget),
    ...(free ? { free } : {}),
    autoplay: raw.autoplay === true,
    freeCalls: Number.isSafeInteger(raw.freeCalls) && raw.freeCalls >= 0 ? Math.min(raw.freeCalls, 1000) : 0,
    forkToken: typeof raw.forkToken === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(raw.forkToken) ? raw.forkToken : null,
    participation: raw.participation === 'duo' ? 'duo' : 'solo',
    runId: text(raw.runId, 100) || null, sourceRunId: text(raw.sourceRunId, 100) || null, sourceMemoryId: text(raw.sourceMemoryId, 100) || null,
    sourceCheckpointId: text(raw.sourceCheckpointId, 80) || null,
    canonical: raw.canonical !== false, resourceVersion: text(raw.resourceVersion, 80) || 'legacy-unknown', checkpoints } };
}

function normalizePendingChoice(v) {
  if (!v || typeof v !== 'object') return null;
  const options = Array.isArray(v.options) ? v.options.map((x) => ({ id: text(x?.id, 50), label: text(x?.label, 100), result: text(x?.result, 160) })).filter((x) => x.id && x.label).slice(0, 4) : [];
  const id = text(v.id, 100); const event = text(v.event, 120);
  if (!id || !event || !options.length) return null;
  const votes = {};
  for (const actor of ['owner', 'fish']) if (typeof v.votes?.[actor] === 'string' && options.some((option) => option.id === v.votes[actor])) votes[actor] = v.votes[actor];
  const actor = ['owner', 'fish', 'joint'].includes(v.actor) ? v.actor : null;
  const jointResolution = ['require-agreement', 'owner-final', 'fish-final'].includes(v.jointResolution) ? v.jointResolution : null;
  return { id, event, area: text(v.area, 40), prompt: text(v.prompt, 160), options,
    ...(actor ? { actor } : {}), ...(jointResolution ? { jointResolution } : {}), ...(Object.keys(votes).length ? { votes } : {}) };
}

function normalizeTrip(raw, fallbackId = '') {
  if (!raw || typeof raw !== 'object') return null;
  const placeId = text(raw.placeId, 40);
  if (!placeId) return null;
  return {
    id: fallbackId || text(raw.id, 100) || newTripId(placeId, raw.enteredAt, raw.leftAt),
    placeId,
    sequence: Number.isSafeInteger(raw.sequence) && raw.sequence > 0 ? raw.sequence : 0,
    placeName: text(raw.placeName, 40) || placeId,
    scene: text(raw.scene, 40),
    outfit: text(raw.outfit, 40),
    // 跟谁一起去的：只进回执不留档的话，「上一次是和阿岚去的」这种话永远说不出来。
    company: text(raw.company, 40),
    enteredAt: Number.isFinite(Number(raw.enteredAt)) ? Number(raw.enteredAt) : 0,
    leftAt: Number.isFinite(Number(raw.leftAt)) ? Number(raw.leftAt) : 0,
    pausedMs: Number.isFinite(raw.pausedMs) ? Math.max(0, raw.pausedMs) : 0,
    routeId: text(raw.routeId, 100),
    routeOrder: [1, 2].includes(raw.routeOrder) ? raw.routeOrder : 0,
    phases: [...new Set(textList(raw.phases, 20, 40))],
    branchSeen: [...new Set(textList(raw.branchSeen, 40, 100))],
    storyProgress: normalizeStoryProgress(raw.storyProgress),
    ...normalizeStoryRun(raw.storyRun),
    timelineTruncated: raw.timelineTruncated === true || (Array.isArray(raw.timeline) && raw.timeline.length > 240),
    timeline: normalizeTimeline(raw.timeline?.length ? raw.timeline : timelineFor({ ...raw, placeName: text(raw.placeName, 40) || placeId })),
    /**
     * 回家那天的**本地**日期（YYYY-MM-DD）。
     *
     * 为什么单存一个：`leftAt` 是毫秒，换算成「哪天」需要时区。老代码用
     * `toISOString().slice(0,10)` 取 UTC 日期，于是上海时间早上 8 点前收的摊
     * 会被算成前一天——「同一天早上去过两次」会被说成「上一次是昨天」。
     * 回家时由 World 按它自己的时区算好存下来，读的人就不用再猜了。
     */
    leftDay: DAY_RE.test(text(raw.leftDay, 10)) ? text(raw.leftDay, 10) : '',
    /** 回家时说的那一句（和 `visited[].note` 不是一回事：那是逛某处时记的）。 */
    note: text(raw.note, 120),
    favorite: raw.favorite === true,
    visited: normalizeVisited(raw.visited),
    souvenirs: textList(raw.souvenirs, 12, 40),
    photos: textList(raw.photos, 12, 60),
    ate: normalizeAte(raw.ate),
    events: textList(raw.events, 16, 120),
    choices: normalizeChoices(raw.choices),
  };
}

function normalizeSession(raw) {
  const trip = normalizeTrip(raw);
  if (!trip) return null;
  return {
    ...trip,
    id: text(raw.id, 100) || `${trip.placeId}-${trip.enteredAt}`,
    lastAt: Number.isFinite(Number(raw.lastAt)) ? Number(raw.lastAt) : trip.enteredAt,
    pendingChoice: normalizePendingChoice(raw.pendingChoice),
  };
}

/** 只读区分正在逛和跨天超时的未完行程。 */
export function outingStatus(state, day, nowMs, ttlMin, timezone = 'Asia/Shanghai') {
  const session = state?.session ?? null;
  const lastAt = session?.lastAt || session?.enteredAt;
  const expired = session && !sessionAlive(session, nowMs, ttlMin)
    && (lastAt ? dayIn(timezone, lastAt) : state.day) !== day;
  return { session: expired ? null : session, draft: expired ? session : (state?.draft ?? null) };
}

/** 兼容旧状态，跨天超时只暂停行程，仍保留已发生的事。 */
/** 回收站最多留几趟；更早的自动彻底删掉。 */
export const MAX_TRASH_TRIPS = 30;

/**
 * 回收站：删除的行程先放这里，可恢复，也可彻底删除。
 * 只认能解析的行程；同一条不重复放。
 */
function normalizeTrash(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of raw.slice(-MAX_TRASH_TRIPS * 2)) {
    const trip = normalizeTrip(entry?.trip);
    if (!trip || seen.has(trip.id)) continue;
    seen.add(trip.id);
    out.push({
      id: text(entry?.id, 100) || `trash-${trip.id}`,
      from: entry?.from === 'keepsakeTrips' ? 'keepsakeTrips' : 'trips',
      deletedAt: Number.isFinite(Number(entry?.deletedAt)) ? Number(entry.deletedAt) : 0,
      trip,
    });
  }
  return out.slice(-MAX_TRASH_TRIPS);
}

export function normalizeState(raw, day, nowMs = 0, ttlMin = DEFAULT_TTL_MIN, timezone = 'Asia/Shanghai') {
  if (!raw || typeof raw !== 'object') return newState(day);
  const { session, draft } = outingStatus({
    day: raw.day, session: normalizeSession(raw.session), draft: normalizeSession(raw.draft),
  }, day, nowMs, ttlMin, timezone);
  const rawTrips = Array.isArray(raw.trips) ? raw.trips : [];
  const used = new Set();
  const trips = rawTrips.map((t, i) => {
    const base = stableTripId(t);
    const id = used.has(base) ? `${base}-legacy-${i}` : base;
    used.add(base);
    const normalized = normalizeTrip(t, id);
    if (normalized && !t?.id) normalized.id = id;
    return normalized;
  }).filter(Boolean).slice(0, MAX_TRIPS);
  const routes = normalizeRoutes([...(Array.isArray(raw.routes) ? raw.routes : []), raw.route]);
  const candidate = normalizeRoute(raw.route);
  const route = raw.route === undefined
    ? [...routes].reverse().find((r) => ['planned', 'active', 'between'].includes(r.status)) ?? null
    : candidate && ['planned', 'active', 'between'].includes(candidate.status) ? candidate : null;
  const exploration = normalizeExploration(raw.exploration, [...trips, ...mergeKeptTrips(raw.keepsakeTrips, trips)], timezone);
  const priorTripSeq = Number.isInteger(raw.tripSeq) && raw.tripSeq >= 0
    ? raw.tripSeq
    : trips.length + (Array.isArray(raw.keepsakeTrips) ? raw.keepsakeTrips.length : 0);
  const nextTripSeq = Math.max(priorTripSeq, exploration.reduce((n, row) => Math.max(n, row.lastSequence || 0), 0), trips.reduce((n, trip) => Math.max(n, trip.sequence || 0), 0));
  return {
    day,
    session,
    draft,
    trips,
    collection: Array.isArray(raw.collection) ? mergeCollection(raw.collection, []) : seedCollection(trips, timezone),
    keepsakeTrips: mergeKeptTrips(raw.keepsakeTrips, trips),
    tripSeq: nextTripSeq,
    routeSeq: Math.max(0, Math.floor(Number(raw.routeSeq) || 0)),
    route,
    routes: routes.filter((r) => r.id === route?.id || r.id === session?.routeId || r.id === draft?.routeId || [...trips, ...mergeKeptTrips(raw.keepsakeTrips, trips)].some((t) => t.routeId === r.id)),
    exploration,
    storyCanon: normalizeStoryCanon(raw.storyCanon, [...trips, ...mergeKeptTrips(raw.keepsakeTrips, trips)]),
    wishes: normalizeWishes(raw.wishes),
    trash: normalizeTrash(raw.trash),
    ...(raw.storyReceipts ? { storyReceipts: normalizeStoryReceipts(raw.storyReceipts, nowMs) } : {}),
  };
}

/** 逗留时间不包含上次活动到恢复之间的暂停。 */
export function outingMinutes(outing, endAt) {
  return Math.max(0, Math.round((endAt - outing.enteredAt - (outing.pausedMs ?? 0)) / 60000));
}

/** 和 config.js 的 `funSessionTTLMin` 默认值保持一致（纯函数不 import 配置，防循环依赖）。 */
export const DEFAULT_TTL_MIN = 90;

/**
 * 这一趟挂太久没有（跨天时用来判「还认不认昨天那一趟」）。
 *
 * 只看「上次动过之后过了多久」，不看日历。**不传 now 时返回 true**
 * （没有时间可判时宁可留着——丢错了她会「你还没进门呢」，留错了顶多提醒一句回家）。
 */
export function sessionAlive(session, nowMs, ttlMin = DEFAULT_TTL_MIN) {
  if (!session) return false;
  const now = Number(nowMs);
  const last = Number(session.lastAt ?? session.enteredAt);
  if (!Number.isFinite(now) || now <= 0) return true;
  if (!Number.isFinite(last) || last <= 0) return true;
  // 时钟往回调过（last 在未来）：当作还活着，别因为对钟就把人踢出去。
  if (last > now) return true;
  const ttl = Math.max(1, Math.round(Number(ttlMin) || DEFAULT_TTL_MIN));
  return now - last <= ttl * 60000;
}

/**
 * 进门：把一处场所变成一趟 session。
 * 已经在逛就**不覆盖**——先让她 `fun_home` 回家，或者她自己说换地方。
 *
 * `company` 是「跟谁一起去的」，进 session 也进纪念册：只写进当次回执的话，
 * 「上一次是和阿岚去的」这种话以后永远说不出来。
 *
 * 返回 { session, already } —— already 为 true 表示原来就有一趟没结束。
 */
export function enterVenue(state, venue, nowMs, random = Math.random, company = '') {
  if (state.session) return { session: state.session, already: true };
  const session = {
    id: `${venue.id}-${nowMs}`,
    placeId: venue.id,
    placeName: venue.name,
    // scene 只认 venue 上真有的那个名字；素材库没有就留空。
    // **绝不兜成场所名**——那等于替她编了一个库里没有的场景，
    // imggen 会提示「库里没找到」，那一项白填还显得她填错了。
    scene: typeof venue.scene === 'string' ? venue.scene.trim() : '',
    outfit: venue.recommendedOutfit || '',
    company: text(company, 40),
    enteredAt: nowMs,
    lastAt: nowMs,
    visited: [],
    souvenirs: [],
    photos: [],
    ate: [],
    events: [],
    choices: [],
    phases: [],
    branchSeen: [],
    storyProgress: [],
    timeline: [],
  };
  state.session = session;
  return { session, already: false };
}

/**
 * 逛一处：挑一个还没去过的项目，顺手记一条随机小事件。
 *
 * `areas` / `events` 可以由调用方传（时段气氛：夜市快收的时候只剩几家摊子，
 * 池子该由 phases 决定，不该在 state 层再算一遍时间）。不传就用场所的全部。
 *
 * 项目按「剩下的优先」取——逛了三次不会连着去同一个过山车。
 * 项目全逛完了就返回 null，让调用方提醒她回家（而不是硬编一个）。
 */
export function wanderOnce(state, venue, nowMs, random = Math.random, areas = null, events = null) {
  const s = state.session;
  if (!s) return null;
  const areaPool = Array.isArray(areas) && areas.length ? areas : (venue.areas || []);
  const done = new Set(s.visited.map((v) => v.area));
  const left = areaPool.filter((a) => !done.has(a));
  const pool = left.length ? left : areaPool;
  if (!pool.length) return null;
  const i = Math.floor(random() * pool.length) % pool.length;
  const area = pool[i];
  const evSource = Array.isArray(events) ? events : (venue.randomEvents || []);
  const evPool = evSource.filter((e) => !s.events.includes(e));
  const ev = evPool.length
    ? evPool[Math.floor(random() * evPool.length) % evPool.length]
    : null;
  s.visited.push({ area, note: '', at: nowMs });
  s.lastAt = nowMs;
  if (ev) s.events.push(ev);
  return { area, event: ev, exhausted: left.length <= 1 };
}

/** 逛完之后递到嘴边的拍照点 / 纪念品候选（不重复已买过的）。 */
export function photoSpotsFor(session, venue) {
  const taken = new Set(session.photos);
  return (venue.photoSpots || []).filter((p) => !taken.has(p));
}

export function souvenirsFor(session, venue) {
  const bought = new Set(session.souvenirs);
  return (venue.souvenirs || []).filter((p) => !bought.has(p));
}

/** 记一张照。返回 { spot, duplicate }。 */
export function takePhoto(state, spot, nowMs) {
  const s = state.session;
  if (!s) return null;
  const name = text(spot, 60);
  if (!name) return null;
  const duplicate = s.photos.includes(name);
  if (!duplicate) s.photos.push(name);
  s.lastAt = nowMs;
  return { spot: name, duplicate };
}

/**
 * 记一样吃了/喝了的东西。
 *
 * **只记名字，不记味道。** 味道（九维、香气、口感、余韵）在「鱼的每一天」的菜品库里，
 * 本插件不读它——所以这里存的是 `{ item, verb }` 这种「喝了杯奶茶」级别的事实。
 * 没装 feast 时，这一条就是她对这趟唯一的饮食记忆，不能编。
 *
 * 返回 { item, verb, duplicate }。
 */
export function recordConsume(state, venue, item, nowMs) {
  const s = state.session;
  if (!s) return null;
  const name = text(item, 30);
  if (!name) return null;
  if (!Array.isArray(s.ate)) s.ate = [];
  const verb = text(venue?.food?.verb, 4) || '吃';
  const duplicate = s.ate.some((x) => x.item === name);
  if (!duplicate) s.ate.push({ item: name, verb, at: nowMs });
  s.lastAt = nowMs;
  return { item: name, verb, duplicate };
}

/** 买一件纪念品。返回 { item, duplicate }。 */
export function buySouvenir(state, item, nowMs) {
  const s = state.session;
  if (!s) return null;
  const name = text(item, 40);
  if (!name) return null;
  const duplicate = s.souvenirs.includes(name);
  if (!duplicate) s.souvenirs.push(name);
  s.lastAt = nowMs;
  return { item: name, duplicate };
}

/**
 * 回家：把 session 收成一条 trip 存进纪念册，返回这一趟和正文要用的摘要。
 *
 * `note` 是她回家时说的一句话（可空）。**回执正文由 World 拼**，
 * 这里只给结构化摘要，便于单测断言。
 *
 * `day` 必须由调用方按**本地时区**算好传进来（`dayIn(tz, nowMs)`），
 * 存进 `trip.leftDay`。以前不传，于是所有读纪念册的地方都用 UTC 反算日期，
 * 上海时间早上 8 点前收的摊会被算成前一天。不传就留空，读的一方回退到
 * 按插件当前时区读取 leftAt（不迁移、不改写旧记录）。
 */
export function closeSession(state, nowMs, note = '', day = '', timezone = 'Asia/Shanghai') {
  const s = state.session;
  if (!s) return null;
  const said = text(note, 120);
  state.tripSeq = (Number(state.tripSeq) || 0) + 1;
  const trip = {
    id: `${newTripId(s.placeId, s.enteredAt, nowMs)}-${state.tripSeq}`,
    favorite: false,
    sequence: state.tripSeq,
    placeId: s.placeId,
    placeName: s.placeName,
    scene: s.scene,
    outfit: s.outfit,
    company: text(s.company, 40),
    enteredAt: s.enteredAt,
    leftAt: nowMs,
    pausedMs: s.pausedMs ?? 0,
    routeId: text(s.routeId, 100),
    routeOrder: [1, 2].includes(s.routeOrder) ? s.routeOrder : 0,
    phases: [...(s.phases ?? [])],
    branchSeen: [...(s.branchSeen ?? [])],
    storyProgress: normalizeStoryProgress(s.storyProgress),
    ...normalizeStoryRun(s.storyRun),
    timelineTruncated: s.timelineTruncated === true || (s.timeline?.length ?? 0) >= 240,
    timeline: normalizeTimeline(s.timeline),
    leftDay: DAY_RE.test(text(day, 10)) ? text(day, 10) : '',
    // 回家这句话以前只出现在回执里，转头就没了：纪念册重看这一趟只剩「逛了哪儿」。
    // 「今天人很多，但很开心」这种话才是她自己的记录，必须存。
    note: said,
    favorite: false,
    visited: s.visited.map((v) => ({ ...v })),
    souvenirs: [...s.souvenirs],
    photos: [...s.photos],
    ate: (s.ate ?? []).map((x) => ({ ...x })),
    events: [...s.events],
    choices: normalizeChoices(s.choices),
  };
  addMoment(trip, 'close', said ? '回家 · ' + said : '回家', nowMs);
  state.session = null;
  if (trip.storyRun?.canonical !== false) {
    state.storyCanon = normalizeStoryCanon(state.storyCanon, [trip]);
    state.exploration = recordExploration(state.exploration, trip, timezone);
    state.collection = mergeCollection(state.collection, [...new Set(s.souvenirs)].map((name) => ({ placeId: s.placeId, placeName: s.placeName, name, day, at: nowMs, tripId: trip.id })));
  }
  state.trips.unshift(trip);
  const savedTrip = state.keepsakeTrips?.find((x) => x.id === trip.id);
  if (savedTrip) state.keepsakeTrips = state.keepsakeTrips.map((x) => x.id === trip.id ? structuredClone(trip) : x);
  if (state.trips.length > MAX_TRIPS) state.trips.length = MAX_TRIPS;
  const stayedMin = outingMinutes(s, nowMs);
  return { trip, stayedMin, note: said };
}

export function favoriteTrip(state, id, keep = true) {
  const trips = [...(state.trips ?? []), ...(state.keepsakeTrips ?? [])];
  const trip = trips.find((t) => t.id === id);
  if (!trip) return { ok: false, error: '找不到这趟行程，请先翻纪念册取得行程 ID。' };
  state.keepsakeTrips = (state.keepsakeTrips ?? []).filter((t) => t.id !== id);
  trip.favorite = keep;
  if (keep) state.keepsakeTrips.unshift(structuredClone(trip));
  state.keepsakeTrips.sort((a, b) => b.leftAt - a.leftAt);
  const recent = state.trips?.find((t) => t.id === id);
  if (recent) recent.favorite = keep;
  return { ok: true, trip, kept: keep };
}

/** 这一趟挂太久了没？超过 ttlMin 就该提醒回家（但绝不替她收）。 */
export function isStale(session, nowMs, ttlMin) {
  if (!session) return false;
  const ttl = Math.max(1, Math.round(Number(ttlMin) || 0));
  return nowMs - session.lastAt > ttl * 60000;
}

/** 今天（或这一趟）逛过的项目列表，给回执用；空的时候给一句人话。 */
export function visitedText(session) {
  if (!session?.visited?.length) return '还没逛到哪儿';
  return session.visited.map((v) => v.area).join('、');
}

/** 一趟的一句话说人话，给回家正文和 fun_view 共用。 */
export function tripSummary(trip) {
  if (!trip) return '';
  const parts = [trip.placeName];
  if (trip.company) parts.push(`跟${trip.company}一起`);
  if (trip.visited?.length) parts.push(`逛了${trip.visited.map((v) => v.area).join('、')}`);
  if (trip.souvenirs?.length) parts.push(`买了${trip.souvenirs.join('、')}`);
  if (trip.photos?.length) parts.push(`在${trip.photos.join('、')}拍了照`);
  // 吃了/喝了什么：只说「喝了杯奶茶」，不说味道——味道不在这个插件里。
  if (trip.ate?.length) parts.push(`${trip.ate.map((x) => `${x.verb}了${x.item}`).join('、')}`);
  return parts.join('，');
}

/**
 * 这一趟算哪一天（本地日期）。
 *
 * 优先用回家时存下的 `leftDay`；旧记录按当前插件时区解释时间戳。
 * 只在读取时换算，不迁移、不改写旧记录；无法还原旧记录当时未保存的时区。
 */
export function tripDay(trip, timezone = 'Asia/Shanghai') {
  const stored = text(trip?.leftDay, 10);
  if (DAY_RE.test(stored)) return stored;
  try {
    if (!trip?.leftAt) return '';
    const day = dayIn(timezone, trip.leftAt);
    return DAY_RE.test(day) ? day : '';
  } catch {
    return '';
  }
}

/** 最近去过的地方 id（跨天也算），给 fun_places 排序用。正在逛的排最前。 */
export function recentPlaceIds(state, limit = 3) {
  const ids = [];
  const cap = Math.max(1, Math.round(Number(limit) || 3));
  // 正在逛的先占位，再补纪念册：先插再截断，否则正逛的地方会被裁掉。
  if (state.session?.placeId) ids.push(state.session.placeId);
  for (const t of state.trips || []) {
    if (ids.length >= cap) break;
    if (t.placeId && !ids.includes(t.placeId)) ids.push(t.placeId);
  }
  return ids;
}

/** 转一下，把一个场所的所有候选摊平（测试与面板共用）。 */
export function venueBundle(venue, random = Math.random) {
  return {
    venue,
    areas: [...(venue.areas || [])],
    souvenirs: pickSome(venue.souvenirs, 3, random),
    photoSpots: pickSome(venue.photoSpots, 2, random),
    randomEvent: pickSome(venue.randomEvents, 1, random)[0] ?? null,
  };
}

/** 场所库里有这个 id 吗（回家后仍能按 id 回查，给 fun_view 用）。 */
export function venueById(id) {
  return VENUES.find((v) => v.id === id) ?? null;
}

/** 现在这个点，这处开着吗（面板徽章用）。 */
export function openStateOf(venue, tz, nowMs) {
  return hoursState(venue, minutesIn(tz, nowMs));
}
