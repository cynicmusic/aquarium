#!/usr/bin/env node
/**
 * compare_sheet.mjs — assemble a before/after comparison sheet from existing PNGs.
 * Uses node-canvas.
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const inputs = [
  { label: 'MASTER REFERENCE (target)', path: 'examples/external/cuttle/master reference.png' },
  { label: 'Cuttlefish v007 — spline-lofted mantle, sparkle layer, 3D W-pupil', path: 'examples/internal/cuttle_v007.png' },
  { label: 'Cuttlefish sheet v005 (4×4 morphotype × activity)', path: 'examples/internal/cuttle_sheet_v005.png' },
  { label: 'Skin sheet v003 (16 zebra × iridophore tiles)', path: 'examples/internal/skin_sheet_v003.png' },
  { label: 'Animation strip v006 (8 frames × 350ms — propagation wave)', path: 'examples/internal/cuttle_anim_v006.png' },
  { label: 'Aquarium v008 — tail swing + coral sway + deeper bg water', path: 'examples/internal/aquarium_v008.png' },
];

const TILE_W = 900;
const TILE_H = 560;
const PAD = 12;
const LABEL_H = 28;

const cols = 2;
const rows = Math.ceil(inputs.length / cols);
const out = createCanvas(cols * (TILE_W + PAD) + PAD, rows * (TILE_H + PAD + LABEL_H) + PAD);
const ctx = out.getContext('2d');
ctx.fillStyle = '#0a0a12';
ctx.fillRect(0, 0, out.width, out.height);

for (let i = 0; i < inputs.length; i++) {
  const { label, path: p } = inputs[i];
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = PAD + col * (TILE_W + PAD);
  const y = PAD + row * (TILE_H + PAD + LABEL_H);

  ctx.fillStyle = '#ccd';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(label, x, y + 18);

  try {
    const img = await loadImage(p);
    const scale = Math.min(TILE_W / img.width, TILE_H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, x + (TILE_W - w) / 2, y + LABEL_H + (TILE_H - h) / 2, w, h);
  } catch (e) {
    ctx.fillStyle = '#933';
    ctx.fillRect(x, y + LABEL_H, TILE_W, TILE_H);
    ctx.fillStyle = '#fff';
    ctx.fillText(`missing: ${p}`, x + 10, y + LABEL_H + 30);
  }
}

const outPath = 'examples/internal/compare_round3_2026-04-19.png';
fs.writeFileSync(outPath, out.toBuffer('image/png'));
console.log('wrote', outPath);
