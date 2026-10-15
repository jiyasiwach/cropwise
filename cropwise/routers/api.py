"""The versioned JSON API. Everything the pages do, the API can do too.

All of it is documented at /docs, which is the OpenAPI schema generated from these signatures.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import Prediction, User, get_db
from ..schemas import (
    HistoryItem,
    LoginIn,
    PredictIn,
    PredictOut,
    SignupIn,
    SoilOut,
    UserOut,
    WeatherOut,
)
from ..security import COOKIE_NAME, current_user, hash_password, set_session_cookie, verify_password
from ..services import lookup
from ..services.predictor import recommend

router = APIRouter(prefix="/api/v1")


# ---- accounts -------------------------------------------------------------


@router.post("/auth/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    email = body.email.lower()
    if db.query(User).filter(User.email == email).one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "That email already has an account.")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        name=body.name.strip() or email.split("@")[0],
        state=body.state,
    )
    db.add(user)
    db.commit()
    set_session_cookie(response, email)
    return UserOut(id=user.id, email=user.email, name=user.name, state=user.state)


@router.post("/auth/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    user = db.query(User).filter(User.email == body.email.lower()).one_or_none()
    # One message for both failures, so the endpoint cannot be used to discover who has an account.
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Those details did not match an account.")
    set_session_cookie(response, user.email)
    return UserOut(id=user.id, email=user.email, name=user.name, state=user.state)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.delete_cookie(COOKIE_NAME, path="/")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email, name=user.name, state=user.state)


# ---- readings -------------------------------------------------------------


@router.get("/soil", response_model=SoilOut)
async def soil(city: str, _: User = Depends(current_user)) -> SoilOut:
    try:
        return SoilOut(**await lookup.soil_for_city(city))
    except lookup.LookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


@router.get("/weather", response_model=WeatherOut)
async def weather(city: str, days: int = 30, _: User = Depends(current_user)) -> WeatherOut:
    try:
        return WeatherOut(**await lookup.weather_for_city(city, days))
    except lookup.LookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


# ---- recommendation -------------------------------------------------------


@router.post("/predict", response_model=PredictOut)
def predict(
    body: PredictIn, user: User = Depends(current_user), db: Session = Depends(get_db)
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
    limit: int = 50, user: User = Depends(current_user), db: Session = Depends(get_db)
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
