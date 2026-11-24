import { pedestrianContact } from './driving.js';
import { retroRider } from './retro-people.js';
import { addHeat, advanceSearch, freshAlert } from './wanted.js';

const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const heading = (a, b) => Math.atan2(a.x - b.x, a.z - b.z);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pointKey = (x, z) => x + ':' + z;
const ends = (road, reverse) =>
  reverse ? [road.bx, road.bz, road.ax, road.az] : [road.ax, road.az, road.bx, road.bz];

export function realStreetLife({ scene, city, compact, createCar, syncCar, notify, hurt }) {
  const junctions = new Map();
  for (const road of city.roads) {
    if (road.foot || road.width < 3.5 || road.length < 1.2) continue;
    for (const reverse of [false, true]) {
      const [x, z] = ends(road, reverse);
      const key = pointKey(x, z);
      if (!junctions.has(key)) junctions.set(key, []);
      junctions.get(key).push({ road, reverse });
    }
  }

  const people = Array.from({ length: 8 }, (_, i) => {
    const model = retroRider(
      [0x905047, 0x665e80, 0x68907a, 0xdaae83][i % 4],
      [0xc99572, 0xa07353, 0xdeac85, 0xb18562][i % 4],
    );
    model.group.visible = false;
    scene.add(model.group);
    return { ...model, index: i, x: 0, z: 0 };
  });
  const traffic = Array.from({ length: 7 }, (_, i) =>
    createCar(['sedan', 'taxi', 'suv', 'van', 'ebike', 'delivery', 'sedan'][i], i),
  );
  const police = Array.from({ length: 5 }, (_, i) => createCar('patrol', i));
  const alert = freshAlert();
  let refresh = 0;
  let clock = 0;
  let offenseTime = 0;

  function offense(amount, reason, x, z) {
    addHeat(alert, amount, [x, z]);
    alert.caught = 0;
    offenseTime = clock;
    notify(reason + ' · ' + alert.level + ' 星通缉', 'alarm');
  }

  function clearWanted() {
    for (const patrol of police) patrol.group.visible = false;
    Object.assign(alert, freshAlert());
  }

  function seedCar(actor, nearby, player, minimum, maximum, aim) {
    for (let attempt = 0; attempt < Math.min(nearby.length * 2, 40); attempt++) {
      const index = (actor.index * 11 + attempt * 7 + Math.floor(clock * 3)) % nearby.length;
      const road = nearby[index];
      if (!road || road.foot || road.width < 4 || road.length < 8) continue;
      const pos = 0.17 + ((attempt + actor.index) % 4) * 0.21;
      const x = road.ax + road.dx * pos;
      const z = road.az + road.dz * pos;
      const distance = Math.hypot(x - player.x, z - player.z);
      if (distance < minimum || distance > maximum || !city.clear(x, z, actor.spec.size)) continue;
      if (
        traffic
          .concat(police)
          .some((car) => car !== actor && car.group.visible && Math.hypot(car.x - x, car.z - z) < 7)
      )
        continue;
      actor.route = road;
      actor.reverseRoute = aim
        ? Math.hypot(road.ax - aim[0], road.az - aim[1]) <
          Math.hypot(road.bx - aim[0], road.bz - aim[1])
        : (actor.index + attempt) % 2 === 0;
      actor.progress = actor.reverseRoute ? 1 - pos : pos;
      const [ax, az, bx, bz] = ends(road, actor.reverseRoute);
      actor.yaw = heading({ x: ax, z: az }, { x: bx, z: bz });
      actor.x = x;
      actor.z = z;
      actor.speed = 0;
      actor.taken = false;
      actor.offRoute = false;
      actor.group.visible = true;
      syncCar(actor);
      return true;
    }
    return false;
  }

  function driveActor(car, dt, speed, target) {
    if (speed < 0.1) {
      car.speed = 0;
      return;
    }
    const road = car.route;
    let route = road;
    let reverse = car.reverseRoute;
    let [ax, az, bx, bz] = ends(road, car.reverseRoute);
    let progress = car.progress + (speed * dt) / road.length;
    if (progress >= 1) {
      const choices = (junctions.get(pointKey(bx, bz)) || []).filter(
        (entry) => entry.road !== road,
      );
      const at = { x: bx, z: bz };
      choices.sort((a, b) => {
        const score = (entry) => {
          const [, , x, z] = ends(entry.road, entry.reverse);
          if (target) return Math.hypot(x - target[0], z - target[1]);
          return Math.abs(Math.sin(heading(at, { x, z }) - car.yaw)) * 2 - entry.road.width * 0.07;
        };
        return score(a) - score(b);
      });
      const next = choices[0] || { road, reverse: !car.reverseRoute };
      route = next.road;
      reverse = next.reverse;
      [ax, az, bx, bz] = ends(next.road, next.reverse);
      progress = Math.min(0.22, ((progress - 1) * road.length) / next.road.length);
    }
    const x = ax + (bx - ax) * progress;
    const z = az + (bz - az) * progress;
    if (!city.clear(x, z, car.spec.size * 0.58)) {
      car.reverseRoute = !car.reverseRoute;
      car.progress = Math.max(0.03, 1 - car.progress);
      car.speed = 0;
      return;
    }
    car.route = route;
    car.reverseRoute = reverse;
    car.x = x;
    car.z = z;
    car.progress = progress;
    car.yaw = heading({ x: ax, z: az }, { x: bx, z: bz });
    car.speed = speed;
    for (const wheel of car.wheels) wheel.rotateX((-speed * dt) / 0.38);
    syncCar(car);
  }

  function seedPerson(person, nearby, player) {
    for (let attempt = 0; attempt < Math.min(nearby.length, 36); attempt++) {
      const road = nearby[(person.index * 19 + attempt * 13 + Math.floor(clock)) % nearby.length];
      if (!road || road.width > 9 || road.bridge || road.length < 8) continue;
      const [ax, az, bx, bz] = ends(road, person.index % 2 !== 0);
      const length = road.length;
      const side = person.index % 2 ? 1 : -1;
      const offset = (road.foot ? 0 : road.width * 0.5 + 0.48) * side;
      const x = (ax + bx) * 0.5 + ((bz - az) / length) * offset;
      const z = (az + bz) * 0.5 - ((bx - ax) / length) * offset;
      const distance = Math.hypot(x - player.x, z - player.z);
      if (distance < 6 || distance > 56 || !city.clear(x, z, 0.36)) continue;
      person.x = x;
      person.z = z;
      person.yaw = heading({ x: ax, z: az }, { x: bx, z: bz });
      person.remaining = Math.min(16, length * 0.31);
      person.group.visible = true;
      return;
    }
  }

  function visible(patrol, player) {
    if (
      Math.abs(player.altitude - city.height(patrol.x, patrol.z)) > 5 ||
      gap(patrol, player) > 28 + alert.level * 3
    )
      return false;
    for (let i = 1; i < 7; i++) {
      const x = patrol.x + ((player.x - patrol.x) * i) / 7;
      const z = patrol.z + ((player.z - patrol.z) * i) / 7;
      const y = city.height(x, z);
      if (city.blocked(x, z, y + 0.65, y + 2.0, 0.13)) return false;
    }
    return true;
  }

  function update(dt, player, car, parked) {
    clock += dt;
    refresh -= dt;
    const above = player.altitude - city.height(player.x, player.z) > 14;
    if (refresh <= 0) {
      refresh = 0.65;
      const roads = above ? [] : [...city.nearbyRoads(player.x, player.z, 150)];
      traffic.forEach((actor, i) => {
        if (car === actor) return;
        if (above || i >= (compact() ? 4 : 7) || gap(actor, player) > 155)
          actor.group.visible = false;
        if (!actor.group.visible && !above && i < (compact() ? 4 : 7))
          seedCar(actor, roads, player, 29, 125);
      });
      people.forEach((person, i) => {
        if (above || gap(person, player) > 72) person.group.visible = false;
        if (i >= (compact() ? 4 : 8)) person.group.visible = false;
        else if (!person.group.visible && !above) seedPerson(person, roads, player);
      });
      police.forEach((patrol, i) => {
        if (i >= Math.min(alert.level, compact() ? 3 : 5)) {
          patrol.group.visible = false;
          return;
        }
        if (patrol.group.visible && gap(patrol, player) > 170) patrol.group.visible = false;
        if (!patrol.group.visible && roads.length && clock - offenseTime < 6)
          seedCar(patrol, roads, player, 29 + i * 5, 128, alert.lastSeen);
      });
      alert.patrols = police.filter((patrol) => patrol.group.visible);
    }

    let seen = false;
    let close = false;
    for (const actor of traffic) {
      if (!actor.group.visible || actor === car || actor.taken) continue;
      const distance = gap(actor, player);
      let speed = actor.type === 'ebike' ? 6 : 8 + (actor.index % 3);
      const [fx, fz] = [-Math.sin(actor.yaw), -Math.cos(actor.yaw)];
      const ahead = (player.x - actor.x) * fx + (player.z - actor.z) * fz;
      const side = Math.abs((player.x - actor.x) * fz - (player.z - actor.z) * fx);
      if (!above && ahead > 0 && ahead < 11 && side < 1.9)
        speed *= clamp((distance - 2.9) / 8, 0, 1);
      if (
        parked.some(
          (other) =>
            other !== car &&
            gap(other, actor) < 4.1 &&
            (other.x - actor.x) * fx + (other.z - actor.z) * fz > 0,
        )
      )
        speed *= 0.24;
      driveActor(actor, dt, speed);
      if (
        !above &&
        !car &&
        distance < 2.7 &&
        speed > 4 &&
        pedestrianContact(actor, player, actor.spec.size) &&
        hurt(speed * 4, '车辆撞击')
      )
        return;
    }

    for (const person of people) {
      if (!person.group.visible) continue;
      const speed = person.remaining > 0 ? 1.5 : 0;
      const x = person.x - Math.sin(person.yaw) * speed * dt;
      const z = person.z - Math.cos(person.yaw) * speed * dt;
      if (city.clear(x, z, 0.28)) {
        person.x = x;
        person.z = z;
      } else person.remaining = 0;
      person.remaining -= speed * dt;
      if (person.remaining <= 0 && Math.sin(clock * 0.5 + person.index) > 0.8) {
        person.yaw += Math.PI;
        person.remaining = 11;
      }
      const y = city.height(person.x, person.z);
      person.group.position.set(
        person.x,
        y + city.pavementHeight(person.x, person.z) + 0.02,
        person.z,
      );
      person.group.rotation.y = person.yaw;
      person.animate({ speed, airborne: false, riding: false, dt });
      if (
        car &&
        Math.abs(car.speed) > 3.6 &&
        gap(car, person) < 3 &&
        Math.abs(player.altitude - y) < 1.3 &&
        pedestrianContact(car, person, car.spec.size)
      ) {
        person.group.visible = false;
        offense(1, '撞到路人', player.x, player.z);
        car.speed *= 0.57;
      }
    }

    if (alert.level) {
      for (const patrol of alert.patrols) {
        const canSee = visible(patrol, player);
        const distance = gap(patrol, player);
        if (canSee) {
          seen = true;
          close ||= distance < 6.5;
        }
        if (canSee && distance < 20) patrol.offRoute = true;
        const pursuitTarget = canSee ? player : { x: alert.lastSeen[0], z: alert.lastSeen[1] };
        const pursuitDistance = gap(patrol, pursuitTarget);
        const speed =
          pursuitDistance < 5 ? 0 : Math.min(10 + alert.level * 2.8, pursuitDistance * 0.7);
        if (patrol.offRoute && speed > 0) {
          const aim = heading(patrol, pursuitTarget);
          const nx = patrol.x - Math.sin(aim) * speed * dt;
          const nz = patrol.z - Math.cos(aim) * speed * dt;
          if (city.clear(nx, nz, 0.9)) {
            patrol.x = nx;
            patrol.z = nz;
            patrol.yaw = aim;
            patrol.speed = speed;
            syncCar(patrol);
          } else patrol.speed = 0;
        } else if (!patrol.offRoute) driveActor(patrol, dt, speed, alert.lastSeen);
        else patrol.speed = 0;
        patrol.lights.forEach((light, i) => {
          light.visible = Math.floor(clock * 8) % 2 === i;
        });
      }
      if (advanceSearch(alert, dt, seen || clock - offenseTime < 2.8, [player.x, player.z])) {
        clearWanted();
        notify('通缉解除', 'mark');
      } else if (close && (!car || Math.abs(car.speed) < 6)) {
        alert.caught += dt;
        if (alert.caught >= 2.3) {
          alert.caught = 0;
          hurt(100, '警方拦截');
        }
      } else alert.caught = Math.max(0, alert.caught - dt * 1.8);
    }
  }

  function reset() {
    for (const actor of [...traffic, ...people, ...police]) actor.group.visible = false;
    refresh = 0;
    clearWanted();
  }

  function relocate() {
    for (const actor of [...traffic, ...people]) actor.group.visible = false;
    refresh = 0;
  }

  return {
    alert,
    traffic,
    police,
    offense,
    update,
    reset,
    relocate,
    get pedestrians() {
      return people.filter((person) => person.group.visible).length;
    },
  };
}
