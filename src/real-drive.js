import * as T from 'three';
import { cars, paints, weapons } from './data.js';
import { createCoastActivities } from './coast-activities.js';
import { createCityExtras } from './city-extras.js';
import { cityMissions } from './city-missions.js';
import { hasWeapon } from './save.js';
import { drive } from './driving.js';
import { setIcon } from './icons.js';
import { createInput } from './input.js';
import { createRealCity } from './real-city.js';
import { realStreetLife } from './real-life.js';
import { lightRealCity } from './real-light.js';
import { loadRealMaterials } from './real-materials.js';
import { retroRider } from './retro-people.js';
import { retroScooter } from './retro-street.js';
import { loadModels, loadStreetCars, vehicleModel } from './world.js';

const clamp = T.MathUtils.clamp;
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const angleBetween = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const damp = (current, goal, rate, dt) => T.MathUtils.lerp(current, goal, 1 - Math.exp(-rate * dt));
const inspect = import.meta.env.DEV && new URLSearchParams(location.search).has('inspect');
const beach = { court: [5510, 160], spawn: [5510, 168], water: [5558, 295] };
const ferryBerths = [
  [-1597, -923],
  [-2510, 207],
];
const shortcuts = {
  ferry: 'north-ferry',
  beach: 'beach',
  race: 'race',
  gang: 'gang',
  chase: 'pavilion',
  garage: 'garage',
  training: 'training',
};
const streetCars = {
  ...cars,
  taxi: {
    name: '城市出租车',
    color: '#ebcc61',
    speed: 29,
    power: 9.4,
    turn: 1.69,
    size: 1.08,
    length: 4.35,
  },
  suv: {
    name: '城市越野车',
    color: '#748894',
    speed: 30,
    power: 8.8,
    turn: 1.49,
    size: 1.13,
    length: 4.7,
  },
  delivery: {
    name: '厢式货车',
    color: '#ddd6bd',
    speed: 21,
    power: 6.4,
    turn: 1.12,
    size: 1.24,
    length: 5.8,
  },
  patrol: { ...cars.sedan, size: 1.1, length: 4.35 },
};
const districtFleet = {
  pavilion: ['ebike', 'taxi', 'sedan'],
  'department-store': ['ebike'],
  'post-office': ['delivery', 'ebike'],
  tv: ['suv', 'ebike', 'taxi'],
  museum: ['suv', 'taxi', 'van'],
  square: ['taxi', 'ebike'],
  'north-ferry': ['ebike', 'van'],
  'south-ferry': ['ebike', 'delivery'],
  queshi: ['sedan', 'suv'],
  'bay-bridge': ['suv', 'delivery'],
  diving: ['sedan', 'ebike'],
  mountain: ['suv', 'ebike'],
  east: ['coupe', 'suv', 'ebike'],
  hospital: ['taxi'],
};

const openingShots = [
  {
    title: 'GTA6',
    subtitle: '给他爱6 · S城风云',
    location: '内海湾',
    duration: 2.8,
    from: [-3050, 245, 330],
    to: [-2790, 170, 190],
    target: [-2500, 24, -1140],
  },
  {
    title: '礐石大桥',
    location: '跨湾通道',
    duration: 2.4,
    from: [-3210, 158, 46],
    to: [-3370, 115, 110],
    target: [-3780, 71, 45],
  },
  {
    title: '小公园',
    location: '复古街区',
    duration: 2.2,
    from: [-2793, 26, -1396],
    to: [-2807, 5.2, -1402],
    target: [-2815.4, 3.2, -1426.2],
  },
];

