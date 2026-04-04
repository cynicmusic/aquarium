import * as THREE from 'three';

// Shimmer effect — floating particles of light
const shimmerVertex = /* glsl */`
uniform float uTime;
attribute float aOffset;
attribute float aSize;
varying float vAlpha;

void main() {
  vec3 pos = position;

  // Gentle floating drift
  pos.y += sin(uTime * 0.5 + aOffset * 6.28) * 0.3;
  pos.x += cos(uTime * 0.3 + aOffset * 4.0) * 0.2;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = aSize * (200.0 / -mvPos.z);

  // Pulsing alpha
  vAlpha = 0.3 + 0.3 * sin(uTime * 2.0 + aOffset * 10.0);
}
`;

const shimmerFragment = /* glsl */`
uniform vec3 uColor;
varying float vAlpha;

void main() {
  // Soft circle
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float alpha = smoothstep(1.0, 0.3, d) * vAlpha;
  gl_FragColor = vec4(uColor, alpha);
}
`;

// Volume glow — screen-space glow spots
const glowVertex = /* glsl */`
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const glowFragment = /* glsl */`
uniform vec3 uColor;
uniform float uIntensity;
uniform float uRadius;
uniform float uTime;
varying vec2 vUv;

void main() {
  float d = length(vUv - 0.5) * 2.0;
  float glow = exp(-d * d * 3.0 / (uRadius * uRadius));
  float pulse = 0.8 + 0.2 * sin(uTime * 1.5);
  gl_FragColor = vec4(uColor * uIntensity * pulse, glow * 0.4);
}
`;

export class EffectsSystem {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.shimmerParticles = null;
    this.glowSpots = [];
    this.params = {
      shimmerCount: 80,
      shimmerColor: new THREE.Color(0.5, 0.6, 0.8),
      glowCount: 5,
    };

    this._createShimmer();
    this._createGlowSpots();
  }

  _createShimmer() {
    const { tankWidth, tankHeight, tankDepth } = this.aquariumScene.params;
    const count = this.params.shimmerCount;

    const positions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * tankWidth;
      positions[i * 3 + 1] = Math.random() * tankHeight;
      positions[i * 3 + 2] = (Math.random() - 0.5) * tankDepth;
      offsets[i] = Math.random();
      sizes[i] = 1.0 + Math.random() * 2.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.shimmerMaterial = new THREE.ShaderMaterial({
      vertexShader: shimmerVertex,
      fragmentShader: shimmerFragment,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: this.params.shimmerColor },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.shimmerParticles = new THREE.Points(geo, this.shimmerMaterial);
    this.aquariumScene.scene.add(this.shimmerParticles);
  }

  _createGlowSpots() {
    const { tankWidth, tankHeight, tankDepth } = this.aquariumScene.params;

    for (let i = 0; i < this.params.glowCount; i++) {
      const hue = 0.55 + Math.random() * 0.25; // blue-purple range
      const color = new THREE.Color().setHSL(hue, 0.6, 0.3);

      const geo = new THREE.PlaneGeometry(4 + Math.random() * 4, 4 + Math.random() * 4);
      const mat = new THREE.ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        uniforms: {
          uColor: { value: color },
          uIntensity: { value: 0.3 + Math.random() * 0.4 },
          uRadius: { value: 0.8 + Math.random() * 0.4 },
          uTime: { value: 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * tankWidth,
        2 + Math.random() * (tankHeight - 4),
        (Math.random() - 0.5) * tankDepth,
      );
      // Face camera roughly
      mesh.lookAt(this.aquariumScene.camera.position);

      this.aquariumScene.scene.add(mesh);
      this.glowSpots.push({ mesh, material: mat });
    }
  }

  regenerate() {
    // Remove old glow spots
    this.glowSpots.forEach(g => this.aquariumScene.scene.remove(g.mesh));
    this.glowSpots = [];
    this._createGlowSpots();
  }

  update(elapsed) {
    if (this.shimmerMaterial) {
      this.shimmerMaterial.uniforms.uTime.value = elapsed;
    }
    this.glowSpots.forEach(g => {
      g.material.uniforms.uTime.value = elapsed;
    });
  }

  getDebugInfo() {
    return {
      name: 'Effects',
      params: {
        shimmerParticles: this.params.shimmerCount,
        glowSpots: this.glowSpots.length,
      },
      glows: this.glowSpots.map((g, i) => ({
        index: i,
        color: '#' + g.material.uniforms.uColor.value.getHexString(),
        intensity: g.material.uniforms.uIntensity.value.toFixed(2),
        pos: `${g.mesh.position.x.toFixed(1)}, ${g.mesh.position.y.toFixed(1)}, ${g.mesh.position.z.toFixed(1)}`,
      })),
    };
  }
}
