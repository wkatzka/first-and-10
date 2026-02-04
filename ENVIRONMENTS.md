# Environments: Testing vs Live

We have exactly **two environments**. Always use these canonical names so every agent knows which is which.

| Canonical name | **Testing environment** | **Live environment** |
|----------------|---------------------------|------------------------|
| Also called    | testing, local, dev       | live, production       |
| **Frontend**   | `http://localhost:3000`   | Deployed URL (e.g. Vercel) |
| **Backend**    | `http://localhost:4000`   | Deployed URL (e.g. Render) |
| **Purpose**    | Local dev, safe to break  | Real users, be careful |

## How to tell them apart in code

- **Frontend:** Use `lib/env.js`: `isTesting` = testing environment, `isLive` = live environment.
- **Backend:** Use `NODE_ENV` or `process.env.FRONTEND_URL` (live sets FRONTEND_URL to deployed frontend).

## Config checklist

**Testing environment (local):**

- Frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`
- Server runs on port 4000; CORS already allows `http://localhost:3000`
- Optional: `NEXT_PUBLIC_APP_ENV=development` to force testing

**Live environment (production):**

- Frontend build env: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com` (no localhost)
- Server env: `FRONTEND_URL=https://your-app.vercel.app` (so CORS allows the live frontend)

## Port reference (testing environment only)

- **3000** – Next.js (frontend)
- **4000** – Express API (backend)

Do not use port 3001, 3002, 3003 for the API; the backend default is 4000.
