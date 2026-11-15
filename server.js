'use strict';

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  serveClient: true,
  cors: { origin: true, methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e5
});

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_ROOM = 'backrooms-nextbots-main';
const MAX_PLAYERS_PER_ROOM = 20;
const rooms = new Map();

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname), { extensions: ['html'], maxAge: '1h' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'backrooms-nextbots' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = { players: new Map(), hostId: null };
    rooms.set(roomId, room);
  }
  return room;
}

function finite(value, fallback = 0, limit = 100000) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-limit, Math.min(limit, n)) : fallback;
}
function safeName(value) {
  return String(value || 'Player').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16) || 'Player';
}
function safeSmallArray(value, max, itemLimit = 100000) {
  if (!Array.isArray(value) || value.length > max) return undefined;
  return value.map(v => finite(v, 0, itemLimit));
}
function cleanPresence(raw, isHost) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = {
    g: 1,
    a: raw.a ? 1 : 0,
    n: safeName(raw.n),
    x: finite(raw.x), y: finite(raw.y, 0, 100), z: finite(raw.z),
    r: finite(raw.r, 0, Math.PI * 100),
    c: raw.c ? 1 : 0,
    rg: raw.rg ? 1 : 0,
    e: Math.max(0, Math.floor(finite(raw.e, 0, 1e6))),
    mon: raw.mon ? 1 : 0,
    ca: Math.max(0, Math.floor(finite(raw.ca, 0, 1e6)))
  };
  const ps = safeSmallArray(raw.ps, 4, 1000);
  const nc = safeSmallArray(raw.nc, 3, 100000);
  if (ps) p.ps = ps;
  if (nc) p.nc = nc;
  // Only the server-elected host may publish authoritative Nextbot positions/events.
  if (isHost) {
    const bots = safeSmallArray(raw.b, 200, 100000);
    if (bots) p.b = bots;
    if (typeof raw.ev === 'string' || typeof raw.ev === 'number' || raw.ev === null) p.ev = raw.ev;
  }
  return p;
}
function broadcastRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const players = [...room.players.entries()].map(([peer, player]) => ({
    peer,
    presence: player.presence || { g: 1, a: 0, n: 'Player', x: 0, y: 0, z: 0, r: 0, c: 0, rg: 0, e: 0, mon: 0, ca: 0 }
  }));
  io.to(roomId).emit('room:state', { players, hostId: room.hostId });
}
function electHost(room) {
  const oldest = [...room.players.entries()].sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0];
  room.hostId = oldest ? oldest[0] : null;
}

io.on('connection', socket => {
  let joinedRoom = null;
  let lastUpdateAt = 0;
  socket.on('room:join', payload => {
    if (joinedRoom) return;
    const requested = payload && typeof payload.room === 'string' ? payload.room : DEFAULT_ROOM;
    const roomId = requested === DEFAULT_ROOM ? DEFAULT_ROOM : null;
    if (!roomId) return socket.emit('room:error', 'Unknown game room.');
    const room = getRoom(roomId);
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) return socket.emit('room:error', 'This room is full.');
    joinedRoom = roomId;
    socket.join(roomId);
    room.players.set(socket.id, {
      joinedAt: Date.now() + Math.random() / 1000,
      presence: { g: 1, a: 0, n: 'Player', x: 0, y: 0, z: 0, r: 0, c: 0, rg: 0, e: 0, mon: 0, ca: 0 }
    });
    electHost(room);
    broadcastRoom(roomId);
  });

  socket.on('player:update', raw => {
    if (!joinedRoom) return;
    const now = Date.now();
    if (now - lastUpdateAt < 45) return; // cap each client to ~22 updates/sec
    lastUpdateAt = now;
    const room = rooms.get(joinedRoom);
    const player = room && room.players.get(socket.id);
    if (!player) return;
    const clean = cleanPresence(raw, room.hostId === socket.id);
    if (!clean) return;
    player.presence = clean;
    broadcastRoom(joinedRoom);
  });

  socket.on('disconnect', () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;
    room.players.delete(socket.id);
    electHost(room);
    if (room.players.size === 0) rooms.delete(joinedRoom);
    else broadcastRoom(joinedRoom);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backrooms: Nextbots server listening on ${PORT}`);
});
