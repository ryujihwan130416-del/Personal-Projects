from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from crawler import crawl, load_fixture_pages, pages_to_dicts
from indexer import (
    Index,
    build_index,
    load_corpus,
    merge_pages,
    save_corpus,
    search as search_index,
)

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
CORPUS_PATH = DATA_DIR / "corpus.json"
WEB_DIR = ROOT / "web"
FIXTURES_DIR = ROOT / "fixtures"

app = FastAPI(title="서랍", description="로컬 전용 미니 웹 검색 엔진")
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

_index: Index | None = None
_pages: list[dict[str, Any]] = []
_crawl_lock = asyncio.Lock()
_status: dict[str, Any] = {
    "crawling": False,
    "last_error": None,
    "last_crawl_added": 0,
}


def rebuild_index(pages: list[dict[str, Any]]) -> None:
    global _index, _pages
    _pages = pages
    _index = build_index(pages)
    save_corpus(CORPUS_PATH, pages)


def ensure_seeded() -> None:
    global _index, _pages
    if _index is not None:
        return
    pages = load_corpus(CORPUS_PATH)
    if not pages:
        fixture_pages = pages_to_dicts(load_fixture_pages(FIXTURES_DIR))
        pages = fixture_pages
        save_corpus(CORPUS_PATH, pages)
    _pages = pages
    _index = build_index(pages)


class CrawlRequest(BaseModel):
    seeds: list[str] = Field(..., min_length=1)
    max_pages: int = Field(30, ge=1, le=200)
    max_depth: int = Field(2, ge=0, le=5)
    same_host_only: bool = True


class ResetRequest(BaseModel):
    use_fixtures: bool = True


@app.on_event("startup")
def on_startup() -> None:
    ensure_seeded()


@app.get("/")
def home() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/api/health")
def health() -> dict[str, Any]:
    ensure_seeded()
    assert _index is not None
    return {
        "ok": True,
        "documents": _index.doc_count(),
        "terms": len(_index.inverted),
        "crawling": _status["crawling"],
        "last_error": _status["last_error"],
        "last_crawl_added": _status["last_crawl_added"],
    }


@app.get("/api/search")
def api_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
) -> dict[str, Any]:
    ensure_seeded()
    assert _index is not None
    results = search_index(_index, q, limit=limit)
    return {"query": q, "count": len(results), "results": results}


@app.get("/api/docs")
def list_docs(limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    ensure_seeded()
    items = [
        {"url": p["url"], "title": p.get("title") or p["url"]}
        for p in _pages[:limit]
    ]
    return {"count": len(_pages), "documents": items}


@app.post("/api/crawl")
async def api_crawl(body: CrawlRequest) -> dict[str, Any]:
    ensure_seeded()
    if _status["crawling"]:
        raise HTTPException(status_code=409, detail="이미 크롤링 중입니다.")

    async with _crawl_lock:
        _status["crawling"] = True
        _status["last_error"] = None
        try:
            pages = await crawl(
                body.seeds,
                max_pages=body.max_pages,
                max_depth=body.max_depth,
                same_host_only=body.same_host_only,
            )
            if not pages:
                _status["last_error"] = "수집된 페이지가 없습니다. URL이나 네트워크를 확인하세요."
                raise HTTPException(status_code=400, detail=_status["last_error"])
            merged = merge_pages(_pages, pages_to_dicts(pages))
            rebuild_index(merged)
            _status["last_crawl_added"] = len(pages)
            return {
                "added": len(pages),
                "total": len(merged),
                "seeds": body.seeds,
            }
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            _status["last_error"] = str(exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        finally:
            _status["crawling"] = False


@app.post("/api/reset")
def api_reset(body: ResetRequest) -> dict[str, Any]:
    if body.use_fixtures:
        pages = pages_to_dicts(load_fixture_pages(FIXTURES_DIR))
    else:
        pages = []
    rebuild_index(pages)
    _status["last_crawl_added"] = 0
    _status["last_error"] = None
    return {"total": len(pages), "fixtures": body.use_fixtures}


def main() -> None:
    import uvicorn

    ensure_seeded()
    uvicorn.run("server:app", host="127.0.0.1", port=8765, reload=False)


if __name__ == "__main__":
    main()
