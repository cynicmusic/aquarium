---
reviewer: head_eye_critic
date: 2026-04-19
subject: cuttle_multiview_v001.png
scope: head shape + eye position ONLY (zebra/skin/animation ignored)
refs:
  - examples/external/cuttle/master reference.png
  - examples/external/cuttle/shutterstock-2459084889-huge-licensed-scaled-1024x683.jpg
source: src/entities/Cuttlefish.js (buildMantle L190, head bulb L619-636, buildEye L486, eye placement L654-666)
---

# Score matrix (1-10)

| View | Head shape | Eye position |
|------|-----------:|-------------:|
| Side | 4 | 3 |
| Front | 2 | 6 |
| Top | 3 | 1 |
| 3/4 | 4 | 2 |
| **Avg** | **3.25** | **3.0** |

# Per-view diagnosis

### Side
Head reads as a separate lollipop stuck on the front of a long tapered sausage — there is a visible neck/seam where the head-bulb meets the mantle (the bulb sits too far forward of the spine's t=0 cap and is too squashed in X so it silhouettes as a disc on a stick). The eye is invisible from the side: it has been rotated/pushed so far outward (eyeZ = headRSide*0.85 + eyeRadius*0.3) that the silhouette camera sees only the back of the socket torus, not the iris.

### Front
Front silhouette is a nearly circular puck, not a rounded dorsal hood over a ventral arm-cone — the 0.7x X-squash makes the head read as a coin face-on rather than a cephalopod head. The yellow iris IS visible (best view) but sits near the equator of that disc instead of high-on-forehead; pupil shape is being swallowed by the sphere behind the iris ring.

### Top
From above the animal looks like a zucchini with a small lollipop — no cephalopod head swell, no eye bulges breaking the dorsal silhouette. Eyes are invisible from top because eye y-offset (eyeRadius*0.55 above head center) is far below the head-bulb's dorsal crown, and the tilt (-0.35 rad) is not enough to push the iris into the top silhouette.

### 3/4
The seam between head-bulb and mantle is most obvious here — you can see the bulb's back edge floating inside the mantle hood, not blending. Eye is a thin crescent peeking sideways, not the prominent high-mounted gem the reference shows sitting just below the dorsal ridge.

# Root-cause notes

1. **Bulb geometry wrong axis squash.** `headGeo` squashes X by 0.7 (L628). That shortens the snout direction, so the bulb reads as a thin vertical disc from side/top. The reference head is ELONGATED front-to-back and FLATTENED top-to-bottom — the opposite squash.
2. **Bulb centre offset from spine.** `head.position.x = -mantleLength*0.5 + 0.05` (L635) places the bulb centre outside/ahead of the mantle's t=0 ring (which sits at x = -0.5*L per spineCtrl[0]). The bulb needs to be recessed INTO the mantle opening so rS=0.75 ring is inside the sphere, producing a continuous silhouette.
3. **Eye radial placement uses head centre, not head crown.** eyeY = headCy + eyeRadius*0.55 (L659) only lifts the eye a fraction of eyeRadius above head centre — but the bulb's vertical half-extent is headRadius*1.05, several times larger. The eye sits on the cheek, not on the forehead shoulder.
4. **Eye Z-offset too aggressive, rotation masks iris.** eyeZ pushes the eye past the bulb's side surface so the socket torus (dark) fills the side silhouette and the iris ring faces +Z/-Z only. Rotating yaw by Math.PI for the left eye is correct-ish, but combined with eyeX being only 0.05 forward, the iris plane is nearly parallel to the camera Z-axis in the side view → invisible.

# Three specific geometry fixes

**FIX 1 — reshape & recess the head bulb (`Cuttlefish.js` L622-635).**
Change the squash so X is the long axis and Y is flattened:
```
hPos.setXYZ(i, x * 1.25, y * 0.80, z * 1.05);
```
and recess it into the mantle opening:
```
head.position.set(-p.mantleLength * 0.5 - 0.02, p.mantleHeight * 0.95, 0);
```
(Note: lower Y too — current 1.2*H lifts the bulb above the mantle dorsal line; it should sit slightly BELOW so the mantle hood arches OVER the head, reference-style.) Also bump headRadius to `mantleRadius * 1.05` so it fits snugly inside the t=0 ring (rS=0.75 × R) without ballooning.

**FIX 2 — raise eye onto the dorsal shoulder (`Cuttlefish.js` L656-663).**
Replace eye placement with a crown-relative formula that uses the bulb's actual extents:
```
const headCx = -p.mantleLength * 0.5 - 0.02;
const headCy = p.mantleHeight * 0.95;
const eyeUp = headRadius * 0.55;               // climb most of the bulb's dorsal radius
const eyeFwd = headRadius * 0.35;               // sit forward of bulb centre, not behind
const eyeOut = headRadius * 0.70;               // inside the silhouette, not outside
eyeL.position.set(headCx - eyeFwd, headCy + eyeUp, -eyeOut);
eyeR.position.set(headCx - eyeFwd, headCy + eyeUp,  eyeOut);
```
This puts the eye high on the forehead and slightly forward — visible from side (crescent breaking the dorsal line), front (two gems on the brow), and top (two bumps flanking the spine).

**FIX 3 — reorient iris so it reads from multiple views (`buildEye` L486-520 + rotation at L665-666).**
The iris ring (L512-520) currently faces +Z. Move it onto a small hemispherical cap so it has depth AND reads from any forward-ish angle:
- Move iris out to `z = R * 0.95` and add a second, smaller iris disc tilted 30° up (copy + rotate) OR replace the flat ring with a `LatheGeometry` dome so the gold wraps the front quarter of the eyeball.
- Change eye rotation to tilt UP AND OUTWARD:
```
eyeL.rotation.set(-0.55, Math.PI * 0.85, 0.15);   // tilt up, yaw outward-and-forward
eyeR.rotation.set(-0.55, Math.PI * 0.15, -0.15);
```
The extra forward yaw (not full Math.PI) aims the pupil toward the front-side, so it catches the front camera too.

# Highest-priority single fix

**FIX 2 — raise the eye onto the dorsal shoulder using head-bulb-radius-relative offsets.** The user's top complaint is "eye visible from front AND side, higher up, with depth." Fix 1 improves silhouette but does not put eyes where the user asked. Fix 3 is polish. Without Fix 2 the eyes remain cheek-mounted and invisible from top regardless of bulb shape. Do Fix 2 first, render the 4-view grid again, then iterate on 1 and 3.
