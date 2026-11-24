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

export const cityLayers = {
  solid: 0,
  ground: 1,
  concrete: 1,
  elevation: 1,
  road: 2,
  bridge: 2,
  quay: 3,
  shop: 4,
  historic: 5,
  modern: 6,
  residence: 7,
  green: 0,
  marking: 0,
  waterFeature: 0,
};

const depthOffsets = { elevation: 1, green: 2, waterFeature: 2, quay: 2, road: 3, marking: 6 };
export const cityDepthOffset = (layer) => depthOffsets[layer] ?? 0;

function cityBatchMaterial(images) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = new Uint8Array(size * size * 4 * images.length);
  for (const [index, image] of images.entries()) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    if (image) ctx.drawImage(image, 0, 0, size, size);
    pixels.set(ctx.getImageData(0, 0, size, size).data, index * size * size * 4);
  }
  const map = new T.DataArrayTexture(pixels, size, size, images.length);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return new T.ShaderMaterial({
    glslVersion: T.GLSL3,
    side: T.DoubleSide,
    uniforms: { surfaces: { value: map }, haze: { value: new T.Color(0xd79ca7) } },
    vertexShader: `
      in vec3 color;
      in vec2 surface;
      out vec2 texCoord;
      out vec3 tint;
      out vec3 outward;
      out float depth;
      flat out float layer;
      void main() {
        texCoord = uv;
        tint = color;
        outward = normal;
        layer = surface.x;
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        depth = -eye.z;
        gl_Position = projectionMatrix * eye;
        gl_Position.z -= surface.y * 0.00000018 * gl_Position.w;
      }`,
    fragmentShader: `
      precision highp sampler2DArray;
      uniform sampler2DArray surfaces;
      uniform vec3 haze;
      in vec2 texCoord;
      in vec3 tint;
      in vec3 outward;
      in float depth;
      flat in float layer;
      out vec4 retroColor;
      #define gl_FragColor retroColor
      void main() {
        vec3 normal = normalize(outward) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 color = texture(surfaces, vec3(texCoord.x, -texCoord.y, layer)).rgb * tint;
        float sunlight = max(0.0, dot(normal, normalize(vec3(-.70,.47,.53))));
        vec3 shading = mix(vec3(.54,.56,.70), vec3(.91,.84,.82), normal.y*.5+.5);
        color *= shading + vec3(.69,.51,.37)*sunlight;
        gl_FragColor = vec4(mix(color, haze, 1.0 - exp(-pow(max(depth,0.)*.00057,2.))), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
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
  const material = (map) =>
    new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, map });
  const shop = facade(renderer, concrete?.image, 'shop');
  const historic = facade(renderer, concrete?.image, 'historic');
  const modern = facade(renderer, concrete?.image, 'modern');
  const residence = facade(renderer, concrete?.image, 'residence');
  return {
    batch: cityBatchMaterial([
      null,
      concrete?.image,
      asphalt?.image,
      paving?.image,
      shop.image,
      historic.image,
      modern.image,
      residence.image,
    ]),
    shop: material(shop),
    historic: material(historic),
  };
}
