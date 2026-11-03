// =============================================================
//  Enemy.js — มอนสเตอร์ (คลาสแม่ + 3 ชนิด)
// -------------------------------------------------------------
//  AI ของมอนสเตอร์ทุกตัวใช้ State Machine เดียวกัน:
//
//    idle ──เห็นผู้เล่น──▶ chase ──เข้าระยะ──▶ windup ──▶ attack ──▶ recover ─┐
//     ▲                     │  ▲                (วงแดงเตือน)                  │
//     └──ผู้เล่นหนีไกล──────┘  └──────────────────────────────────────────────┘
//    (โดนฟัน → hurt สะดุ้งสั้นๆ แล้วกลับไป chase,  เลือดหมด → dead)
//
//  แต่ละชนิดต่างกันแค่ "ท่าโจมตี" กับ "ท่าทาง" (override เมธอดในคลาสลูก)
//    Slime    : กระโดดพุ่งใส่จุดที่ผู้เล่นยืน
//    Mushroom : พองหมวกแล้วปล่อยสปอร์รอบตัว
//    Golem    : ยกแขนทุบพื้นด้านหน้า (super armor: ฟันเบาไม่สะดุ้ง)
// =============================================================

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { StateMachine } from '../core/StateMachine.js';
import { Health } from '../core/Health.js';
import { Telegraph } from '../fx/GroundFX.js';
import { createEnemyBar } from '../ui/WorldUI.js';
import { cloneMaterials, compactRig, addSilhouette } from '../models/kit.js';
import { buildSlime, buildMushroomMonster, buildGolem } from '../models/monsters.js';

const _v = new THREE.Vector3();
const WHITE = new THREE.Color(0xffffff);

export class Enemy {
  constructor(game, level, cfg, position, model) {
    this.game = game;
    this.level = level;
    this.cfg = cfg;
    this.model = model;
    this.root = model.root;
    compactRig(this.root);
    this.materials = cloneMaterials(this.root);
    for (const m of this.materials) {
      m.userData.e0 = m.emissive.clone();
      m.userData.i0 = m.emissiveIntensity;
    }
    addSilhouette(this.root, 0xff9a8a);
    level.root.add(this.root);

    this.position = this.root.position;
    this.position.copy(position);
    this.home = position.clone();
    this.facing = Math.random() * Math.PI * 2;
    this.radius = cfg.radius;
    this.mass = cfg.mass;
    this.hitHeight = model.height * 0.5;
    this.health = new Health(cfg.maxHp);
    this.alive = true;
    this.knock = new THREE.Vector3();
    this.flash = 0;
    this.time = Math.random() * 10;
    this.attackDir = new THREE.Vector3();
    this.attackTarget = new THREE.Vector3();
    this.hasHit = false;
    this.wanderTarget = null;
    this.wanderWait = Math.random() * 2;

    this.telegraph = new Telegraph(level.root, 1);
    this.hpBar = createEnemyBar(game.worldUI, () => _v.set(this.position.x, this.model.height + 0.35, this.position.z), cfg.maxHp > 100);

    this.fsm = new StateMachine(this._states(), 'idle');
  }

  // ---------- จุดที่คลาสลูก override ----------
  startWindup() {}
  updateWindup() {}
  startAttack() {}
  updateAttack() {}
  animate() {}

  get player() {
    return this.level.player;
  }

  distToPlayer() {
    const p = this.player;
    if (!p) return Infinity;
    return Math.hypot(p.position.x - this.position.x, p.position.z - this.position.z);
  }

