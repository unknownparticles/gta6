import * as T from 'three';

const cells = 240;
const palette = [
  0xb7a38b, 0xd1b89e, 0xabb0ad, 0xb48d78, 0xc8beb3, 0xd5c8ae, 0x9eaaa6, 0x9a857a, 0xc4a89b,
  0xb7bbb4, 0xd4c0aa,
];
const landmarks = [
  ['pavilion', '小公园中山纪念亭', '532956287', [-2815, -1426]],
  ['square', '人民广场', '527201447', [-1861, -1072]],
  ['north-ferry', '广场轮渡站', '527264674', [-1612, -947]],
  ['south-ferry', '礐石轮渡站', '528328082', [-2533, 336]],
  ['queshi', '礐石大桥', '583148030', [-3786, 32]],
  ['bay-bridge', '海湾大桥', '583148033', [5096, 925]],
  ['diving', '濠江跳水馆', '534229497', [-22, 1960]],
  ['mountain', '礐石山', '527201452', [-2200, 1290]],
  ['east', '东海岸大道', null, [6025, -1070]],
];

const key = (x, z) => Math.floor(x / cells) + ':' + Math.floor(z / cells);
const pairs = (coords) =>
  Array.from({ length: coords.length / 2 }, (_, i) => [coords[2 * i], coords[2 * i + 1]]);
const color = new T.Color();
const driveColor = 0x59616a;
const pathColor = 0xa19788;
const waterColor = 0x477c8e;

function contains(x, z, shell) {
  let inside = false;
  for (let a = 0, b = shell.length - 1; a < shell.length; b = a++) {
    const [ax, az] = shell[a];
    const [bx, bz] = shell[b];
    if (az > z !== bz > z && x < ax + ((bx - ax) * (z - az)) / (bz - az)) inside = !inside;
  }
  return inside;
}

function projection(x, z, { ax, az, dx, dz, length }) {
  const fraction = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (length * length)));
  return [fraction, Math.hypot(x - ax - dx * fraction, z - az - dz * fraction)];
}

function put(index, object, x1, z1, x2, z2) {
  for (let ix = Math.floor(x1 / cells); ix <= Math.floor(x2 / cells); ix++) {
    for (let iz = Math.floor(z1 / cells); iz <= Math.floor(z2 / cells); iz++) {
      const id = ix + ':' + iz;
      if (!index.has(id)) index.set(id, []);
      index.get(id).push(object);
    }
  }
}

function roof(rings, height, shade, addTriangle) {
  const [outer, ...inner] = rings;
  const outline = outer.map(([x, z]) => new T.Vector2(x, z));
  const holes = inner.map((ring) => ring.map(([x, z]) => new T.Vector2(x, z)));
  const vertices = [...outline, ...holes.flat()].map(({ x, y }) => [x, height, y]);
  for (const [a, b, c] of T.ShapeUtils.triangulateShape(outline, holes)) {
    addTriangle(vertices[c], vertices[b], vertices[a], shade);
  }
}

