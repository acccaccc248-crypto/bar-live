// Harness kiểm chứng người múa cột model GLB + clip mocap
// (CONFIG.dancers.poleDancer.model + js/dancers.js).
// Chạy từ gốc repo:  node test/pole-model-harness.mjs
// (cần three@0.160.0 trong node_modules — KHÔNG commit.)
// Kiểm chứng:
//   1. GLB parse được: rig đủ xương clip cần, có mesh + texture.
//   2. buildPoleClipData: 2 clip (idle 12s, skill 5s), mỗi clip 18 track
//      (tay + bàn chân giữ tư thế nghỉ); sampleRootYCurve nội suy đúng
//      + trong biên độ cho phép.
//   3. Mixer chạy 600 frame (idle → skill crossfade → về idle): mọi
//      matrixWorld của xương hữu hạn, không NaN.
//   4. Fallback procedural: import URL GLTFLoader thất bại trong Node
//      -> body procedural vẫn dựng đủ (live không trống lồng).
//   5. Đường model trong update(): bám cột r=0,34m suốt, xoay đúng
//      1 vòng/bar-chu kỳ, mặt vào cột lúc xoay, vương miện (headGroup)
//      theo xương đầu, skill rose chạy clip skill rồi về idle.
// Dùng Math.random có seed để ổn định.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Stub DOM tối thiểu (trước khi import three) ----
// Ép GLTFLoader đi đường ImageLoader (không dùng createImageBitmap của Node).
globalThis.createImageBitmap = undefined;
globalThis.self = globalThis;
globalThis.window = globalThis;

class FakeEl {
  constructor(tag) {
    this.tagName = tag;
    this.style = {};
    this.width = 0;
    this.height = 0;
    this._listeners = {};
    this._src = '';
  }

  addEventListener(type, fn) {
    (this._listeners[type] ||= []).push(fn);
  }

  removeEventListener(type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter((x) => x !== fn);
  }

  set src(v) {
    this._src = v;
    this.width = 1024;
    this.height = 1024;
    setTimeout(() => {
      for (const fn of this._listeners.load || []) fn.call(this);
    }, 0);
  }

  get src() {
    return this._src;
  }

  getContext() {
    return fakeCtx();
  }
}

function fakeCtx() {
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
  };
  for (const m of [
    'fillRect', 'clearRect', 'beginPath', 'arc', 'stroke', 'fill',
    'save', 'restore', 'clip', 'drawImage', 'fillText', 'moveTo',
    'lineTo', 'quadraticCurveTo', 'closePath', 'ellipse', 'rect',
  ]) {
    ctx[m] = () => {};
  }
  ctx.measureText = () => ({ width: 10 });
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  return ctx;
}

globalThis.document = {
  createElement: (tag) => new FakeEl(tag),
  createElementNS: (_ns, tag) => new FakeEl(tag),
};
globalThis.Image = FakeEl;

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { DancerManager, buildPoleClipData, sampleRootYCurve, brightenPoleModelMaterials } = await import('../js/dancers.js');
const { CONFIG } = await import('../config.js');

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log('  OK  ' + msg);
  } else {
    failures += 1;
    console.error('  FAIL ' + msg);
  }
}
function finiteVec3(v, label) {
  check(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z), label + ' hữu hạn');
}
function assertAllMatricesFinite(root, label) {
  let bad = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    for (const e of o.matrixWorld.elements) {
      if (!Number.isFinite(e)) { bad += 1; break; }
    }
  });
  check(bad === 0, label + ' (matrixWorld hữu hạn)');
}

// Seed Math.random để ổn định.
let seed = 123456789;
Math.random = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

console.log('[1] GLB + clip JSON');
const glbBytes = await readFile(path.join(ROOT, 'models/pole-dancer.glb'));
const idleJson = JSON.parse(await readFile(path.join(ROOT, 'models/pole-idle.clip.json'), 'utf8'));
const skillJson = JSON.parse(await readFile(path.join(ROOT, 'models/pole-skill.clip.json'), 'utf8'));
const loader = new GLTFLoader();
const gltf = await loader.parseAsync(glbBytes.buffer.slice(
  glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength), '');
