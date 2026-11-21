// RunnerZagla: ZAGLA, the second character, rebuilt from the user's character sheet (docs/zagla/zagla-character-sheet.png, "3D Game Character, Reimagined Design, No Electronic Eyes") the way
// Berry was: a rigged 3D body on the SAME rig and the SAME motion as Berry (RunnerBerry, src3d/berry3d.js: the blueprint's bones, joint ranges and animation sets: idle, run, the jump in three
// phases, land, crouch, turn, the stances on the vehicles, the trip, the menu's showcase). Only the body differs:
//   - ONE TALL EGG for a body and a head: glossy red with yellow dots, narrow at the belt and widest at the visor, a cream crown over a red band, a seam down the back;
//   - ONE glossy black wraparound VISOR (no eyes), its lower edge a V at the front, sweeping back along both sides in a yellow-edged point;
//   - neon green HAIR: thick strands from the crown, swept over her right brow down across the visor, a few short ones behind (her follow-through piece: it flops like Berry's leaves);
//   - pink lips on the belly; a black oval panel with brass rivets on each side, where the arms hang: a cream shoulder, a black jointed sleeve, a pointed red hand;
//   - a lilac line and a navy belt with a ring at the front; long thin navy leggings fading to lilac; chunky sneakers in yellow, teal and red on a white and lilac sole.
// The same interface as every runner (group, shadow, pivot, update(dt, state), cur) and the same vehicles. 1.9 m from the soles to the hair; her legs are longer than Berry's (the hips at 0.70 m).
class RunnerZagla extends RunnerBerry {
  build(K) {
    const { shiny, leafMat, mesh, bone, col, G, flat, surf, raw, M4 } = K;
    const RED = '#ee2026', RED_L = '#ff5a3c', RED_D = '#b3121c', BLACK = '#0a0a10', COAL = '#17161c', CREAM = '#ffe9b0', GOLD = '#ffd23a', GREEN = '#58f01c', PINK = '#e8208c', NAVY = '#1a2160', LILAC = '#c6b8ff', TEAL = '#3fbf9f', YEL = '#ffd92e', BRASS = '#d9a23a', STEEL = '#3a3644';
    const D = this.dims = { HIP: 0.70, THIGH: 0.25, CALF: 0.27, SOLE: 0.18 };

    // ---------------------------------------------------------------- the skeleton (the blueprint's hierarchy; the egg is one rigid piece on Spine_03, so the spine's whole lean reaches it)
    this.bones = {};
    this.rig = bone('Root', this.pivot, 0, 0, 0);
    const hips = bone('Hips', this.rig, 0, D.HIP, 0), sp1 = bone('Spine_01', hips, 0, 0, 0), sp2 = bone('Spine_02', sp1, 0, 0.04, 0), sp3 = bone('Spine_03', sp2, 0, 0.04, 0);
    bone('Head', bone('Neck', sp3, 0, 0.62, 0), 0, 0.06, 0);
    const E = y => y - 0.08;                                            // height above the hips -> Spine_03's coordinates

    // ---------------------------------------------------------------- THE EGG (Spine_03): 1.14 m tall, 0.37 m across at the belt, 0.70 m at the visor
    const TOP = 1.14, WIDE = 0.74, DZ = 0.9, sm = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const eggH = y => y < WIDE ? 0.185 + 0.165 * Math.pow(sm(y / WIDE), 0.9) : 0.35 * Math.sqrt(Math.max(0, 1 - Math.pow((y - WIDE) / (TOP - WIDE), 2.05)));      // the radius at a height above the hips
    const R = y => eggH(y + 0.08), X = (y, f, infl = 0) => (eggH(y) + infl) * Math.sin(f), Z = (y, f, infl = 0) => -(eggH(y) + infl) * DZ * Math.cos(f);       // (f: the angle from the front, toward her right)
    const eg = [];
    eg.push(G(col(surf(R, E(0.06), E(0.99), { rows: 24, segs: 36, dz: DZ }), RED_L, { gain: 1.2 }), RED, 2.0));                                   // the red body
    eg.push(G(col(surf(R, E(0.99), E(TOP), { rows: 8, segs: 36, dz: DZ, yc: E(0.9) }), '#fff3cf', { gain: 1.1 }), CREAM, 0.7));                   // the cream crown
    eg.push(col(surf(R, E(0), E(0.06), { rows: 1, segs: 36, dz: DZ, infl: 0.006, capBot: true }), NAVY));                                          // the navy belt
    eg.push(col(surf(R, E(0.06), E(0.085), { rows: 1, segs: 36, dz: DZ, infl: 0.008 }), LILAC, { gain: 1.1 }));                                     // the lilac line over it
    eg.push(col(raw(new THREE.TorusGeometry(0.046, 0.012, 6, 18), STEEL, M4(0, E(0.035), Z(0.035, 0, 0.012))), STEEL), flat(Kit.box(0.02, 0.02, 0.012, 0.046, E(0.035) - 0.01, Z(0.035, 0, 0.014), BRASS)));   // its ring
    eg.push(col(surf(R, E(0.1), E(0.97), { rows: 10, segs: 1, f0: Math.PI - 0.014, f1: Math.PI + 0.014, dz: DZ, infl: 0.004, yc: E(0.5) }), RED_D));   // the seam down the back
    // the visor: a V at the front (lowest at the middle), level on top, narrowing to a point behind each side
    const VF = 2.2, vT = f => 0.90 - 0.22 * Math.pow(Math.min(1, Math.abs(f) / VF), 3), vB = f => 0.56 + 0.12 * Math.pow(Math.min(1, Math.abs(f) / VF), 0.9);
    const vis = [G(col(surf(R, f => E(vB(f)), f => E(vT(f)), { rows: 8, segs: 44, f0: -VF, f1: VF, dz: DZ, infl: 0.012, yc: E(0.74) }), '#232a5c'), BLACK, 0.6),
      col(Kit.ico(0.03, X(0.82, -0.5, 0.016), E(0.82), Z(0.82, -0.5, 0.016), '#cfe0ff', { sx: 2.6, sy: 0.7, sz: 0.2, detail: 1, rz: 0.2, ry: 0.5, glow: true }), '#cfe0ff')];
    for (const s of [-1, 1]) {                                                                                                                      // its yellow edge along both sides
      eg.push(col(surf(R, f => E(vB(f) - 0.028), f => E(vB(f)), { rows: 1, segs: 14, f0: s * 0.95, f1: s * (VF + 0.03), dz: DZ, infl: 0.014, yc: E(0.74) }), GOLD, { gain: 1.15 }));
      eg.push(col(surf(R, f => E(vT(f)), f => E(vT(f) + 0.024), { rows: 1, segs: 12, f0: s * 1.2, f1: s * (VF + 0.03), dz: DZ, infl: 0.014, yc: E(0.74) }), GOLD, { gain: 1.15 }));
    }
    // a black oval panel on each side, rimmed with brass rivets: the arms hang from it
    const PW = 0.6, PC = 0.38, PH = 0.25, side = (f, s) => Math.sqrt(Math.max(0, 1 - Math.pow((f - s * Math.PI / 2) / PW, 2)));
    for (const s of [-1, 1]) {
      eg.push(col(surf(R, f => E(PC - PH * side(f, s)), f => E(PC + PH * side(f, s)), { rows: 6, segs: 12, f0: s * Math.PI / 2 - PW, f1: s * Math.PI / 2 + PW, dz: DZ, infl: 0.012, yc: E(PC) }), COAL));
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, f = s * Math.PI / 2 + Math.cos(a) * PW * 0.8, y = PC + Math.sin(a) * PH * 0.8; eg.push(col(Kit.ico(0.013, X(y, f, 0.014), E(y), Z(y, f, 0.014), BRASS, { detail: 0, glow: true }), BRASS)); }
    }
    // the pink lips on the belly
    eg.push(col(Kit.ico(0.1, 0.0, E(0.33), Z(0.33, 0, 0.004), PINK, { sx: 1.45, sy: 0.3, sz: 0.12, detail: 1, rz: 0.06 }), PINK, { gain: 1.15 }), col(Kit.ico(0.075, 0.03, E(0.36), Z(0.36, 0.08, 0.004), PINK, { sx: 1.35, sy: 0.3, sz: 0.12, detail: 1, rz: 0.16 }), PINK, { gain: 1.15 }));
    {                                                                                                                                              // the yellow dots, scattered over the red (a fixed sequence): none on the visor, the panels or the lips
      let seed = 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, placed = []; let tries = 0;
      while (placed.length < 40 && tries++ < 4000) {
        let f = rnd() * Math.PI * 2; if (f > Math.PI) f -= Math.PI * 2; const y = 0.13 + rnd() * 0.84, af = Math.abs(f);
        if (af < VF + 0.12 && y < vT(f) + 0.04 && y > vB(f) - 0.06) continue;
        if (Math.abs(af - Math.PI / 2) < PW + 0.12 && Math.abs(y - PC) < PH + 0.06) continue;
        if (af < 0.6 && Math.abs(y - 0.345) < 0.09) continue; if (af > Math.PI - 0.1) continue;
        const x = X(y, f, 0.003), z = Z(y, f, 0.003); if (placed.some(q => (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2 < 0.11 * 0.11)) continue;
        placed.push([x, y, z]); eg.push(Kit.ico(0.012 + rnd() * 0.005, x, E(y), z, GOLD, { sz: 0.5, detail: 0, ry: -f, glow: true }));
      }
      this.dots = placed.length;
    }
    sp3.add(mesh(eg)); sp3.add(mesh(vis, shiny));
    // the hair: thick neon green strands from the crown, most of them swept over her right brow and down across the visor, four short ones behind and to her left. Its own piece (it flops).
    const strand = (f0, f1, yEnd, rad) => {
      const pts = []; for (let k = 0; k <= 8; k++) { const u = k / 8, y = TOP - 0.005 - (TOP - 0.005 - yEnd) * Math.pow(u, 1.25), f = f0 + (f1 - f0) * u, lift = 0.018 + 0.01 * Math.sin(Math.PI * u); pts.push(new THREE.Vector3(X(y, f, lift), E(y), Z(y, f, lift))); }
      return col(raw(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, rad, 5, false), GREEN, M4(0, 0, 0)), GREEN, { gain: 1.25 });
    };
    const hr = [];
    for (const [f0, f1, yEnd, rad] of [[0.9, 0.1, 0.66, 0.026], [1.05, 0.38, 0.6, 0.027], [1.2, 0.62, 0.64, 0.025], [1.3, 0.86, 0.7, 0.026], [1.45, 1.12, 0.62, 0.024], [1.6, 1.4, 0.72, 0.025], [1.8, 1.72, 0.8, 0.023], [0.7, -0.18, 0.86, 0.024], [0.5, -0.5, 0.95, 0.022],
      [2.3, 2.4, 0.97, 0.022], [3.0, 3.2, 1.0, 0.021], [-1.2, -1.5, 0.99, 0.021], [-2.2, -2.5, 1.0, 0.021]]) hr.push(strand(f0, f1, yEnd, rad));
    hr.push(col(Kit.ico(0.06, 0.03, E(TOP) + 0.005, 0.01, GREEN, { sy: 0.5, detail: 1 }), GREEN, { gain: 1.25 }));                                 // where they meet on the crown
    this.leaves = new THREE.Group(); this.leaves.position.y = E(TOP); const hm = mesh(hr, leafMat); hm.position.y = -E(TOP); this.leaves.add(hm); sp3.add(this.leaves);

