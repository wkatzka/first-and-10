# How to run the app locally

Run the frontend and API on your machine so you can test (including the **Shop** and crypto flow) without touching the live site.

**Quick start:** From `first-and-10`: `npm install` → copy `.env.example` to `.env.local` → `npm run dev`. Frontend at http://localhost:3000 (uses live API unless you run the server too; see below).

## 1. Prerequisites

- **Node.js** 18+
- **Postgres** (optional for full flow; see below)

## 2. Clone and install

```bash
cd first-and-10
git pull
npm install
```

## 3. Environment

**Frontend** (project root):

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_API_URL=http://localhost:4000` is already in `.env.example`; keep it so the app talks to your local API.

**Server** (only if you want local API + DB):

```bash
cd server
cp .env.example .env
npm install
```

- In `server/.env`, set **`DATABASE_URL`** to your Postgres connection string if you want login/roster/cards.  
- If you skip Postgres, you can still run the frontend and point `NEXT_PUBLIC_API_URL` at the **live** API to use live data while developing UI.

## 4. Database (optional)

If you use Postgres:

```bash
cd server
node db/migrate.js
node seed-dev.js
```

- `seed-dev.js` adds dev users (e.g. TestUser1).  
- Reset a password: `node reset-dev-password.js TestUser1` (password becomes `password`).

## 5. Run the app

**Option A – Frontend only (uses live API)**

```bash
npm run dev
```

- Frontend: **http://localhost:3000**  
- Set `NEXT_PUBLIC_API_URL` in `.env.local` to your **live** API URL if you want to hit production backend.

**Option B – Frontend + local API (full local)**

```bash
npm run dev:all
```

- API: **http://localhost:4000**  
- Frontend: **http://localhost:3000**  
- Requires `server/.env` and, for login/cards, Postgres.

## 6. What you see locally

- **Shop** and wallet connect only show when you’re on **localhost** (they’re hidden on the live site).  
- Same codebase: local = “testing” environment, so crypto/shop is enabled; deployed = “live” and shop is off.

## 7. Quick test (no Postgres)

1. Point `.env.local` at the live API:  
   `NEXT_PUBLIC_API_URL=https://first-and-10.onrender.com` (or your live API URL).  
2. Run `npm run dev`.  
3. Open http://localhost:3000 and log in with a real account.  
4. You’ll see the **Shop** tab; connect wallet and use the flow locally against the live backend.

For full local API + DB, use Option B and set `DATABASE_URL` in `server/.env`.

---

## Why John! had 2 HOF OL (and no art)

- **How he got 2 OL:**  
  (1) **Pack sneak:** When John! opens a pack, the server injects one random HOF card (any position) into a random slot. That can be an OL (e.g. Cooper Carlisle or Taylor Decker).  
  (2) **Grant “WR” returned OL:** The admin grant was called with `position: "WR"`. On the old code, if no unminted HOF WR was found, the endpoint **fell back** to any unminted HOF player, so it could return an OL. So one OL from the pack, one from the grant = 2 OL.

- **Why no art:** Admin-granted and pack-sneak cards were saved with `image_pending = true` and only enqueued for AI image generation. If Render doesn’t have `OPENAI_API_KEY` set, or the image-regen queue doesn’t run or finish, those cards stay with the placeholder.

- **Fixes in this repo:** Grant with `position` no longer falls back to other positions (WR request = only WR or error). Grant now generates the card image **synchronously** when AI is available so the new WR gets art immediately.

---

## Admin: Give John! a tier‑11 WR and fix art (live)

After the **server** is deployed to Render (latest code with `grant-hof-card` + `position` and `regenerate-images`):

1. **Grant John! a HOF WR** (use your live API URL and `ADMIN_KEY` from Render env):

   ```bash
   curl -X POST https://YOUR-LIVE-API.onrender.com/api/admin/grant-hof-card \
     -H "Content-Type: application/json" \
     -H "x-admin-key: YOUR_ADMIN_KEY" \
     -d '{"username":"John!","position":"WR"}'
   ```

2. **Regenerate art for existing cards** (the 2 OL, etc.): The new WR gets art from the grant when `OPENAI_API_KEY` is set. To fix the two OL that have no art, call:

   ```bash
   curl -X POST https://YOUR-LIVE-API.onrender.com/api/admin/regenerate-images \
     -H "x-admin-key: YOUR_ADMIN_KEY"
   ```

   Requires `OPENAI_API_KEY` on Render. The queue generates images for every card that has no art, placeholder, or `.svg`.
