# Design brief — hjarngympa.se

Paste this into Claude Design.

---

Design **hjarngympa.se**, a Swedish puzzle and word-game site. Everything is
in Swedish. It is a static site — no login, no accounts, no server.

## What it is

Three kinds of page under one brand:

1. **Spel** — playable puzzle games, one per page: dagens ord (a daily
   Swedish word game, Wordle-style), sudoku, minsvepare, mahjong, patiens,
   minnesspel, 2048.
2. **Verktyg** — word solvers: wordfeud-hjälp, korsordshjälp, anagram. You
   type in letters, you get back a ranked list of Swedish words.
3. **Artiklar** — ordinary written articles: sudokuregler, wordfeud-strategi,
   korsordsguide.

## Who uses it

Swedes playing a puzzle over morning coffee or on the sofa at night. The
age range is wide and skews older than a typical game site — "hjärngympa"
means brain training, and a large share of the audience is 45+. Wordfeud
players arrive separately, looking for the solver, and they are in a hurry.

Most traffic is mobile, portrait. Design mobile-first and let desktop be
the widescreen adaptation, not the other way round.

## The one hard constraint: advertising

The site is funded entirely by Google AdSense, so **ad slots are part of
the layout, not something bolted on afterwards.** Design them in
deliberately and show them in the mockups as clearly-marked placeholders at
real IAB sizes.

- A slot above the fold that does not push the game below it
- A sidebar slot on desktop (300×250 / 300×600) that collapses gracefully
  on mobile
- A slot between rounds — after a puzzle is finished, before the next one
- A slot mid-article on the written pages

**Never put an ad inside or overlapping the play area.** It breaks AdSense
policy and it drives players away, and repeat players are the entire
business model. The design should make ads feel like the price of a free
game, not like an ambush.

## Screens to design

1. **Startsida** — routes people to a game fast. Most visitors arrive here
   from search knowing what they want.
2. **Dagens ord** — the daily word game. Six rows of five letter tiles, an
   on-screen Swedish keyboard (with å, ä, ö), tile flip states for
   correct / wrong position / absent, and a result panel showing the streak
   and a share button.
3. **Sudoku** — a 9×9 grid, difficulty selector, number pad, pencil-mark
   mode, timer, undo.
4. **Verktyg / wordfeud-hjälp** — a letter input, wildcard support, and a
   results list of words grouped by length with point values.
5. **Artikel** — a readable long-form article page.

## Visual direction

Warm and calm, not neon gamer energy and not corporate SaaS. It should
feel like a well-made newspaper puzzle page: confident typography, generous
spacing, a restrained palette with one strong accent used for correct
answers and primary actions.

Requirements, not suggestions:

- **Light and dark mode both.** People play these at night.
- **Large tap targets** and text that stays legible at arm's length. The
  audience skews older. Do not design at 13px.
- **Colour is never the only signal.** Sudoku conflicts and word-game tile
  states need a shape, border, or icon alongside the colour — a meaningful
  share of players are colourblind, and the green/yellow word-game palette
  is the worst possible case for that.
- **Full keyboard support** on the word game and sudoku.
- Fast and light. No hero videos, no heavy imagery, no decorative photos.
  The games and the type carry the whole design.

## Avoid

- Generic dashboard-template look
- Purple-to-blue gradients
- Cluttering the play area with anything at all
- Any design that only works once real content and ads are removed

## Deliverable

Mockups of the five screens above, mobile and desktop, in light and dark
mode, with the ad placeholders visible and sized. Plus the pieces a
developer needs to build it: colour tokens, type scale, spacing scale, and
the tile and cell states for the word game and sudoku.
