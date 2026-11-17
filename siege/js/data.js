// =====================================================================
//  NIGHTFALL SIEGE - data. Tweak numbers here to rebalance.
//  Map grid is 16 x 11 tiles. Paths are lists of tile waypoints.
// =====================================================================
const MAPS = [
  { id: 'meadow', name: 'GREENWOOD ROAD', sub: 'The first night of the siege', theme: 'meadow', boss: 'boneking',
    path: [[-1, 2], [3, 2], [3, 7], [8, 7], [8, 3], [12, 3], [12, 8], [14, 8]], castle: [14, 7],
    pool: ['skeleton', 'wolf', 'bat', 'slime'], song: 'meadow', hp: 1.0 },
  { id: 'crypt', name: 'HOLLOW GRAVES', sub: 'The dead do not rest here', theme: 'crypt', boss: 'boneking',
    path: [[2, -1], [2, 4], [6, 4], [6, 1], [11, 1], [11, 6], [5, 6], [5, 9], [14, 9]], castle: [14, 8],
    pool: ['skeleton', 'bat', 'knight', 'ghost', 'shaman'], song: 'crypt', hp: 1.15 },
  { id: 'frozen', name: 'FROSTFANG PASS', sub: 'Cold winds carry wings', theme: 'frozen', boss: 'frostwyrm',
    path: [[16, 1], [10, 1], [10, 4], [13, 4], [13, 8], [7, 8], [7, 3], [4, 3], [4, 8], [1, 8]], castle: [0, 8],
    pool: ['wolf', 'skeleton', 'bat', 'wraith', 'knight', 'golem'], song: 'frozen', hp: 1.3 },
  { id: 'forge', name: 'INFERNAL FORGE', sub: 'The mountain burns', theme: 'forge', boss: 'forgedemon',
    path: [[1, 11], [1, 7], [5, 7], [5, 9], [9, 9], [9, 5], [3, 5], [3, 1], [8, 1], [8, 3], [12, 3], [12, 1], [14, 1]], castle: [14, 0],
    pool: ['imp', 'wolf', 'slime', 'knight', 'shaman', 'golem'], song: 'forge', hp: 1.45 },
  { id: 'void', name: 'THE VOID GATE', sub: 'Nightfall itself comes for you', theme: 'void', boss: 'voidlord',
    path: [[-1, 5], [2, 5], [2, 1], [13, 1], [13, 9], [4, 9], [4, 3], [11, 3], [11, 7], [7, 7], [7, 6]], castle: [7, 5],
    pool: ['imp', 'knight', 'ghost', 'eye', 'shaman', 'wraith', 'golem'], song: 'void', hp: 1.6 },
];
const WAVES_PER_MAP = 20;

