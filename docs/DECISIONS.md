# Engineering decisions

One line each, newest last. Every decision the owner did not make personally is recorded here.

## Phase 1 — audit and repair (15 Oct 2026)
- Kept Flask for Phase 1 rather than rewriting immediately, so the live site stops being broken today instead of in a fortnight.
- Added a real `users` table with Werkzeug PBKDF2-SHA256 hashes; the old "any Gmail address plus any password" sign-in was an open door.
- Chose PBKDF2 over scrypt because this Mac's Python is built against LibreSSL and has no `hashlib.scrypt`; PBKDF2-SHA256 at Werkzeug defaults is still sound.
- Put every data route behind one `@login_required` decorator instead of per-route `if` statements, so a new route cannot silently be left open.
- API routes answer `401 JSON` while pages redirect, so the fetch calls in the templates fail cleanly.
- `SECRET_KEY` now comes from the environment and falls back to a random value per process; the hard-coded `"secret"` let anyone forge a session.
- Dropped the Gmail-only restriction: it blocked real farmers and protected nothing.
- Login failures say one neutral sentence for both "no such account" and "wrong password", so the form cannot be used to discover who has an account.
- Pointed the dead Results link at History (the real list of past results) rather than inventing a new page; Profile and Settings now point at the pages that exist.
- Added a small Settings page (account, language, data sources) because the nav promised one.
- Deleted the committed `cropwise.db`: it shipped other people's history inside the source.
- Deleted `tempCodeRunnerFile.py` (editor scratch) and left `scaler.pkl` in place but unused, pending the Phase 2 retrain that will remove it.
- Replaced the stray `webbrowser.open()` at the end of `app.py` with a real `app.run()`, so `python app.py` starts the server.
- Pinned dependencies in `requirements.txt` and retrained the three model files with the pinned scikit-learn, because the committed pickles were built on 1.7.0 and loaded under 1.5.1 with a correctness warning.
- On Vercel the SQLite file goes to `/tmp`, which is wiped between cold starts: accounts will not persist there until Phase 3 moves the database to Postgres. This is stated in the README rather than hidden.
