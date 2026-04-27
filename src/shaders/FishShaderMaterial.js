/**
 * FishShaderMaterial.js — Fully procedural multi-layer fish shader.
 *
 * All texturing is computed per-pixel in the fragment shader:
 *   Layer 0: Base pattern (species-specific, from pattern params)
 *   Layer 1: Scale overlay (hexagonal tiling)
 *   Layer 2: Depth/subsurface (offset noise, screen/additive blend)
 *   Layer 3: Iridescence (view-dependent fresnel)
 *
 * Resolution-independent — infinite zoom detail. Zero texture VRAM.
 */

import * as THREE from 'three';

// ── Simplex noise GLSL (reused from Lighting.js volumetric shaders) ──
const NOISE_GLSL = /* glsl */`
// Simplex 3D noise — compact implementation
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// Multi-octave fractal noise
float fbm(vec3 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += snoise(p * freq) * amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

// 2D noise convenience
float noise2D(vec2 uv, float scale) {
  return snoise(vec3(uv * scale, 0.0));
}

float fbm2D(vec2 uv, float scale, int octaves) {
  return fbm(vec3(uv * scale, 0.0), octaves, 2.0, 0.5);
}
`;

// ── Pattern functions GLSL ──
const PATTERN_GLSL = /* glsl */`
// Helper: hex to vec3 color (computed on CPU, passed as uniform)
float smoothstepEdge(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// ── Pattern type 0: Vertical bands (clownfish, angelfish, butterflyfish, etc.) ──
vec3 patternBands(vec2 uv, vec3 bodyCol, vec3 bandCol, vec3 borderCol,
                   float centers[8], float widths[8], int numBands,
                   float innerFactor, float outerFactor,
                   float wobbleScaleU, float wobbleScaleV, float wobbleAmp, float wobbleOff,
                   float tailBlackStart, float mottleScale, float mottleBase, float mottleRange) {
  float wobble = fbm2D(uv, wobbleScaleU, 3) * wobbleAmp + wobbleOff * 0.5;
  float wobbleV = noise2D(vec2(uv.x * wobbleScaleU, uv.y * wobbleScaleV), 1.0) * wobbleAmp + wobbleOff;

  // Tail black band
  if (uv.x > tailBlackStart + wobbleV * 0.5) return borderCol;

  // Check bands
  for (int b = 0; b < 8; b++) {
    if (b >= numBands) break;
    float dist = abs(uv.x - centers[b] + wobbleV);
    if (dist < widths[b] * innerFactor) return bandCol;
    if (dist < widths[b] * outerFactor) return borderCol;
  }

  // Body with mottle
  float mottle = mottleBase + fbm2D(uv, mottleScale, 2) * mottleRange;
  return bodyCol * mottle;
}

// ── Pattern type 1: Horizontal stripes (emperor angel, lionfish, discus) ──
vec3 patternStripes(vec2 uv, vec3 bodyCol, vec3 stripeCol,
                     float freq, float threshold,
                     vec3 faceDarkCol, float faceBound,
                     vec3 tailCol, float tailBound,
                     float wobbleScaleU, float wobbleScaleV, float wobbleAmp) {
  float wobble = noise2D(vec2(uv.x * wobbleScaleU, uv.y * wobbleScaleV), 1.0) * wobbleAmp;

  // Face mask
  if (uv.x < faceBound + wobble) return faceDarkCol;
  // Tail
  if (uv.x > tailBound + wobble) return tailCol;

  // Stripes
  float phase = sin((uv.y + wobble) * 3.14159 * freq);
  if (phase > threshold) return stripeCol;
  return bodyCol;
}

// ── Pattern type 2: Spots (pleco, filefish, puffer contours) ──
vec3 patternSpots(vec2 uv, vec3 baseCol, vec3 spotCol,
                   float noiseScale, vec2 noiseOffset, float threshold,
                   float blendStart, float blendEnd) {
  float n = fbm2D(uv + noiseOffset, noiseScale, 3);
  if (n > threshold) {
    float blend = smoothstepEdge(blendStart, blendEnd, n);
    return mix(baseCol, spotCol, blend);
  }
  return baseCol;
}

// ── Pattern type 3: Contour/maze lines (pufferfish, mandarinfish) ──
vec3 patternContours(vec2 uv, vec3 baseCol, vec3 lineCol,
                      float noiseScale, float contourMult, float lineWidth,
                      float domainWarpScale, float domainWarpFactor) {
  // Domain warping for organic look
  vec2 warpedUV = uv;
  if (domainWarpScale > 0.0) {
    float wx = noise2D(uv * domainWarpScale, 1.0) * domainWarpFactor;
    float wy = noise2D(uv * domainWarpScale + 5.0, 1.0) * domainWarpFactor;
    warpedUV += vec2(wx, wy);
  }

  float n = fbm2D(warpedUV, noiseScale, 4);
  float contour = abs(fract(n * contourMult) - 0.5);
  if (contour < lineWidth) {
    float blend = 1.0 - contour / lineWidth;
    return mix(baseCol, lineCol, blend * 0.9);
  }
  return baseCol;
}

// ── Pattern type 4: Gradient zones (tang, foxface, damselfish) ──
vec3 patternGradientZones(vec2 uv, vec3 bodyCol, vec3 darkCol, vec3 accentCol,
                           float faceBound, float tailBound,
                           float dorsalVBound, float bellyVBound,
                           float wobbleAmp) {
  float wobble = noise2D(uv * 3.0, 1.0) * wobbleAmp;

  if (uv.x < faceBound + wobble) return darkCol;
  if (uv.y < dorsalVBound + wobble && dorsalVBound > 0.0) return accentCol;
  if (uv.x > tailBound + wobble && tailBound < 1.0) return accentCol;
  if (uv.y > bellyVBound + wobble && bellyVBound > 0.0 && bellyVBound < 1.0) {
    return mix(bodyCol, vec3(0.94, 0.94, 1.0), 0.3);
  }

  float mottle = 0.9 + fbm2D(uv, 10.0, 2) * 0.2;
  return bodyCol * mottle;
}

// ── Pattern type 5: Two-tone with horizontal stripe (neon tetra, cardinal tetra) ──
vec3 patternTwoToneStripe(vec2 uv, vec3 bodyCol, vec3 stripeCol, vec3 dorsalCol,
                           float stripeCenter, float stripeWidth,
                           float shimmerScale, float shimmerAmp) {
  float shimmer = noise2D(uv * shimmerScale, 1.0) * shimmerAmp;
  float stripeDist = abs(uv.y - stripeCenter + shimmer);

  if (stripeDist < stripeWidth) {
    float iridescence = 0.85 + noise2D(uv * 20.0, 1.0) * 0.3;
    return stripeCol * iridescence;
  }
  if (uv.y < stripeCenter - stripeWidth) return dorsalCol;
  return bodyCol;
}

// ── Pattern type 7: Neon tetra holo — simplified canonical tetra with a
// rolling blue/green iridophore band and red rear lower body.
vec3 patternNeonHolo(vec2 uv, vec3 bodyCol, vec3 stripeCol, vec3 stripeCol2,
                     vec3 dorsalCol, vec3 bellyCol, vec3 redCol,
                     float redStart, float redY,
                     float stripeCenter, float stripeWidth,
                     float shimmerScale, float shimmerAmp, float t) {
  vec3 col = mix(dorsalCol, bellyCol, smoothstep(0.25, 0.82, uv.y));

  float lower = smoothstep(redY, redY + 0.085, uv.y);
  float rear = smoothstep(redStart, redStart + 0.115, uv.x);
  float redMask = rear * lower;
  col = mix(col, redCol, redMask);

  float wobble = noise2D(uv * shimmerScale + vec2(t * 0.06, -t * 0.035), 1.0) * 0.018;
  float d = abs(uv.y - stripeCenter + wobble);
  float band = smoothstep(stripeWidth * 1.35, stripeWidth * 0.22, d);
  float roll = 0.5 + 0.5 * sin(uv.x * 18.0 - t * 2.4 + noise2D(uv * 5.0, 1.0) * 2.0);
  vec3 stripe = mix(stripeCol, stripeCol2, roll);
  stripe = mix(stripe, vec3(0.88, 1.0, 0.98), smoothstep(0.72, 1.0, roll) * shimmerAmp);
  col = mix(col, stripe, band * 0.92);

  float edgeGlow = smoothstep(stripeWidth * 1.45, stripeWidth * 0.95, d) * (1.0 - band);
  col += stripeCol2 * edgeGlow * 0.18;
  return col;
}

// ── Pattern type 6: Mottled (default/fallback) ──
vec3 patternMottled(vec2 uv, vec3 bodyCol, float scale, float base, float range) {
  float mottle = base + fbm2D(uv, scale, 3) * range;
  return bodyCol * mottle;
}
`;

