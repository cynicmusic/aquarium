/**
 * SwimWorld.js — the world that pops into existence when swim mode is on.
 *
 * Responsibilities:
 *   1. Scatter hundreds of plants + coral in a ring around the cuttle start
 *      point, density-biased toward the origin so near-field is full but
 *      far-field still has silhouettes dissolving into the fog.
 *   2. Spawn a small pod of fish (~8) at half the cuttle's apparent size,
 *      each on its own padded parallel oscillation path — they match cuttle
 *      speed on average but drift nearer/farther on their own cadences so
 *      they never look glued.
 *   3. Animate everything per frame from a single `.update(dt, elapsed)`.
 *   4. `.dispose()` cleanly removes + disposes everything on swim-off.
 *
 * Scatter field is a fixed-radius disc for MVP. Rolling-window respawn is
 * sketched in the class header below (see "ROLLING WINDOW — FUTURE") and
 * left un-implemented per user direction; the current scatter is generous
 * enough (~40u radius) that short swims don't run out of scenery.
 *
 * ROLLING WINDOW + DENSITY FIELD
 *   Per-frame pass over plants + coral recycles any entity that has drifted
 *   >REAR_THRESHOLD behind the cuttle (+x direction, since cuttle faces -x)
 *   to a fresh position AHEAD of the cuttle, with the landing x chosen by
 *   rejection-sampling against a sine-modulated density field so "forests"
 *   naturally cluster every ~45 seconds of swim time. The field is a
 *   function of world-x alone — no bare patches (density clamped [0.25, 1])
 *   and no hard-edged bands (two non-harmonic sines).
 *   Fish don't need recycling: three squads (normal/background/foreground)
 *   ride cuttle-relative Lissajous lanes and stay in frame automatically.
 */

import * as THREE from 'three';
import { createPlant, updatePlants, disposePlants, PLANT_PRESETS } from './plants.js';
import { createCoral, updateCoral, disposeCoral, CORAL_PRESETS } from './coral.js';
import { loadSpecies, availableSpecies, createFish } from './fish.js';

const TWO_PI = Math.PI * 2;

// ── Density field ─────────────────────────────────────────────────────────
// A function of world-x. Returns a number in [0.25, 1.0]: how "forest-y" the
// terrain is at that x. Two non-harmonic sines give a primary ~45s cycle
// (period ≈24u at 0.55 u/s swim speed) and a finer ~20s detail band. The
// min floor of 0.25 keeps things from ever going bare.
//
// TUNING: to move the forest period, change k1 = 2π / (cycle_units).
//         cycle_units = cycle_seconds * swim_speed.
//         Current: 0.26 ≈ period 24u ≈ 44s.
function densityAtX(worldX) {
  const a = Math.sin(worldX * 0.26);
  const b = Math.sin(worldX * 0.58 + 1.3);
  return Math.max(0.25, Math.min(1.0, 0.50 + 0.30 * a + 0.20 * b));
}

// ── Initial scatter ───────────────────────────────────────────────────────
// Density-biased radial scatter for spawn. rPow<1 biases near the origin;
// bigger means more plants at the horizon. The cuttle starts at x≈0 and
// swims -x, so we extend the scatter further on the -x side than +x.
function scatterRadial(count, { rMin, rMax, rPow, forwardBias, y }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * TWO_PI;
    const t = Math.pow(Math.random(), rPow);
    const r = rMin + t * (rMax - rMin);
    let x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    x -= forwardBias;
    out.push(new THREE.Vector3(x, y, z));
  }
  return out;
}

export class SwimWorld {
  /**
   * @param {THREE.Scene}     scene
   * @param {THREE.Object3D}  cuttle
   * @param {{fogColor: number, fogDensity?: number, floorY?: number}} [opts]
   */
  constructor(scene, cuttle, opts = {}) {
    this.scene = scene;
    this.cuttle = cuttle;

    this.fogColor   = opts.fogColor   ?? 0x1a0b2e;      // dark purple
    this.fogDensity = opts.fogDensity ?? 0.035;
    this.floorY     = opts.floorY     ?? -2.3;

    // Public counts — tweak via opts for benchmarking
    this.plantCount = opts.plantCount ?? 240;
    this.coralCount = opts.coralCount ?? 180;
    // Three fish squads — normal (mid-distance side lanes), background
    // (further out, smaller, slower) and foreground (close to camera, often
    // pass in front of cuttle). Total default: 8 + 10 + 10 = 28 fish.
    this.fishCount    = opts.fishCount   ?? 8;
    this.fishCountBg  = opts.fishCountBg ?? 10;
    this.fishCountFg  = opts.fishCountFg ?? 10;

    this.plants = [];   // [{mesh}]
    this.corals = [];   // THREE.Mesh[] (userData holds sway params)
    this.fishes = [];   // [{mesh, tick, pathX0, pathZ0, pathYBase, ampX, ampZ, ampY, freqX, freqZ, freqY, relSpeed}]
    this.lights = [];   // [THREE.Light]

    // Fog descriptor passed to plant materials so far-plants dissolve into
    // the same purple as scene.fog (scene.fog doesn't auto-apply to
    // ShaderMaterial without flag + includes).
    this._fog = {
      color: new THREE.Color(this.fogColor),
      near: 8,
      far:  42,
    };

    this._active = false;
    this._prevFog = null;
    this._prevBg = null;
  }

