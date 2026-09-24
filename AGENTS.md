# Cook & Bake Academy

This repository is a static course catalogue with browser-only sign-ups and a course assistant. The website uses plain HTML, CSS, and JavaScript; do not add a framework for routine changes.

## Source files

- Edit `index.html`, `admin.html`, `css/styles.css`, `js/app.js`, `js/chat.js`, `js/rag.js`, and `data/courses.json` at the repository root.
- Render course cards and fees from `data/courses.json`. Never hard-code a course fee in HTML or JavaScript.
- Keep labels, image alt text, keyboard focus, and the mobile layout accessible.
- Sign-ups stay in the browser's `localStorage`; `admin.html` exports them as CSV. Do not commit sign-up exports or personal data.
- The course assistant searches `data/academy.db`. Edit the source documents in `kb/`, then run `npm run build:kb` to rebuild the database and copy the knowledge base and SQLite runtime into `dist/`.
- Keep search logic in `js/rag.js`, shared by the browser assistant and `scripts/eval.mjs`. Use the `courses` table for cheapest, most expensive, and under-price questions; off-topic questions must return no results. Do not edit `eval/golden-questions.csv` to improve a score.
- After changing site files, copy their source counterparts into `dist/`. GitHub Pages and the existing Sites configuration publish `dist/`; the Pages workflow checks that the copies match.

## Local checks

- Preview with `python -m http.server 8765` and open `http://localhost:8765/`; the JSON fetch needs an HTTP server.
- Confirm 20 cards render, Bakery shows exactly 10, and the page has no horizontal scroll at 375px.
- Run `npm run eval` after each change to `js/rag.js` or `kb/` and report the score. The target is 30/30.
- Run `node --check js/app.js`, `node --check js/chat.js`, `node --check js/rag.js`, `python scripts/check_secrets.py`, and `git diff --check` before publishing.

## Publishing

When asked to run `publish-to-github`, read and follow `.agents/commands/publish-to-github.md` from the repository root. Preserve Git history and never force-push. The GitHub Pages workflow is `.github/workflows/pages.yml` and publishes from `main`.
