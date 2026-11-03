// =============================================================
//  Audio.js — เสียงประกอบที่ "สังเคราะห์" ด้วยโค้ด (Web Audio API)
// -------------------------------------------------------------
//  ไม่ใช้ไฟล์เสียงเลย! สร้างเสียงจาก 2 วัตถุดิบ:
//    • Oscillator  — คลื่นเสียงโทนต่างๆ (sine, square, triangle, sawtooth)
//    • Noise       — เสียงซ่า (สุ่มค่า) เอามากรองเป็นเสียงลม/ฟัน/ระเบิด
//  แล้วปั้นความดังตามเวลาด้วย "envelope" (ขึ้นเร็ว-ค่อยๆ หาย)
//
//  หมายเหตุ: เบราว์เซอร์ไม่ยอมให้เล่นเสียงจนกว่าผู้ใช้จะคลิก/กดปุ่มครั้งแรก
//  จึงต้องเรียก unlock() ตอนกด "เริ่มเกม"
// =============================================================

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._noise = null;
    this._chargeOsc = null;
    this._lastPlay = new Map();
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      // compressor ช่วยกันเสียงแตกเวลามีหลายเสียงพร้อมกัน
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      // เตรียม noise buffer 1 วินาทีไว้ใช้ซ้ำ
      const len = this.ctx.sampleRate;
      this._noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  // ---------- วัตถุดิบเสียง ----------

  _tone({ type = 'sine', freq = 440, freqEnd = null, dur = 0.15, vol = 0.3, attack = 0.005, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noiseBurst({ dur = 0.15, vol = 0.3, filter = 'bandpass', freq = 1200, freqEnd = null, q = 1, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------- เสียงในเกม ----------

  /** เล่นเสียงตามชื่อ (กันเล่นซ้ำถี่เกินไปด้วย minGap) */
  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const minGap = opts.minGap ?? 0.03;
    if (now - (this._lastPlay.get(name) ?? -1) < minGap) return;
    this._lastPlay.set(name, now);
    const fn = SOUNDS[name];
    if (fn) fn(this, opts);
  }

  /** เสียงฮัมตอนชาร์จดาบ (เสียงสูงขึ้นตาม ratio 0..1) */
  setCharge(ratio) {
    if (!this.ctx || this.muted) return this.stopCharge();
    if (!this._chargeOsc) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      g.gain.value = 0.0001;
      osc.connect(g).connect(this.master);
      osc.start();
      this._chargeOsc = { osc, g };
    }
    const { osc, g } = this._chargeOsc;
    const t = this.ctx.currentTime;
    osc.frequency.setTargetAtTime(180 + ratio * 420, t, 0.03);
    g.gain.setTargetAtTime(0.05 + ratio * 0.07, t, 0.03);
  }

  stopCharge() {
    if (!this._chargeOsc) return;
    const { osc, g } = this._chargeOsc;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.02);
    osc.stop(t + 0.1);
    this._chargeOsc = null;
  }
}

