"""The crop plan: when to sow, when to harvest, and what fertiliser closes the nutrient gap.

Every number traces to `data/crop_calendar.json`, which carries its own sources and a
`needs_verification` flag. Nothing here invents a dose: if a crop is missing from the file, the
caller is told so rather than given a plausible-looking figure.
"""

from __future__ import annotations

import json
import pathlib
from datetime import date, timedelta

DATA = pathlib.Path(__file__).resolve().parents[2] / "data" / "crop_calendar.json"
ACRES_PER_HECTARE = 2.47105

MONTHS = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _load() -> dict:
    return json.loads(DATA.read_text())


def known_crops() -> list[str]:
    return sorted(_load()["crops"])


class UnknownCrop(Exception):
    """Raised instead of guessing when a crop is not in the calendar."""


def sowing_window(crop: str, today: date | None = None) -> dict:
    """The next sowing window for this crop, and the harvest it implies.

    Months come from the calendar file; the dates are computed from today, so the farmer sees
    "sow by 14 July", not "sown in Kharif".
    """
    data = _load()
    entry = data["crops"].get(crop)
    if not entry:
        raise UnknownCrop(f"No calendar entry for '{crop}'.")
    today = today or date.today()

    # The next first-of-month that is a sowing month, looking up to 18 months ahead.
    candidates = []
    for offset in range(0, 19):
        month = (today.month - 1 + offset) % 12 + 1
        year = today.year + (today.month - 1 + offset) // 12
        if month in entry["sow_months"]:
            start = date(year, month, 1)
            # A window that has already begun this month still counts: sow now.
            candidates.append(max(start, today) if (year, month) == (today.year, today.month) else start)
    if not candidates:
        raise UnknownCrop(f"No sowing months recorded for '{crop}'.")

    start = candidates[0]
    # The window runs to the end of the last consecutive sowing month.
    end_month = start.month
    end_year = start.year
    while ((end_month % 12) + 1) in entry["sow_months"] and end_month - start.month < 3:
        end_month = (end_month % 12) + 1
        if end_month == 1:
            end_year += 1
    last_day = (date(end_year + (end_month == 12), (end_month % 12) + 1, 1) - timedelta(days=1))
    harvest = start + timedelta(days=entry["duration_days"])

    return {
        "crop": crop,
        "season": entry["season"],
        "sow_from": start.isoformat(),
        "sow_by": last_day.isoformat(),
        "sow_months": [MONTHS[m] for m in entry["sow_months"]],
        "duration_days": entry["duration_days"],
        "expected_harvest": harvest.isoformat(),
        "days_until_sowing": (start - today).days,
        "water_need": entry.get("water"),
        "note": entry.get("note"),
        "source": "data/crop_calendar.json — ICAR / state package of practices, general all-India figures",
        "needs_verification": True,
    }


def fertiliser_plan(crop: str, acres: float = 1.0, soil: dict | None = None) -> dict:
    """What to buy, in bags, to meet this crop's nutrient requirement on this much land.

    `soil` may carry measured `P` and `K` (kg/ha, from a Soil Health Card) and `nitrogen` (g/kg,
    from SoilGrids). Measured values reduce the dose; absent ones are stated as assumptions, never
    silently assumed to be zero.
    """
    data = _load()
    entry = data["crops"].get(crop)
    if not entry:
        raise UnknownCrop(f"No fertiliser requirement recorded for '{crop}'.")
    need = dict(entry["npk_kg_per_ha"])
    hectares = acres / ACRES_PER_HECTARE
    soil = soil or {}
    assumptions: list[str] = []

    # A soil test credits the nutrients already in the field. Without one we cannot deduct
    # anything, and we say so instead of pretending the soil is empty.
    credits = {"N": 0.0, "P2O5": 0.0, "K2O": 0.0}
    if soil.get("P") is not None:
        credits["P2O5"] = min(float(soil["P"]) * 0.5, need["P2O5"] * 0.5)
    else:
        assumptions.append("No soil test for phosphorus, so the full recommended dose is shown.")
    if soil.get("K") is not None:
        credits["K2O"] = min(float(soil["K"]) * 0.5, need["K2O"] * 0.5)
    else:
        assumptions.append("No soil test for potassium, so the full recommended dose is shown.")
    if soil.get("nitrogen") is not None:
        assumptions.append(
            f"Soil nitrogen is {float(soil['nitrogen']):.2f} g/kg (a regional estimate, not a lab test), "
            "so the nitrogen dose is not reduced."
        )

    gap = {k: max(0.0, need[k] - credits[k]) for k in need}
    per_field = {k: round(v * hectares, 1) for k, v in gap.items()}

    # Straight fertilisers, applied in the usual order: DAP first for phosphorus, then urea for
    # whatever nitrogen the DAP did not already supply, then MOP for potassium.
    dap_kg = per_field["P2O5"] / 0.46 if per_field["P2O5"] else 0.0
    n_from_dap = dap_kg * 0.18
    urea_kg = max(0.0, (per_field["N"] - n_from_dap)) / 0.46
    mop_kg = per_field["K2O"] / 0.60 if per_field["K2O"] else 0.0

    def bags(kg: float) -> dict:
        return {"kg": round(kg, 1), "bags_50kg": round(kg / 50.0, 1)}

    return {
        "crop": crop,
        "acres": acres,
        "requirement_kg_per_ha": need,
        "credited_from_soil_test_kg_per_ha": {k: round(v, 1) for k, v in credits.items()},
        "to_apply_kg_for_your_land": per_field,
        "buy": {
            "dap": bags(dap_kg),
            "urea": bags(urea_kg),
            "mop": bags(mop_kg),
        },
        "organic_option": {
            "farmyard_manure_tonnes": round(data["fertilizers"]["organic"]["fym"]["rate_t_per_ha"] * hectares, 1),
            "vermicompost_tonnes": round(data["fertilizers"]["organic"]["vermicompost"]["rate_t_per_ha"] * hectares, 1),
            "note": data["fertilizers"]["organic"]["fym"]["note"],
        },
        "how_to_apply": [
            "DAP and MOP at sowing, placed in the furrow rather than broadcast.",
            "Urea in two or three splits: a third at sowing and the rest at the active growth stages.",
            "Farmyard manure three weeks before sowing, worked into the soil.",
        ],
        "assumptions": assumptions,
        "source": "data/crop_calendar.json — ICAR / state package of practices, general all-India figures",
        "needs_verification": True,
        "warning": "Confirm with your Krishi Vigyan Kendra before buying. Doses vary by state, variety and soil.",
    }
