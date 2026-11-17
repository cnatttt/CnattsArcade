// =====================================================================
//  NIGHTFALL HORDE - data. Tweak numbers here to rebalance.
//  Distances are in world pixels (the screen shows 640 x 360 of them).
// =====================================================================

// ------------------------------------------------------------ weapons
// lv[0] is level 1. Every later entry only lists what changes.
const WEAPONS = {
  pistol: { name: 'Pistol', icon: 'gun', col: ['#8a8aa0', '#c8c8e0', '#4a4a5a'],
    desc: ['Shoots the nearest zombie.', '+40% damage', '+1 bullet', 'Bullets pierce 2 zombies', 'TWIN UZIS: rapid fire, +1 bullet'],
    lv: [{ cd: 0.5, dmg: 14, count: 1, pierce: 0 }, { dmg: 19 }, { count: 2 }, { pierce: 2, dmg: 23 }, { count: 3, cd: 0.3, dmg: 27, max: true }] },
  shotgun: { name: 'Shotgun', icon: 'shotgun', col: ['#8a5a2a', '#c88a4a', '#4a2a1a'],
    desc: ['Blasts a spread of pellets.', '+2 pellets', '+50% damage', 'Fires faster, +2 pellets', "DRAGON'S BREATH: burning pellets"],
    lv: [{ cd: 1.25, dmg: 8, count: 5, spread: 0.55, range: 0.42 }, { count: 7 }, { dmg: 12 }, { cd: 0.95, count: 9 }, { count: 12, dmg: 15, burn: true, max: true }] },
  boomerang: { name: 'Boomerang', icon: 'boomerang', col: ['#e8a040', '#ffd080', '#8a5a1a'],
    desc: ['Flies out and comes back. Hits everything.', '+1 boomerang', 'Bigger, +50% damage', '+1 boomerang', 'FLAME RANG: on fire, +1 boomerang'],
    lv: [{ cd: 1.8, dmg: 14, count: 1, dist: 130, size: 1 }, { count: 2 }, { dmg: 22, size: 1.35 }, { count: 3 }, { count: 4, dmg: 32, size: 1.6, burn: true, max: true }] },
  blades: { name: 'Orbit Blades', icon: 'blades', col: ['#c8d8f0', '#ffffff', '#6a7a9a'],
    desc: ['Blades spin around you.', '+1 blade', 'Wider orbit, +60% damage', '+1 blade', 'SAWSTORM: 6 huge saws'],
    lv: [{ count: 2, dmg: 10, radius: 36, spin: 3.2 }, { count: 3 }, { dmg: 16, radius: 44 }, { count: 4 }, { count: 6, dmg: 24, radius: 52, spin: 4.2, max: true }] },
  lightning: { name: 'Lightning', icon: 'bolt', col: ['#ffe650', '#ffffff', '#c8a020'],
    desc: ['Strikes random zombies.', '+1 strike', '+50% damage', '+2 strikes, faster', 'THUNDER GOD: strikes chain'],
    lv: [{ cd: 1.6, dmg: 24, count: 2 }, { count: 3 }, { dmg: 36 }, { count: 5, cd: 1.3 }, { count: 6, dmg: 48, chain: 3, max: true }] },
  molotov: { name: 'Molotov', icon: 'molotov', col: ['#5ac05a', '#ff8a3a', '#2a6a2a'],
    desc: ['Leaves burning pools of fire.', '+1 bottle', 'Bigger, hotter flames', '+1 bottle', 'NAPALM: huge long fires'],
    lv: [{ cd: 2.4, dps: 12, count: 1, radius: 24, dur: 3 }, { count: 2 }, { radius: 30, dps: 18 }, { count: 3 }, { count: 4, radius: 38, dps: 28, dur: 4, max: true }] },
  aura: { name: 'Radiation', icon: 'rad', col: ['#6aff4a', '#d8ffc8', '#2a8a1a'],
    desc: ['Hurts every zombie near you.', 'Bigger, stronger', 'Bigger, stronger', 'Bigger, stronger', 'MELTDOWN: huge, slows zombies'],
    lv: [{ radius: 28, dps: 12 }, { radius: 34, dps: 17 }, { radius: 40, dps: 23 }, { radius: 46, dps: 30 }, { radius: 58, dps: 42, slow: 0.35, max: true }] },
  rockets: { name: 'Rockets', icon: 'rocket', col: ['#e83a3a', '#ff9a8a', '#8a1a1a'],
    desc: ['Homing rockets that explode.', '+1 rocket', 'Bigger blasts, +50% damage', '+1 rocket', 'SWARM: 5 rockets at once'],
    lv: [{ cd: 2.0, dmg: 30, count: 1, radius: 26 }, { count: 2 }, { dmg: 45, radius: 32 }, { count: 3 }, { count: 5, dmg: 60, radius: 36, max: true }] },
  frost: { name: 'Frost Nova', icon: 'snow', col: ['#8ad8ff', '#ffffff', '#3a7ab0'],
    desc: ['Freezing blast that slows zombies.', 'Bigger, stronger', 'More often', 'Bigger, can freeze solid', 'BLIZZARD: freezes everything'],
    lv: [{ cd: 4, dmg: 20, radius: 75, slow: 0.5 }, { dmg: 28, radius: 88 }, { cd: 3.1 }, { dmg: 40, radius: 105, freeze: 0.25 }, { dmg: 58, radius: 135, freeze: 1, cd: 2.8, max: true }] },
  drone: { name: 'Drone', icon: 'drone', col: ['#8a8aa0', '#ff5a5a', '#3a3a4a'],
    desc: ['A drone flies with you and shoots.', '+40% damage', '+1 drone', 'Faster shots', 'DRONE SQUAD: 3 drones'],
    lv: [{ cd: 0.42, dmg: 7, count: 1 }, { dmg: 10 }, { count: 2 }, { cd: 0.28, dmg: 13 }, { count: 3, dmg: 17, max: true }] },
  laser: { name: 'Laser', icon: 'laser', col: ['#ff3a8a', '#ffc8e0', '#8a1a4a'],
    desc: ['A beam that cuts through lines.', '+40% damage', '+1 beam', 'Thicker, faster', 'DEATH RAY: 4 beams'],
    lv: [{ cd: 2.2, dmg: 32, count: 1, width: 3 }, { dmg: 45 }, { count: 2 }, { cd: 1.6, width: 5, dmg: 55 }, { count: 4, dmg: 75, width: 6, max: true }] },
  cleaver: { name: 'Cleaver', icon: 'axe', col: ['#c8c8d8', '#ffffff', '#6a6a7a'],
    desc: ['Slashes zombies in front of you.', '+40% damage', 'Slashes both sides', 'Longer reach', 'WHIRLWIND: full spin'],
    lv: [{ cd: 1.1, dmg: 22, reach: 42, both: false }, { dmg: 30 }, { both: true }, { reach: 54, dmg: 40 }, { spin: true, dmg: 56, reach: 60, cd: 0.85, max: true }] },
};

