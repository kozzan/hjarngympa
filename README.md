# hjarngympa.se

Swedish puzzle and word-game site. Static HTML/CSS/vanilla JS, no framework,
no backend, no database. Hosted free on GitHub Pages, funded by AdSense.

Live: **https://hjarngympa.se**

## Build

```bash
python3 tools/build.py            # site/pages/** -> dist/
node --test tools/test.js         # 51 checks; CI runs this before every deploy
cd dist && python3 -m http.server 8765
```

There is no package.json and nothing to install — the build is Python
stdlib, the tests are `node:test`. Deploy is automatic: push to `main` and
GitHub Actions builds, tests and publishes.

## What's here

**Spel** — seven games, all client-side, all with keyboard support:

| Route | Game | Core logic |
|---|---|---|
| `/dagens-ord/` | Daily Swedish word game | `wordgame-core.js` |
| `/sudoku/` | Sudoku, four difficulties | `sudoku-core.js` |
| `/minsvepare/` | Minesweeper | `minsvepare-core.js` |
| `/mahjong/` | Mahjong solitaire | `mahjong-core.js`, `mahjong-faces.js` |
| `/patiens/` | Klondike patience | `patiens-core.js` |
| `/minnesspel/` | Memory / pairs | `minnesspel.js` |
| `/2048/` | 2048 | `2048.js` |

Each game splits into a **pure `-core.js`** (rules, no DOM, unit-tested) and a
UI file. That split is why the rules are testable at all — keep it.

**Verktyg** — `/verktyg/wordfeud-hjalp/`, a rack solver over the Swedish word
list, running entirely in the browser.

**Artiklar** — written guides. Not filler: AdSense rejects tool-only sites as
"low value content", and these carry long-tail search traffic.

## Word lists

Regenerated only when Språkbanken publishes new data:

```bash
curl -O https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/saldom/saldom.xml
curl -O https://svn.spraakbanken.gu.se/sb-arkiv/pub/lexikon/kelly/kelly.xml
python3 tools/build-wordlist.py saldom.xml kelly.xml site/data/
```

| File | Size | Used by |
|---|---|---|
| `words.txt` | 740k forms, 8.6 MB | nothing yet (future korsordshjälp) |
| `words9.txt` | 240k forms, 538 KB gz | Wordfeud rack solver |
| `words5all.txt` | 13 779 forms | validating a guess in Dagens ord |
| `words5.txt` | 952 curated | picking the daily answer |

SALDO and Kelly are **CC BY 4.0** (Språkbanken Text, Göteborgs universitet).
Attribution lives on `/om/`, linked from every page footer — see CLAUDE.md.

## Layout

```
site/_layout.html     shared shell: head, header, footer, consent, ad tag
site/pages/**         one file per route, each with a <!--meta --> block
site/assets/          css, js, self-hosted fonts (6 faces, latin subset)
site/data/            generated word lists — do not hand-edit
tools/build.py        the whole build; stdlib only
tools/build-wordlist.py
tools/test.js         node:test, no framework
docs/design/          Claude Design handoffs + mockups (visual source of truth)
docs/superpowers/     original design spec with the keyword research
```

Adding a page = adding one file under `site/pages/`. The build derives the
route from the path, and the sitemap from the routes.

## Deploying elsewhere

The build takes `BASE_URL`, `BASE_PATH` and `CNAME` from the environment, so
the same source serves a root domain or a project subpath. See CLAUDE.md for
the empty-env-var trap before you touch this.
