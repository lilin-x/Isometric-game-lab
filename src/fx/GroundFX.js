// =============================================================
//  GroundFX.js — เอฟเฟกต์บนพื้น + รอยดาบ
// -------------------------------------------------------------
//   • Shockwave  วงคลื่นขยายออก (ตอนฟันแรง / golem ทุบพื้น)
//   • Telegraph  วงเตือนสีแดงก่อนมอนสเตอร์โจมตี — "บอกล่วงหน้า"
//                ให้ผู้เล่นมีเวลาหลบ เป็นหลักออกแบบเกมที่สำคัญมาก
//   • ArcRing    วงแหวนที่ค่อยๆ เติมเต็ม (แสดงการชาร์จดาบ)
//   • SwordTrail แถบแสงตามปลายดาบ ทำให้การฟันดูเร็วและแรง
// =============================================================

import * as THREE from 'three';

const FLAT = -Math.PI / 2; // หมุนรูปทรง 2D ให้นอนราบกับพื้น

function additiveMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// ---------- Shockwave ----------
const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
ringGeo.userData.shared = true;

export class GroundFX {
  constructor(parent) {
    this.parent = parent;
    this.items = [];
  }

  shockwave({ x, z, y = 0.06, color = 0xffd27a, from = 0.3, to = 3, life = 0.4, opacity = 0.9 }) {
    const m = new THREE.Mesh(ringGeo, additiveMat(color, opacity));
    m.rotation.x = FLAT;
    m.position.set(x, y, z);
    m.renderOrder = 6;
    this.parent.add(m);
    this.items.push({ mesh: m, t: 0, life, from, to, opacity });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      const ease = 1 - (1 - k) * (1 - k); // ease-out: เร็วตอนแรกแล้วช้าลง
      it.mesh.scale.setScalar(it.from + (it.to - it.from) * ease);
      it.mesh.material.opacity = it.opacity * (1 - k);
      if (k >= 1) {
        it.mesh.material.dispose();
        this.parent.remove(it.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      it.mesh.material.dispose();
      this.parent.remove(it.mesh);
    }
    this.items.length = 0;
  }
}

// ---------- Telegraph (วงเตือนก่อนโจมตี) ----------
const discGeo = new THREE.CircleGeometry(1, 40);
const outlineGeo = new THREE.RingGeometry(0.93, 1, 48);
discGeo.userData.shared = true;
outlineGeo.userData.shared = true;

export class Telegraph {
  constructor(parent, radius, color = 0xff4a3d) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.radius = radius;
    this.outline = new THREE.Mesh(outlineGeo, additiveMat(color, 0.9));
    this.fill = new THREE.Mesh(discGeo, additiveMat(color, 0.35));
    this.back = new THREE.Mesh(discGeo, additiveMat(color, 0.12));
    for (const m of [this.outline, this.fill, this.back]) {
      m.rotation.x = FLAT;
      m.renderOrder = 6;
      this.group.add(m);
    }
    this.outline.position.y = 0.07;
    this.fill.position.y = 0.065;
    this.back.position.y = 0.06;
    parent.add(this.group);
  }

  /** progress 0..1 = เวลาที่เหลือก่อนโจมตี (เต็มวง = โดนแล้ว!) */
  show(x, z, progress) {
    this.group.visible = true;
    this.group.position.set(x, 0, z);
    this.outline.scale.setScalar(this.radius);
    this.back.scale.setScalar(this.radius);
    this.fill.scale.setScalar(Math.max(0.01, this.radius * progress));
    // กระพริบเร็วขึ้นตอนใกล้โจมตี
    this.outline.material.opacity = 0.6 + 0.4 * Math.sin(progress * progress * 40);
  }

  hide() {
    this.group.visible = false;
  }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const m of [this.outline, this.fill, this.back]) m.material.dispose();
  }
}

// ---------- ArcRing (วงชาร์จ) ----------
export class ArcRing {
  constructor(parent, { inner = 0.75, outer = 0.95, color = 0xffd36b } = {}) {
    this.inner = inner;
    this.outer = outer;
    this.material = additiveMat(color, 0.9);
    this.baseMesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48), additiveMat(color, 0.15));
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48, 1, 0, 0.01), this.material);
    this.group = new THREE.Group();
    for (const m of [this.baseMesh, this.mesh]) {
      m.rotation.x = FLAT;
      m.renderOrder = 6;
      this.group.add(m);
    }
    this.mesh.position.y = 0.075;
    this.baseMesh.position.y = 0.07;
    this.group.visible = false;
    this._progress = -1;
    parent.add(this.group);
  }

  set(progress) {
    this.group.visible = progress > 0;
    if (Math.abs(progress - this._progress) < 0.01) return;
    this._progress = progress;
    // สร้างรูปทรงวงแหวนใหม่ให้ยาวตามเปอร์เซ็นต์ (thetaLength)
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.RingGeometry(this.inner, this.outer, 48, 1, Math.PI / 2, -Math.PI * 2 * Math.max(0.01, progress));
  }

  setColor(color) {
    this.material.color.set(color);
  }
}

// ---------- SwordTrail (รอยดาบ) ----------
export class SwordTrail {
  constructor(parent, color = 0xbfe8ff, maxPoints = 24, life = 0.16) {
    this.maxPoints = maxPoints;
    this.life = life;
    this.points = [];
    this.active = false;
    this.color = new THREE.Color(color);

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxPoints * 2 * 3);
    this.colors = new Float32Array(maxPoints * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.userData.dynamic = true;
    parent.add(this.mesh);
  }

  /** เพิ่มจุดใหม่ (ฐานดาบ, ปลายดาบ) ในพิกัดโลก */
  push(base, tip) {
    if (!this.active) return;
    this.points.unshift({ base: base.clone(), tip: tip.clone(), age: 0 });
    if (this.points.length > this.maxPoints) this.points.pop();
  }

  update(dt) {
    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points[this.points.length - 1].age > this.life) this.points.pop();
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const p = this.points[i];
      const k = 1 - p.age / this.life; // 1 = ใหม่, 0 = เก่า
      // ฝั่งฐานดาบให้จางกว่าปลายดาบ
      this.positions.set([p.base.x, p.base.y, p.base.z], i * 6);
      this.positions.set([p.tip.x, p.tip.y, p.tip.z], i * 6 + 3);
      const cb = k * 0.25, ct = k * k;
      this.colors.set([this.color.r * cb, this.color.g * cb, this.color.b * cb], i * 6);
      this.colors.set([this.color.r * ct, this.color.g * ct, this.color.b * ct], i * 6 + 3);
    }
    this.mesh.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  setColor(c) {
    this.color.set(c);
  }
}
