// =============================================================
//  nature.js — โมเดลธรรมชาติ low poly (ต้นไม้ พุ่มไม้ หิน ภูเขา ลำธาร ...)
// -------------------------------------------------------------
//  ต้นไม้ 5 สี × 4 ทรง, พุ่มไม้ 4 ชนิด, หินเล็ก-ใหญ่, ภูเขามีหิมะ
//  เคล็ดลับ: ใช้ jitter() เขย่าจุดยอดนิดหน่อย → ดูเป็นธรรมชาติขึ้นทันที
// =============================================================

import * as THREE from 'three';
import { box, cyl, cone, ico, at, group, mat, glowMat, glowSprite, meshOf, jitter } from './kit.js';

// 5 สีของป่าหลากสี
export const TREE_COLORS = {
  green: [0x4f9d4a, 0x3f8a3f],
  orange: [0xee8a3a, 0xd9722a],
  red: [0xd9473f, 0xb83a35],
  yellow: [0xf0c541, 0xd9ab2c],
  pink: [0xf4a3c0, 0xe486a8],
};
export const TREE_COLOR_NAMES = Object.keys(TREE_COLORS);
const TRUNK = 0x6b4428;

function blob(r, color, rng, detail = 0) {
  const g = jitter(new THREE.IcosahedronGeometry(r, detail), r * 0.25, rng);
  return meshOf(g, color);
}

/**
 * ต้นไม้ 1 ต้น
 * @param {Function} rng
 * @param {'round'|'pine'|'tall'|'layered'} shape
 * @param {string} colorName  green/orange/red/yellow/pink
 */
export function buildTree(rng, shape, colorName, scale = 1) {
  const [c1, c2] = TREE_COLORS[colorName];
  const g = new THREE.Group();
  const s = scale;
  if (shape === 'pine') {
    g.add(at(cyl(0.16 * s, 0.24 * s, 1.2 * s, 6, TRUNK), 0, 0.6 * s, 0));
    for (let i = 0; i < 3; i++) {
      const r = (1.35 - i * 0.33) * s;
      const m = meshOf(jitter(new THREE.ConeGeometry(r, 1.5 * s, 7), 0.12 * s, rng, { keepBottom: true }), i % 2 ? c2 : c1);
      g.add(at(m, 0, (1.4 + i * 0.85) * s, 0, 0, rng() * 3, 0));
    }
  } else if (shape === 'tall') {
    g.add(at(cyl(0.14 * s, 0.2 * s, 1.4 * s, 6, TRUNK), 0, 0.7 * s, 0));
    g.add(at(blob(0.9 * s, c1, rng), 0, 2.6 * s, 0, 0, 0, 0, [0.8, 1.9, 0.8]));
    g.add(at(blob(0.5 * s, c2, rng), 0.3 * s, 1.9 * s, 0.25 * s));
  } else if (shape === 'layered') {
    g.add(at(cyl(0.15 * s, 0.24 * s, 1.6 * s, 6, TRUNK), 0, 0.8 * s, 0));
    for (let i = 0; i < 3; i++) {
      const m = meshOf(jitter(new THREE.DodecahedronGeometry((1.15 - i * 0.25) * s, 0), 0.15 * s, rng), i % 2 ? c2 : c1);
      g.add(at(m, rng.range(-0.15, 0.15) * s, (1.8 + i * 0.7) * s, rng.range(-0.15, 0.15) * s, 0, rng() * 3, 0, [1, 0.55, 1]));
    }
  } else {
    // round: ทรงพุ่มกลม 3 ก้อนซ้อน
    g.add(at(cyl(0.17 * s, 0.26 * s, 1.5 * s, 6, TRUNK), 0, 0.75 * s, 0));
    g.add(at(cyl(0.06 * s, 0.08 * s, 0.7 * s, 5, TRUNK), 0.25 * s, 1.5 * s, 0, 0, 0, -0.7));
    g.add(at(blob(1.1 * s, c1, rng), 0, 2.3 * s, 0));
    g.add(at(blob(0.75 * s, c2, rng), 0.7 * s, 1.95 * s, 0.3 * s));
    g.add(at(blob(0.7 * s, c1, rng), -0.55 * s, 2.0 * s, -0.4 * s));
  }
  return g;
}

