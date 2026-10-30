"""Hell furniture: blackened wrought iron, rust, spikes, skulls, blood-red velvet, red candles and fire."""
import math

from hlib import (BLOOD, BONE, BONE_D, EMBER, IRON, IRON_D, IRON_L, LAVA_CORE, LAVA_D, LAVA_O, LAVA_R, LAVA_Y, OBS, OBS_D, OBS_L,
                  RUST, bone, chain, embers, fire, glow, iron_bar, iron_curve, iron_grad, lava_skin, rivets, skull, spike, spike_side)
from lib import (INK, Svg, bevel, blob, blob_pts, circle, circle_d, el, ellipse, ellipse_d, f, f2, g, grain, line, mix, path, P, planks,
                 rect, rect_d, rot_pts, shade, shadow, smooth, speckle, vary)
from reg import asset

WAX = "#8e1414"          # dark red candle wax
WAX_L = "#c42a24"
GOLD = "#b8892f"
PARCH = "#d9c79e"


# ============================================================== reusable props


def red_candle(s, cx, cy, r, holder=True, lit=True, halo=True):
    """Dark red candle from above, on a spiked iron dish."""
    rng = s.rng
    parts = []
    if lit and halo:
        parts.append(glow(s, cx, cy, r * 4.6, LAVA_O, 0.42, LAVA_Y))
    if holder:
        parts.append(shadow(circle_d(cx, cy, r * 1.4), r * 0.2, r * 0.3, 0.45, soft=2))
        parts.append(circle(cx, cy, r * 1.4, fill=s.rg([(0, "#6c6c76"), (0.6, IRON), (1, IRON_D)], cx=0.38, cy=0.35),
                            stroke=IRON_D, stroke_width=f2(r * 0.14)))
        # little thorns on the dish rim
        th = []
        for i in range(6):
            a = 2 * math.pi * i / 6 + 0.3
            x0, y0 = cx + math.cos(a) * r * 1.35, cy + math.sin(a) * r * 1.35
            x1, y1 = cx + math.cos(a) * r * 1.68, cy + math.sin(a) * r * 1.68
            nx, ny = -math.sin(a) * r * 0.2, math.cos(a) * r * 0.2
            th.append(P([(x0 + nx, y0 + ny), (x1, y1), (x0 - nx, y0 - ny)]))
        parts.append(path("".join(th), fill=IRON, stroke=IRON_D, stroke_width=f2(r * 0.08)))
    parts.append(circle(cx, cy, r * 0.86, fill=s.rg([(0, WAX_L), (0.75, WAX), (1, "#4a0606")], cx=0.4, cy=0.38)))
    drips = []
    for _ in range(3):
        a = rng.uniform(0, 6.28)
        x, y = cx + math.cos(a) * r * 0.86, cy + math.sin(a) * r * 0.86
        drips.append(ellipse(x, y, r * 0.15, r * 0.24, transform=f"rotate({f(math.degrees(a) + 90)} {f2(x)} {f2(y)})"))
    parts.append(g(drips, fill=WAX))
    parts.append(circle(cx - r * 0.2, cy - r * 0.22, r * 0.22, fill="#fff", fill_opacity="0.18"))
    if lit:
        parts.append(path(smooth([(cx, cy - r * 1.05), (cx + r * 0.25, cy - r * 0.2), (cx, cy + r * 0.12), (cx - r * 0.25, cy - r * 0.2)]),
                          fill="#ff7a1a"))
        parts.append(path(smooth([(cx, cy - r * 0.75), (cx + r * 0.11, cy - r * 0.2), (cx, cy + r * 0.02), (cx - r * 0.11, cy - r * 0.2)]),
                          fill="#ffe9a0"))
    parts.append(circle(cx, cy, r * 0.08, fill="#111"))
    return g(parts)


def velvet(s, d, x0, y0, x1, y1, buttons=None, base=BLOOD):
    """Blood-red velvet cushion filling path d (sheen top-left, deep folds bottom-right, tufting buttons)."""
    cx, cy = x0 + (x1 - x0) * 0.38, y0 + (y1 - y0) * 0.35
    r = max(x1 - x0, y1 - y0) * 0.8
    parts = [path(d, fill=s.rg([(0, shade(base, 0.16)), (0.55, base), (1, shade(base, -0.14))], cx=cx, cy=cy, r=r, user=True),
                  stroke="#2a0406", stroke_width="1")]
    if buttons:
        pl = []
        for bx, by in buttons:
            # tuft creases radiating from each button
            for a in (0.6, 2.2, 3.8, 5.4):
                pl.append(f"M{f(bx)} {f(by)}l{f(math.cos(a) * 4.5)} {f(math.sin(a) * 4.5)}")
        parts.append(path("".join(pl), stroke="#2a0406", stroke_opacity="0.55", stroke_width="0.8", stroke_linecap="round"))
        parts.append(path("".join(circle_d(bx, by, 1.4) for bx, by in buttons), fill=GOLD, stroke="#3a2a08", stroke_width="0.4"))
        parts.append(path("".join(circle_d(bx - 0.4, by - 0.4, 0.5) for bx, by in buttons), fill="#fff2c0", fill_opacity="0.7"))
    parts.append(bevel(d, light="#ff9a9a", lo=0.18, do=0.35, w=1.4))
    return g(parts)


def iron_plate(s, d, x0, y0, x1, y1, rv=None, rust=4, scratches=10):
    """Blackened iron plate: brushed gradient, scorch / rust blotches, scratches, rivets."""
    rng = s.rng
    cl = s.clip(d)
    parts = [path(d, fill=iron_grad(s, x0, y0, x1, y1, base="#34343b"), stroke=IRON_D, stroke_width="1.4")]
    inner = []
    for _ in range(rust):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        rr = rng.uniform(3, 9)
        inner.append(path(blob(cx, cy, rr, rr * rng.uniform(0.5, 0.9), 7, 0.4, rng), fill=RUST, fill_opacity=f2(rng.uniform(0.18, 0.35))))
    sc = []
    for _ in range(scratches):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        a = rng.uniform(-0.5, 0.5)
        L = rng.uniform(4, 14)
        sc.append(f"M{f(cx)} {f(cy)}l{f(math.cos(a) * L)} {f(math.sin(a) * L)}")
    inner.append(path("".join(sc), stroke=IRON_L, stroke_opacity="0.3", stroke_width="0.4"))
    inner.append(speckle(s, x0, y0, x1 - x0, y1 - y0, int((x1 - x0) * (y1 - y0) / 60), ["#15151a", "#6d6f78"], 0.2, 0.6, 0.4))
    parts.append(g(inner, clip_path=cl))
    parts.append(bevel(d, light="#c8cad6", lo=0.28, do=0.4, w=1.2))
    if rv:
        parts.append(rivets(rv, 1.3))
    return g(parts)


def edge_rivets(x, y, w, h, inset=3.5, step=12):
    pts = []
    nx = max(1, round((w - 2 * inset) / step))
    ny = max(1, round((h - 2 * inset) / step))
    for i in range(nx + 1):
        px = x + inset + (w - 2 * inset) * i / nx
        pts += [(px, y + inset), (px, y + h - inset)]
    for j in range(1, ny):
        py = y + inset + (h - 2 * inset) * j / ny
        pts += [(x + inset, py), (x + w - inset, py)]
    return pts


def scroll(cx, cy, r, turns=1.4, a0=0.0, cw=True):
    """Archimedean spiral path (wrought-iron curl) ending at the centre."""
    pts = []
    n = int(turns * 16)
    for i in range(n + 1):
        t = i / n
        a = a0 + (1 if cw else -1) * t * turns * 2 * math.pi
        rr = r * (1 - t * 0.85)
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return smooth(pts, close=False)


