import * as T from 'three';

const sunDirection = new T.Vector3(-0.57, 0.72, 0.38).normalize();

export function lightRealCity(renderer, scene, low) {
  scene.background = new T.Color(0xaac9df);
  scene.fog = new T.Fog(0xb5cddd, 1250, 9400);
  scene.add(new T.HemisphereLight(0xe3f0ff, 0x9a8b78, 1.25));
  const sun = new T.DirectionalLight(0xffe3bd, 2.25);
  sun.castShadow = true;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.16;
  sun.shadow.intensity = 0.78;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 680;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  scene.add(sun, sun.target);

  // Bake the sky once. The main scene only samples the panorama.
  const panorama = new T.WebGLRenderTarget(low() ? 768 : 1536, low() ? 384 : 768, {
    type: T.HalfFloatType,
    depthBuffer: false,
  });
  const bake = new T.Scene();
  const quad = new T.Mesh(
    new T.PlaneGeometry(2, 2),
    new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: { sunDirection: { value: sunDirection } },
      vertexShader: `
      varying vec2 texCoord;
      void main() {
        texCoord = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
      fragmentShader: `
        varying vec2 texCoord;
        uniform vec3 sunDirection;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
            mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
        }
        float clouds(vec2 p) {
          return noise(p) * .55 + noise(p * 2.04 + 3.8) * .27 +
            noise(p * 4.12 + 7.1) * .13 + noise(p * 8.30 + 1.2) * .05;
        }
        void main() {
          float az = (texCoord.x - 0.5) * 6.2831853;
          float angle = (texCoord.y - 0.5) * 3.14159265;
          vec3 d = vec3(cos(az) * cos(angle), sin(angle), sin(az) * cos(angle));
          float elevation = max(0.0, d.y);
          vec3 blue = mix(vec3(.46,.63,.78), vec3(.075,.28,.63), smoothstep(.0,.79,elevation));
          blue = mix(vec3(.43,.58,.66), blue, smoothstep(-.12,.02,d.y));
          float sunlight = max(0.0, dot(d, sunDirection));
          blue += vec3(.95,.72,.44) * (pow(sunlight, 18.0) * .27 + pow(sunlight, 1300.0) * 2.1);
          vec2 p = d.xz / (elevation + .13) * 2.28 + vec2(2.0, 7.0);
          float body = clouds(p);
          float density = smoothstep(.51,.71,body) * smoothstep(.015,.23,d.y);
          float light = smoothstep(-.04,.105,body - clouds(p + sunDirection.xz * .34));
          vec3 cloud = mix(vec3(.58,.68,.80), vec3(1.15,1.12,1.04), light);
          gl_FragColor = vec4(mix(blue, cloud, density), 1.0);
        }`,
    }),
  );
  quad.frustumCulled = false;
  bake.add(quad);
  const target = renderer.getRenderTarget();
  renderer.setRenderTarget(panorama);
  renderer.render(bake, new T.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(target);
  quad.geometry.dispose();
  quad.material.dispose();
  const sky = new T.Mesh(
    new T.SphereGeometry(100, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { panorama: { value: panorama.texture } },
      vertexShader: `
        varying vec3 ray;
        void main() {
          ray = position;
          vec4 clip = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
          gl_Position = clip.xyww;
        }`,
      fragmentShader: `
        varying vec3 ray;
        uniform sampler2D panorama;
        void main() {
          vec3 d = normalize(ray);
          vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(d.y) / 3.14159265 + 0.5);
          gl_FragColor = texture2D(panorama, uv);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  scene.add(sky);

  const probe = new T.Scene();
  const probeSky = sky.clone();
  probe.add(probeSky);
  const generator = new T.PMREMGenerator(renderer);
  const environment = generator.fromScene(probe, 0.035, 0.1, 150);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.57;
  generator.dispose();

  let stamp = '';
  return function updateShadow(x, z, altitude, flying) {
    const near = !flying || altitude < 120;
    const snappedX = Math.round(x / 32) * 32;
    const snappedZ = Math.round(z / 32) * 32;
    const compact = low();
    const radius = near ? (compact ? 73 : 112) : 205;
    const tile = [snappedX, snappedZ, radius, compact].join('/');
    if (tile === stamp) return;
    stamp = tile;
    const resolution = compact ? 512 : 1536;
    if (sun.shadow.map && sun.shadow.map.width !== resolution) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    sun.shadow.mapSize.set(resolution, resolution);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -radius;
    sun.shadow.camera.right = sun.shadow.camera.top = radius;
    sun.shadow.camera.updateProjectionMatrix();
    sun.target.position.set(snappedX, Math.min(90, altitude) * 0.45, snappedZ);
    sun.position.copy(sun.target.position).addScaledVector(sunDirection, 320);
    sun.target.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
  };
}
