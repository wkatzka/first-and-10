# First & 10 – Deploy and Save Instructions

Instructions for saving changes and deploying the First & 10 app. Use this file when another agent or you need to deploy or document the process.

---

## Project location

- **App root:** `first-and-10/` (inside the NFL workspace, e.g. `~/Desktop/NFL/first-and-10` or `NFL/first-and-10`).
- **Git remote:** `https://github.com/wkatzka/first-and-10.git` (branch: `main`).

---

## How to save and deploy

### 1. Save changes (commit locally)

From the **first-and-10** directory:

```bash
cd first-and-10   # or use full path, e.g. ~/Desktop/NFL/first-and-10

# See what changed
git status

# Stage the files you changed (or all)
git add <file>           # e.g. git add components/PlayfieldBackground.js
# or
git add -A               # stage everything

# Commit with a short, clear message
git commit -m "Brief description of the change"
```

Example:

```bash
cd /Users/will/Desktop/NFL/first-and-10
git add components/PlayfieldBackground.js pages/schedule.js
git commit -m "Fix field labels and schedule refresh"
```

### 2. Deploy (push to GitHub)

Push to GitHub so your host (e.g. Vercel/Render) can deploy:

```bash
cd first-and-10
git push origin main
```

**Note:** In Cursor/automated environments, `git push` often fails with “could not read Username for 'https://github.com'” because GitHub auth isn’t available there. In that case:

1. The agent can run `git add` and `git commit` only.
2. You run **on your machine** (where you’re logged into GitHub):
   ```bash
   cd /Users/will/Desktop/NFL/first-and-10
   git push origin main
   ```

### 3. After push

- **Vercel** (Next.js frontend): If the repo is connected, Vercel will build and deploy from `main` automatically.
- **Render** (backend API): If the backend is set up on Render from the same repo (e.g. `server/` or root), it will redeploy from `main` when you push.

No separate “deploy” command is required if the repo is already connected to Vercel/Render.

---

## One-line “deploy” flow (for you or an agent)

**Agent (can do):** commit only

```bash
cd /Users/will/Desktop/NFL/first-and-10 && git add -A && git commit -m "Your message"
```

**You (after agent has committed):** push to deploy

```bash
cd /Users/will/Desktop/NFL/first-and-10 && git push origin main
```

---

## Build and run locally (optional)

- **Install:** `npm install` (from `first-and-10/`)
- **Dev (frontend):** `npm run dev`
- **Backend:** `npm run server` or `node server/index.js`
- **Build:** `npm run build`
- **Full stack dev:** `npm run dev:all` (runs server + Next dev)

---

## Reference for another agent

When the user says “deploy” or “save and deploy”:

1. **Commit** from `first-and-10/`: run `git add` for changed files, then `git commit -m "…"`.
2. **Try** `git push origin main`. If it fails with a GitHub auth error, tell the user: “Changes are committed. Run `git push origin main` from `first-and-10/` on your machine to deploy.”
3. Do **not** assume Vercel CLI or other deploy tools are logged in; the normal path is commit in repo + user runs push.

Keep commit messages short and descriptive (e.g. “Fix field: yard numbers only 10/20/30…; FIRST & 10 positioning”).
