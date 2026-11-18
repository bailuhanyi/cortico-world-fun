/**
 * 娱乐时间面板的浏览器端（Coo WebUI 扩展面板）。
 *
 * 约定（照 feed-world 的做法，见宿主 client-panel）：
 *   · 默认导出 `{ panels: { <panelId>: { mount(ctx) } } }`
 *   · 只往 `ctx.root` 里写 DOM，不碰 document.body
 *   · 数据一律走 `ctx.invoke(method, args)`，**不读私有状态、不算时间**
 *   · 定时器只用 `ctx.interval` / `ctx.timeout`（宿主会在面板关掉时 dispose）
 *
 * 样式：注入一个 <style> 到 ctx.root 里。宿主可能是普通 DOM 也可能是 shadow root，
 * 光靠外部 css 在 shadow root 里吃不到；注入 <style> 两边都成立。
 * 颜色走宿主主题的自定义属性（--surface/--foreground/--border/--accent…），
 * 自定义属性会继承进 shadow root，所以明暗两套主题都不用自己写。
 *
 * 三个面板：
 *   places —— 二十处地方（以及自己加的、改过的）此刻的状态，以及她正在逛的这一趟
 *   book   —— 纪念册：去过的每一趟与出游心愿
 *   shelf  —— 纪念品架：长期收藏与探索进度
 */

