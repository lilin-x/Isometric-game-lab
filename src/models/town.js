// =============================================================
//  town.js — โมเดลของเมืองแฟนตาซีย้อนยุค (ตึก แผงร้าน โคมไฟ น้ำพุ ...)
// -------------------------------------------------------------
//  ไอเดียตึก "ไม่ตั้งตรง ซ้อนเยื้องกัน":
//   สร้างทีละชั้น แต่ละชั้น:
//     • ใหญ่ขึ้น/เล็กลงนิดหน่อย (ชั้นบนยื่นออกมาแบบบ้านยุคกลาง)
//     • เลื่อนจุดศูนย์กลางเล็กน้อย (เยื้อง)
//     • หมุนรอบแกนตั้งนิดหน่อย + เอียงนิดหน่อย (ไม่ตรงเป๊ะ)
//   แล้วปิดท้ายด้วยหลังคา (พีระมิด / จั่ว / ยอดแหลม / โดม)
//
//  หมายเหตุ: กล้อง isometric มองจากทิศ +X,+Z เสมอ
//  ผนังด้าน -X และ -Z จะไม่มีวันถูกมองเห็น → ไม่ต้องใส่หน้าต่าง (ประหยัด)
// =============================================================

import * as THREE from 'three';
import { box, cyl, cone, ico, sphere, at, group, mat, glowMat, glowSprite, meshOf } from './kit.js';

export const TOWN_COLORS = {
  walls: [0xf1e3c6, 0xe9c9a8, 0xd9e6d0, 0xe6d0e3, 0xf3d3b3, 0xcfe0ea, 0xf0dca0],
  timber: 0x5b3b27,
  trim: 0x7b5236,
  roofs: [0xc4573a, 0x4f6497, 0x3f8a86, 0x7c4f8f, 0xb8743a, 0x5f8a44],
  shutters: [0x3f8a86, 0xc4573a, 0x5f8a44, 0x4f6497, 0xd9a441],
  stone: 0xb7ab98,
  stoneDark: 0x8f8574,
  windowLit: 0xffc66b,
  windowDark: 0x2f3a55,
};

// ---------- หลังคาจั่ว (สามเหลี่ยมยืดยาว) ----------
function gableGeometry(w, h, d) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

/** หน้าต่าง 1 บาน (กรอบ + กระจก + ขอบล่าง + บานเกล็ดบางบาน + กระถางดอกไม้) */
function addWindow(parent, rng, lit, { x, y, z, ry, big = false }) {
  const w = big ? 0.55 : 0.42;
  const h = big ? 0.8 : 0.62;
  const win = new THREE.Group();
  win.add(at(box(w + 0.14, h + 0.14, 0.06, TOWN_COLORS.trim, { castShadow: false }), 0, 0, 0));
  const glass = lit ? glowMat(TOWN_COLORS.windowLit, rng() < 0.5 ? 1.6 : 2.2) : mat(TOWN_COLORS.windowDark);
  win.add(at(box(w, h, 0.07, glass, { castShadow: false }), 0, 0, 0.01));
  win.add(at(box(0.04, h, 0.08, TOWN_COLORS.trim, { castShadow: false }), 0, 0, 0.02)); // ไม้กลางหน้าต่าง
  win.add(at(box(w + 0.24, 0.07, 0.16, TOWN_COLORS.trim, { castShadow: false }), 0, -h / 2 - 0.06, 0.05));
  if (rng() < 0.45) {
    const c = rng.pick(TOWN_COLORS.shutters);
    win.add(at(box(0.16, h, 0.04, c, { castShadow: false }), -w / 2 - 0.16, 0, 0.03, 0, 0.35, 0));
    win.add(at(box(0.16, h, 0.04, c, { castShadow: false }), w / 2 + 0.16, 0, 0.03, 0, -0.35, 0));
  }
  if (rng() < 0.35) {
    // กระถางดอกไม้ใต้หน้าต่าง
    win.add(at(box(w + 0.1, 0.16, 0.2, 0x8a5d36, { castShadow: false }), 0, -h / 2 - 0.17, 0.12));
    const flowers = [0xff7aa2, 0xffd166, 0xf25f5c, 0xc77dff, 0xffffff];
    for (let i = 0; i < 4; i++) {
      win.add(at(ico(0.07, 0, i % 2 ? 0x5f9e45 : rng.pick(flowers), { castShadow: false }), -w / 2 + 0.05 + i * (w / 3), -h / 2 - 0.05, 0.14));
    }
  }
  at(win, x, y, z, 0, ry, 0);
  parent.add(win);
}

/**
 * ตึกแฟนตาซีแบบหลายชั้นซ้อนเยื้อง
 * @param {Function} rng ตัวสุ่ม (makeRng)
 * @param {{floors:number, w:number, d:number, roof?:string, door?:'x'|'z', shop?:boolean, baseStone?:boolean, turret?:boolean}} o
 */
