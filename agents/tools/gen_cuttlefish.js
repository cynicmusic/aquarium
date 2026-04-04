#!/usr/bin/env node
/**
 * gen_cuttlefish.js — Generates 8 cuttlefish with chromatophore patterns.
 * Each cuttlefish has a unique body shape, chromatophore pattern, and color mode.
 * Renders static frames showing different chromatophore states.
 *
 * Usage: node agents/tools/gen_cuttlefish.js --all --out output/cuttlefish/geometry/
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;
const PAD = 50;

function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (h % 1 + 1) % 1;
}

// ── Worley noise for chromatophore cells ──
function worley(x, y, scale, time) {
  const px = x * scale, py = y * scale;
  const ix = Math.floor(px), iy = Math.floor(py);
  let minDist = 999;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx + hash2(ix + dx, iy + dy) * 0.8;
      const cy = iy + dy + hash2(iy + dy + 50, ix + dx + 50) * 0.8;
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      if (dist < minDist) minDist = dist;
    }
  }

  // Chromatophore expansion: modulated by time + position for wave effect
  const wave = Math.sin(x * 4 + time * 2) * 0.3 + Math.sin(y * 3 + time * 1.5) * 0.2;
  const expansion = 0.4 + wave;
  return minDist < expansion ? 1.0 - minDist / expansion : 0.0;
}

// ── 3-layer chromatophore system ──
function chromatophoreColor(x, y, spec, time) {
  // Special mode: bold horizontal stripes for striped pyjama cuttlefish
  if (spec.mode === 'striped') {
    const stripe = Math.sin(y * 20) > 0 ? 1.0 : 0.0;
    let r = spec.baseColor[0], g = spec.baseColor[1], b = spec.baseColor[2];
    // Dark bands: near-black brown; light bands: base color with slight warmth
    const darkening = stripe * spec.brownIntensity;
    r *= 1 - darkening * 0.85;
    g *= 1 - darkening * 0.9;
    b *= 1 - darkening * 0.8;
    // Slight iridescence on light bands
    if (stripe < 0.5) {
      const iridescence = Math.sin(x * 20 + y * 15) * 0.5 + 0.5;
      r += iridescence * spec.iridColor[0] * 0.1;
      g += iridescence * spec.iridColor[1] * 0.1;
      b += iridescence * spec.iridColor[2] * 0.1;
    }
    return [Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b))];
  }

  // Layer 1: Yellow chromatophores (largest, most superficial)
  const yellow = worley(x, y, spec.cellScale * 0.8, time);
  // Layer 2: Red/orange chromatophores (medium)
  const red = worley(x + 0.3, y + 0.7, spec.cellScale * 1.0, time * 1.3 + 1);
  // Layer 3: Brown/black chromatophores (deepest, smallest)
  const brown = worley(x + 0.6, y + 0.2, spec.cellScale * 1.4, time * 0.8 + 2);

  // Iridophore layer (structural color, always present underneath)
  const iridescence = Math.sin(x * 20 + y * 15) * 0.5 + 0.5;

  // Blend layers (deeper layers occlude lighter ones when expanded)
  let r = spec.baseColor[0], g = spec.baseColor[1], b = spec.baseColor[2];

  // Iridophore base shimmer
  r += iridescence * spec.iridColor[0] * 0.15;
  g += iridescence * spec.iridColor[1] * 0.15;
  b += iridescence * spec.iridColor[2] * 0.15;

  // Yellow layer
  r += yellow * spec.yellowColor[0] * spec.yellowIntensity;
  g += yellow * spec.yellowColor[1] * spec.yellowIntensity;
  b += yellow * spec.yellowColor[2] * spec.yellowIntensity;

  // Red layer
  r += red * spec.redColor[0] * spec.redIntensity;
  g += red * spec.redColor[1] * spec.redIntensity;
  b += red * spec.redColor[2] * spec.redIntensity;

  // Brown/black layer (darkens)
  const darkening = brown * spec.brownIntensity;
  r *= 1 - darkening * 0.7;
  g *= 1 - darkening * 0.8;
  b *= 1 - darkening * 0.6;

  return [Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b))];
}

const CUTTLEFISH = {
  commonCuttlefish: {
    name: 'Common Cuttlefish',
    bodyLen: 0.55, bodyWidth: 0.22, tentacleLen: 0.25,
    finWidth: 0.06, finUndulation: 3,
    cellScale: 12, mode: 'calm',
    baseColor: [180, 160, 140], iridColor: [0, 50, 80],
    yellowColor: [80, 60, 0], yellowIntensity: 0.6,
    redColor: [100, 30, 0], redIntensity: 0.4,
    brownIntensity: 0.5,
    mantleColor: '#aa9977',
  },
  flamboyant: {
    name: 'Flamboyant Cuttlefish',
    bodyLen: 0.35, bodyWidth: 0.18, tentacleLen: 0.15,
    finWidth: 0.04, finUndulation: 5,
    cellScale: 18, mode: 'pulsing',
    baseColor: [180, 60, 100], iridColor: [100, 0, 60],
    yellowColor: [150, 120, 0], yellowIntensity: 1.0,
    redColor: [180, 30, 50], redIntensity: 0.9,
    brownIntensity: 0.3,
    mantleColor: '#bb3366',
  },
  pharaoh: {
    name: 'Pharaoh Cuttlefish',
    bodyLen: 0.60, bodyWidth: 0.24, tentacleLen: 0.30,
    finWidth: 0.07, finUndulation: 2,
    cellScale: 6, mode: 'zebra',
    baseColor: [160, 140, 120], iridColor: [40, 60, 80],
    yellowColor: [60, 50, 10], yellowIntensity: 0.4,
    redColor: [80, 20, 0], redIntensity: 0.3,
    brownIntensity: 0.9,
    mantleColor: '#887766',
  },
  broadclub: {
    name: 'Broadclub Cuttlefish',
    bodyLen: 0.65, bodyWidth: 0.28, tentacleLen: 0.28,
    finWidth: 0.08, finUndulation: 2,
    cellScale: 8, mode: 'passing_cloud',
    baseColor: [200, 180, 140], iridColor: [20, 80, 60],
    yellowColor: [70, 55, 0], yellowIntensity: 0.9,
    redColor: [90, 25, 0], redIntensity: 0.5,
    brownIntensity: 0.6,
    mantleColor: '#ccbb88',
  },
  giant: {
    name: 'Giant Australian Cuttlefish',
    bodyLen: 0.75, bodyWidth: 0.30, tentacleLen: 0.32,
    finWidth: 0.09, finUndulation: 2,
    cellScale: 7, mode: 'display',
    baseColor: [160, 90, 60], iridColor: [60, 80, 100],
    yellowColor: [100, 80, 0], yellowIntensity: 0.7,
    redColor: [120, 40, 20], redIntensity: 0.8,
    brownIntensity: 0.4,
    mantleColor: '#bb6644',
  },
  striped: {
    name: 'Striped Pyjama Cuttlefish',
    bodyLen: 0.30, bodyWidth: 0.14, tentacleLen: 0.12,
    finWidth: 0.03, finUndulation: 4,
    cellScale: 20, mode: 'striped',
    baseColor: [200, 180, 160], iridColor: [0, 30, 60],
    yellowColor: [40, 30, 0], yellowIntensity: 0.3,
    redColor: [60, 10, 0], redIntensity: 0.2,
    brownIntensity: 0.8,
    mantleColor: '#ccbbaa',
  },
  elegant: {
    name: 'Elegant Cuttlefish',
    bodyLen: 0.40, bodyWidth: 0.16, tentacleLen: 0.20,
    finWidth: 0.05, finUndulation: 4,
    cellScale: 15, mode: 'camouflage',
    baseColor: [140, 160, 170], iridColor: [0, 100, 120],
    yellowColor: [50, 40, 0], yellowIntensity: 0.4,
    redColor: [70, 20, 0], redIntensity: 0.3,
    brownIntensity: 0.5,
    mantleColor: '#8899aa',
  },
  dwarf: {
    name: 'Dwarf Cuttlefish',
    bodyLen: 0.22, bodyWidth: 0.12, tentacleLen: 0.10,
    finWidth: 0.03, finUndulation: 6,
    cellScale: 22, mode: 'rapid',
    baseColor: [100, 120, 80], iridColor: [40, 60, 80],
    yellowColor: [90, 70, 0], yellowIntensity: 0.5,
    redColor: [110, 30, 10], redIntensity: 0.5,
    brownIntensity: 0.7,
    mantleColor: '#667755',
  },
};

function renderCuttlefish(name, spec, timeOffset = 0) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const cx = SIZE * 0.45, cy = SIZE / 2;
  const bLen = spec.bodyLen * SIZE;
  const bW = spec.bodyWidth * SIZE;

  // ── Mantle body outline ──
  const mantlePoints = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const angle = t * Math.PI * 2;
    // Egg/oval shape wider at back
    const rx = bLen * 0.5 * (1 + Math.sin(angle) * 0.1);
    const ry = bW * 0.5 * (1 + Math.cos(angle) * 0.15);
    mantlePoints.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry
    });
  }

  // ── Undulating fin (behind body) ──
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const angle = t * Math.PI * 2;
    const finExt = spec.finWidth * SIZE * Math.abs(Math.sin(angle * spec.finUndulation + timeOffset * 3));
    const rx = bLen * 0.5 + finExt;
    const ry = bW * 0.5 + finExt * 0.3;
    const px = cx + Math.cos(angle) * rx;
    const py = cy + Math.sin(angle) * ry;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = spec.mantleColor + '66';
  ctx.fill();

  // ── Chromatophore-textured mantle ──
  // Render chromatophore pattern into a temporary canvas, then clip to body
  const texW = Math.ceil(bLen * 1.2);
  const texH = Math.ceil(bW * 1.2);
  const texCanvas = createCanvas(texW, texH);
  const texCtx = texCanvas.getContext('2d');
  const texData = texCtx.createImageData(texW, texH);

  for (let py = 0; py < texH; py++) {
    for (let px = 0; px < texW; px++) {
      const idx = (py * texW + px) * 4;
      const nx = px / texW;
      const ny = py / texH;
      const [r, g, b] = chromatophoreColor(nx, ny, spec, timeOffset);
      texData.data[idx] = r;
      texData.data[idx + 1] = g;
      texData.data[idx + 2] = b;
      texData.data[idx + 3] = 255;
    }
  }
  texCtx.putImageData(texData, 0, 0);

  // Clip to body shape and draw texture
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = mantlePoints[i];
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(texCanvas, cx - texW / 2, cy - texH / 2, texW, texH);
  ctx.restore();

  // Body outline
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = mantlePoints[i];
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(100,80,60,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Tentacles (8 short + 2 long) ──
  const headX = cx - bLen * 0.5;
  for (let t = 0; t < 10; t++) {
    const spread = (t / 9 - 0.5) * bW * 1.5;
    const isLong = t === 3 || t === 6;
    const tLen = (isLong ? spec.tentacleLen * 1.8 : spec.tentacleLen) * SIZE;

    ctx.beginPath();
    ctx.moveTo(headX, cy + spread * 0.8);
    const ctrlX = headX - tLen * 0.5;
    const ctrlY = cy + spread + Math.sin(t * 1.5 + timeOffset) * 8;
    const endX = headX - tLen;
    const endY = cy + spread * 0.6;
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.strokeStyle = spec.mantleColor;
    ctx.lineWidth = isLong ? 2.5 : 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Sucker dots on tentacles
    if (isLong) {
      for (let s = 0.5; s < 0.95; s += 0.08) {
        const sx = headX + (endX - headX) * s + (ctrlX - headX) * 2 * s * (1 - s);
        const sy = cy + spread * 0.8 + (endY - cy - spread * 0.8) * s + (ctrlY - cy - spread * 0.8) * 2 * s * (1 - s);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,180,160,0.5)';
        ctx.fill();
      }
    }
  }

  // ── Eyes ──
  for (const side of [-1, 1]) {
    const eyeX = cx - bLen * 0.35;
    const eyeY = cy + side * bW * 0.35;
    const eyeR = bW * 0.12;

    // Eye base — pure black
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Subtle dark iris ring
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.6)';
    ctx.lineWidth = eyeR * 0.15;
    ctx.stroke();

    // Horizontal slit pupil (characteristic of cuttlefish)
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, eyeR * 0.6, eyeR * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111111';
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 25, 20, 0.8)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Outer eye ring — dark brown/black
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(30, 25, 20, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Small highlight dot
    ctx.beginPath();
    ctx.arc(eyeX - eyeR * 0.15, eyeY - eyeR * 0.15, eyeR * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }

  // Label
  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`${name} — ${spec.mode} mode, t=${timeOffset.toFixed(1)}`, 10, SIZE - 10);

  return canvas;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const p = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) { const k = args[i].slice(2); if (args[i+1] && !args[i+1].startsWith('--')) { p[k] = args[i+1]; i++; } else p[k] = true; }
  }
  return p;
}

async function main() {
  const args = parseArgs();
  const outDir = args.out || 'output/cuttlefish/geometry/';
  fs.mkdirSync(outDir, { recursive: true });

  let idx = 1;
  const entries = [];

  for (const [name, spec] of Object.entries(CUTTLEFISH)) {
    // Render 3 frames per cuttlefish to show chromatophore animation
    for (let frame = 0; frame < 3; frame++) {
      const time = frame * 1.5;
      const num = String(idx).padStart(3, '0');
      const canvas = renderCuttlefish(name, spec, time);
      const suffix = frame === 0 ? '' : `_f${frame}`;
      const outPath = path.join(outDir, `cuttle_${num}_${name}${suffix}.png`);
      fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
      if (frame === 0) {
        fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({
          name, mode: spec.mode, cellScale: spec.cellScale,
          bodyLen: spec.bodyLen, bodyWidth: spec.bodyWidth,
        }, null, 2));
      }
      console.log(`  ✓ ${outPath}`);
      if (frame === 0) entries.push({ name, canvas });
      idx++;
    }
  }

  // Contact sheet (first frame of each)
  const cols = 4, tile = 256;
  const rows = Math.ceil(entries.length / cols);
  const sheet = createCanvas(cols * tile, rows * (tile + 20));
  const sCtx = sheet.getContext('2d');
  sCtx.fillStyle = '#0a0a1a';
  sCtx.fillRect(0, 0, sheet.width, sheet.height);
  entries.forEach(({ name, canvas }, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    sCtx.drawImage(canvas, col * tile, row * (tile + 20), tile, tile);
    sCtx.fillStyle = '#888'; sCtx.font = 'bold 10px monospace';
    sCtx.fillText(name, col * tile + 4, row * (tile + 20) + tile + 14);
  });
  const sheetDir = path.join(outDir, '../sheets/');
  fs.mkdirSync(sheetDir, { recursive: true });
  fs.writeFileSync(path.join(sheetDir, 'sheet_001_cuttlefish.png'), sheet.toBuffer('image/png'));
  console.log(`  ✓ sheet_001_cuttlefish.png (contact sheet)`);
}

main().catch(console.error);
