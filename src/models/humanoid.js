// =============================================================
//  humanoid.js — สร้างตัวละครคนแบบ low poly ด้วยโค้ด
// -------------------------------------------------------------
//  ใช้ฟังก์ชันเดียวสร้างได้ทั้ง "ไค" (ตัวเอก) และ NPC ทุกคน
//  แค่เปลี่ยนตัวเลือก (สีเสื้อ ทรงผม หมวก หนวด ผ้ากันเปื้อน ...)
//
//  โครงสร้าง (hierarchy) แบบ "หุ่นมีข้อต่อ": ลูกจะขยับตามพ่อเสมอ
//
//   root ─ roll ─ body ─ hips ┬ legL / legR
//                             └ torso ┬ neck ─ head (ผม หมวก ตา)
//                                     ├ shoulderL ─ handL
//                                     └ shoulderR ─ handR ─ wristR (ถือของ)
//
//  การทำแอนิเมชัน = หมุน "ข้อต่อ" เหล่านี้ด้วยโค้ด (procedural animation)
//  เช่น เดิน = แกว่ง legL/legR ด้วย Math.sin(เวลา)
// =============================================================

import * as THREE from 'three';
import { box, cyl, cone, ico, sphere, at, group, mat } from './kit.js';

export const SKIN_TONES = [0xf2c9a0, 0xe0ac7e, 0xc68863, 0x8d5a3b, 0xf6d7b8];

/**
 * @param {object} o ตัวเลือก
 * @returns {{root:THREE.Group, joints:object, height:number}}
 */
