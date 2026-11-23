# Berry Runner 2: sequel roadmap

Where the sequel stands against the master directive: what is done and tested, what is not, and the order to continue in. Kept honest on purpose: nothing below is marked done unless it is implemented in the game and covered by a test that ran.

## Architecture (audited, kept)

Build-free Three.js / Canvas 2D, plain script tags in dependency order, no package manager.

| Responsibility | Where |
|---|---|
| Game state, input, physics, scoring, modes | `src/game.js` (states: title, play, pause, over, scene, race) |
| Track and world generation | `src/track.js` (data), `src/world.js` (pieces, forks, items) |
| Race and kart rules | `src/race.js` |
| Power-ups, missions, near misses, combos | `src/perks.js` |
| Audio (music crossfades, beat clock, synthesised effects) | `src/audio.js` |
| 2D renderer, HUD, menus | `src/render.js`, `src/sprites.js` |
| 3D renderer and camera | `src3d/renderer3d.js` |
| Characters (rig, animation) | `src3d/berry3d.js` (Berry + the shared rig), `src3d/zagla3d.js`, `src3d/runner_sprite.js` (vehicles) |
| Objects | `src3d/items3d.js`, `src3d/perks3d.js`, `src3d/fx3d.js` |
| Zones | `src3d/env_*.js` |
| Race / kart scenes | `src3d/race3d.js`, `src3d/pod_car.js`, `src3d/kart3d.js`, `src3d/hover_vehicle.js` |
| VR | `src3d/xr3d.js`, `xr_input.js`, `xr_hud.js`, `xr_comfort.js` |
| Web app | `manifest.webmanifest`, `sw.js`, `src/pwa.js` |

No restructuring was needed to do the work below; none was done for its own sake.

## Done (implemented and tested)

**Characters**
- Berry rebuilt as a rigged 3D body from the character sheet and animation blueprint: idle, run, three-phase jump, land, crouch, turn, vehicle stances, trip, menu showcase, spring follow-through.
- Zagla rebuilt on the same rig; the pod car rebuilt as a 3D model.
- New this stage: **sprint** (during the dash), **stumble** (when the aura takes a hit), **cheer** (mission, waymark, clean sequence).

**Controls and feel**
- Jump buffer (already there), and new **slide buffer**: a slide asked for in the air happens on landing.
- **Hit-stop** on a crash; the camera **dips on landing**; the dash already opened the field of view.
- One press, one action for Q (AZERTY and QWERTY).
- Races can be paused; the return from a race is clean.

**Presentation**
- Berry Runner 2 branding, Fredoka font, glass menus with the round icon, a map of the zones behind the title menu with tap-to-start, richer colours.
- **Loading screen** with a progress bar while the scripts arrive.
- The low barrier redrawn as a see-through hurdle; the gate, the magnet, the shard and the waymark redrawn.
- The aquarium tunnel's vault follows its ramps.

**Mobile and web app**
- Touch buttons stay on screen, safe areas, refit on every screen change, rotate hint, tap twice for fullscreen and landscape, installable PWA that starts offline.

**Repairs**
- The kart circuit crash after the Zagla rebuild (seated driver).
- Berry's missing stretch on the beat.
- The stale distance in the town test (the lap got longer; the game was right).

**Stage 2 (HUD, settings, sound, loading, air)**
- The run's and the race's HUD lettered in the game's font at the screen's resolution (`Renderer.flushHud`), plates in the theme.
- A settings card (gear on the title and pause screens): music, sound effects, rich colours, 3D resolution; saved on the device.
- MENU on the pause and game-over cards: back to the title screen without reloading the page.
- Zone ambience under the music (surf, deep sea, canal water, leaves, neon hum).
- The kart circuit's art (5 MB of the 16 MB) loads after the title screen.
- The air of the zones (`src3d/air3d.js`): fireflies in the forest, dust in the ruins, petals over the market and terraces, glints in the neon streets.
- Swipe up to jump and down to slide on touch screens.

## Not done yet (in the order I would do it)

1. **First-load weight, the rest.** About 10.7 MB still loads before the title screen. Next candidates to load on demand: `canyon_assets` (0.9 MB), `race_assets` (0.7 MB), the far zones' art.
2. **Environments.** Beyond the air particles, the zones are as they were: no new landmarks, no weather on the coast or the canals, no new zone-specific obstacles.
3. **Difficulty curve.** Speed still ramps from 220 to 340 units/s in about 75 s and then stays flat; obstacle density per zone was not retuned. Tests pin the 340 cap, so this needs a deliberate design decision.
4. **Character moments not yet animated:** a collect reaction, win and lose poses, stunt poses on vehicles.
5. **Audio.** No new one-shot sounds (a stumble grunt, a cheer); no positional audio.
6. **The settings screen** has four switches; no volume sliders, no control remapping, no language choice.
7. **Hurdle height.** Still 0.68 m (hit box unchanged). Lowering it also changes the terrace, bicycle and canal-boat obstacles that share the box.
8. **The 2D game** keeps its pixel HUD and has no settings, MENU buttons or map (by choice: it is the classic version).
9. **Performance on real hardware.** Frame rate was never measured on a phone or a headset; the test machine renders in software. The HUD layer, the glass blur and the colour filter are the three things to measure first.
10. **Real devices.** Nothing was verified on a physical phone or Quest: install, fullscreen and rotation, touch and swipe feel, VR comfort.

## How to run and test

- Play: serve the folder (`python3 -m http.server 8080`) and open `http://localhost:8080/` (3D) or `/2d.html`.
- Tests: `NODE_PATH=<dir with playwright> PW_CORE=playwright node tests/<suite>.js`, one suite at a time (they time out on page load when the machine is busy).
- Deploy: push `kart-preview` and fast-forward `main` (`git push origin kart-preview && git push origin kart-preview:main`). Vercel deploys `main`, GitHub Pages deploys `kart-preview`.
