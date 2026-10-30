"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/core/rng.ts
  function hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  var Rng = class {
    constructor(seed = Date.now()) {
      __publicField(this, "s");
      this.s = (typeof seed === "string" ? hash(seed) : seed >>> 0) || 1;
    }
    next() {
      this.s = this.s + 1831565813 >>> 0;
      let t = this.s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    int(a, b) {
      return a + Math.floor(this.next() * (b - a + 1));
    }
    range(a, b) {
      return a + this.next() * (b - a);
    }
    chance(p) {
      return this.next() < p;
    }
    pick(a) {
      return a[Math.floor(this.next() * a.length)];
    }
    weighted(items, w) {
      let total = 0;
      for (const it of items) total += Math.max(0, w(it));
      let r = this.next() * total;
      for (const it of items) {
        r -= Math.max(0, w(it));
        if (r < 0) return it;
      }
      return items[items.length - 1];
    }
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  };

  // src/core/audio.ts
  var MAJ_PENTA = [0, 2, 4, 7, 9];
  var MIN_PENTA = [0, 3, 5, 7, 10];
  var DORIAN = [0, 2, 3, 5, 7, 9, 10];
  var MINOR = [0, 2, 3, 5, 7, 8, 10];
  var LYDIAN = [0, 2, 4, 6, 7, 9, 11];
  var WHOLE = [0, 2, 4, 6, 8, 10];
  var SONGS = {
    title: { bpm: 84, root: 57, scale: LYDIAN, prog: [0, 3, 4, 2], lead: "triangle", bass: "sine", mood: "calm", seed: "title" },
    village: { bpm: 100, root: 60, scale: MAJ_PENTA, prog: [0, 3, 1, 4], lead: "square", bass: "triangle", mood: "bright", seed: "edgewick" },
    wood: { bpm: 76, root: 57, scale: DORIAN, prog: [0, 5, 3, 4], lead: "triangle", bass: "sine", mood: "dark", seed: "hollow" },
    battle: { bpm: 150, root: 57, scale: MINOR, prog: [0, 5, 3, 4], lead: "square", bass: "sawtooth", mood: "tense", seed: "battle" },
    boss: { bpm: 160, root: 52, scale: MINOR, prog: [0, 1, 5, 4], lead: "sawtooth", bass: "square", mood: "tense", seed: "boss" },
    marsh: { bpm: 96, root: 62, scale: MIN_PENTA, prog: [0, 2, 3, 1], lead: "square", bass: "triangle", mood: "calm", seed: "fizz" },
    town: { bpm: 108, root: 65, scale: MAJ_PENTA, prog: [0, 4, 3, 1], lead: "triangle", bass: "triangle", mood: "bright", seed: "prismouth" },
    church: { bpm: 70, root: 55, scale: DORIAN, prog: [0, 3, 0, 4], lead: "sine", bass: "triangle", mood: "dark", seed: "carillon" },
    desert: { bpm: 90, root: 58, scale: WHOLE, prog: [0, 2, 4, 1], lead: "triangle", bass: "sine", mood: "calm", seed: "hourglass" },
    market: { bpm: 120, root: 63, scale: DORIAN, prog: [0, 3, 4, 3], lead: "square", bass: "sawtooth", mood: "bright", seed: "undermarket" },
    sky: { bpm: 112, root: 60, scale: LYDIAN, prog: [0, 1, 4, 5], lead: "triangle", bass: "triangle", mood: "bright", seed: "tether" },
    loom: { bpm: 80, root: 50, scale: WHOLE, prog: [0, 1, 0, 3], lead: "sine", bass: "sawtooth", mood: "dark", seed: "loom" },
    sad: { bpm: 64, root: 57, scale: MINOR, prog: [0, 5, 2, 4], lead: "triangle", bass: "sine", mood: "calm", seed: "sad" },
    final: { bpm: 168, root: 50, scale: MINOR, prog: [0, 6, 5, 4], lead: "sawtooth", bass: "square", mood: "tense", seed: "final" },
    victory: { bpm: 132, root: 60, scale: MAJ_PENTA, prog: [0, 3, 4, 0], lead: "square", bass: "triangle", mood: "bright", seed: "win" }
  };
  function midiHz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }
  var Audio = class {
    constructor() {
      __publicField(this, "ctx", null);
      __publicField(this, "master", null);
      __publicField(this, "muted", false);
      __publicField(this, "song", null);
      __publicField(this, "timer", null);
      __publicField(this, "nextTime", 0);
      __publicField(this, "step", 0);
      __publicField(this, "pattern", null);
      __publicField(this, "noise", null);
      try {
        this.muted = localStorage.getItem("duotone.mute") === "1";
      } catch {
      }
    }
    unlock(ctx, out) {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      try {
        this.ctx = ctx ?? new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(out ?? this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        if (this.song) {
          const s = this.song;
          this.song = null;
          this.play(s);
        }
      } catch {
        this.ctx = null;
      }
    }
    toggleMute() {
      this.muted = !this.muted;
      try {
        localStorage.setItem("duotone.mute", this.muted ? "1" : "0");
      } catch {
      }
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    }
    tone(freq, dur, wave, vol, when = 0, slide = 0) {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    hiss(dur, vol, when = 0, hp = 800) {
      if (!this.ctx || !this.master || !this.noise) return;
      const t = this.ctx.currentTime + when;
      const s = this.ctx.createBufferSource();
      s.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = hp;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      s.connect(f).connect(g).connect(this.master);
      s.start(t);
      s.stop(t + dur + 0.02);
    }
    sfx(name) {
      if (!this.ctx) return;
      switch (name) {
        case "move":
          this.tone(880, 0.04, "square", 0.05);
          break;
        case "ok":
          this.tone(660, 0.06, "square", 0.07);
          this.tone(990, 0.08, "square", 0.06, 0.05);
          break;
        case "back":
          this.tone(440, 0.07, "square", 0.06, 0, 0.7);
          break;
        case "bump":
          this.tone(110, 0.06, "square", 0.05);
          break;
        case "blip":
          this.tone(1200 + Math.random() * 200, 0.015, "square", 0.025);
          break;
        case "hit":
          this.hiss(0.12, 0.25, 0, 600);
          this.tone(180, 0.1, "square", 0.1, 0, 0.5);
          break;
        case "crit":
          this.hiss(0.2, 0.35, 0, 300);
          this.tone(300, 0.2, "sawtooth", 0.12, 0, 0.3);
          break;
        case "clash":
          this.tone(1320, 0.08, "square", 0.08);
          this.tone(1760, 0.12, "square", 0.07, 0.06);
          this.hiss(0.1, 0.2, 0, 2e3);
          break;
        case "blend":
          this.tone(220, 0.15, "triangle", 0.1, 0, 0.8);
          break;
        case "magic":
          for (let i = 0; i < 4; i++) this.tone(600 + i * 200, 0.08, "triangle", 0.06, i * 0.04);
          break;
        case "heal":
          for (let i = 0; i < 5; i++) this.tone(523 * Math.pow(1.122, i * 2), 0.12, "triangle", 0.07, i * 0.05);
          break;
        case "buff":
          this.tone(400, 0.2, "square", 0.06, 0, 2);
          break;
        case "debuff":
          this.tone(600, 0.25, "square", 0.06, 0, 0.4);
          break;
        case "die":
          this.tone(300, 0.4, "square", 0.08, 0, 0.2);
          this.hiss(0.4, 0.12, 0, 200);
          break;
        case "break":
          this.hiss(0.3, 0.4, 0, 1500);
          this.tone(1e3, 0.3, "square", 0.1, 0, 0.3);
          break;
        case "lvl":
          [0, 4, 7, 12].forEach((n, i) => this.tone(midiHz(72 + n), 0.15, "square", 0.07, i * 0.08));
          break;
        case "enc":
          for (let i = 0; i < 6; i++) this.tone(200 + i * 120, 0.05, "sawtooth", 0.06, i * 0.03);
          break;
        case "door":
          this.tone(150, 0.1, "triangle", 0.1);
          this.tone(100, 0.12, "triangle", 0.1, 0.08);
          break;
        case "chest":
          [0, 7, 12].forEach((n, i) => this.tone(midiHz(76 + n), 0.1, "square", 0.06, i * 0.07));
          break;
        case "save":
          [0, 4, 7, 11, 14].forEach((n, i) => this.tone(midiHz(67 + n), 0.3, "triangle", 0.06, i * 0.1));
          break;
        case "coin":
          this.tone(1568, 0.05, "square", 0.06);
          this.tone(2093, 0.12, "square", 0.06, 0.05);
          break;
        case "tick":
          this.tone(2e3, 0.02, "square", 0.04);
          break;
        case "flee":
          for (let i = 0; i < 5; i++) this.tone(800 - i * 100, 0.05, "square", 0.05, i * 0.04);
          break;
        case "shift":
          this.tone(300, 0.3, "sine", 0.1, 0, 3);
          this.tone(900, 0.3, "sine", 0.06, 0.1, 0.33);
          break;
        case "bell":
          [0, 12, 19].forEach((n) => this.tone(midiHz(60 + n), 1.2, "sine", 0.08));
          break;
        case "miss":
          this.tone(500, 0.08, "triangle", 0.05, 0, 1.5);
          break;
      }
    }
    build(s) {
      const r = new Rng(hash(s.seed));
      const deg = (d, oct = 0) => {
        const n = s.scale.length;
        const o = Math.floor(d / n);
        return s.root + s.scale[(d % n + n) % n] + 12 * (o + oct);
      };
      const motif = () => {
        const m = [];
        let d = r.int(2, 5);
        for (let i = 0; i < 8; i++) {
          if (r.chance(s.mood === "calm" ? 0.35 : 0.2)) {
            m.push(null);
            continue;
          }
          d += r.pick([-2, -1, -1, 0, 1, 1, 2, 3]);
          d = Math.max(0, Math.min(9, d));
          m.push(d);
        }
        return m;
      };
      const a = motif();
      const b = motif();
      const lead = [];
      const bass = [];
      const arp = [];
      const form = [a, a, b, a];
      form.forEach((m, bar) => {
        const chordRoot = s.prog[bar % s.prog.length];
        m.forEach((d, i) => {
          lead.push(d === null ? null : deg(d + chordRoot, 1));
          bass.push(deg(chordRoot, -1));
          arp.push(deg(chordRoot + [0, 2, 4, 2][i % 4], 0));
        });
      });
      this.pattern = { lead, bass, arp };
    }
    play(name) {
      if (this.song === name) return;
      this.song = name;
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
      const s = SONGS[name];
      if (!s || !this.ctx) return;
      this.build(s);
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      const stepDur = 60 / s.bpm / 2;
      this.timer = window.setInterval(() => {
        if (!this.ctx || !this.pattern) return;
        while (this.nextTime < this.ctx.currentTime + 0.25) {
          const i = this.step % this.pattern.lead.length;
          const when = this.nextTime - this.ctx.currentTime;
          const ln = this.pattern.lead[i];
          if (ln !== null) this.tone(midiHz(ln), stepDur * 0.9, s.lead, s.lead === "sawtooth" ? 0.025 : 0.035, when);
          if (i % 2 === 0) this.tone(midiHz(this.pattern.bass[i]), stepDur * 1.8, s.bass, s.bass === "sine" ? 0.08 : 0.04, when);
          if (s.mood !== "calm" || i % 2 === 1) this.tone(midiHz(this.pattern.arp[i]), stepDur * 0.5, "triangle", 0.02, when);
          if (s.mood === "tense" && i % 4 === 0) this.hiss(0.05, 0.05, when, 3e3);
          this.nextTime += stepDur;
          this.step++;
        }
      }, 50);
    }
    stop() {
      this.song = null;
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  };

  // src/soundtrack.ts
  var loop = (id) => 32 * 30 / SONGS[id].bpm;
  var tracks = [
    ["title", "Duotone"],
    ["village", "Edgewick"],
    ["wood", "The Hollow Wood"],
    ["sad", "The Grey"],
    ["marsh", "The Fizz"],
    ["town", "Prismouth"],
    ["church", "Carillon"],
    ["loom", "The Loom"],
    ["desert", "The Hourglass Waste"],
    ["market", "The Undermarket"],
    ["sky", "The Cloud Sea"],
    ["battle", "Battle"],
    ["boss", "Boss"],
    ["final", "The Grey Bishop"],
    ["victory", "Victory"]
  ].map(([id, title]) => ({ id, title, length: loop(id) }));
  window.soundtrack = {
    tracks,
    start(id, ctx, out) {
      const audio = new Audio();
      audio.muted = false;
      audio.unlock(ctx, out);
      audio.play(id);
    }
  };
})();
