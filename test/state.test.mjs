import test from 'node:test';
import assert from 'node:assert/strict';

import { VENUES } from '../src/venues.js';
import {
  buySouvenir, closeSession, dayIn, enterVenue, hmIn, isStale, minutesIn,
  newState, normalizeState, photoSpotsFor, recentPlaceIds, souvenirsFor,
  takePhoto, tripSummary, venueById, visitedText, wanderOnce,
} from '../src/state.js';

const TZ = 'Asia/Shanghai';
const at = (s) => Date.parse(s);
const CON = VENUES.find((v) => v.id === 'con');

test('dayIn / hmIn / minutesIn 按时区算', () => {
  const t = at('2026-11-15T14:05:00+08:00');
  assert.equal(dayIn(TZ, t), '2026-11-15');
  assert.equal(hmIn(TZ, t), '14:05');
  assert.equal(minutesIn(TZ, t), 14 * 60 + 5);
});

test('normalizeState：跨天整份重来，坏数据不炸', () => {
  const day = '2026-11-15';
  assert.deepEqual(normalizeState(null, day), newState(day));
  assert.deepEqual(normalizeState({ day: '2026-11-14', session: { placeId: 'con' } }, day), newState(day));
  assert.deepEqual(normalizeState({ day, session: 'garbage', trips: 'nope' }, day), newState(day));
  // 同一天：session 与 trips 都补齐成当前形状。
  const s = normalizeState({
    day,
    session: { placeId: 'con', placeName: '漫展', visited: [{ area: '同人展台', at: 1 }, { bad: true }] },
    trips: [{ placeId: 'con', placeName: '漫展' }, { nothing: 1 }],
  }, day);
  assert.equal(s.session.placeName, '漫展');
  assert.equal(s.session.visited.length, 1, '坏 visited 项要丢掉');
  assert.equal(s.trips.length, 1, '坏 trip 要丢掉');
});

test('normalizeState：跨天只清 session，纪念册必须留着', () => {
  // 0.1.x 一直是「跨天整份重来」，于是 trips 活不过一天——做「去过的痕迹」时才发现
  // 纪念册每天清零，记了等于没记。这条钉住修好后的行为。
  const raw = {
    day: '2026-11-14',
    session: { placeId: 'con', placeName: '漫展', enteredAt: 1 },
    trips: [{ placeId: 'con', placeName: '漫展', enteredAt: 1, leftAt: 2, visited: [{ area: '同人展台' }] }],
  };
  const next = normalizeState(raw, '2026-11-15');
  assert.equal(next.day, '2026-11-15');
  assert.equal(next.session, null, '跨天不该接着逛昨天那趟');
  assert.equal(next.trips.length, 1, '纪念册要跨天留着');
  assert.equal(next.trips[0].placeName, '漫展');
});

test('enterVenue：进门建 session；已经在逛就不覆盖', () => {
  const day = '2026-11-15';
  const st = newState(day);
  const now = at('2026-11-15T14:00:00+08:00');
  const first = enterVenue(st, CON, now);
  assert.equal(first.already, false);
  assert.equal(st.session.placeName, '漫展');
  assert.equal(st.session.scene, '漫展');
  assert.equal(st.session.outfit, '宅卫衣');
  assert.equal(st.session.enteredAt, now);
  assert.deepEqual(st.session.visited, []);

  const aquarium = VENUES.find((v) => v.id === 'aquarium');
  const second = enterVenue(st, aquarium, now + 60000);
  assert.equal(second.already, true);
  assert.equal(st.session.placeId, 'con', '没先收摊就不该被换掉');
});

test('wanderOnce：不重复逛同一处，逛遍了会标记 exhausted', () => {
  const st = newState('2026-11-15');
  const now = at('2026-11-15T14:00:00+08:00');
  enterVenue(st, CON, now);
  const seen = new Set();
  for (let i = 0; i < CON.areas.length; i += 1) {
    const r = wanderOnce(st, CON, now + i * 60000, () => 0.3);
    assert.ok(r, `第 ${i + 1} 次逛应当有结果`);
    assert.ok(!seen.has(r.area), `不该连着逛同一处：${r.area}`);
    seen.add(r.area);
  }
  assert.equal(st.session.visited.length, CON.areas.length);
  const extra = wanderOnce(st, CON, now + 999000, () => 0.3);
  assert.ok(extra, '逛遍了仍能再逛一遍（不报错）');
  assert.equal(extra.exhausted, true);
});

test('wanderOnce 没有 session 时返回 null（调用方给提示，不抛）', () => {
  const st = newState('2026-11-15');
  assert.equal(wanderOnce(st, CON, Date.now()), null);
});

