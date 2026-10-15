"""Vercel entry point.

Vercel's Python runtime looks for a handler under `api/`. The application itself lives in
`main.py` so that `uvicorn main:app` still works locally and in any other host.
"""

import pathlib
import sys

# The function runs with this file's directory on the path, not the repository root.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402,F401  (Vercel imports `app` from this module)
