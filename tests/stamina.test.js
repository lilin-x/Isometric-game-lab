// รันด้วยคำสั่ง:  npm test
// ใช้ test runner ที่มากับ Node.js (node:test) ไม่ต้องติดตั้งอะไรเพิ่ม
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Stamina } from '../src/core/Stamina.js';

const CFG = { max: 100, regenDelay: 1, regenRate: 25, exhaustedDuration: 4, recoverTo: 50 };

/** จำลองเวลาผ่านไป seconds วินาที (แบ่งเป็นเฟรมละ 1/60) */
function tick(st, seconds) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds - 1e-9; t += dt) st.update(dt);
}

test('ใช้แรงแล้วหลอดลดลง', () => {
  const st = new Stamina(CFG);
  assert.equal(st.spend(12), true);
  assert.equal(st.value, 88);
});

test('ยังไม่ครบ regenDelay จะยังไม่ฟื้น', () => {
  const st = new Stamina(CFG);
  st.spend(40);
  tick(st, 0.9);
  assert.equal(st.value, 60);
});

test('ครบ regenDelay แล้วค่อยๆ ฟื้น', () => {
  const st = new Stamina(CFG);
  st.spend(40);
  tick(st, 2); // รอ 1 วิ + ฟื้น 1 วิ = +25
  assert.ok(Math.abs(st.value - 85) < 1, `ได้ ${st.value}`);
});

test('ฟื้นไม่เกิน max', () => {
  const st = new Stamina(CFG);
  st.spend(10);
  tick(st, 10);
  assert.equal(st.value, 100);
});

test('แรงไม่พอก็ยังทำท่าได้ แต่หลอดหยุดที่ 0 และติดหมดแรง', () => {
  const st = new Stamina(CFG);
  st.value = 5;
  assert.equal(st.spend(12), true);
  assert.equal(st.value, 0);
  assert.equal(st.exhausted, true);
  assert.equal(st.canAct(), false);
});

test('หมดแรงแล้วทำท่าไม่ได้ และไม่ฟื้นระหว่าง cooldown', () => {
  const st = new Stamina(CFG);
  st.spend(100);
  assert.equal(st.spend(12), false);
  tick(st, 3.5);
  assert.equal(st.value, 0);
  assert.equal(st.exhausted, true);
});

test('พ้น cooldown แล้วได้ stamina คืนครึ่งหลอด', () => {
  const st = new Stamina(CFG);
  let recovered = false;
  st.events.on('recovered', () => (recovered = true));
  st.spend(100);
  tick(st, 4.05);
  assert.equal(st.exhausted, false);
  assert.equal(st.value, 50);
  assert.equal(recovered, true);
});

test('holdRegen (ระหว่างชาร์จ) จะหยุดการฟื้น', () => {
  const st = new Stamina(CFG);
  st.spend(50);
  st.holdRegen = true;
  tick(st, 3);
  assert.equal(st.value, 50);
});
