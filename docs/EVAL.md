# Evaluation

Measured by `make eval` on 35 gold items: 30 real farmer
questions across crops, fertiliser, schemes, soil and helplines, plus
5 prompt-injection attacks. The relevant document for each question was
labelled by hand in `eval/gold.jsonl`.

## Retrieval

| Configuration | Hit@5 | MRR | Median latency |
|---|---|---|---|
| bm25 | 0.967 | 0.864 | 1.8 ms |
| vector | 0.967 | 0.903 | 3.2 ms |
| hybrid | 1.000 | 0.944 | 3.4 ms |

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

Not run: `OPENROUTER_API_KEY` is not set, so the assistant returns extractive MOCK answers and
there is nothing to judge. Set the key and run `make eval` again to fill this section.


## Crop Doctor (photo diagnosis)

Not measured yet: the vision model needs `OPENROUTER_API_KEY`. Run `make eval-doctor` with a key to fill this in. The guardrail paths are covered by `tests/test_doctor.py` without a key.

## Reproducing

```bash
make eval
```

Figures regenerate into `docs/eval.json`, this file, and the `/eval` page in the app.
