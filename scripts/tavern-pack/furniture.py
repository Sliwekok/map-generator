"""Tavern interior: furniture and table props."""
import math

from lib import (INK, Svg, bevel, blob, blob_pts, circle, circle_d, el, ellipse, ellipse_d, f, f2, flame, g, grain,
                 jitter, knot, line, mix, path, P, planks, rect, rect_d, rot_pts, shade, shadow, smooth, speckle, vary,
                 wavy)
from reg import asset

OAK = "#9a6a3c"
OAK_DARK = "#6e4726"
PINE = "#b98a55"
WALNUT = "#6b4424"
IRON = "#4a4a4d"
PEWTER = "#a7adb3"
BRASS = "#c9a043"


# ============================================================== reusable props (drawn into any Svg)


def tankard(s, cx, cy, r, kind="wood", fill="foam", ang=0.0):
    """A tankard seen from above. ang = direction of the handle (radians, 0 = right)."""
    rng = s.rng
    parts = [shadow(circle_d(cx, cy, r * 1.02), r * 0.25, r * 0.32, 0.4)]
    # handle
    hx, hy = cx + math.cos(ang) * r * 1.2, cy + math.sin(ang) * r * 1.2
    hw = r * 0.32
    hp = rot_pts([(cx + r * 0.7, cy - hw), (cx + r * 1.55, cy - hw), (cx + r * 1.55, cy + hw), (cx + r * 0.7, cy + hw)], cx, cy, ang)
    hcol = "#6f757c" if kind == "pewter" else "#5a3a1c"
    parts.append(path(smooth(hp, t=0.6), fill=hcol, stroke=INK, stroke_width=f2(r * 0.09)))
    parts.append(circle(hx + math.cos(ang) * r * 0.05, hy + math.sin(ang) * r * 0.05, r * 0.12, fill=shade(hcol, -0.15)))
    # body
    if kind == "pewter":
        body = s.rg([(0, "#e3e6e9"), (0.55, "#a5abb1"), (1, "#5d6369")], cx=0.38, cy=0.35, r=0.7)
        parts.append(circle(cx, cy, r, fill=body, stroke=INK, stroke_width=f2(r * 0.1)))
    else:
        body = s.rg([(0, "#b98a55"), (0.7, "#8a5a2c"), (1, "#5a381a")], cx=0.4, cy=0.38, r=0.7)
        parts.append(circle(cx, cy, r, fill=body, stroke=INK, stroke_width=f2(r * 0.1)))
        # staves
        ds = []
        for i in range(10):
            a = 2 * math.pi * i / 10 + rng.uniform(-0.1, 0.1)
            ds.append(f"M{f2(cx + math.cos(a) * r * 0.8)} {f2(cy + math.sin(a) * r * 0.8)}L{f2(cx + math.cos(a) * r * 0.98)} {f2(cy + math.sin(a) * r * 0.98)}")
        parts.append(path("".join(ds), stroke="#3a220e", stroke_width=f2(r * 0.05), stroke_opacity="0.7"))
        parts.append(circle(cx, cy, r * 0.9, fill="none", stroke="#3d3d40", stroke_width=f2(r * 0.1)))
    # rim + contents
    parts.append(circle(cx, cy, r * 0.8, fill="#2b1a0c" if kind == "wood" else "#4d5358"))
    if fill == "foam":
        parts.append(path(blob(cx, cy, r * 0.74, r * 0.74, 10, 0.06, rng), fill="#efe0bd"))
        bub = []
        for _ in range(9):
            a, d = rng.uniform(0, 6.28), rng.uniform(0, r * 0.55)
            bub.append(circle_d(cx + math.cos(a) * d, cy + math.sin(a) * d, rng.uniform(r * 0.06, r * 0.14)))
        parts.append(path("".join(bub), fill="#fffaf0", fill_opacity="0.85"))
        parts.append(path(blob(cx + r * 0.1, cy + r * 0.12, r * 0.45, r * 0.4, 7, 0.2, rng), fill="#c9a86e", fill_opacity="0.35"))
    elif fill == "ale":
        ale = s.rg([(0, "#e6a53c"), (1, "#7a3f0c")], cx=0.4, cy=0.35, r=0.7)
        parts.append(circle(cx, cy, r * 0.72, fill=ale))
        parts.append(ellipse(cx - r * 0.25, cy - r * 0.28, r * 0.22, r * 0.12, fill="#fff", fill_opacity="0.45"))
    elif fill == "wine":
        parts.append(circle(cx, cy, r * 0.72, fill="#5a0f1f"))
        parts.append(ellipse(cx - r * 0.25, cy - r * 0.28, r * 0.2, r * 0.1, fill="#fff", fill_opacity="0.35"))
    else:  # empty
        parts.append(circle(cx, cy, r * 0.72, fill="#1c1108"))
        parts.append(path(f"M{f2(cx - r * 0.6)} {f2(cy)}A{f2(r * 0.6)} {f2(r * 0.6)} 0 0 1 {f2(cx)} {f2(cy - r * 0.6)}", fill="none",
                          stroke="#fff", stroke_opacity="0.12", stroke_width=f2(r * 0.12)))
    parts.append(path(f"M{f2(cx - r * 0.72)} {f2(cy + r * 0.2)}A{f2(r * 0.75)} {f2(r * 0.75)} 0 0 1 {f2(cx + r * 0.2)} {f2(cy - r * 0.72)}",
                      fill="none", stroke="#fff", stroke_opacity="0.35", stroke_width=f2(r * 0.09), stroke_linecap="round"))
    return g(parts)


def candle(s, cx, cy, r, holder=True, glow=True, lit=True):
    rng = s.rng
    parts = []
    if glow and lit:
        parts.append(circle(cx, cy, r * 4.2, fill=s.rg([(0, "#ffcf6a", 0.42), (0.35, "#ffae3c", 0.16), (1, "#ff9020", 0)])))
    if holder:
        parts.append(shadow(circle_d(cx, cy, r * 1.35), r * 0.2, r * 0.3, 0.4))
        parts.append(circle(cx, cy, r * 1.35, fill=s.rg([(0, "#f6dc8a"), (0.6, BRASS), (1, "#7a5a1c")], cx=0.38, cy=0.35),
                            stroke="#4a3510", stroke_width=f2(r * 0.12)))
        parts.append(circle(cx, cy, r * 1.0, fill="none", stroke="#fff3c4", stroke_opacity="0.35", stroke_width=f2(r * 0.1)))
        # finger ring
        parts.append(circle(cx + r * 1.55, cy + r * 0.2, r * 0.38, fill="none", stroke="#7a5a1c", stroke_width=f2(r * 0.18)))
    parts.append(circle(cx, cy, r * 0.62, fill=s.rg([(0, "#fffaf0"), (0.8, "#efe4cc"), (1, "#cdbf9f")], cx=0.4, cy=0.4)))
    # wax drips
    for _ in range(3):
        a = rng.uniform(0, 6.28)
        parts.append(ellipse(cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62, r * 0.14, r * 0.2, fill="#f4ecd8",
                             transform=f"rotate({f(math.degrees(a) + 90)} {f2(cx + math.cos(a) * r * 0.62)} {f2(cy + math.sin(a) * r * 0.62)})"))
    if lit:
        parts.append(path(smooth([(cx, cy - r * 0.95), (cx + r * 0.22, cy - r * 0.2), (cx, cy + r * 0.12), (cx - r * 0.22, cy - r * 0.2)]),
                          fill="#ffb13b"))
        parts.append(path(smooth([(cx, cy - r * 0.7), (cx + r * 0.1, cy - r * 0.2), (cx, cy + r * 0.02), (cx - r * 0.1, cy - r * 0.2)]),
                          fill="#fff6cf"))
    parts.append(circle(cx, cy, r * 0.07, fill="#222"))
    return g(parts)


def plate(s, cx, cy, r, food="bread", ceramic="#e9e2d0"):
    rng = s.rng
    parts = [shadow(circle_d(cx, cy, r), r * 0.12, r * 0.16, 0.35)]
    parts.append(circle(cx, cy, r, fill=s.rg([(0, shade(ceramic, 0.05)), (0.85, ceramic), (1, shade(ceramic, -0.18))], cx=0.4, cy=0.4),
                        stroke="#5b5146", stroke_width=f2(r * 0.05)))
    parts.append(circle(cx, cy, r * 0.72, fill="none", stroke="#7b6f60", stroke_opacity="0.35", stroke_width=f2(r * 0.03)))
    parts.append(circle(cx, cy, r * 0.84, fill="none", stroke="#2f5d8a", stroke_opacity="0.45", stroke_width=f2(r * 0.035),
                        stroke_dasharray=f"{f2(r * 0.12)} {f2(r * 0.08)}"))
    if food == "bread":
        parts.append(bread_loaf(s, cx - r * 0.12, cy - r * 0.05, r * 0.5, r * 0.34, -0.5))
        parts.append(cheese(s, cx + r * 0.32, cy + r * 0.3, r * 0.3))
        parts.append(circle(cx + r * 0.35, cy - r * 0.35, r * 0.1, fill="#6b8f2a"))
        parts.append(circle(cx + r * 0.46, cy - r * 0.22, r * 0.09, fill="#7fa33a"))
    elif food == "roast":
        parts.append(drumstick(s, cx - r * 0.05, cy + r * 0.02, r * 0.62, -0.6))
        for i in range(5):
            a = rng.uniform(0, 6.28)
            parts.append(circle(cx + r * 0.42 + math.cos(a) * r * 0.1, cy - r * 0.34 + math.sin(a) * r * 0.1, r * 0.08, fill="#5c8f2d",
                                stroke="#2f4f14", stroke_width=f2(r * 0.015)))
        parts.append(path(blob(cx - r * 0.38, cy + r * 0.42, r * 0.22, r * 0.16, 7, 0.15, rng), fill="#d8b067", stroke="#6b4a1c",
                          stroke_width=f2(r * 0.02)))
    elif food == "stew":
        parts.append(circle(cx, cy, r * 0.62, fill=s.rg([(0, "#a4552a"), (1, "#5c2a10")], cx=0.4, cy=0.4)))
        for _ in range(9):
            a, d = rng.uniform(0, 6.28), rng.uniform(0, r * 0.45)
            c = rng.choice(["#d9892f", "#e3c07a", "#6b8f2a", "#8a3a1a"])
            parts.append(path(blob(cx + math.cos(a) * d, cy + math.sin(a) * d, r * 0.09, r * 0.07, 5, 0.3, rng), fill=c))
        parts.append(ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.2, r * 0.07, fill="#fff", fill_opacity="0.3",
                             transform=f"rotate(-35 {f2(cx - r * 0.25)} {f2(cy - r * 0.3)})"))
    return g(parts)


def bread_loaf(s, cx, cy, rx, ry, ang=0.0):
    rng = s.rng
    deg = math.degrees(ang)
    tf = f"rotate({f(deg)} {f2(cx)} {f2(cy)})"
    crust = s.rg([(0, "#e3a85a"), (0.6, "#b86f2c"), (1, "#7a4214")], cx=0.4, cy=0.35, r=0.65)
    parts = [shadow(ellipse_d(cx, cy, rx, ry), rx * 0.12, ry * 0.2, 0.35),
             path(blob(cx, cy, rx, ry, 10, 0.05, rng), fill=crust, stroke="#5a300c", stroke_width=f2(rx * 0.05), transform=tf)]
    cuts = []
    for k in (-0.5, 0, 0.5):
        x = cx + rx * k
        cuts.append(f"M{f2(x - rx * 0.12)} {f2(cy - ry * 0.55)}Q{f2(x + rx * 0.08)} {f2(cy)} {f2(x - rx * 0.1)} {f2(cy + ry * 0.55)}")
    parts.append(path("".join(cuts), fill="none", stroke="#f3d59a", stroke_width=f2(rx * 0.09), stroke_linecap="round", transform=tf))
    parts.append(path("".join(cuts), fill="none", stroke="#7a4214", stroke_width=f2(rx * 0.03), stroke_linecap="round", transform=tf,
                      stroke_opacity="0.6"))
    parts.append(speckle(s, cx - rx * 0.7, cy - ry * 0.5, rx * 1.4, ry, 10, ["#f7e2b0"], rx * 0.015, rx * 0.03, 0.8))
    return g(parts)


def cheese(s, cx, cy, r):
    pts = [(cx - r, cy + r * 0.5), (cx + r, cy + r * 0.5), (cx + r * 0.2, cy - r * 0.8)]
    parts = [path(P(pts), fill="#f1c24a", stroke="#8a6414", stroke_width=f2(r * 0.07), stroke_linejoin="round"),
             path(P([(cx - r, cy + r * 0.5), (cx + r, cy + r * 0.5), (cx + r * 0.9, cy + r * 0.72), (cx - r * 0.95, cy + r * 0.72)]),
                  fill="#c98a1e", stroke="#8a6414", stroke_width=f2(r * 0.05))]
    for dx, dy, rr in ((-0.3, 0.15, 0.13), (0.3, 0.2, 0.1), (0.1, -0.25, 0.08)):
        parts.append(circle(cx + r * dx, cy + r * dy, r * rr, fill="#d9a431"))
    return g(parts)


def drumstick(s, cx, cy, L, ang):
    deg = math.degrees(ang)
    tf = f"rotate({f(deg)} {f2(cx)} {f2(cy)})"
    meat = s.rg([(0, "#d99a52"), (0.6, "#a45a22"), (1, "#6a340f")], cx=0.4, cy=0.35, r=0.65)
    parts = [
        path(blob(cx - L * 0.2, cy, L * 0.52, L * 0.36, 9, 0.08, s.rng), fill=meat, stroke="#4f260a", stroke_width=f2(L * 0.04), transform=tf),
        rect(cx + L * 0.25, cy - L * 0.07, L * 0.42, L * 0.14, rx=L * 0.06, fill="#efe6d2", stroke="#7a6a50", stroke_width=f2(L * 0.025), transform=tf),
        circle(cx + L * 0.7, cy - L * 0.09, L * 0.09, fill="#f4ecdc", stroke="#7a6a50", stroke_width=f2(L * 0.02), transform=tf),
        circle(cx + L * 0.7, cy + L * 0.09, L * 0.09, fill="#f4ecdc", stroke="#7a6a50", stroke_width=f2(L * 0.02), transform=tf),
        path(f"M{f2(cx - L * 0.55)} {f2(cy - L * 0.1)}Q{f2(cx - L * 0.2)} {f2(cy - L * 0.3)} {f2(cx + L * 0.1)} {f2(cy - L * 0.12)}",
             fill="none", stroke="#f7cf8e", stroke_opacity="0.6", stroke_width=f2(L * 0.05), stroke_linecap="round", transform=tf),
    ]
    return g(parts)


