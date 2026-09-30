"""Tiny SVG toolkit for the Tavern & Houses asset pack.

Conventions
- 100 viewBox units per grid cell; viewBox ratio == cells ratio (the app stretches with
  preserveAspectRatio="none").
- Light comes from the top-left; shadows fall to the bottom-right.
- No <style>, <script>, filters or external refs - only shapes, gradients and clip paths,
  which the importer accepts and which rasterise fast.
"""
import colorsys
import math
import random

# ------------------------------------------------------------------ numbers & colours


def f(n):
    s = f"{n:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    if s in ("-0", "-0.0"):
        s = "0"
    return s


def f2(n):
    s = f"{n:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def hex2rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb2hex(r, g, b):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(c * 255))) for c in (r, g, b))


def shade(h, l=0.0, s=0.0, hue=0.0):
    r, g, b = hex2rgb(h)
    H, L, S = colorsys.rgb_to_hls(r, g, b)
    return rgb2hex(*colorsys.hls_to_rgb((H + hue) % 1, max(0, min(1, L + l)), max(0, min(1, S + s))))


def mix(a, b, t):
    A, B = hex2rgb(a), hex2rgb(b)
    return rgb2hex(*(A[i] + (B[i] - A[i]) * t for i in range(3)))


def vary(h, rng, l=0.05, s=0.03, hue=0.008):
    return shade(h, rng.uniform(-l, l), rng.uniform(-s, s), rng.uniform(-hue, hue))


# ------------------------------------------------------------------ element strings


def _attrs(kw):
    out = []
    for k, v in kw.items():
        if v is None:
            continue
        k = k.rstrip("_").replace("_", "-")
        if isinstance(v, float):
            v = f2(v)
        out.append(f'{k}="{v}"')
    return (" " + " ".join(out)) if out else ""


def el(tag, children=None, **kw):
    if children is None or children == "":
        return f"<{tag}{_attrs(kw)}/>"
    if isinstance(children, (list, tuple)):
        children = "".join(children)
    return f"<{tag}{_attrs(kw)}>{children}</{tag}>"


def g(children, **kw):
    if isinstance(children, (list, tuple)):
        children = "".join(c for c in children if c)
    if not children:
        return ""
    return el("g", children, **kw)


def path(d, **kw):
    return el("path", d=d, **kw)


def rect(x, y, w, h, rx=None, **kw):
    return el("rect", x=f(x), y=f(y), width=f(w), height=f(h), rx=f(rx) if rx else None, **kw)


def circle(cx, cy, r, **kw):
    return el("circle", cx=f(cx), cy=f(cy), r=f2(r), **kw)


def ellipse(cx, cy, rx, ry, **kw):
    return el("ellipse", cx=f(cx), cy=f(cy), rx=f2(rx), ry=f2(ry), **kw)


def line(x1, y1, x2, y2, **kw):
    return el("line", x1=f(x1), y1=f(y1), x2=f(x2), y2=f(y2), **kw)


# ------------------------------------------------------------------ path data


def P(pts, close=True):
    d = "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + ("Z" if close else "")


def rect_d(x, y, w, h, r=0):
    if not r:
        return f"M{f(x)} {f(y)}h{f(w)}v{f(h)}h{f(-w)}Z"
    r = min(r, w / 2, h / 2)
    return (f"M{f(x + r)} {f(y)}h{f(w - 2 * r)}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(r)}v{f(h - 2 * r)}"
            f"a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(r)}h{f(-(w - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(-r)}"
            f"v{f(-(h - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(-r)}Z")


def circle_d(cx, cy, r):
    return f"M{f(cx - r)} {f(cy)}a{f2(r)} {f2(r)} 0 1 0 {f2(2 * r)} 0a{f2(r)} {f2(r)} 0 1 0 {f2(-2 * r)} 0Z"


def ellipse_d(cx, cy, rx, ry):
    return f"M{f(cx - rx)} {f(cy)}a{f2(rx)} {f2(ry)} 0 1 0 {f2(2 * rx)} 0a{f2(rx)} {f2(ry)} 0 1 0 {f2(-2 * rx)} 0Z"


def smooth(pts, close=True, t=1.0):
    """Catmull-Rom spline through points -> cubic Bezier path."""
    n = len(pts)
    if n < 3:
        return P(pts, close)
    d = f"M{f(pts[0][0])} {f(pts[0][1])}"
    rng_ = range(n) if close else range(n - 1)
    for i in rng_:
        p0 = pts[(i - 1) % n] if (close or i > 0) else pts[0]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (close or i + 2 < n) else pts[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t)
        d += f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}"
    return d + ("Z" if close else "")


