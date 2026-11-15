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
      // leftAt 可能是坏的（手改过的 state、旧版本写的）：坏就这一天不知道，但这一趟还得算。
      let day = '';
      try {
        day = t.leftAt ? new Date(t.leftAt).toISOString().slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) day = '';
      } catch {
        day = '';
      }
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
 * 判据很保守：**只在她确实做过这件事时**才拦，不做模糊语义匹配。
 * 例如她买过「吧唧」，就过滤掉提到「吧唧」的事件；她吃过「珍珠奶茶」同理。
 * 没做过的事一律不拦（那是新鲜的）。
 */
export function filterRepeatedEvents(events, history) {
  const pool = Array.isArray(events) ? events : [];
  if (!history) return [...pool];
  const done = [
    ...(history.souvenirs ?? []).map((s) => s.item),
    ...(history.ate ?? []).map((s) => s.item),
    ...(history.photos ?? []).map((s) => s.spot),
  ].filter(Boolean);
  if (!done.length) return [...pool];
  return pool.filter((e) => !done.some((d) => String(e).includes(d)));
}
