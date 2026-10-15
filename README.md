# CropWise

An AI farming assistant for Indian smallholders: tell it your city, and it reads the soil and
weather for that location, recommends crops, and (from Phase 4 onward) tells you when to sow,
what fertiliser to buy, where to buy it, and which mandi pays best after transport.

**Status: Phase 1 of 10 complete.** See `CHANGELOG.md` for what has shipped and
`docs/AUDIT.md` for the state of the original code.

## Run it locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # then set SECRET_KEY
python app.py            # http://127.0.0.1:5000
```

## Tests

```bash
python tests/test_phase1.py
```

## How it works today

| Step | What happens |
|---|---|
| Sign up / log in | Accounts in SQLite, passwords hashed with PBKDF2-SHA256 |
| Soil | City → Open-Meteo geocoding → ISRIC SoilGrids (nitrogen, pH, clay, organic carbon at 0–5 cm) |
| Climate | Open-Meteo forecast over 1 / 15 / 30 days (mean temperature, humidity, rainfall) |
| Predict | RandomForest over 9 features → top 3 crops with confidence, saved to your history |

Neither external API needs a key; both are free.

## Known limits (being fixed in Phase 2)

- **Phosphorus and potassium are estimated, not measured.** SoilGrids does not publish them, so two
  regressors infer them from the other soil and weather values. They are shown as if measured, and
  they should not be. A real Soil Health Card reading will replace them.
- The rainfall figure multiplies the Open-Meteo total by 3 with a floor of 50 mm, which is an
  undocumented fudge to match the training data's range.
- Model accuracy is reported on a single hold-out split, not cross-validation, and the test set
  shares the P/K leakage described above, so 99% is flattering rather than honest.

## Deployment

Vercel (`vercel.json`, `@vercel/python`). Note that on Vercel the SQLite file lives in `/tmp` and is
wiped on every cold start, so accounts do not persist there. Phase 3 moves the database to Postgres.

## Roadmap

1. ~~Audit and repair~~ ✅
2. Honest retrain: cross-validation, model card, SHAP reasons, out-of-distribution warnings
3. FastAPI backend, Postgres, JWT auth
4. Crop plan: calendar, fertiliser, nearby shops, mandi prices, best market to sell
5. KrishiMitra: hybrid RAG, agent tools, guardrails, streaming
6. Evaluation harness and `/eval` dashboard
7. Leaf disease, Soil Health Card reader, profit calculator, irrigation, alerts, schemes, PWA
8. React + Tailwind rebuild to the "field & harvest" design, 9 languages
9. Voice bot, phone helpline, human handover, support desk
10. Docker, CI, deploy
