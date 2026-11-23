import { addShantouScenery } from './city-scenery.js';
import { bridgeAt, groundHeight, interiorAt, landAt, wetlandWaterAt } from './city-layout.js';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { roads, harbor } from './data.js';

const media = import.meta.env.BASE_URL + 'media/models/';
const geometry = {
  box: new T.BoxGeometry(1, 1, 1),
  cylinder: new T.CylinderGeometry(0.5, 0.5, 1, 8),
  sphere: new T.IcosahedronGeometry(0.5, 1),
};
const glbs = {};
// A slightly curved leaf casts a readable silhouette without a texture.
const frond = new T.BufferGeometry();
frond.setAttribute(
  'position',
  new T.Float32BufferAttribute(
    [
      0, 0, 0, 0, 0.24, 0.25, -0.17, 0.16, 0.23, 0.17, 0.16, 0.23, 0, 0.22, 0.62, -0.12, 0.09, 0.63,
      0.12, 0.09, 0.63, 0, -0.16, 1,
    ],
    3,
  ),
);
frond.setIndex([0, 2, 1, 0, 1, 3, 1, 2, 5, 1, 5, 4, 1, 4, 6, 1, 6, 3, 4, 5, 7, 4, 7, 6]);
frond.computeVertexNormals();
geometry.frond = frond;
const filenames = {
  sedan: 'sedan',
  van: 'van',
  coupe: 'sedan-sports',
  patrol: 'police',
  warehouse: 'building-a',
  works: 'building-h',
  kiosk: 'building-s',
  container: 'shipping-container-a',
  lamp: 'light-square',
  barrier: 'construction-barrier',
};
let loading;
export function loadModels() {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all(
    Object.entries(filenames).map(async ([key, file]) => {
      try {
        const model = (await loader.loadAsync(media + file + '.glb')).scene;
        model.updateMatrixWorld(true);
        glbs[key] = model;
      } catch (error) {
        console.warn('素材载入失败，改用内置模型', file, error);
      }
    }),
  );
  return loading;
}
const solid = new T.MeshStandardMaterial({ roughness: 0.79 });
const road = new T.MeshStandardMaterial({ roughness: 0.42, metalness: 0.21 });
const glow = new T.MeshBasicMaterial({ color: 0xffffff, fog: true });
const vegetation = new T.MeshLambertMaterial({ side: T.DoubleSide });
const cloud = new T.Color();
const paintTextures = new Map();

