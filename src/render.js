// Canvas renderer: sky/parallax, perspective road with curves, depth-sorted objects, HUD and overlays.
// Every world->screen x goes through the same formula: perspective scale + a "sway" term that is zero
// at the player's depth, so the road can lean toward a chosen branch while the runner stays put.
const LOW_PROPS = new Set(['lamp', 'fenceC', 'fenceW', 'bench', 'rock', 'bush', 'shopSign']); // hug the road edge
const PARALLAX = [['far', 4, 0], ['mid', 9, 1], ['near', 18, 2]];                              // layer, speed, colour index

class Renderer {
  constructor(cv) {
    this.ctx = cv.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    buildSprites();
    this.layers = { city: Skyline.city(), forest: Skyline.forest() };
    const pc = mk(2, 2, r => { r(C.ink, 0, 0, 1, 1); r(C.ink, 1, 1, 1, 1); });
    this.dither = this.ctx.createPattern(pc, 'repeat');
    this.dk = {};
  }

  sx(wx, s) { return 160 + (wx - this.camW) * LPX * s + this.sway * (1 - s / S20); }
  dark(c) { return this.dk[c] || (this.dk[c] = lerpHex(c, C.ink, 0.22)); }

  draw(g) {
    const ctx = this.ctx, p = g.p;
    this.camW = g.camX + g.camOff; this.sway = g.sway; this.camZ = p.z - PLAYER_D;
    ctx.save();
    if (g.shake > 0) ctx.translate(Math.round(Math.sin(g.time * 90) * g.shake * 8), Math.round(Math.cos(g.time * 70) * g.shake * 6));
    this.drawSky(g);
    this.drawRoad(g.world);
    this.drawObjects(g);
    this.drawBeams(g);
    this.drawCanopy(g);
    for (const f of g.fx) {
      const x = Math.round(f.x), y = Math.round(f.y);
      if (f.txt) { drawText(ctx, f.txt, x + 1, y + 1, C.ink); drawText(ctx, f.txt, x, y, f.col); }
      else { ctx.fillStyle = f.col; ctx.fillRect(x, y, f.s || 2, f.s || 2); }
    }
    ctx.restore();
    this.drawUI(g);
  }

