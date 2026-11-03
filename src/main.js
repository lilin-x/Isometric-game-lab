// =============================================================
//  main.js — จุดเริ่มต้นของโปรแกรม (entry point)
//  index.html โหลดไฟล์นี้ → สร้าง Game → เริ่ม loop
// =============================================================

import { Game } from './core/Game.js';

// อ่านค่าจาก URL สำหรับทดสอบ เช่น  ?level=forest&skip&debug
//   level=forest  เริ่มที่ด่านป่า
//   skip          ข้ามหน้า title
//   debug         เปิดหน้าต่าง debug (กด F3 ก็ได้)
//   nobloom / noshadow  ปิดเอฟเฟกต์ (ถ้าเครื่องช้า)
const params = new URLSearchParams(location.search);

const game = new Game({ canvas: document.getElementById('game'), params });
game.start();

// เปิดให้เข้าถึงจาก Console ของเบราว์เซอร์ (F12) เพื่อทดลอง เช่น
//   game.level.player.stamina.value = 5
//   game.goTo('forest')
window.game = game;
