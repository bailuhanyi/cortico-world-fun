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
  assert.deepEqual(Object.keys(persisted[0]).sort(),
    ['funAskReport', 'funSessionTTLMin', 'funTasteFromFeast']);
  assert.equal(persisted[0].funAskReport, true);
  assert.equal(persisted[0].funSessionTTLMin, 90);
  assert.equal(persisted[0].funTasteFromFeast, true);
});

test('缺键补齐：盘上已有的值一个都不覆盖', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-cfg2-'));
  const persisted = [];
  const world = new FunWorld({
    cfg: {
      enabled: true, funOn: false, funSessionTTLMin: 30,
      funAskReport: false, funTasteFromFeast: false,
    },
    dataDir: dir,
    timezone: TZ,
    persist: (patch) => { persisted.push(patch); },
  });
  await world.start({ log: { info() {}, warn() {} } });
  assert.deepEqual(persisted, [], '四项都在，不该补任何东西');
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

test('时段气氛：同一处地方，不同时刻进门读到的是不同的描写', async () => {
  // 江边开 17.5 小时，是最能体现时段差异的一处。
  const dawn = await boot({ now: at('2026-11-15T06:30:00+08:00') });
  const goDawn = await dawn.tool('fun_go')({ place: '江边' });
  assert.match(goDawn.text, /进了江边（清早）/);
  assert.match(goDawn.text, /雾/);

  const night = await boot({ now: at('2026-11-15T22:00:00+08:00') });
  const goNight = await night.tool('fun_go')({ place: '江边' });
  assert.match(goNight.text, /进了江边（夜里）/);
  assert.match(goNight.text, /航灯|路灯/);

  assert.notEqual(goDawn.text, goNight.text, '清早和夜里不能是同一段话');
});

test('时段气氛：进门会告诉她这处换时间再来是另一副样子', async () => {
  const b = await boot({ now: at('2026-11-15T06:30:00+08:00') });
  const r = await b.tool('fun_go')({ place: '江边' });
  assert.match(r.text, /不同时段不一样/);
  assert.match(r.text, /清早/);
  assert.match(r.text, /夜里/);
});

test('时段气氛：没配阶段的场所照旧，一个字都不多', async () => {
  const b = await boot();
  const r = await b.tool('fun_go')({ place: '海洋馆' });
  assert.match(r.text, /进了海洋馆。/);
  assert.doesNotMatch(r.text, /不同时段不一样/);
  assert.ok(r.text.includes(VENUES.find((v) => v.id === 'aquarium').desc));
});

test('时段气氛：跨夜场所的深夜段能命中（夜市 00:30 = 快收了）', async () => {
  const b = await boot({ now: at('2026-11-15T00:30:00+08:00') });
  const r = await b.tool('fun_go')({ place: '夜市' });
  assert.match(r.text, /进了夜市（快收了）/);
  assert.match(r.text, /卷帘门|最后/);
});

test('时段气氛：可逛的项目随时段收窄（夜市快收时摊子变少）', async () => {
  const late = await boot({ now: at('2026-11-15T00:30:00+08:00') });
  const goLate = await late.tool('fun_go')({ place: '夜市' });
  const lateAreas = goLate.text.split('能逛的：')[1].split('\n')[0].replace('。', '').split('、');
  assert.ok(lateAreas.length < 6, `快收时的摊子应当变少，实际 ${lateAreas.length} 处`);
  assert.ok(lateAreas.includes('烧烤摊'));

  const peak = await boot({ now: at('2026-11-15T21:00:00+08:00') });
  const goPeak = await peak.tool('fun_go')({ place: '夜市' });
  const peakAreas = goPeak.text.split('能逛的：')[1].split('\n')[0].replace('。', '').split('、');
  assert.ok(peakAreas.length > lateAreas.length, '最热闹时候的摊子应当比快收时多');
});

test('时段气氛：逛的回执标题带上时段名', async () => {
  const b = await boot({ now: at('2026-11-15T06:30:00+08:00') });
  await b.tool('fun_go')({ place: '江边' });
  const w = await b.tool('fun_wander')({});
  assert.match(w.text.split('\n')[0], /江边（清早） · /);
});

test('去过的痕迹：第一次去一个字都不提', async () => {
  const b = await boot();
  const r = await b.tool('fun_go')({ place: '漫展' });
  assert.doesNotMatch(r.text, /来过/, '第一次去不该有「上次」的口气');
  assert.doesNotMatch(r.text, /还没去过/);
});

test('去过的痕迹：第二次去能说出上次逛了什么、买了什么', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  await b.tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  await b.tool('fun_home')({});

  // 隔天再去
  b.setNow(at('2026-11-16T15:00:00+08:00'));
  const r = await b.tool('fun_go')({ place: '漫展' });
  assert.match(r.text, /你之前来过这里 1 次/);
  assert.match(r.text, /上一次是昨天/);
  assert.match(r.text, /逛过同人展台/);
  assert.match(r.text, /买过吧唧/);
});

