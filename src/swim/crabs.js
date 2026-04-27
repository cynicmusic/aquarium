import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

function makeMat(color, emissive = 0x180704) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.22,
    roughness: 0.72,
    metalness: 0.04,
  });
}

function createCrabMesh() {
  const group = new THREE.Group();
  group.name = 'swimCrab';

  const bodyColor = new THREE.Color().setHSL(0.02 + Math.random() * 0.05, 0.72, 0.36 + Math.random() * 0.12);
  const bodyMat = makeMat(bodyColor);
  const clawMat = bodyMat.clone();
  clawMat.color = bodyColor.clone().offsetHSL(0.01, 0.04, 0.08);
  const eyeMat = makeMat(0x090607, 0x000000);

  const bodyGeo = new THREE.SphereGeometry(0.24, 10, 7);
  bodyGeo.scale(1.25, 0.42, 0.86);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.16;
  group.add(body);

  for (let side = -1; side <= 1; side += 2) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 4), bodyMat);
    stalk.position.set(side * 0.10, 0.28, -0.11);
    stalk.rotation.x = 0.25;
    group.add(stalk);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
    eye.position.set(side * 0.11, 0.36, -0.15);
    group.add(eye);
  }

  for (let side = -1; side <= 1; side += 2) {
    const claw = new THREE.Group();
    claw.name = side > 0 ? 'rightClaw' : 'leftClaw';
    claw.position.set(side * 0.18, 0.14, -0.04);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.22, 5), clawMat);
    arm.rotation.z = side * 0.86;
    arm.position.set(side * 0.08, -0.02, 0.01);
    claw.add(arm);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 0.045), clawMat);
    top.name = 'pincerTop';
    top.position.set(side * 0.25, 0.03, 0.00);
    claw.add(top);

    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.024, 0.04), clawMat);
    bot.name = 'pincerBot';
    bot.position.set(side * 0.25, -0.035, 0.00);
    claw.add(bot);
    group.add(claw);
  }

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.22, 4), clawMat);
      leg.name = `leg_${i}`;
      leg.position.set(side * (0.18 + i * 0.035), 0.08, -0.09 + i * 0.09);
      leg.rotation.z = side * (0.72 + i * 0.12);
      leg.rotation.y = (i - 1) * 0.26;
      group.add(leg);
    }
  }

  group.scale.setScalar(0.78 + Math.random() * 0.22);
  return group;
}

export function createCrabs(scene, cuttle, { floorY = -2.3, count = 3 } = {}) {
  const crabs = [];
  const toTarget = new THREE.Vector3();
  const zSpread = 13;
  const resetCrab = (crab, ahead = true) => {
    const cx = cuttle.position.x;
    crab.mesh.position.set(
      cx - (ahead ? 10 + Math.random() * 42 : -4 + Math.random() * 18),
      floorY + 0.06,
      (Math.random() - 0.5) * zSpread,
    );
    crab.mesh.rotation.y = Math.random() * TWO_PI;
    crab.target.set(
      crab.mesh.position.x + (Math.random() - 0.5) * 7,
      floorY + 0.06,
      crab.mesh.position.z + (Math.random() - 0.5) * 6,
    );
    crab.pause = Math.random() * 2;
    crab.moveT = 3 + Math.random() * 5;
  };

  for (let i = 0; i < count; i++) {
    const mesh = createCrabMesh();
    scene.add(mesh);
    const crab = {
      mesh,
      velocity: new THREE.Vector3(),
      target: new THREE.Vector3(),
      walk: Math.random() * TWO_PI,
      pinch: Math.random() * TWO_PI,
      pause: 0,
      moveT: 0,
    };
    resetCrab(crab, i !== 0);
    crabs.push(crab);
  }

  const update = (dt, elapsed) => {
    const cx = cuttle.position.x;
    for (const crab of crabs) {
      if (crab.mesh.position.x - cx > 24) resetCrab(crab, true);

      if (crab.pause > 0) {
        crab.pause -= dt;
      } else {
        toTarget.subVectors(crab.target, crab.mesh.position);
        toTarget.y = 0;
        const dist = toTarget.length();
        crab.moveT -= dt;
        if (dist < 0.4 || crab.moveT <= 0) {
          crab.pause = 1.0 + Math.random() * 2.5;
          crab.target.set(
            crab.mesh.position.x + (Math.random() - 0.5) * 8,
            floorY + 0.06,
            crab.mesh.position.z + (Math.random() - 0.5) * 6,
          );
          crab.moveT = 3 + Math.random() * 6;
          crab.velocity.multiplyScalar(0);
        } else {
          const speed = 0.22 + Math.sin(elapsed * 0.3 + crab.walk) * 0.04;
          toTarget.normalize().multiplyScalar(speed);
          crab.velocity.lerp(toTarget, Math.min(1, dt * 2));
          crab.mesh.position.addScaledVector(crab.velocity, dt);
          crab.mesh.position.y = floorY + 0.06;

          const sideAngle = Math.atan2(crab.velocity.x, crab.velocity.z) + Math.PI / 2;
          let delta = sideAngle - crab.mesh.rotation.y;
          while (delta > Math.PI) delta -= TWO_PI;
          while (delta < -Math.PI) delta += TWO_PI;
          crab.mesh.rotation.y += delta * dt * 2;
        }
      }

      crab.walk += dt * 8;
      crab.pinch += dt * 5;
      const legBob = Math.sin(crab.walk) * 0.20;
      for (const child of crab.mesh.children) {
        if (child.name?.startsWith('leg_')) child.rotation.x = legBob;
        if (child.name === 'leftClaw' || child.name === 'rightClaw') {
          child.rotation.x = Math.max(0, Math.sin(elapsed * 0.7 + crab.pinch)) * -0.34;
          const pinch = Math.sin(crab.pinch) * 0.11;
          for (const part of child.children) {
            if (part.name === 'pincerTop') part.rotation.z = pinch;
            if (part.name === 'pincerBot') part.rotation.z = -pinch;
          }
        }
      }
    }
  };

  const dispose = () => {
    for (const crab of crabs) {
      scene.remove(crab.mesh);
      crab.mesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material?.dispose) o.material.dispose();
      });
    }
    crabs.length = 0;
  };

  return { crabs, update, dispose };
}
