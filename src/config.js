// =============================================================
//  config.js — "ห้องปรับจูน" ของเกม
// -------------------------------------------------------------
//  ตัวเลขทุกอย่างที่มีผลต่อความรู้สึกตอนเล่น (game feel / balance)
//  รวมไว้ที่ไฟล์เดียว เพื่อให้ทดลองปรับได้ง่ายโดยไม่ต้องไล่หาในโค้ด
//  ลองแก้ค่าแล้ว refresh หน้าเว็บ จะเห็นผลทันที
//
//  หน่วยที่ใช้:  ระยะทาง = เมตร (1 หน่วย three.js ≈ 1 เมตร)
//               เวลา = วินาที,  ความเร็ว = เมตร/วินาที
// =============================================================

export const CONFIG = {
  // ---------- กล้อง ----------
  camera: {
    viewSize: 14, // ความสูงของภาพ (หน่วยโลก) ยิ่งมาก = ซูมออก
    distance: 40, // ระยะกล้องจากจุดที่มอง (orthographic จึงไม่มีผลกับขนาดภาพ)
    followSharpness: 6, // กล้องตามตัวละครเร็วแค่ไหน (ยิ่งมากยิ่งติด)
  },

  // ---------- ตัวละครหลัก ----------
  player: {
    maxHp: 100,
    moveSpeed: 5.2,
    radius: 0.42, // รัศมีวงกลมชน (collision)
    turnSharpness: 14, // หันตัวเร็วแค่ไหน
    hurtStun: 0.32, // โดนตีแล้วชะงักกี่วินาที
    hurtInvulnerable: 0.75, // อมตะชั่วคราวหลังโดนตี (กันโดนรุมซ้ำ)
    exhaustedSpeedMul: 0.5, // ตอนหมดแรง เดินช้าลงเหลือกี่เท่า
    chargeSpeedMul: 0.35, // ตอนชาร์จ เดินช้าลงเหลือกี่เท่า
    inputBuffer: 0.22, // จำปุ่มที่กดล่วงหน้าไว้กี่วินาที (input buffering)
  },

  // ---------- Stamina ----------
  stamina: {
    max: 100,
    regenDelay: 1.0, // หยุดใช้แรงกี่วินาที ถึงเริ่มฟื้น
    regenRate: 25, // ฟื้นวินาทีละเท่าไร
    exhaustedDuration: 4.0, // หมดหลอดแล้วติด cooldown กี่วินาที
    recoverTo: 50, // พ้น cooldown แล้วได้ stamina คืนเท่าไร (ครึ่งหลอด)
  },

  // ---------- ฟันเบา (คอมโบ 3 จังหวะ) ----------
  lightAttack: {
    cost: 12,
    damage: [8, 10], // สุ่มระหว่าง min..max
    finisherDamage: [12, 14], // จังหวะที่ 3 แรงกว่านิดหน่อย
    duration: 0.34, // ความยาวท่าทั้งหมด
    hitTime: 0.11, // วินาทีที่ดาบ "โดน" จริง (active frame)
    range: 1.75,
    arcDeg: 120, // มุมกวาดของดาบ (องศา)
    knockback: 3.0,
    hitStop: 0.045, // หยุดภาพชั่วขณะเมื่อฟันโดน (hit-stop)
    comboWindow: 0.5, // ต้องกดต่อภายในกี่วินาทีถึงจะต่อคอมโบ
  },

  // ---------- ฟันแรง (กดค้างเพื่อชาร์จ) ----------
  heavyAttack: {
    minCost: 20,
    maxCost: 40,
    minDamage: 25,
    maxDamage: 60,
    chargeTime: 1.2, // ชาร์จเต็มใช้กี่วินาที
    duration: 0.5,
    hitTime: 0.16,
    minRange: 2.0,
    maxRange: 2.9,
    knockback: 9,
    hitStop: 0.12,
    shake: 0.35,
  },

  // ---------- หลบ (Dodge roll) ----------
  dodge: {
    cost: 20,
    duration: 0.42,
    speed: 11,
    iFrameStart: 0.03, // ช่วงอมตะ (invincibility frames)
    iFrameEnd: 0.32,
  },

  // ---------- มอนสเตอร์ ----------
  enemies: {
    slime: {
      maxHp: 30,
      speed: 2.0,
      radius: 0.5,
      damage: 8,
      aggroRange: 8,
      attackRange: 3.2,
      windup: 0.5,
      lungeTime: 0.42,
      recover: 0.7,
      mass: 1,
    },
    mushroom: {
      maxHp: 45,
      speed: 2.4,
      radius: 0.55,
      damage: 11,
      aggroRange: 9,
      attackRange: 1.9,
      burstRadius: 2.5,
      windup: 0.75,
      recover: 0.9,
      mass: 1.4,
    },
    golem: {
      maxHp: 140,
      speed: 1.6,
      radius: 0.95,
      damage: 22,
      aggroRange: 10,
      attackRange: 2.6,
      slamRadius: 2.1,
      slamOffset: 1.7,
      windup: 1.05,
      recover: 1.3,
      mass: 4,
      superArmor: true, // ฟันเบาไม่ทำให้ชะงัก ต้องใช้ฟันชาร์จ
    },
  },

  pickups: { healAmount: 40 },

  graphics: {
    bloom: true,
    shadows: true,
    pixelRatioMax: 2,
  },
};
