import * as T from 'three';
import { addCrossings, addHeroLandmarks, crossings } from './real-landmarks.js';
import { addStreetTrees } from './street-models.js';

const cells = 240;
const palette = [
  0xb7a38b, 0xd1b89e, 0xabb0ad, 0xb48d78, 0xc8beb3, 0xd5c8ae, 0x9eaaa6, 0x9a857a, 0xc4a89b,
  0xb7bbb4, 0xd4c0aa,
];
const arcadePalette = [
  0xd7b596, 0xd8c9b0, 0xc2ccbe, 0xc9957c, 0xddd1bb, 0xe1cfad, 0xc3cbd1, 0xbda996, 0xd5b1a5,
  0xccd2c0, 0xe6d6c1,
];
const landmarks = [
  ['pavilion', '小公园中山纪念亭', '532956287', [-2815, -1426]],
  ['department-store', '南生百货大楼', '532956292', [-2837, -1390]],
  ['post-office', '邮政总局旧址', '532956280', [-2797, -1180]],
  ['tv', '电视塔', '582827032', [-2407, -3708]],
  ['museum', '潮汕历史文化博览中心', '1077683036', [1440, 2308]],
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

function insideFootprint(x, z, [outer, ...holes]) {
  return contains(x, z, outer) && !holes.some((hole) => contains(x, z, hole));
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
  const triangles = T.ShapeUtils.triangulateShape(outline, holes);
  const vertices = [...outline, ...holes.flat()].map(({ x, y }) => [x, height, y]);
  for (const [a, b, c] of triangles) {
    addTriangle(vertices[c], vertices[b], vertices[a], shade);
  }
}

export function createRealCity(scene, data, elevation, materials, treeModel) {
  const roads = [];
  const roadIndex = new Map();
  const buildingIndex = new Map();
  const land = data.land.map((part) => part.map(pairs));
  const piers = data.piers.map((part) => part.map(pairs));
  const places = landmarks.map(([id, name, source, fallback]) => ({
    id,
    name,
    point: data.places[source] || fallback,
  }));
  const buffers = new Map();
  const arcades = [];
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
    if (!buffers.has(id)) buffers.set(id, { position: [], colors: [], uv: [], layer });
    return buffers.get(id);
  };

  function triangle(target, a, b, c, shade, uv) {
    target.position.push(...a, ...b, ...c);
    color.setHex(shade);
    for (let i = 0; i < 3; i++) target.colors.push(color.r, color.g, color.b);
    if (uv) target.uv.push(...uv.flat());
    else {
      const repeat = target.layer === 'road' || target.layer === 'bridge' ? 7 : 4.5;
      for (const [x, , z] of [a, b, c]) target.uv.push(x / repeat, z / repeat);
    }
  }
  function quad(target, a, b, c, d, shade, uv) {
    triangle(target, a, b, c, shade, uv && [uv[0], uv[1], uv[2]]);
    triangle(target, a, c, d, shade, uv && [uv[0], uv[2], uv[3]]);
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
    const outline = pairs(pond);
    roof([outline], 0.025, waterColor, (a, b, c, shade) =>
      triangle(bucket(...outline[0], 'waterFeature'), a, b, c, shade),
    );
  }
  function foundation(rings, top, color) {
    const deck = bucket(...rings[0][0], 'quay');
    roof(rings, top, color, (a, b, c, shade) => triangle(deck, a, b, c, shade));
    for (const ring of rings) {
      for (let index = 0; index < ring.length; index++) {
        const [ax, az] = ring[index];
        const [bx, bz] = ring[(index + 1) % ring.length];
        quad(deck, [ax, -1.7, az], [bx, -1.7, bz], [bx, top, bz], [ax, top, az], 0x817e75);
      }
    }
  }
  for (const pier of piers) foundation(pier, 0.11, 0xa7a39b);
  const [plazaX, plazaZ] = places[0].point;
  const plaza = Array.from({ length: 40 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 40;
    return [plazaX + Math.cos(angle) * 11.8, plazaZ + Math.sin(angle) * 11.8];
  });
  roof([plaza], 0.061, 0xc1b5a5, (a, b, c, shade) =>
    triangle(bucket(plazaX, plazaZ, 'quay'), a, b, c, shade),
  );
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
  addStreetTrees(globe, treeModel, data.trees, terrain);

  function isLand(x, z) {
    return land.some(
      ([outer, ...holes]) => contains(x, z, outer) && !holes.some((hole) => contains(x, z, hole)),
    );
  }
  function onPier(x, z) {
    return (pierIndex.get(key(x, z)) || []).some(
      ([outer, ...holes]) => contains(x, z, outer) && !holes.some((hole) => contains(x, z, hole)),
    );
  }
  const pierIndex = new Map();
  for (const pier of piers) {
    const xs = pier[0].map(([x]) => x);
    const zs = pier[0].map(([, z]) => z);
    put(pierIndex, pier, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
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
  for (const [baseWidth, flags, coords] of data.roads) {
    const path = pairs(coords);
    const bridge = Boolean(flags & 1);
    const foot = Boolean(flags & 2);
    const highway = baseWidth >= 8 && !foot;
    for (let index = 1; index < path.length; index++) {
      const [ax, az] = path[index - 1];
      const [bx, bz] = path[index];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      if (length < 0.15) continue;
      const crossing =
        Math.abs(dz) > 0.5 ? crossings.find(({ flag }) => (flags & flag) !== 0) : null;
      const width = crossing?.roadWidth ?? baseWidth;
      const segment = { ax, az, bx, bz, dx, dz, length, width, bridge, foot, crossing };
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

      const rise = (x, z) => {
        if (crossing) {
          const [flatStart, flatEnd] = crossing.plateau;
          const rise = T.MathUtils.smoothstep(z, crossing.start, flatStart);
          const fall = 1 - T.MathUtils.smoothstep(z, flatEnd, crossing.end);
          return Math.max(terrain(x, z), crossing.deck * rise * fall);
        }
        return terrain(x, z) + (bridge ? 0.18 : 0);
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
        const group = bucket(x, z, bridge ? 'bridge' : 'road');
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
      if (crossing) bridgeShapes.push(segment);
    }
  }

  for (const [height, paletteIndex, coordinates, offset, levels, waterfront] of data.buildings) {
    const rings = coordinates.map(pairs);
    const [outer] = rings;
    const xs = outer.map(([x]) => x);
    const zs = outer.map(([, z]) => z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const ground = Math.min(...outer.map(([x, z]) => terrain(x, z)));
    const base = (waterfront ? 0.13 : ground) + offset;
    const roofHeight = base + height - offset;
    const oldTown = centerX > -3300 && centerX < -2100 && centerZ > -1780 && centerZ < -1020;
    const face = (oldTown ? arcadePalette : palette)[paletteIndex];
    const volume = { rings, bottom: base, top: roofHeight };
    put(buildingIndex, volume, minX - 1.6, minZ - 1.6, maxX + 1.6, maxZ + 1.6);
    if (waterfront && !offset) foundation(rings, base, 0xa7a39b);
    const top = bucket(centerX, centerZ, 'concrete');
    roof(rings, roofHeight, paletteIndex % 3 ? 0x827b73 : 0x9b8b7c, (a, b, c, shade) =>
      triangle(top, a, b, c, shade),
    );
    const detailedArcade = oldTown && Math.hypot(centerX - plazaX, centerZ - plazaZ) < 145;
    const outward =
      detailedArcade && T.ShapeUtils.isClockWise(outer.map(([x, z]) => new T.Vector2(x, z)))
        ? 1
        : -1;
    const floors = Math.max(1, Math.min(80, levels));
    for (const [ringIndex, ring] of rings.entries()) {
      for (let index = 0; index < ring.length; index++) {
        const [ax, az] = ring[index];
        const [bx, bz] = ring[(index + 1) % ring.length];
        const length = Math.hypot(bx - ax, bz - az);
        if (length < 0.05) continue;
        const plain = length < 3.4 || height - offset < 4;
        const frontage = oldTown && ringIndex === 0 && length > 5 && floors > 1 && !offset;
        const facade = oldTown ? 'historic' : height - offset >= 27 ? 'modern' : 'residence';
        const bays = Math.max(1, Math.round(length / (oldTown ? 2.9 : 3.9)));
        const cap = Math.min(0.32, (roofHeight - base) * 0.08);
        const wall = (layer, lower, upper, u, v, tone) =>
          quad(
            bucket(centerX, centerZ, layer),
            [ax, lower, az],
            [bx, lower, bz],
            [bx, upper, bz],
            [ax, upper, az],
            tone,
            [
              [0, 0],
              [u, 0],
              [u, v],
              [0, v],
            ],
          );
        if (plain) {
          wall('concrete', base, roofHeight, length / 3, (roofHeight - base) / 3, face);
          continue;
        }
        const streetHeight = frontage
          ? Math.min(base + 3.6, base + (roofHeight - base) * 0.48)
          : base;
        if (frontage) wall('shop', base, streetHeight, bays, 1, face);
        wall(
          facade,
          streetHeight,
          roofHeight - cap,
          bays,
          Math.max(1, floors - Number(frontage)),
          face,
        );
        wall('concrete', roofHeight - cap, roofHeight, length / 3, cap / 3, 0xaa9e90);
        if (detailedArcade && frontage) {
          const ox = ((outward * (az - bz)) / length) * 0.24;
          const oz = ((outward * (bx - ax)) / length) * 0.24;
          const trim = bucket(centerX, centerZ, 'concrete');
          arcades.push({
            wall: [ax, az, bx, bz],
            normal: [ox / 0.24, oz / 0.24],
            base,
            top: streetHeight,
            bays,
            face,
          });
          for (const y of [streetHeight, roofHeight - 0.24]) {
            const a = [ax, y, az];
            const b = [bx, y, bz];
            const c = [bx + ox, y, bz + oz];
            const d = [ax + ox, y, az + oz];
            const bottomC = [c[0], y - 0.15, c[2]];
            const bottomD = [d[0], y - 0.15, d[2]];
            quad(trim, a, b, c, d, 0xd5c2a9);
            quad(trim, d, c, bottomC, bottomD, 0xb29b81);
            quad(trim, [ax, y - 0.15, az], bottomD, bottomC, [bx, y - 0.15, bz], 0xb9a58d);
          }
        }
      }
    }
  }

  for (const { wall, normal, base, top, bays, face } of arcades) {
    const [ax, az, bx, bz] = wall;
    const [nx, nz] = normal;
    const width = Math.hypot(bx - ax, bz - az) / bays;
    const depth = 1.32;
    const pick = (u, y, d) => [
      T.MathUtils.lerp(ax, bx, u) + nx * d,
      y,
      T.MathUtils.lerp(az, bz, u) + nz * d,
    ];
    for (let bay = 0; bay < bays; bay++) {
      const middle = pick((bay + 0.5) / bays, base, depth);
      if (
        !canStand(middle[0], middle[2]) ||
        blocked(middle[0], middle[2], base + 0.1, top, width * 0.39)
      )
        continue;
      const trim = bucket(middle[0], middle[2], 'concrete');
      const u0 = bay / bays;
      const u1 = (bay + 1) / bays;
      const column = Math.min(0.44, width * 0.22);
      const floor = base + 0.065;
      const crown = top - 0.14;
      const spring = Math.min(top - 0.8, base + 2.05);
      const arch = (t) => spring + (crown - spring) * Math.sin(Math.PI * t);
      quad(
        trim,
        pick(u0, top, 0),
        pick(u1, top, 0),
        pick(u1, top, depth),
        pick(u0, top, depth),
        face,
      );
      quad(
        trim,
        pick(u0, floor, 0),
        pick(u0, floor, depth),
        pick(u1, floor, depth),
        pick(u1, floor, 0),
        0xa38e7b,
      );
      for (let i = 0; i < 10; i++) {
        const t = i / 10;
        const t2 = (i + 1) / 10;
        const start = u0 + (t * (width - column) + column / 2) / (bays * width);
        const end = u0 + (t2 * (width - column) + column / 2) / (bays * width);
        const lower = pick(start, arch(t), depth);
        const upper = pick(end, arch(t2), depth);
        quad(trim, lower, upper, pick(end, top, depth), pick(start, top, depth), face);
        quad(
          trim,
          lower,
          pick(start, arch(t), depth - 0.23),
          pick(end, arch(t2), depth - 0.23),
          upper,
          0xb7a794,
        );
      }
      for (const [u, span] of [
        [u0, column / 2],
        [u1, column / 2],
      ]) {
        const inward = u === u0 ? span : -span;
        const end = u + inward / (bays * width);
        const back = depth - column;
        const points = [
          pick(u, floor, depth),
          pick(end, floor, depth),
          pick(end, floor, back),
          pick(u, floor, back),
        ];
        const cap = points.map(([x, , z]) => [x, top, z]);
        for (let i = 0; i < 4; i++) {
          const next = (i + 1) % 4;
          quad(trim, points[i], points[next], cap[next], cap[i], face);
        }
        const rings = [points.map(([x, , z]) => [x, z])];
        const xs = points.map(([x]) => x);
        const zs = points.map(([, , z]) => z);
        put(
          buildingIndex,
          { rings, bottom: floor, top },
          Math.min(...xs) - 1.6,
          Math.min(...zs) - 1.6,
          Math.max(...xs) + 1.6,
          Math.max(...zs) + 1.6,
        );
      }
    }
  }

  for (const group of buffers.values()) {
    if (group.position.length === 0) continue;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(group.position, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(group.colors, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(group.uv, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, materials[group.layer] || materials.solid);
    mesh.castShadow = ['concrete', 'shop', 'historic', 'modern', 'residence', 'bridge'].includes(
      group.layer,
    );
    mesh.receiveShadow = group.layer !== 'waterFeature';
    globe.add(mesh);
  }
  makePavilion(globe, places[0].point, terrain(...places[0].point));
  addCrossings(globe, bridgeShapes);
  addHeroLandmarks(globe, data, terrain, materials, (rings, bottom, top, landable = true) => {
    const xs = rings[0].map(([x]) => x);
    const zs = rings[0].map(([, z]) => z);
    put(
      buildingIndex,
      { rings, bottom, top, landable },
      Math.min(...xs) - 1.6,
      Math.min(...zs) - 1.6,
      Math.max(...xs) + 1.6,
      Math.max(...zs) + 1.6,
    );
  });

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

  function height(x, z) {
    return Math.max(terrain(x, z), roadAt(x, z, true)?.rise(x, z) || 0, onPier(x, z) ? 0.11 : 0);
  }

  function pavementHeight(x, z) {
    const road = roadAt(x, z);
    if (!road) return 0;
    return road.foot ? 0.065 : road.width >= 8 ? 0.12 : 0.085;
  }

  function blocked(x, z, bottom, top, radius = 0.45) {
    const dx = x - plazaX;
    const dz = z - plazaZ;
    const pavilion = terrain(plazaX, plazaZ);
    if (top > pavilion && bottom < pavilion + 6.8 && dx * dx + dz * dz < (4.5 + radius) ** 2)
      return true;
    for (const volume of buildingIndex.get(key(x, z)) || []) {
      if (bottom >= volume.top - 0.04 || top <= volume.bottom + 0.02) continue;
      if (insideFootprint(x, z, volume.rings)) return true;
      for (const ring of volume.rings) {
        for (let i = 0; i < ring.length; i++) {
          const [ax, az] = ring[i];
          const [bx, bz] = ring[(i + 1) % ring.length];
          const dx = bx - ax;
          const dz = bz - az;
          const length = Math.hypot(dx, dz);
          if (length > 0 && projection(x, z, { ax, az, dx, dz, length })[1] < radius) return true;
        }
      }
    }
    return false;
  }

  function canStand(x, z) {
    return (
      x >= x1 + 2 &&
      x <= x2 - 2 &&
      z >= z1 + 2 &&
      z <= z2 - 2 &&
      Boolean(roadAt(x, z, true) || isLand(x, z) || onPier(x, z))
    );
  }

  function support(x, z, ceiling = Infinity, onlyLandable = false) {
    let top = height(x, z);
    for (const volume of buildingIndex.get(key(x, z)) || []) {
      if (onlyLandable && volume.landable === false) continue;
      if (volume.top <= ceiling && volume.top > top && insideFootprint(x, z, volume.rings))
        top = volume.top;
    }
    return top;
  }

  function clear(x, z, radius = 0.45) {
    if (!canStand(x, z)) return false;
    const y = height(x, z);
    return !blocked(x, z, y + 0.08, y + 1.7, radius);
  }

  function landingAt(x, z, currentY) {
    const top = support(x, z, currentY, true);
    if (canStand(x, z) && !blocked(x, z, top + 0.08, top + 1.75)) return [x, top, z];
    for (let range = 2; range <= 24; range += 2) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        const px = x + Math.cos(angle) * range;
        const pz = z + Math.sin(angle) * range;
        const y = support(px, pz, currentY, true);
        if (canStand(px, pz) && !blocked(px, pz, y + 0.08, y + 1.75)) return [px, y, pz];
      }
    }
    return null;
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
    blocked,
    support,
    pavementHeight,
    canStand,
    landingAt,
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
    height,
  };
}

function makePavilion(scene, [x, z], base) {
  const pavilion = new T.Group();
  pavilion.position.set(x, base, z);
  const mesh = (geometry, shade, y) => {
    const object = new T.Mesh(geometry, new T.MeshLambertMaterial({ color: shade }));
    object.position.y = y;
    object.castShadow = true;
    object.receiveShadow = true;
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
  const roofProfile = (base, edge, inner, rise) => {
    const positions = [];
    const profile = [
      [edge, 0],
      [edge * 0.86, 0.03],
      [edge * 0.63, rise * 0.27],
      [inner, rise],
    ];
    const point = (side, ring, t) => {
      const angle = (Math.PI / 4) * side;
      const next = angle + Math.PI / 4;
      const [radius, y] = profile[ring];
      const edgeLift = (Math.abs(t - 0.5) * 2) ** 4 * 0.24 * (1 - ring / 4);
      return [
        radius * T.MathUtils.lerp(Math.cos(angle), Math.cos(next), t),
        y + edgeLift,
        radius * T.MathUtils.lerp(Math.sin(angle), Math.sin(next), t),
      ];
    };
    for (let side = 0; side < 8; side++) {
      for (let ring = 0; ring < profile.length - 1; ring++) {
        for (let strip = 0; strip < 12; strip++) {
          const a = point(side, ring, strip / 12);
          const b = point(side, ring, (strip + 1) / 12);
          const c = point(side, ring + 1, (strip + 1) / 12);
          const d = point(side, ring + 1, strip / 12);
          positions.push(...a, ...c, ...b, ...a, ...d, ...c);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const tile = mesh(geometry, 0x436765, base);
    tile.material.side = T.DoubleSide;
  };
  roofProfile(4.4, 4.98, 2.3, 0.96);
  roofProfile(5.24, 3.07, 0.58, 1.24);
  mesh(new T.CylinderGeometry(4.85, 4.98, 0.13, 8), 0xab8054, 4.34);
  mesh(new T.CylinderGeometry(2.96, 3.08, 0.12, 8), 0x9e754e, 5.1);
  mesh(new T.SphereGeometry(0.32, 8, 6), 0xbda46d, 6.75);
  scene.add(pavilion);
}
