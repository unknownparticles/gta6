export const mapBounds = { west: -300, east: 350, north: -215, south: 425 };
export const districtBorderX = 106;

export const northShore = [
  [-278, 157],
  [-235, 164],
  [-187, 173],
  [-132, 174],
  [-80, 176],
  [-35, 172],
  [38, 170],
  [95, 178],
  [151, 185],
  [224, 180],
  [269, 171],
  [311, 152],
  [329, 136],
];

export const southShore = [
  [-256, 218],
  [-197, 231],
  [-150, 244],
  [-78, 258],
  [-37, 268],
  [33, 277],
  [91, 281],
  [149, 276],
  [199, 284],
  [260, 290],
];

export const northBank = [
  [-278, 44],
  [-183, 33],
  [-183, -202],
  [211, -202],
  [211, -87],
  [274, -66],
  [329, -21],
  ...northShore.slice().reverse(),
];
export const southBank = [...southShore, [278, 348], [241, 411], [-226, 411], [-257, 369]];

export const bridges = [
  {
    id: 'qiaoshi',
    name: '礐石大桥',
    x: -78,
    start: 138,
    end: 298,
    deck: 8.5,
    width: 13.4,
    style: 'cable',
  },
  {
    id: 'baybridge',
    name: '海湾大桥',
    x: 149,
    start: 138,
    end: 310,
    deck: 11.4,
    width: 14.6,
    style: 'suspension',
  },
];

export const interiors = [
  {
    id: 'towerHall',
    name: '电视塔展厅',
    x: -44,
    z: 113,
    w: 18,
    d: 15,
    door: 4.5,
    front: 1,
    accent: 0xf492cc,
  },
  {
    id: 'squareHall',
    name: '人民广场文化馆',
    x: 48,
    z: 112,
    w: 21,
    d: 14,
    door: 5.4,
    front: 1,
    accent: 0xfad389,
  },
  {
    id: 'eastHall',
    name: '东海岸展馆',
    x: 266,
    z: 89,
    w: 22,
    d: 17,
    door: 5,
    front: 1,
    accent: 0x78e8e0,
  },
  {
    id: 'southHall',
    name: '礐石游客中心',
    x: -64,
    z: 322,
    w: 16,
    d: 14,
    door: 4.6,
    front: 1,
    accent: 0xe8bc84,
  },
  {
    id: 'wetlandHall',
    name: '牛田洋观鸟站',
    x: -238,
    z: 97,
    w: 15,
    d: 12,
    door: 4,
    front: 1,
    accent: 0xa5dca7,
  },
  {
    id: 'garageHall',
    name: '晚钟车库',
    x: 12,
    z: 113,
    w: 22,
    d: 13,
    door: 5.6,
    front: -1,
    accent: 0xff9bd3,
  },
  {
    id: 'hospitalHall',
    name: 'S城医院',
    x: 47,
    z: 36,
    w: 21,
    d: 13,
    door: 6,
    front: 1,
    accent: 0x8dfbe4,
  },
];

export const landmarks = [
  {
    id: 'ferry-north',
    name: '人民广场轮渡',
    point: [34, 167],
    color: '#ffdf96',
    icon: 'map',
    description: '金平区候船点，搭船前往礐石轮渡。',
  },
  {
    id: 'ferry-south',
    name: '礐石轮渡',
    point: [-34, 273],
    color: '#ffdf96',
    icon: 'map',
    description: '濠江区候船点，搭船前往人民广场轮渡。',
  },
  {
    id: 'beach',
    name: '东海岸沙滩',
    point: [286, 133],
    color: '#ffd086',
    icon: 'target',
    description: '可以游泳，或和本地球员打一局沙滩排球。',
  },
  {
    id: 'tower',
    name: '电视塔',
    point: [-44, 127],
    color: '#f492cc',
    icon: 'flag',
    description: '塔下展厅可步行进入。',
  },
  {
    id: 'square',
    name: '人民广场',
    point: [42, 153],
    color: '#f7ce7c',
    icon: 'flag',
    description: '北岸滨水广场，可进文化馆。',
  },
  {
    id: 'east',
    name: '东海岸',
    point: [262, 135],
    color: '#83f9df',
    icon: 'map',
    description: '沿海大道、观景步道和海岸展馆。',
  },
  {
    id: 'mountain',
    name: '礐石山',
    point: [-25, 351],
    color: '#a9e69e',
    icon: 'flag',
    description: '从南岸步道上山，山顶可俯瞰内海湾。',
  },
  {
    id: 'baybridge',
    name: '海湾大桥',
    point: [149, 231],
    color: '#c4baff',
    icon: 'car',
    description: '东侧悬索桥，可由东海岸方向开车上桥。',
  },
  {
    id: 'qiaoshi',
    name: '礐石大桥',
    point: [-78, 216],
    color: '#f6a4b9',
    icon: 'car',
    description: '西侧斜拉桥，连接北岸老城和礐石山。',
  },
  {
    id: 'bay',
    name: '内海湾',
    point: [34, 162],
    labelAt: [38, 222],
    color: '#acd4ff',
    icon: 'map',
    description: '登北岸亲水步道，看两座桥和南岸山线。',
  },
  {
    id: 'river',
    name: '榕江',
    point: [-185, 152],
    labelAt: [-206, 195],
    color: '#acd4ff',
    icon: 'map',
    description: '从西侧堤岸看榕江汇入内海湾。',
  },
  {
    id: 'wetland',
    name: '牛田洋',
    point: [-233, 124],
    color: '#a9e69e',
    icon: 'map',
    description: '鱼塘、湿地、堤路和观鸟站。',
  },
];

