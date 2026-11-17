/**
 * 去过的痕迹：同一处地方，第二次去和第一次不是一回事。
 *
 * 这一层解决的问题：`trips` 里明明记着「上次在漫展买了吧唧、在舞台区站了很久」，
 * 但她再进漫展时，`fun_go` 的回执和第一次去一模一样——纪念册有数据，逛的时候没用上。
 *
 * 设计原则（有意克制）：
 *
 *   - **只讲我记得住的事**：去过几次、上次哪天、在那几处逛过、买过/吃过/拍过什么、
 *     碰上过哪件小事。不编「你还记得那次……吗」这种情感话术——那是她自己的事。
 *   - **只讲这一处的痕迹**：别的城市的漫展不算这里。按 `placeId` 精确匹配。
 *   - **今天这一趟不算「上次」**：`fun_go` 进去时当前 session 还没进 trips，
 *     但如果同一天的早上一趟已经收了，它就该算「今天早些时候」而不是「上次」。
 *   - 没去过就返回 `null`，调用方一个字都不提（**第一次去不该有「上次」的口气**）。
 *
 * 所有函数都永不抛错：痕迹是锦上添花，读不出来不能影响出门。
 */

const norm = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 这一趟算哪一天。
 *
 * 优先 `leftDay`（收摊时按本地时区算好存下的）；老数据没有，回退到
 * 「用 `leftAt` 反算」——那是 0.1.5 的行为，按 UTC 算，早上 8 点前收的摊会偏一天。
 *
 * 为什么不再统一用 UTC 反算：她在上海，早上 6 点爬完山 7 点再去，
 * 会被告知「你之前来过这里 1 次，上一次是昨天」——其实是同一个早上。
 */
function tripDay(trip) {
  const stored = norm(trip?.leftDay, 10);
  if (DAY_RE.test(stored)) return stored;
  try {
    const day = trip?.leftAt ? new Date(trip.leftAt).toISOString().slice(0, 10) : '';
    return DAY_RE.test(day) ? day : '';
  } catch {
    return '';
  }
}

