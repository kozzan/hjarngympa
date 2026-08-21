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
