// =============================================================
//  NPC.js — ชาวเมือง (Non-Player Character)
// -------------------------------------------------------------
//  NPC แต่ละคนมี "พฤติกรรม" (behavior) ง่ายๆ ให้เมืองดูมีชีวิต:
//    stand   ยืนเฝ้าร้าน มองซ้ายขวา โบกมือ
//    patrol  เดินตามจุดที่กำหนด (waypoints) วนไปเรื่อยๆ แวะพักแต่ละจุด
//    wander  เดินสุ่มในรัศมีรอบจุดบ้าน
//    circle  วิ่งวนเป็นวงกลม (เด็กเล่น)
//    sit     นั่งบนม้านั่ง
//    hammer  ตีเหล็ก (มีประกายไฟ + เสียง)
//
//  เดินเข้าใกล้ → มีฟองคำพูดสั้นๆ (bark)
//  กด E → เปิดบทสนทนาเต็ม
// =============================================================

import * as THREE from 'three';
import { buildHumanoid } from '../models/humanoid.js';
import { box, cyl, cone, ico, at, group, compactRig } from '../models/kit.js';

const _v = new THREE.Vector3();

export class NPC {
  constructor(game, level, o) {
    this.game = game;
    this.level = level;
    this.o = o;
    this.name = o.name;
    this.model = buildHumanoid(o.look);
    this.root = this.model.root;
    this.j = this.model.joints;
    level.root.add(this.root);
    this.position = this.root.position;
    this.position.copy(o.position);
    this.home = o.position.clone();
    this.facing = o.facing ?? 0;
    this.radius = 0.4;
    this.mass = 3;
    this.immovable = ['stand', 'sit', 'hammer'].includes(o.behavior);
    this.speed = o.speed ?? 1.3;
    this.behavior = o.behavior ?? 'stand';
    this.time = Math.random() * 10;
    this.walkPhase = 0;
    this.moving = false;
    this.wait = Math.random() * 2;
    this.pathIndex = 0;
    this.target = null;
    this.talking = false;
    this.barkCooldown = 2 + Math.random() * 3;
    this.lookYaw = 0;
    this.wave = 0;
    this.hammerT = Math.random();

    if (o.prop) addProp(this, o.prop);
    compactRig(this.root); // รวมชิ้นส่วนในแต่ละข้อต่อ ลด draw call

    level.addInteractable({
      position: this.position,
      range: 2.1,
      prompt: o.prompt ?? `คุยกับ${o.name}`,
      promptHeight: this.model.height + 0.75,
      onInteract: () => this.talk(),
    });
  }

  talk() {
    const p = this.level.player;
    this.talking = true;
    this.game.audio.play('ui');
    this.wave = 1;
    this.game.dialogue.open(this.name, this.o.lines, () => {
      this.talking = false;
      this.o.onTalked?.();
    });
    if (p) this.facing = Math.atan2(p.position.x - this.position.x, p.position.z - this.position.z);
  }

  update(dt) {
    if (dt <= 0) return;
    this.time += dt;
    const player = this.level.player;
    this.moving = false;

    if (!this.talking) this._behave(dt);
    else if (player) this._turnTo(player.position, dt, 8);

    // ฟองคำพูดเวลาผู้เล่นเดินผ่าน
    if (player && this.o.barks && !this.talking && !this.level.titleMode) {
      this.barkCooldown -= dt;
      const d = this.position.distanceTo(player.position);
      if (d < 4.5 && this.barkCooldown <= 0) {
        this._bark(this.o.barks[Math.floor(Math.random() * this.o.barks.length)]);
        this.barkCooldown = 9 + Math.random() * 6;
        this.wave = 1;
      }
    }
    this._animate(dt);
  }

  _bark(text, life = 2.8) {
    const h = this.model.height + 0.6;
    this.game.worldUI.attach('bubble', text, () => _v.set(this.position.x, h, this.position.z), life);
  }

