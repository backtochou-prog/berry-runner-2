// Canvas renderer (480x270): sunset sky + sea, three parallax layers per zone, perspective road with a
// Sonic-style checkered verge, depth-sorted PNG sprites, HUD and screens.
// Every world->screen x goes through one formula: perspective scale + a "sway" term that is zero at the
// player's depth, so the road can lean toward a chosen branch while the runner stays put.
const SEA_Y = HY - 30;                       // sky ends / sea begins
const SUN_X = 360, SUN_Y = SEA_Y - 10;
const STRIP_W = 960, SINK = 110;             // parallax tile width; how far a zone's layers sink when swapped out
const LAYERS = [['far', 6], ['mid', 13], ['near', 27]]; // strip, parallax speed (px per world unit of camera x)
const ZONES = ['shore', 'jungle', 'cliffs'];
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

class Renderer {
  constructor(cv) {
    this.ctx = cv.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    const pc = document.createElement('canvas'); pc.width = pc.height = 2;
    const px = pc.getContext('2d'); px.fillStyle = C.ink; px.fillRect(0, 0, 1, 1); px.fillRect(1, 1, 1, 1);
    this.dither = this.ctx.createPattern(pc, 'repeat');
    this.skyCache = new Map();
  }

  sx(wx, s) { return CX + (wx - this.camW) * LPX * s + this.sway * (1 - s / S20); }

