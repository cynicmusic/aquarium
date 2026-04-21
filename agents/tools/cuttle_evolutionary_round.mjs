#!/usr/bin/env node
/**
 * cuttle_evolutionary_round.mjs
 *
 * Runs one round of the cuttlefish evolutionary loop.
 *
 *  • 4 candidates labelled A / B / C / D, each its own param stack.
 *  • Each candidate rendered at 4 views (SIDE / FRONT / TOP / 3-QUARTER).
 *  • 16 tiles composited into a single labelled sheet.
 *  • Sheet → agents/progress/rounds/round_NNN.png
 *    Params → agents/progress/rounds/round_NNN_params.json
 *    Seed-for-next →   …/latest_params.json (updated after vote is cast)
 *
 * The param stack for each candidate is pushed to the preview page via
 *   ?cfg=<base64 JSON>&yaw=…&pitch=…&autoRotate=0
 * which bypasses the slider UI entirely.
 *
 * Rules (see agents/plans/evolutionary_loop.md):
 *   - NEVER mutate locked skin uniforms.
 *   - Mutations are moderate (±15–25%) from the seed.
 *   - Each candidate carries a "hypothesis" string describing what structural
 *     problem it's trying to solve — that's what the critic ranks against.
 */

import { chromium } from 'playwright';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const ROUNDS_DIR = path.join(ROOT, 'agents', 'progress', 'rounds');
const LATEST_PARAMS = path.join(ROUNDS_DIR, 'latest_params.json');

const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

// ── locked uniforms (must never appear in mutations) ───────────────────────
// Zebra is now UNLOCKED — the user wants texture variation. Keep the rest of
// the glow stack locked so the cuttlefish's iridescent character stays.
const LOCKED = new Set([
  'chromaDensity','chromaIntensity','iridoIntensity','iridoHueRange',
  'sparkleIntensity','leukoTint','skinTint','lightingBias',
]);

// ── seed resolution ────────────────────────────────────────────────────────
// If latest_params.json exists, that's the seed. Else use the current DEFAULTS
// (we re-declare them here so the runner is self-contained — kept in sync via
// the `agents/plans/evolutionary_loop.md` procedure).
// v2 seed (spline-lofted head replaces the dropped-in sphere). Matches the
// current DEFAULTS in src/entities/Cuttlefish.js.
const BASE_SEED = {
  mantleLength: 2.4, mantleRadius: 0.52, mantleHeight: 0.26, mantleTaper: 0.75,
  finWidth: 0.26, finRipples: 6, finRippleAmp: 0.075,
  finExtend: 1.0, finBumpFreq: 3.4, finBumpAmp: 0.45, finLateralAmp: 0.6,
  armLength: 0.8, armCurl: 0.6, armBaseRadius: 0.075, armCrownRadius: 0.12,
  tentacleLength: 1.6, tentacleExtension: 0.35,
  // Spline head (back→forehead→eye→cheek→mouth)
  headLength: 0.55, headTiltDown: 0.18, headBaseY: 0.20, headMouthY: -0.10,
  headBackR: 0.50, headBackH: 0.22,
  headForeheadR: 0.45, headForeheadH: 0.30,
  headEyeR: 0.50, headEyeH: 0.26,
  headCheekR: 0.32, headCheekH: 0.18,
  headMouthR: 0.12, headMouthH: 0.10,
  // Eye mounted on the lofted head at eyeStation along its length
  eyeRadius: 0.12, eyeStation: 0.40,
  eyeRiseY: 0.50, eyeLateralPad: -0.045,
  eyeTiltUp: 0.18, eyeForwardYaw: 0.30,
  pupilScaleW: 1.35, pupilScaleH: 0.75,
  armCrownRadius: 0.22,
  // LOCKED skin uniforms (do not mutate)
  chromaDensity: 88, chromaIntensity: 0.85,
  iridoIntensity: 2.0, iridoHueRange: 1.61,
  zebraIntensity: 0.85, zebraFrequency: 11, sparkleIntensity: 1.2,
  leukoTint: '#d8c8b2',
};

let seed = { ...BASE_SEED };
if (fs.existsSync(LATEST_PARAMS)) {
  try {
    const prev = JSON.parse(fs.readFileSync(LATEST_PARAMS, 'utf8'));
    seed = { ...seed, ...prev };
    console.log('[seed] loaded latest_params.json');
  } catch (e) { console.warn('[seed] failed to parse latest_params.json, using BASE_SEED'); }
}

