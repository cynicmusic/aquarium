import * as THREE from 'three';

/**
 * Side-profile fish geometry — builds fish from 2D spline silhouettes
 * with canvas-generated pattern textures (stripes, spots, gradients).
 * Each species has a unique profile curve and color pattern.
 */

// ── Fish silhouette profiles ──
// Each profile is an array of {x, y} points defining the TOP half of the fish outline.
// x: 0 = nose, 1 = tail.  y: 0 = centerline, positive = up.
// The bottom half mirrors with optional belly bulge.

const PROFILES = {
  clownfish: {
    top:    [{x:0, y:0.02}, {x:0.1, y:0.18}, {x:0.25, y:0.28}, {x:0.4, y:0.32}, {x:0.55, y:0.30}, {x:0.7, y:0.22}, {x:0.85, y:0.12}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.02}, {x:0.1, y:-0.16}, {x:0.25, y:-0.25}, {x:0.4, y:-0.30}, {x:0.55, y:-0.28}, {x:0.7, y:-0.20}, {x:0.85, y:-0.10}, {x:1, y:-0.02}],
    dorsal: [{x:0.25, y:0.28}, {x:0.3, y:0.40}, {x:0.5, y:0.42}, {x:0.65, y:0.35}, {x:0.7, y:0.22}],
    tail:   { spread: 0.25, length: 0.15, fork: 0.3 },
    pectoral: { x: 0.35, y: -0.05, size: 0.12 },
    eye: { x: 0.15, y: 0.05, r: 0.035 },
  },
  angelfish: {
    top:    [{x:0, y:0.02}, {x:0.08, y:0.15}, {x:0.2, y:0.35}, {x:0.35, y:0.50}, {x:0.5, y:0.48}, {x:0.65, y:0.35}, {x:0.8, y:0.18}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.02}, {x:0.08, y:-0.12}, {x:0.2, y:-0.30}, {x:0.35, y:-0.45}, {x:0.5, y:-0.42}, {x:0.65, y:-0.30}, {x:0.8, y:-0.15}, {x:1, y:-0.02}],
    dorsal: [{x:0.15, y:0.35}, {x:0.2, y:0.65}, {x:0.35, y:0.70}, {x:0.5, y:0.60}, {x:0.55, y:0.48}],
    tail:   { spread: 0.35, length: 0.18, fork: 0.5 },
    pectoral: { x: 0.3, y: -0.1, size: 0.15 },
    eye: { x: 0.12, y: 0.08, r: 0.03 },
  },
  tang: {
    top:    [{x:0, y:0.01}, {x:0.08, y:0.12}, {x:0.2, y:0.28}, {x:0.4, y:0.35}, {x:0.6, y:0.32}, {x:0.75, y:0.22}, {x:0.88, y:0.10}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.01}, {x:0.08, y:-0.10}, {x:0.2, y:-0.22}, {x:0.4, y:-0.30}, {x:0.6, y:-0.28}, {x:0.75, y:-0.18}, {x:0.88, y:-0.08}, {x:1, y:-0.02}],
    dorsal: [{x:0.15, y:0.28}, {x:0.2, y:0.45}, {x:0.4, y:0.48}, {x:0.6, y:0.42}, {x:0.7, y:0.32}],
    tail:   { spread: 0.22, length: 0.14, fork: 0.6 },
    pectoral: { x: 0.25, y: -0.05, size: 0.10 },
    eye: { x: 0.1, y: 0.06, r: 0.028 },
  },
  betta: {
    top:    [{x:0, y:0.02}, {x:0.1, y:0.14}, {x:0.25, y:0.22}, {x:0.4, y:0.24}, {x:0.55, y:0.20}, {x:0.7, y:0.14}, {x:0.85, y:0.08}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.02}, {x:0.1, y:-0.12}, {x:0.25, y:-0.18}, {x:0.4, y:-0.20}, {x:0.55, y:-0.16}, {x:0.7, y:-0.10}, {x:0.85, y:-0.06}, {x:1, y:-0.02}],
    dorsal: [{x:0.2, y:0.22}, {x:0.25, y:0.50}, {x:0.4, y:0.55}, {x:0.6, y:0.52}, {x:0.75, y:0.40}, {x:0.85, y:0.25}],
    tail:   { spread: 0.55, length: 0.35, fork: 0.2 },
    pectoral: { x: 0.3, y: -0.08, size: 0.18 },
    eye: { x: 0.12, y: 0.05, r: 0.025 },
  },
  guppy: {
    top:    [{x:0, y:0.01}, {x:0.1, y:0.08}, {x:0.25, y:0.12}, {x:0.4, y:0.13}, {x:0.55, y:0.11}, {x:0.7, y:0.08}, {x:0.85, y:0.04}, {x:1, y:0.01}],
    bottom: [{x:0, y:-0.01}, {x:0.1, y:-0.07}, {x:0.25, y:-0.10}, {x:0.4, y:-0.11}, {x:0.55, y:-0.09}, {x:0.7, y:-0.06}, {x:0.85, y:-0.03}, {x:1, y:-0.01}],
    dorsal: [{x:0.35, y:0.12}, {x:0.4, y:0.20}, {x:0.5, y:0.22}, {x:0.6, y:0.18}, {x:0.65, y:0.11}],
    tail:   { spread: 0.30, length: 0.20, fork: 0.15 },
    pectoral: { x: 0.25, y: -0.02, size: 0.06 },
    eye: { x: 0.1, y: 0.03, r: 0.02 },
  },
  discus: {
    top:    [{x:0, y:0.02}, {x:0.08, y:0.20}, {x:0.2, y:0.40}, {x:0.35, y:0.48}, {x:0.5, y:0.50}, {x:0.65, y:0.45}, {x:0.8, y:0.30}, {x:0.92, y:0.12}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.02}, {x:0.08, y:-0.18}, {x:0.2, y:-0.38}, {x:0.35, y:-0.46}, {x:0.5, y:-0.48}, {x:0.65, y:-0.43}, {x:0.8, y:-0.28}, {x:0.92, y:-0.10}, {x:1, y:-0.02}],
    dorsal: [{x:0.15, y:0.40}, {x:0.25, y:0.55}, {x:0.45, y:0.58}, {x:0.65, y:0.52}, {x:0.75, y:0.40}],
    tail:   { spread: 0.18, length: 0.10, fork: 0.3 },
    pectoral: { x: 0.3, y: -0.1, size: 0.12 },
    eye: { x: 0.12, y: 0.08, r: 0.03 },
  },
  lionfish: {
    top:    [{x:0, y:0.02}, {x:0.1, y:0.16}, {x:0.25, y:0.24}, {x:0.4, y:0.26}, {x:0.55, y:0.24}, {x:0.7, y:0.18}, {x:0.85, y:0.10}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.02}, {x:0.1, y:-0.14}, {x:0.25, y:-0.22}, {x:0.4, y:-0.26}, {x:0.55, y:-0.22}, {x:0.7, y:-0.16}, {x:0.85, y:-0.08}, {x:1, y:-0.02}],
    dorsal: [{x:0.05, y:0.16}, {x:0.1, y:0.55}, {x:0.2, y:0.60}, {x:0.3, y:0.58}, {x:0.4, y:0.55}, {x:0.5, y:0.50}, {x:0.6, y:0.45}, {x:0.7, y:0.35}],
    tail:   { spread: 0.28, length: 0.15, fork: 0.4 },
    pectoral: { x: 0.3, y: -0.1, size: 0.30 },
    eye: { x: 0.1, y: 0.06, r: 0.025 },
  },
  neonTetra: {
    top:    [{x:0, y:0.01}, {x:0.1, y:0.06}, {x:0.25, y:0.09}, {x:0.4, y:0.10}, {x:0.55, y:0.09}, {x:0.7, y:0.06}, {x:0.85, y:0.03}, {x:1, y:0.01}],
    bottom: [{x:0, y:-0.01}, {x:0.1, y:-0.05}, {x:0.25, y:-0.08}, {x:0.4, y:-0.09}, {x:0.55, y:-0.08}, {x:0.7, y:-0.05}, {x:0.85, y:-0.03}, {x:1, y:-0.01}],
    dorsal: [{x:0.4, y:0.10}, {x:0.45, y:0.16}, {x:0.55, y:0.17}, {x:0.6, y:0.14}, {x:0.62, y:0.09}],
    tail:   { spread: 0.12, length: 0.08, fork: 0.5 },
    pectoral: { x: 0.2, y: -0.01, size: 0.04 },
    eye: { x: 0.08, y: 0.02, r: 0.018 },
  },
  moorishIdol: {
    top:    [{x:0, y:0.02}, {x:0.06, y:0.15}, {x:0.15, y:0.38}, {x:0.3, y:0.52}, {x:0.5, y:0.50}, {x:0.65, y:0.38}, {x:0.8, y:0.20}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.02}, {x:0.06, y:-0.12}, {x:0.15, y:-0.28}, {x:0.3, y:-0.38}, {x:0.5, y:-0.35}, {x:0.65, y:-0.25}, {x:0.8, y:-0.12}, {x:1, y:-0.02}],
    dorsal: [{x:0.1, y:0.38}, {x:0.12, y:0.80}, {x:0.18, y:0.95}, {x:0.30, y:0.85}, {x:0.4, y:0.65}, {x:0.5, y:0.50}],
    tail:   { spread: 0.20, length: 0.12, fork: 0.6 },
    pectoral: { x: 0.25, y: -0.08, size: 0.10 },
    eye: { x: 0.1, y: 0.1, r: 0.03 },
  },
  butterflyfish: {
    top:    [{x:0, y:0.01}, {x:0.06, y:0.10}, {x:0.15, y:0.28}, {x:0.3, y:0.38}, {x:0.5, y:0.40}, {x:0.65, y:0.32}, {x:0.8, y:0.18}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.01}, {x:0.06, y:-0.08}, {x:0.15, y:-0.22}, {x:0.3, y:-0.32}, {x:0.5, y:-0.34}, {x:0.65, y:-0.28}, {x:0.8, y:-0.15}, {x:1, y:-0.02}],
    dorsal: [{x:0.2, y:0.28}, {x:0.3, y:0.48}, {x:0.5, y:0.52}, {x:0.65, y:0.45}, {x:0.7, y:0.32}],
    tail:   { spread: 0.18, length: 0.10, fork: 0.4 },
    pectoral: { x: 0.28, y: -0.05, size: 0.10 },
    eye: { x: 0.1, y: 0.08, r: 0.03 },
  },
  goby: {
    top:    [{x:0, y:0.01}, {x:0.1, y:0.06}, {x:0.25, y:0.09}, {x:0.4, y:0.10}, {x:0.6, y:0.09}, {x:0.8, y:0.06}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.01}, {x:0.1, y:-0.05}, {x:0.25, y:-0.08}, {x:0.4, y:-0.10}, {x:0.6, y:-0.09}, {x:0.8, y:-0.06}, {x:1, y:-0.02}],
    dorsal: [{x:0.2, y:0.09}, {x:0.25, y:0.16}, {x:0.35, y:0.18}, {x:0.5, y:0.16}, {x:0.55, y:0.09}],
    tail:   { spread: 0.10, length: 0.08, fork: 0.3 },
    pectoral: { x: 0.2, y: -0.02, size: 0.06 },
    eye: { x: 0.08, y: 0.03, r: 0.02 },
  },
  wrasse: {
    top:    [{x:0, y:0.01}, {x:0.08, y:0.08}, {x:0.2, y:0.14}, {x:0.4, y:0.18}, {x:0.6, y:0.16}, {x:0.8, y:0.10}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.01}, {x:0.08, y:-0.06}, {x:0.2, y:-0.12}, {x:0.4, y:-0.16}, {x:0.6, y:-0.14}, {x:0.8, y:-0.08}, {x:1, y:-0.02}],
    dorsal: [{x:0.15, y:0.14}, {x:0.25, y:0.25}, {x:0.5, y:0.28}, {x:0.7, y:0.22}, {x:0.75, y:0.16}],
    tail:   { spread: 0.16, length: 0.12, fork: 0.4 },
    pectoral: { x: 0.22, y: -0.03, size: 0.08 },
    eye: { x: 0.08, y: 0.04, r: 0.022 },
  },
  surgeonfish: {
    top:    [{x:0, y:0.01}, {x:0.08, y:0.12}, {x:0.2, y:0.26}, {x:0.4, y:0.32}, {x:0.6, y:0.30}, {x:0.75, y:0.20}, {x:0.88, y:0.10}, {x:1, y:0.02}],
    bottom: [{x:0, y:-0.01}, {x:0.08, y:-0.10}, {x:0.2, y:-0.22}, {x:0.4, y:-0.28}, {x:0.6, y:-0.26}, {x:0.75, y:-0.18}, {x:0.88, y:-0.08}, {x:1, y:-0.02}],
    dorsal: [{x:0.15, y:0.26}, {x:0.2, y:0.42}, {x:0.4, y:0.45}, {x:0.6, y:0.40}, {x:0.7, y:0.30}],
    tail:   { spread: 0.25, length: 0.14, fork: 0.7 },
    pectoral: { x: 0.25, y: -0.05, size: 0.10 },
    eye: { x: 0.1, y: 0.06, r: 0.028 },
  },
  cardinalfish: {
    top:    [{x:0, y:0.01}, {x:0.1, y:0.10}, {x:0.25, y:0.16}, {x:0.4, y:0.18}, {x:0.55, y:0.16}, {x:0.7, y:0.12}, {x:0.85, y:0.06}, {x:1, y:0.01}],
    bottom: [{x:0, y:-0.01}, {x:0.1, y:-0.08}, {x:0.25, y:-0.14}, {x:0.4, y:-0.16}, {x:0.55, y:-0.14}, {x:0.7, y:-0.10}, {x:0.85, y:-0.05}, {x:1, y:-0.01}],
    dorsal: [{x:0.25, y:0.16}, {x:0.3, y:0.28}, {x:0.45, y:0.30}, {x:0.55, y:0.25}, {x:0.6, y:0.16}],
    tail:   { spread: 0.16, length: 0.10, fork: 0.4 },
    pectoral: { x: 0.22, y: -0.03, size: 0.07 },
    eye: { x: 0.1, y: 0.04, r: 0.028 },
  },
  mandarinfish: {
    top:    [{x:0, y:0.01}, {x:0.1, y:0.10}, {x:0.25, y:0.16}, {x:0.4, y:0.18}, {x:0.55, y:0.16}, {x:0.7, y:0.12}, {x:0.85, y:0.06}, {x:1, y:0.01}],
    bottom: [{x:0, y:-0.01}, {x:0.1, y:-0.08}, {x:0.25, y:-0.15}, {x:0.4, y:-0.18}, {x:0.55, y:-0.15}, {x:0.7, y:-0.10}, {x:0.85, y:-0.05}, {x:1, y:-0.01}],
    dorsal: [{x:0.15, y:0.16}, {x:0.2, y:0.30}, {x:0.35, y:0.35}, {x:0.5, y:0.32}, {x:0.6, y:0.22}, {x:0.65, y:0.16}],
    tail:   { spread: 0.16, length: 0.10, fork: 0.3 },
    pectoral: { x: 0.25, y: -0.06, size: 0.10 },
    eye: { x: 0.08, y: 0.04, r: 0.022 },
  },
};

