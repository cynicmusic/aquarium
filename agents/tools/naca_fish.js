#!/usr/bin/env node
/**
 * naca_fish.js — Generates fish body shapes using NACA airfoil equations + species modifiers.
 *
 * Fish are hydrodynamic bodies — their taper follows the same math as airplane wings.
 * NACA 4-digit: MPXX where M=max camber, P=camber position, XX=thickness
 *
 * Species mapping:
 *   clownfish  → thick (22%), camber forward, stocky
 *   angelfish  → very thick (40%+), nearly circular, tall fins
 *   tang       → medium (18%), slight camber, oval
 *   betta      → thin (14%), huge flowing fins
 *   discus     → extreme thickness (50%+), disc
 *   lionfish   → medium (18%), elongated, spiny fins
 *   moorishIdol → thick (30%), tall pennant, pointed snout
 *   butterflyfish → thick (28%), rounded, pointed snout
 *
 * Usage:
 *   node agents/tools/naca_fish.js --all --out output/sprites/geometry/
 *   node agents/tools/naca_fish.js --species clownfish --out output/sprites/geometry/naca_001_clownfish.png
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;
const PAD = 50;

// ── Perlin noise utilities ──
// Permutation table (seeded, deterministic)
const _perm = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle with fixed seed
  let seed = 12345;
  const srand = () => { seed = (seed * 16807 + 7) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff; };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(srand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
}

const _grad2 = [
  [1,1],[-1,1],[1,-1],[-1,-1],
  [1,0],[-1,0],[0,1],[0,-1]
];

function _dot2(gi, x, y) {
  const g = _grad2[gi % 8];
  return g[0] * x + g[1] * y;
}

function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function _lerp(a, b, t) { return a + t * (b - a); }

function _perlinRaw(x, y) {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = _fade(xf);
  const v = _fade(yf);
  const aa = _perm[_perm[xi] + yi];
  const ab = _perm[_perm[xi] + yi + 1];
  const ba = _perm[_perm[xi + 1] + yi];
  const bb = _perm[_perm[xi + 1] + yi + 1];
  return _lerp(
    _lerp(_dot2(aa, xf, yf), _dot2(ba, xf - 1, yf), u),
    _lerp(_dot2(ab, xf, yf - 1), _dot2(bb, xf - 1, yf - 1), u),
    v
  );
}

/**
 * fBm Perlin noise, returns value in [0,1]
 */
