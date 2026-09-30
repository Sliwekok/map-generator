from lib import *


# ---------------------------------------------------------------- Flagstone
def flagstone():
    t = Tex(11)
    std_defs(t)
    rng = t.rng
    mortar = "#4a4239"
    t.raw(f'<rect width="200" height="200" fill="{mortar}"/>')
    grain(t, 260, ["#2d2822", "#6b6053", "#80735f"], 0.3, 1.0)
    _, cells = periodic_voronoi(9, rng, relax=3)
    noise = PNoise(rng, 5, 2)
    palette = ["#9a9284", "#8f887b", "#a39a89", "#8a8378", "#9d9486", "#948b7c"]
    for c in cells:
        g = inset(c, 1.6, 2.5)
        cx, cy = c.centroid.x, c.centroid.y
        base = shade(rng.choice(palette), 0.05 * noise(cx, cy) + rng.uniform(-0.03, 0.03))
        stone(t, g, base, bevel=2.6, rough=1.0, step=6, speckle=30, cracks=(0, 2), chips=(1, 3), pits=4)
    # worn dust in joints
    for _ in range(40):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        t.circle(x, y, rng.uniform(0.6, 1.4), fill="#6f6556", opacity=0.5)
    return t


# ---------------------------------------------------------------- Stone bricks (running bond)
def stone_bricks():
    t = Tex(22)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#3b3d40"/>')
    grain(t, 220, ["#25272a", "#55585c", "#6a6d70"], 0.3, 0.9)
    rows = 4
    h = S / rows
    palette = ["#8a8f96", "#7f858c", "#949aa0", "#868b90", "#7a8087", "#9197a0"]
    for r in range(rows):
        y0 = r * h
        # widths summing to S
        ws = []
        left = S
        while left > 0:
            w = rng.choice([40, 50, 60, 50, 70])
            if left - w < 35 and left - w != 0:
                w = left
            ws.append(w)
            left -= w
        x = rng.uniform(0, S)
        for w in ws:
            p = box(x + 1.4, y0 + 1.4, x + w - 1.4, y0 + h - 1.4)
            p = inset(p, 0, 2.0)
            base = shade(rng.choice(palette), rng.uniform(-0.04, 0.03))
            stone(t, p, base, bevel=2.8, rough=0.7, step=7, speckle=28, cracks=(0, 1), chips=(1, 3), pits=3)
            x += w
    return t


# ---------------------------------------------------------------- Cave floor
CAVE_PAL = ["#4f4740", "#474038", "#574d42", "#433c35", "#4d443b", "#3f3934"]


