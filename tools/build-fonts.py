#!/usr/bin/env python3
"""Pin the variable font files to the single weight each one is used at.

    pip install fonttools brotli
    python3 tools/build-fonts.py site/assets/fonts/

Google Fonts hands out variable woff2 files carrying the whole weight axis.
Downloading one per weight gives you the *same file* under several names --
newsreader-500.woff2 and newsreader-600.woff2 were byte-identical, as were
sourcesans3-400 and sourcesans3-600 -- so the browser fetched the same bytes
twice from two URLs, and every fetch carried an axis the site never varies.

Pinning each file to its one weight cuts them roughly in half:

    newsreader-600   56.7 KB -> 23.4 KB
    sourcesans3-400  28.1 KB -> 15.1 KB

That matters more than it looks. The h1 is the LCP element and it is set in
Newsreader 600, so with `font-display: swap` the page paints in Georgia and
then re-paints when that file lands -- and Chrome re-records LCP on the
repaint. The size of this one file is the size of the FCP-to-LCP gap.

Run this after refreshing the fonts from Google Fonts. It is deliberately not
part of tools/build.py: that stays stdlib-only, and fonts change about once a
year. Faces already shipped as static instances (the italic, IBM Plex Mono)
have no axis to pin and are left alone.
"""
import os, sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# The weight each face is actually used at, from the @font-face rules in
# site/assets/fonts/fonts.css. Keep the two in step.
WEIGHTS = {
    "newsreader-500.woff2": 500,
    "newsreader-600.woff2": 600,
    "sourcesans3-400.woff2": 400,
    "sourcesans3-600.woff2": 600,
}


def codepoints(font):
    cps = set()
    for table in font["cmap"].tables:
        cps |= set(table.cmap.keys())
    return cps


def pin(path, weight):
    """Instance one file in place. Returns (before, after) in bytes."""
    before = os.path.getsize(path)
    font = TTFont(path)
    if "fvar" not in font:
        font.close()
        return before, before  # already static, nothing to pin

    was = codepoints(font)
    instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True,
                                      updateFontNames=False)
    # Pinning an axis must not drop glyphs. If it ever does, the page silently
    # loses characters -- Swedish å ä ö above all -- so fail instead.
    now = codepoints(font)
    missing = was - now
    if missing:
        raise SystemExit("%s: pinning dropped %d codepoints: %s"
                         % (path, len(missing), sorted(missing)[:10]))

    font.flavor = "woff2"
    font.save(path)
    font.close()
    return before, os.path.getsize(path)


def main(argv):
    if len(argv) != 2:
        raise SystemExit(__doc__)
    d = argv[1]

    print("%-24s %10s %10s %8s" % ("face", "before", "after", "saved"))
    total_before = total_after = 0
    for name, weight in sorted(WEIGHTS.items()):
        path = os.path.join(d, name)
        if not os.path.isfile(path):
            raise SystemExit("missing %s" % path)
        before, after = pin(path, weight)
        total_before += before
        total_after += after
        print("%-24s %9.1fK %9.1fK %7.0f%%"
              % (name, before / 1024, after / 1024,
                 100 * (1 - after / before) if before else 0))
    print("%-24s %9.1fK %9.1fK %7.0f%%"
          % ("total", total_before / 1024, total_after / 1024,
             100 * (1 - total_after / total_before)))


if __name__ == "__main__":
    main(sys.argv)
