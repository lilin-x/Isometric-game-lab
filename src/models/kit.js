// =============================================================
//  kit.js — "ชุดเครื่องมือปั้นโมเดล low poly ด้วยโค้ด"
// -------------------------------------------------------------
//  ทุกโมเดลในเกมนี้ (ตัวละคร, ตึก, ต้นไม้, มอนสเตอร์) สร้างจากรูปทรงพื้นฐาน
//  ของ three.js มาประกอบกัน เหมือนต่อเลโก้:
//     BoxGeometry       กล่อง
//     CylinderGeometry  ทรงกระบอก (ใส่จำนวนด้านน้อยๆ = ปริซึม)
//     ConeGeometry      กรวย (4 ด้าน = พีระมิด)
//     IcosahedronGeometry / DodecahedronGeometry  ทรงกลมเหลี่ยมๆ
//
//  เคล็ดลับลุค low poly:
//   1) ใช้ "flatShading" ให้แต่ละหน้าเป็นสีเรียบ เห็นเหลี่ยมชัด
//   2) ใช้จำนวนด้าน (segments) น้อยๆ
//   3) ใช้สีเรียบ (ไม่มี texture) จากชุดสี (palette) ที่เข้ากัน
//   4) บิด/เขย่าจุดยอดนิดหน่อย (jitter) ให้ดูเป็นธรรมชาติ ไม่แข็งทื่อ
// =============================================================

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- วัสดุ (Material) ----------
// ใช้ซ้ำวัสดุสีเดียวกัน (cache) → ประหยัดหน่วยความจำ และ GPU สลับสถานะน้อยลง
const materialCache = new Map();

/**
 * วัสดุแบบ low poly (flat shading)
 * @param {number|string} color
 * @param {object} [o]  emissive = สีเรืองแสง, emissiveIntensity, roughness, metalness ...
 */
export function mat(color, o = {}) {
  const key = JSON.stringify([color, o]);
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      depthWrite: o.depthWrite ?? true,
    });
    m.userData.cached = true; // ใช้ร่วมกันหลายด่าน ห้าม dispose
    materialCache.set(key, m);
  }
  return m;
}

/** วัสดุเรืองแสง (หน้าต่าง โคมไฟ คริสตัล) — ค่า intensity > 1 จะเกิด bloom */
export function glowMat(color, intensity = 2.2) {
  return mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 1 });
}

// ---------- สร้างชิ้นส่วน ----------
function finish(geo, color, o) {
  const material = color?.isMaterial ? color : mat(color, o);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = o?.castShadow ?? true;
  mesh.receiveShadow = o?.receiveShadow ?? true;
  return mesh;
}

export const box = (w, h, d, color, o) => finish(new THREE.BoxGeometry(w, h, d), color, o);
export const cyl = (rTop, rBot, h, seg, color, o) => finish(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, o);
export const cone = (r, h, seg, color, o) => finish(new THREE.ConeGeometry(r, h, seg), color, o);
export const ico = (r, detail, color, o) => finish(new THREE.IcosahedronGeometry(r, detail), color, o);
export const dodeca = (r, color, o) => finish(new THREE.DodecahedronGeometry(r, 0), color, o);
export const octa = (r, color, o) => finish(new THREE.OctahedronGeometry(r, 0), color, o);
export const sphere = (r, wSeg, hSeg, color, o) => finish(new THREE.SphereGeometry(r, wSeg, hSeg), color, o);
export const torus = (r, tube, rSeg, tSeg, color, o) => finish(new THREE.TorusGeometry(r, tube, rSeg, tSeg), color, o);
export const meshOf = (geo, color, o) => finish(geo, color, o);

/** ตั้งตำแหน่ง/การหมุน/ขนาด แบบสั้นๆ แล้วคืน object เดิม (เขียนต่อกันได้) */
export function at(obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  if (typeof s === 'number') obj.scale.setScalar(s);
  else obj.scale.set(s[0], s[1], s[2]);
  return obj;
}

/** สร้าง Group แล้วใส่ลูกๆ เข้าไป */
export function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

