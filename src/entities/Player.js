// =============================================================
//  Player.js — ตัวละครที่ผู้เล่นควบคุม (ไค)
// -------------------------------------------------------------
//  ประกอบด้วย:
//   • โมเดล (buildHero) + ผ้าพันคอ (Scarf) + รอยดาบ (SwordTrail)
//   • Component: Health (เลือด), Stamina (พลังกาย)
//   • State Machine: locomotion / attack / charge / heavy / dodge / hurt / dead
//
//  แผนภาพสถานะ (ลูกศร = เปลี่ยนสถานะเมื่อ...)
//
//    locomotion ──คลิกซ้าย──▶ attack ──กดต่อ──▶ attack (คอมโบ 2, 3)
//        │  ▲                   │
//        │  └──────จบท่า────────┘
//        ├──ค้างคลิกขวา──▶ charge ──ปล่อย──▶ heavy ──จบท่า──▶ locomotion
//        ├──Space────────▶ dodge  ──จบท่า──▶ locomotion
//        └──โดนตี────────▶ hurt   ──หายมึน──▶ locomotion   (เลือดหมด → dead)
//
//  ทุกท่า (ยกเว้นเดิน) ต้องผ่าน tryUseStamina() ก่อนเสมอ
// =============================================================

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { StateMachine } from '../core/StateMachine.js';
import { Health } from '../core/Health.js';
import { Stamina } from '../core/Stamina.js';
import { SCREEN_RIGHT, SCREEN_UP } from '../core/IsoCamera.js';
import { buildHero } from '../models/humanoid.js';
import { addSilhouette, cloneMaterials, compactRig } from '../models/kit.js';
import { Scarf } from './Scarf.js';
import { SwordTrail, ArcRing } from '../fx/GroundFX.js';
import { createHeadLoader } from '../ui/WorldUI.js';

