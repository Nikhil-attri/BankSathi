# BankSathi AI Kiosk Platform

BankSathi is a full-stack fintech MVP for assisted banking and financial product distribution.  
It combines lead management, complaints intelligence, kiosk operations, and ML-powered automation.

---

## Start Here

For step-by-step command-level setup, read:

- `RUN_INSTRUCTIONS.md`

This README gives complete project overview + quick run path.

---

## Core Capabilities

- Agent onboarding and lead pipeline management
- Complaint desk with ML-based classification and priority
- Kiosk mode for Customer / Agent / Admin personas
- Basic banking simulation (balance, statement, transfer, deposit/withdrawal, bill pay)
- OCR-assisted document extraction and auto-fill flow
- Receipt generation with PDF export
- Voice guidance in multiple Indian languages
- Query-solving assistant with escalation hinting

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, Prisma
- **Database:** PostgreSQL
- **Cache/Queue-ready layer:** Redis
- **ML service:** Python FastAPI
- **Containers:** Docker Compose

---

## Project Structure

```text
banksathi/
  frontend/   # UI dashboard + kiosk assistant
  backend/    # REST APIs + Prisma schema
  ml/         # ML microservice endpoints
  docker-compose.yml
  RUN_INSTRUCTIONS.md
```

---

## Quick Run (Docker - Recommended)

From project root:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/health`
- ML health: `http://localhost:8000/health`

The app auto-seeds demo data via `POST /api/bootstrap` on first UI load.

---

## Local Run (Without Full Docker)

Use separate terminals.

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### ML Service

```bash
cd ml
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Kiosk Demo Flow

1. Open `KIOSK` tab
2. Select user type (`CUSTOMER`, `AGENT`, `ADMIN`)
3. Try:
   - Banking actions
   - Balance insights
   - Query solving assistant
   - Document help
   - OCR extraction
   - Wizard flow (service -> OCR -> verify -> submit)
   - Receipt generation + PDF download

---

## Main API Endpoints

### General

- `GET /health`
- `POST /api/bootstrap`
- `GET /api/users?role=AGENT`
- `GET /api/products`

### Leads

- `POST /api/leads`
- `GET /api/leads`
- `PATCH /api/leads/:leadId/stage`

### Complaints

- `POST /api/complaints`
- `GET /api/complaints`
- `PATCH /api/complaints/:id/status`

### Kiosk + Banking + Assistance

- `GET /api/kiosk/features`
- `POST /api/kiosk/banking-action`
- `POST /api/kiosk/balance-insights`
- `POST /api/kiosk/query-solve`
- `POST /api/kiosk/document-help`
- `POST /api/kiosk/ocr-extract`
- `POST /api/kiosk/generate-receipt`

---

## Build and Validation

### Backend

```bash
cd backend
npm run build
```

### Frontend

```bash
cd frontend
npm run build
```

### ML syntax check

```bash
cd ml
python -m py_compile app/main.py
```

---

## Troubleshooting

- Docker not found -> Install/start Docker Desktop and restart terminal
- Port conflict -> free `5173`, `4000`, `8000`, `5432`, `6379`
- Backend DB error -> ensure Postgres is running, then `npx prisma db push`
- UI API error -> confirm backend is reachable at `http://localhost:4000`

---

## Notes

- Current banking and OCR flows are simulation-ready for hackathon demos.
- Integrate real bank/CBS APIs for production settlement and compliance.
