---
date: 2026-04-19
reviewer: critic-animation
target: cuttle_anim_v004.png
prior: cuttle_anim_v003.png
focus: motion-only (chromatophore bursts, iridophore shimmer, tentacle wave)
---

# Animation Review — Cuttlefish Skin v004

## Score: 4 / 10

v004 does introduce visible frame-to-frame variation (v003 was essentially a rigid body rotating through the camera), but the motion reads as **uniform sinusoidal drift** rather than the burst-and-quiet firing pattern of real chromatophores. Tentacle undulation is present but under-amplitude. Iridophore shimmer is nearly invisible across frames.

## Per-frame observations (v004, left-to-right, ~0.8s apart)

- **F1** — Baseline. Mantle stripes sit at mid-contrast. Tentacles straight. No burst visible.
- **F2** — Slight warming on anterior stripes. Tentacles show the faintest S-curve starting near the base. Looks like a continuous lerp from F1, not a burst onset.
- **F3** — Peak of what appears to be a single global pulse — stripes brighten roughly uniformly across the mantle. This is the wrong shape: real bursts are *spatially localized*, propagating from one spot outward. Here the whole dorsal surface brightens together.
- **F4** — Darkest frame. Everything dims in lockstep. Again, uniform — no evidence of a wave *traveling* from posterior to anterior (or vice versa). The iridophore band under the mantle is identical in hue to F1.
- **F5** — Re-brightening begins. Tentacle tips show a small lateral offset; this is the clearest tentacle-wave frame, but the wavelength is too long (whole arm bends as one segment) and the amplitude is under ~3 px.
- **F6** — Returns toward F1 state. The full F1→F6 cycle reads as one sine wave on a single global uniform, not a stochastic burst train.

### Comparison vs v003
v003 had zero chromatophore animation — stripes were locked to the body. v004 clearly moves the pattern, so the plumbing works. The issue now is the *shape* of the signal, not its presence.

## Diagnostics

1. **Chromatophore sacs change between frames?** Yes, but as a global brightness multiplier, not per-sac firing. Individual sacs should expand/contract independently with staggered onsets.
2. **Burst-like vs continuous?** Continuous. The motion is C-infinity smooth. Bursts need sharp attack (~50ms), slow decay (~400ms), and spatial clustering.
3. **Tentacle waves vs rigid rods?** Rods with a single-segment bend. No travelling wave — all tentacle samples bend in phase.
4. **Iridophore shimmer different between frames?** Barely. The blue-green ventral band looks static; any variation is within JPEG-noise magnitude.

## Three specific fixes

### Fix 1 — Replace the global sine in `ChromatophoreMaterial.js burst()` with a spatial Poisson field

The current `burst(uTime)` almost certainly looks like `sin(uTime * k)` applied as a scalar to all fragments. Swap it for per-fragment burst centers:

```glsl
// in fragment shader
float chromaBurst(vec2 uv, float t) {
    float acc = 0.0;
    for (int i = 0; i < 6; i++) {
        vec2  c      = burstCenters[i];        // uniform, re-randomized on expiry
        float t0     = burstStartTimes[i];     // staggered
        float age    = t - t0;
        if (age < 0.0 || age > 0.6) continue;
        float env    = exp(-age * 8.0) * step(0.0, age);   // sharp attack, exp decay
        float fall   = smoothstep(0.25, 0.0, distance(uv, c));
        acc += env * fall;
    }
    return acc;
}
```

On the JS side, in `ChromatophoreMaterial.js`, recycle expired burst slots each frame with a Poisson arrival (`Math.random() < dt * rate`, rate ≈ 4 Hz) and write `burstCenters[i]` / `burstStartTimes[i]` as `uniforms`. This gives the spatially localized, temporally sparse firing pattern that reads as "chromatophore" rather than "glow pulse".

### Fix 2 — Add propagating wave term driven by mantle arclength, not time alone

In the same fragment shader, layer a travelling wave on top of the bursts so the eye catches the directional propagation even during quiet intervals:

```glsl
float arclen = vMantleS;                      // 0 at head, 1 at tail (add attribute)
float wave   = sin(arclen * 14.0 - uTime * 3.2);
float waveEnv = smoothstep(0.0, 0.15, wave) * 0.35;
```

Mix `waveEnv` into the chromatophore density. This is what makes the pattern appear to *flow* along the body. Requires adding a per-vertex `aMantleS` attribute in the geometry builder — one line where you already compute UVs.

### Fix 3 — Tentacle wave in `updateCuttlefish()` JS loop — phase-offset per segment

The current tentacle loop almost certainly does something like `bone.rotation.z = sin(t) * amp` applied with the same phase to every bone. Change to phase by segment index:

```js
for (let arm = 0; arm < 8; arm++) {
    const armPhase = arm * 0.7;               // splay between arms
    for (let seg = 0; seg < bones.length; seg++) {
        const k   = seg / bones.length;       // 0 base → 1 tip
        const phase = uTime * 6.0 - k * 5.5 + armPhase;
        bones[seg].rotation.z = Math.sin(phase) * 0.18 * k;   // amp grows toward tip
        bones[seg].rotation.y = Math.cos(phase * 0.7) * 0.09 * k;
    }
}
```

Key points: (a) `-k * 5.5` makes the wave *travel* from base to tip rather than every segment wobbling in unison; (b) amplitude scaled by `k` so the base is nearly still and tip whips — this matches real cuttlefish tentacle mechanics and will be legible at 0.8s sampling intervals. Also bump `uTime` multiplier to ~6 so a full wave period is ~1s, ensuring visible phase change between adjacent capture frames.

## What to capture for v005 to verify

Re-run the 6-frame strip at **0.15s spacing** (not 0.8s) — current spacing is longer than a burst's decay, so individual bursts alias to "global pulse" in the critic's view. A dense strip will show whether the burst envelope shape is actually correct.
