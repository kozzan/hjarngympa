/* Dagens korsord -- the daily crossword's rules. Pure: no DOM, no fetch. The page (dagens-korsord.js) fetches the
   clue bank and renders; everything that can be wrong lives here and is tested in tools/test.js.

   The grid is built from the bank (site/data/korsord-ledtradar.json) with a PRNG seeded by the Swedish date, so
   everyone in Sverige gets the same puzzle all day and a new one at midnight. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DagensKorsord = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SIZE = 9;
  /* A grid with fewer words than this feels empty; generate() tries more seeds until it has at least this many. */
  var MIN_WORDS = 10;
  /* Stop adding words here: a 9x9 with more becomes a wall of short crossings. */
  var TARGET_WORDS = 14;
  var ATTEMPTS = 8;
  var MAX_ATTEMPTS = 60;

  /* mulberry32, as in sudoku-core.js. */
  function makeRng(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* FNV-1a over the date string: "2026-11-13" -> a 32-bit seed. */
  function hash(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h | 0;
  }

  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* The date in Sweden (YYYY-MM-DD), whatever the visitor's own time zone: the puzzle changes at Swedish
     midnight for everyone. sv-SE formats dates as ISO. */
  function swedishDate(date) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(date);
  }

  function emptyGrid(size) {
    var g = [];
    for (var r = 0; r < size; r++) { g.push([]); for (var c = 0; c < size; c++) g[r].push(null); }
    return g;
  }

  /* One attempt at a grid. Each new word must cross a letter already placed, may not touch any other letter
     side-on, and may not run on into another word, so the only words in the grid are the placed ones. */
  function build(entries, rng, size) {
    var grid = emptyGrid(size);
    var used = { a: emptyGrid(size), d: emptyGrid(size) };
    var words = [];
    var taken = {};
    var at = function (r, c) { return r < 0 || c < 0 || r >= size || c >= size ? null : grid[r][c]; };

    /* The number of existing letters the word would cross, or -1 if it cannot go there. */
    function fit(word, r, c, dir) {
      var dr = dir === 'd' ? 1 : 0, dc = dir === 'a' ? 1 : 0, n = word.length;
      if (r < 0 || c < 0 || r + dr * (n - 1) >= size || c + dc * (n - 1) >= size) return -1;
      if (at(r - dr, c - dc) || at(r + dr * n, c + dc * n)) return -1;
      var crossings = 0;
      for (var i = 0; i < n; i++) {
        var rr = r + dr * i, cc = c + dc * i, cell = grid[rr][cc];
        if (cell) {
          if (cell !== word[i] || used[dir][rr][cc]) return -1;
          crossings++;
        } else if (dir === 'a' ? (at(rr - 1, cc) || at(rr + 1, cc)) : (at(rr, cc - 1) || at(rr, cc + 1))) {
          return -1;
        }
      }
      return crossings === n ? -1 : crossings;
    }

    function place(entry, r, c, dir) {
      var word = entry[0], dr = dir === 'd' ? 1 : 0, dc = dir === 'a' ? 1 : 0;
      for (var i = 0; i < word.length; i++) {
        grid[r + dr * i][c + dc * i] = word[i];
        used[dir][r + dr * i][c + dc * i] = true;
      }
      words.push({ word: word, clue: entry[1], row: r, col: c, dir: dir });
      taken[word] = true;
    }

    var pool = shuffle(entries.filter(function (e) { return e[0].length <= size; }), rng);
    var long = pool.filter(function (e) { return e[0].length >= size - 2; });
    var first = long[0];
    place(first, Math.floor(size / 2), Math.floor(rng() * (size - first[0].length + 1)), 'a');

    /* Words by letter, so a search only looks at words that can cross something. */
    var byLetter = {};
    pool.forEach(function (e) {
      for (var i = 0; i < e[0].length; i++) (byLetter[e[0][i]] = byLetter[e[0][i]] || []).push([e, i]);
    });

    while (words.length < TARGET_WORDS) {
      var best = null;
      var cells = [];
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (grid[r][c]) cells.push([r, c]);
      cells = shuffle(cells, rng);
      var tried = 0;
      for (var k = 0; k < cells.length && tried < 400; k++) {
        var cr = cells[k][0], cc = cells[k][1], dir = used.a[cr][cc] ? 'd' : 'a';
        if (used.a[cr][cc] && used.d[cr][cc]) continue;
        var options = byLetter[grid[cr][cc]] || [];
        var start = Math.floor(rng() * options.length);
        for (var m = 0; m < options.length && tried < 400; m++) {
          var o = options[(start + m) % options.length], e = o[0];
          if (taken[e[0]]) continue;
          var r0 = dir === 'd' ? cr - o[1] : cr, c0 = dir === 'a' ? cc - o[1] : cc;
          var x = fit(e[0], r0, c0, dir);
          if (x < 1) continue;
          tried++;
          /* More crossings make a tighter grid; among equals, a longer word fills more. */
          var score = x * 10 + e[0].length;
          if (!best || score > best.score) best = { e: e, r: r0, c: c0, dir: dir, score: score };
        }
      }
      if (!best) break;
      place(best.e, best.r, best.c, best.dir);
    }
    return { grid: grid, words: words };
  }

  /* Standard numbering: a cell that starts an across or a down word gets the next number, row by row. */
  function number(grid, words) {
    var size = grid.length, n = 0, nums = {};
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
      var starts = words.some(function (w) { return w.row === r && w.col === c; });
      if (starts) nums[r + ',' + c] = ++n;
    }
    words.forEach(function (w) { w.num = nums[w.row + ',' + w.col]; });
    words.sort(function (a, b) { return a.dir === b.dir ? a.num - b.num : a.dir === 'a' ? -1 : 1; });
  }

  /* The daily puzzle for `date` (YYYY-MM-DD) from the bank's entries [word, clue, ...]. Deterministic: the same
     bank and date always give the same puzzle. Tries ATTEMPTS seeds and keeps the fullest; if that is still
     under MIN_WORDS it keeps trying (a phone should not wait for 60 attempts on an ordinary day). */
  function generate(entries, date, opts) {
    var size = (opts && opts.size) || SIZE;
    var best = null;
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var p = build(entries, makeRng(hash(date + ':' + attempt)), size);
      if (!best || p.words.length > best.words.length) best = p;
      if (best.words.length >= TARGET_WORDS) break;
      if (attempt >= ATTEMPTS - 1 && best.words.length >= MIN_WORDS) break;
    }
    number(best.grid, best.words);
    return { date: date, size: size, grid: best.grid, words: best.words };
  }

  /* Everything wrong with a puzzle, in words; [] for a valid one. Every run of two or more letters in the grid
     must be exactly one listed word from the bank, with the bank's clue, and no word may appear twice. */
  function problems(puzzle, bank) {
    var out = [], grid = puzzle.grid, size = puzzle.size, listed = {};
    puzzle.words.forEach(function (w) {
      if (!bank.has(w.word)) out.push(w.word + ' is not in the bank');
      else if (bank.get(w.word) !== w.clue) out.push(w.word + ' has the wrong clue');
      if (listed[w.dir + w.row + ',' + w.col]) out.push('two words start at ' + w.row + ',' + w.col);
      listed[w.dir + w.row + ',' + w.col] = w;
      for (var i = 0; i < w.word.length; i++) {
        var r = w.row + (w.dir === 'd' ? i : 0), c = w.col + (w.dir === 'a' ? i : 0);
        if (!grid[r] || grid[r][c] !== w.word[i]) out.push(w.word + ' does not match the grid at ' + r + ',' + c);
      }
    });
    var words = puzzle.words.map(function (w) { return w.word; });
    if (new Set(words).size !== words.length) out.push('a word appears twice');
    var runs = 0;
    ['a', 'd'].forEach(function (dir) {
      for (var line = 0; line < size; line++) {
        var run = '', start = 0;
        for (var i = 0; i <= size; i++) {
          var r = dir === 'a' ? line : i, c = dir === 'a' ? i : line;
          var ch = i < size ? grid[r][c] : null;
          if (ch) { if (!run) start = i; run += ch; continue; }
          if (run.length >= 2) {
            runs++;
            var sr = dir === 'a' ? line : start, sc = dir === 'a' ? start : line, w = listed[dir + sr + ',' + sc];
            if (!w || w.word !== run) out.push('"' + run + '" at ' + sr + ',' + sc + ' is not a listed word');
          }
          run = '';
        }
      }
    });
    if (runs !== puzzle.words.length) out.push(puzzle.words.length + ' words listed but ' + runs + ' in the grid');
    return out;
  }

  return { SIZE: SIZE, MIN_WORDS: MIN_WORDS, swedishDate: swedishDate, generate: generate, problems: problems };
}));
