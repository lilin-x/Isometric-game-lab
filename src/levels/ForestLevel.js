// =============================================================
//  ForestLevel.js — ด่าน 2: ป่าหลากสี (Prism Woods)
// -------------------------------------------------------------
//  ผังด่าน (กล้องอยู่มุมล่างขวา):
//
//      ภูเขา ภูเขา ภูเขา  [น้ำตก]  ภูเขา
//      ภูเขา  ⛩ศาลคริสตัล     │ลำธาร
//              🗿โกเลม        │
//          🍄    🗿          │
//                    ════สะพาน════
//                           │    🟢 สไลม์
//           ลำธาร           │  🍄    🟢🟢
//         /                       ▲ จุดเริ่ม (มาจากเมือง)
//
//  เส้นทาง: จุดเริ่ม (+X,+Z) → ข้ามสะพานกลางแผนที่ → ศาล (−X,−Z)
//  ลำธารแบ่งแผนที่เป็น 2 ฝั่ง มีทางข้ามทางเดียวคือสะพาน (ควบคุมทางเดินผู้เล่น)
//  เงื่อนไขชนะ: กำจัดมอนสเตอร์ครบ → ศาลตื่น → เดินไปกด E ที่ศาล
// =============================================================

import * as THREE from 'three';
import { Level } from './Level.js';
import { CONFIG } from '../config.js';
import { Slime, MushroomMonster, Golem } from '../entities/Enemy.js';
import { Butterfly, Rabbit } from '../entities/Critters.js';
import { box, cyl, ico, at, mat, glowSprite, makeRng, bakeStatic, meshOf, jitter } from '../models/kit.js';
import {
  TREE_COLOR_NAMES, buildTree, buildBush, buildHealBush, buildRock, buildMountain, buildGrassTuft, buildFlower,
  buildMushroomCluster, buildLog, buildStump, buildBridge, buildShrine, buildSignpost, buildCairn,
} from '../models/nature.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const B = 27; // ขอบเขตที่เดินได้: -27..27

// เส้นทางเดินหลัก (ใช้ระบายสีพื้นเป็นทางดิน และกันไม่ให้ต้นไม้ขึ้นขวางทาง)
const PATH = [V(23, 0, 23), V(17, 0, 15.5), V(12, 0, 11), V(6, 0, 5.5), V(0, 0, 0), V(-5, 0, -6), V(-10, 0, -8.5), V(-14, 0, -13.5), V(-18, 0, -18), V(-21, 0, -21)];
// แนวลำธาร (CatmullRom curve ผ่านจุดเหล่านี้)
const STREAM = [V(3, 0, -29.5), V(4, 0, -24), V(4.2, 0, -19), V(3, 0, -13), V(1.6, 0, -6.5), V(0, 0, 0), V(-3.5, 0, 7), V(-9, 0, 13), V(-16, 0, 17.5), V(-23, 0, 23), V(-30, 0, 29), V(-42, 0, 37)];
const SHRINE_POS = V(-21, 0, -21);
const START_POS = V(22, 0, 22);

function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
    best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
  }
  return best;
}

// noise แบบง่ายๆ จากผลรวม sin (พอสำหรับระบายสีพื้น/เลือกสีต้นไม้)
const noise = (x, z) => (Math.sin(x * 0.23 + 1.3) + Math.sin(z * 0.19 + 0.7) + Math.sin((x + z) * 0.13) + Math.sin((x - z) * 0.31 + 2.1)) / 4;

export class ForestLevel extends Level {
  build() {
    const rng = makeRng(777);
    this.rng = rng;
    this.decor = new THREE.Group();
    this.root.add(this.decor);
    this.streamCurve = new THREE.CatmullRomCurve3(STREAM);
    this.streamPts = this.streamCurve.getSpacedPoints(160);

    this.setupLights({
      background: 0x9fd0ea,
      fog: { color: 0xb9dcea, near: 48, far: 100 },
      sky: 0xd6ecff,
      ground: 0x55703a,
      hemiIntensity: 1.25,
      sunColor: 0xfff1d6,
      sunIntensity: 2.5,
      sunDir: [0.45, 1, 0.7],
    });
    this.collision.setBounds(-B, -B, B, B);

    this._buildTerrain(rng);
    this._buildStream(rng);
    this._buildMountains(rng);
    this._buildShrine(rng);
    this._buildVegetation(rng);
    this._buildPickups(rng);
    bakeStatic(this.decor);
    this._buildLife(rng);
    this._spawnEnemies(rng);

    this.spawnPlayer(START_POS.clone(), -Math.PI * 0.75);
    this.game.iso.bounds = { minX: -22, maxX: 21, minZ: -23, maxZ: 21 };
  }

