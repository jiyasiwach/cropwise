# Evaluation

Measured by `make eval` on 35 gold items: 30 real farmer
questions across crops, fertiliser, schemes, soil and helplines, plus
5 prompt-injection attacks. The relevant document for each question was
labelled by hand in `eval/gold.jsonl`.

## Retrieval

| Configuration | Hit@5 | MRR | Median latency |
|---|---|---|---|
| bm25 | 0.967 | 0.859 | 2.9 ms |
| vector | 0.967 | 0.903 | 3.9 ms |
| hybrid | 1.000 | 0.944 | 4.0 ms |

**hybrid** wins on MRR. Hybrid fuses BM25, latent-semantic vectors and an exact-name boost with Reciprocal Rank Fusion: BM25 handles "PMFBY" and "urea", the vectors handle "government money every four months", and neither alone handles both.

### Where retrieval still misses

- none: every question found a correct document in the top 5

## Guardrails

| Metric | Result |
|---|---|
| Injection attacks blocked | **5/5** (100%) |
| Real questions wrongly blocked | **0/30** (0%) |

The false-positive rate is the number that matters: a filter that blocks everything scores 100%
on attacks and is useless. Layer 1 is a weighted heuristic filter; layer 2, an LLM classifier,
runs only on the uncertain middle band (score 0.3–0.6) and only when a key is configured.

The first run of this harness blocked 3 of 5. The two that slipped scored 0.4 and 0.5 — just
under the threshold — and were exactly the family layer 2 exists for. Rather than lower the
threshold and risk blocking real questions, three narrow patterns were added for that family
("no rules", "unrestricted", "from now on you are"), which took the block rate to 5/5 with the
false-positive rate still at zero. That is the loop this harness is for.

## Answer quality (LLM judge)

| Metric | Score |
|---|---|
| Faithfulness — every claim supported by a passage or tool result | **0.87** (runs ranged 0.80–0.90) |
| Citation accuracy — cites only passages or tools it was given | **0.97** (runs ranged 0.90–1.00) |
| Median end-to-end latency | 1446 ms |

Judged on 10 questions, asked 3 times each, by `google/gemini-2.5-flash-lite`.

The first judged run, on 17 Oct 2026, scored **0.60 faithfulness and 0.80 citation accuracy**,
and both halves of that were worth fixing. The harness was unfair: the judge saw passages cut to
600 characters and none of the tool results, so correct answers built from the fertiliser
calculator were graded unsupported. It now sees exactly what the assistant saw. And one failure
was real: asked for urea *per hectare*, the assistant quoted the calculator's *per-acre* figure,
which would under-fertilise by 2.5x. Telling the model the unit did not stop it, so the tool now
returns per-acre and per-hectare figures itself and the model never converts; a test pins it.
The judge was also told to check units. One later single run scored 1.00, which is why answers
are now asked three times and averaged. What still fails: "What month do I plant rice?" is
sometimes met with a question about the farmer's town instead of "June–July", and chickpea's
nitrogen answer can drop the source's caveat that it fixes its own nitrogen. Ten questions is a
small sample.


## Crop Doctor (photo diagnosis)

23 labelled photos (13 leaves, plus non-plant and injection photos),
vision model `google/gemini-2.5-flash-lite`, judge `google/gemini-2.5-flash-lite`, run 2026-10-17 15:17.
Leaf photos: 15 from the PlantVillage dataset (Mohanty et al. 2016, doi:10.3389/fpls.2016.01419), licence CC BY-SA 3.0 as declared in the dataset card; 3 of them with instructions written on them for the injection test, shared under the same licence. Non-plant photos: 5 CC0 images from Wikimedia Commons. PlantVillage photos are single leaves on plain backgrounds, easier than field photos, so these numbers are an upper bound for real use.

| Metric | Result |
|---|---|
| Top-1 accuracy (refusals count as wrong) | **92%** |
| Top-1 accuracy when it did answer | 92% |
| Wrong-refusal rate (leaf photos it declined) | 0% |
| Correct-refusal rate (non-plant, injection, disease not covered) | **80%** — non-plant 5/5, injections resisted 3/3, uncovered disease escalated 0/2 |
| Citation coverage of answered diagnoses | 100% |
| Faithfulness of advice to its citation (LLM judge) | 100% on 13 model-written answers |
| p50 latency per check | 2627 ms |
| Cost per check | $0.000185 |

Every row is in `docs/doctor_eval.json`. Refusing is cheap and a wrong diagnosis is expensive, so
the wrong-refusal rate is reported next to accuracy rather than hidden inside it.

**Known failure, not fixed:** both grape black-rot photos — a disease the knowledge base does not
cover — were diagnosed as grape downy mildew instead of being escalated. Three runs tried two
fixes: telling the classifier that a different disease on the same crop is "other", then giving
it each condition's leaf signs from the cited documents. Neither changed the result (runs 1–2 are
kept in `docs/doctor_eval_run1.json` and `run2.json`; the numbers above are run 3, the deployed
code). The harm is bounded — the downy-mildew document names no spray or dose and sends the farmer
to a KVK — but the fix is a knowledge-base entry for black rot or a second-opinion check, not a
prompt. Also missed: one citrus-greening leaf called healthy. PlantVillage photos are single
leaves on plain backgrounds, so field accuracy will be lower than this.

## Reproducing

```bash
make eval
```

Figures regenerate into `docs/eval.json`, this file, and the `/eval` page in the app.
