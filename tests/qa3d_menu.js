// BERRY RUNNER 2 regression test: THE MENUS. The glass title card with the round icon, and THE MAP behind it (Renderer.drawMap, ZMAP in src/game.js): the zones of the game as stops
// along a road, drawn once on its own canvas over the 3D view; a tap on a stop chooses where the next run starts (Game.startZone), every stop really starts a run there, the map goes
// when the run begins and comes back with the title screen, and the character button (moved under the card) still changes the runner.
//
// Run:  node tests/qa3d_menu.js     (needs playwright-core and a Chromium: CHROMIUM=/path/to/chrome, NODE_PATH or PW_CORE as for the other tests)
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright-core')); } catch (e) { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
const ROOT = path.join(__dirname, '..'), PORT = 8134;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const res = []; const T = (n, ok, i = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== '' ? '  [' + i + ']' : '')); };

(async () => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || require('./_chromium')(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (url, ctxOpts) => { const pg = await (await b.newContext(ctxOpts)).newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => m.type() === 'error' && pg.errs.push(m.text())); await pg.addInitScript(() => { window.__keepOver = true; }); await pg.goto(url, { timeout: 240000 }); await pg.waitForFunction(() => window.__wf, null, { timeout: 240000 }); await pg.waitForTimeout(500); return pg; };
  const pg = await open('http://localhost:' + PORT + '/?seed=0', { viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  const M = await pg.evaluate(() => {
    const g = __wf, r = g.r, ui = r.ui, out = {}; g.state = 'title'; r.draw(g); r.draw(g);
    const map = document.getElementById('map'), vis = e => !!e && getComputedStyle(e).display !== 'none';
    out.map = { shown: vis(map), on: g.mapOn === true, size: map ? [map.width, map.height] : null, win: [innerWidth * 2, innerHeight * 2], pe: map ? getComputedStyle(map).pointerEvents : '' };
    out.order = (() => { const k = [...document.body.children]; return k.indexOf(document.getElementById('gl')) < k.indexOf(map) && k.indexOf(map) < k.indexOf(document.getElementById('screen')); })();
    out.stops = ZMAP.length; out.inside = ZMAP.every(q => q.x > 140 && q.x < 312 && q.y > 30 && q.y < 168); out.clearOfButtons = ZMAP.every(q => [BTN.title, BTN.char, BTN.sound].every(b => q.x + 9 < b.x || q.x - 9 > b.x + b.w || q.y + 9 < b.y || q.y - 9 > b.y + b.h));
    const px = (x, y) => { const sc = document.getElementById('screen').getBoundingClientRect(), k = sc.width / VW * 2; return [...map.getContext('2d').getImageData(Math.round(sc.left * 2 + x * k), Math.round(sc.top * 2 + y * k), 1, 1).data]; };
    out.painted = { stop: px(ZMAP[1].x - 3, ZMAP[1].y - 3), sky: px(300, 60) };      // the beach's stop is its cyan, the sky a dark violet
    out.glass = { panes: ui._gp.length, icon: ui._gp[0] && ui._gp[0][4], els: [...document.querySelectorAll('.glass')].filter(vis).length };
    const draws0 = ui._map.sig; r.draw(g); r.draw(g); out.still = ui._map.sig === draws0;
    // a tap on a stop chooses the start; the first stop is the usual start
    out.tapBeach = g.pressAt(ZMAP[1].x + 2, ZMAP[1].y - 1); out.zone1 = g.startZone; out.stateAfterTap = g.state; r.draw(g); out.redrawn = ui._map.sig !== draws0 && ui._map.sig.includes('coast');
    out.tapFirst = g.pressAt(ZMAP[0].x, ZMAP[0].y); out.zone0 = g.startZone;
    out.tapEmpty = g.pressAt(300, 60);
    out.charBefore = r.character; out.tapChar = g.pressAt(BTN.char.x + 5, BTN.char.y + 5); out.charAfter = r.character; g.pressAt(BTN.char.x + 5, BTN.char.y + 5);
    // every stop starts a run there
    out.starts = ZMAP.map(q => { g.state = 'title'; g.startZone = q.id === ZMAP[0].id ? null : q.id; g.start(); const z0 = Math.round(g.p.z); for (let i = 0; i < 20; i++) g.advance(1 / 60); r.draw(g); return q.id + ':' + g.state + ':' + (z0 > 0 ? 'far' : 'start') + (g.race ? (g.race.kart ? ':kart' : ':race') : ''); });
    out.mapInRun = vis(map) || g.mapOn === true;
    if (g.race) { g.race = null; } g.state = 'title'; g.startZone = null; r.draw(g); out.back = vis(map) && g.mapOn === true;
    g.start(); for (let i = 0; i < 10; i++) g.advance(1 / 60); g.pause(); r.draw(g); out.pause = { map: vis(map), panes: ui._gp.length, els: [...document.querySelectorAll('.glass')].filter(vis).length };
    g.resume(); r.draw(g); out.play = { els: [...document.querySelectorAll('.glass')].filter(vis).length };
    return out;
  });
  T('the title screen: the map lies over the 3D view (its own canvas, the size of the screen at its resolution, between the 3D canvas and the HUD, taking no touches), behind one glass card with the round icon', M.map.shown && M.map.on && M.map.size[0] === M.map.win[0] && M.map.size[1] === M.map.win[1] && M.map.pe === 'none' && M.order && M.glass.panes === 1 && M.glass.icon > 0 && M.glass.els === 1, JSON.stringify({ map: M.map, order: M.order, glass: M.glass }));
  T('the map shows the ' + M.stops + ' zones as stops beside the card, clear of the buttons, painted in their colours on a night sky, and it is drawn once (a still menu redraws nothing)', M.stops === 9 && M.inside && M.clearOfButtons && M.painted.stop[2] > 180 && M.painted.stop[0] < 140 && M.painted.sky[0] < 70 && M.painted.sky[2] > M.painted.sky[1] && M.still, JSON.stringify({ inside: M.inside, clear: M.clearOfButtons, painted: M.painted, still: M.still }));
  T('a tap on a stop chooses the start (the beach: ' + M.zone1 + '), stays on the title screen and redraws the map; the first stop is the usual start; a tap on the open map does nothing; the character button (under the card) still changes the runner', M.tapBeach === 'zone' && M.zone1 === 'coast' && M.stateAfterTap === 'title' && M.redrawn && M.tapFirst === 'zone' && M.zone0 === null && M.tapEmpty === null && M.tapChar === 'char' && M.charAfter !== M.charBefore, JSON.stringify({ tap: M.tapBeach, zone: M.zone1, first: M.zone0, empty: M.tapEmpty, char: [M.charBefore, M.charAfter] }));
  T('every stop starts a run in its zone: the first at the start of the road, the others further along it (Utrecht by the train of the Gare du Midi: its cutscene), the race zone in a race and the kart circuit in the kart race', M.starts[0] === 'neon:play:start' && M.starts.slice(1, 7).every(s => /:(play|scene):far$/.test(s)) && M.starts[7] === 'race:race:far:race' && M.starts[8] === 'kart:race:far:kart', M.starts.join(' '));
  T('the map goes when the run begins and comes back with the title screen; a pause shows one glass card and no map; a run shows neither', !M.mapInRun && M.back && !M.pause.map && M.pause.panes === 1 && M.pause.els === 1 && M.play.els === 0, JSON.stringify({ inRun: M.mapInRun, back: M.back, pause: M.pause, play: M.play }));
  T('no JS errors', pg.errs.length === 0, pg.errs.slice(0, 2).join('|'));
  console.log('\n' + res.filter(Boolean).length + '/' + res.length + ' passed');
  await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(1); });
