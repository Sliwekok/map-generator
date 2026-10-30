"""Hell structures: wall pieces (all 0.35 cells thick, like the tavern walls), corners, doors, gates, stairs, keep/tower roofs."""
import math

from hlib import *  # noqa: F401,F403
from lib import (Svg, blob, blob_pts, circle, circle_d, el, ellipse, ellipse_d, f, f2, g, line, mix, path, P, rect, rect_d, rot_pts,
                 shade, shadow, smooth, speckle, vary)
from reg import asset

WT = 35  # wall thickness in viewBox units (0.35 cell) - matches t-wall-*, t-door, t-window


def lava_seam(s, x0, y0, x1, y1, w=1.6):
    """Glowing mortar line."""
    return g([line(x0, y0, x1, y1, stroke=LAVA_O, stroke_width=f2(w * 2.2), stroke_opacity="0.35"),
              line(x0, y0, x1, y1, stroke=LAVA_Y, stroke_width=f2(w)),
              line(x0, y0, x1, y1, stroke=LAVA_CORE, stroke_width=f2(w * 0.35), stroke_opacity="0.8")], stroke_linecap="round")


def obsidian_courses(s, x, y, w, h, rows=2, seams=True):
    """Ashlar obsidian blocks in running bond with lava-glowing joints."""
    rng = s.rng
    parts = [rect(x, y, w, h, fill=LAVA_D)]
    seam_d = []
    rh = h / rows
    for r in range(rows):
        yy = y + r * rh
        xx = x - (rng.uniform(4, 18) if r % 2 else rng.uniform(18, 30))
        while xx < x + w:
            bw = rng.uniform(26, 44)
            parts.append(obsidian_block(s, xx + 0.9, yy + 0.9, bw - 1.8, rh - 1.8, rng))
            seam_d.append(f"M{f(xx)} {f(yy)}v{f(rh)}")
            xx += bw
        if r:
            seam_d.append(f"M{f(x)} {f(yy)}H{f(x + w)}")
    if seams:
        parts.append(path("".join(seam_d), fill="none", stroke=LAVA_O, stroke_width="2", stroke_opacity="0.45"))
        parts.append(path("".join(seam_d), fill="none", stroke=LAVA_Y, stroke_width="0.7", stroke_opacity="0.9"))
    return g(parts, clip_path=s.clip(rect_d(x, y, w, h)))


def wall_edges(s, W, H):
    return g([rect(0, 0, W, H, fill=s.lg([(0, "#fff", 0.08), (0.5, "#fff", 0), (1, "#000", 0.3)])),
              line(0, 0.5, W, 0.5, stroke=OBS_D, stroke_width="1.2"), line(0, H - 0.5, W, H - 0.5, stroke=OBS_D, stroke_width="1.2")])


@asset("h-wall-obsidian", "structures", [3, 0.35], "Obsidian wall", "Mur z obsydianu",
       tags=["wall", "obsidian", "hell", "lava", "mur", "ściana", "obsydian", "piekło"])
def wall_obsidian(seed):
    s = Svg(300, WT, seed)
    s.add(obsidian_courses(s, 0, 0, 300, WT, rows=2))
    s.add(wall_edges(s, 300, WT))
    return s.render()


