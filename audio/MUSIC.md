# Nhạc DJ — cảnh bar "Đi Bar 5.0" (bản ngang)

Sở hữu: agent nhạc DJ. Mọi ngưỡng nhạc nằm trong `CONFIG.music` (`../config.js`);
`js/audio.js` không hardcode BPM, pattern hay âm lượng. Cập nhật lần cuối:
02/11/2026 — đợt 3: xoay catalog lên 10 track (4 track mới năng lượng cao,
loại 3 track cũ ít năng lượng nhất).

## 1. "Nhạc hot" nghĩa là gì cho sàn này — và ranh giới bản quyền

Nghiên cứu ngày 02/11/2026 (tìm kiếm web, các live/set đang chạy ở VN):

- **Gu đang hot trên live bar TikTok VN: Vinahouse / Vietmix.** Nhạc trẻ
  Việt remix trên nền house, bass căng, drop dồn dập, hook ngắn bắt tai,
  nonstop không nghỉ. Nguồn ghi rõ: Vinahouse 138–142 BPM ("nhịp Bass
  Vinahouse 138-142 BPM căng cực"), các set live 45–85 phút, hook triệu
  view cắt nhanh, drop ngay từ giây đầu. Từ khóa thịnh hành:
  `vinahouse`, `nonstop 2026`, `nhạc trẻ remix`, `remix TikTok`,
  `bass căng`, `Vietmix`.
- **Sự thật: nhạc hot đó KHÔNG lấy được hợp pháp.** Hầu hết là remix
  nhạc trẻ Việt có bản quyền (ca sĩ/nhạc sĩ + label nắm quyền; nhiều
  kênh ghi rõ "© Copyright, Do not Reup"). Dùng trong live TikTok dễ bị
  tắt tiếng, gắn cờ bản quyền, hoặc gỡ live. Agent nhạc **không tải,
  không cắt, không dùng** nhạc thương mại/nhạc lậu, không bẻ khóa nguồn.
- **Gần gu hot nhất mà hợp pháp:** nhạc house/EDM instrumental miễn phí
  có giấy phép rõ ràng — kick 4 nhịp dồn, bass bouncy, drop rõ, BPM
  120–150. Catalog ở mục 3 chọn đúng tiêu chí này: house/techno/EDM
  năng lượng cao, BPM đo thật 120–150, đoạn cắt lấy đúng phần drop/groove
  căng nhất. Không giống hệt Vinahouse (thiếu vocal + bass kiểu Vina),
  nhưng đúng vai trò: nhạc sàn liên tục, không lo bản quyền.

## 2. Nhạc synth WebAudio (fallback, rủi ro bản quyền = 0)

Engine `MusicEngine` (`js/audio.js`) tổng hợp trực tiếp bằng WebAudio,
chạy sau 1 chạm nút "Bắt đầu" (unlock AudioContext — chính sách autoplay
trình duyệt). Scheduler lookahead 0.12s, timer 40ms: nhịp đều, nhẹ máy.
Từ đợt 2, synth là **fallback**: chỉ chạy khi chế độ `synth` được chọn
hoặc khi không nạp được track file nào (xem mục 4).

Cấu trúc 3 đoạn, tự chuyển theo bar (BPM trong CONFIG, hiện 128):

| Đoạn | Bar | Đặc điểm |
|---|---|---|
| warm-up | 8 | Kick nửa nhịp, bass thưa, pad hợp âm (Am–F–C–G), hat thưa, không snare |
| build | 8 | Kick 4 nhịp, snare ở beat 4, arp thưa, 2 bar cuối có riser kéo lên |
| drop | 16 | Đủ lớp: kick 4 nhịp, snare beat 2+4, open hat, bass 8 nốt, arp + delay dotted-8th |

Hết đoạn cuối quay lại đoạn `loopFromSection` (mặc định = build) — tức
chu trình warm-up → build → drop → build → drop… Impact nổ đúng downbeat
khi vào drop.

Lớp nhạc: kick (sine 140→45 Hz + click transient), snare/clap (noise
bandpass 1800 Hz + triangle 190 Hz), bass (sawtooth qua lowpass quét
900→220 Hz), hat đóng/mở (noise highpass 7000 Hz), arp (square + delay
feedback), pad (saw detune ±5 cent qua lowpass, chỉ warm-up).

### Âm thanh DJ pad (gọi tay)

`music.triggerPad(name)` — trả về `false` nếu audio chưa unlock:

| Tên | Âm thanh | Dùng cho (đề xuất) |
|---|---|---|
| `riser` | Noise qua bandpass quét 400→6000 Hz, dài 2 bar mặc định | Cuối build / trước drop |
| `impact` | Boom sine 110→32 Hz + crash noise | Vào drop, gift lớn |
| `airhorn` | Stack saw 415/466/554 Hz, ~0.9s | Gift trung/lớn, highlight |
| `siren` | Sine 900 Hz ± LFO 1.5 Hz, ~1.6s | Sự kiện đặc biệt |

Các method riêng: `playRiser(when?, duration?)`, `playImpact(when?)`,
`playAirhorn(when?)`, `playSiren(when?)` — `when` là thời điểm AudioContext
(để lên lịch trước, mặc định = ngay). Âm lượng trong `CONFIG.music.pads`.

### Đồng bộ nhịp với đèn

`music.onBeat = (beatCount, audioTime) => {...}` — callback theo đồng hồ
audio (chính xác hơn đồng hồ performance). Ở chế độ file, `onBeat` cũng
cháy theo BPM của chính track đang chạy (beat timer riêng, xem mục 4).
`music.onSectionChange = (sectionId) => {...}` báo khi đổi đoạn synth.
`music.currentSectionId` đọc đoạn hiện tại.

## 3. Track file — catalog 10 track (Mixkit Free License)

Chế độ mặc định là `file` (`CONFIG.music.defaultMode: 'file'`): mở trang,
bấm Bắt đầu là playlist chạy. Track lỗi thì bị bỏ qua; hết track nạp
được thì tự quay về synth.

| # | Track — Nghệ sĩ | BPM đo | Đoạn cắt | Dung lượng | Hot |
|---|---|---|---|---|---|
| 1 | House Fest — Alejandro Magaña | 124.0 | 32 bar, từ 46.45s | 744 KB | ★ |
| 2 | Techno Fest Vibes — Alejandro Magaña | 124.0 | 32 bar, từ 15.48s | 744 KB | ★ |
| 3 | Techno Fest Feel — Alejandro Magaña | 126.0 | 32 bar, từ 30.48s | 732 KB | ★ |
| 4 | Dance Zero — Lily J | 123.9 | 32 bar, từ 19.37s | 745 KB | ★ |
| 5 | Dance Away — Michael Ramir C | 149.9 | 32 bar, từ 5.15s | 616 KB | ★ |
| 6 | Positive Energy — Michael Ramir C | 135.0 | 32 bar, từ 7.50s | 683 KB | ★ |
| 7 | India — Arulo | 128.0 | 32 bar, từ 30.41s | 721 KB | ★ |
| 8 | Infected Mushroom Vibes — Alejandro Magaña | 145.0 | 32 bar, từ 31.66s | 636 KB | ★ |
| 9 | House 02 — Lily J | 123.0 | 32 bar, từ 15.61s | 750 KB | ★ |
| 10 | Dance Like There's No Tomorrow — Michael Ramir C | 126.1 | 32 bar, từ 76.19s | 732 KB | |

Tổng: 10 file, 6,77 MB (< 10 MB ngân sách). File: `audio/<slug>-<mixkit-id>.mp3`
(MP3 96 kbps, 44,1 kHz stereo). Mỗi entry trong `CONFIG.music.tracks`:
`{ src, title, artist, license, licenseUrl, bpm, bars, gain, hot }`.

**Đợt 3 (02/11/2026, lệnh user "cho mấy nhạc Việt DJ hay hay"):** quét
20 ứng viên Mixkit mới (dance/edm/house/electronic/workout), đo BPM 2
phương pháp + grid-search như đợt 2. Pipeline hiệu chuẩn lại trên 9
track cũ: đo lại khớp ±0,2 BPM. Chọn 4 track mới (cả 4 đều 2 phương pháp
đồng thuận, lưới beat giữ vững sau cắt): Positive Energy (135.0, grid
4.48 — mạnh nhất), India (128.0, grid 3.89, hơi hướng Đông phương),
Infected Mushroom Vibes (145.0 — BPM cao nhất catalog sau Dance Away),
House 02 (123.0, ổn định nhất, conf 0.88/0.96). Loại 3 track cũ ít năng
lượng nhất theo RMS file đã cắt: A Game (0.294), House Vibes (0.332),
Karma (0.354) — giữ Dance Like There's No Tomorrow (RMS 0.378, cao nhất
nhóm không-hot) và toàn bộ track hot + Dance Away. Loại thêm ở vòng
sơ tuyển: Asian Clown (tag "asian" duy nhất của Mixkit — hip-hop,
2 phương pháp đo lệch 99/129, grid yếu 1.14), Drum and Bass Vibes
(172/118 lệch nhau, ngoài dải BPM), One More Dance (109.9 BPM, dưới
chuẩn), Kraft Twerk (2 phương pháp lệch 118/162, không chắc chắn).

