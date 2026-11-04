# LandSync AI

Real-time National Land Acquisition & Management System — Smart India Hackathon 2026
(Problem Statement SIH26016, Ministry of Rural Development, Dept. of Land Resources).

Team Error Hunters.

## What it does
Digitizes the land acquisition lifecycle under the RFCTLARR Act, 2013: seven-stage workflow
with audit log, Section 26–30 compensation calculator, PostGIS spatial data and map,
server-enforced role-based access, versioned documents, and a national dashboard.

## Repo layout
- `backend/` — FastAPI + PostgreSQL/PostGIS API ([details](backend/README.md))
- `frontend/` — React + Tailwind + Leaflet web app ([details](frontend/README.md))
- `DEPLOYMENT.md` — step-by-step guide to put it online

## Run locally
```bash
# 1. Backend + database (needs Docker Desktop)
cd backend
docker-compose up --build
docker exec -it landsync-backend python -m app.seed    # demo data

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev
```
Demo logins (all password `pass1234`): `officer1`, `state1`, `citizen1`.
