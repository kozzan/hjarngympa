/* Korsordshjälp — fetch, cache and render. The matching itself is in
   korsord-core.js; nothing here decides what counts as a hit. */

(function () {
  'use strict';

  var K = window.KorsordCore;
  var form = document.getElementById('korsord');
  var input = document.getElementById('pattern');
  var listEl = document.getElementById('kresults');
  var countEl = document.getElementById('kcount');
  var live = document.getElementById('live');
  if (!form || !K) return;

  var PAGE = 200;

  /* One shard per length, kept for the session. A solver works through a grid
     and comes back to the same lengths over and over, so the second query of a
     given length costs nothing. */
  var shards = {}, pending = {};

  function loadShard(n) {
    if (shards[n]) return Promise.resolve(shards[n]);
    if (pending[n]) return pending[n];
    pending[n] = fetch((window.BASE_PATH || '') + '/data/len' + n + '.txt')
      .then(function (r) {
        if (!r.ok) throw new Error('len' + n + ' ' + r.status);
        return r.text();
      })
      .then(function (body) {
        shards[n] = body.split('\n').filter(Boolean);
        return shards[n];
      });
    return pending[n];
  }

  var shown = 0, current = { total: 0, shown: [] };

  function render(more) {
    if (!more) listEl.innerHTML = '';
    var slice = current.shown.slice(shown, shown + PAGE);
    var frag = document.createDocumentFragment();
    slice.forEach(function (w) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.className = 'w';
      span.textContent = w;
      li.appendChild(span);
      frag.appendChild(li);
    });
    listEl.appendChild(frag);
    shown += slice.length;

    if (current.total === 0) {
      countEl.textContent = 'Inga ord matchar det mönstret.';
    } else if (current.total > shown) {
      countEl.textContent = current.total + ' träffar, visar ' + shown + '.';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill pill-outline';
      btn.textContent = 'Visa fler';
      btn.addEventListener('click', function () { btn.remove(); render(true); });
      countEl.appendChild(document.createTextNode(' '));
      countEl.appendChild(btn);
    } else {
      countEl.textContent = current.total === 1
        ? 'Ett ord matchar.' : current.total + ' ord matchar.';
    }
    if (live) live.textContent = countEl.textContent;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pattern = input.value;
    var n = K.lengthOf(pattern);

    if (!K.isSearchable(pattern)) {
      listEl.innerHTML = '';
      countEl.textContent = n < K.MIN_LEN
        ? 'Skriv minst ' + K.MIN_LEN + ' tecken — använd _ för de bokstäver du inte vet.'
        : 'Som mest ' + K.MAX_LEN + ' bokstäver.';
      if (live) live.textContent = countEl.textContent;
      return;
    }

    countEl.textContent = 'Laddar ordlistan…';
    loadShard(n).then(function (words) {
      current = K.search(words, pattern, Infinity);
      shown = 0;
      render(false);
    }).catch(function () {
      countEl.textContent = 'Kunde inte ladda ordlistan. Försök igen.';
    });
  });

  /* Warm the shard while they are still typing, so the button feels instant. */
  input.addEventListener('input', function () {
    var n = K.lengthOf(input.value);
    if (n >= K.MIN_LEN && n <= K.MAX_LEN) loadShard(n).catch(function () {});
  });
}());
