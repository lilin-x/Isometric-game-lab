// =============================================================
//  WorldUI.js — UI ที่ "ลอยตามตำแหน่งในโลก 3D"
// -------------------------------------------------------------
//  เช่น ตัวเลข damage, หลอดเลือดมอนสเตอร์, วง loading เหนือหัว, ฟองคำพูด
//  หลักการ: ทุกเฟรม แปลงตำแหน่ง 3D → พิกเซลบนจอ (camera.project)
//  แล้วย้าย <div> ไปที่ตำแหน่งนั้นด้วย CSS transform
// =============================================================

import * as THREE from 'three';

export class WorldUI {
  constructor(container, isoCamera) {
    this.container = container;
    this.iso = isoCamera;
    this.items = new Set();
    this._screen = { x: 0, y: 0, visible: true };
  }

  /**
   * สร้าง element ที่ติดตามตำแหน่ง
   * @param {string} className
   * @param {string} html
   * @param {() => THREE.Vector3} getPos ฟังก์ชันคืนตำแหน่งในโลก (เรียกทุกเฟรม)
   * @param {number} [life] อายุ (วินาที) ถ้าไม่ใส่ = อยู่จนกว่าจะ remove()
   */
  attach(className, html, getPos, life = Infinity) {
    const el = document.createElement('div');
    el.className = `wui ${className}`;
    el.innerHTML = `<div class="inner">${html}</div>`;
    this.container.appendChild(el);
    const item = {
      el,
      inner: el.firstElementChild,
      getPos,
      life,
      visible: true,
      remove: () => {
        el.remove();
        this.items.delete(item);
      },
      setVisible: (v) => {
        item.visible = v;
        el.style.display = v ? '' : 'none';
      },
    };
    this.items.add(item);
    this._place(item);
    return item;
  }

  /** ตัวเลข damage เด้งขึ้นแล้วจางหาย */
  damageNumber(pos, amount, kind = 'light', extra = '') {
    const p = pos.clone();
    p.x += (Math.random() - 0.5) * 0.5;
    p.z += (Math.random() - 0.5) * 0.5;
    const html = kind === 'heavy' && extra ? `<small>${extra}</small>${amount}` : `${amount}`;
    return this.attach(`dmg ${kind}`, html, () => p, kind === 'heavy' ? 1.2 : 1.0);
  }

  /** ข้อความลอยสั้นๆ เช่น "เหนื่อย!", "+40" */
  floatText(pos, text, kind = 'info', life = 0.85) {
    const p = pos.clone();
    return this.attach(`dmg ${kind}`, text, () => p, life);
  }

  update(dt) {
    for (const item of [...this.items]) {
      item.life -= dt;
      if (item.life <= 0) {
        item.remove();
        continue;
      }
      if (item.visible) this._place(item);
    }
  }

  _place(item) {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const s = this.iso.worldToScreen(item.getPos(), w, h, this._screen);
    item.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    item.el.style.visibility = s.visible ? 'visible' : 'hidden';
  }

  clear() {
    for (const item of [...this.items]) item.remove();
  }
}

/** หลอดเลือดเล็กๆ เหนือหัวมอนสเตอร์ */
export function createEnemyBar(worldUI, getPos, big = false) {
  const item = worldUI.attach(`ehp${big ? ' big' : ''}`, '<i></i>', getPos);
  const fill = item.inner.querySelector('i');
  item.setVisible(false);
  return {
    set(ratio) {
      item.setVisible(true);
      fill.style.transform = `scaleX(${Math.max(0, ratio)})`;
    },
    hide: () => item.setVisible(false),
    remove: () => item.remove(),
  };
}

/** วง loading เหนือหัวผู้เล่นตอนหมดแรง */
export function createHeadLoader(worldUI, getPos) {
  const html = `
    <svg class="loader" viewBox="0 0 36 36">
      <circle class="track" cx="18" cy="18" r="14" />
      <circle class="progress" cx="18" cy="18" r="14" />
      <circle class="spin" cx="18" cy="18" r="9" />
    </svg>
    <span>หมดแรง…</span>`;
  const item = worldUI.attach('head-loader', html, getPos);
  const progress = item.inner.querySelector('.progress');
  item.setVisible(false);
  return {
    set(visible, ratio) {
      if (item.visible !== visible) item.setVisible(visible);
      if (visible) progress.style.strokeDashoffset = String(88 * (1 - ratio));
    },
    remove: () => item.remove(),
  };
}

export const tmpVec = new THREE.Vector3();
