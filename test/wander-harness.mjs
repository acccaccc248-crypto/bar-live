// Harness kiểm chứng đi dạo tự do (agent-dancers, CONFIG.dancers.wander).
// Chạy từ gốc repo (cần three thật để import js/dancers.js trong Node):
//   npm install --no-save three@0.160.0   (1 lần; node_modules KHÔNG commit)
//   node test/wander-harness.mjs
// Mô phỏng 60 giây, 12 dancer, dt = 1/60, kiểm chứng:
//   1. Dancer đi dạo luôn trong vùng sàn (trừ lề), không vào khu cấm
//      (bàn DJ / bục VIP / booth DJ).
//   2. Không 2 dancer đi dạo nào chồng nhau quá ngưỡng (minSeparation).
//   3. DJ đứng yên ở bàn, không rời bàn.
//   4. VIP đứng yên trên bục trong thời gian VIP, hết hạn thì đi bộ về
//      sàn và đi dạo tiếp.
//   5. Skill đóng băng di chuyển (đứng yên tại chỗ), hết skill thì đi
//      dạo tiếp.
//   6. Dancer thực sự đi dạo (dịch chuyển đủ xa), bộ động tác thường
//      vẫn đổi theo bar nhạc, không NaN.
// Dùng Math.random có seed để chạy nào cũng ra kết quả giống nhau.

import { DancerManager } from '../js/dancers.js';
import { CONFIG } from '../config.js';

// ---- Stub DOM tối thiểu (dancers.js vẽ mặt/avatar/tên bằng canvas) ----
function fakeCtx() {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    lineCap: '',
    lineJoin: '',
  };
  for (const m of [
    'fillRect', 'clearRect', 'beginPath', 'arc', 'stroke', 'fill',
    'save', 'restore', 'clip', 'drawImage', 'fillText', 'moveTo',
    'lineTo', 'quadraticCurveTo', 'closePath',
  ]) {
    ctx[m] = () => {};
  }
  return ctx;
}

globalThis.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: () => fakeCtx(), style: {} };
    }
    return { style: {} };
  },
};
globalThis.Image = class {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.crossOrigin = '';
  }

  set src(_v) { /* không tải mạng trong harness */ }
};

// ---- Random có seed (chạy nào cũng giống nhau) ----
let seed = 12345;
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(seed);

// ---- Harness ----
const failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

const fakeScene = { add() {}, remove() {} };
const manager = new DancerManager(fakeScene, {});
const users = Array.from({ length: 12 }, (_, i) => ({
  uniqueId: `u${i + 1}`,
  name: `User ${i + 1}`,
  avatar: null,
}));
const dancers = users.map((u) => manager.addOrGet(u));
check(dancers.every(Boolean), 'đủ 12 dancer lên sàn');

const w = CONFIG.dancers.wander;
const limits = manager._wanderLimits();
const spot = CONFIG.djTable.spotPosition;
const vipPos = CONFIG.stage.vipPosition;

manager.setDjDancer(dancers[0]);
manager.sendToVip(dancers[1], 0);

const dt = 1 / 60;
const bpm = CONFIG.music.bpm;
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const insideRect = (p, r, eps) => p.x > r.minX + eps && p.x < r.maxX - eps
  && p.z > r.minZ + eps && p.z < r.maxZ - eps;
const inBounds = (p) => p.x >= limits.minX - 0.02 && p.x <= limits.maxX + 0.02
  && p.z >= limits.minZ - 0.02 && p.z <= limits.maxZ + 0.02;

let skillState = 'waiting'; // waiting -> running -> done -> resumed
let skillPos = null;
let skillEndTime = 0;
let resumePos = null;
let resumeChecked = false;
const moveIndices = new Set();
const posAt10 = new Map();
const posAt25 = new Map();
const posAt55 = new Map();
let worstSeparation = Infinity;
let boundsViolations = 0;
let keepOutViolations = 0;

