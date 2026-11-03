// =============================================================
//  monsters.js — โมเดลมอนสเตอร์ 3 ชนิด
// -------------------------------------------------------------
//  ออกแบบให้ "อ่านง่ายในพริบตา" (readability):
//    สไลม์  = ก้อนกลมสีเขียว ตัวเล็ก   → อ่อนแอ กระโดดพุ่งใส่
//    เห็ด    = หมวกแดงจุดขาว ตัวกลาง   → ปล่อยสปอร์รอบตัว
//    โกเลม  = หินก้อนใหญ่ ตาเรืองแสง  → ช้า แข็ง ทุบแรง
//  ขนาดและรูปร่างบอกความอันตรายได้ก่อนจะสู้ด้วยซ้ำ
// =============================================================

import * as THREE from 'three';
import { box, cyl, cone, ico, at, mat, glowMat, meshOf, jitter } from './kit.js';

function eyes(parent, { x = 0.12, y = 0, z = 0.3, w = 0.08, h = 0.13, angry = false, color = 0x1d1b2a } = {}) {
  for (const s of [1, -1]) {
    parent.add(at(box(w, h, 0.04, color, { castShadow: false }), s * x, y, z));
    parent.add(at(box(w * 0.4, w * 0.4, 0.03, 0xffffff, { castShadow: false }), s * x + w * 0.2, y + h * 0.25, z + 0.02));
    if (angry) parent.add(at(box(w * 1.6, 0.035, 0.04, color, { castShadow: false }), s * x, y + h * 0.75, z + 0.01, 0, 0, s * -0.45));
  }
}

/** สไลม์: ตัวกลมๆ หยุ่นๆ (ปรับ scale เพื่อทำ squash & stretch) */
export function buildSlime(rng, color = 0x5fd08a) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // จุดหมุนอยู่ที่ฐาน → บีบ/ยืดแล้วไม่ลอย
  root.add(body);
  const darker = new THREE.Color(color).multiplyScalar(0.75).getHex();
  const geo = jitter(new THREE.IcosahedronGeometry(0.5, 1), 0.05, rng);
  body.add(at(meshOf(geo, mat(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.12 })), 0, 0.42, 0, 0, 0, 0, [1, 0.82, 1]));
  body.add(at(ico(0.42, 0, darker), 0, 0.2, 0, 0, 0, 0, [1.15, 0.45, 1.15]));
  body.add(at(ico(0.12, 0, 0xeafff0, { castShadow: false }), -0.18, 0.66, 0.18, 0, 0, 0, [1, 0.6, 1]));
  eyes(body, { x: 0.13, y: 0.45, z: 0.44, w: 0.09, h: 0.14 });
  body.add(at(box(0.12, 0.04, 0.04, 0x1d1b2a, { castShadow: false }), 0, 0.3, 0.45));
  // ใบไม้งอกบนหัว
  body.add(at(cyl(0.02, 0.02, 0.16, 4, 0x4f8a3a), 0, 0.85, 0));
  body.add(at(cone(0.09, 0.22, 3, 0x6fb352), 0.08, 0.95, 0, 0, 0, -1.0, [1, 1, 0.35]));
  return { root, body, height: 1.1 };
}

