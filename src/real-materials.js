import * as T from 'three';

function repeat(texture, renderer) {
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function facade(renderer, backing, design) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (backing) ctx.drawImage(backing, 0, 0, 192, 192);
  else {
    ctx.fillStyle = '#d6d3cc';
    ctx.fillRect(0, 0, 192, 192);
  }
  function box(x, y, w, h, tone) {
    ctx.fillStyle = tone;
    ctx.fillRect(x, y, w, h);
  }
  function glass(x, y, w, h) {
    box(x - 5, y - 4, w + 10, h + 10, '#554b40');
    const gradient = ctx.createLinearGradient(x, y, x + w * 0.8, y + h);
    gradient.addColorStop(0, '#93a6ab');
    gradient.addColorStop(0.55, '#657e86');
    gradient.addColorStop(1, '#364c58');
    box(x, y, w, h, gradient);
    box(x + w / 2 - 2, y, 4, h, '#c4c1ae');
    box(x, y + h * 0.46, w, 3, '#adb4ad');
  }

  if (design === 'shop') {
    box(14, 19, 164, 29, '#6e5e4c');
    box(14, 23, 164, 2, '#b9a47a');
    box(17, 54, 158, 132, '#665446');
    glass(24, 64, 100, 109);
    box(130, 64, 35, 109, '#796144');
    for (let x = 136; x < 165; x += 8) box(x, 69, 2, 92, '#4a3b36');
    box(0, 184, 192, 8, '#aaa49b');
  } else if (design === 'historic') {
    box(0, 10, 192, 5, '#9c8f7b');
    box(0, 15, 192, 6, '#eee3c9');
    box(13, 20, 16, 166, '#e6dac5');
    box(163, 20, 16, 166, '#e1d1b8');
    glass(47, 49, 98, 98);
    box(39, 41, 114, 8, '#c2a987');
    box(39, 150, 114, 7, '#eee1c7');
    box(0, 177, 192, 9, '#c6b497');
  } else if (design === 'modern') {
    glass(16, 16, 160, 142);
    box(0, 164, 192, 13, '#b8b6b0');
    box(0, 180, 192, 9, '#a8a6a1');
  } else {
    glass(46, 43, 101, 94);
    box(40, 142, 113, 7, '#b8b6a9');
    box(0, 177, 192, 4, '#a49c90');
  }
  return repeat(new T.CanvasTexture(canvas), renderer);
}

export async function loadRealMaterials(renderer) {
  const loader = new T.TextureLoader();
  async function read(file) {
    return loader
      .loadAsync(import.meta.env.BASE_URL + 'media/streets/' + file + '.webp')
      .then((texture) => repeat(texture, renderer))
      .catch(() => null);
  }
  const [asphalt, concrete, paving] = await Promise.all([
    read('asphalt'),
    read('concrete'),
    read('paving'),
  ]);
  const solid = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  const material = (map, offset) => {
    const options =
      offset === undefined
        ? {}
        : {
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: offset,
          };
    return new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, map, ...options });
  };
  return {
    solid,
    ground: material(concrete),
    concrete: material(concrete),
    waterFeature: material(null, -2),
    elevation: material(concrete, -1),
    green: material(null, -2),
    quay: material(paving, -2),
    road: material(asphalt, -3),
    bridge: material(asphalt),
    marking: material(null, -6),
    shop: material(facade(renderer, concrete?.image, 'shop')),
    historic: material(facade(renderer, concrete?.image, 'historic')),
    modern: material(facade(renderer, concrete?.image, 'modern')),
    residence: material(facade(renderer, concrete?.image, 'residence')),
  };
}
