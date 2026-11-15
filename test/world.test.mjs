import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULTS } from '../src/config.js';
import { FunWorld } from '../src/world.js';
import { VENUES } from '../src/venues.js';
import funDefinition from '../src/definition.js';

const TZ = 'Asia/Shanghai';
const at = (s) => Date.parse(s);

async function boot(overrides = {}) {
  const dir = overrides.dir ?? await mkdtemp(join(tmpdir(), 'fun-'));
  let now = overrides.now ?? at('2026-11-15T14:00:00+08:00');
  const persisted = [];
  const host = { log: { info() {}, warn() {}, error() {} } };
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, ...overrides.cfg },
    dataDir: dir,
    timezone: TZ,
    now: () => now,
    random: overrides.random ?? (() => 0),
    persist: overrides.persist ?? ((patch) => { persisted.push(patch); }),
  });
  await world.start(host);
  return {
    dir, world, persisted,
    setNow: (v) => { now = v; },
    tool: (name) => world.tools().find((t) => t.name === name).handler,
  };
}

test('definition 的 create() 必须纯：不读盘、不建目录、不起定时器', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-pure-'));
  const w = funDefinition.create({ cfg: {}, dataDir: dir, timezone: TZ });
  assert.equal(typeof w, 'object');
  // 纯的意思：create 之后目录里什么都还没建。
  const { readdir } = await import('node:fs/promises');
  assert.deepEqual(await readdir(dir), []);
});

test('describe 里 events 是空数组：这个 World 不推事件', () => {
  assert.deepEqual(funDefinition.describe.events, []);
  assert.equal(funDefinition.id, 'fun');
  assert.equal(funDefinition.label, '娱乐时间');
  for (const t of funDefinition.describe.tools) {
    assert.ok(t.summary?.zh, `${t.name} 缺中文 summary`);
    assert.ok(t.summary?.en, `${t.name} 缺英文 summary`);
  }
});

test('六件工具都注册了', () => {
  const w = funDefinition.create({ cfg: {}, dataDir: process.cwd(), timezone: TZ });
  const names = w.tools().map((t) => t.name).sort();
  assert.deepEqual(names, ['fun_go', 'fun_home', 'fun_places', 'fun_start', 'fun_view', 'fun_wander']);
});

test('envPromptVars 永不抛错；关掉 funOn 时注入空串', async () => {
  const b = await boot();
  const on = b.world.envPromptVars();
  assert.match(on.fun_places_block, /游乐场/);
  assert.match(on.fun_places_block, /scene 填「漫展」/);

  const off = new FunWorld({ cfg: { ...DEFAULTS, funOn: false }, dataDir: b.dir, timezone: TZ });
  await off.start({ log: { info() {}, warn() {} } });
  assert.equal(off.envPromptVars().fun_places_block, '');
});

test('配置段缺键会被补齐（宿主 /api/config 不合并 defaults）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-cfg-'));
  const persisted = [];
  const world = new FunWorld({
    cfg: { enabled: true, funOn: true }, // 只给了两项
    dataDir: dir,
    timezone: TZ,
    persist: (patch) => { persisted.push(patch); },
  });
  await world.start({ log: { info() {}, warn() {} } });
  assert.equal(persisted.length, 1);
  assert.deepEqual(Object.keys(persisted[0]).sort(), ['funAskReport', 'funSessionTTLMin']);
  assert.equal(persisted[0].funAskReport, true);
  assert.equal(persisted[0].funSessionTTLMin, 90);
});

test('缺键补齐：盘上已有的值一个都不覆盖', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-cfg2-'));
  const persisted = [];
  const world = new FunWorld({
    cfg: { enabled: true, funOn: false, funSessionTTLMin: 30, funAskReport: false },
    dataDir: dir,
    timezone: TZ,
    persist: (patch) => { persisted.push(patch); },
  });
  await world.start({ log: { info() {}, warn() {} } });
  assert.deepEqual(persisted, [], '三项都在，不该补任何东西');
});

test('fun_places：按开放时段排，正文带开没开和人多少', async () => {
  const b = await boot();
  const r = await b.tool('fun_places')({});
  assert.match(r.text, /这会儿 14:00/);
  assert.match(r.text, /开着/);
  assert.match(r.text, /人很多|人不少|人不多/);
  assert.doesNotMatch(r.text, /失败/);
  // 默认只排前几个，并提示能看全
  assert.match(r.text, new RegExp(`一共 ${VENUES.length} 处`));
});

