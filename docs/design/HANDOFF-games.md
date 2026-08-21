# Handoff: five more games — Minsvepare, Mahjong, Patiens, Minnesspel, 2048

## Overview
Extends the live hjarngympa.se design system. **No new system** — the tokens, type scale, spacing scale, page shell, ad rules and result-panel skeleton in `README.md` all apply unchanged. This document covers only what is new.

Design file: `Hjärngympa - fem nya spel.dc.html` (needs `support.js` alongside it). Open in a browser; frames are captioned with device width and mode. Order: decisions + new tokens, then 01 Minsvepare, 02 Mahjong, 03 Patiens, 04 Minnesspel, 05 2048.

**Fidelity: high.** Static frames — no game logic implemented; behaviour is specified in prose. Recreate in the target codebase's own patterns (vanilla JS is a good fit; every game is client-side).

Priority order matches search volume: **Minsvepare first and by a wide margin** (also the highest-earning page), then Mahjong, Patiens, Minnesspel, 2048.

## Page shell
Every game reuses the existing shell verbatim: sticky header (wordmark, nav, 48 px theme toggle) → mobile 320 × 100 ad with reserved height → h1 → mono meta row → play area → controls → mono keyboard-hint line. Desktop is `1fr 300px` with 48 px gaps; the 336 × 280 sits ≥ 40 px below the last interactive row, the 300 × 600 in the sidebar, and a 336 × 280 inside the result panel. Sidebar ads are removed below 1024 px. Never inside, overlapping or adjacent to the play area; never an interstitial between moves; every height reserved.

## New tokens
Six additions, named in the existing style. Nothing else changes.

| Token | Light / dark | Use |
| --- | --- | --- |
| `felt` | `#EDE7DB` / `#1A1713` | table surface behind mahjong tiles and patience cards |
| `edge` | `#C8C0B2` / `#4A4239` | bottom edge that makes a tile/cell read as raised (shape signal, not shadow) |
| `hatch` | `rgba(30,26,21,.10)` / `rgba(241,236,227,.10)` | 45° 4/5 px stripe = blocked, locked, face-down — colour-independent |
| `card-face` | `#FFFFFF` / `#EFE9DD` | cards and mahjong tiles stay light in dark mode; dark ink on a light face reads best |
| `num-1 … num-8` | `#3E6187 #4C6B3C #A2331A #5A3E86 #8A4A17 #1F6B6B #1E1A15 #6C6358` (dark: `#7FA6CF #6F9A55 #F2907A #A98BD6 #D79A5A #5FB3B3 #F1ECE3 #A69C90`) | minesweeper neighbour counts — **reinforcement only**, the digit carries the meaning |
| `ok-soft` | `#E9EFE1` / `#25301E` | matched pair, cleared field |

---

## 1. Minsvepare (`/minsvepare/`) — highest priority

### Board sizes — the decision
Four levels, different boards per device:
- **Lätt 9×9** — fits 390 px portrait at 36–38 px cells, no zoom.
- **Medel 12×12** — zoom frame on mobile, native on desktop.
- **Svår** — **12×16 portrait on mobile**, **16×16 on desktop** (same mine density).
- **Expert 30×16** — **desktop only**; still listed on mobile but labelled "dator" rather than hidden, so the level exists in the UI and in search.

Anything larger than 9×9 renders inside a **fixed pan-and-zoom frame** (2 px `line` border, radius 12, ~360 px tall on mobile): pinch to zoom, drag to pan, with a **minimap** top-right showing the viewport rectangle and a bottom-left control cluster — "⊕ Centrera" plus 48 px ＋ / －. **Initial zoom is set so a cell is always ≥ 40 rendered px**: the tap target is measured on screen, not in board coordinates. Never scale down past 17 px digits.

### Flag vs reveal on touch — the decision
**A visible segmented control, not long-press.** A 56 px-tall two-up control ("⛏ Gräv" / "▲ Flagga") sits just above the thumb inside a pill container; the active half is filled accent and carries its glyph. Long-press survives as a shortcut but is never the only route. The active mode is repeated as a glyph in the meta row (`LÄGE ⛏`) so it's readable without looking down. Rationale: long-press is invisible, needs fine motor control, and screen readers treat it inconsistently — a 45+ audience should not have to guess a gesture.