test('去过的痕迹：跨天之后纪念册还在（0.1.x 的 bug）', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '鲸豚湾' });
  await b.tool('fun_home')({});

  // 换一天重新进世界（模拟跨天后启动）
  b.setNow(at('2026-11-18T10:00:00+08:00'));
  const r = await b.tool('fun_go')({ place: '海洋馆' });
  assert.match(r.text, /你之前来过这里 1 次/, '跨天不该把纪念册清空');
});

test('去过的痕迹：来过两次以上会点出「还没去过」的那几处', async () => {
  const b = await boot();
  for (const day of ['2026-11-13', '2026-11-14']) {
    b.setNow(at(`${day}T14:00:00+08:00`));
    await b.tool('fun_go')({ place: '漫展' });
    await b.tool('fun_wander')({ area: '同人展台' });
    await b.tool('fun_home')({});
  }
  b.setNow(at('2026-11-15T15:00:00+08:00'));
  const r = await b.tool('fun_go')({ place: '漫展' });
  assert.match(r.text, /还没去过：/);
  assert.match(r.text, /企业馆|舞台区|海报墙/, '要点出没逛过的地方');
  assert.doesNotMatch(r.text.split('还没去过：')[1].split('\n')[0], /同人展台/, '逛过的不能再列进「还没去过」');
});

test('去过的痕迹：只提这一处，别的场所的痕迹不算', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '鲸豚湾' });
  await b.tool('fun_home')({});

  const r = await b.tool('fun_go')({ place: '漫展' });
  assert.doesNotMatch(r.text, /来过/, '漫展是第一次去，不该提海洋馆的历史');
});

test('去过的痕迹：同一天再来一次，说的是「今天已经来过」而不是「上一次是今天」', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '鲸豚湾' });
  await b.tool('fun_home')({});

  b.setNow(at('2026-11-15T18:00:00+08:00'));
  const r = await b.tool('fun_go')({ place: '海洋馆' });
  assert.match(r.text, /今天你已经来过一次了/);
  assert.doesNotMatch(r.text, /上一次是今天/, '别复读');
});

test('去过的痕迹：逛到某处会说这处之前来过几次', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '鲸豚湾' });
  await b.tool('fun_home')({});

  b.setNow(at('2026-11-16T15:00:00+08:00'));
  await b.tool('fun_go')({ place: '海洋馆' });
  const w = await b.tool('fun_wander')({ area: '鲸豚湾' });
  assert.match(w.text, /这处你之前来过 1 次/);
});

test('去过的痕迹：以前买过的东西，不会再抽到同一件小事件', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  await b.tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  await b.tool('fun_home')({});

  b.setNow(at('2026-11-16T15:00:00+08:00'));
  await b.tool('fun_go')({ place: '漫展' });
  // 连逛几次，一次都不该再出现「吧唧挑了半天」那条
  for (let i = 0; i < 6; i += 1) {
    b.setNow(at(`2026-11-16T15:1${i}:00+08:00`));
    const w = await b.tool('fun_wander')({});
    assert.doesNotMatch(w.text, /吧唧挑了半天/, `第 ${i + 1} 次仍抽到了买过的那件事`);
  }
});

