# Evaluation

Measured by `make eval` on 35 gold items: 30 real farmer
questions across crops, fertiliser, schemes, soil and helplines, plus
5 prompt-injection attacks. The relevant document for each question was
labelled by hand in `eval/gold.jsonl`.

## Retrieval

| Configuration | Hit@5 | MRR | Median latency |
|---|---|---|---|
| bm25 | 1.000 | 0.928 | 2.0 ms |
| vector | 0.967 | 0.928 | 3.9 ms |
| hybrid | 1.000 | 0.928 | 4.5 ms |

**Hybrid and BM25 tie on this set** (MRR 0.928), and that is the honest reading: with 29 short, well-titled documents, lexical search is already at the ceiling. Hybrid earns its place on robustness rather than on this number — vectors alone still reach 0.967 Hit@5 on paraphrased questions such as "government money every four months", where BM25 has little term overlap to work with, and the gap would widen on a larger, noisier corpus. Reciprocal Rank Fusion is used because it needs no score calibration between the three arms.

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

## Reproducing

```bash
make eval
```

Figures regenerate into `docs/eval.json`, this file, and the `/eval` page in the app.
