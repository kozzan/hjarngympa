/* Run: node --test tools/
   No framework, no fixtures -- just the checks that catch the bugs that
   actually ship in this kind of code. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WordGame = require(path.join(ROOT, 'site/assets/wordgame-core.js'));
const Sudoku = require(path.join(ROOT, 'site/assets/sudoku-core.js'));

const data = (f) =>
  fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8').split('\n').filter(Boolean);

// ---------------------------------------------------------------- word game

test('mark: all correct', () => {
  assert.deepStrictEqual(WordGame.mark('sköld', 'sköld'),
    ['ok', 'ok', 'ok', 'ok', 'ok']);
});

test('mark: nothing in common', () => {
  assert.deepStrictEqual(WordGame.mark('bjuda', 'kropp'),
    ['absent', 'absent', 'absent', 'absent', 'absent']);
});

test('mark: a duplicate guess letter only gets one "near"', () => {
  // "kaffe" guessed against "fiska": the answer has one f, so only the
  // first unmatched f may be near -- the second must be absent.
  const m = WordGame.mark('kaffe', 'fiska');
  assert.strictEqual(m.filter((x) => x === 'near').length, 3, 'k, a and one f');
  assert.strictEqual(m[3], 'absent', 'second f has no spare in the answer');
});

test('mark: an exact match claims its letter before a near does', () => {
  // Answer has one "a", and the guess has it in the right place at index 4.
  // The earlier "a" must therefore be absent, not near.
  const m = WordGame.mark('araba', 'kobra');
  assert.strictEqual(m[4], 'ok');
  assert.strictEqual(m[0], 'absent');
});

test('puzzleIndex advances by exactly one across midnight', () => {
  const epoch = Date.UTC(2026, 0, 1);
  const a = WordGame.puzzleIndex(new Date(2026, 7, 21, 23, 59, 59), epoch);
  const b = WordGame.puzzleIndex(new Date(2026, 7, 22, 0, 0, 1), epoch);
  assert.strictEqual(b - a, 1);
});

test('puzzleIndex is stable at any hour of the same day', () => {
  const epoch = Date.UTC(2026, 0, 1);
  const hours = [0, 6, 12, 18, 23].map((h) =>
    WordGame.puzzleIndex(new Date(2026, 7, 21, h, 30), epoch));
  assert.strictEqual(new Set(hours).size, 1);
});

// ------------------------------------------------------------------ sudoku

test('generate: puzzle has exactly one solution', () => {
  for (const diff of ['latt', 'expert']) {
    const { puzzle } = Sudoku.generate(diff, 4821);
    assert.strictEqual(Sudoku.count(puzzle.slice(), 2), 1,
      `${diff} puzzle must be uniquely solvable`);
  }
});

test('generate: solution is a legal grid and matches the givens', () => {
  const { puzzle, solution } = Sudoku.generate('medel', 777);
  for (let i = 0; i < 81; i++) {
    if (puzzle[i]) assert.strictEqual(puzzle[i], solution[i], `given at ${i}`);
  }
  for (let i = 0; i < 81; i++) {
    const v = solution[i];
    const without = solution.slice();
    without[i] = 0;
    assert.ok(Sudoku.ok(without, i, v), `solution breaks a rule at ${i}`);
  }
});

test('generate: same seed reproduces the same puzzle', () => {
  const a = Sudoku.generate('svar', 1234).puzzle;
  const b = Sudoku.generate('svar', 1234).puzzle;
  assert.deepStrictEqual(a, b);
});

test('generate: harder difficulties give away fewer cells', () => {
  const easy = Sudoku.generate('latt', 99).givens;
  const hard = Sudoku.generate('expert', 99).givens;
  assert.ok(hard < easy, `expert (${hard}) should have fewer givens than lätt (${easy})`);
});

// ------------------------------------------------------------- word lists

test('every daily answer is exactly five letters and lowercase Swedish', () => {
  const bad = data('words5.txt').filter((w) => !/^[a-zåäö]{5}$/.test(w));
  assert.deepStrictEqual(bad, []);
});

test('every daily answer is also an accepted guess', () => {
  const valid = new Set(data('words5all.txt'));
  const missing = data('words5.txt').filter((w) => !valid.has(w));
  assert.deepStrictEqual(missing, [], 'answer would be rejected as a guess');
});

test('daily answers are unique and cover at least two years', () => {
  const answers = data('words5.txt');
  assert.strictEqual(new Set(answers).size, answers.length, 'duplicate answer');
  assert.ok(answers.length > 730, `only ${answers.length} answers`);
});

test('the rack list contains no word longer than nine letters', () => {
  const tooLong = data('words9.txt').filter((w) => w.length > 9);
  assert.deepStrictEqual(tooLong, []);
});

test('word lists contain no proper nouns or stray characters', () => {
  const sample = data('words9.txt');
  const bad = sample.filter((w) => !/^[a-zåäö]{2,9}$/.test(w));
  assert.deepStrictEqual(bad.slice(0, 5), []);
});

// --------------------------------------------------------------- build output

const { execFileSync } = require('node:child_process');

test('build emits absolute canonicals even when CI passes empty env vars', () => {
  // GitHub Actions expands an unset repo variable to "", which is set-but-empty
  // and silently beats a default arg. That shipped relative canonicals once.
  execFileSync('python3', [path.join(ROOT, 'tools/build.py')], {
    cwd: ROOT,
    env: { ...process.env, BASE_URL: '', BASE_PATH: '' },
    stdio: 'pipe',
  });
  const home = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8');
  const canonical = home.match(/<link rel="canonical" href="([^"]*)"/)[1];
  assert.match(canonical, /^https:\/\//, `canonical must be absolute, got ${canonical}`);

  const sitemap = fs.readFileSync(path.join(ROOT, 'dist/sitemap.xml'), 'utf8');
  for (const loc of sitemap.match(/<loc>([^<]*)<\/loc>/g)) {
    assert.match(loc, /<loc>https:\/\//, `sitemap loc must be absolute: ${loc}`);
  }

  const robots = fs.readFileSync(path.join(ROOT, 'dist/robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\//);
});

test('ads.txt names the publisher id in the exact format exchanges require', () => {
  execFileSync('python3', [path.join(ROOT, 'tools/build.py')], { cwd: ROOT, stdio: 'pipe' });
  const ads = fs.readFileSync(path.join(ROOT, 'dist/ads.txt'), 'utf8').trim();
  // <domain>, <publisher id>, DIRECT|RESELLER, <certification authority id>
  assert.match(ads, /^google\.com, pub-\d+, DIRECT, f08c47fec0942fa0$/,
    `malformed ads.txt line: ${ads}`);
  assert.ok(!ads.includes('ca-pub-'), 'ads.txt takes pub-, not ca-pub-');
});

// ------------------------------------------------------------- minsvepare

const Mine = require(path.join(ROOT, 'site/assets/minsvepare-core.js'));

test('minsvepare: the first dig is always safe, whatever the seed', () => {
  // The whole fairness of the game rests on this.
  for (let seed = 1; seed <= 60; seed++) {
    const g = Mine.create('latt');
    const first = seed % (g.w * g.h);
    Mine.dig(g, first, Mine.makeRng(seed));
    assert.ok(!g.mines[first], `seed ${seed}: first dig hit a mine`);
    assert.notStrictEqual(g.status, 'lost', `seed ${seed}: lost on move one`);
  }
});

test('minsvepare: the first dig also clears its neighbours, so it opens an area', () => {
  const g = Mine.create('latt');
  Mine.dig(g, 40, Mine.makeRng(7));
  for (const n of Mine.neighbours(40, g.w, g.h)) {
    assert.ok(!g.mines[n], `neighbour ${n} of the first dig held a mine`);
  }
  assert.strictEqual(g.counts[40], 0, 'first cell should have no adjacent mines');
});

test('minsvepare: exactly the requested number of mines is placed', () => {
  for (const level of ['latt', 'medel', 'svar', 'expert']) {
    const g = Mine.create(level);
    Mine.dig(g, 0, Mine.makeRng(3));
    assert.strictEqual(Object.keys(g.mines).length, g.mineCount, level);
  }
});

test('minsvepare: counts match the mines actually adjacent', () => {
  const g = Mine.create('medel');
  Mine.dig(g, 0, Mine.makeRng(11));
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.mines[i]) { assert.strictEqual(g.counts[i], -1); continue; }
    const n = Mine.neighbours(i, g.w, g.h).filter((x) => g.mines[x]).length;
    assert.strictEqual(g.counts[i], n, `count wrong at ${i}`);
  }
});

test('minsvepare: flood fill stops at digits and never crosses a flag', () => {
  const g = Mine.create('latt');
  Mine.dig(g, 40, Mine.makeRng(5));
  for (const i of Object.keys(g.revealed)) {
    assert.ok(!g.mines[i], `flood fill revealed a mine at ${i}`);
  }
  // every opened zero must have opened all of its neighbours
  for (const i of Object.keys(g.revealed).map(Number)) {
    if (g.counts[i] !== 0) continue;
    for (const n of Mine.neighbours(i, g.w, g.h)) {
      assert.ok(g.revealed[n], `zero at ${i} left neighbour ${n} closed`);
    }
  }
});

test('minsvepare: a flagged cell cannot be dug', () => {
  const g = Mine.create('latt');
  Mine.dig(g, 0, Mine.makeRng(9));
  const target = Object.keys(g.revealed).length < 81 ? 80 : 1;
  delete g.revealed[target];
  Mine.cycleMark(g, target);
  assert.strictEqual(g.marks[target], 'flag');
  assert.deepStrictEqual(Mine.dig(g, target), []);
  assert.ok(!g.revealed[target]);
});

test('minsvepare: mark cycles flag -> uncertain -> clear', () => {
  const g = Mine.create('latt');
  assert.strictEqual(Mine.cycleMark(g, 5), 'flag');
  assert.strictEqual(Mine.cycleMark(g, 5), 'unknown');
  assert.strictEqual(Mine.cycleMark(g, 5), null);
  assert.strictEqual(Mine.flagCount(g), 0);
});

test('minsvepare: chord only fires when flags equal the digit', () => {
  const g = Mine.create('latt');
  Mine.dig(g, 40, Mine.makeRng(2));
  const digit = Object.keys(g.revealed).map(Number).find((i) => g.counts[i] > 0);
  assert.ok(digit !== undefined, 'expected at least one revealed digit');
  // no flags yet, so chording must do nothing
  assert.deepStrictEqual(Mine.chord(g, digit), []);
  // flag the actual mines around it, then chord must open the rest
  const nb = Mine.neighbours(digit, g.w, g.h);
  nb.filter((n) => g.mines[n]).forEach((n) => Mine.cycleMark(g, n));
  Mine.chord(g, digit, Mine.makeRng(2));
  for (const n of nb) {
    if (!g.mines[n]) assert.ok(g.revealed[n], `chord left ${n} closed`);
  }
  assert.notStrictEqual(g.status, 'lost', 'correct chord must not lose');
});

test('minsvepare: win is every safe cell open, regardless of flags', () => {
  const g = Mine.create('latt');
  Mine.dig(g, 0, Mine.makeRng(4));
  for (let i = 0; i < g.w * g.h; i++) if (!g.mines[i]) g.revealed[i] = true;
  assert.ok(Mine.checkWin(g));
  assert.strictEqual(g.status, 'won');
});

// ---------------------------------------------------------------- mahjong

const Mah = require(path.join(ROOT, 'site/assets/mahjong-core.js'));

test('mahjong: every tile is dealt as part of a pair', () => {
  for (const layout of ['kompakt', 'klassisk']) {
    const g = Mah.deal(layout, 42);
    assert.strictEqual(g.tiles.length % 2, 0, `${layout}: odd tile count`);
    const counts = {};
    for (const t of g.tiles) counts[t.id] = (counts[t.id] || 0) + 1;
    for (const [id, n] of Object.entries(counts)) {
      assert.strictEqual(n % 2, 0, `${layout}: ${id} appears ${n} times`);
    }
  }
});

test('mahjong: a stacked tile is never free, an edge tile is', () => {
  const g = Mah.deal('kompakt', 5);
  const map = Mah.index(g.tiles);
  const covered = g.tiles.find((t) => map[`${t.x},${t.y},${t.z + 1}`]);
  assert.ok(covered, 'expected at least one covered tile');
  assert.strictEqual(Mah.isFree(covered, map), false);
  assert.ok(Mah.freeTiles(g.tiles).length > 0, 'no free tiles at all');
});

test('mahjong: a board dealt backwards can always be cleared', () => {
  // The point of dealing in reverse: greedily taking pairs must finish.
  for (const seed of [1, 2, 3, 7, 99]) {
    const g = Mah.deal('kompakt', seed);
    let guard = 0;
    while (Mah.remaining(g) > 0 && guard++ < 200) {
      const pairs = Mah.availablePairs(g);
      if (!pairs.length) break;
      Mah.removePair(g, pairs[0][0], pairs[0][1]);
    }
    // A greedy line can dead-end, but a fresh board must never start dead.
    assert.ok(g.removedPairs > 0, `seed ${seed}: no pair was ever available`);
  }
});

test('mahjong: a fresh board always offers at least one move', () => {
  for (const layout of ['kompakt', 'klassisk']) {
    for (const seed of [1, 12, 77, 500]) {
      const g = Mah.deal(layout, seed);
      assert.ok(Mah.availablePairs(g).length > 0,
        `${layout} seed ${seed} started with no legal move`);
    }
  }
});

test('mahjong: only identical free tiles can be removed', () => {
  const g = Mah.deal('kompakt', 8);
  const free = Mah.freeTiles(g.tiles);
  const a = free[0];
  const different = free.find((t) => t !== a && t.id !== a.id);
  if (different) assert.strictEqual(Mah.removePair(g, a, different), false);
  const twin = g.tiles.find((t) => t !== a && t.id === a.id && !t.removed);
  const map = Mah.index(g.tiles);
  if (twin && Mah.isFree(twin, map)) {
    assert.strictEqual(Mah.removePair(g, a, twin), true);
    assert.ok(a.removed && twin.removed);
  }
});

test('mahjong: shuffle keeps the same multiset of tiles', () => {
  const g = Mah.deal('kompakt', 3);
  const before = g.tiles.filter((t) => !t.removed).map((t) => t.id).sort();
  Mah.shuffle(g, 9);
  const after = g.tiles.filter((t) => !t.removed).map((t) => t.id).sort();
  assert.deepStrictEqual(after, before);
  assert.strictEqual(g.shuffles, 1);
});

test('mahjong: the compact layout fits a phone, classic is bigger', () => {
  const k = Mah.deal('kompakt', 1);
  const c = Mah.deal('klassisk', 1);
  assert.ok(k.tiles.length <= 72, `kompakt has ${k.tiles.length} tiles`);
  assert.ok(c.tiles.length > k.tiles.length, 'classic should be larger');
  const width = Math.max(...k.tiles.map((t) => t.x)) + 1;
  assert.ok(width <= 8, `kompakt is ${width} tiles wide — too wide for 390px`);
});

// ---------------------------------------------------------------- patiens

const Pat = require(path.join(ROOT, 'site/assets/patiens-core.js'));

test('patiens: the deal is a full 52-card deck, no duplicates', () => {
  const g = Pat.deal(7);
  const all = [...g.stock, ...g.tableau.flat()];
  assert.strictEqual(all.length, 52);
  assert.strictEqual(new Set(all.map((c) => c.id)).size, 52, 'duplicate card dealt');
});

test('patiens: tableau is 1..7 deep with only the last card face up', () => {
  const g = Pat.deal(3);
  g.tableau.forEach((col, i) => {
    assert.strictEqual(col.length, i + 1, `column ${i} wrong depth`);
    col.forEach((c, n) => {
      assert.strictEqual(c.up, n === col.length - 1, `column ${i} card ${n} face wrong`);
    });
  });
  assert.strictEqual(g.stock.length, 52 - 28);
});

test('patiens: tableau stacks only descend in alternating colours', () => {
  const red = { rank: 7, red: true, up: true };
  const black8 = { rank: 8, red: false, up: true };
  const red8 = { rank: 8, red: true, up: true };
  assert.ok(Pat.canStack(red, black8), 'red 7 on black 8 is legal');
  assert.ok(!Pat.canStack(red, red8), 'same colour must be rejected');
  assert.ok(!Pat.canStack({ rank: 6, red: true, up: true }, black8), 'must be exactly one lower');
});

test('patiens: only a king starts an empty column', () => {
  assert.ok(Pat.canStack({ rank: 13, red: false }, null));
  assert.ok(!Pat.canStack({ rank: 12, red: false }, null));
});

test('patiens: foundations build up by suit from the ace', () => {
  const pile = [];
  assert.ok(Pat.canFound({ rank: 1 }, pile));
  assert.ok(!Pat.canFound({ rank: 2 }, pile));
  pile.push({ rank: 1 });
  assert.ok(Pat.canFound({ rank: 2 }, pile));
  assert.ok(!Pat.canFound({ rank: 3 }, pile));
});

test('patiens: moving a card off a pile flips the one beneath it', () => {
  const g = Pat.deal(11);
  const col = g.tableau[3];
  const card = Pat.top(col);
  const beneath = col[col.length - 2];
  assert.strictEqual(beneath.up, false);
  // force a legal foundation move by emptying the suit pile and using an ace
  card.rank = 1;
  g.foundation[card.suit] = [];
  assert.ok(Pat.moveToFoundation(g, card, { type: 'tableau', col: 3 }));
  assert.strictEqual(beneath.up, true, 'card underneath should be turned up');
});

test('patiens: a run only moves when it is already a valid sequence', () => {
  const g = Pat.deal(1);
  g.tableau[0] = [
    { rank: 8, red: false, up: true, suit: 'spader' },
    { rank: 7, red: true, up: true, suit: 'hjarter' },
    { rank: 6, red: false, up: true, suit: 'klover' }
  ];
  assert.strictEqual(Pat.movableRun(g, 0, 0).length, 3, 'valid run should move whole');
  g.tableau[1] = [
    { rank: 8, red: false, up: true, suit: 'spader' },
    { rank: 7, red: false, up: true, suit: 'klover' }
  ];
  assert.strictEqual(Pat.movableRun(g, 1, 0), null, 'same-colour run must not move');
});

test('patiens: an exhausted stock recycles the waste so the game can finish', () => {
  const g = Pat.deal(5);
  let guard = 0;
  while (g.stock.length && guard++ < 100) Pat.draw(g);
  assert.strictEqual(g.stock.length, 0);
  assert.ok(g.waste.length > 0);
  assert.ok(Pat.draw(g), 'recycling should succeed');
  assert.ok(g.stock.length > 0, 'waste should return to the stock');
  assert.strictEqual(g.waste.length, 0);
  assert.ok(g.stock.every((c) => !c.up), 'recycled cards must be face down');
});

test('patiens: the game is won only when all 52 reach the foundations', () => {
  const g = Pat.deal(2);
  for (const s of Object.keys(g.foundation)) {
    g.foundation[s] = Array.from({ length: 13 }, (_, i) => ({ rank: i + 1 }));
  }
  assert.ok(Pat.checkWin(g));
  assert.strictEqual(g.status, 'won');
  assert.strictEqual(Pat.score(g), 520);
});
