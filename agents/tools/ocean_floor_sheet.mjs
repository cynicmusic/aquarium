#!/usr/bin/env node
/**
 * ocean_floor_sheet.mjs
 *
 * Static evaluator for swim-preview ocean-floor caustics. It generates a
 * 32-tile sheet and a JSON scorecard using the same "variant sheet + critic"
 * workflow used for cuttlefish/fish iteration.
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const OUT = arg('out', 'examples/internal/ocean_floor_sheet_v001.png');
const SCORE_OUT = arg('scores', OUT.replace(/\.png$/, '.json'));

const COLS = 8;
const ROWS = 4;
const TILE_W = 260;
const TILE_H = 180;
const LABEL_H = 38;
const PAD = 8;
const HEADER_H = 118;

function clamp(x, a = 0, b = 1) { return Math.max(a, Math.min(b, x)); }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function fract(x) { return x - Math.floor(x); }
function mix(a, b, t) { return a * (1 - t) + b * t; }
function hash(x, y) { return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = fract(x), fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return mix(mix(a, b, sx), mix(c, d, sx), sy);
}
function fbm(x, y, oct = 3) {
  let v = 0, amp = 0.5, fx = x, fy = y;
  for (let i = 0; i < oct; i++) {
    v += vnoise(fx, fy) * amp;
    fx *= 2.02; fy *= 2.02; amp *= 0.5;
  }
  return v;
}

function waveRidge(a, width) {
  const s = 1.0 - Math.abs(Math.sin(a));
  return Math.pow(clamp(s), width);
}

const variants = [];
function add(label, p) {
  variants.push({
    label,
    scale: 1.0,
    warp: 0.45,
    speed: 0.55,
    width: 8,
    cross: 0.45,
    blob: 0.46,
    grain: 0.10,
    glint: 0.35,
    hue: 0.0,
    ...p,
  });
}

for (const scale of [0.75, 0.9, 1.05, 1.25, 1.5, 1.85, 2.25, 2.8]) add(`S${scale}`, { scale });
for (const warp of [0.0, 0.16, 0.28, 0.42, 0.58, 0.78, 1.05, 1.35]) add(`W${warp}`, { warp });
for (const width of [4, 6, 8, 10, 12, 15, 19, 24]) add(`R${width}`, { width });
for (const glint of [0.0, 0.12, 0.24, 0.36, 0.50, 0.68, 0.86, 1.1]) add(`G${glint}`, { glint });

function causticAt(p, u, v, t) {
  const x = (u - 0.5) * 12 * p.scale;
  const y = (v - 0.5) * 8 * p.scale;
  const n = fbm(x * 0.22 + t * 0.08, y * 0.25 - t * 0.06, 3) - 0.5;
  const wx = x + n * p.warp * 3.0;
  const wy = y + (fbm(x * 0.18 - 8.1, y * 0.2 + 3.7, 3) - 0.5) * p.warp * 2.6;

  const a = waveRidge(wx * 1.10 + wy * 0.34 + t * (0.70 * p.speed), p.width);
  const b = waveRidge(wx * -0.46 + wy * 1.18 - t * (0.88 * p.speed) + 1.7, p.width * 0.82);
  const c = waveRidge(wx * 0.76 - wy * 0.80 + t * (0.52 * p.speed) + 4.2, p.width * 0.70);
  const filaments = Math.max(a, b) * 0.48 + c * 0.26 + (a * b) * (0.42 + p.cross * 0.20);
  const blobA = smoothstep(0.40, 0.76, fbm(wx * 0.13 + t * 0.026, wy * 0.15 - t * 0.020, 3));
  const blobB = smoothstep(0.42, 0.72, vnoise(wx * 0.24 - 6.3, wy * 0.22 + 4.1));
  const blobs = (blobA * 0.65 + blobB * 0.35) * (0.70 + filaments * 0.45);
  const glimmer = smoothstep(0.58, 0.92, filaments) * p.glint;
  return clamp(filaments * 0.82 + blobs * p.blob + glimmer);
}

function renderTile(ctx, tx, ty, p, index) {
  const img = ctx.createImageData(TILE_W, TILE_H);
  let sum = 0, sum2 = 0, hot = 0, edge = 0, prev = 0;
  for (let py = 0; py < TILE_H; py++) {
    for (let px = 0; px < TILE_W; px++) {
      const u = px / (TILE_W - 1);
      const v = py / (TILE_H - 1);
      const dune = fbm(u * 4.0, v * 3.2, 4);
      const grain = fbm(u * 28, v * 22, 2);
      const c0 = causticAt(p, u, v, 0.0);
      const c1 = causticAt(p, u, v, 1.6);
      const motionDelta = Math.abs(c1 - c0);
      const c = c0;
      const idx = (py * TILE_W + px) * 4;
      const baseR = mix(34, 96, dune);
      const baseG = mix(27, 82, dune);
      const baseB = mix(48, 76, dune);
      const sand = 0.92 + (grain - 0.5) * p.grain;
      const glint = smoothstep(0.78, 1.0, c) * p.glint;
      img.data[idx]     = clamp((baseR + c * 74 + glint * 70) * sand, 0, 255);
      img.data[idx + 1] = clamp((baseG + c * 88 + glint * 88) * sand, 0, 255);
      img.data[idx + 2] = clamp((baseB + c * 112 + glint * 120 + p.hue * 22) * sand, 0, 255);
      img.data[idx + 3] = 255;
      sum += c; sum2 += c * c; if (c > 0.78) hot++;
      if (px > 0) edge += Math.abs(c - prev);
      prev = c;
      p._motion = (p._motion || 0) + motionDelta;
    }
  }
  ctx.putImageData(img, tx, ty);
  const n = TILE_W * TILE_H;
  const mean = sum / n;
  const variance = sum2 / n - mean * mean;
  const hotFrac = hot / n;
  const edgeMean = edge / n;
  const motion = p._motion / n;

  const tooDim = Math.max(0, 0.08 - mean) * 18;
  const tooHot = Math.max(0, hotFrac - 0.14) * 14;
  const weakEdges = Math.max(0, 0.028 - edgeMean) * 90;
  const noisy = Math.max(0, edgeMean - 0.16) * 26;
  const motionPenalty = Math.max(0, motion - 0.18) * 8;
  const costPenalty = p.warp * 0.8 + p.width * 0.035;
  const score = clamp(8.5 + variance * 20 + edgeMean * 18 - tooDim - tooHot - weakEdges - noisy - motionPenalty - costPenalty, 0, 10);
  return { index, label: p.label, score, mean, variance, hotFrac, edgeMean, motion, params: { ...p, _motion: undefined } };
}

async function main() {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const W = COLS * (TILE_W + PAD) + PAD;
  const H = HEADER_H + ROWS * (TILE_H + LABEL_H + PAD) + PAD;
  const out = createCanvas(W, H);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#8ed8ff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('Ocean floor caustic sheet — 32 cheap ridge/glimmer variants', PAD, 28);
  ctx.fillStyle = '#c8d0e8';
  ctx.font = '13px monospace';
  ctx.fillText('Adversarial scoring penalizes dim floors, hot neon sheets, busy noise, excessive motion delta, and shader cost.', PAD, 52);
  ctx.fillText('Rows: scale sweep, warp sweep, ridge sharpness sweep, glint sweep. Goal: readable underwater caustic gleam with one cheap fragment eval.', PAD, 74);
  ctx.fillStyle = '#8a9';
  ctx.fillText(`Generated ${new Date().toISOString()}`, PAD, 96);

  const scores = [];
  for (let i = 0; i < variants.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const tx = PAD + col * (TILE_W + PAD);
    const ty = HEADER_H + row * (TILE_H + LABEL_H + PAD);
    const s = renderTile(ctx, tx, ty, variants[i], i + 1);
    scores.push(s);

    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillRect(tx, ty, 62, 31);
    ctx.fillStyle = '#ffe66b';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(String(i + 1).padStart(2, '0'), tx + 6, ty + 23);

    ctx.fillStyle = s.score >= 8 ? '#8f8' : s.score >= 7 ? '#ffd66b' : '#f99';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${variants[i].label} score ${s.score.toFixed(1)}`, tx + 4, ty + TILE_H + 16);
    ctx.fillStyle = '#aab';
    ctx.fillText(`hot ${(s.hotFrac * 100).toFixed(1)} edge ${s.edgeMean.toFixed(3)}`, tx + 4, ty + TILE_H + 32);
  }

  scores.sort((a, b) => b.score - a.score);
  fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
  fs.writeFileSync(path.join(root, OUT), out.toBuffer('image/png'));
  fs.writeFileSync(path.join(root, SCORE_OUT), JSON.stringify({ generatedAt: new Date().toISOString(), top: scores.slice(0, 8), scores }, null, 2));
  console.log(`wrote ${OUT}`);
  console.log(`wrote ${SCORE_OUT}`);
  console.log('top:', scores.slice(0, 5).map(s => `${s.index}:${s.label}:${s.score.toFixed(2)}`).join('  '));
}

main().catch(e => { console.error(e); process.exit(1); });
