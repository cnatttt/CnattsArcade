// =====================================================================
//  NIGHTFALL DEPTHS - game data. Tweak numbers here to rebalance.
// =====================================================================
const CLASSES = [
  { id: 'knight', name: 'KNIGHT', hp: 8, speed: 70, color: '#c8d0e0', cost: 0,
    attack: { kind: 'slash', dmg: 7, cd: 0.36, reach: 24 },
    special: { name: 'WHIRLWIND', cd: 5, desc: 'Spin and hit everything around you' },
    desc: 'Sturdy. Big sword swings up close.' },
  { id: 'ranger', name: 'RANGER', hp: 6, speed: 78, color: '#6ae06a', cost: 80,
    attack: { kind: 'arrow', dmg: 4, cd: 0.26, speed: 230 },
    special: { name: 'VOLLEY', cd: 4.5, desc: 'Fire a fan of 7 arrows' },
    desc: 'Fast. Shoots arrows from a safe distance.' },
  { id: 'mage', name: 'MAGE', hp: 6, speed: 70, color: '#c46cff', cost: 160,
    attack: { kind: 'fireball', dmg: 7, cd: 0.48, speed: 150, splash: 16 },
    special: { name: 'NOVA', cd: 6, desc: 'A ring of 12 fireballs' },
    desc: 'Fragile. Exploding fireballs hit groups.' },
];

// ai: chase | flutter | hop | ranged | phase | lunge | charge | summoner | turret | blink
const ENEMIES = {
  skeleton: { name: 'Skeleton',       hp: 12, speed: 30, ai: 'chase',    dmg: 1, sprite: 'skeleton', r: 6, souls: 1, gold: 0.5 },
  archer:   { name: 'Bone Archer',    hp: 9,  speed: 26, ai: 'ranged',   dmg: 1, sprite: 'skeleton', r: 6, tint: '#ffcc66', shot: { speed: 90, cd: 2.2, col: '#e8e4d8' }, souls: 1, gold: 0.5 },
  bat:      { name: 'Cave Bat',       hp: 5,  speed: 55, ai: 'flutter',  dmg: 1, sprite: 'bat', r: 5, fly: true, souls: 1, gold: 0.3 },
  slime:    { name: 'Gloom Slime',    hp: 16, speed: 40, ai: 'hop',      dmg: 1, sprite: 'slime', r: 6, split: true, souls: 1, gold: 0.5 },
  ghost:    { name: 'Lost Soul',      hp: 14, speed: 24, ai: 'phase',    dmg: 1, sprite: 'ghost', r: 6, fly: true, souls: 2, gold: 0.4 },
  spider:   { name: 'Crypt Spider',   hp: 10, speed: 40, ai: 'lunge',    dmg: 1, sprite: 'spider', r: 6, souls: 1, gold: 0.4 },
  shroom:   { name: 'Sporeling',      hp: 14, speed: 28, ai: 'chase',    dmg: 1, sprite: 'shroom', r: 6, spores: true, souls: 1, gold: 0.5 },
  wraith:   { name: 'Frost Wraith',   hp: 18, speed: 22, ai: 'ranged',   dmg: 1, sprite: 'ghost', r: 6, fly: true, tint: '#8ad8ff', shot: { speed: 80, cd: 2.4, spread: 3, col: '#a8f0ff', slow: true }, souls: 2, gold: 0.6 },
  imp:      { name: 'Fire Imp',       hp: 16, speed: 34, ai: 'blink',    dmg: 1, sprite: 'imp', r: 6, shot: { speed: 100, cd: 1.8, col: '#ff8a3a', burn: true }, souls: 2, gold: 0.6 },
  golem:    { name: 'Stone Golem',    hp: 55, speed: 18, ai: 'charge',   dmg: 2, sprite: 'golem', r: 8, scale: 1.3, souls: 4, gold: 1.5 },
  cultist:  { name: 'Void Cultist',   hp: 22, speed: 20, ai: 'summoner', dmg: 1, sprite: 'cultist', r: 6, shot: { speed: 70, cd: 3.2, ring: 8, col: '#ff3aff' }, souls: 3, gold: 1 },
  eye:      { name: 'Watcher',        hp: 26, speed: 14, ai: 'turret',   dmg: 1, sprite: 'eye', r: 7, fly: true, shot: { speed: 70, cd: 0.22, spiral: true, col: '#ff3a8a' }, souls: 3, gold: 1 },
};

