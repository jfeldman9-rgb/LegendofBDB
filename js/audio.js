// Audio bus — HD soundtrack + SFX. Drop a Suno file at assets/audio/suno-bgm.mp3 (or pass setCustomTrack).

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.musicGain = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.musicEl = null;
    this.customTrackUrl = null;
    this.defaultTrack = "assets/audio/bdb-rise.mp3";
    this.unlocked = false;
    this.musicTimer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.75;
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.95;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.34;
      this.sfx.connect(this.master);
      this.musicGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    this.ctx.resume();
    this.unlocked = true;
    this.ensureMusicEl();
    if (this.musicOn) this.startMusic();
  }

  ensureMusicEl() {
    if (this.musicEl) return;
    this.musicEl = new Audio(this.customTrackUrl || this.defaultTrack);
    this.musicEl.loop = true;
    this.musicEl.preload = "auto";
    this.musicEl.volume = 0.34;
  }

  /** Call after user uploads a Suno track (Blob or object URL). */
  setCustomTrack(urlOrBlob) {
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.removeAttribute("src");
      this.musicEl.load();
      this.musicEl = null;
    }
    if (urlOrBlob instanceof Blob) {
      this.customTrackUrl = URL.createObjectURL(urlOrBlob);
    } else {
      this.customTrackUrl = urlOrBlob;
    }
    this.ensureMusicEl();
    if (this.unlocked && this.musicOn) this.startMusic();
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic();
    else this.stopMusic();
    return this.musicOn;
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    return this.sfxOn;
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicEl) {
      this.musicEl.pause();
    }
  }

  startMusic() {
    if (!this.musicOn) return;
    this.ensureMusicEl();
    if (this.musicEl) {
      this.musicEl.muted = false;
      this.musicEl.play().catch(() => {
        // Autoplay blocked — procedural fallback kickstarts after gesture
        this._startChiptuneFallback();
      });
      return;
    }
    this._startChiptuneFallback();
  }

  _startChiptuneFallback() {
    if (!this.ctx || this.musicTimer) return;
    const tempo = 118;
    const beat = 60 / tempo;
    const bass = [98, 98, 110, 98, 87, 87, 73, 82];
    const lead = [392, 0, 440, 392, 523, 440, 392, 349, 392, 0, 330, 349, 392, 440, 523, 0];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== "running" || !this.musicOn) return;
      const i = step++;
      const t = this.ctx.currentTime;
      const b = bass[i % bass.length];
      this._tone(b, beat * 0.9, "triangle", 0.07, 0, t, true);
      const n = lead[i % lead.length];
      if (n) this._tone(n, beat * 0.45, "square", 0.035, 0, t + 0.01, true);
    }, beat * 1000);
  }

  duck() {
    if (this.musicEl) this.musicEl.volume = 0.12;
  }
  unduck() {
    if (this.musicEl) this.musicEl.volume = 0.34;
  }

  _tone(freq, dur, type, vol, slide = 0, when = 0, music = false) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const start = when || this.ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(music ? this.musicGain : this.sfx);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  _noise(dur, vol, when = 0, filterType = "lowpass", cutoff = 1200) {
    if (!this.ctx || !this.sfx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    const start = when || this.ctx.currentTime;
    src.buffer = buf;
    f.type = filterType;
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(start);
  }

  jump() {
    if (!this.sfxOn) return;
    this._noise(0.08, 0.04, 0, "highpass", 1400);
    this._tone(220, 0.12, "triangle", 0.08, 420);
  }
  shoot(charged = false) {
    if (!this.sfxOn) return;
    this._noise(charged ? 0.16 : 0.07, charged ? 0.16 : 0.1, 0, "bandpass", charged ? 500 : 900);
    this._tone(charged ? 90 : 160, charged ? 0.22 : 0.09, "sawtooth", charged ? 0.14 : 0.1, -80);
  }
  pickup() {
    if (!this.sfxOn) return;
    [440, 550, 660, 880].forEach((f, i) => this._tone(f, 0.12, "sine", 0.07, 40, this.ctx.currentTime + i * 0.05));
  }
  hit() {
    if (!this.sfxOn) return;
    this._noise(0.1, 0.12, 0, "bandpass", 600);
    this._tone(100, 0.1, "square", 0.08, -40);
  }
  hurt() {
    if (!this.sfxOn) return;
    this._noise(0.18, 0.1, 0, "lowpass", 800);
    this._tone(200, 0.25, "sawtooth", 0.1, -120);
  }
  yell() {
    if (!this.sfxOn || !this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(180, 0.12, "sawtooth", 0.1, 40, t);
    this._tone(220, 0.14, "square", 0.08, -30, t + 0.11);
    this._tone(160, 0.18, "sawtooth", 0.1, 80, t + 0.24);
    this._tone(280, 0.2, "triangle", 0.07, -60, t + 0.4);
  }
  /** Elon scooter cackle — if this is silent, the pest is broken. */
  laugh() {
    if (!this.sfxOn || !this.ctx) return;
    const t = this.ctx.currentTime;
    const beats = [
      [420, 0.0, 0.12],
      [360, 0.1, 0.1],
      [480, 0.2, 0.14],
      [300, 0.34, 0.1],
      [520, 0.46, 0.16],
      [340, 0.62, 0.12],
      [400, 0.76, 0.1],
    ];
    beats.forEach(([f, when, dur]) => {
      this._tone(f, dur, "square", 0.13, -80, t + when);
      this._tone(f * 0.5, dur * 0.8, "sawtooth", 0.05, -20, t + when);
      this._noise(dur * 0.55, 0.045, t + when, "bandpass", 1600);
    });
  }
  papacito() {
    if (!this.sfxOn || !this.ctx) return;
    this.duck();
    this._noise(1.0, 0.2, 0, "lowpass", 700);
    this._noise(0.4, 0.12, 0, "highpass", 2000);
    [90, 70, 50, 40].forEach((f, i) => this._tone(f, 0.9, "sawtooth", 0.12, -10, this.ctx.currentTime + i * 0.05));
    const t = this.ctx.currentTime + 0.15;
    [520, 480, 560, 440, 500, 380, 420, 340, 300, 260].forEach((f, i) => {
      this._tone(f, 0.09, "square", 0.09, -30, t + i * 0.07);
      this._tone(f * 1.5, 0.06, "triangle", 0.04, 0, t + i * 0.07 + 0.02);
    });
    setTimeout(() => this.unduck(), 1800);
    if (navigator.vibrate) navigator.vibrate([30, 40, 80, 40, 120]);
  }
  win() {
    if (!this.sfxOn) return;
    [262, 330, 392, 523, 659, 784].forEach((f, i) => this._tone(f, 0.35, "sine", 0.08, 10, this.ctx.currentTime + i * 0.09));
  }
  checkpoint() {
    if (!this.sfxOn) return;
    [330, 392, 523].forEach((f, i) => this._tone(f, 0.2, "triangle", 0.07, 20, this.ctx.currentTime + i * 0.07));
  }
  ui() {
    if (!this.sfxOn) return;
    this._tone(660, 0.06, "sine", 0.05);
  }

  /** Keyboard ocarina-style note for Song of the Scoop. */
  songNote(freq) {
    if (!this.sfxOn || !this.ctx) return;
    this._tone(freq, 0.22, "triangle", 0.11, 18);
    this._tone(freq * 2, 0.16, "sine", 0.045, 8, this.ctx.currentTime + 0.01);
  }

  songOk() {
    if (!this.sfxOn) return;
    [392, 494, 587, 784].forEach((f, i) => this._tone(f, 0.22, "sine", 0.08, 12, this.ctx.currentTime + i * 0.07));
  }

  songFail() {
    if (!this.sfxOn) return;
    this._tone(180, 0.16, "square", 0.07, -40);
  }
}
