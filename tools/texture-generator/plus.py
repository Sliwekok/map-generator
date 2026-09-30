from lib import *
from free import cave_floor, wood_board, board_defs


# ---------------------------------------------------------------- Herringbone bricks
def herringbone():
    t = Tex(101)
    std_defs(t)
    rng = t.rng
    w = 12.5
    t.raw('<rect width="200" height="200" fill="#b3a590"/>')
    grain(t, 250, ["#8a7d6a", "#d2c6b2", "#6f6454"], 0.3, 0.8)
    pal = ["#9a4a32", "#8c412c", "#a5543a", "#7f3a27", "#b0603f", "#93472f", "#86503a", "#a0442c"]
    g = 0.9
    origins = set()
    for a in range(-40, 41):
        for b in range(-20, 21):
            origins.add(((a * w + b * 2 * w) % S, (a * w - b * 2 * w) % S))
    for px, py in sorted(origins, key=lambda o: (o[1], o[0])):
        for (x0, y0, ww, hh) in ((px, py, 2 * w, w), (px, py + w, w, 2 * w)):
            if True:
                p = inset(box(x0 + g, y0 + g, x0 + ww - g, y0 + hh - g), 0, 1.2)
                base = shade(rng.choice(pal), rng.uniform(-0.04, 0.04))
                stone(t, p, base, bevel=1.4, rough=0.35, step=6, shadow=0.3, sh_off=(0.7, 0.9), speckle=5,
                      cracks=(0, 0), chips=(0, 1), pits=1)
                if rng.random() < 0.18:  # soot / efflorescence stains
                    cx, cy = rand_in(p, rng)
                    t.ellipse(cx, cy, rng.uniform(3, 7), rng.uniform(2, 4), rng.uniform(0, 180),
                              fill=rng.choice(["#2b1a12", "#e8dcc8"]), opacity=0.18)
    return t


# ---------------------------------------------------------------- Marble checker
def marble():
    t = Tex(102)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#8f8a80"/>')
    tiles = [((0, 0), "white"), ((100, 100), "white"), ((100, 0), "green"), ((0, 100), "green")]
    sheen = t.lin([(0, "#fff", 0), (0.42, "#fff", 0.0), (0.5, "#fff", 0.16), (0.58, "#fff", 0), (1, "#fff", 0)], 0, 0, 1, 1)
    edge = t.lin([(0, "#fff", 0.35), (0.06, "#fff", 0), (0.94, "#000", 0), (1, "#000", 0.3)], 0, 0, 1, 1)
    for (x0, y0), kind in tiles:
        cid = t.gid("c")
        t.defs.append(f'<clipPath id="{cid}"><rect x="{x0 + 0.8}" y="{y0 + 0.8}" width="98.4" height="98.4"/></clipPath>')
        if kind == "white":
            base, cloud, veins = "#e9e4da", ["#d9d3c7", "#f5f2ec", "#cfc9bd"], ["#8d8a86", "#a8a39b", "#6f6c69", "#b89c63"]
        else:
            base, cloud, veins = "#1d3a32", ["#15302a", "#28493f", "#0f241f", "#325448"], ["#cfe0d6", "#e8efe9", "#8fb3a2", "#c9a95c"]
        out = [f'<g clip-path="url(#{cid})">', f'<rect x="{x0}" y="{y0}" width="100" height="100" fill="{base}"/>']
        for _ in range(16):
            cx, cy = x0 + rng.uniform(-10, 110), y0 + rng.uniform(-10, 110)
            r = rng.uniform(10, 32)
            k = 9
            pts = [(cx + math.cos(i / k * 6.283) * r * rng.uniform(0.5, 1.3), cy + math.sin(i / k * 6.283) * r * rng.uniform(0.5, 1.3)) for i in range(k)]
            out.append(f'<path d="{smooth_path(pts)}" fill="{rng.choice(cloud)}" opacity="{rng.uniform(0.25, 0.6):.2f}"/>')
        # main veins: long wandering diagonals with branches
        main_a = rng.uniform(0, 6.283)
        for v in range(rng.randint(3, 5)):
            sx, sy = x0 + rng.uniform(-20, 120), y0 + rng.uniform(-20, 120)
            pts = random_walk((sx, sy), rng, 16, rng.uniform(6, 10), main_a + rng.gauss(0, 0.4), 0.35)
            col = rng.choice(veins)
            wv = rng.uniform(0.5, 1.6)
            d = smooth_path(pts, close=False)
            out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{wv * 4:.1f}" opacity="0.10" stroke-linecap="round"/>')
            out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{wv:.1f}" opacity="{rng.uniform(0.55, 0.9):.2f}" stroke-linecap="round"/>')
            for _ in range(rng.randint(2, 4)):
                bp = pts[rng.randint(2, len(pts) - 3)]
                br = random_walk(bp, rng, rng.randint(4, 8), rng.uniform(3, 6), main_a + rng.choice([-1, 1]) * rng.uniform(0.5, 1.2), 0.5)
                out.append(f'<path d="{smooth_path(br, close=False)}" fill="none" stroke="{col}" stroke-width="{wv * 0.45:.1f}" opacity="0.7" stroke-linecap="round"/>')
        # hairline crazing
        for _ in range(10):
            sx, sy = x0 + rng.uniform(0, 100), y0 + rng.uniform(0, 100)
            pts = random_walk((sx, sy), rng, 5, rng.uniform(2, 4), rng.uniform(0, 6.28), 0.8)
            out.append(f'<path d="{poly_path(pts, False)}" fill="none" stroke="{rng.choice(veins)}" stroke-width="0.3" opacity="0.5"/>')
        # sparkle flecks
        for _ in range(30):
            out.append(f'<circle cx="{f(x0 + rng.uniform(0, 100))}" cy="{f(y0 + rng.uniform(0, 100))}" r="{f(rng.uniform(0.2, 0.6))}" fill="#fff" opacity="{rng.uniform(0.3, 0.8):.2f}"/>')
        out.append(f'<rect x="{x0}" y="{y0}" width="100" height="100" fill="url(#{sheen})"/>')
        out.append(f'<rect x="{x0}" y="{y0}" width="100" height="100" fill="url(#{edge})"/>')
        out.append("</g>")
        t.raw("".join(out))
    # grout highlight lines
    t.raw('<path d="M0 0.4H200M0 100.4H200M0.4 0V200M100.4 0V200" stroke="#fff" stroke-width="0.5" opacity="0.25"/>')
    return t