export function buildTower(rng, o) {
  const g = new THREE.Group();
  const wallA = o.wall ?? rng.pick(TOWN_COLORS.walls);
  const wallB = rng() < 0.5 ? wallA : rng.pick(TOWN_COLORS.walls);
  const roofColor = o.roofColor ?? rng.pick(TOWN_COLORS.roofs);
  let y = 0;
  let ox = 0;
  let oz = 0;
  let rotY = 0;
  let fw = o.w;
  let fd = o.d;
  let top = null;

  for (let i = 0; i < o.floors; i++) {
    const h = i === 0 ? 2.5 : rng.range(1.75, 2.15);
    if (i > 0) {
      // ชั้นบนยื่น/หด เยื้อง และบิดเล็กน้อย = เสน่ห์ของตึกแฟนตาซี
      const grow = rng.range(0.93, 1.14);
      fw = THREE.MathUtils.clamp(fw * grow, o.w * 0.75, o.w * 1.3);
      fd = THREE.MathUtils.clamp(fd * rng.range(0.93, 1.14), o.d * 0.75, o.d * 1.3);
      ox = THREE.MathUtils.clamp(ox + rng.range(-0.4, 0.4), -0.7, 0.7);
      oz = THREE.MathUtils.clamp(oz + rng.range(-0.4, 0.4), -0.7, 0.7);
      rotY += rng.range(-0.11, 0.11);
    }
    const floor = new THREE.Group();
    floor.position.set(ox, y, oz);
    floor.rotation.set(rng.range(-0.025, 0.025), rotY, rng.range(-0.03, 0.03));
    g.add(floor);

    const stone = i === 0 && o.baseStone;
    const wallColor = stone ? TOWN_COLORS.stone : i % 2 ? wallB : wallA;
    floor.add(at(box(fw, h, fd, wallColor), 0, h / 2, 0));
    // คานพื้น (ขอบยื่นระหว่างชั้น)
    floor.add(at(box(fw + 0.26, 0.16, fd + 0.26, TOWN_COLORS.trim), 0, i === 0 ? 0.08 : 0.04, 0));
    // เสาไม้มุมตึก (timber frame)
    if (!stone) {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1]]) {
        floor.add(at(box(0.15, h, 0.15, TOWN_COLORS.timber), (sx * fw) / 2, h / 2, (sz * fd) / 2));
      }
      if (rng() < 0.5) {
        // ไม้คาดกลางผนัง
        floor.add(at(box(fw + 0.02, 0.1, 0.06, TOWN_COLORS.timber, { castShadow: false }), 0, h * 0.5, fd / 2 + 0.02));
        floor.add(at(box(0.06, 0.1, fd + 0.02, TOWN_COLORS.timber, { castShadow: false }), fw / 2 + 0.02, h * 0.5, 0));
      }
    } else {
      // ก้อนหินที่มุม
      for (let k = 0; k < 3; k++) floor.add(at(box(0.3, 0.32, 0.3, TOWN_COLORS.stoneDark), fw / 2, 0.3 + k * 0.75, fd / 2));
    }

    // หน้าต่างบนผนังด้านที่กล้องเห็น (+Z และ +X)
    const lit = () => rng() < (o.litChance ?? 0.7);
    const wy = i === 0 ? 1.45 : h * 0.55;
    const nz = Math.max(1, Math.floor(fw / 1.25));
    for (let k = 0; k < nz; k++) {
      const x = -fw / 2 + (fw / nz) * (k + 0.5);
      if (i === 0 && o.door === 'z' && k === Math.floor(nz / 2)) continue;
      addWindow(floor, rng, lit(), { x, y: wy, z: fd / 2 + 0.03, ry: 0, big: i === 0 && o.shop });
    }
    const nx = Math.max(1, Math.floor(fd / 1.25));
    for (let k = 0; k < nx; k++) {
      const z = -fd / 2 + (fd / nx) * (k + 0.5);
      if (i === 0 && o.door === 'x' && k === Math.floor(nx / 2)) continue;
      addWindow(floor, rng, lit(), { x: fw / 2 + 0.03, y: wy, z, ry: Math.PI / 2, big: i === 0 && o.shop });
    }

    // ระเบียงบางชั้น
    if (i > 0 && i < o.floors - 1 && rng() < 0.3) {
      const bal = new THREE.Group();
      bal.add(at(box(1.4, 0.1, 0.6, TOWN_COLORS.trim), 0, 0, 0));
      bal.add(at(box(1.4, 0.45, 0.05, TOWN_COLORS.timber, { castShadow: false }), 0, 0.25, 0.28));
      for (let k = 0; k < 5; k++) bal.add(at(box(0.05, 0.45, 0.05, TOWN_COLORS.timber, { castShadow: false }), -0.6 + k * 0.3, 0.25, 0.28));
      bal.add(at(ico(0.18, 0, 0x5f9e45), 0.5, 0.25, 0.05));
      at(bal, 0, 0.1, fd / 2 + 0.3);
      floor.add(bal);
    }

    // ป้อมเล็กข้างตึก (turret)
    if (o.turret && i === o.floors - 2) {
      const t = new THREE.Group();
      t.add(at(cyl(0.55, 0.45, 1.6, 7, wallB), 0, 0.8, 0));
      t.add(at(cone(0.8, 1.4, 7, roofColor), 0, 2.3, 0));
      addWindow(t, rng, true, { x: 0, y: 0.9, z: 0.5, ry: 0 });
      t.add(at(cone(0.3, 0.7, 4, TOWN_COLORS.trim), 0, -0.2, 0, Math.PI, 0, 0));
      at(t, fw / 2 + 0.3, 0.6, fd / 2 + 0.3);
      floor.add(t);
    }

    y += h;
    top = { floor, fw, fd, h };
  }

  // ---------- หลังคา ----------
  const roofType = o.roof ?? rng.pick(['pyramid', 'gable', 'gable', 'spire']);
  const { floor, fw: tw, fd: td, h: th } = top;
  const roof = new THREE.Group();
  roof.position.y = th;
  floor.add(roof);
  if (roofType === 'pyramid' || roofType === 'spire') {
    const tall = roofType === 'spire' ? rng.range(3, 4.2) : rng.range(1.6, 2.4);
    const r = Math.max(tw, td) * 0.78;
    const m = at(cone(r, tall, 4, roofColor), 0, tall / 2, 0, 0, Math.PI / 4, 0, [tw / Math.max(tw, td), 1, td / Math.max(tw, td)]);
    m.scale.x *= 1.12;
    m.scale.z *= 1.12;
    roof.add(m);
    if (roofType === 'spire') {
      roof.add(at(cyl(0.03, 0.03, 1.0, 4, 0x444444), 0, tall + 0.4, 0));
      const flag = at(box(0.5, 0.3, 0.03, rng.pick([0xd63a2f, 0xffcf6b, 0x3f8a86])), 0.27, tall + 0.75, 0);
      flag.userData.dynamic = true;
      flag.userData.flag = true;
      roof.add(flag);
    }
  } else if (roofType === 'dome') {
    const d = new THREE.Mesh(new THREE.SphereGeometry(Math.min(tw, td) * 0.6, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(roofColor));
    d.castShadow = true;
    roof.add(d);
    roof.add(at(cone(0.15, 0.8, 6, 0xe8b84a), 0, Math.min(tw, td) * 0.6 + 0.3, 0));
  } else {
    // จั่ว: วางแนวยาวตามด้านที่ยาวกว่า
    const along = tw > td ? 'x' : 'z';
    const span = along === 'x' ? td : tw;
    const len = (along === 'x' ? tw : td) + 0.5;
    const rh = span * rng.range(0.55, 0.8);
    const m = meshOf(gableGeometry(span + 0.5, rh, len), roofColor);
    if (along === 'x') m.rotation.y = Math.PI / 2;
    roof.add(m);
    // หน้าจั่ว (ผนังสามเหลี่ยม)
    const gable = meshOf(gableGeometry(span - 0.05, rh - 0.12, len - 0.6), along === 'x' ? wallB : wallA);
    if (along === 'x') gable.rotation.y = Math.PI / 2;
    roof.add(gable);
    // หน้าต่างกลมบนหน้าจั่ว
    if (along === 'x') addWindow(roof, rng, rng() < 0.6, { x: (len - 0.6) / 2 + 0.02, y: rh * 0.35, z: 0, ry: Math.PI / 2 });
    else addWindow(roof, rng, rng() < 0.6, { x: 0, y: rh * 0.35, z: (len - 0.6) / 2 + 0.02, ry: 0 });
  }
  // ปล่องไฟ
  if (o.chimney ?? rng() < 0.6) {
    const cx = -tw * 0.25;
    const cz = -td * 0.2;
    const ch = at(box(0.45, 1.6, 0.45, TOWN_COLORS.stoneDark), cx, 0.8, cz);
    roof.add(ch);
    roof.add(at(box(0.55, 0.12, 0.55, TOWN_COLORS.stone), cx, 1.62, cz));
    const smoke = new THREE.Object3D();
    smoke.position.set(cx, 1.8, cz);
    smoke.userData.smoke = true;
    smoke.userData.dynamic = true;
    roof.add(smoke);
  }

  // ---------- ประตูชั้นล่าง ----------
  if (o.door) {
    const door = new THREE.Group();
    door.add(at(box(1.0, 1.75, 0.08, TOWN_COLORS.trim), 0, 0.88, 0));
    door.add(at(box(0.8, 1.6, 0.1, 0x6b4428), 0, 0.82, 0.02));
    door.add(at(cyl(0.5, 0.5, 0.08, 8, TOWN_COLORS.trim), 0, 1.75, 0, Math.PI / 2, 0, 0, [1, 1, 0.6]));
    door.add(at(ico(0.05, 0, 0xe8b84a), 0.27, 0.85, 0.09));
    door.add(at(box(1.3, 0.12, 0.5, TOWN_COLORS.stone), 0, 0.06, 0.2));
    // โคมเล็กข้างประตู
    door.add(at(box(0.18, 0.26, 0.18, glowMat(0xffb347, 2.5)), 0.75, 1.75, 0.15));
    door.add(at(box(0.24, 0.05, 0.24, 0x2b2b2b), 0.75, 1.9, 0.15));
    const gl = glowSprite(0xffb347, 1.4, 0.55);
    gl.position.set(0.75, 1.75, 0.3);
    door.add(gl);
    if (o.door === 'z') at(door, 0, 0, o.d / 2 + 0.04);
    else at(door, o.w / 2 + 0.04, 0, 0, 0, Math.PI / 2, 0);
    g.add(door);
  }

  // ---------- กันสาดหน้าร้าน ----------
  if (o.shop) {
    const aw = buildAwning(o.awningColors ?? [0xd63a2f, 0xfff3dc], o.door === 'x' ? o.d : o.w);
    if (o.door === 'x') at(aw, o.w / 2 + 0.55, 2.35, 0, 0, Math.PI / 2, 0);
    else at(aw, 0, 2.35, o.d / 2 + 0.55);
    g.add(aw);
  }
  if (o.sign) {
    const s = buildHangingSign(o.sign);
    if (o.door === 'x') at(s, o.w / 2 + 0.45, 2.75, o.d / 2 - 0.2, 0, Math.PI / 2, 0);
    else at(s, o.w / 2 - 0.2, 2.75, o.d / 2 + 0.45);
    g.add(s);
  }

  return { group: g, height: y };
}

