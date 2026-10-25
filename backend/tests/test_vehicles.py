
import uuid

from app.models import User


def register_and_login(client, prefix="user"):
    email = f"{prefix}-{uuid.uuid4().hex}@example.com"
    password = "StrongPassword123!"

    registration = client.post(
        "/api/auth/register",
        json={"email": email, "password": password},
    )
    assert registration.status_code == 201

    login = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200

    token = login.json()["access_token"]
    return email, password, {"Authorization": f"Bearer {token}"}


def register_and_login_admin(client, prefix="admin"):
    email, password, _ = register_and_login(client, prefix)

    test_session_factory = client.app.state.TestingSessionLocal
    db = test_session_factory()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        user.is_admin = True
        db.commit()
    finally:
        db.close()

    login = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200

    token = login.json()["access_token"]
    return email, password, {"Authorization": f"Bearer {token}"}


def create_vehicle(client, headers, quantity=5):
    response = client.post(
        "/api/vehicles",
        headers=headers,
        json={
            "make": "Toyota",
            "model": "Corolla",
            "category": "Sedan",
            "price": 1500000,
            "quantity_in_stock": quantity,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_list_vehicles_returns_list(client):
    _, _, headers = register_and_login(client, "empty")

    response = client.get("/api/vehicles", headers=headers)

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_vehicle_requires_authentication(client):
    response = client.post(
        "/api/vehicles",
        json={
            "make": "Toyota",
            "model": "Corolla",
            "category": "Sedan",
            "price": 1500000,
            "quantity_in_stock": 5,
        },
    )

    assert response.status_code == 401


def test_create_vehicle_rejects_non_admin(client):
    _, _, headers = register_and_login(client, "create-user")

    response = client.post(
        "/api/vehicles",
        headers=headers,
        json={
            "make": "Toyota",
            "model": "Corolla",
            "category": "Sedan",
            "price": 1500000,
            "quantity_in_stock": 5,
        },
    )

    assert response.status_code == 403


def test_list_vehicles_requires_authentication(client):
    response = client.get("/api/vehicles")

    assert response.status_code == 401


def test_list_vehicles_rejects_invalid_token(client):
    response = client.get(
        "/api/vehicles",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_search_vehicles_by_make(client):
    _, _, headers = register_and_login_admin(client, "search")
    create_vehicle(client, headers)

    response = client.get(
        "/api/vehicles/search?make=Toyota",
        headers=headers,
    )

    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert all(vehicle["make"] == "Toyota" for vehicle in response.json())


def test_search_vehicles_by_price_range(client):
    _, _, headers = register_and_login_admin(client, "price")
    create_vehicle(client, headers)

    response = client.get(
        "/api/vehicles/search?min_price=1000000&max_price=2000000",
        headers=headers,
    )

    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert all(
        1000000 <= vehicle["price"] <= 2000000
        for vehicle in response.json()
    )


def test_purchase_vehicle_reduces_stock(client):
    _, _, headers = register_and_login_admin(client, "buyer")
    vehicle = create_vehicle(client, headers, quantity=2)

    response = client.post(
        f"/api/vehicles/{vehicle['id']}/purchase",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity_in_stock"] == 1


def test_purchase_vehicle_rejects_out_of_stock_vehicle(client):
    _, _, headers = register_and_login_admin(client, "buyer")
    vehicle = create_vehicle(client, headers, quantity=0)

    response = client.post(
        f"/api/vehicles/{vehicle['id']}/purchase",
        headers=headers,
    )

    assert response.status_code == 409


def test_restock_vehicle_rejects_non_admin(client):
    _, _, regular_headers = register_and_login(client, "restock-user")
    _, _, admin_headers = register_and_login_admin(client, "restock-admin")
    vehicle = create_vehicle(client, admin_headers, quantity=2)

    response = client.post(
        f"/api/vehicles/{vehicle['id']}/restock",
        headers=regular_headers,
        json={"quantity": 3},
    )

    assert response.status_code == 403


def test_delete_vehicle_rejects_non_admin(client):
    _, _, regular_headers = register_and_login(client, "delete-user")
    _, _, admin_headers = register_and_login_admin(client, "delete-admin")
    vehicle = create_vehicle(client, admin_headers, quantity=2)

    response = client.delete(
        f"/api/vehicles/{vehicle['id']}",
        headers=regular_headers,
    )

    assert response.status_code == 403


def test_admin_can_update_vehicle(client):
    _, _, headers = register_and_login_admin(client, "update-admin")
    vehicle = create_vehicle(client, headers)

    updated = {
        "make": "Honda",
        "model": "Civic",
        "category": "Sedan",
        "price": 1800000,
        "quantity_in_stock": 3,
    }

    response = client.put(
        f"/api/vehicles/{vehicle['id']}",
        json=updated,
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["make"] == "Honda"
    assert response.json()["price"] == 1800000


def test_non_admin_cannot_update_vehicle(client):
    _, _, regular_headers = register_and_login(client, "update-user")
    _, _, admin_headers = register_and_login_admin(client, "update-owner")
    vehicle = create_vehicle(client, admin_headers)

    response = client.put(
        f"/api/vehicles/{vehicle['id']}",
        json={
            "make": "Honda",
            "model": "Civic",
            "category": "Sedan",
            "price": 1800000,
            "quantity_in_stock": 3,
        },
        headers=regular_headers,
    )

    assert response.status_code == 403


def test_admin_can_restock_vehicle(client):
    _, _, admin_headers = register_and_login_admin(client, "restock-success")
    vehicle = create_vehicle(client, admin_headers, quantity=2)

    response = client.post(
        f"/api/vehicles/{vehicle['id']}/restock",
        headers=admin_headers,
        json={"quantity": 4},
    )

    assert response.status_code == 200
    assert response.json()["quantity_in_stock"] == 6


def test_admin_can_delete_vehicle(client):
    _, _, admin_headers = register_and_login_admin(client, "delete-success")
    vehicle = create_vehicle(client, admin_headers)

    response = client.delete(
        f"/api/vehicles/{vehicle['id']}",
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Vehicle deleted successfully"

    listing = client.get("/api/vehicles", headers=admin_headers)
    assert all(item["id"] != vehicle["id"] for item in listing.json())


def test_order_creation_decrements_stock_and_appears_in_history(client):
    _, _, headers = register_and_login_admin(client, "order-user")
    vehicle = create_vehicle(client, headers, quantity=2)
    payload = {
        "customer_name": "Test Customer",
        "customer_email": "customer@example.com",
        "customer_phone": "9876543210",
        "customer_address": "Bengaluru, Karnataka",
        "exterior_colour": "Pearl White",
    }

    response = client.post(
        f"/api/orders?vehicle_id={vehicle['id']}",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 201, response.text
    order = response.json()
    assert order["order_number"].startswith("DS-")
    assert order["vehicle"] == "Toyota Corolla"
    assert order["unit_price"] == 1500000

    listing = client.get("/api/vehicles", headers=headers)
    updated_vehicle = next(item for item in listing.json() if item["id"] == vehicle["id"])
    assert updated_vehicle["quantity_in_stock"] == 1

    history = client.get("/api/orders/me", headers=headers)
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["order_number"] == order["order_number"]


def test_order_creation_rejects_out_of_stock_vehicle(client):
    _, _, headers = register_and_login_admin(client, "order-empty")
    vehicle = create_vehicle(client, headers, quantity=0)
    payload = {
        "customer_name": "Test Customer",
        "customer_email": "customer@example.com",
        "customer_phone": "9876543210",
        "customer_address": "Bengaluru, Karnataka",
        "exterior_colour": "Pearl White",
    }

    response = client.post(
        f"/api/orders?vehicle_id={vehicle['id']}",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 409
    history = client.get("/api/orders/me", headers=headers)
    assert history.status_code == 200
    assert history.json() == []


def test_search_vehicles_by_model_and_category(client):
    _, _, headers = register_and_login_admin(client, "model-category")
    create_vehicle(client, headers)

    by_model = client.get(
        "/api/vehicles/search?model=Corol",
        headers=headers,
    )
    by_category = client.get(
        "/api/vehicles/search?category=sed",
        headers=headers,
    )

    assert by_model.status_code == 200
    assert any(item["model"] == "Corolla" for item in by_model.json())
    assert by_category.status_code == 200
    assert all(item["category"] == "Sedan" for item in by_category.json())


def test_search_rejects_minimum_price_above_maximum(client):
    _, _, headers = register_and_login(client, "invalid-range")

    response = client.get(
        "/api/vehicles/search?min_price=2000000&max_price=1000000",
        headers=headers,
    )

    assert response.status_code == 422
