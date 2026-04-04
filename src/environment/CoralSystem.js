import * as THREE from 'three';

// Coral presets — procedurally generated from deformed geometries
export const CORAL_PRESETS = {
  brainCoral:     { color: '#c09070', size: 0.8, type: 'sphere', roughness: 0.9, bumpScale: 0.3 },
  staghorn:       { color: '#e0b080', size: 1.2, type: 'fractalBranch', roughness: 0.7, bumpScale: 0.1 },
  tableCoral:     { color: '#a07050', size: 1.5, type: 'disc', roughness: 0.8, bumpScale: 0.2 },
  mushroom:       { color: '#e07090', size: 0.5, type: 'mushroom', roughness: 0.6, bumpScale: 0.1 },
  tubeCoral:      { color: '#f0b050', size: 0.6, type: 'tube', roughness: 0.5, bumpScale: 0.1 },
  fanCoral:       { color: '#e06090', size: 1.0, type: 'fan', roughness: 0.6, bumpScale: 0.15 },
  pillarCoral:    { color: '#b09060', size: 1.8, type: 'pillar', roughness: 0.8, bumpScale: 0.2 },
  flowerCoral:    { color: '#f090b0', size: 0.4, type: 'flower', roughness: 0.5, bumpScale: 0.1 },
  // More diverse types
  pinkStaghorn:   { color: '#ff80a0', size: 1.0, type: 'fractalBranch', roughness: 0.6, bumpScale: 0.1 },
  orangeTree:     { color: '#f0a040', size: 1.4, type: 'fractalBranch', roughness: 0.7, bumpScale: 0.15 },
  purpleFan:      { color: '#a050d0', size: 0.9, type: 'fan', roughness: 0.5, bumpScale: 0.12 },
  greenBrain:     { color: '#50a060', size: 0.7, type: 'sphere', roughness: 0.85, bumpScale: 0.25 },
  yellowMushroom: { color: '#e0c040', size: 0.6, type: 'mushroom', roughness: 0.5, bumpScale: 0.1 },
  redSea:         { color: '#d03030', size: 0.5, type: 'flower', roughness: 0.6, bumpScale: 0.15 },
};

