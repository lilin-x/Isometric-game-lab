// =============================================================
//  Level.js — แม่แบบของ "ด่าน" (ด่านจริงสืบทอดคลาสนี้)
// -------------------------------------------------------------
//  ด่านหนึ่งด่าน = ฉาก 3D + สิ่งกีดขวาง + ตัวละครทั้งหมด + กติกาของด่าน
//
//  ด่านลูก (TownLevel, ForestLevel) แค่ override:
//     build()    สร้างฉาก วางของ วาง NPC/มอนสเตอร์
//     onEnter()  เริ่มด่าน (โชว์ชื่อด่าน, ตั้งเป้าหมาย)
//     tick(dt)   กติกาเฉพาะด่าน (เช่น นับมอนสเตอร์ที่เหลือ)
// =============================================================

import * as THREE from 'three';
import { CollisionWorld, separateBodies } from '../core/Collision.js';
import { Player } from '../entities/Player.js';

export class Level {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.collision = new CollisionWorld();
    this.player = null;
    this.enemies = [];
    this.npcs = [];
    this.dummies = [];
    this.interactables = [];
    this.animators = []; // ฟังก์ชัน (dt, time) สำหรับของตกแต่งที่ขยับได้ (น้ำ, ธง, หิ่งห้อย)
    this.time = 0;
    this.titleMode = false;
    this._prompt = null;
    this._promptTarget = null;
  }

  build() {}
  onEnter() {}
  tick() {}

  // ---------- แสงและบรรยากาศ ----------
  setupLights(o) {
    const scene = this.game.scene;
    scene.background = new THREE.Color(o.background);
    scene.fog = o.fog ? new THREE.Fog(o.fog.color, o.fog.near, o.fog.far) : null;

    // แสงจากท้องฟ้า (บน) + แสงสะท้อนจากพื้น (ล่าง) → เงาไม่ดำสนิท
    const hemi = new THREE.HemisphereLight(o.sky, o.ground, o.hemiIntensity);
    this.root.add(hemi);

    // ดวงอาทิตย์: แสงขนาน (directional) ที่สร้างเงาได้
    const sun = new THREE.DirectionalLight(o.sunColor, o.sunIntensity);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 22;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 90 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.root.add(sun, sun.target);
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(...o.sunDir).normalize().multiplyScalar(40);
    this._shadowTexel = (S * 2) / 2048;
  }

  /** ให้กล่องเงาเลื่อนตามกล้อง (ประหยัด: ไม่ต้องทำเงาทั้งแผนที่) */
  _updateSun() {
    if (!this.sun) return;
    const t = this.game.iso.target;
    // ปัดตำแหน่งให้ตรงกับ "ช่องพิกเซล" ของ shadow map กันเงาสั่นตอนเดิน
    const snap = this._shadowTexel * 4;
    const x = Math.round(t.x / snap) * snap;
    const z = Math.round(t.z / snap) * snap;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x, 0, z).add(this.sunOffset);
  }

  spawnPlayer(pos, facing = 0) {
    this.player = new Player(this.game, this, pos, facing);
    return this.player;
  }

  /** ทุกอย่างที่ดาบฟันโดนได้ */
  getHittables() {
    const list = [];
    for (const e of this.enemies) if (e.alive) list.push(e);
    for (const d of this.dummies) list.push(d);
    return list;
  }

  /** ของที่กด E ได้ (NPC, ประตู, ศาล) */
  addInteractable(it) {
    this.interactables.push(it);
    return it;
  }

  // ---------- update ทุกเฟรม ----------
  update(dt) {
    this.time += dt;
    const player = this.player;
    if (player) player.inputLocked = this.titleMode || this.game.dialogue.isOpen || this.inputConsumed || this.game.state !== 'play';
    if (player) player.update(dt);

    for (const e of this.enemies) e.update(dt);
    for (const n of this.npcs) n.update(dt);
    for (const d of this.dummies) d.update(dt);
    for (const a of this.animators) a(dt, this.time);

    if (dt > 0) {
      // แยกตัวละครที่เดินชนกัน แล้วดันออกจากฉากอีกที
      const bodies = [];
      if (player?.alive) bodies.push(player);
      for (const e of this.enemies) if (e.alive) bodies.push(e);
      for (const n of this.npcs) bodies.push(n);
      separateBodies(bodies);
      for (const b of bodies) if (!b.immovable) this.collision.resolve(b.position, b.radius);
    }

    this._updateSun();
    this._updateInteractions();
    this.tick(dt);
  }

  _updateInteractions() {
    const player = this.player;
    if (!player || !player.alive || this.titleMode || this.game.dialogue.isOpen) return this._showPrompt(null);
    let best = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Math.hypot(it.position.x - player.position.x, it.position.z - player.position.z);
      if (d < (it.range ?? 2) && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this._showPrompt(best);
    if (best && !this.inputConsumed && this.game.input.wasPressed('interact')) best.onInteract();
  }

  _showPrompt(it) {
    if (this._promptTarget === it) return;
    this._promptTarget = it;
    this._prompt?.remove();
    this._prompt = null;
    if (!it) return;
    const pos = new THREE.Vector3();
    this._prompt = this.game.worldUI.attach('prompt', `<kbd>E</kbd> ${it.prompt}`, () => pos.set(it.position.x, it.promptHeight ?? 2.2, it.position.z));
  }

  // ---------- เก็บกวาดตอนออกจากด่าน ----------
  dispose() {
    this.player?.dispose();
    for (const e of this.enemies) e.dispose?.();
    for (const n of this.npcs) n.dispose?.();
    this._prompt?.remove();
    this.game.scene.remove(this.root);
    // คืนหน่วยความจำ GPU (geometry/material ที่ไม่ได้ใช้ร่วมกับด่านอื่น)
    this.root.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (!m.userData.cached) m.dispose();
    });
  }
}
