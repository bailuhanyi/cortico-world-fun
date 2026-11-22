/**
 * M5「房间与回忆」验收：快照、画架、导出/导入、自动出门开关。
 *
 * 重点守：
 *   · 快照只存 digest，不复制图片字节；图没了列表要能看出来；
 *   · 导入只在空房间、图片逐张校验、失败回滚；
 *   · 「允许她自己出门」只是提示词许可：默认关、没有定时器、出门回执提示写进日程。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, configGroup } from '../src/config.js';
import { HomeRoom } from '../src/home-room.js';
import { FunWorld } from '../src/world.js';

const TZ = 'Asia/Shanghai';
const NOON = Date.parse('2026-11-22T12:00:00+08:00');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG, 'base64');
const dataUrl = () => `data:image/png;base64,${PNG}`;

async function home(t) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-circle-'));
  const room = new HomeRoom({ dataDir: dir, now: () => NOON });
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, room };
}

test('快照：存/列/删；图被清掉后列表明确说「不在了」', async (t) => {
  const { room } = await home(t);
  const withArt = await room.setBackground(dataUrl(), 0);
  const snap = await room.saveSnapshot({
    phase: 'night',
    room: { activity: 'reading', label: '读书', note: '在沙发上翻一本旧书', plan: '' },
    art: { background: withArt.art.background, characters: {}, hotspots: [], foreground: '', painting: '' },
    placements: {}, keepsakes: [{ name: '鲸鱼挂件', placeName: '海洋馆', day: '2026-11-22', category: 'doll' }],
  });
  assert.match(snap.id, /^\d+$/);
  const listed = await room.listSnapshots();
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].missing, 0);
  assert.equal(listed.items[0].label, '读书');
  assert.equal(JSON.stringify(listed.items[0].data).includes('data:image'), false, '快照不含图片字节');
  assert.equal(JSON.stringify(listed.items[0].data).includes(PNG), false);

  // 清掉背景 → 没人引用的图被回收；快照引用还在，列表要标出来。
  await room.clearBackground(withArt.revision);
  const after = await room.listSnapshots();
  assert.equal(after.items[0].missing, 1);

  await room.removeSnapshot(snap.id);
  assert.equal((await room.listSnapshots()).items.length, 0);
  await assert.rejects(room.removeSnapshot('../evil'), (error) => error.code === 'INVALID_ROOM');
});

test('画架：本地图片复制进 art/，读得回；不调生图工作室', async (t) => {
  const { dir, room } = await home(t);
  const source = join(dir, 'pick.png');
  await writeFile(source, PNG_BYTES);
  const next = await room.attachPainting(source, 0);
  assert.match(next.art.painting, /^[a-f0-9]{64}\.png$/);
  const image = await room.readArt('painting');
  assert.equal(image.mime, 'image/png');
  await assert.rejects(room.attachPainting(join(dir, 'missing.png'), next.revision), (error) => error.code === 'INVALID_COVER');
  await room.clearPainting(next.revision);
  assert.equal(await room.readArt('painting'), null);
});

test('导出/导入：只含引用不含字节；只允许空房间；缺图失败且不留下房间文件', async (t) => {
  const { dir: sourceDir, room: source } = await home(t);
  const withArt = await source.setBackground(dataUrl(), 0);
  await source.setActivity('reading', { note: '在沙发上翻一本旧书', revision: withArt.revision });
  await source.saveSnapshot({
    phase: 'night',
    room: { activity: 'reading', label: '读书', note: '在沙发上翻一本旧书', plan: '' },
    art: { background: withArt.art.background, characters: {}, hotspots: [], foreground: '', painting: '' },
    placements: {}, keepsakes: [],
  });
  const exported = await source.exportRoom();
  assert.deepEqual(exported.artRefs, [withArt.art.background]);
  assert.equal(JSON.stringify(exported).includes('data:image'), false);
  assert.equal(JSON.stringify(exported).includes(PNG), false);
  assert.equal(exported.snapshots.length, 1);

  const targetDir = await mkdtemp(join(tmpdir(), 'fun-home-circle-target-'));
  t.after(() => rm(targetDir, { recursive: true, force: true }));
  const target = new HomeRoom({ dataDir: targetDir, now: () => NOON });
  await mkdir(join(targetDir, 'fun', 'home', 'art'), { recursive: true });
  await writeFile(join(targetDir, 'fun', 'home', 'art', withArt.art.background), PNG_BYTES);
  const imported = await target.importRoom(exported);
  assert.equal(imported.room.activity, 'reading');
  assert.equal(imported.room.note, '在沙发上翻一本旧书');
  assert.equal(imported.art.background, withArt.art.background);
  assert.equal(JSON.parse(await readFile(join(targetDir, 'fun', 'home', 'room.json'), 'utf8')).version, 2);
  assert.equal((await target.listSnapshots()).items.length, 1);

  // 非空房间拒绝导入。
  await assert.rejects(target.importRoom(exported), (error) => error.code === 'INVALID_ROOM');

  // 空房间但缺图：拒绝，且没有写出 room.json。
  const brokenDir = await mkdtemp(join(tmpdir(), 'fun-home-circle-broken-'));
  t.after(() => rm(brokenDir, { recursive: true, force: true }));
  const broken = new HomeRoom({ dataDir: brokenDir, now: () => NOON });
  await assert.rejects(broken.importRoom(exported), (error) => error.code === 'INVALID_ROOM');
  await assert.rejects(readFile(join(brokenDir, 'fun', 'home', 'room.json')), { code: 'ENOENT' });
  void sourceDir;
});

test('自己出门：开关+时段才叫醒；叫醒只说「看日程」，不替她挑地方', async (t) => {
  assert.equal(DEFAULTS.funHomeAutoGo, false, '默认关');
  assert.equal(DEFAULTS.funHomeAutoSlots, '10:30,15:30,19:30');
  const group = configGroup('zh');
  const on = group.schema.properties['worlds.fun.funHomeAutoGo'];
  const slots = group.schema.properties['worlds.fun.funHomeAutoSlots'];
  assert.equal(on.type, 'boolean');
  assert.equal(slots.type, 'string');
  assert.match(on.description, /时段/);
  assert.match(slots.description, /HH:MM/);

  let clock = Date.parse('2026-11-22T10:30:00+08:00');
  const pushes = [];
  const host = {
    log: { info() {}, warn() {} },
    pushEvent: (event, options) => { pushes.push({ event, options }); },
  };

  // 关着：这条路径不叫醒。
  const offDir = await mkdtemp(join(tmpdir(), 'fun-home-selfgo-off-'));
  const off = new FunWorld({ cfg: { ...DEFAULTS, enabled: true }, dataDir: offDir, timezone: TZ, now: () => clock });
  await off.start(host);
  t.after(async () => { await off.stop(); await rm(offDir, { recursive: true, force: true }); });
  assert.equal((await off.runAutoInvite()).skipped, 'off');
  assert.equal(pushes.length, 0);

  // 开着：到点推一条 internal 事件，同一天同一时段只推一次。
  const onDir = await mkdtemp(join(tmpdir(), 'fun-home-selfgo-on-'));
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, funHomeAutoGo: true }, dataDir: onDir, timezone: TZ, now: () => clock,
  });
  await world.start(host);
  t.after(async () => { await world.stop(); await rm(onDir, { recursive: true, force: true }); });
  assert.match(world.envPromptVars().fun_places_block, /主人允许你自己出门/);

  const first = await world.runAutoInvite();
  assert.equal(first.ok, true, first.text);
  assert.equal(pushes.length, 1);
  const [{ event, options }] = pushes;
  assert.equal(event.type, 'fun.home.free');
  assert.equal(event.origin, 'internal');
  assert.equal(event.source, 'fun');
  assert.equal(options.deliver, true);
  assert.match(event.text, /feast_life_now/, '先看日程');
  assert.match(event.text, /feast_life_play/, '回来记一笔');
  assert.match(event.text, /不会自己把你送出门/);
  await assert.rejects(readFile(join(onDir, 'fun', 'state.json')), { code: 'ENOENT' }, '叫醒不改行程');

  clock = Date.parse('2026-11-22T10:31:00+08:00');
  assert.equal((await world.runAutoInvite()).skipped, 'noslot', '同一时段不重复叫');
  clock = Date.parse('2026-11-22T12:00:00+08:00');
  assert.equal((await world.runAutoInvite()).skipped, 'noslot', '不是时段不叫');
  clock = Date.parse('2026-11-22T15:31:00+08:00');
  assert.equal((await world.runAutoInvite()).ok, true, '下一个时段照叫，一天不限一次');
  clock = Date.parse('2026-11-23T10:30:00+08:00');
  assert.equal((await world.runAutoInvite()).ok, true, '跨天重来');
  assert.equal(pushes.length, 3);

  // 已经在外面：不叫。
  clock = Date.parse('2026-11-23T15:30:00+08:00');
  const go = world.tools().find((tool) => tool.name === 'fun_go').handler;
  await go({ place: '咖啡店' });
  assert.equal((await world.runAutoInvite()).skipped, 'trip');
  assert.equal(pushes.length, 3);
});

test('出门回执提示写进日程；面板不再有撤销自动出门', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-selfgo-trip-'));
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, funHomeAutoGo: true }, dataDir: dir, timezone: TZ, now: () => NOON,
  });
  await world.start({ log: { info() {}, warn() {} } });
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });

  const go = world.tools().find((tool) => tool.name === 'fun_go').handler;
  const entered = await go({ place: '咖啡店' });
  assert.equal(entered.failed, undefined, entered.text);
  assert.match(entered.text, /feast_life_adjust/, '出门回执要提示写进当天日程');
  assert.match(entered.text, /feast_life_play/);

  const state = await world.webUi('zh').invoke('home', 'state', []);
  assert.equal(state.trip.mode, 'out');
  assert.equal(state.trip.auto, false, '不再有自动出门标记');
  const undo = await world.webUi('zh').invoke('home', 'undoAutoGo', [{}]);
  assert.equal(undo.ok, false, 'undoAutoGo 已经移除');
});