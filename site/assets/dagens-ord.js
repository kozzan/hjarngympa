/* Dagens ord — daily Swedish word game.
   Deterministic from the date, so every visitor gets the same puzzle with
   no server involved. State lives in localStorage. */

(function () {
  'use strict';

  var ROWS = 6, COLS = 5;
  var EPOCH = Date.UTC(2026, 0, 1);      // puzzle #1 was 2026-01-01
  var KEY = 'dagens-ord';

  var board = document.getElementById('board');
  var keyboard = document.getElementById('keyboard');
  var meta = document.getElementById('meta');
  var live = document.getElementById('live');
  var panel = document.getElementById('result');
  var toast = document.getElementById('toast');

  var answers = [], valid = null, answer = '';
  var guesses = [], current = '', status = 'playing', puzzleNo = 0;

  // ---- date / puzzle selection ------------------------------------------

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function puzzleIndex() {
    return window.WordGame.puzzleIndex(new Date(), EPOCH);
  }

  // ---- persistence -------------------------------------------------------

  function loadState() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveState(extra) {
    var s = loadState();
    s.date = todayKey();
    s.guesses = guesses;
    s.status = status;
    if (extra) for (var k in extra) s[k] = extra[k];
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function stats() {
    var s = loadState();
    return {
      streak: s.streak || 0,
      played: s.played || 0,
      solved: s.solved || 0,
      best: s.best || 0
    };
  }

  // ---- marking -----------------------------------------------------------

  function mark(guess) { return window.WordGame.mark(guess, answer); }

  // ---- rendering ---------------------------------------------------------

  var MARKS = { ok: '✓', near: '→', absent: '×' };
  var SAYS = { ok: 'rätt plats', near: 'fel plats', absent: 'finns inte' };

  function render() {
    board.innerHTML = '';
    for (var r = 0; r < ROWS; r++) {
      var row = document.createElement('div');
      row.className = 'row';
      var guess = guesses[r];
      var isActive = !guess && r === guesses.length && status === 'playing';
      var marks = guess ? mark(guess) : null;
      for (var c = 0; c < COLS; c++) {
        var t = document.createElement('div');
        t.className = 'tile';
        var ch = guess ? guess[c] : (isActive ? (current[c] || '') : '');
        if (guess) {
          t.classList.add(marks[c]);
          t.dataset.mark = MARKS[marks[c]];
          t.style.transitionDelay = (c * 80) + 'ms';
        } else if (isActive) {
          row.classList.add('active');
          if (c === current.length) t.classList.add('cursor');
        }
        t.textContent = ch ? ch.toUpperCase() : '';
        row.appendChild(t);
      }
      board.appendChild(row);
    }
    meta.textContent = 'Omgång ' + puzzleNo + ' · Försök ' +
      Math.min(guesses.length + (status === 'playing' ? 1 : 0), ROWS) + ' / ' + ROWS +
      ' · 🔥 ' + stats().streak;
    paintKeys();
  }

  var KEYS = ['qwertyuiopå', 'asdfghjklöä', 'zxcvbnm'];

  function buildKeyboard() {
    keyboard.innerHTML = '';
    KEYS.forEach(function (rowStr, idx) {
      var row = document.createElement('div');
      row.className = 'krow';
      if (idx === 2) row.appendChild(keyBtn('gå', 'GÅ', 'wide'));
      rowStr.split('').forEach(function (ch) { row.appendChild(keyBtn(ch, ch.toUpperCase())); });
      if (idx === 2) row.appendChild(keyBtn('back', '⌫', 'wide outline'));
      keyboard.appendChild(row);
    });
  }
  function keyBtn(value, label, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'key ' + (cls || '');
    b.dataset.key = value;
    b.textContent = label;
    return b;
  }

  function paintKeys() {
    var best = {};
    var rank = { absent: 0, near: 1, ok: 2 };
    guesses.forEach(function (g) {
      var m = mark(g);
      for (var i = 0; i < COLS; i++) {
        var c = g[i];
        if (!(c in best) || rank[m[i]] > rank[best[c]]) best[c] = m[i];
      }
    });
    Array.prototype.forEach.call(keyboard.querySelectorAll('.key'), function (k) {
      var v = k.dataset.key;
      k.classList.remove('ok', 'near', 'absent');
      if (best[v]) k.classList.add(best[v]);
    });
  }

  function say(msg) { if (live) live.textContent = msg; }

  function flash(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    var row = board.querySelector('.row.active');
    if (row) {
      row.classList.remove('shake');
      void row.offsetWidth;
      row.classList.add('shake');
    }
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { toast.hidden = true; }, 2200);
    say(msg);
  }

  // ---- input -------------------------------------------------------------

  function type(ch) {
    if (status !== 'playing' || current.length >= COLS) return;
    current += ch;
    render();
  }
  function back() {
    if (status !== 'playing' || !current) return;
    current = current.slice(0, -1);
    render();
  }
  function submit() {
    if (status !== 'playing') return;
    if (current.length < COLS) { flash('Ordet måste ha ' + COLS + ' bokstäver'); return; }
    if (valid && !valid.has(current)) { flash('Ordet finns inte i ordlistan'); return; }

    guesses.push(current);
    var m = mark(current);
    var said = current.toUpperCase().split('').map(function (c, i) {
      return c + ' ' + SAYS[m[i]];
    }).join(', ');
    var won = current === answer;
    current = '';

    if (won) status = 'won';
    else if (guesses.length >= ROWS) status = 'lost';

    if (status === 'playing') { saveState(); render(); say(said); return; }

    // finished — update stats once
    var s = loadState();
    var st = stats();
    var streak = won ? st.streak + 1 : 0;
    saveState({
      played: st.played + 1,
      solved: st.solved + (won ? 1 : 0),
      streak: streak,
      best: Math.max(st.best, streak)
    });
    render();
    say(said + '. ' + (won ? 'Rätt!' : 'Ordet var ' + answer.toUpperCase()));
    showResult(won);
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { submit(); e.preventDefault(); return; }
    if (e.key === 'Backspace') { back(); e.preventDefault(); return; }
    var ch = e.key.toLowerCase();
    if (ch.length === 1 && 'abcdefghijklmnopqrstuvwxyzåäö'.indexOf(ch) >= 0) {
      type(ch); e.preventDefault();
    }
  });

  keyboard.addEventListener('click', function (e) {
    var k = e.target.closest('.key');
    if (!k) return;
    var v = k.dataset.key;
    if (v === 'gå') submit();
    else if (v === 'back') back();
    else type(v);
  });

  // ---- result panel ------------------------------------------------------

  function showResult(won) {
    var st = stats();
    var pct = st.played ? Math.round(st.solved / st.played * 100) : 0;
    panel.querySelector('[data-h]').textContent = won ? 'Snyggt jobbat!' : 'Nästa gång!';
    panel.querySelector('[data-word]').innerHTML = won
      ? 'Ordet var <strong>' + answer.toUpperCase() + '</strong> — löst på ' +
        guesses.length + (guesses.length === 1 ? ' försök' : ' försök')
      : 'Ordet var <strong>' + answer.toUpperCase() + '</strong>';
    panel.querySelector('[data-streak]').textContent = st.streak;
    panel.querySelector('[data-pct]').textContent = pct + '%';
    panel.querySelector('[data-played]').textContent = st.played;
    panel.hidden = false;
    tick();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function shareText() {
    var grid = guesses.map(function (g) {
      return mark(g).map(function (m) {
        return m === 'ok' ? '🟩' : m === 'near' ? '🟨' : '⬜';
      }).join('');
    }).join('\n');
    return 'hjärngympa — Dagens ord ' + puzzleNo + '\n' +
      (status === 'won' ? guesses.length : 'X') + '/' + ROWS + '\n\n' + grid +
      '\n\nhjarngympa.se/dagens-ord/';
  }

  function tick() {
    var el = panel.querySelector('[data-countdown]');
    if (!el) return;
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var s = Math.max(0, Math.floor((next - now) / 1000));
    el.textContent = 'Nästa ord om ' + pad(Math.floor(s / 3600)) + ':' +
      pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
    setTimeout(tick, 1000);
  }

  panel.addEventListener('click', function (e) {
    if (!e.target.closest('[data-share]')) return;
    var text = shareText();
    if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { flash('Resultatet är kopierat'); });
    }
  });

  // ---- boot --------------------------------------------------------------

  function text(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.text();
    });
  }

  buildKeyboard();

  text((window.BASE_PATH || '') + '/data/words5.txt').then(function (body) {
    answers = body.split('\n').filter(Boolean);
    puzzleNo = puzzleIndex();
    answer = answers[((puzzleNo % answers.length) + answers.length) % answers.length];

    var s = loadState();
    if (s.date === todayKey() && Array.isArray(s.guesses)) {
      guesses = s.guesses;
      status = s.status || 'playing';
    }
    render();
    if (status !== 'playing') showResult(status === 'won');

    // Guess validation is a nice-to-have; the game is playable without it.
    return text((window.BASE_PATH || '') + '/data/words5all.txt').then(function (b) {
      valid = new Set(b.split('\n').filter(Boolean));
    });
  }).catch(function (err) {
    board.innerHTML = '<p>Kunde inte ladda ordlistan. Ladda om sidan.</p>';
    console.error(err);
  });
})();