# ---------------------------------------------------------------- Hex tiles
def hex_tiles():
    t = Tex(103)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#3d3328"/>')
    grain(t, 200, ["#241d16", "#5e5040"], 0.3, 0.8)
    s = 50 / 3
    h = S / 7
    pal = ["#b8946a", "#a9845b", "#c29f74", "#9d7a53", "#b08a60", "#8c6e4e", "#c4a47c"]
    accent = ["#7a5a42", "#6b4e3a"]
    for col in range(8):
        cx = col * 25
        for row in range(7):
            cy = row * h + (h / 2 if col % 2 else 0)
            pts = [(cx + s, cy), (cx + s / 2, cy + h / 2), (cx - s / 2, cy + h / 2), (cx - s, cy), (cx - s / 2, cy - h / 2), (cx + s / 2, cy - h / 2)]
            p = inset(Polygon(pts), 1.1, 1.4)
            base = rng.choice(accent) if rng.random() < 0.12 else rng.choice(pal)
            stone(t, p, shade(base, rng.uniform(-0.03, 0.03)), bevel=2, rough=0.45, step=5, shadow=0.35, sh_off=(0.8, 1.1), speckle=12,
                  cracks=(0, 1), chips=(0, 2), pits=2)
    return t


# ---------------------------------------------------------------- Mosaic (temple floor)
def mosaic():
    t = Tex(104)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#a89a80"/>')
    C = {
        "cream": ["#e6dcc4", "#ddd2b8", "#efe6d0", "#d8ccb0"],
        "terra": ["#b0532f", "#a24a2a", "#bd6139", "#99452a"],
        "gold": ["#d4a642", "#c89a38", "#dfb453", "#bf9135"],
        "teal": ["#2f6d6a", "#28605d", "#377a76", "#235552"],
        "dark": ["#3b2a26", "#33241f", "#46322c"],
        "red": ["#7c2322", "#6e1f1e", "#8a2a27"],
    }
    star = []
    for i in range(16):
        a = i / 16 * 6.283 - 6.283 / 32 * 0 + 6.283 / 16 / 2
        r = 58 if i % 2 == 0 else 38
        star.append((100 + math.cos(a) * r, 100 + math.sin(a) * r))
    starP = Polygon(star)
    starIn = starP.buffer(-6)

    def region(x, y):
        dx, dy = x - 100, y - 100
        r = math.hypot(dx, dy)
        e = min(x, y, S - x, S - y)
        cr = min(math.hypot(x - cx, y - cy) for cx in (0, S) for cy in (0, S))
        if e < 3.5:
            return "red"
        if e < 7:
            return "gold"
        if cr < 24:
            return "teal" if cr < 19 else "gold"
        if cr < 28:
            return "dark"
        if r < 9:
            return "gold"
        if r < 15:
            return "red"
        if r < 20:
            return "cream"
        pt = Point(x, y)
        if starIn.contains(pt):
            return "terra"
        if starP.contains(pt):
            return "gold"
        if 70 < r < 76:
            return "teal"
        if 76 <= r < 79:
            return "gold"
        if 66 < r <= 70:
            return "dark"
        # diagonal lozenges between ring and corners
        if abs(abs(dx) - abs(dy)) < 5 and 80 < r < 112:
            return "terra"
        return "cream"

    q = 4.0
    n = int(S / q)
    by_col = {}
    for i in range(n):
        for j in range(n):
            x, y = i * q + q / 2, j * q + q / 2
            reg = region(x, y)
            c = rng.choice(C[reg])
            jx, jy = rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)
            sz = q - rng.uniform(0.6, 1.0)
            by_col.setdefault(c, []).append(f"M{f(x - sz / 2 + jx)} {f(y - sz / 2 + jy)}h{f(sz)}v{f(sz)}h{f(-sz)}z")
    # one path per colour = small file, many tesserae
    for c, ds in by_col.items():
        t.raw(f'<path d="{"".join(ds)}" fill="{c}"/>')
    # per-tessera light/shade via overlay grid of tiny highlights
    hl = []
    for i in range(n):
        for j in range(n):
            if rng.random() < 0.55:
                x, y = i * q + q / 2, j * q + q / 2
                hl.append(f"M{f(x - 1.4)} {f(y - 1.5)}h{f(rng.uniform(1.2, 2.4))}v0.5h{f(-1.8)}z")
    t.raw(f'<path d="{"".join(hl)}" fill="#fff" opacity="0.28"/>')
    # wear and grime
    blotches(t, 18, ["#5c4a36", "#f4ecd8"], 6, 22, (0.06, 0.14))
    for _ in range(4):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        pts = random_walk((x, y), rng, 7, 4, rng.uniform(0, 6.28), 0.5)
        t.line(pts, smooth=False, stroke="#2d2118", stroke_width=0.6, opacity=0.6)
    # a few missing tesserae
    for _ in range(9):
        i, j = rng.randrange(n), rng.randrange(n)
        x, y = i * q + 0.5, j * q + 0.5
        t.raw(f'<rect x="{f(x)}" y="{f(y)}" width="3" height="3" fill="#7d705c"/><rect x="{f(x)}" y="{f(y)}" width="3" height="0.8" fill="#000" opacity="0.3"/>')
    return t


