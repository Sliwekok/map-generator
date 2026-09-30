"""Tiny toolkit for seamless (wrap-around) SVG textures, viewBox 0 0 S S."""
import math, random, colorsys
import numpy as np
from scipy.spatial import Voronoi
from shapely.geometry import Polygon, Point, LineString, box
from shapely import affinity

S = 200.0
TILE = box(0, 0, S, S)


def f(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


# ------------------------------------------------------------------ colours
def hexc(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(c * 255)))) for c in rgb)


def parse(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def shade(h, dl=0.0, ds=0.0, dh=0.0):
    r, g, b = parse(h)
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    return hexc(colorsys.hls_to_rgb((hh + dh) % 1, max(0, min(1, l + dl)), max(0, min(1, s + ds))))


def mix(a, b, t):
    A, B = parse(a), parse(b)
    return hexc(tuple(A[i] + (B[i] - A[i]) * t for i in range(3)))


# ------------------------------------------------------------------ periodic noise
class PNoise:
    """Smooth noise that is periodic over S in x and y (sum of integer-frequency waves)."""

    def __init__(self, rng, octaves=6, maxf=4):
        self.w = []
        for _ in range(octaves):
            kx, ky = rng.randint(-maxf, maxf), rng.randint(-maxf, maxf)
            if kx == 0 and ky == 0:
                kx = 1
            a = 1.0 / math.hypot(kx, ky)
            self.w.append((kx, ky, a, rng.random() * 6.283))
        self.norm = sum(a for _, _, a, _ in self.w)

    def __call__(self, x, y):
        v = sum(a * math.sin(6.283185 * (kx * x + ky * y) / S + p) for kx, ky, a, p in self.w)
        return v / self.norm  # ~[-1, 1]


# ------------------------------------------------------------------ geometry helpers
def poly_path(pts, close=True):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + ("Z" if close else "")


def smooth_path(pts, close=True, t=0.5):
    """Catmull-Rom through pts -> cubic bezier path."""
    n = len(pts)
    if n < 3:
        return poly_path(pts, close)
    P = list(pts)
    d = f"M{f(P[0][0])} {f(P[0][1])}"
    rng_ = range(n) if close else range(n - 1)
    for i in rng_:
        p0 = P[(i - 1) % n] if close or i > 0 else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if close or i + 2 < n else P[(i + 1) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}"
    return d + ("Z" if close else "")


def bbox(pts, pad=0.0):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)


def jitter_ring(pts, rng, step=6.0, amp=1.5):
    """Subdivide a closed ring and displace points randomly (rough stone edges)."""
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        L = math.dist(a, b)
        k = max(1, int(L / step))
        for j in range(k):
            t = j / k
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            if j:
                x += rng.gauss(0, amp)
                y += rng.gauss(0, amp)
            out.append((x, y))
    return out


def ring(poly, tol=0.7):
    if poly.is_empty:
        return []
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    if tol:
        poly = poly.simplify(tol)
    return list(poly.exterior.coords)[:-1]


def inset(poly, d, r=0.0):
    g = poly.buffer(-(d + r), join_style=2)
    if r:
        g = g.buffer(r, join_style=1, resolution=4)
    if g.geom_type == "MultiPolygon":
        g = max(g.geoms, key=lambda x: x.area)
    return g


def rand_in(poly, rng, tries=60):
    x0, y0, x1, y1 = poly.bounds
    for _ in range(tries):
        p = (rng.uniform(x0, x1), rng.uniform(y0, y1))
        if poly.contains(Point(p)):
            return p
    c = poly.representative_point()
    return (c.x, c.y)


def periodic_voronoi(n, rng, relax=2, aspect=(1.0, 1.0), seeds=None):
    pts = seeds or [(rng.uniform(0, S), rng.uniform(0, S)) for _ in range(n)]
    for it in range(relax + 1):
        allp = [(x + dx, y + dy) for dx in (-S, 0, S) for dy in (-S, 0, S) for x, y in pts]
        vor = Voronoi(np.array(allp))
        cells = []
        base = 4 * len(pts)  # index of (0,0) copy: order dx=0,dy=0 is 5th block
        for i in range(len(pts)):
            reg = vor.regions[vor.point_region[base + i]]
            cells.append(Polygon([tuple(vor.vertices[j]) for j in reg]).convex_hull)
        if it < relax:
            pts = [((c.centroid.x) % S, (c.centroid.y) % S) for c in cells]
    return pts, cells


