import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { validateStoryPack } from '../src/story-packs.js';
import {
  applyFreeDelta, checkEnd, continueFreeSegment, effectiveMaxTurns, evaluateWhen, freeCanContinue, freeSegmentsLeft, freeTurn,
  freeTurnsLeft, newFreeState, normalizeFreeState, parseFreeOutput,
} from '../src/story-free.js';

const AT = '2026-11-21T14:00:00+08:00';

function freePack(overrides = {}) {
  const base = {
    version: 3,
    id: 'rain-night',
    title: '折潮港的雨夜',
    description: '一封没寄出的信。',
    placeId: 'riverside',
    metadata: { mode: 'free', author: '本地作者', release: '1.0.0', genre: '悬疑', synopsis: '雨夜的港口，你们要弄清那封信为什么没寄出。', participation: 'solo', maxTurns: 6 },
    setting: {
      premise: '雨夜的折潮港，你们要弄清那封信为什么没寄出去，并在潮水漫上来之前离开。',
      canon: ['港口的钟停在 23:40', '写信的人三年前就离开了港口', '潮水在 01:00 漫过栈桥'],
      forbidden: ['写信的人今夜不会出现'],
      cast: [{ id: 'keeper', name: '看灯人', role: '守灯塔的老人', secret: '他知道信被谁取走了' }],
      locations: [{ id: 'pier', name: '栈桥', desc: '木板湿滑，尽头挂着一盏没点亮的灯' }],
      opening: '雨把港口泡得发亮。看灯人把一盏没点的灯推到你面前。',
      flags: [{ id: 'met-keeper', label: '见过看灯人', initial: false }],
      counters: [{ id: 'trust', label: '看灯人的信任', initial: 0, min: 0, max: 5 }],
      facts: [{ id: 'letter-state', label: '信的现状', initial: '还在邮筒里' }],
      goals: [{ id: 'find-reason', text: '知道信为什么没寄出', when: { all: [{ flag: 'met-keeper' }, { counter: 'trust', gte: 2 }] } }],
      ends: [{ id: 'leave-before-tide', text: '赶在潮水前离开', when: { all: [{ counter: 'trust', gte: 2 }] } }],
      beats: ['雨忽然大了一阵'],
    },
  };
  return { ...base, ...overrides, setting: { ...base.setting, ...(overrides.setting ?? {}) } };
}

function staticPack() {
  return {
    version: 1, id: 'pier-page', title: '步道上的一页', placeId: 'riverside', start: 'notice', nodes: [
      { id: 'notice', area: '步道', event: '步道上落着一页被雨打湿的信纸', prompt: '要捡起来看，还是继续往栏杆边走？', choices: [
        { id: 'pick', label: '捡起来看', result: '你把那页纸捡了起来', next: 'pick-end' },
        { id: 'walk', label: '去栏杆边', result: '你走到栏杆边看江面', next: 'walk-end' },
      ] },
      { id: 'pick-end', area: '步道', event: '纸上的字被雨晕开，只认得出一个名字' },
      { id: 'walk-end', area: '栏杆边', event: '江面上有船慢慢过去，灯一串一串地晃' },
    ],
  };
}

const narration = (extra = '') => `雨声盖住了脚步，看灯人把灯举高一点，照亮了栈桥尽头的水光。${extra}`;

