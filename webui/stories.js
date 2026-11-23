/** Venue story pack authoring for Coo WebUI. */
import { storyText } from './ui-text.js';
import { venueArtwork } from './artwork.js';
import { el } from './dom.js';
const CSS = `
.fun-stories{--fs-line:var(--border,#e3e4e3);--fs-ink:var(--foreground,#1b1a1e);--fs-dim:var(--muted-foreground,#5c5c60);--fs-card:var(--surface,#fbfbfb);--fs-soft:color-mix(in srgb,var(--fs-card) 93%,var(--fs-ink));--fs-accent:var(--accent,#00a870);--fs-error:var(--destructive,#b23b35);font:14px/1.65 var(--sans,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);color:var(--fs-ink);padding:8px 4px 24px;overflow-wrap:anywhere}
.fun-stories *{box-sizing:border-box}
.fun-stories h2,.fun-stories h3,.fun-stories h4,.fun-stories p{margin:0}
.fun-stories h2{font-size:20px}.fun-stories h3{font-size:15px}.fun-stories h4{font-size:14px}
.fun-story-heading{margin-bottom:14px;padding:4px 0 12px;border-bottom:1px solid var(--fs-line)}
.fun-story-note,.fun-story-field,.fun-story-feedback{color:var(--fs-dim);font-size:12px}
.fun-story-editor,.fun-story-pack{border:1px solid var(--fs-line);border-radius:12px;background:var(--fs-card);padding:12px;margin-bottom:9px}
.fun-story-editor{background:var(--fs-soft);margin-bottom:16px}
.fun-stories [hidden]{display:none!important}.fun-story-authoring{min-width:0}.fun-story-editor-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.fun-story-editor-head h3{margin-right:auto}.fun-story-editor-toggle{white-space:normal}.fun-story-dirty{color:var(--fs-error);font-size:12px}.fun-stories :is(input,select,textarea,fieldset,section,details){min-width:0;max-width:100%}.fun-story-author-content{margin-top:10px}.fun-story-advanced{margin:8px 0 14px}.fun-story-advanced>summary{cursor:pointer;font-weight:600}.fun-story-editor>summary{cursor:pointer;font-weight:600}
.fun-story-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:6px 10px;margin:8px 0}
.fun-story-grid :is(input,select){display:block;width:100%;min-width:0;margin-top:3px}
.fun-story-branches{grid-template-columns:repeat(auto-fit,minmax(min(235px,100%),1fr))}
.fun-story-branch{margin:0;padding:6px 9px;min-width:0;border:1px solid var(--fs-line);border-radius:var(--radius-sm,6px)}
.fun-story-branch>.fun-story-field{margin:5px 0}
.fun-story-row{display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap;margin:6px 0}
.fun-story-row>h3,.fun-story-row>h4{margin-right:auto}
.fun-story-field{display:block;font-weight:600}
.fun-story-row label{display:inline-flex;align-items:center;gap:5px}
.fun-stories button,.fun-stories select,.fun-stories textarea,.fun-story-grid input{font:inherit;color:inherit;background:var(--fs-card);border:1px solid var(--fs-line);border-radius:var(--radius-sm,6px);padding:4px 9px}
.fun-stories button,.fun-stories select{min-height:31px;max-width:100%}
.fun-stories button{cursor:pointer}
.fun-stories button:hover{border-color:var(--fs-accent)}
.fun-stories button[aria-disabled=true]{opacity:.55;cursor:default}
.fun-stories :is(button,select,textarea,input):focus-visible{outline:2px solid var(--fs-accent);outline-offset:2px}
.fun-stories .fun-story-primary{border-color:var(--fs-accent);background:var(--fs-accent);color:var(--accent-foreground,#fff);font-weight:600}
.fun-stories .fun-story-danger,.fun-story-errors{color:var(--fs-error)}
.fun-stories textarea{display:block;width:100%;margin:4px 0;resize:vertical;font:12px/1.55 ui-monospace,Consolas,monospace}
.fun-story-badge{font-size:11.5px;color:var(--fs-dim);border:1px solid var(--fs-line);border-radius:999px;padding:0 7px;background:var(--fs-soft)}
.fun-story-unavailable{border-style:dashed}
.fun-stories ul,.fun-stories ol{margin:3px 0;padding-inline-start:19px}
.fun-story-feedback>:empty,.fun-story-result:empty,.fun-story-confirm:empty{display:none}
.fun-story-confirm,.fun-story-result{margin-top:8px}
.fun-story-node{padding:5px 0;border-bottom:1px solid var(--fs-line)}
.fun-story-node:last-child{border-bottom:0}
.fun-story-node p{white-space:pre-wrap}
.fun-story-group{border:1px solid color-mix(in srgb,var(--fs-line) 86%,var(--fs-accent));border-radius:10px;background:color-mix(in srgb,var(--fs-card) 97%,var(--fs-accent));margin:10px 0;overflow:hidden}.fun-story-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 12px;font-weight:700}.fun-story-group>summary::-webkit-details-marker{display:none}.fun-story-group>summary:before{content:'›';display:grid;place-items:center;width:18px;height:18px;border:1px solid var(--fs-line);border-radius:5px;color:var(--fs-dim);transition:transform .15s}.fun-story-group[open]>summary:before{transform:rotate(90deg)}.fun-story-group>summary .fun-story-group-progress{margin-left:auto;color:var(--fs-dim);font-size:11px;font-weight:500}.fun-story-group-content{padding:0 12px 10px}.fun-story-group-content>.fun-story-grid{margin-top:0}.fun-story-sticky-actions{position:sticky;bottom:8px;z-index:3;padding:9px 10px;border:1px solid var(--fs-line);border-radius:10px;background:color-mix(in srgb,var(--fs-card) 92%,transparent);backdrop-filter:blur(10px);box-shadow:0 6px 18px color-mix(in srgb,var(--fs-ink) 12%,transparent);margin-top:12px}.fun-story-sticky-actions .fun-story-row{margin:0}.fun-story-sticky-actions .fun-story-field{margin-left:auto;color:var(--fs-dim);font-size:11px}.fun-story-branches{margin-top:0}.fun-story-editor-head{padding-bottom:4px}.fun-story-editor-toggle{min-width:72px}.fun-story-simple>details+details{margin-top:10px}
.fun-story-mode{display:flex;gap:6px;margin:10px 0 4px;flex-wrap:wrap}
.fun-story-mode button{border:1px solid var(--fs-line);border-radius:99px;background:var(--fs-card);color:inherit;padding:5px 12px;font:inherit;font-size:12px;cursor:pointer}
.fun-story-mode button[aria-selected=true]{border-color:var(--fs-accent);background:color-mix(in srgb,var(--fs-accent) 12%,var(--fs-card));font-weight:700}
.fun-story-free-note{margin:6px 0 10px;color:var(--fs-dim);font-size:12px}
@media(max-width:520px){.fun-story-group-content{padding-inline:9px}.fun-story-sticky-actions{bottom:4px;padding:8px}.fun-story-sticky-actions .fun-story-row{align-items:stretch}.fun-story-sticky-actions .fun-story-row>button{flex:1}.fun-story-sticky-actions .fun-story-sticky-status{width:100%;margin:0;text-align:center}}
/* 作品库：标题条 + 作品卡 + 右侧创作入口（宽屏两列，窄屏收掉右侧那一栏） */
.fun-story-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px 18px;flex-wrap:wrap;padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid var(--fs-line)}
.fun-story-head h2{margin:3px 0 5px}
.fun-story-kicker{font-size:11px;letter-spacing:.14em;color:var(--fs-dim);text-transform:uppercase}
.fun-story-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fun-story-new{min-height:40px!important;padding:0 18px!important;border-radius:999px!important;white-space:nowrap}
.fun-story-layout{display:grid;gap:20px}
@media(min-width:1000px){.fun-story-layout{grid-template-columns:minmax(0,1fr) 276px;align-items:start}}
.fun-story-main{min-width:0}
.fun-story-rail{border:1px solid var(--fs-line);border-radius:14px;padding:18px;background:var(--fs-card);min-width:0}
.fun-story-rail h3{font-size:14px;letter-spacing:.03em;margin-bottom:10px}
.fun-story-rail p{font-size:12px;line-height:1.85;color:var(--fs-dim);margin:0 0 14px}
.fun-story-rail-actions{display:grid;gap:8px}
.fun-story-rail-actions button{width:100%;min-height:38px;border-radius:9px;background:var(--fs-card);font:inherit;font-size:12.5px}
.fun-story-rail-actions button:hover{border-color:var(--fs-accent)}
.fun-story-rail .fun-story-rail-quote{margin:18px 0 0;padding-top:14px;border-top:1px dashed var(--fs-line);font-size:11.5px}
@media(max-width:999px){.fun-story-rail{display:none}}
.fun-story-filters{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0 14px}
.fun-story-filters button{border-radius:999px;padding:5px 13px;background:transparent;min-height:32px;font-size:12.5px}
.fun-story-filters button[aria-pressed=true]{border-color:var(--fs-accent);background:color-mix(in srgb,var(--fs-accent) 12%,var(--fs-card));font-weight:700}
.fun-story-count{font-size:11.5px;color:var(--fs-dim);margin-left:auto}
.fun-story-pack{padding:0;overflow:hidden}
@media(min-width:720px){.fun-story-pack{display:grid;grid-template-columns:132px minmax(0,1fr);align-items:stretch}}
.fun-story-cover{display:flex;align-items:center;justify-content:center;min-height:96px;padding:12px;background:color-mix(in srgb,var(--fs-accent) 5%,var(--fs-card));border-right:1px solid var(--fs-line);color:color-mix(in srgb,var(--fs-ink) 66%,var(--fs-card));--f-card:color-mix(in srgb,var(--fs-card) 88%,var(--fs-ink) 12%)}
.fun-story-cover svg{display:block;width:100%;height:auto;max-height:118px}
.fun-story-body{min-width:0;padding:12px 14px}
.fun-story-body>p{margin-top:5px}
.fun-story-body>.fun-story-row:last-of-type{margin-bottom:0}
.fun-story-body .fun-story-result,.fun-story-body .fun-story-confirm,.fun-story-body .fun-story-feedback{margin-top:8px}
@media(max-width:719px){
  .fun-story-cover{border-right:0;border-bottom:1px solid var(--fs-line);min-height:0;padding:8px 14px}
  .fun-story-cover svg{max-height:74px}
}
.fun-story-required-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--fs-error);flex:none}.fun-story-required-dot[hidden]{display:none!important}.fun-story-group-progress{white-space:nowrap}.fun-story-group-content{padding-top:2px}.fun-story-group-content .fun-story-grid{gap:12px 14px;margin:10px 0}.fun-story-group-content .fun-story-field{display:flex;flex-direction:column;gap:5px;font-size:12px}.fun-story-group-content :is(input,select){height:36px;border-radius:8px;padding:6px 10px}.fun-story-group-content textarea{border-radius:8px;padding:8px 10px}.fun-story-sticky-actions .fun-story-sticky-status{margin-left:auto;color:var(--fs-dim);font-size:11px}.fun-story-sticky-actions .fun-story-sticky-status:empty{display:none}
@media(max-width:420px){.fun-stories{padding-inline:0}.fun-story-editor{padding:10px}.fun-story-body{padding:10px 11px}}
`;