// damage types: phys (armor reduces it), magic (ignores armor), fire
const TOWERS = [
  { id: 'archer', name: 'ARCHER TOWER', key: '1', cost: 70, air: true, type: 'phys', color: '#6ad06a', desc: 'Fast arrows. Hits flying enemies.',
    lv: [ { dmg: 7, rate: 0.62, range: 2.8 }, { cost: 80, dmg: 11, rate: 0.52, range: 3.0 }, { cost: 130, dmg: 17, rate: 0.45, range: 3.3 }, { cost: 240, dmg: 24, rate: 0.4, range: 3.5, shots: 3, note: 'Fires 3 arrows' } ] },
  { id: 'cannon', name: 'CANNON', key: '2', cost: 120, air: false, type: 'phys', color: '#e8a040', desc: 'Exploding shells. Can\'t hit flyers.',
    lv: [ { dmg: 22, rate: 1.6, range: 2.6, splash: 0.9 }, { cost: 130, dmg: 34, rate: 1.5, range: 2.7, splash: 1.0 }, { cost: 200, dmg: 52, rate: 1.4, range: 2.9, splash: 1.15 }, { cost: 340, dmg: 75, rate: 1.3, range: 3.1, splash: 1.3, cluster: 4, note: 'Cluster bombs' } ] },
  { id: 'frost', name: 'FROST MAGE', key: '3', cost: 100, air: true, type: 'magic', color: '#8ad8ff', desc: 'Slows enemies. Ignores armor.',
    lv: [ { dmg: 4, rate: 1.0, range: 2.5, slow: 0.4 }, { cost: 110, dmg: 7, rate: 0.9, range: 2.7, slow: 0.5 }, { cost: 170, dmg: 11, rate: 0.85, range: 2.9, slow: 0.55, area: 0.8 }, { cost: 290, dmg: 18, rate: 0.8, range: 3.1, slow: 0.6, area: 1.0, freeze: 0.15, note: 'Chance to freeze solid' } ] },
  { id: 'storm', name: 'STORM SPIRE', key: '4', cost: 150, air: true, type: 'magic', color: '#ffe650', desc: 'Lightning chains between enemies.',
    lv: [ { dmg: 16, rate: 1.25, range: 2.6, chain: 3 }, { cost: 150, dmg: 23, rate: 1.15, range: 2.8, chain: 4 }, { cost: 230, dmg: 34, rate: 1.05, range: 3.0, chain: 5 }, { cost: 390, dmg: 50, rate: 0.95, range: 3.2, chain: 7, stun: 0.2, note: 'Chains 7 and stuns' } ] },
  { id: 'flame', name: 'FLAME BRAZIER', key: '5', cost: 110, air: false, type: 'fire', color: '#ff6a2a', desc: 'Short-range fire. Burns groups.',
    lv: [ { dmg: 5, rate: 0.12, range: 1.7, burn: 4 }, { cost: 120, dmg: 8, rate: 0.12, range: 1.8, burn: 6 }, { cost: 180, dmg: 12, rate: 0.12, range: 2.0, burn: 9 }, { cost: 310, dmg: 18, rate: 0.12, range: 2.2, burn: 14, blue: true, note: 'Blue fire: burns fire-proof foes' } ] },
  { id: 'ballista', name: 'BALLISTA', key: '6', cost: 180, air: true, type: 'pierce', color: '#c8a0ff', desc: 'Huge range and damage. Pierces armor.',
    lv: [ { dmg: 65, rate: 2.5, range: 5.0 }, { cost: 170, dmg: 100, rate: 2.35, range: 5.4 }, { cost: 260, dmg: 150, rate: 2.15, range: 5.8 }, { cost: 430, dmg: 230, rate: 1.95, range: 6.4, crit: 0.3, note: '30% chance of triple damage' } ] },
  { id: 'mine', name: 'GOLD MINE', key: '7', cost: 150, air: false, type: 'none', color: '#f2c14e', desc: 'Makes gold after every wave.',
    lv: [ { gold: 25 }, { cost: 150, gold: 45 }, { cost: 220, gold: 70 }, { cost: 320, gold: 105, note: '+105 gold per wave' } ] },
];

// speed in tiles per second; armor is flat damage reduction for phys
const ENEMIES = {
  skeleton: { name: 'Skeleton',     hp: 34,  speed: 0.95, gold: 4,  sprite: 'skeleton' },
  wolf:     { name: 'Dire Wolf',    hp: 24,  speed: 1.9,  gold: 4,  sprite: 'wolf' },
  bat:      { name: 'Cave Bat',     hp: 20,  speed: 1.45, gold: 3,  sprite: 'bat', fly: true },
  slime:    { name: 'Gloom Slime',  hp: 44,  speed: 0.85, gold: 4,  sprite: 'slime', split: true },
  knight:   { name: 'Dark Knight',  hp: 70,  speed: 0.75, gold: 8,  sprite: 'knight', armor: 7 },
  ghost:    { name: 'Lost Soul',    hp: 32,  speed: 1.0,  gold: 6,  sprite: 'ghost', fly: true, ethereal: true },
  shaman:   { name: 'Bone Shaman',  hp: 50,  speed: 0.85, gold: 10, sprite: 'shaman', heals: true },
  golem:    { name: 'Stone Golem',  hp: 260, speed: 0.5,  gold: 20, sprite: 'golem', armor: 12, lives: 3, big: true },
  wraith:   { name: 'Frost Wraith', hp: 50,  speed: 1.05, gold: 8,  sprite: 'ghost', tint: '#8ad8ff', fly: true, noslow: true },
  imp:      { name: 'Fire Imp',     hp: 46,  speed: 1.35, gold: 6,  sprite: 'imp', fireproof: true },
  eye:      { name: 'Watcher',      hp: 90,  speed: 0.8,  gold: 10, sprite: 'eye', fly: true, armor: 4 },
};
const BOSSES = {
  boneking:   { name: 'THE BONE KING',  hp: 2600, speed: 0.45, gold: 200, sprite: 'skeleton', tint: '#ffe680', armor: 8, lives: 10, crown: true, summon: 'skeleton' },
  frostwyrm:  { name: 'THE FROST WYRM', hp: 3400, speed: 0.7,  gold: 250, sprite: 'wyrm', armor: 4, lives: 10, noslow: true, fly: true },
  forgedemon: { name: 'FORGE DEMON',    hp: 4600, speed: 0.4,  gold: 300, sprite: 'imp', armor: 14, lives: 10, fireproof: true, summon: 'imp' },
  voidlord:   { name: 'THE VOID LORD',  hp: 6500, speed: 0.38, gold: 400, sprite: 'eye', armor: 10, lives: 12, blink: true, summon: 'eye' },
};