const CSS = `
.fun{--f-line:var(--border,#e3e4e3);--f-ink:var(--foreground,#1b1a1e);--f-dim:var(--muted-foreground,#5c5c60);--f-card:var(--surface,#fbfbfb);--f-soft:color-mix(in srgb,var(--surface,#fbfbfb) 92%,var(--foreground,#1b1a1e));--f-accent:var(--accent,#00a870);--f-warm:#e0862f;--f-mint:#00a870;font:13px/1.6 var(--sans,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);color:var(--f-ink);padding:4px 2px 24px}
.fun *{box-sizing:border-box}
.fun-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.fun input,.fun select,.fun button{font:inherit;color:inherit;background:var(--f-card);border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:5px 9px;outline:none}
.fun input:focus,.fun select:focus{border-color:var(--f-accent)}
.fun-search{flex:1;min-width:140px}
.fun button{cursor:pointer;transition:background .12s,border-color .12s}
.fun button:hover{border-color:var(--f-accent)}
.fun-btn-primary{background:var(--f-accent);border-color:var(--f-accent);color:#fff;font-weight:600}
.fun-btn-primary:hover{filter:brightness(1.06)}
.fun-btn-primary[disabled]{opacity:.55;cursor:default;filter:none}
.fun-dim{color:var(--f-dim)}
.fun-sec{font-weight:600;margin:14px 0 7px;font-size:12px;letter-spacing:.04em;color:var(--f-dim);text-transform:none}
.fun-sec:first-child{margin-top:2px}

/* 正在逛的那一趟 */
.fun-live{border:1px solid var(--f-line);border-left:3px solid var(--f-accent);border-radius:var(--radius-sm,6px);padding:9px 12px;margin-bottom:12px;background:var(--f-card)}
.fun-live-idle{border-left-color:var(--f-line)}
.fun-live h3{margin:0 0 3px;font-size:14px;font-weight:600}
.fun-live .fun-meta{font-size:12px;color:var(--f-dim);margin-bottom:6px}
.fun-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.fun-chip{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid var(--f-line);background:var(--f-soft);color:var(--f-dim)}
.fun-chip-on{color:var(--f-ink);border-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 14%,transparent)}
.fun-chip-ate{color:var(--f-ink);border-color:var(--f-warm);background:color-mix(in srgb,var(--f-warm) 14%,transparent)}
.fun-chip-phase{color:var(--f-ink);border-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 10%,transparent);font-size:11px}
.fun-phases{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.fun-detail-desc{font-size:12.5px;line-height:1.65;margin:0 0 7px}
.fun-hint{font-size:11.5px;color:var(--f-dim);margin:0 0 9px;line-height:1.55}
.fun-form{border:1px solid var(--f-accent);border-radius:var(--radius-sm,6px);padding:12px 13px;margin-bottom:12px;background:var(--f-soft)}
.fun-form-title{font-weight:600;font-size:14px;margin-bottom:4px}
.fun-form-note{font-size:11.5px;color:var(--f-dim);line-height:1.55;margin-bottom:9px}
.fun-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-bottom:8px}
.fun-field{display:flex;flex-direction:column;gap:3px;margin-bottom:7px;min-width:0}
.fun-field-label{font-size:11.5px;color:var(--f-dim);font-weight:600}
.fun input,.fun select,.fun textarea{font:inherit;color:inherit;background:var(--f-card);border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:5px 9px;outline:none;width:100%}
.fun textarea{resize:vertical;line-height:1.5}
.fun input:focus,.fun select:focus,.fun textarea:focus{border-color:var(--f-accent)}
.fun-form-actions{display:flex;gap:8px;align-items:center;margin-top:9px;flex-wrap:wrap}
.fun-form-error{color:#d9534f;font-size:12px;margin-bottom:7px;min-height:1em}
.fun-danger{margin-left:auto;border-color:#d9534f;color:#d9534f}
.fun-detail-actions{display:flex;gap:6px;align-items:center}
.fun-detail-edit{font-size:11.5px;padding:2px 9px;cursor:pointer;background:transparent;border:1px solid var(--f-accent);border-radius:999px;color:var(--f-accent)}
.fun-detail-edit:hover{background:color-mix(in srgb,var(--f-accent) 10%,transparent)}
.fun-note{font-size:11.5px;color:var(--f-dim);margin-top:5px;line-height:1.5}
.fun-stale{color:var(--f-warm)}

/* 场所卡 */
.fun-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:9px;align-items:start}
.fun-cell{display:flex;flex-direction:column;gap:0;min-width:0}
/* 展开的那一格跨满整行：详情太窄会被挤成一条，读起来比原来更难受。 */
.fun-cell-open{grid-column:1/-1}
.fun-card{border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:9px 11px;background:var(--f-card);cursor:pointer;transition:border-color .12s,background .12s}
.fun-card:hover{border-color:var(--f-accent)}
.fun-card:focus-visible{outline:2px solid var(--f-accent);outline-offset:2px}
.fun-card-closed{opacity:.62}
.fun-card-open{border-left:3px solid var(--f-mint)}
.fun-card-soon{border-left:3px solid var(--f-warm)}
.fun-card-active{border-color:var(--f-accent);border-left-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 7%,var(--f-card));border-bottom-left-radius:0;border-bottom-right-radius:0}
.fun-card-active .fun-card-desc{-webkit-line-clamp:2}
.fun-card-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.fun-card-name{font-weight:600;font-size:13.5px}
.fun-card-state{font-size:11.5px;color:var(--f-dim);white-space:nowrap;margin-left:auto}
.fun-card-state-open{color:var(--f-mint)}
.fun-card-state-soon{color:var(--f-warm)}
.fun-card-arrow{font-size:11px;color:var(--f-dim);width:11px;text-align:center;flex:none}
.fun-card-active .fun-card-arrow{color:var(--f-accent)}
.fun-card-desc{font-size:12px;color:var(--f-dim);margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.fun-card-foot{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;font-size:11.5px;color:var(--f-dim)}

/* 详情：紧贴它那张卡、占满整行（不再跑到列表末尾） */
.fun-detail{border:1px solid var(--f-accent);border-top:none;border-radius:0 0 var(--radius-sm,6px) var(--radius-sm,6px);padding:10px 13px 11px;background:var(--f-card)}
.fun-detail-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:5px}
.fun-detail h4{margin:0;font-size:14px}
.fun-detail-close{font-size:11.5px;padding:2px 8px;cursor:pointer;background:transparent;border:1px solid var(--f-line);border-radius:999px;color:var(--f-dim)}
.fun-detail-close:hover{border-color:var(--f-accent);color:var(--f-ink)}
.fun-detail p{margin:0 0 6px;font-size:12.5px}
.fun-detail-cols{display:grid;grid-template-columns:minmax(150px,1fr) minmax(150px,1.2fr);gap:14px;align-items:start}
.fun-detail-col{min-width:0}
.fun-detail-cols .fun-sec{margin-top:0}
@media (max-width:560px){.fun-detail-cols{grid-template-columns:1fr;gap:6px}}
.fun-list{margin:5px 0 0;padding-left:17px;font-size:12.5px}
.fun-list li{margin:2px 0}
.fun-scene{font-size:12px;padding:5px 9px;border-radius:var(--radius-sm,6px);background:var(--f-soft);border:1px solid var(--f-line);margin-top:8px}
.fun-scene b{font-weight:600}

/* 纪念册 */
.fun-trip{border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:9px 12px;margin-bottom:8px;background:var(--f-card)}
.fun-trip-head{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.fun-trip-name{font-weight:600}
.fun-trip-when{font-size:11.5px;color:var(--f-dim);white-space:nowrap}
.fun-trip-sum{margin-top:3px;font-size:12.5px}
.fun-trip-extras{margin-top:5px;font-size:12px;color:var(--f-dim)}
.fun-trip-actions{display:flex;gap:8px;align-items:center;margin-top:7px}
 .fun-trip-actions{display:flex;gap:6px;align-items:center;margin-top:7px}
 .fun-trip-error{font-size:12px;color:#d9534f}
 .fun-toggle[aria-pressed="true"]{border-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 12%,var(--f-card))}
.fun-stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:9px 12px;border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);background:var(--f-card)}
.fun-stat b{display:block;font-size:17px;font-weight:600;line-height:1.25}
.fun-stat span{font-size:11.5px;color:var(--f-dim)}
.fun-empty{padding:22px 12px;text-align:center;color:var(--f-dim);font-size:12.5px}
.fun-err{border:1px solid #d9534f;border-radius:var(--radius-sm,6px);padding:10px 12px;color:#d9534f;background:color-mix(in srgb,#d9534f 10%,transparent);font-size:12.5px}
/* 轻手账：跟随宿主主题，只用少量色彩区分内容层次。 */
.fun{font-size:14px;line-height:1.65;padding:8px 4px 24px;--f-round:12px}
.fun button,.fun input,.fun select{min-height:34px}
.fun button:focus-visible,.fun input:focus-visible,.fun select:focus-visible,.fun textarea:focus-visible,.fun summary:focus-visible{outline:2px solid var(--f-accent);outline-offset:3px}
.fun button:disabled{cursor:default;opacity:.6}
.fun .fun-btn-primary{background:var(--f-accent);border-color:var(--f-accent);color:var(--accent-foreground,#fff)}
.fun-heading{margin-bottom:16px;padding:4px 0 12px;border-bottom:1px solid var(--f-line)}
.fun-heading h2{font-size:20px;line-height:1.4;margin:0 0 4px;letter-spacing:.03em}
.fun-heading p{margin:0;color:var(--f-dim);font-size:12.5px}
.fun-live,.fun-trip,.fun-stats,.fun-form{border-radius:var(--f-round);padding:14px 16px}
.fun-live{background:linear-gradient(120deg,color-mix(in srgb,var(--f-accent) 8%,var(--f-card)),var(--f-card));margin-bottom:16px}
.fun-live h3{font-size:16px}
.fun-grid{grid-template-columns:repeat(auto-fill,minmax(min(232px,100%),1fr));gap:12px}
.fun-card{padding:14px;border-radius:var(--f-round);min-height:136px;background:linear-gradient(180deg,color-mix(in srgb,var(--f-accent) 4%,var(--f-card)),var(--f-card) 65%)}
.fun-card-name{font-size:15px}.fun-card-head{flex-wrap:wrap}.fun-card-desc{line-height:1.7;margin-top:8px}
.fun-detail{padding:16px;border-radius:0 0 var(--f-round) var(--f-round)}
.fun-card-active{border-bottom-left-radius:0;border-bottom-right-radius:0;background:color-mix(in srgb,var(--f-accent) 7%,var(--f-card))}
.fun-tabs,.fun-filters{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0 16px}
.fun-tabs button,.fun-filters button{border-radius:999px;padding:5px 13px;background:transparent}
.fun-tabs button[aria-pressed="true"],.fun-filters button[aria-pressed="true"]{border-color:var(--f-accent);color:var(--f-ink);background:color-mix(in srgb,var(--f-accent) 12%,var(--f-card));font-weight:600}
.fun-stats{gap:18px;background:var(--f-soft);border:none}.fun-stat b{font-size:21px}.fun-stat span{font-size:12px}
.fun-trip-head{flex-wrap:wrap}.fun-trip-name{font-size:14px}.fun-trip-when{white-space:normal}
.fun-date{margin:20px 0 10px;font-size:12px;color:var(--f-dim);font-weight:600;display:flex;align-items:center;gap:10px}
.fun-date:after{content:'';height:1px;background:var(--f-line);flex:1}
.fun-ticket{position:relative;border-left:3px solid color-mix(in srgb,var(--f-accent) 55%,var(--f-line));margin-bottom:12px}
.fun-trip-detail{border-top:1px dashed var(--f-line);margin-top:12px;padding-top:4px}
.fun-trip-detail .fun-sec{margin-top:10px}.fun-trip-detail p{margin:4px 0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
.fun-wish-history{margin-top:14px}.fun-wish-history>summary{cursor:pointer;padding:8px 0;color:var(--f-dim)}
.fun-shelf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(180px,100%),1fr));gap:10px;margin-top:12px}
.fun-keepsake{border:1px solid var(--f-line);border-radius:10px;padding:12px;background:var(--f-soft);min-width:0}
.fun-keepsake>summary{cursor:pointer;line-height:1.7;overflow-wrap:anywhere}.fun-keepsake>summary strong{display:block;color:var(--f-ink);font-weight:600}
.fun-keepsake .fun-trip-sum{border-top:1px dashed var(--f-line);margin-top:9px;padding-top:9px}
.fun-progress{display:block;width:100%;height:7px;margin:10px 0;accent-color:var(--f-accent);border:0;border-radius:8px;overflow:hidden;background:var(--f-line)}
.fun-progress::-webkit-progress-bar{background:var(--f-line);border-radius:8px}.fun-progress::-webkit-progress-value{background:var(--f-accent);border-radius:8px}.fun-progress::-moz-progress-bar{background:var(--f-accent);border-radius:8px}
.fun-feedback:empty{display:none}.fun-feedback{margin:10px 0}.fun-feedback .fun-err{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.fun-loading{padding:18px;color:var(--f-dim);font-size:13px}.fun-empty{border:1px dashed var(--f-line);border-radius:var(--f-round);margin:10px 0;background:var(--f-soft)}
@media(max-width:420px){.fun{padding-inline:0}.fun-live,.fun-trip,.fun-form{padding:12px}.fun-stats{gap:12px}.fun-detail-cols,.fun-form-grid{grid-template-columns:1fr}.fun-detail-top{flex-wrap:wrap}.fun-trip-actions{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.fun *{transition:none!important;scroll-behavior:auto!important}}

`;

