"""No sign-in. Every browser gets its own workspace.

A visitor is identified by a random id in a cookie. The row behind it is created on first use,
so history, plans and the assistant all work exactly as before — the person simply never sees a
login form. Nothing personal is collected: no email, no password, no name.

Switching back to real accounts later means putting the login page back and reading the same
`User` row from a token instead of this cookie; nothing else in the app changes.
"""

from __future__ import annotations

import secrets

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .database import User, get_db

COOKIE_NAME = "cropwise_visitor"
COOKIE_MAX_AGE = 365 * 24 * 3600


def _new_id() -> str:
    return secrets.token_urlsafe(16)


def visitor_email(visitor_id: str) -> str:
    """Visitors are stored as ordinary users with an address nobody can send mail to."""
    return f"{visitor_id}@visitor.cropwise.local"


def visitor_id_for(request: Request) -> str:
    """The id for this request. Middleware puts it on the request and sets the cookie, because a
    cookie set inside a dependency is lost whenever the endpoint returns a Response itself."""
    return getattr(request.state, "visitor_id", None) or request.cookies.get(COOKIE_NAME) or _new_id()


def get_visitor(request: Request, db: Session = Depends(get_db)) -> User:
    """The current browser's workspace, created the first time it asks for anything."""
    email = visitor_email(visitor_id_for(request))
    user = db.query(User).filter(User.email == email).one_or_none()
    if user is None:
        user = User(email=email, password_hash="-", name="Farmer")
        db.add(user)
        db.commit()
    return user