export class CoralSystem {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.corals = [];
    this._spawnDefaults();
  }

  _createCoralGeo(preset) {
    switch (preset.type) {
      case 'sphere': {
        const geo = new THREE.SphereGeometry(preset.size, 16, 12);
        // Bump deformation for brain-like texture
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const noise = Math.sin(x * 8) * Math.cos(y * 6) * Math.sin(z * 7) * preset.bumpScale;
          pos.setXYZ(i, x + x * noise, y + y * noise, z + z * noise);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'branch': {
        const main = new THREE.CylinderGeometry(0.06, 0.1, preset.size, 6);
        return main;
      }
      case 'fractalBranch': {
        return this._createFractalBranchGeo(preset);
      }
      case 'disc': {
        const geo = new THREE.CylinderGeometry(preset.size, preset.size * 0.8, 0.15, 20);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const r = Math.sqrt(x * x + z * z);
          pos.setY(i, y + Math.sin(r * 3) * 0.1);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'mushroom': {
        const cap = new THREE.SphereGeometry(preset.size, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
        return cap;
      }
      case 'tube': {
        return new THREE.CylinderGeometry(preset.size * 0.3, preset.size * 0.2, preset.size, 8, 1, true);
      }
      case 'fan': {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(-preset.size * 0.6, preset.size * 0.7, 0, preset.size);
        shape.quadraticCurveTo(preset.size * 0.6, preset.size * 0.7, 0, 0);
        return new THREE.ShapeGeometry(shape, 6);
      }
      case 'pillar': {
        const geo = new THREE.CylinderGeometry(0.15, 0.2, preset.size, 8, 6);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const wobble = Math.sin(y * 3) * 0.05;
          pos.setX(i, x + wobble);
          pos.setZ(i, z + Math.cos(y * 2.5) * 0.04);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'flower': {
        return new THREE.DodecahedronGeometry(preset.size, 1);
      }
      default:
        return new THREE.SphereGeometry(preset.size, 10, 8);
    }
  }

  _createFractalBranchGeo(preset) {
    const verts = [];
    const indices = [];
    const normals = [];

    const addBranch = (ox, oy, oz, angle, tilt, length, radius, depth) => {
      if (depth <= 0 || length < 0.03) return;
      const segs = 4;
      const vo = verts.length / 3;

      // Cylinder along the branch direction
      const dx = Math.sin(angle) * Math.cos(tilt);
      const dy = Math.cos(tilt);
      const dz = Math.cos(angle) * Math.cos(tilt);

      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = ox + dx * length * t;
        const y = oy + dy * length * t;
        const z = oz + dz * length * t;
        const r = radius * (1 - t * 0.4);
        // 4 points around the branch at this level
        for (let j = 0; j < 4; j++) {
          const a = (j / 4) * Math.PI * 2;
          const px = Math.cos(a) * r;
          const pz = Math.sin(a) * r;
          verts.push(x + px, y, z + pz);
          normals.push(px / r, 0, pz / r);
        }
      }

      // Connect rings
      for (let i = 0; i < segs; i++) {
        for (let j = 0; j < 4; j++) {
          const a = vo + i * 4 + j;
          const b = vo + i * 4 + (j + 1) % 4;
          const c = vo + (i + 1) * 4 + j;
          const d = vo + (i + 1) * 4 + (j + 1) % 4;
          indices.push(a, c, b, b, c, d);
        }
      }

      // End point of this branch
      const ex = ox + dx * length;
      const ey = oy + dy * length;
      const ez = oz + dz * length;

      // Fork into 2-3 sub-branches
      const forks = depth > 2 ? 3 : 2;
      for (let f = 0; f < forks; f++) {
        const spread = 0.4 + Math.random() * 0.5;
        const newAngle = angle + (f - (forks - 1) / 2) * spread + (Math.random() - 0.5) * 0.2;
        const newTilt = tilt * 0.8 + (Math.random() - 0.5) * 0.2;
        addBranch(ex, ey, ez, newAngle, newTilt, length * (0.55 + Math.random() * 0.15), radius * 0.6, depth - 1);
      }
    };

    addBranch(0, 0, 0, 0, 0.2, preset.size * 0.5, preset.size * 0.06, 4);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  addCoral(typeName, position) {
    const preset = CORAL_PRESETS[typeName] || CORAL_PRESETS.brainCoral;
    const geo = this._createCoralGeo(preset);
    const coralColor = new THREE.Color(preset.color);
    const mat = new THREE.MeshStandardMaterial({
      color: coralColor,
      roughness: preset.roughness,
      metalness: 0.05,
      side: THREE.DoubleSide,
      emissive: coralColor,
      emissiveIntensity: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    // Scale up coral for more prominent reef
    const scale = 1.2 + Math.random() * 1.0;
    mesh.scale.setScalar(scale);

    this.aquariumScene.scene.add(mesh);
    this.corals.push({ mesh, type: typeName, preset });
    return mesh;
  }

  _spawnDefaults() {
    const { tankWidth, tankDepth } = this.aquariumScene.params;
    const types = Object.keys(CORAL_PRESETS);

    // Background and midground coral
    for (let i = 0; i < 22; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const x = (Math.random() - 0.5) * tankWidth * 0.8;
      const z = (Math.random() - 0.5) * tankDepth * 0.7;
      this.addCoral(type, new THREE.Vector3(x, 0, z));
    }
    // Foreground coral — larger pieces filling bare sand
    const fgCoralTypes = ['brainCoral', 'mushroom', 'fanCoral', 'tableCoral', 'flowerCoral',
                          'pinkStaghorn', 'orangeTree', 'greenBrain', 'yellowMushroom'];
    for (let i = 0; i < fgCoralTypes.length; i++) {
      const type = fgCoralTypes[i];
      const x = ((i / fgCoralTypes.length) - 0.5) * tankWidth * 0.9 + (Math.random() - 0.5) * 2;
      const z = tankDepth * 0.2 + Math.random() * tankDepth * 0.2;
      const coral = this.addCoral(type, new THREE.Vector3(x, 0, z));
      coral.scale.multiplyScalar(1.5 + Math.random() * 0.8); // Extra large foreground coral
    }
  }

  clearAll() {
    this.corals.forEach(c => this.aquariumScene.scene.remove(c.mesh));
    this.corals = [];
  }

  getDebugInfo() {
    const typeCounts = {};
    this.corals.forEach(c => { typeCounts[c.type] = (typeCounts[c.type] || 0) + 1; });
    return {
      name: 'Coral',
      params: {
        totalCoral: this.corals.length,
        types: Object.entries(typeCounts).map(([t, n]) => `${t}: ${n}`).join(', '),
      },
    };
  }
}
