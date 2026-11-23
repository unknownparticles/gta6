import { divePool, divingHall, eateries, pavilion } from './neighborhood.js';

const coats = [0x996d99, 0xd58b70, 0x65788f, 0xb7996f, 0x648e84, 0xd7beb8];
const skin = [0xeaba91, 0xca9678, 0xa87757];

export function addNeighborhood({ box, batch, block }) {
  const signs = [];
  const round = (x, y, z, w, h, d, color) => batch('cylinder', 'solid', x, y, z, w, h, d, color);
  const lit = (x, y, z, w, h, d, color) => box(x, y, z, w, h, d, color, 'glow');

  function customer(x, z, index, yaw, seated = false) {
    const coat = coats[index % coats.length];
    const face = skin[index % skin.length];
    const dx = Math.cos(yaw);
    const dz = -Math.sin(yaw);
    const height = seated ? 0.39 : 0;
    box(x, 1.13 - height, z, 0.49, 0.56, 0.29, coat, 'solid', yaw);
    batch('sphere', 'solid', x, 1.58 - height, z, 0.35, 0.39, 0.34, face);
    batch('sphere', 'solid', x, 1.73 - height, z, 0.36, 0.22, 0.35, 0x332635);
    for (const side of [-1, 1]) {
      box(
        x + side * dx * 0.14,
        seated ? 0.24 : 0.4,
        z + side * dz * 0.14,
        0.19,
        seated ? 0.43 : 0.76,
        0.23,
        0x393244,
        'solid',
        yaw,
      );
      box(
        x + side * dx * 0.31,
        seated ? 0.83 : 1.01,
        z + side * dz * 0.31,
        0.15,
        seated ? 0.27 : 0.45,
        0.19,
        coat,
        'solid',
        yaw,
      );
    }
    if (seated || index % 4 === 0) {
      const cupX = x - Math.sin(yaw) * 0.23 + dx * 0.25;
      const cupZ = z - Math.cos(yaw) * 0.23 + dz * 0.25;
      round(cupX, seated ? 1.02 : 1.27, cupZ, 0.12, 0.14, 0.12, 0xffe5c4);
    }
  }

  for (const shop of eateries) {
    const { x, z, w, d, front, color, paint } = shop;
    const face = z + (front * d) / 2;
    const width = w - 1;
    box(x, 1.95, z, w, 3.9, d, paint);
    block(x, z, w, d);
    box(x, 4.06, z, w + 0.5, 0.32, d + 0.55, 0x4e3e46);
    box(x, 0.05, face + front * 2.1, w + 0.65, 0.09, 4.3, 0xa68578);
    lit(x, 1.4, face + front * 0.025, 2.65, 2.65, 0.08, 0xe0a57f);
    for (const side of [-1, 1]) {
      lit(x + side * w * 0.28, 1.55, face + front * 0.09, w * 0.29, 1.68, 0.09, 0xba8e79);
      box(x + side * w * 0.28, 1.55, face + front * 0.15, 0.14, 1.65, 0.06, paint);
      round(x + side * (w / 2 - 0.82), 2.25, face + front * 0.75, 0.39, 0.52, 0.39, 0xe36b62);
    }
    for (let i = 0; i < 12; i++) {
      box(
        x + ((i + 0.5) / 12 - 0.5) * width,
        2.71,
        face + front * 0.61,
        width / 12,
        0.15,
        1.38,
        i % 2 ? 0xe6c0a2 : paint,
      );
    }
    signs.push([
      shop.name,
      x,
      3.38,
      face + front * 0.075,
      front > 0 ? 0 : Math.PI,
      color,
      {
        width: Math.min(w - 0.65, 10.8),
        height: 1,
        cat: shop.cat,
        background: '#392630',
      },
    ]);
    if (shop.queue) {
      for (let i = 0; i < shop.queue; i++) {
        const lane = Math.floor(i / 6);
        const slot = i % 6;
        const lineX = x + (lane % 2 ? 5 - slot * 1.65 : -3.25 + slot * 1.65);
        const lineZ = face + 3.2 + lane * 2.7 + ((i % 3) - 1) * 0.16;
        customer(lineX, lineZ, i + (x > 40 ? 2 : 0), lane % 2 ? Math.PI / 2 : -Math.PI / 2);
      }
      for (const side of [-1, 1]) {
        const railX = x + side * 6.15;
        for (const z of [face + 2.2, face + 10.3])
          round(railX, 0.51, z, 0.16, 1.02, 0.16, 0xb78873);
        box(railX, 0.82, face + 6.25, 0.085, 0.07, 8.1, 0x9e4654);
      }
      for (const [offset, side] of [
        [4.55, -1],
        [7.25, 1],
      ]) {
        const lineZ = face + offset;
        box(x + side * 1.15, 0.82, lineZ, 10, 0.07, 0.085, 0x9e4654);
        round(x - side * 3.85, 0.51, lineZ, 0.16, 1.02, 0.16, 0xb78873);
      }
    }
  }

  const { x, z, name } = pavilion;
  round(x, 0.13, z, 9.7, 0.24, 9.7, 0xbfa18a);
  for (const dx of [-3.7, 3.7])
    for (const dz of [-2.75, 2.75]) {
      round(x + dx, 1.75, z + dz, 0.48, 3.3, 0.48, 0x9d5049);
      block(x + dx, z + dz, 0.45, 0.45);
    }
  batch('pavilionRoof', 'solid', x, 3.75, z, 10.5, 1.35, 9.5, 0x547876);
  batch('pavilionRoof', 'solid', x, 4.64, z, 4.45, 0.76, 4.1, 0x648f83);
  round(x, 5.07, z, 0.42, 0.64, 0.42, 0xd6b584);
  signs.push([name, x, 3.02, z - 4.3, Math.PI, '#ffe4a7', { width: 4.4, height: 0.82 }]);
  for (const [px, pz] of [
    [x - 1.8, z],
    [x + 1.8, z],
    [x + 8, z + 1],
    [27, 154],
    [57, 155],
    [-32, 94],
    [19, 97],
    [257, 143],
    [32, 327],
  ]) {
    round(px, 0.61, pz, 0.21, 1.15, 0.21, 0x695154);
    round(px, 1.03, pz, 1.63, 0.13, 1.63, 0x976f5b);
    round(px, 1.2, pz, 0.37, 0.23, 0.37, 0x9f564b);
    for (const [side, yaw] of [
      [-1, -Math.PI / 2],
      [1, Math.PI / 2],
    ]) {
      round(px + side * 1.04, 0.28, pz, 0.55, 0.5, 0.55, 0x685364);
      round(px + side * 0.43, 1.16, pz, 0.11, 0.13, 0.11, 0xfae2bd);
      customer(px + side * 1.05, pz, Math.floor(Math.abs(pz + px + side)) % 6, yaw, true);
    }
  }
  for (const dx of [-8, 6.6]) {
    const treeX = x + dx;
    round(treeX, 1.45, z + 4.6, 0.42, 2.6, 0.42, 0x73504f);
    batch('sphere', 'vegetation', treeX, 3.2, z + 4.6, 3.6, 3.05, 3.3, 0x4d7666);
  }

  const { x: poolX, z: poolZ, w, d } = divePool;
  for (const side of [-1, 1]) {
    box(poolX + side * (w / 2 + 0.2), 0.09, poolZ, 0.42, 0.13, d + 0.84, 0xe3d5c9);
    box(poolX, 0.09, poolZ + side * (d / 2 + 0.2), w, 0.13, 0.42, 0xe3d5c9);
  }
  box(poolX, 0.058, poolZ, w, 0.038, d, 0x3b9daf, 'road');
  for (let i = -2; i <= 2; i++) {
    lit(poolX, 0.087, poolZ + i * 2.25, w - 0.9, 0.008, 0.055, i % 2 ? 0xffd280 : 0x8fe3d7);
  }
  const towerX = poolX - w / 2 - 1.5;
  for (const dz of [-0.8, 0.8]) {
    box(towerX, 1.69, poolZ + dz, 0.18, 3.3, 0.18, 0x597e86);
    block(towerX, poolZ + dz, 0.22, 0.22);
  }
  for (let step = 0; step < 8; step++)
    box(towerX - 0.16, 0.32 + step * 0.38, poolZ, 0.52, 0.08, 1.6, 0x9ac8c6);
  box(towerX + 1.53, 3.24, poolZ, 3.32, 0.15, 1.82, 0xe8c586);
  for (const dz of [-3.85, 3.85]) box(towerX + 1.4, 1.26, poolZ + dz, 3.0, 0.13, 0.94, 0x83d3c6);
  for (const dz of [-8, 8]) {
    for (let row = 0; row < 3; row++) {
      box(
        divingHall.x,
        0.25 + row * 0.21,
        poolZ + dz + Math.sign(dz) * row * 0.75,
        10.5,
        0.27 + row * 0.39,
        0.66,
        row % 2 ? 0x8d87a4 : 0x686486,
      );
    }
  }
  return signs;
}
