import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const paint = new T.MeshLambertMaterial({ vertexColors: true });
const ink = new T.Color();

function paintPart(geometry, shade) {
  const part = geometry.index ? geometry.toNonIndexed() : geometry;
  ink.set(shade);
  const colors = new Float32Array(part.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) ink.toArray(colors, i);
  part.setAttribute('color', new T.BufferAttribute(colors, 3));
  return part;
}

function ellipsoid(x, y, z, width, height, depth, shade, sides = 8, rings = 5) {
  const geometry = new T.SphereGeometry(1, sides, rings);
  geometry.scale(width, height, depth).translate(x, y, z);
  return paintPart(geometry, shade);
}

function hull(rings, shade, sides = 8) {
  const points = rings.map(([y, width, depth, z = 0]) =>
    Array.from({ length: sides }, (_, side) => {
      const angle = ((side + 0.5) * 2 * Math.PI) / sides;
      return [Math.cos(angle) * width, y, Math.sin(angle) * depth + z];
    }),
  );
  const positions = [];
  const triangle = (a, b, c) => positions.push(...a, ...b, ...c);
  for (let y = 1; y < points.length; y++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const a = points[y - 1][i];
      const b = points[y][i];
      const c = points[y][next];
      const d = points[y - 1][next];
      triangle(a, b, c);
      triangle(a, c, d);
    }
  }
  for (const [ring, reverse] of [
    [points[0], false],
    [points.at(-1), true],
  ]) {
    for (let i = 1; i < sides - 1; i++) {
      if (reverse) triangle(ring[0], ring[i + 1], ring[i]);
      else triangle(ring[0], ring[i], ring[i + 1]);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'uv',
    new T.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2),
  );
  geometry.computeVertexNormals();
  return paintPart(geometry, shade);
}

function patch(x, y, z, w, h, d, shade, angle = 0) {
  const part = new T.BoxGeometry(w, h, d);
  part.rotateZ(angle).translate(x, y, z);
  return paintPart(part, shade);
}

function mesh(parent, ...parts) {
  const item = new T.Mesh(mergeGeometries(parts), paint);
  parent.add(item);
  return item;
}

function joint(parent, x, y, z) {
  const part = new T.Group();
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}