export function createRealCity(scene, data, elevation) {
  const roads = [];
  const roadIndex = new Map();
  const buildingIndex = new Map();
  const land = data.land.map((part) => part.map(pairs));
  const places = landmarks.map(([id, name, source, fallback]) => ({
    id,
    name,
    point: data.places[source] || fallback,
  }));
  const buffers = new Map();
  const drawGroups = [];
  const material = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  const overlay = (units) =>
    new T.MeshLambertMaterial({
      vertexColors: true,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: units,
    });
  const layers = {
    elevation: overlay(-1),
    green: overlay(-2),
    road: overlay(-3),
    marking: overlay(-6),
  };
  const [x1, z1, x2, z2] = data.bounds;
  const globe = new T.Group();
  scene.add(globe);
  const { heights, step, cols, rows } = elevation;

  function terrain(x, z) {
    const u = T.MathUtils.clamp((x - x1) / step, 0, cols - 1.001);
    const v = T.MathUtils.clamp((z - z1) / step, 0, rows - 1.001);
    const i = Math.floor(u);
    const j = Math.floor(v);
    const id = j * cols + i;
    const fx = u - i;
    const fz = v - j;
    const nw = heights[id];
    const se = heights[id + cols + 1];
    return fx >= fz
      ? nw + (heights[id + 1] - nw) * (fx - fz) + (se - nw) * fz
      : nw + (heights[id + cols] - nw) * (fz - fx) + (se - nw) * fx;
  }

  const bucket = (x, z, layer = '') => {
    const id = key(x, z) + layer;
    if (!buffers.has(id)) buffers.set(id, { position: [], colors: [], layer });
    return buffers.get(id);
  };

  function triangle(target, a, b, c, shade) {
    target.position.push(...a, ...b, ...c);
    color.setHex(shade);
    for (let i = 0; i < 3; i++) target.colors.push(color.r, color.g, color.b);
  }
  function quad(target, a, b, c, d, shade) {
    triangle(target, a, b, c, shade);
    triangle(target, a, c, d, shade);
  }

  const sea = new T.Mesh(
    new T.PlaneGeometry(x2 - x1 + 17000, z2 - z1 + 17000),
    new T.MeshPhongMaterial({ color: waterColor, shininess: 25, specular: 0x638492 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((x1 + x2) / 2, -1.4, (z1 + z2) / 2);
  globe.add(sea);

  const ground = bucket(0, 0, 'ground');
  for (const rings of land) {
    roof(rings, 0, 0xb3ac95, (a, b, c, shade) => triangle(ground, a, b, c, shade));
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i];
        const [bx, bz] = ring[(i + 1) % ring.length];
        quad(ground, [ax, 0, az], [bx, 0, bz], [bx, -1.5, bz], [ax, -1.5, az], 0x827e71);
      }
    }
  }
  for (const pond of data.ponds) {
    roof([pairs(pond)], 0.025, waterColor, (a, b, c, shade) => triangle(ground, a, b, c, shade));
  }
  for (const [wood, coords] of data.green) {
    const outline = pairs(coords);
    const [x, z] = outline[0];
    roof([outline], 0.03, wood ? 0x788b65 : 0x8c9b72, (a, b, c, shade) => {
      // Large hillside polygons keep the terrain mesh's existing green shading.
      if ([a, b, c].every(([px, , pz]) => terrain(px, pz) < 0.05)) {
        triangle(bucket(x, z, 'green'), a, b, c, shade);
      }
    });
  }
  const trees = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 1),
    new T.MeshLambertMaterial({ color: 0x627e56 }),
    data.trees.length,
  );
  const tree = new T.Object3D();
  data.trees.forEach(([x, z], index) => {
    const radius = 1.7 + (index % 4) * 0.25;
    tree.position.set(x, terrain(x, z) + 3.5, z);
    tree.scale.set(radius, radius * 1.45, radius);
    tree.updateMatrix();
    trees.setMatrixAt(index, tree.matrix);
  });
  globe.add(trees);

  function isLand(x, z) {
    return land.some(
      ([outer, ...holes]) => contains(x, z, outer) && !holes.some((hole) => contains(x, z, hole)),
    );
  }

  const grassShade = new T.Color(0x6a805b);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const id = j * cols + i;
      const h = [heights[id], heights[id + 1], heights[id + cols + 1], heights[id + cols]];
      const max = Math.max(...h);
      if (!max) continue;
      const x = x1 + i * step;
      const z = z1 + j * step;
      const points = [
        [x, z],
        [x + step, z],
        [x + step, z + step],
        [x, z + step],
      ];
      if (!points.every(([px, pz]) => isLand(px, pz))) continue;
      const positions = points.map(([px, pz], index) => [px, h[index] + 0.004, pz]);
      const shade = color
        .setHex(0xb3ac95)
        .lerp(grassShade, Math.min(1, max / 58))
        .getHex();
      quad(bucket(x, z, 'elevation'), ...positions, shade);
    }
  }

  const bridgeShapes = [];
  for (const [width, flags, coords] of data.roads) {
    const path = pairs(coords);
    const bridge = Boolean(flags & 1);
    const foot = Boolean(flags & 2);
    const highway = width >= 8 && !foot;
    for (let index = 1; index < path.length; index++) {
      const [ax, az] = path[index - 1];
      const [bx, bz] = path[index];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      if (length < 0.15) continue;
      const segment = { ax, az, bx, bz, dx, dz, length, width, bridge, foot };
      roads.push(segment);
      const padding = width / 2 + 1.5;
      put(
        roadIndex,
        segment,
        Math.min(ax, bx) - padding,
        Math.min(az, bz) - padding,
        Math.max(ax, bx) + padding,
        Math.max(az, bz) + padding,
      );

      const west =
        Math.max(Math.abs(ax + 3786), Math.abs(bx + 3786)) < 205 &&
        Math.min(az, bz) > -700 &&
        Math.max(az, bz) < 1250;
      const east =
        Math.min(ax, bx) > 4330 &&
        Math.max(ax, bx) < 5860 &&
        Math.min(az, bz) > -95 &&
        Math.max(az, bz) < 2400;
      const rise = (x, z) => {
        if (!bridge) return terrain(x, z);
        if (west)
          return (
            35 * T.MathUtils.smoothstep(z, -570, -210) * (1 - T.MathUtils.smoothstep(z, 285, 1150))
          );
        if (east)
          return (
            37 * T.MathUtils.smoothstep(z, -40, 530) * (1 - T.MathUtils.smoothstep(z, 1440, 2220))
          );
        return terrain(x, z) + 0.18;
      };
      segment.rise = rise;
      const n = Math.max(1, Math.ceil(length / 16));
      const cross = [((-dz / length) * width) / 2, ((dx / length) * width) / 2];
      for (let i = 0; i < n; i++) {
        const x = ax + (dx * i) / n;
        const z = az + (dz * i) / n;
        const ex = ax + (dx * (i + 1)) / n;
        const ez = az + (dz * (i + 1)) / n;
        const y = rise(x, z) + (highway ? 0.12 : foot ? 0.065 : 0.085);
        const ey = rise(ex, ez) + (highway ? 0.12 : foot ? 0.065 : 0.085);
        const group = bucket(x, z, bridge ? '' : 'road');
        const [u, v] = cross;
        const edge = (x, y, z, side) => {
          const px = x + u * side;
          const pz = z + v * side;
          return [px, bridge ? y : Math.max(y, terrain(px, pz) + 0.07), pz];
        };
        quad(
          group,
          edge(x, y, z, 1),
          edge(ex, ey, ez, 1),
          edge(ex, ey, ez, -1),
          edge(x, y, z, -1),
          foot ? pathColor : driveColor,
        );
        if (highway) {
          const marked = Math.min(0.36, 2.6 / (length / n));
          const px = x + (ex - x) * marked;
          const pz = z + (ez - z) * marked;
          const py = y + (ey - y) * marked;
          quad(
            bucket(x, z, 'marking'),
            [x + u * 0.018, y + 0.012, z + v * 0.018],
            [px + u * 0.018, py + 0.012, pz + v * 0.018],
            [px - u * 0.018, py + 0.012, pz - v * 0.018],
            [x - u * 0.018, y + 0.012, z - v * 0.018],
            0xe2d2a8,
          );
        }
        if (bridge) {
          for (const side of [-1, 1]) {
            quad(
              group,
              [x + side * u, y - 0.6, z + side * v],
              [ex + side * u, ey - 0.6, ez + side * v],
              [ex + side * u, ey + 0.68, ez + side * v],
              [x + side * u, y + 0.68, z + side * v],
              0x949ba0,
            );
          }
        }
      }
      if (bridge && highway && (east || west) && length > 60) bridgeShapes.push(segment);
    }
  }

  for (const [height, paletteIndex, coords] of data.buildings) {
    const polygon = pairs(coords);
    const xs = polygon.map(([x]) => x);
    const zs = polygon.map(([, z]) => z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const base = terrain(centerX, centerZ);
    const roofHeight = base + height;
    put(buildingIndex, polygon, minX - 1.5, minZ - 1.5, maxX + 1.5, maxZ + 1.5);
    const group = bucket(centerX, centerZ);
    const face = palette[paletteIndex];
    roof([polygon], roofHeight, paletteIndex % 3 ? 0x827b73 : 0x9b8b7c, (a, b, c, shade) =>
      triangle(group, a, b, c, shade),
    );
    const oldTown = centerX > -3300 && centerX < -2100 && centerZ > -1780 && centerZ < -1020;
    const direction = T.ShapeUtils.isClockWise(polygon.map(([x, z]) => new T.Vector2(x, z)))
      ? 1
      : -1;
    for (let i = 0; i < polygon.length; i++) {
      const [ax, az] = polygon[i];
      const [bx, bz] = polygon[(i + 1) % polygon.length];
      quad(
        group,
        [ax, Math.min(base, terrain(ax, az)), az],
        [bx, Math.min(base, terrain(bx, bz)), bz],
        [bx, roofHeight, bz],
        [ax, roofHeight, az],
        face,
      );
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 4 || (!oldTown && i % 2 !== 0)) continue;
      const detail = bucket(centerX, centerZ, 'detail');
      // Offset glass slightly from the wall and vary the window rhythm by facade length.
      const ox = (direction * (az - bz) * 0.045) / length;
      const oz = (direction * (bx - ax) * 0.045) / length;
      const columns = Math.min(14, Math.max(1, Math.floor(length / (oldTown ? 2.6 : 4.2))));
      const levels = Math.min(14, Math.floor(height / 3.05));
      if (oldTown) {
        for (const top of [3.0, height - 0.3]) {
          quad(
            detail,
            [ax + ox * 2, base + top, az + oz * 2],
            [bx + ox * 2, base + top, bz + oz * 2],
            [bx + ox * 2, base + top + 0.15, bz + oz * 2],
            [ax + ox * 2, base + top + 0.15, az + oz * 2],
            0xe5cbae,
          );
        }
      }
      for (let col = 0; col < columns; col++) {
        const start = (col + 0.24) / columns;
        const end = (col + 0.75) / columns;
        const a = ax + (bx - ax) * start + ox;
        const b = ax + (bx - ax) * end + ox;
        const p = az + (bz - az) * start + oz;
        const q = az + (bz - az) * end + oz;
        for (let floor = 0; floor < levels; floor++) {
          const low = base + 0.65 + floor * 3.05;
          const high = low + (oldTown && floor === 0 ? 1.95 : 1.42);
          quad(
            detail,
            [a, low, p],
            [b, low, q],
            [b, high, q],
            [a, high, p],
            floor === 0 && oldTown ? 0x665044 : 0x51616b,
          );
        }
      }
    }
  }

  for (const group of buffers.values()) {
    if (group.position.length === 0) continue;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(group.position, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(group.colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, layers[group.layer] || material);
    globe.add(mesh);
    if (group.layer === 'detail') drawGroups.push(mesh);
  }
  makePavilion(globe, places[0].point, terrain(...places[0].point));
  addBridgeTowers(globe, bridgeShapes);

  function roadAt(x, z, elevatedOnly = false) {
    let closest;
    let best = Infinity;
    for (const road of roadIndex.get(key(x, z)) || []) {
      if (elevatedOnly && !road.bridge) continue;
      const [, gap] = projection(x, z, road);
      if (gap > road.width / 2 + 0.6 || gap >= best) continue;
      closest = road;
      best = gap;
    }
    return closest;
  }

  function clear(x, z, radius = 0.45) {
    if (x < x1 + 2 || x > x2 - 2 || z < z1 + 2 || z > z2 - 2) return false;
    if (!roadAt(x, z, true) && !isLand(x, z)) return false;
    if (Math.hypot(x - places[0].point[0], z - places[0].point[1]) < 4.5 + radius) return false;
    for (const polygon of buildingIndex.get(key(x, z)) || []) {
      if (contains(x, z, polygon)) return false;
      for (let i = 0; i < polygon.length; i++) {
        const [ax, az] = polygon[i];
        const [bx, bz] = polygon[(i + 1) % polygon.length];
        const dx = bx - ax;
        const dz = bz - az;
        const length = Math.hypot(dx, dz);
        if (length > 0 && projection(x, z, { ax, az, dx, dz, length })[1] < radius) return false;
      }
    }
    return true;
  }

  function spawn(point, radius = 0.45) {
    for (let range = 8; range < 195; range += 5) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const x = point[0] + Math.sin(angle) * range;
        const z = point[1] + Math.cos(angle) * range;
        if (clear(x, z, radius) && roadAt(x, z)) return [x, z];
      }
    }
    if (clear(...point, radius)) return point;
    for (const road of roads) {
      if (clear(road.ax, road.az, radius)) return [road.ax, road.az];
    }
    throw new Error('地图缺少可通行地点');
  }

  return {
    clear,
    spawn,
    places,
    land,
    roads,
    bounds: data.bounds,
    buildings: data.buildings.length,
    roadAngle(x, z) {
      const road = roadAt(x, z);
      return road ? Math.atan2(-road.dx, -road.dz) : 0;
    },
    nearbyRoads(x, z, radius) {
      const result = new Set();
      for (
        let ix = Math.floor((x - radius) / cells);
        ix <= Math.floor((x + radius) / cells);
        ix++
      ) {
        for (
          let iz = Math.floor((z - radius) / cells);
          iz <= Math.floor((z + radius) / cells);
          iz++
        ) {
          for (const road of roadIndex.get(ix + ':' + iz) || []) result.add(road);
        }
      }
      return result;
    },
    height(x, z) {
      return Math.max(terrain(x, z), roadAt(x, z, true)?.rise(x, z) || 0);
    },
    detail(x, z, low) {
      const limit = low ? 210 : 420;
      for (const mesh of drawGroups) {
        const { center, radius } = mesh.geometry.boundingSphere;
        mesh.visible =
          Math.abs(center.x - x) < limit + radius && Math.abs(center.z - z) < limit + radius;
      }
    },
  };
}

