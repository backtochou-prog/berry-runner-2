// BERRY RUNNER 2 regression test: the gameplay and technical polish pass (CHANGELOG_GAMEPLAY_POLISH.md).
//  1. MOBILE LAYOUT at the five reference screens (720 x 1280, 1080 x 1920, 1280 x 720, 1920 x 1080 and a narrow landscape phone): the 3D view fills the screen without stretching, the HUD
//     keeps its 16:9 shape inside the screen, every touch button is wholly on the screen and where a finger lands on it, the 'rotate' line shows only on an upright phone and covers nothing;
//     a turn of the phone refits everything.
//  2. THE AQUARIUM TUNNEL: on its two ramps the dark lines of the vault run on from one rib's slot to the next (they used to step like a staircase).
//  3. RACES: a race can be paused and resumed (keys, a lost focus), and the return to the road is clean (no input carried over, no hazard inside the fade).
//  4. INPUT: Q in the air on a vehicle is the spin stunt only; on foot it still steers.
//
// Run:  node tests/qa3d_polish.js     (needs playwright-core and a Chromium: CHROMIUM=/path/to/chrome, NODE_PATH or PW_CORE as for the other tests)
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright-core')); } catch (e) { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
const ROOT = path.join(__dirname, '..'), PORT = 8131;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const res = []; const T = (n, ok, i = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== '' ? '  [' + i + ']' : '')); };