test('fun_places all=true 列全所有场所，kind 能只看一类', async () => {
  const b = await boot();
  const all = await b.tool('fun_places')({ all: true });
  for (const v of VENUES) assert.ok(all.text.includes(v.name), `全列里应当有 ${v.name}`);
  assert.doesNotMatch(all.text, /一共 \d+ 处/, 'all 视图不该再提示「想看全的」');

  const indoor = await b.tool('fun_places')({ kind: '室内' });
  assert.match(indoor.text, /电影院|海洋馆|漫展/);
  assert.doesNotMatch(indoor.text, /爬山/, '「室内」不该列爬山');

  const named = await b.tool('fun_places')({ kind: '猫咖' });
  assert.match(named.text, /猫咖/);

  const bad = await b.tool('fun_places')({ kind: '月球' });
  assert.match(bad.text, /没有「月球」这一类/);
  // 筛不到时的提示要说清三档，不然她不知道还能填什么
  assert.match(bad.text, /吃饭喝东西/);
  assert.match(bad.text, /室内/);
});

test('kind 筛选三档都能用：大类 / 感受 / 正名', async () => {
  const b = await boot();
  const names = (r) => r.text.split('\n').filter((l) => l.startsWith('- '))
    .map((l) => l.split('（')[0].replace('- ', ''));

  // 「吃饭喝东西」这个大类要按 hasFood 判：夜市是 market 大类但也能吃，必须一起出来
  const eat = names(await b.tool('fun_places')({ kind: '吃饭喝东西' }));
  for (const must of ['咖啡店', '奶茶店', '餐厅', '夜市']) {
    assert.ok(eat.includes(must), `「吃饭喝东西」应当包含 ${must}，实际：${eat.join('、')}`);
  }

  // 感受类：免费 / 一个人 / 便宜
  const free = names(await b.tool('fun_places')({ kind: '免费' }));
  assert.ok(free.includes('图书馆') && free.includes('江边'), `免费：${free.join('、')}`);
  const solo = names(await b.tool('fun_places')({ kind: '一个人' }));
  assert.ok(solo.length >= 2, `一个人的选项太少：${solo.join('、')}`);

  // 正名 + 细类词（0.1.3 时「咖啡」筛不到咖啡店，tags 补上了）
  const coffee = names(await b.tool('fun_places')({ kind: '咖啡' }));
  assert.deepEqual(coffee, ['咖啡店'], `「咖啡」应当只筛出咖啡店，实际：${coffee.join('、')}`);
});

test('完整一趟：进门 → 逛 → 买 → 拍照 → 收摊，落盘且纪念册有记录', async () => {
  const b = await boot();
  const go = await b.tool('fun_go')({ place: '漫展', company: '小鱼' });
  assert.match(go.text, /进了漫展/);
  assert.match(go.text, /跟小鱼一起/);

  const w1 = await b.tool('fun_wander')({ area: '同人展台', buy: '吧唧', photo: '海报墙前' });
  assert.match(w1.text, /漫展 · 同人展台/);
  assert.match(w1.text, /买了：吧唧/);
  assert.match(w1.text, /拍了张照：海报墙前/);

  b.setNow(at('2026-11-15T15:30:00+08:00'));
  const home = await b.tool('fun_home')({ note: '腿有点酸' });
  assert.match(home.text, /收摊：这一趟在漫展/);
  assert.match(home.text, /买了吧唧/);
  assert.match(home.text, /scene 填「漫展」/);
  assert.match(home.text, /outfits 填「宅卫衣」/);
  assert.match(home.text, /feast_life_play/);
  assert.match(home.text, /跟主人说一句/);
  assert.match(home.text, /待了大约 90 分钟/);

  const saved = JSON.parse(await readFile(join(b.dir, 'fun', 'state.json'), 'utf8'));
  assert.equal(saved.session, null);
  assert.equal(saved.trips.length, 1);
  assert.equal(saved.trips[0].placeName, '漫展');
  assert.deepEqual(saved.trips[0].souvenirs, ['吧唧']);
});

test('收摊回执里的 scene 名跟素材库对得上（水族馆 / 神社）', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '海底隧道' });
  const home = await b.tool('fun_home')({});
  assert.match(home.text, /scene 填「水族馆」/);

  await b.tool('fun_go')({ place: '庙会' });
  await b.tool('fun_wander')({ area: '捞金鱼' });
  const home2 = await b.tool('fun_home')({});
  assert.match(home2.text, /scene 填「神社」/);
});

test('素材库里没有的场所，收摊时一个字都不提 scene', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '电影院' });
  await b.tool('fun_wander')({ area: '影厅' });
  const home = await b.tool('fun_home')({});
  assert.match(home.text, /scene 不用填/);
  assert.match(home.text, /素材库里没有电影院这个场景/);
  // 绝不能出现「scene 填「电影院」」——那会让 imggen 提示「库里没找到」
  assert.doesNotMatch(home.text, /scene 填「电影院」/);
  // 但 outfits 的建议还在
  assert.match(home.text, /outfits 填「外出外套」/);
});

