"""Blood river kit (added 2026-10-30): a dark, clotted blood river with cracked grey-violet stone banks and thin
glowing fissures - painted look to match the ground textures h-cursed-stone / h-blood-water.

Chainable pieces: h-blood-river enters/leaves at x=100 (top/bottom), h-blood-river-bend enters at the top (x=150) and
leaves on the right (y=150); both are RW wide at the ends, so straight pieces, rotated straights and bends join up.
"""
import math

from hlib import *  # noqa: F401,F403
from lib import (Svg, blob, blob_pts, circle, circle_d, f, f2, g, path, P, rect, rect_d, shade, shadow, smooth, vary)
from reg import asset
from terrain import halo, offset_poly, soft_blobs

BLOOD_D = "#3a0508"     # deep pools / crack lines
BLOOD_M = "#6e0c10"     # main body
BLOOD_L = "#94161a"     # lighter, thinner film
STONE = "#8f8798"       # grey-violet stone (matches h-cursed-stone)
STONE_D = "#4a4256"
STONE_L = "#c4bccb"
INK2 = "#1e1824"        # line-art outline
RW = 60                 # half-width of the liquid at chainable ends (1.2 cells wide)
BANK = 12               # stone rim width outside the liquid


def craquelure(rng, x0, y0, x1, y1, n, step=(4, 9), segs=(4, 9), turn=0.7):
    """Network of thin wandering cracks (clotted / dried surface)."""
    ds = []
    for _ in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        a = rng.uniform(0, 6.283)
        pts = [(x, y)]
        for _ in range(rng.randint(*segs)):
            a += rng.uniform(-turn, turn)
            L = rng.uniform(*step)
            x += math.cos(a) * L
            y += math.sin(a) * L
            pts.append((x, y))
            if rng.random() < 0.18:  # short branch
                b = a + rng.choice([-1, 1]) * rng.uniform(0.8, 1.4)
                bl = rng.uniform(3, 7)
                ds.append(f"M{f(x)} {f(y)}l{f(math.cos(b) * bl)} {f(math.sin(b) * bl)}")
        ds.append(P(pts, close=False))
    return "".join(ds)


def blood_body(s, d, rng, x0, y0, x1, y1, density=1.0):
    """Blood surface inside path d: crimson body, darker deep patches, lighter film, clotted crack network, faint sheen."""
    cl = s.clip(d)
    area = (x1 - x0) * (y1 - y0)
    parts = [path(d, fill=BLOOD_M)]
    # painterly mottling
    deep, film = [], []
    for _ in range(int(area / 900 * density) + 4):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        r = rng.uniform(8, 26)
        (deep if rng.random() < 0.55 else film).append(blob(cx, cy, r, r * rng.uniform(0.5, 0.9), 8, 0.35, rng, rot=rng.uniform(0, 6.3)))
    parts.append(path("".join(deep), fill=BLOOD_D, fill_opacity="0.32"))
    parts.append(path("".join(film), fill=BLOOD_L, fill_opacity="0.28"))
    # clotted crack network: dark hairlines with a faint light lip on the upper-left side
    cr = craquelure(rng, x0, y0, x1, y1, int(area / 520 * density) + 3)
    parts.append(path(cr, fill="none", stroke="#c8343a", stroke_width="0.5", stroke_opacity="0.35", transform="translate(-0.5 -0.5)"))
    parts.append(path(cr, fill="none", stroke=BLOOD_D, stroke_width="0.8", stroke_opacity="0.85"))
    # faint sheen streaks (light from the top-left)
    sh = []
    for _ in range(int(area / 2500) + 2):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        L = rng.uniform(10, 26)
        sh.append(f"M{f(cx)} {f(cy)}q{f(L * 0.5)} {f(-2)} {f(L)} {f(rng.uniform(-1, 1))}")
    parts.append(path("".join(sh), fill="none", stroke="#e07070", stroke_width="1.2", stroke_opacity="0.18", stroke_linecap="round"))
    # inner shadow along the banks (the liquid sits lower than the stone)
    parts.append(path(d, fill="none", stroke="#1a0204", stroke_width="7", stroke_opacity="0.45"))
    parts.append(path(d, fill="none", stroke="#1a0204", stroke_width="3", stroke_opacity="0.4", transform="translate(1.5 2)"))
    return g(parts, clip_path=cl)


