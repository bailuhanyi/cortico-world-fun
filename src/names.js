/** 名称解析只负责找候选：唯一命中后始终使用清单正名落盘。 */
export function resolveName(list, input) {
  const wanted = typeof input === 'string' ? input.trim() : '';
  const names = [...new Set((Array.isArray(list) ? list : []).filter((x) => typeof x === 'string' && x))];
  if (!wanted) return { name: null, candidates: [] };
  if (names.includes(wanted)) return { name: wanted, candidates: [wanted] };
  const candidates = names.filter((x) => x.includes(wanted) || wanted.includes(x));
  return { name: candidates.length === 1 ? candidates[0] : null, candidates };
}