const FLOORS = [
  { name: 'THE CRYPT',          sub: 'Where the dead keep watch',     floor: ['#2a2434', '#322a3e', '#241e2e'], wall: ['#4a4058', '#3a3048', '#1e1828'], accent: '#e8c060', dark: 0.62,
    enemies: ['skeleton', 'bat', 'slime', 'archer', 'spider'], deco: 'bones', boss: 'boneking', song: 'crypt' },
  { name: 'FUNGAL HOLLOWS',     sub: 'Something here is growing',     floor: ['#1e2a1e', '#243224', '#1a241a'], wall: ['#3a4a32', '#2e3c28', '#182014'], accent: '#ff6a8a', dark: 0.66,
    enemies: ['shroom', 'slime', 'bat', 'spider', 'archer', 'ghost'], deco: 'mushrooms', boss: 'mothershroom', song: 'fungal' },
  { name: 'FROZEN HALLS',       sub: 'Cold enough to stop a heart',   floor: ['#1e2a3a', '#243244', '#1a2434'], wall: ['#5a7a9a', '#46647e', '#22384e'], accent: '#a8f0ff', dark: 0.58,
    enemies: ['wraith', 'ghost', 'golem', 'skeleton', 'archer', 'bat'], deco: 'ice', boss: 'frostwyrm', song: 'frozen' },
  { name: 'INFERNAL FORGE',     sub: 'The walls are breathing fire',  floor: ['#2e1a16', '#381e18', '#26140e'], wall: ['#5a2a1e', '#4a2018', '#24100a'], accent: '#ff8a3a', dark: 0.6,
    enemies: ['imp', 'golem', 'cultist', 'skeleton', 'archer', 'bat'], deco: 'lava', boss: 'forgedemon', song: 'forge' },
  { name: 'THE VOID THRONE',    sub: 'Nightfall begins here',         floor: ['#160e24', '#1c122c', '#100a1a'], wall: ['#3a2458', '#2c1a44', '#120a1e'], accent: '#c46cff', dark: 0.7,
    enemies: ['eye', 'cultist', 'ghost', 'imp', 'wraith', 'golem'], deco: 'void', boss: 'voidlord', song: 'void' },
];

const BOSSES = {
  boneking:     { name: 'THE BONE KING',  hp: 280, r: 14, sprite: 'skeleton', scale: 2.4, tint: '#ffe680', crown: true, speed: 26, souls: 25 },
  mothershroom: { name: 'MOTHER SHROOM',  hp: 360, r: 16, sprite: 'shroom',   scale: 2.8, speed: 0, souls: 30 },
  frostwyrm:    { name: 'THE FROST WYRM', hp: 440, r: 9,  sprite: null,       scale: 1, speed: 60, souls: 35 },
  forgedemon:   { name: 'FORGE DEMON',    hp: 540, r: 15, sprite: 'imp',      scale: 2.6, speed: 40, souls: 40 },
  voidlord:     { name: 'THE VOID LORD',  hp: 760, r: 18, sprite: 'eye',      scale: 3, speed: 20, souls: 60 },
};

