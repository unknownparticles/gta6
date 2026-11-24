import * as T from 'three';
import { cars } from './data.js';
import { drive } from './driving.js';
import { setIcon } from './icons.js';
import { createInput } from './input.js';
import { createRealCity } from './real-city.js';
import { lightRealCity } from './real-light.js';
import { loadRealMaterials } from './real-materials.js';
import { detailedRide, loadDetailModels, streetWalker } from './street-models.js';
import { loadModels, loadStreetCars, vehicleModel } from './world.js';

const clamp = T.MathUtils.clamp;
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const angleBetween = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const damp = (current, goal, rate, dt) => T.MathUtils.lerp(current, goal, 1 - Math.exp(-rate * dt));
const inspect = import.meta.env.DEV && new URLSearchParams(location.search).has('inspect');
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
};

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
  renderer.toneMappingExposure = 1.13;
  const [data, elevation, models, materials] = await Promise.all([
    readMap('inner-bay-v3.json'),
    readMap('inner-bay-elevation-v3.json'),
    loadDetailModels(renderer),
    loadRealMaterials(renderer),
    loadModels(),
    loadStreetCars(),
  ]).catch((error) => {
    renderer.dispose();
    throw error;
  });
  const scene = new T.Scene();
  const low = () => touch() || store.data.settings.graphics === 'low';
  const updateShadow = lightRealCity(renderer, scene, low);
  const city = createRealCity(scene, data, elevation, materials, models['plane-tree']);
  const camera = new T.PerspectiveCamera(62, 1, 0.28, 14000);
  const focus = new T.Vector3();
  const desired = new T.Vector3();
  const heading = new T.Vector3();
  const pedestrian = streetWalker(models.walker);
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

  const rides = city.places.flatMap(({ id, point }) =>
    districtFleet[id].map((type, index) => {
      const spec = streetCars[type];
      const tint = ['taxi', 'suv', 'delivery'].includes(type) ? undefined : spec.color;
      const model =
        type === 'ebike' || type === 'coupe'
          ? detailedRide(models[type === 'ebike' ? 'motor-scooter' : 'electric-gt'], type)
          : vehicleModel(type, tint);
      scene.add(model.group);
      return { ...model, type, spec, point, index, x: 0, z: 0, speed: 0, yaw: 0, hp: 100 };
    }),
  );
  let active = false;
  let paused = true;
  let flight = false;
  let frame = 0;
  let tick = 0;
  let clock = 0;
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
  let impact = 0;
  let yaw = 0;
  let pitch = 0.09;
  let facing = 0;
  let moving = 0;
  let driving;
  let nearest;
  let home;
  const mapCache = new WeakMap();
  const input = createInput(canvas, stage, action, () => active && !paused, touch);
  const { held, state } = input;
  const pressing = (...codes) => codes.some((code) => held.has(code));

  function syncRide(ride) {
    const pavement = city.pavementHeight(ride.x, ride.z);
    ride.group.position.set(ride.x, city.height(ride.x, ride.z) + pavement + 0.012, ride.z);
    ride.group.rotation.set(ride.pitch || 0, ride.yaw, ride.roll || 0, 'YXZ');
  }

  function pause(value = true) {
    paused = value;
    input.clear();
    if (paused) {
      audio.pause();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    } else {
      tick = performance.now();
      canvas.focus({ preventScroll: true });
    }
  }

  function resize() {
    if (!active || stage.hidden || !stage.clientWidth || !stage.clientHeight) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, low() ? 0.83 : 1.22));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    stage.classList.toggle('touch-mode', touch());
    ui.touch.hidden = !touch();
  }

  function updateHud() {
    nearest =
      !flight && !landing && !driving && grounded
        ? rides
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
    ui.wanted.hidden = true;
    ui.crosshair.hidden = true;
    ui['foot-hud'].hidden = true;
    ui['drive-hud'].hidden = !driving;
    ui['real-mode-switch'].textContent = landing ? '取消降落' : flight ? '落地' : '俯瞰';
    ui['real-mode-switch'].hidden = Boolean(driving);
    ui['real-height-controls'].hidden = !flight || !touch();
    ui['game-gloss'].classList.remove('hurt');
    ui['wallet-value'].textContent = String(store.data.coins);
    ui['health-value'].textContent = '100 生命';
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
    ui.interaction.hidden = !nearest && !canExit;
    if (nearest || canExit) {
      ui.interaction.querySelector('button > span').textContent = canExit
        ? '下车'
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
        buildings: city.buildings,
        roadSegments: city.roads.length,
        draws: renderer.info.render.calls,
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

  function locate(id = city.places[0].id) {
    const location = city.places.find((place) => place.id === id);
    if (!location) return;
    home = location;
    driving = null;
    flight = false;
    launchHeight = landing = null;
    velocity.set(0, 0, 0);
    grounded = true;
    viewBlend = 0;
    lift = moving = impact = 0;
    [x, z] = city.spawn(location.point);
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

  function action(name) {
    if (!active || paused) return;
    if (name === 'pause' || name === 'map') {
      pause();
      callbacks.panel(name);
    } else if (name === 'survey' && !driving) {
      toggleFlight();
    } else if (name === 'jump' && !flight && !driving && grounded) {
      lift = 5.9;
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
    if (driving.articulate) driving.articulate(driving.speed, driving.steer, dt);
    else for (const wheel of driving.wheels) wheel.rotateX((-driving.speed * dt) / 0.45);
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
    if (state.lookX || state.lookY) lastLook = clock;
    const sensitivity = touch() ? 0.9 : 0.72;
    yaw -= state.lookX * sensitivity;
    pitch = clamp(pitch + state.lookY * sensitivity, flight ? -1.11 : -0.35, flight ? 1.18 : 0.64);
    state.lookX = state.lookY = 0;
    impact = Math.max(0, impact - dt);
    const lateral =
      Number(pressing('KeyD', 'ArrowRight')) - Number(pressing('KeyA', 'ArrowLeft')) + state.x;
    const depth =
      Number(pressing('KeyW', 'ArrowUp')) - Number(pressing('KeyS', 'ArrowDown')) - state.y;
    if (driving) {
      moveRide(dt, lateral);
      return;
    }
    audio.engine(0, false, false);
    const sprint = pressing('ShiftLeft', 'ShiftRight', 'sprint');
    if (flight) {
      fly(dt, lateral, depth, sprint);
      return;
    }
    const pace = sprint ? 8.5 : 4.8;
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
      if (!city.canStand(px, pz)) return false;
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
    if (moving > 0.12) {
      const target = Math.atan2(lastX - x, lastZ - z);
      facing += angleBetween(target, facing) * (1 - Math.exp(-18 * dt));
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
    const dt = Math.max(0.001, Math.min(0.09, (at - tick) / 1000));
    tick = at;
    if (paused || document.hidden) return;
    clock += dt;
    const steps = Math.ceil(dt / 0.035);
    for (let i = 0; i < steps; i++) move(dt / steps);
    if (Math.floor(clock * 8) !== Math.floor((clock - dt) * 8)) {
      updateHud();
    }
    const riding = driving?.type === 'ebike';
    pedestrian.group.visible = !flight && (!driving || riding);
    const localSurface = city.support(x, z, altitude + 0.12);
    const pavement = localSurface <= city.height(x, z) + 0.015 ? city.pavementHeight(x, z) : 0;
    if (pedestrian.group.visible) {
      pedestrian.group.position.set(x, altitude + pavement + 0.012, z);
      pedestrian.group.rotation.set(driving?.pitch || 0, facing, driving?.roll || 0, 'YXZ');
      pedestrian.animate({
        speed: riding ? 0 : moving,
        airborne: !grounded,
        riding,
        steer: driving?.steer,
        dt,
      });
    }
    footShadow.visible = !flight && !driving;
    if (footShadow.visible) {
      footShadow.position.set(x + 0.13, localSurface + pavement + 0.024, z - 0.1);
      footShadow.material.opacity = 0.22 / (1 + Math.max(0, altitude - localSurface) * 2.7);
    }
    updateCamera(false, dt);
    updateShadow(x, z, altitude, flight);
    renderer.render(scene, camera);
  }

  canvas.addEventListener('click', () => {
    if (paused || !active || touch() || document.pointerLockElement === canvas) return;
    try {
      canvas.requestPointerLock?.()?.catch?.(() => {});
    } catch {
      /* Unlocked mouse look is available. */
    }
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (active) callbacks.result('context', {});
  });

  return {
    real: true,
    get places() {
      return city.places;
    },
    get paused() {
      return paused;
    },
    launch() {
      active = true;
      for (const ride of rides) {
        [ride.x, ride.z] = city.spawn(
          [ride.point[0] + 14 + ride.index * 7, ride.point[1] + 11 + ride.index * 12],
          ride.spec.size,
        );
        ride.yaw = city.roadAngle(ride.x, ride.z);
        ride.speed = ride.pitch = ride.roll = 0;
        syncRide(ride);
      }
      locate();
      resize();
      pause(false);
      if (!frame) frame = requestAnimationFrame(animate);
    },
    view(value) {
      if (!value) pause();
    },
    reset() {
      pause();
      active = false;
      cancelAnimationFrame(frame);
      frame = 0;
      stage.removeAttribute('data-flight');
    },
    recover() {
      locate(home?.id);
      pause(false);
    },
    pause,
    resize,
    action,
    drawMap,
    locate,
  };
}
