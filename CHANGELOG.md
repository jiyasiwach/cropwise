# Changelog

## Phase 1 — audit and repair (15 Oct 2026)

### Security
- Real accounts: `/signup` with hashed passwords, a `users` table, and login checked against it.
- Every data route (`/dashboard`, `/soil`, `/climate`, `/predict`, `/history`, `/profile`,
  `/settings`, and both lookup APIs) now requires a session. Previously only two did.
- `SECRET_KEY` read from the environment instead of the hard-coded string `"secret"`.
- Removed the Gmail-only sign-in rule.
- Removed the committed `cropwise.db`, which contained real usage history.

### Fixed
- The Sign Up link worked nowhere; it now opens a real registration page.
- The Results, Profile and Settings links were `href="#"` in all six app pages.
- Added the missing Settings page.
- `python app.py` opened a browser at a server that never started; it now runs the server.
- One database path is used everywhere (`CROPWISE_DB`, `/tmp` on Vercel).

### Added
- `docs/AUDIT.md` — full audit, including the N-P-K unit finding.
- `docs/DECISIONS.md`, this changelog, `requirements.txt`, `.env.example`, `.gitignore`,
  `vercel.json`, and `tests/test_phase1.py` (22 checks, all passing).
- Retrained `model.pkl`, `p_model.pkl`, `k_model.pkl` against the pinned scikit-learn.
