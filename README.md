# Cook & Bake Academy

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black) ![SQLite](https://img.shields.io/badge/SQLite-WASM-003B57?logo=sqlite&logoColor=white) ![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-deployed-222222?logo=github)

A responsive course catalogue for hands-on cooking and baking classes in Singapore. Visitors can browse 20 courses, filter Bakery or Cooking classes, search by keyword, view course details, ask the SQLite-powered course assistant, and prepare a course sign-up.

**Live site:** [surfdude66.github.io/CNB-Academy](https://surfdude66.github.io/CNB-Academy/)

## Overview

- Three-photo hero and clear paths to browse courses or open the course assistant.
- Bottom-right course assistant loads SQLite WASM in the browser, answers price comparisons from course tables, and searches academy policies, campuses, FAQs, and brochures with safely quoted FTS5 terms. Optional ChatGPT mode sends the top three retrieved sources to OpenAI's Responses API and shows citations. Search mode works without a key.
- Course cards rendered from `data/courses.json`; fees are never hard-coded in the page.
- Bakery and Cooking filters, search, two campus sections, and a reserved FAQ section.
- A shared sign-up dialog with course-specific intakes, inline validation, and a nut-allergy warning. Consent to contact and optional marketing opt-in are separate.
- Sign-ups saved in this browser's `localStorage` under `cb_signups`, with a reference number and a prefilled email link. The form does not send a booking or submit to a backend.
- The sourdough starter guide landing section captures a guide request with required consent and separate optional marketing opt-in, then unlocks a four-page PDF. Requests stay in the visitor's browser and are not sent to the academy.
- A Cook & Bake Open House invitation gives the event date, both-campus details, and an email link for attendance enquiries.
- `admin.html` lists sign-ups saved in the same browser and exports CSV in the course sign-up format. It cannot access sign-ups from other browsers or devices.
- Semantic HTML, labelled controls, alt text, visible keyboard focus, and a responsive layout.

## Installation and local preview

No package manager or framework is needed to preview the committed site. Clone the repository and serve it over HTTP so the browser can fetch the course JSON and SQLite files:

```bash
git clone https://github.com/surfdude66/CNB-Academy.git
cd CNB-Academy
python -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765). Python 3 is the only tool needed for this local preview. Opening `index.html` directly as a `file://` page may block the data fetches.

To rebuild the knowledge base after editing `kb/*.md`, `kb/brochures/*.md`, or `data/courses.json`, use Node.js 22 or later:

```bash
npm ci
npm run build:kb
npm run eval
```

The build exports `data/academy.db`, copies it and the Markdown sources into `dist/`, and vendors the official SQLite WASM browser files. The evaluation uses the same retrieval module as the browser assistant and checks 30 example questions.

## Architecture

```text
index.html               Page structure and accessible controls
admin.html               Browser-local sign-up list and CSV export
css/styles.css           Layout, brand styles, and responsive rules
js/app.js                JSON loading, filtering, dialogs, and sign-up flow
js/chat.js               Browser SQLite chat panel and source links
js/chatgpt.js            Grounded Responses API request and citation handling
js/rag.js                Shared FTS5 query building, retrieval, and extractive answers
output/pdf/              Printable lead-magnet guide offered on the site
data/courses.json        Course content and fees
data/academy.db          Exported SQLite database
kb/                      Academy policies, FAQs, campus details, and brochures
scripts/build-kb.mjs     Rebuilds the database and published knowledge assets
scripts/eval.mjs         Checks shared retrieval against example questions
eval/golden-questions.csv  Evaluation questions and expected sources
vendor/sqlite/           Browser copy of the official SQLite WASM build
dist/                    Static copy published by Sites and GitHub Pages
.github/workflows/pages.yml  GitHub Pages deployment from dist/
.agents/commands/publish-to-github.md  Repeatable publishing workflow
scripts/check_secrets.py Pre-publication secret scan
```

The browser requests `data/courses.json`, then `js/app.js` builds the cards and applies category and text filters. Course detail dialogs read from the same data object. When a visitor opens the assistant, `js/chat.js` loads `data/academy.db` with SQLite WASM and uses `js/rag.js` to search it. ChatGPT mode sends retrieved sources through `js/chatgpt.js`; API failures use the search answer. The GitHub Pages workflow publishes only `dist/`; keep its site files and data in sync with the source before publishing.

## Publishing and security

Run `python scripts/check_secrets.py` before committing or pushing. It checks candidate files and Git history for common credentials and private key material without printing matching values. Review any finding and remove or rotate the credential before publication. The [Pages workflow](.github/workflows/pages.yml) repeats the check and deploys after a push to `main`.

Course photos load from Unsplash by image ID. A visitor may enter their own OpenAI API key for ChatGPT mode. It stays only in that tab's `sessionStorage`, and ChatGPT requests go directly from the browser to OpenAI; it is never saved to the repository or `localStorage`. Sign-up details, including contact details and allergies, and guide-request records remain in the browser's local storage until the user clears that storage; they are not shared across devices. Guide request consent is separate from optional marketing consent. The site does not send those records to the academy. Sending a prepared email is a separate action in the user's email app.
