"""Hell terrain, nature, dungeon props and markers: lava, scorch decals, rocks, bones, chains, portal, sigil."""
import math

from hlib import *  # noqa: F401,F403
from lib import (Svg, blob, blob_pts, circle, circle_d, el, ellipse, ellipse_d, f, f2, g, line, mix, path, P, rect, rect_d, rot_pts,
                 shade, shadow, smooth, speckle, vary)
from reg import asset


# ------------------------------------------------------------------ local helpers


def halo(s, cx, cy, rx, ry, color, op, mid=0.5, tf=None):
    """Feathered elliptical pool of colour that fades to nothing at its edge (bbox gradient follows the ellipse)."""
    return ellipse(cx, cy, rx, ry, fill=s.rg([(0, color, op), (mid, color, op * 0.55), (1, color, 0)]), transform=tf)


def soft_blobs(s, cx, cy, rx, ry, color, op, n, rng, spread=0.35):
    """Several offset halos -> an irregular feathered patch instead of a perfect ellipse."""
    parts = [halo(s, cx, cy, rx, ry, color, op)]
    for _ in range(n):
        a = rng.uniform(0, 6.283)
        d = rng.uniform(0.2, spread)
        parts.append(halo(s, cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d, rx * rng.uniform(0.35, 0.6),
                          ry * rng.uniform(0.35, 0.6), color, op * rng.uniform(0.5, 0.9)))
    return g(parts)


