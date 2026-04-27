/**
 * ChromatophoreMaterial.js — layered cuttlefish skin (v2).
 *
 * Revisions for critic round 1:
 *   - Zebra bands sharpened with pow() edge + domain-warp wave
 *   - Iridophore hue center shifted to cyan; range widened so the rainbow
 *     actually sweeps cyan → gold → magenta instead of a warm-only slice.
 *   - Chromatophore density dropped; leukophore base now visible between sacs.
 *   - Burst field is now per-fragment: a Poisson-ish scatter of burst centres,
 *     each with its own birth time and exponential-decay envelope. That gives
 *     spatial clustering (some regions burst while others stay quiet) rather
 *     than a global sinusoidal pulse.
 *   - Added a dorsal travelling wave that visibly passes front → back.
 */

import * as THREE from 'three';

const vertex = /* glsl */`
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vObjectPos;

void main() {
  vUv = uv;
  vObjectPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */`
precision highp float;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vObjectPos;

uniform float uTime;

// Global tuning
uniform float uChromaDensity;
uniform float uChromaIntensity;
uniform float uIridoIntensity;
uniform float uIridoHueRange;
uniform float uZebraIntensity;
uniform float uZebraFrequency;
uniform float uZebraSharpness;
uniform float uZebraScaleX;
uniform float uZebraScaleY;
uniform float uZebraOffsetX;
uniform float uZebraOffsetY;
uniform float uZebraRotation;
uniform float uZebraGateLo;     // u-range lo for dorsal gate (default 0.18)
uniform float uZebraGateHi;     // u-range hi (default 0.82)
uniform float uSparkleIntensity;
uniform float uDebugZebra;
uniform vec3  uLeukoTint;
uniform vec3  uSkinTint;
uniform float uLightingBias;

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031,.1030,.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash21(vec2 p) {
  vec2 q = fract(p * vec2(123.34, 345.56));
  q += dot(q, q + 34.56);
  return fract(q.x * q.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += vnoise(p) * amp;
    p *= 2.02; amp *= 0.5;
  }
  return v;
}

// ── Expansion wave — ported directly from the workshop shader that the user
// liked, which has the characteristic "breathing" propagation across the body.
// Sum of radial + diagonal + noise-modulated sinusoids, then scaled to [0..1].
float expansionWave(vec2 uv, float t) {
  float wave = 0.0;
  float d1 = length(uv - vec2(0.5, 0.5));
  wave += 0.4 * sin(d1 * 8.0 - t * 0.6);
  wave += 0.3 * sin(uv.x * 4.0 + uv.y * 3.0 - t * 0.8);
  float n = fbm(uv * 3.0 + t * 0.15, 2);
  wave += 0.3 * sin(n * 6.28 + t * 0.5);
  return wave * 0.5 + 0.5;
}

// Travelling head→tail wave for the dorsal band so the zebra visibly breathes.
float dorsalWave(vec2 uv, float t) {
  float warp = fbm(uv * vec2(2.0, 5.0) + t * 0.1, 2) * 0.3;
  float w = sin(uv.y * 8.0 - t * 2.6 + warp);
  float env = smoothstep(0.15, 0.4, uv.y) * (1.0 - smoothstep(0.7, 0.95, uv.y));
  return w * env;
}

#ifdef HAS_CHROMA
// ── Voronoi sacs — ported from the user-preferred workshop shader: each sac
// has its own jiggle AND a wave-driven spring kick so the pattern ripples.
vec3 voronoi(vec2 uv, float density, float t) {
  vec2 id = floor(uv * density);
  vec2 fd = fract(uv * density);
  float minD = 10.0, secD = 10.0, cellId = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 off = vec2(float(x), float(y));
      vec2 cp = id + off;
      vec2 pt = hash22(cp);
      float ch = hash21(cp + 0.5);
      // Constant inner jiggle
      pt += 0.05 * vec2(
        sin(t * 0.4 + ch * 30.0),
        cos(t * 0.35 + ch * 25.0)
      );
      // Wave-driven kick: when the expansion wave passes, the sac flinches
      // outward, overshoots, then springs back.
      float waveProxy = sin(
        (cp.x + cp.y) * 0.3 + t * 0.15
        + sin(t * 0.08 + ch * 5.0) * 2.0
      );
      float kick = max(waveProxy, 0.0); kick *= kick;
      float springPhase = t * 2.0 + ch * 40.0;
      float spring = sin(springPhase) * exp(-fract(springPhase / 6.28) * 2.0);
      float kickAngle = ch * 6.28 + waveProxy * 1.5;
      pt += kick * spring * 0.1 * vec2(cos(kickAngle), sin(kickAngle));

      vec2 d = off + pt - fd;
      float dist = length(d);
      if (dist < minD) { secD = minD; minD = dist; cellId = hash21(cp); }
      else if (dist < secD) secD = dist;
    }
  }
  return vec3(minD, cellId, secD - minD);
}
#endif

