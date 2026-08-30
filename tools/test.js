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

test('mahjong: all 34 faces render distinctly, dots and bamboo as real pips', () => {
  const Faces = require(path.join(ROOT, 'site/assets/mahjong-faces.js'));
  const seen = new Set();
  for (const t of Mah.tileTypes()) seen.add(Faces.render(t.group, t.face));
  assert.strictEqual(seen.size, 34, 'two motifs render identically');
  for (let n = 1; n <= 9; n++) {
    assert.strictEqual((Faces.dots(n).match(/<circle/g) || []).length, n, `${n} dots`);
    assert.strictEqual((Faces.bamboo(n).match(/<line/g) || []).length, n, `${n} bamboo`);
  }
});

// ------------------------------------------------------------- social cards

test('build emits absolute og:image and og:url even on the CI empty-env path', () => {
  // Same trap as the canonical test: a relative og:image renders as a blank
  // card in Messenger, Facebook and Discord, which is where the shared
  // Dagens ord grids go. Absolute or nothing.
  execFileSync('python3', [path.join(ROOT, 'tools/build.py')], {
    cwd: ROOT,
    env: { ...process.env, BASE_URL: '', BASE_PATH: '' },
    stdio: 'pipe',
  });
  const page = fs.readFileSync(path.join(ROOT, 'dist/dagens-ord/index.html'), 'utf8');
  const prop = (p) => page.match(new RegExp(`<meta property="${p}" content="([^"]*)"`))[1];

  assert.match(prop('og:image'), /^https:\/\/.*\/assets\/og\.png$/, 'og:image must be absolute');
  assert.match(prop('og:url'), /^https:\/\/[^/]+\/dagens-ord\/$/, 'og:url must be absolute');
  assert.strictEqual(prop('og:image:width'), '1200');
  assert.strictEqual(prop('og:image:height'), '630');
  assert.ok(prop('og:image:alt').length > 10, 'og:image:alt must say something');
  assert.match(page, /<meta name="twitter:card" content="summary_large_image">/);
});

test('the og image exists, is really 1200x630 and stays small enough to fetch', () => {
  const png = fs.readFileSync(path.join(ROOT, 'site/assets/og.png'));
  assert.strictEqual(png.subarray(1, 4).toString(), 'PNG', 'must be a PNG -- Facebook will not render SVG');
  // IHDR is the first chunk: width and height are big-endian at bytes 16 and 20.
  assert.strictEqual(png.readUInt32BE(16), 1200);
  assert.strictEqual(png.readUInt32BE(20), 630);
  assert.ok(png.length < 200 * 1024, `og.png is ${Math.round(png.length / 1024)} KB`);
});

// ------------------------------------------------------- structured data

test('every JSON-LD block parses and only carries absolute URLs', () => {
  // A trailing comma here is invisible until Search Console rejects the page
  // weeks later, so parse the built output with a real parser.
  execFileSync('python3', [path.join(ROOT, 'tools/build.py')], { cwd: ROOT, stdio: 'pipe' });

  const pages = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(path.join(ROOT, 'dist'));

  const absolute = (node, where) => {
    if (Array.isArray(node)) return node.forEach((n) => absolute(n, where));
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'url' || k === '@id') && typeof v === 'string') {
        // build.py rewrites href="/ and src="/ for BASE_PATH but never looks
        // inside a JSON string, so a root-relative URL here ships broken.
        assert.match(v, /^https:\/\//, `${where}: ${k} must be absolute, got ${v}`);
      }
      absolute(v, where);
    }
  };

  let blocks = 0;
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    for (const m of html.matchAll(re)) {
      const rel = path.relative(ROOT, p);
      const ld = JSON.parse(m[1]); // throws on a trailing comma
      assert.strictEqual(ld['@context'], 'https://schema.org', `${rel}: @context`);
      assert.ok(ld['@type'], `${rel}: missing @type`);
      absolute(ld, rel);
      blocks++;
    }
  }
  assert.strictEqual(blocks, 13, 'nine games + homepage + two articles + korsordshjälp');
});

// ---------------------------------------------------------------- streak ---

const Streak = require(path.join(ROOT, 'site/assets/streak-core.js'));

test('streak: a second game the same day does not double-count', () => {
  const st = Streak.bump({}, new Date(2026, 7, 23, 9, 0));
  assert.strictEqual(st.n, 1);
  assert.strictEqual(Streak.bump(st, new Date(2026, 7, 23, 23, 0)).n, 1);
});

