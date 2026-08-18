import * as THREE from "three";

/**
 * High-performance 3D particle and VFX manager for Ocarina-style visual effects:
 * - Dust poofs on footfalls & landing
 * - Eggplant muzzle flash & produce smoke trails
 * - Impact bursts & spark explosions
 * - Fountain mystical whey motes
 * - Song of the Scoop golden musical notes floating up
 * - Papacito shockwave ring & disintegration sparks
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.rings = [];

    // Shared particle geometries & materials for efficiency
    this.sparkGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.moteGeo = new THREE.SphereGeometry(0.05, 5, 5);
    this.smokeGeo = new THREE.DodecahedronGeometry(0.12, 0);

    // Note sprites canvas
    this._initNoteTextures();
  }

  _initNoteTextures() {
    this.noteTextures = {};
    const notes = ["♪", "♫", "♬", "♩", "✨"];
    notes.forEach((sym) => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const g = c.getContext("2d");
      g.fillStyle = "#ffd56c";
      g.font = "bold 44px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = "#ffaa00";
      g.shadowBlur = 10;
      g.fillText(sym, 32, 32);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.noteTextures[sym] = tex;
    });
  }

  emitDust(x, y, z, count = 4, color = 0xd0c090) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        this.smokeGeo,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        })
      );
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.3,
        y + 0.08 + Math.random() * 0.1,
        z + (Math.random() - 0.5) * 0.3
      );
      const scale = 0.5 + Math.random() * 0.7;
      mesh.scale.setScalar(scale);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.6 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 1.2,
        rotSpeed: (Math.random() - 0.5) * 3,
        growth: 1.4,
        drag: 0.92,
        life: 0.45 + Math.random() * 0.2,
        maxLife: 0.6,
        type: "dust",
      });
    }
  }

  emitProduceTrail(x, y, z) {
    const mesh = new THREE.Mesh(
      this.moteGeo,
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.4 ? 0xb46be8 : 0x7ef0c8,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.1,
      y + (Math.random() - 0.5) * 0.1,
      z + (Math.random() - 0.5) * 0.1
    );
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      vz: (Math.random() - 0.5) * 0.4,
      rotSpeed: 0,
      growth: 0.8,
      drag: 0.95,
      life: 0.3,
      maxLife: 0.3,
      type: "produce",
    });
  }

  emitBurst(x, y, z, color = 0xffa020, count = 16) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        this.sparkGeo,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthWrite: false,
        })
      );
      mesh.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 6;
      const upSpeed = 2 + Math.random() * 5;
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: upSpeed,
        vz: Math.sin(angle) * speed,
        rotSpeed: 0,
        gravity: -16,
        growth: 0.5,
        drag: 0.96,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
        type: "spark",
      });
    }

    // Expanding shock ring on hit
    this.emitShockwave(x, y, z, 0.4, 3.2, color);
  }

  emitShockwave(x, y, z, startR = 0.2, maxR = 4.0, color = 0xffd56c) {
    const geo = new THREE.RingGeometry(startR, startR + 0.15, 24);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.05, z);
    this.scene.add(mesh);

    this.rings.push({
      mesh,
      r: startR,
      maxR,
      growSpeed: (maxR - startR) / 0.45,
      life: 0.45,
      maxLife: 0.45,
    });
  }

  emitMusicNotes(x, y, z) {
    const syms = ["♪", "♫", "♬", "✨"];
    const sym = syms[(Math.random() * syms.length) | 0];
    const tex = this.noteTextures[sym] || this.noteTextures["♪"];
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.position.set(
      x + (Math.random() - 0.5) * 0.6,
      y + 1.2 + Math.random() * 0.3,
      z + (Math.random() - 0.5) * 0.6
    );
    spr.scale.set(0.65, 0.65, 1);
    this.scene.add(spr);

    this.particles.push({
      mesh: spr,
      isSprite: true,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 1.6 + Math.random() * 0.9,
      vz: (Math.random() - 0.5) * 0.8,
      wobble: Math.random() * Math.PI * 2,
      growth: 1.1,
      life: 1.2,
      maxLife: 1.2,
      type: "note",
    });
  }

  emitFountainMote(x, z) {
    const mesh = new THREE.Mesh(
      this.moteGeo,
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0x7ef0c8 : 0xb8ffe0,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      })
    );
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.9;
    mesh.position.set(x + Math.cos(angle) * r, 0.4 + Math.random() * 0.8, z + Math.sin(angle) * r);
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      vx: Math.cos(angle) * 0.3,
      vy: 0.8 + Math.random() * 0.6,
      vz: Math.sin(angle) * 0.3,
      growth: 0.8,
      drag: 0.98,
      life: 1.4,
      maxLife: 1.4,
      type: "fountain",
    });
  }

  update(dt) {
    // Update individual particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      const norm = p.life / p.maxLife;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      if (p.gravity) p.vy += p.gravity * dt;
      if (p.drag) {
        p.vx *= p.drag;
        p.vz *= p.drag;
      }
      if (p.wobble !== undefined) {
        p.wobble += dt * 4;
        p.vx = Math.sin(p.wobble) * 0.6;
      }

      if (p.isSprite) {
        p.mesh.material.opacity = norm;
        const s = (1 + (1 - norm) * p.growth) * 0.6;
        p.mesh.scale.set(s, s, 1);
      } else {
        p.mesh.material.opacity = norm * 0.85;
        if (p.rotSpeed) p.mesh.rotation.y += p.rotSpeed * dt;
        const sc = 1 + (1 - norm) * p.growth;
        p.mesh.scale.setScalar(sc);
      }
    }

    // Update expanding rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        this.rings.splice(i, 1);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      r.r += r.growSpeed * dt;
      const s = r.r;
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = (1 - progress) * 0.8;
    }
  }

  clear() {
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.rings.forEach((r) => this.scene.remove(r.mesh));
    this.particles = [];
    this.rings = [];
  }
}
