/**
 * Cuttlefish.js — procedural 3D cuttlefish geometry.
 *
 * Parts assembled into a single THREE.Group:
 *   - mantle   : tapered ovoid, rounded front, pointed back
 *   - sideFins : thin undulating ribbons along the full mantle length, both flanks
 *   - head     : small bulge on the front of the mantle (just a continuation)
 *   - eyes     : two large spherical eyes with W-pupil mesh
 *   - arms     : 8 short tapered tubes, curled below the head, individually poseable
 *   - tentacles: 2 long thin tubes with clubbed tips (the hunting pair)
 *
 * Animation is driven by updateCuttlefish(group, t, params):
 *   - sideFin ripple  (vertex displacement via a stored "finPhase" attribute)
 *   - arm sway        (rotate each arm root slightly)
 *   - tentacle extend (animate a control point along its spine)
 */

import * as THREE from 'three';
import { createChromatophoreMaterial } from '../shaders/ChromatophoreMaterial.js';

const DEFAULTS = {
  // Mantle — FLATTENED SHIELD proportions (ref: Sepia)
  mantleLength: 1.6,     // nose→tail, world units
  mantleRadius: 0.42,    // side-to-side (half-width) — WIDER
  mantleHeight: 0.22,    // dorsal→ventral (half-height) — FLATTER
  mantleTaper: 0.55,
  mantleShoulderBoost: 1.0,   // multiplier on rS at the shoulder (t≈0.15–0.35) — >1 pushes paddle
  mantleFrontBoost: 1.0,      // multiplier on rS at t=0..0.10 — >1 widens the mantle nose to match head-back (bridges the neck gap)

  // Fins — wider, longer, undulate on both axes, lumpy outer edge
  finWidth: 0.26,         // BIGGER — wider outer edge
  finRipples: 6,
  finRippleAmp: 0.075,    // stronger wave
  finThickness: 0.012,
  finAttachY: -0.03,
  finExtend: 1.0,         // >1 → extends past mantle ends (0..1 fraction)
  finBumpFreq: 3.4,       // FBM bumps per length (more → more protrusions)
  finBumpAmp: 0.45,        // 0=even skirt, 1=very lumpy wider-in-some-parts
  finLateralAmp: 0.6,      // 0=vertical ripple only, 1=equal horizontal sway

  // Skin shader pass-through (forwarded to the chromatophore material)
  zebraIntensity: 0.85,
  chromaDensity: 52,

  // ── HEAD — spline-driven side-profile (replaced the dropped-in sphere) ──
  // The head is a lofted mesh built from a 5-point side-profile spline so it
  // has a real cuttlefish-shaped silhouette: dorsal arch off the mantle →
  // forehead peak above the eye → cheek taper → mouth point. Horizontal
  // (z-axis) radius is its own curve so the head is wider across the eye
  // station than above the forehead.
  headLength: 0.55,           // length of head mesh along -x from mantle nose
  headBackR: 0.50,            // horizontal half-width where head joins mantle (world units)
  headBackH: 0.22,            // vertical half-height at the mantle joint
  headForeheadR: 0.45,        // horizontal half-width at the forehead peak
  headForeheadH: 0.30,        // forehead peak height (ABOVE head centre)
  headEyeR: 0.50,             // WIDEST horizontal half-width (eye station)
  headEyeH: 0.26,              // vertical half-height at eye station
  headCheekR: 0.32,
  headCheekH: 0.18,
  headMouthR: 0.12,           // tiny rounded tip where the arm crown attaches
  headMouthH: 0.10,
  headTiltDown: 0.18,         // radians — whole head tilts down off the mantle
  headBaseY: 0.20,            // vertical y of the head spline at the mantle joint
  headMouthY: -0.10,          // vertical y at the mouth tip (lower → more downward angle)
  headRecess: 0.0,            // push head BACK into the mantle (+x). 0 = neck sits at mantle nose; 0.2 = head overlaps mantle by 0.2 world units

  // Eyes — mounted on the lofted head, not a sphere centre.
  // `eyeStation` is fractional t along the head spline (0=back, 1=mouth).
  eyeRadius: 0.12,            // bigger so the W-pupil is readable
  eyeStation: 0.40,           // along-head position (0=back, 1=mouth)
  eyeRiseY: 0.50,             // fraction of head half-height above head centre
  eyeSpread: 0.40,            // 0 = on ellipse surface (narrower at high rise), 1 = at equator width (spread wide)
  eyeLateralPad: -0.065,      // more deeply embedded into head surface
  eyeTiltUp: 0.18,
  eyeForwardYaw: 0.30,
  pupilScaleW: 1.35,          // W-pupil width multiplier (bigger → more readable)
  pupilScaleH: 0.75,          // W-pupil height multiplier
  // ── (legacy params retained so older round snapshots still load without crashing)
  headRadiusScale: 1.0, headSquashX: 1.0, headSquashY: 1.0,
  headPosOffsetX: 0.0, headPosScaleY: 1.0,
  eyeOffsetX: 0, eyeOffsetY: 0, eyeOffsetZ: 0, eyeSocketDepth: 0.45,
  eyeForwardX: 0, eyeLateralZ: 0,

  // Arms — radial crown around the mouth. Bigger by default.
  armCount: 8,
  armLength: 0.85,
  armBaseRadius: 0.075,
  armTipRadius: 0.015,
  armCurl: 0.55,
  armSegments: 14,
  armCrownRadius: 0.22,       // WIDER crown so arm roots don't all bunch at the mouth
  armCrownHeightScale: 0.70,  // ellipse vertical squash on the crown ring

  // Tentacles — longer, thinner, bigger club, route inside arm crown when retracted
  tentacleLength: 1.8,
  tentacleBaseRadius: 0.025,
  tentacleTipRadius: 0.006,
  tentacleClubRadius: 0.065,
  tentacleExtension: 0.25,
  tentacleSegments: 22,
  tentacleDrop: 0.35,       // downward arc of tentacle spine
  armGravity: 0.4,          // uniform downward pull on all arm tips (fixes upper-arm splay-up)
};

// ── Per-vertex travelling wave helper for arms/tentacles. ──
// Moves each vertex by (rest + wave) — never accumulates, so no twitch.
// Skips computeVertexNormals (keeps original normals → smooth shading and no jitter).
function _applyTubeWave(mesh, t, phase, amp, freq, radial = 8) {
  const geo = mesh.geometry;
  const rest = geo.getAttribute('rest');
  if (!rest) return;
  const pos = geo.getAttribute('position');
  const side = mesh.userData.waveSide || 1;
  const n = pos.count;
  const ringCount = n / radial;
  const arr = pos.array;
  const restArr = rest.array;
  for (let i = 0; i < n; i++) {
    const ring = Math.floor(i / radial);
    const u = ring / (ringCount - 1);
    const uSq = u * u;
    const wy = Math.sin(u * Math.PI * freq - t * 4 + phase) * amp * uSq;
    const wz = Math.cos(u * Math.PI * freq - t * 4 + phase) * amp * uSq * side;
    const o = i * 3;
    arr[o]     = restArr[o];
    arr[o + 1] = restArr[o + 1] + wy;
    arr[o + 2] = restArr[o + 2] + wz;
  }
  pos.needsUpdate = true;
}

