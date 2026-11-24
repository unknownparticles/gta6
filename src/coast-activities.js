import * as T from 'three';
import { beach as originalBeach, ferryStops as originalStops } from './city-layout.js';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function solid(w, h, d, color, x, y, z) {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color }));
  mesh.position.set(x, y, z);
  return mesh;
}

export function createCoastActivities(
  scene,
  personModel,
  {
    beach = originalBeach,
    ferryStops = originalStops,
    seaLevel = -0.48,
    transit = 18,
    layover = 9,
    buildPiers = true,
  } = {},
) {
  const minute = 2 * (layover + transit);
  const ferry = new T.Group();
  ferry.add(
    solid(7, 1.1, 17, 0x173650, 0, 0.02, 0),
    solid(7.2, 0.17, 16.6, 0xefd7c3, 0, 0.66, 0),
    solid(5, 2, 6.5, 0xe4d8cd, 0, 1.7, -2.5),
    solid(5.2, 0.14, 6.7, 0x278f97, 0, 2.77, -2.5),
  );
  for (const side of [-1, 1]) {
    ferry.add(solid(0.15, 0.5, 16.4, 0x87d5cf, side * 3.45, 0.91, 0));
    for (const z of [-5, -3, -1, 0.4])
      ferry.add(solid(0.1, 0.52, 0.92, 0x477998, side * 2.53, 2.0, z));
  }
  ferry.add(solid(3, 0.45, 0.45, 0x798097, 0, 0.91, 6.5));
  scene.add(ferry);
  for (const stop of buildPiers ? ferryStops : []) {
    const center = (stop.pier[1] + stop.berth[1]) / 2;
    scene.add(solid(5.6, 0.26, 15.2, 0x8f6d61, stop.pier[0], -0.11, center));
    for (const side of [-1, 1])
      for (const offset of [-6, -1, 4]) {
        scene.add(
          solid(0.28, 1.1, 0.28, 0xe5bc83, stop.pier[0] + side * 2.63, 0.36, center + offset),
        );
      }
  }
  let clock = 0;
  let dock = 0;
  let riding = false;
  let boardedAt = -1;

  const [cx, cz] = beach.court;
  scene.add(solid(34, 0.045, 46, 0xc7a27d, cx + 2, 0.01, cz + 10));
  const ball = new T.Mesh(
    new T.SphereGeometry(0.28, 12, 8),
    new T.MeshStandardMaterial({ color: 0xffdf69 }),
  );
  const landing = new T.Mesh(
    new T.RingGeometry(0.95, 1.15, 24),
    new T.MeshBasicMaterial({ color: 0xffea98, side: T.DoubleSide }),
  );
  landing.rotation.x = -Math.PI / 2;
  landing.visible = false;
  scene.add(landing);
  const opponent = personModel(0x20c9ab, 1);
  const court = new T.Group();
  court.add(solid(16, 0.1, 25, 0xd5a580, cx, 0.045, cz));
  for (const side of [-1, 1]) {
    court.add(solid(0.1, 0.014, 23, 0xfcf4e3, cx + side * 7, 0.105, cz));
    court.add(solid(14, 0.014, 0.14, 0xfcf4e3, cx, 0.105, cz + side * 11.5));
    court.add(solid(0.18, 2.7, 0.18, 0xeee0c8, cx + side * 7.3, 1.36, cz));
  }
  for (let x = -7; x < 7.1; x += 0.6)
    court.add(solid(0.025, 0.89, 0.03, 0xd7e1dc, cx + x, 1.98, cz));
  for (let y = 1.55; y < 2.52; y += 0.2) court.add(solid(14.3, 0.026, 0.03, 0xd7e1dc, cx, y, cz));
  opponent.group.position.set(cx, 0, cz - 8);
  opponent.group.rotation.y = Math.PI;
  ball.position.set(cx, 1, cz + 8);
  scene.add(court, opponent.group, ball);

  let score = null;
  let phase = 'standby';
  let path = null;
  let travel = 0;
  let serveClock = 0;
  const resetBall = (server) => {
    phase = 'serve';
    path = null;
    serveClock = 0;
    ball.position.set(cx, 1.15, cz + (server === 'player' ? 8 : -8));
    score.server = server;
    landing.visible = false;
  };
  const sendBall = (x, z, who) => {
    path = { from: ball.position.clone(), x, z, who };
    travel = 0;
    phase = 'flight';
    landing.position.set(x, 0.12, z);
    landing.visible = who === 'opponent';
  };

  function point(who) {
    score[who]++;
    if (score[who] >= 5) {
      phase = 'over';
      landing.visible = false;
      return;
    }
    resetBall(who);
  }

  function update(dt, time, player) {
    clock = (clock + dt) % minute;
    const segment = clock < layover + transit ? 0 : 1;
    const elapsed = clock - segment * (layover + transit);
    dock = elapsed < layover ? segment : -1;
    const a = ferryStops[segment].berth;
    const b = ferryStops[1 - segment].berth;
    const t = clamp((elapsed - layover) / transit, 0, 1);
    const eased = t * t * (3 - 2 * t);
    ferry.position.set(
      T.MathUtils.lerp(a[0], b[0], eased),
      seaLevel + 0.035 * Math.sin(time * 2.4),
      T.MathUtils.lerp(a[1], b[1], eased),
    );
    ferry.rotation.y = Math.atan2(a[0] - b[0], a[1] - b[1]);
    if (riding) {
      player.x = ferry.position.x + Math.sin(ferry.rotation.y) * 4.5;
      player.z = ferry.position.z + Math.cos(ferry.rotation.y) * 4.5;
      player.yaw = ferry.rotation.y;
    }

    if (!score || phase === 'over') return;
    const anticipated = path?.who === 'player' && travel > 0.65 ? path.x : cx;
    const opponentX = opponent.group.position.x;
    opponent.group.position.x += clamp(anticipated - opponentX, -dt * 5.1, dt * 5.1);
    opponent.walk(time, Math.abs(anticipated - opponentX) > 0.15 ? 3.5 : 0);
    if (phase === 'serve' && score.server === 'opponent') {
      serveClock += dt;
      if (serveClock >= 1.15)
        sendBall(cx + Math.sin(score.player * 2 + score.opponent * 3) * 4.8, cz + 7.5, 'opponent');
    } else if (phase === 'flight') {
      travel += dt;
      const p = clamp(travel / 1.45, 0, 1);
      ball.position.set(
        T.MathUtils.lerp(path.from.x, path.x, p),
        T.MathUtils.lerp(path.from.y, 0.25, p) + Math.sin(p * Math.PI) * 3.5,
        T.MathUtils.lerp(path.from.z, path.z, p),
      );
      if (p < 1) return;
      if (path.who === 'player' && Math.abs(opponent.group.position.x - ball.position.x) <= 1.35) {
        ball.position.y = 1.15;
        sendBall(
          cx + Math.sin(score.player + score.opponent * 2 + time * 0.25) * 5,
          cz + 7.5,
          'opponent',
        );
      } else {
        point(path.who);
      }
    }
  }

  return {
    update,
    reset() {
      clock = 0;
      dock = 0;
      riding = false;
      boardedAt = -1;
      score = null;
      phase = 'standby';
      path = null;
      ball.position.set(cx, 1, cz + 8);
      landing.visible = false;
    },
    get riding() {
      return riding;
    },
    get dock() {
      return dock;
    },
    get canLeave() {
      return riding && dock >= 0 && dock !== boardedAt;
    },
    get elevation() {
      return ferry.position.y + 0.75;
    },
    get game() {
      return score;
    },
    get status() {
      return phase;
    },
    message() {
      if (phase === 'over') return score.player === 5 ? '你赢了这一局' : '对手赢了这一局';
      if (phase === 'serve')
        return score.server === 'player' ? '靠近球，侧移后按击球发球' : '对手准备发球';
      return path.who === 'opponent' ? '移动到落点附近接球' : '球飞向对手半场';
    },
    board() {
      if (dock < 0 || riding) return;
      riding = true;
      boardedAt = dock;
      const endOfLayover = dock * (layover + transit) + layover;
      clock = Math.min(endOfLayover - 0.1, Math.max(clock, endOfLayover - 3));
    },
    leave() {
      riding = false;
      return ferryStops[dock].pier;
    },
    start() {
      score = { player: 0, opponent: 0, server: 'player', rallies: 0 };
      resetBall('player');
    },
    stop() {
      score = null;
      phase = 'standby';
      path = null;
      ball.position.set(cx, 1, cz + 8);
      landing.visible = false;
    },
    hit(player) {
      if (
        !score ||
        phase === 'over' ||
        Math.hypot(player.x - ball.position.x, player.z - ball.position.z) > 3
      )
        return false;
      if (phase === 'serve' && score.server !== 'player') return false;
      if (
        phase === 'flight' &&
        (path.who !== 'opponent' || ball.position.z < cz + 1 || ball.position.y > 3.25)
      )
        return false;
      if (phase !== 'serve' && phase !== 'flight') return false;
      score.rallies++;
      const aim = clamp((player.x - cx) * 2.15, -6.8, 6.8);
      sendBall(cx + aim, cz - 9.4, 'player');
      return true;
    },
  };
}
