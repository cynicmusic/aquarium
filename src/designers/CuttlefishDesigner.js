import * as THREE from 'three';
import { createSlider, createColorPicker, createSection, createButton, createSelect } from './DesignerUtils.js';

/**
 * Chromatophore shader — simulates the layered pigment sac system of cuttlefish skin.
 *
 * Three layers (like real chromatophores):
 *  1. Chromatophores (top) — expand/contract pigment sacs (red, yellow, brown)
 *  2. Iridophores (mid) — structural color, metallic shimmer (blue, green)
 *  3. Leucophores (bottom) — white/pale reflective base
 *
 * The shader uses reaction-diffusion (Gray-Scott) patterns to drive
 * organic expansion of chromatophore regions, creating the "LCD screen" effect.
 */

const chromatophoreVertex = /* glsl */`
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vNormal = normalMatrix * normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const chromatophoreFragment = /* glsl */`
uniform float uTime;
uniform float uAnimSpeed;

// Chromatophore layer params
uniform vec3 uChromaColor1;    // primary pigment
uniform vec3 uChromaColor2;    // secondary pigment
uniform vec3 uChromaColor3;    // tertiary pigment
uniform float uChromaDensity;  // how many sacs per unit
uniform float uChromaExpand;   // 0=contracted, 1=fully expanded
uniform float uChromaWaveSpeed; // speed of expansion waves

// Iridophore layer
uniform vec3 uIridColor1;
uniform vec3 uIridColor2;
uniform float uIridIntensity;
uniform float uIridAngleShift;

// Leucophore layer
uniform vec3 uLeucoColor;
uniform float uLeucoIntensity;

// Pattern params
uniform float uPatternScale;
uniform float uPatternMorph;  // 0=spots, 0.5=stripes, 1=uniform
uniform float uReactionRate;  // Gray-Scott feed rate
uniform float uDiffusionRate; // Gray-Scott kill rate

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

// --- Hash / noise ---
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031,.1030,.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Voronoi — each cell is a chromatophore sac
float voronoiSacs(vec2 uv, float density, float expand, float time) {
  vec2 id = floor(uv * density);
  vec2 fd = fract(uv * density);
  float minDist = 1.0;
  float cellId = 0.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash22(id + neighbor);

      // Animate: sacs pulsate
      float phase = hash21(id + neighbor) * 6.28;
      float pulse = 0.5 + 0.5 * sin(time * uChromaWaveSpeed + phase);
      float sacSize = expand * (0.6 + 0.4 * pulse);

      vec2 diff = neighbor + point - fd;
      float dist = length(diff);

      if (dist < minDist) {
        minDist = dist;
        cellId = hash21(id + neighbor);
      }
    }
  }

  // Sac radius — expanded sacs appear as filled circles
  float sacRadius = expand * 0.45;
  float sac = smoothstep(sacRadius + 0.05, sacRadius - 0.05, minDist);

  return sac;
}

// Reaction-diffusion pattern for organic shapes
float reactionDiffusion(vec2 uv, float time) {
  float f = uReactionRate;
  float k = uDiffusionRate;

  // Simplified — use layered sine waves as proxy for full RD simulation
  float pattern = 0.0;
  pattern += sin(uv.x * 15.0 * uPatternScale + time * 0.3) * cos(uv.y * 12.0 * uPatternScale + time * 0.2);
  pattern += 0.5 * sin(uv.x * 8.0 * uPatternScale - time * 0.15) * cos(uv.y * 20.0 * uPatternScale);
  pattern += 0.25 * sin((uv.x + uv.y) * 25.0 * uPatternScale + time * 0.4);

  // Morph between spots, stripes, uniform
  float spots = smoothstep(0.2, 0.6, pattern * 0.5 + 0.5);
  float stripes = smoothstep(-0.1, 0.1, sin(uv.x * 30.0 * uPatternScale + pattern * 2.0));
  float uniform_ = 0.5;

  float result = mix(spots, stripes, smoothstep(0.0, 0.5, uPatternMorph));
  result = mix(result, uniform_, smoothstep(0.5, 1.0, uPatternMorph));

  return result;
}

