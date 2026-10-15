"""Retrieval over the agriculture knowledge base.

Three retrievers, fused:

  BM25    — classic lexical scoring. Strong when the farmer uses the exact word ("PMFBY", "urea").
  Vector  — TF-IDF reduced with truncated SVD, i.e. latent semantic indexing. Catches wording the
            document does not use ("government money for farmers" → PM-KISAN).
  Exact   — a boost when a crop name or scheme name in the question appears in a document's title.

They are combined with **Reciprocal Rank Fusion**, which needs no score calibration between
retrievers and is what the evaluation in docs/EVAL.md measures.

Why not neural embeddings: they would mean either a 400 MB model in a serverless function or an
API call per query, and the evaluation shows this is enough for a 29-document base. The
`Retriever` interface is small, so swapping in an embedding API is a contained change.
"""

from __future__ import annotations

import math
import pathlib
import re
from collections import Counter
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

KB_DIR = pathlib.Path(__file__).resolve().parents[2] / "data" / "kb"
CHUNK_WORDS = 180
CHUNK_OVERLAP = 40
RRF_K = 60  # the usual constant; large enough that rank 1 does not swamp everything else


@dataclass
class Chunk:
    doc: str
    title: str
    source: str
    text: str
    needs_verification: bool = False
    index: int = 0

    @property
    def citation(self) -> str:
        return f"{self.title} ({self.source})"


@dataclass
class Hit:
    chunk: Chunk
    score: float                      # fused RRF score: ranks only, not relevance
    found_by: list[str] = field(default_factory=list)
    cosine: float = 0.0               # semantic similarity, 0-1
    bm25: float = 0.0                 # lexical score, unbounded

    @property
    def relevance(self) -> float:
        """A single number that actually means "how well does this match".

        RRF is rank-based, so its score is nearly identical for every query and cannot tell a
        real question from an off-topic one. This combines the two underlying signals, which can.
        """
        return round(self.cosine + min(1.0, self.bm25 / 12.0), 4)


def _parse(path: pathlib.Path) -> tuple[dict, str]:
    """Split the YAML-ish header from the body. No dependency needed for four keys."""
    text = path.read_text()
    meta: dict = {}
    if text.startswith("---"):
        _, header, body = text.split("---", 2)
        for line in header.strip().splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                meta[key.strip()] = value.strip()
        return meta, body.strip()
    return meta, text.strip()


def _chunk(words: list[str]) -> list[str]:
    """Overlapping windows, so a sentence split across a boundary is still retrievable."""
    if len(words) <= CHUNK_WORDS:
        return [" ".join(words)]
    out = []
    step = CHUNK_WORDS - CHUNK_OVERLAP
    for start in range(0, len(words), step):
        piece = words[start : start + CHUNK_WORDS]
        if len(piece) < 30 and out:  # a stub tail belongs to the previous chunk
            break
        out.append(" ".join(piece))
    return out


def load_chunks() -> list[Chunk]:
    chunks: list[Chunk] = []
    for path in sorted(KB_DIR.glob("*.md")):
        if path.name == "README.md":
            continue
        meta, body = _parse(path)
        for i, piece in enumerate(_chunk(body.split())):
            chunks.append(
                Chunk(
                    doc=path.name,
                    title=meta.get("title", path.stem.replace("_", " ").title()),
                    source=meta.get("source", path.name),
                    text=piece,
                    needs_verification=meta.get("needs_verification") == "true",
                    index=i,
                )
            )
    return chunks


def tokenise(text: str) -> list[str]:
    """Words, with a trailing plural 's' stripped.

    Deliberately crude: it unifies helpline/helplines and scheme/schemes, which is most of the
    benefit a stemmer would bring on a base this size, with none of the dependency.
    """
    words = re.findall(r"[a-z0-9']+", text.lower())
    return [w[:-1] if len(w) > 4 and w.endswith("s") and not w.endswith("ss") else w for w in words]


