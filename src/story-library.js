import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateStoryPack, storyAvailability, pickStory } from './story-packs.js';
import { BUILTIN_STORY_PACKS } from './story-examples.js';
import { hmToMin } from './phases.js';

const MAX_BYTES = 32768;
const MAX_PACKS = 20;
const plain = (pack) => { const { revision, ...content } = pack; return content; };
const BUILTINS = BUILTIN_STORY_PACKS.map((pack) => validateStoryPack(plain(pack))).filter((r) => r.ok).map((r) => r.pack);
const failure = (error, errors = [error]) => ({ ok: false, error, errors });

/** Original local content library. Construction is pure; load is explicit. */
export class StoryLibrary {
  constructor({ file, venues, visits = () => 0, nowMin = () => 0 }) {
    this.file = file;
    this.venues = venues;
    this.visits = visits;
    this.nowMin = nowMin;
    this.data = { version: 1, packs: [], disabledIds: [] };
    this.warnings = [];
    this.damagedSource = null;
  }

  async load() {
    this.data = { version: 1, packs: [], disabledIds: [] };
    this.warnings = [];
    this.damagedSource = null;
    let source;
    try {
      source = await readFile(this.file, 'utf8');
      if (Buffer.byteLength(source, 'utf8') > MAX_BYTES * (MAX_PACKS + 1)) throw new Error('剧情包文件过大');
      const raw = JSON.parse(source);
      if (!raw || raw.version !== 1 || !Array.isArray(raw.packs)) throw new Error('剧情包文件格式不受支持');
      const packs = [], ids = new Set();
      for (const value of raw.packs.slice(0, MAX_PACKS)) {
        const result = validateStoryPack(value);
        if (!result.ok || ids.has(result.pack.id)) {
          this.warnings.push('有一个无效或重复剧情包已跳过：' + (result.errors?.[0] || 'ID 重复'));
          continue;
        }
        ids.add(result.pack.id); packs.push(result.pack);
      }
      if (raw.packs.length > MAX_PACKS) this.warnings.push('超过 20 个自定义剧情包的部分未载入。');
      this.data = { version: 1, packs, disabledIds: [...new Set((Array.isArray(raw.disabledIds) ? raw.disabledIds : []).filter((id) => ids.has(id) || BUILTINS.some((p) => p.id === id)))] };
      if (this.warnings.length) this.damagedSource = source;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.warnings.push('剧情包文件未载入；内置剧情仍可用。' + (error?.message || '读取失败'));
        this.damagedSource = typeof source === 'string' ? source : null;
      }
    }
  }

  catalog() {
    const userIds = new Set(this.data.packs.map((pack) => pack.id));
    return [...this.data.packs.map((pack) => ({ pack, builtin: false })), ...BUILTINS.filter((pack) => !userIds.has(pack.id)).map((pack) => ({ pack, builtin: true }))]
      .map((row) => ({ ...row, enabled: !this.data.disabledIds.includes(row.pack.id) }));
  }

  list() {
    const venues = this.venues();
    return {
      ok: true,
      packs: this.catalog().map(({ pack, enabled, builtin }) => ({ id: pack.id, title: pack.title, description: pack.description || '', placeId: pack.placeId, revision: pack.revision, nodeCount: pack.nodes.length, enabled, builtin, ...storyAvailability(pack, venues) })),
      places: venues.map((v) => ({ id: v.id, name: v.name, areas: [...v.areas] })),
      warnings: [...this.warnings],
    };
  }

  parse(json) {
    if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > MAX_BYTES) return failure('请提供不超过 32 KB 的剧情包 JSON。');
    try { return validateStoryPack(JSON.parse(json)); }
    catch { return failure('JSON 格式不正确，请检查逗号、引号和括号。'); }
  }

  async save(next) {
    await mkdir(dirname(this.file), { recursive: true });
    if (this.damagedSource !== null) await writeFile(this.file + '.invalid-' + randomUUID() + '.bak', this.damagedSource, { encoding: 'utf8', flag: 'wx' });
    const serialized = { version: 1, packs: next.packs.map(plain), disabledIds: next.disabledIds };
    await writeFile(this.file + '.tmp', JSON.stringify(serialized, null, 2), 'utf8');
    await rename(this.file + '.tmp', this.file);
    this.data = next; this.warnings = []; this.damagedSource = null;
  }

  async act(args = {}) {
    const action = args.action || 'list';
    if (action === 'list') return this.list();
    if (action === 'template') {
      const venue = args.placeId ? this.venues().find((v) => v.id === args.placeId) : this.venues()[0];
      if (!venue) return failure('没有找到模板要绑定的地点。');
      const area = venue.areas[0], nextArea = venue.areas[1] || area;
      const template = { version: 1, id: 'my-outing', title: venue.name + '的一段小事', description: '可编辑的原创剧情模板', placeId: venue.id, start: 'notice', nodes: [
        { id: 'notice', area, event: '走到这里时，脚步慢了下来', prompt: '想多看一会儿，还是接着往前逛？', choices: [
          { id: 'stay', label: '再看一会儿', result: '决定再看一会儿', next: 'stay-end' },
          { id: 'walk', label: '接着逛', result: '决定接着去' + nextArea, next: 'walk-end' },
        ] },
        { id: 'stay-end', area, event: '又多停留了一会儿，才继续往前走' },
        { id: 'walk-end', area: nextArea, event: '顺着刚才选的方向走到了下一处' },
      ] };
      return { ok: true, json: JSON.stringify(template, null, 2) };
    }
    const row = this.catalog().find((x) => x.pack.id === args.id);
    if (action === 'validate' || action === 'preview' || action === 'import') {
      const result = args.json !== undefined ? this.parse(args.json) : row ? { ok: true, pack: row.pack } : failure('请先提供剧情包 JSON 或已有剧情包 ID。');
      if (!result.ok) return { ...result, error: result.errors?.join('；') || result.error || '剧情包校验失败。' };
      const pack = result.pack;
      const availability = storyAvailability(pack, this.venues());
      if (action === 'validate') return { ok: true, pack: plain(pack), warnings: availability.warnings, available: availability.available, errors: [] };
      if (action === 'preview') {
        const nowMin = args.time === undefined || args.time === '' ? this.nowMin() : hmToMin(args.time);
        if (nowMin === null) return failure('预览时间须为 HH:MM。');
        const venue = this.venues().find((v) => v.id === pack.placeId);
        const area = args.area || pack.nodes.find((n) => n.id === pack.start)?.area;
        const pick = venue ? pickStory([{ pack, enabled: true }], venue, area, nowMin, { storyProgress: [] }, this.visits(pack.placeId)) : null;
        return { ok: true, title: pack.title, eligible: Boolean(pick), warnings: availability.warnings, nodes: pack.nodes.map((n) => ({ id: n.id, area: n.area, event: n.event, when: n.when || {}, next: n.next || '', choices: (n.choices || []).map((c) => ({ id: c.id, label: c.label, next: c.next || '' })) })) };
      }
      const existing = this.data.packs.find((p) => p.id === pack.id);
      if (!existing && BUILTINS.some((p) => p.id === pack.id)) return failure('这个 ID 属于内置剧情包，请换一个自定义 ID。');
      if (existing && args.replace !== true) return failure('已有同 ID 剧情包；勾选明确覆盖后再导入。');
      if (!existing && this.data.packs.length >= MAX_PACKS) return failure('最多保存 20 个自定义剧情包，请先移除一个不用的包。');
      await this.save({ ...this.data, packs: [...this.data.packs.filter((p) => p.id !== pack.id), pack] });
      return { ok: true, id: pack.id, warnings: availability.warnings, message: '剧情包已导入。' };
    }
    if (!row) return failure('没有找到这个剧情包，请刷新清单。');
    if (action === 'export') return { ok: true, json: JSON.stringify(plain(row.pack), null, 2) };
    if (action === 'enable' || action === 'disable') {
      const disabled = new Set(this.data.disabledIds);
      if (action === 'disable') disabled.add(row.pack.id); else disabled.delete(row.pack.id);
      await this.save({ ...this.data, disabledIds: [...disabled] });
      return { ok: true, id: row.pack.id, message: action === 'disable' ? '剧情包已停用，已有经历保留。' : '剧情包已启用；满足条件后才会出现。' };
    }
    if (action === 'remove') {
      if (row.builtin) return failure('内置剧情包可以停用，不能移除。');
      await this.save({ ...this.data, packs: this.data.packs.filter((p) => p.id !== row.pack.id), disabledIds: this.data.disabledIds.filter((id) => id !== row.pack.id) });
      return { ok: true, id: row.pack.id, message: '已移除剧情包定义；旧行程和当时的选择保留。' };
    }
    return failure('不支持的剧情包操作。');
  }
}

export function storyResultText(result) {
  if (!result.ok) return result.error || (result.errors ?? []).join('；') || '剧情包操作失败。';
  if (result.json) return result.json;
  if (result.packs) return ['地点剧情包：', ...result.packs.map((p) => `- ${p.title}（${p.id}） · ${p.placeName || p.placeId} · ${p.enabled ? p.available ? '启用' : '暂不可用' : '停用'}${p.warnings.length ? '；' + p.warnings.join('；') : ''}`), ...(result.warnings ?? [])].join('\n');
  if (result.nodes) return [`预览：${result.title}（当前测试条件${result.eligible ? '可触发' : '未满足'}，不会推进真实行程）`, ...result.nodes.map((n) => `${n.id} · ${n.area}：${n.event}${n.choices.length ? '；' + n.choices.map((c) => c.label + ' → ' + (c.next || '结束')).join(' / ') : ' → ' + (n.next || '结束')}`), ...(result.warnings ?? [])].join('\n');
  return result.message || ['剧情包结构校验通过。', ...(result.warnings ?? [])].join('\n');
}
