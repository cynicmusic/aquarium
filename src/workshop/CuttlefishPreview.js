/**
 * CuttlefishPreview.js — interactive preview with live skin-shader animation.
 *
 * Geometry-changing sliders trigger a rebuild; shader-uniform sliders push
 * directly into the live material so the animation keeps running without jitter.
 */

import * as THREE from 'three';
import { createCuttlefish, updateCuttlefish } from '../entities/Cuttlefish.js';
import { SwimWorld } from '../swim/SwimWorld.js';

// sliderId → { type: 'geom'|'uniform'|'anim', scale(v)=>value, uniformName? }
const CONTROLS = {
  // ── Geometry — trigger rebuild ───────────────────────────────────────
  mantleLength:       { kind: 'geom', scale: v => v / 100 },
  mantleRadius:       { kind: 'geom', scale: v => v / 100 },
  mantleHeight:       { kind: 'geom', scale: v => v / 100 },
  mantleTaper:        { kind: 'geom', scale: v => v / 100 },
  mantleShoulderBoost:{ kind: 'geom', scale: v => v / 100 },
  mantleFrontBoost:   { kind: 'geom', scale: v => v / 100 },

  // Head — spline-lofted side profile
  headLength:         { kind: 'geom', scale: v => v / 100 },
  headTiltDown:       { kind: 'geom', scale: v => v / 100 },
  headRecess:         { kind: 'geom', scale: v => v / 100 },
  headBaseY:          { kind: 'geom', scale: v => v / 100 },
  headMouthY:         { kind: 'geom', scale: v => v / 100 },
  headBackR:          { kind: 'geom', scale: v => v / 100 },
  headBackH:          { kind: 'geom', scale: v => v / 100 },
  headForeheadR:      { kind: 'geom', scale: v => v / 100 },
  headForeheadH:      { kind: 'geom', scale: v => v / 100 },
  headEyeR:           { kind: 'geom', scale: v => v / 100 },
  headEyeH:           { kind: 'geom', scale: v => v / 100 },
  headCheekR:         { kind: 'geom', scale: v => v / 100 },
  headCheekH:         { kind: 'geom', scale: v => v / 100 },
  headMouthR:         { kind: 'geom', scale: v => v / 100 },

  // Eye & pupil — geometry-driven (rebuild on change)
  eyeRadius:          { kind: 'geom', scale: v => v / 100 },
  eyeStation:         { kind: 'geom', scale: v => v / 100 },
  eyeRiseY:           { kind: 'geom', scale: v => v / 100 },
  eyeLateralPad:      { kind: 'geom', scale: v => v / 1000 },
  eyeTiltUp:          { kind: 'geom', scale: v => v / 100 },
  eyeForwardYaw:      { kind: 'geom', scale: v => v / 100 },
  eyeSpread:          { kind: 'geom', scale: v => v / 100 },
  pupilScaleW:        { kind: 'geom', scale: v => v / 100 },
  pupilScaleH:        { kind: 'geom', scale: v => v / 100 },

  // Fins
  finWidth:           { kind: 'geom', scale: v => v / 100 },
  finRipples:         { kind: 'geom', scale: v => v },
  finRippleAmp:       { kind: 'geom', scale: v => v / 1000 },
  finExtend:          { kind: 'geom', scale: v => v / 100 },
  finBumpFreq:        { kind: 'geom', scale: v => v / 10 },
  finBumpAmp:         { kind: 'geom', scale: v => v / 100 },
  finLateralAmp:      { kind: 'geom', scale: v => v / 100 },

  // Arms & crown
  armLength:          { kind: 'geom', scale: v => v / 100 },
  armCurl:            { kind: 'geom', scale: v => v / 100 },
  armBaseRadius:      { kind: 'geom', scale: v => v / 1000 },
  armCrownRadius:     { kind: 'geom', scale: v => v / 100 },
  armDropScale:       { kind: 'geom', scale: v => v / 100 },
  armGravity:         { kind: 'geom', scale: v => v / 100 },

  // Tentacles
  tentacleLength:     { kind: 'geom', scale: v => v / 100 },
  tentacleExtension:  { kind: 'geom', scale: v => v / 100 },
  tentacleClubRadius: { kind: 'geom', scale: v => v / 1000 },
  tentacleBaseRadius: { kind: 'geom', scale: v => v / 1000 },
  tentacleTipRadius:  { kind: 'geom', scale: v => v / 1000 },
  tentacleDrop:       { kind: 'geom', scale: v => v / 100 },
  hideTentacles:      { kind: 'geom', scale: v => !!v, boolean: true },

  // ── Shader uniforms — push directly (no rebuild) ─────────────────────
  chromaDensity:      { kind: 'uniform', scale: v => v,        uniform: 'uChromaDensity' },
  chromaIntensity:    { kind: 'uniform', scale: v => v / 100,  uniform: 'uChromaIntensity' },
  iridoIntensity:     { kind: 'uniform', scale: v => v / 100,  uniform: 'uIridoIntensity' },
  iridoHueRange:      { kind: 'uniform', scale: v => v / 100,  uniform: 'uIridoHueRange' },
  zebraIntensity:     { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraIntensity' },
  zebraFrequency:     { kind: 'uniform', scale: v => v,        uniform: 'uZebraFrequency' },
  zebraSharpness:     { kind: 'uniform', scale: v => v / 10,   uniform: 'uZebraSharpness' },
  zebraScaleX:        { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraScaleX' },
  zebraScaleY:        { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraScaleY' },
  zebraOffsetX:       { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraOffsetX' },
  zebraOffsetY:       { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraOffsetY' },
  zebraRotation:      { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraRotation' },
  zebraGateLo:        { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraGateLo' },
  zebraGateHi:        { kind: 'uniform', scale: v => v / 100,  uniform: 'uZebraGateHi' },

  // ── Animation (loop reads live) ──────────────────────────────────────
  animSpeed:          { kind: 'anim', scale: v => v / 100 },
  rotSpeed:           { kind: 'anim', scale: v => v / 100 },
};

const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(view.clientWidth, view.clientHeight);
renderer.setClearColor(0x060810);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, view.clientWidth / view.clientHeight, 0.05, 60);
camera.position.set(6.0, 1.8, 7.0);       // zoomed way out — see the whole animal
camera.lookAt(0, 0, 0);

// Scroll-wheel zoom. In turntable (non-swim) mode it walks the camera along
// the view axis. In swim mode it instead tweaks a persistent `swimZoom`
// multiplier that scales every swim-cam's radius — so the user can dial in a
// preferred "distance" and it survives autocam cuts + cam switches.
const _zoomPivot = new THREE.Vector3(0, 0, 0);
let swimZoom = 1.0;
renderer.domElement.addEventListener('wheel', (e) => {
  if (swimMode) {
    // deltaY > 0 = scroll down = zoom out → increase multiplier
    swimZoom *= Math.pow(1.0015, e.deltaY);
    swimZoom = Math.max(0.55, Math.min(3.5, swimZoom));
    return;
  }
  const dir = camera.position.clone().sub(_zoomPivot).normalize();
  camera.position.addScaledVector(dir, e.deltaY * 0.008);
  const dist = camera.position.distanceTo(_zoomPivot);
  if (dist < 1.2) camera.position.copy(_zoomPivot).addScaledVector(dir, 1.2);
  if (dist > 30)  camera.position.copy(_zoomPivot).addScaledVector(dir, 30);
  camera.lookAt(_zoomPivot);
}, { passive: true });

scene.add(new THREE.AmbientLight(0x334466, 0.8));
const key = new THREE.DirectionalLight(0xffeedd, 1.4);
key.position.set(3, 5, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0x6688bb, 0.9);
rim.position.set(-4, 2, -3); scene.add(rim);
const fill = new THREE.PointLight(0xff88aa, 0.8, 10);
fill.position.set(0, -1.5, 2); scene.add(fill);

// ── Seafloor with caustic shimmer ─────────────────────────────────────
// Large plane with a procedural caustic pattern animated in the shader so the
// ground reads like the main aquarium floor. Pushed well below the cuttlefish
// so drooping tentacles don't clip.
const floorMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:  { value: 0 },
    uSand:  { value: new THREE.Color(0.28, 0.24, 0.18) },
    uDeep:  { value: new THREE.Color(0.10, 0.04, 0.18) },  // dark purple to match swim-mode fog
    uCaust: { value: new THREE.Color(0.90, 0.95, 1.20) },
    uCamPos:{ value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */`
    varying vec3 vWorldPos;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uTime;
    uniform vec3 uSand;
    uniform vec3 uDeep;
    uniform vec3 uCaust;
    uniform vec3 uCamPos;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    // Hash / noise helpers
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      float a = hash(i), b = hash(i + vec2(1,0));
      float c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0, amp = 0.5;
      for (int i = 0; i < 5; i++) { v += amp * vn(p); p *= 2.02; amp *= 0.5; }
      return v;
    }

    // Voronoi-esque caustic lines — product of two shifting sine fields,
    // sharpened with a power curve so the bright spots pop.
    float caustic(vec2 p, float t) {
      float c1 = 0.0, c2 = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        c1 += sin(p.x * (1.0 + fi * 0.7) + t * (0.25 + fi * 0.12));
        c2 += cos(p.y * (1.0 + fi * 0.6) + t * (0.30 + fi * 0.10));
      }
      float v = (c1 * c2) * 0.15 + 0.5;
      v = pow(max(0.0, v), 4.0) * 2.2;
      return v;
    }

    void main() {
      vec2 wp = vWorldPos.xz;
      float grain = fbm(wp * 1.4) * 0.20;
      vec3 sand = mix(uDeep, uSand, 0.55 + grain);

      // Caustic light dance — two scales for richness
      float c = caustic(wp * 0.85, uTime);
      float c2 = caustic(wp * 1.7 + 7.3, uTime * 1.3) * 0.55;
      float caus = clamp(c + c2, 0.0, 3.0);

      vec3 col = sand + uCaust * caus * 0.35;

      // Distance fade — plane tapers into the black background
      float dist = length(vWorldPos - uCamPos);
      float fog = smoothstep(12.0, 45.0, dist);
      col = mix(col, uDeep, fog);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80, 1, 1),
  floorMat
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.3;    // lower so droopy tentacles don't clip
scene.add(floor);

// init params from slider defaults
const params = {};
for (const id of Object.keys(CONTROLS)) {
  const el = document.getElementById(id);
  if (!el) continue;
  if (CONTROLS[id].boolean) params[id] = el.checked;
  else params[id] = CONTROLS[id].scale(+el.value);
}
params.rotSpeed ??= 0.3;
params.animSpeed ??= 1.0;

let cuttle = createCuttlefish(params);
scene.add(cuttle);
// Push HTML-default uniform values (zebra transforms etc.) onto the material
// since createCuttlefish only forwards a subset to the chromatophore shader.
syncAllUniforms();

// Dev: press D to toggle zebra-mask debug rendering (show only mask grayscale)
// Keys 1-8: switch swim-cam variant WITHOUT disabling autocam — you can
// preview a specific angle then let autocam resume on its next tick.
window.addEventListener('keydown', (e) => {
  // Ignore when typing into inputs/selects (sliders are OK — no text focus)
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' && e.target.type === 'text') return;
  if (tag === 'TEXTAREA') return;

  if (e.key.toLowerCase() === 'd') {
    cuttle.traverse(o => {
      if (o.material && o.material.uniforms && o.material.uniforms.uDebugZebra) {
        o.material.uniforms.uDebugZebra.value = o.material.uniforms.uDebugZebra.value > 0.5 ? 0 : 1;
      }
    });
    return;
  }
  if (/^[1-8]$/.test(e.key)) {
    const n = parseInt(e.key, 10);
    // setCamVariant alone does NOT touch autocamMode — only the mouse-click
    // handler turns AC off. Keyboard keeps AC running.
    setCamVariant(n);
  }
});

function findMantleMaterial() {
  for (const c of cuttle.children) {
    if (c.userData.role === 'mantle') return c.material;
  }
  return null;
}

function rebuild() {
  scene.remove(cuttle);
  cuttle.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.dispose) o.material.dispose();
  });
  cuttle = createCuttlefish(params);
  scene.add(cuttle);
  syncAllUniforms();
}

// Push every uniform-kind param to the freshly-built mantle material.
// Cuttlefish.js only forwards a subset (zebraIntensity/zebraFrequency) to
// createChromatophoreMaterial — the rest (zebraScaleX/Y, zebraRotation,
// zebraSharpness, zebraGate*) default to the material's own fallbacks. Paste
// JSON works because it calls setUniform for every control; initial load did
// not. This closes that gap.
function syncAllUniforms() {
  for (const [id, cfg] of Object.entries(CONTROLS)) {
    if (cfg.kind === 'uniform' && id in params) {
      setUniform(cfg.uniform, params[id]);
    }
  }
}

// One-shot cleanup: nuke any stale param caches from previous deploys so
// reloads can never resurrect old tweaks. The preview is stateless — HTML
// slider defaults are the canonical source of truth; Copy/Paste JSON is the
// only way to move params in/out.
try {
  localStorage.removeItem('cuttle.preview.params.v1');
  localStorage.removeItem('cuttle.preview.params');
} catch {}

function setUniform(name, value) {
  const mat = findMantleMaterial();
  if (!mat || !mat.uniforms || !mat.uniforms[name]) return;
  if (mat.uniforms[name].value instanceof THREE.Color) mat.uniforms[name].value.set(value);
  else mat.uniforms[name].value = value;
}

document.querySelectorAll('input[type=checkbox]').forEach(el => {
  el.addEventListener('change', () => {
    const id = el.id;
    const cfg = CONTROLS[id];
    if (!cfg) return;
    params[id] = el.checked;
    if (cfg.kind === 'geom') rebuild();
  });
});
document.querySelectorAll('input[type=range]').forEach(el => {
  el.addEventListener('input', () => {
    const id = el.id;
    const cfg = CONTROLS[id];
    if (!cfg) return;
    const v = cfg.scale(+el.value);
    params[id] = v;
    const vSpan = el.parentElement.querySelector('.v');
    if (vSpan) {
      if (typeof v === 'number') {
        vSpan.textContent = v < 1 ? v.toFixed(2) : (v < 10 ? v.toFixed(2) : String(Math.round(v)));
      } else {
        vSpan.textContent = v;
      }
    }
    if (cfg.kind === 'geom') rebuild();
    else if (cfg.kind === 'uniform') setUniform(cfg.uniform, v);
  });
});

const initYaw   = 0.3;
const initPitch = 0.2;
const autoRotate = true;

// Inverse-scale helper — given a scaled param value, find the raw slider
// integer that produces it. Works for the v/N linear forms used here.
function _invertScale(cfg, v) {
  const guesses = [v * 100, v * 1000, v * 10, v];
  for (const g of guesses) {
    const r = Math.round(g);
    if (Math.abs(cfg.scale(r) - v) < 1e-6) return r;
  }
  return guesses[0];
}

// Apply a params object into the UI: updates slider positions, value-spans,
// rebuilds geometry, pushes uniforms. Used by Paste JSON.
function applyParamsToUI(obj, { rebuildOnChange = true } = {}) {
  Object.assign(params, obj);
  for (const [id, cfg] of Object.entries(CONTROLS)) {
    if (!(id in obj)) continue;
    const el = document.getElementById(id);
    if (!el) continue;
    if (cfg.boolean) { el.checked = !!obj[id]; continue; }
    const v = obj[id];
    el.value = _invertScale(cfg, v);
    const vSpan = el.parentElement && el.parentElement.querySelector('.v');
    if (vSpan) {
      if (typeof v === 'number') vSpan.textContent = v < 1 ? v.toFixed(2) : (v < 10 ? v.toFixed(2) : String(Math.round(v)));
      else vSpan.textContent = v;
    }
  }
  if (rebuildOnChange) rebuild();
  for (const [id, cfg] of Object.entries(CONTROLS)) {
    if (cfg.kind === 'uniform' && id in obj) setUniform(cfg.uniform, obj[id]);
  }
}

// Copy / Paste JSON params — lets the user tweak sliders and hand the
// resulting param stack back to Claude for the next evolutionary round.
const copyBtn  = document.getElementById('copyJson');
const pasteBtn = document.getElementById('pasteJson');
const copyNote = document.getElementById('copyNote');
function flash(msg, ms = 1800) {
  if (!copyNote) return;
  copyNote.textContent = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => (copyNote.textContent = ''), ms);
}
if (copyBtn) copyBtn.addEventListener('click', async () => {
  // Snapshot current params, strip the anim-only sliders (they're session state).
  const out = {};
  for (const k of Object.keys(params)) {
    if (k === 'animSpeed' || k === 'rotSpeed') continue;
    out[k] = params[k];
  }
  const txt = JSON.stringify(out, null, 2);
  try {
    await navigator.clipboard.writeText(txt);
    flash(`✓ copied ${Object.keys(out).length} params to clipboard`);
  } catch (e) {
    // Fallback — select into a textarea so the user can Cmd+C manually
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); flash(`✓ copied ${Object.keys(out).length} params`); }
    catch { flash('✗ copy failed — check console', 3000); console.log(txt); }
    document.body.removeChild(ta);
  }
});
if (pasteBtn) pasteBtn.addEventListener('click', async () => {
  let raw;
  try { raw = await navigator.clipboard.readText(); }
  catch { raw = window.prompt('Paste params JSON:') || ''; }
  if (!raw) return;
  let obj;
  try { obj = JSON.parse(raw); }
  catch { flash('✗ invalid JSON', 2500); return; }
  applyParamsToUI(obj);
  flash(`✓ pasted ${Object.keys(obj).length} params — rebuilt`);
});

// ── Swim mode ────────────────────────────────────────────────────────────
// Cuttle's nose points along its local -x (headPivot is at -mantleLength/2).
// During swim we translate cuttle in world -x and park the camera in the
// hemisphere *behind* its nose direction. The camera drifts on two axes
// (azimuth around the spine, elevation above) via two non-harmonic sines so
// its path is a slow Lissajous — no abrupt direction reversals, never crosses
// in front of the face. Four presets pick different behind-hemisphere poses.
let swimMode = false;
let swimCam = 7;                               // 1..8 variant; 7 is the default best profile
const swimState = { x: 0, y: 0, phase: 0 };
const _savedCam = new THREE.Vector3();
let _savedYaw = 0, _savedAutoYaw = 0;
// SwimWorld lazy-instantiated on first swim-on; keeps preview cheap when
// the user is just tuning the cuttlefish.
let swimWorld = null;

// Camera variants: each defines a base pose in (radius, azimuth°, elevation°)
// relative to the cuttle's *backward* direction (+x world, since nose is -x),
// plus per-axis wobble amplitudes and the lookAt offset ahead of cuttle.
const CAM_VARIANTS = {
  // lookAhead semantics: camera.lookAt(cuttle.x - v.lookAhead, ...). Positive
  // biases the aim toward the head (−x world), negative toward the tail (+x).
  // Per user: most shots should NOT be head-centric. Default lookAhead is
  // small positive (cuttle-centered-ish) or negative (tail).
  1: { // over-the-shoulder chase — side-behind-above (reference image)
    r: 4.2, azim: 38, elev: 22,
    rWob: 0.3, azimWob: 12, elevWob: 6,
    lookAhead: 0.3, lookY: 0.1,
  },
  2: { // high chase — more top-down
    r: 4.6, azim: 20, elev: 45,
    rWob: 0.3, azimWob: 16, elevWob: 5,
    lookAhead: 0.2, lookY: -0.1,
  },
  3: { // low belly — near water level, slight side
    r: 4.4, azim: 30, elev: 6,
    rWob: 0.3, azimWob: 14, elevWob: 4,
    lookAhead: 0.35, lookY: 0.15,
  },
  4: { // right-side tail shot — over cuttle's right shoulder, framed on tail
    r: 4.3, azim: 82, elev: 13,
    rWob: 0.28, azimWob: 6, elevWob: 4,
    lookAhead: -0.9, lookY: 0.08,
  },
  // Pulled-back variants — 1/2/3 step back 10-30%.
  // Wobble amplitudes bumped slightly with radius so the further-out cams
  // still feel alive (small pixel deltas at far distances).
  5: { // chase + 12% (variation of 1)
    r: 4.7, azim: 42, elev: 24,
    rWob: 0.35, azimWob: 12, elevWob: 6,
    lookAhead: 0.4, lookY: 0.12,
  },
  6: { // high chase + 15% (variation of 2)
    r: 5.3, azim: 22, elev: 46,
    rWob: 0.4, azimWob: 16, elevWob: 5,
    lookAhead: 0.25, lookY: -0.1,
  },
  7: { // low belly + 30% — far chase low (variation of 3)
    r: 5.7, azim: 28, elev: 9,
    rWob: 0.4, azimWob: 14, elevWob: 4,
    lookAhead: 0.5, lookY: 0.18,
  },
  8: { // right-side tail shot — slightly pulled back but tighter on tail
    r: 4.9, azim: 78, elev: 15,
    rWob: 0.30, azimWob: 7, elevWob: 5,
    lookAhead: -1.1, lookY: 0.10,
  },
};
const CAM_COUNT = 8;

function applySwimCamera(elapsed) {
  const v = CAM_VARIANTS[swimCam] || CAM_VARIANTS[1];
  // Two non-harmonic slow phases so rotation never loops back through itself.
  const pA = elapsed * 0.067;
  const pB = elapsed * 0.094;
  const pC = elapsed * 0.041;
  const azimDeg = v.azim + Math.sin(pA) * v.azimWob;
  const elevDeg = v.elev + Math.sin(pB) * v.elevWob;
  const r       = (v.r   + Math.sin(pC) * v.rWob) * swimZoom;
  const azim = azimDeg * Math.PI / 180;
  const elev = elevDeg * Math.PI / 180;

  // Build offset from cuttle. Backward direction is +x (cuttle faces -x).
  // Spherical coords: start at +x*r, rotate azim around world-up, then pitch
  // up by elev around the horizontal axis perpendicular to the resulting
  // horizontal direction.
  const horiz = new THREE.Vector3(Math.cos(azim) * r, 0, Math.sin(azim) * r);
  const side  = new THREE.Vector3(0, 1, 0).cross(horiz).normalize();
  const offset = horiz.clone().applyAxisAngle(side, -elev);

  camera.position.set(
    cuttle.position.x + offset.x,
    cuttle.position.y + offset.y,
    cuttle.position.z + offset.z,
  );
  // Look slightly ahead of the cuttle (in its forward direction, -x)
  camera.lookAt(
    cuttle.position.x - v.lookAhead,
    cuttle.position.y + v.lookY,
    cuttle.position.z,
  );
}

function setCamVariant(n) {
  swimCam = n;
  for (let i = 1; i <= CAM_COUNT; i++) {
    const b = document.getElementById('cam' + i);
    if (b) b.classList.toggle('active', i === n);
  }
  if (swimMode) flash(`🎥 camera ${n}`, 900);
}

document.getElementById('swimBtn').addEventListener('click', (e) => {
  swimMode = !swimMode;
  e.currentTarget.classList.toggle('active', swimMode);
  if (swimMode) {
    _savedCam.copy(camera.position);
    _savedYaw = yaw; _savedAutoYaw = autoYaw;
    swimState.x = 0; swimState.y = 0; swimState.phase = 0;
    setCamVariant(swimCam);
    if (!swimWorld) swimWorld = new SwimWorld(scene, cuttle, { floorY: -2.3 });
    swimWorld.spawn();
  } else {
    camera.position.copy(_savedCam);
    yaw = _savedYaw; autoYaw = _savedAutoYaw;
    cuttle.position.set(0, 0, 0);
    cuttle.rotation.z = 0;
    floor.position.set(0, -2.3, 0);
    if (swimWorld) swimWorld.dispose();
    if (autocamMode) {
      autocamMode = false;
      document.getElementById('camAuto')?.classList.remove('active');
    }
  }
  flash(swimMode ? '🏊 swim mode — chase cam' : '🏊 swim mode off', 1500);
});
for (let i = 1; i <= CAM_COUNT; i++) {
  const btn = document.getElementById('cam' + i);
  if (btn) btn.addEventListener('click', () => {
    autocamMode = false;
    document.getElementById('camAuto')?.classList.remove('active');
    setCamVariant(i);
  });
}
// initial highlight
setCamVariant(swimCam);

// ── Autocam: cycle through variants with a naturally-varying cadence ─────
// Mean ~15s but the distribution is bimodal. A slow drifting "tempo" (period
// ~2 min) controls whether intervals currently favor tight cuts (2-8s, like
// a few angles inside 10s) or long holds (up to ~3 min). No hard rule — it
// reads as random edits without visible pattern.
let autocamMode = false;
let autocamNextAt = 0;

// ── Autocam boot ─────────────────────────────────────────────────────────
// On first AC activation, run a 30-second intro that holds on cam 7 (the
// "best profile") with at most two swaps to cam 1 mixed in. After the boot
// window, release to the normal bimodal-tempo logic. Manual key/button picks
// abort the boot early.
const AUTOCAM_BOOT_WINDOW = 30;
let _autocamEverBooted = false;
let autocamBootPlan = null;        // [{at: seconds, cam: n}, …]
let autocamBootEndAt = -1;
let autocamBootLastCam = null;

function armAutocamBoot(startElapsed) {
  // 0, 1, or 2 swaps. Segments ≥ 8s so each angle is long enough to read.
  const swaps = Math.floor(Math.random() * 3);
  const plan = [{ at: startElapsed, cam: 7 }];
  let cursor = startElapsed;
  let cur = 7;
  const endAt = startElapsed + AUTOCAM_BOOT_WINDOW;
  for (let i = 0; i < swaps; i++) {
    const remaining = endAt - cursor;
    if (remaining < 12) break;       // not enough room for another segment
    const segLen = 8 + Math.random() * Math.min(remaining - 4, 14);
    cursor += segLen;
    cur = cur === 7 ? 1 : 7;
    plan.push({ at: cursor, cam: cur });
  }
  autocamBootPlan = plan;
  autocamBootEndAt = endAt;
  autocamBootLastCam = 7;
  setCamVariant(7);
}

function pickAutocamDelay(elapsed) {
  // Tempo oscillates slowly between "short" and "long" regimes.
  const tempo = 0.5 + 0.5 * Math.sin(elapsed * 0.008 + 1.3);
  // mean interval: 30s at low tempo, 5s at high tempo
  const mean = 30 - tempo * 25;
  let delay = mean * (0.4 + Math.random() * 1.4);
  // rare long hold — ~6% of picks stretch to 60-180s regardless of tempo
  if (Math.random() < 0.06) delay = 60 + Math.random() * 120;
  return Math.max(2.0, Math.min(180, delay));
}

function autocamTick(elapsed) {
  if (!autocamMode || !swimMode) return;

  if (autocamBootPlan) {
    // If the user manually picked a different cam since our last apply,
    // treat it as an override and release boot immediately.
    if (autocamBootLastCam !== null && swimCam !== autocamBootLastCam) {
      autocamBootPlan = null;
      autocamNextAt = elapsed + pickAutocamDelay(elapsed);
      return;
    }
    // Apply the latest scheduled step whose `at` has elapsed.
    let target = null;
    for (const step of autocamBootPlan) {
      if (elapsed >= step.at) target = step; else break;
    }
    if (target && target.cam !== swimCam) {
      setCamVariant(target.cam);
      autocamBootLastCam = target.cam;
    }
    if (elapsed >= autocamBootEndAt) {
      autocamBootPlan = null;
      autocamNextAt = elapsed + pickAutocamDelay(elapsed);
    }
    return;
  }

  if (elapsed < autocamNextAt) return;
  let next = swimCam;
  while (next === swimCam) next = 1 + Math.floor(Math.random() * CAM_COUNT);
  setCamVariant(next);
  autocamNextAt = elapsed + pickAutocamDelay(elapsed);
}

const camAutoBtn = document.getElementById('camAuto');
if (camAutoBtn) camAutoBtn.addEventListener('click', (e) => {
  autocamMode = !autocamMode;
  e.currentTarget.classList.toggle('active', autocamMode);
  if (autocamMode) {
    const elapsed = clock?.getElapsedTime?.() ?? 0;
    // First activation of the session gets the 30s cam-7 boot intro.
    // Subsequent toggles skip boot and start normal bimodal cadence.
    if (!_autocamEverBooted) {
      _autocamEverBooted = true;
      armAutocamBoot(elapsed);
    } else {
      autocamNextAt = elapsed + pickAutocamDelay(elapsed);
    }
    flash('🎥 autocam on', 1200);
  } else {
    autocamBootPlan = null;
    flash('🎥 autocam off', 1000);
  }
});

// Mouse-drag rotate
let dragging = false, lastX = 0, lastY = 0, yaw = initYaw, pitch = initPitch;
renderer.domElement.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => dragging = false);
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  yaw   += (e.clientX - lastX) * 0.01;
  pitch += (e.clientY - lastY) * 0.01;
  pitch = Math.max(-1.2, Math.min(1.2, pitch));
  lastX = e.clientX; lastY = e.clientY;
});

const clock = new THREE.Clock();
let autoYaw = 0.3;
function loop() {
  requestAnimationFrame(loop);
  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  const t = elapsed * params.animSpeed;

  // Drive shader + geometry animation
  updateCuttlefish(cuttle, t);
  if (floorMat && floorMat.uniforms) {
    floorMat.uniforms.uTime.value = t;
    floorMat.uniforms.uCamPos.value.copy(camera.position);
  }

  if (swimMode) {
    // Forward along cuttle's -x (nose). Speed 0.55 u/s feels purposeful.
    swimState.x -= dt * 0.55;
    swimState.y = Math.sin(elapsed * 0.55) * 0.06;
    swimState.phase = Math.sin(elapsed * 0.40) * 0.035;
    cuttle.position.set(swimState.x, swimState.y, 0);
    cuttle.rotation.y = 0;
    cuttle.rotation.x = 0;
    cuttle.rotation.z = swimState.phase;
    applySwimCamera(elapsed);
    autocamTick(elapsed);
    // Infinite floor — follow cuttle in x,z. The caustic shader uses world
    // coords (vWorldPos.xz) so translating the mesh doesn't change the
    // pattern; it just ensures we never run off the 80×80 plane.
    floor.position.x = cuttle.position.x;
    floor.position.z = cuttle.position.z;
    if (swimWorld) swimWorld.update(dt, elapsed);
  } else {
    // Normal rotate-around-origin mode.
    if (autoRotate) autoYaw += dt * params.rotSpeed;
    cuttle.rotation.y = yaw + autoYaw;
    cuttle.rotation.x = pitch * 0.5;
  }
  renderer.render(scene, camera);
}
loop();

// Default: boot straight into swim mode with autocam on. Users tuning the
// cuttlefish can toggle swim off via the button; the preview page is now
// primarily a "watch him swim" view, not a static turntable.
queueMicrotask(() => {
  document.getElementById('swimBtn')?.click();
  document.getElementById('camAuto')?.click();
});

// Params panel — visible by default; one-shot "disable" button removes it
// permanently for the session (no way to bring it back without a reload).
const panelKillEl = document.getElementById('panelKill');
if (panelKillEl) panelKillEl.addEventListener('click', () => {
  const panelEl = document.getElementById('panel');
  if (panelEl) panelEl.remove();
  // Reflow the canvas to reclaim the freed width
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

window.addEventListener('resize', () => {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// Expose for debugging
window.__cuttle = () => cuttle;
window.__mat = () => findMantleMaterial();