// ------------------------------------------------------------ passives
const PASSIVES = {
  vitality:  { name: 'Vitality',  icon: 'heart',     col: ['#e83a4a', '#ff9aa8', '#8a1a2a'], desc: '+25 max health and heal' },
  sneakers:  { name: 'Sneakers',  icon: 'boot',      col: ['#e8e8f0', '#ffffff', '#3a6ad0'], desc: '+8% move speed' },
  power:     { name: 'Power',     icon: 'glove',     col: ['#e8703a', '#ffb08a', '#8a3a1a'], desc: '+12% damage' },
  haste:     { name: 'Haste',     icon: 'hourglass', col: ['#e8c060', '#fff3c4', '#8a6a2a'], desc: 'Weapons fire 7% faster' },
  growth:    { name: 'Growth',    icon: 'ring',      col: ['#b07cff', '#e0c8ff', '#5a2aa0'], desc: '+12% area and size' },
  magnet:    { name: 'Magnet',    icon: 'magnet',    col: ['#e83a3a', '#e8e8f0', '#8a1a1a'], desc: '+35% pickup range' },
  kevlar:    { name: 'Kevlar',    icon: 'cloak',     col: ['#5a6a8a', '#8a9aba', '#2a3a5a'], desc: 'Take 7% less damage' },
  regen:     { name: 'Bandages',  icon: 'jar',       col: ['#e8e4d8', '#ffffff', '#c83a3a'], desc: 'Heal 0.5 health per second' },
  multishot: { name: 'Multishot', icon: 'arrows',    col: ['#6ad06a', '#c8ffc8', '#2a6a2a'], desc: '+1 projectile on odd levels' },
  lucky:     { name: 'Lucky',     icon: 'gem',       col: ['#4ad0a0', '#c8fff0', '#1a6a5a'], desc: '+6% crit chance, +10% coins' },
};
const MAX_LV = 5, WEAPON_SLOTS = 6, PASSIVE_SLOTS = 6;