def blob_pts(cx, cy, rx, ry, n, irr, rng, rot=0.0):
    pts = []
    for i in range(n):
        a = rot + 2 * math.pi * i / n
        k = 1 + rng.uniform(-irr, irr)
        pts.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k))
    return pts


def blob(cx, cy, rx, ry, n, irr, rng, rot=0.0):
    return smooth(blob_pts(cx, cy, rx, ry, n, irr, rng, rot))


def wavy(x0, y0, x1, y1, amp, rng, seg=None, close=False):
    """A gently wavy open line from p0 to p1 (quadratic chain)."""
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 1e-6:
        return ""
    seg = seg or max(2, int(L / 14))
    nx, ny = -(y1 - y0) / L, (x1 - x0) / L
    pts = []
    for i in range(seg + 1):
        t = i / seg
        o = rng.uniform(-amp, amp) if 0 < i < seg else rng.uniform(-amp, amp) * 0.4
        pts.append((x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o))
    return smooth(pts, close=False)


def jitter(pts, amt, rng):
    return [(x + rng.uniform(-amt, amt), y + rng.uniform(-amt, amt)) for x, y in pts]


def rot_pts(pts, cx, cy, a):
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


# ------------------------------------------------------------------ document


class Svg:
    def __init__(self, w, h, seed=1):
        self.w, self.h = w, h
        self.rng = random.Random(seed)
        self.defs = []
        self.body = []
        self._n = 0

    def id(self, p="d"):
        self._n += 1
        return f"{p}{self._n}"

    def add(self, *parts):
        for p in parts:
            if p:
                self.body.append(p)

    # gradients -----------------------------------------------------------
    def _stops(self, stops):
        out = []
        for s in stops:
            off, col = s[0], s[1]
            op = s[2] if len(s) > 2 else None
            out.append(el("stop", offset=f2(off), stop_color=col, stop_opacity=(f2(op) if op is not None and op < 1 else None)))
        return "".join(out)

    def lg(self, stops, x1=0, y1=0, x2=0, y2=1, user=False, spread=None, tf=None):
        i = self.id("l")
        conv = (lambda v: f(v)) if user else (lambda v: f2(v))
        self.defs.append(el("linearGradient", self._stops(stops), id=i, x1=conv(x1), y1=conv(y1), x2=conv(x2), y2=conv(y2),
                            gradientUnits="userSpaceOnUse" if user else None, spreadMethod=spread, gradientTransform=tf))
        return f"url(#{i})"

    def rg(self, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None, user=False, tf=None):
        i = self.id("r")
        conv = (lambda v: f(v)) if user else (lambda v: f2(v))
        self.defs.append(el("radialGradient", self._stops(stops), id=i, cx=conv(cx), cy=conv(cy), r=conv(r),
                            fx=conv(fx) if fx is not None else None, fy=conv(fy) if fy is not None else None,
                            gradientUnits="userSpaceOnUse" if user else None, gradientTransform=tf))
        return f"url(#{i})"

    def clip(self, d):
        i = self.id("c")
        self.defs.append(el("clipPath", path(d), id=i))
        return f"url(#{i})"

    def symbol(self, content):
        """A reusable group (defs + <use href>)."""
        i = self.id("s")
        self.defs.append(g(content, id=i))
        return i

    def use(self, sid, x=0, y=0, tf=None, **kw):
        t = tf or (f"translate({f(x)} {f(y)})" if (x or y) else None)
        return el("use", href=f"#{sid}", transform=t, **kw)

    def render(self):
        body = "".join(self.body)
        # Long path data used more than once (shadow copies, clip + fill...) is stored once in <defs>
        # and drawn with <use>; presentation attributes on <use> are inherited by the shared path.
        import re
        counts = {}
        for m in re.finditer(r'<path d="([^"]{160,})"', body):
            counts[m.group(1)] = counts.get(m.group(1), 0) + 1
        shared = {d: self.id("u") for d, n in counts.items() if n >= 2}
        if shared:
            body = re.sub(r'<path d="([^"]{160,})"([^>]*)/>',
                          lambda m: f'<use href="#{shared[m.group(1)]}"{m.group(2)}/>' if m.group(1) in shared else m.group(0), body)
            self.defs.extend(f'<path id="{i}" d="{d}"/>' for d, i in shared.items())
        defs = el("defs", "".join(self.defs)) if self.defs else ""
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(self.w)} {f(self.h)}">'
                + defs + body + "</svg>")


# ------------------------------------------------------------------ shared effects

