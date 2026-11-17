import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

import {
  CROWD_LABEL, KIND_LABEL, VENUES, allPlaces, findVenue, hasFood, hasScene, hmToMin, hoursState, pickSome, suggestPlaces,
} from '../src/venues.js';

const AQUARIUM = VENUES.find((v) => v.id === 'aquarium');
const FAIR = VENUES.find((v) => v.id === 'templefair');
const CON = VENUES.find((v) => v.id === 'con');
const CINEMA = VENUES.find((v) => v.id === 'cinema');

test('全部场所齐全，每条的玩法/纪念品/拍照点都填了', () => {
  // 数量绑到实际库：加场所时这条不该红，红的是「新条目字段没填全」那些。
  assert.ok(VENUES.length >= 15, `场所太少：${VENUES.length}`);
  for (const v of VENUES) {
    assert.ok(v.name, `${v.id} 缺正名`);
    assert.ok(v.areas.length >= 5, `${v.id} 能逛的太少`);
    assert.ok(v.souvenirs.length, `${v.id} 缺纪念品`);
    assert.ok(v.photoSpots.length, `${v.id} 缺拍照点`);
    assert.ok(v.randomEvents.length >= 3, `${v.id} 随机事件太少`);
    assert.ok(v.desc.length > 40, `${v.id} desc 太短`);
    assert.ok(typeof v.scene === 'string', `${v.id} 的 scene 必须是字符串（空串也在）`);
    // desc 只写空间与陈设：出现姿势/表情词会跟 imggen 的 pose / expression 打架。
    assert.doesNotMatch(v.desc, /微笑|笑着|回头看镜头|摆姿势/, `${v.id} 的 desc 写了姿势表情`);
  }
  // id 与正名都不重复（别名可以重，正名不行）
  assert.equal(new Set(VENUES.map((v) => v.id)).size, VENUES.length, 'id 有重复');
  assert.equal(new Set(VENUES.map((v) => v.name)).size, VENUES.length, '正名有重复');
});

test('有 scene 的场所必须真的是素材库里有的那几处（不去编库里没有的名字）', () => {
  assert.equal(VENUES.find((v) => v.id === 'amusement').scene, '游乐场');
  assert.equal(VENUES.find((v) => v.id === 'con').scene, '漫展');
  // 海洋馆用「水族馆」正名、庙会用「神社」正名——素材库里本来就有，只补别名。
  assert.equal(AQUARIUM.scene, '水族馆');
  assert.equal(FAIR.scene, '神社');
  // 咖啡店在素材库里也确实有（scenes/咖啡店/），实读确认过。
  assert.equal(VENUES.find((v) => v.id === 'cafe').scene, '咖啡店');

  const withScene = VENUES.filter(hasScene).map((v) => v.id).sort();
  assert.deepEqual(withScene, ['amusement', 'aquarium', 'cafe', 'con', 'templefair'],
    '有 scene 的应当是这五处；多一处就意味着替她编了一个库里可能没有的名字');
  for (const v of VENUES.filter((x) => !hasScene(x))) {
    assert.equal(v.scene, '', `${v.name} 的 scene 应当是空串`);
  }
});

test('scene 指向的名字在 live 素材库里真的存在（能读到库时才查）', async () => {
  // 这一条依赖本机素材库：读不到就跳过（降级是第一公民，绝不因此把测试判红）。
  const lib = process.env.FUN_IMGGEN_LIB
    || 'E:/Coopanion/data/home/companion/data/imggen-library/scenes';
  let names;
  try {
    const dirs = await readdir(lib, { withFileTypes: true });
    names = new Set(dirs.filter((d) => d.isDirectory()).map((d) => d.name));
  } catch {
    return; // 没有库：不查
  }
  for (const v of VENUES.filter(hasScene)) {
    assert.ok(names.has(v.scene), `${v.name} 的 scene「${v.scene}」在素材库里没有——这就是「编了一个不存在的名字」`);
  }
});

test('能吃能喝的场所：food 只写品类名，绝不写味道', () => {
  const foodVenues = VENUES.filter(hasFood);
  // 不写死是哪几处（加场所时这条不该红），只钉住「至少这三处，且都合规」。
  const names = foodVenues.map((v) => v.name);
  for (const must of ['咖啡店', '奶茶店', '餐厅']) {
    assert.ok(names.includes(must), `${must} 应当有 food`);
  }
  for (const v of foodVenues) {
    assert.ok(v.food.label && v.food.verb, `${v.name} 缺 label/verb`);
    assert.ok(v.food.items.length >= 4, `${v.name} 能吃能喝的太少`);
    assert.ok(['吃', '喝'].includes(v.food.verb), `${v.name} 的 verb 只能是吃/喝`);
    // 味道归「鱼的每一天」：这里出现任何口感词都说明数据放错了地方。
    for (const item of v.food.items) {
      assert.doesNotMatch(item, /香|甜度|顺滑|回甘|浓郁|弹牙|醇厚/,
        `「${item}」写了味道——味道不该出现在这个插件的数据里`);
    }
  }
});