test('买纪念品 / 拍照：同一件记一次，重复会标出来', () => {
  const st = newState('2026-11-15');
  enterVenue(st, CON, at('2026-11-15T14:00:00+08:00'));
  const a = buySouvenir(st, '吧唧', at('2026-11-15T14:10:00+08:00'));
  assert.deepEqual([a.item, a.duplicate], ['吧唧', false]);
  const b = buySouvenir(st, '吧唧', at('2026-11-15T14:20:00+08:00'));
  assert.equal(b.duplicate, true);
  assert.deepEqual(st.session.souvenirs, ['吧唧']);

  const p1 = takePhoto(st, '海报墙前', at('2026-11-15T14:30:00+08:00'));
  assert.equal(p1.duplicate, false);
  const p2 = takePhoto(st, '海报墙前', at('2026-11-15T14:40:00+08:00'));
  assert.equal(p2.duplicate, true);
  assert.deepEqual(st.session.photos, ['海报墙前']);
});

test('拍照点 / 纪念品候选会过滤掉已经买过的', () => {
  const st = newState('2026-11-15');
  enterVenue(st, CON, Date.now());
  buySouvenir(st, CON.souvenirs[0], Date.now());
  takePhoto(st, CON.photoSpots[0], Date.now());
  assert.ok(!souvenirsFor(st.session, CON).includes(CON.souvenirs[0]));
  assert.ok(!photoSpotsFor(st.session, CON).includes(CON.photoSpots[0]));
});

test('closeSession：收摊进纪念册、算停留时长、session 清空', () => {
  const entered = at('2026-11-15T14:00:00+08:00');
  const left = at('2026-11-15T15:30:00+08:00');
  const st = newState('2026-11-15');
  enterVenue(st, CON, entered);
  wanderOnce(st, CON, entered + 1000, () => 0);
  buySouvenir(st, '吧唧', entered + 2000);
  takePhoto(st, '海报墙前', entered + 3000);

  const closed = closeSession(st, left, '腿有点酸');
  assert.equal(st.session, null);
  assert.equal(st.trips.length, 1);
  assert.equal(closed.stayedMin, 90);
  assert.equal(closed.note, '腿有点酸');
  assert.equal(closed.trip.placeName, '漫展');
  assert.equal(closed.trip.leftAt, left);
  assert.deepEqual(closed.trip.souvenirs, ['吧唧']);

  assert.equal(closeSession(st, left), null, '没在逛时收摊返回 null');
});

test('closeSession 超过 MAX_TRIPS 会裁掉最老的', () => {
  const st = newState('2026-11-15');
  const base = at('2026-11-15T10:00:00+08:00');
  for (let i = 0; i < 45; i += 1) {
    enterVenue(st, CON, base + i * 60000);
    closeSession(st, base + i * 60000 + 1000);
  }
  assert.equal(st.trips.length, 40);
  assert.equal(st.trips[0].enteredAt, base + 44 * 60000, '最近的一趟在最前面');
});

test('isStale：超过 TTL 才算挂太久', () => {
  const st = newState('2026-11-15');
  const entered = at('2026-11-15T14:00:00+08:00');
  enterVenue(st, CON, entered);
  assert.equal(isStale(st.session, entered + 30 * 60000, 90), false);
  assert.equal(isStale(st.session, entered + 91 * 60000, 90), true);
  assert.equal(isStale(null, entered, 90), false);
});

test('tripSummary / visitedText 说人话，空的时候也有话', () => {
  const st = newState('2026-11-15');
  enterVenue(st, CON, at('2026-11-15T14:00:00+08:00'));
  wanderOnce(st, CON, at('2026-11-15T14:05:00+08:00'), () => 0);
  buySouvenir(st, '吧唧', at('2026-11-15T14:06:00+08:00'));
  takePhoto(st, '海报墙前', at('2026-11-15T14:07:00+08:00'));
  const text = tripSummary(st.session);
  assert.match(text, /漫展/);
  assert.match(text, /买了吧唧/);
  assert.match(text, /拍了照/);
  assert.equal(visitedText(newState('2026-11-15').session), '还没逛到哪儿');
});

test('recentPlaceIds：在逛的地方排最前，去重', () => {
  const st = newState('2026-11-15');
  const base = at('2026-11-15T10:00:00+08:00');
  const aquarium = VENUES.find((v) => v.id === 'aquarium');
  enterVenue(st, CON, base);
  closeSession(st, base + 1000);
  enterVenue(st, aquarium, base + 2000);
  closeSession(st, base + 3000);
  assert.deepEqual(recentPlaceIds(st), ['aquarium', 'con']);

  enterVenue(st, CON, base + 4000);
  assert.equal(recentPlaceIds(st)[0], 'con', '正在逛的排最前');
});

test('venueById 找不到返回 null', () => {
  assert.equal(venueById('con').name, '漫展');
  assert.equal(venueById('nope'), null);
});
