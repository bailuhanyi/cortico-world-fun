import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { COVER_ID, decodeCover, digest, MAX_COVER_BYTES, reject, storedCover } from './place-cover.js';
import { BASIC_FIELDS, blankPlace, blankSupplement, editableFields, focus, isObject, readLittleWorld,
  safeId, SOURCE_MAX, SUPPLEMENT_FIELDS, text } from './place-transfer.js';
import { OVERRIDABLE } from './user-venues.js';

export { MAX_BUNDLE_BYTES, MAX_COVER_BYTES, PlaceLibraryError } from './place-cover.js';
const MAX_BASIC_PLACES = 600;
const MAX_SOURCE_ENTRIES = 2400;
const MAX_MANIFEST_BYTES = 12 * 1024 * 1024;
const MAX_COVER_STORAGE_BYTES = 512 * 1024 * 1024;
const MAX_COVER_FILES = 2048;
const PREVIEW_TTL = 20 * 60 * 1000;
const ACTIONS = ['new', 'bind', 'skip'];
const POLICIES = ['keep', 'overwrite'];
const BINARY_FIELDS = ['cover', 'coverFocus'];
/** 场所层字段（存在 venues.json 里）：地点册编辑器和导入都用这一份白名单。 */
const VENUE_FIELDS = [...new Set([...BASIC_FIELDS, ...OVERRIDABLE, 'playable'])];
const IMPACT = 'Existing venues, stories, current trips and memories are not rewritten.';
const emptyData = () => ({ places: [], extras: [], sources: [], homeId: null, defaultStyle: '' });
const initial = () => ({ version: 1, revision: 0, data: emptyData(), recovery: null });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isBlank = (v) => v === '' || v == null || (Array.isArray(v) && v.length === 0);
const token = () => randomUUID();
const cleanKey = (value) => value.normalize('NFKC').toLowerCase();
const sourceValid = (value) => typeof value === 'string' && value === value.trim() && value.length > 0
  && value.length <= SOURCE_MAX && !/[\u0000-\u001f\u007f/\\]/u.test(value);

// A World owns one library. This queue also serializes multiple in-process instances
// sharing a data root; there is no supported second process writer to that root.
const queues = new Map();
function serial(key, run) {
  const work = (queues.get(key) ?? Promise.resolve()).then(run);
  const done = work.then(() => {}, () => {});
  queues.set(key, done);
  void done.then(() => { if (queues.get(key) === done) queues.delete(key); });
  return work;
}

async function readBounded(file, limit, { absent = false } = {}) {
  let handle;
  try {
    const entry = await lstat(file);
    if (!entry.isFile() || entry.size > limit) reject('DAMAGED_LIBRARY', 'Library file is invalid or exceeds its size limit.');
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const status = await handle.stat();
    if (!status.isFile() || status.size > limit) reject('DAMAGED_LIBRARY', 'Library file is invalid or exceeds its size limit.');
    const bytes = Buffer.alloc(status.size);
    let offset = 0;
    while (offset < bytes.length) {
      const part = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!part.bytesRead) reject('DAMAGED_LIBRARY', 'Library file changed while reading.');
      offset += part.bytesRead;
    }
    const trailing = await handle.read(Buffer.alloc(1), 0, 1, offset);
    if (trailing.bytesRead) reject('DAMAGED_LIBRARY', 'Library file changed while reading.');
    return bytes;
  } catch (err) {
    if (absent && err?.code === 'ENOENT') return null;
    throw err;
  } finally { await handle?.close(); }
}

async function directory(path, create = false) {
  if (create) await mkdir(path, { recursive: true });
  try {
    if (!(await lstat(path)).isDirectory()) reject('DAMAGED_LIBRARY', 'Library directory is not a real directory.');
  } catch (err) {
    if (!create && err?.code === 'ENOENT') return false;
    throw err;
  }
  return true;
}

async function coverStorage(dir, images) {
  const entries = await readdir(dir, { withFileTypes: true });
  const byName = new Map(entries.filter((entry) => COVER_ID.test(entry.name)).map((entry) => [entry.name, entry]));
  const additions = images.filter((image) => !byName.has(image.cover));
  if (byName.size + additions.length > MAX_COVER_FILES) reject('LIMIT', 'The place library cover file limit was reached.');
  if (!additions.length) return;
  let bytes = additions.reduce((sum, image) => sum + image.bytes.length, 0);
  for (const entry of byName.values()) {
    if (!entry.isFile()) reject('DAMAGED_LIBRARY', 'An invalid entry was found in cover storage.');
    bytes += (await lstat(join(dir, entry.name))).size;
    if (bytes > MAX_COVER_STORAGE_BYTES) reject('LIMIT', 'The place library cover storage limit was reached.');
  }
}

async function atomicWrite(file, bytes) {
  const tmp = `${file}.${token()}.tmp`;
  let handle;
  let created = false;
  try {
    handle = await open(tmp, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tmp, file);
  } catch (err) {
    await handle?.close().catch(() => {});
    if (created) await unlink(tmp).catch(() => {});
    throw err;
  }
}

