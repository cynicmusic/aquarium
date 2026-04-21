/**
 * swim/coral.js — standalone coral factory for swim-mode world.
 *
 * Refactor notes vs. environment/CoralSystem.js:
 *   - No class. Factory returns a mesh; caller owns the scene graph.
 *   - Shared MeshStandardMaterial per preset (hundreds of instances × 1 mat).
 *   - Cheap brightness boost via bumped emissiveIntensity so coral stays
 *     visible in the dark purple scene without a full lighting system.
 *   - scene.fog is auto-respected by MeshStandardMaterial (no shader edits).
 */

import * as THREE from 'three';

export const CORAL_PRESETS = {
  brainCoral:     { color: '#c09070', size: 0.8, type: 'sphere',        roughness: 0.9, bumpScale: 0.3 },
  staghorn:       { color: '#e0b080', size: 1.2, type: 'fractalBranch', roughness: 0.7, bumpScale: 0.1 },
  tableCoral:     { color: '#a07050', size: 1.5, type: 'disc',          roughness: 0.8, bumpScale: 0.2 },
  mushroom:       { color: '#e07090', size: 0.5, type: 'mushroom',      roughness: 0.6, bumpScale: 0.1 },
  tubeCoral:      { color: '#f0b050', size: 0.6, type: 'tube',          roughness: 0.5, bumpScale: 0.1 },
  fanCoral:       { color: '#e06090', size: 1.0, type: 'fan',           roughness: 0.6, bumpScale: 0.15 },
  pillarCoral:    { color: '#b09060', size: 1.8, type: 'pillar',        roughness: 0.8, bumpScale: 0.2 },
  flowerCoral:    { color: '#f090b0', size: 0.4, type: 'flower',        roughness: 0.5, bumpScale: 0.1 },
  pinkStaghorn:   { color: '#ff80a0', size: 1.0, type: 'fractalBranch', roughness: 0.6, bumpScale: 0.1 },
  orangeTree:     { color: '#f0a040', size: 1.4, type: 'fractalBranch', roughness: 0.7, bumpScale: 0.15 },
  purpleFan:      { color: '#a050d0', size: 0.9, type: 'fan',           roughness: 0.5, bumpScale: 0.12 },
  greenBrain:     { color: '#50a060', size: 0.7, type: 'sphere',        roughness: 0.85, bumpScale: 0.25 },
  yellowMushroom: { color: '#e0c040', size: 0.6, type: 'mushroom',      roughness: 0.5, bumpScale: 0.1 },
  redSea:         { color: '#d03030', size: 0.5, type: 'flower',        roughness: 0.6, bumpScale: 0.15 },
};

// ── Shared cache ──────────────────────────────────────────────────────────
// fractalBranch is per-instance randomized so it doesn't cache; others do.
const _geoCache = new Map();
const _matCache = new Map();

function _createGeometry(preset) {
  const p = preset;
  switch (p.type) {
    case 'sphere': {
      const geo = new THREE.SphereGeometry(p.size, 16, 12);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const n = Math.sin(x * 8) * Math.cos(y * 6) * Math.sin(z * 7) * p.bumpScale;
        pos.setXYZ(i, x + x * n, y + y * n, z + z * n);
      }
      geo.computeVertexNormals();
      return geo;
    }
    case 'fractalBranch': return _buildFractalBranch(p);
    case 'disc': {
      const geo = new THREE.CylinderGeometry(p.size, p.size * 0.8, 0.15, 20);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        pos.setY(i, y + Math.sin(r * 3) * 0.1);
      }
      geo.computeVertexNormals();
      return geo;
    }
    case 'mushroom':
      return new THREE.SphereGeometry(p.size, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    case 'tube':
      return new THREE.CylinderGeometry(p.size * 0.3, p.size * 0.2, p.size, 8, 1, true);
    case 'fan': {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(-p.size * 0.6, p.size * 0.7, 0, p.size);
      shape.quadraticCurveTo(p.size * 0.6, p.size * 0.7, 0, 0);
      return new THREE.ShapeGeometry(shape, 6);
    }
    case 'pillar': {
      const geo = new THREE.CylinderGeometry(0.15, 0.2, p.size, 8, 6);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        pos.setX(i, x + Math.sin(y * 3) * 0.05);
        pos.setZ(i, z + Math.cos(y * 2.5) * 0.04);
      }
      geo.computeVertexNormals();
      return geo;
    }
    case 'flower':
      return new THREE.DodecahedronGeometry(p.size, 1);
    default:
      return new THREE.SphereGeometry(p.size, 10, 8);
  }
}