  _states() {
    const e = this;
    const cfg = this.cfg;
    return {
      idle: {
        update(dt) {
          // เดินเล่นแถวบ้าน จนกว่าจะเห็นผู้เล่น
          const p = e.player;
          if (p?.alive && e.distToPlayer() < cfg.aggroRange) return e.fsm.change('chase');
          if (e.wanderWait > 0) {
            e.wanderWait -= dt;
            return;
          }
          if (!e.wanderTarget) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 3;
            e.wanderTarget = new THREE.Vector3(e.home.x + Math.cos(a) * r, 0, e.home.z + Math.sin(a) * r);
          }
          if (e.moveTowards(e.wanderTarget, cfg.speed * 0.45, dt) < 0.3) {
            e.wanderTarget = null;
            e.wanderWait = 1.5 + Math.random() * 2.5;
          }
        },
      },
      chase: {
        update(dt) {
          const p = e.player;
          const d = e.distToPlayer();
          // ระยะเลิกไล่ > ระยะเริ่มไล่ (กันสลับสถานะไปมา = hysteresis)
          const leash = e.position.distanceTo(e.home) > 16;
          if (!p?.alive || d > cfg.aggroRange * 1.6 || leash) {
            e.wanderTarget = e.home.clone();
            return e.fsm.change('idle');
          }
          if (d <= cfg.attackRange && e.fsm.time > 0.25) return e.fsm.change('windup');
          e.moveTowards(p.position, cfg.speed, dt);
        },
      },
      windup: {
        enter() {
          e.hasHit = false;
          e.faceTowards(e.player.position);
          e.startWindup();
          e.game.audio.play('windup', { minGap: 0.1 });
        },
        update(dt) {
          e.updateWindup(dt, Math.min(1, e.fsm.time / cfg.windup));
          if (e.fsm.time >= cfg.windup) e.fsm.change('attack');
        },
        exit() {
          e.telegraph.hide();
        },
      },
      attack: {
        enter() {
          e.startAttack();
        },
        update(dt) {
          if (e.updateAttack(dt, e.fsm.time)) e.fsm.change('recover');
        },
      },
      recover: {
        update() {
          if (e.fsm.time >= cfg.recover) e.fsm.change('chase');
        },
      },
      hurt: {
        enter({ duration }) {
          this.duration = duration;
          e.telegraph.hide();
        },
        update() {
          if (e.fsm.time >= this.duration) e.fsm.change('chase');
        },
      },
      dead: {
        enter() {
          e.alive = false;
          e.telegraph.hide();
          e.hpBar.remove();
          e.game.stats.kills++;
          e.game.audio.play('enemyDie');
          e.onDeath();
          e.level.onEnemyKilled?.(e);
        },
        update() {
          // หดตัวแล้วหายไป
          const k = Math.min(1, e.fsm.time / 0.45);
          e.root.scale.setScalar(Math.max(0.001, 1 - k * k));
          e.root.position.y = k * 0.3;
          if (k >= 1 && e.root.parent) e.root.parent.remove(e.root);
        },
      },
    };
  }

  /** เดินเข้าหาเป้าหมาย คืนค่าระยะที่เหลือ */
  moveTowards(target, speed, dt) {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const step = Math.min(d, speed * dt);
      this.position.x += (dx / d) * step;
      this.position.z += (dz / d) * step;
      this.turnTowards(Math.atan2(dx, dz), dt, 8);
      this.moving = true;
    }
    return d;
  }

  turnTowards(angle, dt, sharp) {
    let diff = angle - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * (1 - Math.exp(-sharp * dt));
  }

  faceTowards(pos) {
    this.facing = Math.atan2(pos.x - this.position.x, pos.z - this.position.z);
  }

  /** ทำ damage ใส่ผู้เล่นถ้าอยู่ในวงกลม (x, z, r) */
  hitPlayerInCircle(x, z, r, damage, knockback = 7) {
    const p = this.player;
    if (!p?.alive || this.hasHit) return false;
    const d = Math.hypot(p.position.x - x, p.position.z - z);
    if (d > r + p.radius) return false;
    const dir = _v.set(p.position.x - x, 0, p.position.z - z);
    if (dir.lengthSq() < 1e-4) dir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    if (p.takeHit({ damage, dir: dir.normalize(), knockback })) {
      this.hasHit = true;
      return true;
    }
    return false;
  }

  // ---------- โดนผู้เล่นฟัน ----------
  takeHit({ damage, dir, knockback, heavy, charge }) {
    if (!this.alive) return false;
    this.health.damage(damage);
    this.flash = 1;
    this.hpBar.set(this.health.ratio);
    const label = heavy ? (charge >= 1 ? 'ชาร์จเต็ม!' : 'ชาร์จ') : '';
    this.game.worldUI.damageNumber(_v.copy(this.position).setY(this.model.height + 0.2), damage, heavy ? 'heavy' : 'light', label);

    // กระเด็นถอยหลัง (ตัวหนัก = กระเด็นน้อย)
    this.knock.copy(dir).multiplyScalar(knockback / this.mass);

    if (this.health.dead) {
      this.fsm.change('dead');
      return damage;
    }
    // Super armor: ฟันเบาไม่ขัดจังหวะ ต้องใช้ฟันชาร์จ
    const staggers = !this.cfg.superArmor || heavy;
    if (staggers) this.fsm.change('hurt', { duration: heavy ? 0.6 : 0.28 });
    else if (Math.random() < 0.35) this.game.worldUI.floatText(_v.copy(this.position).setY(this.model.height + 0.6), 'แข็งโป๊ก!', 'info', 0.7);
    // ถ้ายังไม่เห็นผู้เล่น ให้หันมาสู้ทันที
    if (this.fsm.name === 'idle') this.fsm.change('chase');
    return damage;
  }

  onDeath() {}

  update(dt) {
    if (dt <= 0) return;
    this.time += dt;
    this.moving = false;
    this.fsm.update(dt);
    if (!this.alive) return;

    this.position.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.exp(-8 * dt));
    this.position.y = this.level.groundHeight(this.position.x, this.position.z) + 0.03;

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    for (const m of this.materials) {
      m.emissive.copy(m.userData.e0).lerp(WHITE, this.flash);
      m.emissiveIntensity = m.userData.i0 + (1.0 - m.userData.i0) * this.flash;
    }
    this.animate(dt);
    this.root.rotation.y = this.facing;
  }

  dispose() {
    this.telegraph.dispose();
    this.hpBar.remove();
  }
}

