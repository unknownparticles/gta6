import { districtAt, harbor, roads, zones } from './data.js';
import { iconPath } from './icons.js';
import {
  bridgeAt,
  bridges,
  coastRoads,
  districtBorderX,
  ferryStops,
  landmarks,
  mapBounds,
  northBank,
  southBank,
  wetlandPonds,
} from './city-layout.js';

export const distance = (x, z, point) => Math.hypot(x - point[0], z - point[1]);
export const inHarbor = (x, z) => x >= harbor.x1 && x <= harbor.x2 && z >= harbor.z1 && z <= harbor.z2;
export const direction = (x, z, point) => Math.atan2(x - point[0], z - point[1]);
const nearest = (list, value) =>
  list.reduce((a, b) => (Math.abs(a - value) < Math.abs(b - value) ? a : b));

export function routeTo(x, z, point) {
  const path = [];
  if (!point) return path;
  const onBridge = bridgeAt(x, z);
  const endBridge = bridgeAt(...point);
  const isSouth = (x, z) => z >= (bridgeAt(x, z) ? 245 : 233);
  const south = isSouth(x, z);
  const endSouth = isSouth(...point);
  const changeBanks = south !== endSouth;
  const crossing =
    onBridge ||
    endBridge ||
    nearest(
      bridges.map(({ x }) => x),
      (x + point[0]) / 2,
    );
  const bridgeX = typeof crossing === 'number' ? crossing : crossing.x;
  if (endBridge && endBridge === onBridge) return [point];
  if (changeBanks || endBridge || onBridge) {
    if (!onBridge) {
      const road = south ? 310 : 135;
      const approach = nearest(south ? [-167, -78, 149, 215] : [...roads.x, 275], x);
      path.push([approach, z], [approach, road], [bridgeX, road]);
    }
    if (endBridge) return [...path, point];
    path.push([bridgeX, endSouth ? 310 : 135]);
    if (endSouth) return [...path, [point[0], 310], point];
    return [...path, ...routeTo(bridgeX, 135, point)];
  }
  if (south) return [[x, nearest([310, 379], z)], [point[0], nearest([310, 379], z)], point];
  if (x < -183 || x > 211 || point[0] < -183 || point[0] > 211) {
    return [[x, 135], [point[0], 135], point];
  }
  const xroad = nearest(roads.x, x);
  const zroad = nearest(roads.z, z);
  const endX = nearest(roads.x, point[0]);
  const endZ = nearest(roads.z, point[1]);
  if (Math.abs(x - xroad) <= Math.abs(z - zroad)) {
    path.push([xroad, z], [xroad, endZ], [endX, endZ]);
  } else {
    path.push([x, zroad], [endX, zroad], [endX, endZ]);
  }
  path.push(point);
  return path;
}