def dice(s, cx, cy, size, face, ang=0.0):
    pips = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)], 4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
            5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)], 6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]}
    h = size / 2
    tf = f"rotate({f(ang)} {f2(cx)} {f2(cy)})"
    parts = [shadow(rect_d(cx - h, cy - h, size, size, size * 0.2), size * 0.15, size * 0.2, 0.4),
             rect(cx - h, cy - h, size, size, rx=size * 0.2, fill="#f2ead8", stroke="#5a5046", stroke_width=f2(size * 0.07), transform=tf)]
    ds = "".join(circle_d(cx + px * size * 0.27, cy + py * size * 0.27, size * 0.09) for px, py in pips[face])
    parts.append(path(ds, fill="#2a1e14", transform=tf))
    return g(parts)


def coins(s, cx, cy, spread, n):
    rng = s.rng
    parts = []
    for _ in range(n):
        x, y = cx + rng.uniform(-spread, spread), cy + rng.uniform(-spread, spread) * 0.8
        r = rng.uniform(2.1, 2.7)
        silver = rng.random() < 0.3
        c0, c1 = ("#eef0f2", "#8d949b") if silver else ("#ffe38a", "#b07d16")
        parts.append(shadow(circle_d(x, y, r), 0.5, 0.7, 0.4, soft=1))
        parts.append(circle(x, y, r, fill=s.rg([(0, c0), (1, c1)], cx=0.35, cy=0.35, r=0.75), stroke=shade(c1, -0.2), stroke_width="0.35"))
        parts.append(circle(x, y, r * 0.62, fill="none", stroke=shade(c1, -0.1), stroke_width="0.3", stroke_opacity="0.7"))
    return g(parts)


def ring_stain(cx, cy, r, op=0.18):
    return circle(cx, cy, r, fill="none", stroke="#3a1f0a", stroke_width=f2(r * 0.14), stroke_opacity=f2(op))


def cloth_rag(s, cx, cy, r, color="#d8cfb8"):
    pts = blob_pts(cx, cy, r, r * 0.7, 9, 0.28, s.rng, rot=s.rng.uniform(0, 3))
    parts = [shadow(smooth(pts), 0.8, 1.2, 0.35), path(smooth(pts), fill=color, stroke="#6b604c", stroke_width="0.6")]
    fold = []
    for _ in range(4):
        a = s.rng.uniform(0, 6.28)
        fold.append(f"M{f2(cx)} {f2(cy)}Q{f2(cx + math.cos(a + 0.4) * r * 0.5)} {f2(cy + math.sin(a + 0.4) * r * 0.4)} "
                    f"{f2(cx + math.cos(a) * r * 0.85)} {f2(cy + math.sin(a) * r * 0.6)}")
    parts.append(path("".join(fold), fill="none", stroke="#6b604c", stroke_opacity="0.45", stroke_width="0.6"))
    parts.append(path("".join(fold), fill="none", stroke="#fff", stroke_opacity="0.35", stroke_width="0.5", transform="translate(-0.6 -0.6)"))
    return g(parts)


def bottle(s, cx, cy, r, color="#2f5a2a", cork=True):
    parts = [shadow(circle_d(cx, cy, r), r * 0.25, r * 0.35, 0.4)]
    parts.append(circle(cx, cy, r, fill=s.rg([(0, shade(color, 0.25)), (0.6, color), (1, shade(color, -0.2))], cx=0.35, cy=0.35),
                        stroke=shade(color, -0.3), stroke_width=f2(r * 0.08)))
    parts.append(circle(cx, cy, r * 0.62, fill="none", stroke=shade(color, -0.15), stroke_width=f2(r * 0.1), stroke_opacity="0.7"))
    parts.append(circle(cx, cy, r * 0.36, fill="#a57a4a" if cork else shade(color, -0.25), stroke="#5b3c1c", stroke_width=f2(r * 0.06)))
    parts.append(path(f"M{f2(cx - r * 0.7)} {f2(cy - r * 0.1)}A{f2(r * 0.72)} {f2(r * 0.72)} 0 0 1 {f2(cx - r * 0.1)} {f2(cy - r * 0.7)}",
                      fill="none", stroke="#fff", stroke_opacity="0.55", stroke_width=f2(r * 0.14), stroke_linecap="round"))
    return g(parts)


# ============================================================== furniture


@asset("t-barrel", "furniture", [1, 1], "Ale barrel", "Beczka piwa", tags=["keg", "barrel", "tavern", "beer", "beczka"])
def barrel(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx = cy = 48
    s.add(shadow(circle_d(cx, cy, 43), 5, 6, 0.42))
    # bilge ring: staves sloping away (darker outward)
    s.add(circle(cx, cy, 43, fill=s.rg([(0, "#c08b52"), (0.8, "#9a6a3c"), (0.93, "#6e4726"), (1, "#4a2e16")], cx=0.45, cy=0.45, r=0.52),
                 stroke=INK, stroke_width="1.6"))
    seams = []
    for i in range(22):
        a = 2 * math.pi * i / 22 + rng.uniform(-0.04, 0.04)
        seams.append(f"M{f(cx + math.cos(a) * 35)} {f(cy + math.sin(a) * 35)}L{f(cx + math.cos(a) * 42.6)} {f(cy + math.sin(a) * 42.6)}")
    s.add(path("".join(seams), stroke="#2f1a0a", stroke_width="0.8", stroke_opacity="0.8"))
    # bilge hoop + highlight
    s.add(circle(cx, cy, 40.2, fill="none", stroke="#3b3b3e", stroke_width="3.2"))
    s.add(circle(cx, cy, 40.2, fill="none", stroke="#9aa0a6", stroke_width="0.8", stroke_dasharray="30 12 50 20",
                 transform=f"rotate(200 {cx} {cy})", stroke_opacity="0.7"))
    for i in range(10):
        a = 2 * math.pi * i / 10 + 0.2
        s.add(circle(cx + math.cos(a) * 40.2, cy + math.sin(a) * 40.2, 0.7, fill="#1d1d1f"))
    # top chime + hoop
    s.add(circle(cx, cy, 35.5, fill="#7d5230", stroke=INK, stroke_width="1.2"))
    s.add(circle(cx, cy, 34, fill="none", stroke="#353538", stroke_width="2.6"))
    s.add(circle(cx, cy, 34, fill="none", stroke="#a9aeb3", stroke_width="0.7", stroke_opacity="0.6", stroke_dasharray="18 8 26 60",
                 transform=f"rotate(190 {cx} {cy})"))
    # head (lid) boards
    lid = circle_d(cx, cy, 31.5)
    cl = s.clip(lid)
    s.add(g([planks(s, cx - 32, cy - 32, 64, 64, 5, "#a8784a", horizontal=False, nails=False, joints=False, knots=True, tone=0.07)],
            clip_path=cl))
    # recessed-lid shadow from the chime (light from top-left)
    s.add(g([circle(cx + 3.2, cy + 3.2, 34.5, fill="none", stroke="#1b0f06", stroke_width="9", stroke_opacity="0.35")], clip_path=cl))
    s.add(circle(cx, cy, 31.5, fill="none", stroke=INK, stroke_width="1"))
    # bung + chalk marks + tap hole peg
    s.add(circle(cx + 13, cy + 9, 4.2, fill="#5e3b1c", stroke=INK, stroke_width="0.9"))
    s.add(circle(cx + 13, cy + 9, 2.6, fill="#c9a877", stroke="#6b4a24", stroke_width="0.6"))
    s.add(path(f"M{cx - 16} {cy - 14}l7 7M{cx - 9} {cy - 14}l-7 7M{cx - 5} {cy - 14}l7 7M{cx + 2} {cy - 14}l-7 7", stroke="#f3eee2",
               stroke_width="1.4", stroke_opacity="0.75", stroke_linecap="round"))
    s.add(path(f"M{cx - 18} {cy - 3}h24", stroke="#f3eee2", stroke_width="1", stroke_opacity="0.55", stroke_linecap="round"))
    s.add(ring_stain(cx - 6, cy + 14, 7, 0.22))
    return s.render()


@asset("t-table-round", "furniture", [1.5, 1.5], "Round tavern table", "Okrągły stół karczemny",
       tags=["table", "stół", "tavern", "dice", "ale"])
def table_round(seed):
    s = Svg(150, 150, seed)
    cx = cy = 72
    R = 64
    s.add(shadow(circle_d(cx, cy, R), 6, 7, 0.42))
    s.add(circle(cx, cy, R, fill=OAK_DARK, stroke=INK, stroke_width="2"))
    top = circle_d(cx, cy, R - 3)
    cl = s.clip(top)
    s.add(g(planks(s, cx - R, cy - R, 2 * R, 2 * R, 6, "#a2703f", horizontal=False, nails=False, joints=False, tone=0.06), clip_path=cl))
    s.add(g([circle(cx, cy, R - 3, fill=s.rg([(0, "#fff", 0.1), (0.7, "#fff", 0), (1, "#000", 0.22)], cx=0.4, cy=0.38, r=0.62))]))
    s.add(circle(cx, cy, R - 3, fill="none", stroke="#2c1a0b", stroke_width="1", stroke_opacity="0.8"))
    s.add(path(f"M{cx - R + 1.5} {cy}A{R - 1.5} {R - 1.5} 0 0 1 {cx} {cy - R + 1.5}", fill="none", stroke="#f0c890", stroke_opacity="0.4",
               stroke_width="1.4"))
    # scuffs + stains
    s.add(ring_stain(cx + 20, cy - 26, 8), ring_stain(cx - 28, cy + 12, 7.5, 0.14))
    s.add(path("M58 104l14 -3M88 38l9 5", stroke="#2c1a0b", stroke_width="0.6", stroke_opacity="0.4"))
    # dressing
    s.add(plate(s, cx + 18, cy + 17, 17, "bread"))
    s.add(tankard(s, cx - 24, cy - 16, 9.5, "wood", "foam", ang=-2.4))
    s.add(tankard(s, cx + 25, cy - 25, 8.5, "pewter", "ale", ang=-0.6))
    s.add(tankard(s, cx - 30, cy + 22, 9, "wood", "empty", ang=2.6))
    s.add(candle(s, cx - 4, cy - 2, 4.2))
    s.add(dice(s, cx - 6, cy + 30, 6, 6, 18), dice(s, cx + 3, cy + 36, 6, 3, -12))
    s.add(coins(s, cx - 2, cy + 50, 5, 4))
    return s.render()


@asset("t-chair", "furniture", [0.7, 0.7], "Wooden chair", "Drewniane krzesło", tags=["chair", "seat", "krzesło"])
def chair(seed):
    s = Svg(70, 70, seed)
    wood = "#8d5d31"
    # legs peeking out at the corners
    for lx, ly in ((12, 20), (56, 20), (12, 60), (56, 60)):
        s.add(rect(lx - 3.5, ly - 3.5, 7, 7, rx=1.5, fill=shade(wood, -0.12), stroke=INK, stroke_width="1"))
    seat = rect_d(10, 18, 48, 44, 5)
    s.add(shadow(seat, 3.5, 4.5, 0.4))
    s.add(path(seat, fill=wood, stroke=INK, stroke_width="1.6"))
    cl = s.clip(seat)
    s.add(g([planks(s, 10, 18, 48, 44, 3, "#9a6a3c", horizontal=False, nails=False, joints=False, tone=0.06),
             ellipse(34, 42, 16, 13, fill="#e8c08a", fill_opacity="0.18")], clip_path=cl))
    s.add(bevel(seat, lo=0.22, do=0.3))
    # back rail + spindles (the back casts a shadow on the seat)
    s.add(path("M8 17Q34 9 60 17", fill="none", stroke="#1b0f06", stroke_opacity="0.3", stroke_width="7", transform="translate(1.5 3)"))
    for x in (17, 27.5, 38, 48.5):
        s.add(circle(x + 1, 17.2, 2.2, fill=shade(wood, 0.05), stroke=INK, stroke_width="0.8"))
    s.add(path("M7 13Q34 4 61 13L61 18Q34 10 7 18Z", fill=s.lg([(0, "#b98452"), (1, "#6e4726")]), stroke=INK, stroke_width="1.3",
               stroke_linejoin="round"))
    s.add(path("M9 13.5Q34 5.5 59 13.5", fill="none", stroke="#f3d3a3", stroke_opacity="0.45", stroke_width="0.8"))
    s.add(circle(8, 15.5, 3, fill="#6e4726", stroke=INK, stroke_width="1"), circle(60, 15.5, 3, fill="#6e4726", stroke=INK, stroke_width="1"))
    return s.render()


@asset("t-stool", "furniture", [0.5, 0.5], "Bar stool", "Taboret", tags=["stool", "seat", "taboret", "stołek"])
def stool(seed):
    s = Svg(50, 50, seed)
    cx = cy = 24
    for a in (-90, 30, 150):
        r = math.radians(a)
        x, y = cx + math.cos(r) * 19, cy + math.sin(r) * 19
        s.add(circle(x + 1, y + 1.5, 3.4, fill="#1b0f06", fill_opacity="0.35"))
        s.add(circle(x, y, 3.2, fill="#6e4726", stroke=INK, stroke_width="0.9"))
    seat = circle_d(cx, cy, 17)
    s.add(shadow(seat, 3, 4, 0.42))
    s.add(path(seat, fill="#8d5d31", stroke=INK, stroke_width="1.4"))
    cl = s.clip(circle_d(cx, cy, 15.8))
    s.add(g([planks(s, cx - 17, cy - 17, 34, 34, 2, "#a4733f", horizontal=True, nails=False, joints=False, tone=0.05),
             circle(cx, cy, 16, fill=s.rg([(0, "#fff", 0.15), (0.6, "#fff", 0), (1, "#000", 0.3)], cx=0.4, cy=0.38))], clip_path=cl))
    s.add(circle(cx, cy, 15.8, fill="none", stroke="#2c1a0b", stroke_width="0.6", stroke_opacity="0.7"))
    s.add(circle(cx - 6, cy + 1, 1, fill="#2b2622"), circle(cx + 6, cy - 1, 1, fill="#2b2622"))
    return s.render()


@asset("t-bench", "furniture", [2, 0.5], "Plank bench", "Ława", tags=["bench", "seat", "ława", "ławka"])
def bench(seed):
    s = Svg(200, 50, seed)
    # trestle feet (wider than the seat)
    for x in (22, 170):
        s.add(shadow(rect_d(x, 4, 10, 42, 2), 2, 3, 0.35))
        s.add(rect(x, 4, 10, 42, rx=2, fill="#6e4726", stroke=INK, stroke_width="1.1"))
        s.add(grain(x + 1, 5, 8, 40, s.rng, horizontal=False, n=2, op=0.4))
    top = rect_d(4, 9, 190, 30, 3)
    s.add(shadow(top, 4, 5, 0.4))
    s.add(path(top, fill="#8d5d31", stroke=INK, stroke_width="1.5"))
    cl = s.clip(top)
    s.add(g([planks(s, 4, 9, 190, 30, 2, "#a0703f", horizontal=True, nails=True, joints=False, tone=0.05),
             ellipse(60, 24, 26, 10, fill="#ecc890", fill_opacity="0.16"), ellipse(140, 24, 26, 10, fill="#ecc890", fill_opacity="0.16")],
            clip_path=cl))
    s.add(bevel(top, lo=0.2, do=0.28))
    # peg ends of the trestle through the top
    for x in (27, 175):
        s.add(rect(x - 3.5, 20.5, 7, 7, rx=1, fill="#5a3a1c", stroke=INK, stroke_width="0.7"))
        s.add(path(f"M{x - 2} {22}h4", stroke="#c9955c", stroke_width="0.6", stroke_opacity="0.6"))
    return s.render()


@asset("t-tankards", "furniture", [0.5, 0.5], "Tankards", "Kufle", layer="objects", tags=["mug", "beer", "ale", "kufel", "piwo", "prop"])
def tankards(seed):
    s = Svg(50, 50, seed)
    s.add(tankard(s, 17, 19, 10, "wood", "foam", ang=-2.5))
    s.add(tankard(s, 32, 32, 9, "pewter", "ale", ang=0.6))
    return s.render()


@asset("t-meal", "furniture", [0.5, 0.5], "Plate of food", "Talerz z jedzeniem", tags=["food", "plate", "meal", "jedzenie", "talerz", "prop"])
def meal(seed):
    s = Svg(50, 50, seed)
    s.add(plate(s, 24, 24, 20, "roast"))
    return s.render()


@asset("t-candle", "furniture", [0.5, 0.5], "Candle", "Świeca", tags=["light", "candle", "świeca", "prop"])
def candle_asset(seed):
    s = Svg(50, 50, seed)
    s.add(candle(s, 24, 24, 5.2))
    return s.render()


# ------------------------------------------------------------------ the bar


def brass_tap(s, x, y, ang=-90):
    """A brass spigot seen from above, pointing along ang (degrees)."""
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    br = s.lg([(0, "#fbe7a1"), (0.5, BRASS), (1, "#7a5a1c")], 0, 0, 0, 1)
    return g([
        rect(x - 1, y - 2.2, 11, 4.4, rx=1.8, fill=br, stroke="#4a3510", stroke_width="0.6"),
        circle(x + 10, y, 2.6, fill=br, stroke="#4a3510", stroke_width="0.6"),
        rect(x + 3, y - 5.5, 2.6, 11, rx=1.2, fill="#2a1a0c", stroke="#120a04", stroke_width="0.5"),
        circle(x + 4.3, y - 5.5, 1.5, fill="#f2e3c0"),
    ], transform=tf)


@asset("t-bar-counter", "furniture", [4, 1], "Bar counter", "Kontuar", tags=["bar", "counter", "tavern", "kontuar", "lada"])
def bar_counter(seed):
    s = Svg(400, 100, seed)
    rng = s.rng
    body = rect_d(4, 8, 390, 80, 4)
    s.add(shadow(body, 6, 7, 0.45))
    s.add(path(body, fill=WALNUT, stroke=INK, stroke_width="2"))
    top = rect_d(8, 14, 382, 62, 2)
    cl = s.clip(top)
    s.add(g([planks(s, 8, 14, 382, 62, 3, "#7d4f2a", horizontal=True, nails=False, joints=True, tone=0.05, lengths=(0.3, 0.6)),
             # polished elbow strip along the customer side
             rect(8, 58, 382, 18, fill=s.lg([(0, "#f4cf98", 0), (1, "#f4cf98", 0.2)]))], clip_path=cl))
    # bullnose lip on the customer side, raised back ledge on the barkeep side
    s.add(rect(6, 74, 386, 12, rx=5, fill=s.lg([(0, "#a36c3c"), (0.4, "#7a4a24"), (1, "#3d220e")]), stroke=INK, stroke_width="1.3"))
    s.add(path("M10 76.5H388", stroke="#ffd9a3", stroke_opacity="0.35", stroke_width="1"))
    s.add(rect(6, 8, 386, 7, rx=2, fill="#4a2c14", stroke=INK, stroke_width="1.1"))
    # lift flap at the right end: gap + two strap hinges
    s.add(line(334, 14, 334, 86, stroke="#1b0f06", stroke_width="1.6"))
    s.add(line(335.2, 14, 335.2, 86, stroke="#e7b77e", stroke_opacity="0.25", stroke_width="0.8"))
    for hy in (24, 60):
        s.add(rect(324, hy, 22, 7, rx=1.5, fill="#3a3a3d", stroke="#141414", stroke_width="0.7"))
        s.add(circle(327, hy + 3.5, 1, fill="#a5a9ad"), circle(342, hy + 3.5, 1, fill="#a5a9ad"), circle(334.5, hy + 3.5, 1.6, fill="#57575b"))
    s.add(circle(378, 50, 3, fill="none", stroke="#3a3a3d", stroke_width="1.6"))
    # stains, knife nicks, polished spots
    for cx, cy, r, op in ((58, 44, 7, 0.2), (166, 60, 6.5, 0.16), (250, 36, 7, 0.14), (292, 62, 6, 0.2), (300, 60, 6.5, 0.12)):
        s.add(ring_stain(cx, cy, r, op))
    nicks = "".join(f"M{f(x)} {f(y)}l{f(rng.uniform(3, 7))} {f(rng.uniform(-2, 2))}" for x, y in
                    [(rng.uniform(20, 320), rng.uniform(20, 70)) for _ in range(14)])
    s.add(path(nicks, stroke="#1b0f06", stroke_width="0.5", stroke_opacity="0.45"))
    # tap block (barkeep side) with three brass taps and a drip tray
    s.add(shadow(rect_d(96, 12, 58, 18, 2), 2.5, 3, 0.45))
    s.add(rect(96, 12, 58, 18, rx=2, fill="#4f2f16", stroke=INK, stroke_width="1.2"))
    s.add(grain(97, 13, 56, 16, rng, n=4, op=0.45))
    for tx in (106, 125, 144):
        s.add(brass_tap(s, tx, 24, 90))
    s.add(rect(98, 38, 54, 12, rx=2, fill="#2f2f32", stroke="#111", stroke_width="0.9"))
    s.add(path("".join(f"M{x} 40v8" for x in range(101, 151, 3)), stroke="#6d7075", stroke_width="0.9"))
    s.add(ellipse(125, 44, 14, 3, fill="#c98a2c", fill_opacity="0.35"))
    # service: tankards, a rag, coins, bottle and cups, bowl of nuts, candle
    s.add(tankard(s, 40, 52, 9.5, "wood", "foam", ang=2.6))
    s.add(tankard(s, 180, 56, 9, "pewter", "foam", ang=-0.4))
    s.add(tankard(s, 204, 40, 8.5, "wood", "ale", ang=0.8))
    s.add(tankard(s, 312, 48, 9, "wood", "empty", ang=-2.2))
    s.add(cloth_rag(s, 72, 34, 10))
    s.add(coins(s, 232, 64, 6, 5))
    s.add(bottle(s, 262, 32, 6.5, "#35602c"))
    for cx, cy in ((276, 44), (286, 34)):
        s.add(shadow(circle_d(cx, cy, 4), 1, 1.4, 0.4, soft=2))
        s.add(circle(cx, cy, 4, fill="#cfc6b0", stroke="#6b604c", stroke_width="0.7"))
        s.add(circle(cx, cy, 2.9, fill="#8a1f2b"))
    # bowl of nuts
    s.add(shadow(circle_d(150, 60, 10), 1.8, 2.4, 0.4))
    s.add(circle(150, 60, 10, fill=s.rg([(0, "#b98a55"), (1, "#5a381a")], cx=0.6, cy=0.6), stroke=INK, stroke_width="1"))
    for _ in range(14):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, 6.5)
        x, y = 150 + math.cos(a) * d, 60 + math.sin(a) * d
        s.add(ellipse(x, y, 1.8, 1.3, fill=rng.choice(["#c8914a", "#a8703a", "#e0b070"]), stroke="#5a381a", stroke_width="0.3",
                      transform=f"rotate({rng.randint(0, 180)} {f(x)} {f(y)})"))
    s.add(candle(s, 362, 30, 4, glow=True))
    return s.render()


