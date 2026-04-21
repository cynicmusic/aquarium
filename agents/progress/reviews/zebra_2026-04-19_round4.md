# Zebra-mask review — 2026-04-19 round 4

Threshold: 8/10. Result: **NO tile reaches threshold. Regression from v003 persists.**

## Scores (v005, 7 tiles)

| # | mode | score | note |
|---|------|------:|------|
| 1 | fingerprint loose | 4/10 | faint speckle, no ridges |
| 2 | fingerwhorls   | 4/10 | whorl hint, too low contrast |
| 3 | mini curlies   | 3/10 | dot noise |
| 4 | fingerbrush alt| 4/10 | directional hint, too weak |
| 5 | 25 + blotch merge | 5/10 | best — faint but continuous |
| 6 | quadratic tangent | 4/10 | speckle |
| 7 | dual-scale contour (25) | 4/10 | regressed vs v004 |

Master reference: bold near-black reticulated curves on cream, coverage ~40%, stroke ~2–3 px. v005 coverage ~10%, strokes are isolated dots.

## Diagnosis

Hard-edged smoothstep(0.02, 0.06) on a narrow band kills most of the signal — only the thinnest extrema survive. v003 had real ridges because the band was wider. v005 is an over-correction: we narrowed the band AND kept the tight smoothstep, leaving almost nothing.

## Decision: NO commit.

## One tweak for round 5

**Widen the stripe band, keep the hard edge.** In every mode, change the contour test from

    smoothstep(0.02, 0.06, abs(f - 0.5))

to

    smoothstep(0.03, 0.05, abs(f - 0.35))  // offset center, tighter edge

i.e. shift the contour center off 0.5 so the stripe lands on a fatter part of the field (coverage ~35%), and keep edge width ~0.02 for crispness. Apply first to mode 25 (dual-scale contour) only; re-render single tile; if coverage looks right, propagate.

Expected: near-black curves at ~35% coverage, hard edges — matching master.