/** กันสาดลายทาง */
export function buildAwning(colors, width) {
  const g = new THREE.Group();
  const n = Math.max(4, Math.round(width / 0.4));
  const sw = width / n;
  for (let i = 0; i < n; i++) {
    g.add(at(box(sw, 0.05, 1.2, colors[i % colors.length]), -width / 2 + sw * (i + 0.5), 0, 0, 0.42, 0, 0));
    g.add(at(cone(sw * 0.55, 0.2, 3, colors[i % colors.length], { castShadow: false }), -width / 2 + sw * (i + 0.5), -0.33, 0.56, Math.PI, 0, 0));
  }
  return g;
}

/** ป้ายร้านแขวน + ไอคอนสินค้า */
export function buildHangingSign(kind) {
  const g = new THREE.Group();
  g.add(at(box(0.06, 0.06, 0.8, 0x2b2b2b), 0, 0.3, -0.35));
  g.add(at(box(0.04, 0.3, 0.04, 0x2b2b2b), 0, 0.15, 0));
  g.add(at(box(0.7, 0.5, 0.06, 0x8a5d36), 0, -0.2, 0));
  if (kind === 'potion') {
    g.add(at(ico(0.13, 0, glowMat(0x9b5de5, 1.6)), 0, -0.24, 0.06));
    g.add(at(cyl(0.04, 0.05, 0.1, 6, 0xdfe8f0), 0, -0.08, 0.06));
  } else if (kind === 'sword') {
    g.add(at(box(0.05, 0.38, 0.03, 0xdfe8f0), 0, -0.2, 0.06, 0, 0, 0.6));
    g.add(at(box(0.18, 0.04, 0.04, 0xe0b04a), 0.06, -0.28, 0.07, 0, 0, 0.6));
  } else if (kind === 'bread') {
    g.add(at(ico(0.16, 0, 0xd99a4e), 0, -0.2, 0.06, 0, 0, 0, [1.4, 0.8, 0.6]));
  } else if (kind === 'inn') {
    g.add(at(cyl(0.1, 0.08, 0.2, 7, 0xe8b84a), 0, -0.2, 0.08));
    g.add(at(box(0.16, 0.05, 0.05, 0xffffff), 0, -0.1, 0.1));
  }
  return g;
}

