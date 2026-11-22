/**
 * 「家」的十个活动各自站在哪、多大。
 *
 * `x` / `y` 是素材单里那张 1920×1080 对齐参考图上的坐标（x = 水平中心，y = 画布底边），
 * `scale` = 角色高度 / 舞台高。内置的 Q 版立绘已经裁掉透明边，所以 `scale` 就是
 * 画面上看得见的高度，不再是「连留白一起」的高度——这也是 0.7.1 把默认值整体调小的原因：
 * 旧的 0.50–0.52 是按带留白的半写实立绘量的，Q 版照那个高度会顶到墙。
 *
 * 素材是「坐在地上/垫子上」的，所以全部落地板，不是坐沙发；比例按姿势分：
 * 站 0.36–0.40 / 坐 0.28–0.32 / 躺 0.26。换成自己传的图时，同一套默认值仍能用，
 * 想再大再小就用布置页的「位置微调」，只存改过的。
 *
 * 坐标不写进 `room.json`：它是默认值，用户微调过的才存 `room.placements`。
 */
export const HOME_LAYOUT = Object.freeze({
  idle: { x: 0.52, y: 0.93, scale: 0.40 },
  reading: { x: 0.40, y: 0.92, scale: 0.30 },
  watching: { x: 0.60, y: 0.93, scale: 0.30 },
  cards: { x: 0.34, y: 0.93, scale: 0.30 },
  gaming: { x: 0.50, y: 0.955, scale: 0.28 },
  chatting: { x: 0.62, y: 0.93, scale: 0.32 },
  cooking: { x: 0.13, y: 0.93, scale: 0.40 },
  painting: { x: 0.30, y: 0.93, scale: 0.36 },
  looking_outside: { x: 0.21, y: 0.93, scale: 0.40 },
  sleeping: { x: 0.45, y: 0.94, scale: 0.26 },
});

export const HOME_FALLBACK = Object.freeze({ x: 0.52, y: 0.93, scale: 0.40 });

export const positionOf = (activity) => HOME_LAYOUT[activity] ?? HOME_FALLBACK;