"""Seamless floor textures (square, 0 0 100 100; the app tiles one per grid cell x texture scale)."""
import math

from lib import (Svg, blob, blob_pts, circle, circle_d, ellipse, f, f2, g, grain, knot, line, path, P, rect, rect_d, shade, smooth, speckle,
                 vary, wavy)
from reg import pattern

T = 100


def wrap_copies(s, content_fn, x0, x1, y0=None, y1=None):
    """Draw content (a function of dx, dy) again shifted by +-T wherever it crosses the tile edge."""
    out = [content_fn(0, 0)]
    xs = [0]
    if x0 < 0:
        xs.append(T)
    if x1 > T:
        xs.append(-T)
    ys = [0]
    if y0 is not None and y0 < 0:
        ys.append(T)
    if y1 is not None and y1 > T:
        ys.append(-T)
    for dx in xs:
        for dy in ys:
            if dx or dy:
                out.append(content_fn(dx, dy))
    return "".join(out)


@pattern("t-planks", "Tavern floorboards", "Deski karczmy")
def planks_tex(seed):
    s = Svg(T, T, seed)
    rng = s.rng
    n = 5
    bh = T / n
    s.add(rect(0, 0, T, T, fill="#3a2410"))
    base = "#8a5a32"
    for i in range(n):
        y = i * bh
        j1 = (i * 41 + rng.uniform(-8, 8)) % T
        segs = [(j1, j1 + T)]
        for (a, b) in segs:
            col = vary(base, rng, l=0.06, s=0.04)
            gcol = shade(col, -0.2)
            gr = grain(0, y + 0.8, b - a - 1.2, bh - 1.6, rng, n=6, color=gcol, op=0.36, amp=0.5)
            kn = knot(rng.uniform(8, b - a - 8), y + bh * rng.uniform(0.35, 0.65), 2.4, 0.8, rng, color=gcol, op=0.4, ring=False) if (b - a > 30 and rng.random() < 0.3) else ""

            def draw(dx, dy, a=a, b=b, col=col, gr=gr, kn=kn):
                return g([rect(a + 0.6, y + 0.6, b - a - 1.2, bh - 1.2, fill=col),
                          g([gr, kn], transform=f"translate({f(a + 0.6)} 0)"),
                          path(f"M{f(a + 1)} {f(y + bh - 0.9)}V{f(y + 1)}H{f(b - 1)}", fill="none", stroke="#fff", stroke_opacity="0.12", stroke_width="0.8"),
                          path(f"M{f(a + 1)} {f(y + bh - 0.8)}H{f(b - 0.8)}V{f(y + 1)}", fill="none", stroke="#000", stroke_opacity="0.2", stroke_width="0.8"),
                          circle(a + 3, y + bh * 0.3, 0.6, fill="#1f1a16"), circle(a + 3, y + bh * 0.7, 0.6, fill="#1f1a16"),
                          circle(b - 3, y + bh * 0.3, 0.6, fill="#1f1a16"), circle(b - 3, y + bh * 0.7, 0.6, fill="#1f1a16")],
                         transform=f"translate({f(dx)} {f(dy)})" if (dx or dy) else None)
            s.add(wrap_copies(s, draw, a, b))
    # scuffs and a faint ale stain (wrapped)
    for _ in range(3):
        cx, cy = rng.uniform(0, T), rng.uniform(0, T)
        r = rng.uniform(5, 9)
        s.add(wrap_copies(s, lambda dx, dy, cx=cx, cy=cy, r=r: circle(cx + dx, cy + dy, r, fill="none", stroke="#2a1608", stroke_opacity="0.1",
                                                                         stroke_width=f2(r * 0.18)), cx - r, cx + r, cy - r, cy + r))
    return s.render()


