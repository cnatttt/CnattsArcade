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

// ---------------------------------------------------------------- WEATHER
// luck = extra rare-fish chance, bite = multiplier on waiting time
const WEATHER = {
  clear:    { name: 'Clear',          icon: '*', col: '#e8e4ff', luck: 0,    bite: 1.0,  desc: 'Calm waters.' },
  rain:     { name: 'Rain',           icon: '/', col: '#8ab8ff', luck: 0.15, bite: 0.85, desc: 'Fish bite faster in the rain.' },
  storm:    { name: 'Thunderstorm',   icon: '!', col: '#ffe650', luck: 0.35, bite: 0.8,  desc: 'Rare fish come up in storms!' },
  fog:      { name: 'Fog',            icon: '~', col: '#c8d8c8', luck: 0.2,  bite: 1.0,  desc: 'Strange things swim in the fog.' },
  blizzard: { name: 'Blizzard',       icon: '#', col: '#ffffff', luck: 0.35, bite: 0.9,  desc: 'Ice-loving fish go wild.' },
  bloom:    { name: 'Crystal Bloom',  icon: '+', col: '#d8a8ff', luck: 0.4,  bite: 0.85, desc: 'The crystals glow. Fish are drawn to the light.' },
  meteors:  { name: 'Meteor Shower',  icon: '>', col: '#ffb070', luck: 0.5,  bite: 0.85, desc: 'Falling stars wake the deep ones.' },
  frenzy:   { name: 'Feeding Frenzy', icon: '$', col: '#ffcc33', luck: 0.1,  bite: 0.4,  desc: 'Everything is biting!' },
};
const LAKE_WEATHER = {
  moonlit: ['clear', 'clear', 'rain', 'storm', 'fog', 'frenzy'],
  swamp:   ['clear', 'fog', 'fog', 'rain', 'storm', 'frenzy'],
  glacier: ['clear', 'clear', 'blizzard', 'blizzard', 'fog', 'frenzy'],
  crystal: ['clear', 'clear', 'bloom', 'bloom', 'fog', 'frenzy'],
  abyss:   ['clear', 'meteors', 'meteors', 'storm', 'fog', 'frenzy'],
};

// ---------------------------------------------------------------- JUNK & TREASURE (hooked now and then)
const JUNK = [
  { id: 'boot',    name: 'Old Boot',       value: 2,  w: 30, desc: 'Somebody is walking around with one sock wet.' },
  { id: 'can',     name: 'Rusty Can',      value: 1,  w: 30, desc: 'Please recycle.' },
  { id: 'seaweed', name: 'Seaweed',        value: 1,  w: 25, desc: 'Slimy. Smells like the ocean.' },
  { id: 'bottle',  name: 'Message Bottle', value: 25, w: 10, desc: 'The note inside says: "the secret is a mushroom".' },
  { id: 'chest',   name: 'Treasure Chest', value: 0,  w: 7,  desc: 'Full of coins and bait!', chest: true },
];

// ---------------------------------------------------------------- COSMETICS
const HATS = [
  { id: 'cap',    name: 'Fishing Cap',    price: 0 },
  { id: 'straw',  name: 'Straw Hat',      price: 300 },
  { id: 'beanie', name: 'Beanie',         price: 900 },
  { id: 'cat',    name: 'Cat Ears',       price: 2500 },
  { id: 'pirate', name: 'Pirate Hat',     price: 6000 },
  { id: 'wizard', name: 'Wizard Hat',     price: 15000 },
  { id: 'viking', name: 'Viking Helmet',  price: 35000 },
  { id: 'crown',  name: 'Golden Crown',   price: 90000 },
  { id: 'halo',   name: 'Halo',           price: 250000 },
  { id: 'shroom', name: 'Mushroom Cap',   price: 0, secret: true },
];
const BOBBERS = [
  { id: 'classic', name: 'Classic',  price: 0,     pal: { o: '#1a1420', r: '#e8443a', R: '#ff9a88', w: '#f2f0e8', W: '#ffffff' } },
  { id: 'lime',    name: 'Lime',     price: 400,   pal: { o: '#1a1420', r: '#6ae03a', R: '#c8ff9a', w: '#f2f0e8', W: '#ffffff' } },
  { id: 'duck',    name: 'Duckie',   price: 1500,  pal: { o: '#3a2a08', r: '#ffd84a', R: '#fff3a8', w: '#ffd84a', W: '#ff8a2a' }, duck: true },
  { id: 'night',   name: 'Midnight', price: 5000,  pal: { o: '#000000', r: '#3a2a6a', R: '#8a6ae0', w: '#1a1430', W: '#c46cff' } },
  { id: 'gold',    name: 'Gold',     price: 20000, pal: { o: '#5a3a0e', r: '#f2c14e', R: '#fff3c4', w: '#c08a20', W: '#ffe680' }, glow: '#ffe680' },
  { id: 'star',    name: 'Starlight',price: 60000, pal: { o: '#1a0e36', r: '#ff9ae0', R: '#ffffff', w: '#8ab8ff', W: '#ffffff' }, glow: '#ff9ae0' },
];

