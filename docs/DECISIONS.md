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

## Phase 2 — an honest model (15 Oct 2026)
- Split one model into two: a **field** model over what SoilGrids and Open-Meteo actually publish, and a **lab** model that uses real N-P-K from a Soil Health Card. Nothing is inferred to fill a gap.
- Deleted `p_model.pkl` and `k_model.pkl`: predicting phosphorus and potassium from the classifier's own inputs added no information and inflated confidence. The 54 MB file also exceeded GitHub's size guidance.
- Reported **stratified 5-fold cross-validation** instead of a single hold-out split: field 0.9695 accuracy / 0.9693 macro-F1, lab 0.9959 / 0.9959.
- Compared RandomForest, ExtraTrees, HistGradientBoosting and LogisticRegression; RandomForest won both. LightGBM and XGBoost were dropped because this macOS Python cannot load `libomp`.
- Added an IsolationForest per model (contamination 0.02) so unusual readings produce a warning instead of a confident answer; the dataset covers 22 crops in typical conditions and nothing else.
- Explanations come from SHAP values for the individual prediction, worded as "rainfall 202.9mm suits this crop", and are shown as tick or warning chips. A failure to explain never blocks a prediction.
- Replaced the `rainfall × 3, floor 50` fudge with the accumulated total scaled to a 30-day basis, and recorded that the dataset's own accumulation window is undocumented — a known weakness, not a solved problem.
- Soil and climate pages now leave phosphorus and potassium empty with "Needs a soil test" rather than showing a guess as a reading.
- Models moved to `models/*.joblib` (joblib, with the feature order stored alongside), replacing loose pickles at the repo root.

## Phase 3 — FastAPI, a real data layer and JWT auth (15 Oct 2026)
- Moved to **Python 3.11**: the Mac's default 3.9 cannot express `str | None` for Pydantic v2, and Vercel runs 3.12 anyway.
- One FastAPI app serves **both** the JSON API and the existing Jinja pages, rather than running two servers. The farmer-facing site keeps working while the React front end is built in Phase 8.
- Kept the Flask-shaped `url_for` as a Jinja global, so the six templates needed no rewrite for a framework change.
- **SQLAlchemy with a single `DATABASE_URL`**: SQLite by default so the project runs with no setup, Postgres (Supabase) by changing one variable. `postgres://` is rewritten to `postgresql+psycopg2://`, which SQLAlchemy 2 requires.
- Postgres was not provisioned because that needs the owner's Supabase account; the code is ready for it and the README says what to set.
- Sessions are a **signed JWT in an httpOnly, SameSite=Lax cookie**, not a Flask session: the app is then stateless, which is what lets it run on Vercel's functions, and no token is reachable from JavaScript.
- The cookie is `Secure` only in production, so the app still works over plain `http://localhost`.
- The wizard carries its soil readings in hidden form fields instead of a server session, for the same statelessness reason.
- Pydantic schemas bound every input (pH 0–14, humidity 0–100, rainfall 0–5000), so nonsense is refused at the edge with a 422 rather than reaching the model.
- Login failures return one neutral message for "no such account" and "wrong password" alike.
- CORS is an allow-list from `CORS_ORIGINS`, defaulting to localhost only.
- Password hashing stays Werkzeug PBKDF2-SHA256 at 600k iterations: bcrypt needs a compiler this machine does not have, and this is the one dependency Flask leaves behind.

## Phase 4 — the crop plan (15 Oct 2026)
- Put every agronomic number in `data/crop_calendar.json` with its sources and a `needs_verification: true` flag, rather than scattering them through the code. The file states plainly that these are general all-India figures, and every screen that shows them repeats the warning.
- A crop with no calendar entry returns 404 and a page that says so. The app never improvises a sowing date or a dose.
- Sowing windows are computed from today, so the farmer reads "sow by 30 Nov 2026", not "Rabi". When today falls outside the window, no "today" marker is drawn on the timeline.
- Fertiliser is quoted as bags to buy, not nutrients: DAP first for phosphorus, then urea for whatever nitrogen the DAP has not already supplied, then MOP. A soil test credits what is in the field; with no test the full dose is shown **and the assumption is printed**.
- Shops come from **OpenStreetMap via Overpass**, with a second mirror when the first is busy, because it is free and needs no key. An empty result says "nothing is mapped nearby", not "nothing is there".
- Unnamed OpenStreetMap pins are dropped: a marker with no name helps nobody.
- Mandi prices use the data.gov.in Agmarknet resource, **cached per market per day**, because that API is slow and often down. A stale row with its date beats an empty page.
- Without `DATA_GOV_IN_API_KEY` the app serves four clearly labelled MOCK mandis near the farmer, so the ranking can be demonstrated. Every row, the source line and the page carry the MOCK label.
- "Best market" ranks by **net price = modal − distance × ₹/quintal/km** (default ₹2.5, configurable). The method line is shown to the farmer, including that straight-line distance makes the gain an upper bound. Mandis without coordinates are listed separately rather than ranked on a guessed distance.