### Cell states (all drawn in the file)
| State | Non-colour signal |
| --- | --- |
| covered | `surface`, 1 px `line`, `inset 0 -3px 0 edge` (raised) |
| focus | 3 px accent outline, offset 2 px |
| flagged | ▲ glyph + 2 px accent border + `sel` fill |
| uncertain | `?` glyph + 2 px **dashed** `muted` border |
| empty revealed | flat `bg`, 1 px `grid` (sunken — no edge) |
| mine | ✳ + 3 px `error` border on `error-fill` |
| detonated mine | ✳ white on solid `error` |
| wrongly flagged | ▲ **struck through** in `absent` on `absent-fill` |
| correct flag (on win) | ✓ + 2 px `ok` on `ok-soft` |

Neighbour digits: weight 600, **0.46 × cell size** (26 px on a 56 px cell), colour from `num-1…8` as reinforcement only — the board reads in greyscale.

**Must not get wrong:** the first tap is always safe (mines are placed after the first dig). Chord-click (tapping a satisfied digit clears its neighbours) works on mouse *and* touch. The counter `▲ 4 / 10` counts flags, not mines. No ad within 40 px of the board — the board is the whole play area even when zoomed.

---

## 2. Mahjong (`/mahjong/`)

### Phone layout — the decision
Two layouts, not one scaled. Mobile ships **"Kompakt sköldpadda" — 72 tiles in three layers**, tile 42 × 54 px: full tap target and legible face with no zoom at all. The classic **144-tile turtle** remains as its own choice and renders in the pan-and-zoom frame with minimap. Both are offered as a two-up pill switch ("Kompakt · 72" / "Klassisk · 144"). Desktop tile is 48 × 62 px.

### Tile faces — the decision
A **bespoke inline-SVG set (34 motifs)**, never Unicode mahjong characters (🀇 etc. fall back differently on iOS, Android and Windows). Motif drawn in a **28 × 36 px** SVG centred with 7 px padding, stroke weight 2.5 px, always `ink` on `card-face`. Four groups: characters 一–九, dots ●, bamboo ▮, winds/dragons 東南西北中發. The mockup shows the motifs as text stand-ins.

### Tile states
| State | Signal |
| --- | --- |
| free | 2 px `ink` border + **7 px bottom edge** (raised) |
| blocked | 45° `hatch` + 1 px `line` + flat (no edge), `aria-disabled`, not tappable |
| selected | 3 px accent border, 8 px bottom edge, `sel` fill |
| hint | 3 px **dashed** accent |
| pair removed | ✓ on `ok-soft` with 2 px `ok`, fades 200 ms |

**Must not get wrong:** free vs blocked must never differ by brightness alone — border weight (2 px vs 1 px), raised bottom edge and the hatch carry it. Layer depth is drawn with a 6 px offset per layer, not shadow, and each layer's origin snaps to whole tile steps before that offset so upper tiles cover whole tiles rather than seams. Hints may only highlight, never move. Shuffle is limited (2 per game) and reported in the result panel.

---

## 3. Patiens (`/patiens/`)

### Touch interaction — the decision
**Tap-to-select then tap-to-place is the primary interaction**; drag is a bonus for mouse users. Selected card lifts 6 px, takes a 3 px accent border and `sel` fill, and keeps the selection until a target is tapped or the card is tapped again. Valid targets get a 2 px **dashed** accent border plus a small ▾ marker. An invalid tap shakes 160 ms and keeps the selection. Double-tap sends a card straight to the foundation. A one-line status strip under the board states the selection in words ("5♠ valt. Tryck på ett markerat mål…").

### Fanned tableau spacing
**34 px of visible edge per overlapped card, 48 px for the top card**, dropping to **26 px** when a pile runs deeper than seven (corner index moves up). Mobile card 46 × 64 px, desktop 88 × 124 px.