export const coastRoads = [
  [
    [-250, 135],
    [275, 135],
  ],
  [
    [-78, 298],
    [-78, 379],
  ],
  [
    [149, 310],
    [149, 379],
  ],
  [
    [-167, 310],
    [215, 310],
  ],
  [
    [-167, 379],
    [215, 379],
  ],
  [
    [-167, 310],
    [-167, 379],
  ],
  [
    [215, 310],
    [215, 379],
  ],
  [
    [275, 135],
    [275, 4],
  ],
  [
    [149, 62],
    [275, 62],
  ],
  [
    [-228, 135],
    [-228, 77],
  ],
];

export function insidePolygon(x, z, vertices) {
  let inside = false;
  for (let a = 0, b = vertices.length - 1; a < vertices.length; b = a++) {
    const [ax, az] = vertices[a];
    const [bx, bz] = vertices[b];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function bridgeAt(x, z, radius = 0) {
  return bridges.find(
    (bridge) =>
      z >= bridge.start && z <= bridge.end && Math.abs(x - bridge.x) <= bridge.width / 2 - radius,
  );
}

export function bridgeHeight(bridge, z) {
  const ramp = Math.min(1, Math.max(0, Math.min(z - bridge.start, bridge.end - z) / 49));
  return bridge.deck * ramp * ramp * (3 - 2 * ramp);
}

export function landAt(x, z) {
  return insidePolygon(x, z, northBank) || insidePolygon(x, z, southBank);
}

export function wetlandWaterAt(x, z) {
  return wetlandPonds.some(([px, pz, w, d]) => Math.abs(x - px) < w / 2 && Math.abs(z - pz) < d / 2);
}

export const wetlandPonds = [
  [-258, 72, 25, 29],
  [-256, 112, 25, 23],
  [-199, 80, 28, 26],
  [-199, 109, 27, 21],
  [-248, 149, 34, 9],
  [-203, 148, 27, 10],
];

export function mountainHeight(x, z) {
  const distance = Math.hypot((x + 25) / 42, (z - 350) / 34);
  return 16 * Math.max(0, 1 - distance * distance) ** 2;
}

export function groundHeight(x, z) {
  const bridge = bridgeAt(x, z);
  return bridge ? bridgeHeight(bridge, z) : mountainHeight(x, z);
}

export function interiorAt(x, z) {
  return interiors.find(
    (room) => Math.abs(x - room.x) < room.w / 2 - 0.3 && Math.abs(z - room.z) < room.d / 2 - 0.3,
  );
}

export const ferryStops = [
  { name: '人民广场轮渡', pier: [34, 167], berth: [34, 182], district: '金平区' },
  { name: '礐石轮渡', pier: [-34, 273], berth: [-34, 258], district: '濠江区' },
];

export const beach = { court: [286, 124], spawn: [286, 133], water: [304, 170] };

export function canSwimAt(x, z) {
  if (bridgeAt(x, z) || landAt(x, z)) return false;
  return x >= -254 && x <= 343 && z >= 139 && z <= 308;
}

export function administrativeDistrict(x, z) {
  if (bridgeAt(x, z)) return '';
  if (insidePolygon(x, z, southBank)) return '濠江区';
  if (insidePolygon(x, z, northBank)) return x >= districtBorderX ? '龙湖区' : '金平区';
  return '';
}