/** 某一天（YYYY-MM-DD）到「哪天」的中文说法。`today` 由调用方给，避免这里感知时区。 */
export function dayPhrase(day, today) {
  const d = norm(day, 10);
  const t = norm(today, 10);
  if (!d) return '';
  if (!t) return d;
  if (d === t) return '今天';
  const a = Date.parse(`${d}T00:00:00Z`);
  const b = Date.parse(`${t}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return d;
  const diff = Math.round((b - a) / 86400000);
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  if (diff > 2 && diff <= 7) return `${diff} 天前`;
  if (diff > 7) return d.slice(5).replace('-', ' 月 ') + ' 日';
  if (diff === 0) return '今天';
  // 未来的日期：说明数据有点脏，直接给原值，别编一个说法。
  return d;
}

/**
 * 把这一处的历史摊平：去过几次、各处逛了几回、累积买了什么。
 *
 * @param {object[]} trips   全部历史（state.trips，最近的在前）
 * @param {string} placeId   只看这一处
 * @param {string} today     今天的 YYYY-MM-DD，用来算「昨天/前天」
 */
export function historyFor(trips, placeId, today = '') {
  try {
    const list = (Array.isArray(trips) ? trips : []).filter((t) => t && t.placeId === placeId);
    if (!list.length) return null;

    /** 各项逛了几次，按次数降序（她最常去的那几处排前面）。 */
    const areaCount = new Map();
    const souvenirCount = new Map();
    const ateCount = new Map();
    const photoCount = new Map();
    const eventSeen = new Set();
    let visitCount = 0;
    let firstDay = '';
    let lastDay = '';

    for (const t of list) {
      visitCount += 1;
      // 优先收摊时存下的本地日期；老数据回退到用 leftAt 反算。
      // 反算可能是坏的（手改过的 state、旧版本写的）：坏就这一天不知道，但这一趟还得算。
      const day = tripDay(t);
      if (day) {
        if (!firstDay || day < firstDay) firstDay = day;
        if (!lastDay || day > lastDay) lastDay = day;
      }
      for (const v of t.visited ?? []) {
        const a = norm(v?.area, 40);
        if (a) areaCount.set(a, (areaCount.get(a) ?? 0) + 1);
      }
      for (const s of t.souvenirs ?? []) {
        const x = norm(s, 40);
        if (x) souvenirCount.set(x, (souvenirCount.get(x) ?? 0) + 1);
      }
      for (const a of t.ate ?? []) {
        const x = norm(a?.item, 30);
        if (x) ateCount.set(x, (ateCount.get(x) ?? 0) + 1);
      }
      for (const p of t.photos ?? []) {
        const x = norm(p, 60);
        if (x) photoCount.set(x, (photoCount.get(x) ?? 0) + 1);
      }
      for (const e of t.events ?? []) {
        const x = norm(e, 120);
        if (x) eventSeen.add(x);
      }
    }

    const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const last = list[0];

    return {
      visitCount,
      firstDay,
      lastDay,
      lastDayPhrase: dayPhrase(lastDay, today),
      lastTrip: last,
      areas: sorted(areaCount).map(([area, times]) => ({ area, times })),
      souvenirs: sorted(souvenirCount).map(([item, times]) => ({ item, times })),
      ate: sorted(ateCount).map(([item, times]) => ({ item, times })),
      photos: sorted(photoCount).map(([spot, times]) => ({ spot, times })),
      events: [...eventSeen],
    };
  } catch {
    return null;
  }
}

/**
 * 把痕迹写成一句话，给 `fun_go` 用。
 *
 * 返回 `null` 表示没来过（调用方一个字都不提）。
 * 写法刻意平铺：不感叹、不问「你还记得吗」，只把事实摆出来让她自己接。
 *
 * `today` 传了就用来算「昨天/前天」；同一天的前一趟由调用方先说
 * 「今天你已经来过一次了」，所以这里**不再重复**「上一次是今天」。
 */
export function memoryLine(history, today = '') {
  if (!history || !history.visitCount) return null;
  const parts = [];
  const n = history.visitCount;
  const sameDay = history.lastDay === norm(today, 10) && today;
  // 上一次就是今天时，上面已经说过「今天来过」，这里别再复读一遍。
  const when = sameDay ? '' : (history.lastDayPhrase || '');
  parts.push(`你之前来过这里 ${n} 次${when ? `，上一次是${when}` : ''}。`);
  // 逛过的：最多提三处，带次数（去过两次以上的才标次数，一次的不标）。
  const areas = history.areas.slice(0, 3)
    .map((a) => (a.times > 1 ? `${a.area}（${a.times} 次）` : a.area));
  const more = history.areas.length - areas.length;
  if (areas.length) {
    parts.push(`逛过${areas.join('、')}${more > 0 ? ` 等 ${history.areas.length} 处` : ''}。`);
  }

  // 买过/吃过/拍过的：各提一样最常的，别列清单。
  const bought = history.souvenirs[0];
  if (bought) parts.push(`买过${bought.item}${bought.times > 1 ? `（${bought.times} 次）` : ''}。`);
  const ate = history.ate[0];
  if (ate) parts.push(`${ate.item}也喝过吃过。`);

  return parts.join('');
}

/**
 * 这一处算不算「常来的地方」。
 *
 * 判据是去过 5 趟以上。为什么是 5 而不是 3：3 趟还可能是「刚发现这儿」，
 * 5 趟才到了「老板认识你」的程度。常客语气只在够格时才用，否则那句
 * 「老板娘认出你了」会显得廉价。
 */
export const REGULAR_VISITS = 5;

export function isRegular(history) {
  return (history?.visitCount ?? 0) >= REGULAR_VISITS;
}

/**
 * 常客那半句：和 `memoryLine` 分开，因为它的**语气**不一样。
 *
 * `memoryLine` 是「摆事实」（来过几次、买过什么）——第一次再去时这样最合适。
 * 常客那句是「关系」：认得你了、多给一串、记得你上次要什么。
 * 这部分刻意**不夸大**：不写「你就是这儿的常客了」，只写一个具体的小动作，
 * 剩下的让她自己接。
 *
 * 返回空串表示还不够格（调用方一个字都不加）。
 *
 * @param {object} history historyFor() 的结果
 * @param {string} placeName
 */
export function regularLine(history, placeName = '') {
  if (!isRegular(history)) return '';
  const n = history.visitCount;
  const who = placeName ? `${placeName}的` : '';
  const lines = [
    `${who}人对你有印象了——来了 ${n} 次。`,
    `${who}人认得你了（第 ${n} 次），这回没多问就把你常要的那份记下了。`,
    `来过 ${n} 次了，${who}人朝你点了一下头。`,
  ];
  // 按次数取，稳定不随机：同一个次数永远同一句话，免得她以为是随机事件。
  return lines[n % lines.length];
}

/**
 * 这次该不该提「你没去过的那几处」。
 *
 * 意义在于：一处地方来过三次，可能每次都只逛了同一半。
 * 告诉她「还没去过：鬼屋、碰碰车」比再讲一遍去过哪儿有用得多。
 *
 * @param {object} history   historyFor() 的结果
 * @param {string[]} allAreas 这一处此刻能逛的全部项目
 * @param {number} max       最多提几处
 */
export function untriedAreas(history, allAreas, max = 4) {
  const seen = new Set((history?.areas ?? []).map((a) => a.area));
  return (Array.isArray(allAreas) ? allAreas : [])
    .filter((a) => !seen.has(norm(a, 40)))
    .slice(0, Math.max(1, Math.round(Number(max) || 4)));
}

/**
 * 这一趟是不是今天已经来过了（同一天的前一趟）。
 *
 * 用来把「上次是今天」说成「今天早些时候」，而不是「上次是今天」这种别扭话。
 */
export function cameEarlierToday(history, today) {
  if (!history || !today) return false;
  return history.lastDay === norm(today, 10) && history.visitCount > 0;
}

/**
 * 过滤掉「和以前重复」的小事件。
 *
 * 为什么需要：她在漫展买过吧唧，下次再抽到「吧唧挑了半天，最后把一整组都买了」，
 * 这句话就不成立了——她这次没买，上次买了。同一个地方去得越多，
 * 撞上旧事的概率越高，痕迹就成了复读机。
 *
 * 拦两类：
 *   1. **她确实做过这件事**（买过 / 喝过 / 拍过）：事件文本里出现那件东西的名字，
 *      就说明这条是在讲她上次买过的东西，这次没发生。
 *   2. **这条事件她以前碰上过**（`history.events`，按原文比对）：
 *      同一处去五次、事件池只有五条，第五次就全是旧话。
 *
 * 第 2 条以前是**写了没接**：`historyFor` 一直算着 `events`，但没有任何人用它，
 * 于是「去过的地方会记得」这一层漏了半年。现在接上。
 *
 * 判据仍然保守：只按原文/名字比对，不做模糊语义匹配，没碰过的一律放过
 * （池子抽干时调用方会退回全池，见 `pickEvent`）。
 */
export function filterRepeatedEvents(events, history) {
  const pool = Array.isArray(events) ? events : [];
  if (!history) return [...pool];
  const done = [
    ...(history.souvenirs ?? []).map((s) => s.item),
    ...(history.ate ?? []).map((s) => s.item),
    ...(history.photos ?? []).map((s) => s.spot),
  ].filter(Boolean);
  const seen = new Set((history.events ?? []).map((e) => norm(e, 120)).filter(Boolean));
  return pool.filter((e) => {
    const line = norm(e, 120);
    if (seen.has(line)) return false;
    return !done.some((d) => String(e).includes(d));
  });
}

/**
 * 从池子里抽一条她这趟还没碰过的事件。
 *
 * 分两层退让，目的是「宁可重复，也别没有」：
 *   1. 全池里挑这趟没碰过的；
 *   2. 全池都碰过了（这处去太多次了）→ 退回全池随机，照样有一条。
 *
 * 以前调用方各写一遍这段，其中 `fun_wander` 自动挑那一支还漏传事件池
 * （0.1.6 批次修过）。抽出来一处，就不会再有第二份漏传。
 *
 * @param {string[]} pool   已经过 `filterRepeatedEvents` 的事件池
 * @param {string[]} seen   这一趟已经碰过的事件（session.events）
 * @param {() => number} random
 * @returns {string|null}
 */
export function pickEvent(pool, seen = [], random = Math.random) {
  const list = Array.isArray(pool) ? pool : [];
  if (!list.length) return null;
  const had = new Set((Array.isArray(seen) ? seen : []).map((e) => norm(e, 120)));
  const fresh = list.filter((e) => !had.has(norm(e, 120)));
  const source = fresh.length ? fresh : list;
  const i = Math.floor(Number(random()) * source.length) % source.length;
  return source[i] ?? null;
}
