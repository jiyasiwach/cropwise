"""Crop Doctor over HTTP: one photo in, one structured result out.

The photo arrives as multipart form data, is read into memory, handed to the pipeline and
dropped with the request. It is never saved and never logged.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..database import User
from ..visitor import get_visitor
from ..services import doctor

router = APIRouter(prefix="/api/v1/doctor")


@router.post("")
async def check_plant(
    photo: UploadFile = File(...),
    crop: str = Form(""),
    language: str = Form("en"),
    demo_condition: str | None = Form(None),
    _: User = Depends(get_visitor),
) -> dict:
    """Likely condition, confidence, and advice grounded in cited knowledge-base passages."""
    image = await photo.read(doctor.MAX_IMAGE_BYTES + 1)
    if len(image) > doctor.MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Photo must be under 4 MB.")
    result = await doctor.diagnose(image, crop, language[:5], demo_condition=demo_condition or None)
    del image
    return result.as_dict()


@router.get("/conditions")
def conditions(_: User = Depends(get_visitor)) -> list[dict]:
    """What the knowledge base can advise on. Anything else is escalated to a person."""
    return [
        {"key": c.key, "crop": c.crop, "title": c.title, "source": c.source}
        for c in doctor.catalogue().values()
    ]