test('streak: yesterday extends, and across a month boundary too', () => {
  let st = Streak.bump({}, new Date(2026, 6, 30));
  st = Streak.bump(st, new Date(2026, 6, 31));
  st = Streak.bump(st, new Date(2026, 7, 1));
  assert.strictEqual(st.n, 3);
});

test('streak: a skipped day starts over at one but keeps the best', () => {
  let st = Streak.bump({}, new Date(2026, 7, 1));
  st = Streak.bump(st, new Date(2026, 7, 2));
  st = Streak.bump(st, new Date(2026, 7, 5));
  assert.strictEqual(st.n, 1);
  assert.strictEqual(st.best, 2);
});

test('streak: late night and just after midnight are two days, not one', () => {
  const st = Streak.bump({}, new Date(2026, 7, 23, 23, 50));
  assert.strictEqual(Streak.bump(st, new Date(2026, 7, 24, 0, 10)).n, 2);
});

test('streak: the count survives a stored value from an unrelated day', () => {
  const st = Streak.bump({ day: 0, n: 99, best: 99 }, new Date(2026, 7, 23));
  assert.strictEqual(st.n, 1);
  assert.strictEqual(st.best, 99);
});

// ------------------------------------------------------------- korsord ---

const Kors = require(path.join(ROOT, 'site/assets/korsord-core.js'));

test('korsord: a blank matches any letter, a known letter is fixed', () => {
  const words = ['korsord', 'kirsord', 'korsare', 'kalsord'];
  const r = Kors.search(words, 'k_rs_rd');
  assert.deepStrictEqual(r.shown, ['korsord', 'kirsord']);
  assert.strictEqual(r.total, 2);
});

test('korsord: regex metacharacters in the pattern cannot escape the match', () => {
  // '(' would throw and '+' would change the grammar if the input reached the
  // RegExp unescaped. Both must be treated as one ordinary character.
  assert.doesNotThrow(() => Kors.toRegex('a(b'));
  assert.deepStrictEqual(Kors.search(['a(b', 'axb', 'ab'], 'a(b').shown, ['a(b']);
  assert.deepStrictEqual(Kors.search(['a+b', 'aab'], 'a+b').shown, ['a+b']);
});

test('korsord: every blank character people type means the same thing', () => {
  const words = ['hus'];
  for (const p of ['h_s', 'h?s', 'h.s', 'h s']) {
    assert.deepStrictEqual(Kors.search(words, p).shown, ['hus'], `blank ${p}`);
  }
});

test('korsord: a decomposed å matches a composed one', () => {
  // 'å' arrives as U+00E5 from one keyboard and as 'a' + U+030A from another.
  const composed = 'rått';
  const decomposed = 'rått';
  assert.notStrictEqual(composed, decomposed);
  assert.deepStrictEqual(Kors.search([composed], decomposed).shown, [composed]);
  assert.strictEqual(Kors.lengthOf(decomposed), 4);
});

test('korsord: lengths without a shard are refused, not fetched', () => {
  assert.strictEqual(Kors.isSearchable('a'), false);
  assert.strictEqual(Kors.isSearchable('a'.repeat(16)), false);
  assert.strictEqual(Kors.isSearchable('a'.repeat(15)), true);
  assert.strictEqual(Kors.search(['a'], 'a').searchable, false);
});

test('korsord: the cap limits what is rendered but not the reported total', () => {
  const words = Array.from({ length: 500 }, (_, i) => 'ab' + String(i).padStart(3, '0'));
  const r = Kors.search(words, '_____', 200);
  assert.strictEqual(r.total, 500);
  assert.strictEqual(r.shown.length, 200);
});

test('korsord: case and surrounding space do not change the result', () => {
  assert.deepStrictEqual(Kors.search(['hus'], '  H_S  ').shown, ['hus']);
});

test('korsord: the 8.6 MB words.txt is not deployed, only the length shards', () => {
  // The whole point of sharding. If words.txt ever lands in dist again someone
  // will fetch it, and it will be an 8.6 MB download on a phone.
  const dist = path.join(ROOT, 'dist/data');
  assert.ok(!fs.existsSync(path.join(dist, 'words.txt')),
    'words.txt must not ship — nothing fetches it and its presence invites use');

  for (let n = Kors.MIN_LEN; n <= Kors.MAX_LEN; n++) {
    const shard = path.join(dist, `len${n}.txt`);
    assert.ok(fs.existsSync(shard), `missing shard len${n}.txt`);
  }

  // Biggest shard is ~1.2 MB raw / ~330 KB gzipped. Well under the whole list;
  // a regression here means the sharding silently stopped working.
  const sizes = [];
  for (let n = Kors.MIN_LEN; n <= Kors.MAX_LEN; n++) {
    sizes.push(fs.statSync(path.join(dist, `len${n}.txt`)).size);
  }
  const biggest = Math.max(...sizes);
  assert.ok(biggest < 2 * 1024 * 1024,
    `biggest shard is ${(biggest / 1024 / 1024).toFixed(1)} MB — sharding broke`);
});

