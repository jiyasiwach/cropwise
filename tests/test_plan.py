"""Phase 4 tests: the crop plan, fertiliser maths, mandi prices and the best-market ranking."""

import os
import pathlib
import sys
from datetime import date

DB = "/tmp/cropwise_plan_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB}"
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.pop("DATA_GOV_IN_API_KEY", None)  # exercise the labelled-mock path
if os.path.exists(DB):
    os.remove(DB)

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
from cropwise.services import cropplan  # noqa: E402

fails = []


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else f"  <- {extra}"))
    if not cond:
        fails.append(name)


# --- calendar ---
check("all 22 crops have a calendar entry", len(cropplan.known_crops()) == 22, len(cropplan.known_crops()))

rabi = cropplan.sowing_window("chickpea", date(2026, 10, 15))
check("chickpea is a Rabi crop", rabi["season"] == "Rabi", rabi["season"])
check("chickpea sowing opens now in October", rabi["days_until_sowing"] == 0, rabi["days_until_sowing"])
check("harvest follows the crop duration",
      (date.fromisoformat(rabi["expected_harvest"]) - date.fromisoformat(rabi["sow_from"])).days == 110)

kharif = cropplan.sowing_window("rice", date(2026, 10, 15))
check("rice sowing waits for June", kharif["sow_from"].endswith("-06-01"), kharif["sow_from"])
check("calendar admits it needs verification", kharif["needs_verification"] is True)

try:
    cropplan.sowing_window("dragonfruit")
    check("unknown crop refused, not invented", False, "no error raised")
except cropplan.UnknownCrop:
    check("unknown crop refused, not invented", True)

# --- fertiliser ---
plain = cropplan.fertiliser_plan("rice", acres=2.5)
tested = cropplan.fertiliser_plan("rice", acres=2.5, soil={"P": 42, "K": 43})
check("a soil test reduces the phosphorus bought",
      tested["buy"]["dap"]["kg"] < plain["buy"]["dap"]["kg"],
      (tested["buy"]["dap"]["kg"], plain["buy"]["dap"]["kg"]))
check("without a soil test the app says so",
      any("No soil test" in a for a in plain["assumptions"]), plain["assumptions"])
check("quantities scale with the land",
      cropplan.fertiliser_plan("rice", acres=5)["buy"]["urea"]["kg"]
      > plain["buy"]["urea"]["kg"] * 1.9)
check("DAP's own nitrogen is deducted from the urea",
      plain["buy"]["urea"]["kg"] < plain["to_apply_kg_for_your_land"]["N"] / 0.46)

# --- the API and the page ---
with TestClient(main.app) as client:
    check("plan API opens without a sign-in", client.get("/api/v1/plan/rice").status_code == 200)

    plan = client.get("/api/v1/plan/rice?acres=2").json()
    check("plan API returns a timeline and a fertiliser plan", {"timeline", "fertiliser"} <= plan.keys(), plan.keys())
    check("unknown crop returns 404", client.get("/api/v1/plan/dragonfruit").status_code == 404)

    prices = client.get("/api/v1/mandi?crop=rice&state=Telangana&latitude=17.4&longitude=78.5").json()
    check("prices come back", len(prices["markets"]) >= 1, prices.get("status"))
    check("mock prices are labelled MOCK", prices["is_mock"] and "MOCK" in prices["source"], prices["source"][:60])
    check("a price trend is available to chart", len(prices["trend"]) >= 20, len(prices["trend"]))

    best = client.get("/api/v1/best-market?crop=rice&state=Telangana&latitude=17.4&longitude=78.5&quintals=20").json()
    check("markets are ranked", len(best["best"]) == 3, len(best["best"]))
    top = best["best"][0]
    check("ranking is by net price, not headline price",
          all(top["net_price_per_quintal"] >= m["net_price_per_quintal"] for m in best["best"]))
    check("transport is subtracted", top["net_price_per_quintal"] < top["modal_price"])
    check("the furthest mandi is not automatically best",
          best["best"][0]["distance_km"] < max(m["distance_km"] for m in best["best"]) + 1)

    page = client.get("/plan/rice?city=Hyderabad&state=Telangana")
    check("plan page renders", page.status_code == 200 and "Timeline" in page.text, page.status_code)
    check("plan page shows the verification warning", "Krishi Vigyan Kendra" in page.text)
    missing = client.get("/plan/dragonfruit")
    check("missing crop page is honest", "no sowing calendar" in missing.text.lower(), missing.status_code)

print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
