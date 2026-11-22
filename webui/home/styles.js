/**
 * 「家」面板的样式。根元素带 `fun fhm`：`.fun` 那层是 0.4.3 的「旅行手账」主题
 * token（纸色、圆角、focus ring、明暗与减少动画），这里只补房间自己的版式。
 *
 * 没有背景图时靠 `.fhm-room` 画一间纯 CSS 的屋子：一段墙、一扇窗、一条地板线、
 * 一块地毯。颜色全部走宿主变量，暗色主题下不会变成一块白板。
 */
export const HOME_STYLES = `
/* 自己的主题 token：家是第一块页签，宿主可能只挂载这一块，
   不能指望别的面板先把 .fun 那层样式注进来。 */
.fhm{--f-line:var(--border,#e3e4e3);--f-ink:var(--foreground,#1b1a1e);--f-dim:var(--muted-foreground,#5c5c60);
  --f-card:var(--surface,#fbfbfb);--f-soft:color-mix(in srgb,var(--surface,#fbfbfb) 92%,var(--foreground,#1b1a1e));
  --f-accent:var(--accent,#00a870);--f-warm:#e0862f;--f-mint:#00a870;
  font:13px/1.6 var(--sans,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);
  color:var(--f-ink,#1b1a1e);max-width:1040px;margin:0 auto;padding:4px 2px 22px}
.fhm *{box-sizing:border-box}
.fhm-head{padding:2px 2px 10px}
.fhm-kicker{margin:0;font-size:11.5px;letter-spacing:.06em;color:var(--f-dim,#6b6b70)}
.fhm-title{margin:3px 0 0;font-size:22px;line-height:1.25;font-weight:650;letter-spacing:.01em}
.fhm-sub{margin:5px 0 0;font-size:12.5px;line-height:1.6;color:var(--f-dim,#6b6b70)}
.fhm-feedback{min-height:18px;font-size:12px;line-height:1.5;margin:2px 2px 8px;color:var(--f-dim,#6b6b70)}
.fhm-feedback[data-tone="error"]{color:#c0453c}
.fhm-feedback[data-tone="ok"]{color:var(--f-mint,#00a870)}

.fhm-stage{position:relative;aspect-ratio:16/9;max-height:min(62vh,600px);min-height:190px;border:1px solid var(--f-line,#e3e4e3);border-radius:14px;overflow:hidden;background:var(--f-soft,#f3efe9);isolation:isolate}
.fhm-stage:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}
.fhm-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0;display:block}
.fhm-room{position:absolute;inset:0;z-index:0;
  background:
    linear-gradient(180deg,color-mix(in srgb,var(--f-warm,#e0862f) 10%,var(--f-soft,#f3efe9)) 0%,var(--f-soft,#f3efe9) 62%),
    linear-gradient(180deg,transparent 61%,color-mix(in srgb,var(--f-warm,#e0862f) 18%,var(--f-card,#fbfbfb)) 62%,color-mix(in srgb,var(--f-warm,#e0862f) 10%,var(--f-card,#fbfbfb)) 100%)}
.fhm-window{position:absolute;left:6%;top:14%;width:22%;height:42%;border-radius:8px 8px 4px 4px;
  background:linear-gradient(160deg,color-mix(in srgb,#cfe6f3 60%,var(--f-card,#fbfbfb)),color-mix(in srgb,#eaf4f8 45%,var(--f-card,#fbfbfb)) 60%,color-mix(in srgb,#f6fbfd 35%,var(--f-card,#fbfbfb)));
  border:3px solid color-mix(in srgb,var(--f-line,#e3e4e3) 80%,transparent);
  box-shadow:inset 0 0 22px color-mix(in srgb,#ffeebe 45%,transparent)}
.fhm-window::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;transform:translateX(-50%);background:color-mix(in srgb,var(--f-line,#e3e4e3) 85%,transparent)}
.fhm-sofa{position:absolute;right:9%;bottom:22%;width:30%;height:22%;border-radius:12px 12px 8px 8px;
  background:linear-gradient(180deg,color-mix(in srgb,var(--f-warm,#e0862f) 22%,var(--f-card,#fbfbfb)),color-mix(in srgb,var(--f-warm,#e0862f) 30%,var(--f-card,#fbfbfb)))}
.fhm-sofa::before{content:"";position:absolute;left:4%;right:4%;top:-30%;height:34%;border-radius:12px 12px 4px 4px;background:color-mix(in srgb,var(--f-warm,#e0862f) 18%,var(--f-card,#fbfbfb))}
.fhm-sofa::after{content:"";position:absolute;left:50%;top:8%;bottom:10%;width:1px;transform:translateX(-50%);
  background:color-mix(in srgb,var(--f-warm,#e0862f) 26%,transparent)}
.fhm-baseboard{position:absolute;left:0;right:0;bottom:22%;height:2px;background:color-mix(in srgb,var(--f-line,#e3e4e3) 70%,transparent)}
.fhm-rug{position:absolute;left:28%;bottom:6%;width:34%;height:16%;border-radius:50%;
  background:color-mix(in srgb,var(--f-warm,#e0862f) 14%,var(--f-card,#fbfbfb));border:1px dashed color-mix(in srgb,var(--f-line,#e3e4e3) 90%,transparent)}
.fhm-room-note{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);margin:0;font-size:11.5px;color:var(--f-dim,#6b6b70);text-align:center;line-height:1.7;z-index:1;pointer-events:none;width:80%}
.fhm-room-note b{display:block;font-weight:600;color:var(--f-ink,#1b1a1e);font-size:12.5px;margin-bottom:3px}

.fhm-char{position:absolute;z-index:2;max-height:76%;max-width:42%;object-fit:contain;transform:translateX(-50%);
  filter:drop-shadow(0 8px 14px rgba(24,24,30,.16));transition:none}
.fhm-char-empty{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);width:34%;height:9%;border-radius:50%;
  background:radial-gradient(ellipse at center,rgba(24,24,30,.16),transparent 70%);z-index:1}
.fhm-char-hint{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);margin:0;font-size:11px;color:var(--f-dim,#6b6b70);z-index:3;white-space:nowrap}

.fhm-status{position:absolute;left:10px;top:10px;margin:0;z-index:3;padding:3px 9px;border-radius:999px;font-size:11.5px;
  background:color-mix(in srgb,var(--f-card,#fbfbfb) 82%,transparent);color:var(--f-ink,#1b1a1e);backdrop-filter:blur(2px)}
.fhm-place{position:absolute;right:10px;top:10px;margin:0;z-index:3;padding:3px 9px;border-radius:999px;font-size:11.5px;
  background:color-mix(in srgb,var(--f-card,#fbfbfb) 82%,transparent);color:var(--f-dim,#6b6b70);max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fhm-place[data-out="1"]{color:var(--f-warm,#e0862f)}
.fhm-note{position:absolute;left:12px;bottom:12px;right:12px;margin:0;z-index:3;padding:6px 10px;border-radius:10px;font-size:12px;line-height:1.5;
  background:color-mix(in srgb,var(--f-card,#fbfbfb) 86%,transparent);color:var(--f-ink,#1b1a1e)}
.fhm-spot{position:absolute;z-index:3;width:22px;height:22px;border-radius:50%;transform:translate(-50%,-50%);
  border:1px solid color-mix(in srgb,var(--f-accent,#00a870) 55%,transparent);background:color-mix(in srgb,var(--f-accent,#00a870) 16%,transparent)}
.fhm-spot-label{position:absolute;z-index:3;transform:translate(-50%,-100%);font-size:10.5px;color:var(--f-dim,#6b6b70);white-space:nowrap}

.fhm-chips{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;padding:10px 2px 4px;scrollbar-width:thin}
.fhm-chip{flex:none;font-size:12px;line-height:1.5;padding:4px 11px;border-radius:999px;cursor:pointer;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-card,#fbfbfb);color:var(--f-dim,#6b6b70);font:inherit;font-size:12px}
.fhm-chip:hover{border-color:var(--f-accent,#00a870);color:var(--f-ink,#1b1a1e)}
.fhm-chip[aria-pressed="true"]{color:var(--f-ink,#1b1a1e);border-color:var(--f-accent,#00a870);
  background:color-mix(in srgb,var(--f-accent,#00a870) 12%,var(--f-card,#fbfbfb))}
.fhm-chip:disabled{opacity:.5;cursor:default}
.fhm-chip:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}

.fhm-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 2px 0}
.fhm-actions button{font:inherit;font-size:12px;padding:4px 11px;border-radius:999px;cursor:pointer;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-card,#fbfbfb);color:var(--f-ink,#1b1a1e)}
.fhm-actions button:hover{border-color:var(--f-accent,#00a870)}
.fhm-actions button:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}
.fhm-fine{margin-left:auto;font-size:11px;color:var(--f-dim,#6b6b70);line-height:1.5}
.fhm-foot{margin:8px 2px 0;font-size:11.5px;color:var(--f-dim,#6b6b70);line-height:1.6}

.fhm-dress{margin-top:10px;border:1px solid var(--f-line,#e3e4e3);border-radius:14px;padding:12px 13px;background:var(--f-card,#fbfbfb);max-width:760px}
.fhm-dress[hidden]{display:none}
.fhm-dress h3{margin:0 0 4px;font-size:14px;font-weight:600}
.fhm-dress-note{margin:0 0 10px;font-size:11.5px;line-height:1.6;color:var(--f-dim,#6b6b70)}
.fhm-row{display:grid;grid-template-columns:84px minmax(0,1fr) 54px 54px;gap:8px;align-items:center;padding:5px 0;border-top:1px dashed var(--f-line,#e3e4e3)}
.fhm-row:first-of-type{border-top:none}
.fhm-row-name{font-size:12px;color:var(--f-ink,#1b1a1e)}
.fhm-row input[type=file]{font:inherit;font-size:11px;min-width:0;color:var(--f-dim,#6b6b70)}
.fhm-row button{font:inherit;font-size:11.5px;padding:3px 9px;border-radius:999px;cursor:pointer;border:1px solid var(--f-line,#e3e4e3);background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}
.fhm-row button:hover{border-color:var(--f-accent,#00a870)}
.fhm-row button:disabled{opacity:.45;cursor:default}
.fhm-note-form{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;margin-top:4px;padding-top:10px;border-top:1px dashed var(--f-line,#e3e4e3)}
.fhm-note-form textarea{flex:1;min-width:180px;min-height:52px;resize:vertical;font:inherit;font-size:12px;line-height:1.55;padding:6px 9px;
  border:1px solid var(--f-line,#e3e4e3);border-radius:10px;background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}
.fhm-note-form textarea:focus{border-color:var(--f-accent,#00a870);outline:none}
.fhm-note-form button{font:inherit;font-size:12px;padding:5px 12px;border-radius:999px;cursor:pointer;border:1px solid var(--f-accent,#00a870);background:var(--f-accent,#00a870);color:#fff}
.fhm-note-form button:disabled{opacity:.55;cursor:default}

@media (max-width:560px){
  .fhm-title{font-size:19px}
  .fhm-stage{max-height:40vh;min-height:170px}
  .fhm-fine{margin-left:0;flex-basis:100%}
  .fhm-row{grid-template-columns:1fr;gap:4px}
  .fhm-row button{justify-self:start}
}
@media (prefers-reduced-motion:reduce){
  .fhm *{transition:none !important;animation:none !important}
}
`;