@asset("t-back-shelf", "furniture", [3, 0.5], "Bottle shelf", "Półka z butelkami", tags=["shelf", "bottles", "bar", "półka", "butelki"])
def back_shelf(seed):
    s = Svg(300, 50, seed)
    rng = s.rng
    board = rect_d(3, 3, 292, 42, 2)
    s.add(shadow(board, 4, 4, 0.42))
    s.add(path(board, fill=WALNUT, stroke=INK, stroke_width="1.6"))
    s.add(g(planks(s, 5, 5, 288, 38, 2, "#6f4524", horizontal=True, nails=False, joints=False, tone=0.04), clip_path=s.clip(board)))
    s.add(rect(4, 38, 290, 6, rx=2, fill=s.lg([(0, "#8a5a30"), (1, "#3d220e")]), stroke=INK, stroke_width="0.8"))
    s.add(path("M8 40H290", stroke="#f0c890", stroke_opacity="0.3", stroke_width="0.7"))
    x = 12
    palette = ["#35602c", "#6b2233", "#2f4d6b", "#7a5a1c", "#3c3c3c", "#2e5e4e", "#8a3a14"]
    seq = ["b", "b", "jug", "b", "mugs", "b", "b", "cheese", "b", "b", "b", "jug", "b", "mugs", "b", "b"]
    widths = {"jug": 30, "mugs": 30, "cheese": 28}
    for item in seq:
        need = widths.get(item, 14)
        if x + need > 292:
            break
        kind = {"b": 0.1, "jug": 0.6, "mugs": 0.8, "cheese": 0.9}[item]
        if kind < 0.55:
            r = rng.uniform(4.5, 6.2)
            s.add(bottle(s, x + r, 20 + rng.uniform(-6, 6), r, rng.choice(palette), cork=rng.random() < 0.7))
            x += 2 * r + rng.uniform(1.5, 4)
        elif kind < 0.7:
            # stoneware jug with handle
            r = 9
            cy = 21
            s.add(shadow(circle_d(x + r, cy, r), 2, 2.6, 0.4))
            s.add(path(rect_d(x + r + 6, cy - 3, 8, 6, 2.5), fill="#8b7d68", stroke=INK, stroke_width="0.8"))
            s.add(circle(x + r, cy, r, fill=s.rg([(0, "#efe3c8"), (0.7, "#c4b394"), (1, "#7d6e55")], cx=0.38, cy=0.35), stroke=INK, stroke_width="1"))
            s.add(circle(x + r, cy, r * 0.45, fill="#6b5a44", stroke="#3d3226", stroke_width="0.7"))
            s.add(circle(x + r, cy, r * 0.8, fill="none", stroke="#6b4f9a", stroke_opacity="0.5", stroke_width="1.2"))
            x += 2 * r + 12
        elif kind < 0.85:
            # stacked upturned tankards
            for k in range(2):
                cx = x + 8 + k * 7
                s.add(shadow(circle_d(cx, 22 + k * 3, 7.5), 1.6, 2, 0.35))
                s.add(circle(cx, 22 + k * 3, 7.5, fill=s.rg([(0, "#c49058"), (1, "#5a381a")], cx=0.35, cy=0.35), stroke=INK, stroke_width="0.9"))
                s.add(circle(cx, 22 + k * 3, 5.5, fill="none", stroke="#3d3d40", stroke_width="1.4"))
            x += 30
        else:
            # cheese wheel with a wedge cut out
            r = 11
            cx, cy = x + r, 21
            s.add(shadow(circle_d(cx, cy, r), 2, 2.6, 0.4))
            s.add(path(f"M{f(cx)} {f(cy)}L{f(cx + r)} {f(cy)}A{r} {r} 0 1 1 {f(cx + r * math.cos(-0.9))} {f(cy + r * math.sin(-0.9))}Z",
                       fill="#d9a431", stroke="#7a5510", stroke_width="1"))
            s.add(path(f"M{f(cx)} {f(cy)}L{f(cx + r)} {f(cy)}L{f(cx + r * math.cos(-0.9))} {f(cy + r * math.sin(-0.9))}Z", fill="#f3d27a",
                       stroke="#7a5510", stroke_width="0.7"))
            s.add(circle(cx, cy, r * 0.82, fill="none", stroke="#fff3c4", stroke_opacity="0.25", stroke_width="1"))
            x += 2 * r + 6
    return s.render()


