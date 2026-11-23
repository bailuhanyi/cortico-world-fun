import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateSampleVenue, markVenueMigration, RETIRED_SAMPLE_VENUE_ID } from '../src/story-venue-migration.js';
import { cleanup } from './tmp.mjs';

async function rig(t) {
  const dir = await fs.mkdtemp(join(tmpdir(), 'fun-venue-033-'));
  cleanup(t, dir);
  return { dir, file: join(dir, 'venues.json') };
}

test('venue migration backs up exact original bytes and removes only the retired fixed ID', async (t) => {
  const { dir, file } = await rig(t);
  const custom = { id: 'user-mine', name: '溪边的漂流信', custom: { untouched: true } };
  const raw = { venues: [{ id: RETIRED_SAMPLE_VENUE_ID }, custom], overrides: { cafe: { desc: '我的设置' } }, future: { keep: 7 } };
  const original = '\r\n' + JSON.stringify(raw) + '\r\n';
  await fs.writeFile(file, original);
  const result = await migrateSampleVenue(file);
  assert.equal(result.ok, true);
  assert.equal(result.migrated, true);
  assert.equal(await fs.readFile(result.backup, 'utf8'), original);
  assert.deepEqual(JSON.parse(await fs.readFile(file)), { ...raw, venues: [custom] });
  assert.equal((await fs.readdir(dir)).filter((name) => name.endsWith('.bak')).length, 1);
});

test('venue migration is one-time and does not remove later user creations with the same ID', async (t) => {
  const { file } = await rig(t);
  await fs.writeFile(file, JSON.stringify([{ id: RETIRED_SAMPLE_VENUE_ID }]));
  assert.equal((await migrateSampleVenue(file)).ok, true);
  const later = JSON.stringify([{ id: RETIRED_SAMPLE_VENUE_ID, name: '自己重建的地点' }]);
  await fs.writeFile(file, later);
  assert.equal((await migrateSampleVenue(file)).migrated, false);
  assert.equal(await fs.readFile(file, 'utf8'), later);
});

test('backup failure leaves venue bytes untouched and never attempts replacement', async (t) => {
  const { file } = await rig(t);
  const original = JSON.stringify({ venues: [{ id: RETIRED_SAMPLE_VENUE_ID }], overrides: {} });
  await fs.writeFile(file, original);
  let replacements = 0;
  const io = { ...fs, writeFile: async (target, ...args) => {
    if (String(target).endsWith('.bak')) throw new Error('test backup failure');
    return fs.writeFile(target, ...args);
  }, rename: async (...args) => { replacements++; return fs.rename(...args); } };
  const result = await migrateSampleVenue(file, io);
  assert.equal(result.ok, false);
  assert.equal(replacements, 0);
  assert.equal(await fs.readFile(file, 'utf8'), original);
});

test('replacement failure preserves original and recovery backup and removes only its own temporary file', async (t) => {
  const { dir, file } = await rig(t);
  const original = JSON.stringify([{ id: RETIRED_SAMPLE_VENUE_ID }, { id: 'user-keep' }]);
  await fs.writeFile(file, original);
  const result = await migrateSampleVenue(file, { ...fs, rename: async () => { throw new Error('test rename failure'); } });
  assert.equal(result.ok, false);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  const files = await fs.readdir(dir);
  assert.equal(files.some((name) => name.endsWith('.tmp')), false);
  const backup = files.find((name) => name.endsWith('.bak'));
  assert.equal(await fs.readFile(join(dir, backup), 'utf8'), original);
});

test('empty new installs remain read-only; first author save can mark migration complete before writing', async (t) => {
  const { dir, file } = await rig(t);
  assert.equal((await migrateSampleVenue(file)).ok, true);
  assert.deepEqual(await fs.readdir(dir), []);
  await markVenueMigration(file);
  const created = JSON.stringify({ venues: [{ id: RETIRED_SAMPLE_VENUE_ID, name: '作者作品地点' }] });
  await fs.writeFile(file, created);
  assert.equal((await migrateSampleVenue(file)).migrated, false);
  assert.equal(await fs.readFile(file, 'utf8'), created);
});

test('malformed venues are preserved without attempting migration', async (t) => {
  const { file } = await rig(t);
  await fs.writeFile(file, '{broken');
  assert.equal((await migrateSampleVenue(file)).ok, false);
  assert.equal(await fs.readFile(file, 'utf8'), '{broken');
});
