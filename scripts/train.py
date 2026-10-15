"""Train and honestly evaluate the CropWise crop recommender.

Two models are produced, because two different sets of facts are available at runtime:

  lab    — N, P, K (kg/ha), temperature, humidity, pH, rainfall.
           The Kaggle feature set. Used only when the farmer gives us a Soil Health Card,
           which is the only place real P and K readings come from.

  field  — nitrogen (g/kg), pH, clay %, organic carbon (g/kg), temperature, humidity, rainfall.
           What we can actually observe for any city from SoilGrids plus Open-Meteo. No P or K,
           because SoilGrids does not publish them and inventing them (as the old code did with
           p_model.pkl / k_model.pkl) feeds the classifier a function of its own inputs.

Each model is chosen by stratified 5-fold cross-validation across four candidates, refitted on
all the data, and saved with an IsolationForest trained on the same features so the app can say
"these readings look unusual" instead of pretending to be confident.

Run:  python scripts/train.py
"""

from __future__ import annotations

import json
import pathlib
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import (
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
    IsolationForest,
    RandomForestClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import joblib

warnings.filterwarnings("ignore", category=UserWarning)

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"
DOCS = ROOT / "docs"
SEED = 42

FIELD_FEATURES = [
    "nitrogen",
    "ph",
    "clay",
    "organic_carbon",
    "temperature",
    "humidity",
    "rainfall",
]
LAB_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]


def candidates() -> dict[str, Pipeline]:
    """The four we compare. LightGBM/XGBoost are omitted: both need libomp, which this build
    of macOS Python cannot load, and a histogram booster from scikit-learn fills the same role."""
    return {
        "RandomForest": Pipeline(
            [("clf", RandomForestClassifier(n_estimators=400, random_state=SEED, n_jobs=-1))]
        ),
        "ExtraTrees": Pipeline(
            [("clf", ExtraTreesClassifier(n_estimators=400, random_state=SEED, n_jobs=-1))]
        ),
        "HistGradientBoosting": Pipeline(
            [("clf", HistGradientBoostingClassifier(random_state=SEED))]
        ),
        "LogisticRegression": Pipeline(
            [
                ("scale", StandardScaler()),
                ("clf", LogisticRegression(max_iter=2000, multi_class="multinomial")),
            ]
        ),
    }


def evaluate(X: pd.DataFrame, y: pd.Series, name: str) -> dict:
    """Stratified 5-fold CV over every candidate; returns the comparison and the winner."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    results = {}
    best_name, best_f1, best_pred = None, -1.0, None
    for model_name, pipe in candidates().items():
        pred = cross_val_predict(pipe, X, y, cv=cv, n_jobs=-1)
        macro_f1 = f1_score(y, pred, average="macro")
        accuracy = float((pred == y).mean())
        results[model_name] = {"macro_f1": round(macro_f1, 4), "accuracy": round(accuracy, 4)}
        print(f"  {model_name:22} accuracy={accuracy:.4f}  macro-F1={macro_f1:.4f}")
        if macro_f1 > best_f1:
            best_name, best_f1, best_pred = model_name, macro_f1, pred

    print(f"  → best: {best_name}")
    report = classification_report(y, best_pred, output_dict=True, zero_division=0)
    labels = sorted(y.unique())
    cm = confusion_matrix(y, best_pred, labels=labels)
    # Which crops the winner confuses most often: the honest weak spots.
    confusions = []
    for i, actual in enumerate(labels):
        for j, predicted in enumerate(labels):
            if i != j and cm[i][j] > 0:
                confusions.append({"actual": actual, "predicted": predicted, "count": int(cm[i][j])})
    confusions.sort(key=lambda c: -c["count"])

    return {
        "feature_set": name,
        "features": list(X.columns),
        "rows": int(len(X)),
        "classes": labels,
        "candidates": results,
        "winner": best_name,
        "macro_f1": round(best_f1, 4),
        "accuracy": round(float((best_pred == y).mean()), 4),
        "per_class_f1": {k: round(v["f1-score"], 3) for k, v in report.items() if k in labels},
        "top_confusions": confusions[:10],
    }


def fit_and_save(X: pd.DataFrame, y: pd.Series, winner: str, tag: str) -> None:
    """Refit the winning pipeline on everything, plus an outlier detector over the same inputs."""
    model = candidates()[winner]
    model.fit(X, y)
    joblib.dump({"model": model, "features": list(X.columns)}, MODELS / f"crop_{tag}.joblib")

    # contamination=0.02: we assume the curated dataset is ~2% odd, so anything stranger than its
    # own 98th percentile is flagged rather than silently predicted on.
    ood = IsolationForest(n_estimators=300, contamination=0.02, random_state=SEED)
    ood.fit(X)
    joblib.dump(
        {"model": ood, "features": list(X.columns), "threshold": float(np.percentile(ood.score_samples(X), 2))},
        MODELS / f"ood_{tag}.joblib",
    )
    print(f"  saved models/crop_{tag}.joblib and models/ood_{tag}.joblib")


def main() -> None:
    MODELS.mkdir(exist_ok=True)
    DOCS.mkdir(exist_ok=True)

    lab = pd.read_csv(ROOT / "Crop_recommendation.csv")
    field = pd.read_csv(ROOT / "Crop_recommendation_9_features.csv")

    print("\nField model (what we can observe for any city — no P or K):")
    field_metrics = evaluate(field[FIELD_FEATURES], field["label"], "field")
    fit_and_save(field[FIELD_FEATURES], field["label"], field_metrics["winner"], "field")

    print("\nLab model (needs a Soil Health Card for P and K):")
    lab_metrics = evaluate(lab[LAB_FEATURES], lab["label"], "lab")
    fit_and_save(lab[LAB_FEATURES], lab["label"], lab_metrics["winner"], "lab")

    metrics = {"field": field_metrics, "lab": lab_metrics, "seed": SEED, "cv": "stratified 5-fold"}
    (DOCS / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print("\nWrote docs/metrics.json")


if __name__ == "__main__":
    main()
