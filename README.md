# Cnatt's Arcade

A menu page for all my games. Each game lives in its own folder:

| Folder     | Game               |
|------------|--------------------|
| `chess/`   | Dark Fantasy Chess |
| `mush/`    | MUSH               |
| `fishing/` | Fishing Simulator  |
| `dungeon/` | Nightfall Depths (data in `dungeon/js/data.js`) |
| `tag/`     | 2 Player Tag (arenas in `tag/js/arenas.js`) |

## Updating a game
1. On GitHub, open the game's folder (for example `mush/`).
2. Click **Add file → Upload files**.
3. Drag in the new files (the game's `index.html` plus its images, sounds, etc.).
4. Click **Commit changes**. The site updates in about a minute.

Files with the same name get replaced. Old files you no longer need can be deleted from the folder.
**Each game folder must have an `index.html`.** That's the page the menu opens.

## Adding a new game
1. Create a new folder (for example `tag/`) and upload the game into it.
2. Add a thumbnail image to `assets/` (16:9, like `thumb_fishing.png`).
3. Open `games.js` and copy one of the game blocks, then change the id, title, folder, thumbnail and description.

## Changing the menu text
The title, subtitle and footer are at the top of `games.js`.

## Fishing Simulator files
- `fishing/js/data.js`: lakes, rods and bait (prices and stats). Edit this to rebalance.
- `fishing/js/fishdata.js`: all 40 fish (value, difficulty, size, favorite bait).
- `fishing/js/audio.js`: the music and sound effects. They're generated live, so there are no sound files.
- `fishing/images/`: all the pixel art.
- Progress saves in the player's browser.

## Music & sounds on the menu
`assets/audio.js` plays the menu music and the click sounds. The ♪ MUSIC / SFX buttons mute them, and that setting is shared with the fishing game.

## Links
Every game has a direct link: `https://2playertag.com/#fishing`, `#mush`, `#chess`, `#tag`, `#dungeon`.
