"""Helpers for checking the React app (web/, built into static/app/) from the Python tests.

The pages are rendered in the browser, so "the page says X" is checked as "the shipped app
contains X" — the built bundle is exactly what every visitor downloads."""
import pathlib

APP = pathlib.Path(__file__).resolve().parents[1] / "static" / "app"


def ui_text() -> str:
    """index.html plus every built script, as one string."""
    parts = [(APP / "index.html").read_text()]
    parts += [p.read_text() for p in sorted((APP / "assets").glob("*.js"))]
    return "\n".join(parts)


def is_app_shell(response) -> bool:
    return response.status_code == 200 and '<div id="root">' in response.text


def has_literal(text: str, value: str) -> bool:
    """True if the built app contains `value` as a string literal, whichever quotes the minifier chose."""
    return any(f"{q}{value}{q}" in text for q in ('"', "'", "`"))
