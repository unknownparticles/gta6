import { eateries } from './neighborhood.js';

export const venues = [
  ...eateries.map((shop, index) => ({
    ...shop,
    anchor: [
      [-2780, -1402],
      [-2866, -1450],
      [-2797, -1460],
      [-1867, -1094],
    ][index],
    short: ['牛肉火锅', '土鸡火锅', '现蒸肠粉', '红糖豆花'][index],
    kind: 'food',
  })),
  {
    id: 'garage',
    name: '晚钟车库',
    short: '维修 · 夜班调度',
    anchor: [-2750, -1452],
    kind: 'garage',
    paint: 0x365568,
  },
  {
    id: 'cargo',
    name: '北岸货场',
    short: '港务签收处',
    anchor: [-2210, -807],
    kind: 'cargo',
    paint: 0x38575b,
  },
  {
    id: 'culture',
    name: '海湾文化馆',
    short: '港口档案 · 展厅',
    anchor: [-1815, -1110],
    kind: 'culture',
    paint: 0x486d77,
  },
  {
    id: 'tower-room',
    name: '电视塔展厅',
    short: '旧播音档案',
    anchor: [-2377, -3683],
    kind: 'tower',
    paint: 0x435c67,
  },
  {
    id: 'training',
    name: '街坊训练场',
    short: '装备与靶牌练习',
    anchor: [-2658, -1435],
    kind: 'training',
    paint: 0x534260,
  },
  {
    id: 'gang',
    name: '维修街',
    short: '盐线 · 锈锚',
    anchor: [-2690, -1336],
    kind: 'gang',
    paint: 0x71454b,
  },
];
