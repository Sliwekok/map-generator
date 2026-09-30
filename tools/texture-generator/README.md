# Floor texture generator

Python scripts that produced the seamless floor textures in `assets/floors/` and `assets/floors-plus/`.

    pip install numpy scipy shapely
    python build.py                 # all textures -> ./out/<group>/patterns/*.svg
    python build.py f-ice f-marble  # only some

Seeds are fixed, so the output is reproducible. Change a seed in `free.py` / `plus.py` for a new variant
(save it under a new id - ids used by maps must never change). Copy the SVGs into `assets/` and run
`npm run assets:check`.
