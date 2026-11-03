// =============================================================
//  IsoCamera.js — กล้องมุมมอง Isometric
// -------------------------------------------------------------
//  Isometric = มองเฉียงลงมาจากมุมบน โดยแกน X, Y, Z ดูยาวเท่ากันบนจอ
//  สูตรคลาสสิก: วางกล้องที่ทิศ (1, 1, 1) ของเป้าหมาย แล้วหันมองเป้าหมาย
//     - หมุนรอบแกนตั้ง (yaw) = 45°
//     - ก้มลง (pitch)       = atan(1/√2) ≈ 35.264°
//
//  ใช้ OrthographicCamera (ไม่มี perspective) ของไกล-ใกล้จึงขนาดเท่ากัน
//  นี่คือหัวใจของ "ลุค" เกม isometric
// =============================================================

import * as THREE from 'three';
import { CONFIG } from '../config.js';

// ทิศ "บนจอ" และ "ขวาจอ" เมื่อแปลงเป็นทิศบนพื้นโลก (แกน XZ)
// กล้องอยู่ที่ทิศ (+1,+1,+1) และมองไปทาง (-1,-1,-1)
// → เดินขึ้นบนจอ = ไปทาง (-x, -z),  เดินไปขวาจอ = ไปทาง (+x, -z)
export const SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();
export const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();

export class IsoCamera {
  constructor(aspect) {
    this.viewSize = CONFIG.camera.viewSize;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(CONFIG.camera.distance);
    this.target = new THREE.Vector3(); // จุดที่กล้องมอง (ตามตัวละคร)
    this.shakeAmount = 0; // ความแรงการสั่นจอ (ลดลงเองตามเวลา)
    this.zoom = 1;
    this._shakeOffset = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.bounds = null; // {minX,maxX,minZ,maxZ} จำกัดขอบเขตกล้อง (ไม่บังคับ)
    this.resize(aspect);
  }

  resize(aspect) {
    // กล้อง orthographic กำหนด "กล่อง" ที่มองเห็น: ซ้าย ขวา บน ล่าง
    const h = this.viewSize / 2;
    const w = h * aspect;
    this.camera.left = -w;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  setZoom(z) {
    this.zoom = z;
    this.camera.zoom = z;
    this.camera.updateProjectionMatrix();
  }

  /** วางกล้องที่เป้าหมายทันที (ไม่ค่อยๆ เลื่อน) — ใช้ตอนเริ่มด่าน */
  snapTo(pos) {
    this.target.copy(pos);
    this._apply();
  }

  /** ค่อยๆ เลื่อนตามเป้าหมายแบบนุ่มนวล */
  follow(pos, dt) {
    // สูตร "exponential smoothing": ไม่ขึ้นกับ FPS เพราะใช้ dt
    const t = 1 - Math.exp(-CONFIG.camera.followSharpness * dt);
    this.target.lerp(pos, t);
    if (this.bounds) {
      this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.minX, this.bounds.maxX);
      this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.minZ, this.bounds.maxZ);
    }
  }

  /** เพิ่มการสั่นจอ (screen shake) */
  shake(amount) {
    this.shakeAmount = Math.min(1, this.shakeAmount + amount);
  }

  update(dt) {
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.2);
    const s = this.shakeAmount * this.shakeAmount * 0.6; // ยกกำลังสอง ให้สั่นแรงแค่ตอนต้น
    this._shakeOffset.set((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s * 0.6, (Math.random() * 2 - 1) * s);
    this._apply();
  }

  _apply() {
    this.camera.position.copy(this.target).add(this.offset).add(this._shakeOffset);
    this.camera.lookAt(this.target.x + this._shakeOffset.x, this.target.y + this._shakeOffset.y, this.target.z + this._shakeOffset.z);
  }

  /** แปลงตำแหน่งเมาส์ (NDC) → จุดบนพื้นโลกที่ความสูง y */
  screenToGround(ndcX, ndcY, y = 0, out = new THREE.Vector3()) {
    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    this._groundPlane.constant = -y;
    return this._raycaster.ray.intersectPlane(this._groundPlane, out) ?? out.copy(this.target);
  }

  /** แปลงจุดในโลก 3D → ตำแหน่งพิกเซลบนจอ (ใช้วาง UI ลอยเหนือหัว) */
  worldToScreen(pos, width, height, out = { x: 0, y: 0, visible: true }) {
    const v = _tmp.copy(pos).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * width;
    out.y = (-v.y * 0.5 + 0.5) * height;
    out.visible = v.z < 1 && v.x > -1.2 && v.x < 1.2 && v.y > -1.2 && v.y < 1.2;
    return out;
  }
}

const _tmp = new THREE.Vector3();
