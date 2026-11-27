from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from tokenize_util import normalize_url, same_host


USER_AGENT = (
    "Mozilla/5.0 (compatible; LocalSearchBot/1.1; +http://127.0.0.1; personal)"
)
DEFAULT_DELAY_SEC = 0.4


@dataclass
class Page:
    url: str
    title: str
    text: str
    links: list[str]
    fetched_at: float


@dataclass
class CrawlResult:
    pages: list[Page] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


class RobotsCache:
    def __init__(self) -> None:
        self._parsers: dict[str, RobotFileParser | None] = {}

    def allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self._parsers:
            rp = RobotFileParser()
            robots_url = f"{origin}/robots.txt"
            try:
                rp.set_url(robots_url)
                rp.read()
                self._parsers[origin] = rp
            except Exception:
                self._parsers[origin] = None
        rp = self._parsers[origin]
        if rp is None:
            return True
        try:
            return rp.can_fetch(USER_AGENT, url)
        except Exception:
            return True


def extract_page(url: str, html: str) -> Page:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "template"]):
        tag.decompose()

    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(" ", strip=True)
    if not title:
        title = url

    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = main.get_text(" ", strip=True) if main else ""
    text = " ".join(text.split())

    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "javascript:")):
            continue
        absolute = urljoin(url, href)
        try:
            links.append(normalize_url(absolute))
        except ValueError:
            continue

    return Page(url=url, title=title, text=text, links=links, fetched_at=time.time())


async def crawl(
    seeds: Iterable[str],
    *,
    max_pages: int = 40,
    max_depth: int = 2,
    same_host_only: bool = True,
    delay_sec: float = DEFAULT_DELAY_SEC,
) -> CrawlResult:
    queue: deque[tuple[str, int]] = deque()
    seen: set[str] = set()
    result = CrawlResult()
    robots = RobotsCache()

    for seed in seeds:
        try:
            url = normalize_url(seed)
        except ValueError as exc:
            result.errors.append(f"{seed}: URL 형식이 올바르지 않습니다 ({exc})")
            continue
        if url not in seen:
            seen.add(url)
            queue.append((url, 0))

    if not queue:
        if not result.errors:
            result.errors.append("시작할 URL이 없습니다.")
        return result

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    }

    async with httpx.AsyncClient(
        headers=headers,
        follow_redirects=True,
        timeout=httpx.Timeout(15.0),
    ) as client:
        while queue and len(result.pages) < max_pages:
            url, depth = queue.popleft()
            if not robots.allowed(url):
                result.skipped.append(f"{url}: robots.txt에서 차단됨")
                continue

            try:
                resp = await client.get(url)
            except Exception as exc:  # noqa: BLE001
                result.errors.append(f"{url}: 요청 실패 ({type(exc).__name__}: {exc})")
                continue

            content_type = (resp.headers.get("content-type") or "").lower()
            if resp.status_code >= 400:
                result.errors.append(f"{url}: HTTP {resp.status_code}")
                continue
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                result.skipped.append(f"{url}: HTML이 아님 ({content_type or 'unknown'})")
                continue

            try:
                final_url = normalize_url(str(resp.url))
            except ValueError:
                final_url = str(resp.url)

            page = extract_page(final_url, resp.text)
            page.url = final_url
            result.pages.append(page)

            if depth >= max_depth:
                continue

            for link in page.links:
                if link in seen:
                    continue
                if same_host_only and not same_host(page.url, link):
                    continue
                if urlparse(link).scheme not in ("http", "https"):
                    continue
                seen.add(link)
                queue.append((link, depth + 1))

            if delay_sec > 0:
                await asyncio.sleep(delay_sec)

    return result


def pages_to_dicts(pages: list[Page]) -> list[dict]:
    return [asdict(p) for p in pages]


def load_fixture_pages(fixtures_dir: Path) -> list[Page]:
    pages: list[Page] = []
    for path in sorted(fixtures_dir.glob("*.html")):
        html = path.read_text(encoding="utf-8")
        url = f"fixture://local/{path.name}"
        pages.append(extract_page(url, html))
    return pages
