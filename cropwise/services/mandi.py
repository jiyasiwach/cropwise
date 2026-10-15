"""Mandi (market) prices from data.gov.in, cached daily, with an honest fallback.

The Agmarknet resource behind data.gov.in is slow and frequently unavailable, so every successful
response is cached in the database and a stale row is served with its date rather than an empty
page. Without `DATA_GOV_IN_API_KEY` the module returns clearly labelled MOCK rows so the rest of
the app can be built and demonstrated — they are never presented as real prices.
"""

from __future__ import annotations

import os
from datetime import date, timedelta

import httpx
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import MandiPrice

RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"  # Current daily price of commodities (Agmarknet)
BASE_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# Agmarknet names differ from the model's crop labels.
COMMODITY_NAMES = {
    "rice": "Paddy(Dhan)(Common)",
    "maize": "Maize",
    "chickpea": "Bengal Gram(Gram)(Whole)",
    "kidneybeans": "Rajma",
    "pigeonpeas": "Arhar (Tur/Red Gram)(Whole)",
    "mothbeans": "Moth Dal",
    "mungbean": "Green Gram (Moong)(Whole)",
    "blackgram": "Black Gram (Urd Beans)(Whole)",
    "lentil": "Lentil (Masur)(Whole)",
    "pomegranate": "Pomegranate",
    "banana": "Banana",
    "mango": "Mango",
    "grapes": "Grapes",
    "watermelon": "Water Melon",
    "muskmelon": "Musk Melon",
    "apple": "Apple",
    "orange": "Orange",
    "papaya": "Papaya",
    "coconut": "Coconut",
    "cotton": "Cotton",
    "jute": "Jute",
    "coffee": "Coffee",
}

# Rough all-India modal prices (₹/quintal) used only to populate labelled MOCK rows when no API
# key is configured. They are a plausible order of magnitude, nothing more.
MOCK_BASE = {
    "rice": 2200, "maize": 2050, "chickpea": 5400, "kidneybeans": 7200, "pigeonpeas": 7000,
    "mothbeans": 5600, "mungbean": 7800, "blackgram": 6900, "lentil": 6200, "pomegranate": 9000,
    "banana": 1800, "mango": 4500, "grapes": 6000, "watermelon": 1200, "muskmelon": 1500,
    "apple": 8500, "orange": 3200, "papaya": 1600, "coconut": 2800, "cotton": 7200,
    "jute": 5300, "coffee": 11000,
}


def configured() -> bool:
    return bool(os.environ.get("DATA_GOV_IN_API_KEY"))


# Four pretend markets at small offsets from the farmer, so the "best market" ranking can be
# demonstrated before a data.gov.in key exists. Every row carries is_mock=True.
MOCK_MARKETS = [
    {"market": "MOCK Nearby mandi", "d_lat": 0.06, "d_lon": 0.04, "premium": 0.98},
    {"market": "MOCK District mandi", "d_lat": 0.22, "d_lon": 0.15, "premium": 1.03},
    {"market": "MOCK Regional mandi", "d_lat": 0.45, "d_lon": -0.30, "premium": 1.07},
    {"market": "MOCK Far mandi", "d_lat": -0.85, "d_lon": 0.60, "premium": 1.12},
]


def _mock_rows(crop: str, state: str, days: int, lat: float | None, lon: float | None) -> list[dict]:
    """Deterministic pretend prices, always flagged. Never shown without the MOCK label."""
    base = MOCK_BASE.get(crop, 2500)
    lat = 20.59 if lat is None else lat  # centre of India, when we do not know where they are
    lon = 78.96 if lon is None else lon
    rows = []
    for market in MOCK_MARKETS:
        for offset in range(days):
            day = date.today() - timedelta(days=offset)
            # A gentle repeatable wobble, so a trend chart has something to draw.
            swing = ((day.toordinal() % 7) - 3) * base * 0.01
            modal = round((base + swing) * market["premium"])
            rows.append(
                {
                    "crop": crop,
                    "state": state,
                    "district": "MOCK district",
                    "market": market["market"],
                    "price_date": day.isoformat(),
                    "min_price": round(modal * 0.93),
                    "max_price": round(modal * 1.07),
                    "modal_price": modal,
                    "latitude": round(lat + market["d_lat"], 4),
                    "longitude": round(lon + market["d_lon"], 4),
                    "is_mock": True,
                }
            )
    return rows


