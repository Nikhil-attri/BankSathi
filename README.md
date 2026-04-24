# BankSathi — AI-Powered Assisted Banking Kiosk Platform

> A full-stack fintech MVP for assisted banking and financial product distribution — combining lead management, complaint intelligence, kiosk operations, and ML-powered automation.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Docker (Recommended)](#option-1-docker-recommended)
  - [Local Development](#option-2-local-development)
- [Core Features](#core-features)
- [API Reference](#api-reference)
- [Kiosk Demo Flow](#kiosk-demo-flow)
- [Build & Validation](#build--validation)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Overview

BankSathi is a modular, multi-persona kiosk platform built for last-mile financial service delivery. It enables banking correspondents, field agents, and walk-in customers to perform a range of banking and advisory tasks through a guided, multilingual interface — without needing to visit a full-service bank branch.

**Key use cases:**

- Assisted account opening and KYC verification via OCR
- Lead capture, pipeline tracking, and agent performance management
- Complaint logging with ML-based classification and priority scoring
- Banking simulations (balance check, fund transfer, bill payment, deposits/withdrawals)
- Multilingual voice guidance for low-literacy users
- PDF receipt generation for all completed transactions

> ⚠️ **Note:** Banking and OCR flows are simulation-ready. For production deployment, integrate with real CBS (Core Banking System) APIs and comply with applicable RBI/regulatory guidelines.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser / Kiosk UI                │
│              React + TypeScript + Vite (port 5173)       │
└────────────────────────────┬────────────────────────────┘
                             │ REST / JSON
┌────────────────────────────▼────────────────────────────┐
│                     Backend API Server                   │
│           Node.js + Express + Prisma (port 4000)        │
│                    Redis (cache/queue)                   │
└──────────────┬──────────────────────────┬───────────────┘
               │ Prisma ORM               │ HTTP
┌──────────────▼──────────┐  ┌───────────▼───────────────┐
│   PostgreSQL Database   │  │   ML Microservice (8000)  │
│   (port 5432)           │  │   Python + FastAPI        │
└─────────────────────────┘  └───────────────────────────┘
```

All services are containerised and orchestrated via Docker Compose. The frontend bootstraps demo data automatically on first load via `POST /api/bootstrap`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL |
| Cache / Queue | Redis |
| ML Service | Python 3, FastAPI, Uvicorn |
| Containerisation | Docker, Docker Compose |
| PDF Generation | Server-side receipt export |
| Voice Guidance | Web Speech API (multilingual, Indian languages) |

---

## Project Structure

```
banksathi/
├── frontend/               # React + TypeScript UI
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level page components
│   │   ├── kiosk/          # Kiosk persona views (Customer, Agent, Admin)
│   │   └── api/            # Typed API client layer
│   └── vite.config.ts
│
├── backend/                # Express REST API
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   └── lib/            # Prisma client, Redis, utilities
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── tsconfig.json
│
├── ml/                     # Python ML microservice
│   ├── app/
│   │   ├── main.py         # FastAPI entry point
│   │   ├── models/         # ML model loading and inference
│   │   └── routes/         # Prediction endpoints
│   └── requirements.txt
│
├── docker-compose.yml
└── RUN_INSTRUCTIONS.md     # Step-by-step command guide
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Docker path)
- Node.js ≥ 18 and npm ≥ 9 (for local path)
- Python ≥ 3.10 (for local ML service)
- PostgreSQL ≥ 14 (for local path)

---

### Option 1: Docker (Recommended)

The fastest way to run all services together with no manual configuration.

```bash
# Clone the repository
git clone https://github.com/your-org/banksathi.git
cd banksathi

# Build and start all services
docker compose up --build
```

**Service URLs once running:**

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Backend Health | http://localhost:4000/health |
| ML Service | http://localhost:8000 |
| ML Health | http://localhost:8000/health |

Demo data is automatically seeded on first UI load via `POST /api/bootstrap`.

---

### Option 2: Local Development

Use separate terminal windows for each service.

#### 1. PostgreSQL

Ensure a local PostgreSQL instance is running on port `5432` before proceeding.

#### 2. Backend

```bash
cd backend
npm install

# Generate Prisma client and sync schema to database
npx prisma generate
npx prisma db push

# Start development server with hot reload
npm run dev
```

Backend runs at `http://localhost:4000`.

#### 3. ML Service

```bash
cd ml
pip install -r requirements.txt

# Start FastAPI with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

ML service runs at `http://localhost:8000`.

#### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Core Features

### Agent & Lead Management
- Agent onboarding with role-based access
- Lead capture and full pipeline stage tracking (New → Qualified → Converted)
- Agent performance overview in Admin persona

### Complaint Intelligence
- Complaint submission with category tagging
- ML-based auto-classification by complaint type and severity
- Priority scoring and status lifecycle management (Open → In Progress → Resolved)

### Kiosk Mode (Three Personas)
The kiosk supports three distinct user types with tailored interfaces:

| Persona | Capabilities |
|---|---|
| **Customer** | Banking actions, balance insights, document help, query assistant |
| **Agent** | Lead capture, OCR-assisted KYC, guided service wizard, receipt generation |
| **Admin** | Complaint desk, agent overview, system status |

### Banking Simulation
- Balance enquiry and mini statement
- Fund transfer between accounts
- Cash deposit and withdrawal
- Bill payment (utilities, mobile recharge)

### OCR & Document Assistance
- Document type detection (Aadhaar, PAN, passbook, etc.)
- Field extraction and auto-fill into service forms
- Wizard flow: Service selection → OCR extraction → Data verification → Submission

### Multilingual Voice Guidance
- Step-by-step audio prompts using Web Speech API
- Support for multiple Indian languages (Hindi, Marathi, Tamil, Bengali, and more)
- Designed for assisted use by low-literacy or first-time banking users

### Receipt Generation
- Structured transaction receipts for all completed actions
- One-click PDF export for customer records

---

## API Reference

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/api/bootstrap` | Seed demo data (idempotent) |

### Users & Products

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users?role=AGENT` | List users filtered by role |
| `GET` | `/api/products` | List available financial products |

### Leads

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/leads` | Create a new lead |
| `GET` | `/api/leads` | Retrieve all leads |
| `PATCH` | `/api/leads/:leadId/stage` | Update lead pipeline stage |

### Complaints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/complaints` | Submit a new complaint |
| `GET` | `/api/complaints` | Retrieve all complaints |
| `PATCH` | `/api/complaints/:id/status` | Update complaint status |

### Kiosk & Banking

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/kiosk/features` | Get available kiosk features for a persona |
| `POST` | `/api/kiosk/banking-action` | Execute a banking simulation action |
| `POST` | `/api/kiosk/balance-insights` | Fetch balance and transaction summary |
| `POST` | `/api/kiosk/query-solve` | AI-assisted query resolution with escalation hints |
| `POST` | `/api/kiosk/document-help` | Get document type guidance |
| `POST` | `/api/kiosk/ocr-extract` | Extract fields from an uploaded document image |
| `POST` | `/api/kiosk/generate-receipt` | Generate and return a transaction receipt |

---

## Kiosk Demo Flow

1. Open the `KIOSK` tab in the frontend.
2. Select a persona: **CUSTOMER**, **AGENT**, or **ADMIN**.
3. Try the following flows end-to-end:

```
Banking Actions       → Select action type → Confirm → View receipt → Download PDF
OCR Wizard            → Upload document → Extract fields → Verify → Submit
Query Assistant       → Enter query → View AI response → Escalate if needed
Balance Insights      → View balance summary and recent transactions
```

---

## Build & Validation

### Backend (TypeScript compile check)

```bash
cd backend
npm run build
```

### Frontend (Vite production build)

```bash
cd frontend
npm run build
```

Output is placed in `frontend/dist/` and is ready to serve via any static file host or CDN.

### ML Service (Syntax validation)

```bash
cd ml
python -m py_compile app/main.py
echo "ML syntax OK"
```

---

## Environment Variables

Copy `.env.example` to `.env` in each service directory and configure as needed.

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/banksathi
REDIS_URL=redis://localhost:6379
PORT=4000
ML_SERVICE_URL=http://localhost:8000
```

### ML Service (`ml/.env`)

```env
MODEL_PATH=./models
LOG_LEVEL=info
```

> When using Docker Compose, service hostnames resolve automatically (e.g., `db`, `redis`, `ml`). Manual `.env` values are only needed for local development runs.

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `docker: command not found` | Docker not installed or not running | Install Docker Desktop and restart terminal |
| Port already in use | Another process is bound to the port | Free ports `5173`, `4000`, `8000`, `5432`, `6379` |
| `Prisma: can't connect to database` | PostgreSQL not running | Start Postgres, then run `npx prisma db push` |
| Frontend shows API errors | Backend not reachable | Confirm backend is up at `http://localhost:4000/health` |
| ML endpoint returns 500 | Model file missing or import error | Run `python -m py_compile app/main.py` to check for errors |
| Bootstrap data missing | `/api/bootstrap` not called | Hard reload the UI or call `POST /api/bootstrap` manually |

---

## Roadmap

- [ ] Real CBS / bank API integration for live transaction settlement
- [ ] Biometric authentication support for kiosk login
- [ ] Offline-first PWA mode for low-connectivity field deployments
- [ ] Vernacular NLP improvements for query assistant
- [ ] Audit log and compliance reporting module
- [ ] Admin analytics dashboard with lead funnel and complaint SLA metrics

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feature/your-feature`
2. Follow the existing code style (ESLint for TS, Black for Python)
3. Add or update tests where applicable
4. Open a pull request with a clear description of the change

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