  _behave(dt) {
    const b = this.behavior;
    if (b === 'patrol' || b === 'wander') {
      if (this.wait > 0) {
        this.wait -= dt;
        return;
      }
      if (!this.target) {
        if (b === 'patrol') {
          this.target = this.o.path[this.pathIndex];
          this.pathIndex = (this.pathIndex + 1) % this.o.path.length;
        } else {
          // สุ่มหาจุดว่างในรัศมี
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * (this.o.wanderRadius ?? 4);
            const x = this.home.x + Math.cos(a) * r;
            const z = this.home.z + Math.sin(a) * r;
            if (this.level.collision.isFree(x, z, this.radius + 0.2)) {
              this.target = new THREE.Vector3(x, 0, z);
              break;
            }
          }
          if (!this.target) this.wait = 1;
        }
      }
      if (this.target) {
        const dx = this.target.x - this.position.x;
        const dz = this.target.z - this.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) {
          this.target = null;
          this.wait = this.o.pause ?? 1.5 + Math.random() * 2.5;
        } else {
          const step = Math.min(d, this.speed * dt);
          this.position.x += (dx / d) * step;
          this.position.z += (dz / d) * step;
          this._turnTo(this.target, dt, 6);
          this.moving = true;
          // ติดอะไรอยู่นานเกินไป → ยอมแพ้เป้าหมายนี้
          this._stuck = (this._stuck ?? 0) + dt;
          if (this._stuck > 8) {
            this.target = null;
            this._stuck = 0;
          }
        }
      }
    } else if (b === 'circle') {
      const c = this.o.center;
      const r = this.o.circleRadius ?? 3.2;
      const a = this.time * (this.speed / r);
      const tx = c.x + Math.cos(a) * r;
      const tz = c.z + Math.sin(a) * r;
      this.position.x += (tx - this.position.x) * Math.min(1, dt * 5);
      this.position.z += (tz - this.position.z) * Math.min(1, dt * 5);
      this.facing = Math.atan2(-Math.sin(a), Math.cos(a));
      this.moving = true;
    } else if (b === 'hammer') {
      const prev = this.hammerT;
      this.hammerT = (this.hammerT + dt * 0.9) % 1;
      if (prev < 0.55 && this.hammerT >= 0.55) {
        // ตีโดนทั่ง! ประกายไฟ + เสียง (เบาลงถ้าผู้เล่นอยู่ไกล)
        const ap = this.o.anvilPos;
        this.game.fx.sparks.burst({ x: ap.x, y: ap.y, z: ap.z, count: 10, speed: 3.5, up: 3, colors: [0xffd36b, 0xff8a3d, 0xffffff], size: 0.07, life: 0.45, gravity: 9 });
        const p = this.level.player;
        if (p && p.position.distanceTo(ap) < 9 && !this.level.titleMode) this.game.audio.play('anvil');
      }
    } else {
      // stand / sit: มองซ้ายขวาเป็นระยะ หันกลับทิศเดิม
      this._turnTo(_v.set(this.home.x + Math.sin(this.o.facing ?? 0), 0, this.home.z + Math.cos(this.o.facing ?? 0)), dt, 2);
      this.lookYaw = Math.sin(this.time * 0.5) * 0.5 * (Math.sin(this.time * 0.17) > 0 ? 1 : 0);
    }
  }

  _turnTo(pos, dt, sharp) {
    const target = Math.atan2(pos.x - this.position.x, pos.z - this.position.z);
    let diff = target - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * (1 - Math.exp(-sharp * dt));
  }

  _animate(dt) {
    const j = this.j;
    const t = this.time;
    if (this.moving) this.walkPhase += dt * (this.behavior === 'circle' ? 13 : 8);
    const sw = this.moving ? Math.sin(this.walkPhase) : 0;
    const amp = this.behavior === 'circle' ? 0.9 : 0.6;
    j.legL.rotation.x = sw * amp;
    j.legR.rotation.x = -sw * amp;
    j.shoulderL.rotation.set(-sw * 0.5, 0, 0.1);
    j.shoulderR.rotation.set(sw * 0.5, 0, -0.1);
    j.body.position.y = -0.55 + (this.moving ? Math.abs(Math.cos(this.walkPhase)) * 0.05 : Math.sin(t * 2) * 0.01);
    j.head.rotation.y = this.moving ? 0 : this.lookYaw;
    j.torso.rotation.x = this.behavior === 'circle' ? 0.15 : 0;

    if (this.behavior === 'sit') {
      j.legL.rotation.x = -1.45;
      j.legR.rotation.x = -1.45;
      j.body.position.y = -0.55 - 0.18;
      j.shoulderL.rotation.set(-0.5, 0, 0.1);
      j.shoulderR.rotation.set(-0.5, 0, -0.1);
      j.torso.rotation.x = -0.1;
    }
    if (this.behavior === 'hammer' && !this.talking) {
      // ยกค้อนขึ้นช้าๆ แล้วฟาดลงเร็วๆ
      const h = this.hammerT;
      const up = h < 0.55 ? h / 0.55 : 1 - (h - 0.55) / 0.12;
      j.shoulderR.rotation.set(-0.6 - Math.max(0, up) * 2.0, 0, -0.1);
      j.torso.rotation.x = 0.15 + (h > 0.55 && h < 0.7 ? 0.1 : 0);
      j.shoulderL.rotation.set(-0.6, 0.3, 0.1);
    }
    if (this.o.prop === 'lute' && !this.moving) {
      j.shoulderR.rotation.set(-0.9 + Math.sin(t * 10) * 0.15, 0.4, -0.1);
      j.shoulderL.rotation.set(-1.0, -0.5, 0.1);
    }
    if (this.o.prop === 'spear') j.shoulderR.rotation.set(-0.3, 0, -0.1);
    if (this.o.prop === 'basket') j.shoulderL.rotation.set(-0.5, 0, 0.2);

    // โบกมือทักทาย
    if (this.wave > 0) {
      this.wave = Math.max(0, this.wave - dt * 0.7);
      j.shoulderL.rotation.set(-2.6, 0, 0.3 + Math.sin(t * 14) * 0.35);
    }
    if (this.talking) j.head.rotation.x = Math.sin(t * 6) * 0.05;
    this.root.rotation.y = this.facing;
  }

  dispose() {}
}