INK = "#26170c"      # outline colour (dark umber)
SHADOW = "#1b0f06"


def shadow(d, dx=4.0, dy=5.0, op=0.32, soft=3, color=SHADOW):
    """Soft drop shadow without filters: stacked offset copies, darkest near the object."""
    parts = []
    for i in range(1, soft + 1):
        k = i / soft
        parts.append(path(d, transform=f"translate({f(dx * k)} {f(dy * k)})"))
    return g(parts, fill=color, opacity=f2(op / soft * 1.6) if soft > 1 else f2(op))


def grain(x, y, w, h, rng, horizontal=True, n=None, color="#3b2210", op=0.35, width=0.6, amp=None):
    """Wood grain: long, smooth, slightly converging lines plus the odd cathedral arch."""
    # work in "along/across" space, then map back
    L, T = (w, h) if horizontal else (h, w)
    n = n or max(2, int(T / 3.0))
    amp = amp if amp is not None else min(1.0, T / 12)

    def M(a, c):
        return (x + a, y + c) if horizontal else (x + c, y + a)

    strong, faint = [], []
    for i in range(n):
        c = T * (i + rng.uniform(0.2, 0.8)) / n
        a0 = rng.uniform(0, L * 0.3)
        a1 = L - rng.uniform(0, L * 0.3)
        if a1 - a0 < L * 0.25:
            continue
        seg = max(2, int((a1 - a0) / 28))
        pts = []
        drift = rng.uniform(-amp, amp)
        for k in range(seg + 1):
            t = k / seg
            pts.append(M(a0 + (a1 - a0) * t, c + drift * t + rng.uniform(-amp, amp) * 0.6))
        (strong if rng.random() < 0.45 else faint).append(smooth(pts, close=False))
    # cathedral arches (flat-sawn boards)
    if L > 40 and T > 6 and rng.random() < 0.6:
        ca = rng.uniform(L * 0.25, L * 0.75)
        cc = T * rng.uniform(0.35, 0.65)
        for k in range(1, 3):
            span, rise = L * 0.12 * k, T * 0.16 * k
            p0, p1, p2 = M(ca - span, cc - rise), M(ca + span, cc), M(ca - span, cc + rise)
            if cc - rise >= 0 and cc + rise <= T:
                faint.append(f"M{f(p0[0])} {f(p0[1])}Q{f(p1[0])} {f(p1[1])} {f(p2[0])} {f(p2[1])}")
    return g([
        path("".join(strong), fill="none", stroke=color, stroke_width=f2(width), stroke_opacity=f2(op), stroke_linecap="round") if strong else "",
        path("".join(faint), fill="none", stroke=color, stroke_width=f2(width * 0.8), stroke_opacity=f2(op * 0.55), stroke_linecap="round") if faint else "",
    ])


def knot(cx, cy, rx, ry, rng, color="#3b2210", op=0.55, ring=True):
    return g([
        ellipse(cx, cy, rx, ry, fill=color, fill_opacity=f2(op)),
        ellipse(cx, cy, rx * 1.9, ry * 1.7, fill="none", stroke=color, stroke_width="0.5", stroke_opacity=f2(op * 0.6)) if ring else "",
        ellipse(cx - rx * 0.2, cy - ry * 0.2, rx * 0.4, ry * 0.4, fill="#fff", fill_opacity="0.12"),
    ])


