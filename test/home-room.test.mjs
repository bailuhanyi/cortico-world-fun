import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACTIVITIES, blankRoom, defaultActivityAt, HomeRoom, HomeRoomError, phaseAtHour } from '../src/home-room.js';
import { cleanup } from './tmp.mjs';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const OTHER_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const dataUrl = (base64) => `data:image/png;base64,${base64}`;

async function home(t) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-home-room-'));
  const room = new HomeRoom({ dataDir: dir });
  cleanup(t, dir);
  return { dir, room, file: join(dir, 'fun', 'home', 'room.json'), art: join(dir, 'fun', 'home', 'art') };
}

test('空房间：读出来是发呆，而且只读不建目录', async (t) => {
  const { dir, room } = await home(t);
  const snapshot = await room.snapshot();
  assert.equal(snapshot.revision, 0);
  assert.equal(snapshot.room.activity, 'idle');
  assert.equal(snapshot.room.label, '发呆');
  assert.equal(snapshot.room.since, null);
  assert.equal(snapshot.damaged, false);
  assert.deepEqual(snapshot.art, {
    background: '', characters: {}, hotspots: [], foreground: '', painting: '', builtin: [...ACTIVITIES],
  });
  assert.deepEqual(snapshot.placements, {});
  await assert.rejects(stat(join(dir, 'fun')), { code: 'ENOENT' });
  assert.equal(await room.readArt('background'), null);
  const builtin = await room.readArt('character', 'idle');
  assert.equal(builtin.builtin, 'idle', '没传图的角色走内置 Q 版');
  assert.match(builtin.dataUrl, /^data:image\/webp;base64,/);
});

test('切活动写盘：revision 加一、备注一起存、再读回来一致', async (t) => {
  const { room, file } = await home(t);
  const next = await room.setActivity('reading', { note: ' 在沙发上翻一本旧书 ', revision: 0 });
  assert.equal(next.revision, 1);
  assert.equal(next.room.activity, 'reading');
  assert.equal(next.room.label, '读书');
  assert.equal(next.room.note, '在沙发上翻一本旧书');
  const stored = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(stored.room.activity, 'reading');
  assert.equal(stored.version, 2);
  assert.deepEqual(stored.placements, {}, '新写的就是 v2，带空 placements');
  // snapshot 比写入回执多一份「内置立绘有哪些」的清单，其余字段必须逐字一致。
  const snapshot = await room.snapshot();
  const { builtin, ...art } = snapshot.art;
  assert.deepEqual(builtin, [...ACTIVITIES]);
  assert.deepEqual({ ...snapshot, art }, { ...next, damaged: false, warning: '' });
});

test('同一个活动再点一次不升 revision、不重写盘', async (t) => {
  const { room, file } = await home(t);
  const first = await room.setActivity('reading', { revision: 0 });
  const before = await stat(file);
  const again = await room.setActivity('reading', { revision: first.revision });
  const after = await stat(file);
  assert.equal(again.revision, 1);
  assert.equal(after.mtimeMs, before.mtimeMs);
});

test('拿旧 revision 写会退回 STALE_ROOM，不认识的活动与过长的备注都拒绝', async (t) => {
  const { room } = await home(t);
  await room.setActivity('reading', { revision: 0 });
  await assert.rejects(room.setActivity('gaming', { revision: 0 }), (error) => error.code === 'STALE_ROOM');
  await assert.rejects(room.setActivity('flying', { revision: 1 }), (error) => error.code === 'INVALID_ACTIVITY');
  await assert.rejects(room.setActivity('reading', { note: '字'.repeat(121), revision: 1 }), (error) => error.code === 'INVALID_ROOM');
});

test('背景图按内容寻址落盘，读回来是同一张；没人引用时才删', async (t) => {
  const { room, art } = await home(t);
  const next = await room.setBackground(dataUrl(PNG), 0);
  assert.match(next.art.background, /^[a-f0-9]{64}\.png$/);
  const files = await readdir(art);
  assert.deepEqual(files, [next.art.background]);
  const image = await room.readArt('background');
  assert.equal(image.mime, 'image/png');
  assert.equal(image.dataUrl, dataUrl(PNG));
  await room.clearBackground(next.revision);
  assert.deepEqual(await readdir(art), []);
});

