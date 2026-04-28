# Smart Supply Chain Deployment Checklist

This project is split into:

- Backend: FastAPI in `backend/`, deploy on Render.
- Frontend: Vite React in `frontend/`, deploy on Vercel.

## 1. Backend: Render

Create a new Render Web Service or Blueprint from the repository.

Recommended settings:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Python version: `3.11.11`

Required environment variables:

```env
GOOGLE_API_KEY=...
GOOGLE_MAPS_API_KEY=...
OPENWEATHER_API_KEY=...
NEWS_API_KEY=...
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:5173
FRONTEND_ORIGIN_REGEX=https://.*\.vercel\.app
WEATHER_DISRUPTION_THRESHOLD=0.5
NEWS_DISRUPTION_RADIUS_DEFAULT_KM=15
MOVEMENT_ENGINE_ENABLED=true
MOVEMENT_TICK_SECONDS=10
MOVEMENT_TIME_SCALE=1
MOVEMENT_MAX_ELAPSED_SECONDS=15
MOVEMENT_NODE_DWELL_HOURS=0.25
```

Health check after deployment:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://your-render-backend.onrender.com/api/health"
Invoke-WebRequest -UseBasicParsing -Uri "https://your-render-backend.onrender.com/api/shipments"
Invoke-WebRequest -UseBasicParsing -Uri "https://your-render-backend.onrender.com/api/news/headlines?location=India&limit=3"
```

## 2. Frontend: Vercel

Create a new Vercel project from the same repository.

Recommended settings:

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

Required environment variables:

```env
VITE_API_URL=https://your-render-backend.onrender.com/api
VITE_GOOGLE_MAPS_API_KEY=...
```

Optional Firebase web config variables are listed in `frontend/.env.example`.

## 3. Post-Deploy Smoke Test

Open the Vercel URL and verify:

- Dashboard loads shipments.
- Map loads Google Maps tiles.
- Risk Heatmap toggles without stacking tint.
- Reroute Suggestions panel appears when disruptions exist.
- External Event Review shows live `logistics_watch` candidates.
- What-If Simulator opens and runs a scenario.
- Contracts page loads and can evaluate SLA breaches.
- Analytics page loads KPIs and explanations.

## 4. Important Notes

- Do not commit `.env`, `backend/.env`, `frontend/.env`, or `backend/firebase-admin.json`.
- Use Python `3.11.11` on Render. Python 3.14 currently causes dependency conflicts with the pinned Google/Firebase packages.
- Use `FIREBASE_SERVICE_ACCOUNT_JSON` on Render instead of uploading the local JSON file.
- NewsAPI may return zero events for narrow logistics queries; the dashboard falls back to regional queries.
- Google Directions API is used only for road path/ETA enrichment. Supply-chain decisions still use the project graph.