def goblet(s, cx, cy, r, wine=True):
    parts = [shadow(circle_d(cx, cy, r * 1.15), r * 0.25, r * 0.35, 0.45, soft=2),
             circle(cx, cy, r * 1.15, fill=s.rg([(0, "#f0d48a"), (0.6, GOLD), (1, "#5a3c0e")], cx=0.38, cy=0.35), stroke="#3a2608",
                    stroke_width=f2(r * 0.12))]
    if wine:
        parts.append(circle(cx, cy, r * 0.85, fill=s.rg([(0, "#a0101c"), (1, "#3a0206")], cx=0.6, cy=0.6)))
        parts.append(ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.35, r * 0.18, fill="#fff", fill_opacity="0.3"))
    # garnet studs
    for i in range(4):
        a = 2 * math.pi * i / 4 + 0.4
        parts.append(circle(cx + math.cos(a) * r * 1.0, cy + math.sin(a) * r * 1.0, r * 0.13, fill="#c0102a"))
    return g(parts)


def quill(s, x, y, L, ang, col="#1a1416"):
    """Black raven quill."""
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    vane = (f"M{f(x)} {f(y)}Q{f(x + L * 0.3)} {f(y - L * 0.16)} {f(x + L)} {f(y - L * 0.05)}"
            f"Q{f(x + L * 0.5)} {f(y + L * 0.09)} {f(x + L * 0.18)} {f(y + L * 0.02)}Z")
    barbs = "".join(f"M{f(x + L * t)} {f(y - L * 0.02 * t)}l{f(L * 0.06)} {f(-L * 0.08 * (1 - t))}" for t in [i / 14 for i in range(3, 14)])
    return g([
        path(vane, fill="#000", fill_opacity="0.35", transform="translate(1.5 2)"),
        path(vane, fill=s.lg([(0, "#4a3a52"), (1, col)]), stroke="#000", stroke_width="0.5"),
        path(barbs, stroke="#6a5a7a", stroke_width="0.4", stroke_opacity="0.7"),
        path(f"M{f(x - L * 0.12)} {f(y + L * 0.02)}L{f(x + L)} {f(y - L * 0.05)}", stroke="#8a7f88", stroke_width="0.6"),
    ], transform=tf)


def grimoire(s, cx, cy, w, h, ang, glowing=True, runes_col="#ff5a1a"):
    """Open grimoire: black leather cover with iron corners, yellowed pages with red runes, ribbon."""
    rng = s.rng
    tf = f"rotate({f(ang)} {f(cx)} {f(cy)})"
    x, y = cx - w / 2, cy - h / 2
    parts = []
    if glowing:
        parts.append(glow(s, cx, cy, max(w, h) * 0.75, LAVA_O, 0.35, LAVA_Y))
    parts.append(shadow(rect_d(x - 2.5, y - 2.5, w + 5, h + 5, 2), 2, 2.6, 0.45))
    parts.append(rect(x - 2.5, y - 2.5, w + 5, h + 5, rx=2, fill="#1e1214", stroke="#000", stroke_width="0.9"))
    corners = "".join(P(pp) for pp in (
        [(x - 2.5, y - 2.5), (x + 6, y - 2.5), (x - 2.5, y + 6)], [(x + w + 2.5, y - 2.5), (x + w - 6, y - 2.5), (x + w + 2.5, y + 6)],
        [(x - 2.5, y + h + 2.5), (x + 6, y + h + 2.5), (x - 2.5, y + h - 6)],
        [(x + w + 2.5, y + h + 2.5), (x + w - 6, y + h + 2.5), (x + w + 2.5, y + h - 6)]))
    parts.append(path(corners, fill="#5a5a62", stroke=IRON_D, stroke_width="0.4"))
    for side in (0, 1):
        px = x + side * w / 2
        parts.append(rect(px + (0.4 if side else 0), y, w / 2 - 0.4, h,
                          fill=s.lg([(0, "#e3cf9c"), (1, "#b89e68")] if side else [(0, "#b89e68"), (1, "#e3cf9c")], 0, 0, 1, 0)))
        ln = []
        for i in range(int(h / 3.8) - 1):
            ly = y + 4 + i * 3.6
            lx = px + 3
            lw = w / 2 - 7 - rng.uniform(0, 5)
            # rune-ish strokes: short segments with gaps
            xx = lx
            while xx < lx + lw:
                seg = rng.uniform(1.2, 3.5)
                ln.append(f"M{f(xx)} {f(ly)}h{f(seg)}")
                if rng.random() < 0.3:
                    ln.append(f"M{f(xx + seg * 0.5)} {f(ly - 1)}v2")
                xx += seg + rng.uniform(0.8, 1.6)
        parts.append(path("".join(ln), stroke="#3a1a10", stroke_opacity="0.7", stroke_width="0.5"))
    # a glowing sigil on the right page
    sx, sy, sr = x + w * 0.75, y + h * 0.5, min(w, h) * 0.2
    star = [(sx + math.cos(-math.pi / 2 + k * 4 * math.pi / 5) * sr, sy + math.sin(-math.pi / 2 + k * 4 * math.pi / 5) * sr) for k in range(5)]
    parts.append(rect(x + w / 2 + 2, sy - sr - 2, w / 2 - 4, sr * 2 + 4, fill="#e3cf9c"))
    if glowing:
        parts.append(circle(sx, sy, sr * 1.3, fill=s.rg([(0, LAVA_Y, 0.6), (1, LAVA_O, 0)])))
    parts.append(circle(sx, sy, sr, fill="none", stroke=runes_col, stroke_width="0.7"))
    parts.append(path(P(star), fill="none", stroke=runes_col, stroke_width="0.7", stroke_linejoin="round"))
    parts.append(rect(cx - 3, y, 6, h, fill=s.lg([(0, "#000", 0), (0.5, "#000", 0.35), (1, "#000", 0)], 0, 0, 1, 0)))
    parts.append(path(f"M{f(cx + 2)} {f(y + h)}Q{f(cx + 5)} {f(y + h + 6)} {f(cx + 1)} {f(y + h + 11)}", fill="none", stroke="#a01018",
                      stroke_width="1.4"))
    return g(parts, transform=tf)


def papers(s, cx, cy, w, h, n, rng):
    parts = []
    for i in range(n):
        a = rng.uniform(-18, 18)
        x, y = cx + rng.uniform(-4, 4), cy + rng.uniform(-3, 3)
        d = rect_d(x - w / 2, y - h / 2, w, h)
        ln = "".join(f"M{f(x - w / 2 + 2.5)} {f(y - h / 2 + 3 + k * 2.6)}h{f(w - 5 - rng.uniform(0, 4))}" for k in range(int((h - 5) / 2.6)))
        parts.append(g([path(d, fill="#000", fill_opacity="0.25", transform="translate(1 1.3)"),
                        path(d, fill=vary(PARCH, rng, l=0.04), stroke="#7a6440", stroke_width="0.4"),
                        path(ln, stroke="#5a2a1a", stroke_opacity="0.5", stroke_width="0.45")],
                       transform=f"rotate({f(a)} {f(x)} {f(y)})"))
    return g(parts)


def skull_dish_spikes(s, cx, cy, r, n):
    return g([spike_side(cx + math.cos(a) * r, cy + math.sin(a) * r, r * 0.35, r * 0.18, a)
              for a in [2 * math.pi * i / n for i in range(n)]])


def legs(pts, r=3.2):
    """Iron leg stubs peeking out (square posts)."""
    return g([g([rect(x - r + 0.8, y - r + 1.2, 2 * r, 2 * r, rx=0.8, fill="#000", fill_opacity="0.4"),
                 rect(x - r, y - r, 2 * r, 2 * r, rx=0.8, fill=IRON, stroke=IRON_D, stroke_width="0.9"),
                 path(f"M{f(x - r + 0.6)} {f(y + r - 0.6)}V{f(y - r + 0.6)}H{f(x + r - 0.6)}", fill="none", stroke=IRON_L,
                      stroke_opacity="0.5", stroke_width="0.6")]) for x, y in pts])


