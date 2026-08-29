/* Korsordshjälp — pattern matching against a word list of a known length.
   Pure: no DOM, no fetch. The whole search is one filter over one shard, which
   measures ~4 ms on the biggest shard (101 019 eleven-letter words), so there
   is no index and no worker here on purpose. Fetching and rendering live in
   korsord.js. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KorsordCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Shards exist for these lengths only — see build_length_shards in build.py. */
  var MIN_LEN = 2, MAX_LEN = 15;

  /* What people actually type for an unknown letter. '.' is in here *and* is a
     regex metachar, which is why blanks are resolved before escaping below —
     escape first and '.' becomes a literal dot that matches nothing. */
  var BLANK = '_?.* ';
  var META = /[.*+?^${}()|[\]\\]/g;

  /* å can arrive as U+00E5 or as 'a' + U+030A depending on keyboard and OS.
     Without this, a correct query returns nothing for some users and the bug
     is invisible on the machine it was written on. */
  function normalise(s) {
    return String(s == null ? '' : s).normalize('NFC').toLowerCase().trim();
  }

  function toRegex(pattern) {
    var body = normalise(pattern).split('').map(function (c) {
      return BLANK.indexOf(c) !== -1 ? '.' : c.replace(META, '\\$&');
    }).join('');
    return new RegExp('^' + body + '$');
  }

  /* Length drives which shard to load. It is the one thing a crossword solver
     always knows — the first letter is frequently one of the blanks. */
  function lengthOf(pattern) {
    return normalise(pattern).length;
  }

  function isSearchable(pattern) {
    var n = lengthOf(pattern);
    return n >= MIN_LEN && n <= MAX_LEN;
  }

  /* A one-letter constraint on an 11-slot returns 4 711 hits. Matching that is
     fast; building 4 711 DOM nodes is not, so the cap is the caller's guard. */
  function search(words, pattern, limit) {
    if (!isSearchable(pattern)) return { total: 0, shown: [], searchable: false };
    var re = toRegex(pattern), hits = [];
    for (var i = 0; i < words.length; i++) {
      if (re.test(words[i])) hits.push(words[i]);
    }
    var cap = limit == null ? 200 : limit;
    return { total: hits.length, shown: hits.slice(0, cap), searchable: true };
  }

  return {
    MIN_LEN: MIN_LEN,
    MAX_LEN: MAX_LEN,
    normalise: normalise,
    toRegex: toRegex,
    lengthOf: lengthOf,
    isSearchable: isSearchable,
    search: search
  };
}));