// -------------------------------------------------------------- kungen ---

const Kungen = require(path.join(ROOT, 'site/assets/kungen-core.js'));

/* Build a card by suit index and rank so states can be written by hand. */
function kcard(suitIndex, rank) {
  const s = Kungen.SUITS[suitIndex];
  return { suit: s.s, glyph: s.g, red: s.red, suitIndex, rank,
           label: String(rank), id: s.s + '-' + rank };
}
const SPADER = 0, HJARTER = 1, RUTER = 2, KLOVER = 3;

/* Empty board, then place what a test needs. */
function kblank() {
  return { seed: 1, cells: [null, null, null, null],
           foundations: [[], [], [], []],
           cols: [[], [], [], [], [], [], [], []], moves: 0 };
}

test('kungen: the deal is 52 unique cards over 8 columns, 7/7/7/7/6/6/6/6', () => {
  const st = Kungen.deal(2104);
  assert.deepStrictEqual(st.cols.map((c) => c.length), [7, 7, 7, 7, 6, 6, 6, 6]);
  const ids = new Set(st.cols.flat().map((c) => c.id));
  assert.strictEqual(ids.size, 52);
});

test('kungen: an empty column takes any card, not just a king', () => {
  // The Klondike rule does not apply here. Getting this wrong makes most of
  // the deals unwinnable and is the obvious mistake after writing patiens.
  const st = kblank();
  st.cols[0] = [kcard(HJARTER, 5)];
  assert.ok(Kungen.canPlaceOnCol(kcard(HJARTER, 5), st, 1), 'a five must be allowed');
  assert.ok(Kungen.canPlaceOnCol(kcard(SPADER, 13), st, 1), 'a king too');
  assert.ok(Kungen.canPlaceOnCol(kcard(RUTER, 1), st, 1), 'and an ace');
});

test('kungen: the tableau only stacks down in alternating colour', () => {
  const st = kblank();
  st.cols[0] = [kcard(SPADER, 8)];                       // black eight
  assert.ok(Kungen.canPlaceOnCol(kcard(HJARTER, 7), st, 0), 'red seven on black eight');
  assert.ok(!Kungen.canPlaceOnCol(kcard(KLOVER, 7), st, 0), 'black on black must fail');
  assert.ok(!Kungen.canPlaceOnCol(kcard(HJARTER, 6), st, 0), 'wrong rank must fail');
});

test('kungen: the movable count is (free cells + 1) x 2^(empty columns)', () => {
  const st = kblank();
  st.cols[0] = [kcard(SPADER, 5)];                       // 7 empty columns
  assert.strictEqual(Kungen.freeCells(st), 4);
  assert.strictEqual(Kungen.emptyCols(st), 7);
  st.cols.forEach((c, i) => { if (i > 0) c.push(kcard(SPADER, 2)); });
  assert.strictEqual(Kungen.emptyCols(st), 0);
  assert.strictEqual(Kungen.maxMove(st), 5);             // (4 + 1) x 1
  st.cells[0] = kcard(KLOVER, 9);
  assert.strictEqual(Kungen.maxMove(st), 4);             // (3 + 1) x 1
  st.cols[7] = [];
  assert.strictEqual(Kungen.maxMove(st), 8);             // (3 + 1) x 2
});

test('kungen: moving into an empty column does not count that column', () => {
  // The column being filled cannot also stage cards. Without this the player
  // is offered a run one card too long whenever a column is empty, and the
  // refusal that follows looks arbitrary.
  const st = kblank();
  for (let i = 0; i < 6; i++) st.cols[i] = [kcard(SPADER, 2)];
  st.cols[6] = [];
  st.cols[7] = [];                                       // two empty columns
  assert.strictEqual(Kungen.maxMove(st), 20);            // (4 + 1) x 2^2
  assert.strictEqual(Kungen.maxMove(st, 6), 10);         // into an empty: 2^1
  assert.strictEqual(Kungen.maxMove(st, 0), 20);         // onto a card: unchanged
});