# ---------------------------------------------------------------- Cracked earth
def cracked_earth():
    t = Tex(105)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#3b2a1a"/>')
    _, cells = periodic_voronoi(18, rng, relax=1)
    pal = ["#b89a6e", "#c2a578", "#ad8f63", "#bb9d70", "#a88a5e"]
    for c in cells:
        pieces = [c]
        # split some plates with a secondary crack
        if rng.random() < 0.5:
            cx, cy = c.centroid.x, c.centroid.y
            a = rng.uniform(0, 3.14)
            L = 80
            cut = LineString([(cx - math.cos(a) * L, cy - math.sin(a) * L), (cx + math.cos(a) * L, cy + math.sin(a) * L)]).buffer(0.9)
            dif = c.difference(cut)
            if dif.geom_type == "MultiPolygon":
                pieces = list(dif.geoms)
        for pc in pieces:
            g = inset(pc, rng.uniform(1.2, 2.4), 1.5)
            if g.is_empty or g.area < 15:
                continue
            base = shade(rng.choice(pal), rng.uniform(-0.03, 0.03))
            # dried-mud plates curl: bright rim, darker centre
            stone(t, g, base, bevel=1.8, rough=0.9, step=5, shadow=0.55, sh_off=(1.2, 1.6), speckle=10, cracks=(0, 2), chips=(0, 1),
                  dark=shade(base, 0.07), light=shade(base, 0.1), pits=2)
    # hairline crack network
    for _ in range(26):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        pts = random_walk((x, y), rng, 5, rng.uniform(2, 4), rng.uniform(0, 6.28), 0.7)
        t.line(pts, smooth=False, stroke="#5a4128", stroke_width=0.35, opacity=0.8)
    for _ in range(12):
        pebble(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(1, 2.4), rng.choice(["#8d7a5f", "#9c8a6c"]))
    for _ in range(3):
        tuft(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(4, 6), ["#8a7a42", "#6f6436", "#a39150"], 5)
    return t


