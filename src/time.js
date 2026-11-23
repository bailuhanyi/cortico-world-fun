/**
 * 时间口径的唯一出处：HH:MM ↔ 分钟数。
 *
 * 以前 `phases.js` 与 `venues.js` 各抄了一份 `hmToMin`（连注释都一样），
 * 改一处漏一处只是时间问题；这里留一份，两个模块只负责转出。
 */

/** HH:MM → 当天第几分钟；坏值（含 24:00、9:60、空）返回 null。 */
export function hmToMin(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}