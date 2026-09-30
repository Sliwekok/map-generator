import os, sys, re, json
sys.path.insert(0, os.path.dirname(__file__))
from free import FREE
try:
    from plus import PLUS
except ImportError:
    PLUS = {}

OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
FORBIDDEN = [r"<!ENTITY|<!DOCTYPE", r"<(script|foreignObject|iframe|embed|object|audio|video|handler|listener|animate|set)\b",
             r"\son[a-z]+\s*=", r"javascript:|vbscript:", r"@import|expression\s*\(", r"url\(\s*(?!['\"]?#)", r"<style\b"]

only = sys.argv[1:]
sets = {"floors": FREE, "floors-plus": PLUS}
for grp, d in sets.items():
    os.makedirs(f"{OUT}/{grp}/patterns", exist_ok=True)
    for pid, fn in d.items():
        if only and pid not in only:
            continue
        svg = fn().svg()
        for r in FORBIDDEN:
            assert not re.search(r, svg, re.I), (pid, r)
        assert len(svg) < 256 * 1024, (pid, len(svg))
        open(f"{OUT}/{grp}/patterns/{pid}.svg", "w").write(svg)
        print(f"{grp}/{pid}: {len(svg)//1024} KB, {svg.count('<')} tags")