# ---------------------------------------------------------------- Parquet (basket weave)
def parquet():
    t = Tex(106)
    board_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#2a1a0e"/>')
    pal_a = ["#b0793f", "#a66f38", "#ba8448", "#9f6a35"]
    pal_b = ["#8a5a2c", "#7f5229", "#935f30", "#784c25"]
    q = 50
    for i in range(4):
        for j in range(4):
            x0, y0 = i * q, j * q
            vert = (i + j) % 2 == 0
            pal = pal_a if vert else pal_b
            for k in range(3):
                wdt = q / 3
                if vert:
                    wood_board(t, x0 + k * wdt + 0.4, y0 + 0.4, wdt - 0.8, q - 0.8, rng.choice(pal), True, grain_n=5, nails=False, worn=rng.random() < 0.3)
                else:
                    wood_board(t, x0 + 0.4, y0 + k * wdt + 0.4, q - 0.8, wdt - 0.8, rng.choice(pal), False, grain_n=5, nails=False, worn=rng.random() < 0.3)
    varnish = t.lin([(0, "#fff", 0.0), (0.35, "#fff", 0.10), (0.5, "#fff", 0.0), (0.8, "#fff", 0.07), (1, "#fff", 0)], 0, 0, 1, 1)
    t.raw(f'<rect width="200" height="200" fill="url(#{varnish})"/>')
    return t


