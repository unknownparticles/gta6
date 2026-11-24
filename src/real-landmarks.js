import * as T from 'three';

const up = new T.Vector3(0, 1, 0);

function solids(parent) {
  const batches = new Map();
  const tint = new T.Color();
  const dummy = new T.Object3D();
  const axis = new T.Vector3();
  const cube = new T.BoxGeometry(1, 1, 1);
  const tube = new T.CylinderGeometry(0.5, 0.5, 1, 7);
  const concrete = new T.MeshStandardMaterial({ roughness: 0.83 });
  const metal = new T.MeshStandardMaterial({ roughness: 0.46, metalness: 0.35 });
  function add(geometry, material, color) {
    dummy.updateMatrix();
    const key = geometry.uuid + material.uuid;
    if (!batches.has(key)) batches.set(key, { geometry, material, items: [] });
    batches.get(key).items.push([dummy.matrix.clone(), color]);
  }
  function box(x, y, z, w, h, d, color, yaw = 0) {
    dummy.position.set(x, y, z);
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, yaw, 0);
    add(cube, concrete, color);
  }
  function rod(a, b, width, color) {
    axis.subVectors(b, a);
    dummy.position.copy(a).addScaledVector(axis, 0.5);
    dummy.scale.set(width, axis.length(), width);
    dummy.quaternion.setFromUnitVectors(up, axis.normalize());
    add(tube, metal, color);
  }
  function finish() {
    for (const { geometry, material, items } of batches.values()) {
      const mesh = new T.InstancedMesh(geometry, material, items.length);
      items.forEach(([matrix, color], i) => {
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, tint.setHex(color));
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
  return { box, rod, finish };
}

function namePlate(group, text, width, x, y, z, heading) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#4e2920';
  context.fillRect(0, 0, 768, 128);
  context.lineWidth = 4;
  context.strokeStyle = '#e0b98a';
  context.strokeRect(9, 9, 750, 110);
  context.fillStyle = '#ffe1ab';
  context.font = 'bold 66px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 384, 68, 714);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const sign = new T.Mesh(new T.PlaneGeometry(width, width / 6), new T.MeshBasicMaterial({ map }));
  sign.position.set(x, y, z);
  sign.rotation.y = heading;
  group.add(sign);
}

function tower(group, point, ground) {
  const [x, z] = point;
  group.position.set(x, ground, z);
  const { box, rod, finish } = solids(group);
  const levels = [
    [0, 11],
    [27, 9],
    [58, 6.6],
    [95, 4.5],
    [127, 3.1],
    [153, 2.5],
    [176, 1.8],
  ];
  const vertex = (i, [y, radius]) => {
    const angle = (i * Math.PI) / 3;
    return new T.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
  };
  box(0, 0.63, 0, 23, 1.26, 23, 0x9b9c9d);
  for (let i = 0; i < 6; i++) {
    for (let level = 1; level < levels.length; level++) {
      const lower = levels[level - 1];
      const upper = levels[level];
      const color = level % 2 ? 0xb6bec3 : 0xe6e7e4;
      rod(vertex(i, lower), vertex(i, upper), 1.08 - level * 0.11, color);
      rod(vertex(i, lower), vertex(i + 1, upper), 0.35, color);
      rod(vertex(i + 1, lower), vertex(i, upper), 0.35, color);
      rod(vertex(i, upper), vertex(i + 1, upper), 0.47, color);
    }
    const angle = (i * Math.PI) / 3;
    rod(
      vertex(i, levels[3]),
      new T.Vector3(Math.cos(angle) * 8, 137, Math.sin(angle) * 8),
      0.57,
      0xdce1de,
    );
  }
  for (let y = 175; y < 212; y += 5) {
    rod(
      new T.Vector3(0, y, 0),
      new T.Vector3(0, Math.min(212, y + 5), 0),
      Math.max(0.38, 1.35 - (y - 175) * 0.022),
      y % 2 ? 0xb64139 : 0xe5ded5,
    );
  }
  const pod = new T.Mesh(
    new T.SphereGeometry(8.7, 24, 12),
    new T.MeshStandardMaterial({ color: 0x526c7b, metalness: 0.52, roughness: 0.24 }),
  );
  pod.scale.y = 0.64;
  pod.position.y = 137;
  group.add(pod);
  const band = new T.Mesh(
    new T.CylinderGeometry(8.72, 8.72, 0.67, 24),
    new T.MeshStandardMaterial({ color: 0xdfe4dc, roughness: 0.53 }),
  );
  band.position.y = 137;
  group.add(band);
  finish();
}

function heritage(group, point, ground, rings, materials, height, postOffice) {
  const [x, z] = point;
  const outline = rings[0].map(([px, pz]) => new T.Vector2(px - x, pz - z));
  group.position.set(x, ground, z);
  const floors = postOffice ? 3 : 7;
  const style = postOffice ? 0xb59a78 : 0xe4bb83;
  const facade = materials.historic.clone();
  facade.vertexColors = false;
  facade.color.setHex(style);
  const storefront = materials.shop.clone();
  storefront.vertexColors = false;
  storefront.color.setHex(style);
  const { box, finish } = solids(group);

  function levelWall(a, b, y, top, material, repeats) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute([a.x, y, a.y, b.x, y, b.y, b.x, top, b.y, a.x, top, a.y], 3),
    );
    geometry.setAttribute(
      'uv',
      new T.Float32BufferAttribute([0, 0, repeats, 0, repeats, 1, 0, 1], 2),
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const wallLevels = postOffice ? [0, 4, 7.8, 11.5] : [0, 4.3, 7.9, 11.45, 14.9, 18.25, 21.4, 24.3];
  const outward = T.ShapeUtils.isClockWise(outline) ? 1 : -1;
  let facing;
  let best = -Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const length = a.distanceTo(b);
    if (length < 0.1) continue;
    const angle = -Math.atan2(b.y - a.y, b.x - a.x);
    const midpoint = a.clone().lerp(b, 0.5);
    const direction = new T.Vector2(a.y - b.y, b.x - a.x).multiplyScalar(outward / length);
    const repeats = Math.max(1, Math.round(length / 2.5));
    for (let floor = 0; floor < floors; floor++) {
      const bottom = wallLevels[floor];
      const top = wallLevels[floor + 1];
      levelWall(a, b, bottom, top, floor === 0 ? storefront : facade, repeats);
      box(
        midpoint.x,
        top - 0.09,
        midpoint.y,
        length + 0.04,
        floor === floors - 1 ? 0.52 : 0.21,
        floor === floors - 1 ? 0.73 : 0.29,
        0xdbc6a7,
        angle,
      );
    }
    const score = (direction.x + (postOffice ? 0 : -direction.y * 0.6)) * Math.min(7, length);
    if (length > 5 && score > best) {
      best = score;
      facing = { midpoint, direction, length };
    }
  }
  const surface = new T.Shape(outline.map(({ x, y }) => new T.Vector2(x, -y)));
  const roof = new T.Mesh(
    new T.ShapeGeometry(surface),
    new T.MeshStandardMaterial({ color: 0x88827a, roughness: 0.91 }),
  );
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = height;
  roof.receiveShadow = true;
  group.add(roof);
  if (facing) {
    const { midpoint, direction, length } = facing;
    const x = midpoint.x + direction.x * 0.38;
    const z = midpoint.y + direction.y * 0.38;
    namePlate(
      group,
      postOffice ? '邮政总局旧址' : '南生百货',
      Math.min(length * 0.82, 7),
      x,
      3.58,
      z,
      Math.atan2(direction.x, direction.y),
    );
  }
  finish();
}

