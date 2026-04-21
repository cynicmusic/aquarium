# Aquarium — Iteration Plan

Last updated: 2026-04-19 (round 2 — all four critics ran, all tracks iterated once on critic feedback; see `agents/sessions/2026-04-19-round2.md`)

## Reference images
External refs in `examples/external/cuttle/`:
- `master reference.png` — zebra dorsal stripes, iridescent cheek, W-pupil, pink/cream/orange palette.
- `images.jpeg` — purple/teal iridophore striations on side fin + cheek.
- `shutterstock-*.jpg` — side-profile swimmer with soft brown dorsal stripes.
- `Screenshot … .png` — Google gallery: diversity across species (camouflage/zebra/psychedelic).

All iteration must compare against `examples/internal/_master_reference.png` (copied for side-by-side).

## Critical bugs
1. **Chromatophore sim appears static** — user sees motion only when dragging sliders. Either `uTime` isn't flowing, or pulseRate is too subtle to be visible frame-to-frame. Fix: pump `uTime` each frame + add dramatic burst timing so propagation waves ripple then calm.
2. **Mantle UV stretched** — chromatophore pattern stretches along the tapering body. Fix: recompute UVs so `u` wraps the circumference at constant density, and `v` uses arc-length rather than linear `i/N`.
3. **Cuttlefish 4×4 variants look identical** — parameter ranges too timid. Pick axes with real visual payoff.
4. **W-pupil not visible** — it's drawn as a flat shape on the eye front but hidden behind the cornea dome.
5. **Tentacles are dark static rods** — need animation + colour parity with mantle.
6. **Fish eyes flat, creepy, cut-off** — need real parallax/depth + less red iris + check clipping against body.
7. **Iridophore not applied to all fish** — should be the default fish skin behaviour, tuned per-species.

## Tracks (independent, iterate each with its own critic)

### Track L — **Leukophore / reflective base layer**
Sub-layer under everything else. Soft pale, slightly shimmering, with subtle Perlin mottle.
- [ ] Implement `leukophoreLayer(uv, t, params)` in `ChromatophoreMaterial.js`.
- [ ] Shimmer: multi-freq sine modulation makes highlights drift across.
- [ ] Critic_L: animation + texture fidelity vs reference. ≥ 7/10.

### Track I — **Iridophore structural-color layer**
The rainbow shimmer we see on the reference's cheek and fin.
- [ ] `iridophoreLayer(uv, normal, view, t, params)` — thin-film interference tied to fresnel + UV pattern.
- [ ] Undulating waves — two overlapping low-freq noise fields rotate.
- [ ] Separate mask so it shows strongly on cheek/fin, faintly on dorsal.
- [ ] Critic_I: does shimmer animate continuously? Does it look structural (view-dependent) not like a painted rainbow? ≥ 7/10.

### Track C — **Chromatophore pigment-sac layer**
Two grids (warm + cool) of voronoi sacs that expand and contract on propagation waves.
- [ ] Propagation burst timing — waves sometimes fast (100ms bursts), sometimes calm (5s rests), like real cephalopods.
- [ ] Fix UV stretch so sacs aren't oval.
- [ ] Critic_C: does animation have realistic burst cadence? ≥ 7/10.

### Track Z — **Zebra stripe band layer**
Separate modulator. Running front-to-back on the dorsal mantle, as in the master reference.
- [ ] Sharp high-contrast horizontal bands on the top half only.
- [ ] Stripe positions wobble slightly (domain-warped noise).
- [ ] Modulate chromatophore density — stripes = dense warm sacs; between = iridophores show through.
- [ ] Critic_Z: stripe count + contrast + mask fade vs reference. ≥ 7/10.

### Track SK — **Skin texture sheets**
Generate 4×4 *texture-only* tiles (no geometry) so the shader can be iterated against master reference without distracting 3D.
- [ ] `skin-sheet.html` — 16 tiles with varying (zebra strength × iridophore freq) etc.
- [ ] Put master reference as the 17th tile for comparison.
- [ ] Critic_SK: pick top 3 tiles that best match reference.

### Track CT — **Cuttlefish anatomy**
- [ ] Make W-pupil visible from outside — extrude it forward so it reads from any angle, or paint it as an opaque decal on the cornea.
- [ ] Tentacles: animate with travelling wave along the spine (drive vertex positions), colour them to match the mantle.
- [ ] Arms: tighten bundle in front of mouth, spread slightly based on activity.
- [ ] Widen 4×4 sweep to `mantleLength × armSpread` or `tentacleExtension × chromatophore-burstRate`.

### Track FE — **Fish eye**
- [ ] Real depth: small hemisphere pupil at the bottom of the cornea well with parallax (offset based on view direction); iris on the rim of the socket.
- [ ] Less red: iris colour driven by species primary, not a hard-coded gold.
- [ ] No clipping: clamp eye radius to 1.2× the body-profile thickness at the eye X.
- [ ] Per-body-size scaling.

### Track FI — **Fish iridophore**
- [ ] Default iridophore intensity ON for every fish. Per-species multiplier baked into species JSON (shy species ~0.1, show-off species ~0.4).
- [ ] Animate through `uTime` so every fish shimmers as it swims.

## Per-layer critic rules
- Each critic reads the relevant sheet PNG(s), the master reference PNG, and an animation GIF (3-4 frames captured at 0.5s intervals).
- Must assess **texture (static)** AND **animation (over time)** separately.
- Score 1–10; comments must reference specific file paths and params.
- Save review to `agents/progress/reviews/<track>_<iteration>.md`.

## Iteration protocol
1. Build tool first. 2. Emit sheet + 4-frame GIF. 3. Pop both. 4. Run track critic. 5. If < 7, tweak params and loop. 6. Port winner back to main tank and compare.