const SPELLS = [
  { id: 'meteor', name: 'METEOR', key: 'Q', cd: 40, desc: 'Click to drop a meteor' },
  { id: 'freeze', name: 'FREEZE', key: 'W', cd: 55, desc: 'Freeze every enemy for 3s' },
];

// permanent upgrades bought with stars
const PERKS = [
  { id: 'chest',   name: 'War Chest',      desc: '+100 starting gold',              cost: 2 },
  { id: 'walls',   name: 'Thick Walls',    desc: '+5 lives',                        cost: 2 },
  { id: 'archer',  name: 'Sharpshooters',  desc: 'Archer towers +25% damage',       cost: 2 },
  { id: 'cannon',  name: 'Black Powder',   desc: 'Cannons +25% damage',             cost: 2 },
  { id: 'frost',   name: 'Deep Freeze',    desc: 'Frost slows 10% more',            cost: 2 },
  { id: 'storm',   name: 'Overcharge',     desc: 'Storm spires chain +1',           cost: 3 },
  { id: 'flame',   name: 'Hot Coals',      desc: 'Burning lasts 50% longer',        cost: 2 },
  { id: 'eagle',   name: 'Eagle Eye',      desc: 'All towers +10% range',           cost: 3 },
  { id: 'meteor',  name: 'Starfall',       desc: 'Spells recharge 30% faster',      cost: 3 },
  { id: 'cheap',   name: 'Guild Discount', desc: 'Towers cost 10% less',            cost: 4 },
];

Object.assign(SONGS, {
  smenu:  { seed: 9001, bpm: 100, root: 57, scale: 'dorian', prog: [0, 3, 4, 3, 0, 5, 3, 4], density: 0.7, bass: 'x...x...x...x...', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, pad: true, inst: { lead: { type: 'square', vol: 0.06, lp: 2600 }, drumVol: 0.6 } },
  meadow: { seed: 9101, bpm: 112, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.8, swing: 0.1, bass: 'x..x..x.x..x..x.', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, inst: { lead: { type: 'triangle', vol: 0.13 }, drumVol: 0.6 } },
  crypt:  { seed: 9201, bpm: 104, root: 52, scale: 'minor', prog: [0, 5, 3, 4, 0, 5, 6, 4], density: 0.75, bass: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    pad: true, inst: { lead: { type: 'square', vol: 0.06, lp: 2400, echo: 0.2 }, drumVol: 0.7 } },
  frozen: { seed: 9301, bpm: 96, root: 62, scale: 'lydian', prog: [0, 4, 5, 3, 0, 4, 1, 3], density: 0.65, bass: 'x.......x...x...', kick: 'x.......x.......', hat: '..x...x...x...x.',
    arp: true, arpRate: 1, arpOct: 2, inst: { lead: { type: 'triangle', vol: 0.13, echo: 0.3 }, arp: { type: 'triangle', vol: 0.025 }, drumVol: 0.5 } },
  forge:  { seed: 9401, bpm: 126, root: 50, scale: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 5, 4], density: 0.85, bass: 'x.xx.xx.x.xx.xx.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    inst: { lead: { type: 'sawtooth', vol: 0.05, lp: 2000 }, bass: { type: 'sawtooth', vol: 0.1, lp: 700 }, drumVol: 0.85 } },
  void:   { seed: 9501, bpm: 92, root: 48, scale: 'harmonic', prog: [0, 1, 5, 4, 0, 1, 6, 4], density: 0.6, bass: 'x...x...x...x...', kick: 'x.......x..x....', snare: '............x...', hat: '..x...x...x...x.',
    pad: true, arp: true, arpRate: 2, inst: { lead: { type: 'square', vol: 0.06, echo: 0.4, verb: 0.4, lp: 1800 }, pad: { type: 'sawtooth', vol: 0.025, lp: 900 }, drumVol: 0.6 } },
  sboss:  { seed: 9601, bpm: 150, root: 50, scale: 'harmonic', prog: [0, 0, 5, 4, 0, 0, 6, 4], density: 0.95, bass: 'xxx.xxx.xxx.xxx.', kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.065 }, bass: { type: 'sawtooth', vol: 0.11, lp: 900 }, drumVol: 0.9 } },
  swin:   { seed: 9701, bpm: 116, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.8, bass: 'x...x...x...x...', kick: 'x.......x.......', hat: '..x...x...x...x.', arp: true, arpRate: 2, pad: true,
    inst: { lead: { type: 'triangle', vol: 0.14, verb: 0.4 } } },
  slose:  { seed: 13, bpm: 60, root: 45, scale: 'minor', prog: [0, 5, 3, 4], density: 0.35, bass: 'x...............', pad: true, inst: { lead: { type: 'triangle', vol: 0.1, echo: 0.4, verb: 0.6 } } },
});
