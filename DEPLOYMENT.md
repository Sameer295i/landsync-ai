# Deploying LandSync AI

Three pieces go online: the **database**, the **backend**, and the **frontend**.
The free tiers below are what most hackathon teams use. Free-tier limits change, so
check each provider's current terms before relying on them.

## 0. Put the code on GitHub
```bash
cd landsync            # the folder containing backend/ and frontend/
git init
git add .
git commit -m "LandSync AI"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<your-username>/landsync-ai.git
git branch -M main
git push -u origin main
```
After this, every change is `git add . && git commit -m "msg" && git push` and the
hosts below redeploy automatically.

## 1. Database — a Postgres with PostGIS
Use any hosted Postgres that allows the `postgis` extension (Neon and Render Postgres both
list PostGIS support). Create a database and copy its connection string. The backend
enables PostGIS and creates the tables itself on first start.

## 2. Backend — Render (Docker web service)
1. New → Web Service → connect your GitHub repo.
2. Root directory: `backend`. Runtime: Docker.
3. Environment variables:
   - `DATABASE_URL` = connection string from step 1
   - `SECRET_KEY` = a long random string (e.g. run `python -c "import secrets;print(secrets.token_hex(32))"`)
   - `SEED_ON_START` = `true` (loads demo data on first boot only)
   - `FRONTEND_ORIGINS` = your frontend URL from step 3 (add it after step 3, then redeploy)
4. Deploy, then open `https://<your-backend>.onrender.com/health` — it should say healthy.
   `/docs` shows the interactive API.

## 3. Frontend — Vercel or Netlify
1. New project → import the same repo, root directory `frontend`, framework Vite.
2. Environment variable: `VITE_API_URL` = your backend URL (no trailing slash).
3. Deploy. Copy the resulting URL into the backend's `FRONTEND_ORIGINS` and redeploy the backend.

## Things to know before demo day
- **Cold starts:** free web services usually sleep when idle, and the first request can take
  up to a minute. Open the site a few minutes before presenting.
- **Uploaded documents:** free hosts typically have temporary disk, so uploaded files can
  disappear on redeploy. Fine for a demo; production would use S3/MinIO object storage.
- **Secrets:** never commit `.env` files or a real `SECRET_KEY`.
- **Keep the local version working.** If the venue Wi-Fi fails, `docker-compose up` plus
  `npm run dev` on your laptop is your backup.

## Pushing updates and resetting demo data
```bash
git add . && git commit -m "describe your change" && git push
```
Render and Vercel redeploy automatically. New database tables (such as `rr_records`) are
created on startup; changes to columns of existing tables are not, so avoid those or reset.

To reset the live demo data to the clean seeded state, run this in the Neon SQL Editor,
then restart the Render service (it reseeds on boot because no users exist):
```sql
DELETE FROM rr_records; DELETE FROM audit_logs; DELETE FROM documents;
DELETE FROM compensation; DELETE FROM proposals; DELETE FROM users;
```
