---
date: 2026-04-19
reviewer: critic-zebra
round: 2
threshold: 8
subject: zebra_sheet_v003
verdict: FAIL — best tile lands at 7/10; strongest candidate (09) is within one tuning pass of threshold
---

# Zebra-Mask Pattern Review — Round 2

Threshold remains 8/10. Reference is fingerprint-ridge linework, 24-30 meandering
dark lines over warm ochre, FM-denser toward the head, with break/blotch events.

## Per-tile scores (round 2)

| # | name | score | note |
|---|------|-------|------|
| 05 | multi-cascade fbm          | 3 | still bar-like, 1:1, lost line character |
| 06 | two fam x-mod              | 3 | uniform dotted wave, reads as corrugation, not ridges |
| 07 | stripe + stipple           | 3 | stippled bars; noise dominates, no line topology |
| 09 | fbm contour fingerprint    | 7 | thin isolines, meandering, right topology — still globally uniform spacing, fewer than 20 lines visible, lacks blotches/breaks |
| 10 | contour + bar              | 4 | heavy filled bars muddy the lines; wrong character |
| 11 | ridge noise                | 4 | flowing ridge bands too thick, too low-frequency |
| 13 | fbm chunks                 | 2 | blobs, zero line structure |
| 14 | interrupted bars           | 4 | bar thickness and gap spacing still wrong |
| 15 | freq-mod stripe            | 3 | FM axis visible but filled sine bars |
| 16 | fingerprint + breaks       | 6 | line character present but break mask eats too much linework; output reads patchy/sparse |
| 17 | Turing gradient-ridge      | 2 | TOO FAINT — ridge gate * breaks * lines collapses intensity; barely visible |
| 18 | fine contour + hatch       | 3 | TOO FAINT — lines ghostly, break mask further crushes |
| 19 | branched bifurcation       | 4 | FAINT — some bifurcation visible but overall intensity low |
| 20 | curl-noise flow            | 2 | nearly invisible — along-flow term dephases lines |
| 21 | anisotropic curl+iso       | 5 | thin crisp lines in some regions, too sparse and too high-freq; reads as watermark |
| 22 | finger + blotch ref        | 6 | closest to master: visible lines + blotches — but blotches dominate, lines too faint |

Best: 09 at 7/10. Runners-up: 16 and 22 at 6/10.

## Top 3

1. **09 fbm contour fingerprint — 7/10.** Line topology is correct. Thin,
   meandering, non-periodic, clean AA. Gap: ~16 lines visible (need 24-30),
   globally uniform (needs head-dense FM to read), no breaks/blotches. One
   tuning pass away from 8.
2. **22 finger + blotch ref — 6/10.** Only tile with both line + blotch
   features present simultaneously. Correct compositional idea. Gap: lines
   are too faint relative to blotches; the cross-hatch adds dither not
   texture; blotches are oversized.
3. **16 fingerprint + breaks — 6/10.** Good thin linework base, but the
   break mask (keep = smoothstep(0.38, 0.55, brk)) deletes ~40% of the
   linework area making the tile read sparse. Break gate needs to preserve
   more line length.

## Best-pick gap analysis and exact GLSL changes for mode 9

**09 is 1 point below threshold.** To cross 8/10, edit the mode 9 branch in
`/Users/asmith/aquarium/src/workshop/ZebraSheet.js` (lines 127-135):

1. **Boost line count to 24-30 across the tile.** Current `freqMod` is
   `mix(22.0, 14.0, uv.y)` with anisotropy `vec2(2.2, 18.0)`. Raise the
   anisotropy y-scale and frequency. Replace:
   ```glsl
   vec2 aniso = vec2(2.2, 18.0);
   float freqMod = mix(22.0, 14.0, uv.y);
   ```
   with:
   ```glsl
   vec2 aniso = vec2(2.6, 26.0);
   float freqMod = mix(30.0, 18.0, uv.y);   // 30 lines at head, 18 at tail
   ```