// ── Scale overlay GLSL ──
const SCALE_GLSL = /* glsl */`
float scalePattern(vec2 uv, float scaleSize) {
  // Hexagonal grid for fish scales
  vec2 p = uv * scaleSize;
  float row = floor(p.y);
  float offset = mod(row, 2.0) * 0.5;
  vec2 cell = vec2(p.x + offset, p.y);
  vec2 f = fract(cell) - 0.5;

  // Arc shape (top of each scale is rounded)
  float d = length(f);
  float arc = smoothstep(0.45, 0.5, d);  // edge of scale
  float scaleEdge = smoothstep(0.3, 0.5, d);

  return scaleEdge;
}
`;

// ── Vertex shader ──
const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying float vFresnel;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vWorldTangent = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
  vWorldBitangent = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vec3 viewDir = normalize(cameraPosition - wp.xyz);
  vFresnel = 1.0 - abs(dot(vNormal, viewDir));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// ── Fragment shader ──
const FRAG = /* glsl */`
precision highp float;

${NOISE_GLSL}
${PATTERN_GLSL}
${SCALE_GLSL}

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying float vFresnel;

// Pattern uniforms
uniform int uPatternType;
uniform vec3 uBodyColor;
uniform vec3 uStripeColor;
uniform vec3 uAccentColor;
uniform vec3 uBorderColor;
uniform float uBandCenters[8];
uniform float uBandWidths[8];
uniform int uNumBands;
uniform float uBandInnerFactor;
uniform float uBandOuterFactor;
uniform float uTailBlackStart;
uniform float uWobbleScaleU;
uniform float uWobbleScaleV;
uniform float uWobbleAmp;
uniform float uWobbleOffset;
uniform float uMottleScale;
uniform float uMottleBase;
uniform float uMottleRange;
// Stripe params
uniform float uStripeFreq;
uniform float uStripeThreshold;
uniform float uFaceBound;
uniform vec3 uFaceDarkColor;
uniform float uTailBound;
uniform vec3 uTailColor;
// Spot params
uniform float uSpotNoiseScale;
uniform vec2 uSpotNoiseOffset;
uniform float uSpotThreshold;
uniform float uSpotBlendStart;
uniform float uSpotBlendEnd;
// Contour params
uniform float uContourNoiseScale;
uniform float uContourMult;
uniform float uContourLineWidth;
uniform float uDomainWarpScale;
uniform float uDomainWarpFactor;
// Gradient zone params
uniform float uDorsalVBound;
uniform float uBellyVBound;
// Two-tone stripe
uniform float uStripeCenter;
uniform float uStripeWidth;
uniform vec3 uDorsalColor;
uniform vec3 uSecondStripeColor;
uniform vec3 uRedColor;
uniform vec3 uBellyColor;
uniform float uRedStart;
uniform float uRedY;
uniform float uShimmerScale;
uniform float uShimmerAmp;

// Layer 1: Scales
uniform float uScaleSize;
uniform float uScaleOpacity;
uniform float uScaleContrast;

// Layer 2: Depth/subsurface
uniform float uDepthOpacity;
uniform int uDepthBlendMode;  // 0=screen, 1=additive
uniform float uDepthNoiseOffset;
uniform float uDepthFreqScale;

// Layer 3: Iridescence (legacy fresnel sin-mix)
uniform float uIridIntensity;
uniform vec3 uIridColor1;
uniform vec3 uIridColor2;
uniform float uIridAngleShift;

// Layer 3b: Iridophore thin-film layer
uniform float uIridoIntensity;   // 0 = off, 1 = full
uniform float uIridoThickness;   // effective film thickness (nm/100)
uniform float uIridoSpectralBias; // shifts the rainbow (0..1)
uniform float uIridoMaskScale;   // noise frequency for patchNiness
uniform float uIridoMaskOpacity; // how much the mask cuts through (0=full body, 1=tiny patchNes)
uniform float uHoloSweepIntensity;
uniform float uHoloSweepScale;
uniform float uHoloSweepSpeed;
uniform vec3 uHoloSweepColor1;
uniform vec3 uHoloSweepColor2;
uniform float uTime;

// Lighting
uniform vec3 uLightDir;
uniform float uEmissiveIntensity;

void main() {
  vec2 uv = vUv;

  // ── Layer 0: Base pattern ──
  vec3 baseColor;

  if (uPatternType == 0) {
    // Vertical bands
    baseColor = patternBands(uv, uBodyColor, uStripeColor, uBorderColor,
      uBandCenters, uBandWidths, uNumBands,
      uBandInnerFactor, uBandOuterFactor,
      uWobbleScaleU, uWobbleScaleV, uWobbleAmp, uWobbleOffset,
      uTailBlackStart, uMottleScale, uMottleBase, uMottleRange);
  } else if (uPatternType == 1) {
    // Horizontal stripes
    baseColor = patternStripes(uv, uBodyColor, uStripeColor,
      uStripeFreq, uStripeThreshold,
      uFaceDarkColor, uFaceBound, uTailColor, uTailBound,
      uWobbleScaleU, uWobbleScaleV, uWobbleAmp);
  } else if (uPatternType == 2) {
    // Spots
    float mottle = uMottleBase + fbm2D(uv, uMottleScale, 2) * uMottleRange;
    baseColor = patternSpots(uv, uBodyColor * mottle, uStripeColor,
      uSpotNoiseScale, uSpotNoiseOffset, uSpotThreshold,
      uSpotBlendStart, uSpotBlendEnd);
  } else if (uPatternType == 3) {
    // Contours
    baseColor = patternContours(uv, uBodyColor, uStripeColor,
      uContourNoiseScale, uContourMult, uContourLineWidth,
      uDomainWarpScale, uDomainWarpFactor);
  } else if (uPatternType == 4) {
    // Gradient zones
    baseColor = patternGradientZones(uv, uBodyColor, uAccentColor, uStripeColor,
      uFaceBound, uTailBound, uDorsalVBound, uBellyVBound, uWobbleAmp);
  } else if (uPatternType == 5) {
    // Two-tone stripe
    baseColor = patternTwoToneStripe(uv, uBodyColor, uStripeColor, uDorsalColor,
      uStripeCenter, uStripeWidth, uShimmerScale, uShimmerAmp);
  } else if (uPatternType == 7) {
    // Neon tetra holo
    baseColor = patternNeonHolo(uv, uBodyColor, uStripeColor, uSecondStripeColor,
      uDorsalColor, uBellyColor, uRedColor,
      uRedStart, uRedY,
      uStripeCenter, uStripeWidth, uShimmerScale, uShimmerAmp, uTime);
  } else {
    // Mottled fallback
    baseColor = patternMottled(uv, uBodyColor, uMottleScale, uMottleBase, uMottleRange);
  }

  // ── Layer 1: Scale overlay ──
  float scales = scalePattern(uv, uScaleSize);
  vec3 scaledColor = mix(baseColor, baseColor * (1.0 - uScaleContrast), scales * uScaleOpacity);

  // ── Layer 2: Depth/subsurface layer ──
  // Same pattern math with offset noise → creates luminous underlayer
  float depthNoise = fbm2D(uv + uDepthNoiseOffset, uMottleScale * uDepthFreqScale, 3);
  vec3 depthColor = baseColor * (0.8 + depthNoise * 0.4);

  vec3 composited;
  if (uDepthBlendMode == 0) {
    // Screen blend: 1 - (1-a)(1-b)
    vec3 screenBlend = 1.0 - (1.0 - scaledColor) * (1.0 - depthColor * uDepthOpacity);
    composited = screenBlend;
  } else {
    // Additive (glow mode)
    composited = scaledColor + depthColor * uDepthOpacity;
  }

  // ── Layer 3: Iridescence ── (legacy fresnel sin-mix — kept for tuning continuity)
  float iridAngle = vFresnel * 6.28318 + uIridAngleShift;
  vec3 iridColor = mix(uIridColor1, uIridColor2, 0.5 + 0.5 * sin(iridAngle));
  composited += iridColor * uIridIntensity * vFresnel;

  // ── Layer 3b: Iridophore thin-film ──
  // Approximates thin-film interference colour as a function of optical path length.
  // pathLen ≈ thickness * cos(θ) — as the viewing angle changes, so does the hue.
  // Real cuttlefish/neon-tetra iridophores are stacks of platelets; we mimic that by
  // modulating path length with multi-octave noise so the highlight isn't a single
  // ring but a shimmering patchNwork.
  if (uIridoIntensity > 0.001) {
    float cosTheta = max(0.05, 1.0 - vFresnel);
    // LAYER A — thin-film interference (per-pixel view-angle rainbow)
    float patchN = fbm2D(uv * uIridoMaskScale + uTime * 0.05, 1.0, 3);
    float pathLen = uIridoThickness * (0.5 + 0.5 * patchN) / cosTheta;
    float phase = pathLen + uIridoSpectralBias * 6.28318;
    vec3 thinFilm = vec3(
      0.5 + 0.5 * sin(phase),
      0.5 + 0.5 * sin(phase + 2.094),
      0.5 + 0.5 * sin(phase + 4.189)
    );

    // LAYER B — FBM-driven shimmer patches. Multi-octave noise creates
    // irregular bright/dark regions that drift slowly with time, giving the
    // skin a living structural-colour quality on top of the fresnel iridescence.
    vec2 shimUV = uv * 4.0 + vec2(uTime * 0.08, uTime * 0.05);
    float shim1 = fbm2D(shimUV, 1.0, 4);
    float shim2 = fbm2D(shimUV * 2.3 + shim1 * 2.0, 1.0, 3);
    float shimField = (shim1 * 0.6 + shim2 * 0.4);
    // Hue-cycled via phase offset so patches have independent colours
    float shimPhase = shimField * 6.28318 + uTime * 0.3 + uIridoSpectralBias * 3.14;
    vec3 shimColor = vec3(
      0.5 + 0.5 * sin(shimPhase),
      0.5 + 0.5 * sin(shimPhase + 2.094),
      0.5 + 0.5 * sin(shimPhase + 4.189)
    );
    float shimMask = smoothstep(0.35, 0.85, shim2);

    // LAYER C — scale iridescence (hex-row modulated). Amplifies the hex
    // scale pattern with a rainbow kick per-scale so individual scales glint.
    float hexScale = scalePattern(uv, uScaleSize * 0.5);
    float scaleGlint = smoothstep(0.35, 0.65, hexScale) * smoothstep(0.4, 1.0, vFresnel);

    float fresGate = smoothstep(0.30, 0.95, vFresnel);
    float filmMask = fresGate * smoothstep(0.15, 0.95, patchN);
    filmMask = mix(fresGate * 0.5, filmMask, uIridoMaskOpacity);

    vec3 sheen = mix(composited, composited * (0.6 + thinFilm), filmMask * uIridoIntensity);
    // Add FBM shimmer patches (additive, softer)
    sheen += shimColor * shimMask * uIridoIntensity * 0.35;
    // Add per-scale glint
    sheen += vec3(0.85, 0.90, 1.0) * scaleGlint * uIridoIntensity * 0.25;
    composited = sheen;
  }

  if (uHoloSweepIntensity > 0.001) {
    float sweep = 0.5 + 0.5 * sin((uv.x * uHoloSweepScale + uv.y * 2.5) - uTime * uHoloSweepSpeed + uIridoSpectralBias * 6.28318);
    float bands = smoothstep(0.62, 0.98, sweep);
    float broken = smoothstep(0.18, 0.80, fbm2D(uv * (uHoloSweepScale * 0.35) + uTime * 0.025, 1.0, 3));
    float gate = (0.35 + 0.65 * vFresnel) * bands * broken;
    vec3 holoSweep = mix(uHoloSweepColor1, uHoloSweepColor2, sweep);
    composited += holoSweep * gate * uHoloSweepIntensity;
  }

  // ── Lighting ──
  float diffuse = max(dot(vNormal, uLightDir), 0.0) * 0.5 + 0.55;  // brighter ambient + diffuse
  vec3 lit = composited * diffuse;

  // Emissive self-glow
  lit += uBodyColor * uEmissiveIntensity;

  // Rim light
  lit += vec3(0.3, 0.4, 0.5) * pow(vFresnel, 3.0) * 0.15;

  if (uHoloSweepIntensity > 0.001) {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float pointerX = 0.5 + dot(viewDir, normalize(vWorldTangent)) * 0.86;
    float pointerY = 0.5 + dot(viewDir, normalize(vWorldBitangent)) * 0.86;
    vec2 foilPointer = clamp(vec2(pointerX, pointerY), 0.0, 1.0);
    vec2 bg = uv + (foilPointer - 0.5) * vec2(2.6, 3.5);

    float rainbowPhase = bg.x * uHoloSweepScale
      + bg.y * (uHoloSweepScale * 0.38)
      + uTime * uHoloSweepSpeed
      + uIridoSpectralBias * 6.28318;
    vec3 rainbow = vec3(
      0.5 + 0.5 * sin(rainbowPhase),
      0.5 + 0.5 * sin(rainbowPhase + 2.094),
      0.5 + 0.5 * sin(rainbowPhase + 4.189)
    );
    rainbow = mix(rainbow, uHoloSweepColor1, 0.18);

    float scan = 0.50 + 0.50 * smoothstep(0.34, 0.46, fract((uv.y + foilPointer.y * 0.24) * 92.0));
    float barsA = smoothstep(0.24, 0.48, sin((uv.x + foilPointer.x * 0.9 + foilPointer.y * 0.35) * 34.0));
    float barsB = smoothstep(0.40, 0.58, sin((uv.x - foilPointer.x * 0.55) * 15.0 + uTime * 0.42));
    float bars = max(barsA * 0.7, barsB);

    float hot = 1.0 - smoothstep(0.02, 0.72, distance(uv, foilPointer));
    float glare = pow(hot, 1.35) + pow(max(0.0, vFresnel), 1.35) * 1.15;
    float anglePop = smoothstep(0.05, 0.65, abs(dot(viewDir, normalize(vWorldTangent))));
    float foilMask = (0.26 + bars * 0.70 + glare * 1.25) * scan * (0.55 + anglePop);

    vec3 dodge = lit / max(vec3(0.18), 1.0 - rainbow * 0.72);
    lit = mix(lit, dodge, clamp(foilMask * uHoloSweepIntensity * 0.46, 0.0, 0.92));
    lit += mix(rainbow, uHoloSweepColor2, hot * 0.35) * foilMask * uHoloSweepIntensity * 1.12;
  }

  gl_FragColor = vec4(lit, 1.0);
}
`;