const TOTAL = 60;
const steps = Math.round(TOTAL / dt);
for (let step = 0; step <= steps; step += 1) {
  const time = step * dt;
  const beatPhase = ((time * bpm) / 60) % 1;

  if (step === Math.round(5 / dt)) {
    check(manager.enqueueSkill(dancers[2], 'rose', time), 'xếp skill rose được');
  }
  if (step === Math.round(10 / dt)) {
    manager.applyCommand(users[3], 'orbit', time);
  }

  manager.update(dt, time, beatPhase);

  // Theo dõi skill của dancers[2]: đóng băng rồi về lại đi dạo.
  const d2 = dancers[2];
  if (skillState === 'waiting' && d2.skillKind === 'rose') {
    skillState = 'running';
    skillPos = { x: d2.group.position.x, z: d2.group.position.z };
  } else if (skillState === 'running' && d2.skillKind) {
    check(
      dist2d(d2.group.position, skillPos) < 0.05,
      `skill đóng băng di chuyển (lệch ${dist2d(d2.group.position, skillPos).toFixed(3)}m lúc t=${time.toFixed(1)}s)`,
    );
  } else if (skillState === 'running' && !d2.skillKind) {
    skillState = 'done';
    skillEndTime = time;
    resumePos = { x: d2.group.position.x, z: d2.group.position.z };
  } else if (skillState === 'done' && !resumeChecked && time >= skillEndTime + 3) {
    resumeChecked = true;
    check(
      dist2d(d2.group.position, resumePos) > 0.1,
      `hết skill thì đi dạo tiếp (chỉ dịch ${dist2d(d2.group.position, resumePos).toFixed(3)}m sau 3s)`,
    );
    skillState = 'resumed';
  }

  if (step % 6 !== 0) continue; // lấy mẫu mỗi 0.1s

  for (const d of dancers) {
    const p = d.group.position;
    check(
      Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.y),
      `vị trí NaN lúc t=${time.toFixed(1)}s`,
    );
    check(Number.isFinite(d.wanderHeading), `heading NaN lúc t=${time.toFixed(1)}s`);
    if (d.mode === 'dance' && d.enterProgress >= 1) {
      if (!inBounds(p)) {
        boundsViolations += 1;
        check(false, `dancer ra khỏi vùng sàn tại (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) lúc t=${time.toFixed(1)}s`);
      }
      for (const r of limits.keepOuts) {
        if (insideRect(p, r, 0.02)) {
          keepOutViolations += 1;
          check(false, `dancer vào khu cấm tại (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) lúc t=${time.toFixed(1)}s`);
        }
      }
    }
  }

  // Khoảng cách tối thiểu giữa các dancer đi dạo.
  const roamers = dancers.filter((d) => d.mode === 'dance' && d.enterProgress >= 1);
  for (let i = 0; i < roamers.length; i += 1) {
    for (let j = i + 1; j < roamers.length; j += 1) {
      const dd = dist2d(roamers[i].group.position, roamers[j].group.position);
      if (dd < worstSeparation) worstSeparation = dd;
    }
  }

  // DJ đứng yên ở bàn.
  if (time > 5) {
    const dj = dancers[0];
    check(dj.mode === 'dj', `DJ giữ mode dj lúc t=${time.toFixed(1)}s (đang ${dj.mode})`);
    check(
      Math.hypot(dj.group.position.x - spot[0], dj.group.position.z - spot[2]) < 0.15,
      `DJ không rời bàn (lệch ${Math.hypot(dj.group.position.x - spot[0], dj.group.position.z - spot[2]).toFixed(3)}m lúc t=${time.toFixed(1)}s)`,
    );
  }

  // VIP đứng yên trên bục trong thời gian VIP.
  if (time > 2 && time < 19) {
    const vip = dancers[1];
    check(vip.mode === 'vip', `VIP giữ mode vip lúc t=${time.toFixed(1)}s (đang ${vip.mode})`);
    check(
      Math.abs(vip.group.position.x - vipPos[0]) < 0.01
      && Math.abs(vip.group.position.z - vipPos[2]) < 0.01,
      `VIP đứng yên trên bục lúc t=${time.toFixed(1)}s`,
    );
  }

  moveIndices.add(dancers[4].moveIndex);
  if (Math.abs(time - 10) < dt / 2) {
    for (const d of dancers) posAt10.set(d, { x: d.group.position.x, z: d.group.position.z });
  }
  if (Math.abs(time - 25) < dt / 2) {
    for (const d of dancers) posAt25.set(d, { x: d.group.position.x, z: d.group.position.z });
  }
  if (Math.abs(time - 55) < dt / 2) {
    for (const d of dancers) posAt55.set(d, { x: d.group.position.x, z: d.group.position.z });
  }
}

