/**
 * 「家」的 2D 房间状态：一个独立的 `fun/home/room.json` + 内容寻址的图片目录。
 *
 * 三条底线（都有测试守着）：
 *   1. **不碰 `state.json`**——这里只写 `fun/home/`，行进中的行程、故事、回忆一个字节都不动。
 *   2. **读不落盘**——`snapshot()` / `readArt()` 只读；写只有那几个 `set*`。
 *   3. **坏文件不覆盖**——`room.json` 解析不了就整份留在原地，面板转只读，写操作全拒。
 *
 * 版本：`room.json` v1（P0–P2）与 v2（P4 起）。v2 多了 `placements`、`art.foreground`、
 * `art.painting`；v1 读进来先在内存里补成 v2，**第一次写才落成 v2**（只读方法仍然不落盘）。
 * 旧字段一个都不丢：迁移只加缺省值。
 *
 * 图片复用地点封面的校验器（`place-cover.js`）：同一个 8 MiB 上限、同一组格式、
 * 同一个 `<sha256>.<ext>` 内容寻址命名；读盘时再用 `storedCover()` 复核一遍，
 * 防止文件被换掉之后仍被当成原图显示。
 */
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { COVER_ID, decodeCover, MAX_COVER_BYTES, storedCover } from './place-cover.js';

export const ACTIVITIES = Object.freeze([
  'idle', 'reading', 'watching', 'cards', 'gaming',
  'painting', 'cooking', 'looking_outside', 'sleeping', 'chatting',
]);

export const ACTIVITY_LABELS = Object.freeze({
  idle: '发呆',
  reading: '读书',
  watching: '刷视频',
  cards: '打牌',
  gaming: '打游戏',
  painting: '画画',
  cooking: '做饭',
  looking_outside: '看窗外',
  sleeping: '睡觉',
  chatting: '和主人聊天',
});

export const ACTIVITY_HINTS = Object.freeze({
  idle: '什么也不做，就在家里待着。',
  reading: '翻一本旧书，或者一本一直没读完的。',
  watching: '刷一会儿视频，手机举在手里。',
  cards: '摊开一副牌，自己跟自己玩。',
  gaming: '坐在毯子上打一会儿游戏。',
  painting: '在画架前涂点颜色。',
  cooking: '在厨房角煮点东西。',
  looking_outside: '站在窗边，看外面。',
  sleeping: '蜷在沙发上睡一会儿。',
  chatting: '转过身来，跟主人说话。',
});

const MAX_ROOM_BYTES = 256 * 1024;
const MAX_ART_FILES = 64;
const MAX_ART_BYTES = 128 * 1024 * 1024;
const MAX_NOTE = 120;
const MAX_PLAN = 60;
const MAX_HOTSPOTS = 12;
const MAX_HOTSPOT_NOTE = 60;
const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
const REF = /^[a-f0-9]{64}\.(?:png|jpg|gif|webp)$/;
const HOTSPOT_ID = /^[a-z0-9-]{1,32}$/;
const SOURCES = new Set(['default', 'panel']);

/**
 * 时段默认活动（服务端按 Asia/Shanghai 小时算）。
 *
 * **只影响展示，不写盘**：`source: 'default'` 时看到的活动由这里决定；
 * 用户点任意活动之后 `source: 'panel'`，文件里的活动才开始固定。
 * 六个时段见任务书 §4。
 */
export function defaultActivityAt(hour) {
  const h = Number.isFinite(hour) ? ((Math.trunc(hour) % 24) + 24) % 24 : 0;
  if (h < 8) return 'sleeping';
  if (h < 11) return 'looking_outside';
  if (h < 14) return 'cooking';
  if (h < 18) return 'reading';
  if (h < 21) return 'gaming';
  return 'watching';
}

/**
 * 四段光：morning 05–10、day 11–16、dusk 17–19、night 20–04。
 * 只用来盖一层薄色罩；现有三张背景是画风变体，不按时段换图。
 */