export function buildHumanoid(o = {}) {
  const s = o.scale ?? 1; // ขนาดรวม (เด็ก ~0.85, ผู้ใหญ่ ~1.1)
  const w = o.width ?? 1; // ความอ้วน
  const skin = o.skin ?? SKIN_TONES[0];
  const shirt = o.shirt ?? 0x3b5f8f;
  const shirtDark = o.shirtDark ?? new THREE.Color(shirt).multiplyScalar(0.8).getHex();
  const sleeve = o.sleeve ?? shirt;
  const pants = o.pants ?? 0x6e5a45;
  const boots = o.boots ?? 0x5a3a24;
  const hair = o.hair ?? 0x6b4226;

  const legLen = 0.6;
  const torsoH = 0.42;
  const armLen = 0.4;

  const root = new THREE.Group();
  const roll = at(new THREE.Group(), 0, 0.55, 0); // จุดหมุนตอนกลิ้ง (กลางลำตัว)
  const body = at(new THREE.Group(), 0, -0.55, 0);
  const hips = at(new THREE.Group(), 0, legLen, 0);
  root.add(roll);
  roll.add(body);
  body.add(hips);

  // ---------- ขา ----------
  const makeLeg = (side) => {
    const leg = at(new THREE.Group(), side * 0.11 * w, 0, 0);
    leg.add(at(box(0.15 * w, legLen - 0.14, 0.16, pants), 0, -(legLen - 0.14) / 2, 0));
    leg.add(at(box(0.17 * w, 0.17, 0.25, boots), 0, -legLen + 0.105, 0.03));
    if (o.bootCuff) leg.add(at(box(0.19 * w, 0.06, 0.2, o.bootCuff), 0, -legLen + 0.2, 0.01));
    return leg;
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);
  hips.add(legL, legR);

  // ---------- ลำตัว ----------
  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(at(cyl(0.22 * w, 0.26 * w, torsoH, 8, shirt), 0, torsoH / 2, 0));
  // ชายเสื้อบานออก (ทูนิก/กระโปรง)
  const skirtLen = o.skirt ?? 0.2;
  torso.add(at(cyl(0.265 * w, 0.31 * w + skirtLen * 0.2, skirtLen, 8, shirtDark), 0, 0.03 - skirtLen / 2 + 0.1, 0));
  if (o.belt !== false) {
    torso.add(at(cyl(0.255 * w, 0.255 * w, 0.06, 8, o.belt ?? 0x4a2f1f), 0, 0.12, 0));
    if (o.buckle) torso.add(at(box(0.07, 0.06, 0.03, o.buckle, { castShadow: false }), 0, 0.12, 0.25 * w));
  }
  if (o.apron) torso.add(at(box(0.3 * w, 0.42, 0.03, o.apron), 0, 0.12, 0.25 * w + 0.01, -0.08, 0, 0));
  if (o.vest) {
    torso.add(at(box(0.08, torsoH * 0.9, 0.03, o.vest), 0.1 * w, torsoH * 0.5, 0.21 * w, -0.1, 0, 0));
    torso.add(at(box(0.08, torsoH * 0.9, 0.03, o.vest), -0.1 * w, torsoH * 0.5, 0.21 * w, -0.1, 0, 0));
  }

  // ---------- คอ + หัว ----------
  const neck = at(new THREE.Group(), 0, torsoH, 0);
  torso.add(neck);
  neck.add(at(cyl(0.08, 0.09, 0.1, 6, skin), 0, 0.04, 0));
  const head = at(new THREE.Group(), 0, 0.26, 0);
  neck.add(head);
  const headMesh = at(ico(0.27, 1, skin), 0, 0, 0, 0, 0, 0, [1, 0.95, 0.96]);
  head.add(headMesh);
  // หู
  head.add(at(box(0.06, 0.1, 0.06, skin), 0.27, -0.01, 0));
  head.add(at(box(0.06, 0.1, 0.06, skin), -0.27, -0.01, 0));
  // ตา (สี่เหลี่ยมดำ + จุดไฮไลต์ขาว) — ตาโตๆ ทำให้ดูน่ารักแบบ chibi
  const eyeMat = mat(0x2b1d14, { roughness: 0.4 });
  for (const side of [1, -1]) {
    head.add(at(box(0.065, o.eyeH ?? 0.1, 0.03, eyeMat, { castShadow: false }), side * 0.1, -0.065, 0.24));
    head.add(at(box(0.022, 0.022, 0.02, 0xffffff, { castShadow: false }), side * 0.1 + 0.014, -0.035, 0.255));
    if (o.blush !== false) head.add(at(box(0.07, 0.025, 0.02, 0xf2a08a, { castShadow: false }), side * 0.16, -0.14, 0.2));
    head.add(at(box(0.08, 0.02, 0.02, o.brow ?? hair, { castShadow: false }), side * 0.1, 0.03, 0.25, 0, 0, side * (o.browTilt ?? 0.08)));
  }
  if (o.beard) {
    head.add(at(box(0.36, 0.16, 0.12, o.beard), 0, -0.17, 0.17));
    head.add(at(cone(0.13, 0.22, 4, o.beard), 0, -0.3, 0.16, Math.PI, Math.PI / 4, 0));
  }
  if (o.mustache) head.add(at(box(0.18, 0.04, 0.04, o.mustache), 0, -0.08, 0.255));
  buildHair(head, o.hairStyle ?? 'short', hair);
  if (o.hat) buildHat(head, o.hat, o.hatColor ?? 0x5b3d8f, o.hatColor2 ?? 0xe8c25a);

  // ---------- แขน ----------
  const makeArm = (side) => {
    const shoulder = at(new THREE.Group(), side * 0.27 * w, torsoH - 0.07, 0);
    // ลำดับการหมุน YXZ: ยกแขน (X) ก่อนแล้วค่อยเหวี่ยงซ้ายขวา (Y)
    shoulder.rotation.order = 'YXZ';
    shoulder.add(at(ico(0.085, 0, sleeve), 0, -0.02, 0));
    shoulder.add(at(cyl(0.07, 0.062, armLen * 0.78, 6, sleeve), 0, -armLen * 0.39, 0));
    if (o.bracer) shoulder.add(at(cyl(0.072, 0.07, 0.1, 6, o.bracer), 0, -armLen * 0.72, 0));
    const hand = at(new THREE.Group(), 0, -armLen, 0);
    hand.add(at(ico(0.075, 0, skin), 0, 0, 0));
    shoulder.add(hand);
    return { shoulder, hand };
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);
  torso.add(armL.shoulder, armR.shoulder);
  const wristR = new THREE.Group();
  armR.hand.add(wristR);
  const wristL = new THREE.Group();
  armL.hand.add(wristL);

  root.scale.setScalar(s);

  return {
    root,
    height: 1.55 * s,
    joints: { roll, body, hips, legL, legR, torso, neck, head, shoulderL: armL.shoulder, shoulderR: armR.shoulder, handL: armL.hand, handR: armR.hand, wristR, wristL },
    headMesh,
  };
}

