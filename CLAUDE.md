# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**hjarngympa.se** — a Swedish puzzle and word-game site, funded entirely by
Google AdSense. Static HTML/CSS/vanilla JS, no framework, no backend, no
database, hosted free on GitHub Pages.

The business case rests on one number: puzzle sites get 15–40 pageviews per
session where an article site gets ~1.2. That multiplier, not CPC, is why
this niche was chosen. **Anything that hurts repeat play hurts revenue more
than any ad placement helps it.**

All user-facing copy is in Swedish. Code, comments and commits are English.

## Commands

```bash
python3 tools/build.py            # site/pages/** -> dist/
node --test tools/test.js         # 59 checks; CI runs this before every deploy
cd dist && python3 -m http.server 8765
```

Deploy is automatic: push to `main`, GitHub Actions builds and publishes.
No package.json, no install step, nothing to run by hand.

Word lists are regenerated only when Språkbanken publishes new data — see
README.md for that command.

## Layout

```
site/_layout.html     shared shell: head, header, footer, consent, ad tag
site/pages/**         one file per route, each with a <!--meta --> block
site/assets/          css, js, self-hosted fonts (6 static faces, latin subset)
site/data/            generated word lists — do not hand-edit
tools/build.py        the whole build; stdlib only, no dependencies
tools/test.js         node:test, no framework
docs/design/          Claude Design handoffs — the visual source of truth
docs/superpowers/     the original design spec, with the keyword research
```

## Game architecture — keep the split

Every game is two files:

- **`<game>-core.js`** — pure rules, no DOM, UMD-wrapped so `node:test` can
  require it. This is where correctness lives.
- **`<game>.js`** — rendering, input, result panel. Untested by design.

That split is the only reason the rules are testable. When adding a game,
put anything that can be wrong in the core and unit-test it there. The bugs
worth catching in this codebase are all rules bugs — see below.

Shared UI pieces already exist: `.result` panel, `.frame` zoom container,
`.seg` segmented switch, `.gamectl` button row, `.diffs` chips. Reuse them
rather than inventing a fourth button style.

## Rules bugs that were caught by tests

Keep these behaviours; they are what makes each game fair.

- **Minsvepare: the first dig is always safe.** Mines are placed *after* the
  first click, avoiding that cell and its neighbours. Placing them upfront is
  the classic way a minesweeper clone becomes infuriating. Tested over 60 seeds.
- **Minsvepare: the counter counts flags, not mines.** The other choice leaks
  information.
- **Minsvepare: win = every safe cell open**, regardless of flags. Requiring
  correct flags would let a player "lose" a solved board.
- **Mahjong: boards are dealt backwards** — repeatedly take two currently-free
  positions and assign them a pair. A random shuffle cannot promise the board
  is winnable; this can.
- **Mahjong: layer origins must snap to whole tile steps.** A half-tile offset
  (`(8-5)/2 = 1.5`) means no tile ever sits squarely on another, nothing is
  ever covered, and the game is trivially solvable. This shipped once.
- **Patiens: an exhausted stock recycles the waste**, or the game cannot finish.
- **Dagens ord: duplicate letters mark correctly.** Exact matches claim their
  letter before a "near" does — guessing a word with two of a letter must not
  light up both when the answer has one.

## Gotchas that have already bitten

**Empty env vars beat defaults.** GitHub Actions expands an unset repo
variable to `""`, and `os.environ.get("X", default)` returns the empty
string, not the default. This shipped relative canonicals and an invalid
sitemap to production. Always `os.environ.get("X") or default`. The build now
refuses to run if `BASE_URL` is not absolute, and a test reproduces the CI case.

**GitHub Pages caches for 10 minutes.** After a successful deploy the old page
is still served (`cache-control: max-age=600`). Do not diagnose a "failed"
deploy inside that window — check the `age:` response header first.

**Certificate provisioning does not retry.** If the custom domain is set while
DNS is still propagating, GitHub silently fails to request the certificate and
never tries again. Fix: remove and re-add the custom domain. Symptom:
`https_certificate` is `null` and the server presents a `*.github.io` cert.

**`site/data/words.txt` is 8.6 MB and never ships.** `tools/build.py` excludes
it from `dist` and cuts it into `len2.txt`…`len15.txt` instead — korsordshjälp
fetches exactly one shard (330 KB gzipped at worst) for the length it needs.
Length is the only axis a shard can key on: a crossword always knows the slot
length and often does not know the first letter. Solvers load word lists
lazily and never load a list a page does not need. A test asserts `words.txt`
stays out of `dist`.

**Google Fonts hands out variable woff2, and one per weight is the same file.**
`newsreader-500`/`-600` were byte-identical, as were `sourcesans3-400`/`-600`,
so the browser fetched the same bytes from two URLs and every fetch carried a
weight axis the site never varies. `tools/build-fonts.py` pins each file to the
one weight `fonts.css` uses (169.6 KB -> 76.9 KB). Re-run it after any refresh
from Google Fonts, and check `md5sum site/assets/fonts/*.woff2` for repeats.