/**
 * พุ่มไม้ 4 ชนิด
 * @param {'round'|'berry'|'flower'|'fern'} kind
 */
export function buildBush(rng, kind, s = 1) {
  const g = new THREE.Group();
  const greens = [0x5d9e45, 0x4f8a3a, 0x6fb352];
  if (kind === 'fern') {
    // เฟิร์น: ใบยาวแผ่ออกเป็นวง
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.3;
      const leaf = cone(0.12 * s, 0.9 * s, 3, rng.pick(greens), { castShadow: false });
      leaf.scale.set(1, 1, 0.3);
      at(leaf, Math.cos(a) * 0.3 * s, 0.32 * s, Math.sin(a) * 0.3 * s, 0, 0, 0);
      leaf.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(leaf);
    }
    g.add(at(ico(0.15 * s, 0, 0x4f8a3a), 0, 0.15 * s, 0));
    return g;
  }
  const n = kind === 'round' ? 3 : 2;
  for (let i = 0; i < n; i++) {
    g.add(at(blob((0.45 - i * 0.07) * s, rng.pick(greens), rng), rng.range(-0.3, 0.3) * s, (0.35 - i * 0.05) * s, rng.range(-0.3, 0.3) * s));
  }
  if (kind === 'berry') {
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      g.add(at(ico(0.06 * s, 0, 0x2b3a8f, { castShadow: false }), Math.cos(a) * 0.38 * s, rng.range(0.25, 0.6) * s, Math.sin(a) * 0.38 * s));
    }
  } else if (kind === 'flower') {
    const fc = rng.pick([0xffffff, 0xff9fbf, 0xfff07a, 0xc9a7ff]);
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2;
      g.add(at(ico(0.07 * s, 0, fc, { castShadow: false }), Math.cos(a) * 0.4 * s, rng.range(0.35, 0.7) * s, Math.sin(a) * 0.4 * s));
    }
  }
  return g;
}

/** พุ่มผลไม้เรืองแสง (เก็บแล้วฟื้นเลือด) — คืน { group, fruit } แยกผลไว้ซ่อนตอนเก็บ */
export function buildHealBush(rng) {
  const g = buildBush(rng, 'round', 1.15);
  const fruit = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    fruit.add(at(ico(0.13, 0, glowMat(0xff6fa8, 2.2), { castShadow: false }), Math.cos(a) * 0.3, 0.75 + (i % 2) * 0.1, Math.sin(a) * 0.3));
  }
  fruit.add(at(glowSprite(0xff8fbf, 1.8, 0.6), 0, 0.8, 0));
  fruit.userData.dynamic = true;
  g.add(fruit);
  return { group: g, fruit };
}

/** หิน (เล็ก/ใหญ่) บางก้อนมีมอสด้านบน */
export function buildRock(rng, size = 1, mossy = false) {
  const g = new THREE.Group();
  const grays = [0x9a9a9f, 0x8a8a92, 0xa6a39a, 0x7f8088];
  const geo = jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.35, rng);
  const rock = meshOf(geo, rng.pick(grays));
  at(rock, 0, size * 0.45, 0, rng(), rng() * 3, rng(), [rng.range(1, 1.4), rng.range(0.6, 0.9), rng.range(0.9, 1.3)]);
  g.add(rock);
  if (mossy) g.add(at(meshOf(jitter(new THREE.IcosahedronGeometry(size * 0.75, 0), size * 0.2, rng), 0x5f9e45), 0, size * 0.85, 0, 0, rng() * 3, 0, [1.1, 0.25, 1.0]));
  return g;
}

/** ภูเขา: กรวยเขย่าจุดยอด + หิมะบนยอด */
export function buildMountain(rng, r, h, snow = true, color = null) {
  const g = new THREE.Group();
  const geo = jitter(new THREE.ConeGeometry(r, h, 7, 3), r * 0.18, rng, { keepBottom: true });
  g.add(at(meshOf(geo, color ?? rng.pick([0x7a8a9a, 0x6f8090, 0x84909c])), 0, h / 2 - 0.3, 0, 0, rng() * 3, 0));
  // ชายเขาเป็นหญ้า
  const skirt = jitter(new THREE.ConeGeometry(r * 1.05, h * 0.35, 7, 1), r * 0.12, rng, { keepBottom: true });
  g.add(at(meshOf(skirt, 0x5d8c43), 0, h * 0.17 - 0.3, 0, 0, rng() * 3, 0));
  if (snow) {
    const sgeo = jitter(new THREE.ConeGeometry(r * 0.36, h * 0.3, 7, 1), r * 0.05, rng, { keepBottom: true });
    g.add(at(meshOf(sgeo, 0xf4f7fb), 0, h - h * 0.15 - 0.15, 0, 0, rng() * 3, 0));
  }
  return g;
}

