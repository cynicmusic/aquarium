import * as THREE from 'three';
import { WaterEffects } from '../shaders/WaterEffects.js';
import { SandTerrain } from '../environment/Sand.js';
import { LightingSystem } from '../environment/Lighting.js';
import { BubbleEmitter } from '../systems/BubbleEmitter.js';
import { EffectsSystem } from '../environment/Effects.js';
import { PlantSystem } from '../environment/PlantSystem.js';
import { CoralSystem } from '../environment/CoralSystem.js';
import { FishManager } from '../entities/FishManager.js';
import { CrabSystem } from '../entities/CrabSystem.js';
import { SeafloorCreatures } from '../entities/SeafloorCreatures.js';
export class AquariumScene {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.params = {
      tankWidth: 30,
      tankHeight: 12,
      tankDepth: 15,
    };

    // Renderer — wrap in try/catch for WebGL context failures
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
      // Fallback: try without antialias
      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      } catch (e2) {
        container.innerHTML = '<div style="color:#fff;padding:2em;font-family:sans-serif;">' +
          '<h2>WebGL Error</h2><p>Could not create WebGL context. Try closing other tabs or restarting your browser.</p></div>';
        this._dead = true;
        return;
      }
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Handle WebGL context loss gracefully
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost — pausing render loop');
      this.renderer.setAnimationLoop(null);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored — resuming');
      this.start();
    });

    if (this._dead) return;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x081830, 0.015);

    // Gradient background — large backdrop plane
    this._createGradientBackground();

    // Camera
    // Camera: zoomed out, focused on fish level not ground
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 6, 22);
    this.camera.lookAt(0, 5, 0);

    // Systems (initialized in order of dependency)
    this.lighting = new LightingSystem(this);
    this.water = new WaterEffects(this);
    this.sand = new SandTerrain(this);
    this.plants = new PlantSystem(this);
    this.coral = new CoralSystem(this);
    this.bubbles = new BubbleEmitter(this);
    this.effects = new EffectsSystem(this);
    this.fish = new FishManager(this);
    this.crabs = new CrabSystem(this);
    this.seafloor = new SeafloorCreatures(this);

    // Tank glass (subtle bounding box)
    this._createTankBounds();

    window.addEventListener('resize', () => this._onResize());

    // Orbit-like mouse control
    this._setupMouseControl();
  }

  _createGradientBackground() {
    // Canvas gradient texture for the background
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#020108');    // near-black top
    grd.addColorStop(0.3, '#08051a'); // very dark purple
    grd.addColorStop(0.6, '#060312'); // dark purple mid
    grd.addColorStop(1, '#010005');    // black bottom
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 2, 512);

    // Add subtle stars
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 512;
    starCanvas.height = 512;
    const starCtx = starCanvas.getContext('2d');

    // Draw gradient
    const starGrd = starCtx.createLinearGradient(0, 0, 0, 512);
    starGrd.addColorStop(0, '#020108');
    starGrd.addColorStop(0.3, '#08051a');
    starGrd.addColorStop(0.6, '#060312');
    starGrd.addColorStop(1, '#010005');
    starCtx.fillStyle = starGrd;
    starCtx.fillRect(0, 0, 512, 512);

    // Scatter tiny stars
    for (let i = 0; i < 150; i++) {
      const sx = Math.random() * 512;
      const sy = Math.random() * 300; // mostly in upper area
      const brightness = 0.3 + Math.random() * 0.7;
      const size = 0.5 + Math.random() * 1.5;
      starCtx.fillStyle = `rgba(200, 200, 255, ${brightness * 0.4})`;
      starCtx.beginPath();
      starCtx.arc(sx, sy, size, 0, Math.PI * 2);
      starCtx.fill();
    }

    const tex = new THREE.CanvasTexture(starCanvas);
    const bgGeo = new THREE.PlaneGeometry(140, 100);
    const bgMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, depthWrite: false });
    this.bgPlane = new THREE.Mesh(bgGeo, bgMat);
    this.bgPlane.position.set(0, 4, -28);
    this.bgPlane.renderOrder = -1;
    this.scene.add(this.bgPlane);

    // Animated ripple overlay on the background
    this._createBackgroundRipple();

    // Also set scene background color for anything the plane doesn't cover
    this.scene.background = new THREE.Color(0x010005);
  }

  _createBackgroundRipple() {
    const rippleVertex = /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const rippleFragment = /* glsl */`
      uniform float uTime;
      varying vec2 vUv;

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      float voronoi(vec2 p) {
        vec2 n = floor(p);
        vec2 f = fract(p);
        float md = 8.0, md2 = 8.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            o = 0.5 + 0.5 * sin(uTime * 0.4 + 6.2831 * o);
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < md) { md2 = md; md = d; }
            else if (d < md2) { md2 = d; }
          }
        }
        return md2 - md;
      }

      void main() {
        vec2 uv = vUv * 4.0;
        float v1 = voronoi(uv);
        float v2 = voronoi(uv * 1.5 + vec2(3.0, 1.0));
        float caustic = v1 * v2 * 6.0;
        caustic = pow(caustic, 0.7);

        // Purple base with cyan/orange/yellow highlights on caustic lines
        vec3 purple = vec3(0.15, 0.05, 0.25);
        vec3 cyan = vec3(0.1, 0.4, 0.5);
        vec3 orange = vec3(0.5, 0.25, 0.05);
        vec3 yellow = vec3(0.4, 0.35, 0.1);

        float t = sin(uTime * 0.2 + vUv.x * 3.0) * 0.5 + 0.5;
        vec3 highlight = mix(mix(cyan, orange, t), yellow, sin(uTime * 0.15 + vUv.y * 2.0) * 0.5 + 0.5);

        vec3 color = purple + highlight * caustic * 0.4;

        // Fade edges for vignette
        float vignette = 1.0 - length(vUv - 0.5) * 0.8;
        vignette = smoothstep(0.0, 1.0, vignette);

        gl_FragColor = vec4(color * vignette, caustic * 0.25 + 0.05);
      }
    `;

    // Extend the ripple plane so the refracted shader fills more of the
    // background and doesn't stop at the edges of the frame.
    const rippleGeo = new THREE.PlaneGeometry(260, 180);
    this.bgRippleMat = new THREE.ShaderMaterial({
      vertexShader: rippleVertex,
      fragmentShader: rippleFragment,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ripplePlane = new THREE.Mesh(rippleGeo, this.bgRippleMat);
    ripplePlane.position.set(0, 4, -27);
    ripplePlane.renderOrder = 0;
    this.scene.add(ripplePlane);

    // Second, deeper ripple plane — further back, fainter, broader, so the
    // refracted ocean extends into the far distance.
    const deepGeo = new THREE.PlaneGeometry(420, 260);
    const deepMat = new THREE.ShaderMaterial({
      vertexShader: rippleVertex,
      fragmentShader: rippleFragment,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.4,
    });
    const deepPlane = new THREE.Mesh(deepGeo, deepMat);
    deepPlane.position.set(0, 8, -60);
    deepPlane.renderOrder = -1;
    this.scene.add(deepPlane);
    this.bgRippleDeepMat = deepMat;
  }

  _createTankBounds() {
    const { tankWidth, tankHeight, tankDepth } = this.params;
    const geo = new THREE.BoxGeometry(tankWidth, tankHeight, tankDepth);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x203060, opacity: 0.15, transparent: true });
    this.tankBounds = new THREE.LineSegments(edges, mat);
    this.tankBounds.position.y = tankHeight / 2;
    this.scene.add(this.tankBounds);
  }

  _setupMouseControl() {
    let dragging = false, prevX = 0, prevY = 0;
    const pivot = new THREE.Vector3(0, 5, 0);

    this.container.addEventListener('mousedown', e => {
      if (e.target.closest('#ui-root')) return;
      dragging = true; prevX = e.clientX; prevY = e.clientY;
    });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = (e.clientX - prevX) * 0.005;
      const dy = (e.clientY - prevY) * 0.003;
      prevX = e.clientX; prevY = e.clientY;

      const offset = this.camera.position.clone().sub(pivot);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= dx;
      spherical.phi = Math.max(0.3, Math.min(Math.PI - 0.3, spherical.phi - dy));
      offset.setFromSpherical(spherical);
      this.camera.position.copy(pivot).add(offset);
      this.camera.lookAt(pivot);
    });
    this.container.addEventListener('wheel', e => {
      if (e.target.closest('#ui-root')) return;
      const dir = this.camera.position.clone().sub(pivot).normalize();
      this.camera.position.addScaledVector(dir, e.deltaY * 0.01);
      const dist = this.camera.position.distanceTo(pivot);
      if (dist < 5) this.camera.position.copy(pivot).addScaledVector(dir, 5);
      if (dist > 40) this.camera.position.copy(pivot).addScaledVector(dir, 40);
    }, { passive: true });
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  start() {
    if (this._dead) return;
    this.renderer.setAnimationLoop(() => this._update());
  }

  _update() {
    const dt = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    this.lighting.update(elapsed);
    this.water.update(elapsed);
    this.plants.update(elapsed, dt);
    this.coral.update(elapsed);
    this.bubbles.update(dt);
    this.effects.update(elapsed);
    this.fish.update(dt, elapsed);
    this.crabs.update(dt, elapsed);
    this.seafloor.update(dt, elapsed);

    if (this.bgRippleMat) this.bgRippleMat.uniforms.uTime.value = elapsed;
    if (this.bgRippleDeepMat) this.bgRippleDeepMat.uniforms.uTime.value = elapsed * 0.6;
    this.renderer.render(this.scene, this.camera);
  }

  // Convenience: get all debug-able systems
  getSystems() {
    return {
      lighting: this.lighting,
      water: this.water,
      sand: this.sand,
      plants: this.plants,
      coral: this.coral,
      bubbles: this.bubbles,
      effects: this.effects,
      fish: this.fish,
      crabs: this.crabs,
    };
  }
}