export function phaseAtHour(hour) {
  const h = Number.isFinite(hour) ? ((Math.trunc(hour) % 24) + 24) % 24 : 0;
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

/**
 * 纪念品落到哪个固定位置：票根→书架、杯子→茶几、玩偶/挂件→沙发边、花草→窗台。
 * 认不出的仍放书架（不丢、不摆到地板上）。
 */
export function souvenirCategory(name) {
  const text = String(name ?? '');
  if (/(票根|门票|小票)/.test(text)) return 'ticket';
  if (/杯/.test(text)) return 'cup';
  if (/(玩偶|娃娃|公仔|挂件)/.test(text)) return 'doll';
  if (/(野花|花束|植物|绿植|盆栽|一束)/.test(text)) return 'plant';
  return 'shelf';
}

export class HomeRoomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HomeRoomError';
    this.code = code;
  }
}

const fail = (code, message) => { throw new HomeRoomError(code, message); };
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));
const round3 = (value) => Math.round(value * 1000) / 1000;

export function blankRoom() {
  return {
    version: 2,
    revision: 0,
    room: { activity: 'idle', since: null, source: 'default', note: '', plan: '' },
    art: { background: '', characters: {}, hotspots: [], foreground: '', painting: '' },
    placements: {},
    updatedAt: null,
  };
}

function hotspotShape(item) {
  return {
    id: item.id,
    x: item.x,
    y: item.y,
    label: item.label,
    ...(item.note ? { note: item.note } : {}),
  };
}

function placementShape(item) {
  return { x: item.x, y: item.y, scale: item.scale };
}

function charactersOf(characters) {
  const result = {};
  for (const activity of ACTIVITIES) {
    if (characters[activity]) result[activity] = characters[activity];
  }
  return result;
}

function placementsOf(placements) {
  const result = {};
  for (const activity of ACTIVITIES) {
    if (placements[activity]) result[activity] = placementShape(placements[activity]);
  }
  return result;
}

function roomOf(state) {
  return {
    activity: state.room.activity,
    since: state.room.since,
    source: state.room.source,
    note: state.room.note,
    // 空 plan 整条省略：老文件（没有这个键）读进来再写回去仍然合法、可比较。
    ...(state.room.plan ? { plan: state.room.plan } : {}),
  };
}

/** v2 的固定字段顺序：写盘和读盘对同一条记录必须逐字节一致，否则会被当成「被改过」。 */
function canonicalV2(state) {
  return {
    version: 2,
    revision: state.revision,
    room: roomOf(state),
    art: {
      background: state.art.background,
      characters: charactersOf(state.art.characters),
      hotspots: state.art.hotspots.map(hotspotShape),
      foreground: state.art.foreground,
      painting: state.art.painting,
    },
    placements: placementsOf(state.placements ?? {}),
    updatedAt: state.updatedAt,
  };
}

/** v1 的形状：没有 placements / foreground / painting，读旧文件时逐字节对得上。 */
function canonicalV1(state) {
  return {
    version: 1,
    revision: state.revision,
    room: roomOf(state),
    art: {
      background: state.art.background,
      characters: charactersOf(state.art.characters),
      hotspots: state.art.hotspots.map(hotspotShape),
    },
    updatedAt: state.updatedAt,
  };
}

function cleanNote(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') fail('INVALID_ROOM', '房间备注必须是文字。');
  const note = value.trim();
  if (note.length > MAX_NOTE) fail('INVALID_ROOM', `房间备注最多 ${MAX_NOTE} 个字。`);
  if (/[\u0000-\u001f\u007f]/u.test(note)) fail('INVALID_ROOM', '房间备注里不能有控制字符。');
  return note;
}

/** 「今天想做什么」：≤60 字；空串表示不写这个键（老文件继续逐字节合法）。 */
function cleanPlan(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') fail('INVALID_ROOM', '「今天想做什么」必须是文字。');
  const plan = value.trim();
  if (plan.length > MAX_PLAN) fail('INVALID_ROOM', `「今天想做什么」最多 ${MAX_PLAN} 个字。`);
  if (/[\u0000-\u001f\u007f]/u.test(plan)) fail('INVALID_ROOM', '「今天想做什么」里不能有控制字符。');
  return plan;
}

