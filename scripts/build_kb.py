"""Build the knowledge base KrishiMitra answers from.

Every document is generated from a file whose provenance we can point at — the crop calendar,
the fertiliser table, the verified helplines — or is written here with its official source URL.
Nothing in data/kb/ may exist without a `source` line, because every answer has to cite one.
"""

from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
KB = ROOT / "data" / "kb"


def write(name: str, title: str, source: str, body: str, needs_verification: bool = False) -> None:
    KB.mkdir(parents=True, exist_ok=True)
    header = (
        f"---\ntitle: {title}\nsource: {source}\n"
        f"needs_verification: {'true' if needs_verification else 'false'}\n---\n\n"
    )
    (KB / name).write_text(header + body.strip() + "\n")


def crop_documents() -> int:
    data = json.loads((ROOT / "data" / "crop_calendar.json").read_text())
    months = ["", "January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"]
    for crop, c in data["crops"].items():
        npk = c["npk_kg_per_ha"]
        body = f"""
# {crop.title()}

**Season:** {c['season']}
**Sowing months:** {', '.join(months[m] for m in c['sow_months'])}
**Duration:** {c['duration_days']} days from sowing to harvest
**Water need:** {c['water']}
**Typical yield:** {c['yield_t_per_ha']} tonnes per hectare

## Fertiliser requirement

{crop.title()} needs about **{npk['N']} kg nitrogen (N), {npk['P2O5']} kg phosphorus (P2O5) and
{npk['K2O']} kg potassium (K2O) per hectare** for the whole crop. Divide by 2.47 for one acre.

To supply that with straight fertilisers: DAP carries 46% P2O5 and 18% N, urea carries 46% N, and
muriate of potash carries 60% K2O. Apply DAP and MOP at sowing in the furrow; split the urea, a
third at sowing and the rest at the active growth stages.

## Notes

{c.get('note', '')}

A soil test reduces these quantities. Without one, the full recommended dose is assumed. Confirm
with your Krishi Vigyan Kendra before buying: doses vary by state, variety and soil.
"""
        write(f"crop_{crop}.md", f"{crop.title()} production guide",
              "data/crop_calendar.json — ICAR Handbook of Agriculture and state packages of practices",
              body, needs_verification=True)
    return len(data["crops"])


def scheme_documents() -> int:
    schemes = [
        ("pm_kisan", "PM-KISAN income support", "https://pmkisan.gov.in/", """
# PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)

**What it gives:** ₹6,000 a year to a landholding farmer family, paid in three equal instalments
of ₹2,000 every four months, directly into a bank account.

**Who can apply:** landholding farmer families. Institutional landholders, families with a member
paying income tax, serving or retired government employees above Group D, professionals such as
doctors and lawyers, and pensioners drawing more than ₹10,000 a month are excluded.

**How to apply:** register at pmkisan.gov.in, or through a Common Service Centre, or with the
village revenue officer. Aadhaar and a bank account are required, and eKYC must be completed.

**If an instalment does not arrive:** check "Beneficiary Status" on the portal with your Aadhaar
or registration number, confirm your eKYC and land seeding are complete, then call the PM-KISAN
helpline on 155261.
"""),
        ("pmfby", "PMFBY crop insurance", "https://pmfby.gov.in/", """
# PMFBY (Pradhan Mantri Fasal Bima Yojana)

**What it gives:** insurance against crop loss from drought, flood, pest, disease, hail and other
natural causes, including prevented sowing and post-harvest losses.

**What the farmer pays:** a maximum of 2% of the sum insured for Kharif food and oilseed crops,
1.5% for Rabi food and oilseed crops, and 5% for commercial and horticultural crops. The
government pays the rest of the premium.

**Enrolment:** voluntary for all farmers. Enrol through a bank, a Common Service Centre, an
insurance agent or the National Crop Insurance Portal, before the cut-off date for that season.

**Making a claim:** report crop loss within **72 hours** of the damage, through the Crop Insurance
app, the insurer, the bank, or the helpline **14447**. Keep the complaint number.
"""),
        ("soil_health_card", "Soil Health Card", "https://soilhealth.dac.gov.in/", """
# Soil Health Card

**What it gives:** a laboratory report of your field's soil, covering nitrogen, phosphorus,
potassium, pH, electrical conductivity, organic carbon, sulphur and micronutrients, with a
fertiliser recommendation for the crops you grow.

**Why it matters:** satellite and model estimates such as SoilGrids do not publish phosphorus or
potassium at all, and give only a regional average for the rest. A card is a measurement of your
field. In CropWise, entering card values raises recommendation accuracy from about 97% to 99.6%.

**How to get one:** ask at your Krishi Vigyan Kendra, the block agriculture office, or a soil
testing laboratory. Samples are usually taken after harvest and before the next sowing. The card
is valid for about three years, or two crop cycles.
"""),
        ("kcc", "Kisan Credit Card", "https://www.myscheme.gov.in/schemes/kcc", """
# Kisan Credit Card (KCC)

**What it gives:** short-term credit for crop production, post-harvest expenses and farm
maintenance, at a concessional rate of interest. Interest subvention and a prompt-repayment
incentive bring the effective rate down for loans up to ₹3 lakh.

**Who can apply:** owner cultivators, tenant farmers, oral lessees, sharecroppers, and members of
joint liability groups. Dairy, fishery and animal husbandry activities are also covered.

**How to apply:** at any commercial bank, regional rural bank or cooperative bank, with proof of
identity, proof of address and land records.
"""),
        ("pm_kusum", "PM-KUSUM solar pumps", "https://pmkusum.mnre.gov.in/", """
# PM-KUSUM (solar pumps and grid-connected solar)

**What it gives:** subsidy for standalone solar agricultural pumps, solarisation of existing
grid-connected pumps, and small solar plants on barren farmland whose power can be sold.

**Typical support:** central and state subsidy together usually cover a large share of the cost of
a standalone solar pump, with the farmer paying the balance; the exact split is set by the state.

**How to apply:** through your state's nodal agency, usually the renewable energy development
agency, via the state portal linked from pmkusum.mnre.gov.in.
"""),
    ]
    for name, title, url, body in schemes:
        write(f"scheme_{name}.md", title, url, body)
    return len(schemes)


