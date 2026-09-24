# Cook & Bake Academy

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black) ![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-deployed-222222?logo=github)

A responsive course catalogue for hands-on cooking and baking classes in Singapore. Visitors can browse 20 courses, filter Bakery or Cooking classes, search by keyword, view course details, and prepare a course sign-up.

**Live site:** [surfdude66.github.io/CNB-Academy](https://surfdude66.github.io/CNB-Academy/)

## Overview

- Three-photo hero and clear paths to browse courses or use the guided course assistant.
- Course cards rendered from `data/courses.json`; fees are never hard-coded in the page.
- Bakery and Cooking filters, search, two campus sections, and a reserved FAQ section.
- A shared sign-up dialog with course-specific intakes, inline validation, and a nut-allergy warning. Consent to contact and optional marketing opt-in are separate.
- Sign-ups saved in this browser's `localStorage` under `cb_signups`, with a reference number and a prefilled email link. The form does not send a booking or submit to a backend.
- `admin.html` lists sign-ups saved in the same browser and exports CSV in the course sign-up format. It cannot access sign-ups from other browsers or devices.
- Semantic HTML, labelled controls, alt text, visible keyboard focus, and a responsive layout.

## Installation and local preview

No package manager or framework is required. Clone the repository and serve it over HTTP so the browser can fetch the course JSON file:

```bash
git clone https://github.com/surfdude66/CNB-Academy.git
cd CNB-Academy
python -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765). Python 3 is the only tool needed for this local preview. Opening `index.html` directly as a `file://` page may block the JSON fetch.

## Architecture

```text
index.html               Page structure and accessible controls
admin.html               Browser-local sign-up list and CSV export
css/styles.css           Layout, brand styles, and responsive rules
js/app.js                JSON loading, filtering, dialogs, and sign-up flow
data/courses.json        Course content and fees
dist/                    Static copy used by the existing Sites deployment
.github/workflows/pages.yml  GitHub Pages deployment from dist/
.agents/commands/publish-to-github.md  Repeatable publishing workflow
scripts/check_secrets.py Pre-publication secret scan
```

The browser requests `data/courses.json`, then `js/app.js` builds the cards and applies category and text filters. Course detail dialogs read from the same data object. The GitHub Pages workflow publishes only `dist/`; when site files change, copy the matching `index.html`, `css/`, `js/`, and `data/` files into `dist/` before publishing.

## Publishing and security

Run `python scripts/check_secrets.py` before committing or pushing. It checks candidate files and Git history for common credentials and private key material without printing matching values. Review any finding and remove or rotate the credential before publication. The [Pages workflow](.github/workflows/pages.yml) repeats the check and deploys after a push to `main`.

Course photos load from Unsplash by image ID. The site stores no API keys or passwords. Sign-up details, including contact details and allergies, remain in the browser's local storage until the user clears that storage; they are not shared across devices. Sending the prepared email is a separate action in the user's email app.