test('同一张图既当背景又当角色图时，清背景不会把文件删掉', async (t) => {
  const { room, art } = await home(t);
  const withBackground = await room.setBackground(dataUrl(PNG), 0);
  const withCharacter = await room.setCharacter('idle', dataUrl(PNG), withBackground.revision);
  assert.equal(withCharacter.art.background, withCharacter.art.characters.idle);
  await room.clearBackground(withCharacter.revision);
  assert.deepEqual(await readdir(art), [withCharacter.art.characters.idle]);
});

test('换新背景时旧背景（已无人引用）会被清掉', async (t) => {
  const { room, art } = await home(t);
  const first = await room.setBackground(dataUrl(PNG), 0);
  const second = await room.setBackground(dataUrl(OTHER_PNG), first.revision);
  assert.notEqual(first.art.background, second.art.background);
  assert.deepEqual(await readdir(art), [second.art.background]);
});

test('角色图：传过用自己的、没传读内置 Q 版；清理后回到内置，不是破图', async (t) => {
  const { room } = await home(t);
  const builtin = await room.readArt('character', 'gaming');
  assert.equal(builtin.builtin, 'gaming');
  const set = await room.setCharacter('idle', dataUrl(PNG), 0);
  assert.deepEqual(await room.readArt('character', 'gaming'), await room.readArt('character', 'idle'));
  assert.equal(set.art.characters.gaming, undefined);
  await room.clearCharacter('idle', set.revision);
  const back = await room.readArt('character', 'gaming');
  assert.equal(back.builtin, 'gaming', '清掉自传图后回到内置 Q 版');
  assert.equal(await room.readArt('background'), null, '其他槽位没有内置');
});

test('不是真图片、超限、或者槽位不认识，都拒绝', async (t) => {
  const { room } = await home(t);
  await assert.rejects(room.setBackground('data:image/png;base64,AAAA', 0), (error) => error.code === 'INVALID_COVER');
  await assert.rejects(room.setCharacter('reading', 'not-an-image', 0), (error) => error.code === 'INVALID_COVER');
  await assert.rejects(room.readArt('sofa'), (error) => error.code === 'INVALID_ROOM');
});

test('房档损坏：原文件一个字不动，读是只读，写全拒', async (t) => {
  const { room, file } = await home(t);
  await mkdir(join(file, '..'), { recursive: true });
  const broken = '{"version":1,"revision":3,"room":';
  await writeFile(file, broken, 'utf8');
  const snapshot = await room.snapshot();
  assert.equal(snapshot.damaged, true);
  assert.equal(snapshot.revision, 0);
  assert.match(snapshot.warning, /损坏/);
  await assert.rejects(room.setActivity('reading', { revision: 0 }), (error) => error.code === 'DAMAGED_ROOM');
  assert.equal(await readFile(file, 'utf8'), broken);
});

test('恢复默认只清活动/备注/热点，已上传的图片保留', async (t) => {
  const { room, art } = await home(t);
  const withArt = await room.setBackground(dataUrl(PNG), 0);
  const withNote = await room.setNote('先这样', withArt.revision);
  const reset = await room.resetRoom(withNote.revision);
  assert.equal(reset.room.activity, 'idle');
  assert.equal(reset.room.note, '');
  assert.equal(reset.art.background, withArt.art.background);
  assert.deepEqual(await readdir(art), [withArt.art.background]);
});

