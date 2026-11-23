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

## Not done yet (in the order I would do it)

1. **In-run HUD in the new style.** Distance, coins, zone plate, missions and the race HUD still use the 320 x 180 pixel font. Needs a small always-updating smooth layer and new HUD tests.
2. **Settings screen.** There is only a sound on/off button. Wanted: music and effects volume, the colour boost switch, a quality cap, control hints.
3. **First-load weight.** About 16 MB of scripts (embedded pictures) load before the title screen. The loading screen makes the wait visible; the fix is to load the race, kart and far-zone art on demand.
4. **Environments.** The zones were not changed in this stage: no new landmarks, weather or zone-specific obstacles were added.
5. **Audio.** No new sounds this stage. Candidates: footsteps tied to the run cycle, per-zone ambience, a sound for the buffered slide and the stumble.
6. **Difficulty curve.** Speed still ramps from 220 to 340 units/s in about 75 s and then stays flat. Obstacle density per zone was not retuned.
7. **Character moments not yet animated:** win and lose poses for races, a collect reaction, vehicle stunt poses beyond the vehicle turning.
8. **Hurdle height.** Still 0.68 m (hit box unchanged). Lowering it also changes the terrace, bicycle and canal-boat obstacles that share the box.
9. **Performance on real hardware.** Frame rate was never measured on a phone or a headset; the test machine renders in software.
10. **Real devices.** Nothing was verified on a physical phone or Quest: install, fullscreen and rotation, touch feel, blur cost, VR comfort.

## How to run and test

- Play: serve the folder (`python3 -m http.server 8080`) and open `http://localhost:8080/` (3D) or `/2d.html`.
- Tests: `NODE_PATH=<dir with playwright> PW_CORE=playwright node tests/<suite>.js`, one suite at a time (they time out on page load when the machine is busy).
- Deploy: push `kart-preview` and fast-forward `main` (`git push origin kart-preview && git push origin kart-preview:main`). Vercel deploys `main`, GitHub Pages deploys `kart-preview`.
