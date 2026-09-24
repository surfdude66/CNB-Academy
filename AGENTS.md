# Cook & Bake Academy

This repository is a static course catalogue. The website uses plain HTML, CSS, and JavaScript; do not add a framework for routine changes.

## Source files

- Edit `index.html`, `css/styles.css`, `js/app.js`, and `data/courses.json` at the repository root.
- Render course cards and fees from `data/courses.json`. Never hard-code a course fee in HTML or JavaScript.
- Keep labels, image alt text, keyboard focus, and the mobile layout accessible.
- After changing site files, copy the same four files or directories into `dist/`. GitHub Pages and the existing Sites configuration publish `dist/`.

## Local checks

- Preview with `python -m http.server 8765` and open `http://localhost:8765/`; the JSON fetch needs an HTTP server.
- Confirm 20 cards render, Bakery shows exactly 10, and the page has no horizontal scroll at 375px.
- Run `node --check js/app.js`, `python scripts/check_secrets.py`, and `git diff --check` before publishing.

## Publishing

When asked to run `publish-to-github`, read and follow `.agents/commands/publish-to-github.md` from the repository root. Preserve Git history and never force-push. The GitHub Pages workflow is `.github/workflows/pages.yml` and publishes from `main`.
