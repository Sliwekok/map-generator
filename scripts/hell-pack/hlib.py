"""Hell-pack helpers on top of lib.py: palette, iron, obsidian, lava, bone, chains, spikes, skulls.

Everything is top-down, light from the top-left, soft stacked-copy shadows (lib.shadow), no filters.
"""
import math

from lib import (INK, Svg, blob, blob_pts, circle, circle_d, el, ellipse, ellipse_d, f, f2, g, line, mix, path, P, rect, rect_d,
                 rot_pts, shade, shadow, smooth, speckle, vary)

# ------------------------------------------------------------------ palette

IRON = "#3b3b42"        # wrought iron body
IRON_D = "#1c1c21"      # iron outline / deep shade
IRON_L = "#8d8f9a"      # iron highlight
RUST = "#7a3b1e"
OBS = "#1d1820"         # obsidian / basalt body
OBS_D = "#0c0a0e"
OBS_L = "#5e4f6b"       # violet sheen on obsidian
BASALT = "#2e2827"
BRIM = "#5a2418"        # brimstone red-brown rock
LAVA_CORE = "#fff3b0"
LAVA_Y = "#ffc23a"
LAVA_O = "#ff7a12"
LAVA_R = "#d8340a"
LAVA_D = "#6e1203"
CRUST = "#2a1410"
BONE = "#e3d8bd"
BONE_D = "#a2957a"
BLOOD = "#6e0f12"       # dark red cloth / velvet
EMBER = "#ff8a2a"
SULFUR = "#d8c23a"


# ------------------------------------------------------------------ glow & fire


def glow(s, cx, cy, r, color=LAVA_O, op=0.55, core=None):
    """Soft radial light pool (gradient in user space so it never stretches)."""
    stops = [(0, core or color, op), (0.45, color, op * 0.4), (1, color, 0)]
    return circle(cx, cy, r, fill=s.rg(stops, cx=cx, cy=cy, r=r, user=True))


def lava_fill(s, x0, y0, x1, y1):
    """A hot, molten gradient for a shape whose bbox is given (user space, top-left brighter)."""
    cx, cy = x0 + (x1 - x0) * 0.42, y0 + (y1 - y0) * 0.42
    r = max(x1 - x0, y1 - y0) * 0.7
    return s.rg([(0, LAVA_CORE), (0.25, LAVA_Y), (0.6, LAVA_O), (1, LAVA_R)], cx=cx, cy=cy, r=r, user=True)


def lava_skin(s, d, rng, x0, y0, x1, y1, crust_n=10, clip=True):
    """Molten lava inside path d: bright gradient, darker cooling crust plates, bright cracks, bubbles."""
    cl = s.clip(d) if clip else None
    parts = [path(d, fill=lava_fill(s, x0, y0, x1, y1))]
    plates = []
    for _ in range(crust_n):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        r = rng.uniform(0.05, 0.13) * max(x1 - x0, y1 - y0)
        plates.append(blob(cx, cy, r, r * rng.uniform(0.5, 0.9), 7, 0.35, rng, rot=rng.uniform(0, 6.3)))
    parts.append(path("".join(plates), fill=LAVA_D, fill_opacity="0.75", stroke=LAVA_Y, stroke_width="1.2", stroke_opacity="0.7"))
    swirls = []
    for _ in range(int(crust_n * 0.8)):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        L = rng.uniform(6, 18)
        a = rng.uniform(0, 6.3)
        swirls.append(f"M{f(cx)} {f(cy)}q{f(math.cos(a) * L * 0.5 + 3)} {f(math.sin(a) * L * 0.5 - 3)} {f(math.cos(a) * L)} {f(math.sin(a) * L)}")
    parts.append(path("".join(swirls), fill="none", stroke=LAVA_CORE, stroke_width="1.1", stroke_opacity="0.6", stroke_linecap="round"))
    bub = []
    for _ in range(crust_n // 2):
        bub.append(circle(rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(0.8, 2.2), fill="none", stroke=LAVA_CORE,
                          stroke_width="0.6", stroke_opacity="0.8"))
    parts.append(g(bub))
    return g(parts, clip_path=cl)


def embers(s, x, y, w, h, n, rng, rmax=0.9):
    """Tiny glowing sparks."""
    ds = {LAVA_Y: [], EMBER: [], LAVA_CORE: []}
    for _ in range(n):
        c = rng.choice(list(ds))
        ds[c].append(circle_d(x + rng.uniform(0, w), y + rng.uniform(0, h), rng.uniform(0.3, rmax)))
    return g([path("".join(v), fill=c) for c, v in ds.items() if v], opacity="0.9")


def fire(s, cx, cy, size, rng, hot=True):
    """Layered flame seen from above (bright core, licks toward the top). Hell fire: deeper reds."""
    parts = [glow(s, cx, cy, size * 2.6, LAVA_O, 0.5, LAVA_Y)]
    cols = (("#5e0c02", 1.0), ("#b8220a", 0.82), ("#ff5e12", 0.62), ("#ffb02a", 0.42), ("#fff0b0", 0.2)) if hot else \
        (("#3a0a2a", 1.0), ("#7a1a6a", 0.8), ("#c23a9a", 0.6), ("#ff8ae0", 0.4), ("#ffe6fa", 0.2))
    for col, k in cols:
        pts = []
        n = 10
        for i in range(n):
            a = 2 * math.pi * i / n
            rr = size * k * (1 + rng.uniform(-0.25, 0.3))
            stretch = 1.0 + 0.5 * max(0, -math.sin(a))
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * stretch))
        parts.append(path(smooth(pts), fill=col))
    return g(parts)


