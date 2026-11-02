# Đi Bar 5.0 — Sàn nhảy 3D (bản NGANG 16:9)

Sàn nhảy 3D nhẹ cho live TikTok kiểu “Đi bar 5.0”: khán giả chat / like /
follow / gift thì avatar của họ lên sàn nhảy. **Bản NGANG (landscape 16:9)**,
đúng như video mẫu: khi phát qua TikTok Mobile gaming (chia sẻ màn hình),
game ngang sẽ bị letterbox trong khung dọc của TikTok — **đó là ý đồ, không
phải lỗi**. Không làm layout dọc 9:16 cho dự án này.

Trang tĩnh, không build step: Three.js qua CDN (import map, ghim `0.160.0`),
nhạc tổng hợp bằng WebAudio (không bản quyền), tối ưu cho điện thoại yếu
(Redmi Note 9, Android 11, RAM 3GB).

## Cấu trúc

```
bar-live/
├── index.html        # Khung ngang + HUD + import map Three.js 0.160.0
├── config.js         # DUY NHẤT nơi chứa ngưỡng/hiệu ứng — sửa ở đây, đừng hardcode chỗ khác
├── package.json      # Chỉ để `node --check` hiểu ES module; deploy không cần
├── css/
│   └── style.css     # HUD bản ngang
├── js/
│   ├── main.js       # Nối scene + dancer + nhạc + HUD + event bus
│   ├── scene.js      # Sàn lưới, disco, DJ booth (trái), VIP (phải), bàn DJ sau lưng, pháo hoa
│   ├── dancers.js    # Dancer chibi meme + avatar + tên + lệnh chat + gift + skill nhảy
│   ├── audio.js      # Nhạc WebAudio: kick/bass/hat theo BPM, không bản quyền
│   ├── events.js     # Event bus BarEvents.emit/on, định dạng event chuẩn
│   ├── relay.js      # Nối thật EulerStream Cloud WS (free Community) — xem mục Relay live
│   └── demo.js       # Demo TEST-ONLY (?demo=1), mặc định TẮT
└── README.md
```

## Cách hoạt động

- **Lên sàn:** chat / follow / gift đưa người xem lên sàn (tối đa
  `dancers.maxDancers` trong `config.js`). Like đủ `likeJoinThreshold` mới
  lên sàn (chống spam); like ít hơn chỉ tăng năng lượng cho dancer đã có.
- **Nhân vật chibi meme** (theo ảnh tham chiếu, `CONFIG.dancers.chibi`):
  đầu to tròn, tóc đen cắt bát úp (nắp cầu đội lên đầu, mái phủ trán),
  mặt trắng vẽ nét đen bằng canvas texture — 4 biến thể biểu cảm
  (cười há to, cười nhe răng, đeo kính tròn, tinh nghịch nháy mắt),
  áo thun xám (nhiều sắc độ), quần short tối màu, tay chân nhỏ trắng
  (tay áo xám ngắn). Không asset ngoài, không tải ảnh từ mạng:
  geometry/material/texture mặt dùng chung cho mọi dancer, máy yếu vẫn nhẹ.
  Tên + avatar viewer nổi TRÊN đầu (Sprite luôn quay về camera), không che
  mặt. Lệnh `đổi nv` đổi biểu cảm mặt + sắc độ áo (tóc giữ nguyên).
  Nhân vật thu nhỏ còn **80%** (`CONFIG.dancers.scale = 0.8`, user lệnh
  22:14) để đông người không che hết sàn; tối đa **12 dancer** trên lưới
  3 hàng × 4 cột, vẫn dùng chung geometry/material.