// ── determine round number ────────────────────────────────────────────────
const existing = fs.existsSync(ROUNDS_DIR)
  ? fs.readdirSync(ROUNDS_DIR).filter(f => /^round_\d+\.png$/.test(f))
  : [];
const roundN = existing.length + 1;
const roundTag = String(roundN).padStart(3, '0');

// ── candidate generation ──────────────────────────────────────────────────
// Round 1 hypotheses are focused on HEAD SHAPE + EYE READABILITY (per plan).
// Each candidate bundles a dozen-ish coordinated mutations that push in a
// single direction. Following rounds, the plan loads a round_NNN_plan.json
// if present (so human/Claude can craft the hypotheses per-round).
const PLAN_PATH = path.join(ROUNDS_DIR, `round_${roundTag}_plan.json`);
let plan;
if (fs.existsSync(PLAN_PATH)) {
  plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
  console.log(`[plan] loaded ${PLAN_PATH}`);
} else {
  plan = defaultPlanFor(roundN);
  console.log(`[plan] using default plan for round ${roundN}`);
}

function mix(base, deltas) {
  const o = { ...base, ...deltas };
  for (const k of Object.keys(deltas)) {
    if (LOCKED.has(k)) {
      console.warn(`[warn] candidate tried to mutate LOCKED param '${k}' — reverting`);
      o[k] = base[k];
    }
  }
  return o;
}

function defaultPlanFor(n) {
  if (n === 1) {
    // Round 1 — head + eye focused. Each candidate is a clear hypothesis.
    return {
      focus: 'head shape + eye W-readability',
      candidates: {
        A: {
          hypothesis: 'LENS HEAD — flatter, wider head; eyes stay put',
          mutations: {
            headRadiusScale: 1.25, headSquashX: 0.82, headSquashY: 0.88,
            headPosOffsetX: -0.02, eyeLateralZ: 0.92,
          },
        },
        B: {
          hypothesis: 'INTEGRATED HEAD — smaller bulb, pushed into mantle, eyes forward',
          mutations: {
            headRadiusScale: 1.00, headSquashX: 0.78, headSquashY: 1.00,
            headPosOffsetX: -0.08, eyeForwardX: 0.12, eyeLateralPad: 0.20,
            eyeRiseY: 0.40,
          },
        },
        C: {
          hypothesis: 'TALL HEAD + EYES UP — vertical prominence, eyes tilted up',
          mutations: {
            headRadiusScale: 1.18, headSquashX: 0.68, headSquashY: 1.25,
            eyeRiseY: 0.80, eyeTiltUp: 0.55, eyeLateralPad: 0.35,
          },
        },
        D: {
          hypothesis: 'LONG MANTLE + RECESSED HEAD — body dominance, head tucked back',
          mutations: {
            mantleLength: 2.75, mantleTaper: 0.82,
            headRadiusScale: 1.10, headSquashX: 0.74, headSquashY: 1.00,
            headPosOffsetX: 0.15, eyeRiseY: 0.55,
          },
        },
      },
    };
  }
  // Fallback for rounds > 1 with no plan file — wiggle around the seed.
  const wig = (k, dPct) => seed[k] * (1 + (Math.random() - 0.5) * 2 * dPct);
  return {
    focus: 'seed wiggle (fallback)',
    candidates: {
      A: { hypothesis: 'wiggle +small', mutations: { mantleLength: wig('mantleLength', 0.1), headSquashX: wig('headSquashX', 0.1) } },
      B: { hypothesis: 'wiggle +med',   mutations: { mantleRadius: wig('mantleRadius', 0.15), eyeRiseY: wig('eyeRiseY', 0.2) } },
      C: { hypothesis: 'wiggle +y',     mutations: { headSquashY: wig('headSquashY', 0.15), eyeTiltUp: wig('eyeTiltUp', 0.2) } },
      D: { hypothesis: 'wiggle all',    mutations: { headRadiusScale: wig('headRadiusScale', 0.15), eyeForwardX: wig('eyeForwardX', 0.3), armCurl: wig('armCurl', 0.15) } },
    },
  };
}

const candidates = {};
for (const [letter, spec] of Object.entries(plan.candidates)) {
  candidates[letter] = { hypothesis: spec.hypothesis, params: mix(seed, spec.mutations), mutations: spec.mutations };
}

// ── views ─────────────────────────────────────────────────────────────────
const VIEWS = [
  { label: 'SIDE',  yaw: 0.0,          pitch: 0.0  },
  { label: 'FRONT', yaw: Math.PI / 2,  pitch: 0.0  },
  { label: 'TOP',   yaw: 0.0,          pitch: -1.2 },
  { label: '3/4',   yaw: Math.PI / 4,  pitch: -0.35 },
];

