"""Hell ground textures for assets/hell/patterns/ (200x200, seamless, 1 tile = 1 grid cell at texture scale 1)."""
from lib import *
from shapely.geometry import box as _box


def _glow_defs(t):
    t.rad([(0, "#ffb02a", 0.9), (0.35, "#ff6a12", 0.45), (1, "#d8340a", 0)], gid="ember")
    t.rad([(0, "#000", 0.55), (0.6, "#000", 0.25), (1, "#000", 0)], gid="soot")
    t.rad([(0, "#ff6a12", 0.35), (1, "#d8340a", 0)], gid="heat")


def embers(t, n, rmin=0.4, rmax=1.1, glow_p=0.35):
    rng = t.rng
    for _ in range(n):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        r = rng.uniform(rmin, rmax)
        if rng.random() < glow_p:
            t.circle(x, y, r * 4, fill="url(#ember)", opacity=0.6)
        t.circle(x, y, r, fill=rng.choice(["#ffcf5a", "#ff8a2a", "#ff5a14"]))


def soot(t, n, rmin, rmax, op=(0.35, 0.8)):
    rng = t.rng
    for _ in range(n):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        r = rng.uniform(rmin, rmax)
        t.ellipse(x, y, r, r * rng.uniform(0.5, 1), rng.uniform(0, 180), fill="url(#soot)", opacity=round(rng.uniform(*op), 2))


def charcoal(t, x, y, L, ang):
    """A small burnt twig / charcoal stick."""
    rng = t.rng
    pts = random_walk((x, y), rng, 3, L / 3, ang, 0.35)
    t.line([(px + 0.5, py + 0.7) for px, py in pts], stroke="#000", stroke_width=1.8, opacity=0.4, stroke_linecap="round")
    t.line(pts, stroke="#151110", stroke_width=1.5, stroke_linecap="round")
    t.line([(px - 0.3, py - 0.3) for px, py in pts], stroke="#4a4644", stroke_width=0.4, opacity=0.7, stroke_linecap="round")
    if rng.random() < 0.4:
        px, py = pts[-1]
        t.circle(px, py, 0.8, fill="#ff7a1a")


def burnt_tuft(t, x, y, size):
    rng = t.rng
    t.ellipse(x + 0.8, y + 0.6, size * 0.45, size * 0.25, 0, fill="#0a0806", opacity=0.45)
    tuft(t, x, y, size, ["#0e0b09", "#1a1512", "#241c16", "#2e241c"], blades=rng.randint(6, 10))
    if rng.random() < 0.12:
        t.circle(x + rng.uniform(-1, 1), y - size * 0.6, 0.6, fill="#ff8a2a")


# ---------------------------------------------------------------- Scorched earth
def scorched_earth():
    t = Tex(301)
    std_defs(t)
    _glow_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#1c1410"/>')
    blotches(t, 50, ["#2a1d15", "#33241a", "#20160f", "#3a2a1e"], 14, 34, (0.4, 0.8))
    _, cells = periodic_voronoi(26, rng, relax=0)
    pal = ["#3a2a1f", "#41301f", "#35261a", "#463222", "#2f2219"]
    noise = PNoise(rng, 6, 3)
    for c in cells:
        pc = inset(c, rng.uniform(0.6, 1.2), 0.6)
        if pc.is_empty or pc.area < 20:
            continue
        base = shade(rng.choice(pal), 0.05 * noise(c.centroid.x, c.centroid.y) + rng.uniform(-0.02, 0.02))
        stone(t, pc, base, bevel=0.9, rough=1.6, step=4, shadow=0.5, sh_off=(0.7, 0.9), speckle=8, cracks=(1, 3), chips=(0, 1),
              dark=shade(base, -0.05), light=shade(base, 0.03), pits=2)
    for c in cells:
        t.poly(jitter_ring(ring(c), rng, 5, 1.0), fill="none", stroke="#0a0604", stroke_width=1.1, opacity=0.85, stroke_linejoin="round")
    # charred soot and grey ash lying over the cracked crust
    blotches(t, 26, ["#0e0a08", "#16100c"], 10, 26, (0.3, 0.6))
    blotches(t, 14, ["#6a625a", "#5a524a", "#7a726a"], 6, 16, (0.15, 0.35))
    # heat cracks: some joints still glowing deep down
    for c in rng.sample(cells, 6):
        pts = ring(c)
        i = rng.randrange(len(pts))
        seg = [pts[i], pts[(i + 1) % len(pts)]]
        t.line(seg, smooth=False, stroke="#ff5a14", stroke_width=1.6, opacity=0.35, stroke_linecap="round")
        t.line(seg, smooth=False, stroke="#ffb02a", stroke_width=0.5, opacity=0.8, stroke_linecap="round")
    soot(t, 10, 10, 26)
    for _ in range(10):
        charcoal(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(5, 12), rng.uniform(0, 6.28))
    grain(t, 260, ["#0f0b09", "#5a4636", "#8a8078", "#6a6058"], 0.25, 0.75, (0.3, 0.7))
    embers(t, 14, glow_p=0.3)
    return t


