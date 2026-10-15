"""What a page can show before the farmer has done anything.

Everything here is real: the crops are the ones whose sowing window is open this month according
to the calendar, the soil and weather come from the live services, and the prices come from the
mandi cache (labelled MOCK when no data.gov.in key is set). Nothing is invented to fill a page.
"""

from __future__ import annotations

import time
from datetime import date

from sqlalchemy.orm import Session

from . import cropplan, lookup, mandi
from .predictor import recommend

DEFAULT_CITY = "Hyderabad"

# One recognisable mark per crop. Not photographs: a photo of the wrong variety is worse than
# an honest symbol, and these load instantly on a slow connection.
CROP_ICON = {
    "rice": "🌾", "maize": "🌽", "chickpea": "🫛", "kidneybeans": "🫘", "pigeonpeas": "🫛",
    "mothbeans": "🫘", "mungbean": "🫛", "blackgram": "🫘", "lentil": "🫘", "pomegranate": "🍅",
    "banana": "🍌", "mango": "🥭", "grapes": "🍇", "watermelon": "🍉", "muskmelon": "🍈",
    "apple": "🍎", "orange": "🍊", "papaya": "🫒", "coconut": "🥥", "cotton": "🌱",
    "jute": "🌿", "coffee": "☕",
}

CROP_TINT = {
    "grain": "#e8f1e4", "pulse": "#f1ecdd", "fruit": "#fbe8e2", "fibre": "#e6eef4", "other": "#eee9f3",
}
CROP_KIND = {
    "rice": "grain", "maize": "grain",
    "chickpea": "pulse", "kidneybeans": "pulse", "pigeonpeas": "pulse", "mothbeans": "pulse",
    "mungbean": "pulse", "blackgram": "pulse", "lentil": "pulse",
    "pomegranate": "fruit", "banana": "fruit", "mango": "fruit", "grapes": "fruit",
    "watermelon": "fruit", "muskmelon": "fruit", "apple": "fruit", "orange": "fruit",
    "papaya": "fruit", "coconut": "fruit",
    "cotton": "fibre", "jute": "fibre", "coffee": "other",
}


def icon(crop: str) -> str:
    return CROP_ICON.get(crop, "🌱")


def tint(crop: str) -> str:
    return CROP_TINT[CROP_KIND.get(crop, "other")]


def sowable_now(today: date | None = None, limit: int = 6) -> list[dict]:
    """Crops whose sowing window is open this month, soonest deadline first."""
    today = today or date.today()
    open_now = []
    for crop in cropplan.known_crops():
        window = cropplan.sowing_window(crop, today)
        if window["days_until_sowing"] == 0:
            open_now.append(
                {
                    "crop": crop,
                    "icon": icon(crop),
                    "tint": tint(crop),
                    "season": window["season"],
                    "sow_by": window["sow_by"],
                    "harvest": window["expected_harvest"],
                    "days_left": (date.fromisoformat(window["sow_by"]) - today).days,
                }
            )
    open_now.sort(key=lambda c: c["days_left"])
    return open_now[:limit]


# The landing page must not wait on two upstream services on every hit, and must not go blank
# when one of them is slow. Snapshots are cached for a quarter of an hour, and the last good one
# is served (marked stale) if a refresh fails.
_CACHE: dict[str, tuple[float, dict]] = {}
CACHE_SECONDS = 900


async def snapshot(db: Session, city: str = DEFAULT_CITY) -> dict:
    """Live soil, weather and recommendations for a city, cached, with a usable fallback."""
    key = city.strip().lower()
    cached = _CACHE.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return cached[1]

    fresh = await _build_snapshot(db, city)
    if fresh["crops"]:
        _CACHE[key] = (time.time(), fresh)
        return fresh

    if cached:  # upstream is unwell; yesterday's reading beats an empty page
        stale = dict(cached[1])
        stale["stale"] = True
        return stale
    return fresh


async def _build_snapshot(db: Session, city: str = DEFAULT_CITY) -> dict:
    today = date.today()
    result: dict = {
        "city": city,
        "month": today.strftime("%B"),
        "sowable": sowable_now(today),
        "soil": None,
        "weather": None,
        "crops": [],
        "prices": [],
        "prices_live": mandi.configured(),
        "errors": [],
    }

    try:
        soil = await lookup.soil_for_city(city)
        weather = await lookup.weather_for_city(city)
        result["soil"] = soil
        result["weather"] = weather
        prediction = recommend(
            {
                "nitrogen": soil["nitrogen"],
                "ph": soil["ph"],
                "clay": soil["clay"],
                "organic_carbon": soil["organic_carbon"],
                "temperature": weather["temperature"],
                "humidity": weather["humidity"],
                "rainfall": weather["rainfall"],
            }
        )
        for item in prediction["crops"]:
            window = cropplan.sowing_window(item["crop"], today)
            result["crops"].append(
                {
                    **item,
                    "icon": icon(item["crop"]),
                    "tint": tint(item["crop"]),
                    "window": (
                        "sow now, harvest "
                        + date.fromisoformat(window["expected_harvest"]).strftime("%b")
                        if window["days_until_sowing"] == 0
                        else "sowing opens "
                        + date.fromisoformat(window["sow_from"]).strftime("%b")
                    ),
                }
            )
    except Exception as exc:  # a slow upstream must not empty the page
        result["errors"].append(f"{exc.__class__.__name__}")
        # Fall back to what the calendar alone can say: the crops whose sowing window is open.
        # These carry no confidence figure, because no model ran — and the page says so.
        for item in result["sowable"][:3]:
            result["crops"].append(
                {
                    "crop": item["crop"],
                    "confidence": None,
                    "reasons": [],
                    "icon": item["icon"],
                    "tint": item["tint"],
                    "window": f"{item['season']} · sow within {item['days_left']} days",
                }
            )

    try:
        for crop in [c["crop"] for c in result["crops"][:3]] or ["rice", "maize", "cotton"]:
            prices = await mandi.prices(db, crop, "Telangana", days=7)
            best = max(
                (m for m in prices["markets"] if m["modal_price"]),
                key=lambda m: m["modal_price"],
                default=None,
            )
            if best:
                result["prices"].append(
                    {"crop": crop, "modal": int(best["modal_price"]), "market": best["market"]}
                )
    except Exception as exc:
        result["errors"].append(f"{exc.__class__.__name__}")

    return result
