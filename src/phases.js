/**
 * 时段气氛：同一处地方，早上和晚上不是一回事。
 *
 * 这一层解决的问题：江边 06:00–23:30 开 17 个半小时，`desc` 却只有一段——
 * 清晨六点的江边和晚上十点的江边，光、人、声音全都不一样，写一套描写等于哪个都不像。
 *
 * 设计：
 *
 *   - 场所可以带 `phases`：一组 `{ key, label, from, to, desc, events?, areas? }`。
 *   - `from`/`to` 是 24 小时制的 HH:MM，**只在开放时段内切**，跨夜照常支持。
 *   - 没配 `phases` 的场所**完全不受影响**（向后兼容，20 处里只有几处需要分段）。
 *   - 取不到阶段时回落到场所原来的 `desc`，绝不空着。
 *
 * 为什么放在纯逻辑文件里：这一层要被「进门描写 / 随机事件 / 可逛项目 / 面板」四处共用，
 * 每处各算一遍时间迟早会算错。一处算、四处用。
 */

const norm = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** HH:MM → 当天第几分钟；坏值返回 null。 */
export function hmToMin(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * 把一个阶段区间展开成「开放时段内的分钟集合」，用来判断某一刻落在哪一段。
 *
 * 这里的难点是**跨夜**：夜市 17:30–01:00、KTV 18:00–02:00。
 * 举个真会踩的例子：夜市「深夜」段写 `from: '23:00', to: '01:00'`，
 * 直接比较 `23:00 <= now < 01:00` 永远为假——必须按「绕一圈」处理。
 *
 * 判据：`to <= from` 就是跨夜段，落在 `[from, 24:00) ∪ [00:00, to)`。
 */
export function phaseContains(phase, nowMin) {
  const from = hmToMin(phase?.from);
  const to = hmToMin(phase?.to);
  const m = Number(nowMin);
  if (from === null || to === null || !Number.isFinite(m)) return false;
  if (to <= from) return m >= from || m < to;   // 跨夜
  return m >= from && m < to;
}

/**
 * 这一处地方此刻处于哪个气氛阶段。
 *
 * 返回 `{ phase, index }`；没有 phases、或者都不命中时返回 `{ phase: null, index: -1 }`
 * ——调用方回落到场所的 `desc`。
 *
 * 阶段**按顺序取第一个命中的**，所以写数据时顺序就是优先级：
 * 把「深夜」「清晨」这种窄的先写，把「全天」这种宽的放最后。
 */
export function phaseAt(venue, nowMin) {
  const phases = Array.isArray(venue?.phases) ? venue.phases : [];
  for (let i = 0; i < phases.length; i += 1) {
    if (phaseContains(phases[i], nowMin)) return { phase: phases[i], index: i };
  }
  return { phase: null, index: -1 };
}

/**
 * 这一处的「此刻描写」：有阶段用阶段的，没有就用场所原本的。
 *
 * 这是所有调用方的唯一入口——**不要把 `venue.desc` 直接拿去用**，
 * 那样就绕过时段了。
 */
export function descNow(venue, nowMin) {
  const { phase } = phaseAt(venue, nowMin);
  const phaseDesc = norm(phase?.desc, 400);
  if (phaseDesc) return phaseDesc;
  return norm(venue?.desc, 400);
}

/**
 * 这一处此刻的随机事件池：阶段自带的**追加**在场所通用事件前面。
 *
 * 为什么是追加而不是替换：通用事件里有很多跟时段无关的（「老板多给了一串」），
 * 阶段事件是**额外**的时段专属内容，两者都要有，池子才是活的。
 * 阶段事件排前面，于是抽中时段专属内容的概率更高——这正是我们想要的。
 */
export function eventsNow(venue, nowMin) {
  const { phase } = phaseAt(venue, nowMin);
  const base = Array.isArray(venue?.randomEvents) ? venue.randomEvents : [];
  const extra = Array.isArray(phase?.events) ? phase.events.filter(Boolean) : [];
  return [...extra, ...base];
}

/**
 * 这一处此刻「还没去的」可逛项目。
 *
 * 阶段可以覆盖 `areas`（例如夜市白天只开一半摊位、澡堂深夜只有休息区）。
 * 阶段没写 `areas` 就用场所的全部。
 *
 * `visited` 是已经逛过的名字数组。
 */
export function areasNow(venue, nowMin, visited = []) {
  const { phase } = phaseAt(venue, nowMin);
  const pool = (Array.isArray(phase?.areas) && phase.areas.length)
    ? phase.areas
    : (Array.isArray(venue?.areas) ? venue.areas : []);
  const done = new Set(Array.isArray(visited) ? visited : []);
  const left = pool.filter((a) => !done.has(a));
  // 全逛完了就返回全部（让她还能再逛一遍，而不是「没得逛」）
  return left.length ? left : [...pool];
}

/** 这一处的阶段名（给回执和面板用），没有就返回空串。 */
export function phaseLabelAt(venue, nowMin) {
  return norm(phaseAt(venue, nowMin).phase?.label, 20);
}

/**
 * 数据自检：阶段写歪了要能查出来。
 *
 * 为什么需要：`phases` 是手写数据，`from`/`to` 打错一个字（比如 `'7:00'` 或 `'25:00'`）
 * 不会报错，只会**静默不命中**，于是那一处永远回落到整段 desc——功能看起来没生效，
 * 但没有任何报错指向哪里写错了。所以拿一个显式校验。
 */
export function checkPhases(venue) {
  const problems = [];
  const phases = venue?.phases;
  if (phases === undefined) return problems;      // 没配是合法的
  if (!Array.isArray(phases)) {
    problems.push('phases 必须是数组');
    return problems;
  }
  const seen = new Set();
  for (const [i, p] of phases.entries()) {
    const where = `${venue.name} 第 ${i + 1} 个阶段`;
    if (!p || typeof p !== 'object') { problems.push(`${where} 不是对象`); continue; }
    if (!norm(p.key, 30)) problems.push(`${where} 缺 key`);
    else if (seen.has(p.key)) problems.push(`${where} 的 key「${p.key}」重复`);
    else seen.add(p.key);
    if (!norm(p.label, 20)) problems.push(`${where} 缺 label`);
    if (hmToMin(p.from) === null) problems.push(`${where} 的 from「${p.from}」不是合法 HH:MM`);
    if (hmToMin(p.to) === null) problems.push(`${where} 的 to「${p.to}」不是合法 HH:MM`);
    if (!norm(p.desc, 400)) problems.push(`${where} 缺 desc（回执要靠它描写此刻）`);
    // 阶段必须落在开放时段内，否则永远命中不到。
    if (hmToMin(venue?.hours?.open) !== null && hmToMin(p.from) !== null) {
      // 这一条只报「完全不可能命中」的情形，不做严格的区间包含判断（跨夜太难判准）。
      const from = hmToMin(p.from);
      const to = hmToMin(p.to);
      if (from !== null && to !== null && from === to) {
        problems.push(`${where} 的 from 和 to 相同，等于零长度`);
      }
    }
  }
  return problems;
}