  // the race zone's HUD: two progress bars (the player in turquoise, the robot in red), the gap, the speed, the boost or brake, the rare tokens, the countdown and the result
  drawRaceHud(g) {
    const R = g.race, p = R.p, ctx = this.ctx, x0 = 80, w = 160, gap = R.gap(), kmh = Math.round(p.speed * 3.6);
    if (R.kart) this.holo(x0 - 30, 3, w + 36, 25, g.time, 4, true); else { ctx.fillStyle = 'rgba(8,4,16,0.72)'; ctx.fillRect(x0 - 4, 3, w + 8, 27); }      // (the kart: the gauges in the holographic panel)
    const bh = R.kart ? 2 : 5, bar = (frac, y, col) => { y += R.kart ? 1 : 0; ctx.fillStyle = R.kart ? 'rgba(4,30,44,0.3)' : '#1a1030'; ctx.fillRect(x0, y, w, bh); ctx.fillStyle = col; ctx.fillRect(x0, y, Math.round(w * Math.max(0, Math.min(1, frac))), bh); ctx.fillStyle = '#fff'; ctx.fillRect(x0 + Math.round(w * Math.max(0, Math.min(1, frac))) - 1, y - 1, R.kart ? 1 : 2, bh + 2); };
    bar(R.pos() / R.len, 6, '#35e6ff'); bar(R.bot.s / R.len, 16, R.kart ? '#ff9a2a' : '#ff2a4a');
    this.txt('YOU', x0 - 24, 5, '#35e6ff'); this.txt('BOT', x0 - 24, 15, R.kart ? '#ff9a2a' : '#ff2a4a');
    if (R.kart && g.speedFeel > 0.15 && g.speedFoe) { const sf = g.speedFeel, tt = performance.now() / 1000, cx = g.speedFoe.x * 320, cy = g.speedFoe.y * 180;      // (they radiate from where the vehicle is heading on the screen: look away and they move with it)      // SPEED LINES (the user: feel the speed): short rays streak outward from the edges of the screen, more and longer the faster you go
      for (let i = 0; i < 12; i++) { const ang = i * 2.399963 + Math.floor(tt * 3 + i) * 0.7, ph = (tt * (1.2 + sf * 2.2) + i * 0.37) % 1, r0 = 84 + ph * 80, len = 5 + sf * 16 * ph, col = i % 3 === 0 ? '#ff7ad9' : '#35f0ff';
        if (ph < 0.15) continue; const nx = Math.cos(ang), ny = Math.sin(ang) * 0.62; for (let s = 0; s < len; s += 2) { const x = Math.round(cx + nx * (r0 + s)), y = Math.round(cy + ny * (r0 + s)); if (x < 0 || x > 319 || y < 14 || y > 179) break; this.ctx.globalAlpha = 0.06 + 0.2 * sf * (1 - s / len); this.ctx.fillStyle = col; this.ctx.fillRect(x, y, 1, 1); } }
      this.ctx.globalAlpha = 1; }
    if (R.kart) this.drawComm(g, R.keepLeft(p.s) && p.lane > -1);      // the detour's notification, as a holographic comm panel      // (the detour: blinking until the kart is in the left lane)
    if (R.kart && typeof location !== 'undefined' && /[?&]xrDebug=1/.test(location.search) && g.r && g.r.kart3d) {      // ?xrDebug=1: the numbers of the VR camera on the HUD, for tuning on a headset (the rig's and the camera's height, the kart's, where on the track)
      const K = g.r.kart3d, w = typeof THREE !== 'undefined' ? new THREE.Vector3() : null; if (w) K.camera.getWorldPosition(w); const rg = g.r.xr && g.r.xr.rigRace;
      this.txt('XR ' + (g.vr ? 'ON' : 'off') + ' s ' + Math.round(p.s) + ' dep ' + R.dep(p.s).toFixed(1), 6, 150, '#ffd24a'); this.txt('rig y ' + (rg ? rg.position.y.toFixed(1) : '-') + ' cam y ' + (w ? w.y.toFixed(1) : '-') + ' car y ' + K.car.position.y.toFixed(1), 6, 158, '#ffd24a'); this.txt('head ' + (g.r.xr ? g.r.xr.head.toFixed(2) : '-') + ' rigscene ' + (rg && rg.parent === K.scene ? 'kart' : 'OTHER') + ' camparent ' + (K.camera.parent === rg ? 'rig' : 'NONE'), 6, 166, '#ffd24a'); }
    if (R.kart && p.away && p.away.k >= 0 && g.identHint) { const H = g.identHint, w = H.warn >= 1 && Math.floor(performance.now() / 400) % 2 === 0; this.ctr((H.side === 'left' ? '<<< ' : '') + 'REGARDEZ CET ECRAN' + (H.side === 'right' ? ' >>>' : ''), 46, w ? '#ffb030' : '#35f0ff'); }      // (the identification: which way to turn the view; drag, or turn the head)
    if (R.kart && p.away && p.away.k >= 0) { const A = p.away; this.ctr('RING ' + (A.k + 1) + '/' + KART.PORT_RINGS.length + '   LAP ' + Math.min(100, Math.round(A.th / (2 * Math.PI) * 100)) + '%   (THE RACE GOES ON)', 33, '#b040ff'); }      // (the ring tour: the race stands still)
    else if (R.kart) { const pl = R.place(), lap = Math.min(KART.LAPS, 1 + Math.floor(R.pos() / KART.LAP)); this.ctr('TOUR ' + lap + '/' + KART.LAPS + '   PLACE ' + pl + '/' + (R.bots.length + 1), 33, pl === 1 ? '#7affc8' : '#ffd24a'); }      // (the kart: the player's place among the nine karts)
    else this.ctr(gap > 0 ? 'ROBOT +' + Math.round(gap) + ' M' : 'YOU +' + Math.round(-gap) + ' M', 33, gap > 0 ? '#ff6a7a' : '#7affc8');
    this.txt('RARE ' + g.rare, 6, 6, '#ffd24a');
    this.ctr(kmh + ' KM/H', 160, '#f2ead6');
    if (p.brakeT > 0) this.ctr('BRAKE', 146, '#ff4fd8'); else if (p.hitT > 0) this.ctr('HIT', 146, '#ff4a4a'); else if (p.boostT > 0) this.ctr('BOOST +' + Math.round(p.boost * 3.6), 146, ['#ff5a6a', '#d070ff', '#7aff40', '#d8ff30'][RACE.SPIRAL.findIndex(c => c.add === p.boost)] || '#fff');
    if (p.pedal && !(p.brakeT > 0 || p.hitT > 0 || p.boostT > 0)) this.ctr(p.pedal === 'brake' ? 'BRAKE' : 'ACCEL', 146, p.pedal === 'brake' ? '#ff8aa0' : '#7affc8');      // the pedals (held)
    if (R.menu) {                                                                          // THE KART QUICK MENU: a see-through panel over the circuit
      this.holo(84, 40, 152, 112, g.time, 9); this.txt('CALAGTIC // KART', 90, 44, '#ff9a2a');      /* (the zone's name, the user: CALAGTIC) */ if (Math.floor(g.time * 2) % 2) { ctx.fillStyle = '#ff9a2a'; ctx.fillRect(226, 44, 4, 4); }
      const vrOk = !!(g.r && g.r.xr && g.r.xr.button);
      for (const b of KMENU) {                                                             // see-through buttons with a neon edge (green; turquoise under the pointer; grey when VR is not available)
        const m = g.mouse, hov = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h, off = b.id === 'vr' && !vrOk, col = off ? '#6a7890' : hov ? '#ffffff' : '#bff8ff';
        ctx.fillStyle = hov && !off ? 'rgba(60,230,255,0.28)' : 'rgba(10,60,90,0.35)'; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = off ? '#4a5060' : hov ? '#ffd27a' : '#ff9a2a'; ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1); ctx.fillRect(b.x, b.y, 2, b.h); ctx.fillRect(b.x + b.w - 2, b.y, 2, b.h);
        this.txt(b.label, Math.round(b.x + (b.w - textW(b.label, 2)) / 2), b.y + 3, col, 2, '#0a3a4a');
      }
      if (!(g.r && g.r.xr && g.r.xr.button)) this.ctr('VR: CASQUE REQUIS', 138, '#8a86a0');
      return;
    }
    const cy = R.kart ? 44 : 70, cs = R.kart ? 4 : 6;      // (the kart's camera is close: the countdown stands above the kart, not over it, in neon green)
    if (R.intro > 0) { this.ctr('TOUCHE POUR PASSER', 146, '#c8c0e0'); return; }      // (the kart's flyover: no countdown yet, nothing but the hint)
    if (R.cd > 0) this.ctr(R.cd > 0.5 ? String(Math.ceil(R.cd - 0.5)) : 'GO', cy, R.kart ? '#2bff6a' : '#fff', cs);
    else if (R.t < 1.2) this.ctr('GO', cy, '#7affc8', cs);
    if (R.done && R.honour) { const H = R.honour, msg = { brake: 'FIRST TO THE HALL', slide: 'THE LIFT OPENS', open: 'THE LIFT OPENS', down: 'GOING DOWN', free: 'HONOUR LAP' }[H.ph]; ctx.fillStyle = 'rgba(8,4,16,0.55)'; ctx.fillRect(0, H.ph === 'free' ? 58 : 62, VW, H.ph === 'free' ? 24 : 38); this.ctr(msg, H.ph === 'free' ? 60 : 66, '#7affc8', H.ph === 'free' ? 2 : 3); if (H.ph !== 'free') this.ctr(H.ph === 'brake' ? 'YOU WIN  +30 COINS' : 'HONOUR LAP', 90, '#f2ead6'); else this.ctr('ENTER: LEAVE', 73, '#a090c0'); }
    else if (R.done) { const win = R.result === 'win'; ctx.fillStyle = 'rgba(8,4,16,0.6)'; ctx.fillRect(0, 62, VW, 54); this.ctr(win ? 'YOU WIN' : 'ROBOT WINS', 68, win ? '#7affc8' : '#ff6a7a', 4); this.ctr(win ? '+30 COINS' : 'BACK TO THE ROAD', 98, '#f2ead6'); this.ctr('THE SPHERE IS CLOSED UNTIL THE NEXT ZONE', 108, '#a090c0'); }
  }

  // THE COMM PANEL (the user: a pop-up like a virtual communication on a sophisticated spaceship: an orange frame, inside a see-through blue glass a little turquoise): it pops open
  // (grows from a line in 0.25 s), hums (scanlines, a faint flicker), and folds away when the kart is in the left lane
  // the holographic panel of the kart circuit: blue-turquoise see-through glass, drifting scanlines, a glint, an orange frame with corner brackets
  holo(x0, y0, W, h, t, c, lite) {
    const ctx = this.ctx; c = c || 7; const q = lite ? 0.45 : 1, bw = lite ? 1 : 2;      // (lite: more see-through, thinner brackets)
    ctx.fillStyle = 'rgba(20,120,170,' + (0.30 * q) + ')'; ctx.fillRect(x0, y0, W, h);
    ctx.fillStyle = 'rgba(60,230,255,' + (0.10 * q) + ')'; for (let y = y0 + ((t * 20) | 0) % 3; y < y0 + h; y += 3) ctx.fillRect(x0 + 1, y, W - 2, 1);
    ctx.fillStyle = 'rgba(140,250,255,0.18)'; ctx.fillRect(x0 + 1, y0 + 1, W - 2, 1);
    ctx.fillStyle = 'rgba(255,154,42,' + (0.55 * q) + ')'; ctx.fillRect(x0, y0, W, 1); ctx.fillRect(x0, y0 + h - 1, W, 1); ctx.fillRect(x0, y0, 1, h); ctx.fillRect(x0 + W - 1, y0, 1, h);
    ctx.fillStyle = '#ff9a2a'; for (const [bx, by, sx, sy] of [[x0, y0, 1, 1], [x0 + W, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + W, y0 + h, -1, -1]]) { ctx.fillRect(sx > 0 ? bx - 1 : bx - c + 1, sy > 0 ? by - 1 : by - bw, c, bw); ctx.fillRect(sx > 0 ? bx - 1 : bx - bw + 1, sy > 0 ? by - 1 : by - c + 1, bw, Math.min(c, h + 2)); }
  }
  drawComm(g, on) {
    const ctx = this.ctx, t = g.time; this.commK = Math.max(0, Math.min(1, (this.commK || 0) + (on ? 1 : -1) * (this._commT === undefined ? 0 : Math.max(0, t - this._commT)) * 4)); this._commT = t;
    const k = this.commK; if (k <= 0.01) return;
    const W = 150, H = 26, x0 = (VW - W) / 2, cy = 88, h = Math.max(2, Math.round(H * k)), y0 = Math.round(cy - h / 2), fl = 0.9 + 0.1 * Math.sin(t * 37) * Math.sin(t * 11);
    ctx.save(); ctx.globalAlpha = fl;
    this.holo(x0, y0, W, h, t, 7); const o = '#ff9a2a';                                                                          // the orange frame: thin edges and heavier corner brackets
    if (k > 0.85) {
      ctx.globalAlpha = fl * (k - 0.85) / 0.15;
      this.txt('COMM // NAV', x0 + 5, y0 + 3, o); if (Math.floor(t * 2) % 2) { ctx.fillStyle = o; ctx.fillRect(x0 + W - 8, y0 + 3, 3, 3); }      // the live light
      const msg = '<< SERREZ A GAUCHE'; this.txt(msg, Math.round(x0 + (W - textW(msg, 1)) / 2), y0 + 14, '#bff8ff', 1, '#0a3a4a');
    }
    ctx.restore();
  }

  // HUD, touch controls and screens; also used on its own as the overlay of the 3D front end
  drawUI(g) {
    const ctx = this.ctx;
    if (this._glassShown && !this.menuKind(g) && !g.racePaused) this.hideGlass();      // (the frosted panes of a menu go when the menu does)
    if (this._map && this._map.on && !(g.state === 'title' && this.menu3d && !g.vr)) { this._map.cv.style.display = 'none'; this._map.on = false; g.mapOn = false; }
    const HUD = this.hudOn(g) ? (this._hud = []) : null;                              // the HUD's lettering goes to its own smooth layer (Renderer.flushHud); its plates, bars and icons stay on the pixel canvas
    if (g.state === 'race' && g.race) { this.drawRaceHud(g); this.drawTouch(g); if (g.fadeIn > 0) this.drawSceneOverlay(g); this._hud = null; this.flushHud(g, HUD); return; }
    if (g.racePaused) { this.drawRaceHud(g); this.drawTouch(g); this._hud = null; this.flushHud(g, HUD); const hq = this.hiMenu(g) ? (this._hq = []) : null; this._glassOn = !!(hq && this.menu3d && typeof document !== 'undefined'); this._gp = []; this._gb = []; if (g.settingsOpen) this.drawSettings(g); else this.drawPause(g); this._hq = null; if (hq) { this.drawMenuHi(g, this.touchLayer(), hq); this.applyGlass(); } this._glassOn = false; if (g.sfx) this.drawSoundBtn(g); if (g.hasSettings) this.drawGearBtn(g); return; }      // a paused race: its own HUD under the same PAUSED panel as the run's
    // (g.vr: the 3D build in immersive VR, src3d/xr3d.js. This canvas is then a floating panel, so what covers the whole screen (the flash, the portal light, the fades, the letterbox) and the
    // screen-space scooter disc are left out of it, and so are the keyboard / touch hints; nothing else changes)
    if (g.state === 'over' && g.flash > 0 && !g.vr) { ctx.globalAlpha = 0.5; ctx.fillStyle = C.burg; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    if (g.portal && (g.portal.k > 0.004 || g.portal.flash > 0.01) && g.state !== 'title' && !g.vr) this.drawPortalFx(g);              // the journey through a Stargate, under the HUD
    if (g.state !== 'title') this.drawHud(g);
    this.drawTouch(g);
    if (g.state === 'play' && !g.vr) this.drawScooterHint(g);
    if (g.scene || g.fadeIn > 0) this.drawSceneOverlay(g);
    this._hud = null; this.flushHud(g, HUD);
    const hq = this.menuKind(g) && this.hiMenu(g) ? (this._hq = []) : null;      // the menus: their panels and button faces on the pixel canvas, their lettering on the smooth layer
    this._glassOn = !!(hq && this.menu3d && typeof document !== 'undefined'); this._gp = []; this._gb = [];
    if (g.settingsOpen && (g.state === 'title' || g.state === 'pause')) { if (g.state === 'title' && this._glassOn) this.drawMap(g); this.drawSettings(g); }
    else if (g.state === 'title') { if (this._glassOn) this.drawMap(g); this.drawTitle(g); }
    else if (g.state === 'pause') this.drawPause(g);
    else if (g.state === 'over' && g.overT > g.overDelay) this.drawOver(g);
    this._hq = null; if (hq) { this.drawMenuHi(g, this.touchLayer(), hq); this.applyGlass(); } this._glassOn = false;
    if (g.sfx && g.state !== 'play' && g.state !== 'scene') this.drawSoundBtn(g);
    if (g.hasSettings && (g.state === 'title' || g.state === 'pause')) this.drawGearBtn(g);
  }

  // the settings icon (a small gear, beside the sound icon)
  drawGearBtn(g) {
    const b = BTN.gear, c = this.ctx, m = g.mouse, hov = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h, cx = b.x + 9, cy = b.y + 8, col = g.settingsOpen ? Renderer.THEME.pinkL : C.tealL;
    c.fillStyle = C.ink; c.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2); c.fillStyle = hov ? '#3a2d52' : C.plum; c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = col; c.fillRect(cx - 1, cy - 6, 2, 12); c.fillRect(cx - 6, cy - 1, 12, 2); for (const [dx, dy] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) c.fillRect(cx + dx, cy + dy, 2, 2);      // the teeth
    c.fillRect(cx - 3, cy - 3, 6, 6); c.fillRect(cx - 4, cy - 2, 8, 4); c.fillRect(cx - 2, cy - 4, 4, 8); c.fillStyle = hov ? '#3a2d52' : C.plum; c.fillRect(cx - 1, cy - 1, 2, 2);                // the wheel and its hole
  }
  // THE SETTINGS CARD (SETTINGS, src/game.js): a row per setting, its name on the left and a pill with its value on the right (pink when on, grey when off or low), and CLOSE
  drawSettings(g) {
    const S = SETTINGS, T = Renderer.THEME;
    if (g.state === 'pause') { this.ctx.fillStyle = this.dither; this.ctx.fillRect(0, 0, VW, VH); }
    this.panel(S.card.x, S.card.y, S.card.w, S.card.h, 11);
    if (!this.hiMenu(g)) this.ctr('SETTINGS', 30, T.pinkL, 2, T.ink);
    S.rows.forEach((r, i) => { const y = S.rowY(i), v = g.opt[r.id]; this.txt(r.n, S.card.x + 12, y + 4, T.text, 1); this.button({ x: S.pill.x, y, w: S.pill.w, h: S.pill.h, label: r.vals[v], dim: r.id === 'quality' ? v === 1 : v === 0 }, g); });
    this.button(S.close, g);
    if (!g.touch && !g.vr) this.ctr('ESC  CLOSE', 161, T.dim, 1);
  }
  // the sound on / off icon (bottom-right of the menu, pause and game-over screens): a speaker with waves when on, crossed out when off
  drawSoundBtn(g) {
    const b = BTN.sound, c = this.ctx, m = g.mouse, hov = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h, off = g.sfx.muted;
    c.fillStyle = C.ink; c.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2); c.fillStyle = hov ? '#3a2d52' : C.plum; c.fillRect(b.x, b.y, b.w, b.h);
    const x = b.x + 3, y = b.y + 4, col = off ? C.stoneD : C.tealL;
    c.fillStyle = col; c.fillRect(x, y + 3, 3, 4); c.fillRect(x + 3, y + 2, 1, 6); c.fillRect(x + 4, y + 1, 1, 8); c.fillRect(x + 5, y, 1, 10);
    if (off) { c.fillStyle = C.terraL; for (let k = 0; k < 6; k++) { c.fillRect(x + 8 + k, y + 2 + k, 1, 1); c.fillRect(x + 13 - k, y + 2 + k, 1, 1); } }
    else { c.fillStyle = col; c.fillRect(x + 8, y + 3, 1, 4); c.fillRect(x + 10, y + 1, 1, 8); }
  }

  drawSky(g) {
    const ctx = this.ctx, pal = paletteFor(g.bgTo, g.bgT);
    [[0, 22], [22, 18], [40, 14], [54, 10]].forEach(([y, h], i) => { ctx.fillStyle = pal.sky[i]; ctx.fillRect(0, y, VW, h); });
    const toF = BIOMES[g.bgTo].skyline === 'forest', t = g.bgT;
    const sunY = 52 + (toF ? t * 16 : 0);
    ctx.fillStyle = C.amberL; ctx.fillRect(228, sunY - 10, 16, 20); ctx.fillRect(225, sunY - 6, 22, 12); ctx.fillRect(227, sunY - 8, 18, 16);
    if ((toF ? 1 - t : 1) > 0.4) { // city: a few slow, flat evening clouds
      const cc = lerpHex(pal.sky[2], pal.sky[3], 0.6), cs = lerpHex(cc, C.burg, 0.45);
      for (let k = 0; k < 3; k++) {
        const x = Math.round(((g.time * 2.5 + k * 130) % (VW + 80)) - 40), y = 14 + k * 10 + (k & 1) * 4;
        ctx.fillStyle = cc; ctx.fillRect(x + 6, y, 16, 2); ctx.fillRect(x, y + 2, 30, 3);
        ctx.fillStyle = cs; ctx.fillRect(x + 2, y + 5, 26, 1);
      }
    }
    const cityShift = toF ? t * 46 : 0, forestShift = toF ? (1 - t) * 46 : 46;
    const L = this.layers, par = this.camW - this.sway * 0.06, N = Skyline.N;
    for (const [key, k, ci] of PARALLAX) {
      this.layer(L.city[key], BIOMES.city.layers[ci], par * k, cityShift);
      if (key === 'mid') {
        const off = Math.floor(par * k); ctx.fillStyle = C.amber;
        for (const [lx, ly] of L.city.lights) { const sx = (((lx - off) % N) + N) % N; if (sx < VW) ctx.fillRect(sx, HY - ly + Math.round(cityShift), 1, 2); }
      }
      this.layer(L.forest[key], BIOMES.forest.layers[ci], par * k, forestShift);
    }
  }

  layer(arr, col, off, shift) {
    if (shift >= 46) return;
    const ctx = this.ctx, N = Skyline.N; off = Math.floor(off); ctx.fillStyle = col;
    for (let x = 0; x < VW;) {
      const idx = (((x + off) % N) + N) % N, h = arr[idx]; let run = 1;
      while (x + run < VW && arr[(((x + run + off) % N) + N) % N] === h) run++;
      if (h > 0) ctx.fillRect(x, HY - h + Math.round(shift), run, h + 2);
      x += run;
    }
  }

  drawRoad(w) {
    const ctx = this.ctx, camZ = this.camZ;
    for (let y = HY; y < VH; y++) {
      const t = (y + 0.5 - HY) / (VH - HY), d = K * (1 / t - 1), z = camZ + d;
      const stripe = d > 420 ? 0 : (Math.floor(z / 36) & 1);
      const bands = w.bandsAt(z), b0 = bands[0], b1 = bands[bands.length - 1];
      const X = wx => Math.round(this.sx(wx, t));
      const split = clamp(bands.length > 1 ? Math.round((X(b0.hi + b0.off) + X(b1.lo + b1.off)) / 2) : X(b0.off), 0, VW);
      const pl = paletteFor(b0.eL.to, b0.eL.t), pr = paletteFor(b1.eR.to, b1.eR.t);
      ctx.fillStyle = pl.ground[stripe]; ctx.fillRect(0, y, split, 1);
      ctx.fillStyle = pr.ground[stripe]; ctx.fillRect(split, y, VW - split, 1);
      // the chosen road is drawn last so it stays on top where the two roads overlap in the merge
      const order = bands.length > 1 && bands[0].chosen ? [bands[1], bands[0]] : bands;
      for (const b of order) {
        const pal = paletteFor(b.to, b.t);
        const a = X(b.lo + b.off), e = X(b.hi + b.off), cw = Math.max(1, Math.round(0.14 * LPX * t));
        ctx.fillStyle = pal.curb[stripe]; ctx.fillRect(a, y, e - a, 1);
        ctx.fillStyle = pal.road[stripe]; ctx.fillRect(a + cw, y, e - a - 2 * cw, 1);
        if (bands.length === 1 && stripe === 0) {
          const lw = Math.max(1, Math.round(0.05 * LPX * t));
          ctx.fillStyle = pal.line; ctx.fillRect(X(b.off) - (lw >> 1), y, lw, 1);
        }
        if (d < 300) this.roadDetail(w, b, z, y, t, a + cw, e - cw, stripe, pal, X);
      }
    }
  }

  // cobblestone flecks on city roads, wheel ruts and pebbles on forest tracks
  roadDetail(w, b, z, y, t, x0, x1, stripe, pal, X) {
    const ctx = this.ctx, bi = BIOMES[b.t > 0.5 ? b.to : w.baseBiome], dc = this.dark(pal.road[stripe]);
    if (x1 - x0 < 4) return;
    ctx.fillStyle = dc;
    if (bi.detail === 'cobble') {
      const key = Math.floor(z / 7);
      for (let k = 0; k < 4; k++) ctx.fillRect(x0 + Math.floor(rnd(key, k + 7 * (b.side + 2)) * (x1 - x0 - 1)), y, 1 + (t > 0.5 ? 1 : 0), 1);
    } else {
      const c = (b.lo + b.hi) / 2 + b.off, rw = Math.max(1, Math.round(0.04 * LPX * t));
      ctx.fillRect(X(c - 0.3) - (rw >> 1), y, rw, 1); ctx.fillRect(X(c + 0.3) - (rw >> 1), y, rw, 1);
      const key = Math.floor(z / 11);
      if (rnd(key, 3 + b.side) > 0.6) { ctx.fillStyle = pal.curb[0]; ctx.fillRect(x0 + Math.floor(rnd(key, 5) * (x1 - x0 - 1)), y, 1, 1); }
    }
  }

  drawObjects(g) {
    const ctx = this.ctx, w = g.world, p = g.p, camZ = this.camZ, list = [];
    const SLOT = 50, i0 = Math.floor(camZ / SLOT), i1 = Math.floor((camZ + MAXD) / SLOT);
    for (let i = i0; i <= i1; i++) {
      const z = i * SLOT + rnd(i, 9) * 20, bands = w.bandsAt(z);
      for (const b of bands) for (let e = 0; e < 2; e++) {
        const k = i * 8 + (b.side + 1) * 2 + e, inf = e ? b.eR : b.eL;
        const biome = rnd(k, 3) < inf.t ? BIOMES[inf.to] : BIOMES[w.baseBiome];
        if (rnd(k, 1) < biome.density) continue;
        const nm = biome.scenery[Math.floor(rnd(k, 4) * biome.scenery.length)];
        // low props (lamps, fences, rocks) hug the road; buildings and trees stand further back
        const off = LOW_PROPS.has(nm) ? 0.22 + rnd(k, 2) * 0.3 : biome.margin + rnd(k, 2) * 0.9;
        const X = (e ? b.hi + off : b.lo - off) + b.off;
        if (bands.some(o => o !== b && X > o.lo + o.off - 0.5 && X < o.hi + o.off + 0.5)) continue;
        list.push({ z, wx: X, spr: SPR[nm] });
        if (biome.deep) // second row: forests close in around the road
          list.push({ z: z + 12, wx: X + (e ? 1 : -1) * (0.7 + rnd(k, 5) * 0.5), spr: SPR[biome.scenery[Math.floor(rnd(k, 6) * 5)]] });
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
      if (o.player) { this.drawPlayer(g, 160 + (p.x - g.camX) * LPX * S20, sy); continue; }
      let spr, lift = 0;
      if (o.it) {
        const it = o.it;
        if (it.kind === 'coin') { spr = SPR.coin[Math.floor(g.time * 8 + it.z / 20) & 3]; lift = (it.h - 4) * sc; }
        else if (it.kind === 'prop') spr = SPR[it.spr];
        else if (it.kind === 'crate' || it.kind === 'vicHigh' || it.kind === 'vicBarrel' || it.kind === 'vicPot') spr = SPR.crate;
        else { const kk = it.kind === 'vicLow' || it.kind === 'vicChairs' || it.kind === 'vicAJump' || it.kind === 'vicMJump' ? 'barrier' : it.kind === 'vicHang' || it.kind === 'vicASlide' || it.kind === 'vicMSlide' ? 'over' : it.kind; spr = SPR[w.themeAt(it.z, it.x) + kk[0].toUpperCase() + kk.slice(1)]; }       // (the 2D game draws the street's hazards as the usual ones)
      } else spr = o.spr;
      if (!spr) continue;                                                                          // (a prop that only the 3D build draws, such as the station hall)
      const sw = Math.max(1, Math.round(spr.width * sc)), sh = Math.max(1, Math.round(spr.height * sc));
      ctx.drawImage(spr, Math.round(this.sx(o.wx, s) - sw / 2), Math.round(sy - sh - lift), sw, sh);
    }
  }

  drawPlayer(g, sx, feetY) {
    const ctx = this.ctx, p = g.p;
    feetY = Math.round(feetY); sx = Math.round(sx);
    ctx.globalAlpha = 0.35; ctx.fillStyle = C.ink; ctx.fillRect(sx - 6, feetY - 1, 12, 2); ctx.globalAlpha = 1;
    let spr;
    if (g.state === 'pause') spr = SPR.run0;
    else if (p.slide > 0) spr = SPR.slide; else if (p.jy > 0) spr = SPR.jump; else spr = SPR['run' + (Math.floor(g.time * 11) & 3)];
    ctx.drawImage(spr, sx - 7, feetY - 24 - Math.round(p.jy) + (p.jy > 0 ? 3 : 0));
  }

  // forest: a few dithered shafts of light slanting down through the canopy
  drawBeams(g) {
    const n = Math.round(g.canopy * 3);
    if (n < 1) return;
    const ctx = this.ctx; ctx.fillStyle = lerpHex(C.amberL, C.forestD, 0.62);
    for (let i = 0; i < n; i++) {
      const x0 = 70 + i * 96 + Math.sin(g.time * 0.35 + i * 2) * 4 - this.sway * 0.3;
      for (let y = 24; y < 140; y += 3) ctx.fillRect(Math.round(x0 + (y - 24) * 0.3), y, 5, 1);
    }
  }

  // leafy ceiling that closes in as the forest mix rises
  drawCanopy(g) {
    const m = Math.round(g.canopy * 6) / 6;
    if (m < 0.1) return;
    const ctx = this.ctx, h = Math.round(20 * m), off = Math.floor(this.camW * 3);
    for (let x = 0; x < VW; x += 6) {
      const i = x / 6 + off, dh = Math.round(h * (0.55 + 0.45 * rnd(i, 77)));
      ctx.fillStyle = C.forestD; ctx.fillRect(x, 0, 6, dh);
      ctx.fillStyle = C.ink; ctx.fillRect(x, dh, 6, 1);
      if (rnd(i, 78) > 0.5) { ctx.fillStyle = C.forest; ctx.fillRect(x + 1, Math.max(0, dh - 5), 3, 2); }
    }
  }

  // ---- interface: compact plates and buttons share one border/plum/amber language
  // (while a menu is being drawn for the smooth layer, this._hq collects its text instead: Renderer.drawMenuHi letters it in the game's font at the screen's resolution)
  txt(s, x, y, col, sc = 1, sh = C.ink) { if (this._hq) { this._hq.push([s, x, y, col, sc, 0]); return; } if (this._hud) { this._hud.push([s, x, y, col, sc, 0, sh, +this.ctx.globalAlpha.toFixed(2)]); return; } const o = Math.max(1, sc >> 1); drawText(this.ctx, s, x + o, y + o, sh, sc); drawText(this.ctx, s, x, y, col, sc); }
  ctr(s, y, col, sc = 1, sh = C.ink) { if (this._hq) { this._hq.push([s, VW / 2, y, col, sc, 1]); return; } if (this._hud) { this._hud.push([s, VW / 2, y, col, sc, 1, sh, +this.ctx.globalAlpha.toFixed(2)]); return; } this.txt(s, Math.round((VW - textW(s, sc)) / 2), y, col, sc, sh); }
  ctrAt(cx, s, y, col, sc = 1, sh = C.ink) { if (this._hq) { this._hq.push([s, cx, y, col, sc, 1]); return; } if (this._hud) { this._hud.push([s, cx, y, col, sc, 1, sh, +this.ctx.globalAlpha.toFixed(2)]); return; } this.txt(s, Math.round(cx - textW(s, sc) / 2), y, col, sc, sh); }
  // GLASS MENUS (the 3D build): a menu card is a pane of frosted glass over the live picture (a CSS backdrop blur on a small element placed between the 3D canvas and the pixel canvas:
  // Renderer.applyGlass), edged and lit on the smooth layer (drawMenuHi), with the round Berry Runner 2 icon sitting on its top edge. While a glass menu is drawn panel() and button() only
  // record where the card, the pills and the icon go (this._gp / this._gb); the pixel canvas keeps its dark veil and the artwork buttons.
  panel(x, y, w, h, ic) {
    if (this._glassOn) { this._gp.push([x, y, w, h, ic || 0]); this.ctx.clearRect(x, y, w, h); return; }      // (the pane is clear: the dark veil of the pause and game-over screens is not drawn over the glass)
    const c = this.ctx;
    // BERRY RUNNER 2's panel: deep night violet (a shade lighter toward the top), a neon pink frame with a soft glow line inside it, lime ticks at the corners
    const T = Renderer.THEME;
    c.fillStyle = T.ink; c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = T.pink; c.fillRect(x, y, w, h);
    c.fillStyle = T.night; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = T.night2; c.fillRect(x + 1, y + 1, w - 2, Math.max(2, Math.round(h * 0.34)));
    c.fillStyle = T.violet; c.fillRect(x + 3, y + 3, w - 6, 1); c.fillRect(x + 3, y + h - 4, w - 6, 1); // inner rule
    c.fillStyle = T.lime; for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 1], [x + w - 3, y + h - 1]]) c.fillRect(cx, cy, 3, 1);
    for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 3], [x + w - 1, y + h - 3]]) c.fillRect(cx, cy, 1, 3);
  }
  // the colours of the menus (BERRY RUNNER 2): Berry's own palette (the pink of the star, the lime of the calyx, the yellow of the seeds) on a night violet
  static get THEME() { return Renderer._theme || (Renderer._theme = { ink: '#0c0816', night: '#151022', night2: '#22163c', violet: '#4a2f86', pink: '#ff4f9e', pinkL: '#ff9ccb', pinkD: '#c2246e', lime: '#8dff1a', gold: '#ffd23a', text: '#fff3fb', dim: '#b9a2ff' }); }
  // THE HUD IN HIGH RESOLUTION (the 3D build, not in VR): every line of text of the run's and the race's HUD (distance, coins, shards, the zone, the mission, the power-ups, the toasts, the
  // junction prompt, the race's figures) is lettered in the game's font on its own canvas (#hud, over the pixel canvas, at the screen's pixel density) at the places and in the colours of
  // the pixel lettering it replaces. The layer is redrawn only when one of its lines changes. Under a menu it is dimmed; under a fade it fades with the picture.
  hudOn(g) { return !!this.menu3d && !g.vr && g.state !== 'title' && !!this.hudLayer(); }
  hudLayer() {
    if (this._hl === undefined) { const t = typeof document !== 'undefined' ? document.getElementById('touch') : null; if (!t) this._hl = null; else { const cv = document.createElement('canvas'); cv.id = 'hud'; cv.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;background:transparent'; t.parentNode.insertBefore(cv, t); this._hl = { cv, ctx: cv.getContext('2d'), sig: '', dirty: false, draws: 0 }; } }
    return this._hl;
  }
  flushHud(g, q) {
    const L = this.hudLayer(); if (!L) return;
    if (!q || !q.length) { if (L.dirty) { L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, L.cv.width, L.cv.height); L.dirty = false; L.sig = ''; } return; }
    const t = document.getElementById('touch'), st = L.cv.style;                            // the same place and size as the touch layer (Game.fitTouch keeps that one on the screen canvas)
    if (L.cv.width !== t.width) L.cv.width = t.width; if (L.cv.height !== t.height) L.cv.height = t.height;
    if (st.left !== t.style.left) st.left = t.style.left; if (st.top !== t.style.top) st.top = t.style.top; if (st.width !== t.style.width) st.width = t.style.width; if (st.height !== t.style.height) st.height = t.style.height;
    const S = g.scene, veil = Math.max(S ? S.fade || 0 : 0, g.fadeIn > 0 ? g.fadeIn * g.fadeIn : 0), op = (this.menuKind(g) ? 0.4 : 1) * (1 - Math.min(1, veil)), ops = op.toFixed(2); if (st.opacity !== ops) st.opacity = ops;
    if (this._font === undefined) { this._font = 0; try { document.fonts.load('700 12px Fredoka').then(() => { this._font = 1; }, () => {}); } catch (e) {} }
    const sig = L.cv.width + 'x' + L.cv.height + '|' + this._font + '|' + q.join(';');
    if (sig === L.sig) return; L.sig = sig; L.dirty = true; L.draws++;
    const c = L.ctx, k = L.cv.width / (VW + 2 * TOUCH_OUT), FONT = 'Fredoka, "Trebuchet MS", "Segoe UI", Arial, sans-serif';
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, L.cv.width, L.cv.height); c.setTransform(k, 0, 0, k, TOUCH_OUT * k, 0); c.textBaseline = 'top';
    let font = '';
    for (const [str, x, y, col, sc, mid, sh, a] of q) {
      const px = sc >= 4 ? 27 : sc === 3 ? 19.5 : sc === 2 ? 13 : 7.4, f = (sc >= 2 ? '700 ' : '600 ') + px + 'px ' + FONT; if (f !== font) { c.font = font = f; if ('letterSpacing' in c) c.letterSpacing = (sc >= 2 ? 0.5 : 0.3) + 'px'; }
      c.textAlign = mid ? 'center' : 'left'; c.globalAlpha = a; const o = sc >= 2 ? 0.9 : 0.55;
      const mw = textW(str, sc) + 1;                                                    // never wider than the pixel lettering it replaces (the plates are sized for that): a longer line is condensed
      c.fillStyle = sh; c.fillText(str, x + o, y - 0.6 + o, mw); c.fillStyle = col; c.fillText(str, x, y - 0.6, mw);      // (a dark copy under it, like the pixel lettering's shadow: cheaper than an outline)
    }
    c.globalAlpha = 1;
  }
  // can the menus use the smooth layer (the canvas over the pixel one, at the screen's own resolution)? Not in VR: the HUD is a floating panel there, made from the pixel canvas alone.
  hiMenu(g) { return !!this.touchLayer() && !g.vr; }
  // THE MENUS IN HIGH RESOLUTION: the logo of the title screen and the headings of the pause and game-over panels are drawn as smooth lettering on the layer that carries the touch buttons
  // during a run (it is free on these screens), at the screen's own pixel density instead of the 320 x 180 grid. Drawn once per screen (and again after a resize): a still layer costs nothing.
  // THE MAP BEHIND THE TITLE MENU (the 3D build): instead of the street rolling by, the zones of the game as numbered stops along one winding neon road over a night landscape (ZMAP,
  // src/game.js), each with its colour, its little picture and its name; the chosen start wears a lime ring and the portrait of the character who runs. Drawn on its own canvas over the
  // 3D view, at the screen's resolution, ONCE (and again when the choice, the character or the size changes): a still map costs nothing per frame. A tap on a stop: Game.pressAt.
  drawMap(g) {
    if (typeof ZMAP === 'undefined') return;
    let M = this._map; const gl = document.getElementById('gl'), sc = document.getElementById('screen'); if (!gl || !sc) return;
    if (!M) { const cv = document.createElement('canvas'); cv.id = 'map'; cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:none;pointer-events:none'; gl.parentNode.insertBefore(cv, gl.nextSibling); M = this._map = { cv, ctx: cv.getContext('2d'), on: false, sig: '', face: {} }; }
    if (!M.on) { M.cv.style.display = 'block'; M.on = true; } g.mapOn = true;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1)), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr), r = sc.getBoundingClientRect(), sel = g.startZone || ZMAP[0].id, who = g.r && g.r.character === 'zagla' ? 'zagla' : 'berry';
    const A = who === 'zagla' ? (typeof ZAGLA_ASSETS !== 'undefined' ? ZAGLA_ASSETS : null) : (typeof BERRY_ASSETS !== 'undefined' ? BERRY_ASSETS : null);
    if (A && !M.face[who]) { const im = new Image(); im.onload = () => { M.sig = ''; }; im.src = A.front; M.face[who] = im; }
    const sig = W + 'x' + H + '|' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + '|' + sel + '|' + who + '|' + (this._font || 0) + (M.face[who] && M.face[who].complete ? 'f' : '');
    if (sig === M.sig) return; M.sig = sig;
    if (M.cv.width !== W) M.cv.width = W; if (M.cv.height !== H) M.cv.height = H;
    const c = M.ctx, T = Renderer.THEME, k = r.width / VW * dpr, FONT = 'Fredoka, "Trebuchet MS", "Segoe UI", Arial, sans-serif';
    c.setTransform(1, 0, 0, 1, 0, 0);
    { const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d0820'); bg.addColorStop(0.55, '#231046'); bg.addColorStop(1, '#3a1458'); c.fillStyle = bg; c.fillRect(0, 0, W, H); }
    for (let i = 0; i < 90; i++) { const x = rnd(i, 301) * W, y = rnd(i, 302) * H * 0.8, s = (0.6 + rnd(i, 303) * 1.2) * dpr; c.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.5 * rnd(i, 304)).toFixed(2) + ')'; c.fillRect(x, y, s, s); }      // the stars
    c.setTransform(k, 0, 0, k, r.left * dpr, r.top * dpr);                                  // from here on: the 320 x 180 grid of the HUD
    for (const q of ZMAP) { const gr = c.createRadialGradient(q.x, q.y + 4, 2, q.x, q.y + 4, 34); gr.addColorStop(0, q.c + '55'); gr.addColorStop(1, q.c + '00'); c.fillStyle = gr; c.fillRect(q.x - 36, q.y - 32, 72, 72); }      // each zone's own light on the land
    // the road through the stops: a dark band with a glowing edge and a dashed lime line down its middle
    const road = () => { c.beginPath(); c.moveTo(ZMAP[0].x - 26, ZMAP[0].y + 10); c.lineTo(ZMAP[0].x, ZMAP[0].y); for (let i = 1; i < ZMAP.length; i++) { const a = ZMAP[i - 1], b = ZMAP[i], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, bend = (i % 2 ? 1 : -1) * 9, nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1; c.quadraticCurveTo(mx + nx / nl * bend, my + ny / nl * bend, b.x, b.y); } const e = ZMAP[ZMAP.length - 1]; c.quadraticCurveTo(e.x + 30, e.y - 14, e.x + 62, e.y - 6); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.save(); c.shadowColor = T.pink; c.shadowBlur = 5 * k; c.strokeStyle = 'rgba(255,79,158,0.75)'; c.lineWidth = 7.4; road(); c.stroke(); c.restore();
    c.strokeStyle = '#150d2a'; c.lineWidth = 6; road(); c.stroke();
    c.strokeStyle = T.lime; c.lineWidth = 0.8; c.setLineDash([2.4, 3]); road(); c.stroke(); c.setLineDash([]);
    { const e = ZMAP[ZMAP.length - 1], fx = e.x + 62, fy = e.y - 6; c.strokeStyle = '#fff'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 13); c.stroke(); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#150d2a'; c.fillRect(fx + i * 2.6, fy - 13 + j * 2.6, 2.6, 2.6); } }      // the finish flag at the end of the road
    const pic = (kind, x, y, col) => {                             // the little picture of a zone, in simple shapes
      c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 0.9;
      if (kind === 'neon') { for (const [dx, h] of [[-5, 8], [-1.5, 12], [2, 6], [5, 10]]) c.fillRect(dx, -h, 2.6, h); c.fillStyle = T.lime; c.fillRect(-1, -9, 1, 1); c.fillRect(5.6, -7, 1, 1); }
      else if (kind === 'beach') { c.beginPath(); c.arc(4, -8, 3, 0, Math.PI * 2); c.fillStyle = T.gold; c.fill(); c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(-7 + i * 4.6, -1.5); c.quadraticCurveTo(-4.7 + i * 4.6, -4.5, -2.4 + i * 4.6, -1.5); } c.stroke(); }
      else if (kind === 'house') { c.fillRect(-4.5, -6, 9, 6); c.beginPath(); c.moveTo(-6, -6); c.lineTo(0, -11); c.lineTo(6, -6); c.closePath(); c.fill(); c.fillStyle = '#150d2a'; c.fillRect(-1, -3.5, 2, 3.5); }
      else if (kind === 'tram') { c.beginPath(); c.roundRect(-7, -8, 14, 7, 1.5); c.fill(); c.fillStyle = '#150d2a'; for (const dx of [-5, -1, 3]) c.fillRect(dx, -6.5, 2.4, 2.4); c.fillStyle = col; c.fillRect(-0.4, -11, 0.8, 3); c.fillRect(-4, -11.4, 8, 0.7); }
      else if (kind === 'train') { c.beginPath(); c.moveTo(-7, -1); c.lineTo(-7, -6); c.quadraticCurveTo(-7, -9, -3, -9); c.lineTo(3, -9); c.quadraticCurveTo(8, -8, 8, -1); c.closePath(); c.fill(); c.fillStyle = '#150d2a'; c.fillRect(-4.5, -7.2, 3, 2.4); c.fillRect(0, -7.2, 3, 2.4); }
      else if (kind === 'arch') { c.beginPath(); c.moveTo(-6, 0); c.lineTo(-6, -7); c.arc(0, -7, 6, Math.PI, 0); c.lineTo(6, 0); c.lineTo(3, 0); c.lineTo(3, -6); c.arc(0, -6, 3, 0, Math.PI, true); c.lineTo(-3, 0); c.closePath(); c.fill(); }
      else if (kind === 'canal') { c.beginPath(); c.moveTo(-7, -3); c.quadraticCurveTo(0, -11, 7, -3); c.lineWidth = 1.6; c.stroke(); c.lineWidth = 0.9; c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(-7 + i * 4.6, 0); c.quadraticCurveTo(-4.7 + i * 4.6, -2.4, -2.4 + i * 4.6, 0); } c.stroke(); }
      else if (kind === 'car') { c.beginPath(); c.moveTo(-8, -2); c.quadraticCurveTo(-7, -5, -3, -5.5); c.quadraticCurveTo(0, -9.5, 4, -5.5); c.quadraticCurveTo(8, -5, 8, -2); c.closePath(); c.fill(); c.fillStyle = '#150d2a'; c.beginPath(); c.arc(-4.5, -1.6, 1.8, 0, Math.PI * 2); c.arc(4.5, -1.6, 1.8, 0, Math.PI * 2); c.fill(); }
      else if (kind === 'flag') { c.fillRect(-5, -11, 0.9, 11); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { c.fillStyle = (i + j) % 2 ? col : '#fff'; c.fillRect(-4 + i * 2.4, -11 + j * 2.2, 2.4, 2.2); } }
      c.restore();
    };
    ZMAP.forEach((q, i) => {
      const on = q.id === sel, R0 = on ? 8.2 : 6.6;
      pic(q.k, q.x + (i % 2 ? -15 : 15), q.y - 6, q.c);
      c.save(); c.shadowColor = q.c; c.shadowBlur = (on ? 8 : 4) * k; c.beginPath(); c.arc(q.x, q.y, R0, 0, Math.PI * 2); const gr = c.createLinearGradient(0, q.y - R0, 0, q.y + R0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, q.c); gr.addColorStop(1, q.c); c.fillStyle = gr; c.fill(); c.restore();
      c.beginPath(); c.arc(q.x, q.y, R0, 0, Math.PI * 2); c.strokeStyle = '#150d2a'; c.lineWidth = 1.1; c.stroke(); c.beginPath(); c.arc(q.x, q.y, R0 - 1.3, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.6; c.stroke();
      if (on) { c.beginPath(); c.arc(q.x, q.y, R0 + 2.2, 0, Math.PI * 2); c.strokeStyle = T.lime; c.lineWidth = 1.2; c.stroke(); }
      c.font = '700 ' + (on ? 8.4 : 7) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#150d2a'; c.fillText(String(i + 1), q.x, q.y + 0.5);
      c.font = '600 4.6px ' + FONT; const tw = c.measureText(q.n).width + 5, ly = q.y + R0 + 2.4;      // its name on a small dark pill
      c.beginPath(); c.roundRect(q.x - tw / 2, ly, tw, 6.4, 3.2); c.fillStyle = 'rgba(12,8,22,0.78)'; c.fill(); if (on) { c.strokeStyle = T.lime; c.lineWidth = 0.5; c.stroke(); }
      c.fillStyle = on ? '#eaffc0' : T.text; c.textBaseline = 'middle'; c.fillText(q.n, q.x, ly + 3.4);
    });
    { const q = ZMAP.find(z => z.id === sel) || ZMAP[0], cx = q.x, cy = q.y - 21, R1 = 8, im = M.face[who];      // who runs, standing over the chosen stop: the character's portrait in a ring with a pointer
      c.beginPath(); c.moveTo(cx - 3, cy + R1 - 1); c.lineTo(cx, cy + R1 + 4); c.lineTo(cx + 3, cy + R1 - 1); c.closePath(); c.fillStyle = '#fff'; c.fill();
      c.save(); c.shadowColor = T.pink; c.shadowBlur = 6 * k; c.beginPath(); c.arc(cx, cy, R1 + 1.4, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.restore();
      c.save(); c.beginPath(); c.arc(cx, cy, R1, 0, Math.PI * 2); c.clip(); c.fillStyle = '#151022'; c.fillRect(cx - R1, cy - R1, 2 * R1, 2 * R1);
      if (im && im.complete && im.naturalWidth) { const sw = im.naturalWidth * 0.74, sx = (im.naturalWidth - sw) / 2, sy = im.naturalHeight * 0.03; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(im, sx, sy, sw, sw, cx - R1, cy - R1, 2 * R1, 2 * R1); } c.restore(); }
    c.font = '700 6px ' + FONT; c.textAlign = 'right'; c.textBaseline = 'top'; if ('letterSpacing' in c) c.letterSpacing = '0.6px'; c.fillStyle = T.dim; c.fillText('CHOOSE WHERE YOU START', 312, 8); if ('letterSpacing' in c) c.letterSpacing = '0px';
  }
  // the lighting of the glass: a soft white sheen from the top left, a bright edge, a thin pink glow outside; the pills (pink glass) with their own highlight
  drawGlassHi(c, k, kind) {
    const T = Renderer.THEME, rr = (x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
    for (const [x, y, w, h] of this._gp) {
      c.save(); rr(x, y, w, h, 7); c.shadowColor = 'rgba(255,79,158,0.45)'; c.shadowBlur = 7 * k; c.strokeStyle = 'rgba(255,255,255,0.0)'; c.lineWidth = 0.1; c.stroke(); c.restore();
      c.save(); rr(x, y, w, h, 7); c.clip(); const gr = c.createLinearGradient(x, y, x + w * 0.9, y + h * 0.9); gr.addColorStop(0, 'rgba(255,255,255,0.20)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(255,79,158,0.10)'); c.fillStyle = gr; c.fillRect(x, y, w, h); c.restore();
      rr(x + 0.4, y + 0.4, w - 0.8, h - 0.8, 6.6); const eg = c.createLinearGradient(x, y, x + w, y + h); eg.addColorStop(0, 'rgba(255,255,255,0.85)'); eg.addColorStop(0.5, 'rgba(255,255,255,0.25)'); eg.addColorStop(1, 'rgba(255,140,200,0.65)'); c.strokeStyle = eg; c.lineWidth = 0.9; c.stroke();
    }
    for (const [x, y, w, h, hov, pr, dim] of this._gb) {
      const r = h / 2, a = pr ? 0.62 : hov ? 0.95 : 0.82, top = dim ? '170,160,200' : '255,140,200', bot = dim ? '96,86,130' : '226,40,128';
      c.save(); c.shadowColor = dim ? 'rgba(150,140,190,0.5)' : 'rgba(255,79,158,0.7)'; c.shadowBlur = (hov ? 7 : 4) * k; rr(x, y, w, h, r); const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(' + top + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + bot + ',' + a + ')'); c.fillStyle = gr; c.fill(); c.restore();
      c.save(); rr(x, y, w, h, r); c.clip(); const sh = c.createLinearGradient(0, y, 0, y + h * 0.55); sh.addColorStop(0, 'rgba(255,255,255,' + (pr ? 0.15 : 0.5) + ')'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(x, y, w, h * 0.55); c.restore();
      rr(x + 0.4, y + 0.4, w - 0.8, h - 0.8, r - 0.4); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.8; c.stroke();
    }
  }
  // the round Berry Runner 2 icon on the top edge of each card (the app's own icon, icons/icon-192.png): a glass ring, a glow, the picture cut to a circle
  drawGlassIcons(c, k) {
    if (!this._icon) { this._icon = new Image(); this._icon.onload = () => { this._iconOk = true; }; this._icon.src = 'icons/icon-192.png'; }
    for (const [x, y, w, , ic] of this._gp) {
      if (!ic) continue; const cx = x + w / 2, cy = y, r = ic;
      c.save(); c.beginPath(); c.arc(cx, cy, r + 2.6, 0, Math.PI * 2); c.shadowColor = 'rgba(255,79,158,0.8)'; c.shadowBlur = 8 * k; const rg = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(1, 'rgba(255,79,158,0.9)'); c.fillStyle = rg; c.fill(); c.restore();
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip(); c.fillStyle = '#151022'; c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      if (this._icon.complete && this._icon.naturalWidth) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(this._icon, cx - r, cy - r, 2 * r, 2 * r); }
      const sh = c.createLinearGradient(0, cy - r, 0, cy); sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(cx - r, cy - r, 2 * r, r); c.restore();
      c.beginPath(); c.arc(cx, cy, r + 0.5, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.7; c.stroke();
    }
  }
  // the frosted panes themselves: small CSS elements between the 3D canvas and the pixel canvas, blurring what is behind them (not with ?fx=0: a plain translucent pane then)
  applyGlass() {
    const cv = document.getElementById('screen'); if (!cv) return;
    const r = cv.getBoundingClientRect(), kx = r.width / VW, ky = r.height / VH, key = this._gp.join(',') + '|' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(kx * 100);
    this._glassShown = true; if (this._glassKey === key) return; this._glassKey = key;
    const els = this._glassEls || (this._glassEls = []), flat = /[?&]fx=0\b/.test(location.search);
    while (els.length < this._gp.length) { const e = document.createElement('div'); e.className = 'glass'; e.style.cssText = 'position:fixed;pointer-events:none;box-sizing:border-box;background:linear-gradient(135deg,rgba(255,255,255,.13),rgba(255,255,255,.04));' + (flat ? 'background-color:rgba(28,16,52,.55);' : 'backdrop-filter:blur(14px) saturate(1.5);-webkit-backdrop-filter:blur(14px) saturate(1.5);'); cv.parentNode.insertBefore(e, cv); els.push(e); }
    els.forEach((e, i) => { const q = this._gp[i]; if (!q) { e.style.display = 'none'; return; } e.style.display = 'block'; e.style.left = (r.left + q[0] * kx) + 'px'; e.style.top = (r.top + q[1] * ky) + 'px'; e.style.width = q[2] * kx + 'px'; e.style.height = q[3] * ky + 'px'; e.style.borderRadius = 7 * kx + 'px'; });
  }
  hideGlass() { this._glassShown = false; this._glassKey = null; if (this._glassEls) for (const e of this._glassEls) e.style.display = 'none'; }
  menuKind(g) { return g.state === 'title' ? 'title' : g.state === 'pause' ? 'pause' : g.state === 'over' && g.overT > g.overDelay ? 'over' : ''; }
  drawMenuHi(g, L, q) {
    const kind = g.settingsOpen && this.menuKind(g) ? 'settings' : this.menuKind(g);
    if (!kind || !this.hiMenu(g)) return false;
    if (this._font === undefined) { this._font = 0; try { document.fonts.load('700 12px Fredoka').then(() => { this._font = 1; }, () => {}); } catch (e) {} }      // (the game's font, assets/fonts/fredoka.woff2: the menu is lettered again once it has arrived)
    const sig = kind + '|' + L.cv.width + 'x' + L.cv.height + '|' + (this.menu3d ? 3 : 2) + (kind === 'over' && g.pk ? 'p' : '') + this._font + (this._iconOk ? 'i' : '') + '|' + (q ? q.join(';') : '') + '|' + (this._glassOn ? this._gp.join(',') + '/' + this._gb.join(',') : '');
    if (sig === L.msig && L.dirty) return true;
    const c = L.ctx, k = L.cv.width / (VW + 2 * TOUCH_OUT), T = Renderer.THEME, FONT = 'Fredoka, "Trebuchet MS", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, L.cv.width, L.cv.height); c.setTransform(k, 0, 0, k, TOUCH_OUT * k, 0); L.dirty = true; L.msig = sig; L.t = null; L.sig = null;
    const word = (str, x, y, px, o) => {                          // a word with a dark edge, a soft neon glow and a vertical gradient (o.align, o.italic, o.space, o.a / o.b: the gradient)
      c.save(); c.font = (o.italic ? 'italic ' : '') + '900 ' + px + 'px ' + FONT; c.textAlign = o.align || 'left'; c.textBaseline = 'alphabetic'; if (o.space && 'letterSpacing' in c) c.letterSpacing = o.space + 'px';
      c.lineJoin = 'round'; c.lineWidth = px * 0.2; c.strokeStyle = T.ink; c.shadowColor = o.glow || T.pink; c.shadowBlur = px * 0.22 * k; c.strokeText(str, x, y); c.shadowBlur = 0;
      const gr = c.createLinearGradient(0, y - px * 0.8, 0, y + px * 0.1); gr.addColorStop(0, o.a); gr.addColorStop(1, o.b); c.fillStyle = gr; c.fillText(str, x, y); c.restore();
    };
    const star = (cx, cy, r, col) => { c.save(); c.fillStyle = col; c.strokeStyle = T.ink; c.lineWidth = r * 0.28; c.lineJoin = 'round'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.44 : r; c.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } c.closePath(); c.stroke(); c.fill(); c.restore(); };
    if (this._glassOn) this.drawGlassHi(c, k, kind);
    if (kind === 'title' && this._glassOn) {                       // the logo under the icon, centred on the glass card
      word('Berry', 71, 62, 17, { italic: true, align: 'center', a: '#ffffff', b: T.pinkL });
      word('RUNNER 2', 71, 73, 7.4, { align: 'center', a: '#e9ffb0', b: T.lime, glow: T.lime, space: 1.4 });
    } else if (kind === 'title') {                                        // the logo: 'Berry' with its star, a pink swoosh, 'RUNNER' in lime and a big gold 2
      const m3 = this.menu3d, x0 = m3 ? 36 : 108, y0 = m3 ? 31 : 58, s = m3 ? 1 : 1.25;
      c.save(); c.strokeStyle = T.pink; c.lineCap = 'round'; c.lineWidth = 1.6 * s; c.shadowColor = T.pink; c.shadowBlur = 4 * k; c.beginPath(); c.moveTo(x0 - 1 * s, y0 + 3.2 * s); c.quadraticCurveTo(x0 + 30 * s, y0 + 0.6 * s, x0 + 60 * s, y0 + 2.2 * s); c.stroke(); c.restore();
      word('Berry', x0, y0, 19 * s, { italic: true, a: '#ffffff', b: T.pinkL });
      star(x0 + 60.5 * s, y0 - 12 * s, 3.6 * s, T.pink);
      word('RUNNER', x0 + 1 * s, y0 + 11.5 * s, 7.2 * s, { a: '#e9ffb0', b: T.lime, glow: T.lime, space: 1.6 * s });
      word('2', x0 + 68 * s, y0 + 11 * s, 30 * s, { italic: true, a: '#fff6c9', b: T.gold, glow: T.gold });
    } else if (kind === 'settings') word('SETTINGS', VW / 2, 47, 13, { align: 'center', a: '#ffffff', b: T.pinkL, space: 1.4 });
    else if (kind === 'pause') word('PAUSED', VW / 2, 79, 15, { align: 'center', a: '#ffffff', b: T.pinkL, space: 1.2 });
    else word('GAME OVER', VW / 2, g.pk ? 36 : 54, 15, { align: 'center', a: '#ffffff', b: T.pink, space: 1 });
    if (this._glassOn) this.drawGlassIcons(c, k);
    // every line of the menu (the hints, the figures of the run, the labels of the buttons): the same places and colours as the pixel lettering it replaces, in the game's font
    if (q) for (const [str, x, y, colr, sc, mid, edge] of q) {
      const px = sc >= 3 ? 17 : sc === 2 ? 12.5 : 7.4;
      c.font = (sc >= 2 ? '700 ' : '600 ') + px + 'px ' + FONT; c.textAlign = mid ? 'center' : 'left'; c.textBaseline = 'top'; if ('letterSpacing' in c) c.letterSpacing = (sc >= 2 ? 0.5 : 0.35) + 'px';
      c.lineJoin = 'round'; c.lineWidth = px * 0.26; c.strokeStyle = edge || T.ink; c.strokeText(str, x, y - 0.6); c.fillStyle = colr; c.fillText(str, x, y - 0.6);
    }
    return true;
  }
  plate(x, y, w, h, edge = C.ink) {
    const c = this.ctx;
    c.fillStyle = edge === C.ink && this.menu3d ? Renderer.THEME.violet : edge; c.fillRect(x - 1, y - 1, w + 2, h + 2);      // (Berry Runner 2, the 3D build: the HUD's plates are night violet in a violet line; a coloured edge keeps its meaning)
    c.fillStyle = this.menu3d ? Renderer.THEME.night : C.plum; c.fillRect(x, y, w, h);
  }
  button(b, g) {
    const m = g.mouse, hov = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h, pr = hov && m.down, c = this.ctx;
    const art = b.art && this[b.art];
    if (art && art.complete && art.naturalWidth) {          // the user's artwork as the button face: a dark base (no white), the rings, a green glow on hover / a dark veil when pressed, and a dark plate behind the label
      c.fillStyle = C.ink; c.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
      c.fillStyle = C.ink; c.fillRect(b.x, b.y, b.w, b.h);
      const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(art, b.x, b.y, b.w, b.h); c.imageSmoothingEnabled = sm;
      if (this.beatPulse > 0.01) { c.fillStyle = 'rgba(120,255,90,' + (0.2 * this.beatPulse).toFixed(3) + ')'; c.fillRect(b.x, b.y, b.w, b.h); }          // the button glows on the beat
      if (pr) { c.fillStyle = 'rgba(40,10,60,0.32)'; c.fillRect(b.x, b.y, b.w, b.h); } else if (hov) { c.fillStyle = 'rgba(90,230,70,0.30)'; c.fillRect(b.x, b.y, b.w, b.h); }
      const tw = textW(b.label, 2), tx = Math.round(b.x + (b.w - tw) / 2), ty = b.y + 3 + (pr ? 1 : 0);
      c.fillStyle = 'rgba(14,8,26,0.82)'; c.fillRect(tx - 3, ty - 2, tw + 6, 14);
      if (this._hq) this._hq.push([b.label, b.x + b.w / 2, ty, pr ? '#2f9a2a' : hov ? '#b4f58c' : '#5ee83c', 2, 1]); else
      drawText(c, b.label, tx, ty, pr ? '#2f9a2a' : hov ? '#b4f58c' : '#5ee83c', 2);   // a green label
      return;
    }
    const T = Renderer.THEME;
    if (!this._glassOn) { c.fillStyle = C.ink; c.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2); }
    if (this._glassOn) { this._gb.push([b.x, b.y, b.w, b.h, hov ? 1 : 0, pr ? 1 : 0, b.dim ? 1 : 0]); if (this._hq) this._hq.push([b.label, b.x + b.w / 2, b.y + 3 + (pr ? 1 : 0), T.text, 2, 1, T.pinkD]); return; }
    c.fillStyle = b.dim ? (hov ? '#8a80a8' : '#6a6088') : pr ? T.pinkD : hov ? T.pinkL : T.pink; c.fillRect(b.x, b.y, b.w, b.h);
    if (!pr) { c.fillStyle = T.pinkD; c.fillRect(b.x, b.y + b.h - 2, b.w, 2); c.fillStyle = T.pinkL; c.fillRect(b.x, b.y, b.w, 1); }
    if (this.beatPulse > 0.01 && !pr) { c.fillStyle = 'rgba(255,255,255,' + (0.18 * this.beatPulse).toFixed(3) + ')'; c.fillRect(b.x, b.y, b.w, b.h); }      // (it glows on the beat, like START)
    { const tx = Math.round(b.x + (b.w - textW(b.label, 2)) / 2), ty = b.y + 3 + (pr ? 1 : 0); if (this._hq) this._hq.push([b.label, b.x + b.w / 2, ty, T.text, 2, 1, T.pinkD]); else { drawText(c, b.label, tx + 1, ty + 1, T.pinkD, 2); drawText(c, b.label, tx, ty, T.text, 2); } }
  }

  // on-screen controls (touch devices only): each button wears the user's neon ring (TOUCH_ART) with its symbol drawn over it in pixels, light with a dark edge so it reads on the
  // artwork; a held button grows a little and lights up. Without the image (not loaded yet) the old plates are drawn.
  // THE SMOOTH LAYER (the user's words: "render the new control buttons and smooth them"): the buttons are drawn on their own canvas (#touch, over the 320 x 180 pixel overlay, aligned with it, at the device's
  // resolution, not pixelated) with the 256 px version of the ring picture (TOUCH_ART.hi), the arrows and the pause bars as anti-aliased vector shapes with a soft shadow, and a held button that eases up (it grows
  // to 1.1 and glows lilac, smoothly in about 0.15 s) instead of jumping. The 'hop off' plate of the scooter stays in the pixel overlay (it is pixel text). Without the canvas or the picture the pixel buttons below are drawn.
  touchLayer() {
    if (this._tl === undefined) {
      const cv = typeof document !== 'undefined' ? document.getElementById('touch') : null;
      this._tl = cv && typeof TOUCH_ART !== 'undefined' && TOUCH_ART.hi ? { cv, ctx: cv.getContext('2d'), img: new Image(), press: {}, t: null, dirty: false, syncT: -1e9 } : null;
      if (this._tl) this._tl.img.src = TOUCH_ART.hi.src;
    }
    return this._tl;
  }
  // one key of the magnetic scooter's controller (the user's picture: glossy black keys in a violet bezel, a white chevron): a rounded dark key, a violet rim that lights cyan when held,
  // the arrow of its direction. On the smooth layer (k: its scale; the canvas transform is set here) or, k = 0, on the pixel overlay.
  // THE CONTROLLER SHAKES with the scooter (the user: "at every jolt of the scooter the controller vibrates a little"): the scooter's balance spring (RunnerSprite.wob: its roll and
  // pitch speeds) gives a small jitter, up to 2 px, to the LCD and the keys
  padShake(g) { const W = g.r && g.r.runner && g.r.runner.wob; if (!W) return [0, 0]; const m = Math.min(2, (Math.abs(W.vz) + Math.abs(W.vx)) * 1.1); if (m < 0.25) return [0, 0];
    const t = g.time * 47; return [Math.round(Math.sin(t) * m * 2) / 2, Math.round(Math.cos(t * 1.37) * m * 2) / 2]; }
  padLcd(c, im, L) { c.save(); c.beginPath(); if (c.roundRect) c.roundRect(L.x + 2, L.y + 2, L.w - 4, L.h - 6, 7); else c.rect(L.x + 2, L.y + 2, L.w - 4, L.h - 6); c.clip(); c.drawImage(im, L.x, L.y, L.w, L.h); c.restore(); }      // (rounded like its bezel: the picture's background corners are cut off)
  padKmh(g) { return Math.round(g.p.speed * 0.36 * (g.pk ? g.pk.speedMul : 1)); }                       // (10 track units a metre: units/s x 0.36 = km/h)
  padState(g) { const s = this.padShake(g); return this.padKmh(g) + ',' + s[0] + ',' + s[1]; }
  // THE LIVE SPEEDOMETER on the LCD (the user): the picture's own number (125) is covered by a dark patch and the real speed in km/h is written there, in the screen's neon green
  padSpeed(c, g, L, fade) {
    const x = L.x + L.w * 0.19, y = L.y + L.h * 0.33, w = L.w * 0.17, h = L.h * 0.15;
    c.save(); c.globalAlpha = 0.96 * fade; c.fillStyle = '#071226'; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, 1.5); else c.rect(x, y, w, h); c.fill();
    c.font = 'bold ' + (h * 0.95).toFixed(1) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#39ff14'; c.shadowBlur = 3; c.fillStyle = '#d8ffcf';
    c.fillText(String(this.padKmh(g)), x + w / 2, y + h * 0.55); c.restore();
  }
  magButton(c, t, p, fade, k) {
    if (k) c.setTransform(k, 0, 0, k, TOUCH_OUT * k, 0);
    const x = t.x, y = t.y, w = t.w, h = t.h, cx = x + w / 2, cy = y + h / 2, rr = (X, Y, W, H, R) => { c.beginPath(); if (c.roundRect) c.roundRect(X, Y, W, H, R); else c.rect(X, Y, W, H); };
    c.save(); c.globalAlpha = (p > 0.5 ? 0.85 : 0.55) * fade;      // (the user: the keys a little see-through)
    rr(x - 1, y - 1, w + 2, h + 2, 6); c.fillStyle = p > 0.5 ? '#35e6ff' : '#7a3fd0'; c.fill();                                          // the rim: violet, cyan when held
    rr(x + 1, y + 1, w - 2, h - 2, 5); c.fillStyle = p > 0.5 ? '#2a1d44' : '#0d0b16'; c.fill();                                          // the glossy black key
    c.globalAlpha = 0.22 * fade; rr(x + 3, y + 2, w - 6, h * 0.35, 3); c.fillStyle = '#ffffff'; c.fill(); c.globalAlpha = 0.9 * fade;          // its shine (and the arrow stays clear)
    if (t.id === 'ollie') {                                                     // OLLIE: a board popping up (a tilted line, a little arc over it) and its name
      c.strokeStyle = p > 0.5 ? '#ffffff' : '#9ff4ff'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 7, cy + 1); c.lineTo(cx + 5, cy - 4); c.stroke();
      c.beginPath(); c.arc(cx - 1, cy + 1, 7, 3.6, 5.8); c.stroke(); c.fillStyle = c.strokeStyle; c.font = 'bold 5px sans-serif'; c.textAlign = 'center'; c.fillText(t.label || 'OLLIE', cx, y + h - 2);
      c.restore(); c.globalAlpha = 1; return;
    }
    if (t.id === 'spin' || t.id === 'flip') {                                    // the stunt keys: a round arrow (SPIN: flat, a full turn) or a tall loop (FLIP), and their name; lit while a stunt is in the air
      c.strokeStyle = p > 0.5 ? '#ffffff' : '#ffb0ee'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath();
      if (t.id === 'spin') c.ellipse(cx, cy - 2, 8, 4, 0, 0.4, 5.6); else c.ellipse(cx, cy - 2, 4, 7, 0, 0.4, 5.6); c.stroke();
      c.fillStyle = c.strokeStyle; c.beginPath(); if (t.id === 'spin') { c.moveTo(cx + 8, cy - 4); c.lineTo(cx + 5, cy - 6); c.lineTo(cx + 9, cy - 8); } else { c.moveTo(cx + 4, cy - 6); c.lineTo(cx + 1, cy - 9); c.lineTo(cx + 6, cy - 10); } c.fill();
      c.font = 'bold 5px sans-serif'; c.textAlign = 'center'; c.fillText(t.label || t.id.toUpperCase(), cx, y + h - 3);
      c.restore(); c.globalAlpha = 1; return;
    }
    const a = { left: [[4, -5], [-3, 0], [4, 5]], right: [[-4, -5], [3, 0], [-4, 5]], jump: [[-6, 3], [0, -4], [6, 3]], slide: [[-6, -3], [0, 4], [6, -3]] }[t.id];
    c.strokeStyle = p > 0.5 ? '#ffffff' : '#e8e2ff'; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); a.forEach(([dx, dy], i) => i ? c.lineTo(cx + dx, cy + dy) : c.moveTo(cx + dx, cy + dy)); c.stroke();
    c.restore(); c.globalAlpha = 1;
  }
  smoothButton(L, g, t, p, fade) {
    const c = L.ctx, k = L.cv.width / (VW + 2 * TOUCH_OUT), cx = t.x + (t.w >> 1), cy = t.y + (t.h >> 1), f = t.id === 'pause' ? 22 : 42, s = f * (1 + 0.1 * p);
    c.setTransform(k, 0, 0, k, TOUCH_OUT * k, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.globalAlpha = (0.8 + 0.2 * p) * fade;
    if (p > 0.02) { const s2 = s * (1 + 0.18 * p); c.globalAlpha = 0.35 * p * fade; c.drawImage(L.img, cx - s2 / 2, cy - s2 / 2, s2, s2); c.globalAlpha = (0.8 + 0.2 * p) * fade; }      // the glow of a held button: the ring drawn once more, larger and faint (the canvas blur it replaced is very slow on phone GPUs)
    c.drawImage(L.img, cx - s / 2, cy - s / 2, s, s);
    // the symbol: a soft dark shadow, then the light shape, both with rounded corners (a stroke of the same colour round the polygon)
    const poly = pts => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
    const bars = () => { for (const x of [-4.4, 1.4]) { c.beginPath(); if (c.roundRect) c.roundRect(x, -4.6, 3, 9.2, 1.1); else c.rect(x, -4.6, 3, 9.2); c.fill(); c.stroke(); } };
    const shape = { left: [[-6.5, 0], [3, -9], [3, 9]], right: [[6.5, 0], [-3, -9], [-3, 9]], jump: [[0, -6.5], [-9, 3], [9, 3]], slide: [[0, 6.5], [-9, -3], [9, -3]] }[t.id];
    c.save(); c.translate(cx, cy); c.scale(f / 42 * (1 + 0.1 * p), f / 42 * (1 + 0.1 * p)); c.lineJoin = 'round'; c.lineWidth = 1.6; c.globalAlpha = fade;
    for (const [dx, dy, fill] of [[0.9, 0.9, 'rgba(24,12,36,0.75)'], [0, 0, p > 0.5 ? '#ffffff' : '#f2ead6']]) {
      c.save(); c.translate(dx, dy); c.fillStyle = fill; c.strokeStyle = fill; if (shape) { poly(shape); c.fill(); c.stroke(); } else bars(); c.restore();
    }
    c.restore(); c.globalAlpha = 1;
  }
  static get TOUCH_IDS() { return Renderer._touchIds || (Renderer._touchIds = ['left', 'right', 'slide', 'jump', 'pause', 'spin', 'flip', 'ollie']); }      // the buttons that ease in and out when pressed (one shared list)
  drawTouch(g) {
    const L = this.touchLayer();
    if (L && g.state !== 'play' && g.state !== 'race' && this.menuKind(g) && this.hiMenu(g)) return;      // (the title, pause and game-over screens letter themselves on it: drawUI, Renderer.drawMenuHi)
    if (!g.touch || (g.state !== 'play' && g.state !== 'race')) { if (L) { L.msig = null; if (L.dirty) { L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, L.cv.width, L.cv.height); L.dirty = false; } L.t = null; L.sig = null; } return; }
    const sm = L && L.img.complete && L.img.naturalWidth ? L : null;
    if (sm) {
      const now = performance.now(); if (now - sm.syncT > 500 && g.fitTouch) { g.fitTouch(); sm.syncT = now; }                // (keeps the layer on the screen canvas, whatever the layout does)
      const dt = sm.t === null ? 1 : Math.max(0, Math.min(0.1, g.time - sm.t)); sm.t = g.time; this._fade = 1 - (g.fadeIn > 0 ? Math.min(1, g.fadeIn * g.fadeIn) : 0);
      const heldNow = Object.values(g.held);                                              // (read once a frame: it was rebuilt for each of the eight buttons)
      for (const id of Renderer.TOUCH_IDS) { const target = heldNow.includes(id) ? 1 : 0, p = sm.press[id] || 0; sm.press[id] = p + (target - p) * (1 - Math.exp(-18 * dt)); }
      // PERFORMANCE: the layer is cleared and redrawn only when something on it changed (a button easing in or out, the fade, a resize), not on every frame: a still layer costs nothing
      const set = g.touchSet ? g.touchSet() : TOUCH, sig = Renderer.TOUCH_IDS.map(id => (sm.press[id] || 0).toFixed(2)).join() + '|' + this._fade.toFixed(2) + '|' + sm.cv.width + 'x' + sm.cv.height + '|' + 'in' + (g.touchIn || 0) + (set === TOUCH || set.base === TOUCH ? 'ring' : 'mag' + this.padState(g) + (set.lcd ? 'L' : '') + (g.trick ? 'T' : '') + (g.vehicle || ''));
      sm.redraw = sig !== sm.sig; sm.sig = sig;
      if (sm.redraw) { sm.ctx.setTransform(1, 0, 0, 1, 0, 0); sm.ctx.clearRect(0, 0, sm.cv.width, sm.cv.height); sm.dirty = true; sm.draws = (sm.draws || 0) + 1; }
    }
    const c = this.ctx, on = new Set(Object.values(g.held));
    if (!this.touchImg && typeof TOUCH_ART !== 'undefined') { this.touchImg = new Image(); this.touchImg.src = TOUCH_ART.src; }
    const art = this.touchImg && this.touchImg.complete && this.touchImg.naturalWidth ? this.touchImg : null;
    const set = g.touchSet ? g.touchSet() : TOUCH;
    if (set.lcd) {                                                                // THE MAGNETIC SCOOTER: the handlebar's LCD, smooth when the layer is there
      const im = MAG_PAD_ART.img, sh = this.padShake(g), L2 = { x: set.lcd.x + sh[0], y: set.lcd.y + sh[1], w: set.lcd.w, h: set.lcd.h };
      if (im && im.complete && im.naturalWidth) { if (sm) { if (sm.redraw) { const k = sm.cv.width / (VW + 2 * TOUCH_OUT); sm.ctx.setTransform(k, 0, 0, k, TOUCH_OUT * k, 0); sm.ctx.imageSmoothingEnabled = true; sm.ctx.imageSmoothingQuality = 'high'; sm.ctx.globalAlpha = 0.95 * this._fade; this.padLcd(sm.ctx, im, L2); this.padSpeed(sm.ctx, g, L2, this._fade); sm.ctx.globalAlpha = 1; } }
        else { c.globalAlpha = 0.95; this.padLcd(c, im, L2); this.padSpeed(c, g, L2, 1); c.globalAlpha = 1; } }
    }
    for (const t of set) {
      if (t.id === 'cam') {                                                      // the second camera's switch: only while riding
        if (!g.riding) continue;
        c.globalAlpha = 0.85; c.fillStyle = C.ink; c.fillRect(t.x - 1, t.y - 1, t.w + 2, t.h + 2); c.fillStyle = g.camFP ? '#3a2a66' : C.plum; c.fillRect(t.x, t.y, t.w, t.h);
        c.fillStyle = g.camFP ? '#35e6ff' : C.amberD; c.fillRect(t.x, t.y, t.w, 1); c.fillRect(t.x, t.y + t.h - 1, t.w, 1); c.globalAlpha = 1;
        c.fillStyle = C.bone; c.fillRect(t.x + 4, t.y + 6, 9, 6); c.fillRect(t.x + 13, t.y + 7, 3, 4); this.txt(g.camFP ? 'EYES' : 'CAMERA', t.x + 19, t.y + 7, C.bone, 1); continue;
      }
      if (t.id === 'scooter') {                                                  // 'hop off': only while riding
        if (!g.riding) continue;
        c.globalAlpha = 0.85; c.fillStyle = C.ink; c.fillRect(t.x - 1, t.y - 1, t.w + 2, t.h + 2); c.fillStyle = on.has('scooter') ? C.burgD : C.plum; c.fillRect(t.x, t.y, t.w, t.h);
        c.fillStyle = C.amberD; c.fillRect(t.x, t.y, t.w, 1); c.fillRect(t.x, t.y + t.h - 1, t.w, 1); c.globalAlpha = 1;
        this.scooterGlyph(t.x + 4, t.y + 5, C.bone); this.txt('HOP OFF', t.x + 20, t.y + 8, C.bone, 1); continue;
      }
      if (t.mag) { const sh = this.padShake(g), t2 = Object.assign({}, t, { x: t.x + sh[0], y: t.y + sh[1], label: g.vehicle === 'bike' ? { spin: '360', flip: 'WHIP', ollie: 'HOP' }[t.id] : null }); if (sm) { if (sm.redraw) this.magButton(sm.ctx, t2, sm.press[t.id] || 0, this._fade, sm.cv.width / (VW + 2 * TOUCH_OUT)); } else this.magButton(c, t2, on.has(t.id) ? 1 : 0, 1, 0); continue; }
      if (sm) { if (sm.redraw) this.smoothButton(sm, g, t, sm.press[t.id] || 0, this._fade); continue; }
      const hot = on.has(t.id), cx = t.x + (t.w >> 1), cy = t.y + (t.h >> 1);
      if (art) {
        const f = t.id === 'pause' ? TOUCH_ART.small : TOUCH_ART.big, k = hot ? 1.1 : 1, w = Math.round(f.w * k), h = Math.round(f.h * k);
        c.globalAlpha = hot ? 1 : 0.8; c.drawImage(art, f.x, f.y, f.w, f.h, cx - (w >> 1), cy - (h >> 1), w, h); c.globalAlpha = 1;
      } else {
        c.globalAlpha = 0.82;
        c.fillStyle = C.ink; c.fillRect(t.x - 1, t.y - 1, t.w + 2, t.h + 2);
        c.fillStyle = hot ? C.burgD : C.plum; c.fillRect(t.x, t.y, t.w, t.h);
        c.fillStyle = hot ? C.amber : C.amberD; c.fillRect(t.x, t.y, t.w, 1); c.fillRect(t.x, t.y + t.h - 1, t.w, 1);
        c.globalAlpha = 1;
      }
      for (const [dx, dy, col] of art ? [[1, 1, C.ink], [0, 0, hot ? '#ffffff' : C.bone]] : [[0, 0, hot ? C.amberL : C.bone]]) {   // the symbol: a dark shadow, then the light one
        c.fillStyle = col; const x = cx + dx, y = cy + dy;
        if (t.id === 'pause') { c.fillRect(x - 3, y - 3, 2, 6); c.fillRect(x + 1, y - 3, 2, 6); continue; }
        for (let i = 0; i < 9; i++) {                                              // (a little bigger than before, like the buttons: 9 rows instead of 7)
          if (t.id === 'left') c.fillRect(x - 6 + i, y - i, 1, 2 * i + 1);
          else if (t.id === 'right') c.fillRect(x + 6 - i, y - i, 1, 2 * i + 1);
          else if (t.id === 'jump') c.fillRect(x - i, y - 6 + i, 2 * i + 1, 1);
          else c.fillRect(x - i, y + 6 - i, 2 * i + 1, 1);
        }
      }
    }
  }

  // a tiny kick scooter in pixels (13 x 10), top-left at (x, y)
  scooterGlyph(x, y, col) {
    const c = this.ctx; c.fillStyle = col;
    c.fillRect(x + 9, y, 1, 8); c.fillRect(x + 7, y, 4, 1);                  // stem and handlebar
    c.fillRect(x + 1, y + 6, 9, 1);                                          // deck
    c.fillRect(x, y + 7, 3, 3); c.fillRect(x + 9, y + 7, 3, 3);              // wheels
  }

  // the cutscene's frame: letterbox bars sliding in, the caption (GARE DU MIDI / ALL ABOARD / NEXT ZONE) and the fade to black (g.scene.fade) and from black (g.fadeIn) round it
  drawSceneOverlay(g) {
    const c = this.ctx, S = g.scene;
    if (S) {
      const k = Math.min(1, S.t / 0.7), bar = g.vr ? 0 : Math.round(24 * (k * k * (3 - 2 * k)));
      if (bar) { c.globalAlpha = 1; c.fillStyle = C.ink; c.fillRect(0, 0, VW, bar); c.fillRect(0, VH - bar, VW, bar);
      c.fillStyle = C.amber; c.fillRect(0, bar, VW, 1); c.fillRect(0, VH - bar - 1, VW, 1); }
      if (S.caption) { const w2 = textW(S.caption, 2) + 14, x = Math.round((VW - w2) / 2); c.globalAlpha = 0.9; c.fillStyle = C.ink; c.fillRect(x - 1, 28, w2 + 2, 20); c.fillStyle = C.plum; c.fillRect(x, 29, w2, 18); c.fillStyle = C.amberD; c.fillRect(x, 29, w2, 1); c.fillRect(x, 46, w2, 1); c.globalAlpha = 1; this.ctr(S.caption, 33, C.amberL, 2); }
    }
    const a = Math.max(S ? S.fade : 0, g.fadeIn > 0 ? g.fadeIn * g.fadeIn : 0);
    if (a > 0.003 && !g.vr) { c.globalAlpha = Math.min(1, a); c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH); c.globalAlpha = 1; }
  }

  // a vehicle in pixels, to tell the player what the disc is for: a kick scooter (lime) or the electromagnetic skateboard (cyan deck, red engine ring), about 28 x 18, top-left at (x, y)
  vehicleGlyph(kind, x, y, col) {
    const c = this.ctx; c.fillStyle = col;
    if (kind === 'board') {
      c.fillRect(x + 3, y + 8, 22, 3); c.fillRect(x, y + 6, 4, 2); c.fillRect(x + 24, y + 6, 4, 2);                  // the deck with its kicked nose and tail
      c.fillStyle = '#ff3a6a'; c.fillRect(x + 4, y + 11, 20, 1); c.fillRect(x + 8, y + 13, 12, 1);                       // the glow under it
      c.fillStyle = col; c.fillRect(x + 11, y + 15, 2, 2); c.fillRect(x + 15, y + 15, 2, 2);                           // the magnetic pads
    } else {
      c.fillRect(x + 20, y, 2, 15); c.fillRect(x + 16, y, 9, 2);                                                       // stem and handlebar
      c.fillRect(x + 3, y + 13, 19, 2);                                                                                 // deck
      c.fillRect(x, y + 14, 6, 5); c.fillRect(x + 19, y + 14, 6, 5);                                                   // wheels
    }
  }

  // the comic speech bubble of the scooter indicator (drawScooterHint): a white disc of radius R at (bx, by) with a dark outline and its tail down, the scooter's picture inside
  drawBubble(bx, by, R, pop, a) {
    const c = this.ctx;
    c.save(); c.globalAlpha = 0.95 * a; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        const tail = () => { c.beginPath(); c.moveTo(bx - 6 * pop, by + R - 3); c.lineTo(bx - 2, by + R + 11 * pop); c.lineTo(bx + 5 * pop, by + R - 4); c.closePath(); };
        c.fillStyle = C.ink; c.beginPath(); c.arc(bx, by, R + 2, 0, 6.2832); c.fill(); c.lineWidth = 4; c.strokeStyle = C.ink; tail(); c.stroke();          // the dark outline
        c.fillStyle = '#ffffff'; tail(); c.fill(); c.beginPath(); c.arc(bx, by, R, 0, 6.2832); c.fill();                                                    // the white bubble and its tail
        c.fillStyle = '#ffe6fa'; c.beginPath(); c.arc(bx - R * 0.35, by - R * 0.4, R * 0.22, 0, 6.2832); c.fill();                                       // a highlight, like a comic
        const A2 = this.bubbleArt || SCOOTER_ART, im = this.scooterImg; if (im && im.complete && im.naturalWidth) { const s2 = (R * 1.75) / Math.max(A2.w, A2.h), w2 = A2.w * s2, h2 = A2.h * s2; c.drawImage(im, bx - w2 / 2, by - h2 / 2, w2, h2); }
        c.restore();
  }

  // the indicator for a parked scooter, skateboard or station (g.scooterHint, placed by Renderer3D): not a sign, a translucent DISC on the ground right under it, made from the user's green swirl
  // picture (RING_ART, reshaped into a round disc), squashed into the ground's perspective ellipse, turning slowly and breathing a little. It is big enough to see from far away, and it says what it
  // is for: a floating pixel drawing of the vehicle above it (lime scooter / cyan skateboard) and, below, the key (E, or TAP) and RIDE SCOOTER / RIDE SKATEBOARD. Pressing E or tapping / clicking
  // the disc (or anything of it) gets on (Game.mount). It is armed from 140 m ahead to 60 m behind, and pinned low on its side once the vehicle is behind the camera. Until the picture has loaded
  // (or without it) the disc is drawn with ellipses.
  drawScooterHint(g) {
    const h = g.scooterHint; if (!h || g.riding) return;
    const c = this.ctx, a = Math.max(0.5, Math.min(1, 1.35 - Math.abs(h.ahead) / (h.ahead < 0 ? 90 : 150))), board = h.kind === 'board', label = g.touch ? 'TAP' : 'E', what = board ? 'RIDE SKATEBOARD' : h.kind === 'bike' ? 'RIDE SPORT E-BIKE' : 'RIDE MAGNETIC SCOOTER';
    if (!this.ringImg && typeof RING_ART !== 'undefined') { this.ringImg = new Image(); this.ringImg.src = RING_ART.a; }
    const art = this.ringImg && this.ringImg.complete && this.ringImg.naturalWidth;
    const rx = 14 + Math.min(36, h.rx * 1.4), ry = Math.max(h.ry * 1.25, rx * 0.42), k = 1 + 0.05 * Math.sin(g.time * 3);        // the disc's half axes on the ground (never small)
    if (art) {
      c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.globalAlpha = (h.pinned ? 0.9 : 0.82) * a;
      c.translate(h.x, h.y); c.scale(1, ry / rx); c.rotate(g.time * 0.7); c.drawImage(this.ringImg, -rx * k, -rx * k, 2 * rx * k, 2 * rx * k);          // (turned, then squashed: a disc seen at a slant)
      c.restore();
    } else {
      c.save(); c.beginPath(); c.ellipse(h.x, h.y, rx, ry, 0, 0, 6.2832); c.fillStyle = '#7ddc3a'; c.globalAlpha = 0.22 * a; c.fill();
      c.lineWidth = 1; c.strokeStyle = '#b6ff7a'; c.globalAlpha = 0.75 * a; c.beginPath(); c.ellipse(h.x, h.y, rx, ry, 0, 0, 6.2832); c.stroke(); c.restore();
    }
    // the vehicle above the disc. THE SCOOTER (the user, 2026-11-17): a comic SPEECH BUBBLE that pops up (round, white, a dark outline, its tail pointing down at the scooter) with the user's
    // picture of the magnetic scooter inside, as it is (SCOOTER_ART). The skateboard keeps its pixel drawing.
    const bob = Math.round(Math.sin(g.time * 4) * 2);
    if (h.pinned) {} else if (!board && typeof SCOOTER_ART !== 'undefined') {      // (pinned low at the side once passed: no bubble, so it does not hide the road)
      this.bubbleArt = h.kind === 'bike' && typeof BIKE_ART !== 'undefined' ? BIKE_ART : SCOOTER_ART;
      this.scooterImg = this.bubbleArt.img || this.scooterImg;
      if (h.key !== this.bubbleKey) { this.bubbleKey = h.key; this.bubbleT = g.time; }                                     // a new scooter: the bubble pops again
      const t = g.time - this.bubbleT, pop = t < 0.35 ? Math.sin(Math.min(1, t / 0.28) * Math.PI / 2) * (1 + 0.18 * Math.sin(Math.min(1, t / 0.35) * Math.PI)) : 1;   // springs out, overshoots a little
      const R = 24 * pop, bx = Math.round(h.x), by = Math.round(h.y - ry - 30) + bob;
      if (R > 1) this.drawBubble(bx, by, R, pop, a);
    } else {
      const gx = Math.round(h.x - 14), gy = Math.round(h.y - ry - 28) + bob, col = board ? '#35e6ff' : '#8ff04a';
      c.globalAlpha = 0.55 * a; this.vehicleGlyph(h.kind, gx + 1, gy + 1, C.ink); c.globalAlpha = 0.92 * a; this.vehicleGlyph(h.kind, gx, gy, col);
    }
    // what to press, and for what: text only (no plate, like the rest of the indicator), at the left edge under the counters, out of the road's way; the disc and the vehicle above it stay on the spot
    const px = 5, py = 62, tcol = board ? '#9ff4ff' : '#ffb0ee';
    c.globalAlpha = 0.6 * a; this.txt(label, px + 1, py + 1, C.ink, 2); this.txt(what, px + 1, py + 14, C.ink, 1);
    c.globalAlpha = 0.98 * a; this.txt(label, px, py, '#d8ffb0', 2);
    c.globalAlpha = 0.95 * a; this.txt(what, px, py + 13, tcol, 1);
    c.globalAlpha = 1;
  }

  drawHud(g) {
    const w = g.world, p = g.p, T = w.track, pulse = g.coinPulse > 0, pk = g.pk, dy = pk ? 9 : 0;        // pk: the 3D build's power-ups, shards and missions (null in the classic game: nothing below changes)
    this.plate(3, 3, 62, pk ? 33 : 24);
    this.txt('DIST ' + Math.floor(p.z / 10) + ' M', 7, 6, C.bone);
    if (this.menu3d) {                                      // the 3D coin's rings, small: lilac rim, pink, green, cream, lime, mint core
      const cx = 11, cy = pulse ? 18 : 19;
      [[5, '#d9baff'], [4.4, '#ff2a8a'], [3.8, '#62d444'], [2.8, '#e9f7a8'], [2.1, '#8dff1f'], [1.4, '#52ff2e'], [0.7, '#c8ffb8']].forEach(([r, col]) => { this.ctx.fillStyle = col; this.ctx.beginPath(); this.ctx.arc(cx, cy, r, 0, 6.2832); this.ctx.fill(); });
    } else this.ctx.drawImage(SPR.coin[pulse ? 1 : 0], 7, pulse ? 14 : 15);
    this.txt('' + g.coins, 18, 17, pulse ? C.bone : C.amberL);
    const pb = w.playerBand(p.z, p.x), lb = BIOMES[pb.to] && BIOMES[pb.to].label, nm = g.detour && p.z >= g.detour.z0 ? NEON_CORNER.NAME : lb && pb.t > 0.5 ? lb : T.segments[pb.route].name, nw = textW(nm) + 8;     // inside the aquarium tunnel the plate shows its own name
    this.plate(VW - 3 - nw, 3, nw, 11);
    this.txt(nm, VW - 3 - nw + 4, 6, C.tealL);
    if (pk) this.drawPerksHud(g);
    if (g.prompt && g.state === 'play') { // junction visible: LEFT / RIGHT with the current pick highlighted
      const f = g.prompt.fork, sel = g.prompt.sel;
      const l = '< LEFT: ' + T.segments[f.left.route].name, r = 'RIGHT: ' + T.segments[f.right.route].name + ' >';
      const lw = textW(l) + 8, rw = textW(r) + 8;
      this.plate(5, 31 + dy, lw, 11, sel === 'left' ? C.amber : C.ink);
      this.txt(l, 9, 34 + dy, sel === 'left' ? C.amberL : C.stoneL);
      this.plate(VW - 5 - rw, 31 + dy, rw, 11, sel === 'right' ? C.amber : C.ink);
      this.txt(r, VW - 5 - rw + 4, 34 + dy, sel === 'right' ? C.amberL : C.stoneL);
    } else if (g.banner && g.banner.t > 0) {
      const bw = textW(g.banner.text, 2) + 12;
      this.plate(Math.round((VW - bw) / 2), 30 + dy, bw, 15, C.amber);
      this.ctr(g.banner.text, 33 + dy, C.amberL, 2);
    }
  }

  // The journey through a Stargate (3D build, Portal): between the entry door and the exit door of a passage the screen is lit pink from its corners (the middle stays clear: the road is still played),
  // thin light streaks fly outward from the centre, and a flash goes over the screen as each door is crossed. `portal.k` / `portal.flash` are set by Portal.update.
  drawPortalFx(g) {
    const c = this.ctx, P = g.portal, k = P.k, f = P.flash, R = Math.hypot(VW, VH) / 2, still = P.reduced;
    if (k > 0.004) {
      const gr = c.createRadialGradient(VW / 2, VH / 2, R * 0.34, VW / 2, VH / 2, R); gr.addColorStop(0, 'rgba(255,46,150,0)'); gr.addColorStop(1, 'rgba(255,46,150,' + (0.62 * k).toFixed(3) + ')');
      c.fillStyle = gr; c.fillRect(0, 0, VW, VH); c.lineWidth = 1;
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * 6.2832 + Math.sin(i * 12.9898) * 0.2, ph = still ? 0.5 : (g.time * (0.9 + (i % 5) * 0.17) + i * 0.37) % 1, r0 = R * (0.4 + 0.5 * ph * ph), r1 = r0 + R * 0.12 * (0.4 + ph);
        c.strokeStyle = 'rgba(255,214,238,' + (k * (0.12 + 0.55 * ph)).toFixed(3) + ')'; c.beginPath(); c.moveTo(VW / 2 + Math.cos(a) * r0, VH / 2 + Math.sin(a) * r0 * 0.5625); c.lineTo(VW / 2 + Math.cos(a) * r1, VH / 2 + Math.sin(a) * r1 * 0.5625); c.stroke();
      }
    }
    if (f > 0.01) { c.fillStyle = 'rgba(255,238,248,' + (0.5 * f).toFixed(3) + ')'; c.fillRect(0, 0, VW, VH); }
  }

  // The 3D build's depth layer on the HUD, kept to the edges and the sky so the road stays clear: under the coin count the shards of this run and the saved total, top right the mission (run progress),
  // top centre one small chip per active power-up (a bar for what is left, and the seconds), brief toasts above the runner, and a plate when a mission is completed.
  drawPerksHud(g) {
    const pk = g.pk, c = this.ctx, m = pk.mission, t = g.time, live = g.state === 'play' || g.state === 'pause';
    const gem = (x, y, col) => { c.fillStyle = col; c.fillRect(x + 1, y, 2, 1); c.fillRect(x, y + 1, 4, 2); c.fillRect(x + 1, y + 3, 2, 1); };
    gem(7, 29, '#c58bff'); this.txt('' + (pk.shards + pk.rewardShards), 14, 28, '#e6d2ff'); this.txt('ALL ' + pk.save.shards, 30, 28, C.stoneL);
    if (m) {                                                                                           // the mission: what to do, how far along, and a bar
      const done = m.done, txt = done ? 'DONE +' + REWARD.mission : m.progress + '/' + m.goal + ' ' + m.label, w = Math.max(48, textW(txt) + 11), x = VW - 3 - w, hot = pk.flash > 0 && Math.floor(t * 8) % 2 === 0;
      this.plate(x, 17, w, 13, hot ? C.amber : done ? C.amberD : C.teal);
      gem(x + 3, 20, '#ffd24a'); this.txt(txt, x + 9, 19, done ? C.amberL : C.bone);
      c.fillStyle = C.ink; c.fillRect(x + 3, 26, w - 6, 2); c.fillStyle = done ? C.amberL : C.tealL; c.fillRect(x + 3, 26, Math.round((w - 6) * Math.min(1, m.progress / m.goal)), 2);
    }
    if (live) {
      const list = ['magnet', 'aura', 'dash'].filter(k => pk.t[k] > 0), W = 35, x0 = Math.round(160 - list.length * (W + 2) / 2 + 1);
      const COL = { magnet: '#ff6a7a', aura: '#5ff0d0', dash: '#ffb347' }, NAME = { magnet: 'MAG', aura: 'AURA', dash: 'DASH' };
      list.forEach((k, i) => {
        const x = x0 + i * (W + 2), low = pk.t[k] < 2 && Math.floor(t * 6) % 2 === 0;                       // the last two seconds blink
        this.plate(x, 19, W, 11, COL[k]); c.fillStyle = C.plum; c.fillRect(x, 19, W, 11);
        c.fillStyle = low ? C.stoneD : COL[k]; c.fillRect(x + 2, 27, Math.max(1, Math.round((W - 4) * pk.t[k] / pk.tot[k])), 2);
        this.txt(NAME[k] + ' ' + Math.ceil(pk.t[k]), x + 3, 21, low ? C.stoneL : C.bone);
      });
      pk.pops.forEach((q, i) => {                                                                          // toasts rise from just above the runner and fade out
        const a = q.t < 0.8 ? 1 : Math.max(0, 1 - (q.t - 0.8) / 0.3), y = Math.round(92 + i * 9 - q.t * 14);
        c.globalAlpha = a; this.ctr(q.txt, y, q.col); c.globalAlpha = 1;
      });
      if (pk.flash > 0.2) {                                                                                // mission completed: a plate in the sky, gold, with the reward
        const bw = textW('MISSION COMPLETE', 2) + 14, bx = Math.round((VW - bw) / 2);
        c.globalAlpha = Math.min(1, pk.flash * 2); this.plate(bx, 40, bw, 24, C.amber); this.ctr('MISSION COMPLETE', 43, C.amberL, 2);
        this.ctr('+' + REWARD.mission + '  +' + REWARD.shardsPerMission + ' SHARD', 55, C.bone); c.globalAlpha = 1;
      }
    }
  }

  // 3D menu: title block on the left, the animated character fills the rest of the screen
  // a panel made of the user's artwork (an Image), optionally under a dark veil of the given strength; false if the image is not available
  artPanel(img, x, y, w, h, veil) {
    if (!(img && img.complete && img.naturalWidth)) return false;
    const c = this.ctx, sm = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(img, x, y, w, h); c.imageSmoothingEnabled = sm;
    if (veil) { c.fillStyle = 'rgba(14,8,26,' + veil + ')'; c.fillRect(x, y, w, h); }
    return true;
  }

  drawTitleGlass(g) {
    const T = Renderer.THEME, hint = (a, b, c3) => { this.ctrAt(71, a, 80, T.text, 1); this.ctrAt(71, b, 90, T.text, 1); this.ctrAt(71, c3, 100, T.dim, 1); };
    this.panel(8, 26, 126, 116, 16);
    if (g.vr) { /* VR: no keyboard / touch hints */ }
    else if (g.touch) hint('HOLD < > STEER', 'UP JUMP  DOWN SLIDE', 'II PAUSE');
    else hint('Q D / ARROWS STEER', 'Z / SPACE / UP  JUMP', 'S / DOWN SLIDE  P PAUSE');
    this.button(BTN.title, g);
    if (g.r && g.r.nextCharacter) this.button({ x: BTN.char.x, y: BTN.char.y, w: BTN.char.w, h: BTN.char.h, label: g.r.character === 'zagla' ? 'ZAGLA' : 'BERRY' }, g);
    if (!g.touch && !g.vr) this.ctrAt(71, g.r && g.r.nextCharacter ? 'ENTER  PLAY     C  CHARACTER' : 'OR PRESS ENTER', 146, T.dim, 1);
  }
  drawTitle3D(g) {
    if (this._glassOn) return this.drawTitleGlass(g);
    // both menu panels are the user's artwork (this.titleImg / this.controlsImg, set by the 3D front end). The title text sits over the dark part of the first, to the
    // right of its light wall, with its glowing red line between 'PROTOTYPE 01' and 'TAKE A FORK.'; the controls panel is drawn under a dark veil so its text stays
    // readable. Without an image the usual bordered panel is drawn.
    const art1 = this.artPanel(this.titleImg, 8, 8, 124, 52, 0); if (!art1) this.panel(8, 8, 124, 52);
    if (!this.artPanel(this.controlsImg, 8, 66, 124, 40, 0.25)) this.panel(8, 66, 124, 40);
    const tx = art1 ? 34 : 14;
    const T = Renderer.THEME;
    if (!this.hiMenu(g)) { this.txt('BERRY', tx, 14, T.pinkL, 2, T.ink); this.txt('RUNNER 2', tx, 28, T.lime, 2, T.ink); }      // (the smooth logo is on the layer above: Renderer.drawMenuHi; this is its pixel stand-in, in VR)
    this.txt('TAKE A FORK.', tx, 48, T.text, 1);
    const tc = this.controlsImg && this.controlsImg.complete && this.controlsImg.naturalWidth ? C.tealL : C.bone;     // over the artwork the controls text is light teal (no white)
    if (g.vr) { /* VR: no keyboard / touch hints */ }
    else if (g.touch) { this.txt('HOLD < > STEER', 14, 74, tc, 1); this.txt('UP JUMP  DOWN SLIDE', 14, 84, tc, 1); this.txt('II PAUSE', 14, 94, tc, 1); }
    else { this.txt('Q D / ARROWS STEER', 14, 74, tc, 1); this.txt('Z / SPACE / UP  JUMP', 14, 84, tc, 1); this.txt('S / DOWN SLIDE  P PAUSE', 14, 94, tc, 1); }
    this.button(BTN.title, g);
    if (g.r && g.r.nextCharacter) this.button({ x: BTN.char.x, y: BTN.char.y, w: BTN.char.w, h: BTN.char.h, label: g.r.character === 'zagla' ? 'ZAGLA' : 'BERRY' }, g);       // the character button: who runs (the other one on click, or the C key)
    if (!g.touch && !g.vr) { this.txt('OR PRESS ENTER', 24, 144, C.stoneL, 1); if (g.r && g.r.nextCharacter) this.txt('C CHARACTER', 232, 144, C.stoneL, 1); }
  }

  drawTitle(g) {
    if (this.menu3d) return this.drawTitle3D(g);
    this.ctx.drawImage(SPR.signForest, 14, 96); this.ctx.drawImage(SPR.signMarket, 272, 96); // the two roads, framing the panel
    this.panel(60, 30, 200, 124);
    if (!this.hiMenu(g)) this.ctr('BERRY RUNNER 2', 46, Renderer.THEME.pinkL, 2, Renderer.THEME.ink);
    if (g.touch) {
      this.ctr('HOLD < > TO STEER', 84, C.bone);
      this.ctr('UP  JUMP   DOWN  SLIDE', 93, C.bone);
      this.ctr('II  PAUSE', 102, C.bone);
    } else {
      this.ctr('Q D / ARROWS  STEER', 84, C.bone);
      this.ctr('Z / SPACE / UP  JUMP', 93, C.bone);
      this.ctr('S / DOWN  SLIDE   P  PAUSE', 102, C.bone);
    }
    this.ctr('TAKE A FORK. PICK A ROAD.', 112, C.sand);
    this.button(BTN.title, g);
    if (!g.touch) this.ctr('OR PRESS ENTER', 145, C.stoneL);
  }

  drawPause(g) {
    this.ctx.fillStyle = this.dither; this.ctx.fillRect(0, 0, VW, VH);
    const more = !!g.hasSettings;                                                  // (the 3D build: a MENU pill under RESUME, on a taller card)
    if (this._glassOn) this.panel(100, 50, 120, more ? 96 : 82, 15); else this.panel(100, 54, 120, more ? 88 : 70);
    if (!this.hiMenu(g)) this.ctr('PAUSED', 64, Renderer.THEME.pinkL, 3, Renderer.THEME.ink);
    this.button(BTN.pause, g); if (more) this.button(BTN.menuP, g);
    if (!g.touch && !g.vr) this.ctr('P  ESC', more ? 128 : 110, C.stoneL);
  }

  drawOver(g) {
    this.ctx.fillStyle = this.dither; this.ctx.fillRect(0, 0, VW, VH);
    if (g.pk) {                                                                    // the 3D build: a taller panel with what this run earned and what is saved
      const pk = g.pk; this.panel(80, 14, 160, g.hasSettings ? 140 : 128, 11);
      if (!this.hiMenu(g)) this.ctr('GAME OVER', 20, Renderer.THEME.pink, 3, Renderer.THEME.ink);
      this.ctr('DIST ' + Math.floor(g.p.z / 10) + ' M', 44, C.bone);
      this.ctr('COINS ' + g.coins, 53, C.amberL);
      this.ctr('SCORE ' + g.score(), 62, C.bone);
      this.ctr('BEST ' + g.best, 71, C.tealL);
      this.ctr('THIS RUN  SHARDS ' + (pk.shards + pk.rewardShards) + '  WAYMARKS ' + pk.waymarks, 83, '#e6d2ff');
      this.ctr('MISSIONS ' + pk.missionsDone + '  NEAR ' + pk.nearMisses + '  BONUS ' + pk.bonus, 92, C.sand);
      this.ctr('SAVED  SHARDS ' + pk.save.shards + '  MISSIONS ' + pk.save.missions.done, 101, C.stoneL);
    } else {
    this.panel(80, 30, 160, 112, 12);
    if (!this.hiMenu(g)) this.ctr('GAME OVER', 38, Renderer.THEME.pink, 3, Renderer.THEME.ink);
    this.ctr('DIST ' + Math.floor(g.p.z / 10) + ' M', 64, C.bone);
    this.ctr('COINS ' + g.coins, 74, C.amberL);
    this.ctr('SCORE ' + g.score(), 86, C.bone);
    this.ctr('BEST ' + g.best, 96, C.tealL);
    }
    this.button(BTN.over, g);
    if (g.hasSettings && g.pk) { this.button(BTN.menuO, g); if (!g.touch && !g.vr) this.ctr('ENTER  RUN AGAIN     ESC  MENU', 158, C.sand); }
    else if (!g.touch && !g.vr) this.ctr('SPACE  ENTER  R', 133, C.sand);
  }
}