function assertStored(data) {
  const validRecords = (rows, fields, base, max) => {
    if (!Array.isArray(rows) || rows.length > max) return false;
    const ids = new Set();
    for (const row of rows) {
      if (!isObject(row) || !safeId(row.id) || ids.has(row.id) || typeof row.cover !== 'string'
        || (row.cover !== '' && !COVER_ID.test(row.cover)) || (!row.cover && row.coverFocus !== null)) return false;
      const content = editableFields(row, row.id, { fields });
      const expected = { ...base(row.id), ...content, id: row.id, cover: row.cover, coverFocus: focus(row.coverFocus) };
      if (Object.keys(expected).some((key) => !same(expected[key], row[key]))) return false;
      ids.add(row.id);
    }
    return true;
  };
  if (!isObject(data) || (data.homeId !== null && !safeId(data.homeId)) || data.defaultStyle !== text(data.defaultStyle, 160, 'defaultStyle')
    || !validRecords(data.places, BASIC_FIELDS, blankPlace, MAX_BASIC_PLACES)
    || !validRecords(data.extras, SUPPLEMENT_FIELDS, blankSupplement, MAX_BASIC_PLACES)
    || !Array.isArray(data.sources) || data.sources.length > MAX_SOURCE_ENTRIES) return false;
  const keys = new Set();
  for (const item of data.sources) {
    if (!isObject(item) || !sourceValid(item.source) || !safeId(item.id)
      || (item.targetId !== null && !safeId(item.targetId)) || typeof item.signature !== 'string'
      || !/^[a-f0-9]{64}$/.test(item.signature) || (item.applied !== null
        && (typeof item.applied !== 'string' || !/^[a-f0-9]{64}$/.test(item.applied)))) return false;
    const key = JSON.stringify([item.source, item.id]);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

function validateState(state) {
  try {
    if (state?.version === 1 && Number.isSafeInteger(state.revision) && state.revision >= 0 && assertStored(state.data)
      && (state.recovery === null || (isObject(state.recovery) && safeId(state.recovery.id)
        && Number.isSafeInteger(state.recovery.revision) && state.recovery.revision > 0
        && state.recovery.revision <= state.revision && assertStored(state.recovery.data)))) return state;
  } catch { /* preserve the corrupt file for repair */ }
  reject('DAMAGED_LIBRARY', 'The place library could not be read safely; it was not replaced.');
}

function project(data, venues) {
  const extras = new Map(data.extras.map((row) => [row.id, row]));
  const places = venues.map((venue) => ({
    ...blankPlace(venue.id), ...extras.get(venue.id), id: venue.id,
    name: venue.name, desc: venue.desc ?? '', kind: venue.kind ?? '', scene: venue.scene ?? '',
    aliases: Array.isArray(venue.aliases) ? venue.aliases.slice() : [],
    tags: Array.isArray(venue.tags) ? venue.tags.slice() : [],
    // 地点就是场所：有能逛的地方才算「可玩」，其余只是地图上的一个点。
    playable: venue.playable !== false && Array.isArray(venue.areas) && venue.areas.length > 0,
    // C 版：地点册是唯一编辑器，场所字段必须完整带出去，否则表单只能编一半。
    hours: venue.hours ? { open: venue.hours.open, close: venue.hours.close } : { open: '00:00', close: '23:59' },
    crowd: venue.crowd ?? 'normal',
    recommendedOutfit: venue.recommendedOutfit ?? '',
    areas: Array.isArray(venue.areas) ? venue.areas.slice() : [],
    souvenirs: Array.isArray(venue.souvenirs) ? venue.souvenirs.slice() : [],
    photoSpots: Array.isArray(venue.photoSpots) ? venue.photoSpots.slice() : [],
    randomEvents: Array.isArray(venue.randomEvents) ? venue.randomEvents.slice() : [],
    food: venue.food ? { ...venue.food, items: Array.isArray(venue.food.items) ? venue.food.items.slice() : [] } : null,
  }));
  return places.map((row) => ({
    ...row,
    relations: row.relations.filter((r) => venues.some((venue) => venue.id === r.placeId)),
    isHome: row.id === data.homeId,
    effectiveStyle: row.style || data.defaultStyle,
    styleSource: row.style ? 'place' : data.defaultStyle ? 'default' : 'none',
  }));
}

/** 只写「叙事补充」：画风、关联、封面。场所字段（名字/描写/时间…）在 venues.json 里。 */
function put(data, row) {
  const clean = { id: row.id };
  for (const field of [...SUPPLEMENT_FIELDS, ...BINARY_FIELDS]) clean[field] = row[field];
  const idx = data.extras.findIndex((item) => item.id === row.id);
  if (!clean.style && !clean.cover && !clean.relations.length) {
    if (idx >= 0) data.extras.splice(idx, 1);
    return;
  }
  if (idx >= 0) data.extras[idx] = clean;
  else data.extras.push(clean);
}

function find(places, id) {
  const row = places.find((item) => item.id === id);
  if (!row) reject('NOT_FOUND', 'Place was not found.');
  return row;
}

function checkRelations(relations, places) {
  for (const { placeId } of relations) find(places, placeId);
}

function forbidKeys(input, fields) {
  if (!isObject(input) || Object.keys(input).some((key) => !fields.includes(key))) {
    reject('INVALID_INPUT', 'Request contains an unsupported field.');
  }
}

function nextCount(revision) {
  if (revision >= Number.MAX_SAFE_INTEGER) reject('DAMAGED_LIBRARY', 'Place library revision limit reached.');
  return revision + 1;
}

/** Local place library. Host-provided venues are always read-only authority here. */
export class PlaceLibrary {
  #dir;
  #file;
  #covers;
  #venues;
  #saveVenue;
  #removeVenue;
  #preview = null;
  #previewTimer;

  #setPreview(preview) {
    clearTimeout(this.#previewTimer);
    this.#preview = preview;
    if (preview) this.#previewTimer = setTimeout(() => this.#setPreview(null), PREVIEW_TTL).unref();
  }

  constructor({ userDataDir, dataDir, venues = () => [], saveVenue = null, removeVenue = null } = {}) {
    const root = userDataDir ?? dataDir;
    if (typeof root !== 'string' || !isAbsolute(root) || typeof venues !== 'function') {
      reject('INVALID_INPUT', 'PlaceLibrary requires an absolute user data directory and a venue reader.');
    }
    if (saveVenue !== null && typeof saveVenue !== 'function') reject('INVALID_INPUT', 'saveVenue must be a function.');
    if (removeVenue !== null && typeof removeVenue !== 'function') reject('INVALID_INPUT', 'removeVenue must be a function.');
    this.#dir = resolve(root, 'fun', 'place-library');
    this.#file = join(this.#dir, 'library.json');
    this.#covers = join(this.#dir, 'covers');
    this.#venues = venues;
    this.#saveVenue = saveVenue;
    this.#removeVenue = removeVenue;
  }

  async #readState() {
    if (!(await directory(dirname(this.#dir))) || !(await directory(this.#dir))) return initial();
    const bytes = await readBounded(this.#file, MAX_MANIFEST_BYTES, { absent: true });
    if (!bytes) return initial();
    let state;
    try { state = JSON.parse(bytes.toString('utf8')); } catch { reject('DAMAGED_LIBRARY', 'Place library JSON is unreadable.'); }
    return validateState(state);
  }

  async #run(fn) {
    return serial(this.#dir, async () => {
      const venues = this.#venues();
      if (!Array.isArray(venues) || venues.some((venue) => !safeId(venue?.id) || typeof venue.name !== 'string')
        || new Set(venues.map((venue) => venue.id)).size !== venues.length) reject('INVALID_VENUES', 'Venue authority is invalid.');
      return fn(await this.#readState(), venues);
    });
  }

  async #save(state, images = []) {
    validateState(state);
    const json = Buffer.from(JSON.stringify(state));
    if (json.length > MAX_MANIFEST_BYTES) reject('LIMIT', 'The place library exceeds its storage limit.');
    const created = [];
    await directory(dirname(this.#dir), true);
    await directory(this.#dir, true);
    try {
      const unique = [...new Map(images.map((image) => [image.cover, image])).values()];
      if (unique.length) {
        await directory(this.#covers, true);
        await coverStorage(this.#covers, unique);
      }
      for (const image of unique) {
        const path = join(this.#covers, image.cover);
        const current = await readBounded(path, MAX_COVER_BYTES, { absent: true });
        if (current) {
          if (!current.equals(image.bytes)) reject('DAMAGED_LIBRARY', 'A cover does not match its stored reference.');
        } else {
          await atomicWrite(path, image.bytes);
          created.push(path);
        }
      }
      // The manifest is the single visibility point. Blobs not referenced by a
      // committed manifest cannot be read through the library interface.
      await atomicWrite(this.#file, json);
    } catch (err) {
      for (const path of created) await unlink(path).catch(() => {});
      throw err;
    }
  }

  async #modify(mutator) {
    return this.#run(async (state, venues) => {
      const draft = structuredClone(state.data);
      const { id, value, images } = mutator(draft, project(draft, venues));
      if (!same(draft, state.data)) await this.#save({ ...state, revision: nextCount(state.revision), data: draft }, images);
      return id ? project(draft, venues).find((row) => row.id === id) ?? null : value;
    });
  }

  async snapshot() {
    return this.#run((state, venues) => {
      const places = project(state.data, venues);
      return { places, homeId: places.find((row) => row.isHome)?.id ?? null, defaultStyle: state.data.defaultStyle,
        revision: state.revision, recoveryId: state.recovery?.revision === state.revision ? state.recovery.id : null };
    });
  }

  async list({ query = '', kind, playable } = {}) {
    const needle = cleanKey(text(query, 100, 'query'));
    const { places } = await this.snapshot();
    return places.filter((row) => (!kind || row.kind === kind) && (typeof playable !== 'boolean' || row.playable === playable)
      && (!needle || [row.id, row.name, row.desc, ...row.aliases, ...row.tags].some((value) => cleanKey(value).includes(needle))));
  }

  async get(id) { return (await this.snapshot()).places.find((row) => row.id === id) ?? null; }
  async getHome() { return (await this.snapshot()).places.find((row) => row.isHome) ?? null; }

  /** 这座图书馆的 manifest 路径（迁移备份用）。 */
  get file() { return this.#file; }

  async create(input) {
    if (typeof this.#saveVenue !== 'function') reject('UNSUPPORTED', 'This library cannot create venues.');
    forbidKeys(input, VENUE_FIELDS);
    // 先把补充字段校验完再建场所：建到一半失败会留下一个没登记的场所。
    const style = input.style === undefined ? '' : text(input.style, 160, 'style');
    const rawRelations = editableFields(input, '', { fields: ['relations'] }).relations ?? [];
    return this.#run(async (state, venues) => {
      const draft = structuredClone(state.data);
      const name = text(input.name, 40, 'name') || '';
      if (!name) reject('INVALID_INPUT', 'Place name cannot be empty.');
      if (venues.some((place) => cleanKey(place.name) === cleanKey(name))) reject('NAME_CONFLICT', 'A place already uses that name.');
      // 有「能逛的」就是可玩场所，没有就只是地图上的一个点；交给 venue 清单一并判断。
      const saved = await this.#saveVenue({ ...input, name });
      const place = saved?.venue;
      if (!place?.id) reject('INVALID_INPUT', saved?.error ?? 'The venue could not be created.');
      const relations = rawRelations.filter((relation) => relation.placeId !== place.id);
      if (style || relations.length) put(draft, { id: place.id, style, relations, cover: '', coverFocus: null });
      // 场所本身就是快照的一部分：就算 extras 没变，修订号也要往前走，
      // 否则别的面板拿着旧 revision 还能提交，刚加的地点会被静默盖掉。
      await this.#save({ ...state, revision: nextCount(state.revision), data: draft });
      return { id: place.id };
    });
  }

  /** 只改「叙事补充」（画风 / 关联 / 封面焦点）；场所字段走 `updateVenue`。 */
  async update(id, patch) {
    forbidKeys(patch, [...SUPPLEMENT_FIELDS, 'coverFocus']);
    return this.#modify((data, places) => {
      const row = find(places, id);
      const updates = editableFields(patch, id, { fields: SUPPLEMENT_FIELDS });
      if (updates.relations) checkRelations(updates.relations, places);
      // Preserve unresolved relations if a venue vanished after they were saved.
      const existing = data.extras.find((item) => item.id === id);
      const next = { ...row, relations: existing?.relations ?? row.relations, ...updates };
      if (Object.hasOwn(patch, 'coverFocus')) next.coverFocus = focus(patch.coverFocus);
      if (next.coverFocus && !next.cover) reject('INVALID_INPUT', 'A cover is required before setting focus.');
      put(data, next);
      return { id };
    });
  }

  /** 场所字段（名字/描写/时间/能逛的/纪念品…）走这里；没有 venues 写入器时拒绝。 */
  async updateVenue(id, patch) {
    if (typeof this.#saveVenue !== 'function') reject('UNSUPPORTED', 'This library cannot edit venues.');
    forbidKeys(patch, VENUE_FIELDS);
    return this.#run(async (state, venues) => {
      const row = find(project(state.data, venues), id);
      const name = patch.name === undefined ? row.name : text(patch.name, 40, 'name');
      if (!name) reject('INVALID_INPUT', 'Place name cannot be empty.');
      if (cleanKey(name) !== cleanKey(row.name)
        && venues.some((other) => other.id !== id && cleanKey(other.name) === cleanKey(name))) {
        reject('NAME_CONFLICT', 'A place already uses that name.');
      }
      const saved = await this.#saveVenue({ ...patch, id, name });
      if (!saved?.ok) reject('INVALID_INPUT', saved?.error ?? 'The venue could not be saved.');
      // venue 变了，快照也变了：修订号跟着走，别让旧 revision 的提交悄悄覆盖。
      await this.#save({ ...state, revision: nextCount(state.revision), data: state.data });
      return { id };
    });
  }

  async remove(id) {
    if (typeof this.#removeVenue !== 'function') reject('UNSUPPORTED', 'This library cannot remove venues.');
    return this.#run(async (state, venues) => {
      const row = find(project(state.data, venues), id);
      if (row.playable) reject('PLAYABLE_PLACE', 'Playable venues must be removed through the venue editor.');
      const removed = await this.#removeVenue(id);
      if (!removed?.ok) reject('INVALID_INPUT', removed?.error ?? 'The venue could not be removed.');
      return this.#forget(state, id);
    });
  }

  /** 删场所本身由调用方负责（可玩场所），这里只清掉画风/关联/封面/住所。 */
  async forget(id) {
    return this.#run(async (state) => this.#forget(state, id));
  }

  async #forget(state, id) {
    const draft = structuredClone(state.data);
    draft.extras = draft.extras.filter((item) => item.id !== id);
    for (const item of draft.extras) item.relations = item.relations.filter((relation) => relation.placeId !== id);
    if (draft.homeId === id) draft.homeId = null;
    // 场所本身已经被删掉，快照一定变了——修订号总要往前走。
    await this.#save({ ...state, revision: nextCount(state.revision), data: same(draft, state.data) ? state.data : draft });
    return { value: true };
  }

  /**
   * 取出旧版本存在 `data.places` 里的「基础地点」并清空。
   *
   * C 版把地点表并进 venues.json：这些地点要带着**原 id** 迁过去，
   * `relations` / `homeId` / 故事绑定 / 历史行程才不会断。
   * 迁移期间出问题要能回退，所以写之前先在同一目录留一份 `library.json.bak-*`。
   */
  async takeLegacyPlaces() {
    return this.#run(async (state) => {
      const places = structuredClone(state.data.places);
      if (!places.length) return { places: [], backup: null };
      const backup = `${this.#file}.bak-${token()}`;
      await copyFile(this.#file, backup, constants.COPYFILE_EXCL);
      const data = structuredClone(state.data);
      data.places = [];
      await this.#save({ ...state, revision: nextCount(state.revision), data });
      return { places, backup };
    });
  }

  /**
   * 把旧基础地点的画风/关联/封面搬进 `extras`（场所字段已经在 venues.json 里）。
   *
   * 只搬仍然成立的东西：封面文件不在就当没有，关联目标不存在就丢掉，
   * 免得迁移把一条坏关联带进新表。
   */
  async adoptExtras(id, { style, relations, cover, coverFocus } = {}) {
    return this.#run(async (state, venues) => {
      find(project(state.data, venues), id);
      const row = { id, style: '', relations: [], cover: '', coverFocus: null };
      row.style = text(style ?? '', 160, 'style');
      row.relations = editableFields({ relations: relations ?? [] }, id, { fields: ['relations'] }).relations;
      const wanted = typeof cover === 'string' && COVER_ID.test(cover) ? cover : '';
      if (wanted) {
        const bytes = await readBounded(join(this.#covers, wanted), MAX_COVER_BYTES, { absent: true });
        if (bytes) { row.cover = wanted; row.coverFocus = focus(coverFocus ?? null, false); }
      }
      if (!row.style && !row.cover && !row.relations.length) return { ok: true, adopted: false };
      const data = structuredClone(state.data);
      put(data, row);
      if (!same(data, state.data)) await this.#save({ ...state, revision: nextCount(state.revision), data });
      return { ok: true, adopted: true };
    });
  }

  async setHome(id) {
    return this.#modify((data, places) => {
      if (id !== null) find(places, id);
      data.homeId = id;
      return { value: id };
    });
  }

  async setDefaultStyle(style) {
    return this.#modify((data) => {
      data.defaultStyle = text(style, 160, 'defaultStyle');
      return { value: data.defaultStyle };
    });
  }

  async setCover(id, input) {
    forbidKeys(input, ['dataUrl', 'coverFocus']);
    const image = decodeCover(input.dataUrl);
    return this.#changeCover(id, image, focus(input.coverFocus));
  }

  async clearCover(id) { return this.#changeCover(id, null, null); }

  async #changeCover(id, image, coverFocus) {
    return this.#modify((data, places) => {
      const row = find(places, id);
      const existing = data.extras.find((item) => item.id === id);
      put(data, { ...row, relations: existing?.relations ?? row.relations, cover: image?.cover ?? '', coverFocus });
      return { id, images: image ? [image] : [] };
    });
  }

  async readCover(id) {
    return this.#run(async (state, venues) => {
      const row = project(state.data, venues).find((item) => item.id === id);
      if (!row?.cover) return null;
      if (!(await directory(this.#covers))) reject('DAMAGED_LIBRARY', 'Stored cover directory is missing.');
      return storedCover(row.cover, await readBounded(join(this.#covers, row.cover), MAX_COVER_BYTES));
    });
  }

  async previewImport(input, options) {
    forbidKeys(options, ['sourceId', 'defaultStyle', 'mappings', 'useImportedHome']);
    if (!sourceValid(options.sourceId)) reject('INVALID_SOURCE', 'Choose an explicit source identity for this Little World export.');
    const oldDefault = options.defaultStyle === undefined ? '' : text(options.defaultStyle, 160, 'defaultStyle');
    return this.#run((state, venues) => {
      const imported = readLittleWorld(input);
      const signature = digest(JSON.stringify([imported.signature, oldDefault]));
      const pending = { ...imported, signature, sourceId: options.sourceId, oldDefault,
        revision: state.revision, venueVersion: venueVersion(venues), previewId: token(), expires: Date.now() + PREVIEW_TTL };
      const view = previewResult(state, venues, pending);
      if (options.mappings !== undefined) {
        const plan = importPlan(state, venues, pending, options);
        pending.approvedPlan = importPlanKey(plan, options.useImportedHome);
        view.proposed = { mappings: plan.mappings, homeId: plan.data.homeId, warnings: plan.warnings,
          changes: plan.changes, duplicate: plan.duplicate };
      }
      // One large but bounded preview per library instance; new preview supersedes the last.
      this.#setPreview(pending);
      return view;
    });
  }

  async commitImport(input, { requireReview = false } = {}) {
    forbidKeys(input, ['previewId', 'mappings', 'useImportedHome']);
    return this.#run(async (state, venues) => {
      const pending = this.#preview;
      if (!pending || pending.previewId !== input.previewId || pending.expires <= Date.now()
        || pending.revision !== state.revision || pending.venueVersion !== venueVersion(venues)) {
        reject('STALE_PREVIEW', 'The import preview expired or the library changed. Preview the export again.');
      }
      if (requireReview && !pending.approvedPlan) reject('PLAN_REQUIRED', '请先核对逐项迁入结果。');
      const plan = importPlan(state, venues, pending, input);
      if (plan.venues.length && typeof this.#saveVenue !== 'function') reject('UNSUPPORTED', 'This library cannot create venues.');
      if (pending.approvedPlan && pending.approvedPlan !== importPlanKey(plan, input.useImportedHome)) {
        reject('PLAN_MISMATCH', 'The import decisions changed after review. Preview the revised plan again.');
      }
      let recoveryId = state.recovery?.revision === state.revision ? state.recovery.id : null;
      let revision = state.revision;
      const writes = plan.venues.length > 0;
      if (writes || !same(plan.data, state.data)) {
        recoveryId = token();
        revision = nextCount(revision);
        // library.json 先落盘（封面也在这里），失败时 venues.json 一个字都没动。
        await this.#save({ ...state, revision, data: plan.data, recovery: { id: recoveryId, revision, data: state.data, venues: plan.venueUndo } }, plan.images);
        if (writes) {
          try {
            for (const { id, patch } of plan.venues) {
              const saved = await this.#saveVenue({ ...patch, id });
              if (!saved?.ok) reject('INVALID_INPUT', saved?.error ?? 'The imported venue could not be saved.');
            }
          } catch (error) {
            // 场所没写成就把 manifest 退回导入前，别留下指向不存在地点的 receipts。
            await this.#save({ ...state, revision, data: state.data, recovery: null }, []).catch(() => {});
            throw error;
          }
        }
      }
      this.#setPreview(null);
      return { mappings: plan.mappings, homeId: plan.data.homeId, recoveryId, duplicate: plan.duplicate,
        revision, warnings: plan.warnings };
    });
  }

  async restoreImport(recoveryId) {
    if (!safeId(recoveryId)) reject('INVALID_INPUT', 'Choose a valid recovery point.');
    return this.#run(async (state) => {
      if (state.recovery?.id !== recoveryId || state.recovery.revision !== state.revision) {
        reject('RECOVERY_CONFLICT', 'Recovery is unavailable or the place library has since changed.');
      }
      const data = state.recovery.data;
      const undo = Array.isArray(state.recovery.venues) ? state.recovery.venues : [];
      const revision = nextCount(state.revision);
      await this.#save({ ...state, revision, data, recovery: null });
      // 导入时新建/改写的场所在 venues.json 里，恢复点要一起退回去。
      for (const { id, before } of undo) {
        if (before) {
          const saved = await this.#saveVenue?.({ ...before, id });
          if (saved && !saved.ok) reject('INVALID_INPUT', saved.error ?? 'The recovered venue could not be saved.');
        } else {
          await this.#removeVenue?.(id);
        }
      }
      this.#setPreview(null);
      const places = project(data, this.#venues());
      return { places, homeId: places.find((row) => row.isHome)?.id ?? null, defaultStyle: data.defaultStyle, revision, recoveryId: null };
    });
  }
}