def random_walk(start, rng, steps, step_len, angle, turn=0.5):
    pts = [start]
    a = angle
    x, y = start
    for _ in range(steps):
        a += rng.gauss(0, turn)
        x += math.cos(a) * step_len
        y += math.sin(a) * step_len
        pts.append((x, y))
    return pts


# ------------------------------------------------------------------ texture builder
class Tex:
    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.defs = []
        self.els = []
        self._gid = 0

    def gid(self, p="g"):
        self._gid += 1
        return f"{p}{self._gid}"

    def raw(self, el):
        self.els.append(el)

    def add(self, el, bb):
        """Emit el at every wrap offset where its bbox touches the tile."""
        x0, y0, x1, y1 = bb
        for dx in (-S, 0, S):
            for dy in (-S, 0, S):
                if x0 + dx < S and x1 + dx > 0 and y0 + dy < S and y1 + dy > 0:
                    if dx or dy:
                        self.els.append(f'<g transform="translate({f(dx)} {f(dy)})">{el}</g>')
                    else:
                        self.els.append(el)

    def shape(self, pts, smooth=False):
        """Store a path once in <defs>; paint it many times with use()."""
        i = self.gid("s")
        d = smooth_path(pts) if smooth else poly_path(pts)
        self.defs.append(f'<path id="{i}" d="{d}"/>')
        return i, bbox(pts, 3)

    def use(self, sh, dx=0, dy=0, **a):
        i, (x0, y0, x1, y1) = sh
        tr = f' x="{f(dx)}" y="{f(dy)}"' if (dx or dy) else ""
        self.add(f'<use href="#{i}"{tr}{attrs(a)}/>', (x0 + dx, y0 + dy, x1 + dx, y1 + dy))

    # convenience wrappers ------------------------------------------------
    def path(self, d, bb, **a):
        self.add(f'<path d="{d}"{attrs(a)}/>', bb)

    def poly(self, pts, smooth=False, **a):
        d = smooth_path(pts) if smooth else poly_path(pts)
        self.path(d, bbox(pts, a.pop("_pad", 2)), **a)

    def line(self, pts, smooth=True, **a):
        d = smooth_path(pts, close=False) if smooth else poly_path(pts, close=False)
        pad = float(a.get("stroke_width", 1)) + 1
        a.setdefault("fill", "none")
        self.path(d, bbox(pts, pad), **a)

    def circle(self, x, y, r, **a):
        self.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}"{attrs(a)}/>', (x - r, y - r, x + r, y + r))

    def ellipse(self, x, y, rx, ry, rot=0, **a):
        t = f' transform="rotate({f(rot)} {f(x)} {f(y)})"' if rot else ""
        m = max(rx, ry)
        self.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}"{t}{attrs(a)}/>', (x - m, y - m, x + m, y + m))

    def svg(self):
        defs = f"<defs>{''.join(self.defs)}</defs>" if self.defs else ""
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {int(S)} {int(S)}">{defs}{"".join(self.els)}</svg>\n'

    # shared gradients ------------------------------------------------------
    def lin(self, stops, x1=0, y1=0, x2=1, y2=1, gid=None):
        gid = gid or self.gid("l")
        st = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{op}"/>' for o, c, op in stops)
        self.defs.append(f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{st}</linearGradient>')
        return gid

    def rad(self, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None, gid=None):
        gid = gid or self.gid("r")
        st = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{op}"/>' for o, c, op in stops)
        fxy = f' fx="{fx}" fy="{fy}"' if fx is not None else ""
        self.defs.append(f'<radialGradient id="{gid}" cx="{cx}" cy="{cy}" r="{r}"{fxy}>{st}</radialGradient>')
        return gid


def attrs(a):
    out = ""
    for k, v in a.items():
        if k.startswith("_"):
            continue
        k = k.replace("_", "-")
        if isinstance(v, float):
            v = f(v)
        out += f' {k}="{v}"'
    return out


# ------------------------------------------------------------------ reusable painters
def grain(t, n, colors, rmin=0.3, rmax=0.9, op=(0.15, 0.45)):
    rng = t.rng
    for _ in range(n):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        t.circle(x, y, rng.uniform(rmin, rmax), fill=rng.choice(colors), opacity=round(rng.uniform(*op), 2))


def blotches(t, n, colors, rmin, rmax, op=(0.05, 0.18), noise=None):
    rng = t.rng
    for _ in range(n):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        r = rng.uniform(rmin, rmax)
        k = rng.randint(7, 11)
        pts = [(x + math.cos(i / k * 6.283) * r * rng.uniform(0.6, 1.2), y + math.sin(i / k * 6.283) * r * rng.uniform(0.6, 1.2)) for i in range(k)]
        t.poly(pts, smooth=True, fill=rng.choice(colors), opacity=round(rng.uniform(*op), 2))


def stone(t, poly, base, *, bevel=2.2, rough=1.2, step=5, shadow=0.35, sh_off=(1.2, 1.8),
          speckle=8, cracks=(0, 2), chips=(0, 2), hl="shadeTL", dark=None, light=None, smooth=False, pits=0):
    """Paint one bevelled stone from a shapely polygon."""
    rng = t.rng
    dark = dark or shade(base, -0.13)
    light = light or shade(base, 0.08)
    outer = jitter_ring(ring(poly), rng, step, rough)
    if len(outer) < 3:
        return
    op = Polygon(outer).buffer(0)
    # drop shadow into the joint
    osh = t.shape(outer, smooth)
    if shadow:
        t.use(osh, sh_off[0], sh_off[1], fill="#000", opacity=shadow)
    t.use(osh, fill=dark)
    inner_g = inset(op, bevel, 0.8)
    if inner_g.is_empty:
        return
    inner = jitter_ring(ring(inner_g), rng, step * 1.3, rough * 0.6)
    ish = t.shape(inner, smooth)
    t.use(ish, fill=base)
    # top-left rim light
    t.use(ish, fill=f"url(#{hl})")
    ip = Polygon(inner).buffer(0)
    if ip.is_empty or ip.area < 10:
        return
    # mottling inside the face
    for _ in range(rng.randint(1, 3)):
        cx, cy = rand_in(ip, rng)
        r = rng.uniform(3, max(4, math.sqrt(ip.area) * 0.35))
        blob = Point(cx, cy).buffer(r, resolution=5)
        blob = affinity.scale(blob, rng.uniform(0.6, 1.4), rng.uniform(0.6, 1.4))
        g = blob.intersection(ip.buffer(-0.5))
        if not g.is_empty and g.geom_type == "Polygon":
            t.poly(jitter_ring(ring(g), rng, 4, 0.8), smooth=True, fill=rng.choice([dark, light]), opacity=round(rng.uniform(0.1, 0.24), 2))
    # speckles
    for _ in range(speckle):
        x, y = rand_in(ip, rng)
        t.circle(x, y, rng.uniform(0.3, 0.8), fill=rng.choice([shade(base, -0.2), shade(base, 0.15)]), opacity=round(rng.uniform(0.35, 0.8), 2))
    # pits
    for _ in range(pits):
        x, y = rand_in(ip, rng)
        r = rng.uniform(0.6, 1.6)
        t.circle(x + 0.4, y + 0.4, r, fill=shade(base, 0.12), opacity=0.6)
        t.circle(x, y, r, fill=shade(base, -0.25), opacity=0.7)
    # cracks
    for _ in range(rng.randint(*cracks)):
        x, y = rand_in(ip, rng)
        a = rng.uniform(0, 6.283)
        L = math.sqrt(ip.area) * rng.uniform(0.3, 0.8)
        pts = random_walk((x, y), rng, 6, L / 6, a, 0.45)
        ls = LineString(pts).intersection(ip.buffer(-1))
        if ls.is_empty or ls.geom_type != "LineString":
            continue
        c = list(ls.coords)
        t.line([(px + 0.5, py + 0.6) for px, py in c], smooth=False, stroke=shade(base, 0.14), stroke_width=0.7, opacity=0.6, stroke_linecap="round")
        t.line(c, smooth=False, stroke=shade(base, -0.3), stroke_width=0.8, opacity=0.8, stroke_linecap="round")
        if rng.random() < 0.5 and len(c) > 3:
            b = random_walk(c[len(c) // 2], rng, 3, L / 8, a + rng.choice([-1, 1]) * 0.9, 0.4)
            bl = LineString(b).intersection(ip.buffer(-1))
            if not bl.is_empty and bl.geom_type == "LineString":
                t.line(list(bl.coords), smooth=False, stroke=shade(base, -0.3), stroke_width=0.5, opacity=0.7, stroke_linecap="round")
    # chipped corners / edge nicks
    for _ in range(rng.randint(*chips)):
        c = rng.choice(inner)
        cen = ip.centroid
        vx, vy = cen.x - c[0], cen.y - c[1]
        L = math.hypot(vx, vy) or 1
        p = (c[0] + vx / L * 2, c[1] + vy / L * 2)
        r = rng.uniform(1.5, 3.2)
        chip = Point(p).buffer(r, resolution=3).intersection(ip)
        if not chip.is_empty and chip.geom_type == "Polygon":
            t.poly(ring(chip), fill=dark, opacity=0.85)


def std_defs(t):
    t.lin([(0, "#fff", 0.28), (0.45, "#fff", 0), (0.6, "#000", 0), (1, "#000", 0.3)], gid="shadeTL")
    t.rad([(0, "#fff", 0.18), (1, "#fff", 0)], cx=0.35, cy=0.3, r=0.7, gid="sheen")


def pebble(t, x, y, r, base, rot=None, squash=None):
    rng = t.rng
    rot = rng.uniform(0, 180) if rot is None else rot
    sq = rng.uniform(0.55, 0.95) if squash is None else squash
    k = 7 if r < 3 else 9
    pts = []
    for i in range(k):
        a = i / k * 6.283
        rr = r * rng.uniform(0.82, 1.1)
        px, py = math.cos(a) * rr, math.sin(a) * rr * sq
        ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        pts.append((x + px * ca - py * sa, y + px * sa + py * ca))
    sh = t.shape(pts, True)
    t.use(sh, r * 0.18, r * 0.25, fill="#000", opacity=0.35)
    t.use(sh, fill=base)
    if r >= 2.2:
        t.use(sh, fill="url(#shadeTL)")
    t.ellipse(x - r * 0.3, y - r * 0.3 * sq, r * 0.35, r * 0.2, rot, fill="#fff", opacity=0.22)


def tuft(t, x, y, size, colors, blades=7):
    rng = t.rng
    for _ in range(blades):
        a = -math.pi / 2 + rng.gauss(0, 0.9)
        L = size * rng.uniform(0.5, 1.0)
        bx, by = x + rng.gauss(0, size * 0.12), y + rng.gauss(0, size * 0.12)
        tx, ty = bx + math.cos(a) * L, by + math.sin(a) * L
        mx, my = (bx + tx) / 2 + rng.gauss(0, size * 0.15), (by + ty) / 2 + rng.gauss(0, size * 0.15)
        w = size * 0.07
        d = f"M{f(bx - w)} {f(by)}Q{f(mx)} {f(my)} {f(tx)} {f(ty)}Q{f(mx + w)} {f(my)} {f(bx + w)} {f(by)}Z"
        t.path(d, (min(bx, tx) - 3, min(by, ty) - 3, max(bx, tx) + 3, max(by, ty) + 3), fill=rng.choice(colors))


def moss(t, x, y, r, colors, n=None):
    rng = t.rng
    n = n or int(r * 3)
    t.ellipse(x, y, r, r * rng.uniform(0.6, 1), rng.uniform(0, 180), fill=colors[0], opacity=0.55)
    for _ in range(n):
        a = rng.uniform(0, 6.283)
        d = r * math.sqrt(rng.random())
        t.circle(x + math.cos(a) * d, y + math.sin(a) * d, rng.uniform(0.5, 1.6), fill=rng.choice(colors), opacity=round(rng.uniform(0.6, 1), 2))