/** 小工具：建元素 + 设属性，省掉一屏 createElement。 */
function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'style') Object.assign(n.style, v);
      else n.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.appendChild(typeof kid === 'string' || typeof kid === 'number'
      ? document.createTextNode(String(kid)) : kid);
  }
  return n;
}

/** 只注入一次样式（同一 root 反复 mount 时别叠 <style>）。 */
function ensureStyle(root) {
  if (root.querySelector('style.fun-style')) return;
  root.appendChild(el('style', { class: 'fun-style', text: CSS }));
}

/** 顶层容器。 */
function shell(root) {
  ensureStyle(root);
  const box = el('div', { class: 'fun' });
  root.appendChild(box);
  return box;
}

function errorCard(err, retry, retained = false) {
  return el('div', { class: 'fun-err', role: 'alert' },
    el('span', { text: retained ? `刷新失败，保留上次内容：${err?.message ?? String(err)}` : `面板加载失败：${err?.message ?? String(err)}` }),
    retry ? el('button', { type: 'button', onclick: () => { void retry(); } }, '重试') : null);
}

function heading(title, subtitle) {
  return el('header', { class: 'fun-heading' }, el('h2', { text: title }), el('p', { text: subtitle }));
}

function feedback(box) {
  const node = el('div', { class: 'fun-feedback' });
  box.appendChild(node);
  return node;
}

// ---------------------------------------------------------------------------
// places —— 去哪儿
// ---------------------------------------------------------------------------

