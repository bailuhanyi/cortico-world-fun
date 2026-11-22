import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

export const RETIRED_SAMPLE_VENUE_ID = 'user-story-creek-letter';
/** Places that shipped as user-written copies but are now built into the plugin.
 * They are only removed when the stored copy is byte-equivalent to the built-in definition,
 * so a place the user has since edited (or rebuilt later) is never touched. */
export const PROMOTED_VENUE_IDS = Object.freeze(['user-ezfvd', 'user-f3u9p']);
export const VENUE_MIGRATION_SUFFIX = '.presets-033.json';
export const PROMOTED_VENUE_MIGRATION_SUFFIX = '.promoted-033.json';

/** A separate marker survives ordinary venue edits without changing the old venue format. */
export async function markVenueMigration(file, io = fs) {
  await io.mkdir(dirname(file), { recursive: true });
  const marker = `${file}${VENUE_MIGRATION_SUFFIX}`;
  try { await io.writeFile(marker, '{"removeSampleVenue033":true}\n', { encoding: 'utf8', flag: 'wx' }); }
  catch (error) { if (error?.code !== 'EEXIST') throw error; }
}

export async function markPromotedVenueMigration(file, io = fs) {
  await io.mkdir(dirname(file), { recursive: true });
  const marker = `${file}${PROMOTED_VENUE_MIGRATION_SUFFIX}`;
  try { await io.writeFile(marker, '{"promoteSelectedVenues033":true}\n', { encoding: 'utf8', flag: 'wx' }); }
  catch (error) { if (error?.code !== 'EEXIST') throw error; }
}

const sameVenue = (stored, builtin) => {
  if (!stored || typeof stored !== 'object' || stored.id !== builtin.id) return false;
  const keys = ['name', 'aliases', 'tags', 'desc', 'scene', 'recommendedOutfit', 'crowd', 'areas', 'souvenirs', 'photoSpots', 'randomEvents'];
  const norm = (value) => JSON.stringify(value ?? null);
  return keys.every((key) => norm(stored[key]) === norm(builtin[key]))
    && norm(stored.hours?.open) === norm(builtin.hours?.open)
    && norm(stored.hours?.close) === norm(builtin.hours?.close);
};

/** Remove only the built-in-equivalent copies of the two promoted places; edited versions survive. */
export async function migratePromotedVenues(file, builtins, io = fs) {
  try {
    try {
      const marker = JSON.parse(await io.readFile(`${file}${PROMOTED_VENUE_MIGRATION_SUFFIX}`, 'utf8'));
      if (marker?.promoteSelectedVenues033 === true) return { ok: true, migrated: false };
      return { ok: false, error: '内置地点迁移标记无效；已保留原文件，暂不允许保存地点。' };
    } catch (error) { if (error?.code !== 'ENOENT') return { ok: false, error: '内置地点迁移标记不可读；已保留原文件，暂不允许保存地点。' }; }
    let original;
    try { original = await io.readFile(file); }
    catch (error) {
      // Nothing stored yet: nothing to promote, and creating files here would make a
      // read-only start write to disk. The next real save writes the marker.
      if (error?.code === 'ENOENT') return { ok: true, migrated: false };
      throw error;
    }
    const raw = JSON.parse(original.toString('utf8'));
    const venues = Array.isArray(raw) ? raw : raw?.venues;
    if (!Array.isArray(venues)) throw new Error('invalid venue data');
    const byId = new Map(builtins.map((venue) => [venue.id, venue]));
    const filtered = venues.filter((venue) => {
      const builtin = byId.get(venue?.id);
      return !builtin || !sameVenue(venue, builtin);
    });
    let backup;
    if (filtered.length !== venues.length) {
      backup = `${file}.promoted-033-${randomUUID()}.bak`;
      await io.writeFile(backup, original, { flag: 'wx' });
      const next = Array.isArray(raw) ? filtered : { ...raw, venues: filtered };
      const temp = `${file}.promoted-033-${randomUUID()}.tmp`;
      try {
        await io.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        await io.rename(temp, file);
      } catch (error) { await io.rm(temp, { force: true }).catch(() => {}); throw error; }
    }
    await markPromotedVenueMigration(file, io);
    return { ok: true, migrated: Boolean(backup), ...(backup ? { backup } : {}) };
  } catch {
    return { ok: false, error: '内置地点备份或迁移失败；已保留可恢复副本，暂不允许保存地点。' };
  }
}

/** Only the retired fixed ID is removed; the exact original bytes are backed up first. */
export async function migrateSampleVenue(file, io = fs) {
  try {
    try {
      const marker = JSON.parse(await io.readFile(`${file}${VENUE_MIGRATION_SUFFIX}`, 'utf8'));
      if (marker?.removeSampleVenue033 === true) return { ok: true, migrated: false };
      return { ok: false, error: '样章场所迁移标记无效；已保留原文件，暂不允许保存地点。' };
    } catch (error) { if (error?.code !== 'ENOENT') return { ok: false, error: '样章场所迁移标记不可读；已保留原文件，暂不允许保存地点。' }; }
    let original;
    try { original = await io.readFile(file); }
    catch (error) {
      if (error?.code === 'ENOENT') return { ok: true, migrated: false };
      throw error;
    }
    const raw = JSON.parse(original.toString('utf8'));
    const venues = Array.isArray(raw) ? raw : raw?.venues;
    if (!Array.isArray(venues)) throw new Error('invalid venue data');
    const filtered = venues.filter((venue) => venue?.id !== RETIRED_SAMPLE_VENUE_ID);
    let backup;
    if (filtered.length !== venues.length) {
      backup = `${file}.presets-033-${randomUUID()}.bak`;
      await io.writeFile(backup, original, { flag: 'wx' });
      const next = Array.isArray(raw) ? filtered : { ...raw, venues: filtered };
      const temp = `${file}.presets-033-${randomUUID()}.tmp`;
      try {
        await io.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        await io.rename(temp, file);
      } catch (error) { await io.rm(temp, { force: true }).catch(() => {}); throw error; }
    }
    await markVenueMigration(file, io);
    return { ok: true, migrated: Boolean(backup), ...(backup ? { backup } : {}) };
  } catch {
    return { ok: false, error: '样章场所备份或迁移失败；已保留可恢复副本，暂不允许保存地点。' };
  }
}
