---
name: Cuttlefish evolutionary loop
purpose: Run this repeatedly. It's the canonical process for iterating the cuttlefish form.
---

# Cuttlefish evolutionary loop

## Focus
**Primary goals (per round):** head shape + eye readability (W-pupil must read as a W).
**Secondary:** anatomy proportions (mantle silhouette, fin-to-body ratio, arm crown, eye placement).
**Out of scope right now:** irido / chroma / sparkle / zebra uniforms — the current skin-glow stack is locked. Do NOT mutate these:
- `chromaDensity`, `chromaIntensity`
- `iridoIntensity`, `iridoHueRange`
- `zebraIntensity`, `zebraFrequency`, `zebraSharpness`
- `sparkleIntensity`, `leukoTint`

## Round shape
- **4 candidates** labelled **A / B / C / D**.
- **4 views** per candidate: SIDE / FRONT / TOP / 3-QUARTER.
- **16 tiles total** → one composite sheet (exactly the Chromium WebGL context cap).
- Sheet saved to `agents/progress/rounds/round_NNN.png` (historic archive, not overwritten).
- Each candidate's params snapshot saved alongside: `agents/progress/rounds/round_NNN_params.json`.

## Mutation policy
- **Moderate, not wild.** ±15–25% from the current seed per mutated dim. No random reshuffles.
- **Many dims per round are OK** (dozen+). Sweep *which* subset you mutate as well — not always the same dims.
- Seed = winner from prior round. Round 1 seed = current defaults.
- **Never mutate locked uniforms (see Focus above).**
- In-play params (sample, not exhaustive): `mantleLength`, `mantleRadius`, `mantleHeight`, `mantleTaper`, `headSize`, `headOffset`, head-bulb squash xy, `eyeRadius`, `eyeOffsetX/Y/Z`, `eyeSocketDepth`, W-pupil geometry params, eye rotation tilt, `armLength`, `armCurl`, `armBaseRadius`, `armCrownRadius`, `finWidth`, `finRipples`, `finRippleAmp`, `finAttachY`.

## Voting — force-rank all four
Each voter orders the four candidates **1st / 2nd / 3rd / 4th**. Points: 4/3/2/1.

| Voter  | Weight | Notes |
|--------|--------|-------|
| User   | 0.50   | Force-ranks A–D. **Omitting a letter = hard veto** on that candidate: 0 pts + its params are blacklisted from carrying forward. |
| Critic | 0.25   | Aesthetic & anatomic feedback. Must force-rank A–D. May not discuss shader params. |
| Claude | 0.25   | Anatomic + form feedback. Force-ranks A–D with 1-sentence reasoning per candidate. |

Weighted score per candidate = Σ(rank_points × weight). Highest wins → seeds next round.

## After each round
1. Sheet written to `agents/progress/rounds/round_NNN.png`.
2. Params snapshot written to `agents/progress/rounds/round_NNN_params.json`.
3. Results log appended to `agents/progress/evolutionary_log.md` (scores, winner, mutated dims, critic note).
4. **Pop the live preview** with the winner's params applied so user sees the animated result.
5. Pop the sheet image alongside.

## Stop condition
No hard stop. Run until user says stop or until two consecutive rounds fail to improve scores (then reseed with wider mutations).