async function boot(t, options = {}) {
  const dir = await mkdtemp(join(process.env.TEMP || process.cwd(), 'fun-free-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const replies = [...(options.replies ?? [])];
  const requests = [];
  const cognition = {
    request: async (payload) => {
      requests.push(payload);
      const next = replies.shift();
      return { text: typeof next === 'string' ? next : JSON.stringify(next ?? { narration: narration() }) };
    },
  };
  const cfg = { enabled: true, funStoryTextOn: true, funStoryFree: true, ...(options.cfg ?? {}) };
  const world = new FunWorld({ dataDir: dir, cfg, timezone: 'Asia/Shanghai', now: () => Date.parse(AT), random: () => 0 });
  await world.start({ cognition, log: { info() {}, warn() {} } });
  const tool = (name, args = {}) => world.tools().find((row) => row.name === name).handler(args);
  const panel = (id, method, payload = {}) => world.webUi().invoke(id, method, [payload]);
  const json = async (name, args = {}) => JSON.parse((await tool(name, args)).text);
  return { dir, world, tool, panel, json, requests, replies };
}

async function importFree(b) {
  const imported = await b.panel('stories', 'import', { json: JSON.stringify(freePack()) });
  assert.equal(imported.ok, true, imported.error);
  const candidates = await b.json('fun_story_candidates');
  const card = candidates.candidates.find((row) => row.id === 'rain-night');
  assert.ok(card, 'free pack should be listed');
  return card;
}

async function startFree(b) {
  const card = await importFree(b);
  const current = await b.json('fun_story_current');
  const started = await b.json('fun_story_start', { packId: card.id, revision: card.revision, startStamp: current.startStamp, confirm: true });
  assert.equal(started.ok, true, started.error);
  return started;
}

test('场景包只写设定和条件：拒绝节点字段、缺正史、引用未登记状态', () => {
  const good = validateStoryPack(freePack());
  assert.equal(good.ok, true, good.errors?.join('；'));
  assert.equal(good.pack.version, 3);
  assert.equal(good.pack.setting.canon.length, 3);

  const withNodes = validateStoryPack(freePack({ start: 'notice', nodes: [] }));
  assert.equal(withNodes.ok, false);
  assert.match(withNodes.errors.join('；'), /unsupported field/);

  const noCanon = validateStoryPack(freePack({ setting: { canon: ['只有一条'] } }));
  assert.equal(noCanon.ok, false);
  assert.match(noCanon.errors.join('；'), /at least 3/);

  const badWhen = validateStoryPack(freePack({ setting: { ends: [{ id: 'leave', text: '离开', when: { flag: 'nope' } }] } }));
  assert.equal(badWhen.ok, false);
  assert.match(badWhen.errors.join('；'), /unknown flag id/);
});

test('主持的返回严格限定字段，短叙述和多余字段都不收', () => {
  assert.equal(parseFreeOutput(JSON.stringify({ narration: narration() })).ok, true);
  assert.equal(parseFreeOutput(JSON.stringify({ narration: '太短' })).ok, false);
  assert.equal(parseFreeOutput(JSON.stringify({ narration: narration(), choice: 'a' })).ok, false);
  assert.equal(parseFreeOutput('不是 JSON').ok, false);
  const withDelta = parseFreeOutput(JSON.stringify({ narration: narration(), delta: { flags: { 'met-keeper': true } } }));
  assert.equal(withDelta.ok, true);
  assert.deepEqual(withDelta.delta.flags, { 'met-keeper': true });
});

test('状态增量白名单：未登记、类型错、越界、未知分区都整份拒绝', () => {
  const pack = validateStoryPack(freePack()).pack;
  const free = newFreeState(pack.setting);
  assert.equal(applyFreeDelta(pack.setting, free, { flags: { 'met-keeper': true } }).ok, true);
  assert.equal(applyFreeDelta(pack.setting, free, { flags: { nope: true } }).ok, false);
  assert.equal(applyFreeDelta(pack.setting, free, { facts: { 'letter-state': 3 } }).ok, false);
  assert.equal(applyFreeDelta(pack.setting, free, { counters: { trust: 9 } }).ok, false);
  assert.equal(applyFreeDelta(pack.setting, free, { counters: { trust: 1.5 } }).ok, false);
  assert.equal(applyFreeDelta(pack.setting, free, { health: { x: 1 } }).ok, false);
  const tooMany = { flags: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`f${i}`, true])) };
  assert.equal(applyFreeDelta(pack.setting, free, tooMany).ok, false);
});

test('结局由程序判定：条件没满足时只记一次拒绝，满足了才收尾', () => {
  const pack = validateStoryPack(freePack()).pack;
  const free = newFreeState(pack.setting);
  assert.equal(evaluateWhen({ counter: 'trust', gte: 2 }, free), false);
  const early = checkEnd(pack.setting, free, 'leave-before-tide');
  assert.equal(early.ok, false);
  assert.equal(early.requested, true);
  const turn = freeTurn(pack.setting, free, { narration: narration(), endRequest: 'leave-before-tide' }, { now: 1, say: '我们想走了' });
  assert.equal(turn.ok, true);
  assert.equal(turn.free.ended, null);
  assert.match(turn.endRejected, /条件还没有满足/);
  const ready = { ...turn.free, counters: { ...turn.free.counters, trust: 3 } };
  const ended = freeTurn(pack.setting, ready, { narration: narration(), endRequest: 'leave-before-tide' }, { now: 2, say: '趁潮水还没上来' });
  assert.equal(ended.ok, true);
  assert.equal(ended.free.ended, 'leave-before-tide');
});

