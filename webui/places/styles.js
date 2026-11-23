export const STYLES = `
.fpl {
  --fpl-ink: var(--foreground, #211e24);
  --fpl-muted: var(--muted-foreground, #615c65);
  --fpl-card: var(--surface, #fbfbfb);
  --fpl-line: var(--border, #dedbe0);
  --fpl-accent: var(--accent, #087f5b);
  --fpl-soft: color-mix(in srgb, var(--fpl-accent) 7%, var(--fpl-card));
  --fpl-round: 12px;
  color: var(--fpl-ink);
  font: 14px/1.6 var(--sans, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif);
  padding: 8px 4px 24px;
  overflow-wrap: anywhere;
}
.fpl * { box-sizing: border-box; }
.fpl h2, .fpl h3, .fpl h4, .fpl p { margin: 0; }
.fpl h2 { font-size: 20px; }
.fpl h3 { font-size: 17px; }
.fpl h4 { font-size: 14px; }
.fpl-header { border-bottom: 1px solid var(--fpl-line); padding-bottom: 12px; margin-bottom: 12px; }
.fpl-kicker { margin: 0 0 6px; font-size: 11px; letter-spacing: .14em; color: var(--fpl-muted); }
.fpl-header h2 { font-size: 30px; line-height: 1.35; letter-spacing: .05em; margin-bottom: 7px; }
.fpl-nav { margin-bottom: 14px; }
.fpl-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.fpl-stack { display: grid; gap: 12px; min-width: 0; }
.fpl-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); }
.fpl-card, .fpl-empty, .fpl-feedback:not(:empty) { border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); padding: 13px; }
.fpl-card { background: var(--fpl-card); min-width: 0; }
.fpl-empty { border-style: dashed; background: var(--fpl-soft); }
.fpl-feedback:not(:empty) { margin-bottom: 12px; background: var(--fpl-soft); }
.fpl-feedback[role=alert] { border-color: var(--destructive, #ae4141); }
.fpl-muted { color: var(--fpl-muted); font-size: 12px; }
.fpl-wrap { white-space: pre-wrap; }
.fpl label.fpl-field { display: grid; gap: 4px; align-content: start; min-width: 0; font-weight: 600; }
.fpl .fpl-check { display: flex; align-items: start; gap: 7px; }
.fpl button, .fpl input:not([type=checkbox]), .fpl textarea, .fpl select {
  min-height: 34px;
  padding: 5px 9px;
  border: 1px solid var(--fpl-line);
  border-radius: var(--radius-sm, 6px);
  background: var(--fpl-card);
  color: var(--fpl-ink);
  font: inherit;
}
.fpl input:not([type=checkbox]), .fpl textarea, .fpl select { width: 100%; }
.fpl input[type=range], .fpl input[type=checkbox] { accent-color: var(--fpl-accent); }
.fpl textarea { resize: vertical; }
.fpl button { cursor: pointer; }
.fpl button:hover:not(:disabled), .fpl button[aria-current=page] { border-color: var(--fpl-accent); background: var(--fpl-soft); }
.fpl button.fpl-primary { background: var(--fpl-accent); border-color: var(--fpl-accent); color: var(--accent-foreground, #fff); font-weight: 600; }
.fpl button.fpl-primary:hover:not(:disabled) { background: var(--fpl-accent); filter: brightness(1.08); }
.fpl button:disabled { opacity: .58; cursor: default; }
.fpl :is(button, input, select, textarea, a, summary):focus-visible { outline: 2px solid var(--fpl-accent); outline-offset: 2px; }
.fpl fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.fpl legend { padding: 0; margin: 0 0 8px; font-weight: 650; }
.fpl .fpl-tile { width: 100%; height: 100%; padding: 13px; display: grid; align-content: start; gap: 6px; text-align: start; border-radius: var(--fpl-round); }
.fpl-tile strong { font-size: 15px; }
.fpl-tile p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fpl-chip { border: 1px solid var(--fpl-line); background: var(--fpl-soft); border-radius: 999px; padding: 0 8px; font-size: 12px; }
.fpl-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.fpl button.fpl-chip-toggle { min-height: 0; padding: 3px 11px; border-radius: 999px; font-size: 12px; line-height: 1.6; }
.fpl button.fpl-chip-toggle[aria-pressed="true"] { background: var(--fpl-accent); border-color: var(--fpl-accent); color: var(--accent-foreground, #fff); font-weight: 600; }
.fpl-cover { display: grid; place-items: center; overflow: hidden; border: 1px solid var(--fpl-line); border-radius: 8px; aspect-ratio: 16 / 7; background: var(--fpl-soft); }
.fpl-cover > img { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
.fpl-original { display: block; max-width: 100%; max-height: 60vh; object-fit: contain; margin: 8px auto 0; }
.fpl summary { cursor: pointer; color: var(--fpl-accent); }
.fpl ul { padding-left: 1.3em; margin: 0; }
.fpl .fpl-relation + .fpl-relation, .fpl .fpl-import-row + .fpl-import-row { border-top: 1px solid var(--fpl-line); padding-top: 12px; }
.fpl-artwork-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.fpl-artwork-card { display: grid; gap: 9px; align-content: start; }
.fpl-artwork-preview { display: grid; place-items: center; overflow: hidden; border: 1px solid var(--fpl-line); border-radius: 8px; aspect-ratio: 16 / 9; background: var(--fpl-soft); }
.fpl-artwork-preview > img { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
.fpl-artwork-card code { font-size: 11px; color: var(--fpl-muted); }
.fpl-notice { border: 1px solid var(--fpl-line); border-radius: 8px; padding: 8px 10px; background: var(--fpl-soft); }
.fpl-error { color: var(--destructive, #ae4141); }
@media (max-width: 420px) {
  .fpl { padding-inline: 0; }
  .fpl-card { padding: 10px; }
  .fpl-grid { grid-template-columns: 1fr; }
}

/* ── 地点册版式：左栏「我的地点册 / 整理与设置」+ 右侧封面列表 ── */
.fpl-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 4px 0 7px; }
.fpl-heading h2 { margin: 0; }
.fpl-shell { display: grid; grid-template-columns: 224px minmax(0, 1fr); gap: 26px; align-items: start; min-width: 0; }
.fpl-rail { min-width: 0; border-right: 1px solid var(--fpl-line); padding-right: 22px; }
.fpl-rail-group + .fpl-rail-group { border-top: 1px solid var(--fpl-line); margin-top: 18px; padding-top: 16px; }
.fpl-rail-title { margin: 0 0 8px; font-size: 10px; letter-spacing: .14em; font-weight: 600; color: var(--fpl-muted); }
.fpl-rail-list { display: grid; gap: 2px; min-width: 0; }
.fpl-rail-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 34px; padding: 7px 12px; border: 1px solid transparent; border-radius: 7px; background: none; color: var(--fpl-ink); font-size: 12.5px; text-align: start; position: relative; }
.fpl button.fpl-rail-item { border-color: transparent; background: none; }
.fpl-rail-item:hover:not(:disabled) { background: var(--fpl-soft); }
.fpl-rail-item.on { background: var(--fpl-soft); color: var(--fpl-accent); font-weight: 600; }
.fpl-rail-item.on::before { content: ""; position: absolute; left: 0; top: 9px; bottom: 9px; width: 2px; border-radius: 2px; background: var(--fpl-accent); }
.fpl-rail-count { font-size: 11.5px; font-weight: 500; color: var(--fpl-muted); font-variant-numeric: tabular-nums; }
.fpl-rail-item.on .fpl-rail-count { color: var(--fpl-accent); }
.fpl-rail-set { display: block; width: 100%; min-height: 34px; padding: 7px 12px; border: 1px solid transparent; border-radius: 7px; background: none; color: var(--fpl-muted); font-size: 12px; text-align: start; }
.fpl button.fpl-rail-set { border-color: transparent; background: none; }
.fpl-rail-set:hover:not(:disabled) { background: var(--fpl-soft); color: var(--fpl-accent); }
.fpl-rail-set.on { background: var(--fpl-soft); color: var(--fpl-accent); font-weight: 600; }
.fpl-rail-refresh { margin-top: 8px; border-top: 1px dashed var(--fpl-line); border-radius: 0; padding-top: 10px; }
.fpl-pane { min-width: 0; }

.fpl-toolbar { display: flex; gap: 10px; margin-bottom: 14px; }
.fpl-search { display: flex; align-items: center; flex: 1; min-width: 0; }
.fpl-search input { width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid var(--fpl-line); border-radius: 9px; background: var(--fpl-card); }
.fpl-toolbar select { flex: none; width: 132px; max-width: 100%; padding: 9px 10px; border: 1px solid var(--fpl-line); border-radius: 9px; background: var(--fpl-card); }
.fpl-panehead { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.fpl-pane-count { margin: 0; font-size: 11px; color: var(--fpl-muted); }
.fpl-viewtoggle { min-height: 0; padding: 4px 8px; border: 1px solid transparent; border-radius: 7px; background: none; color: var(--fpl-muted); font-size: 11.5px; }
.fpl button.fpl-viewtoggle { border-color: transparent; background: none; }
.fpl-viewtoggle:hover:not(:disabled) { border-color: var(--fpl-line); color: var(--fpl-accent); }
.fpl-viewtoggle[aria-pressed="true"] { border-color: color-mix(in srgb, var(--fpl-accent) 30%, var(--fpl-line)); background: var(--fpl-soft); color: var(--fpl-accent); }

.fpl-row-list { display: grid; border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); overflow: hidden; background: var(--fpl-card); }
.fpl-listrow { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--fpl-line); min-width: 0; }
.fpl-listrow:first-child { border-top: 0; }
.fpl-thumb { width: 112px; aspect-ratio: 5 / 3; border-radius: 8px; overflow: hidden; background: var(--fpl-soft); display: grid; place-items: center; }
.fpl-thumb img { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
.fpl-thumb-empty { font-size: 10px; color: var(--fpl-muted); }
.fpl-listrow-main { min-width: 0; display: grid; gap: 4px; }
.fpl-listrow-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fpl-name { min-height: 0; padding: 0; border: 0; background: none; color: var(--fpl-ink); font-size: 14.5px; font-weight: 600; letter-spacing: .02em; text-align: start; border-radius: 4px; }
.fpl button.fpl-name { border-color: transparent; background: none; padding: 0; }
.fpl-name:hover:not(:disabled) { background: none; color: var(--fpl-accent); text-decoration: underline; }
.fpl-badge { display: inline-flex; align-items: center; padding: 2px 7px; border: 1px solid var(--fpl-line); border-radius: 5px; font-size: 10px; line-height: 1.6; white-space: nowrap; color: var(--fpl-muted); }
.fpl-badge.warm { border-color: color-mix(in srgb, #b4762f 30%, var(--fpl-line)); background: color-mix(in srgb, #b4762f 8%, var(--fpl-card)); color: color-mix(in srgb, #b4762f 70%, var(--fpl-ink)); }
.fpl-listrow-desc { margin: 0; font-size: 12px; line-height: 1.7; color: var(--fpl-muted); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fpl-listrow-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: var(--fpl-muted); }
.fpl-edit { align-self: center; white-space: nowrap; padding: 8px 14px; border: 1px solid var(--fpl-line); border-radius: 9px; background: var(--fpl-card); color: var(--fpl-ink); font-size: 12px; }
.fpl-edit:hover:not(:disabled) { border-color: var(--fpl-accent); background: var(--fpl-soft); color: var(--fpl-accent); }
.fpl-pane-hint { margin: 14px 0 0; font-size: 11px; color: var(--fpl-muted); }
.fpl [hidden] { display: none !important; }
.fpl-tile:hover { border-color: var(--fpl-accent); background: var(--fpl-soft); }

/* 编辑器：这些规则原先只在共享主题层里，地点册单独挂载时吃不到，挪到这里。 */
.fpl-editor { display: grid; gap: 20px; min-width: 0; }
@media (min-width: 900px) { .fpl-editor { grid-template-columns: 200px minmax(0, 1fr); align-items: start; } }
.fpl-editnav { display: grid; gap: 4px; align-content: start; min-width: 0; }
.fpl-editnav .fpl-editnav-cover { margin-bottom: 12px; }
.fpl-editnav button { text-align: start; width: 100%; border: 1px solid transparent; background: transparent; min-height: 38px; padding: 9px 12px; font-size: 12.5px; border-radius: var(--fpl-round); }
.fpl-editnav button[aria-current=page] { background: var(--fpl-soft); border-color: color-mix(in srgb, var(--fpl-accent) 30%, var(--fpl-line)); font-weight: 650; }
.fpl-editnav .fpl-step { color: var(--fpl-muted); margin-right: 10px; font-variant-numeric: tabular-nums; }
.fpl-savebar { position: sticky; bottom: 8px; z-index: 3; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; padding: 12px 16px; border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); background: color-mix(in srgb, var(--fpl-card) 94%, transparent); backdrop-filter: blur(10px); box-shadow: 0 8px 26px color-mix(in srgb, var(--fpl-ink) 10%, transparent); }
.fpl-savebar-status { font-size: 11.5px; color: var(--fpl-muted); display: flex; align-items: center; gap: 7px; min-width: 0; }
.fpl-savebar-status[data-dirty=true] { color: var(--fpl-accent); font-weight: 600; }
.fpl-dirty-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.fpl-formgroup { border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); padding: 16px; background: var(--fpl-card); min-width: 0; }
.fpl-grouphead { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.fpl-grouphead h4 { font-size: 14px; margin: 0; }
.fpl-grouphead small { font-size: 11px; color: var(--fpl-muted); }

@media (max-width: 760px) {
  .fpl-shell { display: block; }
  .fpl-rail { border: 0; padding: 0; margin: 0 0 14px; }
  .fpl-rail-group + .fpl-rail-group { border-top: 0; margin-top: 10px; padding-top: 0; }
  .fpl-rail-title { margin: 0 0 6px 2px; }
  .fpl-rail-list { display: flex; gap: 6px; overflow-x: auto; padding: 0 0 3px; scrollbar-width: none; }
  .fpl-rail-list::-webkit-scrollbar { display: none; }
  /* 右侧渐隐：提示第一排筛选还能往右滑（我的地点 / 住所常在屏幕外） */
  .fpl-rail-filters { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 26px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 26px), transparent); }
  .fpl-rail-item { flex: none; width: auto; min-height: 30px; gap: 6px; padding: 4px 11px; border: 1px solid var(--fpl-line); border-radius: 999px; background: var(--fpl-card); font-size: 12px; }
  .fpl-rail-item.on { border-color: color-mix(in srgb, var(--fpl-accent) 40%, var(--fpl-line)); }
  .fpl-rail-item.on::before { display: none; }
  .fpl-rail-set { flex: none; width: auto; min-height: 30px; padding: 4px 11px; border: 1px solid var(--fpl-line); border-radius: 999px; font-size: 11.5px; }
  .fpl-rail-refresh { margin: 0; border-top: 0; padding-top: 4px; }
  .fpl-toolbar { flex-wrap: wrap; margin-bottom: 12px; }
  .fpl-search { flex: 1 1 100%; }
  .fpl-toolbar select { width: 100%; }
  .fpl-editor { display: block; }
  .fpl-editnav { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 16px; padding-bottom: 4px; scrollbar-width: none; }
  .fpl-editnav::-webkit-scrollbar { display: none; }
  .fpl-editnav button { width: auto; flex: none; white-space: nowrap; border-color: var(--fpl-line); }
  .fpl-editnav .fpl-editnav-cover, .fpl-editnav .fpl-editnav-meta { display: none; }
  .fpl-formgroup { padding: 14px; }
  .fpl-listrow { grid-template-columns: 84px minmax(0, 1fr); gap: 6px 12px; padding: 13px 14px; align-items: start; }
  .fpl-thumb { width: 84px; grid-row: 1 / span 3; }
  .fpl-edit { grid-column: 2; justify-self: start; padding: 6px 11px; font-size: 11.5px; }
  .fpl-header h2 { font-size: 22px; }
}
`;
