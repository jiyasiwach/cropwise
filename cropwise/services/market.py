"""Which mandi actually pays best, once the lorry is paid for.

The headline price is not the money a farmer keeps: a mandi 60 km away at ₹2,250 can be worse
than one 8 km away at ₹2,180. This ranks markets by net price after transport.
"""

from __future__ import annotations

import os

from sqlalchemy.orm import Session

from . import mandi
from .stores import distance_km

# ₹ per quintal per kilometre, for a shared lorry. Configurable because it varies by region,
# season and load; the default is a conservative mid-range figure and is shown to the farmer.
DEFAULT_RATE = float(os.environ.get("TRANSPORT_RATE_PER_QUINTAL_KM", "2.5"))


async def best_markets(
    db: Session,
    crop: str,
    state: str,
    latitude: float,
    longitude: float,
    quintals: float = 10.0,
    rate_per_quintal_km: float | None = None,
    top: int = 3,
) -> dict:
    """Markets ranked by modal price minus transport, nearest-first as the tie-break."""
    rate = rate_per_quintal_km if rate_per_quintal_km is not None else DEFAULT_RATE
    data = await mandi.prices(db, crop, state, latitude=latitude, longitude=longitude)

    ranked = []
    for row in data["markets"]:
        if not row["modal_price"]:
            continue
        # Markets without coordinates cannot be costed; they are listed, not ranked.
        if row["latitude"] is None or row["longitude"] is None:
            ranked.append(
                {
                    **row,
                    "distance_km": None,
                    "transport_cost_per_quintal": None,
                    "net_price_per_quintal": None,
                    "note": "Distance unknown: this mandi has no map location yet.",
                }
            )
            continue
        distance = distance_km((latitude, longitude), (row["latitude"], row["longitude"]))
        transport = round(distance * rate, 2)
        ranked.append(
            {
                **row,
                "distance_km": distance,
                "transport_cost_per_quintal": transport,
                "net_price_per_quintal": round(row["modal_price"] - transport, 2),
            }
        )

    costed = [r for r in ranked if r["net_price_per_quintal"] is not None]
    costed.sort(key=lambda r: (-r["net_price_per_quintal"], r["distance_km"]))
    nearest = min(costed, key=lambda r: r["distance_km"]) if costed else None

    for row in costed:
        row["gain_vs_nearest_per_quintal"] = (
            round(row["net_price_per_quintal"] - nearest["net_price_per_quintal"], 2)
            if nearest
            else None
        )
        row["gain_vs_nearest_total"] = (
            round(row["gain_vs_nearest_per_quintal"] * quintals, 2) if nearest else None
        )

    return {
        "crop": crop,
        "state": state,
        "quintals": quintals,
        "transport_rate_per_quintal_km": rate,
        "best": costed[:top],
        "nearest": nearest,
        "uncosted": [r for r in ranked if r["net_price_per_quintal"] is None][:5],
        "is_mock": data["is_mock"],
        "last_updated": data["last_updated"],
        "source": data["source"],
        "method": (
            "net price = modal price − (straight-line distance × ₹"
            f"{rate}/quintal/km). Road distance is longer, so treat the gain as an upper bound."
        ),
    }
