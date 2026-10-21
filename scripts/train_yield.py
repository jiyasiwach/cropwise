"""Train the district yield model on Government of India crop statistics.

Data: Directorate of Economics & Statistics (DES), Ministry of Agriculture & Farmers Welfare,
district x season x crop "Area, Production and Yield", via India Data Portal (ODC-By 1.0;
original on data.gov.in under GODL-India). The two CSVs are ~73 MB, so they are not committed;
data/yield/SOURCE.json records where they came from and their checksums.

    python scripts/train_yield.py <folder with the two CSVs>

What it predicts: next season's average yield (per hectare) for a crop in a district, with a
10th-90th percentile range. A farmer's own field can do better or worse than the district
average; the app says so.

How it is judged: train on seasons up to 2017-18, test on 2018-19 onwards (time split, never
shuffled), against two honest baselines - the district's own 5-year average and last year's
yield. The results are written to docs/yield_eval.json and shown in the app.
"""

from __future__ import annotations

import json
import pathlib
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from cropwise.services.yield_model import features  # noqa: E402  (shared with the API)

ROOT = pathlib.Path(__file__).resolve().parents[1]
PRIMARY = "idp_crop_wise_apy_1997_2023.csv"
UPAG = "idp_upag_apy_2013_2025.csv"
TEST_FROM = 2018  # first test season starts 2018-19

# app crop -> (name in the 1997-2023 file, name in the UPAG file, factor to tonnes in the 1997-2023 file)
# Cotton and jute are recorded in bales there (170 kg and 180 kg) although labelled tonnes.
CROPS = {
    "rice": ("Rice", "Rice", 1.0),
    "wheat": ("Wheat", "Wheat", 1.0),
    "maize": ("Maize", "Maize", 1.0),
    "bajra": ("Bajra", "Bajra", 1.0),
    "jowar": ("Jowar", "Jowar", 1.0),
    "chickpea": ("Gram", "Gram", 1.0),
    "pigeonpeas": ("Arhar/Tur", "Tur", 1.0),
    "mungbean": ("Moong(Green Gram)", "Moong", 1.0),
    "blackgram": ("Urad", "Urad", 1.0),
    "lentil": ("Masoor", "Lentil", 1.0),
    "mothbeans": ("Moth", None, 1.0),
    "groundnut": ("Groundnut", "Groundnut", 1.0),
    "soybean": ("Soyabean", "Soybean", 1.0),
    "mustard": ("Rapeseed &Mustard", "Rapeseed & Mustard", 1.0),
    "sugarcane": ("Sugarcane", "Sugarcane", 1.0),
    "cotton": ("Cotton(Lint)", "Cotton", 0.170),
    "jute": ("Jute", "Jute", 0.180),
    "potato": ("Potato", None, 1.0),
    "onion": ("Onion", None, 1.0),
    "banana": ("Banana", None, 1.0),
}
# The 1997-2023 file splits seasons more finely than the newer file. This mapping makes the two
# agree on 99.6-100% of district totals in the overlapping years (checked for rice, wheat,
# maize and sugarcane).
SEASON = {"Kharif": "Kharif", "Autumn": "Kharif", "Whole Year": "Kharif", "Winter": "Rabi",
          "Rabi": "Rabi", "Summer": "Summer"}
MIN_AREA_HA = 50  # tiny plantings give wild yields that say nothing about a district
# Chosen on validation seasons 2014-15 to 2017-18 (trained on earlier ones) before the test
# seasons were scored: this small set beat a larger one with lags, area, state and year
# (13.8% vs 13.9-14.1% median error), a tuned blend of last season and the 5-year average
# (14.0%) and last season alone (15.0%). Year was dropped because trees cannot extrapolate it.
FEATURES = ["crop", "season", "logratio_base", "lag2", "trend", "n_hist", "state_last"]
CATEGORICAL = [0, 1]