const SOUNDS = {
  swing: (a, o) => a._noiseBurst({ dur: 0.13, vol: 0.22, freq: 900 + (o.pitch ?? 0) * 300, freqEnd: 3200, q: 1.2 }),
  heavySwing: (a) => {
    a._noiseBurst({ dur: 0.32, vol: 0.35, freq: 400, freqEnd: 2600, q: 0.8 });
    a._tone({ type: 'sawtooth', freq: 160, freqEnd: 60, dur: 0.3, vol: 0.12 });
  },
  hit: (a) => {
    a._tone({ type: 'square', freq: 220, freqEnd: 90, dur: 0.09, vol: 0.18 });
    a._noiseBurst({ dur: 0.08, vol: 0.3, filter: 'highpass', freq: 1800 });
  },
  heavyHit: (a) => {
    a._tone({ type: 'sine', freq: 140, freqEnd: 40, dur: 0.35, vol: 0.5 });
    a._noiseBurst({ dur: 0.25, vol: 0.4, filter: 'lowpass', freq: 2400, freqEnd: 300 });
    a._tone({ type: 'square', freq: 660, freqEnd: 330, dur: 0.12, vol: 0.08 });
  },
  dummyHit: (a) => {
    a._noiseBurst({ dur: 0.12, vol: 0.3, filter: 'lowpass', freq: 900, freqEnd: 300 });
    a._tone({ type: 'triangle', freq: 180, freqEnd: 110, dur: 0.12, vol: 0.12 });
  },
  chargeFull: (a) => {
    a._tone({ type: 'sine', freq: 880, dur: 0.25, vol: 0.18 });
    a._tone({ type: 'sine', freq: 1320, dur: 0.35, vol: 0.12, delay: 0.06 });
  },
  dodge: (a) => a._noiseBurst({ dur: 0.22, vol: 0.2, freq: 600, freqEnd: 1800, q: 0.7 }),
  hurt: (a) => {
    a._tone({ type: 'sawtooth', freq: 300, freqEnd: 120, dur: 0.2, vol: 0.18 });
    a._noiseBurst({ dur: 0.15, vol: 0.25, filter: 'lowpass', freq: 1200 });
  },
  exhausted: (a) => {
    a._tone({ type: 'triangle', freq: 520, freqEnd: 260, dur: 0.25, vol: 0.18 });
    a._tone({ type: 'triangle', freq: 390, freqEnd: 180, dur: 0.35, vol: 0.16, delay: 0.18 });
  },
  recovered: (a) => {
    a._tone({ type: 'sine', freq: 523, dur: 0.12, vol: 0.15 });
    a._tone({ type: 'sine', freq: 659, dur: 0.12, vol: 0.15, delay: 0.08 });
    a._tone({ type: 'sine', freq: 784, dur: 0.22, vol: 0.15, delay: 0.16 });
  },
  noStamina: (a) => a._tone({ type: 'square', freq: 140, dur: 0.08, vol: 0.08 }),
  step: (a) => a._noiseBurst({ dur: 0.05, vol: 0.06, filter: 'lowpass', freq: 700 }),
  enemyDie: (a) => {
    a._tone({ type: 'square', freq: 600, freqEnd: 80, dur: 0.35, vol: 0.12 });
    a._noiseBurst({ dur: 0.3, vol: 0.25, filter: 'lowpass', freq: 3000, freqEnd: 200 });
  },
  slimeHop: (a) => a._tone({ type: 'sine', freq: 200, freqEnd: 420, dur: 0.12, vol: 0.1 }),
  spore: (a) => a._noiseBurst({ dur: 0.4, vol: 0.3, filter: 'bandpass', freq: 500, freqEnd: 1500, q: 0.6 }),
  slam: (a) => {
    a._tone({ type: 'sine', freq: 90, freqEnd: 30, dur: 0.5, vol: 0.6 });
    a._noiseBurst({ dur: 0.45, vol: 0.45, filter: 'lowpass', freq: 800, freqEnd: 100 });
  },
  windup: (a) => a._tone({ type: 'triangle', freq: 300, freqEnd: 600, dur: 0.18, vol: 0.06 }),
  pickup: (a) => {
    [523, 659, 784, 1046].forEach((f, i) => a._tone({ type: 'sine', freq: f, dur: 0.14, vol: 0.13, delay: i * 0.06 }));
  },
  talk: (a) => a._tone({ type: 'square', freq: 500 + Math.random() * 200, dur: 0.04, vol: 0.04 }),
  ui: (a) => a._tone({ type: 'sine', freq: 740, dur: 0.06, vol: 0.1 }),
  anvil: (a) => {
    a._tone({ type: 'square', freq: 1400, freqEnd: 1200, dur: 0.18, vol: 0.05 });
    a._tone({ type: 'sine', freq: 2100, dur: 0.3, vol: 0.04 });
  },
  meow: (a) => a._tone({ type: 'triangle', freq: 700, freqEnd: 500, dur: 0.25, vol: 0.06 }),
  win: (a) => {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => a._tone({ type: 'triangle', freq: f, dur: 0.25, vol: 0.14, delay: i * 0.12 }));
  },
  portal: (a) => {
    a._tone({ type: 'sine', freq: 300, freqEnd: 900, dur: 0.8, vol: 0.15 });
    a._noiseBurst({ dur: 0.8, vol: 0.12, freq: 800, freqEnd: 3000, q: 2 });
  },
};