// ------------------------------------------------------------ monsters
// speed in px/s, r = body radius, from = first wave they appear
const MONSTERS = {
  walker:  { name: 'Walker',  sprite: 'walker',  hp: 10,  speed: 24, dmg: 8,  r: 5, scale: 1,    from: 1,  weight: 10, coin: 0.07 },
  crawler: { name: 'Crawler', sprite: 'crawler', hp: 5,   speed: 34, dmg: 5,  r: 4, scale: 0.9,  from: 2,  weight: 6,  coin: 0.04 },
  runner:  { name: 'Runner',  sprite: 'walker',  hp: 12,  speed: 50, dmg: 8,  r: 5, scale: 1,    from: 4,  weight: 5,  coin: 0.08, tint: '#c83a3a' },
  spitter: { name: 'Spitter', sprite: 'walker',  hp: 18,  speed: 20, dmg: 6,  r: 5, scale: 1,    from: 7,  weight: 2.5,  coin: 0.12, tint: '#d8e03a', ranged: true },
  bloater: { name: 'Bloater', sprite: 'bloater', hp: 45,  speed: 16, dmg: 10, r: 7, scale: 1,    from: 8,  weight: 2,  coin: 0.2,  explode: 34 },
  brute:   { name: 'Brute',   sprite: 'brute',   hp: 150, speed: 18, dmg: 18, r: 9, scale: 1.1,  from: 10, weight: 1.2, coin: 0.5, heavy: true },
  riot:    { name: 'Riot Cop',sprite: 'riot',    hp: 70,  speed: 22, dmg: 10, r: 5, scale: 1,    from: 12, weight: 2.5, coin: 0.2, armor: 0.45 },
  ghoul:   { name: 'Ghoul',   sprite: 'walker',  hp: 40,  speed: 46, dmg: 12, r: 5, scale: 1.05, from: 14, weight: 3,  coin: 0.15, tint: '#9a7ab8' },
  witch:   { name: 'Witch',   sprite: 'witch',   hp: 90,  speed: 20, dmg: 10, r: 6, scale: 1,    from: 16, weight: 0.8, coin: 0.5, summons: true },
  hound:   { name: 'Hellhound', sprite: 'hound', hp: 32,  speed: 72, dmg: 12, r: 5, scale: 1,    from: 18, weight: 3,  coin: 0.12 },
  titan:   { name: 'Titan',   sprite: 'titan',   hp: 650, speed: 15, dmg: 26, r: 12, scale: 1.3, from: 22, weight: 0.5, coin: 1,  heavy: true },
};
// bosses every 5 waves
const BOSSES = {
  5:  { id: 'bertha',  name: 'BIG BERTHA',      sprite: 'bloater', scale: 3.0, hp: 1400,  speed: 20, dmg: 20, r: 20, tint: '#e8d04a', attacks: ['ring'],             summon: null },
  10: { id: 'tank',    name: 'THE TANK',        sprite: 'brute',   scale: 2.4, hp: 5200,  speed: 22, dmg: 24, r: 20, tint: null,      attacks: ['charge'],           summon: null },
  15: { id: 'queen',   name: 'WITCH QUEEN',     sprite: 'witch',   scale: 2.6, hp: 11000, speed: 22, dmg: 22, r: 16, tint: '#ff6ad8', attacks: ['spiral', 'summon'], summon: 'crawler' },
  20: { id: 'abom',    name: 'ABOMINATION',     sprite: 'titan',   scale: 2.6, hp: 22000, speed: 20, dmg: 40, r: 26, tint: null,      attacks: ['slam', 'charge'],   summon: null },
  25: { id: 'rotking', name: 'THE ROT KING',    sprite: 'walker',  scale: 3.2, hp: 36000, speed: 22, dmg: 34, r: 20, tint: '#ffe650', attacks: ['spiral', 'ring', 'summon'], summon: 'runner', crown: true },
  30: { id: 'zero',    name: 'PATIENT ZERO',    sprite: 'walker',  scale: 3.0, hp: 60000, speed: 30, dmg: 45, r: 20, tint: '#ff2a2a', attacks: ['spiral', 'charge', 'slam', 'summon'], summon: 'hound' },
};
const FINAL_WAVE = 30;

// zombies in wave n (wave 24+ is over 1000)
const waveQuota = n => Math.round(8 + 4 * n + 1.6 * n * n);
// health multiplier for wave n
const waveHp = n => 1 + 0.14 * (n - 1) + 0.0045 * (n - 1) * (n - 1);

