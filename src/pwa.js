// The web app: registers the service worker (sw.js: the game starts with no network once it has been opened) and offers the installation.
// Chrome / Edge / Samsung Internet (Android, desktop) fire `beforeinstallprompt`: an INSTALL button appears on the title screen and opens the browser's own dialog.
// Safari (iPhone, iPad) has no such event: there the button explains "Share, then Add to Home Screen". Nothing is shown once the game runs as an installed app.
(function () {
  // the loading screen (index.html #boot) goes once the game exists and has drawn its first frames
  (function bootDone() { const b = document.getElementById('boot'); if (!b) return; if (window.__wf) { setTimeout(() => { b.className = 'done'; setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 600); }, 250); } else setTimeout(bootDone, 100); })();
  if (location.protocol === 'file:') return;
  if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  const standalone = () => matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null, btn = null, tip = null;
  const make = () => {
    btn = document.createElement('button'); btn.id = 'install'; btn.type = 'button'; btn.textContent = 'INSTALL APP';
    btn.style.cssText = 'position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:20;display:none;padding:9px 18px;border:2px solid #ff4f9e;border-radius:999px;background:#151022;color:#fff;font:700 13px/1 Fredoka,system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 0 14px rgba(255,79,158,.55);touch-action:manipulation;cursor:pointer';
    btn.addEventListener('click', async ev => {
      ev.stopPropagation();
      if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; show(); }
      else if (ios) { if (!tip) { tip = document.createElement('div'); tip.style.cssText = 'position:fixed;left:50%;bottom:calc(52px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:20;max-width:80vw;padding:10px 14px;border-radius:10px;background:#151022;border:1px solid #ff4f9e;color:#fff;font:13px/1.35 system-ui,sans-serif;text-align:center'; tip.textContent = 'Tap the Share button, then "Add to Home Screen".'; document.body.appendChild(tip); setTimeout(() => { if (tip) { tip.remove(); tip = null; } }, 6000); } }
    });
    for (const t of ['pointerdown', 'touchstart', 'mousedown']) btn.addEventListener(t, ev => ev.stopPropagation());      // (a tap on it must not start the run)
    document.body.appendChild(btn);
  };
  const show = () => { if (!btn) return; const g = window.__wf, title = !g || g.state === 'title'; btn.style.display = !standalone() && title && (deferred || ios) ? 'block' : 'none'; };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener('appinstalled', () => { deferred = null; show(); });
  window.addEventListener('DOMContentLoaded', () => { make(); show(); setInterval(show, 500); });
  // TAP TWICE FOR FULL SCREEN: on the title screen (and on the pause screen) a short line says so, and two quick taps anywhere (or a double click) put the game in fullscreen and turn it to
  // landscape (Game.goFullscreen: the browser's fullscreen, then the orientation lock, where the browser has them: Chrome on Android does; an iPhone's Safari has no fullscreen for pages, so
  // nothing is offered there). Not during a run: two quick taps are jumps there. The line goes once the game is in fullscreen or runs as an installed app.
  const canFS = () => { const de = document.documentElement; return !!(de.requestFullscreen || de.webkitRequestFullscreen); }, inFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const menu = () => { const g = window.__wf; return !!g && (g.state === 'title' || g.state === 'pause') && !g.settingsOpen; };      // (not over the settings card)
  let fsTip = null, lastTap = null;
  const showFS = () => { if (!fsTip) return; fsTip.style.display = canFS() && !inFS() && !standalone() && menu() ? 'block' : 'none'; };
  const twice = (x, y) => { const now = performance.now(), hit = lastTap && now - lastTap.t < 450 && Math.hypot(x - lastTap.x, y - lastTap.y) < 60; lastTap = hit ? null : { t: now, x, y }; return !!hit; };
  const goFS = () => { const g = window.__wf; if (!g || !menu() || inFS() || !canFS()) return false; if (g.goFullscreen) g.goFullscreen(); setTimeout(showFS, 400); return true; };
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; if (twice(e.clientX, e.clientY)) goFS(); }, true);
  window.addEventListener('dblclick', () => { goFS(); }, true);
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, showFS);
  window.addEventListener('DOMContentLoaded', () => {
    fsTip = document.createElement('div'); fsTip.id = 'fs-tip'; fsTip.textContent = 'TAP TWICE FOR FULL SCREEN';
    fsTip.style.cssText = 'position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:20;display:none;pointer-events:none;white-space:nowrap;padding:7px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.55);background:linear-gradient(135deg,rgba(60,40,96,.86),rgba(120,40,96,.86));color:#fff;font:700 12px/1 Fredoka,system-ui,sans-serif;letter-spacing:.1em;text-shadow:0 1px 2px #151022;box-shadow:0 0 12px rgba(255,79,158,.45)';
    document.body.appendChild(fsTip); showFS(); setInterval(showFS, 500);
  });
  window.__pwa = { get canInstall() { return !!deferred; }, standalone, goFS };
})();
