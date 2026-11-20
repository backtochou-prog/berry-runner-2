# Berry Runner 2: complete project documentation

Single-file version of the nine audit documents: README.md, ARCHITECTURE.md, CONTROLS_AND_GAMEPLAY.md, BERRY_AVATAR.md, ASSETS_AND_LICENSES.md, DEPLOYMENT_AND_PWA.md, TESTING.md, KNOWN_ISSUES.md, FILE_MAP.md.

---

# Berry Runner 2: project package

Source of the Berry Runner 2 web game (an endless runner in Three.js / Canvas 2D, installable as a web app). Copied from the public repository https://github.com/backtochou-prog/berry-runner-2 (branch `kart-preview`, commit d6374a8). The `.git` history is not included.

## Contents
- `index.html`: the 3D game entry page (the default). `2d.html`: the classic 2D version. `vehicle.html`, `3d.html`: tools / redirect.
- `src/`: game logic and 2D rendering (`game.js`, `world.js`, `track.js`, `render.js`, `sprites.js`, `audio.js`, `pwa.js`).
- `src3d/`: the 3D scene, environments, vehicles, avatar (`berry3d.js`, `runner_sprite.js`), VR (`xr3d.js`), and generated art/asset files.
- `assets/`: music tracks. `icons/`, `manifest.webmanifest`, `sw.js`: web-app install files.
- `vendor/three.min.js`: the Three.js library (bundled, no npm install needed).
- `tests/`: browser test scripts (Node + Playwright). `tools/`: preview and asset tools.
- `docs/`: screenshots, reference sheets for Berry (`docs/berry/`), and the audit documents.
- `*.md` at the top level: the Quest 2 VR audit and phase reports from earlier work.

## Run it
1. Serve the folder over HTTP (service workers and audio need it, not `file://`):
   `python3 -m http.server 8080`
2. Open http://localhost:8080/ . The 2D version is at `/2d.html`.
3. Desktop: arrow keys / A-D to steer, Up / W / Space to jump, Down / S to slide.
4. Tests (need Node, Playwright and a Chromium): `NODE_PATH=<dir with playwright> PW_CORE=playwright node tests/qa3d_avatar.js`.

Nothing needs installing to play. There is no build step and no `package.json`.

See the other documents in this package for the architecture, controls, testing, deployment, and known issues.

---

# Architecture

Two front ends share one game model:
- **Game model (`src/game.js`, `src/world.js`, `src/track.js`, `src/race.js`):** state machine (title, play, over, pause, scene, race), the runner's physics (jump, slide, lanes, vehicles), the track as data, scoring and power-ups.
- **2D renderer (`src/render.js`, `src/sprites.js`):** draws the game onto a 320x180 pixel canvas (`#screen`), scaled up with nearest-neighbour filtering. Touch buttons are drawn on a separate canvas (`#touch`).
- **3D renderer (`src3d/renderer3d.js`):** Three.js scene built from modules: `kit.js` (shared geometry helpers and units), `road3d.js`, `env_*.js` (districts: city, forest, market, neon quarter, art city, coast, tram, canyon, etc.), `items3d.js`, `perks3d.js`, `fx3d.js`, `portal3d.js`, `car3d.js` / `race3d.js` / `kart3d.js` (racing zones), `hover_vehicle.js`.
- **Avatar:** `RunnerBerry` in `src3d/berry3d.js` (the current character), with `RunnerZagla` in `src3d/zagla3d.js` as the second character. `runner_sprite.js` is the shared base class that also holds the vehicles (scooter, e-bike, board, surfboard).
- **VR:** `src3d/xr3d.js`, `xr_input.js`, `xr_hud.js`, `xr_comfort.js` (WebXR for Meta Quest).
- **Entry points:** `src3d/main3d.js` (3D game, selected by `index.html`), `src/main.js` (2D game, `2d.html`).
- **Web app:** `manifest.webmanifest`, `sw.js` (cache: network-first for scripts and pages, cache-first for music and images), `src/pwa.js` (service worker registration and INSTALL APP button).

Script load order matters: the HTML loads scripts with plain tags in dependency order, so a new file must be added to `index.html` (and to `sw.js` only if it is not named in the page, since the worker reads the script list from the page).

Global objects are used on purpose (`Kit`, `RunnerBerry`, `BERRY_RIG`, `window.__wf` = the running game, used by the tests).

---

# Controls and gameplay

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Steer left / right | Left / Right, A / D | the two arrow buttons |
| Jump | Up, W, Space | jump button |
| Slide (duck under gates) | Down, S | slide button |
| Get on / off the scooter | E | the scooter indicator |
| Camera | C | camera button |
| Pause | Esc / P | pause button |

Gamepads and VR controllers are supported in the 3D build (see `src3d/xr_input.js`).

