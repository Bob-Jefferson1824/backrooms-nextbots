# Backrooms: Nextbots

Updated Socket.IO multiplayer build. Deploy the repository to Render as a Node Web Service.

- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node
- Free instance

## Changes in this update
- Normal players see only their own minimap dot. No explored-map reveal.
- In Gru Hunt, the normal monster count remains active and all monsters use the Grusiver appearance.
- The player-controlled Grusiver remains a separate role. Only a player whose in-game name is exactly `Grusiver` can claim it; the server permits only one active Grusiver at a time.
- Normal players do not see the Grusiver player marker on the minimap.

The role check is intentionally username-based, as requested. Anyone can type that name, so it is not secure account authentication.
