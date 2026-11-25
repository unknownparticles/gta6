import * as T from 'three';
import { harborFog, harborHaze, sunDirection } from './real-light.js';

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
    uniforms: {
      surfaces: { value: map },
      sun: { value: sunDirection },
      haze: { value: new T.Color(harborHaze) },
      fogDensity: { value: harborFog },
      shadeMap: { value: null },
      shadeBounds: { value: new T.Vector4(0, 0, 1, 1) },
    },
    vertexShader: `
      in vec3 color;
      in vec2 surface;
      out vec2 texCoord;
      out vec3 tint;
      out vec3 outward;
      out vec3 world;
      out float depth;
      flat out float layer;
      void main() {
        texCoord = uv;
        tint = color;
        outward = normal;
        world = (modelMatrix * vec4(position, 1.0)).xyz;
        layer = surface.x;
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        depth = -eye.z;
        gl_Position = projectionMatrix * eye;
        gl_Position.z -= surface.y * 0.00000018 * gl_Position.w;
      }`,
    fragmentShader: `
      precision highp sampler2DArray;
      uniform sampler2DArray surfaces;
      uniform sampler2D shadeMap;
      uniform vec4 shadeBounds;
      uniform vec3 haze, sun;
      uniform float fogDensity;
      in vec2 texCoord;
      in vec3 tint;
      in vec3 outward;
      in vec3 world;
      in float depth;
      flat in float layer;
      out vec4 retroColor;
      #define gl_FragColor retroColor
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * .1031);
        q += dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float surfaceVariation(vec2 p) {
        vec2 base = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(base),hash(base+vec2(1,0)),f.x),
          mix(hash(base+vec2(0,1)),hash(base+1.0),f.x),f.y);
      }
      void main() {
        vec3 normal = normalize(outward) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 base = texture(surfaces, vec3(texCoord.x, -texCoord.y, layer)).rgb * tint;
        float sunlight = max(0.0, dot(normal, sun));
        float horizon = smoothstep(-.08,.95,normal.y);
        vec3 shade = mix(vec3(.43,.48,.62), vec3(.72,.77,.86), horizon);
        float distanceFade = 1.0 - smoothstep(38.0, 150.0, depth);
        float shadow = 1.0;
        if (normal.y > .7 && world.y < 2.0) {
          vec2 shadeUV = (world.xz - shadeBounds.xy) / shadeBounds.zw;
          if (all(greaterThan(shadeUV, vec2(0))) && all(lessThan(shadeUV, vec2(1)))) {
            float edge = min(min(shadeUV.x,1.0-shadeUV.x),min(shadeUV.y,1.0-shadeUV.y));
            shadow = 1.0 - texture(shadeMap, vec2(shadeUV.x,1.0-shadeUV.y)).r *
              smoothstep(0.0, .035, edge) * .78;
          }
        }
        vec3 color = base * (shade * mix(.76,1.0,shadow) + vec3(1.21,.78,.48) * sunlight * shadow);
        if (distanceFade > .0 && ((layer > .5 && layer < 3.5) || layer > 3.5)) {
          float weathered = surfaceVariation(world.xz * .13 + world.y * .21);
          float grain = surfaceVariation(world.xz * 3.4 + world.y * 4.2);
          if (layer > 1.5 && layer < 3.5 && normal.y > .82) {
            float wet = smoothstep(.31,.73,weathered*.74 + grain*.26);
            vec3 view = normalize(cameraPosition-world);
            vec3 ripple = normal;
            ripple.xz += vec2(grain-.5,weathered-.5) * .24;
            float towardLight = max(0.0,dot(reflect(-view, normalize(ripple)),sun));
            float sheen = pow(1.0 - max(view.y,0.0), 3.0);
            color *= 1.0 - .26 * wet * distanceFade;
            color += distanceFade * wet * vec3(.12,.16,.19) * sheen * .6;
            color += distanceFade * wet * shadow * vec3(1.05,.64,.31) * pow(towardLight,14.0) * .35;
          } else {
            color *= mix(1.0, .84 + weathered*.27 + grain*.07, distanceFade);
            if (layer > 3.5 && abs(normal.y) < .35) {
              float luma = dot(base, vec3(.2126,.7152,.0722));
              float panes = smoothstep(.02,.12,base.b-base.r) * (1.0-smoothstep(.1,.34,luma));
              vec3 sight = normalize(cameraPosition-world);
              float angle = 1.0 - max(dot(sight,normal),0.0);
              color += panes * angle * vec3(.035,.067,.089) * distanceFade;
            }
          }
        }
        gl_FragColor = vec4(mix(color, haze, 1.0 - exp(-pow(max(depth,0.)*fogDensity,2.))), 1.0);
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
