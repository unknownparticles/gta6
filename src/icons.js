const paths = {
  user: 'M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2 M12 3a4 4 0 1 0 .01 8 4 4 0 0 0-.01-8',
  coin: 'M12 2a10 10 0 1 0 .01 20A10 10 0 0 0 12 2 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12',
  bell: 'M18 8a6 6 0 0 0-12 0c0 6-2 7-3 8h18c-1-1-3-2-3-8 M10 20a2 2 0 0 0 4 0',
  settings:
    'M12 2l2 3 3-.3 1 3 3 1v4l-3 1-1 3-3-.3-2 3-2-3-3 .3-1-3-3-1v-4l3-1 1-3 3 .3z M12 8a3 3 0 1 0 .01 6 3 3 0 0 0-.01-6',
  car: 'M3 17v-5l2-2 2-5h10l2 5 2 2v5h-2v3h-3v-3H8v3H5v-3z M5 10h14 M6 14h2m8 0h2',
  target: 'M12 3a9 9 0 1 0 .01 18A9 9 0 0 0 12 3 M12 7a5 5 0 1 0 .01 10A5 5 0 0 0 12 7 M12 11v2',
  map: 'M2 6l7-3 6 3 7-3v15l-7 3-6-3-7 3z M9 3v15m6-12v15',
  gamepad:
    'M7 6h10a4 4 0 0 1 4 3l1 6a3 3 0 0 1-5 3l-3-3h-4l-3 3a3 3 0 0 1-5-3l1-6a4 4 0 0 1 4-3z M5 11h5m-2.5-2.5v5 M16 10h.01m3 2h.01',
  crown: 'M3 6l5 4 4-6 4 6 5-4-2.5 13h-13z M6 16h12',
  gift: 'M3 9h18v4H3z M5 13v8h14v-8 M12 9v12 M12 9C1 9 7 0 12 9c5-9 11 0 0 0',
  ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M9 9h6m-6 3h6m-6 3h3',
  bag: 'M4 8h16l1 13H3z M8 10V6a4 4 0 0 1 8 0v4',
  flag: 'M5 22V3m0 1c5-4 8 4 15 0v10c-7 4-10-4-15 0',
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
const rasters = new Map();
export function icons(root = document) {
  for (const node of root.querySelectorAll('i[data-icon]')) {
    const name = node.dataset.icon;
    if (node.firstElementChild || !paths[name]) continue;
    if (!rasters.has(name)) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 112;
      const ctx = canvas.getContext('2d');
      ctx.scale(112 / 24, 112 / 24);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.72;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(paths[name]));
      rasters.set(name, 'url(' + canvas.toDataURL() + ')');
    }
    const mark = document.createElement('span');
    mark.className = 'icon';
    mark.style.maskImage = rasters.get(name);
    mark.style.webkitMaskImage = rasters.get(name);
    node.append(mark);
  }
}
