import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { PlaceLibrary } from '../src/place-library.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const venue = { id: 'creek', name: 'Creek', desc: 'Authoritative text', kind: 'park',
  aliases: ['Stream'], tags: ['Outdoors'], areas: ['Path'], hours: { open: '06:00', close: '22:00' } };
const bundle = (places, homeId = '', covers = {}) => ({ format: 'little-world', version: 1, state: { version: 1, places, homeId }, covers });
const mapping = (sourceId, action, targetId, policy) => ({ sourceId, action,
  ...(targetId === undefined ? {} : { targetId }), ...(policy === undefined ? {} : { policy }) });
const error = (code) => ({ code });

/**
 * The World owns venues.json. These tests use an in-memory stand-in that behaves
 * like that writer: patches merge into the stored venue, and only areas decide
 * whether a place is playable.
 */
function venueStore(initial) {
  const rows = structuredClone(initial);
  let next = 0;
  return {
    read: () => structuredClone(rows),
    /** 测试里直接改权威地点表（模拟宿主升级/别处改名）。 */
    all: () => rows,
    saveVenue(raw) {
      const id = raw.id ?? `user-test-${next += 1}`;
      const at = rows.findIndex((row) => row.id === id);
      const existing = at >= 0 ? rows[at] : {
        id, kind: 'custom', playable: false, aliases: [], tags: [], areas: [], souvenirs: [],
        photoSpots: [], randomEvents: [], scene: '', desc: '',
        hours: { open: '00:00', close: '23:59' },
      };
      const nextRow = { ...existing, ...raw, id };
      if (Object.hasOwn(raw, 'areas') && !Object.hasOwn(raw, 'playable')) nextRow.playable = raw.areas.length > 0;
      nextRow.name = String(nextRow.name ?? '').trim();
      if (!nextRow.name) return { ok: false, error: '名字不能空' };
      if (at >= 0) rows[at] = nextRow;
      else rows.push(nextRow);
      return { ok: true, venue: structuredClone(nextRow) };
    },
    removeVenue(id) {
      const at = rows.findIndex((row) => row.id === id);
      if (at < 0) return { ok: false, error: '没找到' };
      rows.splice(at, 1);
      return { ok: true };
    },
  };
}

