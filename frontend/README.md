# LandSync AI — Frontend

This version is wired to the real FastAPI backend — no more mock data. Submitting a
proposal, logging in, and advancing a stage all go through real API calls and persist
in PostgreSQL.

## Run it locally (needs the backend running first)

**1. Start the backend** — see `landsync-backend/README.md`. Quickest path:
```bash
cd landsync-backend
docker-compose up --build
```
This must be running on `localhost:8000` before the frontend will work.

**2. Register at least one citizen and one official user.** Open
`http://localhost:8000/docs`, expand `POST /auth/register`, click "Try it out", and
register two users, e.g.:
```json
{"username": "officer1", "full_name": "D. Sharma", "password": "pass1234", "role": "district_officer"}
{"username": "citizen1", "full_name": "R. Kumar", "password": "pass1234", "role": "citizen"}
```

**3. Start the frontend:**
```bash
npm install
npm run dev
```
Open `http://localhost:5173` and sign in with one of the accounts you registered.

## What's real now

- Login is a real JWT session (persisted in `localStorage`, so refreshing keeps you signed in)
- Submitting a proposal creates a real row in PostgreSQL
- Advancing a stage is blocked server-side for citizens (try it — you'll see the "Advance" button only appears for official roles) and logged to a real audit trail
- The dashboard and proposals list are fetched live from the database

## What's still not wired

- GIS map is still mock colored tiles, not real Leaflet + PostGIS geometry
- Compensation calculation works on the backend (Section 26–30 formula) but has no dedicated frontend form yet — use `/docs` directly for now
- Document upload endpoint exists on the backend but has no frontend UI yet
- Reports/export is a placeholder

## Files

- `src/App.jsx` — main app, all views
- `src/api.js` — every backend call lives here; change `VITE_API_URL` (or set it in a `.env` file) if your backend runs somewhere other than `localhost:8000`
