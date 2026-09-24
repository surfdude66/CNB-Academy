---
name: publish-to-github
description: Publish the Cook & Bake Academy site to GitHub and GitHub Pages, with README, repository metadata, and secret checks.
---

# Publish to GitHub

Use this project-level command when asked to publish or update this repository. Work in the repository root. Complete the steps and report the commit, workflow result, and live URL.

1. Inspect `git status`, the current branch, `origin`, and the site files. Preserve existing work and history. Confirm `origin` is `https://github.com/surfdude66/CNB-Academy.git` and use `main`. Never force-push.
2. Keep `README.md` accurate and professional. Include technology badges, overview, installation and local preview, architecture, security, and the verified GitHub Pages URL. Describe only features present in the code.
3. Keep `dist/index.html`, `dist/css/`, `dist/js/`, and `dist/data/` in sync with the source files. Keep `.github/workflows/pages.yml` configured to scan, upload `dist/`, and deploy on pushes to `main`.
4. Before any push, run `python scripts/check_secrets.py` and `git diff --check`. Review the working tree, staged files, and history for secrets or sensitive files. If a credential is found, stop publication, remove it from files and history as needed, and have it rotated. Never print a secret in output.
5. Commit the intended files and push to `origin/main` using the existing Git credentials. Never commit local environment files, credentials, or scan reports.
6. In repository Settings → Pages, confirm the source is **GitHub Actions**. Wait for the Pages workflow to finish successfully and open the live URL. Check the course data request, 20 rendered cards, Bakery count of 10, and the 375px layout.
7. Update the repository About description to a concise account of the academy site and set its website to the verified GitHub Pages URL. Confirm the About section shows both values.

If a required remote setting cannot be changed with available credentials or tools, finish all local work, report the exact blocker, and give the user the prepared URL or setting to apply.