function messageList(messages) {
  return messages?.length ? el('ul', {}, messages.map((message) => el('li', {}, String(message)))) : null;
}

function feedback() {
  const status = el('div', { role: 'status' });
  const alert = el('div', { class: 'fun-story-errors', role: 'alert' });
  return {
    node: el('div', { class: 'fun-story-feedback' }, status, alert),
    set(text = '', result) {
      const warnings = messageList(result?.warnings);
      status.replaceChildren(...[text ? document.createTextNode(text) : null, warnings].filter(Boolean));
      const errors = [...new Set([result?.error, ...(result?.errors ?? [])].filter(Boolean))];
      if (result?.ok === false && !errors.length) errors.push('操作失败，请重试。');
      alert.replaceChildren(...(errors.length ? [messageList(errors)] : []));
    },
  };
}

function previewGraph(result) {
  const nodes = (result.nodes ?? []).map((node) => {
    const when = node.when && Object.keys(node.when).length
      ? `条件：${typeof node.when === 'string' ? node.when : JSON.stringify(node.when)}` : '';
    const choices = (node.choices ?? []).map((choice) => el('li', {}, `${choice.label || choice.id} → ${choice.next || '结束'}`));
    return el('li', { class: 'fun-story-node' },
      el('strong', {}, `${node.id}${node.area ? ` · ${node.area}` : ''}`),
      node.event ? el('p', {}, node.event) : null,
      when ? el('p', { class: 'fun-story-note' }, when) : null,
      node.next ? el('p', { class: 'fun-story-note' }, `下一节点 → ${node.next}`) : null,
      choices.length ? el('ul', {}, choices) : null,
      !node.next && !choices.length ? el('p', { class: 'fun-story-note' }, '结束') : null);
  });
  return el('section', { class: 'fun-story-graph', 'aria-label': '只读节点图' },
    el('h4', {}, result.title || '节点图'),
    el('p', { class: 'fun-story-note' }, result.eligible ? '当前预览条件匹配' : '当前预览条件未匹配'),
    el('ol', {}, nodes));
}

function label(text, control) {
  return el('label', { class: 'fun-story-field' }, text, control);
}

function fillSelect(select, items, placeholder) {
  const selected = select.value;
  select.replaceChildren(el('option', { value: '' }, placeholder),
    ...items.map(({ value, label }) => el('option', { value }, label)),
    ...(selected && !items.some((item) => item.value === selected) ? [el('option', { value: selected }, selected)] : []));
  select.value = selected || '';
}

