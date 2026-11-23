import { districtAt, harbor, roads, zones } from './data.js';

export const distance = (x, z, point) => Math.hypot(x - point[0], z - point[1]);
export const inHarbor = (x, z) => x >= harbor.x1 && x <= harbor.x2 && z >= harbor.z1 && z <= harbor.z2;
export const direction = (x, z, point) => Math.atan2(x - point[0], z - point[1]);
const nearest = (list, value) =>
  list.reduce((a, b) => (Math.abs(a - value) < Math.abs(b - value) ? a : b));

export function routeTo(x, z, point) {
  const path = [];
  if (!point) return path;
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
  const k = w / 435;
  const left = (x) => (x + 203) * k;
  const top = (z) => ((z + 217) * h) / 435;
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
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#19142b';
  ctx.fillRect(0, 0, w, h);
  rx(-203, -217, 20, 435, '#27405c');
  rx(-183, -217, 413, 15, '#27405c');
  rx(harbor.x1, harbor.z1, harbor.x2 - harbor.x1, harbor.z2 - harbor.z1, '#51334d');
  for (const x of roads.x) rx(x - 6.5, -202, 13, 403, '#5b516e');
  for (const z of roads.z) rx(-182, z - 6.5, 393, 13, '#5b516e');
  if (state.alert?.level && state.alert.center) {
    ctx.strokeStyle = '#fb83a7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(left(state.alert.center[0]), top(state.alert.center[1]), 41 * k, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = state.alert?.level ? '#ff85b0' : '#ba9272';
    ctx.strokeRect(
      left(harbor.x1),
      top(harbor.z1),
      (harbor.x2 - harbor.x1) * k,
      (harbor.z2 - harbor.z1) * k,
    );
  }
  if (detailed) {
    ctx.font = '700 ' + Math.round(w * 0.031) + 'px sans-serif';
    ctx.fillStyle = '#c4b1cb';
    for (const [x, z] of [
      [-169, 20],
      [-61, -109],
      [103, -104],
    ]) {
      ctx.fillText(districtAt(x, z).name, left(x), top(z));
    }
    for (const [point, label, color] of [
      [zones.garage, '车库', '#f7ce7c'],
      [zones.race, '计时赛', '#83f9df'],
      [zones.gang, '街区事件', '#fe7ac4'],
      [[75, -82], '西出口', '#ffda9c'],
      [[150, -17], '南出口', '#ffda9c'],
    ]) {
      dot(...point, 4.5, color);
      ctx.fillStyle = color;
      ctx.fillText(label, left(point[0]) + 8, top(point[1]) + 5);
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