function makePavilion(scene, [x, z], base) {
  const pavilion = new T.Group();
  pavilion.position.set(x, base, z);
  const mesh = (geometry, shade, y) => {
    const object = new T.Mesh(geometry, new T.MeshLambertMaterial({ color: shade }));
    object.position.y = y;
    pavilion.add(object);
    return object;
  };
  mesh(new T.CylinderGeometry(4.5, 4.65, 0.42, 8), 0xb8a88b, 0.21);
  mesh(new T.CylinderGeometry(4, 4.35, 0.25, 8), 0xd8c5a6, 0.53);
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * i) / 4;
    const pillar = mesh(new T.CylinderGeometry(0.22, 0.27, 3.8, 8), 0x9f5240, 2.5);
    pillar.position.set(Math.cos(angle) * 3.18, 2.5, Math.sin(angle) * 3.18);
  }
  mesh(new T.CylinderGeometry(2.42, 4.9, 1.12, 8), 0x48616b, 4.85);
  mesh(new T.CylinderGeometry(0.65, 3.02, 1.5, 8), 0x526d73, 5.82);
  mesh(new T.CylinderGeometry(4.85, 4.98, 0.13, 8), 0xab8054, 4.34);
  mesh(new T.CylinderGeometry(2.96, 3.08, 0.12, 8), 0x9e754e, 5.1);
  mesh(new T.SphereGeometry(0.32, 8, 6), 0xbda46d, 6.75);
  scene.add(pavilion);
}

