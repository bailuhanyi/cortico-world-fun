import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REGULAR_VISITS, cameEarlierToday, dayPhrase, filterRepeatedEvents, historyFor, isRegular,
  memoryLine, pickEvent, regularLine, untriedAreas,
} from '../src/memories.js';

const at = (s) => Date.parse(s);

/** 造一趟历史。 */
function trip({ placeId = 'con', placeName = '漫展', left = '2026-11-14T17:00:00+08:00', visited = [], souvenirs = [], ate = [], photos = [], events = [] } = {}) {
  return {
    placeId,
    placeName,
    scene: '',
    outfit: '',
    enteredAt: at(left) - 3600000,
    leftAt: at(left),
    visited: visited.map((area) => ({ area, note: '', at: 0 })),
    souvenirs,
    photos,
    ate: ate.map((item) => ({ item, verb: '吃', at: 0 })),
    events,
  };
}

test('dayPhrase：今天 / 昨天 / 前天 / N 天前 / 具体日期', () => {
  assert.equal(dayPhrase('2026-11-15', '2026-11-15'), '今天');
  assert.equal(dayPhrase('2026-11-14', '2026-11-15'), '昨天');
  assert.equal(dayPhrase('2026-11-13', '2026-11-15'), '前天');
  assert.equal(dayPhrase('2026-11-10', '2026-11-15'), '5 天前');
  assert.equal(dayPhrase('2026-11-01', '2026-11-15'), '11 月 01 日');
  // 坏数据不编说法
  assert.equal(dayPhrase('', '2026-11-15'), '');
  assert.equal(dayPhrase('2026-11-15', ''), '2026-11-15');
});

test('historyFor：没去过返回 null（第一次去不该有「上次」的口气）', () => {
  assert.equal(historyFor([], 'con', '2026-11-15'), null);
  assert.equal(historyFor([trip()], 'aquarium', '2026-11-15'), null, '别的场所不算');
  assert.equal(historyFor(null, 'con', '2026-11-15'), null);
});

test('historyFor：只统计这一处，次数和各项都归并', () => {
  const trips = [
    trip({ left: '2026-11-14T17:00:00+08:00', visited: ['同人展台', '同人展台', '舞台区'], souvenirs: ['吧唧', '吧唧'], photos: ['海报墙前'] }),
    trip({ left: '2026-11-13T16:00:00+08:00', visited: ['同人展台'], souvenirs: ['色纸'] }),
    trip({ placeId: 'aquarium', placeName: '海洋馆', left: '2026-11-12T16:00:00+08:00', visited: ['鲸豚湾'] }),
  ];
  const h = historyFor(trips, 'con', '2026-11-15');
  assert.equal(h.visitCount, 2, '只算漫展那两趟');
  assert.equal(h.lastDay, '2026-11-14');
  assert.equal(h.lastDayPhrase, '昨天');
  assert.deepEqual(h.areas.map((a) => [a.area, a.times]), [['同人展台', 3], ['舞台区', 1]]);
  assert.deepEqual(h.souvenirs.map((s) => [s.item, s.times]), [['吧唧', 2], ['色纸', 1]]);
  assert.deepEqual(h.photos.map((p) => [p.spot, p.times]), [['海报墙前', 1]]);
  assert.equal(h.firstDay, '2026-11-13');
});

test('historyFor：脏数据不抛', () => {
  const h = historyFor([{ placeId: 'con', visited: 'nope', souvenirs: null, leftAt: 'bogus' }], 'con', '2026-11-15');
  assert.equal(h.visitCount, 1);
  assert.deepEqual(h.areas, []);
  assert.doesNotThrow(() => historyFor([{ placeId: 'con' }], 'con'));
});

test('memoryLine：话不多，只讲记得住的', () => {
  const h = historyFor([
    trip({ visited: ['同人展台', '同人展台'], souvenirs: ['吧唧'] }),
  ], 'con', '2026-11-15');
  const line = memoryLine(h, '2026-11-15');
  assert.match(line, /来过这里 1 次/);
  assert.match(line, /上一次是昨天/);
  assert.match(line, /同人展台（2 次）/);
  assert.match(line, /买过吧唧/);
  // 不编情感话术
  assert.doesNotMatch(line, /记得|怀念|还记得吗|好怀念/);
});

test('memoryLine：没来过返回 null', () => {
  assert.equal(memoryLine(null, '2026-11-15'), null);
  assert.equal(memoryLine({ visitCount: 0 }, '2026-11-15'), null);
});

test('memoryLine：上一次就是今天时，不再重复「上一次是今天」', () => {
  const h = historyFor([trip({ left: '2026-11-15T10:00:00+08:00' })], 'con', '2026-11-15');
  const line = memoryLine(h, '2026-11-15');
  assert.doesNotMatch(line, /上一次是今天/, '调用方会先说「今天已经来过」，这里别复读');
  assert.match(line, /来过这里 1 次/);
});

test('cameEarlierToday：同一天的前一趟才算', () => {
  const sameDay = historyFor([trip({ left: '2026-11-15T10:00:00+08:00' })], 'con', '2026-11-15');
  assert.equal(cameEarlierToday(sameDay, '2026-11-15'), true);
  const yesterday = historyFor([trip({ left: '2026-11-14T10:00:00+08:00' })], 'con', '2026-11-15');
  assert.equal(cameEarlierToday(yesterday, '2026-11-15'), false);
  assert.equal(cameEarlierToday(null, '2026-11-15'), false);
});

