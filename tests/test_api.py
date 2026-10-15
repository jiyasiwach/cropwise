"""Phase 3 tests: the FastAPI app, its auth, and the pages it still serves."""

import os
import pathlib
import sys

os.environ.setdefault("SECRET_KEY", "test-secret")
DB = "/tmp/cropwise_api_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB}"
if os.path.exists(DB):
    os.remove(DB)

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402

fails = []


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else f"  <- {extra}"))
    if not cond:
        fails.append(name)


with TestClient(main.app) as client:
    # --- health and docs ---
    check("health endpoint", client.get("/healthz").json()["ok"] is True)
    spec = client.get("/openapi.json").json()
    check("OpenAPI documents the API", "/api/v1/predict" in spec["paths"])

    # --- no sign-in: every page opens straight away ---
    for path in ["/", "/dashboard", "/soil", "/history", "/profile", "/settings", "/assistant"]:
        r = client.get(path)
        check(f"{path} opens without a login", r.status_code == 200, r.status_code)
    check("the landing page offers a way in", "Start with my location" in client.get("/").text)
    check("no login form remains", "password" not in client.get("/").text.lower())

    # --- no accounts: a browser is identified by a cookie ---
    me = client.get("/api/v1/me").json()
    check("every visitor gets a workspace", me["id"] > 0, me)
    check("no personal data is collected", me["email"].endswith("@visitor.cropwise.local"), me["email"])
    check("the visitor cookie is set", "cropwise_visitor" in client.cookies, dict(client.cookies))

    # --- prediction ---
    body = {
        "nitrogen": 1.69, "ph": 6.5, "clay": 32.8, "organic_carbon": 20.6,
        "temperature": 20.9, "humidity": 82.0, "rainfall": 202.9, "city": "Hyderabad",
    }
    r = client.post("/api/v1/predict", json=body)
    data = r.json()
    check("predict returns three crops", len(data["crops"]) == 3, r.text[:160])
    check("predict picks rice for rice-like readings", data["crops"][0]["crop"] == "rice", data["crops"][0])
    check("predict says which model answered", data["model_source"] == "field", data["model_source"])
    check("predict carries reasons", bool(data["crops"][0]["reasons"]))

    r = client.post("/api/v1/predict", json={**body, "lab_nitrogen": 90, "lab_phosphorus": 42, "lab_potassium": 43})
    check("soil-test readings use the lab model", r.json()["model_source"] == "lab", r.json().get("model_source"))

    r = client.post("/api/v1/predict", json={**body, "ph": 99})
    check("impossible pH rejected by validation", r.status_code == 422, r.status_code)

    # --- history ---
    rows = client.get("/api/v1/history").json()
    check("history lists this user's predictions", len(rows) == 2, len(rows))
    check("history is newest first", rows[0]["created_at"] >= rows[1]["created_at"])

    # --- the pages still render ---
    for path in ["/dashboard", "/soil", "/history", "/profile", "/settings"]:
        r = client.get(path)
        check(f"page {path} renders", r.status_code == 200 and "<html" in r.text.lower(), r.status_code)
    r = client.post("/predict", data={"temperature": 20.9, "humidity": 82, "rainfall": 202.9,
                                      "nitrogen": 1.69, "ph": 6.5, "clay": 32.8, "organic_carbon": 20.6,
                                      "city": "Hyderabad"})
    check("wizard result page renders", "rice" in r.text.lower() and "suits this crop" in r.text, r.status_code)


    # --- one browser's history is not another's ---
    from fastapi.testclient import TestClient as _TC

    other = _TC(main.app)
    check("a second browser starts empty", other.get("/api/v1/history").json() == [])

    # --- profit ---
    money = client.get("/api/v1/profit?crop=rice&state=Telangana&acres=2").json()
    check("profit returns revenue, costs and a bottom line",
          {"revenue", "costs", "profit"} <= money.keys(), money.keys())
    check("profit scales with the land",
          client.get("/api/v1/profit?crop=rice&acres=4").json()["revenue"] > money["revenue"])
    check("profit says what it assumed", len(money["assumptions"]) >= 3)
    ranked = client.get("/api/v1/profit/compare?crops=rice,maize,chickpea&acres=2").json()["results"]
    check("profit comparison is sorted by profit",
          [r["profit"] for r in ranked] == sorted([r["profit"] for r in ranked], reverse=True))

print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
