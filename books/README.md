# NEET PYQ books

`.github/workflows/pyq-books.yml` builds, from `GET /api/v1/public/pyq-book`:

- `NEET-Physics-PYQs.pdf`, `NEET-Chemistry-PYQs.pdf`, `NEET-Biology-PYQs.pdf`: full subject books with a cover, contents (weightage and priority per chapter) and every chapter in NCERT order. Each chapter has its questions (newest year first), then an answer key, then solutions.
- `booklets/<subject>-<chapter>.pdf`: the same chapter on its own, as a free download.

These include only real NEET PYQs. CBSE board questions (ids starting `pyq`) and questions that need a figure are left out.

- **Institute edition:** Actions → NEET PYQ books → Run workflow, then enter the institute name and, optionally, a logo URL. The cover shows "Presented by …" and the footer shows "… · powered by YNeet".
- **Locally:** `npm install && node build.mjs --sample` (needs Chrome). Output goes to `out/`.
