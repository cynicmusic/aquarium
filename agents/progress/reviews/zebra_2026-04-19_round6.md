# Zebra critic — round 6 FINAL

**Target:** mode 25 "dual-scale contour" in `zebra_sheet_v007.png`
**Threshold:** 8/10
**Previous:** round 5 = 6/10, recommended `smoothstep(0.2, 0.8, v)` post-mask contrast remap (applied in v007).

## Score: 8/10 — SHIP IT

### What improved vs round 5
- Contrast remap bit: dark contour lines now read clearly against tan base instead of muddy mid-grey wash.
- Stripe density feels right — not too sparse, not noise-floor.
- Dual-scale is legible: thick primary bands carry finer secondary ripples inside them.
- Flow direction is predominantly along-mantle (horizontal-diagonal), matching master.

### Gap vs master (acceptable residuals)
- Master strokes are slightly tighter and more rope-like / vermicular; mode 25 reads a touch coarser.
- Master has iridescent highlight speckle on top of contours; mode 25 is monochrome-on-base (no highlight layer). This is a color/shader concern, not a pattern-geometry concern — out of scope for this critic track.
- Very slight banding artifact at sheet edges, not visible at production scale.

### Production recommendation
- **Dial-in: 85–90%** of current mode-25 intensity.
  - At 100% the stripes feel a hair too uniform/busy across the whole mantle.
  - Multiply the pattern mask by ~0.87 before compositing, OR reduce the smoothstep upper bound from 0.8 → 0.78 to soften the darkest contours 10–15%.
- Keep `smoothstep(0.2, 0.8, v)` remap (or the 0.78 variant above) — do not revert.
- Reserve a follow-up pass for the iridescent highlight layer; track separately, not a zebra-pattern issue.

## Decision
Mode 25 is the production zebra. Promote it, wire it into the cuttlefish material at ~87% intensity, close this critic track.
