import * as THREE from "three";

const TEX_CACHE = new Map();

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.62,
    metalness: extras.metalness ?? 0.08,
    emissive: extras.emissive ?? 0x000000,
    emissiveIntensity: extras.emissiveIntensity ?? 0,
    ...extras.more,
  });
}

function box(w, h, d, color, extras) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extras));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sph(r, color, extras) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat(color, extras));
  m.castShadow = true;
  return m;
}

function cyl(rTop, rBot, h, color, extras) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 12), mat(color, extras));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function blobShadow() {
  const g = new THREE.CircleGeometry(0.42, 16);
  const m = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

function makeFaceTexture(img, fallbackKind) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = fallbackKind === "elon" ? "#f0d2b4" : "#e8c4a0";
  g.fillRect(0, 0, 256, 256);
  if (img) {
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    // Favor the upper portrait so a console splash still reads as a face.
    const srcH = sh * 0.62;
    g.drawImage(img, 0, 0, sw, srcH, 0, 0, 256, 256);
  } else {
    drawFallbackFace(g, fallbackKind);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawFallbackFace(g, kind) {
  g.fillStyle = "#2a1a14";
  g.beginPath();
  g.arc(88, 118, 10, 0, Math.PI * 2);
  g.arc(168, 118, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(92, 114, 3, 0, Math.PI * 2);
  g.arc(172, 114, 3, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = kind === "elon" ? "#8a4030" : "#6a3028";
  g.lineWidth = 5;
  g.beginPath();
  if (kind === "elon") {
    g.arc(128, 168, 22, 0.15, Math.PI - 0.15);
  } else {
    g.arc(128, 160, 24, 0.2, Math.PI - 0.2);
  }
  g.stroke();
}

export async function loadImage(src) {
  if (TEX_CACHE.has(src)) return TEX_CACHE.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  TEX_CACHE.set(src, p);
  return p;
}

function attachFace(head, img, kind) {
  const tex = makeFaceTexture(img, kind);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.0 })
  );
  plane.position.set(0, 0.02, 0.23);
  head.add(plane);
  return plane;
}

function limbSwing(mesh, t, amp, phase, axis = "x") {
  mesh.rotation[axis] = Math.sin(t + phase) * amp;
}

/**
 * Capsule-rigged tuxedo hero. Reads as a person in 3D — not a side billboard.
 */
export function makeBDB(faceImg) {
  const root = new THREE.Group();
  root.name = "BDB";
  const shadow = blobShadow();
  root.add(shadow);

  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const leftLeg = cyl(0.09, 0.1, 0.7, 0x12141c);
  leftLeg.position.set(-0.13, -0.52, 0);
  const leftShoe = box(0.16, 0.1, 0.26, 0x0a0a10);
  leftShoe.position.set(0, -0.4, 0.04);
  leftLeg.add(leftShoe);
  hips.add(leftLeg);

  const rightLeg = cyl(0.09, 0.1, 0.7, 0x12141c);
  rightLeg.position.set(0.13, -0.52, 0);
  const rightShoe = box(0.16, 0.1, 0.26, 0x0a0a10);
  rightShoe.position.set(0, -0.4, 0.04);
  rightLeg.add(rightShoe);
  hips.add(rightLeg);

  const torso = box(0.52, 0.62, 0.32, 0x101218, { metalness: 0.18, roughness: 0.45 });
  torso.position.y = 0.28;
  hips.add(torso);

  const shirt = box(0.22, 0.5, 0.18, 0xf4f1e8, { roughness: 0.5 });
  shirt.position.set(0, 0.3, 0.09);
  hips.add(shirt);

  const lapelL = box(0.1, 0.46, 0.04, 0x1a1c24);
  lapelL.position.set(-0.14, 0.3, 0.16);
  lapelL.rotation.z = 0.12;
  hips.add(lapelL);
  const lapelR = box(0.1, 0.46, 0.04, 0x1a1c24);
  lapelR.position.set(0.14, 0.3, 0.16);
  lapelR.rotation.z = -0.12;
  hips.add(lapelR);

  const btn1 = sph(0.03, 0xffd56c, { metalness: 0.7, roughness: 0.25, emissive: 0x332200, emissiveIntensity: 0.2 });
  btn1.position.set(0, 0.38, 0.17);
  const btn2 = btn1.clone();
  btn2.position.set(0, 0.22, 0.17);
  hips.add(btn1, btn2);

  const bow = box(0.22, 0.07, 0.08, 0xc9a227, { metalness: 0.45, roughness: 0.3 });
  bow.position.set(0, 0.56, 0.16);
  const knot = box(0.07, 0.08, 0.09, 0xffd56c, { metalness: 0.5 });
  knot.position.set(0, 0.56, 0.18);
  hips.add(bow, knot);

  const tailL = box(0.16, 0.34, 0.08, 0x0c0e14);
  tailL.position.set(-0.14, -0.08, -0.16);
  tailL.rotation.x = 0.18;
  const tailR = tailL.clone();
  tailR.position.x = 0.14;
  hips.add(tailL, tailR);

  const leftArm = cyl(0.07, 0.075, 0.58, 0x12141c);
  leftArm.position.set(-0.36, 0.28, 0);
  const leftHand = sph(0.075, 0xe6c2a0);
  leftHand.position.y = -0.32;
  leftArm.add(leftHand);
  hips.add(leftArm);

  const rightArm = cyl(0.07, 0.075, 0.58, 0x12141c);
  rightArm.position.set(0.36, 0.28, 0);
  const rightHand = sph(0.075, 0xe6c2a0);
  rightHand.position.y = -0.32;
  rightArm.add(rightHand);
  const gun = makeEggplantMesh(0.55);
  gun.position.set(0.02, -0.38, 0.12);
  gun.rotation.z = -1.2;
  gun.rotation.x = 0.4;
  rightArm.add(gun);
  hips.add(rightArm);

  const head = new THREE.Group();
  head.position.y = 0.74;
  const skull = sph(0.24, 0xe8c4a0, { roughness: 0.55 });
  head.add(skull);
  const hair = sph(0.255, 0x1a1210, { roughness: 0.7 });
  hair.scale.set(1, 0.72, 1.02);
  hair.position.y = 0.1;
  head.add(hair);
  attachFace(head, faceImg, "bdb");
  hips.add(head);

  const parts = { hips, leftLeg, rightLeg, leftArm, rightArm, head, shadow, gun, tailL, tailR };

  function update(dt, state) {
    const moving = state.moving;
    const grounded = state.grounded;
    const lockOn = state.lockOn;
    const inv = state.inv || 0;
    parts._t = (parts._t || 0) + dt * (moving ? 10 : 2.4);
    const t = parts._t;

    // Flash on hurt / invulnerability
    if (inv > 0) {
      root.visible = Math.floor(inv * 18) % 2 === 0;
    } else {
      root.visible = true;
    }

    if (grounded && moving) {
      limbSwing(leftLeg, t, 0.7, 0);
      limbSwing(rightLeg, t, 0.7, Math.PI);
      limbSwing(leftArm, t, 0.55, Math.PI);
      limbSwing(rightArm, t, 0.45, 0);
      hips.position.y = 0.92 + Math.abs(Math.sin(t)) * 0.05;
      tailL.rotation.x = 0.18 + Math.sin(t) * 0.2;
      tailR.rotation.x = 0.18 + Math.sin(t + Math.PI) * 0.2;
    } else {
      leftLeg.rotation.x *= 0.8;
      rightLeg.rotation.x *= 0.8;
      leftArm.rotation.x *= 0.8;
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, lockOn ? -0.35 : 0, 0.15);
      hips.position.y = THREE.MathUtils.lerp(hips.position.y, 0.92, 0.2);
      tailL.rotation.x = THREE.MathUtils.lerp(tailL.rotation.x, 0.18, 0.1);
      tailR.rotation.x = THREE.MathUtils.lerp(tailR.rotation.x, 0.18, 0.1);
    }
    if (!grounded) {
      leftLeg.rotation.x = -0.45;
      rightLeg.rotation.x = 0.25;
      leftArm.rotation.x = 0.5;
      tailL.rotation.x = -0.25;
      tailR.rotation.x = -0.25;
    }
    shadow.scale.setScalar(grounded ? 1 : 0.7);
    head.rotation.x = lockOn ? -0.08 : Math.sin(t * 0.35) * 0.03;
    head.rotation.y = lockOn ? 0 : Math.sin(t * 0.2) * 0.05;
  }

  return { root, parts, update, height: 1.78, radius: 0.42 };
}