// ---------- ตัวสุ่มแบบกำหนด seed ได้ ----------
// Math.random() สุ่มไม่ซ้ำทุกครั้ง แต่ฉากในเกมควร "เหมือนเดิมทุกครั้งที่โหลด"
// จึงใช้ตัวสุ่มที่ใส่ seed ได้ (mulberry32): seed เดิม = ผลสุ่มชุดเดิม
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (min, max) => min + rng() * (max - min);
  rng.int = (min, max) => Math.floor(rng.range(min, max + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  return rng;
}

/**
 * เขย่าจุดยอด (vertex) ของ geometry แบบสุ่ม → หิน/ภูเขาดูเป็นธรรมชาติ
 * ต้อง mergeVertices ก่อน ไม่งั้นหน้าที่ติดกันจะขยับไม่พร้อมกันจนเกิดรู
 */
export function jitter(geo, amount, rng, { keepBottom = false } = {}) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const g = mergeVertices(geo);
  const pos = g.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
  for (let i = 0; i < pos.count; i++) {
    if (keepBottom && pos.getY(i) <= minY + 1e-4) {
      pos.setX(i, pos.getX(i) + (rng() - 0.5) * amount);
      pos.setZ(i, pos.getZ(i) + (rng() - 0.5) * amount);
      continue;
    }
    pos.setXYZ(i, pos.getX(i) + (rng() - 0.5) * amount, pos.getY(i) + (rng() - 0.5) * amount, pos.getZ(i) + (rng() - 0.5) * amount);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- Glow sprite (แสงฟุ้งรอบโคมไฟ) ----------
let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

const glowMatCache = new Map();
/** Sprite เรืองแสงแบบ additive (ยิ่งซ้อนยิ่งสว่าง) — ถูกและสวยกว่าใช้ไฟจริงทุกดวง */
export function glowSprite(color, size = 1.5, opacity = 0.6) {
  const key = `${color}-${opacity}`;
  let m = glowMatCache.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    m.userData.cached = true;
    glowMatCache.set(key, m);
  }
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  s.renderOrder = 5;
  return s;
}

// ---------- รวมชิ้นส่วนนิ่งๆ ให้เป็นก้อนเดียว (ลด draw call) ----------
/**
 * ทุก Mesh = อย่างน้อย 1 "draw call" (คำสั่งวาดที่ CPU ส่งให้ GPU)
 * ฉากเมืองมีชิ้นส่วนเป็นหมื่นชิ้น ถ้าวาดทีละชิ้นจะช้ามาก
 *
 * เทคนิค "vertex color batching":
 *   วัสดุสีเรียบๆ (ไม่เรืองแสง ไม่โปร่งใส) ต่างกันแค่ "สี"
 *   → เราย้ายสีไปเก็บไว้ที่จุดยอด (vertex color) แทน
 *   → รวมทุกชิ้นเป็น mesh เดียว ใช้วัสดุเดียว!
 * ส่วนวัสดุพิเศษ (เรืองแสง/โปร่งใส) รวมเฉพาะชิ้นที่ใช้วัสดุเดียวกัน
 *
 * ใช้กับของที่ไม่ขยับเท่านั้น — ชิ้นไหนไม่อยากให้ถูกรวม ให้ตั้ง userData.dynamic = true
 */
const vcMaterials = new Map();
function vertexColorMaterial(roughness = 0.85) {
  const key = roughness.toFixed(2);
  if (!vcMaterials.has(key)) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness });
    m.userData.cached = true;
    vcMaterials.set(key, m);
  }
  return vcMaterials.get(key);
}

function isPlain(m) {
  return (
    m.isMeshStandardMaterial && !m.transparent && !m.map && !m.vertexColors &&
    (m.emissiveIntensity === 0 || m.emissive.getHex() === 0) && m.metalness < 0.3
  );
}

