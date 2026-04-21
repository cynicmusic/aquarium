/**
 * Fish3DBuilder.js — Converts NACA 2D fish profiles into 3D meshes
 * using spine-based extrusion with elliptical cross-sections.
 *
 * Input: species JSON from public/fish/*.json (exported by naca_fish.js --export-3d)
 * Output: THREE.Group with segmented body + fin meshes
 */

import * as THREE from 'three';

// ── Configuration ──
const SPINE_POINTS = 24;       // number of cross-sections along body
const RING_VERTS = 14;         // vertices per cross-section ring
const BODY_SEGMENTS = 4;       // kinematic segments for undulation
const SEGMENT_BOUNDS = [0.0, 0.25, 0.55, 0.80, 1.0];  // head, body, rear, tail

/**
 * Build complete 3D fish from species data JSON
 * @param {Object} data - parsed species JSON
 * @param {Object} opts - { widthFactor: 0.55 }
 * @returns {{ root: THREE.Group, segments: THREE.Group[], fins: Object, bodyGeo: THREE.BufferGeometry }}
 */
export function buildCompleteFish(data, opts = {}) {
  const widthFactor = opts.widthFactor ?? 0.55;

  const root = new THREE.Group();
  root.userData.species = data.species;

  // Build single continuous body
  const { bodyGeo } = buildBody(data, widthFactor);

  // Body mesh placeholder — geometry stored, material applied by caller
  root.userData.bodyGeo = bodyGeo;

  // Build fins
  const fins = {};
  fins.dorsal = buildFinMesh(data.geometry.dorsalFin, data.colors.fin, 0.06);
  fins.anal = buildFinMesh(data.geometry.analFin, data.colors.fin, -0.06);
  fins.caudal = buildCaudalMesh(data.geometry.caudalFin, data.colors.fin);
  fins.pectoralL = buildFinMesh(data.geometry.pectoralFin, data.colors.fin, 0.08);
  fins.pectoralR = buildFinMesh(data.geometry.pectoralFin, data.colors.fin, -0.08);
  if (fins.pectoralR) fins.pectoralR.scale.z = -1;

  if (fins.dorsal) root.add(fins.dorsal);
  if (fins.anal) root.add(fins.anal);
  if (fins.caudal) root.add(fins.caudal);
  if (fins.pectoralL) root.add(fins.pectoralL);
  if (fins.pectoralR) root.add(fins.pectoralR);

  // Eye
  const eye = buildEye(data.eye, data.geometry.body);
  root.add(eye);

  // Center pivot on body
  const box = new THREE.Box3().setFromBufferAttribute(bodyGeo.getAttribute('position'));
  const center = box.getCenter(new THREE.Vector3());
  // Offset all geometry and children
  const posAttr = bodyGeo.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setXYZ(i, posAttr.getX(i) - center.x, posAttr.getY(i) - center.y, posAttr.getZ(i) - center.z);
  }
  posAttr.needsUpdate = true;
  bodyGeo.computeBoundingBox();
  root.children.forEach(c => c.position.sub(center));

  return { root, fins, bodyGeo };
}

/**
 * Build ONE continuous body mesh from spine cross-sections.
 * Returns a single geometry (segmentation for articulation is Phase 4).
 */
function buildBody(data, widthFactor) {
  const topPts = data.geometry.body.top.map(p => ({ x: p[0], y: p[1] }));
  const botPts = data.geometry.body.bottom.map(p => ({ x: p[0], y: p[1] }));

  // Build spine: sample along body from nose to tail
  const spine = [];
  for (let i = 0; i <= SPINE_POINTS; i++) {
    const t = i / SPINE_POINTS;
    const topY = sampleProfile(topPts, t);
    const botY = sampleProfile(botPts, t);
    const centerY = (topY + botY) / 2;
    const height = Math.max(topY - botY, 0.005);
    const width = height * widthFactor * widthProfile(t);

    spine.push({ t, x: t, y: centerY, height, width });
  }

  const bodyGeo = buildTubeSegment(spine, 0, 1);
  return { bodyGeo, spine };
}

/**
 * Generate a tube segment from spine points with elliptical cross-sections
 */
