# CISA Trainer

A self-contained CISA exam study app with live Claude-powered hints and explanations.
App and AI backend run as a single Render service. Your API key stays on the server.

## Files
- `server.js` — serves the app and proxies Claude calls
- `public/index.html` — the entire app (all questions, tabs, embedded source doc)
- `package.json` — Node config

## Deploy to Render (one service, free tier)

1. **Revoke** any API key shared previously. Create a new one at console.anthropic.com.
2. Push these files to your GitHub repo (keep the `public/` folder structure).
3. On https://render.com → **New + → Web Service** → connect the repo.
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
4. Add an environment variable:
   - `ANTHROPIC_API_KEY` = your new key
   - *(optional)* `CLAUDE_MODEL` = a different model string
5. Deploy. Render gives you a URL like `https://cisa-trainer.onrender.com`.
   Open it on any phone or laptop — the app and live AI both work from that one URL.

## Notes
- Free tier sleeps after ~15 min idle; the first load (or first AI call) after a
  pause takes ~30–50s to wake, then it's fast. A paid instance removes this.
- The API key is read from the environment only — it is never in any file in this repo.
  Do not paste it into server.js or commit it anywhere.
- Progress (XP, streak, answers) saves per-device in the browser. Use the same
  device/browser to keep the streak.

## Data caveats
1711 questions, kept in document order, duplicates preserved and cross-linked.
38 duplicate questions have answers that conflict between copies (flagged red).
162 questions had unclear source formatting (flagged). See the verification
spreadsheet to correct these.