test('kungen: a run only moves when it is already a valid sequence', () => {
  const st = kblank();
  st.cols[0] = [kcard(SPADER, 8), kcard(HJARTER, 7), kcard(KLOVER, 6)];
  assert.strictEqual(Kungen.runLength(st.cols[0]), 3);
  st.cols[1] = [kcard(SPADER, 8), kcard(KLOVER, 7)];     // same colour, broken
  assert.strictEqual(Kungen.runLength(st.cols[1]), 1);
  st.cols[2] = [kcard(HJARTER, 9)];
  assert.ok(Kungen.moveRun(st, 0, 3, 2), 'a real run onto a red nine');
  assert.strictEqual(Kungen.moveRun(st, 1, 2, 2), null, 'a broken run must not move');
});

test('kungen: a run longer than the movable count is refused', () => {
  const st = kblank();
  st.cols[0] = [kcard(SPADER, 6), kcard(HJARTER, 5), kcard(KLOVER, 4),
                kcard(RUTER, 3), kcard(SPADER, 2)];
  st.cols[1] = [kcard(HJARTER, 7)];
  for (let i = 2; i < 8; i++) st.cols[i] = [kcard(KLOVER, 10)];
  st.cells = [kcard(SPADER, 9), kcard(SPADER, 10), kcard(SPADER, 11), null];
  assert.strictEqual(Kungen.maxMove(st), 2);             // one free cell
  assert.strictEqual(Kungen.moveRun(st, 0, 4, 1), null, 'four is too many');
});

test('kungen: foundations build up from the ace in one suit', () => {
  const st = kblank();
  assert.ok(Kungen.canPlaceOnFoundation(kcard(HJARTER, 1), st), 'ace starts it');
  assert.ok(!Kungen.canPlaceOnFoundation(kcard(HJARTER, 2), st), 'not a two first');
  st.foundations[HJARTER] = [kcard(HJARTER, 1)];
  assert.ok(Kungen.canPlaceOnFoundation(kcard(HJARTER, 2), st), 'then the two');
  assert.ok(!Kungen.canPlaceOnFoundation(kcard(RUTER, 2), st), 'not another suit');
});

test('kungen: the game is won only when all 52 cards are home', () => {
  const st = kblank();
  for (let s = 0; s < 4; s++) {
    for (let r = 1; r <= 13; r++) st.foundations[s].push(kcard(s, r));
  }
  assert.ok(Kungen.isWon(st));
  st.foundations[SPADER].pop();
  assert.ok(!Kungen.isWon(st), '51 cards is not a win');
});

test('kungen: a locked position is detected so the panel can offer undo', () => {
  // Every column headed by a card that stacks on nothing, all cells full and
  // none of them playable, no aces available.
  const st = kblank();
  st.cells = [kcard(SPADER, 5), kcard(SPADER, 7), kcard(SPADER, 9), kcard(SPADER, 11)];
  st.foundations = [[], [], [], []];
  for (let i = 0; i < 8; i++) st.cols[i] = [kcard(KLOVER, 13 - i)];
  st.cols[0] = [kcard(KLOVER, 13), kcard(KLOVER, 4)];
  assert.strictEqual(Kungen.freeCells(st), 0);
  assert.strictEqual(Kungen.hasMove(st), false);

  // Freeing one cell is enough to make a move exist again.
  st.cells[0] = null;
  assert.strictEqual(Kungen.hasMove(st), true);
});

