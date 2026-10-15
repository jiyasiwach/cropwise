"""KrishiMitra over HTTP: one streaming endpoint and one JSON endpoint.

Streaming matters here because a tool round trip (soil, then prices, then an answer) takes
several seconds, and a farmer on a slow connection should see the answer forming rather than a
spinner. Server-sent events are enough; there is no need for a socket.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import User, get_db
from ..security import current_user
from ..services import agent

router = APIRouter(prefix="/api/v1/assistant")


@router.post("")
async def ask(
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Ask once, get the whole answer. Used by the evaluation harness and any non-browser client."""
    body = await request.json()
    result = await agent.answer(
        question=(body.get("question") or "")[:2000],
        db=db,
        language=body.get("language", "en"),
        context=body.get("context"),
    )
    return {
        "answer": result.text,
        "citations": result.citations,
        "tools_used": result.tools_used,
        "blocked": result.blocked,
        "is_mock": result.is_mock,
        "latency_ms": result.latency_ms,
        "tokens": result.tokens,
    }


@router.post("/stream")
async def ask_streaming(
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """The same answer, streamed as server-sent events.

    Event types: retrieved (which documents), tool (which tool ran), token (text), done.
    """
    body = await request.json()
    question = (body.get("question") or "")[:2000]
    language = body.get("language", "en")
    context = body.get("context")

    queue: asyncio.Queue = asyncio.Queue()

    def emit(event: dict) -> None:
        queue.put_nowait(event)

    async def run() -> None:
        try:
            result = await agent.answer(question, db=db, language=language, context=context, on_event=emit)
            queue.put_nowait(
                {
                    "type": "done",
                    "answer": result.text,
                    "citations": result.citations,
                    "tools_used": result.tools_used,
                    "blocked": result.blocked,
                    "is_mock": result.is_mock,
                    "latency_ms": result.latency_ms,
                    "tokens": result.tokens,
                }
            )
        except Exception as exc:  # the browser gets a sentence, the log gets the detail
            queue.put_nowait({"type": "error", "message": f"{exc.__class__.__name__}"})
        finally:
            queue.put_nowait(None)

    async def events():
        task = asyncio.create_task(run())
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            task.cancel()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
