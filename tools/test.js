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
