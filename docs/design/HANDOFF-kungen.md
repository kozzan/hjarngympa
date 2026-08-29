# Handoff: Kungen (FreeCell) — `/kungen/`

## How to use this package (read first)

**Prompt for Claude Code:**

> Implement `/kungen/` for hjarngympa.se from `README-kungen.md` in this folder. Read `README.md` (base system) and `README-fem-nya-spel.md` (games layer) first — Section 3, Patiens, is the closest reference and Kungen reuses its cards, `felt`, `card-face`, `edge`, `hatch`, tap-to-select and the red-suit underline verbatim. **Extend the existing system; add no new tokens.** Open `Kungen.dc.html` in a browser to see the frames; it is a design reference, not production code — recreate it in this codebase's own patterns. Build the three specified solutions exactly as described: the two-bank tableau at ≤ 1023 px, the persistent supermove meter with its spoken refusal, and the free-cell/foundation distinction. Copy is Swedish, taken verbatim from the frames where given.

Read order: `README.md` → `README-fem-nya-spel.md` → this file. Everything in the first two applies unchanged; only what differs from Klondike is new work here.

**Fidelity: high.** Static frames, no game logic. Every frame in `Kungen.dc.html` is captioned with device width and mode: 320 light (selection), 390 dark (refusal + all cells full), 1280 light (full page), a states panel, and the win / locked result panels.

## What Kungen is
FreeCell — not the Klondike already at `/patiens/`. All 52 cards dealt face up, no stock, no waste, nothing hidden. **8 tableau columns**, **4 free cells** top left (one card each, any card), **4 foundations** top right (ace → king, one per suit). Tableau builds **down in alternating colour**; an **empty column takes any card** (not kings-only). Near-every deal is winnable with correct play — the page should feel calm and deliberate, never tense. The h1 is "Kungen"; the subtitle names it: "Även kallad FreeCell".

## New tokens
**None.** `felt`, `card-face`, `edge`, `hatch`, `sel`, `accent`, `ok`, `near`, `error`, `absent` cover everything. Shared pieces reused as-is: `.result`, `.seg`, `.gamectl`, `.diffs`. The `.frame` zoom container is deliberately **not** used — nothing here shrinks below 40 px.

---

## Problem 1 — eight columns on a 320 px phone

**Two banks of four columns, stacked.** The card does not shrink: **46 × 64 px at 320**, **52 × 72 px at 390** — the same card as `/patiens/`. Four columns need 4 × 46 + 3 × 6 = 202 px, comfortably inside the 276 px of felt available at 320. Bank A–D sits above bank E–H with 20 px between them and a mono label per bank (`KOLUMN A–D`, `KOLUMN E–H`).

Why not horizontal scroll: in FreeCell every card is information and a move often runs between column 2 and column 7. Side-scrolling would hide half the board at exactly the moment the player is planning. Stacking costs height, and vertical scroll is the gesture the phone already owns.

At **≥ 1024 px** the board returns to **one row of eight** with 88 × 124 px cards.

Fan spacing is unchanged from Handoff §3: **34 px of visible edge per overlapped card** (48 px at desktop), top card at full height. One exception, and implement it — the card **directly above a lifted selection gains 6 px** so the 6 px lift doesn't eat into its strip and clip its suit glyph.

The top row (cells + foundations) **also stacks below 360 px**: free cells on one line, a 1 px divider, foundations on the next, cells 60 × 48 px. Side by side they need 295 px and do not fit. At 390 px and up they sit side by side with a 24 px gap and a vertical 1 px divider.

## Problem 2 — the supermove, made legible

Formula: **(free cells + 1) × 2^(empty columns)**.

**A quiet, permanent meter** sits between the cells and the board, and is the same element on every breakpoint: a bordered `surface` strip reading **"Du kan flytta 3 kort"** with the arithmetic spelled out in mono beneath — `(2 FRIA CELLER + 1) × INGEN TOM KOLUMN`. It recomputes on every move, so the player watches the resource grow and shrink instead of guessing. At 320 the label and the formula each keep their own line — the indicator must never lose its own text at the narrowest width. Desktop places it right of the foundations as a card with one extra line: "Fler lediga celler eller tomma kolumner ger längre svit."

**Refusal is never silent.** On an over-long attempt the sequence shakes 160 ms, takes a 3 px `error` border on `error-fill`, and the bottom card gets a △ mark; the status strip becomes: **"3 kort är för många just nu — du kan flytta 1. Alla fyra celler är upptagna. Lägg ett kort på en ess-hög eller i en kolumn först."** The message always names **both** numbers — attempted and possible — and the action that fixes it. Recompute the limit *before* composing the refusal. Silent rejection is the single failure that makes players think the game is broken.

**The limit is also drawn on the board.** While a run is selected, the cards that fit render normally in the selection style; the cards beyond the limit take `hatch`. The boundary is visible on the cards, not only as a number.

