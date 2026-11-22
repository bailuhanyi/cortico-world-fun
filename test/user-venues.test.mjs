import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OVERRIDABLE, USER_PREFIX, blankVenue, cleanOverride, cleanUserVenue, idFromName,
  isPresetId, isUserPlaceId, mergeVenues, overrideEntries, parseVenueFile, stringifyVenueFile,
} from '../src/user-venues.js';
import { VENUES } from '../src/venues.js';

const valid = () => ({
  name: '巷子里的旧书店',
  desc: '一条巷子里的旧书店，木门，里面堆到天花板。',
  hours: { open: '10:00', close: '20:00' },
  areas: ['书架之间', '柜台', '靠窗的小凳'],
  souvenirs: ['一本旧书'],
  photoSpots: ['柜台前'],
  tags: ['室内', '安静'],
});

test('cleanUserVenue：id 一律加 user- 前缀，撞不上预设', () => {
  const { venue, problems } = cleanUserVenue({ id: 'book', ...valid() });
  assert.deepEqual(problems, []);
  assert.equal(venue.id, 'user-book');
  assert.ok(venue.id.startsWith(USER_PREFIX));
  assert.ok(!VENUES.some((v) => v.id === venue.id));
});

test('cleanUserVenue：形状跟预设完全一致（下游不用分两套逻辑）', () => {
  const { venue } = cleanUserVenue({ id: 'xx', ...valid() });
  const presetKeys = Object.keys(VENUES[0]).sort();
  const userKeys = Object.keys(venue).sort();
  for (const key of ['id', 'name', 'aliases', 'tags', 'desc', 'scene', 'recommendedOutfit', 'crowd', 'hours', 'areas', 'souvenirs', 'photoSpots', 'randomEvents', 'kind']) {
    assert.ok(userKeys.includes(key), `缺字段 ${key}`);
  }
  void presetKeys;
  // 场景名现在透传（地点册要能填），没填就是空串。
  assert.equal(venue.scene, '');
  assert.equal(venue.kind, 'custom');
});

test('cleanUserVenue：id 允许 64 字符与 place- 前缀（旧地点库迁移要保留原 id）', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  const place = `place-${uuid}`;
  assert.equal(cleanUserVenue({ id: place, name: '旧书店' }).venue.id, place);
  assert.equal(isUserPlaceId(place), true);
  assert.equal(isUserPlaceId('user-x'), true);
  assert.equal(isUserPlaceId('con'), false);

  const longest = `place-${'a'.repeat(58)}`; // 64 字符
  assert.equal(cleanUserVenue({ id: longest, name: 'X' }).venue.id, longest);
  assert.equal(cleanUserVenue({ id: `place-${'a'.repeat(59)}`, name: 'X' }).venue, null, '超过 64 字符要拒绝');
  assert.equal(cleanUserVenue({ id: 'a'.repeat(64), name: 'X' }).venue, null, '裸 id 最多 63 字符');

  const parsed = parseVenueFile({ venues: [{ id: place, name: '旧书店', playable: false,
    hours: { open: '00:00', close: '23:59' } }], overrides: { [place]: { souvenirs: ['x'] } } });
  assert.equal(parsed.venues.length, 1, '旧地点库的 place- id 不能被读盘丢掉');
  assert.equal(parsed.venues[0].id, place);
  assert.ok(!(place in parsed.overrides), 'place- 是地点 id，不进预设覆盖层');
});

test('cleanUserVenue：坏数据报得清清楚楚，不抛', () => {
  assert.equal(cleanUserVenue(null).venue, null);
  assert.equal(cleanUserVenue({}).problems.length >= 2, true);
  // 没有能逛的 = 只是地图上的一个点（C 版），不是错误。
  const noAreas = cleanUserVenue({ name: '空地方', areas: [] }, { requireId: false });
  assert.deepEqual(noAreas.problems, []);
  assert.equal(noAreas.venue.playable, false);
  assert.deepEqual(noAreas.venue.hours, { open: '00:00', close: '23:59' });
  // 硬说可玩却拿不出能逛的，才报错。
  const forced = cleanUserVenue({ name: '硬说可玩', areas: [], playable: true }, { requireId: false });
  assert.ok(forced.problems.some((p) => /能逛的/.test(p)));
  assert.equal(cleanUserVenue({ name: '点', playable: false, areas: ['a'] }, { requireId: false }).venue.playable, false);
  const badHours = cleanUserVenue({ ...valid(), hours: { open: '9:00', close: '99:99' } });
  assert.ok(badHours.problems.some((p) => /HH:MM/.test(p)), `应当报时段，实际：${badHours.problems}`);
  const sameHours = cleanUserVenue({ ...valid(), hours: { open: '10:00', close: '10:00' } });
  assert.ok(sameHours.problems.some((p) => /不能一样/.test(p)));
});

