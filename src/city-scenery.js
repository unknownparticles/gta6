import * as T from 'three';
import {
  bridges,
  bridgeHeight,
  coastRoads,
  groundHeight,
  interiors,
  mountainHeight,
  northBank,
  northShore,
  southBank,
  southShore,
  wetlandPonds,
} from './city-layout.js';

export function addShantouScenery(scene, { box, batch, block, random }) {
  const signs = [];
  const segment = (a, b, width, depth, color, mode = 'solid') => {
    const delta = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = delta.length();
    const yaw = Math.atan2(delta.x, delta.z);
    const pitch = -Math.asin(delta.y / length);
    batch(
      'box',
      mode,
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
      width,
      depth,
      length + 0.08,
      color,
      yaw,
      pitch,
      0,
      'YXZ',
    );
  };

  function ground(vertices, color, height) {
    const outline = new T.Shape(vertices.map(([x, z]) => new T.Vector2(x, -z)));
    const mesh = new T.Mesh(
      new T.ShapeGeometry(outline),
      new T.MeshStandardMaterial({ color, roughness: 0.92 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = height;
    scene.add(mesh);
  }
  ground(northBank, 0x41384b, -0.012);
  ground(southBank, 0x474750, -0.012);
  box(18, -0.9, 81, 1000, 0.18, 980, 0x315776, 'road');
  for (let i = 0; i < 130; i++) {
    const x = -324 + random() * 695;
    const z = 184 + random() * 108;
    box(x, -0.803, z, 2 + random() * 11, 0.012, 0.12, i % 4 ? 0x617b97 : 0xda8e9d, 'glow');
  }
  for (const shore of [northShore, southShore]) {
    for (let i = 1; i < shore.length; i++) {
      const [a, b] = [shore[i - 1], shore[i]];
      segment([a[0], -0.34, a[1]], [b[0], -0.34, b[1]], 1.5, 1.15, 0x6d657f);
      const landSide = shore === northShore ? -1 : 1;
      segment(
        [a[0], 0.02, a[1] + landSide * 3],
        [b[0], 0.02, b[1] + landSide * 3],
        4.4,
        0.08,
        0xa28488,
      );
    }
  }

  for (const [[ax, az], [bx, bz]] of coastRoads) {
    const height = ax === -78 && az === 298 ? 0.038 : 0.029;
    segment([ax, height, az], [bx, height, bz], 12, 0.065, 0x302c40, 'road');
    const length = Math.hypot(bx - ax, bz - az);
    for (let offset = 5; offset < length - 3; offset += 8) {
      const t = offset / length;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const across = ax !== bx;
      if (across && [-78, 149, 275].some((column) => Math.abs(x - column) < 7)) continue;
      box(x, height + 0.043, z, across ? 2.8 : 0.14, 0.02, across ? 0.14 : 2.8, 0xe3ab88, 'glow');
    }
  }

  for (const bridge of bridges) {
    const { x, start, end, width, style } = bridge;
    const cable = style === 'cable';
    const supportColor = cable ? 0xb48391 : 0xb6abbc;
    for (let a = start; a < end;) {
      const b = Math.min(a + 3, end);
      const y1 = bridgeHeight(bridge, a);
      const y2 = bridgeHeight(bridge, b);
      segment([x, y1 - 0.24, a], [x, y2 - 0.24, b], width, 0.53, 0x50415e, 'road');
      for (const side of [-1, 1]) {
        const rail = x + side * (width / 2 - 0.23);
        segment([rail, y1 + 0.75, a], [rail, y2 + 0.75, b], 0.35, 0.42, supportColor);
        if (a < end - 4 && a > start + 5) block(rail, (a + b) / 2, 0.3, b - a);
      }
      if (Math.floor((a - start) / 3) % 2 === 0) {
        segment([x, y1 + 0.06, a], [x, y2 + 0.06, b], 0.17, 0.02, 0xf7c68c, 'glow');
      }
      a = b;
    }
    for (const z of [start + 55, end - 55]) {
      const deck = bridgeHeight(bridge, z);
      const towerHeight = cable ? 18 : 22;
      for (const side of [-1, 1]) {
        const px = x + side * (width / 2 + 0.9);
        box(px, (deck + towerHeight - 1.2) / 2, z, 1.75, deck + towerHeight + 1.2, 2.2, supportColor);
        box(px, deck + towerHeight, z, 2.1, 0.32, 2.4, 0xf5a0ab, 'glow');
        if (cable) {
          for (const direction of [-1, 1])
            for (const run of [7, 15, 22]) {
              const anchor = z + direction * run;
              segment(
                [px, deck + towerHeight - 1.4, z],
                [x + side * (width / 2 - 0.23), bridgeHeight(bridge, anchor) + 0.65, anchor],
                0.16,
                0.16,
                0xc8b2a7,
              );
            }
        }
      }
      box(x, deck + towerHeight - 3, z, width + 2.5, 1.3, 1.15, supportColor);
    }
    if (!cable) {
      const cableAt = (z) => {
        const a = start + 55;
        const b = end - 55;
        if (z < a) return 1 + (z - start) * 0.58;
        if (z > b) return 1 + (end - z) * 0.58;
        return bridge.deck + 5 + 16 * ((z - (a + b) / 2) / ((b - a) / 2)) ** 2;
      };
      for (const side of [-1, 1]) {
        const px = x + side * (width / 2 + 0.65);
        for (let z = start; z < end; z += 5) {
          const stop = Math.min(z + 5, end);
          segment([px, cableAt(z), z], [px, cableAt(stop), stop], 0.24, 0.24, 0xdeb3b9);
          if (z > start + 10 && z < end - 10) {
            segment([px, bridgeHeight(bridge, z) + 0.45, z], [px, cableAt(z), z], 0.09, 0.09, 0xac879e);
          }
        }
      }
    }
    signs.push([bridge.name, x, 3.5, start + 1, Math.PI, cable ? '#ffbbbe' : '#cecbff']);
  }

  for (const [x, z, w, d] of wetlandPonds) {
    box(x, 0.023, z, w, 0.04, d, 0x416671, 'road');
    for (const side of [-1, 1]) {
      box(x, 0.11, z + (side * d) / 2, w + 1.1, 0.24, 0.8, 0x596b58);
      box(x + (side * w) / 2, 0.11, z, 0.8, 0.24, d, 0x596b58);
    }
  }
  for (let i = 0; i < 73; i++) {
    const x = -271 + random() * 76;
    const z = 51 + random() * 106;
    const h = 0.9 + random() * 2.1;
    if (
      !wetlandPonds.some(
        ([px, pz, w, d]) => Math.abs(x - px) < w / 2 + 1 && Math.abs(z - pz) < d / 2 + 1,
      )
    )
      continue;
    batch('cylinder', 'solid', x, h / 2, z, 0.45, h, 0.45, 0x566456, 0, 0.16, 0.15);
  }
  signs.push(['牛田洋湿地', -246, 2.5, 140, 0, '#c6e4a4']);

  box(42, 0.06, 153, 54, 0.12, 19, 0x927e88);
  for (let x = 17; x < 69; x += 7) {
    box(x, 0.127, 153, 0.18, 0.025, 18, 0xc7a5a5);
    for (const z of [145, 161]) {
      box(x, 0.43, z, 3.1, 0.52, 0.63, 0xc1a5a6);
    }
  }
  batch('cylinder', 'solid', 43, 0.32, 153, 9, 0.45, 7.5, 0xb5a1ad);
  batch('cylinder', 'road', 43, 0.57, 153, 8, 0.02, 6.5, 0x598497);
  batch('cylinder', 'solid', 43, 2.3, 153, 1.25, 3.65, 1.25, 0xc6aeb4);
  block(43, 153, 1.25, 1.25);
  signs.push(['人民广场', 42, 3.1, 159, Math.PI, '#ffe1a6']);

  const towerX = -44;
  const towerZ = 113;
  for (const [y, radius, h, color] of [
    [23, 2.2, 34, 0xbab0bd],
    [45.5, 9, 4.4, 0xeab5c6],
    [47.8, 10.4, 0.6, 0xef9cc3],
    [43.3, 8.5, 0.5, 0xd098bf],
    [54, 1.5, 10.5, 0xd8beca],
    [61.2, 0.42, 6, 0xdb9eac],
  ])
    batch('cylinder', y === 47.8 ? 'glow' : 'solid', towerX, y, towerZ, radius, h, radius, color);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(
      towerX + Math.sin(a) * 4.15,
      45.6,
      towerZ + Math.cos(a) * 4.15,
      1.3,
      1.25,
      0.38,
      0xffc1d8,
      'glow',
      a,
    );
  }
  box(towerX, 64.1, towerZ, 1.3, 0.6, 1.3, 0xff748e, 'glow');

  for (const z of [4, 27, 107, 122]) {
    const x = 299;
    box(x, 7 + (z % 3) * 4, z, 12, 14 + (z % 3) * 8, 12, 0x675e7f);
    block(x, z, 12, 12);
    for (let y = 3; y < 19; y += 3) box(x - 6.1, y, z, 0.18, 0.75, 8, 0xa1c4dc, 'glow');
  }
  for (let x = 218; x < 310; x += 9) box(x, 0.7, 146 - (x - 210) * 0.15, 0.3, 1.35, 0.3, 0x95b6c2);
  signs.push(['东海岸', 259, 3.7, 140, 0, '#a2f4e1']);

  const hill = new T.PlaneGeometry(90, 74, 34, 27);
  hill.rotateX(-Math.PI / 2);
  const hillColors = [];
  for (let i = 0; i < hill.attributes.position.count; i++) {
    const x = hill.attributes.position.getX(i) - 25;
    const z = hill.attributes.position.getZ(i) + 350;
    const h = mountainHeight(x, z);
    hill.attributes.position.setXYZ(i, x, h + 0.026, z);
    const color = new T.Color().lerpColors(
      new T.Color(0x676d68),
      new T.Color(0x495f59),
      Math.min(1, h / 10),
    );
    hillColors.push(color.r, color.g, color.b);
  }
  hill.setAttribute('color', new T.Float32BufferAttribute(hillColors, 3));
  hill.computeVertexNormals();
  scene.add(
    new T.Mesh(
      hill,
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    ),
  );
  const trail = [
    [-56, 313],
    [-48, 326],
    [-37, 335],
    [-18, 338],
    [-9, 344],
    [-14, 351],
    [-25, 351],
  ];
  for (let i = 1; i < trail.length; i++) {
    const [[x1, z1], [x2, z2]] = [trail[i - 1], trail[i]];
    const count = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 2);
    for (let j = 0; j < count; j++) {
      const point = (t) => {
        const x = x1 + (x2 - x1) * t;
        const z = z1 + (z2 - z1) * t;
        return [x, groundHeight(x, z) + 0.11, z];
      };
      segment(point(j / count), point((j + 1) / count), 2.2, 0.1, 0xb29c8b);
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = -63 + random() * 78;
    const z = 319 + random() * 65;
    const h = mountainHeight(x, z);
    if (h < 2 || h > 13 || trail.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 4)) continue;
    batch('cylinder', 'solid', x, h + 0.9, z, 0.65, 2.1, 0.65, 0x524d51);
    batch('sphere', 'solid', x, h + 2.6, z, 3.8, 3.8, 3.8, 0x55736b);
  }
  const pavilionY = mountainHeight(-25, 351);
  for (const x of [-27, -23])
    for (const z of [349, 353]) box(x, pavilionY + 1.2, z, 0.28, 2.4, 0.28, 0xe9b895);
  box(-25, pavilionY + 2.55, 351, 5.1, 0.4, 5.1, 0x9b5b66);
  box(-25, pavilionY + 2.85, 351, 3.6, 0.24, 3.6, 0xb08885);
  signs.push(['礐石山', -53, 2.7, 315, Math.PI, '#e8d9a7']);

  for (const room of interiors) {
    const { x, z, w, d, accent, door, front } = room;
    const height = room.id === 'diveHall' ? 6.8 : room.id === 'towerHall' ? 5.8 : 4.6;
    const wall = 0x696278;
    const entry = z + (front * d) / 2;
    const back = z - (front * d) / 2;
    const edge = (w - door) / 2;
    box(x, 0.021, z, w, 0.05, d, 0x8d757d);
    box(x, height + 0.12, z, w + 0.75, 0.25, d + 0.68, 0x463d60);
    box(x, height / 2, back, w, height, 0.46, wall);
    block(x, back, w, 0.46);
    for (const side of [-1, 1]) {
      box(x + (side * w) / 2, height / 2, z, 0.46, height, d, wall);
      block(x + (side * w) / 2, z, 0.46, d);
      box(x + side * (door / 2 + edge / 2), height / 2, entry, edge, height, 0.46, wall);
      block(x + side * (door / 2 + edge / 2), entry, edge, 0.46);
      box(x + side * (door / 2 + 0.2), 1.35, entry + front * 0.27, 0.13, 2.75, 0.16, accent, 'glow');
      box(x + side * (w / 2 - 1.6), 0.5, z - front, 1.7, 0.9, d * 0.38, 0x3d344e);
      block(x + side * (w / 2 - 1.6), z - front, 1.7, d * 0.38);
      box(x + side * (w / 2 - 1.6), 1.21, z - front, 1.4, 0.28, 1.2, accent, 'glow');
      box(
        x + side * (door / 2 + edge / 2),
        2.42,
        entry + front * 0.25,
        edge * 0.55,
        1.0,
        0.1,
        accent,
        'glow',
      );
    }
    box(x, (height + 2.8) / 2, entry, door, height - 2.8, 0.46, wall);
    box(x, 2.87, entry + front * 0.29, door, 0.16, 0.2, accent, 'glow');
    box(x, 0.059, z + front * 0.2, Math.min(3.5, door), 0.008, d * 0.83, 0xb28f94);
    box(x, 2.25, back + front * 0.25, Math.min(w - 3, 8), 1.35, 0.12, accent, 'glow');
    box(x, height - 0.21, z, w * 0.52, 0.07, 0.4, accent, 'glow');
    signs.push([
      room.name,
      x,
      height - 0.79,
      entry + front * 0.27,
      front === 1 ? 0 : Math.PI,
      '#ffe5ce',
    ]);
  }

  for (const [id, caption] of [
    ['towerHall', '荧塔流云 · 广播与城市'],
    ['squareHall', '一湾两岸 · 开埠记忆'],
    ['eastHall', '东海岸 · 海洋展览'],
    ['southHall', '礐石山 · 登山步道'],
    ['wetlandHall', '牛田洋 · 红树林与候鸟'],
    ['garageHall', '晚钟车库 · 维修接待'],
    ['hospitalHall', '急诊与出院登记'],
    ['diveHall', '濠江 · 游泳与跳水'],
  ]) {
    const room = interiors.find((place) => place.id === id);
    const back = room.z - room.front * (room.d / 2 - 0.38);
    signs.push([caption, room.x, 2.28, back, room.front === 1 ? 0 : Math.PI, '#fff0de']);
  }

  for (const side of [-1, 1]) {
    const x = -44 + side * 3.3;
    box(x, 0.58, 111, 2.1, 1.05, 1.2, 0x494366);
    box(x, 1.23, 110.83, 1.5, 0.68, 0.2, 0x9acfe7, 'glow');
    block(x, 111, 2.1, 1.2);
  }
  for (const x of [44.3, 51.7]) {
    box(x, 0.38, 112, 1.3, 0.7, 2.8, 0x675669);
    box(x, 1.08, 112, 0.75, 0.75, 1.0, 0xcc9889);
    block(x, 112, 1.3, 2.8);
  }
  box(271, 0.78, 88, 2.15, 1.5, 4.6, 0x487486, 'road');
  box(271, 1.6, 88, 2.12, 0.08, 4.6, 0xa6d6cc, 'glow');
  block(271, 88, 2.15, 4.6);
  return signs;
}
