# BankSathi - Run Instructions (Single Guide)

Use this file as the only reference to run and demo the project.

## 1) What this project includes

- `frontend` - React + TypeScript dashboard and kiosk UI
- `backend` - Node.js + Express + Prisma APIs
- `ml` - FastAPI ML service
- `postgres` + `redis` - database and cache (via Docker Compose)

---

## 2) Fastest way (recommended): Docker

## Prerequisites

- Install Docker Desktop
- Start Docker Desktop before running commands

## Commands

From project root (`banksathi`):

```bash
docker compose up --build
```

## Open these URLs

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/health`
- ML health: `http://localhost:8000/health`

If health URLs show JSON with `"ok": true`, services are running.

---

## 3) Alternative: Run without Docker

You need 4 terminals.

## Terminal A - PostgreSQL

Run local PostgreSQL manually (or use Docker only for DB).
If using Docker for only DB:

```bash
docker run --name banksathi-postgres -e POSTGRES_USER=banksathi -e POSTGRES_PASSWORD=banksathi -e POSTGRES_DB=banksathi -p 5432:5432 -d postgres:16
```

## Terminal B - Redis

```bash
docker run --name banksathi-redis -p 6379:6379 -d redis:7-alpine
```

## Terminal C - Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Terminal D - ML

```bash
cd ml
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Terminal E - Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

---

## 4) First-time in app

On first load, frontend calls bootstrap automatically.
If needed, manual bootstrap:

```bash
curl -X POST http://localhost:4000/api/bootstrap
```

---

## 5) Demo flow (what to click)

1. Open `KIOSK` tab.
2. Choose user type (Customer/Agent/Admin).
3. Try:
   - Basic banking actions (balance, statement, transfer)
   - Balance insights
   - Query solving assistant
   - Document help
   - OCR auto-fill
   - Wizard flow (service -> OCR -> verify -> submit)
   - Receipt generation + PDF download

---

## 6) Useful API endpoints

- `GET /health`
- `POST /api/bootstrap`
- `GET /api/users?role=AGENT`
- `GET /api/products`
- `POST /api/leads`
- `PATCH /api/leads/:leadId/stage`
- `GET /api/leads`
- `POST /api/complaints`
- `GET /api/complaints`
- `PATCH /api/complaints/:id/status`
- `GET /api/kiosk/features`
- `POST /api/kiosk/banking-action`
- `POST /api/kiosk/balance-insights`
- `POST /api/kiosk/query-solve`
- `POST /api/kiosk/document-help`
- `POST /api/kiosk/ocr-extract`
- `POST /api/kiosk/generate-receipt`

---

## 7) Common issues and fixes

- Docker command not found:
  - Install Docker Desktop and restart terminal
- Port already in use:
  - Stop old process/container using that port (`5173`, `4000`, `8000`, `5432`, `6379`)
- Frontend shows API errors:
  - Ensure backend is running at `http://localhost:4000`
- Backend fails DB connection:
  - Verify Postgres is running and credentials match compose/env settings
- Prisma errors:
  - Run `npx prisma generate` and `npx prisma db push` again in `backend`

---

## 8) Build checks

From root:

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

ML syntax check:

```bash
cd ../ml
python -m py_compile app/main.py
```

---

## 9) Stop services

If using Docker Compose:

```bash
docker compose down
```

To remove volumes too:

```bash
docker compose down -v
```