test('热点：坐标越界与重复 ID 拒绝，合法的按三位小数存', async (t) => {
  const { room } = await home(t);
  await assert.rejects(room.saveHotspots([{ id: 'sofa', x: 2, y: 0.5 }], 0), (error) => error.code === 'INVALID_ROOM');
  await assert.rejects(room.saveHotspots([{ id: 'Sofa!', x: 0.5, y: 0.5 }], 0), (error) => error.code === 'INVALID_ROOM');
  const saved = await room.saveHotspots([{ id: 'sofa', x: 0.55555, y: 0.66111, label: '沙发' }], 0);
  assert.deepEqual(saved.art.hotspots, [{ id: 'sofa', x: 0.556, y: 0.661, label: '沙发' }]);
  await assert.rejects(room.saveHotspots(Array.from({ length: 13 }, (_, index) => ({ id: `spot-${index}`, x: 0.1, y: 0.1 })), saved.revision), (error) => error.code === 'LIMIT');
});

test('房间只写自己的目录，行程存档逐字节不变', async (t) => {
  const { dir, room } = await home(t);
  await mkdir(join(dir, 'fun'), { recursive: true });
  const stateFile = join(dir, 'fun', 'state.json');
  const original = JSON.stringify({ day: '2026-11-22', session: null, trips: [] });
  await writeFile(stateFile, original, 'utf8');
  await room.setActivity('reading', { note: '看书', revision: 0 });
  await room.setBackground(dataUrl(PNG), 1);
  assert.equal(await readFile(stateFile, 'utf8'), original);
  assert.deepEqual((await readdir(join(dir, 'fun'))).sort(), ['home', 'state.json']);
});

test('默认结构就是 blankRoom 的形状（给世界层兜底用）', async () => {
  assert.deepEqual(blankRoom(), {
    version: 2,
    revision: 0,
    room: { activity: 'idle', since: null, source: 'default', note: '', plan: '' },
    art: { background: '', characters: {}, hotspots: [], foreground: '', painting: '' },
    placements: {},
    updatedAt: null,
  });
  assert.ok(new HomeRoomError('X', 'y') instanceof Error);
});

test('时段默认：六段边界各归一个活动', () => {
  assert.equal(defaultActivityAt(0), 'sleeping');
  assert.equal(defaultActivityAt(7), 'sleeping');
  assert.equal(defaultActivityAt(8), 'looking_outside');
  assert.equal(defaultActivityAt(10), 'looking_outside');
  assert.equal(defaultActivityAt(11), 'cooking');
  assert.equal(defaultActivityAt(13), 'cooking');
  assert.equal(defaultActivityAt(14), 'reading');
  assert.equal(defaultActivityAt(17), 'reading');
  assert.equal(defaultActivityAt(18), 'gaming');
  assert.equal(defaultActivityAt(20), 'gaming');
  assert.equal(defaultActivityAt(21), 'watching');
  assert.equal(defaultActivityAt(23), 'watching');
  assert.equal(defaultActivityAt(24), 'sleeping');
});

test('room.source：新装是 default，点一下变 panel，恢复默认回 default 且活动回 idle', async (t) => {
  const { room, file } = await home(t);
  assert.equal((await room.snapshot()).room.source, 'default');
  const picked = await room.setActivity('reading', { revision: 0 });
  assert.equal(picked.room.source, 'panel');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).room.source, 'panel');
  const reset = await room.resetRoom(picked.revision);
  assert.equal(reset.room.source, 'default');
  assert.equal(reset.room.activity, 'idle');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).room.source, 'default');
  // 旧文件（P0 写的 panel）仍能读。
  const stored = JSON.parse(await readFile(file, 'utf8'));
  stored.room.source = 'panel';
  await writeFile(file, JSON.stringify(stored, null, 2), 'utf8');
  assert.equal((await room.snapshot()).room.source, 'panel');
});

test('时段色罩四段边界', () => {
  assert.equal(phaseAtHour(4), 'night');
  assert.equal(phaseAtHour(5), 'morning');
  assert.equal(phaseAtHour(10), 'morning');
  assert.equal(phaseAtHour(11), 'day');
  assert.equal(phaseAtHour(16), 'day');
  assert.equal(phaseAtHour(17), 'dusk');
  assert.equal(phaseAtHour(19), 'dusk');
  assert.equal(phaseAtHour(20), 'night');
  assert.equal(phaseAtHour(23), 'night');
});