function simpleEditor(button, save, onDirty = () => {}, t = storyText()) {
  const select = (key) => el('select', { class: `fun-story-author-${key}`, 'data-story-field': key });
  const input = (key, max, type = 'text') => el('input', { class: `fun-story-author-${key}`, type, 'data-story-field': key, ...(max ? { maxlength: String(max) } : {}) });
  const place = select('place');
  const area = select('area');
  const id = input('id', 24);
  id.value = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const title = input('title', 80);
  const author = input('author', 80);
  const release = input('release', 24);
  release.value = '1.0.0';
  const genre = input('genre', 40);
  genre.value = '日常';
  const synopsis = input('synopsis', 240);
  const participation = select('participation');
  fillSelect(participation, [{ value: 'solo', label: '单人' }, { value: 'duo', label: '双人' }], '选择参与方式');
  participation.value = 'solo';
  const duration = input('duration', null, 'number');
  duration.min = '1'; duration.max = '600';
  const decisionActor = select('decision-actor');
  fillSelect(decisionActor, [{ value: 'owner', label: '用户回合' }, { value: 'fish', label: '鱼的回合' }, { value: 'joint', label: '共同决定' }], '选择当前行动者');
  decisionActor.value = 'owner';
  const jointResolution = select('joint-resolution');
  fillSelect(jointResolution, [{ value: 'require-agreement', label: '必须一致；分歧保持待定' }, { value: 'owner-final', label: '分歧时按用户明确选择' }, { value: 'fish-final', label: '分歧时按鱼明确选择' }], '选择分歧规则');
  jointResolution.value = 'require-agreement';
  const requirements = input('requirements', 480);
  const event = input('event', 120);
  const prompt = input('prompt', 160);
  const playtestBox = el('div', { class: 'fun-story-playtest' });
  const from = input('from', null, 'time');
  const to = input('to', null, 'time');
  const branches = ['a', 'b'].map((key, index) => {
    const choice = input(`${key}-label`, 160);
    const result = input(`${key}-result`, 160);
    const event = input(`${key}-event`, 120);
    const area = select(`${key}-area`);
    const node = el('fieldset', { class: 'fun-story-branch' }, el('legend', { class: 'fun-story-field' }, `选项 ${index + 1}`),
      label('选项文字', choice), label('选择结果', result), label('后续事件', event), label('后续区域', area));
    return { key, choice, result, event, area, node };
  });
  let places = [];
  const report = feedback();
  const updateAreas = () => {
    const areas = (places.find((item) => item.id === place.value)?.areas ?? []).map((name) => ({ value: name, label: name }));
    fillSelect(area, areas, '选择起始区域');
    for (const branch of branches) fillSelect(branch.area, areas, '同起始区域');
  };
  place.addEventListener('change', () => {
    area.value = '';
    for (const branch of branches) branch.area.value = '';
    updateAreas();
  });
  const buildPack = () => {
    const start = { id: 'start', area: area.value, event: event.value.trim(), prompt: prompt.value.trim(),
      ...(participation.value === 'duo' ? { actor: decisionActor.value } : {}),
      choices: branches.map((branch) => ({ id: branch.key, label: branch.choice.value.trim(), result: branch.result.value.trim(), next: `end-${branch.key}` })) };
    if (from.value) start.when = { from: from.value, to: to.value };
    const nodes = [start, ...branches.map((branch) => ({ id: `end-${branch.key}`, area: branch.area.value || area.value, event: branch.event.value.trim() }))];
    const metadata = { author: author.value.trim(), release: release.value.trim(), genre: genre.value.trim(), synopsis: synopsis.value.trim(),
      participation: participation.value, requirements: requirements.value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean),
      ...(duration.value ? { durationMinutes: Number(duration.value) } : {}),
      ...(participation.value === 'duo' ? { jointResolution: jointResolution.value } : {}) };
    return { version: 2, id: id.value.trim(), title: title.value.trim(), description: synopsis.value.trim(), metadata, placeId: place.value, start: start.id, nodes };
  };
  const validateForm = () => {
    const fields = [place, area, id, title, author, release, genre, synopsis, participation, event, prompt,
      ...participation.value === 'duo' ? [decisionActor, jointResolution] : [],
      ...branches.flatMap((branch) => [branch.choice, branch.result, branch.event])];
    const missing = fields.find((field) => !field.value.trim());
    if (missing) { report.set('', { ok: false, error: '请填写作品资料、参与方式、地点与故事内容。' }); missing.focus(); return false; }
    if (!/^user-[a-z0-9_-]{1,19}$/.test(id.value.trim())) { report.set('', { ok: false, error: '标识须以 user- 开头，最多 24 字符，只能含小写字母、数字、短横线或下划线。' }); id.focus(); return false; }
    if (Boolean(from.value) !== Boolean(to.value) || (from.value && from.value === to.value)) { report.set('', { ok: false, error: '请填写不同的开始和结束时间，或将两项都留空。' }); (from.value && !to.value ? to : from).focus(); return false; }
    if (duration.value && (!Number.isInteger(Number(duration.value)) || Number(duration.value) < 1 || Number(duration.value) > 600)) { report.set('', { ok: false, error: '试玩时长须为 1–600 分钟的整数；留空即显示未知。' }); duration.focus(); return false; }
    return true;
  };
  const renderPlaytest = (result, path, json) => {
    if (!result?.ok) { report.set('隔离试玩未能继续。', result); playtestBox.replaceChildren(); return; }
    report.set(result.complete ? '试玩结局已显示；没有写入行程、回忆或解锁。' : '试玩仅使用临时状态；没有写入行程、回忆或解锁。', result);
    const current = result.current;
    playtestBox.replaceChildren(current ? el('div', {}, el('strong', {}, current.event),
      current.prompt ? el('p', {}, current.prompt) : null,
      el('div', { class: 'fun-story-row' }, (current.options ?? []).map((option) => button(option.label, async () => {
        const nextPath = [...path, option.id];
        const next = await save(report, json, 'playtest', nextPath);
        renderPlaytest(next, nextPath, json);
      }, { class: 'fun-story-action' })))) : el('p', {}, '试玩路径已结束。'));
  };
  const previewButton = button('预览表单草稿', async () => {
    if (!validateForm()) return;
    const result = await save(report, JSON.stringify(buildPack()), 'preview', []);
    if (result?.ok) playtestBox.replaceChildren(previewGraph(result));
  }, { class: 'fun-story-action' });
  const playtestButton = button('隔离试玩', async () => {
    if (!validateForm()) return;
    const json = JSON.stringify(buildPack());
    playtestBox.replaceChildren();
    const result = await save(report, json, 'playtest', []);
    renderPlaytest(result, [], json);
  }, { class: 'fun-story-action' });
  let stickyStatus;
  const saveButton = button('保存新故事包', async () => {
    if (!validateForm()) return;
    const submitted = fingerprint();
    const result = await save(report, JSON.stringify(buildPack()), 'import', []);
    if (result?.ok && submitted === fingerprint()) { baseline = submitted; stickyStatus.textContent = t.storySaved; }
    onDirty();
  }, { class: 'fun-story-action fun-story-primary' });
  const duoSettings = el('div', { class: 'fun-story-grid fun-story-duo-settings' },
    label('双人起始行动者', decisionActor), label('共同选择分歧规则', jointResolution));
  const syncDuoSettings = () => { duoSettings.hidden = participation.value !== 'duo'; };
  participation.addEventListener('change', () => { playtestBox.replaceChildren(); report.set(); syncDuoSettings(); });
  syncDuoSettings();
  const group = (title, fields, content, open = false, optional = false) => {
    const badge = el('span', { class: 'fun-story-group-progress' });
    const requiredDot = el('span', { class: 'fun-story-required-dot', 'aria-hidden': 'true' });
    const detail = el('details', { class: 'fun-story-group fun-story-static-group', ...(open ? { open: '' } : {}) });
    const update = () => {
      const missing = fields.some((field) => !String(field.value ?? '').trim());
      requiredDot.hidden = optional || !missing;
      const done = fields.length - fields.filter((field) => !String(field.value ?? '').trim()).length;
      badge.textContent = optional ? t.storyGroupOptional : typeof t.storyGroupProgress === 'function' ? t.storyGroupProgress(done, fields.length) : `${done}/${fields.length}`;
      detail.setAttribute('class', `fun-story-group fun-story-static-group${!optional && missing ? ' fun-story-group-incomplete' : ''}`);
    };
    detail.append(el('summary', {}, title, requiredDot, badge), el('div', { class: 'fun-story-group-content' }, content));
    update();
    return { node: detail, update };
  };
  const gWork = group(t.storyGroupWork, [place, area, id, title, author, release, genre, synopsis, participation],
    el('div', {},
      el('div', { class: 'fun-story-grid' }, label('地点', place), label('起始区域', area), label('故事标题', title), label('故事标识', id)),
      el('div', { class: 'fun-story-grid' }, label('作者', author), label('作品版本', release), label('类型', genre), label('参与方式', participation)),
      el('div', { class: 'fun-story-grid' }, label('无剧透简介', synopsis), label('试玩时长（分钟，可留空；留空显示未知）', duration), label('能力要求（可选，用逗号分隔）', requirements))), true);
  const gStart = group(t.storyGroupStart, [event, prompt],
    el('div', {}, el('div', { class: 'fun-story-grid' }, label('起始事件', event), label('选择提问', prompt)), duoSettings), true);
  const gBranches = group(t.storyGroupBranches, branches.flatMap((branch) => [branch.choice, branch.result, branch.event]),
    el('div', { class: 'fun-story-grid fun-story-branches' }, branches.map((branch) => branch.node)), false);
  const gTiming = group(t.storyGroupTiming, [from, to],
    el('div', { class: 'fun-story-grid' }, label('开始时间', from), label('结束时间', to)), false, true);
  stickyStatus = el('span', { class: 'fun-story-sticky-status', role: 'status', 'aria-live': 'polite' });
  const stickyActions = el('div', { class: 'fun-story-sticky-actions' },
    el('div', { class: 'fun-story-row' }, saveButton, previewButton, playtestButton, stickyStatus));
  const node = el('section', { class: 'fun-story-simple', 'aria-label': t.storySimpleForm },
    gWork.node, gStart.node, gBranches.node, gTiming.node, stickyActions, report.node, playtestBox);
  const controls = [...node.querySelectorAll('input'), ...node.querySelectorAll('select')];
  const fingerprint = () => JSON.stringify(controls.map((field) => field.value));
  function update(items) {
    places = items;
    fillSelect(place, items.map((item) => ({ value: item.id, label: item.name || item.id })), '选择地点');
    updateAreas();
    gWork.update();
  }
  update([]);
  let baseline = fingerprint();
  const markDirty = () => {
    onDirty(); gWork.update(); gStart.update(); gBranches.update(); gTiming.update();
    stickyStatus.textContent = fingerprint() === baseline ? '' : t.storyEditorDirty;
  };
  for (const field of controls) for (const eventName of ['input', 'change']) field.addEventListener(eventName, markDirty);
  return { node, update, isDirty: () => fingerprint() !== baseline };

}

