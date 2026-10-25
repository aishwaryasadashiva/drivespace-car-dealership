import uuid

from app.models import User


def test_register_user_uses_isolated_client_fixture(client):
    email = f"alice-{uuid.uuid4().hex}@example.com"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "StrongPassword123!"},
    )

    assert response.status_code == 201
    assert response.json()["email"] == email
    assert response.json()["is_admin"] is False
    assert "hashed_password" not in response.json()

    # The test fixture's session factory proves this user exists only in its DB.
    session_factory = client.app.state.TestingSessionLocal
    db = session_factory()
    try:
        assert db.query(User).filter(User.email == email).first() is not None
    finally:
        db.close()


def test_login_returns_access_token(client):
    email = f"bob-{uuid.uuid4().hex}@example.com"
    password = "StrongPassword123!"
    client.post("/api/auth/register", json={"email": email, "password": password})

    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]


def test_configured_admin_email_does_not_grant_admin_via_registration(client, monkeypatch):
    email = f"admin-{uuid.uuid4().hex}@example.com"
    monkeypatch.setenv("ADMIN_EMAIL", email.upper())
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "StrongPassword123!"},
    )
    assert response.status_code == 201
    assert response.json()["is_admin"] is False

    db = client.app.state.TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None and user.is_admin is False
    finally:
        db.close()


def test_bootstrap_helper_promotes_existing_user_and_ignores_missing_email(client):
    from app.bootstrap_admin import bootstrap_admin

    email = f"bootstrap-{uuid.uuid4().hex}@example.com"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "StrongPassword123!"},
    )
    db = client.app.state.TestingSessionLocal()
    try:
        assert bootstrap_admin(db, email) is True
        user = db.query(User).filter(User.email == email).first()
        assert user is not None and user.is_admin is True
        assert bootstrap_admin(db, "missing@example.com") is False
    finally:
        db.close()


def test_regular_user_cannot_self_promote(client):
    email = f"ordinary-{uuid.uuid4().hex}@example.com"
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "is_admin": True,
        },
    )
    assert response.status_code == 201

    db = client.app.state.TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None and user.is_admin is False
    finally:
        db.close()
