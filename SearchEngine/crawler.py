from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from tokenize_util import normalize_url, same_host


USER_AGENT = "LocalSearchBot/1.0 (+personal; localhost-only)"
DEFAULT_DELAY_SEC = 0.4


@dataclass
class Page:
    url: str
    title: str
    text: str
    links: list[str]
    fetched_at: float


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
) -> list[Page]:
    queue: deque[tuple[str, int]] = deque()
    seen: set[str] = set()
    pages: list[Page] = []
    robots = RobotsCache()

    for seed in seeds:
        try:
            url = normalize_url(seed)
        except ValueError:
            continue
        if url not in seen:
            seen.add(url)
            queue.append((url, 0))

    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}

    async with httpx.AsyncClient(
        headers=headers,
        follow_redirects=True,
        timeout=httpx.Timeout(12.0),
    ) as client:
        while queue and len(pages) < max_pages:
            url, depth = queue.popleft()
            if not robots.allowed(url):
                continue

            try:
                resp = await client.get(url)
            except Exception:
                continue

            content_type = resp.headers.get("content-type", "")
            if resp.status_code >= 400 or "text/html" not in content_type:
                continue

            page = extract_page(str(resp.url), resp.text)
            page.url = normalize_url(str(resp.url))
            pages.append(page)

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

    return pages


def pages_to_dicts(pages: list[Page]) -> list[dict]:
    return [asdict(p) for p in pages]


def load_fixture_pages(fixtures_dir: Path) -> list[Page]:
    pages: list[Page] = []
    for path in sorted(fixtures_dir.glob("*.html")):
        html = path.read_text(encoding="utf-8")
        url = f"fixture://local/{path.name}"
        pages.append(extract_page(url, html))
    return pages