/** ของในมือ NPC */
function addProp(npc, kind) {
  const j = npc.j;
  if (kind === 'spear') {
    const s = group(at(cyl(0.03, 0.03, 2.4, 5, 0x6b4428), 0, 0.3, 0), at(cone(0.08, 0.3, 4, 0xdfe8f0), 0, 1.65, 0));
    at(s, 0, 0, 0.05);
    j.handR.add(s);
  } else if (kind === 'basket') {
    const b = group(at(cyl(0.2, 0.15, 0.2, 7, 0xc8a06a), 0, -0.1, 0), at(ico(0.07, 0, 0xe63946), 0.05, 0.02, 0), at(ico(0.07, 0, 0xffb703), -0.06, 0.02, 0.04));
    j.handL.add(b);
  } else if (kind === 'hammer') {
    const h = group(at(cyl(0.025, 0.025, 0.5, 5, 0x6b4428), 0, -0.15, 0.05), at(box(0.12, 0.12, 0.25, 0x3a3a40), 0, -0.4, 0.05, Math.PI / 2, 0, 0));
    h.rotation.x = -1.4;
    j.handR.add(h);
  } else if (kind === 'staff') {
    const s = group(at(cyl(0.03, 0.035, 1.8, 5, 0x5b3b27), 0, 0.2, 0), at(ico(0.1, 0, 0x9b5de5), 0, 1.15, 0));
    j.handR.add(s);
  } else if (kind === 'lute') {
    const l = group(at(ico(0.2, 0, 0xb07d4b), 0, 0, 0, 0, 0, 0, [1, 1.2, 0.4]), at(box(0.06, 0.5, 0.04, 0x5b3b27), 0, 0.35, 0));
    at(l, 0, 0.3, 0.3, 0.3, 0, 0.9);
    j.torso.add(l);
  } else if (kind === 'broom') {
    const b = group(at(cyl(0.025, 0.025, 1.4, 5, 0x8a5d36), 0, -0.2, 0), at(cone(0.15, 0.35, 6, 0xd9b45a), 0, -0.95, 0, Math.PI, 0, 0));
    at(b, 0, 0, 0.1, 0.3, 0, 0);
    j.handR.add(b);
  }
}