function cleanActivity(value) {
  if (!ACTIVITIES.includes(value)) fail('INVALID_ACTIVITY', '不认识这个活动。');
  return value;
}

function cleanHotspots(value) {
  if (!Array.isArray(value)) fail('INVALID_ROOM', '热点必须是一个列表。');
  if (value.length > MAX_HOTSPOTS) fail('LIMIT', `热点最多 ${MAX_HOTSPOTS} 个。`);
  const seen = new Set();
  return value.map((item) => {
    if (!isObject(item)) fail('INVALID_ROOM', '热点格式不对。');
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!HOTSPOT_ID.test(id) || seen.has(id)) fail('INVALID_ROOM', '热点 ID 只能是小写字母、数字和短横线，且不能重复。');
    seen.add(id);
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
      fail('INVALID_ROOM', '热点的位置必须是 0 到 1 之间的小数。');
    }
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 24) : '';
    const note = typeof item.note === 'string' ? item.note.trim().slice(0, MAX_HOTSPOT_NOTE) : '';
    if (/[\u0000-\u001f\u007f]/u.test(note)) fail('INVALID_ROOM', '热点那句里不能有控制字符。');
    return { id, x: round3(x), y: round3(y), label, ...(note ? { note } : {}) };
  });
}

/** 位置微调：只接受十个活动键；只存提交上来的（UI 负责只提交改过的）。 */
function cleanPlacements(value) {
  if (!isObject(value)) fail('INVALID_ROOM', '位置微调必须是一份对象。');
  const result = {};
  for (const [activity, placement] of Object.entries(value)) {
    if (!ACTIVITIES.includes(activity)) fail('INVALID_ROOM', '位置微调里有不认识的活动。');
    if (!isObject(placement)) fail('INVALID_ROOM', '位置微调格式不对。');
    const x = Number(placement.x);
    const y = Number(placement.y);
    const scale = Number(placement.scale);
    if (!Number.isFinite(x) || x < 0 || x > 1 || !Number.isFinite(y) || y < 0 || y > 1) {
      fail('INVALID_ROOM', '位置微调的 x/y 必须是 0 到 1 之间的小数。');
    }
    if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
      fail('INVALID_ROOM', `位置微调的缩放要在 ${MIN_SCALE} 到 ${MAX_SCALE} 之间。`);
    }
    result[activity] = { x: round3(x), y: round3(y), scale: round3(scale) };
  }
  return result;
}

