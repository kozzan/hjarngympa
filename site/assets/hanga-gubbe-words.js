/* Curated word lists for Hänga gubbe.

   Hand-written rather than drawn from site/data/: those lists come from SALDO
   and carry every inflected form, which makes a hangman word neither guessable
   nor fair ("hundarnas" is a valid form and a miserable puzzle). Städer are
   proper nouns and are excluded from SALDO altogether, so they could only ever
   live here. Kept short on purpose — a word nobody can picture is not harder,
   it is just worse. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HangaGubbeWords = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var djur = [
    'hund', 'katt', 'älg', 'räv', 'björn', 'orm', 'groda', 'häst', 'tupp',
    'gris', 'får', 'get', 'mus', 'varg', 'uggla', 'ekorre', 'igelkott',
    'sköldpadda', 'delfin', 'kanin', 'lodjur', 'järv', 'bäver', 'säl', 'örn',
    'svan', 'mås', 'myra', 'fjäril', 'spindel', 'snöuggla', 'grävling',
    'vildsvin', 'renkalv', 'hackspett', 'näktergal', 'salamander'
  ];

  var mat = [
    'bröd', 'ost', 'korv', 'potatis', 'sylt', 'kanelbulle', 'köttbullar',
    'pannkaka', 'gröt', 'sill', 'lax', 'räka', 'knäckebröd', 'lingon',
    'blåbär', 'jordgubbe', 'gurka', 'morot', 'lök', 'äpple', 'päron',
    'choklad', 'glass', 'våffla', 'semla', 'kladdkaka', 'falukorv',
    'raggmunk', 'ärtsoppa', 'pyttipanna', 'surströmming', 'saffransbulle'
  ];

  var stader = [
    'stockholm', 'göteborg', 'malmö', 'uppsala', 'lund', 'umeå', 'kiruna',
    'visby', 'kalmar', 'örebro', 'gävle', 'luleå', 'borås', 'halmstad',
    'karlstad', 'växjö', 'sundsvall', 'norrköping', 'linköping', 'jönköping',
    'helsingborg', 'falun', 'östersund', 'skellefteå', 'ystad', 'sigtuna',
    'trollhättan', 'mariestad', 'strängnäs', 'karlskrona'
  ];

  var CATEGORIES = [
    { id: 'djur', name: 'Djur', words: djur },
    { id: 'mat', name: 'Mat', words: mat },
    { id: 'stader', name: 'Städer', words: stader },
    { id: 'blandat', name: 'Blandat', words: djur.concat(mat, stader) }
  ];

  function byId(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return CATEGORIES[0];
  }

  return { CATEGORIES: CATEGORIES, byId: byId };
});
