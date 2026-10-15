"""Passwords and sessions.

Passwords: PBKDF2-SHA256 through Werkzeug. bcrypt would be the usual pick, but this project has
to run on a macOS Python without `hashlib.scrypt` and without a compiler, and PBKDF2-SHA256 at
600k iterations is sound.

Sessions: a signed JWT in an httpOnly, SameSite=Lax cookie, so page loads and fetch calls share
one mechanism and no token is reachable from JavaScript.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from .database import User, get_db

COOKIE_NAME = "cropwise_session"
TOKEN_DAYS = 14
ALGORITHM = "HS256"


def secret() -> str:
    value = os.environ.get("SECRET_KEY")
    if value:
        return value
    if os.environ.get("VERCEL") or os.environ.get("CROPWISE_ENV") == "production":
        raise RuntimeError("SECRET_KEY must be set in production")
    # Local development only: a per-process key, so sessions end when the server restarts.
    return os.environ.setdefault("SECRET_KEY", os.urandom(32).hex())


def cookie_is_secure() -> bool:
    """HTTPS-only in production. Left off locally so the app works over plain http://localhost."""
    return bool(os.environ.get("VERCEL") or os.environ.get("CROPWISE_ENV") == "production")


def set_session_cookie(response, email: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        make_token(email),
        max_age=TOKEN_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=cookie_is_secure(),
        path="/",
    )


def hash_password(password: str) -> str:
    return generate_password_hash(password, method="pbkdf2:sha256:600000", salt_length=16)


def verify_password(password: str, hashed: str) -> bool:
    return check_password_hash(hashed, password)


def make_token(email: str) -> str:
    payload = {
        "sub": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, secret(), algorithm=ALGORITHM)


def read_token(token: str) -> str | None:
    try:
        return jwt.decode(token, secret(), algorithms=[ALGORITHM]).get("sub")
    except jwt.PyJWTError:
        return None


def current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    email = read_token(token)
    if not email:
        return None
    return db.query(User).filter(User.email == email).one_or_none()


def current_user(user: User | None = Depends(current_user_optional)) -> User:
    """For anything that reads or writes a person's data. Never optional by accident."""
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in.")
    return user
