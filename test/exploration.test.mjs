import test from 'node:test';
import assert from 'node:assert/strict';

import { explorationFor, normalizeExploration, recordExploration } from '../src/exploration.js';
import { progressFor } from '../src/keepsakes.js';

const trip = (id, overrides = {}) => ({
  id,
  placeId: 'con',
  placeName: '漫展',
  leftDay: '2026-11-15',
  visited: [{ area: '展台区' }, { area: '展台区' }],
  photos: ['入口墙'],
  events: ['抽中徽章'],
  phases: ['傍晚'],
  souvenirs: ['徽章'],
  ...overrides,
});

test('recordExploration stores compact lifetime totals, unique lists, counts, dates, and provenance', () => {
  let ledger = recordExploration([], trip('con-1'));
  ledger = recordExploration(ledger, trip('con-2', {
    leftDay: '2026-11-18',
    visited: [{ area: '展台区' }, { area: '签售区' }],
    photos: ['入口墙', '签售台'],
    events: ['抽中徽章', '碰见作者'],
    phases: ['夜晚'],
  }));
  const entry = explorationFor(ledger, 'con');
  assert.equal(entry.visits, 2);
  assert.deepEqual(entry.areas, ['展台区', '签售区']);
  assert.deepEqual(entry.areaCounts, { '展台区': 3, '签售区': 1 });
  assert.deepEqual(entry.photos, ['入口墙', '签售台']);
  assert.deepEqual(entry.events, ['抽中徽章', '碰见作者']);
  assert.deepEqual(entry.phases, ['傍晚', '夜晚']);
  assert.equal(entry.firstDay, '2026-11-15');
  assert.equal(entry.lastDay, '2026-11-18');
  assert.deepEqual(entry.tripIds, ['con-1', 'con-2']);
  assert.equal(explorationFor(ledger, 'missing'), null);
});

test('record and normalize are idempotent across repeats, restart, and re-fed ancient trips', () => {
  const old = trip('con-old', { leftDay: '2026-01-03', visited: [{ area: '展台区' }] });
  const newer = trip('con-new', { leftDay: '2026-11-15', visited: [{ area: '签售区' }] });
  let ledger = recordExploration([], old);
  ledger = recordExploration(ledger, newer);
  ledger = recordExploration(ledger, newer);
  const restarted = normalizeExploration(JSON.parse(JSON.stringify(ledger)), [newer, old, old]);
  const entry = explorationFor(restarted, 'con');
  assert.equal(entry.visits, 2);
  assert.deepEqual(entry.areaCounts, { '展台区': 1, '签售区': 1 });
  assert.deepEqual(entry.tripIds, ['con-old', 'con-new']);
});

test('normalize seeds missing places from deduplicated recent and kept trips only', () => {
  const recent = trip('trip-a');
  const favoriteCopy = { ...recent, favorite: true };
  const other = trip('trip-b', { placeId: 'park', placeName: '公园', visited: [{ area: '湖边' }] });
  const ledger = normalizeExploration(null, { trips: [recent], keepsakeTrips: [favoriteCopy, other] });
  assert.equal(explorationFor(ledger, 'con').visits, 1);
  assert.equal(explorationFor(ledger, 'park').visits, 1);
  assert.deepEqual(normalizeExploration(ledger, [recent, favoriteCopy, other]), ledger);
});

test('legacy aggregate without IDs is not re-counted during migration', () => {
  const old = trip('already-counted');
  const legacy = [{ placeId: 'con', placeName: '漫展', visits: 7, areas: ['展台区'], areaCounts: { '展台区': 4 }, firstDay: '2026-01-01', lastDay: '2026-11-01' }];
  const migrated = normalizeExploration(legacy, [old]);
  assert.equal(explorationFor(migrated, 'con').visits, 7);
  assert.deepEqual(explorationFor(migrated, 'con').tripIds, ['already-counted']);
  assert.equal(explorationFor(normalizeExploration(migrated, [old]), 'con').visits, 7);
  const next = recordExploration(migrated, trip('new-trip', { leftDay: '2026-11-20' }));
  assert.equal(explorationFor(next, 'con').visits, 8);
});

test('bad input is tolerated and invalid timezones do not lose a stored local day', () => {
  assert.deepEqual(normalizeExploration('bad', [null, 2, { placeId: 'con', id: 'ok', leftDay: '2026-11-19', visited: 'bad' }], 'bad-zone')[0].firstDay, '2026-11-19');
  const fallbackDay = normalizeExploration(null, [{ placeId: 'con', id: 'fallback', leftAt: Date.parse('2026-11-17T06:20:00+08:00') }], 'Asia/Shanghai')[0].firstDay;
  assert.equal(fallbackDay, '2026-11-17');
  assert.doesNotThrow(() => recordExploration([{ placeId: 4, visits: 'bad', areas: 8 }], null));
  assert.doesNotThrow(() => explorationFor(null, 'con'));
});

