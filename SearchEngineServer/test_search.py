#!/usr/bin/env python3
"""Smoke tests for indexer + fixtures (no network)."""

from __future__ import annotations

from pathlib import Path

from crawler import load_fixture_pages, pages_to_dicts
from indexer import build_index, search

ROOT = Path(__file__).resolve().parent


def main() -> None:
    pages = pages_to_dicts(load_fixture_pages(ROOT / "fixtures"))
    assert len(pages) >= 4, f"expected fixtures, got {len(pages)}"
    index = build_index(pages)
    assert index.doc_count() == len(pages)

    tea = search(index, "녹차")
    assert tea, "expected green-tea hits"
    assert any("차" in r["title"] or "도서관" in r["title"] for r in tea)

    bm25 = search(index, "BM25")
    assert bm25, "expected BM25 hit"
    assert "검색" in bm25[0]["title"]

    park = search(index, "남산공원")
    assert park, "expected park hit"

    print("ok", {
        "docs": index.doc_count(),
        "tea_top": tea[0]["title"],
        "bm25_top": bm25[0]["title"],
        "park_top": park[0]["title"],
    })


if __name__ == "__main__":
    main()