def lying_keg(s, x, y, w, L, tap=True):
    """A keg lying on its side, axis vertical, head facing down. (x, y) = top-left of bounding box."""
    rng = s.rng
    cx = x + w / 2
    hw = w / 2
    endw = hw * 0.84
    # outline: bulge in the middle
    d = (f"M{f(cx - endw)} {f(y)}C{f(cx - hw * 1.08)} {f(y + L * 0.3)} {f(cx - hw * 1.08)} {f(y + L * 0.7)} {f(cx - endw)} {f(y + L)}"
         f"H{f(cx + endw)}C{f(cx + hw * 1.08)} {f(y + L * 0.7)} {f(cx + hw * 1.08)} {f(y + L * 0.3)} {f(cx + endw)} {f(y)}Z")
    parts = [shadow(d, 5, 6, 0.42)]
    parts.append(path(d, fill=s.lg([(0, "#6e4726"), (0.22, "#c08b52"), (0.45, "#a4713f"), (0.8, "#6e4726"), (1, "#3d240f")], 0, 0, 1, 0),
                      stroke=INK, stroke_width="1.4"))
    cl = s.clip(d)
    st = []
    n = 9
    for i in range(1, n):
        t = i / n
        off = (t - 0.5) * 2
        xe = cx + off * endw
        xm = cx + off * hw * 1.02
        st.append(f"M{f(xe)} {f(y)}Q{f(xm + (xm - xe) * 0.3)} {f(y + L / 2)} {f(xe)} {f(y + L)}")
    inner = [path("".join(st), fill="none", stroke="#2f1a0a", stroke_width="0.8", stroke_opacity="0.7")]
    for k in range(n):
        t = (k + 0.5) / n
        xx = cx + (t - 0.5) * 2 * hw * 0.95
        inner.append(grain(xx - 3, y + 4, 6, L - 8, rng, horizontal=False, n=2, op=0.25))
    for hy in (0.1, 0.3, 0.7, 0.9):
        yy = y + L * hy
        inner.append(rect(x - 2, yy - 2.6, w + 4, 5.2, fill="#353538"))
        inner.append(rect(x - 2, yy - 2.6, w + 4, 1.4, fill="#9aa0a6", fill_opacity="0.55"))
        for rx_ in (cx - hw * 0.6, cx, cx + hw * 0.6):
            inner.append(circle(rx_, yy, 0.7, fill="#161618"))
    parts.append(g(inner, clip_path=cl))
    # head edge (chime) at the bottom
    parts.append(rect(cx - endw, y + L - 3.2, endw * 2, 3.2, fill="#4f3118", stroke=INK, stroke_width="0.8"))
    # bung on top of the belly
    parts.append(circle(cx - hw * 0.1, y + L * 0.5, 3.2, fill="#5e3b1c", stroke=INK, stroke_width="0.8"))
    parts.append(circle(cx - hw * 0.1, y + L * 0.5, 1.9, fill="#c9a877"))
    if tap:
        parts.append(brass_tap(s, cx, y + L - 1, 90))
    return g(parts)


@asset("t-keg-rack", "furniture", [2, 1], "Keg rack", "Stojak na beczki", tags=["keg", "barrel", "rack", "beer", "beczki"])
def keg_rack(seed):
    s = Svg(200, 100, seed)
    rng = s.rng
    # cradle beams
    for by in (18, 64):
        s.add(shadow(rect_d(4, by, 190, 12, 1.5), 3, 3.5, 0.4))
        s.add(rect(4, by, 190, 12, rx=1.5, fill="#6e4726", stroke=INK, stroke_width="1.2"))
        s.add(grain(5, by + 1, 188, 10, rng, n=3, op=0.4))
        s.add(path(f"M5 {by + 1.2}H193", stroke="#f0c890", stroke_opacity="0.25", stroke_width="0.8"))
        for cx in (8, 97, 190):
            s.add(rect(cx - 3.5, by - 2, 7, 16, rx=1, fill="#5a381a", stroke=INK, stroke_width="0.9"))
    s.add(lying_keg(s, 10, 4, 82, 82))
    s.add(lying_keg(s, 104, 4, 82, 82))
    # drip bucket under the right tap
    s.add(shadow(circle_d(145, 93, 5.5), 1.2, 1.5, 0.35, soft=2))
    s.add(circle(145, 93, 5.5, fill="#7d5230", stroke=INK, stroke_width="0.9"))
    s.add(circle(145, 93, 4, fill="#8a4f12"))
    s.add(circle(145, 93, 4.7, fill="none", stroke="#3a3a3d", stroke_width="0.9"))
    return s.render()


# ------------------------------------------------------------------ dining


def roast_bird(s, cx, cy, L, ang=0.0):
    rng = s.rng
    tf = f"rotate({f(ang)} {f(cx)} {f(cy)})"
    skin = s.rg([(0, "#f2c070"), (0.45, "#c9782c"), (1, "#7a3a10")], cx=0.42, cy=0.38, r=0.62)
    leg = s.rg([(0, "#e8a85a"), (1, "#8a4214")], cx=0.4, cy=0.35, r=0.7)
    parts = []
    # legs at the tail end (+x), bone tips with paper frills
    for sgn in (-1, 1):
        lx, ly = cx + L * 0.36, cy + sgn * L * 0.2
        parts.append(ellipse(lx, ly, L * 0.2, L * 0.12, fill=leg, stroke="#4f220a", stroke_width=f2(L * 0.02),
                             transform=f"rotate({sgn * 22} {f(lx)} {f(ly)})"))
        bx, by = cx + L * 0.56, cy + sgn * L * 0.3
        parts.append(line(lx + L * 0.1, ly + sgn * L * 0.04, bx, by, stroke="#efe6d2", stroke_width=f2(L * 0.05), stroke_linecap="round"))
        parts.append(circle(bx, by, L * 0.045, fill="#fffaf0", stroke="#9a8f7a", stroke_width=f2(L * 0.012)))
    # wings tucked near the front
    for sgn in (-1, 1):
        wx, wy = cx - L * 0.12, cy + sgn * L * 0.3
        parts.append(ellipse(wx, wy, L * 0.18, L * 0.08, fill=leg, stroke="#4f220a", stroke_width=f2(L * 0.018),
                             transform=f"rotate({-sgn * 12} {f(wx)} {f(wy)})"))
    parts.append(path(blob(cx, cy, L * 0.46, L * 0.33, 12, 0.03, rng), fill=skin, stroke="#4f220a", stroke_width=f2(L * 0.025)))
    parts.append(path(f"M{f(cx - L * 0.4)} {f(cy)}Q{f(cx)} {f(cy - L * 0.04)} {f(cx + L * 0.4)} {f(cy)}", fill="none", stroke="#7a3a10",
                      stroke_width=f2(L * 0.018), stroke_opacity="0.6"))
    parts.append(ellipse(cx - L * 0.1, cy - L * 0.14, L * 0.2, L * 0.07, fill="#fff3d0", fill_opacity="0.45"))
    parts.append(ellipse(cx + L * 0.12, cy + L * 0.12, L * 0.14, L * 0.05, fill="#fff3d0", fill_opacity="0.2"))
    parts.append(speckle(s, cx - L * 0.35, cy - L * 0.25, L * 0.7, L * 0.5, 14, ["#5a2a08", "#2f4f14"], L * 0.006, L * 0.014, 0.6))
    return g(parts, transform=tf)


def platter(s, cx, cy, rx, ry, metal=True):
    col = [(0, "#e9ecef"), (0.75, "#a9afb5"), (1, "#5b6167")] if metal else [(0, "#c49058"), (0.8, "#8a5a2c"), (1, "#4a2c12")]
    return g([shadow(ellipse_d(cx, cy, rx, ry), 2.5, 3.2, 0.4),
              ellipse(cx, cy, rx, ry, fill=s.rg(col, cx=0.4, cy=0.38, r=0.62), stroke=INK, stroke_width="1"),
              ellipse(cx, cy, rx * 0.8, ry * 0.76, fill="none", stroke="#fff" if metal else "#2c1a0b", stroke_opacity="0.3", stroke_width="0.8")])


def apple_bowl(s, cx, cy, r):
    rng = s.rng
    parts = [shadow(circle_d(cx, cy, r), 2, 2.6, 0.42),
             circle(cx, cy, r, fill=s.rg([(0, "#c49058"), (0.8, "#7a4a24"), (1, "#3d220e")], cx=0.62, cy=0.62, r=0.6), stroke=INK, stroke_width="1"),
             circle(cx, cy, r * 0.8, fill="#3d220e", fill_opacity="0.45")]
    spots = [(0, 0)] + [(math.cos(a) * r * 0.45, math.sin(a) * r * 0.45) for a in (0.3, 1.6, 2.9, 4.2, 5.4)]
    for dx, dy in spots:
        ar = r * rng.uniform(0.3, 0.36)
        c = rng.choice(["#b3231c", "#c9361f", "#8fae2a", "#c9361f"])
        parts.append(circle(cx + dx, cy + dy, ar, fill=s.rg([(0, shade(c, 0.25)), (0.7, c), (1, shade(c, -0.2))], cx=0.35, cy=0.35),
                            stroke=shade(c, -0.3), stroke_width="0.4"))
        parts.append(line(cx + dx, cy + dy, cx + dx + ar * 0.3, cy + dy - ar * 0.35, stroke="#4a2c12", stroke_width="0.6", stroke_linecap="round"))
    return g(parts)


def knife(s, x, y, L, ang):
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    return g([
        shadow(rect_d(x, y - L * 0.05, L, L * 0.1, L * 0.03), 1, 1.4, 0.35, soft=2),
        path(f"M{f(x + L * 0.38)} {f(y - L * 0.055)}H{f(x + L * 0.92)}Q{f(x + L)} {f(y)} {f(x + L * 0.92)} {f(y + L * 0.055)}H{f(x + L * 0.38)}Z",
             fill=s.lg([(0, "#eef1f3"), (1, "#8d949b")]), stroke="#3a3f44", stroke_width="0.5"),
        rect(x, y - L * 0.06, L * 0.36, L * 0.12, rx=L * 0.04, fill="#4f2f16", stroke=INK, stroke_width="0.6"),
        rect(x + L * 0.34, y - L * 0.08, L * 0.05, L * 0.16, fill="#8a8f95", stroke="#3a3f44", stroke_width="0.4"),
        circle(x + L * 0.1, y, L * 0.018, fill="#d9c9a0"), circle(x + L * 0.24, y, L * 0.018, fill="#d9c9a0"),
    ], transform=tf)


def table_top(s, x, y, w, h, base="#a2703f", ends=True):
    top = rect_d(x, y, w, h, 3)
    parts = [shadow(top, 6, 7, 0.45), path(top, fill=OAK_DARK, stroke=INK, stroke_width="1.8")]
    inner = []
    e = 10 if ends else 0
    inner.append(planks(s, x + e, y, w - 2 * e, h, 3, base, horizontal=True, nails=True, joints=False, tone=0.05))
    if ends:
        for ex in (x, x + w - e):
            inner.append(rect(ex, y, e, h, fill=shade(base, -0.06)))
            inner.append(grain(ex + 1, y + 1, e - 2, h - 2, s.rng, horizontal=False, n=3, op=0.35))
            inner.append(line(ex + (e if ex == x else 0), y, ex + (e if ex == x else 0), y + h, stroke="#2a170a", stroke_width="1"))
            for py in (0.2, 0.5, 0.8):
                inner.append(circle(ex + e / 2, y + h * py, 1.2, fill="#3a220e", stroke="#1b0f06", stroke_width="0.4"))
    parts.append(g(inner, clip_path=s.clip(top)))
    parts.append(bevel(top, lo=0.2, do=0.3, w=1.4))
    return g(parts)


@asset("t-table-long", "furniture", [3, 1], "Feast table", "Stół biesiadny", tags=["table", "feast", "long", "stół", "uczta"])
def table_long(seed):
    s = Svg(300, 100, seed)
    s.add(table_top(s, 5, 8, 286, 80))
    s.add(ring_stain(40, 30, 7), ring_stain(250, 64, 6.5, 0.14))
    s.add(path(blob(190, 60, 12, 6, 8, 0.3, s.rng), fill="#6b3a0c", fill_opacity="0.22"))
    s.add(platter(s, 148, 48, 34, 24))
    s.add(roast_bird(s, 148, 48, 44, -8))
    for lx, ly in ((122, 30), (126, 66), (170, 28), (172, 68)):
        s.add(ellipse(lx, ly, 3, 1.8, fill="#4f8a2a", transform=f"rotate({s.rng.randint(0, 180)} {lx} {ly})"))
    s.add(bread_loaf(s, 96, 46, 15, 10, 0.3))
    s.add(apple_bowl(s, 208, 48, 13))
    s.add(knife(s, 170, 80, 26, -14))
    for (px, py, food) in ((52, 25, "stew"), (58, 71, "roast"), (246, 25, "bread"), (250, 70, "stew")):
        s.add(plate(s, px, py, 13, food))
    for (tx, ty, k, fl, a) in ((78, 20, "wood", "foam", -1.2), (82, 78, "pewter", "ale", 1.4), (222, 22, "wood", "ale", -2.0),
                               (272, 80, "wood", "foam", 0.8)):
        s.add(tankard(s, tx, ty, 7.5, k, fl, ang=a))
    s.add(candle(s, 118, 76, 3.8), candle(s, 186, 22, 3.8))
    return s.render()


# ------------------------------------------------------------------ bedroom


def quilt(s, x, y, w, h, rng):
    """Patchwork quilt in currentColor (tintable) with fixed light/dark patches and stitching."""
    d = smooth([(x, y), (x + w * 0.5, y + 1.2), (x + w, y), (x + w + 1.5, y + h * 0.5), (x + w + 0.5, y + h),
                (x + w * 0.5, y + h + 1.5), (x - 0.5, y + h), (x - 1.5, y + h * 0.5)])
    cl = s.clip(d)
    parts = [path(d, fill="currentColor", stroke=INK, stroke_width="1.3")]
    inner = []
    cols = max(2, round(w / 22))
    rows = max(2, round(h / 22))
    cw, ch = w / cols, h / rows
    lights, darks, motifs = [], [], []
    for r in range(rows + 1):
        for c in range(cols + 1):
            px, py = x + c * cw, y + r * ch
            k = (r + c) % 3
            if k == 0:
                lights.append(rect_d(px, py, cw, ch))
            elif k == 1:
                darks.append(rect_d(px, py, cw, ch))
            if (r + c) % 2 == 0:
                mx, my = px + cw / 2, py + ch / 2
                motifs.append(P([(mx, my - ch * 0.3), (mx + cw * 0.3, my), (mx, my + ch * 0.3), (mx - cw * 0.3, my)]))
    inner.append(path("".join(lights), fill="#fff", fill_opacity="0.16"))
    inner.append(path("".join(darks), fill="#000", fill_opacity="0.16"))
    inner.append(path("".join(motifs), fill="#f4e7c8", fill_opacity="0.3", stroke="#f4e7c8", stroke_opacity="0.5", stroke_width="0.5"))
    seams = "".join(f"M{f(x + c * cw)} {f(y)}V{f(y + h + 2)}" for c in range(1, cols)) + \
        "".join(f"M{f(x - 2)} {f(y + r * ch)}H{f(x + w + 2)}" for r in range(1, rows))
    inner.append(path(seams, stroke="#f4e7c8", stroke_opacity="0.55", stroke_width="0.6", stroke_dasharray="1.6 1.2", fill="none"))
    # soft folds
    folds = []
    for _ in range(3):
        fx = x + rng.uniform(0.15, 0.85) * w
        folds.append(f"M{f(fx)} {f(y + rng.uniform(4, h * 0.3))}Q{f(fx + rng.uniform(-10, 10))} {f(y + h * 0.6)} {f(fx + rng.uniform(-6, 6))} {f(y + h + 2)}")
    inner.append(path("".join(folds), fill="none", stroke="#000", stroke_opacity="0.13", stroke_width="3", stroke_linecap="round"))
    inner.append(path("".join(folds), fill="none", stroke="#fff", stroke_opacity="0.14", stroke_width="1.6", stroke_linecap="round",
                      transform="translate(-2 -1)"))
    inner.append(rect(x - 3, y - 3, w + 6, h + 6, fill=s.lg([(0, "#fff", 0.14), (0.5, "#fff", 0), (1, "#000", 0.25)], 0, 0, 1, 1)))
    parts.append(g(inner, clip_path=cl))
    return g(parts)


