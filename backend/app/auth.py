"""AUTH PLACEHOLDER - the ONLY file to change when real login is added.

Every router depends on `current_user`, and every query is already filtered by `owner_id`.
Later: read a JWT / session cookie here, verify it, and return that user (raise 401 otherwise).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: str
    name: str
    role: str = "user"


_DEFAULT = User(id="default-user", name="Priya")


def current_user() -> User:
    return _DEFAULT