  onEnter() {
    this.game.hud.banner('ป่าหลากสี', 'ด่าน 2 · Prism Woods');
    this._updateObjective();
  }

  _updateObjective() {
    const total = this.enemies.length;
    const killed = this.enemies.filter((e) => !e.alive).length;
    if (this.shrineAwake) this.game.hud.setObjective('ศาลคริสตัลตื่นแล้ว! ไปที่ <b>ศาล</b> แล้วกด <b>E</b>');
    else this.game.hud.setObjective(`กำจัดมอนสเตอร์ <b>${killed}/${total}</b> แล้วไปปลุก <b>ศาลคริสตัล</b>`);
  }

  // ---------------------------------------------------------
  //  พื้น: เรียบในเขตที่เดินได้ ยกเป็นเนินนอกเขต + ระบายสีด้วย vertex color
  // ---------------------------------------------------------
  _buildTerrain(rng) {
    const size = 130;
    const seg = 100;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ox = Math.max(0, Math.abs(x) - B - 1);
      const oz = Math.max(0, Math.abs(z) - B - 1);
      const d = Math.hypot(ox, oz);
      // ด้านหลัง (−X, −Z) ยกสูงเป็นเนินเขา, ด้านหน้า (+X, +Z) ยกนิดเดียว ไม่บังกล้อง
      const back = x < -B || z < -B ? 1 : 0.25;
      const h = d > 0 ? (d * d * 0.05 + noise(x, z) * Math.min(1, d * 0.2) * 1.2) * back : 0;
      pos.setY(i, h);
    }
    const g = geo.toNonIndexed();
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const grassA = new THREE.Color(0x77b04e);
    const grassB = new THREE.Color(0x8fc25a);
    const meadow = new THREE.Color(0xa8cf68);
    const dirt = new THREE.Color(0xc9a46a);
    const dirtDark = new THREE.Color(0xa88552);
    const hill = new THREE.Color(0x5f9440);
    for (let i = 0; i < p.count; i += 3) {
      // สีต่อ "สามเหลี่ยม" (ดูจากจุดกึ่งกลาง) → ได้ลุค low poly แบบแผ่นๆ
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const n = noise(cx * 1.4, cz * 1.4);
      c.copy(grassA).lerp(grassB, (n + 1) / 2);
      if (noise(cx * 0.6 + 10, cz * 0.6) > 0.35) c.lerp(meadow, 0.6);
      const dp = distToPolyline(cx, cz, PATH);
      if (dp < 1.9) c.copy(dirt).lerp(dirtDark, rng() * 0.5);
      else if (dp < 2.6) c.lerp(dirt, 0.4);
      if (cy > 0.5) c.lerp(hill, Math.min(1, cy / 6));
      c.offsetHSL(0, 0, rng.range(-0.02, 0.02));
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    ground.receiveShadow = true;
    ground.userData.dynamic = true;
    this.root.add(ground);
  }

