#!/bin/sh
exec ./.venv/bin/uvicorn main:app --port 8000