test('每回合合并：回合 +1、日志有界、状态合并、摘要可更新', () => {
  const pack = validateStoryPack(freePack()).pack;
  let free = newFreeState(pack.setting);
  const output = parseFreeOutput(JSON.stringify({
    narration: narration(), delta: { flags: { 'met-keeper': true }, counters: { trust: 2 }, facts: { 'letter-state': '被人从邮筒里取走了' } },
    summary: '看灯人承认信是他取走的。',
  }));
  const turn = freeTurn(pack.setting, free, output, { now: 5, from: '阿枫', say: '那封信是你拿的吗' });
  assert.equal(turn.ok, true, turn.error);
  assert.equal(turn.free.turn, 1);
  assert.equal(turn.free.flags['met-keeper'], true);
  assert.equal(turn.free.counters.trust, 2);
  assert.equal(turn.free.summary, '看灯人承认信是他取走的。');
  assert.equal(turn.free.log.at(-1).from, '阿枫');
  const normalized = normalizeFreeState({ ...turn.free, facts: { ...turn.free.facts, unknown: 'x' } }, pack.setting);
  assert.equal('unknown' in normalized.facts, false);
  assert.equal(effectiveMaxTurns({ metadata: { maxTurns: 30 } }, 40), 30);
  assert.equal(effectiveMaxTurns({ metadata: { maxTurns: 30 } }, 10), 10);
});

test('文字通道关闭时聊天里只留候选与详情两个查询', async (t) => {
  const b = await boot(t, { cfg: { funStoryTextOn: false } });
  await importFree(b);
  const names = b.world.tools().map((row) => row.name);
  // 折中：聊天里问「有什么故事」还答得上，其余故事工具全部收起来省 schema。
  assert.ok(names.includes('fun_story_candidates') && names.includes('fun_story_detail'), '两个查询要留着');
  for (const name of ['fun_story', 'fun_story_start', 'fun_story_act', 'fun_story_places', 'fun_story_current', 'fun_story_recap', 'fun_story_schedule']) {
    assert.ok(!names.includes(name), `${name} 关着时不该出现`);
  }
  const candidates = await b.json('fun_story_candidates', { full: true });
  assert.ok(candidates.candidates.some((row) => row.id === 'rain-night'), '候选仍能查');
});

test('自由模式开关关闭时场景包不可开始', async (t) => {
  const b = await boot(t, { cfg: { funStoryFree: false } });
  const card = await importFree(b);
  assert.equal(card.available, false);
  assert.match(card.reason, /自由模式未开启/);
  const current = await b.json('fun_story_current');
  const started = await b.tool('fun_story_start', { packId: card.id, revision: card.revision, startStamp: current.startStamp, confirm: true });
  assert.equal(started.failed, true);
});

test('自由模式在聊天里走一回合：落盘、旧 stamp 拒绝、不重复推进', async (t) => {
  const b = await boot(t, { replies: [{ narration: narration('看灯人没有回答。') }] });
  const started = await startFree(b);
  assert.equal(started.mode, 'free');
  const first = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '那封信是你拿的吗', from: '阿枫' });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.turn, 1);
  assert.match(first.narration, /看灯人没有回答/);

  const state = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(state.session.storyRun.free.turn, 1);
  assert.equal(state.session.storyRun.free.log.length, 1);
  assert.equal(state.session.storyRun.free.log[0].from, '阿枫');

  const stale = await b.tool('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '再问一次' });
  assert.equal(stale.failed, true);
  assert.match(stale.text, /STALE/);
  const after = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(after.session.storyRun.free.turn, 1);
});

test('自由模式「再来一段」只抬高本段下限，最多三段', () => {
  const setting = freePack().setting;
  const maxTurns = 2;
  const spent = { ...newFreeState(setting), turn: 2, turnBase: 0 };
  assert.equal(freeTurnsLeft(spent, maxTurns), 0);
  assert.equal(freeCanContinue(spent, maxTurns), true);
  assert.equal(freeSegmentsLeft(spent), 2);
  assert.equal(continueFreeSegment({ ...spent, turn: 1 }, maxTurns).ok, false, '没用完不能开新段');
  const second = continueFreeSegment(spent, maxTurns);
  assert.equal(second.ok, true);
  assert.equal(second.free.segment, 1);
  assert.equal(second.free.turnBase, 2);
  assert.equal(freeTurnsLeft(second.free, maxTurns), 2);
  assert.equal(freeCanContinue(second.free, maxTurns), false, '新的一段又能说了');
  const turn = freeTurn(setting, second.free, { narration: narration() }, { maxTurns });
  assert.equal(turn.ok, true);
  assert.equal(turn.free.turn, 3);
  const third = continueFreeSegment({ ...turn.free, turn: 4 }, maxTurns);
  assert.equal(third.free.segment, 2);
  const refused = continueFreeSegment({ ...turn.free, turn: 6, turnBase: 4, segment: 2 }, maxTurns);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /3 段/);
  assert.equal(continueFreeSegment({ ...spent, ended: 'leave-before-tide' }, maxTurns).ok, false, '收尾后不再续段');
});