- **Bàn DJ sau lưng** (`CONFIG.djTable`): bàn + 2 mâm đĩa quay ngược chiều
  + mixer + dải neon + 2 loa, đặt giữa cảnh sau lưng các dancer, trước
  quầy bar. **Top donor** (người có tổng 💎 cao nhất, bảng TOP GIFT) đứng
  vào bàn chơi DJ: tay đưa ra trước đặt lên bàn, nhún nhẹ theo nhịp.
  Đổi top thì người cũ lerp về lại sàn, người mới lerp lên bàn (không
  nhảy cắt); **hòa điểm thì giữ người đang đứng** (không nhấp nháy);
  chưa có gift nào thì bàn để trống, không dancer giả. Dancer ở bàn DJ
  được bảo vệ khỏi bị đẩy khỏi sàn khi sàn đầy, không bị kéo lên bục VIP
  hay đi vòng; nhận gift thì skill chạy tại chỗ ở bàn DJ rồi về lại tư
  thế DJ. Gift demo (`?demo=1`) cũng đưa top donor demo lên bàn DJ.
- **Vương miện vàng trên đầu top donor** (`CONFIG.dancers.crown`, user
  lệnh 22:26): chỉ có ĐÚNG 1 chiếc, vòng vàng + 5 chóp + hạt ngọc đỏ,
  đội trên đỉnh tóc bát úp (cùng độ nghiêng với tóc, không che mặt),
  tự theo scale 0.8 và mọi animation (nhảy, santo, tư thế DJ). Chuyển
  sang người mới cùng lúc với việc đổi người ở bàn DJ; hòa điểm giữ
  nguyên; chưa có gift thì không có vương miện nào; nhãn tên/avatar
  được nâng lên một chút khi đội để khỏi chạm chóp. Demo `?demo=1`
  thấy được vương miện trên top donor demo.
- **Lệnh chat tiếng Việt** (không phân biệt hoa/thường/dấu, lệnh nằm trong
  câu cũng nhận): `nhảy` (nhảy mạnh), `đổi nv` (đổi biểu cảm mặt + sắc độ
  áo xám ngẫu nhiên), `đi vòng` (đi vòng quanh sàn). Thêm lệnh = thêm chuỗi vào
  `CONFIG.commands` trong `config.js`.
- **Gift theo mức kim cương** (`CONFIG.gifts.tiers`):
  - Nhỏ → dancer nhảy mạnh + vòng sáng quanh người.
  - Trung → zoom camera + đổi nhân vật.
  - Lớn (VIP) → spotlight + pháo hoa particle + đưa top gifter lên bục VIP.
  - Bảng top gifter tối đa 5 người, gọn ở cạnh phải.
- **Skill nhảy theo gift** (`CONFIG.skills`, xếp hàng FIFO — mỗi skill chạy
  trọn rồi mới tới skill sau, tối đa 6 skill chờ):
  - **1 hoa hồng** (tên gift là hoa hồng/Rose, tổng ≤ 9 💎): camera lia
    mượt tới đúng dancer của người tặng, dancer giơ 2 tay lên và nhảy.
  - **Gift lớn** (tổng ≥ 10 💎, tức tier trung trở lên): camera lia vào
    dancer, dancer nhảy santo 1 vòng trọn 360°, pháo bông bắn 3 đợt đổi
    màu, kèm âm DJ pad (riser + impact). Tier lớn (VIP) giữ nguyên lên
    bục + spotlight, cộng thêm skill này.
  - Hết skill, camera tự quay về góc rộng. Mọi ngưỡng/thời lượng trong
    `CONFIG.skills`; sửa số là sửa config, không sửa code.
  - **Framing lúc santo** (sửa 22:29, lỗi thấy trên máy test: giữa vòng
    dancer rớt khỏi khung, khung chỉ còn pháo/trời): cú lộn xoay quanh
    gốc ở chân nên tâm người hạ theo cos(góc lộn) — camera giờ bám tâm
    người (tính từ hình học thật, có scale) thay vì nhìn chằm vào
    gốc+1.2m; dancer ở bàn DJ thì camera lùi ra thêm để cả bàn trong khung.
- **Bộ động tác nhảy thường** (`CONFIG.dancers.danceMoves`, user lệnh
  22:29): ngoài nhún/lắc nền, dancer đổi động tác theo ranh giới bar
  nhạc (BPM trong config), mỗi người lệch pha/ngẫu nhiên riêng: xoay
  vòng 360° (thi thoảng), bước ngang, vung tay, bật nhảy, lắc hông.
  Chỉ loanh quanh trong ô rồi về đúng ô; DJ giữ tư thế DJ; skill đè
  lên rồi về lại bộ này; vương miện theo mọi động tác.
