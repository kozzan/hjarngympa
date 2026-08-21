/* Minnesspel — pairs. Motifs are distinct silhouettes, never colour swatches,
   so the game is playable in greyscale. */
(function () {
  'use strict';

  var MOTIFS = ['★', '●', '▲', '■', '◆', '✚', '♥', '♠', '☾', '☀', '♫', '⚑'];
  var SIZES = { s4: [4, 4], s5: [5, 4], s6: [6, 5] };
  var KEY = 'minnesspel';

  var boardEl = document.getElementById('memboard');
  var metaEl = document.getElementById('mem-meta');
  var live = document.getElementById('live');
  var panel = document.getElementById('result');

  var cards = [], open = [], matched = 0, tries = 0, size = 's4';
  var started = 0, timer = null, locked = false;

  function isDesktop() { return window.matchMedia('(min-width: 1024px)').matches; }

  function newGame(key) {
    size = key || size;
    if (size === 's6' && !isDesktop()) size = 's5';
    var dims = SIZES[size], total = dims[0] * dims[1];
    var need = total / 2;
    var pool = [];
    for (var i = 0; i < need; i++) pool.push(MOTIFS[i % MOTIFS.length] + (i >= MOTIFS.length ? '·' : ''));
    var deck = pool.concat(pool);
    for (var j = deck.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = deck[j]; deck[j] = deck[k]; deck[k] = t;
    }
    cards = deck.map(function (m, idx) {
      return { i: idx, motif: m, up: false, done: false };
    });
    open = []; matched = 0; tries = 0; locked = false; started = 0;
    stopTimer();
    boardEl.style.gridTemplateColumns = 'repeat(' + dims[0] + ', 1fr)';
    render();
    panel.hidden = true;
    say('Nytt spel, ' + dims[0] + ' gånger ' + dims[1]);
  }

  function render() {
    boardEl.innerHTML = '';
    var frag = document.createDocumentFragment();
    cards.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'memcard' + (c.done ? ' matched' : c.up ? ' up' : '');
      if (c.bad) b.classList.add('bad');
      b.dataset.i = c.i;
      b.textContent = (c.up || c.done) ? c.motif.replace('·', '') : '';
      b.setAttribute('aria-label', c.done ? 'Par hittat, ' + c.motif
        : c.up ? c.motif : 'Dolt kort');
      frag.appendChild(b);
    });
    boardEl.appendChild(frag);
    paintMeta();
  }

  function paintMeta() {
    metaEl.textContent = SIZES[size][0] + '×' + SIZES[size][1] +
      ' · ' + matched + ' par · ' + tries + ' försök · ' + fmt(elapsed());
  }
  function elapsed() { return started ? Math.floor((Date.now() - started) / 1000) : 0; }
  function fmt(s) { return (s / 60 | 0) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function stopTimer() { clearInterval(timer); timer = null; }
  function say(m) { if (live) live.textContent = m; }

  boardEl.addEventListener('click', function (e) {
    var el = e.target.closest('.memcard');
    if (!el || locked) return;
    var c = cards[+el.dataset.i];
    if (c.up || c.done) return;
    if (!started) { started = Date.now(); timer = setInterval(paintMeta, 1000); }

    c.up = true;
    open.push(c);
    render();
    say(c.motif);

    if (open.length < 2) return;
    tries++;
    locked = true;
    var a = open[0], b = open[1];
    if (a.motif === b.motif) {
      a.done = b.done = true;
      a.up = b.up = false;
      matched++;
      open = [];
      locked = false;
      render();
      say('Par!');
      if (matched === cards.length / 2) finish();
    } else {
      a.bad = b.bad = true;
      render();
      say('Inte lika');
      setTimeout(function () {
        a.up = b.up = false; a.bad = b.bad = false;
        open = []; locked = false;
        render();
      }, 900);
    }
  });

  document.querySelector('.diffs').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (c) {
      c.setAttribute('aria-pressed', c === b ? 'true' : 'false');
    });
    newGame(b.dataset.size);
  });

  function finish() {
    stopTimer();
    var secs = elapsed(), st = {};
    try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    var bk = 'best_' + size;
    if (!st[bk] || tries < st[bk]) st[bk] = tries;
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}

    panel.className = 'result win';
    panel.querySelector('[data-icon]').textContent = '✓';
    panel.querySelector('[data-h]').textContent = 'Alla par hittade!';
    panel.querySelector('[data-sub]').textContent =
      matched + ' par på ' + tries + ' försök och ' + fmt(secs) + '.';
    var bx = panel.querySelectorAll('[data-stat]');
    bx[0].querySelector('b').textContent = fmt(secs);
    bx[1].querySelector('b').textContent = tries;
    bx[2].querySelector('b').textContent = st[bk];
    panel.hidden = false;
    say('Klart!');
  }

  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-again]')) newGame();
  });

  newGame('s4');
})();
