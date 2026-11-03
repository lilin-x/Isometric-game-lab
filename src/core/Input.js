// =============================================================
//  Input.js — อ่านคีย์บอร์ดและเมาส์
// -------------------------------------------------------------
//  เบราว์เซอร์ส่ง "event" มาตอนกด/ปล่อยปุ่ม แต่เกมอยากถามแบบนี้ทุกเฟรม:
//    - ปุ่มนี้ "กำลังกดค้าง" อยู่ไหม        → isDown()
//    - ปุ่มนี้ "เพิ่งถูกกด" ในเฟรมนี้ไหม     → wasPressed()
//    - ปุ่มนี้ "เพิ่งถูกปล่อย" ในเฟรมนี้ไหม  → wasReleased()
//  คลาสนี้จึงเก็บสถานะไว้ แล้วล้าง pressed/released ทุกปลายเฟรม (endFrame)
//
//  เราแปลง "ปุ่ม" เป็น "การกระทำ" (action) เช่น 'light', 'dodge'
//  ถ้าวันหลังอยากเปลี่ยนปุ่ม แก้ที่ BINDINGS ที่เดียวพอ
// =============================================================

const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  light: ['Mouse0', 'KeyJ'], // ฟันเบา
  heavy: ['Mouse2', 'KeyK'], // ฟันแรง (กดค้างเพื่อชาร์จ)
  dodge: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyL'], // หลบ
  interact: ['KeyE', 'Enter'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  debug: ['F3', 'Backquote'],
};

export class Input {
  constructor(element) {
    this.element = element;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { x: 0, y: 0, ndcX: 0, ndcY: 0, inside: false, moved: false };
    this.lastDevice = 'mouse'; // 'mouse' | 'keyboard' — ใช้ตัดสินใจว่าจะเล็งตามเมาส์ไหม

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3'].includes(e.code)) e.preventDefault();
      if (e.repeat) return; // ไม่นับการกดค้างที่ OS ส่งซ้ำ
      this._press(e.code);
      if (['KeyJ', 'KeyK', 'KeyL'].includes(e.code)) this.lastDevice = 'keyboard';
    });
    window.addEventListener('keyup', (e) => this._release(e.code));

    element.addEventListener('mousedown', (e) => {
      this._press('Mouse' + e.button);
      this.lastDevice = 'mouse';
    });
    window.addEventListener('mouseup', (e) => this._release('Mouse' + e.button));
    element.addEventListener('contextmenu', (e) => e.preventDefault()); // คลิกขวาไม่ให้เมนูเด้ง
    element.addEventListener('mousemove', (e) => {
      const r = element.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      // NDC = Normalized Device Coordinates (-1..1) ใช้กับ Raycaster ของ three.js
      this.mouse.ndcX = (this.mouse.x / r.width) * 2 - 1;
      this.mouse.ndcY = -(this.mouse.y / r.height) * 2 + 1;
      this.mouse.inside = true;
      this.mouse.moved = true;
      this.lastDevice = 'mouse';
    });
    element.addEventListener('mouseleave', () => (this.mouse.inside = false));

    // ถ้าสลับไปหน้าต่างอื่น ให้ปล่อยปุ่มทั้งหมด (กันตัวละครเดินค้าง)
    window.addEventListener('blur', () => {
      for (const code of this.down) this.released.add(code);
      this.down.clear();
    });
  }

  _press(code) {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }

  _release(code) {
    if (this.down.has(code)) this.released.add(code);
    this.down.delete(code);
  }

  isDown(action) {
    return BINDINGS[action].some((c) => this.down.has(c));
  }

  wasPressed(action) {
    return BINDINGS[action].some((c) => this.pressed.has(c));
  }

  wasReleased(action) {
    // ถือว่า "ปล่อย" เมื่อปุ่มที่ผูกไว้ถูกปล่อย และไม่มีปุ่มอื่นของ action เดียวกันกดค้างอยู่
    return BINDINGS[action].some((c) => this.released.has(c)) && !this.isDown(action);
  }

  /** เวกเตอร์ทิศทางจาก WASD ในพิกัด "หน้าจอ" (x ขวา, y ขึ้น) ยาวไม่เกิน 1 */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y += 1;
    if (this.isDown('down')) y -= 1;
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  /** เรียกตอนจบทุกเฟรม */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.moved = false;
  }

  /** ล้างทุกอย่าง (ใช้ตอนเปลี่ยนฉาก/เปิดเมนู) */
  reset() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }
}