  spawn() {
    if (this._active) return;
    this._active = true;

    // Purple fog — cheap exp2 hack (no volumetric anything)
    this._prevFog = this.scene.fog;
    this._prevBg = this.scene.background;
    this.scene.fog = new THREE.FogExp2(this.fogColor, this.fogDensity);

    this._scatterFlora();
    this._addDebugLights();
    this._spawnFishPod();
  }

  _scatterFlora() {
    const plantTypes = Object.keys(PLANT_PRESETS);
    const coralTypes = Object.keys(CORAL_PRESETS);

    const plantPositions = scatterRadial(this.plantCount, {
      rMin: 2, rMax: 45, rPow: 1.9, forwardBias: 6, y: this.floorY,
    });
    for (const pos of plantPositions) {
      const type = plantTypes[Math.floor(Math.random() * plantTypes.length)];
      const group = createPlant(type, pos, this._fog);
      // Slight randomization so they don't look cloned
      group.scale.setScalar(0.8 + Math.random() * 0.7);
      group.rotation.y = Math.random() * TWO_PI;
      this.scene.add(group);
      this.plants.push(group);
    }

    const coralPositions = scatterRadial(this.coralCount, {
      rMin: 1.5, rMax: 42, rPow: 1.8, forwardBias: 5, y: this.floorY + 0.1,
    });
    for (const pos of coralPositions) {
      const type = coralTypes[Math.floor(Math.random() * coralTypes.length)];
      const mesh = createCoral(type, pos);
      // Further size randomization on top of the factory's 1.2-2.2
      mesh.scale.multiplyScalar(0.6 + Math.random() * 0.8);
      this.scene.add(mesh);
      this.corals.push(mesh);
    }
  }

  _addDebugLights() {
    // Cheap colored point-light hack — scene has only ambient + directional,
    // these add chromatic highlights without a real lighting system.
    const lights = [
      new THREE.PointLight(0xff40c0, 2.4, 14),
      new THREE.PointLight(0x40c0ff, 2.0, 16),
      new THREE.PointLight(0xffd060, 1.6, 10),
    ];
    const places = [
      new THREE.Vector3(-3, 0.8, 2.5),
      new THREE.Vector3( 4, 1.5, -3),
      new THREE.Vector3(-1, 2.5, -4),
    ];
    for (let i = 0; i < lights.length; i++) {
      lights[i].position.copy(places[i]);
      this.scene.add(lights[i]);
      this.lights.push(lights[i]);
    }
  }

  async _spawnFishPod() {
    await loadSpecies();

    // NORMAL SQUAD — mid-distance side lanes (user's "primary pod")
    this._spawnSquad(this.fishCount, {
      scaleMin: 1.2, scaleMax: 1.5,
      x0Min:   -7, x0Max:   -3,
      zSide:   true,  zMin: 1.2, zMax: 5.2,
      yMin:    0.2, yMax:    2.2,
      ampX:    [1.6, 4.0], ampZ: [0.9, 2.5], ampY: [0.35, 0.95],
      freqX:   [0.22, 0.40], freqZ: [0.18, 0.40], freqY: [0.28, 0.50],
    });

    // BACKGROUND SQUAD — far ahead, smaller, wider side lanes
    // These render as silhouettes through the fog, filling the horizon.
    this._spawnSquad(this.fishCountBg, {
      scaleMin: 0.7, scaleMax: 1.1,
      x0Min:   -20, x0Max:  -9,
      zSide:   true, zMin:   3.0, zMax: 10.0,
      yMin:    0.3, yMax:    3.5,
      ampX:    [2.5, 5.0], ampZ: [1.5, 3.2], ampY: [0.5, 1.1],
      freqX:   [0.12, 0.26], freqZ: [0.10, 0.25], freqY: [0.15, 0.32],
    });

    // FOREGROUND SQUAD — close lanes that sometimes cross IN FRONT of cuttle
    // (ahead of camera's lookAt target) so silhouettes occasionally obstruct
    // the view. Path anchors span ahead & just-behind-cuttle with big ampX
    // so fish sweep through the camera's FOV intermittently.
    this._spawnSquad(this.fishCountFg, {
      scaleMin: 1.3, scaleMax: 1.8,
      x0Min:   -4, x0Max:    1,
      zSide:   true, zMin:   0.6, zMax: 2.6,
      yMin:   -0.2, yMax:    2.0,
      ampX:    [1.8, 3.2], ampZ: [0.6, 1.6], ampY: [0.3, 0.8],
      freqX:   [0.20, 0.42], freqZ: [0.22, 0.45], freqY: [0.28, 0.52],
    });
  }

