/* Spindelharpan (spider solitaire) — deal, move and collect rules. No DOM.

   Two decks, ten columns, and a stock that deals a card to every column at
   once. Unlike kungen-core every card is not face up: the deal hides all but
   the bottom card of each column, and turning those over is the whole game.

   Two rules separate this from the other two patiences in this codebase, and
   both are easy to get wrong:
     - you may PLACE a card on any card one rank higher, whatever the suit,
       but you may only MOVE MORE THAN ONE CARD if they are the same suit.
       Conflating the two makes the game trivially easy.
     - the stock refuses to deal while any column is empty. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpindelharpanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUITS = [
    { s: 'spader', g: '♠', red: false },
    { s: 'hjarter', g: '♥', red: true },
    { s: 'ruter', g: '♦', red: true },
    { s: 'klover', g: '♣', red: false }
  ];
  var LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Kn', 'D', 'K'];
  var COLS = 10, DECK = 104, DEAL_ROWS = 5;

  function makeRng(seed) {
    var s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* 104 cards drawn from `suitCount` suits: one suit means eight copies of
     spades, four means two copies of each. The card count never changes, only
     how many suits it is spread over -- that is the whole difficulty knob. */
  function newDeck(rng, suitCount) {
    var copies = 8 / suitCount, d = [], si, c, r;
    for (si = 0; si < suitCount; si++) {
      for (c = 0; c < copies; c++) {
        for (r = 0; r < 13; r++) {
          d.push({
            suit: SUITS[si].s, glyph: SUITS[si].g, red: SUITS[si].red,
            suitIndex: si, rank: r + 1, label: LABELS[r], up: false,
            id: SUITS[si].s + '-' + (r + 1) + '-' + c
          });
        }
      }
    }
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  function normaliseSuits(n) { return n === 1 || n === 2 || n === 4 ? n : 1; }

  /* Columns 1-4 get six cards, 5-10 get five: 54 dealt, 50 left as five rows
     of stock. Only the bottom card of each column starts face up. */
  function deal(seed, suitCount) {
    var suits = normaliseSuits(suitCount);
    var deck = newDeck(makeRng(seed), suits), cols = [], i, n;
    for (i = 0; i < COLS; i++) cols.push([]);
    for (i = 0; i < 54; i++) cols[i % COLS].push(deck[i]);
    for (i = 0; i < COLS; i++) {
      n = cols[i].length;
      if (n) cols[i][n - 1].up = true;
    }
    return {
      seed: seed, suits: suits, cols: cols,
      stock: deck.slice(54), foundations: [], moves: 0
    };
  }

  function top(pile) { return pile.length ? pile[pile.length - 1] : null; }

  /* Placement: one rank lower, any suit. */
  function stacks(card, onto) {
    return !!card && !!onto && onto.rank === card.rank + 1;
  }

  /* How many face-up cards at the bottom of a column form a same-suit
     descending run. This is the only thing that may move as a group -- a mixed
     descending run is legal to look at and illegal to lift. */
  function runLength(col) {
    var n = 1, i, a, b;
    if (!col.length || !top(col).up) return 0;
    for (i = col.length - 1; i > 0; i--) {
      a = col[i]; b = col[i - 1];
      if (!b.up || b.suitIndex !== a.suitIndex || b.rank !== a.rank + 1) break;
      n++;
    }
    return n;
  }

  function canPlaceOnCol(card, st, colIndex) {
    var col = st.cols[colIndex];
    if (!col.length) return true;          // an empty column takes any card
    var t = top(col);
    return t.up && stacks(card, t);
  }

  function cloneCard(c) {
    return { suit: c.suit, glyph: c.glyph, red: c.red, suitIndex: c.suitIndex,
             rank: c.rank, label: c.label, id: c.id, up: c.up };
  }

  function clone(st) {
    return {
      seed: st.seed, suits: st.suits,
      cols: st.cols.map(function (c) { return c.map(cloneCard); }),
      stock: st.stock.map(cloneCard),
      foundations: st.foundations.map(function (f) { return f.map(cloneCard); }),
      moves: st.moves
    };
  }

  /* Turn over whatever a move exposed. */
  function flip(st) {
    for (var i = 0; i < COLS; i++) {
      var t = top(st.cols[i]);
      if (t && !t.up) t.up = true;
    }
    return st;
  }

  /* A finished king-to-ace run in one suit leaves the board. Returns how many
     went, so the caller can say so out loud. Exposed for its own test. */
  function collect(st) {
    var moved = 0, i;
    for (i = 0; i < COLS; i++) {
      var col = st.cols[i];
      if (runLength(col) === 13 && top(col).rank === 1 &&
          col[col.length - 13].rank === 13) {
        st.foundations.push(col.splice(col.length - 13, 13));
        moved++;
      }
    }
    if (moved) flip(st);
    return moved;
  }

  function settle(st) { flip(st); collect(st); return st; }

  function moveRun(st, fromCol, count, toCol) {
    var col = st.cols[fromCol];
    if (fromCol === toCol || count < 1 || count > col.length) return null;
    if (count > runLength(col)) return null;
    var run = col.slice(col.length - count);
    if (!canPlaceOnCol(run[0], st, toCol)) return null;
    var next = clone(st);
    var lifted = next.cols[fromCol].splice(next.cols[fromCol].length - count, count);
    next.cols[toCol] = next.cols[toCol].concat(lifted);
    next.moves++;
    return settle(next);
  }

  function dealsLeft(st) { return Math.ceil(st.stock.length / COLS); }

  /* The stock will not deal onto an empty column. Returns the reason in
     Swedish so the UI can say it rather than failing silently -- a dead button
     with no explanation is what makes people think a spider clone is broken. */
  function dealBlockedReason(st) {
    if (!st.stock.length) return 'Talongen är slut.';
    for (var i = 0; i < COLS; i++) {
      if (!st.cols[i].length) return 'Fyll den tomma kolumnen först — talongen ger bara när alla tio kolumner har kort.';
    }
    return null;
  }

  function canDeal(st) { return dealBlockedReason(st) === null; }

  function dealRow(st) {
    if (!canDeal(st)) return null;
    var next = clone(st), i;
    for (i = 0; i < COLS; i++) {
      var card = next.stock.shift();
      card.up = true;
      next.cols[i].push(card);
    }
    next.moves++;
    return settle(next);
  }

  function isWon(st) { return st.foundations.length === 8; }

  return {
    COLS: COLS, DECK: DECK, DEAL_ROWS: DEAL_ROWS, SUITS: SUITS,
    deal: deal, top: top, stacks: stacks, runLength: runLength,
    canPlaceOnCol: canPlaceOnCol, moveRun: moveRun,
    collect: collect, dealsLeft: dealsLeft, canDeal: canDeal,
    dealBlockedReason: dealBlockedReason, dealRow: dealRow, isWon: isWon
  };
});
