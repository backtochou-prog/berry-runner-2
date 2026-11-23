// 3D front end: the same Game (rules, input, track) driven through Renderer3D instead of the pixel-art renderer.
// The menu keeps the START button left of the animated character.
Object.assign(BTN.title, { x: 14, y: 114, w: 108, h: 18 });
(function () {
  const cv = document.getElementById('screen');
  window.__wf = new Game(cv, { world: new World(TRACK), renderer: new Renderer3D(cv, ENV3D) });
  window.__wf.sfx = new GameAudio();                                  // sound: effects + the music track and its beat clock (see src/audio.js)
  window.__wf.applyOpt();                                              // the settings kept on this device (music, effects, colours, resolution)
  { const r3 = window.__wf.r, later = () => { if (r3.loadKartArt) r3.loadKartArt(); }; if (window.requestIdleCallback) setTimeout(() => requestIdleCallback(later, { timeout: 8000 }), 5000); else setTimeout(later, 7000); }      // the kart circuit's art, in the background, once the game is up
  window.__wf.xr = typeof XR3D !== 'undefined' ? XR3D.maybeCreate(window.__wf) : null;   // immersive VR (Meta Quest Browser, WebXR): an ENTER VR button only where it is supported (src3d/xr3d.js)
})();
