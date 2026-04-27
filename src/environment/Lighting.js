import * as THREE from 'three';

// Volumetric light shaft shader — noise-softened edges, internal density variation
const volumetricVertex = /* glsl */`
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const volumetricFragment = /* glsl */`
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uFalloff;
varying vec2 vUv;
varying vec3 vWorldPos;

// 3D noise for natural-looking shaft edges and density
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise3(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main() {
  // Soft radial falloff from center axis
  float distFromCenter = length(vUv.xy - vec2(0.5, 0.5));
  float cone = 1.0 - smoothstep(0.0, 0.45, distFromCenter);
  cone = cone * cone;

  // Noise-based edge softening — makes shaft edges organic, not geometric
  vec3 noiseCoord = vWorldPos * 0.3 + vec3(0.0, -uTime * 0.15, 0.0);
  float edgeNoise = snoise3(noiseCoord) * 0.4 + snoise3(noiseCoord * 2.1) * 0.2;
  cone *= smoothstep(-0.1, 0.2, cone + edgeNoise * 0.3);

  // Vertical falloff with top fade-in
  float yFade = pow(vUv.y, uFalloff) * smoothstep(0.0, 0.1, vUv.y);

  // Internal density variation — dust/particles drifting in beam
  float densityNoise = snoise3(vWorldPos * 0.5 + vec3(uTime * 0.05, -uTime * 0.12, uTime * 0.03));
  float density = 0.6 + 0.4 * densityNoise;

  // Floating dust particles — bright specks
  float dustNoise = snoise3(vWorldPos * 3.0 + vec3(0.0, -uTime * 0.3, 0.0));
  float dustSpeck = smoothstep(0.6, 0.8, dustNoise) * 0.3;

  float alpha = cone * yFade * uIntensity * density + dustSpeck * cone * yFade;
  gl_FragColor = vec4(uColor, alpha * 0.15);
}
`;

const causticVertex = /* glsl */`
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const causticFragment = /* glsl */`
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uIntensity;
uniform float uScale;
varying vec2 vUv;
varying vec3 vWorldPos;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float softCell(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float m = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      float h = hash21(i + g);
      vec2 o = 0.5 + 0.38 * sin(uTime * 0.18 + 6.2831 * vec2(h, hash21(i + g + 7.1)));
      vec2 r = g + o - f;
      m = min(m, dot(r, r));
    }
  }
  return m;
}

void main() {
  vec2 drift = vec2(uTime * 0.025, -uTime * 0.018);
  vec2 uv = vUv * uScale + drift;
  float a = softCell(uv);
  float b = softCell(uv * 1.72 + vec2(4.1, 1.7) - drift.yx);
  float web = abs(a - b);
  float line = smoothstep(0.115, 0.018, web);
  line *= smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.72, vUv.y);

  float wave = 0.5 + 0.5 * sin(vUv.x * 5.0 + vUv.y * 3.0 + uTime * 0.14);
  vec3 col = mix(uColorA, uColorB, wave);
  gl_FragColor = vec4(col * line * uIntensity, line * 0.18 * uIntensity);
}
`;

export class LightingSystem {
  constructor(aquariumScene) {
    this.scene = aquariumScene;
    this.lights = [];
    this.accentLights = [];
    this.volumetrics = [];
    this.caustics = [];
    this.params = {
      ambientIntensity: 0.25,
      beamCount: 7,
      accentCount: 7,
      causticCount: 4,
      hueRange: { min: 220, max: 300 }, // purple-blue-red range
    };

    this._createAmbient();
    this._createAccentLights();
    this._createCausticCurtains();
    this._generateBeams();
  }

  _createAmbient() {
    // Subtle ambient — let spotlights do the dramatic work
    this.ambient = new THREE.AmbientLight(0x223355, 0.3);
    this.scene.scene.add(this.ambient);

    // Hemisphere: dark moody tones
    this.hemi = new THREE.HemisphereLight(0x334488, 0x221133, 0.4);
    this.scene.scene.add(this.hemi);

    // Key light — strong directional from above-front to illuminate fish
    this.keyLight = new THREE.DirectionalLight(0x8899cc, 0.7);
    this.keyLight.position.set(5, 15, 10);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.scene.add(this.keyLight);

    // Fill light from below (sand reflection)
    this.fill = new THREE.DirectionalLight(0x445566, 0.4);
    this.fill.position.set(0, -2, 0);
    this.scene.scene.add(this.fill);

    // Rim light from behind for fish outlines
    this.rimLight = new THREE.DirectionalLight(0x88aacc, 0.5);
    this.rimLight.position.set(-5, 8, -10);
    this.scene.scene.add(this.rimLight);

    // Front light to illuminate foreground plants/kelp
    this.frontLight = new THREE.DirectionalLight(0x99bbdd, 0.6);
    this.frontLight.position.set(0, 4, 15);
    this.scene.scene.add(this.frontLight);
  }

  _createAccentLights() {
    const colors = [0x55ddff, 0xff4f98, 0xffb84d, 0x6cffd0, 0x7a5cff, 0x2fffd2, 0xff6fd8];
    const { tankWidth, tankHeight, tankDepth } = this.scene.params;
    for (let i = 0; i < this.params.accentCount; i++) {
      const light = new THREE.PointLight(colors[i % colors.length], 1.65, 14, 1.35);
      const t = i / Math.max(1, this.params.accentCount - 1);
      light.position.set(
        (t - 0.5) * tankWidth * 0.85,
        tankHeight * (0.35 + 0.35 * ((i + 1) % 2)),
        (i % 2 ? -1 : 1) * tankDepth * 0.34,
      );
      light.userData.base = light.position.clone();
      light.userData.phase = i * 1.73;
      this.scene.scene.add(light);
      this.accentLights.push(light);
    }
  }

  _createCausticCurtains() {
    const { tankWidth, tankHeight, tankDepth } = this.scene.params;
    const colors = [
      [0x49e8ff, 0xa25cff],
      [0x48ffd0, 0xff55b8],
      [0xffc45c, 0x66f6ff],
      [0x8b6cff, 0x2fffd2],
    ];
    for (let i = 0; i < this.params.causticCount; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: causticVertex,
        fragmentShader: causticFragment,
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color(colors[i % colors.length][0]) },
          uColorB: { value: new THREE.Color(colors[i % colors.length][1]) },
          uIntensity: { value: 0.55 + i * 0.08 },
          uScale: { value: 2.6 + i * 0.45 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const geo = new THREE.PlaneGeometry(tankWidth * 1.22, tankHeight * 1.15, 1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      const side = i % 2 === 0 ? 1 : -1;
      mesh.position.set((i - 1.5) * tankWidth * 0.16, tankHeight * 0.52, side * tankDepth * 0.43);
      mesh.rotation.y = side > 0 ? Math.PI : 0;
      mesh.rotation.z = (i - 1.5) * 0.035;
      mesh.renderOrder = 2;
      mesh.userData.phase = i * 2.11;
      mesh.userData.base = mesh.position.clone();
      this.scene.scene.add(mesh);
      this.caustics.push({ mesh, material: mat });
    }
  }

  _generateBeams() {
    // Clear existing
    this.lights.forEach(l => this.scene.scene.remove(l));
    this.volumetrics.forEach(v => this.scene.scene.remove(v.mesh));
    this.lights = [];
    this.volumetrics = [];

    const { tankWidth, tankHeight, tankDepth } = this.scene.params;
    const count = this.params.beamCount;

    for (let i = 0; i < count; i++) {
      const t = i / count;

      // Procedural color in nighttime range
      const hue = this.params.hueRange.min + Math.random() * (this.params.hueRange.max - this.params.hueRange.min);
      const saturation = 0.5 + Math.random() * 0.4;
      const lightness = 0.45 + Math.random() * 0.2;
      const color = new THREE.Color().setHSL(hue / 360, saturation, lightness);

      // Position spread across tank
      const x = (Math.random() - 0.5) * tankWidth * 0.8;
      const z = (Math.random() - 0.5) * tankDepth * 0.6;

      // Spotlight
      const spot = new THREE.SpotLight(color, 8 + Math.random() * 6, tankHeight * 4, Math.PI * (0.2 + Math.random() * 0.25), 0.4, 1.0);
      spot.position.set(x, tankHeight + 2, z);
      spot.target.position.set(x + (Math.random() - 0.5) * 4, 0, z + (Math.random() - 0.5) * 4);
      spot.userData.base = spot.position.clone();
      spot.userData.targetBase = spot.target.position.clone();
      spot.userData.phase = t * Math.PI * 2 + Math.random();
      spot.castShadow = true;
      spot.shadow.mapSize.set(512, 512);
      this.scene.scene.add(spot);
      this.scene.scene.add(spot.target);
      this.lights.push(spot);

      // Volumetric cone mesh
      const coneHeight = tankHeight + 2;
      const coneRadius = coneHeight * Math.tan(spot.angle);
      const coneGeo = new THREE.CylinderGeometry(coneRadius * 0.15, coneRadius * 1.3, coneHeight, 24, 4, true);
      const coneMat = new THREE.ShaderMaterial({
        vertexShader: volumetricVertex,
        fragmentShader: volumetricFragment,
        uniforms: {
          uColor: { value: color },
          uIntensity: { value: 0.3 + Math.random() * 0.3 },
          uTime: { value: 0 },
          uFalloff: { value: 0.5 + Math.random() * 0.5 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(x, tankHeight / 2 + 1, z);
      cone.userData.base = cone.position.clone();
      cone.userData.phase = spot.userData.phase;
      this.scene.scene.add(cone);
      this.volumetrics.push({ mesh: cone, material: coneMat, spot });
    }
  }

  regenerate() {
    this._generateBeams();
  }

  update(elapsed) {
    this.volumetrics.forEach(v => {
      v.material.uniforms.uTime.value = elapsed;
      const phase = v.spot.userData.phase;
      const base = v.spot.userData.base;
      const targetBase = v.spot.userData.targetBase;
      const swayX = Math.sin(elapsed * 0.105 + phase) * 1.5;
      const swayZ = Math.cos(elapsed * 0.085 + phase * 1.7) * 1.1;
      v.spot.position.x = base.x + swayX * 0.35;
      v.spot.position.z = base.z + swayZ * 0.25;
      v.spot.target.position.x = targetBase.x + swayX;
      v.spot.target.position.z = targetBase.z + swayZ;
      v.spot.intensity = 7.5 + Math.sin(elapsed * 0.13 + phase) * 2.5;
      v.mesh.position.x = v.mesh.userData.base.x + swayX * 0.45;
      v.mesh.position.z = v.mesh.userData.base.z + swayZ * 0.35;
      v.mesh.rotation.z = Math.sin(elapsed * 0.07 + phase) * 0.055;
    });
    for (const light of this.accentLights) {
      const base = light.userData.base;
      const phase = light.userData.phase;
      light.position.x = base.x + Math.sin(elapsed * 0.18 + phase) * 1.4;
      light.position.y = base.y + Math.sin(elapsed * 0.23 + phase * 1.9) * 0.6;
      light.position.z = base.z + Math.cos(elapsed * 0.16 + phase) * 0.8;
      light.intensity = 1.05 + Math.sin(elapsed * 0.31 + phase) * 0.35;
    }
    for (const c of this.caustics) {
      const phase = c.mesh.userData.phase;
      const base = c.mesh.userData.base;
      c.material.uniforms.uTime.value = elapsed + phase * 3.0;
      c.mesh.position.x = base.x + Math.sin(elapsed * 0.055 + phase) * 0.9;
      c.mesh.position.y = base.y + Math.sin(elapsed * 0.045 + phase * 1.4) * 0.5;
      c.mesh.rotation.z = Math.sin(elapsed * 0.04 + phase) * 0.07;
    }
  }

  getDebugInfo() {
    return {
      name: 'Lighting',
      params: {
        beams: this.lights.length,
        accents: this.accentLights.length,
        caustics: this.caustics.length,
        ambient: this.params.ambientIntensity.toFixed(3),
        hueRange: `${this.params.hueRange.min}-${this.params.hueRange.max}`,
      },
      beams: this.lights.map((l, i) => ({
        index: i,
        color: '#' + l.color.getHexString(),
        intensity: l.intensity.toFixed(1),
        pos: `${l.position.x.toFixed(1)}, ${l.position.y.toFixed(1)}, ${l.position.z.toFixed(1)}`,
        angle: (l.angle * 180 / Math.PI).toFixed(0) + 'deg',
      })),
    };
  }
}