# ------------------------------------------------------------------ iron


def iron_grad(s, x0, y0, x1, y1, base=IRON):
    """Brushed-iron linear gradient across a bbox (user space)."""
    return s.lg([(0, shade(base, 0.16)), (0.45, base), (1, shade(base, -0.1))], x0, y0, x1, y1, user=True)


def rivet(cx, cy, r=1.4, base=IRON):
    return g([
        circle(cx + r * 0.35, cy + r * 0.45, r, fill="#000", fill_opacity="0.45"),
        circle(cx, cy, r, fill=shade(base, 0.05), stroke=IRON_D, stroke_width=f2(max(0.3, r * 0.3))),
        circle(cx - r * 0.3, cy - r * 0.3, r * 0.4, fill="#fff", fill_opacity="0.45"),
    ])


def rivets(pts, r=1.4, base=IRON):
    """Many rivets in three combined paths (cheap)."""
    sh = "".join(circle_d(x + r * 0.35, y + r * 0.45, r) for x, y in pts)
    bd = "".join(circle_d(x, y, r) for x, y in pts)
    hl = "".join(circle_d(x - r * 0.3, y - r * 0.3, r * 0.4) for x, y in pts)
    return g([path(sh, fill="#000", fill_opacity="0.45"),
              path(bd, fill=shade(base, 0.05), stroke=IRON_D, stroke_width=f2(max(0.3, r * 0.3))),
              path(hl, fill="#fff", fill_opacity="0.45")])


def iron_bar(x0, y0, x1, y1, w=3.0, base=IRON, cap="round"):
    """A forged iron rod: dark edge, body, top-left highlight."""
    nx, ny = (y1 - y0), -(x1 - x0)
    L = math.hypot(nx, ny) or 1
    ox, oy = -nx / L * w * 0.18, -ny / L * w * 0.18
    ox, oy = (ox, oy) if (ox + oy) < 0 else (-ox, -oy)  # highlight toward top-left
    return g([
        line(x0, y0, x1, y1, stroke=IRON_D, stroke_width=f2(w + 1.2), stroke_linecap=cap),
        line(x0, y0, x1, y1, stroke=base, stroke_width=f2(w), stroke_linecap=cap),
        line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, stroke=IRON_L, stroke_width=f2(max(0.4, w * 0.28)), stroke_opacity="0.7", stroke_linecap=cap),
    ])


def iron_curve(d, w=3.0, base=IRON):
    """Forged scroll / curve along a path."""
    return g([
        path(d, fill="none", stroke=IRON_D, stroke_width=f2(w + 1.2), stroke_linecap="round", stroke_linejoin="round"),
        path(d, fill="none", stroke=base, stroke_width=f2(w), stroke_linecap="round", stroke_linejoin="round"),
        path(d, fill="none", stroke=IRON_L, stroke_width=f2(max(0.4, w * 0.28)), stroke_opacity="0.55", stroke_linecap="round",
             transform="translate(-0.45 -0.45)"),
    ])


def spike(cx, cy, r, base=IRON, tip=None):
    """Conical spike seen from above: lit top-left facet, dark bottom-right facet, bright tip."""
    k = 0.7071
    lit = P([(cx - r, cy), (cx, cy - r), (cx, cy)]) + P([(cx - r, cy), (cx, cy), (cx - r * k * 0.0, cy + r)])
    dark = P([(cx, cy - r), (cx + r, cy), (cx, cy)]) + P([(cx + r, cy), (cx, cy + r), (cx, cy)])
    return g([
        circle(cx + r * 0.35, cy + r * 0.45, r * 1.05, fill="#000", fill_opacity="0.4"),
        path(circle_d(cx, cy, r), fill=base, stroke=IRON_D, stroke_width=f2(max(0.3, r * 0.15))),
        path(lit, fill="#fff", fill_opacity="0.18"),
        path(dark, fill="#000", fill_opacity="0.3"),
        circle(cx - r * 0.08, cy - r * 0.08, max(0.35, r * 0.14), fill=tip or IRON_L),
    ])


