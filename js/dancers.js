// dancers.js — dancer Khá Bảnh + avatar + tên, vào/ra sàn,
// nhảy theo nhịp, lệnh chat, hiệu ứng gift, skill nhảy theo gift.
// Mọi ngưỡng đọc từ config.js. Nhân vật: chibi tóc vuốt keo chải ngược,
// kính đen, dây chuyền vàng, áo đen; mặt trắng vẽ nét mảnh bằng canvas
// texture (không asset ngoài). Cô múa cột trong lồng dựng riêng, không
// dùng mẫu này (xem _createPoleDancer).

import * as THREE from 'three';
import { CONFIG } from '../config.js';

// ---- Clip mocap cho người múa cột (model GLB, xem _loadPoleModel) ----
// Dữ liệu clip JSON: {fps, duration, tracks: {khớp: {times, values xyzw}},
// rootY: {times, values}}. Hai hàm thuần dưới đây dùng chung cho runtime
// và harness headless (test/pole-model-harness.mjs) để khỏi lệch nhau.

// Kiểm chứng + chuẩn hóa clip JSON thành dữ liệu dựng AnimationClip.
export function buildPoleClipData(json) {
  if (!json || !json.tracks || typeof json.duration !== 'number') {
    throw new Error('clip múa cột sai định dạng');
  }
  const tracks = [];
  for (const [bone, tr] of Object.entries(json.tracks)) {
    if (!Array.isArray(tr.times) || !Array.isArray(tr.values)) {
      throw new Error('track ' + bone + ' sai định dạng');
    }
    if (tr.values.length !== tr.times.length * 4) {
      throw new Error('track ' + bone + ' lệch độ dài');
    }
    const values = tr.values.slice();
    for (let i = 0; i < tr.times.length; i += 1) {
      const o = i * 4;
      const n = Math.hypot(values[o], values[o + 1], values[o + 2], values[o + 3]) || 1;
      values[o] /= n; values[o + 1] /= n; values[o + 2] /= n; values[o + 3] /= n;
    }
    tracks.push({ bone, times: tr.times.slice(), values });
  }
  if (tracks.length === 0) throw new Error('clip múa cột rỗng');
  return {
    duration: json.duration,
    tracks,
    rootY: json.rootY && Array.isArray(json.rootY.times) && Array.isArray(json.rootY.values)
      ? { times: json.rootY.times.slice(), values: json.rootY.values.slice() }
      : null,
  };
}

// Nội suy tuyến tính đường cong rootY (bob dọc) tại thời điểm t (giây).
export function sampleRootYCurve(curve, time) {
  if (!curve || !curve.times || curve.times.length === 0) return 0;
  const { times, values } = curve;
  if (time <= times[0]) return values[0];
  const last = times.length - 1;
  if (time >= times[last]) return values[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid; else hi = mid;
  }
  const f = (time - times[lo]) / ((times[hi] - times[lo]) || 1);
  return values[lo] + (values[hi] - values[lo]) * f;
}

// Làm nổi bật mẫu nữ GLB (user lệnh 06:13): da sáng hơn chút, đồ diễn
// (bikini từ 06:47, trước đó là sportsuit) có emissive tím nhẹ theo
// texture (viền neon), tóc VÀNG có highlight vàng óng — nổi nhưng không
// lòe loẹt, không cháy sáng. Spotlight riêng trong scene.js làm phần
// còn lại. Export để harness kiểm chứng được.
export function brightenPoleModelMaterials(modelRoot) {
  modelRoot.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.isMeshStandardMaterial) continue;
      if (m.name.includes('bikini') || m.name.includes('sportsuit')) {
        m.emissive = new THREE.Color(0x8a2be2);
        if (m.map) m.emissiveMap = m.map;
        m.emissiveIntensity = 0.3;
      } else if (m.name.includes('long01')) {
        m.emissive = new THREE.Color(0x8a6a20); // highlight vàng óng cho tóc vàng
        if (m.map) m.emissiveMap = m.map;
        m.emissiveIntensity = 0.18;
      } else if (m.name.includes('body')) {
        m.color.setRGB(1.12, 1.1, 1.08);
      }
    }
  });
}

// Temp dùng chung cho _syncPoleHead (tránh cấp phát mỗi frame).
const _poleHeadPos = new THREE.Vector3();
const _poleHeadQuat = new THREE.Quaternion();
const _poleGroupQuat = new THREE.Quaternion();

// Hình học dùng chung cho mọi dancer (rẻ, không tạo lại mỗi người).
const GEO = {
  head: null,
  hair: null,
  body: null,
  shorts: null,
  arm: null,
  sleeve: null,
  leg: null,
  chain: null,
  chainCollar: null,
  chainPendant: null,
  crownBand: null,
  crownSpike: null,
  crownJewel: null,
};

