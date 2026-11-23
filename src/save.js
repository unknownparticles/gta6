import { cars, days, packs, paints } from './data.js';

const key = 'tideline-drive-v1';
const initial = () => ({
  id: '',
  nick: '',
  signedIn: false,
  coins: 0,
  claimed: [],
  dates: [],
  perks: 0,
  owned: ['sedan'],
  skins: ['factory'],
  car: 'sedan',
  paint: {},
  done: false,
  pistol: false,
  trained: false,
  best: null,
  meters: 0,
  settings: { music: 0.36, effects: 0.6, graphics: 'auto', movement: true },
});

export function loadSave(storage) {
  let save = initial();
  let available = true;
  try {
    storage ??= localStorage;
    const raw = storage.getItem(key);
    const loaded = raw ? JSON.parse(raw) : {};
    if (loaded && typeof loaded === 'object') {
      save = { ...save, ...loaded, settings: { ...save.settings, ...loaded.settings } };
      for (const name of ['claimed', 'dates', 'owned', 'skins']) {
        if (!Array.isArray(save[name])) save[name] = initial()[name];
      }
      if (!save.owned.includes(save.car) || !cars[save.car]) save.car = 'sedan';
      if (!save.paint || typeof save.paint !== 'object') save.paint = {};
    }
    storage.setItem(key, JSON.stringify(save));
  } catch {
    available = false;
  }
  return {
    data: save,
    get available() {
      return available;
    },
    write() {
      if (!available) return false;
      try {
        storage.setItem(key, JSON.stringify(save));
        return true;
      } catch {
        available = false;
        return false;
      }
    },
  };
}

export function localDate(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-');
}

export function claimDay(save, today = localDate()) {
  if (save.dates.length >= days.length || save.dates.at(-1) >= today) return false;
  const day = save.dates.length;
  const [, coins, skin] = days[day];
  save.dates.push(today);
  save.coins += coins;
  if (day === 2) save.perks++;
  if (skin && !save.skins.includes(skin)) save.skins.push(skin);
  return true;
}

export function claimPack(save, id) {
  const pack = packs[id];
  if (!pack || save.claimed.includes(id)) return false;
  save.claimed.push(id);
  save.coins += pack.coins;
  if (!save.skins.includes(pack.paint)) save.skins.push(pack.paint);
  return true;
}

export function buyPaint(save, id) {
  const paint = paints[id];
  if (!paint || paint.price === null || save.skins.includes(id) || save.coins < paint.price)
    return false;
  save.coins -= paint.price;
  save.skins.push(id);
  return true;
}