function buildTubeSegment(segSpine, tStart, tEnd) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const nRings = segSpine.length;

  for (let r = 0; r < nRings; r++) {
    const sp = segSpine[r];
    // Absolute position (centering handled later)
    const localX = sp.x;
    const localY = sp.y;

    // U coordinate: position along full body (0→1)
    const u = sp.t;

    for (let v = 0; v < RING_VERTS; v++) {
      const angle = (v / RING_VERTS) * Math.PI * 2;
      // Elliptical cross-section: height in Y, width in Z
      const halfH = sp.height / 2;
      const halfW = sp.width / 2;

      // Slightly flatten the belly (bottom half wider, top half rounder)
      const bellyFactor = angle > Math.PI ? 1.05 : 0.95;

      const py = localY + Math.cos(angle) * halfH * bellyFactor;
      const pz = Math.sin(angle) * halfW;

      positions.push(localX, py, pz);

      // Normal: outward from ellipse center
      const nx = 0;
      const ny = Math.cos(angle) * (halfW / halfH);
      const nz = Math.sin(angle);
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals.push(nx / nl, ny / nl, nz / nl);

      // UV: u = along body, v = around ring
      uvs.push(u, v / RING_VERTS);
    }
  }

  // Generate triangle strip indices
  for (let r = 0; r < nRings - 1; r++) {
    for (let v = 0; v < RING_VERTS; v++) {
      const curr = r * RING_VERTS + v;
      const next = r * RING_VERTS + ((v + 1) % RING_VERTS);
      const currNext = (r + 1) * RING_VERTS + v;
      const nextNext = (r + 1) * RING_VERTS + ((v + 1) % RING_VERTS);

      indices.push(curr, currNext, next);
      indices.push(next, currNext, nextNext);
    }
  }

  // Cap the ends
  addEndCap(positions, normals, uvs, indices, segSpine[0], 0, -1, segSpine[0].t);
  addEndCap(positions, normals, uvs, indices, segSpine[nRings - 1], nRings - 1, 1, segSpine[nRings - 1].t);

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();  // smooth normals

  return geo;
}

/**
 * Add a simple fan cap at the end of a tube segment
 */
function addEndCap(positions, normals, uvs, indices, sp, ringIdx, direction, u) {
  // Center point
  const centerIdx = positions.length / 3;
  positions.push(sp.x, sp.y, 0);
  normals.push(direction, 0, 0);
  uvs.push(u, 0.5);

  const ringStart = ringIdx * RING_VERTS;
  for (let v = 0; v < RING_VERTS; v++) {
    const a = ringStart + v;
    const b = ringStart + ((v + 1) % RING_VERTS);
    if (direction < 0) {
      indices.push(centerIdx, b, a);
    } else {
      indices.push(centerIdx, a, b);
    }
  }
}

/**
 * Width profile modifier — thinner at nose and tail, widest at ~40%
 */
function widthProfile(t) {
  // Smooth taper: wide at 30-60%, narrow at extremes
  const belly = Math.sin(t * Math.PI);  // 0 at ends, 1 at middle
  const taper = 0.3 + 0.7 * belly;     // min 0.3, max 1.0
  return taper;
}

/**
 * Sample y-value from a sorted point array at parameter t (0→1)
 */
function sampleProfile(pts, t) {
  if (pts.length === 0) return 0;
  // Find x range
  const xMin = pts[0].x;
  const xMax = pts[pts.length - 1].x;
  const targetX = xMin + t * (xMax - xMin);

  // Binary search for bracket
  let lo = 0, hi = pts.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].x < targetX) lo = mid;
    else hi = mid;
  }

  if (lo === hi) return pts[lo].y;
  const frac = (targetX - pts[lo].x) / (pts[hi].x - pts[lo].x || 1);
  return pts[lo].y + (pts[hi].y - pts[lo].y) * frac;
}

/**
 * Build a flat fin mesh from 2D point array
 */
function buildFinMesh(points, color, zOffset) {
  if (!points || points.length < 3) return null;

  const pts2d = points.map(p => new THREE.Vector2(p[0], p[1]));
  const shape = new THREE.Shape(pts2d);

  const geo = new THREE.ShapeGeometry(shape);
  // Compute UVs from bounding box
  const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position'));
  const posAttr = geo.getAttribute('position');
  const uvAttr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    uvAttr[i * 2] = (posAttr.getX(i) - box.min.x) / (box.max.x - box.min.x || 1);
    uvAttr[i * 2 + 1] = (posAttr.getY(i) - box.min.y) / (box.max.y - box.min.y || 1);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvAttr, 2));

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.05,
  }));

  mesh.position.z = zOffset;
  return mesh;
}

/**
 * Build caudal (tail) fin mesh
 */
function buildCaudalMesh(points, color) {
  return buildFinMesh(points, color, 0);
}

/**
 * Build a shimmer eye — hemisphere cornea over a pigmented iris with a moving
 * iridescent ring, pupil, and a layered glint. Replaces the old flat-disc eye.
 */
