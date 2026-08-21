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
node --test tools/test.js         # 17 checks; CI runs this before every deploy
cd dist && python3 -m http.server 8765
```

Deploy is automatic: push to `main`, GitHub Actions builds and publishes.
There is nothing to run by hand.

Word lists are regenerated only when Språkbanken publishes new data:

```bash
curl -O https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/saldom/saldom.xml
curl -O https://svn.spraakbanken.gu.se/sb-arkiv/pub/lexikon/kelly/kelly.xml
python3 tools/build-wordlist.py saldom.xml kelly.xml site/data/
```

## Layout

```
site/_layout.html     shared shell: head, header, footer, consent-mode, ad tag
site/pages/**         one file per route, each starting with a <!--meta --> block
site/assets/          css, js, self-hosted fonts (6 faces, latin subset only)
site/data/            generated word lists — do not hand-edit
tools/build.py        the whole build; stdlib only, no dependencies
tools/test.js         node:test, no framework
docs/design/          Claude Design handoff — the source of truth for visuals
docs/superpowers/     the original design spec, with the keyword research
```

Adding a page means adding one file under `site/pages/`. The build derives
the route from the path, and the sitemap from the routes.

## Gotchas that have already bitten

**Empty env vars beat defaults.** GitHub Actions expands an unset repo
variable to `""`, and `os.environ.get("X", default)` returns the empty
string, not the default. This shipped relative canonicals and an invalid
sitemap to production once. Always `os.environ.get("X") or default`. The
build now refuses to run if `BASE_URL` is not absolute, and a test
reproduces the CI case.

**GitHub Pages caches for 10 minutes.** After a successful deploy the old
page is still served (`cache-control: max-age=600`). Do not diagnose a
"failed" deploy inside that window — check `age:` in the response headers
first.

**Certificate provisioning does not retry.** If the custom domain is set
while DNS is still propagating, GitHub silently fails to request the
certificate and never tries again. The fix is to remove and re-add the
custom domain, which forces a fresh request. Symptom: `https_certificate`
is `null` and the server presents a `*.github.io` cert.

**`site/data/words.txt` is 8.6 MB.** Only the solvers load word lists, and
only lazily. `words9.txt` (538 KB gzipped) serves the Wordfeud rack solver;
never load the full list on a page that does not need it.

## Consent and ads

**Google's certified CMP owns consent. Do not add a consent banner.** There
was a hand-rolled one; it was removed when Google's CMP went live, because
two banners appeared and our code granted consent the CMP had never
collected.

What remains, and must stay:

- Consent Mode v2 defaults (`denied`) in `<head>`, set **before** the
  AdSense tag. Google's CMP takes over the updates.
- The footer "Cookieinställningar" button calls
  `googlefc.showRevocationMessage()` and stays hidden unless the CMP loaded.

**Ad slots are authored as sized placeholder divs** (`<div class="ad
ad-336x280">`) and `tools/build.py` injects the real `<ins>` inside them at
build time. Keep that indirection — the wrapper's fixed height is what
keeps CLS at 0 whether or not an ad fills.

**One `adsbygoogle.push()` per `<ins>`.** Pushing twice for the same element
is a policy violation. `window.mountAd()` in `app.js` guards this; dynamic
slots (the solver builds one) must go through it.

**ads.txt uses `pub-…`, never `ca-pub-…`.** The `ca-` prefix produces
"Obehörig", which is worse than having no file at all — AdSense then
refuses to serve. There is a test for exactly this.

**Never place an ad inside, over, or adjacent to a play area, and never
between moves.** This is a policy risk and it destroys retention. Auto Ads
is deliberately off for the same reason; leave it off.

## Design rules

`docs/design/HANDOFF.md` holds the full token set and per-screen specs.
Follow it rather than improvising. The rules most easily broken:

- **Colour is never the only signal.** Word-game tiles carry `✓ → ×` corner
  marks; sudoku conflicts carry `△`. The audience skews 45+ and the
  green/yellow word-game palette is the worst case for colourblindness.
- **Minimum product text 17px, body 19px, tap targets ≥ 48×48px.** Never
  13px. Same reason.
- **Light and dark both**, via `:root` tokens and a `[data-theme]` override.
  The theme is set before first paint to avoid a flash.
- Honour `prefers-reduced-motion`.

## Content and licensing

Word lists derive from **SALDO** and the **Kelly list** (Språkbanken Text,
Göteborgs universitet), both CC BY 4.0. **The attribution in the site footer
is a licence condition — do not remove it.**

Two 5-letter lists exist for opposite reasons: `words5.txt` (952 curated
common answers) is what the daily game can pick, and `words5all.txt` (13 779
valid forms) is what a guess is validated against. Rejecting a word the
player knows is real is the fastest way to lose them.

Articles under `site/pages/artiklar/` are not filler. AdSense rejects
tool-only sites as "low value content"; the written pages are the
mitigation, and they carry long-tail search traffic.

## Not built yet

Minsvepare, mahjong, patiens, minnesspel and 2048 — briefed in
`docs/design-brief-games.md`, awaiting design. Minsvepare is the priority:
40 500 searches/month at CPC 8.68, worth more than the other four combined.

Also unbuilt: board-aware Wordfeud solving (v1 solves a rack only), and
korsordshjälp (would use the full `words.txt`).
