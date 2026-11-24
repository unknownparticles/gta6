import * as T from 'three';

const color = new T.Color();
const instance = new T.Object3D();

export function addRetroTrees(scene, points, height) {
  const tiles = new Map();
  for (const point of points) {
    const [x, z] = point;
    const key = Math.floor(x / 440) + ':' + Math.floor(z / 440);
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(point);
  }
  const trunkGeometry = new T.CylinderGeometry(0.52, 0.75, 1, 6);
  const crownGeometry = new T.IcosahedronGeometry(1, 0);
  // Curved palm fronds with a folded ridge and tapered tips.
  const leafGeometry = new T.BufferGeometry();
  leafGeometry.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        0, 0, 0, -0.48, 0.19, 1.05, 0, 0.59, 1.5, 0, 0, 0, 0, 0.59, 1.5, 0.48, 0.19, 1.05, -0.48,
        0.19, 1.05, -0.34, -0.4, 2.43, 0, 0.59, 1.5, 0.48, 0.19, 1.05, 0, 0.59, 1.5, 0.34, -0.4,
        2.43, -0.34, -0.4, 2.43, 0, -1.18, 3.55, 0, 0.59, 1.5, 0.34, -0.4, 2.43, 0, 0.59, 1.5, 0,
        -1.18, 3.55,
      ],
      3,
    ),
  );
  leafGeometry.computeVertexNormals();
  const bark = new T.MeshLambertMaterial();
  const leaves = new T.MeshLambertMaterial({ side: T.DoubleSide });
  for (const tile of tiles.values()) {
    const pieces = new Map([
      [trunkGeometry, []],
      [crownGeometry, []],
      [leafGeometry, []],
    ]);
    function add(geometry, position, size, orientation, shade) {
      instance.position.set(...position);
      instance.scale.set(...size);
      instance.rotation.set(...orientation);
      instance.updateMatrix();
      pieces.get(geometry).push([instance.matrix.clone(), shade]);
    }
    tile.forEach(([x, z, palm], index) => {
      const ground = height(x, z);
      const variation = Math.abs(Math.sin(x * 0.813 + z * 1.719));
      if (palm) {
        const tall = 6.5 + 4 * variation;
        const tilt = (variation - 0.5) * 0.12;
        add(trunkGeometry, [x, ground + tall * 0.5, z], [0.35, tall, 0.35], [0, 0, tilt], 0x927263);
        for (let i = 0; i < 8; i++) {
          const scale = 0.82 + (i % 3) * 0.12;
          add(
            leafGeometry,
            [x - tilt * tall * 0.49, ground + tall, z],
            [scale, scale, scale],
            [(i % 3) * 0.12, index + i * 0.785, 0],
            [0x55845f, 0x71905c, 0x406b57][i % 3],
          );
        }
      } else {
        const tall = 3.3 + 1.5 * variation;
        add(
          trunkGeometry,
          [x, ground + tall * 0.5, z],
          [0.45, tall, 0.42],
          [0, 0, 0.045],
          0x896958,
        );
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2 + variation * 2;
          add(
            crownGeometry,
            [x + Math.cos(angle) * 1.4, ground + tall + (i % 2) * 0.82, z + Math.sin(angle) * 1.4],
            [2.42, 1.9, 2.31],
            [0.22, angle, 0.43],
            [0x4e7356, 0x677c58, 0x638458, 0x7f8b56][i],
          );
        }
      }
    });
    for (const [geometry, items] of pieces) {
      if (!items.length) continue;
      const mesh = new T.InstancedMesh(
        geometry,
        geometry === trunkGeometry ? bark : leaves,
        items.length,
      );
      items.forEach(([matrix, shade], index) => {
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, color.setHex(shade));
      });
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  }
}

export function retroScooter() {
  const group = new T.Group();
  const chrome = new T.MeshLambertMaterial({ color: 0xbbc0bd });
  const enamel = new T.MeshLambertMaterial({ color: 0xba594d });
  const trim = new T.MeshLambertMaterial({ color: 0xe3c4a0 });
  const leather = new T.MeshLambertMaterial({ color: 0x38292d });
  const rubber = new T.MeshLambertMaterial({ color: 0x252735 });
  const box = new T.BoxGeometry(1, 1, 1);
  const round = new T.SphereGeometry(0.5, 9, 5);
  const cylinder = new T.CylinderGeometry(0.5, 0.5, 1, 10);
  function part(parent, geometry, material, x, y, z, w, h, d) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  part(group, round, enamel, 0, 0.54, 0.4, 0.57, 0.6, 0.96);
  part(group, round, trim, 0, 0.65, 0.41, 0.586, 0.25, 0.87);
  part(group, round, leather, 0, 0.759, 0.33, 0.45, 0.16, 0.69);
  part(group, box, leather, 0, 0.175, -0.2, 0.44, 0.085, 0.73);
  part(group, round, chrome, 0.238, 0.235, 0.35, 0.11, 0.16, 0.69);
  const fork = new T.Group();
  fork.position.set(0, 0, -0.58);
  group.add(fork);
  part(fork, round, enamel, 0, 0.65, 0.07, 0.5, 0.6, 0.32);
  part(fork, round, trim, 0, 0.64, -0.075, 0.32, 0.47, 0.075);
  part(fork, round, enamel, 0, 0.96, 0.14, 0.39, 0.23, 0.27);
  part(fork, round, trim, 0, 0.969, 0.015, 0.22, 0.136, 0.071);
  part(fork, box, chrome, 0, 1.065, 0.24, 0.59, 0.039, 0.049);
  for (const side of [-1, 1]) {
    part(fork, box, leather, side * 0.3, 1.065, 0.269, 0.124, 0.047, 0.066);
    part(fork, box, chrome, side * 0.22, 1.12, 0.22, 0.022, 0.136, 0.02);
    part(fork, round, chrome, side * 0.245, 1.19, 0.215, 0.107, 0.061, 0.057);
  }
  part(fork, round, enamel, 0, 0.422, -0.1, 0.22, 0.16, 0.49);
  const rearLight = new T.MeshBasicMaterial({ color: 0xca493d });
  part(group, round, rearLight, 0, 0.59, 0.86, 0.241, 0.122, 0.06);
  const wheels = [
    [fork, -0.11],
    [group, 0.61],
  ].map(([parent, z]) => {
    const axle = new T.Group();
    axle.position.set(0, 0.23, z);
    parent.add(axle);
    part(axle, cylinder, rubber, 0, 0, 0, 0.46, 0.134, 0.46).rotation.z = Math.PI / 2;
    part(axle, cylinder, chrome, 0, 0, 0, 0.275, 0.14, 0.275).rotation.z = Math.PI / 2;
    return axle;
  });
  return {
    group,
    wheels,
    articulateSteering(angle) {
      fork.rotation.y = angle * 0.26;
    },
  };
}