- **Nhạc:** 9 track file Mixkit Free License (house/EDM, xem `audio/MUSIC.md`)
  chạy nối tiếp không ngừng, synth WebAudio làm fallback; BPM trong
  `config.js`. Trình duyệt điện thoại cần 1 chạm để unlock
  audio → nút **Bắt đầu** khi mở trang.
- **FPS debug:** nút `FPS` trên màn hình, hoặc mở với `?fps=1`.
- **Hiệu năng:** không shadow map, không antialias, `pixelRatio` cap thấp,
  low-poly primitive, delta clamp trong animation loop. Mọi ngưỡng trong
  `config.js`.

## Chạy local (test trên máy tính)

```bash
cd ~/workspace/bar-live
python3 -m http.server 8000
# Mở: http://localhost:8000/
# Test hiệu ứng với người xem giả: http://localhost:8000/?demo=1
# Test FPS: http://localhost:8000/?fps=1
```

### Xem trước skill nhảy (demo, trước khi live thật)

Mở `http://localhost:8000/?demo=1` (hoặc URL đã deploy + `?demo=1`), bấm
**Bắt đầu** để unlock nhạc, rồi dùng cụm nút cuối màn hình:

- **🌹 Tặng 1 hoa hồng** — skill hoa hồng chạy ngay trên dancer "Bạn Demo":
  camera lia vào, giơ 2 tay lên và nhảy.
- **🎆 Tặng gift lớn** — skill lớn trên cùng dancer: camera lia, santo 1 vòng,
  pháo bông 3 đợt đổi màu, kèm âm DJ pad. "Bạn Demo" nhận 1000 💎 nên
  cũng thành top donor → lên đứng bàn DJ sau lưng (xem được ngay trong demo).
- **➕ Thêm dancer** — thêm 1 dancer giả lên sàn (tối đa 12).
- **⏸ Auto demo: Bật/Tắt** — tạm dừng dòng event giả tự động để xem skill
  lẻ cho rõ (mặc định auto chạy).

Không có `?demo=1` thì các nút này không hiện và không có người xem giả.
**CẤM mở `?demo=1` khi phát sóng thật.**

Cần mạng để tải Three.js từ CDN jsdelivr. Trang chạy bằng HTTP server cục
bộ là đủ (module ES + import map không chạy tốt qua `file://`).

## Deploy static (hosting HTTPS công cộng)

Đây là trang tĩnh thuần — deploy ở bất kỳ host static nào cũng được
(GitHub Pages, Netlify, Vercel, Cloudflare Pages, hoặc bất kỳ static host
nào). Chỉ cần:

1. Upload toàn bộ thư mục `bar-live/` (giữ nguyên cấu trúc, `index.html` ở gốc).
2. Đảm bảo site chạy qua **HTTPS** (TikTok Mobile gaming / trình duyệt điện
   thoại yêu cầu HTTPS cho trải nghiệm ổn định).
3. Không cần server, database, biến môi trường hay build step. Relay nối
   thẳng từ trình duyệt tới EulerStream qua `wss://` — xem mục Relay live.

## Phát sóng bằng điện thoại (tóm tắt)

1. Mở trang đã deploy bằng **Chrome trên Redmi, xoay ngang điện thoại**
   (khung ngang 16:9).
2. Bấm **Bắt đầu** (unlock nhạc), kiểm tra sàn nhảy chạy mượt, FPS ổn.
3. Mở TikTok → **LIVE → Mobile gaming** → chọn **tag game NGANG** → bắt đầu
   chia sẻ màn hình, chuyển về Chrome đang mở trang bar.
4. Stream sẽ letterbox (game ngang trong khung dọc) như video mẫu — bình thường.
5. **Chủ phòng PHẢI nói chuyện / tương tác thật xuyên suốt buổi live** (đọc
   chat, gọi tên người xem, phản hồi gift). Không để trang tự chạy im lặng.