// ── Catmull-Rom helpers for arm/tentacle spines ──

function catmullSpine(ctrl, segments = 16) {
  const curve = new THREE.CatmullRomCurve3(
    ctrl.map(p => new THREE.Vector3(p.x, p.y, p.z)),
    false, 'catmullrom', 0.5
  );
  return curve.getPoints(segments);
}

function buildTube(spinePoints, baseR, tipR, radial = 10, radialFn = null) {
  const N = spinePoints.length;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Frenet-like frame via parallel transport
  let tangents = [];
  for (let i = 0; i < N; i++) {
    const p = spinePoints[i];
    const p1 = spinePoints[Math.min(i + 1, N - 1)];
    const p0 = spinePoints[Math.max(i - 1, 0)];
    const t = new THREE.Vector3().subVectors(p1, p0).normalize();
    tangents.push(t);
  }

  // Normal start — perpendicular to first tangent
  let normal = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tangents[0].dot(normal)) > 0.95) normal.set(1, 0, 0);
  normal.sub(tangents[0].clone().multiplyScalar(tangents[0].dot(normal))).normalize();
  let binormal = new THREE.Vector3().crossVectors(tangents[0], normal).normalize();

  const normals0 = [normal.clone()];
  const binormals0 = [binormal.clone()];
  for (let i = 1; i < N; i++) {
    // Parallel transport: rotate prev normal by the rotation that aligns prev tangent to current
    const prevT = tangents[i - 1];
    const curT = tangents[i];
    const axis = new THREE.Vector3().crossVectors(prevT, curT);
    let nNew = normals0[i - 1].clone();
    if (axis.lengthSq() > 1e-8) {
      const angle = Math.acos(Math.min(1, Math.max(-1, prevT.dot(curT))));
      nNew.applyAxisAngle(axis.normalize(), angle);
    }
    normals0.push(nNew.normalize());
    binormals0.push(new THREE.Vector3().crossVectors(curT, nNew).normalize());
  }

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const baseRadius = THREE.MathUtils.lerp(baseR, tipR, t);
    const radius = radialFn ? radialFn(t, baseRadius) : baseRadius;
    const p = spinePoints[i];
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const n = normals0[i];
      const b = binormals0[i];
      const worldN = new THREE.Vector3(
        n.x * dx + b.x * dy,
        n.y * dx + b.y * dy,
        n.z * dx + b.z * dy
      ).normalize();
      positions.push(p.x + worldN.x * radius, p.y + worldN.y * radius, p.z + worldN.z * radius);
      normals.push(worldN.x, worldN.y, worldN.z);
      uvs.push(j / radial, t);
    }
  }

  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// ── Mantle — spline-lofted organic body ──
// Not a primitive stretched cylinder. Build a proper spine (Catmull-Rom) with
// per-cross-section ellipse dimensions that vary along arc length. Use
// fractional noise to organically perturb the spine + sections so the body
// reads as a soft living creature, not a low-poly primitive.

