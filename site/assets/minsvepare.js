/* Minsvepare — board, modes, zoom frame, result panel. */
(function () {
  'use strict';

  var Core = window.MinsvepareCore;
  var LABEL = { latt: 'Lätt', medel: 'Medel', svar: 'Svår', expert: 'Expert' };
  var KEY = 'minsvepare';

  var frame = document.getElementById('frame');
  var boardEl = document.getElementById('mineboard');
  var metaEl = document.getElementById('mine-meta');
  var live = document.getElementById('live');
  var panel = document.getElementById('result');
  var modeWrap = document.getElementById('mode');
  var zoomWrap = document.getElementById('zoomctl');

  var g = null, mode = 'dig', cell = 44, started = 0, timer = null, cursor = 0;

  function isDesktop() { return window.matchMedia('(min-width: 1024px)').matches; }

  /* "svar" is a different board shape per device -- same mine density, but
     12x16 fits a phone in portrait where 16x16 does not. */
  function levelSpec(level) {
    if (level === 'svar') return Core.LEVELS[isDesktop() ? 'svarLg' : 'svar'];
    return Core.LEVELS[level];
  }

  /* The tap target is measured in rendered pixels, not board coordinates:
     pick the largest cell that fits, but never smaller than 40px -- below
     that the board scrolls instead of shrinking. */
  function fitCell(w) {
    var avail = (frame.clientWidth || 340) - 8;
    return Math.max(40, Math.min(56, Math.floor(avail / w) - 2));
  }

  function newGame(level) {
    var spec = levelSpec(level);
    g = Core.create(level, spec.w, spec.h, spec.mines);
    cell = fitCell(g.w);
    cursor = 0;
    started = 0;
    stopTimer();
    render();
    panel.hidden = true;
    say('Nytt spel, ' + LABEL[level] + ', ' + g.w + ' gånger ' + g.h +
        ' med ' + g.mineCount + ' minor');
  }

  // ---- rendering ---------------------------------------------------------

  var MARK = { flag: '▲', unknown: '?' };

  function render() {
    boardEl.style.gridTemplateColumns = 'repeat(' + g.w + ', ' + cell + 'px)';
    boardEl.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < g.w * g.h; i++) frag.appendChild(cellEl(i));
    boardEl.appendChild(frag);
    paintMeta();
  }

  function cellEl(i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mcell';
    b.dataset.i = i;
    b.style.width = b.style.height = cell + 'px';
    b.style.fontSize = Math.round(cell * 0.46) + 'px';
    var x = (i % g.w) + 1, y = ((i / g.w) | 0) + 1;
    var label = 'Rad ' + y + ' kolumn ' + x;

    if (g.revealed[i]) {
      b.classList.add('open');
      if (g.mines[i]) {
        b.classList.add(i === g.hitMine ? 'boom' : 'mine');
        b.textContent = '✳';
        label += ', mina';
      } else if (g.counts[i] > 0) {
        b.textContent = g.counts[i];
        b.classList.add('n' + g.counts[i]);
        label += ', ' + g.counts[i];
      } else {
        label += ', tom';
      }
    } else if (g.status === 'lost' && g.mines[i] && g.marks[i] !== 'flag') {
      b.classList.add('open', 'mine');
      b.textContent = '✳';
      label += ', mina';
    } else if (g.status === 'lost' && g.marks[i] === 'flag' && !g.mines[i]) {
      b.classList.add('wrongflag');
      b.textContent = '▲';
      label += ', felaktig flagga';
    } else if (g.status === 'won' && g.mines[i]) {
      b.classList.add('goodflag');
      b.textContent = '✓';
      label += ', mina hittad';
    } else if (g.marks[i]) {
      b.classList.add(g.marks[i] === 'flag' ? 'flagged' : 'unknown');
      b.textContent = MARK[g.marks[i]];
      label += g.marks[i] === 'flag' ? ', flaggad' : ', osäker';
    }
    if (i === cursor) b.classList.add('cursor');
    b.setAttribute('aria-label', label);
    return b;
  }

  function paintMeta() {
    if (!g) return 0;
    var left = g.mineCount - Core.flagCount(g);
    metaEl.textContent = LABEL[g.level] + ' · ' + g.w + '×' + g.h +
      ' · ▲ ' + Core.flagCount(g) + ' / ' + g.mineCount +
      ' · ' + fmt(elapsed()) + ' · LÄGE ' + (mode === 'dig' ? '⛏' : '▲');
    return left;
  }

  function elapsed() { return started ? Math.floor((Date.now() - started) / 1000) : 0; }
  function fmt(s) {
    return (s / 60 | 0) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function startTimer() {
    if (timer) return;
    started = Date.now();
    timer = setInterval(function () { if (g.status === 'playing') paintMeta(); }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function say(m) { if (live) live.textContent = m; }

  // ---- interaction -------------------------------------------------------

  function act(i, forceChord) {
    if (!g || g.status === 'won' || g.status === 'lost') return;
    if (g.status === 'idle') startTimer();

    if (forceChord || (g.revealed[i] && g.counts[i] > 0)) {
      Core.chord(g, i, Core.makeRng(Date.now() & 0xffff));
    } else if (mode === 'flag') {
      var m = Core.cycleMark(g, i);
      say(m === 'flag' ? 'Flaggad' : m === 'unknown' ? 'Osäker' : 'Markering borttagen');
    } else {
      Core.dig(g, i, Core.makeRng(Date.now() & 0xffff));
    }
    cursor = i;
    render();
    if (g.status === 'won' || g.status === 'lost') finish();
  }

  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.mcell');
    if (c) act(+c.dataset.i);
  });

  /* Long-press still flags, but it is a shortcut on top of the visible mode
     switch -- never the only way to place a flag. */
  var pressTimer = null, pressed = -1;
  boardEl.addEventListener('pointerdown', function (e) {
    var c = e.target.closest('.mcell');
    if (!c) return;
    pressed = +c.dataset.i;
    pressTimer = setTimeout(function () {
      pressTimer = null;
      if (g.status === 'idle') startTimer();
      Core.cycleMark(g, pressed);
      render();
      say('Flaggad');
    }, 450);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    boardEl.addEventListener(ev, function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });
  });
  boardEl.addEventListener('contextmenu', function (e) {
    var c = e.target.closest('.mcell');
    if (!c) return;
    e.preventDefault();
    Core.cycleMark(g, +c.dataset.i);
    render();
  });

  modeWrap.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]');
    if (!b) return;
    setMode(b.dataset.mode);
  });
  function setMode(m) {
    mode = m;
    Array.prototype.forEach.call(modeWrap.querySelectorAll('[data-mode]'), function (b) {
      b.setAttribute('aria-pressed', b.dataset.mode === m ? 'true' : 'false');
    });
    paintMeta();
    say(m === 'dig' ? 'Läge: gräv' : 'Läge: flagga');
  }

  zoomWrap.addEventListener('click', function (e) {
    var b = e.target.closest('[data-zoom]');
    if (!b) return;
    var z = b.dataset.zoom;
    if (z === 'center') {
      frame.scrollTo({
        left: (boardEl.scrollWidth - frame.clientWidth) / 2,
        top: (boardEl.scrollHeight - frame.clientHeight) / 2,
        behavior: 'smooth'
      });
      return;
    }
    // Never scale below a 40px tap target; that is the whole point of the frame.
    cell = Math.max(40, Math.min(72, cell + (z === 'in' ? 8 : -8)));
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (!g) return;
    var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -g.w, ArrowDown: g.w }[e.key];
    if (d) {
      cursor = Math.max(0, Math.min(g.w * g.h - 1, cursor + d));
      render();
      var c = boardEl.querySelector('.cursor');
      if (c) c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      e.preventDefault();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') { act(cursor); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'f') {
      Core.cycleMark(g, cursor); render(); e.preventDefault(); return;
    }
    if (e.key.toLowerCase() === 'c') { act(cursor, true); e.preventDefault(); }
  });

  document.querySelector('.diffs').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    if (b.dataset.diff === 'expert' && !isDesktop()) {
      say('Expert kräver en större skärm');
      return;
    }
    Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (c) {
      c.setAttribute('aria-pressed', c === b ? 'true' : 'false');
    });
    newGame(b.dataset.diff);
  });

  // ---- result ------------------------------------------------------------

  function stats() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStats(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }

  function finish() {
    stopTimer();
    var won = g.status === 'won';
    var secs = elapsed();
    var st = stats();
    var bestKey = 'best_' + g.level;
    if (won && (!st[bestKey] || secs < st[bestKey])) st[bestKey] = secs;
    st.played = (st.played || 0) + 1;
    if (won) st.won = (st.won || 0) + 1;
    saveStats(st);

    var opened = 0;
    for (var k in g.revealed) if (g.revealed[k]) opened++;
    var safe = g.w * g.h - g.mineCount;

    panel.className = won ? 'result win' : 'result loss';
    panel.querySelector('[data-icon]').textContent = won ? '✓' : '✳';
    panel.querySelector('[data-h]').textContent = won ? 'Rensat!' : 'Bom.';
    panel.querySelector('[data-sub]').textContent = won
      ? 'Du hittade alla ' + g.mineCount + ' minor på ' + fmt(secs) + '.'
      : 'Du gick på en mina efter ' + fmt(secs) + '.';
    var boxes = panel.querySelectorAll('[data-stat]');
    boxes[0].querySelector('b').textContent = fmt(secs);
    boxes[0].querySelector('span').textContent = 'tid';
    boxes[1].querySelector('b').textContent =
      won ? (st[bestKey] ? fmt(st[bestKey]) : '–') : Math.round(opened / safe * 100) + '%';
    boxes[1].querySelector('span').textContent = won ? 'ditt bästa' : 'rensat';
    boxes[2].querySelector('b').textContent =
      won ? g.mineCount : Core.flagCount(g);
    boxes[2].querySelector('span').textContent = won ? 'rensade' : 'flaggor';
    panel.hidden = false;
    say(won ? 'Du vann!' : 'Du träffade en mina.');
  }

  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-again]')) newGame(g.level);
  });

  window.addEventListener('resize', function () {
    if (!g) return;
    var next = fitCell(g.w);
    if (Math.abs(next - cell) > 4) { cell = next; render(); }
  });

  setMode('dig');
  newGame('latt');
})();