def stone_rim(s, poly, rng, glow_cracks=2):
    """Grey-violet broken-stone bank: rim band, outline, cracks, a couple of glowing fissures running away from the river."""
    d = smooth(poly, t=0.8)
    cl = s.clip(d)
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    blot = []
    for _ in range(int((max(xs) - min(xs)) * (max(ys) - min(ys)) / 700) + 3):
        cx, cy = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
        r = rng.uniform(5, 14)
        blot.append(blob(cx, cy, r, r * rng.uniform(0.5, 0.9), 7, 0.35, rng, rot=rng.uniform(0, 6.3)))
    parts = [path(d, fill="none", stroke=STONE, stroke_width="10", stroke_opacity="0.25", stroke_linejoin="round"),
             path(d, fill="none", stroke=STONE, stroke_width="5", stroke_opacity="0.4", stroke_linejoin="round"),
             path(d, fill=STONE),
             g([path("".join(blot[::2]), fill=STONE_D, fill_opacity="0.3"), path("".join(blot[1::2]), fill=STONE_L, fill_opacity="0.25")],
               clip_path=cl),
             path(d, fill=s.lg([(0, STONE_L, 0.35), (0.45, STONE_L, 0), (0.75, "#000", 0), (1, STONE_D, 0.45)], 0, 0, 1, 1)),
             path(d, fill="none", stroke=INK2, stroke_width="0.9", stroke_opacity="0.45", stroke_linejoin="round")]
    return g(parts), d


def rim_chunks(rng, poly, step=3, size=(2.5, 6)):
    """Broken stone lumps along an edge polyline (drawn as one path)."""
    ds = []
    for i in range(0, len(poly) - 1, step):
        x, y = poly[i]
        r = rng.uniform(*size)
        ds.append(blob(x + rng.uniform(-2, 2), y + rng.uniform(-2, 2), r, r * rng.uniform(0.6, 0.9), 6, 0.3, rng, rot=rng.uniform(0, 6.3)))
    return "".join(ds)


def glow_fissure(rng, x, y, a, L, segs=6, branch=0.35):
    """One glowing crack (open polyline + branches) as path data."""
    ds = []
    pts = [(x, y)]
    for k in range(segs):
        a += rng.uniform(-0.5, 0.5)
        step = L / segs * rng.uniform(0.7, 1.3)
        x += math.cos(a) * step
        y += math.sin(a) * step
        pts.append((x, y))
        if rng.random() < branch and k < segs - 1:
            b = a + rng.choice([-1, 1]) * rng.uniform(0.5, 1.1)
            bl = L * rng.uniform(0.12, 0.3)
            q = [(x, y)]
            bx, by = x, y
            for _ in range(3):
                b += rng.uniform(-0.4, 0.4)
                bx += math.cos(b) * bl / 3
                by += math.sin(b) * bl / 3
                q.append((bx, by))
            ds.append(P(q, close=False))
    ds.append(P(pts, close=False))
    return "".join(ds)


def fissure_paint(d, scale=1.0):
    """Painted glow for fissure path data: wide orange haze, dark crack, hot yellow core."""
    k = scale
    return g([path(d, fill="none", stroke=LAVA_O, stroke_width=f2(9 * k), stroke_opacity="0.12"),
              path(d, fill="none", stroke=LAVA_O, stroke_width=f2(4.5 * k), stroke_opacity="0.3"),
              path(d, fill="none", stroke="#2a0e06", stroke_width=f2(2.2 * k)),
              path(d, fill="none", stroke=LAVA_Y, stroke_width=f2(1.2 * k)),
              path(d, fill="none", stroke=LAVA_CORE, stroke_width=f2(0.45 * k), stroke_opacity="0.9")],
             stroke_linecap="round", stroke_linejoin="round")


