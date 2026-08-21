/* Patiens (Klondike) — deal and move rules. No DOM. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PatiensCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUITS = [
    { s: 'spader', g: '♠', red: false },
    { s: 'hjarter', g: '♥', red: true },
    { s: 'ruter', g: '♦', red: true },
    { s: 'klover', g: '♣', red: false }
  ];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'K', 'D', 'E'];
  // Swedish court cards: Knekt, Dam, Kung -> displayed Kn/D/K after 10.
  var LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Kn', 'D', 'K'];

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
    var d = [];
    for (var si = 0; si < SUITS.length; si++) {
      for (var r = 0; r < 13; r++) {
        d.push({
          suit: SUITS[si].s, glyph: SUITS[si].g, red: SUITS[si].red,
          rank: r + 1, label: LABELS[r], up: false,
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

  function deal(seed) {
    var deck = newDeck(makeRng(seed || 1));
    var g = {
      seed: seed || 1,
      tableau: [[], [], [], [], [], [], []],
      foundation: { spader: [], hjarter: [], ruter: [], klover: [] },
      stock: [], waste: [],
      moves: 0, status: 'playing'
    };
    for (var col = 0; col < 7; col++) {
      for (var n = 0; n <= col; n++) {
        var c = deck.pop();
        c.up = (n === col);         // only the last card in each pile faces up
        g.tableau[col].push(c);
      }
    }
    g.stock = deck;
    return g;
  }

  function top(pile) { return pile.length ? pile[pile.length - 1] : null; }

  /* Tableau builds down in alternating colours; only a King starts an empty
     column. */
  function canStack(card, onto) {
    if (!onto) return card.rank === 13;
    if (!onto.up) return false;
    return onto.red !== card.red && onto.rank === card.rank + 1;
  }

  /* Foundations build up by suit from Ace. */
  function canFound(card, pile) {
    if (!pile.length) return card.rank === 1;
    return top(pile).rank === card.rank - 1;
  }

  function flipIfNeeded(pile) {
    var t = top(pile);
    if (t && !t.up) { t.up = true; return true; }
    return false;
  }

  /* A face-up run from `idx` to the end of a tableau column may move as one
     unit if it is already a valid descending alternating sequence. */
  function movableRun(g, col, idx) {
    var pile = g.tableau[col];
    if (idx < 0 || idx >= pile.length || !pile[idx].up) return null;
    for (var i = idx; i < pile.length - 1; i++) {
      var a = pile[i], b = pile[i + 1];
      if (a.red === b.red || a.rank !== b.rank + 1) return null;
    }
    return pile.slice(idx);
  }

  function moveToTableau(g, from, idx, to) {
    var run = movableRun(g, from, idx);
    if (!run || from === to) return false;
    if (!canStack(run[0], top(g.tableau[to]))) return false;
    g.tableau[from].splice(idx, run.length);
    for (var i = 0; i < run.length; i++) g.tableau[to].push(run[i]);
    flipIfNeeded(g.tableau[from]);
    g.moves++;
    return true;
  }

  function moveToFoundation(g, card, source) {
    var pile = g.foundation[card.suit];
    if (!canFound(card, pile)) return false;
    if (source.type === 'tableau') {
      var col = g.tableau[source.col];
      if (top(col) !== card) return false;
      col.pop();
      flipIfNeeded(col);
    } else if (source.type === 'waste') {
      if (top(g.waste) !== card) return false;
      g.waste.pop();
    } else return false;
    pile.push(card);
    g.moves++;
    checkWin(g);
    return true;
  }

  function wasteToTableau(g, to) {
    var c = top(g.waste);
    if (!c || !canStack(c, top(g.tableau[to]))) return false;
    g.waste.pop();
    g.tableau[to].push(c);
    g.moves++;
    return true;
  }

  /* Draw one at a time; when the stock runs out the waste is turned back
     over, which is what makes the game finishable. */
  function draw(g) {
    if (!g.stock.length) {
      if (!g.waste.length) return false;
      while (g.waste.length) {
        var c = g.waste.pop();
        c.up = false;
        g.stock.push(c);
      }
      g.moves++;
      return true;
    }
    var card = g.stock.pop();
    card.up = true;
    g.waste.push(card);
    g.moves++;
    return true;
  }

  function checkWin(g) {
    var n = 0;
    for (var s in g.foundation) n += g.foundation[s].length;
    if (n === 52) g.status = 'won';
    return g.status === 'won';
  }

  function score(g) {
    var n = 0;
    for (var s in g.foundation) n += g.foundation[s].length;
    return n * 10;
  }

  return {
    SUITS: SUITS, LABELS: LABELS, makeRng: makeRng, deal: deal, top: top,
    canStack: canStack, canFound: canFound, movableRun: movableRun,
    moveToTableau: moveToTableau, moveToFoundation: moveToFoundation,
    wasteToTableau: wasteToTableau, draw: draw, checkWin: checkWin, score: score
  };
});