  draw(g) {
    const ctx = this.ctx, p = g.p;
    this.camW = g.camX + g.camOff; this.sway = g.sway; this.camZ = p.z - PLAYER_D;
    ctx.save();
    if (g.shake > 0) ctx.translate(Math.round(Math.sin(g.time * 90) * g.shake * 12), Math.round(Math.cos(g.time * 70) * g.shake * 9));
    this.drawSky(g);
    this.drawRoad(g.world);
    this.drawObjects(g);
    this.drawBeams(g);
    this.drawCanopy(g);
    this.drawFx(g);
    ctx.restore();
    if (g.state === 'over' && g.flash > 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = C.burg; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    if (g.state !== 'title') this.drawHud(g);
    this.drawTouch(g);
    if (g.state === 'title') this.drawTitle(g);
    else if (g.state === 'pause') this.drawPause(g);
    else if (g.state === 'over' && g.overT > 0.5) this.drawOver(g);
  }

  // ---------------------------------------------------------------- sky, sun, sea, parallax
  makeSky(pal) { // 8-band sunset ramp; neighbouring bands blend through ordered dither (no gradients)
    const cv = document.createElement('canvas'); cv.width = VW; cv.height = SEA_Y;
    const c = cv.getContext('2d'), img = c.createImageData(VW, SEA_Y), rgb = pal.sky.map(_rgb), n = rgb.length;
    for (let y = 0; y < SEA_Y; y++) {
      const pos = y / SEA_Y * n, i = Math.min(n - 1, Math.floor(pos)), f = pos - i;
      for (let x = 0; x < VW; x++) {
        let col = rgb[i];
        if (i < n - 1 && f > 0.6 && BAYER4[y & 3][x & 3] / 16 < (f - 0.6) / 0.4) col = rgb[i + 1];
        const o = (y * VW + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    return cv;
  }

  zoneShift(zone, g) {
    const base = BIOMES[g.world.baseBiome].skyline, to = BIOMES[g.bgTo].skyline;
    if (zone === to && to === base) return 0;
    if (zone === base) return g.bgT * SINK;
    if (zone === to) return (1 - g.bgT) * SINK;
    return SINK;
  }

  drawSky(g) {
    const ctx = this.ctx, pal = paletteFor(g.bgTo, g.bgT), key = g.bgTo + Math.round(g.bgT * 8);
    let sky = this.skyCache.get(key);
    if (!sky) { sky = this.makeSky(pal); this.skyCache.set(key, sky); }
    ctx.drawImage(sky, 0, 0);
    ctx.drawImage(SPR.sun, SUN_X - 100, SUN_Y - 100);
    for (let k = 0; k < 3; k++) { // slow evening clouds
      const cl = SPR['cloud' + k], x = Math.round(((g.time * (2.5 + k) + k * 190) % (VW + 220)) - 110);
      ctx.drawImage(cl, x, 12 + k * 20 + (k & 1) * 6);
    }
    ctx.fillStyle = pal.sea[2]; ctx.fillRect(0, SEA_Y, VW, 10);
    ctx.fillStyle = pal.sea[1]; ctx.fillRect(0, SEA_Y + 10, VW, 10);
    ctx.fillStyle = pal.sea[0]; ctx.fillRect(0, SEA_Y + 20, VW, HY - SEA_Y - 20 + 4);
    ctx.fillStyle = '#fff0a8'; // sun glints on the water, twinkling
    for (let k = 0; k < 30; k++) {
      if (Math.sin(g.time * 2.2 + k * 1.7) < -0.15) continue;
      const dy = 2 + (k * 7) % 28, x = SUN_X + (rnd(k, 5) - 0.5) * (40 + dy * 4);
      ctx.fillRect(Math.round(x), SEA_Y + dy, 5 + (k % 4) * 3, 1);
    }
    const par = this.camW - this.sway * 0.06;
    for (const [key, speed] of LAYERS) for (const zone of ZONES) {
      const shift = this.zoneShift(zone, g);
      if (shift >= SINK) continue;
      const img = STRIP[zone + '_' + key], ox = -(((Math.floor(par * speed)) % STRIP_W) + STRIP_W) % STRIP_W, y = HY + 2 - img.height + Math.round(shift);
      ctx.drawImage(img, ox, y); ctx.drawImage(img, ox + STRIP_W, y);
    }
  }

  // ---------------------------------------------------------------- road + checkered verge
  drawRoad(w) {
    const ctx = this.ctx, camZ = this.camZ;
    for (let y = HY; y < VH; y++) {
      const t = (y + 0.5 - HY) / (VH - HY), d = K * (1 / t - 1), z = camZ + d;
      const stripe = d > 420 ? 0 : (Math.floor(z / 36) & 1);
      const bands = w.bandsAt(z), b0 = bands[0], b1 = bands[bands.length - 1];
      const sw = this.sway * (1 - t / S20), lp = LPX * t;
      const X = wx => Math.round(CX + (wx - this.camW) * lp + sw);
      const splitW = bands.length > 1 ? ((b0.hi + b0.off) + (b1.lo + b1.off)) / 2 : b0.off;
      const split = clamp(X(splitW), 0, VW);
      const pl = paletteFor(b0.eL.to, b0.eL.t), pr = paletteFor(b1.eR.to, b1.eR.t);
      ctx.fillStyle = pl.ground[0]; ctx.fillRect(0, y, split, 1);
      ctx.fillStyle = pr.ground[0]; ctx.fillRect(split, y, VW - split, 1);
      if (d < 650) this.checker(y, z, bands, splitW, pl, pr, sw, lp);
      // the chosen road is drawn last so it stays on top where the two roads overlap in the merge
      const order = bands.length > 1 && bands[0].chosen ? [bands[1], bands[0]] : bands;
      for (const b of order) {
        const pal = paletteFor(b.to, b.t);
        const a = X(b.lo + b.off), e = X(b.hi + b.off), cw = Math.max(1, Math.round(0.14 * LPX * t));
        ctx.fillStyle = pal.curb[stripe]; ctx.fillRect(a, y, e - a, 1);
        ctx.fillStyle = pal.road[stripe]; ctx.fillRect(a + cw, y, e - a - 2 * cw, 1);
        if (d < 320 && e - a > 8) { // paving flecks
          ctx.fillStyle = this.dark(pal.road[stripe]);
          const key = Math.floor(z / 7);
          for (let k = 0; k < 5; k++) ctx.fillRect(a + cw + Math.floor(rnd(key, k + 7 * (b.side + 2)) * (e - a - 2 * cw - 1)), y, 1 + (t > 0.5 ? 1 : 0), 1);
        }
      }
    }
  }

  dark(c) { this.dk = this.dk || {}; return this.dk[c] || (this.dk[c] = lerpHex(c, C.ink, 0.22)); }

  // Sonic-style checkerboard: earth tones on the verge next to the road, grass beyond; cells alternate by world x and z
  checker(y, z, bands, splitW, pl, pr, sw, lp) {
    const ctx = this.ctx, cs = 1.5, kz = Math.floor(z / 48);
    const wl = this.camW + (0 - CX - sw) / lp, wr = this.camW + (VW - CX - sw) / lp;
    const k0 = Math.floor(wl / cs), k1 = Math.floor(wr / cs);
    if (k1 - k0 > 30) return;
    for (let k = k0; k <= k1; k++) {
      const xa = Math.max(0, Math.round(CX + (k * cs - this.camW) * lp + sw)), xb = Math.min(VW, Math.round(CX + ((k + 1) * cs - this.camW) * lp + sw));
      if (xb <= xa) continue;
      const wc = (k + 0.5) * cs, pal = wc < splitW ? pl : pr;
      let near = false;
      for (const b of bands) if (wc > b.lo + b.off - 2.3 && wc < b.hi + b.off + 2.3) { near = true; break; }
      ctx.fillStyle = (near ? pal.earth : pal.ground)[(k + kz) & 1];
      ctx.fillRect(xa, y, xb - xa, 1);
    }
  }

  // ---------------------------------------------------------------- scenery, hazards, coins, runner
  drawObjects(g) {
    const ctx = this.ctx, w = g.world, p = g.p, camZ = this.camZ, list = [];
    const SLOT = 50, i0 = Math.floor(camZ / SLOT), i1 = Math.floor((camZ + MAXD) / SLOT);
    for (let i = i0; i <= i1; i++) {
      const z = i * SLOT + rnd(i, 9) * 20, bands = w.bandsAt(z);
      for (const b of bands) for (let e = 0; e < 2; e++) {
        const k = i * 8 + (b.side + 1) * 2 + e, inf = e ? b.eR : b.eL;
        const biome = rnd(k, 3) < inf.t ? BIOMES[inf.to] : BIOMES[w.baseBiome];
        if (rnd(k, 1) < biome.density) continue;
        const nm = biome.scenery[Math.floor(rnd(k, 4) * biome.scenery.length)], meta = SPRMETA[nm];
        // low props (bushes, rails, rocks) hug the road; palms, cliffs and ruins stand further back
        const off = meta.low ? 0.25 + rnd(k, 2) * 0.3 : biome.margin + rnd(k, 2) * 0.9;
        const X = (e ? b.hi + off : b.lo - off) + b.off;
        if (bands.some(o => o !== b && X > o.lo + o.off - 0.5 && X < o.hi + o.off + 0.5)) continue;
        list.push({ z, wx: X, spr: SPR[nm], lift: meta.lift || 0 });
        if (biome.deep) { // second row: the jungle closes in around the road
          const n2 = biome.scenery[Math.floor(rnd(k, 6) * biome.scenery.length)], m2 = SPRMETA[n2];
          list.push({ z: z + 12, wx: X + (e ? 1 : -1) * (0.8 + rnd(k, 5) * 0.5), spr: SPR[n2], lift: m2.lift || 0 });
        }
      }
    }
    for (const it of w.items) {
      if (it.taken || it.z < camZ - 4 || it.z > camZ + MAXD) continue;
      list.push({ z: it.z, wx: it.x + w.bandNear(it.z, it.x).off, it });
    }
    list.push({ z: p.z, player: true });
    list.sort((a, b) => b.z - a.z);

    for (const o of list) {
      const d = o.z - camZ, s = K / (d + K), sc = s / S20, sy = HY + (VH - HY) * s;
      if (o.player) { this.drawPlayer(g, CX + (p.x - g.camX) * LPX * S20, sy); continue; }
      let spr, lift = (o.lift || 0) * sc;
      if (o.it) {
        const it = o.it;
        if (it.kind === 'coin') { spr = SPR.coin[Math.floor(g.time * 10 + it.z / 20) & 7]; lift = (it.h * PXU - spr.height / 2) * sc; }
        else if (it.kind === 'prop') spr = SPR[it.spr];
        else spr = SPR[it.kind + '_' + w.themeAt(it.z, it.x)];
      } else spr = o.spr;
      const sw = Math.max(1, Math.round(spr.width * sc)), sh = Math.max(1, Math.round(spr.height * sc));
      ctx.drawImage(spr, Math.round(this.sx(o.wx, s) - sw / 2), Math.round(sy - sh - lift), sw, sh);
    }
  }

  drawPlayer(g, sx, feetY) {
    const ctx = this.ctx, p = g.p;
    feetY = Math.round(feetY); sx = Math.round(sx);
    ctx.globalAlpha = 0.35; ctx.fillStyle = C.ink; ctx.fillRect(sx - 12, feetY - 2, 24, 4); ctx.globalAlpha = 1;
    let spr;
    if (g.state === 'pause') spr = SPR.run0;
    else if (p.slide > 0) spr = SPR.slide; else if (p.jy > 0) spr = SPR.jump; else spr = SPR['run' + (Math.floor(g.time * 11) & 3)];
    ctx.drawImage(spr, sx - (spr.width >> 1), feetY - spr.height - Math.round(p.jy * PXU));
  }

  drawFx(g) {
    const ctx = this.ctx;
    for (const f of g.fx) {
      const x = Math.round(f.x), y = Math.round(f.y);
      if (f.anim === 'burst') { const sp = SPR.burst[Math.min(3, Math.floor((1 - f.t / f.life) * 4))]; ctx.drawImage(sp, x - (sp.width >> 1), y - (sp.height >> 1)); }
      else if (f.txt) { drawText(ctx, f.txt, x + 2, y + 2, C.ink, 2); drawText(ctx, f.txt, x, y, f.col, 2); }
      else { ctx.fillStyle = f.col; ctx.fillRect(x, y, f.s || 3, f.s || 3); }
    }
  }

  // jungle: shafts of low sun slanting through the leaves (dithered stripes)
  drawBeams(g) {
    const n = Math.round(g.canopy * 3);
    if (n < 1) return;
    const ctx = this.ctx; ctx.fillStyle = lerpHex('#ffe066', '#1f8a3a', 0.55);
    for (let i = 0; i < n; i++) {
      const x0 = 105 + i * 144 + Math.sin(g.time * 0.35 + i * 2) * 6 - this.sway * 0.3;
      for (let y = 36; y < 210; y += 3) ctx.fillRect(Math.round(x0 + (y - 36) * 0.3), y, 8, 1);
    }
  }

  // jungle: palm-frond ceiling that lowers as the jungle mix rises
  drawCanopy(g) {
    const m = Math.round(g.canopy * 6) / 6;
    if (m < 0.1) return;
    const img = STRIP.canopy, y = -Math.round((1 - m) * img.height), ox = -(((Math.floor(this.camW * 6)) % STRIP_W) + STRIP_W) % STRIP_W;
    this.ctx.drawImage(img, ox, y); this.ctx.drawImage(img, ox + STRIP_W, y);
  }

  // ---------------------------------------------------------------- interface (all text is the 3x5 pixel font at 2x+)
  txt(s, x, y, col, sc = 2, sh = C.ink) { const o = Math.max(1, sc >> 1); drawText(this.ctx, s, x + o, y + o, sh, sc); drawText(this.ctx, s, x, y, col, sc); }
  ctr(s, y, col, sc = 2, sh = C.ink) { this.txt(s, Math.round((VW - textW(s, sc)) / 2), y, col, sc, sh); }
  panel(x, y, w, h) {
    const c = this.ctx;
    c.fillStyle = C.ink; c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = C.amber; c.fillRect(x, y, w, h);
    c.fillStyle = C.amberD; c.fillRect(x, y + h - 3, w, 3);
    c.fillStyle = C.plum; c.fillRect(x + 3, y + 3, w - 6, h - 6);
    c.fillStyle = C.burgD; c.fillRect(x + 6, y + 6, w - 12, 2); c.fillRect(x + 6, y + h - 8, w - 12, 2);
    c.fillStyle = C.amberL; for (const [cx, cy] of [[x + 3, y + 3], [x + w - 6, y + 3], [x + 3, y + h - 6], [x + w - 6, y + h - 6]]) c.fillRect(cx, cy, 3, 3);
  }
  plate(x, y, w, h, edge = C.ink) {
    const c = this.ctx;
    c.fillStyle = edge; c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = C.plum; c.fillRect(x, y, w, h);
    c.fillStyle = C.burgD; c.fillRect(x, y + h - 2, w, 2);
  }
  button(b, g) {
    const m = g.mouse, hov = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h, pr = hov && m.down, c = this.ctx;
    c.fillStyle = C.ink; c.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    c.fillStyle = pr ? C.amberD : hov ? C.amberL : C.amber; c.fillRect(b.x, b.y, b.w, b.h);
    if (!pr) { c.fillStyle = C.amberD; c.fillRect(b.x, b.y + b.h - 3, b.w, 3); c.fillStyle = C.amberL; c.fillRect(b.x, b.y, b.w, 2); }
    drawText(c, b.label, Math.round(b.x + (b.w - textW(b.label, 3)) / 2), b.y + 5 + (pr ? 2 : 0), C.ink, 3);
  }

  drawTouch(g) {
    if (!g.touch || g.state !== 'play') return;
    const c = this.ctx, on = new Set(Object.values(g.held));
    for (const t of TOUCH) {
      const hot = on.has(t.id), cx = t.x + (t.w >> 1), cy = t.y + (t.h >> 1), u = 2;
      c.globalAlpha = 0.85;
      c.fillStyle = C.ink; c.fillRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4);
      c.fillStyle = hot ? C.burgD : C.plum; c.fillRect(t.x, t.y, t.w, t.h);
      c.fillStyle = hot ? C.amberL : C.amber; c.fillRect(t.x, t.y, t.w, 2); c.fillRect(t.x, t.y + t.h - 2, t.w, 2);
      c.globalAlpha = 1; c.fillStyle = hot ? C.amberL : C.bone;
      if (t.id === 'pause') { c.fillRect(cx - 5, cy - 5, 3, 10); c.fillRect(cx + 2, cy - 5, 3, 10); continue; }
      for (let i = 0; i < 7; i++) {
        if (t.id === 'left') c.fillRect(cx - 5 * u + i * u, cy - i * u, u, (2 * i + 1) * u);
        else if (t.id === 'right') c.fillRect(cx + 5 * u - i * u - u, cy - i * u, u, (2 * i + 1) * u);
        else if (t.id === 'jump') c.fillRect(cx - i * u, cy - 5 * u + i * u, (2 * i + 1) * u, u);
        else c.fillRect(cx - i * u, cy + 5 * u - i * u - u, (2 * i + 1) * u, u);
      }
    }
  }

  drawHud(g) {
    const w = g.world, p = g.p, T = w.track, pulse = g.coinPulse > 0;
    this.plate(6, 6, 104, 46);
    this.txt('DIST ' + Math.floor(p.z / 10) + ' M', 14, 12, C.bone);
    this.ctx.drawImage(SPR.coin[pulse ? 1 : 0], 12, pulse ? 27 : 28);
    this.txt('' + g.coins, 40, 33, pulse ? C.bone : C.amberL);
    const nm = T.segments[w.playerBand(p.z, p.x).route].name, nw = textW(nm, 2) + 20;
    this.plate(VW - 6 - nw, 6, nw, 22);
    this.txt(nm, VW - 6 - nw + 10, 12, C.tealL);
    if (g.prompt && g.state === 'play') { // junction visible: LEFT / RIGHT with the current pick highlighted
      const f = g.prompt.fork, sel = g.prompt.sel;
      const l = '< LEFT: ' + T.segments[f.left.route].name, r = 'RIGHT: ' + T.segments[f.right.route].name + ' >';
      const lw = textW(l, 2) + 20, rw = textW(r, 2) + 20;
      this.plate(8, 62, lw, 22, sel === 'left' ? C.amber : C.ink);
      this.txt(l, 18, 68, sel === 'left' ? C.amberL : C.stoneL);
      this.plate(VW - 8 - rw, 62, rw, 22, sel === 'right' ? C.amber : C.ink);
      this.txt(r, VW - 8 - rw + 10, 68, sel === 'right' ? C.amberL : C.stoneL);
    } else if (g.banner && g.banner.t > 0) {
      const bw = textW(g.banner.text, 3) + 28;
      this.plate(Math.round((VW - bw) / 2), 40, bw, 30, C.amber);
      this.ctr(g.banner.text, 47, C.amberL, 3);
    }
  }

  drawTitle(g) {
    this.ctx.drawImage(SPR.signJungle, 14, 150); this.ctx.drawImage(SPR.signCliffs, VW - 14 - SPR.signCliffs.width, 150); // the two roads flank the panel
    this.panel(90, 40, 300, 196);
    this.ctr('WAYFARER', 56, C.amber, 6, C.burgD);
    this.ctr('PROTOTYPE 01', 104, C.tealL);
    if (g.touch) {
      this.ctr('HOLD < > TO STEER', 126, C.bone);
      this.ctr('UP  JUMP   DOWN  SLIDE', 141, C.bone);
      this.ctr('II  PAUSE', 156, C.bone);
    } else {
      this.ctr('A D / ARROWS  STEER', 126, C.bone);
      this.ctr('SPACE / UP  JUMP', 141, C.bone);
      this.ctr('DOWN  SLIDE   P  PAUSE', 156, C.bone);
    }
    this.ctr('TAKE A FORK. PICK A ROAD.', 172, C.sand);
    this.button(BTN.title, g);
    if (!g.touch) this.ctr('OR PRESS ENTER', 220, C.stoneL);
  }

  drawPause(g) {
    this.ctx.fillStyle = this.dither; this.ctx.fillRect(0, 0, VW, VH);
    this.panel(150, 84, 180, 110);
    this.ctr('PAUSED', 98, C.amber, 4, C.burgD);
    this.button(BTN.pause, g);
    if (!g.touch) this.ctr('P  ESC', 170, C.stoneL);
  }

  drawOver(g) {
    this.ctx.fillStyle = this.dither; this.ctx.fillRect(0, 0, VW, VH);
    this.panel(120, 44, 240, 180);
    this.ctr('GAME OVER', 58, C.burgL, 4, C.ink);
    this.ctr('DIST ' + Math.floor(g.p.z / 10) + ' M', 98, C.bone);
    this.ctr('COINS ' + g.coins, 114, C.amberL);
    this.ctr('SCORE ' + g.score(), 132, C.bone);
    this.ctr('BEST ' + g.best, 148, C.tealL);
    this.button(BTN.over, g);
    if (!g.touch) this.ctr('SPACE  ENTER  R', 206, C.sand);
  }
}