function perlin2D(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    sum += _perlinRaw(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return (sum / maxAmp) * 0.5 + 0.5; // map to 0..1
}

/**
 * Ridge noise — sharp ridges via abs inversion
 */
function ridgeNoise(x, y, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    let v = Math.abs(_perlinRaw(x * freq, y * freq));
    v = 1.0 - v; // invert for ridges
    v = v * v;    // sharpen
    sum += v * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / maxAmp;
}

/**
 * Domain warp — returns warped [wx, wy] for psychedelic effects
 */
function domainWarp(x, y, warpAmount = 1.0) {
  const wx = x + warpAmount * perlin2D(x + 5.2, y + 1.3, 3);
  const wy = y + warpAmount * perlin2D(x + 9.7, y + 6.8, 3);
  return [wx, wy];
}

/**
 * Parse hex color to [r, g, b]
 */
function hexToRGB(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

/**
 * Blend two [r,g,b] colors by t (0=a, 1=b)
 */
function blendRGB(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── NACA airfoil thickness distribution ──
// Returns half-thickness at position x (0..1) for a given max thickness t
function nacaThickness(x, t) {
  // Joukowski-blend NACA variant — smoother nose than standard NACA
  // Blends sharp (x^0.6) and blunt (x^0.25) nose shapes
  // Standard NACA uses sqrt(x) which creates hammerhead-like blunt noses
  const sharpNose = Math.pow(x, 0.6);
  const bluntNose = Math.pow(x, 0.25);
  const noseShape = sharpNose * 0.55 + bluntNose * 0.45;

  return (t / 0.2) * (
    0.2969 * noseShape
    - 0.1260 * x
    - 0.3516 * x * x
    + 0.2843 * x * x * x
    - 0.1015 * x * x * x * x  // closed trailing edge
  );
}

// ── Camber line (asymmetry — dorsal hump) ──
function nacaCamber(x, m, p) {
  if (m === 0) return 0;
  if (x < p) {
    return (m / (p * p)) * (2 * p * x - x * x);
  } else {
    return (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
  }
}

// ── Species definitions ──
// Each species is a set of parameters that modify the base NACA shape
const SPECIES = {
  clownfish: {
    name: 'Clownfish',
    thickness: 0.28,        // stocky — 28% max thickness
    camber: 0.04,           // slight dorsal hump
    camberPos: 0.35,        // hump position (forward)
    bodyLength: 0.65,       // body takes 65% of total fish length
    bellyBulge: 0.03,       // extra belly roundness
    headBluntness: 1.4,     // blunter nose (multiply sqrt term)
    tailNarrow: 0.06,       // minimum thickness at peduncle
    colors: { body: '#ff6b35', stripe: '#ffffff', accent: '#1a1a1a', fin: '#ff8c55' },
    dorsalFin: { start: 0.25, end: 0.70, height: 0.35, shape: 'rounded' },
    caudalFin: { spread: 0.30, length: 0.18, fork: 0.25, shape: 'rounded' },
    analFin: { start: 0.50, end: 0.70, height: 0.22, shape: 'rounded' },
    pectoralFin: { x: 0.25, y: -0.02, length: 0.12, width: 0.06 },
    eye: { x: 0.09, yOffset: 0.3, r: 0.028 },
  },
  angelfish: {
    name: 'Angelfish',
    thickness: 0.42,        // very thick — nearly circular
    camber: 0.03,
    camberPos: 0.40,
    bodyLength: 0.60,
    bellyBulge: 0.0,
    headBluntness: 1.2,
    tailNarrow: 0.04,
    colors: { body: '#2244aa', stripe: '#ffcc00', accent: '#000000', fin: '#1a3388' },
    dorsalFin: { start: 0.15, end: 0.65, height: 0.60, shape: 'pointed' },
    caudalFin: { spread: 0.28, length: 0.15, fork: 0.40, shape: 'forked' },
    analFin: { start: 0.18, end: 0.65, height: 0.55, shape: 'pointed' },
    pectoralFin: { x: 0.20, y: -0.02, length: 0.10, width: 0.05 },
    eye: { x: 0.10, yOffset: 0.25, r: 0.024 },
  },
  tang: {
    name: 'Powder Blue Tang',
    thickness: 0.38,          // rounder, disc-like
    camber: 0.03,
    camberPos: 0.38,
    bodyLength: 0.60,
    bellyBulge: 0.0,
    headBluntness: 0.9,
    tailNarrow: 0.05,
    colors: { body: '#2288ee', stripe: '#1a1a2a', accent: '#ffdd00', fin: '#0055bb' },
    dorsalFin: { start: 0.12, end: 0.72, height: 0.40, shape: 'continuous' },
    caudalFin: { spread: 0.22, length: 0.14, fork: 0.45, shape: 'forked' },
    analFin: { start: 0.38, end: 0.72, height: 0.30, shape: 'continuous' },
    pectoralFin: { x: 0.20, y: -0.02, length: 0.10, width: 0.05 },
    eye: { x: 0.08, yOffset: 0.28, r: 0.024 },
  },
  betta: {
    name: 'Betta',
    thickness: 0.20,        // slender body
    camber: 0.02,
    camberPos: 0.35,
    bodyLength: 0.45,       // body is small, fins are huge
    bellyBulge: 0.01,
    headBluntness: 1.3,
    tailNarrow: 0.04,
    colors: { body: '#8833cc', stripe: '#aa44ff', accent: '#cc66ff', fin: '#7722bb' },
    dorsalFin: { start: 0.18, end: 0.80, height: 0.70, shape: 'flowing' },
    caudalFin: { spread: 0.65, length: 0.45, fork: 0.10, shape: 'veil' },
    analFin: { start: 0.25, end: 0.80, height: 0.60, shape: 'flowing' },
    pectoralFin: { x: 0.22, y: -0.02, length: 0.14, width: 0.06 },
    eye: { x: 0.10, yOffset: 0.30, r: 0.020 },
  },
  discus: {
    name: 'Discus',
    thickness: 0.55,        // nearly circular
    camber: 0.01,
    camberPos: 0.45,
    bodyLength: 0.65,
    bellyBulge: 0.0,
    headBluntness: 1.0,
    tailNarrow: 0.04,
    colors: { body: '#cc4422', stripe: '#ff8844', accent: '#441100', fin: '#aa3311' },
    dorsalFin: { start: 0.12, end: 0.75, height: 0.30, shape: 'continuous' },
    caudalFin: { spread: 0.18, length: 0.10, fork: 0.20, shape: 'rounded' },
    analFin: { start: 0.15, end: 0.75, height: 0.28, shape: 'continuous' },
    pectoralFin: { x: 0.18, y: -0.02, length: 0.08, width: 0.04 },
    eye: { x: 0.10, yOffset: 0.22, r: 0.024 },
  },
  lionfish: {
    name: 'Lionfish',
    thickness: 0.24,
    camber: 0.03,
    camberPos: 0.30,
    bodyLength: 0.60,
    bellyBulge: 0.02,
    headBluntness: 1.5,     // very blunt head
    tailNarrow: 0.05,
    colors: { body: '#cc3333', stripe: '#ffffff', accent: '#881111', fin: '#cc4444' },
    dorsalFin: { start: 0.05, end: 0.65, height: 0.55, shape: 'spiny' },
    caudalFin: { spread: 0.24, length: 0.14, fork: 0.35, shape: 'rounded' },
    analFin: { start: 0.45, end: 0.68, height: 0.25, shape: 'spiny' },
    pectoralFin: { x: 0.20, y: -0.05, length: 0.28, width: 0.18 },  // huge fan pectorals
    eye: { x: 0.08, yOffset: 0.30, r: 0.020 },
  },
  moorishIdol: {
    name: 'Moorish Idol',
    thickness: 0.35,
    camber: 0.04,
    camberPos: 0.35,
    bodyLength: 0.60,
    bellyBulge: 0.0,
    headBluntness: 0.8,     // pointed snout
    tailNarrow: 0.04,
    colors: { body: '#ffdd33', stripe: '#000000', accent: '#ffffff', fin: '#ffcc00' },
    dorsalFin: { start: 0.25, end: 0.55, height: 0.90, shape: 'pennant' },  // tall pennant, starts behind head
    caudalFin: { spread: 0.18, length: 0.10, fork: 0.30, shape: 'forked' },
    analFin: { start: 0.20, end: 0.55, height: 0.35, shape: 'pointed' },
    pectoralFin: { x: 0.18, y: -0.02, length: 0.08, width: 0.04 },
    eye: { x: 0.09, yOffset: 0.25, r: 0.022 },
  },
  butterflyfish: {
    name: 'Butterflyfish',
    thickness: 0.40,          // rounder disc shape
    camber: 0.03,
    camberPos: 0.38,
    bodyLength: 0.55,         // shorter body = longer snout
    bellyBulge: 0.0,
    headBluntness: 0.25,      // very long pointed snout
    tailNarrow: 0.05,
    colors: { body: '#ffffee', stripe: '#ee8800', accent: '#000000', fin: '#ffeecc' },
    dorsalFin: { start: 0.16, end: 0.66, height: 0.42, shape: 'pointed' },
    caudalFin: { spread: 0.18, length: 0.11, fork: 0.25, shape: 'slightly_forked' },
    analFin: { start: 0.32, end: 0.66, height: 0.32, shape: 'pointed' },
    pectoralFin: { x: 0.19, y: -0.02, length: 0.09, width: 0.04 },
    eye: { x: 0.09, yOffset: 0.25, r: 0.024 },
  },

  // ── 8 NEW SPECIES for diversity ──

  neonTetra: {
    name: 'Neon Tetra',
    thickness: 0.14,          // VERY thin — tiny torpedo
    camber: 0.01,
    camberPos: 0.40,
    bodyLength: 0.75,         // mostly body, tiny fins
    bellyBulge: 0.005,
    headBluntness: 1.0,
    tailNarrow: 0.03,
    colors: { body: '#1144aa', stripe: '#00ffcc', accent: '#ff2222', fin: '#88aacc' },
    dorsalFin: { start: 0.40, end: 0.55, height: 0.18, shape: 'rounded' },
    caudalFin: { spread: 0.14, length: 0.10, fork: 0.55, shape: 'forked' },
    analFin: { start: 0.50, end: 0.65, height: 0.12, shape: 'rounded' },
    pectoralFin: { x: 0.20, y: -0.01, length: 0.06, width: 0.03 },
    eye: { x: 0.08, yOffset: 0.35, r: 0.020 },  // big eye relative to tiny body
  },

  pufferfish: {
    name: 'Pufferfish',
    thickness: 0.60,          // EXTREMELY round — almost a ball
    camber: 0.0,
    camberPos: 0.50,
    bodyLength: 0.70,
    bellyBulge: 0.08,         // extra belly
    headBluntness: 1.8,       // very blunt
    tailNarrow: 0.03,
    colors: { body: '#1a2a1a', stripe: '#ddbb22', accent: '#ffffff', fin: '#334433' },
    dorsalFin: { start: 0.55, end: 0.72, height: 0.15, shape: 'rounded' },
    caudalFin: { spread: 0.12, length: 0.08, fork: 0.15, shape: 'rounded' },
    analFin: { start: 0.55, end: 0.70, height: 0.12, shape: 'rounded' },
    pectoralFin: { x: 0.28, y: 0.0, length: 0.08, width: 0.05 },
    eye: { x: 0.14, yOffset: 0.35, r: 0.032 },  // large front-facing eyes
  },

  swordtail: {
    name: 'Swordtail',
    thickness: 0.16,          // sleek elongated
    camber: 0.02,
    camberPos: 0.35,
    bodyLength: 0.55,
    bellyBulge: 0.01,
    headBluntness: 0.9,
    tailNarrow: 0.03,
    colors: { body: '#ee4422', stripe: '#ff8844', accent: '#000000', fin: '#cc3311' },
    dorsalFin: { start: 0.35, end: 0.58, height: 0.22, shape: 'pointed' },
    caudalFin: { spread: 0.18, length: 0.35, fork: 0.0, shape: 'sword' },  // sword extension!
    analFin: { start: 0.48, end: 0.62, height: 0.15, shape: 'pointed' },
    pectoralFin: { x: 0.20, y: -0.02, length: 0.08, width: 0.04 },
    eye: { x: 0.09, yOffset: 0.30, r: 0.018 },
  },

  seahorse: {
    name: 'Seahorse',
    thickness: 0.18,
    camber: 0.15,             // EXTREME camber — curved body
    camberPos: 0.30,
    bodyLength: 0.50,
    bellyBulge: 0.06,
    headBluntness: 0.5,       // very pointed upward snout
    tailNarrow: 0.02,
    colors: { body: '#dd8833', stripe: '#ffaa55', accent: '#aa6622', fin: '#cc7722' },
    dorsalFin: { start: 0.30, end: 0.55, height: 0.20, shape: 'rounded' },
    caudalFin: { spread: 0.04, length: 0.15, fork: 0.0, shape: 'curl' },  // curled tail
    analFin: { start: 0.50, end: 0.60, height: 0.08, shape: 'rounded' },
    pectoralFin: { x: 0.22, y: 0.0, length: 0.06, width: 0.04 },
    eye: { x: 0.07, yOffset: 0.40, r: 0.022 },  // high eye position
  },

  triggerfish: {
    name: 'Triggerfish',
    thickness: 0.38,          // deep-bodied, laterally compressed
    camber: 0.05,
    camberPos: 0.35,
    bodyLength: 0.60,
    bellyBulge: 0.0,
    headBluntness: 0.6,       // angular pointed head
    tailNarrow: 0.06,
    colors: { body: '#336655', stripe: '#55aa88', accent: '#ffcc44', fin: '#2a5544' },
    dorsalFin: { start: 0.30, end: 0.60, height: 0.25, shape: 'rounded' },  // low rounded dorsal
    caudalFin: { spread: 0.22, length: 0.14, fork: 0.25, shape: 'forked' },
    analFin: { start: 0.40, end: 0.70, height: 0.35, shape: 'continuous' },
    pectoralFin: { x: 0.22, y: -0.01, length: 0.07, width: 0.04 },
    eye: { x: 0.11, yOffset: 0.30, r: 0.020 },
  },

  goby: {
    name: 'Peacock Goby',
    thickness: 0.18,          // small elongated
    camber: -0.01,            // slightly flat bottom
    camberPos: 0.45,
    bodyLength: 0.72,
    bellyBulge: 0.0,
    headBluntness: 1.3,       // rounded head
    tailNarrow: 0.03,
    colors: { body: '#cc4422', stripe: '#5533cc', accent: '#ff6633', fin: '#5544bb' },
    dorsalFin: { start: 0.15, end: 0.40, height: 0.20, shape: 'rounded' },
    caudalFin: { spread: 0.12, length: 0.09, fork: 0.10, shape: 'rounded' },
    analFin: { start: 0.45, end: 0.68, height: 0.12, shape: 'rounded' },
    pectoralFin: { x: 0.18, y: -0.02, length: 0.10, width: 0.06 },
    eye: { x: 0.06, yOffset: 0.40, r: 0.022 },
  },

  surgeonfish: {
    name: 'Surgeonfish',
    thickness: 0.30,
    camber: 0.02,
    camberPos: 0.42,
    bodyLength: 0.62,
    bellyBulge: 0.01,
    headBluntness: 0.85,
    tailNarrow: 0.05,
    colors: { body: '#ffaa00', stripe: '#ffffff', accent: '#334455', fin: '#dd9900' },
    dorsalFin: { start: 0.12, end: 0.72, height: 0.30, shape: 'continuous' },
    caudalFin: { spread: 0.24, length: 0.16, fork: 0.55, shape: 'forked' },  // deeply forked
    analFin: { start: 0.38, end: 0.72, height: 0.25, shape: 'continuous' },
    pectoralFin: { x: 0.20, y: -0.02, length: 0.10, width: 0.05 },
    eye: { x: 0.09, yOffset: 0.28, r: 0.022 },
  },

  mandarinfish: {
    name: 'Mandarinfish',
    thickness: 0.22,
    camber: 0.03,
    camberPos: 0.35,
    bodyLength: 0.65,
    bellyBulge: 0.03,
    headBluntness: 1.4,       // round head
    tailNarrow: 0.04,
    colors: { body: '#2255cc', stripe: '#ff6600', accent: '#33cc66', fin: '#3366dd' },
    dorsalFin: { start: 0.15, end: 0.50, height: 0.40, shape: 'fan' },  // tall fan-like first dorsal
    caudalFin: { spread: 0.18, length: 0.12, fork: 0.20, shape: 'rounded' },
    analFin: { start: 0.45, end: 0.65, height: 0.20, shape: 'rounded' },
    pectoralFin: { x: 0.22, y: -0.01, length: 0.10, width: 0.06 },  // large pectorals
    eye: { x: 0.10, yOffset: 0.30, r: 0.026 },
  },

  // ── 16 MORE SPECIES for maximum diversity ──

  cardinalTetra: {
    name: 'Cardinal Tetra',
    thickness: 0.13,          // tiny torpedo like neon tetra
    camber: 0.01,
    camberPos: 0.42,
    bodyLength: 0.76,
    bellyBulge: 0.004,
    headBluntness: 1.0,
    tailNarrow: 0.03,
    colors: { body: '#cc1122', stripe: '#0066ff', accent: '#220000', fin: '#dd8888' },
    dorsalFin: { start: 0.42, end: 0.56, height: 0.16, shape: 'rounded' },
    caudalFin: { spread: 0.13, length: 0.09, fork: 0.50, shape: 'forked' },
    analFin: { start: 0.52, end: 0.66, height: 0.11, shape: 'rounded' },
    pectoralFin: { x: 0.19, y: -0.01, length: 0.05, width: 0.03 },
    eye: { x: 0.07, yOffset: 0.34, r: 0.021 },
  },

  parrotfish: {
    name: 'Parrotfish',
    thickness: 0.30,          // large bulky body
    camber: 0.04,
    camberPos: 0.32,
    bodyLength: 0.62,
    bellyBulge: 0.04,
    headBluntness: 1.7,       // very blunt beak-like mouth
    tailNarrow: 0.06,
    colors: { body: '#22bb66', stripe: '#0088cc', accent: '#ff66aa', fin: '#33cc77' },
    dorsalFin: { start: 0.18, end: 0.70, height: 0.28, shape: 'continuous' },
    caudalFin: { spread: 0.26, length: 0.16, fork: 0.35, shape: 'forked' },
    analFin: { start: 0.42, end: 0.70, height: 0.22, shape: 'continuous' },
    pectoralFin: { x: 0.24, y: -0.02, length: 0.12, width: 0.06 },
    eye: { x: 0.12, yOffset: 0.30, r: 0.022 },
  },

  clownTrigger: {
    name: 'Clown Triggerfish',
    thickness: 0.36,          // deep-bodied
    camber: 0.05,
    camberPos: 0.36,
    bodyLength: 0.58,
    bellyBulge: 0.01,
    headBluntness: 0.7,       // angular head
    tailNarrow: 0.06,
    colors: { body: '#1a1a1a', stripe: '#ffffff', accent: '#ffcc00', fin: '#333333' },
    dorsalFin: { start: 0.30, end: 0.65, height: 0.20, shape: 'rounded' },  // low continuous dorsal, no trigger spike
    caudalFin: { spread: 0.20, length: 0.13, fork: 0.20, shape: 'rounded' },
    analFin: { start: 0.42, end: 0.72, height: 0.38, shape: 'continuous' },
    pectoralFin: { x: 0.21, y: -0.01, length: 0.08, width: 0.04 },
    eye: { x: 0.10, yOffset: 0.32, r: 0.020 },
  },

  regalTang: {
    name: 'Regal Tang',
    thickness: 0.30,          // Dory — oval deep body
    camber: 0.03,
    camberPos: 0.40,
    bodyLength: 0.60,
    bellyBulge: 0.01,
    headBluntness: 1.1,
    tailNarrow: 0.05,
    colors: { body: '#0033bb', stripe: '#001155', accent: '#ffdd00', fin: '#0044cc' },
    dorsalFin: { start: 0.14, end: 0.74, height: 0.35, shape: 'continuous' },
    caudalFin: { spread: 0.24, length: 0.15, fork: 0.50, shape: 'forked' },
    analFin: { start: 0.38, end: 0.74, height: 0.28, shape: 'continuous' },
    pectoralFin: { x: 0.21, y: -0.02, length: 0.10, width: 0.05 },
    eye: { x: 0.09, yOffset: 0.28, r: 0.024 },
  },

  emperorAngelfish: {
    name: 'Emperor Angelfish',
    thickness: 0.40,          // very deep body, laterally compressed
    camber: 0.03,
    camberPos: 0.42,
    bodyLength: 0.58,
    bellyBulge: 0.0,
    headBluntness: 1.0,
    tailNarrow: 0.04,
    colors: { body: '#1133aa', stripe: '#ffdd00', accent: '#ffffff', fin: '#002288' },
    dorsalFin: { start: 0.12, end: 0.68, height: 0.50, shape: 'pointed' },
    caudalFin: { spread: 0.24, length: 0.14, fork: 0.30, shape: 'rounded' },
    analFin: { start: 0.16, end: 0.68, height: 0.45, shape: 'pointed' },
    pectoralFin: { x: 0.19, y: -0.02, length: 0.10, width: 0.05 },
    eye: { x: 0.10, yOffset: 0.24, r: 0.024 },
  },

  banggaiCardinal: {
    name: 'Banggai Cardinalfish',
    thickness: 0.18,          // thin with dramatic fins
    camber: 0.02,
    camberPos: 0.38,
    bodyLength: 0.55,
    bellyBulge: 0.01,
    headBluntness: 1.2,
    tailNarrow: 0.04,
    colors: { body: '#cccccc', stripe: '#111111', accent: '#ffffff', fin: '#999999' },
    dorsalFin: { start: 0.12, end: 0.45, height: 0.55, shape: 'spiny' },  // tall spiny dorsal
    caudalFin: { spread: 0.30, length: 0.22, fork: 0.65, shape: 'forked' },  // deeply forked
    analFin: { start: 0.40, end: 0.60, height: 0.30, shape: 'pointed' },
    pectoralFin: { x: 0.20, y: -0.01, length: 0.09, width: 0.04 },
    eye: { x: 0.09, yOffset: 0.28, r: 0.026 },  // large eyes
  },

  copperBandButterfly: {
    name: 'Copperband Butterflyfish',
    thickness: 0.32,
    camber: 0.03,
    camberPos: 0.36,
    bodyLength: 0.60,
    bellyBulge: 0.0,
    headBluntness: 0.25,      // very long pointed snout
    tailNarrow: 0.05,
    colors: { body: '#ffffff', stripe: '#dd6600', accent: '#000000', fin: '#ffeecc' },
    dorsalFin: { start: 0.16, end: 0.66, height: 0.42, shape: 'pointed' },
    caudalFin: { spread: 0.18, length: 0.11, fork: 0.25, shape: 'slightly_forked' },
    analFin: { start: 0.30, end: 0.66, height: 0.35, shape: 'pointed' },
    pectoralFin: { x: 0.19, y: -0.02, length: 0.08, width: 0.04 },
    eye: { x: 0.08, yOffset: 0.25, r: 0.024 },
  },

  foxface: {
    name: 'Foxface Rabbitfish',
    thickness: 0.28,
    camber: 0.04,
    camberPos: 0.34,
    bodyLength: 0.60,
    bellyBulge: 0.01,
    headBluntness: 0.6,       // pointed face
    tailNarrow: 0.05,
    colors: { body: '#ddcc00', stripe: '#000000', accent: '#ffffff', fin: '#ccbb00' },
    dorsalFin: { start: 0.10, end: 0.72, height: 0.48, shape: 'spiny' },  // tall venomous spines
    caudalFin: { spread: 0.20, length: 0.13, fork: 0.35, shape: 'forked' },
    analFin: { start: 0.38, end: 0.70, height: 0.30, shape: 'continuous' },
    pectoralFin: { x: 0.20, y: -0.02, length: 0.09, width: 0.04 },
    eye: { x: 0.08, yOffset: 0.28, r: 0.022 },
  },

  hawkfish: {
    name: 'Hawkfish',
    thickness: 0.22,          // stocky perching fish
    camber: 0.04,
    camberPos: 0.32,
    bodyLength: 0.65,
    bellyBulge: 0.03,
    headBluntness: 1.5,
    tailNarrow: 0.05,
    colors: { body: '#ee4444', stripe: '#ffffff', accent: '#882222', fin: '#cc3333' },
    dorsalFin: { start: 0.12, end: 0.62, height: 0.32, shape: 'spiny' },  // spiny dorsal with cirri
    caudalFin: { spread: 0.16, length: 0.10, fork: 0.15, shape: 'rounded' },
    analFin: { start: 0.48, end: 0.64, height: 0.18, shape: 'rounded' },
    pectoralFin: { x: 0.22, y: -0.03, length: 0.12, width: 0.07 },  // thick pectorals for perching
    eye: { x: 0.10, yOffset: 0.35, r: 0.024 },
  },

  wrasse: {
    name: 'Wrasse',
    thickness: 0.16,          // elongated, sleek swimmer
    camber: 0.02,
    camberPos: 0.40,
    bodyLength: 0.70,
    bellyBulge: 0.005,
    headBluntness: 0.9,
    tailNarrow: 0.04,
    colors: { body: '#22cc88', stripe: '#ff4488', accent: '#4400aa', fin: '#33dd99' },
    dorsalFin: { start: 0.15, end: 0.75, height: 0.22, shape: 'continuous' },
    caudalFin: { spread: 0.18, length: 0.12, fork: 0.30, shape: 'rounded' },
    analFin: { start: 0.42, end: 0.75, height: 0.18, shape: 'continuous' },
    pectoralFin: { x: 0.20, y: -0.01, length: 0.09, width: 0.04 },
    eye: { x: 0.08, yOffset: 0.30, r: 0.020 },
  },

  damselfish: {
    name: 'Damselfish',
    thickness: 0.20,          // small, oval, territorial
    camber: 0.03,
    camberPos: 0.38,
    bodyLength: 0.68,
    bellyBulge: 0.02,
    headBluntness: 1.3,
    tailNarrow: 0.05,
    colors: { body: '#2288ff', stripe: '#ffcc00', accent: '#003388', fin: '#1177ee' },
    dorsalFin: { start: 0.18, end: 0.68, height: 0.30, shape: 'continuous' },
    caudalFin: { spread: 0.18, length: 0.11, fork: 0.40, shape: 'forked' },
    analFin: { start: 0.42, end: 0.68, height: 0.22, shape: 'continuous' },
    pectoralFin: { x: 0.20, y: -0.02, length: 0.08, width: 0.04 },
    eye: { x: 0.09, yOffset: 0.30, r: 0.022 },
  },

  anthias: {
    name: 'Anthias',
    thickness: 0.14,          // small, graceful schooling fish
    camber: 0.02,
    camberPos: 0.38,
    bodyLength: 0.62,
    bellyBulge: 0.01,
    headBluntness: 1.1,
    tailNarrow: 0.04,
    colors: { body: '#ffbb22', stripe: '#cc44aa', accent: '#ff8800', fin: '#ffcc33' },
    dorsalFin: { start: 0.20, end: 0.58, height: 0.35, shape: 'pointed' },
    caudalFin: { spread: 0.28, length: 0.20, fork: 0.60, shape: 'forked' },  // lyretail
    analFin: { start: 0.42, end: 0.60, height: 0.18, shape: 'rounded' },
    pectoralFin: { x: 0.19, y: -0.01, length: 0.10, width: 0.05 },
    eye: { x: 0.08, yOffset: 0.30, r: 0.024 },
  },

  blenny: {
    name: 'Blenny',
    thickness: 0.13,          // elongated bottom-dweller
    camber: -0.02,            // negative camber — flat belly
    camberPos: 0.45,
    bodyLength: 0.75,
    bellyBulge: 0.0,
    headBluntness: 1.6,       // big blunt head
    tailNarrow: 0.03,
    colors: { body: '#667744', stripe: '#889966', accent: '#445522', fin: '#778855' },
    dorsalFin: { start: 0.10, end: 0.80, height: 0.15, shape: 'continuous' },  // very long low dorsal
    caudalFin: { spread: 0.10, length: 0.07, fork: 0.10, shape: 'rounded' },
    analFin: { start: 0.35, end: 0.80, height: 0.10, shape: 'continuous' },
    pectoralFin: { x: 0.16, y: -0.02, length: 0.09, width: 0.05 },
    eye: { x: 0.06, yOffset: 0.42, r: 0.024 },  // eyes high on head
  },

  filefish: {
    name: 'Filefish',
    thickness: 0.45,          // extremely deep body, very thin laterally
    camber: 0.02,
    camberPos: 0.40,
    bodyLength: 0.58,
    bellyBulge: 0.0,
    headBluntness: 0.5,       // small pointed mouth
    tailNarrow: 0.03,
    colors: { body: '#33bbaa', stripe: '#ffaa22', accent: '#228877', fin: '#44ccaa' },
    dorsalFin: { start: 0.30, end: 0.50, height: 0.20, shape: 'rounded' },  // small rounded dorsal
    caudalFin: { spread: 0.12, length: 0.08, fork: 0.10, shape: 'rounded' },  // tiny tail
    analFin: { start: 0.40, end: 0.72, height: 0.30, shape: 'continuous' },
    pectoralFin: { x: 0.18, y: -0.01, length: 0.06, width: 0.03 },  // tiny pectorals
    eye: { x: 0.08, yOffset: 0.26, r: 0.022 },
  },

  // ── Remaining tetra + additional species ──
  blackSkirtTetra: {
    name: 'Black Skirt Tetra',
    thickness: 0.18, camber: 0.02, camberPos: 0.38,
    bodyLength: 0.68, bellyBulge: 0.01, headBluntness: 1.1, tailNarrow: 0.04,
    colors: { body: '#555555', stripe: '#222222', accent: '#888888', fin: '#333333' },
    dorsalFin: { start: 0.28, end: 0.45, height: 0.30, shape: 'pointed' },
    caudalFin: { spread: 0.16, length: 0.11, fork: 0.40, shape: 'forked' },
    analFin: { start: 0.35, end: 0.72, height: 0.35, shape: 'flowing' },
    pectoralFin: { x: 0.20, y: -0.01, length: 0.07, width: 0.04 },
    eye: { x: 0.09, yOffset: 0.30, r: 0.020 },
  },
  pleco: {
    name: 'Bristlenose Pleco',
    thickness: 0.20, camber: -0.03, camberPos: 0.40,
    bodyLength: 0.68, bellyBulge: 0.0, headBluntness: 1.7, tailNarrow: 0.04,
    colors: { body: '#443322', stripe: '#665544', accent: '#332211', fin: '#554433' },
    dorsalFin: { start: 0.25, end: 0.45, height: 0.25, shape: 'pointed' },
    caudalFin: { spread: 0.16, length: 0.10, fork: 0.30, shape: 'forked' },
    analFin: { start: 0.50, end: 0.65, height: 0.12, shape: 'rounded' },
    pectoralFin: { x: 0.20, y: -0.04, length: 0.14, width: 0.08 },
    eye: { x: 0.07, yOffset: 0.40, r: 0.016 },
  },
};

// ── Generate body outline points ──
function generateBodyPoints(spec, numPoints = 80) {
  const top = [], bottom = [];

  // ── NOSE/SNOUT section ──
  // Prepend a pointed nose before the NACA body.
  // headBluntness controls how long/sharp the snout is:
  //   0.5 = long pointed snout (like butterflyfish)
  //   1.0 = moderate snout
  //   1.5+ = very short/blunt snout (like pufferfish)
  // The snout extends from x=-noseLen to x=0, tapering to a point.
  const noseLen = 0.04 / Math.max(0.5, spec.headBluntness);  // shorter, subtler nose point
  const nosePoints = 8;
  const nacaThickAtZero = nacaThickness(0.001, spec.thickness); // thickness right at start of NACA
  const ycAtZero = nacaCamber(0.001, spec.camber, spec.camberPos);

  for (let i = 0; i < nosePoints; i++) {
    const t = i / nosePoints;  // 0 = tip, 1 = joins NACA body
    const x = -noseLen * (1 - t);  // negative x = ahead of body
    // Cubic ease-in for natural taper from point to body width
    const taper = t * t * (3 - 2 * t);  // smoothstep
    const yt = nacaThickAtZero * taper;
    const yc = ycAtZero * t;
    const bellyExtra = spec.bellyBulge * Math.sin(0) * t;
    top.push({ x, y: yc + yt });
    bottom.push({ x, y: yc - yt - bellyExtra });
  }

  // ── NACA body section (skip x=0 since nose section already joins there) ──
  for (let i = 1; i <= numPoints; i++) {
    const x = i / numPoints;  // starts at 1/80 = 0.0125, avoids the zero-thickness pinch at x=0

    // NACA thickness at this position
    let yt = nacaThickness(x, spec.thickness);

    // Apply belly bulge (make bottom fuller)
    const bellyExtra = spec.bellyBulge * Math.sin(x * Math.PI);

    // Camber line (shifts the whole profile up/down asymmetrically)
    const yc = nacaCamber(x, spec.camber, spec.camberPos);

    // Ensure minimum thickness at tail (caudal peduncle)
    const peduncleBlend = Math.max(0, (x - 0.85) / 0.15);
    const minThick = spec.tailNarrow * (1 - peduncleBlend) + spec.tailNarrow * peduncleBlend;
    yt = Math.max(yt, minThick * (1 - peduncleBlend * 0.5));

    top.push({ x, y: yc + yt });
    bottom.push({ x, y: yc - yt - bellyExtra });
  }

  return { top, bottom };
}

// ── Generate fin shapes ──
function generateDorsalFin(spec, bodyTop) {
  const fin = spec.dorsalFin;
  const points = [];

  // Sample body points at fin attachment
  const startIdx = Math.floor(fin.start * bodyTop.length);
  const endIdx = Math.floor(fin.end * bodyTop.length);
  const attachStart = bodyTop[startIdx];
  const attachEnd = bodyTop[endIdx];

  // Start at attachment
  points.push({ ...attachStart });

  const numPts = 12;
  for (let i = 0; i <= numPts; i++) {
    const t = i / numPts;
    const x = attachStart.x + (attachEnd.x - attachStart.x) * t;
    const baseY = attachStart.y + (attachEnd.y - attachStart.y) * t;

    let finHeight;
    if (fin.shape === 'pennant') {
      // Moorish idol: tall narrow pennant that curves back
      finHeight = fin.height * Math.pow(Math.sin(t * Math.PI * 0.6), 0.5) * (1 - t * 0.3);
    } else if (fin.shape === 'spiny') {
      // Lionfish: tall individual separated spines/rays
      const nSpines = 10;
      const spineT = (t * nSpines) % 1.0;
      // Each spine is a sharp triangle — tall at center, drops to near-zero between
      const spineProfile = spineT < 0.5
        ? Math.pow(spineT * 2, 0.3)      // fast rise
        : Math.pow((1 - spineT) * 2, 0.3); // fast drop
      const envelope = Math.sin(t * Math.PI);  // overall envelope
      finHeight = fin.height * (spineProfile * 0.7 + 0.05) * envelope;
    } else if (fin.shape === 'flowing') {
      // Betta: large flowing shape with wavy edge
      const wave = 1 + Math.sin(t * Math.PI * 3) * 0.08;
      finHeight = fin.height * Math.sin(t * Math.PI) * wave;
    } else if (fin.shape === 'pointed') {
      // Angelfish: rises to a point then drops
      finHeight = fin.height * Math.pow(Math.sin(t * Math.PI), 0.7);
    } else if (fin.shape === 'continuous') {
      // Tang/discus: follows body contour closely
      finHeight = fin.height * Math.sin(t * Math.PI) * 0.8;
    } else if (fin.shape === 'trigger') {
      // Triggerfish: tall narrow spike that locks upright — ramp up then drop
      // Avoid overshoot at start by ramping from 0
      const rampUp = smoothstep(0, 0.15, t);     // gradual rise from attachment
      const rampDown = smoothstep(0.5, 1.0, t);   // drop off after spike
      finHeight = fin.height * rampUp * (1 - rampDown) * (t < 0.5 ? 1 : 0.05);
    } else if (fin.shape === 'fan') {
      // Mandarinfish: tall rounded fan shape
      const fanCurve = Math.sin(t * Math.PI);
      finHeight = fin.height * fanCurve * (1 + Math.sin(t * Math.PI * 5) * 0.04);
    } else {
      // Rounded default
      finHeight = fin.height * Math.sin(t * Math.PI);
    }

    points.push({ x, y: baseY + finHeight * spec.thickness });
  }

  points.push({ ...attachEnd });
  return points;
}

function generateAnalFin(spec, bodyBottom) {
  const fin = spec.analFin;
  const points = [];
  const startIdx = Math.floor(fin.start * bodyBottom.length);
  const endIdx = Math.floor(fin.end * bodyBottom.length);
  const attachStart = bodyBottom[startIdx];
  const attachEnd = bodyBottom[endIdx];

  points.push({ ...attachStart });

  const numPts = 10;
  for (let i = 0; i <= numPts; i++) {
    const t = i / numPts;
    const x = attachStart.x + (attachEnd.x - attachStart.x) * t;
    const baseY = attachStart.y + (attachEnd.y - attachStart.y) * t;

    let finHeight;
    if (fin.shape === 'flowing') {
      const wave = 1 + Math.sin(t * Math.PI * 3) * 0.06;
      finHeight = fin.height * Math.sin(t * Math.PI) * wave;
    } else if (fin.shape === 'spiny') {
      const spine = Math.abs(Math.sin(t * Math.PI * 5)) * 0.5 + 0.5;
      finHeight = fin.height * spine * Math.sin(t * Math.PI);
    } else if (fin.shape === 'pointed') {
      finHeight = fin.height * Math.pow(Math.sin(t * Math.PI), 0.7);
    } else {
      finHeight = fin.height * Math.sin(t * Math.PI);
    }

    points.push({ x, y: baseY - finHeight * spec.thickness });
  }

  points.push({ ...attachEnd });
  return points;
}

function generateCaudalFin(spec) {
  const fin = spec.caudalFin;
  const points = [];
  // Start where body ends (x=1)
  const baseY = nacaCamber(1.0, spec.camber, spec.camberPos);
  const halfThick = spec.tailNarrow * 0.5;

  if (fin.shape === 'veil') {
    // Betta: huge flowing veil tail
    const n = 20;
    points.push({ x: 1.0, y: baseY + halfThick });
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const angle = -Math.PI * 0.4 + t * Math.PI * 0.8;
      const r = fin.length * (0.8 + Math.sin(t * Math.PI * 4) * 0.05);
      points.push({ x: 1.0 + Math.cos(angle) * r, y: baseY + Math.sin(angle) * fin.spread });
    }
    points.push({ x: 1.0, y: baseY - halfThick });
  } else if (fin.shape === 'forked') {
    // Classic forked tail
    points.push({ x: 1.0, y: baseY + halfThick });
    points.push({ x: 1.0 + fin.length * 0.3, y: baseY + fin.spread * 0.4 });
    points.push({ x: 1.0 + fin.length * 0.7, y: baseY + fin.spread * 0.8 });
    points.push({ x: 1.0 + fin.length, y: baseY + fin.spread });
    // Fork notch
    points.push({ x: 1.0 + fin.length * 0.6, y: baseY + fin.fork * 0.02 });
    points.push({ x: 1.0 + fin.length * 0.5, y: baseY });
    points.push({ x: 1.0 + fin.length * 0.6, y: baseY - fin.fork * 0.02 });
    // Lower lobe
    points.push({ x: 1.0 + fin.length, y: baseY - fin.spread });
    points.push({ x: 1.0 + fin.length * 0.7, y: baseY - fin.spread * 0.8 });
    points.push({ x: 1.0 + fin.length * 0.3, y: baseY - fin.spread * 0.4 });
    points.push({ x: 1.0, y: baseY - halfThick });
  } else if (fin.shape === 'sword') {
    // Swordtail: normal tail with long lower extension
    points.push({ x: 1.0, y: baseY + halfThick });
    points.push({ x: 1.0 + fin.length * 0.3, y: baseY + fin.spread * 0.6 });
    points.push({ x: 1.0 + fin.length * 0.5, y: baseY + fin.spread * 0.4 });
    points.push({ x: 1.0 + fin.length * 0.4, y: baseY });
    // Sword extension (lower)
    points.push({ x: 1.0 + fin.length * 0.5, y: baseY - fin.spread * 0.3 });
    points.push({ x: 1.0 + fin.length * 0.8, y: baseY - fin.spread * 0.5 });
    points.push({ x: 1.0 + fin.length, y: baseY - fin.spread * 0.6 });
    points.push({ x: 1.0 + fin.length * 0.95, y: baseY - fin.spread * 0.7 });
    points.push({ x: 1.0 + fin.length * 0.5, y: baseY - fin.spread * 0.5 });
    points.push({ x: 1.0 + fin.length * 0.3, y: baseY - fin.spread * 0.3 });
    points.push({ x: 1.0, y: baseY - halfThick });
  } else if (fin.shape === 'curl') {
    // Seahorse: thin curling tail
    const n = 16;
    points.push({ x: 1.0, y: baseY + halfThick });
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const curl = t * Math.PI * 1.5;
      const r = fin.length * (1 - t * 0.6);
      points.push({ x: 1.0 + r * Math.cos(curl) * 0.5, y: baseY - r * Math.sin(curl) * 0.3 - t * fin.spread });
    }
    points.push({ x: 1.0, y: baseY - halfThick });
  } else if (fin.shape === 'slightly_forked') {
    // Slightly forked — fan shape with gentle notch
    points.push({ x: 1.0, y: baseY + halfThick });
    points.push({ x: 1.0 + fin.length * 0.4, y: baseY + fin.spread * 0.5 });
    points.push({ x: 1.0 + fin.length * 0.85, y: baseY + fin.spread * 0.95 });
    points.push({ x: 1.0 + fin.length, y: baseY + fin.spread });
    // Gentle trailing edge with slight concavity
    points.push({ x: 1.0 + fin.length * 0.88, y: baseY + fin.spread * 0.4 });
    points.push({ x: 1.0 + fin.length * 0.82, y: baseY });
    points.push({ x: 1.0 + fin.length * 0.88, y: baseY - fin.spread * 0.4 });
    points.push({ x: 1.0 + fin.length, y: baseY - fin.spread });
    points.push({ x: 1.0 + fin.length * 0.85, y: baseY - fin.spread * 0.95 });
    points.push({ x: 1.0 + fin.length * 0.4, y: baseY - fin.spread * 0.5 });
    points.push({ x: 1.0, y: baseY - halfThick });
  } else {
    // Rounded fan tail — natural fan shape, not a D
    points.push({ x: 1.0, y: baseY + halfThick });
    points.push({ x: 1.0 + fin.length * 0.35, y: baseY + fin.spread * 0.55 });
    points.push({ x: 1.0 + fin.length * 0.75, y: baseY + fin.spread * 0.9 });
    points.push({ x: 1.0 + fin.length, y: baseY + fin.spread });
    // Slightly concave trailing edge (natural fan look)
    points.push({ x: 1.0 + fin.length * 0.92, y: baseY + fin.spread * 0.35 });
    points.push({ x: 1.0 + fin.length * 0.88, y: baseY });
    points.push({ x: 1.0 + fin.length * 0.92, y: baseY - fin.spread * 0.35 });
    points.push({ x: 1.0 + fin.length, y: baseY - fin.spread });
    points.push({ x: 1.0 + fin.length * 0.75, y: baseY - fin.spread * 0.9 });
    points.push({ x: 1.0 + fin.length * 0.35, y: baseY - fin.spread * 0.55 });
    points.push({ x: 1.0, y: baseY - halfThick });
  }

  return points;
}

function generatePectoralFin(spec, bodyTop, bodyBottom) {
  const fin = spec.pectoralFin;
  const points = [];
  const cx = fin.x, cy = fin.y;

  // Small teardrop shape
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const angle = t * Math.PI * 2;
    const rx = fin.length * (0.5 + 0.5 * Math.cos(angle));
    const ry = fin.width * Math.sin(angle);
    points.push({ x: cx + rx * 0.8, y: cy + ry });
  }

  return points;
}

// ── Catmull-Rom for smooth rendering ──
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * (2*p1.x + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * (2*p1.y + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

function smoothPoints(pts, segsPerSpan = 6) {
  if (pts.length < 4) return pts;
  const padded = [
    { x: 2*pts[0].x - pts[1].x, y: 2*pts[0].y - pts[1].y },
    ...pts,
    { x: 2*pts[pts.length-1].x - pts[pts.length-2].x, y: 2*pts[pts.length-1].y - pts[pts.length-2].y }
  ];
  const result = [];
  for (let i = 1; i < padded.length - 2; i++) {
    for (let j = 0; j < segsPerSpan; j++) {
      result.push(catmullRom(padded[i-1], padded[i], padded[i+1], padded[i+2], j/segsPerSpan));
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// ── Seahorse custom renderer (vertical body, curled tail, not NACA) ──
function renderSeahorse(specName, spec, mode = 'colored') {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const colors = spec.colors;
  const cx = SIZE / 2, cy = SIZE / 2;
  const bodyScale = SIZE * 0.38;

  // Seahorse is drawn vertically: head at top, curled tail at bottom
  // Body curve points (spine) — S-curve from top to bottom
  const spinePoints = [];
  const numSpine = 40;
  for (let i = 0; i <= numSpine; i++) {
    const t = i / numSpine; // 0=head, 1=tail tip
    // Vertical main axis with gentle S-curve
    const y = cy - bodyScale * 0.55 + t * bodyScale * 1.3;
    const xOff = Math.sin(t * Math.PI * 0.7) * bodyScale * 0.12  // belly curve outward
              - Math.sin(t * Math.PI * 1.5 + 0.5) * bodyScale * 0.06;  // slight S
    const x = cx + xOff;
    spinePoints.push({ x, y });
  }

  // Width profile along spine: thick at head/belly, narrows toward tail
  function bodyWidth(t) {
    if (t < 0.08) return 0.25 + t * 2.0;         // snout widens
    if (t < 0.18) return 0.41;                     // head
    if (t < 0.25) return 0.40 + (t - 0.18) * 0.6; // crown/head bump
    if (t < 0.45) return 0.44;                     // chest/belly — widest
    if (t < 0.55) return 0.44 - (t - 0.45) * 1.2; // narrowing
    // Tail section — gets progressively thinner
    return Math.max(0.04, 0.32 - (t - 0.55) * 0.6);
  }

  // Build body outline
  const leftPts = [], rightPts = [];
  for (let i = 0; i <= numSpine; i++) {
    const t = i / numSpine;
    const sp = spinePoints[i];
    const w = bodyWidth(t) * bodyScale * 0.28;
    // Normal direction (perpendicular to spine)
    let nx = 1, ny = 0;
    if (i > 0 && i < numSpine) {
      const dx = spinePoints[i+1].x - spinePoints[i-1].x;
      const dy = spinePoints[i+1].y - spinePoints[i-1].y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    }
    leftPts.push({ x: sp.x - nx * w, y: sp.y - ny * w });
    rightPts.push({ x: sp.x + nx * w, y: sp.y + ny * w });
  }

  // Curled tail: continues from bottom of spine, curling inward
  const tailPts = [];
  const tailStart = spinePoints[numSpine];
  const numTail = 30;
  for (let i = 0; i <= numTail; i++) {
    const t = i / numTail;
    const angle = t * Math.PI * 2.2 + Math.PI * 0.3; // ~2 full curls
    const radius = bodyScale * 0.18 * (1 - t * 0.7);
    const tx = tailStart.x + Math.sin(angle) * radius + t * bodyScale * 0.05;
    const ty = tailStart.y + t * bodyScale * 0.15 + Math.cos(angle) * radius * 0.3;
    const w = bodyScale * 0.03 * (1 - t * 0.8);
    tailPts.push({ x: tx, y: ty, w });
  }

  // Snout: elongated tube pointing upward-forward from head
  const snoutBase = spinePoints[2];
  const snoutTip = { x: snoutBase.x + bodyScale * 0.05, y: snoutBase.y - bodyScale * 0.12 };

  // Draw dorsal fin (small, on the back)
  const dorsalCenter = Math.floor(numSpine * 0.4);
  ctx.beginPath();
  for (let i = -4; i <= 4; i++) {
    const idx = Math.max(0, Math.min(numSpine, dorsalCenter + i));
    const sp = spinePoints[idx];
    const depth = Math.cos(i / 4 * Math.PI * 0.5) * bodyScale * 0.08;
    if (i === -4) ctx.moveTo(leftPts[idx].x, leftPts[idx].y);
    ctx.lineTo(leftPts[idx].x - depth, leftPts[idx].y);
  }
  for (let i = 4; i >= -4; i--) {
    const idx = Math.max(0, Math.min(numSpine, dorsalCenter + i));
    ctx.lineTo(leftPts[idx].x, leftPts[idx].y);
  }
  ctx.closePath();
  ctx.fillStyle = mode === 'silhouette' ? 'rgba(180,180,200,0.6)' : colors.fin + 'aa';
  ctx.fill();
  ctx.strokeStyle = mode === 'silhouette' ? 'rgba(140,140,160,0.7)' : colors.fin + '88';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw curled tail
  ctx.beginPath();
  ctx.moveTo(tailPts[0].x, tailPts[0].y);
  for (const tp of tailPts) ctx.lineTo(tp.x, tp.y);
  for (let i = tailPts.length - 1; i >= 0; i--) {
    ctx.lineTo(tailPts[i].x + tailPts[i].w, tailPts[i].y + tailPts[i].w * 0.5);
  }
  ctx.closePath();
  if (mode === 'silhouette') {
    ctx.fillStyle = '#e0d8d0';
  } else {
    ctx.fillStyle = darkenColor(colors.body, 20);
  }
  ctx.fill();
  ctx.strokeStyle = mode === 'silhouette' ? '#aaa49c' : darkenColor(colors.body, 40);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw body
  ctx.beginPath();
  ctx.moveTo(rightPts[0].x, rightPts[0].y);
  for (const p of rightPts) ctx.lineTo(p.x, p.y);
  for (let i = leftPts.length - 1; i >= 0; i--) ctx.lineTo(leftPts[i].x, leftPts[i].y);
  ctx.closePath();

  if (mode === 'silhouette') {
    const grad = ctx.createLinearGradient(cx - bodyScale*0.3, 0, cx + bodyScale*0.3, 0);
    grad.addColorStop(0, '#e0d8d0');
    grad.addColorStop(0.5, '#f0ebe6');
    grad.addColorStop(1, '#d8d0c8');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(cx - bodyScale*0.3, 0, cx + bodyScale*0.3, 0);
    grad.addColorStop(0, darkenColor(colors.body, 15));
    grad.addColorStop(0.5, colors.body);
    grad.addColorStop(1, lightenColor(colors.body, 20));
    ctx.fillStyle = grad;
  }
  ctx.fill();

  // Body ridges (horizontal rings typical of seahorse)
  if (mode === 'colored') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rightPts[0].x, rightPts[0].y);
    for (const p of rightPts) ctx.lineTo(p.x, p.y);
    for (let i = leftPts.length - 1; i >= 0; i--) ctx.lineTo(leftPts[i].x, leftPts[i].y);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = darkenColor(colors.body, 25) + '66';
    ctx.lineWidth = 1;
    for (let i = 2; i < numSpine; i += 2) {
      ctx.beginPath();
      ctx.moveTo(leftPts[i].x, leftPts[i].y);
      ctx.lineTo(rightPts[i].x, rightPts[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Body outline
  ctx.beginPath();
  ctx.moveTo(rightPts[0].x, rightPts[0].y);
  for (const p of rightPts) ctx.lineTo(p.x, p.y);
  for (let i = leftPts.length - 1; i >= 0; i--) ctx.lineTo(leftPts[i].x, leftPts[i].y);
  ctx.closePath();
  ctx.strokeStyle = mode === 'silhouette' ? '#aaa49c' : darkenColor(colors.body, 40);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Snout
  ctx.beginPath();
  ctx.moveTo(snoutBase.x + bodyScale * 0.03, snoutBase.y);
  ctx.lineTo(snoutTip.x + bodyScale * 0.01, snoutTip.y);
  ctx.lineTo(snoutTip.x - bodyScale * 0.01, snoutTip.y);
  ctx.lineTo(snoutBase.x - bodyScale * 0.03, snoutBase.y);
  ctx.closePath();
  ctx.fillStyle = mode === 'silhouette' ? '#e0d8d0' : colors.body;
  ctx.fill();
  ctx.strokeStyle = mode === 'silhouette' ? '#aaa49c' : darkenColor(colors.body, 40);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Crown/coronet (small bumps on top of head)
  const headTop = spinePoints[4];
  for (let i = -2; i <= 2; i++) {
    const bx = headTop.x + i * bodyScale * 0.02;
    const by = leftPts[4].y - bodyScale * 0.02 - Math.abs(i) * bodyScale * 0.005;
    ctx.beginPath();
    ctx.arc(bx, by, bodyScale * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = mode === 'silhouette' ? '#d8d0c8' : darkenColor(colors.body, 10);
    ctx.fill();
  }

  // Eye
  const eyePos = spinePoints[5];
  const eyeR = bodyScale * 0.032;
  ctx.beginPath();
  ctx.arc(eyePos.x + bodyScale * 0.04, eyePos.y, eyeR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(eyePos.x + bodyScale * 0.04 + eyeR * 0.1, eyePos.y, eyeR * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#111111';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyePos.x + bodyScale * 0.04 - eyeR * 0.15, eyePos.y - eyeR * 0.15, eyeR * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Label
  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`${specName} — seahorse (custom vertical)`, 10, SIZE - 10);

  return canvas;
}

// ── Species-specific pattern overlay (perlin noise based) ──
function renderPatternOverlay(ctx, specName, spec, topSmooth, botSmooth, bodyMinX, bodyMaxX, bodyMinY, bodyMaxY) {
  const colors = spec.colors;

  ctx.save();
  // Re-create body clip path
  ctx.beginPath();
  ctx.moveTo(topSmooth[0].x, topSmooth[0].y);
  for (const p of topSmooth) ctx.lineTo(p.x, p.y);
  for (const p of botSmooth) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.clip();

  const bodyW = bodyMaxX - bodyMinX;
  const bodyH = bodyMaxY - bodyMinY;
  const tw = Math.ceil(bodyW);
  const th = Math.ceil(bodyH);

  if (tw < 2 || th < 2) { ctx.restore(); return; }

  // Create temporary canvas for pixel-level pattern
  const tmpCanvas = createCanvas(tw, th);
  const tmpCtx = tmpCanvas.getContext('2d');
  const imgData = tmpCtx.createImageData(tw, th);
  const data = imgData.data;

  // Noise scale factors — normalized coords for consistent look
  const nsx = 1.0 / tw;  // pixel to 0..1
  const nsy = 1.0 / th;

  if (specName === 'emperorAngelfish') {
    // Dense horizontal yellow stripes on deep blue, dark face mask, yellow tail
    const bodyRGB = hexToRGB(colors.body);
    const stripeRGB = hexToRGB(colors.stripe);
    const darkFace = [10, 15, 60];
    const yellowTail = [255, 220, 0];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Yellow tail — rear 15%
        const wobble = perlin2D(u * 3, v * 5, 2, 2.0, 0.5) * 0.03;
        if (u > 0.85 + wobble) {
          data[idx] = yellowTail[0]; data[idx+1] = yellowTail[1]; data[idx+2] = yellowTail[2]; data[idx+3] = 200;
          continue;
        }
        // Dark face mask — front 12%
        if (u < 0.12 + wobble) {
          data[idx] = darkFace[0]; data[idx+1] = darkFace[1]; data[idx+2] = darkFace[2]; data[idx+3] = 210;
          continue;
        }
        // Dense thin horizontal yellow stripes on blue — high frequency, narrow peaks
        const stripeWobble = perlin2D(u * 4, v * 3, 3, 2.0, 0.5) * 0.025;
        const stripePhase = Math.sin((v + stripeWobble) * Math.PI * 32);
        const isStripe = stripePhase > 0.65 ? 1.0 : 0.0;
        const rgb = blendRGB(bodyRGB, stripeRGB, isStripe);
        data[idx] = rgb[0]; data[idx+1] = rgb[1]; data[idx+2] = rgb[2]; data[idx+3] = 210;
      }
    }
  } else if (specName === 'clownfish') {
    // 3 vertical white bands with organic perlin-wobbled edges + black border
    const bodyRGB = hexToRGB(colors.body);
    const stripeRGB = hexToRGB(colors.stripe);
    const blackRGB = [0, 0, 0];
    const bandCenters = [0.25, 0.50, 0.78];
    const bandWidths = [0.06, 0.05, 0.04];
    // Tail black band (bigger, like real clownfish)
    const tailBlackStart = 0.88;
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;  // 0..1 across body
        const v = py / th;
        const wobble = perlin2D(u * 3, v * 5, 3, 2.0, 0.5) * 0.04 - 0.02;
        let inBand = false, inBorder = false;
        for (let b = 0; b < 3; b++) {
          const dist = Math.abs(u - bandCenters[b] + wobble);
          if (dist < bandWidths[b] * 0.7) inBand = true;
          else if (dist < bandWidths[b] * 1.0) inBorder = true;
        }
        // Tail black band
        const tailDist = u - tailBlackStart + wobble * 0.5;
        const inTailBlack = tailDist > 0;
        const idx = (py * tw + px) * 4;
        if (inTailBlack) {
          data[idx] = blackRGB[0]; data[idx+1] = blackRGB[1]; data[idx+2] = blackRGB[2]; data[idx+3] = 200;
        } else if (inBand) {
          data[idx] = stripeRGB[0]; data[idx+1] = stripeRGB[1]; data[idx+2] = stripeRGB[2]; data[idx+3] = 220;
        } else if (inBorder) {
          data[idx] = blackRGB[0]; data[idx+1] = blackRGB[1]; data[idx+2] = blackRGB[2]; data[idx+3] = 180;
        } else {
          // Subtle orange variation
          const mottle = 0.9 + perlin2D(u * 10, v * 10, 2) * 0.2;
          data[idx] = Math.min(255, Math.round(bodyRGB[0] * mottle));
          data[idx+1] = Math.min(255, Math.round(bodyRGB[1] * mottle));
          data[idx+2] = Math.min(255, Math.round(bodyRGB[2] * mottle));
          data[idx+3] = 160;
        }
      }
    }
  } else if (specName === 'lionfish') {
    // Alternating red/white stripes with perlin-wobbled boundaries, narrow spacing
    const bodyRGB = hexToRGB(colors.body);
    const stripeRGB = hexToRGB(colors.stripe);
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const wobble = perlin2D(u * 4, v * 2, 3, 2.0, 0.5) * 0.06;
        const stripe = Math.sin((v + wobble) * Math.PI * 14);
        const isWhite = stripe > 0;
        const rgb = isWhite ? stripeRGB : bodyRGB;
        const idx = (py * tw + px) * 4;
        data[idx] = rgb[0]; data[idx+1] = rgb[1]; data[idx+2] = rgb[2]; data[idx+3] = 180;
      }
    }
  } else if (specName === 'moorishIdol') {
    // Vertical yellow/black/white bands with perlin wobble at boundaries
    const bandDefs = [
      { end: 0.12, rgb: hexToRGB(colors.accent) },    // white
      { end: 0.30, rgb: hexToRGB(colors.body) },       // yellow
      { end: 0.42, rgb: hexToRGB(colors.stripe) },     // black
      { end: 0.62, rgb: hexToRGB(colors.body) },       // yellow
      { end: 0.78, rgb: hexToRGB(colors.stripe) },     // black
      { end: 1.01, rgb: hexToRGB(colors.accent) },     // white
    ];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const wobble = perlin2D(u * 2, v * 5, 3, 2.0, 0.5) * 0.04 - 0.02;
        const wu = u + wobble;
        let rgb = bandDefs[bandDefs.length - 1].rgb;
        for (const bd of bandDefs) {
          if (wu < bd.end) { rgb = bd.rgb; break; }
        }
        const idx = (py * tw + px) * 4;
        data[idx] = rgb[0]; data[idx+1] = rgb[1]; data[idx+2] = rgb[2]; data[idx+3] = 190;
      }
    }
  } else if (specName === 'banggaiCardinal') {
    // Bold black vertical bars on silver, white dots inside bars
    const bodyRGB = hexToRGB(colors.body);
    const barRGB = hexToRGB(colors.stripe);
    const dotRGB = hexToRGB(colors.accent);
    const barCenters = [0.22, 0.42, 0.62];
    const barWidth = 0.08;
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const wobble = perlin2D(u * 3, v * 6, 3, 2.0, 0.5) * 0.03 - 0.015;
        let inBar = false;
        for (const bc of barCenters) {
          if (Math.abs(u - bc + wobble) < barWidth) { inBar = true; break; }
        }
        const idx = (py * tw + px) * 4;
        if (inBar) {
          // Scatter white dots inside bars using perlin threshold
          const dotNoise = perlin2D(u * 25, v * 25, 2, 2.0, 0.5);
          if (dotNoise > 0.72) {
            data[idx] = dotRGB[0]; data[idx+1] = dotRGB[1]; data[idx+2] = dotRGB[2]; data[idx+3] = 200;
          } else {
            data[idx] = barRGB[0]; data[idx+1] = barRGB[1]; data[idx+2] = barRGB[2]; data[idx+3] = 210;
          }
        } else {
          const mottle = 0.92 + perlin2D(u * 12, v * 12, 2) * 0.16;
          data[idx] = Math.min(255, Math.round(bodyRGB[0] * mottle));
          data[idx+1] = Math.min(255, Math.round(bodyRGB[1] * mottle));
          data[idx+2] = Math.min(255, Math.round(bodyRGB[2] * mottle));
          data[idx+3] = 160;
        }
      }
    }
  } else if (specName === 'mandarinfish') {
    // Domain-warped perlin creating psychedelic blue/orange swirls
    const bodyRGB = hexToRGB(colors.body);
    const stripeRGB = hexToRGB(colors.stripe);
    const accentRGB = hexToRGB(colors.accent);
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const [wu, wv] = domainWarp(u * 4, v * 4, 1.5);
        const n = perlin2D(wu, wv, 4, 2.0, 0.5);
        // Create flowing organic lines
        const contour = Math.abs((n * 6) % 1.0 - 0.5);
        let rgb;
        if (contour < 0.06) {
          rgb = stripeRGB;  // orange lines
        } else if (contour < 0.10) {
          rgb = accentRGB;  // green edge
        } else {
          rgb = bodyRGB;    // blue fill
        }
        const idx = (py * tw + px) * 4;
        data[idx] = rgb[0]; data[idx+1] = rgb[1]; data[idx+2] = rgb[2]; data[idx+3] = 200;
      }
    }
  } else if (specName === 'neonTetra') {
    // Horizontal iridescent blue-green stripe + red lower body behind midpoint
    const bodyRGB = hexToRGB(colors.body);
    const accentRGB = hexToRGB(colors.accent);
    const iridBlue = [0, 180, 255];
    const iridGreen = [0, 255, 200];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const shimmer = perlin2D(u * 12, v * 12, 2, 2.0, 0.5) * 0.04;
        // Iridescent stripe band: centered at v~0.38, width ~0.14
        const stripeDist = Math.abs(v - 0.38 + shimmer);
        const stripeIntensity = smoothstep(0.09, 0.02, stripeDist);
        // Color shifts blue to green across body
        const iridRGB = blendRGB(iridGreen, iridBlue, u);
        // Red lower half behind midpoint
        const redIntensity = smoothstep(0.45, 0.55, u) * smoothstep(0.45, 0.55, v);
        const idx = (py * tw + px) * 4;
        if (stripeIntensity > 0.1) {
          const rgb = blendRGB(bodyRGB, iridRGB, stripeIntensity);
          data[idx] = rgb[0]; data[idx+1] = rgb[1]; data[idx+2] = rgb[2]; data[idx+3] = Math.round(stripeIntensity * 220);
        } else if (redIntensity > 0.1) {
          const rgb = blendRGB(bodyRGB, accentRGB, redIntensity);
          data[idx] = rgb[0]; data[idx+1] = rgb[1]; data[idx+2] = rgb[2]; data[idx+3] = Math.round(redIntensity * 180);
        } else {
          data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 0;
        }
      }
    }
  } else if (specName === 'pufferfish') {
    // Figure-eight puffer: dark green/black body with yellow maze/contour pattern
    const darkBody = [26, 42, 26];
    const yellowLine = [221, 187, 34];
    const whiteBelly = [220, 220, 200];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Base: dark green-black
        let r = darkBody[0], g = darkBody[1], b = darkBody[2];
        // White belly — lower 30%
        if (v > 0.68) {
          const bellyBlend = smoothstep(0.68, 0.85, v);
          r = Math.round(r + (whiteBelly[0] - r) * bellyBlend);
          g = Math.round(g + (whiteBelly[1] - g) * bellyBlend);
          b = Math.round(b + (whiteBelly[2] - b) * bellyBlend);
        }
        // Yellow maze/figure-eight pattern — perlin contour lines
        const n = perlin2D(u * 6, v * 6, 4, 2.0, 0.5);
        const contour = Math.abs((n * 6) % 1.0 - 0.5);
        if (contour < 0.10 && v < 0.70) {
          const lineBlend = (1.0 - contour / 0.10) * 0.9;
          r = Math.round(r + (yellowLine[0] - r) * lineBlend);
          g = Math.round(g + (yellowLine[1] - g) * lineBlend);
          b = Math.round(b + (yellowLine[2] - b) * lineBlend);
        }
        const mottle = 0.92 + perlin2D(u * 12, v * 12, 2) * 0.16;
        data[idx] = Math.min(255, Math.round(r * mottle));
        data[idx+1] = Math.min(255, Math.round(g * mottle));
        data[idx+2] = Math.min(255, Math.round(b * mottle));
        data[idx+3] = 210;
      }
    }
  } else if (specName === 'tang') {
    // Powder blue tang: vivid blue body, dark face mask, yellow dorsal accent, white lower chest
    const bodyRGB = hexToRGB(colors.body);      // bright blue
    const darkRGB = hexToRGB(colors.stripe);     // dark face
    const accentRGB = hexToRGB(colors.accent);   // yellow
    const whiteRGB = [240, 240, 255];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const wobble = perlin2D(u * 3, v * 5, 3, 2.0, 0.5) * 0.04 - 0.02;
        const idx = (py * tw + px) * 4;
        // Dark face mask — front 15% of body
        const faceBound = 0.15 + wobble;
        if (u < faceBound) {
          data[idx] = darkRGB[0]; data[idx+1] = darkRGB[1]; data[idx+2] = darkRGB[2]; data[idx+3] = 200;
        }
        // Yellow dorsal accent — top 20% of body, behind head
        else if (v < 0.20 + wobble * 0.5 && u > 0.12 && u < 0.75) {
          data[idx] = accentRGB[0]; data[idx+1] = accentRGB[1]; data[idx+2] = accentRGB[2]; data[idx+3] = 180;
        }
        // White chest/throat — lower front area
        else if (u < 0.30 + wobble && v > 0.65) {
          data[idx] = whiteRGB[0]; data[idx+1] = whiteRGB[1]; data[idx+2] = whiteRGB[2]; data[idx+3] = 140;
        }
        // Main blue body
        else {
          const mottle = 0.9 + perlin2D(u * 10, v * 10, 2) * 0.2;
          data[idx] = Math.min(255, Math.round(bodyRGB[0] * mottle));
          data[idx+1] = Math.min(255, Math.round(bodyRGB[1] * mottle));
          data[idx+2] = Math.min(255, Math.round(bodyRGB[2] * mottle));
          data[idx+3] = 170;
        }
      }
    }
  } else if (specName === 'regalTang') {
    // Regal/palette tang: dark blue body with yellow tail
    const bodyRGB = hexToRGB(colors.body);
    const darkRGB = hexToRGB(colors.stripe);
    const accentRGB = hexToRGB(colors.accent);
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const wobble = perlin2D(u * 3, v * 5, 3, 2.0, 0.5) * 0.06 - 0.03;
        const inDark = u > 0.18 + wobble && u < 0.76 + wobble;
        const inTail = u > 0.80 + wobble * 0.5;
        const idx = (py * tw + px) * 4;
        if (inTail) {
          data[idx] = accentRGB[0]; data[idx+1] = accentRGB[1]; data[idx+2] = accentRGB[2]; data[idx+3] = 180;
        } else if (inDark) {
          const mottle = 0.85 + perlin2D(u * 10, v * 10, 2) * 0.3;
          data[idx] = Math.min(255, Math.round(darkRGB[0] * mottle));
          data[idx+1] = Math.min(255, Math.round(darkRGB[1] * mottle));
          data[idx+2] = Math.min(255, Math.round(darkRGB[2] * mottle));
          data[idx+3] = 160;
        } else {
          data[idx] = bodyRGB[0]; data[idx+1] = bodyRGB[1]; data[idx+2] = bodyRGB[2]; data[idx+3] = 100;
        }
      }
    }
  } else if (specName === 'copperBandButterfly') {
    // Vertical orange bands with perlin-wobbled edges, dark eye stripe
    const bodyRGB = hexToRGB(colors.body);
    const stripeRGB = hexToRGB(colors.stripe);
    const accentRGB = hexToRGB(colors.accent);
    const bandCenters = [0.14, 0.32, 0.50, 0.68, 0.84];
    const bandW = 0.05;
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const wobble = perlin2D(u * 3, v * 6, 3, 2.0, 0.5) * 0.03 - 0.015;
        // Eye stripe
        const eyeDist = Math.abs(u - 0.08 + wobble);
        if (eyeDist < 0.03) {
          const idx = (py * tw + px) * 4;
          data[idx] = accentRGB[0]; data[idx+1] = accentRGB[1]; data[idx+2] = accentRGB[2]; data[idx+3] = 200;
          continue;
        }
        let inBand = false, inEdge = false;
        for (const bc of bandCenters) {
          const dist = Math.abs(u - bc + wobble);
          if (dist < bandW * 0.6) { inBand = true; break; }
          else if (dist < bandW * 0.85) { inEdge = true; break; }
        }
        const idx = (py * tw + px) * 4;
        if (inBand) {
          data[idx] = stripeRGB[0]; data[idx+1] = stripeRGB[1]; data[idx+2] = stripeRGB[2]; data[idx+3] = 210;
        } else if (inEdge) {
          data[idx] = accentRGB[0]; data[idx+1] = accentRGB[1]; data[idx+2] = accentRGB[2]; data[idx+3] = 120;
        } else {
          data[idx] = bodyRGB[0]; data[idx+1] = bodyRGB[1]; data[idx+2] = bodyRGB[2]; data[idx+3] = 80;
        }
      }
    }
  } else if (specName === 'butterflyfish') {
    // Copperband-style: vertical orange stripes on white, black eye stripe, dorsal eyespot
    const bodyRGB = hexToRGB(colors.body);       // white/cream
    const stripeRGB = hexToRGB(colors.stripe);    // orange
    const accentRGB = hexToRGB(colors.accent);    // black
    const bandCenters = [0.18, 0.36, 0.54, 0.72];
    const bandW = 0.05;
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const wobble = perlin2D(u * 3, v * 6, 3, 2.0, 0.5) * 0.03 - 0.015;
        const idx = (py * tw + px) * 4;
        // Black eye stripe
        const eyeDist = Math.abs(u - 0.09 + wobble);
        if (eyeDist < 0.025) {
          data[idx] = accentRGB[0]; data[idx+1] = accentRGB[1]; data[idx+2] = accentRGB[2]; data[idx+3] = 200;
          continue;
        }
        // Dorsal eyespot — dark dot near top-rear
        const spotDx = u - 0.62, spotDy = v - 0.10;
        const spotDist = Math.sqrt(spotDx * spotDx + spotDy * spotDy);
        if (spotDist < 0.04) {
          data[idx] = accentRGB[0]; data[idx+1] = accentRGB[1]; data[idx+2] = accentRGB[2]; data[idx+3] = 200;
          continue;
        }
        // Orange vertical bands
        let inBand = false, inEdge = false;
        for (const bc of bandCenters) {
          const dist = Math.abs(u - bc + wobble);
          if (dist < bandW * 0.6) { inBand = true; break; }
          else if (dist < bandW * 0.85) { inEdge = true; break; }
        }
        if (inBand) {
          data[idx] = stripeRGB[0]; data[idx+1] = stripeRGB[1]; data[idx+2] = stripeRGB[2]; data[idx+3] = 210;
        } else if (inEdge) {
          data[idx] = accentRGB[0]; data[idx+1] = accentRGB[1]; data[idx+2] = accentRGB[2]; data[idx+3] = 100;
        } else {
          data[idx] = bodyRGB[0]; data[idx+1] = bodyRGB[1]; data[idx+2] = bodyRGB[2]; data[idx+3] = 80;
        }
      }
    }
  } else if (specName === 'cardinalTetra') {
    // Cardinal tetra: vivid red lower body, iridescent neon blue horizontal stripe
    const red = [204, 17, 34];
    const neonBlue = [0, 140, 255];
    const darkBack = [40, 20, 30];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        const shimmer = perlin2D(u * 14, v * 14, 2) * 0.025;
        // Neon blue stripe — horizontal band at ~35-45% height, full body length
        const stripeDist = Math.abs(v - 0.40 + shimmer);
        if (stripeDist < 0.08) {
          const intensity = 1.0 - stripeDist / 0.08;
          const iridescence = 0.85 + perlin2D(u * 20, v * 20, 2) * 0.3;
          data[idx] = Math.min(255, Math.round(neonBlue[0] * iridescence));
          data[idx+1] = Math.min(255, Math.round(neonBlue[1] * iridescence));
          data[idx+2] = Math.min(255, Math.round(neonBlue[2] * iridescence));
          data[idx+3] = Math.round(intensity * 230);
        }
        // Red lower body (below stripe)
        else if (v > 0.42) {
          const mottle = 0.90 + perlin2D(u * 10, v * 10, 2) * 0.2;
          data[idx] = Math.min(255, Math.round(red[0] * mottle));
          data[idx+1] = Math.min(255, Math.round(red[1] * mottle));
          data[idx+2] = Math.min(255, Math.round(red[2] * mottle));
          data[idx+3] = 200;
        }
        // Dark dorsal (above stripe)
        else {
          data[idx] = darkBack[0]; data[idx+1] = darkBack[1]; data[idx+2] = darkBack[2]; data[idx+3] = 150;
        }
      }
    }
  } else if (specName === 'clownTrigger') {
    // Clown triggerfish: dark brown body, large white spots on belly, yellow leopard on top, yellow mouth
    const darkBrown = [40, 30, 20];
    const yellow = [255, 200, 0];
    const white = [255, 255, 255];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;

        // Base: dark brown/black
        let r = darkBrown[0], g = darkBrown[1], b = darkBrown[2];

        // Yellow mouth area (front 15%)
        if (u < 0.15) {
          const blend = smoothstep(0.15, 0.05, u);
          r = Math.round(r + (yellow[0] - r) * blend);
          g = Math.round(g + (yellow[1] - g) * blend);
          b = Math.round(b + (yellow[2] - b) * blend);
        }

        // Large white spots on lower body (belly region)
        if (v > 0.45) {
          const spotNoise = perlin2D(u * 5 + 0.5, v * 5, 2, 2.0, 0.5);
          if (spotNoise > 0.58) {
            const spotBlend = smoothstep(0.58, 0.65, spotNoise);
            r = Math.round(r + (white[0] - r) * spotBlend);
            g = Math.round(g + (white[1] - g) * spotBlend);
            b = Math.round(b + (white[2] - b) * spotBlend);
          }
        }

        // Yellow leopard spots on upper body (dorsal region)
        if (v < 0.55) {
          const leopNoise = perlin2D(u * 8 + 3.7, v * 8 + 1.2, 3, 2.0, 0.5);
          if (leopNoise > 0.52) {
            const leopBlend = smoothstep(0.52, 0.62, leopNoise) * (1 - v / 0.55);
            r = Math.round(r + (yellow[0] - r) * leopBlend);
            g = Math.round(g + (yellow[1] - g) * leopBlend);
            b = Math.round(b + (yellow[2] - b) * leopBlend);
          }
        }

        // Yellow band along tail edge
        if (u > 0.82) {
          const tailBlend = smoothstep(0.82, 0.92, u) * 0.7;
          r = Math.round(r + (yellow[0] - r) * tailBlend);
          g = Math.round(g + (yellow[1] - g) * tailBlend);
          b = Math.round(b + (yellow[2] - b) * tailBlend);
        }

        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 220;
      }
    }
  } else if (specName === 'foxface') {
    // Foxface rabbitfish: bright yellow body, black/white face mask, dark dorsal area
    const bodyYellow = [255, 200, 0];
    const black = [20, 15, 10];
    const white = [240, 235, 220];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;

        // Base: bright yellow
        let r = bodyYellow[0], g = bodyYellow[1], b = bodyYellow[2];

        // Black/white face mask (front 25%)
        if (u < 0.25) {
          const faceMask = smoothstep(0.25, 0.10, u);
          // Upper face: black
          if (v < 0.5) {
            const blackBlend = faceMask * smoothstep(0.5, 0.3, v);
            r = Math.round(r + (black[0] - r) * blackBlend);
            g = Math.round(g + (black[1] - g) * blackBlend);
            b = Math.round(b + (black[2] - b) * blackBlend);
          }
          // White chin/lower face
          if (v > 0.4) {
            const whiteBlend = faceMask * smoothstep(0.4, 0.6, v) * 0.8;
            r = Math.round(r + (white[0] - r) * whiteBlend);
            g = Math.round(g + (white[1] - g) * whiteBlend);
            b = Math.round(b + (white[2] - b) * whiteBlend);
          }
          // Dark eye stripe
          const eyeStripe = Math.abs(v - 0.38);
          if (eyeStripe < 0.06 && u < 0.20) {
            r = black[0]; g = black[1]; b = black[2];
          }
        }

        // Dark dorsal edge (top 15%)
        if (v < 0.15) {
          const darkTop = smoothstep(0.15, 0.02, v) * 0.6;
          r = Math.round(r * (1 - darkTop * 0.5));
          g = Math.round(g * (1 - darkTop * 0.3));
          b = Math.round(b * (1 - darkTop * 0.6));
        }

        // Subtle perlin body mottling
        const mottle = 0.9 + perlin2D(u * 8, v * 8, 2) * 0.2;
        r = Math.min(255, Math.round(r * mottle));
        g = Math.min(255, Math.round(g * mottle));
        b = Math.min(255, Math.round(b * mottle));

        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
      }
    }
  } else if (specName === 'parrotfish') {
    // Blue-green body with pink/magenta scale-edge patchwork
    const blueGreen = [34, 187, 102];
    const pink = [230, 80, 160];
    const teal = [0, 136, 204];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Base blue-green with teal variation
        const baseBlend = perlin2D(u * 4, v * 4, 2, 2.0, 0.5);
        let r = Math.round(blueGreen[0] + (teal[0] - blueGreen[0]) * baseBlend);
        let g = Math.round(blueGreen[1] + (teal[1] - blueGreen[1]) * baseBlend);
        let b = Math.round(blueGreen[2] + (teal[2] - blueGreen[2]) * baseBlend);
        // Pink scale edges — grid-like noise contours
        const scaleNoise = perlin2D(u * 14, v * 14, 3, 2.0, 0.5);
        const scaleEdge = Math.abs((scaleNoise * 10) % 1.0 - 0.5);
        if (scaleEdge < 0.08) {
          const pinkBlend = 1.0 - scaleEdge / 0.08;
          r = Math.round(r + (pink[0] - r) * pinkBlend * 0.8);
          g = Math.round(g + (pink[1] - g) * pinkBlend * 0.8);
          b = Math.round(b + (pink[2] - b) * pinkBlend * 0.8);
        }
        // Head transitions more toward pink
        if (u < 0.25) {
          const headBlend = smoothstep(0.25, 0.05, u) * 0.5;
          r = Math.round(r + (pink[0] - r) * headBlend);
          g = Math.round(g + (pink[1] - g) * headBlend);
          b = Math.round(b + (pink[2] - b) * headBlend);
        }
        const mottle = 0.9 + perlin2D(u * 10, v * 10, 2) * 0.2;
        data[idx] = Math.min(255, Math.round(r * mottle));
        data[idx+1] = Math.min(255, Math.round(g * mottle));
        data[idx+2] = Math.min(255, Math.round(b * mottle));
        data[idx+3] = 200;
      }
    }
  } else if (specName === 'hawkfish') {
    // Flame hawkfish: vivid red with black grid/crosshatch
    const red = [230, 50, 40];
    const black = [15, 10, 10];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Base: vivid red
        let r = red[0], g = red[1], b = red[2];
        // Black grid/lattice pattern using two perpendicular sine waves with perlin wobble
        const wobble = perlin2D(u * 4, v * 4, 2, 2.0, 0.5) * 0.05;
        const gridH = Math.abs(Math.sin((v + wobble) * Math.PI * 10));
        const gridV = Math.abs(Math.sin((u + wobble) * Math.PI * 12));
        const isGrid = gridH < 0.12 || gridV < 0.12;
        if (isGrid) {
          r = black[0]; g = black[1]; b = black[2];
        }
        // Darker around eye
        const eyeDist = Math.sqrt(Math.pow(u - 0.12, 2) + Math.pow(v - 0.4, 2));
        if (eyeDist < 0.08) {
          const darkBlend = smoothstep(0.08, 0.03, eyeDist);
          r = Math.round(r * (1 - darkBlend * 0.7));
          g = Math.round(g * (1 - darkBlend * 0.7));
          b = Math.round(b * (1 - darkBlend * 0.7));
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 210;
      }
    }
  } else if (specName === 'wrasse') {
    // Fairy wrasse: green-blue body with vivid pink/red head
    const greenBlue = [34, 200, 140];
    const pinkHead = [230, 60, 120];
    const iridBlue = [80, 140, 255];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Body: green-blue with iridescent blue scale shimmer
        const shimmer = perlin2D(u * 16, v * 16, 2, 2.0, 0.5);
        let r = Math.round(greenBlue[0] + (iridBlue[0] - greenBlue[0]) * shimmer * 0.3);
        let g = Math.round(greenBlue[1] + (iridBlue[1] - greenBlue[1]) * shimmer * 0.3);
        let b = Math.round(greenBlue[2] + (iridBlue[2] - greenBlue[2]) * shimmer * 0.3);
        // Pink/red head transition (front 30%)
        if (u < 0.35) {
          const headBlend = smoothstep(0.35, 0.08, u);
          r = Math.round(r + (pinkHead[0] - r) * headBlend);
          g = Math.round(g + (pinkHead[1] - g) * headBlend);
          b = Math.round(b + (pinkHead[2] - b) * headBlend);
        }
        // Red dorsal edge
        if (v < 0.2) {
          const dorsalBlend = smoothstep(0.2, 0.02, v) * 0.6;
          r = Math.round(r + (pinkHead[0] - r) * dorsalBlend);
          g = Math.round(g + (pinkHead[1] - g) * dorsalBlend);
          b = Math.round(b + (pinkHead[2] - b) * dorsalBlend);
        }
        const mottle = 0.92 + perlin2D(u * 10, v * 10, 2) * 0.16;
        data[idx] = Math.min(255, Math.round(r * mottle));
        data[idx+1] = Math.min(255, Math.round(g * mottle));
        data[idx+2] = Math.min(255, Math.round(b * mottle));
        data[idx+3] = 200;
      }
    }
  } else if (specName === 'damselfish') {
    // Neon damselfish: iridescent electric blue body, yellow tail and lower fins
    const neonBlue = [20, 110, 255];
    const darkBlue = [5, 30, 120];
    const yellow = [255, 210, 30];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Yellow tail region — rear 20%
        const wobble = perlin2D(u * 3, v * 5, 2, 2.0, 0.5) * 0.04 - 0.02;
        const tailBound = 0.78 + wobble;
        const isYellowTail = u > tailBound;
        // Yellow lower belly — blends in at rear
        const bellyYellow = v > 0.70 && u > 0.45 + wobble;
        if (isYellowTail || bellyYellow) {
          const mottle = 0.9 + perlin2D(u * 10, v * 10, 2) * 0.2;
          data[idx] = Math.min(255, Math.round(yellow[0] * mottle));
          data[idx+1] = Math.min(255, Math.round(yellow[1] * mottle));
          data[idx+2] = Math.min(255, Math.round(yellow[2] * mottle));
          data[idx+3] = 200;
        } else {
          // Iridescent blue shimmer
          const shimmer = perlin2D(u * 14, v * 14, 3, 2.0, 0.5);
          const intensity = 0.75 + shimmer * 0.35;
          let r = Math.round(neonBlue[0] * intensity);
          let g = Math.round(neonBlue[1] * intensity);
          let b = Math.min(255, Math.round(neonBlue[2] * intensity));
          // Scale pattern — iridescent edges
          const scaleNoise = perlin2D(u * 22, v * 22, 2, 2.0, 0.5);
          const scaleEdge = Math.abs((scaleNoise * 14) % 1.0 - 0.5);
          if (scaleEdge < 0.07) {
            const darkBlend = (1.0 - scaleEdge / 0.07) * 0.45;
            r = Math.round(r + (darkBlue[0] - r) * darkBlend);
            g = Math.round(g + (darkBlue[1] - g) * darkBlend);
            b = Math.round(b + (darkBlue[2] - b) * darkBlend);
          }
          data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 220;
        }
      }
    }
  } else if (specName === 'anthias') {
    // Lyretail anthias: golden yellow-orange body with magenta/purple eye stripe
    const golden = [255, 187, 34];
    const deepOrange = [255, 136, 0];
    const magenta = [204, 68, 170];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Base: golden yellow, warmer toward belly
        const bellyBlend = smoothstep(0.45, 0.80, v) * 0.4;
        let r = Math.round(golden[0] + (deepOrange[0] - golden[0]) * bellyBlend);
        let g = Math.round(golden[1] + (deepOrange[1] - golden[1]) * bellyBlend);
        let b = Math.round(golden[2] + (deepOrange[2] - golden[2]) * bellyBlend);
        // Magenta/purple stripe through eye — diagonal from eye downward
        const wobble = perlin2D(u * 5, v * 8, 2, 2.0, 0.5) * 0.02;
        const stripeCenter = 0.35 + u * 0.15; // diagonal
        const stripeDist = Math.abs(v - stripeCenter + wobble);
        if (u < 0.30 && stripeDist < 0.06) {
          const stripeBlend = (1.0 - stripeDist / 0.06) * 0.85;
          r = Math.round(r + (magenta[0] - r) * stripeBlend);
          g = Math.round(g + (magenta[1] - g) * stripeBlend);
          b = Math.round(b + (magenta[2] - b) * stripeBlend);
        }
        const mottle = 0.93 + perlin2D(u * 10, v * 10, 2) * 0.14;
        data[idx] = Math.min(255, Math.round(r * mottle));
        data[idx+1] = Math.min(255, Math.round(g * mottle));
        data[idx+2] = Math.min(255, Math.round(b * mottle));
        data[idx+3] = 200;
      }
    }
  } else if (specName === 'pleco') {
    // Spotted pleco: tan/sandy base with bold dark brown/black spots
    const tan = [180, 155, 110];
    const darkSpot = [40, 30, 15];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Base: warm tan with subtle texture
        const mottle = 0.90 + perlin2D(u * 10, v * 10, 2) * 0.2;
        let r = Math.min(255, Math.round(tan[0] * mottle));
        let g = Math.min(255, Math.round(tan[1] * mottle));
        let b = Math.min(255, Math.round(tan[2] * mottle));
        // Bold dark spots — larger, rounder, well-defined
        const spotNoise = perlin2D(u * 8 + 0.3, v * 8 + 0.7, 3, 2.0, 0.5);
        if (spotNoise > 0.55) {
          const spotBlend = smoothstep(0.55, 0.65, spotNoise);
          r = Math.round(r + (darkSpot[0] - r) * spotBlend);
          g = Math.round(g + (darkSpot[1] - g) * spotBlend);
          b = Math.round(b + (darkSpot[2] - b) * spotBlend);
        }
        // Head gets slightly darker
        if (u < 0.20) {
          const headDark = smoothstep(0.20, 0.05, u) * 0.25;
          r = Math.round(r * (1 - headDark));
          g = Math.round(g * (1 - headDark));
          b = Math.round(b * (1 - headDark));
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 215;
      }
    }
  } else if (specName === 'discus') {
    // Vivid red-orange body with turquoise wavy horizontal lines
    const bodyRGB = hexToRGB(colors.body);
    const turquoise = [0, 200, 200];
    const darkFace = [100, 30, 10];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Base: warm red-orange
        let r = bodyRGB[0], g = bodyRGB[1], b = bodyRGB[2];
        // Turquoise wavy horizontal stripes — perlin-warped contour lines
        const warpedV = v + perlin2D(u * 3, v * 2, 3, 2.0, 0.5) * 0.08;
        const stripe = Math.abs((warpedV * 12) % 1.0 - 0.5);
        if (stripe < 0.07) {
          const stripeBlend = 1.0 - stripe / 0.07;
          r = Math.round(r + (turquoise[0] - r) * stripeBlend * 0.85);
          g = Math.round(g + (turquoise[1] - g) * stripeBlend * 0.85);
          b = Math.round(b + (turquoise[2] - b) * stripeBlend * 0.85);
        }
        // Darker forehead/eye area
        if (u < 0.20) {
          const faceBlend = smoothstep(0.20, 0.05, u) * 0.5;
          r = Math.round(r + (darkFace[0] - r) * faceBlend);
          g = Math.round(g + (darkFace[1] - g) * faceBlend);
          b = Math.round(b + (darkFace[2] - b) * faceBlend);
        }
        // Vertical stress bars (faint)
        const barNoise = Math.sin(u * Math.PI * 18 + perlin2D(u * 2, v * 4, 2) * 1.5);
        if (barNoise > 0.8) {
          r = Math.round(r * 0.85); g = Math.round(g * 0.85); b = Math.round(b * 0.85);
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
      }
    }
  } else if (specName === 'surgeonfish') {
    // Yellow tang: entirely bright lemon yellow, white scalpel at tail
    const yellow = [255, 220, 0];
    const white = [240, 240, 235];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Bright yellow body
        const mottle = 0.92 + perlin2D(u * 10, v * 10, 2, 2.0, 0.5) * 0.16;
        let r = Math.min(255, Math.round(yellow[0] * mottle));
        let g = Math.min(255, Math.round(yellow[1] * mottle));
        let b = Math.min(255, Math.round(yellow[2] * mottle));
        // White scalpel spine mark at tail base
        const scalpelDist = Math.sqrt(Math.pow(u - 0.88, 2) * 4 + Math.pow(v - 0.5, 2));
        if (scalpelDist < 0.06) {
          const spineBlend = smoothstep(0.06, 0.02, scalpelDist);
          r = Math.round(r + (white[0] - r) * spineBlend);
          g = Math.round(g + (white[1] - g) * spineBlend);
          b = Math.round(b + (white[2] - b) * spineBlend);
        }
        // Slightly darker at night — pale eye
        if (u < 0.14 && Math.abs(v - 0.4) < 0.05) {
          r = Math.round(r * 0.95); g = Math.round(g * 0.95);
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
      }
    }
  } else if (specName === 'blackSkirtTetra') {
    // Silver front half, black rear half with two vertical bars
    const silver = [200, 200, 210];
    const black = [25, 25, 30];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Gradient from silver (front) to black (rear)
        const darkGrad = smoothstep(0.35, 0.70, u);
        let r = Math.round(silver[0] + (black[0] - silver[0]) * darkGrad);
        let g = Math.round(silver[1] + (black[1] - silver[1]) * darkGrad);
        let b = Math.round(silver[2] + (black[2] - silver[2]) * darkGrad);
        // Two prominent vertical black bars at transition zone
        const wobble = perlin2D(u * 3, v * 6, 2, 2.0, 0.5) * 0.02;
        const bar1 = Math.abs(u - 0.38 + wobble);
        const bar2 = Math.abs(u - 0.48 + wobble);
        if (bar1 < 0.025 || bar2 < 0.025) {
          r = black[0]; g = black[1]; b = black[2];
        }
        // Metallic shimmer on silver part
        if (u < 0.45) {
          const shimmer = perlin2D(u * 15, v * 15, 2, 2.0, 0.5) * 0.15;
          r = Math.min(255, Math.round(r * (1 + shimmer)));
          g = Math.min(255, Math.round(g * (1 + shimmer)));
          b = Math.min(255, Math.round(b * (1 + shimmer)));
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
      }
    }
  } else if (specName === 'angelfish') {
    // Freshwater angelfish: silver body with bold vertical black bars
    const silverRGB = [210, 210, 215];
    const barRGB = [15, 15, 20];
    const barCenters = [0.15, 0.32, 0.48, 0.62, 0.76];
    const barWidths = [0.03, 0.045, 0.04, 0.035, 0.025];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        const wobble = perlin2D(u * 3, v * 5, 3, 2.0, 0.5) * 0.03 - 0.015;
        let inBar = false;
        for (let bi = 0; bi < barCenters.length; bi++) {
          if (Math.abs(u - barCenters[bi] + wobble) < barWidths[bi]) { inBar = true; break; }
        }
        if (inBar) {
          data[idx] = barRGB[0]; data[idx+1] = barRGB[1]; data[idx+2] = barRGB[2]; data[idx+3] = 210;
        } else {
          const mottle = 0.92 + perlin2D(u * 12, v * 12, 2) * 0.16;
          data[idx] = Math.min(255, Math.round(silverRGB[0] * mottle));
          data[idx+1] = Math.min(255, Math.round(silverRGB[1] * mottle));
          data[idx+2] = Math.min(255, Math.round(silverRGB[2] * mottle));
          data[idx+3] = 160;
        }
      }
    }
  } else if (specName === 'betta') {
    // Iridescent purple/blue with flowing color gradients
    const purple = [136, 51, 204];
    const iridBlue = [60, 80, 255];
    const darkEdge = [80, 20, 120];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Iridescent shimmer shifting between purple and blue
        const shimmer = perlin2D(u * 8, v * 8, 3, 2.0, 0.5);
        let r = Math.round(purple[0] + (iridBlue[0] - purple[0]) * shimmer);
        let g = Math.round(purple[1] + (iridBlue[1] - purple[1]) * shimmer);
        let b = Math.round(purple[2] + (iridBlue[2] - purple[2]) * shimmer);
        // Darker at edges (dorsal and ventral)
        const edgeDist = Math.min(v, 1 - v);
        if (edgeDist < 0.15) {
          const edgeBlend = smoothstep(0.15, 0.0, edgeDist) * 0.5;
          r = Math.round(r + (darkEdge[0] - r) * edgeBlend);
          g = Math.round(g + (darkEdge[1] - g) * edgeBlend);
          b = Math.round(b + (darkEdge[2] - b) * edgeBlend);
        }
        // Metallic sheen
        const sheen = perlin2D(u * 20, v * 20, 2, 2.0, 0.5) * 0.12;
        data[idx] = Math.min(255, Math.round(r * (1 + sheen)));
        data[idx+1] = Math.min(255, Math.round(g * (1 + sheen)));
        data[idx+2] = Math.min(255, Math.round(b * (1 + sheen)));
        data[idx+3] = 200;
      }
    }
  } else if (specName === 'swordtail') {
    // Bright red-orange body with faint lateral line
    const redOrange = [238, 68, 34];
    const darkLine = [120, 30, 15];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        const mottle = 0.92 + perlin2D(u * 10, v * 10, 2, 2.0, 0.5) * 0.16;
        let r = Math.min(255, Math.round(redOrange[0] * mottle));
        let g = Math.min(255, Math.round(redOrange[1] * mottle));
        let b = Math.min(255, Math.round(redOrange[2] * mottle));
        // Faint darker lateral line
        const wobble = perlin2D(u * 5, v * 8, 2) * 0.02;
        const lineDist = Math.abs(v - 0.45 + wobble);
        if (lineDist < 0.02) {
          const lineBlend = 1.0 - lineDist / 0.02;
          r = Math.round(r + (darkLine[0] - r) * lineBlend * 0.5);
          g = Math.round(g + (darkLine[1] - g) * lineBlend * 0.5);
          b = Math.round(b + (darkLine[2] - b) * lineBlend * 0.5);
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 180;
      }
    }
  } else if (specName === 'triggerfish') {
    // Green-gray body with yellow eye-lines and blue chin
    const bodyGreen = [51, 102, 85];
    const yellowLine = [255, 200, 50];
    const blueChin = [60, 120, 200];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        const mottle = 0.88 + perlin2D(u * 10, v * 10, 3, 2.0, 0.5) * 0.24;
        let r = Math.min(255, Math.round(bodyGreen[0] * mottle));
        let g = Math.min(255, Math.round(bodyGreen[1] * mottle));
        let b = Math.min(255, Math.round(bodyGreen[2] * mottle));
        // Yellow lines radiating from eye
        const eyeU = 0.12, eyeV = 0.38;
        const angle = Math.atan2(v - eyeV, u - eyeU);
        const dist = Math.sqrt(Math.pow(u - eyeU, 2) + Math.pow(v - eyeV, 2));
        if (dist > 0.04 && dist < 0.25) {
          const linePattern = Math.abs(Math.sin(angle * 6));
          if (linePattern > 0.85) {
            const lineBlend = smoothstep(0.85, 0.95, linePattern) * smoothstep(0.25, 0.08, dist);
            r = Math.round(r + (yellowLine[0] - r) * lineBlend);
            g = Math.round(g + (yellowLine[1] - g) * lineBlend);
            b = Math.round(b + (yellowLine[2] - b) * lineBlend);
          }
        }
        // Blue chin/lips area
        if (u < 0.15 && v > 0.5) {
          const chinBlend = smoothstep(0.15, 0.03, u) * smoothstep(0.5, 0.7, v) * 0.6;
          r = Math.round(r + (blueChin[0] - r) * chinBlend);
          g = Math.round(g + (blueChin[1] - g) * chinBlend);
          b = Math.round(b + (blueChin[2] - b) * chinBlend);
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
      }
    }
  } else if (specName === 'goby') {
    // Peacock goby: vivid red-orange body with blue/purple iridescent spots and bars
    const baseRed = [204, 68, 34];
    const blueSpot = [85, 50, 204];
    const orangeAccent = [255, 100, 50];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        const mottle = 0.88 + perlin2D(u * 10, v * 10, 3, 2.0, 0.5) * 0.24;
        let r = Math.min(255, Math.round(baseRed[0] * mottle));
        let g = Math.min(255, Math.round(baseRed[1] * mottle));
        let b = Math.min(255, Math.round(baseRed[2] * mottle));
        // Blue/purple iridescent spots scattered across body
        const spotNoise = perlin2D(u * 12 + 1.3, v * 12 + 0.7, 3, 2.0, 0.5);
        if (spotNoise > 0.55) {
          const spotBlend = smoothstep(0.55, 0.68, spotNoise) * 0.8;
          r = Math.round(r + (blueSpot[0] - r) * spotBlend);
          g = Math.round(g + (blueSpot[1] - g) * spotBlend);
          b = Math.round(b + (blueSpot[2] - b) * spotBlend);
        }
        // Vertical red-orange bars with wobble
        const barNoise = perlin2D(u * 2, v * 4, 2, 2.0, 0.5) * 0.04;
        const barPhase = Math.sin((u + barNoise) * Math.PI * 14);
        if (barPhase > 0.6) {
          const barBlend = smoothstep(0.6, 0.85, barPhase) * 0.4;
          r = Math.round(r + (orangeAccent[0] - r) * barBlend);
          g = Math.round(g + (orangeAccent[1] - g) * barBlend);
          b = Math.round(b + (orangeAccent[2] - b) * barBlend);
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
      }
    }
  } else if (specName === 'blenny') {
    // Olive-green with darker irregular bars and blue face spots
    const olive = [100, 120, 70];
    const darkBar = [50, 55, 30];
    const blueSpot = [70, 130, 200];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        const mottle = 0.85 + perlin2D(u * 10, v * 10, 3, 2.0, 0.5) * 0.3;
        let r = Math.min(255, Math.round(olive[0] * mottle));
        let g = Math.min(255, Math.round(olive[1] * mottle));
        let b = Math.min(255, Math.round(olive[2] * mottle));
        // Irregular darker bars
        const barNoise = perlin2D(u * 6, v * 3, 3, 2.0, 0.5);
        const barPattern = Math.sin(u * Math.PI * 12 + barNoise * 3);
        if (barPattern > 0.6) {
          const barBlend = smoothstep(0.6, 0.85, barPattern) * 0.5;
          r = Math.round(r + (darkBar[0] - r) * barBlend);
          g = Math.round(g + (darkBar[1] - g) * barBlend);
          b = Math.round(b + (darkBar[2] - b) * barBlend);
        }
        // Blue spots on face
        if (u < 0.20) {
          const spotN = perlin2D(u * 35, v * 35, 2, 2.0, 0.5);
          if (spotN > 0.70) {
            const bSpot = smoothstep(0.70, 0.80, spotN) * 0.5;
            r = Math.round(r + (blueSpot[0] - r) * bSpot);
            g = Math.round(g + (blueSpot[1] - g) * bSpot);
            b = Math.round(b + (blueSpot[2] - b) * bSpot);
          }
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 190;
      }
    }
  } else if (specName === 'filefish') {
    // Longnose filefish: cyan/teal body with scattered yellow-orange spots
    const cyan = [51, 187, 170];
    const yellowSpot = [255, 170, 34];
    const greenAccent = [34, 136, 119];
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const idx = (py * tw + px) * 4;
        // Base cyan with subtle texture
        const mottle = 0.90 + perlin2D(u * 10, v * 10, 3, 2.0, 0.5) * 0.2;
        let r = Math.min(255, Math.round(cyan[0] * mottle));
        let g = Math.min(255, Math.round(cyan[1] * mottle));
        let b = Math.min(255, Math.round(cyan[2] * mottle));
        // Yellow-orange spots — round, scattered
        const spotNoise = perlin2D(u * 10 + 2.1, v * 10 + 0.5, 3, 2.0, 0.5);
        if (spotNoise > 0.58) {
          const spotBlend = smoothstep(0.58, 0.70, spotNoise);
          r = Math.round(r + (yellowSpot[0] - r) * spotBlend);
          g = Math.round(g + (yellowSpot[1] - g) * spotBlend);
          b = Math.round(b + (yellowSpot[2] - b) * spotBlend);
        }
        // Greenish dorsal tint
        if (v < 0.25) {
          const topBlend = smoothstep(0.25, 0.05, v) * 0.3;
          r = Math.round(r + (greenAccent[0] - r) * topBlend);
          g = Math.round(g + (greenAccent[1] - g) * topBlend);
          b = Math.round(b + (greenAccent[2] - b) * topBlend);
        }
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
      }
    }
  } else {
    // DEFAULT: subtle perlin mottling overlay for organic skin texture
    const bodyRGB = hexToRGB(colors.body);
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const u = px / tw;
        const v = py / th;
        const mottle = 0.85 + perlin2D(u * 10, v * 10, 3, 2.0, 0.5) * 0.3;
        const idx = (py * tw + px) * 4;
        data[idx] = Math.min(255, Math.round(bodyRGB[0] * mottle));
        data[idx+1] = Math.min(255, Math.round(bodyRGB[1] * mottle));
        data[idx+2] = Math.min(255, Math.round(bodyRGB[2] * mottle));
        data[idx+3] = 100;  // subtle overlay
      }
    }
  }

  tmpCtx.putImageData(imgData, 0, 0);
  ctx.drawImage(tmpCanvas, bodyMinX, bodyMinY, bodyW, bodyH);
  ctx.restore();
}

