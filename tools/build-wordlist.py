#!/usr/bin/env python3
"""Build the Swedish word lists from Språkbanken data (both CC BY 4.0).

    python3 tools/build-wordlist.py saldom.xml kelly.xml site/data/

Emits:
  words.txt   every playable form, for the solvers (~740k)
  words5.txt  common 5-letter answers for the daily game, frequency-ranked

The two lists exist for different reasons. The solver wants maximum
coverage: a rare inflection someone can legally play in Wordfeud must be
found. The daily game wants the opposite -- only words a normal person
knows, or the puzzle is unfair and players leave, which is the one thing
the whole site cannot afford.
"""
import re, sys, os

SW = set("abcdefghijklmnopqrstuvwxyzåäö")
POS_RE = re.compile(r'att="partOfSpeech" val="([^"]*)"')
FORM_RE = re.compile(r'att="writtenForm" val="([^"]*)"')
PROPER = {"pm", "pmm"}
# Only content words make good puzzle answers. Function words (eller, under,
# denna) are 5 letters and common but make a miserable game.
ANSWER_POS = {"noun-en", "noun-ett", "noun", "verb", "adjective"}


def playable(w):
    # ponytail: the charset check also removes multiword forms (space),
    # hyphenated compounds and anything with digits -- no separate rule needed
    return 2 <= len(w) <= 15 and set(w) <= SW


def parse_saldom(path):
    """-> (all playable forms, proper-noun forms)"""
    words, proper, pos = set(), set(), None
    with open(path, encoding="utf-8") as f:
        for line in f:
            if "<LexicalEntry" in line:
                pos = None
            m = POS_RE.search(line)
            if m:
                pos = m.group(1)
                continue
            m = FORM_RE.search(line)
            if m:
                w = m.group(1).lower()
                if not playable(w):
                    continue
                (proper if pos in PROPER else words).add(w)
    return words, proper


def parse_kelly(path):
    """-> [(lemma, pos, words-per-million)] ordered as found"""
    xml = open(path, encoding="utf-8").read()
    out = []
    for e in re.findall(r"<LexicalEntry>(.*?)</LexicalEntry>", xml, re.S):
        def field(tag):
            m = re.search(rf"<{tag}>(.*?)</{tag}>", e, re.S)
            return m.group(1).strip() if m else ""
        try:
            wpm = float(field("wpm").replace(",", "."))
        except ValueError:
            wpm = 0.0
        out.append((field("gf").lower(), field("pos"), wpm))
    return out


def main(saldom_path, kelly_path, out_dir):
    words, proper = parse_saldom(saldom_path)
    kelly = parse_kelly(kelly_path)

    answers, seen = [], set()
    for lemma, pos, wpm in kelly:
        if len(lemma) != 5 or not playable(lemma):
            continue
        if pos not in ANSWER_POS or lemma in proper or lemma in seen:
            continue
        # Must also be a real playable form, so the game never accepts an
        # answer the solver would reject.
        if lemma not in words:
            continue
        seen.add(lemma)
        answers.append((lemma, wpm))
    answers.sort(key=lambda r: -r[1])

    os.makedirs(out_dir, exist_ok=True)
    all_path = os.path.join(out_dir, "words.txt")
    rack_path = os.path.join(out_dir, "words9.txt")
    five_path = os.path.join(out_dir, "words5.txt")
    # A 7-tile rack can never make a word longer than 9 (blank + board letter),
    # so the Wordfeud page -- the busiest tool -- loads a quarter of the bytes.
    # Korsordshjälp needs the full list; it can afford the wait.
    rack = sorted(w for w in words if len(w) <= 9)
    # Guesses are validated against every valid 5-letter form, not just the
    # answer list -- rejecting a word the player knows is real is the fastest
    # way to lose them, even if it would never be the answer.
    valid5 = sorted(w for w in words if len(w) == 5)
    valid_path = os.path.join(out_dir, "words5all.txt")
    with open(all_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sorted(words)))
    with open(rack_path, "w", encoding="utf-8") as f:
        f.write("\n".join(rack))
    with open(valid_path, "w", encoding="utf-8") as f:
        f.write("\n".join(valid5))
    with open(five_path, "w", encoding="utf-8") as f:
        f.write("\n".join(w for w, _ in answers))

    print(f"{len(words):>7} playable forms   -> {all_path}")
    print(f"{len(rack):>7} rack forms (<=9) -> {rack_path}")
    print(f"{len(valid5):>7} valid guesses    -> {valid_path}")
    print(f"{len(proper):>7} proper nouns dropped")
    print(f"{len(answers):>7} daily answers    -> {five_path}")
    print(f"        {len(answers)/365:.1f} years of daily puzzles")
    print("  most common:", ", ".join(w for w, _ in answers[:12]))
    print("  rarest:     ", ", ".join(w for w, _ in answers[-12:]))


if __name__ == "__main__":
    main(*sys.argv[1:4])