def helpline_document() -> int:
    data = json.loads((ROOT / "data" / "helplines.json").read_text())
    lines = ["# Farmer helplines", ""]
    for h in data["helplines"]:
        lines.append(f"## {h['name']} — {h['number']}")
        lines.append("")
        lines.append(f"{h['covers']}")
        lines.append("")
        lines.append(f"Hours: {h['hours']}. Cost: {h['cost']}. More: {h['url']}")
        lines.append("")
    lines.append(
        "If CropWise cannot answer a question, or the answer involves a pesticide dose, a payment "
        "problem or a legal matter, call the Kisan Call Centre on 1800-180-1551. It is free and "
        "answers in 22 languages."
    )
    write("helplines.md", "Farmer helplines", "data/helplines.json — official government sources",
          "\n".join(lines))
    return 1


def method_documents() -> int:
    write(
        "about_cropwise.md",
        "How CropWise works and what it cannot do",
        "docs/MODEL_CARD.md and docs/AUDIT.md in this repository",
        """
# How CropWise works

CropWise recommends crops from the soil and weather at your location, then plans the season.

**Soil** comes from ISRIC SoilGrids at 0-5 cm: nitrogen in g/kg, pH, clay percentage and organic
carbon. It is a roughly 250 m regional estimate, not a test of your field, and SoilGrids publishes
nothing under built-up land, so readings for a town are sampled from farmland nearby.

**Phosphorus and potassium are not available from any map.** Only a soil test measures them. An
earlier version of this app inferred them from the other readings; that was removed, because the
inferred values added no information and inflated the confidence shown to the farmer.

**Weather** comes from Open-Meteo: mean temperature, humidity and rainfall accumulated over the
window you choose, scaled to a 30-day basis.

**The recommendation** is a random forest over 22 crops, chosen by stratified five-fold
cross-validation. Without a soil test it is about 97% accurate on that dataset; with one, 99.6%.
The dataset is a clean 2,200-row teaching set, not Indian field trials, so treat those figures as
an upper bound. When your readings fall outside anything the model was trained on, the app says
so instead of answering confidently.

**What CropWise cannot do:** it cannot diagnose a disease from a description, cannot recommend a
pesticide dose, cannot see your field, and does not know your irrigation, rotation or soil
salinity. For any of those, ask your Krishi Vigyan Kendra or call 1800-180-1551.
""",
    )
    return 1


if __name__ == "__main__":
    n = crop_documents() + scheme_documents() + helpline_document() + method_documents()
    print(f"wrote {n} documents to data/kb/")