// ---------- ทรงผม ----------
function buildHair(head, style, color) {
  if (style === 'bald') return;
  // ผมส่วนบน (ครึ่งทรงกลม)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(color));
  cap.castShadow = true;
  head.add(at(cap, 0, 0.07, -0.02, -0.25, 0, 0, [1.05, 1.0, 1.08]));
  // ผมด้านหลัง
  head.add(at(box(0.5, 0.28, 0.16, color), 0, -0.02, -0.17));

  if (style === 'messy') {
    // ผมหน้าม้าชี้ๆ + ปอยผมชี้ขึ้น — เอกลักษณ์ของไค
    // [x, y, z, หมุนแกน X, หมุนแกน Z] — กรวยชี้ไปข้างหน้าเฉียงลงเล็กน้อย (1.57 = ชี้ตรงไปหน้า)
    const tufts = [
      [-0.12, 0.2, 0.15, 1.9, -0.25],
      [0.0, 0.22, 0.16, 1.95, 0.0],
      [0.12, 0.2, 0.15, 1.9, 0.25],
      [0.22, 0.08, 0.1, 2.3, 0.5],
      [-0.22, 0.08, 0.1, 2.3, -0.5],
    ];
    for (const [x, y, z, rx, rz] of tufts) head.add(at(cone(0.08, 0.15, 4, color), x, y, z, rx, 0, rz));
    head.add(at(cone(0.08, 0.26, 4, color), 0.03, 0.31, -0.02, -0.5, 0, -0.2));
    head.add(at(cone(0.07, 0.22, 4, color), -0.1, 0.27, -0.08, -0.9, 0, 0.4));
    head.add(at(cone(0.08, 0.22, 4, color), 0.12, 0.2, -0.2, -1.6, 0, -0.3));
  } else if (style === 'long') {
    head.add(at(box(0.52, 0.5, 0.18, color), 0, -0.17, -0.15));
    head.add(at(box(0.1, 0.4, 0.14, color), 0.25, -0.12, 0.02));
    head.add(at(box(0.1, 0.4, 0.14, color), -0.25, -0.12, 0.02));
  } else if (style === 'bun') {
    head.add(at(ico(0.13, 0, color), 0, 0.3, -0.12));
  } else if (style === 'ponytail') {
    head.add(at(cone(0.09, 0.4, 5, color), 0, -0.1, -0.3, -2.6, 0, 0));
  } else {
    // short: หน้าม้าสั้นๆ
    head.add(at(box(0.44, 0.08, 0.1, color), 0, 0.14, 0.2, 0.3, 0, 0));
  }
}

// ---------- หมวก ----------
function buildHat(head, type, color, color2) {
  if (type === 'wizard') {
    head.add(at(cyl(0.42, 0.42, 0.04, 10, color), 0, 0.2, 0));
    head.add(at(cone(0.27, 0.6, 7, color), 0, 0.5, -0.04, -0.25, 0, 0.1));
    head.add(at(cyl(0.275, 0.29, 0.07, 10, color2), 0, 0.25, 0));
  } else if (type === 'cap') {
    head.add(at(cyl(0.31, 0.31, 0.1, 8, color), 0, 0.22, 0));
    head.add(at(box(0.32, 0.03, 0.2, color), 0, 0.18, 0.26));
  } else if (type === 'hood') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(color));
    hood.castShadow = true;
    head.add(at(hood, 0, 0.0, -0.04, -0.3, 0, 0));
  } else if (type === 'helmet') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(color, { metalness: 0.5, roughness: 0.5 }));
    helm.castShadow = true;
    head.add(at(helm, 0, 0.06, 0));
    head.add(at(cyl(0.34, 0.34, 0.05, 8, color), 0, 0.06, 0));
    head.add(at(box(0.05, 0.16, 0.36, color2), 0, 0.34, 0));
  } else if (type === 'chef') {
    head.add(at(cyl(0.26, 0.24, 0.16, 8, 0xffffff), 0, 0.28, 0));
    head.add(at(ico(0.24, 0, 0xffffff), 0, 0.42, 0, 0, 0, 0, [1.1, 0.7, 1.1]));
  } else if (type === 'scarf') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.31, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(color));
    h.castShadow = true;
    head.add(at(h, 0, 0.02, -0.03, -0.15, 0, 0));
    head.add(at(cone(0.08, 0.2, 4, color), 0, -0.05, -0.3, -2.3, 0, 0));
  } else if (type === 'flower') {
    head.add(at(ico(0.06, 0, 0xff8fb0), 0.2, 0.2, 0.1));
    head.add(at(ico(0.05, 0, 0xffe066), 0.25, 0.15, 0.04));
  }
}

