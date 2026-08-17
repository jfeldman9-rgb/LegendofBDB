import { AudioBus } from "./audio.js";
import { loadSheet } from "./sprites.js";
import { buildChapter, CHAPTER_NAMES, SCALE as S } from "./levels.js";

const W = 960;
const H = 540;
const SAVE_KEY = "bdb-awakening-hd-v1";

const defaultSave = () => ({
  unlocked: 1,
  whey: 0,
  best: 0,
  upgrades: { extraDash: false, ricochet: false, shakeHeal: false },
});

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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const QUIPS = {
  hurt: ["NOT THE TUX!", "EGO BRUISED.", "PRODUCE MALFUNCTION.", "PAPI DOWN — TEMPORARILY."],
  shake: ["ONE SCOOP.", "HE'S GLOWING.", "ILLEGAL GAINS.", "CHUG RESPONSIBLY."],
  papiReady: ["PAPACITO ONLINE.", "THE BUTTON THIRSTS.", "NUKE THE HALOS."],
  kill: ["TOASTED.", "WINGS CLIPPED.", "SAY LESS, YETI.", "BACK TO HEAVEN'S DMV."],
  dead: ["TUXEDO DAMAGED. EGO INTACT.", "PAPI HAS LEFT THE CHAT.", "RESPAWNING WITH SPICE."],
};

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

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
    this.chapter = 1;
    this.keys = Object.create(null);
    this.touch = { left: false, right: false, jump: false, fire: false, papi: false, dash: false };
    this.fireHeld = 0;
    this.toastT = 0;
    this.toastMsg = "";
    this.bannerT = 0;
    this.bannerMsg = "";
    this.papacitoT = 0;
    this.msg = "";
    this.usingTouch = false;
    this.bootstrapped = false;
    this._bindUI();
    this._bindInput();
    this._bindMusicUpload();
    this.resetChapter(1, true);
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
    // start loop even if assets slow
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
    if (this.sheet.elon) {
      c.drawImage(this.sheet.elon, 0, 0, el.width, el.height);
    }
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
    };

    const elonCtx = this.ui.elon.getContext("2d");
    elonCtx.imageSmoothingEnabled = true;
    // painted after assets load via _paintElon()

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

    // Ensure menu buttons always bind even if DOM shifts
    ["btn-how", "btn-chapters", "btn-protein", "btn-start"].forEach((id) => {
      const el = $("#" + id);
      if (!el) console.warn("missing", id);
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

    // Touch controls
    const hold = (el, key) => {
      const set = (v) => (e) => {
        e.preventDefault();
        this.usingTouch = true;
        document.body.classList.add("touch-on");
        this.touch[key] = v;
        if (key === "jump" && v) this.jumpPressed = true;
        if (key === "papi" && v) this.papiPressed = true;
        if (key === "dash" && v) this.dashPressed = true;
        if (key === "fire") this.touch.fire = v;
      };
      el.addEventListener("pointerdown", set(true));
      el.addEventListener("pointerup", set(false));
      el.addEventListener("pointercancel", set(false));
      el.addEventListener("pointerleave", set(false));
    };
    hold($("#ctrl-left"), "left");
    hold($("#ctrl-right"), "right");
    hold($("#ctrl-jump"), "jump");
    hold($("#ctrl-fire"), "fire");
    hold($("#ctrl-papi"), "papi");
    hold($("#ctrl-dash"), "dash");

    this.showMenu("main");
    this._bindCine();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "a", "d", "w", "s", "j", "k", "shift", "p", "escape", "enter"].includes(k))
        e.preventDefault();
      this.keys[k] = true;
      if (k === " " || k === "w" || k === "arrowup") this.jumpPressed = true;
      if (k === "k") this.papiPressed = true;
      if (k === "shift") this.dashPressed = true;
      if (k === "p" || k === "escape") {
        if (this.mode === "title" && this.menu !== "main") this.showMenu("main");
        else this.togglePause();
      }
      if (k === "enter" && this.mode === "title") this.startFromTitle();
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
    [1, 2, 3].forEach((n) => {
      const unlocked = n <= this.save.unlocked;
      const btn = document.createElement("button");
      btn.disabled = !unlocked;
      btn.innerHTML = `<b>CHAPTER ${["I", "II", "III"][n - 1]}</b><em>${unlocked ? "PLAY" : "LOCKED"}</em><span>${CHAPTER_NAMES[n]}</span>`;
      btn.onclick = () => this.startChapter(n);
      list.appendChild(btn);
    });
  }

  _renderUpgrades() {
    const list = this.root.querySelector("#upgrade-list");
    const whey = this.root.querySelector("#whey-count");
    whey.textContent = this.save.whey;
    const items = [
      { key: "extraDash", name: "DOUBLE DASH", desc: "Two air dashes per landing", cost: 4 },
      { key: "ricochet", name: "RICOCHET PRODUCE", desc: "Eggplants bounce once off ground", cost: 4 },
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
    this.playCine("open", () => this.startChapter(1));
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
    if (play && play.catch) {
      play.catch(() => {
        // autoplay blocked — wait for skip or another tap
      });
    }
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

  startChapter(n) {
    this.audio.unlock();
    this.audio.startMusic();
    this.resetChapter(n);
    this.mode = "playing";
    this.ui.menu.classList.remove("show");
    this.ui.modal.classList.remove("show");
    this.banner(CHAPTER_NAMES[n], 2.4);
    this.toast(n === 1 ? "RESCUE THE PRINCESS. IGNORE THE HALOS." : "POOR JUDGMENT: RESUMED.");
  }

  resetChapter(n, silent = false) {
    this.chapter = n;
    this.level = buildChapter(n);
    const sp = this.level.spawn;
    this.player = {
      x: sp.x,
      y: sp.y,
      w: 16 * S,
      h: 24 * S,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: false,
      hearts: 3,
      inv: 0,
      coyote: 0,
      jumpBuf: 0,
      dash: 0,
      dashes: this.save.upgrades.extraDash ? 2 : 1,
      maxDashes: this.save.upgrades.extraDash ? 2 : 1,
      heat: 0,
      overheat: 0,
      anim: 0,
      checkpoint: { x: sp.x, y: sp.y },
    };
    this.projectiles = [];
    this.particles = [];
    this.cameraX = 0;
    this.shakeN = 0; // toward next papacito (0-3)
    this.charges = 0;
    this.score = 0;
    this.kills = 0;
    this.shakesGot = 0;
    this.elapsed = 0;
    this.bossAwake = false;
    this.bossDead = false;
    this.fireCooldown = 0;
    if (!silent) this.syncHUD();
  }

  togglePause() {
    if (this.mode === "cine") return;
    if (this.mode === "playing") {
      this.mode = "paused";
      this.openModal(
        "PAUSED",
        "The yettis are discussing your boundaries.",
        [
          ["RESUME", () => ((this.mode = "playing"), this.closeModal())],
          ["HOW TO PLAY", () => this.openHowModal()],
          ["TITLE", () => this.toTitle()],
        ]
      );
    } else if (this.mode === "paused") {
      this.mode = "playing";
      this.closeModal();
    }
  }

  openHowModal() {
    this.openModal(
      "HOW TO WAKE BDB",
      "Move A/D · Jump Space · Fire J (hold charge) · Dash Shift · Papacito K\nEvery 3 protein shakes = 1 Papacito charge. Clears every yeti on screen. Elon laughs. Claudia waits.",
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
    this.ui.papFlash.classList.remove("show");
    this.resetChapter(1, true);
    this.showMenu("main");
    this.syncHUD();
  }

  toast(msg) {
    this.toastMsg = msg;
    this.toastT = 1.6;
    this.ui.toast.textContent = msg;
    this.ui.toast.classList.add("show");
  }

  banner(msg, t = 2) {
    this.bannerMsg = msg;
    this.bannerT = t;
    this.ui.bannerTitle.textContent = msg;
    this.ui.banner.classList.add("show");
  }

  syncHUD() {
    const hearts = this.ui.hearts;
    hearts.innerHTML = [0, 1, 2].map((i) => `<span class="${i < this.player.hearts ? "on" : ""}">♥</span>`).join("");
    const prot = this.ui.protein;
    prot.innerHTML = [0, 1, 2].map((i) => `<i class="${i < this.shakeN ? "full" : ""}"></i>`).join("");
    const ch = this.ui.charges;
    ch.innerHTML = [0, 1].map((i) => `<i class="${i < this.charges ? "full" : ""}">P</i>`).join("");
    this.ui.score.textContent = String(this.score).padStart(6, "0");
    this.ui.chapter.textContent = `CH ${["I", "II", "III"][this.chapter - 1]}`;
    this.ui.zone.textContent = this.level.name;
    this.ui.papiBtn.classList.toggle("ready", this.charges > 0 && this.mode === "playing");
    this.ui.papiBtn.disabled = this.charges <= 0;
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.draw();
    requestAnimationFrame((nt) => this.loop(nt));
  }

  left() {
    return this.keys.a || this.keys.arrowleft || this.touch.left;
  }
  right() {
    return this.keys.d || this.keys.arrowright || this.touch.right;
  }
  jumping() {
    return this.keys[" "] || this.keys.w || this.keys.arrowup || this.touch.jump;
  }
  firing() {
    return this.keys.j || this.touch.fire;
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

    if (this.mode === "papacito") {
      this.papacitoT -= dt;
      this.cameraShake = Math.max(this.cameraShake || 0, this.papacitoT);
      if (this.papacitoT <= 0) {
        this.ui.papFlash.classList.remove("show");
        if (this.bossDead || (this.chapter === 3 && this.level.enemies.every((e) => !e.alive || e.kind !== "boss"))) {
          this.victory();
        } else {
          this.mode = "playing";
        }
      }
      this.updateParticles(dt);
      return;
    }

    if (this.mode !== "playing") {
      this.jumpPressed = false;
      this.papiPressed = false;
      this.dashPressed = false;
      return;
    }

    this.elapsed += dt;
    const p = this.player;
    p.anim += dt;
    p.inv = Math.max(0, p.inv - dt);
    p.overheat = Math.max(0, p.overheat - dt);
    if (p.overheat <= 0) p.heat = Math.max(0, p.heat - dt * 0.35);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // horizontal
    if (p.dash > 0) {
      p.dash -= dt;
      p.vx = p.facing * 220 * S;
      p.vy = 0;
    } else {
      if (this.left() !== this.right()) {
        const dir = this.left() ? -1 : 1;
        p.vx += dir * 900 * S * dt;
        p.vx = clamp(p.vx, -110 * S, 110 * S);
        p.facing = dir;
      } else {
        p.vx *= Math.pow(0.001, dt);
        if (Math.abs(p.vx) < 2 * S) p.vx = 0;
      }
      if (this.jumpPressed) p.jumpBuf = 0.12;
      this.jumpPressed = false;
      p.jumpBuf = Math.max(0, p.jumpBuf - dt);
      if (p.grounded) p.coyote = 0.09;
      else p.coyote = Math.max(0, p.coyote - dt);
      if (p.jumpBuf > 0 && p.coyote > 0) {
        p.vy = -210 * S;
        p.grounded = false;
        p.coyote = 0;
        p.jumpBuf = 0;
        this.audio.jump();
        this.burst(p.x + p.w / 2, p.y + p.h, "#d9c9ad", 8);
      }
      if (!this.jumping() && p.vy < -60 * S) p.vy += 500 * S * dt;
      p.vy += 520 * S * dt;
      p.vy = Math.min(280 * S, p.vy);

      if (this.dashPressed && !p.grounded && p.dashes > 0) {
        p.dash = 0.14;
        p.dashes--;
        p.inv = Math.max(p.inv, 0.2);
        this.burst(p.x + p.w / 2, p.y + p.h / 2, "#7ef0c8", 12);
      }
      this.dashPressed = false;
    }

    // fire — rapid + charge
    if (this.firing() && p.overheat <= 0) {
      this.fireHeld += dt;
      if (this.fireCooldown <= 0 && this.fireHeld < 0.35) {
        this.shoot(false);
        this.fireCooldown = 0.11;
      }
    } else {
      if (this.fireHeld >= 0.35 && p.overheat <= 0) this.shoot(true);
      this.fireHeld = 0;
    }

    if (this.papiPressed) this.tryPapacito();
    this.papiPressed = false;

    // integrate + collide platforms
    p.x += p.vx * dt;
    p.x = clamp(p.x, 0, this.level.width - p.w);
    const prevBottom = p.y + p.h;
    p.y += p.vy * dt;
    p.grounded = false;
    let land = Infinity;
    for (const pl of this.level.platforms) {
      if (pl.broken) continue;
      if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && prevBottom <= pl.y + 4 * S && p.y + p.h >= pl.y && p.vy >= 0) {
        land = Math.min(land, pl.y);
      }
    }
    if (land < Infinity) {
      p.y = land - p.h;
      p.vy = 0;
      p.grounded = true;
      p.dashes = p.maxDashes;
    }
    if (p.y > H + 20) this.hurt(true);

    // pickups
    for (const s of this.level.shakes) {
      if (s.taken) continue;
      s.bob += dt * 3;
      const box = { x: s.x, y: s.y + Math.sin(s.bob) * 3, w: s.w, h: s.h };
      if (aabb(p, box)) {
        s.taken = true;
        this.shakesGot++;
        this.shakeN++;
        this.score += 250;
        this.save.whey++;
        writeSave(this.save);
        if (this.save.upgrades.shakeHeal) p.hearts = Math.min(3, p.hearts + 1);
        this.audio.pickup();
        this.burst(s.x + 6, s.y + 8, "#7ef0c8", 12);
        if (this.shakeN >= 3) {
          this.shakeN = 0;
          this.charges = Math.min(2, this.charges + 1);
          this.toast(pick(QUIPS.papiReady));
        } else this.toast(pick(QUIPS.shake));
        this.syncHUD();
      }
    }

    // enemies
    for (const e of this.level.enemies) this.updateEnemy(e, dt);

    // projectiles
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.vy += (pr.grav || 0) * dt;
      pr.life -= dt;
      pr.spin += dt * 10;
      if (pr.friendly) {
        if (pr.life < 1.65) {
          for (const pl of this.level.platforms) {
            if (pl.broken || !aabb(pr, pl)) continue;
            if (pl.kind === "cloud" || pl.kind === "velvet") continue; // produce flies through ledges
            if (pl.kind === "crate") {
              pl.hp -= pr.dmg;
              if (pl.hp <= 0) {
                pl.broken = true;
                this.score += 100;
                this.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, "#e4aa65", 14);
                if (Math.random() < 0.45) {
                  this.level.shakes.push({ x: pl.x + 4, y: pl.y - 18, w: 12, h: 16, taken: false, bob: 0 });
                }
              }
            }
            if (pr.bounce > 0 && pl.kind === "ground") {
              pr.bounce--;
              pr.vy = -Math.abs(pr.vy) * 0.75;
              pr.y = pl.y - pr.h - 1;
            } else if (pl.kind === "ground" || pl.kind === "crate") {
              pr.life = 0;
              this.burst(pr.x, pr.y, "#c768eb", 4);
            }
            break;
          }
        }
        for (const e of this.level.enemies) {
          if (!e.alive || !aabb(pr, e)) continue;
          this.damageEnemy(e, pr.dmg, pr.charged);
          pr.pierce--;
          if (pr.pierce <= 0) pr.life = 0;
          break;
        }
      } else if (aabb(pr, p) && p.inv <= 0) {
        pr.life = 0;
        this.hurt();
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0 && pr.x > this.cameraX - 40 && pr.x < this.cameraX + W + 40);

    // stomp / touch enemies
    for (const e of this.level.enemies) {
      if (!e.alive || !aabb(p, e)) continue;
      if (p.vy > 40 * S && prevBottom <= e.y + 10 * S) {
        this.damageEnemy(e, 2, false);
        p.vy = -160 * S;
        p.dashes = p.maxDashes;
      } else if (p.dash > 0) {
        this.damageEnemy(e, 2, true);
      } else if (p.inv <= 0) this.hurt();
    }

    // chapter goal / boss wake
    if (this.chapter === 3 && !this.bossAwake && p.x > 1550 * S) {
      this.bossAwake = true;
      this.toast("THE COUNCIL DENIES THIS RESCUE.");
      this.banner("BOSS: GRAND WINGMAN", 2.5);
      this.audio.yell();
    }

    // mid-level checkpoint
    if (!p.cp2 && p.x > this.level.width * 0.45) {
      p.cp2 = true;
      p.checkpoint = { x: p.x, y: Math.min(p.y, 100 * S) };
      p.hearts = 3;
      this.audio.checkpoint();
      this.toast("CHECKPOINT: EGO INTACT");
      this.syncHUD();
    }

    if (this.chapter < 3 && p.x >= this.level.goalX) {
      this.clearChapter();
    } else if (this.chapter === 3 && this.bossDead && p.x >= this.level.goalX - 40) {
      this.victory();
    }

    // camera
    const target = clamp(p.x - W * 0.35, 0, this.level.width - W);
    this.cameraX += (target - this.cameraX) * Math.min(1, dt * 6);

    this.updateParticles(dt);
    this.jumpPressed = false;
  }

  updateEnemy(e, dt) {
    if (!e.alive) return;
    e.t += dt;
    e.cooldown -= dt;
    const p = this.player;
    const dx = p.x + p.w / 2 - (e.x + e.w / 2);
    const dy = p.y + p.h / 2 - (e.y + e.h / 2);
    e.facing = dx < 0 ? -1 : 1;

    const dist = Math.hypot(dx, dy);
    if (dist < 170 * S && e.alert <= 0) {
      e.alert = 2.5;
      e.yellShown = true;
      this.audio.yell();
      this.toast("YETI: TURN BACK PAPI!");
    }
    e.alert = Math.max(0, e.alert - dt);

    if (e.kind === "walker") {
      e.x += e.facing * 28 * S * dt;
      if (Math.abs(e.x - e.homeX) > 50 * S) e.x = e.homeX + Math.sign(e.x - e.homeX) * 50 * S;
      e.y = e.homeY;
    } else if (e.kind === "hover") {
      e.x = e.homeX + Math.sin(e.t * 1.5) * 40 * S;
      e.y = e.homeY + Math.sin(e.t * 2.2) * 16 * S;
      if (e.cooldown <= 0 && Math.abs(dx) < 160 * S) {
        e.cooldown = 1.6;
        const len = Math.hypot(dx, dy) || 1;
        this.projectiles.push({
          x: e.x + e.w / 2,
          y: e.y + 10 * S,
          w: 8 * S,
          h: 8 * S,
          vx: (dx / len) * 70 * S,
          vy: (dy / len) * 70 * S,
          life: 3,
          friendly: false,
          kind: "snow",
          dmg: 1,
          spin: 0,
        });
      }
    } else if (e.kind === "charger") {
      e.stateT -= dt;
      if (e.state === "idle" && Math.abs(dx) < 120 * S) {
        e.state = "telegraph";
        e.stateT = 0.5;
      } else if (e.state === "telegraph" && e.stateT <= 0) {
        e.state = "charge";
        e.stateT = 0.55;
        e.vx = Math.sign(dx) * 160 * S;
      } else if (e.state === "charge") {
        e.x += e.vx * dt;
        if (e.stateT <= 0) {
          e.state = "idle";
          e.vx = 0;
        }
      }
      e.y = e.homeY;
    } else if (e.kind === "choir") {
      e.x = e.homeX + Math.sin(e.t * 0.8) * 16 * S;
      e.y = e.homeY;
    } else if (e.kind === "boss") {
      if (!this.bossAwake) return;
      e.x = e.homeX + Math.sin(e.t * 0.9) * 50 * S;
      e.y = e.homeY + Math.sin(e.t * 1.4) * 20 * S;
      if (e.cooldown <= 0) {
        e.cooldown = 1.1;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + e.t;
          this.projectiles.push({
            x: e.x + e.w / 2,
            y: e.y + e.h / 2,
            w: 10 * S,
            h: 10 * S,
            vx: Math.cos(a) * 55 * S,
            vy: Math.sin(a) * 55 * S,
            life: 4,
            friendly: false,
            kind: "halo",
            dmg: 1,
            spin: 0,
          });
        }
      }
    }
  }

  shoot(charged) {
    const p = this.player;
    const speed = (charged ? 240 : 200) * S;
    const dmg = charged ? 3 : 1;
    this.projectiles.push({
      x: p.x + p.w / 2 + p.facing * 14 * S - 4 * S,
      y: p.y + 8 * S,
      w: (charged ? 16 : 12) * S,
      h: (charged ? 10 : 8) * S,
      vx: p.facing * speed,
      vy: (charged ? -30 : -18) * S,
      grav: (charged ? 50 : 55) * S,
      life: charged ? 2.2 : 1.8,
      friendly: true,
      kind: "eggplant",
      dmg,
      charged,
      pierce: charged ? 3 : 1,
      bounce: this.save.upgrades.ricochet ? 1 : 0,
      spin: 0,
    });
    p.heat = Math.min(1, p.heat + (charged ? 0.35 : 0.12));
    if (p.heat >= 1) {
      p.overheat = 1.1;
      p.heat = 0;
      this.toast("CANNON OVERHEATED — LET THE PRODUCE BREATHE");
    }
    this.audio.shoot(charged);
    this.burst(p.x + p.w / 2 + p.facing * 12 * S, p.y + 12 * S, "#c768eb", charged ? 14 : 6);
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
    for (const e of this.level.enemies) {
      if (!e.alive) continue;
      const onScreen = e.x + e.w > this.cameraX - 20 && e.x < this.cameraX + W + 20;
      if (!onScreen) continue;
      if (e.kind === "boss") {
        e.hp -= 8;
        this.burst(e.x + e.w / 2, e.y + e.h / 2, "#ff8a2a", 30);
        if (e.hp <= 0) {
          e.alive = false;
          this.bossDead = true;
          this.kills++;
          this.score += 4000;
        }
      } else {
        e.alive = false;
        this.kills++;
        this.score += 500;
        this.burst(e.x + e.w / 2, e.y + e.h / 2, "#ff8a2a", 22);
      }
    }
    this.syncHUD();
  }

  damageEnemy(e, dmg, incinerate) {
    if (!e.alive) return;
    if (e.alert <= 0) {
      e.alert = 2.5;
      this.audio.yell();
      this.toast("YETI: TURN BACK PAPI!");
    }
    e.hp -= dmg;
    this.audio.hit();
    this.score += 25 * dmg;
    this.burst(e.x + e.w / 2, e.y + e.h / 2, incinerate ? "#ff8a2a" : "#9c46c8", incinerate ? 14 : 6);
    if (e.hp <= 0) {
      e.alive = false;
      this.kills++;
      this.score += incinerate ? 500 : 200;
      this.floatText(e.x + e.w / 2, e.y, pick(QUIPS.kill));
      if (e.kind === "boss") {
        this.bossDead = true;
        this.score += 3000;
        this.toast("WINGMAN GROUNDED.");
      }
    }
  }

  hurt(pit = false) {
    const p = this.player;
    if (p.inv > 0 && !pit) return;
    p.hearts--;
    p.inv = 1.2;
    this.audio.hurt();
    this.toast(pick(QUIPS.hurt));
    this.burst(p.x + p.w / 2, p.y + p.h / 2, "#ff5b6e", 14);
    if (pit || p.hearts <= 0) {
      if (p.hearts <= 0) {
        this.mode = "dead";
        this.openModal(pick(QUIPS.dead), "The yettis are doing victory lunges.", [
          [
            "RETRY CHECKPOINT",
            () => {
              p.hearts = 3;
              p.x = p.checkpoint.x;
              p.y = p.checkpoint.y;
              p.vx = 0;
              p.vy = 0;
              p.inv = 1;
              this.projectiles = [];
              this.mode = "playing";
              this.closeModal();
              this.syncHUD();
            },
          ],
          ["RESTART CHAPTER", () => this.startChapter(this.chapter)],
          ["TITLE", () => this.toTitle()],
        ]);
      } else {
        p.x = p.checkpoint.x;
        p.y = p.checkpoint.y;
        p.vx = 0;
        p.vy = 0;
      }
    } else {
      p.vx = -p.facing * 80 * S;
      p.vy = -120 * S;
    }
    this.syncHUD();
  }

  clearChapter() {
    this.save.unlocked = Math.max(this.save.unlocked, this.chapter + 1);
    this.save.whey += 2;
    this.save.best = Math.max(this.save.best, this.score);
    writeSave(this.save);
    this.audio.checkpoint();
    if (this.chapter < 3) {
      this.openModal(`CHAPTER ${this.chapter} CLEARED`, "Claudia's still locked up. Keep the eggplant warm.", [
        ["NEXT CHAPTER", () => this.startChapter(this.chapter + 1)],
        ["TITLE", () => this.toTitle()],
      ]);
      this.mode = "paused";
    }
  }

  victory() {
    if (this.mode === "win" || this.mode === "cine") return;
    this.mode = "win";
    this.save.unlocked = 3;
    this.save.whey += 3;
    this.save.best = Math.max(this.save.best, this.score);
    writeSave(this.save);
    this.playCine("close", () => {
      this.mode = "win";
      this.audio.win();
      this.openModal(
        "CLAUDIA RESCUED",
        `CLAUDIA: Is that what I think it is?\nBDB: Legally, it's produce.\nCLAUDIA: Let's leave before they reform.\n\nYettis toasted: ${this.kills}\nShakes chugged: ${this.shakesGot}\nScore: ${this.score}`,
        [
          ["RESCUE HER AGAIN", () => this.startChapter(1)],
          ["TITLE", () => this.toTitle()],
        ]
      );
    });
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 120 * S,
        vy: -30 * S - Math.random() * 90 * S,
        life: 0.3 + Math.random() * 0.4,
        max: 0.7,
        color,
        size: 2 + Math.random() * 3,
        text: null,
      });
    }
  }

  floatText(x, y, text) {
    this.particles.push({ x, y, vx: 0, vy: -20 * S, life: 1, max: 1, color: "#ffd56c", size: 8, text });
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.text ? 0 : 120 * S * dt;
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

    if (this.mode === "title") {
      this.drawTitle(ctx);
      return;
    }

    const shakeAmt = this.papacitoT > 0 ? 9 : this.cameraShake || 0;
    const cam = this.cameraX + (shakeAmt ? (Math.random() - 0.5) * shakeAmt : 0);
    const camY = shakeAmt ? (Math.random() - 0.5) * shakeAmt * 0.5 : 0;
    ctx.save();
    ctx.translate(0, camY);
    this.drawWorld(ctx, cam);
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

    // drifting embers
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

    // hero & villain flank the menu with breathing motion
    const bob = Math.sin(t * 1.6) * 6;
    if (this.sheet.yeti && this.sheet.yeti.complete) {
      ctx.save();
      ctx.shadowColor = "#9ad8ff";
      ctx.shadowBlur = 44;
      ctx.drawImage(this.sheet.yeti, -46, H * 0.3 + bob * 0.7, W * 0.42, H * 0.6);
      ctx.restore();
    }
    if (this.sheet.bob && this.sheet.bob.complete) {
      ctx.save();
      ctx.shadowColor = "#ffd165";
      ctx.shadowBlur = 40;
      ctx.drawImage(this.sheet.bob, W * 0.6, H * 0.34 - bob, W * 0.4, H * 0.6);
      ctx.restore();
    }

    // ground light pooling
    const pool = ctx.createRadialGradient(W / 2, H, 60, W / 2, H, 460);
    pool.addColorStop(0, "rgba(255,205,110,0.18)");
    pool.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(0, H - 240, W, 240);

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(1,2,7,0.66)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  drawWorld(ctx, cam) {
    const lvl = this.level;
    const bg = this.sheet[lvl.bgKey];
    const t = this.frameT;

    // ---- cinematic backdrop, two-layer parallax ----
    if (bg && bg.complete) {
      const p = cam / Math.max(1, lvl.width - W);
      ctx.save();
      ctx.filter = "saturate(1.15) contrast(1.08) brightness(0.9) blur(2px)";
      ctx.drawImage(bg, -60 - (p - 0.5) * 40, -30, W + 120, H + 60);
      ctx.restore();
      ctx.save();
      ctx.filter = "saturate(1.12) contrast(1.07) brightness(0.95)";
      ctx.globalAlpha = 0.85;
      ctx.drawImage(bg, -40 - (p - 0.5) * 110, -14, W + 80, H + 40);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, lvl.sky[0]);
      g.addColorStop(1, lvl.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // volumetric moon shaft
    const shaft = ctx.createRadialGradient(W * 0.56, 80, 30, W * 0.56, 220, 560);
    shaft.addColorStop(0, this.chapter === 2 ? "rgba(151,198,255,0.2)" : "rgba(255,209,128,0.17)");
    shaft.addColorStop(1, "rgba(1,4,10,0)");
    ctx.fillStyle = shaft;
    ctx.fillRect(0, 0, W, H);

    // depth fog band behind platforms
    const fog = ctx.createLinearGradient(0, H * 0.55, 0, H);
    fog.addColorStop(0, "rgba(20,30,55,0)");
    fog.addColorStop(1, this.chapter === 3 ? "rgba(40,20,50,0.5)" : "rgba(12,22,40,0.5)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // floating dust motes (parallax with camera)
    for (let i = 0; i < 22; i++) {
      const mx = ((i * 191 - cam * (0.25 + (i % 3) * 0.12) + t * 9) % (W + 60)) - 30;
      const my = 40 + ((i * 97 + t * 7) % (H - 80));
      ctx.globalAlpha = 0.12 + (i % 3) * 0.08;
      ctx.fillStyle = this.chapter === 2 ? "#cfe4ff" : "#ffe9b8";
      ctx.beginPath();
      ctx.arc(mx, my, 1.2 + (i % 3) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- neon glass signs ----
    for (const s of lvl.signs) {
      const x = s.x - cam;
      if (x < -240 || x > W + 60) continue;
      const sw = 216;
      const sh = 30 + s.lines.length * 23;
      ctx.save();
      const glass = ctx.createLinearGradient(x, s.y, x, s.y + sh);
      glass.addColorStop(0, "rgba(38,24,66,0.92)");
      glass.addColorStop(1, "rgba(12,8,26,0.88)");
      ctx.fillStyle = glass;
      roundRectPath(ctx, x, s.y, sw, sh, 12);
      ctx.fill();
      const flicker = 0.75 + Math.sin(t * 11 + s.x) * 0.12 + (Math.random() < 0.02 ? -0.3 : 0);
      ctx.globalAlpha = Math.max(0.35, flicker);
      ctx.strokeStyle = lvl.accent;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = lvl.accent;
      ctx.shadowBlur = 22;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRectPath(ctx, x + 4, s.y + 3, sw - 8, sh * 0.4, 8);
      ctx.fill();
      ctx.fillStyle = lvl.accent;
      ctx.shadowColor = lvl.accent;
      ctx.shadowBlur = 10;
      ctx.font = "bold 16px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      s.lines.forEach((line, i) => ctx.fillText(line, x + sw / 2, s.y + 28 + i * 23));
      ctx.textAlign = "left";
      ctx.restore();
    }

    // ---- platforms with material rendering ----
    for (const pl of lvl.platforms) {
      if (pl.broken) continue;
      const x = pl.x - cam;
      if (x + pl.w < -60 || x > W + 60) continue;
      if (pl.kind === "ground") {
        // stone street: base gradient + cobble strokes + rim light + reflection
        const grd = ctx.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
        if (this.chapter === 3) {
          grd.addColorStop(0, "#4c3350");
          grd.addColorStop(0.14, "#2b1f33");
          grd.addColorStop(1, "#0a0710");
        } else if (this.chapter === 2) {
          grd.addColorStop(0, "#44536e");
          grd.addColorStop(0.14, "#222f47");
          grd.addColorStop(1, "#080d18");
        } else {
          grd.addColorStop(0, "#3d5064");
          grd.addColorStop(0.14, "#1b2b3c");
          grd.addColorStop(1, "#070d14");
        }
        ctx.fillStyle = grd;
        ctx.fillRect(x, pl.y, pl.w, pl.h);
        // moonlit rim
        const rim = ctx.createLinearGradient(x, pl.y, x + pl.w, pl.y);
        rim.addColorStop(0, "rgba(255,224,150,0.0)");
        rim.addColorStop(0.5, this.chapter === 2 ? "rgba(185,215,240,0.85)" : "rgba(255,224,150,0.8)");
        rim.addColorStop(1, "rgba(255,224,150,0.0)");
        ctx.fillStyle = rim;
        ctx.fillRect(x, pl.y, pl.w, 4);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(x, pl.y + 4, pl.w, 2);
        // cobble hints
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1;
        for (let cx0 = x + 24 - ((cam * 0.0) % 48); cx0 < x + pl.w; cx0 += 48) {
          ctx.beginPath();
          ctx.moveTo(cx0, pl.y + 8);
          ctx.lineTo(cx0, pl.y + pl.h * 0.4);
          ctx.stroke();
        }
        // soft top reflection of sky
        ctx.fillStyle = this.chapter === 2 ? "rgba(150,190,255,0.06)" : "rgba(255,200,120,0.05)";
        ctx.fillRect(x, pl.y + 6, pl.w, 14);
      } else if (pl.kind === "crate") {
        if (this.sheet.crate) {
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 6;
          ctx.drawImage(this.sheet.crate, x, pl.y, pl.w, pl.h);
          ctx.restore();
        }
      } else {
        // glass-neon hover platform
        ctx.save();
        const hue = pl.kind === "velvet" ? "#c86ee8" : "#7ec8f0";
        ctx.shadowColor = hue;
        ctx.shadowBlur = 18;
        const grd = ctx.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
        grd.addColorStop(0, pl.kind === "velvet" ? "rgba(240,200,250,0.95)" : "rgba(230,245,255,0.95)");
        grd.addColorStop(0.35, pl.kind === "velvet" ? "rgba(120,70,140,0.9)" : "rgba(90,130,170,0.9)");
        grd.addColorStop(1, "rgba(14,22,38,0.92)");
        ctx.fillStyle = grd;
        roundRectPath(ctx, x, pl.y, pl.w, pl.h, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        // scanline shimmer
        ctx.globalAlpha = 0.3 + Math.sin(t * 3 + pl.x) * 0.15;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(x + 6, pl.y + 3, pl.w - 12, 2);
        ctx.globalAlpha = 1;
        // under-glow
        const under = ctx.createRadialGradient(x + pl.w / 2, pl.y + pl.h, 4, x + pl.w / 2, pl.y + pl.h, 40);
        under.addColorStop(0, pl.kind === "velvet" ? "rgba(200,110,232,0.5)" : "rgba(126,200,240,0.45)");
        under.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = under;
        ctx.fillRect(x - 20, pl.y + pl.h - 6, pl.w + 40, 46);
        ctx.restore();
      }
    }

    // ---- protein shakes with halo pulse ----
    for (const s of lvl.shakes) {
      if (s.taken) continue;
      const x = s.x - cam;
      if (x < -60 || x > W + 60) continue;
      const y = s.y + Math.sin(s.bob) * 7;
      const pulse = 0.6 + Math.sin(t * 4 + s.x) * 0.25;
      ctx.save();
      const halo = ctx.createRadialGradient(x + s.w / 2, y + s.h / 2, 4, x + s.w / 2, y + s.h / 2, 42);
      halo.addColorStop(0, `rgba(103,255,202,${0.3 * pulse})`);
      halo.addColorStop(1, "rgba(103,255,202,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(x - 30, y - 30, s.w + 60, s.h + 60);
      ctx.shadowColor = "#67ffca";
      ctx.shadowBlur = 20;
      if (this.sheet.shake) ctx.drawImage(this.sheet.shake, x, y, s.w, s.h);
      ctx.restore();
    }

    // ---- yetis: hover bob, wing shadow, alert states ----
    for (const e of lvl.enemies) {
      if (!e.alive) continue;
      const x = e.x - cam;
      if (x < -160 || x > W + 160) continue;
      const flap = Math.sin(e.t * 6) * (e.kind === "hover" || e.kind === "boss" ? 6 : 2.5);
      ctx.save();
      // contact shadow
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(x + e.w / 2, e.homeY + e.h - 2, e.w * 0.42, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = e.kind === "boss" ? "#9dd9ff" : e.kind === "choir" ? "#ffd85d" : "rgba(160,220,255,0.4)";
      ctx.shadowBlur = e.kind === "boss" ? 32 : e.kind === "choir" ? 22 : 14;
      const img = this.sheet.yeti;
      const drawW = e.w * 1.4;
      const drawH = e.h * 1.25;
      const dx0 = x + e.w / 2 - drawW / 2;
      const dy0 = e.y + e.h - drawH + flap;
      if (img && img.complete) {
        ctx.translate(dx0 + drawW / 2, 0);
        ctx.scale(e.facing > 0 ? -1 : 1, 1);
        if (e.kind === "choir") ctx.filter = "sepia(0.5) saturate(1.6) brightness(1.12)";
        else if (e.state === "telegraph") {
          ctx.filter = "sepia(1) saturate(4.5) hue-rotate(318deg) brightness(1.3)";
          ctx.translate((Math.random() - 0.5) * 4, 0);
        }
        ctx.drawImage(img, -drawW / 2, dy0, drawW, drawH);
      }
      ctx.restore();

      if (e.state === "telegraph") {
        ctx.save();
        ctx.fillStyle = "#ff4050";
        ctx.shadowColor = "#ff4050";
        ctx.shadowBlur = 14;
        ctx.font = "bold 30px Trebuchet MS, sans-serif";
        ctx.fillText("!", x + e.w / 2 - 6, e.y - 12 + Math.sin(t * 18) * 3);
        ctx.restore();
      }
      if (e.alert > 0) {
        const bw = 178;
        const bx = clamp(x + e.w / 2 - bw / 2, 8, W - bw - 8);
        const by = e.y - 42 + Math.sin(t * 5) * 2;
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.alert * 2);
        ctx.fillStyle = "rgba(255,250,235,0.97)";
        roundRectPath(ctx, bx, by, bw, 30, 14);
        ctx.fill();
        // bubble tail
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2 - 8, by + 30);
        ctx.lineTo(bx + bw / 2 + 8, by + 30);
        ctx.lineTo(bx + bw / 2, by + 40);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#241408";
        ctx.lineWidth = 2;
        roundRectPath(ctx, bx, by, bw, 30, 14);
        ctx.stroke();
        ctx.fillStyle = "#241408";
        ctx.font = "bold 15px Trebuchet MS, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("TURN BACK PAPI!", bx + bw / 2, by + 21);
        ctx.textAlign = "left";
        ctx.restore();
      }
      if (e.kind === "boss") {
        const bhx = x;
        const bhy = e.y - 18;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        roundRectPath(ctx, bhx, bhy, e.w, 10, 5);
        ctx.fill();
        const hpg = ctx.createLinearGradient(bhx, 0, bhx + e.w, 0);
        hpg.addColorStop(0, "#ff7a3c");
        hpg.addColorStop(1, "#ff2050");
        ctx.fillStyle = hpg;
        roundRectPath(ctx, bhx, bhy, Math.max(6, e.w * (e.hp / e.maxHp)), 10, 5);
        ctx.fill();
        ctx.strokeStyle = "#ffd56c";
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, bhx, bhy, e.w, 10, 5);
        ctx.stroke();
      }
    }

    // ---- Claudia keep ----
    if (this.chapter === 3) {
      const cx = this.level.goalX - cam;
      if (cx > -220 && cx < W + 100) {
        ctx.save();
        const towerG = ctx.createLinearGradient(cx, 190, cx + 70, 460);
        towerG.addColorStop(0, "#5d2a54");
        towerG.addColorStop(1, "#2a1028");
        ctx.fillStyle = towerG;
        roundRectPath(ctx, cx, 196, 74, 258, 8);
        ctx.fill();
        ctx.fillStyle = "#d5a348";
        ctx.fillRect(cx + 8, 212, 58, 10);
        ctx.fillStyle = "#ffe081";
        ctx.shadowColor = "#ffd873";
        ctx.shadowBlur = 8;
        ctx.font = "bold 14px Trebuchet MS, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CLAUDIA", cx + 37, 246);
        ctx.textAlign = "left";
        ctx.shadowBlur = 0;
        if (this.sheet.claudia) {
          ctx.shadowColor = "#ffd873";
          ctx.shadowBlur = this.bossDead ? 34 : 10;
          ctx.globalAlpha = this.bossDead ? 1 : 0.88;
          ctx.drawImage(this.sheet.claudia, cx - 28, 228, 130, 224);
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }
        if (!this.bossDead) {
          ctx.strokeStyle = "rgba(210,210,235,0.8)";
          ctx.lineWidth = 3.5;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(cx + 12 + i * 16, 258);
            ctx.lineTo(cx + 12 + i * 16, 434);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // ---- projectiles with additive glow trails ----
    for (const pr of this.projectiles) {
      const x = pr.x - cam;
      ctx.save();
      if (pr.kind === "eggplant") {
        // trail
        ctx.globalCompositeOperation = "screen";
        const trail = ctx.createRadialGradient(x + pr.w / 2 - pr.vx * 0.02, pr.y + pr.h / 2, 2, x + pr.w / 2 - pr.vx * 0.02, pr.y + pr.h / 2, pr.charged ? 34 : 20);
        trail.addColorStop(0, pr.charged ? "rgba(240,170,255,0.55)" : "rgba(185,80,232,0.4)");
        trail.addColorStop(1, "rgba(120,30,180,0)");
        ctx.fillStyle = trail;
        ctx.fillRect(x - 40, pr.y - 30, pr.w + 80, pr.h + 60);
        ctx.globalCompositeOperation = "source-over";
        ctx.translate(x + pr.w / 2, pr.y + pr.h / 2);
        ctx.rotate(pr.spin);
        ctx.shadowColor = pr.charged ? "#f2acff" : "#b94fe8";
        ctx.shadowBlur = pr.charged ? 26 : 14;
        const img = pr.charged ? this.sheet.eggplantBig : this.sheet.eggplant;
        if (img) ctx.drawImage(img, -pr.w / 2, -pr.h / 2, pr.w, pr.h);
      } else if (pr.kind === "halo") {
        ctx.translate(x + pr.w / 2, pr.y + pr.h / 2);
        ctx.rotate(pr.spin * 0.5);
        ctx.strokeStyle = "#ffe26b";
        ctx.lineWidth = 5;
        ctx.shadowColor = "#ffd334";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr.w / 2, pr.h / 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.translate(x + pr.w / 2, pr.y + pr.h / 2);
        const snowG = ctx.createRadialGradient(0, 0, 1, 0, 0, pr.w / 2);
        snowG.addColorStop(0, "#ffffff");
        snowG.addColorStop(1, "#9cc8e8");
        ctx.fillStyle = snowG;
        ctx.shadowColor = "#bfe4ff";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, pr.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ---- player: afterimages, run tilt, muzzle flash ----
    const p = this.player;
    // record trail
    this.trail = this.trail || [];
    if (Math.abs(p.vx) > 60 || p.dash > 0) {
      this.trail.push({ x: p.x, y: p.y, facing: p.facing, t: 0.22, dash: p.dash > 0 });
    }
    for (const tr of this.trail) tr.t -= 1 / 60;
    this.trail = this.trail.filter((tr) => tr.t > 0).slice(-8);

    const img = this.sheet.bob;
    const dw = 154;
    const dh = 132;
    for (const tr of this.trail) {
      if (!img || !img.complete) break;
      const ax = tr.x - cam;
      ctx.save();
      ctx.globalAlpha = tr.t * (tr.dash ? 1.4 : 0.55);
      if (tr.dash) {
        ctx.filter = "hue-rotate(120deg) saturate(2)";
      }
      ctx.translate(ax + p.w / 2, tr.y + p.h);
      if (tr.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw * 0.48, -dh + 8, dw, dh);
      ctx.restore();
    }

    if (!(p.inv > 0 && Math.floor(p.inv * 14) % 2)) {
      const px = p.x - cam;
      const running = p.grounded && Math.abs(p.vx) > 40;
      const bobY = running ? Math.abs(Math.sin(p.anim * 11)) * -4 : Math.sin(p.anim * 2) * 1.5;
      const tilt = p.dash > 0 ? p.facing * 0.18 : clamp(p.vx / 4200, -0.1, 0.1);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(px + p.w / 2, p.y + p.h - 2, 42 - Math.abs(bobY) * 2, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(px + p.w / 2, p.y + p.h + bobY);
      ctx.rotate(tilt);
      if (p.facing < 0) ctx.scale(-1, 1);
      ctx.shadowColor = p.dash > 0 ? "#77ffe1" : this.fireHeld >= 0.35 ? "#db7cff" : "rgba(255,205,98,0.4)";
      ctx.shadowBlur = p.dash > 0 ? 30 : 16;
      if (img && img.complete) ctx.drawImage(img, -dw * 0.48, -dh + 8, dw, dh);
      ctx.restore();

      // muzzle flash on recent shot
      if (this.fireCooldown > 0.06) {
        const fx = px + p.w / 2 + p.facing * 66;
        const fy = p.y + p.h * 0.4;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const flash = ctx.createRadialGradient(fx, fy, 2, fx, fy, 30);
        flash.addColorStop(0, "rgba(255,240,200,0.9)");
        flash.addColorStop(0.4, "rgba(220,124,255,0.6)");
        flash.addColorStop(1, "rgba(140,40,200,0)");
        ctx.fillStyle = flash;
        ctx.fillRect(fx - 32, fy - 32, 64, 64);
        ctx.restore();
      }

      if (this.fireHeld > 0.15) {
        const ax = px + p.w / 2 + p.facing * 70;
        const ay = p.y + p.h * 0.42;
        ctx.save();
        ctx.strokeStyle = this.fireHeld >= 0.35 ? "#fff0a1" : "#d784ff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#b94dff";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(ax, ay, 10 + this.fireHeld * 20 + Math.sin(t * 16) * 2, 0, Math.PI * 2);
        ctx.stroke();
        if (this.fireHeld >= 0.35) {
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(ax, ay, 20 + Math.sin(t * 22) * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ---- particles: additive ----
    for (const pt of this.particles) {
      const x = pt.x - cam;
      const a = pt.life / pt.max;
      ctx.save();
      ctx.globalAlpha = a;
      if (pt.text) {
        ctx.fillStyle = pt.color;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 6;
        ctx.font = "bold 17px Trebuchet MS, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(pt.text, x, pt.y);
        ctx.textAlign = "left";
      } else {
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, pt.y, Math.max(2, pt.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ---- goal flag ch1/2 ----
    if (this.chapter < 3) {
      const gx = this.level.goalX - cam;
      if (gx > -80 && gx < W + 60) {
        ctx.save();
        ctx.fillStyle = "#e8e8f0";
        ctx.fillRect(gx, 200, 5, 140);
        const wave = Math.sin(t * 4) * 5;
        ctx.fillStyle = "#ff5a3c";
        ctx.beginPath();
        ctx.moveTo(gx + 5, 200);
        ctx.lineTo(gx + 54 + wave, 208);
        ctx.lineTo(gx + 5, 228);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffd56c";
        ctx.shadowColor = "#ffd56c";
        ctx.shadowBlur = 10;
        ctx.font = "bold 15px Trebuchet MS, sans-serif";
        ctx.fillText("CLAUDIA →", gx - 14, 190);
        ctx.restore();
      }
    }

    // ---- papacito heat distortion overlay ----
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

    // ---- cinematic grade: vignette + subtle letterbox ----
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.9);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(1,2,7,0.6)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, 8);
    ctx.fillRect(0, H - 8, W, 8);
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
