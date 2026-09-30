"""Builds assets/tavern/ (SVGs + group.json) and a preview contact sheet.

usage: python scripts/tavern-pack/build.py [id-substring ...]
  Writes assets/tavern/ (all items) and a contact sheet to <temp>/tavern-pack-preview/sheet.html
  (optional id filters only limit what the sheet shows).
"""
import json
import os
import sys
import zlib

sys.path.insert(0, os.path.dirname(__file__))
from reg import ASSETS, PATTERNS  # noqa: E402
import buildings  # noqa: F401,E402
import furniture  # noqa: F401,E402
import textures  # noqa: F401,E402

import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.environ.get("TAVERN_OUT", os.path.join(REPO, "assets", "tavern"))
PREV = os.path.join(tempfile.gettempdir(), "tavern-pack-preview")

only = sys.argv[1:]


def seed_of(i):
    return zlib.crc32(i.encode())


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PREV, exist_ok=True)
    manifest_assets = {}
    rows = []
    sizes = []
    for a in ASSETS:
        svg = a["fn"](seed_of(a["id"]))
        d = os.path.join(OUT, a["category"])
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, a["id"] + ".svg")
        with open(p, "w") as fh:
            fh.write(svg)
        sizes.append((a["id"], len(svg)))
        m = {"name": a["name"]}
        if list(a["cells"]) != [1, 1]:
            m["cells"] = list(a["cells"])
        m.update(a["meta"])
        manifest_assets[a["id"]] = m
        # preview copy with the default tint baked in (an <img> can't set `color`)
        tint = a["meta"].get("defaultTint")
        if tint and "currentColor" in svg:
            pp = os.path.join(PREV, "tinted", a["id"] + ".svg")
            os.makedirs(os.path.dirname(pp), exist_ok=True)
            with open(pp, "w") as fh:
                fh.write(svg.replace("currentColor", tint))
            rows.append((a, os.path.relpath(pp, PREV)))
        else:
            rows.append((a, os.path.relpath(p, PREV)))
    manifest_patterns = {}
    prows = []
    for t in PATTERNS:
        svg = t["fn"](seed_of(t["id"]))
        d = os.path.join(OUT, "patterns")
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, t["id"] + ".svg")
        with open(p, "w") as fh:
            fh.write(svg)
        sizes.append((t["id"], len(svg)))
        manifest_patterns[t["id"]] = {"name": t["name"]}
        prows.append((t, os.path.relpath(p, PREV)))

    group = {
        "name": {"en": "Tavern & Houses", "pl": "Karczma i domy"},
        "description": {
            "en": "Detailed cottages, townhouse and tavern roofs, wall pieces, a full tavern interior and floor textures",
            "pl": "Szczegółowe chaty, kamienica i dach karczmy, elementy ścian, pełne wnętrze karczmy i tekstury podłóg",
        },
        "access": "user",
        "order": 30,
        "assets": manifest_assets,
        "patterns": manifest_patterns,
    }
    order = ["t-tavern", "t-cottage", "t-townhouse", "t-wall-timber", "t-wall-stone", "t-post", "t-door", "t-door-double", "t-door-open",
             "t-window", "t-stairs", "t-fireplace", "t-trough",
             "t-bar-counter", "t-back-shelf", "t-keg-rack", "t-barrel", "t-table-long", "t-table-round", "t-bench", "t-chair", "t-stool",
             "t-chandelier", "t-bearskin-rug", "t-rug-braided", "t-bed-single", "t-bed-double", "t-washstand", "t-bathtub", "t-desk",
             "t-prep-table", "t-cauldron", "t-crates", "t-sacks", "t-woodpile", "t-tankards", "t-meal", "t-candle",
             "t-hay-bales", "t-chopping-block", "t-tavern-sign"]
    missing = [k for k in manifest_assets if k not in order]
    assert not missing, missing
    group["assets"] = {k: manifest_assets[k] for k in order}
    # same compact style as the other group.json files: one line per item
    J = lambda v: json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    lines = ["{"]
    for k in ("name", "description", "access", "order"):
        lines.append(f'  "{k}": {json.dumps(group[k], ensure_ascii=False, separators=(", ", ": "))},')
    lines.append('  "assets": {')
    items = list(group["assets"].items())
    for i, (k, v) in enumerate(items):
        lines.append(f'    "{k}": {J(v)}' + ("," if i < len(items) - 1 else ""))
    lines.append("  },")
    lines.append('  "patterns": {')
    pitems = list(group["patterns"].items())
    for i, (k, v) in enumerate(pitems):
        lines.append(f'    "{k}": {J(v)}' + ("," if i < len(pitems) - 1 else ""))
    lines.append("  }")
    lines.append("}")
    with open(os.path.join(OUT, "group.json"), "w") as fh:
        fh.write("\n".join(lines) + "\n")

    # contact sheet ------------------------------------------------------------------
    S = 100  # px per cell in the preview
    cards = []
    for a, rel in rows:
        if only and not any(o in a["id"] for o in only):
            continue
        w, h = a["cells"][0] * S, a["cells"][1] * S
        cards.append(
            f'<figure><div class="cell" style="width:{w}px;height:{h}px;background-size:{S}px {S}px">'
            f'<img src="{rel}" style="width:{w}px;height:{h}px"></div>'
            f'<figcaption>{a["id"]} <small>{a["cells"][0]}×{a["cells"][1]}</small></figcaption></figure>')
    for t, rel in prows:
        if only and not any(o in t["id"] for o in only):
            continue
        cards.append(
            f'<figure><div class="tex" style="width:300px;height:300px;background-image:url({rel});background-size:{S}px {S}px"></div>'
            f'<figcaption>{t["id"]} <small>texture</small></figcaption></figure>')
    html = ("<!doctype html><meta charset=utf-8><style>body{margin:0;padding:16px;background:#8b8577;font:12px sans-serif;"
            "display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}figure{margin:0}"
            ".cell{background-color:#c9b48f;background-image:linear-gradient(#0002 1px,transparent 1px),"
            "linear-gradient(90deg,#0002 1px,transparent 1px);position:relative}"
            ".cell img{position:absolute;inset:0}figcaption{color:#fff;margin-top:4px}small{opacity:.7}</style>"
            + "".join(cards))
    with open(os.path.join(PREV, "sheet.html"), "w") as fh:
        fh.write(html)

    print("preview:", os.path.join(PREV, "sheet.html"))
    total = sum(n for _, n in sizes)
    for i, n in sorted(sizes, key=lambda x: -x[1])[:8]:
        print(f"  {i:22s} {n / 1024:6.1f} KB")
    print(f"{len(ASSETS)} assets, {len(PATTERNS)} textures, total {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