/**
 * 自由模式（v3 场景包）的结构化表单：只写大方向、正史、人物和收尾条件。
 * 字段多于表单能力的部分仍去 JSON 编辑器写；这里保证「填完就能玩」。
 */
function freeEditor(button, save, onDirty = () => {}, t = storyText()) {
  const input = (key, max, type = 'text') => el('input', { class: `fun-story-free-${key}`, type, 'data-free-field': key, ...(max ? { maxlength: String(max) } : {}) });
  const area = (key, rows = 3) => el('textarea', { class: `fun-story-free-${key}`, rows: String(rows), 'data-free-field': key });
  const select = (key) => el('select', { class: `fun-story-free-${key}`, 'data-free-field': key });
  const place = select('place');
  const id = input('id', 24);
  id.value = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const title = input('title', 80);
  const synopsis = input('synopsis', 240);
  const author = input('author', 80);
  const release = input('release', 24);
  release.value = '1.0.0';
  const genre = input('genre', 40);
  genre.value = '日常';
  const participation = select('participation');
  fillSelect(participation, [{ value: 'solo', label: '单人' }, { value: 'duo', label: '双人' }, { value: 'group', label: '多人（群里只有鱼写）' }], '选择参与方式');
  participation.value = 'solo';
  const maxTurns = input('max-turns', null, 'number');
  maxTurns.min = '1'; maxTurns.max = '200'; maxTurns.value = '20';
  const premise = area('premise', 2);
  const opening = area('opening', 3);
  const canon = area('canon', 5);
  const forbidden = area('forbidden', 2);
  const castName = input('cast-name', 40);
  const castRole = input('cast-role', 120);
  const castSecret = input('cast-secret', 120);
  const locName = input('loc-name', 40);
  const locDesc = input('loc-desc', 160);
  const flagLabel = input('flag-label', 40);
  flagLabel.value = '关键进展';
  const counterLabel = input('counter-label', 40);
  counterLabel.value = '信任';
  const counterMax = input('counter-max', null, 'number');
  counterMax.min = '1'; counterMax.max = '100'; counterMax.value = '5';
  const factLabel = input('fact-label', 40);
  factLabel.value = '那件事的现状';
  const factInitial = input('fact-initial', 200);
  factInitial.value = '还没有人碰过';
  const goalText = input('goal-text', 120);
  goalText.value = '弄清那件事';
  const endText = input('end-text', 120);
  endText.value = '在天黑前把话说开';
  const endThreshold = input('end-threshold', null, 'number');
  endThreshold.min = '0'; endThreshold.max = '100'; endThreshold.value = '2';
  const report = feedback();
  const playtestBox = el('div', { class: 'fun-story-playtest' });
  const lines = (value) => String(value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const buildPack = () => {
    const canonLines = lines(canon.value);
    const forbiddenLines = lines(forbidden.value);
    const limit = Number(counterMax.value) || 5;
    const threshold = Number(endThreshold.value) || 0;
    return {
      version: 3,
      id: id.value.trim(),
      title: title.value.trim(),
      description: synopsis.value.trim(),
      placeId: place.value,
      metadata: {
        mode: 'free', author: author.value.trim(), release: release.value.trim(), genre: genre.value.trim(),
        synopsis: synopsis.value.trim(), participation: participation.value,
        maxTurns: Number(maxTurns.value) || 20,
      },
      setting: {
        premise: premise.value.trim(),
        canon: canonLines,
        ...(forbiddenLines.length ? { forbidden: forbiddenLines } : {}),
        cast: [{ id: 'someone', name: castName.value.trim(), role: castRole.value.trim(), secret: castSecret.value.trim() }],
        locations: [{ id: 'here', name: locName.value.trim(), desc: locDesc.value.trim() }],
        opening: opening.value.trim(),
        flags: [{ id: 'progress', label: flagLabel.value.trim(), initial: false }],
        counters: [{ id: 'trust', label: counterLabel.value.trim(), initial: 0, min: 0, max: limit }],
        facts: [{ id: 'state', label: factLabel.value.trim(), initial: factInitial.value.trim() }],
        goals: [{ id: 'finish', text: goalText.value.trim(), when: { all: [{ flag: 'progress' }] } }],
        ends: [{ id: 'wrap', text: endText.value.trim(), when: { all: [{ flag: 'progress' }, { counter: 'trust', gte: threshold }] } }],
      },
    };
  };
  const required = [place, id, title, synopsis, author, release, genre, premise, opening, castName, locName, flagLabel, counterLabel, counterMax, factLabel, goalText, endText, endThreshold];
  const validateForm = () => {
    const missing = required.find((field) => !String(field.value ?? '').trim());
    if (missing) { report.set('', { ok: false, error: '请填写作品资料、大方向、开场、人物、地点和收尾条件。' }); missing.focus(); return false; }
    if (lines(canon.value).length < 3) { report.set('', { ok: false, error: '正史（canon）至少写三条：每行一条，主持不能推翻它们。' }); canon.focus(); return false; }
    if (!/^user-[a-z0-9_-]{1,19}$/.test(id.value.trim())) { report.set('', { ok: false, error: '标识须以 user- 开头，最多 24 字符，只能含小写字母、数字、短横线或下划线。' }); id.focus(); return false; }
    const limit = Number(counterMax.value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) { report.set('', { ok: false, error: '计数上限须为 1–100 的整数。' }); counterMax.focus(); return false; }
    const threshold = Number(endThreshold.value);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > limit) { report.set('', { ok: false, error: '收尾阈值须为 0 到计数上限之间的整数。' }); endThreshold.focus(); return false; }
    const turns = Number(maxTurns.value);
    if (!Number.isInteger(turns) || turns < 1 || turns > 200) { report.set('', { ok: false, error: '回合上限须为 1–200 的整数。' }); maxTurns.focus(); return false; }
    return true;
  };

  const freePreview = (result) => {
    if (!result?.free) return el('p', {}, '预览没有返回场景包设定。');
    const setting = result.setting ?? {};
    return el('section', { class: 'fun-story-graph', 'aria-label': '场景包只读预览' },
      el('h4', {}, result.title || '场景包预览'),
      el('p', { class: 'fun-story-note' }, result.eligible ? '当前条件可开始' : '当前条件未满足（地点或版本）'),
      setting.premise ? el('p', {}, setting.premise) : null,
      setting.opening ? el('p', { class: 'fun-story-note' }, `开场：${setting.opening}`) : null,
      (setting.canon ?? []).length ? el('div', {}, el('strong', {}, '正史（不可改写）'),
        el('ul', {}, setting.canon.map((line) => el('li', {}, line)))) : null,
      (setting.cast ?? []).length ? el('p', { class: 'fun-story-note' }, `人物：${setting.cast.join('、')}`) : null,
      (setting.ends ?? []).length ? el('p', { class: 'fun-story-note' }, `可能的收尾：${setting.ends.join('、')}`) : null);
  };
  const previewButton = button('预览表单草稿', async () => {
    if (!validateForm()) return;
    const result = await save(report, JSON.stringify(buildPack()), 'preview', []);
    if (result?.ok) playtestBox.replaceChildren(freePreview(result));
  }, { class: 'fun-story-action' });
  const playtestButton = button('隔离试玩', async () => {
    if (!validateForm()) return;
    playtestBox.replaceChildren();
    const result = await save(report, JSON.stringify(buildPack()), 'playtest', []);
    if (!result?.ok) { report.set('隔离试玩未能继续。', result); return; }
    report.set('试玩只显示开场；真正的每一回合要开始故事之后才有主持。没有写入行程、回忆或解锁。', result);
    playtestBox.replaceChildren(el('div', {}, el('strong', {}, result.path?.[0]?.event ?? '（没有开场）')));
  }, { class: 'fun-story-action' });
  let stickyStatus;
  const saveButton = button('保存自由场景包', async () => {
    if (!validateForm()) return;
    const submitted = fingerprint();
    const result = await save(report, JSON.stringify(buildPack()), 'import', []);
    if (result?.ok && submitted === fingerprint()) { baseline = submitted; stickyStatus.textContent = t.storySaved; }
    onDirty();
  }, { class: 'fun-story-action fun-story-primary fun-story-free-save' });
  const group = (name, content, open = true) => el('details', { class: 'fun-story-group fun-story-free-group', ...(open ? { open: '' } : {}) },
    el('summary', {}, name), el('div', { class: 'fun-story-group-content' }, content));
  const node = el('section', { class: 'fun-story-simple fun-story-free-form', 'aria-label': '自由场景包表单' },
    el('p', { class: 'fun-story-free-note' }, '只写大方向、正史、人物和收尾条件；每一回合怎么演交给主持。写到一半可以展开下面的 JSON 看结构。'),
    group('作品资料', el('div', {},
      el('div', { class: 'fun-story-grid' }, label('地点', place), label('故事标题', title), label('故事标识', id), label('参与方式', participation)),
      el('div', { class: 'fun-story-grid' }, label('作者', author), label('作品版本', release), label('类型', genre), label('回合上限', maxTurns)),
      el('div', { class: 'fun-story-grid' }, label('无剧透简介', synopsis)))),
    group('大方向与正史', el('div', {},
      el('div', { class: 'fun-story-grid' }, label('大方向（premise）', premise)),
      el('div', { class: 'fun-story-grid' }, label('开场白', opening)),
      el('div', { class: 'fun-story-grid' }, label('正史：每行一条，至少三条，主持不能推翻', canon)),
      el('div', { class: 'fun-story-grid' }, label('禁区：每行一条，可选', forbidden)))),
    group('人物与地点', el('div', {},
      el('div', { class: 'fun-story-grid' }, label('人物名字', castName), label('身份 / 关系', castRole), label('他的秘密（玩家不知道）', castSecret)),
      el('div', { class: 'fun-story-grid' }, label('这一幕的地方名', locName), label('这一处的样子', locDesc)))),
    group('状态与收尾', el('div', {},
      el('div', { class: 'fun-story-grid' }, label('进展标记（flag）', flagLabel), label('计数（counter）', counterLabel), label('计数上限', counterMax)),
      el('div', { class: 'fun-story-grid' }, label('现状（fact）', factLabel), label('现状初值', factInitial)),
      el('div', { class: 'fun-story-grid' }, label('目标文案', goalText), label('收尾文案', endText), label('收尾阈值', endThreshold)),
      el('p', { class: 'fun-story-note' }, '达成「进展标记」且计数到阈值时，主持才能请求收尾；程序判定通过才真的结束。'))),
    el('div', { class: 'fun-story-sticky-actions' },
      el('div', { class: 'fun-story-row' }, saveButton, previewButton, playtestButton, stickyStatus = el('span', { class: 'fun-story-sticky-status', role: 'status', 'aria-live': 'polite' }))),
    report.node, playtestBox);
  const controls = [...node.querySelectorAll('input'), ...node.querySelectorAll('select'), ...node.querySelectorAll('textarea')];
  const fingerprint = () => JSON.stringify(controls.map((field) => field.value));
  let baseline = fingerprint();
  const markDirty = () => { onDirty(); stickyStatus.textContent = fingerprint() === baseline ? '' : t.storyEditorDirty; };
  for (const field of controls) for (const eventName of ['input', 'change']) field.addEventListener(eventName, markDirty);
  function update(items) {
    const selected = place.value;
    place.replaceChildren(el('option', { value: '' }, '选择地点'),
      ...items.map((item) => el('option', { value: item.id }, item.name || item.id)));
    place.value = selected || '';
    if (!selected) baseline = fingerprint();
  }
  update([]);
  return { node, update, isDirty: () => fingerprint() !== baseline };
}

