import * as THREE from "three";
import { LAYOUT } from "./lines.js";

function std(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.72,
    metalness: extras.metalness ?? 0.04,
    emissive: extras.emissive ?? 0x000000,
    emissiveIntensity: extras.emissiveIntensity ?? 0,
  });
}

function addBox(parent, w, h, d, color, x, y, z, extras) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color, extras));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, rT, rB, h, color, x, y, z, extras) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, extras?.seg || 12), std(color, extras));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function collider(minX, maxX, minZ, maxZ, kind) {
  return { minX, maxX, minZ, maxZ, kind };
}

function paintGround() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d");
  // Field grass (most of the map, east)
  const grass = g.createLinearGradient(0, 0, 1024, 0);
  grass.addColorStop(0, "#24331c");
  grass.addColorStop(0.28, "#2e4a24");
  grass.addColorStop(1, "#3a5a2a");
  g.fillStyle = grass;
  g.fillRect(0, 0, 1024, 1024);

  // Noise blades / dirt
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    g.fillStyle = Math.random() > 0.5 ? "rgba(20,40,16,0.25)" : "rgba(90,120,50,0.18)";
    g.fillRect(x, y, 3 + Math.random() * 6, 2 + Math.random() * 4);
  }

  // Plaza cobble (west)
  const plazaW = 1024 * ((14 - -32) / (92 - -32));
  g.fillStyle = "#3a3a42";
  g.fillRect(0, 220, plazaW + 20, 584);
  for (let y = 220; y < 804; y += 18) {
    for (let x = 0; x < plazaW + 20; x += 22) {
      const ox = (Math.floor(y / 18) % 2) * 11;
      g.fillStyle = `rgb(${58 + ((x * y) % 18)},${56 + ((x + y) % 14)},${62 + ((x * 3) % 16)})`;
      g.fillRect(x + ox, y, 20, 16);
      g.strokeStyle = "rgba(20,20,24,0.35)";
      g.strokeRect(x + ox, y, 20, 16);
    }
  }

  // Gold path through plaza into boulevard
  g.fillStyle = "#6a5a38";
  g.fillRect(plazaW - 10, 470, 520, 84);
  g.fillStyle = "rgba(255,213,108,0.12)";
  g.fillRect(plazaW - 10, 486, 520, 50);
  // Path edge stones
  g.fillStyle = "#8a7a50";
  g.fillRect(plazaW - 10, 466, 520, 8);
  g.fillRect(plazaW - 10, 548, 520, 8);

  // Plaza medallion
  g.fillStyle = "#c9a227";
  g.beginPath();
  g.arc(plazaW * 0.62, 512, 48, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1a2230";
  g.beginPath();
  g.arc(plazaW * 0.62, 512, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffd56c";
  g.font = "bold 22px Trebuchet MS, sans-serif";
  g.textAlign = "center";
  g.fillText("P", plazaW * 0.62, 520);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function skyDome() {
  const geo = new THREE.SphereGeometry(220, 32, 20);
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#0a1020");
  grd.addColorStop(0.42, "#1a2748");
  grd.addColorStop(0.7, "#3a2a48");
  grd.addColorStop(1, "#f0b070");
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "sky";
  return mesh;
}

function makeLamp(x, z) {
  const g = new THREE.Group();
  addCyl(g, 0.12, 0.18, 0.16, 0x2a2a30, 0, 0.08, 0);
  addCyl(g, 0.06, 0.07, 2.4, 0x1c1c22, 0, 1.3, 0);
  const lamp = addCyl(g, 0.16, 0.14, 0.28, 0xffe9a0, 0, 2.6, 0, {
    emissive: 0xffc878,
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  const light = new THREE.PointLight(0xffc878, 2.4, 16, 2);
  light.position.set(0, 2.55, 0);
  g.add(light);
  g.position.set(x, 0, z);
  return { group: g, collider: collider(x - 0.22, x + 0.22, z - 0.22, z + 0.22, "lamp"), lamp };
}

function makePlanter(x, z) {
  const g = new THREE.Group();
  addBox(g, 1.3, 0.45, 1.3, 0x6a3a22, 0, 0.22, 0);
  addBox(g, 1.1, 0.16, 1.1, 0x2a4a20, 0, 0.48, 0);
  addCyl(g, 0.08, 0.14, 0.7, 0x3a5a24, 0, 0.85, 0);
  addCyl(g, 0.42, 0.2, 0.35, 0x4a7a30, 0, 1.2, 0);
  g.position.set(x, 0, z);
  return { group: g, collider: collider(x - 0.7, x + 0.7, z - 0.7, z + 0.7, "planter") };
}

function makeTree(x, z, scale = 1) {
  const g = new THREE.Group();
  addCyl(g, 0.16 * scale, 0.22 * scale, 1.6 * scale, 0x4a3020, 0, 0.8 * scale, 0);
  addCyl(g, 1.1 * scale, 0.35 * scale, 1.8 * scale, 0x2f5a28, 0, 2.1 * scale, 0, { seg: 8 });
  addCyl(g, 0.75 * scale, 0.2 * scale, 1.1 * scale, 0x3a6e30, 0, 2.9 * scale, 0, { seg: 8 });
  g.position.set(x, 0, z);
  return { group: g, collider: collider(x - 0.45 * scale, x + 0.45 * scale, z - 0.45 * scale, z + 0.45 * scale, "tree") };
}

function makeBuilding(x, z, w, d, h, color, label) {
  const g = new THREE.Group();
  addBox(g, w, h, d, color, 0, h * 0.5, 0);
  addBox(g, w + 0.4, 0.28, d + 0.4, 0x5a4030, 0, h + 0.05, 0);
  // windows
  const cols = Math.max(1, Math.floor(w / 2.2));
  for (let i = 0; i < cols; i++) {
    const wx = -w * 0.32 + (i * w * 0.64) / Math.max(1, cols - 1);
    addBox(g, 0.55, 0.7, 0.08, 0xffe0a0, wx, h * 0.55, d * 0.5 + 0.01, {
      emissive: 0xaa7744,
      emissiveIntensity: 0.35,
    });
  }
  if (label) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#ffd56c";
    ctx.font = "bold 22px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 3.4), 0.7), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(0, h * 0.82, d * 0.5 + 0.06);
    g.add(sign);
  }
  g.position.set(x, 0, z);
  return {
    group: g,
    collider: collider(x - w * 0.5, x + w * 0.5, z - d * 0.5, z + d * 0.5, "building"),
  };
}

function makePalace() {
  const g = new THREE.Group();
  const x = -26;
  const z = 0;
  // Mass
  addBox(g, 16, 8.2, 18, 0xc4b496, x + 8, 4.1, z);
  addBox(g, 16.6, 0.4, 18.6, 0x8a6a3a, x + 8, 8.35, z, { metalness: 0.25 });
  // Gold roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(12.2, 3.4, 4), std(0xc9a227, { metalness: 0.35, roughness: 0.4 }));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x + 8, 10.2, z);
  roof.castShadow = true;
  g.add(roof);
  // Columns
  for (const cz of [-6, -2, 2, 6]) {
    addCyl(g, 0.32, 0.36, 5.2, 0xe8dcc0, -17.6, 2.6, cz, { metalness: 0.12 });
    addBox(g, 0.8, 0.22, 0.8, 0xc9a227, -17.6, 5.3, cz, { metalness: 0.4 });
  }
  // Steps
  addBox(g, 6.4, 0.22, 3.2, 0xb0a090, -17.4, 0.11, 0);
  addBox(g, 5.6, 0.22, 2.4, 0xc0b0a0, -17.7, 0.32, 0);
  addBox(g, 4.8, 0.22, 1.6, 0xd0c0b0, -18.0, 0.53, 0);
  // Door recess + velvet-adjacent gold frame (palace entry)
  addBox(g, 2.6, 4.1, 0.2, 0x1a1018, -17.95, 2.5, 0);
  addBox(g, 2.9, 4.4, 0.12, 0xc9a227, -17.82, 2.55, 0, { metalness: 0.45, roughness: 0.35 });
  addBox(g, 2.0, 3.4, 0.08, 0x3a2018, -17.7, 2.3, 0, { roughness: 0.55 });
  const glow = new THREE.PointLight(0xffc878, 1.6, 10, 2);
  glow.position.set(-16.8, 2.8, 0);
  g.add(glow);

  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1420";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#ffd56c";
  ctx.font = "bold 36px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAPI'S PROTEIN PALACE", 256, 48);
  ctx.font = "bold 22px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#7ef0c8";
  ctx.fillText("NO REFUNDS", 256, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.7), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(-17.55, 6.6, 0);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);

  return {
    group: g,
    // Solid mass of the palace; door face is interactable in front of it.
    colliders: [collider(-34, -18.4, -9.2, 9.2, "palace")],
  };
}

function makeVelvetDoor() {
  const g = new THREE.Group();
  const x = LAYOUT.velvet.x;
  const z = LAYOUT.velvet.z;
  addBox(g, 1.6, 5.6, 5.2, 0x3a2a22, x + 1.1, 2.8, z);
  addBox(g, 0.55, 5.2, 4.4, 0xc9a227, x + 0.55, 2.7, z, { metalness: 0.5, roughness: 0.3 });
  addBox(g, 0.18, 4.6, 3.2, 0x5a1028, x + 0.28, 2.5, z, {
    roughness: 0.55,
    emissive: 0x2a0810,
    emissiveIntensity: 0.2,
  });
  // Lock plate
  addBox(g, 0.16, 0.55, 0.4, 0xffd56c, x + 0.18, 2.3, z, { metalness: 0.7, roughness: 0.25 });
  addCyl(g, 0.12, 0.12, 0.08, 0x1a1020, x + 0.12, 2.3, z, { metalness: 0.4 });
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.14, 8, 16, Math.PI),
    std(0xc9a227, { metalness: 0.55, roughness: 0.28 })
  );
  arch.rotation.z = Math.PI / 2;
  arch.rotation.y = Math.PI / 2;
  arch.position.set(x + 0.5, 5.1, z);
  g.add(arch);

  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 80;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#140810";
  ctx.fillRect(0, 0, 256, 80);
  ctx.fillStyle = "#e8a0ff";
  ctx.font = "bold 28px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VELVET  D1", 128, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(x - 0.05, 4.7, z);
  sign.rotation.y = -Math.PI / 2;
  g.add(sign);

  return {
    group: g,
    collider: collider(x - 0.4, x + 2.2, z - 2.6, z + 2.6, "velvet"),
  };
}

