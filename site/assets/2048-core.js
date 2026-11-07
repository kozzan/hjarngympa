/* 2048 — pure rules. No DOM. Shared by the page and the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core2048 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var N = 4;

  /* A new tile on a random empty cell: a 2 nine times in ten, else a 4. */
  function addTile(grid, rng) {
    var free = [];
    for (var i = 0; i < grid.length; i++) if (!grid[i]) free.push(i);
    if (!free.length) return false;
    grid[free[Math.floor(rng() * free.length)]] = rng() < 0.9 ? 2 : 4;
    return true;
  }

  function create(rng) {
    var grid = new Array(N * N).fill(0);
    addTile(grid, rng); addTile(grid, rng);
    return grid;
  }

  /* Slide+merge one line; returns the new line and the score gained. */
  function collapse(line) {
    var vals = line.filter(function (v) { return v; });
    var out = [], gained = 0;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) {
        out.push(vals[i] * 2);
        gained += vals[i] * 2;
        i++;                                  // each tile merges at most once
      } else out.push(vals[i]);
    }
    while (out.length < N) out.push(0);
    return { line: out, gained: gained };
  }

  /* Slides the grid in place. Does not add a tile: the caller does that only
     when something moved, so a refused swipe never spawns one. */
  function slide(grid, dir) {
    var moved = false, gained = 0;
    for (var r = 0; r < N; r++) {
      var idx = [];
      for (var c = 0; c < N; c++) {
        idx.push(dir === 'left' || dir === 'right' ? r * N + c : c * N + r);
      }
      if (dir === 'right' || dir === 'down') idx.reverse();
      var res = collapse(idx.map(function (i) { return grid[i]; }));
      gained += res.gained;
      for (var k = 0; k < N; k++) {
        if (grid[idx[k]] !== res.line[k]) moved = true;
        grid[idx[k]] = res.line[k];
      }
    }
    return { moved: moved, gained: gained };
  }

  function canMove(grid) {
    if (grid.indexOf(0) >= 0) return true;
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var v = grid[r * N + c];
        if (c < N - 1 && v === grid[r * N + c + 1]) return true;
        if (r < N - 1 && v === grid[(r + 1) * N + c]) return true;
      }
    }
    return false;
  }

  return { N: N, addTile: addTile, create: create, collapse: collapse, slide: slide, canMove: canMove };
});
