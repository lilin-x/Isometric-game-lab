// =============================================================
//  Scarf.js — หางผ้าพันคอที่ปลิวตามการเคลื่อนไหว (Verlet rope)
// -------------------------------------------------------------
//  แทนผ้าด้วย "จุด" หลายจุดต่อกันเป็นเชือก แต่ละเฟรม:
//   1) ขยับแต่ละจุดตามความเร็วเดิม (= ตำแหน่งตอนนี้ - ตำแหน่งเฟรมก่อน)
//      + แรงโน้มถ่วง + ลม       ← นี่คือ "Verlet integration"
//   2) ตรึงจุดแรกไว้ที่คอ
//   3) ดึงจุดที่อยู่ติดกันให้ห่างกันเท่าเดิม (constraint) ทำซ้ำหลายรอบ
//  ผลลัพธ์: วิ่งไปทางไหน ผ้าก็ลากตามมาเองโดยไม่ต้องทำแอนิเมชันเลย!
// =============================================================

import * as THREE from 'three';
import { addSilhouette } from '../models/kit.js';

const _a = new THREE.Vector3();
const _right = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class Scarf {
  /**
   * @param {THREE.Object3D} parent  ที่วาง mesh (ฉากของด่าน — พิกัดโลก)
   * @param {THREE.Object3D} anchor  จุดยึดบนตัวละคร
   * @param {THREE.Material} material
   */
  constructor(parent, anchor, material, { segments = 5, segLen = 0.15, width = 0.13, offsetX = 0 } = {}) {
    this.anchor = anchor;
    this.segLen = segLen;
    this.offsetX = offsetX;
    this.points = [];
    this.prev = [];
    this.meshes = [];
    anchor.updateWorldMatrix(true, false);
    const start = anchor.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i <= segments; i++) {
      this.points.push(start.clone().add(new THREE.Vector3(0, -i * segLen, -i * 0.02)));
      this.prev.push(this.points[i].clone());
    }
    for (let i = 0; i < segments; i++) {
      // ปลายผ้าค่อยๆ เรียวลง
      const wScale = 1 - (i / segments) * 0.35;
      const geo = new THREE.BoxGeometry(width * wScale, 0.03, segLen * 1.08);
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true;
      m.matrixAutoUpdate = false;
      parent.add(m);
      this.meshes.push(m);
    }
    for (const m of this.meshes) addSilhouette(m);
    this.time = Math.random() * 10;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} bodyCenter ตำแหน่งตัวละคร (กันผ้าทะลุตัว)
   * @param {number} facing มุมที่ตัวละครหัน (เรเดียน)
   */
  update(dt, bodyCenter, facing) {
    if (dt <= 0) return this._draw(facing);
    this.time += dt;
    const pts = this.points;
    const prev = this.prev;

    // แรงภายนอก: แรงโน้มถ่วงเบาๆ + ลมพัดไปข้างหลังและส่ายเล็กน้อย
    const backX = -Math.sin(facing);
    const backZ = -Math.cos(facing);
    const sway = Math.sin(this.time * 2.3) * 1.2 + Math.sin(this.time * 5.1) * 0.5;
    const gx = backX * 2.2 + Math.cos(facing) * sway;
    const gy = -6.5;
    const gz = backZ * 2.2 - Math.sin(facing) * sway;
    const damping = Math.pow(0.9, dt * 60);
    const dt2 = dt * dt;

    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - prev[i].x) * damping;
      const vy = (p.y - prev[i].y) * damping;
      const vz = (p.z - prev[i].z) * damping;
      prev[i].copy(p);
      p.x += vx + gx * dt2;
      p.y += vy + gy * dt2;
      p.z += vz + gz * dt2;
    }

    // ตรึงจุดแรก + บังคับระยะห่าง (ทำหลายรอบให้นิ่ง)
    this.anchor.getWorldPosition(pts[0]);
    _right.set(Math.cos(facing), 0, -Math.sin(facing));
    pts[0].addScaledVector(_right, this.offsetX);
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        _a.subVectors(b, a);
        const len = _a.length() || 0.0001;
        b.copy(a).addScaledVector(_a, this.segLen / len);
      }
      // กันผ้าจมเข้าไปในตัว: ดันจุดออกจากแกนกลางลำตัว
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const dx = p.x - bodyCenter.x;
        const dz = p.z - bodyCenter.z;
        const d = Math.hypot(dx, dz);
        const minR = 0.27;
        if (p.y > bodyCenter.y + 0.25 && d < minR) {
          const k = (minR - d) / (d || 0.0001);
          p.x += dx * k;
          p.z += dz * k;
        }
        if (p.y < 0.05) p.y = 0.05; // ไม่จมพื้น
      }
    }
    this._draw(facing);
  }

  /** วาง mesh แต่ละชิ้นระหว่างจุด i กับ i+1 และหันให้ถูก */
  _draw(facing) {
    _right.set(Math.cos(facing), 0, -Math.sin(facing));
    for (let i = 0; i < this.meshes.length; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      _z.subVectors(b, a).normalize();
      // Gram-Schmidt: ให้ด้านกว้างของผ้าหันไปทางซ้าย-ขวาของตัวละครเสมอ
      _x.copy(_right).addScaledVector(_z, -_right.dot(_z)).normalize();
      _y.crossVectors(_z, _x);
      _m.makeBasis(_x, _y, _z);
      _m.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      this.meshes[i].matrix.copy(_m);
      this.meshes[i].matrixWorldNeedsUpdate = true;
    }
  }

  /** ย้ายทั้งเส้นไปที่จุดยึดทันที (ใช้ตอน spawn/วาร์ป) */
  snap() {
    const start = this.anchor.getWorldPosition(new THREE.Vector3());
    this.points.forEach((p, i) => {
      p.copy(start).y -= i * this.segLen;
      this.prev[i].copy(p);
    });
  }

  setVisible(v) {
    for (const m of this.meshes) m.visible = v;
  }

  dispose() {
    for (const m of this.meshes) {
      m.parent?.remove(m);
      m.geometry.dispose();
    }
  }
}