# ---------------------------------------------------------------- Burned ground (burnt grass field)
def burned_ground():
    t = Tex(302)
    std_defs(t)
    _glow_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#5a5048"/>')
    noise = PNoise(rng, 7, 3)
    # ash-grey and charred brown patches over soil
    blotches(t, 50, ["#6a6058", "#4a3e34", "#7a726a", "#54463a", "#867e76"], 12, 30, (0.35, 0.7))
    soot(t, 14, 14, 34, (0.5, 0.9))
    # stubble: blackened grass tufts, denser where the noise is high
    for _ in range(230):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        if noise(x, y) > -0.35:
            burnt_tuft(t, x, y, rng.uniform(4.5, 9))
    # a few surviving dry, singed blades
    for _ in range(18):
        tuft(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(3, 5), ["#6a5530", "#7a6236", "#4a3a20"], 4)
    for _ in range(14):
        pebble(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(1, 2.6), rng.choice(["#4a4440", "#5a5450", "#2e2a28"]))
    for _ in range(12):
        charcoal(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(4, 10), rng.uniform(0, 6.28))
    # white ash flecks
    grain(t, 320, ["#9a948c", "#c8c2b8", "#1a1612", "#6a625a"], 0.25, 0.8, (0.3, 0.7))
    embers(t, 22, 0.4, 1.0, glow_p=0.4)
    return t


# ---------------------------------------------------------------- Ash field
def ash_field():
    t = Tex(303)
    std_defs(t)
    _glow_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#6e6862"/>')
    soot(t, 10, 16, 34, (0.25, 0.45))
    # soft drifts: light crests with a shadow on the lower-right
    for _ in range(26):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        r = rng.uniform(14, 34)
        k = 10
        pts = [(x + math.cos(i / k * 6.283) * r * rng.uniform(0.7, 1.2), y + math.sin(i / k * 6.283) * r * 0.55 * rng.uniform(0.7, 1.2))
               for i in range(k)]
        t.poly([(px + 2.6, py + 3.2) for px, py in pts], smooth=True, fill="#3e3832", opacity=0.45)
        t.poly(pts, smooth=True, fill=rng.choice(["#8a847e", "#948e88", "#86807a"]), opacity=0.85)
        t.poly([(x + (px - x) * 0.55 - 2, y + (py - y) * 0.45 - 2) for px, py in pts], smooth=True, fill="#a8a29c", opacity=0.45)
    blotches(t, 30, ["#5e5852", "#9e9892", "#6a645e"], 8, 22, (0.15, 0.35))
    # ripples blown into the ash
    for _ in range(40):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        L = rng.uniform(8, 18)
        t.line([(x, y), (x + L * 0.5, y - 1.5), (x + L, y)], stroke="#5a544e", stroke_width=0.6, opacity=0.5)
        t.line([(x, y - 0.8), (x + L * 0.5, y - 2.3), (x + L, y - 0.8)], stroke="#b8b2ac", stroke_width=0.5, opacity=0.5)
    for _ in range(24):
        charcoal(t, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(4, 10), rng.uniform(0, 6.28))
    # bone fragments
    for _ in range(6):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        a = rng.uniform(0, 6.28)
        L = rng.uniform(4, 8)
        p0, p1 = (x, y), (x + math.cos(a) * L, y + math.sin(a) * L)
        t.line([(p0[0] + 0.6, p0[1] + 0.8), (p1[0] + 0.6, p1[1] + 0.8)], smooth=False, stroke="#3a3632", stroke_width=1.6, opacity=0.5,
               stroke_linecap="round")
        t.line([p0, p1], smooth=False, stroke="#d8d0bc", stroke_width=1.3, stroke_linecap="round")
    grain(t, 340, ["#3a3632", "#c8c2bc", "#e0dad4", "#5a544e"], 0.25, 0.7, (0.3, 0.7))
    embers(t, 8, 0.4, 0.9, glow_p=0.5)
    return t


