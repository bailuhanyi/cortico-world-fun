import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areasNow, checkPhases, descNow, eventsNow, hmToMin, phaseAt, phaseContains, phaseLabelAt,
} from '../src/phases.js';
import { VENUES, hoursState } from '../src/venues.js';

const byId = (id) => VENUES.find((v) => v.id === id);

test('phaseContains：普通段（to > from）', () => {
  const p = { from: '09:00', to: '12:00' };
  assert.equal(phaseContains(p, hmToMin('08:59')), false);
  assert.equal(phaseContains(p, hmToMin('09:00')), true);
  assert.equal(phaseContains(p, hmToMin('11:59')), true);
  assert.equal(phaseContains(p, hmToMin('12:00')), false, '右端是开区间');
});

test('phaseContains：跨夜段（to <= from）— 这是最容易写错的一条', () => {
  // 夜市「快收了」00:00–01:00；如果按普通段比较，23:xx 和 00:xx 都会判错。
  const late = { from: '23:00', to: '01:00' };
  assert.equal(phaseContains(late, hmToMin('23:30')), true);
  assert.equal(phaseContains(late, hmToMin('00:30')), true);
  assert.equal(phaseContains(late, hmToMin('00:59')), true);
  assert.equal(phaseContains(late, hmToMin('01:00')), false);
  assert.equal(phaseContains(late, hmToMin('12:00')), false, '中午不该落在跨夜段里');
  assert.equal(phaseContains(late, hmToMin('22:59')), false);
});

test('phaseContains：坏数据一律 false，不抛', () => {
  assert.equal(phaseContains(null, 600), false);
  assert.equal(phaseContains({ from: '25:00', to: '26:00' }, 600), false);
  assert.equal(phaseContains({ from: '09:00' }, 600), false);
  assert.equal(phaseContains({ from: '09:00', to: '12:00' }, NaN), false);
});

test('phaseAt：没有 phases 的场所返回 null（向后兼容，20 处里多数是这样）', () => {
  const plain = byId('aquarium');
  assert.equal(plain.phases, undefined);
  assert.deepEqual(phaseAt(plain, 600), { phase: null, index: -1 });
});

test('phaseAt：按顺序取第一个命中的', () => {
  const v = {
    phases: [
      { key: 'a', label: 'A', from: '09:00', to: '12:00' },
      { key: 'b', label: 'B', from: '11:00', to: '14:00' },   // 与 A 重叠
    ],
  };
  assert.equal(phaseAt(v, hmToMin('11:30')).phase.key, 'a', '重叠时取先写的那个');
  assert.equal(phaseAt(v, hmToMin('13:00')).phase.key, 'b');
  assert.equal(phaseAt(v, hmToMin('15:00')).phase, null);
});

test('descNow：有阶段用阶段的，没配阶段用场所原本的，都不空', () => {
  const river = byId('riverside');
  const dawn = descNow(river, hmToMin('06:30'));
  const night = descNow(river, hmToMin('22:00'));
  assert.match(dawn, /雾/);
  assert.match(night, /对岸的灯|航灯/);
  assert.notEqual(dawn, night, '清早和夜里必须是两段不一样的话');
  // 没配阶段的场所
  assert.equal(descNow(byId('aquarium'), 600), byId('aquarium').desc);
});

test('eventsNow：阶段事件排在通用事件前面（提高抽中概率）', () => {
  const river = byId('riverside');
  const pool = eventsNow(river, hmToMin('06:30'));
  assert.ok(pool.length > river.randomEvents.length, '阶段事件应当是追加，不是替换');
  // 前几条来自阶段
  assert.ok(river.phases[0].events.includes(pool[0]), '阶段事件要排在前面');
  // 通用事件也还在
  for (const e of river.randomEvents) assert.ok(pool.includes(e), '通用事件不能被丢掉');
});

