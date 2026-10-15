"""Crop prediction: the two models, their explanations, and the unusual-readings check.

The app asks for a recommendation and gets back the top three crops, a plain-language reason for
each, and a flag when the readings sit outside anything the model was trained on. Nothing here
invents a value: if phosphorus and potassium are unknown, the field model runs without them
rather than guessing them (see docs/MODEL_CARD.md).
"""

from __future__ import annotations

import json
import pathlib
from functools import lru_cache
from typing import Literal

import numpy as np
import pandas as pd
import joblib

MODELS = pathlib.Path(__file__).resolve().parents[2] / "models"
Source = Literal["field", "lab"]

# How each feature reads in a sentence, and the unit a farmer sees.
FEATURE_WORDS = {
    "nitrogen": ("nitrogen", "g/kg"),
    "ph": ("pH", ""),
    "clay": ("clay", "%"),
    "organic_carbon": ("organic carbon", "g/kg"),
    "temperature": ("temperature", "°C"),
    "humidity": ("humidity", "%"),
    "rainfall": ("rainfall", "mm"),
    "N": ("nitrogen", "kg/ha"),
    "P": ("phosphorus", "kg/ha"),
    "K": ("potassium", "kg/ha"),
}


@lru_cache(maxsize=4)
def _load(name: str) -> dict:
    return joblib.load(MODELS / f"{name}.joblib")


def _explainer(source: Source):
    """SHAP TreeExplainer over the fitted forest. Built once per model, then cached."""
    import shap  # imported lazily: it is slow to import and only needed on a prediction

    bundle = _load(f"crop_{source}")
    return shap.TreeExplainer(bundle["model"].named_steps["clf"])


_EXPLAINERS: dict[str, object] = {}


@lru_cache(maxsize=4)
def _ranges(source: Source) -> dict:
    path = MODELS / f"ranges_{source}.json"
    return json.loads(path.read_text()) if path.exists() else {}


def _range_reasons(source: Source, row: pd.DataFrame, crop: str, limit: int = 3) -> list[dict]:
    """Explain by comparing each reading with the range this crop usually grows in.

    This is what runs in production: it needs no extra library, and "rainfall 203 mm is in the
    usual range for rice (154-262 mm)" is easier for a farmer to act on than a SHAP value.
    """
    ranges = _ranges(source).get(crop)
    if not ranges:
        return []
    scored = []
    for feature in row.columns:
        band = ranges.get(feature)
        if not band:
            continue
        value = float(row.iloc[0][feature])
        word, unit = FEATURE_WORDS.get(feature, (feature, ""))
        shown = f"{value:.1f}{unit}" if unit else f"{value:.1f}"
        span = max(1e-6, band["high"] - band["low"])
        if band["low"] <= value <= band["high"]:
            # How central it is: dead-centre readings are the most convincing.
            distance = abs(value - band["median"]) / span
            scored.append((distance, {
                "text": f"{word} {shown} is in the usual range for {crop} ({band['low']}-{band['high']}{unit})",
                "good": True,
            }))
        else:
            off = (band["low"] - value if value < band["low"] else value - band["high"]) / span
            scored.append((-off, {
                "text": f"{word} {shown} is outside the usual range for {crop} ({band['low']}-{band['high']}{unit})",
                "good": False,
            }))
    # Problems first (negative scores), then the most central matches.
    scored.sort(key=lambda s: s[0])
    bad = [r for score, r in scored if not r["good"]]
    good = [r for score, r in scored if r["good"]]
    return (bad + good)[:limit]


def _reasons(source: Source, row: pd.DataFrame, class_index: int, limit: int = 3) -> list[dict]:
    """The features that pushed this crop up or down, in words.

    Returns dicts of {text, good} so the page can show a tick or a warning chip.
    """
    try:
        if source not in _EXPLAINERS:
            _EXPLAINERS[source] = _explainer(source)
        values = _EXPLAINERS[source].shap_values(row)
    except Exception:
        return []  # caller falls back to the range-based reasons

    # shap returns (samples, features, classes) for recent versions, or a list per class.
    arr = np.array(values)
    contrib = arr[0, :, class_index] if arr.ndim == 3 else np.array(values[class_index])[0]

    order = np.argsort(np.abs(contrib))[::-1][:limit]
    out = []
    for i in order:
        feature = row.columns[i]
        word, unit = FEATURE_WORDS.get(feature, (feature, ""))
        value = row.iloc[0, i]
        shown = f"{value:.1f}{unit}" if unit else f"{value:.1f}"
        good = contrib[i] > 0
        out.append(
            {
                "text": f"{word} {shown} {'suits' if good else 'counts against'} this crop",
                "good": bool(good),
            }
        )
    return out


def recommend(readings: dict, source: Source = "field", top: int = 3) -> dict:
    """Top crops for one set of readings.

    readings: feature name → value. Missing features raise, rather than being filled with a guess.
    source:  "field" (no P/K) or "lab" (Soil Health Card supplied P and K).
    """
    bundle = _load(f"crop_{source}")
    features = bundle["features"]
    missing = [f for f in features if f not in readings]
    if missing:
        raise ValueError(f"missing readings for {', '.join(missing)}")

    row = pd.DataFrame([{f: float(readings[f]) for f in features}])[features]
    model = bundle["model"]
    probabilities = model.predict_proba(row)[0]
    classes = list(model.classes_)
    order = np.argsort(probabilities)[::-1][:top]

    ood = _load(f"ood_{source}")
    score = float(ood["model"].score_samples(row)[0])
    unusual = bool(score < ood["threshold"])

    return {
        "source": source,
        "unusual_readings": unusual,
        "crops": [
            {
                "crop": classes[i],
                "confidence": round(float(probabilities[i]) * 100, 1),
                "reasons": _reasons(source, row, int(i)) or _range_reasons(source, row, classes[i]),
            }
            for i in order
        ],
    }
