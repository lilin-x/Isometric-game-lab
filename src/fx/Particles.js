// =============================================================
//  Particles.js — ระบบอนุภาค (ประกายไฟ ฝุ่น ใบไม้ สปอร์ ...)
// -------------------------------------------------------------
//  เทคนิค: ใช้ InstancedMesh = วาดรูปทรงเดียวกันหลายร้อยชิ้น
//  ด้วย draw call เดียว แต่ละชิ้นมีตำแหน่ง/ขนาด/สีของตัวเอง
//
//  "Object pool": จองช่องไว้ล่วงหน้า (max) แล้วนำช่องที่ตายแล้วกลับมาใช้ใหม่
//  ไม่ต้องสร้าง/ทำลาย object ทุกเฟรม → เกมไม่กระตุก
// =============================================================

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Particles {
  /**
   * @param {THREE.Object3D} parent
   * @param {{max?:number, additive?:boolean, geometry?:THREE.BufferGeometry, lit?:boolean}} o
   */
  constructor(parent, o = {}) {
    this.max = o.max ?? 500;
    const geometry = o.geometry ?? new THREE.OctahedronGeometry(0.5, 0);
    const material = o.lit
      ? new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 })
      : new THREE.MeshBasicMaterial({
          transparent: !!o.additive,
          blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: !o.additive,
        });
    this.additive = !!o.additive;
    this.mesh = new THREE.InstancedMesh(geometry, material, this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // อนุภาคกระจายทั่วฉาก ไม่ต้องตัดทิ้ง
    this.mesh.castShadow = false;
    this.mesh.renderOrder = this.additive ? 6 : 0;
    this.mesh.userData.dynamic = true;
    parent.add(this.mesh);

    // ข้อมูลของแต่ละอนุภาค เก็บใน array ธรรมดา
    this.items = [];
    for (let i = 0; i < this.max; i++) {
      this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, sizeEnd: 0, gravity: 0, drag: 0, rx: 0, ry: 0, spin: 0, color: new THREE.Color(), floor: 0 });
      this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, _c.set(0xffffff));
    }
    this._next = 0;
  }

  /** ปล่อยอนุภาค 1 ชิ้น */
  spawn(o) {
    // หาช่องว่างถัดไปแบบวนรอบ (ring buffer)
    const p = this.items[this._next];
    this._next = (this._next + 1) % this.max;
    p.alive = true;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
    p.life = p.maxLife = o.life ?? 0.6;
    p.size = o.size ?? 0.2;
    p.sizeEnd = o.sizeEnd ?? 0;
    p.gravity = o.gravity ?? 0;
    p.drag = o.drag ?? 1.5;
    p.rx = Math.random() * 6; p.ry = Math.random() * 6;
    p.spin = o.spin ?? 6;
    p.floor = o.floor ?? -Infinity;
    p.color.set(o.color ?? 0xffffff);
  }

  /**
   * ปล่อยเป็นชุด (burst) กระจายรอบจุด
   * @param {{x,y,z,count?,speed?,up?,spread?,color?|colors?, ...}} o
   */
  burst(o) {
    const count = o.count ?? 10;
    for (let i = 0; i < count; i++) {
      const a = (o.dirAngle ?? Math.random() * Math.PI * 2) + (o.dirAngle !== undefined ? (Math.random() - 0.5) * (o.arc ?? 1) : 0);
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      this.spawn({
        x: o.x + (Math.random() - 0.5) * (o.spread ?? 0.2),
        y: o.y + (Math.random() - 0.5) * (o.spread ?? 0.2),
        z: o.z + (Math.random() - 0.5) * (o.spread ?? 0.2),
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: (o.up ?? 2) * (0.5 + Math.random()),
        life: (o.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        size: (o.size ?? 0.18) * (0.6 + Math.random() * 0.8),
        sizeEnd: o.sizeEnd ?? 0,
        gravity: o.gravity ?? 9,
        drag: o.drag,
        color: o.colors ? o.colors[Math.floor(Math.random() * o.colors.length)] : o.color,
        floor: o.floor ?? 0.02,
        spin: o.spin,
      });
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
        continue;
      }
      // ฟิสิกส์ง่ายๆ: แรงโน้มถ่วง + แรงต้าน (drag)
      p.vy -= p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;

      const t = 1 - p.life / p.maxLife; // 0 → 1 ตลอดอายุ
      const size = p.size + (p.sizeEnd - p.size) * t;
      _p.set(p.x, p.y, p.z);
      _q.setFromEuler(_e.set(p.rx, p.ry, 0));
      _s.setScalar(Math.max(0.0001, size));
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      // แบบ additive: สีมืดลง = จางลง
      if (this.additive) this.mesh.setColorAt(i, _c.copy(p.color).multiplyScalar(1 - t * t));
      else this.mesh.setColorAt(i, p.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.items[i].alive = false;
      this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
