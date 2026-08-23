/* 2048 — the value on the tile is always the signal; colour is only a ramp. */
(function () {
  'use strict';

  var KEY = '2048', N = 4;
  var boardEl = document.getElementById('g2048');
  var metaEl = document.getElementById('g-meta');
  var live = document.getElementById('live');
  var panel = document.getElementById('result');

  var grid = [], score = 0, best = 0, over = false, won = false;

  function load() {
    try { best = (JSON.parse(localStorage.getItem(KEY)) || {}).best || 0; } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ best: best })); } catch (e) {}
  }

  function newGame() {
    grid = new Array(N * N).fill(0);
    score = 0; over = false; won = false;
    addTile(); addTile();
    render();
    panel.hidden = true;
    say('Nytt spel');
  }

  function addTile() {
    var free = [];
    for (var i = 0; i < grid.length; i++) if (!grid[i]) free.push(i);
    if (!free.length) return false;
    grid[free[Math.floor(Math.random() * free.length)]] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  function render() {
    boardEl.innerHTML = '';
    for (var i = 0; i < grid.length; i++) {
      var d = document.createElement('div');
      var v = grid[i];
      d.className = 'tile2048' + (v ? ' v' + Math.min(v, 2048) : ' empty');
      d.textContent = v || '';
      if (v >= 1024) d.classList.add('milestone');   // shape signal, not just colour
      if (v >= 1000) d.classList.add('four');
      else if (v >= 100) d.classList.add('three');
      boardEl.appendChild(d);
    }
    if (score > best) { best = score; save(); }
    metaEl.textContent = 'Poäng ' + score + ' · Bästa ' + best + ' · Högsta ' + Math.max.apply(null, grid);
  }

  function say(m) { if (live) live.textContent = m; }

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

  function move(dir) {
    if (over) return false;
    var moved = false, gained = 0;
    for (var r = 0; r < N; r++) {
      var idx = [];
      for (var c = 0; c < N; c++) {
        idx.push(dir === 'left' || dir === 'right' ? r * N + c : c * N + r);
      }
      if (dir === 'right' || dir === 'down') idx.reverse();
      var line = idx.map(function (i) { return grid[i]; });
      var res = collapse(line);
      gained += res.gained;
      for (var k = 0; k < N; k++) {
        if (grid[idx[k]] !== res.line[k]) moved = true;
        grid[idx[k]] = res.line[k];
      }
    }
    if (!moved) return false;
    score += gained;
    addTile();
    if (!won && grid.indexOf(2048) >= 0) { won = true; finish(true); }
    render();
    if (!canMove()) { over = true; finish(false); }
    return true;
  }

  function canMove() {
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

  document.addEventListener('keydown', function (e) {
    var d = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
    if (d) { move(d); e.preventDefault(); }
  });

  /* A 24px threshold so an ordinary page scroll is never read as a move. */
  var sx = 0, sy = 0;
  boardEl.addEventListener('touchstart', function (e) {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  boardEl.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  document.getElementById('btn-new').addEventListener('click', newGame);

  function finish(didWin) {
    panel.className = didWin ? 'result win' : 'result loss';
    panel.querySelector('[data-icon]').textContent = didWin ? '✓' : '△';
    panel.querySelector('[data-h]').textContent = didWin ? '2048!' : 'Inga drag kvar.';
    panel.querySelector('[data-sub]').textContent = didWin
      ? 'Du nådde 2048 på ' + score + ' poäng. Fortsätt gärna.'
      : 'Brädet är fullt och inget går att slå ihop.';
    var b = panel.querySelectorAll('[data-stat]');
    b[0].querySelector('b').textContent = score;
    b[1].querySelector('b').textContent = best;
    b[2].querySelector('b').textContent = Math.max.apply(null, grid);
    if (window.markPlayed) window.markPlayed(panel);
    panel.hidden = false;
    say(didWin ? 'Du nådde 2048!' : 'Spelet är slut.');
  }

  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-again]')) newGame();
  });

  load();
  newGame();
})();
