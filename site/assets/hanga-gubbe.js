/* Hänga gubbe — rendering, keyboard, the two progress meters. Rules live in
   hanga-gubbe-core.js; nothing here decides what is legal.

   The meters are the only thing here worth arguing about. Both draw six parts
   and both keep all six visible — the ones not currently drawn stay as dashed
   ghosts — so the figure is countable at a glance whichever you pick. They run
   in opposite directions on purpose: a snowman losing parts reads as melting,
   a gallows gaining them reads as being built, and forcing either metaphor to
   run backwards is what makes a progress meter unreadable. The pip row and the
   sentence under it carry the actual count identically in both, so nothing
   depends on reading the drawing correctly. */

(function () {
  'use strict';

  var H = window.HangaGubbeCore;
  var W = window.HangaGubbeWords;
  var wordEl = document.getElementById('hgword');
  var capEl = document.getElementById('hgcap');
  var meterEl = document.getElementById('hgmeter');
  var pipsEl = document.getElementById('hgpips');
  var leftEl = document.getElementById('hgleft');
  var kbEl = document.getElementById('hgkeyboard');
  var metaEl = document.getElementById('hgmeta');
  var catsEl = document.getElementById('hgcats');
  var live = document.getElementById('live');
  var result = document.getElementById('result');
  if (!H || !W || !wordEl) return;

  var ROWS = ['qwertyuiopå', 'asdfghjklöä', 'zxcvbnm'];
  var METER_KEY = 'hg-meter';

  var st, cat = W.byId('djur'), meter = 'snogubbe', wins = 0, played = 0;

  try {
    var saved = localStorage.getItem(METER_KEY);
    if (saved === 'galge' || saved === 'snogubbe') meter = saved;
  } catch (e) { /* private mode — the default is fine */ }

  function say(msg) { if (live) live.textContent = msg; }

  function newWord() {
    st = H.create(H.pick(cat.words, Date.now() % 100000));
    if (result) result.hidden = true;
    render();
    say('Nytt ord med ' + st.word.length + ' bokstäver.');
  }

  /* ---- the word ---------------------------------------------------------- */

  function renderWord() {
    var m = H.mask(st);
    var done = H.isLost(st);
    wordEl.innerHTML = '';
    for (var i = 0; i < m.length; i++) {
      var s = document.createElement('span');
      s.className = 'hgslot' + (m[i] ? ' filled' : '') + (!m[i] && done ? ' missed' : '');
      // On a loss the word is revealed, and the letters never guessed are
      // marked so the player can see what they missed rather than just losing.
      s.textContent = m[i] ? m[i].toUpperCase() : (done ? st.word[i].toUpperCase() : '');
      wordEl.appendChild(s);
    }
    capEl.textContent = st.word.length + ' BOKSTÄVER · ' + H.found(st) + ' FUNNA';
  }

  /* ---- the meters -------------------------------------------------------- */

  /* Each part is a bare SVG element string. Index 0 is the first to go on a
     snowman and the first to appear on a gallows. */
  var SNOWMAN = [
    '<path d="M36 16h28M42 16v-7h16v7" />',                 // hatt
    '<path d="M31 62L12 50" />',                            // arm vänster
    '<path d="M69 62L88 50" />',                            // arm höger
    '<circle cx="50" cy="30" r="13" />',                    // huvud
    '<circle cx="50" cy="62" r="19" />',                    // mitten
    '<circle cx="50" cy="97" r="24" />'                     // bas
  ];
  var GALLOWS = [
    '<circle cx="66" cy="38" r="11" />',                    // huvud
    '<path d="M66 49v30" />',                               // kropp
    '<path d="M66 57L52 70" />',                            // arm vänster
    '<path d="M66 57L80 70" />',                            // arm höger
    '<path d="M66 79L54 98" />',                            // ben vänster
    '<path d="M66 79L78 98" />'                             // ben höger
  ];
  var FRAME = '<path d="M14 112h40M24 112V14h42v13" />';

  function renderMeter() {
    var wrong = st.wrong.length, left = H.remaining(st);
    var parts = meter === 'galge' ? GALLOWS : SNOWMAN;
    var solid = [], ghost = [], i;
    for (i = 0; i < parts.length; i++) {
      // Gallows builds with each wrong guess; the snowman melts with each one.
      var on = meter === 'galge' ? i < wrong : i >= wrong;
      (on ? solid : ghost).push(parts[i]);
    }
    meterEl.innerHTML =
      '<svg viewBox="0 0 100 124" role="img" aria-label="' + left +
      ' av ' + st.max + ' gissningar kvar">' +
      '<g fill="none" stroke="currentColor" stroke-width="4" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      (meter === 'galge' ? FRAME : '') +
      '<g opacity=".28" stroke-dasharray="5 5">' + ghost.join('') + '</g>' +
      '<g>' + solid.join('') + '</g>' +
      '</g></svg>';

    pipsEl.innerHTML = '';
    for (i = 0; i < st.max; i++) {
      var p = document.createElement('span');
      p.className = 'hgpip' + (i < left ? ' on' : '');
      pipsEl.appendChild(p);
    }
    pipsEl.setAttribute('aria-hidden', 'true');
    leftEl.textContent = left + ' av ' + st.max + ' gissningar kvar';
  }

  /* ---- the keyboard ------------------------------------------------------ */

  function renderKeyboard() {
    kbEl.innerHTML = '';
    var over = H.isWon(st) || H.isLost(st);
    ROWS.forEach(function (row) {
      var r = document.createElement('div');
      r.className = 'krow';
      row.split('').forEach(function (ch) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'key';
        b.textContent = ch;
        b.dataset.key = ch;
        var state = H.keyState(st, ch);
        if (state) {
          b.classList.add(state);
          // The same ✓ / × the tiles and the dagens ord keys carry — the
          // keyboard is the record of what has been tried, so it must not
          // lean on fill tone alone.
          b.dataset.mark = state === 'ok' ? '✓' : '×';
        }
        b.disabled = !!state || over;
        r.appendChild(b);
      });
      kbEl.appendChild(r);
    });
  }

  function render() {
    renderWord();
    renderMeter();
    renderKeyboard();
    metaEl.textContent = 'KATEGORI ' + cat.name.toUpperCase() +
      ' · GISSNINGAR KVAR ' + H.remaining(st) + ' · ' + H.difficulty(st);
    checkEnd();
  }

  /* ---- play -------------------------------------------------------------- */

  function play(letter) {
    var next = H.guess(st, letter);
    if (!next) return;
    var hit = st.word.indexOf(letter.toLowerCase()) !== -1;
    st = next;
    render();
    say(hit ? letter.toUpperCase() + ' finns i ordet.'
            : letter.toUpperCase() + ' finns inte. ' + H.remaining(st) + ' kvar.');
  }

  function hint() {
    if (H.isWon(st) || H.isLost(st)) return;
    var ch = H.hintLetter(st);
    var next = H.useHint(st);
    if (!next) return;
    st = next;
    render();
    say('Tips: ordet innehåller ' + ch.toUpperCase() + '. Det kostade en gissning.');
  }

  function toggleMeter() {
    meter = meter === 'galge' ? 'snogubbe' : 'galge';
    try { localStorage.setItem(METER_KEY, meter); } catch (e) { /* fine */ }
    render();
    say(meter === 'galge' ? 'Visar galge.' : 'Visar snögubbe.');
  }

  function checkEnd() {
    if (!result) return;
    if (H.isWon(st)) showResult(true);
    else if (H.isLost(st)) showResult(false);
  }

  var counted = null;
  function showResult(won) {
    if (counted !== st.word + ':' + won) {
      counted = st.word + ':' + won;
      played++;
      if (won) wins++;
    }
    var icon = result.querySelector('[data-icon]');
    var h = result.querySelector('[data-h]');
    var sub = result.querySelector('[data-sub]');
    var stats = result.querySelectorAll('[data-stat] b');
    var again = result.querySelector('[data-again]');
    // A loss is framed in `near`, never `error`: guessing a word wrong is not
    // a mistake, and scolding copy is the fastest way to end a session.
    result.classList.toggle('win', won);
    result.classList.toggle('near', !won);
    if (icon) icon.textContent = won ? '✓' : '▲';
    if (h) h.textContent = won ? 'Rätt gissat!' : 'Ordet var ' + st.word.toUpperCase();
    if (sub) {
      sub.textContent = won
        ? 'Du hade ' + H.remaining(st) + ' gissningar kvar.'
        : st.word.length + ' bokstäver och ' +
          new Set(st.word.split('')).size + ' olika — det var ett snålt ord på vanliga bokstäver.';
    }
    if (stats[0]) stats[0].textContent = st.word.length;
    if (stats[1]) stats[1].textContent = st.max - H.remaining(st);
    if (stats[2]) stats[2].textContent = wins + '/' + played;
    if (again) again.onclick = newWord;
    result.hidden = false;
    if (window.mountAd) {
      Array.prototype.forEach.call(result.querySelectorAll('ins.adsbygoogle'), window.mountAd);
    }
  }

  kbEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-key]');
    if (b && !b.disabled) play(b.dataset.key);
  });

  if (catsEl) {
    catsEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cat]');
      if (!b) return;
      Array.prototype.forEach.call(catsEl.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      cat = W.byId(b.dataset.cat);
      newWord();
    });
  }

  var btn = function (id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };
  btn('btn-hint', hint);
  btn('btn-new', newWord);
  btn('btn-meter', toggleMeter);

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var ch = e.key.toLowerCase();
    if (H.ALPHABET.indexOf(ch) !== -1) { e.preventDefault(); play(ch); }
  });

  newWord();
}());
