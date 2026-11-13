/* Dagens korsord -- rendering and input. The rules (grid, clues, checking) are in dagens-korsord-core.js and
   tested there; this file only draws and listens. Progress lives in localStorage, one key per day. */

(function () {
  'use strict';

  var Core = window.DagensKorsord;
  var gridEl = document.getElementById('kgrid');
  var input = document.getElementById('kinput');
  var clueBar = document.getElementById('kclue');
  var meta = document.getElementById('kmeta');
  var panel = document.getElementById('result');
  var toast = document.getElementById('toast');
  var LETTER = /^[a-zåäö]$/;

  var date = Core.swedishDate(new Date());
  var KEY = 'hg-korsord-' + date;
  var puzzle, cells = {}, fills = {}, revealed = {}, sel = null;

  function k(r, c) { return r + ',' + c; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)) || {}; fills = s.fills || {}; revealed = s.revealed || {}; } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ fills: fills, revealed: revealed })); } catch (e) {}
  }
  function flash(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { toast.hidden = true; }, 2200);
  }

  function wordAt(r, c, dir) {
    return puzzle.words.filter(function (w) {
      if (w.dir !== dir) return false;
      return dir === 'a' ? w.row === r && c >= w.col && c < w.col + w.word.length
        : w.col === c && r >= w.row && r < w.row + w.word.length;
    })[0];
  }
  function cellsOf(w) {
    var out = [];
    for (var i = 0; i < w.word.length; i++) out.push([w.row + (w.dir === 'd' ? i : 0), w.col + (w.dir === 'a' ? i : 0)]);
    return out;
  }
  function solved(w) { return cellsOf(w).every(function (p) { return fills[k(p[0], p[1])] === puzzle.grid[p[0]][p[1]]; }); }

  function build() {
    gridEl.innerHTML = '';
    var nums = {};
    puzzle.words.forEach(function (w) { nums[k(w.row, w.col)] = w.num; });
    for (var r = 0; r < puzzle.size; r++) for (var c = 0; c < puzzle.size; c++) {
      var el = document.createElement('div');
      if (!puzzle.grid[r][c]) { el.className = 'kblock'; gridEl.appendChild(el); continue; }
      el.className = 'kcell';
      el.setAttribute('role', 'gridcell');
      el.dataset.r = r; el.dataset.c = c;
      if (nums[k(r, c)]) { var n = document.createElement('span'); n.className = 'knum'; n.textContent = nums[k(r, c)]; el.appendChild(n); }
      var ch = document.createElement('span'); ch.className = 'kch'; el.appendChild(ch);
      cells[k(r, c)] = el;
      gridEl.appendChild(el);
    }
    ['a', 'd'].forEach(function (dir) {
      var list = document.getElementById(dir === 'a' ? 'kacross' : 'kdown');
      list.innerHTML = '';
      puzzle.words.filter(function (w) { return w.dir === dir; }).forEach(function (w) {
        var li = document.createElement('li');
        li.textContent = w.num + '. ' + w.clue + ' (' + w.word.length + ')';
        li.dataset.num = w.num; li.dataset.dir = dir;
        li.addEventListener('click', function () { select(w.row, w.col, dir); input.focus(); });
        list.appendChild(li);
        w.li = li;
      });
    });
  }

  function paint() {
    var current = sel && wordAt(sel.r, sel.c, sel.dir);
    var peers = current ? cellsOf(current).map(function (p) { return k(p[0], p[1]); }) : [];
    Object.keys(cells).forEach(function (key) {
      var el = cells[key];
      el.querySelector('.kch').textContent = (fills[key] || '').toUpperCase();
      el.classList.toggle('kpeer', peers.indexOf(key) >= 0);
      el.classList.toggle('ksel', !!sel && key === k(sel.r, sel.c));
      el.classList.toggle('krev', !!revealed[key]);
    });
    puzzle.words.forEach(function (w) {
      w.li.classList.toggle('on', w === current);
      w.li.classList.toggle('done', solved(w));
    });
    clueBar.textContent = current ? current.num + (current.dir === 'a' ? ' vågrätt: ' : ' lodrätt: ') + current.clue + ' (' + current.word.length + ')' : ' ';
  }

  function select(r, c, dir) {
    if (!cells[k(r, c)]) return;
    if (!wordAt(r, c, dir)) dir = dir === 'a' ? 'd' : 'a';
    sel = { r: r, c: c, dir: dir };
    paint();
  }

  function step(back) {
    var w = wordAt(sel.r, sel.c, sel.dir), list = cellsOf(w);
    var i = list.findIndex(function (p) { return p[0] === sel.r && p[1] === sel.c; }) + (back ? -1 : 1);
    if (i >= 0 && i < list.length) select(list[i][0], list[i][1], sel.dir);
  }

  function type(ch) {
    if (!sel) return;
    var key = k(sel.r, sel.c);
    fills[key] = ch;
    delete revealed[key];
    cells[key].classList.remove('kbad');
    save();
    step(false);
    paint();
    finishIfDone();
  }

  function erase() {
    if (!sel) return;
    var key = k(sel.r, sel.c);
    if (!fills[key]) step(true);
    delete fills[sel.r + ',' + sel.c];
    cells[k(sel.r, sel.c)].classList.remove('kbad');
    save();
    paint();
  }

  function move(dr, dc) {
    if (!sel) return;
    var r = sel.r + dr, c = sel.c + dc;
    while (r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size && !cells[k(r, c)]) { r += dr; c += dc; }
    if (cells[k(r, c)]) select(r, c, dr ? 'd' : 'a');
  }

  function reveal(list) {
    list.forEach(function (p) {
      var key = k(p[0], p[1]);
      if (fills[key] !== puzzle.grid[p[0]][p[1]]) { fills[key] = puzzle.grid[p[0]][p[1]]; revealed[key] = true; }
      cells[key].classList.remove('kbad');
    });
    save();
    paint();
    finishIfDone();
  }

  function finishIfDone() {
    if (!puzzle.words.every(solved)) return;
    var helped = Object.keys(revealed).length;
    panel.querySelector('[data-h]').textContent = helped ? 'Klart!' : 'Löst!';
    panel.querySelector('[data-sub]').textContent = helped
      ? 'Du fick hjälp med ' + helped + (helped === 1 ? ' bokstav' : ' bokstäver') + '. Ett nytt korsord kommer i morgon.'
      : 'Snyggt — alla ' + puzzle.words.length + ' ord rätt på egen hand.';
    panel.querySelector('[data-countdown]').textContent = 'Nästa korsord om ' + untilMidnight();
    panel.hidden = false;
    if (window.gtag) window.gtag('event', 'korsord_solved', { revealed: helped });
  }

  /* Time left until midnight in Sweden, as "5 tim 12 min". */
  function untilMidnight() {
    var parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date());
    var h = +parts.filter(function (p) { return p.type === 'hour'; })[0].value;
    var m = +parts.filter(function (p) { return p.type === 'minute'; })[0].value;
    var left = 24 * 60 - (h * 60 + m);
    return Math.floor(left / 60) + ' tim ' + (left % 60) + ' min';
  }

  gridEl.addEventListener('click', function (e) {
    var el = e.target.closest('.kcell');
    if (!el) return;
    var r = +el.dataset.r, c = +el.dataset.c;
    var same = sel && sel.r === r && sel.c === c;
    select(r, c, same ? (sel.dir === 'a' ? 'd' : 'a') : (sel ? sel.dir : 'a'));
    input.focus();
  });

  input.addEventListener('input', function () {
    var v = input.value.normalize('NFC').toLowerCase();
    input.value = '';
    for (var i = 0; i < v.length; i++) if (LETTER.test(v[i])) type(v[i]);
  });

  input.addEventListener('keydown', function (e) {
    var keys = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (e.key === 'Backspace') { e.preventDefault(); erase(); }
    else if (keys[e.key]) { e.preventDefault(); move(keys[e.key][0], keys[e.key][1]); }
    else if (e.key === ' ' && sel) { e.preventDefault(); select(sel.r, sel.c, sel.dir === 'a' ? 'd' : 'a'); }
  });

  document.getElementById('kcheck').addEventListener('click', function () {
    var wrong = 0;
    Object.keys(cells).forEach(function (key) {
      var p = key.split(','), bad = !!fills[key] && fills[key] !== puzzle.grid[+p[0]][+p[1]];
      cells[key].classList.toggle('kbad', bad);
      if (bad) wrong++;
    });
    flash(wrong ? wrong + (wrong === 1 ? ' bokstav är fel' : ' bokstäver är fel') : 'Inga fel hittills');
  });
  document.getElementById('kword').addEventListener('click', function () {
    if (!sel) return flash('Klicka först i ett ord');
    reveal(cellsOf(wordAt(sel.r, sel.c, sel.dir)));
  });
  document.getElementById('kreveal').addEventListener('click', function () {
    if (!window.confirm('Visa hela lösningen?')) return;
    reveal(Object.keys(cells).map(function (key) { return key.split(',').map(Number); }));
  });

  fetch((window.BASE_PATH || '') + '/data/korsord-ledtradar.json')
    .then(function (r) { return r.json(); })
    .then(function (bank) {
      puzzle = Core.generate(bank.entries, date);
      meta.textContent = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long', day: 'numeric', month: 'long' })
        .format(new Date()) + ' · ' + puzzle.words.length + ' ord';
      load();
      build();
      var first = puzzle.words[0];
      select(first.row, first.col, first.dir);
      finishIfDone();
    })
    .catch(function () { meta.textContent = 'Korsordet kunde inte laddas. Ladda om sidan.'; });
})();