test('kungen: 40 games of random legal play never corrupt the state', () => {
  // Unit tests check each rule in isolation; this checks they compose. Every
  // move returns a fresh state, so a bad slice would duplicate or drop cards
  // and only show up after a long game. It also cross-checks hasMove()
  // against the real move generator — that flag decides whether the player
  // is told the board is locked, so a wrong answer strands them.
  for (let seed = 1; seed <= 40; seed++) {
    let st = Kungen.deal(seed);
    for (let step = 0; step < 120; step++) {
      const all = [].concat(
        st.cols.reduce((a, c) => a.concat(c), []),
        st.cells.filter(Boolean),
        st.foundations.reduce((a, f) => a.concat(f), [])
      );
      assert.strictEqual(all.length, 52, `seed ${seed} step ${step}: card count`);
      assert.strictEqual(new Set(all.map((c) => c.id)).size, 52,
        `seed ${seed} step ${step}: duplicate cards`);
      if (Kungen.isWon(st)) break;

      const moves = [];
      for (let i = 0; i < 8; i++) {
        if (st.cols[i].length && Kungen.canPlaceOnFoundation(Kungen.top(st.cols[i]), st)) {
          moves.push(Kungen.toFoundation(st, 'col', i));
        }
        const run = Kungen.runLength(st.cols[i]);
        for (let n = 1; n <= run; n++) {
          for (let j = 0; j < 8; j++) if (i !== j) moves.push(Kungen.moveRun(st, i, n, j));
        }
        for (let j = 0; j < 4; j++) moves.push(Kungen.toCell(st, i, j));
      }
      for (let i = 0; i < 4; i++) {
        if (st.cells[i] && Kungen.canPlaceOnFoundation(st.cells[i], st)) {
          moves.push(Kungen.toFoundation(st, 'cell', i));
        }
        for (let j = 0; j < 8; j++) moves.push(Kungen.fromCell(st, i, j));
      }
      const legal = moves.filter(Boolean);
      assert.strictEqual(Kungen.hasMove(st), legal.length > 0,
        `seed ${seed} step ${step}: hasMove disagreed with ${legal.length} legal moves`);
      if (!legal.length) break;
      st = legal[(step * 7 + seed) % legal.length];   // deterministic walk
    }
  }
});

// ------------------------------------------------------- spindelharpan ---

const Spider = require(path.join(ROOT, 'site/assets/spindelharpan-core.js'));

/* Face-up card by suit index and rank, so a board can be written by hand. */
function scard(suitIndex, rank, up) {
  const s = Spider.SUITS[suitIndex];
  return { suit: s.s, glyph: s.g, red: s.red, suitIndex, rank,
           label: String(rank), id: s.s + '-' + rank + '-x', up: up !== false };
}

function sblank() {
  return { seed: 1, suits: 4, cols: [[], [], [], [], [], [], [], [], [], []],
           stock: [], foundations: [], moves: 0 };
}

/* A king-to-ace run in one suit, bottom card last. */
function srun(suitIndex) {
  const out = [];
  for (let r = 13; r >= 1; r--) out.push(scard(suitIndex, r));
  return out;
}