def claw_foot(cx, cy, r, ang):
    """Three-toed iron claw foot pointing outward at angle ang (radians)."""
    parts = []
    for k in (-0.45, 0, 0.45):
        a = ang + k
        x1, y1 = cx + math.cos(a) * r, cy + math.sin(a) * r
        parts.append(spike_side(cx, cy, r, r * 0.38, a))
    parts.append(circle(cx, cy, r * 0.32, fill=IRON, stroke=IRON_D, stroke_width="0.6"))
    return g(parts)


# ============================================================== seating


@asset("h-chair-iron", "furniture", [0.7, 0.7], "Wrought-iron chair", "Żelazne krzesło",
       tags=["chair", "seat", "iron", "hell", "krzesło", "żelazo", "piekło"])
def chair_iron(seed):
    s = Svg(70, 70, seed)
    s.add(legs([(12, 22), (58, 22), (12, 62), (58, 62)], 3.4))
    seat = rect_d(10, 20, 50, 42, 4)
    s.add(shadow(seat, 3.5, 4.5, 0.45))
    s.add(path(seat, fill=IRON, stroke=IRON_D, stroke_width="1.6"))
    cush = rect_d(14.5, 23, 41, 35, 5)
    s.add(velvet(s, cush, 14.5, 23, 55.5, 58, buttons=[(26, 35), (44, 35), (35, 47)]))
    # back rail (casts a shadow onto the seat)
    s.add(path("M7 15Q35 9 63 15", fill="none", stroke="#000", stroke_opacity="0.35", stroke_width="8", transform="translate(1.5 3.5)"))
    s.add(path("M6 11Q35 4 64 11L64 18Q35 12 6 18Z", fill=iron_grad(s, 0, 4, 0, 18), stroke=IRON_D, stroke_width="1.3",
               stroke_linejoin="round"))
    s.add(path("M8 11.3Q35 5 62 11.3", fill="none", stroke=IRON_L, stroke_opacity="0.55", stroke_width="0.8"))
    # scroll curls under the rail
    s.add(iron_curve(scroll(22, 20.5, 3.4, 1.2, 3.6), 1.2), iron_curve(scroll(48, 20.5, 3.4, 1.2, 5.8, cw=False), 1.2))
    # spike finials along the rail
    for x, yy, r in ((7, 14.5, 3.6), (20, 11.2, 2.6), (35, 9.8, 3.2), (50, 11.2, 2.6), (63, 14.5, 3.6)):
        s.add(spike(x, yy, r))
    return s.render()


@asset("h-armchair-iron", "furniture", [1, 1], "Iron armchair", "Żelazny fotel",
       tags=["armchair", "chair", "seat", "iron", "velvet", "fotel", "krzesło", "żelazo"])
def armchair_iron(seed):
    s = Svg(100, 100, seed)
    body = rect_d(8, 14, 84, 80, 6)
    s.add(shadow(body, 5, 6, 0.48))
    s.add(path(body, fill="#2a2a30", stroke=IRON_D, stroke_width="1.6"))
    cush = rect_d(24, 26, 52, 58, 7)
    s.add(velvet(s, cush, 24, 26, 76, 84, buttons=[(37, 40), (63, 40), (50, 54), (37, 68), (63, 68)]))
    # front lip of the cushion
    s.add(path("M26 80Q50 86 74 80", fill="none", stroke="#ff8a8a", stroke_opacity="0.2", stroke_width="1"))
    # armrests: iron bars with scroll ends at the front
    for x0, cw in ((15, True), (85, False)):
        s.add(path(f"M{x0} 22V82", stroke="#000", stroke_opacity="0.35", stroke_width="11", transform="translate(1.5 2.5)"))
        s.add(path(rect_d(x0 - 6, 20, 12, 64, 4), fill=iron_grad(s, x0 - 6, 0, x0 + 6, 0), stroke=IRON_D, stroke_width="1.2"))
        s.add(path(rect_d(x0 - 3.5, 24, 7, 52, 3), fill=BLOOD, stroke="#2a0406", stroke_width="0.6"))
        s.add(path(f"M{x0 - 2.5} 74V26", fill="none", stroke="#ff9a9a", stroke_opacity="0.25", stroke_width="0.8"))
        s.add(iron_curve(scroll(x0, 88, 5.5, 1.5, -math.pi / 2, cw=cw), 2.2))
        s.add(rivets([(x0, 23), (x0, 79)], 1.2))
    # tall back with spikes
    s.add(path("M6 18L94 18", stroke="#000", stroke_opacity="0.4", stroke_width="12", transform="translate(1.5 3.5)"))
    back = "M5 12Q50 2 95 12L95 22Q50 14 5 22Z"
    s.add(path(back, fill=iron_grad(s, 0, 4, 0, 22), stroke=IRON_D, stroke_width="1.4", stroke_linejoin="round"))
    s.add(path("M8 12.5Q50 4 92 12.5", fill="none", stroke=IRON_L, stroke_opacity="0.5", stroke_width="0.9"))
    s.add(rivets([(14 + i * 9.0, 17.5 - 3.2 * math.sin(math.pi * (i / 8))) for i in range(9)], 1.0))
    for x, yy, r in ((6, 16, 4.2), (25, 10.5, 3), (50, 7.6, 4.2), (75, 10.5, 3), (94, 16, 4.2)):
        s.add(spike(x, yy, r))
    return s.render()


@asset("h-bench-iron", "furniture", [2, 0.5], "Iron bench", "Żelazna ława",
       tags=["bench", "seat", "iron", "ława", "ławka", "żelazo"])
def bench_iron(seed):
    s = Svg(200, 50, seed)
    rng = s.rng
    s.add(legs([(12, 10), (188, 10), (12, 42), (188, 42), (100, 10), (100, 42)], 3.2))
    frame = rect_d(6, 6, 188, 38, 3)
    s.add(shadow(frame, 4, 5, 0.45))
    s.add(path(frame, fill="#1d1d22", stroke=IRON_D, stroke_width="1.4"))
    n = 4
    sh = 30 / n
    for i in range(n):
        y = 10 + i * sh
        d = rect_d(12, y + 0.8, 176, sh - 1.6, 1.2)
        s.add(iron_plate(s, d, 12, y, 188, y + sh, rust=2, scratches=4))
    # cross straps with rivets
    for x in (34, 100, 166):
        s.add(rect(x - 3.5, 7, 7, 36, rx=1, fill=iron_grad(s, x - 3.5, 0, x + 3.5, 0, base="#2c2c33"), stroke=IRON_D, stroke_width="0.9"))
        s.add(rivets([(x, 12.5 + k * sh) for k in range(n)], 1.1))
    # scroll ends
    for x, cw in ((7, False), (193, True)):
        s.add(iron_curve(scroll(x, 25, 7, 1.3, math.pi if cw else 0, cw=cw), 2.2))
    s.add(path("M8 7.5H192", stroke=IRON_L, stroke_opacity="0.4", stroke_width="0.8"))
    return s.render()


@asset("h-throne", "furniture", [1.5, 1.5], "Infernal throne", "Piekielny tron",
       tags=["throne", "seat", "king", "demon", "skull", "horns", "tron", "król", "demon", "czaszka", "rogi"])
