/** Venue story pack authoring for Coo WebUI. */
const CSS = `
.fun-stories{--fs-line:var(--border,#e3e4e3);--fs-ink:var(--foreground,#1b1a1e);--fs-dim:var(--muted-foreground,#5c5c60);--fs-card:var(--surface,#fbfbfb);--fs-soft:color-mix(in srgb,var(--fs-card) 93%,var(--fs-ink));--fs-accent:var(--accent,#00a870);--fs-error:var(--destructive,#b23b35);font:14px/1.65 var(--sans,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);color:var(--fs-ink);padding:8px 4px 24px;overflow-wrap:anywhere}
.fun-stories *{box-sizing:border-box}
.fun-stories h2,.fun-stories h3,.fun-stories h4,.fun-stories p{margin:0}
.fun-stories h2{font-size:20px}.fun-stories h3{font-size:15px}.fun-stories h4{font-size:14px}
.fun-story-heading{margin-bottom:14px;padding:4px 0 12px;border-bottom:1px solid var(--fs-line)}
.fun-story-note,.fun-story-field,.fun-story-feedback{color:var(--fs-dim);font-size:12px}
.fun-story-editor,.fun-story-pack{border:1px solid var(--fs-line);border-radius:12px;background:var(--fs-card);padding:12px;margin-bottom:9px}
.fun-story-editor{background:var(--fs-soft);margin-bottom:16px}
.fun-story-editor>summary{cursor:pointer;font-weight:600}
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
@media(max-width:420px){.fun-stories{padding-inline:0}.fun-story-editor,.fun-story-pack{padding:10px}}
`;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children.flat()) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

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
    ...items.map(({ value, label }) => el('option', { value }, label)));
  select.value = items.some((item) => item.value === selected) ? selected : '';
}

function simpleEditor(button, save) {
  const select = (key) => el('select', { class: `fun-story-author-${key}`, 'data-story-field': key });
  const input = (key, max, type = 'text') => el('input', { class: `fun-story-author-${key}`, type, 'data-story-field': key, ...(max ? { maxlength: String(max) } : {}) });
  const place = select('place');
  const area = select('area');
  const id = input('id', 24);
  id.value = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const title = input('title', 80);
  const event = input('event', 120);
  const prompt = input('prompt', 160);
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
  const saveButton = button('保存新故事包', () => {
    const fields = [place, area, id, title, event, prompt, ...branches.flatMap((branch) => [branch.choice, branch.result, branch.event])];
    const missing = fields.find((field) => !field.value.trim());
    if (missing) {
      report.set('', { ok: false, error: '请填写地点、起始区域和故事内容。' });
      missing.focus();
      return;
    }
    if (!/^user-[a-z0-9_-]{1,19}$/.test(id.value.trim())) {
      report.set('', { ok: false, error: '标识须以 user- 开头，最多 24 字符，只能含小写字母、数字、短横线或下划线。' });
      id.focus();
      return;
    }
    if (Boolean(from.value) !== Boolean(to.value) || (from.value && from.value === to.value)) {
      report.set('', { ok: false, error: '请填写不同的开始和结束时间，或将两项都留空。' });
      (from.value && !to.value ? to : from).focus();
      return;
    }
    const start = { id: 'start', area: area.value, event: event.value.trim(), prompt: prompt.value.trim(),
      choices: branches.map((branch) => ({ id: branch.key, label: branch.choice.value.trim(), result: branch.result.value.trim(), next: `end-${branch.key}` })) };
    if (from.value) start.when = { from: from.value, to: to.value };
    const nodes = [start, ...branches.map((branch) => ({ id: `end-${branch.key}`, area: branch.area.value || area.value, event: branch.event.value.trim() }))];
    save(report, JSON.stringify({ version: 1, id: id.value.trim(), title: title.value.trim(), placeId: place.value, start: start.id, nodes }));
  }, { class: 'fun-story-action fun-story-primary' });
  const node = el('section', { class: 'fun-story-editor', 'aria-label': '编写故事' },
    el('h3', {}, '编写故事'),
    el('div', { class: 'fun-story-grid' }, label('地点', place), label('起始区域', area), label('故事标题', title), label('故事标识', id)),
    el('div', { class: 'fun-story-grid' }, label('起始事件', event), label('选择提问', prompt)),
    el('div', { class: 'fun-story-grid fun-story-branches' }, branches.map((branch) => branch.node)),
    el('details', {}, el('summary', {}, '触发时段（可选）'),
      el('div', { class: 'fun-story-grid' }, label('开始时间', from), label('结束时间', to))),
    el('div', { class: 'fun-story-row' }, saveButton), report.node);
  function update(items) {
    places = items;
    fillSelect(place, items.map((item) => ({ value: item.id, label: item.name || item.id })), '选择地点');
    updateAreas();
  }
  update([]);
  return { node, update };
}