test('spindelharpan: the deal is 54 cards over ten columns, 50 left in stock', () => {
  const st = Spider.deal(2104, 4);
  assert.deepStrictEqual(st.cols.map((c) => c.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
  assert.strictEqual(st.stock.length, 50);
  assert.strictEqual(Spider.dealsLeft(st), 5);
  const ids = st.cols.flat().concat(st.stock).map((c) => c.id);
  assert.strictEqual(ids.length, 104);
});

test('spindelharpan: difficulty changes the suits, never the card count', () => {
  for (const suits of [1, 2, 4]) {
    const st = Spider.deal(77, suits);
    const all = st.cols.flat().concat(st.stock);
    assert.strictEqual(all.length, 104, `${suits} suits must still be 104 cards`);
    const used = new Set(all.map((c) => c.suitIndex));
    assert.strictEqual(used.size, suits, `${suits} suits expected, saw ${used.size}`);
  }
});

test('spindelharpan: only the bottom card of each column starts face up', () => {
  const st = Spider.deal(2104, 4);
  for (const col of st.cols) {
    assert.strictEqual(col[col.length - 1].up, true, 'the bottom card is up');
    for (let i = 0; i < col.length - 1; i++) {
      assert.strictEqual(col[i].up, false, 'everything above it is hidden');
    }
  }
});

test('spindelharpan: you may place across suits but only lift within one', () => {
  const st = sblank();
  st.cols[0] = [scard(0, 8)];
  // Placing a seven of any suit on the eight is legal.
  assert.ok(Spider.canPlaceOnCol(scard(1, 7), st, 0), 'a red seven goes on a black eight');
  assert.ok(Spider.canPlaceOnCol(scard(0, 7), st, 0), 'so does a spade seven');
  assert.ok(!Spider.canPlaceOnCol(scard(0, 6), st, 0), 'a six does not');

  // Lifting more than one card is same-suit only. This is the rule that makes
  // the game hard, and the one a Klondike author drops by accident.
  st.cols[1] = [scard(0, 9), scard(0, 8), scard(0, 7)];
  assert.strictEqual(Spider.runLength(st.cols[1]), 3, 'three spades in order');
  st.cols[2] = [scard(0, 9), scard(1, 8), scard(0, 7)];
  assert.strictEqual(Spider.runLength(st.cols[2]), 1, 'a mixed run lifts one card only');
});

test('spindelharpan: a mixed descending run refuses to move as a group', () => {
  const st = sblank();
  st.cols[0] = [scard(0, 9), scard(1, 8), scard(0, 7)];   // descending, mixed
  st.cols[1] = [scard(2, 8)];
  assert.strictEqual(Spider.moveRun(st, 0, 3, 1), null, 'three mixed cards must not lift');
  assert.ok(Spider.moveRun(st, 0, 1, 1), 'the bottom card alone is fine');
});

test('spindelharpan: an empty column takes any card', () => {
  const st = sblank();
  st.cols[0] = [scard(0, 13)];
  assert.ok(Spider.canPlaceOnCol(scard(1, 4), st, 5), 'a four into the gap');
  assert.ok(Spider.canPlaceOnCol(scard(0, 13), st, 5), 'a king too');
});

test('spindelharpan: a covered card turns over when the move exposes it', () => {
  const st = sblank();
  st.cols[0] = [scard(3, 5, false), scard(0, 7)];   // a hidden five under a seven
  st.cols[1] = [scard(1, 8)];
  const next = Spider.moveRun(st, 0, 1, 1);
  assert.ok(next, 'the seven moves onto the eight');
  assert.strictEqual(next.cols[0].length, 1);
  assert.strictEqual(next.cols[0][0].up, true, 'the five beneath is now face up');
});

test('spindelharpan: the stock will not deal while a column is empty', () => {
  const st = Spider.deal(2104, 4);
  assert.ok(Spider.canDeal(st), 'a full board deals');
  st.cols[3] = [];
  assert.strictEqual(Spider.canDeal(st), false);
  assert.match(Spider.dealBlockedReason(st), /tomma kolumnen/,
    'the refusal must say why, not fail silently');
  assert.strictEqual(Spider.dealRow(st), null);
});

test('spindelharpan: a deal puts one face-up card on every column', () => {
  const st = Spider.deal(2104, 4);
  const before = st.cols.map((c) => c.length);
  const next = Spider.dealRow(st);
  assert.deepStrictEqual(next.cols.map((c) => c.length), before.map((n) => n + 1));
  assert.strictEqual(next.stock.length, 40);
  assert.strictEqual(Spider.dealsLeft(next), 4);
  for (const col of next.cols) {
    assert.strictEqual(col[col.length - 1].up, true, 'dealt cards land face up');
  }
});

test('spindelharpan: a finished king-to-ace suit leaves the board', () => {
  const st = sblank();
  st.cols[0] = srun(0);
  assert.strictEqual(Spider.collect(st), 1, 'the spade run goes');
  assert.strictEqual(st.cols[0].length, 0);
  assert.strictEqual(st.foundations.length, 1);

  // The same thirteen ranks in mixed suits must stay put.
  const mixed = sblank();
  mixed.cols[0] = srun(0);
  mixed.cols[0][4] = scard(1, 9);
  assert.strictEqual(Spider.collect(mixed), 0, 'a mixed thirteen is not a sequence');
  assert.strictEqual(mixed.cols[0].length, 13);
});

test('spindelharpan: collecting a run turns over what it uncovered', () => {
  const st = sblank();
  st.cols[0] = [scard(2, 4, false)].concat(srun(0));
  assert.strictEqual(Spider.collect(st), 1);
  assert.strictEqual(st.cols[0].length, 1);
  assert.strictEqual(st.cols[0][0].up, true, 'the card under the run is now up');
});

test('spindelharpan: the game is won at eight collected suits', () => {
  const st = sblank();
  for (let i = 0; i < 7; i++) st.foundations.push(srun(0));
  assert.ok(!Spider.isWon(st), 'seven suits is not a win');
  st.foundations.push(srun(0));
  assert.ok(Spider.isWon(st));
});

test('spindelharpan: a move that completes a suit collects it without being asked', () => {
  const st = sblank();
  // A hidden seven under king-to-two of spades, and the ace waiting elsewhere.
  st.cols[0] = [scard(2, 7, false)];
  for (let r = 13; r >= 2; r--) st.cols[0].push(scard(0, r));
  st.cols[1] = [scard(0, 1)];

  const next = Spider.moveRun(st, 1, 1, 0);
  assert.ok(next, 'the ace goes on the two');
  assert.strictEqual(next.foundations.length, 1, 'the finished suit leaves on its own');
  assert.strictEqual(next.cols[0].length, 1, 'only the hidden seven is left');
  assert.strictEqual(next.cols[0][0].up, true, 'and it is now face up');
});
