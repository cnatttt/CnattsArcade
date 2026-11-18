// =============================================================
//  GAME LIST  -  edit this file to change what's on the menu.
//
//  Each game lives in its own folder (chess/, mush/, fishing/, tag/).
//  To UPDATE a game: drag its new files into that folder on GitHub.
//  To ADD a game: make a new folder with an index.html inside,
//  then copy one of the blocks below and change the details.
//
//  players: shown as a badge.  online: true adds an ONLINE badge.
//  isNew: true adds a NEW badge and puts it in the big banner.
//  cats: which filter buttons the game shows up under.
// =============================================================

const SITE = {
  title: "CNATT'S ARCADE",
  subtitle: "Pick a game",
  tagline: "Free browser games: racing, survival, party games and more. Play solo, with a friend, or online.",
  footer: "Made by Cnatt"
};

const GAMES = [
  {
    id: "soccer",
    title: "Rocket Soccer",
    folder: "soccer",
    thumbnail: "assets/thumb_soccer.png",
    tag: "Sports",
    description: "Car soccer with boost and flips. 1v1 or 2v2 against the CPU, a friend, or online.",
    players: "1-2", online: true, isNew: true, cats: ["2 Player", "Online", "Sports", "Action"],
    accent: "#3b82f6"
  },
  {
    id: "snake",
    title: "Snake Arena",
    folder: "snake",
    thumbnail: "assets/thumb_snake.png",
    tag: "Arena",
    description: "Eat, grow and cut off rivals in a huge arena. Play the bots or host an online room for 8.",
    players: "1-8", online: true, isNew: true, cats: ["Online", "Action"],
    accent: "#22d3ee"
  },
  {
    id: "ski",
    title: "Powder Peak",
    folder: "ski",
    thumbnail: "assets/thumb_ski.png",
    tag: "3D Sports",
    description: "3D freeride skiing and snowboarding. Hit kickers and rails, spin, flip and grab, then land clean.",
    players: "1", isNew: true, cats: ["Sports", "Action"],
    accent: "#7dd3fc"
  },
  {
    id: "party",
    title: "Party Clash",
    folder: "party",
    thumbnail: "assets/thumb_party.png",
    tag: "2 Player",
    description: "7 two-player mini-games: same keyboard, vs computer, or online with a room code.",
    players: "1-2", online: true, isNew: true, cats: ["2 Player", "Online", "Party"],
    accent: "#ff4a6a"
  },
  {
    id: "kart",
    title: "Turbo Karts",
    folder: "kart",
    thumbnail: "assets/thumb_kart.png",
    tag: "3D Racing",
    description: "3D kart racing with online multiplayer, split screen, drifting, items and a Grand Prix.",
    players: "1-2", online: true, isNew: true, cats: ["2 Player", "Online", "Racing", "Action"],
    accent: "#ffb01a"
  },
  {
    id: "horde",
    title: "Nightfall Horde",
    folder: "zombies",
    thumbnail: "assets/thumb_horde.png",
    tag: "Survival",
    description: "Survive 30 zombie waves. Pick 1 of 3 upgrades after each wave and fight 1,000+ zombies.",
    players: "1", isNew: true, cats: ["Action"],
    accent: "#8aff6a"
  },
  {
    id: "siege",
    title: "Nightfall Siege",
    folder: "siege",
    thumbnail: "assets/thumb_siege.png",
    tag: "Tower Defense",
    description: "Build 7 towers, hold 5 maps against monster waves and giant bosses.",
    players: "1", cats: ["Strategy"],
    accent: "#ff8a3a"
  },
  {
    id: "dungeon",
    title: "Nightfall Depths",
    folder: "dungeon",
    thumbnail: "assets/thumb_dungeon.png",
    tag: "Roguelike",
    description: "Fight down 5 cursed floors, collect 32 relics and slay the Void Lord. Every run is different.",
    players: "1", cats: ["Action", "Strategy"],
    accent: "#e8c060"
  },
  {
    id: "chess",                         // used in links: yoursite.com/#chess
    title: "Nightfall Chess",
    folder: "chess",                     // folder that holds the game's index.html
    thumbnail: "assets/thumb_chess.png",
    tag: "2 Player",
    description: "3D chess under the moon. Pieces fight and explode when they capture.",
    players: "1-2", cats: ["2 Player", "Strategy"],
    accent: "#b07cff"
  },
  {
    id: "mush",
    title: "MUSH",
    folder: "mush",
    thumbnail: "assets/thumb_mush.png",
    tag: "Clicker",
    description: "Grow your mushroom empire. Open card packs and hunt for holo rares.",
    players: "1", cats: ["Chill"],
    accent: "#ff6a7a"
  },
  {
    id: "fishing",
    title: "Fishing Simulator",
    folder: "fishing",
    thumbnail: "assets/thumb_fishing.png",
    tag: "Simulator",
    description: "5 magical lakes, 40 fish, weather, jobs, an aquarium and hats. Can you catch The Devourer?",
    players: "1", cats: ["Chill"],
    accent: "#6ad0ff"
  },
  {
    id: "tag",
    title: "2 Player Tag",
    folder: "tag",
    thumbnail: "assets/thumb_tag.png",
    tag: "2 Player",
    description: "4 modes, 5 arenas, dashes and power-ups. Same keyboard, vs CPU, online, or climb the ranked ladder.",
    players: "1-2", online: true, cats: ["2 Player", "Online", "Action", "Party"],
    accent: "#ffd400"
  }
];
