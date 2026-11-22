/**
 * 「家」的十个活动各自站在哪、多大。
 *
 * 这几个数字不是随便定的：它们是 [素材单](../../../素材单-鱼的家2D房间/素材单.md)
 * 里那张 1920×1080 对齐参考图上的坐标（x = 水平中心，y = 画布底边），
 * `scale` = 角色高度 / 舞台高。素材是「坐在地上/垫子上」的，所以全部落地板，
 * 不是坐沙发；比例按姿势分：站 0.50–0.52 / 坐 0.38–0.42 / 躺 0.34。
 *
 * 坐标不写进 `room.json`：它是默认值，用户微调过的才存 `room.placements`。
 */
export const HOME_LAYOUT = Object.freeze({
  idle: { x: 0.52, y: 0.93, scale: 0.52 },
  reading: { x: 0.40, y: 0.92, scale: 0.40 },
  watching: { x: 0.60, y: 0.93, scale: 0.40 },
  cards: { x: 0.34, y: 0.93, scale: 0.42 },
  gaming: { x: 0.50, y: 0.955, scale: 0.38 },
  chatting: { x: 0.62, y: 0.93, scale: 0.40 },
  cooking: { x: 0.13, y: 0.93, scale: 0.52 },
  painting: { x: 0.30, y: 0.93, scale: 0.50 },
  looking_outside: { x: 0.21, y: 0.93, scale: 0.52 },
  sleeping: { x: 0.45, y: 0.94, scale: 0.34 },
});

export const HOME_FALLBACK = Object.freeze({ x: 0.52, y: 0.93, scale: 0.52 });

export const positionOf = (activity) => HOME_LAYOUT[activity] ?? HOME_FALLBACK;