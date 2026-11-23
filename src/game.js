import * as T from 'three';
import { cars, districtAt, paints, raceRoute, roads, weapons, zones } from './data.js';
import { createInput } from './input.js';
import { distance, direction, drawMap, inHarbor, routeTo } from './map.js';
import { loadModels, makeCity, personModel, vehicleModel } from './world.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angle = (value) => Math.atan2(Math.sin(value), Math.cos(value));
const now = () => performance.now();
const freshAlert = () => ({ level: 0, center: null, inside: 0, escape: 0, caught: 0, patrols: [] });
const clockText = (value) => value.toFixed(2) + ' 秒';
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const patrolOrigins = [
  [149, -142],
  [72, -82],
  [-78, -10],
  [72, 62],
  [149, -10],
  [-151, 135],
];
const targetPositions = [
  [17, 77],
  [21, 77],
  [25, 77],
];
const inspect = import.meta.env.DEV && new URLSearchParams(location.search).has('inspect');
const info = {
  take: ['夜班急件 · 1 / 3', '领取备用灯控盒', '在路边领取包裹，然后上车', zones.garage],
  check: ['夜班急件 · 2 / 3', '到货场岗亭登记', '到达目标处减速，点击交互', zones.check],
  raid: ['夜班急件 · 2 / 3', '驶入货场警戒区', '通过货场的黄线，触发警戒', zones.raid],
  escape: ['夜班急件 · 2 / 3', '脱离港区警戒', '从西出口或南出口驶离警戒区', null],
  deliver: ['夜班急件 · 3 / 3', '把灯控盒带回车库', '警戒解除后，在车库旁交付', zones.delivery],
};

