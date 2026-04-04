# Critic Review #002 — Texture Sweeps (Initial Exploration)
**Date:** 2026-03-26
**Reviewer:** Critic Agent
**Scope:** 7 parameter sweeps across scales, spots, and stripes

## Sweep Scores

| Sweep | File | Score | Notes |
|-------|------|-------|-------|
| Scale size | sweep_001 | 4/10 | Voronoi cells look like cracked earth at low scale, disappear at high scale. Not fish-scale-like. |
| Ridge sharpness | sweep_002 | 5/10 | Medium sharpness (0.4-0.8) shows promise. Cell boundaries becoming visible. |
| Spot size | sweep_003 | 5/10 | cellSize 0.03-0.05 good for freckles. Angular artifacts at medium sizes. |
| Stripe freq | sweep_004 | 6/10 | freq 5-8 good for clownfish bands. Wobble adds organic feel. Best sweep so far. |
| Scale warp | sweep_005 | (not yet reviewed) | |
| Stripe wobble | sweep_006 | (not yet reviewed) | |
| Spot softness | sweep_007 | (not yet reviewed) | |

**Average: 5.0/10 — BELOW MINIMUM (7)**

## Systemic Issues
1. **Scales don't look like scales** — Current approach (voronoi + ridge noise) produces cracked/cellular patterns. Real fish scales are overlapping semicircular structures with regular spacing. Need a dedicated scale generator, not generic noise.
2. **Monochrome exploration** — All sweeps use default beige/brown. Need to explore with actual fish colors.
3. **No layering tested yet** — Haven't tested combining scales + spots + stripes.
4. **Spots have angular artifacts** — Voronoi cells create polygonal spot edges at medium sizes.
5. **Stripes are best** — Most promising texture type. The wobble parameter creates natural-looking organic patterns.

## Recommendations
1. **Build a dedicated scale texture generator** using overlapping semicircle patterns with:
   - Regular grid spacing (hex-packed)
   - Size variation by body position (smaller near head, larger on flank)
   - Each scale has highlight edge (catching light) and shadow
   - Subtle color variation per scale
2. **Explore colored textures** — Generate sweeps with species-specific palettes
3. **Test composites** — Layer scales underneath spots/stripes
4. **Fix spot edge artifacts** — Use distance-based smooth falloff, not Voronoi cell membership
