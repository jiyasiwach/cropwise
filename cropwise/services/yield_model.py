"""District yield forecast: how much a crop is likely to give per acre next season, and for a field.

The model (scripts/train_yield.py) was trained on Government of India district crop statistics
(DES, Ministry of Agriculture & Farmers Welfare). It forecasts the district's average yield
from that district's own recent seasons, its trend and the state's last season. The feature
function below is shared by training and prediction so the two can never drift apart.
"""

from __future__ import annotations

import json
import math
import pathlib
import re
from functools import lru_cache

import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[2]
ACRES_PER_HECTARE = 2.4710538
QUINTAL_PER_TONNE = 10
CROP_NAMES = {
    "rice": "Rice (paddy)", "wheat": "Wheat", "maize": "Maize", "bajra": "Bajra", "jowar": "Jowar",
    "chickpea": "Chickpea (chana)", "pigeonpeas": "Pigeon pea (arhar/tur)", "mungbean": "Moong",
    "blackgram": "Urad", "lentil": "Lentil (masoor)", "mothbeans": "Moth bean", "groundnut": "Groundnut",
    "soybean": "Soybean", "mustard": "Mustard", "sugarcane": "Sugarcane", "cotton": "Cotton (lint)",
    "jute": "Jute (fibre)", "potato": "Potato", "onion": "Onion", "banana": "Banana",
}
SEASONS = ("Kharif", "Rabi", "Summer")


def features(years, yields, areas, year: int, state_last: float | None, state_base: float | None) -> dict | None:
    """Features for forecasting `year` from one district-crop-season's earlier seasons.

    years/yields/areas are that series' rows, oldest first, and may include `year` itself or
    later (they are ignored). Returns None when there are fewer than two usable past seasons.
    """
    keep = [i for i, y in enumerate(years) if year - 6 <= y < year]
    if len(keep) < 2:
        return None
    ys = [float(yields[i]) for i in keep][-5:]
    yrs = [int(years[i]) for i in keep][-5:]
    base = sum(ys) / len(ys)
    by_year = dict(zip(yrs, ys))

    def rel(y):
        v = by_year.get(y)
        return math.log(v / base) if v else float("nan")

    slope = float(np.polyfit(yrs, [math.log(v / base) for v in ys], 1)[0]) if len(ys) >= 3 else 0.0
    # The forecast is a correction to last season's yield (or the 5-year average when last season
    # is missing): trees cannot copy a number through, but they learn corrections well.
    anchor = by_year.get(year - 1) or base
    return {
        "base": base, "anchor": anchor, "logratio_base": math.log(base / anchor),
        "lag1": rel(year - 1), "lag2": rel(year - 2), "lag3": rel(year - 3),
        "trend": slope, "n_hist": len(ys),
        "state_last": math.log(state_last / state_base) if state_last and state_base else float("nan"),
        "log_area": math.log(float(areas[keep[-1]])),
        "last_year": yrs[-1], "last_yield": ys[-1],
    }


def _norm(text: str | None) -> str:
    return re.sub(r"[^a-z]", "", (text or "").lower())


@lru_cache(maxsize=1)
def bundle() -> dict | None:
    path = ROOT / "models" / "yield.joblib"
    if not path.exists():
        return None
    import joblib  # only when the forecast is first used

    return joblib.load(path)


@lru_cache(maxsize=1)
def evaluation() -> dict:
    path = ROOT / "docs" / "yield_eval.json"
    return json.loads(path.read_text()) if path.exists() else {}


def _states(b: dict) -> list[str]:
    return sorted(b["codes"]["state"])


def _match_state(b: dict, state: str | None) -> str | None:
    wanted = _norm(state)
    for s in _states(b):
        if _norm(s) == wanted:
            return s
    return None


def _districts(b: dict, state: str) -> dict[str, str]:
    """District name -> code for one state, newest name for each code."""
    out = {}
    for key, h in b["history"].items():
        if h["state"] == state:
            out[h["district"]] = key.split("|")[2]
    return dict(sorted(out.items()))


