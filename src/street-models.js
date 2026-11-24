import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export async function loadDetailModels(renderer) {
  const base = import.meta.env.BASE_URL;
  const textures = new KTX2Loader().setWorkerLimit(2).detectSupport(renderer);
  if (import.meta.env.DEV)
    textures.setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/');
  const loader = new GLTFLoader().setKTX2Loader(textures).setMeshoptDecoder(MeshoptDecoder);
  try {
    const models = await Promise.all(
      ['walker', 'motor-scooter', 'electric-gt', 'plane-tree'].map(async (name) => {
        const model = await loader.loadAsync(base + 'media/street-models/' + name + '.glb');
        return [name, model];
      }),
    );
    return Object.fromEntries(models);
  } finally {
    textures.dispose();
  }
}

export function detailedRide(model, type) {
  const scooter = type === 'ebike';
  const group = new T.Group();
  const body = model.scene.clone();
  body.rotation.y = Math.PI;
  group.add(body);
  const bounds = new T.Box3().setFromObject(body);
  body.position.y = -bounds.min.y;
  body.updateMatrixWorld(true);
  const wheels = (
    scooter ? ['wheel_F', 'wheel_R'] : ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR']
  ).map((name) => body.getObjectByName(name));
  const rest = wheels.map((wheel) => wheel.quaternion.clone());
  const fork = body.getObjectByName('fork');
  const forkRest = fork?.quaternion.clone();
  const stand = body.getObjectByName('kickstand');
  if (stand) stand.visible = false;
  const axle = new T.Vector3(1, 0, 0);
  const vertical = new T.Vector3(0, 1, 0);
  const rotation = new T.Quaternion();
  let spin = 0;

  const shadow = new T.Mesh(
    new T.CircleGeometry(1, 20),
    new T.MeshBasicMaterial({
      color: 0x191c20,
      transparent: true,
      opacity: 0.31,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.15;
  shadow.scale.set(scooter ? 0.42 : 1.05, scooter ? 0.86 : 2.24, 1);
  group.add(shadow);
  function articulate(speed, steering, dt) {
    spin = (spin + (speed * dt) / (scooter ? 0.23 : 0.35)) % (2 * Math.PI);
    if (fork)
      fork.quaternion
        .copy(forkRest)
        .premultiply(rotation.setFromAxisAngle(vertical, steering * 0.35));
    wheels.forEach((wheel, index) => {
      const sign = !scooter && index % 2 ? -1 : 1;
      wheel.quaternion.copy(rest[index]).multiply(rotation.setFromAxisAngle(axle, spin * sign));
      if (!scooter && index < 2) {
        wheel.quaternion.premultiply(rotation.setFromAxisAngle(vertical, steering * 0.31));
      }
    });
  }
  return { group, articulate, wheels };
}

const hipsName = 'hips';
const limbs = ['thigh', 'calf', 'foot', 'upperarm', 'forearm', 'hand'];

export function streetWalker(model) {
  const group = new T.Group();
  const body = model.scene;
  body.rotation.y = Math.PI;
  group.add(body);
  body.traverse((part) => {
    if (part.isSkinnedMesh) part.frustumCulled = false;
  });
  const bones = Object.fromEntries(
    [hipsName, 'spine', 'spine1', ...limbs.flatMap((part) => [part + '_L', part + '_R'])].map(
      (name) => [name, body.getObjectByName(name)],
    ),
  );
  const hips = bones[hipsName];
  const animationPose = Object.values(bones).map((bone) => ({
    bone,
    position: bone.position.clone(),
    rotation: bone.quaternion.clone(),
  }));
  const mixer = new T.AnimationMixer(body);
  const idle = mixer.clipAction(model.animations.find((clip) => clip.name === 'idle')).play();
  const walk = mixer.clipAction(model.animations.find((clip) => clip.name === 'walk')).play();
  let stride = 0;
  let pose = 0;
  const jointRotation = new T.Quaternion();
  const parentRotation = new T.Quaternion();
  const flatSole = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, Math.PI, 0));
  const current = new T.Vector3();
  const desired = new T.Vector3();
  const origin = new T.Vector3();
  const middle = new T.Vector3();
  const target = new T.Vector3();
  const axis = new T.Vector3();
  const pole = new T.Vector3();

  function steerBone(upper, lower, toward, weight) {
    upper.getWorldPosition(origin);
    lower.getWorldPosition(current).sub(origin).normalize();
    desired.copy(toward).sub(origin).normalize();
    jointRotation.setFromUnitVectors(current, desired);
    upper.parent.getWorldQuaternion(parentRotation);
    jointRotation
      .premultiply(parentRotation.invert())
      .multiply(parentRotation.invert())
      .multiply(upper.quaternion);
    upper.quaternion.slerp(jointRotation, weight);
    upper.updateWorldMatrix(false, true);
  }

  function placeLimb(first, second, tip, goal, bend, weight) {
    first.getWorldPosition(origin);
    axis.copy(goal).sub(origin);
    const firstLength = second.position.length();
    const secondLength = tip.position.length();
    const distance = T.MathUtils.clamp(axis.length(), 0.08, firstLength + secondLength - 0.012);
    axis.normalize();
    pole.copy(bend).addScaledVector(axis, -bend.dot(axis)).normalize();
    const along = (firstLength ** 2 - secondLength ** 2 + distance ** 2) / (2 * distance);
    middle
      .copy(origin)
      .addScaledVector(axis, along)
      .addScaledVector(pole, Math.sqrt(Math.max(0, firstLength ** 2 - along ** 2)));
    steerBone(first, second, middle, weight);
    steerBone(second, tip, goal, weight);
  }

  const bend = new T.Vector3();
  function animate({ speed, airborne, riding, steer = 0, dt }) {
    // The mixer can skip writing a track whose value did not change this frame.
    for (const { bone, position, rotation } of animationPose) {
      bone.position.copy(position);
      bone.quaternion.copy(rotation);
    }
    stride = T.MathUtils.lerp(
      stride,
      T.MathUtils.smoothstep(speed, 0.24, 1.55),
      1 - Math.exp(-11 * dt),
    );
    pose = T.MathUtils.lerp(pose, riding || airborne ? 1 : 0, 1 - Math.exp(-14 * dt));
    idle.setEffectiveWeight(1 - stride);
    walk.setEffectiveWeight(stride);
    walk.setEffectiveTimeScale(T.MathUtils.lerp(0.75, 2.3, Math.min(speed / 6, 1)));
    mixer.update(dt);
    for (const { bone, position, rotation } of animationPose) {
      position.copy(bone.position);
      rotation.copy(bone.quaternion);
    }

    if (riding || airborne) {
      if (riding) {
        hips.position.y += (0.8 - hips.position.y) * pose;
        hips.position.z -= 0.14 * pose;
        hips.rotateX(0.14 * pose);
        bones.spine.rotateX(0.2 * pose);
      } else {
        hips.rotateX(0.08 * pose);
      }
      group.updateWorldMatrix(true, true);
      for (const side of ['L', 'R']) {
        const sign = side === 'L' ? -1 : 1;
        const bone = (part) => bones[part + '_' + side];
        if (riding) {
          group.localToWorld(target.set(sign * 0.32, 1.1, -0.19 + sign * steer * 0.1));
          bend.set(sign * 0.54, -1, -0.3).transformDirection(group.matrixWorld);
          placeLimb(bone('upperarm'), bone('forearm'), bone('hand'), target, bend, pose);
          group.localToWorld(target.set(sign * 0.16, 0.36, -0.31));
        } else {
          group.localToWorld(
            target.set(sign * 0.14, 0.19 + Number(side === 'L') * 0.1, side === 'L' ? -0.16 : 0.13),
          );
          bone('forearm').rotateX((side === 'L' ? 0.4 : 0.27) * pose);
        }
        bend.set(0, 0, -1).transformDirection(group.matrixWorld);
        placeLimb(bone('thigh'), bone('calf'), bone('foot'), target, bend, pose);
        if (riding) {
          // Keep the soles level instead of following the shins into the footboard.
          group.getWorldQuaternion(jointRotation);
          jointRotation.multiply(flatSole);
          bone('foot').parent.getWorldQuaternion(parentRotation);
          jointRotation.premultiply(parentRotation.invert());
          bone('foot').quaternion.slerp(jointRotation, pose);
        }
      }
    } else if (speed > 5.1) {
      hips.rotateX(Math.min(0.13, (speed - 5.1) * 0.039));
      bones.spine1.rotateX(0.075);
    }
  }
  return { group, animate };
}

export function addStreetTrees(scene, model, points, terrain) {
  const source = model.scene;
  source.updateMatrixWorld(true);
  const regions = new Map();
  points.forEach(([x, z], index) => {
    const key = Math.floor(x / 280) + ':' + Math.floor(z / 280);
    if (!regions.has(key)) regions.set(key, []);
    regions.get(key).push({ x, z, index });
  });
  const placement = new T.Object3D();
  const matrix = new T.Matrix4();
  source.traverse((part) => {
    if (!part.isMesh) return;
    for (const region of regions.values()) {
      const trees = new T.InstancedMesh(part.geometry, part.material, region.length);
      region.forEach(({ x, z, index }, i) => {
        const scale = 0.31 + ((index * 17) % 13) * 0.013;
        placement.position.set(x, terrain(x, z) + 0.08, z);
        placement.rotation.y = (index * 2.39996) % (Math.PI * 2);
        placement.scale.set(scale, scale, scale);
        placement.updateMatrix();
        trees.setMatrixAt(i, matrix.multiplyMatrices(placement.matrix, part.matrixWorld));
      });
      trees.computeBoundingSphere();
      trees.receiveShadow = true;
      scene.add(trees);
    }
  });
}
