const clean = (v, n = 160) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '';
const stamp = (v) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
const KINDS = new Set(['enter', 'area', 'event', 'choice', 'buy', 'photo', 'consume', 'close']);

export function normalizeTimeline(raw) {
  const points = (Array.isArray(raw) ? raw : []).filter((x) => KINDS.has(x?.kind) && clean(x.text))
    .map((x) => ({ kind: x.kind, text: clean(x.text, 240), at: stamp(x.at), area: clean(x.area, 60), event: clean(x.event, 160) }));
  if (points.length <= 240) return points;
  const enter = points.find((p) => p.kind === 'enter');
  return enter ? [enter, ...points.filter((p) => p !== enter).slice(-239)] : points.slice(-240);
}

export function addMoment(outing, kind, text, at, area = '', event = '') {
  if (!outing || !KINDS.has(kind) || !clean(text)) return;
  if (!Array.isArray(outing.timeline)) outing.timeline = [];
  outing.timeline.push({ kind, text: clean(text, 240), at: stamp(at), area: clean(area, 60), event: clean(event, 160) });
}

/** Legacy entries retain their known times; missing associations stay unknown. */
export function timelineFor(trip, timezone = 'Asia/Shanghai') {
  let points = normalizeTimeline(trip?.timeline);
  if (!points.length && trip) {
    const item = (kind, text, at, area = '', event = '') => points.push({ kind, text, at: stamp(at), area, event });
    if (trip.enteredAt) item('enter', `进了${trip.placeName}`, trip.enteredAt);
    const list = (value) => Array.isArray(value) ? value : [];
    for (const v of list(trip.visited)) if (clean(v?.area)) item('area', v.area + (v.note ? ` · ${v.note}` : ''), v.at, v.area);
    for (const e of list(trip.events)) if (clean(e)) item('event', e, null, '', e);
    for (const c of list(trip.choices)) if (clean(c?.result || c?.option)) item('choice', c.result || c.option, c.at, '', c.event || '');
    for (const s of list(trip.souvenirs)) if (clean(s)) item('buy', `买了${s}`, null);
    for (const p of list(trip.photos)) if (clean(p)) item('photo', `在${p}拍了照`, null);
    for (const a of list(trip.ate)) if (clean(a?.item)) item('consume', `${a.verb || '吃'}了${a.item}`, a.at);
    if (trip.leftAt) item('close', trip.note ? `回家 · ${trip.note}` : '回家', trip.leftAt);
  }
  // Keep action order: clock changes and legacy unknown dates must not invent order.
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return points.map((p) => ({ ...p, hm: p.at ? clock.format(p.at) : '', day: p.at ? day.format(p.at) : '' }));
}

export function normalizeRoute(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const stops = (Array.isArray(raw.stops) ? raw.stops : []).map((x) => ({ placeId: clean(x?.placeId, 40), placeName: clean(x?.placeName, 40) })).filter((x) => x.placeId && x.placeName).slice(0, 2);
  if (stops.length !== 2 || stops[0].placeId === stops[1].placeId || !clean(raw.id, 100)) return null;
  const states = ['planned', 'active', 'between', 'completed', 'cancelled'];
  return { id: clean(raw.id, 100), stops, company: clean(raw.company, 40), startedAt: stamp(raw.startedAt), nextIndex: Math.max(0, Math.min(2, Math.floor(Number(raw.nextIndex) || 0))), status: states.includes(raw.status) ? raw.status : 'planned', tripIds: [...new Set((Array.isArray(raw.tripIds) ? raw.tripIds : []).map((x) => clean(x, 100)).filter(Boolean))].slice(0, 2) };
}

export function normalizeRoutes(raw) {
  const map = new Map();
  for (const r of Array.isArray(raw) ? raw : []) { const value = normalizeRoute(r); if (value) map.set(value.id, value); }
  return [...map.values()];
}

export function storeRoute(state, route) {
  const normalized = normalizeRoute(route);
  if (!normalized) return;
  state.routes = [...(state.routes ?? []).filter((x) => x.id !== normalized.id), normalized];
  state.route = ['planned', 'active', 'between'].includes(normalized.status) ? normalized : null;
}

export function routeText(route) {
  if (!route) return '';
  const status = { planned: '待出发', active: '正在逛', between: '待下一站', completed: '已结束', cancelled: '已取消后续' };
  return `这次出门：${route.stops.map((x) => x.placeName).join(' → ')}（${status[route.status]}，ID：${route.id}）`;
}