## Lưu ý chính sách — đọc kỹ

- **Không xin gift:** HUD cố tình KHÔNG có bất kỳ chữ nào xin gift / kêu gọi
  tặng quà. Chỉ có bảng top, ticker sự kiện nhỏ, nút nhạc + FPS.
- **Không AutoSim / không giả lập người xem khi live thật:** chế độ demo
  (`?demo=1`) chỉ để test trên máy tính. **CẤM bật demo khi phát sóng.**
  Khi live thật, nguồn sự kiện duy nhất là relay thật.
- **Chủ phòng tương tác thật:** trang chỉ là cảnh nền tương tác; người chủ
  phòng vẫn phải nói chuyện và phản hồi khán giả trong suốt buổi live.
- **Nhạc không bản quyền:** nhạc nền là 9 track Mixkit Free License
  (thương mại được, không cần ghi công) + synth WebAudio fallback,
  không dùng nhạc thương mại, không file không rõ quyền.

## Relay live — EulerStream (MIỄN PHÍ vĩnh viễn, Community)

Trang tĩnh mở thẳng WebSocket tới `wss://ws.eulerstream.com`; server
EulerStream giữ kết nối TikTok, giải mã protobuf và gửi JSON về. Không cần
SDK hay server riêng — `js/relay.js` build URL + parse JSON tay (đã đối
chiếu với SDK `@eulerstream/euler-websocket-sdk@1.1.0`).

**Lấy key (user làm 1 lần, miễn phí, KHÔNG cần thẻ):** đăng ký tài khoản
tại eulerstream.com → gói **Community** (free vĩnh viễn: 2.500 req/ngày,
25 cloud WebSocket) → lấy **API key** trong dashboard. **Không dùng key
demo/chung, không mua gói.**

**Mở trang lúc live:**

```
https://<trang-da-deploy>/?user=meta.muse.ai1&apiKey=<API-KEY>
```

Key đọc xong sẽ bị xóa khỏi thanh địa chỉ (history.replaceState) để khỏi
lộ khi share màn hình. Không có key → relay báo "chưa có key", cảnh vẫn
chạy bình thường. Reconnect tự động có backoff (tối đa 12 lần), key sai
(4401) thì dừng và báo lỗi.

**Đã kiểm chứng (02/11/2026, không cần live đang chạy):** nối thật tới
`ws.eulerstream.com` — không key → đóng 4400; key giả → đóng 4401; URL
build tay khớp SDK; mapping chat/gift-streak-delta/like/follow đã test
bằng message giả qua `BarEvents`.

**Chưa kiểm chứng (cần key thật + kênh đang live):** envelope JSON thật,
field avatar, heuristic follow, gift combo thật. Kiểm chứng 1 event mỗi
loại trên Redmi trước buổi live thật.

## TODO — còn lại

- [ ] Kiểm chứng trên Redmi thật: FPS, nhiệt độ, pin, âm thanh, avatar load
      qua mạng di động, độ ổn định khi live dài.
- [ ] Kiểm chứng relay với key thật + kênh đang live: 1 event thật mỗi loại
      (chat/like/follow/gift) + avatar hiển thị đúng.
- [ ] Kiểm chứng letterbox + tag game ngang trong TikTok Mobile gaming thật.
- [ ] Tuning `config.js` theo máy thật (số dancer tối đa, pixelRatio, BPM).

## Đã kiểm chứng / chưa kiểm chứng

- ✅ Đã kiểm chứng (pha build): `node --check` mọi file JS; HTTP server cục
  bộ + `curl` trả 200 cho `index.html` và đủ file JS/CSS.
- ✅ Đã kiểm chứng (pha relay, 02/11/2026): nối thật `wss://ws.eulerstream.com`
  (4400 không key / 4401 key giả); URL build tay khớp SDK; mapping message
  giả qua `BarEvents` (chat / gift streak delta / like / follow).
- ❌ Chưa kiểm chứng: hiệu năng trên Redmi thật, âm thanh trên điện thoại,
  relay với key thật + event thật, phát sóng Mobile gaming thật. Cần pha
  test trên máy thật.