// ── headless render ───────────────────────────────────────────────────────
const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 800, height: 640 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));

const shots = {}; // shots[letter][viewLabel] = Buffer

for (const [letter, cand] of Object.entries(candidates)) {
  shots[letter] = {};
  const cfg = Buffer.from(JSON.stringify(cand.params)).toString('base64');
  for (const view of VIEWS) {
    const url = `http://localhost:3456/cuttlefish-preview.html?cfg=${cfg}&yaw=${view.yaw}&pitch=${view.pitch}&autoRotate=0`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    const buf = await page.screenshot({ fullPage: false });
    shots[letter][view.label] = buf;
    console.log(`  ${letter} · ${view.label} captured`);
  }
}
await browser.close();

// ── composite ────────────────────────────────────────────────────────────
const TILE_W = 520, TILE_H = 420, PAD = 10, COL_HEAD = 36, ROW_HEAD = 52;
const cols = VIEWS.length; // 4
const rows = Object.keys(candidates).length; // 4
const outW = ROW_HEAD + cols * (TILE_W + PAD) + PAD;
const outH = COL_HEAD + rows * (TILE_H + PAD) + PAD + 90; // +legend footer
const out = createCanvas(outW, outH);
const c = out.getContext('2d');
c.fillStyle = '#07080f';
c.fillRect(0, 0, out.width, out.height);

c.fillStyle = '#7bd';
c.font = 'bold 22px monospace';
c.fillText(`ROUND ${roundTag} — ${plan.focus}`, PAD, 28);

// Column headers (view labels)
c.fillStyle = '#9ab';
c.font = 'bold 16px monospace';
for (let vi = 0; vi < VIEWS.length; vi++) {
  const x = ROW_HEAD + PAD + vi * (TILE_W + PAD) + TILE_W / 2 - 24;
  c.fillText(VIEWS[vi].label, x, COL_HEAD - 6);
}

// Row headers (candidate letter) + tiles
const letters = Object.keys(candidates);
for (let ri = 0; ri < letters.length; ri++) {
  const L = letters[ri];
  const y0 = COL_HEAD + ri * (TILE_H + PAD);
  c.fillStyle = '#fe6';
  c.font = 'bold 40px monospace';
  c.fillText(L, 2, y0 + TILE_H / 2 + 14);

  for (let vi = 0; vi < VIEWS.length; vi++) {
    const V = VIEWS[vi];
    const x = ROW_HEAD + PAD + vi * (TILE_W + PAD);
    const img = await loadImage(shots[L][V.label]);
    const scale = Math.min(TILE_W / img.width, TILE_H / img.height);
    const w = img.width * scale, h = img.height * scale;
    c.drawImage(img, x + (TILE_W - w) / 2, y0 + (TILE_H - h) / 2, w, h);
  }
}

// Footer legend — hypotheses for each candidate
c.fillStyle = '#7bd';
c.font = 'bold 14px monospace';
c.fillText('HYPOTHESES', PAD, outH - 78);
c.fillStyle = '#cdd';
c.font = '13px monospace';
let ly = outH - 58;
for (const L of letters) {
  c.fillStyle = '#fe6';
  c.fillText(L, PAD, ly);
  c.fillStyle = '#cdd';
  c.fillText(candidates[L].hypothesis, PAD + 22, ly);
  ly += 16;
}

fs.mkdirSync(ROUNDS_DIR, { recursive: true });
const sheetPath  = path.join(ROUNDS_DIR, `round_${roundTag}.png`);
const paramsPath = path.join(ROUNDS_DIR, `round_${roundTag}_params.json`);
fs.writeFileSync(sheetPath, out.toBuffer('image/png'));

const snapshot = {
  round: roundN,
  focus: plan.focus,
  seed,
  candidates: Object.fromEntries(Object.entries(candidates).map(([L, c]) => [
    L, { hypothesis: c.hypothesis, mutations: c.mutations, params: c.params },
  ])),
};
fs.writeFileSync(paramsPath, JSON.stringify(snapshot, null, 2));

console.log('\n=== ROUND', roundTag, '===');
console.log('  sheet  →', sheetPath);
console.log('  params →', paramsPath);
console.log('\nNext steps:');
console.log('  1. User + critic + Claude force-rank A/B/C/D.');
console.log('  2. Run cuttle_vote.mjs <round> <user-ranking> to record votes & pick winner.');
console.log('  3. Winner\'s params are written to latest_params.json and live-popped.');
