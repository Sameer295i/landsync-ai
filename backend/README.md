# LandSync AI — Backend

FastAPI backend implementing the land acquisition workflow engine: real JWT auth with
role-based access control, a stage-tracked workflow with a full audit log, RFCTLARR
Section 26–30 compensation calculation, a document vault with version control, and a
national dashboard summary endpoint.

Tested end-to-end and confirmed working: registration, login, RBAC enforcement
(citizens get a 403 if they try to advance a stage), audit logging, and the
compensation formula.

## Run with Docker (recommended — includes PostgreSQL + PostGIS, one command)

Requires Docker Desktop installed and running.

```bash
docker-compose up --build
```

That's it. This starts:
- **PostgreSQL 16 with PostGIS 3.4** on port 5432 (data persists in a Docker volume between restarts)
- **The FastAPI backend** on port 8000, connected to that database

Open http://localhost:8000/docs — FastAPI auto-generates interactive API documentation
(Swagger UI) where you can try every endpoint directly in the browser.

To stop: `Ctrl+C`, then `docker-compose down` (add `-v` to also wipe the database volume).

## Run without Docker

The spatial (PostGIS) features need PostgreSQL with the PostGIS extension, so SQLite is
no longer supported. Install PostgreSQL + PostGIS, create a database, then:

```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql://user:password@localhost:5432/landsync
uvicorn app.main:app --reload
```
PostGIS is enabled automatically on startup. Docker (above) is the easier route.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgres://` and `postgresql://` both accepted) |
| `SECRET_KEY` | JWT signing key — set a long random value in production |
| `FRONTEND_ORIGINS` | Comma-separated deployed frontend URLs allowed by CORS (localhost is always allowed) |
| `SEED_ON_START` | Set to `true` to load demo data on first boot (only when no users exist) |

## Quick start with realistic demo data

After `docker-compose up --build` is running, seed the database in one command:
```bash
docker exec -it landsync-backend python -m app.seed
```
This wipes and repopulates with 3 demo users and 6 proposals across real Indian
coordinates (Jaipur, Jodhpur, Vadodara, Kanpur, Lucknow, Bengaluru), including
compensation records for proposals that have progressed far enough. Login with
`officer1` / `citizen1` / `state1`, all password `pass1234`. Safe to re-run anytime
to reset to a clean demo state.

## API overview

| Endpoint | Purpose |
|---|---|
| `POST /auth/register` | Create a user (citizen, district_officer, state_official, central_ministry) |
| `POST /auth/login` | Get a JWT access token |
| `POST /proposals` | Submit a new land acquisition proposal |
| `GET /proposals` | List proposals (citizens see only their own) |
| `GET /proposals/nearby?lat=&lng=&radius_km=` | Real PostGIS spatial query — proposals within a radius, sorted by distance |
| `POST /proposals/{id}/advance` | Move a proposal to the next lifecycle stage (officials only) |
| `GET /proposals/{id}/audit-log` | Full history of stage changes with actor and timestamp |
| `POST /proposals/{id}/compensation` | Calculate compensation per RFCTLARR Sections 26–30 |
| `POST /proposals/{id}/compensation/disburse` | Record a disbursement against assessed compensation |
| `POST /proposals/{id}/documents` | Upload a document (versioned automatically) |
| `GET /dashboard/summary` | National aggregate KPIs |

## What's implemented vs still mocked

**Real:** JWT auth, RBAC enforced server-side, workflow state machine with audit trail,
compensation formula (Section 26–30), document versioning, dashboard aggregation, and
now real PostGIS spatial data — proposals store an actual geometry point, and
`/proposals/nearby` runs a genuine `ST_DWithin` distance query, not a JS approximation.

**Still to connect:** the frontend map plots real coordinates when a proposal has them
(falling back to a district lookup for older/un-geotagged proposals). Parcel
*boundaries* (polygons, not just a center point) are a natural next upgrade if time
allows. Also still ahead: external API integrations (DILRMP, PFMS), notifications,
and a trained predictive model (the current estimate is a documented heuristic).

## Security note before real deployment

Change `SECRET_KEY` in `docker-compose.yml` (or your `.env`) to a long random value —
the default here is a placeholder for local development only.
