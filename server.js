'use strict';
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { serveClient: true, cors: { origin: true, methods: ['GET','POST'] }, pingInterval: 25000, pingTimeout: 20000, maxHttpBufferSize: 1e5 });
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_ROOM = 'backrooms-nextbots-main';
const MAX_PLAYERS_PER_ROOM = 20;
const rooms = new Map();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname), { extensions: ['html'], maxAge: '1h' }));
app.get('/health', (_req,res)=>res.json({ok:true,service:'backrooms-nextbots'}));
app.get('*', (_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
function getRoom(id){let r=rooms.get(id);if(!r){r={players:new Map(),hostId:null,grusiverPeer:null};rooms.set(id,r)}return r}
function finite(v,f=0,l=100000){const n=Number(v);return Number.isFinite(n)?Math.max(-l,Math.min(l,n)):f}
function safeName(v){return String(v||'Player').replace(/[^\p{L}\p{N} _.\-]/gu,'').trim().slice(0,16)||'Player'}
function safeArray(v,max,lim=100000){if(!Array.isArray(v)||v.length>max)return undefined;return v.map(x=>finite(x,0,lim))}
function cleanPresence(raw,isHost,allowGru){if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const name=safeName(raw.n);const p={g:1,a:raw.a?1:0,n:name,x:finite(raw.x),y:finite(raw.y,0,100),z:finite(raw.z),r:finite(raw.r,0,Math.PI*100),c:raw.c?1:0,rg:raw.rg?1:0,e:Math.max(0,Math.floor(finite(raw.e,0,1e6))),mon:raw.mon&&allowGru?1:0,ca:Math.max(0,Math.floor(finite(raw.ca,0,1e6)))};const ps=safeArray(raw.ps,4,1000),nc=safeArray(raw.nc,3,100000);if(ps)p.ps=ps;if(nc)p.nc=nc;if(isHost){const bots=safeArray(raw.b,200,100000);if(bots)p.b=bots;if(typeof raw.ev==='string'||typeof raw.ev==='number'||raw.ev===null)p.ev=raw.ev}return p}
function broadcastRoom(id){const r=rooms.get(id);if(!r)return;const players=[...r.players.entries()].map(([peer,p])=>({peer,presence:p.presence||{g:1,a:0,n:'Player',x:0,y:0,z:0,r:0,c:0,rg:0,e:0,mon:0,ca:0}}));io.to(id).emit('room:state',{players,hostId:r.hostId})}
function electHost(r){const oldest=[...r.players.entries()].sort((a,b)=>a[1].joinedAt-b[1].joinedAt)[0];r.hostId=oldest?oldest[0]:null}
io.on('connection',socket=>{let joined=null,lastUpdate=0;socket.on('room:join',payload=>{if(joined)return;const requested=payload&&typeof payload.room==='string'?payload.room:DEFAULT_ROOM;if(requested!==DEFAULT_ROOM)return socket.emit('room:error','Unknown game room.');const r=getRoom(DEFAULT_ROOM);if(r.players.size>=MAX_PLAYERS_PER_ROOM)return socket.emit('room:error','This room is full.');joined=DEFAULT_ROOM;socket.join(joined);r.players.set(socket.id,{joinedAt:Date.now()+Math.random()/1000,presence:{g:1,a:0,n:'Player',x:0,y:0,z:0,r:0,c:0,rg:0,e:0,mon:0,ca:0}});electHost(r);broadcastRoom(joined)});
socket.on('player:update',raw=>{if(!joined)return;const now=Date.now();if(now-lastUpdate<45)return;lastUpdate=now;const r=rooms.get(joined),player=r&&r.players.get(socket.id);if(!player)return;const requestedGru=!!(raw&&raw.mon);let allowGru=false;if(requestedGru&&raw&&raw.gk==='iloveArson'&&(!r.grusiverPeer||r.grusiverPeer===socket.id)){allowGru=true;r.grusiverPeer=socket.id}else if(r.grusiverPeer===socket.id){r.grusiverPeer=null}const clean=cleanPresence(raw,r.hostId===socket.id,allowGru);if(!clean)return;if(!allowGru)clean.mon=0;player.presence=clean;broadcastRoom(joined)});
socket.on('disconnect',()=>{if(!joined)return;const r=rooms.get(joined);if(!r)return;r.players.delete(socket.id);if(r.grusiverPeer===socket.id)r.grusiverPeer=null;electHost(r);if(!r.players.size)rooms.delete(joined);else broadcastRoom(joined)})});
server.listen(PORT,'0.0.0.0',()=>console.log(`Backrooms: Nextbots server listening on ${PORT}`));
