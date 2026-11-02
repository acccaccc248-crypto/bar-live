// dancers.js — dancer chibi meme + avatar + tên, vào/ra sàn,
// nhảy theo nhịp, lệnh chat, hiệu ứng gift, skill nhảy theo gift.
// Mọi ngưỡng đọc từ config.js. Nhân vật: đầu to, tóc bát úp đen,
// mặt trắng vẽ nét đen bằng canvas texture (không asset ngoài).

import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Hình học dùng chung cho mọi dancer (rẻ, không tạo lại mỗi người).
const GEO = {
  head: null,
  hair: null,
  body: null,
  shorts: null,
  arm: null,
  sleeve: null,
  leg: null,
  crownBand: null,
  crownSpike: null,
  crownJewel: null,
};

function sharedGeometries() {
  if (GEO.head) return GEO;
  const d = CONFIG.dancers;
  const c = d.chibi;
  GEO.head = new THREE.SphereGeometry(d.headRadius, 24, 18);
  // Tóc bát úp: nắp cầu phủ nửa trên đầu (theta từ đỉnh xuống ~66°).
  GEO.hair = new THREE.SphereGeometry(c.hairRadius, 24, 12, 0, Math.PI * 2, 0, c.hairThetaLength);
  GEO.body = new THREE.CylinderGeometry(d.bodyRadius, d.bodyRadius * 1.1, d.bodyHeight, 10);
  GEO.shorts = new THREE.CylinderGeometry(d.bodyRadius, d.bodyRadius * 1.08, 0.3, 10);
  GEO.arm = new THREE.CylinderGeometry(d.armRadius, d.armRadius * 0.9, d.armLength, 8);
  GEO.sleeve = new THREE.CylinderGeometry(d.armRadius * 1.35, d.armRadius * 1.35, 0.14, 8);
  GEO.leg = new THREE.CylinderGeometry(d.legRadius, d.legRadius * 0.9, d.legLength, 8);
  // Vương miện vàng (top donor): vòng hở + chóp nón + hạt ngọc, dùng chung
  // cho chiếc vương miện duy nhất (chuyển qua lại giữa các dancer).
  const crown = d.crown;
  GEO.crownBand = new THREE.CylinderGeometry(
    crown.bandRadius, crown.bandRadius, crown.bandHeight, 16, 1, true,
  );
  GEO.crownSpike = new THREE.ConeGeometry(crown.spikeRadius, crown.spikeHeight, 8);
  GEO.crownJewel = new THREE.SphereGeometry(crown.jewelRadius, 10, 8);
  return GEO;
}

// ---- Mặt meme vẽ bằng canvas texture (dùng chung cho mọi dancer) ----
// Ánh xạ UV của SphereGeometry (flipY mặc định): mặt trước (+z) nằm ở
// u = 0.25, tức x = 1/4 chiều rộng canvas; đỉnh đầu ở y = 0 của canvas.
// Mắt/miệng vẽ quanh vùng đó để không bị kéo méo ra sau đầu.
function makeFaceTexture(variant) {
  const size = CONFIG.dancers.chibi.faceCanvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const INK = CONFIG.dancers.chibi.faceLineColor;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = size * 0.25;
  const eyeY = size * 0.47;
  const eyeDX = size * 0.09;
  const browY = size * 0.41;
  const mouthY = size * 0.57;

  // Mắt híp cười: vòm cong ∩.
  const happyEye = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y + r * 0.55, r, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  };
  const brow = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y + r, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  };
  // Đường miệng cười: vòm cong ∪.
  const smile = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.4, r, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  };

  if (variant === 'cuoi-ha') {
    // Cười há to: mắt híp + miệng há đen có răng trắng.
    brow(cx - eyeDX, browY, 30);
    brow(cx + eyeDX, browY, 30);
    happyEye(cx - eyeDX, eyeY, 30);
    happyEye(cx + eyeDX, eyeY, 30);
    const mouthPath = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 52, mouthY - 8);
      ctx.quadraticCurveTo(cx, mouthY + 38, cx + 52, mouthY - 8);
      ctx.quadraticCurveTo(cx, mouthY - 22, cx - 52, mouthY - 8);
      ctx.closePath();
    };
    mouthPath();
    ctx.fill();
    ctx.save();
    mouthPath();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 46, mouthY - 14, 92, 16);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 15, mouthY - 14);
    ctx.lineTo(cx - 15, mouthY + 2);
    ctx.moveTo(cx + 15, mouthY - 14);
    ctx.lineTo(cx + 15, mouthY + 2);
    ctx.stroke();
    ctx.restore();
  } else if (variant === 'nhe-rang') {
    // Cười nhe răng: mắt híp + miệng cười hở răng có kẻ răng.
    brow(cx - eyeDX, browY - 6, 30);
    brow(cx + eyeDX, browY - 6, 30);
    happyEye(cx - eyeDX, eyeY, 30);
    happyEye(cx + eyeDX, eyeY, 30);
    const grinPath = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 56, mouthY - 6);
      ctx.lineTo(cx + 56, mouthY - 6);
      ctx.quadraticCurveTo(cx, mouthY + 36, cx - 56, mouthY - 6);
      ctx.closePath();
    };
    grinPath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.save();
    grinPath();
    ctx.clip();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (const dx of [-28, 0, 28]) {
      ctx.moveTo(cx + dx, mouthY - 6);
      ctx.lineTo(cx + dx, mouthY + 30);
    }
    ctx.moveTo(cx - 56, mouthY + 10);
    ctx.lineTo(cx + 56, mouthY + 10);
    ctx.stroke();
    ctx.restore();
  } else if (variant === 'kinh') {
    // Đeo kính tròn: mắt chấm + miệng cười nhỏ.
    brow(cx - eyeDX, browY - 4, 30);
    brow(cx + eyeDX, browY - 4, 30);
    ctx.lineWidth = 10;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * eyeDX, eyeY, 32, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - eyeDX + 32, eyeY - 4);
    ctx.lineTo(cx + eyeDX - 32, eyeY - 4);
    ctx.moveTo(cx - eyeDX - 32, eyeY - 6);
    ctx.lineTo(cx - eyeDX - 62, eyeY - 12);
    ctx.moveTo(cx + eyeDX + 32, eyeY - 6);
    ctx.lineTo(cx + eyeDX + 62, eyeY - 12);
    ctx.stroke();
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * eyeDX, eyeY + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    smile(cx, mouthY, 26);
  } else {
    // 'tinh-nghich': một lông mày nhướng, một mắt nháy, miệng cười lệch.
    brow(cx - eyeDX, browY, 30);
    brow(cx + eyeDX, browY - 16, 26);
    happyEye(cx - eyeDX, eyeY, 30);
    ctx.beginPath();
    ctx.arc(cx + eyeDX, eyeY - 8, 24, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 48, mouthY + 6);
    ctx.quadraticCurveTo(cx + 6, mouthY + 22, cx + 52, mouthY - 14);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

// Material mặt + tóc dùng chung mọi dancer: tạo 1 lần, không dispose riêng.
let faceMatsCache = null;
function faceMaterials() {
  if (faceMatsCache) return faceMatsCache;
  faceMatsCache = CONFIG.dancers.chibi.faceVariants.map(
    (v) => new THREE.MeshLambertMaterial({ map: makeFaceTexture(v) }),
  );
  return faceMatsCache;
}

let hairMatCache = null;
function hairMaterial() {
  if (!hairMatCache) {
    hairMatCache = new THREE.MeshLambertMaterial({ color: CONFIG.dancers.chibi.hairColor });
  }
  return hairMatCache;
}

// Vật liệu vương miện dùng chung: vàng kim hơi phát sáng + ngọc đỏ.
let crownGoldMatCache = null;
function crownGoldMaterial() {
  if (!crownGoldMatCache) {
    const crown = CONFIG.dancers.crown;
    crownGoldMatCache = new THREE.MeshLambertMaterial({
      color: crown.goldColor,
      emissive: crown.goldEmissive,
      emissiveIntensity: 0.6,
    });
  }
  return crownGoldMatCache;
}

let crownJewelMatCache = null;
function crownJewelMaterial() {
  if (!crownJewelMatCache) {
    crownJewelMatCache = new THREE.MeshLambertMaterial({
      color: CONFIG.dancers.crown.jewelColor,
      emissive: CONFIG.dancers.crown.jewelColor,
      emissiveIntensity: 0.4,
    });
  }
  return crownJewelMatCache;
}

// Chọn top donor từ bảng tổng gift (Map uniqueId -> { name, total }).
// Chỉ đổi người khi có người vượt hẳn; HÒA điểm thì giữ người đang giữ
// vị trí (không nhấp nháy đổi qua đổi lại). Trả uniqueId hoặc null.
export function selectTopDonor(giftTotals, currentId) {
  if (!giftTotals || giftTotals.size === 0) return null;
  let topId = null;
  let topTotal = -1;
  for (const [id, entry] of giftTotals) {
    if (entry && entry.total > topTotal) {
      topTotal = entry.total;
      topId = id;
    }
  }
  if (currentId != null) {
    const currentTotal = giftTotals.get(String(currentId));
    if (currentTotal && currentTotal.total >= topTotal) return String(currentId);
  }
  return topId;
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

// Quay mềm từ góc hiện tại về góc đích, tối đa maxStep radian trong 1
// bước (đi dạo: không quay ngoắt). Góc chuẩn hoá về [-π, π] để không
// trôi số sau nhiều giờ chạy.
function turnToward(current, target, maxStep) {
  let cur = current % (Math.PI * 2);
  if (cur > Math.PI) cur -= Math.PI * 2;
  if (cur < -Math.PI) cur += Math.PI * 2;
  let diff = (target - cur) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  const next = cur + Math.sign(diff) * maxStep;
  if (next > Math.PI) return next - Math.PI * 2;
  if (next < -Math.PI) return next + Math.PI * 2;
  return next;
}

// So khớp lệnh chat: không phân biệt hoa/thường/dấu, lệnh nằm trong câu.
export function matchCommand(text) {
  const hay = normalizeForMatch(text);
  const entries = Object.entries(CONFIG.commands);
  for (const [key, phrases] of entries) {
    for (const phrase of phrases) {
      if (hay.includes(normalizeForMatch(phrase))) return key;
    }
  }
  return null;
}

function makeAvatarTexture(avatarUrl, displayName) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const drawFallback = () => {
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#7c4dff';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (displayName || '?').trim().charAt(0).toUpperCase() || '?';
    ctx.fillText(initial, size / 2, size / 2 + 2);
  };
  drawFallback();
  const texture = new THREE.CanvasTexture(canvas);
  if (avatarUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 0, 0, size, size);
      ctx.restore();
      texture.needsUpdate = true;
    };
    // Lỗi (CORS / link hỏng) → giữ mặt mặc định đã vẽ sẵn.
    img.onerror = () => {};
    img.src = avatarUrl;
  }
  return texture;
}