export function makeElon(faceImg) {
  const root = new THREE.Group();
  root.name = "Elon";
  root.add(blobShadow());

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);

  const leftLeg = cyl(0.09, 0.1, 0.64, 0x2a3344);
  leftLeg.position.set(-0.12, -0.5, 0);
  const rightLeg = cyl(0.09, 0.1, 0.64, 0x2a3344);
  rightLeg.position.set(0.12, -0.5, 0);
  hips.add(leftLeg, rightLeg);

  const torso = box(0.48, 0.56, 0.28, 0x111318);
  torso.position.y = 0.24;
  hips.add(torso);
  const logo = box(0.16, 0.1, 0.04, 0xe8e8ea, { emissive: 0x333333, emissiveIntensity: 0.15 });
  logo.position.set(0, 0.3, 0.15);
  hips.add(logo);

  const leftArm = cyl(0.065, 0.07, 0.52, 0x111318);
  leftArm.position.set(-0.32, 0.24, 0);
  const rightArm = cyl(0.065, 0.07, 0.52, 0x111318);
  rightArm.position.set(0.32, 0.24, 0);
  hips.add(leftArm, rightArm);

  const head = new THREE.Group();
  head.position.y = 0.66;
  head.add(sph(0.23, 0xf0d2b4));
  const hair = box(0.42, 0.08, 0.36, 0x3a2a20);
  hair.position.y = 0.16;
  head.add(hair);
  attachFace(head, faceImg, "elon");
  hips.add(head);

  const ha = makeHaSprite();
  ha.position.set(0.15, 1.85, 0);
  ha.visible = false;
  root.add(ha);

  const lockMark = makeLockMarker();
  lockMark.position.y = 2.15;
  lockMark.visible = false;
  root.add(lockMark);

  const parts = { hips, leftLeg, rightLeg, leftArm, rightArm, head, ha, lockMark, shadow: root.children[0] };

  function update(dt, walking, laughOn, hurtTime = 0) {
    this._t = (this._t || 0) + dt * (walking ? 8 : 2);
    const t = this._t;
    if (walking) {
      leftLeg.rotation.x = Math.sin(t) * 0.55;
      rightLeg.rotation.x = Math.sin(t + Math.PI) * 0.55;
      leftArm.rotation.x = Math.sin(t + Math.PI) * 0.4;
      rightArm.rotation.x = Math.sin(t) * 0.4;
      hips.position.y = 0.88 + Math.abs(Math.sin(t)) * 0.04;
    }
    ha.visible = !!laughOn;
    if (laughOn) {
      ha.position.y = 1.85 + Math.sin(t * 6) * 0.08;
      ha.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
      head.rotation.x = -0.15 + Math.sin(t * 12) * 0.08;
    } else {
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, 0, 0.1);
    }
    lockMark.rotation.y += dt * 2.2;
    lockMark.position.y = 2.15 + Math.sin(t * 4) * 0.08;
  }

  return {
    root,
    parts: { hips, leftLeg, rightLeg, leftArm, rightArm, head, ha, lockMark },
    update,
    radius: 0.48,
    height: 1.7,
  };
}

