/**
 * 出游状态的纯逻辑：一趟从进门到收摊。
 *
 * 不碰文件、不碰定时器、不碰宿主，便于单测；World 只负责把结果变成工具回执。
 *
 * 状态形状（落 `<dataDir>/fun/state.json`）：
 * {
 *   day: '2026-11-15',            // 本地日期，跨天就整份重来
 *   session: null | {             // 正在逛的这一趟；null = 没在逛
 *     id, placeId, placeName, scene, outfit,
 *     enteredAt, lastAt,          // ms
 *     visited: [{ area, note, at }],
 *     souvenirs: [string],
 *     photos: [string],
 *     events: [string],
 *   },
 *   trips: [{ placeId, placeName, scene, outfit, enteredAt, leftAt, visited, souvenirs, photos, events }],
 * }
 *
 * `trips` 只留最近若干条，给 `fun_view` 看；**不收摊不落 trips**——
 * 中途关掉应用等于这趟没逛完，不该在纪念册里出现半趟。
 */

import { VENUES, hoursState, pickSome } from './venues.js';

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
  return { day, session: null, trips: [] };
}

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

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

function normalizeTrip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const placeId = text(raw.placeId, 40);
  if (!placeId) return null;
  return {
    placeId,
    placeName: text(raw.placeName, 40) || placeId,
    scene: text(raw.scene, 40),
    outfit: text(raw.outfit, 40),
    enteredAt: Number.isFinite(Number(raw.enteredAt)) ? Number(raw.enteredAt) : 0,
    leftAt: Number.isFinite(Number(raw.leftAt)) ? Number(raw.leftAt) : 0,
    visited: normalizeVisited(raw.visited),
    souvenirs: textList(raw.souvenirs, 12, 40),
    photos: textList(raw.photos, 12, 60),
    ate: normalizeAte(raw.ate),
    events: textList(raw.events, 16, 120),
  };
}

function normalizeSession(raw) {
  const trip = normalizeTrip(raw);
  if (!trip) return null;
  return {
    ...trip,
    id: text(raw.id, 40) || `${trip.placeId}-${trip.enteredAt}`,
    lastAt: Number.isFinite(Number(raw.lastAt)) ? Number(raw.lastAt) : trip.enteredAt,
  };
}

/**
 * 把磁盘上的旧状态补齐成当前形状（不信任文件内容）。
 * `day` 和今天不一致 = 跨天了：整份重来（上一趟没逛完就是没逛完）。
 */
export function normalizeState(raw, day) {
  if (!raw || typeof raw !== 'object' || raw.day !== day) return newState(day);
  return {
    day,
    session: normalizeSession(raw.session),
    trips: (Array.isArray(raw.trips) ? raw.trips : []).map(normalizeTrip).filter(Boolean).slice(0, MAX_TRIPS),
  };
}

/**
 * 进门：把一处场所变成一趟 session。
 * 已经在逛就**不覆盖**——先让她 `fun_home` 收摊，或者她自己说换地方。
 * 返回 { session, already } —— already 为 true 表示原来就有一趟没结束。
 */
export function enterVenue(state, venue, nowMs, random = Math.random) {
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
    enteredAt: nowMs,
    lastAt: nowMs,
    visited: [],
    souvenirs: [],
    photos: [],
    ate: [],
    events: [],
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
 * 项目全逛完了就返回 null，让调用方提醒她收摊（而不是硬编一个）。
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
  const evSource = Array.isArray(events) && events.length ? events : (venue.randomEvents || []);
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
 * 收摊：把 session 收成一条 trip 存进纪念册，返回这一趟和正文要用的摘要。
 *
 * `note` 是她收摊时说的一句话（可空）。**回执正文由 World 拼**，
 * 这里只给结构化摘要，便于单测断言。
 */
export function closeSession(state, nowMs, note = '') {
  const s = state.session;
  if (!s) return null;
  const trip = {
    placeId: s.placeId,
    placeName: s.placeName,
    scene: s.scene,
    outfit: s.outfit,
    enteredAt: s.enteredAt,
    leftAt: nowMs,
    visited: s.visited.map((v) => ({ ...v })),
    souvenirs: [...s.souvenirs],
    photos: [...s.photos],
    ate: (s.ate ?? []).map((x) => ({ ...x })),
    events: [...s.events],
  };
  state.session = null;
  state.trips.unshift(trip);
  if (state.trips.length > MAX_TRIPS) state.trips.length = MAX_TRIPS;
  const stayedMin = Math.max(0, Math.round((nowMs - s.enteredAt) / 60000));
  return { trip, stayedMin, note: text(note, 120) };
}

/** 这一趟挂太久了没？超过 ttlMin 就该提醒收摊（但绝不替她收）。 */
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

/** 一趟的一句话说人话，给收摊正文和 fun_view 共用。 */
export function tripSummary(trip) {
  if (!trip) return '';
  const parts = [trip.placeName];
  if (trip.visited?.length) parts.push(`逛了${trip.visited.map((v) => v.area).join('、')}`);
  if (trip.souvenirs?.length) parts.push(`买了${trip.souvenirs.join('、')}`);
  if (trip.photos?.length) parts.push(`在${trip.photos.join('、')}拍了照`);
  // 吃了/喝了什么：只说「喝了杯奶茶」，不说味道——味道不在这个插件里。
  if (trip.ate?.length) parts.push(`${trip.ate.map((x) => `${x.verb}了${x.item}`).join('、')}`);
  return parts.join('，');
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

/** 场所库里有这个 id 吗（收摊后仍能按 id 回查，给 fun_view 用）。 */
export function venueById(id) {
  return VENUES.find((v) => v.id === id) ?? null;
}

/** 现在这个点，这处开着吗（面板徽章用）。 */
export function openStateOf(venue, tz, nowMs) {
  return hoursState(venue, minutesIn(tz, nowMs));
}
