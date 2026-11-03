// =============================================================
//  StateMachine.js — Finite State Machine (FSM) แบบเรียบง่าย
// -------------------------------------------------------------
//  ตัวละครในเกมจะอยู่ใน "สถานะ" เดียวในแต่ละเวลา เช่น
//  idle → move → attack → idle ...
//  แต่ละสถานะเป็น object ที่มีฟังก์ชัน (ไม่บังคับครบทุกตัว):
//     enter(params)  เรียกครั้งเดียวตอนเข้าสถานะ
//     update(dt)     เรียกทุกเฟรมระหว่างอยู่ในสถานะ
//     exit()         เรียกครั้งเดียวตอนออกจากสถานะ
//
//  ข้อดี: โค้ดของแต่ละพฤติกรรมแยกกันชัด ไม่ต้องมี if ซ้อนกันเป็นร้อยบรรทัด
// =============================================================

export class StateMachine {
  /**
   * @param {Record<string, {enter?:Function, update?:Function, exit?:Function}>} states
   * @param {string} initial ชื่อสถานะเริ่มต้น
   */
  constructor(states, initial) {
    this.states = states;
    this.name = null;
    this.current = null;
    this.previous = null;
    this.time = 0; // อยู่ในสถานะปัจจุบันมากี่วินาทีแล้ว
    this.change(initial);
  }

  change(name, params) {
    const next = this.states[name];
    if (!next) throw new Error(`ไม่มีสถานะชื่อ "${name}"`);
    this.current?.exit?.();
    this.previous = this.name;
    this.name = name;
    this.current = next;
    this.time = 0;
    next.enter?.(params);
  }

  update(dt) {
    this.time += dt;
    this.current?.update?.(dt);
  }

  is(...names) {
    return names.includes(this.name);
  }
}