export async function createRealDrive({ stage, touch, store, audio, onLoad, callbacks }) {
  onLoad('正在读取内海湾真实路网和建筑轮廓');
  async function readMap(file) {
    const response = await fetch(import.meta.env.BASE_URL + 'maps/' + file);
    if (!response.ok) throw new Error('内海湾地图加载失败');
    return response.json();
  }
  const canvas = stage.querySelector('#real-world');
  const ui = Object.fromEntries([...stage.querySelectorAll('[id]')].map((node) => [node.id, node]));
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  const [data, elevation, materials] = await Promise.all([
    readMap('inner-bay-v3.json'),
    readMap('inner-bay-elevation-v3.json'),
    loadRealMaterials(renderer),
    loadModels(),
    loadStreetCars(),
  ]).catch((error) => {
    renderer.dispose();
    throw error;
  });
  const scene = new T.Scene();
  const low = () => touch() || store.data.settings.graphics === 'low';
  lightRealCity(scene);
  const city = createRealCity(scene, data, elevation, materials);
  const camera = new T.PerspectiveCamera(62, 1, 0.28, 14000);
  const focus = new T.Vector3();
  const desired = new T.Vector3();
  const heading = new T.Vector3();
  const pedestrian = retroRider();
  scene.add(pedestrian.group);
  const footShadow = new T.Mesh(
    new T.CircleGeometry(0.53, 20),
    new T.MeshBasicMaterial({
      color: 0x233137,
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
    }),
  );
  footShadow.rotation.x = -Math.PI / 2;
  scene.add(footShadow);

  function parkedCar(type, point, index, tint = streetCars[type].color) {
    const model = type === 'ebike' ? retroScooter() : vehicleModel(type, tint);
    scene.add(model.group);
    return {
      ...model,
      type,
      spec: streetCars[type],
      point,
      index,
      x: 0,
      z: 0,
      speed: 0,
      yaw: 0,
      hp: 100,
    };
  }

  const rides = city.places.flatMap(({ id, point }) =>
    (districtFleet[id] || []).map((type, index) => {
      const tint = ['taxi', 'suv', 'delivery'].includes(type) ? null : streetCars[type].color;
      return parkedCar(type, point, index, tint);
    }),
  );
  let active = false;
  let paused = true;
  let flight = false;
  let frame = 0;
  let tick = 0;
  let clock = 0;
  let pixelScale = 1;
  let frameMean = 16.7;
  let sampleFrames = 0;
  let sceneTile = '';
  let openingPlayed = false;
  let cinematic;
  let viewActive = true;
  let health = 100;
  let hurtUntil = 0;
  let admitted = false;
  let swimming = false;
  let waypoint;
  let weapon = -1;
  let nextStrike = 0;
  let attackUntil = 0;
  let aiming = false;
  let race;
  let matchPaid = false;
  let x = 0;
  let z = 0;
  let altitude = 0;
  let lift = 0;
  let launchHeight = null;
  let landing = null;
  let grounded = true;
  const velocity = new T.Vector3();
  let viewBlend = 0;
  let cameraArm = 4.5;
  let lastLook = -10;
  let keyTurn = 0;
  let impact = 0;
  let yaw = 0;
  let pitch = 0.09;
  let facing = 0;
  let moving = 0;
  let driving;
  let nearest;
  let home;
  const mapCache = new WeakMap();
  const input = createInput(canvas, stage, action, () => active && viewActive && !paused, touch);
  const { held, state } = input;
  const pressing = (...codes) => codes.some((code) => held.has(code));
  const hospital = city.places.find((place) => place.id === 'hospital');
  const life = realStreetLife({
    scene,
    city,
    compact: low,
    createCar(type, index) {
      const model = type === 'ebike' ? retroScooter() : vehicleModel(type);
      model.group.visible = false;
      scene.add(model.group);
      return {
        ...model,
        type,
        index,
        x: 0,
        z: 0,
        speed: 0,
        yaw: 0,
        hp: 100,
        spec: streetCars[type],
      };
    },
    syncCar: syncRide,
    notify(message, cue) {
      callbacks.toast(message);
      audio.cue(cue);
    },
    hurt: damage,
  });
  const alert = life.alert;
  const hud = stage.querySelector('.hud');
  const pointOf = (id) =>
    city.places.find((place) => place.id === id).arrival ||
    city.spawn(city.places.find((place) => place.id === id).point);
  const points = Object.fromEntries(city.places.map(({ id }) => [id, pointOf(id)]));
  const nearbyPoint = (origin, dx, dz) => {
    const next = [origin[0] + dx, origin[1] + dz];
    return city.clear(...next) ? next : city.spawn(next);
  };
  Object.assign(points, {
    'hill-light': nearbyPoint(points.mountain, 64, -46),
    'south-lookout': nearbyPoint(points['south-ferry'], 75, 25),
    'east-return': nearbyPoint(beach.spawn, 8, 0),
    buoy: beach.water,
    'archive-desk': nearbyPoint(points.culture, 12, -7),
    'tower-desk': nearbyPoint(points['tower-room'], 16, 8),
    'hospital-desk': nearbyPoint(points.hospital, -10, 6),
    queshi: city.bridgePoint('queshi', 30),
    'west-arrival': city.bridgePoint('queshi', 625),
    'bay-bridge': city.bridgePoint('bay-bridge', 935),
  });
  points.east = beach.spawn;
  city.places.push({ id: 'beach', name: '东海岸沙滩', point: beach.spawn, arrival: beach.spawn });
  const raceRoute = [350, 610, 940, 1280, 1640].map((z) => city.bridgePoint('bay-bridge', z));
  city.places.push({ id: 'race', name: '海湾竞速起点', point: raceRoute[0] });
  rides.push(parkedCar('coupe', raceRoute[0], 0));
  let garageRide;
  function prepareGarageCar() {
    const type = store.data.car;
    const paint = paints[store.data.paint[type]]?.color || streetCars[type].color;
    if (garageRide?.type === type && garageRide.tint === paint) return;
    if (garageRide && driving === garageRide) return;
    if (garageRide) {
      scene.remove(garageRide.group);
      rides.splice(rides.indexOf(garageRide), 1);
    }
    garageRide = parkedCar(type, points.garage, 0, paint);
    garageRide.tint = paint;
    rides.push(garageRide);
    placeCar(garageRide);
  }

  function placeCar(ride) {
    [ride.x, ride.z] = city.spawn(
      [ride.point[0] + 14 + ride.index * 7, ride.point[1] + 11 + ride.index * 12],
      ride.spec.size,
    );
    ride.yaw = city.roadAngle(ride.x, ride.z);
    ride.speed = ride.pitch = ride.roll = 0;
    syncRide(ride);
  }

  const coast = createCoastActivities(
    scene,
    (color) => {
      const model = retroRider(color);
      return { ...model, walk: (time, speed) => model.animate({ speed, dt: 0.03 }) };
    },
    {
      beach,
      seaLevel: -1.25,
      transit: 22,
      buildPiers: false,
      ferryStops: ['north-ferry', 'south-ferry'].map((id, index) => ({
        pier: points[id],
        berth: ferryBerths[index],
      })),
    },
  );
  const ferryRider = { x: 0, z: 0, yaw: 0 };
  const beacon = new T.Group();
  const ring = new T.Mesh(
    new T.RingGeometry(0.95, 1.25, 28),
    new T.MeshBasicMaterial({ color: 0xffd967, side: T.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  const diamond = new T.Mesh(
    new T.OctahedronGeometry(0.62),
    new T.MeshBasicMaterial({ color: 0xffd26e }),
  );
  diamond.position.y = 2.5;
  beacon.add(ring, diamond);
  scene.add(beacon);
  const contacts = retroRider(0xbb9268);
  contacts.group.visible = false;
  scene.add(contacts.group);
  const missions = cityMissions({
    store,
    points,
    toast: callbacks.toast,
    cue: (name) => audio.cue(name),
    result: callbacks.result,
    panel(name, data) {
      const step = missions.step;
      const [tx, tz] = step.point;
      const ty = city.height(tx, tz);
      const away = Math.atan2(z - tz, x - tx);
      const ax = Math.cos(away);
      const az = Math.sin(away);
      playCinematic(
        [
          {
            title: data.chapter,
            location: '内海湾往事',
            duration: 1.55,
            from: [tx + ax * 5, ty + 2.9, tz + az * 5],
            to: [tx + ax * 3.5, ty + 2, tz + az * 3.5],
            target: [tx, ty + 1.25, tz],
          },
        ],
        () => callbacks.panel(name, data),
      );
    },
  });
  const extras = createCityExtras({ scene, city, store, audio, callbacks, points });
  coast.reset();

  function syncRide(ride) {
    const pavement = city.pavementHeight(ride.x, ride.z);
    ride.group.position.set(ride.x, city.height(ride.x, ride.z) + pavement + 0.012, ride.z);
    ride.group.rotation.set(ride.pitch || 0, ride.yaw, ride.roll || 0, 'YXZ');
  }

  function pause(value = true) {
    paused = value;
    input.clear();
    keyTurn = 0;
    if (paused) {
      audio.pause();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    } else {
      tick = performance.now();
      canvas.focus({ preventScroll: true });
    }
  }

  function focusCinematic() {
    if (cinematic && viewActive) ui['cinematic-skip'].focus({ preventScroll: true });
  }

  function showShot(shot) {
    ui['cinematic-title'].textContent = shot.title;
    ui['cinematic-location'].textContent = shot.location;
    ui['cinematic-subtitle'].textContent = shot.subtitle || '';
    ui.cinematic.dataset.opening = String(shot.title === 'GTA6');
  }

  function playCinematic(shots, done) {
    if (!store.data.settings.movement || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }
    pause();
    cinematic = { shots, index: 0, elapsed: 0, done };
    hud.inert = ui.touch.inert = canvas.inert = true;
    showShot(shots[0]);
    ui['cinematic-fade'].style.opacity = '1';
    ui.cinematic.hidden = false;
    focusCinematic();
  }

  function clearCinematic() {
    cinematic = null;
    ui.cinematic.hidden = true;
    hud.inert = ui.touch.inert = canvas.inert = false;
    sceneTile = '';
  }

  function finishCinematic() {
    if (!active || !cinematic) return;
    const { done } = cinematic;
    clearCinematic();
    updateCamera(true);
    done();
  }

  function renderCinematic(dt) {
    let shot = cinematic.shots[cinematic.index];
    cinematic.elapsed += dt;
    if (cinematic.elapsed >= shot.duration) {
      cinematic.elapsed -= shot.duration;
      if (++cinematic.index === cinematic.shots.length) {
        finishCinematic();
        return;
      }
      shot = cinematic.shots[cinematic.index];
      showShot(shot);
    }
    const progress = T.MathUtils.smoothstep(cinematic.elapsed, 0, shot.duration);
    camera.position.set(
      ...shot.from.map((value, i) => T.MathUtils.lerp(value, shot.to[i], progress)),
    );
    camera.lookAt(...shot.target);
    city.updateVisibility(camera.position.x, camera.position.z, 3500);
    pedestrian.group.visible = false;
    footShadow.visible = false;
    ui['cinematic-fade'].style.opacity = String(
      Math.max(0, 1 - cinematic.elapsed / 0.24, 1 - (shot.duration - cinematic.elapsed) / 0.24),
    );
    city.updateWater(clock + (cinematic?.elapsed || 0), store.data.settings.movement);
    renderer.render(scene, camera);
  }

  function arriveHospital(reason) {
    admitted = true;
    pause();
    life.reset();
    health = 100;
    locate(hospital.id);
    const [gateX, gateZ] = hospital.arrival;
    const ground = city.height(gateX, gateZ);
    playCinematic(
      [
        {
          title: '送往医院',
          location: 'S城医院',
          duration: 2.2,
          from: [gateX + 15, ground + 25, gateZ + 20],
          to: [gateX + 4, ground + 5, gateZ + 7],
          target: [gateX, ground + 1.1, gateZ],
        },
      ],
      () => callbacks.result('hospital', { reason, lost: store.data.hospitalLoss }),
    );
  }

  function damage(amount, reason) {
    if (admitted || paused || (clock < hurtUntil && amount < 100)) return false;
    health = Math.max(0, health - amount);
    hurtUntil = clock + 0.95;
    if (health > 0) return false;
    store.data.hospitalLoss = store.data.coins;
    store.data.coins = 0;
    store.write();
    arriveHospital(reason);
    return true;
  }

  function nearbyHospital() {
    return (
      !flight &&
      !driving &&
      grounded &&
      Math.hypot(x - hospital.arrival[0], z - hospital.arrival[1]) < 8
    );
  }

  function serviceAt() {
    if (flight || driving || swimming || coast.riding || !grounded) return null;
    return city.venues.find((shop) => Math.hypot(shop.point[0] - x, shop.point[1] - z) < 3.35);
  }

  function buyMeal(id, index) {
    const shop = serviceAt();
    const meal = shop?.id === id && Number.isInteger(index) ? shop.menu?.[index] : null;
    if (!meal) return '到店门口后再点单';
    const [name, price, restore] = meal;
    if (health >= 100) return '生命已满';
    if (store.data.coins < price) return '潮票不足';
    const gain = Math.min(restore, 100 - health);
    store.data.coins -= price;
    health += gain;
    store.write();
    updateHud();
    audio.cue('mark');
    return name + ' · 生命 +' + Math.ceil(gain);
  }

  function nearbyAction() {
    if (coast.riding) {
      return coast.canLeave
        ? {
            label: '下船',
            icon: 'ferry',
            run() {
              [x, z] = coast.leave();
              altitude = city.height(x, z);
              grounded = true;
              missions.ferryArrived();
            },
          }
        : null;
    }
    if (flight) return null;
    if (!driving && !swimming && grounded) {
      const story = missions.interact(x, z, true);
      if (story) return story;
      const ports = [points['north-ferry'], points['south-ferry']];
      const dock = ports.findIndex(([px, pz]) => Math.hypot(x - px, z - pz) < 7);
      if (dock >= 0 && dock === coast.dock && !alert.level) {
        return { label: '登上广礐轮渡', icon: 'ferry', run: () => coast.board() };
      }
      const shop = serviceAt();
      if (shop?.kind === 'food')
        return {
          label: '点单 · ' + shop.name,
          icon: 'heart',
          run: () => callbacks.panel('food', { id: shop.id }),
        };
      if (shop?.kind === 'garage')
        return { label: '进入晚钟车库', icon: 'car', run: () => callbacks.panel('garage') };
      if (shop?.kind === 'training')
        return {
          label: '街坊训练场',
          icon: 'target',
          run() {
            if (extras.startTraining() === 'equipped') weapon = 0;
          },
        };
      if (shop?.kind === 'gang')
        return { label: '查看维修街动静', icon: 'police', run: () => extras.startGang(clock) };
      const pickup = extras.pickup(x, z, (amount) => {
        health = Math.min(100, health + amount);
      });
      if (pickup) return pickup;
      if (Math.hypot(x - beach.spawn[0], z - beach.spawn[1]) < 15 && !alert.level) {
        return coast.game
          ? { label: '离开沙滩球场', icon: 'target', run: () => coast.stop() }
          : {
              label: '开始沙滩排球',
              icon: 'target',
              run() {
                matchPaid = false;
                coast.start();
              },
            };
      }
    }
    if (
      driving &&
      !race &&
      !alert.level &&
      Math.hypot(x - raceRoute[0][0], z - raceRoute[0][1]) < 17
    ) {
      return {
        label: '开始海湾竞速',
        icon: 'car',
        run() {
          race = { step: 1, start: clock };
          callbacks.toast('沿桥通过所有检查点');
        },
      };
    }
    return null;
  }

  function fire() {
    if (coast.game) {
      coast.hit({ x, z });
      return;
    }
    if (flight || driving || swimming || coast.riding || clock < nextStrike) return;
    const spec = weapons[weapon];
    const ammo = store.data.arsenal[weapon];
    if (spec && !ammo.ammo) {
      reload();
      return;
    }
    nextStrike = clock + (spec?.interval || 0.43);
    attackUntil = clock + (spec ? 0.18 : 0.29);
    facing = yaw;
    if (spec) {
      ammo.ammo--;
      store.write();
    }
    audio.cue(spec ? 'shot' : 'swing');
    updateHud();
    if (extras.strike({ x, z, yaw, aiming: aiming || state.aiming, armed: Boolean(spec) })) return;
    if (life.strike(x, z, yaw, spec ? 24 : 2, spec ? 0.17 : 0.5)) return;
    if (spec && !extras.training && !alert.level) life.offense(1, '街头开火', x, z);
  }

  function reload() {
    const spec = weapons[weapon];
    const ammo = store.data.arsenal[weapon];
    if (!spec || !ammo.stock || ammo.ammo >= spec.cap) return;
    const amount = Math.min(spec.cap - ammo.ammo, ammo.stock);
    ammo.ammo += amount;
    ammo.stock -= amount;
    store.write();
    nextStrike = clock + 0.55;
    audio.cue('reload');
    updateHud();
  }

  function resize() {
    if (!active || stage.hidden || !stage.clientWidth || !stage.clientHeight) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, low() ? 0.88 : 1.16) * pixelScale);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    stage.classList.toggle('touch-mode', touch());
    ui.touch.hidden = !touch();
  }

  function updateHud() {
    nearest =
      !flight && !landing && !driving && grounded
        ? [
            ...rides,
            ...life.traffic.filter((ride) => ride.group.visible && Math.abs(ride.speed) < 4),
          ]
            .filter(
              (ride) =>
                Math.hypot(ride.x - x, ride.z - z) < 3.5 &&
                Math.abs(city.height(ride.x, ride.z) - altitude) < 1.2,
            )
            .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]
        : null;
    const nearby = city.places.reduce((best, place) =>
      Math.hypot(place.point[0] - x, place.point[1] - z) <
      Math.hypot(best.point[0] - x, best.point[1] - z)
        ? place
        : best,
    );
    const named = Math.hypot(nearby.point[0] - x, nearby.point[1] - z) < 620;
    ui.district.textContent = named ? nearby.name : '内海湾';
    ui['district-area'].textContent = '实景巡游';
    ui['district-mark'].textContent = '图';
    ui['district-mark'].style.color = '';
    ui['objective-label'].textContent = flight
      ? landing
        ? '正在降落'
        : launchHeight !== null
          ? '正在起飞'
          : '空中俯瞰'
      : driving
        ? '沿实景路网驾驶'
        : '实景地图';
    ui['objective-title'].textContent = flight
      ? '高度 ' + Math.round(altitude - city.height(x, z)) + ' 米'
      : '内海湾两岸';
    ui['objective-detail'].textContent = flight
      ? touch()
        ? '摇杆移动，右侧滑动看风景'
        : '跟随镜头飞行 · 空格升高 / Q 降低'
      : 'F 或点「俯瞰」起飞 · 地图可选地标';
    stage.classList.toggle('driving', Boolean(driving));
    stage.toggleAttribute('data-flight', flight);
    stage.classList.remove('swimming', 'aboard', 'volley');
    ui.wanted.hidden = !alert.level;
    ui['wanted-stars'].textContent = '★'.repeat(alert.level) + '☆'.repeat(5 - alert.level);
    ui['wanted-stars'].setAttribute('aria-label', alert.level + ' 星通缉');
    ui['wanted-status'].textContent =
      alert.caught > 0
        ? '警方正在拦截'
        : alert.left > 0
          ? '警方搜索 · ' + Math.ceil(alert.left) + ' 秒后消星'
          : '警车追缉';
    ui.wanted.toggleAttribute('data-searching', alert.left > 0);
    const armed = weapon >= 0 && !flight && !driving && !swimming && !coast.riding;
    ui.crosshair.hidden = !armed;
    ui['foot-hud'].hidden = flight || Boolean(driving) || coast.riding;
    const weaponName = weapons[weapon]?.name || '徒手';
    ui['weapon-label'].textContent = weaponName;
    setIcon(ui['weapon-icon'], weapon >= 0 ? 'target' : 'fist');
    ui.ammo.textContent = armed
      ? store.data.arsenal[weapon].ammo + '/' + store.data.arsenal[weapon].stock
      : '';
    ui.vitals.firstElementChild.style.width = health + '%';
    ui['touch-attack-label'].textContent = coast.game ? '击球' : armed ? '开火' : '出拳';
    stage.toggleAttribute('data-armed', armed);
    stage.toggleAttribute('data-volley', Boolean(coast.game));
    ui['radio-control'].hidden = !driving;
    ui['radio-control'].title = audio.stationName;
    if (coast.riding) {
      ui['objective-label'].textContent = '广礐轮渡';
      ui['objective-title'].textContent = coast.canLeave ? '已靠岸' : '横渡内海湾';
    } else if (coast.game) {
      ui['objective-label'].textContent = '沙滩排球';
      ui['objective-title'].textContent = coast.game.player + ' : ' + coast.game.opponent;
      ui['objective-detail'].textContent = coast.message();
    } else if (race) {
      ui['objective-label'].textContent = '海湾竞速';
      ui['objective-title'].textContent = '检查点 ' + race.step + ' / ' + (raceRoute.length - 1);
      ui['objective-detail'].textContent = (clock - race.start).toFixed(1) + ' 秒';
    } else if (missions.step) {
      ui['objective-label'].textContent =
        missions.chapter.title + ' · ' + missions.progress.join(' / ');
      ui['objective-title'].textContent = missions.step.label;
      ui['objective-detail'].textContent = waypoint
        ? '当前导航 · ' + waypoint.name
        : '跟随金色任务标记';
    } else if (waypoint) {
      ui['objective-title'].textContent = waypoint.name;
      ui['objective-detail'].textContent = '跟随地图上的金色标记';
    } else if (!store.data.storyCompleted.includes('night') && !flight) {
      ui['objective-detail'].textContent = '找晚钟车库的阿岚接任务';
    }
    stage.classList.toggle('aboard', coast.riding);
    ui['drive-hud'].hidden = !driving;
    ui['real-mode-switch'].textContent = landing ? '取消降落' : flight ? '落地' : '俯瞰';
    ui['real-mode-switch'].hidden = Boolean(driving) || swimming || coast.riding;
    ui['real-height-controls'].hidden = !flight || !touch();
    ui['game-gloss'].classList.toggle('hurt', hurtUntil > clock + 0.55);
    ui['wallet-value'].textContent = String(store.data.coins);
    ui['health-value'].textContent = Math.ceil(health) + ' 生命';
    if (driving) {
      ui.speed.textContent = String(Math.round(Math.abs(driving.speed) * 3.6));
      ui.gear.textContent = driving.type === 'ebike' ? '骑' : driving.reverseGear ? 'R' : 'D';
      ui['gear-switch'].hidden = driving.type === 'ebike';
      ui['gear-switch'].setAttribute('aria-pressed', String(driving.reverseGear));
      ui['touch-brake-label'].textContent = '刹车';
      setIcon(ui['touch-brake-icon'], 'brake');
      ui.condition.style.width = '100%';
      ui['car-label'].textContent = driving.spec.name;
      ui['drive-status'].textContent = impact > 0.2 ? '发生碰撞' : '自由驾驶';
    }
    const canExit = driving && Math.abs(driving.speed) < 2.6;
    const service = nearbyAction();
    const treatment = nearbyHospital() && health < 100 && !alert.level;
    ui.interaction.hidden = !nearest && !canExit && !treatment && !service;
    if (service) {
      ui.interaction.querySelector('button > span').textContent = service.label;
      setIcon(ui['interaction-icon'], service.icon);
    } else if (treatment) {
      ui.interaction.querySelector('button > span').textContent = '在医院治疗';
      setIcon(ui['interaction-icon'], 'hospital');
    } else if (nearest || canExit) {
      ui.interaction.querySelector('button > span').textContent = canExit
        ? '下车'
        : life.traffic.includes(nearest) && !nearest.taken
          ? '抢车 · ' + nearest.spec.name
          : nearest.type === 'ebike'
            ? '骑上电动车'
            : '驾驶' + nearest.spec.name;
      setIcon(ui['interaction-icon'], canExit ? 'exit' : nearest.type === 'ebike' ? 'bike' : 'car');
    }
    drawMap(ui['map-mini'], false);
    if (inspect) {
      stage.dataset.inspection = JSON.stringify({
        mode: 'real',
        x,
        z,
        altitude,
        flight,
        landing: Boolean(landing),
        grounded,
        yaw,
        camera: camera.position.toArray(),
        velocity: velocity.toArray(),
        paused,
        speed: driving?.speed ?? null,
        vehicle: driving?.type ?? null,
        moving,
        sprinting: state.sprinting || pressing('sprint'),
        attack: attackUntil > clock,
        buildings: city.buildings,
        roadSegments: city.roads.length,
        draws: renderer.info.render.calls,
        health,
        wanted: alert.level,
        search: alert.left,
        patrols: alert.patrols.length,
        pedestrians: life.pedestrians,
        traffic: life.traffic.filter((ride) => ride.group.visible && !ride.taken).length,
        hospital: admitted,
        chapter: missions.chapter?.id,
        step: missions.progress?.[0],
        ferry: coast.riding,
        swimming,
        radio: audio.stationName,
      });
    }
  }

  function drawMap(canvas, detailed) {
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;
    const [left, top, right, bottom] = city.bounds;
    const scale = detailed
      ? Math.min((width - 24) / (right - left), (height - 20) / (bottom - top))
      : width / (flight ? 1500 : 220);
    const mapX = detailed ? (left + right) / 2 : x;
    const mapZ = detailed ? (top + bottom) / 2 : z;
    const map = ([px, pz]) => [(px - mapX) * scale + width / 2, (pz - mapZ) * scale + height / 2];
    const ctx = canvas.getContext('2d');
    let cached = mapCache.get(canvas);
    if (!detailed || !cached || cached.width !== width || cached.height !== height) {
      const base = detailed ? document.createElement('canvas') : canvas;
      if (detailed) {
        base.width = width;
        base.height = height;
        mapCache.set(canvas, base);
      }
      const paint = base.getContext('2d');
      paint.fillStyle = '#305c71';
      paint.fillRect(0, 0, width, height);
      paint.fillStyle = '#4e5753';
      for (const rings of city.land) {
        paint.beginPath();
        for (const ring of rings) {
          ring.forEach((point, i) =>
            i ? paint.lineTo(...map(point)) : paint.moveTo(...map(point)),
          );
          paint.closePath();
        }
        paint.fill('evenodd');
      }
      paint.strokeStyle = '#b9b1a4';
      paint.lineWidth = detailed ? 0.63 : 1.6;
      paint.beginPath();
      const roads = detailed ? city.roads : city.nearbyRoads(x, z, width / scale);
      for (const road of roads) {
        if (detailed && road.width < 4) continue;
        if (!detailed) {
          const margin = width / scale;
          if (
            Math.max(road.ax, road.bx) < x - margin ||
            Math.min(road.ax, road.bx) > x + margin ||
            Math.max(road.az, road.bz) < z - margin ||
            Math.min(road.az, road.bz) > z + margin
          )
            continue;
        }
        paint.moveTo(...map([road.ax, road.az]));
        paint.lineTo(...map([road.bx, road.bz]));
      }
      paint.stroke();
      if (detailed) {
        paint.font = 'bold 12px sans-serif';
        paint.fillStyle = '#ffe6ac';
        const placed = [];
        for (const { point, name } of city.places) {
          const [px, pz] = map(point);
          paint.beginPath();
          paint.arc(px, pz, 3.2, 0, Math.PI * 2);
          paint.fill();
          const label =
            {
              小公园中山纪念亭: '小公园',
              潮汕历史文化博览中心: '潮博馆',
              南生百货大楼: '南生百货',
            }[name] || name;
          const textWidth = paint.measureText(label).width;
          const x = Math.min(width - textWidth - 6, px + 6);
          const options = [4, -9, 17, -22, 30, -35];
          const offset = options.find(
            (offset) =>
              !placed.some(
                (other) =>
                  x < other.x + other.width &&
                  x + textWidth > other.x &&
                  Math.abs(pz + offset - other.y) < 12,
              ),
          );
          if (offset !== undefined) {
            const y = pz + offset;
            paint.fillText(label, x, y);
            placed.push({ x, y, width: textWidth });
          }
        }
        cached = base;
      }
    }
    if (detailed) ctx.drawImage(cached, 0, 0);
    if (!detailed && !flight) {
      ctx.fillStyle = '#ffe3a2';
      for (const ride of rides) {
        if (driving === ride) continue;
        const [carX, carZ] = map([ride.x, ride.z]);
        if (carX < 0 || carX > width || carZ < 0 || carZ > height) continue;
        ctx.fillRect(carX - 2, carZ - 2, 5, 5);
      }
    }
    ctx.fillStyle = '#f090bd';
    for (const patrol of alert.patrols) {
      const [px, pz] = map([patrol.x, patrol.z]);
      ctx.beginPath();
      ctx.arc(px, pz, detailed ? 3 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const target = objectivePoint();
    if (target) {
      const [tx, tz] = map(target);
      ctx.fillStyle = '#ffdc73';
      ctx.beginPath();
      ctx.arc(clamp(tx, 6, width - 6), clamp(tz, 6, height - 6), 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    const [px, pz] = map([x, z]);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-facing);
    ctx.fillStyle = '#7bf4d4';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function objectivePoint() {
    return race
      ? raceRoute[race.step]
      : waypoint?.point ||
          missions.step?.point ||
          (!store.data.storyCompleted.includes('night') ? points.garage : null);
  }

  function locate(id = city.places[0].id) {
    const location = city.places.find((place) => place.id === id);
    if (!location) return;
    life.relocate();
    coast.reset();
    swimming = false;
    home = location;
    driving = null;
    flight = false;
    launchHeight = landing = null;
    velocity.set(0, 0, 0);
    grounded = true;
    viewBlend = 0;
    lift = moving = impact = 0;
    [x, z] = location.arrival || city.spawn(location.point);
    altitude = city.height(x, z);
    yaw = facing = Math.atan2(x - location.point[0], z - location.point[1]);
    pitch = 0.09;
    camera.near = 0.28;
    camera.updateProjectionMatrix();
    updateHud();
    updateCamera(true);
  }

  function updateCamera(immediate = false, dt = 0.016) {
    const [fx, fz] = forward(yaw);
    const cameraPitch = flight ? pitch : clamp(pitch, -0.35, 0.62);
    const horizontal = Math.cos(cameraPitch);
    const lookY = -Math.sin(cameraPitch);
    const eye = altitude + (driving ? 1.55 : 1.66);
    const distance = driving
      ? (driving.type === 'ebike' ? 5.9 : 7.6) + Math.abs(driving.speed) * 0.065
      : 4.5;
    viewBlend = immediate ? Number(flight) : damp(viewBlend, Number(flight), 5, dt);
    const arm = distance * (1 - viewBlend);
    let safe = arm;
    for (let check = 0.34; check <= arm + 0.24; check += 0.27) {
      const sample = Math.min(check, arm);
      const px = x - fx * horizontal * sample;
      const pz = z - fz * horizontal * sample;
      const y = eye - lookY * sample;
      if (y < city.height(px, pz) + 0.26 || city.blocked(px, pz, y - 0.2, y + 0.2, 0.21)) {
        safe = Math.max(0.12, sample - 0.3);
        break;
      }
    }
    cameraArm = immediate || safe < cameraArm ? safe : damp(cameraArm, safe, 4.8, dt);
    const glance =
      driving && impact > 0 && store.data.settings.movement
        ? Math.sin(impact * 30) * impact * 0.23
        : 0;
    desired.set(
      x - fx * horizontal * cameraArm,
      eye - lookY * cameraArm + glance,
      z - fz * horizontal * cameraArm,
    );
    desired.y = Math.max(desired.y, city.height(desired.x, desired.z) + 0.28);
    camera.position.copy(desired);
    heading.set(fx * horizontal, lookY, fz * horizontal);
    focus.copy(desired).add(heading);
    camera.lookAt(focus);
  }

  function toggleFlight() {
    if (landing) {
      landing = null;
      velocity.set(0, 0, 0);
    } else if (flight) {
      const spot = city.landingAt(x, z, altitude);
      if (!spot) {
        callbacks.toast('附近没有可落地的位置，先飞向岸边。');
        return;
      }
      launchHeight = null;
      landing = spot;
    } else {
      grounded = false;
      flight = true;
      launchHeight = altitude + 30;
      velocity.set(0, 0, 0);
      lift = 0;
      camera.near = 2;
      camera.updateProjectionMatrix();
    }
    updateHud();
  }

  function action(name, menu = false) {
    if (name === 'radio' && active && (!paused || menu)) {
      callbacks.toast('电台 · ' + audio.cycleStation());
      updateHud();
      return;
    }
    if (!active || paused) return;
    if (name === 'lock-mouse') {
      if (touch()) return;
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      } else {
        try {
          canvas.requestPointerLock?.()?.catch?.(() => {});
        } catch {
          /* Unlocked mouse look is available. */
        }
      }
      return;
    }
    const service = name === 'use' ? nearbyAction() : null;
    if (service) {
      service.run();
      updateHud();
      return;
    }
    if (name === 'pause' || name === 'map') {
      pause();
      callbacks.panel(name);
    } else if (name === 'fire') {
      fire();
    } else if (name === 'reload') {
      reload();
    } else if (name === 'aim') {
      aiming = !aiming;
      updateHud();
    } else if (name === 'switch' && !flight && !driving) {
      const slots = [
        -1,
        ...weapons.map((_, index) => index).filter((index) => hasWeapon(store.data, index)),
      ];
      weapon = slots[(slots.indexOf(weapon) + 1) % slots.length];
      updateHud();
    } else if (name === 'survey' && !driving && !coast.riding && !swimming) {
      toggleFlight();
    } else if (name === 'jump' && !flight && !driving && grounded && !coast.riding && !swimming) {
      lift = 6.5;
      grounded = false;
    } else if (
      name === 'gear' &&
      driving &&
      !driving.spec.noReverse &&
      Math.abs(driving.speed) < 1
    ) {
      driving.reverseGear = !driving.reverseGear;
      driving.driveInput = driving.reverseWait = driving.speed = 0;
      updateHud();
    } else if (name === 'use' && !flight) {
      if (nearbyHospital() && health < 100 && !alert.level) {
        health = 100;
        audio.cue('mark');
        callbacks.toast('治疗完成，生命已恢复');
        updateHud();
        return;
      }
      if (driving && Math.abs(driving.speed) < 2.6) {
        const side = [
          driving.x + Math.cos(driving.yaw) * 1.8,
          driving.z - Math.sin(driving.yaw) * 1.8,
        ];
        [x, z] = city.clear(...side) ? side : [driving.x, driving.z];
        driving.speed = 0;
        driving = null;
        altitude = city.height(x, z);
      } else if (!driving && nearest) {
        driving = nearest;
        if (life.traffic.includes(driving) && !driving.taken) {
          driving.taken = true;
          life.offense(1, '抢走街道车辆', x, z);
        }
        driving.steer = driving.driveInput = driving.reverseWait = 0;
        driving.reverseGear = false;
        driving.travelYaw = driving.yaw;
        yaw = driving.yaw;
        lift = 0;
        velocity.set(0, 0, 0);
        x = driving.x;
        z = driving.z;
        altitude = city.height(x, z);
        lastLook = clock;
      }
      updateHud();
    }
  }

  function rideFits(px, pz, ride, size) {
    if (!city.clear(px, pz, size)) return false;
    const [fx, fz] = forward(ride.yaw);
    const end = ride.type === 'ebike' ? 0.45 : (ride.spec.length || 4.35) * 0.27;
    const roadHeight = city.height(px, pz);
    for (const parked of rides) {
      if (parked === ride || Math.abs(city.height(parked.x, parked.z) - roadHeight) > 2) continue;
      if (Math.hypot(parked.x - px, parked.z - pz) < 1.5) return false;
    }
    return [-end, end].every((offset) => {
      const x = px + fx * offset;
      const z = pz + fz * offset;
      return city.clear(x, z, size) && Math.abs(city.height(x, z) - roadHeight) < 1.2;
    });
  }

  function moveRide(dt, lateral) {
    const spec = driving.spec;
    const [vx, vz] = drive(
      driving,
      spec,
      {
        gas: pressing('KeyW', 'ArrowUp', 'gas'),
        brake: pressing('KeyS', 'ArrowDown', 'reverse'),
        handbrake: pressing('Space', 'hand'),
        steering: clamp(-lateral, -1, 1),
        reverse: driving.reverseGear,
      },
      dt,
    );
    const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.32));
    const dx = (vx * dt) / steps;
    const dz = (vz * dt) / steps;
    for (let i = 0; i < steps; i++) {
      const other = [...life.traffic, ...alert.patrols].find(
        (actor) =>
          actor !== driving &&
          actor.group.visible &&
          Math.hypot(actor.x - (x + dx), actor.z - (z + dz)) < 2.4 &&
          Math.abs(actor.group.position.y - altitude) < 2.4,
      );
      if (other && Math.abs(driving.speed) > 1.6) {
        const speed = Math.abs(driving.speed);
        driving.speed *= -0.18;
        impact = 0.41;
        if (clock >= hurtUntil && speed > 6) {
          const isPolice = other.type === 'patrol';
          life.offense(isPolice ? 2 : 1, isPolice ? '撞上警车' : '撞上街道车辆', x, z);
          if (damage(speed * 2.8, '车辆碰撞')) return;
        }
        break;
      }
      if (rideFits(x + dx, z + dz, driving, spec.size)) {
        x += dx;
        z += dz;
      } else {
        const speed = Math.abs(driving.speed);
        if (Math.abs(dx) >= Math.abs(dz) && rideFits(x + dx * 0.45, z, driving, spec.size))
          x += dx * 0.45;
        else if (rideFits(x, z + dz * 0.45, driving, spec.size)) z += dz * 0.45;
        driving.speed *= speed > 7 && impact < 0.15 ? -0.16 : 0.28;
        if (speed > 3.5) impact = Math.min(0.62, speed * 0.045);
        if (speed > 8 && damage((speed - 4) * 3.1, '高速撞击')) return;
        break;
      }
    }
    driving.x = x;
    driving.z = z;
    altitude = city.height(x, z);
    const [fx, fz] = forward(driving.yaw);
    const grade = city.height(x - fx, z - fz) - city.height(x + fx, z + fz);
    driving.pitch = damp(driving.pitch || 0, Math.atan2(grade, 2), 9, dt);
    const lean = driving.type === 'ebike' ? 0.32 : 0.08;
    driving.roll = damp(
      driving.roll || 0,
      -driving.steer * lean * Math.min(1, Math.abs(driving.speed) / 8),
      8,
      dt,
    );
    driving.articulateSteering?.(driving.steer);
    for (const wheel of driving.wheels)
      wheel.rotateX((-driving.speed * dt) / (driving.type === 'ebike' ? 0.23 : 0.45));
    syncRide(driving);
    facing = driving.yaw;
    if (Math.abs(driving.speed) > 1.2 && clock - lastLook > 1.05) {
      yaw += angleBetween(facing, yaw) * (1 - Math.exp(-2.25 * dt));
    }
    audio.engine(driving.speed, driving.type !== 'ebike', false);
  }

  function fly(dt, lateral, depth, sprint) {
    const [fx, fz] = forward(yaw);
    let vx;
    let vz;
    let vy;
    if (landing) {
      const dx = landing[0] - x;
      const dz = landing[2] - z;
      const gap = Math.hypot(dx, dz);
      const clearance =
        Math.max(landing[1], city.support(x, z), city.support(x + dx * 0.5, z + dz * 0.5)) + 3;
      const glide =
        altitude < clearance && gap > 1 ? 0 : Math.min(16, gap * 2.8) / Math.max(0.001, gap);
      vx = dx * glide;
      vz = dz * glide;
      const height = altitude - landing[1];
      vy =
        gap > 1
          ? clamp((clearance + 1 - altitude) * 2, -14, 16)
          : -Math.min(48, Math.max(2.4, height * 1.75));
    } else {
      const pace = (32 + Math.max(0, altitude - city.height(x, z)) * 0.34) * (sprint ? 2.5 : 1);
      const rise = Number(pressing('Space', 'survey-up')) - Number(pressing('KeyQ', 'survey-down'));
      if (rise < 0) launchHeight = null;
      if (launchHeight !== null && altitude >= launchHeight - 0.25) launchHeight = null;
      const elevation = -Math.sin(pitch) * depth + rise;
      const planar = Math.cos(pitch) * depth;
      const norm = Math.max(1, Math.hypot(planar, lateral, elevation));
      vx = ((fx * planar + Math.cos(yaw) * lateral) * pace) / norm;
      vz = ((fz * planar - Math.sin(yaw) * lateral) * pace) / norm;
      vy =
        launchHeight !== null && !rise
          ? Math.min(28, (launchHeight - altitude) * 2.5)
          : (elevation * pace) / norm;
    }
    velocity.x = damp(velocity.x, vx, landing ? 9 : 5, dt);
    velocity.y = damp(velocity.y, vy, landing ? 9 : 5, dt);
    velocity.z = damp(velocity.z, vz, landing ? 9 : 5, dt);
    const steps = Math.max(1, Math.ceil((velocity.length() * dt) / 0.7));
    for (let i = 0; i < steps; i++) {
      const step = dt / steps;
      const nearLanding = landing && Math.hypot(x - landing[0], z - landing[2]) < 0.65;
      const minHeight = nearLanding ? landing[1] : city.height(x, z) + (landing ? 0 : 1.3);
      const ny = clamp(altitude + velocity.y * step, minHeight, 820);
      if (!city.blocked(x, z, ny + 0.09, ny + 1.78, 0.32)) altitude = ny;
      else velocity.y = 0;
      const nx = clamp(x + velocity.x * step, city.bounds[0] + 2, city.bounds[2] - 2);
      const nz = clamp(z + velocity.z * step, city.bounds[1] + 2, city.bounds[3] - 2);
      if (
        altitude + 0.14 >= city.height(nx, z) &&
        !city.blocked(nx, z, altitude + 0.09, altitude + 1.78, 0.34)
      )
        x = nx;
      else velocity.x = 0;
      if (
        altitude + 0.14 >= city.height(x, nz) &&
        !city.blocked(x, nz, altitude + 0.09, altitude + 1.78, 0.34)
      )
        z = nz;
      else velocity.z = 0;
      if (
        landing &&
        Math.hypot(x - landing[0], z - landing[2]) < 0.65 &&
        altitude <= landing[1] + 0.42
      ) {
        [x, altitude, z] = landing;
        flight = false;
        landing = null;
        grounded = true;
        velocity.set(0, 0, 0);
        camera.near = 0.28;
        camera.updateProjectionMatrix();
        break;
      }
    }
    facing = yaw;
  }

  function move(dt) {
    const [lookX, lookY] = input.readLook(dt);
    const directionTurn = driving
      ? 0
      : Number(pressing('ArrowRight')) - Number(pressing('ArrowLeft'));
    if (directionTurn && keyTurn * directionTurn < 0) keyTurn = 0;
    keyTurn = directionTurn ? damp(keyTurn, directionTurn * 1.6, 5, dt) : 0;
    if (lookX || lookY || keyTurn) lastLook = clock;
    const sensitivity = touch() ? 0.9 : 0.72;
    yaw -= lookX * sensitivity + keyTurn * dt;
    pitch = clamp(pitch + lookY * sensitivity, flight ? -1.11 : -0.35, flight ? 1.18 : 0.64);
    impact = Math.max(0, impact - dt);
    const lateral =
      Number(pressing('KeyD') || (driving && pressing('ArrowRight'))) -
      Number(pressing('KeyA') || (driving && pressing('ArrowLeft'))) + state.x;
    const depth =
      Number(pressing('KeyW', 'ArrowUp')) - Number(pressing('KeyS', 'ArrowDown')) - state.y;
    if (driving) {
      moveRide(dt, lateral);
      return;
    }
    audio.engine(0, false, false);
    const sprint = state.sprinting || pressing('sprint');
    if (flight) {
      fly(dt, lateral, depth, sprint);
      return;
    }
    if (coast.riding) return;
    const pace = swimming ? 3.6 : sprint ? 9.6 : 4.8;
    const [fx, fz] = forward(yaw);
    const norm = Math.max(1, Math.hypot(lateral, depth));
    const response = grounded ? 14 : 5;
    velocity.x = damp(
      velocity.x,
      ((fx * depth + Math.cos(yaw) * lateral) * pace) / norm,
      response,
      dt,
    );
    velocity.z = damp(
      velocity.z,
      ((fz * depth - Math.sin(yaw) * lateral) * pace) / norm,
      response,
      dt,
    );
    const lastX = x;
    const lastZ = z;
    const tryWalk = (px, pz) => {
      if (!city.canStand(px, pz)) return city.swimAt(px, pz) && altitude < 2;
      if (swimming) return city.clear(px, pz, 0.36) && city.height(px, pz) < 1.4;
      const surface = city.support(px, pz, altitude + 0.43);
      if (surface > altitude + 0.43) return false;
      const y = Math.max(altitude, surface);
      return !city.blocked(px, pz, y + 0.08, y + 1.72, 0.36);
    };
    if (tryWalk(x + velocity.x * dt, z)) x += velocity.x * dt;
    else velocity.x = 0;
    if (tryWalk(x, z + velocity.z * dt)) z += velocity.z * dt;
    else velocity.z = 0;
    moving = Math.hypot(x - lastX, z - lastZ) / dt;
    if (attackUntil > clock) {
      facing = yaw;
    } else if (moving > 0.12) {
      const target = Math.atan2(lastX - x, lastZ - z);
      facing += angleBetween(target, facing) * (1 - Math.exp(-18 * dt));
    }
    swimming = city.swimAt(x, z);
    stage.classList.toggle('swimming', swimming);
    if (swimming) {
      altitude = -1.92 + Math.sin(clock * 4) * 0.06;
      grounded = true;
      return;
    }
    const floor = city.support(x, z, altitude + 0.43);
    if (grounded && floor < altitude - 0.43) grounded = false;
    lift = grounded ? 0 : lift - dt * 19;
    const nextY = altitude + lift * dt;
    if (grounded || nextY <= floor) {
      altitude = floor;
      lift = 0;
      grounded = true;
    } else if (!city.blocked(x, z, nextY + 0.07, nextY + 1.74, 0.34)) {
      altitude = nextY;
    } else lift = Math.min(0, lift);
  }

  function animate(at) {
    frame = 0;
    if (!active || stage.hidden) return;
    frame = requestAnimationFrame(animate);
    const elapsed = at - tick;
    const dt = Math.max(0.001, Math.min(0.09, elapsed / 1000));
    tick = at;
    if (!viewActive || document.hidden) return;
    if (cinematic) {
      renderCinematic(dt);
      return;
    }
    if (paused) return;
    if (elapsed > 0 && elapsed < 200) frameMean += (elapsed - frameMean) * 0.055;
    if (++sampleFrames >= 42 && store.data.settings.graphics !== 'normal') {
      sampleFrames = 0;
      const scale =
        frameMean > 34
          ? Math.max(0.66, pixelScale - 0.12)
          : frameMean < 20
            ? Math.min(1, pixelScale + 0.07)
            : pixelScale;
      if (scale !== pixelScale) {
        pixelScale = scale;
        resize();
      }
    }
    clock += dt;
    const steps = Math.ceil(dt / 0.035);
    for (let i = 0; i < steps && !paused; i++) move(dt / steps);
    if (paused) return;
    if (!coast.game && (state.fire || pressing('Enter', 'fire'))) fire();
    coast.update(dt, clock, ferryRider);
    if (coast.riding) {
      [x, z, altitude] = [ferryRider.x, ferryRider.z, coast.elevation];
      facing = ferryRider.yaw;
    }
    extras.update(clock, dt, x, z);
    if (waypoint && Math.hypot(x - waypoint.point[0], z - waypoint.point[1]) < 8) waypoint = null;
    if (!flight && !coast.riding) missions.update(x, z, driving, swimming);
    if (
      race &&
      driving &&
      Math.hypot(x - raceRoute[race.step][0], z - raceRoute[race.step][1]) < 18
    ) {
      audio.cue('mark');
      if (++race.step === raceRoute.length) {
        const elapsed = clock - race.start;
        const best = store.data.best === null || elapsed < store.data.best;
        if (best) store.data.best = elapsed;
        store.data.coins += 90;
        store.write();
        race = null;
        callbacks.result('race', { elapsed, best, reward: 90 });
      }
    }
    if (coast.game && coast.status === 'over' && coast.game.player === 5 && !matchPaid) {
      matchPaid = true;
      store.data.coins += 25;
      store.write();
      callbacks.toast('排球获胜 · +25 潮票');
    }
    if (paused) return;
    const target = objectivePoint();
    beacon.visible = Boolean(target) && Math.hypot(x - target[0], z - target[1]) < 500;
    if (beacon.visible) {
      beacon.position.set(target[0], city.height(...target), target[1]);
      diamond.rotation.y = clock;
    }
    const step = missions.step || missions.nextChapter?.steps[0];
    contacts.group.visible = Boolean(
      step?.type === 'talk' && Math.hypot(x - step.point[0], z - step.point[1]) < 50,
    );
    if (contacts.group.visible) {
      contacts.group.position.set(step.point[0], city.height(...step.point) + 0.1, step.point[1]);
      contacts.group.rotation.y = Math.atan2(step.point[0] - x, step.point[1] - z);
      contacts.animate({ speed: 0, dt });
    }
    life.update(dt, { x, z, altitude }, driving, rides);
    if (paused) return;
    if (Math.floor(clock * 8) !== Math.floor((clock - dt) * 8)) {
      updateHud();
    }
    const riding = driving?.type === 'ebike';
    pedestrian.group.visible = !flight && (!driving || riding);
    const localSurface = city.support(x, z, altitude + 0.12);
    const pavement = localSurface <= city.height(x, z) + 0.015 ? city.pavementHeight(x, z) : 0;
    if (pedestrian.group.visible) {
      pedestrian.group.position.set(x, altitude + pavement + 0.012, z);
      pedestrian.group.rotation.set(
        swimming ? 1.07 : driving?.pitch || 0,
        facing,
        driving?.roll || 0,
        'YXZ',
      );
      pedestrian.animate({
        speed: riding ? 0 : moving,
        airborne: !grounded,
        riding,
        steer: driving?.steer,
        strike: Math.sin(Math.PI * clamp((attackUntil - clock) / (weapon < 0 ? 0.29 : 0.18), 0, 1)),
        armed: weapon >= 0,
        dt,
      });
    }
    footShadow.visible = !flight && !driving;
    if (footShadow.visible) {
      footShadow.position.set(x + 0.13, localSurface + pavement + 0.024, z - 0.1);
      footShadow.material.opacity = 0.22 / (1 + Math.max(0, altitude - localSurface) * 2.7);
    }
    updateCamera(false, dt);
    const outside = flight || altitude - city.height(x, z) > 40;
    const tile = [Math.floor(x / 160), Math.floor(z / 160), outside, low()].join(':');
    if (sceneTile !== tile) {
      sceneTile = tile;
      const range = outside ? (low() ? 2550 : 3500) : low() ? 1150 : 1600;
      city.updateVisibility(x, z, range);
      for (const ride of rides) {
        ride.group.visible = ride === driving || Math.hypot(ride.x - x, ride.z - z) < range * 0.26;
      }
    }
    city.updateWater(clock + (cinematic?.elapsed || 0), store.data.settings.movement);
    renderer.render(scene, camera);
  }

  ui['cinematic-skip'].addEventListener('click', finishCinematic);
  ui.cinematic.addEventListener('keydown', (event) => {
    if (!active || !cinematic || event.key !== 'Escape' || event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    finishCinematic();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (active) {
      clearCinematic();
      pause();
      callbacks.result('context', {});
    }
  });

  function choose(mode, selection) {
    if (mode === 'garage') prepareGarageCar();
    if (mode === 'story') {
      missions.select(selection);
      waypoint = null;
    } else {
      const id = selection || shortcuts[mode];
      const place = city.places.find((entry) => entry.id === id);
      if (place) waypoint = { ...place, point: place.arrival || place.point };
      if (
        mode === 'race' ||
        mode === 'beach' ||
        mode === 'ferry' ||
        mode === 'training' ||
        mode === 'gang' ||
        mode === 'garage'
      ) {
        callbacks.toast('已标记 · ' + (place?.name || '目的地'));
      }
    }
    pause(false);
    updateHud();
  }

  return {
    get running() {
      return active;
    },
    get health() {
      return health;
    },
    buyMeal,
    choose,
    navigate(id) {
      choose('free', id);
    },
    retry() {
      choose('free');
    },
    get places() {
      return city.places;
    },
    get paused() {
      return paused;
    },
    get inCinematic() {
      return Boolean(cinematic);
    },
    focusCinematic,
    launch(mode, selection) {
      active = true;
      admitted = false;
      health = 100;
      hurtUntil = 0;
      life.reset();
      sceneTile = '';
      prepareGarageCar();
      for (const ride of rides) placeCar(ride);
      locate();
      missions.resume();
      resize();
      if (store.data.hospitalLoss !== null) arriveHospital('继续上次住院');
      else if (!openingPlayed) {
        openingPlayed = true;
        playCinematic(openingShots, () => choose(mode, selection));
      } else choose(mode, selection);
      if (!frame) frame = requestAnimationFrame(animate);
    },
    view(value) {
      viewActive = value;
      if (!value) pause();
    },
    reset() {
      pause();
      clearCinematic();
      life.reset();
      active = false;
      cancelAnimationFrame(frame);
      frame = 0;
      stage.removeAttribute('data-flight');
    },
    recover() {
      if (alert.level) {
        callbacks.toast('通缉解除后可使用脱困');
        pause(false);
        return;
      }
      locate(home?.id);
      pause(false);
    },
    discharge() {
      admitted = false;
      store.data.hospitalLoss = null;
      store.write();
      pause(false);
      updateHud();
    },
    pause,
    resize,
    action,
    drawMap,
    locate(id) {
      if (alert.level) {
        callbacks.toast('通缉解除后可快速前往地标');
        return false;
      }
      locate(id);
      return true;
    },
  };
}
