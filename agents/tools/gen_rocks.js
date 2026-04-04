#!/usr/bin/env node
/**
 * gen_rocks.js — Generates 16 rocks + 16 polyps/small creatures.
 * Usage: node agents/tools/gen_rocks.js --all --out output/rocks/geometry/
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;
const PAD = 40;

function hash(x) { return ((Math.sin(x * 127.1) * 43758.5453) % 1 + 1) % 1; }

const ROCKS = {
  roundBoulder: { name: 'Round Boulder', shape: 'round', size: 0.35,
    color: { base: '#554433', mid: '#776655', light: '#998877' }, roughness: 0.1 },
  flatSlate: { name: 'Flat Slate', shape: 'flat', size: 0.40,
    color: { base: '#445566', mid: '#667788', light: '#8899aa' }, roughness: 0.05 },
  jaggedRock: { name: 'Jagged Rock', shape: 'jagged', size: 0.30,
    color: { base: '#443322', mid: '#665544', light: '#887766' }, roughness: 0.25 },
  coralRock: { name: 'Coral Rock', shape: 'bumpy', size: 0.32,
    color: { base: '#665544', mid: '#887766', light: '#aa9988' }, roughness: 0.15 },
  stackedStones: { name: 'Stacked Stones', shape: 'stacked', size: 0.30,
    color: { base: '#556655', mid: '#778877', light: '#99aa99' }, roughness: 0.08 },
  archRock: { name: 'Arch Rock', shape: 'arch', size: 0.38,
    color: { base: '#554444', mid: '#776666', light: '#998888' }, roughness: 0.12 },
  pebbleCluster: { name: 'Pebble Cluster', shape: 'pebbles', size: 0.35,
    color: { base: '#666655', mid: '#888877', light: '#aaaa99' }, roughness: 0.05 },
  liveRock: { name: 'Live Rock', shape: 'round', size: 0.33,
    color: { base: '#555544', mid: '#777766', light: '#999988' }, roughness: 0.18,
    encrusted: true },
  mossRock: { name: 'Moss Rock', shape: 'round', size: 0.34,
    color: { base: '#556644', mid: '#778866', light: '#99aa88' }, roughness: 0.10,
    encrusted: true, encrustColors: ['#33774488','#448833aa','#55993388'] },
  lavaRock: { name: 'Lava Rock', shape: 'jagged', size: 0.30,
    color: { base: '#222222', mid: '#3a3a3a', light: '#555555' }, roughness: 0.30 },
  sandstone: { name: 'Sandstone', shape: 'flat', size: 0.38,
    color: { base: '#997744', mid: '#bbaa66', light: '#ddcc88' }, roughness: 0.06,
    banded: true },
  dragonStone: { name: 'Dragon Stone', shape: 'jagged', size: 0.32,
    color: { base: '#663322', mid: '#884433', light: '#aa6644' }, roughness: 0.22 },
  seiryu: { name: 'Seiryu Stone', shape: 'jagged', size: 0.30,
    color: { base: '#445566', mid: '#667788', light: '#8899bb' }, roughness: 0.20 },
  ohko: { name: 'Ohko Stone', shape: 'round', size: 0.33,
    color: { base: '#aa9977', mid: '#ccbb99', light: '#eeddbb' }, roughness: 0.15,
    cavities: true },
  manzanita: { name: 'Manzanita Wood', shape: 'branchy', size: 0.38,
    color: { base: '#554433', mid: '#776655', light: '#998877' }, roughness: 0.08 },
  shellCluster: { name: 'Shell Cluster', shape: 'shells', size: 0.35,
    color: { base: '#ccbbaa', mid: '#eeddcc', light: '#fff8ee' }, roughness: 0.05 },
};

const POLYPS = {
  zoanthid: { name: 'Zoanthid Colony', type: 'disc', count: 12,
    color: { base: '#22aa44', mid: '#44cc66', center: '#ffdd44' }, size: 0.03 },
  anemone: { name: 'Anemone', type: 'tentacle', count: 30,
    color: { base: '#cc4488', mid: '#dd66aa', center: '#ffaacc', tip: '#ffffff' }, size: 0.15 },
  mushPoly: { name: 'Mushroom Polyp', type: 'mushroom', count: 6,
    color: { base: '#4488cc', mid: '#66aadd', center: '#88ccee' }, size: 0.06 },
  starPolyp: { name: 'Star Polyps', type: 'star', count: 20,
    color: { base: '#33aa33', mid: '#55cc55', center: '#88ee88' }, size: 0.02 },
  xenia: { name: 'Xenia', type: 'pulsing', count: 8,
    color: { base: '#9977aa', mid: '#bb99cc', center: '#ddbbee' }, size: 0.05 },
  featherDuster: { name: 'Feather Duster', type: 'fan', count: 3,
    color: { base: '#886644', mid: '#ddaa77', center: '#ffccaa' }, size: 0.10 },
  sunPolyp: { name: 'Sun Polyps', type: 'sun', count: 10,
    color: { base: '#dd6600', mid: '#ff8822', center: '#ffcc44' }, size: 0.035 },
  ricordea: { name: 'Ricordea', type: 'bubble_disc', count: 8,
    color: { base: '#2288cc', mid: '#44aaee', center: '#88ddff' }, size: 0.04 },
  duncanCoral: { name: 'Duncan Coral', type: 'disc', count: 10,
    color: { base: '#336633', mid: '#55aa55', center: '#aa66cc' }, size: 0.035,
    branching: true },
  blastomusa: { name: 'Blastomusa', type: 'mushroom', count: 5,
    color: { base: '#cc3344', mid: '#55aa44', center: '#88cc66' }, size: 0.08 },
  acanthastrea: { name: 'Acanthastrea', type: 'disc', count: 14,
    color: { base: '#cc2244', mid: '#44bbdd', center: '#ffcc22' }, size: 0.035,
    warCoral: true },
  eleganceCoral: { name: 'Elegance Coral', type: 'tentacle', count: 24,
    color: { base: '#664488', mid: '#cc66aa', center: '#ddaacc', tip: '#ff88cc' }, size: 0.14 },
  torchPolyp: { name: 'Torch Polyp', type: 'tentacle', count: 20,
    color: { base: '#665533', mid: '#887755', center: '#aa9977', tip: '#66ff88' }, size: 0.13 },
  hammerPolyp: { name: 'Hammer Polyp', type: 'tentacle', count: 18,
    color: { base: '#556644', mid: '#66aa55', center: '#88cc77', tip: '#aaffaa' }, size: 0.12,
    hammerTips: true },
  clownAnemone: { name: 'Clown Anemone', type: 'tentacle', count: 36,
    color: { base: '#664488', mid: '#8866aa', center: '#55cc77', tip: '#aaddaa' }, size: 0.18 },
  tubeAnemone: { name: 'Tube Anemone', type: 'tube', count: 1,
    color: { base: '#dd7733', mid: '#ffaa55', center: '#ffffff', tip: '#ffcc88' }, size: 0.12 },
};

function renderRock(name, spec) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const cx = SIZE / 2, cy = SIZE - PAD;
  const r = spec.size * SIZE;

  if (spec.shape === 'round' || spec.shape === 'bumpy') {
    drawRoundRock(ctx, cx, cy - r * 0.6, r, spec);
  } else if (spec.shape === 'flat') {
    drawFlatRock(ctx, cx, cy - r * 0.2, r, spec);
  } else if (spec.shape === 'jagged') {
    drawJaggedRock(ctx, cx, cy - r * 0.7, r, spec);
  } else if (spec.shape === 'stacked') {
    for (let i = 0; i < 3; i++) {
      const sr = r * (0.9 - i * 0.2);
      const sy = cy - i * r * 0.5 - sr * 0.4;
      const sx = cx + (hash(i * 17) - 0.5) * r * 0.3;
      drawRoundRock(ctx, sx, sy, sr, spec);
    }
  } else if (spec.shape === 'arch') {
    drawArchRock(ctx, cx, cy, r, spec);
  } else if (spec.shape === 'pebbles') {
    for (let i = 0; i < 12; i++) {
      const pr = r * (0.15 + hash(i * 13) * 0.2);
      const px = cx + (hash(i * 23) - 0.5) * r * 1.5;
      const py = cy - pr * 0.5 - hash(i * 37) * r * 0.3;
      drawRoundRock(ctx, px, py, pr, spec);
    }
  } else if (spec.shape === 'branchy') {
    drawBranchyWood(ctx, cx, cy, r, spec);
  } else if (spec.shape === 'shells') {
    drawShellCluster(ctx, cx, cy, r, spec);
  }

  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(name, 10, SIZE - 10);
  return canvas;
}

function drawRoundRock(ctx, cx, cy, r, spec) {
  ctx.beginPath();
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = 1 + (hash(i * 17 + r) - 0.5) * spec.roughness * 2;
    const rx = r * wobble;
    const ry = r * 0.65 * wobble;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
  grad.addColorStop(0, spec.color.light);
  grad.addColorStop(0.6, spec.color.mid);
  grad.addColorStop(1, spec.color.base);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = spec.color.base;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Surface texture dots
  for (let i = 0; i < 20; i++) {
    const a = hash(i * 19 + r) * Math.PI * 2;
    const d = hash(i * 29 + r) * r * 0.7;
    const dx = cx + Math.cos(a) * d;
    const dy = cy + Math.sin(a) * d * 0.6;
    ctx.beginPath();
    ctx.arc(dx, dy, 1 + hash(i * 41) * 2, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.base + '44';
    ctx.fill();
  }

  if (spec.encrusted) {
    // Encrusting patches (green for moss, mixed for others)
    const colors = spec.encrustColors || ['#88446688','#66884488','#88664488'];
    for (let i = 0; i < 5; i++) {
      const a = hash(i * 53) * Math.PI * 2;
      const d = hash(i * 61) * r * 0.6;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.5;
      ctx.beginPath();
      ctx.ellipse(px, py, 8 + hash(i*71) * 12, 5 + hash(i*79) * 8, hash(i*83), 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
    }
  }

  if (spec.cavities) {
    // Weathered holes/cavities
    for (let i = 0; i < 6; i++) {
      const a = hash(i * 47) * Math.PI * 2;
      const d = hash(i * 59) * r * 0.5;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.5;
      ctx.beginPath();
      ctx.ellipse(px, py, 3 + hash(i*67) * 8, 2 + hash(i*73) * 5, hash(i*81), 0, Math.PI * 2);
      ctx.fillStyle = '#00000066';
      ctx.fill();
    }
  }
}

function drawFlatRock(ctx, cx, cy, r, spec) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.2, 0, 0, Math.PI * 2);
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, spec.color.base);
  grad.addColorStop(0.3, spec.color.mid);
  grad.addColorStop(0.7, spec.color.light);
  grad.addColorStop(1, spec.color.base);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = spec.color.base;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Top surface
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.08, r * 0.95, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = spec.color.light + 'aa';
  ctx.fill();

  if (spec.banded) {
    // Horizontal sediment bands
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.2, 0, 0, Math.PI * 2);
    ctx.clip();
    for (let b = 0; b < 6; b++) {
      const by = cy - r * 0.2 + b * r * 0.07;
      ctx.beginPath();
      ctx.rect(cx - r, by, r * 2, r * 0.025);
      ctx.fillStyle = b % 2 === 0 ? spec.color.base + '66' : spec.color.light + '44';
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawJaggedRock(ctx, cx, cy, r, spec) {
  ctx.beginPath();
  const pts = 16;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wobble = 1 + (hash(i * 13) - 0.3) * spec.roughness * 4;
    const x = cx + Math.cos(a) * r * wobble;
    const y = cy + Math.sin(a) * r * 0.7 * wobble;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, spec.color.light);
  grad.addColorStop(1, spec.color.base);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = spec.color.base;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawArchRock(ctx, cx, cy, r, spec) {
  // Left pillar
  drawRoundRock(ctx, cx - r * 0.6, cy - r * 0.3, r * 0.4, spec);
  // Right pillar
  drawRoundRock(ctx, cx + r * 0.6, cy - r * 0.3, r * 0.45, spec);
  // Top span
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.9, cy - r * 0.5);
  ctx.quadraticCurveTo(cx, cy - r * 1.2, cx + r * 0.95, cy - r * 0.5);
  ctx.quadraticCurveTo(cx, cy - r * 0.7, cx - r * 0.9, cy - r * 0.5);
  ctx.fillStyle = spec.color.mid;
  ctx.fill();
  ctx.strokeStyle = spec.color.base;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBranchyWood(ctx, cx, cy, r, spec) {
  // Main trunk
  function drawBranch(x, y, angle, len, width, depth) {
    if (depth <= 0 || len < 5) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = depth > 2 ? spec.color.base : spec.color.mid;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Sub-branches
    const spread = 0.5 + hash(depth * 17 + len) * 0.4;
    drawBranch(ex, ey, angle - spread, len * 0.65, width * 0.6, depth - 1);
    drawBranch(ex, ey, angle + spread * 0.8, len * 0.6, width * 0.55, depth - 1);
    if (hash(depth * 31 + width) > 0.5)
      drawBranch(ex, ey, angle + (hash(depth*41)-0.5)*0.3, len * 0.5, width * 0.5, depth - 1);
  }
  // Root base
  drawRoundRock(ctx, cx, cy - r * 0.1, r * 0.25, { ...spec, encrusted: false, cavities: false });
  drawBranch(cx, cy - r * 0.3, -Math.PI / 2 - 0.2, r * 0.9, 8, 5);
  drawBranch(cx - r * 0.1, cy - r * 0.2, -Math.PI / 2 + 0.4, r * 0.7, 6, 4);
}

function drawShellCluster(ctx, cx, cy, r, spec) {
  for (let i = 0; i < 14; i++) {
    const sx = cx + (hash(i * 19) - 0.5) * r * 1.6;
    const sy = cy - hash(i * 29) * r * 0.5 - r * 0.1;
    const sr = r * (0.08 + hash(i * 37) * 0.15);
    const angle = hash(i * 43) * Math.PI * 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    // Shell shape: fan/scallop
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let a = -0.8; a <= 0.8; a += 0.1) {
      ctx.lineTo(Math.sin(a) * sr * 2, -Math.cos(a) * sr * 2);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, -sr, 0, 0, -sr, sr * 2);
    g.addColorStop(0, spec.color.light);
    g.addColorStop(1, spec.color.base);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = spec.color.base + '88';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Ridges
    for (let j = -0.6; j <= 0.6; j += 0.3) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(j) * sr * 1.8, -Math.cos(j) * sr * 1.8);
      ctx.strokeStyle = spec.color.mid + '44';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function renderPolyp(name, spec) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const cx = SIZE / 2, cy = SIZE / 2;

  if (spec.type === 'disc' || spec.type === 'star' || spec.type === 'bubble_disc') {
    // Colony of small polyps
    for (let i = 0; i < spec.count; i++) {
      const px = cx + (hash(i * 17) - 0.5) * SIZE * 0.5;
      const py = cy + (hash(i * 23) - 0.5) * SIZE * 0.4;
      const pr = spec.size * SIZE * (0.6 + hash(i * 31) * 0.4);
      drawSinglePolyp(ctx, px, py, pr, spec, i);
    }
  } else if (spec.type === 'tentacle') {
    // Anemone: central disc with tentacles
    const baseR = spec.size * SIZE * 0.6;
    // Tentacles
    for (let i = 0; i < spec.count; i++) {
      const angle = (i / spec.count) * Math.PI * 2;
      const len = spec.size * SIZE * (0.8 + hash(i * 13) * 0.4);
      drawTentacle(ctx, cx, cy, angle, len, 3, spec);
    }
    // Central disc
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.center;
    ctx.fill();
    // Mouth
    ctx.beginPath();
    ctx.ellipse(cx, cy, baseR * 0.3, baseR * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.base;
    ctx.fill();
  } else if (spec.type === 'mushroom') {
    for (let i = 0; i < spec.count; i++) {
      const px = cx + (hash(i * 19) - 0.5) * SIZE * 0.5;
      const py = cy + (hash(i * 29) - 0.5) * SIZE * 0.3;
      const pr = spec.size * SIZE * (0.5 + hash(i * 37) * 0.5);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, spec.color.center);
      g.addColorStop(0.5, spec.color.mid);
      g.addColorStop(1, spec.color.base);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = spec.color.base;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  } else if (spec.type === 'pulsing') {
    // Xenia: pulsing soft coral with feathery tips
    for (let i = 0; i < spec.count; i++) {
      const bx = cx + (hash(i * 17) - 0.5) * SIZE * 0.3;
      const by = cy + SIZE * 0.15;
      const h = spec.size * SIZE * 2 * (0.6 + hash(i * 31) * 0.4);
      // Stalk
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + (hash(i*41)-0.5)*10, by - h);
      ctx.strokeStyle = spec.color.base;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Feathery top
      for (let t = 0; t < 8; t++) {
        const ta = (t / 8) * Math.PI * 2;
        const tl = h * 0.3;
        ctx.beginPath();
        ctx.moveTo(bx, by - h);
        ctx.quadraticCurveTo(bx + Math.cos(ta) * tl * 0.5, by - h - tl * 0.7,
          bx + Math.cos(ta) * tl, by - h + Math.sin(ta) * tl * 0.3);
        ctx.strokeStyle = spec.color.mid;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  } else if (spec.type === 'fan') {
    // Feather duster worm
    for (let i = 0; i < spec.count; i++) {
      const bx = cx + (i - 1) * SIZE * 0.15;
      const by = cy + SIZE * 0.2;
      // Tube
      ctx.beginPath();
      ctx.rect(bx - 4, by, 8, SIZE * 0.2);
      ctx.fillStyle = spec.color.base;
      ctx.fill();
      // Fan crown
      const fanR = spec.size * SIZE;
      for (let f = 0; f < 16; f++) {
        const fa = (f / 16) * Math.PI - Math.PI * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        const fx = bx + Math.cos(fa) * fanR;
        const fy = by + Math.sin(fa) * fanR;
        ctx.lineTo(fx, fy);
        ctx.strokeStyle = f % 2 === 0 ? spec.color.mid : spec.color.center;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Barbs
        for (let b = 0.3; b < 1; b += 0.2) {
          const bbx = bx + Math.cos(fa) * fanR * b;
          const bby = by + Math.sin(fa) * fanR * b;
          ctx.beginPath();
          ctx.moveTo(bbx, bby);
          ctx.lineTo(bbx + Math.cos(fa + 0.3) * 5, bby + Math.sin(fa + 0.3) * 5);
          ctx.strokeStyle = spec.color.center + '88';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  } else if (spec.type === 'tube') {
    // Tube anemone: long tube body with crown of tentacles at top
    const bx = cx, by = cy + SIZE * 0.2;
    const tubeH = spec.size * SIZE * 3;
    const tubeW = 10;
    // Tube body
    ctx.beginPath();
    ctx.moveTo(bx - tubeW, by);
    ctx.lineTo(bx - tubeW * 0.7, by - tubeH);
    ctx.lineTo(bx + tubeW * 0.7, by - tubeH);
    ctx.lineTo(bx + tubeW, by);
    ctx.closePath();
    const tg = ctx.createLinearGradient(bx - tubeW, by, bx + tubeW, by);
    tg.addColorStop(0, spec.color.base);
    tg.addColorStop(0.5, spec.color.mid);
    tg.addColorStop(1, spec.color.base);
    ctx.fillStyle = tg;
    ctx.fill();
    // Crown of tentacles
    const crownY = by - tubeH;
    for (let t = 0; t < 20; t++) {
      const ta = (t / 20) * Math.PI * 2;
      const tLen = spec.size * SIZE * (0.8 + hash(t * 17) * 0.6);
      ctx.beginPath();
      ctx.moveTo(bx, crownY);
      const tipX = bx + Math.cos(ta) * tLen;
      const tipY = crownY + Math.sin(ta) * tLen * 0.5 - tLen * 0.3;
      ctx.quadraticCurveTo(
        bx + Math.cos(ta) * tLen * 0.5, crownY - tLen * 0.4,
        tipX, tipY
      );
      ctx.strokeStyle = t % 2 === 0 ? spec.color.center : spec.color.tip;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Tip dot
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.tip;
      ctx.fill();
    }
  } else if (spec.type === 'sun') {
    for (let i = 0; i < spec.count; i++) {
      const px = cx + (hash(i * 17) - 0.5) * SIZE * 0.5;
      const py = cy + (hash(i * 23) - 0.5) * SIZE * 0.35;
      const pr = spec.size * SIZE;
      // Center
      ctx.beginPath();
      ctx.arc(px, py, pr * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.center;
      ctx.fill();
      // Tentacles radiating out
      for (let t = 0; t < 12; t++) {
        const ta = (t / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(ta) * pr * 0.3, py + Math.sin(ta) * pr * 0.3);
        ctx.lineTo(px + Math.cos(ta) * pr, py + Math.sin(ta) * pr);
        ctx.strokeStyle = spec.color.mid;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        // Tip ball
        ctx.beginPath();
        ctx.arc(px + Math.cos(ta) * pr, py + Math.sin(ta) * pr, 2, 0, Math.PI * 2);
        ctx.fillStyle = spec.color.center;
        ctx.fill();
      }
    }
  }

  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(name, 10, SIZE - 10);
  return canvas;
}

function drawSinglePolyp(ctx, x, y, r, spec, seed) {
  if (spec.type === 'star') {
    const arms = 6;
    ctx.beginPath();
    for (let i = 0; i <= arms * 2; i++) {
      const a = (i / (arms * 2)) * Math.PI * 2;
      const pr = i % 2 === 0 ? r : r * 0.4;
      const px = x + Math.cos(a) * pr;
      const py = y + Math.sin(a) * pr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = spec.color.mid;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.center;
    ctx.fill();
  } else if (spec.type === 'bubble_disc') {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.mid;
    ctx.fill();
    // Tiny bubbles on surface
    for (let b = 0; b < 6; b++) {
      const ba = hash(seed * 100 + b) * Math.PI * 2;
      const bd = hash(seed * 200 + b) * r * 0.6;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ba) * bd, y + Math.sin(ba) * bd, r * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.center + 'aa';
      ctx.fill();
    }
  } else {
    // Disc polyp
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.mid;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.center;
    ctx.fill();
    ctx.strokeStyle = spec.color.base;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function drawTentacle(ctx, x, y, angle, len, width, spec) {
  const segs = 8;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * spec.size * SIZE * 0.4, y + Math.sin(angle) * spec.size * SIZE * 0.4);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const sway = Math.sin(t * 3 + angle * 2) * len * 0.08;
    const px = x + Math.cos(angle + sway * 0.1) * (spec.size * SIZE * 0.4 + len * t);
    const py = y + Math.sin(angle + sway * 0.1) * (spec.size * SIZE * 0.4 + len * t);
    ctx.lineTo(px, py);
  }
  ctx.strokeStyle = spec.color.mid;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Tip
  const tipX = x + Math.cos(angle) * (spec.size * SIZE * 0.4 + len);
  const tipY = y + Math.sin(angle) * (spec.size * SIZE * 0.4 + len);
  if (spec.hammerTips) {
    // T-shaped hammer tip
    const perp = angle + Math.PI / 2;
    const hw = width * 2.5;
    ctx.beginPath();
    ctx.moveTo(tipX + Math.cos(perp) * hw, tipY + Math.sin(perp) * hw);
    ctx.lineTo(tipX - Math.cos(perp) * hw, tipY - Math.sin(perp) * hw);
    ctx.strokeStyle = spec.color.tip;
    ctx.lineWidth = width * 0.8;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(tipX, tipY, width * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.tip;
    ctx.fill();
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
  const outDir = args.out || 'output/rocks/geometry/';
  fs.mkdirSync(outDir, { recursive: true });

  const entries = [];
  let idx = 1;

  // Rocks
  for (const [name, spec] of Object.entries(ROCKS)) {
    const num = String(idx).padStart(3, '0');
    const canvas = renderRock(name, spec);
    const outPath = path.join(outDir, `rock_${num}_${name}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(`  ✓ ${outPath}`);
    entries.push({ name, canvas });
    idx++;
  }

  // Polyps
  for (const [name, spec] of Object.entries(POLYPS)) {
    const num = String(idx).padStart(3, '0');
    const canvas = renderPolyp(name, spec);
    const outPath = path.join(outDir, `polyp_${num}_${name}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(`  ✓ ${outPath}`);
    entries.push({ name, canvas });
    idx++;
  }

  // Contact sheet
  const cols = 8, tile = 256;
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
  fs.writeFileSync(path.join(sheetDir, 'sheet_001_rocks_polyps.png'), sheet.toBuffer('image/png'));
  console.log(`  ✓ ${path.join(sheetDir, 'sheet_001_rocks_polyps.png')} (contact sheet)`);
}

main().catch(console.error);
