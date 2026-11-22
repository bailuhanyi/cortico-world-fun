/**
 * 「家」的十个活动各自站在哪。
 *
 * 这几个数字不是随便定的：它们是 [素材单](../../../素材单-鱼的家2D房间/素材单.md)
 * 里那张 1920×1080 对齐参考图上的坐标（x = 水平中心，y = 画布底边）。
 * 素材按同一套坐标画，换图才不会跳位；用户换了别的背景导致偏了，
 * 下一阶段再加「位置微调」，这一版不开放编辑。
 */
export const HOME_LAYOUT = Object.freeze({
  idle: { x: 0.76, y: 0.79 },
  reading: { x: 0.72, y: 0.79 },
  watching: { x: 0.80, y: 0.79 },
  chatting: { x: 0.74, y: 0.79 },
  sleeping: { x: 0.78, y: 0.76 },
  cards: { x: 0.45, y: 0.90 },
  gaming: { x: 0.47, y: 0.92 },
  painting: { x: 0.33, y: 0.88 },
  cooking: { x: 0.13, y: 0.90 },
  looking_outside: { x: 0.13, y: 0.82 },
});

export const HOME_FALLBACK = Object.freeze({ x: 0.76, y: 0.79 });

export const positionOf = (activity) => HOME_LAYOUT[activity] ?? HOME_FALLBACK;