function venueVersion(venues) {
  return digest(JSON.stringify(venues.map((row) => [row.id, row.name, row.desc, row.kind, row.aliases, row.tags, row.scene])));
}

function sourcesById(data, source) {
  return new Map(data.sources.filter((row) => row.source === source).map((row) => [row.id, row]));
}

function previewResult(state, venues, pending) {
  const places = project(state.data, venues);
  const byId = new Map(places.map((row) => [row.id, row]));
  const sources = sourcesById(state.data, pending.sourceId);
  const sourceIds = new Set(pending.places.map(({ place }) => place.id));
  const warnings = [...pending.warnings];
  if (!pending.oldDefault && pending.places.some(({ place }) => !place.style)) {
    warnings.push('Little World v1 does not export its global default style. No old default style was supplied.');
  }
  warnings.push('Views, drafts, historical image archives and other old settings are not included.');
  const items = pending.places.map(({ place, coverStatus, image }) => {
    const conflicts = [];
    const idHit = byId.get(place.id);
    if (idHit) conflicts.push({ type: 'id', targetId: idHit.id, name: idHit.name });
    for (const row of places) if (cleanKey(row.name) === cleanKey(place.name)) {
      conflicts.push({ type: 'name', targetId: row.id, name: row.name });
    }
    for (const item of pending.places) if (item.place.id !== place.id && cleanKey(item.place.name) === cleanKey(place.name)) {
      conflicts.push({ type: 'source-name', targetId: item.place.id, name: item.place.name });
    }
    const oldTarget = sources.get(place.id)?.targetId;
    if (oldTarget && !byId.has(oldTarget)) warnings.push(`${place.name}: previously bound place is no longer available.`);
    const existingTargetId = byId.has(oldTarget) ? oldTarget : null;
    const styleSource = place.style ? 'place' : pending.oldDefault ? 'source-default' : state.data.defaultStyle ? 'local-default' : 'none';
    return {
      sourceId: place.id, name: place.name, desc: place.desc, style: place.style,
      styleSource, effectiveStyle: place.style || pending.oldDefault || state.data.defaultStyle,
      coverStatus, coverBytes: image?.bytes.length ?? 0, legacyFunVenue: place.legacyFunVenue,
      missingRelations: place.relations.filter((r) => !sourceIds.has(r.placeId)), conflicts, existingTargetId,
      recommendedAction: conflicts.length || existingTargetId || sources.get(place.id)?.signature === pending.signature ? 'skip' : 'new',
      place: structuredClone(place),
    };
  });
  return { previewId: pending.previewId, sourceId: pending.sourceId, format: 'little-world', version: 1,
    sourceHomeId: pending.homeId, homeId: places.find((row) => row.isHome)?.id ?? null, defaultStyle: pending.oldDefault,
    items, coverCount: pending.coverCount, coverBytes: pending.coverBytes, placeCount: items.length,
    alreadyImported: items.length > 0 && items.every((item) => sources.get(item.sourceId)?.signature === pending.signature),
    warnings, impact: IMPACT };
}

