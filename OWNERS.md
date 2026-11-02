# OWNERS.md — Ai phụ trách phần nào (bar-live)

Lệnh của sếp 23:21 02/11: mỗi agent phụ trách 1 phần, sau này gặp lỗi fix cho lẹ.
Quy tắc chung cho mọi owner: chỉ sửa file của phần mình; không chạm điện thoại/live;
trước khi push phải `git pull --rebase`, chạy `npm run check` + harness của phần mình;
đụng độ file với agent khác thì DỪNG và báo về agent chính, không tự merge đè.

| Phần | Owner | File | Kiểm chứng |
|---|---|---|---|
| Sàn + ánh sáng + camera | agent-scene | `js/scene.js`, `index.html`, `css/style.css` | `npm run check`, chụp màn hình build |
| Dancer + skill + vương miện | agent-dancers | `js/dancers.js`, `CONFIG.dancers`, `CONFIG.skills` | harness dancer (xem README), `npm run check` |
| Relay sự kiện live | agent-relay | `js/relay.js`, `CONFIG.relay` | `npm run check`, kiểm chứng nối EulerStream |
| Engine nhạc (phát, chuyển track) | agent-audio | `js/audio.js`, `CONFIG.music` (trừ `tracks`) | harness audio, `npm run check` |
| Nhạc DJ + catalog track | agent-music (đang chạy đợt 3) | `audio/*.mp3`, `audio/MUSIC.md`, `CONFIG.music.tracks` | đo BPM 2 cách, MD5 khác nhau, tổng <10MB |
| Sự kiện + lệnh chat + demo | agent-chính (đệ) | `js/events.js`, `js/demo.js`, `js/main.js`, `config.js` (khung chung) | `npm run check`, test `?demo=1` trên Redmi |

Ghi chú:
- `config.js` là file chung: owner nào sửa phần của mình thì chỉ sửa đúng khối đó.
- Mọi thay đổi lên live đều phải qua 1 lần reload trang + bấm Bắt đầu lại (do agent chính
  cầm điện thoại), không agent nào tự reload.
- Fullscreen khi bấm Bắt đầu (đã có trong `js/main.js`) không được gỡ.