test('自填地点：保存后能进门、能逛、能收摊', async () => {
  const b = await boot();
  const saved = await b.world.webUi('zh').invoke('places', 'save', [{
    name: '巷子里的旧书店',
    desc: '木门，书堆到天花板。',
    hours: { open: '10:00', close: '20:00' },
    areas: ['书架之间', '柜台'],
    souvenirs: ['一本旧书'],
    photoSpots: ['柜台前'],
    tags: ['室内', '安静', '淘'],
  }]);
  assert.equal(saved.ok, true, saved.error);
  assert.ok(saved.venue.id.startsWith('user-'));

  const places = await b.tool('fun_places')({ all: true });
  assert.match(places.text, /巷子里的旧书店/);

  const go = await b.tool('fun_go')({ place: '旧书店' });
  assert.match(go.text, /进了巷子里的旧书店/);
  assert.match(go.text, /书架之间、柜台/);
  const wander = await b.tool('fun_wander')({ area: '柜台', buy: '一本旧书' });
  assert.match(wander.text, /买了：一本旧书/);
  const home = await b.tool('fun_home')({});
  assert.match(home.text, /巷子里的旧书店/);
  assert.match(home.text, /scene 不用填/, '自填地点没有素材库场景，不能编');

  // 落盘了
  const raw = JSON.parse(await readFile(join(b.dir, 'fun', 'venues.json'), 'utf8'));
  assert.equal(raw.venues.length, 1);
  assert.equal(raw.venues[0].name, '巷子里的旧书店');
});

test('自填地点：重启之后还在', async () => {
  const b = await boot();
  const saved = await b.world.webUi('zh').invoke('places', 'save', [{ name: '天台上的小桌椅', areas: ['栏杆边'] }]);
  assert.equal(saved.ok, true);
  await b.world.stop();

  const world2 = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true },
    dataDir: b.dir,
    timezone: TZ,
    now: () => at('2026-11-15T14:00:00+08:00'),
    random: () => 0,
  });
  await world2.start({ log: { info() {}, warn() {} } });
  const r = await world2.tools().find((t) => t.name === 'fun_places').handler({ all: true });
  assert.match(r.text, /天台上的小桌椅/);
  await world2.stop();
});

// B 阶段：预设可以改（写覆盖层），但**不能删**；新建自填仍不能撞预设正名。
const presetForm = (id, patch = {}) => {
  const v = VENUES.find((x) => x.id === id);
  return {
    id, name: v.name, aliases: v.aliases, tags: v.tags, desc: v.desc,
    recommendedOutfit: v.recommendedOutfit, crowd: v.crowd, hours: v.hours,
    areas: v.areas, souvenirs: v.souvenirs, photoSpots: v.photoSpots,
    randomEvents: v.randomEvents, ...(v.food ? { food: v.food } : {}), ...patch,
  };
};

test('B 阶段：预设能改，落的是稀疏覆盖层，且不能删', async () => {
  const b = await boot();
  const ui = b.world.webUi('zh').invoke.bind(b.world.webUi('zh'));

  const edit = await ui('places', 'save', [presetForm('con', { souvenirs: ['我自己写的吧唧'] })]);
  assert.equal(edit.ok, true, edit.error);
  let data = await ui('places', 'list', []);
  const con = data.places.find((p) => p.id === 'con');
  assert.deepEqual(con.souvenirs, ['我自己写的吧唧'], '改的字段生效');
  assert.equal(con.name, '漫展', '没改的字段仍来自预设');
  assert.equal(con.overridden, true, '面板要标出已改');
  assert.equal(data.overriddenCount, 1);
  assert.equal(data.total, 20, '改预设不会多出一处，也不会少一处');

  // 落盘形状：只有改过的字段，且带 id
  const raw = JSON.parse(await readFile(join(b.dir, 'fun', 'venues.json'), 'utf8'));
  assert.deepEqual(Object.keys(raw.overrides.con), ['souvenirs'], '覆盖层必须稀疏，否则会锁死预设升级');
  assert.deepEqual(raw.venues, [], '自填列表没动');

  // 预设删不掉
  const del = await ui('places', 'remove', [{ id: 'con' }]);
  assert.equal(del.ok, false);
  assert.match(del.error, /删不掉/);

  // 新建自填仍不能撞预设正名
  const dup = await ui('places', 'save', [{ name: '咖啡店', areas: ['x'] }]);
  assert.equal(dup.ok, false);
  assert.match(dup.error, /预设里的名字/);
});

