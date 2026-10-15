# Model card — CropWise crop recommender

Trained 22 crops. Evaluated by **stratified 5-fold cross-validation**, not a
single hold-out split, and reported on the folds the model never saw.

## Why there are two models

| | Field model | Lab model |
|---|---|---|
| Inputs | nitrogen, ph, clay, organic_carbon, temperature, humidity, rainfall | N, P, K, temperature, humidity, ph, rainfall |
| Where they come from | ISRIC SoilGrids + Open-Meteo, for any city | A farmer's Soil Health Card |
| Phosphorus / potassium | **Not used** | Real laboratory values |
| Rows | 2200 | 2200 |
| Winner | RandomForest | RandomForest |
| **Accuracy** | **0.9695** | **0.9959** |
| **Macro-F1** | **0.9693** | **0.9959** |

The previous version of this project reported 0.995 accuracy for everyone. It got there by
*predicting* phosphorus and potassium from the same soil and weather values the classifier then
used, with two regressors trained on the same 2 200 rows. Those two inputs carried no new
information, so the score flattered the model and the confidence shown to the farmer was not real.
They have been removed from the prediction path.

The honest position: **97.0% for a farmer who only types a city name**, and
**99.6% once a Soil Health Card supplies real P and K**. That difference is now
the reason the app asks for the card.

## Candidates compared

### Field model
| Model | Accuracy | Macro-F1 |
|---|---|---|
| RandomForest | 0.9695 | 0.9693 |
| ExtraTrees | 0.9650 | 0.9649 |
| HistGradientBoosting | 0.9623 | 0.9623 |
| LogisticRegression | 0.8350 | 0.8333 |

### Lab model
| Model | Accuracy | Macro-F1 |
|---|---|---|
| RandomForest | 0.9959 | 0.9959 |
| ExtraTrees | 0.9936 | 0.9936 |
| HistGradientBoosting | 0.9923 | 0.9923 |
| LogisticRegression | 0.9709 | 0.9709 |

LightGBM and XGBoost were intended as candidates but both need `libomp`, which this macOS Python
build cannot load; scikit-learn's HistGradientBoosting fills the same gradient-boosting slot.

## Where the field model is weakest

Lowest per-class F1:

| Crop | F1 |
|---|---|
| orange | 0.902 |
| pigeonpeas | 0.908 |
| pomegranate | 0.909 |
| mothbeans | 0.948 |
| mango | 0.957 |

Most frequent confusions (actual → predicted, out of 2200 rows):

| Actual | Predicted as | Times |
|---|---|---|
| pigeonpeas | mango | 9 |
| orange | pomegranate | 8 |
| apple | pomegranate | 5 |
| mothbeans | lentil | 5 |
| rice | jute | 5 |
| pigeonpeas | coffee | 4 |

## Out-of-distribution detection

An `IsolationForest` (contamination 0.02) is fitted on the same features as each model. When a
farmer's readings fall outside what the training data covers, the app says the readings look
unusual and shows the crops as a weak suggestion rather than a confident answer. This matters
because the dataset is a curated set of 22 crops in typical conditions: it has never seen a saline
coastal plot or a Himalayan plot, and without this check it would answer anyway.

## Explanations

Each recommendation carries up to three plain-language reasons generated from SHAP values for that
specific prediction, for example "rainfall of 202 mm suits rice" or "pH 5.1 counts against wheat".
They describe what moved *this* model's output, not agronomic truth.

## Limits, stated plainly

1. The dataset is a well-known Kaggle teaching set of 2200 rows and 22 crops. It is clean,
   balanced and not sourced from Indian field trials, so these scores are an upper bound on real
   performance.
2. Soil values come from SoilGrids at roughly 250 m resolution and 0–5 cm depth: a regional
   estimate, not this farmer's field, and not the root zone for most crops.
3. Rainfall from Open-Meteo is accumulated over the chosen window and compared with a dataset
   column whose own accumulation period is undocumented. See `docs/DECISIONS.md`.
4. The model recommends what grows, not what pays. Profit depends on mandi prices, input costs and
   land size, which the crop plan handles separately.
5. No crop rotation, pest history, irrigation availability or soil salinity is considered yet.

## Reproducing

```bash
python scripts/train.py     # writes models/*.joblib and docs/metrics.json
```

Seed 42, stratified 5-fold.
