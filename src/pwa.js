// The web app: registers the service worker (sw.js: the game starts with no network once it has been opened) and offers the installation.
// Chrome / Edge / Samsung Internet (Android, desktop) fire `beforeinstallprompt`: an INSTALL button appears on the title screen and opens the browser's own dialog.
// Safari (iPhone, iPad) has no such event: there the button explains "Share, then Add to Home Screen". Nothing is shown once the game runs as an installed app.
(function () {
  if (location.protocol === 'file:') return;
  if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  const standalone = () => matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null, btn = null, tip = null;
  const make = () => {
    btn = document.createElement('button'); btn.id = 'install'; btn.type = 'button'; btn.textContent = 'INSTALL APP';
    btn.style.cssText = 'position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:20;display:none;padding:9px 18px;border:2px solid #ff4f9e;border-radius:999px;background:#151022;color:#fff;font:bold 13px/1 system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 0 14px rgba(255,79,158,.55);touch-action:manipulation;cursor:pointer';
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
  window.__pwa = { get canInstall() { return !!deferred; }, standalone };
})();
