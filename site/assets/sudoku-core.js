/* Pure sudoku generation and solving. Shared by the page and the tests.
   No DOM, no globals beyond the export. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SudokuCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GIVENS = { latt: 40, medel: 33, svar: 28, expert: 24 };

  /* mulberry32 -- a seeded PRNG, so a puzzle number reproduces the same
     puzzle without storing anything server-side. */
  function makeRng(seed) {
    var s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffled(a, rnd) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Can value v go at index i without breaking row, column or block? */
  function ok(g, i, v) {
    var r = (i / 9) | 0, c = i % 9;
    var br = r - r % 3, bc = c - c % 3;
    for (var k = 0; k < 9; k++) {
      if (g[r * 9 + k] === v) return false;
      if (g[k * 9 + c] === v) return false;
      if (g[(br + ((k / 3) | 0)) * 9 + bc + k % 3] === v) return false;
    }
    return true;
  }

  function fill(g, rnd) {
    var i = g.indexOf(0);
    if (i < 0) return true;
    var vals = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd);
    for (var k = 0; k < 9; k++) {
      if (!ok(g, i, vals[k])) continue;
      g[i] = vals[k];
      if (fill(g, rnd)) return true;
      g[i] = 0;
    }
    return false;
  }

  /* Number of solutions, counted up to `cap`. Stopping at 2 is enough to
     prove uniqueness and keeps generation fast. */
  function count(g, cap) {
    var i = g.indexOf(0);
    if (i < 0) return 1;
    var n = 0;
    for (var v = 1; v <= 9; v++) {
      if (!ok(g, i, v)) continue;
      g[i] = v;
      n += count(g, cap - n);
      g[i] = 0;
      if (n >= cap) break;
    }
    return n;
  }

  function solve(puzzle) {
    var g = puzzle.slice();
    return fill(g, makeRng(1)) ? g : null;
  }

  /* Generate a puzzle with exactly one solution. Cells are removed one at a
     time and put back whenever removal would make the puzzle ambiguous. */
  function generate(difficulty, seed) {
    var rnd = makeRng(seed);
    var full = new Array(81).fill(0);
    fill(full, rnd);

    var target = GIVENS[difficulty] || GIVENS.latt;
    var order = shuffled(Array.from({ length: 81 }, function (_, i) { return i; }), rnd);
    var p = full.slice(), givens = 81;
    for (var k = 0; k < order.length && givens > target; k++) {
      var i = order[k], keep = p[i];
      p[i] = 0;
      if (count(p.slice(), 2) !== 1) p[i] = keep;
      else givens--;
    }
    return { puzzle: p, solution: full, givens: givens };
  }

  return {
    GIVENS: GIVENS, makeRng: makeRng, ok: ok, count: count,
    solve: solve, generate: generate
  };
});