/** เสาโคมไฟริมถนน */
export function buildLanternPost(height = 2.6) {
  const g = new THREE.Group();
  g.add(at(cyl(0.16, 0.2, 0.25, 6, 0x2b2b30), 0, 0.12, 0));
  g.add(at(cyl(0.06, 0.07, height, 6, 0x2b2b30), 0, height / 2, 0));
  g.add(at(box(0.5, 0.05, 0.05, 0x2b2b30), 0.2, height - 0.05, 0));
  const lamp = new THREE.Group();
  lamp.add(at(box(0.3, 0.38, 0.3, glowMat(0xffc46b, 2.6)), 0, 0, 0));
  lamp.add(at(cone(0.26, 0.2, 4, 0x2b2b30), 0, 0.29, 0, 0, Math.PI / 4, 0));
  lamp.add(at(box(0.34, 0.05, 0.34, 0x2b2b30), 0, -0.2, 0));
  at(lamp, 0.4, height - 0.32, 0);
  g.add(lamp);
  const gl = glowSprite(0xffb655, 2.2, 0.55);
  gl.position.set(0.4, height - 0.32, 0);
  g.add(gl);
  return { group: g, lightPos: new THREE.Vector3(0.4, height - 0.35, 0) };
}

/** แผงขายของ */
export function buildStall(rng, kind, colors) {
  const g = new THREE.Group();
  const wood = 0x8a5d36;
  for (const [x, z] of [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]]) g.add(at(box(0.12, 2.1, 0.12, wood), x, 1.05, z));
  g.add(at(box(2.3, 0.12, 1.3, 0x6b4428), 0, 0.9, 0.05));
  g.add(at(box(2.2, 0.85, 0.1, 0xa0703f), 0, 0.45, 0.65));
  g.add(at(box(2.2, 0.85, 0.1, 0xa0703f), 0, 0.45, -0.6));
  const aw = buildAwning(colors, 2.5);
  at(aw, 0, 2.1, 0.1, 0, 0, 0);
  aw.scale.set(1, 1, 1.1);
  g.add(aw);
  // สินค้า
  if (kind === 'fruit') {
    const fruits = [0xe63946, 0xffb703, 0x8ac926, 0xff7b00, 0x9b5de5];
    for (let i = 0; i < 4; i++) {
      g.add(at(box(0.45, 0.14, 0.45, 0x7a5232), -0.75 + i * 0.5, 1.02, 0.25));
      const c = fruits[i % fruits.length];
      for (let k = 0; k < 5; k++) g.add(at(ico(0.08, 0, c, { castShadow: false }), -0.75 + i * 0.5 + rng.range(-0.12, 0.12), 1.15 + rng.range(0, 0.06), 0.25 + rng.range(-0.12, 0.12)));
    }
  } else if (kind === 'potion') {
    const pc = [0x9b5de5, 0x00bbf9, 0xf15bb5, 0x00f5d4, 0xfee440];
    for (let i = 0; i < 8; i++) {
      const c = pc[i % pc.length];
      const x = -0.85 + i * 0.24;
      g.add(at(sphere(0.08, 6, 4, glowMat(c, 1.3), { castShadow: false }), x, 1.06, 0.2));
      g.add(at(cyl(0.025, 0.03, 0.08, 5, 0xdfe8f0, { castShadow: false }), x, 1.17, 0.2));
    }
    g.add(at(box(0.5, 0.35, 0.3, 0x5b3b27), 0.6, 1.12, -0.25));
  } else if (kind === 'bread') {
    for (let i = 0; i < 6; i++) g.add(at(ico(0.12, 0, 0xd99a4e, { castShadow: false }), -0.75 + i * 0.3, 1.04, 0.2, 0, rng(), 0, [1.4, 0.7, 0.8]));
    g.add(at(box(0.6, 0.12, 0.4, 0xe9d8b4), 0.4, 1.02, -0.2));
  } else if (kind === 'cloth') {
    const cc = [0xd63a2f, 0x3f8a86, 0xffcf6b, 0x7c4f8f];
    for (let i = 0; i < 4; i++) g.add(at(box(0.4, 0.12, 0.5, cc[i]), -0.7 + i * 0.47, 1.02, 0.15));
  }
  return g;
}