const modelRoot = gltf.scene;
check(!!modelRoot, 'GLB parse được scene');
const idleData = buildPoleClipData(idleJson);
const skillData = buildPoleClipData(skillJson);
check(Math.abs(idleData.duration - 12) < 1e-6, 'idle clip dài 12,0s (được ' + idleData.duration + ')');
check(Math.abs(skillData.duration - 5) < 1e-6, 'skill clip dài 5,0s (được ' + skillData.duration + ')');
check(idleData.tracks.length === 18, 'idle clip 18 track (được ' + idleData.tracks.length + ') — tay + bàn chân giữ tư thế nghỉ');
check(skillData.tracks.length === 18, 'skill clip 18 track (được ' + skillData.tracks.length + ')');
const needBones = new Set([...idleData.tracks, ...skillData.tracks].map((t) => t.bone));
let missing = 0;
for (const name of needBones) {
  if (!modelRoot.getObjectByName(name)) missing += 1;
}
check(missing === 0, 'rig đủ ' + needBones.size + ' xương clip cần');
check(!!modelRoot.getObjectByName('head'), 'rig có xương head');
let meshCount = 0;
let texCount = 0;
modelRoot.traverse((o) => {
  if (o.isMesh || o.isSkinnedMesh) meshCount += 1;
  if (o.material && o.material.map) texCount += 1;
});
check(meshCount >= 1, 'GLB có mesh (' + meshCount + ')');
check(texCount >= 1, 'GLB có texture da (' + texCount + ')');
// Mẫu NÉT (lệnh 06:12): đọc thẳng JSON chunk của GLB — mesh riêng cho
// tóc/mắt, texture thân/tóc 2048², tổng < 60k tris. (Texture đã load
// qua Image stub nên không đo kích thước từ three được.)
const glbJsonLen = glbBytes.readUInt32LE(12);
const glbJson = JSON.parse(glbBytes.subarray(20, 20 + glbJsonLen).toString('utf8'));
const binStart = 20 + glbJsonLen + 8;
function imageSize(img) {
  const bv = glbJson.bufferViews[img.bufferView];
  const raw = glbBytes.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
  if (raw[0] === 0x89 && raw[1] === 0x50) { // PNG: IHDR
    return [raw.readUInt32BE(16), raw.readUInt32BE(20)];
  }
  if (raw[0] === 0xff && raw[1] === 0xd8) { // JPEG: quét marker SOF
    let p = 2;
    while (p + 9 < raw.length) {
      if (raw[p] !== 0xff) { p += 1; continue; }
      const marker = raw[p + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return [raw.readUInt16BE(p + 7), raw.readUInt16BE(p + 5)];
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
      p += 2 + raw.readUInt16BE(p + 2);
    }
  }
  return [0, 0];
}
const meshNames = glbJson.meshes.map((m) => m.name);
check(meshNames.length >= 3, 'GLB đa-mesh (thân/đồ/tóc/mắt riêng): ' + meshNames.length + ' mesh');
check(meshNames.some((n) => n.includes('long01')), 'có mesh tóc riêng long01 (không vẽ trên texture)');
check(meshNames.some((n) => n.includes('high-poly')), 'có mesh mắt 3D riêng (high-poly)');
let totalTris = 0;
for (const m of glbJson.meshes) {
  for (const p of m.primitives) totalTris += glbJson.accessors[p.indices].count / 3;
}
check(totalTris < 60000, 'tổng < 60k tris (' + totalTris + ')');
const imgSizes = {};
for (const img of glbJson.images || []) imgSizes[img.name] = imageSize(img);
const sizeOf = (frag) => {
  const k = Object.keys(imgSizes).find((n) => n.includes(frag));
  return k ? imgSizes[k] : [0, 0];
};
const bodyTex = sizeOf('diffuse3');
check(bodyTex[0] >= 2048 && bodyTex[1] >= 2048, 'texture da ≥2048² (' + bodyTex.join('x') + ')');
const hairTex = sizeOf('long01');
check(hairTex[0] >= 2048 && hairTex[1] >= 2048, 'texture tóc ≥2048² (' + hairTex.join('x') + ')');
check(glbBytes.length <= 8 * 1024 * 1024, 'GLB ≤ 8MB (' + (glbBytes.length / 1048576).toFixed(2) + 'MB)');

console.log('[2] sampleRootYCurve');
check(sampleRootYCurve(null, 1) === 0, 'curve rỗng -> 0');
check(sampleRootYCurve(idleData.rootY, -1) === idleData.rootY.values[0], 't < đầu -> giá trị đầu');
const midY = sampleRootYCurve(idleData.rootY, idleData.duration / 2);
check(Number.isFinite(midY) && midY >= -0.05 && midY <= 0.15, 'rootY giữa clip trong [-0.05, 0.15] (' + midY.toFixed(4) + ')');
check(Math.abs(sampleRootYCurve(idleData.rootY, idleData.duration) - idleData.rootY.values.at(-1)) < 1e-9, 't = cuối -> giá trị cuối');
let badClip = false;
try {
  buildPoleClipData({ duration: 1, tracks: {} });
} catch {
  badClip = true;
}
check(badClip, 'clip rỗng bị từ chối');

console.log('[3] Mixer 600 frame + crossfade');
const mixer = new THREE.AnimationMixer(modelRoot);
const mk = (data, name) => new THREE.AnimationClip(name, data.duration,
  data.tracks.map((t) => new THREE.QuaternionKeyframeTrack(t.bone + '.quaternion', t.times, t.values)));
const idleA = mixer.clipAction(mk(idleData, 'pole-idle'));
idleA.setLoop(THREE.LoopRepeat, Infinity);
const skillA = mixer.clipAction(mk(skillData, 'pole-skill'));
skillA.setLoop(THREE.LoopOnce, 1);
skillA.clampWhenFinished = true;
idleA.play();
skillA.play();
skillA.setEffectiveWeight(0);
for (let i = 0; i < 600; i += 1) {
  if (i === 120) { skillA.reset(); skillA.fadeIn(0.3); skillA.play(); idleA.fadeOut(0.3); }
  if (i === 420) { idleA.enabled = true; idleA.fadeIn(0.3); idleA.play(); skillA.fadeOut(0.3); }
  mixer.update(1 / 60);
  if (i % 60 === 0) assertAllMatricesFinite(modelRoot, 'frame ' + i);
}
check(Math.abs(idleA.getEffectiveWeight() - 1) < 0.01, 'sau crossfade idle weight về 1 (' + idleA.getEffectiveWeight().toFixed(3) + ')');
check(skillA.getEffectiveWeight() < 0.01, 'sau crossfade skill weight về 0 (' + skillA.getEffectiveWeight().toFixed(3) + ')');
check(skillA.time > 0, 'skill action đã chạy (time=' + skillA.time.toFixed(2) + ')');

console.log('[4] Fallback procedural khi GLTFLoader URL lỗi (Node)');
const addedToScene = [];
const fakeScene = { add(o) { addedToScene.push(o); }, remove() {} };
const mgr = new DancerManager(fakeScene, {});
await new Promise((r) => setTimeout(r, 300));
const pole = mgr.poleDancer;
check(pole.modelReady === false, 'Node: modelReady=false (URL import bị chặn như thiết kế)');
check(pole.proceduralBuilt === true, 'fallback procedural đã dựng body');
check(!!pole.nameSprite, 'fallback có nameSprite');
check(pole.group.children.length > 0, 'fallback group có con');
// Nổi bật mẫu nữ (lệnh 06:13): vòng sáng dưới chân + nhãn tên phóng to.
const ring = addedToScene.find((o) => o.isMesh && o.geometry && o.geometry.type === 'RingGeometry');
check(!!ring, 'vòng sáng dưới chân đã thêm vào scene');
if (ring) {
  check(Math.abs(ring.position.y - CONFIG.dancers.poleDancer.glowRing.y) < 1e-6, 'vòng sáng y=' + ring.position.y + ' (trên đế lồng)');
  check(Math.abs(ring.position.x - CONFIG.scene.cage.centerX) < 1e-6 && Math.abs(ring.position.z - CONFIG.scene.cage.centerZ) < 1e-6, 'vòng sáng ở tâm lồng');
}
const labelW = pole.nameSprite.scale.x;
check(Math.abs(labelW - CONFIG.dancers.nameLabelWidth * CONFIG.dancers.poleDancer.labelScale) < 1e-6,
  'nhãn tên cô múa cột phóng ' + CONFIG.dancers.poleDancer.labelScale + 'x (' + labelW.toFixed(3) + 'm)');

console.log('[5] Đường model trong update(): bám cột + xoay + vương miện + skill');
// Gắn model thật vào pole dancer (y như _loadPoleModel làm).
brightenPoleModelMaterials(modelRoot);
{
  let suitOk = false;
  let skinR = 0;
  modelRoot.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if ((m.name.includes('bikini') || m.name.includes('sportsuit')) && m.emissiveIntensity === 0.3) suitOk = true;
      if (m.name.includes('body')) skinR = m.color.r;
    }
  });
  check(suitOk, 'bikini có emissive tím 0.3 (viền neon nhẹ)');
  check(skinR > 1, 'da sáng hơn (color r=' + skinR.toFixed(2) + ' > 1)');
}
pole.group.add(modelRoot);
// Áp scale model như _loadPoleModel làm (lệnh 06:47: phóng to 1,08x).
if (CONFIG.dancers.poleDancer.model.scale) modelRoot.scale.setScalar(CONFIG.dancers.poleDancer.model.scale);
pole.modelRoot = modelRoot;
pole.headBone = modelRoot.getObjectByName('head');
pole.mixer = new THREE.AnimationMixer(modelRoot);
const idleA2 = pole.mixer.clipAction(mk(idleData, 'pole-idle'));
idleA2.setLoop(THREE.LoopRepeat, Infinity);
const skillA2 = pole.mixer.clipAction(mk(skillData, 'pole-skill'));
skillA2.setLoop(THREE.LoopOnce, 1);
skillA2.clampWhenFinished = true;
pole.poleClips = { idle: idleData, skill: skillData };
pole.poleActions = { idle: idleA2, skill: skillA2 };
pole.modelReady = true;
idleA2.play();
skillA2.play();
skillA2.setEffectiveWeight(0);