/**
 * Create a FishShaderMaterial from species pattern config
 * @param {Object} patternConfig - from species JSON .pattern field
 * @param {Object} colors - from species JSON .colors field
 * @param {Object} layerParams - override layer params (scales, depth, iridescence)
 * @returns {THREE.ShaderMaterial}
 */
export function createFishMaterial(patternConfig, colors, layerParams = {}) {
  const type = patternConfig.type || 'mottled';

  // Map pattern type string to int
  const typeMap = {
    'bands_vertical': 0, 'bands_regions': 0, 'bands_with_spots': 0,
    'stripes_horizontal': 1,
    'spots': 2, 'composite_spots': 2,
    'contours': 3,
    'gradient_zones': 4, 'gradient_iridescent': 4,
    'two_tone_stripe': 5, 'two_tone_zones': 4,
    'neon_tetra_holo': 7,
    'composite_scales': 2, 'composite_grid': 2, 'composite_radial': 2,
    'mottled': 6,
  };

  const patternType = typeMap[type] ?? 6;

  // Parse colors
  const parseColor = (c) => {
    if (!c) return new THREE.Color(0.5, 0.5, 0.5);
    if (Array.isArray(c)) return new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
    if (typeof c === 'string') return new THREE.Color(c);
    return new THREE.Color(0.5, 0.5, 0.5);
  };

  // Extract band arrays (pad to 8)
  const bandCenters = new Float32Array(8);
  const bandWidths = new Float32Array(8);
  const centers = patternConfig.bandCenters || patternConfig.barCenters || [];
  const widths = patternConfig.bandWidths || [];
  const bw = patternConfig.barWidth;
  for (let i = 0; i < 8; i++) {
    bandCenters[i] = centers[i] ?? 0;
    bandWidths[i] = widths[i] ?? bw ?? 0.05;
  }

  const wobble = patternConfig.wobble || {};
  const mottle = patternConfig.mottle || { scale: 10, base: 0.85, range: 0.3 };
  const spots = patternConfig.spots || patternConfig.spotNoise || {};

  const uniforms = {
    uPatternType: { value: patternType },
    uBodyColor: { value: parseColor(patternConfig.bodyColor || patternConfig.baseColor || colors.body) },
    uStripeColor: { value: parseColor(patternConfig.bandColor || patternConfig.stripeColor || patternConfig.lineColor || colors.stripe) },
    uAccentColor: { value: parseColor(patternConfig.accentColor || patternConfig.darkColor || colors.accent) },
    uBorderColor: { value: parseColor(patternConfig.borderColor || [0, 0, 0]) },

    // Bands
    uBandCenters: { value: bandCenters },
    uBandWidths: { value: bandWidths },
    uNumBands: { value: centers.length },
    uBandInnerFactor: { value: patternConfig.bandInnerFactor ?? 0.7 },
    uBandOuterFactor: { value: patternConfig.bandOuterFactor ?? 1.0 },
    uTailBlackStart: { value: patternConfig.tailBlack?.start ?? 2.0 },

    // Wobble
    uWobbleScaleU: { value: wobble.scaleU ?? 3 },
    uWobbleScaleV: { value: wobble.scaleV ?? 5 },
    uWobbleAmp: { value: wobble.amp ?? 0.03 },
    uWobbleOffset: { value: wobble.offset ?? 0 },

    // Mottle
    uMottleScale: { value: mottle.scale ?? 10 },
    uMottleBase: { value: mottle.base ?? 0.85 },
    uMottleRange: { value: mottle.range ?? 0.3 },

    // Stripes
    uStripeFreq: { value: patternConfig.stripeFreq ?? 14 },
    uStripeThreshold: { value: patternConfig.stripeThreshold ?? 0.0 },
    uFaceBound: { value: patternConfig.faceRegion?.bound ?? -1 },
    uFaceDarkColor: { value: parseColor(patternConfig.faceDarkColor || [10, 15, 60]) },
    uTailBound: { value: patternConfig.tailRegion?.bound ?? 2.0 },
    uTailColor: { value: parseColor(patternConfig.tailColor || [255, 220, 0]) },

    // Spots
    uSpotNoiseScale: { value: spots.noiseScale ?? patternConfig.spotNoise?.scale ?? 8 },
    uSpotNoiseOffset: { value: new THREE.Vector2(...(spots.noiseOffset || patternConfig.spotNoise?.offset || [0, 0])) },
    uSpotThreshold: { value: spots.threshold ?? patternConfig.spotNoise?.threshold ?? 0.55 },
    uSpotBlendStart: { value: spots.blend?.start ?? patternConfig.spotNoise?.blend?.start ?? 0.55 },
    uSpotBlendEnd: { value: spots.blend?.end ?? patternConfig.spotNoise?.blend?.end ?? 0.65 },

    // Contours
    uContourNoiseScale: { value: patternConfig.contourNoiseScale ?? 6 },
    uContourMult: { value: patternConfig.contourMultiplier ?? 6 },
    uContourLineWidth: { value: patternConfig.contourThreshold ?? 0.10 },
    uDomainWarpScale: { value: patternConfig.domainWarp?.scale ?? 0 },
    uDomainWarpFactor: { value: patternConfig.domainWarp?.factor ?? 0 },

    // Gradient zones
    uDorsalVBound: { value: patternConfig.zones?.find(z => z.type === 'dorsal_accent')?.vBound ?? 0 },
    uBellyVBound: { value: patternConfig.zones?.find(z => z.type === 'belly_light')?.vBound ?? 2.0 },

    // Two-tone stripe
    uStripeCenter: { value: patternConfig.stripeCenter ?? 0.4 },
    uStripeWidth: { value: patternConfig.stripeWidth ?? 0.08 },
    uDorsalColor: { value: parseColor(patternConfig.dorsalColor || [40, 20, 30]) },
    uSecondStripeColor: { value: parseColor(patternConfig.secondStripeColor || patternConfig.stripeColor || [0, 255, 200]) },
    uRedColor: { value: parseColor(patternConfig.redColor || patternConfig.accentColor || colors.accent || [255, 30, 45]) },
    uBellyColor: { value: parseColor(patternConfig.bellyColor || [120, 160, 170]) },
    uRedStart: { value: patternConfig.redStart ?? 0.38 },
    uRedY: { value: patternConfig.redY ?? 0.43 },
    uShimmerScale: { value: patternConfig.shimmer?.scale ?? 12 },
    uShimmerAmp: { value: patternConfig.shimmer?.amp ?? 0.04 },

    // Layer 1: Scales
    uScaleSize: { value: layerParams.scaleSize ?? 40 },
    uScaleOpacity: { value: layerParams.scaleOpacity ?? 0.15 },
    uScaleContrast: { value: layerParams.scaleContrast ?? 0.3 },

    // Layer 2: Depth
    uDepthOpacity: { value: layerParams.depthOpacity ?? 0.1 },
    uDepthBlendMode: { value: layerParams.depthBlendMode ?? 0 },
    uDepthNoiseOffset: { value: layerParams.depthNoiseOffset ?? 3.7 },
    uDepthFreqScale: { value: layerParams.depthFreqScale ?? 0.7 },

    // Layer 3: Iridescence (legacy)
    uIridIntensity: { value: layerParams.iridIntensity ?? 0.08 },
    uIridColor1: { value: new THREE.Color(layerParams.iridColor1 ?? 0x4488ff) },
    uIridColor2: { value: new THREE.Color(layerParams.iridColor2 ?? 0x88ffcc) },
    uIridAngleShift: { value: layerParams.iridAngleShift ?? 0 },

    // Layer 3b: Iridophore thin-film
    uIridoIntensity:    { value: layerParams.iridoIntensity    ?? 0.0 },
    uIridoThickness:    { value: layerParams.iridoThickness    ?? 4.0 },
    uIridoSpectralBias: { value: layerParams.iridoSpectralBias ?? 0.0 },
    uIridoMaskScale:    { value: layerParams.iridoMaskScale    ?? 14.0 },
    uIridoMaskOpacity:  { value: layerParams.iridoMaskOpacity  ?? 0.7 },
    uHoloSweepIntensity:{ value: layerParams.holoSweepIntensity ?? 0.0 },
    uHoloSweepScale:    { value: layerParams.holoSweepScale ?? 18.0 },
    uHoloSweepSpeed:    { value: layerParams.holoSweepSpeed ?? 0.7 },
    uHoloSweepColor1:   { value: new THREE.Color(layerParams.holoSweepColor1 ?? 0x66faff) },
    uHoloSweepColor2:   { value: new THREE.Color(layerParams.holoSweepColor2 ?? 0xff66d8) },
    uTime:              { value: 0.0 },

    // Lighting
    uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() },
    uEmissiveIntensity: { value: 0.15 },
  };

  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    side: THREE.DoubleSide,
    transparent: false,
  });
}