/** ดาบของไค (ใบดาบชี้ไปทาง -Y ต่อจากแขน) */
export function buildSword() {
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f0, flatShading: true, metalness: 0.6, roughness: 0.3, emissive: 0xffc04a, emissiveIntensity: 0 });
  const sword = group(
    at(cyl(0.028, 0.028, 0.17, 6, 0x5a3a24), 0, 0, 0),
    at(ico(0.04, 0, 0xe8b84a), 0, 0.1, 0),
    at(box(0.24, 0.045, 0.07, 0xe0b04a), 0, -0.1, 0),
    at(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.6, 0.025), bladeMat), 0, -0.42, 0),
    at(new THREE.Mesh(new THREE.ConeGeometry(0.053, 0.13, 4), bladeMat), 0, -0.785, 0, Math.PI, Math.PI / 4, 0, [1, 1, 0.35]),
  );
  sword.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const base = at(new THREE.Object3D(), 0, -0.16, 0);
  const tip = at(new THREE.Object3D(), 0, -0.84, 0);
  sword.add(base, tip);
  return { sword, base, tip, bladeMat };
}

/** สร้างไค: เด็กชายนักผจญภัยผ้าพันคอแดง */
export function buildHero() {
  const h = buildHumanoid({
    scale: 0.95,
    skin: 0xf2c9a0,
    hair: 0x6b4226,
    hairStyle: 'messy',
    shirt: 0x3b5f8f,
    shirtDark: 0x2f4c75,
    sleeve: 0xefe2c2,
    pants: 0x6e5a45,
    boots: 0x5a3a24,
    bootCuff: 0x8a5d36,
    belt: 0x4a2f1f,
    buckle: 0xe8b84a,
    bracer: 0x7a5232,
    vest: 0x7a5232,
  });
  const j = h.joints;

  // ผ้าพันคอ: ห่วงรอบคอ (ส่วนหางที่ปลิวทำแยกใน Scarf.js)
  const scarfMat = mat(0xd63a2f);
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.075, 5, 9), scarfMat);
  wrap.castShadow = true;
  j.neck.add(at(wrap, 0, 0.04, 0.0, Math.PI / 2, 0, 0, [1.05, 1, 1]));
  j.neck.add(at(box(0.12, 0.1, 0.08, 0xb22a22), 0.04, 0.03, -0.19));

  // กระเป๋าสะพาย + สายคาดอก
  j.torso.add(at(box(0.2, 0.16, 0.1, 0x8a5d36), 0.24, 0.02, 0.08, 0, 0.5, 0));
  j.torso.add(at(box(0.05, 0.62, 0.03, 0x5a3a24), 0, 0.24, 0.235, 0, 0, 0.75));
  // บ่าหนังข้างซ้าย
  j.shoulderL.add(at(ico(0.12, 0, 0x7a5232), 0, 0.02, 0, 0, 0, 0, [1.1, 0.7, 1.1]));

  const sword = buildSword();
  j.wristR.add(sword.sword);

  // จุดยึดหางผ้าพันคอ (หลังคอ)
  const scarfAnchor = at(new THREE.Object3D(), 0.03, 0.02, -0.2);
  j.neck.add(scarfAnchor);

  return { ...h, sword, scarfAnchor, scarfMat };
}