async function setup(t, initial = [venue]) {
  const root = await mkdtemp(join(tmpdir(), 'fun-place-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = venueStore(initial);
  const library = () => new PlaceLibrary({ userDataDir: root, venues: store.read,
    saveVenue: (raw) => store.saveVenue(raw), removeVenue: (id) => store.removeVenue(id) });
  return { root, library, lib: library(), store, dir: join(root, 'fun', 'place-library') };
}

test('projects live playable authority, writes venues through the host, and leaves existing files alone', async (t) => {
  const { lib, library, root, store } = await setup(t);
  await mkdir(join(root, 'fun'));
  const existing = ['state.json', 'stories.json', 'venues.json'];
  for (const file of existing) await writeFile(join(root, 'fun', file), file);
  assert.deepEqual((await lib.snapshot()).places.map(({ id, playable }) => ({ id, playable })), [{ id: 'creek', playable: true }]);
  // 场所字段是 venues 的权威：地点库只能改画风/关联/封面。
  await assert.rejects(lib.update('creek', { name: 'Wrong authority' }), error('INVALID_INPUT'));
  await assert.rejects(lib.remove('creek'), error('PLAYABLE_PLACE'));
  await lib.setDefaultStyle('Watercolor');
  const created = await lib.create({ name: 'Home', kind: 'home', desc: 'Window', aliases: ['Room'], tags: ['Reading'] });
  const home = await lib.get(created.id);
  assert.equal(home.playable, false);
  assert.equal(home.styleSource, 'default');
  assert.equal(home.kind, 'home', 'create 要保留场所分类');
  assert.ok(store.read().some((row) => row.id === created.id), '场所写进了 venues 表');
  assert.ok((await lib.snapshot()).revision > 0, '加地点也算一次快照变化');
  await lib.setHome(home.id);
  await lib.update('creek', { style: 'Sketch', relations: [{ placeId: home.id, note: 'A favorite place to sketch' }] });
  assert.equal((await library().get('creek')).styleSource, 'place');
  assert.equal((await library().get(home.id)).effectiveStyle, 'Watercolor');
  const changed = await lib.updateVenue(home.id, { name: 'New Home' });
  assert.equal(changed.id, home.id);
  assert.equal((await lib.get(home.id)).name, 'New Home');
  assert.equal((await lib.list({ query: 'reading', playable: false }))[0].id, home.id);
  assert.equal((await lib.getHome()).id, home.id);
  await assert.rejects(lib.update(home.id, { relations: [{ placeId: 'absent', note: 'Mentioned' }] }), error('NOT_FOUND'));
  await assert.rejects(lib.update(home.id, { relations: [{ placeId: 'creek', note: 'Turn north' }] }), error('INVALID_INPUT'));
  await lib.remove(home.id);
  assert.equal(await lib.getHome(), null);
  assert.deepEqual((await lib.get('creek')).relations, []);
  assert.ok(!store.read().some((row) => row.id === home.id), '删地点也要删 venues 里的那一行');
  for (const file of existing) assert.equal(await readFile(join(root, 'fun', file), 'utf8'), file);
});

test('local-only image upload, focus, original read, and retained immutable covers', async (t) => {
  const { lib, dir } = await setup(t);
  await assert.rejects(lib.update('creek', { coverFocus: { x: 5, y: 5 } }), error('INVALID_INPUT'));
  await assert.rejects(lib.setCover('creek', { dataUrl: 'https://example.invalid/f.png' }), error('INVALID_COVER'));
  await assert.rejects(lib.setCover('creek', { dataUrl: png.replace('image/png', 'image/gif') }), error('INVALID_COVER'));
  await assert.rejects(lib.setCover('creek', { dataUrl: png, coverFocus: { x: -3, y: 0 } }), error('INVALID_INPUT'));
  const uploaded = await lib.setCover('creek', { dataUrl: png, coverFocus: { x: 29, y: 61 } });
  assert.deepEqual(uploaded.coverFocus, { x: 29, y: 61 });
  assert.equal((await lib.readCover('creek')).dataUrl, png);
  await lib.clearCover('creek');
  assert.equal(await lib.readCover('creek'), null);
  assert.deepEqual(await readdir(join(dir, 'covers')), [uploaded.cover]);
});

test('reads the actual little-world export format, previews results, and restores after restart', async (t) => {
  const { lib, library, store } = await setup(t);
  const previous = await lib.create({ name: 'Previous home' });
  await lib.setHome(previous.id);
  await lib.setDefaultStyle('Local default');
  const exported = bundle([
    { id: 'old-home', name: 'Old Home', kind: 'home', cover: 'home.png', coverFocus: { x: 28, y: 40 }, relations: [{ placeId: 'creek', note: 'Shared story' }] },
    { id: 'creek', name: 'Creek', desc: 'Old map text', funVenue: 'Creek', tags: ['Imported'] },
  ].map((row) => ({ aliases: [], tags: [], kind: 'around', desc: '', style: '', cover: '', scene: '',
    funVenue: '', frequent: false, terrain: 'forest', relations: [], modifiedAt: 0, ...row })), 'old-home', { 'home.png': png });
  Object.assign(exported.state, { terrain: 'forest', updatedAt: 0 });
  const before = await lib.snapshot();
  const mappings = [mapping('old-home', 'new'), mapping('creek', 'bind', 'creek', 'overwrite')];
  const view = await lib.previewImport(JSON.stringify(exported), { sourceId: 'Older map', defaultStyle: 'Old default', mappings, useImportedHome: true });
  assert.equal(view.format, 'little-world');
  assert.equal(view.coverCount, 1);
  assert.equal(view.sourceHomeId, 'old-home');
  assert.equal(view.homeId, previous.id);
  assert.deepEqual(view.items[1].conflicts.map((item) => item.type), ['id', 'name']);
  assert.equal(view.items[1].legacyFunVenue, 'Creek');
  assert.equal(view.items[0].styleSource, 'source-default');
  assert.equal(view.proposed.changes[1].fields.find((field) => field.field === 'desc').result, venue.desc);
  assert.deepEqual(await lib.snapshot(), before, 'preview 不许写盘');
  await assert.rejects(lib.commitImport({ previewId: view.previewId, mappings, useImportedHome: false }), error('PLAN_MISMATCH'));
  assert.deepEqual(await lib.snapshot(), before);
  const result = await lib.commitImport({ previewId: view.previewId, mappings, useImportedHome: true });
  const current = await library().snapshot();
  assert.equal(current.defaultStyle, 'Local default');
  assert.equal(current.homeId, result.homeId);
  assert.equal(current.recoveryId, result.recoveryId);
  const imported = await lib.get(result.homeId);
  assert.equal(imported.name, 'Old Home');
  assert.deepEqual(imported.coverFocus, { x: 28, y: 40 });
  assert.equal(imported.style, 'Old default');
  assert.deepEqual(imported.relations, [{ placeId: 'creek', note: 'Shared story' }]);
  assert.equal((await lib.readCover(imported.id)).dataUrl, png);
  assert.equal((await lib.get('creek')).desc, venue.desc);
  assert.equal((await lib.get('creek')).style, 'Old default');
  assert.deepEqual((await lib.get('creek')).tags, venue.tags);
  assert.ok(store.read().some((row) => row.id === result.homeId), '导入的新地点写进 venues 表');
  const restored = await library().restoreImport(result.recoveryId);
  assert.deepEqual(restored.places, before.places);
  assert.equal(restored.homeId, previous.id);
  assert.ok(!store.read().some((row) => row.id === result.homeId), '恢复点要把导入新建的地点也退回去');
  await assert.rejects(lib.restoreImport(result.recoveryId), error('RECOVERY_CONFLICT'));
});

test('requires explicit mapping; reports invalid and missing covers without reading any path', async (t) => {
  const { lib } = await setup(t);
  const pack = bundle([
    { id: 'creek', name: 'Creek', funVenue: 'Creek', cover: '../secret.png', relations: [{ placeId: 'absent', note: 'Missing' }] },
    { id: 'absent-cover', name: 'Missing image', cover: 'missing.png' },
    { id: 'bad-cover', name: 'Bad image', cover: 'bad.png' },
  ], 'absent', { 'bad.png': 'data:image/svg+xml;base64,PHN2Zz4=' });
  await assert.rejects(lib.previewImport(pack, { sourceId: '' }), error('INVALID_SOURCE'));
  await assert.rejects(lib.previewImport({ ...pack, version: 2 }, { sourceId: 'A' }), error('INVALID_EXPORT'));
  const view = await lib.previewImport(pack, { sourceId: 'A' });
  assert.deepEqual(view.items.map((item) => item.coverStatus), ['invalid', 'missing', 'invalid']);
  assert.deepEqual(view.items[0].missingRelations, [{ placeId: 'absent', note: 'Missing' }]);
  assert.equal(view.items[0].recommendedAction, 'skip');
  assert.equal(view.coverCount, 0);
  assert.equal(view.sourceHomeId, null);
  await assert.rejects(lib.commitImport({ previewId: view.previewId, mappings: [] }), error('INVALID_MAPPING'));
  const result = await lib.commitImport({ previewId: view.previewId,
    mappings: [mapping('creek', 'new'), mapping('absent-cover', 'skip'), mapping('bad-cover', 'skip')] });
  assert.notEqual(result.mappings[0].targetId, 'creek');
  assert.equal((await lib.get('creek')).playable, true);
  assert.equal((await lib.get(result.mappings[0].targetId)).name, 'Creek');
  assert.deepEqual((await lib.get(result.mappings[0].targetId)).relations, []);
});

test('handles duplicate imports by explicit source identity and refuses stale recovery and previews', async (t) => {
  const { lib, store } = await setup(t);
  const pack = bundle([{ id: 'same', name: 'First' }]);
  const attach = async (sourceId) => {
    const view = await lib.previewImport(pack, { sourceId });
    return lib.commitImport({ previewId: view.previewId, mappings: [mapping('same', 'new')] });
  };
  const a = await attach('source A');
  const b = await attach('source B');
  assert.notEqual(a.mappings[0].targetId, b.mappings[0].targetId);
  await assert.rejects(lib.restoreImport(a.recoveryId), error('RECOVERY_CONFLICT'));
  const replay = await attach('source A');
  assert.equal(replay.mappings[0].targetId, a.mappings[0].targetId);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.revision, b.revision);
  await lib.updateVenue(b.mappings[0].targetId, { desc: 'Later edit' });
  await assert.rejects(lib.restoreImport(b.recoveryId), error('RECOVERY_CONFLICT'));
  const stale = await lib.previewImport(pack, { sourceId: 'source C' });
  await lib.setDefaultStyle('Newer value');
  await assert.rejects(lib.commitImport({ previewId: stale.previewId, mappings: [mapping('same', 'new')] }), error('STALE_PREVIEW'));
  const staleVenue = await lib.previewImport(pack, { sourceId: 'source C' });
  store.all().find((row) => row.id === 'creek').name = 'Renamed elsewhere';
  await assert.rejects(lib.commitImport({ previewId: staleVenue.previewId, mappings: [mapping('same', 'new')] }), error('STALE_PREVIEW'));
});

test('replays the same binding policy but applies a newly confirmed overwrite policy', async (t) => {
  const { lib } = await setup(t);
  const target = await lib.create({ name: 'Local place', desc: 'Local description' });
  const pack = bundle([{ id: 'source-place', name: 'Imported place', desc: 'Imported description' }]);
  const preview = (policy) => lib.previewImport(pack, { sourceId: 'policy source',
    mappings: [mapping('source-place', 'bind', target.id, policy)] });
  const commit = (view, policy) => lib.commitImport({ previewId: view.previewId,
    mappings: [mapping('source-place', 'bind', target.id, policy)] }, { requireReview: true });

  await commit(await preview('keep'), 'keep');
  assert.equal((await lib.get(target.id)).desc, 'Local description');
  await lib.updateVenue(target.id, { desc: 'Edited after keep' });
  const beforeKeepReplay = await lib.snapshot();
  const keepReplay = await commit(await preview('keep'), 'keep');
  assert.equal(keepReplay.duplicate, true);
  assert.equal(keepReplay.revision, beforeKeepReplay.revision);
  assert.equal((await lib.get(target.id)).desc, 'Edited after keep');

  const overwrite = await preview('overwrite');
  assert.equal(overwrite.proposed.duplicate, false);
  assert.equal(overwrite.proposed.changes[0].fields.find(({ field }) => field === 'desc').result, 'Imported description');
  const applied = await commit(overwrite, 'overwrite');
  assert.equal(applied.duplicate, false);
  assert.equal((await lib.get(target.id)).desc, 'Imported description');

  await lib.updateVenue(target.id, { desc: 'Edited after overwrite' });
  const beforeOverwriteReplay = await lib.snapshot();
  const overwriteReplay = await commit(await preview('overwrite'), 'overwrite');
  assert.equal(overwriteReplay.duplicate, true);
  assert.equal(overwriteReplay.revision, beforeOverwriteReplay.revision);
  assert.equal((await lib.get(target.id)).desc, 'Edited after overwrite');
  await assert.rejects(lib.restoreImport(applied.recoveryId), error('RECOVERY_CONFLICT'));
});

test('a newly mapped relation is applied on reviewed reimport without replaying later edits', async (t) => {
  const { lib } = await setup(t);
  const target = await lib.create({ name: 'Local place' });
  const pack = bundle([
    { id: 'source-place', name: 'Imported place', relations: [{ placeId: 'related-place', note: 'A shared memory' }] },
    { id: 'related-place', name: 'Related place' },
  ]);
  const importWith = async (action) => {
    const mappings = [mapping('source-place', 'bind', target.id, 'overwrite'), mapping('related-place', action)];
    const view = await lib.previewImport(pack, { sourceId: 'relation source', mappings });
    const committed = await lib.commitImport({ previewId: view.previewId, mappings }, { requireReview: true });
    return { view, committed };
  };
  await importWith('skip');
  assert.deepEqual((await lib.get(target.id)).relations, []);
  const applied = await importWith('new');
  const relatedId = applied.committed.mappings.find(({ sourceId }) => sourceId === 'related-place').targetId;
  assert.deepEqual(applied.view.proposed.changes[0].fields.find(({ field }) => field === 'relations').result,
    [{ placeId: relatedId, note: 'A shared memory' }]);
  assert.deepEqual((await lib.get(target.id)).relations, [{ placeId: relatedId, note: 'A shared memory' }]);
  await lib.update(target.id, { relations: [{ placeId: relatedId, note: 'Edited after reimport' }] });
  const replay = await importWith('new');
  assert.equal(replay.committed.duplicate, true);
  assert.deepEqual((await lib.get(target.id)).relations, [{ placeId: relatedId, note: 'Edited after reimport' }]);
});

test('legacy import receipts retain keep replay protection and permit explicit overwrite review', async (t) => {
  const { lib, dir, library } = await setup(t);
  const target = await lib.create({ name: 'Local place', desc: 'Local description' });
  const pack = bundle([{ id: 'source-place', name: 'Imported place', desc: 'Imported description' }]);
  const mappings = [mapping('source-place', 'bind', target.id, 'keep')];
  const first = await lib.previewImport(pack, { sourceId: 'legacy source', mappings });
  await lib.commitImport({ previewId: first.previewId, mappings }, { requireReview: true });
  const file = join(dir, 'library.json');
  const legacy = JSON.parse(await readFile(file, 'utf8'));
  for (const receipt of legacy.data.sources) receipt.applied = receipt.signature;
  await writeFile(file, JSON.stringify(legacy), 'utf8');

  const restarted = library();
  const repeated = await restarted.previewImport(pack, { sourceId: 'legacy source', mappings });
  const replay = await restarted.commitImport({ previewId: repeated.previewId, mappings }, { requireReview: true });
  assert.equal(replay.duplicate, true);
  assert.equal((await restarted.get(target.id)).desc, 'Local description');
  const overwriteMappings = [mapping('source-place', 'bind', target.id, 'overwrite')];
  const overwrite = await restarted.previewImport(pack, { sourceId: 'legacy source', mappings: overwriteMappings });
  assert.equal(overwrite.proposed.changes[0].fields.find(({ field }) => field === 'desc').result, 'Imported description');
  await restarted.commitImport({ previewId: overwrite.previewId, mappings: overwriteMappings }, { requireReview: true });
  assert.equal((await library().get(target.id)).desc, 'Imported description');
});

test('does not overwrite corrupt state or publish a partial import on storage failure', async (t) => {
  const { lib, dir, store } = await setup(t);
  const pack = bundle([{ id: 'new', name: 'New', cover: 'file.png' }], '', { 'file.png': png });
  const before = await lib.previewImport(pack, { sourceId: 'test source' });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'covers'), 'blocked');
  await assert.rejects(lib.commitImport({ previewId: before.previewId, mappings: [mapping('new', 'new')] }));
  assert.deepEqual((await lib.snapshot()).places.map((row) => row.id), ['creek']);
  assert.equal((await lib.snapshot()).recoveryId, null);
  assert.ok(!store.read().some((row) => row.name === 'New'), '失败的导入不许留下半个场所');
  await writeFile(join(dir, 'library.json'), 'invalid-json');
  await assert.rejects(lib.create({ name: 'Uncommitted place' }), error('DAMAGED_LIBRARY'));
  assert.equal(await readFile(join(dir, 'library.json'), 'utf8'), 'invalid-json');
});

