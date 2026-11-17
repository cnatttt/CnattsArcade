// =====================================================================
//  GAME DATA - lakes, rods and bait. Fish live in fishdata.js.
//  Tweak prices / stats here to rebalance the game.
// =====================================================================
const RARITY = [
  { name: 'Common',    color: '#c8d0dc' },
  { name: 'Uncommon',  color: '#6ad06a' },
  { name: 'Rare',      color: '#4aa8ff' },
  { name: 'Legendary', color: '#ffcc33' },
  { name: 'Mythic',    color: '#d07cff' },
];

const LAKES = [
  { id: 'moonlit', name: 'Moonlit Lake', cost: 0, need: 0, accent: '#ffcc66', panel: '#241c3e',
    tagline: 'Where every angler starts.',
    keeper: { name: 'Old Tom', title: 'Bait & Tackle',
      hello: ["Evenin'. Fish are bitin' tonight.", "Back again? Good. Lake's restless.", "Need gear? I've got gear."],
      buy: ["Fine choice.", "That'll serve ya well.", "Pleasure doin' business."],
      sell: ["Now that's a haul!", "I'll fry these up right away.", "Not bad, kid."],
      poor: ["Come back with more coin.", "Can't do credit, sorry."] } },
  { id: 'swamp', name: 'Mirefen Swamp', cost: 800, need: 5, accent: '#8aff7a', panel: '#13261c',
    tagline: 'Things with too many teeth live here.',
    keeper: { name: 'Madame Croak', title: 'Potions & Lures',
      hello: ["Ribbit... welcome, dearie.", "The bog provides. For a price.", "Mind the leeches."],
      buy: ["Hexcellent choice.", "Ribbit! Sold!", "May it never snag."],
      sell: ["Ooh, these will brew nicely.", "Slimy. Perfect.", "Ribbit ribbit, pay day!"],
      poor: ["Pockets as empty as a dry pond.", "Ribbit... no."] } },
  { id: 'glacier', name: 'Frostfang Glacier', cost: 5000, need: 5, accent: '#9af0ff', panel: '#102a3e',
    tagline: 'Under the aurora, the ice sings.',
    keeper: { name: 'Yuki', title: 'Frozen Goods',
      hello: ["Brrr! Welcome, small warm one.", "Ice is thick. Fish are thicker.", "Hug? No? Okay."],
      buy: ["Keep it frosty!", "Good gear for cold hands.", "YETI APPROVED."],
      sell: ["Fresh fish! Frozen fish!", "Yum. I mean, thank you.", "These are chilly. Nice."],
      poor: ["Not enough snowflakes. I mean coins.", "Come back richer, friend."] } },
  { id: 'crystal', name: 'Crystal Cavern', cost: 20000, need: 5, accent: '#d8a8ff', panel: '#1e1036',
    tagline: 'A lake that glows from the inside.',
    keeper: { name: 'Digby', title: 'Gems & Gadgets',
      hello: ["Oh! A visitor! Mind the stalactites.", "Dug this shop myself, y'know.", "Shiny things for shiny fish!"],
      buy: ["Ooh, sparkly choice!", "Polished it myself.", "That one's my favorite."],
      sell: ["Glittery! I'll take 'em!", "These'll look great on my wall.", "Gem-tastic haul."],
      poor: ["Need more coins, friend.", "Even moles can't dig up credit."] } },
  { id: 'abyss', name: 'Starfall Abyss', cost: 80000, need: 5, accent: '#ff9ae0', panel: '#160a2a',
    tagline: 'The edge of the world. The sky is the sea.',
    keeper: { name: 'The Stargazer', title: 'Celestial Wares',
      hello: ["...you have travelled far.", "The stars told me you'd come.", "Ask, and the void answers."],
      buy: ["It was always meant to be yours.", "The cosmos approves.", "Wield it well."],
      sell: ["Their light returns to the sky.", "A worthy offering.", "The void is pleased."],
      poor: ["The void accepts only coin.", "Not yet. Not yet."] } },
];

