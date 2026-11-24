import * as T from 'three';
import { cars } from './data.js';
import { drive } from './driving.js';
import { setIcon } from './icons.js';
import { createInput } from './input.js';
import { createRealCity } from './real-city.js';
import { loadModels, personModel, vehicleModel } from './world.js';

const clamp = T.MathUtils.clamp;
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const inspect = import.meta.env.DEV && new URLSearchParams(location.search).has('inspect');

export async function createRealDrive({ stage, touch, store, audio, onLoad, callbacks }) {
  onLoad('正在读取内海湾真实路网和建筑轮廓');
  async function readMap(file) {
    const response = await fetch(import.meta.env.BASE_URL + 'maps/' + file);
    if (!response.ok) throw new Error('内海湾地图加载失败');
    return response.json();
  }
  const [data, elevation] = await Promise.all([
    readMap('inner-bay.json'),
    readMap('inner-bay-elevation.json'),
    loadModels(),
  ]);
  const canvas = stage.querySelector('#real-world');
  const ui = Object.fromEntries([...stage.querySelectorAll('[id]')].map((node) => [node.id, node]));
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  const scene = new T.Scene();
  scene.background = new T.Color(0x9ebdc9);
  scene.fog = new T.Fog(0x9ebdc9, 1200, 9000);
  scene.add(new T.HemisphereLight(0xfff0dc, 0x7d8a9b, 2.05));
  const sun = new T.DirectionalLight(0xffe1be, 1.75);
  sun.position.set(-480, 680, 270);
  scene.add(sun);
  const city = createRealCity(scene, data, elevation);
  const camera = new T.PerspectiveCamera(62, 1, 0.28, 14000);
  const focus = new T.Vector3();
  const desired = new T.Vector3();
  const heading = new T.Vector3();
  const pedestrian = personModel(0xbf6682, 1);
  scene.add(pedestrian.group);

  const rides = city.places.map(({ point }, index) => {
    const type = index % 3 === 0 ? 'ebike' : 'sedan';
    const model = vehicleModel(type, index % 2 ? '#e1c3a2' : '#7ca6a0');
    scene.add(model.group);
    return { ...model, type, point, x: 0, z: 0, speed: 0, yaw: 0, hp: 100 };
  });
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
  const low = () => touch() || store.data.settings.graphics === 'low';
  const pressing = (...codes) => codes.some((code) => held.has(code));

  function syncRide(ride) {
    ride.group.position.set(ride.x, city.height(ride.x, ride.z) + 0.02, ride.z);
    ride.group.rotation.y = ride.yaw;
    ride.group.rotation.x = 0;
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
      !flight && !driving ? rides.find((ride) => Math.hypot(ride.x - x, ride.z - z) < 3.5) : null;
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
      ? '空中俯瞰'
      : driving
        ? '沿实景路网驾驶'
        : '实景地图';
    ui['objective-title'].textContent = flight
      ? '高度 ' + Math.round(altitude) + ' 米'
      : '内海湾两岸';
    ui['objective-detail'].textContent = flight
      ? touch()
        ? '摇杆移动，右侧滑动看风景'
        : '方向键移动，鼠标看风景'
      : '打开地图可选择地标';
    stage.classList.toggle('driving', Boolean(driving));
    stage.toggleAttribute('data-flight', flight);
    stage.classList.remove('swimming', 'aboard', 'volley');
    ui.wanted.hidden = true;
    ui.crosshair.hidden = true;
    ui['foot-hud'].hidden = true;
    ui['drive-hud'].hidden = !driving;
    ui['real-mode-switch'].textContent = flight ? '落地' : '俯瞰';
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
      ui['car-label'].textContent = cars[driving.type].name;
      ui['drive-status'].textContent = '自由驾驶';
    }
    const canExit = driving && Math.abs(driving.speed) < 2.6;
    ui.interaction.hidden = !nearest && !canExit;
    if (nearest || canExit) {
      ui.interaction.querySelector('button > span').textContent = canExit
        ? '下车'
        : nearest.type === 'ebike'
          ? '骑上电动车'
          : '上车';
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
        paused,
        speed: driving?.speed ?? null,
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
        for (const { point, name } of city.places) {
          const [px, pz] = map(point);
          paint.beginPath();
          paint.arc(px, pz, 3.2, 0, Math.PI * 2);
          paint.fill();
          const label = name === '小公园中山纪念亭' ? '小公园' : name;
          const textWidth = paint.measureText(label).width;
          paint.fillText(
            label,
            Math.min(width - textWidth - 6, px + 6),
            pz + (name === '人民广场' ? -6 : 4),
          );
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
    altitude = lift = moving = 0;
    [x, z] = city.spawn(location.point);
    yaw = facing = Math.atan2(x - location.point[0], z - location.point[1]);
    pitch = 0.09;
    camera.near = 0.28;
    camera.updateProjectionMatrix();
    city.detail(x, z, low());
    updateHud();
    updateCamera(true);
  }

  function cameraClear(px, pz) {
    return city.clear(px, pz, 0.23);
  }

  function updateCamera(immediate = false, dt = 0.016) {
    const [fx, fz] = forward(yaw);
    if (flight) {
      camera.position.set(x, altitude, z);
      camera.lookAt(x + fx * 300, altitude - 105 - pitch * 230, z + fz * 300);
    } else {
      const distance = driving ? 8.5 : 4.35;
      let safe = distance;
      for (let step = 0.7; step <= distance; step += 0.55) {
        if (!cameraClear(x - fx * step, z - fz * step)) {
          safe = Math.max(0.5, step - 0.6);
          break;
        }
      }
      const y = city.height(x, z) + altitude;
      desired.set(x - fx * safe, y + (driving ? 3.45 : 2.45) + pitch * 4, z - fz * safe);
      heading.set(x + fx * 4, y + 1.4 - pitch * 4, z + fz * 4);
      const amount = immediate ? 1 : 1 - Math.exp(-dt * 14);
      camera.position.lerp(desired, amount);
      focus.lerp(heading, amount);
      camera.lookAt(focus);
    }
  }

  function action(name) {
    if (!active || paused) return;
    if (name === 'pause' || name === 'map') {
      pause();
      callbacks.panel(name);
    } else if (name === 'survey' && !driving) {
      flight = !flight;
      if (flight) {
        altitude = city.height(x, z) + 230;
        if (Math.hypot(x - city.places[0].point[0], z - city.places[0].point[1]) < 170) {
          yaw = Math.atan2(x + 1100, z - 350);
          pitch = 0.34;
        }
      } else {
        if (!city.clear(x, z)) [x, z] = city.spawn([x, z]);
        altitude = 0;
      }
      camera.near = flight ? 7 : 0.28;
      camera.updateProjectionMatrix();
      lift = 0;
      updateCamera(true);
      updateHud();
    } else if (name === 'jump' && !flight && !driving && !altitude && !lift) {
      lift = 5.9;
    } else if (
      name === 'gear' &&
      driving &&
      !cars[driving.type].noReverse &&
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
      } else if (!driving && nearest) {
        driving = nearest;
        driving.steer = driving.driveInput = driving.reverseWait = 0;
        driving.reverseGear = false;
        driving.travelYaw = driving.yaw;
        yaw = driving.yaw;
        altitude = lift = 0;
        x = driving.x;
        z = driving.z;
      }
      updateHud();
    }
  }

  function move(dt) {
    yaw -= state.lookX;
    pitch = clamp(pitch + state.lookY, -0.35, 0.57);
    state.lookX = state.lookY = 0;
    const lateral =
      Number(pressing('KeyD', 'ArrowRight')) - Number(pressing('KeyA', 'ArrowLeft')) + state.x;
    const depth =
      Number(pressing('KeyW', 'ArrowUp')) - Number(pressing('KeyS', 'ArrowDown')) - state.y;
    if (driving) {
      const spec = cars[driving.type];
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
      const nextX = x + vx * dt;
      const nextZ = z + vz * dt;
      if (city.clear(nextX, nextZ, spec.size)) {
        x = driving.x = nextX;
        z = driving.z = nextZ;
      } else driving.speed *= 0.22;
      for (const wheel of driving.wheels) wheel.rotateX((-driving.speed * dt) / 0.45);
      syncRide(driving);
      facing = driving.yaw;
      if (Math.abs(lateral) > 0.08 && Math.abs(driving.speed) > 0.5) {
        yaw += Math.atan2(Math.sin(facing - yaw), Math.cos(facing - yaw)) * dt * 2.5;
      }
      audio.engine(driving.speed, driving.type !== 'ebike', false);
      return;
    }
    audio.engine(0, false, false);
    const sprint = pressing('ShiftLeft', 'ShiftRight', 'sprint');
    const pace = flight ? (sprint ? 310 : 135) : sprint ? 8.5 : 4.8;
    const [fx, fz] = forward(yaw);
    const norm = Math.max(1, Math.hypot(lateral, depth));
    const vx = ((fx * depth + Math.cos(yaw) * lateral) * pace) / norm;
    const vz = ((fz * depth - Math.sin(yaw) * lateral) * pace) / norm;
    if (flight) {
      x = clamp(x + vx * dt, city.bounds[0], city.bounds[2]);
      z = clamp(z + vz * dt, city.bounds[1], city.bounds[3]);
      const rise = Number(pressing('Space', 'survey-up')) - Number(pressing('KeyQ', 'survey-down'));
      altitude = clamp(altitude + rise * 125 * dt, city.height(x, z) + 28, 820);
      facing = yaw;
    } else {
      const lastX = x;
      const lastZ = z;
      if (city.clear(x + vx * dt, z)) x += vx * dt;
      if (city.clear(x, z + vz * dt)) z += vz * dt;
      moving = Math.hypot(x - lastX, z - lastZ) / dt;
      if (moving > 0.1) facing = Math.atan2(lastX - x, lastZ - z);
      if (altitude || lift) {
        lift -= 18 * dt;
        altitude += lift * dt;
        if (altitude <= 0) altitude = lift = 0;
      }
    }
  }

  function animate(at) {
    frame = 0;
    if (!active || stage.hidden) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.max(0, Math.min(0.05, (at - tick) / 1000));
    tick = at;
    if (paused || document.hidden) return;
    clock += dt;
    move(dt);
    if (Math.floor(clock * 8) !== Math.floor((clock - dt) * 8)) {
      city.detail(x, z, low());
      updateHud();
    }
    pedestrian.group.visible = !flight && (!driving || driving.type === 'ebike');
    pedestrian.group.position.set(x, 0, z);
    if (driving) {
      const [dx, dz] = forward(driving.yaw);
      pedestrian.ride();
      pedestrian.group.position.set(x - dx * 0.28, 0, z - dz * 0.28);
    } else {
      pedestrian.group.rotation.x = 0;
      pedestrian.walk(clock, moving);
    }
    pedestrian.group.position.y += city.height(x, z) + altitude;
    pedestrian.group.rotation.y = facing;
    updateCamera(false, dt);
    renderer.render(scene, camera);
  }

  canvas.addEventListener('dblclick', () => {
    if (paused || !active || touch()) return;
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
          [ride.point[0] + 14, ride.point[1] + 11],
          cars[ride.type].size,
        );
        ride.yaw = city.roadAngle(ride.x, ride.z);
        ride.speed = 0;
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