export function makeEve() {
  const root = new THREE.Group();
  root.name = "Eve";
  root.add(blobShadow());
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  root.add(hips);

  const skirt = cyl(0.28, 0.34, 0.7, 0x2a1c16, { roughness: 0.7 });
  skirt.position.y = -0.28;
  hips.add(skirt);
  const apron = box(0.3, 0.42, 0.08, 0xe8fff6);
  apron.position.set(0, -0.12, 0.2);
  hips.add(apron);
  const stripe = box(0.3, 0.07, 0.09, 0x148a68);
  stripe.position.set(0, -0.08, 0.21);
  hips.add(stripe);
  const p = box(0.08, 0.09, 0.02, 0x17352f);
  p.position.set(0, -0.08, 0.26);
  hips.add(p);

  const torso = box(0.36, 0.38, 0.22, 0x4a3328);
  torso.position.y = 0.28;
  hips.add(torso);
  const leftArm = cyl(0.055, 0.06, 0.48, 0xe6c2a0);
  leftArm.position.set(-0.26, 0.22, 0);
  const rightArm = cyl(0.055, 0.06, 0.48, 0xe6c2a0);
  rightArm.position.set(0.26, 0.22, 0.06);
  rightArm.rotation.x = -0.8;
  const scoop = cyl(0.015, 0.015, 0.46, 0xd8dee8, { metalness: 0.6 });
  scoop.position.set(0, -0.42, 0);
  const scoopHead = sph(0.1, 0xd8dee8, { metalness: 0.5 });
  scoopHead.position.y = -0.28;
  const whey = sph(0.075, 0x7dffc8, { emissive: 0x2a8a60, emissiveIntensity: 0.35 });
  whey.position.y = -0.28;
  rightArm.add(scoop, scoopHead, whey);
  hips.add(leftArm, rightArm);

  const head = new THREE.Group();
  head.position.y = 0.62;
  head.add(sph(0.2, 0xe6c2a0));
  const hair = sph(0.22, 0x1a1210);
  hair.scale.set(1.05, 0.85, 1.05);
  hair.position.y = 0.06;
  head.add(hair);
  const bun = sph(0.09, 0x1a1210);
  bun.position.set(0, 0.2, -0.02);
  head.add(bun);
  const face = makeFaceTexture(null, "eve");
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshStandardMaterial({ map: face, roughness: 0.65 })
  );
  plane.position.set(0, 0.0, 0.19);
  head.add(plane);
  const earring = sph(0.03, 0xffd56c, { metalness: 0.7, emissive: 0x332200, emissiveIntensity: 0.25 });
  earring.position.set(-0.2, -0.02, 0.04);
  head.add(earring);
  hips.add(head);

  function update(dt) {
    this._t = (this._t || 0) + dt * 2.2;
    const t = this._t;
    head.rotation.y = Math.sin(t * 0.5) * 0.12;
    rightArm.rotation.x = -0.8 + Math.sin(t) * 0.15;
    whey.position.y = -0.28 + Math.sin(t * 2) * 0.02;
  }

  return { root, radius: 0.4, update };
}