function makeCrate(x, z) {
  const g = new THREE.Group();
  addBox(g, 0.9, 0.9, 0.9, 0x8a4a22, 0, 0.45, 0);
  addBox(g, 0.94, 0.06, 0.94, 0xf0c07a, 0, 0.88, 0);
  g.position.set(x, 0, z);
  g.rotation.y = (x + z) * 0.15;
  return { group: g, collider: collider(x - 0.5, x + 0.5, z - 0.5, z + 0.5, "crate") };
}

function makeFence(x0, z0, x1, z1) {
  const g = new THREE.Group();
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const n = Math.max(2, Math.round(len / 2.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    addCyl(g, 0.06, 0.07, 1.1, 0x6a4a2a, x0 + dx * t, 0.55, z0 + dz * t);
  }
  const rail = addBox(g, len, 0.08, 0.08, 0x8a6238, (x0 + x1) / 2, 0.85, (z0 + z1) / 2);
  rail.rotation.y = Math.atan2(dx, dz);
  return g;
}

function makeBoulevardSign() {
  const g = new THREE.Group();
  addCyl(g, 0.07, 0.08, 2.2, 0x2a2a30, 18, 1.1, -12);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#152038";
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = "#ffd56c";
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 148);
  ctx.fillStyle = "#ffd56c";
  ctx.font = "bold 34px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BOULEVARD OF", 256, 70);
  ctx.fillText("BAD DECISIONS", 256, 118);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.35), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(18, 2.4, -12);
  sign.rotation.y = 0.4;
  g.add(sign);
  return { group: g, collider: collider(17.7, 18.3, -12.3, -11.7, "sign") };
}