// Sau VIP (20s): dancer[1] phải về trong vùng sàn và đi dạo tiếp.
check(dancers[1].mode === 'dance', 'hết VIP thì về mode dance');
check(
  inBounds(dancers[1].group.position),
  `hết VIP thì về trong vùng sàn (đang ở ${dancers[1].group.position.x.toFixed(2)}, ${dancers[1].group.position.z.toFixed(2)})`,
);
check(
  dist2d(dancers[1].group.position, posAt25.get(dancers[1])) > 0.15,
  'hết VIP thì đi dạo tiếp (25s -> 55s)',
);

// Orbit xong thì về dance và đi dạo tiếp.
check(dancers[3].mode === 'dance', 'hết đi vòng thì về mode dance');
check(
  dist2d(dancers[3].group.position, posAt25.get(dancers[3])) > 0.2,
  'hết đi vòng thì đi dạo tiếp (25s -> 55s)',
);

// Dancer thực sự đi dạo: đủ số người dịch chuyển xa sau 45s.
let movedFar = 0;
for (const d of dancers.slice(1)) {
  if (dist2d(d.group.position, posAt10.get(d)) > 1.0) movedFar += 1;
}
check(movedFar >= 8, `đủ dancer đi dạo xa (chỉ ${movedFar}/11 người dịch > 1m từ t=10s tới t=55s)`);

// Bộ động tác thường vẫn đổi theo bar nhạc.
check(moveIndices.size >= 2, `bộ động tác vẫn đổi (chỉ thấy moveIndex ${[...moveIndices]})`);

// Khoảng cách tối thiểu + số vi phạm vùng.
check(
  worstSeparation >= w.minSeparation - 0.06,
  `khoảng cách tối thiểu giữa 2 dancer: ${worstSeparation.toFixed(3)}m (ngưỡng ${w.minSeparation})`,
);
check(boundsViolations === 0, `${boundsViolations} lần ra khỏi vùng sàn`);
check(keepOutViolations === 0, `${keepOutViolations} lần vào khu cấm`);
check(skillState === 'resumed', `skill chạy trọn rồi về đi dạo (trạng thái cuối: ${skillState})`);
check(
  dancers.every((d) => d.wanderSpeed > 0),
  'mọi dancer đều có tốc độ đi dạo > 0',
);

