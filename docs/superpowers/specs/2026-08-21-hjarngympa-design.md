# hjarngympa.se — design

**Date:** 2026-08-21
**Status:** approved, ready for implementation planning

## Purpose

A Swedish puzzle-and-word-tool site monetised with Google AdSense. The
revenue model is passive: build once, maintain rarely, earn from ad
impressions on high-volume search traffic.

The site exists because of a specific gap found in search data (see
Evidence). Swedish puzzle games and word-solver queries carry large,
recurring search volume, and the pages that rank for them are dated hobby
sites with no brand behind them.

## Why this niche

AdSense revenue is impressions × RPM. Article sites average ~1.2 pageviews
per session; puzzle sites average 15–40. That multiplier, not CPC, is the
reason this niche was chosen over five alternatives that had higher CPC or
higher volume.

### Evidence

All figures from DataForSEO, Sweden/Swedish, August 2026. Difficulty is
DataForSEO's 0–100 keyword difficulty. Volume is monthly searches.

**Games**

| Keyword | Volume | Difficulty | CPC (€) |
|---|---|---|---|
| ordle | 301 000 | 18 | 1.73 |
| sudoku | 110 000 | 73 | 0.59 |
| minesweeper | 40 500 | 54 | 8.68 |
| sudoku online | 12 100 | 63 | 0.69 |
| sudoku gratis | 12 100 | 14 | 0.61 |
| korsord gratis | 8 100 | 23 | 0.77 |
| mahjong gratis | 8 100 | 1 | 0.09 |
| frågesport | 6 600 | 0 | 2.75 |
| solitaire online | 3 600 | 77 | 0.65 |
| korsord online | 3 600 | 23 | 1.64 |
| patiens online | 1 600 | 21 | 0 |
| sudoku expert | 1 300 | 0 | 6.66 |
| hjärngympa | 1 000 | 0 | 0.66 |
| minnesspel | 260 | 0 | 0.75 |

**Solvers**

| Keyword | Volume | Difficulty | CPC (€) |
|---|---|---|---|
| korsordslexikon | 14 800 | 22 | 0 |
| wordfeud hjälp | 14 800 | 5 | 0 |
| wordfeud ordlista | 1 300 | 0 | 0 |
| korsordshjälp synonymer | 880 | 1 | 0 |
| anagram lösare | 140 | 9 | 0 |

Solver CPC is 0.00 across the cluster — nobody advertises there. Solvers
are therefore a traffic and internal-linking asset, not a revenue centre.
The revenue comes from pillar A.

### SERP verification

Difficulty scores were not trusted on their own. Live top-10 SERPs were
pulled for the decisive terms:

- `ordle` — ordel.se, ordlig.se, ordsnille.brusman.se. Indie hobby sites,
  no brand in the top 10.
- `wordfeud hjälp` — kjell.haxx.se (a personal homepage) at #1, then
  fuska.se, wordfeudfusk.com.se.
- `sudoku gratis` — sudokus.se, sudoku.com, dn.se. **Contested.** We
  target the long tail here, not the head.

This check also killed a candidate: `bmi räknare` (49 500/mo) and `ränta
på ränta` (27 100/mo) both scored difficulty 0, but their live SERPs are
held by Aleris/Kry/Capio and rikatillsammans/Ekonomifakta/SEB. The
difficulty score is unreliable on YMYL SERPs.

## Domain

`hjarngympa.se` — confirmed unregistered against the IIS registry
(`whois.iis.se`), not a registrar sales page.

Also acquire `hjärngympa.se` (`xn--hjrngympa-w2a.se`, also confirmed free)
and 301 it to the plain-ASCII domain. Swedes type the ä; owning only the
ASCII form leaks traffic.

Do not buy a registrar bundle that ties a free first-year domain to a
website-builder subscription. The site is static and hosted free.

**Known tension:** the brand fits pillars A and C but not B. Someone
searching `wordfeud hjälp` wants a cheat tool, not brain training. v1
handles this with a clearly-labelled `/verktyg/` section. If pillar B
outgrows the brand, move it to its own subdomain or domain.

## Architecture

Static site, **Astro**, deployed to **Cloudflare Pages**. No backend, no
database, no server, no running cost.

Astro over a hand-rolled generator: at ~40 pages across three content
types it provides static HTML output, zero-JS-by-default, and sitemap
generation from a single dependency. Games attach as plain `<script>`
islands.

