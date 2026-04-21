# Cuttlefish evolutionary log — v2 (spline head)

Previous v1 rounds archived in `rounds/archive_v1/`. v2 begins after the
head-sphere was replaced with a spline-lofted head mesh, fins rebuilt for
full-length coverage + FBM width bumps + two-axis undulation, and arms
re-posed to emerge from the mouth and splay radially (no salamander-bundle).

## v2 round summary (unsupervised — critic 0.5 / claude 0.5)

| round | focus                                                  | winner | key unlock |
|-------|--------------------------------------------------------|--------|-----------|
| 001   | baseline new spline head + head-station sweep          | B      | taller forehead reads more sepia-like |
| 002   | forehead arch + flatten top-down + forward eyes        | B      | wider mantle for flatter paddle from above |
| 003   | paddle shoulders + eyes higher/forward + no-neck blend | B      | higher + forward-yawed eyes start showing W |
| 004   | shoulder boost + radial crown + no-neck (v2)           | B      | armCrownRadius 0.32 — arms fan radially |
| 005   | max paddle + horizontal arms + head disappears         | B      | armDropScale 0.35 keeps arms from drooping |
| 006   | head buried + wider paddle leaf + radial fan           | B      | mantleShoulderBoost 1.35 lands the paddle silhouette |
| 007   | W-pupil legibility + seamless dorsal sweep             | B      | headBackR 0.70 eliminates dorsal seam |
| 008   | final: continuous arc + crown eyes + big legible W     | B      | eye station 0.30 + pupilScaleW 1.65 — W reads from 3/4 |

Critic's closing note R8: *"Dorsal arc is finally continuous on A/B/D — campaign goal essentially landed."*
Remaining weakness: *"W-pupil still reads as beads from SIDE/3-quarter — next push should carve the W groove and enlarge the aperture further."*

## Arc-3 rounds (R009–R016) — Zoidberg arms + neck bridge + zebra variety

User feedback that opened the arc: *"pure horror show from the front. need the
zoidberg style droopy tentacles back. from the back you can see into the neck
so just need some connecting tissue there. also modulate the zebra texture."*

| round | focus                                              | winner | unlock |
|-------|----------------------------------------------------|--------|--------|
| 009   | Zoidberg droopy arms + neck bridge + zebra variant | A      | `armDropScale 1.20` restores curtain drape |
| 010   | keep droop + deepen neck fusion + full skirt       | B      | `mantleFrontBoost 1.55` seams the neck |
| 011   | tail-wrap skirt + melted crown + cleaner curtain   | C      | `armCurl 0.78` pulls curtain into tight drape |
| 012   | readable W-pupil + head-mantle fusion              | B      | `mantleFrontBoost 1.70` + lower forehead |
| 013   | head down+forward into shoulder + broad dorsal     | B      | `mantleRadius 0.78` + `shoulderBoost 1.50` |
| 014   | widest dorsal + eyes rotate inward for W           | B      | `eyeForwardYaw 0.30` + `pupilScaleW 1.85` → W readable in profile |
| 015   | broader dorsal + dome fusion + zebra iteration     | B      | `headLength 0.42` + flat forehead = true dome |
| 016   | final polish — long fin + eyes atop + zebra refine | B      | `finExtend 1.40` + `finWidth 0.32` — fin skirts full silhouette |

Closing critic note: *"Across the sheet the W-pupil finally reads consistently
from SIDE and 3/4 — the big Arc-3 win. Lock B as the Arc-3 endpoint. Future
arcs should push arm-crown articulation and tentacle differentiation."*

## Arc-4 rounds (R017–R024) — tentacle differentiation + W-pupil carved + crown articulation

Carried over critic note from Arc-3 close: *"Future arcs should push arm-crown
articulation and tentacle differentiation."*

| round | focus                                                 | winner | unlock |
|-------|-------------------------------------------------------|--------|--------|
| 017   | tentacle differentiation (long+thin+clubbed)          | B      | thin tentacle + big club + higher curl |
| 018   | resting-pose tentacles + bigger clubs + W in 3/4      | B      | `tentacleClubRadius 0.13` — dramatic fist club |
| 019   | carve deeper W-pupil + tentacle+zebra                 | B      | `pupilScaleW 2.20` + reshaped W bezier |
| 020   | eye on dorsal crown + hunter tentacles longer         | B      | `tentacleLength 2.40, ext 0.80` — clear hunter read |
| 021   | wider mantle oval + eyes tilt outward + zebra         | C      | `zebraFrequency 16, sharpness 4.5` — fine-band pattern |
| 022   | smoother fusion + tighter crown + broader oval        | C      | `mantleRadius 0.90, height 0.12` — truest paddle top-view |
| 023   | tight forward-facing arm crown + zebra                | A      | `armCrownRadius 0.14, dropScale 0.60` — gesturing forward |
| 024   | final polish (closed tulip + flatter head-on + zebra) | D      | `armCrownRadius 0.11, curl 0.88` — closed tulip crown |

Closing critic note R024: *"Lock as the Arc-4 closer, carrying its tulip crown
and fused-head silhouette forward as the baseline for Arc-5."*

## Structural changes introduced during Arc-4
- W-pupil bezier rewritten with deeper central dip (-h*1.10) and taller shoulder peaks (+h*0.12)
- Zebra patterns fully iterated — settled near `zebraFrequency 11, sharpness 5.5, intensity 1.05`
- Arm crown tightened: `armCrownRadius 0.11` + `armCurl 0.88` + `armDropScale 0.52` = closed tulip forward
- Hunter tentacles differentiated: thin base 0.01, tip 0.003, big club 0.10, length 2.4, extension 0.80 — visibly overshoot the arm bundle

## Structural changes introduced during Arc-3
- W-pupil rebuilt as pure black extrude with thicker depth (R*0.12) — W reads in profile
- `mantleFrontBoost` param bridges the head-to-mantle neck gap
- `armDropScale` restored toward 1.2+ so arms hang as a Zoidberg curtain instead of splaying horizontally
- Zebra params (`zebraIntensity`, `zebraFrequency`, `zebraSharpness`) unlocked for mutation

## Structural changes introduced during v2
- `buildHead()` — 5-station spline-lofted mesh (back/forehead/eye/cheek/mouth) replaces the sphere bulb
- `buildSideFin()` — LEN_SEG 80, WID_SEG 6, FBM bump width, full-length envelope
- `updateCuttlefish` fin wave — vertical + lateral undulation from a single phase
- `armSpine` — forward commit reduced, radial splay dominant, optional `armDropScale`
- `mantleShoulderBoost` — multiplicative bump on rS in the t≈0.10–0.35 shoulder region
- W-pupil recoloured from white → dark (real cuttlefish appearance) + scaleable via `pupilScaleW/H`
- Eyes mounted on head-local station via stInterp + parented to a headPivot group