  // ---------------------------------------------------------
  //  ลำธาร + สะพาน + น้ำตก
  // ---------------------------------------------------------
  _buildStream(rng) {
    const curve = this.streamCurve;
    const N = 240;
    const W = 1.65; // ครึ่งความกว้าง
    const across = 4;
    // ริบบิ้นน้ำ: สร้างจุดยอดเองทีละแถวตามเส้นโค้ง
    const makeRibbon = (halfW, y) => {
      const verts = [];
      const idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const pnt = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const nx = -tan.z;
        const nz = tan.x;
        for (let k = 0; k <= across; k++) {
          const s = (k / across) * 2 - 1;
          verts.push(pnt.x + nx * s * halfW, y, pnt.z + nz * s * halfW);
        }
      }
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < across; k++) {
          const a = i * (across + 1) + k;
          const b = a + across + 1;
          idx.push(a, a + 1, b, b, a + 1, b + 1); // ลำดับจุด (winding) ทวนเข็ม = หน้าหงายขึ้น
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };
    const bed = new THREE.Mesh(makeRibbon(W + 0.55, 0.03), mat(0x8a7a5a));
    bed.receiveShadow = true;
    this.decor.add(bed);
    const waterGeo = makeRibbon(W, 0.1);
    const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: 0x48b4e0, flatShading: true, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.86, emissive: 0x1a5f88, emissiveIntensity: 0.35 }));
    water.receiveShadow = true;
    water.userData.dynamic = true;
    this.root.add(water);
    this.water = water;
    this.waterBase = Float32Array.from(waterGeo.attributes.position.array);

    // collision: วงกลมเรียงตามลำธาร (เว้นช่วงสะพาน)
    const len = curve.getLength();
    for (let s = 0; s < len; s += 0.7) {
      const pnt = curve.getPointAt(s / len);
      if (Math.hypot(pnt.x, pnt.z) < 2.6) continue;
      this.collision.addCircle(pnt.x, pnt.z, W - 0.05);
    }

    // สะพาน (หมุน 45° ให้ตรงกับทางเดิน)
    const bridge = at(buildBridge(6.8, 2.5), 0, 0, 0, 0, Math.PI / 4, 0);
    this.decor.add(bridge);
    const ax = Math.SQRT1_2;
    for (const side of [-1, 1]) {
      for (let s = -3.4; s <= 3.4; s += 0.35) {
        // ราวสะพาน 2 ข้าง (ตั้งฉากกับแนวสะพาน)
        const x = ax * s + side * ax * 1.25;
        const z = ax * s - side * ax * 1.25;
        this.collision.addCircle(x, z, 0.2);
      }
    }

    // หินริมตลิ่ง
    for (let i = 0; i < 70; i++) {
      const t = rng();
      const pnt = curve.getPointAt(t);
      if (Math.hypot(pnt.x, pnt.z) < 4) continue;
      const tan = curve.getTangentAt(t);
      const side = rng.sign();
      const off = W + rng.range(0.3, 0.9);
      const s = rng.range(0.18, 0.5);
      this.decor.add(at(buildRock(rng, s, rng() < 0.3), pnt.x - tan.z * off * side, 0, pnt.z + tan.x * off * side));
    }
    // ใบบัว
    for (let i = 0; i < 14; i++) {
      const t = rng();
      const pnt = curve.getPointAt(t);
      if (Math.hypot(pnt.x, pnt.z) < 4) continue;
      const tan = curve.getTangentAt(t);
      const off = rng.range(-1, 1);
      const pad = at(cyl(0.3, 0.3, 0.03, 7, 0x4f9d4a, { castShadow: false }), pnt.x - tan.z * off, 0.13, pnt.z + tan.x * off);
      this.decor.add(pad);
      if (rng() < 0.4) this.decor.add(at(ico(0.08, 0, 0xffb3d1, { castShadow: false }), pad.position.x, 0.2, pad.position.z));
    }

    // น้ำตก: หน้าผา + สายน้ำที่ไหลลง (แถบสีขาวเลื่อนลงวนซ้ำ)
    const fallX = 3;
    const fallZ = -30.2;
    const cliff = meshOf(jitter(new THREE.BoxGeometry(10, 6, 4, 3, 2, 2), 0.5, rng), 0x7f8a96);
    this.decor.add(at(cliff, fallX, 2.6, fallZ - 2.4));
    this.decor.add(at(meshOf(jitter(new THREE.BoxGeometry(11, 0.8, 4.5, 3, 1, 2), 0.4, rng), 0x5f9e45), fallX, 5.8, fallZ - 2.4));
    this.decor.add(at(buildRock(rng, 1.4, true), fallX - 4, 0, fallZ + 0.5));
    this.decor.add(at(buildRock(rng, 1.1, true), fallX + 3.8, 0, fallZ + 0.6));
    const pool = at(cyl(2.8, 2.8, 0.06, 12, water.material), fallX, 0.1, fallZ + 1.2);
    pool.userData.dynamic = true;
    this.root.add(pool);
    const fall = new THREE.Group();
    fall.position.set(fallX, 0, fallZ - 0.15);
    this.root.add(fall);
    fall.add(at(box(2.4, 5.6, 0.1, mat(0x6fc9ef, { emissive: 0x3a9fd0, emissiveIntensity: 0.5, roughness: 0.2 }), { castShadow: false }), 0, 2.8, 0));
    const streaks = [];
    for (let i = 0; i < 14; i++) {
      const s = at(box(rng.range(0.08, 0.2), rng.range(0.6, 1.4), 0.05, mat(0xeaf8ff, { emissive: 0xbfe9ff, emissiveIntensity: 0.6 }), { castShadow: false }), rng.range(-1.05, 1.05), rng.range(0, 5.6), 0.08);
      fall.add(s);
      streaks.push(s);
    }
    this.waterfall = { streaks, x: fallX, z: fallZ + 0.4 };
  }

  // ---------------------------------------------------------
  //  ภูเขารอบด่าน
  // ---------------------------------------------------------
  _buildMountains(rng) {
    // [x, z, radius, height] — ด้านหลังสูง ด้านข้างกลาง ด้านหน้าเตี้ย
    const list = [
      [-8, -38, 8, 15], [14, -38, 8, 16], [26, -37, 7, 12], [-22, -40, 9, 19], [-36, -36, 11, 24],
      [-40, -20, 9, 17], [-39, -4, 8, 14], [-38, 10, 7, 12], [-40, 24, 8, 11], [36, -24, 7, 10],
      [38, -8, 6, 8], [-3, -44, 9, 20], [-50, -10, 10, 22], [-15, -50, 10, 22], [5, -50, 10, 18],
    ];
    for (const [x, z, r, h] of list) this.decor.add(at(buildMountain(rng, r, h, h > 11), x, -0.5, z));
    // เนินเตี้ยด้านหน้า
    for (const [x, z, r, h] of [[36, 12, 6, 3.5], [20, 36, 7, 3], [4, 37, 6, 2.5], [-14, 37, 6, 3]]) {
      this.decor.add(at(buildMountain(rng, r, h, false, 0x6a9e47), x, -0.5, z));
    }
  }

  // ---------------------------------------------------------
  //  ศาลคริสตัล
  // ---------------------------------------------------------
  _buildShrine(rng) {
    const s = buildShrine(rng);
    at(s.group, SHRINE_POS.x, 0, SHRINE_POS.z);
    this.decor.add(s.group);
    this.shrine = s;
    this.shrineAwake = false;
    for (const st of s.stones) this.collision.addCircle(SHRINE_POS.x + st.x, SHRINE_POS.z + st.z, 0.45);
    this.collision.addCircle(SHRINE_POS.x, SHRINE_POS.z, 1.0);
    // ลำแสงพุ่งขึ้นฟ้า (โชว์ตอนศาลตื่น)
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.4, 40, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.set(SHRINE_POS.x, 20, SHRINE_POS.z);
    beam.renderOrder = 6;
    this.root.add(beam);
    this.beam = beam;
    this.shrineLight = new THREE.PointLight(0x7fd8ff, 0, 14, 2);
    this.shrineLight.position.set(SHRINE_POS.x, 2.5, SHRINE_POS.z);
    this.root.add(this.shrineLight);

    this.addInteractable({
      position: SHRINE_POS,
      range: 5.6,
      promptHeight: 4.2,
      get prompt() {
        return this.level.shrineAwake ? 'ปลุก <b>ศาลคริสตัล</b>' : 'ศาลยังหลับอยู่…';
      },
      level: this,
      onInteract: () => {
        if (!this.shrineAwake) {
          const left = this.enemies.filter((e) => e.alive).length;
          this.game.hud.toast(`ยังเหลือมอนสเตอร์อีก ${left} ตัว`);
          this.game.audio.play('noStamina');
          return;
        }
        if (this.won) return;
        this.won = true;
        this.game.audio.play('portal');
        this.game.shake(0.3);
        this.game.fx.sparks.burst({ x: SHRINE_POS.x, y: 2.5, z: SHRINE_POS.z, count: 60, speed: 6, up: 6, colors: [0x7fd8ff, 0xffffff, 0xfff2a8], size: 0.16, life: 1.4, gravity: 2 });
        this.game.fx.ground.shockwave({ x: SHRINE_POS.x, z: SHRINE_POS.z, color: 0x7fd8ff, from: 1, to: 8, life: 0.9 });
        setTimeout(() => this.game.onWin(), 1500);
      },
    });

    // ทางกลับเมือง (ป้ายไม้ที่จุดเริ่ม)
    const sign = at(buildSignpost(), 24.8, 0, 20.4, 0, -Math.PI * 0.25, 0);
    this.decor.add(sign);
    this.collision.addCircle(24.8, 20.4, 0.25);
    this.addInteractable({
      position: V(24.8, 0, 20.4),
      range: 1.8,
      prompt: 'กลับ <b>เมืองโคมไฟ</b>',
      promptHeight: 2.6,
      onInteract: () => this.game.goTo('town'),
    });
  }

  // ---------------------------------------------------------
  //  ต้นไม้ พุ่มไม้ หิน หญ้า ดอกไม้ (สุ่มวางแบบมีกฎ)
  // ---------------------------------------------------------
  _isClear(x, z, { path = 2.6, stream = 2.6, open = true } = {}) {
    if (distToPolyline(x, z, PATH) < path) return false;
    for (const p of this.streamPts) if (Math.hypot(x - p.x, z - p.z) < stream) return false;
    if (Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 5.8) return false;
    if (Math.hypot(x - START_POS.x, z - START_POS.z) < 3.5) return false;
    if (open) {
      // ทุ่งหญ้าโล่ง (ไม่ให้ป่ารก)
      for (const [mx, mz, r] of [[13, 10, 5.5], [-8, -6, 4.5], [-15, -13, 3.5], [10, -12, 3.5], [-12, 8, 3.5]]) if (Math.hypot(x - mx, z - mz) < r) return false;
    }
    return true;
  }

  _buildVegetation(rng) {
    const shapes = ['round', 'round', 'pine', 'tall', 'layered'];
    const placed = [];
    const tryTree = (x, z, inside) => {
      for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < (inside ? 3.4 : 2.6)) return;
      // เลือกสีตาม "ช่องตาราง" ขนาด 8x8 เมตร → ต้นไม้สีเดียวกันจับกลุ่มเป็นหย่อมๆ
      // แล้วสุ่มแทรกสีอื่นบ้าง 30% จะได้ไม่เป็นบล็อกจนดูแข็ง
      const cell = Math.abs(Math.floor(x / 8) * 7 + Math.floor(z / 8) * 13);
      const ci = rng() < 0.3 ? rng.int(0, 4) : cell % 5;
      const colorName = TREE_COLOR_NAMES[ci];
      const shape = colorName === 'green' && rng() < 0.5 ? 'pine' : rng.pick(shapes);
      const s = rng.range(0.85, 1.25);
      this.decor.add(at(buildTree(rng, shape, colorName, s), x, 0, z, 0, rng() * Math.PI * 2, 0));
      if (inside) this.collision.addCircle(x, z, 0.35 * s + 0.15);
      placed.push({ x, z, colorName });
    };
    // ในเขตที่เดินได้
    for (let i = 0; i < 400 && placed.length < 62; i++) {
      const x = rng.range(-B + 1, B - 1);
      const z = rng.range(-B + 1, B - 1);
      if (this._isClear(x, z)) tryTree(x, z, true);
    }
    // นอกเขต (ขอบป่าหนาแน่น)
    for (let i = 0; i < 260; i++) {
      const x = rng.range(-B - 10, B + 9);
      const z = rng.range(-B - 10, B + 9);
      if (Math.abs(x) < B + 0.5 && Math.abs(z) < B + 0.5) continue;
      if (x < -B - 7 || z < -B - 7) continue; // ด้านหลังเป็นภูเขา
      let near = false;
      for (const p of this.streamPts) if (Math.hypot(x - p.x, z - p.z) < 2.6) near = true;
      if (Math.abs(x - 3) < 6 && z < -B) near = true; // หน้าน้ำตก
      if (!near) tryTree(x, z, false);
    }
    this.treePositions = placed;

    // พุ่มไม้ 4 ชนิด
    const kinds = ['round', 'berry', 'flower', 'fern'];
    for (let i = 0; i < 110; i++) {
      const x = rng.range(-B, B);
      const z = rng.range(-B, B);
      if (!this._isClear(x, z, { path: 2.2, stream: 2.3, open: false })) continue;
      const s = rng.range(0.8, 1.3);
      this.decor.add(at(buildBush(rng, rng.pick(kinds), s), x, 0, z, 0, rng() * 6, 0));
      if (s > 1.1) this.collision.addCircle(x, z, 0.4);
    }
    // หินใหญ่-เล็ก
    for (let i = 0; i < 45; i++) {
      const x = rng.range(-B, B);
      const z = rng.range(-B, B);
      if (!this._isClear(x, z, { path: 2.4, stream: 2.4, open: false })) continue;
      const big = rng() < 0.3;
      const s = big ? rng.range(0.9, 1.6) : rng.range(0.25, 0.55);
      this.decor.add(at(buildRock(rng, s, big && rng() < 0.6), x, 0, z));
      if (big) this.collision.addCircle(x, z, s * 0.95);
    }
    // หินกองริมทาง (บอกทาง)
    for (const [x, z] of [[8.5, 5.5], [-2.8, -6.5], [-12.5, -15.5]]) this.decor.add(at(buildCairn(rng), x, 0, z));
    // ขอนไม้ ตอไม้ เห็ด
    for (const [x, z, ry] of [[16, 6, 0.4], [-14, -4, -0.8], [8, -18, 1.2]]) {
      if (!this._isClear(x, z, { open: false })) continue;
      this.decor.add(at(buildLog(rng), x, 0, z, 0, ry, 0));
      this.collision.addCircle(x, z, 0.5);
      this.collision.addCircle(x + Math.cos(ry) * 1.0, z - Math.sin(ry) * 1.0, 0.4);
      this.collision.addCircle(x - Math.cos(ry) * 1.0, z + Math.sin(ry) * 1.0, 0.4);
    }
    for (let i = 0; i < 6; i++) {
      const x = rng.range(-B, B);
      const z = rng.range(-B, B);
      if (!this._isClear(x, z, { open: false })) continue;
      this.decor.add(at(buildStump(), x, 0, z));
      this.collision.addCircle(x, z, 0.45);
    }
    for (const t of placed) if (rng() < 0.25) this.decor.add(at(buildMushroomCluster(rng), t.x + rng.range(-1, 1), 0, t.z + rng.range(0.6, 1.2)));

    // หญ้า + ดอกไม้ (ในทุ่งหญ้าหนาแน่นกว่า)
    for (let i = 0; i < 520; i++) {
      const x = rng.range(-B - 3, B + 3);
      const z = rng.range(-B - 3, B + 3);
      if (distToPolyline(x, z, PATH) < 1.6) continue;
      let wet = false;
      for (const p of this.streamPts) if (Math.hypot(x - p.x, z - p.z) < 2.1) wet = true;
      if (wet) continue;
      const meadow = noise(x * 0.6 + 10, z * 0.6) > 0.2;
      if (meadow && rng() < 0.45) this.decor.add(at(buildFlower(rng), x, 0, z));
      else this.decor.add(at(buildGrassTuft(rng), x, 0, z, 0, rng() * 6, 0));
    }
  }

  // ---------------------------------------------------------
  //  ผลไม้ฟื้นเลือด
  // ---------------------------------------------------------
  _buildPickups(rng) {
    this.pickups = [];
    for (const [x, z] of [[18.5, 5.5], [-4.5, -15], [-19.5, -8.5], [9, -14]]) {
      const hb = buildHealBush(rng);
      at(hb.group, x, 0, z);
      this.decor.add(hb.group);
      this.pickups.push({ x, z, fruit: hb.fruit, taken: false });
    }
  }

  // ---------------------------------------------------------
  //  สิ่งมีชีวิตประกอบฉาก + ของที่ขยับได้
  // ---------------------------------------------------------
  _buildLife(rng) {
    this.critters = [];
    const bColors = [0xffe066, 0x8fd3ff, 0xff9fbf, 0xffffff, 0xffa94d];
    for (const [x, z] of [[13, 10], [15, 14], [-8, -6], [-12, 8], [10, -12], [-15, -13], [6, 18], [-3, 12], [19, -3], [-20, 2]]) {
      this.critters.push(new Butterfly(this, V(x, 0, z), rng.pick(bColors), rng));
    }
    for (const [x, z] of [[17, 18], [-16, 4], [12, -20]]) this.critters.push(new Rabbit(this, V(x, 0, z), rng, rng() < 0.5 ? 0xf4f0ea : 0xc8a27a));

    // หิ่งห้อย / ละอองแสงลอยๆ
    const motes = [];
    for (let i = 0; i < 34; i++) {
      const s = glowSprite(rng() < 0.5 ? 0xe6ff8a : 0xfff2a8, 0.5, 0.9);
      const near = rng() < 0.5 ? this.streamPts[Math.floor(rng() * this.streamPts.length)] : V(rng.range(-B, B), 0, rng.range(-B, B));
      s.position.set(near.x + rng.range(-2, 2), rng.range(0.4, 2), near.z + rng.range(-2, 2));
      s.userData.base = s.position.clone();
      s.userData.phase = rng() * 10;
      this.root.add(s);
      motes.push(s);
    }

    const pinkTrees = this.treePositions.filter((t) => t.colorName === 'pink' || t.colorName === 'yellow' || t.colorName === 'orange');
    const petalColor = { pink: 0xf7b5cd, yellow: 0xf5d35a, orange: 0xf29a4a };
    let leafTimer = 0;
    const game = this.game;
    this.animators.push((dt, t) => {
      // น้ำกระเพื่อม: ขยับจุดยอดขึ้นลงตามคลื่น sin
      const arr = this.water.geometry.attributes.position.array;
      const base = this.waterBase;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] = base[i + 1] + Math.sin(t * 2.2 + base[i] * 0.9 + base[i + 2] * 0.7) * 0.05;
      }
      this.water.geometry.attributes.position.needsUpdate = true;
      // น้ำตก: แถบสีขาวเลื่อนลง
      for (const s of this.waterfall.streaks) {
        s.position.y -= dt * 4;
        if (s.position.y < 0.3) s.position.y = 5.4;
      }
      if (dt > 0 && Math.random() < dt * 25) {
        game.fx.sparks.spawn({ x: this.waterfall.x + (Math.random() - 0.5) * 2.2, y: 0.25, z: this.waterfall.z, vx: (Math.random() - 0.5) * 1.5, vy: 1.8, vz: 0.6 + Math.random(), life: 0.6, size: 0.1, color: 0xdff4ff, gravity: 6, drag: 0.5 });
      }
      for (const m of motes) {
        const b = m.userData.base;
        const ph = m.userData.phase;
        m.position.set(b.x + Math.sin(t * 0.7 + ph) * 0.8, b.y + Math.sin(t * 1.3 + ph * 2) * 0.3, b.z + Math.cos(t * 0.6 + ph) * 0.8);
        m.material.opacity = 0.5 + 0.4 * Math.sin(t * 3 + ph);
      }
      // ใบไม้/กลีบดอกปลิวจากต้นไม้สีสด
      leafTimer += dt;
      if (leafTimer > 0.12 && pinkTrees.length) {
        leafTimer = 0;
        const tr = pinkTrees[Math.floor(Math.random() * pinkTrees.length)];
        game.fx.debris.spawn({ x: tr.x + (Math.random() - 0.5) * 2, y: 2.8, z: tr.z + (Math.random() - 0.5) * 2, vx: 0.6, vy: -0.3, vz: 0.3, life: 3.5, size: 0.09, color: petalColor[tr.colorName], gravity: 0.25, drag: 0.4, spin: 3, floor: 0.03 });
      }
      for (const c of this.critters) c.update(dt);
      // ผลไม้เรืองแสงลอยขึ้นลง
      for (const p of this.pickups) if (!p.taken) p.fruit.position.y = Math.sin(t * 2.5 + p.x) * 0.06;

      // ศาลตื่น: คริสตัลหมุน + ลำแสง
      const cr = this.shrine.crystal;
      cr.rotation.y += dt * (this.shrineAwake ? 1.2 : 0.2);
      cr.position.y = 2.2 + Math.sin(t * 1.5) * (this.shrineAwake ? 0.15 : 0.05);
      if (this.shrineAwake) {
        this.awakeT = Math.min(1, (this.awakeT ?? 0) + dt * 0.5);
        this.beam.material.opacity = 0.35 * this.awakeT + Math.sin(t * 4) * 0.04;
        this.shrine.crystalMat.emissiveIntensity = 0.15 + this.awakeT * 2.6;
        this.shrineLight.intensity = 25 * this.awakeT;
        if (Math.random() < dt * 12) game.fx.sparks.spawn({ x: SHRINE_POS.x + (Math.random() - 0.5) * 3, y: 0.3, z: SHRINE_POS.z + (Math.random() - 0.5) * 3, vx: 0, vy: 2.2, vz: 0, life: 1.4, size: 0.09, color: 0x9fe4ff, gravity: -0.5, drag: 0 });
      }
    });
  }

  // ---------------------------------------------------------
  //  มอนสเตอร์
  // ---------------------------------------------------------
  _spawnEnemies(rng) {
    const add = (Cls, x, z) => this.enemies.push(new Cls(this.game, this, V(x, 0, z), rng));
    // โซน A (ก่อนข้ามสะพาน): สไลม์ฝูงเล็ก + เห็ด 1
    add(Slime, 13, 9);
    add(Slime, 15.5, 12.5);
    add(Slime, 10, 14.5);
    add(MushroomMonster, 7, 18);
    // โซนลับ (ฝั่งตะวันออกของลำธาร)
    add(Slime, 9.5, -11);
    // โซน B (หลังสะพาน)
    add(MushroomMonster, -7, -4.5);
    add(Golem, -10, -11);
    // โซน C (หน้าศาล)
    add(MushroomMonster, -15.5, -9);
    add(Golem, -15.5, -16.5);
  }

  onEnemyKilled() {
    this._updateObjective();
    const left = this.enemies.filter((e) => e.alive).length;
    if (left === 0 && !this.shrineAwake) {
      this.shrineAwake = true;
      this.game.hud.toast('✨ ศาลคริสตัลเริ่มส่องแสง! ไปที่ศาลแล้วกด E', 4);
      this.game.audio.play('portal');
      for (const st of this.shrine.stones) st.rune.material = mat(0x7fd8ff, { emissive: 0x7fd8ff, emissiveIntensity: 2.5 });
      this._updateObjective();
    } else if (left > 0) {
      this.game.hud.toast(`กำจัดได้! เหลืออีก ${left} ตัว`, 1.6);
    }
  }

  /** สะพานโค้ง: ความสูงพื้นสะพาน ณ ตำแหน่งนั้น (นอกสะพาน = 0) */
  groundHeight(x, z) {
    const u = (x + z) * Math.SQRT1_2; // ระยะตามแนวสะพาน
    const v = (x - z) * Math.SQRT1_2; // ระยะขวางสะพาน
    if (Math.abs(v) > 1.3 || Math.abs(u) > 3.4) return 0;
    const t = (u + 3.4) / 6.8;
    return 0.2 + Math.sin(t * Math.PI) * 0.35;
  }

  tick() {
    const p = this.player;
    if (!p?.alive) return;
    // เก็บผลไม้: เดินเข้าใกล้แล้วเก็บอัตโนมัติ (ถ้าเลือดไม่เต็ม)
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(p.position.x - pk.x, p.position.z - pk.z) < 1.4 && p.health.value < p.health.max) {
        pk.taken = true;
        pk.fruit.visible = false;
        p.heal(CONFIG.pickups.healAmount);
        this.game.audio.play('pickup');
        this.game.fx.sparks.burst({ x: pk.x, y: 0.9, z: pk.z, count: 20, speed: 2.5, up: 3, colors: [0xff8fbf, 0xffffff, 0xb8ff8a], size: 0.1, life: 0.7, gravity: 2 });
      }
    }
  }
}