**Trả lời thẳng về "nhạc Việt": KHÔNG tìm được track nhạc Việt hợp pháp
nào.** Đã kiểm tra: tag `vietnam`/`k-pop`/`bollywood` trên Mixkit = 0
track; tag `asian` = 1 track duy nhất (Asian Clown, hip-hop, groove
không đều, đã loại); tìm kiếm Free Music Archive chỉ ra nhạc chiptune
8-bit CC0 (Komiku), không phải nhạc DJ và không liên quan Việt Nam;
Incompetech là nhạc Kevin MacLeod, không có nhạc Việt. Nhạc Vinahouse/
Vietmix thật đều là remix nhạc trẻ Việt có bản quyền — không tải, không
dùng. Catalog đợt 3 vì vậy là track EDM/techno/trance năng lượng cao
gần gu nhất (BPM 123–150, kick 4 nhịp dồn, drop rõ), trong đó "India"
có màu sắc giai điệu phương Đông gần gu châu Á nhất.

### Cách cắt + kiểm chứng (làm ngày 02/11/2026, không đoán)

1. **Nguồn:** trang danh mục Mixkit (`/free-stock-music/discover/dance|edm|
   house|electronic/`) — HTML server-render, chứa sẵn link MP3 trực tiếp
   dạng `assets.mixkit.co/music/<id>/<id>.mp3`. Tải 12 ứng viên, đối
   chiếu thời lượng ffprobe với thời lượng trang Mixkit ghi (khớp ±1s) để
   xác nhận đúng track.