def throne(seed):
    s = Svg(150, 150, seed)
    rng = s.rng
    s.add(glow(s, 75, 40, 70, LAVA_R, 0.28, LAVA_O))
    # dais step
    dais = rect_d(10, 34, 130, 112, 5)
    s.add(shadow(dais, 6, 8, 0.5))
    s.add(path(dais, fill=s.lg([(0, "#2b2430"), (1, OBS_D)], 0, 0, 1, 1), stroke=OBS_D, stroke_width="1.4"))
    s.add(bevel(dais, light=OBS_L, lo=0.4, do=0.4, w=1.6))
    s.add(path("M14 138H136", stroke=LAVA_O, stroke_opacity="0.55", stroke_width="1.4"))
    s.add(path("M14 138H136", stroke=LAVA_Y, stroke_width="0.5"))
    # seat block
    seat = rect_d(32, 50, 86, 78, 6)
    s.add(shadow(seat, 4, 5, 0.5))
    s.add(path(seat, fill=IRON, stroke=IRON_D, stroke_width="1.4"))
    s.add(velvet(s, rect_d(44, 58, 62, 66, 7), 44, 58, 106, 124, buttons=[(58, 74), (92, 74), (75, 90), (58, 106), (92, 106)]))
    # armrests ending in skulls
    for x in (37, 113):
        s.add(path(rect_d(x - 7, 52, 14, 66, 4), fill=iron_grad(s, x - 7, 0, x + 7, 0), stroke=IRON_D, stroke_width="1.2"))
        s.add(path(f"M{x - 4} 115V56", stroke=IRON_L, stroke_opacity="0.35", stroke_width="0.8"))
        s.add(skull(s, x, 122, 7.2, glow_eyes=LAVA_O))
    # back: obsidian slab with a fan of spikes and horns
    back = smooth([(14, 50), (22, 30), (45, 18), (75, 13), (105, 18), (128, 30), (136, 50), (110, 56), (75, 58), (40, 56)])
    s.add(shadow(back, 4, 7, 0.55))
    for i in range(11):
        a = math.pi + (i + 0.5) * math.pi / 11
        L = 22 + (10 if i % 2 == 0 else 0) + (6 if i == 5 else 0)
        s.add(spike_side(75 + math.cos(a) * 40, 54 + math.sin(a) * 30, L, 7, a, base="#2a2530"))
    s.add(path(back, fill=s.lg([(0, "#3e3446"), (0.5, OBS), (1, OBS_D)], 0, 0, 1, 1), stroke=OBS_D, stroke_width="1.4"))
    s.add(bevel(back, light=OBS_L, lo=0.5, do=0.4, w=1.4))
    # carved rib lines + lava seam
    ribs = "".join(f"M75 52L{f(75 + math.cos(math.pi + k * math.pi / 6) * 52)} {f(52 + math.sin(math.pi + k * math.pi / 6) * 34)}" for k in range(1, 6))
    s.add(path(ribs, stroke="#000", stroke_opacity="0.5", stroke_width="1"))
    s.add(path(ribs, stroke=OBS_L, stroke_opacity="0.25", stroke_width="0.5", transform="translate(-0.6 -0.6)"))
    s.add(path("M24 48Q75 60 126 48", fill="none", stroke=LAVA_O, stroke_width="2.2", stroke_opacity="0.5"))
    s.add(path("M24 48Q75 60 126 48", fill="none", stroke=LAVA_Y, stroke_width="0.8"))
    # horns curling out of the top corners
    for sx in (-1, 1):
        hx = 75 + sx * 44
        horn = smooth([(hx, 30), (hx + sx * 14, 22), (hx + sx * 22, 10), (hx + sx * 16, 2.5), (hx + sx * 18, 9),
                       (hx + sx * 12, 18), (hx - sx * 2, 24)])
        s.add(path(horn, fill="#000", fill_opacity="0.35", transform="translate(2 3)"))
        s.add(path(horn, fill=s.lg([(0, "#efe2c6"), (0.5, "#b8a582"), (1, "#3a2c20")], 0 if sx < 0 else 1, 0, 1 if sx < 0 else 0, 1),
                   stroke="#2a1e14", stroke_width="0.9"))
        rings = "".join(f"M{f(hx + sx * (4 + k * 4))} {f(27 - k * 4.2)}l{f(sx * 3)} {f(4)}" for k in range(4))
        s.add(path(rings, stroke="#3a2c20", stroke_opacity="0.6", stroke_width="0.6"))
    # crowning skull
    s.add(skull(s, 75, 31, 10, glow_eyes=LAVA_Y))
    s.add(embers(s, 10, 0, 130, 60, 18, rng, 0.8))
    return s.render()


# ============================================================== tables


@asset("h-desk-iron", "furniture", [2, 1], "Iron desk", "Żelazne biurko",
       tags=["desk", "grimoire", "book", "quill", "candle", "iron", "biurko", "księga", "pióro", "świeca"])
def desk_iron(seed):
    s = Svg(200, 100, seed)
    rng = s.rng
    s.add(legs([(10, 10), (190, 10), (10, 90), (190, 90)], 4))
    top = rect_d(5, 6, 190, 86, 3)
    s.add(shadow(top, 5, 6, 0.5))
    s.add(iron_plate(s, top, 5, 6, 195, 92, rv=edge_rivets(5, 6, 190, 86, 4, 14), rust=6, scratches=16))
    # inset etched panel border
    s.add(path(rect_d(13, 14, 174, 70, 2), fill="none", stroke="#000", stroke_opacity="0.45", stroke_width="1.2"))
    s.add(path(rect_d(13.8, 14.8, 174, 70, 2), fill="none", stroke=IRON_L, stroke_opacity="0.2", stroke_width="0.6"))
    # spiked corners
    for x, y in ((5, 6), (195, 6), (5, 92), (195, 92)):
        s.add(spike(x, y, 4))
    s.add(papers(s, 150, 58, 30, 38, 3, rng))
    s.add(grimoire(s, 92, 52, 64, 44, -4))
    # inkpot (black glass skull-ish pot) + quill
    s.add(shadow(circle_d(160, 24, 6), 1.2, 1.6, 0.45, soft=2))
    s.add(circle(160, 24, 6, fill=s.rg([(0, "#7a2a3a"), (1, "#120508")], cx=0.35, cy=0.35), stroke="#000", stroke_width="0.7"))
    s.add(circle(160, 24, 2.8, fill="#3a0008"))
    s.add(quill(s, 160, 24, 34, 160))
    s.add(red_candle(s, 30, 28, 5))
    s.add(red_candle(s, 22, 70, 3.8, halo=False))
    # skull paperweight + a few bone dice
    s.add(skull(s, 44, 74, 7))
    s.add(path("M128 80l4 -2 2 4 -4 2Z", fill=BONE, stroke=BONE_D, stroke_width="0.4"))
    s.add(circle(131, 80, 0.5, fill="#222"))
    # wax drips
    for _ in range(6):
        s.add(ellipse(30 + rng.uniform(-12, 12), 28 + rng.uniform(-10, 12), 1.4, 1, fill=WAX, fill_opacity="0.85"))
    return s.render()


@asset("h-table-iron", "furniture", [2, 1.2], "Iron table", "Żelazny stół",
       tags=["table", "iron", "feast", "goblet", "candle", "chain", "stół", "żelazo", "puchar", "uczta"])