// zone = size of the green catch bar (0-1), reel = how fast you reel in,
// luck = better odds for rare fish
const RODS = [
  { id: 'twig',       name: 'Twig Rod',          lake: 'moonlit', price: 0,      zone: 0.20, reel: 1.00, luck: 0.00, c: ['#8a6a3a', '#6b4226', '#a07040', null],   desc: 'A stick with a string. Classic.' },
  { id: 'willow',     name: 'Willow Rod',        lake: 'moonlit', price: 250,    zone: 0.22, reel: 1.06, luck: 0.05, c: ['#c99a5e', '#8a6a3a', '#e8443a', null],   desc: 'Bendy and forgiving.' },
  { id: 'fiberglass', name: 'Fiberglass Rod',    lake: 'moonlit', price: 700,    zone: 0.24, reel: 1.12, luck: 0.10, c: ['#2a2a34', '#e8e8f0', '#e8443a', null],   desc: 'Modern and reliable.' },
  { id: 'bogwood',    name: 'Bogwood Rod',       lake: 'swamp',   price: 2200,   zone: 0.25, reel: 1.18, luck: 0.15, c: ['#3a2a18', '#4a6a2a', '#a8ff8a', null],   desc: 'Mossy, but it never breaks.' },
  { id: 'bonecaster', name: 'Bonecaster',        lake: 'swamp',   price: 4800,   zone: 0.26, reel: 1.24, luck: 0.20, c: ['#5a2a7a', '#f0e8d0', '#8aff7a', '#8aff7a'], desc: 'Carved from a gator\'s jaw.' },
  { id: 'frostbite',  name: 'Frostbite Rod',     lake: 'glacier', price: 9500,   zone: 0.27, reel: 1.30, luck: 0.25, c: ['#1a3a5a', '#a8e0f8', '#ffffff', null],   desc: 'Cold to the touch. Never warms up.' },
  { id: 'spire',      name: 'Glacier Spire',     lake: 'glacier', price: 19000,  zone: 0.28, reel: 1.36, luck: 0.30, c: ['#2a5a8a', '#e8f8ff', '#5affb0', '#9af0ff'], desc: 'Hums with aurora light.' },
  { id: 'amethyst',   name: 'Amethyst Rod',      lake: 'crystal', price: 36000,  zone: 0.29, reel: 1.42, luck: 0.38, c: ['#2a1448', '#9a4ae0', '#d8a8ff', '#d8a8ff'], desc: 'A single grown crystal.' },
  { id: 'prism',      name: 'Prism Rod',         lake: 'crystal', price: 72000,  zone: 0.30, reel: 1.48, luck: 0.45, c: ['#1a1a2a', 'rainbow', '#ffffff', '#ffffff'], desc: 'Splits moonlight into seven colors.' },
  { id: 'starcaller', name: 'Starcaller',        lake: 'abyss',   price: 145000, zone: 0.32, reel: 1.56, luck: 0.55, c: ['#1a0e36', '#ffcc33', '#ffffff', '#ffe680'], desc: 'Forged in a dying star.' },
  { id: 'trident',    name: 'Abyssal Trident',   lake: 'abyss',   price: 320000, zone: 0.34, reel: 1.65, luck: 0.70, c: ['#05020a', '#3a0a1e', '#ff2a5a', '#ff2a5a'], desc: 'The Devourer fears only this.' },
  { id: 'sporecaster',name: 'Sporecaster',       lake: 'secret',  price: 0,      zone: 0.26, reel: 1.25, luck: 0.30, c: ['#f0e8d0', '#c23a3a', '#ffffff', '#ff9ab0'], desc: 'A gift from the arcade\'s secret mushroom.', secret: true },
];

// bite = multiplier on waiting time (lower is faster), luck = rarer fish
const BAITS = [
  { id: 'worm',        name: 'Worm',         lake: 'moonlit', price: 0,     pack: 0,  bite: 1.00, luck: 0.00, col: '#e07a8a', desc: 'Free and endless.' },
  { id: 'cricket',     name: 'Cricket',      lake: 'moonlit', price: 40,    pack: 10, bite: 0.90, luck: 0.08, col: '#8a6a2a', desc: 'Trout and koi love these.' },
  { id: 'minnow',      name: 'Minnow',       lake: 'moonlit', price: 100,   pack: 10, bite: 0.85, luck: 0.15, col: '#c8e0f0', desc: 'Predators can\'t resist.' },
  { id: 'swamp_grub',  name: 'Swamp Grub',   lake: 'swamp',   price: 220,   pack: 10, bite: 0.85, luck: 0.12, col: '#d8d8a0', desc: 'Squishy. Eels go wild.' },
  { id: 'firefly',     name: 'Firefly',      lake: 'swamp',   price: 600,   pack: 10, bite: 0.80, luck: 0.25, col: '#c8ff6a', desc: 'Glows underwater.', glow: true },
  { id: 'ice_shrimp',  name: 'Ice Shrimp',   lake: 'glacier', price: 900,   pack: 10, bite: 0.80, luck: 0.20, col: '#ffb8c8', desc: 'Sweet and frozen.' },
  { id: 'snow_beetle', name: 'Snow Beetle',  lake: 'glacier', price: 2200,  pack: 10, bite: 0.75, luck: 0.30, col: '#f0f8ff', desc: 'Something ancient wants this.' },
  { id: 'glow_worm',   name: 'Glow Worm',    lake: 'crystal', price: 3200,  pack: 10, bite: 0.70, luck: 0.30, col: '#6afff0', desc: 'Cave fish see nothing else.', glow: true },
  { id: 'gem_fly',     name: 'Gem Fly',      lake: 'crystal', price: 8000,  pack: 10, bite: 0.70, luck: 0.40, col: '#d8a8ff', desc: 'Wings of pure amethyst.', glow: true },
  { id: 'star_krill',  name: 'Star Krill',   lake: 'abyss',   price: 13000, pack: 10, bite: 0.65, luck: 0.45, col: '#ffe680', desc: 'Tiny falling stars.', glow: true },
  { id: 'void_pearl',  name: 'Void Pearl',   lake: 'abyss',   price: 32000, pack: 10, bite: 0.60, luck: 0.60, col: '#8a5ae0', desc: 'A piece of nothing. Very tasty.', glow: true },
];