export function buildWorld(scene) {
  scene.fog = new THREE.Fog(0x1a2034, 38, 120);
  scene.background = new THREE.Color(0x152038);
  scene.add(skyDome());

  const hemi = new THREE.HemisphereLight(0x9bb8ff, 0x3a2a18, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd0a0, 1.15);
  sun.position.set(-30, 42, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x405070, 0.28));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(124, 84),
    new THREE.MeshStandardMaterial({ map: paintGround(), roughness: 0.92, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(28, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const colliders = [];
  const props = new THREE.Group();
  scene.add(props);

  const palace = makePalace();
  props.add(palace.group);
  colliders.push(...palace.colliders);

  const velvet = makeVelvetDoor();
  props.add(velvet.group);
  colliders.push(velvet.collider);

  const buildings = [
    makeBuilding(-8, -16.5, 7, 4.2, 4.6, 0x6a4458, "SCOOP BAR"),
    makeBuilding(4, 16.8, 6.4, 3.8, 4.2, 0x3a4a62, "WHEY CO-OP"),
    makeBuilding(32, -32, 8, 5, 5.2, 0x5a4038, "PRODUCE"),
    makeBuilding(58, 30, 7.2, 4.6, 4.8, 0x4a3858, "NIGHT GYM"),
    makeBuilding(70, -28, 6, 4, 3.8, 0x3a3830, null),
  ];
  for (const b of buildings) {
    props.add(b.group);
    colliders.push(b.collider);
  }

  const lamps = [
    makeLamp(-12, -10),
    makeLamp(-12, 10),
    makeLamp(8, -8),
    makeLamp(8, 8),
    makeLamp(28, -14),
    makeLamp(28, 14),
    makeLamp(52, -18),
    makeLamp(52, 18),
    makeLamp(72, -8),
    makeLamp(72, 8),
  ];
  // Additional Boulevard streetlights and ambient atmospheric lanterns
  for (const [lx, lz] of [
    [40, 0],
    [60, -4],
  ]) {
    const l = makeLamp(lx, lz);
    props.add(l.group);
    colliders.push(l.collider);
  }

  const planters = [makePlanter(-4, -8), makePlanter(-4, 8), makePlanter(8, -12), makePlanter(40, 10), makePlanter(40, -12)];
  for (const p of planters) {
    props.add(p.group);
    colliders.push(p.collider);
  }

  const trees = [
    makeTree(22, -28, 1.15),
    makeTree(24, 32, 1.3),
    makeTree(64, -34, 1.4),
    makeTree(66, 34, 1.2),
    makeTree(84, 18, 1.1),
    makeTree(84, -20, 1.25),
    makeTree(36, 36, 0.95),
  ];
  for (const t of trees) {
    props.add(t.group);
    colliders.push(t.collider);
  }

  for (const [x, z] of [
    [36, -6],
    [38, -5.2],
    [62, 8],
    [14, 12],
  ]) {
    const c = makeCrate(x, z);
    props.add(c.group);
    colliders.push(c.collider);
  }

  props.add(makeFence(14, -38, 86, -38));
  props.add(makeFence(14, 38, 86, 38));
  props.add(makeFence(87.4, -36, 87.4, -8));
  props.add(makeFence(87.4, 8, 87.4, 36));

  const sign = makeBoulevardSign();
  props.add(sign.group);
  colliders.push(sign.collider);

  const fountain = makeShakeFountain();
  props.add(fountain.group);

  const gate = makeFieldGate();
  props.add(gate.group);
  colliders.push(gate.collider, ...gate.wallColliders);

  // Collectible protein shakes in the field
  const shakes = [];
  const shakePositions = [
    { x: 30, z: 8 },
    { x: 50, z: -14 },
    { x: 68, z: 12 },
  ];
  for (const pos of shakePositions) {
    const s = makeWorldShake(pos.x, pos.z);
    props.add(s.group);
    shakes.push(s);
  }

  return {
    colliders,
    spawn: LAYOUT.spawn,
    palaceDoor: { x: LAYOUT.palaceDoor.x, z: LAYOUT.palaceDoor.z, r: 2.4 },
    eve: { x: LAYOUT.eve.x, z: LAYOUT.eve.z, r: 2.2 },
    velvet: { x: LAYOUT.velvet.x, z: LAYOUT.velvet.z, r: 2.8 },
    fountain: { x: LAYOUT.fountain.x, z: LAYOUT.fountain.z, r: 2.1 },
    elonHome: LAYOUT.elon,
    gate,
    shakes,
  };
}

function makeWorldShake(x, z) {
  const g = new THREE.Group();
  addCyl(g, 0.16, 0.14, 0.44, 0x7dffc8, 0, 0.22, 0, { emissive: 0x148a68, emissiveIntensity: 0.5 });
  addCyl(g, 0.11, 0.11, 0.12, 0x1a2230, 0, 0.5, 0);
  addBox(g, 0.18, 0.08, 0.18, 0xfff3b0, 0, 0.28, 0);
  const glow = new THREE.PointLight(0x7ef0c8, 1.2, 5, 2);
  glow.position.set(0, 0.4, 0);
  g.add(glow);

  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x7ef0c8, transparent: true, opacity: 0.25, depthWrite: false })
  );
  aura.position.y = 0.28;
  g.add(aura);

  g.position.set(x, 0.35, z);
  return {
    group: g,
    x,
    z,
    taken: false,
    update(dt, t) {
      if (this.taken) return;
      g.rotation.y += dt * 2.2;
      g.position.y = 0.35 + Math.sin(t * 3.5 + x) * 0.12;
      aura.scale.setScalar(1 + Math.sin(t * 5) * 0.15);
    },
  };
}

