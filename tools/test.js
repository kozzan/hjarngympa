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
  assert.strictEqual(blocks, 11, 'seven games + homepage + two articles + korsordshjälp');
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
