/* Mahjong solitaire — layouts, solvable dealing, free/blocked rules.
   No DOM. Shared by the page and the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MahjongCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeRng(seed) {
    var s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Tiles are grouped so flowers match any flower and seasons match any
     season -- everything else matches only its identical twin. */
  var GROUPS = {
    tecken: ['一', '二', '三', '四', '五', '六', '七', '八', '九'],
    cirklar: ['●1', '●2', '●3', '●4', '●5', '●6', '●7', '●8', '●9'],
    bambu: ['▮1', '▮2', '▮3', '▮4', '▮5', '▮6', '▮7', '▮8', '▮9'],
    vindar: ['東', '南', '西', '北'],
    drakar: ['中', '發', '白']
  };

  function tileTypes() {
    var out = [];
    for (var g in GROUPS) {
      for (var i = 0; i < GROUPS[g].length; i++) {
        out.push({ id: g + ':' + GROUPS[g][i], group: g, face: GROUPS[g][i] });
      }
    }
    return out;                      // 34 distinct motifs
  }

  /* Layers are centred whole-tile rectangles. Keeping everything on one grid
     makes "covered" a single lookup instead of a rectangle intersection, and
     the classic stepped look comes from a per-layer pixel offset at render
     time rather than from half-tile coordinates. */
  var LAYOUTS = {
    kompakt: { name: 'Kompakt', tiles: 72, layers: [[8, 6], [5, 4], [2, 2]] },
    klassisk: { name: 'Klassisk', tiles: 144, layers: [[12, 8], [8, 4], [4, 3], [2, 1]] }
  };

  function buildPositions(layoutKey) {
    var spec = LAYOUTS[layoutKey] || LAYOUTS.kompakt;
    var pos = [], z;
    for (z = 0; z < spec.layers.length; z++) {
      var w = spec.layers[z][0], h = spec.layers[z][1];
      // Snap the origin to whole tile steps: a half-tile offset would mean no
      // tile ever sits squarely on another, so nothing would ever be covered.
      var ox = Math.round((spec.layers[0][0] - w) / 2);
      var oy = Math.round((spec.layers[0][1] - h) / 2);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          pos.push({ x: ox + x, y: oy + y, z: z });
        }
      }
    }
    // Pairs only: trim from the top layer inwards if the maths is odd.
    while (pos.length > spec.tiles) pos.pop();
    if (pos.length % 2) pos.pop();
    return pos;
  }

  function key(p) { return p.x + ',' + p.y + ',' + p.z; }

  function index(tiles) {
    var m = {};
    for (var i = 0; i < tiles.length; i++) {
      if (!tiles[i].removed) m[key(tiles[i])] = tiles[i];
    }
    return m;
  }

  /* Free = nothing stacked directly on top, and at least one open side.
     Brightness must never be the only cue for this in the UI. */
  function isFree(tile, map) {
    if (tile.removed) return false;
    if (map[tile.x + ',' + tile.y + ',' + (tile.z + 1)]) return false;
    var left = map[(tile.x - 1) + ',' + tile.y + ',' + tile.z];
    var right = map[(tile.x + 1) + ',' + tile.y + ',' + tile.z];
    return !left || !right;
  }

  function freeTiles(tiles) {
    var map = index(tiles), out = [];
    for (var i = 0; i < tiles.length; i++) {
      if (isFree(tiles[i], map)) out.push(tiles[i]);
    }
    return out;
  }

  function matches(a, b) {
    if (!a || !b || a === b) return false;
    if (a.group === 'blommor' && b.group === 'blommor') return true;
    return a.id === b.id;
  }

  /* Deal by playing the game backwards: repeatedly take two currently-free
     positions and assign them a pair. Every board produced this way has at
     least one winning line, which a random shuffle cannot promise. */
  function deal(layoutKey, seed) {
    var rng = makeRng(seed || 1);
    var pos = buildPositions(layoutKey);
    var tiles = pos.map(function (p, i) {
      return { i: i, x: p.x, y: p.y, z: p.z, id: null, group: null, face: null, removed: false };
    });

    var placed = tiles.map(function (t) {
      return { i: t.i, x: t.x, y: t.y, z: t.z, removed: false };
    });
    var types = tileTypes();
    var order = [];

    while (true) {
      var free = [];
      var map = index(placed);
      for (var i = 0; i < placed.length; i++) {
        if (isFree(placed[i], map)) free.push(placed[i]);
      }
      if (free.length < 2) break;
      var a = free[Math.floor(rng() * free.length)];
      a.removed = true;
      // recompute: removing a can free new tiles
      var map2 = index(placed), free2 = [];
      for (var j = 0; j < placed.length; j++) {
        if (isFree(placed[j], map2)) free2.push(placed[j]);
      }
      if (!free2.length) { a.removed = false; break; }
      var b = free2[Math.floor(rng() * free2.length)];
      b.removed = true;
      order.push([a.i, b.i]);
    }

    // Assign a type per extracted pair, cycling through the 34 motifs.
    for (var p = 0; p < order.length; p++) {
      var t = types[p % types.length];
      tiles[order[p][0]].id = t.id;
      tiles[order[p][0]].group = t.group;
      tiles[order[p][0]].face = t.face;
      tiles[order[p][1]].id = t.id;
      tiles[order[p][1]].group = t.group;
      tiles[order[p][1]].face = t.face;
    }
    // Any position the backward pass could not reach is dropped rather than
    // left blank -- an unreachable tile would make the board unwinnable.
    tiles = tiles.filter(function (t) { return t.id !== null; });

    return {
      layout: layoutKey,
      tiles: tiles,
      seed: seed || 1,
      shuffles: 0,
      removedPairs: 0,
      status: 'playing'
    };
  }

  function remaining(g) {
    return g.tiles.filter(function (t) { return !t.removed; }).length;
  }

  /* Every currently available pair, used for hints and for detecting a dead
     board. */
  function availablePairs(g) {
    var free = freeTiles(g.tiles), out = [];
    for (var i = 0; i < free.length; i++) {
      for (var j = i + 1; j < free.length; j++) {
        if (matches(free[i], free[j])) out.push([free[i], free[j]]);
      }
    }
    return out;
  }

  function removePair(g, a, b) {
    var map = index(g.tiles);
    if (!matches(a, b) || !isFree(a, map) || !isFree(b, map)) return false;
    a.removed = b.removed = true;
    g.removedPairs++;
    if (remaining(g) === 0) g.status = 'won';
    else if (!availablePairs(g).length) g.status = 'stuck';
    return true;
  }

  /* Reshuffle what is left, in place. Limited to keep it a rescue, not a
     strategy. */
  function shuffle(g, seed) {
    var rng = makeRng(seed || (g.seed + g.shuffles + 1));
    var live = g.tiles.filter(function (t) { return !t.removed; });
    var faces = live.map(function (t) {
      return { id: t.id, group: t.group, face: t.face };
    });
    for (var i = faces.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = faces[i]; faces[i] = faces[j]; faces[j] = t;
    }
    for (var k = 0; k < live.length; k++) {
      live[k].id = faces[k].id;
      live[k].group = faces[k].group;
      live[k].face = faces[k].face;
    }
    g.shuffles++;
    g.status = availablePairs(g).length ? 'playing' : 'stuck';
    return g;
  }

  return {
    GROUPS: GROUPS, LAYOUTS: LAYOUTS, makeRng: makeRng, tileTypes: tileTypes,
    buildPositions: buildPositions, isFree: isFree, freeTiles: freeTiles,
    matches: matches, deal: deal, remaining: remaining,
    availablePairs: availablePairs, removePair: removePair, shuffle: shuffle,
    index: index
  };
});