# ---------------------------------------------------------------- Lava-cracked basalt
def lava_cracks():
    t = Tex(304)
    std_defs(t)
    _glow_defs(t)
    rng = t.rng
    # molten base with brighter streams
    t.raw('<rect width="200" height="200" fill="#e0420c"/>')
    blotches(t, 30, ["#ff8a1a", "#ffb02a", "#c42a06", "#ff6a12"], 10, 30, (0.4, 0.8))
    _, cells = periodic_voronoi(16, rng, relax=2)
    pal = ["#2a2426", "#252022", "#302a2c", "#221d1f", "#2e2628"]
    for c in cells:
        # hot halo around each plate
        halo = inset(c, 1.0, 2)
        if not halo.is_empty:
            t.poly(jitter_ring(ring(halo), rng, 6, 1.2), smooth=True, fill="#ffd25a", opacity=0.5)
        pc = inset(c, rng.uniform(2.8, 4.2), 3)
        if pc.is_empty or pc.area < 30:
            continue
        base = shade(rng.choice(pal), rng.uniform(-0.02, 0.03))
        stone(t, pc, base, bevel=2.4, rough=1.5, step=5, shadow=0.0, speckle=10, cracks=(1, 2), chips=(0, 2),
              dark=shade(base, -0.06), light=shade(base, 0.1), smooth=True, pits=3)
        # red heat seeping into the plate rim (bottom-right of each plate glows more)
        rim = jitter_ring(ring(inset(c, 2.6, 3)), rng, 6, 1.0) if not inset(c, 2.6, 3).is_empty else []
        if rim:
            t.poly(rim, smooth=True, fill="none", stroke="#ff5a14", stroke_width=1.4, opacity=0.55)
        # a hairline glowing crack across some plates
        if rng.random() < 0.45:
            x, y = rand_in(pc, rng)
            pts = random_walk((x, y), rng, 5, rng.uniform(3, 5), rng.uniform(0, 6.28), 0.5)
            ls = LineString(pts).intersection(pc.buffer(-1.5))
            if not ls.is_empty and ls.geom_type == "LineString":
                cc = list(ls.coords)
                t.line(cc, smooth=False, stroke="#ff6a12", stroke_width=1.6, opacity=0.6, stroke_linecap="round")
                t.line(cc, smooth=False, stroke="#ffd25a", stroke_width=0.6, stroke_linecap="round")
    # bright cores where three plates meet
    for c in cells:
        for (x, y) in ring(c, tol=2)[::2]:
            if rng.random() < 0.25:
                t.circle(x, y, rng.uniform(2, 3.5), fill="#fff3b0", opacity=0.75)
    grain(t, 120, ["#0a0808", "#5a4a50"], 0.25, 0.6, (0.3, 0.6))
    return t


