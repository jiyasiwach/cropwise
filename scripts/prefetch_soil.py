"""Fetch real SoilGrids readings for India's main farming districts, once, and commit them.

Why: SoilGrids sits in the Netherlands and takes 10-25 seconds to answer from a serverless
function in the United States, which is longer than the request is allowed to live. These are
genuine readings, fetched here and cached in the repository, so the common case is instant and
only an unusual town has to wait for the live service.

Run again to refresh:  python scripts/prefetch_soil.py
"""

from __future__ import annotations

import asyncio
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from cropwise.services import lookup  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "soil_cache.json"
# ISRIC allows roughly five calls a minute. One town at a time, with a pause, is the only way
# to collect these without being throttled into failure.
PAUSE_SECONDS = 14

CITIES = [
    # Telangana / Andhra
    "Hyderabad", "Warangal", "Karimnagar", "Nizamabad", "Khammam", "Nalgonda", "Mahbubnagar",
    "Guntur", "Vijayawada", "Kurnool", "Anantapur", "Tirupati", "Rajahmundry", "Nellore",
    # Maharashtra
    "Nagpur", "Nashik", "Pune", "Aurangabad", "Solapur", "Amravati", "Akola", "Jalgaon", "Latur",
    # Punjab / Haryana / Himachal / J&K
    "Ludhiana", "Amritsar", "Patiala", "Bathinda", "Karnal", "Hisar", "Rohtak", "Shimla",
    # Uttar Pradesh / Uttarakhand
    "Lucknow", "Kanpur", "Varanasi", "Meerut", "Bareilly", "Gorakhpur", "Agra", "Dehradun",
    # Madhya Pradesh / Chhattisgarh
    "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Raipur", "Bilaspur",
    # Rajasthan / Gujarat
    "Jaipur", "Jodhpur", "Kota", "Bikaner", "Udaipur", "Ahmedabad", "Rajkot", "Junagadh", "Surat",
    # Karnataka / Tamil Nadu / Kerala
    "Bengaluru", "Belgaum", "Hubli", "Mysore", "Raichur", "Coimbatore", "Madurai", "Salem",
    "Thanjavur", "Tiruchirappalli", "Thrissur", "Palakkad", "Kochi",
    # East and north-east
    "Patna", "Muzaffarpur", "Bhagalpur", "Ranchi", "Kolkata", "Burdwan", "Siliguri",
    "Bhubaneswar", "Cuttack", "Sambalpur", "Guwahati", "Jorhat",
]


async def fetch(city: str) -> dict | None:
    try:
        return await lookup._soil_for_city(city)
    except Exception as exc:
        print(f"  {city:16} failed: {exc.__class__.__name__}", flush=True)
        return None


async def main() -> None:
    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    started = time.time()
    todo = [c for c in CITIES if c.strip().lower() not in existing]
    print(f"{len(existing)} already cached, fetching {len(todo)} one at a time…", flush=True)

    added = 0
    for i, city in enumerate(todo, start=1):
        payload = await fetch(city)
        if payload:
            existing[city.strip().lower()] = payload
            added += 1
            print(f"  [{i}/{len(todo)}] {city:16} N={payload['nitrogen']} pH={payload['ph']}"
                  f" (sampled {payload['sampled_offset_km']:.0f} km)", flush=True)
            # Written as we go, so a long run can be stopped and resumed.
            OUT.write_text(json.dumps(existing, indent=1, sort_keys=True) + "\n")
        await asyncio.sleep(PAUSE_SECONDS)
    print(f"added {added}, total {len(existing)} towns, in {time.time() - started:.0f}s → {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
