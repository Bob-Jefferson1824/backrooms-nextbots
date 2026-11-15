# Backrooms: Nextbots (Socket.IO multiplayer)

This project serves the original browser game and its multiplayer server from one Render Web Service.

## Files

- `index.html` - original game with its Supabase Realtime client replaced by Socket.IO.
- `server.js` - Express static hosting and Socket.IO room server.
- `package.json` - Render install/start configuration.

## Deploy with GitHub and Render (no local terminal required)

1. Create a GitHub repository named `backrooms-nextbots`.
2. Upload all files and folders from this project to the repository root. Keep `index.html`, `server.js`, `package.json`, and `.gitignore` at the top level.
3. In Render, choose **New** → **Web Service** and connect the GitHub repository.
4. Use these settings:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: **Free** (if available for the account)
5. Deploy. Render supplies `PORT` automatically.
6. Open the Render URL. The game and `/socket.io/socket.io.js` are served by the same service.

## Multiplayer notes

- Players join the shared room `backrooms-nextbots-main` automatically.
- The server elects the oldest connected player as Nextbot host and transfers host authority when that player disconnects.
- The server validates and limits player updates, and only accepts Nextbot state from the elected host.
- Rooms and scores are in memory. They reset when the service restarts or sleeps; this first version does not persist progress.
- Render Free services may sleep when idle, causing a cold-start delay.

## Health check

`/health` returns a small JSON health response.
