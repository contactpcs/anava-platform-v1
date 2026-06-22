# Anava Platform

Monorepo with three services: a Next.js frontend, a FastAPI backend, and a standalone EEG analysis microservice.

---

## frontend

Next.js app (NeuroWellness Patient Rating System).

```bash
cd frontend
npm install
npm run dev       # development server (Turbopack) — http://localhost:3000
npm run build     # production build
npm run start     # serve production build
npm run lint      # ESLint
```

---

## backend

FastAPI + SQLAlchemy async service.

```bash
cd backend
pip install -r requirements.txt   # or: make install
make dev                           # uvicorn with --reload on port 8000
make test                          # pytest tests/
make lint                          # ruff check
make seed                          # seed assessment scales into the database
```

Copy `.env.example` to `.env` and fill in database / Supabase / Redis credentials before starting.

---

## brain-mapping

Standalone FastAPI microservice for EEG analysis. Processes EDF files, generates PDF reports, and uploads them to S3.

```bash
cd brain-mapping
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

Required `.env` variables:

```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=
NEUROWELLNESS_API_URL=http://localhost:8000   # main backend base URL
SERVICE_API_KEY=                              # shared secret for service-to-service auth
PYVISTA_OFF_SCREEN=true                      # set for headless / server rendering
```

---

## Running all three together

Start each service in a separate terminal in the order: backend → brain-mapping → frontend.