// ---- Pha 7: đi vòng quanh lồng (CONFIG.dancers.wander.cageOrbit,
// user lệnh 09:12 03/11: chậm, lâu lâu mới đi) ----
// Ép lịch đi dày lên trong harness (2–4s thay vì 40–90s) để chuyến đi
// chắc chắn xảy ra trong 90s mô phỏng; tốc độ/cung/bán kính giữ nguyên
// như config thật. Manager mới, không dính DJ/VIP của pha 1.
const orbitCfg = CONFIG.dancers.wander.cageOrbit;
orbitCfg.nextDelayMin = 2;
orbitCfg.nextDelayMax = 4;
orbitCfg.arcMin = 1.0;
orbitCfg.arcMax = 1.5;
const manager2 = new DancerManager(fakeScene, {});
const users2 = Array.from({ length: 12 }, (_, i) => ({
  uniqueId: `v${i + 1}`,
  name: `Viewer ${i + 1}`,
  avatar: null,
}));
const dancers2 = users2.map((u) => manager2.addOrGet(u));
check(dancers2.every(Boolean), 'pha lồng: đủ 12 dancer lên sàn');
const cageCfg = CONFIG.scene.cage;
const discR = cageCfg.radius + w.cageKeepOutMargin;
let orbitsStarted = 0;
let orbitsFinished = 0;
let maxOrbiters = 0;
let orbitBoundsViolations = 0;
let orbitDiscViolations = 0;
let orbitDistMin = Infinity;
let orbitDistMax = 0;
const wasOrbiting = new Set();
const TOTAL2 = 90;
const steps2 = Math.round(TOTAL2 / dt);
for (let step = 0; step <= steps2; step += 1) {
  const time = step * dt;
  const beatPhase = ((time * bpm) / 60) % 1;
  manager2.update(dt, time, beatPhase);
  if (step % 6 !== 0) continue; // lấy mẫu mỗi 0.1s
  let orbiters = 0;
  for (const d of dancers2) {
    const p = d.group.position;
    check(
      Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.y),
      `pha lồng: vị trí NaN lúc t=${time.toFixed(1)}s`,
    );
    if (d.cageOrbit) {
      orbiters += 1;
      if (!wasOrbiting.has(d)) {
        wasOrbiting.add(d);
        orbitsStarted += 1;
      }
      const distCage = Math.hypot(p.x - cageCfg.centerX, p.z - cageCfg.centerZ);
      if (distCage < orbitDistMin) orbitDistMin = distCage;
      if (distCage > orbitDistMax) orbitDistMax = distCage;
    } else if (wasOrbiting.has(d)) {
      wasOrbiting.delete(d);
      orbitsFinished += 1;
    }
    if (d.mode === 'dance' && d.enterProgress >= 1) {
      if (!inBounds(p)) {
        orbitBoundsViolations += 1;
        check(false, `pha lồng: dancer ra khỏi vùng sàn tại (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) lúc t=${time.toFixed(1)}s`);
      }
      const distCage = Math.hypot(p.x - cageCfg.centerX, p.z - cageCfg.centerZ);
      if (distCage < discR - 0.05) {
        orbitDiscViolations += 1;
        check(false, `pha lồng: dancer lọt đĩa cấm lồng (cách tâm ${distCage.toFixed(2)}m < ${discR}m) lúc t=${time.toFixed(1)}s`);
      }
    }
  }
  if (orbiters > maxOrbiters) maxOrbiters = orbiters;
}
check(orbitsStarted >= 3, `pha lồng: đủ chuyến đi vòng xảy ra (chỉ ${orbitsStarted})`);
check(orbitsFinished >= 1, `pha lồng: có chuyến đi vòng chạy trọn (chỉ ${orbitsFinished} chuyến xong)`);
check(
  maxOrbiters <= orbitCfg.maxConcurrent,
  `pha lồng: cùng lúc tối đa ${maxOrbiters} người đi vòng (trần ${orbitCfg.maxConcurrent})`,
);
check(orbitBoundsViolations === 0, `pha lồng: ${orbitBoundsViolations} lần ra khỏi vùng sàn`);
check(orbitDiscViolations === 0, `pha lồng: ${orbitDiscViolations} lần lọt đĩa cấm lồng`);
check(
  orbitDistMin >= discR - 0.05 && orbitDistMax <= 3.1,
  `pha lồng: khoảng cách tới tâm lồng lúc đi vòng ${orbitDistMin.toFixed(2)}–${orbitDistMax.toFixed(2)}m (đĩa cấm ${discR}m, trần 3.1m)`,
);

console.log(`wander-harness: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${failures.length} lỗi)`);
console.log(`  đi vòng quanh lồng: ${orbitsStarted} chuyến bắt đầu, ${orbitsFinished} chuyến xong, cùng lúc tối đa ${maxOrbiters} người, cách tâm lồng ${orbitDistMin.toFixed(2)}–${orbitDistMax.toFixed(2)}m`);
console.log(`  khoảng cách nhỏ nhất giữa 2 dancer: ${worstSeparation.toFixed(3)}m (ngưỡng ${w.minSeparation})`);
console.log(`  số dancer dịch > 1m (t=10s -> t=55s): ${movedFar}/11`);
console.log(`  moveIndex đã thấy: ${[...moveIndices].join(', ')}`);
console.log(`  vùng đi dạo: x [${limits.minX.toFixed(2)}, ${limits.maxX.toFixed(2)}], z [${limits.minZ.toFixed(2)}, ${limits.maxZ.toFixed(2)}]`);
for (const f of failures.slice(0, 10)) console.log(`  FAIL: ${f}`);
process.exitCode = failures.length === 0 ? 0 : 1;
