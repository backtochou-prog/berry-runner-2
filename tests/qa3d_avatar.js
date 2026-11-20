// WAYFARER regression test: the avatar is BERRY (RunnerBerry, src3d/berry3d.js), the rigged 3D body rebuilt from the user's character sheet and animation blueprint (docs/berry/).
// Checks that it is the default everywhere (the earlier flat artwork and the earlier 3D model are gone), the blueprint's skeleton, its size and ground contact in every animation,
// the joint ranges, the run (lean, alternating legs, a foot on the ground), the jump's three phases and the landing, the crouch under the gates, the vehicles' stance, the 3D body's
// heading, the 2D game's sprite, and that nothing leaks.
//
// Run:  node tests/qa3d_avatar.js     (needs playwright-core and a Chromium: CHROMIUM=/path/to/chrome, NODE_PATH or PW_CORE as for the other tests)
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright-core')); } catch (e) { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
const ROOT = path.join(__dirname, '..'), PORT = 8116;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const res = []; const T = (n, ok, i = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== '' ? '  [' + i + ']' : '')); };

(async () => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || require('./_chromium')(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async url => { const pg = await (await b.newContext({ viewport: { width: 480, height: 270 } })).newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => m.type() === 'error' && pg.errs.push(m.text())); await pg.addInitScript(() => { window.__keepOver = true; }); await pg.goto(url, { timeout: 90000 }); await pg.waitForFunction(() => window.__wf, null, { timeout: 90000 }); await pg.waitForTimeout(700); return pg; };

  // ---------------------------------------------------------------- 1. Berry is the avatar; its skeleton; its poses
  const pg = await open(process.env.TEST_URL || 'http://localhost:' + PORT + '/');
  const A = await pg.evaluate(() => {
    const g = __wf, r = g.r, rn = r.runner, out = {};
    out.cls = rn.constructor.name; out.base = rn instanceof RunnerSprite; out.old = [typeof Runner3D, typeof AVATAR_ASSETS]; out.tris = rn.tris; out.seeds = rn.seeds; out.art = typeof BERRY_ASSETS !== 'undefined' && /^data:image/.test(BERRY_ASSETS.front);
    out.bones = BERRY_RIG.BONES.filter(n => !rn.bones[n]); const par = n => rn.bones[n].parent.name;
    out.chain = [par('Hips'), par('Spine_01'), par('Spine_02'), par('Spine_03'), par('Neck'), par('Head'), par('Arm_L'), par('Forearm_L'), par('Hand_L'), par('Leg_R'), par('Calf_R'), par('Foot_R'), par('Shoulder_R')].join('>');
    const st = o => Object.assign({ time: 3, runRate: 2.6, airborne: false, vy: 0, sliding: false, lean: 0, state: 'play', beat: 0 }, o);
    const box = o => { rn.group.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o || rn.pivot); return { top: +bb.max.y.toFixed(2), bottom: +bb.min.y.toFixed(2), half: +Math.max(-bb.min.x, bb.max.x).toFixed(2) }; };
    const feet = () => { rn.group.updateMatrixWorld(true); return Math.min(...rn.foot.map(f => new THREE.Box3().setFromObject(f).min.y)); };
    const L = BERRY_RIG.LIMITS, lim = { ok: true, worst: '' }, check = () => { const v = rn.limited, e = 1e-6, bad = (v.hip.some(x => Math.abs(x) > L.hip + e) && 'hip') || (v.knee.some(x => x < -e || x > L.knee[1] + e) && 'knee') || (v.ankle.some(x => Math.abs(x) > L.ankle + e) && 'ankle') || (v.elbow.some(x => x < -e || x > L.elbow[1] + e) && 'elbow') || (v.shoulder.some(x => Math.abs(x) > L.shoulder + e) && 'shoulder') || (Math.abs(v.head[0]) > L.headPitch + 0.03 && 'headPitch') || (Math.abs(v.head[1]) > L.headYaw + e && 'headYaw') || (Math.abs(v.head[2]) > L.headRoll + e && 'headRoll'); if (bad) { lim.ok = false; lim.worst = bad; } };
    const run = (n, o) => { for (let i = 0; i < n; i++) { rn.update(1 / 60, st(Object.assign({}, o, o && o.time0 !== undefined ? { time: o.time0 + i / 60 } : {}))); check(); } };
    const pose = (name, o, n = 90) => { rn.group.position.set(0, 0, 0); rn.group.rotation.y = 0; run(n, o); out[name] = Object.assign(box(), { anim: rn.anim }); };
    rn.ride = 0; pose('title', { state: 'title', time: 1 }); out.title.feet = +feet().toFixed(3);
    // RUN: sampled over two strides
    rn.group.position.set(0, 0, 0); run(60, {}); const R = { lean: [], feet: [], hipL: [], hipR: [], top: [], hipY: [] }, up = new THREE.Vector3();
    for (let i = 0; i < 60; i++) { run(1, {}); rn.group.updateMatrixWorld(true); up.set(0, 1, 0).transformDirection(rn.bones.Spine_03.matrixWorld); R.lean.push(Math.atan2(-up.z, up.y)); R.feet.push(feet()); R.hipL.push(rn.limited.hip[0]); R.hipR.push(rn.limited.hip[1]); R.top.push(box().top); R.hipY.push(rn.hipY); }
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    out.run = { anim: rn.anim, lean: +(avg(R.lean) * 180 / Math.PI).toFixed(1), feetMin: +Math.min(...R.feet).toFixed(3), feetMax: +Math.max(...R.feet).toFixed(3), swing: +(Math.max(...R.hipL) - Math.min(...R.hipL)).toFixed(2), opposed: +avg(R.hipL.map((v, i) => v * R.hipR[i])).toFixed(3), bounce: +(Math.max(...R.hipY) - Math.min(...R.hipY)).toFixed(3), top: +Math.max(...R.top).toFixed(2) };
    // JUMP: takeoff for 4 frames, the tuck while rising, the reach while falling; LAND for 6 frames after the touchdown, then the run again
    const J = []; run(2, { airborne: true, vy: 5 }); J.push(rn.anim); run(4, { airborne: true, vy: 5 }); J.push(rn.anim); run(20, { airborne: true, vy: 3 }); out.air = Object.assign(box(), { feet: +feet().toFixed(2) }); run(10, { airborne: true, vy: -3 }); J.push(rn.anim);
    run(1, {}); J.push(rn.anim); let landFrames = 1; while (landFrames < 30) { run(1, {}); if (rn.anim !== 'land') break; landFrames++; } J.push(rn.anim); out.jump = { seq: J.join('>'), landFrames };
    // CROUCH (the game's slide): down within 8 frames, under the 1.05 m gates, feet on the ground; up again
    run(8, { sliding: true }); out.crouch8 = box().top; pose('crouch', { sliding: true }, 40); out.crouch.feet = +feet().toFixed(3); out.crouch.hip = +rn.hipY.toFixed(2); run(40, {}); out.up = box().top;
    // TURN: the body rolls and the head looks into the turn (to +x for lean > 0)
    run(40, { lean: 1 }); out.turn = { roll: +rn.bones.Hips.rotation.z.toFixed(2), head: +rn.bones.Head.rotation.y.toFixed(2) }; run(30, {});
    // the vehicles: a stance, not a run
    run(120, { scooter: true, vehicle: 'scooter' }); out.scooter = { anim: rn.anim, ride: +rn.ride.toFixed(2), vis: rn.scooter.visible, armsFwd: rn.limited.shoulder[0] > 0.8 && rn.limited.shoulder[1] > 0.8 }; run(60, { scooter: true, vehicle: 'board' }); out.board = { anim: rn.anim, side: +rn.pose.side.toFixed(2) }; run(120, {}); out.off = { anim: rn.anim, ride: +rn.ride.toFixed(2) };
    pose('over', { state: 'over' }); pose('wave', { state: 'title', time0: 2.2 }, 60); pose('dance', { state: 'title', time0: 5.6 }, 60);
    // a 3D body keeps the heading of its group: its visor (the Head's -z) points where the group points, whatever faceYaw says
    out.heading = [0, 0.4, -0.5, Math.PI].map(yaw => { rn.group.rotation.y = yaw; run(40, { faceYaw: 0.7 }); rn.group.updateMatrixWorld(true); const f = new THREE.Vector3(0, 0, -1).transformDirection(rn.bones.Hips.matrixWorld); return +(f.x * -Math.sin(yaw) + f.z * -Math.cos(yaw)).toFixed(2); });
    rn.group.rotation.y = 0; const before = JSON.stringify(rn.pose); rn.update(1 / 60, st({ state: 'pause', time: 9 })); out.pauseHolds = before === JSON.stringify(rn.pose);
    out.limits = lim; out.pivotVisible = rn.pivot.visible;
    return out;
  });
  T('the avatar is BERRY: RunnerBerry (a RunnerSprite, so it rides the vehicles), ' + A.tris + ' triangles, ' + A.seeds + ' seeds; the earlier flat artwork and the earlier 3D model are gone; its picture for the panels is embedded', A.cls === 'RunnerBerry' && A.base && A.old.every(t => t === 'undefined') && A.tris > 6000 && A.tris < 30000 && A.seeds >= 30 && A.art, JSON.stringify({ cls: A.cls, old: A.old, tris: A.tris }));
  T('the blueprint\'s skeleton: every bone, in its hierarchy (Root > Hips > Spine_01 > Spine_02 > Spine_03 > Neck > Head; Shoulder > Arm > Forearm > Hand; Leg > Calf > Foot)', A.bones.length === 0 && A.chain === 'Root>Hips>Spine_01>Spine_02>Spine_03>Neck>Shoulder_L>Arm_L>Forearm_L>Hips>Leg_R>Calf_R>Spine_03', JSON.stringify({ missing: A.bones, chain: A.chain }));
  T('standing (the menu\'s idle): about 1.9 m to the top of the leaves, feet on the ground, about 1 m wide with the arms', A.title.anim === 'idle' && A.title.top >= 1.85 && A.title.top <= 2.02 && Math.abs(A.title.feet) <= 0.02 && A.title.half >= 0.4 && A.title.half <= 0.65, JSON.stringify(A.title));
  T('RUN: a forward lean of 15-20 degrees (' + A.run.lean + '), the legs swing against each other, the lower foot stays on the ground, the stride makes the bounce', A.run.anim === 'run' && A.run.lean >= 13 && A.run.lean <= 21 && A.run.swing > 0.8 && A.run.opposed < -0.05 && A.run.feetMin > -0.035 && A.run.feetMax < 0.05 && A.run.bounce > 0.02 && A.run.bounce < 0.16, JSON.stringify(A.run));
  T('JUMP in three phases (takeoff 4 frames > air > fall), then LAND for about 6 frames, then the run again', A.jump.seq === 'takeoff>air>fall>land>run' && A.jump.landFrames >= 5 && A.jump.landFrames <= 8 && A.air.top > 1.5, JSON.stringify({ jump: A.jump, air: A.air }));
  T('CROUCH: low within 8 frames, under the 1.05 m gates, the centre of mass about half as high, feet on the ground; up again after', A.crouch.anim === 'crouch' && A.crouch8 <= 1.3 && A.crouch.top <= 1.05 && A.crouch.hip <= 0.62 * 0.62 && Math.abs(A.crouch.feet) <= 0.04 && A.up >= 1.8, JSON.stringify({ crouch8: A.crouch8, crouch: A.crouch, up: A.up }));
  T('TURN: the body rolls into the turn and the head looks into it', A.turn.roll < -0.08 && A.turn.head < -0.2, JSON.stringify(A.turn));
  T('on the scooter it stands with its hands forward on the bar, on the board it stands sideways; off again, it runs', A.scooter.anim === 'ride' && A.scooter.ride > 0.9 && A.scooter.vis && A.scooter.armsFwd && A.board.anim === 'ride' && A.board.side > 0.8 && A.off.anim === 'run' && A.off.ride < 0.1, JSON.stringify({ scooter: A.scooter, board: A.board, off: A.off }));
  T('a crash tips it forward onto the ground (lower than 1.5 m); the menu\'s wave and dance keep it standing', A.over.anim === 'trip' && A.over.top < 1.5 && A.over.bottom > -0.15 && A.wave.anim === 'wave' && A.wave.top > 1.85 && A.dance.anim === 'dance' && A.dance.bottom > -0.04, JSON.stringify({ over: A.over, wave: A.wave, dance: A.dance }));
  T('every joint stayed inside the blueprint\'s ranges in all of the above (head, shoulder, elbow, hip, knee, ankle)', A.limits.ok, JSON.stringify(A.limits));
  T('a 3D body: it keeps the heading of its group whatever the camera\'s direction; a pause holds the pose', A.heading.every(v => v > 0.98) && A.pauseHolds, JSON.stringify({ heading: A.heading, pause: A.pauseHolds }));

  // ---------------------------------------------------------------- 2. a real run: no errors, nothing leaks
  const Lk = await pg.evaluate(() => {
    const g = __wf, r = g.r; g.start(); g.world.items = [];
    const hazardFree = () => { g.world.items = g.world.items.filter(i => i.kind === 'coin' || i.kind === 'prop'); };
    for (let f = 0; f < 30; f++) { g.advance(1 / 60); r.draw(g); }
    const rn = r.runner, kids0 = r.scene.children.length, count = () => { let n = 0; rn.group.traverse(() => n++); return n; }, own0 = count(), anims = new Set();
    for (let f = 0; f < 1500 && g.state === 'play'; f++) { if (f % 20 === 0) hazardFree(); if (f === 300) g.jump(); if (f === 500) g.slideKey(); if (f === 700) g.keys.left = true; if (f === 760) g.keys.left = false; g.advance(1 / 60); const near = (f >= 298 && f < 380) || (f >= 498 && f < 520); if (near || f % 15 === 0) { r.draw(g); anims.add(rn.anim); } }      // (the body is posed when a frame is drawn: every frame round the jump and the slide)
    r.draw(g); return { state: g.state, kids: [kids0, r.scene.children.length], own: [own0, count()], anims: [...anims].sort().join(), inScene: rn.group.parent === r.scene };
  });
  T('25 s of play (a jump, a slide, a turn): the run, the takeoff, the air, the fall, the landing and the crouch are all played; the scene and the body keep their size', Lk.state === 'play' && Lk.inScene && Lk.kids[0] === Lk.kids[1] && Lk.own[0] === Lk.own[1] && ['run', 'takeoff', 'air', 'fall', 'land', 'crouch'].every(a => Lk.anims.split(',').includes(a)), JSON.stringify(Lk));
  T('no JS errors in the session', pg.errs.length === 0, pg.errs.slice(0, 2).join('|'));
  await pg.context().close();                                   // close it: a page left running keeps drawing and slows every page opened after it (software GL)

  // ---------------------------------------------------------------- 3. file:// and the 2D game
  if (!process.env.TEST_URL) {
    const pf = await open('file://' + path.join(ROOT, 'index.html'));
    const F = await pf.evaluate(() => ({ cls: __wf.r.runner.constructor.name }));
    T('works from file:// (nothing to fetch)', F.cls === 'RunnerBerry' && pf.errs.length === 0, JSON.stringify({ ...F, errs: pf.errs.slice(0, 1) }));
    await pf.context().close();
    const p2 = await open('http://localhost:' + PORT + '/2d.html');
    const S = await p2.evaluate(() => { const px = (spr, x, y) => [...spr.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3).join(); return { red: px(SPR.run1, 4, 4), green: px(SPR.run1, 5, 1), beige: px(SPR.run1, 4, 8), slide: SPR.slide.width + 'x' + SPR.slide.height }; });
    T('the 2D game\'s sprite is Berry too (a green calyx on a red helmet, a beige hoodie)', S.red === '238,32,38' && S.green === '74,224,44' && S.beige === '248,226,196' && p2.errs.length === 0, JSON.stringify(S));
  }
  console.log('\n' + res.filter(Boolean).length + '/' + res.length + ' passed');
  await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(1); });
