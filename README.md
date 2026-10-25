# Car Dealership Inventory System

## About the Project

This project is a car dealership inventory system that helps manage vehicles available for sale. Users can register, log in, view available vehicles, search the inventory, and purchase vehicles. When a purchase is made, the available stock is updated automatically.

The system also supports admin-only operations for adding and updating vehicle details, restocking vehicles, and removing vehicles from the inventory.

The backend is built using FastAPI and SQLite, with SQLAlchemy for database operations. The frontend uses React, TypeScript, and Tailwind CSS. Pytest is used to test backend functionality.

## Technologies Used

- Python and FastAPI
- SQLite and SQLAlchemy
- React and TypeScript
- Vite and Tailwind CSS
- Pytest

## Main Features

- User registration and login
- JWT-based authentication for protected endpoints
- Authenticated access to the vehicle inventory
- Search vehicles by make, model, category, and price range
- Purchase vehicles and automatically update stock
- Prevent purchases when a vehicle is out of stock
- Admin-only vehicle creation, restocking, updating, and deletion
- Automated tests for backend API functionality

## Project Structure

```text
car-dealership-inventory/
├── backend/
│   ├── app/
│   │   ├── bootstrap_admin.py
│   │   └── seed.py
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
├── screenshots/
├── scripts/verify.sh
├── README.md
├── PROMPTS.md
└── TEST_REPORT.md
```

## How to Run the Project

### Prerequisites

Install Python 3, Node.js, and npm.

### Backend Setup

From the project root, create and activate a virtual environment if you do not already have one:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install the backend dependencies:

```bash
cd backend
pip install -r requirements.txt
```

Set a private JWT secret for your local environment. Replace the example value with a strong, private secret. Do not commit your real secret to Git.

```bash
export JWT_SECRET_KEY="your-local-secret"
```

Initialize the database and insert the sample vehicles. The seed script is idempotent: running it again does not duplicate the same make/model pairs. It includes several categories and one sold-out vehicle.

```bash
python -m app.seed
```

Start the backend server from the `backend` directory:

```bash
uvicorn app.main:app --reload
```

The backend runs at:

http://127.0.0.1:8000

### Create an administrator account

1. Start the backend and register the account normally through the frontend or `POST /api/auth/register`.
2. In a second terminal, from the `backend` directory, activate the same virtual environment and run the following command with the email address of that existing account:

   ```bash
   ADMIN_EMAIL=admin@example.com python -m app.bootstrap_admin
   ```

3. Sign out and sign back in so the frontend refreshes the user's role.

Registration never grants administrator privileges, even if a request includes an `is_admin` field. Administrator creation is a server-side CLI operation; there is no public admin-promotion endpoint. The `ADMIN_EMAIL` value identifies the account the operator explicitly chooses to promote. Do not commit credentials or a real JWT secret.

FastAPI's interactive API documentation is available at:

http://127.0.0.1:8000/docs

### Frontend Setup

Open a second terminal at the project root and run:

```bash
cd frontend
npm ci
npm run dev
```

Open the local URL displayed in the terminal. Vite typically uses `http://localhost:5173`, but it may select another port if that port is already occupied.

### Running the Tests

Activate the project's virtual environment if it is not already active. From the project root, run:

```bash
cd backend
PYTHONPATH=. python -m pytest -v
```

The backend tests use a separate in-memory SQLite database. The test lifespan skips normal database initialization when the isolated test fixture is active, so tests do not create or modify the application's regular `inventory.db`.

### Run all checks

After installing the backend requirements and frontend dependencies, run this from the repository root:

```bash
bash scripts/verify.sh
```

The script runs the backend tests, frontend production build, and frontend lint checks. Record the actual results in `TEST_REPORT.md` before submission.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Retrieve the authenticated user's details |
| GET | `/api/vehicles` | View vehicles |
| GET | `/api/vehicles/search` | Search vehicles |
| POST | `/api/vehicles` | Add a vehicle (admin only) |
| POST | `/api/vehicles/{vehicle_id}/purchase` | Purchase a vehicle |
| POST | `/api/vehicles/{vehicle_id}/restock` | Restock a vehicle (admin only) |
| PUT | `/api/vehicles/{vehicle_id}` | Update vehicle details (admin only) |
| DELETE | `/api/vehicles/{vehicle_id}` | Remove a vehicle (admin only) |

Protected endpoints require authentication. Administrative operations are restricted to users with administrator privileges.

## Database

The application uses SQLite to store vehicle and user information. SQLAlchemy handles database operations.

The test suite uses a separate in-memory database, allowing tests to run without adding test records to the regular application database.

## Screenshots

Screenshots of the application and API documentation are available in the `screenshots/` directory:

- `inventory.png` — inventory dashboard
- `search.png` — vehicle search
- `purchase.png` — purchase flow
- `api-docs.png` — FastAPI API documentation

Confirm that these files are included in the repository before submission.

## My AI Usage

I used ChatGPT to help understand errors, troubleshoot the test setup, review parts of the implementation, and improve project documentation. I reviewed the suggestions and used them to work through development issues.

AI assistance was useful for debugging and identifying gaps, but I also needed to verify the suggested changes against the actual application and run the tests. This experience reinforced the importance of understanding the code rather than relying on generated suggestions without verification.

The root `PROMPTS.md` file documents my AI usage and includes the original ChatGPT conversation link currently available to me, along with summaries of the assistance received. These summaries are not verbatim transcripts. I will verify that the original conversation records adequately document the AI-assisted work before submission, as required by the assignment.

## Test Report

The `TEST_REPORT.md` file records the backend test results, including passing tests, failures, warnings, and the verification performed on the frontend.

## Current Status

Verification status for this working revision:

- Python syntax compilation: passed in the preparation environment.
- Backend pytest suite: not executed in the preparation environment because its Python dependencies could not be installed there.
- Frontend production build and lint: not verified in the preparation environment because frontend dependencies were unavailable.
- GitHub push: not performed from this environment.

Run the commands above on a machine with the dependencies installed before submission, then update `TEST_REPORT.md` with the actual output. The existing Git history does not establish a complete Red–Green–Refactor sequence; do not fabricate earlier commits or timestamps. Review existing commits and use genuine AI co-author trailers on future AI-assisted commits.
