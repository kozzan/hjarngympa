# Handoff: Spindelharpan + Hänga gubbe (and two index edits)

## How to use this package (read first)

**Prompt for Claude Code:**

> Implement `/spindelharpan/` and `/hanga-gubbe/` for hjarngympa.se from `README-spindelharpan-hanga-gubbe.md` in this folder, and apply the two index edits it describes. Read `README.md` (base system) and `README-fem-nya-spel.md` (games layer) first. **Extend the existing system — add no new tokens.** Reuse the shipped shared components in `site/assets/games.css` exactly as they are: `.game` shell, `.frame` zoom container, `.diffs` chips, `.gamectl` row, `.result` panel with its `.icon`/`.stats`, and for Hänga gubbe the Dagens ord keyboard (`.krow`/`.key` with the `data-mark` ✓/× glyphs) unchanged. Open `Hjärngympa.dc.html` in a browser to see frames 09 and 10 plus the revised 01 Startsida and 07 Spelindex; it is a design reference, not production code. Copy is Swedish, verbatim from the frames where given.

Read order: `README.md` → `README-fem-nya-spel.md` → this file. Frames are captioned with device width and mode. **Fidelity: high**, static frames, no game logic.

## New tokens
**None.** Everything comes from the existing set: `felt`, `card-face`, `card-ink`, `edge`, `hatch`, `sel`, `line`, `surface`, `accent`, `ok`, `ok-soft`, `near`, `error`, `absent`, `absent-fill`.

---

## 09 Spindelharpan — `/spindelharpan/`

Spider solitaire. Ten tableau columns, eight foundations, a stock that deals a row across all columns.

### Ten columns on a phone
Cards stay at **44 × 60 px** (rank 17 px beside suit 19 px) and are never shrunk. The board sits in the shared **`.frame`** and is panned horizontally: content is 467 px inside a ~350 px clip, the clip edge cuts a column visibly, and a mono line states the gesture — `DRA I SIDLED · NYP FÖR ZOOM · KORTET KRYMPS ALDRIG UNDER 44 PX`. Below it the `.zoomctl` row: `⊕ Centrera` plus 48 px `＋` / `－`. This is the Minsvepare house rule applied unchanged: tap targets are measured in rendered pixels; the board scrolls inside `.frame` rather than shrinking.

Card faces lay **rank beside suit** (the `#kboard` fix already in `games.css`), so both read inside the 26 px visible strip of a covered card. Desktop shows all ten columns at **62 × 84 px** with no panning.

