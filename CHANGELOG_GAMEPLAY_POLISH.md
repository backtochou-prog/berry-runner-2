# Gameplay and technical polish pass

Scope: mobile presentation, the underwater tunnel's rendering, the transitions between gameplay modes, input consistency, and per-frame costs. No art was changed: no model, texture, material, colour, light, sound, icon or layout design was redrawn or replaced. Every change is a calculation, a timing or a state rule.

## 1. Mobile experience

| What was wrong | Change | Files |
|---|---|---|
| **The two outer touch buttons were partly off the screen** wherever the HUD takes the whole width: a 16:9 phone in fullscreen, and any phone held upright. They are designed to stand 15 HUD pixels outside the HUD canvas, toward the edges of a wide phone; with no margin there, a third of LEFT and of JUMP was cut off (about 30 px of a 92 px button at 1280 x 720). | `Game.fit()` measures the free margin beside the HUD and `Game.touchSet()` moves the left group in, and the right group in, by exactly what is missing (0 on a wide phone: the designed layout is then used untouched). Drawing and hit-testing both read `touchSet()`, so the picture and the finger agree. | `src/game.js`, `src/render.js` |
| **Notches and rounded corners were ignored**: the HUD was fitted to the whole window. | The HUD is fitted inside the safe area (`env(safe-area-inset-*)`, read through a hidden probe in `Game.insets()`), and the page's body is padded by the same insets so the HUD is centred in what is left. The 3D view still fills the whole screen. | `src/game.js`, `index.html` |
| **The layout could stay stale** after the browser's bars slid away, after entering or leaving fullscreen, after a slow orientation change, or when the page came back from the back/forward cache. | The HUD, the touch layer and the 3D view are refitted on `visualViewport` resize, `fullscreenchange`, `pageshow`, and twice after `orientationchange` (200 ms and 600 ms). | `src/game.js` |
| **No orientation suggestion in the 3D game** (the 2D page had one). | The 2D page's own line, "ROTATE YOUR PHONE FOR A BIGGER VIEW", is shown on an upright touch phone, placed just under the HUD canvas, with `pointer-events: none`. It covers no button and no plate. | `index.html`, `src/game.js` |
| **Fullscreen was only asked for on the first START.** A player who left fullscreen stayed windowed for every later run. | A tap on RETRY asks again, like START. It is always the result of a tap, never automatic, and a refusal is ignored as before. | `src/game.js` |

Not changed: an upright phone still shows the 16:9 HUD as a band across the middle with the 3D view filling the screen behind it. That is aspect-ratio preservation, not a defect; the HUD is never stretched.

## 2. Underwater tunnel: the radial dark lines

**Origin.** The lines are intentional: each rib of the aquarium tunnel carries seven thin dark lines that run 12 m along the vault to the next rib (`src3d/env_aqua.js`, "thin dark lines running along its vault"). They converge on the vanishing point, so they read as radial lines.

**Confirmed defect.** Scenery props were only ever turned about the vertical axis, never tipped. On the tunnel's two ramps (13 m down over 300 m, and back up) each slot's lines therefore lay level, and the vault broke into a staircase of loose dark bars, up to 0.8 m apart at each rib. That is what made the lines look like an artefact on the way down and on the way up.

**Fix.** A rib is now tipped to the slope of its own slot and set at the mean height of its two ends (`Renderer3D.place()` returns the placed object; the rib branch in the scenery loop sets its pitch). The lines of one slot end where the next ones begin: gaps under 6 cm on both ramps, measured by the new test. In the deep, level part the ribs stand exactly as before.

**Ruled out:** z-fighting (the lines sit 12 cm inside the rib radius), flipped normals, transparency sorting, shadows (the game casts none), camera clipping. The geometry, the colours, the fog and the sea life are untouched.

File: `src3d/renderer3d.js`.

## 3. Gameplay mode transitions

| What was wrong | Change | Files |
|---|---|---|
| **A race could not be paused.** P, Esc and the pause button did nothing in a race, and a lost focus (a call, another tab) let the race run on and the robot win. | `Game.pause()` / `Game.resume()` are now the one way in and out of a pause. A pause remembers what it interrupted (`resumeTo`) and resume returns to it: the run, or the race. P / Esc, the pause button, a lost focus, a hidden page and the VR controllers all use them. A paused race keeps its scene, its HUD and its music under the usual PAUSED panel. | `src/game.js`, `src/render.js`, `src/audio.js`, `src3d/renderer3d.js`, `src3d/xr3d.js`, `src3d/xr_input.js` |
| **Returning from a race carried the race's input into the run** and dropped the player into hazards hidden by the fade. A finger still on the accelerator is the jump button on the road; a queued lane change and a buffered jump survived. | `Game.endRace()` releases held touches, clears the lane queue, the jump buffer, sideways speed, any jump or slide in progress, and removes the hazards of the first stretch of road (the part crossed while the screen fades back in). Coins and everything further away stay. | `src/game.js` |

