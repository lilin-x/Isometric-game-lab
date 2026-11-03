// =============================================================
//  HUD.js — แถบสถานะบนจอ (เลือด, stamina, เป้าหมาย, ป้ายชื่อด่าน)
// -------------------------------------------------------------
//  เทคนิค "ghost bar": แถบสีขาวด้านหลังที่ค่อยๆ ไล่ตามแถบจริง
//  ทำให้ผู้เล่นเห็นชัดว่า "เพิ่งเสียไปเท่าไร" (เกมต่อสู้เกือบทุกเกมใช้)
// =============================================================

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.hp = makeBar(document.getElementById('bar-hp'));
    this.st = makeBar(document.getElementById('bar-stamina'));
    this.stRoot = document.getElementById('bar-stamina');
    this.hpRoot = document.getElementById('bar-hp');
    this.exhaustText = this.stRoot.querySelector('.exhaust-text b');
    this.exhaustProgress = this.stRoot.querySelector('.exhaust .progress');
    this.objective = document.getElementById('objective');
    this.bannerEl = document.getElementById('level-banner');
    this.toastEl = document.getElementById('toast');
    this._bannerTimer = 0;
    this._toastTimer = 0;
    this._lastHp = null;
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  /** อัปเดตทุกเฟรมจากข้อมูลผู้เล่น */
  update(player, dt) {
    const hp = player.health;
    const st = player.stamina;

    // --- เลือด ---
    this.hp.set(hp.ratio, dt);
    this.hp.value.textContent = `${Math.ceil(hp.value)} / ${hp.max}`;
    if (this._lastHp !== null && hp.value < this._lastHp) restartAnim(this.hpRoot, 'hurt');
    this._lastHp = hp.value;

    // --- stamina ---
    this.st.set(st.ratio, dt);
    this.st.value.textContent = Math.floor(st.value);
    this.stRoot.classList.toggle('exhausted', st.exhausted);
    this.stRoot.classList.toggle('regen-wait', st.isWaitingToRegen);
    if (st.exhausted) {
      this.exhaustText.textContent = st.exhaustTimer.toFixed(1);
      this.exhaustProgress.style.strokeDashoffset = String(88 * (1 - st.exhaustProgress));
    }

    // --- ตัวจับเวลาข้อความชั่วคราว ---
    if (this._bannerTimer > 0) {
      this._bannerTimer -= dt;
      if (this._bannerTimer <= 0) this.bannerEl.classList.remove('show');
    }
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }

  staminaDenied() {
    restartAnim(this.stRoot, 'denied');
  }

  staminaRecovered() {
    restartAnim(this.stRoot, 'recovered');
  }

  setObjective(html) {
    this.objective.innerHTML = html;
  }

  banner(title, sub, seconds = 3) {
    this.bannerEl.querySelector('.title').textContent = title;
    this.bannerEl.querySelector('.sub').textContent = sub;
    this.bannerEl.classList.add('show');
    this._bannerTimer = seconds;
  }

  toast(text, seconds = 2.5) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this._toastTimer = seconds;
  }

  resetBars(player) {
    this.hp.snap(player.health.ratio);
    this.st.snap(player.stamina.ratio);
    this._lastHp = player.health.value;
  }
}

function makeBar(el) {
  const fill = el.querySelector('.fill');
  const ghost = el.querySelector('.ghost');
  const value = el.querySelector('.value');
  let ghostRatio = 1;
  let ghostDelay = 0;
  let last = 1;
  return {
    value,
    set(ratio, dt) {
      fill.style.transform = `scaleX(${ratio})`;
      if (ratio < last) ghostDelay = 0.45; // รอสักแป๊บก่อนไล่ตาม
      last = ratio;
      if (ratio > ghostRatio) ghostRatio = ratio;
      else if (ghostDelay > 0) ghostDelay -= dt;
      else ghostRatio = Math.max(ratio, ghostRatio - dt * 0.8);
      ghost.style.transform = `scaleX(${ghostRatio})`;
    },
    snap(ratio) {
      last = ghostRatio = ratio;
      fill.style.transform = ghost.style.transform = `scaleX(${ratio})`;
    },
  };
}

/** เล่น CSS animation ซ้ำได้ (ต้องถอด class แล้วบังคับ reflow ก่อนใส่ใหม่) */
function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