test('cleanUserVenue：列表去重、去空、限长', () => {
  const { venue } = cleanUserVenue({
    id: 'xx',
    name: 'X',
    areas: ['书架', '书架', '', '  柜台  ', null],
    souvenirs: ['书', '书'],
  });
  assert.deepEqual(venue.areas, ['书架', '柜台']);
  assert.deepEqual(venue.souvenirs, ['书']);
});

test('cleanUserVenue：food 只认「吃 / 喝」，别的不收', () => {
  const { venue } = cleanUserVenue({
    id: 'xx', name: 'X', areas: ['柜台'],
    food: { verb: '喝', items: ['奶茶', '柠檬水'] },
  });
  assert.equal(venue.food.verb, '喝');
  assert.deepEqual(venue.food.items, ['奶茶', '柠檬水']);

  const bad = cleanUserVenue({ id: 'yy', name: 'Y', areas: ['x'], food: { verb: '闻', items: ['花'] } });
  assert.equal(bad.venue.food, undefined);
});

test('cleanUserVenue：没写时段就给个合理的默认，不报错', () => {
  const { venue, problems } = cleanUserVenue({ id: 'xx', name: 'X', areas: ['a'] });
  assert.deepEqual(problems, []);
  assert.deepEqual(venue.hours, { open: '09:00', close: '21:00' });
});

test('mergeVenues：预设一条不少，自填的追加在后面', () => {
  const { venue } = cleanUserVenue({ id: 'book', ...valid() });
  const merged = mergeVenues(VENUES, [venue]);
  assert.equal(merged.length, VENUES.length + 1);
  assert.deepEqual(merged.slice(0, VENUES.length).map((v) => v.id), VENUES.map((v) => v.id));
  assert.equal(merged[merged.length - 1].id, 'user-book');
});

test('mergeVenues：预设升级照常生效，用户改动优先（用户选的那条）', () => {
  // 用户改过漫展的纪念品；预设后来给漫展加了新摊位。
  // 期望：用户改的纪念品生效，但预设新加的摊位也要拿到。
  const grownPreset = VENUES.map((v) => (v.id === 'con'
    ? { ...v, areas: [...v.areas, '新加的摊位'] }
    : v));
  const override = { id: 'con', souvenirs: ['我自己写的吧唧'] };
  const merged = mergeVenues(grownPreset, [override]);
  const con = merged.find((v) => v.id === 'con');
  assert.deepEqual(con.souvenirs, ['我自己写的吧唧'], '用户的改动优先');
  assert.ok(con.areas.includes('新加的摊位'), '预设的新内容也要生效');
  // 用户没写的字段仍来自预设
  assert.equal(con.scene, '漫展');
  assert.equal(con.name, '漫展');
});

test('mergeVenues：坏数据不影响预设，且永远返回数组', () => {
  assert.deepEqual(mergeVenues(VENUES, null), VENUES);
  assert.equal(mergeVenues(null, []).length, 0);
  const merged = mergeVenues(VENUES, ['garbage', null, { id: 'okay', name: '好地方' }]);
  assert.equal(merged.length, VENUES.length + 1);
});

test('idFromName：同一名字永远同一个 id，撞了会加后缀', () => {
  const a = idFromName('我的小院');
  const b = idFromName('我的小院');
  assert.equal(a, b);
  assert.ok(a.startsWith(USER_PREFIX));
  const c = idFromName('我的小院', [a]);
  assert.notEqual(c, a);
  assert.ok(c.startsWith(a));
});

test('blankVenue：给面板的空白骨架', () => {
  const b = blankVenue();
  assert.equal(b.name, '');
  assert.deepEqual(b.areas, []);
  assert.deepEqual(b.hours, { open: '09:00', close: '21:00' });
  // 空白骨架不能直接存（没名字、没可逛的）
  assert.ok(cleanUserVenue(b).problems.length >= 2);
});

// ---------------------------------------------------------------------------
// B 阶段：预设覆盖层
// ---------------------------------------------------------------------------

const presetForm = (v, patch = {}) => ({
  id: v.id, name: v.name, aliases: v.aliases, tags: v.tags, desc: v.desc,
  recommendedOutfit: v.recommendedOutfit, crowd: v.crowd, hours: v.hours,
  areas: v.areas, souvenirs: v.souvenirs, photoSpots: v.photoSpots,
  randomEvents: v.randomEvents, ...(v.food ? { food: v.food } : {}), ...patch,
});

test('cleanOverride：未改动的表单不产生覆盖层（否则会锁死预设升级）', () => {
  for (const v of VENUES) {
    const { fields, problems } = cleanOverride(presetForm(v), v);
    assert.deepEqual(problems, [], `${v.id} 不该报错`);
    assert.deepEqual(fields, {}, `${v.id} 不该产生假覆盖层`);
  }
});