def spike_side(x, y, L, w, ang, base=IRON):
    """A spike lying along the ground (or sticking sideways out of a wall), base at (x, y)."""
    c, s_ = math.cos(ang), math.sin(ang)
    tip = (x + c * L, y + s_ * L)
    a = (x - s_ * w / 2, y + c * w / 2)
    b = (x + s_ * w / 2, y - c * w / 2)
    return g([
        path(P([a, tip, b]), fill="#000", fill_opacity="0.35", transform="translate(1.2 1.6)"),
        path(P([a, tip, b]), fill=base, stroke=IRON_D, stroke_width="0.6", stroke_linejoin="round"),
        path(P([b, tip, (x, y)]), fill="#fff", fill_opacity="0.2"),
    ])


def chain(pts, link=4.0, w=1.3, base=IRON):
    """Chain following a polyline: alternating flat / edge-on links."""
    parts_flat, parts_edge = [], []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(L / (link * 1.25)))
        a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        for k in range(n):
            t = (k + 0.5) / n
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            if (k + i) % 2 == 0:
                parts_flat.append(ellipse(cx, cy, link * 0.75, link * 0.42, fill="none", transform=f"rotate({f(a)} {f(cx)} {f(cy)})"))
            else:
                parts_edge.append(ellipse(cx, cy, link * 0.75, link * 0.14, transform=f"rotate({f(a)} {f(cx)} {f(cy)})"))
    return g([
        g(parts_flat, stroke="#000", stroke_opacity="0.35", stroke_width=f2(w), transform="translate(1 1.4)"),
        g(parts_edge, fill="#000", fill_opacity="0.35", transform="translate(1 1.4)"),
        g(parts_flat, stroke=IRON_D, stroke_width=f2(w + 0.7)),
        g(parts_flat, stroke=base, stroke_width=f2(w)),
        g(parts_edge, fill=base, stroke=IRON_D, stroke_width="0.5"),
        g(parts_flat, stroke=IRON_L, stroke_width=f2(w * 0.35), stroke_opacity="0.6", transform="translate(-0.3 -0.3)"),
    ])


# ------------------------------------------------------------------ bone


def skull(s, cx, cy, r, ang=0.0, color=BONE, eyes="#1a0d08", glow_eyes=None):
    """Skull seen from above-front (cranium dome, brow, eye sockets, teeth). ang in degrees (0 = facing down the screen)."""
    rng = s.rng
    parts = [
        ellipse(cx + r * 0.25, cy + r * 0.35, r * 1.0, r * 1.15, fill="#000", fill_opacity="0.4"),
        path(smooth([(cx - r, cy - r * 0.2), (cx - r * 0.75, cy - r * 0.95), (cx, cy - r * 1.15), (cx + r * 0.75, cy - r * 0.95),
                     (cx + r, cy - r * 0.2), (cx + r * 0.62, cy + r * 0.55), (cx + r * 0.42, cy + r * 1.0), (cx - r * 0.42, cy + r * 1.0),
                     (cx - r * 0.62, cy + r * 0.55)]), fill=color, stroke=shade(color, -0.45), stroke_width=f2(max(0.3, r * 0.08))),
        ellipse(cx - r * 0.3, cy - r * 0.55, r * 0.45, r * 0.3, fill="#fff", fill_opacity="0.35"),
    ]
    for sx in (-1, 1):
        parts.append(ellipse(cx + sx * r * 0.38, cy + r * 0.12, r * 0.27, r * 0.24, fill=eyes))
        if glow_eyes:
            parts.append(circle(cx + sx * r * 0.38, cy + r * 0.12, r * 0.1, fill=glow_eyes))
    parts.append(path(P([(cx, cy + r * 0.35), (cx - r * 0.1, cy + r * 0.58), (cx + r * 0.1, cy + r * 0.58)]), fill=eyes))
    teeth = "".join(f"M{f(cx + k * r * 0.13)} {f(cy + r * 0.72)}v{f(r * 0.24)}" for k in (-2, -1, 0, 1, 2))
    parts.append(path(teeth, stroke=shade(color, -0.5), stroke_width=f2(max(0.25, r * 0.06))))
    parts.append(path(f"M{f(cx - r * 0.4)} {f(cy + r * 0.72)}H{f(cx + r * 0.4)}", stroke=shade(color, -0.5), stroke_width=f2(max(0.25, r * 0.06))))
    return g(parts, transform=f"rotate({f(ang)} {f(cx)} {f(cy)})" if ang else None)


