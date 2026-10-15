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
from ..visitor import COOKIE_NAME, get_visitor
from ..services import cropplan, lookup, season
from ..services.predictor import recommend

ROOT = pathlib.Path(__file__).resolve().parents[2]
templates = Jinja2Templates(directory=str(ROOT / "templates"))

ROUTES = {
    "login": "/",
    "landing": "/",
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


# ---- entry ---------------------------------------------------------------


@router.get("/", response_class=HTMLResponse)
def landing(request: Request):
    """The front door.

    Rendered entirely from the local crop calendar so it appears at once; the live soil, weather
    and prices are fetched by the browser from /api/v1/season and swapped in when they arrive.
    """
    return render(
        request,
        "landing.html",
        active_page="landing",
        city=season.DEFAULT_CITY,
        month=date.today().strftime("%B"),
        sowable=season.sowable_now()[:3],
    )


@router.get("/logout")
def logout_page():
    """Kept so old links do not 404. There is nothing to sign out of."""
    return RedirectResponse("/", status_code=303)


# ---- the app --------------------------------------------------------------


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard(
    request: Request,
    city: str = season.DEFAULT_CITY,
    user: User = Depends(get_visitor),
    db: Session = Depends(get_db),
):
    """The app's home. Local data renders immediately; live conditions arrive over the API."""
    total = db.query(Prediction).filter(Prediction.user_id == user.id).count()
    recent = (
        db.query(Prediction)
        .filter(Prediction.user_id == user.id)
        .order_by(desc(Prediction.created_at))
        .limit(3)
        .all()
    )
    return render(
        request,
        "dashboard.html",
        active_page="dashboard",
        city=city,
        today_long=date.today().strftime("%A, %d %B %Y"),
        total=total,
        sowable=season.sowable_now(),
        icon=season.icon,
        recent=[
            {
                "crop": r.crop,
                "confidence": r.confidence,
                "city": r.city or "—",
                "when": r.created_at.strftime("%d %b"),
            }
            for r in recent
        ],
    )


@router.get("/soil", response_class=HTMLResponse)
def soil_page(request: Request, user: User = Depends(get_visitor)):
    return render(request, "soil.html", active_page="soil")


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
    user: User = Depends(get_visitor),
):
    """Step 2 of the wizard. The soil readings travel on in hidden fields."""
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
    user: User = Depends(get_visitor),
    db: Session = Depends(get_db),
):

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
def history_page(request: Request, user: User = Depends(get_visitor), db: Session = Depends(get_db)):
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
def profile_page(request: Request, user: User = Depends(get_visitor), db: Session = Depends(get_db)):
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
def settings_page(request: Request, user: User = Depends(get_visitor)):
    return render(request, "settings.html", email=user.email, active_page="settings")


@router.get("/eval", response_class=HTMLResponse)
def eval_page(request: Request, user: User = Depends(get_visitor)):
    """The evaluation numbers, read from the file `make eval` writes."""
    path = pathlib.Path(__file__).resolve().parents[2] / "docs" / "eval.json"
    if not path.exists():
        return render(request, "plan_missing.html", crop="evaluation results", crops=["run make eval"])
    data = json.loads(path.read_text())
    best = max(data["retrieval"], key=lambda r: (r["mrr"], r["hit_at_5"]))
    return render(request, "eval.html", data=data, best=best, active_page="eval")


@router.get("/assistant", response_class=HTMLResponse)
def assistant_page(request: Request, user: User = Depends(get_visitor)):
    """KrishiMitra, full page. The floating button on other pages links here."""
    return render(request, "assistant.html", active_page="assistant")


@router.get("/plan/{crop}", response_class=HTMLResponse)
def plan_page(
    request: Request,
    crop: str,
    acres: float = 1.0,
    city: str = "",
    state: str = "Telangana",
    latitude: float = 17.385,
    longitude: float = 78.4867,
    user: User = Depends(get_visitor),
):
    """The plan for one crop: timeline, fertiliser, shops, prices and where to sell."""
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
async def legacy_soil(request: Request, user: User = Depends(get_visitor), db: Session = Depends(get_db)):
    if not user:
        return JSONResponse({"success": False, "message": "Please sign in."}, status_code=401)
    body = await request.json()
    try:
        data = await lookup.soil_for_city((body.get("city") or "").strip(), db)
    except lookup.LookupError as exc:
        return JSONResponse({"success": False, "message": str(exc)}, status_code=502)
    return JSONResponse({"success": True, **data})


@router.post("/get_weather_by_city")
async def legacy_weather(request: Request, user: User = Depends(get_visitor)):
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