const pc = CONFIG.dancers.poleDancer;
const cage = CONFIG.scene.cage;
const bpm = (CONFIG.music && CONFIG.music.bpm) || 128;
const dt = 1 / 60;
let time = 0;
let maxAngle = pole.poleAngle;
let minR = Infinity;
let maxR = -Infinity;
let sawSpin = false;
const headWorld = new THREE.Vector3();
for (let i = 0; i < 60 * 35; i += 1) {
  time += dt;
  const beatPhase = ((time * bpm) / 60) % 1;
  mgr.update(dt, time, beatPhase);
  const r = Math.hypot(
    pole.group.position.x - cage.centerX,
    pole.group.position.z - cage.centerZ,
  );
  if (r < minR) minR = r;
  if (r > maxR) maxR = r;
  if (pole.poleAngle > maxAngle) maxAngle = pole.poleAngle;
  if (pole.poleSpinState === 'spin') sawSpin = true;
  finiteVec3(pole.group.position, 'frame ' + i + ' vị trí pole');
  if (i % 120 === 0) {
    pole.group.updateMatrixWorld(true);
    pole.headGroup.getWorldPosition(headWorld);
    check(headWorld.y > 1.0 && headWorld.y < 2.3, 'frame ' + i + ' vương miện ở độ cao đầu (' + headWorld.y.toFixed(2) + 'm)');
    finiteVec3(headWorld, 'frame ' + i + ' headGroup world');
  }
}
check(Math.abs(minR - pc.orbitRadius) < 0.02 && Math.abs(maxR - pc.orbitRadius) < 0.02,
  'bán kính bám cột luôn 0,34m (min ' + minR.toFixed(3) + ', max ' + maxR.toFixed(3) + ')');
