// =============================================================
//  GAME LIST  -  edit this file to change what's on the menu.
//
//  Each game lives in its own folder (chess/, mush/, fishing/, tag/).
//  To UPDATE a game: drag its new files into that folder on GitHub.
//  To ADD a game: make a new folder with an index.html inside,
//  then copy one of the blocks below and change the details.
// =============================================================

const SITE = {
  title: "CNATT'S ARCADE",
  subtitle: "Pick a game",
  footer: "Made by Cnatt"
};

const GAMES = [
  {
    id: "chess",                         // used in links: yoursite.com/#chess
    title: "Nightfall Chess",
    folder: "chess",                     // folder that holds the game's index.html
    thumbnail: "assets/thumb_chess.png",
    tag: "2 Player",
    description: "3D chess under the moon. Pieces fight and explode when they capture.",
    accent: "#b07cff"
  },
  {
    id: "mush",
    title: "MUSH",
    folder: "mush",
    thumbnail: "assets/thumb_mush.png",
    tag: "Clicker",
    description: "Grow your mushroom empire. Open card packs and hunt for holo rares.",
    accent: "#ff6a7a"
  },
  {
    id: "fishing",
    title: "Fishing Simulator",
    folder: "fishing",
    thumbnail: "assets/thumb_fishing.png",
    tag: "Simulator",
    description: "5 magical lakes, 40 fish, 12 rods. Can you catch The Devourer?",
    accent: "#6ad0ff"
  },
  {
    id: "tag",
    title: "2 Player Tag",
    folder: "tag",
    thumbnail: "assets/thumb_tag.png",
    tag: "2 Player",
    description: "Runner vs tagger on one keyboard. Survive 20 seconds to score. First to 10 wins.",
    accent: "#ffd400"
  }
];
