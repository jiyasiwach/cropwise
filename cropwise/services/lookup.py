"""Soil and weather lookups.

Two free, unauthenticated services:
  * Open-Meteo geocoding  — city name to coordinates
  * ISRIC SoilGrids v2    — nitrogen, pH, clay and organic carbon at 0–5 cm
  * Open-Meteo forecast   — mean temperature, humidity, accumulated rainfall

Phosphorus and potassium are deliberately absent: SoilGrids does not publish them, and the only
honest source is a soil test (see docs/MODEL_CARD.md).
"""

from __future__ import annotations

import asyncio
import json
import math
import pathlib

import httpx

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
# Generous, because SoilGrids is often slow — but nothing that renders a page may wait on it.
# Pages render from local data and fetch these readings afterwards.
TIMEOUT = httpx.Timeout(8.0, connect=5.0)
# SoilGrids can take half a minute. A serverless function that waits that long is killed and the
# farmer sees a 500, so the whole lookup is bounded and cached instead.
# Vercel's gateway cuts a request off at about 25 seconds, and a cold start spends several
# seconds importing scikit-learn before this code runs. Twelve seconds leaves room for both,
# so a slow upstream produces a clear message instead of a 500.
SOIL_BUDGET_SECONDS = 12.0
_SOIL_CACHE: dict[str, dict] = {}
PREFETCHED = pathlib.Path(__file__).resolve().parents[2] / "data" / "soil_cache.json"


def _prefetched() -> dict:
    """Readings collected by scripts/prefetch_soil.py and committed with the code.

    They are real SoilGrids values, not estimates: fetching them here rather than at request
    time is what keeps auto-detect instant for the towns most farmers will type.
    """
    try:
        return json.loads(PREFETCHED.read_text())
    except (OSError, ValueError):
        return {}


class LookupError(Exception):
    """Raised with a sentence a farmer can act on, not a stack trace."""


async def geocode(city: str) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(
            GEOCODE_URL, params={"name": city, "count": 1, "language": "en", "format": "json"}
        )
    if response.status_code != 200:
        raise LookupError("Could not look up that city. Try again in a moment.")
    results = (response.json() or {}).get("results")
    if not results:
        raise LookupError(f"We could not find a place called '{city}'.")
    return results[0]


