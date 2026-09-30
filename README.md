# NULL SECTOR

**A fast, horror-tinged first-person shooter that runs in your web browser.**

400 metres under Oxfordshire sits an abandoned data vault. Something woke up in it. Fight down through **10 procedurally generated sectors**: cold machine halls overrun by the Glitchborn, the **Undercroft**'s stone catacombs full of the dead and the things that eat them, and at the bottom **the Pit**, where the damned are still being punished. Waiting in the last hall is **THE WARDEN**.

No installs, no downloads and no game engine. Everything is built in JavaScript with Three.js (WebGL): the textures, sounds and levels are all generated in code while the game runs.

![The Undercroft](docs/undercroft.jpg)

| | |
|---|---|
| ![The OBLIVION BFG](docs/bfg.jpg) | ![The Archivist boss](docs/vault.jpg) |
| ![The Pit: a prisoner shackled to the wall](docs/pit.jpg) | ![The final boss, THE WARDEN](docs/warden.jpg) |

---

## Contents
- [Quick start](#quick-start)
- [Full installation guide](#full-installation-guide)
  - [Windows](#windows) · [macOS](#macos) · [Linux](#linux)
  - [No Node.js? Other ways to run it](#no-nodejs-other-ways-to-run-it)
- [How to play](#how-to-play)
- [Controls](#controls)
- [Settings](#settings)
- [Weapons](#weapons)
- [Enemies](#enemies)
- [Tips](#tips)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Credits and licence](#credits-and-licence)

---

## Quick start

You need **[Node.js](https://nodejs.org/) 18 or newer** and a modern browser (Chrome, Edge, Firefox or Safari).

```bash
git clone https://github.com/hosthobbit/null-sector.git
cd null-sector
npm start
```

Then open **http://localhost:8420** in your browser and click **ENTER THE VAULT**.

You don't need `npm install`. The game has no dependencies to download, because Three.js is already included in the `vendor/` folder.

---

## Full installation guide

### Step 1: Install Node.js

Node.js runs a tiny web server on your own computer so the browser can load the game. (Browsers block games like this if you just double-click `index.html`.)

1. Go to **https://nodejs.org/**.
2. Download the **LTS** version and install it with the default options.
3. Check it worked by opening a terminal (see the notes for your system below) and typing:
   ```bash
   node --version
   ```
   A version number such as `v22.x.x` should appear.

### Step 2: Download the game

**Option A: with Git** (recommended, easy to update later):
```bash
git clone https://github.com/hosthobbit/null-sector.git
```

**Option B: without Git:**
1. On the GitHub page, click the green **Code** button, then **Download ZIP**.
2. Unzip it anywhere, for example your Desktop. You'll get a folder called `null-sector-main`.

### Step 3: Start it

#### Windows
1. Open the game folder in File Explorer.
2. Click the address bar, type `cmd` and press **Enter**. A Command Prompt opens in that folder.
3. Type:
   ```
   node server.js
   ```
4. Leave that window open. Open your browser and go to **http://localhost:8420**.

#### macOS
1. Open **Terminal** (Cmd+Space, type *Terminal*).
2. Type `cd `, with a space after it, then drag the game folder onto the Terminal window and press **Enter**.
3. Type:
   ```bash
   node server.js
   ```
4. Open **http://localhost:8420** in Safari or Chrome.

#### Linux
```bash
cd null-sector
./play.sh
```
`play.sh` starts the server if it isn't already running and opens the game in your default browser. You can also run `node server.js` and open http://localhost:8420 yourself.

*Optional desktop launcher* (so it shows up in your applications menu):
```bash
cat > ~/.local/share/applications/null-sector.desktop <<EOF
[Desktop Entry]
Name=NULL SECTOR
Comment=First-person horror shooter
Exec=$PWD/play.sh
Terminal=false
Type=Application
Categories=Game;
EOF
```

### Step 4: Play
Click **ENTER THE VAULT**. The game captures your mouse; press **Esc** to get it back.

To stop the server afterwards, go back to the terminal and press **Ctrl+C**.

### Using a different port
If port 8420 is already in use:
```bash
node server.js 9000
```
Then open http://localhost:9000.

### No Node.js? Other ways to run it
The game is just static files, so any local web server works. From inside the game folder:

| You have | Command | Then open |
|---|---|---|
| Python 3 | `python3 -m http.server 8420` (Windows: `py -m http.server 8420`) | http://localhost:8420 |
| PHP | `php -S localhost:8420` | http://localhost:8420 |
| VS Code | Install the **Live Server** extension, right-click `index.html`, then **Open with Live Server** | (opens itself) |

You can also upload the whole folder to any web host, or turn on **GitHub Pages** for a fork (Settings, then Pages, then *Deploy from branch*, `main`, `/ (root)`). It works from any sub-folder.

---

## How to play

- **Goal:** get through all **10 sectors** and kill **THE WARDEN** at the bottom. Each sector is sealed: **kill every enemy** to open the **exit portal**, then walk into it to descend.
- **Sectors are generated fresh every run**, and every one is darker, bloodier and nastier than the last.

| Sector | Where | What's waiting |
|---|---|---|
| 1 | The Vault | Steel halls and server racks, the machine Glitchborn |
| 2 | The Undercroft | Stone catacombs: corpses, hanging bodies, cages, skulls, candles, blood on the walls |
| 3 | The Vault | Boss: **THE ARCHIVIST** |
| 4 | The Undercroft | Deeper, darker, more of the dead |
| 5 | The Vault | The rot has reached the vault: bodies strung up among the servers |
| 6 | The Undercroft | Boss: **THE HOLLOW KING** |
| 7 – 8 | **The Pit** | Hellish red caverns, embers, braziers. People shackled to the walls, still struggling. Bodies on stakes, caged gibbets, everything that crawled up from below. |
| 9 | The Pit | Boss: **THE HOLLOW KING** returns |
| 10 | **The Warden's Hall** | The final boss: **THE WARDEN** |

- **It gets scarier as you go down:** thicker, redder fog; lights that stutter and die; more bodies, blood and writing on the walls; a colour grade that drains and reddens the picture, and in the last sectors a vignette that pulses like a heartbeat.
- **Listen:** the dark is full of distant sounds that get closer and more frequent as you descend: moans, chains, iron doors, screams, howling, sobbing, whips and the cries that follow them, and down in the Pit, whispers right by your ear. (All synthesised live; no audio files.)
- **Pickups** are glowing, spinning crystals: **red** for health (+25), **cyan** for shield (+35), **orange** for ammo. Weapon pickups announce themselves when you grab them. Green **OBLIVION cells** (BFG ammo) are rare.
- **Score:** chain kills within 3 seconds to build a **combo multiplier up to x6**. Getting hit resets it. Clearing a sector quickly earns a time bonus. Your **best score is saved** in your browser.
- **Death:** when your Integrity hits 0 the run ends. Start again and the sectors are all new.
- **Victory:** kill the Warden and you've escaped. Your final score, time and accuracy are shown, and your best score is saved.

The **minimap** (top left) turns with you (you're the white arrow) and shows **every enemy and every power-up** in the sector: anything out of view is pinned to the edge in the direction it lies. Press **M** for a full-screen map of the whole sector. The legend under the minimap explains the markers: red dots are enemies, a big yellow dot is a boss, diamonds are pickups in their colours (red health, cyan shield, orange ammo, green BFG cell, white-rimmed weapons), and the green circle is the exit portal once it's open.

---

## Controls

| Key | Action |
|---|---|
| **W A S D** | Move |
| **Mouse** | Look |
| **Left click** | Fire (hold for automatic weapons, hold to charge the BFG) |
| **Shift** | Sprint |
| **Space** | Jump |
| **Q** | Phase dash: short burst of speed with brief invulnerability |
| **R** | Reload |
| **1 – 6** or **mouse wheel** | Change weapon |
| **M** | Full-screen sector map (press again to close) |
| **F** | Show or hide the FPS counter |
| **Esc** | Pause menu: Resume, Settings, Abandon run |

---

## Settings

Press **Esc**, then **SETTINGS** (also on the title screen). Changes apply straight away and are remembered. **RESET TO DEFAULTS** puts everything back.

| Setting | What it does |
|---|---|
| **Mouse sensitivity** | How fast the view turns (0.05–2, default 0.5). Lower it if aiming feels twitchy. |
| **Invert Y** | Flip vertical look |
| **Field of view** | 60–110°. A wider FOV shows more but makes enemies look smaller. |
| **Brightness** | 60–200% (default 130%). Raise it if the deeper sectors are too dark on your screen. |
| **Volume** | Master volume for music and effects |
| **Graphics quality** | **High**: shadows, bloom and full resolution. **Medium / Low** for older laptops. |
| **Show FPS** | Frame-rate counter |
| **Blood & gore** | Turns off blood, gibs and gore decorations |

The game also lowers its resolution by itself if the frame rate drops.

---

## Weapons

| # | Weapon | Found | What it's for |
|---|---|---|---|
| 1 | **Pulse Carbine** | Start | Reliable automatic rifle. Hold to fire. |
| 2 | **Scatter Cannon** | Sector 1 | Close-range shotgun blast. Devastating up close. |
| 3 | **Ripper** | Sector 2 | Minigun. Spins up, then shreds everything in front of you. |
| 4 | **Arc Launcher** | Sector 2 | Explosive energy grenades with splash damage. Good for groups. |
| 5 | **Rail Lance** | Sector 3 | Pierces **every** enemy in a straight line. Line them up. |
| 6 | **OBLIVION BFG** | Sector 2 | **Hold to charge, release to fire.** One shot kills **everything** within 60 m that can see the blast or you, and everything within 12 m even through walls. Very little ammo; save it for a boss or an emergency. |

Each new weapon appears as a glowing pickup somewhere in the sector where it unlocks. Once you have a weapon, you keep it for the rest of the run.

---

## Enemies

### Machines (the Vault)
| Enemy | Behaviour |
|---|---|
| **Skitter** | Small, fast, comes in swarms. Weak on its own. |
| **Sentinel** | Keeps its distance and fires energy bolts. |
| **Colossus** | Big and slow, soaks up damage and hits very hard. |
| **THE ARCHIVIST** (boss) | Fires volleys of bolts and summons Skitters. |

### Monsters (the Undercroft and the Pit)
| Enemy | Behaviour |
|---|---|
| **Ghoul** | Sprints at you and lunges. Usually in packs. |
| **Crawler** | Drags itself along the floor. Low and easy to miss, so look down. |
| **Butcher** | Horned brute. Charges and slams. Sidestep the charge. |
| **Wraith** | Floats above the ground and lobs arcing acid. |
| **THE HOLLOW KING** (boss) | Towering, and keeps raising Ghouls. Kill the adds or save the BFG for him. |

### The final boss
**THE WARDEN** is a flayed giant jailer with an iron-spiked crown, four arms, a hooked flail and a burning heart in an open ribcage. He drags his chained prisoners behind him. He fights in three phases:

| Phase | Health | What he does |
|---|---|---|
| 1 | 100–66% | Stalks you, slams the ground up close, and hurls fans of hellfire |
| 2 | 66–33% | Adds **rings of fire rolling along the floor** (jump over them) and summons Ghouls and Wraiths |
| 3 | under 33% | **Enraged:** faster, charges at you, bigger volleys, summons Butchers |

The BFG can't erase him in one shot: each blast takes a third of his health. The arena is stocked with ammo, health and shield, and ammo keeps appearing while he's alive.

Monsters bleed, leave corpses where they fall, and burst into gibs from explosions and big hits.

---

## Tips
- **Keep moving.** Strafing (A/D) dodges most projectiles.
- **Q (phase dash)** makes you briefly invulnerable, so dash *through* a Butcher's charge or an acid volley.
- **Line enemies up for the Rail Lance** in corridors.
- **Use the Arc Launcher and Scatter on packs of Ghouls and Skitters.**
- **Don't get hit** if you're chasing a high score: the x6 combo is worth more than anything else.
- **Save the BFG.** Charge it before you round the corner into the boss room.
- **Against the Warden:** keep your distance from the slam, jump the fire rings, clear the summoned monsters before they surround you, and bring BFG cells: three blasts will finish him.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **Black screen or "Failed to load module"** when opening `index.html` directly | Browsers block modules from `file://` pages. Start the server (`node server.js`) and use **http://localhost:8420**. |
| **`node` is not recognised** | Node.js isn't installed or the terminal was open before you installed it. Install from nodejs.org, then open a **new** terminal. |
| **"EADDRINUSE" / port already in use** | The game is already running (just open the address) or something else uses the port. Try `node server.js 9000`. |
| **Too dark to see** | Esc, then Settings, then turn **Brightness** up. Press **M** to check the full map. |
| **Low frame rate** | Esc, then Settings, then Graphics quality **Medium** or **Low**. Close other heavy tabs. On laptops, plug in the charger and make sure the browser uses the dedicated GPU. |
| **Mouse turns too fast or too slow** | Esc, then Settings, then **Mouse sensitivity**. |
| **Mouse won't lock or the view won't turn** | Click inside the game window. Some browsers need one click after Esc before they'll lock the mouse again. |
| **No sound** | Browsers only allow audio after you click. Click **ENTER THE VAULT**, check the Volume setting and that the tab isn't muted. |
| **Music keeps playing in the background** | The game pauses its audio when the tab is hidden or closed. If you still hear it, another copy is open in some other browser window; close that. |
| **"WebGL not supported"** | Update your browser and graphics drivers. In Chrome, check `chrome://gpu` shows WebGL as *Hardware accelerated*. |
| **Blood too much?** | Esc, then Settings, then turn off **Blood & gore**. |
| **Reset settings and best score** | Open the browser console (F12) on the game page and run `localStorage.clear()`. |

---

## How it works

For the curious:

- **Rendering:** [Three.js](https://threejs.org/) r186 (WebGL 2) with physically based materials, image-based lighting (RoomEnvironment PMREM), real-time shadows and ACES filmic tone mapping.
- **Post-processing:** an EffectComposer chain (scene pass, separate weapon view-model pass so the gun never clips into walls, Unreal bloom, then a custom final shader for chromatic aberration, vignette, film grain and damage flashes).
- **Procedural everything:** textures (colour, normal and roughness maps for metal, stone, flagstone and skin), sound (Web Audio synthesis for all effects and music), and levels (grid-based room-and-corridor generator, with decoration passes for the Undercroft).
- **AI:** a breadth-first flow field from the player lets every enemy find a path through the level cheaply. Each enemy type has its own attack behaviour.
- **Performance:** adaptive resolution scaling, and caps on corpses, decals and particles.
- **No build step:** plain ES modules loaded through an import map. Edit a file, refresh the browser.

## Project layout

```
null-sector/
├── index.html        HUD, menus, settings panel, import map
├── server.js         Tiny zero-dependency static web server (port 8420)
├── play.sh           Linux/macOS launcher: starts server + opens browser
├── package.json      `npm start` shortcut
├── src/
│   ├── main.js       Game loop, weapons firing, BFG, scoring, sectors, settings
│   ├── level.js      Procedural level generator, themes, lighting
│   ├── horror.js     Undercroft decoration: bodies, cages, chains, candles, writing
│   ├── enemies.js    Enemy models, AI and animations
│   ├── weapons.js    Weapon stats and first-person view-models
│   ├── projectiles.js  Bolts, grenades, acid, BFG orb
│   ├── pickups.js    Health, shield, ammo, weapon pickups
│   ├── effects.js    Particles, blood, gibs, decals
│   ├── textures.js   Procedural texture generation
│   ├── audio.js      Synthesised sound effects and music
│   ├── player.js     Movement, jumping, dash
│   └── physics.js    Collision against the level grid
├── vendor/three/     Three.js r186 (only the files the game uses, MIT licence)
└── docs/             Screenshots for this README
```

## Credits and licence

Made by **[Host Hobbit Ltd](https://hosthobbit.com)**.

- Game code: **MIT licence**, see [LICENSE](LICENSE). Fork it, mod it or learn from it.
- Three.js © three.js authors, MIT licence (see `vendor/three/LICENSE`).
