const HOLD_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "q",
  "e",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  " ",
  "shift",
  "control",
  "f",
  "j",
  "k",
  "p",
  "enter",
  "escape",
]);

export class Input {
  constructor(root) {
    this.root = root;
    this.keys = Object.create(null);
    this.pressed = Object.create(null);
    this.touch = {
      left: false,
      right: false,
      up: false,
      down: false,
      fire: false,
      jump: false,
      lock: false,
      talk: false,
      papi: false,
    };
    this.usingTouch = false;
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.zoomDelta = 0;
    this.pointerLook = false;
    this._dragging = false;
    this._bind();
  }

  _bind() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (HOLD_KEYS.has(k) || k === "control") e.preventDefault();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (e.key === "Control") {
        if (!this.keys.control) this.pressed.control = true;
        this.keys.control = true;
      }
      if (e.key === "Shift") {
        if (!this.keys.shift) this.pressed.shift = true;
        this.keys.shift = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = false;
      if (e.key === "Control") this.keys.control = false;
      if (e.key === "Shift") this.keys.shift = false;
    });
    window.addEventListener("blur", () => this.reset());

    const canvas = this.root.querySelector("#game");
    const onMove = (e) => {
      if (!this._dragging && !this.pointerLook) return;
      this.yawDelta += (e.movementX || 0) * 0.0055;
      this.pitchDelta += (e.movementY || 0) * 0.0038;
    };
    if (canvas) {
      canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        this._dragging = true;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      });
      canvas.addEventListener("pointerup", () => {
        this._dragging = false;
      });
      canvas.addEventListener("pointercancel", () => {
        this._dragging = false;
      });
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          this.zoomDelta += e.deltaY * 0.01;
        },
        { passive: false }
      );
      canvas.addEventListener("dblclick", async () => {
        try {
          if (document.pointerLockElement !== canvas) await canvas.requestPointerLock();
          else document.exitPointerLock();
        } catch {
          /* ignore */
        }
      });
    }
    document.addEventListener("pointerlockchange", () => {
      this.pointerLook = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (this.pointerLook) {
        this.yawDelta += (e.movementX || 0) * 0.0055;
        this.pitchDelta += (e.movementY || 0) * 0.0038;
      }
    });

    const hold = (sel, key) => {
      const el = this.root.querySelector(sel);
      if (!el) return;
      const set = (v) => (ev) => {
        ev.preventDefault();
        this.usingTouch = true;
        document.body.classList.add("touch-on");
        this.touch[key] = v;
        if (v) this.pressed["touch-" + key] = true;
      };
      el.addEventListener("pointerdown", set(true));
      el.addEventListener("pointerup", set(false));
      el.addEventListener("pointercancel", set(false));
      el.addEventListener("pointerleave", set(false));
    };
    hold("#ctrl-left", "left");
    hold("#ctrl-right", "right");
    hold("#ctrl-up", "up");
    hold("#ctrl-down", "down");
    hold("#ctrl-fire", "fire");
    hold("#ctrl-papi", "papi");
    hold("#ctrl-jump", "jump");
    hold("#ctrl-lock", "lock");
    hold("#ctrl-talk", "talk");

    window.addEventListener(
      "touchstart",
      () => {
        this.usingTouch = true;
        document.body.classList.add("touch-on");
      },
      { once: true, passive: true }
    );
    if (matchMedia("(pointer: coarse)").matches) {
      this.usingTouch = true;
      document.body.classList.add("touch-on");
    }
  }

  reset() {
    this.keys = Object.create(null);
    this.pressed = Object.create(null);
    Object.keys(this.touch).forEach((k) => (this.touch[k] = false));
    this._dragging = false;
  }

  endFrame() {
    this.pressed = Object.create(null);
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.zoomDelta = 0;
  }

  axis() {
    let x = 0;
    let z = 0;
    if (this.keys.a || this.keys.arrowleft || this.touch.left) x -= 1;
    if (this.keys.d || this.keys.arrowright || this.touch.right) x += 1;
    if (this.keys.w || this.keys.arrowup || this.touch.up) z -= 1;
    if (this.keys.s || this.keys.arrowdown || this.touch.down) z += 1;
    if (x && z) {
      x *= Math.SQRT1_2;
      z *= Math.SQRT1_2;
    }
    return { x, z };
  }

  orbit() {
    let yaw = this.yawDelta;
    let pitch = this.pitchDelta;
    if (this.keys.q) yaw -= 0.045;
    if (this.keys.e) yaw += 0.045;
    return { yaw, pitch, zoom: this.zoomDelta };
  }

  just(name) {
    return !!this.pressed[name];
  }

  jumpDown() {
    return this.just(" ") || this.just("touch-jump");
  }

  fireHeld() {
    return !!(this.keys.j || this.keys.control || this.touch.fire);
  }

  fireDown() {
    return this.just("j") || this.just("control") || this.just("touch-fire");
  }

  lockDown() {
    return this.just("shift") || this.just("f") || this.just("touch-lock");
  }

  interactDown() {
    return this.just("k") || this.just("e") || this.just("touch-talk");
  }

  papiHeld() {
    return !!(this.keys.p || this.keys.enter || this.touch.papi);
  }

  papiDown() {
    return this.just("p") || this.just("enter") || this.just("touch-papi");
  }

  /** Ocarina notes while the song menu is open. WASD / arrows / d-pad. */
  noteJust() {
    if (this.just("w") || this.just("arrowup") || this.just("touch-up") || this.just("i")) return "up";
    if (this.just("s") || this.just("arrowdown") || this.just("touch-down")) return "down";
    if (this.just("a") || this.just("arrowleft") || this.just("touch-left") || this.just("j")) return "left";
    if (this.just("d") || this.just("arrowright") || this.just("touch-right") || this.just("l")) return "right";
    if (this.just(" ") || this.just("f") || this.just("touch-jump")) return "a";
    return null;
  }

  pauseDown() {
    return this.just("escape");
  }

  talkAdvance() {
    return (
      this.just(" ") ||
      this.just("enter") ||
      this.just("k") ||
      this.just("e") ||
      this.just("j") ||
      this.just("touch-talk") ||
      this.just("touch-fire") ||
      this.just("touch-jump")
    );
  }
}
