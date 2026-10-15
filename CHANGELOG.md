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

## Phase 2 — an honest model (15 Oct 2026)

### Changed
- Two models replace one: **field** (nitrogen, pH, clay, organic carbon, weather — 96.95% accuracy,
  0.969 macro-F1) and **lab** (adds real N-P-K from a Soil Health Card — 99.59%, 0.996). Both by
  stratified 5-fold cross-validation.
- Phosphorus and potassium are no longer invented. The regressors that guessed them are deleted.
- Rainfall is the accumulated total scaled to a 30-day basis, not the old `× 3, floor 50`.

### Added
- `scripts/train.py` — compares four model families, writes `models/*.joblib` and `docs/metrics.json`.
- `predictor.py` — prediction, SHAP reasons and the outlier check in one place.
- `docs/MODEL_CARD.md` — metrics, weakest crops, confusions, limits.
- Per-crop reasons on the result page, a warning banner for unusual readings, and a line saying
  whether the soil figures were measured or estimated.
- Tests extended to 31 checks, all passing.

### Removed
- `model.pkl`, `features.pkl`, `p_model.pkl` (54 MB), `k_model.pkl`, `scaler.pkl` (never used),
  `train_model.py`, `train_pk_models.py`.

## Phase 3 — FastAPI, database layer and JWT auth (15 Oct 2026)

### Added
- `main.py` — one FastAPI app serving the pages and `/api/v1`, with OpenAPI docs at `/docs`.
- `/api/v1`: `auth/signup`, `auth/login`, `auth/logout`, `me`, `soil`, `weather`, `predict`, `history`.
- `cropwise/database.py` — SQLAlchemy models (users, predictions, mandi price cache) behind one
  `DATABASE_URL`; SQLite locally, Postgres in production without a code change.
- `cropwise/security.py` — PBKDF2 password hashing and JWT sessions in an httpOnly cookie.
- `cropwise/schemas.py` — typed request and response bodies; out-of-range readings are refused.
- `Makefile` (`make run`, `make test`, `make train`), `tests/test_api.py` (30 checks).

### Changed
- Python 3.11 throughout. Flask removed; `app.py` deleted.
- Predictions are stored per user, with the model used and whether the readings were unusual.

## Phase 4 — the crop plan (15 Oct 2026)

### Added
- `data/crop_calendar.json` — season, sowing months, duration, N-P-K requirement and typical yield
  for all 22 crops, with sources and a verification flag.
- `/plan/{crop}` — a five-tab plan: timeline, fertiliser, shops near me, mandi prices, best market.
- `GET /api/v1/plan/{crop}` (timeline + fertiliser, soil test optional),
  `GET /api/v1/stores` (OpenStreetMap), `GET /api/v1/mandi` (cached Agmarknet prices and trend),
  `GET /api/v1/best-market` (ranked by net price after transport).
- Links from each recommended crop straight into its plan.
- `tests/test_plan.py` — 24 checks covering the calendar, fertiliser maths, mock labelling and ranking.

### Notes
- Mandi prices are labelled MOCK until `DATA_GOV_IN_API_KEY` is set. They are never shown as real.

## Deployed (15 Oct 2026)

- Live at https://cropwise-six.vercel.app, connected to `jiyasiwach/cropwise` for automatic deploys.
- **Fixed a fabricated reading:** SoilGrids publishes nothing under built-up land, and the app had
  been substituting hard-coded averages and showing them as measurements. It now samples nearby
  farmland and says how far away the sample came from, or asks for a Soil Health Card.
- Models compressed 68 MB → 10 MB; SHAP moved to `requirements-dev.txt` with a range-based
  explanation fallback in production.