/** น้ำพุกลางลาน */
export function buildFountain() {
  const g = new THREE.Group();
  g.add(at(cyl(2.0, 2.15, 0.6, 10, TOWN_COLORS.stone), 0, 0.3, 0));
  g.add(at(cyl(1.75, 1.75, 0.62, 10, TOWN_COLORS.stoneDark), 0, 0.32, 0));
  const water = at(cyl(1.72, 1.72, 0.05, 10, mat(0x4fb3d9, { transparent: true, opacity: 0.85, roughness: 0.2, emissive: 0x1b5a7a, emissiveIntensity: 0.6 })), 0, 0.55, 0);
  water.userData.dynamic = true;
  water.castShadow = false;
  g.add(water);
  g.add(at(cyl(0.3, 0.4, 1.6, 8, TOWN_COLORS.stone), 0, 1.0, 0));
  g.add(at(cyl(0.8, 0.35, 0.3, 8, TOWN_COLORS.stone), 0, 1.75, 0));
  g.add(at(cyl(0.7, 0.7, 0.05, 8, mat(0x6fc6e8, { roughness: 0.2, emissive: 0x2a7aa0, emissiveIntensity: 0.6 })), 0, 1.88, 0));
  g.add(at(cyl(0.12, 0.15, 0.6, 6, TOWN_COLORS.stone), 0, 2.15, 0));
  g.add(at(ico(0.22, 0, glowMat(0x9be7ff, 1.8)), 0, 2.55, 0));
  const gl = glowSprite(0x9be7ff, 1.8, 0.5);
  gl.position.set(0, 2.55, 0);
  g.add(gl);
  return { group: g, water };
}

