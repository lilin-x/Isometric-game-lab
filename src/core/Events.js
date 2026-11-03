// =============================================================
//  Events.js — ระบบ "ส่งข่าว" แบบง่าย (Observer pattern)
// -------------------------------------------------------------
//  ใช้ให้ส่วนต่างๆ ของเกมคุยกันโดยไม่ต้องรู้จักกันโดยตรง
//  เช่น Stamina ไม่ต้องรู้ว่ามี HUD อยู่ แค่ประกาศว่า "exhausted"
//  ใครสนใจก็มา on('exhausted', ...) เอง
// =============================================================

export class Events {
  constructor() {
    this._listeners = new Map();
  }

  /** สมัครฟังเหตุการณ์ คืนค่าเป็นฟังก์ชันสำหรับยกเลิก */
  on(name, fn) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(fn);
    return () => this._listeners.get(name)?.delete(fn);
  }

  /** ประกาศเหตุการณ์ พร้อมส่งข้อมูลไปให้ผู้ฟังทุกคน */
  emit(name, data) {
    const set = this._listeners.get(name);
    if (set) for (const fn of set) fn(data);
  }

  clear() {
    this._listeners.clear();
  }
}
