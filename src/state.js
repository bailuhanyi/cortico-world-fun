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

function normalizeTrip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const placeId = text(raw.placeId, 40);
  if (!placeId) return null;
  return {
    placeId,
    placeName: text(raw.placeName, 40) || placeId,
    scene: text(raw.scene, 40),
    outfit: text(raw.outfit, 40),
    // 跟谁一起去的：只进回执不留档的话，「上一次是和阿岚去的」这种话永远说不出来。
    company: text(raw.company, 40),
    enteredAt: Number.isFinite(Number(raw.enteredAt)) ? Number(raw.enteredAt) : 0,
    leftAt: Number.isFinite(Number(raw.leftAt)) ? Number(raw.leftAt) : 0,
    /**
     * 收摊那天的**本地**日期（YYYY-MM-DD）。
     *
     * 为什么单存一个：`leftAt` 是毫秒，换算成「哪天」需要时区。老代码用
     * `toISOString().slice(0,10)` 取 UTC 日期，于是上海时间早上 8 点前收的摊
     * 会被算成前一天——「同一天早上去过两次」会被说成「上一次是昨天」。
     * 收摊时由 World 按它自己的时区算好存下来，读的人就不用再猜了。
     */
    leftDay: DAY_RE.test(text(raw.leftDay, 10)) ? text(raw.leftDay, 10) : '',
    /** 收摊时说的那一句（和 `visited[].note` 不是一回事：那是逛某处时记的）。 */
    note: text(raw.note, 120),
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
 *
 * ## 跨天为什么不再无脑清 session
 *
 * 0.1.5 及以前：`raw.day !== day` 就直接 `session = null`。这看起来合理
 * （「昨天没逛完就是不逛完了」），实际会踩一条真会发生的路：
 *
 *   夜市 17:30–01:00、KTV 18:00–02:00。23:50 进夜市逛着，过了午夜再
 *   `fun_wander`，回执就是「你还没进门呢」——她正在逛的那一趟凭空消失，
 *   而那个地方本来就没打烊。
 *
 * 现在的判据是两条取或：
 *
 *   1. **还是同一天** → 留着。同一天里挂久了不算「没逛完」，`fun_wander`
 *      会提一句「挂得有点久了」，但绝不替她把这一趟收掉（这是 0.1.4 的行为，
 *      不能因为修跨午夜就一起改坏）。
 *   2. **跨了天，但上一次动在 TTL 之内** → 留着。这就是夜市/KTV 那条路。
 *
 * 跨了天、又挂过 TTL 的才丢（「逛到一半去睡觉，第二天回来发现不算了」）。
 *
 * 纪念册（`trips`）**任何时候都不清**——跨天该清的是「今天正在逛什么」，
 * 不是「她去过哪儿」。这一条是 0.1.5 修的，别改回去。
 */
export function normalizeState(raw, day, nowMs = 0, ttlMin = DEFAULT_TTL_MIN) {
  if (!raw || typeof raw !== 'object') return newState(day);
  const session = normalizeSession(raw.session);
  const keep = session && (raw.day === day || sessionAlive(session, nowMs, ttlMin));
  return {
    day,
    session: keep ? session : null,
    trips: (Array.isArray(raw.trips) ? raw.trips : []).map(normalizeTrip).filter(Boolean).slice(0, MAX_TRIPS),
  };
}

/** 和 config.js 的 `funSessionTTLMin` 默认值保持一致（纯函数不 import 配置，防循环依赖）。 */
export const DEFAULT_TTL_MIN = 90;

/**
 * 这一趟挂太久没有（跨天时用来判「还认不认昨天那一趟」）。
 *
 * 只看「上次动过之后过了多久」，不看日历。**不传 now 时返回 true**
 * （没有时间可判时宁可留着——丢错了她会「你还没进门呢」，留错了顶多提醒一句收摊）。
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
 * 已经在逛就**不覆盖**——先让她 `fun_home` 收摊，或者她自己说换地方。
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
 *
 * `day` 必须由调用方按**本地时区**算好传进来（`dayIn(tz, nowMs)`），
 * 存进 `trip.leftDay`。以前不传，于是所有读纪念册的地方都用 UTC 反算日期，
 * 上海时间早上 8 点前收的摊会被算成前一天。不传就留空，读的一方回退到
 * 按插件当前时区读取 leftAt（不迁移、不改写旧记录）。
 */
export function closeSession(state, nowMs, note = '', day = '') {
  const s = state.session;
  if (!s) return null;
  const said = text(note, 120);
  const trip = {
    placeId: s.placeId,
    placeName: s.placeName,
    scene: s.scene,
    outfit: s.outfit,
    company: text(s.company, 40),
    enteredAt: s.enteredAt,
    leftAt: nowMs,
    leftDay: DAY_RE.test(text(day, 10)) ? text(day, 10) : '',
    // 收摊这句话以前只出现在回执里，转头就没了：纪念册重看这一趟只剩「逛了哪儿」。
    // 「今天人很多，但很开心」这种话才是她自己的记录，必须存。
    note: said,
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
  return { trip, stayedMin, note: said };
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
 * 优先用收摊时存下的 `leftDay`；旧记录按当前插件时区解释时间戳。
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

/** 场所库里有这个 id 吗（收摊后仍能按 id 回查，给 fun_view 用）。 */
export function venueById(id) {
  return VENUES.find((v) => v.id === id) ?? null;
}

/** 现在这个点，这处开着吗（面板徽章用）。 */
export function openStateOf(venue, tz, nowMs) {
  return hoursState(venue, minutesIn(tz, nowMs));
}