// ── Render ──
function renderFish(specName, spec, mode = 'colored') {
  // Special case: seahorse needs a completely different renderer
  if (specName === 'seahorse') {
    return renderSeahorse(specName, spec, mode);
  }

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const body = generateBodyPoints(spec, 80);
  const dorsal = generateDorsalFin(spec, body.top);
  const anal = generateAnalFin(spec, body.bottom);
  const caudal = generateCaudalFin(spec);
  const pectoral = generatePectoralFin(spec, body.top, body.bottom);

  // Calculate bounds for all parts
  const allPts = [...body.top, ...body.bottom, ...dorsal, ...anal, ...caudal, ...pectoral];
  const minX = Math.min(...allPts.map(p => p.x));
  const maxX = Math.max(...allPts.map(p => p.x));
  const minY = Math.min(...allPts.map(p => p.y));
  const maxY = Math.max(...allPts.map(p => p.y));
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const drawArea = SIZE - PAD * 2;
  const scale = drawArea / Math.max(rangeX, rangeY * 1.05);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const ox = SIZE / 2 - cx * scale;
  const oy = SIZE / 2 + cy * scale;

  const toS = (p) => ({ x: p.x * scale + ox, y: -p.y * scale + oy });

  // Helper: draw smooth filled shape
  function drawShape(pts, fill, stroke, lw = 1.5, smooth = true) {
    const screen = (smooth && pts.length > 4 ? smoothPoints(pts, 4) : pts).map(toS);
    ctx.beginPath();
    ctx.moveTo(screen[0].x, screen[0].y);
    for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i].x, screen[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    // Fin rays
    if (fill !== spec.colors.body && pts.length > 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      const base0 = screen[0], baseN = screen[screen.length - 1];
      for (let r = 1; r <= 6; r++) {
        const t = r / 7;
        const bx = base0.x + (baseN.x - base0.x) * t;
        const by = base0.y + (baseN.y - base0.y) * t;
        const tipIdx = Math.min(Math.floor(t * screen.length), screen.length - 1);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(screen[tipIdx].x, screen[tipIdx].y);
        ctx.stroke();
      }
    }
  }

  const colors = spec.colors;
  const finFill = mode === 'silhouette' ? 'rgba(180,180,200,0.6)' : colors.fin + 'aa';
  const finStroke = mode === 'silhouette' ? 'rgba(140,140,160,0.7)' : colors.fin + '88';

  // Draw order: caudal → anal → dorsal → pectoral → body → eye
  drawShape(caudal, finFill, finStroke, 1.5, false);  // tail: don't smooth (preserve fork)
  drawShape(anal, finFill, finStroke);
  drawShape(dorsal, finFill, finStroke);
  drawShape(pectoral, finFill, finStroke);

  // Body — with gradient
  const topSmooth = body.top.map(toS);
  const botSmooth = [...body.bottom].reverse().map(toS);
  ctx.beginPath();
  ctx.moveTo(topSmooth[0].x, topSmooth[0].y);
  for (const p of topSmooth) ctx.lineTo(p.x, p.y);
  for (const p of botSmooth) ctx.lineTo(p.x, p.y);
  ctx.closePath();

  if (mode === 'silhouette') {
    const grad = ctx.createLinearGradient(0, Math.min(...topSmooth.map(p=>p.y)), 0, Math.max(...botSmooth.map(p=>p.y)));
    grad.addColorStop(0, '#e0d8d0');
    grad.addColorStop(0.5, '#f0ebe6');
    grad.addColorStop(1, '#d8d0c8');
    ctx.fillStyle = grad;
  } else {
    // Color gradient: darker on top (countershading)
    const bMinY = Math.min(...topSmooth.map(p=>p.y));
    const bMaxY = Math.max(...botSmooth.map(p=>p.y));
    const grad = ctx.createLinearGradient(0, bMinY, 0, bMaxY);
    grad.addColorStop(0, colors.body);
    grad.addColorStop(0.4, colors.body);
    grad.addColorStop(1, lightenColor(colors.body, 30));
    ctx.fillStyle = grad;
  }
  ctx.fill();

  // ── Species-specific pattern overlays (after fill, before outline stroke) ──
  if (mode === 'colored') {
    const bodyMinX = Math.min(...topSmooth.map(p => p.x), ...botSmooth.map(p => p.x));
    const bodyMaxX = Math.max(...topSmooth.map(p => p.x), ...botSmooth.map(p => p.x));
    const bodyMinY = Math.min(...topSmooth.map(p => p.y));
    const bodyMaxY = Math.max(...botSmooth.map(p => p.y));
    renderPatternOverlay(ctx, specName, spec, topSmooth, botSmooth, bodyMinX, bodyMaxX, bodyMinY, bodyMaxY);
  }

  // Body outline stroke
  ctx.beginPath();
  ctx.moveTo(topSmooth[0].x, topSmooth[0].y);
  for (const p of topSmooth) ctx.lineTo(p.x, p.y);
  for (const p of botSmooth) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.strokeStyle = mode === 'silhouette' ? '#aaa49c' : darkenColor(colors.body, 30);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Gill cover line
  const gillX = 0.18;
  const gillTopIdx = Math.floor(gillX * body.top.length);
  const gillBotIdx = Math.floor(gillX * body.bottom.length);
  const gt = toS(body.top[gillTopIdx]);
  const gb = toS(body.bottom[gillBotIdx]);
  ctx.beginPath();
  ctx.moveTo(gt.x, gt.y);
  ctx.quadraticCurveTo(gt.x + 8, (gt.y + gb.y) / 2, gb.x, gb.y);
  ctx.strokeStyle = mode === 'silhouette' ? 'rgba(150,140,130,0.4)' : 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eye
  const eyeBodyY = nacaCamber(spec.eye.x, spec.camber, spec.camberPos) +
                    nacaThickness(spec.eye.x, spec.thickness) * spec.eye.yOffset;
  const eyeS = toS({ x: spec.eye.x, y: eyeBodyY });
  const eyeR = spec.eye.r * scale;

  ctx.beginPath();
  ctx.arc(eyeS.x, eyeS.y, eyeR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(eyeS.x + eyeR * 0.1, eyeS.y, eyeR * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#111111';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(eyeS.x - eyeR * 0.15, eyeS.y - eyeR * 0.15, eyeR * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Label
  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`${specName} — NACA t=${spec.thickness} c=${spec.camber}`, 10, SIZE - 10);

  return canvas;
}

function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3,5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5,7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1,3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3,5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5,7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

// ── Pattern config extraction (declarative params for GLSL shader) ──
function getPatternConfig(specName, colors) {
  // Extract the numeric parameters from renderPatternOverlay() into declarative form.
  // Each config maps to a GLSL pattern archetype function.
  const c = colors;
  const configs = {
    emperorAngelfish: {
      type: 'stripes_horizontal',
      bodyColor: c.body, stripeColor: c.stripe,
      faceRegion: { bound: 0.12 }, faceDarkColor: [10, 15, 60],
      tailRegion: { bound: 0.85 }, tailColor: [255, 220, 0],
      stripeFreq: 32, stripeThreshold: 0.65,
      wobble: { scaleU: 4, scaleV: 3, octaves: 3, amp: 0.025 },
    },
    clownfish: {
      type: 'bands_vertical',
      bodyColor: c.body, bandColor: c.stripe, borderColor: [0, 0, 0],
      bandCenters: [0.25, 0.50, 0.78],
      bandWidths: [0.06, 0.05, 0.04],
      bandInnerFactor: 0.7, bandOuterFactor: 1.0,
      tailBlack: { start: 0.88 },
      wobble: { scaleU: 3, scaleV: 5, octaves: 3, amp: 0.04, offset: -0.02 },
      mottle: { scale: 10, base: 0.9, range: 0.2 },
    },
    lionfish: {
      type: 'stripes_horizontal',
      bodyColor: c.body, stripeColor: c.stripe,
      stripeFreq: 14, stripeThreshold: 0.0,
      wobble: { scaleU: 4, scaleV: 2, octaves: 3, amp: 0.06 },
    },
    angelfish: {
      type: 'bands_vertical',
      bodyColor: '#d2d2d7', bandColor: '#0f0f14',
      bandCenters: [0.15, 0.32, 0.48, 0.62, 0.76],
      bandWidths: [0.03, 0.045, 0.04, 0.035, 0.025],
      bandInnerFactor: 1.0, bandOuterFactor: 1.0,
      wobble: { scaleU: 3, scaleV: 5, octaves: 3, amp: 0.03, offset: -0.015 },
      mottle: { scale: 12, base: 0.92, range: 0.16 },
    },
    moorishIdol: {
      type: 'bands_regions',
      bodyColor: c.body, bandColor: c.stripe, accentColor: c.accent,
      bandEdges: [0.12, 0.30, 0.42, 0.62, 0.78, 1.01],
      wobble: { scaleU: 2, scaleV: 5, octaves: 3, amp: 0.04, offset: -0.02 },
    },
    butterflyfish: {
      type: 'bands_vertical',
      bodyColor: c.body, bandColor: c.stripe, borderColor: c.accent,
      bandCenters: [0.18, 0.36, 0.54, 0.72],
      bandWidths: [0.05, 0.05, 0.05, 0.05],
      bandInnerFactor: 0.6, bandOuterFactor: 0.85,
      eyeStripe: { center: 0.09, width: 0.025 },
      dorsalSpot: { x: 0.62, y: 0.10, radius: 0.04 },
      wobble: { scaleU: 3, scaleV: 6, octaves: 3, amp: 0.03, offset: -0.015 },
    },
    copperBandButterfly: {
      type: 'bands_vertical',
      bodyColor: c.body, bandColor: c.stripe, borderColor: c.accent,
      bandCenters: [0.14, 0.32, 0.50, 0.68, 0.84],
      bandWidths: [0.05, 0.05, 0.05, 0.05, 0.05],
      bandInnerFactor: 0.6, bandOuterFactor: 0.85,
      eyeStripe: { center: 0.08, width: 0.03 },
      wobble: { scaleU: 3, scaleV: 6, octaves: 3, amp: 0.03, offset: -0.015 },
    },
    banggaiCardinal: {
      type: 'bands_with_spots',
      bodyColor: c.body, barColor: c.stripe, dotColor: c.accent,
      barCenters: [0.22, 0.42, 0.62], barWidth: 0.08,
      dotNoiseScale: 25, dotThreshold: 0.72,
      wobble: { scaleU: 3, scaleV: 6, octaves: 3, amp: 0.03, offset: -0.015 },
      mottle: { scale: 12, base: 0.92, range: 0.16 },
    },
    tang: {
      type: 'gradient_zones',
      bodyColor: c.body, darkColor: c.stripe, accentColor: c.accent,
      zones: [
        { type: 'face_mask', bound: 0.15 },
        { type: 'dorsal_accent', vBound: 0.20, uMin: 0.12, uMax: 0.75 },
        { type: 'belly_light', uBound: 0.30, vBound: 0.65, color: [240, 240, 255] },
      ],
      wobble: { scaleU: 3, scaleV: 5, octaves: 3, amp: 0.04, offset: -0.02 },
      mottle: { scale: 10, base: 0.9, range: 0.2 },
    },
    regalTang: {
      type: 'gradient_zones',
      bodyColor: c.body, darkColor: c.stripe, accentColor: c.accent,
      zones: [
        { type: 'dark_middle', uMin: 0.18, uMax: 0.76 },
        { type: 'tail_accent', uBound: 0.80 },
      ],
      wobble: { scaleU: 3, scaleV: 5, octaves: 3, amp: 0.06, offset: -0.03 },
      mottle: { scale: 10, base: 0.85, range: 0.3 },
    },
    neonTetra: {
      type: 'two_tone_stripe',
      bodyColor: c.body, stripeColor: [0, 180, 255], secondStripeColor: [0, 255, 200],
      stripeCenter: 0.38, stripeWidth: 0.09,
      redRegion: { uStart: 0.45, vStart: 0.45 },
      shimmer: { scale: 12, amp: 0.04 },
    },
    cardinalTetra: {
      type: 'two_tone_stripe',
      bodyColor: '#cc1122', stripeColor: [0, 140, 255], dorsalColor: [40, 20, 30],
      stripeCenter: 0.40, stripeWidth: 0.08,
      redRegion: { vStart: 0.42 },
      shimmer: { scale: 14, amp: 0.025 },
      iridescence: { scale: 20, range: 0.3 },
    },
    pufferfish: {
      type: 'contours',
      bodyColor: c.body, lineColor: [221, 187, 34], bellyColor: [220, 220, 200],
      bellyStart: 0.68, bellyEnd: 0.85,
      contourNoiseScale: 6, contourMultiplier: 6, contourThreshold: 0.10,
      contourVMax: 0.70,
      mottle: { scale: 12, base: 0.92, range: 0.16 },
    },
    mandarinfish: {
      type: 'contours',
      bodyColor: c.body, lineColor: c.stripe, edgeColor: c.accent,
      domainWarp: { scale: 4, factor: 1.5 },
      contourMultiplier: 6, contourThreshold: 0.06, edgeThreshold: 0.10,
    },
    discus: {
      type: 'stripes_horizontal',
      bodyColor: c.body, stripeColor: [0, 200, 200],
      faceRegion: { bound: 0.20 }, faceDarkColor: [100, 30, 10],
      stripeFreq: 12, stripeThreshold: 0.07,
      warpScale: { u: 3, v: 2 }, warpAmp: 0.08,
      stressBars: { freq: 18, threshold: 0.8 },
    },
    swordtail: {
      type: 'two_tone_stripe',
      bodyColor: c.body, stripeColor: [120, 30, 15],
      stripeCenter: 0.45, stripeWidth: 0.02,
      mottle: { scale: 10, base: 0.92, range: 0.16 },
    },
    betta: {
      type: 'gradient_iridescent',
      bodyColor: c.body, iridColor: [60, 80, 255], darkEdge: [80, 20, 120],
      shimmer: { scale: 8, octaves: 3 },
      edgeThreshold: 0.15, edgeBlend: 0.5,
      sheen: { scale: 20, octaves: 2, amp: 0.12 },
    },
    damselfish: {
      type: 'two_tone_zones',
      bodyColor: [20, 110, 255], yellowColor: [255, 210, 30], darkBlue: [5, 30, 120],
      yellowTail: { uBound: 0.78 },
      yellowBelly: { vBound: 0.70, uBound: 0.45 },
      shimmer: { scale: 14, octaves: 3, intensity: { base: 0.75, range: 0.35 } },
      scales: { noiseScale: 22, contourMult: 14, edgeThreshold: 0.07, blend: 0.45 },
    },
    anthias: {
      type: 'two_tone_stripe',
      bodyColor: [255, 187, 34], bellyColor: [255, 136, 0], stripeColor: [204, 68, 170],
      bellyBlend: { start: 0.45, end: 0.80, factor: 0.4 },
      stripeCenter: 0.35, strikeDiagonal: 0.15, stripeWidth: 0.06,
      stripeRegion: { uMax: 0.30 }, stripeBlend: 0.85,
      mottle: { scale: 10, base: 0.93, range: 0.14 },
    },
    surgeonfish: {
      type: 'gradient_zones',
      bodyColor: c.body, accentColor: [240, 240, 235],
      scalpelSpine: { x: 0.88, y: 0.5, radius: 0.06, xScale: 4.0 },
      eyeRegion: { uMax: 0.14, vCenter: 0.4, vHalf: 0.05 },
      mottle: { scale: 10, base: 0.92, range: 0.16 },
    },
    foxface: {
      type: 'gradient_zones',
      bodyColor: [255, 200, 0], blackColor: [20, 15, 10], whiteColor: [240, 235, 220],
      zones: [
        { type: 'face_mask', bound: 0.25, blend: { start: 0.25, end: 0.10 } },
        { type: 'upper_face_black', vBound: 0.5 },
        { type: 'white_chin', vStart: 0.4, vEnd: 0.6 },
        { type: 'eye_stripe', vCenter: 0.38, vWidth: 0.06, uMax: 0.20 },
        { type: 'dark_dorsal', vBound: 0.15 },
      ],
      mottle: { scale: 8, base: 0.9, range: 0.2 },
    },
    clownTrigger: {
      type: 'composite_spots',
      baseColor: [40, 30, 20], yellowColor: [255, 200, 0], whiteColor: [255, 255, 255],
      yellowMouth: { uBound: 0.15 },
      bellySpots: { vMin: 0.45, noiseScale: 5, noiseOffset: [0.5, 0], threshold: 0.58, blend: { start: 0.58, end: 0.65 } },
      leopardSpots: { vMax: 0.55, noiseScale: 8, noiseOffset: [3.7, 1.2], threshold: 0.52, blend: { start: 0.52, end: 0.62 } },
      tailBand: { uStart: 0.82, blend: { start: 0.82, end: 0.92, factor: 0.7 } },
    },
    parrotfish: {
      type: 'composite_scales',
      colors: { blueGreen: [34, 187, 102], pink: [230, 80, 160], teal: [0, 136, 204] },
      baseBlend: { noiseScale: 4 },
      scaleEdge: { noiseScale: 14, contourMult: 10, threshold: 0.08, blend: 0.8 },
      headTint: { uBound: 0.25 },
      mottle: { scale: 10, base: 0.9, range: 0.2 },
    },
    hawkfish: {
      type: 'composite_grid',
      bodyColor: [230, 50, 40], gridColor: [15, 10, 10],
      gridFreqH: 10, gridFreqV: 12, gridThreshold: 0.12,
      eyeDarkening: { x: 0.12, y: 0.4, radius: 0.08 },
      wobble: { scale: 4, amp: 0.05 },
    },
    wrasse: {
      type: 'gradient_zones',
      bodyColor: [34, 200, 140], headColor: [230, 60, 120], iridColor: [80, 140, 255],
      headRegion: { uBound: 0.35 },
      dorsalTint: { vBound: 0.2 },
      shimmer: { scale: 16, range: 0.3 },
      mottle: { scale: 10, base: 0.92, range: 0.16 },
    },
    triggerfish: {
      type: 'composite_radial',
      bodyColor: [51, 102, 85], lineColor: [255, 200, 50], chinColor: [60, 120, 200],
      eyeCenter: [0.12, 0.38],
      lineFreq: 6, lineThreshold: 0.85,
      lineDistRange: [0.04, 0.25],
      chinRegion: { uMax: 0.15, vMin: 0.5 },
      mottle: { scale: 10, base: 0.88, range: 0.24 },
    },
    goby: {
      type: 'composite_spots',
      baseColor: [204, 68, 34], spotColor: [85, 50, 204], accentColor: [255, 100, 50],
      spots: { noiseScale: 12, noiseOffset: [1.3, 0.7], threshold: 0.55, blend: { start: 0.55, end: 0.68, factor: 0.8 } },
      bars: { noiseScale: 2, barFreq: 14, threshold: 0.6, blend: { start: 0.6, end: 0.85, factor: 0.4 } },
      mottle: { scale: 10, base: 0.88, range: 0.24 },
    },
    blenny: {
      type: 'composite_spots',
      bodyColor: [100, 120, 70], barColor: [50, 55, 30], spotColor: [70, 130, 200],
      bars: { noiseScale: 6, barFreq: 12, warpAmp: 3, threshold: 0.6, blend: 0.5 },
      faceSpots: { uMax: 0.20, noiseScale: 35, threshold: 0.70, blend: 0.5 },
      mottle: { scale: 10, base: 0.85, range: 0.3 },
    },
    filefish: {
      type: 'composite_spots',
      baseColor: [51, 187, 170], spotColor: [255, 170, 34], tintColor: [34, 136, 119],
      spots: { noiseScale: 10, noiseOffset: [2.1, 0.5], threshold: 0.58, blend: { start: 0.58, end: 0.70 } },
      dorsalTint: { vBound: 0.25, blend: 0.3 },
      mottle: { scale: 10, base: 0.90, range: 0.2 },
    },
    blackSkirtTetra: {
      type: 'gradient_zones',
      bodyColor: [200, 200, 210], darkColor: [25, 25, 30],
      gradient: { start: 0.35, end: 0.70 },
      bars: [{ center: 0.38, width: 0.025 }, { center: 0.48, width: 0.025 }],
      shimmer: { uMax: 0.45, scale: 15, amp: 0.15 },
      wobble: { scaleU: 3, scaleV: 6, octaves: 2, amp: 0.02 },
    },
    pleco: {
      type: 'spots',
      baseColor: [180, 155, 110], spotColor: [40, 30, 15],
      spotNoise: { scale: 8, offset: [0.3, 0.7], threshold: 0.55, blend: { start: 0.55, end: 0.65 } },
      headDarken: { uBound: 0.20, blend: 0.25 },
      mottle: { scale: 10, base: 0.90, range: 0.2 },
    },
    seahorse: {
      type: 'mottled',
      bodyColor: c.body,
      mottle: { scale: 10, base: 0.85, range: 0.3 },
    },
  };
  return configs[specName] || { type: 'mottled', bodyColor: c.body, mottle: { scale: 10, base: 0.85, range: 0.3 } };
}

// ── Export 3D geometry + pattern params to public/fish/ ──
function export3D(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const speciesNames = Object.keys(SPECIES);
  const manifest = [];

  for (const [name, spec] of Object.entries(SPECIES)) {
    // Generate geometry point arrays
    const { top, bottom } = generateBodyPoints(spec);
    const dorsalFin = generateDorsalFin(spec, top);
    const analFin = generateAnalFin(spec, bottom);
    const caudalFin = generateCaudalFin(spec);
    const pectoralFin = generatePectoralFin(spec, top, bottom);

    // Build declarative pattern config
    const patternConfig = getPatternConfig(name, spec.colors);

    const data = {
      species: name,
      name: spec.name,
      params: {
        thickness: spec.thickness,
        camber: spec.camber,
        camberPos: spec.camberPos,
        bodyLength: spec.bodyLength,
        bellyBulge: spec.bellyBulge,
        headBluntness: spec.headBluntness,
        tailNarrow: spec.tailNarrow,
      },
      geometry: {
        body: {
          top: top.map(p => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000]),
          bottom: bottom.map(p => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000]),
        },
        dorsalFin: dorsalFin.map(p => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000]),
        analFin: analFin.map(p => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000]),
        caudalFin: caudalFin.map(p => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000]),
        pectoralFin: pectoralFin.map(p => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000]),
      },
      eye: spec.eye,
      colors: spec.colors,
      fins: {
        dorsal: spec.dorsalFin,
        caudal: spec.caudalFin,
        anal: spec.analFin,
        pectoral: spec.pectoralFin,
      },
      pattern: patternConfig,
    };

    const outPath = path.join(outDir, `${name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`  ✓ ${outPath}`);
    manifest.push(name);
  }

  // Write manifest
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  ✓ ${manifestPath} (${manifest.length} species)`);
}

