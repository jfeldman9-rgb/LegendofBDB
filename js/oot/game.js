import * as THREE from "three";
import { AudioBus } from "../audio.js";
import {
  LINES,
  ZONE_NAME,
  PLAZA_NAME,
  FIELD_NAME,
  DEATH_TITLES,
  CHECKPOINT_TOAST,
  SAVE_KEY,
  HERO_CREDIT,
  LAYOUT,
  defaultSave,
} from "./lines.js";
import { clamp, nearPoint, resolveWorld, zoneAt, segmentHitsAABB } from "./physics.js";
import { Input } from "./input.js";
import { makeBDB, makeElon, makeEve, makeEggplantMesh, loadImage } from "./actors.js";
import { buildWorld } from "./world3d.js";
import { SONG_OF_THE_SCOOP, NOTE_FREQ, NOTE_GLYPH, feedNote } from "./song.js";

function loadSave() {
  try {
    return { ...defaultSave(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
  } catch {
    return defaultSave();
  }
}

function writeSave(s) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}

export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector("#game");
    this.audio = new AudioBus();
    this.input = new Input(root);
    this.save = loadSave();
    this.mode = "title";
    this.menu = "main";
    this.talk = null;
    this.needScoop = false;
    this.song = null;
    this.fieldLooked = false;
    this.lockOn = false;
    this.toastT = 0;
    this.bannerT = 0;
    this.papacitoT = 0;
    this.papiHoldT = 0;
    this.papiOpened = false;
    this.score = 0;
    this.kills = 0;
    this.charges = 0;
    this.shakeN = 0;
    this.projectiles = [];
    this.gateOpenT = 0;
    this.promptKind = null;
    this.queuedTalk = null;

    this._setupThree();
    this.world = buildWorld(this.scene);
    if (this.save.fieldOpen) this._setGateOpen(true, true);
    this._spawnActors();
    this._bindUI();
    this._resetPlayer(this.world.spawn);
    this.last = performance.now();
    this._orientation();
    this.showMenu("main");
    requestAnimationFrame((t) => this.loop(t));
  }

  _setupThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 280);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.cam = { yaw: 2.4, pitch: 0.28, dist: 7.4 };
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const w = this.canvas.clientWidth || this.root.clientWidth || 960;
    const h = this.canvas.clientHeight || this.root.clientHeight || 540;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _spawnActors() {
    this.hero = makeBDB(null);
    this.scene.add(this.hero.root);
    this.elonActor = makeElon(null);
    this.elonActor.root.position.set(LAYOUT.elon.x, 0, LAYOUT.elon.z);
    this.scene.add(this.elonActor.root);
    this.eve = makeEve();
    this.eve.root.position.set(LAYOUT.eve.x, 0, LAYOUT.eve.z);
    this.eve.root.rotation.y = Math.PI / 2;
    this.scene.add(this.eve.root);

    loadImage("assets/chars/bdb-console.webp").then((img) => {
      if (img && this.hero) this._swapFace(this.hero.root, img);
    });
    loadImage("assets/chars/elon-console.webp").then((img) => {
      if (img && this.elonActor) this._swapFace(this.elonActor.root, img);
      this._paintElon(img);
    });
  }

  _swapFace(root, img) {
    root.traverse((o) => {
      if (o.isMesh && o.material && o.material.map && o.geometry && o.geometry.type === "PlaneGeometry") {
        const c = document.createElement("canvas");
        c.width = 256;
        c.height = 256;
        const g = c.getContext("2d");
        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;
        g.drawImage(img, 0, 0, sw, sh * 0.62, 0, 0, 256, 256);
        o.material.map.image = c;
        o.material.map.needsUpdate = true;
      }
    });
  }

  _paintElon(img) {
    const el = this.ui && this.ui.elon;
    if (!el || !img) return;
    const c = el.getContext("2d");
    c.clearRect(0, 0, el.width, el.height);
    c.drawImage(img, 0, 0, el.width, el.height);
  }

  _orientation() {
    const check = () => {
      const tall = window.innerHeight > window.innerWidth * 1.05;
      document.body.classList.toggle("portrait-warn", tall);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
  }

  _bindUI() {
    const $ = (s) => this.root.querySelector(s);
    this.ui = {
      toast: $("#toast"),
      banner: $("#banner"),
      bannerTitle: $("#banner-title"),
      hearts: $("#hearts"),
      protein: $("#protein"),
      charges: $("#charges"),
      score: $("#score"),
      chapter: $("#chapter-label"),
      zone: $("#zone-name"),
      menu: $("#menu"),
      modal: $("#modal"),
      modalBody: $("#modal-body"),
      papFlash: $("#papacito-flash"),
      elon: $("#elon-canvas"),
      btnMusic: $("#btn-music"),
      btnSfx: $("#btn-sfx"),
      btnPause: $("#btn-pause"),
      papiBtn: $("#ctrl-papi"),
      talk: $("#talk"),
      talkWho: $("#talk-who"),
      talkLine: $("#talk-line"),
      talkNext: this.root.querySelector(".talk-next"),
      heat: $("#heat"),
      prompt: $("#prompt"),
      reticle: $("#lock-reticle"),
      song: $("#song"),
      songStaff: $("#song-staff"),
      songHint: $("#song-hint"),
      heroCredit: $("#hero-credit"),
      heroHud: $("#hud-hero"),
    };
    if (this.ui.heroCredit) this.ui.heroCredit.textContent = HERO_CREDIT;
    if (this.ui.heroHud) this.ui.heroHud.textContent = HERO_CREDIT;
    if (this.ui.talkNext) this.ui.talkNext.textContent = "K / ENTER / TAP";

    $("#btn-start").onclick = () => this.startFromTitle();
    $("#btn-how").onclick = () => this.showMenu("how");
    $("#btn-chapters").onclick = () => this.showMenu("chapters");
    $("#btn-protein").onclick = () => this.showMenu("protein");
    this.root.querySelectorAll("[data-back]").forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showMenu("main");
      };
    });
    this.ui.btnPause.onclick = () => this.togglePause();
    this.ui.btnMusic.onclick = () => {
      this.audio.unlock();
      this.ui.btnMusic.classList.toggle("off", !this.audio.toggleMusic());
    };
    this.ui.btnSfx.onclick = () => {
      this.audio.unlock();
      this.ui.btnSfx.classList.toggle("off", !this.audio.toggleSfx());
    };
    if (this.ui.talk) {
      this.ui.talk.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.advanceTalk();
      });
    }
    const skipOpen = this.root.querySelector("#cine-open-skip");
    const skipClose = this.root.querySelector("#cine-close-skip");
    if (skipOpen) skipOpen.onclick = () => this._endCine();
    if (skipClose) skipClose.onclick = () => this._endCine();

    const input = this.root.querySelector("#suno-upload");
    const label = this.root.querySelector("#suno-label");
    if (input) {
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        this.audio.unlock();
        this.audio.setCustomTrack(file);
        if (label) label.textContent = `♪ ${file.name.slice(0, 28)}`;
        this.toast("SUNO TRACK LOCKED IN. LET'S RIDE.");
      });
    }
  }

  showMenu(which) {
    this.menu = which;
    if (this.mode !== "title") return;
    this.ui.menu.classList.add("show");
    const card = this.ui.menu.querySelector(".menu-card");
    const panels = {
      main: card.querySelector("[data-panel=main]"),
      how: card.querySelector("[data-panel=how]"),
      chapters: card.querySelector("[data-panel=chapters]"),
      protein: card.querySelector("[data-panel=protein]"),
    };
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.hidden = key !== which;
      el.style.display = key === which ? "block" : "none";
    });
    if (which === "chapters") {
      const list = this.root.querySelector("#chapter-list");
      list.innerHTML = "";
      const btn = document.createElement("button");
      btn.innerHTML = `<b>M0–M3 3D SLICE</b><em>PLAY</em><span>Plaza · Song of the Scoop · Boulevard field · no D1</span>`;
      btn.onclick = () => this.startFromTitle();
      list.appendChild(btn);
    }
    if (which === "protein") {
      this.root.querySelector("#whey-count").textContent = this.save.whey;
      this.root.querySelector("#upgrade-list").innerHTML =
        "<button disabled><b>RESERVED</b><em>—</em><span>Protein tree waits on a later slice.</span></button>";
    }
    try {
      this.audio.ui();
    } catch {
      /* ignore */
    }
  }

  startFromTitle() {
    this.audio.unlock();
    this.playCine("open", () => this.startSlice());
  }

  playCine(kind, onDone) {
    const wrap = this.root.querySelector(kind === "open" ? "#cine-open" : "#cine-close");
    const vid = this.root.querySelector(kind === "open" ? "#vid-open" : "#vid-close");
    if (!wrap || !vid) {
      onDone();
      return;
    }
    this._cineDone = onDone;
    this.mode = "cine";
    this.ui.menu.classList.remove("show");
    this.closeModal();
    if (this.audio.stopMusic) this.audio.stopMusic();
    wrap.hidden = false;
    wrap.classList.add("show");
    vid.onended = () => this._endCine();
    try {
      vid.currentTime = 0;
    } catch {
      /* ignore */
    }
    const play = vid.play();
    if (play && play.catch) play.catch(() => {});
  }

  _endCine() {
    const open = this.root.querySelector("#cine-open");
    const close = this.root.querySelector("#cine-close");
    const vOpen = this.root.querySelector("#vid-open");
    const vClose = this.root.querySelector("#vid-close");
    [vOpen, vClose].forEach((v) => {
      if (!v) return;
      v.onended = null;
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    });
    [open, close].forEach((el) => {
      if (!el) return;
      el.classList.remove("show");
      el.hidden = true;
    });
    const done = this._cineDone;
    this._cineDone = null;
    if (done) done();
  }

  startSlice() {
    this.audio.unlock();
    this.audio.startMusic();
    this.ui.menu.classList.remove("show");
    this.closeModal();
    this.hideTalk();
    this.closeSong();
    this.score = 0;
    this.kills = 0;
    this.shakeN = 0;
    this.charges = 0;
    this.needScoop = false;
    this.fieldLooked = false;
    this.lockOn = false;
    this._clearProjectiles();
    this._resetPlayer(this.world.spawn);
    this._resetElon();
    if (this.save.fieldOpen) this._setGateOpen(true, true);
    else this._setGateOpen(false, true);
    this.mode = "playing";
    this.banner(PLAZA_NAME, 2.2);
    this.syncHUD();
  }

  _resetPlayer(spawn) {
    this.player = {
      x: spawn.x,
      y: 0,
      z: spawn.z,
      vy: 0,
      yaw: 0,
      hearts: 3,
      inv: 0,
      heat: 0,
      overheat: 0,
      grounded: true,
      moving: false,
      checkpoint: { x: LAYOUT.fountain.x, z: LAYOUT.fountain.z + 2.4 },
    };
    this.fireCooldown = 0;
    this.cam.yaw = 2.35;
    this.cam.pitch = 0.3;
    this.cam.dist = 7.4;
    this._syncHero();
  }

  _resetElon() {
    this.elon = {
      x: LAYOUT.elon.x,
      z: LAYOUT.elon.z,
      yaw: Math.PI,
      hp: 1,
      alive: true,
      announced: false,
      t: 0,
      laughT: 1.2,
      vx: 3.2,
      vz: 0,
    };
    this.elonActor.root.visible = true;
    this.elonActor.parts.lockMark.visible = false;
  }

  _syncHero() {
    this.hero.root.position.set(this.player.x, this.player.y, this.player.z);
    this.hero.root.rotation.y = this.player.yaw;
  }

  _setGateOpen(open, instant) {
    this.world.gate.collider.disabled = !!open;
    this.save.fieldOpen = !!open;
    if (instant) {
      this.world.gate.bars.position.y = open ? 4.2 : 0;
      this.gateOpenT = open ? 1 : 0;
    }
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame((nt) => this.loop(nt));
  }

  update(dt) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.ui.toast.classList.remove("show");
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.ui.banner.classList.remove("show");
    }
    if (this.world.gate.bars.position.y < 4.15 && this.save.fieldOpen) {
      this.world.gate.bars.position.y = Math.min(4.2, this.world.gate.bars.position.y + dt * 3.2);
    }

    if (this.mode === "title") {
      if (this.input.just("enter") && this.menu === "main") this.startFromTitle();
      this.cam.yaw += dt * 0.12;
      this._placeTitleCamera();
      this.hero.update(dt, { moving: false, grounded: true, lockOn: false });
      return;
    }
    if (this.mode === "cine") {
      if (this.input.just("escape") || this.input.just(" ") || this.input.just("enter") || this.input.just("k")) {
        this._endCine();
      }
      return;
    }
    if (this.mode === "papacito") {
      this.papacitoT -= dt;
      if (this.papacitoT <= 0) {
        this.ui.papFlash.classList.remove("show");
        this.mode = "playing";
        if (this.queuedTalk) {
          const q = this.queuedTalk;
          this.queuedTalk = null;
          this.startTalk(q);
        }
      }
      return;
    }
    if (this.mode === "talk") {
      if (this.input.talkAdvance()) this.advanceTalk();
      this._updateCamera(dt);
      return;
    }
    if (this.mode === "song") {
      this._updateSong(dt);
      this._updateCamera(dt);
      if (this.input.pauseDown()) this.closeSong();
      return;
    }
    if (this.mode === "paused") {
      if (this.input.pauseDown()) this.togglePause();
      return;
    }
    if (this.mode !== "playing") return;

    if (this.input.pauseDown()) {
      this.togglePause();
      return;
    }

    this._updatePapiHold(dt);
    if (this.mode !== "playing") return;

    const p = this.player;
    p.inv = Math.max(0, p.inv - dt);
    p.overheat = Math.max(0, p.overheat - dt);
    if (p.overheat <= 0) p.heat = Math.max(0, p.heat - dt * 0.38);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    this._steerCamera(dt);
    this._movePlayer(dt);
    this._jump(dt);
    this._combat(dt);
    this._updateElon(dt);
    this._updateProjectiles(dt);
    this._interactPrompts();
    this._maybeFieldLook();
    this._updateCamera(dt);
    this.hero.update(dt, { moving: p.moving, grounded: p.grounded, lockOn: this.lockOn });
    this.syncHUD();
  }

  _updatePapiHold(dt) {
    const held = this.input.papiHeld();
    if (held) {
      this.papiHoldT += dt;
      if (this.papiHoldT >= 0.4 && !this.papiOpened) {
        this.papiOpened = true;
        this.openSong();
      }
    } else {
      if (!this.papiOpened && this.papiHoldT > 0.05 && this.papiHoldT < 0.4) this.tryPapacitoTap();
      this.papiHoldT = 0;
      this.papiOpened = false;
    }
  }

  _steerCamera(dt) {
    const o = this.input.orbit();
    if (!this.lockOn) {
      this.cam.yaw -= o.yaw;
      this.cam.pitch = clamp(this.cam.pitch + o.pitch, 0.08, 0.92);
    }
    this.cam.dist = clamp(this.cam.dist + o.zoom, 4.2, 11);
    if (this.input.lockDown()) this.toggleLock();
  }

  toggleLock() {
    if (this.lockOn) {
      this.lockOn = false;
      if (this.elonActor) this.elonActor.parts.lockMark.visible = false;
      return;
    }
    if (!this.elon || !this.elon.alive || !this.save.fieldOpen) {
      this.toast("NO TARGET");
      return;
    }
    const d2 = (this.player.x - this.elon.x) ** 2 + (this.player.z - this.elon.z) ** 2;
    if (d2 > 28 * 28) {
      this.toast("TOO FAR TO LOCK");
      return;
    }
    this.lockOn = true;
    this.elonActor.parts.lockMark.visible = true;
  }

  _movePlayer(dt) {
    const axis = this.input.axis();
    const p = this.player;
    const lookX = -Math.sin(this.cam.yaw);
    const lookZ = -Math.cos(this.cam.yaw);
    const rightX = Math.cos(this.cam.yaw);
    const rightZ = -Math.sin(this.cam.yaw);
    let vx = lookX * -axis.z + rightX * axis.x;
    let vz = lookZ * -axis.z + rightZ * axis.x;
    const speed = this.lockOn ? 5.1 : 6.4;
    const mag = Math.hypot(vx, vz);
    p.moving = mag > 0.05;
    if (p.moving) {
      vx = (vx / mag) * speed;
      vz = (vz / mag) * speed;
      if (this.lockOn && this.elon && this.elon.alive) {
        p.yaw = Math.atan2(this.elon.x - p.x, this.elon.z - p.z);
      } else {
        p.yaw = Math.atan2(vx, vz);
      }
    } else if (this.lockOn && this.elon && this.elon.alive) {
      p.yaw = Math.atan2(this.elon.x - p.x, this.elon.z - p.z);
    }
    const nx = p.x + vx * dt;
    const nz = p.z + vz * dt;
    const resolved = resolveWorld(nx, nz, this.hero.radius, this.world.colliders, this.save.fieldOpen);
    p.x = resolved.x;
    p.z = resolved.z;
    this._syncHero();
  }

  _jump(dt) {
    const p = this.player;
    if (this.input.jumpDown() && p.grounded) {
      p.vy = 7.6;
      p.grounded = false;
      this.audio.jump();
    }
    p.vy -= 22 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
    this._syncHero();
  }

  _combat(dt) {
    if (this.needScoop) return;
    const p = this.player;
    if (this.input.fireHeld() && p.overheat <= 0) {
      if (this.fireCooldown <= 0) {
        this.shoot();
        this.fireCooldown = 0.2;
      }
    }
  }

  shoot() {
    const p = this.player;
    let dirX = Math.sin(p.yaw);
    let dirZ = Math.cos(p.yaw);
    if (this.lockOn && this.elon && this.elon.alive) {
      const dx = this.elon.x - p.x;
      const dz = this.elon.z - p.z;
      const m = Math.hypot(dx, dz) || 1;
      dirX = dx / m;
      dirZ = dz / m;
    }
    const mesh = makeEggplantMesh(1);
    const ox = p.x + dirX * 0.7;
    const oy = p.y + 1.15;
    const oz = p.z + dirZ * 0.7;
    mesh.position.set(ox, oy, oz);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      x: ox,
      y: oy,
      z: oz,
      vx: dirX * 16,
      vy: 5.8,
      vz: dirZ * 16,
      life: 1.45,
    });
    p.heat = Math.min(1, p.heat + 0.22);
    if (p.heat >= 1) {
      p.overheat = 1.15;
      p.heat = 0;
      this.toast("CANNON OVERHEATED — LET THE PRODUCE BREATHE");
    }
    this.audio.shoot(false);
  }

  _updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      pr.vy -= 18 * dt;
      pr.life -= dt;
      pr.mesh.position.set(pr.x, pr.y, pr.z);
      pr.mesh.rotation.z += dt * 10;
      if (pr.y < 0.12) {
        pr.life = 0;
      }
      if (this.elon && this.elon.alive && nearPoint(pr.x, pr.z, this.elon.x, this.elon.z, 0.7) && pr.y < 1.8) {
        this.killElon();
        pr.life = 0;
      }
      for (const s of this.world.colliders) {
        if (s.disabled || pr.life <= 0) continue;
        if (segmentHitsAABB(pr.x, pr.z, pr.x, pr.z, s, 0.18) && pr.y < 3.2) pr.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => {
      if (pr.life > 0) return true;
      this.scene.remove(pr.mesh);
      return false;
    });
  }

  _clearProjectiles() {
    for (const pr of this.projectiles) this.scene.remove(pr.mesh);
    this.projectiles = [];
  }

  _updateElon(dt) {
    const e = this.elon;
    if (!e || !e.alive) {
      if (this.elonActor) this.elonActor.parts.lockMark.visible = false;
      return;
    }
    e.t += dt;
    if (this.save.fieldOpen) {
      e.x += e.vx * dt;
      if (e.x < 34) {
        e.x = 34;
        e.vx = Math.abs(e.vx);
      } else if (e.x > 64) {
        e.x = 64;
        e.vx = -Math.abs(e.vx);
      }
      e.yaw = e.vx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    this.elonActor.root.position.set(e.x, 0, e.z);
    this.elonActor.root.rotation.y = e.yaw;
    const laughOn = e.laughT > 1.55;
    this.elonActor.update(dt, this.save.fieldOpen, laughOn);
    e.laughT -= dt;
    if (e.laughT <= 0 && this.mode === "playing") {
      this.audio.laugh();
      e.laughT = 2.15 + Math.random() * 0.35;
    }
    if (this.save.fieldOpen && !e.announced && zoneAt(this.player.x, this.player.z) === "field") {
      if (nearPoint(this.player.x, this.player.z, e.x, e.z, 22)) this.announceElon();
    }
    if (nearPoint(this.player.x, this.player.z, e.x, e.z, 0.85) && this.player.inv <= 0 && this.save.fieldOpen) {
      this.hurt();
    }
    if (this.lockOn) {
      const d2 = (this.player.x - e.x) ** 2 + (this.player.z - e.z) ** 2;
      if (d2 > 32 * 32) this.toggleLock();
    }
  }

  announceElon() {
    if (!this.elon || this.elon.announced) return;
    this.elon.announced = true;
    this.audio.laugh();
    this.elon.laughT = 2.4;
    this.startTalk(LINES.elonAppear);
  }

  killElon() {
    const e = this.elon;
    if (!e || !e.alive) return;
    e.alive = false;
    this.lockOn = false;
    this.elonActor.root.visible = false;
    this.elonActor.parts.lockMark.visible = false;
    this.kills++;
    this.score += 200;
    this.audio.hit();
    if (this.mode === "papacito") this.queuedTalk = LINES.elonDeath;
    else this.startTalk(LINES.elonDeath);
  }

  hurt() {
    const p = this.player;
    p.hearts -= 1;
    p.inv = 1.15;
    this.audio.hurt();
    this.syncHUD();
    if (p.hearts <= 0) this.die();
  }

  die() {
    this.audio.hurt();
    this.openModal(DEATH_TITLES[0], DEATH_TITLES[1], [
      [
        "RETRY CHECKPOINT",
        () => {
          this.closeModal();
          this.player.hearts = 3;
          this.player.x = this.player.checkpoint.x;
          this.player.z = this.player.checkpoint.z;
          this.player.y = 0;
          this.player.inv = 1.2;
          this.mode = "playing";
          this._syncHero();
          this.syncHUD();
        },
      ],
      ["TITLE", () => this.toTitle()],
    ]);
    this.mode = "paused";
  }

  _interactPrompts() {
    const p = this.player;
    let kind = null;
    let label = "";
    if (nearPoint(p.x, p.z, this.world.eve.x, this.world.eve.z, this.world.eve.r)) {
      kind = "eve";
      label = "K · TALK  SCOOP EVE";
    } else if (nearPoint(p.x, p.z, this.world.palaceDoor.x, this.world.palaceDoor.z, this.world.palaceDoor.r)) {
      kind = "eve";
      label = "K · TALK  SCOOP EVE";
    } else if (nearPoint(p.x, p.z, this.world.velvet.x, this.world.velvet.z, this.world.velvet.r)) {
      kind = "velvet";
      label = "K · LOOK  VELVET D1";
    } else if (this.save.fieldOpen && nearPoint(p.x, p.z, this.world.fountain.x, this.world.fountain.z, this.world.fountain.r)) {
      kind = "fountain";
      label = "K · SOFT-SAVE";
    } else if (!this.save.fieldOpen && nearPoint(p.x, p.z, LAYOUT.gate.x - 1.2, LAYOUT.gate.z, 2.6)) {
      kind = "gate";
      label = this.save.songLearned ? "HOLD PAPACITO · SONG" : "FIELD GATE  LOCKED";
    }
    this.promptKind = kind;
    if (this.needScoop) {
      label = "HOLD PAPACITO · SONG OF THE SCOOP";
    }
    if (this.ui.prompt) {
      this.ui.prompt.textContent = label;
      this.ui.prompt.classList.toggle("show", !!label);
    }
    if (this.input.interactDown()) this.tryInteract();
  }

  tryInteract() {
    if (this.mode !== "playing") return;
    const kind = this.promptKind;
    if (kind === "eve") this.talkToEve();
    else if (kind === "velvet") this.startTalk(LINES.velvetLock);
    else if (kind === "fountain") this.softSaveFountain(true);
    else if (kind === "gate" && !this.save.songLearned) this.toast("FIELD GATE LOCKED");
  }

  talkToEve() {
    if (this.save.palaceTalk && this.save.fieldOpen) {
      this.startTalk([LINES.eveAfterSong[1]]);
      return;
    }
    if (this.save.songLearned && !this.save.fieldOpen) {
      this.needScoop = true;
      this.toast("HOLD PAPACITO");
      return;
    }
    this.startTalk(LINES.eveTeach, () => {
      this.save.songLearned = true;
      writeSave(this.save);
      this.needScoop = true;
      this.toast("HOLD PAPACITO");
    });
  }

  _maybeFieldLook() {
    if (this.fieldLooked || this.needScoop || this.mode !== "playing") return;
    if (this.save.fieldOpen && zoneAt(this.player.x, this.player.z) === "field") return;
    const lookX = -Math.sin(this.cam.yaw);
    const nearGate = this.player.x > 6 && this.player.x < LAYOUT.gate.x + 0.5;
    if (nearGate && lookX > 0.42) {
      this.fieldLooked = true;
      this.startTalk(LINES.fieldLook);
    }
  }

  openSong() {
    if (this.mode !== "playing") return;
    this.mode = "song";
    this.song = { played: [], target: SONG_OF_THE_SCOOP };
    if (this.ui.song) {
      this.ui.song.hidden = false;
      this.ui.song.classList.add("show");
    }
    this._renderSong();
    this.audio.ui();
  }

  closeSong() {
    if (this.ui.song) {
      this.ui.song.classList.remove("show");
      this.ui.song.hidden = true;
    }
    this.song = null;
    if (this.mode === "song") this.mode = "playing";
  }

  _renderSong() {
    if (!this.ui.songStaff) return;
    const target = SONG_OF_THE_SCOOP.notes;
    const played = (this.song && this.song.played) || [];
    this.ui.songStaff.innerHTML = target
      .map((n, i) => {
        const cls = i < played.length ? "hit" : i === played.length ? "next" : "";
        return `<i class="${cls}">${NOTE_GLYPH[n]}</i>`;
      })
      .join("");
    if (this.ui.songHint) {
      this.ui.songHint.textContent = this.save.songLearned
        ? "WASD / arrows play notes. Esc cancels."
        : "NO SONGS LEARNED — talk to Scoop Eve.";
    }
  }

  _updateSong() {
    if (!this.save.songLearned) {
      this._renderSong();
      return;
    }
    const note = this.input.noteJust();
    if (!note) return;
    this.audio.songNote(NOTE_FREQ[note]);
    const r = feedNote(this.song.played, SONG_OF_THE_SCOOP.notes, note);
    this.song.played = r.played;
    this._renderSong();
    if (r.reset) this.audio.songFail();
    if (r.complete) this._finishScoop();
  }

  _finishScoop() {
    this.audio.songOk();
    this.closeSong();
    const firstTime = this.needScoop || !this.save.palaceTalk;
    this.needScoop = false;
    this._setGateOpen(true, false);
    this.softSaveFountain(false);
    this.save.palaceTalk = true;
    this.save.songLearned = true;
    this.save.fieldOpen = true;
    writeSave(this.save);
    if (firstTime) this.startTalk(LINES.eveAfterSong, () => this.banner(FIELD_NAME, 2));
    else this.toast(CHECKPOINT_TOAST);
  }

  softSaveFountain(toastOn) {
    this.player.checkpoint = { x: LAYOUT.fountain.x, z: LAYOUT.fountain.z + 2.4 };
    this.player.hearts = 3;
    this.audio.checkpoint();
    writeSave(this.save);
    if (toastOn) this.toast(CHECKPOINT_TOAST);
    this.syncHUD();
  }

  tryPapacitoTap() {
    if (this.mode !== "playing") return;
    if (this.charges <= 0) {
      this.toast("NEED 3 PROTEIN SHAKES FIRST, PAPI");
      return;
    }
    this.charges--;
    this.mode = "papacito";
    this.papacitoT = 1.85;
    this.ui.papFlash.classList.add("show");
    this.audio.papacito();
    this.toast("PAPACITO PROTOCOL");
    this.banner("PAPACITO", 1.5);
    if (this.elon && this.elon.alive) this.killElon();
    this.syncHUD();
  }

  startTalk(lines, onDone) {
    this.talk = { lines, i: 0, onDone };
    this.mode = "talk";
    this._renderTalk();
  }

  _renderTalk() {
    if (!this.talk || !this.ui.talk) return;
    const line = this.talk.lines[this.talk.i];
    this.ui.talkWho.textContent = line.who;
    this.ui.talkLine.textContent = line.text;
    this.ui.talk.hidden = false;
    this.ui.talk.classList.add("show");
    this.audio.ui();
  }

  hideTalk() {
    this.talk = null;
    if (!this.ui.talk) return;
    this.ui.talk.classList.remove("show");
    this.ui.talk.hidden = true;
  }

  advanceTalk() {
    if (!this.talk) return;
    this.talk.i++;
    if (this.talk.i >= this.talk.lines.length) {
      const done = this.talk.onDone;
      this.hideTalk();
      this.mode = "playing";
      if (done) done();
      return;
    }
    this._renderTalk();
  }

  togglePause() {
    if (this.mode === "cine" || this.mode === "talk" || this.mode === "song") return;
    if (this.mode === "playing") {
      this.mode = "paused";
      this.openModal("PAUSED", "Hold Papacito for Song of the Scoop. Tap is the nuke — later.", [
        ["RESUME", () => ((this.mode = "playing"), this.closeModal())],
        ["HOW TO PLAY", () => this.openHowModal()],
        ["TITLE", () => this.toTitle()],
      ]);
    } else if (this.mode === "paused") {
      this.mode = "playing";
      this.closeModal();
    }
  }

  openHowModal() {
    this.openModal(
      "HOW TO WAKE BDB",
      "WASD camera-relative move · Q/E or mouse orbit · Space jump\nShift/F lock-on · J/Ctrl Street Produce · K/E talk\nP/Enter Papacito: HOLD song · TAP protocol\nEsc pause. No sword.",
      [["BACK", () => this.togglePause()]]
    );
  }

  openModal(title, body, actions) {
    const m = this.ui.modal;
    const card = this.ui.modalBody;
    card.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = title;
    h.style.color = "var(--gold)";
    h.style.fontFamily = "var(--font-display)";
    h.style.margin = "0 0 8px";
    const p = document.createElement("p");
    p.textContent = body;
    p.style.color = "var(--muted)";
    p.style.fontSize = "12px";
    p.style.whiteSpace = "pre-wrap";
    card.append(h, p);
    const row = document.createElement("div");
    row.className = "btn-row";
    row.style.marginTop = "12px";
    actions.forEach(([label, fn], i) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (i === 0) b.className = "primary";
      b.onclick = fn;
      row.appendChild(b);
    });
    card.appendChild(row);
    m.classList.add("show");
  }

  closeModal() {
    this.ui.modal.classList.remove("show");
  }

  toTitle() {
    this.mode = "title";
    this.closeModal();
    this.hideTalk();
    this.closeSong();
    this.needScoop = false;
    this.ui.papFlash.classList.remove("show");
    this._resetPlayer(this.world.spawn);
    this.showMenu("main");
    this.syncHUD();
  }

  toast(msg) {
    this.toastT = 1.8;
    this.ui.toast.textContent = msg;
    this.ui.toast.classList.add("show");
  }

  banner(msg, t = 2) {
    this.bannerT = t;
    this.ui.bannerTitle.textContent = msg;
    this.ui.banner.classList.add("show");
  }

  _placeTitleCamera() {
    const t = this.world.fountain;
    const d = 11;
    this.camera.position.set(t.x + Math.sin(this.cam.yaw) * d, 4.8, t.z + Math.cos(this.cam.yaw) * d);
    this.camera.lookAt(t.x, 1.4, t.z);
  }

  _updateCamera() {
    const p = this.player;
    const head = new THREE.Vector3(p.x, p.y + 1.35, p.z);
    if (this.lockOn && this.elon && this.elon.alive) {
      const dx = this.elon.x - p.x;
      const dz = this.elon.z - p.z;
      this.cam.yaw = Math.atan2(-dx, -dz);
      this.cam.pitch = 0.22;
    }
    const dist = this.cam.dist;
    const cp = Math.cos(this.cam.pitch);
    const ox = Math.sin(this.cam.yaw) * dist * cp;
    const oy = Math.sin(this.cam.pitch) * dist + 0.35;
    const oz = Math.cos(this.cam.yaw) * dist * cp;
    this.camera.position.set(head.x + ox, head.y + oy, head.z + oz);
    const look = head.clone();
    if (this.lockOn && this.elon && this.elon.alive) {
      look.lerp(new THREE.Vector3(this.elon.x, 1.2, this.elon.z), 0.22);
    }
    this.camera.lookAt(look);
    this._placeReticle();
  }

  _placeReticle() {
    const el = this.ui.reticle;
    if (!el) return;
    const on = this.lockOn && this.elon && this.elon.alive;
    el.classList.toggle("show", on);
    if (!on) return;
    const v = new THREE.Vector3(this.elon.x, 1.6, this.elon.z).project(this.camera);
    const x = (v.x * 0.5 + 0.5) * 100;
    const y = (-v.y * 0.5 + 0.5) * 100;
    el.style.left = x + "%";
    el.style.top = y + "%";
  }

  syncHUD() {
    if (!this.ui.hearts) return;
    this.ui.hearts.innerHTML = [0, 1, 2]
      .map((i) => `<span class="${i < this.player.hearts ? "on" : ""}">♥</span>`)
      .join("");
    this.ui.protein.innerHTML = [0, 1, 2].map((i) => `<i class="${i < this.shakeN ? "full" : ""}"></i>`).join("");
    this.ui.charges.innerHTML = [0, 1].map((i) => `<i class="${i < this.charges ? "full" : ""}">P</i>`).join("");
    this.ui.score.textContent = String(this.score).padStart(6, "0");
    this.ui.chapter.textContent = "CH I";
    if (this.ui.heroHud) this.ui.heroHud.textContent = HERO_CREDIT;
    const z = zoneAt(this.player.x, this.player.z);
    this.ui.zone.textContent = z === "field" ? FIELD_NAME : z === "plaza" ? PLAZA_NAME : ZONE_NAME;
    if (this.ui.papiBtn) {
      this.ui.papiBtn.classList.toggle("ready", this.save.songLearned || this.needScoop);
      this.ui.papiBtn.disabled = false;
    }
    if (this.ui.heat) {
      const pct = Math.round((this.player.overheat > 0 ? 1 : this.player.heat) * 100);
      this.ui.heat.style.setProperty("--heat", pct + "%");
      this.ui.heat.classList.toggle("hot", this.player.overheat > 0);
    }
  }

  draw() {
    this.renderer.render(this.scene, this.camera);
  }
}
