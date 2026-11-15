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
 * 两个面板：
 *   places —— 十二处地方此刻的状态，以及她正在逛的这一趟
 *   book   —— 纪念册：去过的每一趟
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
.fun-stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:9px 12px;border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);background:var(--f-card)}
.fun-stat b{display:block;font-size:17px;font-weight:600;line-height:1.25}
.fun-stat span{font-size:11.5px;color:var(--f-dim)}
.fun-empty{padding:22px 12px;text-align:center;color:var(--f-dim);font-size:12.5px}
.fun-err{border:1px solid #d9534f;border-radius:var(--radius-sm,6px);padding:10px 12px;color:#d9534f;background:color-mix(in srgb,#d9534f 10%,transparent);font-size:12.5px}
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

function errorCard(err) {
  return el('div', { class: 'fun-err', text: `面板加载失败：${err?.message ?? String(err)}` });
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
  let expanded = null;

  const render = (data) => {
    body.replaceChildren();

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

    // ---- 搜索条 ----
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
    body.appendChild(el('div', { class: 'fun-bar' }, input));

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
      const matched = kw
        ? data.places.filter((p) => p.name.toLowerCase().includes(kw)
          || p.aliases.some((a) => a.toLowerCase().includes(kw))
          || p.tags.some((t) => t.toLowerCase().includes(kw)))
        : data.places;

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
      section(kw ? `匹配到 ${matched.length} 处` : `开着的（${open.length}）`, open);
      section('已经关了', closed);
      if (!matched.length) {
        listBox.appendChild(el('div', { class: 'fun-empty', text: `没有匹配「${keyword}」的地方。` }));
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
        el('span', { class: `fun-card-state ${stateCls}`, text: p.stateLabel }),
        el('span', { class: 'fun-card-arrow', text: expanded === p.id ? '⌃' : '⌄' })),
      el('div', { class: 'fun-card-desc', text: p.desc }),
      el('div', { class: 'fun-card-foot' },
        el('span', { text: `${p.hours.open}–${p.hours.close}` }),
        el('span', { text: p.crowdLabel }),
        el('span', { text: `${p.areaCount} 处可逛` }),
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
          target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }

    const detail = (p) => {
      const d = el('div', { class: 'fun-detail' },
        el('div', { class: 'fun-detail-top' },
          el('h4', { text: p.name }),
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
          }, '收起')),
        el('p', { class: 'fun-dim', text: `${p.kindLabel} · ${p.crowdLabel} · ${p.hours.open}–${p.hours.close} · ${p.stateLabel}` }),
        // 三块并成一排：能逛的 / 纪念品 / 拍照点，省纵向高度（原来三个小节摞起来很高）。
        el('div', { class: 'fun-detail-cols' },
          el('div', { class: 'fun-detail-col' },
            el('div', { class: 'fun-sec', text: '能逛的' }),
            el('ul', { class: 'fun-list' }, p.areas.map((a) => el('li', { text: a })))),
          el('div', { class: 'fun-detail-col' },
            el('div', { class: 'fun-sec', text: '纪念品' }),
            el('div', { class: 'fun-chips' }, p.souvenirs.map((s) => el('span', { class: 'fun-chip', text: s }))),
            el('div', { class: 'fun-sec', text: '拍照点' }),
            el('div', { class: 'fun-chips' }, p.photoSpots.map((s) => el('span', { class: 'fun-chip', text: s }))))),
        el('div', { class: 'fun-scene' },
          p.hasScene
            ? el('span', {}, '生图时 ', el('b', { text: `scene 填「${p.scene}」` }), `，outfits 建议「${p.outfit}」`)
            : el('span', {}, '素材库里没有这处的场景，生图时 ', el('b', { text: 'scene 不用填' }), '，把地方写进 prompt 就行')));

      return d;
    };

    renderList();
  };

  const load = async () => {
    try {
      const data = await ctx.invoke('list');
      if (!data?.ok) throw new Error(data?.error ?? '返回不正常');
      render(data);
    } catch (err) {
      root.replaceChildren();
      ensureStyle(root);
      const box2 = shell(root);
      box2.appendChild(errorCard(err));
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

  const render = (data) => {
    body.replaceChildren();
    if (!data.total && !data.session) {
      body.appendChild(el('div', { class: 'fun-empty', text: '纪念册还是空的——她收一次摊，这里就有一趟。' }));
      return;
    }

    body.appendChild(el('div', { class: 'fun-stats' },
      stat(data.total, '趟'),
      stat(data.visitedAreaCount, '处逛过'),
      stat(data.souvenirCount, '件纪念品'),
      stat(data.photoCount, '张照片')));

    if (data.mostVisited.length) {
      body.appendChild(el('div', { class: 'fun-sec', text: '常去的' }));
      body.appendChild(el('div', { class: 'fun-chips' },
        data.mostVisited.slice(0, 8).map((m) => el('span', { class: 'fun-chip', text: `${m.name} ×${m.times}` }))));
    }

    if (data.session) {
      body.appendChild(el('div', { class: 'fun-sec', text: '正在逛' }));
      body.appendChild(el('div', { class: 'fun-trip' },
        el('div', { class: 'fun-trip-sum', text: data.session.summary })));
    }

    body.appendChild(el('div', { class: 'fun-sec', text: `去过的 ${data.total} 趟` }));
    for (const t of data.trips) {
      body.appendChild(el('div', { class: 'fun-trip' },
        el('div', { class: 'fun-trip-head' },
          el('span', { class: 'fun-trip-name', text: t.placeName }),
          el('span', { class: 'fun-trip-when', text: `${t.day} ${t.enteredHm}–${t.leftHm}${t.stayedMin ? ` · ${t.stayedMin} 分钟` : ''}` })),
        el('div', { class: 'fun-trip-sum', text: t.summary }),
        (t.events.length || t.scene)
          ? el('div', { class: 'fun-trip-extras' },
            t.events.length ? el('div', { text: t.events.slice(0, 2).join(' / ') }) : null,
            t.scene ? el('div', { text: `生图 scene：${t.scene}${t.outfit ? ` · outfits：${t.outfit}` : ''}` }) : null)
          : null));
    }
  };

  const stat = (n, label) => el('div', { class: 'fun-stat' },
    el('b', { text: String(n) }), el('span', { text: label }));

  const load = async () => {
    try {
      const data = await ctx.invoke('list');
      if (!data?.ok) throw new Error(data?.error ?? '返回不正常');
      render(data);
    } catch (err) {
      root.replaceChildren();
      ensureStyle(root);
      const box2 = shell(root);
      box2.appendChild(errorCard(err));
    }
  };

  void load();
  return { refresh: load };
}

export default {
  panels: {
    places: { mount: mountPlaces },
    book: { mount: mountBook },
  },
};