@pattern("t-flagstone", "Worn flagstones", "Wytarte płyty kamienne")
def flagstone_tex(seed):
    s = Svg(T, T, seed)
    rng = s.rng
    s.add(rect(0, 0, T, T, fill="#453f37"))
    n = 3
    c = T / n
    jit = {(i, j): (rng.uniform(-5, 5), rng.uniform(-5, 5)) for i in range(n) for j in range(n)}
    # every other row shifted by half a stone (running bond), vertices periodic so edges match across tiles
    def V(i, j):
        jx, jy = jit[(i % n, j % n)]
        return (i * c + (c / 2 if j % 2 else 0) * 0 + jx, j * c + jy)
    tones = {}
    kinds = {(i, j): rng.random() for i in range(n) for j in range(n)}
    colors = {(i, j): vary(rng.choice(["#8d877c", "#948c7c", "#86806f", "#9a9486", "#7f7a70", "#8a8578"]), rng, l=0.04)
              for i in range(n) for j in range(n)}
    hl, dk = [], []
    for j in range(-1, n + 1):
        for i in range(-1, n + 1):
            quad = [V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1)]
            key = (i % n, j % n)
            polys = [quad]
            if kinds[key] < 0.22:      # split into two slabs
                m1 = ((quad[0][0] + quad[1][0]) / 2, (quad[0][1] + quad[1][1]) / 2)
                m2 = ((quad[3][0] + quad[2][0]) / 2, (quad[3][1] + quad[2][1]) / 2)
                polys = [[quad[0], m1, m2, quad[3]], [m1, quad[1], quad[2], m2]]
            for k, pl in enumerate(polys):
                cx = sum(p[0] for p in pl) / len(pl)
                cy = sum(p[1] for p in pl) / len(pl)
                sh = []
                for (px, py) in pl:
                    dx, dy = px - cx, py - cy
                    L = math.hypot(dx, dy) or 1
                    sh.append((px - dx / L * 1.9, py - dy / L * 1.9))
                # rounded corners: midpoints + corners through a spline
                pts = []
                for q in range(len(sh)):
                    a_, b_ = sh[q], sh[(q + 1) % len(sh)]
                    pts.append(a_)
                    pts.append(((a_[0] + b_[0]) / 2, (a_[1] + b_[1]) / 2))
                col = colors[key] if k == 0 else shade(colors[key], 0.04)
                tones.setdefault(col, []).append(smooth(pts, t=0.35))
                hl.append(P([pts[-1], pts[0], pts[1], pts[2]], close=False))
                dk.append(P([pts[3], pts[4], pts[5], pts[6]], close=False))
    for col, ds in tones.items():
        s.add(path("".join(ds), fill=col))
    s.add(path("".join(hl), fill="none", stroke="#fff", stroke_opacity="0.2", stroke_width="1", stroke_linejoin="round"))
    s.add(path("".join(dk), fill="none", stroke="#000", stroke_opacity="0.3", stroke_width="1.1", stroke_linejoin="round"))
    s.add(speckle(s, 3, 3, T - 6, T - 6, 160, ["#5a554c", "#c9c2b0", "#6b6457"], 0.25, 0.75, 0.5))
    cracks = []
    for _ in range(3):
        x, y = rng.uniform(15, 85), rng.uniform(10, 85)
        pts = [(x, y)]
        for _ in range(4):
            x += rng.uniform(-3, 3)
            y += rng.uniform(1.5, 3.5)
            pts.append((x, y))
        cracks.append(P(pts, close=False))
    s.add(path("".join(cracks), fill="none", stroke="#2f2b25", stroke_width="0.5", stroke_opacity="0.8"))
    for _ in range(4):
        x, y = rng.uniform(12, 88), rng.uniform(12, 88)
        s.add(path(blob(x, y, rng.uniform(5, 10), rng.uniform(3, 7), 8, 0.3, rng), fill="#5f7a2a", fill_opacity="0.12"))
    return s.render()


