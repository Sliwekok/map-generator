# Hell pack generator

Source of `assets/hell/` (group "Hell / Piekło", access `user`, order 35, id prefix `h-`). Every SVG there is drawn by
these scripts (Python 3, standard library only), so colours, sizes and details can be changed here and regenerated
instead of edited by hand.

```
python scripts/hell-pack/build.py                     # all items + group.json
python tools/texture-generator/build.py hell          # ground textures -> tools/texture-generator/out/hell/patterns/
#   copy those 9 SVGs into assets/hell/patterns/
npm run assets:check
```

- `structures.py` - obsidian / iron / brimstone / bone walls (0.35 thick, like the tavern walls), post, pillar, iron door,
  spear gate, great gate, open gate, barred window, spiked fence, obsidian stairs, keep and tower roofs
- `furniture.py` - wrought-iron chairs, armchair, bench, desk, table, throne, chandeliers, candelabra, brazier, cage,
  chest, weapon rack, anvil, lectern, cauldron
- `terrain.py` - lava pool / fissure / stream, scorch mark, ash pile, summoning circle, rocks, charred tree, hellfire,
  sulfur vent, thorns, bones, skulls, chains, spike trap, obelisk, rift portal, skull on a pike, demon sigil (tintable)
- `blood.py` - blood river kit (painted style): chainable h-blood-river (2×4, ends at x=100) and h-blood-river-bend
  (3×3, top x=150 -> right y=150), h-blood-pool, h-ember-fissures (glowing crack decal); pieces are clipped to their box
  because the editor draws overflow
- `hlib.py` - hell palette and helpers (iron bars, rivets, spikes, chains, skulls, bones, lava, glow, fire, rocks)
- `lib.py` / `reg.py` - copies of the tavern-pack toolkit and registry

The ground textures (`h-scorched-earth`, `h-burned-ground`, `h-ash-field`, `h-lava-cracks`, `h-brimstone`,
`h-obsidian-tiles`, `h-iron-plates`, `h-cursed-stone`, `h-blood-water`) live in `tools/texture-generator/hell.py` because they use its seamless-tiling
toolkit (numpy, scipy, shapely). Their library names are listed in `TEXTURES` in `build.py`.

Conventions: 100 viewBox units per grid cell (viewBox ratio = `cells` ratio), light from the top-left, no filters /
`<style>` / external references (build.py asserts this). Each item is seeded from its id, so a rebuild is deterministic.
Files are always written as UTF-8. `HELL_MODULES=furniture` builds only some modules (then group.json is partial -
run a full build before committing). Ids are permanent once used on maps - add new items instead of renaming.