def options(state: str | None = None, district: str | None = None) -> dict:
    """What the form can offer: states, that state's districts, and that district's crops/seasons."""
    b = bundle()
    if b is None:
        return {"available": False}
    st = _match_state(b, state)
    out: dict = {"available": True, "states": _states(b), "state": st, "districts": [], "crops": []}
    if not st:
        return out
    districts = _districts(b, st)
    out["districts"] = list(districts)
    code = _find_district(districts, district)
    out["district"] = next((n for n, c in districts.items() if c == code), None)
    if code:
        crops: dict[str, list[str]] = {}
        for key in b["history"]:
            crop, season, dcode = key.split("|")
            if dcode == code:
                crops.setdefault(crop, []).append(season)
        out["crops"] = [{"crop": c, "name": CROP_NAMES.get(c, c), "seasons": [s for s in SEASONS if s in ss]}
                        for c, ss in sorted(crops.items(), key=lambda kv: CROP_NAMES.get(kv[0], kv[0]))]
    return out


def _find_district(districts: dict[str, str], name: str | None) -> str | None:
    wanted = _norm(name)
    if not wanted:
        return None
    for n, code in districts.items():
        if _norm(n) == wanted:
            return code
    # Geocoders and the statistics spell some districts differently (e.g. "Bengaluru Urban").
    for n, code in districts.items():
        if wanted in _norm(n) or _norm(n) in wanted:
            return code
    return None


def forecast(crop: str, state: str, district: str, season: str, acres: float | None = None) -> dict:
    b = bundle()
    if b is None:
        raise LookupError("The yield model is not installed.")
    st = _match_state(b, state)
    if not st:
        raise LookupError(f"No district crop statistics for '{state}'.")
    code = _find_district(_districts(b, st), district)
    if not code:
        raise LookupError(f"No crop statistics for a district called '{district}' in {st}.")
    key = f"{crop}|{season}|{code}"
    h = b["history"].get(key)
    if not h:
        raise LookupError(f"Not enough government records for {CROP_NAMES.get(crop, crop)} in the {season} season here.")

    year = h["years"][-1] + 1
    smed = b["state_median"]
    f = features(h["years"], h["yield"], h["area"], year,
                 smed.get((crop, season, st, year - 1)), smed.get((crop, season, st, "base", year)))
    if f is None:
        raise LookupError("Not enough recent seasons to forecast from.")
    codes = b["codes"]
    values = {**f, "crop": codes["crop"][crop], "season": codes["season"][season]}
    row = [values[k] for k in b["features"]]
    X = pd.DataFrame([row], columns=b["features"], dtype=float)
    p10, p50, p90 = (f["anchor"] * math.exp(float(b["models"][q].predict(X)[0])) for q in (0.1, 0.5, 0.9))
    p10, p90 = min(p10, p50), max(p90, p50)  # quantile models are fitted separately; keep them ordered

    def per_acre(t_per_ha: float) -> float:
        return round(t_per_ha * QUINTAL_PER_TONNE / ACRES_PER_HECTARE, 2)

    result = {
        "crop": crop, "crop_name": CROP_NAMES.get(crop, crop), "state": st, "district": h["district"],
        "season": season, "forecast_for": f"{year}-{str(year + 1)[2:]}",
        "quintal_per_acre": {"low": per_acre(p10), "likely": per_acre(p50), "high": per_acre(p90)},
        "tonne_per_hectare": {"low": round(p10, 3), "likely": round(p50, 3), "high": round(p90, 3)},
        "history": [{"season": f"{y}-{str(y + 1)[2:]}", "quintal_per_acre": per_acre(v)}
                    for y, v in zip(h["years"], h["yield"])],
        "district_5yr_avg_quintal_per_acre": per_acre(f["base"]),
        "acres": None, "field_quintal": None,
        "note": "This is the expected district average. Your own field can do better or worse depending on "
                "soil, seed, water and care. It does not know this season's weather.",
        "source": evaluation().get("data", {}).get("attribution"),
        "accuracy": evaluation().get("overall"),
    }
    if acres:
        result["acres"] = acres
        result["field_quintal"] = {k: round(v * acres, 1) for k, v in result["quintal_per_acre"].items()}
    return result
