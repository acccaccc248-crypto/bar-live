// scene.js — cảnh bar NGANG 16:9, giao diện mới theo ảnh mẫu (user lệnh
// 01:46 + ảnh 01:53): LỒNG SẮT tròn lớn ở giữa sàn (dancer nhảy BÊN
// TRONG lồng), quả cầu disco treo trong lồng, laser tím/hồng/cyan,
// tường LED họa tiết hình học, sàn bóng phản chiếu giả, ghế sofa VIP
// 2 bên, bàn DJ sau lồng như sân khấu. Giữ nguyên mọi logic/API:
// pulseBeat, setVipSpotlight, spawnFireworks, spawnRing, update,
// vị trí slot/bàn DJ/bục VIP, khung camera skill.
// Nhẹ cho máy yếu: vật liệu rẻ (Basic/Lambert), KHÔNG shadow map,
// không thêm đèn thật, nan lồng + vòm dùng InstancedMesh (2 draw call).

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createBarScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.renderer.clearColor);
  scene.fog = new THREE.Fog(CONFIG.renderer.clearColor, 18, 34);

  const clockState = { time: 0 };
  // Nhịp đập mới nhất (0..1, mờ dần): laser + quả cầu disco + vệt
  // phản chiếu sàn sáng theo beat, không thêm đèn.
  let beatFlash = 0;

  // ---- Ánh sáng nền + đèn disco di động (không shadow) ----
  const ambient = new THREE.AmbientLight(
    CONFIG.lights.ambientColor,
    CONFIG.lights.ambientIntensity,
  );
  scene.add(ambient);

  const discoLightA = new THREE.PointLight(
    CONFIG.lights.discoColorA,
    CONFIG.lights.discoIntensity,
    CONFIG.lights.discoDistance,
  );
  const discoLightB = new THREE.PointLight(
    CONFIG.lights.discoColorB,
    CONFIG.lights.discoIntensity,
    CONFIG.lights.discoDistance,
  );
  scene.add(discoLightA, discoLightB);

  // Spotlight VIP: tắt mặc định, chỉ bật khi gift lớn / lên bục VIP.
  const vipSpot = new THREE.SpotLight(
    CONFIG.lights.vipSpotColor,
    0,
    CONFIG.lights.vipSpotDistance,
    CONFIG.lights.vipSpotAngle,
  );
  vipSpot.position.set(
    CONFIG.stage.vipPosition[0],
    CONFIG.lights.discoOrbitHeight + 1,
    CONFIG.stage.vipPosition[2],
  );
  vipSpot.target.position.set(...CONFIG.stage.vipPosition);
  scene.add(vipSpot, vipSpot.target);

  // ---- Sàn nhảy: lưới ô ----
  const floorGroup = new THREE.Group();
  const tileGeo = new THREE.BoxGeometry(
    CONFIG.floor.tileSize - CONFIG.floor.gap,
    CONFIG.floor.tileHeight,
    CONFIG.floor.tileSize - CONFIG.floor.gap,
  );
  const floorWidth = CONFIG.floor.cols * CONFIG.floor.tileSize;
  const floorDepth = CONFIG.floor.rows * CONFIG.floor.tileSize;
  const tiles = [];
  for (let r = 0; r < CONFIG.floor.rows; r += 1) {
    for (let c = 0; c < CONFIG.floor.cols; c += 1) {
      const baseColor = CONFIG.floor.colors[(r + c) % CONFIG.floor.colors.length];
      const mat = new THREE.MeshBasicMaterial({ color: baseColor });
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(
        (c - (CONFIG.floor.cols - 1) / 2) * CONFIG.floor.tileSize,
        -CONFIG.floor.tileHeight / 2,
        (r - (CONFIG.floor.rows - 1) / 2) * CONFIG.floor.tileSize,
      );
      tile.userData.baseColor = baseColor;
      tile.userData.glowUntil = 0;
      floorGroup.add(tile);
      tiles.push(tile);
    }
  }
  scene.add(floorGroup);

  // Viền sàn phát sáng nhẹ.
  const rimGeo = new THREE.BoxGeometry(floorWidth + 0.3, 0.06, floorDepth + 0.3);
  const rim = new THREE.Mesh(
    rimGeo,
    new THREE.MeshBasicMaterial({ color: CONFIG.floor.beatColors[1] }),
  );
  rim.position.y = -0.06;
  scene.add(rim);

  // ---- Sàn bóng (phản chiếu GIẢ, không reflector thật) ----
  // Mặt sàn tối bóng dưới lưới ô: 1 mặt Phong bắt sáng điểm của đèn disco.
  const gloss = new THREE.Mesh(
    new THREE.PlaneGeometry(floorWidth + 0.6, floorDepth + 0.6),
    new THREE.MeshPhongMaterial({
      color: CONFIG.scene.floorGloss.color,
      specular: CONFIG.scene.floorGloss.specular,
      shininess: CONFIG.scene.floorGloss.shininess,
    }),
  );
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.y = -0.1;
  scene.add(gloss);

  // Vệt sáng neon phản chiếu giả: 4 blob additive mờ trên sàn, sáng
  // theo beat. Dùng chung 1 texture gradient tròn, 4 material màu khác nhau.
  const blobCanvas = document.createElement('canvas');
  blobCanvas.width = 128;
  blobCanvas.height = 128;
  const blobCtx = blobCanvas.getContext('2d');
  const blobGrad = blobCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
  blobGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
  blobGrad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  blobGrad.addColorStop(1, 'rgba(255,255,255,0)');
  blobCtx.fillStyle = blobGrad;
  blobCtx.fillRect(0, 0, 128, 128);
  const blobTexture = new THREE.CanvasTexture(blobCanvas);
  const blobGeo = new THREE.PlaneGeometry(3.0, 2.0);
  const blobDefs = [
    { x: 0, z: 0.4, color: 0xff2e88, opacity: 0.16 },
    { x: -2.4, z: 1.4, color: 0x00e5ff, opacity: 0.12 },
    { x: 2.4, z: 1.4, color: 0x7c4dff, opacity: 0.12 },
    { x: 0, z: -1.6, color: 0xff5fd0, opacity: 0.12 },
  ];
  const blobMats = [];
  blobDefs.forEach((def) => {
    const mat = new THREE.MeshBasicMaterial({
      map: blobTexture,
      color: def.color,
      transparent: true,
      opacity: def.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const blob = new THREE.Mesh(blobGeo, mat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(def.x, 0.02, def.z);
    scene.add(blob);
    blobMats.push({ mat, baseOpacity: def.opacity });
  });

  // ---- LỒNG SẮT NHỎ TRUNG TÂM: chỉ 1 người múa cột bên trong ----
  // Lệnh 02:20: thu nhỏ còn ~1.4m (vừa 1 người + cột, tay dang không
  // chạm nan); dancer khán giả nhảy bên NGOÀI, vòng quanh lồng (slot
  // vòng trong dancers.js). Tâm lồng giữ nguyên như cũ.
  const cageCfg = CONFIG.scene.cage;
  const cageR = cageCfg.radius;
  const cageX = cageCfg.centerX;
  const cageZ = cageCfg.centerZ;
  const barTopY = cageCfg.barBaseY + cageCfg.barHeight;
  const cageGroup = new THREE.Group();
  scene.add(cageGroup);
  const dummy = new THREE.Object3D();

  // Nan dọc: 1 InstancedMesh (1 draw call).
  const barGeo = new THREE.CylinderGeometry(
    cageCfg.barRadius, cageCfg.barRadius, cageCfg.barHeight, 5,
  );
  const barMat = new THREE.MeshLambertMaterial({ color: cageCfg.barColor });
  const bars = new THREE.InstancedMesh(barGeo, barMat, cageCfg.barCount);
  bars.frustumCulled = false;
  for (let i = 0; i < cageCfg.barCount; i += 1) {
    const a = (i / cageCfg.barCount) * Math.PI * 2;
    dummy.position.set(
      cageX + Math.cos(a) * cageR,
      cageCfg.barBaseY + cageCfg.barHeight / 2,
      cageZ + Math.sin(a) * cageR,
    );
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    bars.setMatrixAt(i, dummy.matrix);
  }
  bars.instanceMatrix.needsUpdate = true;
  cageGroup.add(bars);

  // 3 vành ngang kim loại (đáy, giữa, đỉnh trụ) — vành giữa theo tỉ lệ chiều cao.
  const ringGeo = new THREE.TorusGeometry(cageR, 0.05, 6, 64);
  const ringMat = new THREE.MeshLambertMaterial({ color: cageCfg.ringColor });
  [0.35, barTopY * 0.55, barTopY - 0.05].forEach((y) => {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cageX, y, cageZ);
    cageGroup.add(ring);
  });

  // Vòm: nan cong (TorusGeometry arc 90° ép dẹt theo chiều cao vòm),
  // 1 InstancedMesh (1 draw call).
  const ribGeo = new THREE.TorusGeometry(cageR, 0.03, 4, 20, Math.PI / 2);
  ribGeo.scale(1, cageCfg.domeHeight / cageR, 1);
  const ribMat = new THREE.MeshLambertMaterial({ color: cageCfg.barColor });
  const ribs = new THREE.InstancedMesh(ribGeo, ribMat, cageCfg.domeRibs);
  ribs.frustumCulled = false;
  for (let i = 0; i < cageCfg.domeRibs; i += 1) {
    dummy.position.set(cageX, barTopY, cageZ);
    dummy.rotation.set(0, (i / cageCfg.domeRibs) * Math.PI * 2, 0);
    dummy.updateMatrix();
    ribs.setMatrixAt(i, dummy.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  cageGroup.add(ribs);

  // 2 vành ngang trên vòm (theo đường cong ellipse của nan).
  [[0.5, 0.866], [0.8, 0.6]].forEach(([hFrac, rFrac]) => {
    const domeRing = new THREE.Mesh(
      new THREE.TorusGeometry(cageR * rFrac, 0.04, 6, 48),
      ringMat,
    );
    domeRing.rotation.x = Math.PI / 2;
    domeRing.position.set(cageX, barTopY + cageCfg.domeHeight * hFrac, cageZ);
    cageGroup.add(domeRing);
  });

  // Chóp đỉnh vòm.
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe600 }),
  );
  finial.position.set(cageX, barTopY + cageCfg.domeHeight + 0.02, cageZ);
  cageGroup.add(finial);

  // Đế tròn + 2 vòng neon hồng/tím ở chân lồng (như ảnh mẫu).
  const cageBase = new THREE.Mesh(
    new THREE.CylinderGeometry(cageR + 0.2, cageR + 0.35, 0.1, 48),
    new THREE.MeshLambertMaterial({ color: cageCfg.baseColor }),
  );
  cageBase.position.set(cageX, 0.05, cageZ);
  cageGroup.add(cageBase);
  cageCfg.neonColors.forEach((colorHex, i) => {
    const neonRing = new THREE.Mesh(
      new THREE.TorusGeometry(cageR + 0.22, 0.035, 6, 64),
      new THREE.MeshBasicMaterial({ color: colorHex }),
    );
    neonRing.rotation.x = Math.PI / 2;
    neonRing.position.set(cageX, 0.12 + i * 0.04, cageZ);
    cageGroup.add(neonRing);
  });

  // ---- CỘT MÚA ở đúng tâm lồng (lệnh 02:20) ----
  // 1 cột kim loại mảnh + đế nhỏ, không thêm đèn/shadow.
  const poleCfg = CONFIG.scene.pole;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(poleCfg.radius, poleCfg.radius, poleCfg.height, 10),
    new THREE.MeshPhongMaterial({
      color: poleCfg.color, specular: 0xffffff, shininess: 90,
    }),
  );
  pole.position.set(cageX, poleCfg.height / 2, cageZ);
  cageGroup.add(pole);
  const poleBase = new THREE.Mesh(
    new THREE.CylinderGeometry(poleCfg.baseRadius, poleCfg.baseRadius + 0.04, poleCfg.baseHeight, 20),
    new THREE.MeshLambertMaterial({ color: cageCfg.baseColor }),
  );
  poleBase.position.set(cageX, poleCfg.baseHeight / 2, cageZ);
  cageGroup.add(poleBase);

  // ---- Quả cầu disco treo TRÊN CAO phía trên lồng ----
  // Lệnh 02:20: dời lên khỏi lồng nhỏ (đỉnh vòm ~3.9m, đáy cầu ~4.9m).
  // Bán kính/tốc độ quay giữ ở CONFIG.discoBall; vị trí theo tâm lồng.
  // Thanh treo kéo dài từ đỉnh cầu lên giàn đèn trên cao (~6.5m).
  const discoBallMat = new THREE.MeshLambertMaterial({
    color: 0xd9d9e8,
    emissive: 0x555577,
    emissiveIntensity: 0.45,
  });
  const discoBall = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.discoBall.radius, CONFIG.discoBall.segments, CONFIG.discoBall.segments),
    discoBallMat,
  );
  discoBall.position.set(cageX, cageCfg.ballY, cageZ);
  scene.add(discoBall);
  const rodTopY = 6.5;
  const rodLen = rodTopY - (cageCfg.ballY + CONFIG.discoBall.radius);
  const ballRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, rodLen, 5),
    new THREE.MeshBasicMaterial({ color: 0x888899 }),
  );
  ballRod.position.set(
    cageX,
    cageCfg.ballY + CONFIG.discoBall.radius + rodLen / 2 - 0.05,
    cageZ,
  );
  scene.add(ballRod);

  // ---- Laser tím/hồng/cyan: 6 chóp nón additive, lắc theo beat + thời gian ----
  // Chóp nón: đỉnh ở nguồn sáng trên cao, loe ra ở sàn. Không thêm đèn thật.
  const laserCfg = CONFIG.scene.lasers;
  const laserGeo = new THREE.ConeGeometry(0.5, 1, 10, 1, true);
  laserGeo.translate(0, -0.5, 0); // đỉnh ở gốc, thân hướng -Y
  const laserMats = laserCfg.colors.map((colorHex) => new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: laserCfg.baseOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const laserDefs = [
    { source: [-5.6, 6.6, -2.2], target: [-0.8, 0, 1.6], phase: 0.0 },
    { source: [-5.6, 6.6, 1.8], target: [1.2, 0, 0.8], phase: 1.1 },
    { source: [5.6, 6.6, -2.2], target: [0.8, 0, 1.6], phase: 2.2 },
    { source: [5.6, 6.6, 1.8], target: [-1.2, 0, 0.8], phase: 3.3 },
    { source: [-2.8, 7.0, -4.6], target: [1.8, 0, -0.6], phase: 4.4 },
    { source: [2.8, 7.0, -4.6], target: [-1.8, 0, -0.6], phase: 5.5 },
  ];
  const lasers = laserDefs.map((def, i) => {
    const mesh = new THREE.Mesh(laserGeo, laserMats[i % laserMats.length]);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return {
      mesh,
      source: new THREE.Vector3(...def.source),
      baseTarget: new THREE.Vector3(...def.target),
      phase: def.phase,
    };
  });
  const laserDown = new THREE.Vector3(0, -1, 0);
  const laserDir = new THREE.Vector3();

  // ---- DJ booth (trái) ----
  const djGroup = new THREE.Group();
  djGroup.position.set(...CONFIG.stage.djPosition);
  const booth = new THREE.Mesh(
    new THREE.BoxGeometry(...CONFIG.stage.djBoothSize),
    new THREE.MeshLambertMaterial({ color: 0x1c1030 }),
  );
  booth.position.y = CONFIG.stage.djBoothSize[1] / 2;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.12, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
  );
  deck.position.y = CONFIG.stage.djBoothSize[1] + 0.06;
  const djFigure = makeSimpleFigure(0xffe600, 0xffd9b3);
  djFigure.position.y = CONFIG.stage.djBoothSize[1];
  // Viền neon hồng mặt trước booth.
  const boothStrip = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.stage.djBoothSize[0] - 0.4, 0.06, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
  );
  boothStrip.position.set(0, CONFIG.stage.djBoothSize[1] - 0.15, CONFIG.stage.djBoothSize[2] / 2 + 0.03);
  djGroup.add(booth, deck, djFigure, boothStrip);
  scene.add(djGroup);

  // ---- Bàn DJ sau lưng (giữa, phía sau lồng): top donor đứng chơi DJ ở đây ----
  // GIỮ NGUYÊN vị trí + chỗ đứng (CONFIG.djTable.spotPosition) — chỉ restyle
  // tối + viền neon hồng cho hợp tông phòng mới.
  const djTableCfg = CONFIG.djTable;
  const djTableGroup = new THREE.Group();
  djTableGroup.position.set(...djTableCfg.position);
  const tableW = djTableCfg.size[0];
  const tableH = djTableCfg.size[1];
  const tableD = djTableCfg.size[2];
  const tableBody = new THREE.Mesh(
    new THREE.BoxGeometry(tableW, tableH, tableD),
    new THREE.MeshLambertMaterial({ color: djTableCfg.tableColor }),
  );
  tableBody.position.y = tableH / 2;
  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(tableW + 0.15, 0.08, tableD + 0.15),
    new THREE.MeshLambertMaterial({ color: djTableCfg.topColor }),
  );
  tableTop.position.y = tableH + 0.04;
  const tableEdge = new THREE.Mesh(
    new THREE.BoxGeometry(tableW + 0.16, 0.06, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
  );
  tableEdge.position.set(0, tableH + 0.02, tableD / 2 + 0.08);
  // Dải neon hồng mặt trước bàn.
  const tableStrip = new THREE.Mesh(
    new THREE.BoxGeometry(tableW + 0.16, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xff5fd0 }),
  );
  tableStrip.position.set(0, tableH * 0.5, tableD / 2 + 0.08);
  djTableGroup.add(tableBody, tableTop, tableEdge, tableStrip);
  // 2 mâm đĩa quay (trục dọc): mặt đĩa tối + nhãn sáng ở giữa.
  const platterGeo = new THREE.CylinderGeometry(djTableCfg.platterRadius, djTableCfg.platterRadius, 0.05, 20);
  const platterMat = new THREE.MeshLambertMaterial({ color: 0x0c0c12 });
  const platterLabelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12);
  const platterLabelMatA = new THREE.MeshBasicMaterial({ color: CONFIG.lights.discoColorA });
  const platterLabelMatB = new THREE.MeshBasicMaterial({ color: CONFIG.lights.discoColorB });
  const platters = [];
  [-0.62, 0.62].forEach((x, i) => {
    const platter = new THREE.Mesh(platterGeo, platterMat);
    platter.position.set(x, tableH + 0.1, 0);
    const label = new THREE.Mesh(platterLabelGeo, i === 0 ? platterLabelMatA : platterLabelMatB);
    label.position.y = 0.01;
    platter.add(label);
    djTableGroup.add(platter);
    platters.push(platter);
  });
  // Mixer ở giữa + 4 nút nhỏ đổi màu.
  const mixer = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x2a2a33 }),
  );
  mixer.position.set(0, tableH + 0.13, 0);
  djTableGroup.add(mixer);
  const buttonGeo = new THREE.BoxGeometry(0.08, 0.04, 0.08);
  CONFIG.floor.beatColors.slice(0, 4).forEach((colorHex, i) => {
    const btn = new THREE.Mesh(
      buttonGeo,
      new THREE.MeshBasicMaterial({ color: colorHex }),
    );
    btn.position.set(-0.15 + (i % 2) * 0.3, tableH + 0.2, -0.15 + Math.floor(i / 2) * 0.3);
    djTableGroup.add(btn);
  });
  // 2 loa nhỏ 2 bên bàn.
  const speakerGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
  const speakerMat = new THREE.MeshLambertMaterial({ color: 0x11111c });
  [-1.65, 1.65].forEach((x) => {
    const speaker = new THREE.Mesh(speakerGeo, speakerMat);
    speaker.position.set(x, 0.4, 0);
    djTableGroup.add(speaker);
  });
  scene.add(djTableGroup);

  // ---- Khu VIP / bục (phải) ----
  const vipGroup = new THREE.Group();
  vipGroup.position.set(...CONFIG.stage.vipPosition);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(...CONFIG.stage.vipPlatformSize),
    new THREE.MeshLambertMaterial({ color: CONFIG.stage.vipPlatformColor }),
  );
  platform.position.y = CONFIG.stage.vipPlatformSize[1] / 2;
  vipGroup.add(platform);
  const vipSign = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.35, 0.08),
    new THREE.MeshBasicMaterial({ color: CONFIG.floor.beatColors[2] }),
  );
  vipSign.position.set(0, 2.3, -0.9);
  vipGroup.add(vipSign);
  // Cột + dây khu VIP (4 cột góc).
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6);
  const postMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
  const halfW = CONFIG.stage.vipPlatformSize[0] / 2;
  const halfD = CONFIG.stage.vipPlatformSize[2] / 2;
  [[-halfW, -halfD], [halfW, -halfD], [-halfW, halfD], [halfW, halfD]].forEach(([x, z]) => {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 0.45, z);
    vipGroup.add(post);
  });
  scene.add(vipGroup);

  // Chùm sáng VIP (nón trong suốt) — ẩn mặc định.
  const vipBeam = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 5, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: CONFIG.lights.vipSpotColor,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  vipBeam.position.set(CONFIG.stage.vipPosition[0], 2.8, CONFIG.stage.vipPosition[2]);
  vipBeam.visible = false;
  scene.add(vipBeam);

  // ---- Quầy bar phía sau + chai lọ + dải neon ----
  const barGroup = new THREE.Group();
  barGroup.position.set(...CONFIG.stage.barPosition);
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(...CONFIG.stage.barSize),
    new THREE.MeshLambertMaterial({ color: 0x241335 }),
  );
  counter.position.y = CONFIG.stage.barSize[1] / 2;
  barGroup.add(counter);
  const bottleGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6);
  const bottleCount = 9;
  for (let i = 0; i < bottleCount; i += 1) {
    const bottle = new THREE.Mesh(
      bottleGeo,
      new THREE.MeshBasicMaterial({
        color: CONFIG.floor.beatColors[i % CONFIG.floor.beatColors.length],
      }),
    );
    bottle.position.set(
      (i - (bottleCount - 1) / 2) * 1.1,
      CONFIG.stage.barSize[1] + 0.25,
      0,
    );
    barGroup.add(bottle);
  }
  const neon = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.stage.barSize[0], 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: CONFIG.floor.beatColors[0] }),
  );
  neon.position.set(0, 2.2, 0.3);
  barGroup.add(neon);
  scene.add(barGroup);

  // ---- TƯỜNG LED sau lưng: họa tiết hình học tím/hồng, vẽ lại ≤ ~8fps ----
  // Cùng mặt phẳng/vị trí với tường tối cũ (không dời), chỉ thay vật liệu
  // bằng CanvasTexture tự vẽ. Không vẽ mỗi frame (rẻ cho máy yếu).
  const ledCfg = CONFIG.scene.ledWall;
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = ledCfg.canvasWidth;
  ledCanvas.height = ledCfg.canvasHeight;
  const ledCtx = ledCanvas.getContext('2d');
  const ledTexture = new THREE.CanvasTexture(ledCanvas);
  ledTexture.colorSpace = THREE.SRGBColorSpace;
  const ledPalette = ['#ff2e88', '#00e5ff', '#7c4dff', '#ff5fd0'];
  let ledPhase = 0;
  let ledTimer = 0;
  function drawLedWall() {
    const W = ledCanvas.width;
    const H = ledCanvas.height;
    const grad = ledCtx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0b0620');
    grad.addColorStop(1, '#190a38');
    ledCtx.fillStyle = grad;
    ledCtx.fillRect(0, 0, W, H);
    // Vệt sáng dọc (ánh đèn sân khấu dội lên tường).
    for (let s = 0; s < 4; s += 1) {
      const sx = 40 + s * 140 + Math.sin(ledPhase * 0.7 + s) * 18;
      const streak = ledCtx.createLinearGradient(sx, 0, sx + 46, 0);
      streak.addColorStop(0, 'rgba(124,77,255,0)');
      streak.addColorStop(0.5, `rgba(255,46,136,${0.10 + beatFlash * 0.10})`);
      streak.addColorStop(1, 'rgba(124,77,255,0)');
      ledCtx.fillStyle = streak;
      ledCtx.fillRect(sx, 0, 46, H);
    }
    // Lưới hình thoi (diamond) tím/hồng/cyan, sáng theo pha + beat.
    ledCtx.lineWidth = 3;
    for (let gy = 0; gy < 4; gy += 1) {
      for (let gx = 0; gx < 8; gx += 1) {
        const cx = 32 + gx * 64;
        const cy = 32 + gy * 64;
        const size = 22;
        const twinkle = 0.35 + 0.4 * Math.abs(Math.sin(ledPhase + gx * 0.7 + gy * 1.3));
        ledCtx.strokeStyle = ledPalette[(gx + gy) % ledPalette.length];
        ledCtx.globalAlpha = Math.min(1, twinkle + beatFlash * 0.3);
        ledCtx.beginPath();
        ledCtx.moveTo(cx, cy - size);
        ledCtx.lineTo(cx + size, cy);
        ledCtx.lineTo(cx, cy + size);
        ledCtx.lineTo(cx - size, cy);
        ledCtx.closePath();
        ledCtx.stroke();
      }
    }
    // Hình thoi lớn ở giữa (điểm nhấn như ảnh mẫu).
    ledCtx.globalAlpha = 0.85;
    ledCtx.strokeStyle = '#ff5fd0';
    ledCtx.lineWidth = 5;
    ledCtx.beginPath();
    ledCtx.moveTo(W / 2, 28);
    ledCtx.lineTo(W / 2 + 90, H / 2);
    ledCtx.lineTo(W / 2, H - 28);
    ledCtx.lineTo(W / 2 - 90, H / 2);
    ledCtx.closePath();
    ledCtx.stroke();
    ledCtx.globalAlpha = 0.5;
    ledCtx.lineWidth = 2;
    ledCtx.beginPath();
    ledCtx.moveTo(W / 2, 58);
    ledCtx.lineTo(W / 2 + 58, H / 2);
    ledCtx.lineTo(W / 2, H - 58);
    ledCtx.lineTo(W / 2 - 58, H / 2);
    ledCtx.closePath();
    ledCtx.stroke();
    ledCtx.globalAlpha = 1;
    ledTexture.needsUpdate = true;
  }
  drawLedWall();
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 8),
    new THREE.MeshBasicMaterial({ map: ledTexture }),
  );
  wall.position.set(...CONFIG.stage.wallPosition);
  scene.add(wall);

  // ---- Ghế sofa VIP 2 bên (như ảnh mẫu): da đen + bàn tròn + chai/nến ----
  // Low-poly, vật liệu/geometry dùng chung 2 bên, không thêm đèn.
  const sofaMat = new THREE.MeshLambertMaterial({ color: 0x0d0d16 });
  const sofaTableMat = new THREE.MeshLambertMaterial({ color: 0x1a1026 });
  const sofaMetalMat = new THREE.MeshLambertMaterial({ color: 0x22222e });
  const sofaBaseGeo = new THREE.BoxGeometry(2.9, 0.55, 1.05);
  const sofaBackGeo = new THREE.BoxGeometry(2.9, 0.8, 0.26);
  const sofaArmGeo = new THREE.BoxGeometry(0.3, 0.55, 1.05);
  const tableTopGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 18);
  const tableLegGeo = new THREE.CylinderGeometry(0.07, 0.14, 0.7, 8);
  const vipBottleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.32, 6);
  const candleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.14, 6);
  const bottleMatA = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
  const bottleMatB = new THREE.MeshBasicMaterial({ color: 0x33ff88 });
  const candleMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  function makeVipLounge() {
    const group = new THREE.Group();
    const base = new THREE.Mesh(sofaBaseGeo, sofaMat);
    base.position.y = 0.28;
    const back = new THREE.Mesh(sofaBackGeo, sofaMat);
    back.position.set(0, 0.9, -0.42);
    group.add(base, back);
    [-1.3, 1.3].forEach((x) => {
      const arm = new THREE.Mesh(sofaArmGeo, sofaMat);
      arm.position.set(x, 0.6, 0);
      group.add(arm);
    });
    // Bàn tròn nhỏ trước ghế + 2 chai + 1 nến.
    const tableTop = new THREE.Mesh(tableTopGeo, sofaTableMat);
    tableTop.position.set(0.6, 0.72, 1.15);
    const tableLeg = new THREE.Mesh(tableLegGeo, sofaMetalMat);
    tableLeg.position.set(0.6, 0.36, 1.15);
    const bottleA = new THREE.Mesh(vipBottleGeo, bottleMatA);
    bottleA.position.set(0.42, 0.91, 1.05);
    const bottleB = new THREE.Mesh(vipBottleGeo, bottleMatB);
    bottleB.position.set(0.78, 0.91, 1.22);
    const candle = new THREE.Mesh(candleGeo, candleMat);
    candle.position.set(0.6, 0.82, 1.32);
    group.add(tableTop, tableLeg, bottleA, bottleB, candle);
    return group;
  }
  const loungeLeft = makeVipLounge();
  loungeLeft.position.set(-7.5, 0, -0.4);
  loungeLeft.rotation.y = 1.25;
  scene.add(loungeLeft);
  const loungeRight = makeVipLounge();
  loungeRight.position.set(7.5, 0, -0.4);
  loungeRight.rotation.y = -1.25;
  scene.add(loungeRight);

  // ---- Pháo hoa particle: POOL tái dùng (không tạo geometry/material
  // mới mỗi lần nổ — rẻ cho máy yếu). Hết pool thì tái dùng entry cũ nhất.
  const burstPool = [];
  const burstPoolSize = CONFIG.gifts.fireworksPoolSize || 4;
  for (let i = 0; i < burstPoolSize; i += 1) {
    const count = CONFIG.gifts.fireworksCount;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.13,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;
    scene.add(points);
    burstPool.push({
      points,
      velocities: new Float32Array(count * 3),
      life: 0,
      active: false,
    });
  }
  let burstCursor = 0;

  function spawnFireworks(position, colorHex) {
    const count = CONFIG.gifts.fireworksCount;
    let entry = burstPool.find((b) => !b.active);
    if (!entry) {
      entry = burstPool[burstCursor % burstPool.length];
      burstCursor += 1;
    }
    const pos = entry.points.geometry.attributes.position;
    for (let i = 0; i < count; i += 1) {
      pos.array[i * 3] = position.x;
      pos.array[i * 3 + 1] = position.y;
      pos.array[i * 3 + 2] = position.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = CONFIG.gifts.fireworksSpread * (0.4 + Math.random() * 0.6);
      entry.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      entry.velocities[i * 3 + 1] = Math.cos(phi) * speed;
      entry.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    pos.needsUpdate = true;
    entry.points.material.color.setHex(colorHex);
    entry.points.material.opacity = 1;
    entry.points.visible = true;
    entry.life = 0;
    entry.active = true;
  }

  // Vòng sáng gift nhỏ (ít, tạo/xóa theo lượt — khác pool pháo hoa).
  const rings = [];

  function spawnRing(position) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 24),
      new THREE.MeshBasicMaterial({
        color: CONFIG.floor.beatColors[1],
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.05, position.z);
    scene.add(ring);
    rings.push({ mesh: ring, life: 0 });
  }

  function pulseBeat(beatIndex) {
    const palette = CONFIG.floor.beatColors;
    const color = palette[beatIndex % palette.length];
    for (let i = 0; i < CONFIG.floor.beatLitTiles; i += 1) {
      const tile = tiles[Math.floor(Math.random() * tiles.length)];
      tile.material.color.setHex(color);
      tile.userData.glowUntil = clockState.time + CONFIG.floor.beatGlowSeconds;
    }
    rim.material.color.setHex(color);
    // Nhịp đập: quả cầu disco lấp lánh + laser/vệt sàn sáng lên, mờ dần
    // trong update() (không thêm đèn).
    beatFlash = 1;
  }

  function setVipSpotlight(on) {
    vipSpot.intensity = on ? CONFIG.lights.vipSpotIntensity : 0;
    vipBeam.visible = on;
  }

  function update(dt, time) {
    clockState.time = time;
    // Nhịp đập mờ dần sau mỗi beat.
    beatFlash = Math.max(0, beatFlash - dt * 3);
    // Đèn disco quay quanh sàn.
    const angle = time * CONFIG.lights.discoOrbitSpeed;
    discoLightA.position.set(
      Math.cos(angle) * CONFIG.lights.discoOrbitRadius,
      CONFIG.lights.discoOrbitHeight,
      Math.sin(angle) * 2,
    );
    discoLightB.position.set(
      Math.cos(angle + Math.PI) * CONFIG.lights.discoOrbitRadius,
      CONFIG.lights.discoOrbitHeight,
      Math.sin(angle + Math.PI) * 2,
    );
    // Quả cầu disco trong lồng: quay + lấp lánh theo beat.
    discoBall.rotation.y += dt * CONFIG.discoBall.spinSpeed;
    discoBallMat.emissiveIntensity = 0.45 + beatFlash * 1.1;
    // Laser: đầu tia lắc theo thời gian, sáng theo beat.
    lasers.forEach((laser, i) => {
      const target = laser.baseTarget;
      const tx = target.x + Math.sin(time * 0.5 + laser.phase) * 1.2;
      const tz = target.z + Math.cos(time * 0.4 + laser.phase) * 0.8;
      laserDir.set(tx - laser.source.x, -laser.source.y, tz - laser.source.z);
      const len = laserDir.length();
      laserDir.normalize();
      laser.mesh.position.copy(laser.source);
      laser.mesh.quaternion.setFromUnitVectors(laserDown, laserDir);
      laser.mesh.scale.set(1, len, 1);
      laserMats[i % laserMats.length].opacity = laserCfg.baseOpacity
        + beatFlash * laserCfg.beatOpacityBoost;
    });
    // Vệt phản chiếu sàn sáng theo beat.
    blobMats.forEach(({ mat, baseOpacity }) => {
      mat.opacity = baseOpacity + beatFlash * 0.08;
    });
    // Tường LED vẽ lại chậm (≤ ~8fps), họa tiết trôi theo pha + beat.
    ledTimer += dt;
    if (ledTimer >= ledCfg.updateSeconds) {
      ledTimer = 0;
      ledPhase += 0.35;
      drawLedWall();
    }
    // DJ gật theo nhịp (đơn giản, rẻ).
    djFigure.position.y = CONFIG.stage.djBoothSize[1] + Math.abs(Math.sin(time * 2.2)) * 0.06;
    // Mâm đĩa ở bàn DJ sau lưng quay ngược chiều nhau.
    const spin = dt * (CONFIG.djTable.platterSpinSpeed || 6);
    if (platters[0]) platters[0].rotation.y += spin;
    if (platters[1]) platters[1].rotation.y -= spin;

    // Ô sàn hết sáng thì trả về màu gốc.
    tiles.forEach((tile) => {
      if (tile.userData.glowUntil && time > tile.userData.glowUntil) {
        tile.material.color.setHex(tile.userData.baseColor);
        tile.userData.glowUntil = 0;
      }
    });

    // Pháo hoa (pool tái dùng): bay + rơi + mờ dần, hết thì trả về pool.
    for (const burst of burstPool) {
      if (!burst.active) continue;
      burst.life += dt;
      const pos = burst.points.geometry.attributes.position;
      const gravity = CONFIG.gifts.fireworksSpread / CONFIG.gifts.fireworksLifeSeconds;
      const total = burst.velocities.length / 3;
      for (let j = 0; j < total; j += 1) {
        burst.velocities[j * 3 + 1] -= gravity * dt;
        pos.array[j * 3] += burst.velocities[j * 3] * dt;
        pos.array[j * 3 + 1] += burst.velocities[j * 3 + 1] * dt;
        pos.array[j * 3 + 2] += burst.velocities[j * 3 + 2] * dt;
      }
      pos.needsUpdate = true;
      burst.points.material.opacity = Math.max(
        0,
        1 - burst.life / CONFIG.gifts.fireworksLifeSeconds,
      );
      if (burst.life >= CONFIG.gifts.fireworksLifeSeconds) {
        burst.active = false;
        burst.points.visible = false;
      }
    }

    // Vòng sáng gift nhỏ: nở ra + mờ dần.
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const ring = rings[i];
      ring.life += dt;
      const s = 1 + ring.life * 2.2;
      ring.mesh.scale.set(s, s, s);
      ring.mesh.material.opacity = Math.max(
        0,
        0.9 * (1 - ring.life / CONFIG.gifts.smallRingDurationSeconds),
      );
      if (ring.life >= CONFIG.gifts.smallRingDurationSeconds) {
        scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        rings.splice(i, 1);
      }
    }
  }

  return {
    scene,
    floorWidth,
    floorDepth,
    pulseBeat,
    setVipSpotlight,
    spawnFireworks,
    spawnRing,
    update,
  };
}

// Figure tối giản dùng chung cho DJ (dancer đầy đủ nằm ở js/dancers.js).
function makeSimpleFigure(bodyColor, skinColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.2, 0.5, 8),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.55;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshLambertMaterial({ color: skinColor }),
  );
  head.position.y = 0.98;
  group.add(body, head);
  return group;
}
