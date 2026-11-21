// PodCar: THE PLAYER'S RACE CAR, rebuilt from the user's sheet (docs/car/pod-car-sheet.png) as a real 3D model, the way Berry and Zagla were rebuilt from theirs: a rounded pod, a glossy
// black shell under a deep blue glass canopy (the windscreen and the roof in one dome, the side windows, the rear window; a black roof spine over the cabin), lime neon along the sills,
// across the low nose and up the two front corners, thin cyan light lines at the front, a red and cyan light bar across the tail with a lime line under it, black tyres on dark rims with
// blue hub caps. Built in code (one lofted shell with its colours per face, Kit parts for the lights and the wheels): no picture stands in for the car any more.
// It faces -z (the way of the race), 4.2 m long, 1.9 m wide, 1.45 m high, its wheels on y = 0. PodCar.build(opts) returns a Group whose userData has what Race3D drives:
// pic (the body, which breathes on the beat), halo (none), brakeLight (shown while braking; opts.brakeMat is the race's own brake-light material), and pod: true.
const PodCar = {
  L: 4.2, W: 1.9, H: 1.45, WR: 0.42,
  // the roof line from nose (t = 0) to tail (t = 1), the half width and the floor of each cross-section
  roof(t) { const P = [[0, 0.5], [0.08, 0.74], [0.22, 0.98], [0.38, 1.3], [0.54, 1.45], [0.7, 1.38], [0.84, 1.12], [0.94, 0.86], [1, 0.58]]; for (let k = 1; k < P.length; k++) if (t <= P[k][0]) { const u = (t - P[k - 1][0]) / (P[k][0] - P[k - 1][0]), e = u * u * (3 - 2 * u); return P[k - 1][1] + (P[k][1] - P[k - 1][1]) * e; } return P[P.length - 1][1]; },
  half(t) { return PodCar.W / 2 * Math.pow(Math.sin(Math.PI * (0.07 + 0.86 * t)), 0.42); },
  floor(t) { return 0.2 + 0.26 * Math.pow(Math.abs(2 * t - 1), 4); },
  // is the face at (t along the car, s up the section 0..1, c = |sideways| 0..1) glass?
  glass(t, s, c) { return s > 0.5 && t > 0.2 && t < 0.9 && !(t > 0.5 && t < 0.8 && s > 0.9) && !(t > 0.48 && t < 0.52 && s < 0.86) && !(t > 0.76 && t < 0.8); },      // (the roof spine, the pillar behind the door, the pillar before the rear window)
  shell() {
    const NT = 44, NA = 30, L = PodCar.L, pos = [], idx = [], info = [];
    for (let i = 0; i <= NT; i++) { const t = i / NT, w = PodCar.half(t), y0 = PodCar.floor(t), y1 = PodCar.roof(t);
      for (let j = 0; j <= NA; j++) { const a = Math.PI * j / NA, c = Math.cos(a), s = Math.pow(Math.sin(a), 0.72); pos.push(w * Math.sign(c) * Math.pow(Math.abs(c), 0.62), y0 + (y1 - y0) * s, -L / 2 + t * L); info.push([t, s, Math.abs(c)]); } }
    for (let i = 0; i < NT; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g0.setIndex(idx); g0.computeVertexNormals();      // smooth normals, then one colour per face (crisp edges between glass and shell)
    const g = g0.toNonIndexed(), n = g.attributes.position.count, col = new Float32Array(n * 3), cg = new THREE.Color(), BODY = new THREE.Color('#050508'), BODY2 = new THREE.Color('#15151d'), G0 = new THREE.Color('#0d14c8'), G1 = new THREE.Color('#2b3cff');
    for (let f = 0; f < idx.length; f += 6) { let t = 0, s = 0, c = 0; for (const k of [0, 1, 2, 5]) { const q = info[idx[f + k]]; t += q[0] / 4; s += q[1] / 4; c += q[2] / 4; }      // (one colour per quad: its two triangles together)
      if (PodCar.glass(t, s, c)) cg.copy(G0).lerp(G1, Math.max(0, Math.min(1, (s - 0.5) * 2))); else cg.copy(BODY).lerp(BODY2, Math.max(0, Math.min(1, s * 0.9)));
      for (let k = 0; k < 6; k++) { col[(f + k) * 3] = cg.r; col[(f + k) * 3 + 1] = cg.g; col[(f + k) * 3 + 2] = cg.b; } }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g0.dispose();
    return g;
  },
  build(opts) {
    opts = opts || {};
    const G = new THREE.Group(), body = new THREE.Group(), L = PodCar.L, LIME = '#8dff1a', CYAN = '#35f0ff', RED = '#ff2a5a', BLUE = '#2b3cff', hw = t => PodCar.half(t), zt = t => -L / 2 + t * L;
    if (!PodCar.mat) { PodCar.mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 150, specular: 0x8a8aa0, side: THREE.DoubleSide });      // a clear-coat sheen; its own colours kept readable on the dark track
      PodCar.mat.customProgramCacheKey = () => 'podcar-lift'; PodCar.mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * 0.38;\n#endif'); }; }
    body.add(new THREE.Mesh(PodCar.shell(), PodCar.mat));
    const P = [];
    P.push(Kit.box(1.5, 0.06, L * 0.8, 0, 0.2, 0, '#08080c'));                                                                                        // the flat underbody
    for (const s of [-1, 1]) {
      P.push(Kit.box(0.03, 0.045, L * 0.44, s * (hw(0.5) + 0.005), 0.3, zt(0.52), LIME, { glow: true }));                                             // the lime line along the sill
      P.push(Kit.box(0.07, 0.3, 0.3, s * hw(0.1) * 0.9, 0.36, zt(0.1), LIME, { glow: true, ry: s * 0.6, rz: -s * 0.15 }));                         // the lime blade up the front corner
      P.push(Kit.box(0.34, 0.03, 0.04, s * 0.27, 0.7, zt(0.06), CYAN, { glow: true, rz: -s * 0.2, ry: s * 0.3 }));                          // the cyan light line at the front
      P.push(Kit.box(0.26, 0.05, 0.05, s * 0.4, 0.93, zt(0.957), CYAN, { glow: true, ry: -s * 0.35 }));                                               // the cyan ends of the tail's light bar
    }
    P.push(Kit.box(0.95, 0.04, 0.04, 0, 0.36, zt(0.012), LIME, { glow: true }));                                                                       // the lime line across the low nose
    P.push(Kit.box(0.56, 0.05, 0.05, 0, 0.94, zt(0.972), RED, { glow: true }));                                                                       // the red middle of the tail's light bar
    P.push(Kit.box(0.8, 0.035, 0.04, 0, 0.4, zt(0.992), LIME, { glow: true }));                                                                     // the lime line under the tail
    body.add(Kit.mesh(Kit.merge(P)));
    const WP = [];
    for (const s of [-1, 1]) for (const t of [0.2, 0.8]) { const x = s * 0.7, z = zt(t), R = PodCar.WR;
      WP.push(Kit.cyl(R, R, 0.3, x, R - 0.15, z, '#050508', { rz: Math.PI / 2, seg: 18 }), Kit.cyl(R * 0.68, R * 0.68, 0.31, x, R - 0.155, z, '#1a1a22', { rz: Math.PI / 2, seg: 16 }),      // (Kit places a part by its foot, before turning it: the axle is at the wheel's radius)
        Kit.cyl(R * 0.33, R * 0.33, 0.04, x + s * 0.15, R - 0.02, z, BLUE, { rz: Math.PI / 2, seg: 14, glow: true })); }                                   // the tyre, the rim, the blue hub cap
    G.add(body, Kit.mesh(Kit.merge(WP)));
    const bl = new THREE.Group();                                                                                                                      // the brake lights: the tail's bar flares (the race's own material)
    if (opts.brakeMat) { const pl = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), opts.brakeMat); m.position.set(x, y, zt(1) + 0.03); bl.add(m); }; pl(1.2, 0.3, 0, 0.94); pl(0.45, 0.36, -0.4, 0.94); pl(0.45, 0.36, 0.4, 0.94); }
    bl.visible = false; G.add(bl);
    if (opts.glowMat) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(PodCar.W * 1.15, L * 1.05), opts.glowMat); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.015; G.add(gl); }      // its light on the track
    G.userData = { pic: body, halo: [], brakeLight: bl, pod: true };
    return G;
  },
};