// rarity: 0 common, 1 rare, 2 legendary
const RELICS = [
  { id: 'whetstone', name: 'Iron Whetstone',  r: 0, icon: 'sword',   col: ['#c8d0e0', '#ffffff', '#6a7290'], desc: '+20% damage', fx: { dmg: 0.2 } },
  { id: 'boots',     name: 'Swift Boots',     r: 0, icon: 'boot',    col: ['#a07040', '#e0b080', '#5a3a1a'], desc: '+15% move speed', fx: { speed: 0.15 } },
  { id: 'glove',     name: 'Quickdraw Glove', r: 0, icon: 'glove',   col: ['#c8a050', '#f0d898', '#7a5a2a'], desc: '+20% attack speed', fx: { rate: 0.2 } },
  { id: 'heartc',    name: 'Heart Container', r: 0, icon: 'heart',   col: ['#e83a4a', '#ff9aa8', '#a81a2a'], desc: '+1 heart and heal', fx: { maxhp: 2 } },
  { id: 'luckycoin', name: 'Lucky Coin',      r: 0, icon: 'coin',    col: ['#f2c14e', '#fff3c4', '#c08a20'], desc: '+30% gold, better loot', fx: { gold: 0.3, luck: 0.1 } },
  { id: 'reach',     name: 'Giant\'s Reach',  r: 0, icon: 'gem',     col: ['#6ad0ff', '#d8f8ff', '#2a6a9a'], desc: '+25% range and size', fx: { range: 0.25 } },
  { id: 'thorns',    name: 'Spiked Pauldrons',r: 0, icon: 'fang',    col: ['#8a8a9a', '#d8d8e8', '#4a4a5a'], desc: 'Enemies that hit you take 8 damage', fx: { thorns: 8 } },
  { id: 'seal',      name: 'Merchant\'s Seal',r: 0, icon: 'ring',    col: ['#f2c14e', '#fff3c4', '#8a6a1a'], desc: 'Shop prices -35%', fx: { discount: 0.35 } },
  { id: 'soujar',    name: 'Soul Jar',        r: 0, icon: 'jar',     col: ['#8ad8ff', '#e8f8ff', '#3a6a9a'], desc: '+50% souls', fx: { souls: 0.5 } },
  { id: 'magnet',    name: 'Lodestone',       r: 0, icon: 'magnet',  col: ['#e83a3a', '#ff9a9a', '#8a1a1a'], desc: 'Pickups fly to you', fx: { magnet: 1 } },
  { id: 'glass',     name: 'Glass Dagger',    r: 1, icon: 'dagger',  col: ['#a8f0ff', '#ffffff', '#4a8aa0'], desc: '+15% crit chance', fx: { crit: 0.15 } },
  { id: 'ember',     name: 'Ember Sigil',     r: 1, icon: 'flame',   col: ['#ff8a3a', '#ffe650', '#c83a1a'], desc: 'Attacks set enemies on fire', fx: { burn: 1 } },
  { id: 'frost',     name: 'Frost Shard',     r: 1, icon: 'snow',    col: ['#a8f0ff', '#ffffff', '#4a8ac0'], desc: 'Attacks slow enemies', fx: { slow: 1 } },
  { id: 'venom',     name: 'Venom Fang',      r: 1, icon: 'fang',    col: ['#6ae06a', '#c8ffc8', '#2a7a2a'], desc: 'Attacks poison enemies', fx: { poison: 1 } },
  { id: 'vampire',   name: 'Vampire Tooth',   r: 1, icon: 'fang',    col: ['#c81a2a', '#ff6a7a', '#6a0a14'], desc: 'Kills have a 12% chance to heal', fx: { lifesteal: 0.12 } },
  { id: 'split',     name: 'Split Shot',      r: 1, icon: 'arrows',  col: ['#e8c060', '#fff3c4', '#8a6a2a'], desc: '+1 projectile / extra sword wave', fx: { multi: 1 } },
  { id: 'ghostly',   name: 'Ghost Thread',    r: 1, icon: 'ghost',   col: ['#e8f0ff', '#ffffff', '#8a9ac8'], desc: 'Shots pierce through enemies', fx: { pierce: 1 } },
  { id: 'seeker',    name: 'Seeker\'s Eye',   r: 1, icon: 'eye',     col: ['#ff3a8a', '#ffffff', '#8a1a4a'], desc: 'Shots home in on enemies', fx: { homing: 1 } },
  { id: 'orbskull',  name: 'Orbiting Skull',  r: 1, icon: 'skull',   col: ['#e8e4d8', '#ffffff', '#8a8478'], desc: 'A skull circles you, biting enemies', fx: { orbitals: 1 } },
  { id: 'bombs',     name: 'Powder Keg',      r: 1, icon: 'bomb',    col: ['#3a3448', '#8a849a', '#1a1428'], desc: 'Enemies explode when they die', fx: { boom: 1 } },
  { id: 'wisp',      name: 'Wisp Lantern',    r: 1, icon: 'lantern', col: ['#ffe680', '#ffffff', '#c8a040'], desc: 'A wisp follows you and shoots', fx: { wisp: 1 } },
  { id: 'cloak',     name: 'Shadow Cloak',    r: 1, icon: 'cloak',   col: ['#3a2458', '#6a4a8a', '#1a0e2a'], desc: 'Dodge recharges 40% faster', fx: { dodge: 0.4 } },
  { id: 'firetrail', name: 'Cinder Boots',    r: 1, icon: 'boot',    col: ['#ff8a3a', '#ffe650', '#8a2a0a'], desc: 'Dodging leaves a trail of fire', fx: { trail: 1 } },
  { id: 'axe',       name: 'Executioner\'s Axe', r: 1, icon: 'axe',  col: ['#8a8a9a', '#e8e8f0', '#4a4a5a'], desc: 'Critical hits deal triple damage', fx: { critdmg: 1 } },
  { id: 'moss',      name: 'Healing Moss',    r: 1, icon: 'shroom',  col: ['#4ac05a', '#c8ffc8', '#1a6a2a'], desc: 'Clearing a room may heal you', fx: { roomheal: 0.4 } },
  { id: 'hourglass', name: 'Sand of Ages',    r: 1, icon: 'hourglass', col: ['#e8c060', '#fff3c4', '#8a6a2a'], desc: 'Enemies move 15% slower', fx: { enemyslow: 0.15 } },
  { id: 'belt',      name: 'Titan Belt',      r: 1, icon: 'belt',    col: ['#8a5a2a', '#c89a5a', '#4a2a0a'], desc: '+2 hearts, but 8% slower', fx: { maxhp: 4, speed: -0.08 } },
  { id: 'phoenix',   name: 'Phoenix Feather', r: 2, icon: 'feather', col: ['#ff8a3a', '#ffe650', '#c81a1a'], desc: 'Come back to life once', fx: { revive: 1 } },
  { id: 'bloodpact', name: 'Blood Pact',      r: 2, icon: 'heart',   col: ['#6a0a14', '#c81a2a', '#2a0004'], desc: '+60% damage, lose 1 heart', fx: { dmg: 0.6, maxhp: -2 } },
  { id: 'chain',     name: 'Storm Sigil',     r: 2, icon: 'bolt',    col: ['#ffe650', '#ffffff', '#c8a020'], desc: 'Hits chain lightning to nearby foes', fx: { chain: 1 } },
  { id: 'twin',      name: 'Twin Blades',     r: 2, icon: 'blades',  col: ['#c46cff', '#f0d8ff', '#5a2a9a'], desc: '+30% attack speed and +1 projectile', fx: { rate: 0.3, multi: 1 } },
  { id: 'sporecrown',name: 'Spore Crown',     r: 2, icon: 'shroom',  col: ['#c83a5a', '#ffffff', '#6a1a2a'], desc: 'A gift from MUSH: +1 heart, +15% dmg, poison', fx: { maxhp: 2, dmg: 0.15, poison: 1 } },
];
const RARITY_COL = ['#c8d0dc', '#4aa8ff', '#ffcc33'];
const RARITY_NAME = ['COMMON', 'RARE', 'LEGENDARY'];

