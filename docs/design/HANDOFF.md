# Handoff: hjarngympa.se — pussel- och ordspelssajt (5 skärmar)

## Overview
Static Swedish puzzle/word-game site, funded entirely by Google AdSense. Three page types under one brand: **Spel** (playable games), **Verktyg** (word solvers), **Artiklar** (written articles). No login, no accounts, no server. All copy is Swedish.

This bundle documents five screens — Startsida, Dagens ord, Sudoku, Verktyg/wordfeud-hjälp, Artikel — each in mobile (390 px) and desktop (1280 px), light and dark mode, with ad slots drawn into the layout at real IAB sizes.

## About the Design Files
`Hjärngympa.dc.html` (+ its runtime `support.js`) is a **design reference created in HTML** — a single page containing 15 static mockup frames side by side on a zoomable canvas. It is not production code and is not the site structure. The task is to **recreate these designs in the target codebase's environment** (plain HTML/CSS + vanilla JS is a perfectly good fit for a static, fast, ad-funded site; Astro/11ty/Next static export also fine) using that project's established patterns. Open the HTML file directly in a browser to inspect any frame; every value below is readable from it.

The frames are laid out in this order: spec sheet (tokens/type/spacing/states), then 01 Startsida, 02 Dagens ord, 03 Sudoku, 04 Wordfeud-hjälp, 05 Artikel. Each frame is captioned with device width and mode.

## Fidelity
**High fidelity.** Final colours, type, spacing, tile/cell states and ad geometry. Recreate pixel-close. The frames are static — no game logic is implemented; behaviour is specified in prose below.

---

## Design Tokens

### Colour — light
| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#F6F2EA` | page background (warm paper) |
| `surface` | `#FFFFFF` | cards, header, board, keys |
| `ink` | `#1E1A15` | primary text, sudoku block borders |
| `muted` | `#6C6358` | secondary text, meta, mono labels |
| `line` | `#E3DCD0` | hairlines, card borders, key borders |
| `accent` | `#B4531F` | primary actions, active state, links |
| `accent-ink` | `#FFFFFF` | text on accent |
| `ok` | `#4C6B3C` | correct tile, points, streak |
| `near` | `#B98A22` | wrong-position tile border |
| `near-soft` | `#F8EFDA` | wrong-position tile fill |
| `near-ink` | `#5A4413` | text on `near-soft` |
| `absent` | `#9A9186` | absent tile/key text |
| `absent-fill` | `#EDE8DE` | absent tile/key fill |
| `sel` | `#F1E6D9` | sudoku selection + peer highlight, selected chip |
| `grid` | `#D6CEBF` | sudoku 1 px cell lines |
| `error` | `#A2331A` | sudoku conflict ink + border |
| `error-fill` | `#F6E2DB` | sudoku conflict fill |

### Colour — dark
| Token | Hex |
| --- | --- |
| `bg` | `#151210` |
| `surface` | `#1F1B17` |
| `ink` | `#F1ECE3` |
| `muted` | `#A69C90` |
| `line` | `#352E26` |
| `accent` | `#E58A46` |
| `accent-ink` | `#1B1410` |
| `ok` | `#6F9A55` (text on it: `#0F1A0A`) |
| `near` | `#C69B36` |
| `near-soft` | `#312817` |
| `near-ink` | `#E8C67A` |
| `absent` | `#5F574E` |
| `absent-fill` | `#241F1A` |
| `sel` | `#2A241D` |
| `grid` | `#3A322A` (sudoku block borders in dark: `#6B6055`) |
| `error` ink | `#F2907A`, border `#C4553A`, fill `#33201B` |

Implement as CSS custom properties on `:root` with a `[data-theme="dark"]` override; respect `prefers-color-scheme` on first load and persist the user's toggle in `localStorage`.

### Type
Families: **Newsreader** (serif — headings, numerals in result panels, pull quotes), **Source Sans 3** (UI, body), **IBM Plex Mono** (meta, timers, ad labels, solver words).

