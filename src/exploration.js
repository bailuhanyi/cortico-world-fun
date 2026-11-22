const text = (value, max) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const asArray = (value) => Array.isArray(value) ? value : [];
const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

function uniqueText(values, max) {
  const seen = new Set();
  for (const value of asArray(values)) {
    const item = text(value, max);
    if (item) seen.add(item);
  }
  return [...seen];
}

function tripId(trip) {
  const explicit = text(trip?.id, 120);
  if (explicit) return explicit;
  // Legacy state normalization assigns this same stable shape to trips without IDs.
  const placeId = text(trip?.placeId, 40);
  if (!placeId) return '';
  const enteredAt = Number.isFinite(Number(trip?.enteredAt)) ? Number(trip.enteredAt) : 0;
  const leftAt = Number.isFinite(Number(trip?.leftAt)) ? Number(trip.leftAt) : 0;
  return `${placeId}-${enteredAt}-${leftAt}`;
}

function tripSequence(trip) {
  return Number.isSafeInteger(trip?.sequence) && trip.sequence > 0 ? trip.sequence : 0;
}

function emptyEntry(placeId, placeName = '') {
  return {
    placeId,
    placeName: text(placeName, 40) || placeId,
    visits: 0,
    lastSequence: 0,
    areas: [],
    areaCounts: Object.create(null),
    photos: [],
    events: [],
    phases: [],
    firstDay: '',
    lastDay: '',
    // Only legacy trips need a full ID set; sequenced trips use lastSequence.
    tripIds: [],
  };
}

function normalizeEntry(raw) {
  const placeId = text(raw?.placeId, 40);
  if (!placeId) return null;
  const out = emptyEntry(placeId, raw?.placeName);
  out.visits = count(raw?.visits);
  out.lastSequence = Number.isSafeInteger(raw?.lastSequence) && raw.lastSequence > 0 ? raw.lastSequence : 0;
  out.areas = uniqueText(raw?.areas, 40);
  out.photos = uniqueText(raw?.photos, 60);
  out.events = uniqueText(raw?.events, 120);
  out.phases = uniqueText(raw?.phases, 60);
  const counts = raw?.areaCounts && typeof raw.areaCounts === 'object' && !Array.isArray(raw.areaCounts)
    ? Object.entries(raw.areaCounts)
    : [];
  for (const [rawArea, rawCount] of counts) {
    const area = text(rawArea, 40);
    const value = count(rawCount);
    if (area && value) out.areaCounts[area] = value;
  }
  // Older/incomplete records may have counts without the corresponding set entry.
  for (const area of Object.keys(out.areaCounts)) if (!out.areas.includes(area)) out.areas.push(area);
  out.firstDay = DAY_RE.test(text(raw?.firstDay, 10)) ? text(raw.firstDay, 10) : '';
  out.lastDay = DAY_RE.test(text(raw?.lastDay, 10)) ? text(raw.lastDay, 10) : '';
  out.tripIds = uniqueText(raw?.tripIds, 120);
  out._hadTripIds = Array.isArray(raw?.tripIds);
  out._legacyAggregate = !out._hadTripIds && out.visits > 0;
  return out;
}

function normalizedRawLedger(raw) {
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.places) ? raw.places : []);
  const map = new Map();
  for (const value of rows) {
    const row = normalizeEntry(value);
    if (!row) continue;
    const prior = map.get(row.placeId);
    if (!prior) {
      map.set(row.placeId, row);
      continue;
    }
    // Repeated rows are malformed input, not separate lifetime histories.
    prior.visits = Math.max(prior.visits, row.visits);
    prior.lastSequence = Math.max(prior.lastSequence, row.lastSequence);
    for (const area of row.areas) if (!prior.areas.includes(area)) prior.areas.push(area);
    for (const [area, value] of Object.entries(row.areaCounts)) prior.areaCounts[area] = Math.max(prior.areaCounts[area] || 0, value);
    for (const key of ['photos', 'events', 'phases']) {
      for (const item of row[key]) if (!prior[key].includes(item)) prior[key].push(item);
    }
    for (const id of row.tripIds) if (!prior.tripIds.includes(id)) prior.tripIds.push(id);
    if (row.firstDay && (!prior.firstDay || row.firstDay < prior.firstDay)) prior.firstDay = row.firstDay;
    if (row.lastDay && (!prior.lastDay || row.lastDay > prior.lastDay)) prior.lastDay = row.lastDay;
    if (!prior.placeName || prior.placeName === prior.placeId) prior.placeName = row.placeName;
    prior._hadTripIds ||= row._hadTripIds;
    prior._legacyAggregate ||= row._legacyAggregate;
  }
  return map;
}

function serialize(map) {
  return [...map.values()].map((entry) => {
    const { _hadTripIds, _legacyAggregate, ...plain } = entry;
    return {
      ...plain,
      areas: [...entry.areas],
      areaCounts: Object.fromEntries(Object.entries(entry.areaCounts)),
      photos: [...entry.photos],
      events: [...entry.events],
      phases: [...entry.phases],
      tripIds: [...entry.tripIds],
    };
  });
}

function dayFor(trip, timezone) {
  const stored = text(trip?.leftDay, 10);
  if (DAY_RE.test(stored)) return stored;
  const leftAt = Number(trip?.leftAt);
  if (!Number.isFinite(leftAt) || !leftAt) return '';
  try {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(leftAt));
    return DAY_RE.test(day) ? day : '';
  } catch {
    return '';
  }
}