def cave_floor(seed=33, moss_on=False, palette=CAVE_PAL, bg="#231f1b", blot=("#3a332c", "#2c2722", "#453c33"),
               peb=("#6a5f53", "#5b5147", "#756a5c", "#7a6e60", "#554b42"), crevice="#120f0d", grain_c=("#15120f", "#7d705f")):
    t = Tex(seed)
    std_defs(t)
    rng = t.rng
    t.raw(f'<rect width="200" height="200" fill="{bg}"/>')
    noise = PNoise(rng, 7, 3)
    # low rolling rock surface tone
    blotches(t, 40, list(blot), 18, 40, (0.35, 0.7))
    _, cells = periodic_voronoi(11, rng, relax=1)
    for c in cells:
        g = inset(c, rng.uniform(2.2, 6), 5)
        if g.is_empty:
            continue
        base = shade(rng.choice(palette), 0.05 * noise(c.centroid.x, c.centroid.y))
        stone(t, g, base, bevel=3.5, rough=2.2, step=5, shadow=0.5, sh_off=(1.8, 2.6), speckle=14, cracks=(1, 2), chips=(1, 2), smooth=True, pits=3)
        # strata / erosion contours
        for k, d in enumerate((6, 13)):
            sub = inset(g, d + rng.uniform(-1.5, 1.5), 2)
            if sub.is_empty or sub.area < 40:
                break
            cp = jitter_ring(ring(sub), rng, 6, 1.3)
            t.poly(cp, smooth=True, fill="none", stroke=shade(base, -0.14), stroke_width=0.7, opacity=0.5)
            t.poly([(x - 0.6, y - 0.7) for x, y in cp], smooth=True, fill="none", stroke=shade(base, 0.1), stroke_width=0.5, opacity=0.35)
    # crevice depth lines
    for c in cells:
        pts = jitter_ring(ring(c), rng, 7, 1.5)
        t.poly(pts, smooth=True, fill="none", stroke=crevice, stroke_width=1.6, opacity=0.8, stroke_linejoin="round")
    # rubble and pebbles in the cracks
    for c in cells:
        for (x, y) in ring(c):
            for _ in range(rng.randint(0, 2)):
                pebble(t, x + rng.gauss(0, 4), y + rng.gauss(0, 4), rng.uniform(1, 2.8), rng.choice(peb[:3]))
    for _ in range(26):
        pebble(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(0.8, 2.2), rng.choice(peb))
    grain(t, 160, list(grain_c), 0.25, 0.7, (0.3, 0.6))
    if moss_on:
        greens = ["#2f4a1f", "#3f6326", "#557d2e", "#6b9437", "#2a3f1b"]
        for c in cells:
            vs = ring(c)
            for (x, y) in rng.sample(vs, min(len(vs), rng.randint(1, 3))):
                moss(t, x + rng.gauss(0, 3), y + rng.gauss(0, 3), rng.uniform(4, 9), greens)
        # damp puddle
        cx, cy = rng.uniform(0, S), rng.uniform(0, S)
        k = 12
        pts = [(cx + math.cos(i / k * 6.283) * 18 * rng.uniform(0.7, 1.1), cy + math.sin(i / k * 6.283) * 11 * rng.uniform(0.7, 1.1)) for i in range(k)]
        wg = t.rad([(0, "#3f5a5e", 0.85), (0.8, "#1d2a2c", 0.9), (1, "#101617", 0.9)], gid="pud")
        t.poly(pts, smooth=True, fill=f"url(#{wg})")
        t.poly(pts, smooth=True, fill="none", stroke="#8fb0b0", stroke_width=0.6, opacity=0.35)
        t.ellipse(cx - 5, cy - 3, 6, 1.4, -12, fill="#cfe6e6", opacity=0.3)
        # tiny cave mushrooms
        for _ in range(5):
            x, y = rng.uniform(0, S), rng.uniform(0, S)
            for _ in range(rng.randint(2, 4)):
                mx, my = x + rng.gauss(0, 2.5), y + rng.gauss(0, 2.5)
                r = rng.uniform(0.9, 1.8)
                t.circle(mx + 0.4, my + 0.6, r, fill="#000", opacity=0.4)
                t.circle(mx, my, r, fill=rng.choice(["#c9b98f", "#b9a476", "#d8cda8"]))
                t.circle(mx - r * 0.3, my - r * 0.3, r * 0.35, fill="#fff", opacity=0.5)
    return t