**Must not get wrong:** red suits must not rely on colour — red pips carry an **underline under the rank** and the suit glyph is ≥ 19 px mobile / 28 px desktop. Face-down cards use the same `hatch` as mahjong, not a decorative back. Cards keep `card-face` light in dark mode. Empty piles are 1 px dashed `edge`; the foundation shows its suit glyph in `absent` until filled.

---

## 4. Minnesspel (`/minnesspel/`)
Sizes 4×4 and 5×4 on mobile, 6×5 desktop only. Card min 76 × 92 px on mobile at 4×4, `aspect-ratio: .82`, radius 10–12, grid gap 10–14 px.

| State | Signal |
| --- | --- |
| face-down | `surface` + 1 px `line` + `inset 0 -4px 0 edge` + faint `hatch` |
| focus | 3 px accent outline, offset 2 px |
| face-up (this turn) | 3 px accent border, `sel` fill, motif in accent |
| matched | 2 px `ok` on `ok-soft` + **permanent ✓ mark**, locked |
| mismatch | 3 px `error` on `error-fill` + **△ mark**, 900 ms then flips back |

**Must not get wrong:** motifs are **12 distinct silhouettes**, never colour swatches — the game must work in greyscale. Matched pairs keep the ✓ and the `ok` border permanently, not just a tint. Under `prefers-reduced-motion` the flip becomes an instant state change.

---

## 5. 2048 (`/2048/`)
4 × 4 board on `grid` (light) / `#3A322A` (dark), radius 12, 8–10 px gaps; empty cell `absent-fill`. Mobile fills the column; desktop cells 110 px with score/best cards, controls and a "Mer hjärngympa" cross-link list beside the board (this page is mostly cross-link inventory — that list is the point).

Tile ramp, warm, `surface` → `accent` → `ok` for 512+: 2 `#FFFFFF` · 4 `#F3EADA` · 8 `#E9C89A` · 16 `#DDA265` · 32 `#C97A42` · 64 `#B4531F` · 128 `#8E3F14` · 256 `#7A3510` · 512 `#4C6B3C` · 1024 `ok-soft` + 3 px `ok` border · 2048 `#4C6B3C` + 3 px border. Text flips to white where the ramp step requires it; contrast ≥ 4.5:1 at every step. Value weight 600, 30–38 px, shrinking by digit count.

**Must not get wrong:** the value is always the signal — colour is only a ramp, and 1024/2048 additionally take a 3 px border as a shape signal. Swipe needs a 24 px threshold so page scroll isn't read as a move. Under `prefers-reduced-motion` tiles jump without sliding. Score and best persist in `localStorage`.

---

## Result panels
Same skeleton as Dagens ord: heading, one-line outcome, three stat boxes with Newsreader numerals, an accent pill to play again, the 336 × 280 ad, then an outline cross-link button to another game. **Win is framed in `ok`, loss in `error`, each with a 44 px icon circle (✓ / ✳ / △)** so the outcome isn't colour alone. Worked example drawn for Minsvepare, win (light) and loss (dark).

Per-game stat boxes:
- Minsvepare — tid / ditt bästa / rensade (loss: tid / rensat % / flaggor)
- Mahjong — tid / borttagna par / omblandningar
- Patiens — tid / drag / poäng
- Minnesspel — tid / försök / bästa
- 2048 — poäng / bästa / högsta bricka

## Cross-cutting behaviour
Light and dark both, toggled from the header and persisted. Full keyboard support per game (arrows + Space + a game-specific letter; Ctrl/Cmd+Z where undo exists), visible 3 px accent focus ring offset 2 px. `prefers-reduced-motion` replaces every flip, slide and fade with an instant state change. State changes announced via `aria-live` in words, never by colour. All state client-side in `localStorage`; no server.

## Assets
None. Glyphs in the mockups (▲ ✳ ✓ △ ⛏ ♠♥♦♣ ◆ ◼ ● 一東發) stand in for the inline-SVG sets the developer supplies: minesweeper marks, the 34 mahjong motifs, four suit glyphs, 12 memory silhouettes.