# ---------------------------------------------------------------- Ice
def ice():
    t = Tex(107)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#b7d6e4"/>')
    blotches(t, 36, ["#a3c7d8", "#d3eaf2", "#8db6ca", "#c3e0ec"], 20, 55, (0.12, 0.3))
    blotches(t, 8, ["#5f8fa8", "#4f7f9a"], 14, 34, (0.08, 0.16))  # deep dark water under ice
    # frozen bubbles
    for _ in range(40):
        x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(0.6, 2.2)
        t.circle(x, y, r, fill="#e9f6fb", fill_opacity=0.25, stroke="#ffffff", stroke_width=0.35, stroke_opacity=0.8)
        t.circle(x - r * 0.35, y - r * 0.35, r * 0.25, fill="#fff", opacity=0.9)
    # major crack network

    def crack(p, a, steps, L, wdt, depth=0):
        pts = random_walk(p, rng, steps, L, a, 0.35)
        t.line(pts, smooth=False, stroke="#ffffff", stroke_width=wdt * 4, opacity=0.18, stroke_linecap="round", stroke_linejoin="round")
        t.line(pts, smooth=False, stroke="#2f5f7a", stroke_width=wdt * 1.2, opacity=0.9, stroke_linecap="round", stroke_linejoin="round")
        t.line([(x + 0.5, y + 0.4) for x, y in pts], smooth=False, stroke="#ffffff", stroke_width=wdt * 0.5, opacity=0.9, stroke_linecap="round")
        if depth < 2:
            for _ in range(rng.randint(1, 3)):
                q = pts[rng.randint(1, len(pts) - 1)]
                crack(q, a + rng.choice([-1, 1]) * rng.uniform(0.6, 1.4), max(3, steps // 2), L * 0.7, wdt * 0.6, depth + 1)

    for _ in range(3):
        crack((rng.uniform(0, S), rng.uniform(0, S)), rng.uniform(0, 6.28), 12, rng.uniform(7, 10), 1.3)
    # radial "star" fracture
    cx, cy = rng.uniform(0, S), rng.uniform(0, S)
    for k in range(7):
        crack((cx, cy), k / 7 * 6.283 + rng.gauss(0, 0.2), 4, rng.uniform(3, 5), 0.6, 2)
    # frost and snow dust
    for _ in range(6):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        r = rng.uniform(6, 16)
        k = 10
        pts = [(x + math.cos(i / k * 6.283) * r * rng.uniform(0.5, 1.2), y + math.sin(i / k * 6.283) * r * 0.6 * rng.uniform(0.5, 1.2)) for i in range(k)]
        t.poly(pts, smooth=True, fill="#f4fbfe", opacity=0.55)
    grain(t, 300, ["#ffffff", "#e6f4fa"], 0.2, 0.6, (0.4, 0.9))
    # glassy sheen
    g = t.lin([(0, "#fff", 0), (0.45, "#fff", 0.0), (0.5, "#fff", 0.22), (0.55, "#fff", 0), (1, "#fff", 0)], 0, 1, 1, 0)
    t.raw(f'<rect width="200" height="200" fill="url(#{g})"/>')
    return t


# ---------------------------------------------------------------- Crystal cave
def crystal_cave():
    t = cave_floor(seed=108, palette=["#3e3848", "#373142", "#453e50", "#322d3b", "#3b3446"], bg="#17141c",
                   blot=("#2a2433", "#1f1b26", "#332c3d"), peb=("#5a5268", "#4d465a", "#655c73", "#6d6480", "#443e50"),
                   crevice="#0b090e", grain_c=("#0e0c12", "#7a6f8e"))
    rng = t.rng
    glow = t.rad([(0, "#c49bff", 0.55), (0.5, "#8f5fe0", 0.2), (1, "#6a3fc0", 0)], gid="glow")
    glow2 = t.rad([(0, "#7fe3ff", 0.5), (0.5, "#3fa6d8", 0.18), (1, "#2a7fb0", 0)], gid="glow2")
    tints = [("#b88cff", "#7a4ad6", "#e7d6ff", "glow"), ("#7fdcff", "#3b8fc4", "#dff6ff", "glow2")]
    for ci in range(4):
        cx, cy = rng.uniform(0, S), rng.uniform(0, S)
        light, dark, hi, gl = tints[ci % 2]
        R = rng.uniform(14, 22)
        t.circle(cx, cy, R * 1.8, fill=f"url(#{gl})")
        shards = []
        for _ in range(rng.randint(4, 7)):
            a = rng.uniform(0, 6.283)
            L = rng.uniform(R * 0.5, R * 1.1)
            wdt = rng.uniform(2.5, 4.5)
            bx, by = cx + math.cos(a) * rng.uniform(0, 3), cy + math.sin(a) * rng.uniform(0, 3)
            shards.append((L, a, wdt, bx, by))
        shards.sort()
        for L, a, wdt, bx, by in shards:
            ux, uy = math.cos(a), math.sin(a)
            nx, ny = -uy, ux
            tip = (bx + ux * L, by + uy * L)
            sh = (bx + ux * L * 0.75, by + uy * L * 0.75)
            l1 = (sh[0] + nx * wdt, sh[1] + ny * wdt)
            r1 = (sh[0] - nx * wdt, sh[1] - ny * wdt)
            l0 = (bx + nx * wdt * 0.8, by + ny * wdt * 0.8)
            r0 = (bx - nx * wdt * 0.8, by - ny * wdt * 0.8)
            # shadow
            t.poly([(x + 1.5, y + 2) for x, y in (l0, l1, tip, r1, r0)], fill="#000", opacity=0.45)
            t.poly([l0, l1, tip, sh, (bx, by)], fill=light)
            t.poly([r0, r1, tip, sh, (bx, by)], fill=dark)
            t.poly([(bx, by), sh, tip], fill=hi, opacity=0.45)
            t.line([(bx, by), tip], smooth=False, stroke=hi, stroke_width=0.4, opacity=0.8)
        # crystal gravel + sparkles around
        for _ in range(10):
            a, d = rng.uniform(0, 6.283), rng.uniform(R * 0.6, R * 1.6)
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
            r = rng.uniform(0.8, 1.8)
            t.poly([(x, y - r * 1.3), (x + r, y), (x, y + r * 1.3), (x - r, y)], fill=rng.choice([light, dark]))
        for _ in range(6):
            a, d = rng.uniform(0, 6.283), rng.uniform(0, R * 1.4)
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
            r = rng.uniform(1.2, 2.4)
            t.path(f"M{f(x)} {f(y - r)}L{f(x + r * 0.2)} {f(y - r * 0.2)}L{f(x + r)} {f(y)}L{f(x + r * 0.2)} {f(y + r * 0.2)}L{f(x)} {f(y + r)}L{f(x - r * 0.2)} {f(y + r * 0.2)}L{f(x - r)} {f(y)}L{f(x - r * 0.2)} {f(y - r * 0.2)}Z",
                   (x - r, y - r, x + r, y + r), fill="#fff", opacity=0.85)
    return t


# ---------------------------------------------------------------- Swamp mud
def swamp_mud():
    t = Tex(109)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#3f3a25"/>')
    blotches(t, 60, ["#4b4530", "#35301e", "#554d33", "#2d2a1a", "#5b5536"], 8, 26, (0.15, 0.35))
    for _ in range(12):
        t.ellipse(rng.uniform(0, S), rng.uniform(0, S), rng.uniform(4, 10), rng.uniform(1, 2.5), rng.uniform(0, 180), fill="#a8a580", opacity=0.15)
    grain(t, 350, ["#1f1c10", "#6d6443", "#7a7048"], 0.3, 0.9, (0.3, 0.7))
    water = t.lin([(0, "#161c12", 0.95), (0.25, "#2a3524", 0.92), (1, "#46553c", 0.9)], 0, 0, 0.3, 1, gid="swp")
    for _ in range(3):
        cx, cy = rng.uniform(0, S), rng.uniform(0, S)
        rx, ry = rng.uniform(26, 40), rng.uniform(16, 26)
        k = 14
        pts = [(cx + math.cos(i / k * 6.283) * rx * rng.uniform(0.85, 1.1), cy + math.sin(i / k * 6.283) * ry * rng.uniform(0.85, 1.1)) for i in range(k)]
        t.poly(pts, smooth=True, fill="none", stroke="#2b2616", stroke_width=5, opacity=0.45)  # wet muddy margin
        t.poly(pts, smooth=True, fill="none", stroke="#6b6444", stroke_width=1.6, opacity=0.35)
        t.poly(pts, smooth=True, fill=f"url(#{water})")
        # reflections / ripples
        t.ellipse(cx - rx * 0.25, cy - ry * 0.3, rx * 0.45, 1.3, rng.uniform(-10, 10), fill="#dbe6d6", opacity=0.35)
        t.ellipse(cx - rx * 0.1, cy - ry * 0.12, rx * 0.25, 0.8, rng.uniform(-10, 10), fill="#dbe6d6", opacity=0.25)
        t.ellipse(cx + rx * 0.2, cy + ry * 0.2, rx * 0.25, ry * 0.18, 0, fill="none", stroke="#9fb39a", stroke_width=0.4, opacity=0.4)
        # algae scum
        for _ in range(rng.randint(14, 22)):
            a = rng.uniform(0, 6.283)
            d = rng.uniform(0.8, 0.98)
            t.circle(cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d, rng.uniform(0.5, 1.5), fill=rng.choice(["#7d9a3a", "#6a8a30", "#9ab44a"]), opacity=0.8)
        if rng.random() < 0.6:  # lily pad
            lx, ly, lr = cx + rng.uniform(-rx * 0.3, rx * 0.3), cy + rng.uniform(-ry * 0.3, ry * 0.3), rng.uniform(2.5, 4)
            a0 = rng.uniform(0, 6.28)
            d = f"M{f(lx)} {f(ly)}L{f(lx + math.cos(a0) * lr)} {f(ly + math.sin(a0) * lr)}A{f(lr)} {f(lr)} 0 1 1 {f(lx + math.cos(a0 + 0.5) * lr)} {f(ly + math.sin(a0 + 0.5) * lr)}Z"
            t.path(d, (lx - lr, ly - lr, lx + lr, ly + lr), fill="#4f7a2c", stroke="#2f4d1a", stroke_width=0.4)
        for _ in range(rng.randint(1, 3)):  # bubbles
            bx, by = cx + rng.gauss(0, rx * 0.3), cy + rng.gauss(0, ry * 0.3)
            t.circle(bx, by, rng.uniform(0.5, 1.1), fill="none", stroke="#d6e2cf", stroke_width=0.3, opacity=0.7)
    # reeds and marsh grass
    for _ in range(7):
        tuft(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(6, 11), ["#5f6f2a", "#768a34", "#4b5a22", "#8a8a40"], 9)
    # rotting sticks
    for _ in range(5):
        pts = random_walk((rng.uniform(0, S), rng.uniform(0, S)), rng, 4, rng.uniform(3, 5), rng.uniform(0, 6.28), 0.3)
        t.line(pts, stroke="#221c10", stroke_width=1.6, stroke_linecap="round", opacity=0.9)
        t.line(pts, stroke="#5a4a2a", stroke_width=0.5, stroke_linecap="round", opacity=0.7)
    for _ in range(14):
        pebble(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(0.8, 2), rng.choice(["#5b5642", "#6a644c"]))
    return t


# ---------------------------------------------------------------- Sewer slabs
def sewer_slabs():
    t = Tex(110)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#1f231d"/>')
    # jittered 2x2 grid (corners shared, periodic)
    J = {(i, j): (rng.uniform(-3, 3), rng.uniform(-3, 3)) for i in range(2) for j in range(2)}

    def corner(i, j):
        dx, dy = J[(i % 2, j % 2)]
        return (i * 100 + dx, j * 100 + dy)

    pal = ["#6d7268", "#646a60", "#737868", "#5f655c"]
    for i in range(2):
        for j in range(2):
            pts = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)]
            p = inset(Polygon(pts), 1.8, 3)
            base = rng.choice(pal)
            stone(t, p, base, bevel=3, rough=1.0, step=7, shadow=0.5, sh_off=(1.4, 1.8), speckle=40, cracks=(1, 3), chips=(2, 4), pits=6)
            # grime streaks & damp stains
            for _ in range(3):
                cx, cy = rand_in(p, rng)
                t.ellipse(cx, cy, rng.uniform(8, 20), rng.uniform(4, 9), rng.uniform(0, 180), fill=rng.choice(["#2c3326", "#4a5a3a", "#3a3a2c"]), opacity=0.22)
    # slime and moss in the joints
    greens = ["#3d5a28", "#4f7030", "#5f8338", "#2e4520", "#6b8a3a"]
    for k in range(2):
        for s0 in range(0, 200, 4):
            if rng.random() < 0.45:
                x = k * 100 + rng.gauss(0, 1.2)
                moss(t, x, s0 + rng.uniform(0, 4), rng.uniform(1.5, 3.5), greens, 4)
            if rng.random() < 0.45:
                y = k * 100 + rng.gauss(0, 1.2)
                moss(t, s0 + rng.uniform(0, 4), y, rng.uniform(1.5, 3.5), greens, 4)
    # puddles
    wg = t.rad([(0, "#4d5a55", 0.85), (0.8, "#1f2724", 0.85), (1, "#151a17", 0.9)], cx=0.45, cy=0.4, r=0.6, gid="swr")
    for _ in range(3):
        cx, cy = rng.uniform(10, 190), rng.uniform(10, 190)
        rx, ry = rng.uniform(8, 16), rng.uniform(5, 10)
        k = 11
        pts = [(cx + math.cos(i / k * 6.283) * rx * rng.uniform(0.7, 1.1), cy + math.sin(i / k * 6.283) * ry * rng.uniform(0.7, 1.1)) for i in range(k)]
        t.poly(pts, smooth=True, fill=f"url(#{wg})")
        t.poly(pts, smooth=True, fill="none", stroke="#a8b8b0", stroke_width=0.4, opacity=0.3)
        t.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.35, 0.9, -8, fill="#dfe9e4", opacity=0.3)
    # rust stain drip
    x = rng.uniform(20, 80)
    t.ellipse(x, 130, 4, 14, 5, fill="#8a4a1f", opacity=0.25)
    t.ellipse(x, 124, 2.5, 7, 5, fill="#a35a25", opacity=0.25)
    grain(t, 180, ["#0e100c", "#9aa092"], 0.25, 0.7, (0.3, 0.6))
    return t


