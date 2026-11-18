import test from 'node:test';
import assert from 'node:assert/strict';

import { VENUES } from '../src/venues.js';
import { collectSouvenirs, progressFor, progressLine } from '../src/keepsakes.js';

const CON = VENUES.find((v) => v.id === 'con');
const AMUSEMENT = VENUES.find((v) => v.id === 'amusement');

/** 造一趟历史（只带纪念品架要用的字段）。 */
function trip({ placeId = 'con', placeName = '漫展', day = '2026-11-15', visited = [], souvenirs = [], photos = [] } = {}) {
  return {
    placeId,
    placeName,
    leftDay: day,
    visited: visited.map((area) => ({ area, note: '', at: 0 })),
    souvenirs,
    photos,
    ate: [],
    events: [],
  };
}

test('长期收藏账本脱离近期行程窗口，首次日期和累计次数继续保留', () => {
  const collection = [{ key: 'con::吧唧', placeId: 'con', placeName: '漫展', name: '吧唧', firstDay: '2026-01-01', lastDay: '2026-11-17', times: 3, tripIds: ['old-1', 'old-2', 'recent-1'] }];
  const rack = collectSouvenirs([], 'Asia/Shanghai', collection);
  assert.equal(rack.items.length, 1);
  assert.equal(rack.items[0].firstDay, '2026-01-01');
  assert.equal(rack.items[0].times, 3);
  assert.equal(rack.total, 3);
});

test('collectSouvenirs：同名东西在不同地方算两件', () => {
  // 游乐场的棉花糖和公园的棉花糖不是一样东西。
  const rack = collectSouvenirs([
    trip({ placeId: 'amusement', placeName: '游乐场', souvenirs: ['棉花糖'] }),
    trip({ placeId: 'park', placeName: '公园', souvenirs: ['棉花糖'] }),
  ]);
  assert.equal(rack.items.length, 2, '两处各有一件，不是一件买两次');
  assert.equal(rack.uniquePlaces, 2);
  assert.equal(rack.total, 2);
});

test('collectSouvenirs：同一处买两次算一件、次数记 2，第一次的日期要留住', () => {
  // trips 是最近的在前：先遇到 11-16，后来才遇到 11-14，firstDay 必须往前覆盖。
  const rack = collectSouvenirs([
    trip({ day: '2026-11-16', souvenirs: ['吧唧'] }),
    trip({ day: '2026-11-14', souvenirs: ['吧唧'] }),
  ]);
  assert.equal(rack.items.length, 1);
  assert.equal(rack.items[0].times, 2);
  assert.equal(rack.items[0].firstDay, '2026-11-14', '第一次拿到的那天');
  assert.equal(rack.items[0].lastDay, '2026-11-16');
  assert.equal(rack.total, 2, '总件数按次数算');
});

test('collectSouvenirs：空纪念册给空架子，不抛', () => {
  for (const input of [[], null, undefined, 'nope', [null, 1, 'x']]) {
    const rack = collectSouvenirs(input);
    assert.deepEqual(rack.items, []);
    assert.equal(rack.total, 0);
    assert.equal(rack.uniquePlaces, 0);
  }
});

test('collectSouvenirs：脏数据跳过那一条，别的照常归集', () => {
  const rack = collectSouvenirs([
    trip({ souvenirs: ['吧唧', '', null, 123] }),
    null,
    { placeId: 'con', placeName: '漫展' },   // 没有 souvenirs 字段
  ]);
  assert.equal(rack.items.length, 1);
  assert.equal(rack.items[0].name, '吧唧');
});

test('collectSouvenirs：按地方分组，组里带最早的日期', () => {
  const rack = collectSouvenirs([
    trip({ day: '2026-11-16', souvenirs: ['吧唧', '色纸'] }),
    trip({ placeId: 'amusement', placeName: '游乐场', day: '2026-11-15', souvenirs: ['气球'] }),
  ]);
  assert.equal(rack.byPlace.length, 2);
  const con = rack.byPlace.find((g) => g.placeId === 'con');
  assert.equal(con.items.length, 2);
  assert.equal(con.firstDay, '2026-11-16');
});

test('progressFor：按这一处统计，别的处不算进来', () => {
  const trips = [
    trip({ visited: ['同人展台'], souvenirs: ['吧唧'], photos: ['海报墙前'] }),
    trip({ placeId: 'amusement', placeName: '游乐场', visited: ['过山车'], souvenirs: ['气球'] }),
  ];
  const p = progressFor(CON, trips);
  assert.equal(p.visits, 1, '只数漫展那趟');
  assert.deepEqual(p.areas.got, ['同人展台']);
  assert.equal(p.souvenirs.done, 1);
  assert.equal(p.photos.done, 1);
  assert.equal(p.areas.total, CON.areas.length);
});

test('progressFor：没去过时全差着，但 visits 是 0', () => {
  const p = progressFor(CON, []);
  assert.equal(p.visits, 0);
  assert.equal(p.areas.done, 0);
  assert.deepEqual(p.areas.got, []);
  assert.equal(p.areas.complete, false);
  assert.equal(p.percent, 0);
});

test('progressFor：全逛遍时 complete 为 true', () => {
  const trips = [trip({ visited: [...CON.areas], souvenirs: [...CON.souvenirs], photos: [...CON.photoSpots] })];
  const p = progressFor(CON, trips);
  assert.equal(p.areas.complete, true);
  assert.deepEqual(p.areas.left, []);
  assert.equal(p.percent, 100);
});