# ---------------------------------------------------------------- Brimstone rock
def brimstone():
    t = Tex(305)
    std_defs(t)
    _glow_defs(t)
    rng = t.rng
    t.raw('<rect width="200" height="200" fill="#2a120c"/>')
    grain(t, 200, ["#140806", "#5a2a1a"], 0.3, 1.0)
    _, cells = periodic_voronoi(14, rng, relax=1)
    pal = ["#6a2c1c", "#5a2418", "#73331f", "#62281a", "#7a3a22", "#4e2016"]
    noise = PNoise(rng, 6, 3)
    for c in cells:
        pc = inset(c, rng.uniform(1.8, 4), 4)
        if pc.is_empty or pc.area < 30:
            continue
        base = shade(rng.choice(pal), 0.05 * noise(c.centroid.x, c.centroid.y))
        stone(t, pc, base, bevel=3.2, rough=2.0, step=5, shadow=0.55, sh_off=(1.6, 2.2), speckle=14, cracks=(1, 2), chips=(1, 2),
              smooth=True, pits=6)
        # sulfur crust deposits on some plates
        for _ in range(rng.randint(0, 2)):
            x, y = rand_in(pc, rng)
            r = rng.uniform(4, 10)
            blobp = Point(x, y).buffer(r, resolution=6)
            blobp = affinity.scale(blobp, rng.uniform(0.6, 1.4), rng.uniform(0.6, 1.2)).intersection(pc.buffer(-1))
            if not blobp.is_empty and blobp.geom_type == "Polygon":
                pts = jitter_ring(ring(blobp), rng, 3, 0.9)
                t.poly([(px + 0.6, py + 0.8) for px, py in pts], smooth=True, fill="#3a2a08", opacity=0.4)
                t.poly(pts, smooth=True, fill=rng.choice(["#d8c23a", "#c8b030", "#e6d45a"]), opacity=0.85)
                for _ in range(4):
                    qx, qy = rand_in(blobp, rng)
                    t.circle(qx, qy, rng.uniform(0.5, 1.2), fill="#fff3a0", opacity=0.8)
    # fumarole pores breathing sulfur haze
    for _ in range(4):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        t.circle(x, y, 9, fill="#e6d45a", opacity=0.12)
        t.circle(x, y, 2.2, fill="#140806")
        t.circle(x, y, 3.2, fill="none", stroke="#d8c23a", stroke_width=1.2, opacity=0.8)
    for c in cells:
        pts = jitter_ring(ring(c), rng, 7, 1.2)
        t.poly(pts, smooth=True, fill="none", stroke="#100604", stroke_width=1.3, opacity=0.8)
    embers(t, 6, glow_p=0.5)
    return t


