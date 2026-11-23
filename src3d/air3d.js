// Air3D: what drifts in the air of a zone, so each place has its own weather under the same sky: FIREFLIES in the forest (slow green-gold lights that wander and pulse), DUST MOTES in the
// ruins (pale, slow, in the light), PETALS over the market and the terraces (pink, falling and swaying, from the blossom trees), small GLINTS in the neon streets (magenta and cyan, rising).
// The coast, the canals and the other streets keep a clear air. One THREE.Points of 110 round points in a box round the runner (18 m wide, 6 m high, 46 m along the road, most of it ahead):
// one draw call, nothing allocated per frame; the points belong to the road, not to the camera (they pass by as the runner advances and come round again ahead). The air follows the zone
// ahead (g.bgTo) with a fade out and in, and it is still in a pause. Not drawn in the races (they have their own scenes).
class Air3D {
  static get STYLES() { return Air3D._st || (Air3D._st = {
    fireflies: { col: '#d8ff6a', size: 0.16, n: 70, add: true, op: 0.95, rise: 0, sway: 0.5, bob: 0.35, pulse: 1 },
    motes: { col: '#ffe9c4', size: 0.07, n: 110, add: false, op: 0.55, rise: 0.05, sway: 0.25, bob: 0.12, pulse: 0 },
    petals: { col: '#ffc4dc', size: 0.11, n: 80, add: false, op: 0.9, rise: -0.5, sway: 0.7, bob: 0.1, pulse: 0 },
    glints: { col: '#ff8ae0', size: 0.075, n: 60, add: true, op: 0.8, rise: 0.35, sway: 0.15, bob: 0.05, pulse: 0.6 } }); }
  static styleOf(id) { return /^forest/.test(id) ? 'fireflies' : /^ruins/.test(id) ? 'motes' : /^(market|terrace)/.test(id) ? 'petals' : /^(neon|artcity)/.test(id) ? 'glints' : ''; }
  constructor(scene) {
    const N = this.N = 110, W = this.W = 18, H = this.H = 6, D = this.D = 46;
    this.base = new Float32Array(N * 4);                                 // per point: x, y, how far along the box (0..1), its own phase
    for (let i = 0; i < N; i++) { this.base[i * 4] = (rnd(i, 501) - 0.5) * W; this.base[i * 4 + 1] = 0.4 + rnd(i, 502) * (H - 0.4); this.base[i * 4 + 2] = rnd(i, 503); this.base[i * 4 + 3] = rnd(i, 504) * 6.2832; }
    const geo = new THREE.BufferGeometry(); this.pos = new Float32Array(N * 3); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, -17), 40);
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'), gr = c.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    this.mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), size: 0.1, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.points = new THREE.Points(geo, this.mat); this.points.visible = false; this.points.frustumCulled = false; this.points.renderOrder = 3; scene.add(this.points);
    this.style = ''; this.level = 0;
  }
  update(g, dt, rz) {
    const want = g.state === 'play' || g.state === 'pause' || g.state === 'over' ? Air3D.styleOf(g.bgT > 0.4 ? g.bgTo || '' : '') : '';
    if (want !== this.style) { this.level -= Math.min(this.level, dt * 2.5); if (this.level <= 0.01) { this.style = want; const S = Air3D.STYLES[want]; if (S) { this.mat.color.set(S.col); this.mat.size = S.size; this.mat.blending = S.add ? THREE.AdditiveBlending : THREE.NormalBlending; this.mat.needsUpdate = true; this.points.geometry.setDrawRange(0, S.n); } } }
    else this.level += ((want ? 1 : 0) - this.level) * Math.min(1, dt * 1.5);
    const S = Air3D.STYLES[this.style]; if (!S || this.level < 0.01) { this.points.visible = false; return; }
    const t = g.time, P = this.pos, B = this.base, D = this.D, H = this.H;
    for (let i = 0; i < S.n; i++) {
      const x0 = B[i * 4], y0 = B[i * 4 + 1], u = B[i * 4 + 2], ph = B[i * 4 + 3];
      let y = y0 + S.rise * t + S.bob * Math.sin(t * 1.3 + ph); y = 0.3 + ((y - 0.3) % (H - 0.3) + (H - 0.3)) % (H - 0.3);       // rising or falling points come round again
      P[i * 3] = x0 + S.sway * Math.sin(t * 0.7 + ph * 1.7); P[i * 3 + 1] = y; P[i * 3 + 2] = 6 - ((u * D + rz) % D + D) % D;                        // they stay on the road as the runner passes
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.mat.opacity = S.op * this.level * (S.pulse ? 1 - S.pulse * 0.35 * (0.5 + 0.5 * Math.sin(t * 2.1)) : 1);
    this.points.visible = true;
  }
}
