"""The server-rendered pages, still Jinja, now served by FastAPI.

The templates were written for Flask, so `url_for('soil')` and `url_for('static', filename=…)`
are provided here with the same shape. They are replaced wholesale by the React front end in
Phase 8; until then the farmer keeps a working site.

The wizard carries its readings in hidden form fields rather than a server session: the backend
is stateless apart from the signed cookie, which is what lets it run on Vercel's functions.
"""

from __future__ import annotations

import json
import os
import pathlib
from datetime import date

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import Prediction, User, get_db
from ..security import COOKIE_NAME, current_user_optional, hash_password, set_session_cookie, verify_password
from ..services import cropplan, lookup
from ..services.predictor import recommend

ROOT = pathlib.Path(__file__).resolve().parents[2]
templates = Jinja2Templates(directory=str(ROOT / "templates"))

def demo_mode() -> bool:
    """A deliberately weak sign-in for showing the app: any email, one shared password.

    It is loud about itself — the login page says so in a banner — and one environment variable
    turns it off. It must be off before any real farmer data goes in.
    """
    return os.environ.get("DEMO_MODE", "1") == "1"


DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "1234")

ROUTES = {
    "login": "/",
    "signup": "/signup",
    "dashboard": "/dashboard",
    "soil": "/soil",
    "climate": "/climate",
    "history": "/history",
    "profile": "/profile",
    "settings": "/settings",
    "logout": "/logout",
}


def url_for(name: str, **params) -> str:
    """Flask-shaped url_for, so the existing templates need no edits."""
    if name == "static":
        return f"/static/{params['filename']}"
    return ROUTES.get(name, "/")


templates.env.globals["url_for"] = url_for

router = APIRouter()


def render(request: Request, template: str, **context) -> HTMLResponse:
    return templates.TemplateResponse(request=request, name=template, context=context)


def signed_in(response: RedirectResponse, email: str) -> RedirectResponse:
    set_session_cookie(response, email)
    return response


def require(user: User | None, path: str = "/") -> RedirectResponse | None:
    return None if user else RedirectResponse(path, status_code=303)


# ---- sign in / sign up ----------------------------------------------------


@router.get("/", response_class=HTMLResponse)
def login_page(request: Request, error: str | None = None, user: User | None = Depends(current_user_optional)):
    if user:
        return RedirectResponse("/dashboard", status_code=303)
    return render(request, "login.html", error=error, signup=False, demo_mode=demo_mode())