function museum(group, [x, z], ground, rings, height) {
  group.position.set(x, ground, z);
  const outline = rings[0].map(([px, pz]) => [px - x, pz - z]);
  const solid = solids(group);
  const stone = new T.MeshStandardMaterial({ color: 0xeadcc7, roughness: 0.8, side: T.DoubleSide });
  const glass = new T.MeshStandardMaterial({
    color: 0x597989,
    metalness: 0.34,
    roughness: 0.33,
    side: T.DoubleSide,
  });
  const faces = [
    [stone, []],
    [glass, []],
  ];
  const top = (px) => height - 7 + (0.5 + 0.5 * Math.sin(px * 0.078)) * 8;
  const vertex = ([x, z], y, scale = 1) => [x * scale, y, z * scale];
  function quad(list, a, b, c, d) {
    list.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
    for (let j = 0; j < steps; j++) {
      const start = j / steps;
      const end = (j + 1) / steps;
      const p = a.map((value, k) => T.MathUtils.lerp(value, b[k], start));
      const q = a.map((value, k) => T.MathUtils.lerp(value, b[k], end));
      quad(
        faces[0][1],
        vertex(p, 0, 0.92),
        vertex(q, 0, 0.92),
        vertex(q, 4, 0.92),
        vertex(p, 4, 0.92),
      );
      quad(
        faces[j % 4 === 0 ? 0 : 1][1],
        vertex(p, 4, 0.92),
        vertex(q, 4, 0.92),
        vertex(q, 13, 0.88),
        vertex(p, 13, 0.88),
      );
      quad(
        faces[0][1],
        vertex(p, 13, 0.88),
        vertex(q, 13, 0.88),
        vertex(q, top(q[0]), 1.06),
        vertex(p, top(p[0]), 1.06),
      );
    }
  }
  const points = outline.map(([x, z]) => new T.Vector2(x, z));
  for (const [a, b, c] of T.ShapeUtils.triangulateShape(points, [])) {
    for (const index of [c, b, a])
      faces[0][1].push(...vertex(outline[index], top(outline[index][0]), 1.06));
  }
  for (const [material, positions] of faces) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const north = outline.reduce((edge, point) => (point[1] < edge[1] ? point : edge));
  solid.box(north[0] * 0.7, 2, north[1] - 2.8, 19, 4, 2.1, 0x9f493b);
  solid.finish();
  namePlate(group, '潮汕历史文化博览中心', 17.5, north[0] * 0.7, 2.65, north[1] - 3.9, Math.PI);
}