/**
 * Update shared layer uniforms on a material (for real-time slider tuning)
 */
export function updateLayerUniforms(material, params) {
  if (params.scaleSize !== undefined) material.uniforms.uScaleSize.value = params.scaleSize;
  if (params.scaleOpacity !== undefined) material.uniforms.uScaleOpacity.value = params.scaleOpacity;
  if (params.scaleContrast !== undefined) material.uniforms.uScaleContrast.value = params.scaleContrast;
  if (params.depthOpacity !== undefined) material.uniforms.uDepthOpacity.value = params.depthOpacity;
  if (params.depthBlendMode !== undefined) material.uniforms.uDepthBlendMode.value = params.depthBlendMode;
  if (params.depthNoiseOffset !== undefined) material.uniforms.uDepthNoiseOffset.value = params.depthNoiseOffset;
  if (params.depthFreqScale !== undefined) material.uniforms.uDepthFreqScale.value = params.depthFreqScale;
  if (params.iridIntensity !== undefined) material.uniforms.uIridIntensity.value = params.iridIntensity;
  if (params.iridColor1 !== undefined) material.uniforms.uIridColor1.value.set(params.iridColor1);
  if (params.iridColor2 !== undefined) material.uniforms.uIridColor2.value.set(params.iridColor2);
  if (params.iridAngleShift !== undefined) material.uniforms.uIridAngleShift.value = params.iridAngleShift;
  // Iridophore thin-film layer
  if (params.iridoIntensity    !== undefined) material.uniforms.uIridoIntensity.value = params.iridoIntensity;
  if (params.iridoThickness    !== undefined) material.uniforms.uIridoThickness.value = params.iridoThickness;
  if (params.iridoSpectralBias !== undefined) material.uniforms.uIridoSpectralBias.value = params.iridoSpectralBias;
  if (params.iridoMaskScale    !== undefined) material.uniforms.uIridoMaskScale.value = params.iridoMaskScale;
  if (params.iridoMaskOpacity  !== undefined) material.uniforms.uIridoMaskOpacity.value = params.iridoMaskOpacity;
  if (params.time              !== undefined) material.uniforms.uTime.value = params.time;
}
