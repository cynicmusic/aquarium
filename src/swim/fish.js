/**
 * swim/fish.js — swim-world fish factory.
 *
 * Thin layer over the existing Fish3DBuilder — no FishManager AI, no
 * tank-bounds, no labels. Fish are built once, scaled to roughly half the
 * cuttle's apparent size, and returned with a simple per-fish animator.
 */

import * as THREE from 'three';
import { buildCompleteFish } from '../entities/Fish3DBuilder.js';
import { createFishMaterial } from '../shaders/FishShaderMaterial.js';

let _species = null;
let _loading = null;

// Relative path so the preview works both at site root (dev) and from a
// subdirectory (staging.relaxmoods.com/cuttlefish/).
export async function loadSpecies(basePath = './fish/') {
  if (_species) return _species;
  if (_loading) return _loading;
  _loading = (async () => {
    const resp = await fetch(basePath + 'manifest.json');
    const manifest = await resp.json();
    _species = new Map();
    await Promise.all(manifest.map(async name => {
      const r = await fetch(basePath + name + '.json');
      _species.set(name, await r.json());
    }));
    return _species;
  })();
  return _loading;
}

export function availableSpecies() {
  return _species ? [..._species.keys()] : [];
}

/**
 * Build a single fish mesh + a lightweight update tick.
 *
 * @param {string} type     species name (from manifest)
 * @param {{scale?: number, direction?: -1|1}} opts
 * @returns {{ mesh: THREE.Group, species: string, tick: (elapsed:number)=>void }}
 *   or null if the species is unknown.
 *
 * The returned mesh has `userData.swimPhase` for the caller's swim path AI.
 */
export function createFish(type, opts = {}) {
  const data = _species?.get(type);
  if (!data) { console.warn('Unknown fish species:', type); return null; }

  const fish3d = buildCompleteFish(data, { widthFactor: 0.55 });

  // Default iridophore amount by pattern family — a shy bottom-dweller gets
  // less sparkle than a reef show-fish. Same table as the aquarium uses.
  const patternType = (data.pattern && data.pattern.type) || 'mottled';
  const PATTERN_IRID = {
    two_tone_stripe:    0.55, gradient_iridescent: 0.55,
    bands_vertical:     0.35, bands_regions:       0.35, gradient_zones: 0.35,
    stripes_horizontal: 0.32, bands_with_spots:    0.30,
    composite_scales:   0.25, composite_radial:    0.28, composite_grid:  0.28,
    composite_spots:    0.22, contours:            0.22,
    spots:              0.18, mottled:             0.10,
  };
  const iridMult = data.iridoMultiplier ?? PATTERN_IRID[patternType] ?? 0.25;
  const spectralBias = (fish3d.root.uuid.charCodeAt(0) % 100) / 100;
  const material = createFishMaterial(data.pattern, data.colors, data.neonHolo ? {
    scaleSize:         58,
    scaleOpacity:      0.06,
    depthOpacity:      0.16,
    iridIntensity:     0.12,
    iridoIntensity:    iridMult,
    iridoThickness:    6.4,
    iridoMaskScale:    24,
    iridoMaskOpacity:  0.32,
    iridoSpectralBias: spectralBias,
  } : {
    iridoIntensity:   iridMult,
    iridoThickness:   5.0,
    iridoMaskScale:   16,
    iridoMaskOpacity: 0.6,
    iridoSpectralBias:spectralBias,
  });
  const bodyMesh = new THREE.Mesh(fish3d.bodyGeo, material);
  fish3d.root.add(bodyMesh);

  const mesh = fish3d.root;
  mesh.scale.setScalar(opts.scale ?? 1.0);

  // Face the fish's forward (+x model → -x world = cuttle's forward). When
  // direction=+1 mesh faces world -x (same as cuttle); direction=-1 faces +x.
  const dir = opts.direction ?? 1;
  mesh.rotation.y = dir > 0 ? 0 : Math.PI;

  mesh.userData.swimPhase = Math.random() * Math.PI * 2;
  mesh.userData.species = type;
  mesh.userData.direction = dir;

  // Cache shimmer-ring refs once (eye iris rings used for sparkle rotation)
  const shimmerRings = [];
  mesh.traverse(o => {
    if (o.userData && o.userData.shimmerRing) shimmerRings.push(o.userData.shimmerRing);
  });

  const caudalFin = fish3d.fins.caudal;

  const tick = (elapsed) => {
    const phase = mesh.userData.swimPhase + elapsed * 3.0;
    // Pulse material time (iridophore animation)
    if (material.uniforms && material.uniforms.uTime) {
      material.uniforms.uTime.value = elapsed;
    }
    if (caudalFin) caudalFin.rotation.y = Math.sin(phase) * 0.10;
    // Shimmer rings spin
    const rot = elapsed * 0.6 + mesh.userData.swimPhase * 0.4;
    for (const ring of shimmerRings) ring.rotation.z = rot;
    // Body yaw/roll microwobble (preserves side-profile facing)
    const base = mesh.userData.direction > 0 ? 0 : Math.PI;
    mesh.rotation.y = base + Math.sin(phase * 0.35) * 0.026;
    mesh.rotation.z = Math.sin(elapsed * 0.8 + mesh.userData.swimPhase) * 0.015;
  };

  return { mesh, species: type, tick };
}