// permanent upgrades bought with souls in the Sanctum
const UPGRADES = [
  { id: 'vit',    name: 'Vitality',      desc: '+1 max heart',                    costs: [40, 110, 240] },
  { id: 'might',  name: 'Might',         desc: '+10% damage',                     costs: [50, 130, 280] },
  { id: 'fort',   name: 'Fortune',       desc: 'Start each run with +20 gold',    costs: [30, 90] },
  { id: 'alch',   name: 'Alchemy',       desc: 'Start with an extra potion',      costs: [60, 160] },
  { id: 'swift',  name: 'Fleet Foot',    desc: 'Dodge recharges faster',          costs: [70] },
  { id: 'keen',   name: 'Keen Eye',      desc: 'Better relics appear',            costs: [120, 260] },
  { id: 'heir',   name: 'Heirloom',      desc: 'Start with a random relic',       costs: [200] },
  { id: 'greed',  name: 'Soul Greed',    desc: '+25% souls',                      costs: [150, 320] },
];

Object.assign(SONGS, {
  dmenu:  { seed: 1666, bpm: 72, root: 50, scale: 'harmonic', prog: [0, 5, 3, 4, 0, 5, 1, 4], density: 0.5, bass: 'x.......x.......', pad: true, arp: true, arpRate: 4, introNoLead: true,
    inst: { lead: { type: 'square', vol: 0.06, lp: 1800, echo: 0.4, verb: 0.5 }, pad: { type: 'sawtooth', vol: 0.025, lp: 800 } } },
  crypt:  { seed: 201, bpm: 96, root: 52, scale: 'minor', prog: [0, 5, 3, 4, 0, 5, 6, 4], density: 0.7, bass: 'x..x..x.x..x..x.', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    pad: true, inst: { lead: { type: 'square', vol: 0.06, lp: 2400, echo: 0.2 }, drumVol: 0.6 } },
  fungal: { seed: 302, bpm: 88, root: 50, scale: 'dorian', prog: [0, 3, 0, 3, 5, 4, 3, 4], density: 0.65, swing: 0.15, bass: 'x..o..x...o..x..', kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    arp: true, arpRate: 2, inst: { lead: { type: 'triangle', vol: 0.12, echo: 0.3 }, arp: { type: 'sine', vol: 0.05 }, drumVol: 0.6 } },
  frozen: { seed: 403, bpm: 80, root: 57, scale: 'harmonic', prog: [0, 5, 1, 4, 0, 5, 3, 4], density: 0.55, bass: 'x.......x.......', kick: 'x.......x.......', hat: '..x...x...x...x.',
    arp: true, arpRate: 1, arpOct: 2, pad: true, inst: { lead: { type: 'triangle', vol: 0.12, echo: 0.4, verb: 0.5 }, arp: { type: 'triangle', vol: 0.025, echo: 0.2 }, drumVol: 0.5 } },
  forge:  { seed: 504, bpm: 120, root: 50, scale: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 5, 4], density: 0.8, bass: 'x.xx.xx.x.xx.xx.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    inst: { lead: { type: 'sawtooth', vol: 0.05, lp: 2000 }, bass: { type: 'sawtooth', vol: 0.1, lp: 700 }, drumVol: 0.85 } },
  void:   { seed: 605, bpm: 70, root: 48, scale: 'phrygian', prog: [0, 1, 5, 4, 0, 1, 6, 4], density: 0.45, bass: 'x...............', kick: 'x.......x..x....', snare: '............x...', hat: '..x...x...x...x.',
    pad: true, arp: true, arpRate: 4, inst: { lead: { type: 'square', vol: 0.06, echo: 0.5, verb: 0.5, lp: 1800, vib: 0.012 }, pad: { type: 'sawtooth', vol: 0.025, lp: 900 }, drumVol: 0.55 } },
  boss:   { seed: 777, bpm: 152, root: 50, scale: 'harmonic', prog: [0, 0, 5, 4, 0, 0, 6, 4], density: 0.95, bass: 'xxx.xxx.xxx.xxx.', kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.065 }, bass: { type: 'sawtooth', vol: 0.11, lp: 900 }, drumVol: 0.9 } },
  victory:{ seed: 888, bpm: 110, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.8, bass: 'x...x...x...x...', kick: 'x.......x.......', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, pad: true, inst: { lead: { type: 'triangle', vol: 0.14, verb: 0.4 } } },
  death:  { seed: 13, bpm: 60, root: 45, scale: 'minor', prog: [0, 5, 3, 4], density: 0.35, bass: 'x...............', pad: true, inst: { lead: { type: 'triangle', vol: 0.1, echo: 0.4, verb: 0.6 } } },
});

