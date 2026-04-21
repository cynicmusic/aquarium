/**
 * ZebraSheet.js — explores 16 DIFFERENT zebra-mask implementations.
 *
 * Each tile uses a different algorithmic approach to generating the dorsal
 * stripe pattern. Runs only the zebra layer + a warm body tint so the
 * pattern is the ONLY variable. Pick the best fit vs. master reference.
 *
 * Approaches:
 *   01 straight ruled bars
 *   02 wavy sinusoid (single octave)
 *   03 domain-warp fbm (medium)
 *   04 domain-warp fbm (heavy)
 *   05 multi-cascade fbm (3 layers)
 *   06 two stripe families cross-modulated
 *   07 stripe + stippling noise mask
 *   08 worley-cell stripe (each cell = a segment)
 *   09 contour lines of fbm field (like master ref's fine texture)
 *   10 contour + bar hybrid
 *   11 ridge noise (abs(fbm - 0.5))
 *   12 derivative-enhanced bar edges
 *   13 FBM threshold chunks (blotchy)
 *   14 tiger-style interrupted bars (gaps from noise)
 *   15 stripe frequency modulated by position
 *   16 reference-matched: contour lines at mid-v with cross-hatch
 */

import * as THREE from 'three';

// Keep within Chromium's 16-WebGL-context-per-page cap. The rejected simple
// variants (straight bars, wavy sinusoid, ruled) are cut — all 16 kept tiles
// are in the ballpark of the critic's "contour/linework" recommendation.
// Round 3 — committed to fingerprint-linework direction per critic.
// Only tiles that the critic kept + new tuned variants.
const VARIANTS = [
  { id: '09', name: 'fingerprint tuned',     mode: 9  },   // 7/10 → 8/10 target
  { id: '16', name: 'finger+breaks',         mode: 16 },
  { id: '21', name: 'aniso curl+iso',        mode: 21 },
  { id: '22', name: 'finger+blotch ref',     mode: 22 },
  { id: '23', name: '09 + blotch merge',     mode: 23 },   // new hybrid
  { id: '24', name: 'quadratic freq-mod',    mode: 24 },   // new FM approach
  { id: '25', name: 'dual-scale contour',    mode: 25 },   // new
];

const vertex = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform int uMode;
uniform float uTime;

float hash21(vec2 p) { vec2 q = fract(p*vec2(123.34,345.56)); q += dot(q,q+34.56); return fract(q.x*q.y); }
vec2 hash22(vec2 p) { vec3 q = fract(vec3(p.xyx)*vec3(.1031,.103,.0973)); q += dot(q,q.yzx+33.33); return fract((q.xx+q.yz)*q.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),
             mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p, int oct) {
  float v=0., a=0.5;
  for (int i=0;i<6;i++) { if (i>=oct) break; v += vnoise(p)*a; p *= 2.02; a *= 0.5; }
  return v;
}