# ---------------------------------------------------------------- Forest floor
def forest_floor():
    t = Tex(111)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#3a2a1a"/>')
    blotches(t, 50, ["#2e2114", "#4a3521", "#433019", "#553d25"], 10, 30, (0.3, 0.6))
    greens = ["#3f5a22", "#4f6e2a", "#5e7f31", "#35501d", "#6f8f3a"]
    for _ in range(9):
        moss(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(6, 13), greens)
    grain(t, 300, ["#1f160c", "#6b5236", "#7d6444"], 0.3, 0.9, (0.3, 0.7))
    # pine needles
    for _ in range(130):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        a = rng.uniform(0, 6.283)
        L = rng.uniform(5, 9)
        c = rng.choice(["#8a5a2a", "#a0703a", "#6e4520", "#b8864a", "#5a3a1a"])
        t.path(f"M{f(x)} {f(y)}l{f(math.cos(a) * L)} {f(math.sin(a) * L)}", (x - L, y - L, x + L, y + L), stroke=c, stroke_width=0.6, stroke_linecap="round")
    # twigs
    for _ in range(8):
        pts = random_walk((rng.uniform(0, S), rng.uniform(0, S)), rng, 4, rng.uniform(3, 6), rng.uniform(0, 6.28), 0.3)
        t.line([(x + 0.6, y + 0.9) for x, y in pts], stroke="#000", stroke_width=1.8, opacity=0.3, stroke_linecap="round")
        t.line(pts, stroke=rng.choice(["#4a3522", "#5c4430"]), stroke_width=1.4, stroke_linecap="round")
        t.line(pts, stroke="#8a6a48", stroke_width=0.35, opacity=0.6, stroke_linecap="round")
        b = random_walk(pts[2], rng, 2, 3, rng.uniform(0, 6.28), 0.2)
        t.line(b, stroke="#4a3522", stroke_width=0.8, stroke_linecap="round")
    # fallen leaves

    leaf_cols = ["#a0522d", "#b86a2c", "#c98a34", "#8a6b2a", "#6b7a2a", "#7a3f1f", "#9a7a30", "#5e6b25"]
    for _ in range(55):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        L = rng.uniform(8, 15)
        W = L * rng.uniform(0.35, 0.55)
        a = rng.uniform(0, 360)
        c = rng.choice(leaf_cols)
        d = f"M{f(-L / 2)} 0Q{f(-L * 0.1)} {f(-W)} {f(L / 2)} 0Q{f(-L * 0.1)} {f(W)} {f(-L / 2)} 0Z"
        tr = f'transform="translate({f(x)} {f(y)}) rotate({f(a)})"'
        el = (f'<g {tr}><path d="{d}" fill="#000" opacity="0.3" transform="translate(0.6 0.8)"/>'
              f'<path d="{d}" fill="{c}"/><path d="{d}" fill="url(#shadeTL)"/>'
              f'<path d="M{f(-L / 2 - 1.2)} 0L{f(L / 2 - 0.5)} 0" stroke="{shade(c, -0.15)}" stroke-width="0.5"/>'
              f'<path d="M{f(-L * 0.1)} 0l{f(L * 0.15)} {f(-W * 0.5)}M{f(L * 0.1)} 0l{f(L * 0.15)} {f(W * 0.5)}" stroke="{shade(c, -0.12)}" stroke-width="0.35"/></g>')
        t.add(el, (x - L, y - L, x + L, y + L))
    for _ in range(6):
        tuft(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(5, 8), ["#4f6e2a", "#6f8f3a", "#3f5a22"], 7)
    for _ in range(8):
        pebble(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(1, 2.5), rng.choice(["#7a7466", "#8a8272"]))
    return t