export function mountStories(ctx) {
  const { root } = ctx;
  const t = storyText(ctx.language);
  // v2：旧键曾被「从故事首页进作者视图」强制写成 expanded，换了键才不会一进来就是大表单。
  const storageKey = `fun:story-editor:v2:${ctx.worldId ?? ctx.pageId ?? 'world:fun'}`;
  const storage = () => root.ownerDocument?.defaultView?.localStorage ?? globalThis.localStorage;
  let expanded = false;
  try { expanded = storage()?.getItem(storageKey) === 'expanded'; } catch { /* Storage can be denied by the host. */ }
  const box = el('div', { class: 'fun-stories' });
  root.replaceChildren(el('style', {}, CSS), box);
  let busy = false;
  let listRequest = 0;
  let lastPacks;
  let draftEdits = 0;
  let jsonBaseline = '';
  let editingId = '';
  const jsonDrafts = new Map();
  const dirtyBadge = el('span', { class: 'fun-story-dirty', role: 'status' });
  const authorContent = el('div', { class: 'fun-story-author-content', id: 'fun-story-author-content' });
  const editorToggle = button('', () => setExpanded(!expanded), { class: 'fun-story-editor-toggle', 'aria-controls': 'fun-story-author-content' });
  const authoring = el('section', { class: 'fun-story-editor fun-story-authoring', 'aria-label': t.storyEditorTitle },
    el('div', { class: 'fun-story-editor-head' }, el('h3', {}, t.storyEditorTitle), dirtyBadge, editorToggle), authorContent);
  function updateDirty() {
    const otherDirty = [...jsonDrafts].some(([id, cached]) => id !== editingId && cached.value !== cached.baseline);
    const dirty = Boolean(simple?.isDirty() || free?.isDirty() || draft?.value !== jsonBaseline || otherDirty);
    dirtyBadge.textContent = dirty ? t.storyEditorDirty : '';
    dirtyBadge.hidden = !dirty;
  }
  function setExpanded(value, scroll = false) {
    expanded = value;
    authorContent.hidden = !value;
    editorToggle.setAttribute('aria-expanded', String(value));
    editorToggle.textContent = value ? t.storyEditorCollapse : t.storyEditorExpand;
    try { storage()?.setItem(storageKey, value ? 'expanded' : 'collapsed'); } catch { /* Folding remains usable without storage. */ }
    updateDirty();
    if (scroll) authoring.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  function button(text, handler, attrs = {}) {
    const node = el('button', { type: 'button', ...attrs }, text);
    node.addEventListener('click', () => {
      if (node.getAttribute('aria-disabled') !== 'true' && !ctx.signal?.aborted) handler();
    });
    return node;
  }

  const errorResult = (error) => ({ ok: false, error: error?.message ?? String(error) });
  function setBusy(value) {
    busy = value;
    for (const node of box.querySelectorAll('.fun-story-action')) node.setAttribute('aria-disabled', String(value));
  }
  async function run(report, pending, method, args, render) {
    if (busy) return;
    setBusy(true);
    report.set(pending);
    try {
      const result = await ctx.invoke(method, [args]);
      if (!ctx.signal?.aborted) await render(result ?? { ok: false, error: '返回结果为空。' });
      return result;
    } catch (error) {
      if (!ctx.signal?.aborted) report.set('', errorResult(error));
      return errorResult(error);
    } finally {
      if (!ctx.signal?.aborted) setBusy(false);
    }
  }

  const place = el('select', { class: 'fun-story-place' });
  const defaultPlace = () => el('option', { value: '' }, '默认地点');
  place.appendChild(defaultPlace());
  const draft = el('textarea', { class: 'fun-story-json', rows: '8', spellcheck: 'false', placeholder: '粘贴故事包 JSON…' });
  const overwrite = el('input', { type: 'checkbox', class: 'fun-story-overwrite' });
  const editorReport = feedback();
  const editorResult = el('div', { class: 'fun-story-result' });
  // List renders and pending requests never replace the editable control.
  draft.addEventListener('input', () => {
    draftEdits += 1;
    if (!busy) editorReport.set();
    editorResult.replaceChildren();
    updateDirty();
  });
  const editingLabel = el('p', { class: 'fun-story-note fun-story-editing', role: 'status' });
  const advanced = el('details', { class: 'fun-story-advanced' });
  const retainJson = () => jsonDrafts.set(editingId, { value: draft.value, baseline: jsonBaseline, overwrite: overwrite.checked });
  function loadJson(value, id = '', title = '') {
    retainJson();
    editingId = id;
    const cached = jsonDrafts.get(id);
    const retained = id && cached?.value === cached?.baseline ? null : cached;
    draft.value = retained?.value ?? value;
    jsonBaseline = retained?.baseline ?? value;
    overwrite.checked = retained?.overwrite ?? Boolean(id);
    draftEdits += 1;
    editingLabel.textContent = id ? `${t.storyEditing} · ${title || id}` : '';
    editorResult.replaceChildren();
    editorReport.set(retained && retained.value !== retained.baseline ? t.storyEditRetained : id ? t.storyEditLoaded : t.storyNewJsonReady);
    advanced.open = true;
    setExpanded(true, true);
    draft.focus({ preventScroll: true });
  }

  function editAction(text, method, pending) {
    return button(text, () => {
      const json = draft.value;
      const edits = draftEdits;
      const placeId = place.value;
      const args = method === 'template' ? (placeId ? { placeId } : {}) : { json };
      if (method === 'import' && overwrite.checked) args.replace = true;
      editorResult.replaceChildren();
      void run(editorReport, pending, method, args, async (result) => {
        const changed = draftEdits !== edits || draft.value !== json;
        const previous = changed ? '上次提交：' : '';
        if (method === 'template') {
          if (result.ok && !changed && (!draft.value || draft.value === jsonBaseline)) {
            if (typeof result.json !== 'string') throw new Error('模板没有返回 JSON。');
            draft.value = result.json;
            jsonBaseline = '';
            editingId = '';
            editingLabel.textContent = '';
            overwrite.checked = false;
            updateDirty();
          } else if (result.ok && !changed) {
            const output = el('textarea', { class: 'fun-story-export', rows: '6', readonly: '', spellcheck: 'false' });
            output.value = result.json;
            editorResult.appendChild(output);
          }
          editorReport.set(result.ok ? (changed || draft.value !== result.json ? '草稿已修改，保留当前内容。' : '模板已填入。') : '', result);
        } else if (method === 'validate') {
          editorReport.set(previous + (result.ok ? '校验通过。' : '校验未通过。'), result);
        } else if (method === 'preview') {
          editorReport.set(previous + (result.ok ? '只读预览已生成。' : '预览失败。'), result);
          if (result.ok) editorResult.appendChild(previewGraph(result));
        } else {
          editorReport.set(previous + (result.ok ? `已导入${result.id ? ` · ${result.id}` : ''}。` : '导入失败。'), result);
          if (result.ok) {
            if (!changed) jsonBaseline = json;
            overwrite.checked = false;
            updateDirty();
            await load();
          }
        }
      });
    }, { class: `fun-story-action${method === 'import' ? ' fun-story-primary' : ''}` });
  }

  const loadReport = feedback();
  const libraryReport = feedback();
  const packList = el('div', { class: 'fun-story-list' });
  const refreshButton = button('刷新列表', () => { void load(); });
  let packFilter = 'all';
  let lastData = null;
  const countNote = el('span', { class: 'fun-story-count' });
  const filterButtons = [];
  const filters = el('nav', { class: 'fun-story-filters', 'aria-label': '作品筛选' });
  for (const [id, label] of [['all', '全部作品'], ['builtin', '内置故事'], ['mine', '我的作品']]) {
    const node = button(label, () => { packFilter = id; syncFilters(); renderCards(); }, { 'aria-pressed': 'false' });
    node.setAttribute('data-filter', id);
    filterButtons.push(node);
    filters.appendChild(node);
  }
  function syncFilters() {
    for (const node of filterButtons) node.setAttribute('aria-pressed', String(node.getAttribute('data-filter') === packFilter));
  }
  syncFilters();
  const savePack = (report, json, method = 'import', path = []) => run(
    report, method === 'playtest' ? '正在隔离试玩…' : '正在保存新故事包…', method, { json, ...(method === 'playtest' ? { path } : {}) }, async (result) => {
      if (method === 'preview') {
        report.set(result.ok ? '只读预览已生成，没有保存故事或推进行程。' : '预览失败。', result);
        return;
      }
      if (method === 'playtest') {
        report.set(result.ok ? '试玩仅使用临时状态，没有写入正式行程或解锁。' : '隔离试玩失败。', result);
        return;
      }
      report.set(result.ok ? `已保存新故事包${result.id ? ` · ${result.id}` : ''}。` : '保存失败。', result);
      if (result.ok) await load();
    });
  const simple = simpleEditor(button, savePack, updateDirty, t);
  const free = freeEditor(button, savePack, updateDirty, t);
  let authorMode = 'static';
  const staticTab = button('选项式故事', () => setAuthorMode('static'), { role: 'tab', class: 'fun-story-mode-tab', 'aria-selected': 'true' });
  const freeTab = button('自由场景包', () => setAuthorMode('free'), { role: 'tab', class: 'fun-story-mode-tab', 'aria-selected': 'false' });
  const modeBar = el('div', { class: 'fun-story-mode', role: 'tablist', 'aria-label': '故事类型' }, staticTab, freeTab);
  function setAuthorMode(mode) {
    authorMode = mode;
    staticTab.setAttribute('aria-selected', String(mode === 'static'));
    freeTab.setAttribute('aria-selected', String(mode === 'free'));
    simple.node.hidden = mode !== 'static';
    free.node.hidden = mode !== 'free';
    updateDirty();
  }
  advanced.appendChild(el('summary', {}, t.storyJsonEditor));
  advanced.appendChild(el('section', { class: 'fun-story-json-editor', 'aria-label': '高级 JSON 编辑器' },
    el('div', { class: 'fun-story-row' }, el('h3', {}, '完整 JSON'), button(t.storyNewJson, () => loadJson(''))), editingLabel,
    el('div', { class: 'fun-story-row' }, el('label', { class: 'fun-story-field' }, '模板地点', place),
      editAction('填入模板', 'template', '正在取模板…'),
      button('自由模式模板', () => {
        const placeId = place.value;
        const args = { ...(placeId ? { placeId } : {}), mode: 'free' };
        editorResult.replaceChildren();
        void run(editorReport, '正在取模板…', 'template', args, (result) => {
          if (!result.ok || typeof result.json !== 'string') { editorReport.set('模板没有返回 JSON。', result); return; }
          draft.value = result.json;
          jsonBaseline = '';
          editingId = '';
          editingLabel.textContent = '';
          advanced.open = true;
          setExpanded(true, true);
          updateDirty();
          editorReport.set('自由模式模板已填入：只写设定与收尾条件，不写分支。', result);
        });
      }, { class: 'fun-story-action' })),
    el('label', { class: 'fun-story-field' }, '故事包 JSON', draft),
    el('div', { class: 'fun-story-row' }, editAction('校验 JSON', 'validate', '正在校验…'),
      editAction('预览草稿', 'preview', '正在预览…'), editAction('导入故事包', 'import', '正在导入…'),
      el('label', { class: 'fun-story-field' }, overwrite, '覆盖同 ID 故事包')),
    editorReport.node, editorResult));
  authorContent.appendChild(el('p', { class: 'fun-story-note' }, t.storyDraftHint));
  authorContent.appendChild(modeBar);
  authorContent.appendChild(simple.node);
  authorContent.appendChild(free.node);
  authorContent.appendChild(advanced);
  setAuthorMode('static');
  setExpanded(expanded);
  // 右侧栏就是三个起点：新建两种模式、或直接贴 JSON。窄屏没有这一栏，
  // 标题条上的「＋ 编写故事」和创作区里的模式页签仍然能到同样的地方。
  function startNew(mode) {
    setAuthorMode(mode);
    setExpanded(true, true);
    const first = mode === 'free' ? free.node.querySelector('.fun-story-free-title') : simple.node.querySelector('.fun-story-author-title');
    first?.focus?.({ preventScroll: true });
  }
  const rail = el('aside', { class: 'fun-story-rail', 'aria-label': '从一个小片段开始' },
    el('h3', {}, '从一个小片段开始'),
    el('p', {}, '先选地点，再写开场、人物与分支。想让故事顺着走，也可以做一个只写设定的场景包。'),
    el('div', { class: 'fun-story-rail-actions' },
      button('新建选项式故事', () => startNew('static')),
      button('新建自由场景包', () => startNew('free')),
      button('导入完整 JSON', () => {
        setExpanded(true, true);
        advanced.open = true;
        draft.focus({ preventScroll: true });
      })),
    el('p', { class: 'fun-story-rail-quote' }, '高级 JSON、校验与隔离试玩，都留在左边的创作区里。'));
  const newButton = button(`＋ ${t.storyWrite}`, () => startNew('static'), { class: 'fun-story-primary fun-story-new' });
  box.replaceChildren(
    el('header', { class: 'fun-story-heading fun-story-head' },
      el('div', { class: 'fun-story-head-main' },
        el('p', { class: 'fun-story-kicker' }, '从0开始的肥鱼大冒险 · 给下一次出游，写一个故事。'),
        el('h2', {}, '给下一次出游，写一个故事。'),
        el('p', { class: 'fun-story-note' }, '故事库、创作与试玩放在一起；平时只看作品，编辑时再展开。')),
      el('div', { class: 'fun-story-head-actions' }, newButton)),
    el('div', { class: 'fun-story-layout' },
      el('div', { class: 'fun-story-main' },
        authoring,
        el('section', { class: 'fun-story-library', 'aria-label': '故事包列表' },
          el('div', { class: 'fun-story-row' }, el('h3', {}, '已收录故事包'), countNote, refreshButton),
          filters, loadReport.node, libraryReport.node, packList)),
      rail));

  function packCard(pack) {
    const title = pack.title || pack.id;
    const metadata = pack.metadata;
    const durationLabel = metadata?.durationMinutes === undefined ? '时长未知' : `${metadata.durationMinutes} 分钟`;
    const report = feedback();
    const resultBox = el('div', { class: 'fun-story-result' });
    const confirm = el('div', { class: 'fun-story-confirm' });
    const packAction = (text, key, handler, css = '') => button(text, handler, {
      class: `fun-story-action ${css}`, 'aria-disabled': String(busy),
      'aria-label': `${text} ${title}`, 'data-story-focus': `${pack.id}:${key}`,
    });
    const read = (method, label) => {
      const opener = packAction(label, method, () => {
        confirm.replaceChildren();
        resultBox.replaceChildren();
        void run(report, method === 'preview' ? '正在预览…' : '正在导出…', method, { id: pack.id }, (result) => {
          report.set(result.ok ? (method === 'preview' ? '只读预览已生成。' : '已导出，可复制 JSON。') : '', result);
          if (!result.ok) return;
          if (method === 'preview') {
            resultBox.appendChild(previewGraph(result));
          } else {
            if (typeof result.json !== 'string') throw new Error('导出没有返回 JSON。');
            const output = el('textarea', { class: 'fun-story-export', rows: '6', readonly: '', spellcheck: 'false' });
            output.value = result.json;
            resultBox.appendChild(el('label', { class: 'fun-story-field' }, `导出的 JSON · ${title}`, output));
          }
          resultBox.appendChild(button('收起', () => {
            resultBox.replaceChildren();
            report.set();
            opener.focus();
          }));
        });
      });
      return opener;
    };
    const mutate = (method, label) => {
      void run(report, `正在${label}…`, method, { id: pack.id }, async (result) => {
        libraryReport.set();
        report.set('', result);
        if (!result.ok) return;
        libraryReport.set(`已${label}「${title}」。`, result);
        await load();
        confirm.replaceChildren();
      });
    };
    const toggle = pack.enabled ? ['disable', '停用'] : ['enable', '启用'];
    const remove = pack.builtin ? null : packAction('移除', 'remove', () => {
      const cancel = button('取消', () => { confirm.replaceChildren(); remove.focus(); });
      confirm.replaceChildren(el('span', {}, `移除「${title}」？`),
        el('div', { class: 'fun-story-row' }, cancel, packAction('确认移除', 'confirm', () => mutate('remove', '移除'), 'fun-story-danger')));
      cancel.focus();
    }, 'fun-story-danger');
    const warnings = pack.warnings?.length ? pack.warnings : pack.available === false ? ['绑定地点或区域当前不匹配。'] : [];
    // 作品卡左边留一块该地点的原创线稿；没有绑定地点时用通用图。
    const cover = el('div', { class: 'fun-story-cover', 'aria-hidden': 'true' });
    cover.innerHTML = venueArtwork(pack.placeId || '');
    const body = el('div', { class: 'fun-story-body' },
      el('div', { class: 'fun-story-row' }, el('h4', {}, title),
        el('span', { class: 'fun-story-badge' }, pack.builtin ? '内置' : '自定义'),
        el('span', { class: 'fun-story-badge' }, pack.enabled ? '已启用' : '已停用'),
        pack.available === false ? el('span', { class: 'fun-story-badge fun-story-unavailable' }, '暂不可用') : null),
      el('p', { class: 'fun-story-note' }, `${pack.placeName || pack.placeId || '未绑定地点'} · ${pack.nodeCount} 个节点 · 格式 v${pack.formatVersion ?? 1} · ${pack.revision}`),
      metadata ? el('p', { class: 'fun-story-note' }, `作者：${metadata.author} · 类型：${metadata.genre} · ${metadata.participation === 'duo' ? '双人' : '单人'} · 时长：${durationLabel}`) : el('p', { class: 'fun-story-note' }, `时长未知 · ${pack.nodeCount} 个节点不用于估算时长`),
      pack.description ? el('p', {}, pack.description) : null,
      warnings.length ? el('div', { class: 'fun-story-note' }, messageList(warnings)) : null,
      el('div', { class: 'fun-story-row' }, packAction(t.storyEdit, 'edit', () => {
        const edits = draftEdits;
        const before = draft.value;
        void run(report, t.storyEditLoading, 'export', { id: pack.id }, (result) => {
          if (!result.ok) { report.set('', result); return; }
          if (typeof result.json !== 'string') throw new Error('导出没有返回 JSON。');
          if (draftEdits !== edits || draft.value !== before) { report.set(t.storyEditChanged); return; }
          loadJson(result.json, pack.id, title);
          report.set();
        });
      }), read('preview', '预览'), read('export', '导出 JSON'),
        packAction(toggle[1], 'toggle', () => mutate(...toggle)), remove), confirm, report.node, resultBox);
    return el('article', { class: 'fun-story-pack', 'data-pack-id': pack.id }, cover, body);
  }

  /** 按页签画作品卡；切换页签只重画列表，不动创作区里的草稿。 */
  function renderCards() {
    if (!lastData) return;
    const packs = lastData.packs ?? [];
    const visible = packs.filter((pack) => packFilter === 'all'
      || (packFilter === 'builtin' ? Boolean(pack.builtin) : !pack.builtin));
    countNote.textContent = `${visible.length} 篇故事 · 选项式与自由模式`;
    lastPacks = `${packFilter}|${JSON.stringify(packs)}`;
    syncFilters();
    if (visible.length) { packList.replaceChildren(...visible.map(packCard)); return; }
    packList.replaceChildren(el('section', { class: 'fun-story-empty' },
      el('h4', {}, packFilter === 'all' ? t.storyEmptyTitle : packFilter === 'builtin' ? '还没有内置故事' : '还没有自己的作品'),
      el('p', { class: 'fun-story-note' }, packFilter === 'all'
        ? t.storyEmptyBody
        : packFilter === 'builtin' ? '内置故事随版本提供，停用后仍会留在这里。' : '从右侧新建一篇，或用完整 JSON 导入。'),
      packFilter === 'all' ? button(t.storyWrite, () => { setExpanded(true, true); editorToggle.focus({ preventScroll: true }); }) : null));
  }

  function renderList(data) {
    lastData = data;
    const selected = place.value;
    place.replaceChildren(defaultPlace(), ...data.places.map((item) => el('option', { value: item.id }, item.name || item.id)),
      ...(selected && !data.places.some((item) => item.id === selected) ? [el('option', { value: selected }, selected)] : []));
    place.value = selected;
    simple.update(data.places);
    free.update(data.places);
    const signature = `${packFilter}|${JSON.stringify(data.packs)}`;
    if (signature === lastPacks) return;
    const focused = root.activeElement ?? document.activeElement;
    const buttonWasFocused = [...packList.querySelectorAll('button')].includes(focused);
    const focusKey = focused?.getAttribute?.('data-story-focus');
    renderCards();
    if (buttonWasFocused) {
      const replacement = [...packList.querySelectorAll('button')].find((node) => focusKey && node.getAttribute('data-story-focus') === focusKey);
      (replacement || refreshButton).focus();
    }
  }

  async function load() {
    if (ctx.signal?.aborted) return;
    const sequence = ++listRequest;
    refreshButton.setAttribute('aria-disabled', 'true');
    loadReport.set('正在读取故事包…');
    try {
      const data = await ctx.invoke('list', []);
      if (sequence !== listRequest || ctx.signal?.aborted) return;
      if (!data?.ok) {
        loadReport.set('列表加载失败。', data ?? { ok: false });
        return;
      }
      renderList(data);
      loadReport.set('', data);
    } catch (error) {
      if (sequence === listRequest && !ctx.signal?.aborted) loadReport.set('列表加载失败。', errorResult(error));
    } finally {
      if (sequence === listRequest && !ctx.signal?.aborted) {
        refreshButton.setAttribute('aria-disabled', 'false');
        refreshButton.textContent = loadReport.node.querySelector('.fun-story-errors').textContent ? '重试' : '刷新列表';
      }
    }
  }

  void load();
  return { refresh: load, expand: () => setExpanded(true, true) };
}
