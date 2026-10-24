// UI colours and biome definitions. A biome is one island zone: palette ramps for the code-drawn parts
// (sky, sea, checkered ground, path) and the list of roadside sprites (from assets/atlas.png) it uses.
const C = {
  ink: '#1b1034', plum: '#2a1a5a',
  burgD: '#6a1a5a', burg: '#a02a78', burgL: '#ff7a9a',
  amberD: '#d97a00', amber: '#ffb81c', amberL: '#ffe066',
  teal: '#1fb0b8', tealL: '#5adcd0',
  bone: '#fff4e0', stoneL: '#d8c8d8', sand: '#f8d890',
};

const BIOMES = {
  // opening zone: green-hill shore under a violet-to-gold sunset
  shore: {
    name: 'SUNSET SHORE', skyline: 'shore', props: 'shore', density: 0.3, margin: 0.55,
    sky: ['#2b1b6b', '#5b2a9a', '#9a3fb0', '#e0488f', '#ff7a4d', '#ffa63d', '#ffd35a', '#fff0a8'],
    sea: ['#0e8fb4', '#27b9d0', '#7be0e0'],
    ground: ['#38b43a', '#5fd13f'], earth: ['#c4622a', '#e0803a'],
    road: ['#f2cf86', '#e6bd6e'], curb: ['#fff1c4', '#e8c88a'], line: '#f2cf86',
    scenery: ['palm_shore', 'flower', 'palm_short', 'bush_shore', 'totem', 'rail', 'palm_shore', 'flower', 'bush_shore', 'rail'],
  },
  // left branch: deep jungle, darker greens and a hotter sky
  jungle: {
    name: 'JUNGLE ISLE', skyline: 'jungle', props: 'jungle', density: 0.1, margin: 0.4, deep: true,
    sky: ['#1a1a5e', '#3a2a8a', '#7a3a9e', '#c24a8a', '#ff6f4a', '#ff9a3c', '#ffc94d', '#ffe88a'],
    sea: ['#0b6e8e', '#1a9bb0', '#5ccfc0'],
    ground: ['#1f8a3a', '#2fb04a'], earth: ['#8a4a22', '#a85c2a'],
    road: ['#d9b06a', '#c99a58'], curb: ['#8ed06a', '#6fb85a'], line: '#d9b06a',
    scenery: ['palm_jungle', 'tree_jungle', 'fern', 'palm_jungle', 'ruin', 'bush_jungle', 'waterfall', 'palm_jungle', 'fern', 'tree_jungle'],
  },
  // right branch: orange sea-cliffs, floating islands, lighthouse
  cliffs: {
    name: 'CLIFF COAST', skyline: 'cliffs', props: 'cliffs', density: 0.25, margin: 0.8,
    sky: ['#3b1a5e', '#7a2a8a', '#c23c8a', '#ff5a5a', '#ff8a3c', '#ffb23c', '#ffd868', '#fff2b8'],
    sea: ['#0e86a8', '#2aaecb', '#8ae6e0'],
    ground: ['#a8c838', '#c8e04a'], earth: ['#d0562a', '#e8743a'],
    road: ['#f0c890', '#e2b078'], curb: ['#fff0d0', '#e8c498'], line: '#f0c890',
    scenery: ['stack', 'rocks', 'arch', 'shrub', 'lighthouse', 'rocks', 'stack', 'float', 'shrub', 'stack'],
  },
};

const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function lerpHex(a, b, t) {
  if (t <= 0) return a;
  const A = _rgb(a), B = _rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const PAL_KEYS = ['sky', 'sea', 'ground', 'earth', 'road', 'curb'];
function lerpPalette(a, b, t) {
  const o = { line: lerpHex(a.line, b.line, t) };
  for (const k of PAL_KEYS) o[k] = a[k].map((c, i) => lerpHex(c, b[k][i], t));
  return o;
}
// Palette between the opening biome and `toId`, quantised to 8 steps so the shift reads as pixel bands.
const _palCache = new Map();
function paletteFor(toId, t) {
  const q = Math.round(t * 8), key = toId + q;
  if (!_palCache.has(key)) _palCache.set(key, lerpPalette(BIOMES[TRACK.segments[TRACK.sequence[0].seg].biome], BIOMES[toId], q / 8));
  return _palCache.get(key);
}