export function drawMap(canvas, state = {}, detailed = false) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const k = Math.min(w / (mapBounds.east - mapBounds.west), h / (mapBounds.south - mapBounds.north));
  const left = (x) => (x - mapBounds.west) * k;
  const top = (z) => (z - mapBounds.north) * k;
  const rx = (x, z, width, height, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(left(x), top(z), width * k, height * k);
  };
  const dot = (x, z, radius, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(left(x), top(z), radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const pin = ([x, z], name, color, radius) => {
    dot(x, z, radius, color);
    ctx.save();
    ctx.translate(left(x) - radius * 0.7, top(z) - radius * 0.7);
    ctx.scale((radius * 1.4) / 24, (radius * 1.4) / 24);
    ctx.strokeStyle = '#19142b';
    ctx.lineWidth = 2.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(iconPath(name));
    ctx.restore();
  };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#244363';
  ctx.fillRect(0, 0, w, h);
  for (const [bank, color] of [
    [northBank, '#25213a'],
    [southBank, '#303949'],
  ]) {
    ctx.beginPath();
    bank.forEach(([x, z], i) => (i ? ctx.lineTo(left(x), top(z)) : ctx.moveTo(left(x), top(z))));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (bank === northBank) {
      ctx.save();
      ctx.clip();
      rx(districtBorderX, mapBounds.north, mapBounds.east - districtBorderX, 410, '#28304a');
      ctx.restore();
    }
    ctx.strokeStyle = '#647994';
    ctx.stroke();
  }
  for (const [x, z, width, depth] of wetlandPonds)
    rx(x - width / 2, z - depth / 2, width, depth, '#3e6e73');
  rx(harbor.x1, harbor.z1, harbor.x2 - harbor.x1, harbor.z2 - harbor.z1, '#51334d');
  for (const x of roads.x) rx(x - 6.5, -202, 13, 340, '#5b516e');
  for (const z of roads.z) rx(-182, z - 6.5, 393, 13, '#5b516e');
  ctx.lineWidth = 9 * k;
  ctx.strokeStyle = '#5b516e';
  for (const [[x1, z1], [x2, z2]] of coastRoads) {
    ctx.beginPath();
    ctx.moveTo(left(x1), top(z1));
    ctx.lineTo(left(x2), top(z2));
    ctx.stroke();
  }
  for (const bridge of bridges)
    rx(bridge.x - 5.5, bridge.start, 11, bridge.end - bridge.start, '#b696ae');
  ctx.lineWidth = detailed ? 1.8 : 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#a7dff1';
  ctx.beginPath();
  ferryStops.forEach(({ berth: [x, z] }, index) =>
    index ? ctx.lineTo(left(x), top(z)) : ctx.moveTo(left(x), top(z)),
  );
  ctx.stroke();
  ctx.setLineDash([]);
  if (state.alert?.level && state.alert.lastSeen) {
    const { lastSeen, patrols, left: searchTime, level } = state.alert;
    ctx.strokeStyle = searchTime ? '#9bc8fc' : '#fb83a7';
    if (searchTime) ctx.setLineDash([3, 3]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(left(lastSeen[0]), top(lastSeen[1]), (26 + level * 3) * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const patrol of patrols) {
      if (!patrol.disabled) pin([patrol.x, patrol.z], 'police', '#ff79a7', detailed ? 7 : 6);
    }
  }
  {
    ctx.strokeStyle = state.alert?.restricted ? '#ff85b0' : '#ba9272';
    ctx.strokeRect(
      left(harbor.x1),
      top(harbor.z1),
      (harbor.x2 - harbor.x1) * k,
      (harbor.z2 - harbor.z1) * k,
    );
  }
  if (detailed) {
    ctx.font = '700 ' + Math.round(w * 0.025) + 'px sans-serif';
    ctx.fillStyle = '#c4b1cb';
    for (const [name, x, z] of [
      ['金平区', -121, -124],
      ['龙湖区', 143, -124],
      ['濠江区', 65, 350],
    ]) {
      ctx.fillText(name, left(x), top(z));
    }
    for (const [x, z] of [
      [-169, 20],
      [-61, -109],
      [103, -104],
    ]) {
      ctx.fillText(districtAt(x, z).name, left(x), top(z));
    }
    for (const [point, label, color, name] of [
      ...landmarks
        .filter(({ icon }) => icon !== 'bowl')
        .map(({ point, labelAt, name, color, icon }) => [labelAt || point, name, color, icon]),
      [zones.garage, '车库', '#f7ce7c', 'garage'],
      [zones.training, '训练场', '#83f9df', 'target'],
      [zones.hospital, '潮汐市医院', '#a0ffde', 'hospital'],
      [zones.race, '计时赛', '#83f9df', 'finish'],
      [zones.gang, '街区事件', '#fe7ac4', 'flag'],
      [[75, -82], '西出口', '#ffda9c', 'exit'],
      [[150, -17], '南出口', '#ffda9c', 'exit'],
    ]) {
      pin(point, name, color, 8);
      ctx.fillStyle = color;
      ctx.fillText(label, left(point[0]) + 11, top(point[1]) + 5);
    }
    for (const { point, color, icon } of landmarks.filter(({ icon }) => icon === 'bowl')) {
      pin(point, icon, color, 4);
    }
  } else {
    pin(zones.garage, 'garage', '#f7ce7c', 7);
    pin(zones.hospital, 'hospital', '#a0ffde', 7);
  }
  for (const bike of state.bikes || []) {
    if (detailed || Math.hypot(state.x - bike.x, state.z - bike.z) < 38) {
      pin([bike.x, bike.z], 'bike', '#b5e4ba', detailed ? 6 : 5);
    }
  }
  if (state.target) {
    const path = routeTo(state.x ?? zones.spawn[0], state.z ?? zones.spawn[1], state.target);
    ctx.strokeStyle = '#f6cd83';
    ctx.lineWidth = detailed ? 3 : 1.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(left(state.x ?? zones.spawn[0]), top(state.z ?? zones.spawn[1]));
    for (const [x, z] of path) ctx.lineTo(left(x), top(z));
    ctx.stroke();
    ctx.setLineDash([]);
    dot(...state.target, detailed ? 6 : 4.5, '#ffdc7b');
  }
  if (state.x != null) {
    ctx.save();
    ctx.translate(left(state.x), top(state.z));
    ctx.rotate(state.yaw || 0);
    ctx.fillStyle = '#8bffe9';
    ctx.strokeStyle = '#191124';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-5, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}
