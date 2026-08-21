# hjarngympa.se

Swedish puzzle and word-game site. Static, no backend, funded by AdSense.

## Build

    python3 tools/build.py          # site/pages/** -> dist/
    node --test tools/test.js       # 15 checks
    cd dist && python3 -m http.server 8765

## Word lists

Regenerated only when Språkbanken publishes new data:

    curl -O https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/saldom/saldom.xml
    curl -O https://svn.spraakbanken.gu.se/sb-arkiv/pub/lexikon/kelly/kelly.xml
    python3 tools/build-wordlist.py saldom.xml kelly.xml site/data/

SALDO and Kelly are CC BY 4.0 (Språkbanken Text, Göteborgs universitet).
Attribution is in the site footer and must stay there.

## Layout

    site/_layout.html     shared shell (header, footer, consent)
    site/pages/**         one file per route, with a <!--meta --> block
    site/assets/          css, js, self-hosted fonts
    site/data/            generated word lists
    docs/design/          Claude Design handoff + mockups
    docs/superpowers/     design spec