export function buildBarrel(color = 0x8a5d36) {
  const g = new THREE.Group();
  g.add(at(cyl(0.32, 0.28, 0.75, 8, color), 0, 0.375, 0));
  g.add(at(cyl(0.335, 0.335, 0.06, 8, 0x3a3a3a), 0, 0.2, 0));
  g.add(at(cyl(0.335, 0.335, 0.06, 8, 0x3a3a3a), 0, 0.58, 0));
  return g;
}

export function buildCrate(size = 0.6) {
  const g = new THREE.Group();
  g.add(at(box(size, size, size, 0xb07d4b), 0, size / 2, 0));
  g.add(at(box(size + 0.02, 0.08, size + 0.02, 0x7a5232), 0, size - 0.04, 0));
  g.add(at(box(size + 0.02, 0.08, size + 0.02, 0x7a5232), 0, 0.04, 0));
  return g;
}

export function buildSack() {
  return group(at(ico(0.3, 1, 0xd8c39a), 0, 0.25, 0, 0, 0, 0, [1, 0.85, 0.9]), at(cyl(0.08, 0.12, 0.15, 5, 0xc2ab80), 0, 0.52, 0));
}

export function buildBench() {
  const g = new THREE.Group();
  g.add(at(box(1.6, 0.1, 0.5, 0x8a5d36), 0, 0.45, 0));
  g.add(at(box(1.6, 0.4, 0.08, 0x8a5d36), 0, 0.75, -0.22, -0.15, 0, 0));
  for (const x of [-0.65, 0.65]) g.add(at(box(0.1, 0.45, 0.45, 0x2b2b30), x, 0.22, 0));
  return g;
}

/** ต้นไม้ในกระถาง (ของตกแต่งเมือง) */
export function buildPlanterTree(rng, color) {
  const g = new THREE.Group();
  g.add(at(box(1.1, 0.5, 1.1, TOWN_COLORS.stone), 0, 0.25, 0));
  g.add(at(box(0.95, 0.06, 0.95, 0x5b3b27, { castShadow: false }), 0, 0.5, 0));
  g.add(at(cyl(0.1, 0.14, 1.6, 6, 0x6b4428), 0, 1.2, 0));
  const c = color ?? rng.pick([0x6aa84f, 0xe69138, 0xd9534f, 0x93c47d]);
  g.add(at(ico(0.75, 0, c), 0, 2.2, 0, rng(), rng(), 0));
  g.add(at(ico(0.5, 0, c), 0.35, 2.65, 0.1, rng(), rng(), 0));
  return g;
}

export function buildFlowerPot(rng) {
  const g = new THREE.Group();
  g.add(at(cyl(0.22, 0.16, 0.3, 7, 0xc4573a), 0, 0.15, 0));
  g.add(at(ico(0.24, 0, 0x5f9e45), 0, 0.42, 0));
  const fc = rng.pick([0xff7aa2, 0xffd166, 0xf25f5c, 0xc77dff, 0xffffff]);
  for (let i = 0; i < 4; i++) g.add(at(ico(0.07, 0, fc, { castShadow: false }), Math.cos(i * 1.6) * 0.16, 0.55, Math.sin(i * 1.6) * 0.16));
  return g;
}

export function buildCart() {
  const g = new THREE.Group();
  g.add(at(box(1.6, 0.5, 1.0, 0x9a6a3c), 0, 0.75, 0));
  g.add(at(box(1.7, 0.08, 1.1, 0x6b4428), 0, 1.02, 0));
  for (const z of [-0.55, 0.55]) {
    g.add(at(cyl(0.42, 0.42, 0.08, 10, 0x5b3b27), -0.2, 0.42, z, Math.PI / 2, 0, 0));
    g.add(at(cyl(0.1, 0.1, 0.1, 6, 0x2b2b30), -0.2, 0.42, z, Math.PI / 2, 0, 0));
  }
  g.add(at(box(1.4, 0.06, 0.08, 0x6b4428), 1.4, 0.6, 0.3));
  g.add(at(box(1.4, 0.06, 0.08, 0x6b4428), 1.4, 0.6, -0.3));
  // ของในเกวียน
  g.add(at(ico(0.3, 0, 0xf0c05a), 0, 1.15, 0.2));
  g.add(at(ico(0.28, 0, 0xe0a83a), -0.4, 1.12, -0.2));
  g.add(at(ico(0.25, 0, 0xf6d26b), 0.4, 1.1, -0.1));
  return g;
}