function mountPlaces(ctx) {
  const root = ctx.root;
  root.replaceChildren();
  const box = shell(root);
  const body = el('div');
  box.appendChild(body);

  let keyword = '';
  let quickFilter = '全部';
  let expanded = null;
  /** null = 没在编辑；{ mode: 'new' | 'edit', venue } = 打开表单。 */
  let editing = null;
  let formError = '';
  /** 表单打开期间收到的最新数据，等关掉表单再补画，免得把用户填的内容冲掉。 */
  let currentData = null;
  const status = feedback(box);
  body.appendChild(el('div', { class: 'fun-loading', role: 'status', text: '正在看看有哪些地方开着…' }));

  const render = (data) => {
    // 表单相关声明要放在最前：点「添加地点」时 render 会重跑，
    // 而那一轮里 `venueForm()` 在 `if (editing)` 处就会用到 `fields`。
    // 放在后面会撞上 TDZ（`Cannot access 'fields' before initialization`）。
    const renderAll = () => render(data);
    const fields = {};
    const lines = (v) => (Array.isArray(v) ? v.join('\n') : '');
    const parseLines = (s) => String(s ?? '').split(/[\n,，、]/).map((x) => x.trim()).filter(Boolean);
    currentData = data;
    body.replaceChildren(heading('去哪儿', '挑一处喜欢的地方，慢慢逛。'));

    // ---- 正在逛的那一趟 ----
    if (data.session) {
      const s = data.session;
      const venue = data.places.find((p) => p.id === s.placeId);
      const leftAreas = venue
        ? venue.areas.filter((a) => !s.visited.some((v) => v.area === a))
        : [];
      const leftText = leftAreas.length ? `还能逛：${leftAreas.slice(0, 5).join('、')}` : '都逛过了';
      const progress = s.venueAreaCount ? `${s.visited.length}/${s.venueAreaCount}` : String(s.visited.length);
      body.appendChild(el('div', { class: 'fun-live' },
        el('h3', { text: `正在${s.placeName}逛` }),
        el('div', { class: 'fun-meta' },
          `${s.enteredHm} 进门 · 待了 ${s.stayedMin} 分钟 · 逛了 ${progress} 处`,
          s.stale ? el('span', { class: 'fun-stale', text: ' · 这一趟挂得有点久了' }) : null),
        el('div', { class: 'fun-meta', text: `逛过：${s.visited.length ? s.visited.map((v) => v.area).join('、') : '还没逛到哪儿'}` }),
        s.souvenirs.length ? el('div', { class: 'fun-chips' }, s.souvenirs.map((x) => el('span', { class: 'fun-chip fun-chip-on', text: `买了 ${x}` }))) : null,
        s.photos.length ? el('div', { class: 'fun-chips' }, s.photos.map((x) => el('span', { class: 'fun-chip', text: `📷 ${x}` }))) : null,
        (s.ate && s.ate.length)
          ? el('div', { class: 'fun-chips' }, s.ate.map((x) => el('span', { class: 'fun-chip fun-chip-ate', text: `${x.verb}了 ${x.item}` })))
          : null,
        s.events.length ? el('ul', { class: 'fun-list' }, s.events.slice(-3).map((e) => el('li', { text: e }))) : null,
        venue ? el('div', { class: 'fun-meta', text: leftText }) : null,
      ));
    } else {
      body.appendChild(el('div', { class: 'fun-live fun-live-idle' },
        el('h3', { text: '这会儿没在逛' }),
        el('div', { class: 'fun-meta', text: `现在 ${data.nowHm} · ${data.total} 处地方里 ${data.openCount} 处开着` }),
        el('div', { class: 'fun-meta fun-dim', text: '她会自己挑一处进去；你在下面点一张卡也能看细节。' }),
      ));
    }

    // ---- 搜索条 + 自填地点 ----
    const input = el('input', {
      class: 'fun-search',
      type: 'search',
      placeholder: '搜地方名、别名或标签（庙会 / 室内 / 夜…）',
      value: keyword,
    });
    input.addEventListener('input', () => {
      keyword = input.value;
      // 只重画列表，不重画搜索框——否则每敲一个字就丢焦点（feast 踩过这条）。
      renderList();
    });
    const addBtn = el('button', {
      type: 'button',
      onclick: () => {
        editing = { mode: 'new', venue: null };
        formError = '';
        renderAll();
      },
    }, '＋ 添加地点');
    body.appendChild(el('div', { class: 'fun-bar' }, input, addBtn));

    // B 阶段：预设也能编辑（改的是覆盖层，预设本身不动）；删只对自己的地方。
    body.appendChild(el('div', { class: 'fun-hint' },
      `预设的 ${data.total - data.userVenueCount} 处插件自带，现在也能改——改过的会标「已改」，`
      + `随时能恢复；你自己加了 ${data.userVenueCount} 处，随时能改能删。`
      + (data.overriddenCount
        ? `　已改过 ${data.overriddenCount} 处预设。`
        : '')
      + (data.feast
        ? '　吃喝的味道会去「鱼的每一天」拿（可在配置里关掉）。'
        : '　吃喝只记名字、不描述味道（可在配置里打开「去鱼的每一天拿」）。')));

    // 一键恢复全部预设：只在真有覆盖层时给，免得平时多一个没用的按钮。
    if (data.overriddenCount) {
      body.appendChild(el('button', {
        type: 'button',
        style: { marginBottom: '10px' },
        onclick: async () => {
          try {
            const r = await ctx.invoke('resetAll', []);
            if (!r?.ok) { formError = r?.error ?? '恢复不了'; return; }
            formError = '';
            await load();
          } catch (err) {
            formError = err?.message ?? String(err);
          }
        },
      }, `恢复全部预设（${data.overriddenCount} 处）`));
    }

    // ---- 编辑表单（打开时在最上面） ----
    if (editing) body.appendChild(venueForm());

    const filterBar = el('div', { class: 'fun-filters', role: 'group', 'aria-label': '地点快捷筛选' });
    const filterButtons = [];
    for (const label of ['全部', '现在开着', '室内', '户外', '夜游', '我的地点']) {
      const button = el('button', { type: 'button', 'aria-pressed': String(quickFilter === label), onclick: () => {
        quickFilter = label;
        for (const item of filterButtons) item.button.setAttribute('aria-pressed', String(item.label === label));
        renderList();
      } }, label);
      filterButtons.push({ label, button });
      filterBar.appendChild(button);
    }
    body.appendChild(filterBar);
    const listBox = el('div');
    body.appendChild(listBox);

    /**
     * 重画列表。
     *
     * 展开的详情**就地插在它那张卡下面**，占满一整行（grid-column: 1/-1），
     * 而不是像 0.1.1 那样统统追加到列表末尾——那样点第一张卡要滑过十二张才看得见。
     */
    function renderList() {
      listBox.replaceChildren();
      const kw = keyword.trim().toLowerCase();
      const filtered = data.places.filter((p) => {
        const tags = p.tags ?? [];
        if (quickFilter === '现在开着') return p.state !== 'closed';
        if (quickFilter === '我的地点') return p.userVenue;
        if (quickFilter === '室内') return tags.some((tag) => tag.includes('室内'));
        if (quickFilter === '户外') return tags.some((tag) => /户外|室外/.test(tag));
        if (quickFilter === '夜游') return tags.some((tag) => /夜/.test(tag));
        return true;
      });
      const matched = kw
        ? filtered.filter((p) => p.name.toLowerCase().includes(kw)
          || p.aliases.some((a) => a.toLowerCase().includes(kw))
          || p.tags.some((t) => t.toLowerCase().includes(kw)))
        : filtered;

      const open = matched.filter((p) => p.state !== 'closed');
      const closed = matched.filter((p) => p.state === 'closed');

      /** 一格里画卡；展开时它后面紧跟一条详情，并且这一格跨满整行。 */
      const cell = (p) => {
        const isOpen = expanded === p.id;
        const wrap = el('div', { class: isOpen ? 'fun-cell fun-cell-open' : 'fun-cell' });
        wrap.appendChild(card(p));
        if (isOpen) wrap.appendChild(detail(p));
        return wrap;
      };

      const section = (title, items) => {
        if (!items.length) return;
        listBox.appendChild(el('div', { class: 'fun-sec', text: title }));
        listBox.appendChild(el('div', { class: 'fun-grid' }, items.map(cell)));
      };
      section(kw || quickFilter !== '全部' ? `筛选结果 · 开着的（${open.length}）` : `开着的（${open.length}）`, open);
      section('已经关了', closed);
      if (!matched.length) {
        listBox.appendChild(el('div', { class: 'fun-empty', text: kw ? `没有匹配「${keyword}」的地方，试试其他筛选。` : '这个筛选下还没有地方，换一项看看。' }));
      }
    }

    const card = (p) => {
      const cls = ['fun-card'];
      if (p.state === 'closed') cls.push('fun-card-closed');
      else if (p.state === 'closingSoon') cls.push('fun-card-soon');
      else cls.push('fun-card-open');
      if (expanded === p.id) cls.push('fun-card-active');
      const stateCls = p.state === 'open' ? 'fun-card-state-open'
        : (p.state === 'closingSoon' ? 'fun-card-state-soon' : '');
      const node = el('div', {
        class: cls.join(' '),
        role: 'button',
        tabindex: '0',
        'aria-expanded': expanded === p.id ? 'true' : 'false',
        onclick: () => toggle(p.id),
        onkeydown: (ev) => {
          // 键盘也能开合：卡片是 role=button，不能只认鼠标。
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault?.();
            toggle(p.id);
          }
        },
      },
      el('div', { class: 'fun-card-head' },
        el('span', { class: 'fun-card-name', text: p.name }),
        p.phase ? el('span', { class: 'fun-chip fun-chip-phase', text: p.phase }) : null,
        el('span', { class: `fun-card-state ${stateCls}`, text: p.stateLabel }),
        el('span', { class: 'fun-card-arrow', text: expanded === p.id ? '⌃' : '⌄' })),
      el('div', { class: 'fun-card-desc', text: p.desc }),
      el('div', { class: 'fun-card-foot' },
        el('span', { text: `${p.hours.open}–${p.hours.close}` }),
        el('span', { text: p.crowdLabel }),
        el('span', { text: `${p.areaCount} 处可逛` }),
        p.food ? el('span', { class: 'fun-chip fun-chip-ate', text: p.food.verb === '喝' ? '能喝' : '能吃' }) : null,
        p.visitCount > 0 ? el('span', { class: 'fun-chip', text: `去过 ${p.visitCount} 次` }) : null,
        p.recent ? el('span', { class: 'fun-chip', text: '刚去过' }) : null));
      return node;
    };

    /**
     * 开合一张卡。
     *
     * 重画之后把刚展开的那一块滚进视野——否则点上面第一张、展开的内容在下面一屏以外，
     * 用户会以为自己点错了。`block: 'nearest'` 保证「已经看得见就不动」，
     * 不会因为点一张本来就在屏幕里的卡而把页面跳一下。
     */
    function toggle(id) {
      const wasOpen = expanded === id;
      expanded = wasOpen ? null : id;
      renderList();
      if (!wasOpen) {
        // 滚的是**整格**（卡 + 详情），不是只滚卡片：
        // 卡片恰好贴在视口底部时，只保证卡片可见等于详情还在屏幕外。
        const active = listBox.querySelector('.fun-card-active');
        const target = active?.parentNode ?? active;
        // 真 DOM 有 scrollIntoView；测试桩没有，判一下再用。
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
      }
    }

    const detail = (p) => {
      const d = el('div', { class: 'fun-detail' },
        el('div', { class: 'fun-detail-top' },
          el('h4', { text: p.name },
            p.overridden ? el('span', { class: 'fun-chip fun-chip-on', text: '已改', style: { marginLeft: '6px' } }) : null),
          el('div', { class: 'fun-detail-actions' },
            // B 阶段起预设也能编辑：改的是覆盖层，预设常量不动。
            el('button', {
              class: 'fun-detail-edit',
              type: 'button',
              onclick: (ev) => {
                ev?.stopPropagation?.();
                editing = { mode: 'edit', venue: p };
                formError = '';
                renderAll();
              },
            }, '编辑'),
            el('button', {
              class: 'fun-detail-close',
              type: 'button',
              title: '收起',
              onclick: (ev) => {
                // 卡片自己也绑了 onclick：不拦住的话会先收起再被卡片重新展开。
                ev?.stopPropagation?.();
                expanded = null;
                renderList();
              },
            }, '收起'))),
        el('p', { class: 'fun-dim', text: `${p.kindLabel} · ${p.crowdLabel} · ${p.hours.open}–${p.hours.close} · ${p.stateLabel}` }),
        // 此刻的那段描写：有阶段的场所显示的是「这会儿的样子」，不是通用那段。
        el('p', { class: 'fun-detail-desc', text: p.desc }),
        // 时段一览：让她和主人都看得出「换个时间来是另一副样子」。
        (p.phases && p.phases.length > 1)
          ? el('div', {},
            el('div', { class: 'fun-sec', text: '不同时段' }),
            el('div', { class: 'fun-phases' }, p.phases.map((ph) => el('span', {
              class: ph.label === p.phase ? 'fun-chip fun-chip-phase fun-chip-on' : 'fun-chip',
              title: `${ph.from}–${ph.to}`,
              text: `${ph.label} ${ph.from}–${ph.to}`,
            }))))
          : null,
        // 三块并成一排：能逛的 / 纪念品 / 拍照点，省纵向高度（原来三个小节摞起来很高）。
        el('div', { class: 'fun-detail-cols' },
          el('div', { class: 'fun-detail-col' },
            el('div', { class: 'fun-sec', text: '能逛的' }),
            el('ul', { class: 'fun-list' }, p.areas.map((a) => el('li', { text: a })))),
          el('div', { class: 'fun-detail-col' },
            el('div', { class: 'fun-sec', text: '纪念品' }),
            el('div', { class: 'fun-chips' }, p.souvenirs.map((s) => el('span', { class: 'fun-chip', text: s }))),
            el('div', { class: 'fun-sec', text: '拍照点' }),
            el('div', { class: 'fun-chips' }, p.photoSpots.map((s) => el('span', { class: 'fun-chip', text: s }))),
            p.food
              ? el('div', {},
                el('div', { class: 'fun-sec', text: `能${p.food.verb}的` }),
                el('div', { class: 'fun-chips' }, p.food.items.map((s) => el('span', { class: 'fun-chip', text: s }))),
                el('div', { class: 'fun-note', text: `味道不在这儿——装了「鱼的每一天」才有九维口感，没装就只知道${p.food.verb}了什么。` }))
              : null)),
        el('div', { class: 'fun-scene' },
          p.hasScene
            ? el('span', {}, '生图时 ', el('b', { text: `scene 填「${p.scene}」` }), `，outfits 建议「${p.outfit}」`)
            : el('span', {}, '素材库里没有这处的场景，生图时 ', el('b', { text: 'scene 不用填' }), '，把地方写进 prompt 就行')));

      return d;
    };

    // ---- 地点表单（自填新建 / 自填编辑 / 预设编辑三态）----
    // 放在 render 内部：能直接拿到当前 data 与 editing，保存后整体重画一次即可。
    function venueForm() {
      const v = editing.venue ?? {};
      // 预设编辑：改的是覆盖层，不删场所；没改过的字段仍跟着预设升级走。
      const isPreset = Boolean(v.id) && !v.userVenue;
      const phases = isPreset && Array.isArray(v.phases) ? v.phases : [];
      const descPhases = phases.filter((ph) => ph.overridesDesc);
      const areaPhases = phases.filter((ph) => ph.overridesAreas);
      const phaseNames = (items) => items.map((ph) => `${ph.label} ${ph.from}–${ph.to}`).join('、');
      const scopeNote = (items, noun) => items.length
        ? `通用${noun}会保存；在${phaseNames(items)}使用预设时段${noun}，未命中这些时段时才使用这里的内容。保存不会同步修改时段。`
        : '';
      const verb = v.food?.verb ?? 'none';
      const foodItems = v.food?.items ?? [];
      const errorNode = el('div', { class: 'fun-form-error', text: formError });

      const field = (label, key, opts = {}) => {
        const { type = 'text', value = '', hint = '', note = '', multiline = false, options = null, rows = '3' } = opts;
        let input;
        if (options) {
          input = el('select', {});
          for (const [val, lab] of options) input.appendChild(el('option', { value: val, text: lab }));
          input.value = value;
        } else if (multiline) {
          input = el('textarea', { rows, placeholder: hint });
          input.value = value;
        } else {
          input = el('input', { type, placeholder: hint });
          input.value = value;
        }
        fields[key] = input;
        return el('label', { class: 'fun-field' },
          el('span', { class: 'fun-field-label', text: label }), input,
          note ? el('span', { class: 'fun-field-scope fun-note', text: note }) : null);
      };

      const save = async () => {
        const payload = {
          ...(v.id ? { id: v.id } : {}),
          name: fields.name.value.trim(),
          aliases: parseLines(fields.aliases.value),
          tags: parseLines(fields.tags.value),
          desc: fields.desc.value.trim(),
          recommendedOutfit: fields.outfit.value.trim(),
          crowd: fields.crowd.value,
          hours: { open: fields.open.value.trim(), close: fields.close.value.trim() },
          areas: parseLines(fields.areas.value),
          souvenirs: parseLines(fields.souvenirs.value),
          photoSpots: parseLines(fields.photoSpots.value),
          randomEvents: parseLines(fields.randomEvents.value),
        };
        const foodVerb = fields.foodVerb.value;
        if (foodVerb && foodVerb !== 'none') {
          payload.food = { verb: foodVerb === 'drink' ? '喝' : '吃', items: parseLines(fields.foodItems.value) };
        }
        try {
          const r = await ctx.invoke('save', [payload]);
          if (!r?.ok) {
            // 只改错误行，不重画表单——重画会把用户刚填的一整页冲掉。
            formError = r?.error ?? '存不下来';
            errorNode.textContent = formError;
            return;
          }
          editing = null;
          formError = '';
          keyword = '';
          expanded = null;
          await load();
        } catch (err) {
          formError = err?.message ?? String(err);
          errorNode.textContent = formError;
        }
      };

      const remove = async () => {
        if (!v.id) return;
        try {
          // 预设不能删，只能「恢复预设」（抹掉这一处覆盖层）。
          const r = isPreset
            ? await ctx.invoke('reset', [{ id: v.id }])
            : await ctx.invoke('remove', [{ id: v.id }]);
          if (!r?.ok) { formError = r?.error ?? '操作没成'; errorNode.textContent = formError; return; }
          editing = null;
          formError = '';
          expanded = null;
          await load();
        } catch (err) {
          formError = err?.message ?? String(err);
          errorNode.textContent = formError;
        }
      };

      const title = editing.mode === 'new'
        ? '添加一处自己的地方'
        : (isPreset ? `编辑预设：${v.name}` : `编辑：${v.name}`);
      const note = isPreset
        ? '改的是「覆盖层」，预设本身不动：只存你真改过的字段，以后预设升级的新内容照样能拿到。'
          + '时段分段（不同时段不一样）不在这里改；想还原就点「恢复预设」。名字别改成另一处预设的正名。'
        : '只写名字和「能逛的」就能用；别的留空也行。一行一条。';
      return el('div', { class: 'fun-form' },
        el('div', { class: 'fun-form-title', text: title }),
        el('div', { class: 'fun-form-note', text: note }),
        phases.length ? el('div', { class: 'fun-form-phases' },
          el('div', { class: 'fun-form-note', text: `现在 ${data.nowHm} · ${v.phase ? `当前阶段：${v.phase}` : '当前未命中预设时段，使用通用内容'}。编辑通用字段不会改变以下预设时段及其内容；修改营业时间也不会移动这些时段。` }),
          el('ul', { class: 'fun-list' }, phases.map((ph) => {
            const covered = [ph.overridesDesc ? '描写（desc）' : '', ph.overridesAreas ? '能逛的（areas）' : ''].filter(Boolean);
            return el('li', { text: `${ph.label} ${ph.from}–${ph.to}${ph.label === v.phase ? '（当前）' : ''}：${covered.length ? `覆盖通用${covered.join('、')}` : '沿用通用描写与可逛清单'}` });
          }))) : null,
        errorNode,
        el('div', { class: 'fun-form-grid' },
          field('名字 *', 'name', { value: v.name ?? '', hint: '例如「巷子里的旧书店」' }),
          field('别名', 'aliases', { value: lines(v.aliases), hint: '一行一个，可选' }),
          field('标签', 'tags', { value: lines(v.tags), hint: '室内 / 夜 / 免费… 一行一个' }),
          field('推荐穿搭', 'outfit', { value: v.recommendedOutfit ?? '', hint: '可选，例如「外出外套」' }),
          field('开门时间', 'open', { value: v.hours?.open ?? '09:00', hint: 'HH:MM' }),
          field('关门时间', 'close', { value: v.hours?.close ?? '21:00', hint: 'HH:MM' }),
          field('人多不多', 'crowd', {
            value: v.crowd ?? 'normal',
            options: [['quiet', '人不多'], ['normal', '人不算多'], ['packed', '人很多']],
          }),
          field('能吃能喝', 'foodVerb', {
            value: verb === '喝' ? 'drink' : (verb === '吃' ? 'eat' : 'none'),
            options: [['none', '没有'], ['drink', '喝的'], ['eat', '吃的']],
          })),
        // 预设可能带时段：面板的 desc 是「此刻那段」，编辑要用通用那段（descAll），
        // 否则编辑一次会把某一段的描写写进覆盖层，别的时段全变成那一段。
        field(phases.length ? '通用描写（desc）' : '这处是什么样子', 'desc', { value: v.descAll ?? v.desc ?? '', hint: '只写空间与陈设，别写她在干什么', note: scopeNote(descPhases, '描写'), multiline: true, rows: '3' }),
        field(phases.length ? '通用可逛清单（areas）*' : '能逛的 *', 'areas', { value: lines(v.allAreas ?? v.areas), hint: '一行一处，至少一处', note: scopeNote(areaPhases, '可逛清单'), multiline: true, rows: '4' }),
        field('纪念品', 'souvenirs', { value: lines(v.souvenirs), hint: '一行一样', multiline: true, rows: '2' }),
        field('拍照点', 'photoSpots', { value: lines(v.photoSpots), hint: '一行一处', multiline: true, rows: '2' }),
        field('能吃能喝的品类', 'foodItems', { value: lines(foodItems), hint: '品类名，一行一样；别写味道', multiline: true, rows: '2' }),
        field('可能碰上的小事', 'randomEvents', { value: lines(v.randomEvents), hint: '一行一条，可选', multiline: true, rows: '2' }),
        el('div', { class: 'fun-form-actions' },
          el('button', { class: 'fun-btn-primary', type: 'button', onclick: save }, '保存'),
          v.id ? el('button', { class: 'fun-danger', type: 'button', onclick: remove },
            isPreset ? '恢复预设' : '删除这处') : null,
          el('button', {
            type: 'button',
            onclick: () => {
              editing = null;
              formError = '';
              // 表单开着时自动刷新只存了数据没重画；关掉时用最新那份补画。
              if (currentData) { render(currentData); currentData = null; }
              else renderAll();
            },
          }, '取消')));
    }

    renderList();
  };

  const load = async () => {
    try {
      const data = await ctx.invoke('list');
      if (!data?.ok) throw new Error(data?.error ?? '返回不正常');
      // 正在填表单时别重画——一分钟的自动刷新会把用户刚填的一整页冲掉。
      if (editing) { currentData = data; return; }
      status.replaceChildren();
      render(data);
    } catch (err) {
      if (!currentData) body.replaceChildren();
      status.replaceChildren(errorCard(err, load, Boolean(currentData)));
    }
  };

  void load();
  // 状态会随时间变（几点、开没开）：一分钟刷一次就够，不打断操作。
  ctx.interval(() => { void load(); }, 60000);
  return { refresh: load };
}

