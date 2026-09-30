# Tavern & Houses pack generator

Source of `assets/tavern/`. Every SVG there is drawn by these scripts (Python 3, standard library only),
so colours, sizes and details can be changed here and regenerated instead of edited by hand.

```
python scripts/tavern-pack/build.py
npm run assets:check
```

- `buildings.py` - roofs (tavern, cottage, townhouse), wall pieces, doors, window, stairs, fireplace, sign, yard props
- `furniture.py` - bar, tables, seating, beds, kitchen, storage, lighting, rugs and table props
- `textures.py` - seamless floor textures (planks, flagstone, rushes, parquet)
- `lib.py` - shared helpers (wood grain, shadows, gradients; repeated paths are stored once and drawn with `<use>`)

Conventions: 100 viewBox units per grid cell (viewBox ratio = `cells` ratio), light from the top-left,
no filters / `<style>` / external references. Each item is seeded from its id, so a rebuild is
deterministic. Ids are permanent once used on maps - add new items instead of renaming.