void main() {
  vec2 uv = vUv;

  // === Layer 3: Leucophore base ===
  vec3 leucoLayer = uLeucoColor * uLeucoIntensity;

  // === Layer 2: Iridophore shimmer ===
  // View-dependent iridescence
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = 1.0 - abs(dot(vNormal, viewDir));
  float iridAngle = fresnel * 6.28 + uIridAngleShift + uTime * 0.2;
  vec3 iridColor = mix(uIridColor1, uIridColor2, 0.5 + 0.5 * sin(iridAngle));
  vec3 iridLayer = iridColor * uIridIntensity * (0.3 + 0.7 * fresnel);

  // === Layer 1: Chromatophore sacs ===
  float pattern = reactionDiffusion(uv, uTime * uAnimSpeed);
  float sacs = voronoiSacs(uv, uChromaDensity, uChromaExpand, uTime * uAnimSpeed);

  // Three pigment types distributed by pattern
  vec3 chromaColor = mix(uChromaColor1, uChromaColor2, pattern);
  chromaColor = mix(chromaColor, uChromaColor3, smoothstep(0.6, 0.9, pattern));
  vec3 chromaLayer = chromaColor * sacs;

  // === Composite ===
  // Real cuttlefish: chromatophores on top obscure lower layers
  vec3 color = leucoLayer;
  color = mix(color, iridLayer, (1.0 - sacs) * 0.8); // iridophores show where sacs are contracted
  color = mix(color, chromaLayer, sacs * 0.9);

  // Simple lighting
  vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
  float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.5;
  color *= diff;

  gl_FragColor = vec4(color, 1.0);
}
`;

export class CuttlefishDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
    this.previewMesh = null;

    this.params = {
      // Chromatophore layer
      chromaColor1: '#8b4513',    // brown
      chromaColor2: '#cc2200',    // red
      chromaColor3: '#daa520',    // yellow
      chromaDensity: 20.0,
      chromaExpand: 0.7,
      chromaWaveSpeed: 1.5,

      // Iridophore layer
      iridColor1: '#2060a0',
      iridColor2: '#20a060',
      iridIntensity: 0.6,
      iridAngleShift: 0.0,

      // Leucophore layer
      leucoColor: '#e0ddd0',
      leucoIntensity: 0.4,

      // Pattern
      patternScale: 1.0,
      patternMorph: 0.0,         // 0=spots, 0.5=stripes, 1=uniform
      reactionRate: 0.5,
      diffusionRate: 0.3,

      // Animation
      animSpeed: 1.0,
    };

    this.material = null;
  }

  activate() {
    this._createPreview();
  }

  deactivate() {
    if (this.previewGroup) {
      this.scene.scene.remove(this.previewGroup);
      this.previewGroup = null;
      this.previewMesh = null;
    }
    if (this._animId) cancelAnimationFrame(this._animId);
  }

  _createMaterial() {
    const p = this.params;
    this.material = new THREE.ShaderMaterial({
      vertexShader: chromatophoreVertex,
      fragmentShader: chromatophoreFragment,
      uniforms: {
        uTime: { value: 0 },
        uAnimSpeed: { value: p.animSpeed },
        uChromaColor1: { value: new THREE.Color(p.chromaColor1) },
        uChromaColor2: { value: new THREE.Color(p.chromaColor2) },
        uChromaColor3: { value: new THREE.Color(p.chromaColor3) },
        uChromaDensity: { value: p.chromaDensity },
        uChromaExpand: { value: p.chromaExpand },
        uChromaWaveSpeed: { value: p.chromaWaveSpeed },
        uIridColor1: { value: new THREE.Color(p.iridColor1) },
        uIridColor2: { value: new THREE.Color(p.iridColor2) },
        uIridIntensity: { value: p.iridIntensity },
        uIridAngleShift: { value: p.iridAngleShift },
        uLeucoColor: { value: new THREE.Color(p.leucoColor) },
        uLeucoIntensity: { value: p.leucoIntensity },
        uPatternScale: { value: p.patternScale },
        uPatternMorph: { value: p.patternMorph },
        uReactionRate: { value: p.reactionRate },
        uDiffusionRate: { value: p.diffusionRate },
      },
    });
    return this.material;
  }

  _createPreview() {
    if (this.previewGroup) this.scene.scene.remove(this.previewGroup);

    // Cuttlefish body — elongated ellipsoid with tentacles suggested
    const bodyGeo = new THREE.SphereGeometry(1, 32, 24);
    const pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // Elongate
      x *= 1.8;
      // Flatten
      y *= 0.5;
      // Wider in middle
      const t = (x / 1.8 + 1) / 2;
      z *= 0.7 * (0.5 + 0.5 * Math.sin(t * Math.PI));
      pos.setXYZ(i, x, y, z);
    }
    bodyGeo.computeVertexNormals();

    const mat = this._createMaterial();
    this.previewGroup = new THREE.Group();
    this.previewMesh = new THREE.Mesh(bodyGeo, mat);
    this.previewGroup.add(this.previewMesh);

    // Add a local light so the cuttlefish is always visible
    const previewLight = new THREE.PointLight(0x8080ff, 5, 10);
    previewLight.position.set(0, 2, 3);
    this.previewGroup.add(previewLight);
    const previewLight2 = new THREE.PointLight(0xff6080, 3, 8);
    previewLight2.position.set(-2, -1, 1);
    this.previewGroup.add(previewLight2);

    this.previewGroup.position.set(0, 7, 5);
    this.previewGroup.scale.setScalar(2.0);

    // Animate
    if (this._animId) cancelAnimationFrame(this._animId);
    const group = this.previewGroup;
    const animate = () => {
      if (this.previewGroup !== group) return;
      this.material.uniforms.uTime.value += 0.016;
      this.previewMesh.rotation.y += 0.005;
      this._animId = requestAnimationFrame(animate);
    };
    animate();

    this.scene.scene.add(this.previewGroup);
  }

  _updateUniform(name, value) {
    if (this.material && this.material.uniforms[name]) {
      if (value instanceof THREE.Color) {
        this.material.uniforms[name].value = value;
      } else {
        this.material.uniforms[name].value = value;
      }
    }
  }

  render(panel) {
    // Chromatophore layer
    const chromaSection = createSection('Chromatophores (Pigment Sacs)');

    chromaSection.appendChild(createColorPicker('Pigment 1', this.params.chromaColor1, v => {
      this.params.chromaColor1 = v;
      this._updateUniform('uChromaColor1', new THREE.Color(v));
    }));
    chromaSection.appendChild(createColorPicker('Pigment 2', this.params.chromaColor2, v => {
      this.params.chromaColor2 = v;
      this._updateUniform('uChromaColor2', new THREE.Color(v));
    }));
    chromaSection.appendChild(createColorPicker('Pigment 3', this.params.chromaColor3, v => {
      this.params.chromaColor3 = v;
      this._updateUniform('uChromaColor3', new THREE.Color(v));
    }));
    chromaSection.appendChild(createSlider('Density', 5, 50, 1, this.params.chromaDensity, v => {
      this.params.chromaDensity = v;
      this._updateUniform('uChromaDensity', v);
    }));
    chromaSection.appendChild(createSlider('Expand', 0, 1, 0.01, this.params.chromaExpand, v => {
      this.params.chromaExpand = v;
      this._updateUniform('uChromaExpand', v);
    }));
    chromaSection.appendChild(createSlider('Wave Speed', 0, 5, 0.1, this.params.chromaWaveSpeed, v => {
      this.params.chromaWaveSpeed = v;
      this._updateUniform('uChromaWaveSpeed', v);
    }));
    panel.appendChild(chromaSection);

    // Iridophore layer
    const iridSection = createSection('Iridophores (Shimmer)');
    iridSection.appendChild(createColorPicker('Irid Color 1', this.params.iridColor1, v => {
      this.params.iridColor1 = v;
      this._updateUniform('uIridColor1', new THREE.Color(v));
    }));
    iridSection.appendChild(createColorPicker('Irid Color 2', this.params.iridColor2, v => {
      this.params.iridColor2 = v;
      this._updateUniform('uIridColor2', new THREE.Color(v));
    }));
    iridSection.appendChild(createSlider('Intensity', 0, 2, 0.01, this.params.iridIntensity, v => {
      this.params.iridIntensity = v;
      this._updateUniform('uIridIntensity', v);
    }));
    iridSection.appendChild(createSlider('Angle Shift', 0, 6.28, 0.01, this.params.iridAngleShift, v => {
      this.params.iridAngleShift = v;
      this._updateUniform('uIridAngleShift', v);
    }));
    panel.appendChild(iridSection);

    // Leucophore layer
    const leucoSection = createSection('Leucophores (Base Reflect)');
    leucoSection.appendChild(createColorPicker('Base Color', this.params.leucoColor, v => {
      this.params.leucoColor = v;
      this._updateUniform('uLeucoColor', new THREE.Color(v));
    }));
    leucoSection.appendChild(createSlider('Intensity', 0, 1, 0.01, this.params.leucoIntensity, v => {
      this.params.leucoIntensity = v;
      this._updateUniform('uLeucoIntensity', v);
    }));
    panel.appendChild(leucoSection);

    // Pattern
    const patternSection = createSection('Pattern Control');
    patternSection.appendChild(createSlider('Scale', 0.2, 3, 0.01, this.params.patternScale, v => {
      this.params.patternScale = v;
      this._updateUniform('uPatternScale', v);
    }));
    patternSection.appendChild(createSlider('Morph', 0, 1, 0.01, this.params.patternMorph, v => {
      this.params.patternMorph = v;
      this._updateUniform('uPatternMorph', v);
    }));
    const morphLabel = document.createElement('div');
    morphLabel.style.cssText = 'color:#505870;font-size:10px;margin-top:-4px;margin-bottom:6px;padding-left:88px';
    morphLabel.textContent = '← spots | stripes | uniform →';
    patternSection.appendChild(morphLabel);

    patternSection.appendChild(createSlider('React Rate', 0, 1, 0.01, this.params.reactionRate, v => {
      this.params.reactionRate = v;
      this._updateUniform('uReactionRate', v);
    }));
    patternSection.appendChild(createSlider('Diffuse Rate', 0, 1, 0.01, this.params.diffusionRate, v => {
      this.params.diffusionRate = v;
      this._updateUniform('uDiffusionRate', v);
    }));
    panel.appendChild(patternSection);

    // Animation
    const animSection = createSection('Animation');
    animSection.appendChild(createSlider('Speed', 0, 3, 0.01, this.params.animSpeed, v => {
      this.params.animSpeed = v;
      this._updateUniform('uAnimSpeed', v);
    }));
    panel.appendChild(animSection);

    // Actions
    const actSection = createSection('Actions');
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.style.flexWrap = 'wrap';

    btnRow.appendChild(createButton('Variants', () => {
      this.variantGrid.show('cuttlefish', this.params, {}, (params) => {
        Object.assign(this.params, params);
        this._createPreview();
        panel.innerHTML = '';
        this.render(panel);
      });
    }));

    btnRow.appendChild(createButton('Randomize', () => {
      this._randomize();
      this._createPreview();
      panel.innerHTML = '';
      this.render(panel);
    }));

    btnRow.appendChild(createButton('Camouflage', () => {
      // Quick preset: camouflage mode
      this.params.chromaExpand = 0.9;
      this.params.patternMorph = 0.0;
      this.params.chromaDensity = 30;
      this._createPreview();
      panel.innerHTML = '';
      this.render(panel);
    }));

    btnRow.appendChild(createButton('Display', () => {
      // Quick preset: display/threat mode
      this.params.chromaExpand = 1.0;
      this.params.patternMorph = 0.5;
      this.params.chromaWaveSpeed = 3.0;
      this.params.iridIntensity = 1.5;
      this._createPreview();
      panel.innerHTML = '';
      this.render(panel);
    }));

    actSection.appendChild(btnRow);
    panel.appendChild(actSection);
  }

  _randomize() {
    const rh = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    this.params.chromaColor1 = rh();
    this.params.chromaColor2 = rh();
    this.params.chromaColor3 = rh();
    this.params.chromaDensity = 10 + Math.random() * 35;
    this.params.chromaExpand = Math.random();
    this.params.chromaWaveSpeed = Math.random() * 4;
    this.params.iridColor1 = rh();
    this.params.iridColor2 = rh();
    this.params.iridIntensity = Math.random() * 1.5;
    this.params.patternScale = 0.3 + Math.random() * 2.5;
    this.params.patternMorph = Math.random();
    this.params.reactionRate = Math.random();
    this.params.diffusionRate = Math.random();
  }
}