def planks(s, x, y, w, h, n, base, horizontal=True, seam="#2a170a", knots=True, nails=True, joints=True,
           tone=0.06, grain_col=None, seam_w=0.8, lengths=(0.45, 1.0)):
    """Plank surface filling a box. Returns a group string."""
    rng = s.rng
    grain_col = grain_col or shade(base, -0.22)
    parts = []
    size = h if horizontal else w
    pw = size / n
    for i in range(n):
        # split plank into 1-2 boards with an end joint
        a0 = (x, y + i * pw) if horizontal else (x + i * pw, y)
        L = w if horizontal else h
        cuts = [0.0]
        if joints and L > 120:
            c = rng.uniform(*lengths) * L
            while c < L - 25:
                cuts.append(c)
                c += rng.uniform(*lengths) * L
        cuts.append(L)
        for j in range(len(cuts) - 1):
            c0, c1 = cuts[j], cuts[j + 1]
            col = vary(base, rng, l=tone)
            if horizontal:
                bx, by, bw, bh = x + c0, a0[1], c1 - c0, pw
            else:
                bx, by, bw, bh = a0[0], y + c0, pw, c1 - c0
            parts.append(rect(bx, by, bw, bh, fill=col))
            parts.append(grain(bx + 1, by + 0.6, bw - 2, bh - 1.2, rng, horizontal=horizontal, color=grain_col, op=0.32))
            if knots and rng.random() < 0.35 and min(bw, bh) > 6:
                if horizontal:
                    kx, ky = bx + rng.uniform(0.15, 0.85) * bw, by + bh * rng.uniform(0.35, 0.65)
                    parts.append(knot(kx, ky, min(3.2, bh * 0.22), min(1.4, bh * 0.1), rng, color=grain_col))
                else:
                    kx, ky = bx + bw * rng.uniform(0.35, 0.65), by + rng.uniform(0.15, 0.85) * bh
                    parts.append(knot(kx, ky, min(1.4, bw * 0.1), min(3.2, bw * 0.22), rng, color=grain_col))
            # top-left highlight on each board
            if horizontal:
                parts.append(path(f"M{f(bx + 0.5)} {f(by + bh - 0.5)}V{f(by + 0.6)}H{f(bx + bw - 0.5)}", fill="none",
                                  stroke="#fff", stroke_opacity="0.13", stroke_width="0.8"))
            else:
                parts.append(path(f"M{f(bx + 0.6)} {f(by + bh - 0.5)}V{f(by + 0.5)}H{f(bx + bw - 0.6)}", fill="none",
                                  stroke="#fff", stroke_opacity="0.13", stroke_width="0.8"))
            if nails and min(bw, bh) > 5:
                for end in (0, 1):
                    if horizontal:
                        nx = bx + (3.2 if end == 0 else bw - 3.2)
                        for k in (0.3, 0.7):
                            parts.append(circle(nx, by + bh * k, 0.55, fill="#2b2622"))
                    else:
                        ny = by + (3.2 if end == 0 else bh - 3.2)
                        for k in (0.3, 0.7):
                            parts.append(circle(bx + bw * k, ny, 0.55, fill="#2b2622"))
            # joint line
            if j > 0:
                if horizontal:
                    parts.append(line(bx, by, bx, by + bh, stroke=seam, stroke_width=f2(seam_w)))
                else:
                    parts.append(line(bx, by, bx + bw, by, stroke=seam, stroke_width=f2(seam_w)))
        if i > 0:
            if horizontal:
                parts.append(line(x, a0[1], x + w, a0[1], stroke=seam, stroke_width=f2(seam_w)))
            else:
                parts.append(line(a0[0], y, a0[0], y + h, stroke=seam, stroke_width=f2(seam_w)))
    return g(parts)


def bevel(d, light="#ffffff", dark="#000000", lo=0.18, do=0.25, w=1.2, dx=0.7, dy=0.7):
    """Rim light on the top-left / rim shade on the bottom-right of a shape (clip-free trick)."""
    return g([
        path(d, fill="none", stroke=dark, stroke_opacity=f2(do), stroke_width=f2(w), transform=f"translate({f2(dx)} {f2(dy)})"),
        path(d, fill="none", stroke=light, stroke_opacity=f2(lo), stroke_width=f2(w), transform=f"translate({f2(-dx)} {f2(-dy)})"),
    ])


def speckle(s, x, y, w, h, n, colors, rmin=0.3, rmax=0.9, op=0.35, clip=None):
    rng = s.rng
    by = {}
    for _ in range(n):
        c = rng.choice(colors)
        r = rng.uniform(rmin, rmax)
        by.setdefault(c, []).append(circle_d(x + rng.uniform(0, w), y + rng.uniform(0, h), r))
    return g([path("".join(v), fill=c) for c, v in by.items()], opacity=f2(op), clip_path=clip)


def flame(cx, cy, size, rng, s):
    """Layered flame tongues seen from above (a bright core with licks toward the top)."""
    parts = []
    glow = s.rg([(0, "#ffd36b", 0.55), (0.5, "#ff8a1f", 0.22), (1, "#ff5a00", 0)])
    parts.append(circle(cx, cy, size * 2.4, fill=glow))
    for col, k in (("#8c1c05", 1.0), ("#e0490f", 0.8), ("#ff9a1c", 0.58), ("#ffd35a", 0.38), ("#fff4c2", 0.18)):
        pts = []
        n = 9
        for i in range(n):
            a = 2 * math.pi * i / n
            rr = size * k * (1 + rng.uniform(-0.25, 0.3))
            # licks point "up" the screen a little (heat rising away from the viewer reads as up)
            stretch = 1.0 + 0.45 * max(0, -math.sin(a))
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * stretch))
        parts.append(path(smooth(pts), fill=col))
    return g(parts)