function makeNameSprite(displayName) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(4, 6, 248, 36, 18);
    ctx.fill();
  } else {
    ctx.fillRect(4, 6, 248, 36);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = displayName.length > 14 ? `${displayName.slice(0, 13)}…` : displayName;
  ctx.fillText(label, 128, 25);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(CONFIG.dancers.nameLabelWidth, CONFIG.dancers.nameLabelHeight, 1);
  return sprite;
}

export class DancerManager {
  constructor(scene, hooks = {}) {
    this.scene = scene;
    this.hooks = hooks;
    this.dancers = new Map();
    this.geo = sharedGeometries();
    this.slots = this._buildSlots();
    this.usedSlots = new Set();
    // Hàng đợi skill nhảy theo gift (FIFO): mỗi skill chạy trọn rồi mới
    // tới skill sau. Xem CONFIG.skills + enqueueSkill/getSkillCameraPose.
    this.skillQueue = [];
    this.activeSkill = null;
    // Dancer đang đứng bàn DJ (top donor). null = bàn trống.
    this.djDancer = null;
    // Vương miện vàng: CHỈ 1 chiếc duy nhất, gắn lên đầu top donor.
    // null = chưa có ai đội (chưa có gift). Tạo lười ở _getCrownGroup().
    this.crownGroup = null;
    this.crownedDancer = null;
    // Giới hạn đi dạo (vùng sàn + khu cấm): tính lười ở _wanderLimits().
    this._wanderLimitsCache = null;
  }

  _buildSlots() {
    const slots = [];
    const usableWidth = CONFIG.floor.cols * CONFIG.floor.tileSize - 2;
    const usableDepth = CONFIG.floor.rows * CONFIG.floor.tileSize - 1.6;
    // Đông người (12): lưới 3 hàng × 4 cột để không chồng lấn;
    // ít người (≤8): giữ 2 hàng như cũ.
    const rows = CONFIG.dancers.maxDancers > 8 ? 3 : 2;
    const perRow = Math.ceil(CONFIG.dancers.maxDancers / rows);
    for (let i = 0; i < CONFIG.dancers.maxDancers; i += 1) {
      const row = i % rows;
      const col = Math.floor(i / rows);
      const x = perRow <= 1 ? 0 : -usableWidth / 2 + (usableWidth * col) / (perRow - 1);
      const z = rows <= 1 ? 0 : (row / (rows - 1) - 0.5) * (usableDepth / 2);
      slots.push(new THREE.Vector3(x, 0, z));
    }
    return slots;
  }

  _takeSlot() {
    for (let i = 0; i < this.slots.length; i += 1) {
      if (!this.usedSlots.has(i)) {
        this.usedSlots.add(i);
        return i;
      }
    }
    return -1;
  }

  count() {
    return this.dancers.size;
  }

  get(uniqueId) {
    return this.dancers.get(String(uniqueId)) || null;
  }

  addOrGet(user) {
    const id = String(user.uniqueId);
    const existing = this.dancers.get(id);
    if (existing) return existing;
    if (this.dancers.size >= CONFIG.dancers.maxDancers) {
      // Sàn đầy: cho dancer cũ nhất (không phải VIP / DJ / sắp rời) rời
      // sàn để nhường chỗ. Dancer DJ được bảo vệ như VIP.
      const oldest = [...this.dancers.values()].find((d) => d.mode !== 'vip' && d.mode !== 'dj' && d.mode !== 'leaving');
      if (oldest) this.startLeave(oldest);
      else return null;
    }
    const slotIndex = this._takeSlot();
    if (slotIndex < 0) return null;
    const dancer = this._createDancer(user, slotIndex);
    this.dancers.set(id, dancer);
    this.scene.add(dancer.group);
    return dancer;
  }