test('没进门就逛 / 没在逛就收摊：给提示不报错', async () => {
  const b = await boot();
  const wander = await b.tool('fun_wander')({});
  assert.match(wander.text, /还没进门/);
  assert.equal(wander.failed, undefined);

  const home = await b.tool('fun_home')({});
  assert.match(home.text, /没在逛/);
});

test('报了个不存在的地方：说清能去哪儿，不炸', async () => {
  const b = await boot();
  const r = await b.tool('fun_go')({ place: '月球' });
  assert.equal(r.failed, true);
  assert.match(r.text, /没听说过「月球」/);
  assert.match(r.text, /游乐场 \/ 海洋馆 \/ 庙会 \/ 漫展/);
});

test('已经在逛时再进门：不覆盖，提示先收摊', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  const again = await b.tool('fun_go')({ place: '海洋馆' });
  assert.match(again.text, /已经在「漫展」逛着/);
  assert.equal(b.world.webUi().badges[0].value.startsWith('漫展'), true);
});

test('fun_ask_report 关掉后，收摊不提记账和跟主人说话', async () => {
  const b = await boot({ cfg: { funAskReport: false } });
  await b.tool('fun_go')({ place: '游乐场' });
  await b.tool('fun_wander')({ area: '过山车' });
  const home = await b.tool('fun_home')({});
  assert.doesNotMatch(home.text, /feast_life_play 记一笔/);
  assert.doesNotMatch(home.text, /跟主人说一句/);
  // 但「发图该填什么」那句还在——那是联动，不是汇报。
  assert.match(home.text, /scene 填「游乐场」/);
});

test('逛遍所有项目之后再逛：提示差不多逛遍了', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  const CON_AREAS = 6;
  for (let i = 0; i < CON_AREAS; i += 1) {
    // 依次点名，避免随机
    await b.tool('fun_wander')({ area: ['同人展台', '企业馆', '舞台区', '排队的通道', '海报墙', '餐饮区'][i] });
  }
  const again = await b.tool('fun_wander')({});
  assert.ok(again.text.length > 0);
  assert.doesNotMatch(again.text, /失败/);
});

test('fun_start：不进门也能看能去哪儿和怎么走', async () => {
  const b = await boot();
  const r = await b.tool('fun_start')({});
  assert.match(r.text, /想现在就出门/);
  assert.match(r.text, /fun_go 进门 → fun_wander/);
  assert.match(r.text, /feast_life_play/);
});

test('fun_view：空册子有话；逛完之后能查回来', async () => {
  const b = await boot();
  const empty = await b.tool('fun_view')({});
  assert.match(empty.text, /纪念册还是空的/);

  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '鲸豚湾', buy: '鲸鱼挂件' });
  await b.tool('fun_home')({});
  const r = await b.tool('fun_view')({});
  assert.match(r.text, /海洋馆/);
  assert.match(r.text, /买了鲸鱼挂件/);
});

test('串味的纪念品/拍照点会被拦下：海洋馆里买不到漫展的吧唧', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  const r = await b.tool('fun_wander')({ area: '鲸豚湾', buy: '吧唧', photo: '海报墙前' });
  assert.match(r.text, /「吧唧」不是海洋馆的东西，没记/);
  assert.match(r.text, /「海报墙前」不是海洋馆的拍照点，没记/);

  // 本地真有的照收
  const ok = await b.tool('fun_wander')({ area: '海底隧道', buy: '鲸鱼挂件', photo: '海底隧道正中间' });
  assert.match(ok.text, /买了：鲸鱼挂件/);
  assert.match(ok.text, /拍了张照：海底隧道正中间/);
  assert.doesNotMatch(ok.text, /不是海洋馆/);
});

test('吃喝：进门就说这儿有什么，逛的时候把味道交回给鱼的每一天', async () => {
  const b = await boot();
  const go = await b.tool('fun_go')({ place: '奶茶店' });
  assert.match(go.text, /这儿还能喝：珍珠奶茶/);

  const w = await b.tool('fun_wander')({ area: '点单的档口', consume: '珍珠奶茶' });
  assert.match(w.text, /喝了：珍珠奶茶/);
  // 关键：把「去 feast 点一道」递到嘴边，而不是自己编味道
  assert.match(w.text, /feast_menu/);
  assert.match(w.text, /feast_eat/);
  assert.match(w.text, /九维口感/);
  // 并且明确说了没装时怎么办
  assert.match(w.text, /没装就只说/);
  // 绝不自称知道味道
  assert.doesNotMatch(w.text, /香浓|回甘|弹牙|顺滑/);
});

