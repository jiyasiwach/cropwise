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

    # --- everything private is private ---
    for path in ["/api/v1/me", "/api/v1/soil?city=Hyderabad", "/api/v1/history"]:
        check(f"401 for {path}", client.get(path).status_code == 401, client.get(path).status_code)
    check("401 for POST /api/v1/predict", client.post("/api/v1/predict", json={}).status_code in (401, 422))
    for path in ["/dashboard", "/soil", "/history", "/profile", "/settings"]:
        r = client.get(path, follow_redirects=False)
        check(f"page {path} redirects when signed out", r.status_code == 303, r.status_code)

    # --- accounts ---
    r = client.post("/api/v1/auth/signup", json={"name": "Jiya", "email": "j@x.com", "password": "farming123"})
    check("signup creates an account", r.status_code == 201, r.text[:120])
    check("session cookie is httpOnly", "httponly" in r.headers.get("set-cookie", "").lower())
    r = client.post("/api/v1/auth/signup", json={"name": "x", "email": "j@x.com", "password": "farming123"})
    check("duplicate signup refused", r.status_code == 409, r.status_code)
    r = client.post("/api/v1/auth/signup", json={"name": "x", "email": "bad", "password": "farming123"})
    check("invalid email refused", r.status_code == 422, r.status_code)
    r = client.post("/api/v1/auth/signup", json={"name": "x", "email": "s@x.com", "password": "short"})
    check("short password refused", r.status_code == 422, r.status_code)

    check("me works when signed in", client.get("/api/v1/me").json()["email"] == "j@x.com")

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

    # --- one user cannot see another's data ---
    client.post("/api/v1/auth/logout")
    client.post("/api/v1/auth/signup", json={"name": "Other", "email": "o@x.com", "password": "farming123"})
    check("new account sees an empty history", client.get("/api/v1/history").json() == [])

print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