test('progressFor：场所没配纪念品时不算「没集齐」', () => {
  // 有些地方本来就没有纪念品，不能因此永远显示未完成。
  const place = { ...CON, souvenirs: [], photoSpots: [] };
  const p = progressFor(place, [trip({ visited: [...CON.areas] })]);
  assert.equal(p.souvenirs.total, 0);
  assert.equal(p.souvenirs.complete, false, '没有就不该说「集齐了」（0 件不算集齐）');
  assert.equal(p.areas.complete, true);
});

test('progressFor：脏数据不抛', () => {
  assert.doesNotThrow(() => progressFor(null, null));
  assert.doesNotThrow(() => progressFor(CON, [null, { visited: 'x', souvenirs: 3 }]));
  const p = progressFor(CON, [null, { placeId: 'con', visited: [{ bad: 1 }, { area: ' 舞台区 ' }] }]);
  assert.deepEqual(p.areas.got, ['舞台区'], '要去空白再比对');
});

test('progressLine：点出还差什么，全逛遍了返回空串', () => {
  const partial = progressFor(CON, [trip({ visited: ['同人展台'] })]);
  const line = progressLine(partial);
  assert.match(line, /这儿还差/);
  assert.match(line, /企业馆/, '要具体点名');

  const done = progressFor(CON, [trip({ visited: [...CON.areas] })]);
  assert.equal(progressLine(done), '', '全逛遍了就不说这句');
  assert.equal(progressLine(null), '');
});

test('progressLine：超过上限时说「等 N 处」，不列一长串', () => {
  const p = progressFor(CON, [trip({ visited: [] })]);
  const line = progressLine(p, 2);
  assert.match(line, /等 \d+ 处/);
});

test('collectSouvenirs：没有 leftDay 的老数据回退到 leftAt', () => {
  const old = {
    placeId: 'con',
    placeName: '漫展',
    leftAt: Date.parse('2026-11-15T14:00:00+08:00'),
    souvenirs: ['吧唧'],
    visited: [],
    photos: [],
  };
  const rack = collectSouvenirs([old]);
  assert.equal(rack.items[0].firstDay, '2026-11-15');
});

test('progressFor 用的是自填地点的字段（合并表传进来就行）', () => {
  const custom = {
    id: 'user-abc',
    name: '旧书店',
    areas: ['书架间', '老板的柜台'],
    souvenirs: ['一本旧书'],
    photoSpots: ['窗边的椅子'],
  };
  const p = progressFor(custom, [
    trip({ placeId: 'user-abc', placeName: '旧书店', visited: ['书架间'], souvenirs: ['一本旧书'] }),
  ]);
  assert.equal(p.areas.done, 1);
  assert.equal(p.areas.total, 2);
  assert.equal(p.souvenirs.complete, true);
});

test('纪念品关联每趟同行人和备注，同趟重复名字不重复计数', () => {
  const old = { ...trip({ day: '2026-11-14', souvenirs: ['吧唧', '吧唧'] }), company: '阿岚', note: '排了很久，但很开心' };
  const recent = { ...trip({ day: '2026-11-16', souvenirs: ['吧唧'] }), company: '小鱼', note: '又来了一次' };
  const before = JSON.stringify([recent, old]);
  const item = collectSouvenirs([recent, old]).items[0];
  assert.equal(item.times, 2);
  assert.equal(item.memories.length, 2);
  assert.equal(item.memories[1].company, '阿岚');
  assert.equal(item.memories[1].note, '排了很久，但很开心');
  assert.match(item.memories[1].summary, /跟阿岚一起/);
  assert.equal(JSON.stringify([recent, old]), before, '归集不改写旧记录');
});

test('旧记录凌晨日期按指定时区解释，存下的 leftDay 优先', () => {
  const old = { placeId: 'con', souvenirs: ['吧唧'], leftAt: Date.parse('2026-11-17T06:20:00+08:00') };
  assert.equal(collectSouvenirs([old], 'Asia/Shanghai').items[0].firstDay, '2026-11-17');
  assert.equal(collectSouvenirs([old], 'America/New_York').items[0].firstDay, '2026-11-16');
  assert.equal(collectSouvenirs([{ ...old, leftDay: '2026-11-15' }]).items[0].firstDay, '2026-11-15');
  assert.equal(collectSouvenirs([{ ...old, leftAt: 'broken' }]).items[0].firstDay, '');
});

test('编辑清单后按当前精确名字统计，历史物品保留且不模糊认同', () => {
  const old = trip({ visited: ['旧展台'], souvenirs: ['旧徽章'], photos: ['旧窗边'] });
  const changed = { id: 'con', areas: ['新展台', '新展台'], souvenirs: ['新徽章'], photoSpots: [] };
  const p = progressFor(changed, [old]);
  assert.equal(p.areas.total, 1, '重复清单项不扩大分母');
  assert.equal(p.areas.done, 0);
  assert.equal(p.souvenirs.done, 0);
  assert.equal(collectSouvenirs([old]).items[0].name, '旧徽章');
  assert.deepEqual(old.visited.map((v) => v.area), ['旧展台']);
  assert.doesNotThrow(() => progressFor(changed, [{ placeId: 'con', visited: 3, souvenirs: {}, photos: 8 }]));
});

test('游乐场也能算：确认不是只对漫展有效', () => {
  const p = progressFor(AMUSEMENT, [trip({ placeId: 'amusement', placeName: '游乐场', visited: ['过山车'] })]);
  assert.equal(p.areas.done, 1);
  assert.ok(p.areas.left.includes('鬼屋'));
});