function bodyPaint(type, source, color) {
  const key = type + ':' + color;
  if (paintTextures.has(key)) return paintTextures.get(key);
  const image = source?.image;
  if (!image?.width) return null;
  const target = new T.Color(color).getRGB(new T.Color(), T.SRGBColorSpace);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const [r, g, b] = [pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]];
    const blue = type === 'van';
    const bodyColor = blue ? b - r > 59 && b - g > 37 && b > 135 : r - g > 73 && r - b > 80 && r > 154;
    if (!bodyColor) continue;
    const shade = Math.min(1.03, (blue ? b : r) / (blue ? 215 : 240));
    pixels.data[index] = target.r * 255 * shade;
    pixels.data[index + 1] = target.g * 255 * shade;
    pixels.data[index + 2] = target.b * 255 * shade;
  }
  ctx.putImageData(pixels, 0, 0);
  const map = source.clone();
  map.source = new T.Source(canvas);
  map.needsUpdate = true;
  paintTextures.set(key, map);
  return map;
}
function shape(name, color, x, y, z, w, h, d, rot = 0) {
  const mesh = new T.Mesh(geometry[name], new T.MeshStandardMaterial({ color, roughness: 0.72 }));
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.rotation.y = rot;
  return mesh;
}
export function vehicleModel(type, tint) {
  const group = new T.Group();
  const source = glbs[type];
  const wheels = [];
  if (source) {
    const model = source.clone(true);
    const bounds = new T.Box3().setFromObject(model);
    const center = bounds.getCenter(new T.Vector3());
    const size = bounds.getSize(new T.Vector3());
    const scale = (type === 'van' ? 5.1 : 4.35) / Math.max(size.x, size.z);
    const pivot = new T.Group();
    model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
    pivot.add(model);
    pivot.scale.setScalar(scale);
    pivot.rotation.y = size.x > size.z ? -Math.PI / 2 : Math.PI;
    group.add(pivot);
    model.traverse((node) => {
      if (!node.isMesh) return;
      if (node.name.includes('wheel')) wheels.push(node);
      if (tint && (node.name.includes('body') || node.name.includes('spoiler'))) {
        node.material = node.material.clone();
        const map = bodyPaint(type, node.material.map, tint);
        if (map) node.material.map = map;
        else node.material.color.set(tint);
      }
    });
  } else {
    group.add(shape('box', tint || 0xeab9ec, 0, 0.65, 0, 2.05, 0.73, 4.2));
    group.add(shape('box', 0x322546, 0, 1.22, 0.19, 1.68, 0.54, 2.1));
    for (const x of [-1.02, 1.02])
      for (const z of [-1.32, 1.32]) {
        const wheel = shape('cylinder', 0x1b1126, x, 0.41, z, 0.75, 0.33, 0.75);
        wheel.rotation.z = Math.PI / 2;
        group.add(wheel);
      }
  }
  const shadow = new T.Mesh(
    new T.CircleGeometry(1, 12),
    new T.MeshBasicMaterial({ color: 0x160f20, transparent: true, opacity: 0.43, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.48, 2.85, 1);
  shadow.position.y = 0.046;
  group.add(shadow);
  const lights = [];
  for (const side of [-1, 1]) {
    const head = new T.Mesh(geometry.box, new T.MeshBasicMaterial({ color: 0xffe7ba }));
    head.position.set(side * 0.74, 0.69, -2.11);
    head.scale.set(0.36, 0.14, 0.08);
    group.add(head);
    const tail = new T.Mesh(geometry.box, new T.MeshBasicMaterial({ color: 0xff497e }));
    tail.position.set(side * 0.74, 0.69, 2.1);
    tail.scale.set(0.37, 0.12, 0.08);
    group.add(tail);
    if (type === 'patrol') {
      const beacon = new T.Mesh(
        geometry.box,
        new T.MeshBasicMaterial({ color: side < 0 ? 0xff3d78 : 0x467fff }),
      );
      beacon.position.set(side * 0.27, 1.7, 0.04);
      beacon.scale.set(0.39, 0.13, 0.23);
      group.add(beacon);
      lights.push(beacon);
    }
  }
  return { group, wheels, lights };
}

export function personModel(color = 0xbf6399, variant = 0) {
  const group = new T.Group();
  const coat = shape('box', color, 0, 1.15, 0, 0.55, 0.59, 0.31);
  const head = shape(
    'sphere',
    [0xf1b98e, 0xa8705b, 0xc9917b][variant % 3],
    0,
    1.62,
    -0.025,
    0.35,
    0.39,
    0.34,
  );
  group.add(coat, head, shape('sphere', 0x1d152b, 0, 1.74, 0, 0.37, 0.24, 0.36));
  const limbs = [];
  for (const sign of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(sign * 0.145, 0.83, 0);
    leg.add(shape('box', 0x252a40, 0, -0.35, 0, 0.215, 0.62, 0.23));
    leg.add(shape('box', 0x413257, 0, -0.68, -0.06, 0.23, 0.16, 0.34));
    const arm = new T.Group();
    arm.position.set(sign * 0.35, 1.36, 0);
    arm.add(shape('box', color, 0, -0.22, 0, 0.15, 0.45, 0.19));
    group.add(leg, arm);
    limbs.push({ leg, arm });
  }
  const blaster = shape('box', 0x783f9b, 0.36, 0.97, -0.29, 0.14, 0.16, 0.41);
  blaster.visible = false;
  group.add(blaster);
  const walk = (time, speed, aim = false, punch = 0, down = false) => {
    const swing = Math.sin(time * 11) * Math.min(0.75, speed * 0.17);
    limbs[0].leg.rotation.x = swing;
    limbs[1].leg.rotation.x = -swing;
    limbs[0].arm.rotation.x = -swing * 0.65;
    limbs[1].arm.rotation.x = punch ? -0.45 - punch * 1.45 : aim ? -1.05 : swing * 0.65;
    group.rotation.z = down ? -Math.PI / 2 : 0;
    group.position.y = down ? 0.28 : 0.035;
    blaster.visible = aim;
    if (aim) blaster.position.set(0.35, 1.24, -0.46);
  };
  return { group, walk };
}

function rand(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function makeCity(scene) {
  const random = rand(991);
  const obstacles = [];
  const bins = new Map();
  const kits = new Map();
  const { PI } = Math;
  const dummy = new T.Object3D();
  const meshGroups = [];
  function batch(kind, mode, x, y, z, w, h, d, color, yaw = 0, pitch = 0, roll = 0) {
    const [cx, cz] = [Math.floor(x / 95), Math.floor(z / 95)];
    const key = [kind, mode, cx, cz].join('/');
    if (!bins.has(key)) bins.set(key, { kind, mode, items: [] });
    dummy.position.set(x, y, z);
    dummy.rotation.set(pitch, yaw, roll);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    bins.get(key).items.push([dummy.matrix.clone(), color]);
  }
  const box = (x, y, z, w, h, d, color, mode = 'solid', rotation = 0) =>
    batch('box', mode, x, y, z, w, h, d, color, rotation);
  function block(x, z, w, d) {
    obstacles.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 });
  }
  function asset(kind, x, z, w, h, d, yaw = 0, y = 0) {
    const source = glbs[kind];
    if (!source) return false;
    if (!kits.has(kind))
      kits.set(kind, { source, bounds: new T.Box3().setFromObject(source), items: [] });
    const entry = kits.get(kind);
    const size = entry.bounds.getSize(new T.Vector3());
    const center = entry.bounds.getCenter(new T.Vector3());
    const scale = new T.Vector3(w / (size.x || 1), h / (size.y || 1), d / (size.z || 1));
    const shift = new T.Matrix4().makeTranslation(-center.x, -entry.bounds.min.y, -center.z);
    const matrix = new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromAxisAngle(T.Object3D.DEFAULT_UP, yaw),
      scale,
    );
    entry.items.push(matrix.multiply(shift));
    return true;
  }

  scene.fog = new T.FogExp2(0x70507f, 0.0054);
  const sky = new T.Mesh(
    new T.SphereGeometry(820, 32, 18),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      vertexShader:
        'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec3 v; void main(){vec3 d=normalize(v); float h=d.y; float f=max(0.,dot(d,normalize(vec3(-.70,.075,-.71)))); vec3 low=vec3(.31,.16,.36)+vec3(.57,.20,.17)*pow(f,4.); vec3 c=mix(low,vec3(.11,.05,.27),smoothstep(-.03,.60,h)); c+=vec3(.86,.40,.21)*pow(f,25.)*.33; float bands=sin(d.y*197.+sin(d.x*26.)*1.3)*sin(d.x*25.+d.z*21.); c+=vec3(.18,.04,.13)*smoothstep(.03,.83,bands)*(1.-smoothstep(.09,.31,h))*smoothstep(.015,.06,h)*.43; c=mix(c,vec3(1.,.73,.49),smoothstep(.9972,.9989,f)); gl_FragColor=vec4(c,1.);}',
    }),
  );
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);
  const ambient = new T.HemisphereLight(0xffbaec, 0x443254, 2.15);
  const sun = new T.DirectionalLight(0xffbb94, 2.55);
  sun.position.set(-124, 46, -97);
  const rim = new T.DirectionalLight(0x7596ed, 0.85);
  rim.position.set(100, 60, 160);
  scene.add(ambient, sun, rim);

  const landmarkSigns = addShantouScenery(scene, { box, batch, block, random: rand(6801) });
  box(-183.2, 0.45, -85, 1.2, 1.1, 238, 0x897275);
  const roadWidth = 13;
  for (const x of roads.x) {
    box(x, -0.02, -29, roadWidth, 0.084, 342, 0x302c40, 'road');
    for (const side of [-1, 1]) box(x + side * 7.1, 0.07, -29, 1.8, 0.14, 342, 0x817181);
    for (let z = -193; z < 139; z += 6.6) {
      if (roads.z.some((center) => Math.abs(z - center) < 9)) continue;
      box(x, 0.032, z, 0.13, 0.02, 2.4, 0xd69e70, 'glow');
      if (z % 2 < 1) box(x - 4 + random() * 8, 0.027, z, 1.3, 0.012, 2.5, 0x534363, 'road');
    }
  }
  for (const z of roads.z) {
    box(21, -0.018, z, 398, 0.096, roadWidth, 0x302c40, 'road');
    for (const side of [-1, 1]) {
      for (let i = 0; i < roads.x.length - 1; i++) {
        const a = roads.x[i] + 8;
        const b = roads.x[i + 1] - 8;
        box((a + b) / 2, 0.075, z + side * 7.1, b - a, 0.13, 1.8, 0x817181);
      }
    }
    for (let x = -172; x < 202; x += 6.6) {
      if (roads.x.some((center) => Math.abs(x - center) < 9)) continue;
      box(x, 0.038, z, 2.4, 0.018, 0.13, 0xd69e70, 'glow');
    }
    for (const x of roads.x)
      for (const side of [-1, 1])
        for (let i = -3; i <= 3; i++) {
          box(x + side * 8.8, 0.08, z + i * 1.22, 1.5, 0.02, 0.5, 0xaea0b4);
          box(x + i * 1.22, 0.08, z + side * 8.8, 0.5, 0.02, 1.5, 0xaea0b4);
        }
  }
  for (const z of roads.z)
    for (const x of roads.x) {
      box(x, 0.016, z, 14.7, 0.147, 14.5, 0x332e41, 'road');
    }

  const facade = [0x79647e, 0x9a717d, 0x635477, 0x987f87, 0xb08786];
  const illuminated = [0xc587a9, 0xf4b37d, 0x88c2c4, 0xe9b38c, 0x4d4261];
  function building(x, z, w, h, d, neon = false) {
    const color = facade[Math.floor(random() * facade.length)];
    box(x, h / 2, z, w, h, d, color);
    box(x, h + 0.12, z, w + 0.7, 0.3, d + 0.7, 0x83647d);
    box(x + w * 0.1, h + 1.1, z + d * 0.16, w * 0.45, 2.2, d * 0.32, 0x624d67);
    const floors = Math.floor(h / 3.2);
    const windowColor = illuminated[Math.floor(random() * illuminated.length)];
    for (let floor = 0; floor < floors; floor++) {
      const y = 2 + floor * 3.13;
      if (y > h - 0.4) break;
      for (let u = -w / 2 + 1.3; u < w / 2 - 1; u += 2.7) {
        if (random() > 0.81) continue;
        box(x + u, y, z + d / 2 + 0.022, 1.22, 1.08, 0.045, floor % 3 ? windowColor : 0x4d4360, 'glow');
        box(x + u, y, z - d / 2 - 0.022, 1.22, 1.08, 0.045, windowColor, 'glow');
      }
      for (let u = -d / 2 + 1.5; u < d / 2 - 1; u += 3.4) {
        box(x + w / 2 + 0.03, y, z + u, 0.052, 1.02, 1.16, windowColor, 'glow');
        box(x - w / 2 - 0.03, y, z + u, 0.052, 1.02, 1.16, floor % 2 ? windowColor : 0x4d4260, 'glow');
      }
    }
    if (neon) {
      const trim = random() > 0.5 ? 0xff79bb : 0x70ece0;
      box(x, 3.05, z + d / 2 + 0.15, w + 0.32, 0.23, 0.26, trim, 'glow');
      box(x + w / 2, Math.min(12, h * 0.6), z - d / 2, 0.32, Math.min(h, 11), 0.29, trim, 'glow');
    }
    block(x, z, w, d);
  }

  for (let row = 0; row < roads.z.length - 1; row++) {
    const z = (roads.z[row] + roads.z[row + 1]) / 2;
    for (let column = 0; column < roads.x.length - 1; column++) {
      const x = (roads.x[column] + roads.x[column + 1]) / 2;
      if (column === 3 && row < 2) continue;
      if (column === 2 && (row === 2 || row === 3)) continue;
      for (const a of [-1, 1])
        for (const b of [-1, 1]) {
          const high = column === 1 || row === 0;
          const w = 13 + random() * 8;
          const d = 14 + random() * 7;
          const px = x + a * 15.5;
          const pz = z + b * 15.5;
          const height = (high ? 13 : 7) + random() * (high ? 40 : 17);
          if (Math.abs(px + 44) < 28 && Math.abs(pz - 113) < 18) continue;
          building(px, pz, w, height, d, a === b);
        }
    }
  }
  for (let i = 0; i < 28; i++) {
    const x = -169 + i * 13;
    building(x, -178 - (i % 2) * 14, 9 + random() * 3, 12 + random() * 32, 10 + random() * 6);
  }
  for (let i = 0; i < 5; i++) {
    const z = 22 + i * 34;
    if (z > 165) continue;
    if (!asset('works', 188, z, 20, 13, 15)) building(188, z, 20, 13, 15);
    else block(188, z, 20, 15);
  }
  for (const [x, z, kind] of [
    [110, -123, 'warehouse'],
    [108, -56, 'works'],
    [184, -104, 'warehouse'],
    [180, -46, 'works'],
  ]) {
    if (asset(kind, x, z, 24, 11, 19)) block(x, z, 24, 19);
    else building(x, z, 24, 11, 19);
  }
  box(115, 0.018, -107, 49, 0.067, 36, 0x4c4353);
  box(115, 0.02, -46, 48, 0.07, 30, 0x4d4556);
  for (const z of [-135, -112, -66, -39])
    for (let i = 0; i < 3; i++) {
      const x = 99 + i * 12;
      const tint = [0x795472, 0x644c7e, 0xb16b57][i];
      if (!asset('container', x, z, 7, 2.9, 3.2)) box(x, 1.48, z, 7, 2.95, 3.2, tint);
      if (i % 2) {
        if (!asset('container', x, z, 7, 2.9, 3.2, 0, 2.9)) box(x, 4.4, z, 7, 2.95, 3.2, tint);
      }
      block(x, z, 7.1, 3.3);
    }
  // Painted boundaries leave the two road exits clear.
  for (const z of [-145, -27])
    for (let x = 83; x < 167; x += 5.6) {
      if (Math.abs(x - 149) < 8) continue;
      box(x, 0.112, z, 3.5, 0.026, 0.37, 0xf8aa64, 'glow');
    }
  for (const x of [80, 166])
    for (let z = harbor.z1; z < harbor.z2; z += 5.6) {
      box(x, 0.109, z, 0.35, 0.028, 3.4, 0xf8aa64, 'glow');
    }
  for (const z of [-115, -50]) {
    const x = 198;
    box(x, 13, z, 1.5, 26, 1.5, 0xf0a465);
    box(x - 6, 25.8, z, 26, 0.98, 1.2, 0xf4ad69);
    box(x - 15, 21.5, z, 0.25, 8, 0.25, 0xffb774);
    box(x - 15, 17.3, z, 0.9, 0.7, 0.8, 0x503b52);
    box(x, 1.5, z, 5, 3, 5, 0x6e515c);
    block(x, z, 5, 5);
  }
  for (let z = -173; z < 161; z += 21) {
    const x = -173 + random() * 6;
    const h = 6.5 + random() * 3.2;
    batch('cylinder', 'solid', x, h / 2, z, 0.48, h, 0.48, 0x573c4d, 0, 0.02, 0.065);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.39996;
      batch(
        'frond',
        'vegetation',
        x - h * 0.032,
        h,
        z,
        3.3,
        2.5,
        i < 7 ? 3.4 : 2.2,
        i % 3 === 0 ? 0x4f867c : 0x32666e,
        a,
        i < 7 ? 0.18 : -0.46,
        0.17 * Math.sin(i),
      );
    }
    if (z % 3 !== 0) box(-179.9, 1.25, z, 0.23, 0.16, 1.4, 0x6df5df, 'glow');
  }
  for (const x of [-159, -70, -16, 64, 141])
    for (let z = -177; z <= 153; z += 22) {
      if (roads.z.some((center) => Math.abs(z - center) < 10)) continue;
      if (!asset('lamp', x, z, 2.1, 6, 1.1)) {
        box(x, 2.9, z, 0.23, 5.8, 0.23, 0x5a4560);
        box(x + 0.7, 5.75, z, 1.5, 0.18, 0.3, 0x725c75);
      }
      box(x + 0.13, 5.78, z, 0.95, 0.12, 0.51, x > 100 ? 0xffb377 : 0x8ff7f1, 'glow');
      box(x + 2.4, 0.085, z + 2.8, 0.65, 0.012, 3.5, x > 100 ? 0x7a5862 : 0x636a85, 'road');
    }
  // Garage, training and the event square keep their approach lanes open.
  box(20, 0.034, 90, 38, 0.057, 29, 0x635063);
  for (let x = 1; x <= 35; x += 4) box(x, 0.079, 99.4, 0.12, 0.012, 5.4, 0xd8b4a0, 'glow');
  box(18.4, 0.035, 24, 28, 0.058, 24, 0x625569);
  building(41, 19, 16, 14, 12, true);
  if (asset('kiosk', 84, -15, 5, 4, 4.5)) block(84, -15, 5, 4.5);
  else building(84, -15, 5, 4, 4.5);
  for (const x of [84, 90, 95]) asset('barrier', x, -23.5, 3, 1, 1);

  for (const { kind, mode, items } of bins.values()) {
    const material = { glow, road, vegetation, solid }[mode];
    const mesh = new T.InstancedMesh(geometry[kind], material, items.length);
    for (const [index, [matrix, color]] of items.entries()) {
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, cloud.set(color));
    }
    mesh.computeBoundingSphere();
    meshGroups.push(mesh);
  }
  for (const { source, items } of kits.values()) {
    source.traverse((node) => {
      if (!node.isMesh) return;
      const mesh = new T.InstancedMesh(node.geometry, node.material, items.length);
      items.forEach((matrix, index) =>
        mesh.setMatrixAt(index, new T.Matrix4().multiplyMatrices(matrix, node.matrixWorld)),
      );
      mesh.computeBoundingSphere();
      meshGroups.push(mesh);
    });
  }
  for (const mesh of meshGroups) scene.add(mesh);

  const signMaterial = (label, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#231d35';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, 506, 122);
    ctx.fillStyle = color;
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 69);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide });
  };
  for (const [label, x, y, z, yaw, color] of [
    ...landmarkSigns,
    ['潮汐货场', 106, 7, -33, 0, '#ffd09b'],
    ['滨海大道', -170, 5, 125, PI / 2, '#8affe2'],
    ['夜班维修街', 39, 4.3, 31, 0, '#ffa4d5'],
  ]) {
    const sign = new T.Mesh(new T.PlaneGeometry(8.5, 2.12), signMaterial(label, color));
    sign.position.set(x, y, z);
    sign.rotation.y = yaw;
    scene.add(sign);
  }
  return {
    height: groundHeight,
    interior: interiorAt,
    clear(x, z, radius = 0.55, vehicle = false) {
      const bridge = bridgeAt(x, z);
      if (bridge) {
        if (!bridgeAt(x, z, radius)) return false;
      } else {
        for (const [dx, dz] of [
          [0, 0],
          [radius, 0],
          [-radius, 0],
          [0, radius],
          [0, -radius],
        ]) {
          if (!landAt(x + dx, z + dz) || wetlandWaterAt(x + dx, z + dz)) return false;
        }
      }
      if (vehicle && interiorAt(x, z)) return false;
      return !obstacles.some(
        (o) => x + radius > o.x1 && x - radius < o.x2 && z + radius > o.z1 && z - radius < o.z2,
      );
    },
    sky,
  };
}
