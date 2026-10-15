"""Soil and weather lookups.

Two free, unauthenticated services:
  * Open-Meteo geocoding  — city name to coordinates
  * ISRIC SoilGrids v2    — nitrogen, pH, clay and organic carbon at 0–5 cm
  * Open-Meteo forecast   — mean temperature, humidity, accumulated rainfall

Phosphorus and potassium are deliberately absent: SoilGrids does not publish them, and the only
honest source is a soil test (see docs/MODEL_CARD.md).
"""

from __future__ import annotations

import httpx

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT = httpx.Timeout(30.0, connect=10.0)


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


async def soil_for_city(city: str) -> dict:
    """Soil properties for the centre of a city. A regional estimate, not this farmer's field."""
    place = await geocode(city)
    lat, lon = place["latitude"], place["longitude"]
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

    layers = {
        layer["name"]: layer["depths"][0]["values"]["mean"]
        for layer in payload.get("properties", {}).get("layers", [])
        if layer.get("depths")
    }
    if not layers:
        raise LookupError("No soil data is published for that location.")

    # SoilGrids ships integers scaled by a documented factor: nitrogen cg/kg, pH ×10, clay ‰, soc dg/kg.
    return {
        "city": place.get("name", city),
        "country": place.get("country"),
        "latitude": lat,
        "longitude": lon,
        "nitrogen": round((layers.get("nitrogen") or 140) / 100.0, 2),
        "ph": round((layers.get("phh2o") or 65) / 10.0, 1),
        "clay": round((layers.get("clay") or 250) / 10.0, 1),
        "organic_carbon": round((layers.get("soc") or 120) / 10.0, 1),
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