function buildEye(eyeSpec, body) {
  const topPts = body.top.map(p => ({ x: p[0], y: p[1] }));
  const eyeY = sampleProfile(topPts, eyeSpec.x) * (eyeSpec.yOffset || 0.3);

  const wrapper = new THREE.Group();
  const side1 = _buildShimmerEye3D(eyeSpec);
  const side2 = _buildShimmerEye3D(eyeSpec);

  side1.position.set(eyeSpec.x, eyeY, 0.05);
  side2.position.set(eyeSpec.x, eyeY, -0.05);
  side2.rotation.y = Math.PI;

  wrapper.add(side1, side2);
  wrapper.userData.shimmerEyes = [side1, side2];
  return wrapper;
}

function _buildShimmerEye3D(eyeSpec) {
  const g = new THREE.Group();
  // Body-relative scaling — caller passes eyeSpec.r which is already relative
  // to body profile; we respect it within a sane window (no hard clamp that
  // makes big fish look pinprick-eyed).
  const rRaw = eyeSpec.r || 0.025;
  const r = Math.max(0.018, Math.min(rRaw, 0.055));

  // 1. Concave socket: a small dark ring around the eye so it reads as inset,
  //    not pasted on top.
  const socket = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.1, r * 1.45, 40),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide })
  );
  socket.position.z = -0.001;
  g.add(socket);

  // 2. Sclera — cool-tinted off-white (was too warm/yellow before which read as red)
  const sclera = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.08, 32),
    new THREE.MeshStandardMaterial({ color: 0xeef2f5, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide })
  );
  sclera.position.z = 0.0;
  g.add(sclera);

  // 3. Iris disc — species-agnostic dark teal/grey (NOT red). Real fish eyes are
  //    usually silvery with a dark iris; we cool this down significantly.
  const iris = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.42, r * 0.95, 48),
    new THREE.MeshStandardMaterial({
      color: 0x3a4a5a, emissive: 0x10202a, emissiveIntensity: 0.25,
      roughness: 0.45, metalness: 0.4, side: THREE.DoubleSide,
    })
  );
  iris.position.z = 0.0012;
  g.add(iris);

  // 4. Hemisphere pupil — RECESSED farther so parallax is visible at oblique
  //    angles. Smaller radius so iris reads around it.
  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.45, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x010103, roughness: 0.18, metalness: 0.0 })
  );
  pupil.rotation.x = Math.PI / 2;
  pupil.position.z = -r * 0.18;        // deeper recess → stronger parallax
  g.add(pupil);

  // 5. Iridescent shimmer — partial arc (lower 60% only), not a full halo
  const shimmerGeo = new THREE.RingGeometry(
    r * 0.48, r * 0.62, 48, 1,
    Math.PI * 0.15, Math.PI * 1.25      // partial arc
  );
  const cols = new Float32Array(shimmerGeo.attributes.position.count * 3);
  const p = shimmerGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const ang = Math.atan2(p.getY(i), p.getX(i));
    const h = (ang + Math.PI) / (Math.PI * 2);
    const col = new THREE.Color().setHSL((h + 0.5) % 1, 0.7, 0.55);   // cooler rainbow
    cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b;
  }
  shimmerGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const shimmer = new THREE.Mesh(shimmerGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));
  shimmer.position.z = 0.002;
  g.add(shimmer);

  // 6. Glossy cornea dome — refractive physical material, in FRONT of pupil so
  //    as camera moves the pupil appears to shift (real parallax).
  const cornea = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.02, metalness: 0.0,
      transmission: 0.9, thickness: 0.01, ior: 1.36,
      clearcoat: 1.0, clearcoatRoughness: 0.02,
      transparent: true, opacity: 0.28,
    })
  );
  cornea.rotation.x = -Math.PI / 2;
  cornea.position.z = r * 0.35;        // pushed out, pupil is behind → parallax
  g.add(cornea);

  // 7. Catchlight — pushed further forward so it sits on the cornea surface,
  //    producing noticeable parallax against the recessed pupil when the camera
  //    moves around the fish.
  const glint = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.15, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
  );
  glint.position.set(-r * 0.28, r * 0.3, r * 0.55);
  g.add(glint);

  g.userData.shimmerRing = shimmer;
  return g;
}

/**
 * Parent a fin to the nearest body segment based on its x-position
 */
function parentFinToSegment(fin, segments, xPos) {
  if (!fin) return;
  // Find which segment this x falls into
  for (let i = segments.length - 1; i >= 0; i--) {
    if (xPos >= segments[i].userData.tStart) {
      segments[i].add(fin);
      return;
    }
  }
  segments[0].add(fin);
}

/**
 * Load all species data from manifest
 * @returns {Promise<Map<string, Object>>}
 */
export async function loadAllSpecies(basePath = '/fish/') {
  const resp = await fetch(basePath + 'manifest.json');
  const manifest = await resp.json();
  const species = new Map();
  await Promise.all(manifest.map(async name => {
    const r = await fetch(basePath + name + '.json');
    species.set(name, await r.json());
  }));
  return species;
}
