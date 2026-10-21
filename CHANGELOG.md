# Changelog

## Farm tools: yield forecast, Kisan Yojana, official channels (21 Oct 2026)

### Added
- **Yield forecast** (`/yield`, `GET /api/v1/yield`): next season's district yield per acre for 20 crops,
  with a low-high range and the total for the farmer's acres. Trained on Government of India district
  crop statistics (DES, 1997-98 to 2024-25, 210,058 district-seasons) with
  `scripts/train_yield.py`. Time split, tested on 2018-19 onwards (53,832 district-seasons): median error
  10.7% vs 10.9% for last season's yield and 12.5% for the 5-year average;
  the range holds the real yield 82% of the time. Published per crop on `/eval`, including
  the crops where last season alone does better.
- **Kisan Yojana** (`/schemes`): 9 central and 15 state schemes, each checked against an official page
  with a date; only verified, still-running schemes are served. Live announcements from the
  Department of Agriculture's own press-release feed (cached an hour, last copy kept when it is down,
  only https `.gov.in`/`.nic.in` links shown).
- **Official channels** (`/community`): government WhatsApp channels, X, YouTube and helplines,
  national and by state, each with where the link is published. No farmer groups are invented;
  the page explains how to join a real block/tehsil group through the extension officer or KVK.
- Home tiles, sidebar "Farm tools" and More entries for the three tools; Hindi, Telugu, Tamil,
  Malayalam and Kannada labels.

### Changed
- Professional visual pass: Plus Jakarta Sans, calmer surfaces, line icons for crops instead of emoji.
- The offline copy of the app refreshes on every online visit (service worker v2).

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

## Interface rebuild (15 Oct 2026)

### Changed
- One design system (`static/css/theme.css`) and one layout (`templates/base.html`) across every
  page, replacing three inconsistent looks.
- Rewrote the login, signup, dashboard, soil, climate, result, history, profile and settings pages.
- Added interactions: button spinners, toasts, count-up figures, scroll reveals, confidence rings,
  Ctrl+K to the assistant, and auto-detection of the weather on arrival.

### Added
- `DEMO_MODE` (default on): sign in with any email and the password `1234`, stated plainly on the
  login page. `DEMO_MODE=0` turns it off; tests cover both states.

### Fixed
- Static files were missing from the deployment, so production rendered unstyled.

## No sign-in, live dashboard, profit estimate (16 Oct 2026)

### Removed
- Accounts, login, signup and demo mode. A cookie-based visitor id keeps each browser's history
  separate; no personal data is collected.

### Added
- A landing page: hero, how it works, eight features, mandi price band, helplines.
- `GET /api/v1/season` — live soil, weather, suited crops and prices for a city, cached 15 minutes.
- `GET /api/v1/profit` and `/api/v1/profit/compare`, plus a Profit tab on the crop plan.
- `data/input_costs.json` — seed, fertiliser and labour costs behind the profit estimate.
- A dashboard that is useful before you do anything: live conditions, what to sow this month,
  today's prices, and your own history.

### Fixed
- The landing page took 28 s on a cold cache. Pages now render in ~0.15 s and fill in live data
  afterwards; the soil sampling ring queries its points concurrently (~28 s → ~8 s).

## Auto-detect fixed (16 Oct 2026)

### Fixed
- Deployments had been failing silently: `functions` cannot be combined with `builds` in
  `vercel.json`. Moved to `api/index.py` + `rewrites`, so pushes actually reach production.
- A `ReadTimeout` from SoilGrids escaped as a 500 after 26 s; it now returns a readable 502.
- The sampling ring ran in parallel and tripped ISRIC's ~5 calls/minute limit, which is why most
  towns returned nothing. It is now sequential and stops at the first answer.
- The soil step no longer dead-ends when the service is down: it switches to manual entry.

### Added
- `data/soil_cache.json` plus `scripts/prefetch_soil.py` — real readings, collected when the
  service is healthy, so common towns answer in under a second.
