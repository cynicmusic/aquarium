# Zebra-Mask Critic Review — Round 5 FINAL

**Date:** 2026-04-19
**Sheet:** zebra_sheet_v006.png
**Reference:** examples/external/cuttle/master reference.png
**Threshold:** 8/10
**Focus:** mode 9 (top-left), mode 25 (bottom-right)

## Verdict

**NEITHER reaches 8/10.**

- Mode 9 (top-left): ~4/10. Dense fine speckle, no directional banding.
  Centre shift to 0.35 did not produce visible band structure here — still
  reads as noise texture.
- Mode 25 (bottom-right): ~6/10. Best tile on the sheet. Horizontal
  striations visible, directional flow present, band coverage ~35% looks
  right. But bands are broken and mid-toned, missing the crisp dark/light
  contrast of the cuttlefish mantle.

Mode 25 regressed slightly vs round 2's mode 09 at 7/10 in directional
clarity, but gained on band width.

## Root cause

Fatter bands (centre 0.35) exposed the real blocker: **contrast**. The
cuttlefish reference has near-black valleys and bright cream peaks. Our
masked iso output is mid-tone mush across the full band width. Widening
the mask just produced more mid-tone area, not more zebra-ness.

## Single precise change for round 6

Apply a contrast remap to the post-mask value before writing to the
output: replace the raw masked value `v` with `smoothstep(0.2, 0.8, v)`
(or equivalent gamma/sigmoid push). This pulls dark bands toward 0 and
light bands toward 1 without changing band geometry.

Keep centre = 0.35. Change only the output remap.