2. **BPM đo thật, 2 phương pháp độc lập:** (a) onset envelope + tự tương
   quan, (b) kick-band envelope + tự tương quan — hai phương pháp đồng
   thuận (±1 BPM) trên 11/12 track; (c) tinh chỉnh bằng grid-search
   (±3 BPM, bước 0,1) tối đa hóa năng lượng onset trên lưới beat. Tag
   ID3 `TBPM=140` trên 4 track Magaña là **sai** (đo thật 120–126) nên
   không dùng tag, chỉ dùng số đo. Track "Hot Love" (id 99) bị loại vì
   2 phương pháp cho 2 BPM khác nhau (160 vs 177) — groove không đều,
   cắt bar sẽ lệch nhịp.
3. **Chọn đoạn cắt:** lưới beat theo BPM tinh chỉnh, tính RMS từng bar,
   chọn cửa sổ 32 bar liên tiếp có năng lượng trung bình cao + ổn định
   (phần drop/groove căng nhất, tránh breakdown). Cắt bằng ffmpeg
   (`atrim` + `asetpts`) đúng số bar nguyên.
4. **Chuẩn hóa:** peak normalize về −1 dB + limiter 0,89, fade chống
   click 5ms ở 2 đầu. Encode lại MP3 96 kbps.
5. **Kiểm chứng sau cắt:** ffprobe thời lượng đúng 32 bar (±0,01s);
   chạy lại bộ đo BPM trên file đã cắt — lưới beat giữ vững tới bar cuối
   (128 beat, năng lượng onset trên lưới 2,2–4,6× trung bình); không
   track nào lệch lưới. Loại thêm 2 ứng viên năng lượng yếu
   (Dance 02 id 762, Golem Dance id 1098) để giữ catalog 9 track.