def table_iron(seed):
    s = Svg(200, 120, seed)
    rng = s.rng
    s.add(legs([(12, 12), (188, 12), (12, 108), (188, 108)], 4.5))
    top = rect_d(5, 8, 190, 104, 4)
    s.add(shadow(top, 6, 7, 0.5))
    s.add(iron_plate(s, top, 5, 8, 195, 112, rv=edge_rivets(5, 8, 190, 104, 4, 15), rust=7, scratches=18))
    # blood-red runner along the middle
    run = rect_d(5, 44, 190, 32)
    s.add(path(run, fill="#000", fill_opacity="0.3", transform="translate(1 1.5)"))
    s.add(path(run, fill=s.lg([(0, shade(BLOOD, 0.1)), (0.5, BLOOD), (1, shade(BLOOD, -0.12))], 0, 0, 0, 1), stroke="#2a0406", stroke_width="0.8"))
    s.add(path("M5 47H195M5 73H195", stroke=GOLD, stroke_width="1", stroke_opacity="0.8"))
    fr = "".join(f"M{f(x)} 76v3M{f(x)} 44v-3" for x in range(8, 195, 4))
    s.add(path(fr, stroke=GOLD, stroke_opacity="0.6", stroke_width="0.6"))
    # chains draped over the long edges
    s.add(chain([(8, 112), (40, 117), (75, 112), (110, 117), (145, 112), (192, 116)], link=4, w=1.2))
    s.add(chain([(8, 9), (55, 4), (100, 8), (150, 4), (192, 8)], link=4, w=1.2))
    for x, y in ((5, 8), (195, 8), (5, 112), (195, 112)):
        s.add(spike(x, y, 4.6))
    # centrepiece: skull on a platter with candles
    s.add(ellipse(100, 60, 18, 12, fill="#000", fill_opacity="0.35", transform="translate(1.5 2)"))
    s.add(ellipse(100, 60, 18, 12, fill=s.rg([(0, "#8a8c96"), (1, "#2a2a30")], cx=0.4, cy=0.35), stroke=IRON_D, stroke_width="0.9"))
    s.add(skull(s, 100, 59, 8.5, glow_eyes=LAVA_O))
    s.add(red_candle(s, 64, 60, 4.6), red_candle(s, 136, 60, 4.6))
    # place settings
    for x, y, flip in ((40, 26, 1), (100, 24, 1), (160, 26, 1), (40, 94, -1), (100, 96, -1), (160, 94, -1)):
        s.add(ellipse(x, y, 10, 7.5, fill="#000", fill_opacity="0.3", transform="translate(1 1.4)"))
        s.add(ellipse(x, y, 10, 7.5, fill=s.rg([(0, "#9a9ca6"), (1, "#3a3a42")], cx=0.4, cy=0.35), stroke=IRON_D, stroke_width="0.6"))
        s.add(ellipse(x, y, 6.5, 4.8, fill="#4a1a12"))
        # something dark and meaty
        s.add(path(blob(x, y, 4.5, 3.2, 7, 0.3, rng), fill="#6a2416"))
        s.add(ellipse(x - 1.4, y - 1, 1.6, 0.9, fill="#fff", fill_opacity="0.2"))
        s.add(bone(x + 3, y + 0.5, 8, 1.5, rng.uniform(-40, 40)))
        s.add(goblet(s, x + 15, y - flip * 2, 3.6))
    s.add(embers(s, 60, 50, 80, 20, 8, rng, 0.6))
    return s.render()


# ============================================================== lighting


@asset("h-chandelier", "furniture", [2, 2], "Iron spike chandelier", "Żyrandol z kolcami",
       tags=["light", "chandelier", "candles", "iron", "spikes", "żyrandol", "świece", "kolce"])
