"""Expected profit per acre: yield × price − costs.

Every input is traceable. Yield comes from the crop calendar; the price is the modal mandi rate
(labelled MOCK when no data.gov.in key is set); fertiliser cost is computed from the bags the
plan says to buy, at prices from `data/input_costs.json`; seed and labour come from the same
file. Where a figure is a rough all-India average, the output says so rather than implying a
quotation.
"""

from __future__ import annotations

import json
import pathlib

from sqlalchemy.orm import Session

from . import cropplan, mandi

COSTS = pathlib.Path(__file__).resolve().parents[2] / "data" / "input_costs.json"
QUINTALS_PER_TONNE = 10


def _costs() -> dict:
    return json.loads(COSTS.read_text())


async def estimate(
    db: Session, crop: str, state: str, acres: float = 1.0, price_per_quintal: float | None = None
) -> dict:
    """What this crop is likely to earn and cost on `acres` acres."""
    calendar = json.loads((cropplan.DATA).read_text())["crops"].get(crop)
    if not calendar:
        raise cropplan.UnknownCrop(f"No yield figure recorded for '{crop}'.")

    costs = _costs()
    plan = cropplan.fertiliser_plan(crop, acres=acres)

    # Revenue
    if price_per_quintal is None:
        prices = await mandi.prices(db, crop, state, days=7)
        modal = [m["modal_price"] for m in prices["markets"] if m["modal_price"]]
        price_per_quintal = sum(modal) / len(modal) if modal else 0.0
        is_mock = prices["is_mock"]
        price_source = prices["source"]
    else:
        is_mock = False
        price_source = "price you entered"

    yield_quintals = calendar["yield_t_per_ha"] * QUINTALS_PER_TONNE / cropplan.ACRES_PER_HECTARE * acres
    revenue = yield_quintals * price_per_quintal

    # Costs
    fertiliser_cost = (
        plan["buy"]["urea"]["kg"] * costs["fertiliser_per_kg"]["urea"]
        + plan["buy"]["dap"]["kg"] * costs["fertiliser_per_kg"]["dap"]
        + plan["buy"]["mop"]["kg"] * costs["fertiliser_per_kg"]["mop"]
    )
    seed_cost = costs["seed_per_acre"].get(crop, costs["seed_per_acre"]["_default"]) * acres
    labour_cost = costs["labour_per_acre"].get(crop, costs["labour_per_acre"]["_default"]) * acres
    other_cost = costs["other_per_acre"] * acres
    total_cost = fertiliser_cost + seed_cost + labour_cost + other_cost

    return {
        "crop": crop,
        "acres": acres,
        "yield_quintals": round(yield_quintals, 1),
        "price_per_quintal": round(price_per_quintal),
        "revenue": round(revenue),
        "costs": {
            "seed": round(seed_cost),
            "fertiliser": round(fertiliser_cost),
            "labour": round(labour_cost),
            "other": round(other_cost),
            "total": round(total_cost),
        },
        "profit": round(revenue - total_cost),
        "profit_per_acre": round((revenue - total_cost) / max(acres, 0.01)),
        "is_mock_price": is_mock,
        "price_source": price_source,
        "assumptions": [
            f"Yield of {calendar['yield_t_per_ha']} t/ha is a typical average, not your field's record.",
            "Fertiliser is the full recommended dose; a soil test usually reduces it.",
            "Seed, labour and other costs are all-India rough averages from data/input_costs.json.",
            "Irrigation, rent, interest and transport to the mandi are not included.",
        ],
        "needs_verification": True,
    }


async def compare(db: Session, crops: list[str], state: str, acres: float = 1.0) -> list[dict]:
    """The same sum for several crops, best profit first — which is the question a farmer asks."""
    results = []
    for crop in crops:
        try:
            results.append(await estimate(db, crop, state, acres))
        except cropplan.UnknownCrop:
            continue
    results.sort(key=lambda r: -r["profit"])
    return results
