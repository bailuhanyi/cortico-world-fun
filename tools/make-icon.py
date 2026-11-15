"""
生成扩展图标 assets/icon.png（512×512，市场要求 ≤512KB）。

画意：一张游乐园的摩天轮，挂在傍晚的天色里，下面一排小小的人影和彩灯。
为什么不画具体某一处（过山车/鱼/猫）：这十二处地方跨度太大，
画任何一处都会让另外十一处显得不属于这个包；摩天轮是「出门去玩」这件事本身。

配色取 Coo 主题的薄荷绿 #00a870 作底，往傍晚的靛蓝压，彩灯用暖橙——
缩到 64px 时仍能看出「一个圆轮子 + 一圈点点」。

约定：所有坐标都写在 512 的坐标系里，统一由 S() 乘上超采样倍数再画，
最后缩回 512 —— 这样写法直观，边缘又由 LANCZOS 磨平。

用法：python tools/make-icon.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'icon.png'
SIZE = 512
SS = 4                       # 超采样倍数
N = SIZE * SS

MINT = (0, 168, 112)
NIGHT = (26, 30, 62)
NIGHT_LOW = (58, 48, 92)
LAMP = (255, 196, 92)
LAMP_CORE = (255, 242, 210)
WHEEL = (236, 241, 238)
WHEEL_DARK = (188, 200, 196)
CABIN = (255, 255, 255)


def S(v):
    """512 坐标系 → 超采样画布坐标。"""
    return int(round(v * SS))


def main():
    img = Image.new('RGB', (N, N), MINT)
    d = ImageDraw.Draw(img)

    # 底色：薄荷绿往上，傍晚的靛蓝往下压；一行行画，形成渐变的天。
    for y in range(N):
        t = y / N
        # 前 55% 从薄荷缓慢落到靛蓝，剩下再压暗一点
        if t < 0.55:
            k = t / 0.55
            c = tuple(int(MINT[i] + (NIGHT[i] - MINT[i]) * k) for i in range(3))
        else:
            k = (t - 0.55) / 0.45
            c = tuple(int(NIGHT[i] + (NIGHT_LOW[i] - NIGHT[i]) * k) for i in range(3))
        d.line([(0, y), (N, y)], fill=c)

    cx = 256.0
    cy = 236.0
    R = 132.0            # 轮子的半径
    r_hub = 17.0         # 中轴
    spokes = 12

    # ---- 支架：两条腿从轮心斜下去，脚落在画面底部 ----
    for side in (-1, 1):
        foot_x = cx + side * 96
        d.line([(S(cx), S(cy + 8)), (S(foot_x), S(474))], fill=WHEEL_DARK, width=S(9))

    # ---- 轮圈 ----
    ring = (S(cx - R), S(cy - R), S(cx + R), S(cy + R))
    d.ellipse(ring, outline=WHEEL, width=S(7))

    # ---- 辐条 + 轿厢 ----
    for i in range(spokes):
        a = (2 * math.pi / spokes) * i - math.pi / 2
        x = cx + R * math.cos(a)
        y = cy + R * math.sin(a)
        d.line([(S(cx), S(cy)), (S(x), S(y))], fill=WHEEL_DARK, width=S(4))
        # 轿厢：小方块，挂在圈外侧一点
        hx = cx + (R + 15) * math.cos(a)
        hy = cy + (R + 15) * math.sin(a)
        d.rectangle((S(hx - 13), S(hy - 11), S(hx + 13), S(hy + 13)), fill=CABIN)

    # ---- 中轴 ----
    d.ellipse((S(cx - r_hub), S(cy - r_hub), S(cx + r_hub), S(cy + r_hub)), fill=WHEEL)

    # ---- 彩灯：沿轮圈一圈暖橙的点，轮子才不冷 ----
    for i in range(spokes * 2):
        a = (2 * math.pi / (spokes * 2)) * i
        x = cx + (R - 26) * math.cos(a)
        y = cy + (R - 26) * math.sin(a)
        d.ellipse((S(x - 6), S(y - 6), S(x + 6), S(y + 6)), fill=LAMP)

    # ---- 地面：一条深色带，加一排更亮的灯点，暗示门和摊位 ----
    ground_y = 452
    d.rectangle((0, S(ground_y), N, N), fill=NIGHT_LOW)
    d.line([(0, S(ground_y)), (N, S(ground_y))], fill=WHEEL_DARK, width=S(5))
    for i in range(11):
        x = 32 + i * 45
        d.ellipse((S(x - 7), S(ground_y - 26), S(x + 7), S(ground_y - 12)), fill=LAMP)
        d.ellipse((S(x - 3), S(ground_y - 22), S(x + 3), S(ground_y - 16)), fill=LAMP_CORE)

    # ---- 天上的几点星：把「玩到晚上」说出来 ----
    for x, y, r in ((92, 96, 4), (150, 58, 3), (392, 84, 4), (438, 140, 3), (330, 44, 3)):
        d.ellipse((S(x - r), S(y - r), S(x + r), S(y + r)), fill=LAMP_CORE)

    out = img.resize((SIZE, SIZE), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, 'PNG', optimize=True)
    # 控制台是 GBK，别打印对勾这类非 GBK 字符
    kb = OUT.stat().st_size / 1024
    print(f'[ok] {OUT.relative_to(ROOT)}  {SIZE}x{SIZE}  {kb:.1f} KB')
    if kb > 512:
        raise SystemExit('[fail] 超过 512KB，市场会拒收')


if __name__ == '__main__':
    main()
