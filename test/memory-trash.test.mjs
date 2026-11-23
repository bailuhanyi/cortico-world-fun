import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { cleanup } from './tmp.mjs';

const AT = '2026-11-22T14:00:00+08:00';

async function boot(t) {
  const dir = await mkdtemp(join(process.env.TEMP || process.cwd(), 'fun-trash-'));
  cleanup(t, dir);
  const world = new FunWorld({ dataDir: dir, cfg: { enabled: true }, timezone: 'Asia/Shanghai', now: () => Date.parse(AT), random: () => 0 });
  await world.start({ log: { info() {}, warn() {} } });
  const invoke = (panel, method, args = []) => world.webUi().invoke(panel, method, args);
  const rpc = (method, payload = {}) => invoke('story', method, [payload]);
  return { world, invoke, rpc };
}

/** 玩一趟最短的故事并回家，留下一条回忆。 */
async function playOne(b) {
  const saved = await b.invoke('places', 'save', [{ name: '自己的书屋', areas: ['窗边', '门口'], hours: { open: '00:00', close: '23:59' }, randomEvents: [] }]);
  assert.equal(saved.ok, true, saved.error);
  const venue = (await b.invoke('places', 'list')).places.find((place) => place.name === '自己的书屋');
  const pack = {
    version: 1, id: 'window-page', title: '窗边的一页', placeId: venue.id, start: 'start', nodes: [
      { id: 'start', area: '窗边', event: '窗边有一页翻开的书', prompt: '停一会儿还是去门口？', choices: [
        { id: 'stay', label: '停一会儿', result: '决定在窗边停一会儿', next: 'end-a' },
        { id: 'walk', label: '去门口', result: '决定去门口看看', next: 'end-b' }] },
      { id: 'end-a', area: '窗边', event: '又看了一会儿窗边的书页' },
      { id: 'end-b', area: '门口', event: '从窗边走到门口，回头看了一眼书屋' },
    ],
  };
  const imported = await b.invoke('stories', 'import', [{ json: JSON.stringify(pack) }]);
  assert.equal(imported.ok, true, imported.error);
  const status = await b.rpc('status');
  const card = status.catalog.find((row) => row.id === 'window-page');
  let s = await b.rpc('start', { startStamp: status.startStamp, packId: card.id, revision: card.revision });
  assert.equal(s.ok, true, s.error);
  s = await b.rpc('move', { tripId: s.trip.id, stamp: s.trip.stamp });
  s = await b.rpc('choose', { tripId: s.trip.id, stamp: s.trip.stamp, choiceId: s.trip.pending.id, optionId: 'walk' });
  s = await b.rpc('close', { tripId: s.trip.id, stamp: s.trip.stamp });
  assert.equal(s.ok, true, s.error);
  return s;
}

test('删除回忆先进回收站，能恢复，也能彻底删除', async (t) => {
  const b = await boot(t);
  let status = await playOne(b);
  assert.equal(status.memories.length, 1);
  assert.equal(status.trash.length, 0);
  const memory = status.memories[0];

  status = await b.rpc('deleteMemory', { memoryId: memory.id });
  assert.equal(status.ok, true);
  assert.equal(status.memories.length, 0);
  assert.equal(status.trash.length, 1);
  assert.equal(status.trash[0].tripId, memory.id);
  assert.match(status.trash[0].title, /窗边的一页/);
  const onDisk = JSON.parse(await readFile(b.world.stateFile(), 'utf8'));
  assert.equal(onDisk.trash.length, 1);
  assert.equal(onDisk.trips.length, 0);

  status = await b.rpc('restoreMemory', { trashId: status.trash[0].id });
  assert.equal(status.ok, true);
  assert.equal(status.memories.length, 1);
  assert.equal(status.trash.length, 0);

  status = await b.rpc('deleteMemory', { memoryId: memory.id });
  const trashId = status.trash[0].id;
  status = await b.rpc('purgeMemory', { trashId });
  assert.equal(status.trash.length, 0);
  assert.equal(status.memories.length, 0);
});

test('回收站：重复删除、清空和过期条目的处理', async (t) => {
  const b = await boot(t);
  let status = await playOne(b);
  const memory = status.memories[0];
  status = await b.rpc('deleteMemory', { memoryId: memory.id });
  const again = await b.rpc('deleteMemory', { memoryId: memory.id });
  assert.equal(again.ok, false);
  assert.match(again.error, /回收站/);
  const missing = await b.rpc('purgeMemory', { trashId: 'trash-nope' });
  assert.equal(missing.ok, false);
  status = await b.rpc('emptyTrash');
  assert.equal(status.ok, true);
  assert.equal(status.trash.length, 0);
  assert.equal(status.memories.length, 0);
  const empty = await b.rpc('restoreMemory', { trashId: 'trash-nope' });
  assert.equal(empty.ok, false);
});

test('回收站条目重启后仍在，恢复回纪念册', async (t) => {
  const b = await boot(t);
  let status = await playOne(b);
  const memory = status.memories[0];
  status = await b.rpc('deleteMemory', { memoryId: memory.id });
  const trashId = status.trash[0].id;
  const again = new FunWorld({ dataDir: b.world.dataDir, cfg: { enabled: true }, timezone: 'Asia/Shanghai', now: () => Date.parse(AT), random: () => 0 });
  await again.start({ log: { info() {}, warn() {} } });
  const restarted = await again.webUi().invoke('story', 'status');
  assert.equal(restarted.trash.length, 1);
  const restored = await again.webUi().invoke('story', 'restoreMemory', [{ trashId }]);
  assert.equal(restored.ok, true);
  assert.equal(restored.memories.length, 1);
  assert.equal(restored.memories[0].id, memory.id);
  assert.equal(restored.trash.length, 0);
});