export function mountStories(ctx) {
  const { root } = ctx;
  const box = el('div', { class: 'fun-stories' });
  root.replaceChildren(el('style', {}, CSS), box);
  let busy = false;
  let listRequest = 0;
  let lastPacks;
  let draftEdits = 0;

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
    } catch (error) {
      if (!ctx.signal?.aborted) report.set('', errorResult(error));
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
  });

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
          if (result.ok && !changed) {
            if (typeof result.json !== 'string') throw new Error('模板没有返回 JSON。');
            draft.value = result.json;
            overwrite.checked = false;
          }
          editorReport.set(result.ok ? (changed ? '草稿已修改，保留当前内容。' : '模板已填入。') : '', result);
        } else if (method === 'validate') {
          editorReport.set(previous + (result.ok ? '校验通过。' : '校验未通过。'), result);
        } else if (method === 'preview') {
          editorReport.set(previous + (result.ok ? '只读预览已生成。' : '预览失败。'), result);
          if (result.ok) editorResult.appendChild(previewGraph(result));
        } else {
          editorReport.set(previous + (result.ok ? `已导入${result.id ? ` · ${result.id}` : ''}。` : '导入失败。'), result);
          if (result.ok) {
            overwrite.checked = false;
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
  const simple = simpleEditor(button, (report, json) => {
    void run(report, '正在保存新故事包…', 'import', { json }, async (result) => {
      report.set(result.ok ? `已保存新故事包${result.id ? ` · ${result.id}` : ''}。` : '保存失败。', result);
      if (result.ok) await load();
    });
  });
  box.replaceChildren(
    el('header', { class: 'fun-story-heading' }, el('h2', {}, '故事包'),
      el('p', { class: 'fun-story-note' }, '为地点编写事件节点与分支。草稿仅在导入时保存。')),
    simple.node,
    el('details', { class: 'fun-story-advanced' },
      el('summary', {}, '高级编辑 · 查看或粘贴完整 JSON'),
      el('section', { class: 'fun-story-editor', 'aria-label': '高级 JSON 编辑器' },
        el('h3', {}, '完整 JSON'),
        el('div', { class: 'fun-story-row' }, el('label', { class: 'fun-story-field' }, '模板地点', place),
          editAction('填入模板', 'template', '正在取模板…')),
        el('label', { class: 'fun-story-field' }, '故事包 JSON', draft),
        el('div', { class: 'fun-story-row' }, editAction('校验 JSON', 'validate', '正在校验…'),
          editAction('预览草稿', 'preview', '正在预览…'), editAction('导入故事包', 'import', '正在导入…'),
          el('label', { class: 'fun-story-field' }, overwrite, '覆盖同 ID 故事包')),
        editorReport.node, editorResult)),
    el('section', { 'aria-label': '故事包列表' },
      el('div', { class: 'fun-story-row' }, el('h3', {}, '已收录故事包'), refreshButton),
      loadReport.node, libraryReport.node, packList));

  function packCard(pack) {
    const title = pack.title || pack.id;
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
    return el('article', { class: 'fun-story-pack', 'data-pack-id': pack.id },
      el('div', { class: 'fun-story-row' }, el('h4', {}, title),
        el('span', { class: 'fun-story-badge' }, pack.builtin ? '内置' : '自定义'),
        el('span', { class: 'fun-story-badge' }, pack.enabled ? '已启用' : '已停用'),
        pack.available === false ? el('span', { class: 'fun-story-badge fun-story-unavailable' }, '暂不可用') : null),
      el('p', { class: 'fun-story-note' }, `${pack.placeName || pack.placeId || '未绑定地点'} · ${pack.nodeCount} 个节点 · 版本 ${pack.revision}`),
      pack.description ? el('p', {}, pack.description) : null,
      warnings.length ? el('div', { class: 'fun-story-note' }, messageList(warnings)) : null,
      el('div', { class: 'fun-story-row' }, read('preview', '预览'), read('export', '导出 JSON'),
        packAction(toggle[1], 'toggle', () => mutate(...toggle)), remove), confirm, report.node, resultBox);
  }

  function renderList(data) {
    const selected = place.value;
    place.replaceChildren(defaultPlace(), ...data.places.map((item) => el('option', { value: item.id }, item.name || item.id)));
    place.value = data.places.some((item) => item.id === selected) ? selected : '';
    simple.update(data.places);
    const signature = JSON.stringify(data.packs);
    if (signature === lastPacks) return;
    const focused = root.activeElement ?? document.activeElement;
    const buttonWasFocused = [...packList.querySelectorAll('button')].includes(focused);
    const focusKey = focused?.getAttribute?.('data-story-focus');
    const cards = data.packs.map(packCard);
    packList.replaceChildren(...(cards.length ? cards : [el('p', { class: 'fun-story-note' }, '还没有故事包。')]));
    lastPacks = signature;
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
  return { refresh: load };
}
