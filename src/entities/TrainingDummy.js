// =============================================================
//  TrainingDummy.js — หุ่นฟางซ้อมฟัน (เลือดไม่มีวันหมด)
// -------------------------------------------------------------
//  เวลาโดนฟันจะ "โยก" ด้วยสปริง (damped spring):
//    ความเร่ง = -k × มุม  - c × ความเร็ว
//  สูตรนี้ใช้ทำของเด้งๆ ได้แทบทุกอย่างในเกม
// =============================================================

import * as THREE from 'three';
import { buildDummy } from '../models/town.js';
import { cloneMaterials } from '../models/kit.js';

const _v = new THREE.Vector3();

export class TrainingDummy {
  constructor(game, level, position, facing = 0) {
    this.game = game;
    this.isDummy = true;
    const { group, body } = buildDummy();
    this.root = group;
    this.body = body;
    this.materials = cloneMaterials(group);
    group.position.copy(position);
    group.rotation.y = facing;
    level.root.add(group);
    level.collision.addCircle(position.x, position.z, 0.35);
    this.position = group.position;
    this.radius = 0.45;
    this.hitHeight = 1.2;
    this.tiltX = 0;
    this.tiltZ = 0;
    this.velX = 0;
    this.velZ = 0;
    this.flash = 0;
    this.totalDamage = 0;
  }

  takeHit({ damage, dir, heavy, charge }) {
    // ผลักให้โยกไปทางทิศที่โดนฟัน
    const local = _v.copy(dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.root.rotation.y);
    const power = heavy ? 7 + charge * 5 : 4;
    this.velX += local.z * power;
    this.velZ -= local.x * power;
    this.flash = 1;
    this.totalDamage += damage;
    const label = heavy ? (charge >= 1 ? 'ชาร์จเต็ม!' : 'ชาร์จ') : '';
    this.game.worldUI.damageNumber(_v.copy(this.position).setY(2.3), damage, heavy ? 'heavy' : 'light', label);
    this.game.audio.play('dummyHit');
    this.game.fx.debris.burst({ x: this.position.x, y: 1.3, z: this.position.z, count: heavy ? 14 : 6, speed: 3, up: 2.5, colors: [0xe8c66a, 0xd9b45a, 0xb8923f], size: 0.1, life: 0.9, gravity: 7 });
    return damage;
  }

  update(dt) {
    if (dt <= 0) return;
    // damped spring: ดึงกลับเข้าตรงกลาง + หน่วงให้หยุดในที่สุด
    const k = 60;
    const c = 6;
    this.velX += (-k * this.tiltX - c * this.velX) * dt;
    this.velZ += (-k * this.tiltZ - c * this.velZ) * dt;
    this.tiltX += this.velX * dt;
    this.tiltZ += this.velZ * dt;
    this.body.rotation.x = this.tiltX * 0.12;
    this.body.rotation.z = this.tiltZ * 0.12;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 7);
      for (const m of this.materials) m.emissive.setScalar(this.flash * 0.7);
    }
  }
}