## 4. Hệ đẩy nhạc liên tục (playlist engine)

Trong `js/audio.js`, chế độ file chạy playlist tự động, không cần
`main.js` gọi thêm gì (engine tự nạp track nền ngay khi `unlock()`):

- **Hàng đợi:** track `hot: true` trộn ngẫu nhiên lên trước, còn lại
  trộn sau (`CONFIG.music.playlist.hotFirst/shuffle`). Hết 1 vòng thì
  trộn lại — nhạc chạy nối tiếp không ngừng, không khoảng lặng.
- **Chuyển track đúng ranh giới bar:** mỗi file dài đúng 32 bar; track
  kế được lên lịch bắt đầu đúng lúc track hiện tại hết, **crossfade
  0,6s** (`crossfadeSeconds`) chồng lên nhau — không khoảng lặng, không
  tiếng chồng lên nhau ngoài cửa sổ fade. Track lỗi thì bỏ qua, không
  dừng nhạc.
- **Đèn ăn nhịp:** beat timer riêng cho file mode, `onBeat` cháy theo BPM
  của chính track đang chạy (124 → 150 BPM đều đồng bộ).
- **API:** `music.nextTrack()` (qua track kế — để dành cho nút DJ sau
  này), `music.playTrack(i)` (nhảy tới track), `music.currentTrack`
  (entry đang chạy), `music.onTrackChange = (index, track) => {...}`
  (báo khi đổi track). `music.setMode('file'|'synth')` đổi chế độ tay;
  `setMode('file')` trả `false` khi chưa có track nào.
- **Không nhân đôi tiếng:** mọi đường chuyển (start/stop/toggle/
  setMode/playTrack/crossfade) đều đi qua 1 điểm dừng source duy nhất
  (`_stopFileSource`) + token hủy đường async đang chờ. Harness mock
  AudioContext kiểm chứng 23/23 (xem mục 8): chuyển track, crossfade,
  fallback synth khi nạp lỗi hết, toggle bật/tắt không nhân đôi source,
  hàng đợi hot-trước.

## 5. Giấy phép — đã kiểm chứng ngày 02/11/2026

**Mixkit Free License** (đọc trang license + FAQ chính thức của Mixkit,
đối chiếu nhiều nguồn độc lập):

- Dùng **thương mại được**, không cần ghi công, không cần đăng ký,
  không watermark. Phạm vi liệt kê: YouTube, social media, podcast,
  website, quảng cáo online. Live TikTok là livestream trên mạng xã
  hội → thuộc phạm vi cho phép theo cách đọc này.
- **Không được:** bán/phân phối lại file gốc nguyên dạng; đăng ký nhạc
  lên dịch vụ quản lý quyền (Content ID…); nhận là của mình. Sàn này
  không làm việc nào trong 3 việc đó.
- **Loại trừ ghi rõ trong FAQ nhạc:** không dùng trong CD, DVD, video
  game, phát sóng TV/radio. Không liên quan tới live TikTok.
- **Chú ý:** giấy phép Restricted chỉ áp cho MỘT SỐ clip video của
  Mixkit, không áp cho nhạc. Mọi track trong catalog đều là nhạc, kiểm
  tra từng trang track đều thuộc diện Free License. Ghi công tự nguyện:
  credit "Music: Mixkit" trong mô tả live nếu muốn, không bắt buộc.