test('v1 → v2：读是只读迁移，第一次写才落 v2，旧字段一个不丢', async (t) => {
  const { room, file } = await home(t);
  await mkdir(join(file, '..'), { recursive: true });
  const legacy = {
    version: 1,
    revision: 7,
    room: { activity: 'reading', since: 1763700000000, source: 'panel', note: '在沙发上翻一本旧书', plan: '想读半小时书' },
    art: { background: '', characters: {}, hotspots: [{ id: 'sofa', x: 0.556, y: 0.661, label: '沙发' }] },
    updatedAt: 1763700000000,
  };
  await writeFile(file, JSON.stringify(legacy, null, 2), 'utf8');
  const before = await room.snapshot();
  assert.equal(before.damaged, false);
  assert.equal(before.version, 2);
  assert.equal(before.room.activity, 'reading');
  assert.equal(before.room.plan, '想读半小时书');
  assert.deepEqual(before.placements, {}, '内存里补空 placements');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).version, 1, '只读不写盘');

  const written = await room.setNote('换个备注', 7);
  assert.equal(written.version, 2);
  const stored = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(stored.version, 2);
  assert.deepEqual(stored.placements, {});
  assert.equal(stored.art.foreground, '');
  assert.equal(stored.art.painting, '');
  assert.equal(stored.room.plan, '想读半小时书', '迁移不丢 plan');
  assert.deepEqual(stored.art.hotspots, legacy.art.hotspots, '迁移不丢热点');
  assert.equal((await room.snapshot()).room.note, '换个备注', '重开还在');
});

test('热点备注：存得下、能读回；不影响老热点形状', async (t) => {
  const { room } = await home(t);
  const saved = await room.saveHotspots([
    { id: 'sofa', x: 0.5, y: 0.6, label: '沙发' },
    { id: 'desk', x: 0.3, y: 0.5, label: '书桌', note: ' 桌上摊着一本没合的书 ' },
  ], 0);
  assert.deepEqual(saved.art.hotspots, [
    { id: 'sofa', x: 0.5, y: 0.6, label: '沙发' },
    { id: 'desk', x: 0.3, y: 0.5, label: '书桌', note: '桌上摊着一本没合的书' },
  ]);
});

test('位置微调：只存提交的活动，坐标/缩放越界拒绝；恢复默认清空', async (t) => {
  const { room, file } = await home(t);
  const saved = await room.savePlacements({ reading: { x: 0.41, y: 0.905, scale: 0.42 } }, 0);
  assert.deepEqual(saved.placements, { reading: { x: 0.41, y: 0.905, scale: 0.42 } });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).placements, { reading: { x: 0.41, y: 0.905, scale: 0.42 } });
  await assert.rejects(room.savePlacements({ flying: { x: 0.5, y: 0.5, scale: 0.5 } }, saved.revision), (error) => error.code === 'INVALID_ROOM');
  await assert.rejects(room.savePlacements({ reading: { x: 2, y: 0.5, scale: 0.5 } }, saved.revision), (error) => error.code === 'INVALID_ROOM');
  await assert.rejects(room.savePlacements({ reading: { x: 0.5, y: 0.5, scale: 9 } }, saved.revision), (error) => error.code === 'INVALID_ROOM');
  const reset = await room.resetRoom(saved.revision);
  assert.deepEqual(reset.placements, {});
});

test('前景层：按内容寻址落盘，readArt 取得到；恢复默认保留图片', async (t) => {
  const { room, art } = await home(t);
  const next = await room.setForeground(dataUrl(OTHER_PNG), 0);
  assert.match(next.art.foreground, /^[a-f0-9]{64}\.png$/);
  assert.deepEqual(await readdir(art), [next.art.foreground]);
  const image = await room.readArt('foreground');
  assert.equal(image.mime, 'image/png');
  const reset = await room.resetRoom(next.revision);
  assert.equal(reset.art.foreground, next.art.foreground, '图片不是状态，恢复默认不删');
});