def river_piece(s, center, widths, box, fissures=3):
    """Shared drawing of a river along a centre polyline: stone rim, chunks, fissures, blood body, outline."""
    rng = s.rng
    x0, y0, x1, y1 = box
    inner = offset_poly(center, widths)
    outer = offset_poly(center, bank_widths(len(center) - 1, rng, widths))
    # soft violet shade on the ground around the river (ties it into any ground texture)
    s.add(path(smooth(offset_poly(center, [(a + BANK + 16, b + BANK + 16) for a, b in widths])), fill="none", stroke=STONE_D,
               stroke_width="18", stroke_opacity="0.18"))
    rim, rd = stone_rim(s, outer, rng)
    s.add(rim)
    # cracks across the rim + glowing fissures leaving the river
    n = len(center)
    half = len(inner) // 2
    left_edge, right_edge = inner[:half], inner[half:][::-1]
    cracks = []
    for edge in (left_edge, right_edge):
        for i in range(1, len(edge) - 1, 3):
            x, y = edge[i]
            cx, cy = center[min(i, n - 1)]
            a = math.atan2(y - cy, x - cx) + rng.uniform(-0.5, 0.5)
            L = BANK + rng.uniform(2, 8)
            cracks.append(f"M{f(x)} {f(y)}l{f(math.cos(a) * L * 0.5 + rng.uniform(-1.5, 1.5))} {f(math.sin(a) * L * 0.5)}"
                          f"l{f(math.cos(a) * L * 0.5)} {f(math.sin(a) * L * 0.5 + rng.uniform(-1.5, 1.5))}")
    s.add(path("".join(cracks), fill="none", stroke=INK2, stroke_width="0.7", stroke_opacity="0.75", clip_path=s.clip(rd)))
    s.add(path(rim_chunks(rng, left_edge, 5) + rim_chunks(rng, right_edge, 5), fill=STONE, stroke=INK2, stroke_width="0.6"))
    s.add(path(rim_chunks(rng, left_edge, 7, (1.2, 2.4)) + rim_chunks(rng, right_edge, 7, (1.2, 2.4)), fill=STONE_L, fill_opacity="0.7"))
    # fissures: start at the outer bank and run outward, staying inside the asset box
    fd = []
    for _ in range(fissures):
        edge = rng.choice((left_edge, right_edge))
        i = rng.randrange(2, len(edge) - 2)
        x, y = edge[i]
        cx, cy = center[min(i, n - 1)]
        a = math.atan2(y - cy, x - cx)
        L = rng.uniform(28, 55)
        ex, ey = x + math.cos(a) * L, y + math.sin(a) * L
        if x0 + 6 < ex < x1 - 6 and y0 + 6 < ey < y1 - 6:
            fd.append(glow_fissure(rng, x, y, a, L))
    if fd:
        s.add(fissure_paint("".join(fd)))
    idd = smooth(inner, t=0.8)
    xs = [p[0] for p in inner]
    ys = [p[1] for p in inner]
    s.add(blood_body(s, idd, rng, min(xs), min(ys), max(xs), max(ys)))
    s.add(path(idd, fill="none", stroke=INK2, stroke_width="1.3", stroke_linejoin="round"))
    # small stones / a skull fragment in the blood near the banks
    for _ in range(3):
        edge = rng.choice((left_edge, right_edge))
        x, y = edge[rng.randrange(1, len(edge) - 1)]
        cx, cy = center[min(len(center) - 1, rng.randrange(n))]
        s.add(path(blob(x + (cx - x) * 0.12, y + (cy - y) * 0.12, rng.uniform(2.5, 4.5), rng.uniform(2, 3.5), 6, 0.3, rng),
                   fill=STONE, stroke=INK2, stroke_width="0.6"))


def wave(rng, k=3):
    """Smooth random function of t in [0, 1] that is 0 at both ends (sum of pinned sines)."""
    comps = [(rng.uniform(-1, 1) / (j + 1), j + 1, rng.uniform(0, 6.3)) for j in range(k)]
    return lambda t: math.sin(math.pi * t) ** 0.7 * sum(a * math.sin(math.pi * m * t + ph) for a, m, ph in comps)


def clip_to_box(s):
    """The editor draws overflow (it grows the viewBox for shadows), so chainable pieces must not spill past their box."""
    s.body = [g(s.body, clip_path=s.clip(rect_d(0, 0, s.w, s.h)))]


def end_widths(n, rng, amp=10):
    wl, wr = wave(rng), wave(rng)
    return [(RW + amp * wl(i / n), RW + amp * wr(i / n)) for i in range(n + 1)]


def bank_widths(n, rng, widths):
    """Stone rim widths: irregular, from a thin lip to a broad shelf."""
    bl, br = wave(rng, 4), wave(rng, 4)
    out = []
    for i, (a, b) in enumerate(widths):
        t = i / n
        out.append((a + BANK + 9 * bl(t) + rng.uniform(-1, 1), b + BANK + 9 * br(t) + rng.uniform(-1, 1)))
    return out


@asset("h-blood-river", "terrain", [2, 4], "Blood river", "Rzeka krwi",
       tags=["blood", "river", "stream", "water", "hell", "krew", "rzeka", "strumień", "piekło"])