function importPlanKey(plan, useImportedHome = false) {
  return digest(JSON.stringify([useImportedHome, plan.mappings]));
}

function importPlan(state, venues, pending, { mappings, useImportedHome = false }) {
  if (typeof useImportedHome !== 'boolean' || !Array.isArray(mappings) || mappings.length !== pending.places.length) {
    reject('INVALID_MAPPING', 'Choose a mapping for every place and explicitly opt in to importing home.');
  }
  const decisions = new Map();
  const incoming = new Map(pending.places.map((entry) => [entry.place.id, entry]));
  for (const mapping of mappings) {
    forbidKeys(mapping, ['sourceId', 'action', 'targetId', 'policy']);
    if (!incoming.has(mapping.sourceId) || decisions.has(mapping.sourceId) || !ACTIONS.includes(mapping.action)
      || (mapping.action === 'bind' ? !safeId(mapping.targetId) : mapping.targetId !== undefined)
      || (mapping.policy !== undefined && (mapping.action !== 'bind' || !POLICIES.includes(mapping.policy)))) {
      reject('INVALID_MAPPING', 'Each source place needs one valid new, bind, or skip decision.');
    }
    decisions.set(mapping.sourceId, mapping);
  }

  const data = structuredClone(state.data);
  const prior = sourcesById(state.data, pending.sourceId);
  const known = new Map(prior);
  const current = project(data, venues);
  const byId = new Map(current.map((row) => [row.id, row]));
  const allocated = new Set([...byId.keys(), ...data.extras.map((row) => row.id)]);
  const targetBySource = new Map();
  const owners = new Map();
  const plan = [];
  const warnings = [...pending.warnings];
  const protect = new Map([...known].filter(([, row]) => byId.has(row.targetId)).map(([id, row]) => [row.targetId, id]));
  let nextPlaces = current.length;
  for (const { place } of pending.places) {
    const sourceId = place.id;
    const { action, targetId: chosen, policy = 'keep' } = decisions.get(sourceId);
    const old = known.get(sourceId);
    const formerlyMapped = old?.targetId && byId.has(old.targetId) ? old.targetId : null;
    let targetId = formerlyMapped;
    let result = action;
    if (action === 'bind') {
      find(current, chosen);
      if (formerlyMapped && chosen !== formerlyMapped) {
        reject('SOURCE_CONFLICT', `${place.name} is already mapped to a different local place.`);
      }
      targetId = chosen;
    } else if (action === 'new' && !targetId) {
      if (++nextPlaces > MAX_BASIC_PLACES) reject('LIMIT', 'The place library is full.');
      const baseId = `place-import-${digest(JSON.stringify([pending.sourceId, sourceId])).slice(0, 28)}`;
      targetId = baseId;
      for (let n = 2; allocated.has(targetId); n += 1) targetId = `${baseId}-${n}`;
      allocated.add(targetId);
    } else if (action === 'new') {
      // Replaying a creation cannot create a second place or overwrite user edits.
      result = 'existing';
    }
    if (targetId) {
      if ((protect.has(targetId) && protect.get(targetId) !== sourceId) || owners.has(targetId)) {
        reject('TARGET_CONFLICT', 'Two places from the same Little World cannot share one local target.');
      }
      owners.set(targetId, sourceId);
      targetBySource.set(sourceId, targetId);
    }
    plan.push({ sourceId, action, result, targetId, policy });
  }

  const images = [];
  const changes = [];
  /** 需要写回 venues.json 的场所字段（C 版：地点表在 venues，不在 library.json）。 */
  const venueWrites = [];
  /** 回滚用：每个被导入改写/新建的场所在导入前的样子（新建的是 null）。 */
  const venueUndo = [];
  const venueSnapshot = (row) => Object.fromEntries(['name', 'desc', 'kind', 'aliases', 'tags', 'scene',
    'playable', 'hours', 'crowd', 'recommendedOutfit', 'areas', 'souvenirs', 'photoSpots', 'randomEvents', 'food']
    .filter((key) => row?.[key] !== undefined).map((key) => [key, structuredClone(row[key])]));
  const visibleNames = new Set(current.map((row) => cleanKey(row.name)));
  for (const entry of plan) {
    const { sourceId, targetId, policy } = entry;
    const { place, image, coverStatus } = incoming.get(sourceId);
    const before = byId.get(targetId) ?? null;
    let after = before;
    const mapping = known.get(sourceId);
    // Replays preserve later edits, but a reviewed policy or relation mapping change is a new application.
    const applied = digest(JSON.stringify([pending.signature, policy,
      place.relations.map(({ placeId }) => targetBySource.get(placeId) ?? null)]));
    if (entry.result === 'bind' && mapping?.targetId === targetId
      && (mapping.applied === applied || (mapping.applied === pending.signature && policy === 'keep'))) {
      entry.result = 'existing';
    }
    const { result } = entry;
    if (result === 'new' || result === 'bind') {
      const record = data.extras.find((row) => row.id === targetId);
      const base = { ...(before ?? blankPlace(targetId)), relations: record?.relations ?? before?.relations ?? [] };
      const remapped = [];
      const seen = new Set();
      for (const relation of place.relations) {
        const mapped = targetBySource.get(relation.placeId);
        if (!mapped || mapped === targetId || seen.has(mapped)) {
          warnings.push(`${place.name}: relation to ${relation.placeId} has no usable mapped target.`);
          continue;
        }
        seen.add(mapped);
        remapped.push({ placeId: mapped, note: relation.note });
      }
      const transfer = { ...place, style: place.style || pending.oldDefault, relations: remapped };
      after = { ...base };
      // 可玩场所的场所字段归 venues 权威，导入只补画风/关联/封面。
      const venuePatch = {};
      if (!before || !before.playable) {
        for (const key of ['name', 'desc', 'kind', 'aliases', 'tags', 'scene']) {
          if (!before || policy === 'overwrite' || (isBlank(base[key]) && !isBlank(transfer[key]))) {
            after[key] = transfer[key];
            venuePatch[key] = transfer[key];
          }
        }
      }
      for (const key of SUPPLEMENT_FIELDS) {
        if (!before || policy === 'overwrite' || (isBlank(base[key]) && !isBlank(transfer[key]))) after[key] = transfer[key];
      }
      if (Object.keys(venuePatch).length) {
        venueWrites.push({ id: targetId, patch: venuePatch });
        venueUndo.push({ id: targetId, before: before ? venueSnapshot(before) : null });
      }
      if (!before && visibleNames.has(cleanKey(after.name))) warnings.push(`${place.name}: a separate place with the same name was explicitly created.`);
      if (before && after.name !== before.name && current.some((row) => row.id !== targetId && cleanKey(row.name) === cleanKey(after.name))) {
        warnings.push(`${place.name}: explicitly overwrote the bound basic place with a name shared by another place.`);
      }
      visibleNames.add(cleanKey(after.name));
      if (image && (!before || policy === 'overwrite' || !base.cover)) {
        after.cover = image.cover;
        after.coverFocus = place.coverFocus;
        images.push(image);
      } else if (before && policy === 'overwrite' && coverStatus === 'none') {
        after.cover = '';
        after.coverFocus = null;
      }
      put(data, after);
      known.set(sourceId, { source: pending.sourceId, id: sourceId, targetId, signature: pending.signature, applied });
    } else {
      known.set(sourceId, { source: pending.sourceId, id: sourceId, targetId: targetId ?? mapping?.targetId ?? null,
        signature: pending.signature, applied: mapping?.applied ?? null });
    }
    const fields = [...BASIC_FIELDS, ...BINARY_FIELDS].map((field) => ({ field, local: before?.[field] ?? null,
      incoming: field === 'cover' ? image?.cover ?? '' : field === 'style' ? place.style || pending.oldDefault : place[field],
      result: after?.[field] ?? null, changed: !same(before?.[field], after?.[field]),
      authoritative: Boolean(before?.playable && ![...SUPPLEMENT_FIELDS, ...BINARY_FIELDS].includes(field)) }));
    changes.push({ sourceId, targetId, fields });
  }
  if (useImportedHome) {
    const homeId = targetBySource.get(pending.homeId);
    if (!homeId) reject('INVALID_HOME', 'The exported home was not mapped to a local place.');
    data.homeId = homeId;
  }
  data.sources = [...data.sources.map((row) => row.source === pending.sourceId ? known.get(row.id) : row),
    ...[...known.values()].filter((row) => !prior.has(row.id))];
  if (data.sources.length > MAX_SOURCE_ENTRIES || data.extras.length > MAX_BASIC_PLACES) reject('LIMIT', 'The library has too many source mappings or venue supplements.');
  return { data, images, warnings, mappings: plan, changes, venues: venueWrites, venueUndo,
    duplicate: pending.places.length > 0 && !venueWrites.length && pending.places.every(({ place }) => prior.get(place.id)?.signature === pending.signature)
      && same(data, state.data) };
}