// ── CLI ──
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (args[i+1] && !args[i+1].startsWith('--')) { parsed[key] = args[i+1]; i++; }
      else parsed[key] = true;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  const mode = args.mode || 'colored';

  if (args['export-3d']) {
    const outDir = args.out || 'public/fish/';
    console.log('Exporting 3D geometry + pattern params...');
    export3D(outDir);
    return;
  }

  if (args.all) {
    const outDir = args.out || 'output/sprites/geometry/';
    fs.mkdirSync(outDir, { recursive: true });

    // Clean old files to prevent duplicates
    for (const f of fs.readdirSync(outDir)) {
      if (f.startsWith('naca_') && (f.endsWith('.png') || f.endsWith('.json'))) {
        fs.unlinkSync(path.join(outDir, f));
      }
    }

    // Dedup check
    const speciesNames = Object.keys(SPECIES);
    const dupes = speciesNames.filter((n, i) => speciesNames.indexOf(n) !== i);
    if (dupes.length > 0) {
      console.error(`DUPLICATE SPECIES KEYS: ${dupes.join(', ')} — fix before generating!`);
      process.exit(1);
    }
    console.log(`Generating ${speciesNames.length} unique fish species...`);

    let idx = 1;
    const sheetEntries = [];

    for (const [name, spec] of Object.entries(SPECIES)) {
      const num = String(idx).padStart(3, '0');
      const canvas = renderFish(name, spec, mode);
      const outPath = path.join(outDir, `naca_${num}_${name}.png`);
      fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
      fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({
        species: name, method: 'NACA_airfoil', mode,
        params: { thickness: spec.thickness, camber: spec.camber, camberPos: spec.camberPos,
                  bodyLength: spec.bodyLength, headBluntness: spec.headBluntness, tailNarrow: spec.tailNarrow }
      }, null, 2));
      console.log(`  ✓ ${outPath}`);
      sheetEntries.push({ name, canvas });
      idx++;
    }

    // Contact sheet
    const cols = 4, tileSize = 256;
    const rows = Math.ceil(sheetEntries.length / cols);
    const sheet = createCanvas(cols * tileSize, rows * (tileSize + 20));
    const sheetCtx = sheet.getContext('2d');
    sheetCtx.fillStyle = '#0a0a1a';
    sheetCtx.fillRect(0, 0, sheet.width, sheet.height);

    sheetEntries.forEach(({ name, canvas }, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      sheetCtx.drawImage(canvas, col * tileSize, row * (tileSize + 20), tileSize, tileSize);
      sheetCtx.fillStyle = '#888';
      sheetCtx.font = 'bold 11px monospace';
      sheetCtx.fillText(name, col * tileSize + 4, row * (tileSize + 20) + tileSize + 14);
    });

    const sheetDir = path.join(outDir, '../sheets/');
    fs.mkdirSync(sheetDir, { recursive: true });
    const sheetPath = path.join(sheetDir, 'sheet_002_naca_fish.png');
    fs.writeFileSync(sheetPath, sheet.toBuffer('image/png'));
    console.log(`  ✓ ${sheetPath} (contact sheet)`);
    return;
  }

  // Single species
  const name = args.species || 'clownfish';
  const spec = SPECIES[name];
  if (!spec) {
    console.error(`Unknown: ${name}. Available: ${Object.keys(SPECIES).join(', ')}`);
    process.exit(1);
  }
  const canvas = renderFish(name, spec, mode);
  const outPath = args.out || `output/sprites/geometry/naca_${name}.png`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`Saved: ${outPath}`);
}

main().catch(console.error);
