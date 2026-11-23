import { mountStories } from './stories.js';
import { mountFishStory } from './story-mount.js';
import { mountHome } from './home/webui.js';
import { mountPlaces as mountLocations } from './places/webui.js';
import { el, errorCard, feedback, heading } from './dom.js';
/**
 * 从0开始的肥鱼大冒险面板的浏览器端（Coo WebUI 扩展面板）。
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
 * 四个面板（经 npm run build:webui 打包为宿主声明的一份 JS）：
 *   places —— 二十处地方（以及自己加的、改过的）此刻的状态，以及她正在逛的这一趟
 *   book   —— 纪念册：去过的每一趟与出游心愿
 *   shelf  —— 纪念品架：长期收藏与探索进度
 *   stories —— 故事工坊：用户创作与启停管理
 */

import { venueArtwork, souvenirArtwork, souvenirCategory } from './artwork.js';

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
.fun-draft{border:1px solid var(--f-line);border-left:3px solid var(--f-warm);border-radius:var(--radius-sm,6px);padding:12px 14px;margin-bottom:12px;background:var(--f-card)}
.fun-draft h3{margin:0 0 4px;font-size:15px;font-weight:600}
.fun-draft-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.fun-choice{border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:9px 11px;margin-top:9px;background:var(--f-soft)}
.fun-choice-title{font-size:12px;font-weight:600}
.fun-choice .fun-list{margin-top:4px}
.fun-choice-note{font-size:11.5px;color:var(--f-dim);margin:7px 0 0;line-height:1.5}
.fun-upcoming-wish{margin:-6px 0 12px;padding:8px 11px;border-radius:var(--radius-sm,6px);background:var(--f-soft);color:var(--f-dim);font-size:12px}

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
.fun-trip-auto{font-size:10.5px;padding:1px 7px;border-radius:999px;color:#7a5a26;
  background:color-mix(in srgb,var(--f-warm,#e0862f) 16%,transparent);border:1px solid color-mix(in srgb,var(--f-warm,#e0862f) 40%,transparent)}
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
.fun-kicker{margin:0 0 6px!important;font-size:11px!important;letter-spacing:.14em;color:var(--f-dim)}
.fun-heading-lead{font-size:12.5px!important;line-height:1.8}
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
.fun-shelf-cabinet{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(180px,100%),1fr));gap:10px;margin-top:12px}
.fun-keepsake{border:1px solid var(--f-line);border-radius:10px;padding:12px;background:var(--f-soft);min-width:0}
.fun-keepsake>summary{cursor:pointer;line-height:1.7;overflow-wrap:anywhere}.fun-keepsake>summary strong{display:block;color:var(--f-ink);font-weight:600}
.fun-keepsake .fun-trip-sum{border-top:1px dashed var(--f-line);margin-top:9px;padding-top:9px}
.fun-progress{display:block;width:100%;height:7px;margin:10px 0;accent-color:var(--f-accent);border:0;border-radius:8px;overflow:hidden;background:var(--f-line)}
.fun-progress::-webkit-progress-bar{background:var(--f-line);border-radius:8px}.fun-progress::-webkit-progress-value{background:var(--f-accent);border-radius:8px}.fun-progress::-moz-progress-bar{background:var(--f-accent);border-radius:8px}
.fun-feedback:empty{display:none}.fun-feedback{margin:10px 0}.fun-feedback .fun-err{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.fun-loading{padding:18px;color:var(--f-dim);font-size:13px}.fun-empty{border:1px dashed var(--f-line);border-radius:var(--f-round);margin:10px 0;background:var(--f-soft)}
@media(max-width:420px){.fun{padding-inline:0}.fun-live,.fun-trip,.fun-form{padding:12px}.fun-stats{gap:12px}.fun-detail-cols,.fun-form-grid{grid-template-columns:1fr}.fun-detail-top{flex-wrap:wrap}.fun-trip-actions{flex-wrap:wrap}}
.fun-art{display:block;color:color-mix(in srgb,var(--f-ink) 64%,var(--f-card));background:color-mix(in srgb,var(--f-accent) 5%,var(--f-card));border-radius:8px;margin-bottom:10px;overflow:hidden;pointer-events:none}.fun-art svg{display:block;width:100%;height:116px}.fun-art-detail svg{height:160px}.fun-icon{display:inline-flex;vertical-align:middle;flex:none;width:22px;height:22px;color:var(--f-dim);margin-right:5px}.fun-icon svg{width:100%;height:100%}.fun-keepsake>summary .fun-icon{width:32px;height:32px;margin-bottom:5px}.fun-recommendations{margin:18px 0 20px}.fun-recommendations h3{font-size:16px;margin:0 0 3px}.fun-recommend-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(218px,100%),1fr));gap:12px;margin-top:10px}.fun-recommend-card{padding:13px;border:1px solid var(--f-line);border-radius:var(--f-round);background:var(--f-card);cursor:pointer;transition:border-color .15s,background .15s}.fun-recommend-card:hover{border-color:var(--f-accent)}.fun-recommend-card:focus-visible{outline:2px solid var(--f-accent);outline-offset:3px}.fun-recommend-name{font-weight:650;font-size:15px}.fun-recommend-reason{margin-top:7px;color:var(--f-dim);font-size:12px}.fun-management{margin:16px 0;color:var(--f-dim);font-size:12px}.fun-management>summary{cursor:pointer;padding:6px 0}.fun-management .fun-bar{margin-top:8px}.fun-detail-actions{flex-wrap:wrap}.fun-detail-edit{border-color:var(--f-line);color:var(--f-dim)}.fun-album-filters{display:grid;grid-template-columns:minmax(160px,2fr) minmax(130px,1fr) minmax(130px,1fr);gap:8px;margin:14px 0}.fun-route{padding:10px 13px;border:1px dashed var(--f-line);border-radius:10px;margin:10px 0;font-size:12px}.fun-route-stops{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:5px}.fun-link{background:transparent!important;color:var(--f-accent)!important;font-size:12px!important;min-height:30px!important}.fun-inspector{margin-top:10px;padding:12px;border:1px solid var(--f-line);border-radius:10px;background:var(--f-soft)}.fun-inspector h4{margin:0 0 4px}.fun-inline-status{font-size:12px;color:var(--f-dim);padding:8px 0}.fun-timeline{list-style:none;padding:0;margin:8px 0}.fun-timeline-block{border-left:2px solid var(--f-line);padding:0 0 12px 13px;margin-left:4px}.fun-timeline-block:last-child{padding-bottom:2px}.fun-timeline-area{font-size:13px;font-weight:600;margin-bottom:5px}.fun-timeline-row{display:grid;grid-template-columns:minmax(78px,auto) 1fr;gap:10px;font-size:12.5px;margin:5px 0;overflow-wrap:anywhere}.fun-timeline-time{color:var(--f-dim);font-size:11px;font-variant-numeric:tabular-nums}.fun-timeline-choice{border-left:2px solid color-mix(in srgb,var(--f-accent) 40%,var(--f-line));margin:5px 0 5px 10px;padding-left:8px}.fun-timeline-event{margin:6px 0}.fun-timeline-source{font-size:11px;color:var(--f-dim)}.fun-recommend-card,.fun-inspector,.fun-feedback,.fun-outing-result{animation:fun-appear .16s ease-out}@keyframes fun-appear{from{opacity:.4;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}.fun-trip-detail,.fun-detail,.fun-inspector{overflow-wrap:anywhere}.fun{--f-art-warm:color-mix(in srgb,#e9b97e 63%,var(--f-card));--f-art-mint:color-mix(in srgb,#79b7a6 62%,var(--f-card));--f-art-blue:color-mix(in srgb,#7cacc2 62%,var(--f-card));--f-art-pink:color-mix(in srgb,#ce91af 56%,var(--f-card))}@media(max-width:560px){.fun-album-filters{grid-template-columns:1fr}.fun-timeline-row{grid-template-columns:78px 1fr}.fun-art-detail svg{height:128px}}@media(prefers-reduced-motion:reduce){.fun *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}



/* ─────────────────────────────────────────────────────────────
   旅行手账主题层（0.4.3）
   在既有类名之上统一配色、圆角、间距与层级；不改 DOM 契约。
   ───────────────────────────────────────────────────────────── */
.fun,.fpl,.sw{
  --f-paper:var(--surface,#fffef9);--f-paper-soft:color-mix(in srgb,var(--f-accent,#3d7462) 5%,var(--surface,#fffef9));
  --f-warm:#a17b4b;--f-round:14px;--f-round-sm:10px;
}
.fun-heading{border-bottom:1px solid var(--f-line);padding-bottom:14px;margin-bottom:20px}
.fun-heading h2{font-size:25px;letter-spacing:.04em;font-weight:650;line-height:1.3;margin:0 0 7px}
.fun-heading p{font-size:12.5px;line-height:1.75}
.fun-tabs button,.fun-filters button{min-height:32px;font-size:12.5px;padding:6px 14px}
.fun-tabs button[aria-pressed="true"],.fun-filters button[aria-pressed="true"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--f-accent) 35%,transparent)}
.fun-card{border-radius:var(--f-round);box-shadow:0 1px 0 color-mix(in srgb,var(--f-ink) 4%,transparent)}
.fun-card:focus-visible{outline:3px solid color-mix(in srgb,var(--f-accent) 55%,transparent);outline-offset:2px}
.fun-stats{border-radius:var(--f-round);background:var(--f-soft);padding:16px 20px}
.fun-stat{min-width:64px}
.fun-stat b{font:26px/1.3 Georgia,serif;font-weight:600;letter-spacing:.02em}
.fun-stat span{font-size:11.5px;letter-spacing:.02em}
.fun-ticket{border-left:3px solid color-mix(in srgb,var(--f-accent) 50%,var(--f-line));border-radius:var(--f-round);padding:16px 18px}
.fun-ticket .fun-trip-head{align-items:center}
.fun-trip-name{font-size:15px;letter-spacing:.02em}
.fun-trip-sum{font-size:13px;line-height:1.8;color:color-mix(in srgb,var(--f-ink) 88%,var(--f-dim))}
.fun-detail{border-radius:0 0 var(--f-round) var(--f-round);padding:18px;border-top:0}
.fun-detail h4{font-size:15.5px;letter-spacing:.02em}
.fun-detail .fun-sec{margin-top:12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.fun-live{border-left:3px solid var(--f-accent);border-radius:var(--f-round);padding:16px 18px}
.fun-live-idle{border-left-color:var(--f-line)}
/* 纪念品架：展示柜网格（跨地点一格一件）与进度卡片 */
.fun-shelf-cabinet{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(198px,100%),1fr));gap:14px;margin-top:12px}
.fun-shelf-cabinet .fun-keepsake{border-radius:var(--f-round);padding:0;background:var(--f-paper);overflow:hidden;transition:border-color .15s,background .15s}
.fun-shelf-cabinet .fun-keepsake:hover,.fun-shelf-cabinet .fun-keepsake[open]{border-color:color-mix(in srgb,var(--f-accent) 45%,var(--f-line))}
.fun-shelf-cabinet .fun-keepsake>summary{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;gap:3px;padding:18px 14px 14px;text-align:center;border-bottom:1px solid transparent}
.fun-shelf-cabinet .fun-keepsake[open]>summary{border-bottom-color:var(--f-line)}
.fun-shelf-cabinet .fun-keepsake>summary .fun-icon{width:46px;height:46px;margin:0 0 7px;color:var(--f-warm)}
.fun-shelf-cabinet .fun-keepsake>summary strong{font-size:14px;letter-spacing:.02em}
.fun-keepsake-place{font-size:10.5px;color:var(--f-dim);line-height:1.55;overflow-wrap:anywhere}
.fun-keepsake-count{width:100%;margin-top:7px;padding-top:8px;border-top:1px dashed var(--f-line);font-size:10.5px;color:var(--f-dim)}
.fun-shelf-cabinet .fun-keepsake>.fun-note,.fun-shelf-cabinet .fun-keepsake>.fun-trip-sum{padding:0 14px}
.fun-shelf-cabinet .fun-keepsake>.fun-note{padding-top:12px}
.fun-shelf-cabinet .fun-keepsake>.fun-trip-sum:last-child{padding-bottom:14px}
.fun-shelf-places{margin-top:14px}
.fun-sec-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin:20px 0 4px}
.fun-sec-row .fun-sec{margin:0}
.fun-sec-row .fun-note{margin:0;font-size:11.5px}
.fun-progress-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:14px;margin-top:12px}
.fun-progress-card{margin-bottom:0}
.fun-progress-card .fun-trip-sum{margin-top:8px}
.fun-empty{border-radius:var(--f-round);padding:34px 16px}
.fun-form{border-radius:var(--f-round);border-width:1px}
.fun-form-title{font-size:15px;letter-spacing:.03em}
.fun-field-label{font-size:11.5px;letter-spacing:.04em}
.fun input,.fun select,.fun textarea{border-radius:9px}
.fun-chip{border-radius:6px;letter-spacing:.02em}
.fun-recommend-card{box-shadow:0 1px 0 color-mix(in srgb,var(--f-ink) 4%,transparent)}
.fun-art-detail svg{height:180px}
/* 去哪儿：推荐主卡（有推荐时放宽成一张大卡） */
.fun-hero{border:1px solid var(--f-line);border-radius:var(--f-round);overflow:hidden;margin:0 0 18px;background:var(--f-paper)}
.fun-hero-body{padding:22px 24px}
.fun-hero h3{font-size:19px;letter-spacing:.03em;margin:8px 0 6px}
.fun-hero p{font-size:13px;line-height:1.85;color:var(--f-dim);margin-bottom:14px;max-width:52ch}
.fun-hero .fun-art{margin:0;border-radius:0}
.fun-hero .fun-art svg{height:150px}
@media(min-width:720px){
  .fun-hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);align-items:stretch}
  .fun-hero .fun-art{order:2;display:flex;align-items:center;margin:0;border-left:1px solid var(--f-line)}
  .fun-hero .fun-art svg{height:100%;min-height:150px}
  .fun-hero-body{order:1}
}
/* 纪念册：票笺日期列 */
.fun-ticket{display:grid;gap:0}
@media(min-width:641px){
  .fun-book-results .fun-ticket{grid-template-columns:86px minmax(0,1fr);align-items:start}
  .fun-book-results .fun-ticket>.fun-ticket-date{border-right:1px dashed var(--f-line);padding-right:16px;margin-right:16px;text-align:center}
  .fun-ticket-date b{display:block;font:34px/1.1 Georgia,serif;letter-spacing:.01em}
  .fun-ticket-date small{display:block;font-size:10.5px;color:var(--f-dim);margin-top:4px}
  .fun-book-results .fun-ticket>.fun-ticket-main{min-width:0}
}
@media(max-width:640px){
  .fun-ticket-date{display:flex;gap:8px;align-items:baseline;margin-bottom:6px}
  .fun-ticket-date b{font:22px/1.2 Georgia,serif}
}
/* 纪念册：主列 + 右侧心愿栏 */
.fun-with-rail{display:grid;gap:20px}
@media(min-width:960px){.fun-with-rail{grid-template-columns:minmax(0,1fr) 276px;align-items:start}}
.fun-book-main{min-width:0}
.fun-rail{border:1px solid var(--f-line);border-radius:var(--f-round);padding:18px;background:var(--f-paper);min-width:0}
.fun-rail h3{font-size:14px;letter-spacing:.03em;margin:0 0 10px}
.fun-rail p{font-size:12px;line-height:1.85;color:var(--f-dim)}
.fun-rail-wish p{font-size:12.5px;line-height:1.9;color:var(--f-ink);margin:0 0 10px;white-space:pre-line}
.fun-rail-wish .fun-chip{display:inline-block;font-size:11px;line-height:1.6}
.fun-rail-more{margin-top:10px!important;font-size:11.5px!important}
.fun-rail .fun-quote{margin-top:18px;padding-top:16px;border-top:1px dashed var(--f-line);font-size:12px;line-height:1.95;color:var(--f-dim);white-space:pre-line}
/* 没有右侧那一栏时（窄屏），摘要留在主列里，不要被 CSS 顺手藏掉。 */
@media(min-width:960px){.fun-wish-summary{display:none}}
@media(max-width:959px){.fun-rail{display:none}}
@media(max-width:640px){
  .fun-album-filters{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .fun-album-filters .fun-book-search{grid-column:1/-1}
  /* 统计改三列：五条数在一块里排整齐，不用挤成 4+1。 */
  .fun-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 14px}
  /* 票笺窄屏已经横排，进门时间在内容列里还会再出现一次。 */
  .fun-book-results .fun-ticket>.fun-ticket-date small:last-child{display:none}
}
.fun-quickstats{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px}
.fun-quickstat{flex:1 1 120px;border:1px solid var(--f-line);border-radius:var(--f-round-sm);padding:12px 14px;background:var(--f-paper-soft);min-width:0}
.fun-quickstat b{display:block;font:20px/1.3 Georgia,serif}
.fun-quickstat span{font-size:11px;color:var(--f-dim)}
/* 地点册：浏览列表与编辑工作区 */
.fpl-tile{transition:border-color .15s,background .15s}
.fpl-tile:hover{border-color:var(--fpl-accent);background:var(--fpl-soft)}
.fpl-row-list{display:grid;gap:0;border:1px solid var(--fpl-line);border-radius:var(--fpl-round);overflow:hidden;background:var(--fpl-card)}
.fpl-listrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 16px;border-top:1px solid var(--fpl-line);min-width:0}
.fpl-listrow:first-child{border-top:0}
.fpl-listrow-main{min-width:0;display:grid;gap:4px}
.fpl-listrow-main strong{font-size:14.5px;letter-spacing:.02em}
.fpl-listrow-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--fpl-muted)}
.fpl-listrow .fpl-row{align-self:start;flex-wrap:wrap}
@media(max-width:520px){.fpl-listrow{grid-template-columns:minmax(0,1fr);padding:13px 14px}.fpl-listrow .fpl-row{justify-content:flex-start}}
.fpl-editor{display:grid;gap:20px;min-width:0}
@media(min-width:900px){.fpl-editor{grid-template-columns:200px minmax(0,1fr);align-items:start}}
.fpl-editnav{display:grid;gap:4px;align-content:start;min-width:0}
.fpl-editnav .fpl-editnav-cover{margin-bottom:12px}
.fpl-editnav button{text-align:start;width:100%;border:1px solid transparent;background:transparent;min-height:38px;padding:9px 12px;font-size:12.5px;border-radius:var(--fpl-round-sm)}
.fpl-editnav button[aria-current=page]{background:var(--fpl-soft);border-color:color-mix(in srgb,var(--fpl-accent) 30%,var(--fpl-line));font-weight:650}
.fpl-editnav .fpl-step{color:var(--fpl-muted);margin-right:10px;font-variant-numeric:tabular-nums}
@media(max-width:899px){
  .fpl-editor{display:block}
  .fpl-editnav{display:flex;gap:6px;overflow:auto;margin-bottom:16px;padding-bottom:4px;scrollbar-width:none}
  .fpl-editnav button{width:auto;flex:none;white-space:nowrap;border-color:var(--fpl-line)}
  .fpl-editnav .fpl-editnav-cover,.fpl-editnav .fpl-editnav-meta{display:none}
}
.fpl-savebar{position:sticky;bottom:8px;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px;padding:12px 16px;border:1px solid var(--fpl-line);border-radius:var(--fpl-round);background:color-mix(in srgb,var(--fpl-card) 94%,transparent);backdrop-filter:blur(10px);box-shadow:0 8px 26px color-mix(in srgb,var(--fpl-ink) 10%,transparent)}
.fpl-savebar-status{font-size:11.5px;color:var(--fpl-muted);display:flex;align-items:center;gap:7px;min-width:0}
.fpl-savebar-status[data-dirty=true]{color:var(--fpl-accent);font-weight:600}
.fpl-dirty-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.fpl-formgroup{border:1px solid var(--fpl-line);border-radius:var(--fpl-round);padding:16px;background:var(--fpl-card);min-width:0}
.fpl-formgroup>legend{padding:0 6px;font-size:12px;letter-spacing:.1em;color:var(--fpl-muted)}
.fpl-grouphead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px}
.fpl-grouphead h4{font-size:14px;margin:0}
.fpl-grouphead small{font-size:11px;color:var(--fpl-muted)}
/* 故事：底部提示与作品库卡片 */
.sw-bottom-note{font-size:11px;color:var(--sw-muted);text-align:center;padding:22px 0 6px;border-top:1px solid var(--sw-line);margin-top:26px}
.sw-story-card{overflow:hidden}
.sw-story-info{padding:16px 18px}
.sw-story-info h3{font-size:16px;letter-spacing:.02em}
.sw-story-info p{font-size:12.5px;line-height:1.8;color:var(--sw-muted);margin-top:6px}
@media(max-width:420px){
  .fun-heading h2{font-size:20px}
  .fun-hero-body{padding:18px}
  .fun-hero h3{font-size:17px}
  .fun-stat b{font:22px/1.3 Georgia,serif}
  .fun-shelf-cabinet{grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr));gap:10px}
  .fun-shelf-cabinet .fun-keepsake>summary{padding:14px 10px 11px}
  .fun-shelf-cabinet .fun-keepsake>summary .fun-icon{width:38px;height:38px}
  .fun-progress-grid{grid-template-columns:minmax(0,1fr)}
  .fpl-formgroup{padding:14px}
}
@media(prefers-reduced-motion:reduce){
  .fun *,.fpl *,.sw *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}
