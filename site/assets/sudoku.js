/* Sudoku — generator, solver and board.
   Puzzles are generated client-side from a seed, so the puzzle number is
   shareable and reproducible without a server. */

(function () {
  'use strict';

  var LABEL = { latt: 'Lätt', medel: 'Medel', svar: 'Svår', expert: 'Expert' };

  var gridEl = document.getElementById('sudoku');
  var padEl = document.getElementById('pad');
  var metaEl = document.getElementById('sudoku-meta');
  var live = document.getElementById('live');

  var puzzle = [], board = [], marks = [], solution = [];
  var selected = -1, pencil = false, errors = 0, difficulty = 'latt';
  var seed = 1, puzzleId = 0, started = 0, undoStack = [];

  var Core = window.SudokuCore;
  var GIVENS = Core.GIVENS;

  // ---- board -------------------------------------------------------------

  function newGame(diff) {
    difficulty = diff || difficulty;
    puzzleId = Math.floor(Math.random() * 9000) + 1000;
    seed = puzzleId;
    var made = Core.generate(difficulty, seed);
    puzzle = made.puzzle;
    solution = made.solution;
    board = puzzle.slice();
    marks = Array.from({ length: 81 }, function () { return []; });
    selected = -1; errors = 0; undoStack = [];
    started = Date.now();
    render();
    say('Nytt spel, svårighetsgrad ' + LABEL[difficulty]);
  }

  function conflicts() {
    var bad = new Set();
    for (var i = 0; i < 81; i++) {
      var v = board[i];
      if (!v) continue;
      var r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3;
      for (var k = 0; k < 9; k++) {
        var peers = [r * 9 + k, k * 9 + c, (br + (k / 3 | 0)) * 9 + bc + k % 3];
        for (var q = 0; q < 3; q++) {
          if (peers[q] !== i && board[peers[q]] === v) { bad.add(i); bad.add(peers[q]); }
        }
      }
    }
    return bad;
  }

  function isPeer(a, b) {
    if (a < 0) return false;
    var ra = (a / 9) | 0, ca = a % 9, rb = (b / 9) | 0, cb = b % 9;
    return ra === rb || ca === cb ||
      ((ra - ra % 3) === (rb - rb % 3) && (ca - ca % 3) === (cb - cb % 3));
  }

  function render() {
    var bad = conflicts();
    gridEl.innerHTML = '';
    for (var i = 0; i < 81; i++) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'cell';
      c.dataset.i = i;
      var col = i % 9, row = (i / 9) | 0;
      if (col % 3 === 2 && col !== 8) c.classList.add('b-right');
      if (row % 3 === 2 && row !== 8) c.classList.add('b-bottom');
      if (puzzle[i]) c.classList.add('given');
      if (i === selected) c.classList.add('sel');
      else if (isPeer(selected, i)) c.classList.add('peer');
      if (bad.has(i)) c.classList.add('bad');

      if (board[i]) {
        c.textContent = board[i];
        c.setAttribute('aria-label', 'Rad ' + (row + 1) + ' kolumn ' + (col + 1) + ', ' + board[i]);
      } else if (marks[i].length) {
        var m = document.createElement('span');
        m.className = 'marks';
        for (var n = 1; n <= 9; n++) {
          var s = document.createElement('span');
          s.textContent = marks[i].indexOf(n) >= 0 ? n : '';
          m.appendChild(s);
        }
        c.appendChild(m);
      } else {
        c.setAttribute('aria-label', 'Rad ' + (row + 1) + ' kolumn ' + (col + 1) + ', tom');
      }
      gridEl.appendChild(c);
    }
    var left = board.filter(function (v) { return !v; }).length;
    metaEl.textContent = LABEL[difficulty] + ' · #' + puzzleId +
      ' · Fel ' + errors + ' · ' + left + ' kvar';

    if (left === 0 && bad.size === 0) {
      say('Klart! Sudokut är löst.');
      metaEl.textContent = 'Löst! · ' + LABEL[difficulty] + ' · #' + puzzleId;
    }
  }

  function say(m) { if (live) live.textContent = m; }

  function place(v) {
    if (selected < 0 || puzzle[selected]) return;
    undoStack.push({ i: selected, v: board[selected], m: marks[selected].slice() });
    if (pencil && v) {
      var at = marks[selected].indexOf(v);
      if (at >= 0) marks[selected].splice(at, 1); else marks[selected].push(v);
    } else {
      if (v && solution[selected] && v !== solution[selected]) errors++;
      board[selected] = v;
      marks[selected] = [];
    }
    render();
  }

  gridEl.addEventListener('click', function (e) {
    var c = e.target.closest('.cell');
    if (!c) return;
    selected = +c.dataset.i;
    render();
  });

  padEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) place(+b.dataset.v);
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      var u = undoStack.pop();
      if (u) { board[u.i] = u.v; marks[u.i] = u.m; render(); }
      e.preventDefault(); return;
    }
    if (e.key >= '1' && e.key <= '9') { place(+e.key); e.preventDefault(); return; }
    if (e.key === '0' || e.key === 'Delete' || e.key === 'Backspace') {
      place(0); e.preventDefault(); return;
    }
    if (e.key.toLowerCase() === 'p') { togglePencil(); e.preventDefault(); return; }
    var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
    if (d) {
      selected = Math.max(0, Math.min(80, (selected < 0 ? 0 : selected) + d));
      render(); e.preventDefault();
    }
  });

  function togglePencil() {
    pencil = !pencil;
    var b = document.getElementById('btn-pencil');
    b.classList.toggle('is-on', pencil);
    b.setAttribute('aria-pressed', pencil ? 'true' : 'false');
    say(pencil ? 'Blyertsläge på' : 'Blyertsläge av');
  }

  document.getElementById('btn-pencil').addEventListener('click', togglePencil);
  document.getElementById('btn-erase').addEventListener('click', function () { place(0); });
  document.getElementById('btn-undo').addEventListener('click', function () {
    var u = undoStack.pop();
    if (u) { board[u.i] = u.v; marks[u.i] = u.m; render(); }
  });
  document.querySelector('.diffs').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (c) {
      c.setAttribute('aria-pressed', c === b ? 'true' : 'false');
    });
    newGame(b.dataset.diff);
  });

  for (var n = 1; n <= 9; n++) {
    var b = document.createElement('button');
    b.type = 'button'; b.dataset.v = n; b.textContent = n;
    padEl.appendChild(b);
  }

  newGame('latt');
})();
