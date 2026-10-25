"""Seed a small, repeatable Indian car-dealership inventory.

Run from the backend directory with ``python -m app.seed``. Existing
make/model pairs are left untouched, so rerunning the command is safe.
"""

from app.database import SessionLocal, create_tables
from app.models import Vehicle

SEED_VEHICLES = (
    {"make": "Maruti Suzuki", "model": "Swift", "category": "Hatchback", "price": 649000, "quantity_in_stock": 8},
    {"make": "Hyundai", "model": "i20", "category": "Hatchback", "price": 799000, "quantity_in_stock": 4},
    {"make": "Tata", "model": "Nexon", "category": "SUV", "price": 899000, "quantity_in_stock": 5},
    {"make": "Mahindra", "model": "XUV 3XO", "category": "SUV", "price": 799000, "quantity_in_stock": 3},
    {"make": "Honda", "model": "City", "category": "Sedan", "price": 1199000, "quantity_in_stock": 2},
    {"make": "Toyota", "model": "Innova Hycross", "category": "MPV", "price": 1910000, "quantity_in_stock": 0},
    {"make": "Kia", "model": "Seltos", "category": "SUV", "price": 1090000, "quantity_in_stock": 3},
)


def seed_vehicles(session) -> int:
    """Insert missing seed vehicles and return the number inserted."""
    inserted = 0
    for vehicle_data in SEED_VEHICLES:
        exists = (
            session.query(Vehicle.id)
            .filter(
                Vehicle.make == vehicle_data["make"],
                Vehicle.model == vehicle_data["model"],
            )
            .first()
        )
        if exists is None:
            session.add(Vehicle(**vehicle_data))
            inserted += 1
    session.commit()
    return inserted


def main() -> None:
    create_tables()
    session = SessionLocal()
    try:
        inserted = seed_vehicles(session)
        print(f"Seed complete: inserted {inserted} vehicle(s).")
    finally:
        session.close()


if __name__ == "__main__":
    main()