test('untriedAreas：点出她还没逛的那几处', () => {
  const h = historyFor([trip({ visited: ['同人展台'] })], 'con', '2026-11-15');
  const untried = untriedAreas(h, ['同人展台', '企业馆', '舞台区', '海报墙']);
  assert.deepEqual(untried, ['企业馆', '舞台区', '海报墙']);
  // max 生效
  assert.equal(untriedAreas(h, ['a', 'b', 'c', 'd', 'e', 'f'], 2).length, 2);
  // 全逛过就是空数组
  assert.deepEqual(untriedAreas(h, ['同人展台'], 4), []);
});

test('filterRepeatedEvents：她真做过的事才拦，没做过的一律放过', () => {
  const h = historyFor([
    trip({ souvenirs: ['吧唧'], ate: ['珍珠奶茶'], photos: ['海报墙前'] }),
  ], 'con', '2026-11-15');
  const events = [
    '吧唧挑了半天，最后把一整组都买了',   // 买过吧唧 → 拦
    '在展台前遇到同好，聊了很久',          // 无关 → 留
    '排本子排了一个多小时',                // 无关 → 留
    '喝了一杯珍珠奶茶',                    // 喝过 → 拦
    '在海报墙前拍了照',                    // 拍过 → 拦
  ];
  const left = filterRepeatedEvents(events, h);
  assert.deepEqual(left, ['在展台前遇到同好，聊了很久', '排本子排了一个多小时']);
});

test('filterRepeatedEvents：没有历史就原样返回', () => {
  const events = ['a', 'b'];
  assert.deepEqual(filterRepeatedEvents(events, null), ['a', 'b']);
  assert.deepEqual(filterRepeatedEvents(events, { souvenirs: [], ate: [], photos: [] }), ['a', 'b']);
  assert.deepEqual(filterRepeatedEvents(null, null), []);
});

test('historyFor 的 lastTrip 是最近那一趟', () => {
  const trips = [
    trip({ left: '2026-11-14T17:00:00+08:00', visited: ['舞台区'] }),
    trip({ left: '2026-11-13T16:00:00+08:00', visited: ['同人展台'] }),
  ];
  const h = historyFor(trips, 'con', '2026-11-15');
  assert.deepEqual(h.lastTrip.visited.map((v) => v.area), ['舞台区']);
});

test('filterRepeatedEvents：以前碰上过的那条不再出现（events 是死数据，现在接上了）', () => {
  // historyFor 一直算着 events，但没人用它——同一处去五次，事件池只有五条，
  // 第五次就全是旧话。这条钉住「接上了」。
  const events = ['排队排了四十分钟', '套中了一个歪歪的小熊', '没碰过的新事'];
  const h = { souvenirs: [], ate: [], photos: [], events: ['排队排了四十分钟'] };
  const left = filterRepeatedEvents(events, h);
  assert.deepEqual(left, ['套中了一个歪歪的小熊', '没碰过的新事']);
});

test('filterRepeatedEvents：既拦「做过的」也拦「见过的」', () => {
  const events = ['买了吧唧', '碰见过的', '全新的'];
  const h = { souvenirs: [{ item: '吧唧', times: 1 }], ate: [], photos: [], events: ['碰见过的'] };
  assert.deepEqual(filterRepeatedEvents(events, h), ['全新的']);
});

test('pickEvent：优先这趟没碰过的；全碰过了也要给一条，不能不给', () => {
  const pool = ['a', 'b', 'c'];
  assert.equal(pickEvent([], [], () => 0), null);
  // 这趟碰过 a：从 b/c 里挑，random 0 取到 b
  assert.equal(pickEvent(pool, ['a'], () => 0), 'b');
  // 全碰过：退回全池，仍然给一条
  assert.equal(pickEvent(pool, ['a', 'b', 'c'], () => 0), 'a');
  // 池子里只有跑过的那条：也得给
  assert.equal(pickEvent(['a'], ['a'], () => 0), 'a');
});

test('isRegular：5 趟起才算常客', () => {
  assert.equal(REGULAR_VISITS, 5);
  assert.equal(isRegular(null), false);
  assert.equal(isRegular({ visitCount: 4 }), false);
  assert.equal(isRegular({ visitCount: 5 }), true);
});

test('regularLine：不够格时一个字都不给', () => {
  assert.equal(regularLine(null, '猫咖'), '');
  assert.equal(regularLine({ visitCount: 4 }, '猫咖'), '', '4 趟还不到常客，不该说认得了');
});

test('regularLine：够格时给一句带地方名和次数的话，且稳定不随机', () => {
  const h = { visitCount: 5 };
  const a = regularLine(h, '猫咖');
  assert.ok(a.length > 0);
  assert.match(a, /猫咖/, '要带地方名');
  assert.match(a, /5/, '要带次数');
  assert.equal(regularLine(h, '猫咖'), a, '同一个次数永远同一句话');
  // 次数不同时句子会变，但都还带次数
  assert.notEqual(regularLine({ visitCount: 6 }, '猫咖'), a);
  assert.match(regularLine({ visitCount: 6 }, '猫咖'), /6/);
});
