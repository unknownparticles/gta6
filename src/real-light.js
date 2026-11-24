import * as T from 'three';

export function lightRealCity(scene) {
  scene.background = new T.Color(0xe5a6a7);
  scene.fog = new T.FogExp2(0xd79ca7, 0.00057);
  scene.add(new T.HemisphereLight(0xffeceb, 0x7278a0, 1.7));
  const sun = new T.DirectionalLight(0xffcf9f, 1.65);
  sun.position.set(-0.7, 0.47, 0.53);
  scene.add(sun);
  const sky = new T.Mesh(
    new T.SphereGeometry(60, 28, 14),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 ray;
        void main() {
          ray = position;
          vec4 clip = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
          gl_Position = clip.xyww;
        }`,
      fragmentShader: `
        varying vec3 ray;
        void main() {
          vec3 direction = normalize(ray);
          float height = max(0.0, direction.y);
          vec3 sky = mix(vec3(.83,.40,.33), vec3(.48,.23,.48), smoothstep(0.,.39,height));
          sky = mix(sky, vec3(.11,.23,.51), smoothstep(.26,.90,height));
          float sun = max(0.0, dot(direction, normalize(vec3(-.73,.09,-.37))));
          sky += vec3(.96,.55,.27) * (pow(sun,22.)*.28 + smoothstep(.9986,.9993,sun)*1.85);
          float stripe = sin(direction.y*48. + sin(direction.x*5.4 + direction.z*2.)*1.4);
          float wisps = smoothstep(.75,.995,stripe) *
            smoothstep(.04,.16,height) * (1.-smoothstep(.16,.38,height));
          sky += vec3(.28,.10,.09)*wisps;
          gl_FragColor = vec4(sky, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  scene.add(sky);
}
