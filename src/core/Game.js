// =============================================================
//  Game.js — "หัวใจ" ของเกม: Game Loop + ตัวจัดการฉาก
// -------------------------------------------------------------
//  เกมทุกเกมคือ loop ที่วนแบบนี้ ~60 ครั้งต่อวินาที:
//
//     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
//     │ 1. อ่าน input │ → │ 2. update    │ → │ 3. render    │ ─┐
//     └──────────────┘   │ (ขยับทุกอย่าง │   │ (วาดภาพ)     │  │
//            ▲           │  ตามเวลา dt)  │   └──────────────┘  │
//            └───────────┴──────────────┴─────────────────────┘
//
//  dt (delta time) = เวลาที่ผ่านไปจากเฟรมก่อน (วินาที)
//  ทุกการเคลื่อนที่ต้องคูณ dt เสมอ เช่น  x += speed * dt
//  → เครื่องเร็ว (144fps) หรือช้า (30fps) ตัวละครก็เดินเร็วเท่ากัน
// =============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG } from '../config.js';
import { Input } from './Input.js';
import { IsoCamera } from './IsoCamera.js';
import { Audio } from './Audio.js';
import { Particles } from '../fx/Particles.js';
import { GroundFX } from '../fx/GroundFX.js';
import { HUD } from '../ui/HUD.js';
import { WorldUI } from '../ui/WorldUI.js';
import { Dialogue } from '../ui/Dialogue.js';
import { TownLevel } from '../levels/TownLevel.js';
import { ForestLevel } from '../levels/ForestLevel.js';

const LEVELS = { town: TownLevel, forest: ForestLevel };

