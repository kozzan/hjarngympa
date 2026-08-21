/* Pure scoring logic for Dagens ord. Shared by the page and the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WordGame = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Mark a guess against the answer.
     Two passes: exact matches claim their letter first, so a repeated letter
     is only "near" when the answer has a spare one left. Getting this wrong
     is the classic Wordle-clone bug -- guessing SPARK against KRAKA must not
     light up both Ks. */
  function mark(guess, answer) {
    var n = answer.length, out = new Array(n), left = {}, i, c;
    for (i = 0; i < n; i++) {
      if (guess[i] === answer[i]) {
        out[i] = 'ok';
      } else {
        c = answer[i];
        left[c] = (left[c] || 0) + 1;
      }
    }
    for (i = 0; i < n; i++) {
      if (out[i]) continue;
      c = guess[i];
      if (left[c] > 0) { out[i] = 'near'; left[c]--; }
      else { out[i] = 'absent'; }
    }
    return out;
  }

  /* Whole days since the epoch, in local time. */
  function puzzleIndex(date, epochUTC) {
    var utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((utc - epochUTC) / 86400000);
  }

  return { mark: mark, puzzleIndex: puzzleIndex };
});