export function addHeroLandmarks(scene, data, terrain, materials, addCollision) {
  for (const [id, type, height] of [
    ['582827032', 'tower', 212],
    ['532956292', 'store', 24.3],
    ['532956280', 'post', 11.5],
    ['1077683036', 'museum', 25],
  ]) {
    const point = data.places[id];
    const rings = data.heroes[id].map((ring) =>
      Array.from({ length: ring.length / 2 }, (_, index) => [ring[index * 2], ring[index * 2 + 1]]),
    );
    const floor = Math.min(...rings[0].map(([x, z]) => terrain(x, z)));
    const group = new T.Group();
    group.name = type;
    scene.add(group);
    if (type === 'tower') {
      tower(group, point, terrain(...point));
      addCollision(rings, floor, floor + 2);
    } else if (type === 'museum') {
      museum(group, point, floor, rings, height);
      addCollision(rings, floor, floor + height, false);
    } else {
      heritage(group, point, floor, rings, materials, height, type === 'post');
      addCollision(rings, floor, floor + height);
    }
  }
}

export const crossings = [
  {
    id: 'queshi',
    flag: 4,
    start: -670,
    end: 1250,
    deck: 39,
    plateau: [-280, 280],
    span: 518,
    middle: 25,
    tower: 148,
    roadWidth: 15,
    fan: true,
  },
  {
    id: 'bay-bridge',
    flag: 8,
    start: -99,
    end: 2450,
    deck: 38,
    plateau: [460, 1550],
    span: 452,
    middle: 980,
    tower: 112,
    roadWidth: 12,
    fan: false,
  },
];

