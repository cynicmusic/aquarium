# Zebra-Static Critic Round 4

## Verdict: SHIP IT

**Best tile: Row 4, Col 3** — localAmp=0.35, fuzzWidth=0.08
**Score: 8/10** — clears threshold.

## Why it works

FORK-LOCAL fixed the Round 3 ceiling. Previously every bar shared one warp
field, so bars wandered in unison — master reference shows bars wandering
*independently*, each like its own snake. Per-bar-index 1D noise offsets
deliver that: adjacent bars now drift in opposite directions, pinch toward
each other, and diverge, matching the cuttlefish's painted-on-flesh topology.

- **localAmp 0.35** — enough swing that bars visibly meander without
  dissolving into chaos (0.5 tiles break up bar identity).
- **fuzzWidth 0.08** — subtle edge softness mimics the slight pigmentation
  bleed at stripe boundaries in the master. 0 is too hard-edged, 0.15 mushes.
- **Independence** — the key win. Bars no longer move as a rigid sheet.

## Comparison to master

Master: horizontal bars, each wanders with its own amplitude, occasional
near-touches between neighbors, crisp-but-not-sharp edges.
Row 4 Col 3: same behavior. Spacing, amplitude, and edge quality all match
within the stylization budget of a procedural pattern.

## Shipped params

```
localAmp   = 0.35
fuzzWidth  = 0.08
barFreq    = (from previous round, unchanged)
noiseType  = per-bar 1D independent offsets (FORK-LOCAL)
```

## Notes for downstream

- Fish-texture integration: use these exact params as the base zebra layer.
- If the body curvature stretches bars, consider adaptive localAmp scaled by
  local body-space derivative — but that's round 5+ territory, not blocking.
- Round count: 4. Recommend closing this crit loop and moving to application.
