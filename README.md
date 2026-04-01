# Asset Management System

This repo is now split into two deployable apps:

- `frontend/` React + Vite UI
- `backend/` Express OIDC auth/session API

## Local Development

1. Install frontend deps:
`npm run install:frontend`

2. Install backend deps:
`npm run install:backend`

3. Run backend:
`npm run dev:backend`

4. Run frontend:
`npm run dev:frontend`

## Environment Files

Frontend:
- Copy `frontend/.env.example` to `frontend/.env`
- Set at least `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Optional: `VITE_API_BASE_URL` (leave empty for same-origin/proxy, set full backend URL for separate domains)

Backend:
- Copy `backend/.env.example` to `backend/.env`
- Set OIDC, DB, and session values
- For split-domain hosting, set:
  - `FRONTEND_ORIGINS=https://your-frontend-domain`
  - `SESSION_SAME_SITE=none`
  - `SESSION_SECURE=true`

## Build

Frontend production build:
`npm run build:frontend`

## Docker Deploy (Frontend + Backend)

This repo includes:
- `frontend/Dockerfile` (Vite build + Nginx)
- `backend/Dockerfile` (Node API)
- `docker-compose.yml`

Run with Docker Compose:

1. Configure backend env:
- copy `backend/.env.example` to `backend/.env`
- set real OIDC + DB values

2. Build and run:
`docker compose up -d --build`

3. Open app:
`http://localhost:3000`

Notes:
- Frontend container proxies `/api`, `/cb`, and `/logout` to backend container.
- Keep `VITE_API_BASE_URL` empty when using this compose setup.
