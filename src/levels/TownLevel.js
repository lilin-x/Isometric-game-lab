// =============================================================
//  TownLevel.js — ด่าน 1: เมืองโคมไฟ (Lanternbrook)
// -------------------------------------------------------------
//  ผังเมือง (มองจากด้านบน, กล้อง isometric อยู่มุมล่างขวา +X +Z):
//
//            z = -21  ═══════ กำแพง ═══[ ประตู ]═══ กำแพง ═══
//                    │ ตึกสูง NW      │ │  ลานฝึก   ช่างตีเหล็ก
//                    │                │ │
//           ─────────┼──── ถนน ───── ( น้ำพุ ) ──── ถนน ─────────  z = 0
//                    │ ร้านยา/เบเกอรี่ │ │  ตลาด    สวน
//                    │                │ │
//            z = +21  ······· รั้วต้นไม้เตี้ย (ไม่บังกล้อง) ·······
//                  x = -21              x = 0               x = +21
//
//  กฎออกแบบด่าน isometric: ของสูงไว้ "ด้านหลัง" (−X, −Z = บนจอ)
//  ของเตี้ยไว้ "ด้านหน้า" (+X, +Z = ล่างจอ) จะได้ไม่บังตัวละคร
// =============================================================

import * as THREE from 'three';
import { Level } from './Level.js';
import { CONFIG } from '../config.js';
import { NPC, Cat } from '../entities/NPC.js';
import { TrainingDummy } from '../entities/TrainingDummy.js';
import { box, cyl, cone, ico, at, mat, glowMat, glowSprite, makeRng, bakeStatic } from '../models/kit.js';
import {
  TOWN_COLORS, buildTower, buildLanternPost, buildStall, buildFountain, buildBarrel, buildCrate, buildSack,
  buildBench, buildPlanterTree, buildFlowerPot, buildCart, buildForge, buildNoticeBoard, buildGate, buildWall,
  buildStringLights, buildLaundry,
} from '../models/town.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class TownLevel extends Level {
  build() {
    const rng = makeRng(20261103);
    this.rng = rng;
    this.decor = new THREE.Group(); // ของนิ่งทั้งหมด → จะถูก bake รวมกันตอนท้าย
    this.root.add(this.decor);

    this.setupLights({
      background: 0x2c2645,
      fog: { color: 0x2c2645, near: 46, far: 85 },
      sky: 0xa9b4ff,
      ground: 0x6a4a3a,
      hemiIntensity: 1.15,
      sunColor: 0xffb070,
      sunIntensity: 1.7,
      sunDir: [0.55, 0.95, 0.8],
    });
    this.collision.setBounds(-20, -20.5, 20, 20);

    this._buildGround(rng);
    this._buildPlaza(rng);
    this._buildBuildings(rng);
    this._buildWallsAndGate();
    this._buildMarket(rng);
    this._buildTrainingYard();
    this._buildStreetLights(rng);
    this._buildDecorations(rng);

    // รวม mesh นิ่งๆ ทั้งหมดให้เหลือน้อยชิ้น (ลด draw call จากหลายพัน → หลักสิบ)
    const stats = bakeStatic(this.decor);
    this.bakeStats = stats;

    this._setupAnimators(rng);
    this._spawnNPCs();
    this.spawnPlayer(V(0, 0, 16.5), Math.PI);
    // กล้องไม่เลื่อนออกนอกเมืองมากเกินไป
    this.game.iso.bounds = { minX: -15, maxX: 12, minZ: -16, maxZ: 12 };
  }

  onEnter() {
    this.game.hud.banner('เมืองโคมไฟ', 'ด่าน 1 · Lanternbrook');
    this.game.hud.setObjective('คุยกับชาวเมือง · ลองฟันหุ่นที่ <b>ลานฝึก</b> · ออก <b>ประตูเมือง</b> ไปป่า');
  }

  // ---------------------------------------------------------
  //  พื้น + ถนนหินปู
  // ---------------------------------------------------------
  _buildGround(rng) {
    // พื้นหญ้าผืนใหญ่ ทำสีให้ด่างนิดๆ ด้วย vertex color
    const geo = new THREE.PlaneGeometry(110, 110, 44, 44).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    const colors = [];
    const base = new THREE.Color(0x6f8a4a);
    const c = new THREE.Color();
    const count = geo.attributes.position.count;
    for (let i = 0; i < count; i += 3) {
      c.copy(base).offsetHSL(rng.range(-0.02, 0.02), rng.range(-0.05, 0.05), rng.range(-0.04, 0.04));
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    ground.receiveShadow = true;
    ground.userData.dynamic = true; // ไม่ต้อง bake (เป็นชิ้นเดียวอยู่แล้ว)
    this.root.add(ground);

    // ฐานถนน (สีปูน) ใต้ก้อนหิน
    const grout = 0x5d5349;
    this.decor.add(at(box(5.6, 0.03, 42, grout, { castShadow: false }), 0, 0.015, 0));
    this.decor.add(at(box(42, 0.03, 5.6, grout, { castShadow: false }), 0, 0.015, 0));
    const plazaBase = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 0.04, 24), mat(grout));
    plazaBase.position.y = 0.02;
    plazaBase.receiveShadow = true;
    this.decor.add(plazaBase);

    // ก้อนหินปูถนน (grid) — สุ่มขนาด/สี/มุมเล็กน้อย
    const stoneColors = [0xb9ab96, 0xa89a86, 0xc7baa3, 0x9d907e];
    const addStone = (x, z, s, ry) => {
      this.decor.add(at(box(s, 0.06, s * rng.range(0.85, 1.1), rng.pick(stoneColors), { castShadow: false }), x, 0.032, z, 0, ry, 0));
    };
    const step = 0.56;
    for (let x = -20.8; x <= 20.8; x += step) {
      for (let z = -20.8; z <= 20.8; z += step) {
        const onStreet = Math.abs(x) < 2.6 || Math.abs(z) < 2.6;
        if (!onStreet || Math.hypot(x, z) < 7.6) continue;
        addStone(x + rng.range(-0.04, 0.04), z + rng.range(-0.04, 0.04), rng.range(0.42, 0.5), rng.range(-0.08, 0.08));
      }
    }
    // ลานน้ำพุ: เรียงเป็นวงๆ (radial)
    for (let r = 2.5; r < 7.4; r += 0.55) {
      const n = Math.floor((Math.PI * 2 * r) / 0.55);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r;
        addStone(Math.cos(a) * r, Math.sin(a) * r, rng.range(0.4, 0.48), -a);
      }
    }

    // หญ้าเป็นกอ + ดอกไม้เล็กๆ บนพื้นหญ้า
    const grassC = [0x7fa356, 0x8db35f, 0x6a9447];
    const flowerC = [0xff9fbf, 0xfff3a0, 0xffffff, 0xc9a7ff];
    for (let i = 0; i < 260; i++) {
      const x = rng.range(-20, 20);
      const z = rng.range(-20, 20);
      if (Math.abs(x) < 3.2 || Math.abs(z) < 3.2 || Math.hypot(x, z) < 8) continue;
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) g.add(at(cone(0.06, rng.range(0.25, 0.4), 3, rng.pick(grassC), { castShadow: false }), rng.range(-0.1, 0.1), 0.15, rng.range(-0.1, 0.1), rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)));
      if (rng() < 0.3) g.add(at(ico(0.06, 0, rng.pick(flowerC), { castShadow: false }), 0, 0.32, 0));
      at(g, x, 0, z);
      this.decor.add(g);
    }
  }

  // ---------------------------------------------------------
  //  ลานน้ำพุกลางเมือง
  // ---------------------------------------------------------
  _buildPlaza(rng) {
    const f = buildFountain();
    this.decor.add(f.group);
    this.fountainWater = f.water;
    this.collision.addCircle(0, 0, 2.15);

    // ม้านั่ง 4 ตัว หันเข้าหาน้ำพุ
    this.benches = [];
    for (const [x, z] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) {
      const ry = Math.atan2(-x, -z);
      const b = at(buildBench(), x, 0, z, 0, ry, 0);
      this.decor.add(b);
      this.collision.addCircle(x, z, 0.55);
      this.benches.push({ x, z, ry });
    }
  }

  // ---------------------------------------------------------
  //  ตึก
  // ---------------------------------------------------------
  _buildBuildings(rng) {
    // [x, z, w, d, floors, door, ตัวเลือกเพิ่ม]
    const lots = [
      // --- NW: ตึกสูงเยื้องๆ (ด้านหลังของภาพ = ฉากหลังที่สวยที่สุด) ---
      [-7.2, -10.5, 4.2, 4.2, 4, 'x', { sign: 'inn', shop: true, awningColors: [0x3f8a86, 0xfff3dc] }],
      [-7.4, -16.2, 4.4, 4.6, 6, 'x', { roof: 'spire', turret: true }],
      [-12.2, -7.4, 4.4, 4.0, 5, 'z', { roof: 'gable' }],
      [-17.2, -7.6, 4.2, 4.4, 4, 'z', { roof: 'pyramid', baseStone: true }],
      [-13.4, -14.0, 5.0, 5.0, 7, null, { roof: 'spire', turret: true, baseStone: true }],
      [-18.0, -16.5, 3.6, 4.0, 5, null, { roof: 'dome' }],
      [-12.5, -19.0, 4.0, 2.6, 4, null, { roof: 'gable' }],
      // --- SW: ร้านค้าเรียงริมถนนหลัก (ประตูหัน +X มาทางถนน) ---
      [-7.0, 8.2, 4.4, 4.2, 3, 'x', { shop: true, sign: 'potion', awningColors: [0x7c4f8f, 0xf3e6ff] }],
      [-7.0, 13.6, 4.4, 4.4, 2, 'x', { shop: true, sign: 'bread', awningColors: [0xd9a441, 0xfff3dc], chimney: true }],
      [-7.2, 18.6, 4.2, 3.4, 2, 'x', { roof: 'gable' }],
      [-12.5, 9.5, 4.0, 4.6, 4, null, { roof: 'gable' }],
      [-12.8, 15.6, 4.2, 4.4, 3, null, { roof: 'pyramid' }],
      [-17.6, 7.2, 3.8, 4.2, 5, 'z', { roof: 'spire' }],
      [-17.8, 13.4, 3.8, 4.0, 3, null, {}],
      [-17.4, 18.6, 4.0, 3.4, 2, null, {}],
      // --- NE: ด้านหลังลานฝึก ---
      [15.4, -15.4, 4.4, 4.0, 2, 'z', { shop: true, sign: 'sword', awningColors: [0x4f6497, 0xdfe8f0], chimney: true }],
      [11.0, -18.6, 4.0, 2.8, 4, null, { roof: 'pyramid' }],
      [18.6, -9.5, 2.8, 4.4, 3, 'x', { roof: 'gable' }],
      [18.5, -19.0, 3.4, 2.8, 5, null, { roof: 'spire' }],
    ];
    for (const [x, z, w, d, floors, door, extra] of lots) {
      const t = buildTower(rng, { floors, w, d, door, ...extra });
      at(t.group, x, 0, z);
      this.decor.add(t.group);
      this.collision.addBox(x, z, w + 0.2, d + 0.2);
    }

    // ตึกไกลๆ นอกกำแพง (ฉากหลังให้รู้สึกว่าเมืองใหญ่)
    const far = [
      [-26, -8, 5], [-27, 3, 4], [-25, 14, 6], [-26, -20, 7], [-8, -27, 6], [7, -26, 5], [17, -27, 7], [-19, -27, 4],
    ];
    for (const [x, z, floors] of far) {
      const t = buildTower(rng, { floors, w: 4.4, d: 4.4, litChance: 0.5 });
      at(t.group, x, 0, z);
      this.decor.add(t.group);
    }
  }

  // ---------------------------------------------------------
  //  กำแพงเมือง + ประตู
  // ---------------------------------------------------------
  _buildWallsAndGate() {
    // กำแพงด้านหลัง (เหนือ z=-21 และตะวันตก x=-21): สูงได้ เพราะอยู่ "หลังภาพ"
    const north1 = at(buildWall(16.5), -12.25, 0, -21.5);
    const north2 = at(buildWall(16.5), 12.25, 0, -21.5);
    const west = at(buildWall(43), -21.5, 0, 0, 0, Math.PI / 2, 0);
    this.decor.add(north1, north2, west);
    this.collision.addBox(-12.25, -21.5, 16.5, 1);
    this.collision.addBox(12.25, -21.5, 16.5, 1);

    const gate = at(buildGate(), 0, 0, -21.5);
    this.decor.add(gate);
    this.collision.addCircle(-3.3, -21.5, 1.6);
    this.collision.addCircle(3.3, -21.5, 1.6);

    // ด้านหน้า (ใต้ z=+21 และตะวันออก x=+21): รั้วพุ่มไม้เตี้ย ไม่บังกล้อง
    const hedge = (x, z, w, d) => {
      this.decor.add(at(box(w, 0.8, d, 0x4f7a3a), x, 0.4, z));
      for (let i = 0; i < Math.max(w, d) / 1.2; i++) {
        const px = w > d ? x - w / 2 + 0.6 + i * 1.2 : x;
        const pz = w > d ? z : z - d / 2 + 0.6 + i * 1.2;
        this.decor.add(at(ico(0.5, 0, 0x5d8c43), px, 0.85, pz, i, i * 2, 0));
      }
    };
    hedge(21.2, -11, 0.9, 20);
    hedge(21.2, 11.5, 0.9, 19);
    hedge(-11.5, 21.2, 19, 0.9);
    hedge(11.5, 21.2, 19, 0.9);

    // ทางออกไปป่า (ด้านนอกประตู): ทางดิน + ต้นไม้
    this.decor.add(at(box(5, 0.03, 12, 0x9a8462, { castShadow: false }), 0, 0.02, -28));
    for (const [x, z, c] of [[-5, -25, 0x6aa84f], [6, -24.5, 0xe69138], [-3, -31, 0xd9534f], [4, -30, 0x93c47d]]) {
      this.decor.add(at(cyl(0.15, 0.2, 1.6, 6, 0x6b4428), x, 0.8, z));
      this.decor.add(at(ico(1.2, 0, c), x, 2.3, z));
    }

    // จุดออกเดินทาง: เดินไปที่ประตูแล้วกด E
    this.addInteractable({
      position: V(0, 0, -19.6),
      range: 3.2,
      prompt: 'ออกเดินทางสู่ <b>ป่าหลากสี</b>',
      promptHeight: 3,
      onInteract: () => {
        this.game.audio.play('portal');
        this.game.goTo('forest');
      },
    });
  }

  // ---------------------------------------------------------
  //  ตลาด (SE) — ของเตี้ย ไม่บังกล้อง
  // ---------------------------------------------------------
  _buildMarket(rng) {
    const stalls = [
      [6.6, 6.0, 'fruit', [0xd63a2f, 0xfff3dc]],
      [10.6, 6.0, 'cloth', [0x3f8a86, 0xfff3dc]],
      [14.6, 6.0, 'potion', [0x7c4f8f, 0xf3e6ff]],
    ];
    for (const [x, z, kind, colors] of stalls) {
      this.decor.add(at(buildStall(rng, kind, colors), x, 0, z));
      this.collision.addBox(x, z, 2.4, 1.4);
    }
    // ลังผลไม้ ถัง กระสอบ
    const props = [
      [buildCrate(), 4.6, 7.4, 0.35], [buildCrate(0.45), 4.8, 8.1, 0.3], [buildBarrel(), 8.6, 7.3, 0.35],
      [buildSack(), 12.5, 7.4, 0.3], [buildBarrel(0x7a5232), 16.5, 6.6, 0.35], [buildCrate(), 16.6, 7.6, 0.35],
      [buildCart(), 16.5, 13.8, 0], [buildBarrel(), -4.4, 6.4, 0.35], [buildCrate(), -4.4, 11.2, 0.35],
      [buildSack(), -4.3, 16.6, 0.3], [buildBarrel(), -4.8, -7.2, 0.35], [buildCrate(0.5), -4.6, -13.2, 0.3],
      [buildBarrel(), 12.7, -12.4, 0.35], [buildCrate(), 17.6, -12.6, 0.35],
    ];
    for (const [obj, x, z, r] of props) {
      at(obj, x, 0, z, 0, rng.range(-0.4, 0.4), 0);
      this.decor.add(obj);
      if (r) this.collision.addCircle(x, z, r);
    }
    this.collision.addBox(16.5, 13.8, 3.2, 1.4);

    // สวนเล็กๆ: ต้นไม้ในกระถาง กระถางดอกไม้ ม้านั่ง
    const trees = [[8, 12.5], [13, 12.5], [8, 17.5], [13, 17.5], [-4.5, -17.5], [4.6, 12], [-16, 2.2]];
    trees.forEach(([x, z], i) => {
      this.decor.add(at(buildPlanterTree(rng, [0x6aa84f, 0xe69138, 0xd9534f, 0x93c47d][i % 4]), x, 0, z));
      this.collision.addBox(x, z, 1.1, 1.1);
    });
    for (const [x, z] of [[10.5, 15], [5.5, 18.5]]) {
      this.decor.add(at(buildBench(), x, 0, z, 0, Math.PI / 2, 0));
      this.collision.addBox(x, z, 0.6, 1.6);
    }
    for (let i = 0; i < 10; i++) {
      const x = rng.range(5, 19);
      const z = rng.range(10, 19.5);
      if (!this.collision.isFree(x, z, 0.6)) continue;
      this.decor.add(at(buildFlowerPot(rng), x, 0, z));
      this.collision.addCircle(x, z, 0.25);
    }
  }

  // ---------------------------------------------------------
  //  ลานฝึก (NE ใกล้ประตู) + ช่างตีเหล็ก
  // ---------------------------------------------------------
  _buildTrainingYard() {
    // รั้วไม้เตี้ย 2 ด้านที่หันหากล้อง
    const fence = (x, z, w, d) => {
      const g = new THREE.Group();
      g.add(at(box(w, 0.08, d, 0x8a5d36), 0, 0.55, 0));
      g.add(at(box(w, 0.08, d, 0x8a5d36), 0, 0.3, 0));
      const n = Math.max(w, d) / 1.1;
      for (let i = 0; i <= n; i++) {
        const px = w > d ? -w / 2 + i * 1.1 : 0;
        const pz = w > d ? 0 : -d / 2 + i * 1.1;
        g.add(at(box(0.12, 0.8, 0.12, 0x6b4428), px, 0.4, pz));
      }
      at(g, x, 0, z);
      this.decor.add(g);
      this.collision.addBox(x, z, Math.max(w, 0.2), Math.max(d, 0.2));
    };
    fence(7.5, -9.3, 6, 0.12);
    fence(10.6, -13.2, 0.12, 7.6);
    this.decor.add(at(box(6, 0.03, 7.4, 0xb59a6e, { castShadow: false }), 7.6, 0.025, -13.2));
    this.dummies.push(new TrainingDummy(this.game, this, V(6.0, 0, -12.2), 0.3));
    this.dummies.push(new TrainingDummy(this.game, this, V(8.6, 0, -13.0), 0.6));
    this.dummies.push(new TrainingDummy(this.game, this, V(6.8, 0, -15.6), 0.2));
    const board = at(buildNoticeBoard(), 4.2, 0, -10.0, 0, 0.6, 0);
    this.decor.add(board);
    this.collision.addCircle(4.2, -10, 0.6);
    this.addInteractable({
      position: V(4.2, 0, -10),
      range: 2,
      prompt: 'อ่านป้าย',
      promptHeight: 2.4,
      onInteract: () =>
        this.game.dialogue.open('ป้ายลานฝึก', [
          'ลานฝึกดาบ — ใช้ได้ฟรี! หุ่นฟางเลือดไม่มีวันหมด',
          'ฟันเบา: คลิกซ้ายรัวๆ ได้คอมโบ 3 จังหวะ (ใช้ stamina 12 ต่อครั้ง) จังหวะที่ 3 แรงสุด',
          'ฟันแรง: กดคลิกขวาค้างเพื่อชาร์จ ยิ่งค้างนานยิ่งแรง (25 → 60) แล้วปล่อยเพื่อหมุนฟันรอบตัว',
          'กลิ้งหลบ: กด Space ระหว่างกลิ้งจะอมตะชั่วขณะ แต่ใช้ stamina 20',
          'ถ้า stamina หมดหลอด จะหอบเหนื่อย 4 วินาที ทำอะไรไม่ได้ แล้วค่อยฟื้นกลับมาครึ่งหลอด — อย่าใช้จนหมดนะ!',
        ]),
    });

    const forge = buildForge();
    at(forge.group, 14.2, 0, -10.6);
    this.decor.add(forge.group);
    this.collision.addBox(14.2, -10.6, 1.5, 1.3);
    this.collision.addCircle(15.8, -10.0, 0.35);
    this.anvilPos = forge.anvilPos.clone().add(V(14.2, 0, -10.6));
    this.forgeLightPos = V(14.2, 1.6, -10.6);
  }

  // ---------------------------------------------------------
  //  โคมไฟถนน + ไฟประดับ
  // ---------------------------------------------------------
  _buildStreetLights(rng) {
    this.lightSpots = [];
    const posts = [
      [3.3, 9.5, Math.PI], [-3.3, 12.5, 0], [3.3, 17, Math.PI], [-3.3, -10.5, 0], [3.3, -12.5, Math.PI], [-3.3, -17.5, 0],
      [9.5, 3.3, Math.PI / 2], [12.5, -3.3, -Math.PI / 2], [17.5, 3.3, Math.PI / 2], [-10, 3.3, Math.PI / 2], [-12.5, -3.3, -Math.PI / 2], [-18, 3.3, Math.PI / 2],
    ];
    posts.forEach(([x, z, ry], i) => {
      const p = buildLanternPost();
      at(p.group, x, 0, z, 0, ry, 0);
      this.decor.add(p.group);
      this.collision.addCircle(x, z, 0.22);
      const lp = p.lightPos.clone().applyAxisAngle(V(0, 1, 0), ry).add(V(x, 0, z));
      if (i % 2 === 0) this.lightSpots.push(lp);
    });

    // เสาไฟประดับรอบลาน + เส้นไฟห้อยเป็นวง
    const poles = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * 7.6;
      const z = Math.sin(a) * 7.6;
      this.decor.add(at(cyl(0.07, 0.09, 3.8, 6, 0x6b4428), x, 1.9, z));
      this.decor.add(at(ico(0.12, 0, 0xe8b84a), x, 3.85, z));
      this.collision.addCircle(x, z, 0.15);
      poles.push(V(x, 3.7, z));
    }
    for (let i = 0; i < n; i++) this.decor.add(buildStringLights(poles[i], poles[(i + 1) % n], { sag: 0.6, bulbs: 9, rng }));
    // เส้นไฟข้ามถนนหลัก (จากตึกฝั่งซ้ายไปเสาฝั่งขวา)
    for (const z of [-13, 11]) {
      this.decor.add(at(cyl(0.07, 0.09, 4.6, 6, 0x6b4428), 3.4, 2.3, z));
      this.collision.addCircle(3.4, z, 0.15);
      this.decor.add(buildStringLights(V(-4.9, 4.4, z), V(3.4, 4.4, z), { sag: 0.9, bulbs: 10, rng }));
    }
    this.decor.add(buildStringLights(V(-4.9, 4.4, 4), V(-4.9, 4.4, -4), { sag: 0.5, bulbs: 7, flags: true, rng }));

    // ราวตากผ้าระหว่างตึกฝั่ง NW
    this.decor.add(buildLaundry(V(-9.3, 5.6, -10.0), V(-10.8, 5.6, -7.4), rng));
    this.decor.add(buildLaundry(V(-9.2, 7.5, -15.2), V(-11.0, 7.5, -12.6), rng));

    // แสงไฟจริง (PointLight) — ใช้แค่ไม่กี่ดวงเพราะแพงต่อ GPU
    // ที่เหลือใช้ "ของเรืองแสง + glow sprite" หลอกตาแทน
    const lights = [...this.lightSpots, this.forgeLightPos, V(0, 2.6, 0)];
    lights.forEach((p, i) => {
      const isForge = i === lights.length - 2;
      const isFountain = i === lights.length - 1;
      const l = new THREE.PointLight(isFountain ? 0x9be7ff : isForge ? 0xff7a2a : 0xffb35c, isFountain ? 6 : 12, isForge ? 9 : 8, 2);
      l.position.copy(p);
      this.root.add(l);
      if (isForge) this.forgeLight = l;
    });
  }

  // ---------------------------------------------------------
  //  ของตกแต่งเพิ่มเติม (โคมลอย ป้าย กระถาง ฯลฯ)
  // ---------------------------------------------------------
  _buildDecorations(rng) {
    // กระถางดอกไม้หน้าร้าน
    for (const [x, z] of [[-4.6, 9.8], [-4.6, 6.6], [-4.7, 12], [-4.7, 15.2], [-4.6, -9], [-4.6, -12]]) {
      this.decor.add(at(buildFlowerPot(rng), x, 0, z));
      this.collision.addCircle(x, z, 0.25);
    }
    // ป้ายบอกทาง
    const sign = new THREE.Group();
    sign.add(at(box(0.12, 2.2, 0.12, 0x6b4428), 0, 1.1, 0));
    sign.add(at(box(1.1, 0.3, 0.06, 0x9a6a3c), 0.4, 1.9, 0, 0, 0, 0.05));
    sign.add(at(cone(0.17, 0.25, 3, 0x9a6a3c), 1.05, 1.9, 0, 0, 0, -Math.PI / 2, [1, 1, 0.35]));
    sign.add(at(box(1.0, 0.3, 0.06, 0x9a6a3c), -0.2, 1.45, 0.02, 0, 0, -0.04));
    at(sign, 3.2, 0, -7.6, 0, Math.PI / 2 + 0.1, 0);
    this.decor.add(sign);
    this.collision.addCircle(3.2, -7.6, 0.2);

    // นอกเมือง (ด้านใต้และตะวันออก): ต้นไม้ + แปลงผัก ให้ฉากไม่โล่ง
    const treeColors = [0x5d8c43, 0x6aa84f, 0xe69138, 0xd9534f, 0x93c47d, 0xc27ba0];
    const outside = (x, z) => {
      const s = rng.range(0.8, 1.3);
      const c = rng.pick(treeColors);
      this.decor.add(at(cyl(0.14 * s, 0.2 * s, 1.4 * s, 6, 0x6b4428), x, 0.7 * s, z));
      this.decor.add(at(ico(1.0 * s, 0, c), x, 2.0 * s, z, rng(), rng(), 0));
      if (rng() < 0.5) this.decor.add(at(ico(0.65 * s, 0, c), x + 0.4, 2.6 * s, z + 0.2, rng(), rng(), 0));
    };
    for (let x = -24; x <= 30; x += 2.6) for (let z = 23.5; z <= 34; z += 2.8) if (rng() < 0.55) outside(x + rng.range(-0.8, 0.8), z + rng.range(-0.8, 0.8));
    for (let z = -24; z <= 22; z += 2.6) for (let x = 23.5; x <= 34; x += 2.8) if (rng() < 0.55) outside(x + rng.range(-0.8, 0.8), z + rng.range(-0.8, 0.8));
    // แปลงผัก
    for (const [fx, fz] of [[-14, 26], [6, 27], [27, -6], [27, 10]]) {
      for (let r = 0; r < 4; r++) {
        this.decor.add(at(box(5, 0.18, 0.6, 0x6b4a32, { castShadow: false }), fx, 0.09, fz + r * 1.1));
        for (let k = 0; k < 6; k++) this.decor.add(at(ico(0.2, 0, rng.pick([0x7fbf4d, 0x5d9e3a, 0xe0a83a])), fx - 2.1 + k * 0.85, 0.3, fz + r * 1.1));
      }
    }
  }

  // ---------------------------------------------------------
  //  ของที่ขยับได้: ธงโบก ควันปล่องไฟ น้ำพุ โคมลอย
  // ---------------------------------------------------------
  _setupAnimators(rng) {
    const game = this.game;
    const flags = [];
    const smokes = [];
    this.decor.traverse((o) => {
      if (o.userData.flag) flags.push(o);
      if (o.userData.smoke) smokes.push(o);
    });
    flags.forEach((f, i) => (f.userData.phase = i * 1.3));
    const tmp = new THREE.Vector3();

    // โคมลอย (sky lanterns) ค่อยๆ ลอยขึ้นฟ้า
    const lanterns = [];
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      g.add(at(box(0.22, 0.3, 0.22, glowMat(0xffa94d, 2.4), { castShadow: false }), 0, 0, 0));
      g.add(glowSprite(0xff9f40, 1.3, 0.5));
      g.position.set(rng.range(-18, 14), rng.range(4, 16), rng.range(-18, 14));
      g.userData.speed = rng.range(0.25, 0.5);
      g.userData.phase = rng() * 10;
      this.root.add(g);
      lanterns.push(g);
    }

    let smokeTimer = 0;
    this.animators.push((dt, t) => {
      for (const f of flags) f.rotation.y = Math.sin(t * 3 + f.userData.phase) * 0.35;
      this.fountainWater.position.y = 0.55 + Math.sin(t * 2) * 0.01;
      if (this.forgeLight) this.forgeLight.intensity = 11 + Math.sin(t * 13) * 2 + Math.sin(t * 7.3) * 1.5;

      // ละอองน้ำพุ
      if (dt > 0 && Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2;
        game.fx.sparks.spawn({ x: Math.cos(a) * 0.1, y: 2.6, z: Math.sin(a) * 0.1, vx: Math.cos(a) * 1.4, vy: 2.2, vz: Math.sin(a) * 1.4, life: 0.75, size: 0.07, color: 0x7fd4ff, gravity: 8, drag: 0, floor: 1.9 });
      }
      // ควันจากปล่องไฟ
      smokeTimer += dt;
      if (smokeTimer > 0.35) {
        smokeTimer = 0;
        for (const s of smokes) {
          if (Math.random() < 0.5) continue;
          s.getWorldPosition(tmp);
          game.fx.debris.spawn({ x: tmp.x, y: tmp.y, z: tmp.z, vx: 0.3, vy: 0.8, vz: 0.2, life: 2.6, size: 0.18, sizeEnd: 0.55, color: 0xb9b2c4, gravity: -0.1, drag: 0.3, spin: 1 });
        }
      }
      for (const l of lanterns) {
        l.position.y += l.userData.speed * dt;
        l.position.x += Math.sin(t * 0.5 + l.userData.phase) * 0.15 * dt;
        if (l.position.y > 20) l.position.set(rng.range(-18, 14), 3, rng.range(-18, 14));
      }
    });
  }

  // ---------------------------------------------------------
  //  ชาวเมือง (NPC)
  // ---------------------------------------------------------
  _spawnNPCs() {
    const add = (o) => {
      const n = new NPC(this.game, this, o);
      this.npcs.push(n);
      return n;
    };

    add({
      name: 'ทหารยามบรูโน่',
      position: V(3.6, 0, -18.6),
      facing: -0.2,
      behavior: 'stand',
      prop: 'spear',
      look: { scale: 1.12, width: 1.15, shirt: 0x7a8696, shirtDark: 0x5c6675, sleeve: 0x7a8696, pants: 0x4a4f5a, hat: 'helmet', hatColor: 0xa9b2bd, hatColor2: 0xd63a2f, hair: 0x2b1d14, mustache: 0x2b1d14, skin: 0xe0ac7e },
      barks: ['หยุดก่อน! ...อ้อ ไคนี่เอง', 'ป่าข้างนอกช่วงนี้อันตรายนะ'],
      lines: [
        'ไค! จะออกไปป่าหลากสีใช่ไหม? ทางนั้นแหละ ผ่านประตูนี้ไป',
        'ช่วงนี้ในป่ามีสไลม์ เห็ดเดินได้ แล้วก็โกเลมหิน คอยกวนใจชาวเมือง',
        'จำไว้: ก่อนมอนสเตอร์โจมตี จะมี "วงสีแดง" ขึ้นที่พื้น นั่นคือสัญญาณเตือน!',
        'เห็นวงแดงเมื่อไร ให้กด Space กลิ้งหลบ ระหว่างกลิ้งตัวเราจะอมตะชั่วขณะ',
        'ถ้าพร้อมแล้ว เดินมาที่ประตูแล้วกด E ได้เลย โชคดีนะ!',
      ],
    });
    add({
      name: 'ป้ามะลิ',
      position: V(6.6, 0, 5.3),
      facing: 0,
      behavior: 'stand',
      look: { scale: 1.0, width: 1.2, shirt: 0xe07a5f, shirtDark: 0xc0603f, sleeve: 0xf2d0a4, apron: 0xfff3dc, hair: 0x8a8a8a, hairStyle: 'bun', skin: 0xe0ac7e, skirt: 0.35 },
      barks: ['ผลไม้สดๆ จ้า!', 'แอปเปิลหวานๆ จ้า', 'ไคจ๋า มาแวะก่อน'],
      lines: [
        'ไคจ๋า! วันนี้ผลไม้สดมากเลยนะ',
        'ป้าเห็นเธอฝึกฟันดาบทั้งวัน ระวังเหนื่อยนะลูก',
        'stamina ก็เหมือนลมหายใจ ใช้แล้วหยุดพักแป๊บนึง มันก็ค่อยๆ ฟื้นเอง',
        'แต่ถ้าใช้จนหมดหลอด จะหอบไปตั้ง 4 วินาที! ฟื้นมาก็แค่ครึ่งเดียว อย่าหักโหมนะ',
      ],
    });
    add({
      name: 'นักปรุงยาโอลิน',
      position: V(-4.3, 0, 8.6),
      facing: Math.PI / 2 - 0.3,
      behavior: 'stand',
      prop: 'staff',
      look: { scale: 1.08, shirt: 0x5b3d8f, shirtDark: 0x47306f, sleeve: 0x5b3d8f, hat: 'wizard', hatColor: 0x5b3d8f, hatColor2: 0xe8c25a, beard: 0xe8e8e8, hair: 0xe8e8e8, skin: 0xf2c9a0, skirt: 0.45 },
      barks: ['ยาวิเศษ... ยาวิเศษ...', 'หึๆ เด็กหนุ่มผ้าพันคอแดง'],
      lines: [
        'ยินดีต้อนรับสู่ร้านยาของข้า... แต่วันนี้ยาหมดสต็อกเสียแล้ว',
        'ในป่าหลากสีมี "ผลไม้เรืองแสง" ขึ้นอยู่ตามพุ่มไม้ เดินไปเก็บจะฟื้นเลือดได้',
        'ส่วนศาลคริสตัลบนเชิงเขา... ว่ากันว่าจะตื่นขึ้นเมื่อป่ากลับมาสงบ',
      ],
    });
    add({
      name: 'ช่างตีเหล็กโดรัน',
      position: V(16.5, 0, -10.2),
      facing: -Math.PI / 2 - 0.4,
      behavior: 'hammer',
      prop: 'hammer',
      anvilPos: this.anvilPos,
      look: { scale: 1.15, width: 1.3, shirt: 0x8a5d36, shirtDark: 0x6b4428, sleeve: 0xc68863, apron: 0x3a3a40, hair: 0x5a2e1a, hairStyle: 'bald', beard: 0x8a3a1a, skin: 0xc68863 },
      barks: ['*เคร้ง!* *เคร้ง!*', 'ดาบดีต้องตีด้วยใจ!'],
      lines: [
        'ฮ่าฮ่า! ดาบที่เจ้าถืออยู่ ข้าตีเองกับมือเลยนะ',
        'ฟันเบาเร็วแต่เบา ฟันชาร์จช้าแต่แรงถึง 60! แถมยังหมุนฟันได้รอบตัว',
        'เจ้าโกเลมหินในป่านั่นผิวแข็งโป๊ก ฟันเบาไม่ทำให้มันสะดุ้งเลย',
        'รอให้มันทุบพื้นพลาด (ตอนมันหอบ) แล้วฟันชาร์จใส่เต็มๆ นั่นแหละจุดอ่อน!',
      ],
    });
    add({
      name: 'ปู่ทองดี',
      position: V(this.benches[0].x + 0.05, 0, this.benches[0].z + 0.05),
      facing: this.benches[0].ry,
      behavior: 'sit',
      look: { scale: 1.0, shirt: 0x6a7f5a, shirtDark: 0x55684a, sleeve: 0x6a7f5a, hair: 0xdedede, hairStyle: 'short', beard: 0xdedede, skin: 0xe0ac7e, hat: 'cap', hatColor: 0x8a5d36 },
      barks: ['เฮ้อ... อากาศเย็นสบาย', 'สมัยปู่ยังหนุ่มนะ...'],
      lines: [
        'สมัยปู่ยังหนุ่ม ศาลคริสตัลบนเขายังส่องแสงสว่างทั่วป่า',
        'แต่หลายปีก่อน แสงมันดับลง แล้วมอนสเตอร์ก็เริ่มออกมาเพ่นพ่าน',
        'ถ้าเจ้ากำจัดมอนสเตอร์ในป่าได้ครบ ศาลอาจตื่นขึ้นอีกครั้งก็ได้นะ',
        'ไปเถอะ เจ้าหนูผ้าพันคอแดง... ระวังตัวด้วย',
      ],
    });
    add({
      name: 'ต้นกล้า',
      position: V(3.1, 0, 0),
      behavior: 'circle',
      center: V(0, 0, 0),
      circleRadius: 3.1,
      speed: 2.8,
      look: { scale: 0.72, shirt: 0xffb703, shirtDark: 0xe09f00, sleeve: 0xffb703, pants: 0x4f6497, hair: 0x2b1d14, hairStyle: 'messy', skin: 0xc68863 },
      barks: ['พี่ไค! มาเล่นไล่จับกัน!', 'วิ่งเร็วกว่าพี่อีก!'],
      lines: ['พี่ไค! โตขึ้นผมจะเป็นนักผจญภัยเหมือนพี่เลย!', 'ผ้าพันคอแดงของพี่เท่มาก ปลิวไปมาตอนวิ่งด้วย!'],
    });
    add({
      name: 'ลูน่า',
      position: V(2, 0, 10),
      behavior: 'patrol',
      prop: 'basket',
      speed: 1.2,
      path: [V(2, 0, 9), V(4.5, 0, 9.0), V(9, 0, 9.5), V(14, 0, 9.0), V(9, 0, 9.4), V(3.5, 0, 4.0), V(-1.5, 0, 6.5)],
      look: { scale: 0.98, shirt: 0x8ecae6, shirtDark: 0x6aa9c7, sleeve: 0xfff3dc, hair: 0xc77d3a, hairStyle: 'ponytail', skin: 0xf6d7b8, skirt: 0.4 },
      barks: ['ตลาดคึกคักจังวันนี้', 'ซื้ออะไรดีน้า~'],
      lines: ['สวัสดีไค! วันนี้มาจ่ายตลาดเหรอ?', 'ได้ยินว่าแถวลำธารในป่ามีผีเสื้อสวยมากเลยล่ะ'],
    });
    add({
      name: 'ลุงขนมปัง',
      position: V(-4.4, 0, 14.2),
      facing: Math.PI / 2,
      behavior: 'stand',
      look: { scale: 1.05, width: 1.35, shirt: 0xffffff, shirtDark: 0xe6e6e6, sleeve: 0xffffff, apron: 0xf2d0a4, pants: 0x6e5a45, hat: 'chef', mustache: 0x5a3a24, hair: 0x5a3a24, skin: 0xf2c9a0 },
      barks: ['ขนมปังอบใหม่ หอมๆ!', 'เพิ่งออกจากเตาเลย!'],
      lines: ['ขนมปังอบใหม่ๆ เลยไค! กินแล้วมีแรงสู้มอนสเตอร์', 'ทริคนะ: กดปุ่มต่อเนื่องระหว่างฟัน เกมจะ "จำ" ปุ่มไว้ให้แป๊บนึง (input buffer) คอมโบเลยลื่น'],
    });
    add({
      name: 'นักดนตรีเพลง',
      position: V(5.3, 0, -5.0),
      facing: -0.7,
      behavior: 'stand',
      prop: 'lute',
      look: { scale: 1.0, shirt: 0x7c4f8f, shirtDark: 0x5f3c6e, sleeve: 0xf3e6ff, pants: 0x3a3a50, hat: 'cap', hatColor: 0xd63a2f, hair: 0xe0b04a, hairStyle: 'short', skin: 0xf6d7b8 },
      barks: ['♪ ลา ลา ลา~ ♪', '♪ เมืองโคมไฟยามเย็น ♪'],
      lines: ['♪ ในเมืองโคมไฟยามค่ำ แสงสีส้มอบอุ่น ♪', 'เพลงนี้แต่งให้ศาลคริสตัล... หวังว่าวันหนึ่งมันจะกลับมาส่องแสง'],
    });
    add({
      name: 'ป้าแก้ว',
      position: V(-1, 0, -13),
      behavior: 'wander',
      wanderRadius: 3,
      prop: 'broom',
      speed: 0.9,
      look: { scale: 0.95, shirt: 0x5f8a44, shirtDark: 0x4a6e35, sleeve: 0xfff3dc, hat: 'scarf', hatColor: 0xd9a441, hair: 0x5a3a24, skin: 0xe0ac7e, skirt: 0.4 },
      barks: ['กวาดๆๆ', 'ถนนต้องสะอาด!'],
      lines: ['ใบไม้ร่วงเต็มถนนเลย กวาดเท่าไรก็ไม่หมด', 'ถ้าเจ้าจะไปป่า ระวังสไลม์นะ มันชอบกระโดดพุ่งใส่!'],
    });
    add({
      name: 'ทิม',
      position: V(11, 0, 14),
      behavior: 'wander',
      wanderRadius: 4,
      speed: 1.1,
      look: { scale: 1.02, shirt: 0x4f6497, shirtDark: 0x3d4f7a, sleeve: 0x4f6497, pants: 0x6e5a45, hair: 0x2b1d14, hairStyle: 'short', skin: 0x8d5a3b, vest: 0x8a5d36 },
      barks: ['สวนนี้สวยดีนะ', 'วันนี้อากาศดีจัง'],
      lines: ['สวนนี้ปลูกต้นไม้หลายสีเลย เหมือนป่าหลากสีย่อส่วน', 'เคยได้ยินไหม? ต้นไม้ในป่ามีทั้งสีชมพู สีส้ม สีม่วง!'],
    });

    this.npcs.push(new Cat(this.game, this, V(9, 0, 15.5)));
    this.npcs.push(new Cat(this.game, this, V(-2, 0, -6), 0x555560));
  }

  tick() {
    // เมืองไม่มีเงื่อนไขชนะ/แพ้ — ผู้เล่นออกไปป่าเมื่อพร้อม
  }
}
