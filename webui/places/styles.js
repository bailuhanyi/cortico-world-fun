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
.fpl-header h2 { font-size: 25px; line-height: 1.3; letter-spacing: .04em; margin-bottom: 7px; }
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
@media (max-width: 420px) {
  .fpl { padding-inline: 0; }
  .fpl-card { padding: 10px; }
  .fpl-grid { grid-template-columns: 1fr; }
}
`;