async def _query_soilgrids(lat: float, lon: float) -> dict:
    """Raw SoilGrids values at one point, or {} when it publishes nothing there."""
    params = [
        ("lat", lat),
        ("lon", lon),
        ("property", "nitrogen"),
        ("property", "phh2o"),
        ("property", "clay"),
        ("property", "soc"),
        ("depth", "0-5cm"),
        ("value", "mean"),
    ]
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(SOILGRIDS_URL, params=params)
    if response.status_code != 200 or not response.text.strip():
        raise LookupError("The soil service (ISRIC SoilGrids) is not responding. Try again later.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise LookupError("The soil service returned something unreadable.") from exc

    return {
        layer["name"]: layer["depths"][0]["values"]["mean"]
        for layer in payload.get("properties", {}).get("layers", [])
        if layer.get("depths")
    }


async def soil_for_city(city: str, db=None) -> dict:
    """Soil for a town, from the database if anyone has asked before, otherwise from SoilGrids."""
    key = city.strip().lower()
    if key in _SOIL_CACHE:
        return _SOIL_CACHE[key]

    shipped = _prefetched().get(key)
    if shipped:
        _SOIL_CACHE[key] = shipped
        return shipped

    if db is not None:
        from ..database import SoilReading

        row = db.query(SoilReading).filter(SoilReading.place == key).one_or_none()
        if row:
            cached = json.loads(row.payload)
            _SOIL_CACHE[key] = cached
            return cached
    try:
        result = await asyncio.wait_for(_soil_for_city(city), timeout=SOIL_BUDGET_SECONDS)
    except asyncio.TimeoutError as exc:
        raise LookupError(
            "The soil service (ISRIC SoilGrids) is taking too long right now. Try again in a "
            "minute, or type your Soil Health Card values in by hand."
        ) from exc
    _SOIL_CACHE[key] = result
    if db is not None:
        from ..database import SoilReading

        try:
            db.add(SoilReading(place=key, payload=json.dumps(result)))
            db.commit()
        except Exception:
            db.rollback()  # a duplicate from a parallel request is harmless
    return result


async def _soil_for_city(city: str) -> dict:
    """Soil properties near a city.

    SoilGrids masks built-up land and water, so a city-centre coordinate often has no data at
    all. Rather than substituting a national average — which the first version of this app did,
    and presented as a measurement — we sample a ring of points around the town until we find
    real farmland, and tell the farmer how far away that sample was taken.
    """
    place = await geocode(city)
    lat, lon = place["latitude"], place["longitude"]

    # ISRIC rate-limits SoilGrids to roughly five calls a minute, so the ring is walked one
    # point at a time and stops as soon as something answers. Firing them in parallel looked
    # faster and in fact tripped the limit, which is why most towns returned nothing.
    def ring_point(radius_km: float, bearing_degrees: float) -> tuple[float, float]:
        angle = math.radians(bearing_degrees)
        return (
            lat + (radius_km / 111.0) * math.cos(angle),
            lon + (radius_km / (111.0 * max(0.2, math.cos(math.radians(lat))))) * math.sin(angle),
        )

    attempts: list[tuple[float, tuple[float, float]]] = [(0.0, (lat, lon))]
    attempts += [(10.0, ring_point(10.0, b)) for b in (0, 120, 240)]
    attempts += [(25.0, ring_point(25.0, 60))]

    layers: dict = {}
    sampled_km = 0.0
    for distance, (plat, plon) in attempts:
        try:
            found = await _query_soilgrids(plat, plon)
        except LookupError:
            continue
        if any(v is not None for v in found.values()):
            layers, sampled_km = found, distance
            break

    if not layers or all(v is None for v in layers.values()):
        raise LookupError(
            f"SoilGrids publishes no soil data within 25 km of {place.get('name', city)}. "
            "Enter your Soil Health Card values instead."
        )

    # SoilGrids ships integers scaled by a documented factor: nitrogen cg/kg, pH ×10, clay ‰, soc dg/kg.
    scale = {"nitrogen": 100.0, "phh2o": 10.0, "clay": 10.0, "soc": 10.0}
    values = {}
    missing = []
    for key, name in [("nitrogen", "nitrogen"), ("phh2o", "ph"), ("clay", "clay"), ("soc", "organic_carbon")]:
        raw = layers.get(key)
        if raw is None:
            # Substituting a national average here would be a guess wearing a measurement's clothes.
            missing.append(name)
            values[name] = None
        else:
            values[name] = round(raw / scale[key], 2 if key == "nitrogen" else 1)

    if missing == ["nitrogen", "ph", "clay", "organic_carbon"]:
        raise LookupError(
            "SoilGrids publishes no soil data for that location. Try a nearby town, or enter "
            "your Soil Health Card values."
        )

    return {
        "city": place.get("name", city),
        "country": place.get("country"),
        "latitude": lat,
        "longitude": lon,
        **values,
        "missing": missing,
        "sampled_offset_km": sampled_km,
        "sample_note": (
            f"No soil is mapped under {place.get('name', city)} itself (SoilGrids masks built-up "
            f"land), so these readings come from farmland about {sampled_km:.0f} km away."
            if sampled_km
            else None
        ),
        "phosphorus": None,
        "potassium": None,
    }


async def weather_for_city(city: str, days: int = 30) -> dict:
    """Mean temperature, current humidity and rainfall accumulated over `days`.

    Rainfall is scaled to a 30-day basis because the training data's rainfall column is on roughly
    that scale. The dataset does not document its own accumulation window, so this is a stated
    assumption rather than a fact (docs/DECISIONS.md).
    """
    days = max(1, min(int(days), 92))
    place = await geocode(city)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(
            FORECAST_URL,
            params={
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "current": "relative_humidity_2m",
                "daily": "temperature_2m_mean,precipitation_sum",
                "past_days": max(0, days - 1),
                "forecast_days": 1,
                "timezone": "auto",
            },
        )
    if response.status_code != 200:
        raise LookupError("The weather service is not responding. Try again in a moment.")
    payload = response.json()
    daily = payload.get("daily", {})
    temps = [t for t in daily.get("temperature_2m_mean", []) if t is not None]
    rain = [r for r in daily.get("precipitation_sum", []) if r is not None]
    counted = max(1, len(rain))

    return {
        "city": place.get("name", city),
        "days": days,
        "temperature": round(sum(temps) / len(temps), 2) if temps else 25.0,
        "humidity": float(payload.get("current", {}).get("relative_humidity_2m") or 70.0),
        "rainfall": round(sum(rain) * (30.0 / counted), 2) if rain else 0.0,
    }