/** หญ้าเป็นกอ */
export function buildGrassTuft(rng, colors = [0x7fb356, 0x8fc260, 0x6a9e47]) {
  const g = new THREE.Group();
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    g.add(at(cone(0.05, rng.range(0.3, 0.55), 3, rng.pick(colors), { castShadow: false }), rng.range(-0.12, 0.12), 0.18, rng.range(-0.12, 0.12), rng.range(-0.35, 0.35), 0, rng.range(-0.35, 0.35)));
  }
  return g;
}

/** ดอกไม้ป่า */
export function buildFlower(rng) {
  const g = new THREE.Group();
  const c = rng.pick([0xffffff, 0xff9fbf, 0xfff07a, 0xc9a7ff, 0xff7f6b, 0x8fd3ff]);
  g.add(at(cyl(0.015, 0.015, 0.3, 3, 0x5d9e45, { castShadow: false }), 0, 0.15, 0));
  g.add(at(ico(0.07, 0, c, { castShadow: false }), 0, 0.32, 0));
  g.add(at(ico(0.03, 0, 0xffd34a, { castShadow: false }), 0, 0.37, 0));
  return g;
}

/** เห็ดเล็กๆ (ของตกแต่ง ไม่ใช่มอนสเตอร์) */
export function buildMushroomCluster(rng) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = rng.range(0.6, 1.1);
    const x = rng.range(-0.25, 0.25);
    const z = rng.range(-0.25, 0.25);
    g.add(at(cyl(0.05 * s, 0.06 * s, 0.22 * s, 5, 0xf0e2c0, { castShadow: false }), x, 0.11 * s, z));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), mat(rng.pick([0xd64545, 0xe8803a, 0xb57edc])));
    g.add(at(cap, x, 0.21 * s, z));
  }
  return g;
}

/** ท่อนไม้ล้ม + ตอไม้ */
export function buildLog(rng) {
  const g = new THREE.Group();
  g.add(at(cyl(0.32, 0.36, 3, 7, 0x7a5232), 0, 0.32, 0, 0, 0, Math.PI / 2));
  g.add(at(cyl(0.26, 0.26, 0.02, 7, 0xd9b48a), 1.51, 0.32, 0, 0, 0, Math.PI / 2));
  g.add(at(ico(0.3, 0, 0x5f9e45), 0.4, 0.62, 0.05, 0, 0, 0, [1.4, 0.4, 1]));
  g.add(at(buildMushroomCluster(rng), -0.6, 0.55, 0.1, 0, 0, 0, 0.6));
  return g;
}

export function buildStump() {
  return group(at(cyl(0.38, 0.45, 0.5, 7, 0x7a5232), 0, 0.25, 0), at(cyl(0.34, 0.34, 0.02, 7, 0xd9b48a), 0, 0.51, 0));
}

/** สะพานไม้ข้ามลำธาร (แนวยาวตามแกน Z) */
export function buildBridge(length = 6.5, width = 2.4) {
  const g = new THREE.Group();
  const n = Math.floor(length / 0.42);
  for (let i = 0; i < n; i++) {
    const z = -length / 2 + 0.21 + i * 0.42;
    const arch = Math.sin((i / (n - 1)) * Math.PI) * 0.35;
    g.add(at(box(width, 0.12, 0.38, i % 2 ? 0x9a6a3c : 0x8a5d36), 0, 0.15 + arch, z));
  }
  for (const x of [-width / 2, width / 2]) {
    for (let i = 0; i <= 4; i++) {
      const z = -length / 2 + (i / 4) * length;
      const arch = Math.sin((i / 4) * Math.PI) * 0.35;
      g.add(at(box(0.14, 0.9, 0.14, 0x6b4428), x, 0.5 + arch, z));
    }
    // ราวจับ (โค้งตามสะพาน)
    for (let i = 0; i < 4; i++) {
      const z0 = -length / 2 + (i / 4) * length;
      const z1 = -length / 2 + ((i + 1) / 4) * length;
      const a0 = Math.sin((i / 4) * Math.PI) * 0.35;
      const a1 = Math.sin(((i + 1) / 4) * Math.PI) * 0.35;
      const seg = box(0.1, 0.1, length / 4 + 0.05, 0x7a5232);
      at(seg, x, 0.9 + (a0 + a1) / 2, (z0 + z1) / 2, -Math.atan2(a1 - a0, z1 - z0), 0, 0);
      g.add(seg);
    }
  }
  return g;
}

