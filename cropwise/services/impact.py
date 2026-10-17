"""What choosing the right mandi is worth on one farm, in rupees.

The impact page's calculator. It reuses the season plan's sums rather than inventing new
ones: typical yield from the crop calendar, then the net-price ranking from `market`.
Everything it returns is an estimate and says so.
"""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from . import cropplan, lookup, market


async def mandi_gain(
    db: Session,
    crop: str,
    acres: float,
    town: str | None = None,
    state: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict:
    """Nearest mandi versus the best mandi after transport, for this crop on `acres` acres.

    Pass a town (looked up on Open-Meteo's geocoder) or a point and a state.
    Raises cropplan.UnknownCrop or LookupError with a message fit to show the farmer.
    """
    calendar = json.loads(cropplan.DATA.read_text())["crops"].get(crop)
    if not calendar:
        raise cropplan.UnknownCrop(f"No yield figure recorded for '{crop}'.")

    if latitude is None or longitude is None or not state:
        place = await lookup.geocode(town or "")
        latitude, longitude = place["latitude"], place["longitude"]
        state = place.get("admin1") or state or ""
        town = place.get("name", town)

    quintals = round(calendar["yield_t_per_ha"] * 10 / cropplan.ACRES_PER_HECTARE * acres, 1)
    ranking = await market.best_markets(db, crop, state, latitude, longitude, quintals)
    nearest, best = ranking["nearest"], (ranking["best"] or [None])[0]

    def brief(row: dict | None) -> dict | None:
        if not row:
            return None
        return {
            "market": row["market"],
            "district": row.get("district"),
            "distance_km": round(row["distance_km"], 1),
            "modal_price": row["modal_price"],
            "transport_per_quintal": row["transport_cost_per_quintal"],
            "net_per_quintal": row["net_price_per_quintal"],
        }

    per_quintal = best["gain_vs_nearest_per_quintal"] if best and nearest else None
    return {
        "crop": crop,
        "acres": acres,
        "town": town,
        "state": state,
        "yield_quintals": quintals,
        "nearest": brief(nearest),
        "best": brief(best),
        "gain_per_quintal": per_quintal,
        "gain_total": round(per_quintal * quintals) if per_quintal is not None else None,
        "is_mock": ranking["is_mock"],
        "source": ranking["source"],
        "last_updated": ranking["last_updated"],
        "method": ranking["method"],
        "assumptions": [
            f"Yield of {calendar['yield_t_per_ha']} t/ha is a typical average, not your field's record.",
            "Prices are the latest modal prices; they change daily.",
            f"Transport at ₹{ranking['transport_rate_per_quintal_km']}/quintal/km over straight-line "
            "distance; real roads are longer, so treat the gain as an upper bound.",
        ],
        "is_estimate": True,
    }
