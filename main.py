"""CropWise — application entry point.

One FastAPI app serves both the JSON API (/api/v1, documented at /docs) and the existing
server-rendered pages, so the farmer-facing site keeps working while the React front end is built.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from cropwise import __version__
from cropwise.database import init_db
from cropwise.visitor import COOKIE_MAX_AGE, COOKIE_NAME, _new_id
from cropwise.routers import api, assistant, doctor, pages, spa

app = FastAPI(
    title="CropWise API",
    version=__version__,
    description="Crop recommendation from live soil and weather, for Indian smallholders.",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Only the front ends we actually ship may call the API from a browser.
origins = [o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(api.router)
app.include_router(assistant.router)
app.include_router(doctor.router)
app.include_router(spa.router)
# The previous server-rendered pages, kept reachable while the new UI reaches parity.
app.include_router(pages.router, prefix="/classic")


@app.middleware("http")
async def ensure_visitor(request, call_next):
    """Give every browser a stable id. There is no sign-in, so this is what keeps one person's
    history separate from another's. It carries no personal data — just a random string."""
    visitor_id = request.cookies.get(COOKIE_NAME)
    is_new = visitor_id is None
    request.state.visitor_id = visitor_id or _new_id()
    response = await call_next(request)
    if is_new:
        response.set_cookie(
            COOKIE_NAME,
            request.state.visitor_id,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            samesite="lax",
            path="/",
        )
    return response


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict:
    """Also reports what the running instance can actually see on disk, because a file that is
    present in the repository is not necessarily present in a deployment bundle."""
    from cropwise.services import lookup, rag

    return {
        "ok": True,
        "version": __version__,
        "soil_cache_towns": len(lookup._prefetched()),
        "soil_cache_path": str(lookup.PREFETCHED),
        "soil_cache_exists": lookup.PREFETCHED.exists(),
        "knowledge_base_chunks": len(rag.load_chunks()),
    }


# Last: unknown non-API GETs get the app (its router shows "page not found").
app.include_router(spa.fallback)