// ── Color patterns ──
// Each fish has a pattern type and color palette
export const FISH_PATTERNS = {
  clownfish:     { type: 'bands', colors: ['#FF6600', '#FFFFFF', '#1a1a1a'], bandCount: 3, bandWidth: 0.08 },
  angelfish:     { type: 'stripes', colors: ['#FFD700', '#1a1a1a', '#FFFFFF'], stripeCount: 5, angle: 90 },
  tang:          { type: 'solid_accent', colors: ['#1a5fd0', '#FFD700', '#1a1a1a'], accentZone: 'tail' },
  betta:         { type: 'gradient_flowing', colors: ['#8B00FF', '#FF1493', '#4169E1'], },
  guppy:         { type: 'spots_tail', colors: ['#90EE90', '#FF6347', '#FFD700'], spotSize: 0.03 },
  discus:        { type: 'wavy_stripes', colors: ['#CD3333', '#2B65EC', '#FFD700'], stripeCount: 8 },
  lionfish:      { type: 'zebra', colors: ['#CD3333', '#F5DEB3', '#1a1a1a'], stripeCount: 12 },
  neonTetra:     { type: 'horizontal_band', colors: ['#4169E1', '#FF2020', '#C0C0C0'], bandY: 0.45 },
  moorishIdol:   { type: 'bold_bands', colors: ['#FFD700', '#1a1a1a', '#FFFFFF'], bandCount: 3 },
  butterflyfish: { type: 'eyespot', colors: ['#FFD700', '#FFFFFF', '#1a1a1a'], spotX: 0.65, spotY: 0.5 },
  goby:          { type: 'mottled', colors: ['#D2B48C', '#8B4513', '#F5DEB3'], },
  wrasse:        { type: 'gradient_h', colors: ['#20B2AA', '#4169E1', '#FF69B4'], },
  surgeonfish:   { type: 'solid_accent', colors: ['#4AA5FF', '#FFD700', '#1a1a1a'], accentZone: 'tail' },
  cardinalfish:  { type: 'solid_stripe', colors: ['#CD3333', '#F0F0F0', '#1a1a1a'], stripeY: 0.5 },
  mandarinfish:  { type: 'psychedelic', colors: ['#FF6600', '#2B65EC', '#32CD32', '#FF4500'], },
};