def load(folder: pathlib.Path) -> pd.DataFrame:
    p = pd.read_csv(folder / PRIMARY)
    p = p[p.season != "Total"]
    frames = []
    last_primary = int(p.year.str[:4].max())
    u = pd.read_csv(folder / UPAG)
    for crop, (pname, uname, factor) in CROPS.items():
        a = p[p.crop_name == pname].copy()
        a["production"] = a["production"] * factor
        a["crop"] = crop
        frames.append(a)
        if uname:  # newer seasons the 1997-2023 file does not have
            b = u[(u.crop_name == uname) & (u.year.str[:4].astype(int) > last_primary)].copy()
            b["crop"] = crop
            frames.append(b)
    df = pd.concat(frames, ignore_index=True)
    df["season"] = df.season.map(SEASON)
    df["year"] = df.year.str[:4].astype(int)
    df = df.dropna(subset=["season", "district_code", "area", "production"])
    df["district_code"] = df.district_code.astype(int)
    df = (df.groupby(["crop", "season", "state_name", "district_code", "year"], as_index=False)
            .agg(area=("area", "sum"), production=("production", "sum"),
                 district_name=("district_name", "last")))
    df = df[(df.area >= MIN_AREA_HA) & (df.production > 0)]
    df["yield"] = df.production / df.area
    # Drop recording errors: yields beyond 5x either side of that series' median.
    med = df.groupby(["crop", "season", "district_code"])["yield"].transform("median")
    return df[(df["yield"] < med * 5) & (df["yield"] > med / 5)].reset_index(drop=True)


def state_medians(df: pd.DataFrame) -> dict:
    out = {}
    g = df.groupby(["crop", "season", "state_name", "year"])["yield"].median()
    for (crop, season, state, year), v in g.items():
        out[(crop, season, state, year)] = float(v)
    # 5-year state baseline ending the year before `year`
    for (crop, season, state), s in g.groupby(level=[0, 1, 2]):
        s = s.droplevel([0, 1, 2])
        for year in range(int(s.index.min()) + 2, int(s.index.max()) + 2):
            w = s[(s.index < year - 1) & (s.index >= year - 6)]
            if len(w):
                out[(crop, season, state, "base", year)] = float(w.mean())
    return out


def build_rows(df: pd.DataFrame, smed: dict, codes: dict) -> pd.DataFrame:
    rows = []
    for (crop, season, _), series in df.groupby(["crop", "season", "district_code"]):
        series = series.sort_values("year")
        years, yields, areas = series.year.tolist(), series["yield"].tolist(), series.area.tolist()
        state = series.state_name.iloc[-1]
        for year, actual in zip(years, yields):
            f = features(years, yields, areas, year, smed.get((crop, season, state, year - 1)),
                         smed.get((crop, season, state, "base", year)))
            if f is None:
                continue
            rows.append({**f, "crop": codes["crop"][crop], "season": codes["season"][season],
                         "state": codes["state"][state], "year": year,
                         "target": np.log(actual / f["anchor"]), "actual": actual, "crop_name": crop})
    return pd.DataFrame(rows)


def fit(X: pd.DataFrame, y: pd.Series) -> dict:
    models = {}
    for q in (0.1, 0.5, 0.9):
        m = HistGradientBoostingRegressor(loss="quantile", quantile=q, max_iter=300, learning_rate=0.05,
                                          min_samples_leaf=200, early_stopping=False,
                                          categorical_features=CATEGORICAL, random_state=7)
        m.fit(X[FEATURES], y)
        # Only used while fitting; its pickled random generator ties the file to one numpy version
        # (numpy 2 pickles cannot be read by the 1.26 that the server runs).
        m._feature_subsample_rng = None
        models[q] = m
    return models


def score(t: pd.DataFrame, models: dict) -> dict:
    p50 = t.anchor * np.exp(models[0.5].predict(t[FEATURES]))
    p10 = t.anchor * np.exp(models[0.1].predict(t[FEATURES]))
    p90 = t.anchor * np.exp(models[0.9].predict(t[FEATURES]))
    last = t.base * np.exp(t.lag1.fillna(0))  # last year's yield where there was one

    def ape(pred):
        return (np.abs(pred - t.actual) / t.actual)

    res = {
        "rows": int(len(t)),
        "model_median_error_pct": round(float(ape(p50).median() * 100), 1),
        "baseline_5yr_mean_median_error_pct": round(float(ape(t.base).median() * 100), 1),
        "baseline_last_year_median_error_pct": round(float(ape(last).median() * 100), 1),
        "within_10pct": round(float((ape(p50) <= 0.10).mean()), 3),
        "within_20pct": round(float((ape(p50) <= 0.20).mean()), 3),
        "range_coverage_p10_p90": round(float(((t.actual >= p10) & (t.actual <= p90)).mean()), 3),
    }
    return res


