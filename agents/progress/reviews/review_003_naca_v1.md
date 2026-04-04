# Critic Review #003 — NACA Airfoil Fish v1
**Date:** 2026-03-26
**Reviewer:** Critic Agent
**Scope:** 8 species generated with NACA airfoil body equations (naca_009 through naca_016)
**Method:** Switched from hand-tuned control points to NACA 4-digit airfoil thickness distribution

## STAGNATION DETECTOR NOTE
Previous approach (hand-tuned Catmull-Rom control points) was stuck at 5.0/10 after 3 iterations.
**Course correction taken:** Replaced with NACA airfoil equations. Result: immediate score improvement.

## Scores

| Species | Score | Verdict | Notes |
|---------|-------|---------|-------|
| Clownfish | 6.5/10 | REVISE | Body taper is correct! Stocky, orange, gill cover. Fins still geometric. |
| Angelfish | 6.5/10 | REVISE | Tall compressed body reads well. Large dorsal/anal fins proportionate. |
| Tang | 6/10 | REVISE | Clean oval shape. Needs more distinctive coloring (should be vivid blue). |
| Betta | 7/10 | ACCEPT | Best of batch! Flowing veil tail immediately recognizable. Huge fins proportionate. |
| Discus | 6/10 | REVISE | Thick body correct but needs to be even more circular. Almost there. |
| Lionfish | 6/10 | REVISE | Spiny dorsal visible, blunt head. Spines need more separation/drama. Pectoral fan good. |
| Moorish Idol | 6.5/10 | REVISE | Tall pennant dorsal is the right shape. Body proportions good. |
| Butterflyfish | 6/10 | REVISE | Rounded disc body. Needs pointed snout. Shape is generic. |

**Average: 6.3/10 — UP FROM 5.0 (+1.3 points!)**
**Betta passes minimum threshold (7/10)**

## What NACA Fixed
1. ✅ **No more "spoon" shape** — airfoil thickness distribution creates natural taper
2. ✅ **Smooth body curves** — 80-point resolution from the equation, no angular artifacts
3. ✅ **Species distinctiveness** — thickness parameter (0.20-0.55) creates visually different body shapes
4. ✅ **Proper caudal peduncle** — tailNarrow parameter maintains reasonable thickness
5. ✅ **Gill cover** — operculum line drawn for the first time
6. ✅ **Countershading gradient** — darker dorsal, lighter ventral
7. ✅ **Color** — species-specific colors applied (vs all-white silhouettes)

## Remaining Issues
1. **Fins are still flat/geometric** — need membrane translucency, more natural curves at edges
2. **No texture/patterns yet** — solid colors. Need stripes (clownfish), spots, scales
3. **Fin rays too uniform** — need varying thickness, curvature
4. **Tail fin attachment** — some tails connect too abruptly to body
5. **Snout definition** — headBluntness helps but most fish still lack a defined mouth/jaw

## What to Do Next
1. Apply species-specific patterns (clownfish white bands, tang black accents, lionfish stripes)
2. Layer extracted reference palettes onto fish (use real colors from photos)
3. Add procedural scale texture overlay
4. Improve fin edge shapes (wavy, translucent)
5. Add mouth/jaw line detail
