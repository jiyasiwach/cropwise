"""Government schemes (Kisan Yojana), official farmer channels and live scheme updates.

The scheme and channel lists are curated files in data/schemes/, each entry carrying the official
page it was checked against and the date. Nothing here is generated: a scheme or a channel that
could not be verified is not shown. Updates come live from an official government feed and are
cached for an hour; when the feed is down the last good copy is served with its date.
"""

from __future__ import annotations

import json
import pathlib
import re
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

import httpx

DATA = pathlib.Path(__file__).resolve().parents[2] / "data" / "schemes"
FEED_TTL_SECONDS = 3600
TIMEOUT = httpx.Timeout(12.0, connect=6.0)
_feed_cache: dict = {"at": 0.0, "items": None, "error": None}


def _load(name: str) -> list[dict]:
    path = DATA / name
    if not path.exists():
        return []
    rows = json.loads(path.read_text())
    # Only verified entries are ever served.
    return [r for r in rows if r.get("verified") is True]


def _norm_state(state: str | None) -> str:
    return re.sub(r"[^a-z]", "", (state or "").lower())


def schemes(state: str | None = None) -> dict:
    central = _load("central.json")
    states = _load("state.json")
    wanted = _norm_state(state)
    mine = [s for s in states if wanted and _norm_state(s.get("state")) == wanted]
    return {
        "central": central,
        "state": mine,
        "state_name": state,
        "states_covered": sorted({s["state"] for s in states if s.get("state")}),
        "note": "Rules and amounts change. Always confirm on the official page before applying; "
        "CropWise never asks for money, Aadhaar or bank details.",
    }


def channels(state: str | None = None) -> dict:
    rows = _load("channels.json")
    wanted = _norm_state(state)
    national = [c for c in rows if c.get("scope") == "national"]
    mine = [c for c in rows if wanted and _norm_state(c.get("scope")) == wanted]
    return {
        "national": national,
        "state": mine,
        "state_name": state,
        "note": "Only official channels published by the government body itself are listed. "
        "CropWise does not run farmer groups; never share OTPs or bank details in any group.",
    }


def _snapshot() -> dict:
    """The feed's last copy saved with the code (scripts/refresh_updates.py), for when it cannot be reached."""
    path = DATA / "updates_snapshot.json"
    return json.loads(path.read_text()) if path.exists() else {}


def _feed_config() -> dict:
    path = DATA / "feed.json"
    return json.loads(path.read_text()) if path.exists() else {}


def _official(link: str) -> bool:
    """Only https links on government domains are ever shown."""
    host = urlparse(link).hostname or ""
    return link.startswith("https://") and (host.endswith(".gov.in") or host.endswith(".nic.in"))


def _parse_json(text: str, keywords: list[str], limit: int) -> list[dict]:
    """The Department of Agriculture's own press-release list: {items: [{title, fileUrl, publishDate}]}."""
    if len(text) > 2_000_000:
        raise ValueError("feed too large")
    data = json.loads(text)
    rows = data.get("items", []) if isinstance(data, dict) else data
    items = []
    for row in rows:
        title = re.sub(r"\s+", " ", str(row.get("title") or "")).strip()
        link = str(row.get("fileUrl") or row.get("link") or "").strip()
        date = str(row.get("publishDate") or "")[:10] or None
        if not title or not _official(link):
            continue
        if keywords and not any(k.lower() in title.lower() for k in keywords):
            continue
        items.append({"title": title, "link": link, "date": date})
    items.sort(key=lambda i: i["date"] or "", reverse=True)
    return items[:limit]


def _parse_rss(text: str, keywords: list[str], limit: int) -> list[dict]:
    # An outside document: refuse DTDs/entities (entity-expansion attacks) and oversized bodies.
    if len(text) > 2_000_000 or re.search(r"<!(DOCTYPE|ENTITY)", text, re.I):
        raise ET.ParseError("feed rejected: DTD/entity or too large")
    root = ET.fromstring(text)
    items = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        when = (item.findtext("pubDate") or "").strip()
        if not title or not _official(link):
            continue
        if keywords and not any(k.lower() in title.lower() for k in keywords):
            continue
        try:
            date = parsedate_to_datetime(when).date().isoformat() if when else None
        except (TypeError, ValueError):
            date = None
        items.append({"title": re.sub(r"\s+", " ", title), "link": link, "date": date})
        if len(items) >= limit:
            break
    return items


async def updates(limit: int = 12) -> dict:
    """Recent official announcements. Cached for an hour; stale copy kept when the feed is down."""
    cfg = _feed_config()
    if not cfg.get("url"):
        return {"items": [], "source": None, "error": "No official feed is configured.", "cached_at": None}
    now = time.time()
    if _feed_cache["items"] is not None and now - _feed_cache["at"] < FEED_TTL_SECONDS:
        return {"items": _feed_cache["items"][:limit], "source": cfg.get("source"), "error": None,
                "cached_at": _feed_cache["at"], "feed_url": cfg["url"]}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True,
                                     headers={"User-Agent": "CropWise/1.0 (+https://cropwise-six.vercel.app)"}) as client:
            response = await client.get(cfg["url"])
        response.raise_for_status()
        parse = _parse_json if cfg.get("format") == "json" else _parse_rss
        items = parse(response.text, cfg.get("keywords") or [], 40)
        _feed_cache.update(at=now, items=items, error=None)
        error = None
    except (httpx.HTTPError, ET.ParseError, ValueError) as exc:  # JSONDecodeError is a ValueError
        items = _feed_cache["items"] or []
        error = f"The official feed did not answer ({exc.__class__.__name__}); showing the last copy we have."
        if not items:
            snap = _snapshot()
            items = snap.get("items", [])
            if items:
                error = (f"The official feed did not answer just now; showing its announcements as of "
                         f"{snap.get('fetched_on')}. Open the official site for anything newer.")
    return {"items": items[:limit], "source": cfg.get("source"), "error": error,
            "cached_at": _feed_cache["at"] or None, "feed_url": cfg["url"]}
