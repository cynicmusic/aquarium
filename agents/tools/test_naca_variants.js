#!/usr/bin/env node
/**
 * test_naca_variants.js — Tests 3 NACA equation variants to find better fish head shapes.
 * Renders the same clownfish species with each variant side by side.
 */

import { createCanvas } from 'canvas';
import fs from 'fs';

const SIZE = 300;
const PAD = 30;

// Variant A: Standard NACA (current) — blunt sqrt leading edge
function thicknessA(x, t, headBluntness) {
  let yt = (t / 0.2) * (
    0.2969 * Math.sqrt(x)
    - 0.1260 * x
    - 0.3516 * x * x
    + 0.2843 * x * x * x
    - 0.1015 * x * x * x * x
  );
  if (x < 0.15) yt *= headBluntness;
  return yt;
}

// Variant B: Modified NACA with power-law nose (x^0.3 instead of sqrt)
// Slightly less blunt than sqrt, smoother entry
function thicknessB(x, t, headBluntness) {
  const noseShape = Math.pow(x, 0.25 + (1 - headBluntness) * 0.25); // 0.25 (blunt) to 0.50 (sharp)
  let yt = (t / 0.2) * (
    0.2969 * noseShape
    - 0.1260 * x
    - 0.3516 * x * x
    + 0.2843 * x * x * x
    - 0.1015 * x * x * x * x
  );
  return yt;
}

// Variant C: Joukowski-inspired — smoother nose, parametric bluntness
// Uses a blend of sharp (x^0.7) and blunt (x^0.3) nose based on headBluntness
function thicknessC(x, t, headBluntness) {
  const sharpNose = Math.pow(x, 0.6);   // pointy
  const bluntNose = Math.pow(x, 0.25);  // round
  const blend = headBluntness; // 0=sharp, 2=very blunt, 1=moderate
  const noseShape = sharpNose * (1 - blend * 0.5) + bluntNose * (blend * 0.5);

  // Smooth body curve (no hard cutoff at x=0.15)
  let yt = (t / 0.2) * (
    0.2969 * noseShape
    - 0.1260 * x
    - 0.3516 * x * x
    + 0.2843 * x * x * x
    - 0.1015 * x * x * x * x
  );
  return yt;
}

function camber(x, m, p) {
  if (m === 0) return 0;
  return x < p
    ? (m / (p * p)) * (2 * p * x - x * x)
    : (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
}

function renderVariant(label, thicknessFn, spec) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const pts = 80;
  const top = [], bot = [];
  for (let i = 0; i <= pts; i++) {
    const x = i / pts;
    const yt = thicknessFn(x, spec.thickness, spec.headBluntness);
    const yc = camber(x, spec.camber, spec.camberPos);
    const belly = spec.bellyBulge * Math.sin(x * Math.PI);
    top.push({ x, y: yc + yt });
    bot.push({ x, y: yc - yt - belly });
  }

  // Scale to canvas
  const allPts = [...top, ...bot];
  const minX = Math.min(...allPts.map(p => p.x));
  const maxX = Math.max(...allPts.map(p => p.x)) + 0.15;
  const minY = Math.min(...allPts.map(p => p.y));
  const maxY = Math.max(...allPts.map(p => p.y));
  const rX = maxX - minX, rY = maxY - minY;
  const scale = (SIZE - PAD * 2) / Math.max(rX, rY * 1.1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const ox = SIZE / 2 - cx * scale;
  const oy = SIZE / 2 + cy * scale;
  const toS = p => ({ x: p.x * scale + ox, y: -p.y * scale + oy });

  // Body
  ctx.beginPath();
  const topS = top.map(toS);
  const botS = [...bot].reverse().map(toS);
  ctx.moveTo(topS[0].x, topS[0].y);
  for (const p of topS) ctx.lineTo(p.x, p.y);
  for (const p of botS) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = '#ff6b35';
  ctx.fill();
  ctx.strokeStyle = '#cc4422';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eye
  const eyeS = toS({ x: spec.eye.x, y: camber(spec.eye.x, spec.camber, spec.camberPos) + thicknessFn(spec.eye.x, spec.thickness, spec.headBluntness) * spec.eye.yOffset });
  ctx.beginPath();
  ctx.arc(eyeS.x, eyeS.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyeS.x + 1, eyeS.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();

  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(label, 8, SIZE - 8);

  return canvas;
}

const species = [
  { name: 'clownfish', thickness: 0.28, camber: 0.04, camberPos: 0.35, bellyBulge: 0.03, headBluntness: 1.4, eye: { x: 0.12, yOffset: 0.3 } },
  { name: 'angelfish', thickness: 0.42, camber: 0.03, camberPos: 0.40, bellyBulge: 0.0, headBluntness: 1.2, eye: { x: 0.10, yOffset: 0.25 } },
  { name: 'tang', thickness: 0.32, camber: 0.03, camberPos: 0.38, bellyBulge: 0.01, headBluntness: 1.1, eye: { x: 0.09, yOffset: 0.28 } },
  { name: 'filefish', thickness: 0.45, camber: 0.02, camberPos: 0.35, bellyBulge: 0.0, headBluntness: 0.5, eye: { x: 0.08, yOffset: 0.28 } },
];

const variants = [
  { label: 'A: Standard NACA (current)', fn: thicknessA },
  { label: 'B: Power-law nose', fn: thicknessB },
  { label: 'C: Joukowski blend', fn: thicknessC },
];

// Render comparison grid: 3 variants × 4 species
const cols = 3, rows = species.length;
const sheet = createCanvas(cols * SIZE, rows * (SIZE + 20));
const sCtx = sheet.getContext('2d');
sCtx.fillStyle = '#0a0a1a';
sCtx.fillRect(0, 0, sheet.width, sheet.height);

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const canvas = renderVariant(`${variants[c].label} — ${species[r].name}`, variants[c].fn, species[r]);
    sCtx.drawImage(canvas, c * SIZE, r * (SIZE + 20));
  }
  sCtx.fillStyle = '#666';
  sCtx.font = 'bold 11px monospace';
  sCtx.fillText(species[r].name, 4, r * (SIZE + 20) + SIZE + 14);
}

fs.writeFileSync('output/fish/naca_variants_comparison.png', sheet.toBuffer('image/png'));
console.log('Saved: output/fish/naca_variants_comparison.png');