test('progressFor uses lifetime visits and areas/photos plus the persistent collection', () => {
  const place = { id: 'con', areas: ['展台区', '签售区'], souvenirs: ['徽章'], photoSpots: ['入口墙', '签售台'] };
  const recent = [trip('recent', { visited: [], photos: [], souvenirs: [] })];
  const ledger = normalizeExploration(null, [trip('old', { visited: [{ area: '展台区' }], photos: ['入口墙'], souvenirs: ['徽章'] })]);
  const p = progressFor(place, recent, [{ placeId: 'con', name: '徽章', times: 4 }], ledger);
  assert.equal(p.visits, 1, 'reports ledger lifetime visits, not recent trip length');
  assert.deepEqual(p.areas.got, ['展台区']);
  assert.deepEqual(p.photos.got, ['入口墙']);
  assert.deepEqual(p.souvenirs.got, ['徽章']);
  const legacy = progressFor(place, recent);
  assert.equal(legacy.visits, 1);
  assert.deepEqual(legacy.areas.got, []);
  const emptyLifetime = progressFor(place, recent, [], []);
  assert.equal(emptyLifetime.visits, 0);
  assert.deepEqual(emptyLifetime.areas.got, []);
});

test('positive sequences stay compact and persist the per-place high-water mark', () => {
  let ledger = [];
  for (let sequence = 1; sequence <= 500; sequence += 1) {
    ledger = recordExploration(ledger, trip(`seq-${sequence}`, {
      sequence,
      visited: [{ area: `area-${sequence}` }],
      leftDay: `2026-${String(Math.floor((sequence - 1) / 28) % 12 + 1).padStart(2, '0')}-01`,
    }));
  }
  const entry = explorationFor(ledger, 'con');
  assert.equal(entry.visits, 500);
  assert.equal(entry.lastSequence, 500);
  assert.deepEqual(entry.tripIds, [], 'sequenced trips need no growing ID set');
  const restarted = normalizeExploration(JSON.parse(JSON.stringify(ledger)));
  assert.equal(explorationFor(restarted, 'con').lastSequence, 500);
  assert.equal(explorationFor(restarted, 'con').visits, 500);
});

test('descending retained sequenced trips seed all facts, then old re-feeds are ignored', () => {
  const trips = Array.from({ length: 500 }, (_, i) => {
    const sequence = 500 - i;
    return trip(`trip-${sequence}`, {
      sequence,
      visited: [{ area: `area-${sequence}` }],
      photos: [`photo-${sequence}`],
      events: [`event-${sequence}`],
      phases: [`phase-${sequence}`],
      leftDay: '2026-11-15',
    });
  });
  const ledger = normalizeExploration(null, trips);
  const entry = explorationFor(ledger, 'con');
  assert.equal(entry.visits, 500);
  assert.equal(entry.lastSequence, 500);
  assert.equal(entry.areas.length, 500);
  assert.equal(entry.photos.length, 500);
  assert.equal(entry.events.length, 500);
  assert.equal(entry.phases.length, 500);
  assert.deepEqual(entry.tripIds, []);
  const ancient = trips.at(-1);
  const reFed = normalizeExploration(ledger, [ancient]);
  assert.equal(explorationFor(reFed, 'con').visits, 500);
  assert.deepEqual(explorationFor(reFed, 'con').areas, entry.areas);
});

test('legacy arbitrary IDs are preserved, while explicit sequence wins over old stored IDs', () => {
  const legacyId = trip('legacy-arbitrary-id');
  let ledger = recordExploration([], legacyId);
  ledger = recordExploration(ledger, trip('formerly-stored-seq-id', { sequence: 1 }));
  assert.deepEqual(explorationFor(ledger, 'con').tripIds, ['legacy-arbitrary-id']);
  const migrated = normalizeExploration(ledger, [trip('formerly-stored-seq-id', { sequence: 2 })]);
  const entry = explorationFor(migrated, 'con');
  assert.equal(entry.visits, 3, 'sequence 2 is a new trip despite arbitrary legacy ID text');
  assert.equal(entry.lastSequence, 2);
  assert.deepEqual(entry.tripIds, ['legacy-arbitrary-id']);
});