# ---------------------------------------------------------------- Dirt
def dirt():
    t = Tex(44)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#6b5037"/>')
    blotches(t, 70, ["#5a432e", "#7a5d40", "#634a33", "#846646", "#51402d"], 8, 30, (0.25, 0.55))
    blotches(t, 90, ["#4a3827", "#8a6c4b", "#735738"], 3, 9, (0.2, 0.45))
    # compacted footpath scuffs
    for _ in range(14):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        a = rng.uniform(0, 180)
        t.ellipse(x, y, rng.uniform(6, 14), rng.uniform(1.5, 3), a, fill="#8e7152", opacity=0.3)
    grain(t, 700, ["#3f2f21", "#8c6f50", "#a0835f", "#58432f", "#2e2218"], 0.25, 0.8, (0.35, 0.75))
    # pebbles
    for _ in range(34):
        pebble(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(1.4, 4.5), rng.choice(["#8b7f70", "#9a8c79", "#7a6d5e", "#a69683", "#6f6254"]))
    # twigs / roots
    for _ in range(7):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        pts = random_walk((x, y), rng, 5, rng.uniform(2.5, 4.5), rng.uniform(0, 6.28), 0.35)
        t.line([(px + 0.6, py + 0.8) for px, py in pts], stroke="#000", stroke_width=1.6, opacity=0.3, stroke_linecap="round")
        t.line(pts, stroke=rng.choice(["#4a3522", "#5c4430", "#3d2c1c"]), stroke_width=1.3, stroke_linecap="round")
        t.line(pts[:3], stroke="#8a6a48", stroke_width=0.4, opacity=0.6, stroke_linecap="round")
    # dried grass bits
    for _ in range(6):
        tuft(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(4, 7), ["#8a7a42", "#a39150", "#6f6436"], 5)
    return t


# ---------------------------------------------------------------- Gravel
def gravel():
    t = Tex(55)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#57504a"/>')
    grain(t, 250, ["#2f2b27", "#6e675e"], 0.3, 1.0, (0.4, 0.8))
    # poisson-ish placement, periodic distance
    pts = []
    cols = ["#8d877e", "#9e978c", "#7b756d", "#aaa295", "#857c70", "#958a7a", "#6f6a64", "#b3ab9f", "#8b8174"]
    tries = 0
    while tries < 30000 and len(pts) < 330:
        tries += 1
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        r = rng.choice([3.0, 3.6, 4.2, 4.8, 5.4, 6.2, 7.0, 8.0])
        ok = True
        for (px, py, pr) in pts:
            dx = min(abs(x - px), S - abs(x - px))
            dy = min(abs(y - py), S - abs(y - py))
            if dx * dx + dy * dy < (r + pr - 2.4) ** 2:
                ok = False
                break
        if ok:
            pts.append((x, y, r))
    pts.sort(key=lambda p: p[1])
    for x, y, r in pts:
        base = shade(rng.choice(cols), rng.uniform(-0.04, 0.04))
        pebble(t, x, y, r, base)
        if r > 3 and rng.random() < 0.5:
            t.circle(x + rng.gauss(0, r * 0.3), y + rng.gauss(0, r * 0.3), 0.4, fill=shade(base, -0.2), opacity=0.7)
    return t