export const FISH_CATEGORIES = {
  schooling: ['neonTetra', 'cardinalfish', 'clownfish'],
  solitary: ['betta', 'lionfish', 'moorishIdol'],
  bottom: ['goby', 'mandarinfish'],
  mid: ['tang', 'angelfish', 'discus', 'butterflyfish', 'surgeonfish', 'wrasse'],
  surface: ['guppy'],
};

// ── Perlin noise for fish textures ──

// Simple 2D value noise with smooth interpolation
function _hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function _smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = _hash(ix, iy), n10 = _hash(ix + 1, iy);
  const n01 = _hash(ix, iy + 1), n11 = _hash(ix + 1, iy + 1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function _perlin2D(x, y, octaves = 4) {
  let val = 0, amp = 1, freq = 1, totalAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += _smoothNoise(x * freq, y * freq) * amp;
    totalAmp += amp;
    amp *= 0.5;
    freq *= 2.17;
  }
  return val / totalAmp;
}

function _addFishTextureDetail(ctx, width, height, patternDef) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Seed offset for variety per fish
  const seedX = Math.random() * 100;
  const seedY = Math.random() * 100;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      const nx = px / width;
      const ny = py / height;

      // Multi-frequency noise layers
      // 1. Large-scale color variation (mottling)
      const mottleNoise = _perlin2D(nx * 4 + seedX, ny * 4 + seedY, 3) - 0.5;

      // 2. Fine scale texture (scales/skin detail)
      const fineNoise = _perlin2D(nx * 20 + seedX, ny * 15 + seedY, 2) - 0.5;

      // 3. Very fine grain
      const grain = (Math.random() - 0.5) * 8;

      // Combine: mottling affects color, fine noise adds detail
      const mottleStr = 20; // subtle color shift
      const fineStr = 12;   // fine detail

      data[idx]     = Math.max(0, Math.min(255, data[idx] + mottleNoise * mottleStr + fineNoise * fineStr + grain));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + mottleNoise * mottleStr * 0.8 + fineNoise * fineStr + grain));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + mottleNoise * mottleStr * 0.6 + fineNoise * fineStr + grain));
    }
  }

  // Add scale-like pattern overlay using circles
  ctx.putImageData(imageData, 0, 0);

  // Subtle scale pattern
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.5;
  const scaleSize = 8 + Math.random() * 4;
  for (let sy = 0; sy < height; sy += scaleSize * 0.8) {
    const offset = (Math.floor(sy / (scaleSize * 0.8)) % 2) * scaleSize * 0.5;
    for (let sx = offset; sx < width; sx += scaleSize) {
      ctx.beginPath();
      ctx.arc(sx, sy, scaleSize * 0.45, 0, Math.PI, false);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Subtle belly gradient (lighter on bottom)
  const bellyGrad = ctx.createLinearGradient(0, 0, 0, height);
  bellyGrad.addColorStop(0, 'rgba(0,0,0,0.05)');
  bellyGrad.addColorStop(0.4, 'rgba(0,0,0,0)');
  bellyGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
  bellyGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = bellyGrad;
  ctx.fillRect(0, 0, width, height);
}

// ── Canvas texture generation ──

function createFishTexture(patternDef, width = 512, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const [primary, secondary, accent] = patternDef.colors;

  // Base fill
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, width, height);

  switch (patternDef.type) {
    case 'bands': {
      // Vertical white bands (like clownfish)
      const bandW = width * (patternDef.bandWidth || 0.08);
      const positions = [0.28, 0.52, 0.78];
      ctx.fillStyle = secondary;
      for (const pos of positions) {
        const x = pos * width - bandW / 2;
        ctx.fillRect(x, 0, bandW, height);
        // Black edge
        ctx.fillStyle = accent;
        ctx.fillRect(x - 2, 0, 3, height);
        ctx.fillRect(x + bandW - 1, 0, 3, height);
        ctx.fillStyle = secondary;
      }
      break;
    }

    case 'stripes': {
      // Diagonal or vertical stripes
      const count = patternDef.stripeCount || 5;
      const angle = (patternDef.angle || 0) * Math.PI / 180;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(angle);
      const stripeW = width / count;
      for (let i = 0; i < count * 2; i++) {
        ctx.fillStyle = i % 2 === 0 ? secondary : primary;
        ctx.fillRect(-width + i * stripeW, -height, stripeW, height * 2);
      }
      ctx.restore();
      break;
    }

    case 'solid_accent': {
      // Solid body with accent color on tail or face
      if (patternDef.accentZone === 'tail') {
        const grd = ctx.createLinearGradient(width * 0.7, 0, width, 0);
        grd.addColorStop(0, primary);
        grd.addColorStop(0.3, secondary);
        grd.addColorStop(1, secondary);
        ctx.fillStyle = grd;
        ctx.fillRect(width * 0.7, 0, width * 0.3, height);
        // Dark bar near tail
        ctx.fillStyle = accent;
        ctx.fillRect(width * 0.68, 0, width * 0.03, height);
      }
      break;
    }

    case 'gradient_flowing': {
      // Flowing multi-color gradient (betta)
      const grd = ctx.createLinearGradient(0, 0, width, height);
      patternDef.colors.forEach((c, i) => {
        grd.addColorStop(i / (patternDef.colors.length - 1), c);
      });
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, width, height);
      // Add some vein-like lines
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * width * 0.3, Math.random() * height);
        ctx.bezierCurveTo(
          width * 0.3 + Math.random() * width * 0.3, Math.random() * height,
          width * 0.6 + Math.random() * width * 0.2, Math.random() * height,
          width, Math.random() * height
        );
        ctx.stroke();
      }
      break;
    }

    case 'spots_tail': {
      // Spots concentrated on tail half
      const spotR = width * (patternDef.spotSize || 0.03);
      for (let i = 0; i < 40; i++) {
        const sx = width * 0.4 + Math.random() * width * 0.6;
        const sy = Math.random() * height;
        ctx.fillStyle = patternDef.colors[1 + (i % (patternDef.colors.length - 1))];
        ctx.beginPath();
        ctx.arc(sx, sy, spotR + Math.random() * spotR, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'wavy_stripes': {
      // Wavy horizontal stripes (discus)
      const count = patternDef.stripeCount || 8;
      for (let i = 0; i < count; i++) {
        const baseY = (i / count) * height;
        ctx.strokeStyle = i % 2 === 0 ? secondary : accent;
        ctx.lineWidth = height / count * 0.4;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const y = baseY + Math.sin(x * 0.02 + i) * 8;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }

    case 'zebra': {
      // Vertical zebra stripes (lionfish)
      const count = patternDef.stripeCount || 12;
      for (let i = 0; i < count; i++) {
        const x = (i / count) * width;
        const w = width / count * 0.5;
        ctx.fillStyle = i % 2 === 0 ? secondary : accent;
        // Slightly wavy
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= height; y += 4) {
          ctx.lineTo(x + Math.sin(y * 0.05) * 4, y);
        }
        ctx.lineTo(x + w + Math.sin(height * 0.05) * 4, height);
        for (let y = height; y >= 0; y -= 4) {
          ctx.lineTo(x + w + Math.sin(y * 0.05) * 4, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'horizontal_band': {
      // Horizontal neon band (neon tetra)
      const bandY = patternDef.bandY || 0.45;
      const bandH = height * 0.22;
      // Silver base
      ctx.fillStyle = patternDef.colors[2];
      ctx.fillRect(0, 0, width, height);
      // Blue band upper
      const grd = ctx.createLinearGradient(0, 0, width, 0);
      grd.addColorStop(0, patternDef.colors[0]);
      grd.addColorStop(0.6, patternDef.colors[0]);
      grd.addColorStop(0.61, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, height * 0.25, width, bandH);
      // Red band lower-rear
      const grd2 = ctx.createLinearGradient(0, 0, width, 0);
      grd2.addColorStop(0, 'transparent');
      grd2.addColorStop(0.45, 'transparent');
      grd2.addColorStop(0.5, patternDef.colors[1]);
      grd2.addColorStop(1, patternDef.colors[1]);
      ctx.fillStyle = grd2;
      ctx.fillRect(0, height * 0.5, width, bandH);
      break;
    }

    case 'bold_bands': {
      // Wide bold bands (moorish idol)
      ctx.fillStyle = patternDef.colors[2]; // white base
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = patternDef.colors[0]; // yellow
      ctx.fillRect(0, 0, width * 0.25, height);
      ctx.fillStyle = patternDef.colors[1]; // black
      ctx.fillRect(width * 0.25, 0, width * 0.15, height);
      ctx.fillStyle = patternDef.colors[2]; // white
      ctx.fillRect(width * 0.4, 0, width * 0.2, height);
      ctx.fillStyle = patternDef.colors[1]; // black
      ctx.fillRect(width * 0.6, 0, width * 0.15, height);
      ctx.fillStyle = patternDef.colors[0]; // yellow
      ctx.fillRect(width * 0.75, 0, width * 0.25, height);
      break;
    }

    case 'eyespot': {
      // Body color with a fake eye spot (butterflyfish)
      const sx = (patternDef.spotX || 0.65) * width;
      const sy = (patternDef.spotY || 0.5) * height;
      // Black spot with white ring
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(sx, sy, width * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(sx, sy, width * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(sx, sy, width * 0.025, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'mottled': {
      // Random mottled pattern (goby)
      for (let i = 0; i < 80; i++) {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        const r = 5 + Math.random() * 15;
        ctx.fillStyle = patternDef.colors[Math.floor(Math.random() * patternDef.colors.length)];
        ctx.globalAlpha = 0.4 + Math.random() * 0.4;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'gradient_h': {
      // Horizontal gradient (wrasse)
      const grd = ctx.createLinearGradient(0, 0, width, 0);
      patternDef.colors.forEach((c, i) => {
        grd.addColorStop(i / (patternDef.colors.length - 1), c);
      });
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'solid_stripe': {
      // Solid with horizontal stripe (cardinalfish)
      ctx.fillStyle = accent;
      ctx.fillRect(0, height * 0.42, width, height * 0.16);
      break;
    }

    case 'psychedelic': {
      // Swirly psychedelic pattern (mandarinfish)
      for (let i = 0; i < 60; i++) {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        const r = 8 + Math.random() * 25;
        ctx.fillStyle = patternDef.colors[Math.floor(Math.random() * patternDef.colors.length)];
        ctx.globalAlpha = 0.5 + Math.random() * 0.3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        // Swirl outline
        ctx.strokeStyle = patternDef.colors[(Math.floor(Math.random() * patternDef.colors.length))];
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.2) {
          const sr = r * 0.3 + a * 2;
          ctx.lineTo(cx + Math.cos(a) * sr, cy + Math.sin(a) * sr);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }

  // Perlin-like noise for realistic scale texture
  _addFishTextureDetail(ctx, width, height, patternDef);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// ── Geometry from spline profile ──

function splineCurve(points, segments = 64) {
  // Catmull-Rom through points
  const curve = new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(p.x, p.y, 0)),
    false, 'catmullrom', 0.5
  );
  return curve.getPoints(segments);
}

/**
 * Build a fish mesh from profile + pattern.
 * Creates a flat panel with the fish silhouette shape, textured with the pattern.
 */
export function createFishMesh(type) {
  const profile = PROFILES[type] || PROFILES.clownfish;
  const pattern = FISH_PATTERNS[type] || FISH_PATTERNS.clownfish;

  const group = new THREE.Group();
  group.userData.fishType = type;

  // Generate texture
  const texture = createFishTexture(pattern);

  // ── Build body shape from profile ──
  const shape = new THREE.Shape();
  const topPts = profile.top;
  const botPts = [...profile.bottom].reverse();

  // Start at nose
  shape.moveTo(topPts[0].x, topPts[0].y);

  // Top outline
  for (let i = 1; i < topPts.length; i++) {
    shape.lineTo(topPts[i].x, topPts[i].y);
  }

  // Add tail fork
  const tail = profile.tail;
  const lastTop = topPts[topPts.length - 1];
  shape.lineTo(lastTop.x + tail.length, tail.spread);
  shape.lineTo(lastTop.x + tail.length * 0.5, tail.fork * 0.02);
  shape.lineTo(lastTop.x + tail.length, -tail.spread);

  // Bottom outline (reversed)
  for (let i = 0; i < botPts.length; i++) {
    shape.lineTo(botPts[i].x, botPts[i].y);
  }
  shape.lineTo(topPts[0].x, topPts[0].y);

  // Extrude with subtle puff — not flat sticks but not chunky
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 3,
  });

  // Compute UV mapping based on bounding box
  _computeFishUVs(bodyGeo);

  // Extract a dominant color from the pattern for emissive glow
  const glowColor = new THREE.Color(pattern.colors[0]);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.35,
    metalness: 0.08,
    side: THREE.DoubleSide,
    emissive: glowColor,
    emissiveIntensity: 0.12,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // ── Dorsal fin ──
  if (profile.dorsal && profile.dorsal.length > 2) {
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(profile.dorsal[0].x, profile.dorsal[0].y);
    for (let i = 1; i < profile.dorsal.length; i++) {
      dorsalShape.lineTo(profile.dorsal[i].x, profile.dorsal[i].y);
    }
    dorsalShape.lineTo(profile.dorsal[0].x, profile.dorsal[0].y);

    const dorsalGeo = new THREE.ShapeGeometry(dorsalShape);
    const dorsalColor = pattern.colors[1] || pattern.colors[0];
    const dorsalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(dorsalColor),
      roughness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const dorsal = new THREE.Mesh(dorsalGeo, dorsalMat);
    dorsal.position.z = 0.04;
    group.add(dorsal);
  }

  // ── Pectoral fin ──
  const pec = profile.pectoral;
  if (pec) {
    const pecShape = new THREE.Shape();
    pecShape.moveTo(0, 0);
    pecShape.quadraticCurveTo(pec.size * 0.6, -pec.size * 0.8, pec.size, -pec.size * 0.2);
    pecShape.lineTo(0, 0);
    const pecGeo = new THREE.ShapeGeometry(pecShape);
    const pecMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(pattern.colors[1] || pattern.colors[0]),
      roughness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const fin = new THREE.Mesh(pecGeo, pecMat);
    fin.position.set(pec.x, pec.y, 0.05);
    group.add(fin);
  }

  // ── Eye (shimmer dome) ──
  const eye = profile.eye;
  if (eye) {
    const eyeGroup = _buildShimmerEye(eye, pattern.colors[0]);
    eyeGroup.position.set(eye.x, eye.y, 0.11);
    group.add(eyeGroup);
  }

  // Center the geometry so the fish pivots from its center
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.children.forEach(child => {
    child.position.x -= center.x;
    child.position.y -= center.y;
  });

  return group;
}

/**
 * Build a shimmer eye — a small hemisphere cornea over a pigmented iris disc and
 * a tiny inset pupil, plus a moving catchlight and an iridescent ring.
 * Replaces the old flat 3-circle stack with something that reads as a real eye.
 */
function _buildShimmerEye(eye, speciesTint = '#ffcc66') {
  const g = new THREE.Group();
  const R = eye.r;

  // 1. Sclera / eye-white backdrop (slightly recessed, off-white)
  const scleraGeo = new THREE.CircleGeometry(R * 1.55, 32);
  const scleraMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe6, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide,
  });
  const sclera = new THREE.Mesh(scleraGeo, scleraMat);
  sclera.position.z = -0.004;
  g.add(sclera);

  // 2. Iris ring — species-tinted, metallic, with emissive glow (tapetum-lucidum vibe)
  const tint = new THREE.Color(speciesTint);
  const iris = new THREE.Mesh(
    new THREE.RingGeometry(R * 0.45, R * 1.2, 64),
    new THREE.MeshStandardMaterial({
      color: tint,
      emissive: tint.clone().multiplyScalar(0.35),
      emissiveIntensity: 0.55,
      metalness: 0.65, roughness: 0.28, side: THREE.DoubleSide,
    })
  );
  iris.position.z = 0.001;
  g.add(iris);

  // 3. Pupil (slight vertical oval, sunken inward)
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x050505, roughness: 0.15, metalness: 0.0, side: THREE.DoubleSide,
  });
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(R * 0.55, 48), pupilMat);
  pupil.scale.set(0.92, 1.0, 1.0);
  pupil.position.z = 0.004;
  g.add(pupil);

  // 4. Iridescent thin ring between pupil and iris (gold → teal shimmer)
  const shimmerGeo = new THREE.RingGeometry(R * 0.52, R * 0.62, 64);
  // Per-vertex colour around the ring for a cheap rainbow
  const colArr = new Float32Array(shimmerGeo.attributes.position.count * 3);
  const pos = shimmerGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ang = Math.atan2(pos.getY(i), pos.getX(i));
    const h = (ang + Math.PI) / (Math.PI * 2);
    const col = new THREE.Color().setHSL((h + 0.15) % 1, 0.85, 0.62);
    colArr[i * 3] = col.r; colArr[i * 3 + 1] = col.g; colArr[i * 3 + 2] = col.b;
  }
  shimmerGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  const shimmer = new THREE.Mesh(shimmerGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));
  shimmer.position.z = 0.007;
  g.add(shimmer);

  // 5. Cornea — small glossy hemisphere in front (catches light)
  const corneaGeo = new THREE.SphereGeometry(R * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.05, metalness: 0.0,
    transmission: 0.85, thickness: 0.1, ior: 1.33,
    clearcoat: 1.0, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.35,
  });
  const cornea = new THREE.Mesh(corneaGeo, corneaMat);
  cornea.rotation.x = -Math.PI / 2;
  cornea.position.z = 0.012;
  g.add(cornea);

  // 6. Main catchlight — top-left bright dot
  const glint = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.22, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  glint.position.set(-R * 0.28, R * 0.35, 0.018);
  g.add(glint);

  // 7. Secondary micro-glint — small cyan-tinted sparkle on bottom-right
  const sparkle = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.08, 12),
    new THREE.MeshBasicMaterial({ color: 0xbbeeff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending })
  );
  sparkle.position.set(R * 0.28, -R * 0.28, 0.018);
  g.add(sparkle);

  // Tag the shimmer ring so FishManager can spin it per frame
  g.userData.shimmerRing = shimmer;
  g.userData.eyeGroup = true;
  return g;
}

function _computeFishUVs(geometry) {
  const pos = geometry.attributes.position;
  const uvs = new Float32Array(pos.count * 2);

  // Get bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) - minX) / rangeX;
    uvs[i * 2 + 1] = (pos.getY(i) - minY) / rangeY;
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

// Re-export for compatibility
export const FISH_PRESETS = Object.keys(PROFILES).reduce((acc, key) => {
  acc[key] = PROFILES[key];
  return acc;
}, {});

export const FISH_COLORS = Object.keys(FISH_PATTERNS).reduce((acc, key) => {
  const p = FISH_PATTERNS[key];
  acc[key] = { primary: p.colors[0], secondary: p.colors[1] || p.colors[0], accent: p.colors[2] || p.colors[0] };
  return acc;
}, {});
