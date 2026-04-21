#!/usr/bin/env node
/**
 * cuttle_apply_winner.mjs <round> <letter>
 *
 * After A/B/C/D have been voted on, call this with e.g. `003 B` to:
 *   - copy that candidate's params into agents/progress/rounds/latest_params.json
 *   - print the URL that pops the animated live preview with those params
 *
 * We don't auto-open from inside this tool — the caller (Claude) handles `open`
 * so it can choose to pop alongside the round sheet.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const ROUNDS_DIR = path.join(ROOT, 'agents', 'progress', 'rounds');

const [roundArg, letterArg] = process.argv.slice(2);
if (!roundArg || !letterArg) {
  console.error('usage: cuttle_apply_winner.mjs <round-number> <letter A|B|C|D>');
  process.exit(1);
}
const tag = String(roundArg).padStart(3, '0');
const letter = letterArg.toUpperCase();
const snapshotPath = path.join(ROUNDS_DIR, `round_${tag}_params.json`);
if (!fs.existsSync(snapshotPath)) {
  console.error('no snapshot for round', tag, '—', snapshotPath);
  process.exit(1);
}
const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const cand = snap.candidates[letter];
if (!cand) { console.error(`candidate ${letter} not in snapshot`); process.exit(1); }

const params = cand.params;
const latest = path.join(ROUNDS_DIR, 'latest_params.json');
fs.writeFileSync(latest, JSON.stringify(params, null, 2));
const cfg = Buffer.from(JSON.stringify(params)).toString('base64');
const url = `http://localhost:3456/cuttlefish-preview.html?cfg=${cfg}`;

console.log('winner:', letter, '—', cand.hypothesis);
console.log('params written to:', latest);
console.log('LIVE URL:', url);
