"""Nearby agri-input shops, from OpenStreetMap.

Overpass is free and needs no key, which matters for an app aimed at farmers. Coverage in rural
India is patchy, so an empty result is reported as "none mapped near you" rather than "none exist",
and the Krishi Vigyan Kendra fallback is offered instead.
"""

from __future__ import annotations

import math

import httpx

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",  # mirror, used when the first is busy
]
TIMEOUT = httpx.Timeout(45.0, connect=10.0)

# shop=agrarian covers seed, fertiliser and pesticide dealers; garden_centre catches the rest.
QUERY = """
[out:json][timeout:40];
(
  node["shop"="agrarian"](around:{radius},{lat},{lon});
  way["shop"="agrarian"](around:{radius},{lat},{lon});
  node["shop"="garden_centre"](around:{radius},{lat},{lon});
  way["shop"="garden_centre"](around:{radius},{lat},{lon});
  node["amenity"="marketplace"](around:{radius},{lat},{lon});
  node["office"="government"]["government"="agriculture"](around:{radius},{lat},{lon});
);
out center {limit};
"""


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance. Straight-line, so a road journey is always a little longer."""
    radius = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return round(2 * radius * math.asin(math.sqrt(h)), 2)


def _kind(tags: dict) -> str:
    if tags.get("shop") == "agrarian":
        return "Agri-input shop"
    if tags.get("shop") == "garden_centre":
        return "Garden centre"
    if tags.get("amenity") == "marketplace":
        return "Market"
    return "Agriculture office"


async def find_stores(lat: float, lon: float, radius_km: float = 15, limit: int = 20) -> dict:
    """Shops within `radius_km`, nearest first."""
    query = QUERY.format(radius=int(radius_km * 1000), lat=lat, lon=lon, limit=limit * 3)
    elements: list[dict] = []
    error: str | None = None

    for url in OVERPASS_URLS:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(url, data={"data": query})
            if response.status_code == 200:
                elements = response.json().get("elements", [])
                error = None
                break
            error = f"OpenStreetMap returned {response.status_code}."
        except httpx.HTTPError as exc:  # try the mirror before giving up
            error = f"Could not reach OpenStreetMap: {exc.__class__.__name__}"

    results = []
    for element in elements:
        point = element.get("center") or element
        if point.get("lat") is None or point.get("lon") is None:
            continue
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name:
            continue  # an unnamed pin helps nobody
        results.append(
            {
                "name": name,
                "kind": _kind(tags),
                "latitude": point["lat"],
                "longitude": point["lon"],
                "distance_km": distance_km((lat, lon), (point["lat"], point["lon"])),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "address": ", ".join(
                    v for v in [tags.get("addr:street"), tags.get("addr:city")] if v
                )
                or None,
                "directions_url": f"https://www.google.com/maps/dir/?api=1&destination={point['lat']},{point['lon']}",
            }
        )

    results.sort(key=lambda s: s["distance_km"])
    return {
        "origin": {"latitude": lat, "longitude": lon},
        "radius_km": radius_km,
        "count": len(results[:limit]),
        "stores": results[:limit],
        "error": error,
        "note": (
            "Shops come from OpenStreetMap, which volunteers maintain. Rural coverage is thin, so "
            "an empty list means nothing is mapped nearby — not that nothing is there. Ask at your "
            "Krishi Vigyan Kendra or the block agriculture office."
            if not results
            else "Shops come from OpenStreetMap. Opening hours and stock are not guaranteed; call first."
        ),
        "source": "OpenStreetMap via Overpass API",
    }