/** เตรียม geometry ให้รวมกันได้: เหลือแค่ position/normal(/color), ไม่มี index, แปลงตำแหน่งแล้ว */
function prepGeometry(mesh, matrix, color) {
  let g = mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  if (color) {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = color.r;
      arr[i * 3 + 1] = color.g;
      arr[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

function mergeBuckets(target, buckets) {
  let count = 0;
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.userData.baked = true;
    target.add(mesh);
    count++;
  }
  return count;
}

function bucketFor(buckets, o) {
  const plain = isPlain(o.material);
  const material = plain ? vertexColorMaterial(Math.round(o.material.roughness * 10) / 10) : o.material;
  const key = `${material.uuid}|${o.castShadow}|${o.receiveShadow}`;
  if (!buckets.has(key)) buckets.set(key, { material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
  return { bucket: buckets.get(key), plain };
}

export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  const m4 = new THREE.Matrix4();

  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic) return;
    let p = o.parent;
    while (p && p !== root) {
      if (p.userData.dynamic) return;
      p = p.parent;
    }
    const { bucket, plain } = bucketFor(buckets, o);
    bucket.geos.push(prepGeometry(o, m4.multiplyMatrices(inv, o.matrixWorld), plain ? o.material.color : null));
    remove.push(o);
  });

  for (const o of remove) o.parent.remove(o);
  // ลบ group ว่างๆ ที่เหลือทิ้ง
  let removed = true;
  while (removed) {
    removed = false;
    const empties = [];
    root.traverse((o) => {
      if (o !== root && o.type === 'Group' && o.children.length === 0 && !o.userData.dynamic) empties.push(o);
    });
    for (const e of empties) {
      e.parent?.remove(e);
      removed = true;
    }
  }
  const after = mergeBuckets(root, buckets);
  return { before: remove.length, after };
}

/**
 * รวมชิ้นส่วนของ "ตัวละคร" ทีละข้อต่อ (joint)
 * ชิ้นที่อยู่ในข้อต่อเดียวกันขยับพร้อมกันเสมอ → รวมเป็น mesh เดียวได้
 * เช่น หัว (หัว+ผม+ตา+หู+หมวก ~20 ชิ้น) → เหลือ 1 ชิ้น
 * @param {THREE.Object3D} root
 * @param {Set<THREE.Material>} [keep] วัสดุที่ไม่ต้องรวม (เช่น ใบดาบที่ต้องเรืองแสงเอง)
 */
export function compactRig(root, keep = new Set()) {
  const groups = [];
  root.traverse((o) => {
    if (!o.isMesh) groups.push(o);
  });
  let saved = 0;
  for (const g of groups) {
    const buckets = new Map();
    const leaves = g.children.filter((c) => c.isMesh && c.children.length === 0 && !keep.has(c.material) && !c.userData.dynamic);
    if (leaves.length < 2) continue;
    for (const c of leaves) {
      c.updateMatrix();
      const { bucket, plain } = bucketFor(buckets, c);
      bucket.geos.push(prepGeometry(c, c.matrix, plain ? c.material.color : null));
      g.remove(c);
    }
    saved += leaves.length - mergeBuckets(g, buckets);
  }
  return saved;
}

/** คัดลอกวัสดุทุกชิ้นของโมเดล (เพื่อให้กระพริบ/เปลี่ยนสีเฉพาะตัวนี้ได้) */
export function cloneMaterials(root, skip = new Set()) {
  const map = new Map();
  root.traverse((o) => {
    if (!o.isMesh || skip.has(o.material) || o.userData.isSilhouette) return;
    if (!map.has(o.material)) {
      const c = o.material.clone();
      c.userData = {}; // ของใหม่ ไม่ใช่ของที่ใช้ร่วมกัน → dispose ได้
      map.set(o.material, c);
    }
    o.material = map.get(o.material);
  });
  return [...map.values()];
}

/**
 * เพิ่ม "เงาทะลุ" (silhouette): เวลาตัวละครเดินไปหลังตึก/ต้นไม้
 * จะเห็นเป็นเงาสีเรียบๆ แทนที่จะหายไปเลย
 * หลักการ: วาด mesh ซ้ำอีกชั้นด้วย depthFunc = GreaterDepth
 *   → วาดเฉพาะส่วนที่ "อยู่ลึกกว่า" ของที่วาดไว้แล้ว (คือส่วนที่ถูกบัง)
 * ลำดับการวาด (renderOrder): ฉาก(0) → เงาทะลุ(1) → ตัวละคร(2)
 */
export function addSilhouette(root, color = 0x9fd8ff) {
  const m = new THREE.MeshBasicMaterial({ color, depthFunc: THREE.GreaterDepth, depthWrite: false });
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.noSilhouette) meshes.push(o);
  });
  for (const o of meshes) {
    o.renderOrder = 2;
    const s = new THREE.Mesh(o.geometry, m);
    s.renderOrder = 1;
    s.castShadow = false;
    s.receiveShadow = false;
    s.userData.noSilhouette = true;
    s.userData.isSilhouette = true;
    o.add(s);
  }
  return m;
}