Announce both the meter value and every refusal via `aria-live="polite"`, in the same words.

## Problem 3 — free cells vs foundations

Four ways apart, no one of them colour:

| | Free cells | Foundations |
| --- | --- | --- |
| Shape | 4 px radius, flat, `inset 0 3px 0 edge` (sunken well) | 8–10 px radius, bordered |
| Label | mono `FRIA CELLER 2/4` | mono `ESS-HÖGAR` |
| Empty content | `○` in `absent` | the suit glyph in `absent` |
| Position | left | right, 24 px gap + 1 px vertical divider (stacked below 360 px) |

Free-cell states, all drawn: **empty** (○ + sunken) · **occupied** (ordinary card) · **valid target** (2 px dashed accent + ▾) · **not available now** (`hatch`) · **keyboard focus** (3 px accent outline, offset 2 px).

Occupancy is the strategic resource, so the cost is visible without nagging: the counter `2/4` is always present; at **4/4** the group takes a 2 px `near` border and a ▲ in its label, and the meter reads "du kan flytta 1". No modal, no warning, no flashing — just a state that looks cramped. A third level exists for genuinely stuck positions: `△ INGA DRAG`, 2 px `error` border, and the status strip offers **Ångra**.

---

## Screen structure
Existing shell throughout: sticky header → mobile 320 × 100 ad (height reserved) → h1 + "Även kallad FreeCell · giv #2104" → mono meta row (`⏱ 05:12 · DRAG 41 · POÄNG 240`) → felt board (cells + foundations, meter, tableau) → **status strip** → `.gamectl` row (↺ Ångra · ☞ Tips · ↻ Ny giv, plus ⇱ Samma giv igen on desktop) → mono keyboard hint → "Så spelar du".

The status strip always sits **between the board and the buttons** so it is read without the hand leaving the controls.

Desktop is `1fr 300px` with 48 px gaps; the 336 × 280 sits ≥ 40 px below the last interactive row, the 300 × 600 in the sidebar (removed below 1024 px), a 336 × 280 inside the result panel. No ad inside, overlapping or adjacent to the play area; none between moves; every height reserved, CLS 0.

## Result panel
Shared `.result`: heading, one-line outcome, three stat boxes — **tid / drag / poäng**, matching Patiens — accent pill, 336 × 280, outline cross-link to another game.

Kungen has **no loss state**. A win is framed in `ok` with a ✓ circle ("Löst! · Giv #2104 · alla 52 kort hemma", footnote "TVÅ CELLER OANVÄNDA HELA GIVEN"). A dead position is a **locked state**, framed in `near` with a ▲ circle: "Inga drag kvar — given är inte förlorad, backa några drag", and the **primary button is ↺ Ångra sista draget**, with "↻ Ny giv" secondary. Near-every deal is solvable; don't invite the player to throw it away.

## "Så spelar du" (below the board, verbatim Swedish)
Four short paragraphs in the `/patiens/` voice — plain and warm, no hype:
1. All 52 cards face up from the start, nearly every deal solvable; order of moves is what decides.
2. Build **down in alternating colour**; an empty column takes any card — **say this explicitly**, or Klondike-trained visitors will play it wrong.
3. The four free cells hold one card each and are your breathing room; the more that stay empty, the longer the run you can move — which is why four full cells is almost always an expensive position.
4. The goal is the four foundations: ace upward to king, one pile per suit.

## Behaviour
Tap-to-select then tap-to-place is primary (drag is a bonus, mouse only); the selected run lifts 6 px, takes a 3 px accent border and `sel` fill, and holds until a target is tapped or the run is tapped again. Double-tap sends a card to its foundation. Keyboard: arrows pick a column, Space takes/places, **1–4 address the free cells**, A sends to the foundation, Ctrl/Cmd+Z undoes; 3 px accent focus ring, offset 2 px. `prefers-reduced-motion` replaces the lift, the shake and the deal animation with instant state changes. Deals are numbered and reproducible ("Samma giv igen"); state in `localStorage`, no server.

## Must not get wrong
- Recompute the movable count **before** every refusal and put both numbers in the message. Silent rejection is the defining bug of FreeCell implementations.
- Free cells and foundations must never share a radius or a fill.
- Red suits carry an **underline under the rank**; suit glyph ≥ 19 px mobile / 28 px desktop. The board must read in greyscale.
- Cards keep `card-face` light in dark mode.
- An empty column accepts **any** card — in the rules text and in the target highlighting.
- Foundations are not valid targets for a multi-card run; never mark them as such while a run is selected.
- Minimum text 17 px, body 19 px, tap targets ≥ 48 × 48 px rendered. Never 13 px.

## Assets
None. Suit glyphs (♠♥♦♣), ○, ▾, △, ▲, ✓ stand in for the same small inline-SVG set used by `/patiens/`.