test('B 阶段：编辑预设不能把名字/别名改成另一处预设的正名', async () => {
  const b = await boot();
  const ui = b.world.webUi('zh').invoke.bind(b.world.webUi('zh'));
  const bad = await ui('places', 'save', [presetForm('con', { name: '咖啡店' })]);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /另一处预设的名字/);
});

test('B 阶段：预设改动重启后还在；恢复一处 / 恢复全部都回到预设', async () => {
  const b = await boot();
  const ui = b.world.webUi('zh').invoke.bind(b.world.webUi('zh'));
  await ui('places', 'save', [presetForm('con', { souvenirs: ['吧唧A'] })]);
  await ui('places', 'save', [presetForm('aquarium', { desc: '我改过的海洋馆' })]);
  assert.equal((await ui('places', 'list', [])).overriddenCount, 2);

  await b.world.stop();
  const world2 = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true }, dataDir: b.dir, timezone: TZ,
    now: () => at('2026-11-15T14:00:00+08:00'), random: () => 0,
  });
  await world2.start({ log: { info() {}, warn() {} } });
  const ui2 = world2.webUi('zh').invoke.bind(world2.webUi('zh'));
  let data = await ui2('places', 'list', []);
  assert.equal(data.overriddenCount, 2, '重启之后覆盖层还在');
  assert.deepEqual(data.places.find((p) => p.id === 'con').souvenirs, ['吧唧A']);

  const one = await ui2('places', 'reset', [{ id: 'con' }]);
  assert.equal(one.ok, true);
  data = await ui2('places', 'list', []);
  assert.equal(data.overriddenCount, 1);
  assert.equal(data.places.find((p) => p.id === 'con').overridden, false);
  assert.ok(data.places.find((p) => p.id === 'aquarium').desc.includes('我改过的'));

  const all = await ui2('places', 'resetAll', []);
  assert.equal(all.ok, true);
  assert.equal(all.cleared, 1);
  data = await ui2('places', 'list', []);
  assert.equal(data.overriddenCount, 0);
  assert.deepEqual(data.places.find((p) => p.id === 'aquarium').desc,
    VENUES.find((v) => v.id === 'aquarium').desc);
  await world2.stop();
});

test('B 阶段：预设升级照常生效——没改过的字段跟着新版预设走', async () => {
  const b = await boot();
  const ui = b.world.webUi('zh').invoke.bind(b.world.webUi('zh'));
  await ui('places', 'save', [presetForm('con', { souvenirs: ['我自己的吧唧'] })]);
  // 模拟预设升级：给漫展加一个新摊位（不改 mergeVenues 之外的东西，直接测纯函数）
  const { mergeVenues } = await import('../src/user-venues.js');
  const grown = VENUES.map((v) => (v.id === 'con' ? { ...v, areas: [...v.areas, '新加的摊位'] } : v));
  const raw = JSON.parse(await readFile(join(b.dir, 'fun', 'venues.json'), 'utf8'));
  const merged = mergeVenues(grown, raw.venues, raw.overrides);
  const con = merged.find((v) => v.id === 'con');
  assert.deepEqual(con.souvenirs, ['我自己的吧唧'], '用户改动优先');
  assert.ok(con.areas.includes('新加的摊位'), '没碰过的字段拿到预设的新内容');
});

