// BERRY RUNNER 2 regression test: THE POD CAR (src3d/pod_car.js), the player's race car rebuilt from the user's sheet (docs/car/pod-car-sheet.png) as a 3D model.
// Checks that the race uses it (the earlier car is kept out of the scene), its size and stance, the pieces of the sheet (the black shell under the blue glass, the neon lines,
// the blue hub caps), that the brake lights still answer the brake, that it follows the player's lane and jump, and that a race still plays with no error.
//
// Run:  node tests/qa3d_podcar.js     (needs playwright-core and a Chromium: CHROMIUM=/path/to/chrome, NODE_PATH or PW_CORE as for the other tests)
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright-core')); } catch (e) { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
const ROOT = path.join(__dirname, '..'), PORT = 8133;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const res = []; const T = (n, ok, i = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== '' ? '  [' + i + ']' : '')); };

(async () => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || require('./_chromium')(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (url, ctxOpts) => { const pg = await (await b.newContext(ctxOpts)).newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => m.type() === 'error' && pg.errs.push(m.text())); await pg.addInitScript(() => { window.__keepOver = true; }); await pg.goto(url, { timeout: 240000 }); await pg.waitForFunction(() => window.__wf, null, { timeout: 240000 }); await pg.waitForTimeout(500); return pg; };
  const pg = await open('http://localhost:' + PORT + '/?zone=race&seed=0', { viewport: { width: 480, height: 270 } });
  const C = await pg.evaluate(() => {
    const g = __wf, r = g.r, out = {}, key = (code, k, down) => g.onKey({ code, key: k, repeat: false, preventDefault() {} }, down);
    g.start(); for (let i = 0; i < 5; i++) g.advance(1 / 60); r.draw(g); const R3 = r.race3d, car = R3.car, R = g.race; out.state = g.state;
    out.pod = !!car.userData.pod; out.inScene = car.parent === R3.scene; out.oldOut = !!R3.carModel && R3.carModel.parent !== R3.scene && !R3.carModel.userData.pod;
    const p0 = car.position.clone(), rot = car.rotation.clone(); car.position.set(0, 0, 0); car.rotation.set(0, 0, 0); car.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(car.userData.pic), all = new THREE.Box3(); car.traverse(o => { if (o.isMesh && o.material !== R3.carGlow && o.material !== R3.brakeLightMat) all.expandByObject(o); });
    out.size = [+(bb.max.x - bb.min.x).toFixed(2), +(bb.max.y).toFixed(2), +(bb.max.z - bb.min.z).toFixed(2)]; out.ground = +all.min.y.toFixed(3); out.nose = +bb.min.z.toFixed(2);
    // the colours of the shell: black low on the flank, blue glass on the canopy
    const shell = car.userData.pic.children[0], P = shell.geometry.attributes.position, Cc = shell.geometry.attributes.color, pick = (test) => { let n = 0, b = 0, d = 0; for (let i = 0; i < P.count; i++) if (test(P.getX(i), P.getY(i), P.getZ(i))) { n++; if (Cc.getZ(i) > 0.5 && Cc.getX(i) < 0.3) b++; if (Cc.getX(i) + Cc.getY(i) + Cc.getZ(i) < 0.4) d++; } return { n, blue: b, dark: d }; };
    out.canopy = pick((x, y, z) => y > 1.15 && z < 0); out.flank = pick((x, y, z) => y < 0.6); out.tris = P.count / 3;
    let glow = 0; car.traverse(o => { if (o.isMesh && o.material === Kit.materials().glow) glow += o.geometry.attributes.position.count / 3; }); out.glowTris = glow;
    car.position.copy(p0); car.rotation.copy(rot);
    for (let i = 0; i < 260; i++) g.advance(1 / 60); r.draw(g); out.follows = Math.abs(car.position.z + R.p.s) < 0.01 && Math.abs(car.position.x - R.p.x) < 0.01;
    key('ArrowUp', 'ArrowUp', true); for (let i = 0; i < 120; i++) g.advance(1 / 60); r.draw(g); out.light0 = car.userData.brakeLight.visible; key('ArrowUp', 'ArrowUp', false);
    key('KeyS', 's', true); for (let i = 0; i < 90; i++) g.advance(1 / 60); r.draw(g); r.draw(g); out.light = car.userData.brakeLight.visible && R3.brakeLightMat.opacity > 0.3; key('KeyS', 's', false);
    for (let i = 0; i < 600 && g.state === 'race'; i++) { g.advance(1 / 60); if (i % 20 === 0) r.draw(g); } out.after = g.state; out.s = Math.round(R.p.s);
    return out;
  });
  T('the race uses the pod car: the 3D model is in the race\'s scene, the earlier car is kept out of it', C.state === 'race' && C.pod && C.inScene && C.oldOut, JSON.stringify({ pod: C.pod, in: C.inScene, old: C.oldOut }));
  T('its size and stance (the sheet\'s pod): 1.9 m wide, 1.45 m high, 4.2 m long, its nose toward the race, its wheels on the ground', Math.abs(C.size[0] - 1.9) < 0.08 && Math.abs(C.size[1] - 1.45) < 0.03 && Math.abs(C.size[2] - 4.2) < 0.05 && C.nose < -2 && Math.abs(C.ground) < 0.03, JSON.stringify({ size: C.size, ground: C.ground }));
  T('the pieces of the sheet: blue glass over the cabin, a black shell below (' + C.tris + ' triangles), neon lines and blue hub caps that pulse with the race\'s lights', C.canopy.n > 50 && C.canopy.blue / C.canopy.n > 0.6 && C.flank.n > 100 && C.flank.dark / C.flank.n > 0.9 && C.flank.blue === 0 && C.glowTris > 100, JSON.stringify({ canopy: C.canopy, flank: C.flank, glow: C.glowTris }));
  T('it is driven as before: it follows the player along the track, the brake lights are off under power and on under the brake, and the race goes on', C.follows && C.light0 === false && C.light === true && C.s > 100 && pg.errs.length === 0, JSON.stringify({ follows: C.follows, light0: C.light0, light: C.light, s: C.s, after: C.after, errs: pg.errs.slice(0, 1) }));
  console.log('\n' + res.filter(Boolean).length + '/' + res.length + ' passed');
  await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(1); });
