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
  camera: {
    fov: 48,
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
  },

  discoBall: {
    radius: 0.55,
    segments: 12,
    position: [0, 5.2, 0],
    spinSpeed: 0.9,
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
  // Nhân vật nhỏ lại (scale 0.8, user lệnh 22:14) để đông người không
  // che hết sàn; tối đa 12 dancer (lưới 3 hàng × 4 cột).
  dancers: {
    maxDancers: 12,
    // Hệ số thu nhỏ toàn bộ dancer (nhân vào group.scale). Giữ nguyên
    // tỉ lệ chibi; tên + avatar trên đầu theo đúng chiều cao đầu mới
    // vì chúng là con của group (cùng scale).
    scale: 0.8,
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
    orbitDurationSeconds: 8,
    orbitRadius: 3.2,
    orbitSpeed: 1.1,
    // Lệnh chat "giơ tay" (user lệnh 23:36): giơ 2 tay lên, blend mượt
    // vào/ra như skill, không qua hàng đợi skill, không lia camera.
    commandArmsUpDurationSeconds: 2.5,
    commandArmsUpBlendSeconds: 0.3,
    // Kích thước figure chibi meme (đơn vị scene): đầu to, thân nhỏ,
    // tay chân ngắn — theo ảnh tham chiếu user gửi (tóc bát úp, mặt meme).
    headRadius: 0.52,
    bodyHeight: 0.5,
    bodyRadius: 0.3,
    armLength: 0.42,
    armRadius: 0.07,
    legLength: 0.42,
    legRadius: 0.09,
    avatarRadius: 0.21,
    nameLabelWidth: 1.5,
    nameLabelHeight: 0.28,
    // Nhân vật chibi meme: tóc bát úp đen, mặt trắng vẽ nét đen bằng
    // canvas texture (4 biến thể biểu cảm, dùng chung — không asset ngoài).
    chibi: {
      headCenterY: 1.52,
      hairRadius: 0.55,
      hairThetaLength: 1.15,
      hairTiltX: 0.12,
      hairColor: 0x141414,
      faceCanvasSize: 512,
      faceLineColor: '#151515',
      faceVariants: ['cuoi-ha', 'nhe-rang', 'kinh', 'tinh-nghich'],
      // Áo thun xám (nhiều sắc độ), quần short tối màu, tay chân trắng.
      shirtGrays: [0x9aa0a6, 0x868c93, 0xaab0b6, 0x767c84],
      shortsColor: 0x2b2f36,
      skinWhite: 0xffffff,
      // Nhãn nhận diện viewer: avatar + tên nổi TRÊN đầu (Sprite luôn
      // quay về camera), không che mặt meme.
      avatarSpriteY: 2.32,
      nameSpriteY: 2.62,
    },
    // Vương miện vàng của top donor (user lệnh 22:26): đội trên đỉnh tóc
    // bát úp, chỉ có ĐÚNG 1 cái, gắn theo logic top donor sẵn có (đổi top
    // thì chuyển, hòa điểm giữ nguyên, chưa có gift thì không có).
    // Tọa độ theo headGroup (gốc ở tâm đầu, tâm đầu cao headCenterY):
    // vòng ôm đúng mặt ngoài tóc ở bandY, chóp vươn lên nhưng vẫn dưới
    // đĩa avatar sau khi nâng nhãn (labelLiftY).
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
      // Nâng nhãn tên/avatar khi đội vương miện để chóp không chạm đĩa avatar.
      labelLiftY: 0.16,
    },
    // Bộ động tác nhảy thường (user lệnh 22:29, chê đứng 1 chỗ nhàm):
    // đổi theo ranh giới bar nhạc (4 nhịp/bar, BPM trong CONFIG.music),
    // mỗi dancer lệch pha/ngẫu nhiên riêng. Từ 23:26 dancer đi dạo tự
    // do khắp sàn (CONFIG.dancers.wander): bước ngang/lắc hông dịch
    // ngang theo hướng vuông góc với hướng đi rồi về lại đường đi,
    // không về ô cố định nữa. Dancer bàn DJ KHÔNG làm bộ này (giữ tư
    // thế DJ); skill đè lên động tác thường, xong skill thì về lại bộ này.
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
      speed: 0.35,
      // Mỗi dancer nhanh/chậm hơn tốc độ chuẩn ±tỉ lệ này (cố định lúc
      // tạo, để không ai giống ai).
      speedVariation: 0.15,
      // Tốc độ đổi hướng tối đa (rad/giây) — quay mềm, không quay ngoắt.
      turnRate: 1.4,
      // Đổi hướng ngẫu nhiên sau mỗi khoảng này (giây), lệch pha riêng.
      retargetSecondsMin: 3,
      retargetSecondsMax: 6,
      // Góc đổi hướng ngẫu nhiên tối đa mỗi lần (±radian quanh hướng cũ).
      retargetMaxTurn: 1.4,
      // Khoảng cách tối thiểu giữa 2 dancer (m) — không chồng lấn nhau.
      minSeparation: 0.7,
      // Lề trong của sàn: không đi sát mép sàn quá lề này.
      edgeMargin: 0.55,
      // Đệm quanh các khu cấm (bàn DJ, bục VIP, booth DJ) khi tránh.
      keepOutPadding: 0.35,
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
    // Camera lia vào đúng dancer, dancer giơ 2 tay lên và nhảy.
    rose: {
      names: ['hoa hong', 'rose', '🌹'],
      maxTotalDiamonds: 9,
      durationSeconds: 3.2,
      armsUpBlendSeconds: 0.3,
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
    likeJoinThreshold: 10,
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
      { src: 'audio/house-fest-113.mp3', title: 'House Fest', artist: 'Alejandro Magaña', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 124.0, bars: 32, gain: 1, hot: true },
      { src: 'audio/techno-fest-vibes-124.mp3', title: 'Techno Fest Vibes', artist: 'Alejandro Magaña', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 124.0, bars: 32, gain: 1, hot: true },
      { src: 'audio/techno-fest-feel-125.mp3', title: 'Techno Fest Feel', artist: 'Alejandro Magaña', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 126.0, bars: 32, gain: 1, hot: true },
      { src: 'audio/dance-zero-740.mp3', title: 'Dance Zero', artist: 'Lily J', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 123.9, bars: 32, gain: 1, hot: true },
      { src: 'audio/dance-away-781.mp3', title: 'Dance Away', artist: 'Michael Ramir C', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 149.9, bars: 32, gain: 1, hot: true },
      { src: 'audio/positive-energy-973.mp3', title: 'Positive Energy', artist: 'Michael Ramir C', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 135.0, bars: 32, gain: 1, hot: true },
      { src: 'audio/india-205.mp3', title: 'India', artist: 'Arulo', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 128.0, bars: 32, gain: 1, hot: true },
      { src: 'audio/infected-mushroom-vibes-136.mp3', title: 'Infected Mushroom Vibes', artist: 'Alejandro Magaña', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 145.0, bars: 32, gain: 1, hot: true },
      { src: 'audio/house-02-744.mp3', title: 'House 02', artist: 'Lily J', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 123.0, bars: 32, gain: 1, hot: true },
      { src: 'audio/dance-like-theres-no-tomorrow-1095.mp3', title: "Dance Like There's No Tomorrow", artist: 'Michael Ramir C', license: 'Mixkit Free License', licenseUrl: 'https://mixkit.co/license/', bpm: 126.1, bars: 32, gain: 1, hot: false },
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