def wall_spike_studs(s, W, H, step=30, r=4.2, base=IRON):
    """Spike studs along the wall crown (cones seen from above)."""
    return g([spike(x, H / 2, r, base) for x in [step / 2 + i * step for i in range(int(W // step))]])


def iron_plate(s, x, y, w, h, rng, base=IRON):
    d = rect_d(x, y, w, h, 0.6)
    col = vary(base, rng, l=0.035)
    parts = [path(d, fill=col),
             path(rect_d(x, y, w, h, 0.6), fill=s.lg([(0, "#fff", 0.16), (0.5, "#fff", 0), (1, "#000", 0.35)], 0, 0, 0.3, 1)),
             path(f"M{f(x + 0.5)} {f(y + h - 0.6)}V{f(y + 0.5)}H{f(x + w - 0.6)}", fill="none", stroke=IRON_L, stroke_opacity="0.45",
                  stroke_width="0.7"),
             path(f"M{f(x + 0.6)} {f(y + h - 0.4)}H{f(x + w - 0.4)}V{f(y + 0.6)}", fill="none", stroke="#000", stroke_opacity="0.5",
                  stroke_width="0.8")]
    # rust bloom + scratches
    for _ in range(rng.randint(1, 3)):
        cx, cy = x + rng.uniform(0.1, 0.9) * w, y + rng.uniform(0.2, 0.8) * h
        parts.append(path(blob(cx, cy, rng.uniform(3, 9), rng.uniform(2, 4), 7, 0.4, rng), fill=RUST, fill_opacity=f2(rng.uniform(0.25, 0.5))))
    sc = "".join(f"M{f(x + rng.uniform(2, w - 8))} {f(y + rng.uniform(2, h - 2))}l{f(rng.uniform(3, 8))} {f(rng.uniform(-1.5, 1.5))}"
                 for _ in range(3))
    parts.append(path(sc, stroke=IRON_L, stroke_opacity="0.35", stroke_width="0.4"))
    return g(parts)


@asset("h-wall-iron", "structures", [3, 0.35], "Spiked iron wall", "Żelazny mur z kolcami",
       tags=["wall", "iron", "metal", "spikes", "hell", "mur", "ściana", "żelazo", "kolce", "piekło"])
def wall_iron(seed):
    s = Svg(300, WT, seed)
    rng = s.rng
    s.add(rect(0, 0, 300, WT, fill=IRON_D))
    xs = [0]
    while xs[-1] < 300:
        xs.append(min(300, xs[-1] + rng.choice([48, 52, 60])))
    rv = []
    for a, b in zip(xs, xs[1:]):
        s.add(iron_plate(s, a + 0.5, 0.8, b - a - 1, WT - 1.6, rng))
        for yy in (4.2, WT - 4.2):
            rv += [(a + 4, yy), (b - 4, yy)] + [(a + (b - a) * k / 4, yy) for k in (1, 2, 3)]
    s.add(rivets(rv, 1.15))
    # raised centre band with spikes
    s.add(rect(0, WT / 2 - 5, 300, 10, fill=iron_grad(s, 0, WT / 2 - 5, 0, WT / 2 + 5, "#2c2c33")))
    s.add(line(0, WT / 2 - 5, 300, WT / 2 - 5, stroke=IRON_L, stroke_opacity="0.4", stroke_width="0.6"))
    s.add(line(0, WT / 2 + 5, 300, WT / 2 + 5, stroke="#000", stroke_opacity="0.6", stroke_width="0.8"))
    s.add(wall_spike_studs(s, 300, WT, 25, 4.6))
    s.add(line(0, 0.5, 300, 0.5, stroke="#0a0a0c", stroke_width="1.2"), line(0, WT - 0.5, 300, WT - 0.5, stroke="#0a0a0c", stroke_width="1.2"))
    return s.render()


def rubble_hell(s, x, y, w, h, pal, mortar="#1a0c08", hot=0.15, sulfur=0.0):
    """Irregular rough stones packed in dark mortar; some joints glow, some stones carry sulfur crust."""
    rng = s.rng
    parts = [rect(x, y, w, h, fill=mortar)]
    by, hl, dk, hotj, sul = {}, [], [], [], []
    xx = x - rng.uniform(0, 10)
    while xx < x + w:
        if rng.random() < 0.25:
            cols, sw = [(y, h)], rng.uniform(14, 22)
        else:
            sp = h * rng.uniform(0.38, 0.62)
            cols, sw = [(y, sp), (y + sp, h - sp)], rng.uniform(15, 28)
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
            c = vary(rng.choice(pal), rng, l=0.04)
            sd = smooth(pts, t=0.5)
            by.setdefault(c, []).append(sd)
            hl.append(f"M{f(pts[7][0])} {f(pts[7][1])}L{f(pts[0][0])} {f(pts[0][1])}L{f(pts[1][0])} {f(pts[1][1])}")
            dk.append(f"M{f(pts[3][0])} {f(pts[3][1])}L{f(pts[4][0])} {f(pts[4][1])}L{f(pts[5][0])} {f(pts[5][1])}")
            if rng.random() < hot:
                hotj.append(f"M{f(ox)} {f(yy + hh * rng.uniform(0.2, 0.8))}v{f(rng.uniform(4, 9))}")
            if rng.random() < sulfur:
                sul.append(blob(ox + ww * rng.uniform(0.3, 0.7), yy + hh * rng.uniform(0.3, 0.7), ww * 0.25, hh * 0.2, 6, 0.4, rng))
        xx += sw
    for c, ds in by.items():
        parts.append(path("".join(ds), fill=c, stroke="#0d0605", stroke_width="0.6"))
    if sul:
        parts.append(path("".join(sul), fill=SULFUR, fill_opacity="0.55"))
    parts.append(path("".join(hl), fill="none", stroke="#ffd9c0", stroke_opacity="0.2", stroke_width="0.9", stroke_linejoin="round"))
    parts.append(path("".join(dk), fill="none", stroke="#000", stroke_opacity="0.4", stroke_width="1", stroke_linejoin="round"))
    if hotj:
        parts.append(path("".join(hotj), stroke=LAVA_O, stroke_width="3", stroke_opacity="0.5", stroke_linecap="round"))
        parts.append(path("".join(hotj), stroke=LAVA_Y, stroke_width="1.1", stroke_linecap="round"))
    parts.append(speckle(s, x, y, w, h, int(w * h / 70), ["#120806", "#c08a6a"], 0.25, 0.6, 0.4))
    return g(parts, clip_path=s.clip(rect_d(x, y, w, h)))


@asset("h-wall-brimstone", "structures", [3, 0.35], "Brimstone wall", "Mur z siarkowego kamienia",
       tags=["wall", "stone", "brimstone", "sulfur", "hell", "mur", "ściana", "kamień", "siarka", "piekło"])
def wall_brimstone(seed):
    s = Svg(300, WT, seed)
    s.add(rubble_hell(s, 0, 0, 300, WT, ["#5a2418", "#6a2c1c", "#4a1e16", "#73331f", "#3e1a14", "#5e3420"], hot=0.12, sulfur=0.18))
    s.add(wall_edges(s, 300, WT))
    return s.render()


@asset("h-wall-bone", "structures", [3, 0.35], "Bone wall", "Mur z kości",
       tags=["wall", "bone", "skull", "ossuary", "hell", "mur", "ściana", "kości", "czaszki", "piekło"])
def wall_bone(seed):
    s = Svg(300, WT, seed)
    rng = s.rng
    s.add(rect(0, 0, 300, WT, fill="#2a1e16"))
    # packed long bones lying along the wall, skulls set into it every so often
    body = []
    for row, yy in enumerate((6.5, 14, 21, 28.5)):
        x = -rng.uniform(0, 14)
        while x < 300:
            L = rng.uniform(18, 30)
            body.append(bone(x + L / 2, yy + rng.uniform(-0.8, 0.8), L, 3.6, rng.uniform(-4, 4), vary(BONE, rng, l=0.06)))
            x += L + rng.uniform(1, 3)
    s.add(g(body, clip_path=s.clip(rect_d(0, 0, 300, WT))))
    for x in (38, 112, 188, 262):
        x += rng.uniform(-6, 6)
        s.add(circle(x, WT / 2, 12.5, fill="#1a120c"))
        s.add(skull(s, x, WT / 2, 10, ang=0, color=vary(BONE, rng, l=0.05), glow_eyes=LAVA_O))
    s.add(rect(0, 0, 300, WT, fill=s.lg([(0, "#fff", 0.06), (0.5, "#fff", 0), (1, "#000", 0.32)])))
    s.add(line(0, 0.5, 300, 0.5, stroke="#120b07", stroke_width="1.2"), line(0, WT - 0.5, 300, WT - 0.5, stroke="#120b07", stroke_width="1.2"))
    return s.render()


@asset("h-post", "structures", [0.35, 0.35], "Obsidian post / corner", "Obsydianowy słup / narożnik",
       tags=["post", "corner", "pillar", "obsidian", "słup", "narożnik", "obsydian"])
def post(seed):
    s = Svg(WT, WT, seed)
    s.add(rect(0, 0, WT, WT, fill=OBS_D))
    s.add(path(rect_d(1, 1, WT - 2, WT - 2, 1.2), fill=s.lg([(0, "#4a3d55"), (0.5, OBS), (1, OBS_D)], 0, 0, 1, 1)))
    # pyramid cap with a lava seam ring and a spike
    c = WT / 2
    s.add(path(P([(3, 3), (WT - 3, 3), (c, c)]), fill="#fff", fill_opacity="0.12"),
          path(P([(3, 3), (3, WT - 3), (c, c)]), fill="#fff", fill_opacity="0.06"),
          path(P([(WT - 3, 3), (WT - 3, WT - 3), (c, c)]), fill="#000", fill_opacity="0.25"),
          path(P([(3, WT - 3), (WT - 3, WT - 3), (c, c)]), fill="#000", fill_opacity="0.4"))
    s.add(path(rect_d(3, 3, WT - 6, WT - 6, 0.8), fill="none", stroke=LAVA_O, stroke_width="1.4", stroke_opacity="0.75"))
    s.add(path(rect_d(3, 3, WT - 6, WT - 6, 0.8), fill="none", stroke=LAVA_Y, stroke_width="0.5"))
    s.add(spike(c, c, 5.5, "#2c2c33"))
    return s.render()


@asset("h-pillar", "structures", [1, 1], "Obsidian pillar", "Obsydianowa kolumna",
       tags=["pillar", "column", "obsidian", "skull", "hell", "kolumna", "filar", "obsydian", "piekło"])
def pillar(seed):
    s = Svg(100, 100, seed)
    rng = s.rng
    c = 48
    s.add(glow(s, c, c, 50, LAVA_O, 0.28))
    oct_ = [(c + math.cos(math.pi / 8 + i * math.pi / 4) * 42, c + math.sin(math.pi / 8 + i * math.pi / 4) * 42) for i in range(8)]
    s.add(shadow(P(oct_), 7, 9, 0.5, soft=4))
    s.add(path(P(oct_), fill=OBS, stroke=OBS_D, stroke_width="1.4"))
    # base plinth facets
    for i in range(8):
        a, b = oct_[i], oct_[(i + 1) % 8]
        mid = ((a[0] + b[0]) / 2 - c, (a[1] + b[1]) / 2 - c)
        lit = -(mid[0] + mid[1]) / (math.hypot(*mid) * 1.41)
        inner = [(c + (p[0] - c) * 0.78, c + (p[1] - c) * 0.78) for p in (a, b)]
        s.add(path(P([a, b, inner[1], inner[0]]), fill="#fff" if lit > 0 else "#000", fill_opacity=f2(abs(lit) * (0.22 if lit > 0 else 0.4))))
    # lava ring
    s.add(circle(c, c, 30, fill="none", stroke=LAVA_O, stroke_width="5", stroke_opacity="0.45"))
    s.add(circle(c, c, 30, fill="none", stroke=LAVA_Y, stroke_width="1.6"))
    # column shaft top (round, fluted) + skull capital
    s.add(circle(c, c, 27, fill=s.rg([(0, "#4a3d55"), (0.6, OBS), (1, OBS_D)], cx=0.38, cy=0.35), stroke=OBS_D, stroke_width="1"))
    fl = "".join(f"M{f(c + math.cos(a) * 18)} {f(c + math.sin(a) * 18)}L{f(c + math.cos(a) * 26)} {f(c + math.sin(a) * 26)}"
                 for a in [i * math.pi / 8 for i in range(16)])
    s.add(path(fl, stroke="#000", stroke_opacity="0.45", stroke_width="1.1"))
    s.add(path(fl, stroke=OBS_L, stroke_opacity="0.35", stroke_width="0.5", transform="translate(-0.6 -0.6)"))
    s.add(skull(s, c, c - 1, 12, ang=0, color=shade(BONE, -0.05), glow_eyes=LAVA_Y))
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        s.add(spike(c + math.cos(a) * 36, c + math.sin(a) * 36, 4.2, "#2c2c33"))
    s.add(embers(s, 4, 4, 92, 92, 10, rng, 0.7))
    return s.render()


def gatepost(s, x, y, w, h):
    """Square obsidian gatepost with a pyramid cap and a spike."""
    parts = [shadow(rect_d(x, y, w, h), 3, 4, 0.45),
             path(rect_d(x, y, w, h, 1), fill=OBS, stroke=OBS_D, stroke_width="1")]
    cx, cy = x + w / 2, y + h / 2
    parts += [path(P([(x + 2, y + 2), (x + w - 2, y + 2), (cx, cy)]), fill="#fff", fill_opacity="0.14"),
              path(P([(x + 2, y + 2), (x + 2, y + h - 2), (cx, cy)]), fill="#fff", fill_opacity="0.07"),
              path(P([(x + w - 2, y + 2), (x + w - 2, y + h - 2), (cx, cy)]), fill="#000", fill_opacity="0.3"),
              path(P([(x + 2, y + h - 2), (x + w - 2, y + h - 2), (cx, cy)]), fill="#000", fill_opacity="0.42"),
              path(rect_d(x + 2, y + 2, w - 4, h - 4, 0.6), fill="none", stroke=LAVA_O, stroke_width="1", stroke_opacity="0.6"),
              spike(cx, cy, min(w, h) * 0.2, "#2c2c33")]
    return g(parts)


def hinge(x, y, r=2.6):
    return g([circle(x + 0.7, y + 0.9, r, fill="#000", fill_opacity="0.45"),
              circle(x, y, r, fill="#2c2c33", stroke=IRON_D, stroke_width="0.7"),
              circle(x - 0.6, y - 0.6, r * 0.4, fill=IRON_L, fill_opacity="0.6")])


def bar_gate_leaf(s, x, y, L, t, hinge_left=True, n=None, base=IRON):
    """One leaf of a spear-bar gate seen from above, lying in the wall plane: top & bottom rails, bar spear points, rivets."""
    rng = s.rng
    parts = [shadow(rect_d(x, y + t * 0.2, L, t * 0.6), 2.5, 3.5, 0.45)]
    # frame rails
    parts.append(path(rect_d(x, y + t * 0.18, L, t * 0.64, 0.8), fill=iron_grad(s, x, y + t * 0.18, x, y + t * 0.82, "#2e2e35"),
                      stroke=IRON_D, stroke_width="0.9"))
    parts.append(path(f"M{f(x + 1)} {f(y + t * 0.5)}H{f(x + L - 1)}", stroke="#000", stroke_opacity="0.55", stroke_width="1.1"))
    n = n or max(3, int(L / 8))
    pts = []
    for i in range(n):
        bx = x + L * (i + 0.5) / n
        pts.append(bx)
    # spear points along the leaf (bars seen end-on)
    for bx in pts:
        parts.append(path(P([(bx - 2.6, y + t * 0.5), (bx, y + t * 0.5 - 4.2), (bx + 2.6, y + t * 0.5), (bx, y + t * 0.5 + 4.2)]),
                          fill=base, stroke=IRON_D, stroke_width="0.6"))
        parts.append(path(P([(bx - 2.6, y + t * 0.5), (bx, y + t * 0.5 - 4.2), (bx, y + t * 0.5)]), fill=IRON_L, fill_opacity="0.6"))
    rv = [(x + 3, y + t * 0.27), (x + L - 3, y + t * 0.27), (x + 3, y + t * 0.73), (x + L - 3, y + t * 0.73)]
    rv += [(bx, y + t * 0.27) for bx in pts[1::2]] + [(bx, y + t * 0.73) for bx in pts[::2]]
    parts.append(rivets(rv, 0.9))
    # rust streaks
    for _ in range(2):
        rx = x + rng.uniform(4, L - 10)
        parts.append(rect(rx, y + t * 0.2, rng.uniform(3, 9), t * 0.6, fill=RUST, fill_opacity="0.25"))
    hx = x + (2.5 if hinge_left else L - 2.5)
    parts.append(hinge(hx, y + t * 0.32, 2.2))
    parts.append(hinge(hx, y + t * 0.68, 2.2))
    return g(parts)


@asset("h-door-iron", "structures", [1, 0.35], "Iron door", "Żelazne drzwi",
       tags=["door", "iron", "metal", "entrance", "hell", "drzwi", "żelazne", "wejście", "piekło"])
def door_iron(seed):
    s = Svg(100, WT, seed)
    rng = s.rng
    s.add(gatepost(s, 0, 0, 12, WT), gatepost(s, 88, 0, 12, WT))
    x, L = 13, 74
    s.add(shadow(rect_d(x, 6, L, WT - 12), 2.5, 3.5, 0.5))
    s.add(path(rect_d(x, 6, L, WT - 12, 0.8), fill=iron_grad(s, x, 6, x, WT - 6), stroke=IRON_D, stroke_width="1"))
    s.add(path(rect_d(x, 6, L, WT - 12, 0.8), fill=s.lg([(0, RUST, 0.0), (0.6, RUST, 0.15), (1, RUST, 0.35)], 0, 0, 1, 0)))
    for k in (0.3, 0.7):
        s.add(rect(x, 6 + (WT - 12) * k - 1.6, L, 3.2, fill="#25252b", stroke=IRON_D, stroke_width="0.5"))
    s.add(rivets([(x + 4 + i * 11, 6 + (WT - 12) * k) for i in range(7) for k in (0.3, 0.7)], 0.9))
    s.add(hinge(x + 2.5, 11), hinge(x + 2.5, WT - 11))
    # skull knocker ring on the outer face (bottom side)
    s.add(skull(s, x + L - 14, WT / 2, 5, ang=0, color=shade(BONE, -0.08)))
    s.add(circle(x + L - 14, WT / 2 + 6.5, 3, fill="none", stroke=IRON_D, stroke_width="1.6"))
    s.add(circle(x + L - 14, WT / 2 + 6.5, 3, fill="none", stroke=IRON_L, stroke_width="0.6", stroke_opacity="0.7"))
    return s.render()


@asset("h-gate", "structures", [2, 0.35], "Iron spear gate", "Żelazna brama z grotami",
       tags=["gate", "iron", "metal", "bars", "portcullis", "hell", "brama", "krata", "żelazo", "piekło"])
def gate(seed):
    s = Svg(200, WT, seed)
    s.add(gatepost(s, 0, 0, 16, WT), gatepost(s, 184, 0, 16, WT))
    s.add(bar_gate_leaf(s, 17, 0, 83, WT, True))
    s.add(bar_gate_leaf(s, 100, 0, 83, WT, False))
    # lock plate where the leaves meet
    s.add(path(rect_d(94, WT / 2 - 7, 12, 14, 1.2), fill="#2a2a30", stroke=IRON_D, stroke_width="0.8"))
    s.add(skull(s, 100, WT / 2, 4.2, color=shade(BONE, -0.08), glow_eyes=LAVA_O))
    return s.render()


@asset("h-gate-large", "structures", [3, 0.5], "Great infernal gate", "Wielka piekielna brama",
       tags=["gate", "iron", "metal", "fortress", "doors", "hell", "brama", "wrota", "żelazo", "twierdza", "piekło"])
def gate_large(seed):
    s = Svg(300, 50, seed)
    rng = s.rng
    s.add(gatepost(s, 0, 0, 30, 50), gatepost(s, 270, 0, 30, 50))
    # two massive riveted iron leaves with a spiked crest and lava glow leaking from the middle seam
    for x, L, left in ((31, 119, True), (150, 119, False)):
        s.add(shadow(rect_d(x, 8, L, 34), 3, 4.5, 0.5, soft=3))
        xs = [x + L * k / 4 for k in range(5)]
        for a, b in zip(xs, xs[1:]):
            s.add(iron_plate(s, a + 0.3, 8, b - a - 0.6, 34, rng, "#34343b"))
        s.add(path(rect_d(x, 8, L, 34, 1), fill="none", stroke=IRON_D, stroke_width="1.4"))
        # strap hinges
        for yy in (14, 36):
            hx0 = x + (2 if left else L - 2)
            hx1 = x + (L * 0.7 if left else L * 0.3)
            s.add(iron_bar(hx0, yy, hx1, yy, 4.2, "#26262c", cap="butt"))
            s.add(rivets([(hx0 + (hx1 - hx0) * k / 6, yy) for k in range(1, 7)], 0.9))
            s.add(spike_side(hx1, yy, 6, 4, 0 if left else math.pi, "#26262c"))
        s.add(hinge(x + (3 if left else L - 3), 14, 3), hinge(x + (3 if left else L - 3), 36, 3))
        # crest of spikes along the leaf top
        s.add(g([spike(x + 8 + i * (L - 16) / 6, 25, 3.6, "#2a2a30") for i in range(7)]))
    s.add(rect(148, 9, 4, 32, fill=LAVA_O, fill_opacity="0.55"), rect(149.3, 9, 1.4, 32, fill=LAVA_Y))
    s.add(glow(s, 150, 25, 22, LAVA_O, 0.35))
    # demon face boss in the middle
    s.add(circle(150, 25, 9.5, fill="#1e1e23", stroke=IRON_D, stroke_width="1"))
    s.add(skull(s, 150, 25, 7, color=shade(BONE, -0.12), glow_eyes=LAVA_Y))
    s.add(path("M141 19Q137 12 133 13Q137 15 139 21Z M159 19Q163 12 167 13Q163 15 161 21Z", fill="#2a2a30", stroke=IRON_D, stroke_width="0.6"))
    return s.render()


@asset("h-gate-open", "structures", [2, 1.2], "Open iron gate", "Otwarta żelazna brama",
       tags=["gate", "iron", "open", "bars", "hell", "brama", "otwarta", "krata", "piekło"])
def gate_open(seed):
    s = Svg(200, 120, seed)
    s.add(gatepost(s, 0, 0, 16, WT), gatepost(s, 184, 0, 16, WT))
    # swing arcs
    s.add(path("M17 100A83 83 0 0 0 100 17M183 100A83 83 0 0 1 100 17", fill="none", stroke="#000", stroke_opacity="0.25",
               stroke_width="1", stroke_dasharray="3 3"))
    for hx, sign in ((17, 1), (183, -1)):
        leaf = bar_gate_leaf(s, 0, 0, 83, WT, True)
        s.add(g(leaf, transform=f"translate({f(hx + sign * (WT / 2 - 0.5))} {f(WT / 2)}) rotate(90) translate(0 {f(-WT / 2)})" if sign > 0
                else f"translate({f(hx - WT / 2 + 0.5)} {f(WT / 2)}) rotate(90) translate(0 {f(-WT / 2)})"))
    # threshold
    s.add(rect(17, WT / 2 - 3, 166, 6, fill="#2a2228", stroke=OBS_D, stroke_width="0.6"))
    s.add(line(17, WT / 2 - 2.4, 183, WT / 2 - 2.4, stroke=OBS_L, stroke_opacity="0.4", stroke_width="0.6"))
    return s.render()


@asset("h-window-grate", "structures", [1, 0.35], "Barred window", "Okno z kratą",
       tags=["window", "bars", "grate", "iron", "glow", "okno", "krata", "żelazo"])
def window_grate(seed):
    s = Svg(100, WT, seed)
    s.add(obsidian_courses(s, 0, 0, 100, WT, rows=2, seams=False))
    s.add(rect(14, 7, 72, WT - 14, fill="#1a0604"))
    s.add(rect(14, 7, 72, WT - 14, fill=s.lg([(0, LAVA_R, 0.2), (1, LAVA_O, 0.7)], 0, 0, 0, 1)))
    for i in range(7):
        x = 18 + i * 10.6
        s.add(circle(x, WT / 2, 2.4, fill="#2c2c33", stroke=IRON_D, stroke_width="0.6"),
              circle(x - 0.6, WT / 2 - 0.6, 0.8, fill=IRON_L, fill_opacity="0.7"))
    s.add(iron_bar(14, WT / 2, 86, WT / 2, 1.6, "#2c2c33", cap="butt"))
    s.add(path(rect_d(14, 7, 72, WT - 14), fill="none", stroke=OBS_D, stroke_width="1.4"))
    s.add(wall_edges(s, 100, WT))
    return s.render()


@asset("h-fence-iron", "structures", [2, 0.25], "Spiked iron fence", "Żelazne ogrodzenie z kolcami",
       tags=["fence", "railing", "iron", "spikes", "hell", "płot", "ogrodzenie", "kolce", "żelazo"])
def fence_iron(seed):
    s = Svg(200, 25, seed)
    s.add(g([path(rect_d(2, 10.5, 196, 4), fill="#000")], opacity="0.4", transform="translate(2 3)"))
    s.add(iron_bar(2, 12.5, 198, 12.5, 2.4, "#2e2e35", cap="butt"))
    for i in range(16):
        x = 6.25 + i * 12.5
        big = i % 4 == 0
        if big:
            s.add(path(rect_d(x - 4, 8.5, 8, 8, 0.8), fill="#2a2a30", stroke=IRON_D, stroke_width="0.7"))
            s.add(spike(x, 12.5, 3.2, "#2e2e35"))
        else:
            s.add(path(P([(x - 2.4, 12.5), (x, 9), (x + 2.4, 12.5), (x, 16)]), fill="#2e2e35", stroke=IRON_D, stroke_width="0.5"))
            s.add(path(P([(x - 2.4, 12.5), (x, 9), (x, 12.5)]), fill=IRON_L, fill_opacity="0.55"))
    s.add(iron_curve("M12 12.5q3 -6 6.5 0t6.5 0 M62 12.5q3 -6 6.5 0t6.5 0 M112 12.5q3 -6 6.5 0t6.5 0 M162 12.5q3 -6 6.5 0t6.5 0", 1, "#2e2e35"))
    return s.render()


@asset("h-stairs", "structures", [1, 2], "Obsidian stairs", "Schody z obsydianu",
       tags=["stairs", "steps", "up", "down", "obsidian", "lava", "schody", "stopnie", "obsydian"])
def stairs(seed):
    s = Svg(100, 200, seed)
    rng = s.rng
    s.add(shadow(rect_d(4, 4, 92, 192), 4, 5, 0.45))
    s.add(rect(4, 4, 92, 192, fill=OBS_D))
    n = 9
    sh = 192 / n
    for i in range(n):
        y = 4 + i * sh
        # higher steps (top) lighter
        lift = 0.06 * (1 - i / n)
        s.add(path(rect_d(6, y + 0.8, 88, sh - 1.6, 0.6), fill=shade(OBS, lift)))
        s.add(path(rect_d(6, y + 0.8, 88, sh - 1.6, 0.6), fill=s.lg([(0, OBS_L, 0.35), (0.35, OBS_L, 0), (1, "#000", 0.45)], 0, 0, 0, 1)))
        s.add(line(6, y + 1.2, 94, y + 1.2, stroke="#b8a8c8", stroke_opacity="0.35", stroke_width="0.7"))
        # lava glow in the riser gap
        s.add(line(6, y + sh - 0.6, 94, y + sh - 0.6, stroke=LAVA_O, stroke_width="1.6", stroke_opacity=f2(0.25 + 0.5 * i / n)))
        if rng.random() < 0.5:
            cx = rng.uniform(16, 84)
            s.add(path(f"M{f(cx)} {f(y + 2)}l{f(rng.uniform(-3, 3))} {f(sh * 0.4)}l{f(rng.uniform(-2, 2))} {f(sh * 0.35)}", fill="none",
                       stroke="#000", stroke_opacity="0.6", stroke_width="0.6"))
    # side walls (low parapets) with spikes
    for x in (2, 92):
        s.add(path(rect_d(x, 2, 6, 196, 1), fill="#2a2228", stroke=OBS_D, stroke_width="0.8"))
        s.add(line(x + 1, 3, x + 1, 197, stroke=OBS_L, stroke_opacity="0.4", stroke_width="0.6"))
        for k in range(4):
            s.add(spike(x + 3, 18 + k * 54, 2.6, "#2c2c33"))
    # "down" arrow cue (subtle)
    s.add(path("M50 160l-9 -12h18z", fill=LAVA_Y, fill_opacity="0.35"))
    return s.render()


# ============================================================== roofs (copied machinery from tavern-pack/buildings.py)

ROT = {"N": 0, "S": 180, "W": -90, "E": 90}


def to_local(pt, origin, eave):
    th = math.radians(-ROT[eave])
    x, y = pt[0] - origin[0], pt[1] - origin[1]
    return (x * math.cos(th) - y * math.sin(th), x * math.sin(th) + y * math.cos(th))


def roof_face(s, poly, eave, origin, material, light=0.0):
    """One roof plane; material(s, u0, u1, V) draws in local space (u along the eave, v uphill)."""
    loc = [to_local(p, origin, eave) for p in poly]
    u0 = min(p[0] for p in loc) - 2
    u1 = max(p[0] for p in loc) + 2
    V = max(p[1] for p in loc) + 2
    d = P(poly)
    body = material(s, u0, u1, V)
    tf = f"translate({f(origin[0])} {f(origin[1])}) rotate({ROT[eave]})"
    parts = [g(body, transform=tf)]
    if light > 0:
        parts.append(path(d, fill="#ffd8c8", fill_opacity=f2(light)))
    elif light < 0:
        parts.append(path(d, fill="#000", fill_opacity=f2(-light)))
    return g(parts, clip_path=s.clip(d))


def _pattern(s, w, h, content, x=0, y=0):
    i = s.id("p")
    s.defs.append(el("pattern", content, id=i, patternUnits="userSpaceOnUse", x=f(x), y=f(y), width=f(w), height=f(h)))
    return f"url(#{i})"


def slate_scales(base="#2b2530"):
    """Pointed fish-scale slates (dark, violet-grey) with a faint ember-red edge glint."""
    def mat(s, u0, u1, V):
        rng = s.rng
        cw, rh = 10.0, 9.0
        sc = (f"M0 0V{f(rh * 0.45)}Q0 {f(rh)} {f(cw / 2)} {f(rh * 1.15)}Q{f(cw)} {f(rh)} {f(cw)} {f(rh * 0.45)}V0Z")
        tile = (rect(0, 0, cw, rh, fill=shade(base, -0.08))
                + path(sc, fill=s.lg([(0, shade(base, 0.08)), (0.7, base), (1, shade(base, -0.12))], 0, 0, 0, rh * 1.15, user=True),
                       transform=f"translate(0 {f(-rh * 0.15)})")
                + path(f"M0 {f(rh * 0.3)}Q0 {f(rh * 0.85)} {f(cw / 2)} {f(rh)}Q{f(cw)} {f(rh * 0.85)} {f(cw)} {f(rh * 0.3)}", fill="none",
                       stroke="#000", stroke_opacity="0.55", stroke_width="0.9")
                + path(f"M1 {f(rh * 0.3)}Q1 {f(rh * 0.75)} {f(cw / 2)} {f(rh * 0.88)}", fill="none", stroke="#c06050",
                       stroke_opacity="0.28", stroke_width="0.5"))
        # two rows per pattern tile, the second offset by half a scale
        tile2 = g([tile, g(tile, transform=f"translate({f(cw / 2)} {f(rh)})"), g(tile, transform=f"translate({f(-cw / 2)} {f(rh)})")])
        pat = _pattern(s, cw, rh * 2, tile2, x=u0, y=0)
        parts = [rect(u0, -4, u1 - u0, V + 8, fill=pat)]
        spots = {}
        for _ in range(int((u1 - u0) * V / 260)):
            u, v = rng.uniform(u0, u1), rng.uniform(0, V)
            c = rng.choice(["#000", "#5a4a66", "#6e1a10", "#3a3040"])
            spots.setdefault(c, []).append(rect_d(u, v, cw - 1, rh - 1))
        for c, ds in spots.items():
            parts.append(path("".join(ds), fill=c, fill_opacity="0.22"))
        # soot streaks running downhill (toward the eave at v=0)
        for _ in range(int((u1 - u0) / 40)):
            u = rng.uniform(u0, u1)
            parts.append(rect(u, 0, rng.uniform(4, 10), rng.uniform(V * 0.2, V * 0.6), fill="#000", fill_opacity="0.18"))
        return g(parts)
    return mat


def ridge_iron(s, p0, p1, w=7, spikes=True, step=16):
    x0, y0 = p0
    x1, y1 = p1
    parts = [line(x0 + 2, y0 + 3, x1 + 2, y1 + 3, stroke="#000", stroke_opacity="0.4", stroke_width=f2(w + 2), stroke_linecap="round"),
             iron_bar(x0, y0, x1, y1, w, "#2a2a30")]
    if spikes:
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(L / step))
        parts.append(g([spike(x0 + (x1 - x0) * (k + 0.5) / n, y0 + (y1 - y0) * (k + 0.5) / n, w * 0.62, "#2a2a30") for k in range(n)]))
    return g(parts)


def hip_line(a, b):
    return g([line(a[0], a[1], b[0], b[1], stroke="#000", stroke_opacity="0.45", stroke_width="5", stroke_linecap="round"),
              line(a[0], a[1], b[0], b[1], stroke="#3a3440", stroke_width="3", stroke_linecap="round"),
              line(a[0] - 0.8, a[1] - 0.8, b[0] - 0.8, b[1] - 0.8, stroke="#8a7a9a", stroke_opacity="0.4", stroke_width="0.8")])


def cone_roof(s, cx, cy, r, base="#2b2530", rows=None, spire=True):
    """Conical turret roof seen from above: shaded wedges + staggered scale rows + iron spire."""
    parts = [shadow(circle_d(cx, cy, r), r * 0.2 + 3, r * 0.25 + 4, 0.5, soft=4)]
    n = 48
    wedges = {}
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        am = (a0 + a1) / 2
        lit = -(math.cos(am) + math.sin(am)) / 1.414  # 1 = facing top-left
        col = shade(base, 0.09 * lit if lit > 0 else 0.12 * lit)
        wedges.setdefault(col, []).append(P([(cx, cy), (cx + math.cos(a0) * r, cy + math.sin(a0) * r), (cx + math.cos(a1) * (r + 0.3),
                                                                                                        cy + math.sin(a1) * (r + 0.3))]))
    parts.append(g([path("".join(v), fill=c) for c, v in wedges.items()]))
    rows = rows or max(3, int(r / 8))
    arcs = []
    for k in range(1, rows + 1):
        rr = r * k / rows
        m = max(6, int(2 * math.pi * rr / 9))
        off = (k % 2) * math.pi / m
        for j in range(m):
            a0 = off + 2 * math.pi * j / m
            a1 = a0 + 2 * math.pi / m
            # scallop: bulge outward
            mx, my = cx + math.cos((a0 + a1) / 2) * (rr + 2.2), cy + math.sin((a0 + a1) / 2) * (rr + 2.2)
            arcs.append(f"M{f(cx + math.cos(a0) * rr)} {f(cy + math.sin(a0) * rr)}Q{f(mx)} {f(my)} {f(cx + math.cos(a1) * rr)} {f(cy + math.sin(a1) * rr)}")
    parts.append(path("".join(arcs), fill="none", stroke="#000", stroke_opacity="0.5", stroke_width="0.8"))
    parts.append(path("".join(arcs), fill="none", stroke="#c06050", stroke_opacity="0.18", stroke_width="0.4", transform="translate(-0.5 -0.5)"))
    parts.append(circle(cx, cy, r, fill="none", stroke="#0c0a0e", stroke_width="1.6"))
    # 8 iron ribs
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.pi / 8
        parts.append(iron_bar(cx + math.cos(a) * r * 0.12, cy + math.sin(a) * r * 0.12, cx + math.cos(a) * r, cy + math.sin(a) * r, 1.8, "#26262c"))
    if spire:
        parts.append(spike(cx, cy, max(4, r * 0.16), "#26262c", tip=LAVA_Y))
    return g(parts)


def vent(s, cx, cy, w, h, rng):
    """Brimstone chimney stack with a glowing flue and drifting embers/smoke."""
    parts = [shadow(rect_d(cx - w / 2, cy - h / 2, w, h), 6, 8, 0.5, soft=3)]
    parts.append(rubble_hell(s, cx - w / 2, cy - h / 2, w, h, ["#4a1e16", "#5a2418", "#3e1a14"], hot=0.0, sulfur=0.1))
    parts.append(path(rect_d(cx - w / 2, cy - h / 2, w, h), fill="none", stroke="#0d0605", stroke_width="1.2"))
    fw, fh = w * 0.5, h * 0.5
    parts.append(path(rect_d(cx - fw / 2, cy - fh / 2, fw, fh, 1), fill=lava_fill(s, cx - fw / 2, cy - fh / 2, cx + fw / 2, cy + fh / 2)))
    parts.append(path(rect_d(cx - fw / 2, cy - fh / 2, fw, fh, 1), fill="none", stroke="#1a0604", stroke_width="1.4"))
    parts.append(glow(s, cx, cy, w * 1.1, LAVA_O, 0.4))
    puffs = []
    for k in range(5):
        px, py = cx + 6 + k * 7 + rng.uniform(-3, 3), cy - 6 - k * 6 + rng.uniform(-2, 2)
        rr = 4 + k * 1.6
        puffs.append(circle(px, py, rr, fill="#3a3238", fill_opacity=f2(0.45 - k * 0.07)))
    parts.append(g(puffs))
    parts.append(embers(s, cx - 4, cy - 34, 40, 34, 14, rng, 0.9))
    return g(parts)


@asset("h-keep", "structures", [5, 4], "Infernal keep (roof)", "Piekielna twierdza (dach)",
       tags=["keep", "castle", "fortress", "roof", "tower", "hell", "twierdza", "zamek", "dach", "wieża", "piekło"])
def keep(seed):
    s = Svg(500, 400, seed)
    rng = s.rng
    x0, y0, x1, y1 = 60, 50, 440, 290
    hd = (y1 - y0) / 2
    ry = y0 + hd
    ra, rb = x0 + hd, x1 - hd
    # gatehouse wing to the south (gable roof, ridge N-S)
    gx0, gx1, gy1 = 200, 300, 372
    foot = P([(x0, y0), (x1, y0), (x1, y1), (gx1, y1), (gx1, gy1), (gx0, gy1), (gx0, y1), (x0, y1)])
    s.add(shadow(foot, 14, 16, 0.5, soft=5))
    gm = (gx0 + gx1) / 2
    # main hipped roof
    N = [(x0, y0), (x1, y0), (rb, ry), (ra, ry)]
    S = [(x0, y1), (x1, y1), (rb, ry), (ra, ry)]
    W = [(x0, y0), (ra, ry), (x0, y1)]
    E = [(x1, y0), (rb, ry), (x1, y1)]
    s.add(roof_face(s, N, "N", (x0, y0), slate_scales(), light=0.06))
    s.add(roof_face(s, W, "W", (x0, y0), slate_scales(), light=0.09))
    s.add(roof_face(s, S, "S", (x1, y1), slate_scales(), light=-0.18))
    s.add(roof_face(s, E, "E", (x1, y0), slate_scales(), light=-0.26))
    for a, b_ in (((ra, ry), (x0, y0)), ((ra, ry), (x0, y1)), ((rb, ry), (x1, y0)), ((rb, ry), (x1, y1))):
        s.add(hip_line(a, b_))
    # gatehouse gable (same pitch) runs into the south slope; its ridge meets the slope half a wing-width above the eave
    meet = y1 - (gx1 - gx0) / 2
    s.add(roof_face(s, [(gx0, gy1), (gm, gy1), (gm, meet), (gx0, y1)], "W", (gx0, gy1), slate_scales(), light=0.06))
    s.add(roof_face(s, [(gm, gy1), (gx1, gy1), (gx1, y1), (gm, meet)], "E", (gx1, y0), slate_scales(), light=-0.22))
    s.add(hip_line((gx0, y1), (gm, meet)), hip_line((gx1, y1), (gm, meet)))
    s.add(path(foot, fill="none", stroke="#0a080c", stroke_width="2"))
    s.add(ridge_iron(s, (gm, gy1 - 4), (gm, meet), 6, True, 18))
    s.add(ridge_iron(s, (ra - 4, ry), (rb + 4, ry), 8, True, 18))
    # lava-glow vents along the ridge
    s.add(vent(s, 150, 112, 26, 22, rng), vent(s, 372, 238, 26, 22, rng), vent(s, 110, 236, 22, 18, rng))
    # central great spire
    s.add(cone_roof(s, (ra + rb) / 2, ry, 32, rows=4))
    # four corner towers
    for cx, cy in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        s.add(cone_roof(s, cx, cy, 46, rows=6))
    # gatehouse flanking turrets
    s.add(cone_roof(s, gx0, gy1 - 6, 24, rows=3), cone_roof(s, gx1, gy1 - 6, 24, rows=3))
    # banners of red cloth hanging on the south face (seen over the eave)
    for bx in (120, 380):
        s.add(path(f"M{bx - 9} {y1 - 2}h18v26l-9 -7l-9 7Z", fill=BLOOD, stroke="#2a0406", stroke_width="0.8"))
        s.add(path(f"M{bx - 9} {y1 - 2}h18v4h-18Z", fill="#000", fill_opacity="0.35"))
        s.add(circle(bx, y1 + 10, 3.4, fill="none", stroke=LAVA_Y, stroke_width="1"))
    s.add(embers(s, 20, 10, 460, 380, 40, rng, 0.9))
    return s.render()


@asset("h-tower", "structures", [2, 2], "Spiked tower (roof)", "Kolczasta wieża (dach)",
       tags=["tower", "turret", "roof", "spire", "hell", "wieża", "baszta", "dach", "iglica", "piekło"])
def tower(seed):
    s = Svg(200, 200, seed)
    rng = s.rng
    cx, cy = 96, 96
    # crenellated wall ring (obsidian) around the roof
    ring_o, ring_i = 90, 72
    s.add(shadow(circle_d(cx, cy, ring_o), 9, 11, 0.5, soft=4))
    s.add(path(circle_d(cx, cy, ring_o) + circle_d(cx, cy, ring_i), fill=OBS, fill_rule="evenodd", stroke=OBS_D, stroke_width="1.4"))
    s.add(path(circle_d(cx, cy, ring_o) + circle_d(cx, cy, ring_i), fill=s.lg([(0, OBS_L, 0.4), (0.5, OBS_L, 0), (1, "#000", 0.4)], 0, 0, 1, 1),
               fill_rule="evenodd"))
    joints = "".join(f"M{f(cx + math.cos(a) * ring_i)} {f(cy + math.sin(a) * ring_i)}L{f(cx + math.cos(a) * ring_o)} {f(cy + math.sin(a) * ring_o)}"
                     for a in [i * 2 * math.pi / 24 for i in range(24)])
    s.add(path(joints, stroke=LAVA_O, stroke_width="1.4", stroke_opacity="0.6"), path(joints, stroke=LAVA_Y, stroke_width="0.5"))
    for i in range(12):
        a = i * 2 * math.pi / 12 + math.pi / 24
        s.add(spike(cx + math.cos(a) * (ring_o + ring_i) / 2, cy + math.sin(a) * (ring_o + ring_i) / 2, 4.6, "#26262c"))
    s.add(cone_roof(s, cx, cy, 68, rows=8))
    s.add(embers(s, 10, 10, 180, 180, 16, rng, 0.8))
    return s.render()
