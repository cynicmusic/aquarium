import * as THREE from 'three';
import { buildCompleteFish } from './Fish3DBuilder.js';
import { createFishMaterial } from '../shaders/FishShaderMaterial.js';

// Will be populated async from manifest
let _speciesData = null;
let _speciesLoading = null;

async function ensureSpeciesLoaded() {
  if (_speciesData) return _speciesData;
  if (_speciesLoading) return _speciesLoading;
  _speciesLoading = (async () => {
    const resp = await fetch('/fish/manifest.json');
    const manifest = await resp.json();
    _speciesData = new Map();
    await Promise.all(manifest.map(async name => {
      const r = await fetch('/fish/' + name + '.json');
      _speciesData.set(name, await r.json());
    }));
    return _speciesData;
  })();
  return _speciesLoading;
}

// Map old species names to new NACA names
const NAME_MAP = {
  cardinalfish: 'cardinalTetra',
  guppy: 'neonTetra',
};

/**
 * Fish pace left-right across the full screen width, always showing side profiles.
 * Each fish has its own vertical lane so they spread across the view.
 */

export class FishManager {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.fishes = [];
    this.schools = new Map();
    this.debugLabels = true;
    this._ready = false;
    this._spawnDefaults();
  }

  async _spawnDefaults() {
    await ensureSpeciesLoaded();
    this._ready = true;

    // Spawn a nice variety of all 32 species
    const all = [..._speciesData.keys()];
    // Schooling fish get multiples
    const schooling = ['neonTetra', 'cardinalTetra', 'clownfish'];
    for (const type of schooling) {
      for (let i = 0; i < 4; i++) this.addFish(type);
    }
    // One of everything else
    for (const type of all) {
      if (!schooling.includes(type)) this.addFish(type);
    }
  }

  addFish(type) {
    // Remap old names
    type = NAME_MAP[type] || type;
    const data = _speciesData?.get(type);
    if (!data) { console.warn('Unknown fish:', type); return null; }

    const fish3d = buildCompleteFish(data, { widthFactor: 0.55 });
    // Every fish gets iridophore shimmer by default — some species more than
    // others. Pull the multiplier from species JSON if present, else vary by
    // pattern type (showy reef fish get more, mottled bottom-dwellers less).
    const patternType = (data.pattern && data.pattern.type) || 'mottled';
    const PATTERN_IRID = {
      two_tone_stripe:   0.55,   // neon tetra — heavy iridescence
      bands_vertical:    0.35,
      bands_regions:     0.35,
      bands_with_spots:  0.30,
      stripes_horizontal:0.32,
      gradient_iridescent:0.55,
      gradient_zones:    0.35,
      composite_scales:  0.25,
      composite_radial:  0.28,
      composite_grid:    0.28,
      composite_spots:   0.22,
      spots:             0.18,
      contours:          0.22,
      mottled:           0.10,   // shy bottom-dweller
    };
    const iridMult = data.iridoMultiplier ?? PATTERN_IRID[patternType] ?? 0.25;
    const material = createFishMaterial(data.pattern, data.colors, {
      iridoIntensity:   iridMult,
      iridoThickness:   5.0,
      iridoMaskScale:   16,
      iridoMaskOpacity: 0.6,
      iridoSpectralBias:(fish3d.root.uuid.charCodeAt(0) % 100) / 100,  // species-unique bias
    });
    const bodyMesh = new THREE.Mesh(fish3d.bodyGeo, material);
    fish3d.root.add(bodyMesh);

    const mesh = fish3d.root;
    const scale = 2.5 + Math.random() * 1.5;
    mesh.scale.setScalar(scale);

    const { tankWidth, tankDepth, tankHeight } = this.aquariumScene.params;

    // Each fish gets a unique vertical position (y) spread across the full height
    // This ensures fish fill the entire screen vertically
    const fishIndex = this.fishes.length;
    const totalExpected = 30; // approximate total fish count
    const ySlot = (fishIndex / totalExpected) * (tankHeight - 1) + 0.5;
    const personalY = ySlot + (Math.random() - 0.5) * 1.5;
    const y = Math.max(0.5, Math.min(tankHeight - 0.5, personalY));

    // Spread initial X positions across the tank
    const x = (Math.random() - 0.5) * tankWidth * 0.9;
    const z = (Math.random() - 0.5) * tankDepth * 0.3;
    mesh.position.set(x, y, z);

    // Side profile: fish body lies in XY plane, camera looks along -Z
    // Fish geometry: nose at x=0, tail at x=1
    // rotation.y = PI → nose points -X (going left, nose leads)
    // rotation.y = 0 → nose points +X (going right, nose leads)
    // BUT the fish moves NOSE-FIRST, so when direction=1 (+X), nose should point +X
    // Test shows backwards, so swap: direction=1 → rotation.y = PI, direction=-1 → rotation.y = 0
    const goingRight = Math.random() > 0.5;
    mesh.rotation.y = goingRight ? Math.PI : 0;

    this.aquariumScene.scene.add(mesh);

    const label = this._createLabel(type);
    mesh.add(label);
    label.position.set(0, 0.3, 0);

    // Speed variety — some fish are slow drifters, some are fast
    const speedClass = Math.random();
    let speed;
    if (speedClass < 0.3) speed = 0.3 + Math.random() * 0.3; // slow
    else if (speedClass < 0.7) speed = 0.6 + Math.random() * 0.4; // medium
    else speed = 1.0 + Math.random() * 0.5; // fast

    const fish = {
      mesh, type, personalY,
      direction: goingRight ? 1 : -1,
      speed,
      swimPhase: Math.random() * Math.PI * 2,
      label,
      // Turn BEYOND screen edges so fish swim off-screen before turning
      turnRightAt: tankWidth * (0.5 + Math.random() * 0.15),
      turnLeftAt: -tankWidth * (0.5 + Math.random() * 0.15),
      turning: false,
      turnProgress: 0,
      // Bubble timer for intermittent fish bubbles
      bubbleTimer: 3 + Math.random() * 10,
    };

    this.fishes.push(fish);
    if (!this.schools.has(type)) this.schools.set(type, []);
    this.schools.get(type).push(fish);

    return fish;
  }

  _createLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const fontSize = 12 + Math.floor(Math.random() * 16);
    ctx.font = `${fontSize}px monospace`;
    const textWidth = ctx.measureText(text).width;
    const pillPadding = 12;
    const pillWidth = Math.min(textWidth + pillPadding * 2, 250);
    const pillHeight = fontSize + 12;
    const pillX = (256 - pillWidth) / 2;
    const pillY = (64 - pillHeight) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 6);
      ctx.fill();
    } else {
      ctx.fillRect(pillX, pillY, pillWidth, pillHeight);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.6, 0.15, 1);
    sprite.visible = this.debugLabels;
    return sprite;
  }

  setDebugLabels(visible) {
    this.debugLabels = visible;
    this.fishes.forEach(f => { if (f.label) f.label.visible = visible; });
  }

  removeFish(fish) {
    this.aquariumScene.scene.remove(fish.mesh);
    this.fishes = this.fishes.filter(f => f !== fish);
    const school = this.schools.get(fish.type);
    if (school) {
      const idx = school.indexOf(fish);
      if (idx >= 0) school.splice(idx, 1);
    }
  }

  clearAll() {
    [...this.fishes].forEach(f => this.removeFish(f));
  }

  update(dt, elapsed) {
    if (!this._ready) return;
    // Pulse per-fish material time uniform for iridophore / time-based layers
    for (const fish of this.fishes) {
      fish.mesh.traverse(obj => {
        if (obj.material && obj.material.uniforms && obj.material.uniforms.uTime) {
          obj.material.uniforms.uTime.value = elapsed;
        }
      });
    }
    for (const fish of this.fishes) {
      const pos = fish.mesh.position;

      // Simple pacing: move in current direction along X axis
      if (!fish.turning) {
        pos.x += fish.direction * fish.speed * dt;

        // Gentle Y oscillation around personal depth
        const yDrift = Math.sin(elapsed * 0.3 + fish.swimPhase) * 0.3;
        pos.y += (fish.personalY + yDrift - pos.y) * dt * 0.5;

        // Very subtle Z drift
        pos.z += Math.sin(elapsed * 0.2 + fish.swimPhase * 2) * 0.02 * dt;

        // Check if fish reached the turn point
        if (fish.direction > 0 && pos.x >= fish.turnRightAt) {
          fish.turning = true;
          fish.turnProgress = 0;
          fish.direction = -1;
        } else if (fish.direction < 0 && pos.x <= fish.turnLeftAt) {
          fish.turning = true;
          fish.turnProgress = 0;
          fish.direction = 1;
        }

        // Maintain side-profile facing (PI = moving right, 0 = moving left)
        const targetAngle = fish.direction > 0 ? Math.PI : 0;
        fish.mesh.rotation.y = targetAngle;
      } else {
        // Turning animation — smooth 180 degree turn
        fish.turnProgress += dt * 2.0; // turn takes ~0.5 seconds

        // Turn by rotating through +/- PI (flip around)
        // Going right (direction=1): was at PI, need to reach 0 → subtract
        // Going left (direction=-1): was at 0, need to reach PI → add
        const t = Math.min(fish.turnProgress, 1.0);
        const smoothT = t * t * (3 - 2 * t); // smoothstep
        if (fish.direction > 0) {
          // Was moving left (rotation=0), turning to move right (rotation=PI)
          fish.mesh.rotation.y = smoothT * Math.PI;
        } else {
          // Was moving right (rotation=PI), turning to move left (rotation=0→via 2PI)
          fish.mesh.rotation.y = Math.PI + smoothT * Math.PI;
        }

        // Slow movement during turn
        pos.x += fish.direction * fish.speed * dt * 0.3;

        if (fish.turnProgress >= 1.0) {
          fish.turning = false;
          // Snap to final side-profile angle
          fish.mesh.rotation.y = fish.direction > 0 ? Math.PI : 0;
        }
      }

      // Collision avoidance — nudge Y when too close to another fish
      for (const other of this.fishes) {
        if (other === fish) continue;
        const dx = pos.x - other.mesh.position.x;
        const dy = pos.y - other.mesh.position.y;
        const dz = pos.z - other.mesh.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 1.5 && distSq > 0.01) {
          // Gentle push apart vertically
          const pushStr = 0.2 / Math.sqrt(distSq);
          pos.y += Math.sign(dy || 0.1) * pushStr * dt;
          pos.z += Math.sign(dz || 0.1) * pushStr * dt * 0.3;
        }
      }

      // Swimming animation — primary motion is tail wag; body yaw is subtle.
      fish.swimPhase += dt * (2.5 + fish.speed * 1.5);
      const tailWag = Math.sin(fish.swimPhase) * 0.085;
      if (fish.mesh.children[0]) {
        fish.mesh.children[0].rotation.y = tailWag;
      }
      // Very small body yaw wobble (not a disco move) so the whole fish looks
      // like it's swimming rather than sliding. ±1.5° max.
      if (!fish.turning) {
        const targetBase = fish.direction > 0 ? Math.PI : 0;
        fish.mesh.rotation.y = targetBase + Math.sin(fish.swimPhase * 0.35) * 0.026;
      }
      // Slight vertical flex
      fish.mesh.rotation.z = Math.sin(elapsed * 0.8 + fish.swimPhase) * 0.015;

      // Spin shimmer rings on eyes — creates the "living" sparkle
      if (!fish._shimmerRings) {
        fish._shimmerRings = [];
        fish.mesh.traverse(obj => {
          if (obj.userData && obj.userData.shimmerRing) {
            fish._shimmerRings.push(obj.userData.shimmerRing);
          }
        });
      }
      if (fish._shimmerRings.length) {
        const rot = elapsed * 0.6 + fish.swimPhase * 0.4;
        for (const ring of fish._shimmerRings) ring.rotation.z = rot;
      }

      // Intermittent fish bubbles
      fish.bubbleTimer -= dt;
      if (fish.bubbleTimer <= 0 && this.aquariumScene.bubbles) {
        fish.bubbleTimer = 5 + Math.random() * 15;
        // Spawn a tiny bubble near the fish's mouth
        const bubblePos = pos.clone();
        bubblePos.x += fish.direction * 0.3;
        bubblePos.y += 0.1;
        this.aquariumScene.bubbles._spawnBubble({ position: bubblePos, frequency: 1 });
      }

      // Safety: clamp position to prevent NaN or escape
      if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
        pos.set(0, fish.personalY, 0);
        fish.turning = false;
      }

      // Hard bound against Z / Y drift — keep fish on-screen
      const { tankWidth, tankDepth, tankHeight } = this.aquariumScene.params;
      if (Math.abs(pos.z) > tankDepth * 0.35) {
        pos.z = Math.sign(pos.z) * tankDepth * 0.35;
      }
      pos.y = Math.max(1.2, Math.min(tankHeight - 0.5, pos.y));
      // If a fish somehow ended up way past the X turn points, bring it back
      if (Math.abs(pos.x) > tankWidth * 0.9) {
        pos.x = Math.sign(pos.x) * tankWidth * 0.5;
        fish.direction *= -1;
      }
    }
  }

  getDebugInfo() {
    const schoolSizes = {};
    this.schools.forEach((fish, type) => { schoolSizes[type] = fish.length; });
    return {
      name: 'Fish',
      params: {
        totalFish: this.fishes.length,
        schools: Object.entries(schoolSizes).map(([t, n]) => `${t}: ${n}`).join(', '),
      },
      fish: this.fishes.map((f, i) => ({
        index: i,
        type: f.type,
        pos: `${f.mesh.position.x.toFixed(1)}, ${f.mesh.position.y.toFixed(1)}, ${f.mesh.position.z.toFixed(1)}`,
        speed: f.speed.toFixed(2),
        dir: f.direction > 0 ? 'R' : 'L',
      })),
    };
  }
}
