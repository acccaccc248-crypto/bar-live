# Deploy trang bar-live — hướng dẫn + lệnh chính xác

Trang là site tĩnh thuần (HTML + ES modules + CDN jsDelivr), KHÔNG build,
KHÔNG biến môi trường, KHÔNG backend. Deploy = upload đúng cấu trúc thư mục,
`index.html` ở gốc, chạy qua HTTPS.

## Bản đã kiểm chứng (02/11/2026, đối chiếu file thật)

Đủ file để deploy, agent hosting đã tự kiểm chứng lại (không chỉ tin báo
của agent cảnh):

```
bar-live/
├── index.html        # Khung ngang + HUD + import map Three.js 0.160.0
├── config.js         # Mọi ngưỡng/hiệu ứng; CONFIG.three.version = 0.160.0
├── package.json      # private, type module, KHÔNG dependencies, KHÔNG build
│                     # script — chỉ có `check` cho `node --check`; deploy tĩnh
│                     # không cần file này (để lại cũng vô hại)
├── css/style.css
├── js/               # main.js, scene.js, dancers.js, audio.js, events.js,
│                     # relay.js (NỐI THẬT EulerStream Cloud WS, free), demo.js (?demo=1)
└── README.md         # Chạy local: python3 -m http.server 8000
```

- `npm run check` (node --check 8 file JS): exit 0.
- Import map trong `index.html` khớp `CONFIG.three` trong `config.js`:
  `three@0.160.0` từ `cdn.jsdelivr.net`. Điểm nối ngoài THỨ HAI: relay mở
  `wss://ws.eulerstream.com` trực tiếp từ trình duyệt (chỉ khi có key, xem
  mục 7) — không còn URL ngoài nào khác.
- Mọi `id` mà `js/*.js` gọi bằng `getElementById` đều có trong `index.html`
  (scene-container, ticker, top-list, btn-music, btn-fps, fps-counter,
  start-overlay, btn-start, relay-status, demo-badge).
- Tunnel tạm pinggy đã trả `GET / HTTP/1.1 200` qua HTTPS (xem mục 5).

File `vercel.json` trong thư mục này chỉ là bản staging: khi deploy Vercel
thì copy về gốc rồi deploy (xem mục 1).

## 1. Vercel — phương án khả thi nhất (khuyến nghị)

Điều kiện: tài khoản Vercel + đăng nhập CLI. Trên VM này CHƯA có:
`VERCEL_TOKEN` unset, `/opt/hatch/bin/vercel` KHÔNG phải Vercel CLI thật
(mà là shim MCP của Hatch, `vercel status` = `not_connected`) — phải dùng
CLI thật qua `npx` (gói `vercel` có trên npm registry, đã kiểm chứng
`npm view vercel version`). Người làm: user (đăng nhập 1 lần) hoặc agent
sau khi có auth.

```bash
cd ~/workspace/bar-live
cp deploy/vercel.json ./vercel.json   # staging -> gốc (chỉ chứa $schema, không build)
npx -y vercel@latest --version        # kiểm chứng CLI thật
npx -y vercel@latest login             # mở link, user đăng nhập trong trình duyệt
npx -y vercel@latest --prod            # trả lời: project mới, framework Other/không
                                      # build, output = thư mục hiện tại;
                                      # nhận URL https://<ten>.vercel.app
```

URL live: URL `*.vercel.app` do lệnh trên in ra. Deploy lại sau mỗi lần sửa:
`npx -y vercel@latest --prod` (cùng thư mục). Thư mục `deploy/` và
`package.json` cũng được publish kèm — vô hại, không ảnh hưởng trang.

## 2. GitHub Pages — phương án dự phòng (cần repo + gh login)

Điều kiện: `gh auth login` (user làm, CHƯA login — `gh auth status` báo
"You are not logged into any GitHub hosts"), repo GitHub chứa `bar-live/`,
Pages bật cho nhánh đó. Người làm: user chạy `gh auth login`.

```bash
cd ~/workspace/bar-live
git init -b main 2>/dev/null || true   # chỉ nếu chưa phải repo; đừng tạo repo mới khi chưa được lệnh
gh auth login                          # user làm, chọn HTTPS + trình duyệt
gh repo create <ten-repo> --public --source=. --remote=origin --push
gh api -X PUT repos/{owner}/{repo}/pages -f build_type=legacy -f source[branch]=main -f source[path]=/
# URL: https://<owner>.github.io/<ten-repo>/
```

Lưu ý: Pages phục vụ đúng file tĩnh, HTTPS mặc định. Nhược: cần repo +
bật Pages; mỗi lần sửa phải `git push`.

## 3. Netlify — dự phòng (CLI qua npx, cần login)

Điều kiện: tài khoản Netlify + `netlify login` hoặc `NETLIFY_AUTH_TOKEN`
(unset trên VM). CLI thật CHƯA cài sẵn; tải qua npx (gói `netlify-cli` có
trên npm registry, đã kiểm chứng `npm view`), KHÔNG login sẵn.

```bash
cd ~/workspace/bar-live
npx -y netlify-cli@latest --version
npx -y netlify-cli@latest login        # user đăng nhập trong trình duyệt
npx -y netlify-cli@latest deploy --prod --dir=.
# URL: https://<ten-site>.netlify.app (lệnh in ra)
```

## 4. Cloudflare Pages — dự phòng (cần token/account)

Điều kiện: tài khoản Cloudflare + API token + account ID. Trên VM: KHÔNG có
`cloudflared`, KHÔNG có `wrangler`, `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` đều unset, không có file `~/.cloudflare`.
CLI thật tải qua npx (gói `wrangler` có trên npm registry, đã kiểm chứng
`npm view`), nhưng deploy vẫn kẹt ở auth.

