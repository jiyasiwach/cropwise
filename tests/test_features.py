"""Yield forecast, Kisan Yojana schemes and official channels."""

import asyncio
import json
import os
import pathlib
import sys

os.environ.setdefault("SECRET_KEY", "test-secret")
DB = "/tmp/cropwise_features_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB}"
if os.path.exists(DB):
    os.remove(DB)

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
from cropwise.services import schemes, yield_model  # noqa: E402

fails = []


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else f"  <- {extra}"))
    if not cond:
        fails.append(name)


with TestClient(main.app) as client:
    from ui import is_app_shell, ui_text

    for path in ["/yield", "/schemes", "/community"]:
        check(f"{path} opens in the app", is_app_shell(client.get(path)))
    check("the app bundle has the yield page", "Forecast my yield" in ui_text())
    check("the app bundle has the schemes page", "Kisan Yojana" in ui_text())

    # --- yield forecast ---
    opts = client.get("/api/v1/yield/options", params={"state": "punjab"}).json()
    check("yield options match a state whatever its case", opts.get("state") == "Punjab", opts.get("state"))
    check("yield options list that state's districts", "Ludhiana" in opts.get("districts", []))
    opts = client.get("/api/v1/yield/options", params={"state": "Punjab", "district": "Ludhiana"}).json()
    crops = {c["crop"]: c["seasons"] for c in opts["crops"]}
    check("a district offers only crops it has records for", "wheat" in crops and "Rabi" in crops["wheat"], crops)

    r = client.get("/api/v1/yield", params={"crop": "wheat", "state": "Punjab", "district": "Ludhiana",
                                             "season": "Rabi", "acres": 5})
    f = r.json()
    check("yield forecast answers", r.status_code == 200, r.text[:200])
    q = f["quintal_per_acre"]
    check("forecast range is ordered low <= likely <= high", q["low"] <= q["likely"] <= q["high"], q)
    check("Ludhiana wheat is in a believable range (12-30 q/acre)", 12 <= q["likely"] <= 30, q)
    check("field total is per-acre x acres", abs(f["field_quintal"]["likely"] - round(q["likely"] * 5, 1)) <= 0.1, f["field_quintal"])
    check("forecast shows the district's history", len(f["history"]) >= 2)
    check("forecast says it is a district average, not this field", "district average" in f["note"])
    check("forecast carries its measured accuracy", f["accuracy"]["model_median_error_pct"] > 0)
    check("forecast names the government source", "Directorate of Economics" in (f["source"] or ""))
    check("a misspelt district is refused, not guessed",
          client.get("/api/v1/yield", params={"crop": "wheat", "state": "Punjab", "district": "Atlantis",
                                               "season": "Rabi"}).status_code == 404)
    check("a bad season is a validation error",
          client.get("/api/v1/yield", params={"crop": "wheat", "state": "Punjab", "district": "Ludhiana",
                                               "season": "Monsoon"}).status_code == 422)
    check("silly acres are refused",
          client.get("/api/v1/yield", params={"crop": "wheat", "state": "Punjab", "district": "Ludhiana",
                                               "season": "Rabi", "acres": 5000}).status_code == 422)

    # The model is judged honestly: a time split and two baselines, all published.
    report = json.loads((ROOT / "docs" / "yield_eval.json").read_text())
    o = report["overall"]
    check("yield model beats the 5-year-average guess", o["model_median_error_pct"] < o["baseline_5yr_mean_median_error_pct"], o)
    check("yield model at least matches last season's yield as a guess",
          o["model_median_error_pct"] <= o["baseline_last_year_median_error_pct"], o)
    check("the low-high range is roughly calibrated (70-90% coverage)", 0.7 <= o["range_coverage_p10_p90"] <= 0.9, o)
    check("the saved yield model carries no numpy random generator (it breaks across numpy versions)",
          all(getattr(m, "_feature_subsample_rng", None) is None for m in yield_model.bundle()["models"].values()))
    check("the eval endpoint publishes the yield results", client.get("/api/v1/eval").json().get("yield") is not None)

    # Training and prediction share one feature function.
    feats = yield_model.features([2019, 2020, 2021, 2022], [2.0, 2.2, 1.8, 2.0], [100, 100, 100, 100], 2023, None, None)
    check("features anchor on last season", feats["anchor"] == 2.0 and feats["last_year"] == 2022, feats)
    check("features ignore seasons at or after the one forecast",
          yield_model.features([2021, 2022, 2023], [1.0, 1.0, 9.0], [1, 1, 1], 2023, None, None)["base"] == 1.0)
    check("too little history gives no forecast", yield_model.features([2022], [2.0], [1], 2023, None, None) is None)

    # --- schemes ---
    data = client.get("/api/v1/schemes", params={"state": "Telangana"}).json()
    check("central schemes are listed", len(data["central"]) >= 5, len(data["central"]))
    check("PM-KISAN is among them", any(s["key"] == "pm_kisan" for s in data["central"]))
    check("every scheme links an official page and a source",
          all(s["official_url"].startswith("https://") and s["source_url"].startswith("https://") and s["as_of"]
              for s in data["central"]))
    check("schemes warn never to pay or share bank details", "never asks" in data["note"])
    mh = client.get("/api/v1/schemes", params={"state": "maharashtra"}).json()
    check("the farmer's state schemes are matched", mh["state"] and all(s["state"] == "Maharashtra" for s in mh["state"]), mh["state"])
    check("a state with no verified schemes says so instead of guessing",
          client.get("/api/v1/schemes", params={"state": "Nowhere"}).json()["state"] == [])
    state_rows = json.loads((ROOT / "data" / "schemes" / "state.json").read_text())
    check("only verified, still-running state schemes are shipped",
          all(r["verified"] is True and r["status"] == "active" for r in state_rows))

    raw = json.loads((ROOT / "data" / "schemes" / "central.json").read_text())
    saved = schemes.DATA
    try:
        tmp = pathlib.Path("/tmp/cropwise_schemes_test")
        tmp.mkdir(exist_ok=True)
        (tmp / "central.json").write_text(json.dumps(raw[:1] + [{**raw[0], "key": "fake", "verified": False}]))
        schemes.DATA = tmp
        check("an unverified scheme is never served", [s["key"] for s in schemes.schemes()["central"]] == [raw[0]["key"]])
    finally:
        schemes.DATA = saved

    # --- official channels ---
    ch = client.get("/api/v1/channels", params={"state": "telangana"}).json()
    check("national official channels are listed", len(ch["national"]) >= 3)
    check("the farmer's state channels are matched", all(c["scope"] == "Telangana" for c in ch["state"]) and ch["state"])
    check("every channel says where it is published", all(c["source_url"].startswith("https://") for c in ch["national"] + ch["state"]))
    check("no state channels leak into another state",
          not client.get("/api/v1/channels", params={"state": "Nowhere"}).json()["state"])

    # --- live updates: parsers are strict about what they show ---
    feed = json.dumps({"items": [
        {"title": "MSP for Rabi crops", "fileUrl": "https://agriwelfare.gov.in/a.pdf", "publishDate": "2026-10-07"},
        {"title": "Newer item", "fileUrl": "https://agriwelfare.gov.in/b.pdf", "publishDate": "2026-10-13"},
        {"title": "Phishing", "fileUrl": "https://agriwelfare.gov.in.evil.com/x.pdf", "publishDate": "2026-10-14"},
        {"title": "Plain http", "fileUrl": "http://agriwelfare.gov.in/c.pdf", "publishDate": "2026-10-14"},
    ]})
    items = schemes._parse_json(feed, [], 10)
    check("updates show only https government links", [i["title"] for i in items] == ["Newer item", "MSP for Rabi crops"], items)
    rss = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><rss><channel><item><title>&a;</title></item></channel></rss>'
    try:
        schemes._parse_rss(rss, [], 5)
        check("feeds with entity declarations are refused", False)
    except Exception:
        check("feeds with entity declarations are refused", True)

    class Down:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url):
            import httpx
            raise httpx.ConnectError("down")

    schemes._feed_cache.update(at=0.0, items=[{"title": "Old copy", "link": "https://x.gov.in/a", "date": "2026-10-01"}])
    original = schemes.httpx.AsyncClient
    schemes.httpx.AsyncClient = lambda **kw: Down()
    try:
        out = asyncio.run(schemes.updates(5))
    finally:
        schemes.httpx.AsyncClient = original
    check("when the feed is down the last copy is shown with a note", out["items"][0]["title"] == "Old copy" and out["error"], out)

    schemes._feed_cache.update(at=0.0, items=None)
    schemes.httpx.AsyncClient = lambda **kw: Down()
    try:
        cold = asyncio.run(schemes.updates(5))
    finally:
        schemes.httpx.AsyncClient = original
    check("on a cold start with the feed down, the dated saved copy is shown",
          cold["items"] and "as of" in (cold["error"] or ""), cold.get("error"))

print(f"\n{len(fails)} failed" if fails else "\nall passed")
sys.exit(1 if fails else 0)
