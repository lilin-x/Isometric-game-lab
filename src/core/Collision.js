// =============================================================
//  Collision.js — ระบบชนแบบง่ายบนพื้นราบ (2D บนแกน X-Z)
// -------------------------------------------------------------
//  เกมนี้ไม่ใช้ physics engine เต็มรูปแบบ เพราะเกม isometric ส่วนใหญ่
//  ต้องการแค่ "อย่าเดินทะลุกำแพง/ต้นไม้" เท่านั้น
//
//  เราใช้รูปทรงง่ายๆ 2 แบบ:
//    • Circle (วงกลม)  — ต้นไม้, หิน, เสา, ตัวละคร
//    • Box   (สี่เหลี่ยมไม่หมุน: AABB) — ตึก, แผงร้านค้า, กำแพง
//
//  วิธี "แก้การชน" (collision resolution):
//    ถ้าวงกลมของตัวละครซ้อนกับสิ่งกีดขวาง → ดันออกไปตามทิศที่สั้นที่สุด
// =============================================================

export class CollisionWorld {
  constructor() {
    this.circles = []; // {x, z, r}
    this.boxes = []; // {minX, minZ, maxX, maxZ}
    this.bounds = null; // ขอบเขตแผนที่ {minX, minZ, maxX, maxZ}
  }

  addCircle(x, z, r) {
    const c = { x, z, r };
    this.circles.push(c);
    return c;
  }

  /** เพิ่มกล่องจากจุดกึ่งกลางและขนาด (กว้าง w ตามแกน X, ลึก d ตามแกน Z) */
  addBox(x, z, w, d) {
    const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    this.boxes.push(b);
    return b;
  }

  setBounds(minX, minZ, maxX, maxZ) {
    this.bounds = { minX, minZ, maxX, maxZ };
  }

  /**
   * ดันตำแหน่ง pos (Vector3 หรือ {x,z}) ออกจากสิ่งกีดขวางทั้งหมด
   * คืนค่า true ถ้ามีการชน
   */
  resolve(pos, radius) {
    let hit = false;
    // ทำ 2 รอบ เผื่อดันออกจากชิ้นหนึ่งแล้วไปซ้อนอีกชิ้น
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.circles) {
        if (pushOutOfCircle(pos, radius, c)) hit = true;
      }
      for (const b of this.boxes) {
        if (pushOutOfBox(pos, radius, b)) hit = true;
      }
    }
    if (this.bounds) {
      const { minX, minZ, maxX, maxZ } = this.bounds;
      if (pos.x < minX + radius) { pos.x = minX + radius; hit = true; }
      if (pos.x > maxX - radius) { pos.x = maxX - radius; hit = true; }
      if (pos.z < minZ + radius) { pos.z = minZ + radius; hit = true; }
      if (pos.z > maxZ - radius) { pos.z = maxZ - radius; hit = true; }
    }
    return hit;
  }

  /** เช็คว่าจุดนี้ว่างไหม (ใช้สุ่มที่เดินของ NPC/มอนสเตอร์) */
  isFree(x, z, radius) {
    for (const c of this.circles) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return false;
    }
    for (const b of this.boxes) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if (Math.hypot(x - cx, z - cz) < radius) return false;
    }
    if (this.bounds) {
      const { minX, minZ, maxX, maxZ } = this.bounds;
      if (x < minX + radius || x > maxX - radius || z < minZ + radius || z > maxZ - radius) return false;
    }
    return true;
  }
}

/** วงกลม vs วงกลม: ถ้าระยะห่างจุดศูนย์กลาง < ผลรวมรัศมี แปลว่าชน */
function pushOutOfCircle(pos, radius, c) {
  const dx = pos.x - c.x;
  const dz = pos.z - c.z;
  const minDist = radius + c.r;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return false;
  const dist = Math.sqrt(distSq) || 0.0001;
  const push = minDist - dist;
  pos.x += (dx / dist) * push;
  pos.z += (dz / dist) * push;
  return true;
}

/** วงกลม vs กล่อง: หาจุดบนกล่องที่ใกล้วงกลมที่สุด แล้วเช็คระยะ */
function pushOutOfBox(pos, radius, b) {
  const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq >= radius * radius) return false;

  if (distSq > 1e-8) {
    // จุดศูนย์กลางอยู่นอกกล่อง → ดันออกตามทิศจากจุดใกล้สุด
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    pos.x += (dx / dist) * push;
    pos.z += (dz / dist) * push;
  } else {
    // จุดศูนย์กลางหลุดเข้าไปในกล่อง → ดันออกด้านที่ใกล้ที่สุด
    const left = pos.x - b.minX;
    const right = b.maxX - pos.x;
    const top = pos.z - b.minZ;
    const bottom = b.maxZ - pos.z;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = b.minX - radius;
    else if (m === right) pos.x = b.maxX + radius;
    else if (m === top) pos.z = b.minZ - radius;
    else pos.z = b.maxZ + radius;
  }
  return true;
}

/**
 * แยกตัวละครที่ซ้อนกัน (ผู้เล่น/มอนสเตอร์/NPC) ออกจากกันแบบนุ่มๆ
 * ตัวที่ mass มากจะขยับน้อยกว่า
 */
export function separateBodies(bodies) {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const minDist = a.radius + b.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist || distSq < 1e-8) continue;
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const ma = a.mass ?? 1;
      const mb = b.mass ?? 1;
      const wa = a.immovable ? 0 : mb / (ma + mb);
      const wb = b.immovable ? 0 : ma / (ma + mb);
      const nx = dx / dist;
      const nz = dz / dist;
      a.position.x -= nx * overlap * wa;
      a.position.z -= nz * overlap * wa;
      b.position.x += nx * overlap * wb;
      b.position.z += nz * overlap * wb;
    }
  }
}