// Leukophore base — soft warm beige substrate, no speckled "snow".
// Just a pale ground with gentle low-freq brightness drift.
vec3 leukophoreLayer(vec2 uv, float t) {
  // Very smooth slow-wave brightness — no high-frequency noise (that was the
  // "snow" the user hated). Two big blobs of fbm at low scale drifting slowly.
  float soft = fbm(uv * 2.2 + vec2(t * 0.04, t * 0.02), 3);
  return uLeukoTint * (0.88 + 0.14 * soft);
}

#ifdef HAS_IRIDO
vec3 iridophoreLayer(vec2 uv, vec3 normal, vec3 view, float t) {
  float ang1 = t * 0.06 + sin(t * 0.09) * 0.5;
  float ang2 = t * 0.042 - sin(t * 0.07) * 0.6;
  vec2 dir1 = vec2(cos(ang1), sin(ang1));
  vec2 dir2 = vec2(cos(ang2), sin(ang2));
  float field1 = dot(uv, dir1) * 11.0;
  float field2 = dot(uv, dir2) * 8.5 + fbm(uv * 5.0 + t * 0.1, 2) * 3.0;
  float phase = field1 + field2 + t * 0.4;

  // Centre hue at cyan (~180°). Spectral LUT that sweeps cyan → gold → magenta.
  //   R = 0.5 + 0.5 sin(phase + π)     — peaks at magenta
  //   G = 0.5 + 0.5 sin(phase - 2.094) — peaks at gold
  //   B = 0.5 + 0.5 sin(phase)         — peaks at cyan
  vec3 spectral = vec3(
    0.5 + 0.5 * sin(phase + 3.14159),
    0.5 + 0.5 * sin(phase - 2.094),
    0.5 + 0.5 * sin(phase)
  );
  float fres = 1.0 - max(dot(normalize(normal), normalize(view)), 0.0);
  fres = pow(fres, 1.2);
  // Finer patches for more structural-colour feel
  float patchM = smoothstep(0.25, 0.85, fbm(uv * 9.0 + t * 0.08, 3));
  return spectral * fres * patchM * uIridoHueRange;
}
#endif

#ifdef HAS_CHROMA
// Chromatophore pigment sacs.
// Uses workshop-style expansion: global expansion wave + per-cell sac pulse →
// sacs collectively breathe across the body rather than firing independently.
vec4 chromatophoreLayer(vec2 uv, float t, float expansion) {
  vec3 vor = voronoi(uv, uChromaDensity, t);
  float minD = vor.x;
  float cellId = vor.y;

  float sacPhase = cellId * 6.28;
  float sacPulse = sin(t * 1.2 + sacPhase) * 0.3;
  float expand = clamp(expansion + sacPulse, 0.0, 1.0);

  float rad = mix(0.10, 0.42, expand);
  float mask = smoothstep(rad + 0.04, rad - 0.04, minD);

  // Warm pigment palette (3 tones)
  vec3 pigA = vec3(0.75, 0.15, 0.05);
  vec3 pigB = vec3(0.85, 0.55, 0.05);
  vec3 pigC = vec3(0.35, 0.08, 0.02);
  vec3 colour;
  if (cellId < 0.33) colour = pigA;
  else if (cellId < 0.66) colour = pigB;
  else colour = pigC;
  // Centre-to-edge intensity falloff so each sac has a dark rim
  float sacIntensity = mask * (1.0 - minD / rad * 0.4);
  sacIntensity = clamp(sacIntensity, 0.0, 1.0);
  return vec4(colour, sacIntensity * uChromaIntensity);
}