function readState(raw) {
  if (!isObject(raw)) fail('DAMAGED_ROOM', '房间档案不是一份 JSON 对象。');
  if (raw.version !== 1 && raw.version !== 2) fail('DAMAGED_ROOM', '房间档案版本不认识。');
  if (!isObject(raw.room) || !isObject(raw.art) || !isObject(raw.art.characters)
    || !Array.isArray(raw.art.hotspots)) fail('DAMAGED_ROOM', '房间档案缺少字段。');
  const version = raw.version;
  const state = {
    version: 2,
    revision: raw.revision,
    room: {
      activity: raw.room.activity,
      since: raw.room.since,
      source: raw.room.source,
      note: raw.room.note ?? '',
      plan: raw.room.plan ?? '',
    },
    art: {
      background: raw.art.background ?? '',
      characters: raw.art.characters,
      hotspots: cleanHotspots(raw.art.hotspots),
      foreground: version === 2 ? raw.art.foreground ?? '' : '',
      painting: version === 2 ? raw.art.painting ?? '' : '',
    },
    placements: version === 2 ? cleanPlacements(raw.placements ?? {}) : {},
    updatedAt: raw.updatedAt ?? null,
  };
  const expected = version === 1 ? canonicalV1(state) : canonicalV2(state);
  if (JSON.stringify(expected) !== JSON.stringify(raw)) fail('DAMAGED_ROOM', '房间档案损坏，已保留原文件。');

  const okActivity = ACTIVITIES.includes(state.room.activity);
  const okSince = state.room.since === null || (Number.isFinite(state.room.since) && state.room.since > 0);
  const okRevision = Number.isSafeInteger(state.revision) && state.revision >= 0;
  const okSource = SOURCES.has(state.room.source);
  const okNote = typeof state.room.note === 'string' && state.room.note === state.room.note.trim()
    && state.room.note.length <= MAX_NOTE && !/[\u0000-\u001f\u007f]/u.test(state.room.note);
  const okPlan = typeof state.room.plan === 'string' && state.room.plan === state.room.plan.trim()
    && state.room.plan.length <= MAX_PLAN && !/[\u0000-\u001f\u007f]/u.test(state.room.plan);
  const okBackground = state.art.background === '' || REF.test(state.art.background);
  const okForeground = state.art.foreground === '' || REF.test(state.art.foreground);
  const okPainting = state.art.painting === '' || REF.test(state.art.painting);
  const okCharacters = Object.entries(state.art.characters)
    .every(([activity, ref]) => ACTIVITIES.includes(activity) && REF.test(ref));
  const okUpdated = state.updatedAt === null || (Number.isFinite(state.updatedAt) && state.updatedAt > 0);
  if (!okActivity || !okSince || !okRevision || !okSource || !okNote || !okPlan
    || !okBackground || !okForeground || !okPainting || !okCharacters || !okUpdated) {
    fail('DAMAGED_ROOM', '房间档案损坏，已保留原文件。');
  }
  return state;
}

async function readBounded(file) {
  let entry;
  try {
    entry = await lstat(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  if (!entry.isFile() || entry.size > MAX_ROOM_BYTES) fail('DAMAGED_ROOM', '房间档案无效或过大。');
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const bytes = Buffer.alloc(entry.size);
    let offset = 0;
    while (offset < bytes.length) {
      const part = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!part.bytesRead) fail('DAMAGED_ROOM', '房间档案在读取时被改动。');
      offset += part.bytesRead;
    }
    return bytes.toString('utf8');
  } finally {
    await handle.close();
  }
}

async function atomicWrite(file, text) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  let handle;
  let created = false;
  try {
    handle = await open(tmp, 'wx', 0o600);
    created = true;
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tmp, file);
  } catch (error) {
    await handle?.close().catch(() => {});
    if (created) await unlink(tmp).catch(() => {});
    throw error;
  }
}

export class HomeRoom {
  #dir;
  #file;
  #artDir;
  #now;

  constructor({ dataDir, now = () => Date.now() } = {}) {
    this.#dir = join(dataDir, 'fun', 'home');
    this.#file = join(this.#dir, 'room.json');
    this.#artDir = join(this.#dir, 'art');
    this.#now = now;
  }