function buildMantle(p) {
  const LEN_SEG = 64;       // more rings → smoother silhouette
  const RAD_SEG = 32;       // more radial verts → no faceting
  const L = p.mantleLength;
  const R = p.mantleRadius;
  const H = p.mantleHeight;

  // Stout cuttlefish with ARCHED back — dorsal y values rise into a proper
  // hump at the head-mantle junction, matching the reference silhouette.
  // Mantle spine: BLUNT head (t=0.0 has rS=0.75 NOT 0.02 so we don't pinch).
  // The head bulb is a separate sphere mesh added later that wraps this open
  // front end, eliminating the "butthole" pinch artifact the user flagged.
  const spineCtrl = [
    { t: 0.00, x: -0.50, y:  0.12, rS: 0.75, hS: 0.85 },   // OPEN blunt front — no collapse
    { t: 0.06, x: -0.44, y:  0.18, rS: 0.95, hS: 1.10 },
    { t: 0.14, x: -0.34, y:  0.23, rS: 1.18, hS: 1.42 },   // head→arch peak
    { t: 0.26, x: -0.20, y:  0.24, rS: 1.20, hS: 1.48 },   // DORSAL ARCH
    { t: 0.40, x: -0.04, y:  0.16, rS: 1.10, hS: 1.22 },
    { t: 0.55, x:  0.12, y:  0.06, rS: 0.95, hS: 0.98 },
    { t: 0.70, x:  0.26, y:  0.00, rS: 0.78, hS: 0.72 },
    { t: 0.82, x:  0.36, y: -0.03, rS: 0.52, hS: 0.46 },
    { t: 0.92, x:  0.44, y: -0.04, rS: 0.24, hS: 0.20 },
    { t: 0.98, x:  0.48, y: -0.04, rS: 0.06, hS: 0.04 },
    { t: 1.00, x:  0.50, y: -0.04, rS: 0.02, hS: 0.02 },
  ];

  // Sample the spine via Catmull-Rom
  const curve = new THREE.CatmullRomCurve3(
    spineCtrl.map(c => new THREE.Vector3(c.x * L, c.y * H * 1.5, 0)),
    false, 'catmullrom', 0.5
  );
  const spinePts = curve.getPoints(LEN_SEG);

  // Helper: sample radius / height scales by t-along-length
  function sampleScale(t) {
    // Piecewise-linear interp through spineCtrl
    for (let i = 0; i < spineCtrl.length - 1; i++) {
      if (t >= spineCtrl[i].t && t <= spineCtrl[i+1].t) {
        const a = spineCtrl[i], b = spineCtrl[i+1];
        const u = (t - a.t) / (b.t - a.t);
        // Smoothstep for softer transitions
        const s = u * u * (3 - 2 * u);
        return { rS: a.rS + (b.rS - a.rS) * s, hS: a.hS + (b.hS - a.hS) * s };
      }
    }
    return { rS: 0, hS: 0 };
  }

  // Normalised noise for organic perturbation of the silhouette.
  // Use a simple deterministic 2D hash-based noise so rebuilds are stable.
  function noise2(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }
  function smooth2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = noise2(ix, iy), b = noise2(ix + 1, iy);
    const c = noise2(ix, iy + 1), d = noise2(ix + 1, iy + 1);
    return a + (b - a) * sx + ((c - a) + ((a - b) + (d - c)) * sx) * sy;
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= LEN_SEG; i++) {
    const t = i / LEN_SEG;
    const sp = spinePts[Math.min(i, spinePts.length - 1)];
    const scale = sampleScale(t);
    // Shoulder boost — multiplicative on rS in the t≈0.10–0.35 region so
    // paddle shoulders can be pushed wider without affecting head/tail.
    let rScale = scale.rS;
    let hScale = scale.hS;
    if (p.mantleShoulderBoost && p.mantleShoulderBoost !== 1.0) {
      const lo = 0.10, hi = 0.35, midLo = 0.18, midHi = 0.30;
      let boost = 0;
      if (t > lo && t < hi) {
        if (t < midLo)      boost = (t - lo) / (midLo - lo);
        else if (t < midHi) boost = 1;
        else                boost = 1 - (t - midHi) / (hi - midHi);
      }
      rScale *= 1 + (p.mantleShoulderBoost - 1) * boost;
    }
    // Front boost — widens the mantle's BLUNT NOSE so it matches the head's
    // back ring. Bridges the visible "neck gap" when the head is wider than
    // the mantle's front. Applied to both rS (width) and hS (height).
    if (p.mantleFrontBoost && p.mantleFrontBoost !== 1.0) {
      const lo = 0.00, hi = 0.12, midHi = 0.04;
      let boost = 0;
      if (t < hi) {
        if (t <= midHi) boost = 1;
        else            boost = 1 - (t - midHi) / (hi - midHi);
      }
      rScale *= 1 + (p.mantleFrontBoost - 1) * boost;
      hScale *= 1 + (p.mantleFrontBoost - 1) * boost;
    }

    // Subtle organic perturbation along length (breaks the low-poly feel)
    const wobble = (smooth2(t * 6, 1.3) - 0.5) * 0.03;

    for (let j = 0; j <= RAD_SEG; j++) {
      const phi = (j / RAD_SEG) * Math.PI * 2;
      let cy = Math.sin(phi);
      const cz = Math.cos(phi);
      // Ventral flatten (belly flat along the bottom)
      if (cy < 0) cy *= 0.65;
      // Cross-section organic perturbation — different per ring so silhouette wavers
      const sectionWobble = (smooth2(t * 4 + phi * 0.5, phi * 1.2) - 0.5) * 0.04;

      const radius = (R * rScale + wobble) * (1 + sectionWobble * 0.4);
      const height = (H * hScale + wobble) * (1 + sectionWobble * 0.3);
      const y = sp.y + cy * height;
      const z = cz * radius;

      positions.push(sp.x, y, z);
      const uWrap = ((phi + Math.PI * 0.5) / (Math.PI * 2)) % 1;
      uvs.push(uWrap, t);
      normals.push(0, cy, cz);       // placeholder — recomputed below
    }
  }

  const stride = RAD_SEG + 1;
  for (let i = 0; i < LEN_SEG; i++) {
    for (let j = 0; j < RAD_SEG; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = (i + 1) * stride + j;
      const d = (i + 1) * stride + j + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Close the mesh with fans at nose and tail. The end rings are already at
  // near-zero radius (rS 0.02) so the fans visually collapse to the tip.
  // Add a central point vert at each end and a triangle fan connecting.
  const noseVertIdx = positions.length / 3;
  const sp0 = spinePts[0];
  positions.push(sp0.x - 0.02, sp0.y, 0);
  normals.push(-1, 0, 0);
  uvs.push(0.5, 0);
  for (let j = 0; j < RAD_SEG; j++) {
    const a = 0 * stride + j;
    const b = 0 * stride + j + 1;
    indices.push(noseVertIdx, b, a);
  }

  const tailVertIdx = positions.length / 3;
  const spN = spinePts[spinePts.length - 1];
  positions.push(spN.x + 0.02, spN.y, 0);
  normals.push(1, 0, 0);
  uvs.push(0.5, 1);
  for (let j = 0; j < RAD_SEG; j++) {
    const a = LEN_SEG * stride + j;
    const b = LEN_SEG * stride + j + 1;
    indices.push(tailVertIdx, a, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── Head — spline-lofted side-profile mesh (replaces the dropped-in sphere).
//
// Cuttlefish heads in profile have: a dorsal arch rising off the mantle,
// a forehead peak, a cheek that falls to the mouth point. Cross-sections
// are ellipses wider (z) than tall (y) at the eye station, tapering to a
// small round point at the mouth. The whole head is tilted slightly down
// so the mouth/arms point forward-and-down, not straight forward.
//
// Returns { geometry, headPoints, stations } — callers can read
// `headPoints[t]` to place features (like eyes) on the actual mesh.
function buildHead(p) {
  const LEN_SEG = 48;
  const RAD_SEG = 28;

  // 5-station side-profile spline (t: 0=back/mantle joint, 1=mouth tip).
  // Each station has its own horizontal radius (z-axis) and vertical half-
  // height (y-axis), plus a y-offset that traces the dorsal profile.
  // Dorsal y — arches up at the forehead (station 1), drops toward the mouth.
  const mouthY = p.headMouthY;
  const baseY  = p.headBaseY;
  const stations = [
    // t          x-fraction   dorsal-y        rZ (horiz)       hY (vert)
    { t: 0.00,   xf:  0.00,   y: baseY + 0.04, rZ: p.headBackR,     hY: p.headBackH     },
    { t: 0.25,   xf: -0.30,   y: baseY + 0.14, rZ: p.headForeheadR, hY: p.headForeheadH },
    { t: 0.50,   xf: -0.58,   y: (baseY + mouthY) * 0.5 + 0.02,
                                                 rZ: p.headEyeR,      hY: p.headEyeH      },
    { t: 0.78,   xf: -0.86,   y: mouthY + 0.05, rZ: p.headCheekR,     hY: p.headCheekH    },
    { t: 1.00,   xf: -1.00,   y: mouthY,        rZ: p.headMouthR,     hY: p.headMouthH    },
  ];

  // Spine (Catmull-Rom through the station centres, scaled by headLength).
  const spinePts = new THREE.CatmullRomCurve3(
    stations.map(s => new THREE.Vector3(s.xf * p.headLength, s.y, 0)),
    false, 'catmullrom', 0.5
  ).getPoints(LEN_SEG);

  function sampleScale(t) {
    for (let i = 0; i < stations.length - 1; i++) {
      if (t >= stations[i].t && t <= stations[i+1].t) {
        const a = stations[i], b = stations[i+1];
        const u = (t - a.t) / (b.t - a.t);
        const s = u * u * (3 - 2 * u);
        return { rZ: a.rZ + (b.rZ - a.rZ) * s, hY: a.hY + (b.hY - a.hY) * s };
      }
    }
    return { rZ: 0, hY: 0 };
  }

  const positions = [], normals = [], uvs = [], indices = [];
  for (let i = 0; i <= LEN_SEG; i++) {
    const t = i / LEN_SEG;
    const sp = spinePts[Math.min(i, spinePts.length - 1)];
    const sc = sampleScale(t);
    for (let j = 0; j <= RAD_SEG; j++) {
      const phi = (j / RAD_SEG) * Math.PI * 2;
      let cy = Math.sin(phi), cz = Math.cos(phi);
      // Flatter belly so the ventral side is less round
      if (cy < 0) cy *= 0.78;
      const y = sp.y + cy * sc.hY;
      const z = cz * sc.rZ;
      positions.push(sp.x, y, z);
      // Seam shifted to dorsal TOP (phi=π/2, y-positive) so the texture
      // discontinuity is hidden under the dorsal arch instead of reading
      // as a "mouth line" on the side of the head.
      const uWrap = ((phi - Math.PI * 0.5) / (Math.PI * 2) + 1.0) % 1;
      uvs.push(uWrap, t);
      normals.push(0, cy, cz);
    }
  }
  const stride = RAD_SEG + 1;
  for (let i = 0; i < LEN_SEG; i++) {
    for (let j = 0; j < RAD_SEG; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = (i + 1) * stride + j;
      const d = (i + 1) * stride + j + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  // Close mouth end with a fan (small radius already → collapses nicely).
  const mouthCentreIdx = positions.length / 3;
  const last = spinePts[spinePts.length - 1];
  positions.push(last.x - 0.01, last.y, 0);
  normals.push(-1, 0, 0);
  uvs.push(0.5, 1);
  for (let j = 0; j < RAD_SEG; j++) {
    const a = LEN_SEG * stride + j;
    const b = LEN_SEG * stride + j + 1;
    indices.push(mouthCentreIdx, b, a);
  }
  // Back end (t=0) is NOT capped — it'll blend into the mantle.

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Expose station info for placers (eyes, mouth, arm-crown).
  geo.userData.headStations = stations;
  geo.userData.headLength   = p.headLength;
  return { geo, spinePts };
}

// ── Side fins (ribbons along the mantle) ──

function buildSideFin(p, side /* +1 right, -1 left */) {
  const LEN_SEG = 80;
  const WID_SEG = 6;             // more width segments → wave can curl smoothly
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const L = p.mantleLength;
  const R = p.mantleRadius;
  const W = p.finWidth;
  const extend = p.finExtend ?? 1.0;          // how far past mantle ends (0..1)
  const bumpFreq = p.finBumpFreq ?? 3.4;      // bumps per fin length
  const bumpAmp  = p.finBumpAmp  ?? 0.45;     // 0=even, 1=very lumpy

  // Cheap deterministic 1D smooth noise for the width bulge pattern.
  const hash1 = (x) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };
  const smoothN = (x) => { const ix = Math.floor(x), fx = x - ix;
    const a = hash1(ix), b = hash1(ix + 1);
    return a + (b - a) * (fx * fx * (3 - 2 * fx)); };
  const fbm1 = (x) => smoothN(x) * 0.6 + smoothN(x * 2.1 + 17) * 0.3 + smoothN(x * 4.3 + 91) * 0.1;

  for (let i = 0; i <= LEN_SEG; i++) {
    const t = i / LEN_SEG;
    // Full-length coverage — extend past nose and tail slightly for elegance
    const x = (t - 0.5) * L * (0.96 + 0.08 * extend);

    // Mantle radius profile (so the fin hugs the body)
    let profileScale;
    if (t < 0.10) profileScale = Math.sin((t / 0.10) * Math.PI * 0.5);
    else if (t < 0.55) profileScale = 1.0;
    else profileScale = Math.pow(1 - (t - 0.55) / 0.45, 1 + p.mantleTaper);

    // Fin envelope — soft sine across the whole length (no hard ends) plus
    // FBM bumps so some sections protrude wider than their neighbours.
    const tt = Math.min(1, Math.max(0, t));
    const envelope = Math.pow(Math.sin(tt * Math.PI), 0.7);
    const bump = fbm1(t * bumpFreq + (side > 0 ? 4.1 : 13.7));   // 0..1
    const finMask = envelope * (1 + (bump - 0.5) * 2 * bumpAmp);
    const finW = W * Math.max(0.15, finMask);

    for (let j = 0; j <= WID_SEG; j++) {
      const s = j / WID_SEG;   // 0 = attached to mantle, 1 = outer edge
      // Outer edge curves down gently — real fin trails lower than body midline
      const outerDrop = -0.05 * s * s;
      const yOffset = (p.finAttachY || 0) + outerDrop;
      // Tiny forward-back sweep so the fin edge isn't a straight line — follows
      // the bump field too so the protrusions "puff" outward rather than
      // growing straight sideways.
      const sweepX = (bump - 0.5) * 0.12 * s;
      const zOffset = side * (R * profileScale + finW * s);
      positions.push(x + sweepX, yOffset, zOffset);
      normals.push(0, 1, 0);
      uvs.push(s, t);
    }
  }

  const stride = WID_SEG + 1;
  for (let i = 0; i < LEN_SEG; i++) {
    for (let j = 0; j < WID_SEG; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = (i + 1) * stride + j;
      const d = (i + 1) * stride + j + 1;
      if (side > 0) indices.push(a, b, c, b, d, c);
      else          indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Stash per-vertex rest position for animation reuse
  const rest = new Float32Array(positions);
  geo.setAttribute('rest', new THREE.BufferAttribute(rest, 3));
  geo.userData.finRipples = p.finRipples;
  geo.userData.finRippleAmp = p.finRippleAmp;
  geo.userData.finLateralAmp = p.finLateralAmp ?? 0.6;
  geo.userData.side = side;
  geo.userData.zInnerApprox = p.mantleRadius * 0.95;
  geo.userData.zOuterSpan   = p.finWidth;
  return geo;
}

// ── Arms & tentacles ──

function armSpine(p, idx) {
  // 8 arms radial around the mouth. Per-arm curl is *randomized* around the
  // global curl value, so arms don't all curl identically — some splay out
  // while others hook inward. Overall curl is still controlled by armCurl.
  const count = p.armCount;
  const theta = ((idx + 0.5) / count) * Math.PI * 2;
  const crownR = p.armCrownRadius;

  // Mouth position — if the assembly has computed head-local mount coords,
  // use those (arms are parented under the head pivot so local = head frame).
  // Else fall back to mantle-frame defaults for callers that don't use the
  // spline head.
  const mouthX = (p.armMountX !== undefined) ? p.armMountX : (-p.mantleLength * 0.5 + 0.12);
  const mouthY = (p.armMountY !== undefined) ? p.armMountY : (-p.mantleHeight * 0.48);
  const mouthZ = 0;

  const rootY = mouthY + Math.sin(theta) * crownR * 0.65;
  const rootZ = mouthZ + Math.cos(theta) * crownR;
  const start = new THREE.Vector3(mouthX, rootY, rootZ);

  // Per-arm variation — deterministic per-index, blends pair-scaling + pseudo
  // noise so no two arms pose identically.
  const pair = Math.min(idx % 4, 3);
  const lengthScale = [0.95, 1.00, 1.05, 1.10][pair];
  const L = p.armLength * lengthScale;

  // Per-arm curl: global armCurl ± 0.25 jitter. Index-based so it's stable.
  const jitterSeed = Math.sin(idx * 4.13 + 0.8) * 0.5 + 0.5;   // 0..1
  const curl = Math.max(0.0, Math.min(1.0, p.armCurl + (jitterSeed - 0.5) * 0.45));

  // "Drop amount" — how much this arm hangs vs. flares out sideways.
  // Drops with curl. Two "outer" arms (idx 0, 4) droop more; "inner" arms (idx 2, 6) splay.
  const droop = 0.5 + 0.5 * curl;

  const outwardY = Math.sin(theta);
  const outwardZ = Math.cos(theta);
  // Arms point forward-ish but with a RADIAL splay — they don't all bunch
  // into a single forward bundle. Each arm drifts outward in its own radial
  // direction and has a mild forward commit, giving the "crown" its shape.
  const dropScale = p.armDropScale ?? 1.0;
  // Gravity: uniform downward pull on EVERY arm regardless of theta — without
  // it, top-side arms (sin(theta) > 0) splay upward against the droop term.
  // With p.armGravity = 0.7 every tip gets pulled a real amount down so the
  // crown drapes like a curtain around the mouth.
  const gravity = (p.armGravity ?? 0.0) * L;
  const fwd    = -0.70;
  const down   = -0.25 * droop * dropScale;
  const back   = +0.20 * curl;
  const inward = -0.25 * curl;
  const splay  = 0.60 + 0.25 * (1 - curl);

  const p1 = new THREE.Vector3(
    start.x + fwd * L * 0.30,
    start.y + down * L * 0.12 + outwardY * L * splay * 0.55 - gravity * 0.25,
    start.z                   + outwardZ * L * splay * 0.70
  );
  const p2 = new THREE.Vector3(
    start.x + fwd * L * 0.62,
    start.y + down * L * 0.28 + outwardY * L * splay * 0.65 - gravity * 0.65,
    start.z                   + outwardZ * L * splay * 0.90
  );
  const tip = new THREE.Vector3(
    start.x + fwd * L * 0.90 + back * L * 0.22,
    start.y + down * L * 0.48 - 0.02 * curl - gravity,
    start.z + outwardZ * L * splay * 0.95 + inward * outwardZ * L * 0.35
  );
  return catmullSpine([start, p1, p2, tip], p.armSegments);
}

function tentacleSpine(p, idx) {
  const sideSign = idx === 0 ? -1 : 1;
  const mouthX = (p.armMountX !== undefined) ? p.armMountX : (-p.mantleLength * 0.5 + 0.02);
  const mouthY = (p.armMountY !== undefined) ? p.armMountY : (-p.mantleHeight * 0.12);
  // Retracted tentacles tuck INSIDE the arm crown — start closer to axis
  const startZ = sideSign * p.armCrownRadius * 0.4;
  const start = new THREE.Vector3(mouthX, mouthY, startZ);

  const L = p.tentacleLength;
  const ext = p.tentacleExtension;

  // Extended: shoots forward. Retracted: short stubby curl between arms.
  const shoot = -L * (0.2 + 0.8 * ext);
  const coil  = L * 0.12 * (1 - ext);
  // Droop — curves the mid+tip control points downward so the tentacles
  // arc down-and-forward instead of shooting straight ahead.
  const drop  = (p.tentacleDrop ?? 0.0) * L;

  // S-bend + droop route
  const p1 = new THREE.Vector3(start.x - L * 0.15,        start.y + 0.02 + coil * 0.3 - drop * 0.10, start.z + sideSign * 0.02);
  const p2 = new THREE.Vector3(start.x + shoot * 0.45,    start.y - 0.03 - coil * 0.2 - drop * 0.55, start.z + sideSign * 0.03);
  const p3 = new THREE.Vector3(start.x + shoot,           start.y - 0.02              - drop * 1.00, start.z + sideSign * 0.015);
  return catmullSpine([start, p1, p2, p3], p.tentacleSegments);
}

// ── Eyes ──
//
// Real cuttlefish eye: gold iris with fine radial striations, a DARK W-shaped
// pupil dead-centre, slight darkening toward the limbus. We render this as a
// single textured disc (iris + W baked into a CanvasTexture) in front of a
// dark eyeball sphere. This reads correctly at distance without relying on
// a thin extruded W mesh that tends to look like a blob from afar.

function _createIrisTexture(pupilScaleW, pupilScaleH) {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');

  // Transparent background so the disc reads as a circle even if sampled
  // outside the radial gradient area.
  ctx.clearRect(0, 0, S, S);

  const cx = S / 2, cy = S / 2;
  const irisR = S * 0.47;

  // 1. Radial gold gradient: bright amber centre → rich gold → dark limbus
  const grad = ctx.createRadialGradient(cx, cy, irisR * 0.05, cx, cy, irisR);
  grad.addColorStop(0.00, '#fff4c0');
  grad.addColorStop(0.25, '#ffcc33');
  grad.addColorStop(0.65, '#d89408');
  grad.addColorStop(1.00, '#4a2f02');
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, irisR, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);

  // 2. Radial striations — thin dark rays for iris detail
  ctx.lineCap = 'butt';
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + (Math.sin(i * 1.37) * 0.03);
    const len = irisR * (0.55 + Math.random() * 0.42);
    const startR = irisR * (0.12 + Math.random() * 0.08);
    const alpha = 0.10 + Math.random() * 0.18;
    ctx.strokeStyle = `rgba(48, 28, 4, ${alpha})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * startR, cy + Math.sin(a) * startR);
    ctx.lineTo(cx + Math.cos(a) * len,    cy + Math.sin(a) * len);
    ctx.stroke();
  }

  // 3. Bright gold highlight on one side (simulates wet gloss)
  const hl = ctx.createRadialGradient(cx - irisR * 0.35, cy - irisR * 0.35, 2, cx - irisR * 0.35, cy - irisR * 0.35, irisR * 0.5);
  hl.addColorStop(0, 'rgba(255,255,230,0.35)');
  hl.addColorStop(1, 'rgba(255,255,230,0.0)');
  ctx.fillStyle = hl; ctx.fillRect(0, 0, S, S);

  // 4. W-PUPIL — pure black horizontal mustache, drawn as a filled path so it
  // reads AT ANY scale. Sized larger by default so the W actually shows up
  // when the eye is rendered at normal viewing distance.
  const pw = (S * 0.40) * (pupilScaleW ?? 1.35);  // ~half-width of the W
  const ph = (S * 0.26) * (pupilScaleH ?? 0.75);  // ~half-height
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  // TOP edge (left → right, mostly flat)
  ctx.moveTo(cx - pw * 1.00, cy - ph * 0.12);
  ctx.bezierCurveTo(cx - pw * 0.85, cy - ph * 0.42, cx - pw * 0.60, cy - ph * 0.52, cx - pw * 0.30, cy - ph * 0.34);
  ctx.bezierCurveTo(cx - pw * 0.10, cy - ph * 0.22, cx + pw * 0.10, cy - ph * 0.22, cx + pw * 0.30, cy - ph * 0.34);
  ctx.bezierCurveTo(cx + pw * 0.60, cy - ph * 0.52, cx + pw * 0.85, cy - ph * 0.42, cx + pw * 1.00, cy - ph * 0.12);
  // Right end plunges to the first trough
  ctx.bezierCurveTo(cx + pw * 0.98, cy + ph * 0.30, cx + pw * 0.88, cy + ph * 0.58, cx + pw * 0.70, cy + ph * 0.55);
  // Right shoulder peak UP (the W's right peak)
  ctx.bezierCurveTo(cx + pw * 0.58, cy - ph * 0.08, cx + pw * 0.42, cy - ph * 0.12, cx + pw * 0.28, cy + ph * 0.08);
  // Central deep plunge (the W's central V)
  ctx.bezierCurveTo(cx + pw * 0.20, cy + ph * 0.70, cx + pw * 0.08, cy + ph * 1.10, cx + 0,         cy + ph * 0.95);
  ctx.bezierCurveTo(cx - pw * 0.08, cy + ph * 1.10, cx - pw * 0.20, cy + ph * 0.70, cx - pw * 0.28, cy + ph * 0.08);
  // Left shoulder peak UP
  ctx.bezierCurveTo(cx - pw * 0.42, cy - ph * 0.12, cx - pw * 0.58, cy - ph * 0.08, cx - pw * 0.70, cy + ph * 0.55);
  ctx.bezierCurveTo(cx - pw * 0.88, cy + ph * 0.58, cx - pw * 0.98, cy + ph * 0.30, cx - pw * 1.00, cy - ph * 0.12);
  ctx.closePath();
  ctx.fill();

  // 5. Outer dark limbus ring for definition
  ctx.restore();
  ctx.strokeStyle = 'rgba(16,8,0,0.9)';
  ctx.lineWidth = S * 0.012;
  ctx.beginPath(); ctx.arc(cx, cy, irisR, 0, Math.PI * 2); ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildEye(p) {
  const group = new THREE.Group();
  const R = p.eyeRadius;

  // 1. Socket rim — dark torus inset into the head
  const socket = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.12, R * 0.26, 12, 40),
    new THREE.MeshStandardMaterial({ color: 0x160d05, roughness: 0.95, metalness: 0.0 })
  );
  socket.scale.set(1, 0.85, 0.50);
  socket.position.z = -R * 0.18;
  group.add(socket);

  // 2. Dark eyeball — small sphere behind the iris disc. Dark brown/black
  // so the edges around the textured iris read as eye-depth, not plastic.
  const eyeball = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.92, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0x0b0806, roughness: 0.7, metalness: 0.0,
    })
  );
  eyeball.position.z = R * 0.05;
  group.add(eyeball);

  // 3. Textured iris disc — gold radial striations + baked-in W pupil.
  // Emissive pushed higher so the gold glows and the black W punches through.
  const irisTex = _createIrisTexture(p.pupilScaleW, p.pupilScaleH);
  const iris = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.95, 64),
    new THREE.MeshBasicMaterial({
      map: irisTex, transparent: true, side: THREE.DoubleSide,
    })
  );
  iris.position.z = R * 0.55;
  group.add(iris);

  // 4. Subtle wet highlight — a small clear patch in the upper-left of the
  // iris instead of a full cornea hemisphere (which was washing out the W).
  const cornea = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshPhysicalMaterial({
      color: 0xfff8dd, roughness: 0.04, metalness: 0.0,
      transmission: 0.85, thickness: 0.01, ior: 1.35,
      clearcoat: 1.0, clearcoatRoughness: 0.02,
      transparent: true, opacity: 0.18,
    })
  );
  cornea.rotation.x = -Math.PI / 2;
  cornea.position.set(-R * 0.22, R * 0.18, R * 0.60);
  group.add(cornea);

  // 5. Catchlight — a single bright dot so the eye reads as wet/alive
  const glint = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.12, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  glint.position.set(-R * 0.25, R * 0.26, R * 0.70);
  group.add(glint);

  return group;
}

// ── Assembly ──

export function createCuttlefish(overrides = {}) {
  const p = { ...DEFAULTS, ...overrides };

  const group = new THREE.Group();
  group.userData.cuttlefish = p;

  // Mantle material — chromatophore shader for the LCD-skin effect.
  const mantleMat = p.plainSkin
    ? new THREE.MeshStandardMaterial({ color: 0xb8a890, roughness: 0.5, metalness: 0.05 })
    : createChromatophoreMaterial({
        chromaDensity:   p.chromaDensity   ?? 52,
        chromaIntensity: p.chromaIntensity ?? 0.85,
        iridoIntensity:  p.iridoIntensity  ?? 0.55,
        iridoHueRange:   p.iridoHueRange   ?? 0.85,
        zebraIntensity:  p.zebraIntensity  ?? 0.85,
        zebraFrequency:  p.zebraFrequency  ?? 11,
        leukoTint:       p.leukoTint       ?? '#dfd4c2',
        skinTint:        p.skinTint        ?? '#ffffff',
        lightingBias:    0.55,
        // Mantle wears the full skin shader. headMask off — that's the head's job.
        features: { chroma: true, irido: true, zebra: true, sparkle: true, headMask: false },
      });
  const mantle = new THREE.Mesh(buildMantle(p), mantleMat);
  mantle.userData.role = 'mantle';
  mantle.userData.chromatophore = !p.plainSkin;
  group.add(mantle);

  // ── HEAD ── spline-lofted side-profile mesh (wedge/teardrop, not a sphere).
  // Wrapped in a THREE.Group so the eyes + arm-crown hang off it and inherit
  // the head tilt automatically.
  const headPivot = new THREE.Group();
  headPivot.userData.role = 'headPivot';
  // Recess lets the head sit inside the mantle nose (overlap the blunt front)
  headPivot.position.set(-p.mantleLength * 0.5 + (p.headRecess ?? 0), 0, 0);
  headPivot.rotation.z = p.headTiltDown;   // +z-rot pitches nose down
  group.add(headPivot);

  const { geo: headGeo } = buildHead(p);
  // Head gets its OWN chromatophore material with the zebra layer silenced —
  // real cuttlefish don't carry the dorsal-bar pattern onto the head lobe.
  // Keeps chroma/irido/sparkle so the head still pulses with the mantle.
  const headMat = p.plainSkin
    ? mantleMat
    : createChromatophoreMaterial({
        chromaDensity:   p.chromaDensity   ?? 52,
        chromaIntensity: p.chromaIntensity ?? 0.85,
        iridoIntensity:  p.iridoIntensity  ?? 0.55,
        iridoHueRange:   p.iridoHueRange   ?? 0.85,
        zebraIntensity:  0.0,   // ← no bars on the head
        sparkleIntensity: p.sparkleIntensity ?? 0.8,
        leukoTint:       p.leukoTint       ?? '#dfd4c2',
        skinTint:        p.skinTint        ?? '#ffffff',
        // Head: chroma/irido/sparkle on, zebra off, head reticulation ON.
        features: { chroma: true, irido: true, zebra: false, sparkle: true, headMask: true },
      });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.userData.role = 'head';
  headPivot.add(headMesh);

  // Side fins — iridescent only (rainbow sheen, no chromatophore/zebra).
  // Reuses the skin shader with chroma+zebra silenced so the fins ripple with
  // the same iridophore field that's on the mantle.
  const finMat = createChromatophoreMaterial({
    chromaIntensity: 0.0,
    zebraIntensity:  0.0,
    iridoIntensity:  2.6,
    iridoHueRange:   1.85,
    sparkleIntensity: 0.5,
    leukoTint: '#cfd6d4',
    // Fins: only iridophore + sparkle. No voronoi, no zebra, no head mask.
    features: { chroma: false, irido: true, zebra: false, sparkle: true, headMask: false },
  });
  finMat.transparent = true;
  finMat.side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(buildSideFin(p, side), finMat);
    fin.userData.role = 'sideFin';
    group.add(fin);
  }

  // ── Eyes — mounted on the spline-lofted head at `eyeStation` along its
  // length. Positioned outward on the head surface (eye station z-radius +
  // pad) and raised above the spline centre. Rotated to face outward and
  // slightly forward so the W-pupil reads from SIDE, FRONT, and 3/4 views.
  // Parented to headPivot so they inherit headTiltDown.
  const eyeL = buildEye(p);
  const eyeR = buildEye(p);
  const stations = headGeo.userData.headStations;
  const stInterp = (t) => {
    for (let i = 0; i < stations.length - 1; i++) {
      if (t >= stations[i].t && t <= stations[i+1].t) {
        const a = stations[i], b = stations[i+1];
        const u = (t - a.t) / (b.t - a.t);
        const s = u * u * (3 - 2 * u);
        return {
          x:  (a.xf + (b.xf - a.xf) * s) * p.headLength,
          y:   a.y  + (b.y  - a.y ) * s,
          rZ:  a.rZ + (b.rZ - a.rZ) * s,
          hY:  a.hY + (b.hY - a.hY) * s,
        };
      }
    }
    return stations[0];
  };
  const eyeSt = stInterp(p.eyeStation);
  const eyeLx = eyeSt.x;
  // Place the eye on the actual head ellipse surface. The head cross-section
  // at eyeStation is an ellipse of half-height hY and half-width rZ. Given
  // a vertical rise fraction r = eyeRiseY * hY, the surface z at that y is
  // rZ * sqrt(1 - r²/hY²). Previously we used rZ directly → eye floated
  // outside the head whenever eyeRiseY was non-zero.
  const riseFrac = Math.min(0.95, Math.abs(p.eyeRiseY));          // clamp so sqrt stays real
  const rY = Math.sign(p.eyeRiseY) * riseFrac * eyeSt.hY;
  const eyeLy = eyeSt.y + rY;
  const surfaceZ = eyeSt.rZ * Math.sqrt(Math.max(0.001, 1 - riseFrac * riseFrac));
  // Spread = 0 → eye sits on the ellipse surface (narrow at high rise)
  // Spread = 1 → eye pulled out to the equator width (floats but wide)
  const spread = p.eyeSpread ?? 0.0;
  const eyeLz = surfaceZ * (1 - spread) + eyeSt.rZ * spread + p.eyeLateralPad;
  eyeL.position.set(eyeLx, eyeLy, -eyeLz);
  eyeR.position.set(eyeLx, eyeLy,  eyeLz);
  // Face outward: +z side yaw = π, -z side = 0. Rotate slightly toward -x
  // (forward) via eyeForwardYaw so both eyes angle a little toward the mouth.
  eyeL.rotation.set(-p.eyeTiltUp, Math.PI + p.eyeForwardYaw, 0);
  eyeR.rotation.set(-p.eyeTiltUp,         -p.eyeForwardYaw, 0);
  eyeL.userData.role = 'eye';
  eyeR.userData.role = 'eye';
  headPivot.add(eyeL, eyeR);

  // ── Arms & tentacles — parented to headPivot so they inherit the head tilt
  // and emerge from the actual mouth tip of the lofted head mesh.
  const mouthStation = stInterp(1.0);
  p.armMountX = mouthStation.x + 0.02;              // nudge forward past the tip
  p.armMountY = mouthStation.y - 0.02;              // fractionally below mouth centre

  // Arms
  const armMat = new THREE.MeshStandardMaterial({
    color: 0xa89880, roughness: 0.55, metalness: 0.05,
  });
  for (let i = 0; i < p.armCount; i++) {
    const spine = armSpine(p, i);
    const tube = buildTube(spine, p.armBaseRadius, p.armTipRadius, 8);
    const mesh = new THREE.Mesh(tube, armMat);
    mesh.userData.role = 'arm';
    mesh.userData.index = i;
    headPivot.add(mesh);
  }

  if (p.hideTentacles) return group;
  // Tentacles — clubbed tip + mantle-matching material so they shimmer too.
  // Each tentacle stores its rest positions so updateCuttlefish can push a
  // travelling wave along the spine in JS.
  const tenMat = p.plainSkin
    ? new THREE.MeshStandardMaterial({ color: 0x988878, roughness: 0.5, metalness: 0.06 })
    : createChromatophoreMaterial({
        chromaDensity: 70,  iridoIntensity: 0.45, iridoHueRange: 0.8,
        zebraIntensity: 0.0, chromaIntensity: 0.7,
        leukoTint: '#c5b8a0', skinTint: '#ffffff', lightingBias: 0.7,
        // Tentacles: chroma + irido + sparkle. No zebra, no head mask.
        features: { chroma: true, irido: true, zebra: false, sparkle: true, headMask: false },
      });
  for (let i = 0; i < 2; i++) {
    const spine = tentacleSpine(p, i);
    const radialFn = (t, base) => {
      // Club starts at t=0.72, bigger bump peak
      if (t > 0.72) {
        const u = (t - 0.72) / 0.28;
        const bump = Math.sin(u * Math.PI);
        return base + bump * (p.tentacleClubRadius - base) * 1.4;
      }
      return base;
    };
    const tube = buildTube(spine, p.tentacleBaseRadius, p.tentacleTipRadius, 8, radialFn);
    // Stash rest positions for wave animation
    const rest = new Float32Array(tube.attributes.position.array);
    tube.setAttribute('rest', new THREE.BufferAttribute(rest, 3));
    const mesh = new THREE.Mesh(tube, tenMat);
    mesh.userData.role = 'tentacle';
    mesh.userData.index = i;
    mesh.userData.waveSide = i === 0 ? -1 : 1;
    headPivot.add(mesh);
  }

  // Arms — also give them the skin shader so they shimmer, and store rest pos
  //       for idle wave motion. (Only if we're using the chromatophore material.)
  // Replace the static arm material we just created above.
  if (!p.plainSkin) {
    const armSkinMat = createChromatophoreMaterial({
      chromaDensity: 55,  iridoIntensity: 0.35, iridoHueRange: 0.7,
      zebraIntensity: 0.0, chromaIntensity: 0.65,
      leukoTint: '#b8ac93', skinTint: '#ffffff', lightingBias: 0.7,
      // Arms: chroma + irido + sparkle. No zebra, no head mask.
      features: { chroma: true, irido: true, zebra: false, sparkle: true, headMask: false },
    });
    group.traverse(c => {
      if (c.userData && c.userData.role === 'arm') {
        c.material = armSkinMat;
        const rest = new Float32Array(c.geometry.attributes.position.array);
        c.geometry.setAttribute('rest', new THREE.BufferAttribute(rest, 3));
      }
    });
  }

  // Centre the group on its bounding box so it pivots properly
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  group.children.forEach(ch => ch.position.sub(c));

  return group;
}

function _getUpdateCache(group) {
  if (group.userData.updateCache) return group.userData.updateCache;
  const cache = {
    materials: [],
    mantles: [],
    sideFins: [],
    arms: [],
    tentacles: [],
  };
  const mats = new Set();
  // Deep traverse — arms/tentacles/eyes now live under a headPivot group,
  // so iterating only group.children would miss them.
  group.traverse(child => {
    if (child === group) return;
    const mat = child.material;
    if (mat && mat.uniforms && mat.uniforms.uTime && !mats.has(mat)) {
      mats.add(mat);
      cache.materials.push(mat);
    }
    const role = child.userData.role;
    if (role === 'mantle') cache.mantles.push(child);
    else if (role === 'sideFin') cache.sideFins.push(child);
    else if (role === 'arm') cache.arms.push(child);
    else if (role === 'tentacle') cache.tentacles.push(child);
  });
  group.userData.updateCache = cache;
  return cache;
}

/**
 * Per-frame animation — call from the render loop.
 *   updateCuttlefish(group, elapsedSeconds)
 *
 * Animates: side fin ripple, arm micro-sway, tentacle shoot pulse.
 */
export function updateCuttlefish(group, t) {
  const cache = _getUpdateCache(group);

  for (const mat of cache.materials) {
    mat.uniforms.uTime.value = t;
  }

  for (const child of cache.mantles) {
    // Subtle body undulation — low-amplitude travelling wave along the
    // mantle length. Much softer than arms/tentacles (they whip; mantle
    // just breathes).
    const geo = child.geometry;
    let rest = geo.getAttribute('rest');
    if (!rest) {
      rest = new THREE.BufferAttribute(new Float32Array(geo.attributes.position.array), 3);
      geo.setAttribute('rest', rest);
    }
    const pos = geo.attributes.position;
    const arr = pos.array;
    const restArr = rest.array;
    const bb = geo.boundingBox || geo.computeBoundingBox() || geo.boundingBox;
    const xMin = bb ? bb.min.x : -1;
    const xMax = bb ? bb.max.x : 1;
    const span = Math.max(0.001, xMax - xMin);
    for (let i = 0; i < pos.count; i++) {
      const o = i * 3;
      const rx = restArr[o], ry = restArr[o + 1], rz = restArr[o + 2];
      // Normalised position along length (0 at nose, 1 at tail)
      const u = (rx - xMin) / span;
      const amp = u * u * 0.025;   // tail wobbles more, head is anchored
      const wy = Math.sin(u * Math.PI * 2.2 - t * 1.4) * amp;
      const wz = Math.cos(u * Math.PI * 2.2 - t * 1.4) * amp * 0.35;
      arr[o] = rx;
      arr[o + 1] = ry + wy;
      arr[o + 2] = rz + wz;
    }
    pos.needsUpdate = true;
  }

  for (const child of cache.sideFins) {
    const geo = child.geometry;
    const rest = geo.getAttribute('rest');
    const pos = geo.getAttribute('position');
    const ripples = geo.userData.finRipples;
    const amp = geo.userData.finRippleAmp;
    const latAmp = geo.userData.finLateralAmp ?? 0.6;
    const side = geo.userData.side;
    const bb = geo.boundingBox || (geo.computeBoundingBox(), geo.boundingBox);
    const xMin = bb ? bb.min.x : -1;
    const xMax = bb ? bb.max.x : 1;
    const span = Math.max(0.001, xMax - xMin);
    // Rough inner-edge Z for computing outer-ness (how far from mantle body)
    const zInnerApprox = geo.userData.zInnerApprox ?? 0.30;
    const zOuterSpan   = geo.userData.zOuterSpan   ?? 0.20;
    for (let i = 0; i < pos.count; i++) {
      const rx = rest.getX(i), ry = rest.getY(i), rz = rest.getZ(i);
      const v = (rx - xMin) / span;
      const phase = v * Math.PI * 2 * ripples - t * 3.4;
      const wave1 = Math.sin(phase + side * 0.4);
      const wave2 = Math.sin(phase * 1.7 + 1.1 + side * 0.8);   // second harmonic
      const dz = Math.abs(rz) - zInnerApprox;
      const s = THREE.MathUtils.clamp(dz / zOuterSpan, 0, 1);
      // Vertical ripple (primary) + lateral sway (secondary, out-of-phase)
      const dispY = (wave1 * 0.85 + wave2 * 0.25) * amp * s;
      const dispZ = wave2 * amp * s * latAmp * side;
      pos.setY(i, ry + dispY);
      pos.setZ(i, rz + dispZ);
    }
    pos.needsUpdate = true;
  }

  for (const child of cache.arms) {
    const idx = child.userData.index;
    const phase = idx * 0.7;
    // Each arm has its own slow "pose drift" — rotation around the root so
    // the arm swings through different curl apparently without rebuilding.
    child.rotation.z = Math.sin(t * 0.35 + phase) * 0.09;
    child.rotation.x = Math.cos(t * 0.28 + phase * 0.6) * 0.07;
    // Small per-arm yaw so the bundle isn't rigid
    child.rotation.y = Math.sin(t * 0.22 + phase * 1.1) * 0.04;
    _applyTubeWave(child, t, phase, 0.04, 3.0, 3);
  }

  for (const child of cache.tentacles) {
    const idx = child.userData.index;
    const phase = idx * 1.3;
    child.rotation.y = Math.sin(t * 0.5 + phase) * 0.06;
    _applyTubeWave(child, t, phase, 0.07, 5.0, 4);
  }
}
