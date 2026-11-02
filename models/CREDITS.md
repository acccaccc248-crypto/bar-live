# Người múa cột — model + clip chuyển động

Cô múa cột trong lồng dùng mẫu người thật (GLB) + clip mocap, thay cho
body procedural cũ (hình khối + texture phẳng). Xem `js/dancers.js`
(`_createPoleDancer`, `_loadPoleModel`) và `CONFIG.dancers.poleDancer`.

## Model: `pole-dancer.glb` (6,03 MB) — bản NÉT, thay mẫu v1 mờ

- Nguồn: tự xuất bằng **MPFB 2** (MakeHuman Plugin For Blender 2.0.0,
  Blender 4.2.0 headless) từ **system assets CC0** của MakeHuman —
  script xuất: `~/workspace/mpfb-scratch/gen-human.py` (scratch, không
  commit), macro: nữ, tuổi 0.5, cao 0.6, asian 1.0, cupsize 0.65.
- Giấy phép: **CC0** — toàn bộ asset hệ thống của MakeHuman (da, tóc,
  mắt, lông mày, lông mi, đồ) thuộc phạm vi công cộng, không cần ghi
  attribution, không cần tài khoản. Không mua, không lách login.
- Asset đã dùng (đều trong gói `makehuman_system_assets_cc0`):
  da `young_asian_female` (diffuse 2048²), tóc `long01` (mesh tóc thật
  + diffuse 2048²), mắt `high-poly` (nhãn cầu 3D + iris 1024²),
  `eyebrow001`, `eyelashes01`, đồ diễn `female_sportsuit01` (crop top
  xanh + legging đen, diffuse 2048²).
- Thông số đã kiểm chứng: 6 mesh (thân, đồ, tóc, mắt, mày, mi),
  33.036 tam giác (< 60k), rig **53 khớp, cùng tên xương với rig v1**
  nên 2 clip cũ chạy thẳng không cần remap, cao ~1,62 m (hông 0,86 m).
  Texture: thân/tóc/đồ 2048², mắt 1024², mày/mi 512².
- Mặt/Tóc thật: sống mũi, môi, hốc mắt, gò má là hình khối 3D của
  mesh MakeHuman (không vẽ phẳng); mắt là mesh nhãn cầu riêng có tròng
  nâu; tóc là mesh riêng có độ phồng, sợi rủ qua vai; lông mày/mi là
  mesh riêng. Texture mặt nét khi zoom gần (đã render kiểm chứng).
- Nén: texture đục (da, đồ) chuyển PNG → JPEG q90 để file ≤ 8 MB
  (10,6 MB → 6,03 MB); texture có alpha thật (tóc, mắt, mày, mi) và
  normal map của đồ GIỮ NGUYÊN PNG. Script nén:
  `~/workspace/mpfb-scratch/compress-glb.py` (scratch, không commit).
- Mẫu v1 bị loại: `pole-dancer-v1-blurry-backup.glb` (2,77 MB, file
  `human.glb` của vsim, texture 1024², mặt/tóc vẽ trên texture) — user
  chê mờ 06:11 03/11, KHÔNG DÙNG NỮA, giữ lại trong repo chỉ làm backup.
- Dự phòng: nếu GLB hoặc clip không tải được, trang tự dựng lại body
  procedural cũ (`_buildProceduralPoleBody`) — live không bao giờ trống lồng.
- Giới hạn thật còn lại: da không có subsurface scattering; tóc là
  khối mesh rủ, không mô phỏng từng sợi; ở khoảng cách camera lồng
  (~10 m) chi tiết mặt không phân giải được — mẫu nổi bật nhờ dáng +
  da sáng + spotlight + vòng sáng dưới chân (xem lệnh 06:13).

## Clip nhảy thường (idle loop): `pole-idle.clip.json` (286 KB)

- Nguồn tham khảo chuyển động: video TikTok **@poppyyy0101** do user
  gửi (nhảy hip-hop trong phòng tập, 39,7 s). Chỉ lấy dữ liệu chuyển
  động — **video gốc không có trong repo, không phát trên live**.
- Đoạn đã chọn: **10,0–22,0 s** (12 s): stance rộng + tay dang chữ T +
  vung tay trên đầu + xoay người (trước → nghiêng → lưng → trước) +
  bước groove — nối loop liền mạch (blend 12 frame cuối về frame đầu).
- Trích xuất local, không tài khoản: **MediaPipe PoseLandmarker heavy**
  (Google, Apache 2.0) chạy trên VM → landmark 3D → retarget lên rig
  model bằng phép căn rest-pose (cùng phương pháp với clip CMU, xem
  `~/workspace/pole-model-scratch/pose_to_clip.py` — file scratch,
  không commit). Hướng mặt chuẩn hóa về +Z (xoay quanh cột do cảnh
  đảm nhiệm); chỉ giữ bob dọc nhỏ, không dịch chuyển ngang.
- Định dạng: JSON `{fps: 30, duration, tracks: {khớp: {times, values
  xyzw}}, rootY}` — 18 khớp (tay + bàn chân giữ tư thế nghỉ), 360 frame.

## Clip skill múa cột (khi donate): `pole-skill.clip.json` (120 KB)

- Nguồn tham khảo chuyển động: video TikTok **@chaniee102** do user
  gửi (múa cột váy đỏ, studio MEO, 27 s). Chỉ lấy dữ liệu chuyển động —
  **video gốc không có trong repo, không phát trên live**.
- Đoạn đã chọn: **8,0–13,0 s** (5 s): leo cột + xoay trên không + dang
  chân rộng — động tác đẹp nhất, bám cột liên tục, không dính màn hình
  kết thúc TikTok (~23 s trở đi đã loại bỏ).
- Trích xuất như clip idle (MediaPipe local, không tài khoản), dạng
  one-shot (không loop): tier hoa hồng = clip + lia camera; tier gift
  lớn = clip + lia camera + pháo bông. Khớp bị cột che (tay phải) được
  giữ tư thế khung tốt gần nhất thay vì nhảy loạn; mọi khớp kẹp tối đa
  25°/frame.
- Đã thử **mocai** (video→FBX/GLB cloud, retarget Mixamo): CLI đòi
  đăng nhập (`Not signed in. Run npx @mocai/cli login`) — KHÔNG tự tạo
  tài khoản, không dùng. Muốn dùng mocai thì user tự đăng nhập qua
  trình duyệt rồi báo lại; đường local hiện tại đã đủ tốt nên không
  cần mocai nữa.

## Clip dự phòng (không ship)

- 2 clip mocap CMU Graphics Lab (salsa + modern dance, BVH, miễn phí
  cả thương mại, attribution: mocap.cs.cmu.edu, NSF EIA-0196217) đã
  retarget xong, giữ ở scratch (`~/workspace/pole-model-scratch/`,
  `salsa60.clip.json` / `modern05.clip.json`) làm phương án đổi điệu
  nếu sau này user muốn đa dạng hơn. Không đưa vào repo để nhẹ trang.
