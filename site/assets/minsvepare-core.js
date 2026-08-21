/* Minsvepare — pure rules. No DOM. Shared by the page and the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MinsvepareCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVELS = {
    latt:   { w: 9,  h: 9,  mines: 10 },
    medel:  { w: 12, h: 12, mines: 22 },
    svar:   { w: 12, h: 16, mines: 40 },   // portrait on mobile
    svarLg: { w: 16, h: 16, mines: 40 },   // same density, desktop
    expert: { w: 30, h: 16, mines: 99 }    // desktop only
  };

  function makeRng(seed) {
    var s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function neighbours(i, w, h) {
    var x = i % w, y = (i / w) | 0, out = [];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push(ny * w + nx);
      }
    }
    return out;
  }

  function create(level, w, h, mines) {
    var L = LEVELS[level] || LEVELS.latt;
    return {
      level: level,
      w: w || L.w,
      h: h || L.h,
      mineCount: mines || L.mines,
      mines: null,           // placed lazily on the first dig
      counts: null,
      revealed: {},
      marks: {},             // index -> 'flag' | 'unknown'
      status: 'idle',        // idle | playing | won | lost
      hitMine: -1
    };
  }

  /* Mines are placed AFTER the first dig, avoiding that cell and its
     neighbours, so the opening move can never lose and never yields a bare
     "1". Placing them upfront is the single most common way a minesweeper
     clone becomes infuriating. */
  function placeMines(g, safeIndex, rng) {
    var total = g.w * g.h;
    var safe = {};
    safe[safeIndex] = true;
    var ring = neighbours(safeIndex, g.w, g.h);
    // Only protect the full 3x3 if the board can still hold every mine.
    if (total - (ring.length + 1) >= g.mineCount) {
      for (var k = 0; k < ring.length; k++) safe[ring[k]] = true;
    }

    var pool = [];
    for (var i = 0; i < total; i++) if (!safe[i]) pool.push(i);
    for (var j = pool.length - 1; j > 0; j--) {
      var r = Math.floor(rng() * (j + 1));
      var t = pool[j]; pool[j] = pool[r]; pool[r] = t;
    }

    g.mines = {};
    for (var m = 0; m < g.mineCount; m++) g.mines[pool[m]] = true;

    g.counts = new Array(total);
    for (var c = 0; c < total; c++) {
      if (g.mines[c]) { g.counts[c] = -1; continue; }
      var n = 0, nb = neighbours(c, g.w, g.h);
      for (var q = 0; q < nb.length; q++) if (g.mines[nb[q]]) n++;
      g.counts[c] = n;
    }
    return g;
  }

  /* Reveal, flood-filling through zeroes. Returns the indices newly opened. */
  function dig(g, i, rng) {
    if (g.status === 'won' || g.status === 'lost') return [];
    if (g.marks[i] === 'flag') return [];          // flags protect from taps
    if (g.status === 'idle') {
      placeMines(g, i, rng || makeRng(1));
      g.status = 'playing';
    }
    if (g.revealed[i]) return [];

    if (g.mines[i]) {
      g.revealed[i] = true;
      g.hitMine = i;
      g.status = 'lost';
      return [i];
    }

    var opened = [], stack = [i];
    while (stack.length) {
      var cur = stack.pop();
      if (g.revealed[cur] || g.marks[cur] === 'flag') continue;
      g.revealed[cur] = true;
      opened.push(cur);
      if (g.counts[cur] === 0) {
        var nb = neighbours(cur, g.w, g.h);
        for (var k = 0; k < nb.length; k++) {
          if (!g.revealed[nb[k]]) stack.push(nb[k]);
        }
      }
    }
    checkWin(g);
    return opened;
  }

  /* Tapping a satisfied digit opens its unflagged neighbours. Works the same
     on touch as on mouse -- it is how experienced players actually play. */
  function chord(g, i, rng) {
    if (g.status !== 'playing' || !g.revealed[i]) return [];
    var n = g.counts[i];
    if (n <= 0) return [];
    var nb = neighbours(i, g.w, g.h), flags = 0;
    for (var k = 0; k < nb.length; k++) if (g.marks[nb[k]] === 'flag') flags++;
    if (flags !== n) return [];
    var opened = [];
    for (var j = 0; j < nb.length; j++) {
      if (!g.revealed[nb[j]] && g.marks[nb[j]] !== 'flag') {
        opened = opened.concat(dig(g, nb[j], rng));
        if (g.status === 'lost') break;
      }
    }
    return opened;
  }

  /* flag -> uncertain -> clear */
  function cycleMark(g, i) {
    if (g.revealed[i] || g.status === 'won' || g.status === 'lost') return null;
    var cur = g.marks[i];
    if (!cur) g.marks[i] = 'flag';
    else if (cur === 'flag') g.marks[i] = 'unknown';
    else delete g.marks[i];
    return g.marks[i] || null;
  }

  function flagCount(g) {
    var n = 0;
    for (var k in g.marks) if (g.marks[k] === 'flag') n++;
    return n;
  }

  /* Won when every non-mine cell is open. Flags are irrelevant -- requiring
     them would let a player "lose" a solved board. */
  function checkWin(g) {
    var total = g.w * g.h, open = 0;
    for (var k in g.revealed) if (g.revealed[k]) open++;
    if (open === total - g.mineCount) g.status = 'won';
    return g.status === 'won';
  }

  return {
    LEVELS: LEVELS, makeRng: makeRng, neighbours: neighbours,
    create: create, placeMines: placeMines, dig: dig, chord: chord,
    cycleMark: cycleMark, flagCount: flagCount, checkWin: checkWin
  };
});