const P = CONFIG.player;
const LA = CONFIG.lightAttack;
const HA = CONFIG.heavyAttack;
const DG = CONFIG.dodge;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Player {
  constructor(game, level, spawn, facing = 0) {
    this.game = game;
    this.level = level;
    this.isPlayer = true;

    // ---------- โมเดล ----------
    this.model = buildHero();
    this.root = this.model.root;
    this.joints = this.model.joints;
    this.bladeMat = this.model.sword.bladeMat;
    // รวมชิ้นส่วนในแต่ละข้อต่อ (~70 ชิ้น → ~15 ชิ้น) ยกเว้นใบดาบที่ต้องเรืองแสงเอง
    compactRig(this.root, new Set([this.bladeMat]));
    this.materials = cloneMaterials(this.root, new Set([this.bladeMat])); // วัสดุของไคเอง (ไว้กระพริบตอนโดนตี)
    addSilhouette(this.root, 0xa8dcff);
    level.root.add(this.root);

    this.position = this.root.position;
    this.position.copy(spawn);
    this.facing = facing;
    this.root.rotation.y = facing;
    this.radius = P.radius;
    this.mass = 1;
    this.cameraTarget = new THREE.Vector3();

    // ---------- Components ----------
    this.health = new Health(P.maxHp);
    this.stamina = new Stamina(CONFIG.stamina);

    // ---------- ตัวแปรสถานะ ----------
    this.moveDir = new THREE.Vector3(); // ทิศที่ผู้เล่นกด (โลก)
    this.aimDir = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    this.knock = new THREE.Vector3(); // ความเร็วจากการถูกกระแทก
    this.invulnerable = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.buffer = { action: null, time: 0 };
    this.chargeRatio = 0;
    this.walkPhase = 0;
    this.flash = 0;
    this.hitTargets = new Set();
    this.alive = true;
    this.inputLocked = false;
    this._chargeFullPlayed = false;

    // ท่าทาง (pose) ปัจจุบัน — ค่อยๆ เข้าหาเป้าหมายทุกเฟรม (นุ่มนวล)
    this.pose = defaultPose();

    // ---------- เอฟเฟกต์ประกอบตัว ----------
    this.root.updateMatrixWorld(true);
    this.scarf = new Scarf(level.root, this.model.scarfAnchor, this.model.scarfMat, { segments: 5, segLen: 0.15, width: 0.13 });
    this.scarf2 = new Scarf(level.root, this.model.scarfAnchor, this.model.scarfMat, { segments: 3, segLen: 0.14, width: 0.11, offsetX: 0.08 });
    this.trail = new SwordTrail(level.root, 0xcfeaff);
    this.chargeRing = new ArcRing(level.root, { inner: 0.62, outer: 0.82 });
    this.headLoader = createHeadLoader(game.worldUI, () => _v2.copy(this.position).setY(this.model.height + 0.55));

    this._bindStaminaEvents();
    this.fsm = new StateMachine(this._createStates(), 'locomotion');
  }

  // =============================================================
  //  update — เรียกทุกเฟรม
  // =============================================================
  update(dt) {
    if (dt <= 0) {
      // ระหว่าง hit-stop: ยังอัปเดตผ้าพันคอ/รอยดาบให้ภาพไม่แข็ง (แต่ไม่ขยับ)
      this._updateVisuals(0);
      return;
    }
    this._readInput(dt);
    this.fsm.update(dt);
    this.stamina.update(dt);
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.invulnerable > 0) this.invulnerable -= dt;

    // แรงกระแทก (knockback) ค่อยๆ ลดลงด้วยแรงเสียดทาน
    this.position.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.exp(-9 * dt));

    // ชนกับฉาก
    this.level.collision.resolve(this.position, this.radius);
    this._updateVisuals(dt);
  }

  // ---------- อ่าน input → แปลงเป็นทิศในโลก + เก็บ buffer ----------
  _readInput(dt) {
    const input = this.game.input;
    this.moveDir.set(0, 0, 0);
    if (this.inputLocked || !this.alive) {
      this.buffer.action = null;
      return;
    }
    // WASD อิงหน้าจอ → แปลงเป็นทิศบนพื้นโลก
    const mv = input.moveVector();
    this.moveDir.addScaledVector(SCREEN_RIGHT, mv.x).addScaledVector(SCREEN_UP, mv.y);

    // เล็งตามเมาส์ (ถ้าใช้เมาส์) ไม่งั้นเล็งตามทิศที่เดิน
    if (input.lastDevice === 'mouse' && input.mouse.inside) {
      const g = this.game.iso.screenToGround(input.mouse.ndcX, input.mouse.ndcY, 0, _v);
      g.sub(this.position).setY(0);
      if (g.lengthSq() > 0.04) this.aimDir.copy(g.normalize());
    } else if (this.moveDir.lengthSq() > 0) {
      this.aimDir.copy(this.moveDir);
    }

    // Input buffer: จำปุ่มที่กดไว้สักพัก เผื่อกดก่อนท่าเดิมจบนิดหน่อย
    // (ทำให้คอมโบลื่น ไม่ต้องกดให้ตรงเฟรมเป๊ะๆ)
    if (input.wasPressed('dodge')) this._setBuffer('dodge');
    else if (input.wasPressed('light')) this._setBuffer('light');
    else if (input.wasPressed('heavy')) this._setBuffer('heavy');
    if (this.buffer.action) {
      this.buffer.time -= dt;
      if (this.buffer.time <= 0) this.buffer.action = null;
    }
  }

  _setBuffer(action) {
    this.buffer.action = action;
    this.buffer.time = P.inputBuffer;
  }

  _consume(action) {
    if (this.buffer.action !== action) return false;
    this.buffer.action = null;
    return true;
  }

  /** ลองใช้ stamina — ถ้าหมดแรงอยู่ จะแสดงผลตอบกลับให้ผู้เล่นรู้ */
  tryUseStamina(cost) {
    if (this.stamina.spend(cost)) return true;
    this.game.hud.staminaDenied();
    this.game.audio.play('noStamina', { minGap: 0.25 });
    if (!this._deniedCooldown || this.game.elapsed > this._deniedCooldown) {
      this.game.worldUI.floatText(_v.copy(this.position).setY(this.model.height + 0.3), 'เหนื่อย…', 'warn');
      this._deniedCooldown = this.game.elapsed + 0.6;
    }
    return false;
  }

  // =============================================================
  //  States
  // =============================================================
  _createStates() {
    const p = this;
    const game = this.game;

    return {
      // ---------- เดิน / ยืน ----------
      locomotion: {
        update(dt) {
          const exhausted = p.stamina.exhausted;
          const speed = P.moveSpeed * (exhausted ? P.exhaustedSpeedMul : 1);
          p.position.addScaledVector(p.moveDir, speed * dt);
          if (p.moveDir.lengthSq() > 0) p._turnTowards(p.moveDir, dt);

          if (p._consume('dodge') && p.tryUseStamina(DG.cost)) return p.fsm.change('dodge');
          if (p._consume('light') && p.tryUseStamina(LA.cost)) {
            const next = p.comboTimer > 0 ? (p.combo + 1) % 3 : 0;
            return p.fsm.change('attack', { combo: next });
          }
          const pressedHeavy = p._consume('heavy');
          const wantsCharge = pressedHeavy || (game.input.isDown('heavy') && !p.inputLocked);
          if (wantsCharge && p.alive) {
            if (p.stamina.canAct()) return p.fsm.change('charge');
            if (pressedHeavy) p.tryUseStamina(0); // แจ้งเตือนเฉพาะตอนเพิ่งกด ไม่ใช่ทุกเฟรมที่ค้าง
          }
        },
      },

      // ---------- ฟันเบา (คอมโบ 3 จังหวะ) ----------
      attack: {
        enter({ combo }) {
          p.combo = combo;
          p.comboTimer = 0;
          p.hitTargets.clear();
          p._faceInstant(p.aimDir);
          p.trail.active = true;
          p.trail.setColor(0xcfeaff);
          game.audio.play('swing', { pitch: combo });
          this.lunge = combo === 2 ? 3.2 : 2.2; // ก้าวไปข้างหน้านิดหน่อยให้มีน้ำหนัก
        },
        update(dt) {
          const t = p.fsm.time;
          // ก้าวไปข้างหน้าช่วงแรกของท่า
          if (t < 0.12) p.position.addScaledVector(_v.set(Math.sin(p.facing), 0, Math.cos(p.facing)), this.lunge * dt);

          // Active frame: ช่วงที่ดาบ "ทำ damage" จริง
          if (t >= LA.hitTime && t - dt < LA.hitTime) {
            const fin = p.combo === 2;
            const [lo, hi] = fin ? LA.finisherDamage : LA.damage;
            p._hitArc({
              range: LA.range + (fin ? 0.2 : 0),
              arcDeg: LA.arcDeg,
              damage: lo + Math.floor(Math.random() * (hi - lo + 1)),
              knockback: LA.knockback * (fin ? 1.6 : 1),
              heavy: false,
              hitStop: LA.hitStop * (fin ? 1.5 : 1),
            });
          }

          // Cancel window: หลังดาบโดนแล้ว กดต่อได้ทันที (ลื่นไหล)
          const canChain = t > LA.hitTime + 0.07;
          if (canChain && p.buffer.action === 'dodge') {
            p.buffer.action = null;
            if (p.tryUseStamina(DG.cost)) return p.fsm.change('dodge');
          }
          if (canChain && p.buffer.action === 'light' && p.combo < 2) {
            p.buffer.action = null;
            if (p.tryUseStamina(LA.cost)) return p.fsm.change('attack', { combo: p.combo + 1 });
          }
          if (t >= LA.duration * (p.combo === 2 ? 1.25 : 1)) {
            p.comboTimer = p.combo < 2 ? LA.comboWindow : 0;
            p.fsm.change('locomotion');
          }
        },
        exit() {
          p.trail.active = false;
        },
      },

      // ---------- ชาร์จ (กดค้าง) ----------
      charge: {
        enter() {
          p.chargeRatio = 0;
          p._chargeFullPlayed = false;
          p.stamina.holdRegen = true; // ระหว่างชาร์จ stamina ไม่ฟื้น
        },
        update(dt) {
          const t = p.fsm.time;
          p.chargeRatio = Math.min(1, t / HA.chargeTime);
          p.position.addScaledVector(p.moveDir, P.moveSpeed * P.chargeSpeedMul * dt);
          p._turnTowards(p.aimDir, dt);
          p.chargeRing.set(p.chargeRatio);
          p.chargeRing.setColor(p.chargeRatio >= 1 ? 0xfff2b0 : 0xffb347);
          game.audio.setCharge(p.chargeRatio);

          // ดาบเรืองแสงตามระดับการชาร์จ
          p.bladeMat.emissiveIntensity = p.chargeRatio * 2.2 + (p.chargeRatio >= 1 ? Math.sin(t * 30) * 0.6 : 0);

          // ประกายไฟดูดเข้าดาบ
          if (Math.random() < dt * 30 * (0.3 + p.chargeRatio)) {
            p.model.sword.tip.getWorldPosition(_v);
            const a = Math.random() * Math.PI * 2;
            game.fx.sparks.spawn({ x: _v.x + Math.cos(a) * 0.8, y: _v.y + 0.3, z: _v.z + Math.sin(a) * 0.8, vx: -Math.cos(a) * 3, vy: -0.5, vz: -Math.sin(a) * 3, life: 0.25, size: 0.08, color: 0xffd36b, drag: 0 });
          }
          if (p.chargeRatio >= 1 && !p._chargeFullPlayed) {
            p._chargeFullPlayed = true;
            game.audio.play('chargeFull');
            game.fx.ground.shockwave({ x: p.position.x, z: p.position.z, color: 0xfff2b0, from: 0.4, to: 1.4, life: 0.3 });
          }

          if (p._consume('dodge')) {
            if (p.tryUseStamina(DG.cost)) return p.fsm.change('dodge');
          }
          if (!game.input.isDown('heavy') || p.inputLocked) p.fsm.change('heavy', { ratio: p.chargeRatio });
        },
        exit() {
          p.stamina.holdRegen = false;
          p.chargeRing.set(0);
          game.audio.stopCharge();
          if (p.fsm.name !== 'heavy') p.bladeMat.emissiveIntensity = 0;
        },
      },

      // ---------- ฟันแรง (หมุนตัวฟันรอบทิศ) ----------
      heavy: {
        enter({ ratio }) {
          this.ratio = ratio;
          const cost = HA.minCost + (HA.maxCost - HA.minCost) * ratio;
          p.stamina.spend(cost); // จ่ายตอนปล่อย (ถ้าแรงไม่พอ → หลอดหมด → ติด cooldown)
          p.hitTargets.clear();
          p._faceInstant(p.aimDir);
          this.startFacing = p.facing;
          p.trail.active = true;
          p.trail.setColor(ratio >= 1 ? 0xffe08a : 0xffc070);
          game.audio.play('heavySwing');
        },
        update(dt) {
          const t = p.fsm.time;
          if (t >= HA.hitTime && t - dt < HA.hitTime) {
            const r = this.ratio;
            const dmg = Math.round(HA.minDamage + (HA.maxDamage - HA.minDamage) * r);
            p._hitArc({
              range: HA.minRange + (HA.maxRange - HA.minRange) * r,
              arcDeg: 360,
              damage: dmg,
              knockback: HA.knockback * (0.6 + r * 0.6),
              heavy: true,
              charge: r,
              hitStop: HA.hitStop * (0.6 + r * 0.6),
            });
            game.fx.ground.shockwave({ x: p.position.x, z: p.position.z, color: 0xffc35a, from: 0.5, to: HA.minRange + (HA.maxRange - HA.minRange) * r + 0.4, life: 0.35 });
            game.shake(0.15 + r * 0.2);
          }
          p.bladeMat.emissiveIntensity = Math.max(0, p.bladeMat.emissiveIntensity - dt * 6);
          if (t >= HA.duration) p.fsm.change('locomotion');
        },
        exit() {
          p.trail.active = false;
          p.bladeMat.emissiveIntensity = 0;
          p.facing = this.startFacing;
        },
      },

      // ---------- กลิ้งหลบ ----------
      dodge: {
        enter() {
          this.dir = (p.moveDir.lengthSq() > 0 ? p.moveDir : _v.set(Math.sin(p.facing), 0, Math.cos(p.facing))).clone().normalize();
          p._faceInstant(this.dir);
          game.audio.play('dodge');
          game.stats.dodges++;
          game.fx.debris.burst({ x: p.position.x, y: 0.1, z: p.position.z, count: 8, speed: 2, up: 1.5, color: 0xcbb898, size: 0.12, life: 0.5, gravity: 6 });
        },
        update(dt) {
          const t = p.fsm.time / DG.duration;
          // เร็วตอนต้น ช้าลงตอนท้าย (ease-out)
          const speed = DG.speed * (1 - t * t);
          p.position.addScaledVector(this.dir, speed * dt);
          if (Math.random() < dt * 25) game.fx.debris.spawn({ x: p.position.x, y: 0.08, z: p.position.z, vx: 0, vy: 1, vz: 0, life: 0.35, size: 0.1, color: 0xd8c8a8, gravity: 3 });
          if (p.fsm.time >= DG.duration) p.fsm.change('locomotion');
        },
      },

      // ---------- โดนตี ----------
      hurt: {
        update() {
          if (p.fsm.time >= P.hurtStun) p.fsm.change('locomotion');
        },
      },

      // ---------- เลือดหมด ----------
      dead: {
        enter() {
          p.alive = false;
          p.trail.active = false;
          p.chargeRing.set(0);
          game.audio.stopCharge();
          game.onPlayerDied();
        },
      },
    };
  }

  /** ช่วง i-frames ของการกลิ้ง: โดนตีแล้วไม่เสียเลือด */
  get isDodgeInvulnerable() {
    if (this.fsm.name !== 'dodge') return false;
    const t = this.fsm.time;
    return t >= DG.iFrameStart && t <= DG.iFrameEnd;
  }

  // =============================================================
  //  การต่อสู้
  // =============================================================

  /** หาเป้าหมายในรัศมี + มุมกวาดหน้าดาบ แล้วทำ damage */
  _hitArc({ range, arcDeg, damage, knockback, heavy, charge = 0, hitStop }) {
    const game = this.game;
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    const halfArc = THREE.MathUtils.degToRad(arcDeg / 2);
    let hits = 0;
    let hitEnemy = false;

    for (const target of this.level.getHittables()) {
      if (this.hitTargets.has(target)) continue;
      const dx = target.position.x - this.position.x;
      const dz = target.position.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range + target.radius) continue;
      // เช็คมุม: ใช้ dot product ระหว่างทิศที่หัน กับ ทิศไปหาเป้าหมาย
      if (arcDeg < 360 && dist > 0.3) {
        const cos = (dx * fx + dz * fz) / dist;
        if (Math.acos(THREE.MathUtils.clamp(cos, -1, 1)) > halfArc) continue;
      }
      this.hitTargets.add(target);
      const dir = new THREE.Vector3(dx, 0, dz).normalize();
      const dealt = target.takeHit({ damage, knockback, dir, heavy, charge, source: this });
      if (dealt === false) continue;
      hits++;
      if (!target.isDummy) hitEnemy = true;
      game.stats.damage += damage;
      if (heavy) game.stats.heavyHits++;

      // ประกายไฟตรงจุดที่โดน
      const hp = _v.copy(target.position).addScaledVector(dir, -target.radius * 0.6);
      hp.y = target.hitHeight ?? 0.8;
      game.fx.sparks.burst({ x: hp.x, y: hp.y, z: hp.z, count: heavy ? 22 : 10, speed: heavy ? 7 : 5, up: 2.5, colors: heavy ? [0xffd36b, 0xffffff, 0xff9d3b] : [0xffffff, 0xcfeaff, 0xffe9a8], size: heavy ? 0.16 : 0.11, life: 0.35, gravity: 10, dirAngle: Math.atan2(dir.z, dir.x), arc: 2.2 });
    }

    if (hits > 0) {
      // "Juice": หยุดภาพแป๊บ + สั่นจอ + เสียง ให้รู้สึกว่าโดนจริง
      game.hitStop(hitStop);
      game.shake(heavy ? HA.shake * (0.5 + charge * 0.5) : 0.08);
      if (hitEnemy || heavy) game.audio.play(heavy ? 'heavyHit' : 'hit');
    }
    return hits;
  }

  /** ถูกโจมตี — คืนค่า false ถ้าไม่โดน (หลบทัน / อมตะอยู่) */
  takeHit({ damage, dir, knockback = 6 }) {
    const game = this.game;
    if (!this.alive) return false;
    if (this.isDodgeInvulnerable) {
      if (!this._lastPerfect || game.elapsed - this._lastPerfect > 0.5) {
        game.worldUI.floatText(_v.copy(this.position).setY(this.model.height + 0.2), 'หลบได้!', 'info');
        this._lastPerfect = game.elapsed;
      }
      return false;
    }
    if (this.invulnerable > 0) return false;

    this.health.damage(damage);
    this.invulnerable = P.hurtInvulnerable;
    this.flash = 1;
    this.knock.copy(dir).setY(0).normalize().multiplyScalar(knockback);
    game.worldUI.damageNumber(_v.copy(this.position).setY(this.model.height + 0.1), damage, 'player');
    game.audio.play('hurt');
    game.shake(0.3);
    game.hitStop(0.06);
    game.fx.sparks.burst({ x: this.position.x, y: 0.9, z: this.position.z, count: 12, speed: 4, up: 3, colors: [0xff6b5b, 0xffffff], size: 0.12, life: 0.35 });

    if (this.health.dead) this.fsm.change('dead');
    else this.fsm.change('hurt');
    return true;
  }

  heal(amount) {
    const healed = this.health.heal(amount);
    if (healed > 0) this.game.worldUI.floatText(_v.copy(this.position).setY(this.model.height + 0.2), `+${Math.round(healed)}`, 'heal');
    return healed;
  }

  _bindStaminaEvents() {
    const game = this.game;
    this.stamina.events.on('exhausted', () => {
      game.audio.play('exhausted');
      game.stats.exhausted++;
      game.worldUI.floatText(_v.copy(this.position).setY(this.model.height + 0.4), 'หมดแรง!', 'warn', 1.1);
    });
    this.stamina.events.on('recovered', () => {
      game.audio.play('recovered');
      game.hud.staminaRecovered();
      game.worldUI.floatText(_v.copy(this.position).setY(this.model.height + 0.4), 'ฟื้นแรงแล้ว!', 'heal', 1);
      game.fx.sparks.burst({ x: this.position.x, y: 1.0, z: this.position.z, count: 14, speed: 2.5, up: 3, colors: [0xfff2a8, 0xb8ff8a], size: 0.1, life: 0.6, gravity: 2 });
    });
  }

  // =============================================================
  //  หันตัว
  // =============================================================
  _turnTowards(dir, dt) {
    const target = Math.atan2(dir.x, dir.z);
    let diff = target - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // หามุมที่สั้นที่สุด (-π..π)
    this.facing += diff * (1 - Math.exp(-P.turnSharpness * dt));
  }

  _faceInstant(dir) {
    if (dir.lengthSq() > 0) this.facing = Math.atan2(dir.x, dir.z);
  }

  // =============================================================
  //  ภาพ: ท่าทาง (procedural animation) + เอฟเฟกต์
  // =============================================================
  _updateVisuals(dt) {
    const j = this.joints;
    const pose = this.pose;
    const target = defaultPose();
    const st = this.fsm.name;
    const t = this.fsm.time;
    const moving = this.moveDir.lengthSq() > 0 && (st === 'locomotion' || st === 'charge');
    const exhausted = this.stamina.exhausted;
    let rate = 14; // ความเร็วที่ท่าทางเข้าหาเป้าหมาย
    let spin = 0;

    // ---------- ท่าพื้นฐาน: ยืน / เดิน / หมดแรง ----------
    const speedMul = st === 'charge' ? P.chargeSpeedMul : exhausted ? P.exhaustedSpeedMul : 1;
    if (moving) {
      const prevPhase = this.walkPhase;
      this.walkPhase += dt * 11 * speedMul;
      // เสียงเท้า: ทุกครั้งที่เฟส sin ข้ามศูนย์
      if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) this.game.audio.play('step', { minGap: 0.12 });
    }
    const sw = moving ? Math.sin(this.walkPhase) : 0;
    const time = this.game.elapsed;
    target.legL = sw * 0.75;
    target.legR = -sw * 0.75;
    target.armLx = -sw * 0.6;
    target.armRx = -0.25 + sw * 0.25;
    target.wristR = -1.05;
    target.bodyY = moving ? Math.abs(Math.cos(this.walkPhase)) * 0.06 : Math.sin(time * 2.2) * 0.012;
    target.lean = moving ? 0.12 : 0;

    if (exhausted && (st === 'locomotion' || st === 'hurt')) {
      // หอบ: ก้มตัว หัวตก แขนห้อย ดาบลากพื้น
      target.lean = 0.38;
      target.headX = 0.35;
      target.armLx = 0.15 + sw * 0.2;
      target.armRx = 0.1 + sw * 0.1;
      target.wristR = -0.55;
      target.bodyY = -0.05 + Math.sin(time * 9) * 0.025;
      target.torsoY = Math.sin(time * 9) * 0.03;
      if (Math.random() < dt * 3) {
        this.game.fx.sparks.spawn({ x: this.position.x + (Math.random() - 0.5) * 0.4, y: 1.45, z: this.position.z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 1.5, vy: 1.5, vz: (Math.random() - 0.5) * 1.5, life: 0.5, size: 0.06, color: 0x7fc8ff, gravity: 6, drag: 0 });
      }
    }

    // ---------- ท่าต่อสู้ ----------
    if (st === 'attack') {
      rate = 30;
      const k = Math.min(1, t / LA.hitTime); // 0→1 ก่อนดาบโดน
      const e = easeOutCubic(k);
      target.armRx = -Math.PI / 2;
      target.wristR = 0.05;
      target.legL = 0.35;
      target.legR = -0.35;
      target.lean = 0.15;
      if (this.combo === 0) {
        // เหวี่ยงจากขวาไปซ้าย
        target.armRy = lerp(-1.7, 1.3, e);
        target.torsoY = lerp(-0.6, 0.5, e);
      } else if (this.combo === 1) {
        // เหวี่ยงกลับจากซ้ายไปขวา
        target.armRy = lerp(1.4, -1.6, e);
        target.torsoY = lerp(0.6, -0.5, e);
        target.legL = -0.35;
        target.legR = 0.35;
      } else {
        // จังหวะ 3: ฟันจากบนลงล่าง
        target.armRx = lerp(-3.0, -0.55, e);
        target.armRy = -0.2;
        target.wristR = lerp(-0.2, 0.1, e);
        target.lean = lerp(-0.1, 0.35, e);
        target.bodyY = lerp(0.05, -0.08, e);
      }
      target.armLx = -0.5;
      target.armLz = 0.4;
    } else if (st === 'charge') {
      rate = 12;
      const shake = this.chargeRatio >= 1 ? Math.sin(time * 70) * 0.02 : 0;
      target.armRx = -1.45;
      target.armRy = -2.2;
      target.wristR = 0.1;
      target.torsoY = -0.7 + shake;
      target.lean = 0.18;
      target.bodyY = -0.08 - this.chargeRatio * 0.05;
      target.legL = 0.5;
      target.legR = -0.4;
      target.armLx = -1.2;
      target.armLy = 0.6;
      if (moving) {
        target.legL += sw * 0.3;
        target.legR -= sw * 0.3;
      }
    } else if (st === 'heavy') {
      rate = 40;
      const k = Math.min(1, t / (HA.hitTime + 0.12));
      // หมุนตัวรอบทิศ 1 รอบ (ตัวทั้งตัวหมุน = spin)
      spin = easeOutCubic(k) * Math.PI * 2;
      target.armRx = -Math.PI / 2;
      target.armRy = -1.4;
      target.wristR = 0.05;
      target.armLx = -1.4;
      target.armLy = 1.2;
      target.lean = 0.2;
      target.bodyY = -0.1;
      target.legL = 0.4;
      target.legR = -0.4;
    } else if (st === 'dodge') {
      rate = 40;
      const k = Math.min(1, t / DG.duration);
      target.roll = easeInOut(k) * Math.PI * 2; // ตีลังกาไปข้างหน้า 1 รอบ
      target.bodyY = -0.18 * Math.sin(k * Math.PI);
      target.legL = -1.2;
      target.legR = -1.2;
      target.armLx = -1.0;
      target.armRx = -1.0;
      target.wristR = -1.6;
      target.lean = 0.5;
      target.headX = 0.4;
    } else if (st === 'hurt') {
      rate = 30;
      target.lean = -0.35;
      target.headX = -0.3;
      target.armLx = -0.8;
      target.armLz = 0.7;
      target.armRx = -0.6;
    } else if (st === 'dead') {
      rate = 6;
      target.roll = -Math.PI / 2;
      target.bodyY = -0.38;
      target.armLx = -2.6;
      target.armRx = -2.4;
      target.wristR = -0.4;
    }

    // ---------- ค่อยๆ ขยับท่าปัจจุบันไปหาเป้าหมาย ----------
    const k = dt > 0 ? 1 - Math.exp(-rate * dt) : 0;
    for (const key in target) {
      if (key === 'roll' && st !== 'dodge' && st !== 'dead' && pose.roll > Math.PI) {
        pose.roll = 0; // จบการกลิ้ง → รีเซ็ตมุม
      }
      pose[key] += (target[key] - pose[key]) * (key === 'roll' && st === 'dodge' ? 1 : k);
    }

    // ---------- เอาท่าไปใส่ข้อต่อ ----------
    j.body.position.y = -0.55 + pose.bodyY;
    j.roll.rotation.x = pose.roll;
    j.torso.rotation.set(pose.lean, pose.torsoY, 0);
    j.head.rotation.set(pose.headX, -pose.torsoY * 0.5, 0);
    j.legL.rotation.x = pose.legL;
    j.legR.rotation.x = pose.legR;
    j.shoulderL.rotation.set(pose.armLx, pose.armLy, pose.armLz);
    j.shoulderR.rotation.set(pose.armRx, pose.armRy, -0.08);
    j.wristR.rotation.x = pose.wristR;
    this.root.rotation.y = this.facing + spin;

    // ---------- กระพริบตอนโดนตี / อมตะ ----------
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    for (const m of this.materials) {
      if (m === this.bladeMat) continue;
      m.emissive.setRGB(this.flash * 0.9, this.flash * 0.15, this.flash * 0.1);
    }
    const blink = this.invulnerable > 0 && this.alive && Math.floor(this.invulnerable * 20) % 2 === 0;
    this.root.visible = !blink;
    this.scarf.setVisible(!blink);
    this.scarf2.setVisible(!blink);

    // ---------- ผ้าพันคอ + รอยดาบ + UI เหนือหัว ----------
    this.root.updateMatrixWorld(true);
    this.scarf.update(dt, this.position, this.facing + spin);
    this.scarf2.update(dt, this.position, this.facing + spin);
    this.model.sword.base.getWorldPosition(_v);
    this.model.sword.tip.getWorldPosition(_v2);
    this.trail.push(_v, _v2);
    this.trail.update(dt);
    this.headLoader.set(this.stamina.exhausted && this.alive, this.stamina.exhaustProgress);

    this.cameraTarget.set(this.position.x, 0, this.position.z);
  }

  dispose() {
    this.scarf.dispose();
    this.scarf2.dispose();
    this.headLoader.remove();
    this.game.audio.stopCharge();
  }
}

// ท่าพื้นฐาน (มุมเป็นเรเดียน)
function defaultPose() {
  return { bodyY: 0, roll: 0, lean: 0, torsoY: 0, headX: 0, legL: 0, legR: 0, armLx: 0, armLy: 0, armLz: 0.12, armRx: -0.25, armRy: 0, wristR: -1.05 };
}

const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