// Each mode returns a 0..1 stripe mask.
float zebra(vec2 uv, float t, int mode) {
  if (mode == 1) {
    return step(0.5, fract(uv.y * 11.0));
  }
  if (mode == 2) {
    float w = sin(uv.x * 6.283) * 0.04;
    return 0.5 + 0.5 * sin((uv.y + w) * 11.0 * 6.2832);
  }
  if (mode == 3) {
    float w = fbm(uv * vec2(4.0, 10.0), 3) * 0.4 - 0.2;
    return 0.5 + 0.5 * sin((uv.y + w * 0.15) * 11.0 * 6.2832);
  }
  if (mode == 4) {
    vec2 q = uv * vec2(4.0, 10.0);
    float w = fbm(q, 4);
    float w2 = fbm(q * 2.0 + w * 3.0, 4);
    float wf = w + w2 * 1.0;
    return 0.5 + 0.5 * sin((uv.y + (wf - 1.0) * 0.15) * 11.0 * 6.2832);
  }
  if (mode == 5) {
    vec2 q = uv * vec2(6.0, 12.0);
    float w1 = fbm(q, 4);
    float w2 = fbm(q*2.3 + w1*4.0, 4);
    float w3 = fbm(q*0.7 + vec2(w2*6.0,w1*4.0), 3);
    float warp = (w1*0.5 + w2*0.35 + w3*0.25) - 0.55;
    float raw = 0.5 + 0.5 * sin((uv.y * 11.0 + warp*1.4) * 6.2832);
    return pow(raw, 5.0);
  }
  if (mode == 6) {
    float w = fbm(uv * vec2(3.0, 8.0), 3) - 0.5;
    float a = 0.5 + 0.5 * sin((uv.y * 10.0 + w) * 6.2832);
    float b = 0.5 + 0.5 * sin((uv.y * 17.0 + w * 1.6 + sin(uv.x*30.0)*0.3) * 6.2832);
    return max(a, b * 0.55);
  }
  if (mode == 7) {
    float w = fbm(uv * vec2(3.0, 9.0), 3) - 0.5;
    float raw = 0.5 + 0.5 * sin((uv.y * 11.0 + w) * 6.2832);
    float stip = fbm(uv * vec2(22.0, 40.0), 3);
    return raw * smoothstep(0.30, 0.85, stip);
  }
  if (mode == 8) {
    vec2 cell = floor(uv * vec2(2.0, 22.0));
    vec2 f = fract(uv * vec2(2.0, 22.0));
    float cellH = hash21(cell);
    // dark if cell-hash < 0.5 AND f.y near 0.5
    float band = smoothstep(0.1, 0.4, f.y) * (1.0 - smoothstep(0.6, 0.9, f.y));
    return band * step(0.5, cellH);
  }
  if (mode == 9) {
    // Round 5 — shifted mask centre, fatter coverage per critic.
    vec2 aniso = vec2(2.6, 26.0);
    float n = fbm(uv * aniso, 4);
    float freqMod = mix(30.0, 18.0, uv.y);
    float iso = abs(fract(n * freqMod) - 0.35);     // shift off 0.5 → fatter
    float lines = 1.0 - smoothstep(0.03, 0.05, iso);
    float blot = smoothstep(0.72, 0.82, fbm(uv * vec2(2.8, 2.4) + 4.1, 3));
    return clamp(max(lines, blot * 0.85), 0.0, 1.0);
  }
  if (mode == 10) {
    // contour lines AND underlying bar mask
    float n = fbm(uv * vec2(2.5, 12.0), 4);
    float iso = abs(fract(n * 12.0) - 0.5);
    float lines = 1.0 - smoothstep(0.03, 0.10, iso);
    float bar = 0.5 + 0.5 * sin(uv.y * 11.0 * 6.2832 + fbm(uv*vec2(4,10),3) * 3.0);
    return max(lines, smoothstep(0.6, 0.9, bar));
  }
  if (mode == 11) {
    // ridge noise: |fbm - 0.5| creates sharp ridges
    float n = fbm(uv * vec2(3.0, 16.0), 5);
    float ridge = 1.0 - abs(n - 0.5) * 2.5;
    return smoothstep(0.55, 0.75, ridge);
  }
  if (mode == 12) {
    // derivative: stripe with enhanced edges
    float w = fbm(uv * vec2(3.0, 9.0), 3) - 0.5;
    float raw = 0.5 + 0.5 * sin((uv.y * 11.0 + w) * 6.2832);
    float edge = smoothstep(0.45, 0.5, raw) - smoothstep(0.5, 0.55, raw);
    return clamp(edge * 3.0, 0.0, 1.0);
  }
  if (mode == 13) {
    // FBM chunks — splotchy block pattern
    float n = fbm(uv * vec2(4.0, 20.0), 4);
    return smoothstep(0.46, 0.54, n);
  }
  if (mode == 14) {
    // interrupted bars — bars but with noise gaps
    float w = fbm(uv * vec2(3.0, 8.0), 3) * 0.35 - 0.17;
    float bar = step(0.5, 0.5 + 0.5*sin((uv.y+w)*11.0*6.2832));
    float gap = smoothstep(0.55, 0.75, fbm(uv*vec2(15.0,5.0),3));
    return bar * (1.0 - gap);
  }
  if (mode == 15) {
    // Frequency modulated — stripe spacing varies with u
    float freq = mix(8.0, 18.0, smoothstep(0.0, 1.0, uv.x));
    float w = fbm(uv * vec2(4.0, 8.0), 3) - 0.5;
    return 0.5 + 0.5 * sin((uv.y * freq + w * 2.0) * 6.2832);
  }
  if (mode == 16) {
    // Fingerprint linework + breaks + blotches.
    // Critic: stripe:gap 1:2, ~24-30 lines, frequency-modulated toward head.
    vec2 aniso = vec2(2.4, 20.0);
    float n = fbm(uv * aniso, 5);
    float freqMod = mix(26.0, 14.0, uv.y);
    float iso = abs(fract(n * freqMod) - 0.5);
    float aa = 0.003;
    float lines = 1.0 - smoothstep(0.012, 0.030 + aa, iso);
    // Break mask — lines interrupt in some regions (blotches of chroma showing)
    float brk = fbm(uv * vec2(4.0, 3.0) + 7.3, 3);
    float keep = smoothstep(0.38, 0.55, brk);
    lines *= keep;
    // A handful of dark blotches where the lines fade out
    float blot = smoothstep(0.66, 0.78, fbm(uv * vec2(3.0, 2.5), 3));
    return clamp(lines + blot * 0.35, 0.0, 1.0);
  }
  if (mode == 17) {
    // Turing-style gradient-aligned ridges. Use the gradient of an fbm field
    // to align the linework to an organic flow direction, then threshold
    // along the gradient perpendicular to make ridges. Anisotropic sample
    // + intra-ridge sub-hatching = reference fingerprint texture.
    vec2 q = uv * vec2(2.4, 20.0);
    float n = fbm(q, 5);
    // Gradient via central differences
    float e = 0.01;
    float nx = fbm(q + vec2(e,0), 5) - fbm(q - vec2(e,0), 5);
    float ny = fbm(q + vec2(0,e), 5) - fbm(q - vec2(0,e), 5);
    float grad = length(vec2(nx, ny));
    // Ridges: high gradient magnitude zones
    float ridge = smoothstep(0.02, 0.10, grad);
    // Primary linework
    float freqMod = mix(26.0, 14.0, uv.y);
    float iso = abs(fract(n * freqMod) - 0.5);
    float aa = 0.003;
    float lines = 1.0 - smoothstep(0.010, 0.026 + aa, iso);
    // Secondary hatching PERPENDICULAR to gradient (intra-ridge detail)
    vec2 perp = vec2(-ny, nx);
    float subFreq = 60.0;
    float subPhase = dot(uv, perp) * subFreq;
    float subHatch = 0.5 + 0.5 * sin(subPhase * 6.2832);
    subHatch = smoothstep(0.6, 0.85, subHatch);
    // Breaks
    float brk = smoothstep(0.38, 0.56, fbm(uv * vec2(5.0, 3.0), 3));
    float blot = smoothstep(0.62, 0.75, fbm(uv * vec2(3.0, 2.5), 3));
    return clamp((lines + subHatch * 0.25) * brk * ridge + blot * 0.35, 0.0, 1.0);
  }
  if (mode == 18) {
    // Fine contour + orthogonal cross-hatch — mimics the reference's woven look
    vec2 aniso = vec2(2.8, 22.0);
    float n1 = fbm(uv * aniso, 5);
    float n2 = fbm(uv * aniso.yx * 0.4, 4);
    float freq = mix(28.0, 16.0, uv.y);
    float iso1 = abs(fract(n1 * freq) - 0.5);
    float iso2 = abs(fract(n2 * (freq * 0.55)) - 0.5);
    float aa = 0.003;
    float linesA = 1.0 - smoothstep(0.010, 0.028 + aa, iso1);
    float linesB = 1.0 - smoothstep(0.020, 0.060, iso2);
    float out_ = max(linesA, linesB * 0.55);
    float brk = smoothstep(0.40, 0.58, fbm(uv * vec2(4.0, 3.0), 3));
    return clamp(out_ * brk, 0.0, 1.0);
  }
  if (mode == 19) {
    // Reference-targeted: narrow isolines with bifurcation via branched fbm
    vec2 q = uv * vec2(2.5, 22.0);
    float n = fbm(q, 5);
    float branchN = fbm(q * 3.0 + n * 5.0, 4);
    float combined = n + branchN * 0.4;
    float freq = mix(28.0, 18.0, pow(uv.y, 0.6));
    float iso = abs(fract(combined * freq) - 0.5);
    float aa = 0.003;
    float lines = 1.0 - smoothstep(0.010, 0.028 + aa, iso);
    // Sparse dark blotches (chromatophore clusters)
    float blot = smoothstep(0.70, 0.82, fbm(uv * vec2(3.5, 3.0), 4));
    return clamp(lines + blot * 0.5, 0.0, 1.0);
  }
  if (mode == 20) {
    vec2 q = uv * vec2(2.2, 18.0);
    float e = 0.01;
    float nA = fbm(q, 5);
    float cx =  (fbm(q + vec2(0, e), 4) - fbm(q - vec2(0, e), 4));
    float cy = -(fbm(q + vec2(e, 0), 4) - fbm(q - vec2(e, 0), 4));
    vec2 flow = normalize(vec2(cx, cy) + 1e-5);
    float along = dot(uv, flow);
    float freq = mix(28.0, 16.0, uv.y);
    float iso = abs(fract((nA + along * 0.5) * freq) - 0.5);
    float lines = 1.0 - smoothstep(0.010, 0.028, iso);
    return clamp(lines, 0.0, 1.0);
  }
  if (mode == 21) {
    // 21 — Strongly anisotropic fbm curl + fingerprint isolines with
    // frequency modulation. Designed to give thinner, denser lines toward
    // the head and long ridged sweeps along the dorsal axis.
    vec2 q = uv * vec2(1.8, 28.0);
    float n = fbm(q, 5);
    float e = 0.01;
    float cx =  (fbm(q + vec2(0, e), 5) - fbm(q - vec2(0, e), 5));
    float cy = -(fbm(q + vec2(e, 0), 5) - fbm(q - vec2(e, 0), 5));
    float along = dot(uv, normalize(vec2(cx, cy) + 1e-5));
    float freq = mix(36.0, 18.0, smoothstep(0.0, 1.0, uv.y));
    float iso = abs(fract((n + along * 0.6) * freq) - 0.5);
    float lines = 1.0 - smoothstep(0.008, 0.022, iso);
    // Second, rarer isolines at 0.5x for bifurcation feel
    float iso2 = abs(fract((n + along * 0.6) * freq * 0.5 + 0.25) - 0.5);
    float lines2 = 1.0 - smoothstep(0.018, 0.045, iso2);
    return clamp(max(lines, lines2 * 0.6), 0.0, 1.0);
  }
  if (mode == 22) {
    // Same strategy as 09 but with stronger blotch contribution.
    vec2 q = uv * vec2(2.2, 24.0);
    float n = fbm(q, 5);
    float blot = fbm(uv * vec2(3.0, 2.8), 4);
    float freq = mix(30.0, 18.0, pow(uv.y, 0.5));
    float iso = abs(fract(n * freq + blot * 0.6) - 0.5);
    float w = fwidth(iso) * 1.2;
    float lines = 1.0 - smoothstep(0.010 - w, 0.028 + w, iso);
    float blotMask = smoothstep(0.70, 0.82, blot);
    float hatch = smoothstep(0.72, 0.84, fbm(uv * vec2(60.0, 30.0), 3));
    return clamp(max(lines, max(blotMask * 0.75, hatch * 0.35)), 0.0, 1.0);
  }
  if (mode == 23) {
    // 09 pattern + overlaid dark blotches blended via max().
    // Closest to the ref's fingerprint-with-chromatophore-clumps look.
    vec2 aniso = vec2(2.6, 26.0);
    float n = fbm(uv * aniso, 5);
    float freqMod = mix(30.0, 18.0, uv.y);
    float iso = abs(fract(n * freqMod) - 0.5);
    float w = fwidth(iso) * 1.2;
    float lines = 1.0 - smoothstep(0.016 - w, 0.030 + w, iso);
    // Large-scale chromatophore blotches
    float bN = fbm(uv * vec2(3.0, 2.6) + 9.2, 4);
    float blot = smoothstep(0.70, 0.80, bN) * 0.85;
    // Tiny dark flecks between lines
    float fleck = smoothstep(0.78, 0.86, fbm(uv * vec2(55.0, 28.0), 3)) * 0.5;
    return clamp(max(max(lines, blot), fleck), 0.0, 1.0);
  }
  if (mode == 24) {
    // Quadratic freqMod — denser lines at head AND tail, sparse in the middle.
    vec2 aniso = vec2(2.4, 28.0);
    float n = fbm(uv * aniso, 5);
    float centerDist = abs(uv.y - 0.5) * 2.0;
    float freq = mix(16.0, 32.0, centerDist * centerDist);
    float iso = abs(fract(n * freq) - 0.5);
    float w = fwidth(iso) * 1.2;
    float lines = 1.0 - smoothstep(0.014 - w, 0.028 + w, iso);
    float blot = smoothstep(0.72, 0.82, fbm(uv * vec2(3.2, 2.8), 3)) * 0.7;
    return clamp(max(lines, blot), 0.0, 1.0);
  }
  if (mode == 25) {
    // Round 6 — post-mask contrast remap smoothstep(0.2, 0.8, v) per critic.
    vec2 aniso = vec2(2.6, 26.0);
    float n = fbm(uv * aniso, 5);
    float freq1 = mix(30.0, 18.0, uv.y);
    float freq2 = freq1 * 0.45;
    float iso1 = abs(fract(n * freq1) - 0.35);
    float iso2 = abs(fract(n * freq2 + 0.25) - 0.35);
    float l1 = 1.0 - smoothstep(0.03, 0.05, iso1);
    float l2 = 1.0 - smoothstep(0.04, 0.06, iso2);
    float blot = smoothstep(0.72, 0.82, fbm(uv * vec2(2.8, 2.4), 3)) * 0.85;
    float raw = max(max(l1, l2 * 0.85), blot);
    // Contrast remap — push mid-tones to extremes
    float z = smoothstep(0.2, 0.8, raw);
    return clamp(z, 0.0, 1.0);
  }
  return 0.0;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  // HIGH CONTRAST — critic round 3: ref has ~10:1 luminance ratio. Cream
  // ground + near-black stripe, no contrast-squeeze multiplier.
  vec3 ground = vec3(0.92, 0.78, 0.60);
  ground *= 0.94 + 0.10 * fbm(uv * 6.0, 3);
  float z = zebra(uv, t, uMode);
  vec3 stripe = vec3(0.06, 0.04, 0.03);
  vec3 col = mix(ground, stripe, z);
  gl_FragColor = vec4(col, 1.0);
}
`;

const grid = document.getElementById('grid');
const mats = [];
for (const v of VARIANTS) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const canvas = document.createElement('canvas');
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.innerHTML = `<b>${v.id}</b> ${v.name}`;
  cell.appendChild(canvas); cell.appendChild(lbl);
  grid.appendChild(cell);

  const W = 540, H = 360;
  canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x0a0b14);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 0.66, -0.66, -1, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment,
    uniforms: { uTime: { value: 0 }, uMode: { value: v.mode } },
    side: THREE.DoubleSide,
    extensions: { derivatives: true },
  });
  mats.push(mat);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.33), mat);
  scene.add(mesh);
  cell._r = { renderer, scene, cam, mat };
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();
  for (const m of mats) m.uniforms.uTime.value = t;
  for (const c of grid.children) c._r.renderer.render(c._r.scene, c._r.cam);
}
loop();