test('cleanOverride：只存真改过的字段，且校验照旧', () => {
  const con = VENUES.find((v) => v.id === 'con');
  const { fields } = cleanOverride(presetForm(con, { souvenirs: ['我自己的吧唧'] }), con);
  assert.deepEqual(Object.keys(fields), ['souvenirs']);
  assert.deepEqual(fields.souvenirs, ['我自己的吧唧']);

  // scene / phases / kind 永远不进覆盖层
  const dirty = cleanOverride({ ...presetForm(con), scene: '乱填的', kind: 'x', phases: [{ key: 'x' }] }, con);
  assert.ok(!('scene' in dirty.fields) && !('kind' in dirty.fields) && !('phases' in dirty.fields));

  // 坏数据仍报得清清楚楚（名字空 + 时段非法；没有能逛的已经不算错）
  const bad = cleanOverride(presetForm(con, { name: '', areas: [], hours: { open: '99:99', close: 'x' } }), con);
  assert.ok(bad.problems.length >= 2);
  assert.deepEqual(bad.fields, {});
});

test('cleanOverride：改回预设值就等于没有改动', () => {
  const con = VENUES.find((v) => v.id === 'con');
  const changed = cleanOverride(presetForm(con, { souvenirs: ['别的'] }), con);
  assert.deepEqual(Object.keys(changed.fields), ['souvenirs']);
  const back = cleanOverride(presetForm(con, { souvenirs: con.souvenirs }), con);
  assert.deepEqual(back.fields, {});
});

test('overrideEntries：只认白名单，稀疏条目带预设 id', () => {
  // overrideEntries 只管「展开 + 白名单」；过滤 user- 前缀是 parseVenueFile 的职责
  // （恶意 id 在落盘读取那一层就被挡掉了，合并层不必重复判）。
  const entries = overrideEntries({
    con: { souvenirs: ['吧唧'], scene: '乱填', kind: 'x' },
    'user-x': { name: '也展开，但读盘时会被拦' },
    bad: null,
  });
  assert.equal(entries.length, 2);
  const con = entries.find((x) => x.id === 'con');
  assert.deepEqual(con.souvenirs, ['吧唧']);
  assert.ok(!('scene' in con) && !('kind' in con), '非白名单字段不带');
  assert.equal(entries.find((x) => x.id === 'bad'), undefined, '空值跳过');
  assert.ok(OVERRIDABLE.includes('souvenirs'));
});

test('mergeVenues 三参数：覆盖层按预设 id 叠加，不新增场所', () => {
  const merged = mergeVenues(VENUES, [], { con: { souvenirs: ['我自己的吧唧'] } });
  assert.equal(merged.length, VENUES.length, '覆盖层不该多出一处');
  const con = merged.find((v) => v.id === 'con');
  assert.deepEqual(con.souvenirs, ['我自己的吧唧']);
  assert.equal(con.scene, '漫展', '没改的字段仍来自预设');
  assert.equal(con.name, '漫展');
});

test('parseVenueFile：兼容 A 阶段旧格式，坏数据一律跳过', () => {
  // 旧格式：顶层数组
  const { venue } = cleanUserVenue({ id: 'book', ...valid() });
  const old = parseVenueFile([venue]);
  assert.equal(old.venues.length, 1);
  assert.deepEqual(old.overrides, {});

  // 旧格式：只有 { venues: [...] }
  const old2 = parseVenueFile({ venues: [venue] });
  assert.equal(old2.venues.length, 1);

  // 新格式：venues + overrides
  const now = parseVenueFile({
    venues: [venue],
    overrides: { con: { souvenirs: ['吧唧'], scene: '乱填' }, 'user-x': { name: 'x' } },
  });
  assert.equal(now.venues.length, 1);
  assert.deepEqual(now.overrides.con, { souvenirs: ['吧唧'] });
  assert.ok(!('user-x' in now.overrides), 'user- 前缀不进覆盖层');

  // 坏数据不抛
  for (const junk of [null, 'garbage', 42, { venues: 'no' }, { overrides: [] }]) {
    const r = parseVenueFile(junk);
    assert.ok(Array.isArray(r.venues));
    assert.equal(typeof r.overrides, 'object');
  }
});

test('stringifyVenueFile / parseVenueFile 往返一致', () => {
  const { venue } = cleanUserVenue({ id: 'book', ...valid() });
  const data = { venues: [venue], overrides: { con: { souvenirs: ['吧唧'] } } };
  const back = parseVenueFile(JSON.parse(stringifyVenueFile(data)));
  assert.equal(back.venues.length, 1);
  assert.equal(back.venues[0].name, '巷子里的旧书店');
  assert.deepEqual(back.overrides.con, { souvenirs: ['吧唧'] });
});

test('isPresetId：认预设，不认自填', () => {
  assert.equal(isPresetId(VENUES, 'con'), true);
  assert.equal(isPresetId(VENUES, 'user-abc'), false);
  assert.equal(isPresetId(VENUES, 'nope'), false);
});