# ---------------------------------------------------------------- Ruined, overgrown flagstones
def ruined_stone():
    t = Tex(112)
    std_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#4e3e2b"/>')
    blotches(t, 40, ["#3f3222", "#5e4a33", "#6b5638"], 6, 18, (0.3, 0.6))
    grain(t, 300, ["#2a2016", "#7a6448", "#8f7a58"], 0.3, 0.9, (0.3, 0.7))
    q = 50
    pal = ["#8f8d85", "#85837b", "#9a978d", "#7e7c75", "#949187"]
    greens = ["#3f5a22", "#4f6e2a", "#5e7f31", "#6f8f3a"]
    for i in range(4):
        for j in range(4):
            x0, y0 = i * q, j * q
            if rng.random() < 0.12:  # missing slab: rubble + weeds
                for _ in range(6):
                    pebble(t, x0 + rng.uniform(5, 45), y0 + rng.uniform(5, 45), rng.uniform(1.5, 4), rng.choice(pal))
                for _ in range(3):
                    tuft(t, x0 + rng.uniform(8, 42), y0 + rng.uniform(8, 42), rng.uniform(6, 9), greens, 8)
                continue
            slab = Polygon([(x0 + 2 + rng.uniform(-1, 1), y0 + 2 + rng.uniform(-1, 1)), (x0 + q - 2 + rng.uniform(-1, 1), y0 + 2 + rng.uniform(-1, 1)),
                            (x0 + q - 2 + rng.uniform(-1, 1), y0 + q - 2 + rng.uniform(-1, 1)), (x0 + 2 + rng.uniform(-1, 1), y0 + q - 2 + rng.uniform(-1, 1))])
            slab = affinity.rotate(slab, rng.uniform(-3, 3))
            pieces = [slab]
            if rng.random() < 0.45:  # broken slab
                cx, cy = slab.centroid.x, slab.centroid.y
                a = rng.uniform(0, 3.14)
                pts = random_walk((cx - math.cos(a) * 40, cy - math.sin(a) * 40), rng, 8, 10, a, 0.25)
                dif = slab.difference(LineString(pts).buffer(1.2))
                if dif.geom_type == "MultiPolygon":
                    pieces = [g for g in dif.geoms if g.area > 30]
            base = rng.choice(pal)
            for pc in pieces:
                pc = inset(pc, 0, 1.5)
                stone(t, pc, shade(base, rng.uniform(-0.02, 0.02)), bevel=2.4, rough=1.0, step=6, shadow=0.45, speckle=18,
                      cracks=(0, 2), chips=(1, 3), pits=3)
            # lichen
            for _ in range(rng.randint(0, 2)):
                cx, cy = rand_in(slab, rng)
                t.circle(cx, cy, rng.uniform(1.5, 3.5), fill=rng.choice(["#a8a86a", "#c2b87a", "#8f9a5a"]), opacity=0.5)
    # grass & moss creeping through joints
    for k in range(4):
        for s0 in range(0, 200, 6):
            if rng.random() < 0.3:
                tuft(t, k * q + rng.gauss(0, 1.5), s0 + rng.uniform(0, 6), rng.uniform(3, 6), greens, 5)
            if rng.random() < 0.3:
                tuft(t, s0 + rng.uniform(0, 6), k * q + rng.gauss(0, 1.5), rng.uniform(3, 6), greens, 5)
            if rng.random() < 0.15:
                moss(t, k * q + rng.gauss(0, 2), s0, rng.uniform(2, 4), greens, 5)
    return t


def mossy_cave():
    return cave_floor(seed=113, moss_on=True)


PLUS = {
    "f-herringbone": herringbone,
    "f-marble": marble,
    "f-hex-tiles": hex_tiles,
    "f-mosaic": mosaic,
    "f-ruined-stone": ruined_stone,
    "f-sewer-slabs": sewer_slabs,
    "f-mossy-cave": mossy_cave,
    "f-crystal-cave": crystal_cave,
    "f-cracked-earth": cracked_earth,
    "f-swamp-mud": swamp_mud,
    "f-forest-floor": forest_floor,
    "f-parquet": parquet,
    "f-ice": ice,
}