## Deployment and a soil-data finding (15 Oct 2026)
- Deployed to Vercel on the owner's personal account and connected to `jiyasiwach/cropwise`, so every push to `main` deploys itself.
- **SHAP is not installed in production.** It and its numba/llvmlite chain blow past the serverless size limit, so explanations fall back to per-crop percentile ranges computed at training time: "rainfall 203 mm is in the usual range for rice (154-262 mm)". Arguably clearer than a SHAP value, and free at runtime. SHAP stays in `requirements-dev.txt` and still runs locally.
- Model files are saved with `compress=3`: 68 MB → 10 MB, identical model.
- **Found while testing the live site:** SoilGrids returns `null` for every property at a city-centre coordinate, because it masks built-up land. The original app silently replaced those nulls with hard-coded national averages and displayed them as measured readings — a fabricated number presented as data. Now the app samples a ring of points 10 km (then 25 km) out until it finds mapped farmland, returns the real values, and tells the farmer the sample came from 10 km away. If nothing is found within 25 km it says so and asks for a Soil Health Card instead of inventing anything.

_Deployments are authored with the GitHub-linked identity so Vercel accepts them._

## Interface rebuild and demo sign-in (15 Oct 2026)
- The app had three different looks (a photo-backed login, a Times New Roman dashboard, inline styles on the soil page). Replaced with one design system in `static/css/theme.css` and one Jinja layout, `templates/base.html`, so every page shares the sidebar, the mobile bottom bar and the same components.
- **Did not start the React rebuild for this.** The server-rendered pages reach the same "field & harvest" design in a fraction of the time, and the React work (Phase 8) can replace them without changing a single endpoint.
- Entrance animations are gated behind a `js` class the script adds. A page whose JavaScript fails now shows everything rather than nothing — the first version had it the wrong way round, and the content was invisible.
- Interactions added: in-flight button states with a spinner, toasts, count-up numbers, scroll-reveal, confidence rings, Ctrl+K to the assistant, and the weather step auto-detecting on arrival rather than making the farmer press another button.
- Kept the six-language dictionary working by **matching the new wording to the keys that already exist** (Dashboard, Soil & Climate, Results, History, Profile, Settings). New features — KrishiMitra, the evaluation page, the crop plan — have no translations yet and are English-only rather than machine-translated into six languages without a speaker to check them.
- **`DEMO_MODE` (on by default for now):** any email signs in with the password `1234`, and the account is created on first use. The login page says so in a banner, `DEMO_MODE=0` turns it off, and a test asserts both the behaviour and the off switch. This is a deliberate, visible weakening for demonstrations, not an accident — it must be off before any real farmer data goes in.

## No sign-in, and pages that never wait on an upstream service (16 Oct 2026)
- **Removed accounts entirely.** A random id in a cookie separates one browser's history from another's; no email, password, name or phone is collected. The login, signup and demo-mode code is gone rather than disabled, and `UserOut.email` is now a plain string because the internal address is not a mailbox. Putting real accounts back means restoring the login page and reading the same `User` row from a token — nothing else changes.
- **Landing page added** as the front door, with the hero, how-it-works, feature grid, mandi band and helplines from the design brief. Its first button starts an analysis; there is nothing to sign up for.
- **Pages no longer block on SoilGrids or Open-Meteo.** The landing page took 28 seconds on a cold cache — longer than a serverless function is allowed to live — because it waited on both. Pages now render from the local crop calendar in about 0.15 s, and the browser fetches `/api/v1/season` afterwards to fill in live conditions, crops and prices. A slow soil service now costs one card, not the page.
- The soil sampling ring queries its points **concurrently** instead of one after another, which took the lookup from ~28 s to ~8 s.
- Snapshots are cached for fifteen minutes per city, and the last good one is served if a refresh fails, so an outage does not blank the page.
- **Dashboard now shows something on a first visit**: live temperature, humidity, rainfall, nitrogen, pH and clay; the crops whose sowing window is open this month; today's mandi prices; and the visitor's own history once they have any.
- **Profit estimate added** (`/api/v1/profit`, and a tab on the crop plan): yield from the calendar × modal mandi price − seed, fertiliser, labour and other costs from `data/input_costs.json`. Every assumption is printed with the answer, and the costs file is marked `needs_verification` like the calendar.
- Crops are shown with a symbol and a tint per family rather than photographs: a photo of the wrong variety is worse than an honest mark, and symbols load instantly on a slow connection.
