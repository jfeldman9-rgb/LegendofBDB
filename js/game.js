import { AudioBus } from "./audio.js";
import { loadSheet } from "./sprites.js";
import {
  W,
  H,
  ZONE_NAME,
  DEATH_TITLES,
  CHECKPOINT_TOAST,
  LINES,
  aabb,
  clamp,
  hitZone,
  buildScreen,
  makeElon,
  defaultSave,
} from "./world.js";

const SAVE_KEY = "bdb-awakening-zelda-m0m3-v1";

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

const QUIPS = {
  hurt: ["NOT THE TUX!", "EGO BRUISED.", "PRODUCE MALFUNCTION.", "PAPI DOWN — TEMPORARILY."],
  shake: ["ONE SCOOP.", "HE'S GLOWING.", "ILLEGAL GAINS.", "CHUG RESPONSIBLY."],
  papiReady: ["PAPACITO ONLINE.", "THE BUTTON THIRSTS.", "NUKE THE HALOS."],
};

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

const FACE = {
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
};

export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector("#game");
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.audio = new AudioBus();
    this.sheet = { ready: false };
    this.save = loadSave();
    this.mode = "title";
    this.menu = "main";
    this.keys = Object.create(null);
    this.touch = { left: false, right: false, up: false, down: false, fire: false, papi: false };
    this.gamepad = { left: false, right: false, up: false, down: false, fire: false, papi: false };
    this.fireHeld = 0;
    this.toastT = 0;
    this.bannerT = 0;
    this.papacitoT = 0;
    this.usingTouch = false;
    this.bootstrapped = false;
    this.talk = null;
    this.typewriter = { text: "", target: "", index: 0, speed: 45, timer: 0 };
    this.scroll = null;
    this.recoil = 0;
    this.muzzleFlash = 0;
    this.splats = [];
    this.projectiles = [];
    this.particles = [];
    this.score = 0;
    this.kills = 0;
    this.shakesGot = 0;
    this.shakeN = 0;
    this.charges = 0;
    this.elon = null;
    this.queuedTalk = null;
    this.doorLineReady = true;
    this.palaceTalkQueued = false;
    this.screen = buildScreen("hub", this.save);
    this._bindUI();
    this._bindInput();
    this._bindMusicUpload();
    this._resetPlayer(this.screen.spawn);
    this.last = performance.now();
    this._detectTouch();
    this._orientation();
    loadSheet().then((sheet) => {
      this.sheet = sheet;
      this._paintElon();
      if (!this.bootstrapped) {
        this.bootstrapped = true;
        requestAnimationFrame((t) => this.loop(t));
      }
    });
    requestAnimationFrame((t) => {
      if (!this.bootstrapped) {
        this.bootstrapped = true;
        this.loop(t);
      }
    });
  }

  _paintElon() {
    const el = this.ui.elon;
    if (!el) return;
    const c = el.getContext("2d");
    c.imageSmoothingEnabled = true;
    c.clearRect(0, 0, el.width, el.height);
    if (this.sheet.elon) c.drawImage(this.sheet.elon, 0, 0, el.width, el.height);
  }

  _bindMusicUpload() {
    const input = this.root.querySelector("#suno-upload");
    const label = this.root.querySelector("#suno-label");
    if (!input) return;
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      this.audio.unlock();
      this.audio.setCustomTrack(file);
      if (label) label.textContent = `♪ ${file.name.slice(0, 28)}`;
      this.toast("SUNO TRACK LOCKED IN. LET'S RIDE.");
    });
  }

  _detectTouch() {
    const on = () => {
      this.usingTouch = true;
      document.body.classList.add("touch-on");
    };
    window.addEventListener("touchstart", on, { once: true, passive: true });
    if (matchMedia("(pointer: coarse)").matches) on();
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
      talkPortrait: $("#talk-portrait"),
      talkWho: $("#talk-who"),
      talkLine: $("#talk-line"),
      heat: $("#heat"),
    };

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

    const hold = (el, key) => {
      if (!el) return;
      const set = (v) => (e) => {
        e.preventDefault();
        this.usingTouch = true;
        document.body.classList.add("touch-on");
        this.touch[key] = v;
        if (key === "papi" && v) this.papiPressed = true;
        if (key === "fire") this.touch.fire = v;
      };
      el.addEventListener("pointerdown", set(true));
      el.addEventListener("pointerup", set(false));
      el.addEventListener("pointercancel", set(false));
      el.addEventListener("pointerleave", set(false));
    };
    hold($("#ctrl-left"), "left");
    hold($("#ctrl-right"), "right");
    hold($("#ctrl-up"), "up");
    hold($("#ctrl-down"), "down");
    hold($("#ctrl-fire"), "fire");
    hold($("#ctrl-papi"), "papi");

    if (this.ui.talk) {
      this.ui.talk.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.advanceTalk();
      });
    }

    this.showMenu("main");
    this._bindCine();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (
        [
          "arrowleft",
          "arrowright",
          "arrowup",
          "arrowdown",
          " ",
          "a",
          "d",
          "w",
          "s",
          "j",
          "k",
          "p",
          "escape",
          "enter",
        ].includes(k)
      )
        e.preventDefault();
      this.keys[k] = true;
      if (k === "k") this.papiPressed = true;
      if (k === "p" || k === "escape") {
        if (this.mode === "talk") this.advanceTalk();
        else if (this.mode === "title" && this.menu !== "main") this.showMenu("main");
        else this.togglePause();
      }
      if (k === "enter" && this.mode === "title") this.startFromTitle();
      if ((k === "enter" || k === " ") && this.mode === "talk") this.advanceTalk();
      if ((k === "enter" || k === " " || k === "escape") && this.mode === "cine") this._endCine();
      this.audio.unlock();
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener("blur", () => {
      this.keys = Object.create(null);
      Object.keys(this.touch).forEach((k) => (this.touch[k] = false));
    });
  }

  _pollGamepad() {
    if (!navigator.getGamepads) return;
    const gps = navigator.getGamepads();
    const gp = gps && gps[0];
    if (!gp) return;

    const dead = 0.25;
    const ax0 = gp.axes[0] || 0;
    const ax1 = gp.axes[1] || 0;
    
    this.gamepad.left = ax0 < -dead || (gp.buttons[14] && gp.buttons[14].pressed);
    this.gamepad.right = ax0 > dead || (gp.buttons[15] && gp.buttons[15].pressed);
    this.gamepad.up = ax1 < -dead || (gp.buttons[12] && gp.buttons[12].pressed);
    this.gamepad.down = ax1 > dead || (gp.buttons[13] && gp.buttons[13].pressed);

    const btnFire = (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[5] && gp.buttons[5].pressed);
    const btnPapi = (gp.buttons[1] && gp.buttons[1].pressed) || (gp.buttons[3] && gp.buttons[3].pressed) || (gp.buttons[4] && gp.buttons[4].pressed);
    const btnPause = gp.buttons[9] && gp.buttons[9].pressed;

    if (btnFire && !this.gamepad.fire) {
      if (this.mode === "talk") this.advanceTalk();
    }
    if (btnPapi && !this.gamepad.papi) {
      this.papiPressed = true;
    }
    if (btnPause && !this.gamepad.pause) {
      this.togglePause();
    }

    this.gamepad.fire = !!btnFire;
    this.gamepad.papi = !!btnPapi;
    this.gamepad.pause = !!btnPause;
  }

  showMenu(which) {
    this.menu = which;
    const menu = this.ui.menu;
    if (this.mode !== "title") return;
    menu.classList.add("show");
    const card = menu.querySelector(".menu-card");
    const panels = {
      main: card.querySelector("[data-panel=main]"),
      how: card.querySelector("[data-panel=how]"),
      chapters: card.querySelector("[data-panel=chapters]"),
      protein: card.querySelector("[data-panel=protein]"),
    };
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      const on = key === which;
      el.hidden = !on;
      el.style.display = on ? "block" : "none";
    });
    if (which === "chapters") this._renderChapters();
    if (which === "protein") this._renderUpgrades();
    try {
      this.audio.ui();
    } catch (_) {}
  }

  _renderChapters() {
    const list = this.root.querySelector("#chapter-list");
    list.innerHTML = "";
    const btn = document.createElement("button");
    btn.innerHTML = `<b>M0–M3 SLICE</b><em>PLAY</em><span>${ZONE_NAME} — B-HUB / B-EAST / Palace talk</span>`;
    btn.onclick = () => this.startSlice(false);
    list.appendChild(btn);
  }

  _renderUpgrades() {
    const list = this.root.querySelector("#upgrade-list");
    const whey = this.root.querySelector("#whey-count");
    whey.textContent = this.save.whey;
    const items = [
      { key: "extraDash", name: "DOUBLE DASH", desc: "Reserved for a later slice", cost: 4 },
      { key: "ricochet", name: "RICOCHET PRODUCE", desc: "Eggplants bounce once", cost: 4 },
      { key: "shakeHeal", name: "RECOVERY SHAKE", desc: "Shakes can restore a heart", cost: 4 },
    ];
    list.innerHTML = "";
    items.forEach((it) => {
      const owned = this.save.upgrades[it.key];
      const btn = document.createElement("button");
      btn.disabled = owned || this.save.whey < it.cost;
      btn.innerHTML = `<b>${it.name}</b><em>${owned ? "OWNED" : it.cost + " WHEY"}</em><span>${it.desc}</span>`;
      btn.onclick = () => {
        if (owned || this.save.whey < it.cost) return;
        this.save.whey -= it.cost;
        this.save.upgrades[it.key] = true;
        writeSave(this.save);
        this.audio.pickup();
        this._renderUpgrades();
      };
      list.appendChild(btn);
    });
  }

  _bindCine() {
    const skipOpen = this.root.querySelector("#cine-open-skip");
    const skipClose = this.root.querySelector("#cine-close-skip");
    if (skipOpen) skipOpen.onclick = () => this._endCine();
    if (skipClose) skipClose.onclick = () => this._endCine();
  }

  startFromTitle() {
    this.audio.unlock();
    this.playCine("open", () => this.startSlice(true));
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
    const finish = () => this._endCine();
    vid.onended = finish;
    try {
      vid.currentTime = 0;
    } catch {}
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
      } catch {}
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
    this.ui.modal.classList.remove("show");
    this.hideTalk();
    this.score = 0;
    this.kills = 0;
    this.shakesGot = 0;
    this.shakeN = 0;
    this.charges = 0;
    this.elapsed = 0;
    this.splats = [];
    this.projectiles = [];
    this.particles = [];
    this.papacitoT = 0;
    this.scroll = null;
    this.enterScreen("hub", null, true);
    this.mode = "playing";
    this.banner(this.screen.banner, 2.2);
    this.syncHUD();
  }

  _resetPlayer(spawn) {
    this.player = {
      x: spawn.x,
      y: spawn.y,
      w: 42,
      h: 52,
      vx: 0,
      vy: 0,
      facing: "e",
      hearts: 3,
      inv: 0,
      heat: 0,
      overheat: 0,
      anim: 0,
      footstepT: 0,
      checkpoint: { screen: "hub", x: spawn.x, y: spawn.y },
    };
    this.fireCooldown = 0;
    this.fireHeld = 0;
  }

  enterScreen(id, spawn, fresh = false) {
    const prev = this.screen && this.screen.id;
    this.screen = buildScreen(id, this.save);
    if (fresh) this._resetPlayer(spawn || this.screen.spawn);
    else {
      const sp = spawn || this.screen.spawn;
      this.player.x = sp.x;
      this.player.y = sp.y;
      this.player.vx = 0;
      this.player.vy = 0;
    }
    this.projectiles = [];
    this.splats = [];
    this.doorLineReady = true;
    this.palaceTalkQueued = false;
    if (id === "east") {
      this.elon = makeElon(this.screen);
    } else {
      this.elon = null;
    }
    if (id === "palace" && !this.save.palaceTalk) {
      this.palaceTalkQueued = true;
    }
    if (prev && prev !== id) this.banner(this.screen.banner, 1.6);
    this.syncHUD();
  }

  requestScreen(id, spawn, dir = "fade") {
    if (this.scroll) return;

    if (dir === "e" || dir === "w") {
      this.audio.whoosh();
      const fromScreen = this.screen;
      const toScreen = buildScreen(id, this.save);
      const startX = this.player.x;
      const startY = this.player.y;
      const targetX = spawn ? spawn.x : toScreen.spawn.x;
      const targetY = spawn ? spawn.y : toScreen.spawn.y;

      this.scroll = {
        dir,
        progress: 0,
        fromScreen,
        toScreen,
        targetId: id,
        targetSpawn: { x: targetX, y: targetY },
        fromX: startX,
        fromY: startY,
      };
    } else {
      // Interior door transition or fallback
      this.audio.whoosh();
      this.scroll = {
        dir: "iris",
        progress: 0,
        targetId: id,
        targetSpawn: spawn,
      };
    }
  }

  togglePause() {
    if (this.mode === "cine" || this.mode === "talk") return;
    if (this.mode === "playing") {
      this.mode = "paused";
      this.openModal("PAUSED", "The boulevard is holding its breath.", [
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
      "Move WASD / arrows / Gamepad · Fire J, SPACE or A (Street Produce) · Papacito K\nTalk: SPACE / ENTER / A button / tap. Overheats if mashed. No sword.",
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
    this.ui.papFlash.classList.remove("show");
    this.enterScreen("hub", null, true);
    this.showMenu("main");
    this.syncHUD();
  }

  toast(msg) {
    this.toastMsg = msg;
    this.toastT = 1.7;
    this.ui.toast.textContent = msg;
    this.ui.toast.classList.add("show");
  }

  banner(msg, t = 2) {
    this.bannerMsg = msg;
    this.bannerT = t;
    this.ui.bannerTitle.textContent = msg;
    this.ui.banner.classList.add("show");
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
    
    // Typewriter state
    this.typewriter.target = line.text;
    this.typewriter.text = "";
    this.typewriter.index = 0;
    this.typewriter.timer = 0;
    this.ui.talkLine.textContent = "";

    // Render avatar portrait
    if (this.ui.talkPortrait) {
      const pctx = this.ui.talkPortrait.getContext("2d");
      pctx.clearRect(0, 0, 84, 84);
      const portrait = this.sheet.portraits && this.sheet.portraits[line.who];
      if (portrait) {
        pctx.drawImage(portrait, 0, 0, 84, 84);
      }
    }

    this.ui.talk.hidden = false;
    this.ui.talk.classList.add("show");
    this.audio.chatter(line.who);
  }

  hideTalk() {
    this.talk = null;
    if (!this.ui.talk) return;
    this.ui.talk.classList.remove("show");
    this.ui.talk.hidden = true;
  }

  advanceTalk() {
    if (!this.talk) return;
    // If still typing, finish the current line immediately
    if (this.typewriter.text.length < this.typewriter.target.length) {
      this.typewriter.text = this.typewriter.target;
      this.ui.talkLine.textContent = this.typewriter.target;
      return;
    }

    this.talk.i++;
    if (this.talk.i >= this.talk.lines.length) {
      const done = this.talk.onDone;
      this.hideTalk();
      this.keys[" "] = false;
      this.keys.j = false;
      this.touch.fire = false;
      this.mode = "playing";
      if (done) done();
      return;
    }
    this._renderTalk();
  }

  syncHUD() {
    const hearts = this.ui.hearts;
    hearts.innerHTML = [0, 1, 2].map((i) => `<span class="${i < this.player.hearts ? "on" : ""}">♥</span>`).join("");
    const prot = this.ui.protein;
    prot.innerHTML = [0, 1, 2].map((i) => `<i class="${i < this.shakeN ? "full" : ""}"></i>`).join("");
    const ch = this.ui.charges;
    ch.innerHTML = [0, 1].map((i) => `<i class="${i < this.charges ? "full" : ""}">P</i>`).join("");
    this.ui.score.textContent = String(this.score).padStart(6, "0");
    this.ui.chapter.textContent = "CH I";
    this.ui.zone.textContent = ZONE_NAME;
    this.ui.papiBtn.classList.toggle("ready", this.charges > 0 && this.mode === "playing");
    this.ui.papiBtn.disabled = this.charges <= 0;
    if (this.ui.heat) {
      const pct = Math.round((this.player.overheat > 0 ? 1 : this.player.heat) * 100);
      this.ui.heat.style.setProperty("--heat", pct + "%");
      this.ui.heat.classList.toggle("hot", this.player.overheat > 0);
    }
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this._pollGamepad();
    this.update(dt);
    this.draw();
    requestAnimationFrame((nt) => this.loop(nt));
  }

  left() {
    return this.keys.a || this.keys.arrowleft || this.touch.left || this.gamepad.left;
  }
  right() {
    return this.keys.d || this.keys.arrowright || this.touch.right || this.gamepad.right;
  }
  up() {
    return this.keys.w || this.keys.arrowup || this.touch.up || this.gamepad.up;
  }
  down() {
    return this.keys.s || this.keys.arrowdown || this.touch.down || this.gamepad.down;
  }
  firing() {
    return this.keys.j || this.keys[" "] || this.touch.fire || this.gamepad.fire;
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

    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 10);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 8);

    // Screen Scroll Transition (ALttP Zelda Style)
    if (this.scroll) {
      this.scroll.progress += dt * 2.5; // ~0.4s duration
      if (this.scroll.progress >= 1) {
        const sc = this.scroll;
        this.scroll = null;
        this.enterScreen(sc.targetId, sc.targetSpawn);
        if (this.palaceTalkQueued && this.mode === "playing") {
          this.palaceTalkQueued = false;
          this.startTalk(LINES.eve, () => this.finishPalaceTalk());
        } else if (this.elon && this.elon.alive && !this.elon.announced && this.mode === "playing") {
          this.announceElon();
        }
      }
      this.updateParticles(dt);
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
      this.updateParticles(dt);
      return;
    }

    if (this.mode === "talk") {
      if (this.talk && this.typewriter.text.length < this.typewriter.target.length) {
        this.typewriter.timer += dt * 1000;
        if (this.typewriter.timer >= this.typewriter.speed) {
          this.typewriter.timer = 0;
          this.typewriter.index++;
          this.typewriter.text = this.typewriter.target.slice(0, this.typewriter.index);
          this.ui.talkLine.textContent = this.typewriter.text;
          if (this.typewriter.index % 2 === 0) {
            this.audio.chatter(this.talk.lines[this.talk.i].who);
          }
        }
      }
      this.updateParticles(dt);
      return;
    }

    if (this.mode !== "playing") {
      this.papiPressed = false;
      return;
    }

    this.elapsed += dt;
    const p = this.player;
    p.anim += dt;
    p.inv = Math.max(0, p.inv - dt);
    
    // Gun cooling
    p.overheat = Math.max(0, p.overheat - dt);
    if (p.overheat <= 0) p.heat = Math.max(0, p.heat - dt * 0.4);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // Steam particles when warm
    if (p.heat > 0.4 && Math.random() < 0.25) {
      const dir = FACE[p.facing];
      this.particles.push({
        x: p.x + p.w / 2 + dir.x * 20,
        y: p.y + p.h * 0.45 + dir.y * 10,
        vx: (Math.random() - 0.5) * 15,
        vy: -25 - Math.random() * 20,
        life: 0.35,
        max: 0.35,
        color: p.overheat > 0 ? "rgba(255, 90, 60, 0.7)" : "rgba(210, 150, 255, 0.5)",
        size: 3,
        text: null,
      });
    }

    let ax = 0;
    let ay = 0;
    if (this.left()) ax -= 1;
    if (this.right()) ax += 1;
    if (this.up()) ay -= 1;
    if (this.down()) ay += 1;
    if (ax && ay) {
      ax *= Math.SQRT1_2;
      ay *= Math.SQRT1_2;
    }
    const speed = 175;
    p.vx = ax * speed;
    p.vy = ay * speed;
    if (ax || ay) {
      if (Math.abs(ax) > Math.abs(ay)) p.facing = ax > 0 ? "e" : "w";
      else p.facing = ay > 0 ? "s" : "n";
      
      // Footstep dust
      p.footstepT += dt;
      if (p.footstepT > 0.18) {
        p.footstepT = 0;
        this.burst(p.x + p.w / 2, p.y + p.h - 2, "rgba(255, 230, 180, 0.3)", 2);
      }
    }

    this._moveCollide(p, dt);

    if (this.firing() && p.overheat <= 0) {
      this.fireHeld += dt;
      if (this.fireCooldown <= 0) {
        this.shoot();
        this.fireCooldown = 0.22;
      }
    } else {
      this.fireHeld = 0;
    }

    if (this.papiPressed) this.tryPapacito();
    this.papiPressed = false;

    this._pickups(dt);
    this._updateElon(dt);
    this._updateProjectiles(dt);
    this._updateSplats(dt);
    this._checkExits();
    this._checkDoor();

    if (this.palaceTalkQueued) {
      this.palaceTalkQueued = false;
      this.startTalk(LINES.eve, () => this.finishPalaceTalk());
    } else if (this.elon && this.elon.alive && !this.elon.announced) {
      this.announceElon();
    }

    this.updateParticles(dt);
    this.syncHUD();
  }

  _moveCollide(ent, dt) {
    const solids = this._solids();
    ent.x += ent.vx * dt;
    for (const s of solids) {
      if (!aabb(ent, s)) continue;
      if (ent.vx > 0) ent.x = s.x - ent.w;
      else if (ent.vx < 0) ent.x = s.x + s.w;
    }
    ent.y += ent.vy * dt;
    for (const s of solids) {
      if (!aabb(ent, s)) continue;
      if (ent.vy > 0) ent.y = s.y - ent.h;
      else if (ent.vy < 0) ent.y = s.y + s.h;
    }
    const b = this.screen.bounds;
    ent.x = clamp(ent.x, b.x, b.x + b.w - ent.w);
    ent.y = clamp(ent.y, b.y, b.y + b.h - ent.h);
  }

  _solids() {
    const list = this.screen.solids.slice();
    const door = this.screen.door;
    if (door && !door.unlocked) list.push({ x: door.x, y: door.y, w: door.w, h: door.h, kind: "velvet" });
    return list;
  }

  _checkExits() {
    const hit = hitZone(this.player, this.screen.exits);
    if (!hit) return;
    const spawn = { ...hit.spawn };
    if (hit.to === "east" || hit.to === "hub") spawn.y = clamp(this.player.y, 270, 430);
    this.requestScreen(hit.to, spawn, hit.dir || "fade");
  }

  _checkDoor() {
    const door = this.screen.door;
    if (!door) return;
    const near = aabb(this.player, { x: door.x - 10, y: door.y, w: door.w + 16, h: door.h });
    if (!near) return;
    if (!door.unlocked && this.doorLineReady) {
      this.doorLineReady = false;
      this.startTalk(LINES.velvetLock);
    }
  }

  finishPalaceTalk() {
    this.save.palaceTalk = true;
    this.save.doorUnlocked = true;
    writeSave(this.save);
    this.player.checkpoint = { screen: "hub", x: 176, y: 300 };
    this.player.hearts = 3;
    this.audio.secret();
    this.toast(CHECKPOINT_TOAST);
    this.syncHUD();
  }

  announceElon() {
    if (!this.elon || this.elon.announced) return;
    this.elon.announced = true;
    this.audio.laugh();
    this.elon.laughT = 2.4;
    this.startTalk(LINES.elonAppear);
  }

  _updateElon(dt) {
    const e = this.elon;
    if (!e || !e.alive) return;
    e.t += dt;
    e.laughT -= dt;
    if (e.laughT <= 0 && this.mode === "playing") {
      this.audio.laugh();
      e.laughT = 2.15 + Math.random() * 0.4;
      this.floatText(e.x + e.w / 2, e.y - 8, "HA! HA!");
    }
    e.x += e.vx * dt;
    if (e.x < e.minX) {
      e.x = e.minX;
      e.vx = Math.abs(e.vx);
    } else if (e.x > e.maxX) {
      e.x = e.maxX;
      e.vx = -Math.abs(e.vx);
    }
    e.facing = e.vx >= 0 ? 1 : -1;
    e.y = e.homeY + Math.sin(e.t * 6) * 3;

    // Scooter spark trail
    if (Math.random() < 0.35) {
      this.particles.push({
        x: e.facing > 0 ? e.x : e.x + e.w,
        y: e.y + e.h - 4,
        vx: -e.facing * (40 + Math.random() * 30),
        vy: -10 - Math.random() * 20,
        life: 0.25,
        max: 0.25,
        color: Math.random() < 0.5 ? "#7ec8f0" : "#ffaa40",
        size: 2.5,
        text: null,
      });
    }

    if (aabb(this.player, e) && this.player.inv <= 0) this.hurt();
  }

  _pickups(dt) {
    const p = this.player;
    for (const s of this.screen.shakes) {
      if (s.taken) continue;
      s.bob += dt * 3;
      const box = { x: s.x, y: s.y + Math.sin(s.bob) * 3, w: s.w, h: s.h };
      if (!aabb(p, box)) continue;
      s.taken = true;
      this.shakesGot++;
      this.shakeN++;
      this.score += 250;
      this.save.whey++;
      writeSave(this.save);
      if (this.save.upgrades.shakeHeal) p.hearts = Math.min(3, p.hearts + 1);
      this.audio.pickup();
      this.burst(s.x + 6, s.y + 8, "#7ef0c8", 14);
      if (this.shakeN >= 3) {
        this.shakeN = 0;
        this.charges = Math.min(2, this.charges + 1);
        this.toast(pick(QUIPS.papiReady));
      } else this.toast(pick(QUIPS.shake));
    }
  }

  _updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      pr.vz -= (pr.grav || 0) * dt;
      if (pr.z < 0) {
        pr.z = 0;
        pr.vz = 0;
      }
      pr.life -= dt;
      pr.spin += dt * 10;

      // Produce sparkle trail
      if (Math.random() < 0.4) {
        this.particles.push({
          x: pr.x + pr.w / 2,
          y: pr.y + pr.h / 2 - pr.z,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          life: 0.3,
          max: 0.3,
          color: "#d07aff",
          size: 3,
          text: null,
        });
      }

      if (pr.friendly && this.elon && this.elon.alive && aabb(pr, this.elon)) {
        this.killElon();
        this.addSplat(pr.x, pr.y);
        pr.life = 0;
      }
      for (const s of this._solids()) {
        if (pr.life <= 0) break;
        if (!aabb(pr, s)) continue;
        if (s.kind === "planter" || s.kind === "velvet" || s.kind === "wall" || s.kind === "palace" || s.kind === "bar") {
          pr.life = 0;
          this.addSplat(pr.x, pr.y);
          this.audio.splat();
          this.burst(pr.x, pr.y, "#c768eb", 8);
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0 && pr.x > -40 && pr.x < W + 40 && pr.y > -40 && pr.y < H + 40);
  }

  addSplat(x, y) {
    this.splats.push({
      x,
      y,
      radius: 14 + Math.random() * 8,
      life: 4.0,
      max: 4.0,
      color: "#8a2aab",
    });
  }

  _updateSplats(dt) {
    for (const sp of this.splats) {
      sp.life -= dt;
    }
    this.splats = this.splats.filter((sp) => sp.life > 0);
  }

  shoot() {
    const p = this.player;
    const dir = FACE[p.facing];
    const speed = 275;
    this.recoil = 1;
    this.muzzleFlash = 1;
    
    this.projectiles.push({
      x: p.x + p.w / 2 + dir.x * 20 - 8,
      y: p.y + p.h * 0.45 + dir.y * 12,
      w: 18,
      h: 14,
      vx: dir.x * speed,
      vy: dir.y * speed,
      z: 12,
      vz: 95,
      grav: 260,
      life: 1.35,
      friendly: true,
      kind: "eggplant",
      spin: 0,
    });

    p.heat = Math.min(1, p.heat + 0.22);
    if (p.heat >= 1) {
      p.overheat = 1.15;
      p.heat = 0;
      this.audio.overheat();
      this.toast("CANNON OVERHEATED — LET THE PRODUCE BREATHE");
      this.burst(p.x + p.w / 2 + dir.x * 20, p.y + p.h * 0.45, "#ff5a3c", 12);
    }
    this.audio.shoot();
    this.burst(p.x + p.w / 2 + dir.x * 22, p.y + p.h * 0.42, "#c768eb", 6);
  }

  killElon() {
    const e = this.elon;
    if (!e || !e.alive) return;
    e.alive = false;
    this.kills++;
    this.score += 200;
    this.audio.hit();
    this.burst(e.x + e.w / 2, e.y + e.h / 2, "#ff8a2a", 24);
    if (this.mode === "papacito") this.queuedTalk = LINES.elonDeath;
    else this.startTalk(LINES.elonDeath);
  }

  tryPapacito() {
    if (this.charges <= 0 || this.mode !== "playing") {
      if (this.charges <= 0) this.toast("NEED 3 PROTEIN SHAKES FIRST, PAPI");
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

  hurt() {
    const p = this.player;
    if (p.inv > 0) return;
    p.hearts--;
    p.inv = 1.15;
    this.audio.hurt();
    this.toast(pick(QUIPS.hurt));
    this.burst(p.x + p.w / 2, p.y + p.h / 2, "#ff5b6e", 16);
    if (p.hearts <= 0) {
      this.mode = "dead";
      this.hideTalk();
      this.openModal(pick(DEATH_TITLES), "Retry the last checkpoint.", [
        [
          "RETRY CHECKPOINT",
          () => {
            const cp = p.checkpoint;
            p.hearts = 3;
            p.inv = 1.2;
            p.vx = 0;
            p.vy = 0;
            this.projectiles = [];
            this.enterScreen(cp.screen, { x: cp.x, y: cp.y });
            this.mode = "playing";
            this.closeModal();
            this.syncHUD();
          },
        ],
        ["TITLE", () => this.toTitle()],
      ]);
    }
    this.syncHUD();
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 160,
        vy: -20 - Math.random() * 80,
        life: 0.3 + Math.random() * 0.4,
        max: 0.7,
        color,
        size: 2 + Math.random() * 3,
        text: null,
      });
    }
  }

  floatText(x, y, text) {
    this.particles.push({ x, y, vx: 0, vy: -22, life: 0.8, max: 0.8, color: "#ffd56c", size: 9, text });
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.text ? 0 : 140 * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-200);
  }

  draw() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.frameT = (this.frameT || 0) + 1 / 60;

    if (this.mode === "title" || this.mode === "cine") {
      if (this.mode === "title") this.drawTitle(ctx);
      else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
      }
      return;
    }

    // ALttP Screen Scroll Rendering
    if (this.scroll) {
      const sc = this.scroll;
      if (sc.dir === "e" || sc.dir === "w") {
        const offset = sc.progress * W;
        ctx.save();
        if (sc.dir === "e") {
          ctx.translate(-offset, 0);
          this.drawScreenWorld(ctx, sc.fromScreen);
          ctx.translate(W, 0);
          this.drawScreenWorld(ctx, sc.toScreen);
        } else {
          ctx.translate(offset, 0);
          this.drawScreenWorld(ctx, sc.fromScreen);
          ctx.translate(-W, 0);
          this.drawScreenWorld(ctx, sc.toScreen);
        }
        ctx.restore();

        // Draw walking player across seam
        const px = sc.fromX + (sc.targetSpawn.x - sc.fromX) * sc.progress;
        const py = sc.fromY + (sc.targetSpawn.y - sc.fromY) * sc.progress;
        this._drawPlayerAt(ctx, px, py, this.player.facing, this.frameT * 10);
        return;
      } else if (sc.dir === "iris") {
        // Iris / wipe transition
        this.drawWorld(ctx);
        const radius = (1 - sc.progress) * Math.hypot(W, H) * 0.55;
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(W / 2, H / 2, Math.max(0, radius), 0, Math.PI * 2, true);
        ctx.fill();
        ctx.restore();
        return;
      }
    }

    const shakeAmt = this.papacitoT > 0 ? 8 : 0;
    ctx.save();
    if (shakeAmt) ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt * 0.5);
    this.drawWorld(ctx);
    ctx.restore();
  }

  drawTitle(ctx) {
    const t = this.frameT;
    const bg = this.sheet.bg1;
    if (bg && bg.complete) {
      const drift = Math.sin(t * 0.1) * 14;
      ctx.save();
      ctx.filter = "saturate(1.15) contrast(1.06)";
      ctx.drawImage(bg, -30 + drift, -20, W + 60, H + 40);
      ctx.restore();
      const veil = ctx.createLinearGradient(0, 0, 0, H);
      veil.addColorStop(0, "rgba(2,6,16,0.18)");
      veil.addColorStop(0.5, "rgba(2,6,16,0.28)");
      veil.addColorStop(1, "rgba(2,4,10,0.72)");
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 26; i++) {
      const ex = ((i * 137 + t * 18 * (1 + (i % 4) * 0.4)) % (W + 40)) - 20;
      const ey = H - ((i * 71 + t * 26 * (1 + (i % 3) * 0.5)) % (H + 60));
      ctx.globalAlpha = 0.25 + (i % 3) * 0.14;
      ctx.fillStyle = i % 2 ? "#ffd88a" : "#9fe8ff";
      ctx.beginPath();
      ctx.arc(ex, ey, 1.4 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const bob = Math.sin(t * 1.6) * 6;
    if (this.sheet.elon && this.sheet.elon.complete) {
      ctx.save();
      ctx.shadowColor = "#9ad8ff";
      ctx.shadowBlur = 36;
      ctx.drawImage(this.sheet.elon, -30, H * 0.34 + bob * 0.7, W * 0.34, H * 0.5);
      ctx.restore();
    }
    if (this.sheet.bob && this.sheet.bob.complete) {
      ctx.save();
      ctx.shadowColor = "#ffd165";
      ctx.shadowBlur = 40;
      ctx.drawImage(this.sheet.bob, W * 0.6, H * 0.34 - bob, W * 0.4, H * 0.6);
      ctx.restore();
    }
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(1,2,7,0.66)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  drawWorld(ctx) {
    this.drawScreenWorld(ctx, this.screen);
    this._drawSplats(ctx);
    this._drawProjectiles(ctx);
    this._drawPlayer(ctx);
    this._drawParticles(ctx);

    if (this.papacitoT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const heat = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 620);
      heat.addColorStop(0, `rgba(255,200,90,${this.papacitoT * 0.24})`);
      heat.addColorStop(0.6, `rgba(255,90,20,${this.papacitoT * 0.2})`);
      heat.addColorStop(1, "rgba(60,0,0,0)");
      ctx.fillStyle = heat;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.9);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(1,2,7,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  drawScreenWorld(ctx, lvl) {
    const bg = this.sheet[lvl.bgKey];
    const t = this.frameT;
    const bgShift = lvl.id === "east" ? -220 : lvl.id === "palace" ? -40 : 0;

    if (bg && bg.complete) {
      ctx.save();
      ctx.filter = lvl.id === "palace" ? "saturate(0.85) brightness(0.55) sepia(0.15)" : "saturate(1.12) contrast(1.06) brightness(0.92)";
      ctx.drawImage(bg, -40 + bgShift, -24, W + 140, H + 50);
      ctx.restore();
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, lvl.sky[0]);
      g.addColorStop(1, lvl.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const ground = ctx.createLinearGradient(0, 230, 0, H);
    ground.addColorStop(0, "rgba(12,18,28,0)");
    ground.addColorStop(0.18, lvl.id === "palace" ? "rgba(42,22,28,0.55)" : "rgba(18,24,34,0.45)");
    ground.addColorStop(1, lvl.id === "palace" ? "rgba(20,10,16,0.82)" : "rgba(8,12,18,0.72)");
    ctx.fillStyle = ground;
    ctx.fillRect(0, 220, W, H - 220);

    if (lvl.id === "palace") {
      ctx.fillStyle = "rgba(28,16,22,0.78)";
      ctx.fillRect(70, 200, 820, 300);
      const floor = ctx.createLinearGradient(0, 320, 0, 520);
      floor.addColorStop(0, "#3a241c");
      floor.addColorStop(1, "#1a100e");
      ctx.fillStyle = floor;
      ctx.fillRect(90, 320, 780, 180);
      
      // Floor planks
      ctx.strokeStyle = "rgba(255,200,120,0.12)";
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(90, 340 + i * 22);
        ctx.lineTo(870, 340 + i * 22);
        ctx.stroke();
      }

      // Backbar neon protein shake jars
      this._drawBackbarJars(ctx, t);
    } else {
      ctx.fillStyle = "rgba(255,224,160,0.06)";
      ctx.fillRect(lvl.bounds.x, lvl.bounds.y, lvl.bounds.w, 8);
    }

    this._drawSolidsForScreen(ctx, lvl);
    this._drawSignsForScreen(ctx, lvl, t);
    if (lvl.notes && lvl.notes.palaceDoor) this._drawPalaceDoorForScreen(ctx, lvl.notes.palaceDoor, t);
    if (lvl.door) this._drawVelvetDoorForScreen(ctx, lvl.door, t);
    this._drawShakesForScreen(ctx, lvl, t);
    if (lvl.eve) this._drawEveForScreen(ctx, lvl.eve, t);
    if (lvl.id === "east" && this.elon) this._drawElon(ctx, t);
  }

  _drawBackbarJars(ctx, t) {
    const jars = [
      { x: 220, y: 175, col: "#ff6b8b", name: "BERRY" },
      { x: 340, y: 175, col: "#7ef0c8", name: "MINT" },
      { x: 560, y: 175, col: "#ffd56c", name: "GOLD" },
      { x: 680, y: 175, col: "#b46be8", name: "PAPI" },
    ];
    for (const j of jars) {
      ctx.save();
      ctx.shadowColor = j.col;
      ctx.shadowBlur = 14;
      ctx.fillStyle = j.col;
      roundRectPath(ctx, j.x, j.y, 32, 42, 6);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(j.x + 6, j.y + 12, 20, 16);
      ctx.fillStyle = "#121820";
      ctx.font = "bold 8px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(j.name, j.x + 16, j.y + 24);
      ctx.restore();
    }
  }

  _drawSolidsForScreen(ctx, lvl) {
    for (const pl of lvl.solids) {
      if (pl.kind === "planter") {
        ctx.save();
        ctx.fillStyle = "#2a1810";
        roundRectPath(ctx, pl.x, pl.y + 12, pl.w, pl.h - 8, 6);
        ctx.fill();
        ctx.fillStyle = "#1a3a22";
        ctx.beginPath();
        ctx.ellipse(pl.x + pl.w / 2, pl.y + 10, pl.w * 0.42, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4aa86a";
        ctx.beginPath();
        ctx.ellipse(pl.x + pl.w / 2, pl.y + 4, 10, 16, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (pl.kind === "bar" || pl.kind === "backbar") {
        const grd = ctx.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
        grd.addColorStop(0, "#7a402e");
        grd.addColorStop(1, "#2a1410");
        ctx.fillStyle = grd;
        roundRectPath(ctx, pl.x, pl.y, pl.w, pl.h, 8);
        ctx.fill();
        ctx.fillStyle = "rgba(255,210,140,0.22)";
        ctx.fillRect(pl.x + 8, pl.y + 6, pl.w - 16, 6);
        
        // Brass footrail
        ctx.strokeStyle = "#ffd56c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pl.x + 12, pl.y + pl.h - 6);
        ctx.lineTo(pl.x + pl.w - 12, pl.y + pl.h - 6);
        ctx.stroke();
      } else if (pl.kind === "palace") {
        ctx.save();
        ctx.fillStyle = "rgba(10,8,16,0.28)";
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        ctx.strokeStyle = "rgba(255,213,108,0.22)";
        ctx.strokeRect(pl.x + 1, pl.y + 1, pl.w - 2, pl.h - 2);
        ctx.restore();
      }
    }
  }

  _drawSignsForScreen(ctx, lvl, t) {
    for (const s of lvl.signs) {
      const sw = 200;
      const sh = 28 + s.lines.length * 20;
      ctx.save();
      const glass = ctx.createLinearGradient(s.x, s.y, s.x, s.y + sh);
      glass.addColorStop(0, "rgba(38,24,66,0.92)");
      glass.addColorStop(1, "rgba(12,8,26,0.88)");
      ctx.fillStyle = glass;
      roundRectPath(ctx, s.x, s.y, sw, sh, 12);
      ctx.fill();
      ctx.strokeStyle = lvl.accent;
      ctx.lineWidth = 2;
      ctx.shadowColor = lvl.accent;
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.8 + Math.sin(t * 8 + s.x) * 0.1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = lvl.accent;
      ctx.font = "bold 15px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      s.lines.forEach((line, i) => ctx.fillText(line, s.x + sw / 2, s.y + 26 + i * 20));
      ctx.textAlign = "left";
      ctx.restore();
    }
  }

  _drawPalaceDoorForScreen(ctx, door, t) {
    ctx.save();
    const glow = 0.35 + Math.sin(t * 3) * 0.1;
    ctx.fillStyle = `rgba(255,200,110,${glow})`;
    roundRectPath(ctx, door.x, door.y, door.w, door.h, 10);
    ctx.fill();
    ctx.fillStyle = "#3a2214";
    roundRectPath(ctx, door.x + 8, door.y + 8, door.w - 16, door.h - 10, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd56c";
    ctx.font = "bold 11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ENTER", door.x + door.w / 2, door.y + door.h * 0.55);
    ctx.textAlign = "left";
    ctx.restore();
  }

  _drawVelvetDoorForScreen(ctx, door, t) {
    ctx.save();
    ctx.fillStyle = door.unlocked ? "#4a2048" : "#2a1028";
    roundRectPath(ctx, door.x, door.y, door.w, door.h, 8);
    ctx.fill();
    ctx.strokeStyle = door.unlocked ? "#ffd56c" : "#c86ee8";
    ctx.lineWidth = 4;
    ctx.shadowColor = door.unlocked ? "#ffd56c" : "#c86ee8";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#6b2d8b";
    ctx.fillRect(door.x + 10, door.y + 18, door.w - 20, door.h - 40);

    if (!door.unlocked) {
      // Golden Stanchions & Velvet Rope
      ctx.strokeStyle = "#c41c4a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(door.x - 8, door.y + 70);
      ctx.quadraticCurveTo(door.x + door.w / 2, door.y + 100, door.x + door.w + 8, door.y + 70);
      ctx.stroke();

      // Padlock
      ctx.fillStyle = "#ffd56c";
      ctx.beginPath();
      ctx.arc(door.x + door.w / 2, door.y + 78, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2c1c0a";
      ctx.fillRect(door.x + door.w / 2 - 2, door.y + 76, 4, 6);
    } else {
      // Open Portal shimmer
      ctx.fillStyle = "rgba(126, 240, 200, 0.4)";
      ctx.fillRect(door.x + 14, door.y + 22, door.w - 28, door.h - 48);
    }

    ctx.fillStyle = "#ffd56c";
    ctx.font = "bold 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("D1", door.x + door.w / 2, door.y + 36);
    ctx.font = "bold 10px Trebuchet MS, sans-serif";
    ctx.fillStyle = door.unlocked ? "#7ef0c8" : "#e8a0ff";
    ctx.fillText(door.unlocked ? "OPEN" : "VELVET", door.x + door.w / 2, door.y + door.h - 14);
    ctx.textAlign = "left";
    ctx.restore();
  }

  _drawShakesForScreen(ctx, lvl, t) {
    for (const s of lvl.shakes) {
      if (s.taken) continue;
      const y = s.y + Math.sin(s.bob) * 6;
      ctx.save();
      const halo = ctx.createRadialGradient(s.x + s.w / 2, y + s.h / 2, 4, s.x + s.w / 2, y + s.h / 2, 36);
      halo.addColorStop(0, "rgba(103,255,202,0.32)");
      halo.addColorStop(1, "rgba(103,255,202,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(s.x - 24, y - 24, s.w + 48, s.h + 48);
      if (this.sheet.shake) ctx.drawImage(this.sheet.shake, s.x, y, s.w, s.h);
      ctx.restore();
    }
  }

  _drawEveForScreen(ctx, eve, t) {
    const bob = Math.sin(t * 2.5) * 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(eve.x + eve.w / 2, eve.y + eve.h - 2, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.sheet.eve) ctx.drawImage(this.sheet.eve, eve.x, eve.y + bob, eve.w, eve.h);
    ctx.fillStyle = "#7ef0c8";
    ctx.font = "bold 11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("EVE", eve.x + eve.w / 2, eve.y - 4 + bob);
    ctx.textAlign = "left";
    ctx.restore();
  }

  _drawElon(ctx, t) {
    const e = this.elon;
    if (!e || !e.alive) return;
    const bob = Math.sin(e.t * 10) * 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(e.x + e.w / 2, e.y + e.h + 4, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // High-tech cyber scooter
    ctx.fillStyle = "#1e222a";
    roundRectPath(ctx, e.x + 4, e.y + e.h - 18, e.w - 8, 12, 6);
    ctx.fill();
    ctx.fillStyle = "#2a303c";
    ctx.beginPath();
    ctx.arc(e.x + 14, e.y + e.h - 2, 8, 0, Math.PI * 2);
    ctx.arc(e.x + e.w - 14, e.y + e.h - 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7ec8f0";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x + 14, e.y + e.h - 2, 8, 0, Math.PI * 2);
    ctx.arc(e.x + e.w - 14, e.y + e.h - 2, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.translate(e.x + e.w / 2, e.y + e.h - 10 + bob);
    ctx.scale(e.facing, 1);
    const img = this.sheet.elon;
    if (img && img.complete) {
      ctx.shadowColor = "#7ec8f0";
      ctx.shadowBlur = 18;
      ctx.drawImage(img, -40, -78, 80, 78);
    }
    ctx.restore();
  }

  _drawSplats(ctx) {
    if (!this.splats) return;
    for (const sp of this.splats) {
      const alpha = Math.min(1, sp.life / (sp.max * 0.5));
      ctx.save();
      ctx.globalAlpha = alpha * 0.65;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, sp.radius, sp.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawProjectiles(ctx) {
    if (!this.projectiles) return;
    for (const pr of this.projectiles) {
      ctx.save();
      // Ground shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.w * 0.45, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flying eggplant
      ctx.translate(pr.x + pr.w / 2, pr.y + pr.h / 2 - pr.z);
      ctx.rotate(pr.spin);
      ctx.shadowColor = "#b94fe8";
      ctx.shadowBlur = 14;
      const img = this.sheet.eggplant;
      if (img) ctx.drawImage(img, -pr.w / 2, -pr.h / 2, pr.w, pr.h);
      ctx.restore();
    }
  }

  _drawPlayer(ctx) {
    const p = this.player;
    if (p.inv > 0 && Math.floor(p.inv * 14) % 2) return;
    this._drawPlayerAt(ctx, p.x, p.y, p.facing, p.anim, p.overheat > 0);
  }

  _drawPlayerAt(ctx, px, py, facing, anim, overheated = false) {
    const img = this.sheet.bob;
    const dw = 92;
    const dh = 86;
    const isMoving = Math.hypot(this.player.vx, this.player.vy) > 8;
    const bob = isMoving ? Math.abs(Math.sin(anim * 12)) * -3 : Math.sin(anim * 2) * 1.2;
    const recoilOffset = (this.recoil || 0) * 4;

    ctx.save();
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(px + this.player.w / 2, py + this.player.h + 2, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(px + this.player.w / 2, py + this.player.h + bob);

    if (facing === "w") {
      ctx.scale(-1, 1);
      ctx.translate(recoilOffset, 0);
    } else if (facing === "e") {
      ctx.translate(-recoilOffset, 0);
    } else if (facing === "n") {
      ctx.translate(0, recoilOffset);
    } else if (facing === "s") {
      ctx.translate(0, -recoilOffset);
    }

    ctx.shadowColor = overheated ? "#ff5a3c" : "rgba(255,205,98,0.4)";
    ctx.shadowBlur = 14;

    if (img && img.complete) {
      if (facing === "n") {
        // Back-view styling filter
        ctx.save();
        ctx.filter = "brightness(0.85) contrast(1.1)";
        ctx.drawImage(img, -dw * 0.5, -dh + 6, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, -dw * 0.5, -dh + 6, dw, dh);
      }
    }

    // Muzzle flash on gun
    if (this.muzzleFlash > 0) {
      const dir = FACE[facing];
      const fx = dir.x * 32;
      const fy = -dh * 0.45 + dir.y * 14;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const flash = ctx.createRadialGradient(fx, fy, 2, fx, fy, 24);
      flash.addColorStop(0, "rgba(255,240,200,0.9)");
      flash.addColorStop(0.4, "rgba(220,124,255,0.6)");
      flash.addColorStop(1, "rgba(140,40,200,0)");
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(fx, fy, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawParticles(ctx) {
    if (!this.particles) return;
    for (const pt of this.particles) {
      const a = pt.life / pt.max;
      ctx.save();
      ctx.globalAlpha = a;
      if (pt.text) {
        ctx.fillStyle = pt.color;
        ctx.font = "bold 16px Trebuchet MS, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.fillText(pt.text, pt.x, pt.y);
      } else {
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(2, pt.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