// Second chromatophore layer — cool (teal/blue) sacs that counter-phase to
// the warm ones. Creates the "two grids" effect from the original workshop.
vec4 chromatophoreLayer2(vec2 uv, float t, float expansion) {
  vec3 vor = voronoi(uv + 0.37, uChromaDensity * 0.65, t * 0.8);
  float minD = vor.x;
  float cellId = vor.y;

  float expand2 = clamp(1.0 - expansion + sin(t * 0.9 + cellId * 6.28) * 0.2, 0.0, 1.0);
  float rad = mix(0.06, 0.55, expand2);
  float mask = smoothstep(rad + 0.05, rad - 0.03, minD);

  vec3 pigA = vec3(0.05, 0.55, 0.75);
  vec3 pigB = vec3(0.10, 0.35, 0.85);
  vec3 pigC = vec3(0.02, 0.25, 0.50);
  vec3 colour;
  if (cellId < 0.33) colour = pigA;
  else if (cellId < 0.66) colour = pigB;
  else colour = pigC;
  float intensity = mask * (1.0 - minD / max(rad, 0.01) * 0.3);
  intensity = clamp(intensity, 0.0, 1.0);
  return vec4(colour, intensity * uChromaIntensity * 0.7);
}
#endif

#ifdef HAS_SPARKLE
// Sparkle — tiny discrete bright points that flicker, like the shutterstock
// reference's speckled iridescence on the mantle edge.
float sparkleLayer(vec2 uv, float t) {
  vec2 id = floor(uv * 80.0);
  vec2 fd = fract(uv * 80.0);
  float ch = hash21(id);
  vec2 pt = hash22(id);
  float d = length(pt - fd);
  // Each cell flickers on its own schedule
  float flicker = smoothstep(0.92, 1.0, sin(t * 3.0 + ch * 40.0) * 0.5 + 0.5);
  return smoothstep(0.15, 0.0, d) * flicker * ch;
}
#endif

#ifdef HAS_ZEBRA
// ── Per-bar-index independent 1D noise ──
// Each integer bar gets its OWN wandering centerline. Neighbours drift
// independently, producing real fork/merge topology. Ported from
// agents/tools/zebra_static_sheet.mjs round 5 tile 32.
float barNoise(float u, float barIndex) {
  float shift = barIndex * 13.37;
  float v = 0.0;
  float amp = 0.5;
  float fu = u * 5.0 + shift;
  for (int i = 0; i < 3; i++) {
    v += vnoise(vec2(fu, shift * 1.7 + float(i) * 4.1)) * amp;
    fu *= 2.02;
    amp *= 0.5;
  }
  return v - 0.5;
}

// Fork-local algorithm. User-selected tile 32 (f16 la0.25 w0.4 j3.0).
float forkLocal(vec2 uv, float freq, float localAmp, float warpStrength, float forkStrength) {
  float y = uv.y;
  float u = uv.x;
  float yf = y * freq;
  float barIndex = floor(yf);
  float offsetA = barNoise(u, barIndex) * localAmp;
  float offsetB = barNoise(u, barIndex + 1.0) * localAmp;
  float frac = yf - barIndex;
  float offset = mix(offsetA, offsetB, frac);
  float warp = (fbm(uv * vec2(3.0, 4.0), 3) - 0.5) * warpStrength;
  float jumpN = vnoise(uv * vec2(2.1, 1.2));
  float jump = jumpN > 0.8 ? floor(jumpN * 3.0) * 0.25 : 0.0;
  float phase = yf + offset * freq + warp + jump * forkStrength;
  return 0.5 + 0.5 * sin(phase * 6.2832);
}