export function makeEggplantMesh(scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    mat(0x8b2fc0, { roughness: 0.35, metalness: 0.12, emissive: 0x3a0a4a, emissiveIntensity: 0.18 })
  );
  body.scale.set(1.15, 0.78, 0.78);
  const stem = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 8), mat(0x5db845, { roughness: 0.6 }));
  stem.position.set(-0.16, 0.02, 0);
  stem.rotation.z = 1.25;
  g.add(body, stem);
  g.scale.setScalar(scale);
  return g;
}

function makeHaSprite() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 64);
  g.font = "bold 42px Trebuchet MS, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.strokeStyle = "#3a1020";
  g.lineWidth = 8;
  g.strokeText("HA", 64, 32);
  g.fillStyle = "#ffe27a";
  g.fillText("HA", 64, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(0.9, 0.45, 1);
  return spr;
}

function makeLockMarker() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.035, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd56c })
  );
  ring.rotation.x = Math.PI / 2;
  const tri = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 3), new THREE.MeshBasicMaterial({ color: 0xffd56c }));
  tri.rotation.x = Math.PI;
  tri.position.y = 0.28;
  g.add(ring, tri);
  return g;
}

export function makePromptSprite(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(8,10,18,0.75)";
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = "#ffd56c";
  g.strokeRect(4, 4, 248, 56);
  g.fillStyle = "#ffe27a";
  g.font = "bold 28px Trebuchet MS, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(1.6, 0.4, 1);
  return spr;
}
