export const cars = {
  sedan: {
    name: '海雾轿车',
    subtitle: '均衡 · 后驱',
    color: '#b6e4fa',
    speed: 31,
    power: 10,
    turn: 1.72,
    size: 1.1,
    mass: 1.35,
  },
  van: {
    name: '港务厢式车',
    subtitle: '耐撞 · 大转弯',
    color: '#f2ae67',
    speed: 24,
    power: 7,
    turn: 1.22,
    size: 1.25,
    mass: 2.05,
  },
  coupe: {
    name: '晚潮双门车',
    subtitle: '加速快 · 轻车身',
    color: '#e568ac',
    speed: 39,
    power: 14,
    turn: 2,
    size: 1.1,
    mass: 1.15,
  },
  ebike: {
    name: '街坊电动车',
    subtitle: '灵活 · 两轮',
    color: '#83ceac',
    speed: 12,
    power: 6.5,
    turn: 2.6,
    size: 0.55,
    mass: 0.48,
    noReverse: true,
  },
};
export const paints = {
  factory: { name: '原厂涂装', color: '', price: 0 },
  gold: { name: '假金会员', color: '#f7c55c', price: 260 },
  candy: { name: '棕榈汽水', color: '#f43c9d', price: 360 },
  jade: { name: '电子海浪', color: '#29eec0', price: 540 },
  chrome: { name: '七日镀铬', color: '#d2dafe', price: null },
};
export const weapons = [
  {
    name: '电弧手枪',
    cap: 8,
    stock: 40,
    price: 120,
    ammoPrice: 35,
    damage: 40,
    interval: 0.28,
    reload: 1.05,
    color: 0x64fff0,
  },
  {
    name: '脉冲发射器',
    cap: 14,
    stock: 70,
    price: 430,
    ammoPrice: 55,
    damage: 21,
    interval: 0.13,
    reload: 1.45,
    color: 0xff65c9,
  },
];
export const packs = [
  { name: '首充礼包', cost: 0, coins: 180, paint: 'gold', slogan: '镀金很亮，身份很贵' },
  { name: '街头补给', cost: 68, coins: 350, paint: 'candy', slogan: '连你的影子都有涂装' },
  { name: '豪华车手礼包', cost: 328, coins: 770, paint: 'jade', slogan: '连海浪都给你让路' },
];
export const days = [
  ['60 潮票', 60],
  ['80 潮票', 80],
  ['车库补给券', 0],
  ['100 潮票', 100],
  ['棕榈汽水涂装', 0, 'candy'],
  ['150 潮票', 150],
  ['七日镀铬涂装', 0, 'chrome'],
];
export const zones = {
  garage: [-8, 96],
  spawn: [-3.5, 94],
  car: [-8, 92],
  van: [12, 97],
  training: [19, 86],
  hospital: [47, 50],
  check: [72, -18],
  raid: [112, -80],
  delivery: [-6, 96],
  gang: [16, 25],
  race: [-151, 135],
};
export const roads = { x: [-151, -78, -8, 72, 149], z: [-152, -82, -10, 62, 135] };
export const harbor = { x1: 80, x2: 166, z1: -146, z2: -27 };
export const raceRoute = [
  [-151, 110],
  [-151, 62],
  [-151, -10],
  [-151, -82],
  [-151, -152],
  [-78, -152],
  [-8, -152],
];
import { administrativeDistrict, bridgeAt, canSwimAt, interiorAt } from './city-layout.js';

const districtNames = {
  wetland: { name: '牛田洋', mark: '01', color: '#a9e69e' },
  oldTown: { name: '金平老城', mark: '02', color: '#f7ce7c' },
  docks: { name: '北岸货场', mark: '03', color: '#fe7ac4' },
  east: { name: '东海岸', mark: '04', color: '#6affde' },
  south: { name: '礐石南岸', mark: '05', color: '#a9e69e' },
};
export function districtAt(x, z) {
  const room = interiorAt(x, z);
  if (room) return { name: room.name, mark: '内', color: '#ffe4af' };
  const bridge = bridgeAt(x, z);
  if (bridge) return { name: bridge.name, mark: '桥', color: '#c4baff' };
  if (canSwimAt(x, z)) return { name: '内海湾水域', mark: '水', color: '#acd4ff' };
  if (administrativeDistrict(x, z) === '濠江区') return districtNames.south;
  if (x < -184) return districtNames.wetland;
  if (x > 208) return districtNames.east;
  if (x > 80 && z < -16) return districtNames.docks;
  if (z > 143 && x > 14 && x < 70) return { ...districtNames.oldTown, name: '人民广场' };
  return districtNames.oldTown;
}