test('自由模式回合说完后在面板里显式再来一段，段号落盘且最多三段', async (t) => {
  const b = await boot(t, { cfg: { funStoryFreeTurns: 1 }, replies: [{ narration: narration('第一段') }, { narration: narration('第二段') }] });
  const started = await startFree(b);
  assert.equal(started.free.maxTurns, 1);
  assert.equal(started.free.segment, 1);
  assert.equal(started.free.turnsLeft, 1);
  const first = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '看灯人，借个火' });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.free.turnsLeft, 0);
  assert.equal(first.free.canContinue, true);
  const spent = await b.panel('story', 'status');
  assert.equal(spent.trip.free.canContinue, true);
  assert.equal(spent.trip.free.segmentsLeft, 2);
  assert.equal((await b.panel('story', 'segment', { tripId: spent.trip.id, stamp: spent.trip.stamp })).ok, false, '开新的一段必须显式确认');
  const second = await b.panel('story', 'segment', { tripId: spent.trip.id, stamp: spent.trip.stamp, confirm: true });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.trip.free.segment, 2);
  assert.equal(second.trip.free.turnsLeft, 1);
  assert.equal(second.trip.free.canContinue, false);
  assert.equal((await b.panel('story', 'segment', { tripId: second.trip.id, stamp: second.trip.stamp, confirm: true })).ok, false, '没用完不需要新的一段');
  const said = await b.panel('story', 'say', { tripId: second.trip.id, stamp: second.trip.stamp, say: '这一段再说一句' });
  assert.equal(said.ok, true, said.error);
  assert.equal(said.trip.free.turn, 2);
  assert.equal(said.trip.free.segment, 2);
  const disk = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(disk.session.storyRun.free.segment, 1, '段号落盘');
  assert.equal(disk.session.storyRun.free.turnBase, 1, '本段起点落盘');
});

test('主持返回非法状态时这一回合不提交，进度和日志都不变', async (t) => {
  const invalid = { narration: narration(), delta: { flags: { 'not-registered': true } } };
  const b = await boot(t, { replies: [invalid, invalid] });
  const started = await startFree(b);
  const failed = await b.tool('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '我想去栈桥' });
  assert.equal(failed.failed, true);
  assert.match(failed.text, /没有登记/);
  const state = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(state.session.storyRun.free.turn, 0);
  assert.equal(state.session.storyRun.free.log.length, 0);
  assert.ok(state.session.storyRun.freeCalls >= 1);
});

test('自由模式的回合上限来自用户设置与场景包的较小值', async (t) => {
  const b = await boot(t, { cfg: { funStoryFreeTurns: 1 } });
  const started = await startFree(b);
  assert.equal(started.free.maxTurns, 1);
  const one = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '看灯人，借个火' });
  assert.equal(one.ok, true, one.error);
  const two = await b.tool('fun_story_act', { tripId: started.tripId, stamp: one.stamp ?? started.stamp, intent: 'say', say: '再问一句' });
  assert.equal(two.failed, true);
  assert.match(two.text, /回合数已经用完/);
});

test('面板也能推进自由模式：不受文字通道开关限制', async (t) => {
  const b = await boot(t, { cfg: { funStoryTextOn: false }, replies: [{ narration: narration() }] });
  const card = await importFree(b);
  const status = await b.panel('story', 'status');
  assert.equal(status.ok, true);
  const started = await b.panel('story', 'start', { startStamp: status.startStamp, packId: card.id, revision: card.revision });
  assert.equal(started.ok, true, started.error);
  assert.equal(started.trip.mode, 'free');
  const said = await b.panel('story', 'say', { tripId: started.trip.id, stamp: started.trip.stamp, say: '我先去看看那盏灯' });
  assert.equal(said.ok, true, said.error);
  assert.equal(said.trip.free.turn, 1);
  assert.match(said.lastSay.narration, /雨声/);
  const stale = await b.panel('story', 'say', { tripId: started.trip.id, stamp: started.trip.stamp, say: '再说一次' });
  assert.equal(stale.ok, false);
  assert.match(stale.error, /进度已变更/);
});