@pattern("t-rushes", "Earth floor with rushes", "Klepisko z sitowiem")
def rushes_tex(seed):
    s = Svg(T, T, seed)
    rng = s.rng
    s.add(rect(0, 0, T, T, fill="#6e5a42"))
    # soft mottling of the packed earth
    for _ in range(26):
        x, y = rng.uniform(0, T), rng.uniform(0, T)
        rx, ry = rng.uniform(6, 16), rng.uniform(4, 12)
        c = rng.choice(["#5f4d38", "#7a6650", "#665340", "#80705a"])
        d = blob(0, 0, rx, ry, 8, 0.3, rng)
        s.add(wrap_copies(s, lambda dx, dy, x=x, y=y, d=d, c=c: path(d, fill=c, fill_opacity="0.55", transform=f"translate({f(x + dx)} {f(y + dy)})"),
                          x - rx, x + rx, y - ry, y + ry))
    # pebbles
    for _ in range(18):
        x, y = rng.uniform(0, T), rng.uniform(0, T)
        r = rng.uniform(0.7, 1.8)
        c = rng.choice(["#8d877c", "#a39a88", "#5a554c"])
        s.add(wrap_copies(s, lambda dx, dy, x=x, y=y, r=r, c=c: circle(x + dx, y + dy, r, fill=c, stroke="#3a3228", stroke_width="0.3"),
                          x - r, x + r, y - r, y + r))
    # strewn rushes / straw
    dk, lt, sh = [], [], []
    for _ in range(95):
        x, y = rng.uniform(0, T), rng.uniform(0, T)
        L = rng.uniform(6, 16)
        a = rng.uniform(0, math.pi)
        bend = rng.uniform(-2, 2)
        x2, y2 = x + math.cos(a) * L, y + math.sin(a) * L
        mx, my = (x + x2) / 2 - math.sin(a) * bend, (y + y2) / 2 + math.cos(a) * bend
        lo_x, hi_x = min(x, x2) - 1, max(x, x2) + 1
        lo_y, hi_y = min(y, y2) - 1, max(y, y2) + 1
        for dx in [0] + ([T] if lo_x < 0 else []) + ([-T] if hi_x > T else []):
            for dy in [0] + ([T] if lo_y < 0 else []) + ([-T] if hi_y > T else []):
                seg = f"M{f(x + dx)} {f(y + dy)}Q{f(mx + dx)} {f(my + dy)} {f(x2 + dx)} {f(y2 + dy)}"
                sh.append(seg)
                (dk if rng.random() < 0.35 else lt).append(seg)
    s.add(path("".join(sh), fill="none", stroke="#2a1e12", stroke_opacity="0.3", stroke_width="1.4", transform="translate(0.6 0.8)"))
    s.add(path("".join(dk), fill="none", stroke="#9a7a3a", stroke_width="0.9", stroke_linecap="round"))
    s.add(path("".join(lt), fill="none", stroke="#d8b867", stroke_width="0.8", stroke_linecap="round"))
    return s.render()


@pattern("t-parquet", "Oak parquet", "Parkiet dębowy")
def parquet_tex(seed):
    s = Svg(T, T, seed)
    rng = s.rng
    s.add(rect(0, 0, T, T, fill="#3a2410"))
    half = T / 2
    n = 3
    pw = half / n
    for bi in range(2):
        for bj in range(2):
            x0, y0 = bi * half, bj * half
            horizontal = (bi + bj) % 2 == 0
            for k in range(n):
                col = vary("#9c6a3a" if horizontal else "#8a5a30", rng, l=0.05)
                if horizontal:
                    x, y, w, h = x0 + 0.5, y0 + k * pw + 0.5, half - 1, pw - 1
                else:
                    x, y, w, h = x0 + k * pw + 0.5, y0 + 0.5, pw - 1, half - 1
                s.add(rect(x, y, w, h, fill=col))
                s.add(grain(x + 0.5, y + 0.5, w - 1, h - 1, rng, horizontal=horizontal, n=4, color=shade(col, -0.2), op=0.4))
                s.add(path(f"M{f(x + 0.5)} {f(y + h - 0.5)}V{f(y + 0.5)}H{f(x + w - 0.5)}", fill="none", stroke="#fff", stroke_opacity="0.13",
                           stroke_width="0.7"))
                s.add(path(f"M{f(x + 0.5)} {f(y + h - 0.4)}H{f(x + w - 0.4)}V{f(y + 0.5)}", fill="none", stroke="#000", stroke_opacity="0.22",
                           stroke_width="0.7"))
    s.add(rect(0, 0, T, T, fill=s.lg([(0, "#fff", 0.04), (1, "#000", 0.04)], 0, 0, 1, 1)))
    return s.render()
