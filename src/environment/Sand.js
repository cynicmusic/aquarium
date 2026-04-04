import * as THREE from 'three';

// Procedural sand shader — fBM noise for dunes + high-freq grain
const sandVertex = /* glsl */`
uniform float uTime;
uniform float uDuneHeight;
uniform float uDuneScale;
uniform float uRippleScale;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

// Simplex-ish noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5000 * snoise(p); p *= 2.01;
  f += 0.2500 * snoise(p); p *= 2.02;
  f += 0.1250 * snoise(p); p *= 2.03;
  f += 0.0625 * snoise(p);
  return f;
}

void main() {
  vUv = uv;

  vec3 pos = position;
  vec2 wp = pos.xz;

  // Large dunes
  float dune = fbm(wp * uDuneScale * 0.1) * uDuneHeight;

  // Ripples
  float ripple = snoise(wp * uRippleScale) * 0.08;

  // Nooks and crannies — deeper depressions
  float nook = smoothstep(0.3, 0.5, fbm(wp * 0.3 + 5.0)) * -0.5;

  pos.y += dune + ripple + nook;
  vHeight = pos.y;

  // Recompute normal via finite differences
  float eps = 0.05;
  float hL = fbm((wp + vec2(-eps, 0.0)) * uDuneScale * 0.1) * uDuneHeight + snoise((wp + vec2(-eps, 0.0)) * uRippleScale) * 0.08;
  float hR = fbm((wp + vec2(eps, 0.0)) * uDuneScale * 0.1) * uDuneHeight + snoise((wp + vec2(eps, 0.0)) * uRippleScale) * 0.08;
  float hD = fbm((wp + vec2(0.0, -eps)) * uDuneScale * 0.1) * uDuneHeight + snoise((wp + vec2(0.0, -eps)) * uRippleScale) * 0.08;
  float hU = fbm((wp + vec2(0.0, eps)) * uDuneScale * 0.1) * uDuneHeight + snoise((wp + vec2(0.0, eps)) * uRippleScale) * 0.08;
  vNormal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const sandFragment = /* glsl */`
uniform vec3 uSandColor;
uniform vec3 uSandColorDark;
uniform float uTime;
uniform float uGrainScale;
uniform int uTextureType;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float grain(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  // Sand grain texture
  float g = grain(vWorldPos.xz * uGrainScale);
  float g2 = grain(vWorldPos.xz * uGrainScale * 3.7 + 100.0);

  // Mix sand colors based on height and grain
  vec3 col = mix(uSandColorDark, uSandColor, 0.5 + 0.5 * g);
  col += (g2 - 0.5) * 0.06; // fine grain variation

  // Height-based darkening for nooks
  col *= 0.8 + 0.2 * smoothstep(-0.5, 0.3, vHeight);

  // Simple diffuse lighting from above
  vec3 lightDir = normalize(vec3(0.2, 1.0, 0.3));
  float diff = max(dot(vNormal, lightDir), 0.0) * 0.6 + 0.4;
  col *= diff;

  // Slight depth fog
  float depth = length(vWorldPos - cameraPosition);
  col = mix(col, vec3(0.02, 0.04, 0.08), smoothstep(10.0, 35.0, depth));

  gl_FragColor = vec4(col, 1.0);
}
`;

export class SandTerrain {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.params = {
      sandColor: new THREE.Color(0.76, 0.65, 0.45),
      sandColorDark: new THREE.Color(0.4, 0.33, 0.22),
      duneHeight: 0.8,
      duneScale: 1.0,
      rippleScale: 8.0,
      grainScale: 40.0,
      textureType: 0, // 0=default, 1=fine, 2=coarse, 3=rocky
    };

    this._create();
  }

  _create() {
    const { tankWidth, tankDepth } = this.aquariumScene.params;
    // High-res plane for vertex displacement
    const geo = new THREE.PlaneGeometry(tankWidth * 2.5, tankDepth * 2.5, 200, 200);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: sandVertex,
      fragmentShader: sandFragment,
      uniforms: {
        uTime: { value: 0 },
        uSandColor: { value: this.params.sandColor },
        uSandColorDark: { value: this.params.sandColorDark },
        uDuneHeight: { value: this.params.duneHeight },
        uDuneScale: { value: this.params.duneScale },
        uRippleScale: { value: this.params.rippleScale },
        uGrainScale: { value: this.params.grainScale },
        uTextureType: { value: this.params.textureType },
      },
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.aquariumScene.scene.add(this.mesh);
  }

  updateParams(params) {
    Object.assign(this.params, params);
    const u = this.material.uniforms;
    if (params.sandColor) u.uSandColor.value = params.sandColor;
    if (params.sandColorDark) u.uSandColorDark.value = params.sandColorDark;
    if (params.duneHeight !== undefined) u.uDuneHeight.value = params.duneHeight;
    if (params.duneScale !== undefined) u.uDuneScale.value = params.duneScale;
    if (params.rippleScale !== undefined) u.uRippleScale.value = params.rippleScale;
    if (params.grainScale !== undefined) u.uGrainScale.value = params.grainScale;
  }

  getDebugInfo() {
    return {
      name: 'Sand Terrain',
      params: {
        duneHeight: this.params.duneHeight.toFixed(2),
        duneScale: this.params.duneScale.toFixed(2),
        rippleScale: this.params.rippleScale.toFixed(1),
        grainScale: this.params.grainScale.toFixed(0),
        textureType: ['default', 'fine', 'coarse', 'rocky'][this.params.textureType],
      }
    };
  }
}
