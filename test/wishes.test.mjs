import test from 'node:test';
import assert from 'node:assert/strict';
import { addWish, changeWish, fulfillWishes, normalizeWishes, wishReason } from '../src/wishes.js';

const input = (overrides = {}) => ({ placeId: 'park', placeName: '公园', type: 'area', target: '湖边', reason: '想去看看', ...overrides });

test('normalizes malformed data and caps retained entries', () => {
  assert.deepEqual(normalizeWishes(null), []);
  const result = normalizeWishes([null, {}, ...Array.from({ length: 105 }, (_, i) => ({ ...input(), id: `id-${i}` }))]);
  assert.equal(result.length, 100);
  assert.equal(result[0].reason, '想去看看');
  assert.equal(normalizeWishes([{ ...input(), createdAt: Symbol('bad') }]).length, 1);
  assert.equal(normalizeWishes([{ ...input(), type: 'unknown' }]).length, 0);
  assert.equal(normalizeWishes([{ ...input(), status: 'unknown' }])[0].status, 'active');
});

test('adds wishes, deduplicates active and paused wishes, and creates unique same-time ids', () => {
  const first = addWish([], input(), 1000);
  const paused = changeWish(first.wishes, first.wish.id, 'pause', 1001);
  const duplicate = addWish(paused.wishes, input(), 1002);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.wish.status, 'paused');
  const second = addWish(first.wishes, input({ type: 'visit', target: '' }), 1000);
  assert.notEqual(first.wish.id, second.wish.id);
  assert.equal(second.wish.type, 'visit');
  assert.equal(addWish([], input({ reason: '长'.repeat(150) })).wish.reason.length, 120);
  assert.equal(addWish([], input({ status: 'completed' })).wish.status, 'active');
});

test('reports capacity instead of dropping retained history', () => {
  const list = Array.from({ length: 100 }, (_, i) => ({ ...input(), id: `id-${i}`, target: `目标${i}`, status: 'completed' }));
  const result = addWish(list, input({ target: 'new' }), 2000);
  assert.equal(result.wishes.length, 100);
  assert.equal(result.wishes[0].id, 'id-0');
  assert.match(result.error, /100/);
});

test('change operations are idempotent and terminal wishes cannot resume', () => {
  const added = addWish([], input(), 1000);
  const before = JSON.stringify(added.wishes);
  const paused = changeWish(added.wishes, added.wish.id, 'pause', 1001);
  assert.equal(JSON.stringify(added.wishes), before);
  assert.equal(changeWish(paused.wishes, added.wish.id, 'pause', 1002).wish.updatedAt, paused.wish.updatedAt);
  const resumed = changeWish(paused.wishes, added.wish.id, 'resume', 1003);
  assert.equal(resumed.wish.status, 'active');
  const cancelled = changeWish(paused.wishes, added.wish.id, 'cancel', 1003);
  assert.equal(changeWish(cancelled.wishes, added.wish.id, 'resume', 1004).wish.status, 'cancelled');
  const done = fulfillWishes(added.wishes, { placeId: 'park', area: '湖边' }, 1003);
  assert.equal(changeWish(done.wishes, added.wish.id, 'resume', 1004).wish.status, 'completed');
  assert.ok(changeWish(added.wishes, 'missing', 'pause').error);
  assert.ok(changeWish(added.wishes, added.wish.id, 'invalid').error);
  assert.equal(addWish(cancelled.wishes, input(), 1000).wishes.length, 2);
});

test('fulfills only active exact matches and gives concise active wish reason', () => {
  const wishes = [
    { ...input({ type: 'visit', target: '' }), id: 'visit' },
    { ...input(), id: 'area' },
    { ...input({ type: 'phase', target: '黄昏' }), id: 'phase' },
    { ...input({ type: 'souvenir', target: '风车' }), id: 'souvenir' },
    { ...input({ type: 'area', target: '湖边', placeId: 'other' }), id: 'other' },
    { ...input({ type: 'area', target: '湖边', status: 'paused' }), id: 'paused' },
  ];
  const before = JSON.stringify(wishes);
  assert.match(wishReason(wishes, { id: 'park' }, 60), /想去看看/);
  const mismatch = fulfillWishes(wishes, { placeId: 'park', area: '湖', phase: '黄昏时', souvenirs: ['小风车'] }, 3000);
  assert.deepEqual(mismatch.completed.map((w) => w.id), ['visit']);
  const done = fulfillWishes(wishes, { placeId: 'park', area: '湖边', phase: '黄昏', souvenirs: ['风车'] }, 3000);
  assert.deepEqual(done.completed.map((w) => w.id), ['visit', 'area', 'phase', 'souvenir']);
  assert.equal(done.completed[0].completedAt, new Date(3000).toISOString());
  assert.equal(done.wishes.find((w) => w.id === 'paused').status, 'paused');
  assert.equal(done.wishes.find((w) => w.id === 'other').status, 'active');
  assert.equal(wishReason(done.wishes, 'park', 60), '');
  assert.deepEqual(fulfillWishes(done.wishes, { placeId: 'park', area: '湖边' }, 4000).completed, []);
  assert.equal(JSON.stringify(wishes), before);
});

test('same inputs produce the same results without mutating callers', () => {
  const raw = [input()];
  assert.deepEqual(normalizeWishes(raw), normalizeWishes(raw));
  assert.deepEqual(addWish([], input(), 42), addWish([], input(), 42));
  assert.match(wishReason([{ ...input(), reason: '' }], { placeId: 'park' }), /心愿/);
  assert.deepEqual(fulfillWishes(null, null), { wishes: [], completed: [] });
});
