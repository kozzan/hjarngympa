#!/usr/bin/env python3
"""Render site/pages/** into dist/ using site/_layout.html.

    python3 tools/build.py

Each page starts with a metadata block:

    <!--meta
    title: Sudoku
    desc: Spela sudoku gratis...
    -->

ponytail: string.Template over a template engine. Eight pages and one
layout do not justify a dependency, a build config or a node_modules.
"""
import os, re, shutil, html, datetime
from string import Template

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE, DIST = os.path.join(ROOT, "site"), os.path.join(ROOT, "dist")
# `or` not a default arg: CI passes BASE_URL="" when the repo variable is
# unset, and set-but-empty beats a default. That shipped relative canonicals.
BASE_URL = os.environ.get("BASE_URL") or "https://hjarngympa.se"
# Serving from a project path (kozzan.github.io/hjarngympa) until the real
# domain is attached. Empty for a root domain, "/hjarngympa" for the preview.
BASE_PATH = (os.environ.get("BASE_PATH") or "").rstrip("/")
# Written into dist/ so the custom domain survives every deploy -- without it
# GitHub Pages can drop the domain back to the github.io URL on a redeploy.
CNAME = os.environ.get("CNAME") or "hjarngympa.se"
META_RE = re.compile(r"^<!--meta\s*(.*?)-->\s*", re.S)


def read_page(path):
    raw = open(path, encoding="utf-8").read()
    m = META_RE.match(raw)
    meta, body = {}, raw
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = raw[m.end():]
    return meta, body


def route_of(rel):
    """site/pages/sudoku/index.html -> /sudoku/"""
    d = os.path.dirname(rel)
    return "/" + (d + "/" if d else "")


def main():
    if not BASE_URL.startswith(("http://", "https://")):
        raise SystemExit(
            f"BASE_URL must be absolute, got {BASE_URL!r}. "
            "Relative canonicals and sitemap URLs are invalid and Google rejects them."
        )

    layout = Template(open(os.path.join(SITE, "_layout.html"), encoding="utf-8").read())
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    pages_dir = os.path.join(SITE, "pages")
    routes = []
    for dirpath, _, files in os.walk(pages_dir):
        for fn in files:
            if not fn.endswith(".html"):
                continue
            src = os.path.join(dirpath, fn)
            rel = os.path.relpath(src, pages_dir)
            meta, body = read_page(src)
            route = route_of(rel)
            out = os.path.join(DIST, os.path.dirname(rel), "index.html")
            os.makedirs(os.path.dirname(out), exist_ok=True)
            page = layout.safe_substitute(
                basepath=BASE_PATH,
                title=html.escape(meta.get("title", "hjärngympa")),
                desc=html.escape(meta.get("desc", "")),
                canonical=BASE_URL + BASE_PATH + route,
                bodyclass=meta.get("bodyclass", ""),
                head=meta.get("head", ""),
                body=body,
            )
            if BASE_PATH:
                page = page.replace('href="/', f'href="{BASE_PATH}/')
                page = page.replace('src="/', f'src="{BASE_PATH}/')
            open(out, "w", encoding="utf-8").write(page)
            routes.append((route, meta.get("priority", "0.7")))

    for sub in ("assets", "data"):
        src = os.path.join(SITE, sub)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(DIST, sub))

    # CSS carries its own root-absolute url() references (the font files), and
    # the HTML rewrite above never sees them.
    if BASE_PATH:
        for dirpath, _, files in os.walk(os.path.join(DIST, "assets")):
            for fn in files:
                if not fn.endswith(".css"):
                    continue
                f = os.path.join(dirpath, fn)
                css = open(f, encoding="utf-8").read()
                open(f, "w", encoding="utf-8").write(
                    css.replace("url(/assets/", f"url({BASE_PATH}/assets/"))

    today = datetime.date.today().isoformat()
    urls = "\n".join(
        f"  <url><loc>{BASE_URL}{BASE_PATH}{r}</loc><lastmod>{today}</lastmod>"
        f"<priority>{p}</priority></url>"
        for r, p in sorted(routes)
    )
    open(os.path.join(DIST, "sitemap.xml"), "w", encoding="utf-8").write(
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n'
    )
    open(os.path.join(DIST, "robots.txt"), "w", encoding="utf-8").write(
        f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}{BASE_PATH}/sitemap.xml\n"
    )
    # GitHub Pages serves this repo from a project path until the domain is
    # attached; .nojekyll stops it mangling paths that start with an underscore.
    open(os.path.join(DIST, ".nojekyll"), "w").close()
    if CNAME and not BASE_PATH:
        open(os.path.join(DIST, "CNAME"), "w").write(CNAME + "\n")

    print(f"built {len(routes)} pages -> {DIST}")
    for r, _ in sorted(routes):
        print("  ", r)


if __name__ == "__main__":
    main()
