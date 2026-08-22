/* Mahjong solitaire — board rendering, selection, hints, shuffle. */
(function () {
  'use strict';

  var Core = window.MahjongCore;
  var KEY = 'mahjong';
  var MAX_SHUFFLES = 2;

  var boardEl = document.getElementById('mjboard');
  var frame = document.getElementById('frame');
  var metaEl = document.getElementById('mj-meta');
  var live = document.getElementById('live');
  var panel = document.getElementById('result');
  var layoutWrap = document.getElementById('layoutsel');

  var g = null, selected = null, started = 0, timer = null;
  var TW = 46, TH = 60, LIFT = 6;      // tile size and per-layer offset

  function isDesktop() { return window.matchMedia('(min-width: 1024px)').matches; }

  function sizeTiles() {
    var cols = Math.max.apply(null, g.tiles.map(function (t) { return t.x; })) + 1;
    var avail = (frame.clientWidth || 360) - 16;
    // Never shrink below a real tap target; the frame scrolls instead.
    TW = Math.max(38, Math.min(isDesktop() ? 48 : 44, Math.floor(avail / cols) - 2));
    TH = Math.round(TW * 1.29);
  }

  function newGame(layout) {
    g = Core.deal(layout || (g && g.layout) || (isDesktop() ? 'klassisk' : 'kompakt'),
                  (Date.now() & 0x7fff) + 1);
    selected = null;
    started = 0;
    stopTimer();
    sizeTiles();
    render();
    panel.hidden = true;
    say('Nytt spel, ' + Core.LAYOUTS[g.layout].name + ', ' + g.tiles.length + ' brickor');
  }

  // ---- rendering ---------------------------------------------------------

  function faceHtml(t) {
    return '<span class="pip">' + window.MahjongFaces.render(t.group, t.face) + '</span>';
  }

  function render() {
    var map = Core.index(g.tiles);
    var cols = Math.max.apply(null, g.tiles.map(function (t) { return t.x; })) + 1;
    var rows = Math.max.apply(null, g.tiles.map(function (t) { return t.y; })) + 1;
    var layers = Math.max.apply(null, g.tiles.map(function (t) { return t.z; })) + 1;

    boardEl.style.width = (cols * TW + layers * LIFT + 8) + 'px';
    boardEl.style.height = (rows * TH + layers * LIFT + 8) + 'px';
    boardEl.innerHTML = '';

    // Paint bottom-up so upper layers overlap lower ones.
    var sorted = g.tiles.slice().sort(function (a, b) {
      return a.z - b.z || a.y - b.y || a.x - b.x;
    });
    var frag = document.createDocumentFragment();
    for (var i = 0; i < sorted.length; i++) {
      var t = sorted[i];
      if (t.removed) continue;
      frag.appendChild(tileEl(t, map));
    }
    boardEl.appendChild(frag);
    paintMeta();
  }

  function tileEl(t, map) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mjtile';
    b.dataset.i = t.i;
    b.style.width = TW + 'px';
    b.style.height = TH + 'px';
    b.style.left = (t.x * TW + t.z * LIFT) + 'px';
    b.style.top = (t.y * TH - t.z * LIFT) + 'px';
    b.style.zIndex = (t.z * 100 + t.y);
    b.style.fontSize = Math.round(TW * 0.5) + 'px';
    b.innerHTML = faceHtml(t);

    var free = Core.isFree(t, map);
    if (!free) {
      b.classList.add('blocked');
      b.setAttribute('aria-disabled', 'true');
    }
    if (selected && selected.i === t.i) b.classList.add('sel');
    b.setAttribute('aria-label',
      t.face + (free ? ', ledig' : ', blockerad'));
    return b;
  }

  function paintMeta() {
    if (!g) return;
    metaEl.textContent = Core.LAYOUTS[g.layout].name +
      ' · ' + Core.remaining(g) + ' kvar' +
      ' · ' + g.removedPairs + ' par' +
      ' · ' + fmt(elapsed()) +
      ' · ' + (MAX_SHUFFLES - g.shuffles) + ' omblandningar';
  }

  function elapsed() { return started ? Math.floor((Date.now() - started) / 1000) : 0; }
  function fmt(s) { return (s / 60 | 0) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function startTimer() {
    if (timer) return;
    started = Date.now();
    timer = setInterval(paintMeta, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function say(m) { if (live) live.textContent = m; }

  // ---- interaction -------------------------------------------------------

  boardEl.addEventListener('click', function (e) {
    var el = e.target.closest('.mjtile');
    if (!el || !g) return;
    var t = g.tiles.filter(function (x) { return x.i === +el.dataset.i; })[0];
    if (!t || t.removed) return;

    var map = Core.index(g.tiles);
    if (!Core.isFree(t, map)) {
      say('Brickan är blockerad');
      el.classList.remove('shakeit'); void el.offsetWidth; el.classList.add('shakeit');
      return;
    }
    if (!started) startTimer();

    if (selected && selected.i === t.i) { selected = null; render(); say('Avmarkerad'); return; }
    if (!selected) { selected = t; render(); say(t.face + ' valt'); return; }

    if (Core.removePair(g, selected, t)) {
      say('Par borttaget, ' + Core.remaining(g) + ' kvar');
      selected = null;
      render();
      if (g.status !== 'playing') finish();
    } else {
      say('Brickorna matchar inte');
      selected = t;
      render();
    }
  });

  document.getElementById('btn-hint').addEventListener('click', function () {
    if (!g) return;
    var pairs = Core.availablePairs(g);
    if (!pairs.length) { say('Inga drag kvar — blanda om'); return; }
    // Hints only highlight; they never move a tile for the player.
    var p = pairs[0];
    render();
    [p[0], p[1]].forEach(function (t) {
      var el = boardEl.querySelector('.mjtile[data-i="' + t.i + '"]');
      if (el) el.classList.add('hint');
    });
    say('Tips: ' + p[0].face);
  });

  document.getElementById('btn-shuffle').addEventListener('click', function () {
    if (!g) return;
    if (g.shuffles >= MAX_SHUFFLES) { say('Inga omblandningar kvar'); return; }
    Core.shuffle(g);
    selected = null;
    render();
    say('Omblandat, ' + (MAX_SHUFFLES - g.shuffles) + ' kvar');
    if (g.status === 'stuck') finish();
  });

  document.getElementById('btn-new').addEventListener('click', function () { newGame(); });

  layoutWrap.addEventListener('click', function (e) {
    var b = e.target.closest('[data-layout]');
    if (!b) return;
    Array.prototype.forEach.call(layoutWrap.querySelectorAll('[data-layout]'), function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    newGame(b.dataset.layout);
  });

  // ---- result ------------------------------------------------------------

  function finish() {
    stopTimer();
    var won = g.status === 'won';
    var secs = elapsed();
    var st = {};
    try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    if (won && (!st.best || secs < st.best)) st.best = secs;
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}

    panel.className = won ? 'result win' : 'result loss';
    panel.querySelector('[data-icon]').textContent = won ? '✓' : '△';
    panel.querySelector('[data-h]').textContent = won ? 'Brädet är rent!' : 'Inga drag kvar.';
    panel.querySelector('[data-sub]').textContent = won
      ? 'Alla ' + g.removedPairs + ' par borta på ' + fmt(secs) + '.'
      : 'Det finns inga matchande brickor kvar att ta.';
    var boxes = panel.querySelectorAll('[data-stat]');
    boxes[0].querySelector('b').textContent = fmt(secs);
    boxes[1].querySelector('b').textContent = g.removedPairs;
    boxes[2].querySelector('b').textContent = g.shuffles;
    panel.hidden = false;
    say(won ? 'Du klarade det!' : 'Slut på drag.');
  }

  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-again]')) newGame(g.layout);
  });

  window.addEventListener('resize', function () {
    if (!g) return;
    var before = TW;
    sizeTiles();
    if (Math.abs(before - TW) > 2) render();
  });

  // Phones get the compact board by default; it needs no zoom at all.
  var start = isDesktop() ? 'klassisk' : 'kompakt';
  Array.prototype.forEach.call(layoutWrap.querySelectorAll('[data-layout]'), function (x) {
    x.setAttribute('aria-pressed', x.dataset.layout === start ? 'true' : 'false');
  });
  newGame(start);
})();
