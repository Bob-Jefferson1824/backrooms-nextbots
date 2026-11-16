# Backrooms: Nextbots

Browser-based multiplayer Backrooms game. The server uses Express and Socket.IO and is designed for Render.

## Current features
- Multiplayer players in one shared room.
- Nearby-area minimap discovery for every player. The map does not display the Grusiver player.
- Gru Hunt keeps the regular monsters active and gives them the Grusiver appearance.
- The hidden Grusiver role is activated by pressing `\` and entering `iloveArson`, then pressing Enter. Only one player can hold the role at a time. The client waits briefly for the server to acknowledge the role, so an older multiplayer update cannot immediately cancel the activation.
- The four-digit escape-door code is regenerated after each successful escape.

## Run locally
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Render
The included `render.yaml` configures the Node web service. Render uses `npm install` to build and `npm start` to launch.

## Note
The hidden phrase is part of the browser game and is not a secure authentication system. Anyone who inspects the game's downloaded JavaScript may discover it.