check(sawSpin, 'đã thấy trạng thái xoay cột trong 35s');
const laps = (maxAngle - pc.idleAngle) / (Math.PI * 2);
check(laps >= 2, 'xoay >= 2 vòng trong 35s (được ' + laps.toFixed(2) + ' vòng)');

console.log('[6] Skill rose trên model: clip skill -> về idle');
const queued = mgr.enqueueSkill(pole, 'rose', time);
check(queued, 'enqueueSkill(rose) nhận');
let skillRan = false;
let endTime = time + 8;
while (time < endTime) {
  time += dt;
  const beatPhase = ((time * bpm) / 60) % 1;
  mgr.update(dt, time, beatPhase);
  if (pole.skillKind) skillRan = true;
  assertAllMatricesFinite(modelRoot, 'skill frame t=' + time.toFixed(2));
}
check(skillRan, 'skill rose đã chạy trên pole dancer');
check(pole.skillKind === null, 'hết skill, skillKind=null');
check(Math.abs(pole.poleActions.idle.getEffectiveWeight() - 1) < 0.05,
  'sau skill idle weight về ~1 (' + pole.poleActions.idle.getEffectiveWeight().toFixed(3) + ')');
check(pole.poleActions.skill.getEffectiveWeight() < 0.05,
  'sau skill skill weight về ~0 (' + pole.poleActions.skill.getEffectiveWeight().toFixed(3) + ')');

console.log(failures === 0 ? 'PASS: pole-model-harness' : 'FAIL: ' + failures + ' kiểm chứng rớt');
process.exit(failures === 0 ? 0 : 1);
