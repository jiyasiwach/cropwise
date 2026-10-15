"""Phase 2 tests: the two models, their reasons, and the unusual-readings check."""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from cropwise.services.predictor import recommend  # noqa: E402

fails = []


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else f"  <- {extra}"))
    if not cond:
        fails.append(name)


rice_like = {"nitrogen": 1.69, "ph": 6.5, "clay": 32.8, "organic_carbon": 20.6,
             "temperature": 20.9, "humidity": 82.0, "rainfall": 202.9}

r = recommend(rice_like)
check("field model returns three crops", len(r["crops"]) == 3, len(r["crops"]))
check("rice recognised from rice-like readings", r["crops"][0]["crop"] == "rice", r["crops"][0])
check("confidences are descending", [c["confidence"] for c in r["crops"]] == sorted(
    [c["confidence"] for c in r["crops"]], reverse=True))
check("every crop carries reasons", all(c["reasons"] for c in r["crops"]))
check("reasons say whether they help or hurt", all(
    isinstance(x["good"], bool) and x["text"] for c in r["crops"] for x in c["reasons"]))
check("normal readings are not flagged", r["unusual_readings"] is False)

weird = recommend({"nitrogen": 0.01, "ph": 2.0, "clay": 95.0, "organic_carbon": 0.1,
                   "temperature": 55.0, "humidity": 3.0, "rainfall": 900.0})
check("absurd readings flagged as unusual", weird["unusual_readings"] is True)

lab = recommend({"N": 90, "P": 42, "K": 43, "temperature": 20.9, "humidity": 82.0,
                 "ph": 6.5, "rainfall": 202.9}, source="lab")
check("lab model works with a soil test", lab["crops"][0]["crop"] == "rice", lab["crops"][0])
check("lab model is more certain than the field model",
      lab["crops"][0]["confidence"] > r["crops"][0]["confidence"],
      (lab["crops"][0]["confidence"], r["crops"][0]["confidence"]))

try:
    recommend({"nitrogen": 1.0})
    check("missing readings rejected", False, "no error raised")
except ValueError:
    check("missing readings rejected", True)

# Nothing anywhere may invent phosphorus or potassium again.
source = (pathlib.Path(__file__).resolve().parents[1] / "cropwise").rglob("*.py")
text = "\n".join(p.read_text() for p in source)
check("no P/K regressors anywhere", "p_model" not in text and "k_model" not in text)

print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
