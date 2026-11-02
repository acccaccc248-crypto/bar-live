// demo.js — CHẾ ĐỘ DEMO TEST-ONLY. Mặc định TẮT.
// Chỉ chạy khi URL có ?demo=1. Sinh người xem GIẢ (chat/gift/like/follow
// ngẫu nhiên) để kiểm tra cảnh + hiệu ứng trên máy tính, KHÔNG có dữ liệu thật.
//
// Nút bấm thử skill (chỉ hiện khi ?demo=1): bấm là skill chạy ngay trên
// dancer demo, không cần live thật hay key relay — để user xem trước.
// Khi không có ?demo=1: không nút demo, không người xem giả.
//
// CẤM dùng khi live thật: giả lập người xem khi phát sóng là gian lận tương tác,
// vi phạm chính sách TikTok. Khi live thật, relay thật là nguồn sự kiện duy nhất.
// File này không tự chạy nếu thiếu ?demo=1.

import { CONFIG } from '../config.js';
import { BarEvents } from './events.js';

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fakeUser(name, index) {
  return {
    name,
    uniqueId: `demo_${index}_${name}`,
    avatar: '',
  };
}

export function maybeStartDemo() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') !== '1') return false;

  console.warn('[Demo] TEST-ONLY: đang sinh người xem GIẢ (?demo=1). CẤM dùng khi live thật.');
  const badge = document.getElementById('demo-badge');
  if (badge) badge.hidden = false;
  const controls = document.getElementById('demo-controls');
  if (controls) controls.style.display = 'flex';

  const names = CONFIG.demo.fakeNames;
  let tick = 0;
  let addIndex = 0;

  function emitRandom() {
    tick += 1;
    const name = pick(names);
    const user = fakeUser(name, tick % names.length);
    const roll = Math.random();
    if (roll < 0.45) {
      BarEvents.emit({ type: 'chat', user, text: pick(CONFIG.demo.fakeChats) });
    } else if (roll < 0.65) {
      BarEvents.emit({ type: 'like', user, count: 5 + Math.floor(Math.random() * 20) });
    } else if (roll < 0.75) {
      BarEvents.emit({ type: 'follow', user });
    } else {
      const gift = pick(CONFIG.demo.fakeGifts);
      BarEvents.emit({ type: 'gift', user, giftName: gift.giftName, diamonds: gift.diamonds, count: gift.count });
    }
  }

  // Auto demo: chạy sẵn, bấm nút để tạm dừng khi muốn xem skill lẻ cho rõ.
  let timerId = null;
  const autoBtn = document.getElementById('btn-demo-auto');
  function refreshAutoBtn() {
    if (!autoBtn) return;
    autoBtn.textContent = timerId !== null ? '⏸ Auto demo: Bật' : '▶️ Auto demo: Tắt';
    autoBtn.setAttribute('aria-pressed', String(timerId !== null));
  }
  function startAuto() {
    if (timerId === null) timerId = window.setInterval(emitRandom, CONFIG.demo.intervalMs);
    refreshAutoBtn();
  }
  function stopAuto() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
    refreshAutoBtn();
  }
  if (autoBtn) {
    autoBtn.addEventListener('click', () => {
      if (timerId !== null) stopAuto();
      else startAuto();
    });
  }
  startAuto();

  // --- Nút bấm thử skill (xem trước, không cần live thật) ---
  // Cùng một user demo cho cả 2 nút gift để skill lia đúng dancer của họ.
  const skillUser = { name: 'Bạn Demo', uniqueId: 'demo_skill_viewer', avatar: '' };

  const roseBtn = document.getElementById('btn-demo-rose');
  if (roseBtn) {
    roseBtn.addEventListener('click', () => {
      BarEvents.emit({ type: 'gift', user: skillUser, giftName: 'Hoa hồng', diamonds: 1, count: 1 });
    });
  }

  const grandBtn = document.getElementById('btn-demo-grand');
  if (grandBtn) {
    grandBtn.addEventListener('click', () => {
      BarEvents.emit({ type: 'gift', user: skillUser, giftName: 'Lâu đài', diamonds: 1000, count: 1 });
    });
  }

  const addBtn = document.getElementById('btn-demo-add');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const name = names[addIndex % names.length];
      addIndex += 1;
      BarEvents.emit({ type: 'follow', user: fakeUser(name, 100 + addIndex) });
    });
  }

  return () => stopAuto();
}