  _spawnSquad(count, spec) {
    const all = availableSpecies();
    for (let i = 0; i < count; i++) {
      const species = all[Math.floor(Math.random() * all.length)];
      const scale = spec.scaleMin + Math.random() * (spec.scaleMax - spec.scaleMin);
      const built = createFish(species, { scale, direction: 1 });
      if (!built) continue;

      const laneSide = spec.zSide ? (Math.random() > 0.5 ? 1 : -1) : 1;
      const zMag = spec.zMin + Math.random() * (spec.zMax - spec.zMin);
      built.mesh.userData.path = {
        x0:     spec.x0Min + Math.random() * (spec.x0Max - spec.x0Min),
        zBase:  laneSide * zMag,
        yBase:  spec.yMin + Math.random() * (spec.yMax - spec.yMin),
        ampX:   spec.ampX[0] + Math.random() * (spec.ampX[1] - spec.ampX[0]),
        ampZ:   spec.ampZ[0] + Math.random() * (spec.ampZ[1] - spec.ampZ[0]),
        ampY:   spec.ampY[0] + Math.random() * (spec.ampY[1] - spec.ampY[0]),
        freqX:  spec.freqX[0] + Math.random() * (spec.freqX[1] - spec.freqX[0]),
        freqZ:  spec.freqZ[0] + Math.random() * (spec.freqZ[1] - spec.freqZ[0]),
        freqY:  spec.freqY[0] + Math.random() * (spec.freqY[1] - spec.freqY[0]),
        phaseX: Math.random() * TWO_PI,
        phaseZ: Math.random() * TWO_PI,
        phaseY: Math.random() * TWO_PI,
      };
      this.scene.add(built.mesh);
      this.fishes.push({ mesh: built.mesh, tick: built.tick });
    }
  }

  /**
   * Per-frame update.
   * @param {number} dt      seconds since last frame
   * @param {number} elapsed total seconds (for sway/oscillation phase)
   */
  update(dt, elapsed) {
    if (!this._active) return;

    updatePlants(elapsed);
    updateCoral(this.corals, elapsed);
    this._recycleFlora();

    // Fish: oscillate on their parallel lanes around the cuttle. Because their
    // lane anchor is already offset from the cuttle and amplitude >> lane
    // offset, paths cross occasionally — per user spec, no collision.
    const cx = this.cuttle.position.x;
    const cy = this.cuttle.position.y;
    for (const f of this.fishes) {
      const p = f.mesh.userData.path;
      if (!p) continue;
      const x = cx + p.x0 + Math.sin(elapsed * p.freqX + p.phaseX) * p.ampX;
      const z =      p.zBase + Math.sin(elapsed * p.freqZ + p.phaseZ) * p.ampZ;
      const y = cy + p.yBase + Math.sin(elapsed * p.freqY + p.phaseY) * p.ampY;
      f.mesh.position.set(x, y, z);
      f.tick(elapsed);
    }
  }

  // Rolling-window recycler — teleports any plant/coral that has drifted too
  // far behind the cuttle to a spot ahead. Landing x is chosen via rejection
  // sampling against densityAtX so plants cluster into recurring forests.
  // Fog hides any residual pop-in. Cuttle faces -x; "behind" = +x, "ahead" = -x.
  _recycleFlora() {
    const cx = this.cuttle.position.x;
    const cz = this.cuttle.position.z;
    const REAR        = 22;
    const AHEAD_MIN   = 26;
    const AHEAD_MAX   = 72;           // wider ahead band so density field has room
    const AHEAD_SPAN  = AHEAD_MAX - AHEAD_MIN;
    const Z_SPREAD    = 44;

    const pickAheadX = () => {
      // Rejection sample against densityAtX. 6 tries max — worst-case avg is
      // ~1/0.25 = 4 tries; 6 is plenty. If none accepts, use last candidate.
      let x;
      for (let i = 0; i < 6; i++) {
        x = cx - (AHEAD_MIN + Math.random() * AHEAD_SPAN);
        if (Math.random() < densityAtX(x)) return x;
      }
      return x;
    };

    for (const g of this.plants) {
      if (g.position.x - cx > REAR) {
        g.position.x = pickAheadX();
        g.position.z = cz + (Math.random() - 0.5) * Z_SPREAD;
        g.rotation.y = Math.random() * TWO_PI;
      }
    }
    for (const m of this.corals) {
      if (m.position.x - cx > REAR) {
        m.position.x = pickAheadX();
        m.position.z = cz + (Math.random() - 0.5) * Z_SPREAD;
        m.userData.baseRotY = Math.random() * TWO_PI;
      }
    }
  }

  dispose() {
    if (!this._active) return;
    this._active = false;

    for (const g of this.plants) this.scene.remove(g);
    for (const m of this.corals) this.scene.remove(m);
    for (const f of this.fishes) this.scene.remove(f.mesh);
    for (const l of this.lights) this.scene.remove(l);
    this.plants.length = 0;
    this.corals.length = 0;
    this.fishes.length = 0;
    this.lights.length = 0;

    disposePlants();
    disposeCoral();

    this.scene.fog = this._prevFog;
    this.scene.background = this._prevBg;
  }

  getDebugInfo() {
    return {
      plants: this.plants.length,
      corals: this.corals.length,
      fishes: this.fishes.length,
      lights: this.lights.length,
      fogColor: '#' + this.fogColor.toString(16).padStart(6, '0'),
    };
  }
}
