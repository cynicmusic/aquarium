/**
 * swim/plants.js — standalone plant factory for swim-mode world.
 *
 * Refactor notes vs. environment/PlantSystem.js:
 *   - No class wrapping a scene ref. Factory functions take a position, return
 *     a THREE.Group. Caller owns the scene graph.
 *   - Shared ShaderMaterial per preset (not per-plant). 200+ plants used to
 *     allocate 200+ materials with 200+ uniform blocks; now it's one per type.
 *   - Fragment shader tints the distance-fade to the scene fog color (purple
 *     for swim mode) so far-plants blend into the fog bank.
 *   - Self-illumination bumped — scene has no real lighting, plants must glow
 *     on their own.
 */

import * as THREE from 'three';

const plantVertex = /* glsl */`
uniform float uTime;
uniform float uSwayAmount;
uniform float uSwaySpeed;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;

  vec3 pos = position;
  float h = uv.y;
  float sway1 = sin(uTime * uSwaySpeed        + pos.x * 2.0 + pos.z * 1.5) * uSwayAmount * h;
  float sway2 = sin(uTime * uSwaySpeed * 0.7  + pos.x * 1.3 + pos.z * 2.2 + 1.5) * uSwayAmount * 0.5 * h;
  pos.x += sway1;
  pos.z += sway2;

  // InstancedMesh path: three.js auto-injects an instanceMatrix attribute
  // when USE_INSTANCING is set; we have to reference it ourselves in custom
  // shaders. Rotate the normal by the instance matrix upper-left 3x3 too,
  // else lighting reads as if every blade faced the same way.
  #ifdef USE_INSTANCING
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    mat3 instNormal = mat3(instanceMatrix);
    vNormal = normalMatrix * (instNormal * normal);
  #else
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vNormal = normalMatrix * normal;
  #endif
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const plantFragment = /* glsl */`
uniform vec3 uColor;
uniform vec3 uColorTip;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTranslucency;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  float gradT = smoothstep(0.0, 1.0, vUv.y);
  vec3 col = mix(uColor, uColorTip, gradT);

  // Baked two-directional lighting (scene has no lights to spare)
  vec3 L1 = normalize(vec3(0.3, 1.0, 0.2));
  vec3 L2 = normalize(vec3(-0.2, 0.5, 0.8));
  float d1 = max(dot(vNormal, L1), 0.0);
  float d2 = max(dot(vNormal, L2), 0.0) * 0.5;
  float diff = (d1 + d2) * 0.5 + 0.45;
  col *= diff;

  // Back-lit translucency
  col += max(dot(-vNormal, L1), 0.0) * uTranslucency * uColorTip * 0.4;

  // Rim
  float rim = 1.0 - max(dot(normalize(cameraPosition - vWorldPos), vNormal), 0.0);
  col += rim * rim * uColorTip * 0.15;

  // Self-illumination so foliage stays visible in the dark purple scene
  col += mix(uColor, uColorTip, 0.5) * 0.28;

  // Fade to the purple fog color past uFogFar
  float dist = length(vWorldPos - cameraPosition);
  float fogT = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFogColor, fogT);

  gl_FragColor = vec4(col, 0.95);
}
`;

export const PLANT_PRESETS = {
  kelp:            { height: 5.0, width: 0.3,  segments: 20, bladeCount: 1,  swayAmount: 0.4,  swaySpeed: 1.2, color: '#1a5c1a', colorTip: '#3a8c2a', translucency: 0.4, shape: 'blade' },
  seaGrass:        { height: 2.0, width: 0.08, segments: 12, bladeCount: 8,  swayAmount: 0.3,  swaySpeed: 1.8, color: '#1a6030', colorTip: '#40a040', translucency: 0.5, shape: 'grass' },
  featherCaulerpa: { height: 1.5, width: 0.15, segments: 10, bladeCount: 6,  swayAmount: 0.2,  swaySpeed: 1.0, color: '#107030', colorTip: '#20a040', translucency: 0.6, shape: 'feather' },
  bubbleAlgae:     { height: 0.6, width: 0.4,  segments: 8,  bladeCount: 5,  swayAmount: 0.1,  swaySpeed: 0.8, color: '#208040', colorTip: '#40c060', translucency: 0.7, shape: 'bulb' },
  redMacro:        { height: 1.2, width: 0.2,  segments: 10, bladeCount: 4,  swayAmount: 0.25, swaySpeed: 1.3, color: '#802020', colorTip: '#c03030', translucency: 0.5, shape: 'branch' },
  hairAlgae:       { height: 0.8, width: 0.02, segments: 8,  bladeCount: 20, swayAmount: 0.5,  swaySpeed: 2.0, color: '#206020', colorTip: '#50a050', translucency: 0.3, shape: 'grass' },
  hornwort:        { height: 2.5, width: 0.12, segments: 15, bladeCount: 3,  swayAmount: 0.3,  swaySpeed: 1.1, color: '#1a5020', colorTip: '#308030', translucency: 0.4, shape: 'needle' },
  anemone:         { height: 0.8, width: 0.06, segments: 8,  bladeCount: 15, swayAmount: 0.15, swaySpeed: 0.6, color: '#a03060', colorTip: '#e060a0', translucency: 0.6, shape: 'tentacle' },
  fanPlant:        { height: 2.0, width: 0.8,  segments: 12, bladeCount: 1,  swayAmount: 0.2,  swaySpeed: 0.9, color: '#604080', colorTip: '#9060c0', translucency: 0.5, shape: 'fan' },
  mossball:        { height: 0.4, width: 0.4,  segments: 10, bladeCount: 1,  swayAmount: 0.02, swaySpeed: 0.5, color: '#205020', colorTip: '#306030', translucency: 0.2, shape: 'sphere' },
  vallisneria:     { height: 3.0, width: 0.06, segments: 18, bladeCount: 6,  swayAmount: 0.4,  swaySpeed: 1.5, color: '#1a6020', colorTip: '#30a030', translucency: 0.5, shape: 'ribbon' },
  tallLimeGrass:   { height: 4.0, width: 0.1,  segments: 18, bladeCount: 10, swayAmount: 0.35, swaySpeed: 1.3, color: '#40a020', colorTip: '#80e040', translucency: 0.5, shape: 'grass' },
  limeKelp:        { height: 5.5, width: 0.25, segments: 22, bladeCount: 2,  swayAmount: 0.4,  swaySpeed: 1.0, color: '#50b030', colorTip: '#90f050', translucency: 0.5, shape: 'blade' },
  limeVallis:      { height: 4.5, width: 0.07, segments: 20, bladeCount: 8,  swayAmount: 0.45, swaySpeed: 1.4, color: '#45a025', colorTip: '#85e045', translucency: 0.6, shape: 'ribbon' },
  fractalFern:     { height: 3.0, width: 0.4,  segments: 16, bladeCount: 3,  swayAmount: 0.25, swaySpeed: 0.9, color: '#2a7a1a', colorTip: '#55c035', translucency: 0.5, shape: 'fractalFern' },
  tallFern:        { height: 4.5, width: 0.5,  segments: 18, bladeCount: 2,  swayAmount: 0.3,  swaySpeed: 0.7, color: '#1a6a10', colorTip: '#40b028', translucency: 0.5, shape: 'fractalFern' },
  limeFern:        { height: 3.5, width: 0.45, segments: 16, bladeCount: 3,  swayAmount: 0.2,  swaySpeed: 0.8, color: '#50a818', colorTip: '#90e840', translucency: 0.6, shape: 'fractalFern' },
  yellowGreenFern: { height: 2.8, width: 0.35, segments: 14, bladeCount: 4,  swayAmount: 0.28, swaySpeed: 1.0, color: '#68a020', colorTip: '#b0e850', translucency: 0.6, shape: 'fractalFern' },
  giantFern:       { height: 6.0, width: 0.6,  segments: 20, bladeCount: 2,  swayAmount: 0.35, swaySpeed: 0.6, color: '#286820', colorTip: '#50a838', translucency: 0.5, shape: 'fractalFern' },
  yellowGrass:     { height: 2.5, width: 0.06, segments: 14, bladeCount: 12, swayAmount: 0.4,  swaySpeed: 1.6, color: '#708818', colorTip: '#c0d850', translucency: 0.5, shape: 'grass' },
  tallRibbon:      { height: 5.0, width: 0.08, segments: 22, bladeCount: 5,  swayAmount: 0.5,  swaySpeed: 1.2, color: '#358828', colorTip: '#60c848', translucency: 0.6, shape: 'ribbon' },
  emeraldBlade:    { height: 3.5, width: 0.3,  segments: 18, bladeCount: 2,  swayAmount: 0.35, swaySpeed: 1.0, color: '#188848', colorTip: '#40d870', translucency: 0.5, shape: 'blade' },
  tealNeedle:      { height: 3.0, width: 0.1,  segments: 16, bladeCount: 4,  swayAmount: 0.3,  swaySpeed: 1.0, color: '#186858', colorTip: '#30a888', translucency: 0.4, shape: 'needle' },
  roseTentacle:    { height: 1.0, width: 0.08, segments: 10, bladeCount: 12, swayAmount: 0.12, swaySpeed: 0.5, color: '#c04070', colorTip: '#f080a0', translucency: 0.6, shape: 'tentacle' },
  purpleFan:       { height: 2.5, width: 0.9,  segments: 14, bladeCount: 1,  swayAmount: 0.2,  swaySpeed: 0.8, color: '#704090', colorTip: '#a070c0', translucency: 0.5, shape: 'fan' },
};

// ── Shared per-preset caches — huge perf win for hundreds of instances ─────
const _geoCache = new Map();       // key → geometry
const _matCache = new Map();       // presetName → shader material

function _createGeometry(preset) {
  const p = preset;
  switch (p.shape) {
    case 'grass':
    case 'ribbon': {
      const geo = new THREE.PlaneGeometry(p.width, p.height, 4, p.segments);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y / p.height) + 0.5;
        const taper = 1.0 - t * 0.7;
        pos.setX(i, pos.getX(i) * taper);
        pos.setZ(i, (pos.getZ(i) || 0) + Math.sin(t * Math.PI) * p.width * 0.3);
        pos.setY(i, y + p.height / 2);
      }
      geo.computeVertexNormals();
      return geo;
    }
    case 'blade': {
      const segs = Math.max(p.segments, 16);
      const geo = new THREE.PlaneGeometry(p.width, p.height, 6, segs);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const x = pos.getX(i);
        const t = (y / p.height) + 0.5;
        const leafShape = Math.sin(t * Math.PI) * 1.3;
        const taper = Math.max(0.1, leafShape);
        pos.setX(i, x * taper);
        const wave = Math.sin(t * Math.PI * 4) * p.width * 0.08;
        pos.setX(i, pos.getX(i) + (Math.abs(x) > p.width * 0.3 ? wave : 0));
        pos.setZ(i, Math.sin(t * Math.PI * 0.8) * p.width * 0.4);
        pos.setY(i, y + p.height / 2);
      }
      geo.computeVertexNormals();
      return geo;
    }
    case 'needle': {
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
    case 'feather':      return _buildFrond(p);
    case 'branch':       return _buildBranch(p);
    case 'fractalFern':  return _buildFractalFern(p);
    case 'leaf': {
      const geo = new THREE.PlaneGeometry(p.width, p.height, 10, 10);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const t = (y / p.height) + 0.5;
        const ruffle = Math.sin(x * 12 + y * 8) * 0.05 + Math.sin(x * 6 - y * 5) * 0.03;
        pos.setZ(i, ruffle + Math.sin(t * Math.PI) * 0.08);
        pos.setY(i, y + p.height / 2);
      }
      geo.computeVertexNormals();
      return geo;
    }
    case 'tentacle': {
      const geo = new THREE.CylinderGeometry(p.width * 0.3, p.width, p.height, 6, p.segments);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + p.height / 2);
      geo.computeVertexNormals();
      return geo;
    }
    case 'bulb':   return new THREE.SphereGeometry(p.width * 0.5, 8, 8);
    case 'sphere': return new THREE.SphereGeometry(p.width * 0.5, 12, 12);
    case 'fan': {
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
    default: {
      const geo = new THREE.PlaneGeometry(p.width, p.height, 2, p.segments);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + p.height / 2);
      geo.computeVertexNormals();
      return geo;
    }
  }
}

function _buildFrond(p) {
  const verts = [], uvs = [], indices = [];
  const stemSegments = 16, leafletsPerSide = 8;
  for (let i = 0; i <= stemSegments; i++) {
    const t = i / stemSegments, y = t * p.height;
    const sw = p.width * 0.1 * (1 - t * 0.5);
    verts.push(-sw, y, 0, sw, y, 0);
    uvs.push(0.48, t, 0.52, t);
  }
  for (let i = 0; i < stemSegments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  let vo = (stemSegments + 1) * 2;
  for (let side = -1; side <= 1; side += 2) {
    for (let li = 0; li < leafletsPerSide; li++) {
      const t = 0.1 + (li / leafletsPerSide) * 0.85;
      const y = t * p.height;
      const leafLen = p.width * 2.0 * (1 - t * 0.4) * (0.5 + 0.5 * Math.sin(t * Math.PI));
      const leafW = p.width * 0.3;
      const angle = side * (0.3 + t * 0.2);
      const tipX = side * leafLen * Math.cos(angle);
      const tipY = y + leafLen * Math.sin(angle) * 0.3;
      verts.push(0, y - leafW * 0.3, 0, 0, y + leafW * 0.3, 0,
                 tipX, tipY - leafW * 0.15, side * 0.03,
                 tipX, tipY + leafW * 0.15, side * 0.03);
      const u = side > 0 ? 1 : 0;
      uvs.push(0.5, t - 0.02, 0.5, t + 0.02, u, t - 0.01, u, t + 0.01);
      indices.push(vo, vo + 1, vo + 2, vo + 1, vo + 3, vo + 2);
      vo += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function _buildBranch(p) {
  const verts = [], uvs = [], indices = [];
  const addBranch = (sx, sy, angle, length, width, depth) => {
    if (depth <= 0 || length < 0.05) return;
    const ex = sx + Math.sin(angle) * length;
    const ey = sy + Math.cos(angle) * length;
    const vo = verts.length / 3;
    const px = Math.cos(angle) * width;
    const py = -Math.sin(angle) * width;
    verts.push(sx - px, sy - py, 0, sx + px, sy + py, 0,
               ex - px * 0.5, ey - py * 0.5, 0, ex + px * 0.5, ey + py * 0.5, 0);
    const t = sy / p.height;
    uvs.push(0.4, t, 0.6, t, 0.45, t + 0.1, 0.55, t + 0.1);
    indices.push(vo, vo + 1, vo + 2, vo + 1, vo + 3, vo + 2);
    addBranch(ex, ey, angle - 0.4 - Math.random() * 0.3, length * 0.65, width * 0.6, depth - 1);
    addBranch(ex, ey, angle + 0.4 + Math.random() * 0.3, length * 0.65, width * 0.6, depth - 1);
  };
  addBranch(0, 0, 0, p.height * 0.5, p.width * 0.15, 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function _buildFractalFern(p) {
  const verts = [], uvs = [], indices = [];
  let maxVerts = 0;
  const addLeaf = (ox, oy, oz, angle, length, width) => {
    if (maxVerts > 8000) return;
    const segs = 5;
    const vo = verts.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = ox + Math.sin(angle) * length * t;
      const y = oy + Math.cos(angle) * length * t;
      const jw = width * (1 - t * 0.7) * (1 + Math.sin(t * Math.PI * 4) * 0.3);
      const px = Math.cos(angle) * jw;
      const py = -Math.sin(angle) * jw;
      verts.push(x - px, y - py, oz, x + px, y + py, oz);
      uvs.push(0.5 - jw / (p.width || 0.4), t, 0.5 + jw / (p.width || 0.4), t);
      maxVerts += 2;
    }
    for (let i = 0; i < segs; i++) {
      const a = vo + i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  };
  const addPinna = (ox, oy, oz, angle, length, width, leafCount) => {
    if (maxVerts > 8000) return;
    const vo = verts.length / 3;
    const stemSegs = 3;
    for (let i = 0; i <= stemSegs; i++) {
      const t = i / stemSegs;
      const x = ox + Math.sin(angle) * length * t;
      const y = oy + Math.cos(angle) * length * t;
      const sw = width * 0.15 * (1 - t * 0.5);
      verts.push(x - sw, y, oz, x + sw, y, oz);
      uvs.push(0.48, t, 0.52, t);
      maxVerts += 2;
    }
    for (let i = 0; i < stemSegs; i++) {
      const a = vo + i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    for (let i = 0; i < leafCount; i++) {
      const t = 0.1 + (i / leafCount) * 0.85;
      const bx = ox + Math.sin(angle) * length * t;
      const by = oy + Math.cos(angle) * length * t;
      const side = i % 2 === 0 ? 1 : -1;
      const leafAngle = angle + side * (0.5 + Math.random() * 0.2);
      const leafLen = length * 0.4 * (1 - t * 0.3);
      addLeaf(bx, by, oz + side * 0.01, leafAngle, leafLen, width * 0.3);
    }
  };
  const addFrond = (ox, oy, angle, length, width, pinnaCount) => {
    const vo = verts.length / 3;
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = ox + Math.sin(angle) * length * t;
      const y = oy + Math.cos(angle) * length * t;
      const curve = Math.sin(t * Math.PI) * length * 0.05;
      const sw = width * 0.08 * (1 - t * 0.6);
      verts.push(x - sw + curve, y, 0, x + sw + curve, y, 0);
      uvs.push(0.48, t, 0.52, t);
      maxVerts += 2;
    }
    for (let i = 0; i < segs; i++) {
      const a = vo + i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    for (let i = 0; i < pinnaCount; i++) {
      const t = 0.08 + (i / pinnaCount) * 0.85;
      const bx = ox + Math.sin(angle) * length * t;
      const by = oy + Math.cos(angle) * length * t;
      const side = i % 2 === 0 ? 1 : -1;
      const pAngle = angle + side * (0.4 + t * 0.2);
      const pLen = length * 0.45 * Math.sin(t * Math.PI) * (0.7 + Math.random() * 0.3);
      const leafCount = Math.max(3, Math.floor(6 * (1 - t * 0.5)));
      addPinna(bx, by, side * 0.02, pAngle, pLen, width * 0.5, leafCount);
    }
  };
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

function _getOrCreateMaterial(presetName, preset, fog) {
  let mat = _matCache.get(presetName);
  if (mat) return mat;
  mat = new THREE.ShaderMaterial({
    vertexShader: plantVertex,
    fragmentShader: plantFragment,
    uniforms: {
      uTime:         { value: 0 },
      uSwayAmount:   { value: preset.swayAmount },
      uSwaySpeed:    { value: preset.swaySpeed },
      uColor:        { value: new THREE.Color(preset.color) },
      uColorTip:     { value: new THREE.Color(preset.colorTip) },
      uTranslucency: { value: preset.translucency },
      uFogColor:     { value: fog.color.clone() },
      uFogNear:      { value: fog.near },
      uFogFar:       { value: fog.far },
    },
    side: THREE.DoubleSide,
    transparent: true,
  });
  _matCache.set(presetName, mat);
  return mat;
}

/**
 * Create a plant group at `position`.
 *
 * @param {string} typeName   key into PLANT_PRESETS
 * @param {THREE.Vector3} position
 * @param {{color: THREE.Color, near: number, far: number}} fog  scene fog descriptor (plants fade into this color past `far`)
 * @returns {THREE.Group}
 */
export function createPlant(typeName, position, fog) {
  const preset = PLANT_PRESETS[typeName] || PLANT_PRESETS.seaGrass;
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.plantType = typeName;

  // fractalFern and branch geometries are per-instance randomized; don't cache them
  const geoKey = (preset.shape === 'fractalFern' || preset.shape === 'branch')
    ? null
    : typeName;
  let geo = geoKey && _geoCache.get(geoKey);
  if (!geo) {
    geo = _createGeometry(preset);
    if (geoKey) _geoCache.set(geoKey, geo);
  }

  const mat = _getOrCreateMaterial(typeName, preset, fog);

  for (let i = 0; i < preset.bladeCount; i++) {
    const blade = new THREE.Mesh(geo, mat);
    const angle = (i / preset.bladeCount) * Math.PI * 2 + Math.random() * 0.5;
    const radius = preset.bladeCount > 1 ? 0.1 + Math.random() * 0.15 : 0;
    blade.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    blade.rotation.y = angle + Math.random() * 0.3;
    blade.scale.setScalar(0.8 + Math.random() * 0.4);
    group.add(blade);
  }
  return group;
}

/** Tick every plant material's uTime (once per frame, not per instance). */
export function updatePlants(elapsed) {
  for (const mat of _matCache.values()) {
    mat.uniforms.uTime.value = elapsed;
  }
}

/** Dispose all cached materials/geometries — call on scene teardown. */
export function disposePlants() {
  for (const g of _geoCache.values()) g.dispose();
  for (const m of _matCache.values()) m.dispose();
  _geoCache.clear();
  _matCache.clear();
}

// ── Instanced bucket API ───────────────────────────────────────────────────
// Collapses N plants of the same preset into a single InstancedMesh draw call.
// Geometry is shared via _geoCache (already done) — the win here is collapsing
// N per-plant Mesh objects into 1 draw call. fractalFern + branch shapes have
// per-instance random geometry so they stay non-instanceable; the caller must
// fall back to createPlant() for those.

export function isPlantInstanceable(typeName) {
  const preset = PLANT_PRESETS[typeName];
  return !!preset && preset.shape !== 'fractalFern' && preset.shape !== 'branch';
}

/**
 * Build one InstancedMesh holding every blade of every plant of `typeName`
 * at the given positions. Each plant contributes `preset.bladeCount` instances
 * (matching the old per-plant Group of N blades).
 *
 * Returns a bucket interface:
 *   .mesh                            — THREE.InstancedMesh (add to scene)
 *   .plantCount, .bladeCount         — ints
 *   .setPlantPosition(plantIdx, pos) — moves the plant's whole blade fan;
 *                                       also re-randomizes its outer rotation
 *                                       (matches the old recycler behaviour).
 *                                       Caller batches multiple updates and
 *                                       calls .commit() once per frame.
 *   .commit()                        — flags instanceMatrix dirty
 *   .dispose()                       — drops cached state for the bucket
 *                                       (geometry/material survive in caches)
 *
 * Returns null if the preset isn't instanceable.
 */
export function createPlantBucket(typeName, positions, fog) {
  if (!isPlantInstanceable(typeName)) return null;
  if (!positions.length) return null;
  const preset = PLANT_PRESETS[typeName] || PLANT_PRESETS.seaGrass;

  let geo = _geoCache.get(typeName);
  if (!geo) {
    geo = _createGeometry(preset);
    _geoCache.set(typeName, geo);
  }
  const mat = _getOrCreateMaterial(typeName, preset, fog);

  const bladeCount = preset.bladeCount;
  const plantCount = positions.length;
  const totalInstances = plantCount * bladeCount;

  const instMesh = new THREE.InstancedMesh(geo, mat, totalInstances);
  // Recycler moves instances around — frustum-cull bbox is invalidated by
  // matrix updates. Disable per-instance culling; the InstancedMesh is one
  // draw call regardless.
  instMesh.frustumCulled = false;

  // Per-plant outer transform (captures the scatter loop's per-plant scale +
  // rotation.y randomization). Position is what the recycler updates.
  const plantOuter = new Array(plantCount);
  // Per-plant per-blade local transforms (captures the createPlant() blade
  // randomization so each plant has its own internal arrangement). Generated
  // once at build, preserved across recycles so the same logical plant keeps
  // its identity.
  const bladeLocals = new Array(plantCount);
  for (let p = 0; p < plantCount; p++) {
    plantOuter[p] = {
      pos:   positions[p].clone(),
      scale: 0.8 + Math.random() * 0.7,
      rotY:  Math.random() * Math.PI * 2,
    };
    const blades = new Array(bladeCount);
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = bladeCount > 1 ? 0.1 + Math.random() * 0.15 : 0;
      blades[i] = {
        offsetX: Math.cos(angle) * radius,
        offsetZ: Math.sin(angle) * radius,
        rotY:    angle + Math.random() * 0.3,
        scale:   0.8 + Math.random() * 0.4,
      };
    }
    bladeLocals[p] = blades;
  }

  const _matPlant = new THREE.Matrix4();
  const _matBlade = new THREE.Matrix4();
  const _matFinal = new THREE.Matrix4();
  const _vecPos   = new THREE.Vector3();
  const _vecScale = new THREE.Vector3();
  const _quat     = new THREE.Quaternion();
  const _eulerY   = new THREE.Euler();

  function rebuildPlant(plantIdx) {
    const outer = plantOuter[plantIdx];
    _eulerY.set(0, outer.rotY, 0);
    _quat.setFromEuler(_eulerY);
    _vecScale.setScalar(outer.scale);
    _matPlant.compose(outer.pos, _quat, _vecScale);

    const blades = bladeLocals[plantIdx];
    for (let i = 0; i < bladeCount; i++) {
      const b = blades[i];
      _vecPos.set(b.offsetX, 0, b.offsetZ);
      _eulerY.set(0, b.rotY, 0);
      _quat.setFromEuler(_eulerY);
      _vecScale.setScalar(b.scale);
      _matBlade.compose(_vecPos, _quat, _vecScale);
      _matFinal.multiplyMatrices(_matPlant, _matBlade);
      instMesh.setMatrixAt(plantIdx * bladeCount + i, _matFinal);
    }
  }

  for (let p = 0; p < plantCount; p++) rebuildPlant(p);
  instMesh.instanceMatrix.needsUpdate = true;

  return {
    mesh: instMesh,
    plantCount,
    bladeCount,
    setPlantPosition(plantIdx, position) {
      const o = plantOuter[plantIdx];
      o.pos.copy(position);
      o.rotY = Math.random() * Math.PI * 2;     // matches recycler behaviour
      rebuildPlant(plantIdx);
    },
    getPlantPosition(plantIdx) {
      return plantOuter[plantIdx].pos;
    },
    commit() {
      instMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      // Geometry + material are cached at module scope and shared across
      // re-spawns; the InstancedMesh wrapper is what we drop here.
      instMesh.dispose();
    },
  };
}
