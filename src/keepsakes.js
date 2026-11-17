/**
 * 纪念品架与场所完成度：让「去过」这件事在纪念册之外还留下点东西。
 *
 * ## 这一层解决什么问题
 *
 * 0.1.5 的纪念册是一串孤立的趟：`fun_go → fun_wander × N → fun_home`，
 * 每一趟结束就结束了。纪念品在 `trip.souvenirs` 里只是几个字符串，
 * **跨趟没有任何归集**——所以「这枚纪念币是第一次去游乐场那天买的」
 * 这句话说不出来，面板上也看不出「我到底攒了多少东西」。
 *
 * 而这条数据其实一直都在 `state.trips` 里躺着，只是从来没人取。
 *
 * ## 设计
 *
 *   - **纯函数、不碰文件**：输入是 `state.trips`（和场所表），输出是结构化归集。
 *     World 负责把它变成回执文字或面板 payload。
 *   - **不算新状态**：不落盘、不加字段、不改 state 形状。纪念品架是
 *     `trips` 的一个**视图**，随时可以从头算出来。这样老数据自动就有了，
 *     也不需要迁移。
 *   - **永不抛错**：脏数据跳过那一条，绝不让纪念册打不开。
 *
 * ## 为什么不做「收藏值多少钱 / 稀有度」
 *
 * 那是给游戏做的。她真正会用到的是两句：这东西**在哪买的、哪天**，
 * 以及**这儿我还差什么没玩**。所以这里只归集这两类。
 */

const norm = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

import { tripDay, tripSummary } from './state.js';

/**
 * 把纪念册里所有趟摊平，按「东西的名字」归集。
 *
 * 同名纪念品在不同地方买算**两件不同的东西**（游乐场的棉花糖 ≠ 公园的棉花糖），
 * 所以 key 是 `placeId::名字`。同一处买过两次才算「买过几次」。
 *
 * @param {object[]} trips  `state.trips`（最近的在前）
 * @returns {{ items: object[], byPlace: object[], total: number, uniquePlaces: number }}
 */
export function collectSouvenirs(trips, timezone = 'Asia/Shanghai') {
  const list = Array.isArray(trips) ? trips : [];
  const map = new Map();

  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    const placeId = norm(t.placeId, 40);
    const placeName = norm(t.placeName, 40) || placeId;
    const day = tripDay(t, timezone);
    const memory = {
      day,
      leftAt: Number(t.leftAt) || 0,
      company: norm(t.company, 40),
      note: norm(t.note, 120),
      summary: tripSummary({
        placeName,
        company: norm(t.company, 40),
        visited: (Array.isArray(t.visited) ? t.visited : []).filter((v) => norm(v?.area, 40)).map((v) => ({ area: norm(v.area, 40) })),
      }),
    };
    const souvenirs = Array.isArray(t.souvenirs) ? [...new Set(t.souvenirs.map((s) => norm(s, 40)).filter(Boolean))] : [];
    for (const raw of souvenirs) {
      const name = norm(raw, 40);
      if (!name) continue;
      const key = `${placeId}::${name}`;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          key,
          name,
          placeId,
          placeName,
          // 第一次买到它的那天：纪念册是最近的在前，所以先遇到的就是最近那次，
          // 要一直往前覆盖到最后遇到的那条，才是真正的「第一次」。
          firstDay: day,
          lastDay: day,
          times: 1,
          memories: [memory],
        });
        continue;
      }
      cur.times += 1;
      cur.memories.push(memory);
      if (day && (!cur.firstDay || day < cur.firstDay)) cur.firstDay = day;
      if (day && (!cur.lastDay || day > cur.lastDay)) cur.lastDay = day;
    }
  }

  const items = [...map.values()];
  // 排序：最近拿到的排前面（面板上「最新攒到」最有用），同一天按地方名。
  items.sort((a, b) => {
    if (a.lastDay !== b.lastDay) return a.lastDay < b.lastDay ? 1 : -1;
    return a.placeName.localeCompare(b.placeName) || a.name.localeCompare(b.name);
  });

  // 按地方分组：面板上「这一处的架子」用这个。
  const places = new Map();
  for (const it of items) {
    const cur = places.get(it.placeId) ?? {
      placeId: it.placeId, placeName: it.placeName, items: [], firstDay: '', lastDay: '',
    };
    cur.items.push(it);
    if (it.firstDay && (!cur.firstDay || it.firstDay < cur.firstDay)) cur.firstDay = it.firstDay;
    if (it.lastDay && (!cur.lastDay || it.lastDay > cur.lastDay)) cur.lastDay = it.lastDay;
    places.set(it.placeId, cur);
  }

  return {
    items,
    byPlace: [...places.values()].sort((a, b) => b.items.length - a.items.length
      || a.placeName.localeCompare(b.placeName)),
    total: items.reduce((n, it) => n + it.times, 0),
    uniquePlaces: places.size,
  };
}

