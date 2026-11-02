// events.js — event bus nội bộ của cảnh bar.
// Mọi nguồn sự kiện (relay thật ở pha sau, demo test-only) đều emit qua đây
// với đúng 1 định dạng event, để logic cảnh không phụ thuộc nguồn dữ liệu.
//
// Định dạng event:
//   { type: 'chat' | 'like' | 'follow' | 'gift',
//     user: { name: string, uniqueId: string, avatar: string },
//     text: string,            // chat: nội dung; các loại khác có thể rỗng
//     giftName: string,        // gift
//     diamonds: number,        // gift: kim cương / 1 món
//     count: number }          // like/gift: số lượng
//
// Dùng: BarEvents.on('chat', fn) / BarEvents.emit(evt)
//       BarEvents.on('*', fn) nhận mọi loại.

const listeners = new Map();

function normalizeEvent(evt) {
  const user = evt && evt.user ? evt.user : {};
  return {
    type: evt ? evt.type : '',
    user: {
      name: user.name || user.uniqueId || 'Khách',
      uniqueId: String(user.uniqueId || user.name || 'guest'),
      avatar: user.avatar || '',
    },
    text: evt && evt.text ? String(evt.text) : '',
    giftName: evt && evt.giftName ? String(evt.giftName) : '',
    diamonds: Number(evt && evt.diamonds ? evt.diamonds : 0) || 0,
    count: Number(evt && evt.count ? evt.count : 1) || 1,
  };
}

export const BarEvents = {
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type).delete(fn);
  },

  emit(rawEvt) {
    const evt = normalizeEvent(rawEvt);
    const fire = (set) => {
      if (!set) return;
      set.forEach((fn) => {
        try {
          fn(evt);
        } catch (err) {
          console.error('[BarEvents] listener lỗi:', err);
        }
      });
    };
    fire(listeners.get(evt.type));
    fire(listeners.get('*'));
  },
};