## Gameplay
- Endless run through districts. Collect coins, avoid barriers, gates and vortexes.
- A **jump** clears low obstacles; a **slide** passes under overhead gates (the gap is about 1.05 m). A press just before landing is kept briefly.
- **Vehicles:** the magnetic scooter, sport e-bike, electromagnetic board and surfboard change the handling and the look. Ride them where the game offers them.
- **Stunts** (spin, flip, ollie) earn points and a combo; a bad landing loses the combo.
- **Vortexes** replace crates in some zones: a crash there shows the runner being absorbed.
- **Zones:** city, forest, market, neon quarter, art city, coast and island, tram street, canyon, and a kart circuit with its own rules. Some zones join through Stargate-style portals.
- Music changes by zone (main, coast, race, kart tracks) and drives the animation's beat.

---

# The Berry avatar

The player character is **Berry**, a strawberry-headed runner, rebuilt from the user's character sheet and animation blueprint (kept in `docs/berry/`).

## What is in the code
- `src3d/berry3d.js`: `RunnerBerry`. A procedural rigged 3D body built from `Kit` parts (about 12 800 triangles, no model file). The bones follow the blueprint: Root > Hips > Spine_01 > Spine_02 > Spine_03 > Neck > Head; Shoulder > Arm > Forearm > Hand; Leg > Calf > Foot.
- `BERRY_RIG` (top of `berry3d.js`): joint limits (head yaw 60 / pitch 40 / roll 20 degrees; shoulder 90; elbow 0-150; hip 60; knee 0-150; ankle 45), timings, and the run lean (17 degrees).
- `choose()` picks the animation for each frame: idle, run, takeoff, air, fall, land, crouch, turn, the vehicle stances, trip, and the menu showcase (idle, wave, spin, dance, run in place). `apply()` poses the bones and sets the hips so the lower foot stays on the ground.
- Follow-through springs: hood, bag, drawstrings, charms, leaves.
- `src/sprites.js`: the 2D pixel version (`PHEAD`, `PTORSO`) of the same character.
- `src3d/berry_assets.js`: the front view of the sheet, embedded for the kart identity panel.
- `tools/berry_preview.html?view=turn|poses|live`: shows the model alone.

## Design choices to know
- The crouch is a forward fold (top at 0.98 m), not the upright squat of the blueprint, so Berry fits under the 1.05 m gates.
- The model is a shaded low-poly interpretation of the sheet, without textures or normal maps.

## Tests
`tests/qa3d_avatar.js` checks the skeleton, size and ground contact, the run lean and foot contact, the jump phases, the landing, the crouch height, turns, the vehicle stances, the crash, joint limits, and the 2D sprite colours. It passed 15/15 on the last run.

---

# Assets and licences

## Where the assets are
- `assets/`: four music tracks (`music.mp3`, `music_coast.mp3`, `music_race.mp3`, `music_kart.mp3`). They are the author's own tracks.
- `src3d/*_assets.js`, `src/*_assets.js`, `src/*_art.js` and `src/scooter_art.js`: embedded images (base64 data URIs) so the game also runs from `file://`. These are large (the largest are 0.5-0.7 MB each).
- `docs/`: screenshots, reference pictures and sheets, downloadable videos and music exports (about 73 MB). Not needed to run the game.
- `docs/berry/`: the character sheet and animation blueprint used for Berry.
- `vendor/three.min.js`: Three.js, bundled. Check its licence file upstream (MIT).

## Notes for an audit
- The art and music are the author's own material (pictures, sheets, recordings). Confirm the rights to anything reused from elsewhere before publishing.
- Font and sound effects are generated in code (`src/font.js`, `src/audio.js`).
- Some embedded pictures were cut from user-supplied images; they are kept as-is by design.

---

# Deployment and the web app

## Hosting
The repository is published with GitHub Pages from the `kart-preview` branch, folder `/`: https://backtochou-prog.github.io/berry-runner-2/ . A `.nojekyll` file tells Pages to serve every file as-is. There is no build step.

## Install on a phone
- **Android (Chrome):** open the link in a normal (not private) tab, then tap **INSTALL APP** on the title screen, or the browser menu → **Add to Home screen**.
- **iPhone (Safari):** Share → **Add to Home Screen**.
- Installed, it runs fullscreen and landscape with the Berry icon.

