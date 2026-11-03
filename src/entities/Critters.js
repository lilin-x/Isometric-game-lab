// =============================================================
//  Critters.js — สัตว์ตัวเล็กๆ ที่ทำให้ป่ามีชีวิต (ไม่ใช่ศัตรู)
//    • ผีเสื้อ: บินวนเป็นเส้นโค้ง กระพือปีก
//    • กระต่าย: กระโดดไปมา วิ่งหนีเมื่อผู้เล่นเข้าใกล้
// =============================================================

import * as THREE from 'three';
import { box, ico, cone, at, group, compactRig } from '../models/kit.js';

export class Butterfly {
  constructor(level, center, color, rng) {
    this.level = level;
    this.center = center.clone();
    this.root = new THREE.Group();
    const body = box(0.04, 0.04, 0.18, 0x2b2b30, { castShadow: false });
    this.wingL = new THREE.Group();
    this.wingR = new THREE.Group();
    this.wingL.add(at(box(0.22, 0.01, 0.2, color, { castShadow: false }), 0.11, 0, 0.02));
    this.wingL.add(at(box(0.15, 0.01, 0.13, color, { castShadow: false }), 0.08, 0, -0.12));
    this.wingR.add(at(box(0.22, 0.01, 0.2, color, { castShadow: false }), -0.11, 0, 0.02));
    this.wingR.add(at(box(0.15, 0.01, 0.13, color, { castShadow: false }), -0.08, 0, -0.12));
    this.root.add(body, this.wingL, this.wingR);
    this.root.scale.setScalar(1.3);
    level.root.add(this.root);
    this.t = rng() * 100;
    this.speed = rng.range(0.4, 0.7);
    this.r = rng.range(1.5, 3.5);
  }

  update(dt) {
    this.t += dt;
    const t = this.t * this.speed;
    // เส้นทางบินแบบ Lissajous (sin/cos ความถี่ต่างกัน) ดูสุ่มแต่ลื่นไหล
    const x = this.center.x + Math.sin(t) * this.r + Math.sin(t * 2.3) * 0.6;
    const z = this.center.z + Math.cos(t * 0.8) * this.r;
    const y = 0.9 + Math.sin(t * 3.1) * 0.35 + Math.sin(this.t * 9) * 0.05;
    const p = this.root.position;
    const dx = x - p.x;
    const dz = z - p.z;
    p.set(x, y, z);
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) this.root.rotation.y = Math.atan2(dx, dz);
    const flap = Math.sin(this.t * 22) * 0.9;
    this.wingL.rotation.z = flap;
    this.wingR.rotation.z = -flap;
  }
}

export class Rabbit {
  constructor(level, position, rng, color = 0xf4f0ea) {
    this.level = level;
    this.rng = rng;
    this.root = new THREE.Group();
    const b = new THREE.Group();
    b.add(at(ico(0.22, 0, color), 0, 0.22, 0, 0, 0, 0, [1, 0.9, 1.3]));
    b.add(at(ico(0.15, 0, color), 0, 0.38, 0.22));
    b.add(at(box(0.05, 0.22, 0.04, color), 0.05, 0.6, 0.18, -0.2, 0, 0.1));
    b.add(at(box(0.05, 0.22, 0.04, color), -0.05, 0.6, 0.18, -0.2, 0, -0.1));
    b.add(at(box(0.03, 0.03, 0.02, 0x2b1d14, { castShadow: false }), 0.07, 0.41, 0.35));
    b.add(at(box(0.03, 0.03, 0.02, 0x2b1d14, { castShadow: false }), -0.07, 0.41, 0.35));
    b.add(at(ico(0.07, 0, 0xffffff), 0, 0.25, -0.28));
    b.add(at(box(0.03, 0.02, 0.02, 0xff9fbf, { castShadow: false }), 0, 0.37, 0.37));
    this.body = b;
    this.root.add(b);
    compactRig(this.root);
    level.root.add(this.root);
    this.position = this.root.position;
    this.position.copy(position);
    this.home = position.clone();
    this.target = null;
    this.wait = rng() * 2;
    this.hop = 0;
    this.facing = 0;
  }

  update(dt) {
    if (dt <= 0) return;
    const p = this.level.player;
    // ผู้เล่นเข้าใกล้ → วิ่งหนี!
    if (p && p.position.distanceTo(this.position) < 3 && (!this.target || !this.fleeing)) {
      const away = this.position.clone().sub(p.position).setY(0).normalize().multiplyScalar(4);
      this.target = this.position.clone().add(away);
      this.fleeing = true;
      this.wait = 0;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      this.body.position.y = 0;
      return;
    }
    if (!this.target) {
      const a = this.rng() * Math.PI * 2;
      this.target = new THREE.Vector3(this.home.x + Math.cos(a) * 3, 0, this.home.z + Math.sin(a) * 3);
    }
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.2) {
      this.target = null;
      this.fleeing = false;
      this.wait = 1 + this.rng() * 3;
      return;
    }
    const speed = this.fleeing ? 4.5 : 1.8;
    this.position.x += (dx / d) * speed * dt;
    this.position.z += (dz / d) * speed * dt;
    this.level.collision.resolve(this.position, 0.2);
    this.facing = Math.atan2(dx, dz);
    this.root.rotation.y = this.facing;
    this.hop += dt * (this.fleeing ? 14 : 9);
    this.body.position.y = Math.abs(Math.sin(this.hop)) * 0.25;
  }
}