function addUnique(target, values, max) {
  for (const value of uniqueText(values, max)) if (!target.includes(value)) target.push(value);
}

function addTripFacts(entry, trip, timezone) {
  entry.visits += 1;
  const visited = [];
  for (const item of asArray(trip?.visited)) {
    const area = text(item?.area, 40);
    if (!area) continue;
    visited.push(area);
    entry.areaCounts[area] = (entry.areaCounts[area] || 0) + 1;
  }
  addUnique(entry.areas, visited, 40);
  addUnique(entry.photos, trip?.photos, 60);
  addUnique(entry.events, trip?.events, 120);
  addUnique(entry.phases, trip?.phases, 60);
  const day = dayFor(trip, timezone);
  if (day && (!entry.firstDay || day < entry.firstDay)) entry.firstDay = day;
  if (day && (!entry.lastDay || day > entry.lastDay)) entry.lastDay = day;
  entry.placeName = text(trip?.placeName, 40) || entry.placeName || entry.placeId;
}

function addTrip(entry, trip, id, timezone) {
  const sequence = tripSequence(trip);
  if (sequence) {
    if (sequence <= entry.lastSequence) return false;
    // Older ledgers stored every trip ID. Preserve those IDs, but do not infer
    // sequence values from their arbitrary text; a matching ID is already counted.
    if (entry.tripIds.includes(id)) {
      entry.lastSequence = Math.max(entry.lastSequence, sequence);
      return false;
    }
    addTripFacts(entry, trip, timezone);
    entry.lastSequence = sequence;
    return true;
  }
  // Truly legacy trips have no usable sequence and need explicit ID provenance.
  if (entry.tripIds.includes(id)) return false;
  entry.tripIds.push(id);
  addTripFacts(entry, trip, timezone);
  return true;
}

function retainedTrips(input) {
  const rows = Array.isArray(input)
    ? input
    : [...asArray(input?.trips), ...asArray(input?.keepsakeTrips)];
  const seen = new Set();
  const out = [];
  for (const trip of rows) {
    if (!trip || typeof trip !== 'object' || Array.isArray(trip) || trip.storyRun?.canonical === false) continue;
    const placeId = text(trip.placeId, 40);
    const id = tripId(trip);
    if (!placeId || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({ trip, placeId, id });
  }
  return out.sort((a, b) => tripSequence(a.trip) - tripSequence(b.trip));
}

/**
 * Normalize the compact lifetime exploration ledger, seeding places absent from
 * it using only the retained trip records supplied by the caller. `trips` may be
 * an array or `{ trips, keepsakeTrips }`; duplicate trip IDs are counted once.
 * Existing aggregate rows without provenance are migrated conservatively: their
 * matching retained records are marked as represented, never added again.
 * Positive `trip.sequence` values use `lastSequence` as a compact per-place
 * high-water mark; `tripIds` remains for legacy/unsequenced IDs.
 *
 * Entry shape: `{ placeId, placeName, visits, lastSequence, areas, areaCounts,
 * photos, events, phases, firstDay, lastDay, tripIds }`.
 */
export function normalizeExploration(raw, trips = [], timezone = 'Asia/Shanghai') {
  const map = normalizedRawLedger(raw);
  for (const { trip, placeId, id } of retainedTrips(trips)) {
    let entry = map.get(placeId);
    if (!entry) {
      entry = emptyEntry(placeId, trip.placeName);
      entry._hadTripIds = true;
      map.set(placeId, entry);
    }
    if (entry._legacyAggregate) {
      const sequence = tripSequence(trip);
      if (sequence) entry.lastSequence = Math.max(entry.lastSequence, sequence);
      else if (!entry.tripIds.includes(id)) entry.tripIds.push(id);
      continue;
    }
    addTrip(entry, trip, id, timezone);
    entry._hadTripIds = true;
  }
  return serialize(map);
}

/** Add one completed trip to a ledger without mutating either input. */
export function recordExploration(ledger, trip, timezone = 'Asia/Shanghai') {
  const map = normalizedRawLedger(ledger);
  if (!trip || typeof trip !== 'object' || Array.isArray(trip) || trip.storyRun?.canonical === false) return serialize(map);
  const placeId = text(trip.placeId, 40);
  const id = tripId(trip);
  if (!placeId || !id) return serialize(map);
  let entry = map.get(placeId);
  if (!entry) {
    entry = emptyEntry(placeId, trip.placeName);
    entry._hadTripIds = true;
    map.set(placeId, entry);
  }
  addTrip(entry, trip, id, timezone);
  entry._hadTripIds = true;
  return serialize(map);
}

/** Return a copy of one place's lifetime entry, or null if it has no history. */
export function explorationFor(ledger, placeId) {
  const key = text(placeId, 40);
  if (!key) return null;
  const row = normalizedRawLedger(ledger).get(key);
  if (!row) return null;
  const { _hadTripIds, ...entry } = row;
  return {
    ...entry,
    areas: [...row.areas],
    areaCounts: Object.fromEntries(Object.entries(row.areaCounts)),
    photos: [...row.photos],
    events: [...row.events],
    phases: [...row.phases],
    tripIds: [...row.tripIds],
  };
}