# ---------------------------------------------------------------- Obsidian tiles
def obsidian_tiles():
    t = Tex(306)
    rng = t.rng
    t.lin([(0, "#8a72a0", 0.45), (0.3, "#8a72a0", 0.0), (0.7, "#000", 0.0), (1, "#000", 0.5)], 0, 0, 1, 1, gid="obsTL")
    t.lin([(0, "#fff", 0), (0.44, "#fff", 0.0), (0.5, "#fff", 0.14), (0.56, "#fff", 0), (1, "#fff", 0)], 0, 0, 1, 1, gid="obsSheen")
    # glowing grout
    t.raw('<rect width="200" height="200" fill="#ff6a12"/>')
    t.raw('<rect width="200" height="200" fill="#d8340a" opacity="0.5"/>')
    q = 100
    for i in range(2):
        for j in range(2):
            x0, y0 = i * q, j * q
            g = 2.0
            base = shade("#1d1820", rng.uniform(-0.02, 0.03))
            cid = t.gid("c")
            t.defs.append(f'<clipPath id="{cid}"><rect x="{f(x0 + g)}" y="{f(y0 + g)}" width="{f(q - 2 * g)}" height="{f(q - 2 * g)}" rx="0.8"/></clipPath>')
            out = [f'<g clip-path="url(#{cid})">', f'<rect x="{f(x0)}" y="{f(y0)}" width="{q}" height="{q}" fill="{base}"/>']
            # cloudy depth
            for _ in range(10):
                cx, cy = x0 + rng.uniform(0, q), y0 + rng.uniform(0, q)
                r = rng.uniform(10, 28)
                k = 8
                pts = [(cx + math.cos(a / k * 6.283) * r * rng.uniform(0.6, 1.3), cy + math.sin(a / k * 6.283) * r * rng.uniform(0.6, 1.3))
                       for a in range(k)]
                out.append(f'<path d="{smooth_path(pts)}" fill="{rng.choice(["#2a2230", "#120e14", "#33283c"])}" opacity="{rng.uniform(0.3, 0.6):.2f}"/>')
            # thin red veins
            for _ in range(rng.randint(2, 3)):
                pts = random_walk((x0 + rng.uniform(0, q), y0 + rng.uniform(0, q)), rng, 12, rng.uniform(5, 9), rng.uniform(0, 6.28), 0.45)
                out.append(f'<path d="{smooth_path(pts, close=False)}" fill="none" stroke="#c42a10" stroke-width="0.6" opacity="0.7"/>')
            out.append(f'<rect x="{f(x0)}" y="{f(y0)}" width="{q}" height="{q}" fill="url(#obsTL)"/>')
            out.append(f'<rect x="{f(x0)}" y="{f(y0)}" width="{q}" height="{q}" fill="url(#obsSheen)"/>')
            # chipped corner on some tiles
            if rng.random() < 0.3:
                cx, cy = x0 + rng.choice([g, q - g]), y0 + rng.choice([g, q - g])
                r = rng.uniform(2.5, 5)
                out.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="#0c0a0e"/>')
            out.append("</g>")
            t.raw("".join(out))
            t.raw(f'<path d="M{f(x0 + g + 0.5)} {f(y0 + q - g - 0.6)}V{f(y0 + g + 0.5)}H{f(x0 + q - g - 0.6)}" fill="none" stroke="#c8b8d8" '
                  f'stroke-width="0.5" opacity="0.4"/>')
    # dark grout edges so the glow sits in a groove
    for k in range(3):
        t.raw(f'<rect x="{f(k * q - 0.4)}" y="0" width="0.8" height="200" fill="#5a0d02" opacity="0.6"/>')
        t.raw(f'<rect x="0" y="{f(k * q - 0.4)}" width="200" height="0.8" fill="#5a0d02" opacity="0.6"/>')
    return t


