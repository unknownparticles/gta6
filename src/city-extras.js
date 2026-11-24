import * as T from 'three';
import { grantWeapon, hasWeapon } from './save.js';
import { weapons } from './data.js';
import { retroRider } from './retro-people.js';

export function createCityExtras({ scene, city, store, audio, callbacks, points }) {
  const save = store.data;
  let rangeActive = false;
  let gangActive = false;
  let gangStart = 0;
  const practice = points.training;
  const targets = [0, 1, 2].map((index) => {
    const angle = (index - 1) * 0.42;
    const location = city.landingAt(
      practice[0] + Math.sin(angle) * 12,
      practice[1] + 12 * Math.cos(angle),
      0.5,
    ) || [practice[0] + 3 * (index - 1), city.height(...practice), practice[1] + 5];
    const group = new T.Group();
    const post = new T.Mesh(
      new T.BoxGeometry(0.12, 1.25, 0.12),
      new T.MeshLambertMaterial({ color: 0x84757a }),
    );
    post.position.y = 0.62;
    const board = new T.Mesh(
      new T.BoxGeometry(0.7, 0.7, 0.12),
      new T.MeshLambertMaterial({ color: 0xeac083 }),
    );
    board.position.y = 1.48;
    group.add(post, board);
    group.position.set(location[0], location[1], location[2]);
    group.visible = false;
    scene.add(group);
    return { group, board, x: location[0], z: location[2], hit: false };
  });
  const rivals = [0xaa6355, 0x546d7a].map((color) => {
    const person = retroRider(color);
    person.group.visible = false;
    scene.add(person.group);
    return person;
  });
  const pickupMaterial = new T.MeshBasicMaterial({ color: 0xffd565 });
  const pickups = [
    ['real-plaza-cash', 'cash', points.pavilion, 6, 12, 25],
    ['real-ferry-cash', 'cash', points['north-ferry'], 10, -4, 35],
    ['real-mountain-kit', 'kit', points.mountain, 9, 10, 35],
  ].map(([id, type, point, dx, dz, amount]) => {
    const px = point[0] + dx;
    const pz = point[1] + dz;
    const [x, z] = city.clear(px, pz) ? [px, pz] : city.spawn([px, pz]);
    const mesh = new T.Mesh(new T.OctahedronGeometry(0.29), pickupMaterial);
    mesh.position.set(x, city.height(x, z) + 0.65, z);
    mesh.visible = !save.pickups.includes(id);
    scene.add(mesh);
    return { id, type, x, z, amount, mesh };
  });

  function startTraining() {
    if (!save.trained && !rangeActive) {
      grantWeapon(save, 0);
      if (save.arsenal[0].ammo === 0) save.arsenal[0].ammo = weapons[0].cap;
      rangeActive = true;
      targets.forEach((target) => {
        target.hit = false;
        target.group.visible = true;
        target.board.material.color.setHex(0xeac083);
      });
      store.write();
      callbacks.toast('训练开始，命中附近的三个靶牌');
      return 'equipped';
    }
    callbacks.panel('armory');
    return null;
  }

  return {
    get training() {
      return rangeActive;
    },
    get gang() {
      return gangActive;
    },
    startTraining,
    startGang(clock) {
      gangActive = true;
      gangStart = clock;
      for (const [i, rival] of rivals.entries()) {
        const [x, z] = city.spawn([points.gang[0] + (i * 2 - 1) * 6, points.gang[1] + 5]);
        rival.group.position.set(x, city.height(x, z) + 0.07, z);
        rival.group.rotation.y = i ? -1.3 : 1.3;
        rival.group.visible = true;
      }
      callbacks.toast('盐线和锈锚在维修街碰面');
    },
    pickup(x, z, heal) {
      const spot = pickups.find(
        (item) => item.mesh.visible && Math.hypot(x - item.x, z - item.z) < 2.3,
      );
      if (!spot) return null;
      return {
        label: spot.type === 'cash' ? '拾取 ' + spot.amount + ' 潮票' : '拾取医疗补给',
        icon: spot.type === 'cash' ? 'coin' : 'heart',
        run() {
          if (!spot.mesh.visible) return;
          if (spot.type === 'cash') save.coins += spot.amount;
          else heal(spot.amount);
          save.pickups.push(spot.id);
          spot.mesh.visible = false;
          store.write();
          audio.cue('mark');
        },
      };
    },
    strike({ x, z, yaw, armed, aiming }) {
      if (!rangeActive || !armed) return false;
      const match = targets
        .filter((target) => !target.hit)
        .map((target) => {
          const angle = yaw - Math.atan2(x - target.x, z - target.z);
          return {
            target,
            angle: Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))),
            distance: Math.hypot(x - target.x, z - target.z),
          };
        })
        .filter((hit) => hit.distance < 33 && hit.angle < (aiming ? 0.16 : 0.21))
        .sort((a, b) => a.angle - b.angle)[0];
      if (!match) return false;
      match.target.hit = true;
      match.target.board.material.color.setHex(0x7ee1c4);
      audio.cue('mark');
      if (targets.every((target) => target.hit)) {
        rangeActive = false;
        save.trained = true;
        if (!hasWeapon(save, 1)) grantWeapon(save, 1);
        store.write();
        callbacks.toast('训练完成，已解锁脉冲发射器');
      }
      return true;
    },
    update(clock, dt, x, z) {
      if (
        gangActive &&
        (clock - gangStart > 32 || Math.hypot(x - points.gang[0], z - points.gang[1]) > 60)
      ) {
        gangActive = false;
        rivals.forEach((person) => {
          person.group.visible = false;
        });
      }
      for (const rival of rivals) if (rival.group.visible) rival.animate({ speed: 0, dt });
      for (const item of pickups) if (item.mesh.visible) item.mesh.rotation.y = clock * 1.7;
    },
  };
}