### Board chrome
- **`.diffs` chips** — 1 färg / 2 färger (active) / 4 färger.
- **Mono meta row** — `⏱ 07:14 · DRAG 84 · 2 FÄRGER`.
- **Stock** — a stacked card edge showing the number of deals left (4) under a mono `GIVAR` / `GIVAR KVAR` label; ≥ 48 px target. Disabled while any column is empty (spider's rule) — say why in the status strip, never fail silently.
- **Eight foundations** — 30 × 42 px mobile / 44 × 60 px desktop; completed piles show their king on `ok-soft` with a 2 px `ok` border and ✓, empty ones are 1 px dashed `edge`. Label `KLARA SVITER 2/8`. Not interactive, so they may be smaller than a tap target.
- **`.gamectl`** — ↺ Ångra · 💡 Tips · Nytt spel.
- **Status strip** between board and controls, naming the selection in words: "K♠ D♠ J♠ 10♠ 9♠ valt — 5 kort i följd."

### Card states (each with a non-colour signal)
| State | Signal |
| --- | --- |
| face-down | `hatch` on `surface`, 1 px `line`, no text |
| face-up | `card-face`, 1 px `card-ink`; red suits underline the rank |
| selected | 3 px `accent`, `sel` fill, lifted 6 px (the card above it gains those 6 px so its strip stays 26 px) |
| valid target | 2 px **dashed** `accent` + ▾ |
| invalid drop | 3 px `error` on `error-fill` + △ + shake 160 ms |
| completed sequence | 2 px `ok` on `ok-soft` + ✓, **then** it leaves for a foundation |

The mockup board is deliberately mid-game: four–five face-down cards per column, one long ordered run (K♠ D♠ J♠ 10♠ 9♠) selected, an empty column marked as a target, a finished ♠ run acknowledged with ✓, and a 10♥ marked as the valid drop.

### Desktop layout
Follows 03 Sudoku: `700px 1fr 300px`, 48 px gaps — board left, control column (chips, a mono TID/DRAG/KLARA SVITER card, `.gamectl`, keyboard legend) in the middle, 300 × 600 in the sidebar, **336 × 280 at least 40 px below the board**. Mobile carries the 320 × 100 above the h1 with its height reserved.

### Result panel
Shared `.result` exactly as 02 Dagens ord uses it: ✓ icon circle, "Alla åtta sviter hemma", three stats — **tid / drag / sviter** — accent pill "Nytt spel", then the **336 × 280 between-rounds slot**, then the outline cross-link ("Prova Kungen →").

### Must not get wrong
A completed sequence must acknowledge itself with ✓ and the `ok` border **before** it leaves the board, or cards look like they vanished. Face-down uses the same `hatch` as Patiens, never a decorated back. Keyboard: arrows pick a column, Space takes/places, `D` deals, Ctrl/Cmd+Z undoes; 3 px accent focus ring offset 2 px. `prefers-reduced-motion` replaces the lift, the shake and the deal slide with instant state changes.

---

## 10 Hänga gubbe — `/hanga-gubbe/`

Swedish word guessing. The word renders as underscores with revealed letters: Newsreader **34 px mobile / 48 px desktop**, 3–4 px underline per slot — `line` for empty slots, `ink` for found letters. Never break a word across a letter slot. Caption in mono: `8 BOKSTÄVER · 4 FUNNA`.

### Keyboard — reused unchanged
The Dagens ord on-screen keyboard, same layout (`QWERTYUIOPÅ` / `ASDFGHJKLÖÄ` / `ZXCVBNM`), same key sizes (30–32 × 52 px, radius 6, 5 px gaps), same `ok`/`absent` treatment with the **corner ✓ / ×** so colour never carries the state alone. There is no `near` state in this game. Desktop hides the on-screen keyboard and shows the mono hint instead, exactly as `games.css` already does at ≥ 760 px.

### The progress indicator — my recommendation
The frame shows **both, side by side**, with the same six steps and the same countability:

- **Snögubbe (recommended, and the default)** — six parts that melt away: hat, two arms, head, middle, base. Remaining parts are solid `ink` strokes; spent parts stay visible as **dashed ghost outlines**. Warm-paper appropriate, seasonally Swedish, and it sits next to an ad on a family site without a problem.
- **Traditionell galge (optional, in settings)** — gallows frame plus head, body, two arms, two legs, drawn stroke by stroke in `ink`, spent parts dashed.

Both also carry a **pip row** under the figure — three filled squares, three dashed — plus "3 av 6 gissningar kvar" in words. **Neither indicator changes colour to signal danger**, so remaining guesses read in greyscale. A "Byt mätare" control switches them. Draw both as small inline SVG (stroke `currentColor`, weight 4), not images.

### Chrome
Category chips (Djur / Mat / Städer / Blandat) as `.diffs`; mono meta `KATEGORI DJUR · GISSNINGAR KVAR 3 · SVÅR`; `.gamectl` with 💡 Tips (−1 gissning) · Nytt ord · Byt mätare. Ads as elsewhere: 320 × 100 above the h1 on mobile, 336 × 280 ≥ 40 px below the play area on desktop, 300 × 600 sidebar, 336 × 280 in the result panel.

### Result panels
Win: `.result` win variant (✓ on `ok-soft`). **Loss is framed in `near` with a ▲ circle — not `error`**: guessing a word wrong is not a mistake. It always reveals the word ("Ordet var **SNÖSKOTER**"), shows three stats, offers **Nytt ord** as the primary action, and adds one short, warm line about why the word was hard. Nothing punitive, no scolding copy.

### Must not get wrong
Every element must agree with one word: the revealed letters, the ✓ keys, the × keys, the found-letter count and the guesses-remaining pips are five views of the same state. The frames use **SNÖUGGLA** (Djur): ✓ on S, N, Ö, L; × on E, R, T; three wrong = 3 of 6 left; caption "4 FUNNA".

---

## Index edits

**01 Startsida** — the game grid holds **eight** cards now. The featured Dagens ord card moves to full column width (capped at 640 px so it stays a banner, not a slab) and keeps its 2 px `accent` border and dominance; the eight games sit below it in a **4 × 2** grid on desktop and **2 × 4** on mobile. All eight reachable in one tap, no "see all" indirection.

**07 Spelindex** — **nine** games. Mobile: four list rows, then the in-list 336 × 280, then four more (the featured Dagens ord card stays above). Desktop: the 3-column card grid now holds eight cards plus the featured card, with the 728 × 90 in-content slot after the grid. Copy updated to "Nio pussel" in both the mobile intro and the desktop intro.

## Assets
None. Glyphs (⛁ ☃ ♠♥ ✓ × △ ▾ ▲) stand in for the small inline-SVG set the site already supplies; the snowman and gallows are inline SVG strokes, not images.
