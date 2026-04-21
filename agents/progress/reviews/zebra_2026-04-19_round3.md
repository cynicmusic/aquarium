# ZEBRA-MASK Critic — Round 3

Date: 2026-04-19
Sheet: `examples/internal/zebra_sheet_v004.png` (7 tiles)
Reference: `examples/external/cuttle/master reference.png`
Threshold: 8/10

## What the reference actually shows

Cuttlefish mantle: high-contrast **dark-brown worms on pale cream**, ~1.5–3 px stroke at this render scale, strong **anisotropy along body axis**, **branching/Y-junctions**, short segment lengths (~8–15 px), clear **end-caps** (blotches). Line/gap ratio ~1:1.2. Crucially the lines are nearly **black on near-white** — luminance delta is huge.

## Tile scores

| # | Variant | Score | Notes |
|---|---|---|---|
| 19 | fine+contour tuned | 4/10 | Faint speckle, no continuous lines. Contrast far too low; reads as sandpaper. |
| 20 | finger+breaks | 4/10 | Slightly more directional flow than 19 but strokes are broken dots, not worms. |
| 21 | extra curlier | 4/10 | More curvature hinted but strokes still dotty; anisotropy invisible. |
| 22 | finger+thick+red | 5/10 | Best color temperature of the batch (warmer mid-brown), slight stroke continuity — still ~1/3 of reference contrast. |
| 23 | 19 + blotch merge | 4/10 | Blotch merge via max() not visible; indistinguishable from 19 at this contrast. |
| 24 | quadratic freqmod | 4/10 | Frequency drift exists but strokes invisible. |
| 25 | dual-scale contour | 5/10 | Dual-scale gives a faint large-wavelength flow beneath fine noise — closest to the reference's structural hierarchy, but still way under-contrast. |

Best tile: **#22 (finger+thick+red)** and **#25 (dual-scale contour)** tied at 5/10. Neither reaches 8.

## Regression vs Round 2

Round 2 mode 09 scored 7/10 with visibly dark, legible worm strokes. **Round 3 lost ~2 points across the board** — the `fwidth` AA, `z*0.96` contrast squeeze, and gentle break mask all pushed luminance delta *down*. The tuning over-corrected toward "subtle" when the reference is emphatically not subtle. Every round-3 tile is lower-contrast than its round-2 ancestor.

## Decision

**No variant reaches 8/10. Best is 5/10. The approach has NOT hit its ceiling — it hit a tuning regression.**

### Single tweak to push to 8

Take variant **25 (dual-scale contour)** — its structural hierarchy is correct — and do exactly one thing:

**Remove the AA softening and restore hard thresholding. Replace:**
```glsl
float line = smoothstep(thr - fwidth(v), thr + fwidth(v), v);
```
**with:**
```glsl
float line = step(thr, v);  // or smoothstep(thr-0.02, thr+0.02, v)
col = mix(vec3(0.08,0.05,0.03), vec3(0.92,0.85,0.72), line);
```

Drop `z*0.96`. Push the dark endpoint to near-black (0.05–0.08 luminance), light endpoint to near-cream (0.85–0.92). That single change — restoring the ~10:1 luminance ratio the reference has — is what's missing. Every other parameter (aniso 2.6/26, freqMod, dual-scale) looks correct; you just anti-aliased the signal into oblivion.

Secondary: bias line/gap ratio toward thinner lines (`thr` around 0.55–0.6, not 0.5) so dark worms sit on pale ground, not half-and-half.

## Strategy question

**Do NOT abandon procedural.** The round-2 mode-09 result proved the shader approach can hit 7/10; the structural ingredients are right. A hand-painted texture would lock the pattern (no variation across fish, no mantle-axis alignment, no animation potential for chromatophore pulses later). Photogrammetry is overkill for a stylized screensaver and won't match the rest of the art direction.

**Recommendation: one more round.** Take #25's structure, slam the contrast back up per above, and this hits 8. If round 4 still misses, then reconsider — but we're one parameter away, not an approach away.

## Round 4 spec

- Base: variant 25 (dual-scale contour)
- Line color: `vec3(0.06, 0.04, 0.03)`
- Ground color: `vec3(0.88, 0.80, 0.68)`
- Thresholding: `smoothstep(thr-0.02, thr+0.02, v)` — 2% soft edge, not fwidth
- Threshold value: 0.58 (thinner dark lines)
- Keep: aniso (2.6, 26.0), freqMod mix(30,18,uv.y), dual-scale contour
- Drop: `z*0.96`, fwidth AA, gentle break mask
- Render 6 variants sweeping `thr` in [0.52, 0.54, 0.56, 0.58, 0.60, 0.62] to nail line/gap ratio
