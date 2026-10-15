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
from cropwise.routers import api, pages

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
app.include_router(pages.router)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict:
    return {"ok": True, "version": __version__}
