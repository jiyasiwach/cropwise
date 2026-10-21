"""The versioned JSON API. Everything the pages do, the API can do too.

All of it is documented at /docs, which is the OpenAPI schema generated from these signatures.
"""

from __future__ import annotations

import json
import pathlib

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import Prediction, User, get_db
from ..schemas import HistoryItem, PredictIn, PredictOut, SoilOut, UserOut, WeatherOut
from ..visitor import get_visitor
from ..services import cropplan, impact, lookup, mandi, market, profit, schemes, season, stores, yield_model
from ..services.predictor import recommend

router = APIRouter(prefix="/api/v1")


# ---- who am I ------------------------------------------------------------


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_visitor)) -> UserOut:
    """There is no sign-in: this is the workspace tied to this browser."""
    return UserOut(id=user.id, email=user.email, name=user.name, state=user.state)


# ---- readings -------------------------------------------------------------


@router.get("/soil", response_model=SoilOut)
async def soil(
    city: str, _: User = Depends(get_visitor), db: Session = Depends(get_db)
) -> SoilOut:
    try:
        return SoilOut(**await lookup.soil_for_city(city, db))
    except lookup.LookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


@router.get("/weather", response_model=WeatherOut)
async def weather(city: str, days: int = 30, _: User = Depends(get_visitor)) -> WeatherOut:
    try:
        return WeatherOut(**await lookup.weather_for_city(city, days))
    except lookup.LookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


# ---- recommendation -------------------------------------------------------


@router.post("/predict", response_model=PredictOut)
def predict(
    body: PredictIn, user: User = Depends(get_visitor), db: Session = Depends(get_db)
) -> PredictOut:
    """Top three crops. Uses the lab model only when a soil test supplied N, P and K."""
    has_lab = None not in (body.lab_nitrogen, body.lab_phosphorus, body.lab_potassium)
    if has_lab:
        result = recommend(
            {
                "N": body.lab_nitrogen,
                "P": body.lab_phosphorus,
                "K": body.lab_potassium,
                "temperature": body.temperature,
                "humidity": body.humidity,
                "ph": body.ph,
                "rainfall": body.rainfall,
            },
            source="lab",
        )
    else:
        result = recommend(
            {
                "nitrogen": body.nitrogen,
                "ph": body.ph,
                "clay": body.clay,
                "organic_carbon": body.organic_carbon,
                "temperature": body.temperature,
                "humidity": body.humidity,
                "rainfall": body.rainfall,
            },
            source="field",
        )

    best = result["crops"][0]
    row = Prediction(
        user_id=user.id,
        crop=best["crop"],
        confidence=best["confidence"],
        model_source=result["source"],
        unusual_readings=result["unusual_readings"],
        city=body.city,
        latitude=body.latitude,
        longitude=body.longitude,
        nitrogen=body.lab_nitrogen if has_lab else body.nitrogen,
        phosphorus=body.lab_phosphorus,
        potassium=body.lab_potassium,
        ph=body.ph,
        clay=body.clay,
        organic_carbon=body.organic_carbon,
        temperature=body.temperature,
        humidity=body.humidity,
        rainfall=body.rainfall,
        alternatives=json.dumps(result["crops"][1:]),
    )
    db.add(row)
    db.commit()

    return PredictOut(
        crops=result["crops"],
        model_source=result["source"],
        unusual_readings=result["unusual_readings"],
        prediction_id=row.id,
    )


@router.get("/history", response_model=list[HistoryItem])
def history(
    limit: int = 50, user: User = Depends(get_visitor), db: Session = Depends(get_db)
) -> list[HistoryItem]:
    rows = (
        db.query(Prediction)
        .filter(Prediction.user_id == user.id)
        .order_by(desc(Prediction.created_at))
        .limit(min(limit, 200))
        .all()
    )
    return [
        HistoryItem(
            id=r.id,
            crop=r.crop,
            confidence=r.confidence,
            city=r.city,
            model_source=r.model_source,
            created_at=r.created_at.isoformat(timespec="seconds"),
        )
        for r in rows
    ]


# ---- the crop plan --------------------------------------------------------


@router.get("/plan/{crop}")
def crop_plan(
    crop: str,
    acres: float = 1.0,
    soil_phosphorus: float | None = None,
    soil_potassium: float | None = None,
    soil_nitrogen: float | None = None,
    _: User = Depends(get_visitor),
) -> dict:
    """When to sow, when to harvest, and what fertiliser to buy for this much land."""
    try:
        return {
            "timeline": cropplan.sowing_window(crop),
            "fertiliser": cropplan.fertiliser_plan(
                crop,
                acres=acres,
                soil={"P": soil_phosphorus, "K": soil_potassium, "nitrogen": soil_nitrogen},
            ),
        }
    except cropplan.UnknownCrop as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("/stores")
async def nearby_stores(
    latitude: float,
    longitude: float,
    radius_km: float = 15,
    _: User = Depends(get_visitor),
) -> dict:
    """Agri-input shops near a point, from OpenStreetMap."""
    return await stores.find_stores(latitude, longitude, radius_km)