def main(folder: pathlib.Path) -> None:
    df = load(folder)
    codes = {
        "crop": {c: i for i, c in enumerate(sorted(df.crop.unique()))},
        "season": {s: i for i, s in enumerate(["Kharif", "Rabi", "Summer"])},
        "state": {s: i for i, s in enumerate(sorted(df.state_name.unique()))},
    }
    smed = state_medians(df)
    rows = build_rows(df, smed, codes)
    print(f"{len(df):,} district-seasons, {len(rows):,} training rows")

    train, test = rows[rows.year < TEST_FROM], rows[rows.year >= TEST_FROM]
    models = fit(train, train.target)
    overall = score(test, models)
    per_crop = {c: score(g, models) for c, g in test.groupby("crop_name") if len(g) >= 30}
    print(json.dumps(overall, indent=2))

    # Final model: all seasons, so the newest years shape the forecast.
    final = fit(rows, rows.target)

    # What the API needs at prediction time: each district's recent history and state baselines.
    latest = {}
    for (crop, season, dcode), s in df.groupby(["crop", "season", "district_code"]):
        s = s.sort_values("year").tail(6)
        if len(s) < 2:
            continue
        latest[f"{crop}|{season}|{dcode}"] = {
            "state": s.state_name.iloc[-1], "district": s.district_name.iloc[-1],
            "years": s.year.tolist(), "yield": [round(v, 4) for v in s["yield"]],
            "area": [round(v, 1) for v in s.area],
        }
    years = sorted(df.year.unique())
    bundle = {
        "models": final, "features": FEATURES, "codes": codes, "history": latest,
        "state_median": {k: v for k, v in smed.items() if (k[3] if k[3] != "base" else k[4]) >= years[-1] - 7},
        "trained_on": f"{years[0]}-{str(years[0] + 1)[2:]} to {years[-1]}-{str(years[-1] + 1)[2:]}",
    }
    joblib.dump(bundle, ROOT / "models" / "yield.joblib", compress=3)

    source = json.loads((folder / "SOURCE.json").read_text())
    report = {
        "what": "Next-season district average yield (per hectare) for 20 crops, with a 10th-90th percentile range.",
        "model": "Gradient-boosted quantile regression (scikit-learn HistGradientBoosting) that corrects last season's district yield using the district's 5-year average, its trend, the state's last season and the crop/season.",
        "selection": "Features and settings were chosen on validation seasons 2014-15 to 2017-18 before the test seasons were scored once.",
        "split": f"Time split: trained on seasons up to {TEST_FROM - 1}-{str(TEST_FROM)[2:]}, tested on {TEST_FROM}-{str(TEST_FROM + 1)[2:]} onwards. Never shuffled.",
        "metric": "Median absolute percentage error of the predicted district yield against the yield the government later recorded.",
        "overall": overall, "per_crop": per_crop,
        "data": {"publisher": source["publisher"], "licence": source["licence"],
                 "attribution": source["attribution_text"], "source_url": source["source_url"],
                 "catalog_url": source["catalog_url"], "seasons": bundle["trained_on"],
                 "district_seasons": int(len(df))},
        "limits": [
            "Predicts the district average, not one field. Soil, seed, irrigation and care move a single field well above or below it.",
            "Uses past yields only - no weather forecast - so a drought or flood year will be missed.",
            "Cotton is lint (not kapas) and jute is fibre, converted from bales.",
        ],
    }
    (ROOT / "docs" / "yield_eval.json").write_text(json.dumps(report, indent=2))
    (ROOT / "data" / "yield").mkdir(exist_ok=True)
    (ROOT / "data" / "yield" / "SOURCE.json").write_text(json.dumps(source, indent=2))
    size = (ROOT / "models" / "yield.joblib").stat().st_size / 1e6
    print(f"saved models/yield.joblib ({size:.1f} MB) and docs/yield_eval.json")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]))