export async function createGame({ stage, touch, store, audio, callbacks, onLoad }) {
  const canvas = stage.querySelector('#world');
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  onLoad('正在加载车辆和港区模型');
  await loadModels();
  onLoad('正在布置城市道路');
  const scene = new T.Scene();
  const city = makeCity(scene);
  const camera = new T.PerspectiveCamera(60, 1, 0.18, 510);
  const cameraTarget = new T.Vector3();
  const cameraWanted = new T.Vector3();
  const shotOrigin = new T.Vector3();
  const shotDirection = new T.Vector3();
  const focus = new T.Vector3();
  const playerModel = personModel(0xe563b9, 1);
  scene.add(playerModel.group);

  const marker = new T.Group();
  const markerRing = new T.Mesh(
    new T.RingGeometry(2.2, 2.47, 32),
    new T.MeshBasicMaterial({ color: 0xffd476, side: T.DoubleSide }),
  );
  markerRing.rotation.x = -Math.PI / 2;
  markerRing.position.y = 0.11;
  const markerColumn = new T.Mesh(
    new T.CylinderGeometry(0.16, 0.83, 5.6, 10, 1, true),
    new T.MeshBasicMaterial({
      color: 0xeca751,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  markerColumn.position.y = 2.8;
  marker.add(markerRing, markerColumn);
  const diamond = new T.Mesh(
    new T.OctahedronGeometry(0.41),
    new T.MeshBasicMaterial({ color: 0xffdc85 }),
  );
  diamond.position.y = 5.52;
  marker.add(diamond);
  scene.add(marker);

  const targets = targetPositions.map(([x, z]) => {
    const group = new T.Group();
    const foot = new T.Mesh(
      new T.BoxGeometry(0.36, 1.8, 0.36),
      new T.MeshStandardMaterial({ color: 0x464260 }),
    );
    foot.position.y = 0.8;
    const plate = new T.Mesh(
      new T.CylinderGeometry(0.52, 0.52, 0.15, 16),
      new T.MeshBasicMaterial({ color: 0xffa259 }),
    );
    plate.rotation.x = Math.PI / 2;
    plate.position.y = 1.6;
    group.add(foot, plate);
    group.position.set(x, 0, z);
    scene.add(group);
    return { x, z, group, plate, hit: false };
  });

  const trafficRoutes = [
    [
      [-148, 166],
      [-148, -149],
      [69, -149],
      [69, 132],
      [-148, 132],
    ],
    [
      [-81, -180],
      [-81, 59],
      [146, 59],
      [146, -79],
      [-81, -79],
    ],
    [
      [-5, 155],
      [-5, 65],
      [-147, 65],
      [-147, 138],
      [-5, 138],
    ],
    [
      [68, 120],
      [68, -13],
      [145, -13],
      [145, 64],
      [68, 64],
    ],
    [
      [-155, 23],
      [-155, 138],
      [-76, 138],
      [-76, -12],
      [-155, -12],
    ],
  ];
  const traffic = trafficRoutes.map((route, index) => {
    const model = vehicleModel(
      index % 2 ? 'van' : 'sedan',
      [0x9e8bc9, 0xa78166, 0x7499ad, 0x946582, 0x7b8f87][index],
    );
    scene.add(model.group);
    return {
      ...model,
      route,
      index: 1,
      x: route[0][0],
      z: route[0][1],
      yaw: direction(...route[0], route[1]),
    };
  });
  const patrolPool = [vehicleModel('patrol'), vehicleModel('patrol')];
  for (const model of patrolPool) {
    model.group.visible = false;
    scene.add(model.group);
  }

  const pedestrians = [];
  function addPed(x, z, color, gang = '', axis = 'z', event = false) {
    const model = personModel(color, pedestrians.length);
    scene.add(model.group);
    pedestrians.push({
      ...model,
      x,
      z,
      home: [x, z],
      axis,
      gang,
      event,
      flee: 0,
      angry: 0,
      health: 100,
      wait: 0,
      phase: pedestrians.length * 2.25,
    });
  }
  for (const [x, z, axis] of [
    [-160, 104, 'z'],
    [-142, 91, 'z'],
    [-160, 37, 'z'],
    [-142, -59, 'z'],
    [-89, 66 + 5, 'x'],
    [-16, 33, 'z'],
    [0.6, 76, 'z'],
    [-16, -49, 'z'],
    [64, 20, 'z'],
    [80, 91, 'z'],
    [140, 91, 'z'],
    [-69, -102, 'z'],
    [9, 143, 'x'],
    [141, -87, 'z'],
  ]) {
    addPed(x, z, [0xb784b9, 0xc4bc73, 0x7189b5, 0xb2756e][pedestrians.length % 4], '', axis);
  }
  addPed(-167, -20, 0x42b9ae, '盐线');
  addPed(-166, -27, 0x42b9ae, '盐线');
  addPed(135, -43, 0xe08656, '锈锚');
  addPed(135, -51, 0xe08656, '锈锚');
  addPed(14, 20, 0x42b9ae, '盐线', 'x', true);
  addPed(25, 25, 0xe08656, '锈锚', 'x', true);

  const beamGeometry = new T.BufferGeometry();
  const beamAttribute = new T.BufferAttribute(new Float32Array(6), 3);
  beamGeometry.setAttribute('position', beamAttribute);
  const beam = new T.Line(
    beamGeometry,
    new T.LineBasicMaterial({ color: 0xff65c9, transparent: true }),
  );
  beam.visible = false;
  beam.frustumCulled = false;
  scene.add(beam);
  let beamTime = 0;

  const ui = Object.fromEntries(
    [...stage.querySelectorAll('[id]')].map((element) => [element.id, element]),
  );
  const save = store.data;
  let paused = true;
  let alive = false;
  let time = 0;
  let frame = 0;
  let tick = 0;
  let quality = 1;
  let frameMean = 18;
  let qualityFrames = 0;
  let alert = freshAlert();
  let mission = null;
  let race = null;
  let intro = 'free';
  let practice = false;
  let eventTime = 0;
  let moving = 0;
  let lastCrash = 0;
  let lastMap = 0;
  let mapState = {};
  let recoverPressed = 0;
  let recoverUsed = false;
  let cameraYaw = 0;
  let cameraPitch = 0.1;
  let lastCameraInput = 0;
  let cameraShake = 0;
  let relation = '';
  let nearAction;
  let viewActive = true;
  let vehicle;
  const owned = [];
  const player = {
    x: 0,
    z: 0,
    yaw: 0,
    hp: 100,
    gear: -1,
    aiming: false,
    cooldown: 0,
    reload: 0,
    inventory: [],
  };

  const input = createInput(canvas, stage, act, () => alive && !paused && viewActive);
  const { held, state: pad } = input;
  const low = () => save.settings.graphics === 'low' || (touch() && save.settings.graphics === 'auto');

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    const maxScale = low() ? 0.92 : 1.45;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxScale) * quality);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    stage.classList.toggle('touch-mode', touch());
    ui.touch.hidden = !touch();
  }

  function syncMesh(object) {
    object.group.position.set(object.x, 0, object.z);
    object.group.rotation.y = object.yaw;
    if (object.lights?.length)
      object.lights.forEach((light, i) => {
        light.visible = Math.floor(time * 8) % 2 === i;
      });
  }

  function newVehicle(type, point, yaw = 0) {
    const tint = paints[save.paint[type]]?.color || (type === 'sedan' ? '#d6c5dd' : cars[type].color);
    const object = {
      ...vehicleModel(type, tint),
      type,
      x: point[0],
      z: point[1],
      yaw,
      speed: 0,
      hp: 100,
      safe: point,
    };
    owned.push(object);
    scene.add(object.group);
    syncMesh(object);
    return object;
  }

  function removeVehicles() {
    for (const car of owned.splice(0)) {
      scene.remove(car.group);
      car.group.traverse((node) => {
        if (node.isMesh && node.name.includes('body')) node.material.dispose();
      });
    }
    vehicle = null;
  }

  function clearAlert() {
    for (const patrol of alert.patrols) patrol.group.visible = false;
    alert = freshAlert();
  }

  function setPause(value = true) {
    paused = value;
    input.clear();
    if (value) {
      audio.pause();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    } else {
      canvas.focus({ preventScroll: true });
      tick = now();
    }
  }

  function setup(mode, spawnCar = save.car) {
    scene.fog.density = 0.0054;
    alive = true;
    intro = mode;
    race = null;
    mission =
      mode === 'mission'
        ? { stage: 'take', elapsed: 0, retries: 0, checkpoint: false, car: spawnCar }
        : null;
    practice = false;
    eventTime = 0;
    player.hp = 100;
    player.gear = save.pistol || save.trained ? 0 : -1;
    player.aiming = false;
    player.reload = player.cooldown = 0;
    player.inventory = weapons.map((weapon) => ({ ammo: weapon.cap, stock: weapon.stock }));
    for (const target of targets) {
      target.hit = false;
      target.plate.material.color.setHex(0xffa259);
    }
    for (const p of pedestrians) {
      [p.x, p.z] = p.home;
      p.flee = p.angry = p.wait = 0;
      p.health = 100;
    }
    clearAlert();
    removeVehicles();
    if (mode === 'race') {
      vehicle = newVehicle(spawnCar, zones.race);
      [player.x, player.z] = zones.race;
    } else {
      newVehicle(spawnCar, zones.car);
      if (spawnCar !== 'van') newVehicle('van', zones.van, -Math.PI / 2);
      const spawn =
        mode === 'training'
          ? zones.training
          : mode === 'gang'
            ? [zones.gang[0], zones.gang[1] + 6]
            : zones.spawn;
      [player.x, player.z] = spawn;
    }
    player.yaw = cameraYaw = 0;
    cameraPitch = 0.1;
    lastCameraInput = 0;
    cameraShake = 0;
    camera.position.set(player.x, 5, player.z + 8);
    cameraTarget.set(player.x, 1.4, player.z - 4);
    resize();
    setPause(false);
    updateHud(true);
  }

  function startMission() {
    mission = {
      stage: 'take',
      elapsed: 0,
      retries: 0,
      checkpoint: false,
      car: vehicle?.type || save.car,
    };
    callbacks.toast('接到任务：夜班急件');
    audio.cue('mark');
  }

  function enterCar(car) {
    vehicle = car;
    player.x = car.x;
    player.z = car.z;
    player.yaw = cameraYaw = car.yaw;
    player.aiming = false;
    player.reload = 0;
    if (car.type === 'van' && !save.owned.includes('van')) {
      save.owned.push('van');
      store.write();
      callbacks.toast('试驾成功 · 港务厢式车已收入车库');
      audio.cue('win');
    }
  }

  function exitCar() {
    if (Math.abs(vehicle.speed) > 3.5) return;
    const car = vehicle;
    const x = Math.cos(car.yaw) * 2.0;
    const z = -Math.sin(car.yaw) * 2.0;
    const positions = [[car.x + x, car.z + z], [car.x - x, car.z - z], car.safe];
    const spot = positions.find(([sx, sz]) => city.clear(sx, sz));
    if (!spot) {
      callbacks.toast('停车位置太窄，试试脱困');
      return;
    }
    [player.x, player.z] = spot;
    car.speed = 0;
    vehicle = null;
  }

  function interact() {
    if (!nearAction) return;
    audio.cue('click');
    nearAction.run();
  }

  function interaction() {
    const x = player.x;
    const z = player.z;
    const within = (point, radius = 7) => distance(x, z, point) <= radius;
    const slow = !vehicle || Math.abs(vehicle.speed) <= 5;
    if (mission?.stage === 'take' && within(zones.garage) && slow) {
      return {
        text: '领取备用灯控盒',
        run: () => {
          mission.stage = 'check';
          audio.cue('mark');
        },
      };
    }
    if (mission?.stage === 'check' && within(zones.check, 10) && slow) {
      return {
        text: '在岗亭登记',
        run: () => {
          mission.checkpoint = true;
          mission.car = vehicle?.type || mission.car;
          mission.stage = 'raid';
          audio.cue('mark');
        },
      };
    }
    if (mission?.stage === 'deliver' && within(zones.delivery, 10) && slow && !alert.level) {
      return { text: '交付灯控盒', run: completeMission };
    }
    if (vehicle && slow && !mission && !alert.level && !race && within(zones.race, 10)) {
      return { text: '开始海堤计时赛', run: startRace };
    }
    if (
      vehicle &&
      slow &&
      !mission &&
      !alert.level &&
      !race &&
      within(zones.garage, 7) &&
      vehicle.hp < 100
    ) {
      return {
        text: '修复当前车辆',
        run: () => {
          vehicle.hp = 100;
          callbacks.toast('车辆已修复');
        },
      };
    }
    if (vehicle) return Math.abs(vehicle.speed) <= 3.5 && !race ? { text: '下车', run: exitCar } : null;
    const nearby = owned.find((car) => distance(x, z, [car.x, car.z]) < 5.3);
    if (nearby) return { text: '上车 · ' + cars[nearby.type].name, run: () => enterCar(nearby) };
    if (!mission && !alert.level && within(zones.garage, 10)) {
      return { text: '接取「夜班急件」', run: startMission };
    }
    if (within(zones.training, 7)) {
      if (!practice && (intro === 'training' || !save.trained)) {
        return {
          text: save.pistol || save.trained ? '开始武器训练' : '领取电弧手枪 · 训练',
          run: startTraining,
        };
      }
      return { text: '补给弹药', run: replenish };
    }
    if (within(zones.gang, 8) && !mission && eventTime <= 0 && !alert.level) {
      return {
        text: '观察街区对峙',
        run: () => {
          intro = 'free';
          for (const member of pedestrians.filter((pedestrian) => pedestrian.event)) {
            [member.x, member.z] = member.home;
            member.flee = member.angry = member.wait = 0;
            member.health = 100;
          }
          eventTime = 28;
          callbacks.toast('街区事件：盐线与锈锚正在对峙');
        },
      };
    }
    return null;
  }

  function completeMission() {
    const { elapsed, retries } = mission;
    const first = !save.done;
    mission = null;
    if (first) {
      save.done = true;
      if (!save.owned.includes('coupe')) save.owned.push('coupe');
      save.coins += 240;
      store.write();
    }
    audio.cue('win');
    setPause(true);
    callbacks.result('mission', { elapsed, retries, first });
  }

  function startRace() {
    if (!vehicle || alert.level || mission || race) return;
    race = { elapsed: 0, index: 0, count: 3 };
    audio.cue('mark');
  }

  function startTraining() {
    practice = true;
    if (intro === 'training') intro = 'free';
    for (const target of targets) {
      target.hit = false;
      target.plate.material.color.setHex(0xffa259);
    }
    save.pistol = true;
    store.write();
    player.gear = 0;
    player.yaw = cameraYaw = 0;
    cameraPitch = 0.065;
    replenish();
    callbacks.toast('训练开始 · 瞄准并命中三个靶牌');
  }

  function replenish() {
    if (player.gear < 0) player.gear = 0;
    player.inventory = weapons.map((weapon) => ({ ammo: weapon.cap, stock: weapon.stock }));
    player.reload = 0;
    player.hp = 100;
    if (save.perks > 0) {
      save.perks--;
      player.inventory.forEach((entry, index) => {
        entry.stock += weapons[index].cap;
      });
      store.write();
      callbacks.toast('已使用签到补给券 · 获得额外弹药');
    } else {
      callbacks.toast('弹药与耐久已补满');
    }
  }

  function reload() {
    if (vehicle || player.gear < 0 || player.reload > 0) return;
    const weapon = weapons[player.gear];
    const inv = player.inventory[player.gear];
    if (!inv.stock || inv.ammo === weapon.cap) return;
    player.reload = weapon.reload;
    audio.cue('reload');
  }

  function targetHit(entity) {
    if (entity.hit) return;
    entity.hit = true;
    entity.plate.material.color.setHex(0x7dffe7);
    audio.cue('mark');
    if (targets.every((target) => target.hit)) {
      practice = false;
      audio.cue('win');
      if (!save.trained) {
        save.trained = true;
        store.write();
        callbacks.toast('训练完成 · 已解锁脉冲发射器，按 Q 切换');
      } else {
        callbacks.toast('训练完成 · 三个靶牌都已命中');
      }
    }
  }

  function fire() {
    if (vehicle || player.gear < 0 || player.reload || player.cooldown > 0) return;
    const weapon = weapons[player.gear];
    const inv = player.inventory[player.gear];
    if (inv.ammo <= 0) {
      reload();
      return;
    }
    inv.ammo--;
    player.cooldown = weapon.interval;
    audio.cue('shot');
    if (save.settings.movement) cameraShake = 0.13;
    const [fx, fz] = forward(cameraYaw);
    shotOrigin.set(player.x + Math.cos(cameraYaw) * 0.36, 1.27, player.z - Math.sin(cameraYaw) * 0.36);
    camera.getWorldDirection(shotDirection);
    let aimPoint = new T.Vector3(player.x + fx * 85, 1.4 + shotDirection.y * 25, player.z + fz * 85);
    let best = Infinity;
    let chosen;
    const neighbors = [
      ...(practice ? targets.filter((target) => !target.hit) : []),
      ...pedestrians.filter((ped) => ped.gang && ped.health > 0 && ped.group.visible),
    ];
    for (const entity of neighbors) {
      const range = distance(player.x, player.z, [entity.x, entity.z]);
      if (range > 43 || range >= best || range < 0.8) continue;
      const offset = Math.abs(angle(direction(player.x, player.z, [entity.x, entity.z]) - cameraYaw));
      const aimAssist = practice ? 0.22 : 0.145;
      if (offset > aimAssist + 0.34 / range) continue;
      const segments = Math.ceil(range / 2);
      let blocked = false;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        if (
          !city.clear(player.x + (entity.x - player.x) * t, player.z + (entity.z - player.z) * t, 0.06)
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      chosen = entity;
      best = range;
    }
    if (chosen) {
      aimPoint = focus.set(chosen.x, 1.6, chosen.z);
      if ('hit' in chosen) targetHit(chosen);
      else {
        chosen.health = Math.max(0, chosen.health - weapon.damage);
        chosen.angry = 10;
        relation = chosen.gang + ' · 敌对';
      }
    }
    beamAttribute.setXYZ(0, shotOrigin.x, shotOrigin.y, shotOrigin.z);
    beamAttribute.setXYZ(1, aimPoint.x, aimPoint.y, aimPoint.z);
    beamAttribute.needsUpdate = true;
    beam.material.color.setHex(weapon.color);
    beamTime = 0.11;
    beam.visible = true;
    for (const p of pedestrians) {
      if (!p.gang && distance(p.x, p.z, [player.x, player.z]) <= 26) p.flee = 4.3;
    }
    if (distance(player.x, player.z, zones.training) > 16) {
      beginAlert(inHarbor(player.x, player.z) ? null : [player.x, player.z]);
      if (race) {
        race = null;
        callbacks.toast('警戒已触发，计时赛取消');
      }
    }
  }

  function beginAlert(center) {
    if (alert.level) return;
    alert.level = 1;
    alert.center = center;
    activatePatrol();
    audio.cue('alarm');
  }

  function activatePatrol() {
    const model = patrolPool[alert.patrols.length];
    if (!model) return;
    const playerPoint = [player.x, player.z];
    const origins = patrolOrigins
      .map((point) => [point, distance(...point, playerPoint)])
      .filter(([, d]) => d >= 23)
      .sort((a, b) => a[1] - b[1]);
    const start = origins[Math.min(alert.patrols.length, origins.length - 1)]?.[0] || patrolOrigins[0];
    const patrol = {
      ...model,
      x: start[0],
      z: start[1],
      yaw: direction(...start, playerPoint),
      speed: 9,
      next: [-1, -1],
    };
    model.group.visible = true;
    syncMesh(patrol);
    alert.patrols.push(patrol);
  }

  function inAlert(x, z) {
    return alert.center ? distance(x, z, alert.center) < 41 : inHarbor(x, z);
  }

  function fail(reason) {
    if (paused) return;
    setPause(true);
    callbacks.result('fail', {
      reason,
      mission: Boolean(mission),
      checkpoint: Boolean(mission?.checkpoint),
    });
  }

  function retry() {
    const previous = mission;
    if (previous?.checkpoint) {
      setup('mission', previous.car);
      const car = owned[0];
      car.x = zones.check[0];
      car.z = zones.check[1] + 4;
      car.yaw = -Math.PI / 2;
      enterCar(car);
      mission.stage = 'raid';
      mission.checkpoint = true;
      mission.retries = previous.retries + 1;
      mission.elapsed = previous.elapsed;
      syncMesh(car);
    } else {
      setup(previous ? 'mission' : intro === 'race' ? 'race' : 'free');
      if (previous) {
        mission.retries = previous.retries + 1;
        mission.elapsed = previous.elapsed;
      }
    }
  }

  function recover() {
    const entity = vehicle || player;
    if (vehicle && vehicle.hp <= 0) {
      fail('车辆无法继续行驶');
      return;
    }
    const search = (point, checkAlert = true) => {
      for (const radius of [3, 6, 10, 14])
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const x = point.x + Math.sin(a) * radius;
          const z = point.z + Math.cos(a) * radius;
          if (!city.clear(x, z, vehicle ? 1.4 : 0.65)) continue;
          if (checkAlert && alert.level && inAlert(x, z) !== inAlert(point.x, point.z)) continue;
          return [x, z];
        }
      return null;
    };
    const spot = search(entity);
    if (!spot) {
      fail('附近没有可脱困的位置');
      return;
    }
    [entity.x, entity.z] = spot;
    if (vehicle) {
      vehicle.speed = 0;
      [player.x, player.z] = spot;
      syncMesh(vehicle);
    }
    callbacks.toast('已移到附近的空地');
  }

  function updateAlert(dt) {
    if (vehicle && inHarbor(player.x, player.z)) {
      beginAlert(null);
      if (mission?.stage === 'raid') mission.stage = 'escape';
    }
    if (!alert.level) return;
    if (inAlert(player.x, player.z)) {
      alert.inside += dt;
      alert.escape = 0;
      if (alert.level === 1 && alert.inside >= 15) {
        alert.level = 2;
        activatePatrol();
        audio.cue('alarm');
      }
    } else {
      alert.inside = 0;
      alert.escape += dt;
      if (alert.escape >= 10) {
        clearAlert();
        audio.cue('mark');
        callbacks.toast('警戒解除，继续巡游');
        if (mission?.stage === 'escape') mission.stage = 'deliver';
        return;
      }
    }
    let close = false;
    for (const patrol of alert.patrols) {
      const point = [player.x, player.z];
      const range = distance(patrol.x, patrol.z, point);
      close ||= range < 7;
      let destination = point;
      const segmentBlocked = [1, 2, 3, 4].some((step) => {
        const q = step / 5;
        return !city.clear(
          patrol.x + (point[0] - patrol.x) * q,
          patrol.z + (point[1] - patrol.z) * q,
          1.2,
        );
      });
      if (segmentBlocked) {
        const route = routeTo(patrol.x, patrol.z, point);
        destination = route.find((p) => distance(patrol.x, patrol.z, p) > 6) || point;
      }
      npcDrive(patrol, destination, range < 5 ? 2.5 : 17 + alert.level * 2, dt);
    }
    if (close && (!vehicle || Math.abs(vehicle.speed) < 5.5)) {
      alert.caught += dt;
      if (alert.caught >= 3) fail('被港务巡逻队拦停');
    } else {
      alert.caught = 0;
    }
  }

  function npcDrive(car, target, speed, dt) {
    const desired = direction(car.x, car.z, target);
    const difference = angle(desired - car.yaw);
    car.yaw += clamp(difference, -2.8 * dt, 2.8 * dt);
    const [fx, fz] = forward(car.yaw);
    const step = (Math.abs(difference) > 1.05 ? speed * 0.25 : speed) * dt;
    if (city.clear(car.x + fx * step, car.z + fz * step, 1)) {
      car.x += fx * step;
      car.z += fz * step;
    } else {
      car.yaw += 2.3 * dt;
    }
    for (const wheel of car.wheels) wheel.rotateX(-step / 0.45);
    syncMesh(car);
  }

  function updateTraffic(dt) {
    for (const car of traffic) {
      const range = distance(car.x, car.z, [player.x, player.z]);
      car.group.visible = range < 200;
      if (range > 200 && frame % 4 !== 0) continue;
      const target = car.route[car.index];
      if (distance(car.x, car.z, target) < 4) car.index = (car.index + 1) % car.route.length;
      const [fx, fz] = forward(car.yaw);
      const obstruction =
        range < 11 &&
        distance(car.x + fx * 5, car.z + fz * 5, [player.x, player.z]) < (vehicle ? 3.9 : 2.45);
      const next = car.route[car.index];
      npcDrive(car, next, obstruction ? 0.02 : 10, range > 200 ? dt * 4 : dt);
    }
  }

  function updatePedestrians(dt) {
    relation = '';
    for (const pedestrian of pedestrians) {
      pedestrian.angry = Math.max(0, pedestrian.angry - dt);
      const range = distance(pedestrian.x, pedestrian.z, [player.x, player.z]);
      pedestrian.group.visible = range < (low() ? 84 : 128) && (!pedestrian.event || eventTime > 0);
      if (!pedestrian.group.visible) continue;
      pedestrian.flee = Math.max(0, pedestrian.flee - dt);
      if (!pedestrian.gang && vehicle && Math.abs(vehicle.speed) > 3.5 && range < 5.7)
        pedestrian.flee = 2;
      if (pedestrian.health <= 0) {
        pedestrian.group.visible = false;
        pedestrian.wait += dt;
        if (pedestrian.wait > 14) {
          pedestrian.health = 100;
          pedestrian.angry = 0;
          pedestrian.wait = 0;
          [pedestrian.x, pedestrian.z] = pedestrian.home;
        }
        continue;
      }
      const hostile = pedestrian.angry > 0 && range < 35;
      if (hostile) {
        if (range <= 12) relation = pedestrian.gang + ' · 敌对';
        if (range < 8 && !vehicle) {
          player.hp = Math.max(0, player.hp - dt * 10);
          if (player.hp <= 0) {
            fail('角色耐久耗尽');
            return;
          }
        }
      } else if (pedestrian.gang && range < 8) {
        relation = pedestrian.gang + ' · 观望';
      }
      const destination = hostile ? [player.x, player.z] : [...pedestrian.home];
      let speed = hostile ? 2.8 : 1.5;
      if (!hostile && !pedestrian.flee) {
        const oscillation = Math.sin(time * 0.12 + pedestrian.phase) * 12;
        destination[pedestrian.axis === 'x' ? 0 : 1] += oscillation;
        if (Math.sin(time * 0.32 + pedestrian.phase) > 0.84) speed = 0;
      }
      if (pedestrian.flee > 0) {
        destination[0] = pedestrian.x * 2 - player.x;
        destination[1] = pedestrian.z * 2 - player.z;
        speed = 4;
      }
      const gap = distance(pedestrian.x, pedestrian.z, destination);
      if (gap < (hostile ? 3.2 : 0.75)) speed = 0;
      const yaw = direction(pedestrian.x, pedestrian.z, destination);
      const [fx, fz] = forward(yaw);
      const x = pedestrian.x + fx * dt * speed;
      const z = pedestrian.z + fz * dt * speed;
      if (city.clear(x, z, 0.3)) {
        pedestrian.x = x;
        pedestrian.z = z;
      }
      pedestrian.group.position.set(pedestrian.x, 0, pedestrian.z);
      pedestrian.group.rotation.y = yaw;
      pedestrian.walk(time + pedestrian.phase, speed, hostile);
    }
  }

  function updateDriving(dt) {
    const car = vehicle;
    const spec = cars[car.type];
    const gas = held.has('KeyW') || held.has('ArrowUp') || held.has('gas') ? 1 : 0;
    const brake = held.has('KeyS') || held.has('ArrowDown') || held.has('reverse') ? 1 : 0;
    const hand = held.has('Space') || held.has('hand');
    const steer =
      Number(held.has('KeyA') || held.has('ArrowLeft')) -
      Number(held.has('KeyD') || held.has('ArrowRight')) -
      pad.x;
    const before = car.speed;
    if (car.hp > 0) {
      if (gas) car.speed += (car.speed < 0 ? 23 : spec.power) * dt;
      if (brake) car.speed -= (car.speed > 0.3 ? 26 : spec.power * 0.58) * dt;
      if (!gas && !brake) car.speed *= Math.exp(-0.85 * dt);
      if (hand) car.speed *= Math.exp(-3.05 * dt);
      car.speed = clamp(car.speed, -8, spec.speed);
      if (Math.abs(car.speed) < 0.11 && !gas && !brake) car.speed = 0;
    } else {
      car.speed = 0;
    }
    const velocityTurn = Math.min(1, Math.abs(car.speed) / 6.5);
    car.yaw +=
      clamp(steer, -1, 1) * (hand ? 1.52 : 1) * spec.turn * velocityTurn * Math.sign(car.speed) * dt;
    const [fx, fz] = forward(car.yaw);
    const x = car.x + fx * car.speed * dt;
    const z = car.z + fz * car.speed * dt;
    const blocked = [...traffic, ...owned, ...alert.patrols].some(
      (other) =>
        other !== car &&
        other.group.visible &&
        distance(x, z, [other.x, other.z]) < 2.15 &&
        distance(car.x, car.z, [other.x, other.z]) > distance(x, z, [other.x, other.z]) + 0.015,
    );
    if (
      !blocked &&
      city.clear(x, z, spec.size) &&
      city.clear(x + fx * 1.36, z + fz * 1.36, spec.size) &&
      city.clear(x - fx * 1.36, z - fz * 1.36, spec.size)
    ) {
      const traveled = Math.hypot(car.x - x, car.z - z);
      car.x = x;
      car.z = z;
      car.safe = [x, z];
      if (traveled > 0) {
        save.meters += traveled;
        if (Math.floor(save.meters / 100) !== Math.floor((save.meters - traveled) / 100)) store.write();
      }
    } else if (Math.abs(before) > 1.05) {
      if (lastCrash <= 0 && Math.abs(before) > 4.5) {
        lastCrash = 0.42;
        car.hp = Math.max(0, car.hp - Math.abs(before) * (car.type === 'van' ? 0.84 : 1.25));
        audio.cue('crash');
        if (save.settings.movement) cameraShake = 0.23;
        if (car.hp <= 0) callbacks.toast('车辆停驶 · 下车或打开暂停菜单脱困');
      }
      car.speed *= -0.27;
    } else {
      car.speed = 0;
    }
    player.x = car.x;
    player.z = car.z;
    player.yaw = car.yaw;
    moving = Math.abs(car.speed);
    for (const wheel of car.wheels) wheel.rotateX((-car.speed * dt) / 0.45);
    syncMesh(car);
    if (time - lastCameraInput > 1.1) cameraYaw += angle(car.yaw - cameraYaw) * Math.min(1, dt * 8);
  }

  function updateWalking(dt) {
    let sideways = pad.x + Number(held.has('KeyD')) - Number(held.has('KeyA'));
    let ahead =
      -pad.y +
      Number(held.has('KeyW') || held.has('ArrowUp')) -
      Number(held.has('KeyS') || held.has('ArrowDown'));
    if (held.has('ArrowLeft')) cameraYaw += dt * 1.9;
    if (held.has('ArrowRight')) cameraYaw -= dt * 1.9;
    const norm = Math.max(1, Math.hypot(sideways, ahead));
    sideways /= norm;
    ahead /= norm;
    const speed = held.has('ShiftLeft') || held.has('ShiftRight') || held.has('sprint') ? 8.6 : 4.7;
    const [fx, fz] = forward(cameraYaw);
    const dx = (fx * ahead + Math.cos(cameraYaw) * sideways) * speed * dt;
    const dz = (fz * ahead - Math.sin(cameraYaw) * sideways) * speed * dt;
    moving = Math.hypot(dx, dz) / dt;
    if (city.clear(player.x + dx, player.z, 0.48)) player.x += dx;
    if (city.clear(player.x, player.z + dz, 0.48)) player.z += dz;
    if (player.aiming || pad.aiming) {
      player.yaw = cameraYaw;
    } else if (moving > 0.2) {
      const goal = Math.atan2(-dx, -dz);
      player.yaw += angle(goal - player.yaw) * Math.min(1, dt * 14);
    }
  }

  function updateRace(dt) {
    if (!race || !vehicle) return;
    if (race.count > 0) {
      race.count -= dt;
      if (race.count <= 0) audio.cue('mark');
      return;
    }
    race.elapsed += dt;
    if (distance(player.x, player.z, raceRoute[race.index]) > 10.5) return;
    race.index++;
    audio.cue('mark');
    if (race.index !== raceRoute.length) return;
    const elapsed = race.elapsed;
    const best = save.best == null || elapsed < save.best;
    if (best) {
      save.best = elapsed;
      store.write();
    }
    race = null;
    intro = 'free';
    audio.cue('win');
    setPause(true);
    callbacks.result('race', { elapsed, best });
  }

  function destination() {
    if (mission) {
      if (mission.stage === 'escape') {
        const west = [72, -82];
        const south = [149, -19];
        return inAlert(player.x, player.z)
          ? distance(player.x, player.z, west) < distance(player.x, player.z, south)
            ? west
            : south
          : null;
      }
      return info[mission.stage][3];
    }
    if (race) return race.count > 0 ? zones.race : raceRoute[race.index];
    if (practice) return targetPositions[targets.findIndex((target) => !target.hit)] || zones.training;
    if (intro === 'race') return zones.race;
    if (intro === 'training') return zones.training;
    if (intro === 'gang') return zones.gang;
    if (eventTime > 0) return zones.gang;
    if (!vehicle && distance(player.x, player.z, zones.spawn) < 25) return zones.car;
    return null;
  }

  function displayObjective(target) {
    if (mission) return info[mission.stage].slice(0, 3);
    if (race) {
      return race.count > 0
        ? ['海堤计时赛', '准备起跑 · ' + Math.ceil(race.count), '沿金色检查点依次通过']
        : [
            '海堤计时赛',
            '检查点 ' + (race.index + 1) + ' / ' + raceRoute.length,
            clockText(race.elapsed),
          ];
    }
    if (practice)
      return [
        '车库训练',
        '命中三个靶牌 · ' + targets.filter((target) => target.hit).length + ' / 3',
        '调整视角瞄准橙色靶牌',
      ];
    if (eventTime > 0) return ['街区事件', '盐线 ↔ 锈锚', '两帮对峙 · ' + Math.ceil(eventTime) + ' 秒'];
    if (intro === 'race') return ['海堤计时赛', '前往海堤起点', '停车后点击交互开始'];
    if (intro === 'training') return ['武器训练', '维修街训练场', '靠近训练场标记并交互'];
    if (intro === 'gang') return ['街区事件', '维修街对峙', '接近标记并交互以观察事件'];
    if (relation) return ['街区居民', relation, '远离后，街区会恢复日常活动'];
    if (!vehicle && target) return ['自由模式', '在晚钟车库附近找辆车', '靠近车辆即可上车'];
    return ['自由模式', '潮汐市 · 自由巡游', '到车库接任务 · 去海堤试试计时赛'];
  }

  function updateHud(force = false) {
    const current = districtAt(player.x, player.z);
    ui['district-mark'].textContent = current.mark;
    ui['district-mark'].style.color = current.color;
    ui.district.textContent = current.name;
    const target = destination();
    const objective = displayObjective(target);
    ui['objective-label'].textContent = objective[0];
    ui['objective-title'].textContent = objective[1];
    ui['objective-detail'].textContent = objective[2];
    nearAction = interaction();
    ui.interaction.hidden = !nearAction;
    if (nearAction) ui.interaction.querySelector('span').textContent = nearAction.text;
    ui.wanted.hidden = !alert.level;
    if (alert.level) {
      const status =
        alert.caught > 0
          ? '拦停进度 ' + Math.min(100, Math.ceil((alert.caught * 100) / 3)) + '%'
          : alert.escape > 0
            ? '解除警戒 ' + Math.max(1, Math.ceil(10 - alert.escape)) + ' 秒'
            : '沿道路驶离警戒区';
      ui.wanted.textContent = '警戒 ' + '★'.repeat(alert.level) + ' · ' + status;
    }
    stage.classList.toggle('driving', Boolean(vehicle));
    ui['drive-hud'].hidden = !vehicle;
    ui['foot-hud'].hidden = Boolean(vehicle);
    ui.crosshair.hidden = Boolean(vehicle) || player.gear < 0;
    if (vehicle) {
      ui.speed.textContent = String(Math.round(Math.abs(vehicle.speed) * 3.6));
      ui.gear.textContent = Math.abs(vehicle.speed) < 0.3 ? 'N' : vehicle.speed < 0 ? 'R' : 'D';
      ui.condition.style.width = vehicle.hp + '%';
      ui['car-label'].textContent = cars[vehicle.type].name;
    } else {
      ui.vitals.firstElementChild.style.width = player.hp + '%';
      ui['weapon-label'].textContent = weapons[player.gear]?.name || '徒手';
      const ammo = player.inventory[player.gear];
      ui.ammo.textContent = ammo ? (player.reload ? '装填中' : ammo.ammo + ' / ' + ammo.stock) : '';
    }
    mapState = { x: player.x, z: player.z, yaw: -player.yaw, target, alert };
    if (inspect) {
      const snapshot = {
        x: player.x,
        z: player.z,
        yaw: player.yaw,
        speed: vehicle?.speed ?? null,
        stage: mission?.stage,
        level: alert.level,
        countdown: alert.escape,
        race: race?.index,
        paused,
        fps: frameMean ? 1000 / frameMean : null,
      };
      stage.dataset.inspection = JSON.stringify(snapshot);
    }
    if (force || now() - lastMap > 100) {
      drawMap(ui['map-mini'], mapState);
      lastMap = now();
    }
    marker.visible = Boolean(target);
    if (target) {
      marker.position.set(target[0], 0, target[1]);
      diamond.position.y = 5.3 + 0.39 * Math.sin(time * 3.6);
      diamond.rotation.y = time * 1.9;
    }
  }

  function updateCamera(dt, immediate = false) {
    const aiming = !vehicle && player.gear >= 0 && (player.aiming || pad.aiming);
    const dist = vehicle ? 8.8 : aiming ? 3.0 : 5.1;
    const high = vehicle ? 4.35 : aiming ? 2.18 : 3.2;
    const [fx, fz] = forward(cameraYaw);
    const strafe = aiming ? 0.72 : 0;
    cameraWanted.set(
      player.x - fx * dist + Math.cos(cameraYaw) * strafe,
      Math.max(1.5, high + cameraPitch * dist),
      player.z - fz * dist - Math.sin(cameraYaw) * strafe,
    );
    if (cameraShake > 0) cameraWanted.x += Math.sin(time * 115) * cameraShake;
    const steps = 7;
    for (let i = 1; i < steps; i++) {
      const amount = i / steps;
      if (
        !city.clear(
          T.MathUtils.lerp(player.x, cameraWanted.x, amount),
          T.MathUtils.lerp(player.z, cameraWanted.z, amount),
          0.18,
        )
      ) {
        const safe = Math.max(0.15, (i - 1) / steps);
        cameraWanted.x = T.MathUtils.lerp(player.x, cameraWanted.x, safe);
        cameraWanted.z = T.MathUtils.lerp(player.z, cameraWanted.z, safe);
        break;
      }
    }
    camera.position.lerp(cameraWanted, immediate ? 1 : 1 - Math.exp(-dt * 12));
    const lead = vehicle ? Math.min(11, 5.5 + Math.abs(vehicle.speed) * 0.15) : aiming ? 10 : 4.4;
    focus.set(
      player.x + fx * lead,
      aiming ? 1.45 - cameraPitch * 6 : 1.6 - cameraPitch * 3.4,
      player.z + fz * lead,
    );
    cameraTarget.lerp(focus, immediate ? 1 : 1 - Math.exp(-dt * 16));
    camera.lookAt(cameraTarget);
  }

  function update(dt) {
    time += dt;
    if (mission) mission.elapsed += dt;
    lastCrash = Math.max(0, lastCrash - dt);
    beamTime = Math.max(0, beamTime - dt);
    cameraShake = Math.max(0, cameraShake - dt);
    eventTime = Math.max(0, eventTime - dt);
    beam.visible = beamTime > 0;
    beam.material.opacity = Math.min(1, beamTime * 10);
    if (pad.lookX || pad.lookY) {
      cameraYaw -= pad.lookX;
      cameraPitch = clamp(cameraPitch + pad.lookY, -0.23, 0.57);
      pad.lookX = pad.lookY = 0;
      lastCameraInput = time;
    }
    if (vehicle) {
      if (!(race?.count > 0)) updateDriving(dt);
    } else {
      updateWalking(dt);
    }
    playerModel.group.visible = !vehicle;
    playerModel.group.position.set(player.x, 0.035, player.z);
    playerModel.group.rotation.y = player.yaw;
    playerModel.walk(
      time,
      moving,
      player.gear >= 0 && (pad.aiming || player.aiming || player.cooldown > 0),
    );
    updateTraffic(dt);
    updatePedestrians(dt);
    if (paused) return;
    updateAlert(dt);
    if (paused) return;
    updateRace(dt);
    if (paused) return;
    if (!vehicle) {
      if (player.cooldown > 0) player.cooldown = Math.max(0, player.cooldown - dt);
      if (player.reload > 0) {
        player.reload = Math.max(0, player.reload - dt);
        if (!player.reload) {
          const inv = player.inventory[player.gear];
          const loaded = Math.min(weapons[player.gear].cap - inv.ammo, inv.stock);
          inv.ammo += loaded;
          inv.stock -= loaded;
        }
      }
      if (held.has('fire') || held.has('Enter') || pad.fire) fire();
    }
    if (held.has('KeyT')) {
      recoverPressed += dt;
      if (!recoverUsed && recoverPressed >= 0.65) {
        recoverUsed = true;
        recover();
      }
    } else {
      recoverPressed = 0;
      recoverUsed = false;
    }
    if (frame % 5 === 0) updateHud();
    audio.engine(vehicle?.speed || 0, Boolean(vehicle), Boolean(alert.level));
  }

  function animate(at) {
    if (!alive) return;
    requestAnimationFrame(animate);
    if (!viewActive || stage.hidden || (paused && frame > 0)) return;
    const delta = Math.min(0.09, (at - tick) / 1000);
    tick = at;
    if (delta <= 0) return;
    frame++;
    const steps = Math.ceil(delta / 0.041);
    for (let i = 0; i < steps && !paused; i++) update(delta / steps);
    updateCamera(delta, frame === 1);
    frameMean += (delta * 1000 - frameMean) * 0.035;
    if (low() || save.settings.graphics === 'auto') {
      if (++qualityFrames >= 65) {
        qualityFrames = 0;
        const next =
          frameMean > 31
            ? Math.max(0.62, quality - 0.13)
            : frameMean < 19
              ? Math.min(1, quality + 0.05)
              : quality;
        if (next !== quality) {
          quality = next;
          resize();
        }
      }
    }
    renderer.render(scene, camera);
  }

  function act(name) {
    if (!alive || paused || !viewActive) return;
    if (name === 'use') {
      nearAction = interaction();
      interact();
      updateHud(true);
    } else if (name === 'switch') {
      if (save.trained && !vehicle && player.gear >= 0) {
        player.gear = 1 - player.gear;
        player.reload = 0;
        updateHud(true);
      }
    } else if (name === 'reload') reload();
    else if (name === 'aim' && !vehicle && player.gear >= 0) player.aiming = !player.aiming;
    else if (name === 'fire') fire();
    else if (name === 'pause' || name === 'map') {
      setPause(true);
      callbacks.panel(name);
    }
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    setPause(true);
    callbacks.result('context', {});
  });
  canvas.addEventListener('dblclick', () => {
    if (paused || touch()) return;
    try {
      canvas.requestPointerLock?.()?.catch?.(() => {});
    } catch {
      /* Drag remains available. */
    }
  });
  canvas.addEventListener('webglcontextrestored', () => updateHud(true));
  return {
    launch(mode) {
      const started = alive;
      setup(mode);
      if (!started) requestAnimationFrame(animate);
    },
    pause(value = true) {
      setPause(value);
    },
    resize,
    reset() {
      setPause(true);
      store.write();
    },
    retry,
    recover() {
      setPause(false);
      recover();
    },
    action: act,
    view(value) {
      viewActive = value;
      if (!value) setPause(true);
    },
    get paused() {
      return paused;
    },
    drawMap(canvas, detailed) {
      drawMap(canvas, mapState, detailed);
    },
  };
}