  roomFile() { return this.#file; }
  artDir() { return this.#artDir; }

  /** 读盘；缺失 = 全新的空房间，坏文件 = 只读模式（绝不拿空状态覆盖）。 */
  async #load() {
    let text;
    try {
      text = await readBounded(this.#file);
    } catch (error) {
      if (error instanceof HomeRoomError) return { state: blankRoom(), damaged: true, warning: error.message };
      throw error;
    }
    if (text === null) return { state: blankRoom(), damaged: false, warning: '' };
    try {
      return { state: readState(JSON.parse(text)), damaged: false, warning: '' };
    } catch {
      return { state: blankRoom(), damaged: true, warning: '房间档案损坏，已保留原文件。' };
    }
  }

  #public(state) {
    const since = Number.isFinite(state.room.since) ? state.room.since : null;
    const elapsedMinutes = since === null ? null : Math.max(0, Math.floor((this.#now() - since) / 60000));
    return {
      version: 2,
      revision: state.revision,
      room: {
        activity: state.room.activity,
        label: ACTIVITY_LABELS[state.room.activity],
        hint: ACTIVITY_HINTS[state.room.activity],
        since,
        elapsedMinutes,
        note: state.room.note,
        plan: state.room.plan ?? '',
        source: state.room.source,
      },
      art: {
        background: state.art.background,
        characters: { ...state.art.characters },
        hotspots: state.art.hotspots.map((item) => ({ ...item })),
        foreground: state.art.foreground,
        painting: state.art.painting,
      },
      placements: placementsOf(state.placements ?? {}),
    };
  }

  async snapshot() {
    const { state, damaged, warning } = await this.#load();
    return { ...this.#public(state), damaged, warning };
  }

  /** 一张图的数据；没有这张就返回 null（缺图不是错误）。 */
  async readArt(slot, activity) {
    const { state } = await this.#load();
    let ref = '';
    if (slot === 'background') ref = state.art.background;
    else if (slot === 'foreground') ref = state.art.foreground;
    else if (slot === 'painting') ref = state.art.painting;
    else if (slot === 'character') ref = state.art.characters[activity] ?? state.art.characters.idle ?? '';
    else fail('INVALID_ROOM', '只支持背景、前景、画架和角色图。');
    if (!ref) return null;
    const path = join(this.#artDir, ref);
    let entry;
    try {
      entry = await lstat(path);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
    if (!entry.isFile() || entry.size > MAX_COVER_BYTES) fail('DAMAGED_ROOM', '这张图已经不可读了。');
    const stored = storedCover(ref, await readFile(path));
    return { dataUrl: stored.dataUrl, mime: stored.mime, bytes: stored.byteLength };
  }

  async #mutate(revision, mutate, { collect = true } = {}) {
    const { state, damaged, warning } = await this.#load();
    if (damaged) fail('DAMAGED_ROOM', warning || '房间档案损坏，已保留原文件；先修好它再改。');
    if (revision !== state.revision) fail('STALE_ROOM', '房间刚刚被改过，刷新后再试。');
    const draft = clone(state);
    const images = mutate(draft) ?? [];
    const next = canonicalV2({ ...draft, revision: state.revision + 1, updatedAt: this.#now() });
    await this.#write(next, images);
    if (collect) await this.#collect(next, state);
    // canonical 会省略空 plan；内存里的状态仍要有这个字段，面板才知道「没有」。
    return this.#public({ ...next, room: { ...next.room, plan: draft.room.plan ?? '' } });
  }

  async #write(state, images) {
    await mkdir(this.#artDir, { recursive: true });
    if (images.length) {
      const entries = await readdir(this.#artDir, { withFileTypes: true });
      const known = new Set(entries.filter((entry) => COVER_ID.test(entry.name)).map((entry) => entry.name));
      const additions = [...new Map(images.map((image) => [image.cover, image])).values()]
        .filter((image) => !known.has(image.cover));
      let total = additions.reduce((sum, image) => sum + image.bytes.length, 0);
      for (const entry of entries) {
        if (!entry.isFile()) fail('DAMAGED_ROOM', '素材目录里有不认识的条目。');
        total += (await lstat(join(this.#artDir, entry.name))).size;
      }
      if (known.size + additions.length > MAX_ART_FILES) fail('LIMIT', '房间素材数量到上限了。');
      if (total > MAX_ART_BYTES) fail('LIMIT', '房间素材总量到上限了。');
      for (const image of additions) {
        const handle = await open(join(this.#artDir, image.cover), 'wx', 0o600);
        try {
          await handle.writeFile(image.bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
      }
    }
    await atomicWrite(this.#file, JSON.stringify(state, null, 2));
  }

  /** 换图/清图之后把没人引用的旧文件删掉；只删素材目录里符合命名规则的文件。 */
  async #collect(next, previous) {
    const keep = new Set([
      next.art.background, next.art.foreground, next.art.painting,
      ...Object.values(next.art.characters),
    ].filter(Boolean));
    const before = new Set([
      previous.art.background, previous.art.foreground, previous.art.painting,
      ...Object.values(previous.art.characters),
    ].filter(Boolean));
    for (const ref of before) {
      if (keep.has(ref) || !REF.test(ref)) continue;
      await unlink(join(this.#artDir, ref)).catch(() => {});
    }
  }

  async setActivity(activity, { note, since, revision } = {}) {
    const id = cleanActivity(activity);
    const nextNote = note === undefined ? undefined : cleanNote(note);
    const at = Number.isFinite(since) && since > 0 ? since : this.#now();
    const { state } = await this.#load();
    const sameActivity = state.room.activity === id;
    const sameNote = nextNote === undefined || state.room.note === nextNote;
    if (sameActivity && sameNote && state.room.since !== null && state.room.source === 'panel') return this.#public(state);
    return this.#mutate(revision, (draft) => {
      draft.room.activity = id;
      draft.room.since = sameActivity ? (draft.room.since ?? at) : at;
      draft.room.source = 'panel';
      if (nextNote !== undefined) draft.room.note = nextNote;
    });
  }

  async setNote(note, revision) {
    const text = cleanNote(note);
    const { state } = await this.#load();
    if (state.room.note === text) return this.#public(state);
    return this.#mutate(revision, (draft) => { draft.room.note = text; });
  }

  /** 手写的「今天想做什么」：空串 = 清掉（文件里连这个键都不留）。 */
  async setPlan(plan, revision) {
    const text = cleanPlan(plan);
    const { state } = await this.#load();
    if (state.room.plan === text) return this.#public(state);
    return this.#mutate(revision, (draft) => { draft.room.plan = text; });
  }

  async setBackground(dataUrl, revision) {
    const image = decodeCover(dataUrl);
    return this.#mutate(revision, (draft) => {
      draft.art.background = image.cover;
      return [image];
    });
  }

  async clearBackground(revision) {
    const { state } = await this.#load();
    if (!state.art.background) return this.#public(state);
    return this.#mutate(revision, (draft) => { draft.art.background = ''; });
  }

  async setForeground(dataUrl, revision) {
    const image = decodeCover(dataUrl);
    return this.#mutate(revision, (draft) => {
      draft.art.foreground = image.cover;
      return [image];
    });
  }

  async clearForeground(revision) {
    const { state } = await this.#load();
    if (!state.art.foreground) return this.#public(state);
    return this.#mutate(revision, (draft) => { draft.art.foreground = ''; });
  }

  async setCharacter(activity, dataUrl, revision) {
    const id = cleanActivity(activity);
    const image = decodeCover(dataUrl);
    return this.#mutate(revision, (draft) => {
      draft.art.characters[id] = image.cover;
      return [image];
    });
  }

  async clearCharacter(activity, revision) {
    const id = cleanActivity(activity);
    const { state } = await this.#load();
    if (!state.art.characters[id]) return this.#public(state);
    return this.#mutate(revision, (draft) => { delete draft.art.characters[id]; });
  }

  async saveHotspots(hotspots, revision) {
    const list = cleanHotspots(hotspots ?? []);
    const { state } = await this.#load();
    if (JSON.stringify(state.art.hotspots) === JSON.stringify(list)) return this.#public(state);
    return this.#mutate(revision, (draft) => { draft.art.hotspots = list; });
  }

  async savePlacements(placements, revision) {
    const list = cleanPlacements(placements ?? {});
    const { state } = await this.#load();
    if (JSON.stringify(placementsOf(state.placements)) === JSON.stringify(placementsOf(list))) return this.#public(state);
    return this.#mutate(revision, (draft) => { draft.placements = list; });
  }

  /** 恢复默认：活动回「随时段变」、清备注/热点/位置；**图片保留**（素材不是状态）。 */
  async resetRoom(revision) {
    return this.#mutate(revision, (draft) => {
      draft.room.activity = 'idle';
      draft.room.since = this.#now();
      draft.room.source = 'default';
      draft.room.note = '';
      draft.art.hotspots = [];
      draft.placements = {};
    }, { collect: false });
  }
}