/**
 * 用户自填地点：预设 20 处是代码里的常量，这里管「用户自己加的那些」。
 *
 * 设计（A 阶段 + B 阶段）：
 *
 *   - 预设场所的常量不动；用户的东西单独一份 `<dataDir>/fun/venues.json`，
 *     分两块：`venues`（自己新建的地方，id 前缀 `user-`）和
 *     `overrides`（**预设的覆盖层**，按预设 id 索引、只存改过的字段）。
 *   - 合并规则：**预设按 id 对齐 + 用户自己的追加**。用户改过的那一处以用户为准，
 *     但**预设升级带来的新内容照常生效**（合并而不是替换）——这是用户选的那条。
 *   - A 阶段只能新建自己的地点；B 阶段放开预设的编辑，但**预设不能删**
 *     （删了 20 处内置场所就少了，语义上应该是「恢复预设」）。
 *
 * 为什么合并而不是覆盖：预设以后还会加摊位/纪念品（0.1.4 就加过五处场所）。
 * 如果用户碰过漫展就把整个漫展锁死，那以后的新内容他永远看不到。
 * 合并的语义是「你的改动叠在预设上」，两边都能往前走。
 *
 * 为什么覆盖层是稀疏的：只存用户真改过的字段，预设升级时没碰过的字段
 * 自动跟着新版走。`cleanOverride` 负责把表单里的完整场所压成这份稀疏差异。
 *
 * 这一层是纯函数：不读盘、不写盘。World 负责 IO，这里只管合与校验。
 */

const TEXT = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** 用户自建地点的 id 前缀。撞不上预设的 id。 */
export const USER_PREFIX = 'user-';

/**
 * 允许用户改的字段（B 阶段对预设开放的就是这些）。
 *
 * 刻意不开放：`scene`（素材库正名，用户不知道库里有什么，硬填只会「库里没找到」）、
 * `phases`（手写的时段分段，编辑会破坏覆盖关系）、`kind`（大类，只影响筛选）。
 * 这几项永远来自预设 / 自填地点的默认值，合并时也不覆盖。
 */
export const OVERRIDABLE = [
  'name', 'aliases', 'tags', 'desc', 'hours', 'recommendedOutfit', 'crowd',
  'areas', 'souvenirs', 'photoSpots', 'randomEvents', 'food',
];

const CROWD_OK = new Set(['quiet', 'normal', 'packed']);