  _createDancer(user, slotIndex) {
    const d = CONFIG.dancers;
    const c = d.chibi;
    const group = new THREE.Group();
    const home = this.slots[slotIndex].clone();
    // Ô lưới góc phải có thể đè lên bục VIP: đẩy điểm xuất phát ra khỏi
    // khu cấm ngay từ đầu (đi dạo kẹp lại sau mỗi bước anyway).
    this._clampPointToWander(home, this._wanderLimits());
    group.position.copy(home);
    // Bắt đầu nhỏ + dưới sàn, animation bước lên sẽ nâng dần.
    // Scale đích = CONFIG.dancers.scale (nhân vật nhỏ lại, user lệnh 22:14).
    group.scale.setScalar(0.2 * (CONFIG.dancers.scale || 1));

    const materials = [];
    const track = (mat) => {
      mat.transparent = true;
      materials.push(mat);
      return mat;
    };

    // Áo xám / tay chân trắng / quần short tối — theo ảnh tham chiếu.
    const shirtMat = track(new THREE.MeshLambertMaterial({ color: this._pick(c.shirtGrays) }));
    const skinMat = track(new THREE.MeshLambertMaterial({ color: c.skinWhite }));
    const shortsMat = track(new THREE.MeshLambertMaterial({ color: c.shortsColor }));

    // Chân nhỏ (pivot ở hông để đung đưa theo nhịp).
    const legL = new THREE.Group();
    const legR = new THREE.Group();
    legL.position.set(-0.14, d.legLength, 0);
    legR.position.set(0.14, d.legLength, 0);
    const legMeshL = new THREE.Mesh(this.geo.leg, skinMat);
    const legMeshR = new THREE.Mesh(this.geo.leg, skinMat);
    legMeshL.position.y = -d.legLength / 2;
    legMeshR.position.y = -d.legLength / 2;
    legL.add(legMeshL);
    legR.add(legMeshR);

    const shorts = new THREE.Mesh(this.geo.shorts, shortsMat);
    shorts.position.y = 0.52;

    const body = new THREE.Mesh(this.geo.body, shirtMat);
    body.position.y = 0.88;

    // Tay nhỏ, pivot riêng ở vai (skill giơ 2 tay xoay quanh pivot này);
    // tay áo xám ngắn gắn cùng pivot.
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-0.4, 1.06, 0);
    armR.position.set(0.4, 1.06, 0);
    const armMeshL = new THREE.Mesh(this.geo.arm, skinMat);
    const armMeshR = new THREE.Mesh(this.geo.arm, skinMat);
    armMeshL.position.y = -d.armLength / 2;
    armMeshR.position.y = -d.armLength / 2;
    const sleeveL = new THREE.Mesh(this.geo.sleeve, shirtMat);
    const sleeveR = new THREE.Mesh(this.geo.sleeve, shirtMat);
    sleeveL.position.y = -0.07;
    sleeveR.position.y = -0.07;
    armL.add(armMeshL, sleeveL);
    armR.add(armMeshR, sleeveR);

    // Đầu to + tóc bát úp + mặt meme (vẽ sẵn, dùng chung).
    const headGroup = new THREE.Group();
    headGroup.position.y = c.headCenterY;
    const faceIndex = Math.floor(Math.random() * faceMaterials().length);
    const headMesh = new THREE.Mesh(this.geo.head, faceMaterials()[faceIndex]);
    const hair = new THREE.Mesh(this.geo.hair, hairMaterial());
    hair.position.set(0, 0.02, 0.02);
    hair.rotation.x = c.hairTiltX;
    headGroup.add(headMesh, hair);

    // Avatar + tên nổi TRÊN đầu (Sprite luôn quay về camera), không che mặt.
    const avatarTexture = makeAvatarTexture(user.avatar, user.name);
    const avatarMat = track(new THREE.MeshBasicMaterial({ map: avatarTexture, transparent: true }));
    const avatarSprite = new THREE.Sprite(avatarMat);
    avatarSprite.scale.set(d.avatarRadius * 2, d.avatarRadius * 2, 1);
    avatarSprite.position.y = c.avatarSpriteY;

    const nameSprite = makeNameSprite(user.name);
    nameSprite.position.y = c.nameSpriteY;
    group.add(legL, legR, shorts, body, armL, armR, headGroup, avatarSprite, nameSprite);