def bone(cx, cy, L, w, ang, color=BONE):
    """Long bone with knobbed ends, lying on the ground."""
    c, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    x0, y0 = cx - c * L / 2, cy - s_ * L / 2
    x1, y1 = cx + c * L / 2, cy + s_ * L / 2
    nx, ny = -s_ * w * 0.55, c * w * 0.55
    knobs = "".join(circle_d(x + nx * k, y + ny * k, w * 0.62) for x, y in ((x0, y0), (x1, y1)) for k in (-1, 1))
    shaft = f"M{f(x0)} {f(y0)}L{f(x1)} {f(y1)}"
    dk = shade(color, -0.42)
    return g([
        g([path(knobs), path(shaft, stroke="#000", stroke_width=f2(w), fill="none")], fill="#000", opacity="0.35",
          transform=f"translate({f2(w * 0.3)} {f2(w * 0.4)})"),
        path(knobs, fill=color, stroke=dk, stroke_width=f2(max(0.3, w * 0.12))),
        path(shaft, stroke=dk, stroke_width=f2(w + 0.6), fill="none"),
        path(shaft, stroke=color, stroke_width=f2(w), fill="none"),
        path(knobs, fill=color),
        path(f"M{f(x0 + nx * 0.4)} {f(y0 + ny * 0.4 - 0.3)}L{f(x1 + nx * 0.4)} {f(y1 + ny * 0.4 - 0.3)}", stroke="#fff",
             stroke_opacity="0.4", stroke_width=f2(w * 0.25)),
    ])


# ------------------------------------------------------------------ rock


def rock(s, cx, cy, rx, ry, rng, base=OBS, n=9, irr=0.28, facets=True, hot=False):
    """Faceted volcanic rock: shadow, body, lit top-left facets, dark bottom-right, optional glowing cracks."""
    pts = blob_pts(cx, cy, rx, ry, n, irr, rng, rot=rng.uniform(0, 6.3))
    d = P(pts)
    parts = [shadow(d, rx * 0.12 + 2, ry * 0.15 + 2.5, 0.45)]
    parts.append(path(d, fill=base, stroke=OBS_D, stroke_width="0.9", stroke_linejoin="round"))
    if facets:
        top = (cx - rx * 0.12 + rng.uniform(-rx, rx) * 0.12, cy - ry * 0.15 + rng.uniform(-ry, ry) * 0.12)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            mx, my = (a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy
            lit = -(mx * 0.7 + my * 0.7) / (math.hypot(mx, my) or 1)  # >0 facing top-left
            col = "#fff" if lit > 0 else "#000"
            op = abs(lit) * (0.2 if lit > 0 else 0.35)
            parts.append(path(P([a, b, top]), fill=col, fill_opacity=f2(op)))
        parts.append(path("".join(f"M{f(top[0])} {f(top[1])}L{f(p[0])} {f(p[1])}" for p in pts[::2]), stroke=OBS_L,
                          stroke_width="0.5", stroke_opacity="0.35"))
    if hot:
        cr = []
        for _ in range(2):
            a = rng.uniform(0, 6.3)
            x, y = cx, cy
            seg = [(x, y)]
            for _ in range(4):
                a += rng.uniform(-0.6, 0.6)
                x += math.cos(a) * rx * 0.22
                y += math.sin(a) * ry * 0.22
                seg.append((x, y))
            cr.append(P(seg, close=False))
        cl = s.clip(d)
        parts.append(g([path("".join(cr), fill="none", stroke=LAVA_O, stroke_width="2.4", stroke_opacity="0.5"),
                        path("".join(cr), fill="none", stroke=LAVA_Y, stroke_width="0.9")], clip_path=cl, stroke_linecap="round",
                       stroke_linejoin="round"))
    return g(parts)


def obsidian_block(s, x, y, w, h, rng, base=OBS, glow_seam=False):
    """One cut obsidian ashlar block (bevelled, violet sheen)."""
    d = rect_d(x, y, w, h, 0.8)
    parts = [path(d, fill=vary(base, rng, l=0.03)),
             path(rect_d(x + 1.2, y + 1.2, w - 2.4, h - 2.4, 0.5), fill=s.lg([(0, OBS_L, 0.35), (0.5, OBS_L, 0), (1, "#000", 0.3)], 0, 0, 1, 1)),
             path(f"M{f(x + 0.6)} {f(y + h - 0.8)}V{f(y + 0.6)}H{f(x + w - 0.8)}", fill="none", stroke="#b8a8c8", stroke_opacity="0.3",
                  stroke_width="0.7")]
    if rng.random() < 0.5:
        sx = x + rng.uniform(0.2, 0.7) * w
        parts.append(path(f"M{f(sx)} {f(y + 1)}l{f(rng.uniform(-3, 3))} {f(h * 0.4)}l{f(rng.uniform(-2, 2))} {f(h * 0.3)}", fill="none",
                          stroke="#000", stroke_opacity="0.5", stroke_width="0.5"))
    return g(parts)
