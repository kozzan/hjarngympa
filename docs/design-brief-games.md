# Design brief — hjärngympa, five more games

Paste everything below the line into Claude Design.

---

Design five more games for **hjarngympa.se**, a Swedish puzzle site that is
already live. Everything is in Swedish. Static site, no login, no server —
every game runs client-side in the browser.

**This extends an existing design system. Do not invent a new one.** Two
games (Dagens ord, Sudoku) and a word solver already ship with the tokens
below. Reuse them exactly; only add what a new game genuinely needs.

## The existing system

**Colour — light**
`bg #F6F2EA` · `surface #FFFFFF` · `ink #1E1A15` · `muted #6C6358` ·
`line #E3DCD0` · `accent #B4531F` · `accent-ink #FFFFFF` · `ok #4C6B3C` ·
`near #B98A22` / `near-soft #F8EFDA` / `near-ink #5A4413` ·
`absent #9A9186` / `absent-fill #EDE8DE` · `sel #F1E6D9` · `grid #D6CEBF` ·
`error #A2331A` / `error-fill #F6E2DB`

**Colour — dark**
`bg #151210` · `surface #1F1B17` · `ink #F1ECE3` · `muted #A69C90` ·
`line #352E26` · `accent #E58A46` · `accent-ink #1B1410` · `ok #6F9A55` ·
`near #C69B36` / `near-soft #312817` / `near-ink #E8C67A` ·
`absent #5F574E` / `absent-fill #241F1A` · `sel #2A241D` · `grid #3A322A` ·
`error #F2907A` / `error-fill #33201B` / border `#C4553A`

**Type** — Newsreader (serif, headings and big numerals), Source Sans 3
(UI and body), IBM Plex Mono (meta rows, timers, ad labels).
Body 19px, minimum product text 17px, micro 14–15px mono uppercase.
**Never 13px.** All tap targets ≥ 48×48px.

**Spacing** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
**Radius** 8 tiles/keys · 12 cards · 14 panels · 999 pills.
Borders do the work; no shadows in product.

**Existing page shell** — sticky header (wordmark, nav, 48px theme toggle),
centred `.game` column max 560px, `h1`, a mono meta row
(`LÄTT · #4821 · FEL 0 · 41 KVAR`), the play area, then controls, then a
mono keyboard-hint line. Every new game uses this same skeleton.

## The five games

Each gets its own page. Ranked by search volume — Minsvepare matters most
by a wide margin, so give it the most attention.

| Route | Game | Notes |
|---|---|---|
| `/minsvepare/` | Minesweeper | **Highest priority.** Also the highest-earning page on the site. |
| `/mahjong/` | Mahjong solitaire | Hardest layout problem. See below. |
| `/patiens/` | Klondike patience | Drag-and-drop on touch. |
| `/minnesspel/` | Memory / pairs | Simplest. |
| `/2048/` | 2048 | Small; mostly cross-link inventory. |

## Hard constraints, carried over

**Ad slots are layout, not decoration.** Same rules as the live site: a
320×100 above the game on mobile, a 336×280 at least 40px *below* the last
interactive row on desktop, a 300×600 desktop sidebar, and a 336×280 in the
result panel after a finished game. Draw them as sized placeholders.
**Never inside, overlapping, or adjacent to the play area, and never an
interstitial between moves.** Reserve every height so nothing shifts.

**Colour is never the only signal.** This is the single most important rule
and it is where each of these games traditionally fails:

- **Minsvepare** — the classic 1–8 number colours are pure colour-coding.
  The digit itself already carries the meaning, so make the digit the
  primary signal: strong weight, high contrast, colour as reinforcement
  only. Flagged, revealed-empty, mine and wrongly-flagged cells each need a
  distinct **shape or glyph**, not just a fill.
- **Mahjong** — a free tile versus a blocked tile must differ by more than
  brightness. Use border weight or a lift/inset treatment.
- **Patiens** — red versus black suits must not be the only way to read a
  card; suit glyphs must be large enough to distinguish at a glance.
- **Minnesspel** — matched pairs need a mark, not just a colour wash.

**Older audience.** "Hjärngympa" means brain training and pulls a 45+
crowd. Large targets, legible at arm's length, no dense micro-UI.

**Mobile-first, portrait.** Most traffic. Desktop is the widescreen
adaptation, not the reverse.

**Light and dark, both.** People play these at night.

**Keyboard support** on everything that can take it, with a visible focus
ring (3px accent, offset 2px). Honour `prefers-reduced-motion`: replace
flips and slides with instant state changes.

## The specific design problems

These are the parts I actually need decisions on — please don't skip them.

**Minsvepare grid sizing.** Classic sizes are 9×9, 16×16 and 30×16. The
last two cannot fit a 390px portrait screen at 48px targets. Decide and
show: which sizes ship, and what happens on mobile — smaller boards only, a
scrollable/zoomable board, or a reduced "expert" size? Also solve
**flag versus reveal on touch**: long-press, or an explicit mode toggle
that stays visible and obvious? Show the toggle.

**Mahjong on a phone.** 144 tiles in a layered turtle layout is the hardest
thing in this set. At 390px wide a full board makes each tile roughly 25px,
which breaks both the tap-target rule and legibility. Show your answer:
pan-and-zoom, a genuinely smaller layout for mobile, or something else.
Also decide how tile faces are drawn — Unicode mahjong glyphs (🀇🀈🀉) render
inconsistently across platforms, so a small inline SVG set is probably
needed. Show the tile face design.

**Patiens drag on touch.** Dragging cards on a phone is fiddly and error
prone. Consider tap-to-select then tap-to-place as the primary interaction,
with drag as a bonus. Show the selected-card state and valid-target
affordance. Also show the fanned tableau spacing that keeps rank and suit
readable when cards overlap.

**Result panels.** Every game needs win and loss states matching the
existing Dagens ord result panel: heading, one-line outcome, three stat
boxes (Newsreader numerals), an accent pill for "play again", the 336×280
ad, and an outline cross-link button to another game. Show one worked
example and note the per-game differences.

## Deliverable

Mockups of all five games, mobile (390px) and desktop (1280px), light and
dark, with ad placeholders sized and visible. Plus:

- Every cell/tile/card **state** drawn explicitly, with its non-colour signal
- The win and loss result panel
- Any new tokens you had to add, named in the existing style
- A short note per game on what a developer must not get wrong

Do not restate the token values I gave you — assume them.