/** ทั่ง + เตาหลอมของช่างตีเหล็ก */
export function buildForge() {
  const g = new THREE.Group();
  g.add(at(box(1.4, 1.0, 1.2, TOWN_COLORS.stoneDark), 0, 0.5, 0));
  g.add(at(box(1.0, 0.1, 0.8, glowMat(0xff6a1a, 3)), 0, 1.02, 0));
  g.add(at(box(0.5, 1.6, 0.5, TOWN_COLORS.stone), 0, 1.8, -0.3));
  const gl = glowSprite(0xff7b2a, 2.6, 0.7);
  gl.position.set(0, 1.2, 0);
  g.add(gl);
  // ทั่ง
  const anvil = new THREE.Group();
  anvil.add(at(box(0.3, 0.45, 0.3, 0x5b3b27), 0, 0.22, 0));
  anvil.add(at(box(0.6, 0.18, 0.28, 0x3a3a40, { metalness: 0.5 }), 0, 0.54, 0));
  anvil.add(at(cone(0.12, 0.3, 4, 0x3a3a40), 0.42, 0.54, 0, 0, 0, -Math.PI / 2));
  at(anvil, 1.6, 0, 0.6);
  g.add(anvil);
  return { group: g, anvilPos: new THREE.Vector3(1.6, 0.7, 0.6) };
}

/** ป้ายประกาศ */
export function buildNoticeBoard() {
  const g = new THREE.Group();
  g.add(at(box(0.12, 1.8, 0.12, 0x6b4428), -0.6, 0.9, 0));
  g.add(at(box(0.12, 1.8, 0.12, 0x6b4428), 0.6, 0.9, 0));
  g.add(at(box(1.5, 0.9, 0.08, 0x9a6a3c), 0, 1.3, 0));
  g.add(at(box(1.7, 0.12, 0.3, 0x5b3b27), 0, 1.82, 0));
  const papers = [0xfff3dc, 0xf6e7b0, 0xffffff];
  for (let i = 0; i < 4; i++) g.add(at(box(0.3, 0.36, 0.02, papers[i % 3], { castShadow: false }), -0.5 + i * 0.33, 1.3 + (i % 2) * 0.08, 0.05, 0, 0, (i - 1.5) * 0.06));
  return g;
}

/** หุ่นฟางสำหรับซ้อมฟัน */
export function buildDummy() {
  const g = new THREE.Group();
  g.add(at(cyl(0.08, 0.1, 0.9, 6, 0x6b4428), 0, 0.45, 0));
  const body = new THREE.Group();
  body.position.y = 0.85;
  body.add(at(cyl(0.3, 0.34, 0.75, 7, 0xd9b45a), 0, 0.37, 0));
  body.add(at(cyl(0.32, 0.32, 0.06, 7, 0x8a5d36), 0, 0.2, 0));
  body.add(at(cyl(0.32, 0.32, 0.06, 7, 0x8a5d36), 0, 0.55, 0));
  body.add(at(ico(0.24, 0, 0xd9b45a), 0, 0.95, 0));
  body.add(at(box(1.1, 0.08, 0.08, 0x6b4428), 0, 0.6, 0));
  // เป้า
  body.add(at(cyl(0.18, 0.18, 0.03, 10, 0xffffff), 0, 0.38, 0.33, Math.PI / 2, 0, 0));
  body.add(at(cyl(0.11, 0.11, 0.035, 10, 0xd63a2f), 0, 0.38, 0.335, Math.PI / 2, 0, 0));
  body.add(at(cyl(0.05, 0.05, 0.04, 8, 0xffffff), 0, 0.38, 0.34, Math.PI / 2, 0, 0));
  g.add(body);
  return { group: g, body };
}