- Ghi rõ `license` + `licenseUrl` trong từng entry `CONFIG.music.tracks`
  để ai kiểm tra cũng thấy nguồn.

## 6. Quy trình làm mới nhạc — "đẩy nhạc hot liên tục" (mỗi tuần)

Mục tiêu: catalog luôn có track mới gần gu hot, không bao giờ hết nhạc
hay lặp 1 list cũ. Agent nhạc (hoặc người phụ trách) làm mỗi tuần:

1. **Quét trend (15 phút):** tìm kiếm TikTok/YouTube với từ khóa
   `vinahouse 2026`, `nonstop vinahouse`, `remix TikTok hot`, `Vietmix`,
   `nhạc sàn hot TikTok`. Ghi lại: BPM phổ biến, style (bass Vina /
   house / techno), tên hook đang viral. Chỉ lấy **gu** (style/BPM/cấu
   trúc), KHÔNG lấy track bản quyền.
2. **Tìm track hợp pháp theo gu (30 phút):** Mixkit
   (`/free-stock-music/discover/edm|house|dance|electronic/`, thêm
   `/tag/workout/` cho track năng lượng cao) — lọc theo tên gợi năng
   lượng (Fest/Party/Dance/House/Techno/Trance) + thời lượng 1:30–2:30.
   Nguồn dự phòng không cần đăng nhập: Free Music Archive (chỉ track
   CC-BY/CC0, tránh NC/ND), Incompetech (CC-BY, cần ghi công). Bỏ qua
   mọi nguồn đòi đăng nhập/trả phí.
3. **Tiêu chí chọn:** BPM đo được 118–152; groove 4/4 đều (2 phương
   pháp đo đồng thuận); đoạn drop/groove căng ≥ 32 bar liên tiếp; không
   vocal bản quyền; giấy phép đọc rõ (ghi nguồn + link license).
4. **Thêm track:** tải → ffprobe đối chiếu thời lượng trang nguồn →
   đo BPM 2 phương pháp + grid-search → chọn cửa sổ 32 bar → cắt +
   chuẩn hóa như mục 3 → đặt tên `audio/<slug>-<id>.mp3` → thêm entry
   vào `CONFIG.music.tracks` (`hot: true` nếu năng lượng cao, BPM
   124–150) → `node --check` + harness (nếu sửa engine) → ghi bảng mục 3
   + cập nhật tổng dung lượng.
5. **Ngân sách:** tổng `audio/` giữ < 10 MB. Khi vượt: loại track ít
   năng lượng nhất (RMS cửa sổ thấp nhất) hoặc rút xuống 8–10 track.
   Mỗi lần làm mới thay 2–3 track cũ nhất để list luôn tươi.
6. **Kiểm chứng trước live:** nghe 3 vòng lặp liền mạch trên máy thật
   (điểm nối không tách/click), nghe 1 lần chuyển track (không khoảng
   lặng), kiểm tra đèn đúng nhịp ở 2 BPM khác nhau.

## 7. Nguồn đã kiểm tra (lịch sử)

| Nguồn | Giấy phép | Kết quả 02/11/2026 |
|---|---|---|
| Mixkit | Mixkit Free License — thương mại được, không cần ghi công | **Dùng được.** Trang danh mục render server, lộ link MP3 trực tiếp (cần `curl -L` theo redirect 301). 12 ứng viên tải về, 9 vào catalog, 3 loại (BPM không chắc / năng lượng yếu). |
| Pixabay Music | Pixabay Content License | Tên miền bị chặn ở tầng fetch — không thử lại, không vòng tránh. |
| Looperman / Freesound | Từng track (có CC0) | Tải file **đòi đăng nhập** → bỏ qua theo lệnh cấm tạo tài khoản. |
| Archive.org (netlabel) | Lẫn lộn, đa số CC BY-NC/ND | BY-NC/ND không dùng được cho live có quà tặng (thương mại) và cấm phái sinh (cắt file) → bỏ qua, không tải. |
| NCS / nhạc hot TikTok / Vinahouse remix | Bản quyền thương mại | **Không dùng.** Chỉ nghiên cứu gu (mục 1). |