    // ---------------------------------------------------------------- THE ARMS (Spine_03): a cream shoulder, a black jointed sleeve, a pointed red hand
    this.arm = []; this.fore = []; this.hand = [];
    const UA = 0.2, FA = 0.2;
    for (const s of [-1, 1]) {                                          // s = -1: the LEFT arm (at -x), +1: the right
      const N = s < 0 ? 'L' : 'R', sh = bone('Shoulder_' + N, sp3, s * (eggH(0.5) - 0.02), E(0.5), 0), up = bone('Arm_' + N, sh, s * 0.05, 0, 0);
      up.add(mesh([col(Kit.ico(0.078, 0, 0, 0, CREAM, { detail: 2 }), CREAM, { gain: 1.1 }), G(col(Kit.cyl(0.064, 0.056, UA - 0.03, 0, -UA, 0, COAL, { seg: 12 }), '#24232c'), BLACK)]));
      const fo = bone('Forearm_' + N, up, 0, -UA, 0);
      fo.add(mesh([col(Kit.ico(0.06, 0, 0, 0, COAL, { detail: 1 }), '#24232c'), G(col(Kit.cyl(0.056, 0.044, FA, 0, -FA, 0, COAL, { seg: 12 }), '#24232c'), BLACK), col(Kit.cyl(0.058, 0.056, 0.01, 0, -0.07, 0, STEEL, { seg: 12 }), STEEL), col(Kit.cyl(0.05, 0.048, 0.01, 0, -0.15, 0, STEEL, { seg: 12 }), STEEL)]));
      const hn = bone('Hand_' + N, fo, 0, -FA, 0);
      hn.add(mesh([G(col(Kit.ico(0.052, 0, -0.07, 0, RED, { sx: 0.95, sy: 1.75, detail: 2 }), RED_L, { gain: 1.15 }), RED)]));
      this.arm.push(up); this.fore.push(fo); this.hand.push(hn);
    }

