from __future__ import annotations

import re
from urllib.parse import urlparse


TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣]{2,}")

# Longer suffixes first. Enough for a personal crawl index without Mecab.
JOSA_SUFFIXES = (
    "에서는",
    "으로는",
    "에서도",
    "에게서",
    "으로부터",
    "입니다",
    "습니다",
    "에서",
    "으로",
    "에게",
    "보다",
    "까지",
    "부터",
    "처럼",
    "같이",
    "이나",
    "하는",
    "되는",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "의",
    "에",
    "와",
    "과",
    "도",
    "로",
    "만",
    "을",
)


def strip_josa(token: str) -> str:
    if not any("가" <= ch <= "힣" for ch in token):
        return token
    for suffix in JOSA_SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= 2:
            return token[: -len(suffix)]
    return token


def expand_token(token: str) -> list[str]:
    """Return the raw token plus a particle-stripped form when useful."""
    out = [token]
    stem = strip_josa(token)
    if stem != token and len(stem) >= 2:
        out.append(stem)
    return out


def tokenize(text: str) -> list[str]:
    """Split text into lowercase tokens; expand Korean particles for recall."""
    if not text:
        return []
    tokens: list[str] = []
    for raw in TOKEN_RE.findall(text.lower()):
        tokens.extend(expand_token(raw))
    return tokens


def normalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"invalid url: {url}")
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    cleaned = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}"
    if parsed.query:
        cleaned += f"?{parsed.query}"
    return cleaned


def same_host(a: str, b: str) -> bool:
    return urlparse(a).netloc.lower() == urlparse(b).netloc.lower()