function _buildFractalBranch(preset) {
  const verts = [], indices = [];
  const addBranch = (ox, oy, oz, angle, tilt, length, radius, depth) => {
    if (depth <= 0 || length < 0.03) return;
    const segs = 4;
    const vo = verts.length / 3;
    const dx = Math.sin(angle) * Math.cos(tilt);
    const dy = Math.cos(tilt);
    const dz = Math.cos(angle) * Math.cos(tilt);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = ox + dx * length * t;
      const y = oy + dy * length * t;
      const z = oz + dz * length * t;
      const r = radius * (1 - t * 0.4);
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        verts.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < 4; j++) {
        const a = vo + i * 4 + j;
        const b = vo + i * 4 + (j + 1) % 4;
        const c = vo + (i + 1) * 4 + j;
        const d = vo + (i + 1) * 4 + (j + 1) % 4;
        indices.push(a, c, b, b, c, d);
      }
    }
    const ex = ox + dx * length, ey = oy + dy * length, ez = oz + dz * length;
    const forks = depth > 2 ? 3 : 2;
    for (let f = 0; f < forks; f++) {
      const spread = 0.4 + Math.random() * 0.5;
      const newAngle = angle + (f - (forks - 1) / 2) * spread + (Math.random() - 0.5) * 0.2;
      const newTilt = tilt * 0.8 + (Math.random() - 0.5) * 0.2;
      addBranch(ex, ey, ez, newAngle, newTilt,
                length * (0.55 + Math.random() * 0.15), radius * 0.6, depth - 1);
    }
  };
  addBranch(0, 0, 0, 0, 0.2, preset.size * 0.5, preset.size * 0.06, 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function _getOrCreateMaterial(presetName, preset) {
  let mat = _matCache.get(presetName);
  if (mat) return mat;
  const c = new THREE.Color(preset.color);
  mat = new THREE.MeshStandardMaterial({
    color: c,
    roughness: preset.roughness,
    metalness: 0.05,
    side: THREE.DoubleSide,
    emissive: c,
    emissiveIntensity: 0.35,      // bumped — scene has no real lighting
  });
  _matCache.set(presetName, mat);
  return mat;
}

/**
 * Create a coral mesh at `position`. Caller can stash per-instance sway
 * metadata on `mesh.userData` if needed; updateCoral() reads it.
 */
export function createCoral(typeName, position) {
  const preset = CORAL_PRESETS[typeName] || CORAL_PRESETS.brainCoral;
  const geoKey = preset.type === 'fractalBranch' ? null : typeName;
  let geo = geoKey && _geoCache.get(geoKey);
  if (!geo) {
    geo = _createGeometry(preset);
    if (geoKey) _geoCache.set(geoKey, geo);
  }
  const mat = _getOrCreateMaterial(typeName, preset);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.userData.baseRotY = Math.random() * Math.PI * 2;
  mesh.userData.swayPhase = Math.random() * Math.PI * 2;
  mesh.userData.swayAmp = 0.015 + Math.random() * 0.015;
  mesh.userData.coralType = typeName;
  mesh.rotation.y = mesh.userData.baseRotY;
  mesh.scale.setScalar(1.2 + Math.random() * 1.0);
  return mesh;
}

/** Tick sway on a list of coral meshes. Cheap per-object rotation only. */
export function updateCoral(corals, elapsed) {
  for (const c of corals) {
    const { baseRotY, swayPhase, swayAmp } = c.userData;
    c.rotation.y = baseRotY + Math.sin(elapsed * 0.6 + swayPhase) * swayAmp;
    c.rotation.z = Math.sin(elapsed * 0.5 + swayPhase * 1.3) * swayAmp * 0.7;
  }
}

export function disposeCoral() {
  for (const g of _geoCache.values()) g.dispose();
  for (const m of _matCache.values()) m.dispose();
  _geoCache.clear();
  _matCache.clear();
}