export class Game {
  constructor({ canvas, params }) {
    this.params = params;
    this.canvas = canvas;

    // ---------- Renderer: ตัววาดภาพด้วย WebGL ----------
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.graphics.pixelRatioMax));
    this.renderer.shadowMap.enabled = CONFIG.graphics.shadows && !params.has('noshadow');
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // คงสีสดของ low poly ไว้
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.info.autoReset = false;

    // ---------- Scene: "โลก" ที่บรรจุทุกอย่าง ----------
    this.scene = new THREE.Scene();
    this.iso = new IsoCamera(innerWidth / innerHeight);

    // ---------- Post-processing: แต่งภาพหลังวาดเสร็จ (bloom = แสงฟุ้ง) ----------
    this.useBloom = CONFIG.graphics.bloom && !params.has('nobloom');
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.iso.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.45, 0.92);
    this.bloom.enabled = this.useBloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass()); // แปลงสี + tone mapping (ต้องอยู่ท้ายสุด)

    // ---------- ระบบย่อย ----------
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.hud = new HUD();
    this.worldUI = new WorldUI(document.getElementById('world-ui'), this.iso);
    this.dialogue = new Dialogue(this.audio);

    // เอฟเฟกต์อยู่ใน scene ตลอด (ไม่ผูกกับด่าน)
    this.fxRoot = new THREE.Group();
    this.scene.add(this.fxRoot);
    this.fx = {
      sparks: new Particles(this.fxRoot, { max: 400, additive: true }),
      debris: new Particles(this.fxRoot, { max: 500, lit: true, geometry: new THREE.TetrahedronGeometry(0.5, 0) }),
      ground: new GroundFX(this.fxRoot),
    };

    // ---------- สถานะของเกม ----------
    this.state = 'title'; // title | play | pause | dead | win
    this.level = null;
    this.levelName = null;
    this.hitStopTimer = 0;
    this.timeScale = 1;
    this.elapsed = 0;
    this.transitioning = false;
    this.debugVisible = params.has('debug');
    this.stats = newStats();
    this._fps = { frames: 0, time: 0, value: 0 };

    this.timer = new THREE.Timer(); // (THREE.Clock เลิกใช้แล้วตั้งแต่ r183)
    this.timer.connect(document); // หยุดนับเวลาตอนสลับแท็บ

    document.getElementById('debug').classList.toggle('hidden', !this.debugVisible);
    this._bindUI();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ---------- เริ่มเกม ----------
  start() {
    const startLevel = LEVELS[this.params.get('level')] ? this.params.get('level') : 'town';
    this.loadLevel(startLevel);
    if (this.params.has('skip')) this.beginPlay();
    else this.level.titleMode = true;
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  beginPlay() {
    this.audio.unlock();
    document.getElementById('screen-title').classList.add('hidden');
    this.hud.show();
    this.state = 'play';
    this.level.titleMode = false;
    this.level.onEnter?.();
  }

  // ---------- Game loop: เรียกทุกเฟรมโดยเบราว์เซอร์ ----------
  frame(timestamp) {
    this.timer.update(timestamp);
    // จำกัด dt ไม่เกิน 1/20 วิ กันตัวละครวาร์ปเวลาเครื่องค้าง
    const realDt = Math.min(this.timer.getDelta(), 1 / 20);
    this._handleGlobalKeys();

    // Hit-stop: หยุดโลกชั่วขณะตอนฟันโดน ให้รู้สึก "หนัก"
    let dt = realDt * this.timeScale;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= realDt;
      dt = 0;
    }

    if (this.state === 'play' || this.state === 'title') {
      this.elapsed += dt;
      if (this.state === 'play') this.stats.time += dt;
      // ถ้าบทสนทนาเปิดอยู่ตอนต้นเฟรม ปุ่มที่กดในเฟรมนี้เป็นของบทสนทนา
      // (กันกด E ปิดแล้วไปเปิดบทสนทนาใหม่ทันทีในเฟรมเดียวกัน)
      const dialogueWasOpen = this.dialogue.isOpen;
      if (dialogueWasOpen) this.dialogue.update(realDt, this.input);
      this.level.inputConsumed = dialogueWasOpen;
      this.level.update(dt);
      this.fx.sparks.update(dt);
      this.fx.debris.update(dt);
      this.fx.ground.update(dt);
    }

    // กล้องตามผู้เล่น (หน้า title ให้เลื่อนช้าๆ โชว์ฉาก)
    if (this.level) {
      if (this.state === 'title') {
        const t = this.elapsed * 0.12;
        this.iso.follow(_tmp.set(Math.sin(t) * 6, 0, Math.cos(t * 0.8) * 5), realDt * 0.3);
      } else if (this.level.player) {
        this.iso.follow(this.level.player.cameraTarget, realDt);
      }
    }
    this.iso.update(realDt);

    if (this.level?.player) this.hud.update(this.level.player, realDt);
    this.worldUI.update(this.state === 'play' ? realDt : 0);

    this.render();
    this._updateDebug(realDt);
    this.input.endFrame();
  }

  render() {
    this.renderer.info.reset();
    if (this.useBloom) this.composer.render();
    else this.renderer.render(this.scene, this.iso.camera);
  }

  // ---------- ปุ่มที่ใช้ได้ทุกสถานะ ----------
  _handleGlobalKeys() {
    const input = this.input;
    if (input.wasPressed('mute')) {
      const muted = this.audio.toggleMute();
      this.hud.toast(muted ? '🔇 ปิดเสียง' : '🔊 เปิดเสียง', 1.2);
    }
    if (input.wasPressed('debug')) {
      this.debugVisible = !this.debugVisible;
      document.getElementById('debug').classList.toggle('hidden', !this.debugVisible);
    }
    if (input.wasPressed('pause') && !this.dialogue.isOpen) {
      if (this.state === 'play') this.setPaused(true);
      else if (this.state === 'pause') this.setPaused(false);
    }
    if (this.state === 'title' && (input.wasPressed('interact') || input.pressed.has('Space'))) this.beginPlay();
  }

  setPaused(p) {
    this.state = p ? 'pause' : 'play';
    document.getElementById('screen-pause').classList.toggle('hidden', !p);
    this.input.reset();
    if (p) this.audio.stopCharge();
  }

  // ---------- จัดการด่าน ----------
  loadLevel(name) {
    if (this.level) this.level.dispose();
    this.worldUI.clear();
    this.fx.sparks.clear();
    this.fx.debris.clear();
    this.fx.ground.clear();
    this.dialogue.isOpen && this.dialogue.close();
    this.levelName = name;
    this.iso.bounds = null;
    this.level = new LEVELS[name](this);
    this.level.build();
    this.scene.add(this.level.root);
    if (this.level.player) {
      this.iso.snapTo(this.level.player.cameraTarget);
      this.hud.resetBars(this.level.player);
    }
    this.hitStopTimer = 0;
    this.input.reset();
  }

  /** เปลี่ยนด่านแบบมีจอดำค่อยๆ มืด-สว่าง */
  goTo(name) {
    if (this.transitioning) return;
    this.transitioning = true;
    const fade = document.getElementById('fade');
    fade.classList.add('on');
    this.audio.stopCharge();
    setTimeout(() => {
      for (const id of ['screen-pause', 'screen-dead', 'screen-win']) document.getElementById(id).classList.add('hidden');
      if (name === 'forest') this.stats = newStats();
      this.loadLevel(name);
      this.state = 'play';
      this.level.onEnter?.();
      fade.classList.remove('on');
      this.transitioning = false;
    }, 480);
  }

  // ---------- บริการที่ส่วนอื่นเรียกใช้ ----------
  hitStop(seconds) {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
  }

  shake(amount) {
    this.iso.shake(amount);
  }

  onPlayerDied() {
    setTimeout(() => {
      this.state = 'dead';
      document.getElementById('screen-dead').classList.remove('hidden');
    }, 1400);
  }

  onWin() {
    this.state = 'win';
    this.audio.play('win');
    const s = this.stats;
    const mm = Math.floor(s.time / 60);
    const ss = Math.floor(s.time % 60).toString().padStart(2, '0');
    document.getElementById('win-stats').innerHTML = `
      <div><b>${mm}:${ss}</b>เวลา</div>
      <div><b>${s.kills}</b>มอนสเตอร์</div>
      <div><b>${s.damage}</b>damage รวม</div>
      <div><b>${s.dodges}</b>ครั้งที่หลบ</div>
      <div><b>${s.heavyHits}</b>ฟันชาร์จโดน</div>
      <div><b>${s.exhausted}</b>ครั้งที่หมดแรง</div>`;
    document.getElementById('screen-win').classList.remove('hidden');
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.iso.resize(w / h);
  }

  _bindUI() {
    document.getElementById('btn-start').addEventListener('click', () => this.beginPlay());
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.play('ui');
        const a = btn.dataset.action;
        if (a === 'resume') this.setPaused(false);
        if (a === 'restart-level') this.goTo(this.levelName);
        if (a === 'goto-town') this.goTo('town');
        if (a === 'goto-forest') this.goTo('forest');
      });
    });
  }

  _updateDebug(dt) {
    const f = this._fps;
    f.frames++;
    f.time += dt;
    if (f.time >= 0.5) {
      f.value = Math.round(f.frames / f.time);
      f.frames = 0;
      f.time = 0;
    }
    if (!this.debugVisible) return;
    const p = this.level?.player;
    const info = this.renderer.info;
    document.getElementById('debug').textContent = [
      `FPS          ${f.value}`,
      `draw calls   ${info.render.calls}`,
      `triangles    ${info.render.triangles.toLocaleString()}`,
      `level        ${this.levelName}`,
      p ? `player state ${p.fsm.name}` : '',
      p ? `stamina      ${p.stamina.value.toFixed(1)}${p.stamina.exhausted ? ' (EXHAUSTED)' : ''}` : '',
      p ? `pos          ${p.position.x.toFixed(1)}, ${p.position.z.toFixed(1)}` : '',
      `enemies      ${this.level?.enemies.filter((e) => e.alive).length ?? 0}`,
    ].filter(Boolean).join('\n');
  }
}

function newStats() {
  return { time: 0, kills: 0, damage: 0, dodges: 0, heavyHits: 0, exhausted: 0 };
}

const _tmp = new THREE.Vector3();
