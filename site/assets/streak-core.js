/* "Dagar i rad" — the only leaderboard this site will ever have, and it is
   against yesterday's you. Pure date arithmetic so node:test can check the
   rollovers; storage and rendering live in app.js. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StreakCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Local calendar day, not UTC: playing 23:50 and again 00:10 is two days
     in a row for the player, whatever the timezone says. */
  function dayNumber(d) {
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  /* Second game of the same day changes nothing; yesterday extends; a gap
     starts over at 1. Any finished game counts, win or loss -- a streak that
     punishes losing is a streak people drop. */
  function bump(st, now) {
    var today = dayNumber(now), last = st && st.day;
    var n = last === today ? (st.n || 1) : (last === today - 1 ? (st.n || 0) + 1 : 1);
    return { day: today, n: n, best: Math.max((st && st.best) || 0, n) };
  }

  return { dayNumber: dayNumber, bump: bump };
}));