@router.post("/login")
def login_submit(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    email = email.strip().lower()
    row = db.query(User).filter(User.email == email).one_or_none()

    if demo_mode() and password == DEMO_PASSWORD:
        if not row:
            # First time in demo mode: make the account rather than bouncing the visitor.
            row = User(
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                name=email.split("@")[0].replace(".", " ").title(),
            )
            db.add(row)
            db.commit()
        return signed_in(RedirectResponse("/dashboard", status_code=303), row.email)

    if not row or not verify_password(password, row.password_hash):
        return RedirectResponse("/?error=Those+details+did+not+match+an+account.", status_code=303)
    return signed_in(RedirectResponse("/dashboard", status_code=303), row.email)


@router.get("/signup", response_class=HTMLResponse)
def signup_page(request: Request, error: str | None = None):
    return render(request, "signup.html", error=error, signup=True, demo_mode=demo_mode())


@router.post("/signup")
def signup_submit(
    name: str = Form(""),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    email = email.strip().lower()
    if len(password) < 8:
        return RedirectResponse("/signup?error=Use+a+password+of+at+least+8+characters.", status_code=303)
    if db.query(User).filter(User.email == email).one_or_none():
        return RedirectResponse("/signup?error=That+email+already+has+an+account.", status_code=303)
    db.add(User(email=email, password_hash=hash_password(password), name=name.strip() or email.split("@")[0]))
    db.commit()
    return signed_in(RedirectResponse("/dashboard", status_code=303), email)


@router.get("/logout")
def logout_page():
    response = RedirectResponse("/", status_code=303)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


# ---- the app --------------------------------------------------------------


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard(
    request: Request,
    user: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    gate = require(user)
    if gate:
        return gate
    total = db.query(Prediction).filter(Prediction.user_id == user.id).count()
    latest = (
        db.query(Prediction)
        .filter(Prediction.user_id == user.id)
        .order_by(desc(Prediction.created_at))
        .first()
    )
    name = (user.name or user.email.split("@")[0]).split()[0].title()
    return render(
        request,
        "dashboard.html",
        active_page="dashboard",
        name=name,
        initial=name[0].upper(),
        total=total,
        today_long=date.today().strftime("%A, %d %B %Y"),
        last=(
            {
                "crop": latest.crop,
                "confidence": latest.confidence,
                "city": latest.city,
                "when": latest.created_at.strftime("%d %b, %I:%M %p"),
            }
            if latest
            else None
        ),
    )


@router.get("/soil", response_class=HTMLResponse)
def soil_page(request: Request, user: User | None = Depends(current_user_optional)):
    return require(user) or render(request, "soil.html", active_page="soil")


@router.post("/climate", response_class=HTMLResponse)
def climate_page(
    request: Request,
    city: str = Form(""),
    latitude: float = Form(0.0),
    longitude: float = Form(0.0),
    nitrogen: float = Form(1.4),
    ph: float = Form(6.5),
    clay: float = Form(25.0),
    organic_carbon: float = Form(12.0),
    user: User | None = Depends(current_user_optional),
):
    """Step 2 of the wizard. The soil readings travel on in hidden fields."""
    gate = require(user)
    if gate:
        return gate
    return render(
        request,
        "climate.html",
        locked_city=city,
        carry={
            "city": city,
            "latitude": latitude,
            "longitude": longitude,
            "nitrogen": nitrogen,
            "ph": ph,
            "clay": clay,
            "organic_carbon": organic_carbon,
        },
    )


@router.post("/predict", response_class=HTMLResponse)
def predict_page(
    request: Request,
    temperature: float = Form(...),
    humidity: float = Form(...),
    rainfall: float = Form(...),
    city: str = Form(""),
    latitude: float = Form(0.0),
    longitude: float = Form(0.0),
    nitrogen: float = Form(1.4),
    ph: float = Form(6.5),
    clay: float = Form(25.0),
    organic_carbon: float = Form(12.0),
    user: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    gate = require(user)
    if gate:
        return gate

    readings = {
        "nitrogen": nitrogen,
        "ph": ph,
        "clay": clay,
        "organic_carbon": organic_carbon,
        "temperature": temperature,
        "humidity": humidity,
        "rainfall": rainfall,
    }
    result = recommend(readings, source="field")
    best = result["crops"][0]

    db.add(
        Prediction(
            user_id=user.id,
            crop=best["crop"],
            confidence=best["confidence"],
            model_source=result["source"],
            unusual_readings=result["unusual_readings"],
            city=city or None,
            latitude=latitude or None,
            longitude=longitude or None,
            alternatives=json.dumps(result["crops"][1:]),
            **readings,
        )
    )
    db.commit()

    return render(
        request,
        "result.html",
        top3=[(c["crop"], c["confidence"]) for c in result["crops"]],
        crops=result["crops"],
        unusual=result["unusual_readings"],
        measured=False,
        city=city,
        soil_data={
            "N": nitrogen,
            "P": None,
            "K": None,
            "ph": ph,
            "temperature": temperature,
            "humidity": humidity,
            "rainfall": rainfall,
        },
        active_page="results",
    )


@router.get("/history", response_class=HTMLResponse)
def history_page(request: Request, user: User | None = Depends(current_user_optional), db: Session = Depends(get_db)):
    gate = require(user)
    if gate:
        return gate
    rows = (
        db.query(Prediction)
        .filter(Prediction.user_id == user.id)
        .order_by(desc(Prediction.created_at))
        .limit(100)
        .all()
    )
    records = [
        {
            "crop": r.crop,
            "confidence": r.confidence,
            "city": r.city or "—",
            "nitrogen": r.nitrogen,
            "phosphorus": r.phosphorus,
            "potassium": r.potassium,
            "ph": r.ph,
            "temperature": r.temperature,
            "humidity": r.humidity,
            "rainfall": r.rainfall,
            "created_at": r.created_at.strftime("%d-%m-%Y %I:%M %p"),
        }
        for r in rows
    ]
    return render(request, "history.html", records=records, active_page="history")


@router.get("/profile", response_class=HTMLResponse)
def profile_page(request: Request, user: User | None = Depends(current_user_optional), db: Session = Depends(get_db)):
    gate = require(user)
    if gate:
        return gate
    total = db.query(Prediction).filter(Prediction.user_id == user.id).count()
    last = (
        db.query(Prediction)
        .filter(Prediction.user_id == user.id)
        .order_by(desc(Prediction.created_at))
        .first()
    )
    return render(
        request,
        "profile.html",
        email=user.email,
        initial=(user.name or user.email)[0].upper(),
        name=user.name or user.email.split("@")[0].title(),
        total=total,
        last=(last.crop, last.created_at.strftime("%d-%m-%Y %I:%M %p")) if last else None,
        active_page="profile",
    )


@router.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request, user: User | None = Depends(current_user_optional)):
    return require(user) or render(request, "settings.html", email=user.email, active_page="settings")


@router.get("/eval", response_class=HTMLResponse)
def eval_page(request: Request, user: User | None = Depends(current_user_optional)):
    """The evaluation numbers, read from the file `make eval` writes."""
    gate = require(user)
    if gate:
        return gate
    path = pathlib.Path(__file__).resolve().parents[2] / "docs" / "eval.json"
    if not path.exists():
        return render(request, "plan_missing.html", crop="evaluation results", crops=["run make eval"])
    data = json.loads(path.read_text())
    best = max(data["retrieval"], key=lambda r: (r["mrr"], r["hit_at_5"]))
    return render(request, "eval.html", data=data, best=best, active_page="eval")


@router.get("/assistant", response_class=HTMLResponse)
def assistant_page(request: Request, user: User | None = Depends(current_user_optional)):
    """KrishiMitra, full page. The floating button on other pages links here."""
    return require(user) or render(request, "assistant.html", active_page="assistant")


@router.get("/plan/{crop}", response_class=HTMLResponse)
def plan_page(
    request: Request,
    crop: str,
    acres: float = 1.0,
    city: str = "",
    state: str = "Telangana",
    latitude: float = 17.385,
    longitude: float = 78.4867,
    user: User | None = Depends(current_user_optional),
):
    """The plan for one crop: timeline, fertiliser, shops, prices and where to sell."""
    gate = require(user)
    if gate:
        return gate
    try:
        timeline = cropplan.sowing_window(crop)
        fertiliser = cropplan.fertiliser_plan(crop, acres=acres)
    except cropplan.UnknownCrop:
        return render(request, "plan_missing.html", crop=crop, crops=cropplan.known_crops())

    # Where "today" sits on the sowing-to-harvest bar, as a percentage.
    start = date.fromisoformat(timeline["sow_from"])
    end = date.fromisoformat(timeline["expected_harvest"])
    span = max(1, (end - start).days)
    today_pct = min(97, max(2, round(((date.today() - start).days / span) * 100)))

    def pretty(iso: str) -> str:
        return date.fromisoformat(iso).strftime("%d %b %Y")

    return render(
        request,
        "plan.html",
        crop=crop,
        timeline=timeline,
        pretty_sow_from=pretty(timeline["sow_from"]),
        pretty_sow_by=pretty(timeline["sow_by"]),
        pretty_harvest=pretty(timeline["expected_harvest"]),
        before_sowing=timeline["days_until_sowing"] > 0,
        fertiliser=fertiliser,
        city=city,
        state=state,
        latitude=latitude,
        longitude=longitude,
        today_pct=today_pct,
        active_page="results",
    )


# ---- the lookups the current pages call with fetch ------------------------
# These keep the existing JavaScript working; the React front end will use /api/v1 instead.


@router.post("/get_soil_by_city")
async def legacy_soil(request: Request, user: User | None = Depends(current_user_optional)):
    if not user:
        return JSONResponse({"success": False, "message": "Please sign in."}, status_code=401)
    body = await request.json()
    try:
        data = await lookup.soil_for_city((body.get("city") or "").strip())
    except lookup.LookupError as exc:
        return JSONResponse({"success": False, "message": str(exc)}, status_code=502)
    return JSONResponse({"success": True, **data})


@router.post("/get_weather_by_city")
async def legacy_weather(request: Request, user: User | None = Depends(current_user_optional)):
    if not user:
        return JSONResponse({"success": False, "message": "Please sign in."}, status_code=401)
    body = await request.json()
    try:
        data = await lookup.weather_for_city(
            (body.get("city") or "").strip(), int(body.get("range", 30))
        )
    except lookup.LookupError as exc:
        return JSONResponse({"success": False, "message": str(exc)}, status_code=502)
    return JSONResponse(
        {
            "success": True,
            **data,
            "phosphorus": None,
            "potassium": None,
            "nutrient_note": "Phosphorus and potassium need a soil test.",
        }
    )