## How the web app works
- `manifest.webmanifest`: name, icons (`icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`), display mode, colours.
- `sw.js`: the service worker. On install it caches the page, every script named in `index.html`, the icons and the music. Scripts and pages are network-first; music and images are cache-first. Change the `VERSION` string to drop old caches.
- `src/pwa.js`: registers the worker and shows the install button (the browser's dialog on Chrome, a Share-menu hint on iPhone).
- `index.html`: the manifest link, Apple meta tags, and the theme colour.

## Troubleshooting
- "This app cannot be installed": the phone has an old copy cached. Refresh twice, or clear the site's data in Chrome's site settings.
- Incognito tabs and in-app browsers cannot install web apps.
- Installation needs HTTPS: GitHub Pages provides it.

---

# Testing

The tests are browser scripts in `tests/`, written for Node with Playwright (`playwright-core`) and a Chromium. They start a local HTTP server and drive the real game through `window.__wf`.

## Run
    NODE_PATH=<dir with playwright> PW_CORE=playwright node tests/qa3d_avatar.js

Set `CHROMIUM=/path/to/chrome` to choose the browser. The launch flags use SwiftShader (software WebGL), so runs are slow on machines without a GPU and can hit the default timeouts if the machine is busy.

## Suites
- `qa3d_avatar.js`: Berry (see BERRY_AVATAR.md). Last result: 15/15 passed.
- `qa3d_zagla.js`, `qa3d_scooter.js`, `qa3d_vortex.js`, `qa3d_ui.js`, `qa3d_race.js`, `qa3d_kartvr.js`, `qa3d_xr.js`, and others: earlier regression tests for their features. These were NOT re-run after the avatar change. On the last attempt, several of them timed out loading the page while the machine was busy; re-run them on a quiet machine.
- `race_sim.js`, `scan_objects.js`: simulation and object scanners.

## Manual checks still needed
- Install on a real Android phone and an iPhone.
- Play on a phone in landscape with touch controls.
- Meta Quest 2 (VR) build.

---

# Known issues and open items

1. **Old copies on phones:** a phone can keep the old page cached and show the old avatar or refuse to install. See DEPLOYMENT_AND_PWA.md.
2. **Regression suites not re-run** after the Berry change: Zagla, scooter, vortex, UI, race and VR suites (see TESTING.md).
3. **Crouch differs from the sheet:** a forward fold instead of an upright squat (see BERRY_AVATAR.md).
4. **Berry has no textures:** the model is shaded low-poly, not the painted look of the sheet.
5. **Package size:** the project is about 114 MB without `.git` (about 73 MB of it is `docs/`). It fits in one archive; split it if an upload limit is hit.
6. **The kart circuit** keeps some features switched off in code with flags (`Kart3D.CONTROL_ROOM`, `WELD_FLOOR`, `SPIRAL_FLAT`, `REACTOR`) and some unfinished items recorded in comments. Some of its earlier notes refer to the name "Calagtic".
7. **Old names remain in comments and docs:** "Wayfarer" and "Captain Strawberry" appear in older comments and in some README sections. The title and the game name now say Berry Runner 2.
8. **Build-free and unminified:** about 16 MB of JavaScript loads on the first visit; the service worker caches it afterwards.
9. **Git:** the `.git` history is not in this package.

---

# File map

Top level
- `index.html`: 3D game entry (default). `2d.html`: 2D game. `vehicle.html`: vehicle test page. `3d.html`: redirect.
- `manifest.webmanifest`, `sw.js`, `icons/`, `.nojekyll`, `vercel.json` (headers only), `style.css`, `README.md`.
- `QUEST2_VR_*.md`: VR audit and phase reports (earlier work).

`src/` (game model and 2D)
- `game.js` state machine; `world.js`, `track.js`, `biomes.js` track and world data; `race.js` racing rules; `perks.js` power-ups; `render.js` 2D drawing; `sprites.js` pixel sprites (Berry 2D); `font.js` font; `audio.js` music and effects; `pwa.js` install.
- `main.js` 2D entry; `*_art.js`, `*_assets.js` embedded pictures.

`src3d/` (3D)
- `main3d.js` 3D entry; `renderer3d.js` scene; `kit.js` geometry; `road3d.js` road.
- Avatar: `berry3d.js` (Berry), `berry_assets.js`, `runner_sprite.js` (base + vehicles), `zagla3d.js` and `zagla_assets.js` (Zagla).
- Environments: `env_city.js`, `env_forest.js`, `env_market.js`, `env_terrace.js`, `env_neon.js`, `env_artcity.js`, `env_canyon.js`, `env_coast.js`, `env_aqua.js`, `env_town.js`, `env_ruins.js`, `env_tram.js`, `env_gare.js`, `env_utrecht.js`, `env_vic.js`.
- Objects and effects: `items3d.js`, `perks3d.js`, `fx3d.js`, `portal3d.js`, `vortex_art.js`, `signs3d.js`, `crowd3d.js`, `train3d.js`, `car3d.js`, `race3d.js`, `kart3d.js`, `hover_vehicle.js`, `saucer3d.js`.
- Music beats: `music_beats*.js`.
- VR: `xr3d.js`, `xr_input.js`, `xr_hud.js`, `xr_comfort.js`.

`tests/` browser tests (see TESTING.md). `tools/` preview pages and asset generators (Python and JS). `docs/` pictures, sheets and downloads. `assets/` music. `vendor/` Three.js.

---
