import * as T from 'three';

export const sunDirection = new T.Vector3(-0.49, 0.25, -0.84).normalize();
export const harborHaze = 0xc6a79c;
export const harborFog = 0.00046;

const skyColor = `
  vec3 harborSky(vec3 ray, vec3 sun) {
    float altitude = max(ray.y, 0.0);
    float incidence = max(dot(ray, sun), 0.0);
    vec3 horizon = mix(vec3(.34,.42,.52), vec3(.78,.49,.29), pow(incidence, 2.0));
    vec3 color = mix(horizon, vec3(.065,.15,.29), smoothstep(-.02,.69,altitude));
    return color + vec3(1.0,.61,.32) * (pow(incidence, 34.0) * .65 + pow(incidence, 210.0) * .55);
  }
`;

const noise = `
  float harborHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float harborNoise(vec2 p) {
    vec2 tile = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(harborHash(tile), harborHash(tile+vec2(1,0)), f.x),
      mix(harborHash(tile+vec2(0,1)), harborHash(tile+1.0), f.x), f.y);
  }
`;

export function lightRealCity(scene) {
  scene.background = new T.Color(harborHaze);
  scene.fog = new T.FogExp2(harborHaze, harborFog);
  scene.add(new T.HemisphereLight(0xc6dbfa, 0x74635f, 1.65));
  const sun = new T.DirectionalLight(0xffd09b, 2.12);
  sun.position.copy(sunDirection);
  scene.add(sun);
  const sky = new T.Mesh(
    new T.SphereGeometry(60, 28, 14),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { sun: { value: sunDirection } },
      vertexShader: `
        varying vec3 ray;
        void main() {
          ray = position;
          vec4 clip = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
          gl_Position = clip.xyww;
        }`,
      fragmentShader: `
        varying vec3 ray;
        uniform vec3 sun;
        ${skyColor}
        ${noise}
        void main() {
          vec3 dir = normalize(ray);
          float height = max(dir.y, 0.0);
          float toSun = max(dot(dir, sun), 0.0);
          vec3 color = harborSky(dir, sun);
          vec2 clouds = dir.xz / (height + .24) * vec2(4.3, 6.6);
          clouds += vec2(7.1, -1.4);
          float cover = harborNoise(clouds) * .66 + harborNoise(clouds * 2.2) * .25 +
            harborNoise(clouds * 5.1) * .09;
          float opacity = smoothstep(.41,.69,cover) * smoothstep(0.0,.21,height);
          vec3 cloud = mix(vec3(.135,.17,.24), vec3(.79,.43,.25), pow(toSun, 3.0));
          cloud *= .72 + .53 * smoothstep(.44,.73,cover);
          color = mix(color, cloud, opacity * .79);
          color += vec3(1.0,.74,.46) * smoothstep(.99966,.9999,toSun) * (4.0 - opacity * 2.5);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  scene.add(sky);
}

export function makeHarborWater() {
  return new T.ShaderMaterial({
    uniforms: {
      sun: { value: sunDirection },
      haze: { value: new T.Color(harborHaze) },
      fog: { value: harborFog },
      time: { value: 0 },
      motion: { value: 1 },
    },
    vertexShader: `
      varying vec3 surface;
      varying float depth;
      void main() {
        surface = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        depth = -eye.z;
        gl_Position = projectionMatrix * eye;
      }`,
    fragmentShader: `
      uniform vec3 sun, haze;
      uniform float fog, time, motion;
      varying vec3 surface;
      varying float depth;
      ${skyColor}
      void main() {
        vec3 eye = normalize(cameraPosition - surface);
        float t = time * motion;
        vec2 point = surface.xz;
        float detail = mix(1.0, .46, smoothstep(45.0, 580.0, depth));
        vec2 ripples = vec2(
          sin(dot(point, vec2(1.1,.44)) + 1.9*t) + .41 * sin(point.y*2.25 - 1.6*t),
          cos(dot(point, vec2(.27,1.42)) - 1.22*t) + .47 * sin(point.x*2.55 + 1.1*t)
        );
        vec3 normal = normalize(vec3(ripples.x * .11 * detail, 1.0, ripples.y * .11 * detail));
        vec3 reflection = reflect(-eye, normal);
        float fresnel = pow(1.0 - max(dot(normal, eye), 0.0), 3.0);
        vec3 water = vec3(.045,.128,.153) * (.91 + .13 * sin(point.x*.042+point.y*.019+t*.27));
        vec3 color = mix(water, harborSky(reflection, sun), .24 + fresnel * .58);
        float reflectionSun = max(dot(reflection, sun), 0.0);
        color += vec3(1.0,.61,.31) * pow(reflectionSun, mix(124.0,32.0,fresnel)) * .97;
        float distanceFog = 1.0 - exp(-pow(depth*fog,2.0));
        gl_FragColor = vec4(mix(color, haze, distanceFog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