def blood_river(seed):
    s = Svg(200, 400, seed)
    rng = s.rng
    n = 40
    center = []
    for i in range(n + 1):
        t = i / n
        y = -8 + 416 * t
        x = 100 + 16 * math.sin(2 * math.pi * t) * math.sin(math.pi * t)
        center.append((x, y))
    river_piece(s, center, end_widths(n, rng), (0, 0, 200, 400), fissures=4)
    clip_to_box(s)
    return s.render()


@asset("h-blood-river-bend", "terrain", [3, 3], "Blood river bend", "Zakole rzeki krwi",
       tags=["blood", "river", "bend", "turn", "corner", "hell", "krew", "rzeka", "zakole", "zakręt", "piekło"])
def blood_river_bend(seed):
    s = Svg(300, 300, seed)
    rng = s.rng
    n = 36
    center = [(150, -8)]
    wob = wave(rng, 2)
    for i in range(n + 1):
        t = (math.pi / 2) * i / n
        r = 150 + 8 * wob(i / n)
        center.append((300 - r * math.cos(t), r * math.sin(t)))
    center.append((308, 150))
    river_piece(s, center, end_widths(len(center) - 1, rng), (0, 0, 300, 300), fissures=4)
    clip_to_box(s)
    return s.render()


@asset("h-blood-pool", "terrain", [3, 2], "Blood pool", "Kałuża krwi",
       tags=["blood", "pool", "lake", "pond", "hell", "krew", "kałuża", "jezioro", "staw", "piekło"])
def blood_pool(seed):
    s = Svg(300, 200, seed)
    rng = s.rng
    cx, cy = 148, 98
    s.add(soft_blobs(s, cx, cy, 150, 98, STONE_D, 0.22, 5, rng, 0.3))
    pts = blob_pts(cx, cy, 116, 70, 13, 0.16, rng)
    outer = [(cx + (x - cx) * 1.13, cy + (y - cy) * 1.16) for x, y in pts]
    outer = [(x + rng.uniform(-2, 2), y + rng.uniform(-2, 2)) for x, y in outer]
    rim, rd = stone_rim(s, outer, rng)
    s.add(rim)
    s.add(path(rim_chunks(rng, pts + [pts[0]], 1, (3, 6.5)), fill=STONE, stroke=INK2, stroke_width="0.6"))
    fd = []
    for _ in range(4):
        i = rng.randrange(len(outer))
        x, y = outer[i]
        a = math.atan2(y - cy, x - cx)
        L = rng.uniform(16, 26)
        ex, ey = x + math.cos(a) * L, y + math.sin(a) * L
        if 6 < ex < 294 and 6 < ey < 194:
            fd.append(glow_fissure(rng, x, y, a, L, 5))
    if fd:
        s.add(fissure_paint("".join(fd)))
    d = smooth(pts, t=0.8)
    s.add(blood_body(s, d, rng, cx - 120, cy - 75, cx + 120, cy + 75))
    s.add(path(d, fill="none", stroke=INK2, stroke_width="1.3"))
    # a few bones and a skull sinking in the blood
    s.add(bone(cx + 30, cy + 18, 26, 4, -24, shade(BONE, -0.12)))
    s.add(skull(s, cx - 38, cy - 12, 8, ang=20, color=shade(BONE, -0.15)))
    s.add(path(blob(cx - 38, cy - 3, 12, 4, 8, 0.2, rng), fill=BLOOD_M, fill_opacity="0.85"))
    return s.render()


@asset("h-ember-fissures", "terrain", [2, 2], "Glowing fissures", "Żarzące się szczeliny",
       tags=["crack", "fissure", "glow", "ember", "lava", "decal", "szczelina", "pęknięcie", "żar", "lawa"])
def ember_fissures(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    s.add(halo(s, 100, 100, 92, 92, LAVA_O, 0.12))
    fd = []
    for _ in range(3):
        a = rng.uniform(0, 6.283)
        fd.append(glow_fissure(rng, 100 + math.cos(a) * 8, 100 + math.sin(a) * 8, a, rng.uniform(60, 80), 8, 0.45))
    s.add(path("".join(fd), fill="none", stroke=INK2, stroke_width="4", stroke_opacity="0.4", stroke_linecap="round",
               transform="translate(1 1.5)"))
    s.add(fissure_paint("".join(fd), 1.1))
    s.add(embers(s, 40, 40, 120, 120, 10, rng, 0.8))
    return s.render()