function sharedGeometries() {
  if (GEO.head) return GEO;
  const d = CONFIG.dancers;
  const c = d.chibi;
  GEO.head = new THREE.SphereGeometry(d.headRadius, 24, 18);
  // Tóc vuốt keo: vẫn nắp cầu như cũ (theta ngắn hơn, nghiêng hẳn về
  // sau lúc gắn mesh) — gọn gàng, trán thoáng, không lòa xòa trước mặt.
  GEO.hair = new THREE.SphereGeometry(c.hairRadius, 24, 12, 0, Math.PI * 2, 0, c.hairThetaLength);
  GEO.body = new THREE.CylinderGeometry(d.bodyRadius, d.bodyRadius * 1.1, d.bodyHeight, 10);
  GEO.shorts = new THREE.CylinderGeometry(d.bodyRadius, d.bodyRadius * 1.08, 0.3, 10);
  GEO.arm = new THREE.CylinderGeometry(d.armRadius, d.armRadius * 0.9, d.armLength, 8);
  GEO.sleeve = new THREE.CylinderGeometry(d.armRadius * 1.35, d.armRadius * 1.35, 0.14, 8);
  GEO.leg = new THREE.CylinderGeometry(d.legRadius, d.legRadius * 0.9, d.legLength, 8);
  // Dây chuyền vàng: vòng mảnh quanh cổ + vòng cổ viền áo + mặt dây
  // nhỏ trước ngực (tinh tế, không thô — polish 02:40).
  const chain = c.chain;
  GEO.chain = new THREE.TorusGeometry(chain.torusRadius, chain.torusTube, 8, 24);
  GEO.chainCollar = new THREE.TorusGeometry(chain.collarRadius, chain.collarTube, 8, 28);
  GEO.chainPendant = new THREE.OctahedronGeometry(chain.pendantRadius);
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

// ---- Mặt Khá Bảnh vẽ bằng canvas texture (dùng chung cho mọi dancer) ----
// Ánh xạ UV của SphereGeometry (flipY mặc định): mặt trước (+z) nằm ở
// u = 0.25, tức x = 1/4 chiều rộng canvas; đỉnh đầu ở y = 0 của canvas.
// Mắt/miệng vẽ quanh vùng đó để không bị kéo méo ra sau đầu.
// MỌI biến thể đều đeo kính đen (lệnh 02:36): kính vẽ 1 lần bằng helper
// dùng chung cho cân đối; nét vẽ mảnh, sạch, không lem/chồng nét
// (polish 02:40) — lông mày luôn nằm TRÊN kính, miệng nằm DƯỚI kính.
function makeFaceTexture(variant) {
  const size = CONFIG.dancers.chibi.faceCanvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const INK = CONFIG.dancers.chibi.faceLineColor;
  const LW = CONFIG.dancers.chibi.faceLineWidth || 8;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = LW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = size * 0.25;
  const eyeY = size * 0.47;
  const eyeDX = size * 0.09;
  const browY = size * 0.41;
  const mouthY = size * 0.57;

  const brow = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y + r, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  };
  // Lông mày thẳng, ngầu (không cong).
  const flatBrow = (x, y, r) => {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y - 4);
    ctx.stroke();
  };
  // Đường miệng cười: vòm cong ∪.
  const smile = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.4, r, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  };

  // Kính đen: 2 mắt kính đặc + vệt sáng chéo + cầu nối + càng kính.
  // Hình học cố định cho mọi biến thể nên kính luôn cân đối, sắc nét.
  const drawShades = () => {
    ctx.save();
    ctx.fillStyle = INK;
    for (const sx of [-1, 1]) {
      const x0 = cx + sx * eyeDX - 38;
      ctx.fillRect(x0, eyeY - 24, 76, 48);
      // Vệt sáng chéo trên mắt kính (1 vệt mỗi bên, không chồng nét).
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x0 + 12, eyeY + 20);
      ctx.lineTo(x0 + 26, eyeY + 20);
      ctx.lineTo(x0 + 14, eyeY - 20);
      ctx.lineTo(x0 + 2, eyeY - 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
    }
    ctx.restore();
    // Cầu nối + càng kính (nét 10, không chạm lông mày).
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(cx - eyeDX + 38, eyeY - 2);
    ctx.lineTo(cx + eyeDX - 38, eyeY - 2);
    ctx.moveTo(cx - eyeDX - 38, eyeY - 6);
    ctx.lineTo(cx - eyeDX - 62, eyeY - 12);
    ctx.moveTo(cx + eyeDX + 38, eyeY - 6);
    ctx.lineTo(cx + eyeDX + 62, eyeY - 12);
    ctx.stroke();
    ctx.lineWidth = LW;
  };

  if (variant === 'kinh-cuoi') {
    // Kính đen + cười tươi: lông mày cong, miệng cười khép.
    brow(cx - eyeDX, browY - 22, 30);
    brow(cx + eyeDX, browY - 22, 30);
    drawShades();
    smile(cx, mouthY, 26);
  } else if (variant === 'kinh-nhe-rang') {
    // Kính đen + cười nhe răng: miệng hở răng trắng có kẻ răng.
    brow(cx - eyeDX, browY - 22, 30);
    brow(cx + eyeDX, browY - 22, 30);
    drawShades();
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
    ctx.lineWidth = LW;
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
  } else if (variant === 'kinh-ha') {
    // Kính đen + cười há to: miệng há đen có răng trắng.
    brow(cx - eyeDX, browY - 22, 30);
    brow(cx + eyeDX, browY - 22, 30);
    drawShades();
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
  } else if (variant === 'kinh-khay') {
    // Kính đen + cười khẩy lệch, một lông mày nhướng.
    brow(cx - eyeDX, browY - 22, 30);
    brow(cx + eyeDX, browY - 38, 26);
    drawShades();
    ctx.beginPath();
    ctx.moveTo(cx - 44, mouthY + 2);
    ctx.quadraticCurveTo(cx + 8, mouthY + 24, cx + 44, mouthY - 10);
    ctx.stroke();
  } else if (variant === 'kinh-ngau') {
    // Kính đen + mặt ngầu: lông mày thẳng, miệng ngang.
    flatBrow(cx - eyeDX, browY - 22, 30);
    flatBrow(cx + eyeDX, browY - 22, 30);
    drawShades();
    ctx.beginPath();
    ctx.moveTo(cx - 42, mouthY + 4);
    ctx.lineTo(cx + 42, mouthY + 4);
    ctx.stroke();
  } else if (variant === 'kinh-nhay') {
    // Kính đen + nháy mắt: một lông mày nhướng cao, miệng cười lệch.
    brow(cx - eyeDX, browY - 22, 30);
    brow(cx + eyeDX, browY - 44, 26);
    drawShades();
    ctx.beginPath();
    ctx.moveTo(cx - 48, mouthY + 6);
    ctx.quadraticCurveTo(cx + 6, mouthY + 22, cx + 52, mouthY - 14);
    ctx.stroke();
  } else if (variant === 'kinh-ngac') {
    // Kính đen + ngạc nhiên: 2 lông mày nhướng cao, miệng há hình O.
    brow(cx - eyeDX, browY - 40, 30);
    brow(cx + eyeDX, browY - 40, 30);
    drawShades();
    ctx.beginPath();
    ctx.arc(cx, mouthY + 6, 28, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 'kinh-leu' (mặc định): kính đen + cười lè lưỡi tinh nghịch.
    brow(cx - eyeDX, browY - 22, 30);
    brow(cx + eyeDX, browY - 38, 26);
    drawShades();
    // Lưỡi hồng vẽ TRƯỚC, nét cười đè lên mép trên (không chồng nét).
    ctx.fillStyle = '#ff7d9c';
    ctx.beginPath();
    ctx.arc(cx, mouthY + 14, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    smile(cx, mouthY, 26);
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
    // Tóc vuốt keo có độ bóng nhẹ (polish 02:40): MeshPhongMaterial với
    // specular + shininess vừa phải, vẫn rẻ trên máy yếu (1 material chung).
    const c = CONFIG.dancers.chibi;
    hairMatCache = new THREE.MeshPhongMaterial({
      color: c.hairColor,
      specular: c.hairSpecular,
      shininess: c.hairShininess,
    });
  }
  return hairMatCache;
}

// Vật liệu vàng dây chuyền/viền cổ: vàng phát sáng VỪA (tinh tế, không
// thô như vương miện) — dùng chung cho vòng cổ + viền cổ + mặt dây.
let chainGoldMatCache = null;
function chainGoldMaterial() {
  if (!chainGoldMatCache) {
    const chain = CONFIG.dancers.chibi.chain;
    chainGoldMatCache = new THREE.MeshLambertMaterial({
      color: chain.goldColor,
      emissive: chain.goldEmissive,
      emissiveIntensity: chain.goldEmissiveIntensity,
    });
  }
  return chainGoldMatCache;
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
// Top donor đã rời live (hết 10 phút ân hạn, chibi đã xóa khỏi sàn):
// loại khỏi bảng xếp hạng lồng sắt để top mới lên thay (lệnh 02:22).
// Xóa khỏi tập này khi họ quay lại xem (addOrGet/markActive).
const departedDonorIds = new Set();

export function selectTopDonor(giftTotals, currentId) {
  if (!giftTotals || giftTotals.size === 0) return null;
  let topId = null;
  let topTotal = -1;
  for (const [id, entry] of giftTotals) {
    if (departedDonorIds.has(String(id))) continue;
    if (entry && entry.total > topTotal) {
      topTotal = entry.total;
      topId = id;
    }
  }
  // Hòa điểm thì giữ người đang đứng (kể cả khi người đó đã rời sàn
  // nhưng chưa hết ân hạn — currentId lúc đó vẫn là người đang đứng).
  // Người đã rời hẳn (trong departedDonorIds) thì không giữ nữa.
  const currentKey = currentId == null ? null : String(currentId);
  if (currentKey != null && !departedDonorIds.has(currentKey)) {
    const currentTotal = giftTotals.get(currentKey);
    if (currentTotal && currentTotal.total >= topTotal) return currentKey;
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

// Mặt người múa cột (lệnh 02:21 + tả thực 02:44): nữ trưởng thành,
// vẽ tả thực hơn — mắt có tròng đen/lông mi/lông mày nâu mềm, mũi có
// bóng nhẹ, môi có màu + chuyển sắc, má hồng nhẹ — KHÔNG dùng nét vẽ
// đen kiểu meme. Cùng quy ước UV với makeFaceTexture: mặt trước (+z)
// nằm ở u = 0.25. Chỉ dùng lệnh canvas cơ bản (arc/path/fill/stroke)
// để chạy được cả trong harness Node.
function makePoleFaceTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pc = CONFIG.dancers.poleDancer;
  ctx.fillStyle = `#${pc.skinColor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);
  const cx = size * 0.25;
  const eyeY = size * 0.46;
  const eyeDX = size * 0.085;
  const BROWN = '#3a2718';
  const LASH = '#241408';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Lông mày nâu mềm: vòm cong mảnh, đầu nhạt dần (vẽ 2 lượt alpha).
  const brow = (x) => {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, eyeY - size * 0.055 + size * 0.045, size * 0.045, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  };
  brow(cx - eyeDX);
  brow(cx + eyeDX);

  // Mắt hạnh nhân tả thực: lòng trắng, tròng nâu + con ngươi + điểm
  // sáng, mi trên đậm có đuôi, nếp mí + mi dưới mờ.
  const eye = (x) => {
    // Lòng trắng hình hạnh nhân.
    ctx.fillStyle = '#fdfdf6';
    ctx.beginPath();
    ctx.moveTo(x - 13, eyeY);
    ctx.quadraticCurveTo(x, eyeY - 8, x + 13, eyeY);
    ctx.quadraticCurveTo(x, eyeY + 7, x - 13, eyeY);
    ctx.closePath();
    ctx.fill();
    // Tròng mắt nâu + con ngươi + điểm sáng.
    ctx.fillStyle = '#4a2e18';
    ctx.beginPath();
    ctx.arc(x, eyeY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14100c';
    ctx.beginPath();
    ctx.arc(x, eyeY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 2, eyeY - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Mi trên đậm, đuôi mắt hất nhẹ.
    ctx.strokeStyle = LASH;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, eyeY, 13, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 12, eyeY - 3);
    ctx.lineTo(x + 18, eyeY - 6);
    ctx.stroke();
    // Nếp mí trên + mi dưới mờ.
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, eyeY - 3, 15, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, eyeY + 1, 12, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  };
  eye(cx - eyeDX);
  eye(cx + eyeDX);

  // Mũi: bóng nhẹ 2 bên sống mũi + lỗ mũi mờ + điểm sáng sống mũi.
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#8a5a40';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 6, eyeY + 12);
  ctx.quadraticCurveTo(cx - 4, eyeY + 24, cx - 5, eyeY + 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 6, eyeY + 12);
  ctx.quadraticCurveTo(cx + 4, eyeY + 24, cx + 5, eyeY + 28);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#6a4028';
  ctx.beginPath();
  ctx.arc(cx - 5, eyeY + 29, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 5, eyeY + 29, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, eyeY + 8);
  ctx.lineTo(cx, eyeY + 22);
  ctx.stroke();
  ctx.restore();

  // Má hồng nhẹ, mềm (2 lớp alpha thấp chồng nhau).
  ctx.fillStyle = 'rgba(255, 110, 140, 0.16)';
  ctx.beginPath();
  ctx.arc(cx - eyeDX * 1.7, eyeY + size * 0.07, size * 0.042, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeDX * 1.7, eyeY + size * 0.07, size * 0.042, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 110, 140, 0.1)';
  ctx.beginPath();
  ctx.arc(cx - eyeDX * 1.7, eyeY + size * 0.07, size * 0.058, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeDX * 1.7, eyeY + size * 0.07, size * 0.058, 0, Math.PI * 2);
  ctx.fill();

  // Môi: hình môi đầy, viền sẫm + chuyển sắc (lớp hồng sáng ở giữa).
  const lipY = eyeY + size * 0.1;
  const lipPath = (s) => {
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, lipY);
    ctx.quadraticCurveTo(cx - 7 * s, lipY - 6 * s, cx, lipY - 3 * s);
    ctx.quadraticCurveTo(cx + 7 * s, lipY - 6 * s, cx + 14 * s, lipY);
    ctx.quadraticCurveTo(cx + 7 * s, lipY + 9 * s, cx, lipY + 7 * s);
    ctx.quadraticCurveTo(cx - 7 * s, lipY + 9 * s, cx - 14 * s, lipY);
    ctx.closePath();
  };
  lipPath(1);
  ctx.fillStyle = '#c2275a';
  ctx.fill();
  ctx.strokeStyle = '#8f1a42';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.35;
  lipPath(0.6);
  ctx.fillStyle = '#ff6d8f';
  ctx.fill();
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

function makeNameSprite(displayName, scaleMult = 1) {
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
  sprite.scale.set(
    CONFIG.dancers.nameLabelWidth * scaleMult,
    CONFIG.dancers.nameLabelHeight * scaleMult,
    1,
  );
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
    // Chibi của top donor đang đứng TRONG LỒNG SẮT (lệnh 02:22 — bàn DJ
    // từ 02:22 chỉ còn làm cảnh, không đặt dancer ở đó nữa). Chibi này
    // TẠM ẨN khỏi sàn; nhân vật múa cột trong lồng mang tên + vương miện
    // của họ. null = chưa có top donor (bàn... lồng ở trạng thái mặc định).
    this.djDancer = null;
    // Vương miện vàng: CHỈ 1 chiếc duy nhất, gắn lên đầu NGƯỜI MÚA CỘT
    // khi có top donor. null = chưa có ai đội (chưa có gift). Tạo lười
    // ở _getCrownGroup().
    this.crownGroup = null;
    // Giới hạn đi dạo (vùng sàn + khu cấm): tính lười ở _wanderLimits().
    this._wanderLimitsCache = null;
    // Người múa cột cố định trong lồng (không phải viewer, không tính
    // vào maxDancers, không chiếm slot — xem _createPoleDancer).
    this.poleDancer = this._createPoleDancer();
  }

  _buildSlots() {
    // Vòng ellipse quanh lồng nhỏ (lệnh 02:20): 12 slot, lệch nửa bước
    // góc để không slot nào chắn chính diện lồng (giữa 2 slot trước
    // mặt là khoảng trống nhìn thẳng vào người múa cột).
    const ring = CONFIG.dancers.slotRing;
    const slots = [];
    for (let i = 0; i < CONFIG.dancers.maxDancers; i += 1) {
      const a = ((i + 0.5) / CONFIG.dancers.maxDancers) * Math.PI * 2;
      slots.push(new THREE.Vector3(
        ring.centerX + Math.cos(a) * ring.radiusX,
        0,
        ring.centerZ + Math.sin(a) * ring.radiusZ,
      ));
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

  // Ghi nhận viewer còn xem (mọi loại event trừ 'leave' đều gọi từ
  // handleEvent). Mọi tương tác đều hủy trạng thái "đã rời" (vào lại
  // phòng / bình luận / thả tim sau tín hiệu rời). Im lặng KHÔNG BAO GIỜ
  // tự đuổi khỏi sàn (user lệnh 00:43) — chỉ tín hiệu rời + 10 phút
  // ân hạn mới cho rời (xem update()).
  markActive(uniqueId, now) {
    // Quay lại xem → không còn "đã rời": cho lại vào bảng xếp hạng lồng.
    departedDonorIds.delete(String(uniqueId));
    const dancer = this.dancers.get(String(uniqueId));
    if (dancer) {
      dancer.lastActivityAt = now;
      dancer.leftAt = null;
    }
  }

  // Tín hiệu viewer rời live: bắt đầu đếm ân hạn, KHÔNG xóa ngay.
  // Tín hiệu rời đầu tiên giữ mốc; các tín hiệu rời lặp lại không dời mốc.
  markLeft(uniqueId, now) {
    const dancer = this.dancers.get(String(uniqueId));
    if (dancer && dancer.leftAt == null && dancer.mode !== 'leaving') {
      dancer.leftAt = now;
    }
  }

  addOrGet(user) {
    const id = String(user.uniqueId);
    // Xuất hiện lại (vào/bình luận/thả tim/tặng) → không còn "đã rời".
    departedDonorIds.delete(id);
    const existing = this.dancers.get(id);
    if (existing) return existing;
    if (this.dancers.size >= CONFIG.dancers.maxDancers) {
      // Sàn đầy: đuổi người cũ nhất KHÔNG ở bục VIP, KHÔNG phải chibi
      // của top donor đang đứng lồng (ẩn), KHÔNG đang rời sàn.
      const oldest = [...this.dancers.values()].find((d) => d.mode !== 'vip' && d !== this.djDancer && d.mode !== 'leaving');
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

  // ---- Người múa cột trong lồng (lệnh 02:20/02:21/02:22 + tả thực 02:44) ----
  // Nhân vật RIÊNG BIỆT, cố định, không phải viewer: nữ trưởng thành
  // TỶ LỆ NGƯỜI THẬT (đầu ~1/7,5 chiều cao, khớp vai/khuỷu/hông/gối/
  // cổ chân 2 đoạn, da/tóc/mặt tả thực procedural) — KHÔNG dùng mẫu chibi.
  // Không tính vào maxDancers, không chiếm slot, không DJ/VIP, không bị
  // đuổi sàn; chạy chung vòng update() (mode 'pole'), dùng chung nhịp nhạc.
  // Nhãn tên mặc định "Múa cột", không avatar; khi có top donor thì mang
  // tên + vương miện của top donor (setDjDancer), chibi riêng tạm ẩn.
  // Người múa cột (lệnh 02:20/02:21/02:22 + mẫu người thật 03/11):
  // shell đồng bộ + nạp model GLB bất đồng bộ. headGroup tạo 1 lần,
  // không bao giờ thay (neo vương miện + tên); đường model đồng bộ
  // headGroup theo xương đầu mỗi frame, đường procedural dựng đầu
  // procedural vào đúng headGroup này. Lỗi tải -> body procedural cũ.
  _createPoleDancer() {
    const pc = CONFIG.dancers.poleDancer;
    const cage = CONFIG.scene.cage;
    const group = new THREE.Group();
    group.position.set(cage.centerX, 0, cage.centerZ);
    const headGroup = new THREE.Group();
    group.add(headGroup);
    const nameSprite = makeNameSprite(pc.defaultName, pc.labelScale || 1);
    nameSprite.position.set(0, pc.nameSpriteY, 0.02);
    group.add(nameSprite);
    this.scene.add(group);
    // Vòng sáng dưới chân cô múa cột (user lệnh 06:13: làm nổi bật mẫu
    // nữ). Mesh emissive thuần (Basic = luôn sáng), KHÔNG thêm đèn; đặt
    // ở scene, KHÔNG phải con của group — group đi vòng quanh cột mỗi
    // frame nên vòng sáng phải đứng yên ở tâm lồng.
    const ringCfg = pc.glowRing;
    if (ringCfg) {
      const cageGlow = new THREE.Mesh(
        new THREE.RingGeometry(ringCfg.innerRadius, ringCfg.outerRadius, 40),
        new THREE.MeshBasicMaterial({
          color: ringCfg.color,
          transparent: true,
          opacity: ringCfg.opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      cageGlow.rotation.x = -Math.PI / 2;
      cageGlow.position.set(cage.centerX, ringCfg.y, cage.centerZ);
      this.scene.add(cageGlow);
    }
    const dancer = {
      user: { name: pc.defaultName, uniqueId: '__pole__', avatar: '' },
      group,
      headGroup,
      hairBack: null,
      armL: null,
      armR: null,
      elbL: null,
      elbR: null,
      legL: null,
      legR: null,
      kneeL: null,
      kneeR: null,
      ankL: null,
      ankR: null,
      nameSprite,
      avatarSprite: null,
      avatarTexture: null,
      nameBaseY: pc.nameSpriteY,
      shirtMat: null,
      headMesh: null,
      materials: [],
      mode: 'pole',
      energy: 1,
      phaseOffset: 0,
      enterProgress: 1,
      leaveProgress: 0,
      lastActivityAt: 0,
      leftAt: null,
      orbitUntil: 0,
      orbitAngle: 0,
      jumpUntil: 0,
      jumpStartedAt: 0,
      armsUpStartedAt: 0,
      armsUpUntil: 0,
      vipUntil: 0,
      baseY: 0,
      skillKind: null,
      skillStartedAt: 0,
      skillUntil: 0,
      somersaultStartedAt: 0,
      somersaultUntil: 0,
      somersaultGroundY: 0,
      somersaultFired: false,
      somersaultAngle: 0,
      moveIndex: 0,
      moveStartBar: 0,
      moveBars: 4,
      moveDir: 1,
      // Trạng thái múa cột riêng (đường model GLB): đứng chính diện lồng,
      // nhảy tại chỗ hướng ra ngoài; thỉnh thoảng xoay 1 vòng (xem nhánh
      // pole trong update()). poleCur/poseBar chỉ đường procedural dùng.
      poleAngle: pc.idleAngle || Math.PI / 2,
      polePoseBar: -1,
      polePoseIndex: 0,
      poleCur: null,
      poleLeanZ: 0,
      poleHeadSway: 0,
      poleHairSway: 0,
      wanderHeading: 0,
      wanderTarget: null,
      wanderRetargetAt: 0,
      wanderSpeed: 0,
      stepOffset: 0,
      stepOffsetPrev: 0,
      // Model người thật (GLB + clip mocap) — xem _loadPoleModel.
      modelReady: false,
      proceduralBuilt: false,
      mixer: null,
      modelRoot: null,
      headBone: null,
      poleClips: null,
      poleActions: null,
      poleSpinState: 'idle', // 'idle' | 'spin' | 'recover'
      poleSpinStartBar: 0,
      poleSpinFromAngle: 0,
      poleSpinLastBar: -1,
      poleSpinRecoverAt: 0,
      poleFacing: 0, // 0 = hướng ra ngoài, 1 = quay mặt vào cột
    };
    this._loadPoleModel(dancer).catch((err) => {
      console.warn('[DancerManager] model múa cột lỗi, dùng procedural:', err);
      this._buildProceduralPoleBody(dancer);
    });
    return dancer;
  }

  // Body procedural cũ (tả thực 02:44) — DỰ PHÒNG khi GLB/clip không
  // tải được. Chỉ dựng phần thân vào dancer.group / dancer.headGroup đã
  // có sẵn; không đụng state (tên, vương miện, skill, góc đứng).
  _buildProceduralPoleBody(dancer) {
    if (dancer.proceduralBuilt || dancer.modelReady) return;
    dancer.proceduralBuilt = true;
    const pc = CONFIG.dancers.poleDancer;
    const group = dancer.group;
    const headGroup = dancer.headGroup;

    const materials = [];
    const track = (mat) => {
      mat.transparent = true;
      materials.push(mat);
      return mat;
    };
    // Da shading mềm (Phong, specular thấp) — không trắng bệch phẳng.
    const skinMat = track(new THREE.MeshPhongMaterial({
      color: pc.skinColor, specular: pc.skinSpecular, shininess: pc.skinShininess,
    }));
    const topMat = track(new THREE.MeshLambertMaterial({
      color: pc.topColor, emissive: pc.topEmissive, emissiveIntensity: 0.55,
    }));
    const shortsMat = track(new THREE.MeshLambertMaterial({ color: pc.shortsColor }));
    const bootMat = track(new THREE.MeshLambertMaterial({ color: pc.bootColor }));
    const hairMat = track(new THREE.MeshPhongMaterial({
      color: pc.hairColor, specular: pc.hairSpecular, shininess: pc.hairShininess,
    }));
    const highlightMat = track(new THREE.MeshLambertMaterial({ color: pc.hairHighlightColor }));
    const faceMat = track(new THREE.MeshLambertMaterial({ map: makePoleFaceTexture() }));

    // Chân người thật, 2 đoạn có khớp: đùi (pivot hông) → gối → cẳng
    // chân + bắp chân → cổ chân → bàn chân. Gót chạm sàn.
    const mkLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.09, pc.hipY, 0);
      const thighGeo = new THREE.CylinderGeometry(pc.thighRadius, pc.thighRadius * 0.8, pc.thighLength, 10);
      const thigh = new THREE.Mesh(thighGeo, skinMat);
      thigh.position.y = -pc.thighLength / 2;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -pc.thighLength;
      hip.add(knee);
      const shinGeo = new THREE.CylinderGeometry(pc.shinRadius, pc.shinRadius * 0.75, pc.shinLength, 10);
      const shin = new THREE.Mesh(shinGeo, skinMat);
      shin.position.y = -pc.shinLength / 2;
      knee.add(shin);
      // Bắp chân: cầu dẹt sau cẳng chân.
      const calf = new THREE.Mesh(new THREE.SphereGeometry(pc.calfRadius, 10, 8), skinMat);
      calf.scale.set(0.9, 1.4, 0.9);
      calf.position.set(0, -0.13, -0.02);
      knee.add(calf);
      const ankle = new THREE.Group();
      ankle.position.y = -pc.shinLength;
      knee.add(ankle);
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(pc.footWidth, pc.footHeight, pc.footLength), bootMat,
      );
      foot.position.set(0, -0.015, 0.05);
      ankle.add(foot);
      return { hip, knee, ankle };
    };
    const legL = mkLeg(-1);
    const legR = mkLeg(1);
    group.add(legL.hip, legR.hip);

    // Quần short diễn + eo trần (đồ 2 mảnh) + áo bandeau + đai lưng neon.
    const hips = new THREE.Mesh(
      new THREE.CylinderGeometry(pc.hipsRadiusTop, pc.hipsRadiusBottom, pc.hipsHeight, 14),
      shortsMat,
    );
    hips.position.y = pc.hipsY;
    group.add(hips);
    const waist = new THREE.Mesh(
      new THREE.CylinderGeometry(pc.waistRadiusTop, pc.waistRadiusBottom, pc.waistHeight, 14),
      skinMat,
    );
    waist.position.y = pc.waistY;
    group.add(waist);
    const chest = new THREE.Mesh(
      new THREE.CylinderGeometry(pc.chestRadiusTop, pc.chestRadiusBottom, pc.chestHeight, 14),
      topMat,
    );
    chest.position.y = pc.chestY;
    group.add(chest);
    const waistband = new THREE.Mesh(
      new THREE.TorusGeometry(pc.waistbandRadius, pc.waistbandTube, 8, 24), topMat,
    );
    waistband.rotation.x = Math.PI / 2;
    waistband.position.y = pc.waistbandY;
    group.add(waistband);
    // Ngực: 2 cầu cùng chất liệu áo, hơi hướng về trước.
    const bustGeo = new THREE.SphereGeometry(pc.bustRadius, 14, 10);
    const bustL = new THREE.Mesh(bustGeo, topMat);
    const bustR = new THREE.Mesh(bustGeo, topMat);
    bustL.position.set(-pc.bustDX, pc.bustY, pc.bustDZ);
    bustR.position.set(pc.bustDX, pc.bustY, pc.bustDZ);
    group.add(bustL, bustR);
    // Cổ: nối thân với đầu.
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(pc.neckRadius, pc.neckRadius * 1.1, pc.neckHeight, 10),
      skinMat,
    );
    neck.position.y = pc.neckY;
    group.add(neck);

    // Tay người thật, 2 đoạn có khớp: cánh tay trên (pivot vai) → khuỷu
    // → cẳng tay → bàn tay.
    const mkArm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * pc.shoulderDX, pc.shoulderY, 0);
      const upperGeo = new THREE.CylinderGeometry(pc.upperArmRadius, pc.upperArmRadius * 0.88, pc.upperArmLength, 8);
      const upper = new THREE.Mesh(upperGeo, skinMat);
      upper.position.y = -pc.upperArmLength / 2;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -pc.upperArmLength;
      shoulder.add(elbow);
      const foreGeo = new THREE.CylinderGeometry(pc.forearmRadius, pc.forearmRadius * 0.85, pc.forearmLength, 8);
      const fore = new THREE.Mesh(foreGeo, skinMat);
      fore.position.y = -pc.forearmLength / 2;
      elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(pc.handRadius, 10, 8), skinMat);
      hand.scale.set(0.8, 1.4, 0.9);
      hand.position.y = -pc.forearmLength - 0.02;
      elbow.add(hand);
      return { shoulder, elbow };
    };
    const armL = mkArm(-1);
    const armR = mkArm(1);
    group.add(armL.shoulder, armR.shoulder);

    // Đầu tỷ lệ người thật + tóc dài nhiều lớp (headGroup để gắn vương
    // miện như cũ; tóc sau lưng nằm trong nhóm riêng có pivot ở đỉnh đầu
    // để đung đưa mềm theo người).
    headGroup.position.set(0, pc.headCenterY, 0);
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(pc.headRadius, 24, 18), faceMat,
    );
    headGroup.add(headMesh);
    // Mũ tóc ôm dáng đầu: phủ đỉnh + gáy, nghiêng về sau, chân tóc cao.
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(pc.headRadius + 0.01, 24, 16, 0, Math.PI * 2, 0, 1.9),
      hairMat,
    );
    hairCap.position.set(0, 0.01, -0.015);
    hairCap.rotation.x = -0.55;
    headGroup.add(hairCap);
    // Tóc xõa lưng: tấm tóc thuôn, dẹt, tới eo + 3 sợi highlight nâu
    // sáng trên mặt tấm tóc — cùng đung đưa trong nhóm hairBack.
    const hairBack = new THREE.Group();
    hairBack.position.set(0, 0.07, -0.055);
    const backHair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.08, pc.hairLength, 10), hairMat,
    );
    backHair.scale.z = 0.5;
    backHair.position.set(0, -pc.hairLength / 2 + 0.03, -0.02);
    hairBack.add(backHair);
    const hlGeo = new THREE.CylinderGeometry(0.012, 0.01, pc.hairLength * 0.75, 5);
    for (const hx of [-0.045, 0, 0.045]) {
      const hl = new THREE.Mesh(hlGeo, highlightMat);
      hl.position.set(hx, -pc.hairLength * 0.36, 0.028);
      hairBack.add(hl);
    }
    headGroup.add(hairBack);
    // 2 lọn tóc mai ôm mặt, thon dần, hơi nghiêng ra ngoài.
    const strandGeo = new THREE.CylinderGeometry(0.03, 0.022, 0.42, 6);
    const strandL = new THREE.Mesh(strandGeo, hairMat);
    const strandR = new THREE.Mesh(strandGeo, hairMat);
    strandL.position.set(-0.105, -0.14, 0.02);
    strandR.position.set(0.105, -0.14, 0.02);
    strandL.rotation.z = 0.06;
    strandR.rotation.z = -0.06;
    headGroup.add(strandL, strandR);

    // Ghi ref body procedural lên dancer (shell đã tạo group/tên/state).
    dancer.hairBack = hairBack;
    dancer.armL = armL.shoulder;
    dancer.armR = armR.shoulder;
    dancer.elbL = armL.elbow;
    dancer.elbR = armR.elbow;
    dancer.legL = legL.hip;
    dancer.legR = legR.hip;
    dancer.kneeL = legL.knee;
    dancer.kneeR = legR.knee;
    dancer.ankL = legL.ankle;
    dancer.ankR = legR.ankle;
    dancer.headMesh = headMesh;
    dancer.shirtMat = topMat;
    dancer.materials = materials;
  }

  // ---- Người múa cột: model người thật (GLB + clip mocap) ----
  // Nạp GLTFLoader qua URL đầy đủ (import map chỉ có 'three', không được
  // đụng index.html). Dynamic import + try/catch: lỗi gì cũng rơi về
  // body procedural, live không bao giờ trống lồng.
  async _loadPoleModel(dancer) {
    const pc = CONFIG.dancers.poleDancer;
    const cfg = pc.model;
    if (!cfg || !cfg.glb) {
      this._buildProceduralPoleBody(dancer);
      return;
    }
    const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const [gltf, idleJson, skillJson] = await Promise.all([
      loader.loadAsync(cfg.glb),
      fetch(cfg.idleClip).then((r) => {
        if (!r.ok) throw new Error('idle clip HTTP ' + r.status);
        return r.json();
      }),
      fetch(cfg.skillClip).then((r) => {
        if (!r.ok) throw new Error('skill clip HTTP ' + r.status);
        return r.json();
      }),
    ]);
    const idleData = buildPoleClipData(idleJson);
    const skillData = buildPoleClipData(skillJson);
    const modelRoot = gltf.scene;
    // Phóng to lên xíu (CONFIG model.scale): scale quanh gốc model ở
    // gót chân nên chân vẫn chạm sàn; xương/tên/vương miện theo kịp vì
    // _syncPoleHead đọc world position.
    if (cfg.scale && cfg.scale !== 1) modelRoot.scale.setScalar(cfg.scale);
    // Mọi xương clip cần đều phải có trong rig, không thì lỗi rõ ràng.
    const need = new Set([
      ...idleData.tracks.map((t) => t.bone),
      ...skillData.tracks.map((t) => t.bone),
    ]);
    for (const name of need) {
      if (!modelRoot.getObjectByName(name)) throw new Error('rig thiếu xương ' + name);
    }
    const headBone = modelRoot.getObjectByName('head');
    if (!headBone) throw new Error('rig thiếu xương head');
    dancer.group.add(modelRoot);
    dancer.modelRoot = modelRoot;
    dancer.headBone = headBone;
    dancer.mixer = new THREE.AnimationMixer(modelRoot);
    const mkClip = (data, name) => new THREE.AnimationClip(
      name,
      data.duration,
      data.tracks.map((t) => new THREE.QuaternionKeyframeTrack(t.bone + '.quaternion', t.times, t.values)),
    );
    const idleAction = dancer.mixer.clipAction(mkClip(idleData, 'pole-idle'));
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    const skillAction = dancer.mixer.clipAction(mkClip(skillData, 'pole-skill'));
    skillAction.setLoop(THREE.LoopOnce, 1);
    skillAction.clampWhenFinished = true;
    dancer.poleClips = { idle: idleData, skill: skillData };
    dancer.poleActions = { idle: idleAction, skill: skillAction };
    dancer.modelReady = true;
    brightenPoleModelMaterials(modelRoot);
    idleAction.play();
    skillAction.play();
    skillAction.setEffectiveWeight(0);
    // Skill đã bắt đầu trước khi model tải xong (hiếm): chạy clip ngay.
    if (dancer.skillKind) this._playPoleSkill(dancer);
  }

  // Skill donate trên model GLB: clip múa cột đè lên idle loop, vừa đúng
  // thời lượng skill (timeScale), blend 2 chiều. Camera + pháo bông do
  // luồng skill chung lo (như cũ).
  _playPoleSkill(dancer) {
    if (!dancer.modelReady || !dancer.poleActions) return;
    const fade = CONFIG.dancers.poleDancer.model.crossfadeSeconds || 0.3;
    const dur = Math.max(0.5, dancer.skillUntil - dancer.skillStartedAt);
    const { idle, skill } = dancer.poleActions;
    skill.reset();
    skill.setEffectiveTimeScale(dancer.poleClips.skill.duration / dur);
    skill.fadeIn(fade);
    skill.play(); // bật lại action (fadeOut trước đó đã disable nó)
    idle.fadeOut(fade);
  }

  // Hết skill: về lại idle loop (clip idle vẫn chạy ngầm suốt skill).
  // BẪY three.js (đã kiểm chứng bằng probe): fadeOut xong thì action bị
  // enabled=false và time ĐÓNG BĂNG; fadeIn + play() KHÔNG bật lại được
  // (action vẫn "scheduled" nên _activateAction bỏ qua). Phải gán
  // enabled=true trực tiếp — giữ nguyên vị trí time, không reset loop.
  _stopPoleSkill(dancer) {
    if (!dancer.modelReady || !dancer.poleActions) return;
    const fade = CONFIG.dancers.poleDancer.model.crossfadeSeconds || 0.3;
    const { idle, skill } = dancer.poleActions;
    idle.enabled = true;
    idle.fadeIn(fade);
    idle.play();
    skill.fadeOut(fade);
  }

  // Bob dọc của clip đang chiếm ưu thế (idle loop hoặc skill): modelRoot
  // nhích lên/xuống theo đường cong rootY, mixer chỉ lo xoay khớp.
  _samplePoleRootY(dancer) {
    if (!dancer.modelReady || !dancer.poleClips) return 0;
    const { idle, skill } = dancer.poleActions;
    const useSkill = skill.getEffectiveWeight() > idle.getEffectiveWeight();
    const data = useSkill ? dancer.poleClips.skill : dancer.poleClips.idle;
    const action = useSkill ? skill : idle;
    if (!data || !data.rootY) return 0;
    let t = action.time;
    if (useSkill) t = Math.min(t, data.duration);
    else if (data.duration > 0) t = ((t % data.duration) + data.duration) % data.duration;
    return sampleRootYCurve(data.rootY, t);
  }

  // Neo vương miện: headGroup trùng xương đầu (cộng 0,06m lên trên),
  // theo mọi chuyển động của mixer — vương miện là con của headGroup.
  _syncPoleHead(dancer) {
    if (!dancer.headBone) return;
    const group = dancer.group;
    dancer.headBone.getWorldPosition(_poleHeadPos);
    _poleHeadPos.y += 0.06;
    dancer.headGroup.position.copy(group.worldToLocal(_poleHeadPos));
    dancer.headBone.getWorldQuaternion(_poleHeadQuat);
    group.getWorldQuaternion(_poleGroupQuat);
    dancer.headGroup.quaternion.copy(_poleGroupQuat.invert().multiply(_poleHeadQuat));
  }

  // Người múa cột có chạy chung vòng update/skill với viewer không? Chỉ
  // chấp nhận đúng object pole dancer (không qua map — không tính vào
  // maxDancers, không bị đuổi sàn).
  _ownsDancer(dancer) {
    return dancer === this.poleDancer
      || this.dancers.has(String(dancer.user.uniqueId));
  }

  _createDancer(user, slotIndex) {
    const d = CONFIG.dancers;
    const c = d.chibi;
    const group = new THREE.Group();
    const home = this.slots[slotIndex].clone();
    // Slot vòng quanh lồng đã tránh khu cấm; kẹp lại cho chắc (đi dạo
    // kẹp lại sau mỗi bước anyway).
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

    // Áo đen sang / tay chân trắng / quần short tối — kiểu Khá Bảnh.
    const shirtMat = track(new THREE.MeshLambertMaterial({ color: this._pick(c.shirtColors) }));
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
    // tay áo đen ngắn gắn cùng pivot.
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

    // Đầu + tóc vuốt keo chải ngược + mặt kính đen (vẽ sẵn, dùng chung).
    const headGroup = new THREE.Group();
    headGroup.position.y = c.headCenterY;
    const faceIndex = Math.floor(Math.random() * faceMaterials().length);
    const headMesh = new THREE.Mesh(this.geo.head, faceMaterials()[faceIndex]);
    const hair = new THREE.Mesh(this.geo.hair, hairMaterial());
    hair.position.set(...c.hairOffset);
    hair.rotation.x = c.hairTiltX;
    headGroup.add(headMesh, hair);

    // Dây chuyền vàng + viền cổ vàng (dùng chung geometry/material,
    // KHÔNG track vào materials — material dùng chung, không dispose riêng).
    const chainCfg = c.chain;
    const chainRing = new THREE.Mesh(this.geo.chain, chainGoldMaterial());
    chainRing.position.set(0, chainCfg.torusY, 0);
    chainRing.rotation.x = Math.PI / 2 + chainCfg.torusTilt;
    const collarRing = new THREE.Mesh(this.geo.chainCollar, chainGoldMaterial());
    collarRing.position.set(0, chainCfg.collarY, 0);
    collarRing.rotation.x = Math.PI / 2;
    const pendant = new THREE.Mesh(this.geo.chainPendant, chainGoldMaterial());
    pendant.position.set(0, chainCfg.pendantY, chainCfg.pendantZ);

    // Avatar + tên nổi TRÊN đầu (Sprite luôn quay về camera), không che mặt.
    const avatarTexture = makeAvatarTexture(user.avatar, user.name);
    const avatarMat = track(new THREE.MeshBasicMaterial({ map: avatarTexture, transparent: true }));
    const avatarSprite = new THREE.Sprite(avatarMat);
    avatarSprite.scale.set(d.avatarRadius * 2, d.avatarRadius * 2, 1);
    avatarSprite.position.y = c.avatarSpriteY;

    const nameSprite = makeNameSprite(user.name);
    nameSprite.position.y = c.nameSpriteY;
    group.add(legL, legR, shorts, body, armL, armR, headGroup, avatarSprite, nameSprite,
      chainRing, collarRing, pendant);

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
      // Lần tương tác gần nhất (cùng gốc thời gian với handleEvent `now`).
      lastActivityAt: performance.now() / 1000,
      // Mốc tín hiệu rời live (null = đang xem). Chỉ tín hiệu rời mới đặt.
      leftAt: null,
      orbitUntil: 0,
      orbitAngle: Math.random() * Math.PI * 2,
      jumpUntil: 0,
      jumpStartedAt: 0,
      // Lệnh chat "giơ tay": cờ thời gian như jump (đặt từ applyCommand).
      armsUpStartedAt: 0,
      armsUpUntil: 0,
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

  // "Đổi nv": đổi biểu cảm mặt kính đen + sắc độ áo đen (tóc vuốt keo giữ nguyên).
  randomize(dancer) {
    const mats = faceMaterials();
    dancer.faceIndex = Math.floor(Math.random() * mats.length);
    dancer.headMesh.material = mats[dancer.faceIndex];
    dancer.shirtMat.color.setHex(this._pick(CONFIG.dancers.chibi.shirtColors));
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
      // Chibi của top donor đang đứng lồng thì ở yên trong lồng (đi vòng
      // sẽ kéo khỏi lồng; người múa cột đã xoay quanh cột sẵn rồi).
      if (dancer === this.djDancer) return dancer;
      dancer.mode = 'orbit';
      dancer.orbitUntil = now + CONFIG.dancers.orbitDurationSeconds;
      this.boost(dancer, CONFIG.dancers.energyBoostChat);
    } else if (commandKey === 'armsUp') {
      // Lệnh "giơ tay": top donor đang đứng lồng thì NGƯỜI MÚA CỘT giơ
      // 2 tay lên (chibi riêng đang ẩn, giơ tay lên chibi thì không ai thấy).
      if (dancer === this.djDancer && this.poleDancer) {
        this.poleDancer.armsUpStartedAt = now;
        this.poleDancer.armsUpUntil = now + CONFIG.dancers.commandArmsUpDurationSeconds;
        this.boost(dancer, CONFIG.dancers.energyBoostChat);
        return dancer;
      }
      dancer.armsUpStartedAt = now;
      dancer.armsUpUntil = now + CONFIG.dancers.commandArmsUpDurationSeconds;
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
    // Top donor đang đứng lồng: hiệu ứng nhìn thấy được (vòng sáng,
    // skill, pháo bông) chạy trên NGƯỜI MÚA CỘT — chibi riêng đang ẩn,
    // chạy hiệu ứng lên chibi thì khán giả không thấy gì. Đổi nhân vật
    // vẫn áp lên chibi ẩn (lúc hiện lại thì thấy mặt/áo mới); lên bục
    // VIP thì bỏ (đang đứng lồng, xem sendToVip).
    const caged = dancer === this.djDancer && this.poleDancer;
    const fxTarget = caged ? this.poleDancer : dancer;
    if (effects.danceBoost) this.boost(dancer, giftBoost);
    if (effects.smallEffect && this.hooks.onRing) this.hooks.onRing(fxTarget.group.position);
    if (effects.changeCharacter) this.randomize(dancer);
    // Skill nhảy theo gift (CONFIG.skills): xếp hàng, skill tự lo camera +
    // pháo bông nên bỏ qua zoom/pháo bông tức thời để khỏi nhân đôi hiệu ứng.
    // Các hiệu ứng còn lại (vòng sáng, đổi nv, lên bục VIP) giữ nguyên.
    const totalDiamonds = Number(opts.totalDiamonds || 0);
    const skillKind = this._skillKindFor(opts.giftName || '', totalDiamonds);
    if (skillKind) {
      this.enqueueSkill(fxTarget, skillKind, now);
    } else {
      if (effects.cameraZoom && this.hooks.onCameraZoom) this.hooks.onCameraZoom();
      if (effects.fireworks && this.hooks.onFireworks) {
        this.hooks.onFireworks(fxTarget.group.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
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
    if (!this._ownsDancer(dancer) || dancer.mode === 'leaving') return null;
    const cfg = s.kind === 'grand' ? CONFIG.skills.grand : CONFIG.skills.rose;
    const pos = dancer.group.position;
    // Framing lúc santo (lỗi 22:29): cơ thể lộn quanh gốc ở chân nên tâm
    // người hạ xuống theo cos(góc lộn). lookAt phải bám tâm người thì
    // dancer mới ở trong khung suốt cú lộn — nhìn chằm vào gốc+1.2m thì
    // giữa vòng dancer rớt khỏi khung dưới, khung chỉ còn pháo/trời.
    // Tâm hình học ≈ giữa chân và đỉnh tóc (tính từ hình học thật, có scale);
    // ở góc 0 thì đúng bằng cameraLookAtHeight cũ (liên tục, không giật).
    const d = CONFIG.dancers;
    const centerY = dancer.mode === 'pole'
      ? (d.poleDancer.headCenterY + d.poleDancer.headRadius) / 2
      : ((d.chibi.headCenterY + d.chibi.hairRadius) / 2) * (d.scale || 1);
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
    const distance = cfg.cameraDistance;
    const height = cfg.cameraHeight;
    const camPos = pos.clone().add(dir.multiplyScalar(distance));
    camPos.y = pos.y + height;
    return { position: camPos, lookAt: target, lerpSpeed: cfg.cameraLerpSpeed };
  }

  _startNextSkill(time) {
    const next = this.skillQueue.shift();
    if (!next) return;
    const { dancer, kind } = next;
    if (!this._ownsDancer(dancer) || dancer.mode === 'leaving') {
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
    // Người múa cột model GLB: skill chạy bằng clip múa cột (video
    // @chaniee102), đè lên idle loop, hết skill về lại idle.
    if (dancer === this.poleDancer) this._playPoleSkill(dancer);
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
    if (!this._ownsDancer(dancer) || dancer.mode === 'leaving') {
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
      if (dancer === this.poleDancer) this._stopPoleSkill(dancer);
      dancer.somersaultAngle = 0;
      dancer.group.rotation.x = 0;
      this.activeSkill = null;
      if (this.skillQueue.length > 0) this._startNextSkill(time);
    }
  }

  sendToVip(dancer, now) {
    // Chibi của top donor đang đứng lồng thì ở yên trong lồng (không kéo
    // lên bục VIP — mỗi người chỉ xuất hiện 1 lần).
    if (dancer === this.djDancer) return;
    dancer.mode = 'vip';
    dancer.vipUntil = now + CONFIG.gifts.vipDurationSeconds;
    dancer.group.position.set(
      CONFIG.stage.vipPosition[0],
      CONFIG.stage.vipPlatformSize[1],
      CONFIG.stage.vipPosition[2],
    );
    if (this.hooks.onVipSpotlight) this.hooks.onVipSpotlight(true);
  }

  // ---- Vương miện vàng (top donor, user lệnh 22:26 + 02:22) ----
  // Chỉ 1 chiếc duy nhất: tạo 1 lần, gắn lên đầu NGƯỜI MÚA CỘT khi có
  // top donor (từ 02:22 vương miện không còn đội lên chibi nữa). Là con
  // của headGroup nên tự theo mọi animation (múa cột, santo); thu nhỏ
  // theo poleDancer.crownScale cho vừa đầu người thật.
  _getCrownGroup() {
    if (this.crownGroup) return this.crownGroup;
    const crown = CONFIG.dancers.crown;
    const group = new THREE.Group();
    group.visible = false;
    group.rotation.x = 0;
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

  // Nâng/trả nhãn tên (+ avatar nếu có) khi đội/tháo vương miện (khỏi chạm chóp).
  _setCrownLabels(dancer, crowned) {
    const lift = crowned ? (CONFIG.dancers.crown.labelLiftY || 0) : 0;
    if (dancer.avatarSprite) dancer.avatarSprite.position.y = dancer.avatarBaseY + lift;
    dancer.nameSprite.position.y = dancer.nameBaseY + lift;
  }

  // Vương miện lên đầu người múa cột (thu nhỏ theo đầu người thật, nhân
  // thêm scale của model để vương miện không bị lọt thỏm khi phóng to).
  _attachCrownToPole() {
    const crown = this._getCrownGroup();
    const s = CONFIG.dancers.poleDancer.crownScale
      * (CONFIG.dancers.poleDancer.model.scale || 1);
    crown.scale.setScalar(s);
    crown.rotation.x = 0;
    this.poleDancer.headGroup.add(crown);
    crown.visible = true;
    this._setCrownLabels(this.poleDancer, true);
  }

  _detachCrownFromPole() {
    if (this.crownGroup && this.crownGroup.parent) {
      this.crownGroup.parent.remove(this.crownGroup);
    }
    if (this.crownGroup) {
      this.crownGroup.visible = false;
      this.crownGroup.scale.setScalar(1);
    }
    if (this.poleDancer) this._setCrownLabels(this.poleDancer, false);
  }

  // Đổi tên hiển thị của người múa cột (tên top donor / tên mặc định).
  _setPoleName(name) {
    const pole = this.poleDancer;
    if (!pole || pole.user.name === name) return;
    pole.user.name = name;
    const old = pole.nameSprite;
    if (old) {
      if (old.material.map) old.material.map.dispose();
      old.material.dispose();
      pole.group.remove(old);
    }
    const sprite = makeNameSprite(name, CONFIG.dancers.poleDancer.labelScale || 1);
    sprite.position.set(0, pole.nameBaseY, 0.02);
    pole.nameSprite = sprite;
    pole.group.add(sprite);
  }

  // Dọn trạng thái lồng khi đổi/mất top donor: chibi cũ hiện lại đúng
  // slot cũ, vương miện tháo, tên lồng về mặc định. Dùng chung cho cả
  // clearDjDancer (chưa có gift) và _removeDancer (top donor rời live).
  _clearCageDonor() {
    const prev = this.djDancer;
    this.djDancer = null;
    if (prev) {
      prev.group.visible = true;
      if (this.dancers.has(String(prev.user.uniqueId)) && prev.mode !== 'leaving') {
        prev.mode = 'dance';
        this._resetWanderTowardFloor(prev);
      }
    }
    this._detachCrownFromPole();
    this._setPoleName(CONFIG.dancers.poleDancer.defaultName);
  }

  // ---- Lồng sắt (top donor, user lệnh 02:22) ----
  // Top donor ĐỨNG TRONG LỒNG SẮT: nhân vật múa cột mang tên + đội vương
  // miện của họ; chibi riêng TẠM ẨN khỏi sàn (mỗi người chỉ xuất hiện 1
  // lần). Khi mất top thì chibi hiện lại đúng slot cũ. Giữ nguyên tên hàm
  // (main.js gọi setDjDancer/clearDjDancer/getDjDancer như cũ) — bàn DJ
  // từ lệnh này chỉ còn làm cảnh, không đặt dancer ở đó nữa.
  setDjDancer(dancer) {
    if (!dancer) return false;
    if (this.djDancer === dancer) return true;
    this._clearCageDonor();
    // Donor đang ở bục VIP thì tắt spotlight nếu không còn ai ở bục,
    // và trả mode về dance để lúc hiện lại thì đi dạo bình thường.
    if (dancer.mode === 'vip') {
      const othersVip = [...this.dancers.values()].some(
        (o) => o !== dancer && o.mode === 'vip',
      );
      if (!othersVip && this.hooks.onVipSpotlight) this.hooks.onVipSpotlight(false);
      dancer.mode = 'dance';
    }
    this.djDancer = dancer;
    dancer.group.visible = false;
    this._setPoleName(dancer.user.name);
    this._attachCrownToPole();
    return true;
  }

  // Chưa có gift nào (hoặc top donor đã rời hẳn): lồng về trạng thái
  // mặc định — người múa cột tên "Múa cột", không vương miện.
  clearDjDancer() {
    this._clearCageDonor();
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
    if (this.djDancer === dancer) this._clearCageDonor();
    // Rời live thật (hết ân hạn) thì loại khỏi bảng xếp hạng lồng để
    // top mới lên thay; bị đuổi do sàn đầy (leftAt null) thì không.
    if (dancer.leftAt != null) departedDonorIds.add(String(dancer.user.uniqueId));
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
  // (mode 'dance') — VIP/đi vòng/múa cột giữ nguyên hành vi riêng.
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
        // Bàn DJ sau lưng (từ 02:22 chỉ làm cảnh, vẫn là khu cấm đi dạo).
        rect(CONFIG.djTable.position[0], CONFIG.djTable.position[2],
          CONFIG.djTable.size[0], CONFIG.djTable.size[2]),
        // Bục VIP bên phải.
        rect(CONFIG.stage.vipPosition[0], CONFIG.stage.vipPosition[2],
          CONFIG.stage.vipPlatformSize[0], CONFIG.stage.vipPlatformSize[2]),
        // Booth DJ bên trái.
        rect(CONFIG.stage.djPosition[0], CONFIG.stage.djPosition[2],
          CONFIG.stage.djBoothSize[0], CONFIG.stage.djBoothSize[2]),
      ],
      // Đĩa cấm quanh lồng sắt (lệnh 02:20): dancer khán giả không đi
      // xuyên nan. Bán kính = nan lồng + đệm (slot vòng gần nhất cách
      // tâm lồng ~2.0m nên slot vẫn ngoài đĩa này).
      keepOutCircles: [
        {
          cx: CONFIG.scene.cage.centerX,
          cz: CONFIG.scene.cage.centerZ,
          r: CONFIG.scene.cage.radius + w.cageKeepOutMargin,
        },
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
    for (const c of limits.keepOutCircles || []) {
      if (Math.hypot(x - c.cx, z - c.cz) < c.r + radius) return true;
    }
    return false;
  }

  // Kẹp 1 điểm (Vector3, chỉ dùng x/z) vào vùng đi dạo: kẹp mép sàn,
  // rồi đẩy ra khỏi khu cấm theo cạnh gần nhất, rồi đẩy ra khỏi đĩa cấm
  // theo hướng tâm (đĩa lồng sắt).
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
    for (const c of limits.keepOutCircles || []) {
      const dx = pos.x - c.cx;
      const dz = pos.z - c.cz;
      const dist = Math.hypot(dx, dz);
      if (dist < c.r) {
        if (dist < 1e-6) {
          pos.x = c.cx + c.r;
        } else {
          pos.x = c.cx + (dx / dist) * c.r;
          pos.z = c.cz + (dz / dist) * c.r;
        }
      }
    }
    return pos;
  }

  _clampToWander(dancer, limits) {
    return this._clampPointToWander(dancer.group.position, limits);
  }

  // Về lại chế độ đi dạo sau khi rời bục VIP / đi vòng / đứng lồng: hướng
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
      // Chibi của top donor đang đứng lồng (ẩn, đứng yên tại slot) thì
      // không tham gia tách — khỏi đẩy người khác / bị đẩy khỏi slot.
      (d) => d.mode === 'dance' && d.enterProgress >= 1 && d !== this.djDancer,
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
    // Người múa cột chạy chung vòng lặp (kể cả khi sàn chưa có viewer
    // nào — lồng mặc định vẫn phải múa), nhưng không nằm trong map.
    const allDancers = this.poleDancer
      ? [...this.dancers.values(), this.poleDancer]
      : [...this.dancers.values()];
    for (const dancer of allDancers) {
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

      // Chỉ người ĐÃ RỜI live mới rời sàn, sau leaveGraceSeconds ân hạn
      // (user lệnh 00:43). Người còn xem — dù im lặng bao lâu — vẫn ở lại.
      // Mọi mode đều áp (VIP cũng vậy; đường rời sàn sẵn có tự dọn lồng
      // + vương miện). Tín hiệu rời giữa chừng (skill ≤ ~30s) chỉ bắt
      // đầu đếm ân hạn, không cắt ngang skill.
      const graceSeconds = d.leaveGraceSeconds || 600;
      if (dancer.leftAt != null && time - dancer.leftAt > graceSeconds) {
        this.startLeave(dancer);
        continue;
      }

      // Chibi của top donor đang đứng lồng: ẩn tại slot, không di chuyển,
      // không nhảy, không áp động tác (luật rời 10 phút đã chạy ở trên;
      // hết ân hạn thì startLeave → _removeDancer dọn lồng).
      if (dancer === this.djDancer) continue;

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
      // chỉ nhánh nhảy thường (mode 'dance') mới áp offset (VIP/đi vòng/
      // múa cột giữ nguyên hành vi riêng, skill đè lên rồi về lại bộ này).
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
      } else if (dancer.mode === 'pole') {
        // Model GLB: mixer chạy trước để xương kịp frame này; bob dọc
        // (rootY) nhích cả model qua modelRoot, không qua track vị trí
        // (tránh lệch hệ tọa độ local của xương pelvis).
        if (dancer.modelReady && dancer.mixer) {
          dancer.mixer.update(dt);
          if (dancer.modelRoot) dancer.modelRoot.position.y = this._samplePoleRootY(dancer);
        }
        if (dancer.modelReady) {
          // Nhảy tại chỗ bám cột (r=0,34m), hướng ra ngoài (về phía
          // camera); thỉnh thoảng xoay đúng 1 vòng quanh cột, quay mặt
          // vào cột lúc xoay, blend hướng mặt mượt (lệnh 03:22).
          const pc = CONFIG.dancers.poleDancer;
          const cage = CONFIG.scene.cage;
          const poleBpm = (CONFIG.music && CONFIG.music.bpm) || 128;
          const poleBeatsPerBar = (CONFIG.music && CONFIG.music.beatsPerBar) || 4;
          const barFloat = (time * poleBpm) / (60 * poleBeatsPerBar);
          const barIndex = Math.floor(barFloat);
          if (dancer.poleSpinState === 'idle'
            && barIndex % (pc.spinEveryBars || 8) === 0
            && barIndex !== dancer.poleSpinLastBar
            && !dancer.skillKind) {
            dancer.poleSpinState = 'spin';
            dancer.poleSpinStartBar = barFloat;
            dancer.poleSpinFromAngle = dancer.poleAngle;
            dancer.poleSpinLastBar = barIndex;
          }
          let targetFacing = 0;
          if (dancer.poleSpinState === 'spin') {
            const p = (barFloat - dancer.poleSpinStartBar) / (pc.spinDurationBars || 2);
            if (p >= 1) {
              dancer.poleAngle = dancer.poleSpinFromAngle + Math.PI * 2;
              dancer.poleSpinState = 'recover';
              dancer.poleSpinRecoverAt = time;
            } else {
              const e = p * p * (3 - 2 * p); // smoothstep vào/ra
              dancer.poleAngle = dancer.poleSpinFromAngle + e * Math.PI * 2;
              targetFacing = 1;
            }
          }
          if (dancer.poleSpinState === 'recover'
            && time - (dancer.poleSpinRecoverAt || 0) > 0.5) {
            dancer.poleSpinState = 'idle';
          }
          const fk = 1 - Math.exp(-dt * (pc.spinFacingRate || 6));
          dancer.poleFacing += (targetFacing - dancer.poleFacing) * fk;
          const px = cage.centerX + Math.cos(dancer.poleAngle) * pc.orbitRadius;
          const pz = cage.centerZ + Math.sin(dancer.poleAngle) * pc.orbitRadius;
          group.position.set(px, Math.max(0, swing) * amp * 0.5, pz);
          // Ra ngoài: yaw = π/2 - angle; vào cột: yaw = -π/2 - angle.
          group.rotation.y = Math.PI / 2 - dancer.poleAngle - dancer.poleFacing * Math.PI;
          this._syncPoleHead(dancer);
        } else {
          // Múa cột tả thực (lệnh 02:44): bám cột, xoay quanh cột, quay
          // mặt vào cột, đổi tư thế theo bar nhạc. Tư thế đích (khớp vai/
          // khuỷu/hông/gối/cổ chân + nghiêng người) được NỘI SUY MỀM về tư
          // thế hiện tại (easing hàm mũ) — không cắt cứng khi đổi bar;
          // đầu + tóc lắc trễ mềm theo beat (follow-through, quán tính).
          // Skill (nếu có) chạy tại chỗ bên cột: khối santo bên dưới ghi đè
          // y/rotation.x khi cần; khối armsUp/fan bên dưới ghi đè tay khi cần.
          const pc = CONFIG.dancers.poleDancer;
          const cage = CONFIG.scene.cage;
          // Đổi tư thế theo bar nhạc trước (tư thế xoay nhanh có hệ số riêng).
          const poleBpm = (CONFIG.music && CONFIG.music.bpm) || 128;
          const poleBeatsPerBar = (CONFIG.music && CONFIG.music.beatsPerBar) || 4;
          const barFloat = (time * poleBpm) / (60 * poleBeatsPerBar);
          const barIndex = Math.floor(barFloat);
          if (barIndex !== dancer.polePoseBar) {
            dancer.polePoseBar = barIndex;
            dancer.polePoseIndex = (dancer.polePoseIndex + 1) % pc.poseCount;
          }
          const poseSpin = [1, 0.8, 0.9, 1.6][dancer.polePoseIndex] || 1;
          const beatPulse = Math.max(0, Math.sin(beatPhase * Math.PI * 2));
          dancer.poleAngle += dt * pc.spinSpeed * (1 + pc.spinBeatBoost * beatPulse) * poseSpin;
          const px = cage.centerX + Math.cos(dancer.poleAngle) * pc.orbitRadius;
          const pz = cage.centerZ + Math.sin(dancer.poleAngle) * pc.orbitRadius;
          group.position.set(px, Math.max(0, swing) * amp * 0.5, pz);
          // Quay mặt vào cột: hướng nhìn = từ vị trí về tâm lồng.
          group.rotation.y = -dancer.poleAngle - Math.PI / 2;
          // Tư thế đích theo bar: 0 ôm cột 2 tay trên cao, 1 nghiêng người
          // 1 tay ôm cột, 2 co 1 chân + 1 tay chống hông, 3 dang 2 tay
          // xoay nhanh. Gối gập + mũi chân duỗi theo kiểu người thật.
          const hold = Math.sin(beatPhase * Math.PI * 2);
          // Gợn mềm theo nhịp: 2 tay uốn ngược pha, biên độ nhỏ.
          const flow = Math.sin(beatPhase * Math.PI * 2 + dancer.poleAngle * 0.5) * 0.05;
          const pose = dancer.polePoseIndex;
          const target = {
            shLx: 0, shLz: 0, shRx: 0, shRz: 0, elL: 0, elR: 0,
            hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, ankL: 0, ankR: 0, lean: 0,
          };
          if (pose === 0) {
            Object.assign(target, {
              shLx: -2.7 + hold * 0.06, shLz: 0.5, shRx: -2.7 - hold * 0.06, shRz: -0.5,
              elL: -0.25, elR: -0.25, kneeL: 0.05, kneeR: 0.05, ankL: 0.05, ankR: 0.05,
              lean: hold * 0.04,
            });
          } else if (pose === 1) {
            Object.assign(target, {
              shLx: -2.8, shLz: 0.4, shRx: -0.4 + hold * 0.1, shRz: -1.2,
              elL: -0.3, elR: -0.9, hipR: -0.3, kneeL: 0.05, kneeR: 0.35,
              ankL: 0.05, ankR: 0.25, lean: 0.28 + hold * 0.03,
            });
          } else if (pose === 2) {
            Object.assign(target, {
              shLx: -2.6, shLz: 0.6, shRx: -0.9, shRz: -0.9,
              elL: -0.3, elR: -0.7, hipL: -1.05, hipR: 0.1, kneeL: 1.05, kneeR: 0.1,
              ankL: 0.5, ankR: 0.05, lean: 0.12 + hold * 0.03,
            });
          } else {
            Object.assign(target, {
              shLx: -0.6 + hold * 0.1, shLz: 1.9, shRx: -0.6 - hold * 0.1, shRz: -1.9,
              elL: -0.15, elR: -0.15, hipL: 0.15, hipR: -0.15, kneeL: 0.1, kneeR: 0.1,
              ankL: 0.05, ankR: 0.05, lean: hold * 0.05,
            });
          }
          target.shLx += flow;
          target.shRx -= flow;
          // Nội suy mềm về đích (frame đầu lấy luôn đích để khỏi giật).
          if (!dancer.poleCur) dancer.poleCur = { ...target };
          const cur = dancer.poleCur;
          const k = 1 - Math.exp(-dt * (pc.poseBlendSpeed || 6));
          for (const key of Object.keys(target)) cur[key] += (target[key] - cur[key]) * k;
          dancer.poleLeanZ = cur.lean;
          // Đầu + tóc lắc trễ mềm theo BAR nhạc (chậm hơn nhịp → nhìn rõ
          // mà vẫn mềm; tóc chậm hơn đầu = quán tính, follow-through).
          const swayTarget = Math.sin(barFloat * Math.PI * 2) * (pc.headSwayAmplitude || 0.05);
          const kh = 1 - Math.exp(-dt * (pc.headSwaySpeed || 3));
          dancer.poleHeadSway += (swayTarget - dancer.poleHeadSway) * kh;
          const hairTarget = Math.sin(barFloat * Math.PI * 2 - 0.6) * (pc.hairSwayAmplitude || 0.08);
          const khair = 1 - Math.exp(-dt * (pc.hairSwaySpeed || 2));
          dancer.poleHairSway += (hairTarget - dancer.poleHairSway) * khair;
          dancer.headGroup.rotation.z = dancer.poleHeadSway;
          dancer.headGroup.rotation.x = dancer.poleHeadSway * 0.5;
          if (dancer.hairBack) dancer.hairBack.rotation.x = dancer.poleHairSway;
        }
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
      // Skill santo (grand): lộn nhào 1 vòng — CHỈ chibi thường; người
      // múa cột model GLB không lộn (clip skill đã là màn trình diễn).
      const somersaulting = dancer.skillKind === 'grand'
        && !(dancer.mode === 'pole' && dancer.modelReady)
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

      // Múa quạt (skill hoa hồng, lệnh 02:36): blend mượt vào/ra như skill
      // giơ tay cũ; tay quạt theo nhịp, tính ở khối tay bên dưới.
      // Skill gift lớn (grand) vẫn giơ 2 tay chữ V như cũ.
      // Động tác bật nhảy cũng giơ tay theo độ cao (chỉ ở nhánh nhảy thường).
      let fanAmount = 0;
      if (dancer.skillKind === 'rose') {
        const blend = CONFIG.skills.rose.armsUpBlendSeconds || 0.3;
        const elapsedSkill = time - dancer.skillStartedAt;
        const remainSkill = dancer.skillUntil - time;
        fanAmount = Math.min(1, Math.max(0, elapsedSkill / blend), Math.max(0, remainSkill / blend));
      }
      let armsUp = 0;
      if (dancer.skillKind === 'grand') {
        const skillCfg = CONFIG.skills.grand;
        const blend = skillCfg.armsUpBlendSeconds || 0.3;
        const elapsedSkill = time - dancer.skillStartedAt;
        const remainSkill = dancer.skillUntil - time;
        armsUp = Math.min(1, Math.max(0, elapsedSkill / blend), Math.max(0, remainSkill / blend));
      } else if (time < dancer.armsUpUntil) {
        // Lệnh chat "giơ tay": blend vào/ra như skill; skill đang chạy
        // thì nhánh trên đã đè lên.
        const cmdBlend = d.commandArmsUpBlendSeconds || 0.3;
        const elapsedCmd = time - dancer.armsUpStartedAt;
        const remainCmd = dancer.armsUpUntil - time;
        armsUp = Math.min(1, Math.max(0, elapsedCmd / cmdBlend), Math.max(0, remainCmd / cmdBlend));
      } else if (dancer.mode === 'dance' && movePose.hopArms > 0) {
        armsUp = Math.min(1, movePose.hopArms * 0.85);
      }

      // Tay + chân đung đưa theo nhịp, mạnh dần theo energy. Động tác vung
      // tay: tay đung đưa mạnh hơn + quét lên/xuống xen kẽ theo nhịp.
      // Model GLB: mixer giữ toàn bộ khớp — các nhánh dưới KHÔNG ghi đè
      // (chỉ fanAmount còn góp lắc người ở cuối update).
      const mixerOwnsJoints = dancer.mode === 'pole' && dancer.modelReady;
      // Cửa sổ nạp model/fallback: shell đã có nhưng body chưa dựng xong
      // (armL/legL... còn null) — bỏ qua mọi ghi khớp, không crash.
      const poleBodyMissing = dancer.mode === 'pole' && !dancer.proceduralBuilt && !dancer.modelReady;
      const armSwing = swing * d.armSwingAmplitude * (0.35 + dancer.energy)
        * (dancer.mode === 'dance' ? movePose.armAmp : 1);
      const sweep = dancer.mode === 'dance'
        ? movePose.armSweep * Math.sin(beatPhase * Math.PI * 2)
        : 0;
      if (mixerOwnsJoints || poleBodyMissing) {
        // Không ghi đè khớp — mixer (idle/skill clip) đang giữ, hoặc body
        // chưa dựng xong (cửa sổ nạp model/fallback).
      } else if (fanAmount > 0) {
        // Múa quạt: 2 tay đưa ra trước ngực, vẫy luân phiên lên-xuống
        // như cái quạt — 2 chu kỳ mỗi nhịp, 2 tay ngược pha, cổ tay mềm
        // (xoay z nhẹ cùng pha vẫy). Blend từ tư thế thường sang quạt.
        const fanCfg = CONFIG.skills.rose;
        const wavePhase = beatPhase * Math.PI * 2 * (fanCfg.fanWavesPerBeat || 2)
          + dancer.phaseOffset;
        const wL = Math.sin(wavePhase);
        const wR = Math.sin(wavePhase + Math.PI);
        const fanX = fanCfg.fanForwardX || -1.15;
        const fanAmp = fanCfg.fanWaveAmplitude || 0.38;
        const fanSpread = fanCfg.fanSpreadZ || 0.55;
        dancer.armL.rotation.x = THREE.MathUtils.lerp(-armSwing * 0.4 - sweep, fanX + wL * fanAmp, fanAmount);
        dancer.armR.rotation.x = THREE.MathUtils.lerp(armSwing * 0.4 + sweep, fanX + wR * fanAmp, fanAmount);
        dancer.armL.rotation.z = THREE.MathUtils.lerp(0.25 + armSwing, fanSpread + wL * 0.12, fanAmount);
        dancer.armR.rotation.z = THREE.MathUtils.lerp(-0.25 - armSwing, -fanSpread - wR * 0.12, fanAmount);
      } else if (armsUp > 0) {
        dancer.armL.rotation.z = THREE.MathUtils.lerp(0.25 + armSwing, -2.6, armsUp);
        dancer.armR.rotation.z = THREE.MathUtils.lerp(-0.25 - armSwing, 2.6, armsUp);
        dancer.armL.rotation.x = THREE.MathUtils.lerp(-armSwing * 0.4, -0.3, armsUp);
        dancer.armR.rotation.x = THREE.MathUtils.lerp(armSwing * 0.4, -0.3, armsUp);
      } else if (dancer.mode === 'pole') {
        // Múa cột: vai + khuỷu theo tư thế khớp đã nội suy mềm (nhánh
        // pole ở trên); skill/lệnh giơ tay đè lên ở nhánh fan/armsUp trên.
        const cur = dancer.poleCur;
        if (cur) {
          dancer.armL.rotation.set(cur.shLx, 0, cur.shLz);
          dancer.armR.rotation.set(cur.shRx, 0, cur.shRz);
          dancer.elbL.rotation.x = cur.elL;
          dancer.elbR.rotation.x = cur.elR;
        }
      } else {
        dancer.armL.rotation.z = 0.25 + armSwing;
        dancer.armR.rotation.z = -0.25 - armSwing;
        dancer.armL.rotation.x = -armSwing * 0.4 - sweep;
        dancer.armR.rotation.x = armSwing * 0.4 + sweep;
      }
      if (mixerOwnsJoints || poleBodyMissing) {
        // Không ghi đè khớp chân — mixer đang giữ, hoặc body chưa dựng xong.
      } else if (dancer.mode === 'pole') {
        // Múa cột: hông + gối + cổ chân theo tư thế khớp đã nội suy mềm.
        const cur = dancer.poleCur;
        if (cur) {
          dancer.legL.rotation.x = cur.hipL;
          dancer.legR.rotation.x = cur.hipR;
          dancer.kneeL.rotation.x = cur.kneeL;
          dancer.kneeR.rotation.x = cur.kneeR;
          dancer.ankL.rotation.x = cur.ankL;
          dancer.ankR.rotation.x = cur.ankR;
        }
      } else {
        dancer.legL.rotation.x = -swing * 0.45 * (0.35 + dancer.energy);
        dancer.legR.rotation.x = swing * 0.45 * (0.35 + dancer.energy);
      }
      // Cả người hơi nghiêng theo nhịp (trừ lúc santo); động tác lắc hông
      // cộng thêm nghiêng + dịch ngang (nhánh nhảy thường); múa cột cộng
      // thêm nghiêng theo tư thế; múa quạt lắc nhẹ người theo nhịp.
      group.rotation.z = swing * 0.05 * (0.5 + dancer.energy)
        + (dancer.mode === 'dance' ? movePose.swayZ : 0)
        + (dancer.mode === 'pole' ? (dancer.poleLeanZ || 0) : 0)
        + fanAmount * Math.sin(beatPhase * Math.PI * 2) * (CONFIG.skills.rose.fanSwayAngle || 0.06);
      if (dancer.mode === 'orbit') group.rotation.z = 0;
      if (somersaulting) group.rotation.z = 0;
    }
    // Cuối frame: tách các dancer đi dạo để giữ khoảng cách tối thiểu
    // (không chồng lấn), rồi kẹp lại vào vùng đi dạo.
    this._separateWanderers();
  }
}