Every game and every solver runs entirely client-side. No API means no
rate limits, no server bill, and no operational surface.

## Pillar A — Games

One game per page, each on its own URL.

| Route | Primary keyword |
|---|---|
| `/dagens-ord/` | ordle |
| `/sudoku/` | sudoku, sudoku gratis |
| `/minsvepare/` | minesweeper |
| `/mahjong/` | mahjong gratis |
| `/patiens/` | patiens online |
| `/minnesspel/` | minnesspel, memory |
| `/2048/` | 2048 spel |

`/2048/` earns its place as cheap cross-link inventory, not for its own
volume.

**Daily word game determinism:** `puzzle = f(date)`, indexing a
pre-shuffled word list committed at build time. Same puzzle for every
visitor on a given day, with no backend. Streaks in `localStorage`.

## Pillar B — Verktyg

| Route | Primary keyword |
|---|---|
| `/verktyg/wordfeud-hjalp/` | wordfeud hjälp |
| `/verktyg/korsordshjalp/` | korsordslexikon |
| `/verktyg/anagram/` | anagram lösare |

All three read one shared word list.

**Scope:** v1 solves a *rack* — which words can be formed from a set of
letters, with wildcard and pattern support. Full board-aware Wordfeud
placement is explicitly out of scope for v1; the incumbents ranking today
do not do it either.

## Pillar C — Innehåll

12–15 substantive articles. This pillar is **not optional**: AdSense
rejects tool-only sites under its "low value content" policy, and pillar C
is the mitigation.

Topics double as long-tail targets and as internal links into the games:
sudokuregler and solving techniques (`sudoku regler`, `sudoku expert` at
CPC 6.66), Wordfeud strategy and opening words, a crossword-solving guide,
and what the research actually says about brain training.

## Data pipeline

Build-time only. Runs once, and again when SALDO updates.

```
SALDOM (CC BY 4.0)
  → expand to full inflected forms
  → filter: a-ö only, no proper nouns, no abbreviations, length 2–15
  → words.txt   (~600k forms, powers all three solvers)
  → words5.txt  (5-letter, frequency-ranked via the Kelly-list)
```

`words5.txt` must be frequency-ranked. A daily word game built on obscure
inflected forms is unfair, and players leave — which destroys the
pageviews-per-session multiplier the whole business case rests on.

Both files ship as gzipped static assets. The solver precomputes a
letter-count signature per word at build time and brute-force filters in
JS: under 100 ms for 600k words. No DAWG — the simpler structure is fast
enough at this size.

**Licence:** SALDO and SALDOM are distributed by Språkbanken Text under
Creative Commons Attribution 4.0. Commercial use is permitted with
attribution. Footer must carry: *"Ordlista baserad på SALDO, Språkbanken
Text, CC BY 4.0."*

This resolves the single largest legal risk in the project. SAOL is
copyrighted and is not used.

## AdSense

**Before applying:** pillar C live, privacy policy, cookie consent with
**Consent Mode v2** (mandatory for EU traffic), about and contact pages.

**Placement:** sidebar, below-the-fold, and between-puzzle slots.

**No in-game overlays.** They are a policy risk and they destroy the
retention that makes this niche worth entering.

## Testing

One runnable check per piece of non-trivial logic, using `node:test`. No
framework, no fixtures.

- Sudoku generator produces grids with exactly one solution
- Solver returns the correct word set for known racks
- Daily puzzle is stable across a date boundary and advances by exactly
  one at midnight

## Risks

1. **Google sandbox.** 3–6 months before meaningful traffic. Nothing
   shortens this. Plan for it rather than around it.
2. **AdSense rejection.** Possible on first pass regardless of pillar C.
3. **`sudoku gratis` is contested** by sudoku.com and dn.se. The head term
   is not winnable; the long tail is.
4. **`ordle` is effectively a brand query.** ordel.se ranks #1 on it, so
   it is demonstrably winnable, but it is not ours by right.
5. **Revenue is modest.** At ~50 000 sessions/month, with the games'
   pageview multiplier, expect roughly 3 000–8 000 kr/month. Passive once
   built, but a side income, not a business.

## Out of scope for v1

- Board-aware Wordfeud solving
- User accounts, leaderboards, cross-device streaks
- Any server-side component
- Additional languages or markets