// ---------------------------------------------------------------------------
// book —— 纪念册
// ---------------------------------------------------------------------------

function mountBook(ctx) {
  const root = ctx.root;
  root.replaceChildren();
  const box = shell(root);
  const body = el('div');
  box.appendChild(body);
  let bookTab = 'all';
  let wishFormOpen = false;
  const expandedTrips = new Set();
  const status = feedback(box);
  body.appendChild(el('div', { class: 'fun-loading', role: 'status', text: '正在翻开纪念册…' }));
  const pending = new Set();
  const errors = new Map();
  let currentData = null;
  let wishDraft = { placeId: '', type: '', target: '', reason: '' };
  const wishPending = new Set();
  const wishErrors = new Map();
  const wishTypes = { visit: '去看看', area: '逛一处', phase: '在某个时段去', souvenir: '带回纪念品' };

  const renderWishes = (data) => {
    const places = data.places ?? [];
    const wishes = data.wishes ?? [];
    const adding = wishPending.has('add');
    const section = el('section', { class: 'fun-wishes', 'aria-label': '出游心愿' });
    section.appendChild(el('div', { class: 'fun-bar' },
      el('span', { class: 'fun-sec', text: '出游心愿' }),
      el('button', { type: 'button', 'aria-expanded': String(wishFormOpen), disabled: adding ? 'disabled' : null, onclick: () => { wishFormOpen = !wishFormOpen; render(currentData); } }, wishFormOpen ? '收起表单' : '记个心愿')));
    const field = (label, input) => el('label', { class: 'fun-field' },
      el('span', { class: 'fun-field-label', text: label }), input);
    const select = (className, placeholder, options, value) => {
      const input = el('select', { class: className, disabled: adding ? 'disabled' : null },
        el('option', { value: '', text: placeholder }),
        options.map(([id, name]) => el('option', { value: id, text: name })));
      input.value = value;
      return input;
    };
    const place = places.find((p) => p.id === wishDraft.placeId);
    const targets = place ? (wishDraft.type === 'area' ? place.areas
      : wishDraft.type === 'phase' ? place.phaseNames
        : wishDraft.type === 'souvenir' ? place.souvenirs : []) ?? [] : [];
    const placeInput = select('fun-wish-place', '请选择地点', places.map((p) => [p.id, p.name]), wishDraft.placeId);
    const typeInput = select('fun-wish-type', '请选择心愿类型', Object.entries(wishTypes), wishDraft.type);
    const targetInput = select('fun-wish-target', wishDraft.type === 'visit' ? '去看看无需目标'
      : !place || !wishDraft.type ? '先选择地点和类型' : targets.length ? '请选择目标' : '此地点没有可选目标',
    targets.map((target) => [target, target]), wishDraft.target);
    targetInput.disabled = adding || !targets.length;
    const reasonInput = el('input', { class: 'fun-wish-reason', type: 'text', placeholder: '可选，记下为什么想去', disabled: adding ? 'disabled' : null });
    reasonInput.value = wishDraft.reason;
    placeInput.addEventListener('change', () => {
      wishDraft.placeId = placeInput.value;
      wishDraft.target = '';
      wishErrors.delete('add');
      render(currentData);
    });
    typeInput.addEventListener('change', () => {
      wishDraft.type = typeInput.value;
      wishDraft.target = '';
      wishErrors.delete('add');
      render(currentData);
    });
    targetInput.addEventListener('change', () => { wishDraft.target = targetInput.value; });
    reasonInput.addEventListener('input', () => { wishDraft.reason = reasonInput.value; });
    const errorNode = el('div', { class: 'fun-form-error', role: 'alert', text: wishErrors.get('add') ?? '' });
    const save = async () => {
      if (wishPending.has('add')) return;
      // 只接受用户明确选中的地点、类型与目标；从不替用户挑第一项。
      const payload = { action: 'add', placeId: placeInput.value, type: typeInput.value,
        target: typeInput.value === 'visit' ? '' : targetInput.value, reason: reasonInput.value.trim() };
      const chosenPlace = (currentData.places ?? []).find((p) => p.id === payload.placeId);
      const validTargets = chosenPlace ? (payload.type === 'area' ? chosenPlace.areas
        : payload.type === 'phase' ? chosenPlace.phaseNames : chosenPlace.souvenirs) ?? [] : [];
      if (!chosenPlace || !Object.hasOwn(wishTypes, payload.type)
        || (payload.type !== 'visit' && !validTargets.includes(payload.target))) {
        const message = '请选择地点、心愿类型及对应目标。';
        wishErrors.set('add', message);
        errorNode.textContent = message;
        return;
      }
      wishDraft = { placeId: payload.placeId, type: payload.type, target: payload.target, reason: reasonInput.value };
      await changeWish('add', payload, data);
    };
    if (wishFormOpen) section.appendChild(el('div', { class: 'fun-form fun-wish-form' },
      el('div', { class: 'fun-form-note', text: '由你选择想去的地方，按保存才记下心愿；心愿不保证立即出发。' }),
      el('div', { class: 'fun-form-grid' }, field('地点', placeInput), field('心愿类型', typeInput), field('目标', targetInput)),
      field('缘由（可选）', reasonInput), errorNode,
      el('button', { class: 'fun-btn-primary', type: 'button', disabled: adding ? 'disabled' : null, onclick: save }, adding ? '保存中…' : '保存心愿')));
    if (!wishes.length) section.appendChild(el('div', { class: 'fun-note', text: '还没有出游心愿，想好了再记下。' }));
    const statusNames = { active: '待实现', paused: '已暂缓', completed: '已实现', cancelled: '已取消' };
    const history = el('details', { class: 'fun-wish-history',
      open: wishes.some((w) => w.status !== 'active' && (wishErrors.has(`wish:${w.id}`) || wishPending.has(`wish:${w.id}`))) ? 'open' : null,
    }, el('summary', { text: `已实现、暂缓与取消（${wishes.filter((w) => w.status !== 'active').length}）` }));
    for (const wish of wishes) {
      const key = `wish:${wish.id}`;
      const busy = wishPending.has(key);
      const state = wish.status;
      const actions = el('div', { class: 'fun-trip-actions' });
      if (state === 'active' || state === 'paused') {
        actions.appendChild(el('button', { type: 'button', disabled: busy ? 'disabled' : null,
          onclick: () => changeWish(key, { action: state === 'paused' ? 'resume' : 'pause', id: wish.id }, data) }, state === 'paused' ? '恢复' : '暂缓'));
        actions.appendChild(el('button', { type: 'button', disabled: busy ? 'disabled' : null,
          onclick: () => changeWish(key, { action: 'cancel', id: wish.id }, data) }, '取消'));
      }
      if (busy) actions.appendChild(el('span', { class: 'fun-dim', text: '保存中…' }));
      if (wishErrors.has(key)) actions.appendChild(el('span', { class: 'fun-trip-error', role: 'alert', text: wishErrors.get(key) }));
      (state === 'active' ? section : history).appendChild(el('div', { class: 'fun-wish fun-trip' },
        el('div', { class: 'fun-trip-head' },
          el('span', { class: 'fun-trip-name', text: wish.placeName ?? places.find((p) => p.id === wish.placeId)?.name ?? wish.placeId }),
          el('span', { class: 'fun-wish-status fun-dim', text: statusNames[state] ?? state ?? '状态未知' })),
        el('div', { class: 'fun-trip-sum', text: `${wishTypes[wish.type] ?? wish.type}${wish.target ? ` · ${wish.target}` : ''}` }),
        wish.reason ? el('div', { class: 'fun-wish-note fun-note', text: `缘由：${wish.reason}` }) : null, actions));
    }
    if (wishes.some((w) => w.status !== 'active')) section.appendChild(history);
    body.appendChild(section);
  };

  const changeWish = async (key, payload, data) => {
    if (wishPending.has(key)) return;
    wishPending.add(key);
    wishErrors.delete(key);
    render(currentData ?? data);
    let saved = false;
    try {
      const result = await ctx.invoke('wish', [payload]);
      if (!result?.ok) throw new Error(result?.error ?? '心愿保存失败');
      saved = true;
      if (key === 'add') { wishDraft = { placeId: '', type: '', target: '', reason: '' }; wishFormOpen = false; }
      await load(true);
    } catch (error) {
      wishErrors.set(key, `${saved ? '已保存，但列表刷新失败：' : ''}${error?.message ?? String(error)}`);
      if (key === 'add') wishFormOpen = true;
    } finally {
      wishPending.delete(key);
      render(currentData ?? data);
    }
  };

  const render = (data) => {
    currentData = data;
    body.replaceChildren(heading('纪念册', '把走过的地方，收成可以回看的小回忆。'));
    if (data.session) body.appendChild(el('div', { class: 'fun-live' },
      el('h3', { text: '正在逛 · ' + data.session.placeName }), el('div', { class: 'fun-trip-sum', text: data.session.summary })));
    else if (data.trips?.length) body.appendChild(el('div', { class: 'fun-live' },
      el('div', { class: 'fun-meta', text: '最近一趟 · ' + data.trips[0].day }),
      el('h3', { text: data.trips[0].placeName }), el('div', { class: 'fun-trip-sum', text: data.trips[0].summary })));

    const tabs = el('nav', { class: 'fun-tabs', 'aria-label': '纪念册分类' });
    for (const [id, label] of [['all', '全部行程'], ['kept', '珍藏'], ['wishes', '心愿']]) tabs.appendChild(el('button', {
      type: 'button', 'aria-pressed': String(bookTab === id), onclick: () => { bookTab = id; render(currentData); },
    }, label));
    body.appendChild(tabs);
    if (bookTab === 'wishes') { renderWishes(data); return; }
    if (!data.total && !(data.keepsakeCount > 0)) {
      body.appendChild(el('div', { class: 'fun-empty', text: '纪念册还是空的——她收一次摊，这里就有一趟。' }));
      return;
    }
    body.appendChild(el('div', { class: 'fun-stats' },
      stat(data.totalRecent ?? data.total, '近期行程'), stat(data.keepsakeCount ?? 0, '珍藏'),
      stat(data.visitedAreaCount, '处逛过'), stat(data.souvenirCount, '件纪念品'), stat(data.photoCount, '张照片')));
    if (data.mostVisited?.length) body.appendChild(el('details', { class: 'fun-wish-history' },
      el('summary', { text: '常去的' }), el('div', { class: 'fun-chips' }, data.mostVisited.slice(0, 8).map((m) => el('span', { class: 'fun-chip', text: `${m.name} ×${m.times}` })))));
    const trips = bookTab === 'kept' ? data.trips.filter((t) => t.kept) : data.trips;
    let previousDay = null;
    for (const t of trips) {
      if (t.day !== previousDay) { body.appendChild(el('div', { class: 'fun-date', text: t.day || '日期不详' })); previousDay = t.day; }
      const err = errors.get(t.id);
      const open = expandedTrips.has(t.id);
      const toggleKeep = async () => {
        if (pending.has(t.id)) return;
        pending.add(t.id); errors.delete(t.id); render(data);
        try {
          const result = await ctx.invoke('favorite', [{ id: t.id, keep: !t.kept }]);
          if (!result?.ok) throw new Error(result?.error ?? '珍藏状态保存失败');
          await load(true);
        } catch (error) { errors.set(t.id, error?.message ?? String(error)); }
        finally { pending.delete(t.id); render(currentData ?? data); }
      };
      const card = el('article', { class: 'fun-trip fun-ticket' },
        el('div', { class: 'fun-trip-head' }, el('span', { class: 'fun-trip-name', text: t.placeName }),
          el('span', { class: 'fun-trip-when', text: t.enteredHm + '–' + t.leftHm + (t.stayedMin ? ' · ' + t.stayedMin + ' 分钟' : '') })),
        el('div', { class: 'fun-trip-sum', text: t.summary }),
        el('div', { class: 'fun-trip-actions' },
          el('button', { type: 'button', 'aria-expanded': String(open), onclick: () => {
            if (open) expandedTrips.delete(t.id); else expandedTrips.add(t.id);
            render(currentData);
            const focus = body.querySelectorAll('.fun-detail-toggle');
            [...focus].find((node) => node.getAttribute('data-trip-id') === t.id)?.focus();
          }, class: 'fun-detail-toggle', 'data-trip-id': t.id }, open ? '收起详情' : '查看详情'),
          el('button', { type: 'button', disabled: pending.has(t.id) ? 'disabled' : null, onclick: toggleKeep }, pending.has(t.id) ? '保存中…' : (t.kept ? '取消珍藏' : '珍藏')),
          err ? el('span', { class: 'fun-trip-error', role: 'alert', text: err }) : null));
      if (open) {
        const detail = el('section', { class: 'fun-trip-detail', 'aria-label': t.placeName + '行程详情' });
        const part = (title, values) => {
          if (!values.length) return;
          detail.appendChild(el('div', { class: 'fun-sec', text: title }));
          detail.appendChild(el('ul', { class: 'fun-list' }, values.map((text) => el('li', { text }))));
        };
        if (t.company) detail.appendChild(el('p', { text: '同行 · ' + t.company }));
        part('沿途逛过', t.visited ?? []);
        part('遇见的小事', t.events ?? []);
        part('当时的选择', (t.choices ?? []).map((c) => c.event + ' · ' + c.result));
        part('带回的纪念品', t.souvenirs ?? []);
        part('拍照记录', t.photos ?? []);
        part('吃喝记录', (t.ate ?? []).map((x) => x.verb + '了 ' + x.item));
        if (t.note) detail.appendChild(el('p', { text: '收摊备注 · ' + t.note }));
        if (t.scene) detail.appendChild(el('p', { class: 'fun-dim', text: '生图 scene：' + t.scene + (t.outfit ? ' · outfits：' + t.outfit : '') }));
        card.appendChild(detail);
      }
      body.appendChild(card);
    }
    if (bookTab === 'kept' && !trips.length) body.appendChild(el('div', { class: 'fun-empty', text: '还没有珍藏的行程。' }));
  };

  const stat = (n, label) => el('div', { class: 'fun-stat' },
    el('b', { text: String(n) }), el('span', { text: label }));

  const load = async (propagate = false) => {
    try {
      const data = await ctx.invoke('list');
      if (!data?.ok) throw new Error(data?.error ?? '返回不正常');
      status.replaceChildren();
      render(data);
    } catch (err) {
      if (propagate) throw err;
      if (!currentData) body.replaceChildren();
      status.replaceChildren(errorCard(err, load, Boolean(currentData)));
    }
  };

  void load();
  return { refresh: load };
}

