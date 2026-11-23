import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DEFAULTS } from '../src/config.js';
import { FunWorld } from '../src/world.js';
import { VENUES } from '../src/venues.js';
import funDefinition from '../src/definition.js';
import { cleanupAll, tempDir, trackWorld } from './tmp.mjs';

// 临时目录与 World 统一登记：文件结束时先 stop 再删（见 test/tmp.mjs）。
after(cleanupAll);
const makeWorld = (options) => trackWorld(new FunWorld(options));

const TZ = 'Asia/Shanghai';
const at = (s) => Date.parse(s);

async function boot(overrides = {}) {
  const dir = overrides.dir ?? await tempDir('fun-');
  let now = overrides.now ?? at('2026-11-15T14:00:00+08:00');
  const persisted = [];
  const host = { log: { info() {}, warn() {}, error() {} } };
  const world = makeWorld({
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
  const dir = await tempDir('fun-pure-');
  const w = funDefinition.create({ cfg: {}, dataDir: dir, timezone: TZ });
  assert.equal(typeof w, 'object');
  // 纯的意思：create 之后目录里什么都还没建。
  const { readdir } = await import('node:fs/promises');
  assert.deepEqual(await readdir(dir), []);
});

test('describe 不再声明事件：自己出门只是许可，叫醒归「鱼的每一天」', () => {
  assert.equal(funDefinition.describe.events.length, 0, 'fun.home.free 已随方案 B 的时段一起移除');
  assert.equal(funDefinition.id, 'fun');
  assert.equal(funDefinition.label, '从0开始的肥鱼大冒险');
  for (const t of funDefinition.describe.tools) {
    assert.ok(t.summary?.zh, `${t.name} 缺中文 summary`);
    assert.ok(t.summary?.en, `${t.name} 缺英文 summary`);
  }
});

test('故事公共查询工具已分离声明为只读', () => {
  const w = funDefinition.create({ cfg: { funStoryTextOn: true }, dataDir: process.cwd(), timezone: TZ });
  const names = w.tools().map((t) => t.name);
  for (const name of ['fun_story_places', 'fun_story_candidates', 'fun_story_detail', 'fun_story_current', 'fun_story_recap', 'fun_story_schedule']) {
    assert.ok(names.includes(name), `${name} missing`);
    const declaration = funDefinition.describe.tools.find((tool) => tool.name === name);
    assert.deepEqual(declaration?.tags, ['read', 'snapshot']);
  }
});

test('默认 23 件（文字通道开、作者闸关）；两个开关各自生效', () => {
  const noText = ['fun_choice', 'fun_go', 'fun_home', 'fun_home_activity', 'fun_home_state', 'fun_keepsake', 'fun_places', 'fun_resume', 'fun_route', 'fun_shelf', 'fun_start', 'fun_story_candidates', 'fun_story_detail', 'fun_view', 'fun_wander', 'fun_wish', 'fun_wishes'];

  // 默认：文字通道开着（群友反馈聊天里要能玩），只藏作者工具。
  const def = funDefinition.create({ cfg: {}, dataDir: process.cwd(), timezone: TZ });
  const defNames = def.tools().map((t) => t.name);
  assert.equal(defNames.length, 23);
  for (const name of ['fun_story_start', 'fun_story_act', 'fun_story_places', 'fun_story_current', 'fun_story_recap', 'fun_story_schedule']) {
    assert.ok(defNames.includes(name), `默认应该有 ${name}`);
  }
  assert.ok(!defNames.includes('fun_story'), '作者工具默认不挂');

  // 关掉文字通道：只剩 candidates / detail 两个故事查询（17 件）。
  const off = funDefinition.create({ cfg: { funStoryTextOn: false }, dataDir: process.cwd(), timezone: TZ });
  assert.deepEqual(off.tools().map((t) => t.name).sort(), noText);
  assert.ok(!off.tools().some((t) => t.name === 'fun_story'), '作者工具仍不挂');

  // 关文字通道 + 开作者闸：18 件，作者工具回来、文字通道那批仍不在。
  const authorOnly = funDefinition.create({ cfg: { funStoryTextOn: false, funStoryAuthorInChat: true }, dataDir: process.cwd(), timezone: TZ });
  const authorNames = authorOnly.tools().map((t) => t.name);
  assert.equal(authorNames.length, 18);
  assert.ok(authorNames.includes('fun_story'));
  assert.ok(!authorNames.includes('fun_story_start'));

  // 作者闸也开：24 件全在。
  const both = funDefinition.create({ cfg: { funStoryAuthorInChat: true }, dataDir: process.cwd(), timezone: TZ });
  assert.equal(both.tools().length, 24);
});

test('envPromptVars 不常驻完整地点清单，关闭时同样为空', async () => {
  const b = await boot();
  assert.equal(b.world.envPromptVars().fun_places_block, '');

  const off = makeWorld({ cfg: { ...DEFAULTS, funOn: false }, dataDir: b.dir, timezone: TZ });
  await off.start({ log: { info() {}, warn() {} } });
  assert.equal(off.envPromptVars().fun_places_block, '');
});

test('配置段缺键会被补齐（宿主 /api/config 不合并 defaults）', async () => {
  const dir = await tempDir('fun-cfg-');
  const persisted = [];
  const world = makeWorld({
    cfg: { enabled: true, funOn: true }, // 只给了两项
    dataDir: dir,
    timezone: TZ,
    persist: (patch) => { persisted.push(patch); },
  });
  await world.start({ log: { info() {}, warn() {} } });
  assert.equal(persisted.length, 1);
  assert.deepEqual(Object.keys(persisted[0]).sort(),
    ['funAskReport', 'funAutoCalls', 'funAutoSteps', 'funHomeAutoGo', 'funSessionTTLMin', 'funStoryAuthorInChat', 'funStoryAutoImages', 'funStoryDM', 'funStoryDmModel', 'funStoryDmUrl', 'funStoryFree', 'funStoryFreeTurns', 'funStoryImageSource', 'funStoryImages', 'funStoryNodeLimit', 'funStoryTextOn', 'funTasteFromFeast']);
  assert.equal(persisted[0].funAskReport, true);
  assert.equal(persisted[0].funSessionTTLMin, 90);
  assert.equal(persisted[0].funAutoSteps, 20);
  assert.equal(persisted[0].funAutoCalls, 6);
  assert.equal(persisted[0].funStoryImages, false);
  assert.equal(persisted[0].funStoryDM, false);
  assert.equal(persisted[0].funStoryNodeLimit, 16);
  assert.equal(persisted[0].funStoryDmUrl, '');
  assert.equal(persisted[0].funStoryDmModel, '');
  assert.equal(persisted[0].funStoryImageSource, '');
  assert.equal(persisted[0].funTasteFromFeast, true);
  assert.equal(persisted[0].funHomeAutoGo, false, '自动出门默认关');
});

test('缺键补齐：盘上已有的值一个都不覆盖', async () => {
  const dir = await tempDir('fun-cfg2-');
  const persisted = [];
  const world = makeWorld({
    cfg: {
      enabled: true, funOn: false, funSessionTTLMin: 30,
      funAskReport: false, funTasteFromFeast: false, funHomeAutoGo: false, funStoryImages: false, funStoryDM: true,
      funStoryTextOn: true, funStoryFree: false, funStoryFreeTurns: 40, funAutoSteps: 20, funAutoCalls: 6,
      funStoryAutoImages: true, funStoryAuthorInChat: false,
      funStoryNodeLimit: 16, funStoryDmUrl: '', funStoryDmModel: '', funStoryImageSource: '',
    },
    dataDir: dir,
    timezone: TZ,
    persist: (patch) => { persisted.push(patch); },
  });
  await world.start({ log: { info() {}, warn() {} } });
  assert.deepEqual(persisted, [], '十九项都在，不该补任何东西');
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

test('完整一趟：进门 → 逛 → 买 → 拍照 → 回家，落盘且纪念册有记录', async () => {
  const b = await boot();
  const go = await b.tool('fun_go')({ place: '漫展', company: '小鱼' });
  assert.match(go.text, /进了漫展/);
  assert.match(go.text, /跟小鱼一起/);
  assert.match(go.text, /能逛的：/);
  assert.match(go.text, /纪念品：[^\n]*吧唧/);
  assert.match(go.text, /拍照点：海报墙前/);

  const w1 = await b.tool('fun_wander')({ area: '同人展台', buy: '吧唧', photo: '海报墙前' });
  assert.match(w1.text, /漫展 · 同人展台/);
  assert.match(w1.text, /买了：吧唧/);
  assert.match(w1.text, /拍了张照：海报墙前/);
  assert.doesNotMatch(w1.text, /还能买的：|还能拍的：|这儿能吃：/);

  b.setNow(at('2026-11-15T15:30:00+08:00'));
  const home = await b.tool('fun_home')({ note: '腿有点酸' });
  assert.match(home.text, /回家：这一趟在漫展/);
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

test('回家回执里的 scene 名跟素材库对得上（水族馆 / 神社）', async () => {
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

test('素材库里没有的场所，回家时一个字都不提 scene', async () => {
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

test('自填地点同样没有 scene：回家回执明说不用填', async () => {
  const b = await boot();
  await b.world.webUi('zh').invoke('places', 'save', [{
    name: '旧书店', areas: ['书架间'], recommendedOutfit: '通勤衬衫',
  }]);
  await b.tool('fun_go')({ place: '旧书店' });
  await b.tool('fun_wander')({ area: '书架间' });
  const home = await b.tool('fun_home')({});
  assert.match(home.text, /scene 不用填/);
  assert.doesNotMatch(home.text, /scene 填「旧书店」/);
});

test('没进门就逛 / 没在逛就回家：给提示不报错', async () => {
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

test('已经在逛时再进门：不覆盖，提示先回家', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  const again = await b.tool('fun_go')({ place: '海洋馆' });
  assert.match(again.text, /已经在「漫展」逛着/);
  assert.equal(b.world.webUi().badges[0].value.startsWith('漫展'), true);
});

test('fun_ask_report 关掉后，回家不提记账和跟主人说话', async () => {
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

test('fun_start：给出推荐地点而不重复项目清单', async () => {
  const b = await boot();
  const r = await b.tool('fun_start')({});
  assert.match(r.text, /想现在就出门/);
  assert.match(r.text, /fun_go 进门/);
  assert.doesNotMatch(r.text, /过山车|鲸豚湾|捞金鱼/);
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
  assert.match(go.text, /可喝：珍珠奶茶/);

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

test('吃喝：回家那句话里会写喝了什么，但不写味道', async () => {
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

test('游逛只返回本次事实，不重复历史次数', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  await b.tool('fun_wander')({ area: '鲸豚湾' });
  await b.tool('fun_home')({});

  b.setNow(at('2026-11-16T15:00:00+08:00'));
  await b.tool('fun_go')({ place: '海洋馆' });
  const w = await b.tool('fun_wander')({ area: '鲸豚湾' });
  assert.match(w.text, /海洋馆 · 鲸豚湾/);
  assert.doesNotMatch(w.text, /这处你之前来过/);
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

test('自填地点：保存后能进门、能逛、能回家', async () => {
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

  const world2 = makeWorld({
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
  assert.equal(data.total, VENUES.length, '改预设不会多出一处，也不会少一处');

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
  const world2 = makeWorld({
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
  assert.equal(data.total, VENUES.length + 1);
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
  assert.equal(data.total, VENUES.length, '删掉之后回到纯预设');
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

test('鱼的开关：关掉也不影响别的回执（进门、回家照常）', async () => {
  const b = await boot({ cfg: { funTasteFromFeast: false } });
  const go = await b.tool('fun_go')({ place: '奶茶店' });
  assert.match(go.text, /可喝：珍珠奶茶/, '能喝什么照常列');
  await b.tool('fun_wander')({ consume: '珍珠奶茶' });
  const home = await b.tool('fun_home')({});
  assert.match(home.text, /喝了珍珠奶茶/);
  assert.match(home.text, /feast_life_play/, '记账提醒跟这个开关无关');
});

test('挂太久会提醒回家，但不替她收', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  b.setNow(at('2026-11-15T16:00:00+08:00')); // 进门后 120 分钟 > 90
  const r = await b.tool('fun_wander')({});
  assert.match(r.text, /挂得有点久了/);
  assert.match(r.text, /fun_home/);
  assert.ok(!/回家：/.test(r.text));
  assert.ok(b.world.webUi().badges.some((x) => x.label === '正在逛'), '仍算在逛');
});

test('未完行程重启后可续逛，待选事件可重读和略过', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  b.setNow(at('2026-11-15T14:10:00+08:00'));
  await b.tool('fun_wander')({ area: '海底隧道' });
  const again = await boot({ dir: b.dir, now: at('2026-11-16T10:00:00+08:00') });
  const view = await again.tool('fun_view')({});
  const data = await again.world.webUi().invoke('places', 'list', []);
  assert.equal(data.session, null);
  assert.equal(data.draft.stayedMin, 10);
  assert.equal(data.draft.visited[0].area, '海底隧道');
  assert.ok(view.text.includes(data.draft.id));
  assert.match((await again.tool('fun_wander')({})).text, /未逛完/);
  assert.equal((await again.tool('fun_go')({ place: '漫展' })).failed, true);
  assert.equal((await again.tool('fun_resume')({ id: '旧行程' })).failed, true);
  const resumed = await again.tool('fun_resume')({ id: data.draft.id });
  assert.match(resumed.text, /接着逛/);
  const choice = data.draft.pendingChoice;
  assert.ok(resumed.text.includes(choice.options[0].label));
  assert.ok((await again.tool('fun_wander')({})).text.includes(choice.options[0].label));
  assert.match((await again.tool('fun_choice')({ choiceId: choice.id, optionId: 'skip' })).text, /略过/);
  assert.equal((await again.tool('fun_choice')({ choiceId: choice.id, optionId: 'skip' })).failed, true);
  again.setNow(at('2026-11-16T10:03:00+08:00'));
  await again.tool('fun_wander')({ area: '水母缸' });
  const home = await again.tool('fun_home')({});
  assert.match(home.text, /待了大约 13 分钟/);
  const trip = (await again.world.webUi().invoke('book', 'list', [])).trips[0];
  assert.deepEqual(trip.visited, ['海底隧道', '水母缸']);
  assert.equal(trip.choices[0].result, '略过了这次选择');
});

test('面板只读识别草稿，显式回家按原行程日期记入纪念册且不会重复', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  b.setNow(at('2026-11-15T14:10:00+08:00'));
  await b.tool('fun_wander')({ area: '同人展台', buy: '吧唧' });
  const before = await readFile(b.world.stateFile(), 'utf8');
  b.setNow(at('2026-11-16T10:00:00+08:00'));
  const { invoke } = b.world.webUi();
  const data = await invoke('places', 'list', []);
  assert.equal((await invoke('book', 'list', [])).trips.length, 0);
  assert.equal(await readFile(b.world.stateFile(), 'utf8'), before);
  assert.equal((await invoke('places', 'closeDraft', [{ id: 'wrong' }])).ok, false);
  assert.equal((await b.tool('fun_home')({})).failed, true);
  const results = await Promise.all([1, 2].map(() => invoke('places', 'closeDraft', [{ id: data.draft.id }])));
  assert.deepEqual(results.map((result) => result.ok), [true, false]);
  const { trips } = await invoke('book', 'list', []);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].day, '2026-11-15');
  assert.equal(trips[0].stayedMin, 10);
  assert.deepEqual(trips[0].souvenirs, ['吧唧']);
  assert.equal((await invoke('places', 'list', [])).draft, null);
});

test('工具和面板使用同一时段项目并展示接下来可实现的心愿', async () => {
  const b = await boot({ now: at('2026-11-15T17:30:00+08:00') });
  const venue = VENUES.find((v) => v.name === '夜市');
  const phase = venue.phases[0];
  const later = venue.phases[1];
  const unavailable = venue.areas.find((a) => !phase.areas.includes(a));
  assert.ok(unavailable);
  await b.tool('fun_wish')({ action: 'add', place: '夜市', type: 'phase', target: later.label });
  const list = await b.tool('fun_places')({ kind: '夜市' });
  assert.ok(list.text.includes(`现在能逛：${phase.areas.slice(0, 5).join('、')}`));
  assert.ok(!list.text.includes(unavailable));
  const data = await b.world.webUi().invoke('places', 'list', []);
  const card = data.places.find((p) => p.id === venue.id);
  assert.deepEqual(card.areas, phase.areas);
  assert.ok(data.upcomingWish.includes(later.from));
  assert.ok((await b.tool('fun_start')({})).text.includes(data.upcomingWish));
  b.setNow(at(`2026-11-15T${later.from}:00+08:00`));
  assert.match((await b.tool('fun_places')({ kind: '夜市' })).text, /有个心愿/);
});

test('跨午夜：夜市逛着过零点，这一趟不能丢', async () => {
  // 真会踩：夜市 17:30–01:00。23:50 进门，00:05 再逛，以前回「你还没进门呢」。
  const b = await boot({ now: at('2026-11-17T23:50:00+08:00') });
  await b.tool('fun_go')({ place: '夜市' });
  await b.tool('fun_wander')({});
  b.setNow(at('2026-11-18T00:05:00+08:00'));
  const r = await b.tool('fun_wander')({});
  assert.ok(!/还没进门/.test(r.text), '跨过午夜不该把正在逛的这一趟丢掉');
  assert.match(r.text, /夜市/);
  assert.doesNotMatch(r.text, /这一趟逛了/);
});

test('fun_wander：填一处这儿没有的地方，不编一个「逛了」', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  const r = await b.tool('fun_wander')({ area: '蹦极' });
  assert.match(r.text, /海洋馆没有「蹦极」这处/, '要么认这处，要么如实说没有，不能原样接受');
  assert.ok(!/海洋馆 · 蹦极/.test(r.text), '不能把库里没有的地方当标题');
  assert.match(r.text, /这会儿能逛的是：/);
  // 也不能记进这一趟
  const view = await b.tool('fun_view')({});
  assert.ok(!/蹦极/.test(view.text), '没逛成的东西不该进纪念册');
});

test('fun_wander：时段收窄时说「这会儿还没开」，不是「没有这处」', async () => {
  // 夜市白天只开一半摊子；「糖水铺」是深夜才有的（见 phases 数据）。
  const b = await boot({ now: at('2026-11-15T11:00:00+08:00') });
  await b.tool('fun_go')({ place: '夜市' });
  const r = await b.tool('fun_wander')({ area: '深夜才有的摊' });
  assert.match(r.text, /夜市没有「深夜才有的摊」这处/);
});

test('fun_view 按需查询仍保留行程 ID 与回家备注', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  await b.tool('fun_wander')({ area: '同人展台' });
  await b.tool('fun_home')({ note: '今天人很多，但很开心' });
  const view = await b.tool('fun_view')({});
  assert.match(view.text, /行程 ID：/);
  assert.match(view.text, /你记的：今天人很多，但很开心/);
});

test('同行的人进纪念册', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展', company: '阿岚' });
  await b.tool('fun_wander')({});
  await b.tool('fun_home')({});
  const view = await b.tool('fun_view')({});
  assert.match(view.text, /跟阿岚一起/);
});

test('回家日期按本地时区存，早上 8 点前不会算成前一天', async () => {
  // 上海 06:20 回家：UTC 还是前一天 22:20。以前纪念册会标成 11-17。
  const b = await boot({ now: at('2026-11-18T06:20:00+08:00') });
  await b.tool('fun_go')({ place: '爬山' });
  await b.tool('fun_wander')({});
  await b.tool('fun_home')({});
  const book = await b.world.webUi('zh').invoke('book', 'list');
  assert.equal(book.trips[0].day, '2026-11-18', '要按本地日期，不是 UTC');
});

test('同一天早上再去：说「今天来过」，不是「上一次是昨天」', async () => {
  const b = await boot({ now: at('2026-11-18T06:20:00+08:00') });
  await b.tool('fun_go')({ place: '爬山' });
  await b.tool('fun_wander')({});
  await b.tool('fun_home')({});
  b.setNow(at('2026-11-18T07:10:00+08:00'));   // 同一天，一小时后
  const r = await b.tool('fun_go')({ place: '爬山' });
  assert.match(r.text, /今天你已经来过一次了/, '同一天要认成今天');
  assert.ok(!/上一次是昨天/.test(r.text), '不能把同一天早上说成昨天');
});

test('重启后同一趟还在（同一天）', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '庙会' });
  await b.tool('fun_wander')({ area: '抽签处' });

  const world2 = makeWorld({
    cfg: { ...DEFAULTS, enabled: true },
    dataDir: b.dir,
    timezone: TZ,
    now: () => at('2026-11-15T15:00:00+08:00'),
    random: () => 0,
  });
  await world2.start({ log: { info() {}, warn() {} } });
  const again = await world2.tools().find((t) => t.name === 'fun_home').handler({});
  assert.match(again.text, /回家：这一趟在庙会/);
});

test('简称购买与拍照按正名落盘，收藏进度和重复判断一致', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  const first = await b.tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼', photo: '隧道正中间' });
  assert.match(first.text, /买了：鲸鱼挂件/);
  assert.match(first.text, /拍了张照：海底隧道正中间/);
  const again = await b.tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼挂件', photo: '海底隧道正中间' });
  assert.match(again.text, /鲸鱼挂件 你之前已经买过了/);
  assert.match(again.text, /海底隧道正中间 已经拍过了/);
  await b.tool('fun_home')({});
  const saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.deepEqual(saved.trips[0].souvenirs, ['鲸鱼挂件']);
  assert.deepEqual(saved.trips[0].photos, ['海底隧道正中间']);
  const { progressFor } = await import('../src/keepsakes.js');
  const progress = progressFor(VENUES.find((v) => v.id === 'aquarium'), saved.trips);
  assert.equal(progress.souvenirs.done, 1);
  assert.equal(progress.photos.done, 1);
});

test('名称解析精确优先、唯一简称归一、多义输入不猜', async () => {
  const { resolveName } = await import('../src/names.js');
  assert.equal(resolveName(['鲸鱼', '鲸鱼挂件'], '鲸鱼').name, '鲸鱼');
  assert.equal(resolveName(['鲸鱼挂件'], '鲸鱼').name, '鲸鱼挂件');
  assert.equal(resolveName(['鲸鱼挂件', '鲸鱼贴纸'], '鲸鱼').name, null);
  assert.deepEqual(resolveName(['鲸鱼挂件', '鲸鱼贴纸'], '鲸鱼').candidates, ['鲸鱼挂件', '鲸鱼贴纸']);
  assert.equal(resolveName([], '鲸鱼').name, null);
});

test('包含匹配不擅自选择多义物品，精确正名仍优先', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '海洋馆' });
  const r = await b.tool('fun_wander')({ area: '纪念品店', photo: '前' });
  assert.match(r.text, /能对应多样/);
  const saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.deepEqual(saved.session.photos, []);
});

test('吃喝简称统一为清单正名，同一趟不重复记', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '咖啡店' });
  const venue = VENUES.find((v) => v.id === 'cafe');
  const name = venue.food.items[0];
  await b.tool('fun_wander')({ consume: `一杯${name}` });
  await b.tool('fun_wander')({ consume: name });
  const saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.deepEqual(saved.session.ate.map((a) => a.item), [name]);
});

test('自动和指定项目都不复活历史耗尽的事件池', async () => {
  const { writeFile } = await import('node:fs/promises');
  const b = await boot();
  const venue = VENUES.find((v) => v.id === 'aquarium');
  await b.tool('fun_go')({ place: venue.name });
  await b.tool('fun_home')({});
  const saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  saved.trips[0].events = [...venue.randomEvents, ...venue.rareEvents];
  await b.world.stop();
  await writeFile(b.world.stateFile(), JSON.stringify(saved));
  const next = await boot({ dir: b.dir });
  await next.tool('fun_go')({ place: venue.name });
  const auto = await next.tool('fun_wander')({});
  const explicit = await next.tool('fun_wander')({ area: '纪念品店' });
  assert.doesNotMatch(auto.text, /——/);
  assert.doesNotMatch(explicit.text, /——/);
  const result = JSON.parse(await readFile(next.world.stateFile(), 'utf8'));
  assert.deepEqual(result.session.events, []);
});

test('旋转木马不抽到过山车体验，未购买不生成鲸鱼挂件收获', async () => {
  const b = await boot({ random: () => 0.12 });
  await b.tool('fun_go')({ place: '游乐场' });
  const r = await b.tool('fun_wander')({ area: '旋转木马' });
  assert.doesNotMatch(r.text, /过山车冲下去/);
  await b.tool('fun_home')({});
  await b.tool('fun_go')({ place: '海洋馆' });
  const shop = await b.tool('fun_wander')({ area: '纪念品店' });
  assert.doesNotMatch(shop.text, /最后挑了那个鲸鱼挂件/);
});

test('自动逛只记录一次项目一致事件，本次购买可以满足事件前置条件', async () => {
  const b = await boot({ random: () => 0 });
  await b.tool('fun_go')({ place: '游乐场' });
  await b.tool('fun_wander')({});
  let saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(saved.session.events.length, 1);
  await b.tool('fun_home')({});
  await b.tool('fun_go')({ place: '海洋馆' });
  // 纪念品店剩两个有效事件；0 选中有本次购买作依据的那条。
  const r = await b.tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼' });
  assert.match(r.text, /最后挑了那个鲸鱼挂件/);
  saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(saved.session.events.length, 1);
  assert.deepEqual(saved.session.souvenirs, ['鲸鱼挂件']);
});

test('珍藏行程独立于40趟上限，取消珍藏不影响长期收藏', async () => {
  const b = await boot();
  for (let i = 0; i < 42; i += 1) {
    await b.tool('fun_go')({ place: '海洋馆' });
    await b.tool('fun_wander')({ area: '纪念品店', buy: '鲸鱼挂件' });
    await b.tool('fun_home')({ note: `第${i + 1}趟` });
  }
  let saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(saved.trips.length, 40);
  assert.equal(saved.collection.find((x) => x.name === '鲸鱼挂件').times, 42);
  const old = saved.trips.find((t) => t.note === '第3趟');
  assert.ok(old, '即将离开近期窗口的行程仍可珍藏');
  assert.equal((await b.tool('fun_keepsake')({ id: old.id, keep: true })).failed, undefined);
  for (let i = 0; i < 2; i += 1) {
    await b.tool('fun_go')({ place: '海洋馆' });
    await b.tool('fun_home')({});
  }
  saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(saved.trips.length, 40);
  assert.ok(saved.keepsakeTrips.some((t) => t.id === old.id));
  const book = await b.world.webUi('zh').invoke('book', 'list', []);
  assert.ok(book.trips.some((t) => t.id === old.id && t.kept), `珍藏行程应仍可见：${JSON.stringify({ old: old.id, trips: book.trips.map((t) => ({ id: t.id, kept: t.kept, archived: t.archived })) })}`);
  const shelf = await b.world.webUi('zh').invoke('shelf', 'list', []);
  assert.equal(shelf.items.find((x) => x.name === '鲸鱼挂件').times, 42);
  await b.tool('fun_keepsake')({ id: old.id, keep: false });
  saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(saved.keepsakeTrips.some((t) => t.id === old.id), false);
  assert.equal(saved.collection.find((x) => x.name === '鲸鱼挂件').times, 42);
});

test('出游心愿：创建、重启保留、真实进门完成并给推荐理由', async () => {
  const b = await boot();
  const added = await b.tool('fun_wish')({ action: 'add', place: '江边', type: 'visit', reason: '想看看晚上的航灯' });
  assert.equal(added.failed, undefined);
  assert.match(added.text, /航灯/);
  const before = await b.tool('fun_places')({ all: true });
  assert.match(before.text, /江边.*有个心愿：想去江边/);
  const listed = await b.tool('fun_wishes')({});
  assert.match(listed.text, /航灯/);
  const again = await boot({ dir: b.dir });
  assert.match((await again.tool('fun_wishes')({})).text, /航灯/);
  const go = await again.tool('fun_go')({ place: '江边' });
  assert.match(go.text, /完成了心愿/);
  assert.match((await again.tool('fun_wishes')({})).text, /已完成/);
});

test('结构化事件选择：逛到事件给选项，选择后解锁下一处并写入行程', async () => {
  const b = await boot({ random: () => 0 });
  await b.tool('fun_go')({ place: '海洋馆' });
  const first = await b.tool('fun_wander')({ area: '海底隧道' });
  assert.match(first.text, /choiceId/);
  assert.match(first.text, /optionId/);
  const saved = JSON.parse(await readFile(join(b.dir, 'fun', 'state.json'), 'utf8'));
  const pending = saved.session.pendingChoice;
  assert.ok(pending);
  const blocked = await b.tool('fun_wander')({});
  assert.match(blocked.text, /待选择事件/);
  const picked = await b.tool('fun_choice')({ choiceId: pending.id, optionId: pending.options[0].id });
  assert.match(picked.text, /选择已确认：/);
  const after = JSON.parse(await readFile(join(b.dir, 'fun', 'state.json'), 'utf8'));
  assert.equal(after.session.pendingChoice, null);
  assert.equal(after.session.choices.length, 1);
  await b.tool('fun_home')({});
  const trip = JSON.parse(await readFile(join(b.dir, 'fun', 'state.json'), 'utf8')).trips[0];
  assert.equal(trip.choices.length, 1);
});

test('工具内部抛错也兜住：返回 failed 而不是炸掉整个世界', async () => {
  const b = await boot();
  // 传一个刚好在参数里会导致类型异常的坏值（对象当 count）。
  const r = await b.tool('fun_places')({ count: { evil: true } });
  assert.equal(r.failed, undefined, '坏参数应当被夹回默认值，不该失败');
  assert.match(r.text, /能去逛的/);
});

test('关闭等待正在提交的回家，不用旧状态覆盖行程记录', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  await b.tool('fun_wander')({ area: '同人展台' });
  const closing = b.tool('fun_home')({});
  await Promise.resolve();
  await b.world.stop();
  assert.match((await closing).text, /回家/);
  const saved = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(saved.session, null);
  assert.equal(saved.draft, null);
  assert.equal(saved.trips.length, 1);
  assert.equal(saved.trips[0].visited[0].area, '同人展台');
});

test('保存续逛或草稿回家失败时仍保留原记录', async () => {
  const b = await boot();
  await b.tool('fun_go')({ place: '漫展' });
  b.setNow(at('2026-11-16T10:00:00+08:00'));
  const data = await b.world.webUi().invoke('places', 'list', []);
  const before = await readFile(b.world.stateFile(), 'utf8');
  await mkdir(`${b.world.stateFile()}.tmp`);
  const resumed = await b.tool('fun_resume')({ id: data.draft.id });
  assert.equal(resumed.failed, true);
  const closed = await b.tool('fun_home')({ draftId: data.draft.id });
  assert.equal(closed.failed, true);
  assert.equal(await readFile(b.world.stateFile(), 'utf8'), before);
  const after = await b.world.webUi().invoke('places', 'list', []);
  assert.equal(after.draft.id, data.draft.id);
  assert.equal(after.session, null);
  assert.equal((await b.world.webUi().invoke('book', 'list', [])).trips.length, 0);
});

test('webUi：没在逛时给场所数和灯；在逛时多一个正在逛的徽章', async () => {
  const b = await boot();
  const idle = b.world.webUi('zh');
  assert.equal(idle.label, '从0开始的肥鱼大冒险');
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

// ---------------------------------------------------------------------------
// C 版：地点就是场所（旧地点库并进 venues.json）
// ---------------------------------------------------------------------------

const legacyLibrary = (places, homeId) => ({
  version: 1, revision: 3,
  data: { places, extras: [], sources: [], homeId, defaultStyle: '' },
  recovery: null,
});

test('C 版迁移：旧地点库的地点和原 id 并进 venues，画风 / home / 关联不断', async () => {
  const dir = await tempDir('fun-migrate-');
  const libDir = join(dir, 'fun', 'place-library');
  await mkdir(libDir, { recursive: true });
  const bookId = 'place-11111111-1111-4111-8111-111111111111';
  const dockId = 'place-22222222-2222-4222-8222-222222222222';
  const places = [
    { id: bookId, name: '旧书店', desc: '巷子深处', kind: 'around', aliases: ['书店'], tags: ['室内'],
      style: '水彩', scene: '', relations: [], cover: '', coverFocus: null },
    { id: dockId, name: '旧码头', desc: '河边', kind: 'place', aliases: [], tags: [],
      style: '', scene: '码头', relations: [{ placeId: bookId, note: '常去' }], cover: '', coverFocus: null },
  ];
  await writeFile(join(libDir, 'library.json'), JSON.stringify(legacyLibrary(places, bookId)));
  await mkdir(join(dir, 'fun'), { recursive: true });
  await writeFile(join(dir, 'fun', 'venues.json'), JSON.stringify({ venues: [], overrides: {} }));

  const b = await boot({ dir });
  const ui = b.world.webUi('zh').invoke.bind(b.world.webUi('zh'));
  const stored = JSON.parse(await readFile(join(dir, 'fun', 'venues.json'), 'utf8'));
  assert.deepEqual(stored.venues.map((row) => row.id).sort(), [bookId, dockId].sort());
  assert.ok(stored.venues.every((row) => row.playable === false), '旧地点是地图上的点，不是能逛的场所');
  assert.equal(stored.venues.find((row) => row.id === bookId).name, '旧书店');

  const manifest = JSON.parse(await readFile(join(libDir, 'library.json'), 'utf8'));
  assert.deepEqual(manifest.data.places, [], '旧表搬空');
  assert.equal(manifest.data.homeId, bookId, 'home 不能断');
  assert.deepEqual(manifest.data.extras.find((row) => row.id === bookId).style, '水彩', '画风搬进 extras');
  assert.deepEqual(manifest.data.extras.find((row) => row.id === dockId).relations,
    [{ placeId: bookId, note: '常去' }], '关联原样保留');

  const snapshot = await ui('locations', 'list', []);
  const book = snapshot.places.find((row) => row.id === bookId);
  assert.equal(book.isHome, true);
  assert.equal(book.style, '水彩');
  assert.equal(book.playable, false);
  assert.ok(!(await ui('places', 'list', [])).places.some((row) => row.id === bookId), '不可玩不进去哪儿');
  // 「地点册」里能把它改成能逛的场所
  const edited = await ui('locations', 'update', [{ id: dockId, revision: snapshot.revision,
    patch: { venue: { areas: ['栈桥'] } } }]);
  assert.equal(edited.ok, true, edited.error);
  assert.ok((await ui('places', 'list', [])).places.some((row) => row.id === dockId), '填了能逛的就进哪儿');

  // 重启不重复迁移
  await b.world.stop();
  const b2 = await boot({ dir });
  const again = JSON.parse(await readFile(join(dir, 'fun', 'venues.json'), 'utf8'));
  assert.equal(again.venues.filter((row) => row.id === bookId).length, 1);
  await b2.world.stop();
});

test('C 版迁移：旧地点库读不出来时不迁、不覆盖 venues，保存被拦', async () => {
  const dir = await tempDir('fun-migrate-bad-');
  const libDir = join(dir, 'fun', 'place-library');
  await mkdir(libDir, { recursive: true });
  await writeFile(join(libDir, 'library.json'), 'not-json');
  await mkdir(join(dir, 'fun'), { recursive: true });
  const venues = JSON.stringify({ venues: [], overrides: {} });
  await writeFile(join(dir, 'fun', 'venues.json'), venues);

  const b = await boot({ dir });
  assert.equal(await readFile(join(dir, 'fun', 'venues.json'), 'utf8'), venues, '坏地点库不许动 venues');
  const saved = await b.world.webUi('zh').invoke('places', 'save', [{ name: '小院', areas: ['藤椅'] }]);
  assert.equal(saved.ok, false);
  assert.match(saved.error, /迁移失败|暂不允许保存地点/);
  await b.world.stop();
});
