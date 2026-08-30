/* Hänga gubbe — guessing rules and word state. No DOM.

   Swedish, so å ä ö are their own letters and never satisfy a guess of a or o.
   Getting that wrong is the bug that makes the game feel rigged to a Swede:
   guessing A would light up ÅRSTA and the player would never trust it again. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HangaGubbeCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALPHABET = 'abcdefghijklmnopqrstuvwxyzåäö'.split('');
  var MAX_WRONG = 6;

  function normalise(w) { return String(w || '').toLowerCase().trim(); }

  function create(word) {
    return { word: normalise(word), tried: [], wrong: [], hints: 0, max: MAX_WRONG };
  }

  function isLetter(ch) { return ALPHABET.indexOf(ch) !== -1; }

  function has(st, letter) { return st.tried.indexOf(letter) !== -1; }

  /* Returns a new state, or null when the guess costs nothing — an unknown
     character or a letter already tried. A repeat must never burn a guess. */
  function guess(st, letter) {
    var ch = normalise(letter);
    if (ch.length !== 1 || !isLetter(ch) || has(st, ch)) return null;
    if (isWon(st) || isLost(st)) return null;
    var next = {
      word: st.word, tried: st.tried.concat(ch),
      wrong: st.wrong.slice(), hints: st.hints, max: st.max
    };
    if (st.word.indexOf(ch) === -1) next.wrong.push(ch);
    return next;
  }

  /* One slot per character: the letter once guessed, otherwise null. */
  function mask(st) {
    return st.word.split('').map(function (ch) {
      return has(st, ch) ? ch : null;
    });
  }

  function found(st) {
    return mask(st).filter(function (c) { return c !== null; }).length;
  }

  /* Hints are counted apart from wrong guesses even though both cost one.
     Pushing a fake letter into `wrong` to charge for a hint would break the
     rule that the keyboard's × keys and the pip count are two views of the
     same number. */
  function remaining(st) { return st.max - st.wrong.length - st.hints; }

  function isWon(st) {
    for (var i = 0; i < st.word.length; i++) {
      if (!has(st, st.word[i])) return false;
    }
    return st.word.length > 0;
  }

  function isLost(st) { return remaining(st) <= 0; }

  /* How a key should be drawn: 'ok' when the letter is in the word, 'absent'
     when it is not, undefined when untried. There is no 'near' in this game. */
  function keyState(st, letter) {
    if (!has(st, letter)) return null;
    return st.word.indexOf(letter) === -1 ? 'absent' : 'ok';
  }

  /* Length is the only difficulty signal a curated word list gives for free. */
  function difficulty(st) {
    var n = st.word.length;
    return n <= 5 ? 'LÄTT' : n <= 8 ? 'MEDEL' : 'SVÅR';
  }

  /* A letter still unguessed that is in the word — a hint costs one guess, so
     it must never point at something already revealed. */
  function hintLetter(st) {
    for (var i = 0; i < st.word.length; i++) {
      if (!has(st, st.word[i])) return st.word[i];
    }
    return null;
  }

  /* Reveal a letter and charge one guess for it. A free hint makes the
     meter meaningless, and it can lose you the word — which is the point. */
  function useHint(st) {
    var ch = hintLetter(st);
    if (!ch || isWon(st) || isLost(st)) return null;
    var next = guess(st, ch);
    if (!next) return null;
    next.hints = st.hints + 1;
    return next;
  }

  function pick(words, seed) {
    if (!words || !words.length) return '';
    return words[Math.abs(seed | 0) % words.length];
  }

  return {
    ALPHABET: ALPHABET, MAX_WRONG: MAX_WRONG,
    create: create, guess: guess, mask: mask, found: found,
    remaining: remaining, isWon: isWon, isLost: isLost,
    keyState: keyState, difficulty: difficulty, hintLetter: hintLetter,
    useHint: useHint,
    pick: pick
  };
});
