/**
 * M5「房间与回忆」验收：快照、画架、导出/导入、自动出门开关。
 *
 * 重点守：
 *   · 快照只存 digest，不复制图片字节；图没了列表要能看出来；
 *   · 导入只在空房间、图片逐张校验、失败回滚；
 *   · 自动出门默认关、关着时定时器根本不注册、开着时最多一次、可撤销。
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

test('自动出门：默认关且不注册；开了才注册，走同一 fun_go 并标 auto；撤销可回', async (t) => {
  assert.equal(DEFAULTS.funHomeAutoGo, false);
  const group = configGroup('zh');
  assert.equal(group.schema.properties['worlds.fun.funHomeAutoGo'].type, 'boolean');
  assert.match(group.schema.properties['worlds.fun.funHomeAutoGo'].description, /10:00–20:00/);

  const offDir = await mkdtemp(join(tmpdir(), 'fun-home-auto-off-'));
  const off = new FunWorld({ cfg: { ...DEFAULTS, enabled: true }, dataDir: offDir, timezone: TZ, now: () => NOON });
  await off.start({ log: { info() {}, warn() {} } });
  assert.equal(off.autoGoRegistered, false, '关着时没有注册定时器');
  const skipped = await off.runAutoGo();
  assert.equal(skipped.ok, false);
  assert.equal(skipped.skipped, 'off');
  await assert.rejects(readFile(join(offDir, 'fun', 'state.json')), { code: 'ENOENT' }, '关着时 state.json 没有变化');
  await off.stop();
  t.after(() => rm(offDir, { recursive: true, force: true }));

  const onDir = await mkdtemp(join(tmpdir(), 'fun-home-auto-on-'));
  const on = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, funHomeAutoGo: true }, dataDir: onDir, timezone: TZ, now: () => NOON,
  });
  await on.start({ log: { info() {}, warn() {} } });
  t.after(async () => { await on.stop(); await rm(onDir, { recursive: true, force: true }); });
  assert.equal(on.autoGoRegistered, true, '开着时注册定时器');
  const first = await on.runAutoGo();
  assert.equal(first.ok, true, first.text);
  const stored = JSON.parse(await readFile(join(onDir, 'fun', 'state.json'), 'utf8'));
  assert.equal(stored.session.auto, true, '行程标了 auto');
  assert.equal(stored.session.placeName.length > 0, true);
  const again = await on.runAutoGo();
  assert.equal(again.ok, false, '正在出门时不重复');
  assert.equal(again.skipped, 'trip');

  const homeTool = on.tools().find((tool) => tool.name === 'fun_home').handler;
  await homeTool({});
  const trips = await on.webUi('zh').invoke('book', 'list', []);
  assert.equal(trips.trips[0].auto, true, '回忆里能看出是自动的');
  const later = await on.runAutoGo();
  assert.equal(later.skipped, 'already', '当天已经自动出去过一次');
});

test('撤销这次出门：调 fun_home 收摊，不留下进行中的行程', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-auto-undo-'));
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, funHomeAutoGo: true }, dataDir: dir, timezone: TZ, now: () => NOON,
  });
  await world.start({ log: { info() {}, warn() {} } });
  t.after(async () => { await world.stop(); await rm(dir, { recursive: true, force: true }); });
  assert.equal((await world.runAutoGo()).ok, true);
  const state = await world.webUi('zh').invoke('home', 'state', []);
  assert.equal(state.trip.mode, 'out');
  assert.equal(state.trip.auto, true);
  const undone = await world.webUi('zh').invoke('home', 'undoAutoGo', [{}]);
  assert.equal(undone.ok, true, undone.error);
  assert.equal(undone.trip.mode, 'home');
  const stored = JSON.parse(await readFile(join(dir, 'fun', 'state.json'), 'utf8'));
  assert.equal(stored.session, null);
  assert.equal(stored.trips[0].auto, true);
  const none = await world.webUi('zh').invoke('home', 'undoAutoGo', [{}]);
  assert.equal(none.ok, false, '没有自动行程时明确失败');
});