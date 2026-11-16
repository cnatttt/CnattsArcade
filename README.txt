NIGHTFALL CHESS - browser version 5
===================================
One file: index.html (plus your music file). No build step, no libraries, no server of your own.

PUT IT ON 2playertag.com (GitHub Pages)
---------------------------------------
In the repo that already serves 2playertag.com:
  1. Make a folder called  chess
  2. Put index.html AND Dark_Fantasy.wav inside it (same folder, exact spelling - GitHub is case-sensitive)
  3. Commit and push. After a minute it is live at  https://2playertag.com/chess/
Music starts with the player's first click (browsers block sound before that) and loops.
GitHub refuses files over 100 MB; if the WAV is too big, export it as Dark_Fantasy.mp3 instead -
the game looks for the .mp3 automatically when there is no .wav.

ONLINE PLAY
-----------
Create game -> you get a 5-character code (like K7Q2M). Your friend picks Join game and types it.
The browsers find each other through the free public PeerJS meeting server, then talk directly.
If a school/office network blocks direct links, use "Trouble connecting? Swap long codes" in the
same screen, or add a TURN relay to EXTRA_ICE in the code (search index.html for EXTRA_ICE).

CLOCKS AND RATINGS
------------------
Two players, online and vs computer each let you pick: No clock, 10, 5, 2 or 1 minute per player.
Run out of time and you lose (unless the other side has nothing left to checkmate with: then it's a draw).
Online games are rated (Bullet = 1-2 min, Blitz = 5 min, Rapid = 10 min, untimed games separately).
Everyone starts at 1200. Ratings are saved in each player's own browser, so they're honour-system.

GAME REVIEW
-----------
After any game (computer, two players, online) press Review game. Every move is rated
(book, brilliant, great, best, excellent, good, inaccuracy, mistake, missed win, blunder) with an
explanation bubble and a spoken narrator. Arrow keys step back and forward; Space plays.

CONTROLS
--------
Click a piece then a glowing square. Drag = turn camera, wheel/pinch = zoom, WASD = roam,
V top view, F turn board, U undo, K kill-cam, T storm, M sound, N menu, Esc skips the victory scene.
Needs WebGL 2 (any recent Chrome, Edge, Firefox, Safari).
