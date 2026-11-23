// BERRY RUNNER 2 regression test: the sequel's gameplay-feel stage. The buffered slide (asked for in the air, done on landing), the crash's hit-stop, the camera's dip on landing, Berry's
// sprint, stumble and cheer, and the loading screen.
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
  T('no JS errors', pg.errs.length === 0, pg.errs.slice(0, 2).join('|'));
  console.log('\n' + res.filter(Boolean).length + '/' + res.length + ' passed');
  await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(1); });