/**
 * 纪念品架：跨趟归集的收藏 + 每处的集齐进度。
 *
 * 数据全部由服务端的 `shelf/list` 算好（`keepsakes.js` 是纯函数），
 * 这里只负责画。**不自己聚合、不自己算日期**——两边各算一遍必然会不一致。
 */
function mountShelf(ctx) {
  const root = ctx.root;
  root.replaceChildren();
  const box = shell(root);
  const body = el('div');
  box.appendChild(body);
  const status = feedback(box);
  let currentData = null;
  body.appendChild(el('div', { class: 'fun-loading', role: 'status', text: '正在整理纪念品架…' }));

  const stat = (n, label) => el('div', { class: 'fun-stat' },
    el('b', { text: String(n) }), el('span', { text: label }));

  const pct = (part) => `${part.done}/${part.total}`;

  const render = (data) => {
    currentData = data;
    body.replaceChildren(heading('纪念品架', '每一件小东西，都有带它回来的那一天。'));
    if (!data.total) {
      body.appendChild(el('div', { class: 'fun-empty', text: '架子上还什么都没有——她买过纪念品，这里就有了。' }));
    }

    body.appendChild(el('div', { class: 'fun-stats' },
      stat(data.total, '样东西'),
      stat(data.pieces, '件'),
      stat(data.places, '处地方'),
      stat(data.completePlaces, '处逛遍')));

    body.appendChild(el('div', { class: 'fun-meta', text: '收藏账本长期保留；详细行程可查看最近 40 趟与珍藏行程。进度按当前场所清单统计，移除或改名不删除旧回忆。' }));

    // 每一处的架子：只列真有东西的，空的不用占版面。
    if (data.byPlace.length) body.appendChild(el('div', { class: 'fun-sec', text: '按地方归着' }));
    for (const g of data.byPlace) {
      body.appendChild(el('div', { class: 'fun-trip' },
        el('div', { class: 'fun-trip-head' },
          el('span', { class: 'fun-trip-name', text: g.placeName }),
          el('span', { class: 'fun-trip-when', text: `${g.items.length} 样 · 最早 ${g.firstDay || '—'}` })),
        el('div', { class: 'fun-shelf-grid' }, g.items.map((it) => el('details', { class: 'fun-keepsake' },
          el('summary', null, el('strong', { text: `${it.name}${it.times > 1 ? ` ×${it.times}` : ''}` }),
            el('span', { class: 'fun-dim', text: `记录中最早 ${it.firstDay || '日期不详'}` })),
          it.archivedCount ? el('div', { class: 'fun-note', text: `${it.archivedCount} 次收藏仅保留账本，详细行程已不在近期记录中。` }) : null,
          ...(it.memories ?? []).map((m) => el('div', { class: 'fun-trip-sum' },
            el('div', { text: `${m.day || '日期不详'} · ${m.summary}` }),
            m.note ? el('div', { text: `你记的：${m.note}` }) : null)))))));
    }

    // 进度：只列去过的。服务端已按「快逛遍的」排好，这里照顺序画。
    const visited = data.progress.filter((p) => p.visits > 0);
    if (visited.length) {
      body.appendChild(el('div', { class: 'fun-sec', text: `逛过的 ${visited.length} 处` }));
      for (const p of visited) {
        const left = p.areas.left.length;
        body.appendChild(el('div', { class: 'fun-trip' },
          el('div', { class: 'fun-trip-head' },
            el('span', { class: 'fun-trip-name', text: p.placeName }),
            el('span', { class: 'fun-trip-when', text: `去过 ${p.visits} 次 · ${p.percent}%` })),
          el('progress', { class: 'fun-progress', max: '100', value: String(p.percent), 'aria-label': `${p.placeName}探索进度 ${p.percent}%` }),
          el('div', { class: 'fun-meta', text: `逛过 ${pct(p.areas)}${p.souvenirs.total ? ` · 纪念品 ${pct(p.souvenirs)}` : ''}${p.photos.total ? ` · 拍过 ${pct(p.photos)}` : ''}` }),
          left
            ? el('div', { class: 'fun-trip-sum', text: `还差：${p.areas.left.slice(0, 6).join('、')}${left > 6 ? ` 等 ${left} 处` : ''}` })
            : el('div', { class: 'fun-trip-sum', text: '这一处已经逛遍了。' })));
      }
    }
  };

  const load = async () => {
    try {
      const data = await ctx.invoke('list');
      if (!data?.ok) throw new Error(data?.error ?? '返回不正常');
      status.replaceChildren();
      render(data);
    } catch (err) {
      if (!currentData) body.replaceChildren();
      status.replaceChildren(errorCard(err, load, Boolean(currentData)));
    }
  };

  void load();
  return { refresh: load };
}

export default {
  panels: {
    places: { mount: mountPlaces },
    book: { mount: mountBook },
    shelf: { mount: mountShelf },
  },
};
