# ZEBRA-STATIC Critic Round 2

Date: 2026-04-19
Sheet: `examples/internal/zebra_static_sheet_v002.png`
Master: `examples/external/cuttle/master reference.png`
Threshold: 8/10. Round 1 ceiling was ~6.5 (no bifurcation).

## Master back reality-check (what we are matching)

Tight, near-horizontal ridges. Bar spacing small relative to body (~20-25 bars across mantle). Very frequent Y-junction bifurcations where one ridge splits into two or two merge into one. Gentle contour-following curvature. Soft edges, high contrast. This is a fingerprint/Turing-ridge pattern, not a pure sine-bar.

## 1. Do any FORK tiles show real fork-merge topology?

YES. Row 2 clearly delivers what Round 1 lacked. Bifurcations visible in:

- **R2c6 `FORK sharp f14 w2 s1`** — cleanest Y-junctions. Count ~6 real fork/merge events per tile. Bar continuity is high between junctions, which matches the master's "ridge that occasionally splits" feel.
- **R2c5 `FORK f12 w2.0 s1.5`** — chunkier bifurcations, more irregular. Good topology but bars slightly too thick.
- **R2c2 `FORK f14 w1.5 s1.2`** — subtle forks, bar density closer to master, edges a bit too clean (lacks the master's fuzz).
- **R2c7 `FORK soft f12 w1 s0.8`** — softer edges, fewer but cleaner bifurcations. Best edge quality of the row.

Row 2 is the breakthrough. The FORK algorithm works.

## 2. Top 5 scored

| Rank | Tile | Label | Score | Notes |
|------|------|-------|-------|-------|
| 1 | R2c6 | FORK sharp f14 w2 s1 | **7.5** | Best fork topology. Too straight globally — master has more contour curvature. |
| 2 | R2c5 | FORK f12 w2.0 s1.5 | **7.0** | Good bifurcations, bars too chunky for back scale. |
| 3 | R4c3 | HYBR B3+chunks | **6.5** | Beautiful edges and warp, but bars too wide and no clear bifurcation — looks like wood grain. |
| 4 | R2c2 | FORK f14 w1.5 s1.2 | **6.5** | Correct bar density; forks too sparse, edges too clean. |
| 5 | R1c2 | B3 bars warped +more (★seed) | **6.0** | User's pick. Gorgeous warp; zero bifurcation — monotonic bars. |

No tile hits 8. Round 2 ceiling ≈ 7.5.

## 3. Best per region

- **BACK**: **R2c6 `FORK sharp f14 w2 s1`**. Already has bifurcations; just needs (a) gentler global curvature to arch over the mantle and (b) a touch of the softer edge treatment from R1c2. Nothing in row 4 hybrids beats it — R4c7 `B3 split-merge` is over-warped into a folded-towel artifact, R4c3 has no forks.
- **HEAD**: **R1c4 `D2 ridge med`** (★seed). The master's head is finer, more broken, more speckle-like. D2 ridge is the only tile with that dashed/broken ridge character. R1c7 `F4 chunks tiny` is a runner-up but reads too chunky-blotchy.

## 4. Prescription for Round 3 (no tile at 8)

Exactly one new variant — this is the load-bearing test:

> **`FORK-CONTOUR`**: take `FORK sharp f14 w2 s1` (R2c6) as base. Add two modulations on top:
>
> 1. **Low-frequency vertical displacement**: warp the whole field with a sin/cos flow field at ~0.5 bar-period spatial frequency, amplitude ≈ 0.8 bar-height. This gives the contour-arch the master has without destroying bar continuity (the over-warp failure mode of R4c7).
> 2. **Edge softness pass**: 1-pixel Gaussian + re-threshold with dithered boundary, copying the edge quality of R1c2 `B3 bars warped +more`.
>
> Keep `f14 w2 s1` frequency/warp/sharp parameters. Keep the phase-shift fork algorithm. Generate a 4x4 grid varying (warp amplitude 0.4/0.6/0.8/1.0) x (softness 0/1/2/3 px) so we can tune both axes.

If `FORK-CONTOUR` at amp=0.8 soft=1 does not hit 8, the remaining gap is probably a tiling/frequency issue rather than algorithm — then next step is finer f=18-20 with same params.

## Decisive summary

Round 2 proved forking works (R2c6). No tile at 8 yet — missing contour curvature and edge softness. Prescribe FORK-CONTOUR grid. Use R2c6 derivative for BACK, D2-ridge-med for HEAD. Do not pursue row 4 hybrids further — they either under-fork (c3) or shatter (c7).