2. **Make lines thinner and AA pixel-accurate via fwidth.** Replace the
   current hardcoded `smoothstep(0.015, 0.035 + aa, iso)` with derivative
   AA:
   ```glsl
   float w = fwidth(fract(n * freqMod)) * 1.2;
   return 1.0 - smoothstep(0.018 - w, 0.032 + w, iso);
   ```
   Keeps lines crisp at any zoom, slightly thinner at render scale.
3. **Add blotch term (4-6 chromatophore clusters).** Append before
   return:
   ```glsl
   float blot = smoothstep(0.74, 0.84, fbm(uv * vec2(2.8, 2.4) + 4.1, 3));
   lines = max(lines, blot * 0.75);
   ```
4. **Add gentle break mask that preserves 80%+ of linework.** Use a
   narrow, rare gate, not 16's broad one:
   ```glsl
   float brk = smoothstep(0.78, 0.86, fbm(uv * vec2(5.0, 3.0) + 2.7, 3));
   lines *= (1.0 - brk * 0.8);
   ```
5. **Increase stripe intensity.** In `main()`, raise `z * 0.90` to
   `z * 0.96` so line darkness matches the master's near-black ridges.

Expected result: ~26 thin dark lines, denser toward the head, a handful
of small dark blotches, occasional 1-2% break interruptions, pixel-crisp
edges. That is the reference topology.

## Why variants 17-22 look too faint, and how to fix

The fingerprint-line modes (17-20 especially) all **multiply** multiple
sub-1.0 masks together (e.g. `lines * brk * ridge` in 17), which crushes
intensity. The line term itself is already a subtraction from 1.0; further
multiplicative gating destroys it.

**Rules to restore contrast without losing thin linework:**

1. Keep `lines = 1.0 - smoothstep(a, b, iso)` as the primary channel.
   Never multiply it by a mask < 1.0 globally. Use `max(lines, other)` to
   combine and `lines *= (1.0 - brk * 0.3)` (not 0.7) for soft breaks.
2. Drop the `ridge` gate in mode 17 entirely — it was meant to restrict
   lines to high-gradient zones, but fbm is high-gradient nearly
   everywhere, and the gate only fails in the flat interiors where lines
   should still live.
3. Raise stripe darkness in `main()` from `z * 0.90` to `z * 0.96`.
4. For the curl-flow modes (20-21), the `along` term dephases the
   `fract()`. Reduce `along * 0.6` to `along * 0.25` so the isoline phase
   stays coherent.
5. For 22, reduce blotch strength from `blotMask * 0.6` to `blotMask * 0.35`
   and increase line darkness via the `main()` multiplier above. The
   cross-hatch `fine` term should be removed — it adds grain, not ridges.

## Round 3 strategy — committed

**Single strategy: promote mode 9 with the 5-edit patch above to be the
shipping pattern; kill modes 05, 06, 07, 10, 11, 13, 14, 15 entirely.**

Keep 09 (the fixed version), 16, 21, 22 plus three new targeted variants:

- **23 = 09 + 22 merge**: the 09 patch above, PLUS the mode 22 blotch term
  at 0.35 amplitude. Best-of-both.
- **24 = directional FM**: same as 23 but with anisotropy `vec2(3.0, 24.0)`
  and `freqMod = mix(32.0, 16.0, uv.y * uv.y)` (quadratic FM for steeper
  head-to-tail density falloff).
- **25 = dual-scale contour**: 23 plus a second, coarser isoline layer at
  `freqMod * 0.33` blended at 0.4 to suggest the reference's primary vs.
  secondary ridge hierarchy.

Round 3 sheet = 7 tiles max. Re-review for 8/10. The fingerprint topology
is solved; the remaining delta is contrast + blotches + FM, all in 09's
fragment branch.

## Verdict

**FAIL at 8.** Top tile 09 = 7/10. Apply the 5 GLSL edits above, add three
09-derived variants, rebuild, re-review. We are one round from threshold.