// ------------------------------------------------------------ meta progression
const CHARACTERS = [
  { id: 'jake',  name: 'JAKE',  weapon: 'pistol',    cost: 0,    hair: '#5a3a1a', jacket: '#2a6ad0', hp: 100, speed: 1,    desc: 'Balanced survivor' },
  { id: 'rosa',  name: 'ROSA',  weapon: 'boomerang', cost: 400,  hair: '#1a1a1a', jacket: '#d04a6a', hp: 90,  speed: 1.08, desc: 'Fast, starts with a boomerang' },
  { id: 'blaze', name: 'BLAZE', weapon: 'molotov',   cost: 900,  hair: '#e8603a', jacket: '#3a3a3a', hp: 110, speed: 0.96, desc: 'Tough, starts with molotovs' },
  { id: 'volt',  name: 'VOLT',  weapon: 'lightning', cost: 1600, hair: '#ffe650', jacket: '#6a3ad0', hp: 90,  speed: 1,    desc: 'Starts with lightning' },
  { id: 'kira',  name: 'KIRA',  weapon: 'blades',    cost: 2600, hair: '#e8e8f0', jacket: '#1a8a6a', hp: 100, speed: 1.05, desc: 'Starts with orbit blades' },
];
const SHOP = [
  { id: 'hp',     name: 'Toughness', desc: '+10 starting max health', max: 5, cost: l => 80 + l * 70 },
  { id: 'dmg',    name: 'Training',  desc: '+5% damage',              max: 5, cost: l => 120 + l * 90 },
  { id: 'speed',  name: 'Cardio',    desc: '+4% move speed',          max: 5, cost: l => 100 + l * 70 },
  { id: 'magnet', name: 'Pockets',   desc: '+20% pickup range',       max: 3, cost: l => 80 + l * 60 },
  { id: 'reroll', name: 'Reroll',    desc: '+1 card reroll each run', max: 3, cost: l => 200 + l * 200 },
  { id: 'greed',  name: 'Greed',     desc: '+15% coins',              max: 4, cost: l => 150 + l * 120 },
  { id: 'revive', name: 'Second Life', desc: 'Come back once with half health', max: 1, cost: l => 900 },
];

// ------------------------------------------------------------ music
Object.assign(SONGS, {
  zmenu:  { seed: 7101, bpm: 92, root: 50, scale: 'harmonic', prog: [0, 5, 3, 4, 0, 5, 6, 4], density: 0.6, bass: 'x.......x..x....', kick: 'x.......x.......', snare: '............x...', hat: '..x...x...x...x.',
    pad: true, arp: true, arpRate: 2, introNoLead: true, inst: { lead: { type: 'square', vol: 0.06, echo: 0.35, verb: 0.4, lp: 1800 }, pad: { type: 'sawtooth', vol: 0.025, lp: 900 }, drumVol: 0.6 } },
  zfight1: { seed: 7201, bpm: 132, root: 52, scale: 'minor', prog: [0, 0, 5, 6, 0, 0, 3, 4], density: 0.85, bass: 'x.xx.xx.x.xx.xx.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    arp: true, arpRate: 2, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.06, lp: 2600 }, bass: { type: 'sawtooth', vol: 0.1, lp: 800 }, drumVol: 0.8 } },
  zfight2: { seed: 7301, bpm: 140, root: 50, scale: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 5, 4], density: 0.9, bass: 'xxx.xxx.xxx.xxx.', kick: 'x.x.x...x.x.x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'sawtooth', vol: 0.05, lp: 2200 }, bass: { type: 'square', vol: 0.11, lp: 700 }, drumVol: 0.85 } },
  zfight3: { seed: 7401, bpm: 152, root: 47, scale: 'harmonic', prog: [0, 1, 5, 4, 0, 1, 6, 4], density: 0.95, bass: 'x.xxx.xxx.xxx.xx', kick: 'x.x.x.x.x.x.x.x.', snare: '....x..x....x...', hat: 'xxxxxxxxxxxxxxxx',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.06 }, bass: { type: 'sawtooth', vol: 0.12, lp: 900 }, drumVol: 0.9 } },
  zboss:  { seed: 7501, bpm: 160, root: 45, scale: 'harmonic', prog: [0, 0, 1, 0, 0, 0, 6, 5], density: 0.95, bass: 'xxxxxxxxxxxxxxxx', kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x.x.', hat: 'x.xxx.xxx.xxx.xx',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'sawtooth', vol: 0.055, lp: 2600 }, bass: { type: 'sawtooth', vol: 0.12, lp: 900 }, drumVol: 0.95 } },
  zpick:  { seed: 7601, bpm: 100, root: 60, scale: 'lydian', prog: [0, 4, 5, 3], density: 0.6, bass: 'x.......x.......', kick: 'x.......x.......', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, arpOct: 1, inst: { lead: { type: 'triangle', vol: 0.12, echo: 0.3 }, arp: { type: 'triangle', vol: 0.03 }, drumVol: 0.4 } },
  zwin:   { seed: 7701, bpm: 120, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.8, bass: 'x...x...x...x...', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, inst: { lead: { type: 'square', vol: 0.07 }, drumVol: 0.6 } },
  zlose:  { seed: 7801, bpm: 70, root: 48, scale: 'minor', prog: [0, 5, 3, 4], density: 0.4, bass: 'x...............', kick: 'x...............', pad: true,
    inst: { lead: { type: 'triangle', vol: 0.12, echo: 0.4, verb: 0.5 }, drumVol: 0.4 } },
});
