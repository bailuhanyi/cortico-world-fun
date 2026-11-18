const TYPES = new Set(['visit', 'area', 'phase', 'souvenir']);
const STATUSES = new Set(['active', 'paused', 'completed', 'cancelled']);
const LIMIT = 100;


function text(value, max = 200) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function timestamp(value) {
  try {
    const date = value instanceof Date ? value : new Date(value ?? 0);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function uniqueId(now, used = new Set()) {
  const stamp = new Date(timestamp(now)).getTime();
  let id;
  let sequence = 0;
  do {
    sequence += 1;
    id = `wish-${Number.isFinite(stamp) ? stamp : 0}-${sequence}`;
  } while (used.has(id));
  return id;
}

function cleanWish(raw, used) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const placeId = text(raw.placeId, 80);
  const placeName = text(raw.placeName, 80);
  const type = text(raw.type, 20);
  const target = text(raw.target, 120);
  if (!placeId || !placeName || !TYPES.has(type) || (type !== 'visit' && !target)) return null;
  const status = STATUSES.has(raw.status) ? raw.status : 'active';
  const createdAt = timestamp(raw.createdAt);
  const updatedAt = timestamp(raw.updatedAt ?? raw.createdAt);
  const id = text(raw.id, 120) || uniqueId(createdAt, used);
  if (used.has(id)) return null;
  used.add(id);
  return {
    id, placeId, placeName, type, target,
    reason: text(raw.reason, 120), status, createdAt, updatedAt,
    completedAt: status === 'completed' ? timestamp(raw.completedAt ?? updatedAt) : '',
  };
}

export function normalizeWishes(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const used = new Set();
  for (const item of raw) {
    const wish = cleanWish(item, used);
    if (wish) result.push(wish);
    if (result.length >= LIMIT) break;
  }
  return result;
}

export function addWish(list, input, now = 0) {
  const wishes = normalizeWishes(list);
  const candidate = cleanWish({ ...input, id: '', status: 'active', completedAt: '', createdAt: now, updatedAt: now }, new Set(wishes.map((w) => w.id)));
  if (!candidate) return { wishes, wish: null, duplicate: false, error: '心愿信息无效' };
  const duplicate = wishes.find((w) => w.placeId === candidate.placeId && w.type === candidate.type && w.target === candidate.target && ['active', 'paused'].includes(w.status));
  if (duplicate) return { wishes, wish: duplicate, duplicate: true };
  if (wishes.length >= LIMIT) return { wishes, wish: null, duplicate: false, error: '心愿最多保存 100 条' };
  const wish = { ...candidate, id: uniqueId(now, new Set(wishes.map((w) => w.id))) };
  return { wishes: [...wishes, wish], wish, duplicate: false };
}

export function changeWish(list, id, action, now = 0) {
  const wishes = normalizeWishes(list);
  const index = wishes.findIndex((w) => w.id === id);
  if (index < 0) return { wishes, wish: null, error: '找不到这个心愿' };
  const current = wishes[index];
  let status = current.status;
  if (action === 'pause' && status === 'active') status = 'paused';
  else if (action === 'resume' && status === 'paused') status = 'active';
  else if (action === 'cancel' && ['active', 'paused'].includes(status)) status = 'cancelled';
  else if (!['pause', 'resume', 'cancel'].includes(action)) return { wishes, wish: current, error: '不支持的操作' };
  if (status === current.status) return { wishes, wish: current };
  const wish = { ...current, status, updatedAt: timestamp(now) };
  const next = [...wishes];
  next[index] = wish;
  return { wishes: next, wish };
}

export function fulfillWishes(list, facts, now = 0) {
  const wishes = normalizeWishes(list);
  const placeId = text(facts?.placeId, 80);
  const area = text(facts?.area, 120);
  const phase = text(facts?.phase, 120);
  const souvenirs = Array.isArray(facts?.souvenirs) ? facts.souvenirs.map((x) => text(x, 120)).filter(Boolean) : [];
  const completed = [];
  const next = wishes.map((w) => {
    if (w.status !== 'active' || w.placeId !== placeId) return w;
    const matched = w.type === 'visit' || (w.type === 'area' && area === w.target) || (w.type === 'phase' && phase === w.target) || (w.type === 'souvenir' && souvenirs.includes(w.target));
    if (!matched) return w;
    const done = { ...w, status: 'completed', updatedAt: timestamp(now), completedAt: timestamp(now) };
    completed.push(done);
    return done;
  });
  return { wishes: next, completed };
}

export function wishReason(list, venue, nowMin) {
  void nowMin;
  const placeId = typeof venue === 'string' ? venue : venue?.placeId ?? venue?.id;
  const wish = normalizeWishes(list).find((w) => w.status === 'active' && w.placeId === placeId);
  if (!wish) return '';
  return wish.reason || `还想在${wish.placeName}完成「${wish.target}」这个心愿。`;
}