// Zebra mask — fork-local algorithm, LONGITUDINAL stripes running along the
// body length (matches master reference). Phase varies with uv.x (circumference
// distance from dorsal top), so stripes run parallel to the body axis.
//
// Also gates a separate HEAD region that gets a different texture (chunks /
// reticulation) — composited together at the call site.
float zebraMask(vec2 uv, float t) {
  // Dorsal gate — parameterised so the user can shift the zebra region sideways
  float gLo = uZebraGateLo;
  float gHi = uZebraGateHi;
  float dorsalU = smoothstep(gLo, gLo + 0.14, uv.x) * (1.0 - smoothstep(gHi - 0.14, gHi, uv.x));
  float dorsalV = smoothstep(0.22, 0.36, uv.y) * (1.0 - smoothstep(0.80, 0.94, uv.y));
  float gate = dorsalU * dorsalV;
  if (gate < 0.01) return 0.0;

  // Transform uv for pattern sampling: rotation around (0.5, 0.5), scale,
  // and offset. This lets the user slide/rotate/stretch the zebra stripes
  // without touching the gate (so the stripes stay on the dorsal region).
  vec2 puv = uv - 0.5;
  float c = cos(uZebraRotation), s = sin(uZebraRotation);
  puv = vec2(puv.x * c - puv.y * s, puv.x * s + puv.y * c);
  puv *= vec2(uZebraScaleX, uZebraScaleY);
  puv += vec2(uZebraOffsetX, uZebraOffsetY);
  puv += 0.5;

  // Sharpness controls the smoothstep edge transition — lower = softer bars.
  float edge = 0.04 / max(0.5, uZebraSharpness * 0.2);
  float raw = forkLocal(puv, uZebraFrequency, 0.25, 0.4, 3.0);
  float bars = smoothstep(0.50 - edge, 0.50 + edge, raw);
  return clamp(bars * gate * uZebraIntensity, 0.0, 1.0);
}
#endif

#ifdef HAS_HEAD_MASK
// Head reticulation mask — finer, chunkier pattern for the head lobe (v<0.3).
// Uses chunks-style FBM threshold + ridge noise overlay so the head reads as
// textured/speckled rather than uniform. Different visual family from the
// zebra bars so the head doesn't look like a continuation of the back stripes.
float headMask(vec2 uv, float t) {
  // Head region = front of body, lateral + dorsal
  float headU = smoothstep(0.12, 0.28, uv.x) * (1.0 - smoothstep(0.72, 0.88, uv.x));
  float headV = 1.0 - smoothstep(0.10, 0.28, uv.y);
  float gate = headU * headV;
  if (gate < 0.01) return 0.0;

  // Chunks (from F4 sharp experiment) + ridge noise interleaved
  float chunks = fbm(uv * vec2(3.5, 18.0), 5);
  float chunkMask = smoothstep(0.48, 0.52, chunks);
  // Ridge noise (D2 med) — adds finer reticulation on top of chunks
  float ridgeN = fbm(uv * vec2(4.0, 22.0) + 7.1, 4);
  float ridge = smoothstep(0.50, 0.80, 1.0 - abs(ridgeN - 0.5) * 2.5);
  float combined = max(chunkMask * 0.85, ridge * 0.65);
  return clamp(combined * gate * uZebraIntensity * 0.9, 0.0, 1.0);
}
#endif

#ifdef HAS_ZEBRA
// Mottle noise — applied ONLY to the dark stripe pixels (not cream gaps) so
// the bands have texture without disturbing the rest of the skin.
float stripeMottle(vec2 uv) {
  // Multi-octave noise at stripe scale
  float m = fbm(uv * vec2(35.0, 55.0) + 13.7, 4);
  // Add a finer second layer
  float fine = fbm(uv * vec2(90.0, 140.0), 3);
  return m * 0.7 + fine * 0.3;
}
#endif