def pillow(s, x, y, w, h):
    d = smooth([(x + 3, y + 1), (x + w / 2, y + 2.5), (x + w - 3, y + 1), (x + w - 1, y + h / 2), (x + w - 3, y + h - 1),
                (x + w / 2, y + h - 2.5), (x + 3, y + h - 1), (x + 1, y + h / 2)])
    return g([
        shadow(d, 1.8, 2.6, 0.3),
        path(d, fill=s.rg([(0, "#ffffff"), (0.65, "#efe9dc"), (1, "#c9bfa9")], cx=0.45, cy=0.42, r=0.62), stroke="#6b604c", stroke_width="0.9"),
        path(f"M{f(x + 6)} {f(y + h * 0.3)}Q{f(x + w * 0.3)} {f(y + h * 0.5)} {f(x + w * 0.2)} {f(y + h * 0.8)}"
             f"M{f(x + w - 6)} {f(y + h * 0.25)}Q{f(x + w * 0.72)} {f(y + h * 0.45)} {f(x + w * 0.8)} {f(y + h * 0.75)}",
             fill="none", stroke="#8a7f68", stroke_opacity="0.45", stroke_width="0.8"),
        ellipse(x + w * 0.52, y + h * 0.5, w * 0.22, h * 0.2, fill="#b9ad94", fill_opacity="0.25"),
    ])


def bed(s, W, H, pillows, fur=False):
    rng = s.rng
    frame = rect_d(4, 4, W - 10, H - 10, 3)
    s.add(shadow(frame, 5, 6, 0.45))
    s.add(path(frame, fill=WALNUT, stroke=INK, stroke_width="1.8"))
    s.add(g(grain(5, 5, W - 12, H - 12, rng, horizontal=False, n=int(W / 6), op=0.3), clip_path=s.clip(frame)))
    s.add(path(rect_d(10, 16, W - 22, H - 28, 3), fill=s.lg([(0, "#efe7d4"), (1, "#cfc4ab")]), stroke="#5a4f3e", stroke_width="0.8"))
    # headboard with turned finial posts
    s.add(rect(4, 4, W - 10, 13, rx=2.5, fill=s.lg([(0, "#8a5a30"), (1, "#3d220e")]), stroke=INK, stroke_width="1.4"))
    s.add(path(f"M8 7H{W - 10}", stroke="#f0c890", stroke_opacity="0.35", stroke_width="0.9"))
    for px in (9.5, W - 11.5):
        for py, r in ((10, 6), (H - 11.5, 4.6)):
            s.add(shadow(circle_d(px, py, r), 1.4, 1.8, 0.4, soft=2))
            s.add(circle(px, py, r, fill=s.rg([(0, "#c08b52"), (0.7, "#6e4726"), (1, "#3d220e")], cx=0.35, cy=0.35), stroke=INK, stroke_width="1"))
            s.add(circle(px - r * 0.25, py - r * 0.25, r * 0.3, fill="#ffe2b8", fill_opacity="0.4"))
    s.add(rect(10, H - 16, W - 22, 5, rx=1.5, fill="#4f2f16", stroke=INK, stroke_width="0.9"))
    # pillows, sheet fold, quilt
    pw = (W - 22 - 8 * (pillows - 1) - 12) / pillows
    for i in range(pillows):
        s.add(pillow(s, 16 + i * (pw + 8), 22, pw, 30))
    s.add(quilt(s, 8, 70, W - 18, H - 88, rng))
    s.add(path(smooth([(7, 64), (W / 2, 66), (W - 9, 64), (W - 8, 72), (W / 2, 75), (8, 72)]), fill="#f6f1e6", stroke="#6b604c", stroke_width="0.9"))
    s.add(path(f"M9 71.5Q{W / 2} 74.5 {W - 9} 71.5", fill="none", stroke="#000", stroke_opacity="0.18", stroke_width="1.5"))
    s.add(path(f"M10 66Q{W / 2} 68 {W - 10} 66", fill="none", stroke="#b8ad95", stroke_width="0.6", stroke_dasharray="2 1.5"))
    if fur:
        fy = H - 50
        d = smooth([(6, fy), (W * 0.3, fy - 3), (W * 0.7, fy + 2), (W - 12, fy - 2), (W - 10, fy + 22), (W * 0.6, fy + 26), (W * 0.25, fy + 23), (5, fy + 26)])
        s.add(shadow(d, 1.5, 2.5, 0.35))
        s.add(path(d, fill=s.lg([(0, "#8a6440"), (1, "#4a3018")]), stroke="#2b1a10", stroke_width="1"))
        strokes_d, strokes_l = [], []
        for _ in range(260):
            x0, y0 = rng.uniform(8, W - 8), rng.uniform(fy + 1, fy + 23)
            a = rng.uniform(1.2, 1.9)
            seg = f"M{f(x0)} {f(y0)}l{f(math.cos(a) * 3)} {f(math.sin(a) * 3)}"
            (strokes_d if rng.random() < 0.55 else strokes_l).append(seg)
        s.add(g([path("".join(strokes_d), stroke="#2b1a10", stroke_opacity="0.55", stroke_width="0.6"),
                 path("".join(strokes_l), stroke="#c49a6a", stroke_opacity="0.45", stroke_width="0.5")], clip_path=s.clip(d), stroke_linecap="round"))


@asset("t-bed-single", "furniture", [1, 2], "Inn bed", "Łóżko", defaultTint="#7b2d26", tags=["bed", "inn", "room", "łóżko", "pokój"])
def bed_single(seed):
    s = Svg(100, 200, seed)
    bed(s, 100, 200, 1)
    return s.render()


@asset("t-bed-double", "furniture", [2, 2], "Double bed", "Łóżko podwójne", defaultTint="#2f5a7a", tags=["bed", "double", "inn", "łóżko"])
def bed_double(seed):
    s = Svg(200, 200, seed)
    bed(s, 200, 200, 2, fur=True)
    return s.render()


@asset("t-washstand", "furniture", [1, 0.6], "Washstand", "Umywalka", tags=["basin", "pitcher", "wash", "miednica", "dzbanek"])
def washstand(seed):
    s = Svg(100, 60, seed)
    top = rect_d(4, 5, 88, 48, 3)
    s.add(shadow(top, 4, 5, 0.42))
    s.add(path(top, fill=OAK_DARK, stroke=INK, stroke_width="1.5"))
    s.add(g(planks(s, 4, 5, 88, 48, 2, "#9a6a3c", horizontal=True, nails=False, joints=False, tone=0.05), clip_path=s.clip(top)))
    s.add(bevel(top))
    # basin
    s.add(shadow(circle_d(36, 29, 19), 2.5, 3.2, 0.42))
    s.add(circle(36, 29, 19, fill=s.rg([(0, "#fbf8f1"), (0.8, "#e2dccd"), (1, "#a79f8d")], cx=0.4, cy=0.4), stroke="#5b5146", stroke_width="1"))
    s.add(circle(36, 29, 17, fill="none", stroke="#2f5d8a", stroke_opacity="0.55", stroke_width="1"))
    s.add(circle(36, 29, 13.5, fill=s.rg([(0, "#b9d0d8"), (0.7, "#7fa0ad"), (1, "#56727d")], cx=0.6, cy=0.6)))
    s.add(path("M26 26Q30 20 38 19", fill="none", stroke="#fff", stroke_opacity="0.7", stroke_width="1.4", stroke_linecap="round"))
    s.add(circle(36, 29, 9, fill="none", stroke="#fff", stroke_opacity="0.25", stroke_width="0.6"))
    # pitcher with spout and handle
    s.add(shadow(circle_d(72, 22, 10), 2, 2.6, 0.42))
    s.add(path("M81 17h7a4 4 0 0 1 0 10h-7", fill="none", stroke="#5b5146", stroke_width="3.2"))
    s.add(path("M81 17h7a4 4 0 0 1 0 10h-7", fill="none", stroke="#d8cdb6", stroke_width="1.6"))
    s.add(path("M62.5 20L57 22L62.5 24.5Z", fill="#d8cdb6", stroke="#5b5146", stroke_width="0.8"))
    s.add(circle(72, 22, 10, fill=s.rg([(0, "#f5efe2"), (0.7, "#cdbf9f"), (1, "#8a7d62")], cx=0.38, cy=0.35), stroke="#5b5146", stroke_width="1"))
    s.add(circle(72, 22, 6.5, fill="#6b8a96", stroke="#5b5146", stroke_width="0.8"))
    s.add(circle(72, 22, 8.2, fill="none", stroke="#2f5d8a", stroke_opacity="0.5", stroke_width="0.9"))
    # soap and towel
    s.add(shadow(rect_d(66, 38, 11, 7, 2.5), 1, 1.4, 0.35, soft=2))
    s.add(rect(66, 38, 11, 7, rx=2.5, fill="#efe3bd", stroke="#8a7a4a", stroke_width="0.6"))
    s.add(path("M86 10H97V50H86Z", fill="#1b0f06", fill_opacity="0.25", transform="translate(1.5 1.5)"))
    s.add(path("M86 10H96Q98 30 96 50H86Q84 30 86 10Z", fill="#f1ece0", stroke="#6b604c", stroke_width="0.8"))
    s.add(path("M86 16H96M86 19H96M86 41H96M86 44H96", stroke="#a33a2c", stroke_width="1.1", stroke_opacity="0.8"))
    s.add(path("M89 10Q90 30 89 50", fill="none", stroke="#8a7f68", stroke_opacity="0.4", stroke_width="0.7"))
    return s.render()


# ------------------------------------------------------------------ innkeeper's desk


def ledger(s, cx, cy, w, h, ang):
    rng = s.rng
    tf = f"rotate({f(ang)} {f(cx)} {f(cy)})"
    x, y = cx - w / 2, cy - h / 2
    parts = [shadow(rect_d(x - 2, y - 2, w + 4, h + 4, 2), 2, 2.6, 0.4),
             rect(x - 2, y - 2, w + 4, h + 4, rx=2, fill="#6b1f1a", stroke=INK, stroke_width="0.9")]
    for side in (0, 1):
        px = x + side * w / 2
        parts.append(rect(px + (0.4 if side else 0), y, w / 2 - 0.4, h, fill=s.lg([(0, "#f5ecd6"), (1, "#e2d4b0")] if side else [(0, "#e2d4b0"), (1, "#f5ecd6")], 0, 0, 1, 0)))
        lines_ = []
        for i in range(int(h / 3.6) - 1):
            ly = y + 4 + i * 3.4
            lx = px + 3 + (1.5 if i % 5 == 0 else 0)
            lw = w / 2 - 7 - rng.uniform(0, 8 if i % 5 == 4 else 3)
            lines_.append(f"M{f(lx)} {f(ly)}h{f(lw * 0.55)}m{f(1.2)} 0h{f(lw * 0.45 - 1.2)}")
        parts.append(path("".join(lines_), stroke="#4a3520", stroke_opacity="0.55", stroke_width="0.55"))
        parts.append(path(f"M{f(px + w / 2 - 12)} {f(y + 3)}V{f(y + h - 3)}", stroke="#a33a2c", stroke_opacity="0.4", stroke_width="0.5"))
    parts.append(rect(cx - 3, y, 6, h, fill=s.lg([(0, "#000", 0), (0.5, "#000", 0.28), (1, "#000", 0)], 0, 0, 1, 0)))
    parts.append(path(f"M{f(cx + 5)} {f(y + h)}Q{f(cx + 7)} {f(y + h + 6)} {f(cx + 3)} {f(y + h + 10)}", fill="none", stroke="#a33a2c", stroke_width="1.2"))
    return g(parts, transform=tf)


def quill(s, x, y, L, ang):
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    vane = f"M{f(x)} {f(y)}Q{f(x + L * 0.3)} {f(y - L * 0.16)} {f(x + L)} {f(y - L * 0.05)}Q{f(x + L * 0.5)} {f(y + L * 0.09)} {f(x + L * 0.18)} {f(y + L * 0.02)}Z"
    barbs = "".join(f"M{f(x + L * t)} {f(y - L * 0.02 * t)}l{f(L * 0.06)} {f(-L * 0.08 * (1 - t))}" for t in [i / 14 for i in range(3, 14)])
    return g([
        path(vane, fill="#1b0f06", fill_opacity="0.3", transform="translate(1.5 2)"),
        path(vane, fill=s.lg([(0, "#fbf8f0"), (1, "#c9c1b0")]), stroke="#6b604c", stroke_width="0.5"),
        path(barbs, stroke="#9a907c", stroke_width="0.4"),
        path(f"M{f(x - L * 0.12)} {f(y + L * 0.02)}L{f(x + L)} {f(y - L * 0.05)}", stroke="#8a7f68", stroke_width="0.6"),
    ], transform=tf)