export function addCrossings(scene, bridgeRoads) {
  for (const bridge of crossings) {
    const matching = bridgeRoads.filter((road) => road.crossing === bridge);
    const group = new T.Group();
    group.name = bridge.id + '-structure';
    scene.add(group);
    const { box, rod, finish } = solids(group);
    const concrete = bridge.fan ? 0xd4c9b5 : 0xd3d9d8;
    const cables = bridge.fan ? 0xe4dfcc : 0xb0bbc0;
    const crossSection = (z) => {
      const roads = matching.filter((r) => z >= Math.min(r.az, r.bz) && z <= Math.max(r.az, r.bz));
      if (!roads.length) return null;
      const sections = roads.map((road) => {
        const x = road.ax + (road.dx * (z - road.az)) / road.dz;
        return [x - road.width * 0.5, x + road.width * 0.5, road.rise(x, z)];
      });
      const left = Math.min(...sections.map((section) => section[0]));
      const right = Math.max(...sections.map((section) => section[1]));
      return [(left + right) / 2, sections[0][2], (right - left) / 2];
    };
    const half = (bridge.span * 0.5) / (bridge.fan ? 1.005 : 1.073);
    const towers = [bridge.middle - half, bridge.middle + half];
    const supports = [];
    for (const z of towers) {
      const cross = crossSection(z);
      if (!cross) continue;
      const [x, deck, width] = cross;
      const top = bridge.tower;
      supports.push({ x, z, deck, width, top });
      for (const side of [-1, 1]) {
        const pylon = x + side * (width + 3.4);
        const shoulder = x + side * (width + 2.4);
        box(pylon, deck * 0.5 - 1, z, 6.5, deck + 2.3, 10, concrete);
        if (bridge.fan) {
          rod(new T.Vector3(pylon, deck - 1, z), new T.Vector3(shoulder, top, z), 4.7, concrete);
        } else {
          box(shoulder, (deck + top) * 0.5, z, 5.5, top - deck, 6.8, concrete);
        }
        box(shoulder, top - 0.5, z, 6.2, 2.2, 8, concrete);
        if (!bridge.fan) continue;
        for (const direction of [-1, 1]) {
          for (let strand = 1; strand <= 11; strand++) {
            const spacing = direction === (z < bridge.middle ? 1 : -1) ? 21 : 14;
            const anchor = z + direction * (17 + spacing * strand);
            const section = crossSection(anchor);
            if (!section) continue;
            const [ax, ay, edge] = section;
            rod(
              new T.Vector3(shoulder, top - 9 - (11 - strand) * 3.05, z),
              new T.Vector3(ax + side * (edge - 0.42), ay + 1.0, anchor),
              0.78,
              cables,
            );
          }
        }
      }
      for (const y of [deck + 14, top - 18]) {
        box(x, y, z, width * 2 + 6, 3.8, 6.2, concrete);
      }
    }
    if (!bridge.fan && supports.length === 2) {
      const [a, b] = supports;
      for (const side of [-1, 1]) {
        function along(z, y, outside = 0) {
          const section = crossSection(z);
          return section && new T.Vector3(section[0] + side * (section[2] + outside), y, z);
        }
        const main = (t) => {
          const z = T.MathUtils.lerp(a.z, b.z, t);
          return along(z, bridge.tower - 1 - 54 * (4 * t * (1 - t)), 2.3);
        };
        for (let i = 0; i < 26; i++) {
          const t = i / 26;
          const point = main(t);
          const next = main((i + 1) / 26);
          if (point && next) rod(point, next, 1.15, cables);
          if (point && i > 0) {
            const edge = along(point.z, bridge.deck + 1.1, -0.42);
            if (edge) rod(edge, point, 0.46, cables);
          }
        }
        for (const [support, direction] of [
          [a, -1],
          [b, 1],
        ]) {
          let prior = main(support === a ? 0 : 1);
          for (let i = 1; i <= 11; i++) {
            const z = support.z + direction * i * 13;
            const section = crossSection(z);
            if (!section) break;
            const y = T.MathUtils.lerp(bridge.tower - 1, section[1] + 4, i / 11);
            const point = along(z, y, 2.3);
            if (point && prior) rod(prior, point, 0.84, cables);
            prior = point;
          }
        }
      }
    }
    for (let z = bridge.start + 32; z < bridge.end - 28; z += 85) {
      const section = crossSection(z);
      if (!section || (z > towers[0] - 35 && z < towers[1] + 35)) continue;
      const [x, deck, width] = section;
      if (deck < 4) continue;
      for (const side of [-1, 1]) {
        box(x + side * width * 0.48, deck * 0.5 - 1.55, z, 3.4, deck + 1.8, 5.8, concrete);
      }
      box(x, deck - 1.3, z, width * 1.68, 1.9, 6.2, concrete);
    }
    finish();
  }
}
