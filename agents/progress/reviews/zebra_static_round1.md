# Zebra Static Round 1 — Critic Review

**Date:** 2026-04-19
**Sheet:** `examples/internal/zebra_static_sheet_v001.png` (32 tiles, 8 families × 4)
**Target:** `examples/external/cuttle/master reference.png`
**Threshold:** 8/10. None cleared it.

## Master-reference fingerprint (what we are trying to hit)

- Thin, high-density **wavy horizontal stripes** (line width ~= gap width).
- Anisotropic: strong horizontal flow with local undulation and slight tilt per region.
- Lines **bifurcate, rejoin, and break**; occasional vertical cross-links between adjacent lines.
- Edges are crisp and continuous (not stippled, not blotchy, not blurred).
- Contrast is strong two-tone: dark stripe over warm light base.
- Stripe count across body ~30–40 parallel lines of variable length.

Three properties must coexist: **(1) horizontal anisotropy, (2) thin continuous lines, (3) topology (bifurcation / breaks).** No tile on the sheet satisfies all three.

## 1. Scores (one line each, 1–10)

**Family A — contour isolines**
- A1 contour thin — 3 — isotropic speckle, no horizontal flow.
- A2 contour med — 3 — same, slightly thicker.
- A3 contour thick — 4 — denser but still isotropic noise-field.
- A4 contour off-centre — 3 — minor directional hint, still mostly random.

**Family B — domain-warped bars**
- B1 bars tight — 4 — right density, but lines are unbroken perfect bars; no topology.
- B2 bars wide — 2 — too few, too thick, cartoonish.
- B3 bars warped — 5 — best bar variant; undulation is correct, but lines never break/branch.
- B4 bars stippled — 4 — breaks stripes into dots; loses line continuity.

**Family C — dual-scale contour (prior winner)**
- C1 dual scale soft — 5 — has local horizontal grain but field reads random overall.
- C2 dual scale sharp — 6 — sharper short dashes, faint horizontal bias; closest A/C family entry.
- C3 dual scale aniso+ — 6 — stronger horizontal lean, still dashy fragments rather than lines.
- C4 dual scale low-f — 5 — coarser, reads as grain rather than stripes.

**Family D — ridge noise**
- D1 ridge soft — 3 — blurry, too few stripes, painterly.
- D2 ridge med — 4 — better count, still too soft.
- D3 ridge sharp — 6 — crisp stripes with real breaks & bifurcations; too chunky/low-count.
- D4 ridge aniso++ — 7 — best anisotropic ridge; topology correct, spacing too large.

**Family E — interrupted bars**
- E1 interrupt light — 4 — straight bars with a few smudges; breaks look like stains.
- E2 interrupt med — 5 — more break events; still obviously straight bars underneath.
- E3 interrupt heavy — 5 — noise dominates; breaks are blobs, not topology.
- E4 interrupt chunky — 3 — big smudges feel like damage, not pattern.

**Family F — fbm chunks**
- F1 chunks small — 5 — wavy negative-space reads stripe-ish, too blotchy.
- F2 chunks med — 3 — cloudy, loses stripe count.
- F3 chunks large — 2 — painterly marble.
- F4 chunks sharp — 5 — crisper chunks; still chunk topology not line topology.

**Family G — reference-targeted hybrids**
- G1 finger+blotch — 4 — isotropic scratch texture, lacks flow.
- G2 contour+hatch — 5 — hatching begins to look linear, direction weak.
- G3 warped bars+contour — 6 — straight thin gold bars on black; right line weight/count, no topology.
- G4 branched bifurc — 7 — genuine bifurcation and branching; direction too isotropic and density too low on dark.

**Family H — wild experiments**
- H1 worley-stripe — 3 — perfect parallel bars, zero irregularity.
- H2 spiral-warp — 1 — wrong globally; single spiral.
- H3 freq-mod quad — 5 — dashy noise with mild horizontal bias.
- H4 super hybrid — 6 — dense hatch with slight flow; closest "scratchy" feel but still isotropic.

