/* Kungen (FreeCell) — deal and move rules. No DOM.

   Not the Klondike in patiens-core: every card is face up from the deal, there
   is no stock, and an empty column takes any card rather than only a king.
   Same card shape as patiens-core so the two games render through the same
   pieces. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KungenCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUITS = [
    { s: 'spader', g: '♠', red: false },
    { s: 'hjarter', g: '♥', red: true },
    { s: 'ruter', g: '♦', red: true },
    { s: 'klover', g: '♣', red: false }
  ];
  var LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Kn', 'D', 'K'];
  var COLS = 8, CELLS = 4;

  function makeRng(seed) {
    var s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function newDeck(rng) {
    var d = [], si, r;
    for (si = 0; si < SUITS.length; si++) {
      for (r = 0; r < 13; r++) {
        d.push({
          suit: SUITS[si].s, glyph: SUITS[si].g, red: SUITS[si].red,
          suitIndex: si, rank: r + 1, label: LABELS[r],
          id: SUITS[si].s + '-' + (r + 1)
        });
      }
    }
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  /* Columns 1-4 get seven cards, 5-8 get six. Nothing is hidden. */
  function deal(seed) {
    var deck = newDeck(makeRng(seed)), cols = [], i;
    for (i = 0; i < COLS; i++) cols.push([]);
    for (i = 0; i < deck.length; i++) cols[i % COLS].push(deck[i]);
    return {
      seed: seed,
      cells: [null, null, null, null],
      foundations: [[], [], [], []],
      cols: cols,
      moves: 0
    };
  }

  function top(pile) { return pile.length ? pile[pile.length - 1] : null; }

  /* Tableau: down in alternating colour. */
  function stacks(card, onto) {
    return !!card && !!onto && onto.rank === card.rank + 1 && onto.red !== card.red;
  }

  /* How many cards at the bottom of a column already form a movable sequence. */
  function runLength(col) {
    var n = 1, i;
    if (!col.length) return 0;
    for (i = col.length - 1; i > 0; i--) {
      if (!stacks(col[i], col[i - 1])) break;
      n++;
    }
    return n;
  }

  function freeCells(st) {
    var n = 0;
    for (var i = 0; i < CELLS; i++) if (!st.cells[i]) n++;
    return n;
  }

  function emptyCols(st) {
    var n = 0;
    for (var i = 0; i < COLS; i++) if (!st.cols[i].length) n++;
    return n;
  }

  /* (free cells + 1) x 2^(empty columns).

     Moving *into* an empty column cannot use that column as a staging area, so
     it does not count towards the doubling. Getting this wrong lets the player
     attempt a run one card too long every time a column is empty, and the
     refusal then looks arbitrary -- which is the bug that makes people think a
     FreeCell clone is broken. */
  function maxMove(st, toColIndex) {
    var empty = emptyCols(st);
    if (typeof toColIndex === 'number' && !st.cols[toColIndex].length) empty--;
    if (empty < 0) empty = 0;
    return (freeCells(st) + 1) * Math.pow(2, empty);
  }

  function canPlaceOnFoundation(card, st) {
    if (!card) return false;
    var pile = st.foundations[card.suitIndex];
    return card.rank === pile.length + 1;
  }

  /* An empty column takes ANY card. Klondike's kings-only rule does not apply
     here, and assuming it does is the most common way this game gets built
     wrong by someone who has just written a Klondike. */
  function canPlaceOnCol(card, st, colIndex) {
    var col = st.cols[colIndex];
    if (!col.length) return true;
    return stacks(card, top(col));
  }

  function clone(st) {
    return {
      seed: st.seed,
      cells: st.cells.slice(),
      foundations: st.foundations.map(function (f) { return f.slice(); }),
      cols: st.cols.map(function (c) { return c.slice(); }),
      moves: st.moves
    };
  }

  /* Move `count` cards from the bottom of a column onto another column.
     Returns a new state, or null with the reason on `lastError`. */
  function moveRun(st, fromCol, count, toCol) {
    var col = st.cols[fromCol];
    if (fromCol === toCol || count < 1 || count > col.length) return null;
    if (count > runLength(col)) return null;
    if (count > maxMove(st, toCol)) return null;
    var run = col.slice(col.length - count);
    if (!canPlaceOnCol(run[0], st, toCol)) return null;
    var next = clone(st);
    next.cols[fromCol] = next.cols[fromCol].slice(0, col.length - count);
    next.cols[toCol] = next.cols[toCol].concat(run);
    next.moves++;
    return next;
  }

  function toCell(st, fromCol, cellIndex) {
    var col = st.cols[fromCol];
    if (!col.length || st.cells[cellIndex]) return null;
    var next = clone(st);
    next.cells[cellIndex] = next.cols[fromCol].pop();
    next.moves++;
    return next;
  }

  function fromCell(st, cellIndex, toCol) {
    var card = st.cells[cellIndex];
    if (!card || !canPlaceOnCol(card, st, toCol)) return null;
    var next = clone(st);
    next.cells[cellIndex] = null;
    next.cols[toCol].push(card);
    next.moves++;
    return next;
  }

  function toFoundation(st, source, index) {
    var card = source === 'cell' ? st.cells[index] : top(st.cols[index]);
    if (!canPlaceOnFoundation(card, st)) return null;
    var next = clone(st);
    if (source === 'cell') next.cells[index] = null; else next.cols[index].pop();
    next.foundations[card.suitIndex].push(card);
    next.moves++;
    return next;
  }

  function isWon(st) {
    for (var i = 0; i < 4; i++) if (st.foundations[i].length !== 13) return false;
    return true;
  }

  /* Any legal move at all. Used for the locked state -- Kungen has no loss,
     only a position you have to back out of. */
  function hasMove(st) {
    var i, j;
    for (i = 0; i < CELLS; i++) {
      if (st.cells[i] && canPlaceOnFoundation(st.cells[i], st)) return true;
      for (j = 0; j < COLS; j++) {
        if (st.cells[i] && canPlaceOnCol(st.cells[i], st, j)) return true;
      }
    }
    for (i = 0; i < COLS; i++) {
      if (!st.cols[i].length) continue;
      if (canPlaceOnFoundation(top(st.cols[i]), st)) return true;
      if (freeCells(st) > 0) return true;
      var run = runLength(st.cols[i]);
      for (var n = 1; n <= run; n++) {
        var card = st.cols[i][st.cols[i].length - n];
        for (j = 0; j < COLS; j++) {
          if (i === j) continue;
          if (n <= maxMove(st, j) && canPlaceOnCol(card, st, j)) return true;
        }
      }
    }
    return false;
  }

  return {
    COLS: COLS, CELLS: CELLS, SUITS: SUITS,
    deal: deal, top: top, stacks: stacks, runLength: runLength,
    freeCells: freeCells, emptyCols: emptyCols, maxMove: maxMove,
    canPlaceOnFoundation: canPlaceOnFoundation, canPlaceOnCol: canPlaceOnCol,
    moveRun: moveRun, toCell: toCell, fromCell: fromCell,
    toFoundation: toFoundation, isWon: isWon, hasMove: hasMove
  };
});