/** แมวเหมียว (NPC ตัวเล็ก) */
export class Cat {
  constructor(game, level, position, color = 0xf2a65a) {
    this.game = game;
    this.level = level;
    this.root = new THREE.Group();
    const body = group(
      at(box(0.28, 0.24, 0.5, color), 0, 0.28, 0),
      at(box(0.26, 0.24, 0.24, color), 0, 0.42, 0.3),
      at(cone(0.06, 0.12, 4, color), 0.08, 0.6, 0.3),
      at(cone(0.06, 0.12, 4, color), -0.08, 0.6, 0.3),
      at(box(0.04, 0.05, 0.02, 0x2b1d14), 0.06, 0.45, 0.425),
      at(box(0.04, 0.05, 0.02, 0x2b1d14), -0.06, 0.45, 0.425),
    );
    this.tail = at(box(0.06, 0.4, 0.06, color), 0, 0.45, -0.28, -0.4, 0, 0);
    this.legs = [];
    for (const [x, z] of [[0.09, 0.17], [-0.09, 0.17], [0.09, -0.17], [-0.09, -0.17]]) {
      const l = at(box(0.07, 0.18, 0.07, color), x, 0.09, z);
      this.legs.push(l);
      body.add(l);
    }
    body.add(this.tail);
    this.root.add(body);
    compactRig(this.root);
    level.root.add(this.root);
    this.position = this.root.position;
    this.position.copy(position);
    this.home = position.clone();
    this.radius = 0.25;
    this.mass = 0.5;
    this.facing = 0;
    this.target = null;
    this.wait = 1;
    this.time = 0;
    this.speed = 1.6;
    level.addInteractable({
      position: this.position,
      range: 1.6,
      prompt: 'ลูบแมว',
      promptHeight: 1.0,
      onInteract: () => {
        game.audio.play('meow');
        game.worldUI.attach('bubble', 'เมี๊ยว~ ♥', () => _v.set(this.position.x, 1.1, this.position.z), 2);
        game.fx.sparks.burst({ x: this.position.x, y: 0.8, z: this.position.z, count: 8, speed: 1, up: 2, color: 0xff7aa2, size: 0.09, life: 0.8, gravity: -1 });
        this.wait = 3;
        this.target = null;
      },
    });
  }

  update(dt) {
    if (dt <= 0) return;
    this.time += dt;
    let moving = false;
    if (this.wait > 0) this.wait -= dt;
    else if (!this.target) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 4;
      const x = this.home.x + Math.cos(a) * r;
      const z = this.home.z + Math.sin(a) * r;
      if (this.level.collision.isFree(x, z, 0.4)) this.target = new THREE.Vector3(x, 0, z);
    } else {
      const dx = this.target.x - this.position.x;
      const dz = this.target.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) {
        this.target = null;
        this.wait = 2 + Math.random() * 4;
      } else {
        this.position.x += (dx / d) * this.speed * dt;
        this.position.z += (dz / d) * this.speed * dt;
        this.facing = Math.atan2(dx, dz);
        moving = true;
      }
    }
    this.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(this.time * 14 + (i % 2) * Math.PI + (i > 1 ? 1 : 0)) * 0.6 : 0));
    this.tail.rotation.z = Math.sin(this.time * 3) * 0.4;
    this.root.rotation.y = this.facing;
  }

  dispose() {}
}