| Role | Size / family |
| --- | --- |
| display | 46 px Newsreader 600, line-height 1.05 (mobile 36–38) |
| h1 | 34 px Newsreader 600 (article desktop 52 px, line-height 1.08) |
| h2 | 26–32 px Newsreader 600 |
| h3 | 21 px Source Sans 3 600 |
| body | 19–20 px Source Sans 3 400, line-height 1.65–1.7 |
| lead | 23–26 px Newsreader 500, line-height 1.5 |
| small | 17–18 px |
| micro | 14–15 px IBM Plex Mono, letter-spacing .06–.1em, uppercase |

**Minimum product text size 17 px; body 19 px.** Never 13 px. All tap targets ≥ 48 × 48 px.

### Spacing (px)
`4, 8, 12, 16, 24, 32, 48, 64` — 4 within components, 8 between tiles/keys, 16 mobile page gutter, 24 between blocks, 32 around the play area, 48 desktop sections/gutters, 64 before/after ads.

### Radius / elevation
8 tiles and number-pad keys · 10–12 cards, inputs, control buttons · 14 large panels · 999 pills and primary buttons · 26 mobile device frame (mockup only). Borders do the work; shadows only on the mockup frames, not in product.

---

## Ad slots (hard requirement)
Ad slots are layout, not an afterthought. **Never inside, over or adjacent to the play area. No interstitials between moves. No ad below the mobile keyboard.**

| Slot | Size | Placement |
| --- | --- | --- |
| Above the game, mobile | 320 × 100 | Below the header, above the title. Reserve the height so nothing shifts on load. The play area must still start within the first viewport. |
| Above the game, desktop | 728 × 90 | Inside the header bar, right of the nav. Never between title and board. |
| Sidebar, desktop | 300 × 600 (or 300 × 250 stacked) | Right column of a `1fr 300px` grid, ≥ 32 px from the play area. Hidden entirely below 1024 px. |
| Between rounds | 336 × 280 | In the result panel after a finished puzzle, before the "next" action. |
| Mid-article | 300 × 250 | Between two paragraphs, centred on desktop; never inside a sentence or list. |
| After first result group (solver) | 300 × 250 | Mobile solver, after the 7-letter group. |

In the mockups each slot is a dashed 1 px `line` box with a 45° 8/16 px stripe fill (`rgba(0,0,0,.035)` light, `rgba(255,255,255,.04)` dark) and a centred mono 12 px label: `ANNONS` + the size.

---

## Screens

### 1. Startsida
**Purpose:** route a search visitor to a game in one tap.
Mobile: header (wordmark `hjärngympa` 24 px Newsreader; two 48 px round icon buttons — theme, menu) → 320 × 100 ad → date in mono + h1 "Vad vill du gympa idag?" → **Dagens ord card** (surface, 2 px accent border, radius 12: title, `🔥 12 dagar` in `ok`, five 38 px preview tiles, 56 px accent pill "Spela dagens omgång") → "Spel" 2-col grid of six 12 px-radius cards, min-height 96, glyph + name (Sudoku, Minsvepare, Mahjong, Patiens, Minnesspel, 2048) → "Verktyg" list, three rows, 18/16 padding, title + one-line description + accent `→` → "Läs" two article teasers (Newsreader 22 px + reading time).
Desktop: header bar (wordmark, nav Spel/Verktyg/Artiklar 19 px, 728 × 90 ad pushed right, theme button), body `1fr 300px` grid with 48 px gap and padding: hero row = Dagens ord card (1.15fr) + 2×3 game grid (1fr); then Verktyg 3-col; then Läs 3-col. Sidebar: 300 × 600 ad.