test('takeLegacyPlaces + adoptExtras：旧地点库搬进 venues，保留原 id、画风与关联', async (t) => {
  const legacyId = 'place-11111111-1111-4111-8111-111111111111';
  const otherId = 'place-22222222-2222-4222-8222-222222222222';
  const { lib, dir, store } = await setup(t);
  await mkdir(dir, { recursive: true });
  const legacy = {
    version: 1, revision: 0,
    data: {
      places: [
        { id: legacyId, name: '旧书店', desc: '巷子深处', kind: 'around', aliases: ['书店'], tags: ['室内'],
          style: '水彩', scene: '', relations: [], cover: '', coverFocus: null },
        { id: otherId, name: '旧码头', desc: '河边', kind: 'place', aliases: [], tags: [],
          style: '', scene: '码头', relations: [{ placeId: legacyId, note: '常去' }], cover: '', coverFocus: null },
      ],
      extras: [], sources: [], homeId: legacyId, defaultStyle: '',
    }, recovery: null,
  };
  await writeFile(join(dir, 'library.json'), JSON.stringify(legacy));

  const taken = await lib.takeLegacyPlaces();
  assert.deepEqual(taken.places.map((row) => row.id), [legacyId, otherId]);
  assert.ok(taken.backup, '迁移前要留 library.json 备份');
  assert.ok((await readFile(taken.backup, 'utf8')).includes('旧书店'));
  const cleared = JSON.parse(await readFile(join(dir, 'library.json'), 'utf8'));
  assert.deepEqual(cleared.data.places, []);
  assert.equal(cleared.data.homeId, legacyId, 'homeId 不动');
  assert.deepEqual((await lib.takeLegacyPlaces()).places, [], '第二次没有可迁移的了');

  // World 会先把这些场所写进 venues.json，再让地点库搬画风/关联/封面。
  for (const row of taken.places) {
    store.saveVenue({ id: row.id, name: row.name, desc: row.desc, kind: row.kind, playable: false,
      aliases: row.aliases, tags: row.tags, scene: row.scene, hours: { open: '00:00', close: '23:59' } });
  }
  const adopted = await lib.adoptExtras(legacyId, taken.places[0]);
  assert.equal(adopted.adopted, true);
  await lib.adoptExtras(otherId, taken.places[1]);
  const snapshot = await lib.snapshot();
  const bookshop = snapshot.places.find((row) => row.id === legacyId);
  assert.equal(bookshop.playable, false, '旧地点库里的地点是地图上一个点');
  assert.equal(bookshop.style, '水彩');
  assert.equal(bookshop.isHome, true);
  assert.deepEqual(snapshot.places.find((row) => row.id === otherId).relations, [{ placeId: legacyId, note: '常去' }]);
});
