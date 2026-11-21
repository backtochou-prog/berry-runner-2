// BERRY RUNNER 2 regression test: ZAGLA, the second character, rebuilt from the user's character sheet (docs/zagla/zagla-character-sheet.png) as a rigged 3D body on Berry's rig and
// Berry's motion (RunnerZagla, src3d/zagla3d.js, a RunnerBerry). Checks the body (bones, size, her own proportions, the pieces of the sheet), the shared animations on her longer legs
// (run, jump, land, crouch under the gates, turn, vehicles, trip), the joint ranges, that Berry is untouched by her, the choice of the character on the title screen, and the 2D game.
//
// Run:  node tests/qa3d_zagla.js     (needs playwright-core and a Chromium: CHROMIUM=/path/to/chrome, NODE_PATH or PW_CORE as for the other tests)
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright-core')); } catch (e) { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
const ROOT = path.join(__dirname, '..'), PORT = 8127;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const res = []; const T = (n, ok, i = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== '' ? '  [' + i + ']' : '')); };

(async () => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || require('./_chromium')(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = process.env.TEST_URL || 'http://localhost:' + PORT + '/';
  const open = async (url, ctx) => { const pg = await (ctx || await b.newContext({ viewport: { width: 640, height: 360 } })).newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && pg.errs.push(m.text())); await pg.addInitScript(() => { window.__keepOver = true; }); await pg.goto(url, { timeout: 90000 }); await pg.waitForFunction(() => window.__wf, null, { timeout: 240000 }); await pg.waitForTimeout(1500); return pg; };

  // ================================================================ 1. the body and its motion
  const pg = await open(base + '?avatar=zagla');
  const A = await pg.evaluate(async () => {
    const g = __wf, r = g.r, rn = r.runner, out = {};
    out.cls = rn.constructor.name; out.rig = rn instanceof RunnerBerry && rn instanceof RunnerSprite; out.ch = r.character; out.tris = rn.tris; out.dots = rn.dots; out.dims = rn.dims;
    out.bones = BERRY_RIG.BONES.filter(n => !rn.bones[n]); out.own = { hair: !!rn.leaves, bag: !!rn.bag, hood: !!rn.hood, strings: !!rn.strings };
    const im = new Image(); await new Promise(res => { im.onload = im.onerror = res; im.src = ZAGLA_ASSETS.front; }); out.art = [im.naturalWidth, im.naturalHeight, ZAGLA_ASSETS.w, ZAGLA_ASSETS.h];
    const st = o => Object.assign({ time: 3, runRate: 2.6, airborne: false, vy: 0, sliding: false, lean: 0, state: 'play', beat: 0 }, o);
    const box = o => { rn.group.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o || rn.pivot); return { top: +bb.max.y.toFixed(2), bottom: +bb.min.y.toFixed(2), half: +Math.max(-bb.min.x, bb.max.x).toFixed(2), deep: +(bb.max.z - bb.min.z).toFixed(2) }; };
    const feet = () => { rn.group.updateMatrixWorld(true); return Math.min(...rn.foot.map(f => new THREE.Box3().setFromObject(f).min.y)); };
    const L = BERRY_RIG.LIMITS, lim = { ok: true, worst: '' }, check = () => { const v = rn.limited, e = 1e-6, bad = (v.hip.some(x => Math.abs(x) > L.hip + e) && 'hip') || (v.knee.some(x => x < -e || x > L.knee[1] + e) && 'knee') || (v.ankle.some(x => Math.abs(x) > L.ankle + e) && 'ankle') || (v.elbow.some(x => x < -e || x > L.elbow[1] + e) && 'elbow') || (v.shoulder.some(x => Math.abs(x) > L.shoulder + e) && 'shoulder'); if (bad) { lim.ok = false; lim.worst = bad; } };
    const run = (n, o) => { for (let i = 0; i < n; i++) { rn.update(1 / 60, st(o)); check(); } };
    const pose = (name, o, n = 90) => { rn.group.position.set(0, 0, 0); rn.group.rotation.y = 0; run(n, o); out[name] = Object.assign(box(), { anim: rn.anim }); };
    rn.ride = 0; pose('title', { state: 'title', time: 1 }); out.title.feet = +feet().toFixed(3); out.hipY = +rn.hipY.toFixed(2);
    rn.group.updateMatrixWorld(true); const egg = new THREE.Box3().setFromObject(rn.bones.Spine_03); out.egg = { h: +(egg.max.y - egg.min.y).toFixed(2), w: +(egg.max.x - egg.min.x).toFixed(2) };
    // the visor is on her front (-z of the body), the hair over her right brow (+x)
    const hb = new THREE.Box3().setFromObject(rn.leaves), hp = rn.leaves.children[0].children[0].geometry.attributes.position; let mx = 0, front = 0; for (let i = 0; i < hp.count; i++) { mx += hp.getX(i) / hp.count; if (hp.getZ(i) < 0) front++; } out.hair = { meanX: +mx.toFixed(3), front: +(front / hp.count).toFixed(2), top: +hb.max.y.toFixed(2) };      // (where the mass of the hair is: to her right (+x) and over her front (-z))
    rn.group.position.set(0, 0, 0); run(60, {}); const R = { lean: [], feet: [], hipL: [], hipR: [] }, up = new THREE.Vector3();
    for (let i = 0; i < 60; i++) { run(1, {}); rn.group.updateMatrixWorld(true); up.set(0, 1, 0).transformDirection(rn.bones.Spine_03.matrixWorld); R.lean.push(Math.atan2(-up.z, up.y)); R.feet.push(feet()); R.hipL.push(rn.limited.hip[0]); R.hipR.push(rn.limited.hip[1]); }
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    out.run = { anim: rn.anim, lean: +(avg(R.lean) * 180 / Math.PI).toFixed(1), feetMin: +Math.min(...R.feet).toFixed(3), feetMax: +Math.max(...R.feet).toFixed(3), opposed: +avg(R.hipL.map((v, i) => v * R.hipR[i])).toFixed(3) };
    const J = []; run(2, { airborne: true, vy: 5 }); J.push(rn.anim); run(24, { airborne: true, vy: 3 }); J.push(rn.anim); run(10, { airborne: true, vy: -3 }); J.push(rn.anim); run(1, {}); J.push(rn.anim); let lf = 1; while (lf < 30) { run(1, {}); if (rn.anim !== 'land') break; lf++; } J.push(rn.anim); out.jump = { seq: J.join('>'), landFrames: lf };
    pose('crouch', { sliding: true }, 40); out.crouch.feet = +feet().toFixed(3); run(40, {}); out.up = box().top;
    run(120, { scooter: true, vehicle: 'scooter' }); out.scooter = { anim: rn.anim, ride: +rn.ride.toFixed(2), vis: rn.scooter.visible }; run(120, {}); out.off = rn.anim;
    pose('over', { state: 'over' }); for (let i = 0; i < 30; i++) rn.update(1 / 60, st({ state: 'over', absorb: 0.6, absorbSpin: 3 })); out.absorb = rn.anim; run(60, {});
    out.heading = [0, 0.4, Math.PI].map(yaw => { rn.group.rotation.y = yaw; run(40, { faceYaw: 0.7 }); rn.group.updateMatrixWorld(true); const f = new THREE.Vector3(0, 0, -1).transformDirection(rn.bones.Hips.matrixWorld); return +(f.x * -Math.sin(yaw) + f.z * -Math.cos(yaw)).toFixed(2); }); rn.group.rotation.y = 0;
    out.limits = lim;
    // Berry is her own body still: another class instance, with the pieces Zagla does not have
    const be = r.makeRunner('strawberry'); out.berry = { cls: be.constructor.name, isZ: be instanceof RunnerZagla, bag: !!be.bag, hip: be.dims.HIP, tris: be.tris };
    return out;
  });
  T('Zagla is a rigged 3D body on Berry\'s rig (' + A.cls + ', ' + A.tris + ' triangles, ' + A.dots + ' dots): every bone of the blueprint, her hair as the follow-through piece (no bag, hood or drawstrings), her picture for the panels embedded', A.cls === 'RunnerZagla' && A.rig && A.ch === 'zagla' && A.bones.length === 0 && A.tris > 5000 && A.tris < 30000 && A.dots >= 25 && A.own.hair && !A.own.bag && !A.own.hood && !A.own.strings && A.art[0] === A.art[2] && A.art[1] === A.art[3] && A.art[0] > 100, JSON.stringify({ cls: A.cls, tris: A.tris, bones: A.bones, own: A.own, art: A.art }));
  T('her proportions (the sheet): 1.9 m tall with her feet on the ground, one tall egg (' + A.egg.h + ' m) for body and head, long legs (the hips at ' + A.dims.HIP + ' m, Berry\'s at 0.62), the hair swept to her right', A.title.anim === 'idle' && A.title.top >= 1.85 && A.title.top <= 1.95 && Math.abs(A.title.feet) <= 0.02 && A.egg.h > 1.05 && A.egg.h < 1.3 && A.dims.HIP === 0.7 && Math.abs(A.hipY - 0.7) < 0.03 && A.hair.meanX > 0.05 && A.hair.front > 0.5 && A.title.half < 0.65, JSON.stringify({ title: A.title, egg: A.egg, hair: A.hair, hipY: A.hipY }));
  T('the shared motion on her legs: RUN (lean ' + A.run.lean + ' degrees, legs opposed, the lower foot on the ground), JUMP in three phases then LAND (' + A.jump.seq + ', ' + A.jump.landFrames + ' frames), CROUCH under the 1.05 m gates (' + A.crouch.top + ' m) and up again', A.run.anim === 'run' && A.run.lean >= 13 && A.run.lean <= 21 && A.run.opposed < -0.05 && A.run.feetMin > -0.035 && A.run.feetMax < 0.05 && A.jump.seq === 'takeoff>air>fall>land>run' && A.jump.landFrames >= 5 && A.jump.landFrames <= 8 && A.crouch.anim === 'crouch' && A.crouch.top <= 1.05 && Math.abs(A.crouch.feet) <= 0.04 && A.up >= 1.8, JSON.stringify({ run: A.run, jump: A.jump, crouch: A.crouch, up: A.up }));
  T('she rides the scooter, trips, is absorbed by the vortex, keeps the heading of her group, and every joint stays inside the blueprint\'s ranges', A.scooter.anim === 'ride' && A.scooter.ride > 0.9 && A.scooter.vis && A.off === 'run' && A.over.anim === 'trip' && A.over.top < 1.3 && A.over.bottom > -0.15 && A.absorb === 'absorb' && A.heading.every(v => v > 0.98) && A.limits.ok, JSON.stringify({ scooter: A.scooter, over: A.over, absorb: A.absorb, heading: A.heading, limits: A.limits }));
  T('Berry is untouched by her: her own class, her own body (bag, hips at 0.62 m)', A.berry.cls === 'RunnerBerry' && !A.berry.isZ && A.berry.bag && A.berry.hip === 0.62 && A.berry.tris > A.tris, JSON.stringify(A.berry));
  // a real run as Zagla
  const Pl = await pg.evaluate(() => {
    const g = __wf, r = g.r; g.start(); g.world.items = []; const rn = r.runner, anims = new Set(), kids0 = (() => { for (let f = 0; f < 30; f++) { g.advance(1 / 60); r.draw(g); } return r.scene.children.length; })();
    for (let f = 0; f < 700 && g.state === 'play'; f++) { if (f % 20 === 0) g.world.items = g.world.items.filter(i => i.kind === 'coin' || i.kind === 'prop'); if (f === 200) g.jump(); if (f === 400) g.slideKey(); g.advance(1 / 60); const near = (f >= 198 && f < 280) || (f >= 398 && f < 420); if (near || f % 15 === 0) { r.draw(g); anims.add(rn.anim); } }
    return { state: g.state, cls: rn.constructor.name, anims: [...anims].sort().join(), kids: [kids0, r.scene.children.length] };
  });
  T('a run as Zagla (a jump, a slide): the run, the takeoff, the air, the fall, the landing and the crouch are played, nothing leaks, no JS errors', Pl.state === 'play' && Pl.cls === 'RunnerZagla' && ['run', 'takeoff', 'air', 'fall', 'land', 'crouch'].every(a => Pl.anims.split(',').includes(a)) && Pl.kids[0] === Pl.kids[1] && pg.errs.length === 0, JSON.stringify(Pl) + pg.errs.slice(0, 1).join('|'));
  await pg.context().close();
  // ================================================================ 4. the choice of the character: the button and the C key on the title screen, remembered
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  const p1 = await open(base, ctx);
  const C0 = await p1.evaluate(() => ({ ch: __wf.r.character, cls: __wf.r.runner.constructor.name, state: __wf.state, btn: typeof BTN !== 'undefined' ? BTN.char : null, has: typeof __wf.r.nextCharacter, saved: localStorage.getItem('wayfarer.character') }));
  await p1.keyboard.press('KeyC'); await p1.waitForTimeout(400);
  const C1 = await p1.evaluate(() => ({ ch: __wf.r.character, cls: __wf.r.runner.constructor.name, saved: localStorage.getItem('wayfarer.character'), inScene: __wf.r.scene.children.includes(__wf.r.runner.group), oldGone: !__wf.r.scene.children.includes(__wf.r.characters.strawberry.group), state: __wf.state }));
  const box = await p1.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  await p1.mouse.click(box.l + (216 + 48) / 320 * box.w, box.t + (123 + 8) / 180 * box.h); await p1.waitForTimeout(400);
  const C2 = await p1.evaluate(() => ({ ch: __wf.r.character, cls: __wf.r.runner.constructor.name, saved: localStorage.getItem('wayfarer.character'), state: __wf.state }));
  await p1.mouse.click(box.l + (216 + 48) / 320 * box.w, box.t + (123 + 8) / 180 * box.h); await p1.waitForTimeout(400);
  const C3 = await p1.evaluate(() => ({ ch: __wf.r.character, state: __wf.state, saved: localStorage.getItem('wayfarer.character') }));
  await p1.reload({ timeout: 180000 }); await p1.waitForFunction(() => window.__wf, null, { timeout: 240000 }); await p1.waitForTimeout(1200);
  const C4 = await p1.evaluate(() => ({ ch: __wf.r.character, cls: __wf.r.runner.constructor.name, state: __wf.state }));
  // the choice is only made on the title screen: C during the run does nothing
  await p1.evaluate(() => { __wf.advance = () => {}; __wf.start(); }); await p1.keyboard.press('KeyC'); await p1.waitForTimeout(200);
  const C5 = await p1.evaluate(() => ({ ch: __wf.r.character, state: __wf.state }));
  T('the character is chosen on the title screen: the strawberry by default (' + C0.cls + ', nothing saved: ' + C0.saved + ', the button at ' + (C0.btn && [C0.btn.x, C0.btn.y, C0.btn.w, C0.btn.h].join(',')) + '); the C key (' + C1.ch + ' ' + C1.cls + ', the strawberry out of the scene: ' + C1.oldGone + '), a click on the button (' + C2.ch + ') and another (' + C3.ch + ') change it, every change is saved (' + C1.saved + ' / ' + C2.saved + ' / ' + C3.saved + '), the game is still on the title screen (' + C3.state + '), it is still Zagla after a reload (' + C4.ch + ' ' + C4.cls + '), and C during the run changes nothing (' + C5.ch + ' in ' + C5.state + ')',
    C0.ch === 'strawberry' && C0.cls === 'RunnerBerry' && C0.saved === null && C0.has === 'function' && C0.btn && C0.btn.w > 60 && C0.state === 'title' && C1.ch === 'zagla' && C1.cls === 'RunnerZagla' && C1.saved === 'zagla' && C1.inScene && C1.oldGone && C2.ch === 'strawberry' && C2.saved === 'strawberry' && C3.ch === 'zagla' && C3.state === 'title' && C4.ch === 'zagla' && C4.cls === 'RunnerZagla' && C5.ch === 'zagla' && C5.state === 'play', JSON.stringify([C0, C1, C2, C3, C4, C5]));
  const UI = await p1.evaluate(() => { const px = (x, y) => Array.from(document.getElementById('screen').getContext('2d').getImageData(x, y, 1, 1).data); return null; });
  // the switch builds each runner once: switching ten times leaves the scene, the geometries and the textures as they were
  const SW = await p1.evaluate(() => { const g = __wf, r = g.r; g.state = 'title'; const t0 = g.time; for (let i = 0; i < 20; i++) { g.time += 0.1; r.draw(g); } g.time = t0;      /* (a warm-up over the same camera angles: the scenery the orbiting title camera brings into view is uploaded once, before the count) */ const k0 = r.scene.children.length, geo0 = r.renderer.info.memory.geometries; for (let i = 0; i < 10; i++) { r.nextCharacter(); g.time += 0.1; r.draw(g); } const k1 = r.scene.children.length, geo1 = r.renderer.info.memory.geometries; for (let i = 0; i < 10; i++) { r.nextCharacter(); g.time += 0.1; r.draw(g); } return { k: [k0, k1, r.scene.children.length], geo: [geo0, geo1, r.renderer.info.memory.geometries], tex: r.renderer.info.memory.textures, built: Object.keys(r.characters).sort().join() }; });
  T('switching the character ten times (and ten more) builds each runner once: the scene keeps ' + SW.k.join(' / ') + ' children, the geometries ' + SW.geo.join(' / ') + ' (' + SW.built + ' built), ' + SW.tex + ' textures on the GPU',
    SW.k[1] === SW.k[2] && SW.geo[1] === SW.geo[2] && SW.built === 'strawberry,zagla' && SW.tex <= 54, JSON.stringify(SW));
  // ?avatar= forces one for the visit (and is not remembered)
  await p1.evaluate(() => { window.requestAnimationFrame = () => 0; });      // (the first page stops drawing while the second one loads: two pages drawing in software GL starve each other)
  const p2 = await open(base + '?avatar=strawberry', await b.newContext({ viewport: { width: 640, height: 360 } }));
  const F1 = await p2.evaluate(() => ({ ch: __wf.r.character, saved: localStorage.getItem('wayfarer.character') }));
  T('?avatar=strawberry gives the strawberry, ?avatar=zagla gives Zagla (nothing saved by the URL alone: ' + F1.saved + ')', F1.ch === 'strawberry' && F1.saved === null && C1.ch === 'zagla', JSON.stringify(F1));
  T('no JS errors (the title screen and the switches)', p1.errs.length === 0 && p2.errs.length === 0, p1.errs.concat(p2.errs).slice(0, 2).join('|')); await p1.context().close(); await p2.context().close();

  // ================================================================ 5. the classic 2D game is untouched: no character button, no Zagla
  const p3 = await open(base + '2d.html');
  const D2 = await p3.evaluate(() => { const g = __wf; return { zagla: typeof RunnerZagla + '/' + typeof ZAGLA_ASSETS, hasChar: typeof g.r.nextCharacter, state: g.state }; });
  await p3.keyboard.press('KeyC'); await p3.waitForTimeout(300); const D3 = await p3.evaluate(() => __wf.state);
  T('the classic 2D game has no character button and no Zagla (' + D2.zagla + ', nextCharacter ' + D2.hasChar + ') and C does nothing there (' + D3 + ')', D2.zagla === 'undefined/undefined' && D2.hasChar === 'undefined' && D3 === 'title' && p3.errs.length === 0, p3.errs.slice(0, 1).join('|'));
  await p3.context().close();
  console.log('\n' + res.filter(Boolean).length + '/' + res.length + ' passed');
  await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('TEST ERROR', e.stack || e.message); process.exit(1); });
