
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.database import create_tables
from app.dependencies import get_current_user, get_db, require_admin
from app.models import Order, User, Vehicle
from app.schemas import OrderCreate, TokenResponse, UserRegister, UserResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tests provide an isolated in-memory session factory before startup.
    # Avoid touching the normal SQLite database during those test runs.
    if not getattr(app.state, "TestingSessionLocal", None):
        create_tables()
    yield


app = FastAPI(title="DriveSpace Inventory API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VehicleCreate(BaseModel):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=50)
    price: float = Field(gt=0)
    quantity_in_stock: int = Field(ge=0)


class RestockRequest(BaseModel):
    quantity: int = Field(gt=0)


def vehicle_to_dict(vehicle: Vehicle):
    return {
        "id": vehicle.id,
        "make": vehicle.make,
        "model": vehicle.model,
        "category": vehicle.category,
        "price": vehicle.price,
        "quantity_in_stock": vehicle.quantity_in_stock,
    }


def order_to_dict(order: Order):
    return {
        "order_number": order.order_number,
        "vehicle": order.vehicle,
        "exterior_colour": order.exterior_colour,
        "unit_price": order.unit_price,
        "created_at": order.created_at.isoformat(),
    }


@app.post(
    "/api/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    email = str(payload.email).lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/login", response_model=TokenResponse)
def login_user(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form.username.lower()
    user = db.query(User).filter(User.email == email).first()

    if user is None or not verify_password(
        form.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }


@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
    }


@app.get("/api/vehicles")
def list_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [vehicle_to_dict(v) for v in db.query(Vehicle).all()]


@app.get("/api/vehicles/search")
def search_vehicles(
    make: str | None = None,
    model: str | None = None,
    category: str | None = None,
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (
        min_price is not None
        and max_price is not None
        and min_price > max_price
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="min_price cannot be greater than max_price",
        )

    query = db.query(Vehicle)

    if make:
        query = query.filter(Vehicle.make.ilike(f"%{make.strip()}%"))
    if model:
        query = query.filter(Vehicle.model.ilike(f"%{model.strip()}%"))
    if category:
        query = query.filter(
            Vehicle.category.ilike(f"%{category.strip()}%")
        )
    if min_price is not None:
        query = query.filter(Vehicle.price >= min_price)
    if max_price is not None:
        query = query.filter(Vehicle.price <= max_price)

    return [vehicle_to_dict(v) for v in query.all()]


@app.post("/api/vehicles", status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)


@app.put("/api/vehicles/{vehicle_id}")
def update_vehicle(
    vehicle_id: int,
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()

    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    for field, value in payload.model_dump().items():
        setattr(vehicle, field, value)

    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)


@app.delete("/api/vehicles/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()

    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted successfully"}


@app.post("/api/vehicles/{vehicle_id}/restock")
def restock_vehicle(
    vehicle_id: int,
    payload: RestockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()

    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle.quantity_in_stock += payload.quantity
    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)


@app.post("/api/vehicles/{vehicle_id}/purchase")
def purchase_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = db.execute(
        update(Vehicle)
        .where(
            Vehicle.id == vehicle_id,
            Vehicle.quantity_in_stock > 0,
        )
        .values(quantity_in_stock=Vehicle.quantity_in_stock - 1)
    )

    if result.rowcount == 0:
        db.rollback()
        exists = db.query(Vehicle.id).filter(Vehicle.id == vehicle_id).first()

        if exists is None:
            raise HTTPException(status_code=404, detail="Vehicle not found")

        raise HTTPException(status_code=409, detail="Vehicle is out of stock")

    db.commit()
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    return vehicle_to_dict(vehicle)


@app.post("/api/orders", status_code=status.HTTP_201_CREATED)
def create_order(
    vehicle_id: int,
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Keep stock decrement and order creation in one transaction. If saving the
    # order fails, the stock decrement is rolled back as well.
    result = db.execute(
        update(Vehicle)
        .where(
            Vehicle.id == vehicle_id,
            Vehicle.quantity_in_stock > 0,
        )
        .values(quantity_in_stock=Vehicle.quantity_in_stock - 1)
    )
    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(status_code=409, detail="Vehicle is out of stock")

    order = Order(
        order_number=f"DS-{uuid4().hex[:12].upper()}",
        user_id=current_user.id,
        vehicle_id=vehicle.id,
        vehicle=f"{vehicle.make} {vehicle.model}",
        customer_name=payload.customer_name,
        customer_email=str(payload.customer_email),
        customer_phone=payload.customer_phone,
        customer_address=payload.customer_address,
        exterior_colour=payload.exterior_colour,
        unit_price=vehicle.price,
    )
    try:
        db.add(order)
        db.flush()
        db.refresh(order)
        response = order_to_dict(order)
        db.commit()
        return response
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the order",
        ) from exc


@app.get("/api/orders/me")
def my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orders = (
        db.query(Order)
        .filter(Order.user_id == current_user.id)
        .order_by(Order.id.desc())
        .all()
    )
    return [order_to_dict(order) for order in orders]
