from app.models import Vehicle
from app.seed import SEED_VEHICLES, seed_vehicles


def test_seed_is_idempotent_and_includes_sold_out_vehicle(client):
    session_factory = client.app.state.TestingSessionLocal
    db = session_factory()
    try:
        first_insert_count = seed_vehicles(db)
        second_insert_count = seed_vehicles(db)

        assert first_insert_count == len(SEED_VEHICLES)
        assert second_insert_count == 0
        assert db.query(Vehicle).count() == len(SEED_VEHICLES)
        assert db.query(Vehicle).filter(Vehicle.quantity_in_stock == 0).count() >= 1
        assert all(vehicle.price > 0 for vehicle in db.query(Vehicle).all())
    finally:
        db.close()