@router.get("/mandi")
async def mandi_prices(
    crop: str,
    state: str,
    days: int = 30,
    latitude: float | None = None,
    longitude: float | None = None,
    _: User = Depends(get_visitor),
    db: Session = Depends(get_db),
) -> dict:
    """Daily mandi prices and a trend. Cached; labelled MOCK when no data.gov.in key is set."""
    return await mandi.prices(db, crop, state, days, latitude, longitude)


@router.get("/best-market")
async def best_market(
    crop: str,
    state: str,
    latitude: float,
    longitude: float,
    quintals: float = 10.0,
    _: User = Depends(get_visitor),
    db: Session = Depends(get_db),
) -> dict:
    """Markets ranked by what the farmer actually keeps, after transport."""
    return await market.best_markets(db, crop, state, latitude, longitude, quintals)


@router.get("/impact/mandi-gain")
async def mandi_gain(
    crop: str,
    acres: float = 1.0,
    town: str | None = None,
    state: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    _: User = Depends(get_visitor),
    db: Session = Depends(get_db),
) -> dict:
    """Rupees gained by selling at the best net mandi instead of the nearest. An estimate."""
    if not (0 < acres <= 1000):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Acres must be between 0 and 1000.")
    if not town and (latitude is None or longitude is None or not state):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Give a town, or a point and a state.")
    try:
        return await impact.mandi_gain(db, crop.lower().strip(), acres, town, state, latitude, longitude)
    except cropplan.UnknownCrop as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except (lookup.LookupError, LookupError) as exc:  # lookup has its own LookupError
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("/place")
async def place(city: str, _: User = Depends(get_visitor)) -> dict:
    """A town's name, state and position, for the screens that need a state (mandi prices)."""
    try:
        found = await lookup.geocode(city[:80])
    except (lookup.LookupError, LookupError) as exc:  # lookup has its own LookupError
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return {"city": found.get("name", city), "state": found.get("admin1"), "district": found.get("admin2"),
            "country": found.get("country"), "latitude": found["latitude"], "longitude": found["longitude"]}


@router.get("/schemes")
def scheme_list(state: str | None = None, _: User = Depends(get_visitor)) -> dict:
    """Central farmer schemes plus the farmer's state schemes, each with its official source."""
    return schemes.schemes(state)


@router.get("/schemes/updates")
async def scheme_updates(limit: int = 12, _: User = Depends(get_visitor)) -> dict:
    """Recent official agriculture announcements (cached for an hour)."""
    return await schemes.updates(max(1, min(limit, 30)))


@router.get("/channels")
def official_channels(state: str | None = None, _: User = Depends(get_visitor)) -> dict:
    """Official WhatsApp/Telegram/helpline channels published by government bodies."""
    return schemes.channels(state)


@router.get("/yield/options")
def yield_options(state: str | None = None, district: str | None = None, _: User = Depends(get_visitor)) -> dict:
    """States, districts and crops the yield forecast has government records for."""
    return yield_model.options(state, district)


@router.get("/yield")
def yield_forecast(
    crop: str, state: str, district: str, season: str = "Kharif", acres: float | None = None,
    _: User = Depends(get_visitor),
) -> dict:
    """Next season's expected district yield per acre (low/likely/high), and for this many acres."""
    if season not in yield_model.SEASONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Season must be Kharif, Rabi or Summer.")
    if acres is not None and not 0 < acres <= 1000:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Acres must be between 0 and 1000.")
    try:
        return yield_model.forecast(crop.lower(), state, district, season, acres)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("/eval")
def evaluation(_: User = Depends(get_visitor)) -> dict:
    """The measured numbers the /eval screen shows, exactly as `make eval` / `make eval-doctor` wrote them."""
    docs = pathlib.Path(__file__).resolve().parents[2] / "docs"
    read = lambda name: json.loads((docs / name).read_text()) if (docs / name).exists() else None  # noqa: E731
    return {"assistant": read("eval.json"), "doctor": read("doctor_eval.json"), "yield": read("yield_eval.json")}


@router.get("/profit")
async def profit_estimate(
    crop: str,
    state: str = "Telangana",
    acres: float = 1.0,
    _: User = Depends(get_visitor),
    db: Session = Depends(get_db),
) -> dict:
    """Expected yield, revenue, costs and profit for one crop on this much land."""
    try:
        return await profit.estimate(db, crop.lower(), state, acres)
    except cropplan.UnknownCrop as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("/profit/compare")
async def profit_compare(
    crops: str,
    state: str = "Telangana",
    acres: float = 1.0,
    _: User = Depends(get_visitor),
    db: Session = Depends(get_db),
) -> dict:
    """The same sum for several crops (comma separated), best profit first."""
    names = [c.strip().lower() for c in crops.split(",") if c.strip()][:5]
    return {"acres": acres, "state": state, "results": await profit.compare(db, names, state, acres)}


@router.get("/season")
async def season_snapshot(
    city: str = season.DEFAULT_CITY,
    _: User = Depends(get_visitor),
    db: Session = Depends(get_db),
) -> dict:
    """Live conditions and what suits them, for the landing page and the dashboard.

    Cached for fifteen minutes. Pages fetch this after they have rendered, so a slow soil
    service delays one card rather than the whole page.
    """
    return await season.snapshot(db, city)
