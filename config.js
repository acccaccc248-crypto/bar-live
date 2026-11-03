// config.js — DUY NHẤT nơi chứa mọi ngưỡng / gán sự kiện → hiệu ứng.
// Không hardcode ngưỡng, mức gift, số dancer, pixel ratio... ở file khác:
// mọi file js khác chỉ đọc CONFIG. Sửa behaviour = sửa file này.
//
// Bản NGANG (landscape 16:9): cảnh rộng, DJ booth bên trái, khu VIP bên phải,
// bảng top gifter gọn ở cạnh phải. Stream TikTok sẽ letterbox như video mẫu
// "Đi bar 5.0" — đó là ý đồ, không phải lỗi.

export const CONFIG = {
  // Three.js ghim cố định — import map trong index.html phải khớp version này.
  three: {
    version: '0.160.0',
    cdnUrl: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  },

  renderer: {
    // Máy yếu (Redmi Note 9, RAM 3GB): KHÔNG antialias, KHÔNG shadow map.
    antialias: false,
    shadowsEnabled: false,
    pixelRatioCap: 1.25,
    clearColor: 0x07030f,
    // Delta tối đa mỗi frame (giây) — tránh nhảy cóc khi tab bị nền / lag.
    maxDeltaSeconds: 0.05,
  },

  // Camera cho khung NGANG 16:9. Nhìn từ trước, hơi cao, bao trọn sàn rộng.
  // FOV 55 theo lệnh sếp 02:17 (từ 48: góc nhìn rộng thêm xíu).
  camera: {
    fov: 55,
    near: 0.1,
    far: 60,
    basePosition: [0, 4.4, 10.2],
    lookAt: [0, 1.0, 0],
    // Zoom khi gift mức trung: tiến lại gần sàn rồi trả về.
    zoomPosition: [0, 3.4, 7.6],
    zoomDurationSeconds: 2.5,
    zoomLerpSpeed: 2.2,
  },

  // Sàn nhảy: lưới ô phát sáng theo nhịp. Rộng theo chiều ngang.
  floor: {
    cols: 12,
    rows: 6,
    tileSize: 0.92,
    gap: 0.07,
    tileHeight: 0.08,
    colors: [0x1a1033, 0x241245, 0x101c3a, 0x2a0f35],
    beatColors: [0xff2e88, 0x00e5ff, 0xffe600, 0x7c4dff, 0x00ff9d],
    // Mỗi nhịp sáng bao nhiêu ô (ngẫu nhiên) và sáng trong bao lâu.
    beatLitTiles: 10,
    beatGlowSeconds: 0.35,
  },

  // Ánh sáng: ít đèn, không shadow. Đèn disco quay + 2 đèn màu di động.
  lights: {
    ambientColor: 0x8877bb,
    ambientIntensity: 0.55,
    discoColorA: 0xff2e88,
    discoColorB: 0x00e5ff,
    discoIntensity: 28,
    discoDistance: 18,
    discoOrbitRadius: 4.5,
    discoOrbitHeight: 4.2,
    discoOrbitSpeed: 0.7,
    // Đèn spotlight VIP (chỉ bật khi có gift lớn / người lên bục VIP).
    vipSpotColor: 0xffe600,
    vipSpotIntensity: 60,
    vipSpotDistance: 20,
    vipSpotAngle: 0.45,
    // Spotlight RIÊNG chiếu lồng múa cột (user lệnh 06:13: làm nổi bật
    // mẫu nữ — tâm điểm nhìn đầu tiên). Luôn bật, góc hẹp chỉ phủ lồng.
    cageSpotColor: 0xffd9ec, // hồng nhạt ấm
    cageSpotIntensity: 55,
    cageSpotDistance: 20,
    cageSpotAngle: 0.38, // phủ ~2,4m ở tâm lồng, không cháy dàn ngoài
    cageSpotPenumbra: 0.5,
    cageSpotDecay: 1.8,
    cageSpotPosition: [2.2, 5.8, 3.2], // trước-phải-trên, tránh quả cầu disco
    cageSpotTarget: [0, 1.0, 0.4], // tâm lồng
  },

  discoBall: {
    radius: 0.55,
    segments: 12,
    position: [0, 5.2, 0],
    spinSpeed: 0.9,
  },

  // Giao diện phòng bar mới (user lệnh 01:46 + ảnh mẫu 01:53): lồng sắt
  // trung tâm chứa sàn nhảy, quả cầu disco treo trong lồng, laser,
  // tường LED, sàn bóng, ghế VIP 2 bên. CHỈ khối scene này thuộc owner
  // scene; kích thước sàn/dancer/bàn DJ/bục VIP giữ nguyên ở khối khác.
  // Lồng: bán kính 4.8m chứa vừa lưới slot (slot xa tâm nhất 4.63m —
  // xem _buildSlots trong dancers.js); tâm dời +z để vành sau không
  // chạm quầy bar (z=-4.9). Không thu nhỏ slot, không sửa dancers.js.
  scene: {
    // Lồng sắt tròn giữa sàn (lệnh 01:53 + thu nhỏ 02:20): bên trong CHỈ
    // có 1 người múa cột; dancer khán giả nhảy bên NGOÀI, vòng quanh.
    // Quả cầu disco treo TRÊN CAO phía trên lồng (không còn trong lồng).
    cage: {
      centerX: 0,
      centerZ: 0.4,
      radius: 1.4, // vừa 1 người múa cột + cột, tay dang không chạm nan
      barCount: 14, // chu vi ~8.8m, giữ khoảng cách nan ~0.63m như lồng lớn cũ
      barRadius: 0.035,
      barHeight: 2.8, // nan cao hơn cột (2.6m)
      barBaseY: 0.1,
      barColor: 0x1a1a24,
      domeHeight: 1.0,
      domeRibs: 12,
      ringColor: 0x2a2a38,
      baseColor: 0x0e0a18,
      neonColors: [0xff2e88, 0xff5fd0],
      // Tâm quả cầu disco (bán kính/tốc độ quay vẫn ở CONFIG.discoBall);
      // treo trên cao, trên đỉnh vòm lồng (đỉnh vòm ~3.9m, đáy cầu ~4.9m).
      ballY: 5.45,
    },

    // Cột múa ở đúng tâm lồng (lệnh 02:20): kim loại sáng, 1 mesh + đế.
    pole: {
      radius: 0.05,
      height: 2.6,
      baseRadius: 0.22,
      baseHeight: 0.06,
      color: 0xd8dce8,
    },
    lasers: {
      colors: [0xff2e88, 0x00e5ff, 0x7c4dff],
      baseOpacity: 0.12,
      beatOpacityBoost: 0.1,
    },
    ledWall: {
      updateSeconds: 0.12,
      canvasWidth: 512,
      canvasHeight: 256,
    },
    floorGloss: {
      color: 0x140830,
      specular: 0x7a4dff,
      shininess: 80,
    },
  },

  // DJ booth (trái) + khu VIP / bục (phải) + quầy bar phía sau.
  // Bàn DJ sau lưng (giữa): top donor đứng chơi DJ ở đây (CONFIG.djTable).
  stage: {
    djPosition: [-5.6, 0, -1.6],
    djBoothSize: [2.4, 1.1, 1.0],
    vipPosition: [5.6, 0, -1.2],
    vipPlatformSize: [2.6, 0.5, 2.0],
    vipPlatformColor: 0x3a1a5e,
    barPosition: [0, 0, -4.9],
    barSize: [11.5, 1.0, 0.8],
    wallPosition: [0, 3, -5.8],
  },

  // Bàn DJ sau lưng sàn nhảy: top donor (tổng 💎 cao nhất) đứng đây chơi DJ.
  // Vị trí: giữa cảnh, sau lưng các dancer, trước quầy bar (đã dời ra sau).
  // spotPosition: chỗ dancer đứng (sau bàn, quay mặt ra camera).
  djTable: {
    position: [0, 0, -3.35],
    size: [2.6, 0.95, 1.0],
    spotPosition: [0, 0, -4.05],
    tableColor: 0x1c1030,
    topColor: 0x241640,
    edgeColor: 0x00e5ff,
    platterRadius: 0.32,
    platterSpinSpeed: 6,
    // Tốc độ di chuyển tới/về bàn DJ (lerp / giây trong update()).
    moveLerpSpeed: 3,
    // Tay DJ: đưa ra trước, đặt lên bàn (rotation.x), hơi đung đưa theo nhịp.
    armForwardX: -1.05,
    armBobAmplitude: 0.08,
  },

  // Dancer: figure primitive, giới hạn số lượng cho máy yếu.
  // Nhân vật nhỏ lại (scale 0.8, user lệnh 22:14; thu thêm còn 0.72,
  // user lệnh 07:02) để đông người không che hết sàn; tối đa 12 dancer
  // (lưới 3 hàng × 4 cột).
  dancers: {
    maxDancers: 12,
    // Hệ số thu nhỏ toàn bộ dancer (nhân vào group.scale). Giữ nguyên
    // tỉ lệ chibi; tên + avatar trên đầu theo đúng chiều cao đầu mới
    // vì chúng là con của group (cùng scale).
    scale: 0.72,
    bobAmplitude: 0.09,
    jumpAmplitude: 0.55,
    armSwingAmplitude: 0.9,
    energyDecayPerSecond: 0.35,
    energyBoostChat: 0.4,
    energyBoostDanceCommand: 1.0,
    energyBoostGiftSmall: 0.8,
    energyBoostGiftMedium: 1.0,
    energyBoostGiftLarge: 1.0,
    jumpDurationSeconds: 0.7,
    energyBoostLike: 0.15,
    energyBoostFollow: 0.6,
    enterDurationSeconds: 0.6,
    leaveDurationSeconds: 0.5,
    // Rời live thì 10 phút sau mới out nhân vật (user lệnh 00:43):
    // người còn xem thì KHÔNG BAO GIỜ bị đuổi vì im lặng.
    leaveGraceSeconds: 600,
    orbitDurationSeconds: 8,
    orbitRadius: 3.2,
    orbitSpeed: 1.1,
    // Lệnh chat "giơ tay" (user lệnh 23:36): giơ 2 tay lên, blend mượt
    // vào/ra như skill, không qua hàng đợi skill, không lia camera.
    commandArmsUpDurationSeconds: 2.5,
    commandArmsUpBlendSeconds: 0.3,
    // Kích thước figure chibi Khá Bảnh (đơn vị scene): đầu to vừa phải,
    // thân nhỏ, tay chân cân đối — theo lệnh sếp 02:36 + polish 02:40
    // (đầu/tay/chân hài hòa, không đầu quá to, tay dài tới giữa đùi).
    headRadius: 0.5,
    bodyHeight: 0.5,
    bodyRadius: 0.3,
    armLength: 0.46,
    armRadius: 0.065,
    legLength: 0.44,
    legRadius: 0.085,
    avatarRadius: 0.21,
    nameLabelWidth: 1.5,
    nameLabelHeight: 0.28,
    // Nhân vật Khá Bảnh (lệnh sếp 02:36 + polish 02:40): tóc vuốt keo
    // chải ngược gọn gàng, hơi bóng; mặt trắng vẽ nét mảnh bằng canvas
    // texture — MỌI biến thể đều đeo kính đen, nét sạch, không lem/chồng
    // nét; áo đen sang + viền vàng vừa phải (vòng cổ vàng ở dưới).
    chibi: {
      headCenterY: 1.5,
      hairRadius: 0.55,
      // Nắp cầu ngắn hơn + nghiêng hẳn về sau = tóc vuốt keo chải ngược,
      // trán thoáng, gáy phủ kín tới ngang đầu (không lòa xòa trước mặt).
      hairThetaLength: 1.05,
      hairTiltX: -0.5,
      hairOffset: [0, 0.04, -0.03],
      hairColor: 0x141414,
      // Độ bóng nhẹ của keo vuốt tóc (MeshPhongMaterial).
      hairSpecular: 0x555555,
      hairShininess: 25,
      faceCanvasSize: 512,
      faceLineColor: '#151515',
      // Nét vẽ mặt mảnh, sạch (không tô dày như mặt meme cũ).
      faceLineWidth: 8,
      faceVariants: ['kinh-cuoi', 'kinh-khay', 'kinh-ha', 'kinh-nhe-rang', 'kinh-ngau', 'kinh-nhay', 'kinh-ngac', 'kinh-leu'],
      // Áo đen/tối sang (không còn áo xám); quần short tối màu, tay chân trắng.
      shirtColors: [0x17171c, 0x1f1f26, 0x23232b, 0x141419, 0x26221a, 0x1c222e, 0x2b2b2b],
      shortsColor: 0x2b2f36,
      skinWhite: 0xffffff,
      // Dây chuyền vàng + viền cổ vàng (lệnh 02:36, polish 02:40: nổi
      // bật nhưng tinh tế, không thô): vòng mảnh quanh cổ, mặt dây nhỏ
      // trước ngực, vòng cổ vàng mảnh viền áo — vàng phát sáng vừa.
      chain: {
        // Vòng cổ: bán kính lớn hơn bán kính thân (0.30) để nổi trên mặt
        // ngực, nghiêng nhẹ cho vạt trước rủ xuống như dây đeo thật.
        torusRadius: 0.32,
        torusTube: 0.02,
        torusY: 1.08,
        torusTilt: 0.25,
        collarRadius: 0.3,
        collarTube: 0.018,
        collarY: 1.13,
        pendantRadius: 0.045,
        pendantY: 0.94,
        pendantZ: 0.31,
        goldColor: 0xffd700,
        goldEmissive: 0x6b4e00,
        goldEmissiveIntensity: 0.35,
      },
      // Nhãn nhận diện viewer: avatar + tên nổi TRÊN đầu (Sprite luôn
      // quay về camera), không che mặt meme.
      avatarSpriteY: 2.32,
      nameSpriteY: 2.62,
    },
    // Vương miện vàng của top donor (user lệnh 22:26 + 02:22): từ 02:22
    // vương miện đội lên NGƯỜI MÚA CỘT TRONG LỒNG (mang tên top donor),
    // không còn đội lên chibi nữa; chỉ có ĐÚNG 1 cái, đổi top thì chuyển,
    // hòa điểm giữ nguyên, chưa có gift thì không có. Tọa độ theo headGroup
    // (gốc ở tâm đầu); khi gắn lên đầu người múa cột thì thu nhỏ theo
    // poleDancer.crownScale, chóp vẫn dưới nhãn tên sau khi nâng nhãn.
    crown: {
      bandRadius: 0.4,
      bandHeight: 0.14,
      bandY: 0.38,
      spikes: 5,
      spikeRadius: 0.07,
      spikeHeight: 0.16,
      spikeRingRadius: 0.3,
      jewelRadius: 0.05,
      goldColor: 0xffd700,
      goldEmissive: 0x6b4e00,
      jewelColor: 0xff2255,
      // Nâng nhãn tên/avatar khi đội vương miện để chóp không chạm nhãn.
      labelLiftY: 0.16,
    },

    // Slot của dancer khán giả: vòng ellipse QUANH LỒNG NHỎ (lệnh 02:20),
    // lệch nửa bước góc để không có slot nào chắn chính diện lồng.
    // Mọi slot đều ngoài đĩa cấm quanh lồng (nan 1.4m + đệm 0.35m) và
    // trong vùng đi dạo (z ≤ 2.21m), không chạm khu cấm VIP (x ≥ 3.95m).
    slotRing: {
      centerX: 0,
      centerZ: 0.35,
      radiusX: 3.8,
      radiusZ: 1.85,
    },

    // Người múa cột trong lồng (lệnh 02:20/02:21/02:22 + tả thực 02:44
    // + mẫu người thật 03/11): mẫu nữ GLB rigged (MakeHuman CC0, xem
    // models/CREDITS.md) + clip mocap — nhảy thường từ video @poppyyy0101,
    // skill múa cột khi donate từ video @chaniee102. Khi GLB/clip không
    // tải được thì tự rơi về body procedural cũ (thông số dưới đây).
    poleDancer: {
      defaultName: 'Múa cột',
      // Model người thật + clip (đường dẫn tương đối từ index.html).
      model: {
        glb: 'models/pole-dancer.glb',
        idleClip: 'models/pole-idle.clip.json', // nhảy thường, loop 12s
        skillClip: 'models/pole-skill.clip.json', // skill donate, 5s one-shot
        crossfadeSeconds: 0.3, // blend vào/ra clip skill
        // Phóng to lên xíu (user lệnh 06:47): 1,62m → ~1,75m; chân vẫn
        // chạm sàn (scale quanh gốc model ở gót), tay không chạm nan.
        scale: 1.08,
      },
      // Xoay 1 vòng quanh cột (lệnh 03:22): mỗi 8 bar, xoay đúng 1 vòng
      // trong 2 bar, quay mặt vào cột lúc xoay, nhảy thường hướng ra
      // ngoài (về phía camera). Skill đang chạy thì không bắt đầu vòng mới.
      spinEveryBars: 8,
      spinDurationBars: 2,
      spinFacingRate: 6, // /giây — blend hướng mặt vào/ra cột
      idleAngle: Math.PI / 2, // đứng chính diện lồng (phía camera)
      hipY: 0.9, // khớp hông
      thighLength: 0.46,
      thighRadius: 0.07,
      shinLength: 0.4,
      shinRadius: 0.05,
      calfRadius: 0.05,
      footLength: 0.19,
      footWidth: 0.07,
      footHeight: 0.05,
      hipsY: 0.97, // quần short diễn
      hipsRadiusTop: 0.15,
      hipsRadiusBottom: 0.165,
      hipsHeight: 0.18,
      waistY: 1.13, // eo trần (đồ 2 mảnh)
      waistRadiusTop: 0.115,
      waistRadiusBottom: 0.13,
      waistHeight: 0.18,
      chestY: 1.33, // áo diễn bandeau
      chestRadiusTop: 0.14,
      chestRadiusBottom: 0.125,
      chestHeight: 0.2,
      shoulderY: 1.44, // khớp vai
      shoulderDX: 0.2,
      upperArmLength: 0.28,
      upperArmRadius: 0.04,
      forearmLength: 0.26,
      forearmRadius: 0.032,
      handRadius: 0.035,
      neckY: 1.47,
      neckRadius: 0.05,
      neckHeight: 0.1,
      bustY: 1.32,
      bustRadius: 0.1,
      bustDX: 0.085,
      bustDZ: 0.075,
      headRadius: 0.115, // đầu ~1/7,5 chiều cao
      headCenterY: 1.635,
      hairLength: 0.78, // tóc dài tới eo, xõa lưng
      skinColor: 0xe8b98d, // da tông thật, ấm
      skinSpecular: 0x40301e, // shading mềm, không trắng bệch phẳng
      skinShininess: 12,
      hairColor: 0x2a1a12, // nâu sẫm tự nhiên
      hairHighlightColor: 0x5a3d24, // sợi highlight nâu sáng
      hairSpecular: 0x887788,
      hairShininess: 35,
      topColor: 0xff2e88,
      topEmissive: 0x550a2e,
      shortsColor: 0x2a0f3d,
      bootColor: 0x11111c,
      // Đai lưng neon mảnh ở eo: vòng phát sáng vừa, cùng chất liệu áo.
      waistbandY: 1.06,
      waistbandRadius: 0.18,
      waistbandTube: 0.02,
      nameSpriteY: 2.05, // tên trên đầu model GLB (đỉnh đầu 1,63m × scale 1,08 ≈ 1,76m)
      // Nhãn tên cô múa cột rõ hơn dàn ngoài một chút (lệnh 06:13),
      // không che mặt (đã tính cả vương miện + labelLiftY).
      labelScale: 1.15,
      // Vòng sáng dưới chân cô múa cột (lệnh 06:13): emissive thuần,
      // không thêm đèn; y = 0,12 nằm trên mặt đế lồng (đỉnh 0,10).
      glowRing: {
        color: 0xff5fb0,
        innerRadius: 0.3, // ngoài chân đế cột (0,22)
        outerRadius: 0.6,
        y: 0.12,
        opacity: 0.55,
      },
      crownScale: 0.3, // vương miện thu nhỏ theo đầu người thật (0.4*0.3≈0.12)
      orbitRadius: 0.34, // bám sát cột (cột r=0.05, tay với tới cột)
      spinSpeed: 1.1, // rad/s cơ bản quanh cột
      spinBeatBoost: 0.7, // cộng thêm theo nhịp (nhanh/chậm theo beat)
      poseCount: 4, // đổi tư thế theo bar nhạc: ôm cột / nghiêng / co chân / dang tay
      // Múa mượt + dẻo kiểu người thật (02:43/02:44): tư thế blend mềm
      // hàm mũ, đầu + tóc lắc trễ mềm theo beat (follow-through).
      poseBlendSpeed: 6, // /giây — nội suy tư thế đích → hiện tại
      headSwaySpeed: 3, // /giây — đầu lắc trễ mềm theo beat
      headSwayAmplitude: 0.05, // radian lắc đầu tối đa
      hairSwaySpeed: 2, // /giây — tóc lắc chậm hơn đầu (quán tính)
      hairSwayAmplitude: 0.08, // radian tóc đung đưa tối đa
    },
    // Bộ động tác nhảy thường (user lệnh 22:29, chê đứng 1 chỗ nhàm):
    // đổi theo ranh giới bar nhạc (4 nhịp/bar, BPM trong CONFIG.music),
    // mỗi dancer lệch pha/ngẫu nhiên riêng. Từ 23:26 dancer đi dạo tự
    // do khắp sàn (CONFIG.dancers.wander): bước ngang/lắc hông dịch
    // ngang theo hướng vuông góc với hướng đi rồi về lại đường đi,
    // không về ô cố định nữa. Người múa cột trong lồng KHÔNG làm bộ này
    // (múa cột riêng theo bar); skill đè lên động tác thường, xong skill
    // thì về lại bộ này.
    danceMoves: {
      beatsPerBar: 4,
      // Bước ngang: dịch sang trái/phải rồi về ô (nhỏ hơn khoảng cách ô).
      stepDistance: 0.35,
      // Bật nhảy: cao thêm so với nhún thường.
      hopHeight: 0.28,
      // Lắc hông: nghiêng người + dịch ngang nhẹ.
      swayAngle: 0.12,
      swayShift: 0.08,
      // Vung tay: quét tay lên/xuống xen kẽ + tay đung đưa mạnh hơn.
      armSweep: 0.9,
      armSweepMultiplier: 1.6,
      // Tỉ trọng chọn động tác kế (không chọn trùng động tác đang chạy).
      weights: { base: 30, spin: 15, step: 20, arms: 15, hop: 10, sway: 10 },
    },
    // Đi dạo tự do trên sàn (user lệnh 23:26: "đi lộn xộn nhưng có trật
    // tự"): dancer trôi quanh sàn theo hướng ngẫu nhiên, tốc độ chậm như
    // đi dạo, đổi hướng mềm; luôn ở trong sàn, giữ khoảng cách nhau,
    // không vào khu bàn DJ / bục VIP / booth DJ. DJ giữ tư thế DJ,
    // skill đè lên rồi về lại đi dạo, VIP giữ nguyên. Vùng đi dạo suy
    // ra từ CONFIG.floor (trừ lề) + khu cấm suy ra từ CONFIG.djTable /
    // CONFIG.stage (có đệm) — sửa sàn/bàn thì vùng tự theo, không
    // hardcode tọa độ sàn ở đây.
    wander: {
      // Tốc độ đi dạo (m/giây) — chậm như đi dạo, không chạy.
      // Bớt đi vòng vòng (user lệnh 00:05): chậm lại ~một nửa, đi
      // thẳng lâu hơn, quẹo nhẹ hơn — nhảy tại chỗ là chính, thỉnh
      // thoảng mới trôi chỗ khác.
      speed: 0.18,
      // Mỗi dancer nhanh/chậm hơn tốc độ chuẩn ±tỉ lệ này (cố định lúc
      // tạo, để không ai giống ai).
      speedVariation: 0.15,
      // Tốc độ đổi hướng tối đa (rad/giây) — quay mềm, không quay ngoắt.
      turnRate: 0.9,
      // Đổi hướng ngẫu nhiên sau mỗi khoảng này (giây), lệch pha riêng.
      retargetSecondsMin: 7,
      retargetSecondsMax: 12,
      // Góc đổi hướng ngẫu nhiên tối đa mỗi lần (±radian quanh hướng cũ).
      retargetMaxTurn: 0.7,
      // Khoảng cách tối thiểu giữa 2 dancer (m) — không chồng lấn nhau.
      minSeparation: 0.7,
      // Lề trong của sàn: không đi sát mép sàn quá lề này.
      edgeMargin: 0.55,
      // Đệm quanh các khu cấm (bàn DJ, bục VIP, booth DJ) khi tránh.
      keepOutPadding: 0.35,
      // Đệm thêm quanh lồng sắt (tính từ nan lồng): dancer không đi
      // xuyên nan, tay vung không chạm lồng.
      cageKeepOutMargin: 0.35,
      // Bán kính nhìn trước khi tránh tường/vật cản (m).
      lookAhead: 0.5,
    },
  },

  // Lệnh chat tiếng Việt. So khớp sau khi chuẩn hoá (không dấu, thường hoá),
  // chấp nhận lệnh nằm trong câu. Thêm lệnh mới = thêm chuỗi vào đây.
  commands: {
    dance: ['nhảy', 'nhay', 'dance'],
    changeCharacter: ['đổi nv', 'doi nv', 'đổi nhân vật', 'doi nhan vat', 'đổi chỗ', 'doi cho'],
    orbit: ['đi vòng', 'di vong', 'đi vòng quanh', 'di vong quanh'],
    // Giơ 2 tay lên (user lệnh 23:36; nhánh xử lý trong dancers.js applyCommand).
    armsUp: ['giơ tay', 'gio tay', 'giơ 2 tay', 'gio 2 tay', '2 tay'],
  },

  // Gift theo mức kim cương. Mọi hiệu ứng gift đọc từ đây.
  gifts: {
    // tiers phải xếp theo maxDiamonds tăng dần; tier cuối = Infinity.
    tiers: [
      {
        id: 'small',
        maxDiamonds: 49,
        label: 'nhỏ',
        effects: {
          danceBoost: true,
          smallEffect: true,
          cameraZoom: false,
          changeCharacter: false,
          spotlight: false,
          fireworks: false,
          vipPodium: false,
        },
      },
      {
        id: 'medium',
        maxDiamonds: 499,
        label: 'trung',
        effects: {
          danceBoost: true,
          smallEffect: false,
          cameraZoom: true,
          changeCharacter: true,
          spotlight: false,
          fireworks: false,
          vipPodium: false,
        },
      },
      {
        id: 'large',
        maxDiamonds: Infinity,
        label: 'lớn (VIP)',
        effects: {
          danceBoost: true,
          smallEffect: false,
          cameraZoom: true,
          changeCharacter: true,
          spotlight: true,
          fireworks: true,
          vipPodium: true,
        },
      },
    ],
    topBoardMax: 5,
    vipDurationSeconds: 20,
    fireworksCount: 120,
    fireworksLifeSeconds: 1.6,
    fireworksSpread: 3.2,
    // Hiệu ứng nhỏ (gift nhỏ): vòng sáng quanh dancer trong bao lâu.
    smallRingDurationSeconds: 1.2,
    // Pool pháo hoa tái dùng (không tạo geometry/material mới mỗi lần nổ).
    fireworksPoolSize: 4,
  },

  // Skill nhảy theo gift (user lệnh 21:47). Hàng đợi FIFO: mỗi skill chạy
  // trọn rồi mới tới skill sau; vượt quá hàng đợi thì bỏ qua (chống dồn ứ).
  // Mọi ngưỡng/thời lượng/camera/âm thanh đọc từ đây, code không hardcode.
  skills: {
    queueMaxPending: 6,
    // Camera skill nhìn vào mặt dancer (đầu to, tâm đầu ~1.2m ở scale 0.8).
    cameraLookAtHeight: 1.2,
    // Dancer ở bàn DJ (sau lưng, sau bàn): lùi camera ra thêm để cả bàn
    // + dancer đều trong khung, khỏi bị bàn che (framing lúc santo 22:29).
    djCameraExtraDistance: 1.2,
    djCameraExtraHeight: 0.3,
    // Skill "1 hoa hồng": gift tên hoa hồng, tổng kim cương nhỏ.
    // Camera lia vào đúng dancer, dancer MÚA QUẠT kiểu Khá Bảnh suốt
    // thời gian skill (lệnh sếp 02:36): 2 tay đưa ra trước ngực, vẫy
    // luân phiên lên-xuống như cái quạt, theo nhịp beat, người lắc nhẹ.
    // Camera lia + thời lượng + hàng đợi giữ nguyên như skill rose cũ
    // (chỉ đổi động tác — bỏ giơ 2 tay chữ V). armsUpBlendSeconds dùng
    // chung làm độ blend vào/ra của điệu quạt.
    rose: {
      names: ['hoa hong', 'rose', '🌹'],
      maxTotalDiamonds: 9,
      durationSeconds: 3.2,
      armsUpBlendSeconds: 0.3,
      // Múa quạt: tay đưa ra trước (rotation.x), vẫy lên-xuống luân
      // phiên 2 chu kỳ mỗi nhịp, dang ngang vừa phải, người lắc nhẹ.
      fanForwardX: -1.15,
      fanWaveAmplitude: 0.38,
      fanWavesPerBeat: 2,
      fanSpreadZ: 0.55,
      fanSwayAngle: 0.06,
      cameraDistance: 3.6,
      cameraHeight: 2.2,
      cameraLerpSpeed: 3.0,
    },
    // Skill "gift lớn": donate từ ngưỡng này trở lên (mặc định ≥10 💎,
    // tức tier trung trở lên). Camera lia + nhảy santo 1 vòng + pháo bông
    // nhiều đợt. Tier lớn (VIP) giữ hành vi VIP sẵn có + thêm skill này.
    grand: {
      minTotalDiamonds: 10,
      durationSeconds: 4.5,
      armsUpBlendSeconds: 0.3,
      somersaultDelaySeconds: 0.5,
      somersaultDurationSeconds: 1.4,
      somersaultHeight: 1.6,
      cameraDistance: 4.0,
      cameraHeight: 2.5,
      cameraLerpSpeed: 2.6,
      fireworksWaves: 3,
      fireworksWaveIntervalSeconds: 0.45,
      fireworksColors: [0xffe600, 0xff2e88, 0x00e5ff],
      // Âm DJ pad theo mốc: riser khi bắt đầu skill, impact khi bắt đầu santo.
      // Gọi qua hook onSkillPad -> music.triggerPad (js/audio.js, agent nhạc).
      pads: { onStart: 'riser', onSomersault: 'impact' },
    },
  },

  // Gán sự kiện live → lên sàn. Like cần đủ count mới lên sàn (chống spam).
  // Người xem vừa vào phòng tự lên sàn, khỏi đợi bình luận (user 23:36).
  events: {
    chatJoinsFloor: true,
    followJoinsFloor: true,
    giftJoinsFloor: true,
    joinJoinsFloor: true,
    likeJoinThreshold: 1, // user lệnh 23:55: thả tim là vào sàn — mọi like đều lên sàn
    tickerMaxItems: 4,
    tickerDurationMs: 6000,
  },

  // Nhạc nền: tổng hợp bằng WebAudio, KHÔNG dùng nhạc có bản quyền.
  // Cấu trúc DJ: warm-up → build → drop, tự chuyển đoạn theo bar.
  // Mọi pattern/âm lượng nhạc đọc từ đây; js/audio.js không hardcode.
  music: {
    bpm: 128,
    masterVolume: 0.45,
    // Nhạc tự chạy sau khi bấm "Bắt đầu" (unlock audio trên điện thoại).
    startOnUnlock: true,
    // Âm lượng từng lớp (tỉ lệ so với master).
    kickVolume: 0.9,
    snareVolume: 0.5,
    bassVolume: 0.32,
    hatVolume: 0.18,
    openHatVolume: 0.14,
    arpVolume: 0.15,
    padVolume: 0.11,
    // Tự chuyển đoạn; hết đoạn cuối thì quay lại đoạn loopFromSection.
    autoSections: true,
    loopFromSection: 1,
    // 1 bar = 16 bước (16th note). Pattern theo từng đoạn.
    sections: [
      {
        id: 'warmup',
        bars: 8,
        kickSteps: [0, 8],
        snareSteps: [],
        hatSteps: [6, 14],
        openHatSteps: [],
        bassPattern: [55, 0, 0, 0, 0, 0, 65.41, 0, 49, 0, 0, 0, 0, 0, 58.27, 0],
        arpPattern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        // Hợp âm pad theo từng bar (Hz) — 8 bar lặp.
        padChords: [
          [220.0, 261.63, 329.63],
          [174.61, 220.0, 261.63],
          [196.0, 261.63, 329.63],
          [196.0, 246.94, 293.66],
          [220.0, 261.63, 329.63],
          [174.61, 220.0, 261.63],
          [196.0, 261.63, 329.63],
          [196.0, 246.94, 293.66],
        ],
        riserLastBars: 0,
      },
      {
        id: 'build',
        bars: 8,
        kickSteps: [0, 4, 8, 12],
        snareSteps: [12],
        hatSteps: [2, 6, 10, 14],
        openHatSteps: [],
        bassPattern: [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 55, 0, 58.27, 0, 65.41, 0],
        arpPattern: [440, 0, 0, 0, 523.25, 0, 0, 0, 440, 0, 0, 0, 659.25, 0, 0, 0],
        padChords: [],
        // 2 bar cuối đoạn build: riser kéo lên, impact nổ ở downbeat đoạn drop.
        riserLastBars: 2,
      },
      {
        id: 'drop',
        bars: 16,
        kickSteps: [0, 4, 8, 12],
        snareSteps: [4, 12],
        hatSteps: [2, 6, 10, 14],
        openHatSteps: [14],
        bassPattern: [55, 55, 0, 55, 0, 65.41, 0, 55, 49, 49, 0, 49, 0, 58.27, 0, 65.41],
        arpPattern: [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 440, 0, 587.33, 0, 659.25, 0, 783.99, 0],
        padChords: [],
        riserLastBars: 0,
      },
    ],
    // Âm thanh DJ pad kích hoạt tay (gift lớn / nút DJ sau này).
    pads: {
      riserVolume: 0.22,
      impactVolume: 0.85,
      airhornVolume: 0.32,
      airhornSeconds: 0.9,
      sirenVolume: 0.2,
      sirenSeconds: 1.6,
    },
    // Track file: catalog nhạc DJ (Mixkit Free License — thương mại được,
    // không cần ghi công; xem audio/MUSIC.md). Mỗi file cắt đúng 32 bar ở
    // đúng BPM đo được để vòng lặp + chuyển track liền mạch. `hot: true`
    // = track "hot" (năng lượng cao, gần gu Vinahouse/EDM đang thịnh hành)
    // được ưu tiên lên trước trong hàng đợi. `gain` = hệ số riêng từng
    // track (chuẩn hóa âm lượng đã làm lúc cắt file, gain giữ = 1).
    // Chế độ mặc định: 'file' khi có track (nạp thất bại hết thì engine
    // tự rớt về synth). Đổi 'synth' để chỉ chạy nhạc tổng hợp.
    defaultMode: 'file',
    tracks: [
      { src: 'audio/nst-top-nhac-hot-tiktok-2k26.mp3', title: 'NST 1H Top Nhạc Hot TikTok 2K26', artist: 'Anh Kiet Organ', license: 'Unverified - YouTube via cobalt, user accepts risk', licenseUrl: 'https://www.youtube.com/watch?v=gw-doLdjj6o', bpm: 146.5, bars: 32, gain: 1, hot: true },
    ],
    // Hàng đợi đẩy liên tục: trộn thứ tự, track hot lên trước, crossfade
    // đúng ranh giới bar khi chuyển track, hết vòng thì trộn lại.
    playlist: {
      shuffle: true,
      hotFirst: true,
      crossfadeSeconds: 0.6,
    },
    trackGain: 0.8,
  },

  hud: {
    fpsUpdateIntervalMs: 500,
    tickerPrefixChat: '💬',
    tickerPrefixLike: '❤️',
    tickerPrefixFollow: '➕',
    tickerPrefixGift: '🎁',
  },

  // Demo test-only. Mặc định TẮT; chỉ bật khi URL có ?demo=1.
  // CẤM dùng khi live thật (không giả lập người xem).
  demo: {
    enabledByDefault: false,
    intervalMs: 2600,
    fakeNames: ['Minh Anh', 'Tuấn Kiệt', 'Thu Hằng', 'Hoàng Nam', 'Khánh Linh', 'Đức Anh', 'Phương Thảo', 'Gia Bảo'],
    fakeChats: ['nhảy đi mọi người ơi', 'đổi nv cho mình với', 'đi vòng nào', 'nhạc hay quá', 'cho mình lên sàn với', 'đi bar 5.0 vui ghê'],
    fakeGifts: [
      { giftName: 'Hoa hồng', diamonds: 1, count: 1 },
      { giftName: 'Trái tim', diamonds: 10, count: 3 },
      { giftName: 'Bia', diamonds: 99, count: 1 },
      { giftName: 'Xe hơi', diamonds: 299, count: 1 },
      { giftName: 'Lâu đài', diamonds: 1000, count: 1 },
    ],
  },

  relay: {
    // Stub: chưa nối thật. Pha relay sẽ điền url/username/apiKey thật.
    statusDisconnected: 'Relay: chưa kết nối (stub)',
    statusStub: 'Relay: STUB — chưa nối thật, chờ pha relay',
  },
};
