// main.js — nối scene + dancer + nhạc + HUD + event bus lại với nhau.
// Nguồn sự kiện duy nhất khi live thật sẽ là relay (pha relay điền vào
// js/relay.js); hiện tại chỉ có demo test-only (?demo=1) phát event giả.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BarEvents } from './events.js';
import { Relay } from './relay.js';
import { MusicEngine } from './audio.js';
import { createBarScene } from './scene.js';
import { DancerManager, matchCommand, selectTopDonor } from './dancers.js';
import { maybeStartDemo } from './demo.js';

const params = new URLSearchParams(window.location.search);
const fpsWanted = params.get('fps') === '1';

const container = document.getElementById('scene-container');
const renderer = new THREE.WebGLRenderer({
  antialias: CONFIG.renderer.antialias,
  powerPreference: 'low-power',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.pixelRatioCap));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = CONFIG.renderer.shadowsEnabled;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  container.clientWidth / container.clientHeight,
  CONFIG.camera.near,
  CONFIG.camera.far,
);
camera.position.set(...CONFIG.camera.basePosition);
camera.lookAt(...CONFIG.camera.lookAt);
const cameraBase = new THREE.Vector3(...CONFIG.camera.basePosition);
const cameraZoom = new THREE.Vector3(...CONFIG.camera.zoomPosition);
let zoomUntil = 0;

const barScene = createBarScene();
const music = new MusicEngine();
const dancers = new DancerManager(barScene.scene, {
  onRing: (pos) => barScene.spawnRing(pos),
  onFireworks: (pos, colorHex) => barScene.spawnFireworks(pos, colorHex || CONFIG.floor.beatColors[2]),
  onCameraZoom: () => { zoomUntil = performance.now() / 1000 + CONFIG.camera.zoomDurationSeconds; },
  onVipSpotlight: (on) => barScene.setVipSpotlight(on),
  // [Skill nhảy 21:47 — bổ sung tối thiểu] DJ pad cho skill lớn (audio.js
  // thuộc agent nhạc; thiếu hook này thì skill vẫn chạy, chỉ không có tiếng pad).
  onSkillPad: (name) => music.triggerPad(name),
});

// ---- HUD: ticker + bảng top gifter ----
const tickerEl = document.getElementById('ticker');
const topListEl = document.getElementById('top-list');
const giftTotals = new Map();

function addTicker(text) {
  const item = document.createElement('div');
  item.className = 'ticker-item';
  item.textContent = text;
  tickerEl.prepend(item);
  while (tickerEl.children.length > CONFIG.events.tickerMaxItems) {
    tickerEl.removeChild(tickerEl.lastChild);
  }
  window.setTimeout(() => item.remove(), CONFIG.events.tickerDurationMs);
}

function renderTopBoard() {
  const ranked = [...giftTotals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, CONFIG.gifts.topBoardMax);
  topListEl.innerHTML = '';
  ranked.forEach(([id, entry], index) => {
    const row = document.createElement('div');
    row.className = 'top-row';
    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
    row.textContent = `${medal} ${entry.name} — ${entry.total} 💎`;
    if (index === 0) row.classList.add('top-first');
    topListEl.appendChild(row);
  });
  if (ranked.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'top-empty';
    empty.textContent = 'Chưa có gift';
    topListEl.appendChild(empty);
  }
}

// ---- Bàn DJ: top donor (tổng 💎 cao nhất) đứng chơi DJ ----
// Chạy sau mỗi gift. Hòa điểm thì giữ người đang đứng (selectTopDonor).
// Chưa có gift nào thì bàn trống. Gift demo cũng đi qua đây nên demo
// cũng đưa top donor demo lên bàn DJ để xem trước được.
function updateDjSpot() {
  const current = dancers.getDjDancer ? dancers.getDjDancer() : null;
  const currentId = current ? String(current.user.uniqueId) : null;
  const topId = selectTopDonor(giftTotals, currentId);
  if (topId === null) {
    dancers.clearDjDancer();
    return;
  }
  if (currentId === topId) return; // vẫn là top (kể cả hòa) → giữ nguyên
  const entry = giftTotals.get(topId);
  const dancer = dancers.addOrGet({
    name: (entry && entry.name) || topId,
    uniqueId: topId,
    avatar: (entry && entry.avatar) || '',
  });
  // Sàn đầy và không nhường được chỗ → giữ người đang đứng, thử lại ở gift sau.
  if (!dancer) return;
  dancers.setDjDancer(dancer);
}

function giftTierFor(diamonds) {
  for (const tier of CONFIG.gifts.tiers) {
    if (diamonds <= tier.maxDiamonds) return tier;
  }
  return CONFIG.gifts.tiers[CONFIG.gifts.tiers.length - 1];
}

