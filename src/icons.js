const paths = {
  user: 'M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2 M12 3a4 4 0 1 0 .01 8 4 4 0 0 0-.01-8',
  coin: 'M12 2a10 10 0 1 0 .01 20A10 10 0 0 0 12 2 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12',
  bell: 'M18 8a6 6 0 0 0-12 0c0 6-2 7-3 8h18c-1-1-3-2-3-8 M10 20a2 2 0 0 0 4 0',
  settings:
    'M12 2l2 3 3-.3 1 3 3 1v4l-3 1-1 3-3-.3-2 3-2-3-3 .3-1-3-3-1v-4l3-1 1-3 3 .3z M12 8a3 3 0 1 0 .01 6 3 3 0 0 0-.01-6',
  car: 'M3 17v-5l2-2 2-5h10l2 5 2 2v5h-2v3h-3v-3H8v3H5v-3z M5 10h14 M6 14h2m8 0h2',
  garage: 'M3 21V8l9-5 9 5v13 M7 21v-9h10v9 M7 15h10m-10 3h10',
  exit: 'M10 20H4V4h6m4 4 4 4-4 4m-6-4h13',
  key: 'M9 14a5 5 0 1 0-3-4.6 5 5 0 0 0 1 3l-4 4V21h4v-3h3v-3l1-1M13 8h.01',
  pedal: 'M9 4h8l-2 15H7L9 4zm2 4h3m-4 4h3m-4 4h3',
  ferry: 'M5 14l7-4 7 4-2 5H7zm2-2V6h10v6m-5-6V3M3 21c2 0 2-1 4-1s2 1 5 1 3-1 5-1 2 1 4 1',
  jump: 'M12 4l-4 4m4-4 4 4m-4-4v10m-6 5h12',
  brake: 'M5 5h14v12H5z M8 9h8m-8 4h8m-4 4v4',
  reverse: 'M4 9v5h5M4 14a8 8 0 1 1 4 5',
  handbrake:
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M2.5 6.5a10.8 10.8 0 0 0 0 11m19-11a10.8 10.8 0 0 1 0 11 M10 16V8h3a2 2 0 0 1 0 4h-3',
  wrench: 'M14 6l3 3 4-4a6 6 0 0 1-7.5 7.5l-7 7a2 2 0 0 1-3-3l7-7A6 6 0 0 1 18 2z',
  heart: 'M20 12c-2.7 3.2-8 7.5-8 7.5S6.7 15.2 4 12C-.5 6.6 6.8 1.6 12 8c5.2-6.4 12.5-1.4 8 4z',
  hospital: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  bowl: 'M3 12h18c0 4.4-3.1 7-9 7s-9-2.6-9-7zm5 7v2h8v-2M6 9c-2-2 2-3 0-5m6 5c-2-2 2-3 0-5m6 5c-2-2 2-3 0-5',
  tea: 'M5 8h12v5a6 6 0 0 1-12 0z M17 9h2a2.5 2.5 0 0 1 0 5h-2M3 21h18M10 5c-2-1 2-2 0-4',
  swim: 'M2 19c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2 M3 14l7-5 4 3 4 1 M18 7a2 2 0 1 0 .01 4A2 2 0 0 0 18 7',
  bike: 'M5 13a4 4 0 1 0 .01 8A4 4 0 0 0 5 13M19 13a4 4 0 1 0 .01 8A4 4 0 0 0 19 13M5 17l4-8 4 8h-8m14 0L15 5h-3m-4 4H6m7 8 3-5',
  police: 'M12 3l2.7 1.5 4.3.3v6c0 4.2-2.9 7.4-7 9.8-4.1-2.4-7-5.6-7-9.8v-6l4.3-.3L12 3z M9 12l2 2 4-4',
  fist: 'M4 13v-3a1.6 1.6 0 0 1 3.2 0V6.6a1.6 1.6 0 0 1 3.2 0v-.9a1.6 1.6 0 0 1 3.2 0V7a1.6 1.6 0 0 1 3.2 0v1.4a1.6 1.6 0 0 1 3.2 0V13c0 2.5-1 4.6-3 5.5V21H8v-2.5C5.5 17.4 4 15.6 4 13zm3.2-3.4 3.6 2.6m-.4-4v2.4M13.6 7v3.7m3.2-2.3v2.8',
  blaster: 'M3 6h18v5h-7l-2 3h-2l-2 5H4l2-8H3z M14 11v3h-4m6-5h3',
  pulse: 'M2 7h4V5h10v2h6v4h-8l-2 3h-2l-2 5H4l2-8H2z M8 8h6m1 3v3h-5',
  magazine: 'M7 4h10v3l-2 12H5L7 7V4zm0 3h10m-8 4h4m-5 4h4m-7 4v2h10v-2',
  sprint: 'M16 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M5 13l3-4 5 1 3 3h4m-7-3-3 5 3 2v4m-3-6-3 4H3',
  target: 'M12 3a9 9 0 1 0 .01 18A9 9 0 0 0 12 3 M12 7a5 5 0 1 0 .01 10A5 5 0 0 0 12 7 M12 11v2',
  map: 'M2 6l7-3 6 3 7-3v15l-7 3-6-3-7 3z M9 3v15m6-12v15',
  gamepad:
    'M7 6h10a4 4 0 0 1 4 3l1 6a3 3 0 0 1-5 3l-3-3h-4l-3 3a3 3 0 0 1-5-3l1-6a4 4 0 0 1 4-3z M5 11h5m-2.5-2.5v5 M16 10h.01m3 2h.01',
  crown: 'M3 6l5 4 4-6 4 6 5-4-2.5 13h-13z M6 16h12',
  gift: 'M3 9h18v4H3z M5 13v8h14v-8 M12 9v12 M12 9C1 9 7 0 12 9c5-9 11 0 0 0',
  ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M9 9h6m-6 3h6m-6 3h3',
  bag: 'M4 8h16l1 13H3z M8 10V6a4 4 0 0 1 8 0v4',
  flag: 'M5 22V3m0 1c5-4 8 4 15 0v10c-7 4-10-4-15 0',
  finish: 'M5 22V3h15v12H5m5-12v12m5-12v12M5 7h15M5 11h15',
  box: 'M3 6l9-3 9 3v12l-9 3-9-3z M3 6l9 3 9-3m-9 3v12m-5-16 9 3',
  home: 'M3 10l9-7 9 7m-2-1v11h-5v-6h-4v6H5V9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  pause: 'M8 5v14m8-14v14',
  bolt: 'M13 2L4 14h7l-1 8 10-12h-8z',
  repeat: 'M4 8h15m-4-4l4 4-4 4M20 16H5m4-4l-4 4 4 4',
  reload: 'M5 8a8 8 0 1 1-1 6 M4 3v6h6',
  fire: 'M12 22a7 7 0 0 1-7-7c0-3 2-5 4-7 0 4 2 3 3 2 2-2 2-5 1-8 5 5 7 9 6 13a7 7 0 0 1-7 7z',
  close: 'M5 5l14 14M19 5L5 19',
  rotate:
    'M8 2h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 17h2 M21 7c3 4 2 8-1 11m0-3v3h3 M3 7C0 10 0 14 3 17',
};
const vectorPaths = new Map();
export function iconPath(name) {
  if (!vectorPaths.has(name)) vectorPaths.set(name, new Path2D(paths[name]));
  return vectorPaths.get(name);
}

const rasters = new Map();
export function setIcon(node, name) {
  if (!paths[name] || node.dataset.renderedIcon === name) return;
  if (!rasters.has(name)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 112;
    const ctx = canvas.getContext('2d');
    ctx.scale(112 / 24, 112 / 24);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.72;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(iconPath(name));
    rasters.set(name, 'url(' + canvas.toDataURL() + ')');
  }
  const mark = node.firstElementChild || document.createElement('span');
  mark.className = 'icon';
  mark.style.maskImage = rasters.get(name);
  mark.style.webkitMaskImage = rasters.get(name);
  if (!mark.parentNode) node.append(mark);
  node.dataset.icon = name;
  node.dataset.renderedIcon = name;
  node.setAttribute('aria-hidden', 'true');
}

export function icons(root = document) {
  for (const node of root.querySelectorAll('i[data-icon]')) setIcon(node, node.dataset.icon);
}