/**
 * 一处地方的完成度：项目 / 纪念品 / 拍照点，各逛到（买到/拍到）多少。
 *
 * `place` 是合并后的场所（预设 + 用户改动），因为自填地点也该有进度。
 * 传进来的 `trips` 只统计**这一处**的历史。
 *
 * 为什么三条分开算而不是一个总分：她缺的可能只是「鬼屋没去过」，
 * 一个 62% 的总分说不出这件事。`fun_go` 回执要的正是一句具体的
 * 「这儿你还差鬼屋和碰碰车」。
 *
 * @param {object} place      场所条目（含 areas / souvenirs / photoSpots）
 * @param {object[]} trips    全部纪念册（内部按 placeId 过滤）
 * @returns {{ areas: object, souvenirs: object, photos: object, percent: number, visits: number }}
 */
export function progressFor(place, trips) {
  const placeId = norm(place?.id, 40);
  const mine = (Array.isArray(trips) ? trips : []).filter((t) => t && t.placeId === placeId);

  const seenAreas = new Set();
  const bought = new Set();
  const shot = new Set();
  for (const t of mine) {
    for (const v of Array.isArray(t.visited) ? t.visited : []) {
      const a = norm(v?.area, 40);
      if (a) seenAreas.add(a);
    }
    for (const s of Array.isArray(t.souvenirs) ? t.souvenirs : []) {
      const x = norm(s, 40);
      if (x) bought.add(x);
    }
    for (const p of Array.isArray(t.photos) ? t.photos : []) {
      const x = norm(p, 60);
      if (x) shot.add(x);
    }
  }

  const allAreas = (Array.isArray(place?.areas) ? place.areas : []).map((a) => norm(a, 40)).filter(Boolean);
  const allGoods = (Array.isArray(place?.souvenirs) ? place.souvenirs : []).map((a) => norm(a, 40)).filter(Boolean);
  const allShots = (Array.isArray(place?.photoSpots) ? place.photoSpots : []).map((a) => norm(a, 60)).filter(Boolean);

  const part = (all, seen) => {
    all = [...new Set(all)];
    const got = all.filter((x) => seen.has(x));
    const left = all.filter((x) => !seen.has(x));
    return {
      got, left, total: all.length, done: got.length,
      complete: all.length > 0 && left.length === 0,
    };
  };

  const areas = part(allAreas, seenAreas);
  const souvenirs = part(allGoods, bought);
  const photos = part(allShots, shot);

  // 一个总百分比：只用来在面板上排「哪几处快集齐了」，不作为回执主句。
  const denom = areas.total + souvenirs.total + photos.total;
  const numer = areas.done + souvenirs.done + photos.done;
  return {
    areas,
    souvenirs,
    photos,
    visits: mine.length,
    percent: denom ? Math.round((numer / denom) * 100) : 0,
  };
}

/**
 * 把完成度写成一句能放进回执的话。**只在有内容可说时返回字符串**，
 * 没去过、或者全逛遍了，都返回空串（让调用方自己决定说什么）。
 *
 * 刻意写得具体：点出**还差什么**，而不是报个百分比。
 * 「这儿你还差鬼屋和碰碰车」比「完成度 62%」有用得多。
 *
 * @param {object} progress `progressFor()` 的结果
 * @param {number} max      最多点几处
 */
export function progressLine(progress, max = 3) {
  const left = progress?.areas?.left ?? [];
  if (!left.length) return '';
  const cap = Math.max(1, Math.round(Number(max) || 3));
  const shown = left.slice(0, cap);
  const more = left.length - shown.length;
  return `这儿还差${shown.join('、')}${more > 0 ? ` 等 ${left.length} 处` : ''}没逛。`;
}
