"""The React app (web/, built into static/app/). Every UI route returns its index.html and the
browser router takes over; /api, /docs, /static and /healthz are untouched."""

from __future__ import annotations

import pathlib

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse

INDEX = pathlib.Path(__file__).resolve().parents[2] / "static" / "app" / "index.html"
UI_ROUTES = ["/", "/grow", "/results", "/plan/{crop}", "/doctor", "/ask", "/history", "/impact",
             "/eval", "/settings", "/offline"]

router = APIRouter(include_in_schema=False)


def app_shell(request: Request):
    if not INDEX.exists():
        return HTMLResponse("The app has not been built yet. Run <code>make ui</code>.", status_code=503)
    # Never cache the shell: a new deploy must show up on the next visit. Hashed assets cache forever.
    return FileResponse(INDEX, media_type="text/html", headers={"Cache-Control": "no-cache"})


@router.get("/sw.js", response_model=None)
def service_worker():
    """The offline worker must be served from the root to control every page."""
    worker = INDEX.parent / "sw.js"
    if not worker.exists():
        return HTMLResponse("", status_code=404)
    return FileResponse(worker, media_type="text/javascript", headers={"Cache-Control": "no-cache"})


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