// =============================================================
//  สไลม์: กระโดดพุ่งใส่จุดที่ผู้เล่นยืนตอนเริ่มง้าง
// =============================================================
export class Slime extends Enemy {
  constructor(game, level, position, rng) {
    super(game, level, CONFIG.enemies.slime, position, buildSlime(rng, rng.pick([0x5fd08a, 0x4fc4c9, 0x8fd65a])));
    this.hopPhase = Math.random() * 6;
    this.telegraph.radius = 1.15;
  }

  startWindup() {
    // ล็อกจุดที่จะกระโดดไป (ผู้เล่นหลบได้ถ้าเห็นวงแดง)
    const p = this.player.position;
    const dx = p.x - this.position.x;
    const dz = p.z - this.position.z;
    const d = Math.min(Math.hypot(dx, dz), this.cfg.attackRange + 0.6);
    const dir = this.attackDir.set(dx, 0, dz).normalize();
    this.attackTarget.set(this.position.x + dir.x * d, 0, this.position.z + dir.z * d);
    this.lungeFrom = this.position.clone();
  }

  updateWindup(dt, k) {
    this.telegraph.show(this.attackTarget.x, this.attackTarget.z, k);
  }

  startAttack() {
    this.game.audio.play('slimeHop');
  }

  updateAttack(dt, t) {
    const T = this.cfg.lungeTime;
    const k = Math.min(1, t / T);
    this.position.lerpVectors(this.lungeFrom, this.attackTarget, k);
    this.jumpY = Math.sin(k * Math.PI) * 1.0;
    // โดนตัวระหว่างพุ่ง
    if (k > 0.3) this.hitPlayerInCircle(this.position.x, this.position.z, this.radius * 0.9, this.cfg.damage, 6);
    if (k >= 1) {
      // ลงพื้น: ทำ damage ในวงที่เตือนไว้
      this.hitPlayerInCircle(this.attackTarget.x, this.attackTarget.z, this.telegraph.radius, this.cfg.damage, 6);
      this.game.fx.debris.burst({ x: this.position.x, y: 0.1, z: this.position.z, count: 8, speed: 2.5, up: 1.5, color: 0x5fd08a, size: 0.12, life: 0.5 });
      this.jumpY = 0;
      return true;
    }
    return false;
  }

  animate(dt) {
    const b = this.model.body;
    const st = this.fsm.name;
    let sx = 1;
    let sy = 1;
    let y = 0;
    if (st === 'windup') {
      // บีบตัวลงเตรียมกระโดด (anticipation)
      const k = this.fsm.time / this.cfg.windup;
      sy = 1 - 0.35 * k;
      sx = 1 + 0.25 * k;
      b.position.x = Math.sin(this.time * 60) * 0.02 * k;
    } else if (st === 'attack') {
      y = this.jumpY ?? 0;
      sy = 1.25;
      sx = 0.85;
    } else if (st === 'hurt') {
      sy = 0.7;
      sx = 1.3;
    } else if (this.moving) {
      // เดินแบบเด้งๆ
      this.hopPhase += dt * 9;
      const h = Math.abs(Math.sin(this.hopPhase));
      y = h * 0.25;
      sy = 0.85 + h * 0.3;
      sx = 1.1 - h * 0.15;
    } else {
      sy = 1 + Math.sin(this.time * 3) * 0.05;
      sx = 1 - Math.sin(this.time * 3) * 0.03;
    }
    b.scale.x += (sx - b.scale.x) * Math.min(1, dt * 18);
    b.scale.z = b.scale.x;
    b.scale.y += (sy - b.scale.y) * Math.min(1, dt * 18);
    b.position.y = y;
  }

