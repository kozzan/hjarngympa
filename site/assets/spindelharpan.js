/* Spindelharpan — rendering, input, the stock. Rules live in
   spindelharpan-core.js; nothing here decides what is legal.

   Ten columns do not fit a phone at a tappable card size, so unlike kungen.js
   the card here has a FIXED width and the board pans inside .frame. Shrinking
   to fit is the one thing this layout must never do -- 44 px is the floor. */

(function () {
  'use strict';

  var S = window.SpindelharpanCore;
  var boardEl = document.getElementById('spboard');
  var frameEl = document.getElementById('spframe');
  var stockEl = document.getElementById('spstock');
  var foundEl = document.getElementById('spfound');
  var statusEl = document.getElementById('spstatus');
  var metaEl = document.getElementById('spmeta');
  var diffsEl = document.getElementById('spdiffs');
  var hintEl = document.getElementById('sphint');
  var live = document.getElementById('live');
  var result = document.getElementById('result');
  if (!S || !boardEl) return;

  var MIN_W = 44, MAX_W = 96, STEP = 8;
  var st, history, sel, started, suits = 2, cardW = 44, userZoomed = false;

  function say(msg) {
    statusEl.textContent = msg;
    if (live) live.textContent = msg;
  }

  function setWidth(w) {
    cardW = Math.max(MIN_W, Math.min(MAX_W, w));
    boardEl.style.setProperty('--spw', cardW + 'px');
  }

  /* The widest card that lets all ten columns fit the frame, capped at MAX_W
     and floored at MIN_W. A phone lands on the floor and pans; a desktop fills
     the room it has instead of leaving a 44 px board in a 1000 px frame.
     Skipped once the player has used the zoom buttons — their choice wins. */
  function fitWidth() {
    if (userZoomed) return;
    var room = (frameEl ? frameEl.clientWidth : 360) - 16;   // padding either side
    setWidth(Math.floor((room - 6 * (S.COLS - 1)) / S.COLS));
  }

  function newGame(seed, s) {
    if (s) suits = s;
    st = S.deal(seed == null ? (Date.now() % 9000 + 1000) : seed, suits);
    history = [];
    sel = null;
    started = null;
    if (result) result.hidden = true;
    fitWidth();
    render();
    say('Given är utlagd. Tryck på ett kort för att välja det.');
  }

  function push() {
    history.push(JSON.parse(JSON.stringify(st)));
    if (history.length > 200) history.shift();
  }

  function undo() {
    if (!history.length) { say('Inget drag att ångra.'); return; }
    st = history.pop();
    sel = null;
    if (result) result.hidden = true;
    render();
    say('Drag ångrat.');
  }

  function cardEl(card, cls) {
    var d = document.createElement('div');
    if (!card.up) {
      d.className = 'pcard down' + (cls ? ' ' + cls : '');
      d.setAttribute('aria-label', 'dolt kort');
      return d;
    }
    d.className = 'pcard' + (card.red ? ' red' : '') + (cls ? ' ' + cls : '');
    d.innerHTML = '<span class="rank">' + card.label + '</span>' +
                  '<span class="suit">' + card.glyph + '</span>';
    d.setAttribute('aria-label', card.label + ' ' + card.suit);
    return d;
  }

  function emptyEl(ghost, cls) {
    var d = document.createElement('div');
    d.className = 'pcard empty' + (cls ? ' ' + cls : '');
    d.innerHTML = '<span class="ghost">' + (ghost || '') + '</span>';
    return d;
  }

  function selectedCard() {
    if (!sel) return null;
    var col = st.cols[sel.col];
    return col[col.length - sel.count];
  }

  function colEl(ci) {
    var col = st.cols[ci];
    var wrap = document.createElement('div');
    wrap.className = 'pcol';
    wrap.dataset.col = ci;

    if (!col.length) {
      var e = emptyEl('');
      if (sel) e.classList.add('target');   // an empty column takes any card
      e.dataset.col = ci;
      wrap.appendChild(e);
      wrap.style.minHeight = Math.round(cardW / 0.72) + 'px';
      return wrap;
    }

    var cardH = cardW / 0.72;
    var upStep = Math.max(16, cardH * 0.34);
    var downStep = Math.max(9, cardH * 0.18);   // hidden cards need less room
    var y = 0;
    for (var i = 0; i < col.length; i++) {
      var isSel = sel && sel.col === ci && i >= col.length - sel.count;
      var el = cardEl(col[i], isSel ? 'sel' : '');
      if (sel && i === col.length - 1 && sel.col !== ci &&
          S.canPlaceOnCol(selectedCard(), st, ci)) {
        el.classList.add('target');
      }
      el.style.top = Math.round(y) + 'px';
      el.dataset.col = ci;
      el.dataset.idx = i;
      wrap.appendChild(el);
      var nextSel = sel && sel.col === ci && (i + 1) >= col.length - sel.count;
      y += (col[i].up ? upStep : downStep) + (nextSel ? 6 : 0);
    }
    wrap.style.minHeight =
      Math.round(y - (col[col.length - 1].up ? upStep : downStep) + cardH) + 'px';
    return wrap;
  }

  function render() {
    boardEl.innerHTML = '';
    for (var i = 0; i < S.COLS; i++) boardEl.appendChild(colEl(i));

    // Stock: a stacked edge showing deals left. Disabled states say why.
    stockEl.innerHTML = '';
    var left = S.dealsLeft(st);
    var blocked = S.dealBlockedReason(st);
    var se = left ? cardEl({ up: false }, 'stockpile') : emptyEl('—', 'stockpile');
    se.dataset.stock = '1';
    if (blocked) se.classList.add('is-off');
    stockEl.appendChild(se);
    var lbl = document.createElement('p');
    lbl.className = 'mono';
    lbl.textContent = 'GIVAR KVAR ' + left;
    stockEl.appendChild(lbl);

    foundEl.innerHTML = '';
    for (i = 0; i < 8; i++) {
      var run = st.foundations[i];
      var fe = run ? cardEl(run[0], 'donepile') : emptyEl('', 'donepile');
      foundEl.appendChild(fe);
    }
    document.getElementById('spfoundlabel').textContent =
      'KLARA SVITER ' + st.foundations.length + '/8';

    var names = { 1: '1 FÄRG', 2: '2 FÄRGER', 4: '4 FÄRGER' };
    if (started) {
      var secs = Math.floor((Date.now() - started) / 1000);
      metaEl.textContent = '⏱ ' + Math.floor(secs / 60) + ':' +
        String(secs % 60).padStart(2, '0') + ' · DRAG ' + st.moves +
        ' · ' + names[st.suits] + ' · GIV #' + st.seed;
    } else {
      metaEl.textContent = names[st.suits] + ' · GIV #' + st.seed;
    }

    // The pan hint describes a gesture that only exists when the board is
    // wider than its frame. On a desktop it fits, and telling someone to drag
    // a board that cannot move reads as a broken control.
    if (hintEl && frameEl) hintEl.hidden = boardEl.scrollWidth <= frameEl.clientWidth;

    checkEnd();
  }

  function apply(next, msg) {
    if (!next) return false;
    push();
    var before = st.foundations.length;
    st = next;
    sel = null;
    if (!started) started = Date.now();
    render();
    var got = st.foundations.length - before;
    say(got ? (got === 1 ? 'En hel svit är klar!' : got + ' sviter klara!') : msg);
    return true;
  }

  function tryTo(ci) {
    if (sel.col === ci) { sel = null; render(); return; }
    var card = selectedCard();
    var next = S.moveRun(st, sel.col, sel.count, ci);
    if (!next) {
      say('Det draget går inte. Lägg ' + card.label + ' på ett kort som är ett steg högre, eller i en tom kolumn.');
      return;
    }
    apply(next, 'Flyttade ' + sel.count + (sel.count === 1 ? ' kort.' : ' kort.'));
  }

  function dealRow() {
    var why = S.dealBlockedReason(st);
    if (why) { say(why); return; }
    apply(S.dealRow(st), 'Ett kort till varje kolumn.');
  }

  function onTap(e) {
    var el = e.target.closest('.pcard');
    if (!el) return;
    if (el.dataset.stock) { dealRow(); return; }
    if (el.dataset.col === undefined) return;

    var ci = +el.dataset.col, col = st.cols[ci];
    if (sel && sel.col !== ci) { tryTo(ci); return; }
    if (!col.length) return;

    var idx = el.dataset.idx === undefined ? col.length - 1 : +el.dataset.idx;
    if (!col[idx].up) { say('Det kortet ligger dolt. Flytta det som ligger ovanpå först.'); return; }
    var count = col.length - idx;
    if (count > S.runLength(col)) {
      say('Bara kort i samma färg och i ordning kan flyttas tillsammans.');
      return;
    }
    if (sel && sel.col === ci && sel.count === count) { sel = null; render(); return; }
    sel = { col: ci, count: count };
    render();
    say(col[idx].label + ' ' + col[idx].suit +
        (count > 1 ? ' och ' + (count - 1) + ' till valt.' : ' valt.') +
        ' Tryck på ett markerat mål.');
  }

  /* A hint names a real move in words rather than moving anything. */
  function hint() {
    for (var i = 0; i < S.COLS; i++) {
      var run = S.runLength(st.cols[i]);
      for (var n = run; n >= 1; n--) {
        var card = st.cols[i][st.cols[i].length - n];
        for (var j = 0; j < S.COLS; j++) {
          if (i === j || !st.cols[j].length) continue;
          if (S.canPlaceOnCol(card, st, j)) {
            say('Prova ' + card.label + ' ' + card.suit + ' på ' +
                S.top(st.cols[j]).label + ' ' + S.top(st.cols[j]).suit + '.');
            return;
          }
        }
      }
    }
    say(S.canDeal(st) ? 'Inget drag på bordet — ta en giv från talongen.'
                      : 'Inget drag syns. Ångra några drag och pröva en annan ordning.');
  }

  function checkEnd() {
    if (result && S.isWon(st)) showResult();
  }

  function showResult() {
    var icon = result.querySelector('[data-icon]');
    var h = result.querySelector('[data-h]');
    var sub = result.querySelector('[data-sub]');
    var stats = result.querySelectorAll('[data-stat] b');
    var again = result.querySelector('[data-again]');
    result.classList.add('win');
    if (icon) icon.textContent = '✓';
    if (h) h.textContent = 'Alla åtta sviter hemma';
    if (sub) sub.textContent = 'Giv #' + st.seed + ' · ' +
      ({ 1: 'en färg', 2: 'två färger', 4: 'fyra färger' })[st.suits] + '.';
    var secs = started ? Math.floor((Date.now() - started) / 1000) : 0;
    if (stats[0]) stats[0].textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    if (stats[1]) stats[1].textContent = st.moves;
    if (stats[2]) stats[2].textContent = st.foundations.length;
    if (again) again.onclick = function () { newGame(); };
    result.hidden = false;
    if (window.mountAd) {
      Array.prototype.forEach.call(result.querySelectorAll('ins.adsbygoogle'), window.mountAd);
    }
  }

  boardEl.addEventListener('click', onTap);
  stockEl.addEventListener('click', onTap);

  if (diffsEl) {
    diffsEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-suits]');
      if (!b) return;
      Array.prototype.forEach.call(diffsEl.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      newGame(null, +b.dataset.suits);
    });
  }

  var btn = function (id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };
  btn('btn-undo', undo);
  btn('btn-hint', hint);
  btn('btn-new', function () { newGame(); });
  btn('btn-deal', dealRow);
  btn('zoom-in', function () { userZoomed = true; setWidth(cardW + STEP); render(); });
  btn('zoom-out', function () { userZoomed = true; setWidth(cardW - STEP); render(); });
  btn('zoom-center', function () {
    if (frameEl) frameEl.scrollLeft = (frameEl.scrollWidth - frameEl.clientWidth) / 2;
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
    if (e.key === 'd' || e.key === 'D') dealRow();
    if (e.key === 'h' || e.key === 'H') hint();
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(function () { fitWidth(); render(); }, 150);
  });

  setInterval(function () { if (started && result && result.hidden) render(); }, 1000);
  newGame();
}());