/** HH:MM 校验；返回原值或空串。 */
function cleanHm(v) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return '';
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function cleanList(v, maxItems, maxLen) {
  const arr = Array.isArray(v) ? v : [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const s = TEXT(item, maxLen);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** 场所 id 只允许小写字母数字和连字符，避免和预设或路径打架。 */
function cleanId(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(s)) return '';
  return s;
}

/**
 * 校验并清洗一个用户地点。返回 `{ venue, problems }`。
 *
 * 和预设的字段形状完全一致——这样下游（fun_go / 面板 / 时段）不用分两套逻辑。
 * `scene` 用户填不了：那是材库里的正名，用户不知道库里有什么，硬填只会「库里没找到」。
 * `phases` 也不开放（那是手写的十八段数据，B 阶段也不做——见 OVERRIDABLE 注释）。
 */
export function cleanUserVenue(raw, { requireId = true } = {}) {
  const problems = [];
  if (!raw || typeof raw !== 'object') return { venue: null, problems: ['不是一个对象'] };

  let id = cleanId(raw.id);
  if (requireId && !id) problems.push('id 只能用英文小写、数字和连字符');
  if (id && !id.startsWith(USER_PREFIX)) id = `${USER_PREFIX}${id}`;

  const name = TEXT(raw.name, 40);
  if (!name) problems.push('名字不能空');

  const hours = raw.hours && typeof raw.hours === 'object' ? raw.hours : {};
  const open = cleanHm(hours.open) || '09:00';
  const close = cleanHm(hours.close) || '21:00';
  if (raw.hours && (!cleanHm(hours.open) || !cleanHm(hours.close))) {
    problems.push('开放时段要写成 HH:MM，例如 09:00 / 21:00');
  }
  if (open === close) problems.push('开门和关门时间不能一样');

  const areas = cleanList(raw.areas, 30, 40);
  if (!areas.length) problems.push('至少要写一处能逛的');

  const crowd = CROWD_OK.has(raw.crowd) ? raw.crowd : 'normal';

  // food：允许用户自己写「这儿能喝什么」，但**只写品类名，不写味道**——
  // 味道归鱼的每一天。这里不拦用户写味道（那是他的自由），但会在面板上提示。
  let food = null;
  if (raw.food && typeof raw.food === 'object') {
    const verb = raw.food.verb === '喝' ? '喝' : (raw.food.verb === '吃' ? '吃' : '');
    const items = cleanList(raw.food.items, 20, 30);
    if (verb && items.length) {
      food = { label: verb === '喝' ? '喝的' : '吃的', items, verb };
    }
  }

  if (problems.length) return { venue: null, problems };

  return {
    venue: {
      id,
      kind: 'custom',
      name,
      aliases: cleanList(raw.aliases, 8, 40),
      tags: cleanList(raw.tags, 10, 20),
      desc: TEXT(raw.desc, 400) || `${name}：这样一个地方。`,
      // 用户不知道素材库里有什么，一律不给 scene（等于「库里没有」，下游会明说不用填）。
      scene: '',
      recommendedOutfit: TEXT(raw.recommendedOutfit, 40),
      crowd,
      hours: { open, close },
      areas,
      souvenirs: cleanList(raw.souvenirs, 20, 40),
      photoSpots: cleanList(raw.photoSpots, 20, 60),
      randomEvents: cleanList(raw.randomEvents, 20, 120),
      ...(food ? { food } : {}),
    },
    problems: [],
  };
}

/**
 * 把 overrides 对象展开成「带预设 id 的稀疏条目」，喂给合并逻辑。
 *
 * 只认 OVERRIDABLE 白名单字段；`scene` / `phases` / `kind` 永远不覆盖。
 * 稀疏条目的 id 就是预设 id，于是会命中 `mergeVenues` 的「逐字段叠加」分支，
 * 而不是被当成新场所追加。
 */
export function overrideEntries(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return [];
  const out = [];
  for (const [id, fields] of Object.entries(overrides)) {
    if (!id || !fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    const entry = { id };
    for (const key of OVERRIDABLE) {
      if (key in fields) entry[key] = fields[key];
    }
    out.push(entry);
  }
  return out;
}

/**
 * 把用户地点与预设覆盖层合进预设。
 *
 * 规则（用户选的那条：预设更新照常生效、我的改动优先）：
 *   1. 预设里没有用户这个 id → 追加到末尾（用户自建的新地方）。
 *   2. 预设里有这个 id（用户改了预设里的某处，B 阶段开放）→ **逐字段叠加**：
 *      用户写了的字段用它，没写的仍用预设的。于是预设给漫展加了两个新摊位，
 *      用户改过漫展也能拿到（只要他没自己写 `areas`）。
 *   3. 用户数据的形状异常 → 跳过那一条，绝不影响预设。
 *
 * @param {object[]} presets   预设场所
 * @param {object[]} users     用户自建地点（已校验过的完整场所）
 * @param {object}   overrides 预设覆盖层 `{ [presetId]: {字段: 值} }`（稀疏，可选）
 */
export function mergeVenues(presets, users, overrides) {
  const base = Array.isArray(presets) ? presets : [];
  const extra = [
    ...(Array.isArray(users) ? users : []),
    ...overrideEntries(overrides),
  ].filter((u) => u && typeof u === 'object' && u.id);
  if (!extra.length) return [...base];

  const byId = new Map(extra.map((u) => [u.id, u]));
  const out = [];
  for (const p of base) {
    const u = byId.get(p.id);
    if (!u) { out.push(p); continue; }
    byId.delete(p.id);
    const merged = { ...p };
    for (const key of OVERRIDABLE) {
      if (u[key] === undefined) continue;
      merged[key] = u[key];
    }
    out.push(merged);
  }
  // 剩下的是预设里没有的：用户自建的新地方，按名字排序追加在后面。
  const rest = [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return [...out, ...rest];
}

/**
 * 一份空白的「新地点」骨架，给面板的表单用着方便。
 * 不含 id（由面板那边根据名字生成或让用户填）。
 */
export function blankVenue() {
  return {
    name: '',
    aliases: [],
    tags: [],
    desc: '',
    hours: { open: '09:00', close: '21:00' },
    recommendedOutfit: '',
    crowd: 'normal',
    areas: [],
    souvenirs: [],
    photoSpots: [],
    randomEvents: [],
  };
}

/**
 * 从名字生成一个可用的 id。
 *
 * 中文名没法直接当 id（cleanId 只认英数），所以退回「用序号 + 拼音首字母」不现实，
 * 直接用 `user-` + 一个短哈希。同一个名字永远得到同一个 id，避免重复添加。
 */
export function idFromName(name, existingIds = []) {
  const s = TEXT(name, 40);
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  const base = `${USER_PREFIX}${hash.toString(36)}`;
  if (!existingIds.includes(base)) return base;
  // 撞了就加后缀（极少发生，但绝不返回一个已存在的 id）。
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// B 阶段：预设覆盖层（稀疏差异）
// ---------------------------------------------------------------------------

/**
 * 把面板表单提交的「完整场所」压成一份**稀疏覆盖层**：只留用户真改过的字段。
 *
 * 为什么稀疏：`mergeVenues` 是逐字段叠加的，覆盖层里没写的字段仍从预设取。
 * 于是预设以后给漫展加了新摊位、改了通用描写，没碰过这些字段的用户照样能拿到。
 * 如果这里把整处场所存下来，等于把这一处锁死在旧版预设上。
 *
 * 复用 `cleanUserVenue` 的校验与清洗（HH:MM、列表去重限长、food 只认吃/喝），
 * 但只取 OVERRIDABLE 字段——`id` / `kind` / `scene` / `phases` 一律不带：
 *   - `scene` 是素材库正名，用户不知道库里有什么；
 *   - `phases` 是手写的时段分段，编辑通用字段不该把它冲掉（面板会提示这一点）。
 *
 * @param {object} raw    表单提交的完整场所（带预设 id）
 * @param {object} preset 这一处的预设场所
 * @returns {{ fields: object, problems: string[] }} fields 为空表示「跟预设一模一样」
 */
export function cleanOverride(raw, preset) {
  const problems = [];
  if (!preset || typeof preset !== 'object' || !preset.id) {
    return { fields: {}, problems: ['找不到这处预设'] };
  }
  // 借 cleanUserVenue 做校验：它要求 name / areas 非空、hours 合法。
  const { venue, problems: vp } = cleanUserVenue(raw, { requireId: false });
  if (!venue) return { fields: {}, problems: vp };

  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const fields = {};
  for (const key of OVERRIDABLE) {
    // food 在预设里可能是 undefined；统一按 null 比较，避免形状差异被当成改动。
    const now = key === 'food' ? (venue.food ?? null) : venue[key];
    const was = key === 'food' ? (preset.food ?? null) : preset[key];
    if (!same(now, was)) fields[key] = now;
  }
  return { fields, problems: [] };
}

/**
 * venues.json 的读取：统一成 `{ venues, overrides }`。
 *
 * 兼容 A 阶段写下的旧格式：顶层数组，或只有 `{ venues: [...] }` 没有 overrides。
 * 坏文件、坏字段一律当空，绝不抛错（降级是第一公民）。
 */
export function parseVenueFile(raw) {
  const src = Array.isArray(raw) ? { venues: raw } : (raw && typeof raw === 'object' ? raw : {});
  const venues = [];
  if (Array.isArray(src.venues)) {
    for (const item of src.venues) {
      const { venue } = cleanUserVenue(item, { requireId: false });
      if (venue && String(venue.id).startsWith(USER_PREFIX)) venues.push(venue);
    }
  }
  const overrides = {};
  if (src.overrides && typeof src.overrides === 'object' && !Array.isArray(src.overrides)) {
    for (const [id, fields] of Object.entries(src.overrides)) {
      if (!id || String(id).startsWith(USER_PREFIX)) continue;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
      const clean = {};
      for (const key of OVERRIDABLE) {
        if (key in fields) clean[key] = fields[key];
      }
      if (Object.keys(clean).length) overrides[id] = clean;
    }
  }
  return { venues, overrides };
}

/** venues.json 的落盘形状。保持简单可读，便于手改排查。 */
export function stringifyVenueFile({ venues, overrides }) {
  return `${JSON.stringify({ venues, overrides }, null, 2)}\n`;
}

/** 这个 id 是不是某处预设（用于拦截「删除预设」）。 */
export function isPresetId(presets, id) {
  return Array.isArray(presets) && presets.some((v) => v.id === id);
}