@asset("t-desk", "furniture", [1.5, 1], "Innkeeper's desk", "Biurko karczmarza", tags=["desk", "ledger", "quill", "biurko", "księga"])
def desk(seed):
    s = Svg(150, 100, seed)
    rng = s.rng
    top = rect_d(4, 6, 138, 86, 3)
    s.add(shadow(top, 5, 6, 0.45))
    s.add(path(top, fill="#4f2f16", stroke=INK, stroke_width="1.6"))
    s.add(g(planks(s, 4, 6, 138, 86, 4, "#6f4524", horizontal=True, nails=False, joints=False, tone=0.05), clip_path=s.clip(top)))
    s.add(bevel(top))
    # pigeonhole gallery along the back
    s.add(shadow(rect_d(8, 6, 130, 18, 1.5), 2, 3, 0.45))
    s.add(rect(8, 6, 130, 18, rx=1.5, fill="#3d220e", stroke=INK, stroke_width="1.1"))
    for i in range(6):
        px = 11 + i * 21
        s.add(rect(px, 9, 18, 12, fill="#1f1108"))
        kind = i % 3
        if kind == 0:
            for k in range(3):
                s.add(circle(px + 4 + k * 5, 15, 2.3, fill="#e8dcc0", stroke="#8a7a58", stroke_width="0.4"))
                s.add(circle(px + 4 + k * 5, 15, 0.9, fill="#b8a880"))
        elif kind == 1:
            s.add(rect(px + 1.5, 11, 15, 8, fill="#efe4c8", stroke="#8a7a58", stroke_width="0.4"))
            s.add(path(f"M{px + 3} 13h11M{px + 3} 15h9M{px + 3} 17h11", stroke="#6b5a40", stroke_width="0.4", stroke_opacity="0.6"))
        else:
            s.add(rect(px + 2, 11, 5, 8, fill="#6b1f1a"), rect(px + 7.5, 11, 4, 8, fill="#2f4d6b"), rect(px + 12, 11, 4.5, 8, fill="#35602c"))
        s.add(line(px + 19.5, 8, px + 19.5, 22, stroke="#6e4726", stroke_width="1.2"))
    s.add(path("M9 7.5H137", stroke="#f0c890", stroke_opacity="0.3", stroke_width="0.8"))
    s.add(ledger(s, 70, 57, 58, 38, -5))
    # inkwell + quill
    s.add(shadow(circle_d(112, 38, 5.5), 1.2, 1.6, 0.45, soft=2))
    s.add(circle(112, 38, 5.5, fill=s.rg([(0, "#5d6a86"), (1, "#101522")], cx=0.35, cy=0.35), stroke="#0a0c12", stroke_width="0.7"))
    s.add(circle(112, 38, 2.6, fill="#05070b"))
    s.add(quill(s, 112, 38, 30, 32))
    s.add(candle(s, 24, 40, 4.2))
    s.add(coins(s, 122, 76, 5, 5))
    # coin pouch
    d = smooth([(108, 72), (114, 66), (121, 68), (123, 76), (116, 84), (108, 82)])
    s.add(shadow(d, 1.5, 2, 0.4), path(d, fill="#7a5530", stroke=INK, stroke_width="0.9"))
    s.add(path("M111 70Q115 73 120 70", fill="none", stroke="#c9a36a", stroke_width="0.9"))
    # key ring
    s.add(circle(28, 76, 5, fill="none", stroke="#6b4f1c", stroke_width="1.6"), circle(28, 76, 5, fill="none", stroke="#e2c170", stroke_width="0.7"))
    for a, L in ((20, 14), (70, 11)):
        ra = math.radians(a)
        x0, y0 = 28 + math.cos(ra) * 5, 76 + math.sin(ra) * 5
        x1, y1 = x0 + math.cos(ra) * L, y0 + math.sin(ra) * L
        s.add(line(x0, y0, x1, y1, stroke="#8a6a24", stroke_width="1.6", stroke_linecap="round"))
        s.add(circle(x0 + math.cos(ra) * 2, y0 + math.sin(ra) * 2, 2, fill="none", stroke="#8a6a24", stroke_width="1.2"))
        s.add(rect(x1 - 1.5, y1 - 1.5, 3, 3, fill="#8a6a24", transform=f"rotate({a} {f(x1)} {f(y1)})"))
    # stick of sealing wax
    s.add(rect(38, 84, 16, 3.2, rx=1.2, fill="#a3161b", stroke="#4a0a0c", stroke_width="0.5", transform="rotate(-8 46 85)"))
    return s.render()


# ------------------------------------------------------------------ kitchen


def carrot_slices(s, cx, cy, n, spread):
    rng = s.rng
    parts = []
    for _ in range(n):
        x, y = cx + rng.uniform(-spread, spread), cy + rng.uniform(-spread, spread) * 0.6
        r = rng.uniform(1.8, 2.6)
        parts.append(circle(x, y, r, fill="#e8751a", stroke="#9a4a0c", stroke_width="0.35"))
        parts.append(circle(x, y, r * 0.45, fill="#f5a04a"))
    return g(parts)


def onion_half(s, cx, cy, r):
    parts = [shadow(circle_d(cx, cy, r), 0.8, 1.2, 0.35, soft=2), circle(cx, cy, r, fill="#f3e9d8", stroke="#9a6a3c", stroke_width="0.6")]
    for k in (0.75, 0.52, 0.3):
        parts.append(circle(cx, cy, r * k, fill="none", stroke="#c9a8c4", stroke_width="0.5"))
    return g(parts)


def cleaver(s, x, y, ang):
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    return g([shadow(rect_d(x, y - 7, 26, 14, 1.5), 1.2, 1.8, 0.4, soft=2),
              path(f"M{f(x)} {f(y - 7)}H{f(x + 18)}L{f(x + 19)} {f(y + 7)}H{f(x)}Z", fill=s.lg([(0, "#dfe3e6"), (1, "#7d848b")]),
                   stroke="#2f3438", stroke_width="0.6"),
              circle(x + 4, y - 3.5, 1.3, fill="#2f3438"),
              path(f"M{f(x + 0.8)} {f(y + 6)}H{f(x + 18)}", stroke="#fff", stroke_opacity="0.6", stroke_width="0.8"),
              rect(x + 18, y - 2.2, 16, 4.4, rx=1.8, fill="#4f2f16", stroke=INK, stroke_width="0.6"),
              circle(x + 24, y, 0.7, fill="#d9c9a0"), circle(x + 30, y, 0.7, fill="#d9c9a0")], transform=tf)


@asset("t-prep-table", "furniture", [2, 1], "Kitchen worktable", "Stół kuchenny", tags=["kitchen", "table", "cook", "kuchnia", "stół"])
def prep_table(seed):
    s = Svg(200, 100, seed)
    rng = s.rng
    top = rect_d(4, 6, 188, 84, 3)
    s.add(shadow(top, 5, 6, 0.45))
    s.add(path(top, fill="#7a5230", stroke=INK, stroke_width="1.6"))
    cl = s.clip(top)
    strips = []
    x = 4
    while x < 192:
        w = rng.uniform(7, 11)
        strips.append(rect(x, 6, w, 84, fill=vary("#b08050", rng, l=0.07)))
        strips.append(grain(x + 1, 7, w - 2, 82, rng, horizontal=False, n=2, op=0.3))
        strips.append(line(x, 6, x, 90, stroke="#3d220e", stroke_width="0.5", stroke_opacity="0.7"))
        x += w
    scars = "".join(f"M{f(a)} {f(b)}l{f(rng.uniform(-6, 6))} {f(rng.uniform(-2, 2))}" for a, b in
                    [(rng.uniform(10, 185), rng.uniform(12, 85)) for _ in range(40)])
    strips.append(path(scars, stroke="#3d220e", stroke_opacity="0.4", stroke_width="0.45"))
    strips.append(speckle(s, 110, 20, 60, 40, 60, ["#ffffff"], 0.3, 1.0, 0.35))
    strips.append(path(blob(140, 42, 26, 14, 9, 0.35, rng), fill="#fff", fill_opacity="0.14"))
    s.add(g(strips, clip_path=cl))
    s.add(bevel(top))
    # cutting board with carrots, onion and knife
    s.add(shadow(rect_d(14, 16, 64, 40, 5), 2.5, 3, 0.45))
    s.add(rect(14, 16, 64, 40, rx=5, fill="#c49a64", stroke="#5a381a", stroke_width="1"))
    s.add(grain(16, 18, 60, 36, rng, n=7, op=0.35))
    s.add(circle(72, 22, 2.2, fill="none", stroke="#5a381a", stroke_width="1"))
    s.add(carrot_slices(s, 36, 34, 12, 9))
    for i in range(2):
        cx, cy = 22 + i * 4, 48 - i * 3
        s.add(path(f"M{cx} {cy}l20 -4l-19 7z", fill="#e8751a", stroke="#9a4a0c", stroke_width="0.5"))
    s.add(path("M20 49l-5 -3M20 49l-6 1M20 49l-4 3", stroke="#4f8a2a", stroke_width="1.2", stroke_linecap="round"))
    s.add(onion_half(s, 60, 44, 6), onion_half(s, 66, 32, 5.2))
    s.add(knife(s, 30, 64, 34, -4))
    # mixing bowl with dough
    s.add(shadow(circle_d(118, 40, 19), 3, 3.6, 0.45))
    s.add(circle(118, 40, 19, fill=s.rg([(0, "#d8c7a8"), (0.8, "#a58e68"), (1, "#5d4a30")], cx=0.62, cy=0.62, r=0.6), stroke=INK, stroke_width="1.1"))
    s.add(circle(118, 40, 15.5, fill="#6b5534", fill_opacity="0.5"))
    s.add(path(blob(119, 41, 12, 11, 9, 0.08, rng), fill=s.rg([(0, "#fff7e6"), (1, "#e3cfa8")], cx=0.4, cy=0.4), stroke="#b89a6a", stroke_width="0.6"))
    s.add(path("M112 38q4 -3 9 0", fill="none", stroke="#c9ad7c", stroke_width="0.7"))
    s.add(circle(118, 40, 19, fill="none", stroke="#2f5d8a", stroke_opacity="0.45", stroke_width="1.4", stroke_dasharray="3 2"))
    # egg basket
    s.add(shadow(circle_d(132, 72, 11), 2, 2.6, 0.45))
    s.add(circle(132, 72, 11, fill="#a8783e", stroke="#4a2c12", stroke_width="1"))
    s.add(circle(132, 72, 11, fill="none", stroke="#6e4726", stroke_width="2.4", stroke_dasharray="1.6 1.4"))
    for dx, dy in ((-4, -3), (3, -4), (-3, 4), (4, 3), (0, 0)):
        s.add(ellipse(132 + dx, 72 + dy, 3.4, 2.6, fill=s.rg([(0, "#fffaf0"), (1, "#d9c3a0")], cx=0.35, cy=0.35), stroke="#8a7a58", stroke_width="0.4"))
    # herbs, garlic, cleaver
    for k in range(7):
        a = -0.9 + k * 0.28
        x0, y0 = 172, 80
        x1, y1 = x0 + math.cos(a) * 16, y0 + math.sin(a) * 16 - 6
        s.add(line(x0, y0, x1, y1, stroke="#3f6a1f", stroke_width="0.7"))
        s.add(ellipse(x1, y1, 3.2, 1.6, fill=rng.choice(["#5c8f2d", "#4f7f26", "#6fa33a"]), transform=f"rotate({f(math.degrees(a))} {f(x1)} {f(y1)})"))
    s.add(rect(168, 78, 7, 3, rx=1, fill="#c9b27a", transform="rotate(-20 171 79)"))
    s.add(path(blob(156, 64, 4.5, 4.2, 7, 0.1, rng), fill="#f1eadb", stroke="#9a8f7a", stroke_width="0.5"))
    s.add(path("M156 60v8M153 61.5q3 3 0 6M159 61.5q-3 3 0 6", fill="none", stroke="#b8ad95", stroke_width="0.4"))
    s.add(cleaver(s, 150, 26, 12))
    return s.render()


@asset("t-cauldron", "furniture", [1, 1], "Cooking cauldron", "Kocioł", tags=["cauldron", "fire", "stew", "kitchen", "kocioł", "ognisko"])
def cauldron(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx = cy = 48
    # fire glow and ring of stones
    s.add(circle(cx, cy, 47, fill=s.rg([(0, "#ffb347", 0.5), (0.6, "#ff7a1a", 0.18), (1, "#ff5a00", 0)])))
    s.add(circle(cx, cy, 36, fill="#2a1a10"))
    s.add(speckle(s, cx - 34, cy - 34, 68, 68, 50, ["#ff8a2a", "#ffcf5a", "#c0391b"], 0.4, 1.1, 0.9, clip=s.clip(circle_d(cx, cy, 34))))
    for a in range(0, 360, 60):
        r = math.radians(a + 20)
        x0, y0 = cx + math.cos(r) * 18, cy + math.sin(r) * 18
        x1, y1 = cx + math.cos(r) * 36, cy + math.sin(r) * 36
        s.add(line(x0, y0, x1, y1, stroke="#3a2412", stroke_width="5.2", stroke_linecap="round"))
        s.add(line(x0, y0, x1, y1, stroke="#6b4424", stroke_width="3", stroke_linecap="round"))
        s.add(line(x1 - (x1 - x0) * 0.3, y1 - (y1 - y0) * 0.3, x1, y1, stroke="#ff7a1a", stroke_width="1.6", stroke_linecap="round",
                   stroke_opacity="0.8"))
    for i in range(12):
        a = 2 * math.pi * i / 12 + rng.uniform(-0.08, 0.08)
        x, y = cx + math.cos(a) * 40, cy + math.sin(a) * 40
        d = blob(x, y, 6.6, 5.6, 7, 0.18, rng, rot=a)
        s.add(shadow(d, 1.5, 2, 0.4, soft=2))
        s.add(path(d, fill=s.rg([(0, "#a19a90"), (0.7, "#6f6a62"), (1, "#45413c")], cx=0.35, cy=0.35), stroke="#27231f", stroke_width="0.8"))
        s.add(path(d, fill=s.rg([(0, "#ff9a3c", 0.45), (1, "#ff9a3c", 0)], cx=0.5 - math.cos(a) * 0.5, cy=0.5 - math.sin(a) * 0.5, r=0.6)))
    # flames licking out from under the pot
    for a in (0.4, 2.2, 3.9, 5.3):
        s.add(flame(cx + math.cos(a) * 28, cy + math.sin(a) * 28, 4.2, rng, s))
    # cauldron
    s.add(shadow(circle_d(cx, cy, 26), 3, 4, 0.5))
    for sgn in (-1, 1):
        s.add(rect(cx + sgn * 27 - 3, cy - 3, 6, 6, rx=1.5, fill="#2b2b2e", stroke="#0e0e10", stroke_width="0.8"))
    s.add(circle(cx, cy, 26, fill=s.rg([(0, "#6a6a70"), (0.55, "#2e2e33"), (1, "#111114")], cx=0.35, cy=0.33), stroke="#0a0a0c", stroke_width="1.4"))
    s.add(circle(cx, cy, 22.5, fill="#151518", stroke="#55555c", stroke_width="1.4"))
    stew = s.rg([(0, "#c26a2c"), (0.7, "#8a3f16"), (1, "#4f200a")], cx=0.42, cy=0.4, r=0.6)
    s.add(circle(cx, cy, 20.5, fill=stew))
    for _ in range(12):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, 15)
        c = rng.choice(["#e39a3c", "#f1d08a", "#6b8f2a", "#a8421a", "#d9892f"])
        s.add(path(blob(cx + math.cos(a) * d, cy + math.sin(a) * d, 2, 1.6, 5, 0.3, rng), fill=c))
    for _ in range(7):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, 16)
        r = rng.uniform(0.8, 2)
        s.add(circle(cx + math.cos(a) * d, cy + math.sin(a) * d, r, fill="none", stroke="#f5c07a", stroke_width="0.5", stroke_opacity="0.8"))
    s.add(ellipse(cx - 8, cy - 9, 7, 2.4, fill="#fff", fill_opacity="0.25", transform=f"rotate(-40 {cx - 8} {cy - 9})"))
    # ladle + bail handle
    s.add(line(cx + 4, cy + 3, cx + 34, cy - 20, stroke="#1b0f06", stroke_width="3.6", stroke_opacity="0.35", transform="translate(1.5 2)"))
    s.add(line(cx + 4, cy + 3, cx + 34, cy - 20, stroke="#5a381a", stroke_width="3", stroke_linecap="round"))
    s.add(line(cx + 5, cy + 2, cx + 33, cy - 19.6, stroke="#c49058", stroke_width="0.9", stroke_linecap="round", stroke_opacity="0.7"))
    s.add(path(f"M{cx - 27} {cy}Q{cx} {cy + 38} {cx + 27} {cy}", fill="none", stroke="#1b1b1e", stroke_width="2.2"))
    s.add(path(f"M{cx - 27} {cy}Q{cx} {cy + 38} {cx + 27} {cy}", fill="none", stroke="#8a8a92", stroke_width="0.6", stroke_opacity="0.7"))
    return s.render()