## 2. Top 5 closest to master

1. **D4 ridge aniso++** (7) — best horizontal flow + real bifurcation/breaks.
2. **D3 ridge sharp** (6) — crisp line edges, correct topology, under-dense.
3. **G4 branched bifurc** (7) — genuine branching topology, correct line weight.
4. **C3 dual scale aniso+** (6) — anisotropy with scratchy micro-detail.
5. **H4 super hybrid** (6) — density and fineness close to master, orientation weak.

## 3. What's wrong with each top-5

- **D4 ridge aniso++** — Stripe period ~2x too large (we get ~12 lines vertically, master ~35). Ridges too smooth/painterly, missing the scratchy edge quality. Needs higher frequency and a sharpen/threshold pass to harden edges. No vertical cross-links.
- **D3 ridge sharp** — Edges are correct but even lower line count than D4. Ridges read as isolated chunks not connected lines; branching is absent because sharpening kills the thin connector filaments. Contrast good, density bad.
- **G4 branched bifurc** — Has the topology (bifurcation, joins) but is isotropic — no dominant horizontal direction. Line density correct. Needs the whole field warped by an anisotropic domain stretch (y-axis compression factor ~4–6).
- **C3 dual scale aniso+** — Anisotropic dashes rather than continuous lines; reads as hatching not stripes. Contour crossing threshold produces dashes because the underlying field isn't ridge-like. Needs ridge function as the base field, not fbm isoline.
- **H4 super hybrid** — Correct thinness and density, but direction is too weak (~isotropic). Looks like engraving crosshatch. Needs strong anisotropy bias applied at the composition step, plus more break events.

## 4. Variant 33 — prescribed hybrid for round 2

**Name:** `G5 aniso-ridge-bifurcating`

**Recipe (combine best of D4 + D3 + G4 + H4):**

1. **Base field:** ridged fbm (|1 - |noise||, 4 octaves, lacunarity 2.1, gain 0.5) — inherits D3/D4 topology.
2. **Anisotropic domain warp:** scale y by 0.18, x by 1.0 before sampling — produces the strong horizontal flow missing from G4/H4. Target ~32 visible lines top-to-bottom.
3. **Secondary low-freq warp:** add small x-domain warp driven by a second noise (amp 0.06) so lines undulate but never become sinusoidal.
4. **Bifurcation injector:** multiply base by (1 + 0.4 * secondary high-freq ridge) — creates the Y-split/join events that D3/D4 lack and G4 already shows.
5. **Vertical cross-links:** add rare short vertical connectors using a sparse masked noise (threshold 0.9) — directly seen in master between adjacent stripes.
6. **Edge hardening:** smoothstep(t-0.02, t+0.02, ridge) with t tuned so line/gap ~= 1:1; preserves the thin crisp edges that D4 loses by blur and D3 loses by over-sharpen.
7. **Micro-break noise:** small-amplitude high-freq subtract (fbm, amp 0.08) before threshold so stripes have occasional micro-gaps like H4 / C3.

**Parameter sliders to expose on the round-2 sheet (4 variants):**
- G5a: base aniso 0.18, bifurc 0.4, breaks 0.08 (nominal).
- G5b: aniso 0.14 (even tighter stripes).
- G5c: bifurc 0.6, breaks 0.12 (chaotic topology).
- G5d: aniso 0.22, cross-link density 2x (more connectors).

**Expected score if recipe lands:** 8–9. If a variant clears 8, lock it as the round-3 seed and iterate colour/edge treatment only.

## 5. Meta-notes for round 2

- Stop exploring bars families (B, E, H1) — they cannot produce topology by construction.
- A and F families are terminally isotropic; deprioritise.
- The winning formula is clearly **ridge base + hard anisotropic warp + topology perturbation**. Every remaining tile lies on some face of that cube; round 2 should sample the interior.
- Render at higher resolution per tile (current cells ~260px; master detail is at ~1152px). Subpixel line width may be making everything look softer than reality.