**Preload only what paints above the fold.** Every face is `font-display: swap`,
so none of them block the first paint — preloading one takes bandwidth from the
3 KB of CSS that does block it. On a phone the constraint is bytes, not request
depth. The `h1` is the LCP element and is set in Newsreader 600, so that file's
size *is* the FCP-to-LCP gap: the page paints in Georgia, then re-paints when
the font lands, and Chrome re-records LCP on the repaint.

**`render()` replaces DOM nodes.** Most games rebuild their board on every
move, so any cached element reference goes stale. Re-query after a render.

## Consent and ads

**Google's certified CMP owns consent. Do not add a consent banner.** There was
a hand-rolled one; it was removed when Google's CMP went live, because two
banners appeared and our code granted consent the CMP had never collected.

What remains, and must stay:

- Consent Mode v2 defaults (`denied`) in `<head>`, set **before** the AdSense
  tag. Google's CMP takes over the updates.
- The footer "Cookieinställningar" button calls `googlefc.showRevocationMessage()`
  via the `callbackQueue` / `CONSENT_DATA_READY` handler, and stays hidden
  until `getConsentStatus()` reports an actual decision. Calling it while the
  status is `UNKNOWN` silently does nothing, which reads as a dead control.

**Ad slots are authored as sized placeholder divs** (`<div class="ad
ad-336x280">`) and `tools/build.py` injects the real `<ins>` inside them at
build time. Keep that indirection — the wrapper's fixed height is what keeps
CLS at 0 whether or not an ad fills.

**Never push an ad into a hidden slot.** AdSense throws `No slot size for
availableWidth=0`. `window.mountAd()` defers zero-width slots and sweeps them
when a result panel opens or the viewport crosses a breakpoint. Dynamic slots
must go through it, and it enforces one push per `<ins>` (pushing twice is a
policy violation).

**ads.txt uses `pub-…`, never `ca-pub-…`.** The `ca-` prefix produces
"Obehörig", which is worse than having no file — AdSense then refuses to
serve. There is a test for exactly this.

**Never place an ad inside, over, or adjacent to a play area, and never
between moves.** Policy risk, and it destroys retention. Auto Ads is
deliberately off; leave it off.

## Design rules

`docs/design/HANDOFF.md` and `HANDOFF-games.md` hold the full token set and
per-screen specs. Follow them rather than improvising.

- **Colour is never the only signal.** Word-game tiles carry `✓ → ×` corner
  marks; sudoku conflicts carry `△`; minesweeper digits carry the numeral with
  colour as reinforcement only, so the board reads in greyscale; mahjong
  free-vs-blocked differs by border weight, a raised bottom edge and a hatch,
  never brightness; patience red suits underline the rank; memory uses 12
  silhouettes; 2048's 1024/2048 tiles take a border on top of the ramp.
- **Minimum product text 17px, body 19px, tap targets ≥ 48×48px.** Never 13px.
  The audience skews 45+.
- **Tap targets are measured in rendered pixels, not board coordinates.**
  Minsvepare never draws a cell below 40px; the frame scrolls instead.
- **Light and dark both**, via `:root` tokens and a `[data-theme]` override.
  The theme is set before first paint to avoid a flash.
- Honour `prefers-reduced-motion`.

## Assets are generated, not sourced

**Mahjong tile faces are drawn in code** (`mahjong-faces.js`) — dots as pip
circles, bamboo as sticks, both from pure geometry inheriting `currentColor`.
Characters, winds and dragons are CJK text.

This was a deliberate rejection of all three obvious sources:

- Wikimedia's tiles are mostly **CC BY-SA 4.0** — share-alike is a permanent
  obligation on a site meant to run unattended.
- The **Unicode block U+1F000** draws the whole tile *including its frame*, so
  it would render a tile inside our tile and destroy the border-weight cue
  that distinguishes free from blocked.
- A **Noto Sans Symbols 2 subset** is 44 KB and has the same frame problem.

If you ever swap in real art, check the frame issue first — it is what
disqualified every set.

## Content and licensing

Word lists derive from **SALDO** and the **Kelly list** (Språkbanken Text,
Göteborgs universitet), both CC BY 4.0.

**Attribution is a licence condition and lives on `/om/`.** CC BY 4.0 §3(a)(2)
allows satisfying it by hyperlink, which is why it is not repeated in every
page footer — the footer links to `/om/` instead. If that link or the `/om/`
attribution ever goes, the site is out of licence.

Two 5-letter lists exist for opposite reasons: `words5.txt` (952 curated common
answers) is what the daily game can pick, and `words5all.txt` (13 779 valid
forms) is what a guess is validated against. Rejecting a word the player knows
is real is the fastest way to lose them.

## Not built yet

- Board-aware Wordfeud solving — v1 solves a rack only.
- Result panels are wired per game but there is no shared JS component; each
  game fills the same markup itself. Fine at seven games, worth extracting at
  ten.