### 2. Dagens ord (daily word game)
Board: 6 rows × 5 tiles, 60 px mobile / 72 px desktop, gap 8/10, radius 8.
States (colour is never the only signal):
- **empty** — 2 px `line` border, `surface` fill
- **active row** — 2 px `accent` border; the cursor tile 3 px `accent`
- **correct** — 3 px solid `ok` border + `ok` fill, white text, corner mark `✓`
- **wrong position** — 3 px **dashed** `near` border, `near-soft` fill, `near-ink` text, corner mark `→`
- **absent** — 2 px `line` border, `absent-fill` fill, `absent` text, corner mark `×`
Corner marks sit top-right, 13–15 px. They are toggleable in the mock (`signalStyle`) purely to demo the colour-only case — ship them on.
Header: back, title, theme, help (all 48 px). Meta row in mono: `OMGÅNG 612 · FÖRSÖK 3 / 6 · 🔥 12`.
On-screen keyboard (mobile), Swedish layout, three rows on `surface` with a top hairline: `QWERTYUIOPÅ` / `ASDFGHJKLÖÄ` / `GÅ ZXCVBNM ⌫`. Keys 30–32 × 52 px, radius 6; `GÅ` is 56 px wide accent, `⌫` 56 px outline. Keys carry the same ok/near/absent treatment as tiles (dashed border for near). Note under the keyboard: physical keyboard also works. Desktop shows no on-screen keyboard — instead a mono hint line: `Skriv med tangentbordet · ENTER för att gissa · BACKSTEG för att radera`.
**Result panel** (shown after a solve, dark mockup): condensed board recap (44 px tiles), h2 "Snyggt jobbat!", "Ordet var **SKÖLD** — löst på 3 försök", three stat boxes (dagar i rad / lösta % / snitt, Newsreader 30 px numerals), accent pill "Dela resultat" + 56 px outline icon button, mono countdown `Nästa ord om 09:41:22`, then the 336 × 280 between-rounds ad, then a 56 px outline cross-link ("Spela sudoku istället →").
Keyboard support: A–Z + Å Ä Ö type, Enter submits, Backspace deletes; invalid word = shake + inline message (no colour-only feedback).

### 3. Sudoku
9 × 9 grid, `surface`, 3 px outer border in `ink` (dark: `#6B6055`), 1 px `grid` cell lines, 2 px `ink` lines between 3 × 3 blocks. Cells are square (`aspect-ratio: 1`), digits 22 px mobile / 30 px desktop.
Cell states: **given** 700 weight `ink` · **entered** 500–600 weight `accent` · **selected** 3 px `accent` box-shadow inset + `sel` fill · **peer** (same row/col/block) `sel` fill · **conflict** 3 px inset `error` border + `error-fill` + `error` digit + small `△` bottom-right · **pencil marks** 3 × 3 mono grid, 10 px mobile / 13 px desktop, `muted`.
Controls: difficulty pills (Lätt / Medel / Svår / Expert, 48 px, active = accent fill); meta row `⏱ 07:14 · Fel 1 · Lätt · #4821`; a 3-up control row (↺ Ångra / ✎ Blyerts / ⌫ Radera — Blyerts active = 2 px accent border + `sel` fill + accent text); number pad 1–9 (mobile: one row of nine, 64 px tall; desktop: 3 × 3, 72 px), selected digit filled accent.
Desktop layout: `640px 1fr 300px` grid, 48 px gaps — board, control column (difficulty pills, a stats card TID/FEL/KVAR in mono 19 px, controls, number pad, mono keyboard legend), then two stacked 300 × 250 ads.
Keyboard: arrows move the cursor, 1–9 fill, 0/Delete clears, `P` toggles pencil, Ctrl/Cmd+Z undoes.