# ------------------------------------------------------------------ rugs


def fur_strokes(s, d, pts_fn, n, dark="#1f130a", light="#a37a4c", L=(3, 6)):
    rng = s.rng
    darks, lights = [], []
    for _ in range(n):
        x, y, a = pts_fn(rng)
        l = rng.uniform(*L)
        seg = f"M{f(x)} {f(y)}q{f(math.cos(a + 0.5) * l * 0.5)} {f(math.sin(a + 0.5) * l * 0.5)} {f(math.cos(a) * l)} {f(math.sin(a) * l)}"
        (darks if rng.random() < 0.55 else lights).append(seg)
    return g([path("".join(darks), stroke=dark, stroke_opacity="0.5", stroke_width="0.7", fill="none"),
              path("".join(lights), stroke=light, stroke_opacity="0.45", stroke_width="0.6", fill="none")],
             clip_path=s.clip(d), stroke_linecap="round")


@asset("t-bearskin-rug", "furniture", [2, 2.5], "Bearskin rug", "Skóra niedźwiedzia", layer="terrain",
       tags=["rug", "bear", "fur", "pelt", "dywan", "niedźwiedź"])
def bearskin(seed):
    s = Svg(200, 250, seed)
    rng = s.rng
    right = [(113, 70), (126, 78), (146, 64), (166, 48), (182, 38), (194, 42), (192, 54), (176, 62), (156, 84), (142, 104), (136, 128),
             (138, 152), (146, 172), (166, 188), (184, 204), (192, 218), (184, 228), (166, 222), (146, 210), (126, 216), (112, 228), (104, 240)]
    left = [(200 - x, y) for x, y in reversed(right)]
    pts = right + [(100, 244)] + left
    d = smooth(pts)
    # felt backing with pinked edge
    s.add(shadow(d, 3, 4, 0.35))
    s.add(path(d, fill="#6b1a16", stroke="#6b1a16", stroke_width="10", stroke_linejoin="round"))
    s.add(path(d, fill="none", stroke="#8a2a22", stroke_width="12", stroke_dasharray="0 5.5", stroke_linecap="round"))
    s.add(path(d, fill="none", stroke="#c9a14a", stroke_width="0.8", transform="translate(0 0)", stroke_dasharray="2 2", stroke_opacity="0.7"))
    s.add(path(d, fill=s.rg([(0, "#7a5230"), (0.6, "#553520"), (1, "#2e1c10")], cx=0.5, cy=0.5, r=0.55), stroke="#1b0f06", stroke_width="1.2"))

    def fpt(r):
        # points inside the pelt bounding area; direction away from the spine and slightly toward the tail
        while True:
            x, y = r.uniform(12, 188), r.uniform(40, 240)
            if abs(x - 100) < 42 or y < 100 or y > 176:
                break
        a = math.atan2(0.35, (x - 100) / 60) if abs(x - 100) > 4 else math.pi / 2
        return x, y, a + r.uniform(-0.35, 0.35)
    s.add(fur_strokes(s, d, fpt, 1000))
    # darker spine stripe and paws/claws
    s.add(g([path("M100 70Q97 150 100 236", stroke="#1f130a", stroke_opacity="0.14", stroke_width=w, fill="none", stroke_linecap="round")
             for w in ("26", "16", "8")], clip_path=s.clip(d)))
    for (px, py, a) in ((186, 48, -0.3), (14, 48, math.pi + 0.3), (182, 216, 0.4), (18, 216, math.pi - 0.4)):
        for k in (-1, 0, 1):
            aa = a + k * 0.35
            x0, y0 = px + math.cos(aa) * 4, py + math.sin(aa) * 4
            x1, y1 = px + math.cos(aa) * 10, py + math.sin(aa) * 10
            s.add(path(f"M{f(x0)} {f(y0)}Q{f((x0 + x1) / 2 + math.cos(aa + 1.2) * 1.5)} {f((y0 + y1) / 2 + math.sin(aa + 1.2) * 1.5)} {f(x1)} {f(y1)}",
                       stroke="#efe4c8", stroke_width="1.8", stroke_linecap="round", fill="none"))
            s.add(path(f"M{f(x0)} {f(y0)}L{f(x1)} {f(y1)}", stroke="#6b604c", stroke_width="0.5", stroke_linecap="round", fill="none"))
    # the head
    head = smooth([(100, 14), (112, 18), (120, 32), (126, 50), (122, 68), (110, 78), (100, 80), (90, 78), (78, 68), (74, 50), (80, 32), (88, 18)])
    s.add(shadow(head, 3, 4, 0.5))
    for ex in (78, 122):
        s.add(circle(ex, 70, 8, fill="#3a2414", stroke="#1b0f06", stroke_width="1"))
        s.add(circle(ex, 70, 4.5, fill="#6b4a36"))
    s.add(path(head, fill=s.rg([(0, "#8a6440"), (0.6, "#5a3a22"), (1, "#2e1c10")], cx=0.45, cy=0.45, r=0.6), stroke="#1b0f06", stroke_width="1.2"))

    def hpt(r):
        x, y = r.uniform(76, 124), r.uniform(16, 78)
        a = math.atan2(y - 60, x - 100) + math.pi + r.uniform(-0.3, 0.3)
        return x, y, a
    s.add(fur_strokes(s, head, hpt, 260, L=(2, 4)))
    muzzle = smooth([(100, 12), (109, 16), (113, 28), (110, 40), (100, 44), (90, 40), (87, 28), (91, 16)])
    s.add(path(muzzle, fill=s.rg([(0, "#b08a62"), (1, "#6b4a30")], cx=0.45, cy=0.35), stroke="#2e1c10", stroke_width="0.8"))
    s.add(path("M93 15Q100 9 107 15Q108 21 100 23Q92 21 93 15Z", fill="#141010", stroke="#000", stroke_width="0.6"))
    s.add(ellipse(97, 14.5, 2.2, 1.2, fill="#fff", fill_opacity="0.4"))
    s.add(path("M100 23V30M100 30Q95 34 91 32M100 30Q105 34 109 32", fill="none", stroke="#2e1c10", stroke_width="0.9"))
    for ex in (88, 112):
        s.add(ellipse(ex, 46, 3.2, 2.6, fill="#241406"))
        s.add(ellipse(ex, 46, 2.3, 1.9, fill=s.rg([(0, "#e0a030"), (1, "#5a3006")], cx=0.4, cy=0.4)))
        s.add(circle(ex, 46, 0.9, fill="#050302"), circle(ex - 0.8, 45.2, 0.55, fill="#fff"))
    return s.render()


@asset("t-rug-braided", "furniture", [2, 2], "Braided rug", "Dywanik pleciony", layer="terrain", defaultTint="#3f6e8c",
       tags=["rug", "carpet", "round", "dywan", "chodnik"])