class BM25:
    """Okapi BM25. Written out rather than pulled in, so the dependency list stays short."""

    def __init__(self, corpus: list[list[str]], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.corpus = corpus
        self.length = [len(d) for d in corpus]
        self.avg_length = sum(self.length) / max(1, len(corpus))
        self.freqs = [Counter(d) for d in corpus]
        df = Counter()
        for doc in corpus:
            df.update(set(doc))
        n = len(corpus)
        self.idf = {
            term: math.log(1 + (n - count + 0.5) / (count + 0.5)) for term, count in df.items()
        }

    def scores(self, query: list[str]) -> np.ndarray:
        out = np.zeros(len(self.corpus))
        for i, freqs in enumerate(self.freqs):
            total = 0.0
            for term in query:
                if term not in freqs:
                    continue
                f = freqs[term]
                denominator = f + self.k1 * (1 - self.b + self.b * self.length[i] / self.avg_length)
                total += self.idf.get(term, 0.0) * f * (self.k1 + 1) / denominator
            out[i] = total
        return out


class Index:
    """The three retrievers over one chunk set, plus the fusion that combines them."""

    def __init__(self, chunks: list[Chunk]):
        self.chunks = chunks
        corpus = [tokenise(c.text + " " + c.title) for c in chunks]
        self.bm25 = BM25(corpus)

        self.vectoriser = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1)
        tfidf = self.vectoriser.fit_transform([c.title + "\n" + c.text for c in chunks])
        # Latent semantic indexing: dense vectors that survive different wording.
        components = min(128, max(2, tfidf.shape[1] - 1, 2), tfidf.shape[0] - 1)
        self.svd = TruncatedSVD(n_components=components, random_state=42)
        self.vectors = normalize(self.svd.fit_transform(tfidf))

        # Names worth an exact-match boost: the crop or scheme a document is about. Generic
        # filename words ("crop", "scheme") must be excluded, or every farming question matches
        # all 22 crop guides.
        generic = {"crop", "scheme", "guide", "about", "cropwise", "helplines", "production"}
        self.names: dict[str, list[int]] = {}
        for i, chunk in enumerate(chunks):
            stem = chunk.doc.replace(".md", "")
            for prefix in ("crop_", "scheme_"):
                stem = stem.removeprefix(prefix)
            # Filename stem only. Title words such as "works" or "cannot" would match any
            # question and drown the real signal.
            for token in tokenise(stem.replace("_", " ")):
                if len(token) > 3 and token not in generic:
                    self.names.setdefault(token, []).append(i)

    def _bm25_rank(self, query: str) -> list[int]:
        return list(np.argsort(self.bm25.scores(tokenise(query)))[::-1])

    def _vector_rank(self, query: str) -> list[int]:
        vector = normalize(self.svd.transform(self.vectoriser.transform([query])))
        return list(np.argsort(self.vectors @ vector[0])[::-1])

    def _exact_rank(self, query: str) -> list[int]:
        tokens = set(tokenise(query))
        matched: list[int] = []
        for name, indexes in self.names.items():
            if name in tokens:
                matched.extend(indexes)
        return matched

    def search(self, query: str, top_k: int = 5, mode: str = "hybrid") -> list[Hit]:
        """mode: hybrid | bm25 | vector — the three arms the evaluation compares."""
        rankings: dict[str, list[int]] = {}
        if mode in ("hybrid", "bm25"):
            rankings["bm25"] = self._bm25_rank(query)[:30]
        if mode in ("hybrid", "vector"):
            rankings["vector"] = self._vector_rank(query)[:30]
        if mode == "hybrid":
            rankings["exact"] = self._exact_rank(query)[:10]

        fused: dict[int, float] = {}
        found_by: dict[int, list[str]] = {}
        for name, ranking in rankings.items():
            weight = 1.5 if name == "exact" else 1.0  # a named crop or scheme is a strong signal
            for rank, index in enumerate(ranking):
                fused[index] = fused.get(index, 0.0) + weight / (RRF_K + rank + 1)
                found_by.setdefault(index, []).append(name)

        best = sorted(fused.items(), key=lambda kv: -kv[1])[:top_k]
        # Raw signals for the winners, so the caller can tell "best of a bad lot" from "good match".
        bm25_scores = self.bm25.scores(tokenise(query))
        query_vector = normalize(self.svd.transform(self.vectoriser.transform([query])))[0]
        cosines = self.vectors @ query_vector
        return [
            Hit(
                chunk=self.chunks[i],
                score=round(score, 5),
                found_by=found_by[i],
                cosine=round(float(max(0.0, cosines[i])), 4),
                bm25=round(float(bm25_scores[i]), 3),
            )
            for i, score in best
        ]


@lru_cache(maxsize=1)
def index() -> Index:
    """Built once per process. 29 documents take well under a second."""
    return Index(load_chunks())


def search(query: str, top_k: int = 5, mode: str = "hybrid") -> list[Hit]:
    return index().search(query, top_k=top_k, mode=mode)
