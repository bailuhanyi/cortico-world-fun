import { dom, list, selectedMappings, styleDescription } from './helpers.js';

const BACKUP_LIMIT = 64 * 1024 * 1024;
const actionNames = { new: '新建地点', bind: '绑定已有地点', skip: '跳过' };
const coverNames = { ready: '可迁入', valid: '可迁入', present: '可迁入', missing: '缺少图片', none: '无封面', invalid: '图片无效' };
const issueNames = { id: 'ID 冲突', name: '同名', mapped: '已建立映射', sameId: 'ID 冲突', sameName: '同名' };
const bytes = (size) => size >= 1024 ? `${(size / 1024).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} KiB` : `${size ?? 0} B`;
const sourceIdentity = /^[^\u0000-\u001f\u007f/\\]{1,120}$/u;

export function createMigrationView({ document, places, snapshot, run, call, tell, render: redraw, refreshSnapshot, live }) {
  const { node, row, note, button, field, option } = dom(document);
  let file;
  let sourceId = '';
  let bundle;
  let preview;
  let review;
  let receipt;
  let useHome = false;
  let defaultStyle = '';
  let showRecovery = false;
  let recoveryRevision;
  const decisions = new Map();

  function resetPreview() {
    bundle = undefined;
    preview = undefined;
    review = undefined;
    receipt = undefined;
    defaultStyle = '';
    useHome = false;
    decisions.clear();
  }
  function clearFile() {
    file = undefined;
    resetPreview();
    redraw();
  }
  function currentInputs() {
    return { bundle, sourceId: sourceId.trim(), ...(defaultStyle.trim() ? { defaultStyle: defaultStyle.trim() } : {}) };
  }
  async function inspect() {
    if (!file) { tell('请选择小世界导出的 JSON 文件。', true); return; }
    if (!sourceIdentity.test(sourceId.trim())) { tell('请为这个旧世界输入来源标识，例如「鱼的旧家」。', true); return; }
    await run(async () => {
      if (!file.size || file.size > BACKUP_LIMIT) throw new Error('请选择非空的小世界备份，最大 64 MiB。');
      let parsed;
      try { parsed = JSON.parse(await file.text()); } catch { throw new Error('无法读取该文件，请选择小世界导出的 JSON 备份。'); }
      if (parsed?.format !== 'little-world' || parsed.version !== 1) throw new Error('请选择 little-world v1 导出文件。');
      if (!live()) return;
      const result = await call('previewImport', { bundle: parsed, sourceId: sourceId.trim() });
      if (!live()) return;
      resetPreview();
      bundle = parsed;
      preview = result;
      showRecovery = false;
      redraw();
      documentFocus('fpl-plan-heading');
    });
  }
  let focusTarget;
  function documentFocus(key) {
    if (focusTarget?.id === key) focusTarget.focus();
  }
  function sourceForm() {
    const picked = node('input', { type: 'file', accept: 'application/json,.json', onchange: (event) => {
      file = event.currentTarget.files?.[0];
      resetPreview();
      redraw();
    } });
    const origin = node('input', { value: sourceId, required: true, maxlength: 120, placeholder: '例如：鱼的旧家',
      oninput: (event) => { sourceId = event.currentTarget.value; } });
    return node('form', { class: 'fpl-card fpl-stack', onsubmit: (event) => { event.preventDefault(); void inspect(); } },
      node('h4', {}, '1. 选择旧备份'),
      field('小世界导出的 JSON', picked), file ? note(`已选 ${file.name} · ${bytes(file.size)}`) : null,
      field('来源标识', origin, '同一个旧世界重复迁入时，填写同一个标识。不同旧世界分别命名，不填写文件路径。'),
      row(node('button', { type: 'submit', class: 'fpl-primary' }, '检查备份并预览'), file ? button('清除文件', clearFile) : null));
  }
  function impactBlock(data) {
    const impact = data.impact;
    const messages = list(impact).filter((item) => typeof item === 'string');
    if (typeof impact === 'string') messages.push(impact);
    if (impact && typeof impact === 'object' && !Array.isArray(impact)) {
      const names = { activeTrip: '进行中行程', storyBindings: '故事绑定', memories: '回忆', references: '现有引用' };
      for (const [key, value] of Object.entries(impact)) {
        if (typeof value === 'string' && value) messages.push(names[key] ? `${names[key]}：${value}` : value);
      }
    }
    return node('div', { class: 'fpl-stack' },
      note('已有故事引用、行程和回忆继续使用本地 ID。绑定并覆盖会更新地点基础内容，供之后的浏览和新行程使用。'),
      messages.length ? node('ul', {}, messages.map((line) => node('li', {}, line))) : null,
      list(data.warnings).length ? node('div', {}, node('h4', {}, '校验提示'), node('ul', {}, data.warnings.map((line) => node('li', {}, typeof line === 'string' ? line : line?.message || '请检查该条记录。')))) : null);
  }
  function recordFacts(item) {
    const primary = item.place ?? item;
    return node('div', { class: 'fpl-stack' },
      note([`源 ID：${item.sourceId}`, `封面：${coverNames[item.coverStatus] || item.coverStatus || '无封面'}${item.coverBytes ? `（${bytes(item.coverBytes)}）` : ''}`].join(' · ')),
      item.desc || primary.desc ? node('p', { class: 'fpl-wrap' }, item.desc || primary.desc) : null,
      note(`有效画风：${item.effectiveStyle || primary.effectiveStyle || item.style || primary.style || '未设置'}（${styleDescription({ ...primary, style: item.style ?? primary.style, effectiveStyle: item.effectiveStyle ?? primary.effectiveStyle })}）`),
      item.legacyFunVenue ? note(`旧 funVenue 提示：${item.legacyFunVenue}。请自行判断是否为同一地点。`) : null,
      item.existingTargetId ? note(`已记录的本地映射：${places().find((p) => p.id === item.existingTargetId)?.name ?? item.existingTargetId}`) : null,
      list(item.missingRelations).length ? note(`关联目标缺失：${item.missingRelations.map((relation) => typeof relation === 'string' ? relation : relation?.placeId ?? relation?.targetId).filter(Boolean).join('、')}`) : null,
      list(item.conflicts).length ? node('ul', {}, item.conflicts.map((conflict) => node('li', {},
        typeof conflict === 'string' ? conflict : `${issueNames[conflict.type] || conflict.type || '冲突'}：${conflict.name || conflict.targetId || '请核对候选地点'}`))) : null);
  }
  function decisionRow(item) {
    const saved = decisions.get(item.sourceId) ?? {};
    const action = node('select', {}, option('', '选择处理方式'), ...Object.entries(actionNames).map(([key, label]) => option(key, label)));
    action.value = saved.action || '';
    const target = node('select', {}, option('', '选择已有地点'), places().map((p) => option(p.id, `${p.name} (${p.id})`)));
    const policy = node('select', {}, option('keep', '保留本地内容'), option('overwrite', '用旧备份覆盖基础内容'));
    const targetFields = node('div', { class: 'fpl-grid' }, field('接收地点', target), field('绑定处理', policy));
    if (saved.targetId) target.value = saved.targetId;
    policy.value = saved.policy || 'keep';
    const update = () => {
      targetFields.hidden = action.value !== 'bind';
      target.disabled = policy.disabled = targetFields.hidden;
      decisions.set(item.sourceId, { action: action.value, targetId: target.value, policy: policy.value });
    };
    [action, target, policy].forEach((control) => control.addEventListener('change', update));
    update();
    return node('article', { class: 'fpl-import-row fpl-stack' }, node('h4', {}, item.name), recordFacts(item), field('处理方式', action), targetFields);
  }
  async function reviewPlan() {
    await run(async () => {
      const mappings = selectedMappings(list(preview.items), decisions);
      const importedHome = mappings.find((entry) => entry.sourceId === preview.sourceHomeId);
      if (useHome && (!importedHome || (importedHome.action === 'skip' && !list(preview.items).find((item) => item.sourceId === preview.sourceHomeId)?.existingTargetId))) {
        throw new Error('要迁入旧住所，请为这处地点选择新建、绑定或保留既有映射。');
      }
      if (!useHome && mappings.every((entry) => entry.action === 'skip')) throw new Error('请至少选择一处要迁入的地点或选用可映射的旧住所。');
      const updated = await call('previewImport', { ...currentInputs(), mappings, useImportedHome: useHome });
      if (!live()) return;
      if (!updated.previewId) throw new Error('宿主未返回可确认的迁入预览。');
      review = { data: updated, mappings, useHome };
      redraw();
      documentFocus('fpl-review-heading');
    });
  }
  function choices() {
    const home = list(preview.items).find((item) => item.sourceId === preview.sourceHomeId);
    const style = node('textarea', { rows: 2, maxlength: 160, oninput: (event) => { defaultStyle = event.currentTarget.value; } }, defaultStyle);
    const homeChoice = node('input', { type: 'checkbox', checked: useHome, disabled: !home, onchange: (event) => { useHome = event.currentTarget.checked; } });
    focusTarget = node('h4', { id: 'fpl-plan-heading', tabindex: -1 }, '2. 逐项选择');
    return node('section', { class: 'fpl-card fpl-stack' }, focusTarget,
      note(`little-world v1 · 来源 ${preview.sourceId || sourceId.trim()} · ${preview.placeCount ?? list(preview.items).length} 处地点 · ${preview.coverCount ?? 0} 张封面（${bytes(preview.coverBytes)}）`),
      note(`旧住所：${home?.name || '无可迁入的住所'}。本地住所：${places().find((place) => place.id === snapshot()?.homeId)?.name || '未设置'}。`),
      preview.alreadyImported ? note('此来源已迁入过。请核对既有映射后选择处理方式。') : null,
      impactBlock(preview), list(preview.items).map(decisionRow),
      node('label', { class: 'fpl-check' }, homeChoice, home ? `将「${home.name}」设为本地住所` : '此备份没有可选的住所'),
      field('从旧世界补录默认画风（可选）', style, '旧导出不包含全局画风。补录只用于所选旧地点的空白画风，不会更改娱乐时间的全局画风。'),
      row(button('查看迁入结果预览', reviewPlan, { class: 'fpl-primary' }), button('更换备份', clearFile)));
  }
  async function commit() {
    const confirmed = review;
    if (!confirmed) return;
    await run(async () => {
      const result = await call('commitImport', { previewId: confirmed.data.previewId, mappings: confirmed.mappings, useImportedHome: confirmed.useHome });
      if (!live()) return;
      // Retain the successful receipt even if the separate follow-up read fails.
      resetPreview();
      file = undefined;
      receipt = result;
      redraw();
      try { await refreshSnapshot(); } catch { if (live()) tell('已收到迁入回执。刷新可重新读取地点和恢复点。', true); return; }
      if (live()) redraw();
    }, { write: true, onError: () => { review = undefined; redraw(); } });
  }
  function describeChange(field, value) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '空';
    if (field === 'cover') return '有封面';
    if (field === 'coverFocus') return `${value.x}% × ${value.y}%`;
    if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : `${places().find((place) => place.id === item.placeId)?.name ?? item.placeId}：${item.note}`).join('；');
    return String(value);
  }
  function fieldChanges(change) {
    const labels = { name: '名称', aliases: '别名', tags: '标签', kind: '分类', desc: '描写', style: '画风', scene: '场景名', relations: '关联', cover: '封面', coverFocus: '封面焦点' };
    const displayed = list(change?.fields).filter((entry) => entry.changed || (entry.authoritative && entry.incoming && JSON.stringify(entry.local) !== JSON.stringify(entry.incoming)));
    return displayed.length ? node('ul', {}, displayed.map((entry) => node('li', { class: 'fpl-wrap' },
      `${labels[entry.field] || entry.field}：${describeChange(entry.field, entry.local)} → ${describeChange(entry.field, entry.result)}${entry.authoritative ? '（以娱乐场所为准）' : ''}`))) : note('基础内容保持原样。');
  }
  function reviewPanel() {
    const { data, mappings } = review;
    const proposed = data.proposed;
    const results = list(proposed?.mappings);
    const resultFor = (mapping) => results.find((item) => item.sourceId === mapping.sourceId) ?? { ...mapping, result: mapping.action };
    const homeId = proposed?.homeId;
    const homeSource = list(data.items).find((item) => item.sourceId === results.find((item) => item.targetId === homeId)?.sourceId);
    const approvedHome = places().find((place) => place.id === homeId)?.name ?? homeSource?.name ?? homeId;
    focusTarget = node('h4', { id: 'fpl-review-heading', tabindex: -1 }, '3. 核对并确认');
    const approve = node('input', { type: 'checkbox', onchange: (event) => { commitButton.disabled = !event.currentTarget.checked; } });
    const commitButton = button('确认迁入', commit, { class: 'fpl-primary', disabled: true });
    const counts = (kind) => mappings.filter((item) => resultFor(item).result === kind).length;
    return node('section', { class: 'fpl-card fpl-stack' }, focusTarget,
      node('p', {}, `来源 ${data.sourceId || sourceId} · ${counts('new')} 处新建 · ${counts('bind')} 处绑定 · ${counts('skip')} 处跳过 · ${counts('existing')} 处沿用既有映射`),
      proposed?.duplicate ? note('此方案与已处理的迁入一致。') : null,
      node('ul', {}, mappings.map((mapping) => {
        const result = resultFor(mapping);
        const item = list(data.items).find((entry) => entry.sourceId === mapping.sourceId);
        const change = list(proposed?.changes).find((entry) => entry.sourceId === mapping.sourceId);
        const target = places().find((p) => p.id === result.targetId)?.name || result.targetId;
        const decision = result.result === 'existing' ? `沿用已有映射「${target}」`
          : result.result === 'bind' ? `${actionNames.bind}「${target}」 · ${mapping.policy === 'overwrite' ? '覆盖可迁入的基础内容' : '保留本地值，仅补空白项'}` : actionNames[result.result];
        return node('li', {}, `${item?.name ?? mapping.sourceId}：${decision}`, fieldChanges(change));
      })),
      note(review.useHome ? `住所将设为「${approvedHome ?? preview.sourceHomeId}」。` : '保留本地住所。'),
      note(defaultStyle.trim() ? `用「${defaultStyle.trim()}」补充所选旧地点的空白画风；保留本地全局画风设置。` : '未提供旧默认画风；保留本地全局画风设置。'),
      impactBlock({ ...data, warnings: proposed?.warnings ?? data.warnings }), node('label', { class: 'fpl-check' }, approve, '我已核对地点选择、住所和画风，确认写入娱乐时间。'),
      row(commitButton, button('返回修改选择', () => { review = undefined; redraw(); documentFocus('fpl-plan-heading'); })));
  }
  function recovery() {
    const current = snapshot();
    const pendingRead = receipt && Number.isSafeInteger(receipt.revision) && receipt.revision > (current?.revision ?? -1);
    const recoveryId = pendingRead ? receipt.recoveryId : current?.recoveryId;
    if (!recoveryId) return receipt?.recoveryId ? note('该迁入恢复点已不可用，后续地点编辑不会被覆盖。') : null;
    async function restore() {
      await run(async () => {
        await call('restoreImport', { recoveryId, revision: recoveryRevision });
        if (!live()) return;
        receipt = undefined;
        showRecovery = false;
        resetPreview();
        await refreshSnapshot();
        if (live()) { redraw(); tell('已恢复到迁入前的地点状态。'); }
      }, { write: true, onError: () => { showRecovery = false; redraw(); } });
    }
    return node('section', { class: 'fpl-card fpl-stack' }, node('h4', {}, '迁入恢复点'),
      note('可以恢复到该次迁入前的地点状态。若之后编辑过地点，宿主会阻止恢复以保留新编辑。'),
      showRecovery ? row(button('确认恢复', restore, { class: 'fpl-primary' }), button('取消', () => { showRecovery = false; redraw(); }))
        : row(button('恢复到迁入前', () => { recoveryRevision = snapshot()?.revision; showRecovery = true; redraw(); })));
  }
  function migrationReceipt() {
    if (!receipt) return null;
    const records = list(receipt.mappings);
    return node('section', { class: 'fpl-card fpl-stack' }, node('h4', {}, receipt.duplicate ? '这份迁入已处理' : '迁入完成'),
      note(records.length ? `已处理 ${records.length} 条地点映射。` : '状态已由娱乐时间保存。'),
      records.length ? node('ul', {}, records.map((entry) => node('li', {}, `${entry.sourceId}${entry.targetId ? ` → ${places().find((p) => p.id === entry.targetId)?.name ?? entry.targetId}` : ` · ${actionNames[entry.action] || '已处理'}`}`))) : null,
      list(receipt.warnings).map((warning) => note(typeof warning === 'string' ? warning : warning?.message)));
  }
  function render() {
    focusTarget = undefined;
    return node('section', { class: 'fpl-stack' }, node('h3', { tabindex: -1 }, '从鱼的小世界迁入'),
      note('使用鱼的小世界导出的 little-world v1 文件。地点和封面会写入娱乐时间，旧世界仍保留原样。草稿、视图偏好和历史图片归档不在这份迁入范围内。'),
      migrationReceipt(), review ? reviewPanel() : preview ? choices() : sourceForm(), recovery());
  }
  return { render };
}
