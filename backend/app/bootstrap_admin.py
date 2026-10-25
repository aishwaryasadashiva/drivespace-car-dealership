"""Promote an existing user selected by the server-side ADMIN_EMAIL setting.

Run after registering that user, from the backend directory:
    ADMIN_EMAIL=admin@example.com python -m app.bootstrap_admin
This operation is deliberately a CLI command, not a public API endpoint.
"""

import os

from app.database import SessionLocal, create_tables
from app.models import User


def bootstrap_admin(session, email: str) -> bool:
    """Promote an existing account matching ``email``; return whether found."""
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("An admin email is required")

    user = session.query(User).filter(User.email == normalized_email).first()
    if user is None:
        return False
    user.is_admin = True
    session.commit()
    return True


def main() -> None:
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if not email:
        raise SystemExit("Set ADMIN_EMAIL to the existing account's email first.")

    create_tables()
    session = SessionLocal()
    try:
        if not bootstrap_admin(session, email):
            raise SystemExit(
                f"No registered user found for {email}. Register that account, then rerun."
            )
        print(f"Administrator privileges granted to {email}.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