test('kind 不与别的场所 id 撞车（0.1.3 猫咖踩过：kind 叫 cafe，而 cafe 是咖啡店的 id）', () => {
  const ids = new Set(VENUES.map((v) => v.id));
  const kinds = new Set(VENUES.map((v) => v.kind));
  for (const kind of kinds) {
    assert.ok(KIND_LABEL[kind], `kind「${kind}」没有中文标签`);
  }
  // 一个 id 如果同时是别人的 kind，按 kind 筛/按名字查就会打架。
  for (const v of VENUES) {
    if (v.kind === v.id) continue;                    // 自己 kind 等于自己 id，正常
    assert.ok(!ids.has(v.kind),
      `${v.name} 的 kind「${v.kind}」撞上了另一处的 id，会让筛选和查名错位`);
  }
});

test('findVenue 认正名 / 别名 / id，找不到返回 null 而不是抛错', () => {
  assert.equal(findVenue(VENUES, '漫展').id, 'con');
  assert.equal(findVenue(VENUES, '同人展').id, 'con');
  assert.equal(findVenue(VENUES, 'con').id, 'con');
  assert.equal(findVenue(VENUES, '海洋馆').id, 'aquarium');
  assert.equal(findVenue(VENUES, '水族馆').id, 'aquarium');
  assert.equal(findVenue(VENUES, '夏日祭').id, 'templefair');
  assert.equal(findVenue(VENUES, '过山车').id, 'amusement');
  assert.equal(findVenue(VENUES, '从来没听过'), null);
  assert.equal(findVenue(VENUES, ''), null);
  assert.equal(findVenue(VENUES, undefined), null);
});

test('hoursState：开着 / 快关了 / 已经关了，含打烊前一小时', () => {
  assert.equal(hoursState(CON, hmToMin('12:00')), 'open');
  assert.equal(hoursState(CON, hmToMin('17:30')), 'closingSoon');
  assert.equal(hoursState(CON, hmToMin('19:00')), 'closed');
  assert.equal(hoursState(CON, hmToMin('09:00')), 'closed');
  // 庙会 17:00–22:00
  assert.equal(hoursState(FAIR, hmToMin('18:00')), 'open');
  assert.equal(hoursState(FAIR, hmToMin('21:30')), 'closingSoon');
  assert.equal(hoursState(FAIR, hmToMin('14:00')), 'closed');
});

test('hoursState 认得跨夜的场（open > close）', () => {
  const night = { hours: { open: '20:00', close: '02:00' } };
  assert.equal(hoursState(night, hmToMin('23:00')), 'open');
  // 01:00 距 02:00 打烊正好一小时，按「快关了」算。
  assert.equal(hoursState(night, hmToMin('01:00')), 'closingSoon');
  assert.equal(hoursState(night, hmToMin('00:30')), 'open');
  assert.equal(hoursState(night, hmToMin('03:00')), 'closed');
  assert.equal(hoursState(night, hmToMin('12:00')), 'closed');
});

test('suggestPlaces：开着的排前面，刚去过的不删只排后面', () => {
  const noon = suggestPlaces(hmToMin('12:00'), 4, []);
  assert.equal(noon.length, 4);
  assert.equal(noon[0].state, 'open', '正午第一项应当是开着的');
  const noonAvoid = suggestPlaces(hmToMin('12:00'), 4, ['con']);
  // 漫展可能还在列表里（也可能被挤出去），但在列表里时一定不在第一位。
  const conIdx = noonAvoid.findIndex((p) => p.venue.id === 'con');
  if (conIdx >= 0) assert.notEqual(conIdx, 0, '刚去过的不该排第一');
});

test('suggestPlaces 的 count 会被夹在 1–8，坏值回落 4；allPlaces 不截断', () => {
  assert.equal(suggestPlaces(600, 0, []).length, 1);
  assert.equal(suggestPlaces(600, 99, []).length, 8, '上限是 8');
  assert.equal(suggestPlaces(600, 'abc', []).length, 4);
  assert.equal(suggestPlaces(600, 12, []).length, 8);
  // 全列走 allPlaces：全部都在，且开的排在前面。
  const all = allPlaces(hmToMin('12:00'), []);
  assert.equal(all.length, VENUES.length);
  assert.equal(all[0].state, 'open');
  assert.ok(all.every((p, i) => i === 0 || all[i - 1].state !== 'closed' || p.state === 'closed'), '关着的必须都排在后面');
});

test('pickSome 不重复、不越界、空数组安全', () => {
  const picked = pickSome(['a', 'b', 'c'], 2, () => 0);
  assert.equal(picked.length, 2);
  assert.equal(new Set(picked).size, 2);
  assert.deepEqual(pickSome([], 3), []);
  assert.deepEqual(pickSome(['a'], 9), ['a']);
  assert.deepEqual(pickSome(['a', 'b'], 0), []);
});

test('hmToMin 只认合法 HH:MM', () => {
  assert.equal(hmToMin('09:30'), 570);
  assert.equal(hmToMin('0:05'), 5);
  assert.equal(hmToMin('24:00'), null);
  assert.equal(hmToMin('9:60'), null);
  assert.equal(hmToMin(''), null);
  assert.equal(hmToMin(undefined), null);
});

test('文案表覆盖全部场所类别和三种拥挤度', () => {
  for (const v of VENUES) assert.ok(KIND_LABEL[v.kind], `${v.kind} 缺中文标签`);
  assert.ok(CROWD_LABEL.quiet && CROWD_LABEL.normal && CROWD_LABEL.packed);
});
