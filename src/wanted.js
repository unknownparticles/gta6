const thresholds = [1, 3, 6, 10, 15];
const searchTimes = [0, 9, 12, 15, 18, 21];

export function freshAlert() {
  return {
    heat: 0,
    level: 0,
    lastSeen: null,
    unseen: 0,
    left: 0,
    caught: 0,
    patrols: [],
    restricted: false,
  };
}

export function addHeat(alert, amount, position) {
  alert.heat = Math.min(thresholds.at(-1), alert.heat + amount);
  alert.level = thresholds.filter((threshold) => alert.heat >= threshold).length;
  alert.lastSeen = position;
  alert.unseen = 0;
  alert.left = 0;
}

export function advanceSearch(alert, dt, visible, position) {
  if (!alert.level) return false;
  if (visible) {
    alert.lastSeen = position;
    alert.unseen = 0;
    alert.left = 0;
    return false;
  }
  alert.unseen += dt;
  const grace = alert.restricted ? 0.9 : 2.8;
  if (alert.unseen <= grace) return false;
  alert.left = Math.max(0, searchTimes[alert.level] - (alert.unseen - grace));
  return alert.left === 0;
}
