# London Flight Tracker

Real-time flight tracker for a rooftop in Canary Wharf, London. Shows flights arriving and departing from LHR, LCY, LGW, and STN that are currently within 5km of your home coordinate.

**Stack:** Next.js 13 + React 18 + TypeScript + Tailwind + FastAPI (Python) + Flightradar24 (no API key required)

---

## Prerequisites

- Node.js 18+
- Python 3.9+
- npm

---

## First-time setup

1. **Install Node dependencies**
   ```bash
   npm install
   ```

2. **Set your home coordinate**

   Create `.env.local` in the project root:
   ```
   NEXT_PUBLIC_HOME_COORDINATE=51.5054,-0.0235
   ```
   Replace with your exact rooftop GPS coords (right-click your roof in Google Maps → Copy coordinates).

3. **Python dependencies** are installed automatically on first `npm run dev` via a venv. If that times out (pyarrow is ~26MB), install manually:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

---

## Running locally

```bash
npm run dev
```

This starts both servers concurrently:
- **Next.js** → http://localhost:3000
- **FastAPI** → http://127.0.0.1:8000

Open http://localhost:3000. Flights refresh every 5 seconds.

---

## How it works

```
Browser
  │
  ├── GET /api/flights  (every 5s)
  │       └── FastAPI → Flightradar24 protobuf API (London bounding box)
  │
  └── React (FlightList.tsx)
          ├── Filter: destination or origin ∈ {LHR, LCY, LGW, STN}
          ├── Filter: current position within 5km of home coordinate
          ├── Sort by distance to home
          └── Render flight cards with live distance countdown
```

---

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_HOME_COORDINATE` | Your rooftop `lat,lon` — used for distance calculations |

Set in `.env.local` for local dev. Set in the Vercel dashboard for production.

---

## Deploying to Vercel

1. Push repo to GitHub
2. Import project in Vercel dashboard
3. Add `NEXT_PUBLIC_HOME_COORDINATE` in Vercel → Settings → Environment Variables
4. Deploy — Vercel auto-deploys on every push to `main`