### 4. Verktyg / wordfeud-hjälp
Purpose: hurried Wordfeud players. Search must be reachable without scrolling.
Mobile: header → search block on `surface` with bottom hairline: helper line ("Skriv dina brickor. `*` eller `?` för blank."), 64 px input with 2 px accent border, mono 28 px, letter-spacing .16em, value `GATRSN*`, clear `✕`; filter pills (Innehåller… / Slutar på… / Max längd, 44 px); 60 px accent pill "Sök ord". Then mono count `418 ORD · SORTERAT PÅ POÄNG`, then results grouped by length: group header 19 px 600 with a 2 px `ink` underline (`7 bokstäver · 12 ord`), rows 16 px vertical padding separated by `line` hairlines — word in mono 23 px letter-spacing .06em, right side `+50 bingo` in `muted` and points in 23 px 700 `ok`. The 300 × 250 ad sits after the first group. Footer: 56 px outline "Visa fler ord".
Desktop: `1fr 300px`; h1 + subtitle, search card (radius 14, 28 px padding) with 72 px input + 40 px-padded accent "Sök" button and a filter row (active filter = accent border + `sel` fill), then results in two columns (7 and 6 letters). Sidebar 300 × 600.

### 5. Artikel
Measure 700 px on desktop (mobile: 20 px gutters). Order: mono kicker `ARTIKLAR · SUDOKU` → h1 (Newsreader 52 px desktop / 36 px mobile, `text-wrap: pretty`) → byline `Uppdaterad 12 augusti 2026 · 6 min läsning` with a bottom hairline → lead (Newsreader 26 px 500) → mobile only: 320 × 100 ad → body paragraphs 20 px/1.7 → h2s in Newsreader 32 px → pull quote: 3 px `accent` left border, 24 px left padding, Newsreader 28 px italic → mid-article 300 × 250 ad (centred) → more body → CTA card ("Testa direkt" + accent pill "Spela sudoku"). Desktop sidebar: 300 × 600 ad, CTA card, "LÄS OCKSÅ" list of two Newsreader 22 px links.

---

## Interactions & behaviour
- **Theme toggle** in every header (☾ light → ☀ dark). Persist to `localStorage`; no flash of wrong theme on load.
- **Responsive**: single column, 16 px gutters below 768 px; sidebar ads removed (not merely hidden) below 1024 px; ad heights always reserved to prevent CLS.
- **Focus visible** everywhere: 3 px `accent` outline offset 2 px. Full keyboard operation of both games (see per-screen notes).
- **Motion**: tile reveal flip 180 ms ease-out staggered 80 ms per tile; conflict shake 160 ms; everything else ≤ 150 ms. Honour `prefers-reduced-motion` by replacing flips with instant state changes.
- **Announce state changes** to screen readers (`aria-live`): tile results as words ("rätt plats", "fel plats", "finns inte"), sudoku conflicts, solver result counts.
- **Empty/error states**: solver with no hits → "Inga ord matchar dina brickor" + suggestion to remove a filter; invalid guess → inline message above the keyboard.

## State
Word game: `answer`, `guesses[]`, `currentGuess`, `status`, `stats {streak, played, solved, distribution}`, `lastPlayedDate` (all client-side in `localStorage`; daily puzzle derived from the date).
Sudoku: `puzzle`, `board`, `pencil{}`, `selected`, `difficulty`, `errors`, `elapsed`, `undoStack`.
Solver: `letters`, `filters`, `results` (from a bundled Swedish word list; no server).

## Assets
None. No photos, no icon set, no hero media — glyphs in the mockups (`▦ ✦ ▤ ♠ ◈ ☾ ☀ ↺ ✎ ⌫ △ →`) are placeholders for a small inline SVG icon set the developer supplies. Fonts: Newsreader, Source Sans 3, IBM Plex Mono (Google Fonts; self-host for speed).

## Files
- `Hjärngympa.dc.html` — all 15 mockup frames + the visual spec sheet (colour swatches, type scale, spacing scale, tile states, sudoku cell states, ad-slot rules). Open in a browser; pan/zoom the canvas.
- `support.js` — runtime needed to render that file. Not part of the product.