/** เห็ดเดินได้ */
export function buildMushroomMonster(rng) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // ขา
  const legL = at(box(0.14, 0.2, 0.2, 0x8a6a4a), 0.14, 0.1, 0);
  const legR = at(box(0.14, 0.2, 0.2, 0x8a6a4a), -0.14, 0.1, 0);
  body.add(legL, legR);
  // ลำต้น (มีหน้า)
  const stem = new THREE.Group();
  stem.position.y = 0.2;
  body.add(stem);
  stem.add(at(cyl(0.3, 0.36, 0.62, 8, 0xf0e2c0), 0, 0.31, 0));
  eyes(stem, { x: 0.12, y: 0.4, z: 0.3, w: 0.08, h: 0.12, angry: true });
  stem.add(at(box(0.14, 0.05, 0.04, 0x6a2a2a, { castShadow: false }), 0, 0.22, 0.33));
  // แขนเล็กๆ
  stem.add(at(cone(0.07, 0.25, 4, 0xf0e2c0), 0.36, 0.3, 0, 0, 0, -2.2));
  stem.add(at(cone(0.07, 0.25, 4, 0xf0e2c0), -0.36, 0.3, 0, 0, 0, 2.2));
  // หมวกเห็ด
  const cap = new THREE.Group();
  cap.position.y = 0.62;
  stem.add(cap);
  const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd64545));
  capMesh.castShadow = true;
  cap.add(at(capMesh, 0, 0, 0, 0, 0, 0, [1, 0.8, 1]));
  cap.add(at(cyl(0.6, 0.55, 0.08, 9, 0xb83535), 0, 0.0, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.36;
    const y = i === 0 ? 0.48 : 0.34;
    cap.add(at(ico(0.09, 0, 0xfff6e8, { castShadow: false }), Math.cos(a) * r, y, Math.sin(a) * r, 0, 0, 0, [1, 0.45, 1]));
  }
  return { root, body, cap, stem, legL, legR, height: 1.5 };
}

/** โกเลมหิน */
export function buildGolem(rng) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const stone = [0x8a8f99, 0x7c818b, 0x969ba4];
  const rockGeo = (r) => jitter(new THREE.DodecahedronGeometry(r, 0), r * 0.18, rng);
  // ขา
  const legL = at(meshOf(rockGeo(0.32), stone[1]), 0.42, 0.3, 0, 0, 0, 0, [1, 1.1, 1]);
  const legR = at(meshOf(rockGeo(0.32), stone[1]), -0.42, 0.3, 0, 0, 0, 0, [1, 1.1, 1]);
  body.add(legL, legR);
  // ลำตัว
  const torso = new THREE.Group();
  torso.position.y = 1.2;
  body.add(torso);
  torso.add(at(meshOf(rockGeo(0.85), stone[0]), 0, 0, 0, 0, 0, 0, [1.15, 0.95, 0.9]));
  torso.add(at(meshOf(jitter(new THREE.IcosahedronGeometry(0.75, 0), 0.12, rng), 0x5f9e45), 0, 0.55, -0.05, 0, 0, 0, [1.25, 0.35, 1.0]));
  // คริสตัลบนหลัง
  const crystalMat = glowMat(0x5fe3ff, 1.8);
  torso.add(at(meshOf(new THREE.OctahedronGeometry(0.2, 0), crystalMat), 0.3, 0.7, -0.4, 0.3, 0, 0.3, [1, 2, 1]));
  torso.add(at(meshOf(new THREE.OctahedronGeometry(0.15, 0), crystalMat), -0.25, 0.65, -0.5, -0.3, 0, -0.4, [1, 2, 1]));
  // หัว + ตาเรืองแสง
  const head = new THREE.Group();
  head.position.set(0, 0.75, 0.35);
  torso.add(head);
  head.add(at(meshOf(rockGeo(0.38), stone[2]), 0, 0, 0, 0, 0, 0, [1.1, 0.85, 1]));
  const eyeMat = glowMat(0x5fe3ff, 3);
  head.add(at(box(0.12, 0.08, 0.05, eyeMat, { castShadow: false }), 0.13, 0.02, 0.33));
  head.add(at(box(0.12, 0.08, 0.05, eyeMat, { castShadow: false }), -0.13, 0.02, 0.33));
  // แขน (หมุนที่ไหล่)
  const makeArm = (s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 1.0, 0.25, 0);
    arm.add(at(meshOf(rockGeo(0.3), stone[1]), 0, -0.25, 0));
    arm.add(at(meshOf(rockGeo(0.45), stone[0]), 0, -0.8, 0.05));
    return arm;
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);
  torso.add(armL, armR);
  return { root, body, torso, head, armL, armR, legL, legR, eyeMat, height: 2.5 };
}
