# CISA Trainer

A self-contained CISA exam study app with live Claude hints/explanations and
cross-device progress sync (name + PIN login). Runs as ONE Render web service
backed by a Render PostgreSQL database.

## Files
- `server.js` — serves the app, proxies Claude, handles login + sync
- `public/index.html` — the entire app
- `package.json` — Node config (uses the `pg` library)

## Deploy on Render

### 1. Create the database first
- Render dashboard → **New + → Postgres**
- Name it (e.g. `cisa-db`), pick the **Free** plan, create it.
- Open it → copy the **Internal Database URL** (starts with `postgres://`).
- NOTE: the free database **expires 30 days after creation**. Render emails you
  warnings 7/3/1 days before. Before then, either upgrade it (~$6/mo) or create a
  fresh free DB and have your wife use the in-app **Export** backup to restore.

### 2. Create the web service
- **New + → Web Service** → connect your repo.
- Runtime **Node**, Build `npm install`, Start `npm start`, Instance **Free**.

### 3. Add environment variables (web service → Environment)
- `ANTHROPIC_API_KEY` = your new Anthropic key
- `DATABASE_URL`      = the Internal Database URL you copied in step 1
- *(optional)* `CLAUDE_MODEL` = a model string

### 4. Deploy
- Click Create. Watch logs for `DB ready` and `CISA Trainer running on ...`.
- Open the URL. You'll see a sign-in screen — pick a name + PIN (4+ digits).
  First sign-in creates the account; the same name+PIN on any device restores
  her progress.

## How sync works
- Progress saves to Postgres ~1.5s after each change, AND to the device's
  browser as a local backup. A small dot by her name shows green when synced.
- If the DB is ever unavailable (e.g. it expired), the app keeps working from
  the local browser copy so nothing is lost in the moment.

## Secrets
The API key and database URL live ONLY in Render's environment variables —
never in any file in this repo. Don't paste them into server.js or commit them.

## Data caveats
1711 questions in document order; duplicates preserved + cross-linked.
38 duplicate sets have conflicting answers (flagged red); 162 had unclear source
formatting (flagged). See the verification spreadsheet to correct these.
