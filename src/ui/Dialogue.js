// =============================================================
//  Dialogue.js — กล่องบทสนทนาแบบพิมพ์ทีละตัวอักษร (typewriter)
// =============================================================

export class Dialogue {
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('dialogue');
    this.nameEl = this.el.querySelector('.name');
    this.textEl = this.el.querySelector('.text');
    this.isOpen = false;
    this.lines = [];
    this.index = 0;
    this.shown = 0; // พิมพ์ไปแล้วกี่ตัวอักษร
    this.speed = 45; // ตัวอักษรต่อวินาที
    this.onClose = null;
    this._clicked = false;
    this.el.addEventListener('mousedown', () => (this._clicked = true));
  }

  open(name, lines, onClose) {
    this.isOpen = true;
    this.nameEl.textContent = name;
    this.lines = lines;
    this.index = 0;
    this.shown = 0;
    this.onClose = onClose ?? null;
    this.el.classList.remove('hidden');
    this._render();
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  update(dt, input) {
    if (!this.isOpen) return;
    const line = this.lines[this.index];
    // ใช้ Array.from เพื่อนับตัวอักษรไทย/emoji ให้ถูก
    const chars = Array.from(line);
    if (this.shown < chars.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(chars.length, this.shown + this.speed * dt);
      if (Math.floor(this.shown) !== before && before % 3 === 0) this.audio.play('talk', { minGap: 0.05 });
      this._render();
    }

    const advance = input.wasPressed('interact') || input.wasPressed('light') || this._clicked;
    this._clicked = false;
    if (input.wasPressed('pause')) return this.close();
    if (!advance) return;

    if (this.shown < chars.length) {
      this.shown = chars.length; // กดระหว่างพิมพ์ = แสดงทั้งบรรทัดทันที
      this._render();
    } else if (this.index < this.lines.length - 1) {
      this.index++;
      this.shown = 0;
      this.audio.play('ui');
      this._render();
    } else {
      this.close();
    }
  }

  _render() {
    const chars = Array.from(this.lines[this.index]);
    this.textEl.textContent = chars.slice(0, Math.floor(this.shown)).join('');
  }
}