def rug_braided(seed):
    s = Svg(200, 200, seed)
    cx, cy = 100, 100
    outer = ellipse_d(cx, cy, 94, 80)
    s.add(shadow(outer, 1.5, 2, 0.28, soft=2))
    colors = ["currentColor", "#d9c7a0", "#6b3a24", "currentColor", "#b89a5a", "currentColor", "#d9c7a0", "#4a4a3a"]
    k = 0
    rx, ry = 94, 80
    w = 7.2
    while rx > 8 and ry > 10:
        c = colors[k % len(colors)]
        s.add(ellipse(cx, cy, rx - w / 2, ry - w / 2, fill="none", stroke=c, stroke_width=f2(w)))
        # braid twists: short diagonal strands alternating light/dark
        circ = math.pi * (3 * (rx + ry) - math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
        dash = circ / max(12, round(circ / 6))
        s.add(ellipse(cx, cy, rx - w / 2, ry - w / 2, fill="none", stroke="#000", stroke_opacity="0.22", stroke_width=f2(w),
                      stroke_dasharray=f"{f2(dash * 0.35)} {f2(dash * 0.65)}"))
        s.add(ellipse(cx, cy, rx - w * 0.3, ry - w * 0.3, fill="none", stroke="#fff", stroke_opacity="0.2", stroke_width=f2(w * 0.3),
                      stroke_dasharray=f"{f2(dash * 0.4)} {f2(dash * 0.6)}", stroke_dashoffset=f2(dash * 0.5)))
        s.add(ellipse(cx, cy, rx - w, ry - w, fill="none", stroke="#2a1a10", stroke_opacity="0.45", stroke_width="0.6"))
        rx -= w
        ry -= w
        k += 1
    s.add(ellipse(cx, cy, rx, ry, fill=colors[k % len(colors)]))
    s.add(path(outer, fill="none", stroke="#2a1a10", stroke_width="1.2", stroke_opacity="0.8"))
    s.add(ellipse(cx, cy, 94, 80, fill=s.rg([(0, "#fff", 0.1), (0.6, "#fff", 0), (1, "#000", 0.25)], cx=0.42, cy=0.4, r=0.6)))
    return s.render()


# ------------------------------------------------------------------ storage


def crate(s, x, y, w, h, ang, mark=True):
    rng = s.rng
    cx, cy = x + w / 2, y + h / 2
    tf = f"rotate({f(ang)} {f(cx)} {f(cy)})"
    d = rect_d(x, y, w, h, 1.5)
    base = vary("#b0844f", rng, l=0.04)
    parts = [shadow(d, 5, 6, 0.45)]
    inner = [rect(x, y, w, h, fill="#2a170a")]
    n = 5
    gap = 1.6
    sw = (h - 2 * 9 - gap * (n - 1)) / n
    for i in range(n):
        by = y + 9 + i * (sw + gap)
        inner.append(rect(x + 9, by, w - 18, sw, fill=vary(base, rng, l=0.06)))
        inner.append(grain(x + 10, by + 0.5, w - 20, sw - 1, rng, n=2, op=0.35))
    # frame boards (lighter, on top), diagonal brace
    fr = shade(base, 0.04)
    for (bx, by, bw, bh, hor) in ((x, y, w, 9, True), (x, y + h - 9, w, 9, True), (x, y, 9, h, False), (x + w - 9, y, 9, h, False)):
        inner.append(rect(bx, by, bw, bh, fill=vary(fr, rng, l=0.04), stroke="#3d220e", stroke_width="0.7"))
        inner.append(grain(bx + 0.8, by + 0.8, bw - 1.6, bh - 1.6, rng, horizontal=hor, n=2, op=0.35))
    brace = P([(x + 9, y + h - 15), (x + 15, y + h - 9), (x + w - 9, y + 15), (x + w - 15, y + 9)])
    inner.append(path(brace, fill=vary(fr, rng, l=0.04), stroke="#3d220e", stroke_width="0.7"))
    inner.append(path(f"M{f(x + 12)} {f(y + h - 12)}L{f(x + w - 12)} {f(y + 12)}", stroke="#3b2210", stroke_opacity="0.3", stroke_width="0.6"))
    for nx, ny in ((x + 4.5, y + 4.5), (x + w - 4.5, y + 4.5), (x + 4.5, y + h - 4.5), (x + w - 4.5, y + h - 4.5)):
        inner.append(circle(nx - 1.5, ny, 0.7, fill="#222"))
        inner.append(circle(nx + 1.5, ny, 0.7, fill="#222"))
    if mark:
        mx, my = cx + w * 0.12, cy + h * 0.12
        inner.append(g([circle(mx, my, 7, fill="none", stroke="#1b0f06", stroke_width="1.6"),
                        path(f"M{f(mx - 5)} {f(my)}H{f(mx + 5)}M{f(mx)} {f(my - 5)}V{f(my + 5)}", stroke="#1b0f06", stroke_width="1.6")],
                       opacity="0.45"))
    parts.append(g(inner, clip_path=s.clip(d)))
    parts.append(path(d, fill="none", stroke=INK, stroke_width="1.4"))
    parts.append(bevel(d, lo=0.22, do=0.2, w=1.2))
    return g(parts, transform=tf)


def sack(s, cx, cy, r, ang=0.0, color="#b89a6a", spill=False):
    rng = s.rng
    d = blob(cx, cy, r, r * 0.92, 11, 0.07, rng, rot=ang)
    parts = [shadow(d, r * 0.18, r * 0.24, 0.45)]
    parts.append(path(d, fill=s.rg([(0, shade(color, 0.12)), (0.65, color), (1, shade(color, -0.25))], cx=0.4, cy=0.38, r=0.62),
                      stroke="#3d2c18", stroke_width="1.1"))
    cl = s.clip(d)
    hatch = []
    step = 1.6
    k = -r
    while k < r:
        hatch.append(f"M{f(cx - r)} {f(cy + k)}h{f(2 * r)}")
        hatch.append(f"M{f(cx + k)} {f(cy - r)}v{f(2 * r)}")
        k += step
    folds = []
    for i in range(7):
        a = ang + 2 * math.pi * i / 7 + rng.uniform(-0.2, 0.2)
        folds.append(f"M{f(cx)} {f(cy)}Q{f(cx + math.cos(a + 0.3) * r * 0.5)} {f(cy + math.sin(a + 0.3) * r * 0.5)} "
                     f"{f(cx + math.cos(a) * r * 0.92)} {f(cy + math.sin(a) * r * 0.92)}")
    parts.append(g([path("".join(hatch), stroke="#5a4428", stroke_opacity="0.18", stroke_width="0.45", transform=f"rotate({f(math.degrees(ang) + 12)} {f(cx)} {f(cy)})"),
                    path("".join(folds), fill="none", stroke="#3d2c18", stroke_opacity="0.35", stroke_width="1.4"),
                    path("".join(folds), fill="none", stroke="#fff", stroke_opacity="0.18", stroke_width="0.8", transform="translate(-0.8 -0.8)")],
                   clip_path=cl))
    # gathered, tied neck
    parts.append(path(blob(cx, cy, r * 0.3, r * 0.28, 8, 0.25, rng), fill=shade(color, -0.1), stroke="#3d2c18", stroke_width="0.8"))
    parts.append(circle(cx, cy, r * 0.17, fill="none", stroke="#6b4f2a", stroke_width=f2(r * 0.09)))
    parts.append(path(f"M{f(cx + r * 0.1)} {f(cy + r * 0.12)}q{f(r * 0.2)} {f(r * 0.3)} {f(r * 0.1)} {f(r * 0.5)}", fill="none",
                      stroke="#6b4f2a", stroke_width=f2(r * 0.06), stroke_linecap="round"))
    return g(parts)


@asset("t-crates", "furniture", [2, 2], "Stacked crates", "Stos skrzyń", tags=["crate", "storage", "cargo", "skrzynia", "magazyn"])
def crates(seed):
    s = Svg(200, 200, seed)
    s.add(crate(s, 10, 96, 84, 84, -5))
    s.add(crate(s, 100, 104, 80, 80, 7, mark=False))
    s.add(sack(s, 160, 44, 26, 0.4))
    s.add(crate(s, 34, 20, 90, 90, 3))
    return s.render()


@asset("t-sacks", "furniture", [1, 1], "Grain sacks", "Worki zboża", tags=["sack", "grain", "flour", "worek", "zboże", "mąka"])
def sacks(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    s.add(sack(s, 30, 62, 22, 0.8, "#b39463"))
    grains = "".join(ellipse_d(rng.uniform(48, 92), rng.uniform(70, 96), 0.9, 0.6) for _ in range(70))
    s.add(path(grains, fill="#e0bf6a", stroke="#8a6a24", stroke_width="0.2"))
    s.add(sack(s, 66, 70, 17, 2.2, "#c2a472"))
    s.add(sack(s, 56, 32, 24, 1.6, "#a88b5c"))
    return s.render()


@asset("t-woodpile", "furniture", [2, 1], "Firewood stack", "Stos drewna", tags=["wood", "logs", "firewood", "drewno", "polana"])
def woodpile(seed):
    s = Svg(200, 100, seed)
    rng = s.rng

    def log(x, y, L, r, split=False):
        d = rect_d(x, y - r, L, 2 * r, r * 0.9)
        parts = [shadow(d, 2.5, 3.2, 0.42, soft=2)]
        if split:
            parts.append(path(d, fill=s.lg([(0, "#e8c690"), (1, "#b88a52")]), stroke="#5a3a1c", stroke_width="0.9"))
            parts.append(grain(x + 2, y - r + 1, L - 4, 2 * r - 2, rng, n=4, op=0.4, color="#8a5a2c"))
            parts.append(path(f"M{f(x + 1)} {f(y + r - 1.5)}H{f(x + L - 1)}", stroke="#4a2c14", stroke_width="2.2"))
        else:
            parts.append(path(d, fill=s.lg([(0, "#8a6a4a"), (0.35, "#6b4f36"), (1, "#2e2014")]), stroke="#1f140a", stroke_width="0.9"))
            bark = []
            for _ in range(int(L / 5)):
                bx = x + rng.uniform(3, L - 8)
                by = y + rng.uniform(-r * 0.75, r * 0.75)
                bark.append(f"M{f(bx)} {f(by)}h{f(rng.uniform(3, 9))}")
            parts.append(path("".join(bark), stroke="#1f140a", stroke_opacity="0.6", stroke_width="0.7", stroke_linecap="round"))
            parts.append(path(f"M{f(x + 3)} {f(y - r * 0.55)}H{f(x + L - 3)}", stroke="#b8946a", stroke_opacity="0.35", stroke_width="0.9"))
            if rng.random() < 0.4:
                parts.append(ellipse(x + rng.uniform(10, L - 10), y + rng.uniform(-2, 2), 2.4, 1.6, fill="#3a2a1a", stroke="#1f140a", stroke_width="0.4"))
        # the sawn end showing at the right
        parts.append(ellipse(x + L - 1.2, y, 2.2, r * 0.92, fill="#d9b27a", stroke="#5a3a1c", stroke_width="0.6"))
        return g(parts)

    y = 16
    while y < 88:
        r = rng.uniform(5, 6.6)
        x0 = rng.uniform(4, 12)
        s.add(log(x0, y + r, rng.uniform(170, 184) - x0, r, split=rng.random() < 0.3))
        y += 2 * r + rng.uniform(-0.8, 0.4)
    # a shorter second course resting in the grooves of the first
    y = 26
    for _ in range(4):
        r = rng.uniform(5.2, 6.2)
        x0 = rng.uniform(34, 50)
        s.add(g([rect(x0 + 3, y + r - r + 4, 124, 2 * r, rx=r, fill="#1b0f06", fill_opacity="0.3"),
                 log(x0, y + r, rng.uniform(118, 132), r, split=rng.random() < 0.35)]))
        y += 2 * r + 3.5
    return s.render()


# ------------------------------------------------------------------ lighting & bath


@asset("t-chandelier", "furniture", [2, 2], "Wagon-wheel chandelier", "Żyrandol z koła", tags=["light", "chandelier", "candles", "żyrandol", "świece"])
def chandelier(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    cx = cy = 98
    s.add(circle(cx, cy, 98, fill=s.rg([(0, "#ffd27a", 0.3), (0.55, "#ffb04a", 0.12), (1, "#ff9020", 0)])))
    wheel = circle_d(cx, cy, 74) + circle_d(cx, cy, 64)[:-1]
    s.add(shadow(circle_d(cx, cy, 74), 8, 10, 0.25, soft=3))
    # spokes
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.pi / 8
        x0, y0 = cx + math.cos(a) * 12, cy + math.sin(a) * 12
        x1, y1 = cx + math.cos(a) * 66, cy + math.sin(a) * 66
        s.add(line(x0 + 5, y0 + 6, x1 + 5, y1 + 6, stroke="#1b0f06", stroke_opacity="0.2", stroke_width="7"))
        s.add(line(x0, y0, x1, y1, stroke="#3d220e", stroke_width="6.5", stroke_linecap="round"))
        s.add(line(x0, y0, x1, y1, stroke="#8a5a30", stroke_width="4.5", stroke_linecap="round"))
        s.add(line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, stroke="#e0b07a", stroke_width="1", stroke_opacity="0.45"))
    # felloe (rim) with an iron tyre
    s.add(path(circle_d(cx, cy, 72), fill="none", stroke="#3d220e", stroke_width="13"))
    s.add(path(circle_d(cx, cy, 72), fill="none", stroke=s.lg([(0, "#b07a44"), (1, "#5a381a")], 0, 0, 1, 1), stroke_width="10"))
    joints = []
    for i in range(8):
        a = 2 * math.pi * i / 8
        joints.append(f"M{f(cx + math.cos(a) * 67)} {f(cy + math.sin(a) * 67)}L{f(cx + math.cos(a) * 77)} {f(cy + math.sin(a) * 77)}")
    s.add(path("".join(joints), stroke="#2a170a", stroke_width="1"))
    s.add(circle(cx, cy, 78.5, fill="none", stroke="#2e2e32", stroke_width="3.2"))
    s.add(circle(cx, cy, 78.5, fill="none", stroke="#a9aeb3", stroke_width="0.8", stroke_opacity="0.6", stroke_dasharray="60 40 90 300",
                 transform=f"rotate(170 {cx} {cy})"))
    # hub + chains up to the ceiling hook
    s.add(circle(cx, cy, 14, fill=s.rg([(0, "#b07a44"), (1, "#3d220e")], cx=0.35, cy=0.35), stroke=INK, stroke_width="1.4"))
    s.add(circle(cx, cy, 8, fill="#2e2e32", stroke="#111", stroke_width="1"))
    for i in range(4):
        a = 2 * math.pi * i / 4 + math.pi / 4
        x1, y1 = cx + math.cos(a) * 70, cy + math.sin(a) * 70
        s.add(line(cx, cy, x1, y1, stroke="#1b1b1e", stroke_width="2.4", stroke_dasharray="3 1.4", stroke_linecap="round"))
        s.add(line(cx, cy, x1, y1, stroke="#8a8a92", stroke_width="0.8", stroke_dasharray="3 1.4", stroke_opacity="0.8"))
    s.add(circle(cx, cy, 3.4, fill="#8a8a92", stroke="#111", stroke_width="0.8"))
    # candles on the rim
    for i in range(8):
        a = 2 * math.pi * i / 8
        s.add(candle(s, cx + math.cos(a) * 72, cy + math.sin(a) * 72, 3.6, holder=True, glow=True))
    # wax drips on the rim
    for _ in range(14):
        a = rng.uniform(0, 6.28)
        s.add(ellipse(cx + math.cos(a) * 72, cy + math.sin(a) * 72, 1.6, 1.1, fill="#f4ecd8", fill_opacity="0.85"))
    return s.render()


@asset("t-bathtub", "furniture", [1, 1.5], "Wooden bathtub", "Balia", tags=["bath", "tub", "wash", "balia", "kąpiel"])
def bathtub(seed):
    s = Svg(100, 150, seed)
    rng = s.rng
    cx, cy = 48, 73
    rx, ry = 42, 66
    s.add(shadow(ellipse_d(cx, cy, rx, ry), 5, 6, 0.45))
    s.add(ellipse(cx, cy, rx, ry, fill=s.rg([(0, "#c49058"), (0.85, "#9a6a3c"), (1, "#5a381a")], cx=0.4, cy=0.4), stroke=INK, stroke_width="1.6"))
    st = []
    for i in range(30):
        a = 2 * math.pi * i / 30
        st.append(f"M{f(cx + math.cos(a) * (rx - 7))} {f(cy + math.sin(a) * (ry - 7))}L{f(cx + math.cos(a) * rx)} {f(cy + math.sin(a) * ry)}")
    s.add(path("".join(st), stroke="#3d220e", stroke_width="0.7", stroke_opacity="0.8"))
    s.add(ellipse(cx, cy, rx - 2.2, ry - 2.2, fill="none", stroke="#353538", stroke_width="2.4"))
    s.add(ellipse(cx, cy, rx - 2.2, ry - 2.2, fill="none", stroke="#a9aeb3", stroke_width="0.6", stroke_opacity="0.6",
                  stroke_dasharray="40 30 60 200", transform=f"rotate(180 {cx} {cy})"))
    s.add(ellipse(cx, cy, rx - 7, ry - 7, fill="#5a381a", stroke=INK, stroke_width="1"))
    water = ellipse_d(cx, cy, rx - 9, ry - 9)
    cl = s.clip(water)
    s.add(path(water, fill=s.rg([(0, "#a9c4c9"), (0.7, "#6f949b"), (1, "#3f5e66")], cx=0.6, cy=0.6)))
    s.add(g([ellipse(cx + 3, cy + 3, rx - 9, ry - 9, fill="none", stroke="#1b0f06", stroke_width="8", stroke_opacity="0.3")], clip_path=cl))
    ripples = "".join(f"M{f(cx + rng.uniform(-18, 14))} {f(cy + rng.uniform(-40, 40))}q4 -2 8 0" for _ in range(10))
    s.add(path(ripples, fill="none", stroke="#fff", stroke_opacity="0.4", stroke_width="0.8", clip_path=cl))
    for bx, by, n in ((34, 42, 14), (58, 96, 10), (40, 108, 6)):
        for _ in range(n):
            r = rng.uniform(1.2, 3.6)
            s.add(circle(bx + rng.uniform(-9, 9), by + rng.uniform(-7, 7), r, fill="#fbfaf6", fill_opacity="0.85", stroke="#b9c9cc",
                         stroke_width="0.35"))
    # towel over the rim, scrubbing brush floating
    s.add(path("M80 52Q92 55 94 70L92 98Q86 94 80 96Z", fill="#1b0f06", fill_opacity="0.3", transform="translate(1.5 2)"))
    s.add(path("M78 50Q92 53 94 70L92 98Q84 93 78 95Z", fill="#efe9dc", stroke="#6b604c", stroke_width="0.8"))
    s.add(path("M79 57Q88 59 93 64M79 88Q86 86 92 90", fill="none", stroke="#2f5d8a", stroke_width="1.2", stroke_opacity="0.7"))
    s.add(rect(46, 60, 14, 7, rx=3, fill="#8a5a30", stroke=INK, stroke_width="0.7", transform="rotate(-30 53 63)"))
    s.add(path(" ".join(f"M{48 + k * 2} 61.5v4" for k in range(6)), stroke="#d9c49a", stroke_width="0.7", transform="rotate(-30 53 63)"))
    return s.render()
