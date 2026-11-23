// BERRY RUNNER 2 regression test: the sequel's gameplay-feel stage. The buffered slide (asked for in the air, done on landing), the crash's hit-stop, the camera's dip on landing, Berry's
// sprint, stumble and cheer, the loading screen, the HUD in high resolution, the settings, the zone ambience and the kart art loaded after the title screen.
//
// Run:  node tests/qa3d_sequel.js     (needs playwright-core and a Chromium: CHROMIUM=/path/to/chrome, NODE_PATH or PW_CORE as for the other tests)
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright-core')); } catch (e) { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
const ROOT = path.join(__dirname, '..'), PORT = 8135;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const res = []; const T = (n, ok, i = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== '' ? '  [' + i + ']' : '')); };

(async () => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || require('./_chromium')(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (url, ctxOpts) => { const pg = await (await b.newContext(ctxOpts)).newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => m.type() === 'error' && pg.errs.push(m.text())); await pg.addInitScript(() => { window.__keepOver = true; }); await pg.goto(url, { timeout: 240000 }); await pg.waitForFunction(() => window.__wf, null, { timeout: 240000 }); await pg.waitForTimeout(500); return pg; };
  const pg = await open('http://localhost:' + PORT + '/?seed=0', { viewport: { width: 480, height: 270 } });
  await pg.waitForTimeout(1200);
  const S = await pg.evaluate(() => {
    const g = __wf, r = g.r, rn = r.runner, out = {}, clear = () => { g.world.items = g.world.items.filter(i => i.kind === 'coin' || i.kind === 'prop'); };
    out.boot = !document.getElementById('boot') || document.getElementById('boot').className === 'done'; out.ticks = document.querySelectorAll('script:not([src])').length > 30;
    const fresh = () => { g.start(); for (let i = 0; i < 90; i++) { clear(); g.advance(1 / 60); } r.draw(g); };
    const run = (n, each) => { for (let i = 0; i < n && g.state === 'play'; i++) { clear(); if (each) each(i); g.advance(1 / 60); r.draw(g); } };
    // the buffered slide
    fresh(); g.jump(); run(22); out.airborne = g.p.jy > 0; g.slideKey(); out.fastFall = g.p.vy === -600 && g.slideBuf > 0; let landed = -1, slid = false; run(30, i => { if (landed < 0 && g.p.jy === 0) landed = i; if (g.p.slide > 0) slid = true; }); out.buffered = { landed, slid, anim: rn.anim };
    fresh(); g.jump(); run(3); g.slideKey(); g.p.vy = 200; g.p.jy = 60; g.slideBuf = 0.05; let late = false; run(60, () => { if (g.p.slide > 0) late = true; }); out.expired = !late;      // a landing that comes too long after the press: no slide
    fresh(); g.jump(); run(20); g.slideKey(); g.jump(); let s2 = false, j2 = false; run(40, () => { if (g.p.slide > 0) s2 = true; if (g.p.jy > 20 && g.p.vy > 0) j2 = true; }); out.jumpWins = { slid: s2 };      // a jump asked for after it takes the landing
    fresh(); run(5); g.slideKey(); out.ground = g.p.slide > 0;
    // Berry's reactions on the run
    const anims = n => { const set = new Set(); run(n, () => set.add(rn.anim)); set.add(rn.anim); return [...set]; };
    fresh(); run(30); out.base = rn.anim; g.emit('auraBreak'); out.stumble = anims(12); run(50); out.afterStumble = rn.anim;
    g.emit('mission'); out.cheer = anims(12); run(60); out.afterCheer = rn.anim;
    g.pk.t.dash = 2; g.pk.dashK = 1; out.sprint = anims(15); const lean = (() => { const up = new THREE.Vector3(0, 1, 0).transformDirection(rn.bones.Spine_03.matrixWorld); return Math.atan2(-up.z, up.y) * 180 / Math.PI; })(); out.sprintLean = +lean.toFixed(1); g.pk.t.dash = 0; g.pk.dashK = 0; run(40); out.afterSprint = rn.anim;
    out.limits = (() => { const L = BERRY_RIG.LIMITS, v = rn.limited; return v.hip.every(x => Math.abs(x) <= L.hip + 1e-6) && v.shoulder.every(x => Math.abs(x) <= L.shoulder + 1e-6) && v.elbow.every(x => x >= -1e-6 && x <= L.elbow[1] + 1e-6); })();
    // the landing dip of the camera
    fresh(); run(40); const y0 = r.camera.position.y; g.jump(); let minY = 9, landedAt = -1; run(80, i => { if (landedAt < 0 && g.p.jy === 0 && i > 5) landedAt = i; if (landedAt >= 0) minY = Math.min(minY, r.camera.position.y); }); run(40); out.dip = { rest: +y0.toFixed(3), low: +minY.toFixed(3), back: +r.camera.position.y.toFixed(3) };
    // the hit-stop of a crash
    fresh(); run(10); g.world.items.push({ kind: 'barrier', x: g.p.x, z: g.p.z + 40, h: 0, tag: 't' }); let f = 0; while (g.state === 'play' && f++ < 200) g.advance(1 / 60); out.crash = { state: g.state, stop: +g.hitStop.toFixed(3) }; const t0 = g.overT; for (let i = 0; i < 3; i++) g.advance(1 / 60); out.crash.held = g.overT === t0; for (let i = 0; i < 12; i++) g.advance(1 / 60); out.crash.released = g.overT > t0; r.draw(g); out.crash.anim = rn.anim;
    g.start(); run(20); out.restart = g.state + ':' + g.hitStop;
    return out;
  });
  T('the loading screen has gone once the game runs (and the page ticks its bar as the scripts arrive)', S.boot && S.ticks, JSON.stringify({ boot: S.boot, ticks: S.ticks }));
  T('BUFFERED SLIDE: a slide asked for in the air is a fast fall and then a slide on landing (Berry crouches); a landing that comes too late does not slide; a jump asked for after it wins; on the ground it is immediate as before', S.airborne && S.fastFall && S.buffered.landed >= 0 && S.buffered.slid && S.expired && !S.jumpWins.slid && S.ground, JSON.stringify({ buffered: S.buffered, expired: S.expired, jumpWins: S.jumpWins, ground: S.ground }));
  T('Berry reacts on the run: a broken aura is a STUMBLE, a mission a CHEER, the dash a SPRINT with a deeper lean (' + S.sprintLean + ' degrees); each goes back to the run, and the joints stay inside their ranges', S.base === 'run' && S.stumble.includes('stumble') && S.afterStumble === 'run' && S.cheer.includes('cheer') && S.afterCheer === 'run' && S.sprint.includes('sprint') && S.sprintLean > 21 && S.afterSprint === 'run' && S.limits, JSON.stringify({ stumble: S.stumble, cheer: S.cheer, sprint: S.sprint, lean: S.sprintLean, after: [S.afterStumble, S.afterCheer, S.afterSprint] }));
  T('the camera dips on a landing and comes back (' + S.dip.rest + ' > ' + S.dip.low + ' > ' + S.dip.back + ')', S.dip.low < S.dip.rest - 0.04 && S.dip.low > S.dip.rest - 0.3 && Math.abs(S.dip.back - S.dip.rest) < 0.03, JSON.stringify(S.dip));
  T('HIT-STOP: a crash holds the game for a few frames, then the fall goes on; a new run starts clean', S.crash.state === 'over' && S.crash.stop > 0.03 && S.crash.held && S.crash.released && S.crash.anim === 'trip' && S.restart === 'play:0', JSON.stringify({ crash: S.crash, restart: S.restart }));
  // ---------------------------------------------------------------- the HUD in high resolution, the settings, the ambience, the kart art loaded late
  const H = await pg.evaluate(async () => {
    const g = __wf, r = g.r, ui = r.ui, out = {}, clear = () => { g.world.items = g.world.items.filter(i => i.kind === 'coin' || i.kind === 'prop'); };
    g.state = 'title'; g.start(); for (let i = 0; i < 60; i++) { clear(); g.advance(1 / 60); } r.draw(g);
    const hud = document.getElementById('hud'), touch = document.getElementById('touch'), L = ui.hudLayer(), ink = () => { const d = hud.getContext('2d').getImageData(0, 0, hud.width, hud.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 60) n++; return n; };
    out.layer = { exists: !!hud, size: hud.width === touch.width && hud.height === touch.height, place: hud.style.left === touch.style.left && hud.style.top === touch.style.top, pe: getComputedStyle(hud).pointerEvents, ink: ink() };
    const px = document.getElementById('screen').getContext('2d').getImageData(4, 4, 60, 9).data; let boneish = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] > 190 && px[i + 2] > 150) boneish++; out.pixelText = boneish;      // the pixel canvas no longer carries the DIST lettering (its plate is still there)
    const d0 = L.draws; r.draw(g); r.draw(g); out.still = L.draws === d0; for (let i = 0; i < 30; i++) { clear(); g.advance(1 / 60); } r.draw(g); out.redrawn = L.draws > d0;
    g.pause(); r.draw(g); out.pauseOpacity = +hud.style.opacity; g.resume(); r.draw(g); out.playOpacity = +hud.style.opacity;
    g.vr = true; r.draw(g); out.vrInk = ink(); g.vr = false; r.draw(g); out.backInk = ink() > 100;
    g.state = 'title'; r.draw(g); out.titleInk = ink();
    // the settings
    out.has = g.hasSettings; out.open = g.pressAt(BTN.gear.x + 4, BTN.gear.y + 4); out.isOpen = g.settingsOpen; r.draw(g); out.pane = ui._gp.length === 1 && ui._gb.length === 5;
    const row = id => SETTINGS.rows.findIndex(q => q.id === id), tap = id => g.pressAt(SETTINGS.pill.x + 5, SETTINGS.rowY(row(id)) + 5), gl = document.getElementById('gl');
    out.rich0 = gl.classList.contains('rich'); tap('rich'); out.rich1 = gl.classList.contains('rich'); tap('rich'); out.rich2 = gl.classList.contains('rich');
    g.sfx.unlock(); tap('music'); out.music = { opt: g.opt.music, muted: g.sfx.music.muted, fx: g.sfx.master ? g.sfx.master.gain.value : -1 }; tap('fx'); out.fx = { opt: g.opt.fx, gain: g.sfx.master ? g.sfx.master.gain.value : -1 }; const n0 = g.sfx.active; g.sfx.play('coin'); out.fxSilent = g.sfx.active === n0;
    out.saved = JSON.parse(localStorage.getItem('berry.settings')); tap('music'); tap('fx');
    r.renderer.setPixelRatio(1.5); r.resize(); tap('quality'); out.low = { opt: g.opt.quality, pr: r.renderer.getPixelRatio() }; tap('quality'); out.auto = g.opt.quality;
    out.startBlocked = (() => { const s = g.state; g.onKey({ code: 'Enter', key: 'Enter', repeat: false, preventDefault() {} }, true); return s === 'title' && g.state === 'title' && !g.settingsOpen; })();
    g.pressAt(BTN.gear.x + 4, BTN.gear.y + 4); out.close = g.pressAt(SETTINGS.close.x + 5, SETTINGS.close.y + 5); out.closed = !g.settingsOpen;
    out.reload = Object.assign({}, g.loadOpt());
    // the ambience
    g.start(); for (let i = 0; i < 200; i++) { clear(); g.advance(1 / 60); } const A = g.sfx.amb; out.amb = A && !A.dead ? { id: A.id, level: +A.level.toFixed(2), vol: A.vol > 0 } : null; out.ambOf = { run: GameAudio.ambienceOf(g) };
    g.pause(); for (let i = 0; i < 120; i++) g.advance(1 / 60); out.ambPause = A && !A.dead ? +A.level.toFixed(2) : -1; g.resume();
    { const st = g.bgTo, bt = g.bgT; g.bgTo = 'coastNoon'; g.bgT = 1; out.ambOf.coast = GameAudio.ambienceOf(g); g.bgTo = 'forest'; out.ambOf.forest = GameAudio.ambienceOf(g); g.bgTo = 'utrechtA'; out.ambOf.canal = GameAudio.ambienceOf(g); g.bgTo = st; g.bgT = bt; }
    // the kart circuit's art: not there at the title screen, fetched later, and the circuit waits for it
    out.kartEarly = typeof KART_ART; out.kartTag = !!document.querySelector('script[src="src3d/kart_assets.js"]');
    g.state = 'title'; g.startZone = 'kart'; g.start(); for (let i = 0; i < 10; i++) g.advance(1 / 60); r.draw(g); out.kartWait = { state: g.state, loading: !!g.race.loading, asked: r._kartArt };
    for (let i = 0; i < 300 && typeof KART_ART === 'undefined'; i++) await new Promise(q => setTimeout(q, 100));
    out.kartArt = typeof KART_ART; r.draw(g); r.draw(g); out.kartGo = { loading: !!g.race.loading, built: !!r.kart3d, menu: !!g.race.menu }; g.race = null; g.state = 'title'; g.startZone = null;
    return out;
  });
  T('THE HUD IN HIGH RESOLUTION: its own layer over the pixel canvas (same place and size as the touch layer, taking no touches), the lettering on it and no longer on the pixel canvas, redrawn only when a line changes, dimmed under a pause, cleared in VR and on the title screen', H.layer.exists && H.layer.size && H.layer.place && H.layer.pe === 'none' && H.layer.ink > 300 && H.pixelText === 0 && H.still && H.redrawn && H.pauseOpacity < 0.6 && H.playOpacity === 1 && H.vrInk === 0 && H.backInk && H.titleInk === 0, JSON.stringify({ layer: H.layer, pixelText: H.pixelText, still: H.still, redrawn: H.redrawn, op: [H.pauseOpacity, H.playOpacity], vr: H.vrInk, title: H.titleInk }));
  T('THE SETTINGS: the gear opens a card of four rows and CLOSE; RICH COLOURS switches the picture\'s filter, MUSIC mutes the music alone, SOUND EFFECTS silences the effects alone, 3D RESOLUTION LOW holds one pixel per pixel; the choices are saved; the game does not start under the card; CLOSE closes it', H.has && H.open === 'settings' && H.isOpen && H.pane && H.rich0 && !H.rich1 && H.rich2 && H.music.opt === 0 && H.music.muted === true && H.music.fx > 0.5 && H.fx.opt === 0 && H.fx.gain === 0 && H.fxSilent && H.saved.music === 0 && H.saved.fx === 0 && H.low.opt === 1 && H.low.pr === 1 && H.auto === 0 && H.startBlocked && H.close === 'close' && H.closed && H.reload.music === 1 && H.reload.fx === 1 && H.reload.rich === 1 && H.reload.quality === 0, JSON.stringify({ open: H.open, pane: H.pane, rich: [H.rich0, H.rich1, H.rich2], music: H.music, fx: H.fx, silent: H.fxSilent, saved: H.saved, low: H.low, blocked: H.startBlocked, reload: H.reload }));
  T('ZONE AMBIENCE: a quiet bed under the run (the neon streets hum, the coast has its surf, the forest its leaves, the canals their water), silent in a pause', !!H.amb && H.amb.id === 'hum' && H.amb.level > 0.8 && H.amb.vol && H.ambOf.run === 'hum' && H.ambOf.coast === 'coast' && H.ambOf.forest === 'leaves' && H.ambOf.canal === 'water' && H.ambPause < 0.05, JSON.stringify({ amb: H.amb, of: H.ambOf, pause: H.ambPause }));
  T('THE KART CIRCUIT\'S ART (5 MB) is not loaded before the title screen; entering the circuit first makes the race wait under a loading line, and it starts once the art has arrived', H.kartWait.state === 'race' && (H.kartEarly === 'undefined' ? H.kartWait.loading && H.kartWait.asked === 'loading' : true) && H.kartArt === 'object' && !H.kartGo.loading && H.kartGo.built && H.kartGo.menu, JSON.stringify({ early: H.kartEarly, wait: H.kartWait, art: H.kartArt, go: H.kartGo }));
  // ---------------------------------------------------------------- back to the title screen, and the air of the zones
  const N = await pg.evaluate(() => {
    const g = __wf, r = g.r, ui = r.ui, out = {}, clear = () => { g.world.items = g.world.items.filter(i => i.kind === 'coin' || i.kind === 'prop'); };
    g.state = 'title'; g.start(); for (let i = 0; i < 120; i++) { clear(); g.advance(1 / 60); } const z1 = g.p.z; g.pause(); r.draw(g); out.pausePills = ui._gb.length;
    out.pauseMenu = g.pressAt(BTN.menuP.x + 5, BTN.menuP.y + 5); out.afterPause = { state: g.state, z: g.p.z < z1, coins: g.coins }; r.draw(g); out.mapBack = g.mapOn === true;
    g.start(); for (let i = 0; i < 30; i++) { clear(); g.advance(1 / 60); } g.world.items.push({ kind: 'barrier', x: g.p.x, z: g.p.z + 40, h: 0, tag: 't' }); for (let i = 0; i < 200; i++) g.advance(1 / 60); r.draw(g); out.over = g.state; out.overPills = ui._gb.length;
    out.overMenu = g.pressAt(BTN.menuO.x + 5, BTN.menuO.y + 5); out.afterOver = g.state;
    g.start(); for (let i = 0; i < 30; i++) { clear(); g.advance(1 / 60); } g.world.items.push({ kind: 'barrier', x: g.p.x, z: g.p.z + 40, h: 0, tag: 't' }); for (let i = 0; i < 200; i++) g.advance(1 / 60); g.onKey({ code: 'Escape', key: 'Escape', repeat: false, preventDefault() {} }, true); out.escOver = g.state;
    g.start(); for (let i = 0; i < 20; i++) { clear(); g.advance(1 / 60); } out.again = g.state;
    // the air
    const A = r.air, run = (id, n) => { g.bgTo = id; g.bgT = 1; for (let i = 0; i < n; i++) { clear(); g.advance(1 / 60); const b = g.bgTo; g.bgTo = id; g.bgT = 1; r.draw(g); } return { style: A.style, vis: A.points.visible, n: A.points.geometry.drawRange.count, level: +A.level.toFixed(2), add: A.mat.blending === THREE.AdditiveBlending }; };
    out.styles = { forest: Air3D.styleOf('forest'), ruins: Air3D.styleOf('ruins'), market: Air3D.styleOf('market'), neon: Air3D.styleOf('neon'), coast: Air3D.styleOf('coastNoon'), city: Air3D.styleOf('city') };
    out.forest = run('forest', 200); const z0 = A.pos[2]; run('forest', 10); out.moves = A.pos[2] !== z0; out.inBox = (() => { for (let i = 0; i < out.forest.n; i++) { if (Math.abs(A.pos[i * 3]) > 10.5 || A.pos[i * 3 + 1] < 0.2 || A.pos[i * 3 + 1] > 6.2 || A.pos[i * 3 + 2] > 6.01 || A.pos[i * 3 + 2] < -40.01) return false; } return true; })();
    out.coast = run('coastNoon', 200); out.market = run('market', 260);
    return out;
  });
  T('BACK TO THE TITLE SCREEN: MENU on the pause card and on the game-over card (and Esc there) give up the run and return to the title with its map; a new run starts from there', N.pausePills === 2 && N.pauseMenu === 'menu' && N.afterPause.state === 'title' && N.afterPause.z && N.afterPause.coins === 0 && N.mapBack && N.over === 'over' && N.overPills === 2 && N.overMenu === 'menu' && N.afterOver === 'title' && N.escOver === 'title' && N.again === 'play', JSON.stringify({ pause: [N.pausePills, N.pauseMenu, N.afterPause], over: [N.over, N.overPills, N.overMenu, N.afterOver], esc: N.escOver, again: N.again }));
  T('THE AIR OF THE ZONES: fireflies in the forest (additive lights, inside their box round the runner, passing by as it runs), dust in the ruins, petals over the market, glints in the neon streets, a clear air on the coast and in the old town; it fades out and in between zones', N.styles.forest === 'fireflies' && N.styles.ruins === 'motes' && N.styles.market === 'petals' && N.styles.neon === 'glints' && N.styles.coast === '' && N.styles.city === '' && N.forest.style === 'fireflies' && N.forest.vis && N.forest.n === 70 && N.forest.level > 0.8 && N.forest.add && N.moves && N.inBox && N.coast.style === '' && !N.coast.vis && N.market.style === 'petals' && N.market.vis && !N.market.add, JSON.stringify({ styles: N.styles, forest: N.forest, coast: N.coast, market: N.market, moves: N.moves, box: N.inBox }));
  // ---------------------------------------------------------------- swipes
  const W = await pg.evaluate(() => {
    const g = __wf, r = g.r, out = {}, clear = () => { g.world.items = g.world.items.filter(i => i.kind === 'coin' || i.kind === 'prop'); };
    const ev = (type, x, y, id) => window.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    const fresh = () => { g.state = 'title'; g.start(); g.touch = true; for (let i = 0; i < 60; i++) { clear(); g.advance(1 / 60); } };
    fresh(); ev('pointerdown', 240, 150, 11); ev('pointermove', 243, 110, 11); out.up = { buf: g.jumpBuf > 0, swiped: g.swiped }; ev('pointermove', 243, 60, 11); g.advance(1 / 60); out.once = g.p.jy > 0; ev('pointerup', 243, 60, 11);
    fresh(); ev('pointerdown', 240, 100, 12); ev('pointermove', 238, 140, 12); out.down = g.p.slide > 0; ev('pointerup', 238, 140, 12);
    fresh(); g.swiped = null; ev('pointerdown', 240, 150, 13); ev('pointermove', 300, 140, 13); out.sideways = g.swiped === null && g.jumpBuf <= 0 && g.p.slide <= 0; ev('pointerup', 300, 140, 13);
    fresh(); g.swiped = null; ev('pointerdown', 240, 150, 14); ev('pointermove', 241, 135, 14); out.short = g.swiped === null; ev('pointerup', 241, 135, 14);
    fresh(); g.swiped = null; { const sc = document.getElementById('screen').getBoundingClientRect(), t = g.touchSet().find(q => q.id === 'left'), k = sc.width / VW, x = sc.left + (t.x + t.w / 2) * k, y = sc.top + (t.y + t.h / 2) * k; ev('pointerdown', x, y, 15); ev('pointermove', x, y - 50, 15); out.onButton = g.swiped === null && g.jumpBuf <= 0; ev('pointerup', x, y - 50, 15); }
    g.state = 'title'; g.swiped = null; ev('pointerdown', 240, 150, 16); ev('pointermove', 240, 90, 16); out.menu = g.swiped === null && g.state === 'title'; ev('pointerup', 240, 90, 16); g.mouse.down = false; g.touch = false;
    return out;
  });
  T('SWIPES (touch): a stroke up outside the buttons is one jump, a stroke down a slide; a sideways stroke, a short one, one that starts on a button and one on the title screen do nothing', W.up.buf && W.up.swiped === 'jump' && W.once && W.down && W.sideways && W.short && W.onButton && W.menu, JSON.stringify(W));
  T('no JS errors', pg.errs.length === 0, pg.errs.slice(0, 2).join('|'));
  console.log('\n' + res.filter(Boolean).length + '/' + res.length + ' passed');
  await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(1); });