  onDeath() {
    this.game.fx.debris.burst({ x: this.position.x, y: 0.4, z: this.position.z, count: 16, speed: 4, up: 3, colors: [0x5fd08a, 0x8fffb0, 0x3fa86a], size: 0.15, life: 0.8 });
  }
}

// =============================================================
//  เห็ด: พองหมวกแล้วระเบิดสปอร์รอบตัว
// =============================================================
export class MushroomMonster extends Enemy {
  constructor(game, level, position, rng) {
    super(game, level, CONFIG.enemies.mushroom, position, buildMushroomMonster(rng));
    this.telegraph.radius = this.cfg.burstRadius;
    this.walkPhase = 0;
  }

  updateWindup(dt, k) {
    this.telegraph.show(this.position.x, this.position.z, k);
    if (Math.random() < dt * 20 * k) {
      const a = Math.random() * Math.PI * 2;
      this.game.fx.sparks.spawn({ x: this.position.x + Math.cos(a) * 0.5, y: 1.3, z: this.position.z + Math.sin(a) * 0.5, vx: 0, vy: 0.8, vz: 0, life: 0.5, size: 0.08, color: 0xc77dff, drag: 0 });
    }
  }

  startAttack() {
    this.game.audio.play('spore');
    const r = this.cfg.burstRadius;
    this.hitPlayerInCircle(this.position.x, this.position.z, r, this.cfg.damage, 7);
    this.game.fx.ground.shockwave({ x: this.position.x, z: this.position.z, color: 0xc77dff, from: 0.5, to: r, life: 0.4 });
    this.game.fx.sparks.burst({ x: this.position.x, y: 1.0, z: this.position.z, count: 34, speed: 6, up: 1.5, colors: [0xc77dff, 0xffe066, 0xb5f0a0], size: 0.14, life: 0.7, gravity: 1, spread: 0.6 });
    this.game.fx.debris.burst({ x: this.position.x, y: 1.0, z: this.position.z, count: 14, speed: 4, up: 1, colors: [0xd9c2f0, 0xf3e6ff], size: 0.2, sizeEnd: 0.05, life: 1.0, gravity: -0.5, drag: 2 });
  }

  updateAttack(dt, t) {
    return t > 0.25;
  }

  animate(dt) {
    const m = this.model;
    const st = this.fsm.name;
    if (this.moving) this.walkPhase += dt * 10;
    const sw = this.moving ? Math.sin(this.walkPhase) : 0;
    m.legL.position.y = 0.1 + Math.max(0, sw) * 0.1;
    m.legR.position.y = 0.1 + Math.max(0, -sw) * 0.1;
    m.body.rotation.z = sw * 0.12; // เดินโยกตัวน่ารักๆ
    let capS = 1;
    let squash = 1;
    if (st === 'windup') {
      const k = this.fsm.time / this.cfg.windup;
      capS = 1 + 0.35 * k + Math.sin(this.time * 50) * 0.03 * k; // หมวกพองขึ้น
      squash = 1 - 0.2 * k;
    } else if (st === 'attack') {
      capS = 0.85;
      squash = 1.15;
    } else if (st === 'hurt') {
      squash = 0.8;
    }
    m.cap.scale.setScalar(m.cap.scale.x + (capS - m.cap.scale.x) * Math.min(1, dt * 20));
    m.stem.scale.y += (squash - m.stem.scale.y) * Math.min(1, dt * 20);
  }

  onDeath() {
    this.game.fx.debris.burst({ x: this.position.x, y: 0.8, z: this.position.z, count: 18, speed: 4, up: 3, colors: [0xd64545, 0xfff6e8, 0xf0e2c0], size: 0.16, life: 0.9 });
  }
}