@media(prefers-contrast:more){
  .fun,.fpl,.sw{--f-line:currentColor}
}
`;

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

function sceneArt(place, detail = false) {
  return el('div', { class: `fun-art${detail ? ' fun-art-detail' : ''}`, 'aria-hidden': 'true', 'data-artwork': place.userVenue ? 'custom' : place.id,
    html: venueArtwork(place.userVenue ? '' : place.id) });
}
function itemIcon(name) {
  return el('span', { class: 'fun-icon', 'aria-hidden': 'true', 'data-category': souvenirCategory(name), html: souvenirArtwork(name) });
}

// Refreshes and explicit view changes can repaint; typing only repaints results.
function rememberFocus(container) {
  const active = document.activeElement;
  let parent = active;
  while (parent && parent !== container) parent = parent.parentNode;
  const key = parent ? active?.getAttribute?.('data-focus-key') : null;
  const start = active?.selectionStart;
  const end = active?.selectionEnd;
  return () => {
    if (!key) return;
    const target = [...container.querySelectorAll('input'), ...container.querySelectorAll('select')]
      .find((node) => node.getAttribute('data-focus-key') === key);
    target?.focus?.();
    if (typeof start === 'number' && typeof target?.setSelectionRange === 'function' && target.type !== 'date') {
      try { target.setSelectionRange(start, end); } catch { /* Some input types do not support a caret. */ }
    }
  };
}

const routeStatus = { planned: '待出发', active: '行程中', between: '站间歇脚', completed: '已完成', cancelled: '已取消' };
function routeSummary(route, trips = [], selectTrip) {
  const node = el('section', { class: 'fun-route', 'data-route-id': route.id, 'aria-label': '联程记录' },
    el('strong', { text: `联程 · ${routeStatus[route.status] ?? '状态未知'}` }),
    el('div', { class: 'fun-route-stops', text: (route.stops ?? []).map((stop) => stop.placeName || stop.placeId).join(' → ') }));
  const retained = (route.tripIds ?? []).map((id) => trips.find((trip) => trip.id === id)).filter(Boolean);
  if (selectTrip && retained.length) node.appendChild(el('div', { class: 'fun-route-stops' }, retained.map((trip) => el('button', {
    type: 'button', class: 'fun-link', 'data-trip-id': trip.id, onclick: () => selectTrip(trip),
  }, `${trip.routeOrder ? `第 ${trip.routeOrder} 站 · ` : ''}${trip.placeName} · ${trip.day || '日期不详'}`))));
  if (selectTrip && (route.tripIds ?? []).length > retained.length) node.appendChild(el('div', { class: 'fun-note', text: '较早行程仅保留联程归属，详细记录已归档。' }));
  return node;
}

function tripDetails(trip) {
  const detail = el('section', { class: 'fun-trip-detail', 'aria-label': `${trip.placeName}行程详情` });
  if (trip.company) detail.appendChild(el('p', { text: `同行 · ${trip.company}` }));
  if (trip.timelineTruncated) detail.appendChild(el('p', { class: 'fun-note', text: '这趟记录较长，时间线保留进门与最近的活动；较早的逐项细节已省略。' }));
  if (trip.routeId) detail.appendChild(el('p', { class: 'fun-note', text: `联程${trip.routeOrder ? ` · 第 ${trip.routeOrder} 站` : ''}`, 'data-route-id': trip.routeId }));
  const supplied = Array.isArray(trip.timeline) && trip.timeline.length > 0;
  // Old arrays have no per-action clock. Preserve their text, explicitly unknown.
  const timeline = supplied ? trip.timeline : [
    ...(trip.visited ?? []).map((area) => ({ kind: 'area', text: typeof area === 'string' ? area : area.area, area: typeof area === 'string' ? area : area.area, at: null })),
    ...(trip.events ?? []).map((text) => ({ kind: 'event', text, event: text, at: null })),
    ...(trip.choices ?? []).map((choice) => ({ kind: 'choice', text: choice.result, event: choice.event, at: null })),
    ...(trip.souvenirs ?? []).map((text) => ({ kind: 'buy', text, at: null })),
    ...(trip.photos ?? []).map((text) => ({ kind: 'photo', text, at: null })),
    ...(trip.ate ?? []).map((item) => ({ kind: 'consume', text: `${item.verb}了 ${item.item}`, at: null })),
  ];
  if (timeline.length) {
    detail.appendChild(el('div', { class: 'fun-sec', text: '沿途时间线' }));
    if (!supplied) detail.appendChild(el('p', { class: 'fun-note', text: '这趟旧记录没有保存逐项时间，以下均标为时间不详。' }));
    const list = el('ol', { class: 'fun-timeline' });
    const blocks = [];
    let current = null;
    const block = (area) => {
      const node = el('li', { class: 'fun-timeline-block', 'data-area': area || '' }, el('div', { class: 'fun-timeline-area', text: area || '途中记录（区域未记）' }));
      const value = { area, node, events: [] };
      blocks.push(value); list.appendChild(node); return value;
    };
    const labels = { enter: '进门', area: '逛到', event: '小事', choice: '选择', buy: '带回', photo: '拍照', consume: '吃喝', close: '回家' };
    for (const entry of timeline) {
      const known = typeof entry.at === 'number' && Number.isFinite(entry.at);
      const clock = known ? [entry.day, entry.hm].filter(Boolean).join(' ') || '时间未标注' : '时间不详';
      const row = el('div', { class: 'fun-timeline-row', 'data-kind': entry.kind, 'data-at': known ? String(entry.at) : 'unknown' },
        el('span', { class: 'fun-timeline-time', text: clock }),
        el('span', null, entry.kind === 'buy' ? itemIcon(entry.text) : null, `${labels[entry.kind] ?? '记录'} · ${entry.text || (entry.kind === 'area' ? entry.area : '') || '未记内容'}`));
      if (entry.kind === 'enter' || entry.kind === 'close') {
        current = block(entry.kind === 'enter' ? '出发与进门' : '回家');
        current.node.appendChild(row); current = null; continue;
      }
      const source = entry.kind === 'choice' ? [...blocks].reverse().flatMap((group) => [...group.events].reverse())
        .find((event) => entry.event && event.name === entry.event && (!entry.area || event.area === entry.area)) : null;
      if (source && current === source.group && current.lastNode === source.node) {
        source.node.appendChild(el('div', { class: 'fun-timeline-choice', 'data-event': entry.event }, row));
        continue;
      }
      // Never move a late choice ahead of an intervening saved action just to
      // nest it. Its source label links it while chronological order stays put.
      const area = entry.area || '';
      if (!current || area !== current.area) current = block(area);
      if (entry.kind === 'event') {
        const event = el('div', { class: 'fun-timeline-event', 'data-event': entry.event || entry.text }, row);
        current.events.push({ name: entry.event || entry.text, area: current.area, group: current, node: event });
        current.node.appendChild(event); current.lastNode = event;
      } else {
        if (entry.kind === 'choice' && entry.event) {
          row.appendChild(el('span', { class: 'fun-timeline-source', text: `对应小事：${entry.event}` }));
          const choice = el('div', { class: 'fun-timeline-choice', 'data-event': entry.event }, row);
          current.node.appendChild(choice); current.lastNode = choice;
        } else { current.node.appendChild(row); current.lastNode = row; }
      }
    }
    detail.appendChild(list);
  }
  if (trip.note) detail.appendChild(el('p', { text: `回家备注 · ${trip.note}` }));
  if (trip.scene) detail.appendChild(el('p', { class: 'fun-dim', text: `生图 scene：${trip.scene}${trip.outfit ? ` · outfits：${trip.outfit}` : ''}` }));
  return detail;
}

/** Read-only inline lookup; its own pending/error repaint leaves search controls intact. */
function tripLookup(ctx, method, parameter, label) {
  const states = new Map();
  const views = new Map();
  const redraw = (id) => {
    for (const view of views.get(id) ?? []) {
      if (view.host.isConnected === false) views.get(id).delete(view);
      else view.paint();
    }
  };
  return (id) => {
    const state = states.get(id) ?? { opened: false, pending: false, trips: null, error: '' };
    states.set(id, state);
    const host = el('section', { class: 'fun-history', 'data-lookup-id': id });
    const paint = () => {
      let focused = document.activeElement;
      while (focused && focused !== host) focused = focused.parentNode;
      host.replaceChildren(el('button', { type: 'button', class: 'fun-link fun-history-toggle', 'aria-expanded': String(state.opened), disabled: state.pending ? 'disabled' : null,
        onclick: () => { if (state.pending) return; state.opened = !state.opened; if (state.opened && state.trips === null) void load(); else redraw(id); } },
      state.pending ? '读取中…' : state.opened ? '收起回看' : label));
      const restore = () => {
        if (!focused) return;
        if (state.pending) { host.setAttribute('tabindex', '-1'); host.focus?.(); }
        else host.querySelector('.fun-history-toggle')?.focus?.();
      };
      if (!state.opened) { restore(); return; }
      const content = el('div', { class: 'fun-history-content', 'aria-live': 'polite' }); host.appendChild(content);
      if (state.pending) content.appendChild(el('div', { class: 'fun-inline-status', role: 'status', text: '正在找这段回忆…' }));
      if (state.error) content.appendChild(el('div', { class: 'fun-err', role: 'alert' }, el('span', { text: state.error }), el('button', { type: 'button', onclick: () => { void load(); } }, '重试')));
      if (state.trips?.length === 0) content.appendChild(el('div', { class: 'fun-note', text: '没有可回看的详细行程；较早记录可能已经归档。' }));
      for (const trip of state.trips ?? []) content.appendChild(el('details', { class: 'fun-inspector', open: state.trips.length === 1 ? 'open' : null, 'data-trip-id': trip.id },
        el('summary', { text: `${trip.placeName} · ${trip.day || '日期不详'} · ${trip.summary || '行程记录'}` }), tripDetails(trip)));
      restore();
    };
    const load = async () => {
      if (state.pending) return;
      state.pending = true; state.error = ''; redraw(id);
      try {
        const result = await ctx.invoke(method, [{ [parameter]: id }]);
        if (!result?.ok) throw new Error(result?.error ?? '详细行程暂时读不到');
        if (!Array.isArray(result.trips)) throw new Error('详细行程格式不正确');
        state.trips = result.trips;
      } catch (error) { state.error = error?.message ?? String(error); }
      finally { state.pending = false; if (!ctx.signal?.aborted) redraw(id); }
    };
    if (!views.has(id)) views.set(id, new Set());
    views.get(id).add({ host, paint }); paint(); return host;
  };
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
  let expandedOrigin = 'list';
  const historyView = tripLookup(ctx, 'history', 'placeId', '回看这里的行程');
  let outingAction = '';
  let notice = null;
  let loadSequence = 0;
  /** 最近一次拿到的数据（刷新/操作后用同一份补画）。 */
  let currentData = null;
  const status = feedback(box);
  body.appendChild(el('div', { class: 'fun-loading', role: 'status', text: '正在看看有哪些地方开着…' }));

  const render = (data) => {
    const restoreFocus = rememberFocus(body);
    currentData = data;
    body.replaceChildren(heading('今天，想去哪儿？', '有些地方适合热闹，有些地方适合慢慢待着。'));

    const pendingChoice = (choice) => choice ? el('div', { class: 'fun-choice' },
      el('div', { class: 'fun-choice-title', text: choice.prompt || '待选择事件' }),
      el('ul', { class: 'fun-list' }, choice.options.map((option) => el('li', { text: option.label }))),
      el('p', { class: 'fun-choice-note', text: '她可以选一项，也可以略过。' })) : null;

    const draft = data.draft;
    if (draft) {
      const draftAction = (method, label) => el('button', {
        type: 'button',
        disabled: outingAction || (method === 'resume' && draft.canResume === false) ? 'disabled' : null,
        onclick: () => resolveDraft(method, draft.id),
      }, outingAction === method ? '处理中…' : label);
      body.appendChild(el('section', { class: 'fun-draft' },
        el('h3', { text: `未逛完 · ${draft.placeName}` }),
        el('div', { class: 'fun-meta', text: `最后活动 ${draft.lastDay ? `${draft.lastDay} ` : ''}${draft.lastHm} · 逛了 ${draft.visited.length} 处` }),
        el('div', { class: 'fun-meta', text: draft.visited.length ? `逛过：${draft.visited.map((v) => v.area).join('、')}` : '还没逛到哪儿' }),
        pendingChoice(draft.pendingChoice),
        draft.canResume === false ? el('div', { class: 'fun-meta', text: '这处已不在地点清单中，可以按已有记录回家。' }) : null,
        el('div', { class: 'fun-draft-actions' }, draftAction('resume', '继续逛'), draftAction('closeDraft', '按已有记录回家'))));
    }

    // ---- 正在逛的那一趟 ----
    if (data.session) {
      const s = data.session;
      const venue = data.places.find((p) => p.id === s.placeId);
      const leftAreas = venue
        ? venue.areas.filter((a) => !s.visited.some((v) => v.area === a))
        : [];
      const leftText = venue?.state === 'closed' ? '这处已经打烊'
        : leftAreas.length ? `还能逛：${leftAreas.slice(0, 5).join('、')}` : '这会儿开放的都逛过了';
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
        pendingChoice(s.pendingChoice),
      ));
    } else if (!draft) {
      body.appendChild(el('div', { class: 'fun-live fun-live-idle' },
        el('h3', { text: '这会儿没在逛' }),
        el('div', { class: 'fun-meta', text: `现在 ${data.nowHm} · ${data.total} 处地方里 ${data.openCount} 处开着` }),
        el('div', { class: 'fun-meta fun-dim', text: '她会自己挑一处进去；你在下面点一张卡也能看细节。' }),
      ));
    }

    if (notice) body.appendChild(el('div', {
      class: 'fun-meta fun-outing-result', role: notice.error ? 'alert' : 'status', tabindex: '-1', text: notice.text,
    }));
    if (data.upcomingWish) body.appendChild(el('div', { class: 'fun-upcoming-wish', text: data.upcomingWish }));

    if (data.route) body.appendChild(routeSummary(data.route));
    const recommendBox = el('section', { class: 'fun-recommendations', 'aria-label': '此刻推荐' });
    body.appendChild(recommendBox);
    body.appendChild(el('div', { class: 'fun-sec', text: '全部地方 · 找一处看看' }));
    const management = el('details', { class: 'fun-management' }, el('summary', { text: '地点管理与说明' }));

    // ---- 搜索条 ----
    const input = el('input', {
      class: 'fun-search',
      type: 'search',
      placeholder: '搜地方名、别名或标签（庙会 / 室内 / 夜…）',
      'aria-label': '搜索全部地方', 'data-focus-key': 'places-search',
      value: keyword,
    });
    input.addEventListener('input', () => {
      keyword = input.value;
      // 只重画列表，不重画搜索框——否则每敲一个字就丢焦点（feast 踩过这条）。
      renderList();
    });
    body.appendChild(el('div', { class: 'fun-bar' }, input));

    // C 版：去哪儿只看/出发，编辑与添加入口都收进「地点册」。
    management.appendChild(el('div', { class: 'fun-hint' },
      `这里只负责看和出发。要改地点（名字、描写、时间、能逛的、纪念品、画风、封面、关联）或添加新地点，请到「地点册」。`
      + `　预设 ${data.total - data.userVenueCount} 处，自己加了 ${data.userVenueCount} 处。`
      + (data.overriddenCount ? `　已改过 ${data.overriddenCount} 处预设，可在地点册恢复。` : '')
      + (data.feast
        ? '　吃喝的味道会去「鱼的每一天」拿（可在配置里关掉）。'
        : '　吃喝只记名字、不描述味道（可在配置里打开「去鱼的每一天拿」）。')));

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
    body.appendChild(management);

    /**
     * 重画列表。
     *
     * 展开的详情**就地插在它那张卡下面**，占满一整行（grid-column: 1/-1），
     * 而不是像 0.1.1 那样统统追加到列表末尾——那样点第一张卡要滑过十二张才看得见。
     */
    function renderList() {
      listBox.replaceChildren();
      const kw = keyword.trim().toLowerCase();
      recommendBox.replaceChildren();
      const recommendations = [...new Set(data.recommendationIds ?? [])].map((id) => data.places.find((p) => p.id === id && p.state !== 'closed')).filter(Boolean).slice(0, 3);
      if (!kw && quickFilter === '全部' && recommendations.length) {
        // 第一处推荐做成主卡：一句话理由 + 线稿；它仍是可开合的推荐卡，
        // 只是换了外观（类名沿用 fun-recommend-*，行为和键盘支持不变）。
        const [hero, ...rest] = recommendations;
        const heroOpen = expanded === hero.id && expandedOrigin === 'recommend';
        const heroCard = el('div', {
          class: `fun-recommend-card fun-hero${heroOpen ? ' fun-card-active' : ''}`,
          role: 'button',
          tabindex: '0',
          'aria-expanded': heroOpen ? 'true' : 'false',
          'aria-label': `${hero.name}，${hero.stateLabel}，查看详情`, 'data-place-id': hero.id,
          onclick: () => toggle(hero.id, true),
          onkeydown: (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
              ev.preventDefault?.();
              toggle(hero.id, true, true);
            }
          },
        },
        el('div', { class: 'fun-hero-body' },
          el('div', { class: 'fun-chips' }, el('span', { class: 'fun-chip fun-chip-on', text: '此刻推荐' }),
            hero.crowdLabel ? el('span', { class: 'fun-chip', text: hero.crowdLabel }) : null,
            hero.phase ? el('span', { class: 'fun-chip', text: hero.phase }) : null),
          el('h3', { class: 'fun-recommend-name', text: hero.name }),
          el('p', { class: 'fun-recommend-reason', text: hero.wishReason || hero.revisitReason || `${hero.hours.open}–${hero.hours.close} · ${hero.crowdLabel} · ${hero.stateLabel}` }),
          el('div', { class: 'fun-chips' },
            el('span', { class: 'fun-chip', text: `${hero.hours.open}–${hero.hours.close}` }),
            el('span', { class: 'fun-chip', text: hero.stateLabel }),
            hero.tags?.length ? el('span', { class: 'fun-chip', text: hero.tags[0] }) : null)),
        sceneArt(hero));
        recommendBox.appendChild(heroCard);
        if (heroOpen) recommendBox.appendChild(detail(hero));
        if (rest.length) {
          recommendBox.appendChild(el('p', { class: 'fun-note', text: '几处开着的地方，点开只看细节；出发与选择仍由她自己决定。' }));
          recommendBox.appendChild(el('div', { class: 'fun-recommend-grid' }, rest.map((p) => {
            const selected = expanded === p.id && expandedOrigin === 'recommend';
            const cell = el('div', { class: selected ? 'fun-cell fun-cell-open' : 'fun-cell' }, card(p, true));
            if (selected) cell.appendChild(detail(p));
            return cell;
          })));
        }
      }
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
        const isOpen = expanded === p.id && expandedOrigin === 'list';
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

    const card = (p, recommended = false) => {
      const selected = expanded === p.id && expandedOrigin === (recommended ? 'recommend' : 'list');
      const cls = [recommended ? 'fun-recommend-card' : 'fun-card'];
      if (p.state === 'closed') cls.push('fun-card-closed');
      else if (p.state === 'closingSoon') cls.push('fun-card-soon');
      else cls.push('fun-card-open');
      if (selected) cls.push('fun-card-active');
      const stateCls = p.state === 'open' ? 'fun-card-state-open'
        : (p.state === 'closingSoon' ? 'fun-card-state-soon' : '');
      const node = el('div', {
        class: cls.join(' '),
        role: 'button',
        tabindex: '0',
        'aria-expanded': selected ? 'true' : 'false',
        'aria-label': `${p.name}，${p.stateLabel}，查看详情`, 'data-place-id': p.id,
        onclick: () => toggle(p.id, recommended),
        onkeydown: (ev) => {
          // 键盘也能开合：卡片是 role=button，不能只认鼠标。
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault?.();
            toggle(p.id, recommended, true);
          }
        },
      },
      sceneArt(p),
      el('div', { class: 'fun-card-head' },
        el('span', { class: recommended ? 'fun-recommend-name' : 'fun-card-name', text: p.name }),
        p.phase ? el('span', { class: 'fun-chip fun-chip-phase', text: p.phase }) : null,
        el('span', { class: `fun-card-state ${stateCls}`, text: p.stateLabel }),
        el('span', { class: 'fun-card-arrow', text: selected ? '⌃' : '⌄' })),
      recommended ? el('div', { class: 'fun-recommend-reason', text: p.wishReason || p.revisitReason || `${p.hours.open}–${p.hours.close} · ${p.crowdLabel} · ${p.phase || p.tags?.slice(0, 2).join(' / ') || '现在开着'}` }) : null,
      recommended ? null : el('div', { class: 'fun-card-desc', text: p.desc }),
       !recommended && p.wishReason ? el('div', { class: 'fun-meta', text: p.wishReason }) : null,
       !recommended && p.revisitReason ? el('div', { class: 'fun-meta', text: p.revisitReason }) : null,
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
    function toggle(id, recommended = false, keyboard = false) {
      const origin = recommended ? 'recommend' : 'list';
      const wasOpen = expanded === id && expandedOrigin === origin;
      expanded = wasOpen ? null : id;
      expandedOrigin = origin;
      renderList();
      if (keyboard) [...(recommended ? recommendBox : listBox).querySelectorAll(recommended ? '.fun-recommend-card' : '.fun-card')]
        .find((node) => node.getAttribute('data-place-id') === id)?.focus?.();
      if (!wasOpen) {
        // 滚的是**整格**（卡 + 详情），不是只滚卡片：
        // 卡片恰好贴在视口底部时，只保证卡片可见等于详情还在屏幕外。
        const active = (recommended ? recommendBox : listBox).querySelector('.fun-card-active');
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
        sceneArt(p, true),
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
            el('div', { class: 'fun-chips' }, p.souvenirs.map((s) => el('span', { class: 'fun-chip' }, itemIcon(s), s))),
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
            : el('span', {}, '素材库里没有这处的场景，生图时 ', el('b', { text: 'scene 不用填' }), '，把地方写进 prompt 就行')),
        el('div', { class: 'fun-note', text: '要改这处地点（名字、描写、时间、能逛的、纪念品、画风、封面、关联），请到「地点册」——那里是唯一的编辑器。' }));

      d.appendChild(historyView(p.id));
      return d;
    };

    renderList();
    restoreFocus();
  };

  const load = async () => {
    const sequence = ++loadSequence;
    try {
      const data = await ctx.invoke('list');
      if (sequence !== loadSequence || ctx.signal?.aborted) return;
      if (!data?.ok) throw new Error(data?.error ?? '返回不正常');
      status.replaceChildren();
      render(data);
    } catch (err) {
      if (sequence !== loadSequence || ctx.signal?.aborted) return;
      if (!currentData) body.replaceChildren();
      status.replaceChildren(errorCard(err, load, Boolean(currentData)));
    }
  };

  async function resolveDraft(method, id) {
    if (outingAction) return;
    outingAction = method;
    notice = null;
    render(currentData);
    try {
      const result = await ctx.invoke(method, [{ id }]);
      if (!result?.ok) throw new Error(result?.error ?? '行程更新失败');
      notice = { text: result.text || '行程已更新。' };
      // 写操作已成功，刷新失败时也不重新启用这张旧草稿的按钮。
      currentData = { ...currentData, draft: null };
    } catch (err) {
      notice = { text: err?.message ?? String(err), error: true };
    } finally {
      outingAction = '';
      if (ctx.signal?.aborted) return;
      render(currentData);
      await load();
      body.querySelector('.fun-outing-result')?.focus?.();
    }
  }

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
  let bookKeyword = '';
  let bookPlace = '';
  let bookDate = '';
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

  // 宽屏侧栏：只读的心愿提醒。窄屏没有这一列，摘要回到主列（.fun-wish-summary）。
  const bookRail = (activeWishes) => el('aside', { class: 'fun-rail fun-book-rail', 'aria-label': '下次想去' },
    el('h3', { text: '下次想去' }),
    activeWishes.length
      ? [el('div', { class: 'fun-rail-wish' },
        el('p', { text: activeWishes[0].reason || `${wishTypes[activeWishes[0].type] ?? '想去'}${activeWishes[0].target ? ` · ${activeWishes[0].target}` : ''}，${activeWishes[0].placeName ?? activeWishes[0].placeId}` }),
        el('span', { class: 'fun-chip', text: `${activeWishes[0].placeName ?? activeWishes[0].placeId} · ${wishTypes[activeWishes[0].type] ?? activeWishes[0].type}` })),
      activeWishes.length > 1 ? el('p', { class: 'fun-rail-more', text: `另外还记着 ${activeWishes.length - 1} 个心愿，去「心愿」页签里看。` }) : null]
      : el('p', { text: '还没有记下的心愿。在「心愿」页签里记一个，她出门时会顺路想着。' }),
    el('div', { class: 'fun-quote', text: '心愿只作提醒。\n什么时候出门，由她决定。' }));

  const render = (data) => {
    const restoreFocus = rememberFocus(body);
    currentData = data;
    body.replaceChildren(heading('那些一起出门的日子。', '每一趟都留在这里，想起时再翻一翻。'));
    if (data.session) body.appendChild(el('div', { class: 'fun-live' },
      el('h3', { text: '正在逛 · ' + data.session.placeName }), el('div', { class: 'fun-trip-sum', text: data.session.summary })));
    else if (data.trips?.length) body.appendChild(el('div', { class: 'fun-live' },
      el('div', { class: 'fun-meta', text: '最近一趟 · ' + data.trips[0].day }),
      el('h3', { text: data.trips[0].placeName }), el('div', { class: 'fun-trip-sum', text: data.trips[0].summary })));

    const tabs = el('nav', { class: 'fun-tabs', 'aria-label': '纪念册分类' });
    for (const [id, label] of [['all', '全部行程'], ['kept', '珍藏'], ['wishes', '心愿']]) tabs.appendChild(el('button', {
      type: 'button', 'aria-pressed': String(bookTab === id), onclick: () => { bookTab = id; render(currentData); },
    }, label));
    if (bookTab === 'wishes') {
      body.appendChild(tabs);
      renderWishes(data);
      restoreFocus();
      return;
    }
    if (!data.total && !(data.keepsakeCount > 0)) {
      // 空册子也要留着页签：心愿是第一件能记下的事。
      body.appendChild(tabs);
      body.appendChild(el('div', { class: 'fun-empty', text: '纪念册还是空的——她收一次摊，这里就有一趟。' }));
      restoreFocus();
      return;
    }
    body.appendChild(el('div', { class: 'fun-stats' },
      stat(data.totalRecent ?? data.total, '近期行程'), stat(data.keepsakeCount ?? 0, '珍藏'),
      stat(data.visitedAreaCount, '处逛过'), stat(data.souvenirCount, '件纪念品'), stat(data.photoCount, '张照片')));
    if (data.mostVisited?.length) body.appendChild(el('details', { class: 'fun-wish-history' },
      el('summary', { text: '常去的' }), el('div', { class: 'fun-chips' }, data.mostVisited.slice(0, 8).map((m) => el('span', { class: 'fun-chip', text: `${m.name} ×${m.times}` })))));
    // 心愿摘要：只读提醒，不抢行程列表的位置（点「心愿」页签才进管理）。
    const activeWishes = (data.wishes ?? []).filter((w) => w.status === 'active');
    if (activeWishes.length) body.appendChild(el('div', { class: 'fun-note fun-wish-summary' },
      `记着 ${activeWishes.length} 个心愿：${activeWishes.slice(0, 3).map((w) => w.placeName ?? w.placeId).join('、')}${activeWishes.length > 3 ? ' 等' : ''}。什么时候出门，由她决定。`));
    // 宽屏：主列放票笺，右侧一栏只讲心愿；窄屏 CSS 收掉侧栏，摘要回到上面那行。
    const layout = el('div', { class: 'fun-with-rail' });
    const main = el('div', { class: 'fun-book-main' });
    layout.appendChild(main);
    layout.appendChild(bookRail(activeWishes));
    body.appendChild(layout);
    main.appendChild(tabs);
    const search = el('input', { class: 'fun-book-search', type: 'search', placeholder: '搜地点、同行人、日期、备注或沿途回忆', value: bookKeyword, 'aria-label': '搜索纪念册', 'data-focus-key': 'book-search' });
    const placeOptions = new Map((data.trips ?? []).map((trip) => [trip.placeId, trip.placeName]));
    const place = el('select', { class: 'fun-book-place', 'aria-label': '按地点筛选行程', 'data-focus-key': 'book-place' },
      el('option', { value: '', text: '所有地点' }), [...placeOptions].map(([id, name]) => el('option', { value: id, text: name })));
    place.value = bookPlace;
    const days = [...new Set((data.trips ?? []).map((trip) => trip.day || 'unknown'))];
    const date = el('select', { class: 'fun-book-date', 'aria-label': '按日期筛选行程', 'data-focus-key': 'book-date' },
      el('option', { value: '', text: '所有日期' }), days.map((day) => el('option', { value: day, text: day === 'unknown' ? '日期不详' : day })));
    date.value = bookDate;
    main.appendChild(el('div', { class: 'fun-album-filters' }, search, place, date));
    const results = el('div', { class: 'fun-book-results' }); main.appendChild(results);
    const allTrips = data.trips ?? [];
    const textFor = (trip) => [trip.placeName, trip.company, trip.day, trip.note, trip.summary,
      ...(trip.visited ?? []).map((area) => typeof area === 'string' ? area : area.area), ...(trip.events ?? []),
      ...(trip.souvenirs ?? []), ...(trip.photos ?? []), ...(trip.choices ?? []).map((choice) => choice.event + ' ' + choice.result),
      ...(trip.timeline ?? []).map((entry) => entry.text)].filter(Boolean).join(' ').toLowerCase();
    const renderResults = () => {
      results.replaceChildren();
      const keyword = bookKeyword.trim().toLowerCase();
      const trips = allTrips.filter((trip) => {
        if (bookTab === 'kept' && !trip.kept) return false;
        if (bookPlace && trip.placeId !== bookPlace) return false;
        if (bookDate && (trip.day || 'unknown') !== bookDate) return false;
        if (!keyword) return true;
        const route = (data.routes ?? []).find((group) => group.id === trip.routeId);
        const linked = route ? allTrips.filter((member) => (route.tripIds ?? []).includes(member.id)) : [];
        const linkedText = route ? [(route.stops ?? []).map((stop) => stop.placeName).join(' '), ...linked.map(textFor)].join(' ').toLowerCase() : '';
        return textFor(trip).includes(keyword) || linkedText.includes(keyword);
      });
      if (keyword || bookPlace || bookDate) results.appendChild(el('div', { class: 'fun-note', role: 'status', text: '找到 ' + trips.length + ' 趟行程；联程同时检索相连的地点与记录。' }));
      const appendTrip = (trip, parent) => {
        const open = expandedTrips.has(trip.id);
        const toggleKeep = async () => {
          if (pending.has(trip.id)) return;
          pending.add(trip.id); errors.delete(trip.id); renderResults();
          try {
            const result = await ctx.invoke('favorite', [{ id: trip.id, keep: !trip.kept }]);
            if (!result?.ok) throw new Error(result?.error ?? '珍藏状态保存失败');
            await load(true);
          } catch (error) { errors.set(trip.id, error?.message ?? String(error)); }
          finally { pending.delete(trip.id); render(currentData ?? data); }
        };
        const card = el('article', { class: 'fun-trip fun-ticket', 'data-trip-id': trip.id },
          el('div', { class: 'fun-ticket-date' },
            el('b', { text: String(Number(String(trip.day ?? '').slice(-2)) || '—') }),
            el('small', { text: (trip.day || '').slice(0, 7) || '日期不详' }),
            el('small', { text: (trip.enteredHm || '时间不详') })),
          el('div', { class: 'fun-ticket-main' },
            el('div', { class: 'fun-trip-head' }, el('span', { class: 'fun-trip-name', text: trip.placeName }),
              trip.auto ? el('span', { class: 'fun-trip-auto', text: '自己出门' }) : null,
              el('span', { class: 'fun-trip-when', text: (trip.enteredHm || '时间不详') + '–' + (trip.leftHm || '时间不详') + (trip.stayedMin ? ' · ' + trip.stayedMin + ' 分钟' : '') })),
            el('div', { class: 'fun-trip-sum', text: trip.summary }),
            trip.company ? el('div', { class: 'fun-trip-extras', text: `同行 · ${trip.company}` }) : null,
            trip.routeOrder ? el('div', { class: 'fun-note', text: '联程 · 第 ' + trip.routeOrder + ' 站' }) : null,
            el('div', { class: 'fun-trip-actions' },
              el('button', { type: 'button', class: 'fun-detail-toggle', 'data-trip-id': trip.id, 'aria-expanded': String(open), onclick: () => {
                if (open) expandedTrips.delete(trip.id); else expandedTrips.add(trip.id);
                renderResults();
                [...results.querySelectorAll('.fun-detail-toggle')].find((button) => button.getAttribute('data-trip-id') === trip.id)?.focus?.();
              } }, open ? '收起详情' : '查看详情'),
              el('button', { type: 'button', disabled: pending.has(trip.id) ? 'disabled' : null, onclick: toggleKeep }, pending.has(trip.id) ? '保存中…' : trip.kept ? '取消珍藏' : '珍藏'),
              errors.has(trip.id) ? el('span', { class: 'fun-trip-error', role: 'alert', text: errors.get(trip.id) }) : null)));
        if (open) card.querySelector('.fun-ticket-main').appendChild(tripDetails(trip));
        parent.appendChild(card);
      };
      const drawnRoutes = new Set();
      let previousDay = null;
      for (const trip of trips) {
        const route = trip.routeId && (data.routes ?? []).find((group) => group.id === trip.routeId);
        if (route) {
          if (drawnRoutes.has(route.id)) continue;
          drawnRoutes.add(route.id);
          const group = el('section', { class: 'fun-route-group', 'data-route-id': route.id });
          group.appendChild(routeSummary(route, allTrips, (selected) => {
            expandedTrips.add(selected.id); bookKeyword = ''; bookPlace = ''; bookDate = ''; bookTab = 'all';
            render(currentData);
            [...body.querySelectorAll('.fun-detail-toggle')].find((button) => button.getAttribute('data-trip-id') === selected.id)?.focus?.();
          }));
          const members = (route.tripIds ?? []).map((id) => trips.find((member) => member.id === id)).filter(Boolean);
          for (const member of members) { group.appendChild(el('div', { class: 'fun-date', text: member.day || '日期不详' })); appendTrip(member, group); }
          results.appendChild(group); previousDay = null;
        } else {
          if (trip.day !== previousDay) { results.appendChild(el('div', { class: 'fun-date', text: trip.day || '日期不详' })); previousDay = trip.day; }
          appendTrip(trip, results);
        }
      }
      if (!trips.length) results.appendChild(el('div', { class: 'fun-empty', text: bookKeyword || bookPlace || bookDate ? '没有匹配的行程，试试其他地点、日期或搜索词。' : bookTab === 'kept' ? '还没有珍藏的行程。' : '还没有可回看的行程。' }));
    };
    search.addEventListener('input', () => { bookKeyword = search.value; renderResults(); });
    place.addEventListener('change', () => { bookPlace = place.value; renderResults(); });
    date.addEventListener('change', () => { bookDate = date.value; renderResults(); });
    renderResults();
    restoreFocus();
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
  const memoryTrip = tripLookup(ctx, 'trip', 'id', '回看这趟行程');

  // 展示柜是跨地点的一格一格；服务端给了扁平 items 就用它，没有就从按地点归集里摊平。
  const shelfKeepsakes = (data) => {
    if (Array.isArray(data.items) && data.items.length) return data.items;
    return (data.byPlace ?? []).flatMap((group) => (group.items ?? [])
      .map((item) => ({ ...item, placeName: item.placeName || group.placeName })));
  };

  const keepsakeCard = (it) => el('details', { class: 'fun-keepsake' },
    el('summary', null, itemIcon(it.name), el('strong', { text: it.name }),
      el('span', { class: 'fun-keepsake-place', text: `${it.placeName || '未记地点'}${it.firstDay ? ` · ${it.firstDay}` : ''}` }),
      el('span', { class: 'fun-keepsake-count', text: it.times > 1 ? `收藏 ${it.times} 次` : '收藏 1 次' })),
    it.archivedCount ? el('div', { class: 'fun-note', text: `${it.archivedCount} 次收藏仅保留账本，详细行程已不在近期记录中。` }) : null,
    ...(it.memories ?? []).map((m) => el('div', { class: 'fun-trip-sum' },
      el('div', { text: `${m.day || '日期不详'} · ${m.summary}` }),
      m.note ? el('div', { text: `你记的：${m.note}` }) : null,
      m.id ? memoryTrip(m.id) : null)));

  const render = (data) => {
    currentData = data;
    body.replaceChildren(heading('带回来的小东西。', '一件纪念品，连着一处地方，也连着那一天。'));
    if (!data.total) {
      body.appendChild(el('div', { class: 'fun-empty', text: '架子上还什么都没有——她买过纪念品，这里就有了。' }));
    }

    body.appendChild(el('div', { class: 'fun-stats' },
      stat(data.total, '样东西'),
      stat(data.pieces, '件'),
      stat(data.places, '处地方'),
      stat(data.completePlaces, '处逛遍')));

    body.appendChild(el('div', { class: 'fun-note', text: '收藏账本长期保留；详细行程可查看最近 40 趟与珍藏行程。进度按当前场所清单统计，移除或改名不删除旧回忆。' }));

    // 展示柜：所有东西按带回的日期排开，归在哪一处写在格子里，不再分块占版面。
    const keepsakes = shelfKeepsakes(data);
    const shelves = (data.byPlace ?? []).filter((group) => (group.items ?? []).length);
    if (keepsakes.length) {
      body.appendChild(el('div', { class: 'fun-sec', text: '展示柜' }));
      body.appendChild(el('div', { class: 'fun-shelf-cabinet' }, keepsakes.map(keepsakeCard)));
      if (shelves.length) body.appendChild(el('div', { class: 'fun-chips fun-shelf-places' },
        shelves.map((group) => el('span', { class: 'fun-chip', text: `${group.placeName} ${group.items.length} 样` }))));
    }

    // 进度：只列去过的。服务端已按「快逛遍的」排好，这里照顺序画。
    const visited = (data.progress ?? []).filter((p) => p.visits > 0);
    if (visited.length) {
      body.appendChild(el('div', { class: 'fun-sec-row' },
        el('div', { class: 'fun-sec', text: '快要逛遍的地方' }),
        el('span', { class: 'fun-note', text: `逛过的 ${visited.length} 处 · 按当前地点内容统计` })));
      body.appendChild(el('div', { class: 'fun-progress-grid' }, visited.map((p) => {
        const left = p.areas.left.length;
        return el('div', { class: 'fun-trip fun-progress-card' },
          el('div', { class: 'fun-trip-head' },
            el('span', { class: 'fun-trip-name', text: p.placeName }),
            el('span', { class: 'fun-trip-when', text: `去过 ${p.visits} 次 · ${p.percent}%` })),
          el('progress', { class: 'fun-progress', max: '100', value: String(p.percent), 'aria-label': `${p.placeName}探索进度 ${p.percent}%` }),
          el('div', { class: 'fun-meta', text: `逛过 ${pct(p.areas)}${p.souvenirs.total ? ` · 纪念品 ${pct(p.souvenirs)}` : ''}${p.photos.total ? ` · 拍过 ${pct(p.photos)}` : ''}` }),
          p.phases?.length ? el('div', { class: 'fun-note fun-visited-phases', text: `去过的时段：${p.phases.join('、')}` }) : null,
          left
            ? el('div', { class: 'fun-trip-sum', text: `还差：${p.areas.left.slice(0, 6).join('、')}${left > 6 ? ` 等 ${left} 处` : ''}` })
            : el('div', { class: 'fun-trip-sum', text: '这一处已经逛遍了。' }));
      })));
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
    home: { mount: mountHome },
    places: { mount: mountPlaces },
    book: { mount: mountBook },
    shelf: { mount: mountShelf },
    locations: { mount: mountLocations },
    story: { mount: mountFishStory },
    stories: { mount: mountStories },
  },
};