```bash
cd ~/workspace/bar-live
npx -y wrangler@latest --version
npx -y wrangler@latest pages deploy . --project-name bar-live
# -> hỏi login Cloudflare (user làm trong trình duyệt)
# URL: https://bar-live.pages.dev
```

## 5. Tunnel tạm pinggy — CHỈ TEST, không phải đường live (ĐÃ KIỂM CHỨNG)

Không cần tài khoản mới: script `~/workspace/bin/pinggy-start.sh` mở SSH
tới `a.pinggy.io:443` (qua proxy `$HTTPS_PROXY` của phiên chạy) và forward
`localhost:3000` ra URL ngẫu nhiên dạng
`https://<random>.run.pinggy-free.link` (và 1 URL `*.free.pinggy.net`).
URL ngẫu nhiên mỗi lần chạy, pinggy báo hết hạn sau 60 phút nếu không tắt
sớm, chết ngay khi SSH tắt. KHÔNG dùng lúc live thật (URL đổi, phụ thuộc
VM + proxy, không ổn định).

Kiểm chứng 02/11/2026 ~21:33 (+07): phục vụ `bar-live/` bằng
`python3 -m http.server 3000 --bind 127.0.0.1`, mở tunnel, curl qua HTTPS
từ VM tới URL tạm — server log ghi `GET / HTTP/1.1 200`. Tunnel và server
đã TẮT NGAY sau test, cổng 3000 đã đóng. URL test lúc đó (ĐÃ CHẾT, mở
không được nữa, chỉ để đối chiếu log):
`https://hieuw-2a04-4e41-24-6bec--aa64-6bec.run.pinggy-free.link`
Bẫy khi parse log: output SSH có ký tự `\r` cuối dòng — phải `tr -d '\r'`
trước khi lấy URL, nếu không curl báo malformed/000.

Chạy lại test tương tự khi cần:

```bash
# Cửa sổ 1: phục vụ thư mục tĩnh ở cổng 3000 (chỉ bind localhost)
cd ~/workspace/bar-live && python3 -m http.server 3000 --bind 127.0.0.1
# Cửa sổ 2: mở tunnel (đọc URL https://....run.pinggy-free.link in ra, rồi test)
bash ~/workspace/bin/pinggy-start.sh
# Xong việc: Ctrl-C cả 2 cửa sổ, kiểm chứng không còn tiến trình/cổng 3000 nào.
```

## 6. Phục vụ từ VM qua IP Tailscale — KHÔNG KHẢ THI, đừng thử

VM này là Tailscale client-only: chỉ tạo kết nối đi, KHÔNG nhận kết nối vào,
không host được gì (xem `~/docs/devices/tailscale.md`). Điện thoại Redmi
dù cùng tailnet cũng không mở được `http://<ip-VM>:<cổng>`. Vì vậy phân tích
http/wss/WebAudio chỉ còn tính lý thuyết: trang http MỞ ĐƯỢC `wss://`
(không bị mixed-content; chỉ chiều ngược — trang https mở `ws://` — mới bị
chặn), và WebAudio không bị khóa bởi secure-context, chỉ cần 1 chạm để
unlock autoplay (code đã có nút "Bắt đầu" gọi `unlock()`). Nhưng do VM
không nhận kết nối vào nên đường này không dùng được cả để test.

## 7. Relay live — EulerStream Community (MIỄN PHÍ vĩnh viễn, đã nối code)

`js/relay.js` (từ 02/11/2026) mở thẳng WebSocket tới
`wss://ws.eulerstream.com` từ trình duyệt, không cần server riêng. Hosting
tĩnh không ảnh hưởng — trang https mở `wss://` bình thường. Chi tiết đầy
đủ trong `README.md` mục "Relay live".

- Lấy key: user đăng ký tại eulerstream.com → gói **Community** (free vĩnh
  viễn, KHÔNG cần thẻ: 2.500 req/ngày, 25 cloud WebSocket) → API key trong
  dashboard. Không dùng key demo/chung, không mua gói.
- Mở trang: `https://<trang>/?user=meta.muse.ai1&apiKey=<KEY>` — key tự
  xóa khỏi thanh địa chỉ sau khi đọc. Không key → relay không nối.
- Đã kiểm chứng 02/11/2026 (không cần live): nối thật, không key → đóng
  4400, key giả → đóng 4401; URL build tay khớp SDK 1.1.0; mapping message
  giả qua `BarEvents` đạt. Chưa kiểm chứng: event thật + avatar (cần key
  thật + kênh đang live, thuộc pha test trên máy thật).

## Blocker tổng hợp (ai làm, làm gì)

- User: (a) `npx vercel login` 1 lần HOẶC cấp `VERCEL_TOKEN` — để đi đường 1;
  hoặc (b) `gh auth login` — để đi đường 2. Chỉ cần 1 trong 2. Deploy thật
  CHƯA chạy vì cả 2 đường đều kẹt auth.
- User: đăng ký EulerStream Community (free, không thẻ) và đưa API key để
  test relay thật — key KHÔNG commit vào repo, chỉ gắn vào URL lúc mở
  trang (`?apiKey=...`).
- Chưa kiểm chứng: hiển thị/hiệu năng/âm thanh trên Redmi thật, relay với
  key thật + event thật, phát sóng Mobile gaming thật (thuộc pha test trên
  máy thật, không phải hosting). Cấm bật `?demo=1` khi live thật.
