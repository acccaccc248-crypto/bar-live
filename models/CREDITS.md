# Người múa cột — model + clip chuyển động

Cô múa cột trong lồng dùng mẫu người thật (GLB) + clip mocap, thay cho
body procedural cũ (hình khối + texture phẳng). Xem `js/dancers.js`
(`_createPoleDancer`, `_loadPoleModel`) và `CONFIG.dancers.poleDancer`.

## Model: `pole-dancer.glb` (2,77 MB)

- Nguồn: nhân vật nữ MakeHuman/MPFB 2, file `human.glb` của dự án mã
  nguồn mở **vsim** (https://github.com/kunalkushwaha/vsim,
  `packages/assets/library/human.glb`).
- Giấy phép: **CC0** — output của MakeHuman thuộc phạm vi công cộng;
  texture da trong gói CC0 `makehuman_system_assets` (xem `CREDITS.md`
  của vsim). Không cần ghi attribution, không cần tài khoản.
- Thông số đã kiểm chứng: 1 mesh, 21.833 đỉnh, ~36.972 tam giác
  (< 50k), rig 53 khớp (đủ xương ngón tay), 1 texture 1024² nhúng trong
  file, cao 1,66 m. Không chỉnh sửa gì thêm (giữ nguyên file gốc).
- Ngoại hình thật: thân màu da với họa tiết hình học tối (bodysuit vẽ
  trên texture), tóc đen dài vẽ trên texture (nhìn tốt từ sau/hông),
  mặt vẽ trên texture (nhìn rõ là mặt vẽ khi zoom gần — giới hạn thật
  của mẫu miễn phí, xem báo cáo).
- Dự phòng: nếu GLB hoặc clip không tải được, trang tự dựng lại body
  procedural cũ (`_buildProceduralPoleBody`) — live không bao giờ trống lồng.

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
