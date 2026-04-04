#!/usr/bin/env node
/**
 * gen_coral.js — Generates 32 coral types using fractal branching, L-systems, and procedural shapes.
 * Usage: node agents/tools/gen_coral.js --all --out output/coral/geometry/
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;
const PAD = 40;

function hash(x) { return ((Math.sin(x * 127.1) * 43758.5453) % 1 + 1) % 1; }
function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function rgbStr(r,g,b,a=1) { return `rgba(${r},${g},${b},${a})`; }

const CORALS = {
  staghorn: {
    name: 'Staghorn Coral', type: 'branching',
    color: { base: '#cc8844', mid: '#ddaa66', tip: '#eedd99' },
    branchAngle: 0.5, branchDecay: 0.62, branchProb: 0.90,
    maxDepth: 8, thickness: 6, height: 0.40,
  },
  elkhorn: {
    name: 'Elkhorn Coral', type: 'branching',
    color: { base: '#aa6622', mid: '#cc8833', tip: '#eebb44' },
    branchAngle: 0.55, branchDecay: 0.68, branchProb: 0.6,
    maxDepth: 4, thickness: 14, height: 0.55,
  },
  brain: {
    name: 'Brain Coral', type: 'massive',
    color: { base: '#886644', mid: '#aa8866', tip: '#ccaa88' },
    ridgeFreq: 12, ridgeDepth: 0.3, radius: 0.30,
  },
  bubble: {
    name: 'Bubble Coral', type: 'massive',
    color: { base: '#88aa88', mid: '#aaccaa', tip: '#cceecc' },
    bubbleCount: 25, bubbleSize: 0.04, radius: 0.25,
  },
  mushroom: {
    name: 'Mushroom Coral', type: 'plate',
    color: { base: '#aa6688', mid: '#cc88aa', tip: '#ddaacc' },
    radius: 0.25, ridgeCount: 16, height: 0.08,
  },
  tableCoral: {
    name: 'Table Coral', type: 'plate',
    color: { base: '#668855', mid: '#88aa77', tip: '#aacc99' },
    radius: 0.35, ridgeCount: 0, height: 0.12,
  },
  pillarCoral: {
    name: 'Pillar Coral', type: 'pillar',
    color: { base: '#887755', mid: '#aa9977', tip: '#ccbb99' },
    pillarCount: 4, pillarHeight: 0.65, pillarWidth: 0.06,
  },
  fireCoral: {
    name: 'Fire Coral', type: 'branching',
    color: { base: '#dd7711', mid: '#ffaa22', tip: '#ffdd44' },
    branchAngle: 0.3, branchDecay: 0.75, branchProb: 0.8,
    maxDepth: 5, thickness: 5, height: 0.55,
  },
  seaFan: {
    name: 'Sea Fan', type: 'fan',
    color: { base: '#aa1166', mid: '#cc2288', tip: '#ee44aa' },
    fanSpread: 0.8, fanDensity: 12, height: 0.65, thickness: 2,
  },
  tubeCoral: {
    name: 'Tube Coral', type: 'tube',
    color: { base: '#dd8833', mid: '#eeaa55', tip: '#ffcc77' },
    tubeCount: 12, tubeHeight: 0.25, tubeWidth: 0.025,
  },
  starCoral: {
    name: 'Star Coral', type: 'massive',
    color: { base: '#887766', mid: '#aa9988', tip: '#ccbbaa' },
    polyps: true, polypSize: 0.012, radius: 0.28,
  },
  organPipe: {
    name: 'Organ Pipe Coral', type: 'tube',
    color: { base: '#cc3333', mid: '#dd5555', tip: '#ee7777' },
    tubeCount: 20, tubeHeight: 0.35, tubeWidth: 0.018,
  },
  lettuceCoral: {
    name: 'Lettuce Coral', type: 'folding',
    color: { base: '#55aa55', mid: '#77cc77', tip: '#99ee99' },
    foldCount: 6, foldSize: 0.18, height: 0.30,
  },
  dendro: {
    name: 'Dendrophyllia', type: 'branching',
    color: { base: '#ee6600', mid: '#ff8811', tip: '#ffcc33' },
    branchAngle: 0.5, branchDecay: 0.65, branchProb: 0.55,
    maxDepth: 4, thickness: 6, height: 0.50,
  },
  montipora: {
    name: 'Montipora', type: 'encrusting',
    color: { base: '#2244cc', mid: '#4466ff', tip: '#6688ff' },
    radius: 0.30, bumps: 30,
  },
  acropora: {
    name: 'Acropora', type: 'branching',
    color: { base: '#6622aa', mid: '#8844cc', tip: '#aa66ee' },
    branchAngle: 0.35, branchDecay: 0.70, branchProb: 0.75,
    maxDepth: 6, thickness: 4, height: 0.60,
  },
  hammerCoral: {
    name: 'Hammer Coral', type: 'tentacle_tip',
    color: { base: '#446622', mid: '#66bb33', tip: '#88ff44' },
    tentacleCount: 12, tentacleHeight: 0.35, tentacleWidth: 0.008,
    tipShape: 'hammer', tipSize: 0.035,
  },
  torchCoral: {
    name: 'Torch Coral', type: 'tentacle_tip',
    color: { base: '#665533', mid: '#88773a', tip: '#77cc44' },
    tentacleCount: 14, tentacleHeight: 0.42, tentacleWidth: 0.010,
    tipShape: 'torch', tipSize: 0.020,
  },
  frogspawn: {
    name: 'Frogspawn Coral', type: 'tentacle_tip',
    color: { base: '#445544', mid: '#66aa55', tip: '#aa77dd' },
    tentacleCount: 22, tentacleHeight: 0.32, tentacleWidth: 0.010,
    tipShape: 'bubble', tipSize: 0.018,
  },
  zoanthidRock: {
    name: 'Zoanthid Rock', type: 'encrusting',
    color: { base: '#22aa22', mid: '#44ff44', tip: '#ff8822' },
    radius: 0.28, bumps: 50, polypRings: true,
  },
  leather: {
    name: 'Leather Coral', type: 'massive',
    color: { base: '#8a7355', mid: '#b09570', tip: '#c8ab85' },
    foldEdges: true, radius: 0.32,
  },
  toadstool: {
    name: 'Toadstool Coral', type: 'massive',
    color: { base: '#8a7a55', mid: '#b09a70', tip: '#c8b888' },
    stalkShape: true, radius: 0.28,
  },
  galaxyCoral: {
    name: 'Galaxy Coral', type: 'massive',
    color: { base: '#222233', mid: '#333344', tip: '#eeeeff' },
    polyps: true, polypSize: 0.014, radius: 0.26,
  },
  birdsnest: {
    name: 'Birdsnest Coral', type: 'branching',
    color: { base: '#cc2277', mid: '#ff44aa', tip: '#ff77cc' },
    branchAngle: 0.45, branchDecay: 0.74, branchProb: 0.85,
    maxDepth: 7, thickness: 2, height: 0.65,
  },
  caulastrea: {
    name: 'Candy Cane Coral', type: 'tube',
    color: { base: '#338844', mid: '#55bb66', tip: '#88ee99' },
    tubeCount: 10, tubeHeight: 0.22, tubeWidth: 0.030, flaredTop: true,
  },
  pavona: {
    name: 'Pavona Coral', type: 'plate',
    color: { base: '#667744', mid: '#88aa66', tip: '#aacc88' },
    radius: 0.30, ridgeCount: 0, height: 0.05, scrolling: true,
  },
  gonipora: {
    name: 'Flowerpot Coral', type: 'massive',
    color: { base: '#448844', mid: '#66bb66', tip: '#88ee88' },
    longPolyps: true, polypSize: 0.018, radius: 0.26,
  },
  chalice: {
    name: 'Chalice Coral', type: 'encrusting',
    color: { base: '#5533aa', mid: '#7744cc', tip: '#4488ff' },
    radius: 0.32, bumps: 15, brightRim: true,
  },
  stylophora: {
    name: 'Cat\'s Paw Coral', type: 'branching',
    color: { base: '#dd4477', mid: '#ff66aa', tip: '#ff99cc' },
    branchAngle: 0.55, branchDecay: 0.60, branchProb: 0.5,
    maxDepth: 3, thickness: 10, height: 0.40,
  },
  platygyra: {
    name: 'Maze Coral', type: 'massive',
    color: { base: '#446633', mid: '#668844', tip: '#99bb66' },
    ridgeFreq: 8, ridgeDepth: 0.4, radius: 0.30,
  },
  softTreeCoral: {
    name: 'Soft Tree Coral', type: 'branching',
    color: { base: '#dd1111', mid: '#ff3322', tip: '#ff7744' },
    branchAngle: 0.50, branchDecay: 0.68, branchProb: 0.65,
    maxDepth: 5, thickness: 8, height: 0.60,
  },
  pulsatingXenia: {
    name: 'Pulsating Xenia', type: 'tube',
    color: { base: '#ddbbcc', mid: '#eeccdd', tip: '#ffddee' },
    tubeCount: 16, tubeHeight: 0.28, tubeWidth: 0.020, featheryTop: true,
  },
};

function renderCoral(name, spec) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const baseX = SIZE / 2;
  const baseY = SIZE - PAD;

  if (spec.type === 'branching') {
    seedRng(name.length * 1337 + name.charCodeAt(0) * 7);
    drawBranch(ctx, baseX, baseY, -Math.PI / 2, spec.height * (SIZE - PAD * 2), spec.thickness, spec, 0, 0);
  } else if (spec.type === 'massive') {
    drawMassive(ctx, baseX, baseY - spec.radius * SIZE, spec);
  } else if (spec.type === 'plate') {
    drawPlate(ctx, baseX, baseY - 20, spec);
  } else if (spec.type === 'pillar') {
    drawPillars(ctx, baseX, baseY, spec);
  } else if (spec.type === 'fan') {
    drawFan(ctx, baseX, baseY, spec);
  } else if (spec.type === 'tube') {
    drawTubes(ctx, baseX, baseY, spec);
  } else if (spec.type === 'folding') {
    drawFolding(ctx, baseX, baseY, spec);
  } else if (spec.type === 'encrusting') {
    drawEncrusting(ctx, baseX, baseY - 20, spec);
  } else if (spec.type === 'tentacle_tip') {
    drawTentacleTip(ctx, baseX, baseY, spec);
  }

  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(name, 10, SIZE - 10);
  return canvas;
}

// Seeded RNG for reproducible but varied branching
let _rngState = 1;
function seedRng(s) { _rngState = s || 1; }
function rng() {
  _rngState = (_rngState * 16807 + 0) % 2147483647;
  return (_rngState & 0x7fffffff) / 0x7fffffff;
}

function drawBranch(ctx, x, y, angle, length, thickness, spec, depth, seed) {
  if (depth > spec.maxDepth || length < 4) return;

  const ex = x + Math.cos(angle) * length;
  const ey = y + Math.sin(angle) * length;
  const t = depth / spec.maxDepth;
  const [br, bg, bb] = hexToRgb(spec.color.base);
  const [tr, tg, tb] = hexToRgb(spec.color.tip);

  // Draw branch segment
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = rgbStr(lerp(br,tr,t), lerp(bg,tg,t), lerp(bb,tb,t));
  ctx.lineWidth = Math.max(1, thickness * (1 - t * 0.5));
  ctx.lineCap = 'round';
  ctx.stroke();

  // Polyp dots at tips
  if (depth >= spec.maxDepth - 1) {
    ctx.beginPath();
    ctx.arc(ex, ey, Math.max(2, thickness * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = spec.color.tip;
    ctx.fill();
  }

  const nextLen = length * spec.branchDecay;
  // Use seeded RNG for varied but reproducible angle spread
  const sway = (rng() - 0.5) * 0.4;

  // Main branch continues with random sway
  drawBranch(ctx, ex, ey, angle + sway * 0.5, nextLen, thickness * 0.78, spec, depth + 1, seed + 1);

  // Side branch — high probability, significant angle offset
  if (rng() < spec.branchProb) {
    const side = rng() > 0.5 ? 1 : -1;
    const branchAngle = spec.branchAngle * (0.7 + rng() * 0.6); // vary angle
    drawBranch(ctx, ex, ey, angle + branchAngle * side + sway, nextLen * 0.85, thickness * 0.65, spec, depth + 1, seed + 100);
  }
  // Occasional opposite branch
  if (rng() < spec.branchProb * 0.4) {
    const side = hash(seed * 500 + depth) > 0.5 ? 1 : -1;
    drawBranch(ctx, ex, ey, angle - spec.branchAngle * side, nextLen * 0.7, thickness * 0.5, spec, depth + 1, seed + 200);
  }
}

function drawMassive(ctx, cx, cy, spec) {
  const r = spec.radius * SIZE;

  // Toadstool: draw thick prominent stalk below the cap
  if (spec.stalkShape) {
    const stalkW = r * 0.45;
    const stalkH = r * 1.6;
    // Slightly tapered stalk with texture
    ctx.beginPath();
    ctx.moveTo(cx - stalkW, cy + r * 0.15);
    ctx.quadraticCurveTo(cx - stalkW * 0.7, cy + stalkH * 0.5, cx - stalkW * 0.65, cy + stalkH);
    ctx.lineTo(cx + stalkW * 0.65, cy + stalkH);
    ctx.quadraticCurveTo(cx + stalkW * 0.7, cy + stalkH * 0.5, cx + stalkW, cy + r * 0.15);
    ctx.closePath();
    const sg = ctx.createLinearGradient(cx - stalkW, 0, cx + stalkW, 0);
    sg.addColorStop(0, spec.color.base);
    sg.addColorStop(0.3, spec.color.mid);
    sg.addColorStop(0.7, spec.color.mid);
    sg.addColorStop(1, spec.color.base);
    ctx.fillStyle = sg;
    ctx.fill();
    // Vertical texture lines on stalk
    for (let s = 0; s < 6; s++) {
      const sx = cx + (s / 5 - 0.5) * stalkW * 0.9;
      ctx.beginPath();
      ctx.moveTo(sx, cy + r * 0.2);
      ctx.lineTo(sx * 0.98 + cx * 0.02, cy + stalkH * 0.9);
      ctx.strokeStyle = spec.color.base + '66';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Base hemisphere
  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, spec.color.tip);
  grad.addColorStop(0.6, spec.color.mid);
  grad.addColorStop(1, spec.color.base);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  if (spec.ridgeFreq) {
    // Brain coral ridges — thick, high-contrast meandering valleys
    for (let i = 0; i < spec.ridgeFreq; i++) {
      const angle = (i / spec.ridgeFreq) * Math.PI * 2;
      // Dark valley line (shadow)
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.015) {
        const wobble = Math.sin(t * 20 + i * 3) * r * 0.10;
        const rx = cx + Math.cos(angle + t * 0.8) * r * t + wobble;
        const ry = cy + Math.sin(angle + t * 0.8) * r * t * 0.6;
        t === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();
      // Lighter ridge crest on top
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.015) {
        const wobble = Math.sin(t * 20 + i * 3) * r * 0.10;
        const rx = cx + Math.cos(angle + t * 0.8) * r * t + wobble;
        const ry = cy + Math.sin(angle + t * 0.8) * r * t * 0.6;
        t === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = spec.color.tip;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  if (spec.bubbleCount) {
    for (let i = 0; i < spec.bubbleCount; i++) {
      const a = hash(i * 17) * Math.PI * 2;
      const d = hash(i * 31) * r * 0.8;
      const bx = cx + Math.cos(a) * d;
      const by = cy + Math.sin(a) * d * 0.6;
      const br = spec.bubbleSize * SIZE * (0.6 + hash(i * 43) * 0.4);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br);
      bg.addColorStop(0, 'rgba(255,255,255,0.85)');
      bg.addColorStop(0.25, 'rgba(255,255,255,0.4)');
      bg.addColorStop(0.5, spec.color.tip);
      bg.addColorStop(1, spec.color.mid);
      ctx.fillStyle = bg;
      ctx.fill();
      // Specular highlight dot
      ctx.beginPath();
      ctx.arc(bx - br * 0.25, by - br * 0.25, br * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }
  }

  if (spec.polyps) {
    const isGalaxy = spec.color.base === '#222233'; // galaxy coral has dark base
    const polypCount = isGalaxy ? 100 : 80;
    for (let i = 0; i < polypCount; i++) {
      const a = hash(i * 23) * Math.PI * 2;
      const d = hash(i * 37) * r * 0.9;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.6;
      const pr = spec.polypSize * SIZE;
      if (isGalaxy) {
        // Galaxy coral: bright white star polyps with glow for high contrast
        // Glow
        ctx.beginPath();
        ctx.arc(px, py, pr * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();
        // Star shape - bright white
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const sa = s / 8 * Math.PI * 2;
          const rad = s % 2 === 0 ? pr : pr * 0.4;
          const sx = px + Math.cos(sa) * rad;
          const sy = py + Math.sin(sa) * rad;
          s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        // Center dot
        ctx.beginPath();
        ctx.arc(px, py, pr * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = spec.color.tip;
        ctx.fill();
      } else {
        // Standard star polyps
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const sa = s / 6 * Math.PI * 2;
          const sx = px + Math.cos(sa) * pr;
          const sy = py + Math.sin(sa) * pr;
          s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = spec.color.tip + 'cc';
        ctx.fill();
      }
    }
  }

  // Leather coral: deeply folded/ruffled edges with multiple layers
  if (spec.foldEdges) {
    // Multiple overlapping ruffled lobes
    for (let layer = 0; layer < 3; layer++) {
      const layerR = r * (1.0 + layer * 0.06);
      const phase = layer * 1.5;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const ruffle = layerR * (1.0 + Math.sin(a * 16 + phase) * 0.15 + Math.sin(a * 7 + phase) * 0.08);
        const x = cx + Math.cos(a) * ruffle;
        const y = cy + Math.sin(a) * ruffle * 0.6;
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = layer === 0 ? spec.color.base : spec.color.mid;
      ctx.lineWidth = 3 - layer * 0.5;
      ctx.stroke();
      // Fill outer ruffle with semi-transparent layer
      if (layer > 0) {
        ctx.fillStyle = spec.color.mid + '33';
        ctx.fill();
      }
    }
    // Radial fold lines across surface
    for (let i = 0; i < 12; i++) {
      const fa = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(fa) * r * 0.9, cy + Math.sin(fa) * r * 0.54);
      ctx.strokeStyle = spec.color.base + '55';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Gonipora: long extending polyp tentacles, clearly visible
  if (spec.longPolyps) {
    for (let i = 0; i < 80; i++) {
      const a = hash(i * 23) * Math.PI * 2;
      const d = hash(i * 37) * r * 0.85;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.6;
      const pLen = spec.polypSize * SIZE * 5;
      const pa = -Math.PI / 2 + (hash(i * 53) - 0.5) * 1.0;
      // Curved tentacle stalk
      const midX = px + Math.cos(pa) * pLen * 0.5 + (hash(i * 67) - 0.5) * 6;
      const midY = py + Math.sin(pa) * pLen * 0.5;
      const ex = px + Math.cos(pa) * pLen;
      const ey = py + Math.sin(pa) * pLen;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(midX, midY, ex, ey);
      ctx.strokeStyle = spec.color.tip;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Flower-shaped tip
      ctx.beginPath();
      ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.tip;
      ctx.fill();
      // Tiny petal ring
      for (let p = 0; p < 5; p++) {
        const petalA = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(ex + Math.cos(petalA) * 3, ey + Math.sin(petalA) * 3, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = spec.color.mid;
        ctx.fill();
      }
    }
  }
}

function drawPlate(ctx, cx, cy, spec) {
  const r = spec.radius * SIZE;
  const h = spec.height * SIZE;

  // Side of plate (3D illusion)
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, h, 0, 0, Math.PI);
  ctx.fillStyle = spec.color.base;
  ctx.fill();

  // Top surface
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.3, r, r * 0.35, 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx, cy - h * 0.3, 0, cx, cy - h * 0.3, r);
  grad.addColorStop(0, spec.color.tip);
  grad.addColorStop(0.7, spec.color.mid);
  grad.addColorStop(1, spec.color.base);
  ctx.fillStyle = grad;
  ctx.fill();

  // Ridges
  if (spec.ridgeCount > 0) {
    ctx.strokeStyle = spec.color.base + '88';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < spec.ridgeCount; i++) {
      const a = (i / spec.ridgeCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.3);
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy - h * 0.3 + Math.sin(a) * r * 0.33);
      ctx.stroke();
    }
  }
}

function drawPillars(ctx, cx, cy, spec) {
  for (let i = 0; i < spec.pillarCount; i++) {
    const px = cx + (hash(i * 17) - 0.5) * SIZE * 0.3;
    const ph = spec.pillarHeight * (SIZE - PAD * 2) * (0.6 + hash(i * 31) * 0.4);
    const pw = spec.pillarWidth * SIZE * (0.7 + hash(i * 43) * 0.3);

    // Fuzzy texture on pillar
    const grad = ctx.createLinearGradient(px - pw, cy, px + pw, cy);
    grad.addColorStop(0, spec.color.base);
    grad.addColorStop(0.3, spec.color.mid);
    grad.addColorStop(0.7, spec.color.mid);
    grad.addColorStop(1, spec.color.base);

    // Slightly wavy pillar
    ctx.beginPath();
    ctx.moveTo(px - pw, cy);
    for (let t = 0; t <= 1; t += 0.05) {
      const w = pw * (0.9 + Math.sin(t * 8 + i) * 0.1);
      ctx.lineTo(px - w, cy - t * ph);
    }
    // Rounded top
    ctx.arc(px, cy - ph, pw, Math.PI, 0);
    for (let t = 1; t >= 0; t -= 0.05) {
      const w = pw * (0.9 + Math.sin(t * 8 + i) * 0.1);
      ctx.lineTo(px + w, cy - t * ph);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = spec.color.base;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawFan(ctx, cx, cy, spec) {
  const h = spec.height * (SIZE - PAD * 2);
  const spread = spec.fanSpread;

  // Central stalk
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - h * 0.2);
  ctx.strokeStyle = spec.color.base;
  ctx.lineWidth = spec.thickness * 2;
  ctx.stroke();

  // Fan branches
  for (let i = 0; i < spec.fanDensity; i++) {
    const t = i / (spec.fanDensity - 1);
    const angle = -Math.PI / 2 - spread / 2 + t * spread;
    const len = h * (0.7 + hash(i * 17) * 0.3);

    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.2);
    const ex = cx + Math.cos(angle) * len;
    const ey = cy - h * 0.2 + Math.sin(angle) * len;
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = spec.color.mid;
    ctx.lineWidth = spec.thickness;
    ctx.stroke();

    // Cross connections
    if (i > 0) {
      const prevAngle = -Math.PI / 2 - spread / 2 + (t - 1 / (spec.fanDensity - 1)) * spread;
      for (let j = 0.3; j <= 0.9; j += 0.15) {
        const x1 = cx + Math.cos(prevAngle) * len * j;
        const y1 = cy - h * 0.2 + Math.sin(prevAngle) * len * j;
        const x2 = cx + Math.cos(angle) * len * j;
        const y2 = cy - h * 0.2 + Math.sin(angle) * len * j;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = spec.color.tip + '66';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

function drawTubes(ctx, cx, cy, spec) {
  for (let i = 0; i < spec.tubeCount; i++) {
    const tx = cx + (hash(i * 13) - 0.5) * SIZE * 0.35;
    const th = spec.tubeHeight * (SIZE - PAD * 2) * (0.5 + hash(i * 29) * 0.5);
    const tw = spec.tubeWidth * SIZE * (0.7 + hash(i * 41) * 0.3);

    // Tube body
    ctx.beginPath();
    ctx.moveTo(tx - tw, cy);
    ctx.lineTo(tx - tw * 0.9, cy - th);
    ctx.arc(tx, cy - th, tw * 0.9, Math.PI, 0);
    ctx.lineTo(tx + tw, cy);
    ctx.closePath();

    const grad = ctx.createLinearGradient(tx - tw, 0, tx + tw, 0);
    grad.addColorStop(0, spec.color.base);
    grad.addColorStop(0.5, spec.color.mid);
    grad.addColorStop(1, spec.color.base);
    ctx.fillStyle = grad;
    ctx.fill();

    // Opening at top
    if (spec.flaredTop) {
      // Flared trumpet opening
      ctx.beginPath();
      ctx.ellipse(tx, cy - th, tw * 1.4, tw * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.tip;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(tx, cy - th, tw * 0.6, tw * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2a';
      ctx.fill();
    } else if (spec.featheryTop) {
      // Feathery pulsing tentacles at top
      ctx.beginPath();
      ctx.ellipse(tx, cy - th, tw * 0.9, tw * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.tip;
      ctx.fill();
      for (let f = 0; f < 8; f++) {
        const fa = (f / 8) * Math.PI * 2;
        const fx = tx + Math.cos(fa) * tw * 1.2;
        const fy = cy - th + Math.sin(fa) * tw * 0.5 - tw * 0.3;
        ctx.beginPath();
        ctx.moveTo(tx, cy - th);
        ctx.lineTo(fx, fy);
        ctx.strokeStyle = spec.color.tip;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx, fy, tw * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = spec.color.tip;
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(tx, cy - th, tw * 0.9, tw * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.tip;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(tx, cy - th, tw * 0.5, tw * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2a';
      ctx.fill();
    }
  }
}

function drawFolding(ctx, cx, cy, spec) {
  for (let i = 0; i < spec.foldCount; i++) {
    const angle = (i / spec.foldCount) * Math.PI * 0.8 + Math.PI * 0.1;
    const foldW = spec.foldSize * SIZE;
    const foldH = spec.height * (SIZE - PAD * 2) * (0.6 + hash(i * 19) * 0.4);
    const fx = cx + (hash(i * 23) - 0.5) * SIZE * 0.2;

    ctx.beginPath();
    const n = 12;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const ruffle = Math.sin(t * Math.PI * 6) * foldW * 0.15;
      const x = fx + Math.cos(angle) * (foldW * t) + ruffle;
      const y = cy - Math.sin(angle + t * 0.3) * foldH * Math.sin(t * Math.PI);
      j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let j = n; j >= 0; j--) {
      const t = j / n;
      const ruffle = Math.sin(t * Math.PI * 6 + 1) * foldW * 0.15;
      const x = fx + Math.cos(angle) * (foldW * t) + ruffle;
      const y = cy - Math.sin(angle + t * 0.3) * foldH * Math.sin(t * Math.PI) + 8;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? spec.color.leaf || spec.color.mid : spec.color.tip;
    ctx.fill();
    ctx.strokeStyle = spec.color.base;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function drawEncrusting(ctx, cx, cy, spec) {
  const r = spec.radius * SIZE;
  // Base shape
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const wobble = r * (0.8 + hash(a * 100) * 0.4);
    const x = cx + Math.cos(a) * wobble;
    const y = cy + Math.sin(a) * wobble * 0.4;
    a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, spec.color.tip);
  grad.addColorStop(0.7, spec.color.mid);
  grad.addColorStop(1, spec.color.base);
  ctx.fillStyle = grad;
  ctx.fill();

  // Bumps/texture
  for (let i = 0; i < (spec.bumps || 20); i++) {
    const a = hash(i * 17) * Math.PI * 2;
    const d = hash(i * 31) * r * 0.85;
    const bx = cx + Math.cos(a) * d;
    const by = cy + Math.sin(a) * d * 0.4;
    const br = 3 + hash(i * 43) * 5;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.tip + '88';
    ctx.fill();

    // Zoanthid-style polyp rings
    if (spec.polypRings) {
      ctx.beginPath();
      ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
      ctx.strokeStyle = spec.color.tip;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Inner dot
      ctx.beginPath();
      ctx.arc(bx, by, br * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.mid;
      ctx.fill();
    }
  }

  // Bright rim for chalice-type corals
  if (spec.brightRim) {
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const wobble = r * (0.8 + hash(a * 100) * 0.4);
      const x = cx + Math.cos(a) * wobble;
      const y = cy + Math.sin(a) * wobble * 0.4;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = spec.color.tip;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawTentacleTip(ctx, cx, cy, spec) {
  const h = spec.tentacleHeight * (SIZE - PAD * 2);
  const tw = spec.tentacleWidth * SIZE;
  const tipR = spec.tipSize * SIZE;

  // Base mound / skeleton
  const baseR = SIZE * 0.15;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, baseR, baseR * 0.25, 0, Math.PI, 0);
  ctx.fillStyle = spec.color.base;
  ctx.fill();

  // Draw branching stalks with tips using a simple recursive approach
  const stalks = [];
  function buildStalks(x, y, angle, len, depth, seed) {
    if (depth > 3 || len < 12) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    const sway = (hash(seed * 41) - 0.5) * 0.3;
    stalks.push({ x, y, ex, ey, depth });
    // At final depth, this is a tip
    if (depth >= 2) return;
    // Branch into 2-3 sub-stalks
    const nBranches = 2 + (hash(seed * 71) > 0.6 ? 1 : 0);
    for (let b = 0; b < nBranches; b++) {
      const spread = (b - (nBranches - 1) / 2) * 0.5;
      const nextAngle = angle + spread + sway;
      const nextLen = len * (0.55 + hash(seed * 100 + b * 13) * 0.2);
      buildStalks(ex, ey, nextAngle, nextLen, depth + 1, seed + b * 37 + 1);
    }
  }

  // Generate several root stalks from the base
  const rootCount = Math.min(spec.tentacleCount, 8);
  for (let i = 0; i < rootCount; i++) {
    const offsetX = (i / (rootCount - 1) - 0.5) * baseR * 1.6;
    const rootX = cx + offsetX;
    const rootAngle = -Math.PI / 2 + (hash(i * 17) - 0.5) * 0.4;
    const rootLen = h * (0.35 + hash(i * 29) * 0.15);
    buildStalks(rootX, cy - 8, rootAngle, rootLen, 0, i * 100);
  }

  // Draw all stalk segments
  for (const s of stalks) {
    const t = s.depth / 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.ex, s.ey);
    ctx.strokeStyle = spec.color.mid;
    ctx.lineWidth = Math.max(1.5, tw * (1 - t * 0.5));
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Draw tips on terminal stalks (those at max depth or with no children)
  const terminalStalks = stalks.filter(s => s.depth >= 2);
  for (const s of terminalStalks) {
    const tipX = s.ex;
    const tipY = s.ey;

    if (spec.tipShape === 'hammer') {
      // T-shaped / anchor hammer tip perpendicular to stalk
      const stalkAngle = Math.atan2(s.ey - s.y, s.ex - s.x);
      const perpAngle = stalkAngle + Math.PI / 2;
      const hammerW = tipR * 1.8;
      const hx1 = tipX + Math.cos(perpAngle) * hammerW;
      const hy1 = tipY + Math.sin(perpAngle) * hammerW;
      const hx2 = tipX - Math.cos(perpAngle) * hammerW;
      const hy2 = tipY - Math.sin(perpAngle) * hammerW;
      // Thick T-bar
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.strokeStyle = spec.color.tip;
      ctx.lineWidth = tipR * 0.9;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Anchor curves at ends
      ctx.beginPath();
      ctx.arc(hx1, hy1, tipR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.tip;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx2, hy2, tipR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.tip;
      ctx.fill();
    } else if (spec.tipShape === 'torch') {
      // Elongated teardrop blob tip
      ctx.beginPath();
      ctx.ellipse(tipX, tipY - tipR * 0.5, tipR * 0.7, tipR * 1.4, 0, 0, Math.PI * 2);
      const tg = ctx.createRadialGradient(tipX, tipY - tipR * 0.6, 0, tipX, tipY - tipR * 0.5, tipR * 1.4);
      tg.addColorStop(0, spec.color.tip);
      tg.addColorStop(0.7, spec.color.mid);
      tg.addColorStop(1, spec.color.base + '88');
      ctx.fillStyle = tg;
      ctx.fill();
    } else if (spec.tipShape === 'bubble') {
      // Cluster of bubbly spheres (frogspawn)
      for (let b = 0; b < 7; b++) {
        const ba = hash(stalks.indexOf(s) * 100 + b * 7) * Math.PI * 2;
        const bd = hash(stalks.indexOf(s) * 200 + b * 11) * tipR * 0.9;
        const bx = tipX + Math.cos(ba) * bd;
        const by = tipY + Math.sin(ba) * bd;
        const br = tipR * (0.35 + hash(stalks.indexOf(s) * 300 + b * 3) * 0.25);
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br);
        bg.addColorStop(0, 'rgba(255,255,255,0.4)');
        bg.addColorStop(0.4, spec.color.tip);
        bg.addColorStop(1, spec.color.mid);
        ctx.fillStyle = bg;
        ctx.fill();
      }
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const p = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const k = args[i].slice(2);
      if (args[i+1] && !args[i+1].startsWith('--')) { p[k] = args[i+1]; i++; } else p[k] = true;
    }
  }
  return p;
}

async function main() {
  const args = parseArgs();
  const outDir = args.out || 'output/coral/geometry/';
  fs.mkdirSync(outDir, { recursive: true });

  let idx = 1;
  const entries = [];
  for (const [name, spec] of Object.entries(CORALS)) {
    const num = String(idx).padStart(3, '0');
    const canvas = renderCoral(name, spec);
    const outPath = path.join(outDir, `coral_${num}_${name}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({ species: name, type: spec.type }, null, 2));
    console.log(`  ✓ ${outPath}`);
    entries.push({ name, canvas });
    idx++;
  }

  // Contact sheet
  const cols = 4, tile = 256;
  const rows = Math.ceil(entries.length / cols);
  const sheet = createCanvas(cols * tile, rows * (tile + 20));
  const sCtx = sheet.getContext('2d');
  sCtx.fillStyle = '#0a0a1a';
  sCtx.fillRect(0, 0, sheet.width, sheet.height);
  entries.forEach(({ name, canvas }, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    sCtx.drawImage(canvas, col * tile, row * (tile + 20), tile, tile);
    sCtx.fillStyle = '#888';
    sCtx.font = 'bold 10px monospace';
    sCtx.fillText(name, col * tile + 4, row * (tile + 20) + tile + 14);
  });
  const sheetDir = path.join(outDir, '../sheets/');
  fs.mkdirSync(sheetDir, { recursive: true });
  fs.writeFileSync(path.join(sheetDir, 'sheet_001_coral.png'), sheet.toBuffer('image/png'));
  console.log(`  ✓ ${path.join(sheetDir, 'sheet_001_coral.png')} (contact sheet)`);
}

main().catch(console.error);