test('areasNow：阶段能收窄可逛范围，且过滤掉逛过的', () => {
  const market = byId('market');
  const late = hmToMin('00:30');   // 快收了：只剩三家
  const all = areasNow(market, late, []);
  assert.ok(all.length < market.areas.length, '快收摊时的摊子应当变少');
  assert.ok(all.includes('烧烤摊'));

  const filtered = areasNow(market, late, ['烧烤摊']);
  assert.ok(!filtered.includes('烧烤摊'), '逛过的要过滤掉');

  // 全逛完了要返回全部（让她还能再逛），而不是空数组
  const exhausted = areasNow(market, late, all);
  assert.deepEqual(exhausted, all, '全逛完应当回落到全部，不该是空的');
});

test('areasNow：没配 phases 的场所用全部 areas', () => {
  const aquarium = byId('aquarium');
  assert.deepEqual(areasNow(aquarium, 600, []), aquarium.areas);
});

test('phaseLabelAt：给回执用，没有阶段返回空串', () => {
  assert.equal(phaseLabelAt(byId('riverside'), hmToMin('06:30')), '清早');
  assert.equal(phaseLabelAt(byId('aquarium'), 600), '');
});

test('实数据自检：五处有阶段的场所都合法', () => {
  const withPhases = VENUES.filter((v) => Array.isArray(v.phases));
  assert.ok(withPhases.length >= 5, `有阶段的场所太少：${withPhases.length}`);
  for (const v of withPhases) {
    const problems = checkPhases(v);
    assert.deepEqual(problems, [], `${v.name} 的阶段数据有问题`);
    assert.ok(v.phases.length >= 2, `${v.name} 至少该有两段，不然等于没分`);
  }
});

test('实数据：有阶段的场所在开放时段内必须被完整覆盖（不留空档）', () => {
  // 留了空档会静默回落到整段 desc——功能看起来没生效，但没有任何报错。
  for (const v of VENUES.filter((x) => Array.isArray(x.phases))) {
    const gaps = [];
    for (let m = 0; m < 1440; m += 5) {
      if (hoursState(v, m) === 'closed') continue;
      if (!phaseAt(v, m).phase) gaps.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    assert.deepEqual(gaps, [], `${v.name} 在这些时刻没有阶段（会回落到通用描写）：${gaps.slice(0, 6).join(' ')}`);
  }
});

test('实数据：阶段描写的长度和「只写空间」都合规', () => {
  for (const v of VENUES.filter((x) => Array.isArray(x.phases))) {
    for (const p of v.phases) {
      assert.ok(p.desc.length >= 40, `${v.name}/${p.label} 的 desc 太短`);
      // 只写空间与陈设，不能写她的姿势表情（会跟 imggen 的 pose 打架）
      assert.doesNotMatch(p.desc, /微笑|笑着|回头看镜头|摆姿势/, `${v.name}/${p.label} 写了姿势表情`);
      // 全角标点：半角分号/逗号混进来读起来别扭
      assert.doesNotMatch(p.desc, /;/, `${v.name}/${p.label} 里有半角分号`);
      if (Array.isArray(p.areas)) {
        for (const a of p.areas) {
          assert.ok(v.areas.includes(a), `${v.name}/${p.label} 的 areas「${a}」不在该场所的项目里`);
        }
      }
    }
  }
});

test('checkPhases：能查出写歪的阶段', () => {
  const bad = {
    name: '假的',
    hours: { open: '09:00', close: '18:00' },
    phases: [
      { key: 'a', label: 'A', from: '9:00', to: '12:00', desc: '这一段的描写' },      // from 不合法
      { key: 'a', label: '', from: '12:00', to: '12:00', desc: '' },                  // key 重复 + 缺 label + 零长度 + 缺 desc
    ],
  };
  const problems = checkPhases(bad);
  assert.ok(problems.length >= 3, `应当报出多个问题，实际：${problems.join(' / ')}`);
  assert.ok(problems.some((p) => /from/.test(p)));
  assert.ok(problems.some((p) => /key/.test(p)));
  assert.ok(problems.some((p) => /label/.test(p)));
});
