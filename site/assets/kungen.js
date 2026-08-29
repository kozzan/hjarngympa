/* Kungen — rendering, input, the movable-cards meter. Rules live in
   kungen-core.js; nothing here decides what is legal. */

(function () {
  'use strict';

  var K = window.KungenCore;
  var boardEl = document.getElementById('kboard');
  var cellsEl = document.getElementById('kcells');
  var foundEl = document.getElementById('kfound');
  var meterEl = document.getElementById('kmeter');
  var statusEl = document.getElementById('kstatus');
  var metaEl = document.getElementById('kmeta');
  var live = document.getElementById('live');
  var result = document.getElementById('result');
  if (!K || !boardEl) return;

  var FAN = 34, FAN_TOP = 48, FAN_TIGHT = 26;

  var st, history, sel, started, timer;

  function newGame(seed) {
    st = K.deal(seed == null ? (Date.now() % 9000 + 1000) : seed);
    history = [];
    sel = null;
    started = null;
    if (result) result.hidden = true;
    render();
    say('Given är utlagd. Tryck på ett kort för att välja det.');
  }

  function push() { history.push(JSON.parse(JSON.stringify(st))); if (history.length > 200) history.shift(); }

  function undo() {
    if (!history.length) { say('Inget drag att ångra.'); return; }
    st = history.pop();
    sel = null;
    if (result) result.hidden = true;
    render();
    say('Drag ångrat.');
  }

  function say(msg) {
    statusEl.textContent = msg;
    if (live) live.textContent = msg;
  }

  function cardEl(card, cls) {
    var d = document.createElement('div');
    d.className = 'pcard' + (card && card.red ? ' red' : '') + (cls ? ' ' + cls : '');
    if (card) {
      d.innerHTML = '<span class="rank">' + card.label + '</span>' +
                    '<span class="suit">' + card.glyph + '</span>';
      d.setAttribute('aria-label', card.label + ' ' + card.suit);
    }
    return d;
  }

  function emptyEl(ghost, cls) {
    var d = document.createElement('div');
    d.className = 'pcard empty' + (cls ? ' ' + cls : '');
    d.innerHTML = '<span class="ghost">' + ghost + '</span>';
    return d;
  }

  /* ---- the meter --------------------------------------------------------
     Spelled out, always. The formula is the whole game and a player who
     cannot see it reads every refusal as arbitrary. */
  function renderMeter() {
    var n = K.maxMove(st), free = K.freeCells(st), empty = K.emptyCols(st);
    var cols = empty === 0 ? 'INGEN TOM KOLUMN'
             : empty === 1 ? '1 TOM KOLUMN' : empty + ' TOMMA KOLUMNER';
    meterEl.innerHTML = '';
    var b = document.createElement('b');
    b.textContent = 'Du kan flytta ' + n + (n === 1 ? ' kort' : ' kort');
    var s = document.createElement('span');
    s.textContent = '(' + free + ' FRIA ' + (free === 1 ? 'CELL' : 'CELLER') +
                    ' + 1) × ' + cols;
    meterEl.appendChild(b);
    meterEl.appendChild(s);
  }

  function render() {
    // Top row: free cells then foundations.
    cellsEl.innerHTML = '';
    for (var i = 0; i < K.CELLS; i++) {
      var c = st.cells[i];
      var el = c ? cardEl(c) : emptyEl('○', 'kcell');
      el.dataset.cell = i;
      if (sel && sel.kind === 'col' && !c) {
        el.classList.add('target');
      }
      cellsEl.appendChild(el);
    }
    var full = K.freeCells(st) === 0;
    cellsEl.className = 'kcells' + (full ? ' full' : '');
    document.getElementById('kcelllabel').textContent =
      'FRIA CELLER ' + (K.CELLS - K.freeCells(st)) + '/' + K.CELLS + (full ? ' ▲' : '');

    foundEl.innerHTML = '';
    for (i = 0; i < 4; i++) {
      var pile = st.foundations[i], t = K.top(pile);
      var fe = t ? cardEl(t) : emptyEl(K.SUITS[i].g);
      fe.dataset.found = i;
      // A multi-card run can never go to a foundation; never mark it a target.
      if (sel && sel.count === 1) {
        var card = selectedCard();
        if (card && K.canPlaceOnFoundation(card, st) && card.suitIndex === i) {
          fe.classList.add('target');
        }
      }
      foundEl.appendChild(fe);
    }

    renderMeter();

    // Board: two banks of four, joined into one row of eight by CSS ≥1024px.
    boardEl.innerHTML = '';
    var banks = [['A–D', 0, 4], ['E–H', 4, 8]];
    banks.forEach(function (bank) {
      var label = document.createElement('p');
      label.className = 'kbanklabel mono';
      label.textContent = 'KOLUMN ' + bank[0];
      boardEl.appendChild(label);
      var wrap = document.createElement('div');
      wrap.className = 'kbank';
      for (var ci = bank[1]; ci < bank[2]; ci++) wrap.appendChild(colEl(ci));
      boardEl.appendChild(wrap);
    });

    if (started) {
      var secs = Math.floor((Date.now() - started) / 1000);
      metaEl.textContent = '⏱ ' + Math.floor(secs / 60) + ':' +
        String(secs % 60).padStart(2, '0') + ' · DRAG ' + st.moves +
        ' · GIV #' + st.seed;
    } else {
      metaEl.textContent = 'GIV #' + st.seed;
    }

    checkEnd();
  }

  function colEl(ci) {
    var col = st.cols[ci];
    var wrap = document.createElement('div');
    wrap.className = 'pcol';
    wrap.dataset.col = ci;

    if (!col.length) {
      var e = emptyEl('');
      // An empty column takes ANY card — always a target when something is held.
      if (sel) e.classList.add('target');
      e.dataset.col = ci;
      wrap.appendChild(e);
      wrap.style.minHeight = '92px';
      return wrap;
    }

    var run = K.runLength(col);
    var limit = K.maxMove(st, ci);
    var step = col.length > 7 ? FAN_TIGHT : FAN;
    var y = 0;
    for (var i = 0; i < col.length; i++) {
      var isSel = sel && sel.kind === 'col' && sel.col === ci &&
                  i >= col.length - sel.count;
      var el = cardEl(col[i], isSel ? 'sel' : '');
      // While a run is held elsewhere, mark this column's top as a target.
      if (sel && i === col.length - 1 && !(sel.kind === 'col' && sel.col === ci)) {
        if (K.canPlaceOnCol(selectedCard(), st, ci) && sel.count <= limit) {
          el.classList.add('target');
        }
      }
      // Cards in this column that sit beyond the movable limit, so the
      // boundary is visible on the board and not only as a number.
      if (!sel && i >= col.length - run && (col.length - i) > K.maxMove(st)) {
        el.classList.add('beyond');
      }
      el.style.top = y + 'px';
      el.dataset.col = ci;
      el.dataset.idx = i;
      wrap.appendChild(el);
      // The card directly above a lifted selection gains room so the 6 px lift
      // does not clip its suit glyph.
      var nextSel = sel && sel.kind === 'col' && sel.col === ci &&
                    (i + 1) >= col.length - sel.count;
      y += (i === col.length - 1 ? FAN_TOP : step) + (nextSel ? 6 : 0);
    }
    wrap.style.minHeight = (y + 40) + 'px';
    return wrap;
  }

  function selectedCard() {
    if (!sel) return null;
    if (sel.kind === 'cell') return st.cells[sel.cell];
    var col = st.cols[sel.col];
    return col[col.length - sel.count];
  }

  /* ---- refusal ----------------------------------------------------------
     Always names the attempted count, the possible count, and the fix.
     Silent rejection is the defining bug of a FreeCell clone. */
  function refuse(count, toCol, el) {
    var limit = K.maxMove(st, toCol);
    var why = K.freeCells(st) === 0
      ? 'Alla fyra celler är upptagna.'
      : 'Du har ' + K.freeCells(st) + ' fria celler och ' + K.emptyCols(st) + ' tomma kolumner.';
    say(count + ' kort är för många just nu — du kan flytta ' + limit + '. ' + why +
        ' Lägg ett kort på en ess-hög eller i en kolumn först.');
    if (el) {
      el.classList.add('bad');
      setTimeout(function () { el.classList.remove('bad'); }, 200);
    }
  }

  function tryTo(toKind, index) {
    var card = selectedCard();
    if (!card) return;
    var next = null;

    if (toKind === 'found') {
      if (sel.count > 1) { say('Bara ett kort i taget till ess-högarna.'); return; }
      next = K.toFoundation(st, sel.kind === 'cell' ? 'cell' : 'col',
                            sel.kind === 'cell' ? sel.cell : sel.col);
    } else if (toKind === 'cell') {
      if (sel.kind !== 'col' || sel.count > 1) { say('Bara ett kort får plats i en cell.'); return; }
      next = K.toCell(st, sel.col, index);
    } else {
      if (sel.kind === 'cell') next = K.fromCell(st, sel.cell, index);
      else {
        if (sel.count > K.maxMove(st, index)) {
          refuse(sel.count, index, boardEl.querySelector('.pcard.sel'));
          return;
        }
        next = K.moveRun(st, sel.col, sel.count, index);
      }
    }

    if (!next) { say('Det draget går inte. Bygg nedåt i växlande färg.'); return; }
    push();
    st = next;
    sel = null;
    if (!started) started = Date.now();
    render();
  }

  function onTap(e) {
    var el = e.target.closest('.pcard');
    if (!el) return;
    var d = el.dataset;

    if (d.cell !== undefined && !st.cells[d.cell] && sel) { tryTo('cell', +d.cell); return; }
    if (d.cell !== undefined && st.cells[d.cell]) {
      sel = (sel && sel.kind === 'cell' && sel.cell === +d.cell) ? null
          : { kind: 'cell', cell: +d.cell, count: 1 };
      render();
      if (sel) say(st.cells[+d.cell].label + ' valt. Tryck på ett markerat mål.');
      return;
    }
    if (d.found !== undefined) { if (sel) tryTo('found', +d.found); return; }

    if (d.col !== undefined) {
      var ci = +d.col, col = st.cols[ci];
      if (sel && (sel.kind === 'cell' || sel.col !== ci)) { tryTo('col', ci); return; }
      if (!col.length) return;
      var idx = d.idx === undefined ? col.length - 1 : +d.idx;
      var count = col.length - idx;
      if (count > K.runLength(col)) {
        say('Den följden är inte i ordning — bygg nedåt i växlande färg.');
        return;
      }
      if (sel && sel.col === ci && sel.count === count) { sel = null; render(); return; }
      sel = { kind: 'col', col: ci, count: count };
      render();
      say(col[idx].label + (count > 1 ? ' och ' + (count - 1) + ' till valt.' : ' valt.') +
          ' Tryck på ett markerat mål.');
    }
  }

  function checkEnd() {
    if (!result) return;
    if (K.isWon(st)) { showResult(true); return; }
    if (!K.hasMove(st)) showResult(false);
  }

  function showResult(won) {
    var icon = result.querySelector('[data-icon]');
    var h = result.querySelector('[data-h]');
    var sub = result.querySelector('[data-sub]');
    var stats = result.querySelectorAll('[data-stat] b');
    var again = result.querySelector('[data-again]');
    result.classList.toggle('ok', won);
    result.classList.toggle('near', !won);
    if (icon) icon.textContent = won ? '✓' : '▲';
    if (h) h.textContent = won ? 'Löst!' : 'Inga drag kvar';
    if (sub) {
      sub.textContent = won
        ? 'Giv #' + st.seed + ' · alla 52 kort hemma.'
        : 'Given är inte förlorad — backa några drag och pröva en annan ordning.';
    }
    var secs = started ? Math.floor((Date.now() - started) / 1000) : 0;
    if (stats[0]) stats[0].textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    if (stats[1]) stats[1].textContent = st.moves;
    if (stats[2]) stats[2].textContent = st.foundations.reduce(function (n, f) { return n + f.length; }, 0);
    // Nearly every deal is solvable, so a locked board offers undo first
    // rather than inviting the player to throw the game away.
    if (again) {
      again.textContent = won ? 'Ny giv' : '↺ Ångra sista draget';
      again.onclick = won ? function () { newGame(); } : function () { undo(); };
    }
    result.hidden = false;
    if (window.mountAd) {
      Array.prototype.forEach.call(result.querySelectorAll('ins.adsbygoogle'), window.mountAd);
    }
  }

  boardEl.addEventListener('click', onTap);
  cellsEl.addEventListener('click', onTap);
  foundEl.addEventListener('click', onTap);

  var btnUndo = document.getElementById('btn-undo');
  var btnNew = document.getElementById('btn-new');
  var btnSame = document.getElementById('btn-same');
  if (btnUndo) btnUndo.addEventListener('click', undo);
  if (btnNew) btnNew.addEventListener('click', function () { newGame(); });
  if (btnSame) btnSame.addEventListener('click', function () { newGame(st.seed); });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
    if (e.key >= '1' && e.key <= '4') {
      var i = +e.key - 1;
      if (sel) tryTo('cell', i);
      else if (st.cells[i]) { sel = { kind: 'cell', cell: i, count: 1 }; render(); }
    }
  });

  setInterval(function () { if (started && result && result.hidden) render(); }, 1000);
  newGame();
}());