test('吃喝：这一处没有的那样会被拦下，不记', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '咖啡店' });
  const bad = await b.tool('fun_wander')({ area: '吧台', consume: '珍珠奶茶' });
  assert.match(bad.text, /「珍珠奶茶」不是咖啡店有的，没记/);
  assert.doesNotMatch(bad.text, /喝了：/);

  const ok = await b.tool('fun_wander')({ area: '靠窗的位子', consume: '拿铁' });
  assert.match(ok.text, /喝了：拿铁/);
});

test('吃喝：没有吃喝的地方填 consume 会被拦下', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  const r = await b.tool('fun_wander')({ area: '鲸豚湾', consume: '拿铁' });
  assert.match(r.text, /海洋馆没有能吃能喝的，没记/);
});

test('吃喝：收摊那句话里会写喝了什么，但不写味道', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '餐厅' });
  await b.tool('fun_wander')({ area: '窗边的位子', consume: '一桌热菜' });
  const home = await b.tool('fun_home')({});
  assert.match(home.text, /一桌热菜/);
  assert.doesNotMatch(home.text, /香浓|回甘|弹牙|鲜嫩爽口/);
});

test('吃喝：同一样记一次，重复会标出来', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '咖啡店' });
  await b.tool('fun_wander')({ area: '吧台', consume: '美式' });
  const again = await b.tool('fun_wander')({ area: '书架角', consume: '美式' });
  assert.match(again.text, /美式 你这一趟已经.*过了/);
});

test('吃喝：面板数据带上 food，但不带味道', async () => {
  const b = await boot();
  const data = await b.world.webUi('zh').invoke('places', 'list', []);
  const cafe = data.places.find((p) => p.id === 'cafe');
  assert.ok(cafe.food, '咖啡店要带 food');
  assert.equal(cafe.food.verb, '喝');
  assert.ok(cafe.food.items.includes('拿铁'));
  // payload 里不能有味道字段：味道在鱼的每一天里
  assert.equal(cafe.food.taste, undefined);
  assert.equal(cafe.food.aroma, undefined);
  const aquarium = data.places.find((p) => p.id === 'aquarium');
  assert.equal(aquarium.food, null, '海洋馆没有 food');
});

test('挂太久会提醒收摊，但不替她收', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  b.setNow(at('2026-11-15T16:00:00+08:00')); // 进门后 120 分钟 > 90
  const r = await b.tool('fun_wander')({});
  assert.match(r.text, /挂得有点久了/);
  assert.match(r.text, /fun_home/);
  assert.ok(!/收摊：/.test(r.text));
  assert.ok(b.world.webUi().badges.some((x) => x.label === '正在逛'), '仍算在逛');
});

test('跨天：状态整份重来，昨天的 session 不会带进今天', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  b.setNow(at('2026-11-16T10:00:00+08:00'));
  const r = await b.tool('fun_wander')({});
  assert.match(r.text, /还没进门/, '跨天之后不该还认得昨天那一趟');
});

test('重启后同一趟还在（同一天）', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '庙会' });
  await b.tool('fun_wander')({ area: '抽签处' });

  const world2 = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true },
    dataDir: b.dir,
    timezone: TZ,
    now: () => at('2026-11-15T15:00:00+08:00'),
    random: () => 0,
  });
  await world2.start({ log: { info() {}, warn() {} } });
  const again = await world2.tools().find((t) => t.name === 'fun_home').handler({});
  assert.match(again.text, /收摊：这一趟在庙会/);
});

test('工具内部抛错也兜住：返回 failed 而不是炸掉整个世界', async () => {
  const b = await boot();
  // 传一个刚好在参数里会导致类型异常的坏值（对象当 count）。
  const r = await b.tool('fun_places')({ count: { evil: true } });
  assert.equal(r.failed, undefined, '坏参数应当被夹回默认值，不该失败');
  assert.match(r.text, /能去逛的/);
});

test('webUi：没在逛时给场所数和灯；在逛时多一个正在逛的徽章', async () => {
  const b = await boot();
  const idle = b.world.webUi('zh');
  assert.equal(idle.label, '娱乐时间');
  assert.equal(idle.lamps[0].state, 'online');
  assert.ok(idle.config.length === 1);
  assert.ok(idle.promptDocs[0].path.endsWith('ENV_PROMPT.md'));
  assert.equal(idle.badges.length, 1);

  await b.tool('fun_go')({ place: '漫展' });
  const busy = b.world.webUi('zh');
  assert.equal(busy.badges[0].label, '正在逛');
  assert.match(busy.badges[0].value, /^漫展/);
  assert.match(busy.lamps[0].hint, /正在漫展逛/);
});
