# Critic Review #001 — Geometry v2 Profiles
**Date:** 2026-03-26
**Reviewer:** Critic Agent
**Scope:** All 8 species silhouettes after v2 profile rework

## Scores

| Species | Score | Verdict | Key Issues |
|---------|-------|---------|------------|
| Clownfish | 5/10 | REVISE | Body tapers to spoon shape — too narrow after 60% mark. Real clownfish maintain width. |
| Angelfish | 5/10 | REVISE | Tall body correct, but peduncle still creates lollipop look. Anal fin shape good. |
| Tang | 5/10 | REVISE | Shape is generic oval, not distinctive enough. Needs more defined head/snout. |
| Betta | 6/10 | REVISE | Best of the batch. Flowing fins recognizable. Body still too round at head. |
| Discus | 5/10 | REVISE | Disc shape present but tapers too much. Discus should be nearly circular. |
| Lionfish | 4/10 | REVISE | Spiny dorsal good intent but body is wrong shape — too round, needs elongation. |
| Moorish Idol | 5/10 | REVISE | Tall pennant is there. Snout not pointed enough. Body proportions off. |
| Butterflyfish | 5/10 | REVISE | Generic rounded shape. Needs more pointed snout, rounder disc body. |

**Average: 5.0/10 — BELOW MINIMUM (7)**

## Systemic Issues
1. **Spoon/lollipop shape** — All fish share the same problem: round head → long taper → narrow peduncle → tail. This is because all profiles follow the same mathematical pattern (peak at 35%, linear decline to 100%). Need species-specific taper curves.
2. **Fin ray rendering** — Lines converge to messy patterns, especially pectoral fin rays on body. Need to fix or remove.
3. **Control point dots** — Visual clutter. Should be toggleable, not always-on.
4. **Nose shape** — All fish start at y=0 and immediately expand. Many fish have a defined snout/jaw before the body widens.
5. **Missing gill cover** — No operculum line visible on any fish.

## What Improved (vs v1)
- Tail fins now have proper fork shape (not spikes)
- Thicker caudal peduncle (reduced from ±0.02 to ±0.04-0.07)
- Species-distinctive fins (betta flowing, lionfish spiny, moorish idol pennant)
- Separate fin structures (dorsal, anal, pectoral, caudal)
- Dark background for visibility

## Next Steps for Geometry Expert
1. Address the spoon shape: profiles need to maintain width further back, then narrow sharply at peduncle (last 8-10% of body, not last 30%)
2. Add snout/jaw definition at nose (x=0 to x=0.08 region needs more detail)
3. Add gill cover line (operculum) as a visual detail
4. Fix or disable fin ray rendering
5. Make control point display optional (add --debug flag)
6. Increase control points at high-curvature areas (nose, peduncle transition)
