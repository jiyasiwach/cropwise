---
title: How CropWise works and what it cannot do
source: docs/MODEL_CARD.md and docs/AUDIT.md in this repository
needs_verification: false
---

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

**Crop Doctor** (at /doctor) looks at a photo of one sick leaf and names the likely problem, with
how sure it is, for the diseases in its knowledge base only: rice blast, rice bacterial leaf
blight, rice brown spot, maize turcicum leaf blight, maize common rust, apple scab, grape downy
mildew, citrus greening, cotton leaf curl and mango powdery mildew. Its advice is quoted from
cited TNAU and Government of India sources. If the photo is unclear, it is not sure, or the
problem is not in that list, it gives no treatment and sends you to an expert. Photos are never
stored.

**What CropWise cannot do:** it cannot diagnose a disease from a description, cannot invent a
pesticide dose, cannot see your field, and does not know your irrigation, rotation or soil
salinity. For any of those, ask your Krishi Vigyan Kendra or call 1800-180-1551.
