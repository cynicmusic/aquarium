#!/usr/bin/env node
/**
 * gen_critters.js — Generates aquarium critters (invertebrates, etc.) at visible scale
 * Usage: node agents/tools/gen_critters.js --all --out output/critters/geometry/
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;
const PAD = 60;

function hash(x) { return ((Math.sin(x * 127.1) * 43758.5453) % 1 + 1) % 1; }

const CRITTERS = {
  // ── Shrimp (6) ──
  cleanerShrimp: { name: 'Cleaner Shrimp', type: 'shrimp',
    color: { body: '#cc3333', stripe: '#ffffff', legs: '#ffcccc', antenna: '#ffffff' },
    bodyLen: 0.60, curve: 0.35, legCount: 5, antennaLen: 0.50, whiteStripe: true, longAntennae: true },
  fireShrimp: { name: 'Fire Shrimp', type: 'shrimp',
    color: { body: '#ee0000', stripe: '#ee0000', legs: '#ff4444', antenna: '#ffffff' },
    bodyLen: 0.55, curve: 0.30, legCount: 5, antennaLen: 0.40, whiteSpots: true },
  pistolShrimp: { name: 'Pistol Shrimp', type: 'shrimp',
    color: { body: '#886644', stripe: '#aa8866', legs: '#997755', antenna: '#bbaa88' },
    bodyLen: 0.45, curve: 0.2, legCount: 5, antennaLen: 0.25, bigClaw: true, giantClaw: true },
  peppermintShrimp: { name: 'Peppermint Shrimp', type: 'shrimp',
    color: { body: '#ffdddd', stripe: '#cc3333', legs: '#ffcccc', antenna: '#ff8888' },
    bodyLen: 0.50, curve: 0.35, legCount: 5, antennaLen: 0.30, transparent: true, redStripes: true },
  amanoShrimp: { name: 'Amano Shrimp', type: 'shrimp',
    color: { body: '#ccccaa', stripe: '#887766', legs: '#bbbb99', antenna: '#aa9988' },
    bodyLen: 0.40, curve: 0.2, legCount: 5, antennaLen: 0.25 },
  cherryShrimp: { name: 'Cherry Shrimp', type: 'shrimp',
    color: { body: '#ee2222', stripe: '#ff4444', legs: '#dd3333', antenna: '#ff5555' },
    bodyLen: 0.35, curve: 0.25, legCount: 5, antennaLen: 0.20 },

  // ── Crabs (4) ──
  hermitCrab: { name: 'Hermit Crab', type: 'crab',
    color: { body: '#cc6633', shell: '#887755', legs: '#dd7744', claw: '#ee8855' },
    bodySize: 0.30, legCount: 4, hasShell: true },
  emeraldCrab: { name: 'Emerald Crab', type: 'crab',
    color: { body: '#226633', shell: '#338844', legs: '#227733', claw: '#339944' },
    bodySize: 0.25, legCount: 4, hasShell: false },
  porcelainCrab: { name: 'Porcelain Crab', type: 'crab',
    color: { body: '#ddccbb', shell: '#eeddcc', legs: '#ccbbaa', claw: '#bbaa99' },
    bodySize: 0.20, legCount: 3, hasShell: false },
  arrowCrab: { name: 'Arrow Crab', type: 'crab',
    color: { body: '#aa8866', shell: '#bb9977', legs: '#997755', claw: '#886644' },
    bodySize: 0.15, legCount: 5, hasShell: false, longLegs: true },

  // ── Snails (5) ──
  turboSnail: { name: 'Turbo Snail', type: 'snail',
    color: { shell: '#667755', body: '#888877', spiral: '#556644' },
    shellSize: 0.35, shellType: 'turbo' },
  nassariusSnail: { name: 'Nassarius Snail', type: 'snail',
    color: { shell: '#998877', body: '#aa9988', spiral: '#887766' },
    shellSize: 0.20, shellType: 'cone' },
  nerite: { name: 'Nerite Snail', type: 'snail',
    color: { shell: '#443322', body: '#665544', spiral: '#ffcc44' },
    shellSize: 0.15, shellType: 'round', striped: true },
  cerith: { name: 'Cerith Snail', type: 'snail',
    color: { shell: '#776655', body: '#887766', spiral: '#665544' },
    shellSize: 0.25, shellType: 'tall' },
  conchSnail: { name: 'Conch', type: 'snail',
    color: { shell: '#cc9977', body: '#ddaa88', spiral: '#bb8866' },
    shellSize: 0.45, shellType: 'conch' },

  // ── Starfish (4) ──
  blueLinckia: { name: 'Blue Linckia', type: 'starfish',
    color: { body: '#2255cc', tip: '#3366dd' }, arms: 5, armLen: 0.36, armWidth: 0.06 },
  redKnob: { name: 'Red Knob Star', type: 'starfish',
    color: { body: '#cc4444', tip: '#ff6666' }, arms: 5, armLen: 0.32, armWidth: 0.08, knobs: true },
  sandStar: { name: 'Sand Sifting Star', type: 'starfish',
    color: { body: '#bbaa88', tip: '#ccbb99' }, arms: 5, armLen: 0.40, armWidth: 0.05 },
  brittleStar: { name: 'Brittle Star', type: 'starfish',
    color: { body: '#554433', tip: '#776655' }, arms: 5, armLen: 0.44, armWidth: 0.03, serpentine: true },

  // ── Sea Urchins (3) ──
  longSpineUrchin: { name: 'Long Spine Urchin', type: 'urchin',
    color: { body: '#111111', spine: '#222222' }, bodyR: 0.16, spineLen: 0.40, spineCount: 40 },
  pencilUrchin: { name: 'Pencil Urchin', type: 'urchin',
    color: { body: '#884444', spine: '#aa6666' }, bodyR: 0.20, spineLen: 0.24, spineCount: 20, thick: true },
  tuxedoUrchin: { name: 'Tuxedo Urchin', type: 'urchin',
    color: { body: '#222244', spine: '#4444cc' }, bodyR: 0.16, spineLen: 0.12, spineCount: 50 },

  // ── Misc (10) ──
  seaCucumber: { name: 'Sea Cucumber', type: 'worm',
    color: { body: '#553322', spot: '#664433' }, length: 0.75, width: 0.15 },
  featherWorm: { name: 'Christmas Tree Worm', type: 'worm',
    color: { body: '#dd6600', spiral: '#ff8822', tube: '#887766' }, length: 0.25, spiral: true },
  nudibranch: { name: 'Nudibranch', type: 'nudibranch',
    color: { body: '#8822cc', cerata: '#ff6600', cerataTip: '#ffdd00', rhinophore: '#ffaa00', gill: '#ff66dd' }, length: 0.40 },
  seaSlug: { name: 'Lettuce Sea Slug', type: 'slug',
    color: { body: '#44aa44', gill: '#66cc66', rhinophore: '#88ee88' }, length: 0.30, ruffled: true },
  clam: { name: 'Maxima Clam', type: 'bivalve',
    color: { shell: '#4466aa', mantle: '#2288ff', lip: '#66aaff' }, width: 0.40 },
  scallop: { name: 'Flame Scallop', type: 'bivalve',
    color: { shell: '#cc3333', mantle: '#ff4444', lip: '#ff8888' }, width: 0.30, tentacles: true },
  lobster: { name: 'Spiny Lobster', type: 'shrimp',
    color: { body: '#884422', stripe: '#aa6644', legs: '#775533', antenna: '#cc8855' },
    bodyLen: 0.70, curve: 0.15, legCount: 5, antennaLen: 0.60 },
  barnacle: { name: 'Barnacle Cluster', type: 'barnacle',
    color: { shell: '#ccccbb', opening: '#888877' }, count: 8 },
  decoratorCrab: { name: 'Decorator Crab', type: 'crab',
    color: { body: '#667744', shell: '#889966', legs: '#556633', claw: '#778855' },
    bodySize: 0.22, legCount: 4, hasShell: false, decorated: true },
  mantisShrimp: { name: 'Mantis Shrimp', type: 'shrimp',
    color: { body: '#33aa55', stripe: '#ff4444', legs: '#22bb44', antenna: '#44cc66' },
    bodyLen: 0.60, curve: 0.1, legCount: 5, antennaLen: 0.30, bigClaw: true, rainbow: true, clubs: true },
};

function renderCritter(name, spec) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2, cy = SIZE / 2;

  if (spec.type === 'shrimp') drawShrimp(ctx, cx, cy, spec);
  else if (spec.type === 'crab') drawCrab(ctx, cx, cy, spec);
  else if (spec.type === 'snail') drawSnail(ctx, cx, cy, spec);
  else if (spec.type === 'starfish') drawStarfish(ctx, cx, cy, spec);
  else if (spec.type === 'urchin') drawUrchin(ctx, cx, cy, spec);
  else if (spec.type === 'worm') drawWorm(ctx, cx, cy, spec);
  else if (spec.type === 'slug') drawSlug(ctx, cx, cy, spec);
  else if (spec.type === 'nudibranch') drawNudibranch(ctx, cx, cy, spec);
  else if (spec.type === 'bivalve') drawBivalve(ctx, cx, cy, spec);
  else if (spec.type === 'barnacle') drawBarnacles(ctx, cx, cy, spec);

  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(name, 10, SIZE - 10);
  return canvas;
}

function drawShrimp(ctx, cx, cy, spec) {
  const len = spec.bodyLen * SIZE;
  const curve = spec.curve;
  const segs = 12;
  const bodyH = len * 0.12;  // scaled body height

  // Antennae
  const aCount = spec.longAntennae ? 4 : 2;
  for (let a = 0; a < aCount; a++) {
    const aLen = spec.antennaLen * SIZE;
    const spread = (a - (aCount - 1) / 2) * 8;
    ctx.beginPath();
    ctx.moveTo(cx - len * 0.5, cy + spread);
    ctx.quadraticCurveTo(
      cx - len * 0.5 - aLen * 0.5, cy - aLen * 0.5 + spread * 1.5,
      cx - len * 0.5 - aLen, cy - aLen * 0.2 + spread * 2
    );
    ctx.strokeStyle = spec.color.antenna;
    ctx.lineWidth = spec.longAntennae ? 1.5 : 2;
    ctx.stroke();
  }

  // Body segments
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = cx - len * 0.5 + t * len;
    const y = cy + Math.sin(t * Math.PI) * len * curve;
    pts.push({x, y});
  }

  // Top curve
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y - bodyH);
  for (const p of pts) {
    const t = pts.indexOf(p) / segs;
    const width = bodyH * (1 - Math.abs(t - 0.4) * 1.2);
    ctx.lineTo(p.x, p.y - Math.max(width, bodyH * 0.3));
  }
  // Bottom curve (reversed)
  for (const p of [...pts].reverse()) ctx.lineTo(p.x, p.y + bodyH * 0.7);
  ctx.closePath();

  if (spec.transparent) {
    // Peppermint: semi-transparent body
    ctx.fillStyle = spec.color.body + '66';
    ctx.fill();
    ctx.strokeStyle = spec.color.body + 'aa';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (spec.rainbow) {
    // Mantis shrimp: rainbow segments
    const segColors = ['#dd2222', '#ff6600', '#ffcc00', '#33cc33', '#2266dd', '#8833cc', '#dd2222', '#ff6600', '#ffcc00', '#33cc33', '#2266dd', '#8833cc'];
    for (let i = 0; i < segs; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      ctx.beginPath();
      const t0 = i / segs, t1 = (i + 1) / segs;
      const w0 = bodyH * (1 - Math.abs(t0 - 0.4) * 1.2);
      const w1 = bodyH * (1 - Math.abs(t1 - 0.4) * 1.2);
      ctx.moveTo(p0.x, p0.y - Math.max(w0, bodyH * 0.3));
      ctx.lineTo(p1.x, p1.y - Math.max(w1, bodyH * 0.3));
      ctx.lineTo(p1.x, p1.y + bodyH * 0.7);
      ctx.lineTo(p0.x, p0.y + bodyH * 0.7);
      ctx.closePath();
      ctx.fillStyle = segColors[i % segColors.length];
      ctx.fill();
      ctx.strokeStyle = '#00000033';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  } else {
    const grad = ctx.createLinearGradient(cx - len/2, 0, cx + len/2, 0);
    grad.addColorStop(0, spec.color.body);
    grad.addColorStop(0.5, spec.color.stripe);
    grad.addColorStop(1, spec.color.body);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = spec.color.body;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // White stripe along back (cleaner shrimp)
  if (spec.whiteStripe) {
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = pts[i];
      const w = bodyH * (1 - Math.abs(t - 0.4) * 1.2);
      const topY = p.y - Math.max(w, bodyH * 0.3);
      if (i === 0) ctx.moveTo(p.x, topY + 2);
      else ctx.lineTo(p.x, topY + 2);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // White spots (fire shrimp)
  if (spec.whiteSpots) {
    for (let i = 0; i < 8; i++) {
      const t = 0.15 + hash(i * 19) * 0.7;
      const idx = Math.floor(t * segs);
      const p = pts[Math.min(idx, pts.length - 1)];
      ctx.beginPath();
      ctx.arc(p.x, p.y - bodyH * 0.2, 3 + hash(i * 23) * 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  // Red stripes (peppermint shrimp)
  if (spec.redStripes) {
    for (let i = 1; i < segs; i += 2) {
      const p = pts[i];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - bodyH);
      ctx.lineTo(p.x, p.y + bodyH * 0.7);
      ctx.strokeStyle = spec.color.stripe;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // Segment lines for all shrimp
  for (let i = 1; i < segs; i++) {
    const p = pts[i];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - bodyH * 0.5);
    ctx.lineTo(p.x, p.y + bodyH * 0.4);
    ctx.strokeStyle = '#00000022';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Legs
  const legLen = len * 0.15;
  for (let l = 0; l < spec.legCount; l++) {
    const t = 0.2 + l * 0.12;
    const idx = Math.floor(t * segs);
    const p = pts[Math.min(idx, pts.length - 1)];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + bodyH * 0.5);
    ctx.lineTo(p.x - 4, p.y + bodyH * 0.5 + legLen + l * 3);
    ctx.lineTo(p.x + 3, p.y + bodyH * 0.5 + legLen + l * 3 + 3);
    ctx.strokeStyle = spec.color.legs;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Claws
  if (spec.bigClaw) {
    const clawSize = spec.giantClaw ? len * 0.18 : len * 0.10;
    const smallClaw = spec.giantClaw ? clawSize * 0.35 : clawSize * 0.8;
    // Big claw
    ctx.beginPath();
    ctx.ellipse(cx - len * 0.42, cy - bodyH * 1.5, clawSize, clawSize * 0.6, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.body;
    ctx.fill();
    ctx.strokeStyle = '#00000044';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Small claw (other side)
    ctx.beginPath();
    ctx.ellipse(cx - len * 0.35, cy - bodyH * 2.2, smallClaw, smallClaw * 0.6, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.body;
    ctx.fill();
    ctx.stroke();
  }

  // Clubs (mantis shrimp raptorial appendages)
  if (spec.clubs) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const clubX = cx - len * 0.38;
      const clubY = cy - bodyH * 1.8 + side * 12;
      ctx.moveTo(clubX, clubY);
      ctx.lineTo(clubX - len * 0.08, clubY - 5);
      ctx.lineTo(clubX - len * 0.12, clubY);
      ctx.lineTo(clubX - len * 0.08, clubY + 5);
      ctx.closePath();
      ctx.fillStyle = '#ff4444';
      ctx.fill();
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Eye
  const eyeR = Math.max(4, len * 0.02);
  ctx.beginPath();
  ctx.arc(cx - len * 0.48, cy - bodyH * 1.3, eyeR, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - len * 0.48 + 1, cy - bodyH * 1.3 - 1, eyeR * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#666';
  ctx.fill();

  // Tail fan (scaled)
  const tail = pts[pts.length - 1];
  const fanSize = len * 0.08;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(tail.x + fanSize * 1.2, tail.y - fanSize);
  ctx.lineTo(tail.x + fanSize * 1.5, tail.y);
  ctx.lineTo(tail.x + fanSize * 1.2, tail.y + fanSize);
  ctx.closePath();
  ctx.fillStyle = spec.color.body + 'cc';
  ctx.fill();
}

function drawCrab(ctx, cx, cy, spec) {
  const r = spec.bodySize * SIZE;
  // Body
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = spec.color.body;
  ctx.fill();
  ctx.strokeStyle = spec.color.shell;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (spec.hasShell) {
    ctx.beginPath();
    ctx.arc(cx + 2, cy - r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.shell;
    ctx.fill();
    ctx.stroke();
  }

  // Legs
  for (let l = 0; l < spec.legCount; l++) {
    for (const side of [-1, 1]) {
      const angle = -0.3 + l * 0.35;
      const legLen = spec.longLegs ? r * 2.5 : r * 1.5;
      const lx = cx + side * r * 0.8;
      ctx.beginPath();
      ctx.moveTo(lx, cy + 2);
      ctx.quadraticCurveTo(lx + side * legLen * 0.5, cy + legLen * 0.3 * Math.sin(angle), lx + side * legLen * Math.cos(angle), cy + legLen * 0.6);
      ctx.strokeStyle = spec.color.legs;
      ctx.lineWidth = spec.longLegs ? 1 : 2;
      ctx.stroke();
    }
  }

  // Claws
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const clawX = cx + side * r * 1.3;
    ctx.ellipse(clawX, cy - r * 0.3, r * 0.4, r * 0.25, side * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.claw;
    ctx.fill();
    ctx.strokeStyle = spec.color.body;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Decorations (decorator crab: bits of sponge/algae on body)
  if (spec.decorated) {
    const decoColors = ['#44aa44', '#88cc44', '#aa7733', '#cc6688', '#88aacc'];
    for (let i = 0; i < 12; i++) {
      const dx = cx + (hash(i * 17) - 0.5) * r * 1.4;
      const dy = cy + (hash(i * 23) - 0.5) * r * 0.9;
      ctx.beginPath();
      ctx.arc(dx, dy, 4 + hash(i * 31) * 6, 0, Math.PI * 2);
      ctx.fillStyle = decoColors[i % decoColors.length] + 'cc';
      ctx.fill();
    }
  }

  // Eyes
  const eyeR = Math.max(3, r * 0.06);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.35, cy - r * 0.6, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  }
}

function drawSnail(ctx, cx, cy, spec) {
  const r = spec.shellSize * SIZE;

  // Shell shape varies by type
  ctx.beginPath();
  if (spec.shellType === 'tall') {
    // Cerith: tall pointed cone
    ctx.moveTo(cx, cy - r * 1.2);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.3);
    ctx.quadraticCurveTo(cx + r * 0.3, cy + r * 0.5, cx, cy + r * 0.4);
    ctx.quadraticCurveTo(cx - r * 0.3, cy + r * 0.5, cx - r * 0.5, cy + r * 0.3);
    ctx.closePath();
    const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r * 0.4);
    grad.addColorStop(0, spec.color.spiral);
    grad.addColorStop(1, spec.color.shell);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = spec.color.shell;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Horizontal ridges on cone
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const ry = cy - r * 1.2 + t * r * 1.5;
      const rw = r * 0.5 * t;
      ctx.beginPath();
      ctx.moveTo(cx - rw, ry);
      ctx.lineTo(cx + rw, ry);
      ctx.strokeStyle = spec.color.spiral + '88';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else if (spec.shellType === 'conch') {
    // Conch: large with flared lip
    ctx.ellipse(cx, cy, r, r * 0.65, 0.15, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, spec.color.spiral);
    grad.addColorStop(1, spec.color.shell);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = spec.color.shell;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Flared lip
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy + r * 0.5);
    ctx.quadraticCurveTo(cx - r * 0.8, cy + r * 0.9, cx - r * 0.2, cy + r * 0.85);
    ctx.quadraticCurveTo(cx + r * 0.3, cy + r * 1.0, cx + r * 0.5, cy + r * 0.6);
    ctx.strokeStyle = '#ffbb99';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Interior pink lip color
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.15, r * 0.35, r * 0.2, 0.2, 0.3, Math.PI - 0.3);
    ctx.fillStyle = '#ffaa88';
    ctx.fill();
  } else if (spec.shellType === 'round') {
    // Nerite: small round
    ctx.arc(cx, cy - r * 0.1, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, spec.color.spiral);
    grad.addColorStop(1, spec.color.shell);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = spec.color.shell;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Turbo: wide round spiral
    ctx.arc(cx, cy - r * 0.15, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.4, r * 0.1, cx, cy, r);
    grad.addColorStop(0, spec.color.spiral);
    grad.addColorStop(1, spec.color.shell);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = spec.color.shell;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Spiral lines (not for tall/cone types)
  if (spec.shellType !== 'tall') {
    ctx.strokeStyle = spec.color.spiral + '88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 5; t += 0.08) {
      const sr = r * 0.85 * (1 - t / (Math.PI * 5));
      const sx = cx + Math.cos(t) * sr * 0.5;
      const sy = cy - r * 0.15 + Math.sin(t) * sr * 0.4;
      if (t === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // Zigzag stripes (nerite)
  if (spec.striped) {
    ctx.strokeStyle = spec.color.spiral;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      const startX = cx + Math.cos(a) * r * 0.2;
      const startY = cy - r * 0.1 + Math.sin(a) * r * 0.15;
      ctx.moveTo(startX, startY);
      // Zigzag outward
      for (let z = 0; z < 4; z++) {
        const t = (z + 1) / 5;
        const zx = cx + Math.cos(a) * r * (0.2 + t * 0.7);
        const zy = cy - r * 0.1 + Math.sin(a) * r * (0.15 + t * 0.55) + ((z % 2) * 2 - 1) * 5;
        ctx.lineTo(zx, zy);
      }
      ctx.stroke();
    }
  }

  // Body (foot) — scaled
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.55, r * 1.1, r * 0.2, 0, 0, Math.PI);
  ctx.fillStyle = spec.color.body;
  ctx.fill();

  // Eye stalks — scaled
  const eyeStalkLen = r * 0.35;
  for (const side of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * r, cy + r * 0.15);
    ctx.lineTo(cx + side * r * 1.4, cy - r * 0.15);
    ctx.strokeStyle = spec.color.body;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + side * r * 1.4, cy - r * 0.15, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  }
}

function drawStarfish(ctx, cx, cy, spec) {
  for (let a = 0; a < spec.arms; a++) {
    const angle = (a / spec.arms) * Math.PI * 2 - Math.PI / 2;
    const len = spec.armLen * SIZE;
    const w = spec.armWidth * SIZE;

    if (spec.serpentine) {
      // Brittle star: thin wavy arms
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let t = 0; t <= 1; t += 0.05) {
        const wave = Math.sin(t * 6 + a) * w * 2;
        ctx.lineTo(cx + Math.cos(angle + wave * 0.01) * len * t, cy + Math.sin(angle + wave * 0.01) * len * t);
      }
      ctx.strokeStyle = spec.color.body;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      // Regular star arm
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle - 0.3) * w * 2, cy + Math.sin(angle - 0.3) * w * 2);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.lineTo(cx + Math.cos(angle + 0.3) * w * 2, cy + Math.sin(angle + 0.3) * w * 2);
      ctx.closePath();
      ctx.fillStyle = spec.color.body;
      ctx.fill();

      if (spec.knobs) {
        for (let k = 0.3; k < 1; k += 0.25) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * len * k, cy + Math.sin(angle) * len * k, w * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = spec.color.tip;
          ctx.fill();
        }
      }
    }
  }
  // Central disc
  ctx.beginPath();
  ctx.arc(cx, cy, spec.armWidth * SIZE * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = spec.color.body;
  ctx.fill();
}

function drawUrchin(ctx, cx, cy, spec) {
  // Spines first (behind body)
  for (let i = 0; i < spec.spineCount; i++) {
    const a = (i / spec.spineCount) * Math.PI * 2;
    const sLen = spec.spineLen * SIZE * (0.7 + hash(i * 13) * 0.3);
    const sW = spec.thick ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * spec.bodyR * SIZE, cy + Math.sin(a) * spec.bodyR * SIZE * 0.7);
    ctx.lineTo(cx + Math.cos(a + hash(i * 7) * 0.1) * (spec.bodyR * SIZE + sLen),
               cy + Math.sin(a + hash(i * 7) * 0.1) * (spec.bodyR * SIZE * 0.7 + sLen * 0.7));
    ctx.strokeStyle = spec.color.spine;
    ctx.lineWidth = sW;
    ctx.stroke();
  }
  // Body
  ctx.beginPath();
  ctx.ellipse(cx, cy, spec.bodyR * SIZE, spec.bodyR * SIZE * 0.7, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, spec.bodyR * SIZE);
  g.addColorStop(0, spec.color.spine);
  g.addColorStop(1, spec.color.body);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawWorm(ctx, cx, cy, spec) {
  if (spec.spiral) {
    // Christmas tree worm: two spiral crowns
    const crownR = spec.length * SIZE * 0.5;
    for (const side of [-1, 1]) {
      for (let t = 0; t < Math.PI * 6; t += 0.12) {
        const r = (1 - t / (Math.PI * 6)) * crownR;
        const x = cx + side * crownR * 0.3 + Math.cos(t) * r;
        const y = cy - t * (crownR * 0.04) - r * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = t % 1 < 0.5 ? spec.color.body : spec.color.spiral;
        ctx.fill();
      }
    }
    // Tube
    const tubeW = crownR * 0.15;
    ctx.beginPath();
    ctx.rect(cx - tubeW, cy, tubeW * 2, crownR * 0.6);
    ctx.fillStyle = spec.color.tube;
    ctx.fill();
    ctx.strokeStyle = '#00000033';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    // Sea cucumber: elongated blob
    const bodyLen = spec.length * SIZE * 0.5;
    const bodyW = spec.width * SIZE * 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, bodyLen, bodyW, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.body;
    ctx.fill();
    ctx.strokeStyle = '#00000022';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Bumps/spots
    for (let i = 0; i < 15; i++) {
      const sx = cx + (hash(i * 11) - 0.5) * bodyLen * 1.4;
      const sy = cy + (hash(i * 17) - 0.5) * bodyW * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + hash(i * 29) * 4, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.spot;
      ctx.fill();
    }
    // Mouth tentacles
    for (let t = 0; t < 8; t++) {
      const ta = (t / 8) * Math.PI - Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - bodyLen * 0.9, cy);
      ctx.lineTo(cx - bodyLen * 0.9 - 12 + Math.cos(ta) * 10, cy + Math.sin(ta) * 12);
      ctx.strokeStyle = spec.color.body + 'cc';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
}

function drawSlug(ctx, cx, cy, spec) {
  const len = spec.length * SIZE;
  const bodyH = len * 0.25;
  // Body
  ctx.beginPath();
  ctx.ellipse(cx, cy, len * 0.5, bodyH, 0, 0, Math.PI * 2);
  ctx.fillStyle = spec.color.body;
  ctx.fill();

  if (spec.ruffled) {
    // Ruffled edges — leafy parapodia
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const rx = cx + Math.cos(a) * len * 0.46;
      const ry = cy + Math.sin(a) * bodyH * 0.9;
      const ruffleR = 6 + Math.sin(a * 3) * 4;
      ctx.beginPath();
      ctx.arc(rx, ry, ruffleR, 0, Math.PI * 2);
      ctx.fillStyle = spec.color.gill + 'aa';
      ctx.fill();
    }
  }

  // Gills (back tufts)
  const gillR = len * 0.08;
  for (let g = 0; g < 8; g++) {
    const ga = (g / 8) * Math.PI - Math.PI * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + len * 0.2, cy);
    ctx.lineTo(cx + len * 0.2 + Math.cos(ga) * gillR, cy + Math.sin(ga) * gillR);
    ctx.strokeStyle = spec.color.gill;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Rhinophores (head tentacles)
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx - len * 0.4, cy);
    ctx.lineTo(cx - len * 0.52, cy + side * 15 - 12);
    ctx.strokeStyle = spec.color.rhinophore;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Eye dots
  ctx.beginPath();
  ctx.arc(cx - len * 0.38, cy - 3, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();
}

function drawNudibranch(ctx, cx, cy, spec) {
  const len = spec.length * SIZE;
  const bodyW = len * 0.5;
  const bodyH = len * 0.2;

  // Body — elongated oval with tapered ends
  ctx.beginPath();
  ctx.moveTo(cx - bodyW, cy);
  ctx.bezierCurveTo(cx - bodyW, cy - bodyH, cx - bodyW * 0.3, cy - bodyH * 1.2, cx, cy - bodyH * 0.8);
  ctx.bezierCurveTo(cx + bodyW * 0.3, cy - bodyH * 1.2, cx + bodyW, cy - bodyH, cx + bodyW, cy);
  ctx.bezierCurveTo(cx + bodyW, cy + bodyH * 0.5, cx + bodyW * 0.3, cy + bodyH * 0.8, cx, cy + bodyH * 0.6);
  ctx.bezierCurveTo(cx - bodyW * 0.3, cy + bodyH * 0.8, cx - bodyW, cy + bodyH * 0.5, cx - bodyW, cy);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(cx - bodyW, cy, cx + bodyW, cy);
  bodyGrad.addColorStop(0, '#7718aa');
  bodyGrad.addColorStop(0.3, spec.color.body);
  bodyGrad.addColorStop(0.7, spec.color.body);
  bodyGrad.addColorStop(1, '#7718aa');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = '#661199';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Body pattern — spots/patches
  for (let i = 0; i < 12; i++) {
    const px = cx + (hash(i * 13) - 0.5) * bodyW * 1.4;
    const py = cy + (hash(i * 19) - 0.5) * bodyH * 0.8;
    ctx.beginPath();
    ctx.arc(px, py, 3 + hash(i * 7) * 5, 0, Math.PI * 2);
    ctx.fillStyle = '#bb66ee44';
    ctx.fill();
  }

  // Cerata — spiky colorful protrusions along back
  const cerataCount = 14;
  for (let i = 0; i < cerataCount; i++) {
    const t = (i / (cerataCount - 1)) * 0.7 + 0.15;  // spread along body
    const side = (i % 2) * 2 - 1;
    const baseX = cx - bodyW + t * bodyW * 2;
    const baseY = cy - bodyH * 0.5;
    const cerataLen = bodyH * 1.2 + hash(i * 31) * bodyH * 0.6;
    const tipX = baseX + side * 5 + hash(i * 41) * 6;
    const tipY = baseY - cerataLen;
    const sway = side * 3;

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX + sway, baseY - cerataLen * 0.6, tipX, tipY);
    ctx.strokeStyle = spec.color.cerata;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Bright tip
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.cerataTip;
    ctx.fill();
  }

  // Rhinophores — two horn-like antennae on head
  for (const side of [-1, 1]) {
    const rhX = cx - bodyW * 0.75;
    const rhY = cy - bodyH * 0.3;
    const tipX = rhX - bodyW * 0.12 + side * bodyW * 0.08;
    const tipY = rhY - bodyH * 1.8;

    // Stalk
    ctx.beginPath();
    ctx.moveTo(rhX + side * 4, rhY);
    ctx.quadraticCurveTo(rhX + side * 6, rhY - bodyH * 1.0, tipX, tipY);
    ctx.strokeStyle = spec.color.rhinophore;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Club-like tip
    ctx.beginPath();
    ctx.ellipse(tipX, tipY, 4, 7, side * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.rhinophore;
    ctx.fill();

    // Lamellae (horizontal lines on rhinophore)
    for (let l = 0; l < 4; l++) {
      const ly = tipY + 2 + l * 3;
      ctx.beginPath();
      ctx.moveTo(tipX - 3, ly);
      ctx.lineTo(tipX + 3, ly);
      ctx.strokeStyle = '#cc880088';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // Branchial plume (gill tuft on back, rear)
  for (let g = 0; g < 8; g++) {
    const ga = (g / 8) * Math.PI * 1.5 - Math.PI * 0.75;
    const gillX = cx + bodyW * 0.4;
    const gillY = cy - bodyH * 0.3;
    ctx.beginPath();
    ctx.moveTo(gillX, gillY);
    ctx.lineTo(gillX + Math.cos(ga) * bodyH * 0.8, gillY + Math.sin(ga) * bodyH * 0.8);
    ctx.strokeStyle = spec.color.gill;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Eye dots
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx - bodyW * 0.68, cy - bodyH * 0.1 + side * 3, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  }

  // Foot (underside visible at edges)
  ctx.beginPath();
  ctx.ellipse(cx, cy + bodyH * 0.5, bodyW * 0.9, bodyH * 0.15, 0, 0, Math.PI);
  ctx.fillStyle = '#ddbbee44';
  ctx.fill();
}

function drawBivalve(ctx, cx, cy, spec) {
  const w = spec.width * SIZE;
  // Two shell halves
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + side * 2, w * 0.5, w * 0.8, 0, side > 0 ? 0 : Math.PI, side > 0 ? Math.PI : Math.PI * 2);
    ctx.fillStyle = spec.color.shell;
    ctx.fill();
    ctx.strokeStyle = spec.color.lip;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ridges
    for (let r = 0.3; r < 0.9; r += 0.15) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + side * 2, w * 0.5 * r, w * 0.8 * r, 0, side > 0 ? 0.1 : Math.PI + 0.1, side > 0 ? Math.PI - 0.1 : Math.PI * 2 - 0.1);
      ctx.strokeStyle = spec.color.lip + '44';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
  // Mantle visible between shells
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.45, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = spec.color.mantle;
  ctx.fill();

  if (spec.tentacles) {
    const tentLen = w * 0.15;
    for (let t = 0; t < 16; t++) {
      const ta = (t / 16) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * w * 0.4, cy);
      ctx.lineTo(cx + Math.cos(ta) * w * 0.55, cy - tentLen + Math.sin(ta + t) * tentLen * 0.4);
      ctx.strokeStyle = spec.color.lip;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
}

function drawBarnacles(ctx, cx, cy, spec) {
  for (let i = 0; i < spec.count; i++) {
    const bx = cx + (hash(i * 17) - 0.5) * SIZE * 0.3;
    const by = cy + (hash(i * 23) - 0.5) * SIZE * 0.15 + SIZE * 0.15;
    const br = 8 + hash(i * 31) * 12;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = spec.color.shell;
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bx, by, br * 0.3, br * 0.15, hash(i * 41), 0, Math.PI * 2);
    ctx.fillStyle = spec.color.opening;
    ctx.fill();
  }
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
  const outDir = args.out || 'output/critters/geometry/';
  fs.mkdirSync(outDir, { recursive: true });
  let idx = 1;
  const entries = [];
  for (const [name, spec] of Object.entries(CRITTERS)) {
    const num = String(idx).padStart(3, '0');
    const canvas = renderCritter(name, spec);
    const outPath = path.join(outDir, `critter_${num}_${name}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({ name, type: spec.type }, null, 2));
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
    sCtx.fillStyle = '#888'; sCtx.font = 'bold 9px monospace';
    sCtx.fillText(name, col * tile + 4, row * (tile + 20) + tile + 14);
  });
  const sheetDir = path.join(outDir, '../sheets/');
  fs.mkdirSync(sheetDir, { recursive: true });
  fs.writeFileSync(path.join(sheetDir, 'sheet_001_critters.png'), sheet.toBuffer('image/png'));
  console.log(`  ✓ sheet_001_critters.png (contact sheet)`);
}

main().catch(console.error);