// ---- Xử lý event live → hiệu ứng (mọi ngưỡng từ config.js) ----
function handleEvent(evt) {
  const now = performance.now() / 1000;
  if (evt.type === 'chat') {
    const command = matchCommand(evt.text);
    if (command) {
      dancers.applyCommand(evt.user, command, now);
      addTicker(`${CONFIG.hud.tickerPrefixChat} ${evt.user.name}: ${evt.text}`);
    } else if (CONFIG.events.chatJoinsFloor) {
      const dancer = dancers.addOrGet(evt.user);
      if (dancer) dancers.boost(dancer, CONFIG.dancers.energyBoostChat);
      addTicker(`${CONFIG.hud.tickerPrefixChat} ${evt.user.name}: ${evt.text}`);
    }
  } else if (evt.type === 'like') {
    const dancer = dancers.get(evt.user.uniqueId);
    if (dancer) {
      dancers.boost(dancer, CONFIG.dancers.energyBoostLike);
    } else if (evt.count >= CONFIG.events.likeJoinThreshold) {
      dancers.addOrGet(evt.user);
    }
  } else if (evt.type === 'follow') {
    if (CONFIG.events.followJoinsFloor) {
      const dancer = dancers.addOrGet(evt.user);
      if (dancer) dancers.boost(dancer, CONFIG.dancers.energyBoostFollow);
    }
    addTicker(`${CONFIG.hud.tickerPrefixFollow} ${evt.user.name} đã follow`);
  } else if (evt.type === 'gift') {
    const totalDiamonds = evt.diamonds * evt.count;
    const tier = giftTierFor(totalDiamonds);
    // [Skill nhảy 21:47 — bổ sung tối thiểu] truyền tên gift + tổng kim
    // cương để dancers.js xếp skill (hoa hồng / gift lớn) vào hàng đợi.
    if (CONFIG.events.giftJoinsFloor) {
      dancers.applyGift(evt.user, tier, now, { giftName: evt.giftName, totalDiamonds });
    }
    const id = evt.user.uniqueId;
    const prev = giftTotals.get(id) || { name: evt.user.name, total: 0, avatar: '' };
    prev.name = evt.user.name;
    prev.avatar = evt.user.avatar || prev.avatar || '';
    prev.total += totalDiamonds;
    giftTotals.set(id, prev);
    renderTopBoard();
    updateDjSpot();
    addTicker(
      `${CONFIG.hud.tickerPrefixGift} ${evt.user.name} tặng ${evt.giftName} ×${evt.count} (${totalDiamonds} 💎)`,
    );
  }
}
BarEvents.on('*', handleEvent);

// ---- Relay stub: chưa nối thật, chỉ hiện trạng thái ----
Relay.connect({});

// ---- Nút nhạc / FPS / Bắt đầu (unlock audio) ----
const musicBtn = document.getElementById('btn-music');
const fpsBtn = document.getElementById('btn-fps');
const fpsEl = document.getElementById('fps-counter');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('btn-start');

let fpsVisible = fpsWanted;
function applyFpsVisibility() {
  fpsEl.hidden = !fpsVisible;
  fpsBtn.setAttribute('aria-pressed', String(fpsVisible));
}
applyFpsVisibility();
fpsBtn.addEventListener('click', () => {
  fpsVisible = !fpsVisible;
  applyFpsVisibility();
});

function refreshMusicButton() {
  musicBtn.textContent = music.playing ? '🔊 Nhạc: Bật' : '🔇 Nhạc: Tắt';
  musicBtn.setAttribute('aria-pressed', String(music.playing));
}
refreshMusicButton();
musicBtn.addEventListener('click', () => {
  music.unlock();
  music.toggle();
  refreshMusicButton();
});

startBtn.addEventListener('click', () => {
  music.unlock();
  if (CONFIG.music.startOnUnlock && !music.playing) music.start();
  refreshMusicButton();
  startOverlay.hidden = true;
  // Toàn màn hình khi live: ẩn thanh địa chỉ + thanh trạng thái để cảnh to nhất.
  // Không ép được thì vẫn chạy bình thường (không chặn nhạc/sàn).
  try {
    const p = document.documentElement.requestFullscreen
      && document.documentElement.requestFullscreen();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* bỏ qua */ }
});

// Demo test-only (?demo=1) — mặc định tắt.
maybeStartDemo();
renderTopBoard();

// ---- Resize: giữ khung NGANG, camera theo đúng tỉ lệ viewport ----
function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
document.addEventListener('fullscreenchange', () => window.setTimeout(onResize, 100));
window.addEventListener('orientationchange', () => window.setTimeout(onResize, 300));

// ---- Animation loop: delta clamp + nhịp theo BPM ----
const clock = new THREE.Clock();
let elapsed = 0;
let lastBeatIndex = -1;
let frames = 0;
let fpsLastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), CONFIG.renderer.maxDeltaSeconds);
  elapsed += dt;

  const beatsPerSecond = CONFIG.music.bpm / 60;
  const beatFloat = elapsed * beatsPerSecond;
  const beatIndex = Math.floor(beatFloat);
  const beatPhase = beatFloat - beatIndex;
  if (beatIndex !== lastBeatIndex) {
    lastBeatIndex = beatIndex;
    barScene.pulseBeat(beatIndex);
  }

  dancers.update(dt, elapsed, beatPhase);
  barScene.update(dt, elapsed);

  // Camera: skill nhảy đang chạy thì lia theo dancer (pose do
  // DancerManager cung cấp); hết skill thì về góc rộng / zoom gift như cũ.
  // [Skill nhảy 21:47 — bổ sung tối thiểu, hành vi cũ giữ nguyên khi không skill.]
  const nowSeconds = performance.now() / 1000;
  const skillPose = dancers.getSkillCameraPose ? dancers.getSkillCameraPose() : null;
  if (skillPose) {
    camera.position.lerp(skillPose.position, Math.min(1, dt * skillPose.lerpSpeed));
    camera.lookAt(skillPose.lookAt);
  } else {
    const target = nowSeconds < zoomUntil ? cameraZoom : cameraBase;
    camera.position.lerp(target, Math.min(1, dt * CONFIG.camera.zoomLerpSpeed));
    camera.lookAt(...CONFIG.camera.lookAt);
  }

  renderer.render(barScene.scene, camera);

  // FPS debug.
  frames += 1;
  const nowMs = performance.now();
  if (nowMs - fpsLastTime >= CONFIG.hud.fpsUpdateIntervalMs) {
    const fps = Math.round((frames * 1000) / (nowMs - fpsLastTime));
    frames = 0;
    fpsLastTime = nowMs;
    if (fpsVisible) fpsEl.textContent = `${fps} FPS`;
  }
}
animate();
