#!/usr/bin/env node
/**
 * gen_vegetation.js — Generates 32 seaweed/kelp/vegetation types using L-system and fractal approaches.
 * Each plant type has distinct branching, leaf shape, color, and sway characteristics.
 *
 * Usage: node agents/tools/gen_vegetation.js --all --out output/vegetation/geometry/
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;
const PAD = 30;

// ── Plant species ──
const PLANTS = {
  tallKelp: {
    name: 'Tall Kelp', type: 'kelp',
    color: { stem: '#2d5a1e', leaf: '#4a8a2c', tip: '#6aaa3c' },
    height: 0.85, width: 0.15, segments: 12, leafSize: 0.08, leafFreq: 0.7,
    sway: 0.06, thickness: 4, branching: 0, leafShape: 'blade',
  },
  seaGrass: {
    name: 'Sea Grass', type: 'grass',
    color: { stem: '#3a6622', leaf: '#5a9932', tip: '#7abb44' },
    height: 0.5, width: 0.25, segments: 8, leafSize: 0, leafFreq: 0,
    sway: 0.04, thickness: 2, branching: 0, bladeCount: 8, leafShape: 'blade',
  },
  featherWeed: {
    name: 'Feather Weed', type: 'fern',
    color: { stem: '#225533', leaf: '#338844', tip: '#44aa55' },
    height: 0.6, width: 0.3, segments: 10, leafSize: 0.12, leafFreq: 0.9,
    sway: 0.03, thickness: 3, branching: 0.3, leafShape: 'feather',
  },
  bubbleAlgae: {
    name: 'Bubble Algae', type: 'cluster',
    color: { stem: '#226633', leaf: '#33aa55', tip: '#55cc77' },
    height: 0.25, width: 0.25, segments: 0, leafSize: 0, leafFreq: 0,
    sway: 0, thickness: 0, branching: 0, bubbleCount: 15, bubbleSize: 0.04, leafShape: 'bubble',
  },
  redMacroalgae: {
    name: 'Red Macroalgae', type: 'fern',
    color: { stem: '#661122', leaf: '#882233', tip: '#cc4455' },
    height: 0.45, width: 0.35, segments: 8, leafSize: 0.10, leafFreq: 0.85,
    sway: 0.02, thickness: 2.5, branching: 0.5, leafShape: 'ruffled',
  },
  giantKelp: {
    name: 'Giant Kelp', type: 'kelp',
    color: { stem: '#4a6622', leaf: '#6a8833', tip: '#8aaa44' },
    height: 0.95, width: 0.12, segments: 16, leafSize: 0.10, leafFreq: 0.5,
    sway: 0.08, thickness: 6, branching: 0, leafShape: 'paddle',
  },
  caulerpa: {
    name: 'Caulerpa', type: 'creeping',
    color: { stem: '#227744', leaf: '#33aa55', tip: '#55cc66' },
    height: 0.15, width: 0.5, segments: 6, leafSize: 0.06, leafFreq: 0.8,
    sway: 0.01, thickness: 2, branching: 0.6, leafShape: 'grape',
  },
  hairAlgae: {
    name: 'Hair Algae', type: 'grass',
    color: { stem: '#889933', leaf: '#aabb44', tip: '#ccdd66' },
    height: 0.35, width: 0.30, segments: 6, leafSize: 0, leafFreq: 0,
    sway: 0.05, thickness: 1, branching: 0, bladeCount: 20, leafShape: 'hair',
  },
  corallinAlgae: {
    name: 'Coralline Algae', type: 'encrusting',
    color: { stem: '#aa3366', leaf: '#cc5588', tip: '#dd77aa' },
    height: 0.12, width: 0.45, segments: 0, leafSize: 0, leafFreq: 0,
    sway: 0, thickness: 0, branching: 0, leafShape: 'crust',
  },
  paddleWeed: {
    name: 'Paddle Weed', type: 'kelp',
    color: { stem: '#336622', leaf: '#558833', tip: '#77aa44' },
    height: 0.55, width: 0.20, segments: 6, leafSize: 0.15, leafFreq: 0.4,
    sway: 0.04, thickness: 5, branching: 0, leafShape: 'paddle',
  },
  spiralWrack: {
    name: 'Spiral Wrack', type: 'kelp',
    color: { stem: '#554411', leaf: '#776622', tip: '#998833' },
    height: 0.50, width: 0.18, segments: 10, leafSize: 0.07, leafFreq: 0.6,
    sway: 0.03, thickness: 3, branching: 0.2, leafShape: 'spiral',
  },
  seaLettuce: {
    name: 'Sea Lettuce', type: 'cluster',
    color: { stem: '#338833', leaf: '#55bb55', tip: '#77dd77' },
    height: 0.30, width: 0.35, segments: 0, leafSize: 0.18, leafFreq: 0,
    sway: 0.02, thickness: 0, branching: 0, leafCount: 5, leafShape: 'lettuce',
  },
  sagittaria: {
    name: 'Sagittaria', type: 'grass',
    color: { stem: '#3a7733', leaf: '#55aa44', tip: '#77cc55' },
    height: 0.65, width: 0.20, segments: 1, leafSize: 0.12, leafFreq: 0,
    sway: 0.03, thickness: 2, branching: 0, bladeCount: 5, leafShape: 'arrow',
  },
  hornwort: {
    name: 'Hornwort', type: 'fern',
    color: { stem: '#226622', leaf: '#338833', tip: '#44aa44' },
    height: 0.60, width: 0.25, segments: 14, leafSize: 0.06, leafFreq: 0.95,
    sway: 0.02, thickness: 2, branching: 0.4, leafShape: 'needleWhorl',
  },
  amazonSword: {
    name: 'Amazon Sword', type: 'rosette',
    color: { stem: '#2a5520', leaf: '#3d7a2d', tip: '#509a3a' },
    height: 0.55, width: 0.40, segments: 1, leafSize: 0.30, leafFreq: 0,
    sway: 0.03, thickness: 3, branching: 0, bladeCount: 10, leafShape: 'sword',
  },
  waterWisteria: {
    name: 'Water Wisteria', type: 'fern',
    color: { stem: '#337733', leaf: '#44aa44', tip: '#66cc66' },
    height: 0.50, width: 0.35, segments: 8, leafSize: 0.10, leafFreq: 0.8,
    sway: 0.03, thickness: 2.5, branching: 0.6, leafShape: 'deeplyLobed',
  },

  // ── 16 NEW plant types ──

  javaMoss: {
    name: 'Java Moss', type: 'moss',
    color: { stem: '#1a4a1a', leaf: '#2d6b2d', tip: '#3d8a3d' },
    height: 0.40, width: 0.55, segments: 0, leafSize: 0, leafFreq: 0,
    sway: 0, thickness: 0, branching: 0, mossCount: 400, leafShape: 'moss',
  },
  dwarfHairgrass: {
    name: 'Dwarf Hairgrass', type: 'grass',
    color: { stem: '#3a7a2a', leaf: '#55aa3a', tip: '#77cc55' },
    height: 0.12, width: 0.65, segments: 4, leafSize: 0, leafFreq: 0,
    sway: 0.02, thickness: 0.8, branching: 0, bladeCount: 55, leafShape: 'hair',
  },
  anubias: {
    name: 'Anubias', type: 'rosette',
    color: { stem: '#1a3320', leaf: '#2a4a30', tip: '#3a5a3a' },
    height: 0.40, width: 0.45, segments: 1, leafSize: 0.28, leafFreq: 0,
    sway: 0.02, thickness: 4, branching: 0, bladeCount: 6, leafShape: 'sword',
  },
  cryptWendtii: {
    name: 'Crypt Wendtii', type: 'rosette',
    color: { stem: '#665533', leaf: '#886644', tip: '#aa8855' },
    height: 0.40, width: 0.38, segments: 1, leafSize: 0.18, leafFreq: 0,
    sway: 0.03, thickness: 2.5, branching: 0, bladeCount: 8, leafShape: 'sword',
  },
  vallisneria: {
    name: 'Vallisneria', type: 'grass',
    color: { stem: '#2a6622', leaf: '#44882e', tip: '#66aa44' },
    height: 0.90, width: 0.18, segments: 10, leafSize: 0, leafFreq: 0,
    sway: 0.07, thickness: 1.5, branching: 0, bladeCount: 7, leafShape: 'blade',
  },
  rotala: {
    name: 'Rotala', type: 'fern',
    color: { stem: '#448833', leaf: '#55aa44', tip: '#cc4466' },
    height: 0.50, width: 0.30, segments: 12, leafSize: 0.05, leafFreq: 0.85,
    sway: 0.03, thickness: 2, branching: 0.5, leafShape: 'roundPaired',
  },
  ludwigia: {
    name: 'Ludwigia', type: 'fern',
    color: { stem: '#772233', leaf: '#aa3344', tip: '#cc4455' },
    height: 0.55, width: 0.28, segments: 10, leafSize: 0.10, leafFreq: 0.80,
    sway: 0.02, thickness: 2.5, branching: 0.4, leafShape: 'broadOpposite',
  },
  monteCarlo: {
    name: 'Monte Carlo', type: 'creeping',
    color: { stem: '#2a7733', leaf: '#44aa55', tip: '#66cc77' },
    height: 0.08, width: 0.70, segments: 4, leafSize: 0.025, leafFreq: 0.95,
    sway: 0, thickness: 1, branching: 0.85, leafShape: 'grape',
  },
  bucephalandra: {
    name: 'Bucephalandra', type: 'rosette',
    color: { stem: '#334455', leaf: '#445566', tip: '#556677' },
    height: 0.25, width: 0.30, segments: 1, leafSize: 0.16, leafFreq: 0,
    sway: 0.01, thickness: 2, branching: 0, bladeCount: 7, leafShape: 'sword',
  },
  floatingDuckweed: {
    name: 'Floating Duckweed', type: 'cluster',
    color: { stem: '#337722', leaf: '#55aa44', tip: '#77cc66' },
    height: 0.95, width: 0.70, segments: 0, leafSize: 0, leafFreq: 0,
    sway: 0, thickness: 0, branching: 0, bubbleCount: 30, bubbleSize: 0.018, leafShape: 'bubble',
  },
  marimo: {
    name: 'Marimo', type: 'cluster',
    color: { stem: '#1e5522', leaf: '#2d7a33', tip: '#44aa44' },
    height: 0.22, width: 0.22, segments: 0, leafSize: 0, leafFreq: 0,
    sway: 0, thickness: 0, branching: 0, bubbleCount: 1, bubbleSize: 0.12, leafShape: 'bubble',
  },
  elodea: {
    name: 'Elodea', type: 'fern',
    color: { stem: '#33aa33', leaf: '#55cc55', tip: '#77ee77' },
    height: 0.65, width: 0.20, segments: 14, leafSize: 0.04, leafFreq: 0.95,
    sway: 0.04, thickness: 1.5, branching: 0.2, leafShape: 'elongatedPaired',
  },
  redTigerLotus: {
    name: 'Red Tiger Lotus', type: 'rosette',
    color: { stem: '#881122', leaf: '#bb2244', tip: '#dd4466' },
    height: 0.50, width: 0.50, segments: 1, leafSize: 0.30, leafFreq: 0,
    sway: 0.03, thickness: 3, branching: 0, bladeCount: 6, leafShape: 'sword',
  },
  microsorum: {
    name: 'Microsorum (Java Fern)', type: 'fern',
    color: { stem: '#1e4422', leaf: '#2d6633', tip: '#3d8844' },
    height: 0.55, width: 0.40, segments: 8, leafSize: 0.14, leafFreq: 0.7,
    sway: 0.03, thickness: 2, branching: 0.3, leafShape: 'blade',
  },
  glossostigma: {
    name: 'Glossostigma', type: 'creeping',
    color: { stem: '#338833', leaf: '#55bb55', tip: '#77dd77' },
    height: 0.06, width: 0.70, segments: 4, leafSize: 0.02, leafFreq: 0.95,
    sway: 0, thickness: 0.8, branching: 0.9, leafShape: 'grape',
  },
  limnophila: {
    name: 'Limnophila', type: 'fern',
    color: { stem: '#337744', leaf: '#44aa55', tip: '#66cc77' },
    height: 0.60, width: 0.35, segments: 12, leafSize: 0.07, leafFreq: 0.95,
    sway: 0.03, thickness: 2, branching: 0.5, leafShape: 'feather',
  },
};

function hash(x) { return ((Math.sin(x * 127.1) * 43758.5453) % 1 + 1) % 1; }

function renderPlant(name, spec) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const baseX = SIZE / 2;
  const baseY = SIZE - PAD;
  const maxH = (SIZE - PAD * 2) * spec.height;
  const maxW = (SIZE - PAD * 2) * spec.width;

  // Draw based on plant type
  if (spec.type === 'grass' || spec.type === 'rosette') {
    const count = spec.bladeCount || 8;
    for (let b = 0; b < count; b++) {
      const angleSpread = (b / count - 0.5) * 2 * (maxW / maxH);
      const h = maxH * (0.7 + hash(b * 17) * 0.3);
      const sway = spec.sway * Math.sin(b * 2.3) * maxH;
      drawBlade(ctx, baseX + angleSpread * maxW * 0.4, baseY, h, spec, b, sway);
    }
  } else if (spec.type === 'kelp') {
    drawStem(ctx, baseX, baseY, maxH, spec, 0);
  } else if (spec.type === 'fern') {
    drawFern(ctx, baseX, baseY, maxH, spec, 0, 0);
  } else if (spec.type === 'cluster') {
    if (spec.bubbleCount) {
      for (let i = 0; i < spec.bubbleCount; i++) {
        const bx = baseX + (hash(i * 13) - 0.5) * maxW * 2;
        const by = baseY - hash(i * 7 + 3) * maxH;
        const r = spec.bubbleSize * SIZE * (0.5 + hash(i * 11) * 0.5);
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r);
        grad.addColorStop(0, spec.color.tip);
        grad.addColorStop(1, spec.color.stem);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = spec.color.stem;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Highlight
        ctx.beginPath();
        ctx.arc(bx - r * 0.25, by - r * 0.25, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();
      }
    }
    if (spec.leafCount) {
      for (let i = 0; i < spec.leafCount; i++) {
        const angle = (i / spec.leafCount) * Math.PI - Math.PI * 0.1;
        const lx = baseX + Math.cos(angle) * maxW * 0.3;
        const ly = baseY - Math.sin(angle) * maxH * 0.5 - maxH * 0.2;
        drawLettuceLeaf(ctx, lx, ly, spec.leafSize * SIZE, angle, spec);
      }
    }
  } else if (spec.type === 'moss') {
    // Dense fuzzy clump of tiny irregular shapes and fine branching filaments
    const count = spec.mossCount || 200;
    for (let i = 0; i < count; i++) {
      const cx = baseX + (hash(i * 13) - 0.5) * maxW * 2;
      const cy = baseY - hash(i * 7 + 3) * maxH;
      const size = SIZE * 0.012 * (0.4 + hash(i * 11) * 0.8);
      // Irregular blob shape
      ctx.beginPath();
      const verts = 5 + Math.floor(hash(i * 31) * 4);
      for (let v = 0; v <= verts; v++) {
        const angle = (v / verts) * Math.PI * 2;
        const r = size * (0.5 + hash(i * 53 + v * 7) * 0.8);
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const t = hash(i * 17);
      ctx.fillStyle = t < 0.33 ? spec.color.stem : t < 0.66 ? spec.color.leaf : spec.color.tip;
      ctx.globalAlpha = 0.5 + hash(i * 41) * 0.5;
      ctx.fill();
      // Fine branching filaments from some blobs
      if (hash(i * 67) > 0.6) {
        const fLen = size * (2 + hash(i * 71) * 3);
        const fAngle = hash(i * 79) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(fAngle) * fLen, cy + Math.sin(fAngle) * fLen);
        ctx.strokeStyle = spec.color.leaf;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;
  } else if (spec.type === 'encrusting') {
    // Flat encrusting patches
    for (let i = 0; i < 12; i++) {
      const px = baseX + (hash(i * 19) - 0.5) * maxW * 2;
      const py = baseY - hash(i * 23) * maxH * 0.3;
      const rw = (0.3 + hash(i * 31) * 0.7) * maxW * 0.5;
      const rh = rw * 0.3;
      ctx.beginPath();
      ctx.ellipse(px, py, rw, rh, hash(i * 37) * 0.5, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, rw);
      grad.addColorStop(0, spec.color.tip);
      grad.addColorStop(0.7, spec.color.leaf);
      grad.addColorStop(1, spec.color.stem);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  } else if (spec.type === 'creeping') {
    // Horizontal runners with grape-like leaves
    const runnerCount = spec.width >= 0.65 ? 5 : 3;
    for (let r = 0; r < runnerCount; r++) {
      const ry = baseY - r * 15 - 5;
      const startX = baseX - maxW;
      ctx.strokeStyle = spec.color.stem;
      ctx.lineWidth = spec.thickness;
      ctx.beginPath();
      ctx.moveTo(startX, ry);
      for (let x = 0; x < maxW * 2; x += 8) {
        ctx.lineTo(startX + x, ry + Math.sin(x * 0.05) * 4);
      }
      ctx.stroke();
      // Leaves along runner
      for (let x = 0; x < maxW * 2; x += 20 + hash(r * 100 + x) * 15) {
        const lx = startX + x;
        const ly = ry - 5 - hash(r * 50 + x) * 20;
        const lr = spec.leafSize * SIZE * (0.5 + hash(r * 77 + x) * 0.5);
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fillStyle = spec.color.leaf;
        ctx.fill();
        ctx.strokeStyle = spec.color.stem;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // Label
  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(name, 10, SIZE - 10);

  return canvas;
}

function drawBlade(ctx, x, y, h, spec, seed, swayOffset) {
  const pts = [];
  const segs = Math.max(8, Math.floor(h / 10));
  const bladeW = spec.leafShape === 'hair' ? 1.5 : (spec.leafShape === 'arrow' ? 6 : (spec.leafShape === 'sword' ? 14 : 3));

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const sway = swayOffset * t * t + spec.sway * Math.sin(t * 3 + seed) * h * t;
    const width = bladeW * (spec.leafShape === 'sword' ? Math.sin(t * Math.PI) * 1.5 + 0.5 :
                            spec.leafShape === 'arrow' ? (1 - t) * 1.5 + 0.3 :
                            (1 - t * 0.8));
    pts.push({ x: x + sway, y: y - t * h, w: width });
  }

  // Draw blade
  ctx.beginPath();
  ctx.moveTo(pts[0].x - pts[0].w, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x - p.w, p.y);
  for (const p of [...pts].reverse()) ctx.lineTo(p.x + p.w, p.y);
  ctx.closePath();

  const grad = ctx.createLinearGradient(x, y, x, y - h);
  grad.addColorStop(0, spec.color.stem);
  grad.addColorStop(0.5, spec.color.leaf);
  grad.addColorStop(1, spec.color.tip);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = spec.color.stem;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Central vein
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawStem(ctx, x, y, h, spec, seed) {
  const segs = spec.segments;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const sway = spec.sway * Math.sin(t * 4 + seed * 2) * h * t;
    pts.push({ x: x + sway, y: y - t * h });
  }

  // Stem
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = spec.color.stem;
  ctx.lineWidth = spec.thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Leaves
  for (let i = 1; i < pts.length; i++) {
    if (hash(seed * 100 + i) > spec.leafFreq) continue;
    const side = i % 2 === 0 ? 1 : -1;
    const lSize = spec.leafSize * SIZE * (0.5 + hash(i * 13) * 0.5);
    drawLeaf(ctx, pts[i].x, pts[i].y, lSize, side, spec);
  }
}

function drawLeaf(ctx, x, y, size, side, spec) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);

  if (spec.leafShape === 'blade' || spec.leafShape === 'paddle') {
    const w = spec.leafShape === 'paddle' ? size * 0.6 : size * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(size * 0.5, -w, size, 0);
    ctx.quadraticCurveTo(size * 0.5, w, 0, 0);
    ctx.fillStyle = spec.color.leaf;
    ctx.fill();
    ctx.strokeStyle = spec.color.stem;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else if (spec.leafShape === 'spiral') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let t = 0; t <= 1; t += 0.05) {
      const angle = t * Math.PI * 1.5;
      ctx.lineTo(size * t * Math.cos(angle), size * t * Math.sin(angle) * 0.3);
    }
    ctx.strokeStyle = spec.color.leaf;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawFern(ctx, x, y, h, spec, depth, seed) {
  if (depth > 3) return;
  const segs = spec.segments;
  const pts = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const sway = spec.sway * Math.sin(t * 3 + seed) * h * t;
    pts.push({ x: x + sway, y: y - t * h });
  }

  // Stem
  const lw = Math.max(0.5, spec.thickness * (1 - depth * 0.3));
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = depth === 0 ? spec.color.stem : spec.color.leaf;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Fronds/leaves
  for (let i = 2; i < pts.length; i++) {
    if (hash(seed * 100 + i + depth * 50) > spec.leafFreq) continue;
    const side = i % 2 === 0 ? 1 : -1;

    if (spec.branching > 0 && depth < 2 && hash(seed * 200 + i) < spec.branching) {
      // Sub-branch
      const subH = h * 0.3 * (1 - i / pts.length);
      drawFern(ctx, pts[i].x, pts[i].y, subH, spec, depth + 1, seed + i);
    } else {
      const lSize = spec.leafSize * SIZE * (0.3 + hash(i * 7 + seed) * 0.7);
      if (spec.leafShape === 'feather') {
        drawFeatherLeaf(ctx, pts[i].x, pts[i].y, lSize, side, spec);
      } else if (spec.leafShape === 'needle') {
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i].x + side * lSize, pts[i].y - lSize * 0.3);
        ctx.strokeStyle = spec.color.leaf;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      } else if (spec.leafShape === 'ruffled') {
        drawRuffledLeaf(ctx, pts[i].x, pts[i].y, lSize, side, spec);
      } else if (spec.leafShape === 'lace') {
        drawLaceLeaf(ctx, pts[i].x, pts[i].y, lSize, side, spec);
      } else if (spec.leafShape === 'roundPaired') {
        // Tiny round paired leaves on both sides of stem (rotala)
        drawRoundPairedLeaf(ctx, pts[i].x, pts[i].y, lSize, 1, spec, i);
        drawRoundPairedLeaf(ctx, pts[i].x, pts[i].y, lSize, -1, spec, i);
      } else if (spec.leafShape === 'broadOpposite') {
        // Broader opposite leaves (ludwigia) - both sides
        drawBroadOppositeLeaf(ctx, pts[i].x, pts[i].y, lSize, 1, spec, i);
        drawBroadOppositeLeaf(ctx, pts[i].x, pts[i].y, lSize, -1, spec, i);
      } else if (spec.leafShape === 'needleWhorl') {
        // Dense needle-like whorls radiating from stem (hornwort)
        drawNeedleWhorl(ctx, pts[i].x, pts[i].y, lSize, spec, i);
      } else if (spec.leafShape === 'elongatedPaired') {
        // Small elongated paired leaves (elodea)
        drawElongatedPairedLeaf(ctx, pts[i].x, pts[i].y, lSize, 1, spec);
        drawElongatedPairedLeaf(ctx, pts[i].x, pts[i].y, lSize, -1, spec);
      } else if (spec.leafShape === 'deeplyLobed') {
        // Deeply lobed/lacey leaves (water wisteria)
        drawDeeplyLobedLeaf(ctx, pts[i].x, pts[i].y, lSize, side, spec);
      } else {
        drawLeaf(ctx, pts[i].x, pts[i].y, lSize, side, spec);
      }
    }
  }
}

function drawFeatherLeaf(ctx, x, y, size, side, spec) {
  ctx.save();
  ctx.translate(x, y);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const lx = side * size * t;
    const ly = -size * 0.15 * (1 - t);
    const sub = size * 0.3 * (1 - t);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + side * sub * 0.3, ly - sub);
    ctx.strokeStyle = spec.color.leaf;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRuffledLeaf(ctx, x, y, size, side, spec) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = size * (0.8 + Math.sin(t * Math.PI * 4) * 0.2);
    const angle = side > 0 ? -Math.PI * 0.4 + t * Math.PI * 0.8 : Math.PI * 0.6 + t * Math.PI * 0.8;
    ctx.lineTo(x + Math.cos(angle) * r * 0.5, y + Math.sin(angle) * r * 0.3);
  }
  ctx.fillStyle = spec.color.leaf + 'aa';
  ctx.fill();
}

function drawLaceLeaf(ctx, x, y, size, side, spec) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  const lx = x + side * size;
  const ly = y - size * 0.2;
  ctx.bezierCurveTo(x + side * size * 0.3, y - size * 0.4, lx - side * size * 0.1, ly - size * 0.2, lx, ly);
  ctx.bezierCurveTo(lx - side * size * 0.1, ly + size * 0.2, x + side * size * 0.3, y + size * 0.2, x, y);
  ctx.fillStyle = spec.color.leaf + 'cc';
  ctx.fill();
  ctx.strokeStyle = spec.color.stem;
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

function drawRoundPairedLeaf(ctx, x, y, size, side, spec, idx) {
  // Tiny round leaf
  const lx = x + side * size * 0.8;
  const ly = y;
  const r = size * 0.45;
  ctx.beginPath();
  ctx.arc(lx, ly, r, 0, Math.PI * 2);
  // Color transitions to tip color (pink/red) toward top of plant
  const t = idx / 12;
  const col = t > 0.6 ? spec.color.tip : spec.color.leaf;
  ctx.fillStyle = col + 'dd';
  ctx.fill();
  ctx.strokeStyle = spec.color.stem;
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

function drawBroadOppositeLeaf(ctx, x, y, size, side, spec, idx) {
  // Broad ovate leaf on a short petiole
  ctx.save();
  ctx.translate(x, y);
  const angle = side * 0.4;
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(side * size * 0.5, -size * 0.5, side * size, 0);
  ctx.quadraticCurveTo(side * size * 0.5, size * 0.4, 0, 0);
  ctx.closePath();
  ctx.fillStyle = spec.color.leaf + 'dd';
  ctx.fill();
  ctx.strokeStyle = spec.color.stem;
  ctx.lineWidth = 0.4;
  ctx.stroke();
  // Central vein
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(side * size * 0.9, 0);
  ctx.strokeStyle = spec.color.stem + '88';
  ctx.lineWidth = 0.3;
  ctx.stroke();
  ctx.restore();
}

function drawNeedleWhorl(ctx, x, y, size, spec, idx) {
  // Radial whorl of needles around the stem
  const count = 8 + Math.floor(hash(idx * 23) * 4);
  for (let n = 0; n < count; n++) {
    const angle = (n / count) * Math.PI * 2 + hash(idx * 37) * 0.5;
    const len = size * (0.8 + hash(idx * 100 + n * 13) * 0.4);
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len * 0.4; // compressed vertically for perspective
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = spec.color.leaf;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Tiny tip
    ctx.beginPath();
    ctx.arc(ex, ey, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.tip;
    ctx.fill();
  }
}

function drawElongatedPairedLeaf(ctx, x, y, size, side, spec) {
  // Small elongated oval leaf
  ctx.save();
  ctx.translate(x + side * size * 0.2, y);
  ctx.rotate(side * 0.3);
  ctx.beginPath();
  ctx.ellipse(side * size * 0.4, 0, size * 0.6, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = spec.color.leaf + 'dd';
  ctx.fill();
  ctx.strokeStyle = spec.color.stem;
  ctx.lineWidth = 0.3;
  ctx.stroke();
  ctx.restore();
}

function drawDeeplyLobedLeaf(ctx, x, y, size, side, spec) {
  // Deeply lobed leaf with finger-like projections (wisteria)
  ctx.save();
  ctx.translate(x, y);
  const lobes = 5;
  for (let l = 0; l < lobes; l++) {
    const baseAngle = side > 0 ? -0.6 : Math.PI + 0.6;
    const spread = 0.8;
    const angle = baseAngle + (l / (lobes - 1) - 0.5) * spread;
    const lobeLen = size * (0.6 + hash(l * 19) * 0.5);
    const lobeW = size * 0.12;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const ex = Math.cos(angle) * lobeLen;
    const ey = Math.sin(angle) * lobeLen;
    ctx.bezierCurveTo(
      Math.cos(angle) * lobeLen * 0.3 + Math.sin(angle) * lobeW,
      Math.sin(angle) * lobeLen * 0.3 - Math.cos(angle) * lobeW,
      ex + Math.sin(angle) * lobeW * 0.5,
      ey - Math.cos(angle) * lobeW * 0.5,
      ex, ey
    );
    ctx.bezierCurveTo(
      ex - Math.sin(angle) * lobeW * 0.5,
      ey + Math.cos(angle) * lobeW * 0.5,
      Math.cos(angle) * lobeLen * 0.3 - Math.sin(angle) * lobeW,
      Math.sin(angle) * lobeLen * 0.3 + Math.cos(angle) * lobeW,
      0, 0
    );
    ctx.fillStyle = spec.color.leaf + 'cc';
    ctx.fill();
    ctx.strokeStyle = spec.color.stem;
    ctx.lineWidth = 0.3;
    ctx.stroke();
  }
  ctx.restore();
}

function drawLettuceLeaf(ctx, x, y, size, angle, spec) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.beginPath();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 2;
    const r = size * (0.7 + Math.sin(a * 3) * 0.15 + Math.sin(a * 7) * 0.08);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = spec.color.leaf + 'cc';
  ctx.fill();
  ctx.strokeStyle = spec.color.stem;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

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
  const outDir = args.out || 'output/vegetation/geometry/';
  fs.mkdirSync(outDir, { recursive: true });

  let idx = 1;
  const entries = [];
  for (const [name, spec] of Object.entries(PLANTS)) {
    const num = String(idx).padStart(3, '0');
    const canvas = renderPlant(name, spec);
    const outPath = path.join(outDir, `veg_${num}_${name}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({ species: name, type: spec.type, params: spec }, null, 2));
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
  const sheetPath = path.join(sheetDir, 'sheet_001_vegetation.png');
  fs.writeFileSync(sheetPath, sheet.toBuffer('image/png'));
  console.log(`  ✓ ${sheetPath} (contact sheet)`);
}

main().catch(console.error);
