#!/usr/bin/env node
/**
 * neon_tetra_cards.mjs
 *
 * Generates 32 neon-tetra candidate cards, adversarial scores them, and can
 * export the top 16 as public/fish/neonHoloTetraXX.json species.
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const has = k => args.includes(`--${k}`);
const OUT = arg('out', 'examples/internal/neon_tetra_cards_v001.png');
const SCORE_OUT = arg('scores', OUT.replace(/\.png$/, '.json'));
const SELECTED_OUT = arg('selected-out', OUT.replace(/\.png$/, '_selected.png'));
const EXPORT = has('export-selected');

const COLS = 8;
const ROWS = 4;
const TILE = 238;
const LABEL_H = 42;
const PAD = 8;
const HEADER_H = 106;

function clamp(x, a = 0, b = 1) { return Math.max(a, Math.min(b, x)); }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function fract(x) { return x - Math.floor(x); }
function mix(a, b, t) { return a * (1 - t) + b * t; }
function hash(n) { return fract(Math.sin(n * 127.1) * 43758.5453123); }
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function lerpRgb(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'public/fish/neonTetra.json'), 'utf8'));

function variant(i, round = 1) {
  const r = i / 31;
  const jitter = n => hash(i * 19.17 + n + round * 7.31) - 0.5;
  const stripeFamilies = [0.56, 0.52, 0.48, 0.44];
  const stripeBase = stripeFamilies[(i + round) % stripeFamilies.length];
  const hueShift = jitter(1) * 0.045 + (round - 1) * 0.004;
  const stripeHue = clamp(stripeBase + hueShift, 0.42, 0.60);
  const stripe2Hue = clamp(stripeHue + 0.040 + jitter(2) * 0.035, 0.45, 0.66);
  const warmFamilies = [
    { hue: 0.985, sat: 0.90, light: 0.48 }, // canonical neon red
    { hue: 0.020, sat: 0.92, light: 0.50 }, // hot red-orange
    { hue: 0.055, sat: 0.94, light: 0.52 }, // orange
    { hue: 0.105, sat: 0.88, light: 0.54 }, // amber/yellow-orange
  ];
  const warm = warmFamilies[(i + round) % warmFamilies.length];
  const redHue = clamp(warm.hue + jitter(3) * 0.018, 0.0, 1.0);
  return {
    id: i + 1,
    name: `neonHoloTetra${String(i + 1).padStart(2, '0')}`,
    length: 0.82 + jitter(4) * 0.16 + (i % 4) * 0.035,
    height: 0.68 + jitter(5) * 0.20 + Math.floor(i / 8) * 0.065,
    backArch: 0.86 + jitter(20) * 0.24 + (i % 3) * 0.08,
    bellyDrop: 0.86 + jitter(21) * 0.20 + ((i + 1) % 4) * 0.06,
    tail: 0.78 + jitter(6) * 0.28,
    snout: 0.98 + jitter(7) * 0.08,
    fin: 0.82 + jitter(8) * 0.18,
    stripeCenter: 0.320 + (i % 5) * 0.018 + jitter(9) * 0.026,
    stripeWidth: 0.052 + (i % 8) * 0.006 + jitter(10) * 0.010,
    stripeColor: hslToHex(stripeHue, 0.96, 0.55 + jitter(11) * 0.08),
    secondStripeColor: hslToHex(stripe2Hue, 0.96, 0.58 + jitter(12) * 0.08),
    redColor: hslToHex(redHue, warm.sat, warm.light + jitter(13) * 0.055),
    warmFamily: warm.hue < 0.03 ? 'red' : warm.hue < 0.08 ? 'orange' : 'amber',
    redStart: 0.24 + (i % 6) * 0.034 + jitter(22) * 0.018,
    redY: 0.405 + ((i + 2) % 4) * 0.020 + jitter(23) * 0.014,
    dorsalColor: hslToHex(0.64 + jitter(14) * 0.04, 0.62, 0.16 + jitter(15) * 0.025),
    bellyColor: hslToHex(0.58 + jitter(16) * 0.05, 0.35, 0.50 + jitter(17) * 0.05),
    shimmerAmp: 0.36 + jitter(18) * 0.18,
    shimmerSpeed: 0.30 + jitter(19) * 0.12,
    holoBias: r,
  };
}

function transformPoint([x, y], v) {
  const nx = (x - 0.04) * v.length + 0.04;
  const bodyT = clamp(x, 0, 1);
  const belly = Math.sin(bodyT * Math.PI);
  const sideScale = y >= 0 ? v.backArch : v.bellyDrop;
  const curve = (bodyT - 0.42) * 0.010 * (v.snout - 1);
  return [nx, y * v.height * sideScale * (0.92 + belly * 0.12) + curve];
}

function makeSpecies(v, selectedIndex) {
  const data = JSON.parse(JSON.stringify(base));
  data.species = `neonHoloTetra${String(selectedIndex).padStart(2, '0')}`;
  data.name = `Neon Holo Tetra ${String(selectedIndex).padStart(2, '0')}`;
  data.neonHolo = true;
  data.iridoMultiplier = 1.35 + v.holoBias * 0.25;
  data.params.bodyLength *= v.length;
  data.params.thickness *= v.height;
  data.params.headBluntness *= v.snout;
  data.geometry.body.top = data.geometry.body.top.map(p => transformPoint(p, v));
  data.geometry.body.bottom = data.geometry.body.bottom.map(p => transformPoint(p, v));
  data.geometry.dorsalFin = data.geometry.dorsalFin.map(p => transformPoint([p[0], p[1] * v.fin], v));
  data.geometry.analFin = data.geometry.analFin.map(p => transformPoint([p[0], p[1] * v.fin], v));
  data.geometry.pectoralFin = data.geometry.pectoralFin.map(p => transformPoint([p[0], p[1] * v.fin], v));
  data.geometry.caudalFin = data.geometry.caudalFin.map(([x, y]) => [1 + (x - 1) * v.tail, y * v.tail * v.height]);
  data.colors = {
    body: '#122447',
    stripe: v.stripeColor,
    accent: v.redColor,
    fin: '#6e9fbd',
  };
  data.pattern = {
    type: 'neon_tetra_holo',
    bodyColor: '#10213f',
    dorsalColor: v.dorsalColor,
    bellyColor: v.bellyColor,
    stripeColor: v.stripeColor,
    secondStripeColor: v.secondStripeColor,
    redColor: v.redColor,
    redStart: v.redStart,
    redY: v.redY,
    stripeCenter: v.stripeCenter,
    stripeWidth: v.stripeWidth,
    shimmer: { scale: 15 + v.holoBias * 8, amp: 0.025 + v.shimmerAmp * 0.035, speed: v.shimmerSpeed },
  };
  data.eye.r = 0.017 + v.holoBias * 0.003;
  return data;
}

function bodyPath(ctx, v, x0, y0, scale) {
  const top = base.geometry.body.top.map(p => transformPoint(p, v));
  const bot = base.geometry.body.bottom.map(p => transformPoint(p, v));
  const xs = [...top, ...bot].map(p => p[0]);
  const ys = [...top, ...bot].map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = scale / (maxX - minX);
  const sy = scale * 0.64 / (maxY - minY);
  const s = Math.min(sx, sy);
  const ox = x0 + (TILE - (maxX - minX) * s) * 0.5 - minX * s;
  const oy = y0 + TILE * 0.50 - (minY + maxY) * 0.5 * s;
  const map = ([x, y]) => [ox + x * s, oy - y * s];
  ctx.beginPath();
  let [mx, my] = map(top[0]);
  ctx.moveTo(mx, my);
  for (const p of top) { const [x, y] = map(p); ctx.lineTo(x, y); }
  for (let i = bot.length - 1; i >= 0; i--) { const [x, y] = map(bot[i]); ctx.lineTo(x, y); }
  ctx.closePath();
  return { top, bot, map };
}

function renderCard(ctx, v, tx, ty) {
  ctx.save();
  const bg = ctx.createLinearGradient(tx, ty, tx, ty + TILE);
  bg.addColorStop(0, '#08101d');
  bg.addColorStop(1, '#10172a');
  ctx.fillStyle = bg;
  ctx.fillRect(tx, ty, TILE, TILE);

  const geom = bodyPath(ctx, v, tx, ty, TILE * 0.78);
  ctx.clip();
  const bodyGrad = ctx.createLinearGradient(tx + TILE * 0.15, ty, tx + TILE * 0.9, ty + TILE * 0.9);
  bodyGrad.addColorStop(0, '#0a1328');
  bodyGrad.addColorStop(0.5, v.dorsalColor);
  bodyGrad.addColorStop(1, '#26304d');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(tx, ty, TILE, TILE);

  // Canonical red lower rear half.
  const redGrad = ctx.createLinearGradient(tx + TILE * 0.40, ty, tx + TILE * 0.92, ty);
  redGrad.addColorStop(0, 'rgba(255,30,45,0.05)');
  redGrad.addColorStop(0.28, v.redColor);
  redGrad.addColorStop(1, '#b40f24');
  ctx.fillStyle = redGrad;
  ctx.beginPath();
  ctx.moveTo(tx + TILE * v.redStart, ty + TILE * v.redY);
  ctx.bezierCurveTo(tx + TILE * 0.56, ty + TILE * (v.redY + 0.01), tx + TILE * 0.82, ty + TILE * (v.redY + 0.05), tx + TILE * 0.95, ty + TILE * (v.redY + 0.01));
  ctx.lineTo(tx + TILE * 0.96, ty + TILE * 0.67);
  ctx.bezierCurveTo(tx + TILE * 0.72, ty + TILE * 0.72, tx + TILE * 0.50, ty + TILE * 0.68, tx + TILE * (v.redStart - 0.04), ty + TILE * 0.58);
  ctx.closePath();
  ctx.fill();

  // Holo stripe: simplified broad band with a few rolling light bars.
  const stripeY = ty + TILE * (0.465 + (v.stripeCenter - 0.36) * 0.38);
  const stripeH = TILE * (v.stripeWidth * 0.72);
  const stripeGrad = ctx.createLinearGradient(tx + TILE * 0.14, stripeY, tx + TILE * 0.93, stripeY);
  stripeGrad.addColorStop(0, v.secondStripeColor);
  stripeGrad.addColorStop(0.45, v.stripeColor);
  stripeGrad.addColorStop(0.72, '#d8ffff');
  stripeGrad.addColorStop(1, v.stripeColor);
  ctx.strokeStyle = stripeGrad;
  ctx.lineWidth = Math.max(7, stripeH * 1.55);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx + TILE * 0.17, stripeY);
  ctx.bezierCurveTo(tx + TILE * 0.34, stripeY - TILE * 0.015, tx + TILE * 0.58, stripeY + TILE * 0.010, tx + TILE * 0.91, stripeY - TILE * 0.006);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(185,255,250,0.72)';
  ctx.lineWidth = Math.max(2, stripeH * 0.30);
  ctx.beginPath();
  ctx.moveTo(tx + TILE * 0.18, stripeY - stripeH * 0.08);
  ctx.bezierCurveTo(tx + TILE * 0.38, stripeY - TILE * 0.012, tx + TILE * 0.60, stripeY + TILE * 0.008, tx + TILE * 0.90, stripeY - TILE * 0.006);
  ctx.stroke();

  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 4; k++) {
    const bx = tx + TILE * (0.22 + ((k * 0.19 + v.holoBias * 0.37) % 0.72));
    const bar = ctx.createLinearGradient(bx - 16, stripeY, bx + 16, stripeY);
    bar.addColorStop(0, 'rgba(255,255,255,0)');
    bar.addColorStop(0.5, `rgba(220,255,255,${0.12 + v.shimmerAmp * 0.28})`);
    bar.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = bar;
    ctx.lineWidth = Math.max(3, stripeH * 1.1);
    ctx.beginPath();
    ctx.moveTo(bx - 18, stripeY - 6);
    ctx.lineTo(bx + 18, stripeY + 6);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  bodyPath(ctx, v, tx, ty, TILE * 0.78);
  ctx.strokeStyle = 'rgba(180,230,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const eyeX = tx + TILE * 0.19;
  const eyeY = ty + TILE * 0.47;
  ctx.fillStyle = '#eafaff';
  ctx.beginPath(); ctx.arc(eyeX, eyeY, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#020408';
  ctx.beginPath(); ctx.arc(eyeX + 1, eyeY, 2.8, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.64)';
  ctx.fillRect(tx, ty, 54, 30);
  ctx.fillStyle = '#78f2ff';
  ctx.font = 'bold 21px monospace';
  ctx.fillText(String(v.id).padStart(2, '0'), tx + 7, ty + 23);
}

function scoreVariant(v) {
  const canonical = 10
    - Math.abs(v.stripeCenter - 0.36) * 35
    - Math.abs(v.stripeWidth - 0.074) * 42
    - Math.abs(v.height - 0.86) * 3.2
    - Math.abs(v.length - 0.94) * 2.0;
  const shimmer = clamp(v.shimmerAmp, 0, 1) * 1.2 - Math.max(0, v.shimmerAmp - 0.58) * 3.5;
  const red = hexToRgb(v.redColor);
  const warmBonus = v.warmFamily === 'amber' ? 0.18 : v.warmFamily === 'orange' ? 0.28 : 0.12;
  const color = 1.5
    - Math.abs(hexToRgb(v.stripeColor)[1] - 230) / 190
    - Math.max(0, 170 - red[0]) / 210
    + Math.min(0.45, red[1] / 420)
    + warmBonus;
  const distinct = Math.abs(v.holoBias - 0.5) * 0.8 + Math.abs(v.tail - 1) * 0.5;
  return clamp(canonical + shimmer + color + distinct - 1.4, 0, 10);
}

function makeSheet(round) {
  const V = Array.from({ length: 32 }, (_, i) => variant(i, round));
  const scores = V.map(v => ({ ...v, score: scoreVariant(v) })).sort((a, b) => b.score - a.score);
  const W = COLS * (TILE + PAD) + PAD;
  const H = HEADER_H + ROWS * (TILE + LABEL_H + PAD) + PAD;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8ff4ff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`Neon holo tetra cards — 32 candidates — round ${round}`, PAD, 28);
  ctx.fillStyle = '#c8d8e8';
  ctx.font = '13px monospace';
  ctx.fillText('Adversary target: canonical neon tetra read, visible color variance, simplified stripe, rolling holo shimmer.', PAD, 52);
  ctx.fillText('Top 16 become a small nimble swim squad; shape variance is subtle by design.', PAD, 74);
  ctx.fillStyle = '#8a9';
  ctx.fillText(`Generated ${new Date().toISOString()}`, PAD, 96);

  for (const v of V) {
    const i = v.id - 1;
    const col = i % COLS, row = Math.floor(i / COLS);
    const tx = PAD + col * (TILE + PAD);
    const ty = HEADER_H + row * (TILE + LABEL_H + PAD);
    renderCard(ctx, v, tx, ty);
    const score = scoreVariant(v);
    ctx.fillStyle = score >= 8 ? '#8f8' : score >= 7 ? '#ffd66b' : '#f99';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`score ${score.toFixed(1)} ${v.name.replace('neonHoloTetra', 'NHT')}`, tx + 4, ty + TILE + 16);
    ctx.fillStyle = '#aab';
    ctx.fillText(`${v.warmFamily} w${v.stripeWidth.toFixed(3)} h${v.height.toFixed(2)}`, tx + 4, ty + TILE + 32);
  }
  return { canvas, V, scores };
}

function makeSelectedSheet(selected, round) {
  const scale = 1.45;
  const cols = 4;
  const rows = 4;
  const header = 90;
  const cellW = (TILE + PAD) * scale;
  const cellH = (TILE + LABEL_H + PAD) * scale;
  const W = Math.round(PAD + cols * cellW);
  const H = Math.round(header + rows * cellH + PAD);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8ff4ff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`Selected neon holo tetra — round ${round}`, PAD, 30);
  ctx.fillStyle = '#c8d8e8';
  ctx.font = '14px monospace';
  ctx.fillText('Balanced selected 16: red, orange, and amber rear bodies with varied stripe height/width.', PAD, 56);
  ctx.fillStyle = '#8a9';
  ctx.fillText(`Generated ${new Date().toISOString()}`, PAD, 78);

  for (let i = 0; i < selected.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = PAD + col * cellW;
    const ty = header + row * cellH;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);
    renderCard(ctx, selected[i], 0, 0);
    ctx.restore();
  }
  return canvas;
}

function selectTop16(scores) {
  const selected = [];
  const quotas = { red: 5, orange: 6, amber: 5 };
  const used = new Set();
  for (const family of ['orange', 'amber', 'red']) {
    for (const s of scores) {
      if (selected.length >= 16) break;
      if (used.has(s.id) || s.warmFamily !== family) continue;
      selected.push(s);
      used.add(s.id);
      if (selected.filter(v => v.warmFamily === family).length >= quotas[family]) break;
    }
  }
  for (const s of scores) {
    if (selected.length >= 16) break;
    if (used.has(s.id)) continue;
    selected.push(s);
    used.add(s.id);
  }
  return selected;
}

const round = Number(arg('round', '1'));
const { canvas, scores } = makeSheet(round);
const selected = selectTop16(scores);
fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
fs.writeFileSync(path.join(root, OUT), canvas.toBuffer('image/png'));
fs.writeFileSync(path.join(root, SELECTED_OUT), makeSelectedSheet(selected, round).toBuffer('image/png'));
fs.writeFileSync(path.join(root, SCORE_OUT), JSON.stringify({ round, generatedAt: new Date().toISOString(), top16: selected, scores }, null, 2));
console.log(`wrote ${OUT}`);
console.log(`wrote ${SELECTED_OUT}`);
console.log(`wrote ${SCORE_OUT}`);
console.log('top16:', selected.map(s => `${s.id}:${s.score.toFixed(2)}:${s.warmFamily}`).join(' '));

if (EXPORT) {
  for (let i = 0; i < selected.length; i++) {
    const data = makeSpecies(selected[i], i + 1);
    fs.writeFileSync(path.join(root, `public/fish/${data.species}.json`), JSON.stringify(data, null, 2));
  }
  const manifestPath = path.join(root, 'public/fish/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const filtered = manifest.filter(n => !/^neonHoloTetra\d+$/.test(n));
  filtered.push(...selected.map((_, i) => `neonHoloTetra${String(i + 1).padStart(2, '0')}`));
  fs.writeFileSync(manifestPath, JSON.stringify(filtered, null, 2) + '\n');
  console.log('exported selected 16 neonHoloTetra species');
}
