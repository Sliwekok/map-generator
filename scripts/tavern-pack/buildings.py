"""Building exteriors (roofs seen from above), wall pieces, doors, windows, stairs, fireplace, yard props."""
import math

from lib import (INK, Svg, bevel, blob, blob_pts, circle, circle_d, el, ellipse, ellipse_d, f, f2, flame, g, grain, jitter, knot,
                 line, mix, path, P, planks, rect, rect_d, rot_pts, shade, shadow, smooth, speckle, vary, wavy)
from reg import asset

# ============================================================== roof machinery

ROT = {"N": 0, "S": 180, "W": -90, "E": 90}


def to_local(pt, origin, eave):
    th = math.radians(-ROT[eave])
    x, y = pt[0] - origin[0], pt[1] - origin[1]
    return (x * math.cos(th) - y * math.sin(th), x * math.sin(th) + y * math.cos(th))


def _seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-9
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def make_keep(poly):
    def keep(u, v, m=3.0):
        inside = False
        n = len(poly)
        for i in range(n):
            (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
            if (y1 > v) != (y2 > v) and u < (x2 - x1) * (v - y1) / (y2 - y1 + 1e-12) + x1:
                inside = not inside
        if inside:
            return True
        return any(_seg_dist(u, v, *poly[i], *poly[(i + 1) % n]) < m for i in range(n))
    return keep


def roof_face(s, poly, eave, origin, material, light=0.0):
    """Draw one roof plane. poly = world polygon; eave = direction the plane slopes down to;
    origin = a world point on the eave line; material(s, u0, u1, V, keep) draws in local space
    (u along the eave, v uphill from the eave)."""
    loc = [to_local(p, origin, eave) for p in poly]
    u0 = min(p[0] for p in loc) - 2
    u1 = max(p[0] for p in loc) + 2
    V = max(p[1] for p in loc) + 2
    keep = make_keep(loc)
    d = P(poly)
    cl = s.clip(d)
    body = material(s, u0, u1, V, keep)
    tf = f"translate({f(origin[0])} {f(origin[1])}) rotate({ROT[eave]})"
    parts = [g(body, transform=tf)]
    # plane shading: lit planes a touch lighter, shaded planes darker toward the eave
    if light > 0:
        parts.append(path(d, fill="#fff3d8", fill_opacity=f2(light)))
    elif light < 0:
        parts.append(path(d, fill="#1a0d05", fill_opacity=f2(-light)))
    return g(parts, clip_path=cl)


def building_shadow(s, d, dx=10, dy=12, op=0.42):
    return shadow(d, dx, dy, op, soft=4)


# ------------------------------------------------------------------ materials


def _pattern(s, w, h, content, x=0, y=0):
    i = s.id("p")
    s.defs.append(el("pattern", content, id=i, patternUnits="userSpaceOnUse", x=f(x), y=f(y), width=f(w), height=f(h)))
    return f"url(#{i})"


def thatch(base="#b8904a"):
    def mat(s, u0, u1, V, keep):
        rng = s.rng
        cs = 15.0
        parts = []
        dark, hi = [], []
        weather = shade(base, -0.12, -0.12)
        # fine straw texture as a small tile (cheap), random coarse strokes on top (irregular)
        tw, th = 13.0, 17.0
        fine_d, fine_l = [], []
        for k in range(9):
            x = tw * (k + rng.uniform(0.1, 0.9)) / 9
            y0 = rng.uniform(-2, th)
            seg = f"M{f(x)} {f(y0 - th)}l{f(rng.uniform(-0.5, 0.5))} {f(th * 0.9)}M{f(x)} {f(y0)}l{f(rng.uniform(-0.5, 0.5))} {f(th * 0.9)}"
            (fine_d if k % 2 else fine_l).append(seg)
        fine = _pattern(s, tw, th, path("".join(fine_d), stroke=shade(base, -0.28), stroke_opacity="0.4", stroke_width="0.6") +
                        path("".join(fine_l), stroke=shade(base, 0.15), stroke_opacity="0.45", stroke_width="0.5"))
        b = -4.0
        while b < V:
            top = b + cs + 7
            # only the stretch of this course that lies on the plane
            xs = [u for u in range(int(u0), int(u1) + 1, 3) if keep(u, b + 2, 8) or keep(u, top - 2, 8)]
            if not xs:
                b += cs
                continue
            c0, c1 = max(u0, xs[0] - 6), min(u1, xs[-1] + 6)
            col = vary(mix(weather, base, min(1, b / (V * 0.55 + 1))), rng, l=0.035)
            parts.append(rect(c0, b - 3.5, c1 - c0, 3.5, fill="#1a0d05", fill_opacity="0.28"))
            edge = []
            u = c0
            while u < c1:
                edge.append((u, b + rng.uniform(-1.4, 1.4)))
                u += rng.uniform(2.4, 4.4)
            edge.append((c1, b))
            dd = f"M{f(c0)} {f(top)}H{f(c1)}" + "".join(f"L{f(x)} {f(y)}" for x, y in reversed(edge)) + "Z"
            parts.append(path(dd, fill=col))
            u = c0
            while u < c1:
                v0 = b + rng.uniform(-1, 1.5)
                if keep(u, v0 + cs * 0.5, 6):
                    ln = cs * rng.uniform(0.55, 1.0)
                    seg = f"M{f(u)} {f(v0)}l{f(rng.uniform(-0.8, 0.8))} {f(ln)}"
                    (dark if rng.random() < 0.6 else hi).append(seg)
                u += rng.uniform(3.0, 5.6)
            b += cs
        parts.append(rect(u0, -4, u1 - u0, V + 8, fill=fine))
        parts.append(path("".join(dark), stroke=shade(base, -0.32), stroke_opacity="0.55", stroke_width="0.9", fill="none"))
        parts.append(path("".join(hi), stroke=shade(base, 0.2), stroke_opacity="0.6", stroke_width="0.7", fill="none"))
        return g(parts, stroke_linecap="round")
    return mat


def shakes(base="#8f6b47"):
    def mat(s, u0, u1, V, keep):
        rng = s.rng
        cs = 11.0
        tones = [shade(base, d) for d in (-0.05, -0.025, 0, 0.025, 0.05)] + [shade(base, -0.03, -0.1), shade(base, 0.02, -0.08)]
        by_tone = {}
        gaps, cracks, shadows_, lights, streaks = [], [], [], [], []
        b = -3.0
        while b < V:
            u = u0 - rng.uniform(0, 10)
            shadows_.append(f"M{f(u0)} {f(b - 2.6)}H{f(u1)}V{f(b)}H{f(u0)}Z")
            lights.append(f"M{f(u0)} {f(b + 0.7)}H{f(u1)}")
            while u < u1:
                w = rng.uniform(6.5, 13.5)
                if keep(u + w / 2, b + cs / 2, 8):
                    t = rng.choice(tones)
                    jb = b + rng.uniform(-0.5, 0.5)
                    by_tone.setdefault(t, []).append(f"M{f(u)} {f(jb)}h{f(w - 0.7)}v{f(cs + 0.6)}h{f(-(w - 0.7))}Z")
                    gaps.append(f"M{f(u + w - 0.35)} {f(jb)}v{f(cs)}")
                    for _ in range(rng.randint(0, 2)):
                        streaks.append(f"M{f(u + rng.uniform(1.2, w - 1.8))} {f(jb + rng.uniform(1, 3))}v{f(rng.uniform(3, cs - 2))}")
                    if rng.random() < 0.14:
                        cu = u + rng.uniform(2, w - 2)
                        cracks.append(f"M{f(cu)} {f(jb + 1)}l{f(rng.uniform(-0.8, 0.8))} {f(rng.uniform(4, cs))}")
                u += w
            b += cs
        parts = [rect(u0, -4, u1 - u0, V + 8, fill=shade(base, -0.35))]
        for t, ds in by_tone.items():
            parts.append(path("".join(ds), fill=t))
        parts.append(path("".join(streaks), stroke=shade(base, -0.3), stroke_width="0.5", stroke_opacity="0.45"))
        parts.append(path("".join(shadows_), fill="#1a0d05", fill_opacity="0.32"))
        parts.append(path("".join(gaps), stroke="#1f140a", stroke_width="0.8", stroke_opacity="0.85"))
        parts.append(path("".join(lights), stroke="#fff", stroke_width="0.6", stroke_opacity="0.14"))
        parts.append(path("".join(cracks), stroke="#1f140a", stroke_width="0.45", stroke_opacity="0.6"))
        return g(parts)
    return mat


def clay_tiles(base="#b5532d"):
    def mat(s, u0, u1, V, keep):
        rng = s.rng
        cw, rh = 11.0, 12.0
        barrel = s.lg([(0, shade(base, -0.2)), (0.3, shade(base, -0.02)), (0.55, shade(base, 0.12)), (0.78, base), (1, shade(base, -0.2))],
                      0, 0, cw, 0, user=True)
        e = 6.0  # row edge position inside the tile
        tile = (rect(0, 0, cw, rh, fill=barrel)
                + path(f"M0 {f(e - 3)}Q{f(cw / 2)} {f(e - 6)} {f(cw)} {f(e - 3)}V{f(e)}Q{f(cw / 2)} {f(e - 3)} 0 {f(e)}Z", fill="#2a0c04", fill_opacity="0.36")
                + path(f"M0 {f(e)}Q{f(cw / 2)} {f(e - 3)} {f(cw)} {f(e)}", fill="none", stroke="#ffd2a8", stroke_opacity="0.32", stroke_width="0.8")
                + line(0, 0, 0, rh, stroke="#3a1206", stroke_opacity="0.25", stroke_width="0.5"))
        pat = _pattern(s, cw, rh, tile, x=u0, y=-e)
        parts = [rect(u0, -4, u1 - u0, V + 8, fill=pat)]
        spots = {}
        v = -e + e  # rows start at v = 0 (edge at v=0 because the pattern is shifted by -e)
        while v < V + rh:
            u = u0
            while u < u1:
                if rng.random() < 0.26 and keep(u + cw / 2, v + rh / 2, 6):
                    c = rng.choice(["#6e2412", "#d27a4a", "#8a3a1c", "#7a6a3a", "#caa060", "#5a1e10"])
                    spots.setdefault(c, []).append(f"M{f(u + 0.6)} {f(v + 0.4)}h{f(cw - 1.2)}v{f(rh - 1.2)}h{f(-(cw - 1.2))}Z")
                u += cw
            v += rh
        for c, ds in spots.items():
            parts.append(path("".join(ds), fill=c, fill_opacity="0.3"))
        for _ in range(int((u1 - u0) * V / 2600)):
            x, y = rng.uniform(u0, u1), rng.uniform(0, V * 0.6)
            if keep(x, y, 0):
                parts.append(path(blob(x, y, rng.uniform(3, 8), rng.uniform(2, 5), 7, 0.35, rng), fill="#b8b070", fill_opacity="0.3"))
        return g(parts)
    return mat


# ------------------------------------------------------------------ ridge, hips, trims


def ridge_tiles(s, p0, p1, w=9, base="#9a3f1e"):
    x0, y0 = p0
    x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
    parts = [rect(0, -w / 2 - 1.5, L, w + 3, fill="#1a0d05", fill_opacity="0.35", transform="translate(2 2.5)"),
             rect(0, -w / 2, L, w, rx=w / 2, fill=s.lg([(0, shade(base, 0.18)), (0.45, base), (1, shade(base, -0.25))], 0, 0, 0, 1),
                  stroke="#3a1206", stroke_width="0.8")]
    seg = []
    t = 0
    while t < L:
        seg.append(f"M{f(t)} {f(-w / 2)}Q{f(t + 3)} 0 {f(t)} {f(w / 2)}")
        t += 14
    parts.append(path("".join(seg), fill="none", stroke="#3a1206", stroke_width="0.8", stroke_opacity="0.8"))
    parts.append(path(f"M2 {f(-w / 2 + 1.5)}H{f(L - 2)}", stroke="#ffd2a8", stroke_opacity="0.35", stroke_width="0.9"))
    return g(parts, transform=f"translate({f(x0)} {f(y0)}) rotate({f(ang)})")


def thatch_ridge(s, p0, p1, w=22, base="#a88040"):
    rng = s.rng
    x0, y0 = p0
    x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
    h = w / 2
    # scalloped (block-cut) edges on both sides
    top, bot = [], []
    t = -h
    while t <= L + h:
        top.append(t)
        t += 15
    d = f"M{f(-h)} 0"
    for i in range(len(top) - 1):
        a, b_ = top[i], top[i + 1]
        d += f"L{f(a)} {f(-h + 2)}Q{f((a + b_) / 2)} {f(-h - 5)} {f(b_)} {f(-h + 2)}"
    d += f"L{f(L + h)} 0"
    for i in range(len(top) - 1, 0, -1):
        a, b_ = top[i], top[i - 1]
        d += f"L{f(a)} {f(h - 2)}Q{f((a + b_) / 2)} {f(h + 5)} {f(b_)} {f(h - 2)}"
    d += "Z"
    parts = [path(d, fill="#1a0d05", fill_opacity="0.4", transform="translate(3 4)"),
             path(d, fill=s.lg([(0, shade(base, 0.12)), (0.5, base), (1, shade(base, -0.2))], 0, 0, 0, 1), stroke="#4a3210", stroke_width="1")]
    straw = []
    t = -h
    while t < L + h:
        yy = rng.uniform(-h + 2, h - 2)
        straw.append(f"M{f(t)} {f(yy)}l{f(rng.uniform(4, 8))} {f(rng.uniform(-0.6, 0.6))}")
        t += rng.uniform(0.9, 1.8)
    parts.append(g(path("".join(straw), stroke=shade(base, -0.3), stroke_opacity="0.45", stroke_width="0.6"), clip_path=s.clip(d)))
    # hazel liggers and cross-spars
    spars = f"M{f(-h + 4)} {f(-h + 5)}H{f(L + h - 4)}M{f(-h + 4)} {f(h - 5)}H{f(L + h - 4)}"
    t = -h + 6
    while t < L + h - 8:
        spars += f"M{f(t)} {f(-h + 5)}L{f(t + 7)} {f(h - 5)}M{f(t + 7)} {f(-h + 5)}L{f(t)} {f(h - 5)}"
        t += 9
    parts.append(path(spars, fill="none", stroke="#5a4020", stroke_width="1.1", stroke_opacity="0.8"))
    parts.append(path(spars, fill="none", stroke="#e8cf90", stroke_width="0.4", stroke_opacity="0.6", transform="translate(-0.4 -0.4)"))
    return g(parts, transform=f"translate({f(x0)} {f(y0)}) rotate({f(ang)})")


def soft_line(p0, p1, color="#1a0d05", op=0.3, width=5.0):
    """A soft crease (hip / valley) built from stacked strokes."""
    parts = []
    for k, w in enumerate((width, width * 0.55, width * 0.2)):
        parts.append(line(*p0, *p1, stroke=color, stroke_opacity=f2(op * (0.35 + 0.3 * k)), stroke_width=f2(w), stroke_linecap="round"))
    return g(parts)


def bargeboard(p0, p1, w=4.5):
    return g([line(*p0, *p1, stroke="#1f140a", stroke_width=f2(w + 1.6), stroke_linecap="square"),
              line(*p0, *p1, stroke="#5a3a1c", stroke_width=f2(w), stroke_linecap="square"),
              line(p0[0] - 0.8, p0[1] - 0.8, p1[0] - 0.8, p1[1] - 0.8, stroke="#c49058", stroke_width="0.8", stroke_opacity="0.5")])


# ------------------------------------------------------------------ chimneys & roof furniture


def stones_in_rect(s, x, y, w, h, base="#8d877c", mortar="#4a453e", size=7.0):
    rng = s.rng
    parts = [rect(x, y, w, h, fill=mortar)]
    by = {}
    row_h = size * 0.8
    yy = y + 0.6
    while yy < y + h - 1:
        rh = min(row_h * rng.uniform(0.8, 1.2), y + h - yy - 0.6)
        xx = x + 0.6 - rng.uniform(0, size * 0.5)
        while xx < x + w - 0.6:
            sw = size * rng.uniform(0.8, 1.5)
            x0, x1 = max(x + 0.6, xx), min(x + w - 0.6, xx + sw - 1)
            if x1 - x0 > 1.2 and rh > 1.2:
                c = vary(base, rng, l=0.08)
                by.setdefault(c, []).append(rect_d(x0, yy, x1 - x0, rh - 1, min(1.5, rh / 3)))
            xx += sw
        yy += rh
    for c, ds in by.items():
        parts.append(path("".join(ds), fill=c))
    return g(parts)


def chimney_stone(s, cx, cy, w, h, flues=1):
    x, y = cx - w / 2, cy - h / 2
    d = rect_d(x, y, w, h, 1.5)
    parts = [shadow(d, 9, 11, 0.5, soft=4)]
    parts.append(g(stones_in_rect(s, x, y, w, h, size=6.5), clip_path=s.clip(d)))
    parts.append(path(d, fill="none", stroke="#1f1c18", stroke_width="1.4"))
    # flues with soot, a thin mortar cap around each
    fw = (w - 14 - (flues - 1) * 6) / flues
    for i in range(flues):
        fx = x + 7 + i * (fw + 6)
        parts.append(rect(fx - 2, y + 5, fw + 4, h - 10, rx=1.5, fill="#6f6a62", stroke="#2a2622", stroke_width="0.8"))
        parts.append(rect(fx, y + 7, fw, h - 14, rx=1, fill="#0d0b09"))
        parts.append(rect(fx - 3, y + 4, fw + 6, h - 8, rx=2, fill=s.rg([(0, "#000", 0.35), (0.7, "#000", 0.1), (1, "#000", 0)], r=0.6)))
    parts.append(bevel(d, lo=0.25, do=0.3, w=1.4))
    return g(parts)


def chimney_brick(s, cx, cy, w, h, pots=2):
    rng = s.rng
    x, y = cx - w / 2, cy - h / 2
    d = rect_d(x, y, w, h, 1)
    parts = [shadow(d, 9, 11, 0.5, soft=4), rect(x, y, w, h, fill="#5a3226")]
    bricks = {}
    bh, bw = 3.6, 8.0
    yy, r = y, 0
    while yy < y + h:
        xx = x - (bw / 2 if r % 2 else 0)
        while xx < x + w:
            c = vary("#9a4a32", rng, l=0.06)
            x0, x1 = max(x, xx + 0.4), min(x + w, xx + bw - 0.4)
            if x1 > x0:
                bricks.setdefault(c, []).append(rect_d(x0, yy + 0.4, x1 - x0, min(bh - 0.8, y + h - yy - 0.4)))
            xx += bw
        yy += bh
        r += 1
    parts.append(g([path("".join(v), fill=c) for c, v in bricks.items()], clip_path=s.clip(d)))
    parts.append(rect(x + 1.5, y + 1.5, w - 3, h - 3, fill="none", stroke="#e8d8c0", stroke_opacity="0.25", stroke_width="1"))
    parts.append(path(d, fill="none", stroke="#1f0f0a", stroke_width="1.3"))
    # clay pots
    for i in range(pots):
        px = x + w * (i + 0.5) / pots
        py = cy
        r_ = min(w / pots, h) * 0.3
        parts.append(circle(px + 2, py + 3, r_ + 1, fill="#1a0d05", fill_opacity="0.4"))
        parts.append(circle(px, py, r_, fill=s.rg([(0, "#e0905a"), (0.7, "#b0582e"), (1, "#6e2a12")], cx=0.35, cy=0.35), stroke="#3a1206", stroke_width="0.9"))
        parts.append(circle(px, py, r_ * 0.6, fill="#120a06"))
        parts.append(circle(px, py, r_ * 0.6, fill="none", stroke="#000", stroke_opacity="0.5", stroke_width=f2(r_ * 0.2)))
    return g(parts)


def smoke(s, cx, cy, n=5, spread=26, scale=1.0):
    rng = s.rng
    parts = []
    for i in range(n):
        t = i / max(1, n - 1)
        x = cx + t * spread + rng.uniform(-3, 3)
        y = cy - t * spread * 0.6 + rng.uniform(-3, 3)
        r = (6 + t * 10) * scale
        parts.append(path(blob(x, y, r, r * 0.8, 8, 0.2, rng), fill="#e8e6e2", fill_opacity=f2(0.34 - t * 0.22)))
    return g(parts)


def moss(s, poly, n, keep_box=None):
    rng = s.rng
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    keep = make_keep(poly)
    parts = []
    tries = 0
    while len(parts) < n and tries < n * 20:
        tries += 1
        x, y = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
        if not keep(x, y, -1):
            continue
        rx, ry = rng.uniform(6, 16), rng.uniform(4, 9)
        parts.append(path(blob(x, y, rx, ry, 8, 0.35, rng), fill=rng.choice(["#5f7a2a", "#6f8a36", "#4f6a24"]), fill_opacity="0.35"))
        parts.append(speckle(s, x - rx, y - ry, rx * 2, ry * 2, 10, ["#8faa4a", "#3f5a1a"], 0.5, 1.2, 0.4))
    return g(parts)


def ivy(s, pts, n=60, spread=9.0):
    """Ivy creeping along a polyline."""
    rng = s.rng
    parts = [path(smooth(pts, close=False), fill="none", stroke="#3a2a14", stroke_width="1.4", stroke_opacity="0.8")]
    segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    leaves = {}
    veins = []
    for _ in range(n):
        (ax, ay), (bx, by) = rng.choice(segs)
        t = rng.random()
        x = ax + (bx - ax) * t + rng.uniform(-spread, spread)
        y = ay + (by - ay) * t + rng.uniform(-spread, spread)
        r = rng.uniform(2.2, 4.2)
        a = rng.uniform(0, 6.28)
        tri = [(x + math.cos(a + k * 2.094) * r, y + math.sin(a + k * 2.094) * r) for k in range(3)]
        lobed = smooth(tri, t=1.6)
        leaves.setdefault(rng.choice(["#2f5a1e", "#3f6f24", "#4f8a2c", "#26481a"]), []).append(lobed)
        veins.append(f"M{f(x)} {f(y)}L{f(tri[0][0])} {f(tri[0][1])}")
    parts.append(g([path("".join(v), fill="#0d1a06", fill_opacity="0.35", transform="translate(1.4 1.8)") for v in leaves.values()]))
    for c, v in leaves.items():
        parts.append(path("".join(v), fill=c, stroke="#152a0c", stroke_width="0.35"))
    parts.append(path("".join(veins), stroke="#9ac46a", stroke_opacity="0.45", stroke_width="0.35"))
    return g(parts)


def pigeon(s, x, y, ang, col="#8d9096"):
    tf = f"rotate({f(ang)} {f(x)} {f(y)})"
    return g([
        ellipse(x + 1.5, y + 2, 6.5, 3.6, fill="#1a0d05", fill_opacity="0.35"),
        path(f"M{f(x - 5)} {f(y)}L{f(x - 10)} {f(y - 3)}L{f(x - 10.5)} {f(y + 3)}Z", fill=shade(col, -0.2), stroke="#2a2c30", stroke_width="0.4"),
        ellipse(x, y, 6, 3.4, fill=s.rg([(0, shade(col, 0.15)), (1, shade(col, -0.2))], cx=0.4, cy=0.35), stroke="#2a2c30", stroke_width="0.5"),
        path(f"M{f(x - 4)} {f(y - 2.6)}Q{f(x + 1)} {f(y - 3.6)} {f(x + 3)} {f(y - 1)}M{f(x - 4)} {f(y + 2.6)}Q{f(x + 1)} {f(y + 3.6)} {f(x + 3)} {f(y + 1)}",
             fill="none", stroke="#4a4d52", stroke_width="0.6"),
        path(f"M{f(x - 2)} {f(y - 1.6)}h3M{f(x - 2)} {f(y + 1.6)}h3", stroke="#2a2c30", stroke_width="0.7"),
        circle(x + 6.2, y, 2.1, fill=shade(col, -0.05), stroke="#2a2c30", stroke_width="0.4"),
        path(f"M{f(x + 8)} {f(y - 0.6)}l1.6 0.6l-1.6 0.6z", fill="#c9a060"),
        circle(x + 6.8, y - 0.9, 0.35, fill="#e0a030"),
        path(f"M{f(x + 4.4)} {f(y - 1.4)}q1 1.4 0 2.8", fill="none", stroke="#5aa07a", stroke_width="0.5", stroke_opacity="0.8"),
    ], transform=tf)


def finial(s, x, y, r=3.4):
    return g([circle(x + 1.5, y + 2, r, fill="#1a0d05", fill_opacity="0.4"),
              circle(x, y, r, fill=s.rg([(0, "#c49058"), (1, "#3d220e")], cx=0.35, cy=0.35), stroke=INK, stroke_width="0.8"),
              circle(x - r * 0.3, y - r * 0.3, r * 0.3, fill="#ffe2b8", fill_opacity="0.5")])


def shingle_patch(s, x, y, w, h, base, vertical=False):
    """A repaired patch of newer, lighter shingles. vertical=True for planes whose eave runs up-down (W/E)."""
    rng = s.rng
    parts = []
    if vertical:
        xx = x
        while xx < x + w:
            yy = y
            while yy < y + h:
                sw = rng.uniform(6, 11)
                parts.append(rect(xx, yy, 10.4, min(sw, y + h - yy) - 0.6, fill=vary(shade(base, 0.1, 0.04), rng, l=0.03)))
                yy += sw
            parts.append(rect(xx + 10.4, y, 1.6, h, fill="#1a0d05", fill_opacity="0.3"))
            xx += 11
    else:
        yy = y
        while yy < y + h:
            xx = x
            while xx < x + w:
                sw = rng.uniform(6, 11)
                parts.append(rect(xx, yy, min(sw, x + w - xx) - 0.6, 10.4, fill=vary(shade(base, 0.1, 0.04), rng, l=0.03)))
                xx += sw
            parts.append(rect(x, yy + 10.4, w, 1.6, fill="#1a0d05", fill_opacity="0.3"))
            yy += 11
    return g(parts, clip_path=s.clip(rect_d(x, y, w, h, 2)), opacity="0.75")

# ============================================================== buildings


@asset("t-cottage", "structures", [4, 3], "Thatched cottage", "Chata kryta strzechą",
       tags=["house", "cottage", "roof", "thatch", "dom", "chata", "strzecha"])
def cottage(seed):
    s = Svg(400, 300, seed)
    rng = s.rng
    x0, y0, x1, y1 = 14, 20, 322, 266
    hd = (y1 - y0) / 2
    ry = y0 + hd
    ra, rb = x0 + hd, x1 - hd
    # lean-to woodshed on the east side (shakes), drawn first so the main eaves overlap it
    lt = [(x1 - 6, 72), (384, 72), (384, 226), (x1 - 6, 226)]
    s.add(building_shadow(s, P([(x0, y0), (x1, y0), (x1, 72), (384, 72), (384, 226), (x1, 226), (x1, y1), (x0, y1)])))
    s.add(roof_face(s, lt, "E", (384, 72), shakes("#86674a"), light=-0.14))
    s.add(bargeboard((x1 - 6, 72), (384, 72), 3.5), bargeboard((x1 - 6, 226), (384, 226), 3.5))
    s.add(line(384, 72, 384, 226, stroke="#1f140a", stroke_width="1.8"))
    # main hipped roof
    N = [(x0, y0), (x1, y0), (rb, ry), (ra, ry)]
    S = [(x0, y1), (x1, y1), (rb, ry), (ra, ry)]
    W = [(x0, y0), (ra, ry), (x0, y1)]
    E = [(x1, y0), (rb, ry), (x1, y1)]
    base = "#bf9650"
    s.add(roof_face(s, N, "N", (x0, y0), thatch(base), light=0.07))
    s.add(roof_face(s, W, "W", (x0, y0), thatch(base), light=0.1))
    s.add(roof_face(s, S, "S", (x1, y1), thatch(base), light=-0.16))
    s.add(roof_face(s, E, "E", (x1, y0), thatch(base), light=-0.24))
    s.add(moss(s, S, 5), moss(s, E, 3))
    for a, b_ in (((ra, ry), (x0, y0)), ((ra, ry), (x0, y1)), ((rb, ry), (x1, y0)), ((rb, ry), (x1, y1))):
        s.add(soft_line(a, b_, op=0.35, width=7))
        s.add(line(a[0] - 1, a[1] - 1, b_[0] - 1, b_[1] - 1, stroke="#f3dc9a", stroke_opacity="0.25", stroke_width="1.2"))
    # shaggy eave outline
    s.add(path(P([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]), fill="none", stroke="#3a2a10", stroke_width="1.6", stroke_opacity="0.9"))
    s.add(thatch_ridge(s, (ra - 16, ry), (rb + 16, ry), 22, "#b08a44"))
    # stone chimney at the west end of the ridge, a wisp of smoke
    s.add(chimney_stone(s, ra + 4, ry, 30, 34, flues=1))
    s.add(smoke(s, ra + 14, ry - 6, 5, 34))
    s.add(ivy(s, [(x0 + 2, 180), (x0 + 6, 230), (x0 + 30, y1 - 2), (x0 + 80, y1 + 2)], 60, 9))
    for rx_, ry_ in ((x0 + 8, 214), (x0 + 22, 248), (x0 + 52, y1 - 3), (x0 + 3, 196)):
        s.add(circle(rx_, ry_, 2.4, fill="#c23a4a", stroke="#6a1020", stroke_width="0.5"), circle(rx_, ry_, 1, fill="#f07a8a"))
    return s.render()


@asset("t-townhouse", "structures", [3, 4], "Timber townhouse", "Kamienica z gontem",
       tags=["house", "townhouse", "roof", "shingle", "dom", "kamienica", "gont"])
def townhouse(seed):
    s = Svg(300, 400, seed)
    x0, y0, x1, y1 = 12, 12, 286, 384
    rx = (x0 + x1) / 2
    s.add(building_shadow(s, rect_d(x0, y0, x1 - x0, y1 - y0)))
    base = "#8a6a4a"
    W = [(x0, y0), (rx, y0), (rx, y1), (x0, y1)]
    E = [(rx, y0), (x1, y0), (x1, y1), (rx, y1)]
    s.add(roof_face(s, W, "W", (x0, y0), shakes(base), light=0.08))
    s.add(roof_face(s, E, "E", (x1, y0), shakes(base), light=-0.22))
    # dormer on the west slope
    dy0, dy1, dx0, dx1 = 176, 236, 30, 104
    dm = (dy0 + dy1) / 2
    dvx = dx1 - (dm - dy0)
    s.add(shadow(P([(dx0, dy0), (dvx, dy0), (dx1, dm), (dvx, dy1), (dx0, dy1)]), 8, 10, 0.55, soft=3))
    s.add(roof_face(s, [(dx0, dy0), (dvx, dy0), (dx1, dm), (dx0, dm)], "N", (dx0, dy0), shakes("#90704f"), light=0.14))
    s.add(roof_face(s, [(dx0, dy1), (dvx, dy1), (dx1, dm), (dx0, dm)], "S", (dx1, dy1), shakes("#90704f"), light=-0.3))
    s.add(soft_line((dvx, dy0), (dx1, dm), op=0.4, width=4), soft_line((dvx, dy1), (dx1, dm), op=0.4, width=4))
    s.add(bargeboard((dx0, dy0), (dx0, dy1), 3.5))
    s.add(ridge_tiles(s, (dx0 - 2, dm), (dx1, dm), 7, "#6b5a4a"))
    # gable bargeboards, eaves and ridge
    s.add(bargeboard((x0, y0), (x1, y0), 5), bargeboard((x0, y1), (x1, y1), 5))
    s.add(line(x0, y0, x0, y1, stroke="#1f140a", stroke_width="2"), line(x1, y0, x1, y1, stroke="#1f140a", stroke_width="2"))
    s.add(shingle_patch(s, 30, 296, 44, 36, base, vertical=True), shingle_patch(s, 172, 100, 33, 40, base, vertical=True))
    s.add(moss(s, [(rx + 8, 200), (x1 - 6, 200), (x1 - 6, y1 - 6), (rx + 8, y1 - 6)], 5))
    s.add(ridge_tiles(s, (rx, y0 - 3), (rx, y1 + 3), 11, "#5a4636"))
    s.add(finial(s, rx, y0 - 2), finial(s, rx, y1 + 2))
    s.add(pigeon(s, rx - 1, 150, 95), pigeon(s, rx + 2, 172, 80, "#a0a3a8"))
    # brick chimneys: one through the ridge, one on the east slope
    s.add(chimney_brick(s, rx, 70, 34, 24, pots=2))
    s.add(chimney_brick(s, 228, 318, 22, 26, pots=1))
    s.add(smoke(s, rx + 8, 62, 5, 30))
    # skylight hatch on the east slope
    s.add(shadow(rect_d(196, 150, 26, 30, 1), 3, 4, 0.45))
    s.add(rect(196, 150, 26, 30, rx=1, fill="#4a2c14", stroke=INK, stroke_width="1.2"))
    s.add(rect(199, 153, 20, 24, fill=s.lg([(0, "#9fb7c0"), (1, "#3f5a66")], 0, 0, 1, 1)))
    s.add(path("M209 153V177M199 165H219", stroke="#2a1a0c", stroke_width="1.4"))
    s.add(path("M201 156l6 0l-6 6z", fill="#fff", fill_opacity="0.35"))
    return s.render()


@asset("t-tavern", "structures", [6, 5], "Tavern (roof)", "Karczma (dach)",
       tags=["tavern", "inn", "roof", "tiles", "karczma", "gospoda", "dach"])
def tavern(seed):
    s = Svg(600, 500, seed)
    rng = s.rng
    X0, Y0, X1, Y1 = 14, 14, 586, 292
    RY = (Y0 + Y1) / 2
    wx0, wx1, wy1 = 344, 560, 484
    wr = (wx0 + wx1) / 2
    wvy = Y1 - (wr - wx0)          # where the wing ridge meets the main south slope
    outline = P([(X0, Y0), (X1, Y0), (X1, Y1), (wx1, Y1), (wx1, wy1), (wx0, wy1), (wx0, Y1), (X0, Y1)])
    # entrance porch (lean-to) on the front, left of the wing
    px0, px1, py1 = 118, 236, 336
    s.add(building_shadow(s, outline))
    s.add(shadow(rect_d(px0, Y1 - 4, px1 - px0, py1 - Y1 + 4), 8, 10, 0.4, soft=3))
    s.add(roof_face(s, [(px0, Y1 - 6), (px1, Y1 - 6), (px1, py1), (px0, py1)], "S", (px1, py1), shakes("#7d5d40"), light=-0.1))
    s.add(bargeboard((px0, Y1 - 6), (px0, py1), 3.5), bargeboard((px1, Y1 - 6), (px1, py1), 3.5))
    s.add(line(px0, py1, px1, py1, stroke="#1f140a", stroke_width="2"))
    for pxx in (px0 + 4, px1 - 4):
        s.add(rect(pxx - 4, py1 - 4, 8, 8, fill="#4a2c14", stroke=INK, stroke_width="1"))
    tiles = clay_tiles("#b25a32")
    s.add(roof_face(s, [(X0, Y0), (X1, Y0), (X1, RY), (X0, RY)], "N", (X0, Y0), tiles, light=0.07))
    s.add(roof_face(s, [(X0, RY), (X1, RY), (X1, Y1), (X0, Y1)], "S", (X1, Y1), tiles, light=-0.16))
    # cross wing
    Wf = [(wx0, wy1), (wx0, Y1), (wr, wvy), (wr, wy1)]
    Ef = [(wx1, wy1), (wx1, Y1), (wr, wvy), (wr, wy1)]
    s.add(shadow(P([(wx0, Y1), (wr, wvy), (wx1, Y1)]), 6, 7, 0.35, soft=3))
    s.add(roof_face(s, Wf, "W", (wx0, wy1), tiles, light=0.1))
    s.add(roof_face(s, Ef, "E", (wx1, Y1), tiles, light=-0.24))
    for a, b_ in (((wx0, Y1), (wr, wvy)), ((wx1, Y1), (wr, wvy))):
        s.add(line(*a, *b_, stroke="#7d8084", stroke_width="4"))
        s.add(soft_line(a, b_, op=0.45, width=6))
    # eaves, gable bargeboards, ridges
    s.add(line(X0, Y0, X1, Y0, stroke="#2a0c04", stroke_width="2"), line(X0, Y1, wx0, Y1, stroke="#2a0c04", stroke_width="2"),
          line(wx1, Y1, X1, Y1, stroke="#2a0c04", stroke_width="2"))
    s.add(line(wx0, Y1, wx0, wy1, stroke="#2a0c04", stroke_width="2"), line(wx1, Y1, wx1, wy1, stroke="#2a0c04", stroke_width="2"))
    s.add(bargeboard((X0, Y0), (X0, Y1), 5), bargeboard((X1, Y0), (X1, Y1), 5), bargeboard((wx0, wy1), (wx1, wy1), 5))
    s.add(ridge_tiles(s, (wr, wvy + 4), (wr, wy1 + 3), 11))
    s.add(ridge_tiles(s, (X0 - 3, RY), (X1 + 3, RY), 12))
    # great stone chimney on the west gable (the hearth), brick stack on the wing
    s.add(chimney_stone(s, 48, RY, 44, 50, flues=2))
    s.add(smoke(s, 60, RY - 12, 6, 44, 1.2))
    s.add(chimney_brick(s, wr, 400, 36, 24, pots=2))
    s.add(smoke(s, wr + 8, 392, 4, 26))
    # louvred cupola with a weathervane on the main ridge
    cx, cy, cr = 270, RY, 24
    s.add(shadow(rect_d(cx - cr, cy - cr, 2 * cr, 2 * cr), 10, 12, 0.45, soft=3))
    for (poly, ev, org, lt) in (([(cx - cr, cy - cr), (cx + cr, cy - cr), (cx, cy)], "N", (cx - cr, cy - cr), 0.07),
                                ([(cx - cr, cy - cr), (cx, cy), (cx - cr, cy + cr)], "W", (cx - cr, cy - cr), 0.1),
                                ([(cx - cr, cy + cr), (cx + cr, cy + cr), (cx, cy)], "S", (cx + cr, cy + cr), -0.18),
                                ([(cx + cr, cy - cr), (cx, cy), (cx + cr, cy + cr)], "E", (cx + cr, cy - cr), -0.26)):
        s.add(roof_face(s, poly, ev, org, shakes("#6b5040"), light=lt))
    s.add(path(f"M{cx - cr} {cy - cr}L{cx + cr} {cy + cr}M{cx + cr} {cy - cr}L{cx - cr} {cy + cr}", stroke="#1f140a", stroke_width="1.6"))
    s.add(rect(cx - cr, cy - cr, 2 * cr, 2 * cr, fill="none", stroke="#1f140a", stroke_width="1.8"))
    s.add(circle(cx, cy, 3.2, fill="#2e2e32", stroke="#111", stroke_width="0.8"))
    s.add(path(f"M{cx} {cy - 17}V{cy + 17}M{cx - 17} {cy}H{cx + 17}", stroke="#1b1b1e", stroke_width="1.6"))
    s.add(path(f"M{cx + 17} {cy}l-5 -3.5v7z", fill="#1b1b1e"))
    s.add(path(f"M{cx - 22} {cy}l6 -4l-2 4l2 4z", fill="#1b1b1e"))
    s.add(path(f"M{cx} {cy - 17}V{cy + 17}M{cx - 17} {cy}H{cx + 17}", stroke="#1b1b1e", stroke_width="4", stroke_opacity="0.25",
               transform="translate(6 8)"))
    # iron sign bracket over the porch
    s.add(line(186, Y1 + 2, 186, py1 + 22, stroke="#1a0d05", stroke_width="3", stroke_opacity="0.35", transform="translate(5 6)"))
    s.add(line(186, py1 - 2, 186, py1 + 22, stroke="#1b1b1e", stroke_width="2.6", stroke_linecap="round"))
    s.add(rect(182.5, py1 + 6, 7, 20, rx=1, fill="#6e4726", stroke=INK, stroke_width="1"))
    s.add(circle(186, py1 + 22, 2.2, fill="#1b1b1e"))
    # dormer on the north slope
    dx0, dx1, dyE = 400, 460, Y0 + 2
    dm = (dx0 + dx1) / 2
    dvy = dyE + 64
    s.add(shadow(P([(dx0, dyE), (dx0, dvy - 30), (dm, dvy), (dx1, dvy - 30), (dx1, dyE)]), 8, 10, 0.5, soft=3))
    s.add(roof_face(s, [(dx0, dyE), (dx0, dvy - 30), (dm, dvy), (dm, dyE)], "W", (dx0, dyE), tiles, light=0.22))
    s.add(roof_face(s, [(dx1, dyE), (dx1, dvy - 30), (dm, dvy), (dm, dyE)], "E", (dx1, dyE), tiles, light=-0.36))
    s.add(soft_line((dx0, dvy - 30), (dm, dvy), op=0.45, width=4), soft_line((dx1, dvy - 30), (dm, dvy), op=0.45, width=4))
    s.add(bargeboard((dx0, dyE), (dx1, dyE), 4))
    s.add(ridge_tiles(s, (dm, dyE - 2), (dm, dvy - 2), 8))
    s.add(finial(s, dm, dyE - 3, 3))
    s.add(ivy(s, [(X0 + 2, 200), (X0 + 10, 240), (X0 + 30, 270), (X0 + 70, Y1 - 2)], 70, 10))
    s.add(ivy(s, [(wx1 - 2, 470), (wx1 - 14, 440), (wx1 - 6, 400)], 36, 8))
    s.add(pigeon(s, 360, RY - 2, 10), pigeon(s, 378, RY + 1, -170, "#a0a3a8"), pigeon(s, 505, RY, 20, "#7d8086"))
    s.add(finial(s, X0 - 3, RY, 4), finial(s, X1 + 3, RY, 4), finial(s, wr, wy1 + 3, 4))
    # lichen on the shaded faces, a few slipped tiles
    for _ in range(5):
        x, y = rng.uniform(40, 330), rng.uniform(RY + 14, Y1 - 10)
        s.add(path(rect_d(x, y, 10, 11, 1), fill="#5a1e10", fill_opacity="0.6", transform=f"rotate({rng.uniform(-14, 14):.0f} {x:.0f} {y:.0f})"))
    return s.render()


# ============================================================== wall pieces (all 0.35 cells thick so they line up)

WT = 35  # wall thickness in units


def end_grain(s, x, y, w, h, base="#7a5230"):
    rng = s.rng
    cx, cy = x + w / 2, y + h / 2
    d = rect_d(x, y, w, h, 1.2)
    parts = [path(d, fill=s.rg([(0, shade(base, 0.12)), (1, shade(base, -0.12))], cx=0.4, cy=0.4, r=0.7))]
    rings = []
    k = 1
    while k * 2.6 < max(w, h) * 0.75:
        rr = k * 2.6
        rings.append(rect_d(cx - rr * w / max(w, h), cy - rr * h / max(w, h), 2 * rr * w / max(w, h), 2 * rr * h / max(w, h), rr * 0.8))
        k += 1
    parts.append(g(path("".join(rings), fill="none", stroke=shade(base, -0.3), stroke_opacity="0.5", stroke_width="0.5"), clip_path=s.clip(d)))
    a = rng.uniform(0, 6.28)
    parts.append(line(cx, cy, cx + math.cos(a) * w * 0.45, cy + math.sin(a) * h * 0.45, stroke="#1f140a", stroke_width="0.7", stroke_opacity="0.8"))
    parts.append(circle(cx, cy, 0.9, fill=shade(base, -0.35)))
    parts.append(path(d, fill="none", stroke=INK, stroke_width="1.1"))
    parts.append(bevel(d, lo=0.25, do=0.25, w=1, dx=0.5, dy=0.5))
    return g(parts)


def plaster(s, x, y, w, h):
    rng = s.rng
    parts = [rect(x, y, w, h, fill=s.lg([(0, "#ece2c8"), (1, "#d3c4a0")]))]
    parts.append(speckle(s, x, y, w, h, int(w * h / 22), ["#b5a482", "#fff8e6", "#9a8a68"], 0.25, 0.7, 0.45))
    cracks = []
    for _ in range(max(1, int(w / 90))):
        cx, cy = x + rng.uniform(8, w - 8), y + rng.uniform(3, h - 3)
        pts = [(cx, cy)]
        for _ in range(4):
            cx += rng.uniform(1.5, 4)
            cy += rng.uniform(-2, 2)
            pts.append((cx, cy))
        cracks.append(P(pts, close=False))
    parts.append(path("".join(cracks), fill="none", stroke="#7a6a4a", stroke_width="0.45", stroke_opacity="0.7"))
    for _ in range(max(1, int(w / 120))):
        px = x + rng.uniform(10, w - 20)
        parts.append(path(blob(px, y + h * rng.uniform(0.3, 0.7), rng.uniform(5, 9), rng.uniform(2.5, 4), 7, 0.3, rng), fill="#b59a70", fill_opacity="0.35"))
    return g(parts)


@asset("t-wall-timber", "structures", [3, 0.35], "Timber-frame wall", "Ściana szachulcowa",
       tags=["wall", "timber", "plaster", "ściana", "mur", "szachulec"])
def wall_timber(seed):
    s = Svg(300, WT, seed)
    rng = s.rng
    s.add(plaster(s, 0, 5, 300, WT - 10))
    for yy in (0, WT - 5):
        s.add(rect(0, yy, 300, 5, fill="#5a3a1c"))
        s.add(grain(0, yy + 0.5, 300, 4, rng, n=2, op=0.45))
    s.add(path("M0 0.8H300", stroke="#e0b07a", stroke_opacity="0.3", stroke_width="0.8"))
    for px, pw in ((0, 5), (95, 10), (195, 10), (295, 5)):
        s.add(rect(px, 0, pw, WT, fill="#4f3118"))
        s.add(grain(px + 0.5, 0.5, pw - 1, WT - 1, rng, horizontal=False, n=2, op=0.5))
        s.add(path(f"M{px + 0.6} 0.6V{WT - 0.6}", stroke="#e0b07a", stroke_opacity="0.25", stroke_width="0.7"))
        if pw == 10:
            s.add(circle(px + 5, 2.5, 0.9, fill="#1f140a"), circle(px + 5, WT - 2.5, 0.9, fill="#1f140a"))
    s.add(line(0, 0.5, 300, 0.5, stroke=INK, stroke_width="1.2"), line(0, WT - 0.5, 300, WT - 0.5, stroke=INK, stroke_width="1.2"))
    s.add(line(0, 5, 300, 5, stroke="#2a170a", stroke_width="0.7"), line(0, WT - 5, 300, WT - 5, stroke="#2a170a", stroke_width="0.7"))
    return s.render()


def rubble(s, x, y, w, h, rows=2):
    """Irregular fieldstones packed in mortar; some long through-stones span the full thickness."""
    rng = s.rng
    parts = [rect(x, y, w, h, fill="#3a352e")]
    by = {}
    hl, dk = [], []
    xx = x - rng.uniform(0, 10)
    while xx < x + w:
        if rng.random() < 0.22:
            cols = [(y, h)]           # through-stone
            sw = rng.uniform(14, 22)
        else:
            split = h * rng.uniform(0.38, 0.62)
            cols = [(y, split), (y + split, h - split)]
            sw = rng.uniform(16, 30)
        for (yy, hh) in cols:
            ww = sw * rng.uniform(0.75, 1.0) if len(cols) > 1 else sw
            ox = xx + (sw - ww) * rng.random()
            m = 1.1
            pts = [(ox + m + rng.uniform(0, 2.5), yy + m + rng.uniform(0, 1.8)),
                   (ox + ww * rng.uniform(0.35, 0.65), yy + m + rng.uniform(-0.3, 1.2)),
                   (ox + ww - m - rng.uniform(0, 2.5), yy + m + rng.uniform(0, 1.8)),
                   (ox + ww - m - rng.uniform(-0.5, 1.2), yy + hh * rng.uniform(0.4, 0.6)),
                   (ox + ww - m - rng.uniform(0, 2.5), yy + hh - m - rng.uniform(0, 1.8)),
                   (ox + ww * rng.uniform(0.35, 0.65), yy + hh - m - rng.uniform(-0.3, 1.2)),
                   (ox + m + rng.uniform(0, 2.5), yy + hh - m - rng.uniform(0, 1.8)),
                   (ox + m + rng.uniform(-0.5, 1.2), yy + hh * rng.uniform(0.4, 0.6))]
            c = vary(rng.choice(["#8f887b", "#9a9282", "#857d70", "#a39a88", "#7d7a72", "#8a8070"]), rng, l=0.04)
            by.setdefault(c, []).append(smooth(pts, t=0.55))
            hl.append(f"M{f(pts[7][0])} {f(pts[7][1])}L{f(pts[0][0])} {f(pts[0][1])}L{f(pts[1][0])} {f(pts[1][1])}")
            dk.append(f"M{f(pts[3][0])} {f(pts[3][1])}L{f(pts[4][0])} {f(pts[4][1])}L{f(pts[5][0])} {f(pts[5][1])}")
        xx += sw
    for c, ds in by.items():
        parts.append(path("".join(ds), fill=c, stroke="#2a2622", stroke_width="0.6"))
    parts.append(path("".join(hl), fill="none", stroke="#fff", stroke_opacity="0.28", stroke_width="0.9", stroke_linejoin="round"))
    parts.append(path("".join(dk), fill="none", stroke="#000", stroke_opacity="0.3", stroke_width="1", stroke_linejoin="round"))
    parts.append(speckle(s, x, y, w, h, int(w * h / 70), ["#5a554c", "#c9c2b0"], 0.25, 0.6, 0.45))
    return g(parts, clip_path=s.clip(rect_d(x, y, w, h)))


@asset("t-wall-stone", "structures", [3, 0.35], "Fieldstone wall", "Mur z kamienia polnego",
       tags=["wall", "stone", "ściana", "mur", "kamień"])
def wall_stone(seed):
    s = Svg(300, WT, seed)
    s.add(rubble(s, 0, 0, 300, WT, rows=2))
    s.add(rect(0, 0, 300, WT, fill=s.lg([(0, "#fff", 0.1), (0.5, "#fff", 0), (1, "#000", 0.2)])))
    s.add(line(0, 0.5, 300, 0.5, stroke="#1f1c18", stroke_width="1.2"), line(0, WT - 0.5, 300, WT - 0.5, stroke="#1f1c18", stroke_width="1.2"))
    return s.render()


@asset("t-post", "structures", [0.35, 0.35], "Timber post / corner", "Słup / narożnik", tags=["post", "corner", "beam", "słup", "narożnik"])
def post(seed):
    s = Svg(WT, WT, seed)
    s.add(end_grain(s, 1, 1, WT - 2, WT - 2, "#6e4726"))
    return s.render()


def door_frame(s, W):
    """Posts at both ends + stone threshold between them."""
    parts = [rect(8, 2, W - 16, WT - 4, fill="#8a8478")]
    parts.append(speckle(s, 8, 2, W - 16, WT - 4, int(W / 2), ["#5a554c", "#c9c2b0"], 0.25, 0.6, 0.5))
    parts.append(rect(8, 2, W - 16, WT - 4, fill=s.lg([(0, "#fff", 0.12), (1, "#000", 0.2)])))
    parts.append(path(f"M8 2H{W - 8}M8 {WT - 2}H{W - 8}", stroke="#2a2622", stroke_width="1"))
    parts.append(end_grain(s, 0, 0, 10, WT, "#5a3a1c"))
    parts.append(end_grain(s, W - 10, 0, 10, WT, "#5a3a1c"))
    return g(parts)


def door_leaf(s, x, y, L, t, hinge_left=True):
    """A plank door leaf seen from above: planks across, iron straps, ring pulls, hinge knuckles."""
    rng = s.rng
    d = rect_d(x, y, L, t, 1)
    parts = [shadow(d, 1.6, 2.2, 0.5, soft=2), path(d, fill="#6e4726")]
    n = max(3, round(L / 15))
    seams = []
    for i in range(n):
        px = x + L * i / n
        parts.append(rect(px, y, L / n, t, fill=vary("#7d5230", rng, l=0.05)))
        if i:
            seams.append(f"M{f(px)} {f(y)}v{f(t)}")
    parts.append(path("".join(seams), stroke="#1f140a", stroke_width="0.8"))
    for sx in (x + L * 0.18, x + L * 0.78):
        parts.append(rect(sx - 2.2, y - 0.6, 4.4, t + 1.2, fill="#2e2e32", stroke="#111", stroke_width="0.5"))
        parts.extend([circle(sx, y + 1.2, 0.6, fill="#9aa0a6"), circle(sx, y + t - 1.2, 0.6, fill="#9aa0a6")])
    hx = x + 1.5 if hinge_left else x + L - 1.5
    parts.append(circle(hx, y + t / 2, 2.4, fill="#2e2e32", stroke="#111", stroke_width="0.6"))
    rx_ = x + L - 9 if hinge_left else x + 9
    for ry, sgn in ((y, -1), (y + t, 1)):
        parts.append(circle(rx_, ry + sgn * 2.2, 2.3, fill="none", stroke="#1b1b1e", stroke_width="1.2"))
        parts.append(circle(rx_, ry, 1.2, fill="#2e2e32"))
    parts.append(path(d, fill="none", stroke=INK, stroke_width="1"))
    parts.append(path(f"M{f(x + 0.8)} {f(y + t - 0.8)}V{f(y + 0.8)}H{f(x + L - 0.8)}", fill="none", stroke="#f0c890", stroke_opacity="0.3", stroke_width="0.7"))
    return g(parts)


@asset("t-door", "structures", [1, 0.35], "Plank door", "Drzwi z desek", tags=["door", "entrance", "drzwi", "wejście"])
def door(seed):
    s = Svg(100, WT, seed)
    s.add(door_frame(s, 100))
    s.add(door_leaf(s, 10, 11, 80, 13))
    return s.render()


@asset("t-door-double", "structures", [2, 0.35], "Double tavern door", "Drzwi dwuskrzydłowe",
       tags=["door", "double", "entrance", "gate", "drzwi", "wrota"])
def door_double(seed):
    s = Svg(200, WT, seed)
    s.add(door_frame(s, 200))
    s.add(door_leaf(s, 10, 11, 90, 13, hinge_left=True))
    s.add(door_leaf(s, 100, 11, 90, 13, hinge_left=False))
    s.add(rect(92, 9.5, 16, 3, rx=1, fill="#2e2e32", stroke="#111", stroke_width="0.5"))
    s.add(rect(97, 8, 6, 6, rx=1, fill="#3a3a3e", stroke="#111", stroke_width="0.5"))
    return s.render()


@asset("t-door-open", "structures", [1, 1.2], "Open door", "Otwarte drzwi", tags=["door", "open", "drzwi", "otwarte"])
def door_open(seed):
    s = Svg(100, 120, seed)
    s.add(door_frame(s, 100))
    # worn floor where the door swings
    s.add(path("M12 30A82 82 0 0 1 92 30", fill="none", stroke="#000", stroke_opacity="0.08", stroke_width="4", transform="translate(0 0)"))
    s.add(g(door_leaf(s, 0, 0, 80, 13, hinge_left=True), transform="translate(23.5 22) rotate(90)"))
    return s.render()


@asset("t-window", "structures", [1, 0.35], "Leaded window", "Okno ołowiane", tags=["window", "glass", "okno", "szyba"])
def window(seed):
    s = Svg(100, WT, seed)
    rng = s.rng
    s.add(end_grain(s, 0, 0, 10, WT, "#5a3a1c"), end_grain(s, 90, 0, 10, WT, "#5a3a1c"))
    # outer stone sill
    s.add(rect(10, 1, 80, 15, fill="#9a9384"))
    s.add(speckle(s, 10, 1, 80, 15, 40, ["#5a554c", "#d9d2c0"], 0.25, 0.6, 0.5))
    s.add(rect(10, 1, 80, 15, fill=s.lg([(0, "#fff", 0.15), (1, "#000", 0.2)])))
    # leaded glazing seen edge-on
    s.add(rect(10, 15, 80, 5, fill=s.lg([(0, "#dbeaf0"), (0.5, "#8fb3c0"), (1, "#4f7280")])))
    s.add(path("".join(f"M{x} 15v5" for x in range(18, 90, 8)), stroke="#2e3336", stroke_width="1.1"))
    s.add(path("M10 15H90M10 20H90", stroke="#2e3336", stroke_width="0.8"))
    s.add(rect(49, 13.5, 2.4, 8, fill="#4a2c14", stroke=INK, stroke_width="0.5"))
    # inner oak sill with a potted herb and a candle stub
    s.add(rect(10, 20, 80, 14, fill="#8a5a30"))
    s.add(grain(11, 21, 78, 12, rng, n=3, op=0.4))
    s.add(path("M10 20.8H90", stroke="#1f140a", stroke_width="1"))
    s.add(shadow(circle_d(72, 27.5, 4.6), 1, 1.4, 0.45, soft=2))
    s.add(circle(72, 27.5, 4.6, fill="#b0582e", stroke="#5a2a10", stroke_width="0.6"))
    for k in range(7):
        a = k * 0.9
        s.add(ellipse(72 + math.cos(a) * 2.2, 27.5 + math.sin(a) * 2.2, 2, 1.1, fill=["#4f8a2a", "#3f6f24", "#6fa33a"][k % 3],
                      transform=f"rotate({f(math.degrees(a))} {f(72 + math.cos(a) * 2.2)} {f(27.5 + math.sin(a) * 2.2)})"))
    s.add(circle(28, 27, 2.6, fill="#efe4cc", stroke="#8a7a58", stroke_width="0.5"), circle(28, 27, 0.5, fill="#222"))
    s.add(line(10, 0.5, 90, 0.5, stroke="#2a2622", stroke_width="1"), line(10, WT - 0.5, 90, WT - 0.5, stroke=INK, stroke_width="1.1"))
    return s.render()


# ============================================================== stairs, hearth


@asset("t-stairs", "structures", [1, 2], "Wooden staircase", "Schody drewniane", tags=["stairs", "steps", "up", "down", "schody"])
def stairs(seed):
    s = Svg(100, 200, seed)
    rng = s.rng
    x0, x1 = 14, 84
    top, bot = 6, 194
    n = 14
    th = (bot - top) / n
    s.add(shadow(rect_d(4, top, 92, bot - top), 4, 5, 0.4))
    for i in range(n):
        y = top + i * th
        depth = i / (n - 1)          # 0 = top step (highest), 1 = bottom
        base = shade("#a4733f", 0.07 - depth * 0.12)
        s.add(rect(x0, y, x1 - x0, th, fill=vary(base, rng, l=0.025)))
        s.add(grain(x0 + 1, y + 1, x1 - x0 - 2, th - 2, rng, n=3, op=0.35))
        s.add(ellipse((x0 + x1) / 2 + rng.uniform(-4, 4), y + th * 0.55, 16, th * 0.28, fill="#f3d8a8", fill_opacity="0.14"))
        # rounded nosing on the front edge, and the shadow this tread throws on the step below
        s.add(rect(x0, y + th - 3, x1 - x0, 3, fill=s.lg([(0, "#f7dcae", 0.55), (0.5, "#f7dcae", 0.1), (1, "#2a1608", 0.55)])))
        if i < n - 1:
            s.add(rect(x0, y + th, x1 - x0, 4.5, fill=s.lg([(0, "#1a0d05", 0.55), (1, "#1a0d05", 0)])))
        s.add(line(x0, y + th, x1, y + th, stroke="#1f1108", stroke_width="0.9"))
        s.add(circle(x0 + 3, y + th / 2, 0.7, fill="#2b2622"), circle(x1 - 3, y + th / 2, 0.7, fill="#2b2622"))
    # the lower steps sink into shadow
    s.add(rect(x0, top, x1 - x0, bot - top, fill=s.lg([(0, "#000", 0), (0.6, "#000", 0.08), (1, "#000", 0.32)])))
    # stringers
    for sx in (4, 84):
        s.add(rect(sx, top - 2, 12, bot - top + 4, rx=1.5, fill="#5a3a1c", stroke=INK, stroke_width="1.2"))
        s.add(grain(sx + 1, top, 10, bot - top, rng, horizontal=False, n=3, op=0.45))
    # handrail with newel posts on the right
    s.add(line(90, top + 4, 90, bot - 12, stroke="#1a0d05", stroke_width="6", stroke_opacity="0.35", transform="translate(3 4)"))
    s.add(line(90, top + 4, 90, bot - 12, stroke="#3d220e", stroke_width="5.6", stroke_linecap="round"))
    s.add(line(90, top + 4, 90, bot - 12, stroke="#a4733f", stroke_width="3.6", stroke_linecap="round"))
    s.add(line(89, top + 5, 89, bot - 13, stroke="#f3d0a0", stroke_width="0.9", stroke_opacity="0.5"))
    for py in (top + 4, bot - 10):
        s.add(shadow(rect_d(83, py - 6, 14, 12, 2), 2.5, 3, 0.45, soft=2))
        s.add(rect(83, py - 6, 14, 12, rx=2, fill="#6e4726", stroke=INK, stroke_width="1"))
        s.add(circle(90, py, 4, fill=s.rg([(0, "#c49058"), (1, "#3d220e")], cx=0.35, cy=0.35), stroke=INK, stroke_width="0.7"))
    s.add(line(x0, top, x1, top, stroke=INK, stroke_width="1.2"), line(x0, bot, x1, bot, stroke=INK, stroke_width="1.2"))
    return s.render()


@asset("t-fireplace", "structures", [2, 1], "Stone fireplace", "Kamienny kominek",
       tags=["fireplace", "hearth", "fire", "chimney", "kominek", "palenisko"])
def fireplace(seed):
    s = Svg(200, 100, seed)
    rng = s.rng
    # warm light spilling onto the floor
    s.add(ellipse(100, 58, 98, 42, fill=s.rg([(0, "#ffb347", 0.5), (0.5, "#ff8a2a", 0.18), (1, "#ff7a1a", 0)])))
    # hearth apron (big flags)
    s.add(shadow(rect_d(34, 36, 132, 44, 2), 3, 4, 0.4))
    xs = [34, 70, 104, 134, 166]
    for i in range(4):
        c = vary("#8f887b", rng, l=0.05)
        s.add(rect(xs[i] + 0.6, 36.6, xs[i + 1] - xs[i] - 1.2, 42.8, rx=1.5, fill=c, stroke="#2a2622", stroke_width="0.7"))
    s.add(speckle(s, 34, 36, 132, 44, 90, ["#5a554c", "#c9c2b0"], 0.25, 0.7, 0.5))
    s.add(path(blob(100, 48, 30, 8, 9, 0.3, rng), fill="#3a3530", fill_opacity="0.4"))
    s.add(speckle(s, 70, 40, 60, 14, 24, ["#ff8a2a", "#ffcf5a"], 0.3, 0.8, 0.8))
    # chimney breast
    breast = rect_d(4, 2, 192, 38, 2)
    s.add(shadow(breast, 4, 5, 0.45))
    s.add(g(stones_in_rect(s, 4, 2, 192, 38, base="#8a8478", size=11), clip_path=s.clip(breast)))
    s.add(path(breast, fill="none", stroke="#1f1c18", stroke_width="1.4"))
    s.add(rect(4, 2, 192, 38, rx=2, fill=s.lg([(0, "#fff", 0.1), (1, "#000", 0.25)])))
    # firebox
    fb = "M56 40V14Q56 8 62 8H138Q144 8 144 14V40Z"
    s.add(path(fb, fill=s.rg([(0, "#4a2a14"), (0.7, "#1a0f08"), (1, "#0a0604")], cx=0.5, cy=0.9, r=0.8), stroke="#1f1c18", stroke_width="1.3"))
    s.add(path("M60 40V16Q60 12 64 12H136Q140 12 140 16V40", fill="none", stroke="#000", stroke_opacity="0.5", stroke_width="3"))
    # andirons, logs, flames, embers
    for ax in (74, 126):
        s.add(rect(ax - 2, 20, 4, 22, rx=1.5, fill="#1b1b1e", stroke="#000", stroke_width="0.5"))
        s.add(circle(ax, 41, 3, fill="#2e2e32", stroke="#000", stroke_width="0.5"))
    for (lx, ly, L, a) in ((66, 30, 68, -4), (70, 25, 60, 6), (82, 20, 40, -2)):
        s.add(g([rect(0, -4, L, 8, rx=4, fill=s.lg([(0, "#6b4f36"), (1, "#1f140a")]), stroke="#0e0a06", stroke_width="0.7"),
                 path(f"M3 -2h{L * 0.4}M{L * 0.5} 1h{L * 0.35}", stroke="#ff6a1a", stroke_width="0.9", stroke_opacity="0.8"),
                 ellipse(L - 1, 0, 2, 3.6, fill="#d9b27a", stroke="#3d220e", stroke_width="0.4")],
                transform=f"translate({lx} {ly}) rotate({a})"))
    for (fx, fy, fs) in ((88, 26, 7), (104, 22, 8.5), (118, 27, 6.5), (98, 32, 5)):
        s.add(flame(fx, fy, fs, rng, s))
    s.add(speckle(s, 60, 32, 80, 8, 30, ["#ffcf5a", "#ff7a1a", "#fff2b0"], 0.3, 0.9, 0.9))
    # iron tools on the right, a kettle on the left
    s.add(line(160, 44, 172, 78, stroke="#1a0d05", stroke_width="2.2", stroke_opacity="0.35", transform="translate(2 2)"))
    s.add(line(160, 44, 172, 78, stroke="#2e2e32", stroke_width="1.8", stroke_linecap="round"))
    s.add(line(166, 44, 176, 76, stroke="#2e2e32", stroke_width="1.6", stroke_linecap="round"))
    s.add(circle(160, 44, 2, fill="none", stroke="#2e2e32", stroke_width="1.2"), circle(166, 44, 2, fill="none", stroke="#2e2e32", stroke_width="1.2"))
    s.add(shadow(circle_d(44, 58, 9), 2, 2.6, 0.45))
    s.add(path("M36 58h-6", stroke="#1b1b1e", stroke_width="2.6", stroke_linecap="round"))
    s.add(circle(44, 58, 9, fill=s.rg([(0, "#6a6a70"), (1, "#141416")], cx=0.35, cy=0.35), stroke="#000", stroke_width="0.8"))
    s.add(circle(44, 58, 4, fill="#2e2e32", stroke="#55555c", stroke_width="0.8"))
    s.add(path("M35 54Q44 44 53 54", fill="none", stroke="#1b1b1e", stroke_width="1.4"))
    return s.render()


# ============================================================== signage


@asset("t-tavern-sign", "markers", [1.5, 1], "Tavern sign", "Szyld karczmy", layer="labels",
       tags=["sign", "tavern", "inn", "label", "szyld", "karczma", "gospoda"])
def tavern_sign(seed):
    s = Svg(150, 100, seed)
    rng = s.rng
    # wall plate + wrought iron bracket with scrolls
    s.add(rect(4, 4, 8, 30, rx=1.5, fill="#2e2e32", stroke="#0e0e10", stroke_width="0.8"))
    s.add(circle(8, 9, 1.2, fill="#8a8a92"), circle(8, 29, 1.2, fill="#8a8a92"))
    iron = dict(fill="none", stroke="#1b1b1e", stroke_linecap="round")
    s.add(path("M12 12H144", stroke_width="3.4", **iron))
    s.add(path("M12 30Q40 30 58 14", stroke_width="2.4", **iron))
    s.add(path("M58 14Q48 22 40 18Q34 14 40 11Q44 10 44 14", stroke_width="1.8", **iron))
    s.add(path("M144 12q4 0 4 4q0 4 -4 3q-2 -1 -1 -3", stroke_width="1.8", **iron))
    s.add(path("M12 12H144", fill="none", stroke="#8a8a92", stroke_width="0.8", stroke_opacity="0.6", transform="translate(0 -0.8)"))
    # chains
    for cx in (40, 118):
        for k in range(3):
            s.add(ellipse(cx, 16 + k * 4.2, 1.6, 2.6, fill="none", stroke="#2e2e32", stroke_width="1.1"))
    # the board
    board = rect_d(24, 26, 110, 68, 8)
    s.add(shadow(board, 3, 4, 0.45))
    s.add(path(board, fill="#4a2c14", stroke=INK, stroke_width="1.6"))
    inner = rect_d(30, 32, 98, 56, 5)
    s.add(path(inner, fill=s.lg([(0, "#c49058"), (1, "#8a5a30")])))
    s.add(g(grain(30, 32, 98, 56, rng, n=10, op=0.3), clip_path=s.clip(inner)))
    s.add(path(inner, fill="none", stroke="#d9a431", stroke_width="1.2"))
    s.add(rect(33.5, 35.5, 91, 49, rx=3.5, fill="none", stroke="#d9a431", stroke_width="0.5", stroke_opacity="0.7"))
    for (cx, cy) in ((36, 38), (122, 38), (36, 82), (122, 82)):
        s.add(circle(cx, cy, 1.8, fill="#d9a431"))
    # painted foaming tankard
    m = dict(stroke="#2a1a0c", stroke_width="1.2", stroke_linejoin="round")
    s.add(path("M88 50h8a8 8 0 0 1 0 16h-8", fill="none", stroke="#2a1a0c", stroke_width="4"))
    s.add(path("M88 50h8a8 8 0 0 1 0 16h-8", fill="none", stroke="#8a5a2c", stroke_width="2"))
    s.add(path("M62 48H90L88 80H64Z", fill=s.lg([(0, "#b98a55"), (0.5, "#9a6a3c"), (1, "#6e4726")], 0, 0, 1, 0), **m))
    s.add(path("M70 50L70.6 78M78 50V78M85.4 50L84.8 78", stroke="#3a220e", stroke_width="0.7", stroke_opacity="0.7"))
    s.add(path("M62.6 55H89.4M63.8 72H88.2", stroke="#3d3d40", stroke_width="2.2"))
    s.add(path("M58 50Q56 42 63 41Q65 35 72 37Q76 32 82 36Q89 34 91 40Q97 42 94 49Q90 52 86 49Q84 53 79 50Q74 54 70 50Q64 53 58 50Z",
               fill="#f5ecd2", **m))
    s.add(path("M86 49Q88 56 86 60Q84 63 85 66", fill="none", stroke="#f5ecd2", stroke_width="2.4", stroke_linecap="round"))
    s.add(circle(68, 43, 1.4, fill="#fff"), circle(80, 40, 1.8, fill="#fff"), circle(88, 44, 1.1, fill="#fff"))
    # hops sprigs either side
    for sx, sgn in ((46, 1), (112, -1)):
        s.add(path(f"M{sx} 76Q{sx + sgn * 2} 62 {sx + sgn * 8} 52", fill="none", stroke="#3f6a1f", stroke_width="1"))
        for k, (dx, dy) in enumerate(((0, 70), (sgn * 3, 62), (sgn * 6.5, 55))):
            s.add(ellipse(sx + dx, dy, 3, 4, fill=["#8fb04a", "#7fa33a", "#a4c45a"][k], stroke="#3f6a1f", stroke_width="0.5"))
            s.add(path(f"M{f(sx + dx - 2)} {dy}h4M{f(sx + dx - 1.6)} {dy - 1.8}h3.2M{f(sx + dx - 1.6)} {dy + 1.8}h3.2", stroke="#3f6a1f",
                       stroke_width="0.4", stroke_opacity="0.7"))
    s.add(bevel(board, lo=0.2, do=0.3, w=1.4))
    return s.render()


# ============================================================== yard


def straw_texture(s, x, y, w, h, base, n, horizontal=True):
    rng = s.rng
    dk, lt = [], []
    for _ in range(n):
        px, py = x + rng.uniform(0, w), y + rng.uniform(0, h)
        L = rng.uniform(4, 9)
        a = rng.uniform(-0.25, 0.25) + (0 if horizontal else math.pi / 2)
        seg = f"M{f(px)} {f(py)}l{f(math.cos(a) * L)} {f(math.sin(a) * L)}"
        (dk if rng.random() < 0.5 else lt).append(seg)
    return g([path("".join(dk), stroke=shade(base, -0.3), stroke_opacity="0.55", stroke_width="0.7"),
              path("".join(lt), stroke=shade(base, 0.25), stroke_opacity="0.65", stroke_width="0.6")], stroke_linecap="round")


@asset("t-hay-bales", "nature", [2, 1], "Hay bales", "Bele siana", tags=["hay", "straw", "farm", "stable", "siano", "słoma"])
def hay_bales(seed):
    s = Svg(200, 100, seed)
    rng = s.rng
    base = "#d2ad5a"
    loose = straw_texture(s, 4, 4, 192, 92, base, 120)
    s.add(g(loose, opacity="0.8"))
    for (x, y, w, h, a) in ((10, 14, 88, 64, -4), (104, 22, 88, 64, 5)):
        cx, cy = x + w / 2, y + h / 2
        d = rect_d(x, y, w, h, 7)
        body = [shadow(d, 5, 6, 0.45),
                path(d, fill=s.rg([(0, shade(base, 0.1)), (0.7, base), (1, shade(base, -0.2))], cx=0.4, cy=0.4, r=0.7), stroke="#6b5020",
                     stroke_width="1.2"),
                g(straw_texture(s, x, y, w, h, base, 320), clip_path=s.clip(d))]
        for tx in (x + w * 0.3, x + w * 0.7):
            body.append(line(tx, y - 0.5, tx, y + h + 0.5, stroke="#5a3a1c", stroke_width="1.6"))
            body.append(line(tx - 0.6, y, tx - 0.6, y + h, stroke="#c9a36a", stroke_width="0.5", stroke_opacity="0.7"))
        body.append(path(d, fill=s.lg([(0, "#fff", 0.12), (1, "#000", 0.18)], 0, 0, 1, 1)))
        s.add(g(body, transform=f"rotate({a} {f(cx)} {f(cy)})"))
    s.add(path("M150 84l14 4l-12 3z", fill="#b8b8bd", stroke="#3a3a3e", stroke_width="0.5"))
    s.add(line(120, 92, 152, 86, stroke="#6e4726", stroke_width="2.2", stroke_linecap="round"))
    return s.render()


@asset("t-trough", "structures", [2, 1], "Water trough", "Koryto z wodą", tags=["trough", "water", "horse", "stable", "koryto", "poidło"])
def trough(seed):
    s = Svg(200, 100, seed)
    rng = s.rng
    outer = rect_d(8, 18, 180, 62, 3)
    s.add(shadow(outer, 5, 6, 0.45))
    s.add(path(outer, fill="#5a3a1c", stroke=INK, stroke_width="1.6"))
    s.add(g(planks(s, 8, 18, 180, 62, 1, "#7a5230", nails=False, joints=False), clip_path=s.clip(outer)))
    water = rect_d(17, 27, 162, 44, 2)
    s.add(path(water, fill=s.lg([(0, "#3f5e66"), (0.3, "#6f949b"), (1, "#2f4a52")]), stroke="#2a1a0c", stroke_width="1"))
    s.add(g([rect(19, 29, 162, 44, fill="none", stroke="#000", stroke_opacity="0.3", stroke_width="5")], clip_path=s.clip(water)))
    ripples = "".join(f"M{f(rng.uniform(24, 160))} {f(rng.uniform(33, 66))}q5 -2 10 0" for _ in range(12))
    s.add(path(ripples, fill="none", stroke="#fff", stroke_opacity="0.35", stroke_width="0.8"))
    s.add(path("M40 34Q70 30 100 33", fill="none", stroke="#fff", stroke_opacity="0.3", stroke_width="1.6", stroke_linecap="round"))
    for (lx, ly, a) in ((128, 52, 30), (60, 60, -20)):
        s.add(ellipse(lx, ly, 3.6, 1.8, fill="#9a7a2a", stroke="#5a4010", stroke_width="0.4", transform=f"rotate({a} {lx} {ly})"))
    for bx in (26, 170):
        s.add(rect(bx - 3, 16.5, 6, 65, fill="#2e2e32", stroke="#111", stroke_width="0.6"))
        s.add(circle(bx, 22, 0.8, fill="#9aa0a6"), circle(bx, 76, 0.8, fill="#9aa0a6"))
    s.add(bevel(outer))
    return s.render()


@asset("t-chopping-block", "nature", [1, 1], "Chopping block", "Pieniek z siekierą", tags=["stump", "axe", "wood", "pieniek", "siekiera"])
def chopping_block(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    cx, cy = 46, 50
    chips = []
    for _ in range(26):
        a, d = rng.uniform(0, 6.28), rng.uniform(34, 46)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.9
        chips.append(g([path(P(jitter([(x - 3, y - 1), (x + 3, y - 1.5), (x + 2.4, y + 1.4), (x - 2.6, y + 1)], 0.8, rng)), fill="#d9b27a",
                             stroke="#6b4a24", stroke_width="0.4")], transform=f"rotate({rng.randint(0, 180)} {f(x)} {f(y)})"))
    s.add(*chips)
    d = blob(cx, cy, 33, 31, 12, 0.05, rng)
    s.add(shadow(d, 4, 5, 0.45))
    s.add(path(d, fill="#4a3220", stroke="#1f140a", stroke_width="1.4"))
    bark = []
    for i in range(40):
        a = 2 * math.pi * i / 40
        bark.append(f"M{f(cx + math.cos(a) * 28)} {f(cy + math.sin(a) * 26.5)}L{f(cx + math.cos(a) * 32.5)} {f(cy + math.sin(a) * 30.5)}")
    s.add(path("".join(bark), stroke="#1f140a", stroke_width="0.9", stroke_opacity="0.8"))
    top = blob(cx, cy, 27, 25.5, 12, 0.03, rng)
    s.add(path(top, fill=s.rg([(0, "#e0bb82"), (0.8, "#c49058"), (1, "#8a5a30")], cx=0.45, cy=0.45)))
    rings = "".join(ellipse_d(cx + rng.uniform(-0.6, 0.6), cy + rng.uniform(-0.6, 0.6), r, r * 0.95) for r in range(3, 26, 3))
    s.add(path(rings, fill="none", stroke="#8a5a30", stroke_width="0.6", stroke_opacity="0.7"))
    for a in (0.6, 2.4, 4.4):
        s.add(path(f"M{f(cx + math.cos(a) * 4)} {f(cy + math.sin(a) * 4)}L{f(cx + math.cos(a) * 25)} {f(cy + math.sin(a) * 23)}", stroke="#3d220e",
                   stroke_width="0.9"))
    cuts = "".join(f"M{f(cx + rng.uniform(-18, 14))} {f(cy + rng.uniform(-16, 16))}l{f(rng.uniform(5, 12))} {f(rng.uniform(-3, 3))}" for _ in range(9))
    s.add(path(cuts, stroke="#5a381a", stroke_width="0.8", stroke_opacity="0.6"))
    # the axe, bitten into the block, handle to the lower right
    s.add(line(cx + 6, cy + 2, cx + 48, cy + 34, stroke="#1a0d05", stroke_width="5", stroke_opacity="0.35", transform="translate(3 4)"))
    s.add(line(cx + 6, cy + 2, cx + 48, cy + 34, stroke="#3d220e", stroke_width="4.6", stroke_linecap="round"))
    s.add(line(cx + 6, cy + 2, cx + 48, cy + 34, stroke="#b07a44", stroke_width="3", stroke_linecap="round"))
    s.add(line(cx + 7, cy + 1.2, cx + 47, cy + 32.6, stroke="#f3d0a0", stroke_width="0.8", stroke_opacity="0.5"))
    head = P([(cx - 12, cy - 10), (cx + 2, cy - 4), (cx + 10, cy + 6), (cx + 4, cy + 8), (cx - 2, cy + 2), (cx - 16, cy - 2)])
    s.add(path(head, fill="#1a0d05", fill_opacity="0.4", transform="translate(2 3)"))
    s.add(path(head, fill=s.lg([(0, "#d9dde1"), (0.5, "#8d949b"), (1, "#4a4f55")], 0, 0, 1, 1), stroke="#1f2226", stroke_width="0.9"))
    s.add(path(f"M{cx - 12} {cy - 10}L{cx - 16} {cy - 2}", stroke="#f5f7f8", stroke_width="1.4"))
    return s.render()