// ---------------------------------------------------------------- AWARDS
const AWARDS = [
  { id: 'first',     name: 'First Bite',        desc: 'Catch your first fish',               reward: 20 },
  { id: 'ten',       name: 'Getting Hooked',    desc: 'Catch 10 fish',                        reward: 50 },
  { id: 'hundred',   name: 'Angler',            desc: 'Catch 100 fish',                       reward: 1000 },
  { id: 'fivehund',  name: 'Master Angler',     desc: 'Catch 500 fish',                       reward: 10000 },
  { id: 'rare',      name: 'Ooh, Shiny',        desc: 'Catch a Rare fish',                    reward: 100 },
  { id: 'legend',    name: 'Living Legend',     desc: 'Catch a Legendary fish',               reward: 500 },
  { id: 'mythic',    name: 'Myth Buster',       desc: 'Catch a Mythic fish',                  reward: 2000 },
  { id: 'perfect',   name: 'Flawless',          desc: 'Make a perfect catch',                 reward: 50 },
  { id: 'perfect10', name: 'Surgeon',           desc: 'Make 10 perfect catches',              reward: 800 },
  { id: 'streak5',   name: 'On Fire',           desc: 'Catch 5 fish in a row',                reward: 150 },
  { id: 'streak15',  name: 'Unstoppable',       desc: 'Catch 15 fish in a row',               reward: 2500 },
  { id: 'complete1', name: 'Lake Expert',       desc: 'Catch all 8 species in one lake',      reward: 500 },
  { id: 'dex40',     name: 'Fishdex Complete',  desc: 'Discover all 40 fish',                 reward: 50000 },
  { id: 'travel',    name: 'Explorer',          desc: 'Unlock a new lake',                    reward: 200 },
  { id: 'allLakes',  name: 'World Traveler',    desc: 'Unlock all 5 lakes',                   reward: 20000 },
  { id: 'rich',      name: 'Pocket Money',      desc: 'Have 10,000 coins',                    reward: 500 },
  { id: 'tycoon',    name: 'Fish Tycoon',       desc: 'Have 250,000 coins',                   reward: 10000 },
  { id: 'treasure',  name: 'Treasure Hunter',   desc: 'Fish up a treasure chest',             reward: 300 },
  { id: 'junk',      name: 'One Man\'s Trash',  desc: 'Fish up an old boot',                  reward: 25 },
  { id: 'storm',     name: 'Storm Chaser',      desc: 'Catch a fish during a storm',          reward: 300 },
  { id: 'fashion',   name: 'Fashionista',       desc: 'Buy a hat or bobber',                  reward: 100 },
  { id: 'jobs5',     name: 'Hard Worker',       desc: 'Finish 5 shop jobs',                   reward: 1000 },
  { id: 'giant',     name: 'Giant!',            desc: 'Catch a fish over 2 meters',           reward: 1500 },
  { id: 'devourer',  name: 'Star Eater Eater',  desc: 'Catch The Devourer',                   reward: 100000 },
];
