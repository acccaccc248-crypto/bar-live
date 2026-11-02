// scene.js — cảnh bar NGANG 16:9: sàn lưới, đèn disco, DJ booth (trái),
// khu VIP/bục (phải), bàn DJ sau lưng (top donor đứng chơi DJ),
// quầy bar phía sau. Nhẹ cho máy yếu: vật liệu rẻ
// (Basic/Lambert), KHÔNG shadow map, ít đèn, hình khối primitive.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createBarScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.renderer.clearColor);
  scene.fog = new THREE.Fog(CONFIG.renderer.clearColor, 18, 34);

  const clockState = { time: 0 };

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

  // ---- Quả cầu disco + chùm tia ----
  const discoBall = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.discoBall.radius, CONFIG.discoBall.segments, CONFIG.discoBall.segments),
    new THREE.MeshLambertMaterial({ color: 0xd9d9e8, emissive: 0x555577 }),
  );
  discoBall.position.set(...CONFIG.discoBall.position);
  scene.add(discoBall);

  const beamMatA = new THREE.MeshBasicMaterial({
    color: CONFIG.lights.discoColorA,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const beamMatB = new THREE.MeshBasicMaterial({
    color: CONFIG.lights.discoColorB,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const beamGeo = new THREE.ConeGeometry(1.4, 5, 12, 1, true);
  const beamA = new THREE.Mesh(beamGeo, beamMatA);
  const beamB = new THREE.Mesh(beamGeo, beamMatB);
  beamA.position.set(0, 2.6, 0);
  beamB.position.set(0, 2.6, 0);
  scene.add(beamA, beamB);

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
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
  );
  deck.position.y = CONFIG.stage.djBoothSize[1] + 0.06;
  const djFigure = makeSimpleFigure(0xffe600, 0xffd9b3);
  djFigure.position.y = CONFIG.stage.djBoothSize[1];
  djGroup.add(booth, deck, djFigure);
  scene.add(djGroup);

  // ---- Bàn DJ sau lưng (giữa): top donor đứng chơi DJ ở đây ----
  // Bàn + 2 mâm đĩa quay + mixer + dải neon. Nhẹ: hình khối primitive,
  // vật liệu rẻ, mâm quay trong update() (không tạo object mới mỗi frame).
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
    new THREE.MeshBasicMaterial({ color: djTableCfg.edgeColor }),
  );
  tableEdge.position.set(0, tableH + 0.02, tableD / 2 + 0.08);
  djTableGroup.add(tableBody, tableTop, tableEdge);
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

  // Tường sau tối (đã dời ra sau để chừa chỗ cho bàn DJ).
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 8),
    new THREE.MeshBasicMaterial({ color: 0x0d0722 }),
  );
  wall.position.set(...CONFIG.stage.wallPosition);
  scene.add(wall);

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
  }

  function setVipSpotlight(on) {
    vipSpot.intensity = on ? CONFIG.lights.vipSpotIntensity : 0;
    vipBeam.visible = on;
  }

  function update(dt, time) {
    clockState.time = time;
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
    discoBall.rotation.y += dt * CONFIG.discoBall.spinSpeed;
    beamA.rotation.z = Math.sin(time * 0.8) * 0.5;
    beamB.rotation.z = Math.cos(time * 0.8) * 0.5;
    beamA.rotation.x = Math.cos(time * 0.6) * 0.3;
    beamB.rotation.x = Math.sin(time * 0.6) * 0.3;
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
