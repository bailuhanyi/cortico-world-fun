import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateStoryPack, storyAvailability, pickStory } from './story-packs.js';
import { BUILTIN_STORY_PACKS } from './story-examples.js';
import { RETIRED_SAMPLE_STORY_ID } from './creek-letter.js';
import { hmToMin } from './phases.js';

const MAX_BYTES = 32768;
const MAX_PACKS = 20;
const plain = (pack) => { const { revision, ...content } = pack; return content; };
export const STORY_PRESET_MIGRATION = 'removePresetStories033';
export const PROMOTED_STORY_MIGRATION = 'promoteSelectedStories033';
export const PROMOTED_STORY_IDS = Object.freeze(['foldtide-reply-lite', 'drizzled-list']);
export const ADDITIONAL_STORY_MIGRATION = 'promoteBridgeEchoAndSwappedPlaque';
export const ADDITIONAL_STORY_IDS = Object.freeze(['bridge-echo-solo', 'swapped-plaque-riddle']);
const builtinById = new Map(BUILTIN_STORY_PACKS.map((pack) => [pack.id, pack]));
export const RETIRED_STORY_IDS = Object.freeze([
  'riverside-late-lights', 'market-last-lantern', 'con-poster-hour', 'duo-cafe-date', RETIRED_SAMPLE_STORY_ID,
]);
const retiredIds = new Set(RETIRED_STORY_IDS);
const migrationsOf = (raw) => raw?.migrations && typeof raw.migrations === 'object' && !Array.isArray(raw.migrations) ? raw.migrations : {};

/** Back up exact bytes before any change, including recording a no-match migration.
 * Keep non-target rows and unknown fields intact; normal validation happens later.
 * The optional IO adapter lets failure handling be verified without OS-specific ACLs.
 */
export async function migrateStoryPresets(file, raw, source, io = { writeFile, rename }) {
  if (migrationsOf(raw)[STORY_PRESET_MIGRATION] === true) return { raw, backupFile: null };
  const next = { ...raw,
    packs: raw.packs.filter((pack) => !retiredIds.has(pack?.id)),
    ...(Array.isArray(raw.disabledIds) ? { disabledIds: raw.disabledIds.filter((id) => !retiredIds.has(id)) } : {}),
    migrations: { ...migrationsOf(raw), [STORY_PRESET_MIGRATION]: true },
  };
  const backupFile = file + '.r4-presets-' + randomUUID() + '.bak';
  await io.writeFile(backupFile, source, { encoding: 'utf8', flag: 'wx' });
  const temporary = file + '.r4-presets-' + randomUUID() + '.tmp';
  try {
    await io.writeFile(temporary, JSON.stringify(next, null, 2), { encoding: 'utf8', flag: 'wx' });
    await io.rename(temporary, file);
  } finally { await (io.rm ?? rm)(temporary, { force: true }).catch(() => {}); }
  return { raw: next, backupFile };
}

/** Remove only byte-equivalent authored copies promoted to built-ins; changed same-ID user works survive. */
export async function migratePromotedStoryCopies(file, raw, source, io = { writeFile, rename }, options = {}) {
  const migrationKey = options.migrationKey ?? PROMOTED_STORY_MIGRATION;
  const candidateIds = new Set(options.storyIds ?? PROMOTED_STORY_IDS);
  if (migrationsOf(raw)[migrationKey] === true) return { raw, backupFile: null, removedIds: [] };
  const removedIds = [];
  const packs = raw.packs.filter((pack) => {
    const builtin = candidateIds.has(pack?.id) ? builtinById.get(pack.id) : null;
    if (!builtin) return true;
    const validated = validateStoryPack(pack);
    if (!validated.ok || validated.pack.revision !== builtin.revision) return true;
    removedIds.push(pack.id);
    return false;
  });
  const next = { ...raw, packs, migrations: { ...migrationsOf(raw), [migrationKey]: true } };
  const prefix = migrationKey === PROMOTED_STORY_MIGRATION ? '.promoted-stories-033-' : `.${migrationKey}-`;
  const backupFile = file + prefix + randomUUID() + '.bak';
  await io.writeFile(backupFile, source, { encoding: 'utf8', flag: 'wx' });
  const temporary = file + prefix + randomUUID() + '.tmp';
  try {
    await io.writeFile(temporary, JSON.stringify(next, null, 2), { encoding: 'utf8', flag: 'wx' });
    await io.rename(temporary, file);
  } finally { await (io.rm ?? rm)(temporary, { force: true }).catch(() => {}); }
  return { raw: next, backupFile, removedIds };
}
const failure = (error, errors = [error]) => ({ ok: false, error, errors });

