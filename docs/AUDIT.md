# CropWise — repository audit

Audited 15 Oct 2026 against the source zip (`Crop-Recommendation-system-main`) and the live site
<https://crop-recommendation-ashy.vercel.app>.

## 1. What is in the repository

| File | What it is |
|---|---|
| `app.py` (424 lines) | The whole backend: Flask app, SQLite setup, 10 routes, two external API calls |
| `train_model.py` | Trains the crop classifier (RandomForest, 400 trees) on the 9-feature CSV |
| `train_pk_models.py` | Trains the two regressors that invent P and K from soil + weather |
| `Crop_recommendation.csv` | Original Kaggle set: N, P, K, temperature, humidity, ph, rainfall, label (2 200 rows, 22 crops) |
| `Crop_recommendation_9_features.csv` | Derived set actually used for training (P, K, nitrogen, ph, clay, organic_carbon, temperature, humidity, rainfall, label) |
| `model.pkl`, `features.pkl` | The classifier and its feature order |
| `p_model.pkl`, `k_model.pkl` | joblib regressors for phosphorus and potassium |
| `scaler.pkl` | Present but never loaded by `app.py` — dead file |
| `cropwise.db` | SQLite, one table `history`. **Was committed with data in it.** Removed; it is now generated at runtime |
| `templates/` | 7 Jinja pages: login, dashboard, soil, climate, result, history, profile |
| `static/` | `css/login.css`, `css/dashboard.css`, `js/lang.js` (6-language dictionary), 3 images |
| `tempCodeRunnerFile.py` | Editor scratch file. Removed |

Missing entirely: `requirements.txt`, `vercel.json`, `.gitignore`, `.env.example`, tests, README,
Docker, CI.

## 2. External services actually called

| Endpoint | Service | Key needed |
|---|---|---|
| `/get_soil_by_city` | Open-Meteo **geocoding** (city → lat/lon), then **ISRIC SoilGrids v2** `properties/query` for nitrogen, phh2o, clay, soc at 0–5 cm | None (both free, unauthenticated) |
| `/get_weather_by_city` | Open-Meteo **forecast** (`temperature_2m_mean`, `precipitation_sum`, `relative_humidity_2m`) | None |

No other third-party service is used. There is no LLM, no map, no market data.

## 3. How passwords are stored

**They are not.** `/login` accepts any address ending in `@gmail.com` with any non-empty password
and puts the address straight into the session. There is no user table, no hashing, no signup, and
no password check of any kind. Anyone can sign in as anyone. This is the single most serious
defect in the project and is fixed in Phase 1.

## 4. The unit question (N-P-K)

This is the subtle one, and the brief was right to flag it.

- The Kaggle set stores **N, P, K as kg/ha ratios** (N 0–140, P 5–145, K 5–205).
- The derived 9-feature set keeps **P and K in those Kaggle units** (verified: P 5–145, K 5–205)
  but replaces N with a **SoilGrids-style total nitrogen in g/kg** (verified: 0.37–2.71), and adds
  clay % and organic carbon g/kg.
- At runtime `/get_soil_by_city` divides the SoilGrids values the way SoilGrids documents
  (nitrogen cg/kg ÷ 100 → g/kg, phh2o ÷ 10, clay ‰ ÷ 10, soc dg/kg ÷ 10). **Those conversions are
  correct**, and the nitrogen fed to the model is in the same unit the model was trained on.

So there is no raw unit mismatch on nitrogen. The real problem is different, and worse:

> **P and K are never measured.** SoilGrids does not publish them, so `p_model.pkl` and
> `k_model.pkl` *predict* P and K from (nitrogen, ph, clay, organic_carbon, temperature, humidity,
> rainfall) — the very features the classifier then uses. The classifier is handed two inputs that
> are a deterministic function of its other inputs, learned from the same 2 200 rows. They add no
> information, they inflate apparent confidence, and any error compounds. Nothing in the UI tells
> the farmer that P and K are guesses.

Fix (Phase 2): drop the P/K regressors from the prediction path, train the classifier on the
features we can actually observe, and let a real **Soil Health Card** reading supply P and K when
the farmer has one. Every value shown gets a source label: *measured*, *estimated*, or *typed in*.

Also noted for Phase 2: `/get_weather_by_city` computes
`rainfall = max(sum(daily precipitation) * 3, 50)`. The ×3 and the floor of 50 are arbitrary and
undocumented — they exist to push Open-Meteo totals into the range the Kaggle "rainfall" column
occupies. That is fabrication; it must be replaced with a documented mapping to the same
accumulation window the dataset uses.

## 5. Defects found (beyond those listed in the brief)

1. **No authentication anywhere that matters.** `/dashboard`, `/soil`, `/climate`, `/predict`,
   `/get_soil_by_city`, `/get_weather_by_city` have no session check. Only `/history` and
   `/profile` do.
2. `app.secret_key = "secret"` is hard-coded, so sessions can be forged by anyone reading the repo.
3. `/profile` **does** exist and works — the brief said it 404s. What is broken is that no page
   links to it: the sidebar entry is `href="#"` in all six app templates.
4. The Results and Settings sidebar links are `href="#"` in all six templates.
5. "Sign Up" on the login page is `href="#"`; there is no registration path at all.
6. `app.py` has no `app.run()`. The file ends with `webbrowser.open(...)`, so running
   `python app.py` opens a browser tab at a server that never starts.
7. `cropwise.db` was committed, so previous users' history shipped with the source.
8. The prediction result is written to the history table even when the user is not signed in; the
   `email` column is then an empty string.
9. `scaler.pkl` is loaded by nothing — the model was trained on unscaled features.
10. No `requirements.txt`, so the deployment's dependency set is unpinned and unreproducible.
11. Inconsistent page structure: the sidebar markup is copy-pasted into six templates, and
    `soil.html` carries its own inline `<style>` block.

## 6. Phase 1 scope (done in this pass)

Items 1, 2, 3, 4, 5, 6, 7, 8, 10 above, plus signup with hashed passwords. Everything else is
scheduled into the later phases in `docs/DECISIONS.md`.