def offset_poly(center, widths):
    """Band polygon around a centre polyline (left side forward, right side back)."""
    left, right = [], []
    n = len(center)
    for i, (x, y) in enumerate(center):
        a = center[max(0, i - 1)]
        b = center[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        wl, wr = widths[i]
        left.append((x + nx * wl, y + ny * wl))
        right.append((x - nx * wr, y - ny * wr))
    return left + right[::-1]


def glow_line(d, color, widths_ops, cap="round"):
    return g([path(d, fill="none", stroke=color, stroke_width=f2(w), stroke_opacity=f2(o)) for w, o in widths_ops],
             stroke_linecap=cap, stroke_linejoin="round")


def ember_dots(cx, cy, r, n, rng, rmax=1.1):
    """Embers scattered in a disc, with their own tiny glow."""
    gl, core = [], []
    for _ in range(n):
        a = rng.uniform(0, 6.283)
        d = r * math.sqrt(rng.random())
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        rr = rng.uniform(0.35, rmax)
        gl.append(circle_d(x, y, rr * 2.6))
        core.append(circle_d(x, y, rr))
    return g([path("".join(gl), fill=LAVA_O, fill_opacity="0.25"), path("".join(core), fill=LAVA_Y)])


def candle_black(s, cx, cy, r, rng):
    """Black ritual candle from above with a small flame and wax puddle."""
    puddle = blob(cx + 0.5, cy + 0.8, r * 1.7, r * 1.5, 8, 0.25, rng)
    return g([
        glow(s, cx, cy - r * 0.4, r * 5.5, LAVA_O, 0.45, LAVA_Y),
        path(puddle, fill="#151116", stroke="#000", stroke_width="0.4"),
        circle(cx + r * 0.3, cy + r * 0.4, r, fill="#000", fill_opacity="0.5"),
        circle(cx, cy, r, fill="#231c26", stroke="#08060a", stroke_width="0.5"),
        circle(cx - r * 0.3, cy - r * 0.3, r * 0.45, fill="#6b5a78", fill_opacity="0.5"),
        path(f"M{f(cx)} {f(cy - r * 1.9)}Q{f(cx + r * 0.55)} {f(cy - r * 0.4)} {f(cx)} {f(cy)}Q{f(cx - r * 0.55)} {f(cy - r * 0.4)} {f(cx)} {f(cy - r * 1.9)}Z",
             fill=LAVA_O),
        path(f"M{f(cx)} {f(cy - r * 1.3)}Q{f(cx + r * 0.3)} {f(cy - r * 0.35)} {f(cx)} {f(cy - r * 0.1)}Q{f(cx - r * 0.3)} {f(cy - r * 0.35)} {f(cx)} {f(cy - r * 1.3)}Z",
             fill=LAVA_CORE),
    ])


def rune_d(cx, cy, size, rng, ang=0.0):
    """A random angular rune glyph on a 3x3 grid, rotated by ang (radians)."""
    grid = [(i, j) for i in (-1, 0, 1) for j in (-1, 0, 1)]
    pts = []
    d = ""
    for _ in range(rng.randint(2, 4)):
        a, b = rng.sample(grid, 2)
        pts.append((a, b))
    c, sn = math.cos(ang), math.sin(ang)

    def T(p):
        x, y = p[0] * size * 0.5, p[1] * size * 0.62
        return cx + x * c - y * sn, cy + x * sn + y * c

    for a, b in pts:
        A, B = T(a), T(b)
        d += f"M{f(A[0])} {f(A[1])}L{f(B[0])} {f(B[1])}"
    if rng.random() < 0.4:
        p = T(rng.choice(grid))
        d += circle_d(p[0], p[1], size * 0.12)
    return d


def lava_body(s, d, rng, x0, y0, x1, y1, plates=40, pmin=2.5, pmax=7.0):
    """Molten surface clipped to d: hot gradient, many small drifting crust skins with glowing rims, hot swirls."""
    cl = s.clip(d)
    parts = [path(d, fill=lava_fill(s, x0, y0, x1, y1))]
    # darker cooling zones (feathered)
    for _ in range(max(2, plates // 12)):
        parts.append(halo(s, rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(14, 30), rng.uniform(10, 22), LAVA_R, 0.45))
    sk, sk2 = [], []
    for _ in range(plates):
        r = rng.uniform(pmin, pmax)
        b = blob(rng.uniform(x0, x1), rng.uniform(y0, y1), r, r * rng.uniform(0.45, 0.85), 7, 0.4, rng, rot=rng.uniform(0, 6.3))
        (sk if rng.random() < 0.6 else sk2).append(b)
    parts.append(path("".join(sk), fill="#3a0f05", fill_opacity="0.85", stroke=LAVA_Y, stroke_width="0.9", stroke_opacity="0.8"))
    parts.append(path("".join(sk2), fill=LAVA_D, fill_opacity="0.55", stroke=LAVA_O, stroke_width="0.7"))
    sw = []
    for _ in range(plates // 2):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        L = rng.uniform(5, 14)
        a = rng.uniform(0, 6.3)
        sw.append(f"M{f(cx)} {f(cy)}q{f(math.cos(a) * L * 0.5 + 2)} {f(math.sin(a) * L * 0.5 - 2)} {f(math.cos(a) * L)} {f(math.sin(a) * L)}")
    parts.append(path("".join(sw), fill="none", stroke=LAVA_CORE, stroke_width="0.9", stroke_opacity="0.65", stroke_linecap="round"))
    bub = "".join(circle_d(rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(0.7, 1.8)) for _ in range(plates // 4))
    parts.append(path(bub, fill="none", stroke=LAVA_CORE, stroke_width="0.6", stroke_opacity="0.85"))
    return g(parts, clip_path=cl)


def crust_band(s, poly, rng, base=CRUST):
    """Dark cooled-crust bank around a lava body (rough outline, lit top-left edge)."""
    d = smooth(poly)
    return g([path(d, fill=base, stroke="#0d0605", stroke_width="0.8"),
              path(d, fill=s.lg([(0, "#8a5a48", 0.35), (0.5, "#000", 0), (1, "#000", 0.35)], 0, 0, 1, 1))])


# ------------------------------------------------------------------ terrain


@asset("h-lava-pool", "terrain", [3, 2], "Lava pool", "Jezioro lawy",
       tags=["lava", "magma", "pool", "lake", "fire", "hell", "lawa", "magma", "jezioro", "piekło"])
def lava_pool(seed):
    s = Svg(300, 200, seed)
    rng = s.rng
    cx, cy = 150, 100
    # scorched ground fading out, then heat glow
    s.add(soft_blobs(s, cx, cy, 148, 98, "#120806", 0.7, 5, rng))
    s.add(halo(s, cx, cy, 140, 92, LAVA_O, 0.45, mid=0.55))
    outer = blob_pts(cx, cy, 118, 74, 16, 0.14, rng, rot=0.3)
    inner = [(cx + (x - cx) * rng.uniform(0.8, 0.86), cy + (y - cy) * rng.uniform(0.78, 0.86)) for x, y in outer]
    od = smooth(outer)
    s.add(shadow(od, 2, 3, 0.3))
    s.add(crust_band(s, outer, rng))
    # crust rim texture: little cooled lumps on the bank
    lumps = []
    for i in range(70):
        t = rng.random()
        k = int(t * len(outer))
        a, b = outer[k % len(outer)], inner[k % len(inner)]
        u = rng.uniform(0.15, 0.85)
        x, y = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        lumps.append(blob(x, y, rng.uniform(1.5, 4), rng.uniform(1.2, 3), 6, 0.3, rng))
    s.add(path("".join(lumps), fill="#3b2019", stroke="#0d0605", stroke_width="0.4"))
    s.add(path("".join(lumps), fill="#c78a6a", fill_opacity="0.18", transform="translate(-0.5 -0.6)"))
    idd = smooth(inner)
    # glow where the lava meets the bank
    s.add(glow_line(idd, LAVA_O, [(9, 0.25), (5, 0.4)]))
    s.add(lava_body(s, idd, rng, cx - 100, cy - 64, cx + 100, cy + 64, plates=55))
    # floating crust islands
    for _ in range(3):
        ix, iy = cx + rng.uniform(-55, 55), cy + rng.uniform(-30, 30)
        isl = blob(ix, iy, rng.uniform(7, 13), rng.uniform(5, 9), 8, 0.3, rng, rot=rng.uniform(0, 6))
        s.add(path(isl, fill="none", stroke=LAVA_Y, stroke_width="3.5", stroke_opacity="0.55"))
        s.add(path(isl, fill="#2a120c", stroke="#5a2015", stroke_width="0.6"))
        s.add(path(isl, fill="#c78a6a", fill_opacity="0.15", transform="translate(-0.6 -0.6)"))
    s.add(path(idd, fill="none", stroke=LAVA_CORE, stroke_width="0.9", stroke_opacity="0.75"))
    s.add(embers(s, 30, 20, 240, 160, 26, rng, 0.8))
    return s.render()


@asset("h-lava-crack", "terrain", [3, 1], "Lava fissure", "Szczelina z lawą",
       tags=["lava", "crack", "fissure", "rift", "fire", "lawa", "szczelina", "pęknięcie"])
def lava_crack(seed):
    s = Svg(300, 100, seed)
    rng = s.rng
    n = 22
    center = []
    y = 50
    for i in range(n + 1):
        x = 10 + 280 * i / n
        y = max(30, min(70, y + rng.uniform(-7, 7)))
        center.append((x, y))
    widths = []
    for i in range(n + 1):
        t = i / n
        w = 12 * math.sin(math.pi * t) ** 0.7 + 0.5
        widths.append((w * rng.uniform(0.6, 1.25), w * rng.uniform(0.6, 1.25)))
    cd = P(center, close=False)
    # charred halo along the crack
    for (x, y) in center[1:-1:2]:
        s.add(halo(s, x + rng.uniform(-4, 4), y + rng.uniform(-3, 3), rng.uniform(22, 34), rng.uniform(16, 26), "#140806", 0.4))
    s.add(glow_line(cd, LAVA_O, [(34, 0.08), (22, 0.14), (12, 0.25)]))
    outer = offset_poly(center, [(a * 1.45 + 2, b * 1.45 + 2) for a, b in widths])
    s.add(path(P(outer), fill="#1a0c08", stroke="#080303", stroke_width="0.7", stroke_linejoin="round"))
    s.add(path(P(outer), fill="#b8846a", fill_opacity="0.12", transform="translate(-0.7 -0.8)"))
    inner = offset_poly(center, widths)
    idd = P(inner)
    s.add(glow_line(idd, LAVA_O, [(4, 0.5)]))
    s.add(path(idd, fill=s.lg([(0, LAVA_R), (0.5, LAVA_Y), (1, LAVA_R)], 0, 0, 0, 1)))
    s.add(path(P([(x, y) for x, y in center]), fill="none", stroke=LAVA_CORE, stroke_width="1.6", stroke_linejoin="round",
               stroke_opacity="0.85", stroke_linecap="round"))
    # side branches
    br = []
    for _ in range(7):
        i = rng.randint(3, n - 3)
        side = -1 if rng.random() < 0.5 else 1
        x, y = center[i]
        y += side * (widths[i][0 if side < 0 else 1] * 1.3 + 1)
        a = side * math.pi / 2 + rng.uniform(-0.8, 0.8)
        pts = [(x, y)]
        for k in range(rng.randint(2, 4)):
            a += rng.uniform(-0.5, 0.5)
            x += math.cos(a) * rng.uniform(5, 9)
            y += math.sin(a) * rng.uniform(4, 7)
            pts.append((x, max(6, min(94, y))))
        br.append(P(pts, close=False))
    bd = "".join(br)
    s.add(glow_line(bd, LAVA_O, [(5, 0.18)]))
    s.add(path(bd, fill="none", stroke="#1a0c08", stroke_width="1.8", stroke_linecap="round", stroke_linejoin="round"))
    s.add(path(bd, fill="none", stroke=LAVA_O, stroke_width="0.5", stroke_opacity="0.8", stroke_linecap="round", stroke_linejoin="round"))
    s.add(embers(s, 40, 30, 220, 40, 16, rng, 0.7))
    return s.render()


@asset("h-lava-stream", "terrain", [1, 3], "Lava stream", "Strumień lawy",
       tags=["lava", "river", "stream", "flow", "lawa", "rzeka", "strumień"])
def lava_stream(seed):
    s = Svg(100, 300, seed)
    rng = s.rng
    n = 24
    center = []
    for i in range(n + 1):
        t = i / n
        y = -6 + 312 * t
        # sine meander pinned to x=50 (and vertical) at both ends so pieces chain
        x = 50 + 22 * math.sin(2 * math.pi * t) * math.sin(math.pi * t) + (rng.uniform(-2.5, 2.5) if 0 < i < n else 0)
        center.append((x, y))
    widths = []
    for i in range(n + 1):
        w = 11 if i in (0, 1, n - 1, n) else rng.uniform(9, 14)
        widths.append((w, w if i in (0, 1, n - 1, n) else rng.uniform(9, 14)))
    cd = smooth(center, close=False)
    s.add(path(cd, fill="none", stroke="#140806", stroke_width="64", stroke_opacity="0.18"))
    s.add(path(cd, fill="none", stroke="#140806", stroke_width="46", stroke_opacity="0.25"))
    s.add(glow_line(cd, LAVA_O, [(54, 0.12), (40, 0.18)], cap="butt"))
    bank = offset_poly(center, [(a + 6 + rng.uniform(-1.5, 2), b + 6 + rng.uniform(-1.5, 2)) for a, b in widths])
    s.add(crust_band(s, bank, rng))
    lumps = []
    for i in range(1, n):
        for side in (-1, 1):
            x, y = center[i]
            w = (widths[i][0] if side < 0 else widths[i][1]) + 3
            a = center[i + 1]
            dx, dy = a[0] - x, a[1] - y
            L = math.hypot(dx, dy) or 1
            nx, ny = -dy / L * side * -1, dx / L * side * -1
            for _ in range(2):
                lumps.append(blob(x + nx * w + rng.uniform(-3, 3), y + ny * w + rng.uniform(-4, 4), rng.uniform(1.4, 3), rng.uniform(1.2, 2.4), 6,
                                  0.3, rng))
    s.add(path("".join(lumps), fill="#3b2019", stroke="#0d0605", stroke_width="0.4"))
    inner = offset_poly(center, widths)
    idd = smooth(inner)
    s.add(glow_line(idd, LAVA_O, [(5, 0.4)]))
    s.add(lava_body(s, idd, rng, 15, 0, 85, 300, plates=45, pmin=2, pmax=5))
    # flow lines along the stream
    for k in (-0.45, 0, 0.45):
        pts = []
        for i in range(n + 1):
            x, y = center[i]
            pts.append((x + k * widths[i][0] + rng.uniform(-1, 1), y))
        s.add(path(smooth(pts, close=False), fill="none", stroke=LAVA_CORE, stroke_width="0.9", stroke_opacity="0.55",
                   stroke_dasharray=f"{f(rng.uniform(10, 18))} {f(rng.uniform(6, 12))}"))
    s.add(path(idd, fill="none", stroke=LAVA_CORE, stroke_width="0.8", stroke_opacity="0.7"))
    s.add(embers(s, 10, 10, 80, 280, 18, rng, 0.7))
    return s.render()


@asset("h-scorch-mark", "terrain", [2, 2], "Scorch mark", "Ślad spalenizny",
       tags=["scorch", "burn", "soot", "blast", "explosion", "decal", "spalenizna", "sadza", "wybuch"])
def scorch_mark(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    cx, cy = 100, 100
    s.add(soft_blobs(s, cx, cy, 92, 88, "#0e0806", 0.5, 6, rng, 0.45))
    # radial soot streaks
    rays = []
    for _ in range(48):
        a = rng.uniform(0, 6.283)
        r0 = rng.uniform(18, 30)
        r1 = rng.uniform(55, 94)
        w = rng.uniform(0.06, 0.16)
        p0 = (cx + math.cos(a - w) * r0, cy + math.sin(a - w) * r0)
        p1 = (cx + math.cos(a) * r1, cy + math.sin(a) * r1)
        p2 = (cx + math.cos(a + w) * r0, cy + math.sin(a + w) * r0)
        rays.append(P([p0, p1, p2]))
    s.add(path("".join(rays), fill=s.rg([(0, "#0a0605", 0.65), (0.6, "#0a0605", 0.3), (1, "#0a0605", 0)], cx=cx, cy=cy, r=94, user=True)))
    s.add(halo(s, cx, cy, 46, 44, "#050303", 0.85, mid=0.6))
    # ash-grey burnt core and cinders
    core = blob(cx, cy, 24, 22, 10, 0.25, rng)
    s.add(path(core, fill=s.rg([(0, "#5a514c", 0.65), (0.7, "#2a2421", 0.5), (1, "#2a2421", 0)])))
    cin = []
    for _ in range(45):
        a = rng.uniform(0, 6.283)
        d = rng.uniform(5, 60) * math.sqrt(rng.random())
        cin.append(blob(cx + math.cos(a) * d, cy + math.sin(a) * d, rng.uniform(0.8, 2.4), rng.uniform(0.6, 1.8), 5, 0.3, rng))
    s.add(path("".join(cin), fill="#0d0a09", fill_opacity="0.85"))
    s.add(speckle(s, 40, 40, 120, 120, 70, ["#8a7f78", "#3a3230"], 0.3, 0.9, 0.4))
    s.add(ember_dots(cx, cy, 34, 12, rng, 0.9))
    return s.render()


@asset("h-ash-pile", "terrain", [1, 1], "Ash pile", "Kupka popiołu",
       tags=["ash", "cinders", "embers", "pile", "popiół", "żar", "kupka"])
def ash_pile(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 50, 52
    s.add(soft_blobs(s, cx, cy, 48, 44, "#6e6662", 0.45, 5, rng, 0.4))
    mound = blob(cx, cy, 36, 31, 12, 0.14, rng)
    s.add(shadow(mound, 3, 4, 0.25))
    s.add(path(mound, fill=s.rg([(0, "#c4bcb5"), (0.5, "#8f8781"), (1, "#5c5551")], cx=0.38, cy=0.35, r=0.65)))
    # secondary lumps
    for _ in range(4):
        a = rng.uniform(0, 6.283)
        lx, ly = cx + math.cos(a) * 26, cy + math.sin(a) * 22
        lm = blob(lx, ly, rng.uniform(7, 11), rng.uniform(6, 9), 8, 0.2, rng)
        s.add(path(lm, fill=s.rg([(0, "#b7afa8"), (1, "#6a625e", 0.9)], cx=0.38, cy=0.35, r=0.7)))
    # smouldering cracks near the top
    s.add(glow(s, cx + 3, cy + 2, 20, LAVA_O, 0.4, LAVA_Y))
    hot = []
    for _ in range(5):
        hot.append(blob(cx + rng.uniform(-12, 12), cy + rng.uniform(-10, 10), rng.uniform(1.5, 3.2), rng.uniform(1, 2.2), 6, 0.4, rng))
    s.add(path("".join(hot), fill=LAVA_O, stroke="#3a1208", stroke_width="0.8"))
    s.add(path("".join(hot), fill=LAVA_Y, transform="translate(-0.3 -0.3) "))
    s.add(speckle(s, 18, 22, 64, 56, 120, ["#e6e0da", "#4a4340", "#2a2523"], 0.25, 0.8, 0.55))
    s.add(ember_dots(cx, cy, 20, 9, rng, 0.8))
    return s.render()


@asset("h-pentagram", "dungeon", [3, 3], "Summoning circle", "Krąg przywołania", layer="terrain",
       tags=["pentagram", "summoning", "ritual", "circle", "runes", "occult", "demon", "pentagram", "rytuał", "krąg", "runy"])
def pentagram(seed):
    s = Svg(300, 300, seed)
    rng = s.rng
    cx = cy = 150
    RED, HOT = "#ff2a10", "#ffb27a"
    s.add(halo(s, cx, cy, 148, 148, "#c0150a", 0.28, mid=0.75))
    R1, R2, R3 = 128, 110, 100
    # star
    pts = [(cx + math.cos(-math.pi / 2 + 2 * math.pi * i / 5) * R3, cy + math.sin(-math.pi / 2 + 2 * math.pi * i / 5) * R3) for i in range(5)]
    star = P([pts[(i * 2) % 5] for i in range(5)])
    rings = circle_d(cx, cy, R1) + circle_d(cx, cy, R2) + circle_d(cx, cy, R3) + circle_d(cx, cy, 34)
    runes = ""
    for i in range(22):
        a = 2 * math.pi * (i + 0.5) / 22
        rr = (R1 + R2) / 2
        runes += rune_d(cx + math.cos(a) * rr, cy + math.sin(a) * rr, 9, rng, a + math.pi / 2)
    inner = ""
    for i in range(5):
        a = math.pi / 2 + 2 * math.pi * i / 5
        inner += rune_d(cx + math.cos(a) * 22, cy + math.sin(a) * 22, 6, rng, a + math.pi / 2)
    allp = rings + star + runes + inner
    # scorched-in groove, glow, bright core
    s.add(path(allp, fill="none", stroke="#1a0503", stroke_width="5", stroke_opacity="0.75", stroke_linejoin="round", stroke_linecap="round"))
    s.add(glow_line(allp, RED, [(9, 0.12), (5, 0.3)]))
    s.add(path(allp, fill="none", stroke=RED, stroke_width="2", stroke_linejoin="round", stroke_linecap="round"))
    s.add(path(allp, fill="none", stroke=HOT, stroke_width="0.7", stroke_linejoin="round", stroke_linecap="round", stroke_opacity="0.9"))
    # little dribbles of ash/wax
    s.add(speckle(s, 30, 30, 240, 240, 90, ["#2a0d08", "#6a1a10"], 0.4, 1.3, 0.35))
    for (x, y) in pts:
        a = math.atan2(y - cy, x - cx)
        s.add(candle_black(s, cx + math.cos(a) * 139, cy + math.sin(a) * 139, 4.2, rng))
    return s.render()


# ------------------------------------------------------------------ nature


def faceted(s, pts, apex, base, ink=OBS_D, light=0.22, dark=0.4):
    """Polygon with triangular facets meeting at apex, shaded for top-left light."""
    n = len(pts)
    d = P(pts)
    parts = [path(d, fill=base, stroke=ink, stroke_width="0.8", stroke_linejoin="round")]
    lit_d, dk = {}, {}
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        # facet normal ~ direction from apex to the edge midpoint
        mx, my = (a[0] + b[0]) / 2 - apex[0], (a[1] + b[1]) / 2 - apex[1]
        k = -(mx + my) * 0.7071 / (math.hypot(mx, my) or 1)
        q = round(abs(k) * 4) / 4
        if q == 0:
            continue
        (lit_d if k > 0 else dk).setdefault(q, []).append(P([a, b, apex]))
    for q, ds in lit_d.items():
        parts.append(path("".join(ds), fill="#fff", fill_opacity=f2(q * light)))
    for q, ds in dk.items():
        parts.append(path("".join(ds), fill="#000", fill_opacity=f2(q * dark)))
    parts.append(path("".join(f"M{f(apex[0])} {f(apex[1])}L{f(p[0])} {f(p[1])}" for p in pts), stroke=OBS_L, stroke_width="0.5",
                      stroke_opacity="0.4"))
    return g(parts)


def spire_pts(cx, cy, r, n, rng):
    pts = []
    for i in range(n * 2):
        a = 2 * math.pi * i / (n * 2) + rng.uniform(-0.12, 0.12)
        rr = r * (rng.uniform(0.6, 1.0) if i % 2 == 0 else rng.uniform(0.3, 0.55))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts


@asset("h-rock-spire", "nature", [1, 1], "Basalt spire", "Bazaltowa iglica",
       tags=["rock", "spire", "spike", "basalt", "stone", "skała", "iglica", "bazalt", "kamień"])
def rock_spire(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 48, 47
    s.add(halo(s, 52, 54, 48, 44, "#000", 0.35))
    pts = spire_pts(cx, cy, 44, 8, rng)
    s.add(shadow(P(pts), 6, 8, 0.5))
    s.add(faceted(s, pts, (cx - 3, cy - 4), BASALT))
    # second tier: smaller spire on top
    p2 = spire_pts(cx - 3, cy - 4, 20, 6, rng)
    s.add(shadow(P(p2), 3, 4, 0.4))
    s.add(faceted(s, p2, (cx - 5, cy - 6), shade(BASALT, 0.03)))
    s.add(circle(cx - 5, cy - 6, 1.2, fill="#a898b4", fill_opacity="0.7"))
    # glowing seam at the root of the spikes
    s.add(path(P(pts), fill="none", stroke=LAVA_O, stroke_width="0.6", stroke_opacity="0.35", transform="translate(0.8 0.8)"))
    for _ in range(5):
        a = rng.uniform(0, 6.283)
        s.add(rock(s, cx + math.cos(a) * 44, cy + math.sin(a) * 42, rng.uniform(3, 5), rng.uniform(2.5, 4), rng, base=BASALT, n=6))
    return s.render()


@asset("h-rocks", "nature", [2, 2], "Volcanic rocks", "Skały wulkaniczne",
       tags=["rocks", "boulders", "basalt", "volcanic", "lava", "skały", "głazy", "bazalt", "wulkan"])
def rocks(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    s.add(soft_blobs(s, 100, 104, 92, 86, "#000", 0.3, 4, rng))
    spots = [(70, 78, 42, 34, False), (128, 70, 30, 26, True), (124, 128, 38, 30, False), (64, 138, 24, 20, True), (160, 108, 15, 12, False)]
    hot_glow = []
    for x, y, rx, ry, hot in spots:
        if hot:
            hot_glow.append(glow(s, x, y, rx * 1.6, LAVA_O, 0.35, LAVA_Y))
    s.add(g(hot_glow))
    for x, y, rx, ry, hot in sorted(spots, key=lambda t: t[1]):
        s.add(rock(s, x + rng.uniform(-3, 3), y + rng.uniform(-3, 3), rx, ry, rng, base=vary(rng.choice([OBS, BASALT, "#352b2a"]), rng, l=0.03),
                   n=rng.randint(8, 11), hot=hot))
    for _ in range(12):
        s.add(rock(s, rng.uniform(25, 175), rng.uniform(25, 175), rng.uniform(2.5, 5), rng.uniform(2, 4), rng, base="#4a403e", n=6))
    s.add(embers(s, 40, 40, 120, 120, 10, rng, 0.7))
    return s.render()


@asset("h-dead-tree", "nature", [2, 2], "Charred tree", "Zwęglone drzewo",
       tags=["tree", "dead", "burnt", "charred", "drzewo", "martwe", "spalone", "zwęglone"])
def dead_tree(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    cx, cy = 98, 98
    s.add(soft_blobs(s, cx, cy, 50, 46, "#0d0807", 0.55, 4, rng))
    segs = []  # (x0, y0, x1, y1, w)
    tips = []

    def branch(x, y, a, L, w, depth):
        if depth == 0 or L < 5:
            tips.append((x, y))
            return
        pts = [(x, y)]
        for _ in range(3):
            a += rng.uniform(-0.35, 0.35)
            x += math.cos(a) * L / 3
            y += math.sin(a) * L / 3
            pts.append((x, y))
        for i in range(3):
            t = i / 3
            segs.append((*pts[i], *pts[i + 1], w * (1 - 0.45 * (t + 1 / 3))))
        for _ in range(rng.choice([2, 2, 3])):
            branch(x, y, a + rng.uniform(-0.75, 0.75), L * rng.uniform(0.55, 0.72), w * 0.55, depth - 1)

    for i in range(rng.randint(5, 6)):
        a = 2 * math.pi * i / 5.5 + rng.uniform(-0.3, 0.3)
        branch(cx + math.cos(a) * 8, cy + math.sin(a) * 8, a, rng.uniform(30, 36), 8.5, 4)
    by_w = {}
    for x0, y0, x1, y1, w in segs:
        by_w.setdefault(round(w * 2) / 2, []).append(f"M{f(x0)} {f(y0)}L{f(x1)} {f(y1)}")
    shad = [path("".join(v), stroke_width=f2(w)) for w, v in by_w.items()]
    s.add(g(shad, fill="none", stroke="#000", stroke_opacity="0.35", stroke_linecap="round", transform="translate(5 7)"))
    s.add(g([path("".join(v), stroke_width=f2(w + 1.2)) for w, v in by_w.items()], fill="none", stroke="#050404", stroke_linecap="round"))
    s.add(g([path("".join(v), stroke_width=f2(w)) for w, v in by_w.items()], fill="none", stroke="#1e1716", stroke_linecap="round"))
    s.add(g([path("".join(v), stroke_width=f2(max(0.4, w * 0.3))) for w, v in by_w.items() if w >= 2], fill="none", stroke="#6d5d5a",
            stroke_opacity="0.5", stroke_linecap="round", transform="translate(-0.6 -0.6)"))
    # glowing cracks in the thick limbs
    hot = [f"M{f(x0)} {f(y0)}L{f(x1)} {f(y1)}" for x0, y0, x1, y1, w in segs if w > 3.2 and rng.random() < 0.5]
    s.add(path("".join(hot), fill="none", stroke=LAVA_O, stroke_width="1", stroke_opacity="0.75", stroke_dasharray="3 5 1.5 6",
               stroke_linecap="round"))
    # trunk top (broken, charred) with glowing core
    s.add(circle(cx + 3, cy + 4, 15, fill="#000", fill_opacity="0.35"))
    s.add(path(blob(cx, cy, 13, 12, 10, 0.15, rng), fill="#1a1312", stroke="#050404", stroke_width="1"))
    for r in (10, 7, 4):
        s.add(path(blob(cx, cy, r, r * 0.92, 9, 0.15, rng), fill="none", stroke="#3a2e2b", stroke_width="0.7"))
    s.add(glow(s, cx, cy, 9, LAVA_O, 0.6, LAVA_Y))
    s.add(circle(cx, cy, 2, fill=LAVA_Y))
    gl = []
    for x, y in tips:
        if rng.random() < 0.18:
            gl.append(circle_d(x, y, 1.1))
    s.add(path("".join(gl), fill=EMBER, stroke=LAVA_O, stroke_width="1.6", stroke_opacity="0.35"))
    s.add(embers(s, 40, 40, 120, 120, 12, rng, 0.7))
    return s.render()


@asset("h-fire", "nature", [1, 1], "Hellfire", "Piekielny ogień",
       tags=["fire", "flames", "burning", "hellfire", "ogień", "płomienie", "pożar"])
def hellfire(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 50, 53
    s.add(halo(s, cx, cy, 49, 47, "#120605", 0.6))
    s.add(glow(s, cx, cy, 49, LAVA_O, 0.55, LAVA_Y))
    coals = []
    for _ in range(18):
        a = rng.uniform(0, 6.283)
        d = rng.uniform(6, 30)
        coals.append(blob(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.9, rng.uniform(2, 4.5), rng.uniform(1.5, 3), 6, 0.3, rng))
    s.add(path("".join(coals), fill="#2a120a", stroke="#0d0504", stroke_width="0.5"))
    s.add(path("".join(coals), fill="none", stroke=LAVA_O, stroke_width="0.7", stroke_opacity="0.7", transform="translate(-0.4 -0.4)"))
    for x, y, sz in ((cx - 15, cy + 8, 12), (cx + 16, cy + 10, 11), (cx + 3, cy - 16, 12), (cx - 14, cy - 10, 10), (cx + 17, cy - 8, 10),
                     (cx, cy + 18, 9)):
        s.add(fire(s, x + rng.uniform(-2, 2), y + rng.uniform(-2, 2), sz, rng))
    s.add(fire(s, cx, cy, 17, rng))
    s.add(embers(s, 15, 5, 70, 60, 18, rng, 0.8))
    return s.render()


@asset("h-sulfur-vent", "nature", [1, 1], "Sulfur vent", "Wyziew siarki",
       tags=["sulfur", "brimstone", "vent", "steam", "smoke", "fumarole", "siarka", "wyziew", "para", "dym"])
def sulfur_vent(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 46, 56
    s.add(soft_blobs(s, cx, cy, 44, 40, "#9a8a20", 0.3, 4, rng))
    mound = blob(cx, cy, 33, 27, 14, 0.24, rng, rot=0.4)
    s.add(shadow(mound, 3, 4, 0.35))
    s.add(path(mound, fill=s.rg([(0, "#6a4a32"), (0.6, "#4a3024"), (1, "#2a1a14")], cx=0.38, cy=0.35, r=0.7), stroke="#1a0e0a",
               stroke_width="0.8"))
    dep = []
    for _ in range(9):
        a = rng.uniform(0, 6.283)
        d = rng.uniform(8, 18)
        dep.append(blob(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.85, rng.uniform(4, 9), rng.uniform(3, 6), 8, 0.35, rng, rot=a))
    s.add(path("".join(dep), fill=SULFUR, fill_opacity="0.85"))
    s.add(path("".join(dep), fill="#fff6a8", fill_opacity="0.35", transform="translate(-0.8 -0.8) "))
    s.add(halo(s, cx, cy, 20, 17, "#f2e45a", 0.55))
    crys = []
    for _ in range(30):
        a = rng.uniform(0, 6.283)
        d = rng.uniform(9, 22)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.88
        r = rng.uniform(0.8, 2.2)
        crys.append(P([(x, y - r), (x + r * 0.7, y), (x, y + r), (x - r * 0.7, y)]))
    s.add(path("".join(crys), fill="#fff6a8", stroke="#8a7a1a", stroke_width="0.3"))
    hole = blob(cx, cy, 11, 9, 9, 0.2, rng)
    s.add(path(hole, fill="#2a1a08", stroke="#5a4a12", stroke_width="1.2"))
    s.add(path(hole, fill=s.rg([(0, LAVA_O, 0.85), (0.6, "#7a2a08", 0.6), (1, "#1a0e05", 0)])))
    # steam puffs drifting up-right
    for i in range(6):
        t = i / 5
        px, py = cx + 4 + t * 24 + rng.uniform(-2, 2), cy - 6 - t * 30 + rng.uniform(-2, 2)
        r = 8 + t * 5
        s.add(path(blob(px, py, r, r * 0.85, 9, 0.2, rng), fill=s.rg([(0, "#f4f0d8", 0.55 - t * 0.3), (1, "#e8e2c0", 0)])))
    return s.render()


@asset("h-thorns", "nature", [2, 1], "Hell thorns", "Piekielne ciernie",
       tags=["thorns", "bramble", "briar", "bush", "ciernie", "krzak", "jeżyny", "kolce"])
def thorns(seed):
    s = Svg(200, 100, seed)
    rng = s.rng
    s.add(soft_blobs(s, 100, 52, 96, 44, "#000", 0.35, 5, rng))
    vines, th, tips, buds = [], [], [], []
    for _ in range(22):
        x, y = rng.uniform(20, 180), rng.uniform(25, 75)
        a = rng.uniform(0, 6.283)
        pts = [(x, y)]
        for _ in range(rng.randint(4, 7)):
            a += rng.uniform(-0.6, 0.6)
            x += math.cos(a) * 8
            y += math.sin(a) * 6
            x, y = max(6, min(194, x)), max(8, min(92, y))
            pts.append((x, y))
        vines.append(smooth(pts, close=False))
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            for k in (0.3, 0.75):
                px, py = x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
                L = math.hypot(x1 - x0, y1 - y0) or 1
                nx, ny = -(y1 - y0) / L, (x1 - x0) / L
                sd = rng.choice([-1, 1])
                tx, ty = px + nx * sd * 4.5 + (x1 - x0) / L * 2.5, py + ny * sd * 4.5 + (y1 - y0) / L * 2.5
                th.append(P([(px - (x1 - x0) / L * 0.9, py - (y1 - y0) / L * 0.9), (tx, ty), (px + (x1 - x0) / L * 0.6, py + (y1 - y0) / L * 0.6)]))
                buds.append((px, py))
                if rng.random() < 0.3:
                    tips.append(circle_d(tx, ty, 0.55))
    vd = "".join(vines)
    s.add(path(vd, fill="none", stroke="#000", stroke_opacity="0.4", stroke_width="4", transform="translate(2.5 3.5)", stroke_linecap="round"))
    s.add(path("".join(th), fill="#000", fill_opacity="0.35", transform="translate(2 3)"))
    s.add(path(vd, fill="none", stroke="#0b0708", stroke_width="2.6", stroke_linecap="round"))
    s.add(path(vd, fill="none", stroke="#2e1c24", stroke_width="1.6", stroke_linecap="round"))
    s.add(path("".join(th), fill="#1c1016", stroke="#0b0708", stroke_width="0.4"))
    s.add(path(vd, fill="none", stroke="#7a5a6a", stroke_width="0.6", stroke_opacity="0.5", transform="translate(-0.5 -0.5)"))
    s.add(path("".join(tips), fill="#d8201a"))
    # a few blood-red buds
    for x, y in rng.sample(buds, 7):
        s.add(circle(x + 0.8, y + 1, 2.6, fill="#000", fill_opacity="0.4"))
        s.add(circle(x, y, 2.4, fill="#8a0d12", stroke="#3a0406", stroke_width="0.5"))
        s.add(circle(x - 0.7, y - 0.7, 0.8, fill="#ff6a5a", fill_opacity="0.7"))
    return s.render()


# ------------------------------------------------------------------ dungeon props


@asset("h-bones", "dungeon", [1, 1], "Bone pile", "Stos kości",
       tags=["bones", "skeleton", "remains", "skull", "kości", "szkielet", "szczątki", "czaszka"])
def bones(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    s.add(soft_blobs(s, 50, 52, 46, 42, "#000", 0.3, 4, rng))
    # ribcage fragment
    rc = []
    for i in range(5):
        y = 38 + i * 5
        rc.append(f"M{f(56)} {f(y)}q12 {f(-6 + i)} 20 {f(4 + i * 0.5)}")
    rcd = "".join(rc)
    s.add(path(rcd, fill="none", stroke="#000", stroke_opacity="0.35", stroke_width="3", transform="translate(1.2 1.6)"))
    s.add(path(rcd, fill="none", stroke=BONE_D, stroke_width="3.2", stroke_linecap="round"))
    s.add(path(rcd, fill="none", stroke=BONE, stroke_width="2.2", stroke_linecap="round"))
    s.add(bone(60, 49, 26, 3.4, 92))  # spine
    for _ in range(7):
        s.add(bone(rng.uniform(22, 78), rng.uniform(22, 80), rng.uniform(18, 32), rng.uniform(2.6, 3.8), rng.uniform(0, 180),
                   color=vary(BONE, rng, l=0.04)))
    # small fragments
    fr = "".join(blob(rng.uniform(15, 85), rng.uniform(15, 85), rng.uniform(0.8, 2), rng.uniform(0.6, 1.4), 5, 0.3, rng) for _ in range(14))
    s.add(path(fr, fill=BONE_D))
    s.add(skull(s, 34, 40, 10, ang=rng.uniform(-40, 40)))
    if rng.random() < 0.7:
        s.add(skull(s, 70, 74, 7.5, ang=rng.uniform(100, 200)))
    return s.render()


@asset("h-skulls", "dungeon", [1, 1], "Skull pile", "Stos czaszek",
       tags=["skulls", "bones", "pile", "heap", "czaszki", "kości", "stos"])
def skulls(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    s.add(soft_blobs(s, 50, 54, 46, 42, "#000", 0.4, 4, rng))
    s.add(path(blob(51, 54, 34, 30, 10, 0.15, rng), fill="#2a221c", fill_opacity="0.6"))
    # heap: back ring -> front ring -> top, painter's order top-to-bottom of screen
    spots = []
    for i in range(7):
        a = 2 * math.pi * i / 7 + rng.uniform(-0.15, 0.15)
        spots.append((50 + math.cos(a) * 25, 52 + math.sin(a) * 22, rng.uniform(8.5, 10)))
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.5
        spots.append((50 + math.cos(a) * 10, 48 + math.sin(a) * 9, 9.5))
    spots.append((49, 44, 10.5))
    bones_ = [bone(rng.uniform(25, 75), rng.uniform(25, 80), rng.uniform(16, 24), 2.6, rng.uniform(0, 180)) for _ in range(4)]
    s.add(g(bones_))
    for i, (x, y, r) in enumerate(spots):
        if i == len(spots) - 1:
            s.add(circle(x + 3, y + 4, r * 1.1, fill="#000", fill_opacity="0.35"))
        s.add(skull(s, x, y, r, ang=rng.uniform(-35, 35) + (180 if y < 40 and rng.random() < 0.5 else 0), color=vary(BONE, rng, l=0.05)))
    return s.render()


@asset("h-chains", "dungeon", [1, 1], "Chains", "Łańcuchy",
       tags=["chain", "chains", "shackle", "manacle", "prison", "łańcuch", "kajdany", "okowy", "więzienie"])
def chains(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    # floor ring plate
    s.add(shadow(rect_d(14, 14, 22, 22, 3), 2, 3, 0.4))
    s.add(path(rect_d(14, 14, 22, 22, 3), fill=iron_grad(s, 14, 14, 36, 36), stroke=IRON_D, stroke_width="1"))
    s.add(rivets([(18, 18), (32, 18), (18, 32), (32, 32)], 1.3))
    s.add(circle(25, 25, 7, fill="none", stroke="#000", stroke_opacity="0.4", stroke_width="3.2", transform="translate(1 1.4)"))
    s.add(circle(25, 25, 7, fill="none", stroke=IRON_D, stroke_width="3.6"))
    s.add(circle(25, 25, 7, fill="none", stroke=IRON, stroke_width="2.4"))
    s.add(circle(25, 25, 7, fill="none", stroke=IRON_L, stroke_width="0.7", stroke_opacity="0.6", stroke_dasharray="8 30",
                 transform="rotate(190 25 25)"))
    # two chain runs
    run1 = [(30, 30), (48, 42), (58, 60), (54, 74), (66, 84)]
    run2 = [(31, 22), (52, 18), (74, 26), (84, 44), (78, 58)]
    s.add(chain(run1, link=7, w=2.2))
    s.add(chain(run2, link=7, w=2.2))
    # open shackle at the end of run1, closed cuff at run2
    for (x, y), ang, open_ in (((70, 87), 30, True), ((76, 62), -60, False)):
        arc = (f"M{f(x - 7)} {f(y)}a7 7 0 1 1 14 0" if open_ else circle_d(x, y, 7))
        tf = f"rotate({ang} {x} {y})"
        s.add(path(arc, fill="none", stroke="#000", stroke_opacity="0.4", stroke_width="4", transform=f"translate(1.2 1.6) {tf}"))
        s.add(path(arc, fill="none", stroke=IRON_D, stroke_width="4.6", transform=tf))
        s.add(path(arc, fill="none", stroke=RUST if open_ else IRON, stroke_width="3.2", transform=tf))
        s.add(path(arc, fill="none", stroke=IRON_L, stroke_width="0.8", stroke_opacity="0.5", transform=f"translate(-0.5 -0.5) {tf}"))
        s.add(rivet(x, y - 7 if not open_ else y, 1.4))
    s.add(speckle(s, 20, 20, 70, 70, 25, [RUST, "#4a2a18"], 0.4, 1.2, 0.35))
    return s.render()


@asset("h-spikes", "dungeon", [1, 1], "Iron spike trap", "Pułapka z kolców",
       tags=["spikes", "trap", "pit", "iron", "kolce", "pułapka", "dół", "żelazo"])
def spikes(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    # stone rim
    s.add(shadow(rect_d(4, 4, 92, 92, 3), 2, 3, 0.4))
    s.add(path(rect_d(4, 4, 92, 92, 3), fill=BASALT, stroke=OBS_D, stroke_width="1"))
    for x, y, w, h in ((4, 4, 92, 10), (4, 86, 92, 10), (4, 14, 10, 72), (86, 14, 10, 72)):
        xx = x
        while (w > h and xx < x + w) or (w <= h and xx == x):
            if w > h:
                bw = min(rng.uniform(16, 26), x + w - xx)
                s.add(obsidian_block(s, xx + 0.5, y + 0.5, bw - 1, h - 1, rng, base="#2c2428"))
                xx += bw
            else:
                yy = y
                while yy < y + h:
                    bh = min(rng.uniform(16, 26), y + h - yy)
                    s.add(obsidian_block(s, x + 0.5, yy + 0.5, w - 1, bh - 1, rng, base="#2c2428"))
                    yy += bh
                xx += 1
    # pit interior: darker toward the bottom-right edge (depth)
    s.add(path(rect_d(14, 14, 72, 72), fill="#0e0a0b"))
    s.add(path(rect_d(14, 14, 72, 72), fill=s.lg([(0, "#000", 0.7), (0.25, "#000", 0), (1, "#3a2a26", 0.4)], 0, 0, 1, 1)))
    s.add(path("M14 86V14H86", fill="none", stroke="#000", stroke_width="5", stroke_opacity="0.55"))
    pts = []
    for i in range(5):
        for j in range(5):
            pts.append((22 + i * 14 + rng.uniform(-1.5, 1.5), 22 + j * 14 + rng.uniform(-1.5, 1.5)))
    for x, y in pts:
        s.add(spike(x, y, rng.uniform(5.2, 6), base=vary(IRON, rng, l=0.04),
                    tip="#a01818" if rng.random() < 0.2 else None))
    s.add(speckle(s, 16, 16, 68, 68, 30, [RUST, "#5a1010"], 0.4, 1.3, 0.4))
    return s.render()


@asset("h-obelisk", "dungeon", [1, 1], "Obsidian obelisk", "Obsydianowy obelisk",
       tags=["obelisk", "monolith", "pillar", "runes", "obsidian", "obelisk", "monolit", "runy", "obsydian"])
def obelisk(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 48, 48
    s.add(glow(s, cx, cy, 48, "#c0150a", 0.35))
    # plinth
    s.add(shadow(rect_d(10, 10, 76, 76, 2), 6, 8, 0.45))
    s.add(path(rect_d(10, 10, 76, 76, 2), fill="#2c2428", stroke=OBS_D, stroke_width="1"))
    s.add(path(rect_d(10, 10, 76, 76, 2), fill=s.lg([(0, OBS_L, 0.3), (0.5, OBS_L, 0), (1, "#000", 0.35)], 0, 0, 1, 1)))
    # long cast shadow of the shaft
    s.add(path(P([(30, 66), (66, 30), (92, 56), (56, 92)]), fill="#000", fill_opacity="0.3"))
    # pyramidion of the shaft seen from above: 4 faces
    A, B, C, D = (24, 24), (72, 24), (72, 72), (24, 72)
    apex = (cx, cy)
    s.add(path(P([A, B, apex]), fill="#3a3040"))      # north face: lit
    s.add(path(P([A, D, apex]), fill="#2e2634"))      # west: lit
    s.add(path(P([B, C, apex]), fill="#151118"))      # east: dark
    s.add(path(P([D, C, apex]), fill="#0e0b10"))      # south: darkest
    s.add(path(P([A, B, C, D]), fill="none", stroke=OBS_D, stroke_width="1.2"))
    s.add(path(f"M{f(A[0])} {f(A[1])}L{f(C[0])} {f(C[1])}M{f(B[0])} {f(B[1])}L{f(D[0])} {f(D[1])}", stroke=OBS_L, stroke_width="0.6",
               stroke_opacity="0.6"))
    # glowing runes on each face
    rd = ""
    for (p, q) in ((A, B), (B, C), (C, D), (D, A)):
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        fx, fy = mx + (apex[0] - mx) * 0.38, my + (apex[1] - my) * 0.38
        ang = math.atan2(q[1] - p[1], q[0] - p[0])
        for k in (-1, 0, 1):
            rd += rune_d(fx + math.cos(ang) * k * 7, fy + math.sin(ang) * k * 7, 4.5, rng, ang)
    s.add(glow_line(rd, "#ff2a10", [(2.6, 0.35)]))
    s.add(path(rd, fill="none", stroke="#ff7a4a", stroke_width="0.8", stroke_linecap="round"))
    s.add(circle(cx, cy, 1.6, fill="#ff9a6a"))
    return s.render()


@asset("h-portal", "dungeon", [2, 2], "Hell rift", "Piekielna szczelina",
       tags=["portal", "rift", "gate", "vortex", "hell", "portal", "szczelina", "wir", "piekło"])
def portal(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    cx, cy = 100, 100
    s.add(glow(s, cx, cy, 99, LAVA_O, 0.5, LAVA_Y))
    R = 62
    vortex = circle_d(cx, cy, R)
    cl = s.clip(vortex)
    body = [path(vortex, fill=s.rg([(0, "#000"), (0.25, "#2a0303"), (0.6, "#8a1406"), (0.85, LAVA_O), (1, LAVA_Y)], cx=cx, cy=cy, r=R, user=True))]
    # spiral arms
    for arm in range(7):
        a0 = 2 * math.pi * arm / 7 + rng.uniform(-0.2, 0.2)
        pts = []
        for k in range(26):
            t = k / 25
            r = R * (1.05 - t * 0.95)
            a = a0 + t * 3.4
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        d = smooth(pts, close=False)
        body.append(path(d, fill="none", stroke=LAVA_Y, stroke_width=f2(rng.uniform(2.5, 5)), stroke_opacity=f2(rng.uniform(0.35, 0.6)),
                         stroke_linecap="round"))
        body.append(path(d, fill="none", stroke=LAVA_CORE, stroke_width="0.9", stroke_opacity="0.7", stroke_linecap="round"))
    body.append(circle(cx, cy, R * 0.28, fill=s.rg([(0, "#000", 1), (1, "#000", 0)])))
    s.add(g(body, clip_path=cl))
    s.add(path(vortex, fill="none", stroke=LAVA_CORE, stroke_width="1.2", stroke_opacity="0.8"))
    # rocky ring
    ring = []
    n = 16
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.08, 0.08)
        rr = R + rng.uniform(9, 13)
        ring.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, a))
    for x, y, a in sorted(ring, key=lambda t: t[1]):
        s.add(rock(s, x, y, rng.uniform(11, 15), rng.uniform(9, 12), rng, base=vary(OBS, rng, l=0.03), n=7, hot=rng.random() < 0.3))
    for i in range(8):
        a = 2 * math.pi * i / 8 + rng.uniform(-0.2, 0.2)
        x, y = cx + math.cos(a) * (R + 26), cy + math.sin(a) * (R + 26)
        s.add(spike_side(x - math.cos(a) * 8, y - math.sin(a) * 8, rng.uniform(10, 14), 6, a, base="#262028"))
    s.add(embers(s, 10, 10, 180, 180, 30, rng, 0.9))
    return s.render()


@asset("h-impaled-skull", "dungeon", [0.5, 0.5], "Skull on a spike", "Czaszka na palu",
       tags=["skull", "spike", "pike", "warning", "czaszka", "pal", "ostrzeżenie"])
def impaled_skull(seed):
    s = Svg(50, 50, seed)
    rng = s.rng
    cx, cy = 22, 22
    # long cast shadow of the pole + skull toward the bottom-right
    s.add(path(f"M{f(cx)} {f(cy)}L48 48", stroke="#000", stroke_opacity="0.35", stroke_width="3", stroke_linecap="round"))
    s.add(circle(40, 41, 7, fill="#000", fill_opacity="0.25"))
    s.add(circle(cx, cy, 4, fill=IRON_D))
    s.add(skull(s, cx, cy, 13, ang=rng.uniform(-15, 15), glow_eyes="#ff3a1a"))
    # pike tip poking out through the cranium
    s.add(spike(cx - 1, cy - 8, 3.2))
    s.add(path(f"M{f(cx - 4)} {f(cy - 8)}l-2 -1M{f(cx + 2)} {f(cy - 9)}l2 -1", stroke="#4a3a2a", stroke_width="0.6"))
    return s.render()


# ------------------------------------------------------------------ markers


@asset("h-sigil", "markers", [1, 1], "Demon sigil", "Demoniczna pieczęć", defaultTint="#ff3a1a",
       tags=["sigil", "seal", "rune", "occult", "demon", "marker", "pieczęć", "runa", "znak", "demon"])
def sigil(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 50, 50
    d = circle_d(cx, cy, 44) + circle_d(cx, cy, 38)
    tri = [(cx + math.cos(math.pi / 2 + 2 * math.pi * i / 3) * 38, cy + math.sin(math.pi / 2 + 2 * math.pi * i / 3) * 38) for i in range(3)]
    d += P(tri)
    d += f"M{f(cx)} {f(cy - 30)}V{f(cy + 30)}M{f(cx - 18)} {f(cy - 8)}H{f(cx + 18)}"
    d += f"M{f(cx - 12)} {f(cy - 30)}Q{f(cx)} {f(cy - 18)} {f(cx + 12)} {f(cy - 30)}"
    d += circle_d(cx, cy + 8, 6) + circle_d(cx, cy - 8, 2.5)
    for i in range(3):
        x, y = tri[i]
        d += circle_d(x, y, 3.5)
    for i in range(12):
        a = 2 * math.pi * (i + 0.5) / 12
        d += rune_d(cx + math.cos(a) * 41, cy + math.sin(a) * 41, 4, rng, a + math.pi / 2)
    s.add(path(d, fill="none", stroke="#000", stroke_opacity="0.45", stroke_width="4", stroke_linejoin="round", stroke_linecap="round"))
    s.add(path(d, fill="none", stroke="currentColor", stroke_width="5", stroke_opacity="0.2", stroke_linejoin="round", stroke_linecap="round"))
    s.add(path(d, fill="none", stroke="currentColor", stroke_width="1.8", stroke_linejoin="round", stroke_linecap="round"))
    s.add(path(d, fill="none", stroke="#fff", stroke_width="0.5", stroke_opacity="0.55", stroke_linejoin="round", stroke_linecap="round"))
    return s.render()
