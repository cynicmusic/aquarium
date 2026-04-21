#!/usr/bin/env node
/**
 * zebra_static_sheet.mjs — round 5.
 * User pick: "FL f16 loc0.25 w0.4 j1" is the most promising. User wants:
 *   - All tiles in FLF family (no overlays, no hybrids)
 *   - Solid (hard-edged) bars, not fuzzy
 *   - Numbered 1..32 with big readable labels
 *
 * This round explores a focused 32-cell parameter space around that winner,
 * sweeping four parameters (freq, localAmp, warpStrength, forkStrength).
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const OUT = arg('out', 'examples/internal/zebra_static_sheet_v005.png');
const COLS = 8;
const ROWS = 4;
const TILE_W = 260;
const TILE_H = 180;
const LABEL_H = 30;
const PAD = 6;
const REF_H = 200;

function hash21(x, y) { let s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy), b = hash21(ix + 1, iy), c = hash21(ix, iy + 1), d = hash21(ix + 1, iy + 1);
  return a + (b - a) * sx + ((c - a) + ((a - b) + (d - c)) * sx) * sy;
}
function fbm(x, y, oct = 4) { let v = 0, amp = 0.5, fx = x, fy = y;
  for (let i = 0; i < oct; i++) { v += vnoise(fx, fy) * amp; fx *= 2.02; fy *= 2.02; amp *= 0.5; } return v; }

// Per-bar-index independent noise offset. Each bar wanders on its own.
function barNoise(u, barIndex, freqU = 6, oct = 3) {
  const shift = barIndex * 13.37;
  let v = 0, amp = 0.5, fu = u * freqU + shift;
  for (let i = 0; i < oct; i++) {
    v += vnoise(fu, shift * 1.7 + i * 4.1) * amp;
    fu *= 2.02; amp *= 0.5;
  }
  return v - 0.5;
}

// FL (fork-local) core — solid bars, per-bar independent offset,
// optional phase jump for bifurcation.
function forkLocal(u, y, freq, localAmp, warpStrength, forkStrength) {
  const barIndex = Math.floor(y * freq);
  const offsetA = barNoise(u, barIndex,     5) * localAmp;
  const offsetB = barNoise(u, barIndex + 1, 5) * localAmp;
  const frac = (y * freq) - barIndex;
  const offset = offsetA * (1 - frac) + offsetB * frac;
  const warp = (fbm(u * 3, y * 4, 3) - 0.5) * warpStrength;
  const jumpN = vnoise(u * 2.1, y * 1.2);
  const jump = jumpN > 0.8 ? Math.floor(jumpN * 3) * 0.25 : 0;
  const phase = y * freq + offset * freq + warp + jump * forkStrength;
  return 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI);
}

// ── 32 FLF variants — all solid, no overlays ──
// Seed: FL f16 loc0.25 w0.4 j1.0 (user's best-so-far)
// Explore ±freq, ±localAmp, ±warp, ±fork around seed.

const V = [];
function add(p) {
  V.push({
    algo: 'flSolid',
    freq: 16, localAmp: 0.25, warpStrength: 0.4, forkStrength: 1.0,
    edge: [0.48, 0.52],
    ...p,
  });
}

// Tiles 1-8: sweep freq @ seed (la=0.25, w=0.4, j=1.0)
add({ label: 'f10',  freq: 10 });
add({ label: 'f12',  freq: 12 });
add({ label: 'f14',  freq: 14 });
add({ label: 'f16★', freq: 16 });  // ★ seed
add({ label: 'f18',  freq: 18 });
add({ label: 'f20',  freq: 20 });
add({ label: 'f22',  freq: 22 });
add({ label: 'f24',  freq: 24 });

// Tiles 9-16: sweep localAmp @ freq=16, w=0.4, j=1.0
add({ label: 'la0.10', localAmp: 0.10 });
add({ label: 'la0.15', localAmp: 0.15 });
add({ label: 'la0.20', localAmp: 0.20 });
add({ label: 'la0.25★',localAmp: 0.25 });
add({ label: 'la0.30', localAmp: 0.30 });
add({ label: 'la0.35', localAmp: 0.35 });
add({ label: 'la0.45', localAmp: 0.45 });
add({ label: 'la0.60', localAmp: 0.60 });

// Tiles 17-24: sweep warpStrength @ freq=16, la=0.25, j=1.0
add({ label: 'w0.0',  warpStrength: 0.0 });
add({ label: 'w0.2',  warpStrength: 0.2 });
add({ label: 'w0.4★', warpStrength: 0.4 });
add({ label: 'w0.6',  warpStrength: 0.6 });
add({ label: 'w0.9',  warpStrength: 0.9 });
add({ label: 'w1.3',  warpStrength: 1.3 });
add({ label: 'w1.8',  warpStrength: 1.8 });
add({ label: 'w2.5',  warpStrength: 2.5 });

// Tiles 25-32: sweep forkStrength @ freq=16, la=0.25, w=0.4
add({ label: 'j0.0',   forkStrength: 0.0 });
add({ label: 'j0.4',   forkStrength: 0.4 });
add({ label: 'j0.7',   forkStrength: 0.7 });
add({ label: 'j1.0★',  forkStrength: 1.0 });
add({ label: 'j1.3',   forkStrength: 1.3 });
add({ label: 'j1.7',   forkStrength: 1.7 });
add({ label: 'j2.2',   forkStrength: 2.2 });
add({ label: 'j3.0',   forkStrength: 3.0 });

if (V.length !== 32) { console.error(`Expected 32, got ${V.length}`); process.exit(1); }

function sampleZebra(v, u, y) {
  const raw = forkLocal(u, y, v.freq, v.localAmp, v.warpStrength, v.forkStrength);
  // Solid hard edges — no fuzz, no dither. Just a narrow smoothstep for AA.
  return smoothstep(v.edge[0], v.edge[1], raw);
}

function renderTile(ctx, x, y, w, h, variant) {
  const gR = 225, gG = 195, gB = 155;
  const sR = 20,  sG = 14,  sB = 10;
  const img = ctx.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const u = px / w, vv = py / h;
      const mott = 0.9 + fbm(u * 6, vv * 6, 3) * 0.18;
      const z = sampleZebra(variant, u, vv);
      const idx = (py * w + px) * 4;
      img.data[idx]     = Math.round((gR * (1 - z) + sR * z) * mott);
      img.data[idx + 1] = Math.round((gG * (1 - z) + sG * z) * mott);
      img.data[idx + 2] = Math.round((gB * (1 - z) + sB * z) * mott);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, x, y);
}

async function main() {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const refPath = path.join(ROOT, 'examples/external/cuttle/master reference.png');
  const refImg = await loadImage(refPath);
  const W = COLS * (TILE_W + PAD) + PAD;
  const H = REF_H + PAD * 2 + ROWS * (TILE_H + PAD + LABEL_H) + PAD;
  const out = createCanvas(W, H);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, W, H);

  const refW = Math.min(520, refImg.width * (REF_H / refImg.height));
  ctx.drawImage(refImg, PAD, PAD, refW, REF_H);
  ctx.fillStyle = '#7bd';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('MASTER REFERENCE — zebra target', PAD + refW + 16, PAD + 20);
  ctx.fillStyle = '#ccd';
  ctx.font = '12px monospace';
  ctx.fillText('Round 5 — 32 FLF variants, solid edges, no overlays.', PAD + refW + 16, PAD + 44);
  ctx.fillText('Each tile numbered 1-32 for quick reference.', PAD + refW + 16, PAD + 62);
  ctx.fillText('Seed (★): freq=16, localAmp=0.25, warp=0.4, fork=1.0', PAD + refW + 16, PAD + 82);
  ctx.fillText('ROW 1 (1-8): sweep freq       ROW 2 (9-16): sweep localAmp', PAD + refW + 16, PAD + 102);
  ctx.fillText('ROW 3 (17-24): sweep warp     ROW 4 (25-32): sweep fork jump', PAD + refW + 16, PAD + 122);
  ctx.fillStyle = '#5a8';
  ctx.fillText(`Generated: ${new Date().toISOString()}`, PAD + refW + 16, PAD + 150);

  for (let i = 0; i < 32; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const tx = PAD + col * (TILE_W + PAD);
    const ty = REF_H + PAD * 2 + row * (TILE_H + PAD + LABEL_H) + PAD;
    renderTile(ctx, tx, ty, TILE_W, TILE_H, V[i]);

    // Big number in top-left of each tile
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(tx, ty, 44, 30);
    ctx.fillStyle = '#ffe14c';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(String(i + 1).padStart(2, '0'), tx + 6, ty + 23);

    // Parameter label under the tile
    ctx.fillStyle = V[i].label && V[i].label.includes('★') ? '#ffd700' : '#cde';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(V[i].label || '', tx + 4, ty + TILE_H + 18);
  }

  fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUT), out.toBuffer('image/png'));
  console.log('wrote', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
