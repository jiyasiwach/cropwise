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

# --- a slow soil service: the nearest real prefetched reading, labelled, or an honest error ---
import asyncio as _asyncio  # noqa: E402
from cropwise.services import lookup as _lk  # noqa: E402

_saved = (_lk._soil_for_city, _lk.geocode, _lk.SOIL_BUDGET_SECONDS)
_ref = _lk._prefetched()["aurangabad"]


async def _slow(city):
    await _asyncio.sleep(5)


async def _near(city):  # about 30 km north of Aurangabad
    return {"name": "Testpur", "latitude": _ref["latitude"] + 0.27, "longitude": _ref["longitude"]}


async def _far(city):  # the middle of the Bay of Bengal
    return {"name": "Farpur", "latitude": 15.0, "longitude": 88.0}

_lk._soil_for_city, _lk.SOIL_BUDGET_SECONDS = _slow, 0.2
_lk.geocode = _near
nearby = _asyncio.run(_lk.soil_for_city("Testpur"))
check("a slow service falls back to the nearest real reading",
      nearby["from_nearby_town"] == _ref["city"] and nearby["nitrogen"] == _ref["nitrogen"], nearby)
check("the fallback says where the reading is from and how far",
      _ref["city"] in nearby["sample_note"] and "km" in nearby["sample_note"] and nearby["sampled_offset_km"] > 25, nearby)
check("the fallback is not cached as the town's own reading", "testpur" not in _lk._SOIL_CACHE)
_lk.geocode = _far
try:
    _asyncio.run(_lk.soil_for_city("Farpur"))
    check("a town far from any cached reading gets an honest error", False)
except _lk.LookupError as exc:
    check("a town far from any cached reading gets an honest error", "taking too long" in str(exc), str(exc))
_lk._soil_for_city, _lk.geocode, _lk.SOIL_BUDGET_SECONDS = _saved

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

    # Sample mandis follow the asking farm even when a location-less call cached them first.
    client.get("/api/v1/profit?crop=lentil&state=Maharashtra&acres=1")          # no location
    far = client.get("/api/v1/best-market?crop=lentil&state=Maharashtra&latitude=18.52&longitude=73.86&quintals=4").json()
    check("sample mandis are placed around the asking farm", max(m["distance_km"] for m in far["best"]) < 150,
          [m["distance_km"] for m in far["best"]])

    # --- the impact calculator: nearest mandi versus best mandi, on one farm ---
    gain = client.get("/api/v1/impact/mandi-gain?crop=rice&acres=2&state=Telangana&latitude=17.4&longitude=78.5").json()
    check("impact calculator compares nearest and best", gain["nearest"] and gain["best"], gain)
    check("the best mandi keeps at least as much as the nearest",
          gain["best"]["net_per_quintal"] >= gain["nearest"]["net_per_quintal"], gain)
    check("the gain is per-quintal gain times the farm's yield",
          abs(gain["gain_total"] - gain["gain_per_quintal"] * gain["yield_quintals"]) <= 1, gain)
    check("the nearest mandi really is the closest", gain["nearest"]["distance_km"] <= gain["best"]["distance_km"], gain)
    check("the impact sum is labelled an estimate, mock prices flagged", gain["is_estimate"] and gain["is_mock"], gain)
    check("double the acres, double the gain (within rounding)",
          abs(client.get("/api/v1/impact/mandi-gain?crop=rice&acres=4&state=Telangana&latitude=17.4&longitude=78.5")
          .json()["gain_total"] / gain["gain_total"] - 2) < 0.02)
    check("unknown crop in calculator is a 404",
          client.get("/api/v1/impact/mandi-gain?crop=dragonfruit&acres=1&state=Telangana&latitude=17.4&longitude=78.5").status_code == 404)
    check("calculator rejects nonsense acres",
          client.get("/api/v1/impact/mandi-gain?crop=rice&acres=-3&state=Telangana&latitude=17.4&longitude=78.5").status_code == 422)
    from cropwise.services import lookup as _lookup

    async def _nowhere(city):
        raise _lookup.LookupError(f"We could not find a place called '{city}'.")
    _real_geocode, _lookup.geocode = _lookup.geocode, _nowhere
    missing_town = client.get("/api/v1/impact/mandi-gain?crop=rice&acres=1&town=Qwxzzyplace")
    _lookup.geocode = _real_geocode
    check("an unknown town is a friendly 404, not a server error",
          missing_town.status_code == 404 and "could not find" in missing_town.json()["detail"], missing_town.status_code)
    check("calculator needs a place", client.get("/api/v1/impact/mandi-gain?crop=rice&acres=1").status_code == 422)
    from ui import has_literal, is_app_shell, ui_text
    app = ui_text()
    check("impact page renders", is_app_shell(client.get("/impact")) and "What it does not do yet" in app)
    check("every statistic on the impact page links a source",
          all(s in app for s in ["pib.gov.in", "niti.gov.in", "census-of-india-2011"]))
    check("the impact page admits what it has not measured", "Not measured" in app)
    check("the app links the impact page and its calculator", has_literal(app, "/impact") and has_literal(app, "/impact#calculator"))

    check("plan page renders", is_app_shell(client.get("/plan/rice")) and "Sow → grow → harvest" in app)
    check("plan page shows the verification warning", "not advice for your field" in app and "Krishi Vigyan Kendra" in app)
    check("plans and answers can be read aloud", "speechSynthesis" in app and "SpeechSynthesisUtterance" in app)
    check("sample and estimate figures are labelled", "common.sample" in app and "common.estimate" in app)
    check("missing crop is honest", "There is no sowing calendar for" in app
          and client.get("/api/v1/plan/dragonfruit").status_code == 404)

print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
