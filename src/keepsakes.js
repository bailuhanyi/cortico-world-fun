import { tripDay, tripSummary } from './state.js';
const norm = (v, max) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** 收藏可来自旧行程，或持久账本。详细回忆只关联仍保存的近期/珍藏行程。 */
export function collectSouvenirs(trips, timezone = 'Asia/Shanghai', collection = null) {
  const list = Array.isArray(trips) ? trips : [];
  const map = new Map();
  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    const placeId = norm(t.placeId, 40); if (!placeId) continue;
    const placeName = norm(t.placeName, 40) || placeId;
    const day = tripDay(t, timezone);
    const memory = { day, leftAt: Number(t.leftAt) || 0, company: norm(t.company, 40), note: norm(t.note, 120), summary: tripSummary({ ...t, placeName, visited: (Array.isArray(t.visited) ? t.visited : []).filter((v) => norm(v?.area, 40)) }) };
    for (const name of new Set((Array.isArray(t.souvenirs) ? t.souvenirs : []).map((s) => norm(s, 40)).filter(Boolean))) {
      const key = `${placeId}::${name}`;
      const cur = map.get(key);
      if (!cur) map.set(key, { key, name, placeId, placeName, firstDay: day, lastDay: day, times: 1, memories: [memory] });
      else { cur.times += 1; cur.memories.push(memory); if (day && (!cur.firstDay || day < cur.firstDay)) cur.firstDay = day; if (day && (!cur.lastDay || day > cur.lastDay)) cur.lastDay = day; }
    }
  }
  if (Array.isArray(collection)) {
    const historical = new Map(map);
    map.clear();
    for (const x of collection) {
      const placeId = norm(x?.placeId, 40); const name = norm(x?.name, 40); if (!placeId || !name) continue;
      const key = `${placeId}::${name}`;
      map.set(key, { key, placeId, placeName: norm(x.placeName, 40) || placeId, name, firstDay: norm(x.firstDay, 10), lastDay: norm(x.lastDay, 10), times: Math.max(1, Number(x.times) || 1), memories: historical.get(key)?.memories ?? (Array.isArray(x.tripIds) ? x.tripIds : []).map((id) => ({ tripId: id, archived: true })) });
    }
  }
  const items = [...map.values()].sort((a, b) => b.lastDay.localeCompare(a.lastDay) || a.placeName.localeCompare(b.placeName) || a.name.localeCompare(b.name));
  const places = new Map();
  for (const it of items) {
    const group = places.get(it.placeId) ?? { placeId: it.placeId, placeName: it.placeName, items: [], firstDay: '', lastDay: '' };
    group.items.push(it);
    if (it.firstDay && (!group.firstDay || it.firstDay < group.firstDay)) group.firstDay = it.firstDay;
    if (it.lastDay && (!group.lastDay || it.lastDay > group.lastDay)) group.lastDay = it.lastDay;
    places.set(it.placeId, group);
  }
  return { items, byPlace: [...places.values()].sort((a, b) => b.items.length - a.items.length || a.placeName.localeCompare(b.placeName)), total: items.reduce((n, x) => n + x.times, 0), uniquePlaces: places.size };
}

export function progressFor(place, trips, collection = null) {
  const placeId = norm(place?.id, 40);
  const mine = (Array.isArray(trips) ? trips : []).filter((t) => t && t.placeId === placeId);
  const seenAreas = new Set(); const bought = new Set(); const shot = new Set();
  for (const t of mine) {
    for (const v of Array.isArray(t.visited) ? t.visited : []) { const a = norm(v?.area, 40); if (a) seenAreas.add(a); }
    for (const s of Array.isArray(t.souvenirs) ? t.souvenirs : []) { const x = norm(s, 40); if (x) bought.add(x); }
    for (const p of Array.isArray(t.photos) ? t.photos : []) { const x = norm(p, 60); if (x) shot.add(x); }
  }
  for (const x of Array.isArray(collection) ? collection : []) if (x?.placeId === placeId) bought.add(norm(x.name, 40));
  const part = (all, seen) => { all = [...new Set((Array.isArray(all) ? all : []).map((x) => norm(x, 60)).filter(Boolean))]; const got = all.filter((x) => seen.has(x)); const left = all.filter((x) => !seen.has(x)); return { got, left, total: all.length, done: got.length, complete: all.length > 0 && !left.length }; };
  const areas = part(place?.areas, seenAreas); const souvenirs = part(place?.souvenirs, bought); const photos = part(place?.photoSpots, shot);
  const denom = areas.total + souvenirs.total + photos.total; const numer = areas.done + souvenirs.done + photos.done;
  return { areas, souvenirs, photos, visits: mine.length, percent: denom ? Math.round(numer / denom * 100) : 0 };
}
export function progressLine(progress, max = 3) {
  const left = progress?.areas?.left ?? []; if (!left.length) return '';
  const shown = left.slice(0, Math.max(1, Math.round(Number(max) || 3))); const more = left.length - shown.length;
  return `这儿还差${shown.join('、')}${more > 0 ? ` 等 ${left.length} 处` : ''}没逛。`;
}
