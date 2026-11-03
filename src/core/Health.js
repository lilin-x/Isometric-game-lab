// =============================================================
//  Health.js — หลอดเลือด (component เล็กๆ ใช้ได้ทั้งผู้เล่นและมอนสเตอร์)
// =============================================================

import { Events } from './Events.js';

export class Health {
  constructor(max) {
    this.max = max;
    this.value = max;
    this.events = new Events();
  }

  get dead() {
    return this.value <= 0;
  }

  get ratio() {
    return this.value / this.max;
  }

  /** ลดเลือด คืนค่าเลือดที่ลดไปจริง */
  damage(amount) {
    if (this.dead) return 0;
    const before = this.value;
    this.value = Math.max(0, this.value - amount);
    const dealt = before - this.value;
    this.events.emit('damaged', { amount: dealt, value: this.value });
    if (this.dead) this.events.emit('died');
    return dealt;
  }

  heal(amount) {
    if (this.dead) return 0;
    const before = this.value;
    this.value = Math.min(this.max, this.value + amount);
    const healed = this.value - before;
    if (healed > 0) this.events.emit('healed', { amount: healed, value: this.value });
    return healed;
  }

  reset() {
    this.value = this.max;
  }
}
