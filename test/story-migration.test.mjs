import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoryLibrary, ADDITIONAL_STORY_IDS, ADDITIONAL_STORY_MIGRATION, PROMOTED_STORY_IDS, PROMOTED_STORY_MIGRATION, RETIRED_STORY_IDS, STORY_PRESET_MIGRATION, migratePromotedStoryCopies, migrateStoryPresets } from '../src/story-library.js';
import { BUILTIN_STORY_PACKS, SAMPLE_STORY, storyFixtureJson } from './fixtures/story-presets.mjs';
import { BUILTIN_STORY_PACKS as SHIPPED_STORY_PACKS } from '../src/story-examples.js';
import { cleanup } from './tmp.mjs';

const plain = (pack) => JSON.parse(storyFixtureJson(pack));
const minimal = (id, title = id) => ({ ...plain(BUILTIN_STORY_PACKS[0]), id, title });
const makeRaw = () => ({ version: 1,
  packs: [...RETIRED_STORY_IDS.map((id) => minimal(id)), minimal('my-original-story'), minimal('not-a-retired-id', '作者新作品')],
  disabledIds: [...RETIRED_STORY_IDS, 'my-original-story'],
  authorExtension: { preserve: ['unknown fields', 17] },
});

test('migration removes exactly five fixed IDs, preserves the original backup and unrelated fields', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-r4-migration-'));
  cleanup(t, dir);
  const file = join(dir, 'stories.json');
  const raw = makeRaw();
  const source = JSON.stringify(raw, null, 2) + '\n';
  await writeFile(file, source, 'utf8');
  const migrated = await migrateStoryPresets(file, raw, source);
  assert.deepEqual(migrated.raw.packs.map(({ id }) => id), ['my-original-story', 'not-a-retired-id']);
  assert.deepEqual(migrated.raw.disabledIds, ['my-original-story']);
  assert.deepEqual(migrated.raw.authorExtension, raw.authorExtension);
  assert.equal(migrated.raw.migrations[STORY_PRESET_MIGRATION], true);
  assert.equal(await readFile(migrated.backupFile, 'utf8'), source);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), migrated.raw);
  assert.equal((await readdir(dir)).filter((name) => name.endsWith('.bak')).length, 1);
});

test('completed migration never removes a later user story reusing a retired ID', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-r4-once-'));
  cleanup(t, dir);
  const file = join(dir, 'stories.json');
  const raw = { version: 1, packs: [minimal('my-original-story')], disabledIds: [], migrations: { [STORY_PRESET_MIGRATION]: true } };
  const source = JSON.stringify(raw, null, 2);
  await writeFile(file, source, 'utf8');
  const userPack = minimal(RETIRED_STORY_IDS[0], '后来创作的同 ID 故事');
  const next = { ...raw, packs: [userPack] };
  const nextSource = JSON.stringify(next, null, 2);
  await writeFile(file, nextSource, 'utf8');
  const result = await migrateStoryPresets(file, next, nextSource);
  assert.equal(result.backupFile, null);
  assert.equal(result.raw.packs[0].title, '后来创作的同 ID 故事');
  assert.equal(await readFile(file, 'utf8'), nextSource);
  assert.deepEqual((await readdir(dir)).filter((name) => name.endsWith('.bak')), []);
});

test('backup failure leaves source byte-for-byte intact and blocks StoryLibrary writes', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-r4-fail-'));
  cleanup(t, dir);
  const file = join(dir, 'stories.json');
  const source = JSON.stringify(makeRaw(), null, 2);
  await writeFile(file, source, 'utf8');
  const raw = JSON.parse(source);
  await assert.rejects(migrateStoryPresets(file, raw, source, {
    writeFile: async () => { throw new Error('simulated backup failure'); },
    rename: async () => { throw new Error('must not rename'); },
  }));
  const library = new StoryLibrary({ file, venues: () => [], migrationIo: {
    writeFile: async () => { throw new Error('simulated backup failure'); },
    rename: async () => { throw new Error('must not rename'); },
  } });
  await library.load();
  const listing = library.list();
  assert.equal(listing.migration.complete, false);
  assert.match(listing.migration.error, /备份或写入失败/);
  assert.ok(listing.warnings.some((warning) => warning === listing.migration.error));
  assert.deepEqual(listing.packs.filter(({ builtin }) => !builtin).map(({ id }) => id), [...RETIRED_STORY_IDS, 'my-original-story', 'not-a-retired-id']);
  await assert.rejects(library.save({ ...library.data, packs: [] }), /备份或写入失败/);
  assert.equal(await readFile(file, 'utf8'), source);
  assert.deepEqual((await readdir(dir)).filter((name) => name.endsWith('.bak')), []);
});

