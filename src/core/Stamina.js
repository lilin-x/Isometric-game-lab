// =============================================================
//  Stamina.js — ระบบพลังกาย (pure logic: ไม่ยุ่งกับกราฟิกเลย)
// -------------------------------------------------------------
//  กติกา:
//   1) ทำท่า (ฟัน/หลบ) ได้เมื่อ "ยังไม่หมดแรง" และ stamina > 0
//      ถ้าแรงเหลือน้อยกว่าที่ท่าต้องใช้ ก็ยังทำได้ แต่หลอดจะติดลบไม่ได้ (หยุดที่ 0)
//   2) หยุดใช้แรงครบ regenDelay วินาที → ค่อยๆ ฟื้น regenRate ต่อวินาที
//   3) ถ้าหลอดถึง 0 → เข้าสถานะ "หมดแรง" (exhausted) นาน exhaustedDuration
//      ระหว่างนี้ไม่ฟื้นและทำท่าไม่ได้
//   4) พ้น cooldown → stamina กลับมาเท่ากับ recoverTo (ครึ่งหลอด)
//
//  เพราะไฟล์นี้ไม่ import three.js เลย เราจึงเขียน unit test ได้ง่าย
//  (ดู tests/stamina.test.js)
// =============================================================

import { Events } from './Events.js';

export class Stamina {
  /**
   * @param {{max:number, regenDelay:number, regenRate:number,
   *          exhaustedDuration:number, recoverTo:number}} cfg
   */
  constructor(cfg) {
    this.cfg = cfg;
    this.max = cfg.max;
    this.value = cfg.max;
    this.exhausted = false;
    this.exhaustTimer = 0; // เหลือเวลาหมดแรงอีกกี่วินาที
    this.sinceUse = Infinity; // ผ่านไปกี่วินาทีตั้งแต่ใช้แรงครั้งล่าสุด
    this.holdRegen = false; // true = ห้ามฟื้น (เช่น ระหว่างชาร์จดาบ)
    this.events = new Events();
  }

  /** ตอนนี้ทำท่าได้ไหม */
  canAct() {
    return !this.exhausted && this.value > 0;
  }

  /**
   * ใช้แรง คืนค่า true ถ้าใช้สำเร็จ
   * @param {number} amount
   */
  spend(amount) {
    if (!this.canAct()) return false;
    this.value = Math.max(0, this.value - amount);
    this.sinceUse = 0;
    this.events.emit('spend', { amount, value: this.value });
    if (this.value <= 0) this._becomeExhausted();
    return true;
  }

  /** เรียกทุกเฟรม — dt คือเวลาที่ผ่านไปจากเฟรมก่อน (วินาที) */
  update(dt) {
    if (this.exhausted) {
      this.exhaustTimer -= dt;
      if (this.exhaustTimer <= 0) {
        this.exhausted = false;
        this.exhaustTimer = 0;
        this.value = this.cfg.recoverTo;
        this.sinceUse = 0; // ให้หลอดค้างที่ครึ่งหนึ่งสักพัก ก่อนเริ่มฟื้นต่อตามปกติ
        this.events.emit('recovered', { value: this.value });
      }
      return;
    }

    this.sinceUse += dt;
    const canRegen = !this.holdRegen && this.sinceUse >= this.cfg.regenDelay;
    if (canRegen && this.value < this.max) {
      this.value = Math.min(this.max, this.value + this.cfg.regenRate * dt);
    }
  }

  /** 0..1 สัดส่วนหลอด */
  get ratio() {
    return this.value / this.max;
  }

  /** 0..1 ความคืบหน้าของ cooldown ตอนหมดแรง (ใช้วาดวง loading) */
  get exhaustProgress() {
    if (!this.exhausted) return 1;
    return 1 - this.exhaustTimer / this.cfg.exhaustedDuration;
  }

  /** กำลังรอฟื้นอยู่ไหม (ใช้โชว์ไอคอน "พัก") */
  get isWaitingToRegen() {
    return !this.exhausted && this.value < this.max && this.sinceUse < this.cfg.regenDelay;
  }

  reset() {
    this.value = this.max;
    this.exhausted = false;
    this.exhaustTimer = 0;
    this.sinceUse = Infinity;
    this.holdRegen = false;
  }

  _becomeExhausted() {
    this.exhausted = true;
    this.exhaustTimer = this.cfg.exhaustedDuration;
    this.holdRegen = false;
    this.events.emit('exhausted', { duration: this.cfg.exhaustedDuration });
  }
}
