// Audio bus — HD soundtrack + rich procedural Web Audio chiptune & Zelda-style FX

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
    g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
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

  shoot() {
    if (!this.sfxOn) return;
    this._noise(0.09, 0.12, 0, "bandpass", 800);
    this._tone(175, 0.12, "sawtooth", 0.11, -85);
  }

  splat() {
    if (!this.sfxOn) return;
    this._noise(0.14, 0.16, 0, "lowpass", 700);
    this._tone(130, 0.1, "sine", 0.09, -60);
  }

  overheat() {
    if (!this.sfxOn) return;
    this._noise(0.35, 0.15, 0, "bandpass", 2400);
    this._tone(350, 0.25, "sawtooth", 0.08, -180);
  }

  whoosh() {
    if (!this.sfxOn) return;
    this._noise(0.24, 0.08, 0, "bandpass", 1100);
  }

  pickup() {
    if (!this.sfxOn || !this.ctx) return;
    const t = this.ctx.currentTime;
    [440, 554, 659, 880].forEach((f, i) => this._tone(f, 0.12, "sine", 0.08, 30, t + i * 0.045));
  }

  hit() {
    if (!this.sfxOn) return;
    this._noise(0.12, 0.18, 0, "bandpass", 650);
    this._tone(110, 0.12, "square", 0.12, -45);
  }

  hurt() {
    if (!this.sfxOn) return;
    this._noise(0.2, 0.14, 0, "lowpass", 850);
    this._tone(220, 0.25, "sawtooth", 0.12, -140);
  }

  /** Zelda secret discovery arpeggio for checkpoint / door unlock */
  secret() {
    if (!this.sfxOn || !this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [784, 740, 622, 440, 415, 659, 831, 1046]; // G5, F#5, D#5, A4, G#4, E5, G#5, C6
    notes.forEach((freq, i) => {
      this._tone(freq, 0.18, "triangle", 0.12, 0, t + i * 0.085);
      this._tone(freq * 0.5, 0.18, "square", 0.04, 0, t + i * 0.085);
    });
  }

  checkpoint() {
    this.secret();
  }

  /** Character speech blip for typewriter text */
  chatter(who = "BDB") {
    if (!this.sfxOn || !this.ctx) return;
    const pitch = who === "ELON" ? 480 + (Math.random() - 0.5) * 60 : who === "EVE" ? 340 + (Math.random() - 0.5) * 40 : 160 + (Math.random() - 0.5) * 30;
    const type = who === "ELON" ? "square" : who === "EVE" ? "triangle" : "sawtooth";
    this._tone(pitch, 0.04, type, 0.04, 0);
  }

  /** Elon scooter cackle — if this is silent, the pest is broken. */
  laugh() {
    if (!this.sfxOn || !this.ctx) return;
    const t = this.ctx.currentTime;
    const beats = [
      [440, 0.0, 0.12],
      [370, 0.1, 0.1],
      [500, 0.2, 0.14],
      [320, 0.34, 0.1],
      [540, 0.46, 0.16],
      [360, 0.62, 0.12],
      [420, 0.76, 0.1],
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
    this._noise(1.0, 0.22, 0, "lowpass", 700);
    this._noise(0.4, 0.14, 0, "highpass", 2000);
    [90, 70, 50, 40].forEach((f, i) => this._tone(f, 0.9, "sawtooth", 0.14, -10, this.ctx.currentTime + i * 0.05));
    const t = this.ctx.currentTime + 0.15;
    [520, 480, 560, 440, 500, 380, 420, 340, 300, 260].forEach((f, i) => {
      this._tone(f, 0.09, "square", 0.09, -30, t + i * 0.07);
      this._tone(f * 1.5, 0.06, "triangle", 0.04, 0, t + i * 0.07 + 0.02);
    });
    setTimeout(() => this.unduck(), 1800);
    if (navigator.vibrate) navigator.vibrate([30, 40, 80, 40, 120]);
  }

  win() {
    if (!this.sfxOn || !this.ctx) return;
    const t = this.ctx.currentTime;
    [262, 330, 392, 523, 659, 784].forEach((f, i) => this._tone(f, 0.35, "sine", 0.08, 10, t + i * 0.09));
  }

  ui() {
    if (!this.sfxOn) return;
    this._tone(660, 0.06, "sine", 0.05);
  }
}
