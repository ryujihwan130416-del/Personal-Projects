from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tokenize_util import tokenize


@dataclass
class Document:
    doc_id: int
    url: str
    title: str
    text: str
    fetched_at: float
    tokens: list[str] = field(default_factory=list)


@dataclass
class Index:
    documents: dict[int, Document]
    inverted: dict[str, dict[int, int]]  # term -> {doc_id: tf}
    doc_lengths: dict[int, int]
    avg_doc_len: float
    built_at: float

    def doc_count(self) -> int:
        return len(self.documents)


def build_index(pages: list[dict[str, Any]]) -> Index:
    documents: dict[int, Document] = {}
    inverted: dict[str, dict[int, int]] = {}
    doc_lengths: dict[int, int] = {}

    for doc_id, page in enumerate(pages):
        title = page.get("title") or ""
        text = page.get("text") or ""
        # Title terms count twice for a light title boost at index time
        combined = f"{title} {title} {text}"
        tokens = tokenize(combined)
        documents[doc_id] = Document(
            doc_id=doc_id,
            url=page["url"],
            title=title,
            text=text,
            fetched_at=float(page.get("fetched_at") or time.time()),
            tokens=tokens,
        )
        doc_lengths[doc_id] = len(tokens)
        tf: dict[str, int] = {}
        for tok in tokens:
            tf[tok] = tf.get(tok, 0) + 1
        for term, count in tf.items():
            inverted.setdefault(term, {})[doc_id] = count

    avg = (sum(doc_lengths.values()) / len(doc_lengths)) if doc_lengths else 0.0
    return Index(
        documents=documents,
        inverted=inverted,
        doc_lengths=doc_lengths,
        avg_doc_len=avg,
        built_at=time.time(),
    )


def bm25_score(
    index: Index,
    query_terms: list[str],
    doc_id: int,
    *,
    k1: float = 1.5,
    b: float = 0.75,
) -> float:
    n = index.doc_count()
    if n == 0:
        return 0.0
    score = 0.0
    dl = index.doc_lengths.get(doc_id, 0)
    avgdl = index.avg_doc_len or 1.0
    for term in query_terms:
        postings = index.inverted.get(term)
        if not postings or doc_id not in postings:
            continue
        df = len(postings)
        idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
        tf = postings[doc_id]
        denom = tf + k1 * (1 - b + b * dl / avgdl)
        score += idf * (tf * (k1 + 1)) / denom
    return score


def search(index: Index, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
    terms = tokenize(query)
    if not terms or index.doc_count() == 0:
        return []

    # Candidate docs: union of postings
    candidates: set[int] = set()
    for term in terms:
        candidates.update(index.inverted.get(term, {}).keys())

    scored: list[tuple[float, int]] = []
    for doc_id in candidates:
        s = bm25_score(index, terms, doc_id)
        if s > 0:
            scored.append((s, doc_id))
    scored.sort(key=lambda x: (-x[0], x[1]))

    results: list[dict[str, Any]] = []
    for score, doc_id in scored[:limit]:
        doc = index.documents[doc_id]
        results.append(
            {
                "url": doc.url,
                "title": doc.title,
                "snippet": make_snippet(doc.text, terms),
                "score": round(score, 4),
            }
        )
    return results


def make_snippet(text: str, terms: list[str], *, radius: int = 70) -> str:
    if not text:
        return ""
    lower = text.lower()
    pos = -1
    hit = ""
    for term in terms:
        i = lower.find(term)
        if i != -1 and (pos == -1 or i < pos):
            pos = i
            hit = term
    if pos == -1:
        snippet = text[: radius * 2].strip()
        return snippet + ("…" if len(text) > len(snippet) else "")

    start = max(0, pos - radius)
    end = min(len(text), pos + len(hit) + radius)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


def save_corpus(path: Path, pages: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")


def load_corpus(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def merge_pages(existing: list[dict[str, Any]], new_pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_url = {p["url"]: p for p in existing}
    for page in new_pages:
        by_url[page["url"]] = page
    return list(by_url.values())