    // ---------------------------------------------------------------- THE LEGS (Hips): long thin navy leggings fading to lilac, sneakers in yellow, teal and red on a white and lilac sole
    this.leg = []; this.calf = []; this.foot = [];
    const TH = D.THIGH, CF = D.CALF, SO = D.SOLE;
    for (const s of [-1, 1]) {
      const N = s < 0 ? 'L' : 'R', lg = bone('Leg_' + N, hips, s * 0.085, 0, 0);
      lg.add(mesh([col(Kit.ico(0.078, 0, 0, 0, NAVY, { detail: 1 }), NAVY), col(Kit.cyl(0.076, 0.06, TH, 0, -TH, 0, NAVY, { seg: 12 }), NAVY)]));
      const cf = bone('Calf_' + N, lg, 0, -TH, 0);
      cf.add(mesh([col(Kit.ico(0.062, 0, 0, 0, NAVY, { detail: 1 }), NAVY), G(col(Kit.cyl(0.06, 0.044, CF, 0, -CF, 0, NAVY, { seg: 12 }), NAVY), LILAC, 1.6)]));
      const ft = bone('Foot_' + N, cf, 0, -CF, 0);
      ft.add(mesh([
        col(Kit.cyl(0.05, 0.05, 0.05, 0, 0.0, 0, LILAC, { seg: 12 }), LILAC),                                                                    // the lilac sock
        G(col(Kit.ico(0.09, 0, -0.055, -0.035, TEAL, { sx: 0.98, sy: 0.95, sz: 1.6, detail: 2 }), YEL, { gain: 1.1 }), TEAL, 1.4),               // the upper: yellow on top, teal below
        col(Kit.ico(0.066, 0, -0.078, -0.15, YEL, { sx: 1.2, sy: 0.85, sz: 0.95, detail: 1 }), YEL, { gain: 1.1 }),                               // the yellow toe
        flat(Kit.box(0.172, 0.055, 0.31, 0, -0.158, -0.035, '#ffffff')), flat(Kit.box(0.182, 0.024, 0.32, 0, -SO, -0.035, '#d9a8ff')),           // the white midsole on the lilac outsole
        flat(Kit.box(0.172, 0.03, 0.055, 0, -0.15, 0.135, '#d9a8ff', { rx: 0.5 })),                                                              // the heel's kick
        flat(Kit.box(0.012, 0.045, 0.12, s * 0.088, -0.085, -0.02, RED, { rx: 0.25 })), flat(Kit.box(0.012, 0.03, 0.09, -s * 0.088, -0.09, 0.0, RED, { rx: -0.2 })),   // the red flashes on the sides
        col(Kit.cyl(0.06, 0.058, 0.03, 0, -0.03, 0.005, NAVY, { seg: 12 }), NAVY),                                                                // the navy collar
        flat(Kit.box(0.06, 0.045, 0.085, 0, -0.03, -0.065, RED, { rx: -0.6 })),                                                                  // the tongue
        ...[0, 1, 2].map(k => flat(Kit.box(0.09, 0.013, 0.016, 0, -0.014 - k * 0.014, -0.075 - k * 0.028, YEL, { rx: -0.55, ry: k % 2 ? 0.25 : -0.25 }))),   // the yellow laces
        flat(Kit.box(0.035, 0.05, 0.012, 0, -0.06, 0.108, NAVY))]));                                                                              // the heel tab
      this.leg.push(lg); this.calf.push(cf); this.foot.push(ft);
    }
  }
}