export function retroRider(outfit = 0x265e68, complexion = 0xba825e) {
  const group = new T.Group();
  const body = joint(group, 0, 0.9, 0);
  const back = joint(body, 0, 0.11, 0);
  const skin = complexion;
  const dark = 0x273148;
  const jacket = outfit;
  const elastic = 0x183e47;
  const cream = 0xe9dccc;
  const coral = 0xe96959;
  mesh(
    body,
    hull(
      [
        [-0.11, 0.154, 0.095],
        [-0.02, 0.172, 0.106],
        [0.085, 0.157, 0.106],
      ],
      dark,
    ),
  );
  mesh(
    back,
    hull(
      [
        [0, 0.162, 0.112],
        [0.16, 0.179, 0.113],
        [0.33, 0.236, 0.119],
        [0.43, 0.201, 0.096],
        [0.455, 0.101, 0.081],
      ],
      jacket,
    ),
    hull(
      [
        [0, 0.162, 0.116],
        [0.035, 0.166, 0.114],
      ],
      elastic,
    ),
    patch(0, 0.21, -0.107, 0.115, 0.34, 0.025, cream),
    patch(-0.084, 0.379, -0.112, 0.06, 0.097, 0.024, coral, -0.35),
    patch(0.084, 0.379, -0.112, 0.06, 0.097, 0.024, coral, 0.35),
    patch(0, 0.305, 0.112, 0.312, 0.063, 0.013, 0x498992),
    patch(0, 0.268, 0.108, 0.302, 0.024, 0.014, coral),
    ellipsoid(0, 0.451, -0.007, 0.06, 0.086, 0.059, skin),
  );
  const head = joint(back, 0, 0.485, -0.01);
  mesh(
    head,
    hull(
      [
        [0, 0.059, 0.065, -0.013],
        [0.057, 0.091, 0.086],
        [0.14, 0.097, 0.087],
        [0.218, 0.074, 0.062],
      ],
      skin,
      10,
    ),
    ellipsoid(0, 0.172, 0.019, 0.099, 0.084, 0.093, 0x252127, 10, 5),
    ellipsoid(-0.087, 0.095, 0.002, 0.018, 0.032, 0.019, 0xa86f51, 6, 4),
    ellipsoid(0.087, 0.095, 0.002, 0.018, 0.032, 0.019, skin, 6, 4),
    ellipsoid(0, 0.093, -0.087, 0.024, 0.025, 0.023, 0xc38a65, 6, 4),
    patch(-0.041, 0.122, -0.079, 0.039, 0.014, 0.011, 0x332227),
    patch(0.041, 0.122, -0.079, 0.039, 0.014, 0.011, 0x332227),
    patch(0, 0.052, -0.069, 0.045, 0.008, 0.012, 0x794c40),
  );
  const legs = [-1, 1].map((side) => {
    const hip = joint(body, side * 0.09, -0.05, 0);
    mesh(
      hip,
      hull(
        [
          [-0.427, 0.055, 0.059],
          [-0.28, 0.068, 0.07],
          [-0.09, 0.082, 0.078],
          [0.052, 0.08, 0.079],
        ],
        dark,
      ),
    );
    const knee = joint(hip, 0, -0.41, 0);
    mesh(
      knee,
      hull(
        [
          [-0.373, 0.045, 0.049],
          [-0.19, 0.052, 0.058],
          [-0.075, 0.066, 0.067],
          [0.032, 0.054, 0.055],
        ],
        0x2e3952,
      ),
    );
    const ankle = joint(knee, 0, -0.361, 0);
    mesh(
      ankle,
      hull(
        [
          [-0.082, 0.069, 0.128, -0.043],
          [-0.059, 0.07, 0.128, -0.044],
        ],
        cream,
      ),
      hull(
        [
          [-0.058, 0.066, 0.123, -0.043],
          [-0.027, 0.065, 0.116, -0.039],
          [0.022, 0.049, 0.067, -0.008],
        ],
        0x32494c,
      ),
      patch(0, -0.028, -0.082, 0.074, 0.009, 0.038, 0xdce6da),
    );
    return { hip, knee, ankle, side };
  });
  const arms = [-1, 1].map((side) => {
    const shoulder = joint(back, side * 0.207, 0.339, 0.005);
    mesh(
      shoulder,
      hull(
        [
          [-0.254, 0.046, 0.051],
          [-0.136, 0.064, 0.066],
          [-0.045, 0.078, 0.078],
          [0.038, 0.063, 0.064],
        ],
        jacket,
      ),
      hull(
        [
          [-0.12, 0.067, 0.069],
          [-0.08, 0.074, 0.075],
        ],
        coral,
      ),
    );
    const elbow = joint(shoulder, 0, -0.24, 0);
    mesh(
      elbow,
      hull(
        [
          [-0.21, 0.037, 0.042],
          [-0.166, 0.041, 0.044],
          [-0.05, 0.056, 0.059],
          [0.025, 0.044, 0.047],
        ],
        jacket,
      ),
      hull(
        [
          [-0.214, 0.039, 0.045],
          [-0.178, 0.041, 0.046],
        ],
        elastic,
      ),
      ellipsoid(0, -0.25, -0.006, 0.036, 0.066, 0.025, skin, 6, 4),
      ellipsoid(-side * 0.027, -0.234, -0.017, 0.019, 0.029, 0.018, skin, 6, 4),
    );
    return { shoulder, elbow, side };
  });

  let phase = 0;
  let gait = 0;
  let mode = 0;
  let clock = 0;
  const blend = T.MathUtils.lerp;
  function animate({ speed, airborne, riding, steer = 0, dt }) {
    clock += dt;
    phase = (phase + Math.min(speed, 8.6) * dt * 2.9) % (Math.PI * 2);
    const amount = 1 - Math.exp(-16 * dt);
    gait = blend(gait, Math.min(speed / 4, 1), amount);
    mode = blend(mode, Number(riding), amount);
    const lift = airborne && !riding ? 1 : 0;
    const run = T.MathUtils.smoothstep(speed, 4.8, 8.5);
    body.position.set(
      0,
      blend(0.903 + Math.abs(Math.cos(phase)) * gait * 0.026, 0.814, mode),
      mode * 0.205,
    );
    back.rotation.set(
      blend(0.07 * run + lift * 0.08, -0.23, mode),
      0.11 * Math.sin(phase) * gait * (1 - mode),
      0,
    );
    head.rotation.set(-0.13 * mode, Math.sin(clock * 0.8) * 0.065 * (1 - gait), 0);
    legs.forEach(({ hip, knee, ankle, side }) => {
      const cycle = Math.sin(phase + (side > 0 ? Math.PI : 0));
      const hipAngle = cycle * gait * (0.49 + 0.25 * run) + 0.28 * lift;
      const kneeAngle = -Math.max(0, -cycle) * gait * (0.76 + 0.21 * run) - 0.58 * lift;
      hip.rotation.set(blend(hipAngle, 1.14, mode), 0, side * 0.08 * mode);
      knee.rotation.x = blend(kneeAngle, -1.35, mode);
      ankle.rotation.x = -(hip.rotation.x + knee.rotation.x) * (0.63 + mode * 0.37);
    });
    arms.forEach(({ shoulder, elbow, side }) => {
      const cycle = Math.sin(phase + (side > 0 ? Math.PI : 0));
      shoulder.rotation.set(
        blend(-cycle * gait * (0.37 + 0.2 * run) + lift * 0.48, 0.64 + steer * side * 0.11, mode),
        0,
        side * (0.1 + mode * 0.1 + lift * 0.15),
      );
      elbow.rotation.x = blend(0.1 + gait * run * 0.75 + lift * 0.63, 1.18, mode);
    });
  }
  return { group, animate };
}
