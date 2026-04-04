import * as THREE from 'three';

// Caustics fragment — realistic pool-bottom ripple effect
// Based on dual-layer voronoi with animated cell boundaries
const causticsFragment = /* glsl */`
uniform float uTime;
uniform vec3 uCausticColor;
uniform float uCausticIntensity;
uniform float uCausticScale;
varying vec2 vUv;
varying vec3 vWorldPos;

// High quality hash for voronoi cells
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Voronoi distance field with animated cells
float voronoiDist(vec2 p, float timeOffset) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md = 8.0;
  float md2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      // Smooth, slow animation — cells drift naturally
      o = 0.5 + 0.5 * sin(uTime * 0.6 + timeOffset + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md2 = md; md = d; }
      else if (d < md2) { md2 = d; }
    }
  }
  // Edge detection: difference between nearest and second-nearest cell
  return md2 - md;
}

// Multi-octave caustic for realistic pool-bottom look
float caustic(vec2 uv) {
  // Two overlapping voronoi layers at different scales and speeds
  float c1 = voronoiDist(uv * uCausticScale, 0.0);
  float c2 = voronoiDist(uv * uCausticScale * 1.4 + vec2(3.7, 1.2), 2.5);
  float c3 = voronoiDist(uv * uCausticScale * 0.7 + vec2(-1.5, 4.1), 5.0);

  // Combine: bright lines where cell edges overlap
  float combined = c1 * c2 * 4.0 + c3 * 0.3;

  // Sharpen for that bright-line caustic look
  return pow(combined, 0.8);
}

void main() {
  vec2 uv = vWorldPos.xz * 0.25;
  float c = caustic(uv);

  // Bright caustic lines with subtle color variation
  vec3 color = uCausticColor * c * uCausticIntensity;
  // Add warmer tint to brightest caustics
  color += vec3(0.1, 0.08, 0.02) * c * c * uCausticIntensity;

  gl_FragColor = vec4(color, c * 0.5);
}
`;

const causticsVertex = /* glsl */`
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// Refraction distortion — screen-space post effect (applied as overlay plane)
const refractionFragment = /* glsl */`
uniform float uTime;
uniform float uDistortion;
varying vec2 vUv;

void main() {
  float wave = sin(vUv.x * 20.0 + uTime * 1.5) * cos(vUv.y * 15.0 + uTime * 0.8);
  float distort = wave * uDistortion * 0.003;
  // Subtle blue-green tint with wave distortion
  vec3 tint = vec3(0.02, 0.05, 0.12) * (0.5 + 0.5 * sin(uTime * 0.3 + vUv.y * 3.0));
  gl_FragColor = vec4(tint, 0.08 + distort);
}
`;

const simpleVertex = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export class WaterEffects {
  constructor(aquariumScene) {
    this.scene = aquariumScene;
    this.params = {
      causticIntensity: 1.8,
      causticScale: 3.0,
      causticColor: new THREE.Color(0.2, 0.4, 0.6),
      refractionDistortion: 1.0,
    };

    this._createCaustics();
    this._createRefraction();
  }

  _createCaustics() {
    const { tankWidth, tankDepth } = this.scene.params;
    const geo = new THREE.PlaneGeometry(tankWidth * 2, tankDepth * 2);
    this.causticMaterial = new THREE.ShaderMaterial({
      vertexShader: causticsVertex,
      fragmentShader: causticsFragment,
      uniforms: {
        uTime: { value: 0 },
        uCausticColor: { value: this.params.causticColor },
        uCausticIntensity: { value: this.params.causticIntensity },
        uCausticScale: { value: this.params.causticScale },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.causticPlane = new THREE.Mesh(geo, this.causticMaterial);
    this.causticPlane.rotation.x = -Math.PI / 2;
    this.causticPlane.position.y = 0.05; // just above sand
    this.scene.scene.add(this.causticPlane);
  }

  _createRefraction() {
    // Full-screen overlay for subtle water distortion
    const geo = new THREE.PlaneGeometry(2, 2);
    this.refractionMaterial = new THREE.ShaderMaterial({
      vertexShader: simpleVertex,
      fragmentShader: refractionFragment,
      uniforms: {
        uTime: { value: 0 },
        uDistortion: { value: this.params.refractionDistortion },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.refractionPlane = new THREE.Mesh(geo, this.refractionMaterial);
    this.refractionPlane.renderOrder = 999;
    this.refractionPlane.frustumCulled = false;
    // Add to camera so it's always in front
    this.scene.camera.add(this.refractionPlane);
    this.refractionPlane.position.z = -1;
    this.scene.scene.add(this.scene.camera);
  }

  update(elapsed) {
    this.causticMaterial.uniforms.uTime.value = elapsed;
    this.refractionMaterial.uniforms.uTime.value = elapsed;
  }

  getDebugInfo() {
    return {
      name: 'Water Effects',
      params: {
        causticIntensity: this.params.causticIntensity.toFixed(2),
        causticScale: this.params.causticScale.toFixed(1),
        refractionDistortion: this.params.refractionDistortion.toFixed(2),
      }
    };
  }
}
