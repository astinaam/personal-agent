"""Fernet encryption for API keys using SECRET_KEY."""
import base64
import hashlib
import os
from cryptography.fernet import Fernet

SECRET_KEY = os.getenv("SECRET_KEY", "supersecret-change-in-production")


def _get_fernet() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(SECRET_KEY.encode()).digest()[:32].ljust(32, b"\0")
    )
    return Fernet(key)


def encrypt(text: str | None) -> str | None:
    if text is None:
        return None
    return _get_fernet().encrypt(text.encode("utf-8")).decode("utf-8")


def decrypt(text: str | None) -> str | None:
    if text is None:
        return None
    return _get_fernet().decrypt(text.encode("utf-8")).decode("utf-8")


def mask(text: str | None) -> str | None:
    if text is None:
        return None
    if len(text) <= 8:
        return "***"
    return text[:4] + "..." + text[-4:]
