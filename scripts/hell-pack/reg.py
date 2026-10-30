"""Asset registry: every drawing function registers itself with its library metadata."""

ASSETS = []
PATTERNS = []


def asset(aid, category, cells, en, pl, **meta):
    def deco(fn):
        ASSETS.append(dict(id=aid, category=category, cells=cells, name={"en": en, "pl": pl}, meta=meta, fn=fn))
        return fn
    return deco


def pattern(pid, en, pl):
    def deco(fn):
        PATTERNS.append(dict(id=pid, name={"en": en, "pl": pl}, fn=fn))
        return fn
    return deco