void main() {
  vec2 uv = vUv;
  float t = uTime;
  // GLOBAL expansion wave — all sacs breathe together with a travelling wave.
  // Used by chroma layers AND head mask, so compute when either is on.
  #if defined(HAS_CHROMA) || defined(HAS_HEAD_MASK)
    float expansion = expansionWave(uv, t);
  #endif
  // dorsalWave only modulates zebra phase — gate on HAS_ZEBRA.
  #ifdef HAS_ZEBRA
    float wave = dorsalWave(uv, t);
  #endif

  // DEBUG: if uDebugZebra > 0.5, render the zebra mask as grayscale so we can
  // see exactly what value it's returning on the 3D mantle.
  #ifdef HAS_ZEBRA
  if (uDebugZebra > 0.5) {
    float z = zebraMask(uv, t);
    // Also overlay the UV coords to verify mapping
    vec3 uvCol = vec3(uv.x, uv.y, 0.5);
    gl_FragColor = vec4(mix(uvCol * 0.3, vec3(z), 0.85), 1.0);
    return;
  }
  #endif

  // Compute zebra once (used to attenuate every later layer + applied as final pass).
  #ifdef HAS_ZEBRA
    float zebra = zebraMask(uv, t) * (0.88 + 0.12 * (0.5 + 0.5 * wave));
  #else
    float zebra = 0.0;
  #endif
  // Compute head reticulation mask — covers the head region where zebra is absent
  #ifdef HAS_HEAD_MASK
    float headP = headMask(uv, t) * (0.85 + 0.15 * (0.5 + 0.5 * expansion));
  #else
    float headP = 0.0;
  #endif
  // Combined dark-pattern mask (for attenuating layers below)
  float darkPattern = max(zebra, headP * 0.85);

  // 1. Leukophore base
  vec3 color = leukophoreLayer(uv, t);

  // 2. Iridophore — additive sheen, dampened where dark patterns are strong
  #ifdef HAS_IRIDO
    vec3 irid = vec3(0.0);
    if (uIridoIntensity > 0.001) {
      irid = iridophoreLayer(uv, vWorldNormal, vViewDir, t);
    }
    float dorsalZone = smoothstep(0.35, 0.5, uv.x) * (1.0 - smoothstep(0.5, 0.65, uv.x));
    float iridMask = (1.0 - 0.45 * dorsalZone) * (1.0 - darkPattern * 0.75);
    color += irid * uIridoIntensity * iridMask;
  #endif

  // 3+4. Chromatophores — warm + cool, both driven by the expansion wave so
  //      the pattern visibly breathes across the body.
  #ifdef HAS_CHROMA
    if (uChromaIntensity > 0.001) {
      vec4 warm = chromatophoreLayer(uv, t, expansion);
      float waveBoost = 0.7 + 0.6 * expansion;     // 0.7 → 1.3 range
      color = mix(color, warm.rgb, warm.a * 0.90 * waveBoost * (1.0 - darkPattern * 0.70));

      vec4 cool = chromatophoreLayer2(uv, t, expansion);
      vec3 coolLayer = cool.rgb * cool.a * waveBoost * (1.0 - darkPattern * 0.65);
      color = 1.0 - (1.0 - color) * (1.0 - coolLayer);
    }
  #endif

  // 5. FINAL zebra pattern — HARD BLACK bars (user wants the hard black back).
  //    Mottle slightly so bands aren't flat paint.
  #ifdef HAS_ZEBRA
    float mottle = stripeMottle(uv);
    vec3 stripeDark  = vec3(0.02, 0.015, 0.01);
    vec3 stripeMid   = vec3(0.10, 0.07, 0.04);
    vec3 stripeMottled = mix(stripeDark, stripeMid, smoothstep(0.35, 0.70, mottle));
    color = mix(color, stripeMottled, clamp(zebra * 0.97, 0.0, 0.96));
  #endif
  // Head reticulation — AMBER/copper hue, clearly distinct from sepia zebra.
  // Critic: needs amber hue + 2-3x amplitude — different colour family.
  #ifdef HAS_HEAD_MASK
    vec3 headAmber = vec3(0.55, 0.32, 0.12);    // warm amber ridge
    vec3 headAmberDark = vec3(0.22, 0.11, 0.04);
    float headFine = fbm(uv * vec2(45.0, 60.0), 4);
    vec3 headCol = mix(headAmberDark, headAmber, smoothstep(0.35, 0.70, headFine));
    color = mix(color, headCol, clamp(headP * 1.0, 0.0, 0.95));
  #endif

  // 6. Sparkle layer — tiny flickering bright points
  #ifdef HAS_SPARKLE
    float sp = 0.0;
    if (uSparkleIntensity > 0.001) {
      sp = sparkleLayer(uv, t) * uSparkleIntensity;
    }
    color += vec3(1.0, 1.0, 1.0) * sp;
    // Iridescent-tinted sparkle adds colour (only meaningful with iridophore on)
    #ifdef HAS_IRIDO
      color += irid * sp * 1.2;
    #endif
  #endif

  color *= uSkinTint;

  // Lambert + rim
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(vec3(0.35, 0.95, 0.3));
  float diff = max(dot(N, L), 0.0) * 0.55 + 0.55;
  color *= mix(1.0, diff, uLightingBias);
  float fres = pow(1.0 - max(dot(N, normalize(vViewDir)), 0.0), 3.0);
  color += vec3(0.25, 0.40, 0.55) * fres * 0.22;

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createChromatophoreMaterial(opts = {}) {
  // ── Compile-time feature flags ──
  // Uniforms can't be constant-folded by the GLSL compiler, so layers we don't
  // need are best stripped at material-create time via #defines. Auto-derive
  // from the intensity opts (anything > 0 stays in), then let an explicit
  // opts.features override individual flags. Mantle wants everything; fins,
  // arms, tentacles strip the heavy bits they don't use.
  const chroma   = opts.chromaIntensity ?? 0.85;
  const irido    = opts.iridoIntensity  ?? 2.00;
  const zebra    = opts.zebraIntensity  ?? 0.85;
  const sparkle  = opts.sparkleIntensity ?? 0.8;
  const f        = opts.features || {};
  const defines  = {};
  if (f.chroma   ?? chroma  > 0) defines.HAS_CHROMA = '';
  if (f.irido    ?? irido   > 0) defines.HAS_IRIDO = '';
  if (f.zebra    ?? zebra   > 0) defines.HAS_ZEBRA = '';
  if (f.sparkle  ?? sparkle > 0) defines.HAS_SPARKLE = '';
  // Head reticulation defaults OFF (only the head surface uses it).
  if (f.headMask) defines.HAS_HEAD_MASK = '';

  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    defines,
    uniforms: {
      uTime:            { value: 0.0 },
      // User-selected defaults (preview stack, v019 → multi-view):
      //   Chromato Dens 88, Amt 0.85, Irido 2.00, Hue 1.61, Zebra 0.85, Freq 11
      uChromaDensity:   { value: opts.chromaDensity   ?? 88.0 },
      uChromaIntensity: { value: opts.chromaIntensity ?? 0.85 },
      uIridoIntensity:  { value: opts.iridoIntensity  ?? 2.00 },
      uIridoHueRange:   { value: opts.iridoHueRange   ?? 1.61 },
      uZebraIntensity:  { value: opts.zebraIntensity  ?? 0.85 },
      uZebraFrequency:  { value: opts.zebraFrequency  ?? 11.0 },
      uZebraSharpness:  { value: opts.zebraSharpness  ?? 4.5 },
      uZebraScaleX:     { value: opts.zebraScaleX     ?? 1.0 },
      uZebraScaleY:     { value: opts.zebraScaleY     ?? 1.0 },
      uZebraOffsetX:    { value: opts.zebraOffsetX    ?? 0.0 },
      uZebraOffsetY:    { value: opts.zebraOffsetY    ?? 0.0 },
      uZebraRotation:   { value: opts.zebraRotation   ?? 0.0 },
      uZebraGateLo:     { value: opts.zebraGateLo     ?? 0.18 },
      uZebraGateHi:     { value: opts.zebraGateHi     ?? 0.82 },
      uSparkleIntensity:{ value: opts.sparkleIntensity ?? 0.8 },
      uDebugZebra:      { value: opts.debugZebra ?? 0.0 },
      uLeukoTint:       { value: new THREE.Color(opts.leukoTint ?? '#c8d8d4') },
      uSkinTint:        { value: new THREE.Color(opts.skinTint  ?? '#ffffff') },
      uLightingBias:    { value: opts.lightingBias    ?? 0.55 },
    },
    side: THREE.DoubleSide,
  });
}