test('replacement failure retains the exact backup and original without leaving a migration temp file', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-r4-rename-fail-'));
  cleanup(t, dir);
  const file = join(dir, 'stories.json');
  const raw = makeRaw();
  const source = JSON.stringify(raw) + '\r\n';
  await writeFile(file, source);
  await assert.rejects(migrateStoryPresets(file, raw, source, { writeFile, rename: async () => { throw new Error('simulated rename failure'); } }));
  assert.equal(await readFile(file, 'utf8'), source);
  const files = await readdir(dir);
  assert.equal(files.some((name) => name.endsWith('.tmp')), false);
  const backup = files.find((name) => name.endsWith('.bak'));
  assert.equal(await readFile(join(dir, backup), 'utf8'), source);
});

test('new built-in promotion backs up and removes only exact copies of the two newly added stories', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-new-builtins-'));
  cleanup(t, dir);
  const file = join(dir, 'stories.json');
  const withoutRevision = (pack) => { const copy = structuredClone(pack); delete copy.revision; return copy; };
  const bridge = withoutRevision(SHIPPED_STORY_PACKS.find(({ id }) => id === ADDITIONAL_STORY_IDS[0]));
  const changedPlaque = withoutRevision(SHIPPED_STORY_PACKS.find(({ id }) => id === ADDITIONAL_STORY_IDS[1]));
  changedPlaque.description += '（用户已作个人修改）';
  const raw = { version: 1, packs: [bridge, changedPlaque], disabledIds: [...ADDITIONAL_STORY_IDS],
    migrations: { [STORY_PRESET_MIGRATION]: true, [PROMOTED_STORY_MIGRATION]: true } };
  const source = JSON.stringify(raw, null, 2) + '\n';
  await writeFile(file, source, 'utf8');

  const migrated = await migratePromotedStoryCopies(file, raw, source, undefined,
    { migrationKey: ADDITIONAL_STORY_MIGRATION, storyIds: ADDITIONAL_STORY_IDS });
  assert.deepEqual(migrated.removedIds, [ADDITIONAL_STORY_IDS[0]]);
  assert.deepEqual(migrated.raw.packs, [changedPlaque]);
  assert.deepEqual(migrated.raw.disabledIds, [...ADDITIONAL_STORY_IDS], 'preserve story enable/disable choices');
  assert.equal(migrated.raw.migrations[ADDITIONAL_STORY_MIGRATION], true);
  assert.equal(await readFile(migrated.backupFile, 'utf8'), source);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), migrated.raw);
  const repeated = await migratePromotedStoryCopies(file, migrated.raw, JSON.stringify(migrated.raw), undefined,
    { migrationKey: ADDITIONAL_STORY_MIGRATION, storyIds: ADDITIONAL_STORY_IDS });
  assert.equal(repeated.backupFile, null, 'migration is one-time');
});

test('StoryLibrary upgrade after the 0.3.3 migration also promotes the two newly built-in stories', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fun-new-builtins-upgrade-'));
  cleanup(t, dir);
  const file = join(dir, 'stories.json');
  const withoutRevision = (pack) => { const copy = structuredClone(pack); delete copy.revision; return copy; };
  const bridge = withoutRevision(SHIPPED_STORY_PACKS.find(({ id }) => id === ADDITIONAL_STORY_IDS[0]));
  const plaque = withoutRevision(SHIPPED_STORY_PACKS.find(({ id }) => id === ADDITIONAL_STORY_IDS[1]));
  const raw = { version: 1, packs: [bridge, plaque, minimal('user-work', '用户自己的故事')], disabledIds: [],
    migrations: { [STORY_PRESET_MIGRATION]: true, [PROMOTED_STORY_MIGRATION]: true } };
  await writeFile(file, JSON.stringify(raw, null, 2), 'utf8');
  const library = new StoryLibrary({ file, venues: () => [] });
  await library.load();
  assert.equal(library.migration.complete, true);
  assert.equal(library.migration.backupFiles.length, 1);
  assert.deepEqual(library.data.packs.map(({ id }) => id), ['user-work']);
  assert.deepEqual(library.data.migrations, { ...raw.migrations, [ADDITIONAL_STORY_MIGRATION]: true });
  assert.equal(await readFile(library.migration.backupFile, 'utf8'), JSON.stringify(raw, null, 2));
  assert.ok(library.list().packs.some(({ id, builtin }) => id === ADDITIONAL_STORY_IDS[0] && builtin));
  assert.ok(library.list().packs.some(({ id, builtin }) => id === ADDITIONAL_STORY_IDS[1] && builtin));
});

test('new installations ship the four approved built-in stories and no retired sample', () => {
  assert.deepEqual(SHIPPED_STORY_PACKS.filter(({ version }) => version < 3).map((pack) => pack.id), [
    'foldtide-reply-lite', 'drizzled-list', 'bridge-echo-solo', 'swapped-plaque-riddle',
  ]);
  assert.deepEqual([...PROMOTED_STORY_IDS], ['foldtide-reply-lite', 'drizzled-list']);
  assert.equal(SHIPPED_STORY_PACKS.filter(({ version }) => version === 3).length, 4);
  assert.equal(SAMPLE_STORY.id, 'creek-drift-letter');
});