/** ประตูเมือง + หอคอยสองข้าง */
export function buildGate() {
  const g = new THREE.Group();
  for (const x of [-3.3, 3.3]) {
    const t = new THREE.Group();
    t.add(at(cyl(1.45, 1.6, 6.2, 8, TOWN_COLORS.stone), 0, 3.1, 0));
    t.add(at(cyl(1.7, 1.7, 0.4, 8, TOWN_COLORS.stoneDark), 0, 6.3, 0));
    t.add(at(cone(1.9, 2.6, 8, 0x4f6497), 0, 7.8, 0));
    t.add(at(cyl(0.03, 0.03, 1.2, 4, 0x333333), 0, 9.6, 0));
    const flag = at(box(0.7, 0.4, 0.03, 0xd63a2f), 0.37, 9.95, 0);
    flag.userData.dynamic = true;
    flag.userData.flag = true;
    t.add(flag);
    t.add(at(box(0.35, 0.6, 0.1, glowMat(0xffc66b, 2)), 0.9, 4.2, 1.1, 0, 0.7, 0));
    t.position.x = x;
    g.add(t);
  }
  // ซุ้มโค้งด้านบน
  g.add(at(box(5.2, 1.4, 1.6, TOWN_COLORS.stone), 0, 5.2, 0));
  g.add(at(box(5.4, 0.3, 1.8, TOWN_COLORS.stoneDark), 0, 6.0, 0));
  for (let i = 0; i < 5; i++) g.add(at(box(0.45, 0.45, 1.6, TOWN_COLORS.stone), -2.0 + i * 1.0, 6.35, 0));
  // ขอบโค้งของซุ้ม (ครึ่งวงแหวน)
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.35, 5, 10, Math.PI), mat(TOWN_COLORS.stoneDark));
  arch.castShadow = true;
  g.add(at(arch, 0, 3.4, 0.75));
  // ประตูไม้เปิดออก
  g.add(at(box(1.6, 3.6, 0.15, 0x6b4428), -2.2, 1.8, 1.0, 0, -1.2, 0));
  g.add(at(box(1.6, 3.6, 0.15, 0x6b4428), 2.2, 1.8, 1.0, 0, 1.2, 0));
  // ป้ายชื่อเมือง + ธงแขวน
  g.add(at(box(2.4, 0.6, 0.1, 0x8a5d36), 0, 4.75, 0.85));
  g.add(at(box(0.9, 2.0, 0.05, 0xd63a2f), -1.7, 4.0, 0.85));
  g.add(at(box(0.9, 2.0, 0.05, 0xd63a2f), 1.7, 4.0, 0.85));
  g.add(at(ico(0.2, 0, 0xffcf6b), -1.7, 4.4, 0.9));
  g.add(at(ico(0.2, 0, 0xffcf6b), 1.7, 4.4, 0.9));
  return g;
}

/** กำแพงเมืองพร้อมใบเสมา */
export function buildWall(length, height = 3.2) {
  const g = new THREE.Group();
  g.add(at(box(length, height, 1.0, TOWN_COLORS.stone), 0, height / 2, 0));
  g.add(at(box(length + 0.1, 0.25, 1.15, TOWN_COLORS.stoneDark), 0, height, 0));
  const n = Math.floor(length / 1.1);
  for (let i = 0; i < n; i++) g.add(at(box(0.55, 0.5, 1.0, TOWN_COLORS.stone), -length / 2 + 0.55 + i * 1.1, height + 0.35, 0));
  return g;
}

/**
 * เส้นไฟประดับ + ธงสามเหลี่ยม ห้อยระหว่างจุด a → b
 * (ใช้สูตร "โซ่ห้อย" แบบง่าย: เส้นตรง + โค้งลงตรงกลางด้วย sin)
 */
export function buildStringLights(a, b, { sag = 0.8, bulbs = 12, flags = true, rng } = {}) {
  const g = new THREE.Group();
  const pts = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 3, false), mat(0x2b2b30));
  g.add(wire);
  const bulbColors = [0xffd27a, 0xffb36b, 0xfff0b0, 0xff9e7a];
  for (let i = 1; i < bulbs; i++) {
    const p = curve.getPoint(i / bulbs);
    g.add(at(ico(0.07, 0, glowMat(bulbColors[i % bulbColors.length], 3), { castShadow: false }), p.x, p.y - 0.06, p.z));
  }
  if (flags) {
    const flagColors = [0xd63a2f, 0xffcf6b, 0x3f8a86, 0x7c4f8f, 0xf3f0e6];
    const tri = new THREE.ConeGeometry(0.16, 0.32, 3);
    const m = Math.floor(curve.getLength() / 0.45);
    for (let i = 1; i < m; i++) {
      const t = i / m;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const f = meshOf(tri, flagColors[i % flagColors.length], { castShadow: false });
      f.position.set(p.x, p.y - 0.2, p.z);
      f.rotation.set(Math.PI, Math.atan2(tan.x, tan.z) + Math.PI / 2, 0);
      f.scale.set(1, 1, 0.25);
      g.add(f);
    }
  }
  return g;
}

/** ราวตากผ้าระหว่างตึก */
export function buildLaundry(a, b, rng) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([a, new THREE.Vector3().lerpVectors(a, b, 0.5).add(new THREE.Vector3(0, -0.5, 0)), b]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.015, 3, false), mat(0xe8e0d0)));
  const cloth = [0xffffff, 0x8ecae6, 0xffb4a2, 0xfff1a8, 0xb5e48c];
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const c = box(0.35, rng.range(0.4, 0.6), 0.03, rng.pick(cloth), { castShadow: false });
    c.position.set(p.x, p.y - 0.25, p.z);
    c.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
    g.add(c);
  }
  return g;
}