In VR a race keeps its own rule (the headset holds the race, `race.hold`): that was left as it was.

Race rules, lengths, speeds and balance are unchanged.

## 4. Input

| What was wrong | Change | Files |
|---|---|---|
| **Q did two things at once on a vehicle.** Q steers left by its letter and is also the SPIN stunt, so a spin also pulled the vehicle left. On an AZERTY keyboard the key labelled Q (the steering key) also fired the stunt. | In the air on a vehicle, Q is the stunt only. The AZERTY steering key no longer triggers the stunt; its A key (the physical Q position) does. On foot, Q still steers left. | `src/game.js` |

Audited and left alone, because they behave correctly: the jump buffer (0.12 s, a press just before landing still jumps), the slide (a press in the air is a fast fall), frame-rate independence (the simulation runs in slices of at most 1/60 s), the 60 fps cap on 120 Hz screens.

## 5. Performance

- **Berry's animation allocated memory every frame** (six small arrays, one object and four closures per frame). The joint angles are now written into arrays created once, and the pose helpers are methods bound once. Same motion, no garbage. `src3d/berry3d.js`.
- **The touch layer rebuilt the list of held buttons eight times a frame**; it is read once. `src/render.js`.

Not done: no scenery, polygon count, texture or effect was reduced. Frame rate on real phones was not measured in this pass (see "Not verified").

## 5b. Two corrections to the earlier avatar change, found by the full regression run

- **Berry no longer stretched on the beat of the music** (it only lifted). Every runner stretches a little on the beat (5 % in the menu, 2 % in the run); the Berry body had dropped it. Restored in `RunnerBerry.update()`. `src3d/berry3d.js`. This is a regression fix, not a new animation.
- `tests/qa3d_zagla.js` still expected the default avatar's class to be named `RunnerSprite`; it is `RunnerBerry` since the avatar was replaced. The expectation was updated to the real class name; nothing else in that test was touched.

## 6. Tests

New: `tests/qa3d_polish.js` covers the five reference screens (720 x 1280, 1080 x 1920, 1280 x 720, 1920 x 1080, a 2532 x 1170 landscape phone), an orientation change, the tunnel's vault on both ramps, race pause and resume, the return from a race, and the Q key.

Run a suite: `NODE_PATH=<dir with playwright> PW_CORE=playwright node tests/<name>.js`

Full run, one suite at a time, on the changed game:

| Suite | Before this pass | After |
|---|---|---|
| qa3d_audio | not completed (page-load timeout on a busy machine) | 32/32 (31/32 before the beat-stretch correction above) |
| qa3d_avatar | 15/15 | 15/15 |
| qa3d_coastzone | 10/10 | 10/10 |
| qa3d_coins | 10/10 | 10/10 |
| qa3d_controls | 7/7 | 7/7 |
| qa3d_dest | 18/18 | 18/18 |
| qa3d_gare | not completed (timeout) | 17/17 |
| qa3d_honour | 6/6 | 6/6 |
| qa3d_kartvr | 6/6 | 6/6 |
| qa3d_perf | 5/5 | 5/5 |
| qa3d_perks | not completed (timeout) | 29/29 |
| qa3d_polish (new) | - | 23/23 |
| qa3d_portal | 21/21 | 21/21 |
| qa3d_quay | 17/17 | 17/17 |
| qa3d_race | not completed (timeout) | 14/14 |
| qa3d_scooter | 20/20 | 20/20 |
| qa3d_town | 33/34 | 33/34 (the same check fails: see below) |
| qa3d_ui | 12/12 | 12/12 |
| qa3d_utrecht | 12/12 | 12/12 |
| qa3d_vic | 19/19 | 19/19 |
| qa3d_vortex | 13/13 | 13/13 |
| qa3d_world | 44/44 | 44/44 |
| qa3d_xr | 33/33 | 33/33 |
| qa3d_zagla | 17/18 (the stale class name) | 18/18 |
| race_portal | 18/18 | 18/18 |
| race_sim | all passed | all passed |

**Existing failure, not caused by this pass and not fixed by it:** `qa3d_town`, "the beach zone is the coast, then a junction to the island in the same light". It fails identically before and after; it checks the order of the track's pieces around the coast (`src/track.js`, `src/world.js`), which this pass does not touch.

The four "not completed" entries in the "before" column are page-load timeouts while another job was using the machine, so there is no before/after comparison for those four suites; all four pass after.

## Not verified

- Real devices: notch insets, the browser's bars, fullscreen and orientation lock, PWA launch, touch feel. Everything here was checked in an emulated Chromium.
- A Meta Quest headset: the WebXR code paths were only run in the emulated tests.
- Frame rate on a phone GPU: the test machine renders in software.