    const dancer = {
      user,
      group,
      headGroup,
      home,
      slotIndex,
      materials,
      shirtMat,
      headMesh,
      faceIndex,
      armL,
      armR,
      legL,
      legR,
      nameSprite,
      avatarSprite,
      avatarTexture,
      // Cao độ gốc của nhãn (để trả về khi tháo vương miện).
      avatarBaseY: c.avatarSpriteY,
      nameBaseY: c.nameSpriteY,
      mode: 'dance',
      energy: CONFIG.dancers.energyBoostChat,
      phaseOffset: Math.random() * Math.PI * 2,
      enterProgress: 0,
      leaveProgress: 0,
      orbitUntil: 0,
      orbitAngle: Math.random() * Math.PI * 2,
      jumpUntil: 0,
      jumpStartedAt: 0,
      vipUntil: 0,
      baseY: 0,
      // Trạng thái skill nhảy theo gift (CONFIG.skills).
      skillKind: null, // 'rose' | 'grand' khi đang chạy skill
      skillStartedAt: 0,
      skillUntil: 0,
      somersaultStartedAt: 0,
      somersaultUntil: 0,
      somersaultGroundY: 0,
      somersaultFired: false,
      // Góc lộn hiện tại (radian, 0 khi không lộn) — camera bám theo.
      somersaultAngle: 0,
      // Bộ động tác nhảy thường (CONFIG.dancers.danceMoves): mỗi dancer
      // lệch pha riêng (moveStartBar ngẫu nhiên), đổi theo ranh giới bar.
      // 0=nhún nền, 1=xoay vòng, 2=bước ngang, 3=vung tay, 4=bật nhảy,
      // 5=lắc hông.
      moveIndex: 0,
      moveStartBar: Math.floor(Math.random() * 4),
      moveBars: 2,
      moveDir: Math.random() < 0.5 ? -1 : 1,
      // Đi dạo tự do (CONFIG.dancers.wander): hướng di chuyển + tốc độ
      // riêng, đổi hướng mềm theo thời gian. Chỉ chạy ở mode 'dance'.
      // stepOffset: độ lệch ngang đang áp dụng (bước ngang / lắc hông
      // của bộ động tác) + giá trị khung trước, để dịch mượt theo
      // hướng vuông góc với hướng đi mà không tích lũy trôi vị trí.
      wanderHeading: Math.random() * Math.PI * 2,
      wanderTargetHeading: 0,
      wanderSpeed: 0,
      wanderRetargetIn: 0,
      stepOffset: 0,
      stepOffsetPrev: 0,
    };
    const wanderCfg = CONFIG.dancers.wander;
    dancer.wanderTargetHeading = dancer.wanderHeading;
    dancer.wanderSpeed = wanderCfg.speed
      * (1 + (Math.random() * 2 - 1) * wanderCfg.speedVariation);
    dancer.wanderRetargetIn = wanderCfg.retargetSecondsMin
      + Math.random() * (wanderCfg.retargetSecondsMax - wanderCfg.retargetSecondsMin);
    return dancer;
  }

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // "Đổi nv": đổi biểu cảm mặt meme + sắc độ áo xám (tóc bát úp giữ nguyên).
  randomize(dancer) {
    const mats = faceMaterials();
    dancer.faceIndex = Math.floor(Math.random() * mats.length);
    dancer.headMesh.material = mats[dancer.faceIndex];
    dancer.shirtMat.color.setHex(this._pick(CONFIG.dancers.chibi.shirtGrays));
  }

  boost(dancer, amount) {
    dancer.energy = Math.min(1, dancer.energy + amount);
  }

  applyCommand(user, commandKey, now) {
    const dancer = this.addOrGet(user);
    if (!dancer) return null;
    if (commandKey === 'dance') {
      this.boost(dancer, CONFIG.dancers.energyBoostDanceCommand);
      dancer.jumpStartedAt = now;
      dancer.jumpUntil = now + CONFIG.dancers.jumpDurationSeconds;
    } else if (commandKey === 'changeCharacter') {
      this.randomize(dancer);
      this.boost(dancer, CONFIG.dancers.energyBoostChat);
    } else if (commandKey === 'orbit') {
      // Đang đứng bàn DJ thì ở yên đó (đi vòng sẽ kéo khỏi bàn).
      if (dancer.mode === 'dj') return dancer;
      dancer.mode = 'orbit';
      dancer.orbitUntil = now + CONFIG.dancers.orbitDurationSeconds;
      this.boost(dancer, CONFIG.dancers.energyBoostChat);
    }
    return dancer;
  }

  applyGift(user, tier, now, opts = {}) {
    const dancer = this.addOrGet(user);
    if (!dancer) return null;
    const effects = tier.effects;
    const giftBoost =
      tier.id === 'small'
        ? CONFIG.dancers.energyBoostGiftSmall
        : tier.id === 'medium'
          ? CONFIG.dancers.energyBoostGiftMedium
          : CONFIG.dancers.energyBoostGiftLarge;
    if (effects.danceBoost) this.boost(dancer, giftBoost);
    if (effects.smallEffect && this.hooks.onRing) this.hooks.onRing(dancer.group.position);
    if (effects.changeCharacter) this.randomize(dancer);
    // Skill nhảy theo gift (CONFIG.skills): xếp hàng, skill tự lo camera +
    // pháo bông nên bỏ qua zoom/pháo bông tức thời để khỏi nhân đôi hiệu ứng.
    // Các hiệu ứng còn lại (vòng sáng, đổi nv, lên bục VIP) giữ nguyên.
    const totalDiamonds = Number(opts.totalDiamonds || 0);
    const skillKind = this._skillKindFor(opts.giftName || '', totalDiamonds);
    if (skillKind) {
      this.enqueueSkill(dancer, skillKind, now);
    } else {
      if (effects.cameraZoom && this.hooks.onCameraZoom) this.hooks.onCameraZoom();
      if (effects.fireworks && this.hooks.onFireworks) {
        this.hooks.onFireworks(dancer.group.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
      }
    }
    if (effects.vipPodium) this.sendToVip(dancer, now);
    return dancer;
  }

  // Phân loại skill theo tên gift + tổng kim cương (CONFIG.skills):
  // hoa hồng nhỏ -> 'rose'; donate >= ngưỡng -> 'grand'; còn lại: không skill.
  _skillKindFor(giftName, totalDiamonds) {
    const skills = CONFIG.skills;
    if (!skills) return null;
    const norm = normalizeForMatch(giftName || '');
    const raw = String(giftName || '');
    const isRose = skills.rose.names.some(
      (n) => norm.includes(normalizeForMatch(n)) || raw.includes(n),
    );
    if (isRose && totalDiamonds <= skills.rose.maxTotalDiamonds) return 'rose';
    if (totalDiamonds >= skills.grand.minTotalDiamonds) return 'grand';
    return null;
  }

  // Xếp skill vào hàng đợi FIFO. Trả false nếu hàng đầy / dancer sắp rời sàn.
  enqueueSkill(dancer, kind, now) {
    if (!dancer || dancer.mode === 'leaving') return false;
    if (this.skillQueue.length >= CONFIG.skills.queueMaxPending) return false;
    this.skillQueue.push({ dancer, kind, enqueuedAt: now });
    return true;
  }

  // Pose camera cho skill đang chạy (main.js đọc mỗi frame để lia camera).
  // Trả null khi không có skill -> camera về góc rộng như cũ.
  getSkillCameraPose() {
    const s = this.activeSkill;
    if (!s) return null;
    const dancer = s.dancer;
    if (!this.dancers.has(String(dancer.user.uniqueId)) || dancer.mode === 'leaving') return null;
    const cfg = s.kind === 'grand' ? CONFIG.skills.grand : CONFIG.skills.rose;
    const pos = dancer.group.position;
    // Framing lúc santo (lỗi 22:29): cơ thể lộn quanh gốc ở chân nên tâm
    // người hạ xuống theo cos(góc lộn). lookAt phải bám tâm người thì
    // dancer mới ở trong khung suốt cú lộn — nhìn chằm vào gốc+1.2m thì
    // giữa vòng dancer rớt khỏi khung dưới, khung chỉ còn pháo/trời.
    // Tâm hình học ≈ giữa chân và đỉnh tóc (tính từ hình học thật, có scale);
    // ở góc 0 thì đúng bằng cameraLookAtHeight cũ (liên tục, không giật).
    const d = CONFIG.dancers;
    const centerY = ((d.chibi.headCenterY + d.chibi.hairRadius) / 2) * (d.scale || 1);
    const flip = dancer.somersaultAngle || 0;
    const lookHeight = flip === 0
      ? CONFIG.skills.cameraLookAtHeight
      : centerY * Math.cos(flip) + (CONFIG.skills.cameraLookAtHeight - centerY);
    const target = new THREE.Vector3(pos.x, pos.y + lookHeight, pos.z);
    const base = new THREE.Vector3(...CONFIG.camera.basePosition);
    const dir = base.clone().sub(pos);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    // Dancer ở bàn DJ (sau lưng, sau bàn): lùi camera ra thêm để cả bàn
    // + dancer đều trong khung, khỏi bị bàn che.
    let distance = cfg.cameraDistance;
    let height = cfg.cameraHeight;
    if (dancer.mode === 'dj') {
      distance += CONFIG.skills.djCameraExtraDistance || 0;
      height += CONFIG.skills.djCameraExtraHeight || 0;
    }
    const camPos = pos.clone().add(dir.multiplyScalar(distance));
    camPos.y = pos.y + height;
    return { position: camPos, lookAt: target, lerpSpeed: cfg.cameraLerpSpeed };
  }

  _startNextSkill(time) {
    const next = this.skillQueue.shift();
    if (!next) return;
    const { dancer, kind } = next;
    if (!this.dancers.has(String(dancer.user.uniqueId)) || dancer.mode === 'leaving') {
      this._startNextSkill(time);
      return;
    }
    const cfg = kind === 'grand' ? CONFIG.skills.grand : CONFIG.skills.rose;
    dancer.skillKind = kind;
    dancer.skillStartedAt = time;
    dancer.skillUntil = time + cfg.durationSeconds;
    dancer.somersaultFired = false;
    if (kind === 'grand') {
      dancer.somersaultStartedAt = time + cfg.somersaultDelaySeconds;
      dancer.somersaultUntil = dancer.somersaultStartedAt + cfg.somersaultDurationSeconds;
      dancer.somersaultGroundY = dancer.group.position.y;
    }
    this.activeSkill = {
      dancer,
      kind,
      startedAt: time,
      wavesFired: 0,
      nextWaveAt: kind === 'grand' ? time + 0.15 : 0,
    };
    this.boost(dancer, 1);
    // Rose: bật nhảy 1 cái lúc bắt đầu skill (cùng cơ chế lệnh "nhảy").
    if (kind === 'rose') {
      dancer.jumpStartedAt = time;
      dancer.jumpUntil = time + CONFIG.dancers.jumpDurationSeconds;
    }
    if (kind === 'grand' && cfg.pads && cfg.pads.onStart && this.hooks.onSkillPad) {
      try {
        this.hooks.onSkillPad(cfg.pads.onStart);
      } catch (err) {
        console.error('[DancerManager] onSkillPad lỗi:', err);
      }
    }
  }

  // Tick hàng đợi + skill đang chạy. Gọi đầu mỗi update() để pose của
  // dancer trong cùng frame đã phản ánh skill mới bắt đầu.
  _tickSkill(time) {
    if (!this.activeSkill && this.skillQueue.length > 0) this._startNextSkill(time);
    const s = this.activeSkill;
    if (!s) return;
    const dancer = s.dancer;
    if (!this.dancers.has(String(dancer.user.uniqueId)) || dancer.mode === 'leaving') {
      dancer.skillKind = null;
      this.activeSkill = null;
      return;
    }
    const cfg = s.kind === 'grand' ? CONFIG.skills.grand : CONFIG.skills.rose;
    // Pháo bông nhiều đợt cho skill lớn, đổi màu theo từng đợt.
    if (s.kind === 'grand' && s.wavesFired < cfg.fireworksWaves && time >= s.nextWaveAt) {
      const colors = cfg.fireworksColors && cfg.fireworksColors.length
        ? cfg.fireworksColors
        : [CONFIG.floor.beatColors[2]];
      const color = colors[s.wavesFired % colors.length];
      if (this.hooks.onFireworks) {
        this.hooks.onFireworks(
          dancer.group.position.clone().add(new THREE.Vector3(0, 2.4, 0)),
          color,
        );
      }
      s.wavesFired += 1;
      s.nextWaveAt = time + cfg.fireworksWaveIntervalSeconds;
    }
    // Impact pad đúng lúc bắt đầu santo.
    if (s.kind === 'grand' && !dancer.somersaultFired && time >= dancer.somersaultStartedAt) {
      dancer.somersaultFired = true;
      if (cfg.pads && cfg.pads.onSomersault && this.hooks.onSkillPad) {
        try {
          this.hooks.onSkillPad(cfg.pads.onSomersault);
        } catch (err) {
          console.error('[DancerManager] onSkillPad lỗi:', err);
        }
      }
    }
    // Hết skill -> trả trạng thái; camera tự về góc rộng (pose = null).
    // Skill kế trong hàng đợi bắt đầu ngay trong cùng tick (không chờ frame sau).
    if (time >= dancer.skillUntil) {
      dancer.skillKind = null;
      dancer.somersaultAngle = 0;
      dancer.group.rotation.x = 0;
      this.activeSkill = null;
      if (this.skillQueue.length > 0) this._startNextSkill(time);
    }
  }

  sendToVip(dancer, now) {
    // Dancer đang đứng bàn DJ thì ở yên đó (không kéo lên bục VIP).
    if (dancer.mode === 'dj') return;
    dancer.mode = 'vip';
    dancer.vipUntil = now + CONFIG.gifts.vipDurationSeconds;
    dancer.group.position.set(
      CONFIG.stage.vipPosition[0],
      CONFIG.stage.vipPlatformSize[1],
      CONFIG.stage.vipPosition[2],
    );
    if (this.hooks.onVipSpotlight) this.hooks.onVipSpotlight(true);
  }

  // ---- Vương miện vàng (top donor, user lệnh 22:26) ----
  // Chỉ 1 chiếc duy nhất: tạo 1 lần, gắn qua lại giữa các dancer bằng cách
  // reparent vào headGroup của top donor. Là con của headGroup nên tự theo
  // scale 0.8, theo mọi animation (nhảy, santo, tư thế DJ), đội đúng trên
  // đỉnh tóc bát úp (cùng độ nghiêng với tóc), không che mặt.
  _getCrownGroup() {
    if (this.crownGroup) return this.crownGroup;
    const crown = CONFIG.dancers.crown;
    const c = CONFIG.dancers.chibi;
    const group = new THREE.Group();
    group.visible = false;
    // Cùng độ nghiêng + lệch với tóc bát úp để vương miện ôm sát đỉnh tóc.
    group.rotation.x = c.hairTiltX;
    group.position.set(0, 0, 0.02);

    const band = new THREE.Mesh(this.geo.crownBand, crownGoldMaterial());
    band.position.y = crown.bandY;
    group.add(band);

    // Chóp quanh vòng, 1 chóp ở chính giữa phía trước (góc 0 = +z).
    for (let i = 0; i < crown.spikes; i += 1) {
      const angle = (i / crown.spikes) * Math.PI * 2;
      const spike = new THREE.Mesh(this.geo.crownSpike, crownGoldMaterial());
      spike.position.set(
        Math.sin(angle) * crown.spikeRingRadius,
        crown.bandY + crown.bandHeight / 2 + crown.spikeHeight / 2 - 0.03,
        Math.cos(angle) * crown.spikeRingRadius,
      );
      group.add(spike);
    }

    // Hạt ngọc đỏ ở chính giữa phía trước vòng.
    const jewel = new THREE.Mesh(this.geo.crownJewel, crownJewelMaterial());
    jewel.position.set(0, crown.bandY, crown.bandRadius - 0.01);
    group.add(jewel);

    this.crownGroup = group;
    return group;
  }

  // Nâng/trả nhãn tên + avatar khi đội/tháo vương miện (khỏi chạm chóp).
  _setCrownLabels(dancer, crowned) {
    const lift = crowned ? (CONFIG.dancers.crown.labelLiftY || 0) : 0;
    dancer.avatarSprite.position.y = dancer.avatarBaseY + lift;
    dancer.nameSprite.position.y = dancer.nameBaseY + lift;
  }

  _attachCrown(dancer) {
    if (!dancer) return;
    if (this.crownedDancer === dancer) return;
    this._detachCrown();
    const crown = this._getCrownGroup();
    dancer.headGroup.add(crown);
    crown.visible = true;
    this._setCrownLabels(dancer, true);
    this.crownedDancer = dancer;
  }

  _detachCrown() {
    const prev = this.crownedDancer;
    this.crownedDancer = null;
    if (!prev) return;
    this._setCrownLabels(prev, false);
    if (this.crownGroup && this.crownGroup.parent) {
      this.crownGroup.parent.remove(this.crownGroup);
    }
    if (this.crownGroup) this.crownGroup.visible = false;
  }

  getCrownedDancer() {
    return this.crownedDancer;
  }

  // ---- Bàn DJ (top donor) ----
  // Đưa dancer lên bàn DJ (CONFIG.djTable.spotPosition). Người cũ tự
  // lerp về chỗ trên sàn (mode 'dance'). Chuyển động mượt, không nhảy cắt.
  setDjDancer(dancer) {
    if (!dancer) return false;
    if (this.djDancer === dancer) return true;
    const prev = this.djDancer;
    if (prev && this.dancers.has(String(prev.user.uniqueId))) {
      prev.mode = 'dance';
      // Về sàn thì đi dạo tiếp từ chỗ đang đứng (đi bộ về giữa sàn).
      this._resetWanderTowardFloor(prev);
    }
    // Dancer đang ở bục VIP thì tắt spotlight nếu không còn ai ở bục.
    if (dancer.mode === 'vip') {
      const othersVip = [...this.dancers.values()].some(
        (o) => o !== dancer && o.mode === 'vip',
      );
      if (!othersVip && this.hooks.onVipSpotlight) this.hooks.onVipSpotlight(false);
    }
    dancer.mode = 'dj';
    this.djDancer = dancer;
    // Top donor đội thêm vương miện vàng (chuyển cùng lúc với bàn DJ).
    this._attachCrown(dancer);
    return true;
  }

  // Bàn DJ trống: người đang đứng về lại sàn. Gọi khi chưa có gift nào.
  clearDjDancer() {
    this._detachCrown();
    const prev = this.djDancer;
    this.djDancer = null;
    if (prev && this.dancers.has(String(prev.user.uniqueId)) && prev.mode === 'dj') {
      prev.mode = 'dance';
      this._resetWanderTowardFloor(prev);
    }
  }

  getDjDancer() {
    return this.djDancer;
  }

  startLeave(dancer) {
    if (dancer.mode === 'leaving') return;
    dancer.mode = 'leaving';
    dancer.leaveProgress = 0;
  }

  _removeDancer(dancer) {
    if (this.crownedDancer === dancer) this._detachCrown();
    if (this.djDancer === dancer) this.djDancer = null;
    this.scene.remove(dancer.group);
    this.dancers.delete(String(dancer.user.uniqueId));
    this.usedSlots.delete(dancer.slotIndex);
    dancer.materials.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
    dancer.nameSprite.material.map.dispose();
    dancer.nameSprite.material.dispose();
    dancer.avatarTexture.dispose();
  }

  // ---- Bộ động tác nhảy thường (CONFIG.dancers.danceMoves) ----
  // Đổi động tác ở ranh giới bar nhạc; mỗi dancer lệch pha riêng nhờ
  // moveStartBar khởi tạo ngẫu nhiên. Chỉ gọi trong nhánh nhảy thường
  // (mode 'dance') — DJ/VIP/đi vòng giữ nguyên hành vi cũ.
  _moveTick(dancer, barFloat) {
    const barIndex = Math.floor(barFloat);
    if (barIndex < dancer.moveStartBar + dancer.moveBars) return;
    dancer.moveIndex = this._pickNextMove(dancer);
    dancer.moveStartBar = barIndex;
    // Xoay vòng đúng 2 bar (đủ 360°); các động tác khác 2–4 bar.
    dancer.moveBars = dancer.moveIndex === 1 ? 2 : 2 + Math.floor(Math.random() * 3);
    dancer.moveDir = Math.random() < 0.5 ? -1 : 1;
  }

  _pickNextMove(dancer) {
    const weights = (CONFIG.dancers.danceMoves && CONFIG.dancers.danceMoves.weights)
      || { base: 30, spin: 15, step: 20, arms: 15, hop: 10, sway: 10 };
    const order = ['base', 'spin', 'step', 'arms', 'hop', 'sway'];
    const indexOf = { base: 0, spin: 1, step: 2, arms: 3, hop: 4, sway: 5 };
    let total = 0;
    for (const name of order) {
      if (indexOf[name] !== dancer.moveIndex) total += weights[name] || 0;
    }
    let roll = Math.random() * total;
    for (const name of order) {
      if (indexOf[name] === dancer.moveIndex) continue;
      roll -= weights[name] || 0;
      if (roll <= 0) return indexOf[name];
    }
    return 0;
  }

  // Pose của động tác thường tại thời điểm time. Trả về các offset nhỏ,
  // tất cả đều về 0 ở cuối động tác nên không tích lũy lệch (bước ngang
  // / lắc hông là độ lệch ngang so với đường đi dạo, áp theo hướng
  // vuông góc với hướng đi trong update()). Xoay vòng: góc tăng đều
  // 0 → 2π trong đúng 1 động tác.
  _movePose(dancer, time) {
    const cfg = CONFIG.dancers.danceMoves || {};
    const bpm = (CONFIG.music && CONFIG.music.bpm) || 128;
    const beatsPerBar = cfg.beatsPerBar || 4;
    const barFloat = (time * bpm) / (60 * beatsPerBar);
    this._moveTick(dancer, barFloat);
    const pose = {
      spinAngle: 0,
      stepX: 0,
      armAmp: 1,
      armSweep: 0,
      hopY: 0,
      hopArms: 0,
      swayZ: 0,
    };
    const p = Math.min(1, Math.max(0, (barFloat - dancer.moveStartBar) / dancer.moveBars));
    if (dancer.moveIndex === 1) {
      // Xoay vòng: 1 vòng trọn quanh trục đứng, hết động tác về đúng 2π ≡ 0.
      pose.spinAngle = p * Math.PI * 2 * dancer.moveDir;
    } else if (dancer.moveIndex === 2) {
      // Bước ngang: sang một bên rồi về lại ô.
      pose.stepX = Math.sin(p * Math.PI) * (cfg.stepDistance || 0.35) * dancer.moveDir;
    } else if (dancer.moveIndex === 3) {
      // Vung tay: quét tay lên/xuống xen kẽ + đung đưa mạnh hơn.
      pose.armAmp = cfg.armSweepMultiplier || 1.6;
      pose.armSweep = cfg.armSweep || 0.9;
    } else if (dancer.moveIndex === 4) {
      // Bật nhảy: 2 cú bật nhỏ trong 1 động tác + giơ tay theo độ cao.
      pose.hopY = Math.abs(Math.sin(p * Math.PI * 2)) * (cfg.hopHeight || 0.28);
      pose.hopArms = pose.hopY / (cfg.hopHeight || 0.28);
      pose.armAmp = 1.4;
    } else if (dancer.moveIndex === 5) {
      // Lắc hông: nghiêng người + dịch ngang nhẹ theo nhịp động tác.
      pose.swayZ = Math.sin(p * Math.PI * 2) * (cfg.swayAngle || 0.12);
      pose.stepX = Math.sin(p * Math.PI * 2) * (cfg.swayShift || 0.08);
    }
    return pose;
  }

  // ---- Đi dạo tự do (CONFIG.dancers.wander, user lệnh 23:26) ----
  // Vùng đi dạo suy ra từ CONFIG.floor (trừ lề) + khu cấm suy ra từ
  // CONFIG.djTable / CONFIG.stage (có đệm): bàn DJ sau lưng, bục VIP
  // bên phải, booth DJ bên trái. Tính 1 lần, cache lại (CONFIG tĩnh).
  _wanderLimits() {
    if (this._wanderLimitsCache) return this._wanderLimitsCache;
    const w = CONFIG.dancers.wander;
    const halfW = (CONFIG.floor.cols * CONFIG.floor.tileSize) / 2 - w.edgeMargin;
    const halfD = (CONFIG.floor.rows * CONFIG.floor.tileSize) / 2 - w.edgeMargin;
    const pad = w.keepOutPadding;
    const rect = (cx, cz, sx, sz) => ({
      minX: cx - sx / 2 - pad,
      maxX: cx + sx / 2 + pad,
      minZ: cz - sz / 2 - pad,
      maxZ: cz + sz / 2 + pad,
    });
    this._wanderLimitsCache = {
      minX: -halfW,
      maxX: halfW,
      minZ: -halfD,
      maxZ: halfD,
      keepOuts: [
        // Bàn DJ sau lưng (chỉ top donor đứng, người khác không vào).
        rect(CONFIG.djTable.position[0], CONFIG.djTable.position[2],
          CONFIG.djTable.size[0], CONFIG.djTable.size[2]),
        // Bục VIP bên phải.
        rect(CONFIG.stage.vipPosition[0], CONFIG.stage.vipPosition[2],
          CONFIG.stage.vipPlatformSize[0], CONFIG.stage.vipPlatformSize[2]),
        // Booth DJ bên trái.
        rect(CONFIG.stage.djPosition[0], CONFIG.stage.djPosition[2],
          CONFIG.stage.djBoothSize[0], CONFIG.stage.djBoothSize[2]),
      ],
    };
    return this._wanderLimitsCache;
  }

  // Điểm (x, z) có bị chặn không: ngoài vùng sàn hoặc trong khu cấm
  // (nở thêm radius). radius = 0: kiểm tra đúng tâm người.
  _wanderBlocked(x, z, limits, radius = 0) {
    if (x < limits.minX + radius || x > limits.maxX - radius
      || z < limits.minZ + radius || z > limits.maxZ - radius) return true;
    for (const r of limits.keepOuts) {
      if (x >= r.minX - radius && x <= r.maxX + radius
        && z >= r.minZ - radius && z <= r.maxZ + radius) return true;
    }
    return false;
  }

  // Kẹp 1 điểm (Vector3, chỉ dùng x/z) vào vùng đi dạo: kẹp mép sàn,
  // rồi đẩy ra khỏi khu cấm theo cạnh gần nhất.
  _clampPointToWander(pos, limits) {
    pos.x = Math.min(limits.maxX, Math.max(limits.minX, pos.x));
    pos.z = Math.min(limits.maxZ, Math.max(limits.minZ, pos.z));
    for (const r of limits.keepOuts) {
      if (pos.x >= r.minX && pos.x <= r.maxX && pos.z >= r.minZ && pos.z <= r.maxZ) {
        const dxMin = pos.x - r.minX;
        const dxMax = r.maxX - pos.x;
        const dzMin = pos.z - r.minZ;
        const dzMax = r.maxZ - pos.z;
        const m = Math.min(dxMin, dxMax, dzMin, dzMax);
        if (m === dxMin) pos.x = r.minX;
        else if (m === dxMax) pos.x = r.maxX;
        else if (m === dzMin) pos.z = r.minZ;
        else pos.z = r.maxZ;
      }
    }
    return pos;
  }

  _clampToWander(dancer, limits) {
    return this._clampPointToWander(dancer.group.position, limits);
  }

  // Về lại chế độ đi dạo sau khi rời bàn DJ / bục VIP / đi vòng: hướng
  // thẳng về giữa sàn (đi bộ về, không nhảy cắt), đổi hướng ngẫu nhiên
  // lại sau 1 giây. Reset cả độ lệch ngang để khỏi giật.
  _resetWanderTowardFloor(dancer) {
    const limits = this._wanderLimits();
    const pos = dancer.group.position;
    const cx = (limits.minX + limits.maxX) / 2;
    const cz = (limits.minZ + limits.maxZ) / 2;
    const heading = Math.atan2(cx - pos.x, cz - pos.z);
    dancer.wanderHeading = heading;
    dancer.wanderTargetHeading = heading;
    dancer.wanderRetargetIn = 1;
    dancer.stepOffset = 0;
    dancer.stepOffsetPrev = 0;
  }

  // Lái hướng đi dạo 1 frame: đổi hướng ngẫu nhiên mềm theo thời gian;
  // sắp chạm tường/vật cản thì quay về giữa sàn; đang ở ngoài vùng
  // (vừa rời bàn DJ/bục VIP) thì đi thẳng về vùng. Trả về heading mới.
  _steerWander(dancer, dt) {
    const w = CONFIG.dancers.wander;
    const limits = this._wanderLimits();
    const pos = dancer.group.position;
    dancer.wanderRetargetIn -= dt;
    if (dancer.wanderRetargetIn <= 0) {
      dancer.wanderTargetHeading = dancer.wanderHeading
        + (Math.random() * 2 - 1) * w.retargetMaxTurn;
      dancer.wanderRetargetIn = w.retargetSecondsMin
        + Math.random() * (w.retargetSecondsMax - w.retargetSecondsMin);
    }
    let desired = dancer.wanderTargetHeading;
    // Nhìn trước: sắp chạm tường/vật cản thì quay về giữa sàn.
    const aheadX = pos.x + Math.sin(dancer.wanderHeading) * w.lookAhead;
    const aheadZ = pos.z + Math.cos(dancer.wanderHeading) * w.lookAhead;
    if (this._wanderBlocked(aheadX, aheadZ, limits, 0.25)) {
      const cx = (limits.minX + limits.maxX) / 2;
      const cz = (limits.minZ + limits.maxZ) / 2;
      desired = Math.atan2(cx - pos.x, cz - pos.z)
        + (Math.random() * 2 - 1) * 0.3;
      dancer.wanderTargetHeading = desired;
      dancer.wanderRetargetIn = Math.max(
        dancer.wanderRetargetIn,
        w.retargetSecondsMin * 0.5,
      );
    }
    // Đang ở ngoài vùng thì đi thẳng về vùng (không lang thang ngoài sàn).
    if (this._wanderBlocked(pos.x, pos.z, limits, 0)) {
      const cx = (limits.minX + limits.maxX) / 2;
      const cz = (limits.minZ + limits.maxZ) / 2;
      desired = Math.atan2(cx - pos.x, cz - pos.z);
      dancer.wanderTargetHeading = desired;
    }
    dancer.wanderHeading = turnToward(dancer.wanderHeading, desired, w.turnRate * dt);
    return dancer.wanderHeading;
  }

  // Giữ khoảng cách tối thiểu giữa các dancer đang đi dạo (2 lượt nới
  // lỏng — rẻ, 12 dancer chỉ ~10² cặp). Dancer đang chạy skill đứng yên
  // như vật cản (chỉ đẩy người kia, không đẩy mình); DJ/VIP/rời sàn
  // không tham gia (ở ngoài vùng đi dạo). Sau mỗi lượt, kẹp lại vào vùng.
  _separateWanderers() {
    const w = CONFIG.dancers.wander;
    const limits = this._wanderLimits();
    const movers = [...this.dancers.values()].filter(
      (d) => d.mode === 'dance' && d.enterProgress >= 1,
    );
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < movers.length; i += 1) {
        for (let j = i + 1; j < movers.length; j += 1) {
          const a = movers[i];
          const b = movers[j];
          let dx = b.group.position.x - a.group.position.x;
          let dz = b.group.position.z - a.group.position.z;
          let dist = Math.hypot(dx, dz);
          if (dist >= w.minSeparation) continue;
          if (dist < 1e-6) {
            // Chồng khít nhau: tách theo trục xác định (tránh NaN).
            dx = (j % 2 === 0 ? 1 : -1) * 0.5;
            dz = 0.5;
            dist = Math.hypot(dx, dz);
          }
          const push = (w.minSeparation - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          const aFrozen = !!a.skillKind;
          const bFrozen = !!b.skillKind;
          if (!aFrozen) {
            a.group.position.x -= nx * push * (bFrozen ? 2 : 1);
            a.group.position.z -= nz * push * (bFrozen ? 2 : 1);
          }
          if (!bFrozen) {
            b.group.position.x += nx * push * (aFrozen ? 2 : 1);
            b.group.position.z += nz * push * (aFrozen ? 2 : 1);
          }
        }
      }
      for (const d of movers) {
        // Dancer đang chạy skill đứng yên: không kẹp vị trí của họ.
        if (d.skillKind) continue;
        this._clampToWander(d, limits);
      }
    }
  }

  update(dt, time, beatPhase) {
    const d = CONFIG.dancers;
    // Hàng đợi skill chạy trước để pose trong frame này đã đúng.
    this._tickSkill(time);
    for (const dancer of [...this.dancers.values()]) {
      const { group } = dancer;

      if (dancer.mode === 'leaving') {
        dancer.leaveProgress += dt / d.leaveDurationSeconds;
        const opacity = Math.max(0, 1 - dancer.leaveProgress);
        dancer.materials.forEach((m) => { m.opacity = opacity; });
        dancer.nameSprite.material.opacity = opacity;
        group.scale.setScalar(Math.max(0.05, 1 - dancer.leaveProgress * 0.8) * (d.scale || 1));
        if (dancer.leaveProgress >= 1) this._removeDancer(dancer);
        continue;
      }

      // Vào sàn: lớn dần + hiện dần (đích = CONFIG.dancers.scale).
      if (dancer.enterProgress < 1) {
        dancer.enterProgress = Math.min(1, dancer.enterProgress + dt / d.enterDurationSeconds);
        const s = (0.2 + 0.8 * dancer.enterProgress) * (d.scale || 1);
        group.scale.setScalar(s);
        dancer.materials.forEach((m) => { m.opacity = dancer.enterProgress; });
        dancer.nameSprite.material.opacity = dancer.enterProgress;
      }

      dancer.energy = Math.max(0, dancer.energy - d.energyDecayPerSecond * dt);

      // Hết thời gian VIP / đi vòng → quay về đi dạo (đi bộ về giữa sàn).
      if (dancer.mode === 'vip' && time >= dancer.vipUntil) {
        dancer.mode = 'dance';
        this._resetWanderTowardFloor(dancer);
        if (![...this.dancers.values()].some((o) => o.mode === 'vip') && this.hooks.onVipSpotlight) {
          this.hooks.onVipSpotlight(false);
        }
      }
      if (dancer.mode === 'orbit' && time >= dancer.orbitUntil) {
        dancer.mode = 'dance';
        this._resetWanderTowardFloor(dancer);
      }

      const swing = Math.sin(beatPhase * Math.PI * 2 + dancer.phaseOffset);
      const amp = d.bobAmplitude * (0.4 + dancer.energy);
      let y = dancer.baseY + Math.max(0, swing) * amp * 2;
      // Bộ động tác thường: tính cho mọi dancer để nhịp luôn theo bar;
      // chỉ nhánh nhảy thường (mode 'dance') mới áp offset (DJ/VIP/đi
      // vòng giữ nguyên hành vi cũ, skill đè lên rồi về lại bộ này).
      const movePose = this._movePose(dancer, time);

      if (dancer.mode === 'orbit') {
        dancer.orbitAngle += d.orbitSpeed * dt;
        const p = new THREE.Vector3(
          Math.cos(dancer.orbitAngle) * d.orbitRadius,
          0,
          Math.sin(dancer.orbitAngle) * d.orbitRadius * 0.55,
        );
        group.position.lerp(p, Math.min(1, dt * 4));
        group.rotation.y = -dancer.orbitAngle;
      } else if (dancer.mode === 'vip') {
        // Đứng yên trên bục, vẫn nhún theo nhạc.
        group.position.x = CONFIG.stage.vipPosition[0];
        group.position.z = CONFIG.stage.vipPosition[2];
        group.position.y = CONFIG.stage.vipPlatformSize[1] + Math.max(0, swing) * amp;
        group.rotation.y = 0;
      } else if (dancer.mode === 'dj') {
        // Đứng bàn DJ sau lưng: lerp mượt tới chỗ đứng sau bàn, quay mặt
        // ra camera, nhún nhẹ theo nhịp. Skill (nếu có) chạy tại chỗ ở
        // bàn DJ: khối santo bên dưới sẽ ghi đè y/rotation.x khi cần.
        const spot = CONFIG.djTable.spotPosition;
        const djLerp = Math.min(1, dt * (CONFIG.djTable.moveLerpSpeed || 3));
        group.position.x += (spot[0] - group.position.x) * djLerp;
        group.position.z += (spot[2] - group.position.z) * djLerp;
        group.position.y = dancer.baseY + Math.abs(swing) * amp * 0.5;
        group.rotation.y = 0;
      } else {
        // Nhảy thường + đi dạo tự do (CONFIG.dancers.wander): vừa đi
        // vừa nhảy, đổi hướng mềm, giữ khoảng cách (tách nhau ở cuối
        // update). Skill đóng băng di chuyển (đứng yên tại chỗ để
        // camera lia đúng), hết skill thì đi dạo tiếp từ chỗ đang đứng.
        // Bước ngang/lắc hông của bộ động tác: dịch ngang theo hướng
        // vuông góc với hướng đi (không theo trục X thế giới), áp
        // mượt từng khung để không tích lũy trôi vị trí.
        const frozen = !!dancer.skillKind;
        if (!frozen && dancer.enterProgress >= 1) {
          const heading = this._steerWander(dancer, dt);
          group.position.x += Math.sin(heading) * dancer.wanderSpeed * dt;
          group.position.z += Math.cos(heading) * dancer.wanderSpeed * dt;
          this._clampToWander(dancer, this._wanderLimits());
        }
        if (!frozen && dancer.enterProgress >= 1) {
          const sideX = Math.cos(dancer.wanderHeading);
          const sideZ = -Math.sin(dancer.wanderHeading);
          dancer.stepOffset += (movePose.stepX - dancer.stepOffset) * Math.min(1, dt * 6);
          const deltaStep = dancer.stepOffset - dancer.stepOffsetPrev;
          dancer.stepOffsetPrev = dancer.stepOffset;
          group.position.x += sideX * deltaStep;
          group.position.z += sideZ * deltaStep;
        }
        group.position.y = y + movePose.hopY;
        // Mặt hướng theo hướng đi + góc xoay của động tác xoay vòng.
        group.rotation.y = dancer.wanderHeading + movePose.spinAngle;
        // Nhảy mạnh (lệnh "nhảy"): bật lên rồi rơi xuống trong 0.7s.
        if (time < dancer.jumpUntil) {
          const progress = 1 - (dancer.jumpUntil - time) / CONFIG.dancers.jumpDurationSeconds;
          group.position.y += Math.sin(progress * Math.PI) * d.jumpAmplitude;
        }
      }

      // Skill santo (grand): lộn nhào 1 vòng trọn 360° quanh trục ngang
      // (rotation.x) + bật lên theo parabola, rồi về đúng tư thế cũ.
      // Ghi lại góc lộn để camera bám tâm người (không nhìn chằm vào
      // điểm gốc+1.2m khiến dancer rớt khỏi khung giữa vòng — lỗi 22:29).
      const somersaulting = dancer.skillKind === 'grand'
        && time >= dancer.somersaultStartedAt && time < dancer.somersaultUntil;
      if (somersaulting) {
        const sp = (time - dancer.somersaultStartedAt) / CONFIG.skills.grand.somersaultDurationSeconds;
        dancer.somersaultAngle = sp * Math.PI * 2;
        group.position.y = dancer.somersaultGroundY
          + Math.sin(sp * Math.PI) * CONFIG.skills.grand.somersaultHeight;
        group.rotation.x = dancer.somersaultAngle;
      } else {
        dancer.somersaultAngle = 0;
        group.rotation.x = 0;
      }

      // Skill giơ 2 tay lên (cả rose và grand): blend mượt vào/ra ở đầu
      // và cuối skill, tay mở thành hình chữ V hướng lên trên.
      // Động tác bật nhảy cũng giơ tay theo độ cao (chỉ ở nhánh nhảy thường).
      let armsUp = 0;
      if (dancer.skillKind) {
        const skillCfg = dancer.skillKind === 'grand' ? CONFIG.skills.grand : CONFIG.skills.rose;
        const blend = skillCfg.armsUpBlendSeconds || 0.3;
        const elapsedSkill = time - dancer.skillStartedAt;
        const remainSkill = dancer.skillUntil - time;
        armsUp = Math.min(1, Math.max(0, elapsedSkill / blend), Math.max(0, remainSkill / blend));
      } else if (dancer.mode === 'dance' && movePose.hopArms > 0) {
        armsUp = Math.min(1, movePose.hopArms * 0.85);
      }

      // Tay + chân đung đưa theo nhịp, mạnh dần theo energy. Động tác vung
      // tay: tay đung đưa mạnh hơn + quét lên/xuống xen kẽ theo nhịp.
      const isDj = dancer.mode === 'dj';
      const armSwing = swing * d.armSwingAmplitude * (0.35 + dancer.energy)
        * (dancer.mode === 'dance' ? movePose.armAmp : 1);
      const sweep = dancer.mode === 'dance'
        ? movePose.armSweep * Math.sin(beatPhase * Math.PI * 2)
        : 0;
      if (armsUp > 0) {
        dancer.armL.rotation.z = THREE.MathUtils.lerp(0.25 + armSwing, -2.6, armsUp);
        dancer.armR.rotation.z = THREE.MathUtils.lerp(-0.25 - armSwing, 2.6, armsUp);
        dancer.armL.rotation.x = THREE.MathUtils.lerp(-armSwing * 0.4, -0.3, armsUp);
        dancer.armR.rotation.x = THREE.MathUtils.lerp(armSwing * 0.4, -0.3, armsUp);
      } else if (isDj) {
        // Tư thế chơi DJ: 2 tay đưa ra trước đặt lên bàn, đung đưa nhẹ
        // theo nhịp (tay vẫn giơ lên được khi chạy skill, nhánh trên lo).
        const djCfg = CONFIG.djTable;
        const djBob = swing * (djCfg.armBobAmplitude || 0.08);
        dancer.armL.rotation.x = (djCfg.armForwardX || -1.05) + djBob;
        dancer.armR.rotation.x = (djCfg.armForwardX || -1.05) - djBob;
        dancer.armL.rotation.z = 0.15;
        dancer.armR.rotation.z = -0.15;
      } else {
        dancer.armL.rotation.z = 0.25 + armSwing;
        dancer.armR.rotation.z = -0.25 - armSwing;
        dancer.armL.rotation.x = -armSwing * 0.4 - sweep;
        dancer.armR.rotation.x = armSwing * 0.4 + sweep;
      }
      if (isDj && !dancer.skillKind) {
        // Đứng bàn DJ thì chân đứng yên (chỉ nhún người theo nhịp).
        dancer.legL.rotation.x = 0;
        dancer.legR.rotation.x = 0;
      } else {
        dancer.legL.rotation.x = -swing * 0.45 * (0.35 + dancer.energy);
        dancer.legR.rotation.x = swing * 0.45 * (0.35 + dancer.energy);
      }
      // Cả người hơi nghiêng theo nhịp (trừ lúc santo / đứng bàn DJ);
      // động tác lắc hông cộng thêm nghiêng + dịch ngang (nhánh nhảy thường).
      group.rotation.z = swing * 0.05 * (0.5 + dancer.energy)
        + (dancer.mode === 'dance' ? movePose.swayZ : 0);
      if (dancer.mode === 'orbit') group.rotation.z = 0;
      if (isDj) group.rotation.z = 0;
      if (somersaulting) group.rotation.z = 0;
    }
    // Cuối frame: tách các dancer đi dạo để giữ khoảng cách tối thiểu
    // (không chồng lấn), rồi kẹp lại vào vùng đi dạo.
    this._separateWanderers();
  }
}