- `/healthz` reports the soil cache path, whether it exists, and the knowledge-base size.

## One-day upgrade — impact, read-aloud, Crop Doctor (17 Oct 2026)

### Added
- `/impact`: the problem in four sourced facts (PIB, NITI-hosted EPW paper, Census 2011) and a
  calculator for what selling at the best mandi instead of the nearest is worth on one farm
  (`GET /api/v1/impact/mandi-gain`). The one figure with no verifiable source says "not measured".
- 🔊 Listen on every KrishiMitra answer and crop-plan card, using the browser's own speech
  synthesis in the chosen language, with a visible note when the device has no such voice.
- **Crop Doctor** (`/doctor`, `POST /api/v1/doctor`): photo → vision model (Pydantic-validated
  JSON, one retry) → guardrails (not a plant, poor photo, confidence < 0.6, instructions written in
  the image) → retrieval over 10 new cited disease documents → advice or escalation. Doses not
  found verbatim in a source are discarded. Labelled demo mode without a key. Photos never stored.
- `make eval-doctor`: a 23-photo gold set (PlantVillage CC BY-SA 3.0, CC0 Wikimedia, 3 injection
  photos) measuring top-1 accuracy, wrong and correct refusals, citation coverage, judged
  faithfulness, latency and cost. Shown on `/eval`; "not measured" until run with a key.
- Open Graph link previews, README rewrite, repository topics, screenshots.

### Fixed
- The impact calculator returned a 500 for an unknown town; it now returns a 404 with a sentence.
- The résumé bullets quoted a mandi comparison made on placeholder prices; removed.
- KrishiMitra cited a disease document for "when should I sow chickpea?"; disease documents now
  answer only questions about a sick plant. Quoted passages no longer show raw `##` marks.
- KrishiMitra refused a real disease question because the exact-name boost ranked the rice guide
  first; the "is this covered" decision now uses the best match among the results.
- `/eval` printed "<built-in method items of dict object>" instead of the number of gold items.

### Measured
- 174 automated checks pass. Retrieval re-measured with the new documents: Hit@5 1.00,
  MRR 0.944 (was 0.928), 5/5 attacks blocked, 0/30 false positives.

## AI switched on — measured with a real model (17 Oct 2026)

### Fixed
- The configured model (`google/gemini-2.0-flash-001`) had been retired, so every model call
  returned 404 and KrishiMitra answered with a 500. Now `google/gemini-2.5-flash-lite`, and any
  model-service failure (no credit, rate limit, outage) falls back to the cited passages instead.
- Questions in Hindi, Telugu, Tamil, Malayalam or Kannada found nothing, because retrieval is over
  English documents. They are translated for retrieval only; the answer stays in the farmer's
  language, and the guardrail also checks the translation, so an attack written in Hindi is blocked.
- Urea *per hectare* was answered with the calculator's *per-acre* figure (a 2.5x under-dose). The
  fertiliser tool now returns per-acre and per-hectare figures itself.
- The answer judge saw truncated passages and no tool results; it now sees exactly what the
  assistant saw, and checks units.

### Measured
- KrishiMitra, LLM judge on 10 questions asked 3 times: faithfulness 0.97 (0.90–1.00) and citation
  accuracy 1.00 (first run 0.60 / 0.80; 0.87 / 0.97 before the last fixes). One single run had
  scored 1.00 earlier; the repeated measurement replaced it, because one lucky run is not a result.
- Answers come back in the farmer's language (named in words, not a code — Hindi questions were
  sometimes answered in English), fertiliser questions run the calculator before the model, and
  local crop names (paddy, chana, arhar, moong…) are recognised.
- Crop Doctor, 23 photos: 92% top-1 accuracy (12/13), 0% wrong refusals, 5/5 non-plants refused,
  3/3 photo injections resisted, 13/13 judged faithful, $0.0002 and 2.6 s per check. Known
  failure: 0/2 grape black-rot photos escalated (called downy mildew), unchanged by two prompt fixes.