function makeShakeFountain() {
  const g = new THREE.Group();
  const x = LAYOUT.fountain.x;
  const z = LAYOUT.fountain.z;
  addCyl(g, 1.25, 1.35, 0.24, 0xc9a227, x, 0.12, z, { metalness: 0.35 });
  addCyl(g, 1.0, 1.05, 0.18, 0x1a2230, x, 0.28, z);
  addCyl(g, 0.22, 0.28, 0.9, 0x7ef0c8, x, 0.72, z, { emissive: 0x2a8a60, emissiveIntensity: 0.35 });
  addCyl(g, 0.16, 0.2, 0.28, 0x1a2230, x, 1.22, z);
  addBox(g, 0.28, 0.42, 0.28, 0x7dffc8, x, 1.52, z, { emissive: 0x148a68, emissiveIntensity: 0.4 });
  addBox(g, 0.32, 0.08, 0.32, 0xfff3b0, x, 1.48, z);
  const glow = new THREE.PointLight(0x7ef0c8, 1.4, 8, 2);
  glow.position.set(x, 1.6, z);
  g.add(glow);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#102018";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#7ef0c8";
  ctx.font = "bold 22px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SHAKE FOUNTAIN", 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(x, 2.05, z);
  g.add(sign);
  return { group: g };
}

