export const eateries = [
  {
    id: 'beef-hotpot',
    name: '梅花吴记',
    kind: '潮汕牛肉火锅',
    x: 32,
    z: 76,
    w: 16,
    d: 10,
    front: 1,
    color: '#f2b56e',
    paint: 0x8d454e,
    menu: [
      ['鲜切牛肉锅', 38, 55],
      ['手打牛丸汤', 16, 24],
    ],
    queue: 18,
  },
  {
    id: 'chicken-hotpot',
    name: '更新土鸡火锅',
    kind: '砂锅现炖',
    x: 56,
    z: 76,
    w: 16,
    d: 10,
    front: 1,
    color: '#a9df92',
    paint: 0x506f57,
    menu: [
      ['土鸡火锅', 34, 48],
      ['土鸡清汤', 15, 22],
    ],
    queue: 16,
  },
  {
    id: 'rice-rolls',
    name: '老吴肠粉',
    kind: '老吴猫 · 即蒸即卖',
    x: 44,
    z: 99,
    w: 10,
    d: 6,
    front: -1,
    color: '#fbc88d',
    paint: 0xaf6457,
    menu: [
      ['鲜虾肠粉', 13, 26],
      ['鸡蛋肠粉', 8, 16],
    ],
    cat: true,
  },
  {
    id: 'douhua',
    name: '广场豆花',
    kind: '加一勺红糖',
    x: 20,
    z: 146,
    w: 8,
    d: 4.4,
    front: 1,
    color: '#fae3ad',
    paint: 0x508480,
    menu: [
      ['红糖豆花', 7, 14],
      ['花生豆花', 10, 20],
    ],
  },
].map((shop) => ({
  ...shop,
  point: [shop.x, shop.z + shop.front * (shop.d / 2 + 2.4)],
}));

export const pavilion = { x: -123, z: 154, point: [-123, 149], name: '小公园亭' };
export const divingHall = {
  id: 'diveHall',
  name: '濠江跳水馆',
  x: 41,
  z: 345,
  w: 36,
  d: 26,
  door: 6.6,
  front: -1,
  accent: 0x63d6dc,
  point: [41, 329],
};
export const divePool = { x: 44, z: 347, w: 17, d: 13 };
export function inDivePool(x, z) {
  return Math.abs(x - divePool.x) < divePool.w / 2 && Math.abs(z - divePool.z) < divePool.d / 2;
}

export const bikeParking = [
  [[2.5, 103], Math.PI / 2],
  [[9, 103], Math.PI / 2],
  [[61, 96], 0],
  [[-130, 147], 0],
  [[29, 153], Math.PI],
  [[51, 327], Math.PI],
  [[56, 327], Math.PI],
  [[259, 129], -Math.PI / 2],
];

export const bikeRoutes = [
  [
    [-10, 90],
    [-10, 60],
    [-74, 60],
    [-74, 132],
    [-10, 132],
  ],
  [
    [70, 89],
    [70, 137],
    [117, 137],
    [152, 137],
    [152, 65],
    [70, 65],
  ],
  [
    [-82, 123],
    [-82, 142],
    [-152, 142],
    [-152, 63],
    [-82, 63],
  ],
  [
    [-70, 312],
    [145, 312],
    [145, 376],
    [-81, 376],
    [-81, 312],
  ],
  [
    [271, 100],
    [271, 133],
    [152, 133],
    [152, 62],
    [271, 62],
  ],
];