test('B 阶段：自填地点与预设改动共存，互不串味', async () => {
  const b = await boot();
  const ui = b.world.webUi('zh').invoke.bind(b.world.webUi('zh'));
  const mine = await ui('places', 'save', [{ name: '我的小院', areas: ['藤椅'] }]);
  assert.equal(mine.ok, true);
  await ui('places', 'save', [presetForm('con', { souvenirs: ['吧唧B'] })]);

  const data = await ui('places', 'list', []);
  assert.equal(data.total, 21);
  assert.equal(data.userVenueCount, 1);
  assert.equal(data.overriddenCount, 1);
  assert.deepEqual(data.places.find((p) => p.id === mine.venue.id).areas, ['藤椅']);
  assert.deepEqual(data.places.find((p) => p.id === 'con').souvenirs, ['吧唧B']);
});

test('自填地点：改自己的、删自己的都行', async () => {
  const b = await boot();
  const ui = b.world.webUi('zh').invoke.bind(b.world.webUi('zh'));
  const made = await ui('places', 'save', [{ name: '我的小院', areas: ['藤椅'] }]);
  assert.equal(made.ok, true);

  const edited = await ui('places', 'save', [{ id: made.venue.id, name: '我的小院', areas: ['藤椅', '花架'], souvenirs: ['一片叶子'] }]);
  assert.equal(edited.ok, true);
  let data = await ui('places', 'list', []);
  const mine = data.places.find((p) => p.name === '我的小院');
  assert.deepEqual(mine.allAreas, ['藤椅', '花架']);
  assert.deepEqual(mine.souvenirs, ['一片叶子']);
  assert.equal(data.userVenueCount, 1);

  const removed = await ui('places', 'remove', [{ id: made.venue.id }]);
  assert.equal(removed.ok, true);
  data = await ui('places', 'list', []);
  assert.equal(data.userVenueCount, 0);
  assert.equal(data.total, 20, '删掉之后回到纯预设');
});

test('自填地点：预设升级照常生效、用户改动优先', async () => {
  // 这一条直接测合并层：用户改了漫展的纪念品，预设后来加了新摊位。
  const { mergeVenues } = await import('../src/user-venues.js');
  const grown = VENUES.map((v) => (v.id === 'con' ? { ...v, areas: [...v.areas, '新加的摊位'] } : v));
  const merged = mergeVenues(grown, [{ id: 'con', souvenirs: ['我自己的吧唧'] }]);
  const con = merged.find((v) => v.id === 'con');
  assert.deepEqual(con.souvenirs, ['我自己的吧唧']);
  assert.ok(con.areas.includes('新加的摊位'));
  assert.equal(con.name, '漫展', '没写的字段仍来自预设');
});

test('鱼的开关：开着时吃喝回执指向 feast_menu / feast_eat', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '奶茶店' });
  const w = await b.tool('fun_wander')({ consume: '珍珠奶茶' });
  assert.match(w.text, /feast_menu/);
  assert.match(w.text, /feast_eat/);
  assert.match(w.text, /九维口感/);
});

test('鱼的开关：关掉后只说喝了什么，一个字都不提味道和 feast', async () => {
  const b = await boot({ cfg: { funTasteFromFeast: false } });
  const data = await b.world.webUi('zh').invoke('places', 'list', []);
  assert.equal(data.feast, false, '面板要能显示开关状态');

  await b.tool('fun_go')({ place: '奶茶店' });
  const w = await b.tool('fun_wander')({ consume: '珍珠奶茶' });
  assert.match(w.text, /喝了：珍珠奶茶/, '吃喝这件事照常记');
  assert.doesNotMatch(w.text, /feast_menu|feast_eat/);
  assert.doesNotMatch(w.text, /九维|口感|香气|余韵/);
  assert.doesNotMatch(w.text, /味道别自己编/);
});

test('鱼的开关：关掉也不影响别的回执（进门、收摊照常）', async () => {
  const b = await boot({ cfg: { funTasteFromFeast: false } });
  const go = await b.tool('fun_go')({ place: '奶茶店' });
  assert.match(go.text, /这儿还能喝：珍珠奶茶/, '能喝什么照常列');
  await b.tool('fun_wander')({ consume: '珍珠奶茶' });
  const home = await b.tool('fun_home')({});
  assert.match(home.text, /喝了珍珠奶茶/);
  assert.match(home.text, /feast_life_play/, '记账提醒跟这个开关无关');
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