/** ศาลคริสตัล (เป้าหมายของด่าน) */
export function buildShrine(rng) {
  const g = new THREE.Group();
  g.add(at(cyl(4.2, 4.4, 0.16, 10, 0xa6a39a), 0, 0.08, 0));
  g.add(at(cyl(3.2, 3.2, 0.06, 10, 0x8a8a92), 0, 0.17, 0));
  const stones = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const h = rng.range(2.2, 3.1);
    const st = meshOf(jitter(new THREE.BoxGeometry(0.7, h, 0.5, 1, 2, 1), 0.08, rng), 0x9a9a9f);
    at(st, Math.cos(a) * 3.6, h / 2, Math.sin(a) * 3.6, rng.range(-0.06, 0.06), -a, rng.range(-0.06, 0.06));
    g.add(st);
    // อักษรรูนเรืองแสง (สว่างเมื่อศาลตื่น)
    const rune = at(box(0.22, 0.4, 0.04, 0x3a4a5a, { castShadow: false }), Math.cos(a) * 3.33, h * 0.6, Math.sin(a) * 3.33, 0, -a + Math.PI / 2, 0);
    rune.userData.dynamic = true;
    g.add(rune);
    stones.push({ x: Math.cos(a) * 3.6, z: Math.sin(a) * 3.6, rune });
  }
  // แท่นกลาง + คริสตัล
  g.add(at(cyl(0.8, 1.0, 0.8, 6, 0x8a8a92), 0, 0.4, 0));
  g.add(at(cyl(0.95, 0.95, 0.12, 6, 0xa6a39a), 0, 0.85, 0));
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8fd8ff, flatShading: true, roughness: 0.2, emissive: 0x3aa0ff, emissiveIntensity: 0.15 });
  const crystal = new THREE.Group();
  crystal.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), crystalMat), 0, 0, 0, 0, 0, 0, [1, 2.0, 1]));
  crystal.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), crystalMat), 0.55, -0.5, 0.1, 0, 0, 0.5, [1, 2, 1]));
  crystal.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), crystalMat), -0.5, -0.6, -0.15, 0, 0, -0.5, [1, 2, 1]));
  crystal.traverse((o) => o.isMesh && (o.castShadow = true));
  crystal.position.y = 2.2;
  crystal.userData.dynamic = true;
  g.add(crystal);
  return { group: g, crystal, crystalMat, stones };
}

/** ป้ายไม้ (ทางเข้าป่า) */
export function buildSignpost() {
  const g = new THREE.Group();
  g.add(at(box(0.14, 2.0, 0.14, 0x6b4428), 0, 1.0, 0));
  g.add(at(box(1.3, 0.45, 0.08, 0x9a6a3c), 0.1, 1.65, 0));
  g.add(at(box(1.1, 0.35, 0.08, 0x9a6a3c), -0.05, 1.1, 0.02, 0, 0, -0.06));
  g.add(at(ico(0.15, 0, 0x5f9e45), 0.6, 1.95, 0));
  return g;
}

/** แจกันดอกไม้/หินกองเล็กๆ ริมทาง (cairn) */
export function buildCairn(rng) {
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const s = 0.35 - i * 0.06;
    g.add(at(meshOf(jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.2, rng), 0x9a9a9f), rng.range(-0.05, 0.05), y + s * 0.6, rng.range(-0.05, 0.05), 0, rng() * 3, 0, [1, 0.6, 1]));
    y += s * 1.1;
  }
  return g;
}