test('自由模式可以退回上一回合：状态与日志一起回滚，额度不退', async (t) => {
  const b = await boot(t);
  const started = await startFree(b);
  const first = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '第一句' });
  assert.equal(first.turn, 1);
  const before = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  const rewind = await b.panel('story', 'rewind', {});
  assert.equal(rewind.ok, true, rewind.error);
  assert.equal(rewind.trip.free.turn, 0);
  assert.equal(rewind.trip.free.log.length, 0);
  const after = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(after.session.storyRun.free.turn, 0);
  assert.equal(after.session.storyRun.freeCalls, before.session.storyRun.freeCalls, '已经花掉的调用不退');
  const empty = await b.panel('story', 'rewind', {});
  assert.equal(empty.ok, false);
  assert.match(empty.error, /还没有可以退回/);
});

test('自由模式生图用最后一条叙述，不拿选项式事件凑', async (t) => {
  const b = await boot(t, { cfg: { funStoryImages: true } });
  const started = await startFree(b);
  await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '我去看看那盏灯' });
  const result = await b.panel('story', 'storyImage');
  assert.equal(result.ok, true, result.error);
  assert.match(result.image.prompt, /看灯人把灯举高/);
  assert.match(result.image.prompt, /栈桥/);
  assert.equal(result.image.status === 'delegated' || result.image.status === 'unavailable', true);
});

test('文字通道一次提交后 stamp 变化，重复同一句不会双推进', async (t) => {
  const b = await boot(t, { replies: [{ narration: narration() }] });
  const started = await startFree(b);
  const args = { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '看灯人，借个火' };
  const first = await b.json('fun_story_act', args);
  assert.equal(first.ok, true, first.error);
  const again = await b.tool('fun_story_act', args);
  assert.equal(again.failed, true);
  assert.match(again.text, /STALE/);
  const state = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(state.session.storyRun.free.turn, 1);
});

test('选项式故事在聊天里：原话命中直接生效，对不上先给待确认提议', async (t) => {
  const b = await boot(t);
  const imported = await b.panel('stories', 'import', { json: JSON.stringify(staticPack()) });
  assert.equal(imported.ok, true, imported.error);
  const candidates = await b.json('fun_story_candidates');
  const card = candidates.candidates.find((row) => row.id === 'pier-page');
  const current = await b.json('fun_story_current');
  const started = await b.json('fun_story_start', { packId: card.id, revision: card.revision, startStamp: current.startStamp, confirm: true });
  assert.equal(started.ok, true, started.error);

  // 开局后先走到起始区域（故事节点绑在「步道」上）。
  const moved = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '往里走' });
  assert.equal(moved.ok, true, moved.error);
  assert.ok(moved.pending, '应出现待选事件');
  assert.equal(moved.pending.options.length, 2);

  // 原话正好包含选项文字：直接提交。
  const hit = await b.json('fun_story_act', { tripId: moved.stamp ? started.tripId : started.tripId, stamp: moved.stamp, intent: 'say', say: '我捡起来看' });
  assert.equal(hit.ok, true, hit.error);
  assert.equal(hit.chosen, 'pick');
  assert.equal(hit.pending, null);
  assert.match(hit.result, /捡了起来/);
});

test('选项式故事的选择对不上时，先返回 proposalId，确认后才提交', async (t) => {
  const b = await boot(t, { replies: [{ optionId: 'walk', reason: '用户想靠近栏杆' }] });
  const imported = await b.panel('stories', 'import', { json: JSON.stringify(staticPack()) });
  assert.equal(imported.ok, true, imported.error);
  const card = (await b.json('fun_story_candidates')).candidates.find((row) => row.id === 'pier-page');
  const current = await b.json('fun_story_current');
  const started = await b.json('fun_story_start', { packId: card.id, revision: card.revision, startStamp: current.startStamp, confirm: true });
  const moved = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '往里走' });
  const proposal = await b.json('fun_story_act', { tripId: started.tripId, stamp: moved.stamp, intent: 'say', say: '我想靠水近一点' });
  assert.equal(proposal.ok, true, proposal.error);
  assert.equal(proposal.needConfirm, true);
  assert.equal(proposal.optionId, 'walk');
  const state = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.ok(state.session.pendingChoice, '未确认时不能提交');
  const confirmed = await b.json('fun_story_act', { tripId: started.tripId, stamp: moved.stamp, intent: 'say', proposalId: proposal.proposalId, optionId: 'walk' });
  assert.equal(confirmed.ok, true, confirmed.error);
  assert.equal(confirmed.chosen, 'walk');
});