async def _fetch_live(crop: str, state: str, limit: int = 200) -> list[dict]:
    commodity = COMMODITY_NAMES.get(crop, crop.title())
    params = {
        "api-key": os.environ["DATA_GOV_IN_API_KEY"],
        "format": "json",
        "limit": limit,
        "filters[commodity]": commodity,
    }
    if state:
        params["filters[state]"] = state
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(BASE_URL, params=params)
    response.raise_for_status()

    rows = []
    for record in response.json().get("records", []):
        try:
            rows.append(
                {
                    "crop": crop,
                    "state": record.get("state") or state,
                    "district": record.get("district"),
                    "market": record.get("market") or "Unknown",
                    "price_date": _normalise_date(record.get("arrival_date")),
                    "min_price": float(record.get("min_price") or 0) or None,
                    "max_price": float(record.get("max_price") or 0) or None,
                    "modal_price": float(record.get("modal_price") or 0) or None,
                    "is_mock": False,
                }
            )
        except (TypeError, ValueError):
            continue  # one malformed record must not lose the rest
    return rows


def _normalise_date(value: str | None) -> str:
    """Agmarknet sends DD/MM/YYYY; we store YYYY-MM-DD."""
    if not value:
        return date.today().isoformat()
    parts = value.replace("-", "/").split("/")
    if len(parts) == 3 and len(parts[0]) == 2:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return value


def _store(db: Session, rows: list[dict]) -> None:
    for row in rows:
        exists = (
            db.query(MandiPrice)
            .filter(
                MandiPrice.crop == row["crop"],
                MandiPrice.state == row["state"],
                MandiPrice.market == row["market"],
                MandiPrice.price_date == row["price_date"],
            )
            .one_or_none()
        )
        if exists:
            continue
        db.add(MandiPrice(**row))
    db.commit()


async def prices(
    db: Session,
    crop: str,
    state: str,
    days: int = 30,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict:
    """Today's prices plus a trend, from the API when it answers and the cache when it does not."""
    today = date.today().isoformat()
    cached_today = (
        db.query(MandiPrice)
        .filter(MandiPrice.crop == crop, MandiPrice.state == state, MandiPrice.price_date == today)
        .all()
    )

    status = "cache"
    error = None
    if not cached_today:
        if configured():
            try:
                _store(db, await _fetch_live(crop, state))
                status = "live"
            except (httpx.HTTPError, KeyError) as exc:
                error = f"data.gov.in did not answer ({exc.__class__.__name__}); showing the last prices we have."
                status = "stale"
        else:
            _store(db, _mock_rows(crop, state, days, latitude, longitude))
            status = "mock"

    since = (date.today() - timedelta(days=days)).isoformat()
    rows = (
        db.query(MandiPrice)
        .filter(
            MandiPrice.crop == crop,
            MandiPrice.state == state,
            MandiPrice.price_date >= since,
        )
        .order_by(desc(MandiPrice.price_date))
        .all()
    )

    markets = {}
    for row in rows:
        markets.setdefault(row.market, row)  # newest row per market, because of the ordering

    trend: dict[str, list[float]] = {}
    for row in rows:
        if row.modal_price:
            trend.setdefault(row.price_date, []).append(row.modal_price)
    series = [
        {"date": day, "modal_price": round(sum(values) / len(values))}
        for day, values in sorted(trend.items())
    ]

    is_mock = any(r.is_mock for r in rows)
    return {
        "crop": crop,
        "state": state,
        "status": status,
        "is_mock": is_mock,
        "last_updated": rows[0].price_date if rows else None,
        "markets": [
            {
                "market": row.market,
                "district": row.district,
                "min_price": row.min_price,
                "max_price": row.max_price,
                "modal_price": row.modal_price,
                "price_date": row.price_date,
                "latitude": row.latitude,
                "longitude": row.longitude,
                "is_mock": row.is_mock,
            }
            for row in markets.values()
        ],
        "trend": series,
        "unit": "₹ per quintal",
        "error": error,
        "source": (
            "MOCK DATA — no DATA_GOV_IN_API_KEY is set. These are placeholder figures, not real prices."
            if is_mock
            else "data.gov.in, Agmarknet daily mandi prices"
        ),
    }