function makeFieldGate() {
  const g = new THREE.Group();
  const x = LAYOUT.gate.x;
  const half = LAYOUT.gate.halfW;
  // Side posts + plaza edge walls so the opening is the gate, not a hallway.
  addBox(g, 0.7, 4.2, 0.7, 0xc9a227, x, 2.1, -half, { metalness: 0.4 });
  addBox(g, 0.7, 4.2, 0.7, 0xc9a227, x, 2.1, half, { metalness: 0.4 });
  addBox(g, 0.8, 3.2, 9.2, 0x3a3228, x, 1.6, -half - 4.6);
  addBox(g, 0.8, 3.2, 9.2, 0x3a3228, x, 1.6, half + 4.6);
  addBox(g, 1.0, 0.35, half * 2 + 1.2, 0xc9a227, x, 3.85, 0, { metalness: 0.35 });

  const bars = new THREE.Group();
  bars.name = "gateBars";
  for (let i = 0; i < 9; i++) {
    const zz = -half + 0.55 + i * ((half * 2 - 1.1) / 8);
    addCyl(bars, 0.06, 0.06, 3.4, 0x2a1a22, x, 1.75, zz, { metalness: 0.45, roughness: 0.35 });
  }
  addBox(bars, 0.12, 0.12, half * 2 - 0.4, 0x8a6a3a, x, 2.4, 0, { metalness: 0.3 });
  g.add(bars);

  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#152038";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#ffd56c";
  ctx.font = "bold 20px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FIELD GATE", 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(x - 0.5, 4.25, 0);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);

  return {
    group: g,
    bars,
    openY: 0,
    collider: collider(x - 0.45, x + 0.45, -half, half, "gate"),
    wallColliders: [
      collider(x - 0.5, x + 0.5, -half - 9.2, -half, "gatewall"),
      collider(x - 0.5, x + 0.5, half, half + 9.2, "gatewall"),
    ],
  };
}