/** Original local content library. Construction is pure; load is explicit. */
export class StoryLibrary {
  constructor({ file, venues, visits = () => 0, nowMin = () => 0, nodeLimit = () => 16, migrationIo = { writeFile, rename } }) {
    this.file = file;
    this.venues = venues;
    this.visits = visits;
    this.nowMin = nowMin;
    this.nodeLimit = nodeLimit;
    this.migrationIo = migrationIo;
    this.data = { version: 1, packs: [], disabledIds: [], migrations: { [STORY_PRESET_MIGRATION]: true, [PROMOTED_STORY_MIGRATION]: true, [ADDITIONAL_STORY_MIGRATION]: true } };
    this.warnings = [];
    this.damagedSource = null;
    this.migration = { complete: true, backupFile: null, backupFiles: [], error: null };
  }

  async load() {
    this.data = { version: 1, packs: [], disabledIds: [], migrations: { [STORY_PRESET_MIGRATION]: true, [PROMOTED_STORY_MIGRATION]: true, [ADDITIONAL_STORY_MIGRATION]: true } };
    this.warnings = [];
    this.damagedSource = null;
    this.migration = { complete: true, backupFile: null, backupFiles: [], error: null };
    let source;
    try {
      source = await readFile(this.file, 'utf8');
      if (Buffer.byteLength(source, 'utf8') > MAX_BYTES * (MAX_PACKS + 1)) throw new Error('剧情包文件过大');
      let raw = JSON.parse(source);
      if (!raw || raw.version !== 1 || !Array.isArray(raw.packs)) throw new Error('剧情包文件格式不受支持');
      const backupFiles = [];
      try {
        const retired = await migrateStoryPresets(this.file, raw, source, this.migrationIo);
        raw = retired.raw;
        if (retired.backupFile) backupFiles.push(retired.backupFile);
        const currentBytes = await readFile(this.file, 'utf8');
        const promoted = await migratePromotedStoryCopies(this.file, raw, currentBytes, this.migrationIo);
        raw = promoted.raw;
        if (promoted.backupFile) backupFiles.push(promoted.backupFile);
        const additionalSource = await readFile(this.file, 'utf8');
        const additional = await migratePromotedStoryCopies(this.file, raw, additionalSource, this.migrationIo,
          { migrationKey: ADDITIONAL_STORY_MIGRATION, storyIds: ADDITIONAL_STORY_IDS });
        raw = additional.raw;
        if (additional.backupFile) backupFiles.push(additional.backupFile);
        this.migration = { complete: true, backupFile: backupFiles[0] ?? null, backupFiles, error: null };
      } catch {
        this.migration = { complete: false, backupFile: backupFiles[0] ?? null, backupFiles, error: '故事包迁移的备份或写入失败；原文件备份已保留，修复存储后重启再试。' };
        this.warnings.push(this.migration.error);
      }
      const packs = [], ids = new Set();
      for (const value of raw.packs.slice(0, MAX_PACKS)) {
        // The preference limits new authoring/imports; changing it never disables saved stories.
        const result = validateStoryPack(value, { maxNodes: 0 });
        if (!result.ok || ids.has(result.pack.id)) {
          this.warnings.push('有一个无效或重复剧情包已跳过：' + (result.errors?.[0] || 'ID 重复'));
          continue;
        }
        ids.add(result.pack.id); packs.push(result.pack);
      }
      if (raw.packs.length > MAX_PACKS) this.warnings.push('超过 20 个自定义剧情包的部分未载入。');
      const validIds = new Set([...ids, ...BUILTIN_STORY_PACKS.map((pack) => pack.id)]);
      this.data = { version: 1, packs, disabledIds: [...new Set((Array.isArray(raw.disabledIds) ? raw.disabledIds : []).filter((id) => validIds.has(id)))], migrations: { ...migrationsOf(raw) } };
      if (this.warnings.length) this.damagedSource = source;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.warnings.push('剧情包文件未载入；作者功能仍可用。' + (error?.message || '读取失败'));
        this.damagedSource = typeof source === 'string' ? source : null;
      }
    }
  }

  catalog() {
    const builtins = BUILTIN_STORY_PACKS.map((pack) => ({
      pack, builtin: true, enabled: !this.data.disabledIds.includes(pack.id),
    }));
    return [...builtins, ...this.data.packs.map((pack) => ({ pack, builtin: false, enabled: !this.data.disabledIds.includes(pack.id) }))];
  }

  list() {
    const venues = this.venues();
    return {
      ok: true,
      packs: this.catalog().map(({ pack, enabled, builtin }) => ({ id: pack.id, title: pack.title, description: pack.metadata?.synopsis ?? '', placeId: pack.placeId, revision: pack.revision, formatVersion: pack.version, metadata: pack.metadata ? { ...pack.metadata } : null, durationMinutes: pack.metadata?.durationMinutes ?? null, nodeCount: pack.nodes?.length ?? 0, enabled, builtin, ...storyAvailability(pack, venues) })),
      places: venues.map((v) => ({ id: v.id, name: v.name, areas: [...v.areas] })),
      warnings: [...this.warnings],
      migration: { ...this.migration },
    };
  }

  parse(json) {
    if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > MAX_BYTES) return failure('请提供不超过 32 KB 的剧情包 JSON。');
    try { return validateStoryPack(JSON.parse(json), { maxNodes: this.nodeLimit() }); }
    catch { return failure('JSON 格式不正确，请检查逗号、引号和括号。'); }
  }

  async save(next) {
    if (this.migration.error) throw new Error(this.migration.error);
    await mkdir(dirname(this.file), { recursive: true });
    if (this.damagedSource !== null) await writeFile(this.file + '.invalid-' + randomUUID() + '.bak', this.damagedSource, { encoding: 'utf8', flag: 'wx' });
    const migrations = { ...migrationsOf(next), [STORY_PRESET_MIGRATION]: true, [PROMOTED_STORY_MIGRATION]: true, [ADDITIONAL_STORY_MIGRATION]: true };
    const serialized = { version: 1, packs: next.packs.map(plain), disabledIds: next.disabledIds, migrations };
    await writeFile(this.file + '.tmp', JSON.stringify(serialized, null, 2), 'utf8');
    await rename(this.file + '.tmp', this.file);
    this.data = { ...next, migrations }; this.warnings = []; this.damagedSource = null;
  }

  async act(args = {}) {
    const action = args.action || 'list';
    if (action === 'list') return this.list();
    if (action === 'template') {
      const venue = args.placeId ? this.venues().find((v) => v.id === args.placeId) : this.venues()[0];
      if (!venue) return failure('没有找到模板要绑定的地点。');
      if (args.mode === 'free') return { ok: true, json: JSON.stringify(freeTemplate(venue), null, 2) };
      const area = venue.areas[0], nextArea = venue.areas[1] || area;
      const template = { version: 2, id: 'my-outing', title: venue.name + '的一段小事', description: '可编辑的原创剧情模板',
        metadata: { author: '本地作者', release: '1.0.0', genre: '日常', synopsis: '在这里停留片刻，再选择接下来想走的方向。', participation: 'solo', requirements: [] },
        placeId: venue.id, start: 'notice', nodes: [
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
    if (action === 'validate' || action === 'preview' || action === 'playtest' || action === 'import') {
      const result = args.json !== undefined ? this.parse(args.json) : row ? { ok: true, pack: row.pack } : failure('请先提供剧情包 JSON 或已有剧情包 ID。');
      if (!result.ok) return { ...result, error: result.errors?.join('；') || result.error || '剧情包校验失败。' };
      let pack = result.pack;
      // 包里写的地点本地没有时，允许在同一步里把它绑到已有地点：玩家不用手改 JSON，
      // 也不会再出现「导入成功、永远不触发」的死包。
      const bindPlaceId = typeof args.bindPlaceId === 'string' ? args.bindPlaceId.trim() : '';
      if (bindPlaceId) {
        const target = this.venues().find((v) => v.id === bindPlaceId);
        if (!target) return failure('要绑定的地点已经不在地点册里，请刷新后再选。');
        if (!this.venues().some((v) => v.id === pack.placeId)) {
          const rebound = validateStoryPack({ ...plain(pack), placeId: target.id }, { maxNodes: 0 });
          if (!rebound.ok) return { ...failure(rebound.errors?.[0] || '绑定地点后校验失败。'), errors: rebound.errors };
          pack = rebound.pack;
        }
      }
      const availability = storyAvailability(pack, this.venues());
      if (action === 'validate') return { ok: true, pack: plain(pack), warnings: availability.warnings, available: availability.available, placeMissing: availability.placeMissing, errors: [] };
      if (action === 'preview') {
        if (pack.version === 3) return { ok: true, free: true, title: pack.title, eligible: availability.available, placeMissing: availability.placeMissing, warnings: availability.warnings,
          setting: { premise: pack.setting.premise, canon: [...pack.setting.canon], opening: pack.setting.opening,
            cast: pack.setting.cast.map(({ name }) => name), locations: pack.setting.locations.map(({ name }) => name),
            ends: pack.setting.ends.map(({ text }) => text) } };
        const nowMin = args.time === undefined || args.time === '' ? this.nowMin() : hmToMin(args.time);
        if (nowMin === null) return failure('预览时间须为 HH:MM。');
        const venue = this.venues().find((v) => v.id === pack.placeId);
        const area = args.area || pack.nodes.find((n) => n.id === pack.start)?.area;
        const pick = venue ? pickStory([{ pack, enabled: true }], venue, area, nowMin, { storyProgress: [] }, this.visits(pack.placeId)) : null;
        return { ok: true, title: pack.title, eligible: Boolean(pick), placeMissing: availability.placeMissing, warnings: availability.warnings, nodes: pack.nodes.map((n) => ({ id: n.id, area: n.area, event: n.event, when: n.when || {}, next: n.next || '', choices: (n.choices || []).map((c) => ({ id: c.id, label: c.label, next: c.next || '' })) })) };
      }
      if (action === 'playtest') {
        if (pack.version === 3) return { ok: true, playtest: true, title: pack.title, sideEffects: false,
          path: [{ event: pack.setting.opening }], current: null, complete: false };
        const path = Array.isArray(args.path) ? args.path : [];
        if (path.length > pack.nodes.length || path.some((id) => typeof id !== 'string' || id.length > 24)) return failure('试玩路径无效或超过故事节点数。');
        const byId = new Map(pack.nodes.map((node) => [node.id, node]));
        const played = [];
        let node = byId.get(pack.start);
        // Deterministic narration has no choice to submit. Consume it within this
        // isolated replay, retaining the last terminal event for display.
        const narrate = () => {
          while (node && !node.choices) {
            played.push({ nodeId: node.id, area: node.area, event: node.event });
            if (!node.next) break;
            node = byId.get(node.next);
          }
        };
        narrate();
        for (const optionId of path) {
          if (!node?.choices) return failure('当前试玩已经结束，不能继续选择。');
          const option = node.choices.find((item) => item.id === optionId);
          if (!option) return failure('试玩选项与当前节点不匹配，请从当前节点重新开始。');
          played.push({ nodeId: node.id, event: node.event, optionId: option.id, option: option.label, result: option.result });
          node = option.next ? byId.get(option.next) : null;
          narrate();
        }
        return { ok: true, playtest: true, title: pack.title, sideEffects: false, path: played,
          current: node ? { id: node.id, area: node.area, event: node.event, prompt: node.prompt ?? node.event,
            options: (node.choices ?? []).map(({ id, label }) => ({ id, label })) } : null,
          complete: !node || !node.choices };
      }
      const existing = this.data.packs.find((p) => p.id === pack.id);
      if (builtinById.has(pack.id)) {
        const builtin = builtinById.get(pack.id);
        if (builtin.revision === pack.revision) return failure('这个作品已随插件内置，无需再导入；可在列表中直接游玩或停用。');
        return failure('这个标识已被内置作品占用，请换一个新的故事标识。');
      }
      if (existing && args.replace !== true) return failure('已有同 ID 剧情包；勾选明确覆盖后再导入。');
      if (!existing && this.data.packs.length >= MAX_PACKS) return failure('最多保存 20 个自定义剧情包，请先移除一个不用的包。');
      // 地点不存在的包收进来只会「一直判定失效」：当场拒收，并给出两条可走的路。
      if (availability.placeMissing) {
        return {
          ok: false, placeMissing: true, placeId: availability.placeId,
          error: `这个包绑定的地点「${availability.placeId}」在地点册里没有。先在地点册新建这处，或导入时把它绑到已有地点。`,
          errors: [availability.warnings[0]],
        };
      }
      await this.save({ ...this.data, packs: [...this.data.packs.filter((p) => p.id !== pack.id), pack] });
      return { ok: true, id: pack.id, placeId: pack.placeId, warnings: availability.warnings, message: '剧情包已导入。' };
    }
    if (!row) return failure('没有找到这个剧情包，请刷新清单。');
    if (action === 'rebind') {
      if (row.builtin) return failure('内置故事不能改绑；想换地点可以先「导出 JSON」，改好再作为自己的作品导入。');
      const target = typeof args.placeId === 'string' ? args.placeId.trim() : '';
      if (!target) return failure('请选择要绑定到哪处地点。');
      const venue = this.venues().find((v) => v.id === target);
      if (!venue) return failure('这处地点已经不在地点册里，请刷新后再选。');
      if (row.pack.placeId === target) {
        return { ok: true, id: row.pack.id, placeId: target, unchanged: true, available: storyAvailability(row.pack, this.venues()).available, message: `「${row.pack.title}」本来就绑在「${venue.name}」上，没有改动。` };
      }
      const rebound = validateStoryPack({ ...plain(row.pack), placeId: target }, { maxNodes: 0 });
      if (!rebound.ok) return { ...failure(rebound.errors?.[0] || '绑定地点后校验失败。'), errors: rebound.errors };
      await this.save({ ...this.data, packs: [...this.data.packs.filter((p) => p.id !== row.pack.id), rebound.pack] });
      const availability = storyAvailability(rebound.pack, this.venues());
      return {
        ok: true, id: rebound.pack.id, placeId: target, revision: rebound.pack.revision,
        available: availability.available, warnings: availability.warnings,
        message: `已把「${row.pack.title}」绑到「${venue.name}」。`,
      };
    }
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
  if (result.playtest) return [`隔离试玩：${result.title}（${result.complete ? '已结束' : '等待选择'}；不会保存故事、行程、回忆或解锁）`,
    ...result.path.map((step) => `${step.event}${step.option ? `；选择：${step.option}；${step.result}` : ''}`),
    ...(result.current && !result.complete ? [result.current.event, result.current.prompt,
      ...result.current.options.map((option) => `- ${option.id}：${option.label}`)] : [])].join('\n');
  if (result.free) return [`自由模式预览：${result.title}（当前条件${result.eligible ? '可开始' : '未满足'}；不写盘）`,
    result.setting.premise, `正史：${result.setting.canon.join('；')}`,
    result.setting.cast.length ? `人物：${result.setting.cast.join('、')}` : '',
    result.setting.ends.length ? `可能的收尾：${result.setting.ends.join('、')}` : '',
    result.setting.opening ? `开场：${result.setting.opening}` : ''].filter(Boolean).join('\n');
  if (result.packs) return ['故事工坊：', ...result.packs.map((p) => `- ${p.title}（${p.id}） · ${p.placeName || p.placeId} · ${p.enabled ? p.available ? '启用' : '暂不可用' : '停用'}${p.warnings.length ? '；' + p.warnings.join('；') : ''}`), ...(result.warnings ?? [])].join('\n');
  if (result.nodes) return [`预览：${result.title}（当前测试条件${result.eligible ? '可触发' : '未满足'}，不会推进真实行程）`, ...result.nodes.map((n) => `${n.id} · ${n.area}：${n.event}${n.choices.length ? '；' + n.choices.map((c) => c.label + ' → ' + (c.next || '结束')).join(' / ') : ' → ' + (n.next || '结束')}`), ...(result.warnings ?? [])].join('\n');
  return result.message || ['剧情包结构校验通过。', ...(result.warnings ?? [])].join('\n');
}

/** 自由模式模板：只给大方向、正史、人物和收尾条件，不写分支。 */
function freeTemplate(venue) {
  return {
    version: 3,
    id: 'my-free-story',
    title: venue.name + '的一段自由故事',
    description: '可编辑的自由模式场景包：设定交给作者，具体怎么演交给主持。',
    placeId: venue.id,
    metadata: {
      mode: 'free', author: '本地作者', release: '1.0.0', genre: '日常',
      synopsis: '在熟悉的地方待一会儿，看看会遇见谁。', participation: 'solo', maxTurns: 20,
    },
    setting: {
      premise: `在${venue.name}待一个下午，弄清楚那件一直没被说出口的事。`,
      canon: [`这是${venue.name}一个普通的下午`, '那件事已经拖了很久，今天必须有个说法', '天黑之前要离开'],
      forbidden: ['不出现超自然力量'],
      cast: [{ id: 'someone', name: '一个熟人', role: '在这里等你的人', secret: '他其实先到了很久' }],
      locations: [{ id: 'here', name: venue.name, desc: '熟悉的地方，今天有点不一样' }],
      opening: `你在${venue.name}站了一会儿，才看见那个熟人已经在等你。`,
      flags: [{ id: 'met-someone', label: '和熟人打了照面', initial: false }],
      counters: [{ id: 'trust', label: '彼此的信任', initial: 0, min: 0, max: 5 }],
      facts: [{ id: 'matter', label: '那件事的现状', initial: '还没有人先开口' }],
      goals: [{ id: 'know-why', text: '知道那件事为什么拖到现在', when: { all: [{ flag: 'met-someone' }, { counter: 'trust', gte: 2 }] } }],
      ends: [{ id: 'wrap-up', text: '在天黑前把话说开', when: { all: [{ flag: 'met-someone' }, { counter: 'trust', gte: 2 }] } }],
      beats: ['远处有人在喊名字', '风把树叶翻了个面'],
    },
  };
}
