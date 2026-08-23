/* Patiens — tap to select, tap to place. Drag is deliberately not the
   primary interaction: dragging cards on a phone is fiddly and error-prone. */
(function () {
  'use strict';

  var Core = window.PatiensCore;
  var KEY = 'patiens';

  var boardEl = document.getElementById('patboard');
  var foundEl = document.getElementById('foundations');
  var stockEl = document.getElementById('stockpile');
  var wasteEl = document.getElementById('wastepile');
  var statusEl = document.getElementById('patstatus');
  var metaEl = document.getElementById('pat-meta');
  var live = document.getElementById('live');
  var panel = document.getElementById('result');

  var g = null, sel = null, started = 0, timer = null, lastTap = 0, lastId = null;

  function isDesktop() { return window.matchMedia('(min-width: 1024px)').matches; }

  function newGame() {
    g = Core.deal((Date.now() & 0x7fff) + 1);
    sel = null; started = 0;
    stopTimer();
    render();
    panel.hidden = true;
    setStatus('Tryck på ett kort för att välja det.');
    say('Nytt spel');
  }

  // ---- rendering ---------------------------------------------------------

  function cardEl(c, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.className = 'pcard' + (c.up ? '' : ' down') + (c.red ? ' red' : '');
    d.dataset.id = c.id;
    if (c.up) {
      d.innerHTML =
        '<span class="rank">' + c.label + '</span>' +
        '<span class="suit">' + c.glyph + '</span>';
    }
    if (sel && sel.cards.indexOf(c) >= 0) d.classList.add('sel');
    if (opts.target) d.classList.add('target');
    return d;
  }

  function emptyEl(label, cls) {
    var d = document.createElement('div');
    d.className = 'pcard empty ' + (cls || '');
    if (label) d.innerHTML = '<span class="ghost">' + label + '</span>';
    return d;
  }

  /* Overlap: enough of each card must stay visible to read rank and suit.
     Deep piles tighten up so a long column still fits the screen. */
  function fan(depth) {
    var base = isDesktop() ? 30 : 26;
    return depth > 7 ? (isDesktop() ? 24 : 20) : base;
  }

  function render() {
    // foundations
    foundEl.innerHTML = '';
    Core.SUITS.forEach(function (s) {
      var pile = g.foundation[s.s];
      var wrap = document.createElement('div');
      wrap.className = 'pslot';
      wrap.dataset.found = s.s;
      var t = Core.top(pile);
      wrap.appendChild(t ? cardEl(t, { target: isFoundationTarget(s.s) })
                         : emptyEl(s.g, isFoundationTarget(s.s) ? 'target' : ''));
      foundEl.appendChild(wrap);
    });

    // stock + waste
    stockEl.innerHTML = '';
    stockEl.appendChild(g.stock.length ? cardEl({ up: false, id: 'stock' }) : emptyEl('↻'));
    wasteEl.innerHTML = '';
    var w = Core.top(g.waste);
    wasteEl.appendChild(w ? cardEl(w) : emptyEl(''));

    // tableau
    boardEl.innerHTML = '';
    g.tableau.forEach(function (col, ci) {
      var colEl = document.createElement('div');
      colEl.className = 'pcol';
      colEl.dataset.col = ci;
      var step = fan(col.length);
      if (!col.length) {
        var e = emptyEl('', isTableauTarget(ci) ? 'target' : '');
        colEl.appendChild(e);
      } else {
        col.forEach(function (c, i) {
          var el = cardEl(c, { target: i === col.length - 1 && isTableauTarget(ci) });
          el.style.top = (i * step) + 'px';
          el.dataset.col = ci;
          el.dataset.idx = i;
          colEl.appendChild(el);
        });
        colEl.style.height = ((col.length - 1) * step + (isDesktop() ? 124 : 92)) + 'px';
      }
      boardEl.appendChild(colEl);
    });
    paintMeta();
  }

  function isTableauTarget(ci) {
    if (!sel) return false;
    return Core.canStack(sel.cards[0], Core.top(g.tableau[ci])) &&
           !(sel.source.type === 'tableau' && sel.source.col === ci);
  }
  function isFoundationTarget(suit) {
    if (!sel || sel.cards.length !== 1) return false;
    return sel.cards[0].suit === suit && Core.canFound(sel.cards[0], g.foundation[suit]);
  }

  function paintMeta() {
    if (!g) return;
    metaEl.textContent = 'Drag ' + g.moves + ' · Poäng ' + Core.score(g) +
      ' · ' + fmt(elapsed()) + ' · ' + g.stock.length + ' i talongen';
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
  function setStatus(m) { statusEl.textContent = m; say(m); }

  function describe(c) { return c.label + c.glyph; }

  // ---- interaction -------------------------------------------------------

  function select(cards, source) {
    sel = { cards: cards, source: source };
    render();
    setStatus(describe(cards[0]) + ' valt. Tryck på ett markerat mål, eller på kortet igen för att ångra.');
  }
  function clearSel(msg) {
    sel = null;
    render();
    setStatus(msg || 'Tryck på ett kort för att välja det.');
  }

  function tryFoundation(card, source) {
    if (Core.moveToFoundation(g, card, source)) {
      sel = null;
      render();
      setStatus(describe(card) + ' till grundhögen.');
      if (g.status === 'won') finish();
      return true;
    }
    return false;
  }

  boardEl.addEventListener('click', function (e) {
    if (!g) return;
    if (!started) startTimer();
    var colEl = e.target.closest('.pcol');
    if (!colEl) return;
    var ci = +colEl.dataset.col;
    var cardDiv = e.target.closest('.pcard');

    // tapping a highlighted column places the selection
    if (sel && (!cardDiv || cardDiv.classList.contains('target') || !g.tableau[ci].length)) {
      if (isTableauTarget(ci)) {
        if (sel.source.type === 'waste') Core.wasteToTableau(g, ci);
        else Core.moveToTableau(g, sel.source.col, sel.source.idx, ci);
        sel = null; render(); setStatus('Flyttat.');
        return;
      }
    }
    if (!cardDiv || !cardDiv.dataset.idx) { if (sel) clearSel('Avbrutet.'); return; }

    var idx = +cardDiv.dataset.idx;
    var card = g.tableau[ci][idx];
    if (!card.up) { setStatus('Kortet ligger med baksidan upp.'); return; }

    // double tap sends a card straight to the foundation
    var now = Date.now();
    if (lastId === card.id && now - lastTap < 400) {
      lastTap = 0; lastId = null;
      if (tryFoundation(card, { type: 'tableau', col: ci })) return;
    }
    lastTap = now; lastId = card.id;

    if (sel && sel.cards.indexOf(card) >= 0) { clearSel('Avmarkerat.'); return; }

    var run = Core.movableRun(g, ci, idx);
    if (!run) { setStatus('Den följden går inte att flytta som en enhet.'); return; }
    select(run, { type: 'tableau', col: ci, idx: idx });
  });

  foundEl.addEventListener('click', function (e) {
    if (!g || !sel || sel.cards.length !== 1) return;
    var slot = e.target.closest('.pslot');
    if (!slot) return;
    var card = sel.cards[0];
    if (card.suit !== slot.dataset.found) { setStatus('Fel färg för den grundhögen.'); return; }
    if (!tryFoundation(card, sel.source)) setStatus('Kortet passar inte där än.');
  });

  wasteEl.addEventListener('click', function () {
    if (!g) return;
    var c = Core.top(g.waste);
    if (!c) return;
    if (!started) startTimer();
    if (sel && sel.cards[0] === c) { clearSel('Avmarkerat.'); return; }
    var now = Date.now();
    if (lastId === c.id && now - lastTap < 400) {
      lastTap = 0; lastId = null;
      if (tryFoundation(c, { type: 'waste' })) return;
    }
    lastTap = now; lastId = c.id;
    select([c], { type: 'waste' });
  });

  stockEl.addEventListener('click', function () {
    if (!g) return;
    if (!started) startTimer();
    Core.draw(g);
    sel = null;
    render();
    setStatus(g.stock.length ? 'Ett kort draget.' : 'Talongen är tom — tryck igen för att vända.');
  });

  document.getElementById('btn-new').addEventListener('click', newGame);

  document.getElementById('btn-auto').addEventListener('click', function () {
    if (!g) return;
    // Send every card that can legally go up, repeatedly.
    var moved = true, n = 0;
    while (moved && n < 60) {
      moved = false;
      var w = Core.top(g.waste);
      if (w && Core.moveToFoundation(g, w, { type: 'waste' })) { moved = true; n++; continue; }
      for (var ci = 0; ci < 7; ci++) {
        var t = Core.top(g.tableau[ci]);
        if (t && t.up && Core.moveToFoundation(g, t, { type: 'tableau', col: ci })) {
          moved = true; n++; break;
        }
      }
    }
    sel = null; render();
    setStatus(n ? n + ' kort flyttade upp.' : 'Inga kort kunde flyttas upp.');
    if (g.status === 'won') finish();
  });

  // ---- result ------------------------------------------------------------

  function finish() {
    stopTimer();
    var secs = elapsed();
    var st = {};
    try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    if (!st.best || secs < st.best) st.best = secs;
    st.won = (st.won || 0) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}

    panel.className = 'result win';
    panel.querySelector('[data-icon]').textContent = '✓';
    panel.querySelector('[data-h]').textContent = 'Utlagd!';
    panel.querySelector('[data-sub]').textContent =
      'Alla 52 kort uppe på ' + fmt(secs) + ' och ' + g.moves + ' drag.';
    var b = panel.querySelectorAll('[data-stat]');
    b[0].querySelector('b').textContent = fmt(secs);
    b[1].querySelector('b').textContent = g.moves;
    b[2].querySelector('b').textContent = Core.score(g);
    if (window.markPlayed) window.markPlayed(panel);
    panel.hidden = false;
    say('Du klarade patiensen!');
  }

  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-again]')) newGame();
  });

  window.addEventListener('resize', function () { if (g) render(); });

  newGame();
})();
