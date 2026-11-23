const unit = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const limit = (value, min, max) => Math.min(max, Math.max(min, value));
const signedAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function drive(car, spec, input, dt) {
  const { gas, brake, handbrake, steering, reverse } = input;
  const running = car.hp > 0;
  const direction = brake && reverse ? 0 : gas === brake ? 0 : gas && !reverse ? 1 : -1;
  if (direction !== car.driveInput) {
    car.driveInput = direction;
    car.reverseWait = 0;
  }

  if (!running) {
    car.speed *= Math.exp(-4 * dt);
  } else if (brake && (gas || reverse)) {
    car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - 28 * dt);
  } else if (direction && direction * car.speed < 0) {
    car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - 25 * dt);
  } else if (!reverse && direction < 0 && car.speed === 0 && car.reverseWait < 0.24) {
    car.reverseWait += dt;
  } else if (direction) {
    const condition = 0.65 + (0.35 * car.hp) / 100;
    const rate = direction > 0 ? spec.power : spec.power * 0.6;
    car.speed = limit(car.speed + direction * rate * condition * dt, -8, spec.speed * condition);
  } else {
    car.speed *= Math.exp(-0.72 * dt);
  }
  if (handbrake) car.speed *= Math.exp(-2.5 * dt);
  if ((!direction || !running) && Math.abs(car.speed) < 0.13) car.speed = 0;

  car.steer += (steering - car.steer) * (1 - Math.exp(-dt * 15));
  const motion = Math.abs(car.speed);
  const turnScale = Math.min(1, motion / 4.5) / (1 + motion / 38);
  car.yaw += car.steer * spec.turn * turnScale * (handbrake ? 1.65 : 1) * Math.sign(car.speed) * dt;
  const slip = handbrake && motion > 6 ? 3.5 : 14;
  car.travelYaw += signedAngle(car.yaw - car.travelYaw) * (1 - Math.exp(-dt * slip));
  const [fx, fz] = unit(car.travelYaw);
  return [car.speed * fx, car.speed * fz];
}

export function vehicleContact(a, b, first, second) {
  const [ax, az] = unit(a.yaw);
  const [bx, bz] = unit(b.yaw);
  const radius = first.size + second.size;
  let contact;
  for (const aOffset of [-1, 1]) {
    for (const bOffset of [-1, 1]) {
      const dx = b.x + bx * bOffset - (a.x + ax * aOffset);
      const dz = b.z + bz * bOffset - (a.z + az * aOffset);
      const gap = Math.hypot(dx, dz);
      if (gap >= radius || (contact && radius - gap <= contact.depth)) continue;
      const nx = gap > 0.001 ? dx / gap : 1;
      const nz = gap > 0.001 ? dz / gap : 0;
      const closing = Math.max(0, (a.vx - b.vx) * nx + (a.vz - b.vz) * nz);
      const impulse = (closing * 1.16) / (1 / first.mass + 1 / second.mass);
      contact = { nx, nz, closing, impulse, depth: radius - gap };
    }
  }
  return contact;
}

export function pedestrianContact(car, person, radius) {
  const [fx, fz] = unit(car.yaw);
  const length = 1.22;
  const dx = person.x - car.x;
  const dz = person.z - car.z;
  const along = limit(fx * dx + fz * dz, -length, length);
  return Math.hypot(dx - fx * along, dz - fz * along) < radius + 0.34;
}
