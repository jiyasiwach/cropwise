"""The React app (web/, built into static/app/). Every UI route returns its index.html and the
browser router takes over; /api, /docs, /static and /healthz are untouched."""

from __future__ import annotations

import hashlib
import pathlib

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response

INDEX = pathlib.Path(__file__).resolve().parents[2] / "static" / "app" / "index.html"
UI_ROUTES = ["/", "/grow", "/results", "/plan/{crop}", "/doctor", "/ask", "/history", "/impact",
             "/eval", "/settings", "/offline", "/schemes", "/community", "/yield"]

router = APIRouter(include_in_schema=False)


def _revalidated(path: pathlib.Path, media_type: str, request: Request) -> Response:
    """Serve a small file that must be re-checked on every visit, with an ETag from its CONTENT.

    A file-time-and-size ETag is not enough: on the server every file has the same time, and a
    new build's index.html is often exactly as long as the last one (only the asset hashes
    change), so browsers were told "not modified" and kept a page whose scripts no longer exist.
    """
    body = path.read_bytes()
    etag = '"' + hashlib.sha256(body).hexdigest()[:32] + '"'
    headers = {"Cache-Control": "no-cache", "ETag": etag}
    if etag in request.headers.get("if-none-match", ""):
        return Response(status_code=304, headers=headers)
    return Response(body, media_type=media_type, headers=headers)


def app_shell(request: Request):
    if not INDEX.exists():
        return HTMLResponse("The app has not been built yet. Run <code>make ui</code>.", status_code=503)
    # Never cache the shell: a new deploy must show up on the next visit. Hashed assets cache forever.
    return _revalidated(INDEX, "text/html; charset=utf-8", request)


@router.get("/sw.js", response_model=None)
def service_worker(request: Request):
    """The offline worker must be served from the root to control every page."""
    worker = INDEX.parent / "sw.js"
    if not worker.exists():
        return HTMLResponse("", status_code=404)
    return _revalidated(worker, "text/javascript; charset=utf-8", request)


for path in UI_ROUTES:
    router.add_api_route(path, app_shell, methods=["GET"], response_class=HTMLResponse, response_model=None)


# Included last (see main.py): any other GET that is not an API, docs or static path gets the app,
# whose router shows its own "page not found". API misses stay JSON 404s.
fallback = APIRouter(include_in_schema=False)
NOT_UI = ("api/", "static/", "docs", "openapi.json", "redoc", "healthz", "classic/")


@fallback.get("/{rest:path}", response_class=HTMLResponse, response_model=None)
def any_other_page(rest: str, request: Request):
    if rest.startswith(NOT_UI):
        return HTMLResponse('{"detail":"Not Found"}', status_code=404, media_type="application/json")
    response = app_shell(request)
    response.status_code = 404 if INDEX.exists() else response.status_code
    return response

