import * as THREE from 'three';

// Vertex shader with undulation via layered sine + noise
const plantVertex = /* glsl */`
uniform float uTime;
uniform float uSwayAmount;
uniform float uSwaySpeed;
uniform float uCurrentStrength;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vNormal = normalMatrix * normal;

  vec3 pos = position;

  // Height-dependent sway — tips move more than roots
  float heightFactor = uv.y; // 0=root, 1=tip
  float sway = sin(uTime * uSwaySpeed + pos.x * 2.0 + pos.z * 1.5) * uSwayAmount * heightFactor;
  float sway2 = sin(uTime * uSwaySpeed * 0.7 + pos.x * 1.3 + pos.z * 2.2 + 1.5) * uSwayAmount * 0.5 * heightFactor;

  // Current — global directional push
  float current = sin(uTime * 0.3) * uCurrentStrength * heightFactor;

  pos.x += sway + current;
  pos.z += sway2;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const plantFragment = /* glsl */`
uniform vec3 uColor;
uniform vec3 uColorTip;
uniform float uTranslucency;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  // Rich gradient from base to tip with smooth blending
  float gradT = smoothstep(0.0, 1.0, vUv.y);
  vec3 col = mix(uColor, uColorTip, gradT);

  // Multi-directional lighting for depth
  vec3 lightDir1 = normalize(vec3(0.3, 1.0, 0.2));
  vec3 lightDir2 = normalize(vec3(-0.2, 0.5, 0.8));  // front fill
  float diff1 = max(dot(vNormal, lightDir1), 0.0);
  float diff2 = max(dot(vNormal, lightDir2), 0.0) * 0.5;
  float diff = (diff1 + diff2) * 0.5 + 0.4; // keep minimum brightness
  col *= diff;

  // Translucency — light shining through leaves
  float backLight = max(dot(-vNormal, lightDir1), 0.0) * uTranslucency;
  col += backLight * uColorTip * 0.4;

  // Subtle rim lighting for leaf edges
  float rim = 1.0 - max(dot(normalize(cameraPosition - vWorldPos), vNormal), 0.0);
  col += rim * rim * uColorTip * 0.15;

  // Self-illumination — plants glow to stay visible in dark scenes
  col += mix(uColor, uColorTip, 0.5) * 0.2;

  // Depth fog — very gentle
  float depth = length(vWorldPos - cameraPosition);
  col = mix(col, vec3(0.04, 0.05, 0.12), smoothstep(20.0, 45.0, depth));

  gl_FragColor = vec4(col, 0.92);
}
`;

// 15 plant type presets
export const PLANT_PRESETS = {
  kelp:          { height: 5.0, width: 0.3, segments: 20, bladeCount: 1,  swayAmount: 0.4, swaySpeed: 1.2, color: '#1a5c1a', colorTip: '#3a8c2a', translucency: 0.4, shape: 'blade' },
  seaGrass:      { height: 2.0, width: 0.08, segments: 12, bladeCount: 8,  swayAmount: 0.3, swaySpeed: 1.8, color: '#1a6030', colorTip: '#40a040', translucency: 0.5, shape: 'grass' },
  featherCaulerpa: { height: 1.5, width: 0.15, segments: 10, bladeCount: 6,  swayAmount: 0.2, swaySpeed: 1.0, color: '#107030', colorTip: '#20a040', translucency: 0.6, shape: 'feather' },
  bubbleAlgae:   { height: 0.6, width: 0.4, segments: 8,  bladeCount: 5,  swayAmount: 0.1, swaySpeed: 0.8, color: '#208040', colorTip: '#40c060', translucency: 0.7, shape: 'bulb' },
  redMacro:      { height: 1.2, width: 0.2, segments: 10, bladeCount: 4,  swayAmount: 0.25, swaySpeed: 1.3, color: '#802020', colorTip: '#c03030', translucency: 0.5, shape: 'branch' },
  hairAlgae:     { height: 0.8, width: 0.02, segments: 8,  bladeCount: 20, swayAmount: 0.5, swaySpeed: 2.0, color: '#206020', colorTip: '#50a050', translucency: 0.3, shape: 'grass' },
  hornwort:      { height: 2.5, width: 0.12, segments: 15, bladeCount: 3,  swayAmount: 0.3, swaySpeed: 1.1, color: '#1a5020', colorTip: '#308030', translucency: 0.4, shape: 'needle' },
  anemone:       { height: 0.8, width: 0.06, segments: 8,  bladeCount: 15, swayAmount: 0.15, swaySpeed: 0.6, color: '#a03060', colorTip: '#e060a0', translucency: 0.6, shape: 'tentacle' },
  fanPlant:      { height: 2.0, width: 0.8, segments: 12, bladeCount: 1,  swayAmount: 0.2, swaySpeed: 0.9, color: '#604080', colorTip: '#9060c0', translucency: 0.5, shape: 'fan' },
  mossball:      { height: 0.4, width: 0.4, segments: 10, bladeCount: 1,  swayAmount: 0.02, swaySpeed: 0.5, color: '#205020', colorTip: '#306030', translucency: 0.2, shape: 'sphere' },
  cryptPlant:    { height: 1.0, width: 0.25, segments: 8,  bladeCount: 5,  swayAmount: 0.15, swaySpeed: 1.0, color: '#403020', colorTip: '#605030', translucency: 0.3, shape: 'blade' },
  vallisneria:   { height: 3.0, width: 0.06, segments: 18, bladeCount: 6,  swayAmount: 0.4, swaySpeed: 1.5, color: '#1a6020', colorTip: '#30a030', translucency: 0.5, shape: 'ribbon' },
  javaMoss:      { height: 0.3, width: 0.15, segments: 6,  bladeCount: 12, swayAmount: 0.08, swaySpeed: 0.7, color: '#1a4a1a', colorTip: '#2a6a2a', translucency: 0.3, shape: 'tuft' },
  seaLettuce:    { height: 0.6, width: 0.5, segments: 8,  bladeCount: 3,  swayAmount: 0.3, swaySpeed: 1.4, color: '#30a030', colorTip: '#60d060', translucency: 0.7, shape: 'leaf' },
  coralGrass:    { height: 0.5, width: 0.04, segments: 6,  bladeCount: 15, swayAmount: 0.2, swaySpeed: 1.6, color: '#d08040', colorTip: '#e0a060', translucency: 0.3, shape: 'grass' },
  // Lime green tall plants
  tallLimeGrass: { height: 4.0, width: 0.1, segments: 18, bladeCount: 10, swayAmount: 0.35, swaySpeed: 1.3, color: '#40a020', colorTip: '#80e040', translucency: 0.5, shape: 'grass' },
  limeKelp:      { height: 5.5, width: 0.25, segments: 22, bladeCount: 2,  swayAmount: 0.4, swaySpeed: 1.0, color: '#50b030', colorTip: '#90f050', translucency: 0.5, shape: 'blade' },
  limeVallis:    { height: 4.5, width: 0.07, segments: 20, bladeCount: 8,  swayAmount: 0.45, swaySpeed: 1.4, color: '#45a025', colorTip: '#85e045', translucency: 0.6, shape: 'ribbon' },
  // Fractal ferns — diverse colors and sizes
  fractalFern:       { height: 3.0, width: 0.4, segments: 16, bladeCount: 3, swayAmount: 0.25, swaySpeed: 0.9, color: '#2a7a1a', colorTip: '#55c035', translucency: 0.5, shape: 'fractalFern' },
  tallFern:          { height: 4.5, width: 0.5, segments: 18, bladeCount: 2, swayAmount: 0.3,  swaySpeed: 0.7, color: '#1a6a10', colorTip: '#40b028', translucency: 0.5, shape: 'fractalFern' },
  limeFern:          { height: 3.5, width: 0.45, segments: 16, bladeCount: 3, swayAmount: 0.2, swaySpeed: 0.8, color: '#50a818', colorTip: '#90e840', translucency: 0.6, shape: 'fractalFern' },
  yellowGreenFern:   { height: 2.8, width: 0.35, segments: 14, bladeCount: 4, swayAmount: 0.28, swaySpeed: 1.0, color: '#68a020', colorTip: '#b0e850', translucency: 0.6, shape: 'fractalFern' },
  darkFern:          { height: 3.2, width: 0.4, segments: 16, bladeCount: 3, swayAmount: 0.22, swaySpeed: 0.85, color: '#185818', colorTip: '#308830', translucency: 0.4, shape: 'fractalFern' },
  miniGoldenFern:    { height: 1.8, width: 0.3, segments: 12, bladeCount: 5, swayAmount: 0.15, swaySpeed: 1.1, color: '#7a8a10', colorTip: '#c0d840', translucency: 0.5, shape: 'fractalFern' },
  giantFern:         { height: 6.0, width: 0.6, segments: 20, bladeCount: 2, swayAmount: 0.35, swaySpeed: 0.6, color: '#286820', colorTip: '#50a838', translucency: 0.5, shape: 'fractalFern' },
  // Extra grass/plant variety
  yellowGrass:       { height: 2.5, width: 0.06, segments: 14, bladeCount: 12, swayAmount: 0.4, swaySpeed: 1.6, color: '#708818', colorTip: '#c0d850', translucency: 0.5, shape: 'grass' },
  shortLimeGrass:    { height: 1.5, width: 0.05, segments: 10, bladeCount: 15, swayAmount: 0.3, swaySpeed: 2.0, color: '#55b828', colorTip: '#90f060', translucency: 0.5, shape: 'grass' },
  tallRibbon:        { height: 5.0, width: 0.08, segments: 22, bladeCount: 5,  swayAmount: 0.5, swaySpeed: 1.2, color: '#358828', colorTip: '#60c848', translucency: 0.6, shape: 'ribbon' },
  emeraldBlade:      { height: 3.5, width: 0.3, segments: 18, bladeCount: 2,  swayAmount: 0.35, swaySpeed: 1.0, color: '#188848', colorTip: '#40d870', translucency: 0.5, shape: 'blade' },
  oliveGrass:        { height: 1.8, width: 0.04, segments: 10, bladeCount: 18, swayAmount: 0.35, swaySpeed: 1.8, color: '#606820', colorTip: '#a0a840', translucency: 0.4, shape: 'grass' },
  springLeaf:        { height: 0.8, width: 0.6, segments: 10, bladeCount: 2,  swayAmount: 0.25, swaySpeed: 1.2, color: '#40b040', colorTip: '#80f080', translucency: 0.7, shape: 'leaf' },
  tealNeedle:        { height: 3.0, width: 0.1, segments: 16, bladeCount: 4,  swayAmount: 0.3, swaySpeed: 1.0, color: '#186858', colorTip: '#30a888', translucency: 0.4, shape: 'needle' },
  roseTentacle:      { height: 1.0, width: 0.08, segments: 10, bladeCount: 12, swayAmount: 0.12, swaySpeed: 0.5, color: '#c04070', colorTip: '#f080a0', translucency: 0.6, shape: 'tentacle' },
  purpleFan:         { height: 2.5, width: 0.9, segments: 14, bladeCount: 1,  swayAmount: 0.2, swaySpeed: 0.8, color: '#704090', colorTip: '#a070c0', translucency: 0.5, shape: 'fan' },
};

export class PlantSystem {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.plants = []; // { mesh, material, preset }
    this.params = {
      currentStrength: 0.2,
      globalSwayMultiplier: 1.0,
    };

    this._spawnDefaults();
  }

  _createPlantGeometry(preset) {
    const p = preset;
    switch (p.shape) {
      case 'grass':
      case 'ribbon': {
        // Higher-poly blade with natural curve
        const geo = new THREE.PlaneGeometry(p.width, p.height, 4, p.segments);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const t = (y / p.height) + 0.5; // 0=bottom, 1=top
          const taper = 1.0 - t * 0.7;
          pos.setX(i, pos.getX(i) * taper);
          // Natural arc — leaf curves slightly
          pos.setZ(i, (pos.getZ(i) || 0) + Math.sin(t * Math.PI) * p.width * 0.3);
          pos.setY(i, y + p.height / 2);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'blade': {
        // Broader leaf with wavy edges and more polys
        const segs = Math.max(p.segments, 16);
        const geo = new THREE.PlaneGeometry(p.width, p.height, 6, segs);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const x = pos.getX(i);
          const t = (y / p.height) + 0.5;
          // Leaf shape: wider in middle, tapered at ends
          const leafShape = Math.sin(t * Math.PI) * 1.3;
          const taper = Math.max(0.1, leafShape);
          pos.setX(i, x * taper);
          // Wavy edge
          const wave = Math.sin(t * Math.PI * 4) * p.width * 0.08;
          pos.setX(i, pos.getX(i) + (Math.abs(x) > p.width * 0.3 ? wave : 0));
          // Natural curl
          pos.setZ(i, Math.sin(t * Math.PI * 0.8) * p.width * 0.4);
          pos.setY(i, y + p.height / 2);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'needle': {
        // Pine-like needles — thin with slight curve
        const geo = new THREE.PlaneGeometry(p.width * 0.5, p.height, 2, p.segments);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const t = (y / p.height) + 0.5;
          pos.setX(i, pos.getX(i) * (1.0 - t * 0.9));
          pos.setZ(i, Math.sin(t * Math.PI) * p.width * 0.2);
          pos.setY(i, y + p.height / 2);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'feather': {
        // Fern frond — central stem with sub-blades
        return this._createFrondGeometry(p);
      }
      case 'branch': {
        // Branching plant with sub-fronds
        return this._createBranchGeometry(p);
      }
      case 'leaf': {
        // Broad undulating leaf (sea lettuce)
        const geo = new THREE.PlaneGeometry(p.width, p.height, 10, 10);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const t = (y / p.height) + 0.5;
          // Ruffled edge
          const ruffle = Math.sin(x * 12 + y * 8) * 0.05 + Math.sin(x * 6 - y * 5) * 0.03;
          pos.setZ(i, ruffle + Math.sin(t * Math.PI) * 0.08);
          pos.setY(i, y + p.height / 2);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'tentacle': {
        // Anemone tentacle — thin cylinder tapering
        const geo = new THREE.CylinderGeometry(p.width * 0.3, p.width, p.height, 6, p.segments);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          pos.setY(i, y + p.height / 2);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'tuft': {
        // Small tufty moss — clustered short blades
        const geo = new THREE.PlaneGeometry(p.width, p.height, 2, 6);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const t = (y / p.height) + 0.5;
          pos.setX(i, pos.getX(i) * (1.0 - t * 0.5));
          pos.setY(i, y + p.height / 2);
          pos.setZ(i, Math.random() * 0.02);
        }
        geo.computeVertexNormals();
        return geo;
      }
      case 'bulb': {
        return new THREE.SphereGeometry(p.width * 0.5, 8, 8);
      }
      case 'sphere': {
        return new THREE.SphereGeometry(p.width * 0.5, 12, 12);
      }
      case 'fan': {
        // Fan-shaped plant with more detail
        const shape = new THREE.Shape();
        const steps = 24;
        shape.moveTo(0, 0);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const angle = -Math.PI * 0.4 + t * Math.PI * 0.8;
          const r = p.height * (0.8 + Math.sin(t * Math.PI * 6) * 0.05);
          shape.lineTo(Math.sin(angle) * p.width * 0.5, Math.cos(angle) * r * 0.5 + p.height * 0.3);
        }
        shape.lineTo(0, 0);
        return new THREE.ShapeGeometry(shape, 12);
      }
      case 'fractalFern': {
        return this._createFractalFernGeometry(p);
      }
      default: {
        const geo = new THREE.PlaneGeometry(p.width, p.height, 2, p.segments);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setY(i, pos.getY(i) + p.height / 2);
        }
        geo.computeVertexNormals();
        return geo;
      }
    }
  }

  // Fern frond: central stem with alternating leaflets
  _createFrondGeometry(p) {
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const uvs = [];
    const indices = [];
    const stemSegments = 16;
    const leafletsPerSide = 8;

    // Stem
    for (let i = 0; i <= stemSegments; i++) {
      const t = i / stemSegments;
      const y = t * p.height;
      const stemW = p.width * 0.1 * (1 - t * 0.5);
      verts.push(-stemW, y, 0,  stemW, y, 0);
      uvs.push(0.5 - 0.02, t,  0.5 + 0.02, t);
    }
    for (let i = 0; i < stemSegments; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c,  b, d, c);
    }

    // Leaflets branching from stem
    let vertOffset = (stemSegments + 1) * 2;
    for (let side = -1; side <= 1; side += 2) {
      for (let li = 0; li < leafletsPerSide; li++) {
        const t = 0.1 + (li / leafletsPerSide) * 0.85;
        const y = t * p.height;
        const leafLen = p.width * 2.0 * (1 - t * 0.4) * (0.5 + 0.5 * Math.sin(t * Math.PI));
        const leafW = p.width * 0.3;
        const angle = side * (0.3 + t * 0.2);

        // 4 verts per leaflet (quad)
        const baseX = 0;
        const tipX = side * leafLen * Math.cos(angle);
        const tipY = y + leafLen * Math.sin(angle) * 0.3;

        verts.push(baseX, y - leafW * 0.3, 0);
        verts.push(baseX, y + leafW * 0.3, 0);
        verts.push(tipX, tipY - leafW * 0.15, side * 0.03);
        verts.push(tipX, tipY + leafW * 0.15, side * 0.03);

        const u = side > 0 ? 1 : 0;
        uvs.push(0.5, t - 0.02,  0.5, t + 0.02,  u, t - 0.01,  u, t + 0.01);

        indices.push(vertOffset, vertOffset + 1, vertOffset + 2);
        indices.push(vertOffset + 1, vertOffset + 3, vertOffset + 2);
        vertOffset += 4;
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // Branching plant — simple recursive branching
  _createBranchGeometry(p) {
    const verts = [];
    const uvs = [];
    const indices = [];

    const addBranch = (startX, startY, angle, length, width, depth) => {
      if (depth <= 0 || length < 0.05) return;
      const endX = startX + Math.sin(angle) * length;
      const endY = startY + Math.cos(angle) * length;
      const vo = verts.length / 3;
      const perpX = Math.cos(angle) * width;
      const perpY = -Math.sin(angle) * width;

      verts.push(startX - perpX, startY - perpY, 0);
      verts.push(startX + perpX, startY + perpY, 0);
      verts.push(endX - perpX * 0.5, endY - perpY * 0.5, 0);
      verts.push(endX + perpX * 0.5, endY + perpY * 0.5, 0);

      const t = startY / p.height;
      uvs.push(0.4, t, 0.6, t, 0.45, t + 0.1, 0.55, t + 0.1);
      indices.push(vo, vo + 1, vo + 2, vo + 1, vo + 3, vo + 2);

      // Branch out
      addBranch(endX, endY, angle - 0.4 - Math.random() * 0.3, length * 0.65, width * 0.6, depth - 1);
      addBranch(endX, endY, angle + 0.4 + Math.random() * 0.3, length * 0.65, width * 0.6, depth - 1);
    };

    addBranch(0, 0, 0, p.height * 0.5, p.width * 0.15, 4);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // Proper fractal fern — multiple fronds with detailed jagged leaflets
  // Inspired by Barnsley fern fractal + natural fern morphology
  _createFractalFernGeometry(p) {
    const verts = [];
    const uvs = [];
    const indices = [];
    let maxVerts = 0;

    // Add a jagged leaf (pinnule) — the smallest unit
    const addLeaf = (ox, oy, oz, angle, length, width) => {
      if (maxVerts > 8000) return; // safety limit
      const segs = 5;
      const vo = verts.length / 3;

      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = ox + Math.sin(angle) * length * t;
        const y = oy + Math.cos(angle) * length * t;
        // Jagged edge — serrated leaf shape
        const jaggedW = width * (1 - t * 0.7) * (1 + Math.sin(t * Math.PI * 4) * 0.3);
        const perpX = Math.cos(angle) * jaggedW;
        const perpY = -Math.sin(angle) * jaggedW;
        verts.push(x - perpX, y - perpY, oz);
        verts.push(x + perpX, y + perpY, oz);
        uvs.push(0.5 - jaggedW / (p.width || 0.4), t);
        uvs.push(0.5 + jaggedW / (p.width || 0.4), t);
        maxVerts += 2;
      }
      for (let i = 0; i < segs; i++) {
        const a = vo + i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    };

    // Add a pinna (secondary branch with leaflets)
    const addPinna = (ox, oy, oz, angle, length, width, leafCount) => {
      if (maxVerts > 8000) return;
      // Draw thin stem
      const vo = verts.length / 3;
      const stemSegs = 3;
      for (let i = 0; i <= stemSegs; i++) {
        const t = i / stemSegs;
        const x = ox + Math.sin(angle) * length * t;
        const y = oy + Math.cos(angle) * length * t;
        const sw = width * 0.15 * (1 - t * 0.5);
        verts.push(x - sw, y, oz);
        verts.push(x + sw, y, oz);
        uvs.push(0.48, t); uvs.push(0.52, t);
        maxVerts += 2;
      }
      for (let i = 0; i < stemSegs; i++) {
        const a = vo + i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, b, c, b, d, c);
      }

      // Alternate leaflets along the pinna
      for (let i = 0; i < leafCount; i++) {
        const t = 0.1 + (i / leafCount) * 0.85;
        const bx = ox + Math.sin(angle) * length * t;
        const by = oy + Math.cos(angle) * length * t;
        const side = i % 2 === 0 ? 1 : -1;
        const leafAngle = angle + side * (0.5 + Math.random() * 0.2);
        const leafLen = length * 0.4 * (1 - t * 0.3);
        const leafW = width * 0.3;
        addLeaf(bx, by, oz + side * 0.01, leafAngle, leafLen, leafW);
      }
    };

    // Add a full frond (primary branch with pinnae)
    const addFrond = (ox, oy, angle, length, width, pinnaCount) => {
      // Draw main rachis (central stem)
      const vo = verts.length / 3;
      const rachisSegs = 8;
      for (let i = 0; i <= rachisSegs; i++) {
        const t = i / rachisSegs;
        const x = ox + Math.sin(angle) * length * t;
        const y = oy + Math.cos(angle) * length * t;
        // Gentle curve
        const curve = Math.sin(t * Math.PI) * length * 0.05;
        const sw = width * 0.08 * (1 - t * 0.6);
        verts.push(x - sw + curve, y, 0);
        verts.push(x + sw + curve, y, 0);
        uvs.push(0.48, t); uvs.push(0.52, t);
        maxVerts += 2;
      }
      for (let i = 0; i < rachisSegs; i++) {
        const a = vo + i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, b, c, b, d, c);
      }

      // Add pinnae (secondary branches) along the frond
      for (let i = 0; i < pinnaCount; i++) {
        const t = 0.08 + (i / pinnaCount) * 0.85;
        const bx = ox + Math.sin(angle) * length * t;
        const by = oy + Math.cos(angle) * length * t;
        const side = i % 2 === 0 ? 1 : -1;
        const pinnaAngle = angle + side * (0.4 + t * 0.2);
        const pinnaLen = length * 0.45 * Math.sin(t * Math.PI) * (0.7 + Math.random() * 0.3);
        const pinnaW = width * 0.5;
        const leafCount = Math.max(3, Math.floor(6 * (1 - t * 0.5)));
        addPinna(bx, by, side * 0.02, pinnaAngle, pinnaLen, pinnaW, leafCount);
      }
    };

    // Generate 3-5 fronds radiating from the base
    const frondCount = 3 + Math.floor(Math.random() * 3);
    for (let f = 0; f < frondCount; f++) {
      const angle = (f / frondCount - 0.5) * 0.6 + (Math.random() - 0.5) * 0.15;
      const length = p.height * (0.7 + Math.random() * 0.3);
      const pinnaCount = 8 + Math.floor(Math.random() * 6);
      addFrond(0, 0, angle, length, p.width, pinnaCount);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  _createPlantMaterial(preset) {
    return new THREE.ShaderMaterial({
      vertexShader: plantVertex,
      fragmentShader: plantFragment,
      uniforms: {
        uTime: { value: 0 },
        uSwayAmount: { value: preset.swayAmount },
        uSwaySpeed: { value: preset.swaySpeed },
        uCurrentStrength: { value: this.params.currentStrength },
        uColor: { value: new THREE.Color(preset.color) },
        uColorTip: { value: new THREE.Color(preset.colorTip) },
        uTranslucency: { value: preset.translucency },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
  }

  addPlant(typeName, position) {
    const preset = PLANT_PRESETS[typeName] || PLANT_PRESETS.seaGrass;
    const group = new THREE.Group();
    group.position.copy(position);

    const geo = this._createPlantGeometry(preset);
    const mat = this._createPlantMaterial(preset);

    for (let i = 0; i < preset.bladeCount; i++) {
      const blade = new THREE.Mesh(geo, mat);
      const angle = (i / preset.bladeCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = preset.bladeCount > 1 ? 0.1 + Math.random() * 0.15 : 0;
      blade.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      blade.rotation.y = angle + Math.random() * 0.3;
      const scale = 0.8 + Math.random() * 0.4;
      blade.scale.setScalar(scale);
      group.add(blade);
    }

    this.aquariumScene.scene.add(group);
    this.plants.push({ mesh: group, material: mat, preset, type: typeName });
    return group;
  }

  _spawnDefaults() {
    const { tankWidth, tankDepth } = this.aquariumScene.params;
    const types = Object.keys(PLANT_PRESETS);

    // Ensure lime green tall plants and fractal ferns are well-represented
    const guaranteedTypes = ['tallLimeGrass', 'limeKelp', 'limeVallis', 'fractalFern', 'fractalFern', 'tallLimeGrass'];
    for (const type of guaranteedTypes) {
      const x = (Math.random() - 0.5) * tankWidth * 0.9;
      const z = (Math.random() - 0.5) * tankDepth * 0.8;
      this.addPlant(type, new THREE.Vector3(x, 0, z));
    }

    // Scatter ~30 more plant clusters
    for (let i = 0; i < 30; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const x = (Math.random() - 0.5) * tankWidth * 0.9;
      const z = (Math.random() - 0.5) * tankDepth * 0.8;
      this.addPlant(type, new THREE.Vector3(x, 0, z));
    }

    // Spread foreground plants across full width, more evenly distributed
    const fgTypes = ['tallLimeGrass', 'limeKelp', 'fractalFern', 'tallLimeGrass', 'limeVallis',
                     'fractalFern', 'kelp', 'seaGrass', 'fractalFern', 'tallLimeGrass',
                     'limeKelp', 'fractalFern', 'vallisneria', 'fractalFern'];
    for (let i = 0; i < fgTypes.length; i++) {
      // Distribute evenly across the full width
      const x = ((i / fgTypes.length) - 0.5) * tankWidth * 1.1 + (Math.random() - 0.5) * 2;
      const z = tankDepth * 0.2 + Math.random() * tankDepth * 0.25;
      const plant = this.addPlant(fgTypes[i], new THREE.Vector3(x, 0, z));
      plant.scale.setScalar(1.2 + Math.random() * 0.6);
    }
    // Background foliage too
    for (let i = 0; i < 8; i++) {
      const type = ['fractalFern', 'tallLimeGrass', 'limeKelp', 'vallisneria'][Math.floor(Math.random() * 4)];
      const x = (Math.random() - 0.5) * tankWidth * 1.0;
      const z = -(tankDepth * 0.15 + Math.random() * tankDepth * 0.25);
      const plant = this.addPlant(type, new THREE.Vector3(x, 0, z));
      plant.scale.setScalar(1.0 + Math.random() * 0.5);
    }
  }

  clearAll() {
    this.plants.forEach(p => this.aquariumScene.scene.remove(p.mesh));
    this.plants = [];
  }

  update(elapsed, dt) {
    for (const plant of this.plants) {
      plant.material.uniforms.uTime.value = elapsed;
      plant.material.uniforms.uCurrentStrength.value = this.params.currentStrength * this.params.globalSwayMultiplier;
    }
  }

  getDebugInfo() {
    const typeCounts = {};
    this.plants.forEach(p => { typeCounts[p.type] = (typeCounts[p.type] || 0) + 1; });
    return {
      name: 'Plants',
      params: {
        totalPlants: this.plants.length,
        currentStrength: this.params.currentStrength.toFixed(2),
        types: Object.entries(typeCounts).map(([t, n]) => `${t}: ${n}`).join(', '),
      },
    };
  }
}
