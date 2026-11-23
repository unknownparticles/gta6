import { cars, days, packs, paints, weapons } from './data.js';

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
  pulse: false,
  arsenal: [],
  pickups: [],
  membership: false,
  hospitalLoss: null,
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
      for (const name of ['claimed', 'dates', 'owned', 'skins', 'pickups']) {
        if (!Array.isArray(save[name])) save[name] = initial()[name];
      }
      if (!save.owned.includes(save.car) || !cars[save.car]) save.car = 'sedan';
      if (!save.paint || typeof save.paint !== 'object') save.paint = {};
    }
    normalizeArsenal(save);
    storage.setItem(key, JSON.stringify(save));
  } catch {
    available = false;
    normalizeArsenal(save);
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

function normalizeArsenal(save) {
  const previous = Array.isArray(save.arsenal) ? save.arsenal : [];
  save.arsenal = weapons.map((weapon, index) => {
    const entry = previous[index];
    const valid = (count, max) =>
      Number.isFinite(count) ? Math.max(0, Math.min(max, Math.floor(count))) : 0;
    return entry
      ? { ammo: valid(entry.ammo, weapon.cap), stock: valid(entry.stock, weapon.stock * 3) }
      : {
          ammo: hasWeapon(save, index) ? weapon.cap : 0,
          stock: hasWeapon(save, index) ? weapon.stock : 0,
        };
  });
}

export function hasWeapon(save, index) {
  return index === 0
    ? Boolean(save.pistol || save.trained)
    : index === 1 && Boolean(save.pulse || save.trained);
}

export function grantWeapon(save, index) {
  const weapon = weapons[index];
  if (!weapon || hasWeapon(save, index)) return false;
  save[index ? 'pulse' : 'pistol'] = true;
  Object.assign(save.arsenal[index], { ammo: weapon.cap, stock: weapon.stock });
  return true;
}

export function buyWeapon(save, index) {
  const weapon = weapons[index];
  if (!weapon || save.coins < weapon.price || !grantWeapon(save, index)) return false;
  save.coins -= weapon.price;
  return true;
}

export function buyAmmo(save, index) {
  const weapon = weapons[index];
  if (!weapon || !hasWeapon(save, index) || (!save.perks && save.coins < weapon.ammoPrice))
    return false;
  const inventory = save.arsenal[index];
  if (inventory.stock >= weapon.stock * 3) return false;
  inventory.stock = Math.min(weapon.stock * 3, inventory.stock + weapon.stock);
  if (save.perks) save.perks--;
  else save.coins -= weapon.ammoPrice;
  return true;
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
  if (!pack || save.claimed.includes(id) || save.coins < pack.cost) return false;
  save.claimed.push(id);
  save.coins += pack.coins - pack.cost;
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