Thí nghiệm cũ (đợt 1, đã xóa): 1 MP3 tải từ URL thứ ba không xác minh
được danh tính/giấy phép → đã xóa, không đưa vào repo. Từ nay chỉ lấy
link từ chính trang nguồn (Mixkit) và đối chiếu thời lượng.

## 8. Hook cần coordinator gộp (ngoài phạm vi file của agent nhạc)

1. **Đồng bộ đèn theo nhịp audio (khuyến nghị):** trong `js/main.js`,
   sau khi tạo `music`, đặt
   `music.onBeat = (beatCount) => barScene.pulseBeat(beatCount);`
   và bỏ phép tính beat theo `elapsed` trong `animate()` (giữ làm fallback
   khi audio chưa chạy). Từ đợt 2, `onBeat` cháy cả ở chế độ file (theo
   BPM từng track) lẫn synth — hook này nối 1 lần là đủ cho cả hai.
2. **DJ pad theo gift (đề xuất):** trong `handleEvent` nhánh `gift` của
   `main.js`, sau khi tính tier: tier `large` → `music.triggerPad('impact')`
   (+ `triggerPad('airhorn')` nếu muốn), tier `medium` →
   `music.triggerPad('airhorn')`. Tier `small` không gắn âm để tránh spam.
   Không gắn pad vào chat/like/follow.
3. **Nút DJ / chọn track (tùy chọn):** thêm nút vào `index.html` +
   wiring trong `main.js`: nút "Bài kế" gọi `music.nextTrack()`; hiển
   thị tên track hiện tại qua `music.currentTrack` + `music.onTrackChange`.
   Agent nhạc không sửa 2 file này.
4. **Harness đợt 2:** mock AudioContext/fetch tại `/tmp/djtest2/harness.mjs`
   — 23/23 đạt (hàng đợi hot-trước, crossfade + đổi track, fallback
   synth khi nạp lỗi, toggle không nhân đôi, beat timer file mode).
   Chạy lại khi sửa engine: `node /tmp/djtest2/harness.mjs` (file tạm,
   không thuộc repo).

## 9. Checklist test nhạc trên máy thật (giao agent test máy)

- [ ] Mở trang, bấm Bắt đầu: nhạc file lên ngay (không phải synth), không
      lỗi, không cần chạm lần 2.
- [ ] Nghe hết 1 track → chuyển track mượt, không khoảng lặng, không
      chồng tiếng; nghe 3 vòng lặp của 1 track không tách/click ở điểm nối.
- [ ] Nghe đủ 3 track: có track hot (House Fest / Techno Fest / Dance
      Zero) lên trước, BPM khác nhau vẫn liền mạch.
- [ ] Đèn sàn nháy đúng nhịp nhạc trong ít nhất 30 giây ở 2 track khác
      BPM (so tai + mắt; nếu lệch rõ thì ghi nhận để gộp hook mục 8.1).
- [ ] Nút Nhạc bật/tắt hoạt động; tắt rồi bật lại không bị nhân đôi tiếng;
      chuyển track tay (nếu có nút) không vỡ tiếng.
- [ ] Chạy 5 phút: không rè/vỡ tiếng, không nóng máy bất thường, FPS
      không tụt thêm so với lúc tắt nhạc (ghi 2 số FPS để so).
- [ ] Âm lượng: nhạc nghe rõ ở mức STREAM_MUSIC hiện tại của máy;
      kiểm chứng cả 2 nguồn đo (`settings` và `media_session --get`).
- [ ] Mất mạng giữa chừng (tắt Wi-Fi sau khi nạp): track đang chạy hết
      thì rớt về synth êm, không im lặng, không treo trang.
