// RunnerBerry: BERRY, the player avatar, rebuilt from the user's two sheets (docs/berry/berry-character-sheet.png and docs/berry/berry-animation-blueprint.png):
//   - THE CHARACTER SHEET ("3D Game Character, Reimagined Design, No Electronic Eyes"): a strawberry HELMET for a head (red, yellow seeds, a green calyx of leaves, one glossy black wraparound
//     visor with a neon rim and no eyes, dark side panels, a black lower band with a yellow line), a puffy beige HOODIE quilted in horizontal rolls with thin pink stripes, a big pink star on
//     the chest and a smaller one on the back, a hood, two drawstrings with metal tips and a pink ribbed hem, a black cross-body STRAP and a belt BAG (a strawberry badge, a pink star, hanging
//     star charms), red mitten hands, navy leggings fading to lilac at the ankles, chunky black SNEAKERS with pink laces, pink soles and a cream midsole.
//   - THE ANIMATION BLUEPRINT: a humanoid biped rig with the sheet's hierarchy (Root > Hips > Spine_01 > Spine_02 > Spine_03 > Neck > Head, Shoulder > Arm > Forearm > Hand, Leg > Calf > Foot;
//     the helmet, the hoodie, the bag and the straps are child pieces of their bones), its JOINT RANGES (BERRY_RIG.LIMITS, clamped every frame), its animation sets (Idle loop with breathing and
//     a weight shift; Run loop with a 15-20 degree forward lean, energetic and bouncy; Jump in three phases: takeoff 4 frames, airborne / apex, landing 6 frames; Crouch down / hold / up in
//     8 frames, lowering the centre of mass by about half; Turn left / right; Land; Start / Stop; Emote: wave, cheer), its timings (BERRY_RIG.TIMING, at 60 fps) and the optional
//     follow-through physics of the hood, the bag, the drawstrings, the charms and the leaves (light damped springs driven by the body's own accelerations).
// It extends RunnerSprite (the base that carries the vehicles: scooter, e-bike, board, surfboard) and has the same interface (group, shadow, pivot, update(dt, state), cur), so the renderer,
// the vehicles, the stunts and the tests treat it like the other runners. A true 3D body: it keeps the heading of its group, and in the menu it shows its front while the camera drifts round it.
// Facing -Z like every runner (the chase camera, at +Z, sees its back: the hood, the back star, the strap). Its right hand is at +X. Metres; 1.9 m from the soles to the top of the leaves.
const BERRY_RIG = {
  // the blueprint's "Joint Movement Ranges" (radians)
  LIMITS: { headYaw: 60 * Math.PI / 180, headPitch: 40 * Math.PI / 180, headRoll: 20 * Math.PI / 180, shoulder: 90 * Math.PI / 180, elbow: [0, 150 * Math.PI / 180], hip: 60 * Math.PI / 180, knee: [0, 150 * Math.PI / 180], ankle: 45 * Math.PI / 180 },
  // the blueprint's "Timing & Feel" (seconds; frames at 60 fps): takeoff 4 f, landing 6 f, crouch down / up 8 f, turn 4-8 f, idle loop 2-4 s
  TIMING: { takeoff: 4 / 60, land: 6 / 60, crouch: 8 / 60, turn: 6 / 60, idle: 3 },
  LEAN: 17 * Math.PI / 180,                                       // the run's forward lean (15-20 degrees)
  HIP: 0.62, THIGH: 0.21, CALF: 0.23, SOLE: 0.18,                 // the legs: hip height at rest, thigh, calf, ankle above the ground
  BONES: ['Root', 'Hips', 'Spine_01', 'Spine_02', 'Spine_03', 'Neck', 'Head', 'Shoulder_L', 'Arm_L', 'Forearm_L', 'Hand_L', 'Shoulder_R', 'Arm_R', 'Forearm_R', 'Hand_R', 'Leg_L', 'Calf_L', 'Foot_L', 'Leg_R', 'Calf_R', 'Foot_R'],
};
class RunnerBerry extends RunnerSprite {
  constructor() {
    super();
    const RED = '#ee2026', RED_L = '#ff5a3c', BLACK = '#0a0a10', BEIGE = '#f8e2c4', BEIGE_D = '#ecc9a2', PINK = '#ff4f9e', PINK_L = '#ff8cc4', NAVY = '#16227a', LILAC = '#cdb6ff', GREEN = '#4ae02c', GREEN_D = '#27a81e', YEL = '#ffd23a', CREAM = '#fff0dc', STEEL = '#c9ccd6', CYAN = '#35e6ff';
    const R0 = BERRY_RIG, mats = Kit.materials();
    // glossy, smooth-shaded materials: a Phong sheen like the sheet's renders (vertex colours; the thin leaves are two-sided)
    const gloss = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x555555 }), shiny = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 140, specular: 0xaaaaaa }), leafMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x333333, side: THREE.DoubleSide });
    for (const m of [gloss, shiny, leafMat]) { m.customProgramCacheKey = () => 'berry-lift'; m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * 0.36;\n#endif'); }; }   // its own colours kept bright in every biome's light (the night streets too)
    this.mats = { gloss, shiny, leaf: leafMat };
    const smooth = geo => {                                         // normals averaged over the vertices that share a place: round, not faceted
      const P = geo.attributes.position.array, N = geo.attributes.normal.array, acc = new Map(), key = i => Math.round(P[i] * 2e3) + ',' + Math.round(P[i + 1] * 2e3) + ',' + Math.round(P[i + 2] * 2e3);
      for (let i = 0; i < P.length; i += 3) { const k = key(i); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]); a[0] += N[i]; a[1] += N[i + 1]; a[2] += N[i + 2]; }
      for (let i = 0; i < P.length; i += 3) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; N[i] = a[0] / l; N[i + 1] = a[1] / l; N[i + 2] = a[2] / l; }
    };
    this.tris = 0;
    const mesh = (parts, mat) => {
      for (const p of parts) if (!p.glow && !p.flat) smooth(p.geo);
      const m = Kit.merge(parts), g = new THREE.Group();
      if (m.lit) { g.add(new THREE.Mesh(m.lit, mat || gloss)); this.tris += m.lit.attributes.position.count / 3; } if (m.glow) { g.add(new THREE.Mesh(m.glow, mats.glow)); this.tris += m.glow.attributes.position.count / 3; }
      return g;
    };
    const bone = (name, parent, x, y, z) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); this.bones[name] = g; return g; };
    const from = pos => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
    const col = (part, color, o = {}) => Object.assign(part, { color }, o);
    const G = (part, bottom, pow) => (part.grad = bottom, part.gradPow = pow || 1, part);            // vertical gradient: the part's colour on top, `bottom` underneath
    const flat = part => (part.flat = true, part);
    // a band of a surface of revolution about the y axis: radius R(y, f) (f = the angle from the FRONT, toward the character's left... x = r sin f, z = -r cos f), between a bottom and a top
    // edge (constants or functions of f), over the angles f0..f1, inflated by `infl`, squeezed front-to-back by `dz`; caps close it; the triangles are wound to face away from its axis
    const surf = (R, y0, y1, o = {}) => {
      const rows = o.rows || 8, segs = o.segs || 24, f0 = o.f0 === undefined ? 0 : o.f0, f1 = o.f1 === undefined ? Math.PI * 2 : o.f1, dz = o.dz || 1, infl = o.infl || 0, pos = [];
      const ya = f => typeof y0 === 'function' ? y0(f) : y0, yb = f => typeof y1 === 'function' ? y1(f) : y1;
      const pt = (i, j) => { const f = f0 + (f1 - f0) * i / segs, y = ya(f) + (yb(f) - ya(f)) * j / rows, r = Math.max(0, R(y, f) + infl); return new THREE.Vector3(r * Math.sin(f), y, -r * dz * Math.cos(f)); };
      const yc = o.yc === undefined ? (ya((f0 + f1) / 2) + yb((f0 + f1) / 2)) / 2 : o.yc, cen = new THREE.Vector3(0, yc, 0);
      const tri = (a, b, c) => {
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)), m = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3).sub(cen);
        if (n.lengthSq() < 1e-14) return; if (n.dot(m) < 0) { const t = b; b = c; c = t; }
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      };
      for (let j = 0; j < rows; j++) for (let i = 0; i < segs; i++) { const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1); tri(a, b, c); tri(a, c, d); }
      if (o.capBot) { const c = new THREE.Vector3(0, ya(0), 0); for (let i = 0; i < segs; i++) tri(c, pt(i, 0), pt(i + 1, 0)); }
      if (o.capTop) { const c = new THREE.Vector3(0, yb(0), 0); for (let i = 0; i < segs; i++) tri(c, pt(i, rows), pt(i + 1, rows)); }
      return { geo: from(pos), color: o.color || '#ffffff', glow: !!o.glow };
    };
    // a flat drawing laid on such a surface: triangles given in (u, v) metres about (fc, yc), u along the surface, each cut in 16 so it follows the curve
    const decal = (tris, R, fc, yc, o = {}) => {
      const dz = o.dz || 1, infl = o.infl || 0, r0 = R(yc, fc) + infl, pos = [];
      const lift = (u, v) => { const f = fc + u / r0, y = yc + v, r = R(y, f) + infl; return new THREE.Vector3(r * Math.sin(f), y, -r * dz * Math.cos(f)); };
      const cen = new THREE.Vector3(0, yc, 0);
      const put = (a, b, c) => { const A = lift(...a), B = lift(...b), C = lift(...c), n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)), m = new THREE.Vector3().add(A).add(B).add(C).divideScalar(3).sub(cen); const [p, q] = n.dot(m) < 0 ? [C, B] : [B, C]; pos.push(A.x, A.y, A.z, p.x, p.y, p.z, q.x, q.y, q.z); };
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const cut = (a, b, c, n) => { if (!n) return put(a, b, c); const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); cut(a, ab, ca, n - 1); cut(ab, b, bc, n - 1); cut(ca, bc, c, n - 1); cut(ab, bc, ca, n - 1); };
      for (const [a, b, c] of tris) cut(a, b, c, o.cut === undefined ? 2 : o.cut);
      return { geo: from(pos), color: o.color || '#ffffff', glow: !!o.glow, gain: o.gain };
    };
    const star2 = (ro, ri, rot = 0) => { const O = []; for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5 + rot, r = k % 2 ? ri : ro; O.push([Math.cos(a) * r, Math.sin(a) * r]); } return O.map((p, k) => [[0, 0], p, O[(k + 1) % 10]]); };
    // a small flat five-pointed star standing in a plane (facing -z by default; ry turns it), for the bag, the charms, the shoes
    const starFlat = (x, y, z, ro, color, o = {}) => {
      const pos = []; for (const [a, b, c] of star2(ro, ro * 0.42, o.rot || 0)) pos.push(a[0], a[1], 0, c[0], c[1], 0, b[0], b[1], 0, a[0], a[1], 0, b[0], b[1], 0, c[0], c[1], 0);      // (both sides)
      const g = from(pos); g.applyMatrix4(new THREE.Matrix4().makeRotationY(o.ry || 0)); g.translate(x, y, z); return { geo: g, color, glow: o.glow !== false, flat: true };
    };
    const raw = (geo, color, m, o = {}) => { geo.applyMatrix4(m); const g = geo.toNonIndexed(); geo.dispose(); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.computeVertexNormals(); return Object.assign({ geo: g, color, glow: false }, o); };
    const M4 = (px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const lerpPts = pts => y => { if (y <= pts[0][0]) return pts[0][1]; for (let k = 1; k < pts.length; k++) if (y <= pts[k][0]) { const t = (y - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]), e = t * t * (3 - 2 * t); return pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * e; } return pts[pts.length - 1][1]; };

    // ---------------------------------------------------------------- the skeleton (the blueprint's hierarchy)
    this.bones = {};
    const HIP = R0.HIP, A = y => y - HIP;                              // absolute height (soles = 0) -> the hips' own coordinates
    this.rig = bone('Root', this.pivot, 0, 0, 0);
    const hips = bone('Hips', this.rig, 0, HIP, 0), sp1 = bone('Spine_01', hips, 0, 0, 0), sp2 = bone('Spine_02', sp1, 0, 0.16, 0), sp3 = bone('Spine_03', sp2, 0, 0.18, 0), neck = bone('Neck', sp3, 0, A(1.1) - 0.34, 0), head = bone('Head', neck, 0, 0.03, 0);
    const S2 = y => A(y) - 0.16, S3 = y => A(y) - 0.34;                // ... -> Spine_02's and Spine_03's coordinates

    // ---------------------------------------------------------------- THE HELMET (Head): a strawberry, widest a little above its middle, 0.8 m across and 0.75 m tall
    const HC = 0.27, HH = 0.375, HB = 0.3, HR = 0.4, HDZ = 0.95;       // (HB: the helmet is cut flat 0.3 under its centre, where it sits in the collar)               // the head's centre above the Head bone, its half height, its radius, its depth
    const headR = y => { const t = Math.min(1, Math.abs(y - HC) / HH); return HR * Math.sqrt(Math.max(0, 1 - Math.pow(t, y < HC ? 4 : 2.5))) * (1 + 0.07 * (y - HC) / HH); };
    const hd = [];
    hd.push(G(col(surf(headR, HC - HB, HC + HH, { rows: 26, segs: 36, dz: HDZ, yc: HC }), RED_L, { gain: 1.25 }), RED, 2.2));                        // the red berry (a warm glare on its crown)
    // the visor: ONE glossy black lens wrapped round the front (no eyes), a rounded band 72 degrees either side, a yellow neon line along its top and a pink one along its bottom
    const VF = 1.26, vTop = f => HC + 0.015 + 0.135 * Math.sqrt(Math.max(0, 1 - Math.pow(f / VF, 4))), vBot = f => HC + 0.015 - 0.12 * Math.sqrt(Math.max(0, 1 - Math.pow(f / VF, 6)));
    const vis = [G(col(surf(headR, vBot, vTop, { rows: 8, segs: 30, f0: -VF, f1: VF, dz: HDZ, infl: 0.014, yc: HC }), '#232a5c'), BLACK, 0.6)];
    vis.push(col(Kit.ico(0.03, -0.17, HC + 0.085, -0.376, '#cfe0ff', { sx: 2.4, sy: 0.7, sz: 0.2, detail: 1, rz: 0.25, ry: 0.42, glow: true }), '#cfe0ff'));           // the glare on the lens
    hd.push(col(surf(headR, vTop, f => vTop(f) + 0.012, { rows: 1, segs: 30, f0: -VF - 0.02, f1: VF + 0.02, dz: HDZ, infl: 0.016, yc: HC, glow: true }), YEL));
    hd.push(col(surf(headR, f => vBot(f) - 0.012, vBot, { rows: 1, segs: 30, f0: -VF - 0.02, f1: VF + 0.02, dz: HDZ, infl: 0.016, yc: HC, glow: true }), '#ff3d7a'));
    for (const s of [-1, 1]) hd.push(G(col(surf(headR, HC - 0.12, HC + 0.13, { rows: 4, segs: 8, f0: s * 1.36, f1: s * 1.98, dz: HDZ, infl: 0.014, yc: HC }), '#1a2050'), BLACK));   // the dark side panels
    hd.push(col(surf(headR, HC - HB, HC - 0.205, { rows: 4, segs: 36, dz: HDZ, infl: 0.01, yc: HC, capBot: true }), BLACK));                    // the black lower band (the chin and the nape)
    hd.push(col(surf(headR, HC - 0.205, HC - 0.192, { rows: 1, segs: 36, dz: HDZ, infl: 0.014, yc: HC, glow: true }), YEL));                      // its yellow line
    hd.push(col(surf(headR, HC - 0.262, HC - 0.252, { rows: 1, segs: 36, dz: HDZ, infl: 0.014, yc: HC, glow: true }), '#ff3d7a'));               // and a thin pink one under it
    {                                                                                                                                             // the seeds: yellow drops scattered over the red (a fixed sequence), none on the lens or the panels
      let seed = 41; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, placed = []; let tries = 0;
      while (placed.length < 46 && tries++ < 3000) {
        let f = rnd() * Math.PI * 2; if (f > Math.PI) f -= Math.PI * 2; const y = HC - 0.17 + rnd() * 0.47, af = Math.abs(f);
        if (af < VF + 0.1 && y < vTop(Math.min(af, VF)) + 0.04 && y > vBot(Math.min(af, VF)) - 0.04) continue; if (af > 1.28 && af < 2.06 && y > HC - 0.16 && y < HC + 0.17) continue;
        const r = headR(y) + 0.004, x = r * Math.sin(f), z = -r * HDZ * Math.cos(f); if (placed.some(q => (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2 < 0.105 * 0.105)) continue;
        placed.push([x, y, z]); hd.push(Kit.ico(0.014 + rnd() * 0.005, x, y, z, '#ffcf2e', { sy: 1.5, sz: 0.5, detail: 0, ry: -f, rz: (rnd() - 0.5) * 0.8, glow: true }));
      }
      this.seeds = placed.length;
    }
    head.add(mesh(hd)); head.add(mesh(vis, shiny));
    // the calyx: eight long leaves fanning from the crown and lying over the dome, their tips lifting, five short ones standing in the middle, and the stem. Its own piece (it flops).
    const yDome = d => HC + HH * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, d / HR), 2)), 1 / 2.5);
    const leaf = (psi, len, w0, up) => {
      const N = 8, L = [], C = [], Rr = [], pos = [], side = new THREE.Vector3(-Math.sin(psi), 0, Math.cos(psi));
      for (let k = 0; k <= N; k++) { const u = k / N, d = 0.012 + len * u, y = yDome(d * 0.96) + 0.012 + up * u + 0.07 * u * u * u, w = w0 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.8) + 0.004 * (1 - u), c = new THREE.Vector3(d * Math.cos(psi), y, d * HDZ * Math.sin(psi));
        C.push(c.clone().setY(y + 0.014 * Math.sin(Math.PI * u))); L.push(c.clone().addScaledVector(side, -w)); Rr.push(c.clone().addScaledVector(side, w)); }
      const tri = (a, b, c) => { const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)); if (n.y < 0) { const t = b; b = c; c = t; } pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); };
      for (let k = 0; k < N; k++) { tri(L[k], C[k], C[k + 1]); tri(L[k], C[k + 1], L[k + 1]); tri(C[k], Rr[k], Rr[k + 1]); tri(C[k], Rr[k + 1], C[k + 1]); }
      return { geo: from(pos), color: GREEN, glow: false, gain: 1.25 };
    };
    const lv = []; for (let i = 0; i < 8; i++) lv.push(leaf(i * Math.PI / 4 + 0.25, i % 2 ? 0.31 : 0.39, i % 2 ? 0.1 : 0.125, 0));
    for (let i = 0; i < 5; i++) lv.push(col(leaf(i * Math.PI * 2 / 5 + 0.9, 0.17, 0.075, 0.11), '#6cf03a'));
    lv.push(col(Kit.cyl(0.018, 0.026, 0.07, 0, HC + HH + 0.005, 0, GREEN_D, { seg: 8, rz: 0.15 }), GREEN_D));
    this.leaves = new THREE.Group(); this.leaves.position.y = HC + HH; const lm = mesh(lv, leafMat); lm.position.y = -(HC + HH); this.leaves.add(lm); head.add(this.leaves);

    // ---------------------------------------------------------------- THE HOODIE (Spine_02): quilted in horizontal rolls, a pink stripe in every groove, a pink ribbed hem, stars front and back
    const JDZ = 0.86, P0 = 0.575, PH = 0.09, NP = 6;                   // six rolls from the hem's top (0.575) to the shoulders (1.115)
    const jBase = lerpPts([[0.5, 0.285], [0.6, 0.335], [0.8, 0.36], [1.0, 0.335], [1.1, 0.27], [1.18, 0.15]]);
    const jR = y => jBase(y + HIP + 0.16) + (y + HIP + 0.16 > P0 && y + HIP + 0.16 < P0 + NP * PH ? 0.017 * Math.sqrt(Math.abs(Math.sin(Math.PI * (y + HIP + 0.16 - P0) / PH))) : 0);   // (in Spine_02's coordinates)
    const jk = [];
    jk.push(G(col(surf(jR, S2(P0), S2(1.18), { rows: 44, segs: 30, dz: JDZ, capTop: true }), BEIGE, { gain: 1.12 }), BEIGE_D, 0.8));
    jk.push(G(col(surf(jR, S2(0.5), S2(P0), { rows: 3, segs: 30, dz: JDZ, infl: 0.006, capBot: true }), PINK), '#d92f7c'));                      // the pink hem
    for (let k = 1; k < NP; k++) jk.push(col(surf(jR, S2(P0 + k * PH - 0.006), S2(P0 + k * PH + 0.006), { rows: 1, segs: 30, dz: JDZ, infl: 0.007 }), PINK_L, { gain: 1.1 }));   // the pink stripes in the grooves
    jk.push(col(decal(star2(0.175, 0.074, 0.06), jR, -0.06, S2(0.87), { dz: JDZ, infl: 0.024 }), PINK, { gain: 1.15 }));                           // the big pink star on the chest
    jk.push(col(decal(star2(0.085, 0.036, 0.06), jR, -0.06, S2(0.87), { dz: JDZ, infl: 0.027, cut: 1 }), PINK_L, { gain: 1.15 }));
    jk.push(col(decal(star2(0.135, 0.06), jR, Math.PI, S2(0.86), { dz: JDZ, infl: 0.024 }), '#e02a44'));                                          // the back star: pink in a red outline
    jk.push(col(decal(star2(0.098, 0.043), jR, Math.PI, S2(0.86), { dz: JDZ, infl: 0.027, cut: 1 }), PINK, { gain: 1.15 }));
    jk.push(col(raw(new THREE.TorusGeometry(0.165, 0.05, 8, 24), BEIGE, M4(0, S2(1.165), 0.01, Math.PI / 2, 0, 0, 1, 1, 0.8)), BEIGE, { gain: 1.1 }));      // the collar roll round the neck
    // the black cross-body strap (over the RIGHT shoulder, down to the LEFT hip, round the back) and the belt that carries the bag
    jk.push(col(raw(new THREE.TorusGeometry(0.392, 0.02, 6, 36), BLACK, M4(-0.045, S2(0.875), 0, 0, 0, 0.7).multiply(M4(0, 0, 0, Math.PI / 2, 0, 0, 1, 0.86, 1))), '#15151c'));
    jk.push(col(surf(jR, S2(0.6), S2(0.635), { rows: 1, segs: 30, dz: JDZ, infl: 0.012 }), '#15151c'));
    jk.push(flat(Kit.box(0.05, 0.035, 0.02, 0.2, S2(1.04), -0.262, STEEL, { rz: 0.7, ry: -0.5 })));                                               // its buckle on the chest
    for (const s of [-1, 1]) jk.push(col(Kit.ico(0.014, s * 0.085, S2(1.115), -0.238, STEEL, { detail: 0 }), STEEL));                            // the drawstrings' eyelets
    sp2.add(mesh(jk));
    // the hood, hanging behind the neck (its own piece: it bounces)
    this.hood = new THREE.Group(); this.hood.position.set(0, S2(1.16), 0.12);
    this.hood.add(mesh([G(col(Kit.ico(0.2, 0, -0.03, 0.12, BEIGE, { sx: 1.25, sy: 0.55, sz: 0.7, detail: 2, rx: 0.35 }), BEIGE, { gain: 1.12 }), BEIGE_D), col(Kit.ico(0.11, 0, 0.0, 0.13, '#b8946a', { sx: 1.6, sy: 0.5, sz: 0.7, detail: 1, rx: 0.35 }), '#c9a47a')])); sp2.add(this.hood);
    // the two drawstrings with their metal tips (they swing)
    this.strings = [];
    for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.085, S2(1.11), -0.245); g.add(mesh([col(Kit.cyl(0.011, 0.011, 0.17, 0, -0.17, 0, BEIGE, { seg: 6 }), '#ead0a8'), col(Kit.cyl(0.014, 0.012, 0.045, 0, -0.215, 0, STEEL, { seg: 6 }), STEEL)])); g.rotation.x = -0.12; sp2.add(g); this.strings.push(g); }
    // the belt bag: black, a zip, the strawberry badge and a pink star; two star charms hang under it (they swing)
    this.bag = new THREE.Group(); this.bag.position.set(0.085, S2(0.7), -0.318); sp2.add(this.bag);
    this.bag.add(mesh([flat(Kit.box(0.29, 0.15, 0.085, 0, -0.135, -0.04, '#17171f')), col(Kit.cyl(0.0425, 0.0425, 0.29, 0, -0.03, -0.04, '#17171f', { seg: 10, rz: Math.PI / 2 }), '#1d1d27'), flat(Kit.box(0.24, 0.008, 0.01, 0, -0.012, -0.084, YEL, { glow: true })),
      col(Kit.ico(0.038, -0.055, -0.062, -0.086, RED, { sy: 1.1, sz: 0.4, detail: 1 }), RED, { gain: 1.2 }), flat(Kit.cone(0.022, 0.02, -0.055, -0.03, -0.09, GREEN, { seg: 5, rx: Math.PI })), col(Kit.ico(0.046, -0.055, -0.062, -0.08, '#ffb0cf', { sy: 1.1, sz: 0.25, detail: 1 }), PINK_L),
      starFlat(0.06, -0.06, -0.085, 0.036, PINK, { glow: false })]));
    this.charms = [];
    for (const [x, c, len] of [[-0.13, '#ffb23a', 0.07], [0.12, CYAN, 0.1]]) { const g = new THREE.Group(); g.position.set(x, -0.1, -0.03); g.add(mesh([flat(Kit.box(0.006, len, 0.006, 0, -len, 0, STEEL)), starFlat(0, -len - 0.028, 0, 0.032, c)])); this.bag.add(g); this.charms.push(g); }

    // ---------------------------------------------------------------- THE ARMS (Spine_03): puffy striped sleeves, ribbed cuffs, red mitten hands; a patch on the right sleeve
    this.arm = []; this.fore = []; this.hand = [];
    for (const s of [-1, 1]) {                                          // s = -1: the LEFT arm (at -x), +1: the right
      const N = s < 0 ? 'L' : 'R', sh = bone('Shoulder_' + N, sp3, s * 0.29, S3(1.04), 0), up = bone('Arm_' + N, sh, s * 0.05, 0, 0), UA = 0.2, FA = 0.17;
      const a = [G(col(Kit.ico(0.122, 0, 0, 0, BEIGE, { detail: 2 }), BEIGE, { gain: 1.12 }), BEIGE_D), G(col(Kit.cyl(0.122, 0.108, UA, 0, -UA, 0, BEIGE, { seg: 14 }), BEIGE, { gain: 1.12 }), BEIGE_D)];
      for (const y of [-0.075, -0.15]) a.push(col(Kit.cyl(0.124, 0.122, 0.011, 0, y, 0, PINK_L, { seg: 14 }), PINK_L, { gain: 1.1 }));
      if (s > 0) a.push(flat(Kit.box(0.012, 0.075, 0.085, 0.118, -0.14, 0, '#ff5fa8')), flat(Kit.box(0.014, 0.04, 0.05, 0.119, -0.122, 0, '#3fd6c8', { glow: true })));      // the sleeve patch
      up.add(mesh(a));
      const fo = bone('Forearm_' + N, up, 0, -UA, 0);
      const f = [G(col(Kit.ico(0.112, 0, 0, 0, BEIGE, { detail: 1 }), BEIGE, { gain: 1.12 }), BEIGE_D), G(col(Kit.cyl(0.108, 0.092, FA, 0, -FA, 0, BEIGE, { seg: 14 }), BEIGE, { gain: 1.12 }), BEIGE_D), col(Kit.cyl(0.11, 0.106, 0.011, 0, -0.08, 0, PINK_L, { seg: 14 }), PINK_L, { gain: 1.1 }),
        col(Kit.cyl(0.082, 0.078, 0.045, 0, -FA - 0.04, 0, BEIGE_D, { seg: 12 }), BEIGE_D)];
      fo.add(mesh(f));
      const hn = bone('Hand_' + N, fo, 0, -FA - 0.045, 0);
      hn.add(mesh([G(col(Kit.ico(0.088, 0, -0.06, 0, RED, { sx: 0.9, sy: 1.15, detail: 2 }), RED_L), RED), col(Kit.ico(0.04, -s * 0.045, -0.04, -0.055, RED, { sy: 1.3, detail: 1 }), RED)]));
      this.arm.push(up); this.fore.push(fo); this.hand.push(hn);
    }

    // ---------------------------------------------------------------- THE LEGS (Hips): navy leggings fading to lilac, a pink sock, chunky black sneakers (pink laces and sole, a cream midsole, a star)
    this.leg = []; this.calf = []; this.foot = [];
    const TH = R0.THIGH, CF = R0.CALF, SO = R0.SOLE;
    for (const s of [-1, 1]) {
      const N = s < 0 ? 'L' : 'R', lg = bone('Leg_' + N, hips, s * 0.125, 0, 0);
      lg.add(mesh([col(Kit.ico(0.1, 0, 0, 0, NAVY, { detail: 1 }), NAVY), col(Kit.cyl(0.098, 0.084, TH, 0, -TH, 0, NAVY, { seg: 12 }), NAVY)]));
      const cf = bone('Calf_' + N, lg, 0, -TH, 0);
      cf.add(mesh([col(Kit.ico(0.086, 0, 0, 0, NAVY, { detail: 1 }), NAVY), G(col(Kit.cyl(0.084, 0.064, CF, 0, -CF, 0, NAVY, { seg: 12 }), NAVY), LILAC, 1.7)]));
      const ft = bone('Foot_' + N, cf, 0, -CF, 0);
      ft.add(mesh([
        col(Kit.cyl(0.072, 0.07, 0.05, 0, 0.0, 0, PINK_L, { seg: 12 }), PINK_L),                                                               // the pink sock
        G(col(Kit.ico(0.105, 0, -0.055, -0.04, '#24242e', { sx: 0.98, sy: 0.95, sz: 1.6, detail: 2 }), '#24242e'), '#07070b'),                 // the black upper
        col(Kit.ico(0.075, 0, -0.075, -0.17, '#1b1b23', { sx: 1.2, sy: 0.85, sz: 0.95, detail: 1 }), '#1b1b23'),                               // its round toe
        flat(Kit.box(0.2, 0.055, 0.35, 0, -0.158, -0.04, CREAM)), flat(Kit.box(0.21, 0.024, 0.36, 0, -SO, -0.04, PINK)),                       // the cream midsole on the pink outsole
        flat(Kit.box(0.2, 0.03, 0.06, 0, -0.15, 0.155, PINK, { rx: 0.5 })),                                                                    // the heel's kick
        col(Kit.cyl(0.08, 0.076, 0.03, 0, -0.03, 0.005, PINK, { seg: 12 }), PINK),                                                              // the pink collar
        flat(Kit.box(0.07, 0.05, 0.1, 0, -0.03, -0.075, PINK_L, { rx: -0.6 })),                                                                // the tongue
        ...[0, 1, 2, 3].map(k => flat(Kit.box(0.11, 0.015, 0.018, 0, -0.012 - k * 0.014, -0.085 - k * 0.028, PINK, { rx: -0.55, ry: k % 2 ? 0.25 : -0.25 }))),   // the pink laces
        starFlat(s * 0.106, -0.07, 0.0, 0.03, PINK, { ry: Math.PI / 2 }),                                                                       // the star on the outer side
        flat(Kit.box(0.04, 0.06, 0.012, 0, -0.06, 0.128, PINK))]));                                                                             // the heel tab
      this.leg.push(lg); this.calf.push(cf); this.foot.push(ft);
    }
    this.tris = Math.round(this.tris);

    // ---------------------------------------------------------------- the pose: joint angles eased toward the targets of the current animation
    // h = hips, s = spine, n = head (x pitch, y yaw, z roll); a?x = shoulder swing (+ forward), a?z = arm away from the body, e? = elbow flex, l? = hip flex (+ forward), l?z = leg out,
    // k? = knee flex, f? = ankle (+ toes down), sq = vertical squash, lift = height above the ground (the spin hop, the beat)
    this.REST = { hx: 0, hy: 0, hz: 0, sx: 0, sy: 0, sz: 0, nx: 0, ny: 0, nz: 0, alx: 0, arx: 0, alz: 0.3, arz: 0.3, el: 0.3, er: 0.3, ll: 0, lr: 0, llz: 0.04, lrz: 0.04, kl: 0.06, kr: 0.06, fl: 0, fr: 0, sq: 1, lift: 0, side: 0 };
    this.pose = Object.assign({}, this.REST); this.tp = Object.assign({}, this.REST);
    this.anim = 'idle'; this.airT = 0; this.landT = 0; this.wasAir = false; this.tip = 0; this.ground = 1; this.hipY = HIP;
    this.sec = { bag: { a: 0, v: 0 }, hood: { a: 0, v: 0 }, str: { a: 0, v: 0 }, charm: { a: 0, v: 0 }, leaf: { a: 0, v: 0 }, sway: { a: 0, v: 0 } }; this.prevY = 0; this.prevVy = 0; this.prevLean = 0;
    this.apply(1 / 60, 0, 0);
  }

  // the animation of this frame: its name (the blueprint's sets) and the pose it asks for, written into this.tp; returns how fast the joints follow (1/s)
  choose(dt, s) {
    const t = Object.assign(this.tp, this.REST), T = s.time, TM = BERRY_RIG.TIMING, sn = Math.sin(this.phase), cs = Math.cos(this.phase), lean = s.lean || 0;
    const run = (k, fwd) => {                                         // RUN: the legs a stride apart, the swinging knee folded, the arms pumping against the legs, the pelvis and the shoulders counter-turning
      t.ll = 0.72 * sn * k; t.lr = -0.72 * sn * k; t.kl = 0.22 + 1.4 * Math.max(0, cs) * k; t.kr = 0.22 + 1.4 * Math.max(0, -cs) * k;
      t.fl = 0.4 * Math.max(0, -sn) * k; t.fr = 0.4 * Math.max(0, sn) * k;                                           // the pushing foot points its toes
      t.sx = -fwd * k; t.hx = -0.03; t.nx = fwd * 0.75 * k; t.hy = 0.16 * sn * k; t.sy = -0.34 * sn * k; t.ny = 0.18 * sn * k; t.sz = 0.04 * cs * k;
      t.alx = -0.95 * sn * k; t.arx = 0.95 * sn * k; t.alz = t.arz = 0.2; t.el = 1.45 + 0.35 * sn * k; t.er = 1.45 - 0.35 * sn * k;
    };
    const steer = k => { t.hz += -lean * 0.17 * k; t.sz += -lean * 0.06 * k; t.ny += -lean * 0.45 * k; t.nz += -lean * 0.1 * k; t.alz += 0.16 * Math.abs(lean) * k; t.arz += 0.16 * Math.abs(lean) * k; };   // TURN: the body rolls into the turn, the head looks into it
    const crouch = () => { t.ll = t.lr = 1.0; t.kl = t.kr = 2.3; t.llz = t.lrz = 0.16; t.sx = -1.5; t.hx = -0.1; t.nx = 0.45; t.alx = t.arx = -0.9; t.alz = t.arz = 0.35; t.el = t.er = 1.5; t.sq = 0.82; };   // CROUCH: folded low, the head kept up
    if (this.wasAir && !s.airborne && s.state === 'play') this.landT = TM.land; this.wasAir = !!s.airborne;
    if (s.airborne) this.airT += dt; else this.airT = 0; if (this.landT > 0 && !s.airborne) this.landT -= dt;
    let rate = 16;
    if (s.state === 'over' && s.absorb) { this.anim = 'absorb'; t.alz = t.arz = 1.45; t.el = t.er = 0.4; t.kl = t.kr = 0.5; t.ll = t.lr = 0.3; t.nx = -0.3; }
    else if (s.state === 'over') { this.anim = 'trip'; t.alx = 0.2; t.arx = 0.1; t.alz = 1.45; t.arz = 1.3; t.el = 0.5; t.er = 0.9; t.ll = 0.1; t.lr = -0.3; t.kl = 0.7; t.kr = 0.25; t.nx = 0.6; t.nz = 0.2; t.lift = 0.22; }
    else if (s.state === 'title') {                                   // the menu's showcase (10 s): idle, wave, a spin with a hop, cheer and dance, run on the spot
      const u = T % 10;
      if (u < 2) { this.anim = 'idle'; }
      else if (u < 4) { this.anim = 'wave'; t.arz = 1.5; t.arx = 0.25; t.er = 1.1 + 0.5 * Math.sin(T * 11); t.nz = -0.2; t.sz = 0.07; t.hz = -0.04; t.ny = 0.15; rate = 22; }
      else if (u < 5.4) { this.anim = 'spin'; const f = (u - 4) / 1.4; t.lift = Math.sin(Math.PI * f) * 0.42; t.ll = 0.7; t.lr = 0.45; t.kl = 1.3; t.kr = 1.0; t.alz = t.arz = 1.3; t.el = t.er = 0.35; t.nx = -0.15; }
      else if (u < 7.6) { this.anim = 'dance'; const b = Math.sin(T * 8), ab = Math.abs(b); t.kl = t.kr = 0.75 - 0.55 * ab; t.ll = t.lr = 0.35 - 0.25 * ab; t.hz = 0.1 * b; t.sz = -0.14 * b; t.nz = -0.16 * b; t.nx = 0.14 * ab; t.hy = 0.2 * b;
        t.alx = 0.9 + 0.6 * b; t.arx = 0.9 - 0.6 * b; t.alz = t.arz = 0.95; t.el = 1.2 - 0.6 * b; t.er = 1.2 + 0.6 * b; rate = 24; }
      else { this.anim = 'run'; run(0.9, 0.12); rate = 34; }
    } else if (s.sliding) { this.anim = 'crouch'; crouch(); steer(0.5); rate = 3.2 / TM.crouch * 2.5; }                 // (down in 8 frames; the game counts a slide from its first frame)
    else if (this.ride > 0.5) {                                       // on a vehicle: a stance, not a run
      const v = this.vehicle;
      if (v === 'board' || v === 'surf') { this.anim = 'ride'; t.side = 1; t.kl = t.kr = s.airborne ? 1.3 : 0.6; t.ll = t.lr = s.airborne ? 0.85 : 0.42; t.llz = t.lrz = 0.3; t.sx = -0.12; t.ny = -0.95; t.alz = t.arz = 1.1; t.el = t.er = 0.3; t.sy = 0.15; }
      else { this.anim = 'ride'; const b = v === 'bike'; t.ll = 0.2; t.lr = 0.02; t.kl = s.airborne ? 0.9 : 0.3; t.kr = s.airborne ? 0.8 : 0.22; t.sx = b ? -0.42 : -0.16; t.nx = b ? 0.35 : 0.12; t.alx = t.arx = b ? 1.25 : 1.05; t.alz = t.arz = 0.12; t.el = t.er = b ? 0.25 : 0.45; if (s.airborne) { t.ll = 0.6; t.lr = 0.5; } }
      steer(0.7); rate = 14;
    } else if (s.airborne) {                                          // JUMP: takeoff (4 frames: the legs push straight, the arms throw up), then the tuck to the apex, then the legs reach for the ground
      if (this.airT < TM.takeoff) { this.anim = 'takeoff'; t.ll = -0.12; t.lr = 0.12; t.kl = t.kr = 0.05; t.fl = t.fr = 0.7; t.alx = t.arx = 1.5; t.alz = t.arz = 0.25; t.el = t.er = 0.5; t.sx = -0.1; rate = 45; }
      else if (s.vy > 0) { this.anim = 'air'; t.ll = 1.0; t.lr = 0.65; t.kl = 1.95; t.kr = 1.45; t.alx = t.arx = 1.35; t.alz = t.arz = 0.75; t.el = t.er = 0.7; t.sx = -0.2; t.nx = 0.12; rate = 22; }
      else { this.anim = 'fall'; t.ll = 0.5; t.lr = 0.22; t.kl = 0.75; t.kr = 0.4; t.fl = t.fr = 0.3; t.alx = t.arx = 0.3; t.alz = t.arz = 1.2; t.el = t.er = 0.35; t.sx = -0.08; t.nx = 0.2; rate = 14; }
      steer(1);
    } else if (this.landT > 0) { this.anim = 'land'; t.ll = t.lr = 0.8; t.kl = t.kr = 1.25; t.sx = -0.5; t.nx = 0.35; t.alx = t.arx = -0.2; t.alz = t.arz = 0.75; t.el = t.er = 0.5; t.sq = 0.93; steer(1); rate = 40; }   // LAND: 6 frames of give
    else { this.anim = 'run'; run(1, BERRY_RIG.LEAN); steer(1); rate = 34; }
    if (s.beat > 0 && s.state !== 'over' && !s.sliding) t.lift += (s.state === 'title' ? 0.08 : 0.03) * s.beat;        // it bounces on the beat of the music
    return rate;
  }

  update(dt, s) {
    if (s.state === 'pause') return;                                  // hold the pose
    super.update(dt, s);                                              // the vehicles, the ride, the run phase, the base's eased state (this.cur)
    const P = this.pivot, c = this.cur, tipping = s.state === 'over' && !s.absorb;
    P.rotation.y = P.rotation.y + this.group.rotation.y - (s.faceYaw || 0);                 // a 3D body keeps the heading of its group (the base turns a flat picture to the camera); only the showcase spin stays
    const rate = this.choose(dt, s), k = 1 - Math.exp(-rate * dt), p = this.pose, t = this.tp;
    for (const key in p) p[key] += (t[key] - p[key]) * (key === 'lift' ? 1 - Math.exp(-15 * dt) : k);
    this.tip += ((tipping ? -1.35 : 0) - this.tip) * (1 - Math.exp(-15 * dt));               // a crash tips the whole body forward onto its visor
    P.rotation.x = this.tip; P.rotation.z = tipping ? c.rz : 0;
    if (!(s.state === 'over' && s.absorb)) P.scale.set(1, 1, 1);                             // (the vortex stretches it as it goes down; otherwise the squash is the rig's own)
    P.position.y += p.lift - c.y;                                     // the base's bounce belonged to the flat picture: here the legs make it
    this.ground += ((s.airborne && this.ride < 0.5 ? 0 : 1) - this.ground) * (1 - Math.exp(-30 * dt));
    this.apply(dt, s.time, s.state === 'title' || s.state === 'play' ? 1 : 0, s);
  }

  // the pose onto the bones (every joint clamped to the blueprint's range), the hips set so the lower foot stands on the ground, then the follow-through pieces
  apply(dt, T, alive, s) {
    const p = this.pose, B = this.bones, L = BERRY_RIG.LIMITS, R0 = BERRY_RIG, cl = (v, a, b) => Math.max(a, Math.min(b, v)), sym = (v, m) => cl(v, -m, m);
    const hipA = [sym(p.ll, L.hip), sym(p.lr, L.hip)], knee = [cl(p.kl, L.knee[0], L.knee[1]), cl(p.kr, L.knee[0], L.knee[1])], ank = [sym(p.fl, L.ankle), sym(p.fr, L.ankle)];
    const breath = alive * Math.sin(T * 2 * Math.PI / BERRY_RIG.TIMING.idle), still = this.anim === 'idle' || this.anim === 'wave' ? 1 : 0.25;      // IDLE: subtle breathing and a slow weight shift
    B.Hips.rotation.set(p.hx, p.hy + p.side * 0.95, p.hz + 0.035 * still * Math.sin(T * 2 * Math.PI / (BERRY_RIG.TIMING.idle * 2)), 'YXZ');
    B.Spine_01.rotation.set(p.sx * 0.35, p.sy * 0.3, p.sz * 0.4); B.Spine_02.rotation.set(p.sx * 0.4, p.sy * 0.35, p.sz * 0.35); B.Spine_03.rotation.set(p.sx * 0.25, p.sy * 0.35, p.sz * 0.25);
    B.Spine_02.scale.setScalar(1 + 0.012 * still * breath);
    B.Head.rotation.set(sym(p.nx, L.headPitch) - 0.02 * still * breath, sym(p.ny, L.headYaw), sym(p.nz, L.headRoll), 'YXZ');
    this.limited = { hip: hipA, knee, ankle: ank, head: [B.Head.rotation.x, B.Head.rotation.y, B.Head.rotation.z] };
    let hip = 0;
    for (let i = 0; i < 2; i++) {
      const sgn = i ? 1 : -1, th = hipA[i] + p.hx, lz = i ? p.lrz : p.llz;
      this.leg[i].rotation.set(hipA[i], 0, sgn * lz); this.calf[i].rotation.x = -knee[i];
      this.foot[i].rotation.x = -(th - knee[i]) * 0.97 - ank[i];                             // the sole stays level, but for the toes pointed by the ankle
      const reach = (R0.THIGH * Math.cos(th) + R0.CALF * Math.cos(th - knee[i])) * Math.cos(lz) + R0.SOLE * Math.cos(ank[i]) + 0.19 * Math.sin(Math.abs(ank[i]));
      if (reach > hip) hip = reach;
    }
    this.hipY = hip * this.ground + R0.HIP * (1 - this.ground);       // on the ground the lower foot carries the body (the run's bounce comes from the stride itself); in the air the hips hang at rest
    B.Hips.position.y = this.hipY; this.rig.scale.set(1 + (1 - p.sq) * 0.5, p.sq, 1 + (1 - p.sq) * 0.5);
    const sh = [sym(p.alx, L.shoulder), sym(p.arx, L.shoulder)], az = [sym(p.alz, L.shoulder), sym(p.arz, L.shoulder)], el = [cl(p.el, L.elbow[0], L.elbow[1]), cl(p.er, L.elbow[0], L.elbow[1])];
    for (let i = 0; i < 2; i++) { const sgn = i ? 1 : -1; this.arm[i].rotation.set(sh[i], 0, sgn * az[i], 'ZXY'); this.fore[i].rotation.x = el[i]; this.hand[i].rotation.x = 0.15 * Math.sin(T * 6 + i * 1.7) * (this.anim === 'run' ? 1 : 0.2); }
    this.limited.shoulder = sh.concat(az); this.limited.elbow = el;
    // FOLLOW-THROUGH (the blueprint's optional physics): light damped springs on the bag, the hood, the drawstrings, the charms and the leaves, pushed by the body's vertical and sideways accelerations
    if (dt > 0) {
      const h = Math.min(dt, 1 / 30), y = this.pivot.position.y + this.group.position.y + this.hipY, vy = (y - this.prevY) / h, acc = Math.max(-60, Math.min(60, (vy - this.prevVy) / h)), lean = s ? s.lean || 0 : 0, lat = Math.max(-8, Math.min(8, (lean - this.prevLean) / h));
      this.prevY = y; this.prevVy = vy; this.prevLean = lean;
      const step = (S, target, K, D) => { S.v += ((target - S.a) * K - S.v * D) * h; S.a += S.v * h; S.a = Math.max(-1.2, Math.min(1.2, S.a)); return S.a; };
      const sc = this.sec, lag = p.sx + p.hx;                                                // (hanging pieces stay plumb when the body leans)
      this.bag.rotation.x = step(sc.bag, -acc * 0.006, 160, 9) - lag * 0.3; this.bag.rotation.z = step(sc.sway, -lat * 0.05, 120, 8);
      this.hood.rotation.x = step(sc.hood, acc * 0.004, 220, 12);
      const st = step(sc.str, -acc * 0.012, 110, 6); this.strings[0].rotation.x = -0.12 + st - lag * 0.8; this.strings[1].rotation.x = -0.12 + st * 0.85 - lag * 0.8; this.strings[0].rotation.z = sc.sway.a * 1.5; this.strings[1].rotation.z = sc.sway.a * 1.5;
      const ch = step(sc.charm, -acc * 0.02, 90, 4); this.charms[0].rotation.x = ch; this.charms[1].rotation.x = ch * 0.8; this.charms[0].rotation.z = sc.sway.a * 3; this.charms[1].rotation.z = sc.sway.a * 2.5;
      const lf = step(sc.leaf, -acc * 0.0035, 260, 10); this.leaves.scale.set(1 - lf * 0.35, 1 + lf, 1 - lf * 0.35); this.leaves.rotation.z = sc.sway.a * 0.8;
    }
  }
}
