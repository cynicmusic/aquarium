/**
 * ChromatophoreWorkshop.js — Fullscreen LCD chromatophore texture generator.
 * Plan: /Users/asmith/.claude/plans/chromatophore-workshop.md
 * Reverted to iter_01 state (user preferred this look)
 */

import * as THREE from 'three';

const vertexShader = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */`
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform float uInvert;

// --- Noise utilities ---
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031,.1030,.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash21(vec2 p) {
  // Integer-based hash — avoids sin() precision issues on Adreno GPUs
  vec2 q = fract(p * vec2(123.34, 345.56));
  q += dot(q, q + 34.56);
  return fract(q.x * q.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float snoise(vec2 p) {
  float v = 0.0;
  v += vnoise(p) * 0.5;
  v += vnoise(p * 2.0) * 0.25;
  v += vnoise(p * 4.0) * 0.125;
  return v * 2.0 - 0.875;
}

// --- Voronoi chromatophore sacs ---
vec3 voronoiSacs(vec2 uv, float density, float time) {
  vec2 id = floor(uv * density);
  vec2 fd = fract(uv * density);

  float minDist = 10.0;
  float secondDist = 10.0;
  float cellId = 0.0;

  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellPos = id + neighbor;
      vec2 point = hash22(cellPos);
      float cellHash = hash21(cellPos + 0.5);

      // Constant inner jiggle — each sac always gently alive
      point += 0.05 * vec2(
        sin(time * 0.4 + cellHash * 30.0),
        cos(time * 0.35 + cellHash * 25.0)
      );

      // Wave-driven kick — use noise at cell position as proxy for wave arrival
      // (avoids needing to call expansionWave inside the loop)
      float waveProxy = sin(
        (cellPos.x + cellPos.y) * 0.3 + time * 0.15
        + sin(time * 0.08 + cellHash * 5.0) * 2.0
      );
      float kickStrength = max(waveProxy, 0.0);  // only kick on positive wave
      kickStrength *= kickStrength;  // sharpen

      // Damped spring: kick outward, overshoot, bounce back, settle
      float springPhase = time * 2.0 + cellHash * 40.0;
      float spring = sin(springPhase) * exp(-fract(springPhase / 6.28) * 2.0);

      float kickAngle = cellHash * 6.28 + waveProxy * 1.5;
      point += kickStrength * spring * 0.1 * vec2(cos(kickAngle), sin(kickAngle));

      vec2 diff = neighbor + point - fd;
      float dist = length(diff);

      if (dist < minDist) {
        secondDist = minDist;
        minDist = dist;
        cellId = hash21(cellPos);
      } else if (dist < secondDist) {
        secondDist = dist;
      }
    }
  }

  float edgeDist = secondDist - minDist;
  return vec3(minDist, cellId, edgeDist);
}

// --- Traveling expansion waves ---
float expansionWave(vec2 uv, float time) {
  float wave = 0.0;

  float d1 = length(uv - vec2(0.5, 0.5));
  wave += 0.4 * sin(d1 * 8.0 - time * 0.6);

  wave += 0.3 * sin(uv.x * 4.0 + uv.y * 3.0 - time * 0.8);

  float n = snoise(uv * 3.0 + time * 0.15);
  wave += 0.3 * sin(n * 6.28 + time * 0.5);

  return wave * 0.5 + 0.5;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  vec2 aspUv = vec2(uv.x * aspect, uv.y);

  float time = uTime;

  float expansion = expansionWave(uv, time);

  // === LAYER 3: Leucophore base ===
  vec3 leucoBase = vec3(0.85, 0.82, 0.78);
  leucoBase += 0.05 * snoise(aspUv * 20.0);

  // === LAYER 2: Iridophore shimmer ===
  // Continuous irregular modulation — multiple incommensurate frequencies
  // so there's never an obvious "burst then calm" cycle
  float mod1 = sin(time * 0.155 + sin(time * 0.065) * 0.8) * 0.06;
  float mod2 = sin(time * 0.235 + sin(time * 0.095) * 0.6) * 0.05;
  float mod3 = sin(time * 0.355) * 0.03;
  float surge = 1.0 + clamp(mod1 + mod2 + mod3, -0.2, 0.15); // max 15% faster

  // Rotating angle — accelerates slightly during surge peaks to mask periodicity
  float angleSpeed = 0.03 + (surge - 1.0) * 0.25;
  float angle = time * angleSpeed + 0.4 * sin(time * 0.045) + 0.2 * sin(time * 0.085);
  float dirX = cos(angle) * 4.0;
  float dirY = sin(angle) * 3.0;
  float iridPhase = uv.x * dirX + uv.y * dirY + time * 0.15 * surge;
  vec3 iridColor = vec3(
    0.3 + 0.3 * sin(iridPhase),
    0.4 + 0.3 * sin(iridPhase + 2.094),
    0.5 + 0.3 * sin(iridPhase + 4.189)
  );
  float iridIntensity = 0.4;

  // === LAYER 1: Chromatophore sacs ===
  float density = 46.0;
  vec3 vor = voronoiSacs(aspUv, density, time);
  float dist = vor.x;
  float cellId = vor.y;
  float edgeDist = vor.z;

  float sacPhase = cellId * 6.28;
  float sacPulse = sin(time * 1.2 + sacPhase) * 0.3;
  float sacExpand = clamp(expansion + sacPulse, 0.0, 1.0);

  float sacRadius = mix(0.1, 0.42, sacExpand);
  float sacMask = smoothstep(sacRadius + 0.04, sacRadius - 0.04, dist);

  vec3 pigment1 = vec3(0.75, 0.15, 0.05);
  vec3 pigment2 = vec3(0.85, 0.55, 0.05);
  vec3 pigment3 = vec3(0.35, 0.08, 0.02);

  vec3 sacColor;
  if (cellId < 0.33) sacColor = pigment1;
  else if (cellId < 0.66) sacColor = pigment2;
  else sacColor = pigment3;

  float sacIntensity = sacMask * (1.0 - dist / sacRadius * 0.4);
  sacIntensity = clamp(sacIntensity, 0.0, 1.0);

  // === LAYER 0: Second chromatophore layer — opposite phase, bigger, cyan/blue ===
  float density2 = density * 0.65;  // fewer, larger sacs
  vec3 vor2 = voronoiSacs(aspUv + 0.37, density2, time * 0.8);  // offset grid so they don't overlap
  float dist2 = vor2.x;
  float cellId2 = vor2.y;
  float edgeDist2 = vor2.z;

  // Opposite expansion — expands where primary contracts
  float sacExpand2 = clamp(1.0 - expansion + sin(time * 0.9 + cellId2 * 6.28) * 0.2, 0.0, 1.0);
  float sacRadius2 = mix(0.06, 0.55, sacExpand2);  // 50% bigger max
  float sacMask2 = smoothstep(sacRadius2 + 0.05, sacRadius2 - 0.03, dist2);

  // Cyan/blue pigments (will appear red/warm when inverted)
  vec3 pigment2a = vec3(0.05, 0.55, 0.75);  // teal
  vec3 pigment2b = vec3(0.1, 0.35, 0.85);   // blue
  vec3 pigment2c = vec3(0.02, 0.25, 0.5);   // deep blue
  vec3 sacColor2;
  if (cellId2 < 0.33) sacColor2 = pigment2a;
  else if (cellId2 < 0.66) sacColor2 = pigment2b;
  else sacColor2 = pigment2c;

  float sacIntensity2 = sacMask2 * (1.0 - dist2 / max(sacRadius2, 0.01) * 0.3);
  sacIntensity2 = clamp(sacIntensity2, 0.0, 1.0);

  // === COMPOSITE ===
  vec3 color = leucoBase;
  color = mix(color, iridColor, iridIntensity * (1.0 - sacMask * 0.8));

  // Primary chromatophores
  color = mix(color, sacColor, sacIntensity * 0.92);

  // Second layer — screen blend so it adds luminosity without obliterating
  vec3 layer2 = sacColor2 * sacIntensity2;
  color = 1.0 - (1.0 - color) * (1.0 - layer2 * 0.7);  // screen blend

  float border = smoothstep(0.02, 0.06, edgeDist);
  color *= mix(0.7, 1.0, border);

  // Wave-driven darkening — deeper patches when wave passes
  float darkPulse = 1.0 - expansion * 0.45;
  color *= mix(0.95, 0.95 * darkPulse, smoothstep(0.2, 0.7, expansion));

  // Overall darker, push toward purple in lighter areas (pre-invert)
  // Purple pre-invert = green/yellow post-invert... but we want purple POST-invert
  // So push lighter pre-invert areas toward green/yellow (which inverts to purple)
  float brightness = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 purpleTint = vec3(0.15, 0.35, 0.1);  // green-yellow pre-invert → purple post-invert
  color = mix(color, color * purpleTint * 3.0, brightness * 0.3);

  // Crush overall luminosity
  color *= 0.75;

  // Invert toggle
  color = mix(color, 1.0 - color, uInvert);

  gl_FragColor = vec4(color, 1.0);
}
`;

// --- Setup ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uInvert: { value: 0.0 },
};

// Toggle invert on label click
const label = document.getElementById('label');
if (label) {
  label.addEventListener('click', () => {
    uniforms.uInvert.value = uniforms.uInvert.value > 0.5 ? 0.0 : 1.0;
    label.textContent = uniforms.uInvert.value > 0.5 ? '[INVERTED]' : '[NORMAL]';
  });
}

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
});

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(quad);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  uniforms.uTime.value = clock.getElapsedTime() * 0.5;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

animate();