# ---------------------------------------------------------------- Riveted iron floor
def iron_plates():
    t = Tex(307)
    rng = t.rng
    t.lin([(0, "#fff", 0.16), (0.5, "#fff", 0.0), (1, "#000", 0.35)], 0, 0, 0.4, 1, gid="ironTL")
    t.raw('<rect width="200" height="200" fill="#121215"/>')
    q = 100
    # diamond tread pattern as one <pattern> (period 10)
    t.defs.append('<pattern id="tread" patternUnits="userSpaceOnUse" width="10" height="10">'
                  '<path d="M1.5 3.5l3 -2.2M6.5 8.5l3 -2.2" stroke="#000" stroke-opacity="0.55" stroke-width="1.6" stroke-linecap="round"/>'
                  '<path d="M1.5 3l3 -2.2M6.5 8l3 -2.2" stroke="#8d8f9a" stroke-opacity="0.45" stroke-width="1" stroke-linecap="round"/>'
                  '<path d="M6.5 1.3l3 2.2M1.5 6.3l3 2.2" stroke="#000" stroke-opacity="0.55" stroke-width="1.6" stroke-linecap="round"/>'
                  '<path d="M6.5 0.8l3 2.2M1.5 5.8l3 2.2" stroke="#8d8f9a" stroke-opacity="0.45" stroke-width="1" stroke-linecap="round"/>'
                  '</pattern>')
    for i in range(2):
        for j in range(2):
            x0, y0 = i * q + 1, j * q + 1
            w = q - 2
            base = shade("#3b3b42", rng.uniform(-0.03, 0.03))
            t.raw(f'<rect x="{f(x0)}" y="{f(y0)}" width="{f(w)}" height="{f(w)}" rx="1.5" fill="{base}"/>')
            t.raw(f'<rect x="{f(x0 + 7)}" y="{f(y0 + 7)}" width="{f(w - 14)}" height="{f(w - 14)}" fill="url(#tread)"/>')
            t.raw(f'<rect x="{f(x0)}" y="{f(y0)}" width="{f(w)}" height="{f(w)}" rx="1.5" fill="url(#ironTL)"/>')
            # rust blooms + soot, clipped by staying inside the plate
            for _ in range(rng.randint(2, 4)):
                cx, cy = x0 + rng.uniform(12, w - 12), y0 + rng.uniform(12, w - 12)
                r = rng.uniform(5, 12)
                k = 9
                pts = [(cx + math.cos(a / k * 6.283) * r * rng.uniform(0.5, 1.2), cy + math.sin(a / k * 6.283) * r * rng.uniform(0.5, 1.2))
                       for a in range(k)]
                t.raw(f'<path d="{smooth_path(pts)}" fill="{rng.choice(["#7a3b1e", "#5a2a14", "#8a4a22"])}" opacity="{rng.uniform(0.25, 0.5):.2f}"/>')
            for _ in range(5):
                sx, sy = x0 + rng.uniform(8, w - 20), y0 + rng.uniform(8, w - 8)
                t.raw(f'<path d="M{f(sx)} {f(sy)}l{f(rng.uniform(5, 14))} {f(rng.uniform(-3, 3))}" stroke="#a8aab4" stroke-width="0.4" opacity="0.4"/>')
            # rivets along the plate edge
            for k in range(9):
                for (rx, ry) in ((x0 + 3.6 + k * (w - 7.2) / 8, y0 + 3.6), (x0 + 3.6 + k * (w - 7.2) / 8, y0 + w - 3.6),
                                 (x0 + 3.6, y0 + 3.6 + k * (w - 7.2) / 8), (x0 + w - 3.6, y0 + 3.6 + k * (w - 7.2) / 8)):
                    t.raw(f'<circle cx="{f(rx + 0.5)}" cy="{f(ry + 0.6)}" r="1.4" fill="#000" opacity="0.5"/>'
                          f'<circle cx="{f(rx)}" cy="{f(ry)}" r="1.4" fill="#45454d" stroke="#1c1c21" stroke-width="0.4"/>'
                          f'<circle cx="{f(rx - 0.45)}" cy="{f(ry - 0.45)}" r="0.55" fill="#fff" opacity="0.4"/>')
            t.raw(f'<path d="M{f(x0 + 0.5)} {f(y0 + w - 0.5)}V{f(y0 + 0.5)}H{f(x0 + w - 0.5)}" fill="none" stroke="#9a9ca8" stroke-width="0.7" opacity="0.5"/>')
    # a little heat glow seeping from one seam
    t.raw('<rect x="99" y="20" width="2" height="60" fill="#ff6a12" opacity="0.55"/>')
    t.raw('<rect x="99.6" y="26" width="0.8" height="48" fill="#ffd25a"/>')
    return t


HELL = {
    "h-scorched-earth": scorched_earth,
    "h-burned-ground": burned_ground,
    "h-ash-field": ash_field,
    "h-lava-cracks": lava_cracks,
    "h-brimstone": brimstone,
    "h-obsidian-tiles": obsidian_tiles,
    "h-iron-plates": iron_plates,
}