function addBridgeTowers(scene, bridgeShapes) {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const stone = new T.MeshLambertMaterial({ color: 0xb9b4aa });
  const cable = new T.MeshLambertMaterial({ color: 0xb3b1a5 });
  const across = new T.Vector3();
  const up = new T.Vector3(0, 1, 0);
  const cableGeometry = new T.CylinderGeometry(0.16, 0.16, 1, 6);
  function stay(a, b) {
    across.subVectors(b, a);
    const obj = new T.Mesh(cableGeometry, cable);
    obj.position.copy(a).addScaledVector(across, 0.5);
    obj.scale.y = across.length();
    obj.quaternion.setFromUnitVectors(up, across.normalize());
    scene.add(obj);
  }
  for (const [targetX, towers, fan] of [
    [-3786, [-85, 203], true],
    [5096, [720, 1240], false],
  ]) {
    const pairs = [];
    for (const z of towers) {
      const matches = bridgeShapes.filter(
        (road) =>
          Math.abs(road.ax - targetX) < 650 &&
          z >= Math.min(road.az, road.bz) &&
          z <= Math.max(road.az, road.bz),
      );
      if (!matches.length) continue;
      const x =
        matches.reduce(
          (sum, road) =>
            sum + road.ax + ((road.bx - road.ax) * (z - road.az)) / (road.bz - road.az),
          0,
        ) / matches.length;
      const deck = matches[0].rise(x, z);
      const top = deck + (fan ? 48 : 60);
      pairs.push({ x, z, top, deck });
      for (const side of [-1, 1]) {
        const px = x + side * 15;
        const pier = new T.Mesh(geometry, stone);
        pier.scale.set(3.8, top + 2, 5);
        pier.position.set(px, (top - 2) / 2, z);
        scene.add(pier);
        if (fan) {
          for (const direction of [-1, 1]) {
            for (let i = 1; i < 6; i++) {
              const anchor = z + direction * i * 21;
              stay(
                new T.Vector3(px, top - 4 - i * 2.5, z),
                new T.Vector3(px, matches[0].rise(px, anchor) + 0.8, anchor),
              );
            }
          }
        }
      }
      const lintel = new T.Mesh(geometry, stone);
      lintel.scale.set(31, 3.5, 4);
      lintel.position.set(x, top - 11, z);
      scene.add(lintel);
    }
    if (!fan && pairs.length === 2) {
      const [a, b] = pairs;
      for (const side of [-1, 1]) {
        const point = (t) =>
          new T.Vector3(
            T.MathUtils.lerp(a.x, b.x, t) + side * 11,
            T.MathUtils.lerp(a.top, b.top, t) - 4 - 42 * (4 * t * (1 - t)),
            T.MathUtils.lerp(a.z, b.z, t),
          );
        for (let i = 0; i < 16; i++) {
          const at = i / 16;
          const p = point(at);
          stay(p, point((i + 1) / 16));
          if (i > 0 && i % 2 === 0) {
            const atDeck = T.MathUtils.lerp(a.deck, b.deck, at);
            stay(p, new T.Vector3(p.x, atDeck + 0.9, p.z));
          }
        }
      }
    }
  }
}
