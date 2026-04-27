---
date: 2026-04-26
reviewer: critic-floor
subject: ocean_floor_sheet_v001/v002
threshold: 8
---

# Ocean Floor Caustic Review

## Method

Generated 32-tile sheets with the repo's established variant workflow:

- `examples/internal/ocean_floor_sheet_v001.png`
- `examples/internal/ocean_floor_sheet_v002.png`
- `examples/internal/ocean_floor_sheet_v003.png`
- `examples/internal/ocean_floor_sheet_v004.png`
- score JSON beside each sheet

The score penalizes dim output, neon/hot coverage, busy edge noise, large
frame-to-frame delta, and shader cost. Visual review is adversarial: the tile
must read as underwater floor light, not UI pattern, snow, stars, plaid, or
glowing dots.

## Round 1

Verdict: FAIL. Best tile scored below 8 and looked like isolated glowing beads
on smoky sand. The math multiplied two ridge families, which made intersections
dominant and continuous filaments too weak.

## Round 2

Verdict: PASS with caveat. Best tiles:

| tile | label | score | critique |
|---|---|---:|---|
| 08 | S2.8 | 9.1 | strong readability, but too fine/plaid for production |
| 07 | S2.25 | 9.0 | good sheet tile, still too patterned |
| 06 | S1.85 | 8.9 | usable, moderate density |
| 05 | S1.5 | 8.7 | best production direction: readable but not noisy |
| 28-30 | G0.36-G0.68 | 7.9-8.0 | useful glint range, not as primary axis |

Chosen production blend: medium scale near tile 05/06, modest warp, ridge
sharpness near R8, glint around G0.36-G0.50.

## Blob Pass

User note: the caustics needed more blobs. Round 3 added a broad lens term but
it was too subtle. Round 4 raised the blob amount and lowered the blob gates:
large soft patches now sit under the filaments, while crossings still provide
the small glints. The production shader ports this v004 blend.

## Port Notes

The shipped shader replaces the expensive Voronoi caustic/bump path:

- Old path: two 3x3 Voronoi layers per caustic call, plus five caustic calls per
  fragment for finite-difference bump/specular.
- New path: one warped three-ridge caustic evaluation per fragment, with glints
  at ridge crossings and specular using the existing displaced floor normal.

This keeps the "glean/glimmer" but removes the likely source of desktop
long-run frame collapse and floor animation lag.
