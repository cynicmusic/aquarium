# ZEBRA-STATIC Critic Round 3

Date: 2026-04-19
Sheet: `examples/internal/zebra_static_sheet_v003.png`
Master: `examples/external/cuttle/master reference.png`
Threshold: 8/10. Round 2 ceiling: 7.5 (R2c6 FORK sharp f14 w2 s1).

## Verdict: FORK-CONTOUR did not work. Best tile is still a row-1 reference.

## Sheet read

- **Row 1 (top-5 refs)**: the round-2 winners re-rendered. Sharp, near-horizontal ridged bars with bifurcations. Still the zebra-character tiles.
- **Rows 2-3 (FORK-CONTOUR 4x4, amp 0.4/0.6/0.8/1.0 x soft 0/1/2/3)**: the prescribed grid. Outcome is not what I asked for — the low-frequency sin/cos displacement broke bar continuity into gentle rolling horizontal *waves*, and softness blurred them further. Ridges lost their sharp edge and, critically, the bifurcations from R2c6 mostly disappeared or smeared. Amp 1.0 rows look like currents on water, not zebra skin. At soft=3 every tile is a brown gradient wash.
- **Row 4 (FORK-CONTOUR extension hybrids)**: no better. Same soft-wave failure mode plus extra variance.

The warp amplitude (0.8 bar-height) was too high and acted globally in phase, producing a coherent macro-wave instead of local contour following. The fork phase-shift algorithm's junctions don't survive that much displacement.

## Best tile in the whole sheet

**R1c1 `FORK sharp f14 w2 s1`** (the round-2 champion, re-rendered as reference). Score: **7.5/10**. Nothing in rows 2-4 beats it.

Runners-up, all row 1: R1c2, R1c3 (other round-2 top-5 refs). All ~7.0.

Score < 7 band: the entire FORK-CONTOUR grid. Best of that grid is **R2c1 (amp 0.4 soft 0)** at ~6.5 — closest to the row-2 base because it barely warped — but still worse than the unwarped base because even 0.4 amp smeared a few junctions.

## Diagnosis: why FORK-CONTOUR failed

1. **Global coherent warp ≠ contour following.** I prescribed a single sin/cos flow field across the tile. The master's curvature is *local* — each ridge bends to follow the body, but neighboring ridges bend semi-independently. A single low-frequency field moves all ridges together, producing a macro-wave that reads as "water," not "skin."
2. **Warp amplitude scaled to bar-height was too large.** At 0.8 bar-height, the displacement exceeds the fork-junction separation, so Y-junctions get dragged apart or collapsed into each other. Bifurcation topology is fragile under large warps — the round-2 finding.
3. **Softness made it worse, not better.** The master's edges are soft but its *contrast* is high. Gaussian + re-threshold lowered contrast across the board. What we needed was "fuzz at the boundary only" — micro-dither, not blur.

## Prescription for Round 4

Abandon global-warp FORK-CONTOUR. Two parallel probes instead:

1. **FORK-LOCAL**: keep `FORK sharp f14 w2 s1`. Add *per-ridge* micro-curvature — each bar's centerline offset by an independent 1D noise of amplitude 0.25 bar-height (not a shared flow field). This should preserve junctions while introducing organic bend.
2. **FORK-FUZZ**: keep `FORK sharp f14 w2 s1`. Edge treatment only — replace the hard threshold with a 1-pixel blue-noise dither band. No warp, no blur. Target: soften the edge character without killing contrast.

Render a 4x4: (local-curve amp 0.15/0.25/0.35/0.5) x (fuzz band 0/1/2/3 px blue-noise). If the amp=0.25 / fuzz=1 cell doesn't hit 8, the gap is frequency — bump to f=18 and repeat.

Also bump frequency probe: try f=16 and f=18 on the base `FORK sharp w2 s1` as row-1 additions. Master bar count looks closer to f=16-18 than f=14.

## Decisive summary

No winner. Round-3 ceiling = 7.5 (unchanged, it's the round-2 champion re-rendered). FORK-CONTOUR is a dead end — global warp destroys the fork topology. Next: local per-ridge curvature + edge-only fuzz + f=16-18 frequency bump. Keep R2c6 / R1c1 as the current reigning BACK tile.
