/* Wordfeud-hjälp — rack solver.
   Loads the <=9-letter list once (538 KB gzipped) and filters in the browser.
   No API, so no rate limit and no server bill. */

(function () {
  'use strict';

  // Swedish Wordfeud tile values.
  var VALUE = {
    a: 1, b: 4, c: 8, d: 1, e: 1, f: 3, g: 2, h: 2, i: 1, j: 7, k: 3, l: 2,
    m: 3, n: 1, o: 2, p: 4, q: 10, r: 1, s: 1, t: 1, u: 4, v: 3, w: 8, x: 8,
    y: 7, z: 9, 'å': 4, 'ä': 4, 'ö': 4
  };
  var BINGO = 40;          // Wordfeud awards 40 for using all seven tiles

  var input = document.getElementById('rack');
  var form = document.getElementById('solver');
  var out = document.getElementById('results');
  var countEl = document.getElementById('count');
  var containsEl = document.getElementById('contains');
  var maxLenEl = document.getElementById('maxlen');
  var live = document.getElementById('live');

  var words = null, loading = null;

  function load() {
    if (loading) return loading;
    countEl.textContent = 'Laddar ordlistan…';
    loading = fetch('/data/words9.txt')
      .then(function (r) {
        if (!r.ok) throw new Error('words9 ' + r.status);
        return r.text();
      })
      .then(function (body) {
        words = body.split('\n').filter(Boolean);
        return words;
      });
    return loading;
  }

  function score(w, rackCount) {
    // Blanks score zero. Spend them on the priciest letters we can't cover.
    var need = {}, i, c;
    for (i = 0; i < w.length; i++) {
      c = w[i];
      need[c] = (need[c] || 0) + 1;
    }
    var total = 0;
    for (c in need) {
      var have = Math.min(need[c], rackCount[c] || 0);
      total += have * (VALUE[c] || 0);
    }
    return total;
  }

  function counts(str) {
    var m = {}, blanks = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c === '*' || c === '?') { blanks++; continue; }
      m[c] = (m[c] || 0) + 1;
    }
    return { map: m, blanks: blanks };
  }

  function canMake(word, rack) {
    var spare = rack.blanks;
    var need = {};
    for (var i = 0; i < word.length; i++) {
      var c = word[i];
      need[c] = (need[c] || 0) + 1;
      if (need[c] > (rack.map[c] || 0)) {
        if (--spare < 0) return false;
      }
    }
    return true;
  }

  function solve(raw) {
    var letters = raw.toLowerCase().replace(/[^a-zåäö*?]/g, '');
    if (!letters) return null;
    var rack = counts(letters);
    var tiles = letters.length;
    var contains = (containsEl.value || '').toLowerCase().replace(/[^a-zåäö]/g, '');
    var maxLen = parseInt(maxLenEl.value, 10) || 0;

    var hits = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length > tiles) continue;
      if (maxLen && w.length > maxLen) continue;
      if (contains && w.indexOf(contains) < 0) continue;
      if (!canMake(w, rack)) continue;
      var pts = score(w, rack.map);
      if (w.length >= 7) pts += BINGO;
      hits.push({ w: w, p: pts, bingo: w.length >= 7 });
    }
    hits.sort(function (a, b) { return b.p - a.p || b.w.length - a.w.length || a.w.localeCompare(b.w, 'sv'); });
    return hits;
  }

  function render(hits) {
    out.innerHTML = '';
    if (!hits.length) {
      countEl.textContent = '';
      out.innerHTML = '<p><strong>Inga ord matchar dina brickor.</strong> ' +
        'Prova att ta bort ett filter eller lägg till en blank med <code>*</code>.</p>';
      say('Inga ord hittades');
      return;
    }
    countEl.textContent = hits.length + ' ord · sorterat på poäng';
    say(hits.length + ' ord hittades');

    var groups = {};
    hits.forEach(function (h) { (groups[h.w.length] = groups[h.w.length] || []).push(h); });
    var lens = Object.keys(groups).map(Number).sort(function (a, b) { return b - a; });

    lens.forEach(function (n, gi) {
      var g = groups[n].slice(0, 60);
      var h = document.createElement('h2');
      h.className = 'group-head';
      h.textContent = n + ' bokstäver · ' + groups[n].length + ' ord';
      out.appendChild(h);

      var ul = document.createElement('ul');
      ul.className = 'wordlist';
      g.forEach(function (item) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="w">' + item.w + '</span>' +
          (item.bingo ? '<span class="bingo">+' + BINGO + ' bingo</span>' : '') +
          '<span class="p">' + item.p + '</span>';
        ul.appendChild(li);
      });
      out.appendChild(ul);

      if (gi === 0) {
        var ad = document.createElement('div');
        ad.className = 'ad ad-300x250';
        ad.textContent = 'ANNONS 300×250';
        out.appendChild(ad);
      }
    });
  }

  function say(m) { if (live) live.textContent = m; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = input.value;
    if (!raw.trim()) { input.focus(); return; }
    load().then(function () {
      var hits = solve(raw);
      if (hits) render(hits);
    }).catch(function (err) {
      countEl.textContent = 'Kunde inte ladda ordlistan. Ladda om sidan.';
      console.error(err);
    });
  });

  document.getElementById('clear').addEventListener('click', function () {
    input.value = '';
    out.innerHTML = '';
    countEl.textContent = '';
    input.focus();
  });

  // Warm the list as soon as the visitor shows intent — they came here to
  // search, so the fetch should already be running when they hit the button.
  input.addEventListener('focus', load, { once: true });
})();