// level-up choices (pick 1 of 3 each time you level up)
const LEVELUPS = [
  { id: 'dmg',    name: 'SHARPER',      desc: '+15% damage',            col: '#ff6a5a', w: 10, fx: { dmg: 0.15 } },
  { id: 'rate',   name: 'FASTER HANDS', desc: '+15% attack speed',      col: '#ffcc33', w: 10, fx: { rate: 0.15 } },
  { id: 'speed',  name: 'LIGHT FEET',   desc: '+10% move speed',        col: '#6ad0ff', w: 8,  fx: { speed: 0.1 } },
  { id: 'hp',     name: 'TOUGHER',      desc: '+1 heart and heal it',   col: '#e83a4a', w: 9,  fx: { maxhp: 2 } },
  { id: 'heal',   name: 'SECOND WIND',  desc: 'Heal to full health',    col: '#ff9ab0', w: 6,  heal: true },
  { id: 'range',  name: 'LONG ARMS',    desc: '+20% range and size',    col: '#a8f0ff', w: 7,  fx: { range: 0.2 } },
  { id: 'crit',   name: 'KEEN EYE',     desc: '+8% critical chance',    col: '#ffe650', w: 7,  fx: { crit: 0.08 } },
  { id: 'multi',  name: 'ONE MORE',     desc: '+1 projectile / sword wave', col: '#c46cff', w: 3, fx: { multi: 1 } },
  { id: 'spec',   name: 'FOCUS',        desc: 'Special recharges 25% faster', col: '#b07cff', w: 6, fx: { spec: 0.25 } },
  { id: 'dodge',  name: 'NIMBLE',       desc: 'Dodge recharges 25% faster',   col: '#6affd0', w: 5, fx: { dodge: 0.25 } },
  { id: 'gold',   name: 'GREEDY',       desc: '+40% gold from monsters',      col: '#f2c14e', w: 5, fx: { gold: 0.4 } },
  { id: 'orbit',  name: 'BONE BUDDY',   desc: 'Another skull orbits you',     col: '#e8e4d8', w: 3, fx: { orbitals: 1 } },
  { id: 'relic',  name: 'TREASURE',     desc: 'Get a random relic now',       col: '#4aa8ff', w: 3, relic: true },
];
