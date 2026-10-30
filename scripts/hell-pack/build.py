"""Builds assets/hell/ (SVGs + group.json) and a preview contact sheet.

usage: python scripts/hell-pack/build.py [id-substring ...]
  Writes assets/hell/ (all items) and a contact sheet to <temp>/hell-pack-preview/sheet.html
  (optional id filters only limit what the sheet shows).
  The ground textures in assets/hell/patterns/ come from tools/texture-generator (python build.py hell);
  their names are listed in TEXTURES below so group.json describes them.
"""
import json
import os
import sys
import tempfile
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib  # noqa: E402

from reg import ASSETS  # noqa: E402

# HELL_MODULES=furniture,terrain builds only some modules (handy while drawing; group.json is then partial)
for _m in os.environ.get("HELL_MODULES", "structures,furniture,terrain").split(","):
    importlib.import_module(_m.strip())

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.environ.get("HELL_OUT", os.path.join(REPO, "assets", "hell"))
PREV = os.environ.get("HELL_PREVIEW", os.path.join(tempfile.gettempdir(), "hell-pack-preview"))

# Ground textures (drawn by tools/texture-generator/hell.py, 200x200, 1 tile = 1 cell at scale 1)
TEXTURES = {
    "h-scorched-earth": {"en": "Scorched earth", "pl": "Spalona ziemia"},
    "h-burned-ground": {"en": "Burned ground", "pl": "Wypalony grunt"},
    "h-ash-field": {"en": "Ash field", "pl": "Pole popiołu"},
    "h-lava-cracks": {"en": "Lava-cracked basalt", "pl": "Bazalt z lawą"},
    "h-brimstone": {"en": "Brimstone rock", "pl": "Skała siarkowa"},
    "h-obsidian-tiles": {"en": "Obsidian tiles", "pl": "Płyty z obsydianu"},
    "h-iron-plates": {"en": "Riveted iron floor", "pl": "Podłoga z nitowanej stali"},
}

only = sys.argv[1:]
FORBIDDEN = [r"<!ENTITY|<!DOCTYPE", r"<(script|foreignObject|iframe|embed|object|audio|video|handler|listener|animate|set)\b",
             r"\son[a-z]+\s*=", r"javascript:|vbscript:", r"@import|expression\s*\(", r"url\(\s*(?!['\"]?#)", r"<style\b", r"<filter\b"]


def seed_of(i):
    return zlib.crc32(i.encode())


def write(p, text):
    # always UTF-8 + LF: on Windows open() would otherwise use the ANSI code page (cp1250) and break Polish names
    with open(p, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def main():
    import re
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PREV, exist_ok=True)
    ids = [a["id"] for a in ASSETS]
    dup = {i for i in ids if ids.count(i) > 1}
    assert not dup, f"duplicate ids: {dup}"
    manifest = {}
    rows, sizes = [], []
    for a in ASSETS:
        svg = a["fn"](seed_of(a["id"]))
        for r in FORBIDDEN:
            assert not re.search(r, svg, re.I), (a["id"], r)
        assert len(svg.encode()) < 240 * 1024, (a["id"], len(svg))
        d = os.path.join(OUT, a["category"])
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, a["id"] + ".svg")
        write(p, svg)
        sizes.append((a["id"], len(svg)))
        m = {"name": a["name"]}
        if list(a["cells"]) != [1, 1]:
            m["cells"] = list(a["cells"])
        m.update(a["meta"])
        manifest[a["id"]] = m
        tint = a["meta"].get("defaultTint")
        if tint and "currentColor" in svg:
            pp = os.path.join(PREV, "tinted", a["id"] + ".svg")
            os.makedirs(os.path.dirname(pp), exist_ok=True)
            write(pp, svg.replace("currentColor", tint))
            rows.append((a, pp))
        else:
            rows.append((a, p))

    group = {
        "name": {"en": "Hell", "pl": "Piekło"},
        "description": {
            "en": "Infernal kit: obsidian and iron walls, gates, a hellish keep, iron furniture, chandeliers, lava, bones and scorched ground",
            "pl": "Piekielny zestaw: mury z obsydianu i żelaza, bramy, piekielna twierdza, żelazne meble, żyrandole, lawa, kości i spalona ziemia",
        },
        "access": "user",
        "order": 35,
    }
    J = lambda v: json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    lines = ["{"]
    for k in ("name", "description", "access", "order"):
        lines.append(f'  "{k}": {J(group[k])},')
    lines.append('  "assets": {')
    items = list(manifest.items())
    for i, (k, v) in enumerate(items):
        lines.append(f'    "{k}": {J(v)}' + ("," if i < len(items) - 1 else ""))
    lines.append("  },")
    lines.append('  "patterns": {')
    tex = list(TEXTURES.items())
    for i, (k, v) in enumerate(tex):
        lines.append(f'    "{k}": {J({"name": v})}' + ("," if i < len(tex) - 1 else ""))
    lines.append("  }")
    lines.append("}")
    write(os.path.join(OUT, "group.json"), "\n".join(lines) + "\n")

    # contact sheet ------------------------------------------------------------------
    S = int(os.environ.get("HELL_PREVIEW_SCALE", "100"))  # px per cell
    cards = []
    for a, p in rows:
        if only and not any(o in a["id"] for o in only):
            continue
        w, h = a["cells"][0] * S, a["cells"][1] * S
        src = "file://" + os.path.abspath(p).replace("\\", "/")
        cards.append(
            f'<figure><div class="cell" style="width:{w}px;height:{h}px;background-size:{S}px {S}px">'
            f'<img src="{src}" style="width:{w}px;height:{h}px"></div>'
            f'<figcaption>{a["id"]} <small>{a["cells"][0]}×{a["cells"][1]}</small></figcaption></figure>')
    for t in TEXTURES:
        tp = os.path.join(OUT, "patterns", t + ".svg")
        if not os.path.exists(tp) or (only and not any(o in t for o in only)):
            continue
        src = "file://" + os.path.abspath(tp).replace("\\", "/")
        cards.append(f'<figure><div class="tex" style="width:300px;height:300px;background-image:url({src});background-size:{S}px {S}px"></div>'
                     f'<figcaption>{t} <small>texture</small></figcaption></figure>')
    html = ("<!doctype html><meta charset=utf-8><style>body{margin:0;padding:16px;background:#3a3030;font:12px sans-serif;"
            "display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}figure{margin:0}"
            ".cell{background-color:#4a3a34;background-image:linear-gradient(#0003 1px,transparent 1px),"
            "linear-gradient(90deg,#0003 1px,transparent 1px);position:relative}"
            ".cell img{position:absolute;inset:0}figcaption{color:#fff;margin-top:4px}small{opacity:.7}</style>"
            + "".join(cards))
    write(os.path.join(PREV, "sheet.html"), html)

    print("preview:", os.path.join(PREV, "sheet.html"))
    total = sum(n for _, n in sizes)
    for i, n in sorted(sizes, key=lambda x: -x[1])[:8]:
        print(f"  {i:22s} {n / 1024:6.1f} KB")
    print(f"{len(ASSETS)} assets, {len(TEXTURES)} textures listed, total {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