(async () => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || require('./_chromium')(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (url, ctxOpts) => { const pg = await (await b.newContext(ctxOpts)).newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => m.type() === 'error' && pg.errs.push(m.text())); await pg.addInitScript(() => { window.__keepOver = true; }); await pg.goto(url, { timeout: 240000 }); await pg.waitForFunction(() => window.__wf, null, { timeout: 240000 }); await pg.waitForTimeout(500); return pg; };
  const BASE = 'http://localhost:' + PORT + '/';

  // ---------------------------------------------------------------- 1. the mobile layout
  const measure = () => {
    const g = __wf, R = id => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
    const W = innerWidth, H = innerHeight, sc = R('screen'), gl = R('gl'), k = sc.w / VW, out = { W, H, sc, gl, touchIn: g.touchIn, state: g.state };
    out.ratio = +(sc.w / sc.h).toFixed(3); out.hudInside = sc.l >= -0.5 && sc.t >= -0.5 && sc.l + sc.w <= W + 0.5 && sc.t + sc.h <= H + 0.5;
    out.glFills = Math.abs(gl.w - W) < 1 && Math.abs(gl.h - H) < 1; out.camAspect = +g.r.camera.aspect.toFixed(3); out.aspect = +(W / H).toFixed(3);
    const cv = document.getElementById('gl'); out.buffer = +(cv.width / cv.height).toFixed(3);                                  // the drawing buffer has the screen's shape: nothing is stretched
    const boxes = set => set.map(t => ({ id: t.id, l: sc.l + t.x * k, r: sc.l + (t.x + t.w) * k, t: sc.t + t.y * k, b: sc.t + (t.y + t.h) * k, w: t.w * k }));
    const on = bx => bx.every(q => q.l >= -0.5 && q.r <= W + 0.5 && q.t >= -0.5 && q.b <= H + 0.5);
    g.riding = false; const foot = boxes(g.touchSet()); out.footOn = on(foot); out.minBtn = +Math.min(...foot.filter(q => q.id !== 'pause' && q.id !== 'cam' && q.id !== 'scooter').map(q => q.w)).toFixed(1);
    g.riding = true; g.vehicle = 'scooter'; out.magOn = on(boxes(g.touchSet())) && (!g.touchSet().lcd || sc.l + (g.touchSet().lcd.x + g.touchSet().lcd.w) * k <= W + 0.5); g.vehicle = 'board'; out.rideOn = on(boxes(g.touchSet())); g.riding = false; g.vehicle = 'scooter';
    const tl = R('touch'); out.layerCovers = foot.every(q => q.l >= tl.l - 0.5 && q.r <= tl.l + tl.w + 0.5);                    // the smooth layer that draws them reaches every button
    const far = foot.find(q => q.id === 'left'); out.leftAt = [+far.l.toFixed(1), +far.r.toFixed(1)];
    const hint = document.getElementById('rotate'), hs = getComputedStyle(hint), hr = hint.getBoundingClientRect(); out.hint = hs.display !== 'none';
    out.hintClear = !out.hint || (hr.top >= sc.t + sc.h - 0.5 && hr.bottom <= H + 0.5 && hs.pointerEvents === 'none');          // under the HUD canvas (so under every button and every plate), and it takes no touches
    return out;
  };
  const SCREENS = [['720 x 1280 (upright)', 360, 640, 2], ['1080 x 1920 (upright)', 360, 640, 3], ['1280 x 720', 640, 360, 2], ['1920 x 1080', 640, 360, 3], ['narrow landscape phone (2532 x 1170)', 844, 390, 3]];
  let turn = null;
  for (const [name, w, h, dpr] of SCREENS) {
    const pg = await open(BASE, { viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    await pg.evaluate(() => { __wf.touch = true; __wf.start(); __wf.r.draw(__wf); });
    const M = await pg.evaluate(measure), up = h > w;
    T(name + ': the 3D view fills the screen unstretched, the HUD keeps 16:9 inside it, every touch button (on foot, scooter, board) is wholly on the screen', M.glFills && Math.abs(M.camAspect - M.aspect) < 0.01 && Math.abs(M.buffer - M.aspect) < 0.02 && Math.abs(M.ratio - 320 / 180) < 0.01 && M.hudInside && M.footOn && M.magOn && M.rideOn && M.layerCovers, JSON.stringify({ sc: [Math.round(M.sc.l), Math.round(M.sc.t), Math.round(M.sc.w), Math.round(M.sc.h)], touchIn: M.touchIn, left: M.leftAt, foot: M.footOn, mag: M.magOn, ride: M.rideOn, layer: M.layerCovers, cam: M.camAspect, buffer: M.buffer }));
    T(name + ': the rotate suggestion ' + (up ? 'shows under the HUD, over no control, taking no touches' : 'is not shown'), M.hint === up && M.hintClear, JSON.stringify({ hint: M.hint, clear: M.hintClear }));
    if (name === '1280 x 720') {                                    // a finger on the far left button, at the very edge of the screen, steers; then the phone is turned upright and back
      await pg.evaluate(() => { const g = __wf, sc = document.getElementById('screen').getBoundingClientRect(), t = g.touchSet().find(q => q.id === 'left'), k = sc.width / VW, x = Math.max(2, sc.left + (t.x + 3) * k), y = sc.top + (t.y + t.h / 2) * k;
        window.__tap = { x, y }; const ev = (type) => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); ev('pointerdown'); window.__held = g.tleft; ev('pointerup'); window.__rel = g.tleft; });
      const tap = await pg.evaluate(() => ({ held: window.__held, rel: window.__rel, x: +window.__tap.x.toFixed(1) }));
      T('a finger at the left edge of a 16:9 screen (x = ' + tap.x + ' px) presses LEFT, and lifting it releases', tap.held === true && tap.rel === false, JSON.stringify(tap));
      await pg.setViewportSize({ width: 360, height: 640 }); await pg.waitForTimeout(400); const P = await pg.evaluate(measure);
      await pg.setViewportSize({ width: 640, height: 360 }); await pg.waitForTimeout(400); const L2 = await pg.evaluate(measure);
      turn = { P: [P.hudInside, P.footOn, P.glFills, Math.abs(P.camAspect - P.aspect) < 0.01, P.hint], L: [L2.hudInside, L2.footOn, L2.glFills, Math.abs(L2.camAspect - L2.aspect) < 0.01, !L2.hint] };
    }
    T(name + ': no JS errors', pg.errs.length === 0, pg.errs.slice(0, 2).join('|'));
    await pg.context().close();
  }
  T('turning the phone upright and back refits the HUD, the buttons, the 3D view and the camera each time', !!turn && turn.P.every(Boolean) && turn.L.every(Boolean), JSON.stringify(turn));
  {                                                                 // a wide desktop window: room for the outer margin, so the layout is the designed one, untouched
    const pg = await open(BASE, { viewport: { width: 1280, height: 600 } });
    const D = await pg.evaluate(() => ({ touchIn: __wf.touchIn, same: __wf.touchSet() === TOUCH }));
    T('where the screen is wider than the HUD the designed button layout is used as it is', D.touchIn === 0 && D.same, JSON.stringify(D)); await pg.context().close();
  }

  // ---------------------------------------------------------------- 2. the aquarium tunnel's vault on the ramps
  {
    const pg = await open(BASE + '?zone=gateIslandSunset&seed=0', { viewport: { width: 480, height: 270 } });
    const A = await pg.evaluate(() => {
      const g = __wf, r = g.r, w = g.world; g.start(); g.keys.right = true;
      const off = () => { const t = w.tubeFork(g.p.z, 4000, 4000); return t ? g.p.z - t.fe : -1e9; };
      const until = d => { for (let i = 0; i < 20000 && g.state === 'play' && off() < d; i++) { if (i % 5 === 0) w.items = w.items.filter(it => it.kind === 'coin' || it.kind === 'prop'); g.advance(1 / 60); } };
      const probe = () => {                                           // the gaps between the vault lines of consecutive ribs: the far end of one slot's top line against the near end of the next one's
        r.draw(g); const ribs = r.props.aquaRib.filter(o => o.visible).sort((a, b) => b.position.z - a.position.z), gaps = [], tips = [];
        for (const o of ribs) { o.updateMatrixWorld(true); tips.push([new THREE.Vector3(0, 6.78, 6).applyMatrix4(o.matrixWorld), new THREE.Vector3(0, 6.78, -6).applyMatrix4(o.matrixWorld)]); }
        for (let i = 0; i + 1 < tips.length; i++) if (Math.abs(ribs[i].position.z - ribs[i + 1].position.z - 12) < 0.5) gaps.push(Math.abs(tips[i][1].y - tips[i + 1][0].y));
        return { ribs: ribs.length, maxGap: +Math.max(0, ...gaps).toFixed(3), pitch: +Math.max(...ribs.map(o => Math.abs(o.rotation.x))).toFixed(3), depth: +(w.seaDepth(g.p.z) * 0.1).toFixed(1), state: g.state };
      };
      const out = {}; until(1300); out.dive = probe(); until(4500); out.deep = probe(); until(7400); out.rise = probe(); return out;
    });
    T('the aquarium tunnel: on the dive and on the rise the ribs follow the slope and the dark lines of the vault run on from slot to slot (gaps under 6 cm; they were up to 0.8 m), and in the deep the ribs stand upright as before', A.dive.ribs >= 5 && A.rise.ribs >= 5 && A.dive.maxGap < 0.06 && A.rise.maxGap < 0.06 && A.dive.pitch > 0.02 && A.rise.pitch > 0.02 && A.deep.maxGap < 0.02 && A.deep.pitch < 0.005 && A.deep.state === 'play' && pg.errs.length === 0, JSON.stringify(A));
    await pg.context().close();
  }

  // ---------------------------------------------------------------- 3. races: pause / resume, and the return to the road
  {
    const pg = await open(BASE + '?zone=race&seed=0', { viewport: { width: 480, height: 270 } });
    const Rc = await pg.evaluate(() => {
      const g = __wf, r = g.r, out = {}, key = (code, k, down) => g.onKey({ code, key: k, repeat: false, preventDefault() {} }, down);
      g.start(); for (let i = 0; i < 5; i++) g.advance(1 / 60); out.entered = g.state; const R = g.race;
      for (let i = 0; i < 260; i++) g.advance(1 / 60); r.draw(g); const s0 = R.p.s, t0 = R.t; out.running = s0 > 5;
      key('KeyP', 'p', true); out.pausedBy = g.state; out.racePaused = g.racePaused; for (let i = 0; i < 120; i++) g.advance(1 / 60); r.draw(g); out.frozen = R.p.s === s0 && R.t === t0; out.stillRace = g.race === R;
      out.button = g.activeButton() === BTN.pause; key('KeyP', 'p', true); out.resumed = g.state; for (let i = 0; i < 30; i++) g.advance(1 / 60); out.movesAgain = R.p.s > s0;
      window.dispatchEvent(new Event('blur')); out.blur = g.state; g.mouse.x = BTN.pause.x + 4; g.mouse.y = BTN.pause.y + 4; out.tap = g.pressAt(g.mouse.x, g.mouse.y); out.afterTap = g.state;
      // the pause of the run still goes back to the run
      // the return: a finger still down, a queued lane change, a buffered jump and a hazard right ahead
      const z = g.p.z; g.world.items.push({ kind: 'barrier', x: g.p.x, z: z + 150, h: 0 }, { kind: 'barrier', x: g.p.x, z: z + 3000, h: 0 }, { kind: 'coin', x: g.p.x, z: z + 120, h: 8 });
      g.held[3] = 'jump'; g.syncTouch(); g.laneQ = 2; g.jumpBuf = 0.1; g.p.vx = 300; R.result = 'win'; const coins = g.coins; g.endRace();
      out.back = { state: g.state, race: g.race, held: Object.keys(g.held).length, laneQ: g.laneQ, jumpBuf: g.jumpBuf, vx: g.p.vx, jy: g.p.jy, bonus: g.coins - coins, fade: g.fadeIn > 0,
        nearGone: !g.world.items.some(it => it.kind === 'barrier' && it.z > z && it.z < z + 400), farKept: g.world.items.some(it => it.kind === 'barrier' && it.z === z + 3000), coinKept: g.world.items.some(it => it.kind === 'coin' && it.z === z + 120) };
      for (let i = 0; i < 90 && g.state === 'play'; i++) g.advance(1 / 60); r.draw(g); out.alive = g.state; out.grounded = g.p.jy === 0;
      key('Escape', 'Escape', true); out.runPause = g.state; key('Escape', 'Escape', true); out.runResume = g.state;
      return out;
    });
    T('a race can be paused and resumed: P stops it (nothing moves, the race is kept, the PAUSED button is offered), P goes back INTO the race; a lost focus pauses it too and a tap on RESUME returns to it', Rc.entered === 'race' && Rc.running && Rc.pausedBy === 'pause' && Rc.racePaused && Rc.frozen && Rc.stillRace && Rc.button && Rc.resumed === 'race' && Rc.movesAgain && Rc.blur === 'pause' && Rc.tap === 'resume' && Rc.afterTap === 'race', JSON.stringify({ entered: Rc.entered, pausedBy: Rc.pausedBy, frozen: Rc.frozen, resumed: Rc.resumed, moves: Rc.movesAgain, blur: Rc.blur, tap: Rc.tap, after: Rc.afterTap }));
    T('back on the road after a race: the bonus is paid, no input is carried over (no held button, no queued lane, no buffered jump, no drift), the hazards inside the fade are gone, the far ones and the coins stay, and the run goes on', Rc.back.state === 'play' && Rc.back.race === null && Rc.back.held === 0 && Rc.back.laneQ === 0 && Rc.back.jumpBuf === 0 && Rc.back.vx === 0 && Rc.back.jy === 0 && Rc.back.bonus === 30 && Rc.back.fade && Rc.back.nearGone && Rc.back.farKept && Rc.back.coinKept && Rc.alive === 'play' && Rc.grounded, JSON.stringify(Rc.back));
    T('the run still pauses and resumes as before (Esc, Esc)', Rc.runPause === 'pause' && Rc.runResume === 'play' && pg.errs.length === 0, JSON.stringify({ p: Rc.runPause, r: Rc.runResume, errs: pg.errs.slice(0, 1) }));

    // ---------------------------------------------------------------- 4. one press, one action: Q
    const Q = await pg.evaluate(() => {
      const g = __wf, key = (code, k, down) => g.onKey({ code, key: k, repeat: false, preventDefault() {} }, down), out = {};
      g.state = 'play'; g.keys = {}; g.riding = false; g.p.jy = 0; key('KeyQ', 'q', true); out.footLeft = !!g.keys.left; key('KeyQ', 'q', false);
      g.keys = {}; g.riding = true; g.vehicle = 'scooter'; g.trick = null; g.p.jy = 30; g.p.vy = 100; key('KeyQ', 'q', true); out.airLeft = !!g.keys.left; out.airSpin = !!(g.trick && g.trick.kind === 'spin'); key('KeyQ', 'q', false);
      g.keys = {}; g.trick = null; key('KeyA', 'q', true); out.azertyLeft = !!g.keys.left; out.azertySpin = !!g.trick; key('KeyA', 'q', false);      // the key labelled Q on an AZERTY keyboard: the steering key, never the stunt
      g.keys = {}; g.trick = null; key('KeyQ', 'a', true); out.azertyA = !!(g.trick && g.trick.kind === 'spin') && !g.keys.left; key('KeyQ', 'a', false);
      g.riding = false; g.trick = null; g.p.jy = 0; g.p.vy = 0; g.keys = {};
      return out;
    });
    T('Q: on foot it steers left (as before); in the air on a vehicle it is the SPIN stunt only, and no longer steers as well; on an AZERTY keyboard the Q key steers and the A key spins, never both', Q.footLeft && !Q.airLeft && Q.airSpin && Q.azertyLeft && !Q.azertySpin && Q.azertyA, JSON.stringify(Q));
    await pg.context().close();
  }
  console.log('\n' + res.filter(Boolean).length + '/' + res.length + ' passed');
  await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(1); });