def chandelier(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    cx = cy = 99
    s.add(circle(cx, cy, 99, fill=s.rg([(0, "#ff9a3a", 0.32), (0.55, "#ff6a1a", 0.14), (1, "#ff4a00", 0)])))
    s.add(shadow(circle_d(cx, cy, 72), 8, 10, 0.25, soft=3))
    # outward spikes on the outer ring
    for i in range(24):
        a = 2 * math.pi * (i + 0.5) / 24
        L = 13 if i % 2 else 9
        s.add(spike_side(cx + math.cos(a) * 74, cy + math.sin(a) * 74, L, 4.4, a))
    # spokes
    for i in range(6):
        a = 2 * math.pi * i / 6 + math.pi / 6
        s.add(iron_bar(cx + math.cos(a) * 14, cy + math.sin(a) * 14, cx + math.cos(a) * 68, cy + math.sin(a) * 68, 3.6))
    # twisted scrolls between rings
    for i in range(6):
        a = 2 * math.pi * i / 6
        px, py = cx + math.cos(a) * 52, cy + math.sin(a) * 52
        s.add(iron_curve(scroll(px, py, 6, 1.2, a + math.pi), 1.4))
    # outer + inner rings
    for r, w in ((72, 7), (36, 4.5)):
        s.add(path(circle_d(cx, cy, r), fill="none", stroke=IRON_D, stroke_width=f2(w + 2)))
        s.add(path(circle_d(cx, cy, r), fill="none", stroke=s.lg([(0, "#6e707a"), (0.5, IRON), (1, "#1a1a1f")], 0, 0, 1, 1), stroke_width=f2(w)))
        s.add(circle(cx, cy, r, fill="none", stroke=IRON_L, stroke_width="0.8", stroke_opacity="0.6", stroke_dasharray=f"{r * 0.9} {r * 0.6} {r * 1.2} {r * 9}",
                     transform=f"rotate(170 {cx} {cy})"))
    s.add(rivets([(cx + math.cos(2 * math.pi * k / 12) * 72, cy + math.sin(2 * math.pi * k / 12) * 72) for k in range(12)], 1.4))
    # chains up to the hook
    s.add(chain([(cx, cy), (cx + 50, cy - 50)], 4.4, 1.3), chain([(cx, cy), (cx - 50, cy - 50)], 4.4, 1.3),
          chain([(cx, cy), (cx + 50, cy + 50)], 4.4, 1.3), chain([(cx, cy), (cx - 50, cy + 50)], 4.4, 1.3))
    s.add(circle(cx, cy, 9, fill=s.rg([(0, "#6e707a"), (1, IRON_D)], cx=0.35, cy=0.35), stroke=IRON_D, stroke_width="1"))
    s.add(spike(cx, cy, 5.5))
    # red candles: 12 on the outer ring, 6 on the inner
    for i in range(12):
        a = 2 * math.pi * i / 12 + math.pi / 12
        s.add(red_candle(s, cx + math.cos(a) * 72, cy + math.sin(a) * 72, 3.9, halo=(i % 2 == 0)))
    for i in range(6):
        a = 2 * math.pi * i / 6
        s.add(red_candle(s, cx + math.cos(a) * 36, cy + math.sin(a) * 36, 3.3, halo=False))
    for _ in range(18):
        a = rng.uniform(0, 6.28)
        rr = rng.choice([72, 36])
        s.add(ellipse(cx + math.cos(a) * rr, cy + math.sin(a) * rr + 2, 1.4, 1.9, fill=WAX, fill_opacity="0.9"))
    return s.render()


@asset("h-chandelier-skull", "furniture", [1.5, 1.5], "Skull chandelier", "Żyrandol z czaszek",
       tags=["light", "chandelier", "skull", "bones", "candles", "żyrandol", "czaszki", "kości", "świece"])
def chandelier_skull(seed):
    s = Svg(150, 150, seed)
    rng = s.rng
    cx = cy = 75
    s.add(circle(cx, cy, 75, fill=s.rg([(0, "#ff9a3a", 0.3), (0.55, "#ff6a1a", 0.12), (1, "#ff4a00", 0)])))
    s.add(shadow(circle_d(cx, cy, 50), 6, 8, 0.25, soft=3))
    # ring of bones
    n = 8
    for i in range(n):
        a0 = 2 * math.pi * i / n
        a1 = 2 * math.pi * (i + 1) / n
        am = (a0 + a1) / 2
        L = 2 * 50 * math.sin(math.pi / n) * 0.82
        s.add(bone(cx + math.cos(am) * 48, cy + math.sin(am) * 48, L, 3.8, math.degrees(am) + 90))
    # inner iron hoop + chains
    s.add(path(circle_d(cx, cy, 24), fill="none", stroke=IRON_D, stroke_width="5"))
    s.add(path(circle_d(cx, cy, 24), fill="none", stroke=IRON, stroke_width="3.4"))
    for i in range(4):
        a = 2 * math.pi * i / 4 + math.pi / 4
        s.add(chain([(cx, cy), (cx + math.cos(a) * 48, cy + math.sin(a) * 48)], 3.6, 1.1))
    s.add(circle(cx, cy, 6.5, fill=IRON, stroke=IRON_D, stroke_width="1"), spike(cx, cy, 4))
    # skulls facing outward, each crowned with a candle
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = cx + math.cos(a) * 52, cy + math.sin(a) * 52
        s.add(skull(s, x, y, 9.5, ang=math.degrees(a) - 90))
        s.add(red_candle(s, x - math.cos(a) * 8.5, y - math.sin(a) * 8.5, 3.0, holder=False, halo=(i % 2 == 0)))
    # small skulls on the inner hoop
    for i in range(4):
        a = 2 * math.pi * i / 4
        s.add(skull(s, cx + math.cos(a) * 24, cy + math.sin(a) * 24, 5, ang=math.degrees(a) - 90))
    return s.render()


@asset("h-candelabra", "furniture", [0.6, 0.6], "Iron candelabra", "Żelazny kandelabr",
       tags=["light", "candles", "candelabra", "iron", "kandelabr", "świecznik", "świece"])
def candelabra(seed):
    s = Svg(60, 60, seed)
    cx = cy = 30
    s.add(glow(s, cx, cy, 30, LAVA_O, 0.4, LAVA_Y))
    # tripod claw feet under everything
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        s.add(spike_side(cx, cy, 13, 4, a))
    arms = []
    for k in range(4):
        a = 2 * math.pi * k / 4 + math.pi / 4
        x, y = cx + math.cos(a) * 18, cy + math.sin(a) * 18
        mx, my = cx + math.cos(a + 0.5) * 11, cy + math.sin(a + 0.5) * 11
        arms.append((f"M{f(cx)} {f(cy)}Q{f(mx)} {f(my)} {f(x)} {f(y)}", x, y))
    for d, _, _ in arms:
        s.add(path(d, fill="none", stroke="#000", stroke_opacity="0.35", stroke_width="3", transform="translate(1 1.5)"))
    for d, _, _ in arms:
        s.add(iron_curve(d, 1.7))
    s.add(circle(cx, cy, 5.5, fill=s.rg([(0, "#6e707a"), (1, IRON_D)], cx=0.35, cy=0.35), stroke=IRON_D, stroke_width="0.7"))
    for _, x, y in arms:
        s.add(red_candle(s, x, y, 3.0, halo=False))
    s.add(red_candle(s, cx, cy, 3.4, holder=False, halo=False))
    return s.render()


@asset("h-brazier", "furniture", [1, 1], "Iron brazier", "Żelazny kosz ogniowy",
       tags=["fire", "brazier", "light", "coals", "iron", "ogień", "kosz", "żar", "światło"])
def brazier(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 50, 52
    s.add(glow(s, cx, cy, 50, LAVA_O, 0.55, LAVA_Y))
    for k in range(3):
        s.add(claw_foot(cx + math.cos(2 * math.pi * k / 3 + math.pi / 2) * 32, cy + math.sin(2 * math.pi * k / 3 + math.pi / 2) * 32,
                        10, 2 * math.pi * k / 3 + math.pi / 2))
    bowl = circle_d(cx, cy, 34)
    s.add(shadow(bowl, 4, 5, 0.45))
    s.add(path(bowl, fill=s.rg([(0, "#55565e"), (0.7, IRON), (1, IRON_D)], cx=0.35, cy=0.3), stroke=IRON_D, stroke_width="1.6"))
    # rim spikes + rivets
    for i in range(12):
        a = 2 * math.pi * (i + 0.5) / 12
        s.add(spike_side(cx + math.cos(a) * 33, cy + math.sin(a) * 33, 9, 4.2, a))
    s.add(path(bowl, fill="none", stroke=IRON_L, stroke_width="1", stroke_opacity="0.4", stroke_dasharray="40 30 50 200", transform="translate(-0.5 -0.5)"))
    s.add(rivets([(cx + math.cos(2 * math.pi * k / 12) * 30.5, cy + math.sin(2 * math.pi * k / 12) * 30.5) for k in range(12)], 1.2))
    # coal bed
    bed = circle_d(cx, cy, 27)
    s.add(path(bed, fill=s.rg([(0, LAVA_Y), (0.4, LAVA_O), (0.8, LAVA_R), (1, LAVA_D)])))
    cl = s.clip(bed)
    coals = []
    for _ in range(26):
        a = rng.uniform(0, 6.28)
        d = 27 * math.sqrt(rng.random())
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        r = rng.uniform(3.2, 6)
        coals.append((x, y, r, blob(x, y, r, r * rng.uniform(0.7, 1), 6, 0.3, rng, rot=rng.uniform(0, 6))))
    s.add(g([path("".join(c[3] for c in coals), fill="#1a0c08", stroke=LAVA_O, stroke_width="0.9", stroke_opacity="0.9"),
             path("".join(circle_d(x - r * 0.25, y - r * 0.25, r * 0.4) for x, y, r, _ in coals), fill=LAVA_R, fill_opacity="0.6")],
            clip_path=cl))
    s.add(fire(s, cx, cy - 2, 13, rng))
    s.add(embers(s, 15, 5, 70, 60, 24, rng, 0.9))
    return s.render()


# ============================================================== storage & misc


@asset("h-cage", "furniture", [1, 1], "Iron cage", "Żelazna klatka",
       tags=["cage", "prison", "iron", "hanging", "bones", "klatka", "więzienie", "żelazo", "kości"])
def cage(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy, R = 50, 54, 40
    s.add(shadow(circle_d(cx, cy, R), 6, 8, 0.4, soft=3))
    # floor of the cage (seen through the bars) with bones
    s.add(circle(cx, cy, R - 1, fill=s.rg([(0, "#2a2226"), (1, "#0e0b0d")])))
    cl = s.clip(circle_d(cx, cy, R - 2))
    s.add(g([bone(cx - 10, cy + 14, 26, 4, 25), bone(cx + 14, cy + 6, 22, 3.6, -50), bone(cx - 6, cy - 16, 18, 3.2, 80),
             skull(s, cx + 8, cy + 22, 7, ang=30), skull(s, cx - 18, cy - 4, 6, ang=-60)], clip_path=cl))
    # bars: radial from the dome top (centre), drawn as tapered spokes
    for i in range(16):
        a = 2 * math.pi * i / 16
        s.add(iron_bar(cx + math.cos(a) * 9, cy + math.sin(a) * 9, cx + math.cos(a) * R, cy + math.sin(a) * R, 2.2))
    for r, w in ((R, 4.5), (26, 2.8)):
        s.add(path(circle_d(cx, cy, r), fill="none", stroke=IRON_D, stroke_width=f2(w + 1.4)))
        s.add(path(circle_d(cx, cy, r), fill="none", stroke=s.lg([(0, "#6e707a"), (0.5, IRON), (1, "#1a1a1f")], 0, 0, 1, 1), stroke_width=f2(w)))
    s.add(rivets([(cx + math.cos(2 * math.pi * k / 16) * R, cy + math.sin(2 * math.pi * k / 16) * R) for k in range(16)], 1.2))
    # bottom spikes poking out
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        s.add(spike_side(cx + math.cos(a) * (R + 1), cy + math.sin(a) * (R + 1), 7, 3.4, a))
    # hook + chain running off the top edge
    s.add(chain([(cx, cy), (cx + 2, 20), (cx - 1, 0)], 4.6, 1.4))
    s.add(circle(cx, cy, 8, fill=s.rg([(0, "#6e707a"), (1, IRON_D)], cx=0.35, cy=0.35), stroke=IRON_D, stroke_width="1"))
    s.add(circle(cx, cy, 3.2, fill="none", stroke=IRON_L, stroke_width="1.2"))
    return s.render()


@asset("h-chest-iron", "furniture", [1, 0.7], "Iron-bound chest", "Okuty kufer",
       tags=["chest", "treasure", "loot", "iron", "skull", "kufer", "skrzynia", "skarb"])
def chest_iron(seed):
    s = Svg(100, 70, seed)
    rng = s.rng
    box = rect_d(6, 6, 88, 56, 3)
    s.add(shadow(box, 4, 5, 0.5))
    s.add(path(box, fill="#2a1612", stroke=INK, stroke_width="1.4"))
    s.add(g(planks(s, 6, 6, 88, 56, 4, "#4a2a1e", horizontal=True, nails=False, joints=False, tone=0.05), clip_path=s.clip(box)))
    s.add(rect(6, 6, 88, 56, fill=s.lg([(0, "#000", 0), (1, "#000", 0.35)])))
    # lid seam (top-down: lid is the whole top; a ridge across the middle)
    s.add(path("M6 32H94", stroke="#000", stroke_opacity="0.4", stroke_width="1.6"))
    # heavy iron bands
    for x in (18, 50, 82):
        s.add(rect(x - 5, 5, 10, 58, rx=1, fill=iron_grad(s, x - 5, 0, x + 5, 0), stroke=IRON_D, stroke_width="0.9"))
        s.add(rivets([(x, 10), (x, 22), (x, 42), (x, 57)], 1.1))
    # corner caps with spikes
    for x, y in ((6, 6), (94, 6), (6, 62), (94, 62)):
        s.add(path(rect_d(x - 6, y - 6, 12, 12, 1.5), fill=IRON, stroke=IRON_D, stroke_width="0.8"))
        s.add(spike(x, y, 4))
    # skull lock plate on the front edge
    s.add(path(rect_d(41, 52, 18, 14, 2), fill=iron_grad(s, 41, 52, 59, 66), stroke=IRON_D, stroke_width="0.8"))
    s.add(skull(s, 50, 58, 5.2, color="#c9b98f"))
    s.add(embers(s, 10, 10, 80, 50, 0, rng))
    return s.render()


def jagged_sword(s, x, y, L, ang):
    """Sword lying flat, pommel at (x, y)."""
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    bx = x + L * 0.28
    w = 4.5
    teeth = [(bx, y - w)]
    k = 0
    xx = bx
    while xx < x + L - 10:
        xx += 6
        teeth.append((xx, y - w - (2 if k % 2 else 0)))
        k += 1
    blade = teeth + [(x + L, y)] + [(px, y + (w if i % 2 == 0 else w + 1.6)) for i, (px, _) in enumerate(reversed(teeth))]
    return g([
        path(P(blade), fill="#000", fill_opacity="0.35", transform="translate(1.5 2)"),
        path(P(blade), fill=s.lg([(0, "#c8ccd6"), (0.5, "#6e727e"), (1, "#2a2c34")], 0, 0, 0, 1), stroke="#141418", stroke_width="0.6"),
        path(f"M{f(bx)} {f(y)}H{f(x + L - 4)}", stroke=LAVA_R, stroke_width="1", stroke_opacity="0.8"),
        rect(bx - 3, y - 11, 4, 22, rx=1, fill=IRON, stroke=IRON_D, stroke_width="0.6"),
        spike_side(bx - 1, y - 11, 5, 3, -math.pi / 2), spike_side(bx - 1, y + 11, 5, 3, math.pi / 2),
        rect(x + 4, y - 2.2, bx - x - 7, 4.4, fill="#3a1a14", stroke="#000", stroke_width="0.5"),
        path("".join(f"M{f(x + 6 + i * 3)} {f(y - 2)}l2 4" for i in range(int((bx - x - 10) / 3))), stroke="#000", stroke_opacity="0.6",
             stroke_width="0.6"),
        circle(x + 3, y, 3.4, fill=IRON, stroke=IRON_D, stroke_width="0.6"), circle(x + 3, y, 1.3, fill="#c0102a"),
    ], transform=tf)


def trident(s, x, y, L, ang):
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    hx = x + L - 22
    prongs = []
    for dy, l in ((-8, 18), (0, 22), (8, 18)):
        prongs.append(P([(hx + 4, y + dy - 1.5), (hx + l, y + dy), (hx + 4, y + dy + 1.5)]))
        prongs.append(P([(hx + l - 6, y + dy + (2 if dy <= 0 else -2) * 0), (hx + l - 9, y + dy - 2.5 * (1 if dy <= 0 else 1)),
                         (hx + l - 4, y + dy)]))
    return g([
        line(x, y + 1.6, hx, y + 1.6, stroke="#000", stroke_opacity="0.35", stroke_width="3.6", transform="translate(1 1)"),
        line(x, y, hx + 2, y, stroke="#140a08", stroke_width="4.4", stroke_linecap="round"),
        line(x, y, hx + 2, y, stroke="#5a3424", stroke_width="3", stroke_linecap="round"),
        line(x, y - 0.7, hx + 2, y - 0.7, stroke="#b08060", stroke_width="0.8", stroke_opacity="0.6"),
        path("".join(f"M{f(x + 8 + i * 9)} {f(y - 1.6)}l3 3.2" for i in range(int((hx - x - 12) / 9))), stroke="#140a08", stroke_width="0.7"),
        path(f"M{f(hx)} {f(y - 9.5)}Q{f(hx + 6)} {f(y)} {f(hx)} {f(y + 9.5)}", fill="none", stroke=IRON_D, stroke_width="3.4"),
        path(f"M{f(hx)} {f(y - 9.5)}Q{f(hx + 6)} {f(y)} {f(hx)} {f(y + 9.5)}", fill="none", stroke=IRON, stroke_width="2.2"),
        path("".join(prongs), fill="#000", fill_opacity="0.35", transform="translate(1 1.4)"),
        path("".join(prongs), fill="#8a8e9a", stroke=IRON_D, stroke_width="0.6", stroke_linejoin="round"),
        line(hx + 4, y - 0.5, hx + 20, y - 0.5, stroke=IRON_L, stroke_width="0.5", stroke_opacity="0.7"),
    ], transform=tf)


def axe(s, x, y, L, ang):
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    hx = x + L - 10
    head = smooth([(hx - 6, y - 3), (hx - 10, y - 14), (hx - 2, y - 20), (hx + 8, y - 16), (hx + 6, y - 4), (hx + 6, y + 4), (hx + 10, y + 12),
                   (hx + 2, y + 17), (hx - 8, y + 13), (hx - 6, y + 3)])
    return g([
        line(x, y, hx + 6, y, stroke="#000", stroke_opacity="0.35", stroke_width="3.6", transform="translate(1.5 1.8)"),
        line(x, y, hx + 6, y, stroke="#3a2016", stroke_width="3.4", stroke_linecap="round"),
        path(head, fill="#000", fill_opacity="0.35", transform="translate(1.5 2)"),
        path(head, fill=s.lg([(0, "#9a9ea8"), (0.6, IRON), (1, IRON_D)], 0, 0, 1, 1), stroke=IRON_D, stroke_width="0.8"),
        path(smooth([(hx - 10, y - 14), (hx - 2, y - 20), (hx + 8, y - 16)], close=False), fill="none", stroke="#e0e4ec",
             stroke_width="0.8", stroke_opacity="0.8"),
        rivets([(hx, y)], 1.4), spike_side(hx + 6, y, 8, 3.4, 0),
    ], transform=tf)


@asset("h-weapon-rack", "furniture", [2, 0.5], "Weapon rack", "Stojak na broń",
       tags=["weapons", "rack", "sword", "trident", "axe", "armory", "broń", "stojak", "miecz", "trójząb", "topór", "zbrojownia"])
def weapon_rack(seed):
    s = Svg(200, 50, seed)
    frame = rect_d(4, 4, 192, 42, 2)
    s.add(shadow(frame, 3, 4, 0.45))
    s.add(path(frame, fill="#17171b", stroke=IRON_D, stroke_width="1.2"))
    for y in (11, 39):
        s.add(iron_bar(6, y, 194, y, 4))
    for x in (8, 66, 134, 192):
        s.add(rect(x - 3.5, 5, 7, 40, rx=1, fill=iron_grad(s, x - 3.5, 0, x + 3.5, 0), stroke=IRON_D, stroke_width="0.8"))
        s.add(rivets([(x, 11), (x, 39)], 1.1))
    s.add(trident(s, 192, 34, 182, 180))
    s.add(jagged_sword(s, 36, 16, 106, 0))
    s.add(axe(s, 146, 21, 48, 0))
    for x in (8, 192):
        s.add(spike(x, 4, 3.4), spike(x, 46, 3.4))
    return s.render()


@asset("h-anvil", "furniture", [1, 0.7], "Hellforge anvil", "Piekielne kowadło",
       tags=["anvil", "forge", "smith", "blacksmith", "hammer", "kowadło", "kuźnia", "kowal", "młot"])
def anvil(seed):
    s = Svg(100, 70, seed)
    rng = s.rng
    # stump/base under the anvil
    base = rect_d(26, 14, 46, 42, 4)
    s.add(shadow(base, 4, 5, 0.5))
    s.add(path(base, fill="#1a1416", stroke="#000", stroke_width="1"))
    s.add(rivets([(30, 18), (68, 18), (30, 52), (68, 52)], 1.2))
    # anvil body: horn to the left, heel to the right
    body = smooth([(4, 35), (16, 29), (30, 25), (80, 23), (94, 25), (94, 45), (80, 47), (30, 45), (16, 41)], t=0.5)
    s.add(shadow(body, 3, 4, 0.5))
    s.add(path(body, fill=s.lg([(0, "#8a8c96"), (0.35, "#4a4a52"), (1, "#16161a")], 0, 0, 0, 1), stroke=IRON_D, stroke_width="1.2"))
    face = rect_d(34, 27, 54, 16, 1.5)
    s.add(path(face, fill=s.lg([(0, "#b8bcc6"), (1, "#5a5c66")], 0, 0, 0, 1), stroke="#2a2a30", stroke_width="0.6"))
    s.add(rect(80, 31, 3.5, 3.5, fill="#0e0e12"), circle(74, 33, 1.4, fill="#0e0e12"))
    s.add(path("M8 34Q20 30 34 28", fill="none", stroke="#e0e4ec", stroke_opacity="0.4", stroke_width="0.9"))
    # glowing blade being forged
    blade = P([(28, 36), (64, 33.5), (72, 35), (64, 37), (28, 38)])
    s.add(glow(s, 52, 35, 22, LAVA_O, 0.55, LAVA_Y))
    s.add(path(blade, fill=s.lg([(0, LAVA_R), (0.5, LAVA_Y), (1, LAVA_CORE)], 0, 0, 1, 0), stroke=LAVA_D, stroke_width="0.5"))
    s.add(rect(18, 34.5, 11, 4, rx=1, fill="#2a1a14"))
    # tongs
    s.add(path("M20 36L6 52M20 37L10 55", fill="none", stroke=IRON_D, stroke_width="2.4", stroke_linecap="round"))
    s.add(path("M20 36L6 52M20 37L10 55", fill="none", stroke=IRON, stroke_width="1.4", stroke_linecap="round"))
    # hammer lying beside
    s.add(g([line(60, 62, 92, 58, stroke="#000", stroke_opacity="0.35", stroke_width="3.4", transform="translate(1 1.5)"),
             line(60, 62, 92, 58, stroke="#3a2016", stroke_width="3", stroke_linecap="round"),
             rect(54, 54, 10, 15, rx=1.5, fill=s.lg([(0, "#9a9ea8"), (1, IRON_D)], 0, 0, 1, 1), stroke=IRON_D, stroke_width="0.7",
                  transform="rotate(-8 59 61)")]))
    s.add(embers(s, 30, 15, 50, 40, 22, rng, 0.8))
    return s.render()


@asset("h-lectern", "furniture", [1, 1], "Grimoire lectern", "Pulpit z księgą",
       tags=["lectern", "book", "grimoire", "spell", "magic", "pulpit", "księga", "grimuar", "magia"])
def lectern(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    # tripod claw feet
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        s.add(claw_foot(50 + math.cos(a) * 30, 54 + math.sin(a) * 30, 9, a))
    s.add(iron_bar(50, 54, 50 + math.cos(math.pi / 2) * 28, 54 + 28, 3.4))
    s.add(iron_bar(50, 54, 50 + math.cos(math.pi / 2 + 2.09) * 28, 54 + math.sin(math.pi / 2 + 2.09) * 28, 3.4))
    s.add(iron_bar(50, 54, 50 + math.cos(math.pi / 2 + 4.19) * 28, 54 + math.sin(math.pi / 2 + 4.19) * 28, 3.4))
    # slanted reading board
    board = P([(12, 22), (88, 22), (92, 78), (8, 78)])
    s.add(shadow(board, 5, 6, 0.5))
    s.add(iron_plate(s, board, 8, 22, 92, 78, rv=[(14, 26), (86, 26), (11, 74), (89, 74)], rust=3, scratches=6))
    s.add(path("M8 78H92", stroke=IRON_D, stroke_width="3"))
    s.add(path("M8 77H92", stroke=IRON_L, stroke_width="0.8", stroke_opacity="0.5"))
    for x in (8, 92):
        s.add(spike(x, 78, 3.6))
    s.add(grimoire(s, 50, 49, 68, 44, 0))
    s.add(red_candle(s, 88, 14, 4.2))
    s.add(embers(s, 20, 20, 60, 50, 10, rng, 0.6))
    return s.render()


@asset("h-cauldron", "furniture", [1, 1], "Hellfire cauldron", "Piekielny kocioł",
       tags=["cauldron", "potion", "brew", "fire", "witch", "kocioł", "wywar", "eliksir", "ogień"])
def cauldron(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 50, 51
    s.add(glow(s, cx, cy, 50, LAVA_O, 0.5, LAVA_Y))
    # flames licking out from under the pot
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.2
        s.add(fire(s, cx + math.cos(a) * 37, cy + math.sin(a) * 37, 5.2 + rng.uniform(0, 1.6), rng))
    # three stubby legs
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 6
        s.add(circle(cx + math.cos(a) * 36, cy + math.sin(a) * 36, 4, fill=IRON, stroke=IRON_D, stroke_width="0.9"))
    pot = circle_d(cx, cy, 36)
    s.add(shadow(pot, 3, 4, 0.45))
    s.add(path(pot, fill=s.rg([(0, "#55565e"), (0.75, "#2a2a30"), (1, "#0e0e12")], cx=0.35, cy=0.3), stroke=IRON_D, stroke_width="1.6"))
    # rim
    s.add(path(circle_d(cx, cy, 31), fill="none", stroke=IRON_D, stroke_width="5"))
    s.add(path(circle_d(cx, cy, 31), fill="none", stroke=s.lg([(0, "#9a9ca6"), (0.5, IRON), (1, "#16161a")], 0, 0, 1, 1), stroke_width="3.4"))
    s.add(rivets([(cx + math.cos(2 * math.pi * k / 10) * 34, cy + math.sin(2 * math.pi * k / 10) * 34) for k in range(10)], 1.1))
    # handles
    for sx in (-1, 1):
        s.add(path(f"M{f(cx + sx * 34)} {f(cy - 8)}Q{f(cx + sx * 46)} {f(cy)} {f(cx + sx * 34)} {f(cy + 8)}", fill="none", stroke=IRON_D,
                   stroke_width="3.6"))
        s.add(path(f"M{f(cx + sx * 34)} {f(cy - 8)}Q{f(cx + sx * 46)} {f(cy)} {f(cx + sx * 34)} {f(cy + 8)}", fill="none", stroke=IRON,
                   stroke_width="2.2"))
    # bubbling green brew
    brew = circle_d(cx, cy, 28.5)
    s.add(path(brew, fill=s.rg([(0, "#d8ff7a"), (0.4, "#6fd23a"), (0.85, "#2a7a1e"), (1, "#0e3a0c")], cx=0.45, cy=0.45)))
    cl = s.clip(brew)
    bub = []
    hl = []
    for _ in range(18):
        a = rng.uniform(0, 6.28)
        d = 25 * math.sqrt(rng.random())
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        r = rng.uniform(1.2, 4.2)
        bub.append(circle_d(x, y, r))
        hl.append(circle_d(x - r * 0.35, y - r * 0.35, r * 0.3))
    s.add(g([path("".join(bub), fill="#9aff5a", fill_opacity="0.55", stroke="#1e5a14", stroke_width="0.5"),
             path("".join(hl), fill="#fff", fill_opacity="0.6"),
             path(f"M{cx - 18} {cy + 4}q8 -6 16 0t16 0", fill="none", stroke="#eaffb0", stroke_opacity="0.5", stroke_width="1")],
            clip_path=cl))
    # bone ladle
    s.add(bone(cx + 18, cy - 14, 34, 3.2, -35))
    s.add(skull(s, cx - 10, cy + 8, 5.5, ang=20, color="#cfd8a8"))
    s.add(embers(s, 5, 5, 90, 90, 16, rng, 0.8))
    return s.render()