# ---------------------------------------------------------------- Old planks
def wood_board(t, x0, y0, w, h, base, vertical=True, grain_n=7, knots=True, nails=True, worn=True):
    """Draw one board with grain. Grain lines run along its length."""
    rng = t.rng
    L = h if vertical else w
    W = w if vertical else h

    def P(u, v):  # u along length, v across
        return (x0 + v, y0 + u) if vertical else (x0 + u, y0 + v)

    rect = [P(0, 0), P(0, W), P(L, W), P(L, 0)]
    t.poly(rect, fill=base, _pad=1)
    gid = "bshV" if vertical else "bshH"
    t.poly(rect, fill=f"url(#{gid})", _pad=1)
    # colour bands
    for _ in range(3):
        v = rng.uniform(0, W)
        bw = rng.uniform(1.5, W * 0.35)
        t.poly([P(0, v), P(0, v + bw), P(L, v + bw), P(L, v)], fill=rng.choice([shade(base, -0.06), shade(base, 0.05)]), opacity=0.5, _pad=1)
    # grain lines
    for i in range(grain_n):
        v0 = (i + rng.uniform(0.2, 0.8)) * W / grain_n
        amp = rng.uniform(0.3, 1.2)
        per = rng.uniform(25, 70)
        ph = rng.uniform(0, 6.28)
        pts = []
        n = int(L / 6) + 2
        for k in range(n):
            u = L * k / (n - 1)
            v = v0 + amp * math.sin(u / per * 6.28 + ph)
            v = max(0.4, min(W - 0.4, v))
            pts.append(P(u, v))
        t.line(pts, stroke=shade(base, -0.2), stroke_width=round(rng.uniform(0.4, 0.9), 2), opacity=round(rng.uniform(0.6, 0.95), 2))
    if knots and rng.random() < 0.7:
        u, v = rng.uniform(L * 0.15, L * 0.85), rng.uniform(W * 0.3, W * 0.7)
        cx, cy = P(u, v)
        rx, ry = (1.8, 3.8) if vertical else (3.8, 1.8)
        t.ellipse(cx, cy, rx * 2.4, ry * 2.4, 0, fill="none", stroke=shade(base, -0.2), stroke_width=0.5, opacity=0.7)
        for c, sc in [(shade(base, -0.08), 1.8), (shade(base, -0.16), 1.3), (shade(base, -0.22), 0.9), (shade(base, -0.28), 0.45)]:
            t.ellipse(cx, cy, rx * sc, ry * sc, 0, fill=c)
    # edge shading lines
    t.line([P(0, 0.4), P(L, 0.4)], smooth=False, stroke=shade(base, 0.15), stroke_width=0.8, opacity=0.6)
    t.line([P(0, W - 0.5), P(L, W - 0.5)], smooth=False, stroke="#000", stroke_width=1, opacity=0.35)
    if worn:
        for _ in range(rng.randint(1, 3)):
            u = rng.uniform(0, L)
            v = rng.uniform(1, W - 1)
            ll = rng.uniform(4, 12)
            t.line([P(u, v), P(u + ll, v + rng.uniform(-0.6, 0.6))], smooth=False, stroke=shade(base, -0.3), stroke_width=0.6, opacity=0.8)
    if nails:
        for u in (3.5, L - 3.5):
            for v in (W * 0.25, W * 0.75):
                x, y = P(u, v)
                t.circle(x + 0.3, y + 0.4, 1.0, fill="#000", opacity=0.4)
                t.circle(x, y, 0.9, fill="#3b3631")
                t.circle(x - 0.3, y - 0.3, 0.35, fill="#9a948c", opacity=0.8)


def board_defs(t):
    t.lin([(0, "#fff", 0.10), (0.5, "#fff", 0), (1, "#000", 0.18)], 0, 0, 1, 0, gid="bshV")
    t.lin([(0, "#fff", 0.10), (0.5, "#fff", 0), (1, "#000", 0.18)], 0, 0, 0, 1, gid="bshH")


def old_planks():
    t = Tex(66)
    std_defs(t)
    board_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#1e150e"/>')
    n = 5
    W = S / n
    palette = ["#7a5a3a", "#6e5034", "#85633f", "#735437", "#6a4b30", "#7f5e3c"]
    for i in range(n):
        x = i * W
        # 1 or 2 butt joints per column
        cuts = sorted(rng.sample(range(10, 190, 5), rng.randint(1, 2)))
        segs = []
        for j, c in enumerate(cuts):
            nxt = cuts[j + 1] if j + 1 < len(cuts) else cuts[0] + S
            segs.append((c, nxt - c))
        for (y0, L) in segs:
            base = shade(rng.choice(palette), rng.uniform(-0.04, 0.04))
            wood_board(t, x + 0.6, y0 + 0.6, W - 1.2, L - 1.2, base, True)
    # dust and stains
    blotches(t, 10, ["#2a1d12", "#9c7d57"], 8, 20, (0.08, 0.18))
    grain(t, 150, ["#2b1f14", "#b39570"], 0.25, 0.6, (0.2, 0.5))
    return t


FREE = {
    "f-flagstone": flagstone,
    "f-stone-bricks": stone_bricks,
    "f-cave-floor": cave_floor,
    "f-dirt": dirt,
    "f-gravel": gravel,
    "f-old-planks": old_planks,
}