// =============================================================
//  โกเลมหิน: ช้า แข็ง ทุบแรง — จุดอ่อนคือช่วงพักหลังทุบ
// =============================================================
export class Golem extends Enemy {
  constructor(game, level, position, rng) {
    super(game, level, CONFIG.enemies.golem, position, buildGolem(rng));
    this.telegraph.radius = this.cfg.slamRadius;
    this.walkPhase = 0;
    this.eyeMats = this.materials.filter((m) => m.userData.i0 >= 2.5);
  }

  slamCenter(out) {
    return out.set(this.position.x + Math.sin(this.facing) * this.cfg.slamOffset, 0, this.position.z + Math.cos(this.facing) * this.cfg.slamOffset);
  }

  updateWindup(dt, k) {
    // หันตามผู้เล่นช้าๆ ช่วงแรกของการง้าง (หลังจากนั้นล็อกทิศ)
    if (k < 0.5 && this.player) this.turnTowards(Math.atan2(this.player.position.x - this.position.x, this.player.position.z - this.position.z), dt, 3);
    const c = this.slamCenter(_v);
    this.telegraph.show(c.x, c.z, k);
  }

  startAttack() {
    const c = this.slamCenter(new THREE.Vector3());
    this.hitPlayerInCircle(c.x, c.z, this.cfg.slamRadius, this.cfg.damage, 10);
    this.game.audio.play('slam');
    this.game.shake(0.45);
    this.game.fx.ground.shockwave({ x: c.x, z: c.z, color: 0xffb36b, from: 0.5, to: this.cfg.slamRadius + 0.8, life: 0.45 });
    this.game.fx.debris.burst({ x: c.x, y: 0.2, z: c.z, count: 22, speed: 5, up: 5, colors: [0x8a8f99, 0x6f7480, 0xa59a86], size: 0.22, life: 1.0, gravity: 14 });
  }

  updateAttack(dt, t) {
    return t > 0.3;
  }

  animate(dt) {
    const m = this.model;
    const st = this.fsm.name;
    const t = this.time;
    if (this.moving) this.walkPhase += dt * 5;
    const sw = this.moving ? Math.sin(this.walkPhase) : 0;
    m.legL.position.z = sw * 0.25;
    m.legR.position.z = -sw * 0.25;
    m.body.position.y = this.moving ? Math.abs(Math.cos(this.walkPhase)) * 0.08 : 0;
    m.torso.rotation.z = sw * 0.05;
    let armX = sw * 0.3;
    let lean = 0;
    let eye = 3;
    if (st === 'windup') {
      const k = this.fsm.time / this.cfg.windup;
      armX = -Math.PI * 0.95 * easeOut(k); // ยกแขนสองข้างขึ้นสูง
      lean = -0.25 * k;
      eye = 3 + k * 3;
    } else if (st === 'attack') {
      armX = -0.2; // ทุบลง
      lean = 0.35;
    } else if (st === 'recover') {
      // หอบ: ตาหรี่ = ช่วงเปิดให้โจมตี
      armX = 0.25;
      lean = 0.3 + Math.sin(t * 6) * 0.04;
      eye = 0.6;
    } else if (st === 'hurt') {
      lean = -0.2;
      eye = 1;
    }
    m.armL.rotation.x += (armX - m.armL.rotation.x) * Math.min(1, dt * (st === 'attack' ? 30 : 8));
    m.armR.rotation.x = m.armL.rotation.x;
    m.torso.rotation.x += (lean - m.torso.rotation.x) * Math.min(1, dt * 10);
    for (const em of this.eyeMats) em.userData.i0 = em.userData.i0 + (eye - em.userData.i0) * Math.min(1, dt * 6);
    // ฝุ่นตอนเดิน
    if (this.moving && Math.random() < dt * 3) this.game.fx.debris.spawn({ x: this.position.x, y: 0.1, z: this.position.z, vx: 0, vy: 0.6, vz: 0, life: 0.6, size: 0.15, color: 0xb5a88a, gravity: 1 });
  }

  onDeath() {
    this.game.shake(0.4);
    this.game.fx.debris.burst({ x: this.position.x, y: 1.2, z: this.position.z, count: 30, speed: 5, up: 4, colors: [0x8a8f99, 0x6f7480, 0x5f9e45], size: 0.3, life: 1.2, gravity: 14 });
    this.game.fx.sparks.burst({ x: this.position.x, y: 1.6, z: this.position.z, count: 20, speed: 3, up: 3, colors: [0x5fe3ff, 0xffffff], size: 0.12, life: 0.8 });
  }
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);
