'use strict';
const path = require('path');
const crypto = require('crypto');
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
const makeCode = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');
function getRoom(id){let r=rooms.get(id);if(!r){r={players:new Map(),hostId:null,grusiverPeer:null,escapeCode:makeCode(),lastCodeResetAt:0};rooms.set(id,r)}return r}
function finite(v,f=0,l=100000){const n=Number(v);return Number.isFinite(n)?Math.max(-l,Math.min(l,n)):f}
function safeName(v){return String(v||'Player').replace(/[^\p{L}\p{N} _.\-]/gu,'').trim().slice(0,16)||'Player'}
function safeArray(v,max,lim=100000){if(!Array.isArray(v)||v.length>max)return undefined;return v.map(x=>finite(x,0,lim))}
function cleanPresence(raw,isHost,allowGru){if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const name=safeName(raw.n);const p={g:1,a:raw.a?1:0,n:name,x:finite(raw.x),y:finite(raw.y,0,100),z:finite(raw.z),r:finite(raw.r,0,Math.PI*100),c:raw.c?1:0,rg:raw.rg?1:0,e:Math.max(0,Math.floor(finite(raw.e,0,1e6))),mon:raw.mon&&allowGru?1:0,ca:Math.max(0,Math.floor(finite(raw.ca,0,1e6)))};const ps=safeArray(raw.ps,4,1000),nc=safeArray(raw.nc,3,100000);if(ps)p.ps=ps;if(nc)p.nc=nc;if(isHost){const bots=safeArray(raw.b,200,100000);if(bots)p.b=bots;if(typeof raw.ev==='string'||typeof raw.ev==='number'||raw.ev===null)p.ev=raw.ev}return p}
function broadcastRoom(id){const r=rooms.get(id);if(!r)return;const players=[...r.players.entries()].map(([peer,p])=>({peer,presence:p.presence||{g:1,a:0,n:'Player',x:0,y:0,z:0,r:0,c:0,rg:0,e:0,mon:0,ca:0}}));io.to(id).emit('room:state',{players,hostId:r.hostId})}
function electHost(r){const oldest=[...r.players.entries()].sort((a,b)=>a[1].joinedAt-b[1].joinedAt)[0];r.hostId=oldest?oldest[0]:null}
io.on('connection',socket=>{let joined=null,lastUpdate=0;socket.on('room:join',payload=>{if(joined)return;const requested=payload&&typeof payload.room==='string'?payload.room:DEFAULT_ROOM;if(requested!==DEFAULT_ROOM)return socket.emit('room:error','Unknown game room.');const r=getRoom(DEFAULT_ROOM);if(r.players.size>=MAX_PLAYERS_PER_ROOM)return socket.emit('room:error','This room is full.');joined=DEFAULT_ROOM;socket.join(joined);r.players.set(socket.id,{joinedAt:Date.now()+Math.random()/1000,lastAcceptedAt:Date.now(),presence:{g:1,a:0,n:'Player',x:0,y:0,z:0,r:0,c:0,rg:0,e:0,mon:0,ca:0},codeAttempts:[],revealedNotes:new Set(),lastNoteRevealAt:0});electHost(r);broadcastRoom(joined)});
socket.on('code:note',index=>{if(!joined||!Number.isInteger(index)||index<0||index>3)return;const r=rooms.get(joined),p=r&&r.players.get(socket.id);if(!p||p.revealedNotes.has(index))return;const now=Date.now();if(now-p.lastNoteRevealAt<1200)return;p.lastNoteRevealAt=now;p.revealedNotes.add(index);const digit=Number(r.escapeCode[index]);socket.emit('code:note-result',{index,digit})});
socket.on('code:reset',()=>{if(!joined)return;const r=rooms.get(joined);if(!r)return;const now=Date.now();if(now-r.lastCodeResetAt<10000)return;r.escapeCode=makeCode();r.lastCodeResetAt=now});
socket.on('code:attempt',guess=>{if(!joined||typeof guess!=='string'||!/^\d{4}$/.test(guess))return;const r=rooms.get(joined),p=r&&r.players.get(socket.id);if(!p)return;const now=Date.now();p.codeAttempts=p.codeAttempts.filter(t=>now-t<60000);if(p.codeAttempts.length>=5){socket.emit('code:attempt-result',{ok:false,reason:'Too many guesses. Wait a minute.'});return}p.codeAttempts.push(now);const ok=guess===r.escapeCode;socket.emit('code:attempt-result',{ok,reason:ok?'':'Wrong code.'});});
socket.on('player:update',raw=>{if(!joined)return;const now=Date.now();if(now-lastUpdate<45)return;lastUpdate=now;const r=rooms.get(joined),player=r&&r.players.get(socket.id);if(!player)return;const requestedGru=!!(raw&&raw.mon);let allowGru=false;if(requestedGru&&raw&&raw.gk==='iloveArson'&&(!r.grusiverPeer||r.grusiverPeer===socket.id)){allowGru=true;r.grusiverPeer=socket.id}else if(r.grusiverPeer===socket.id){r.grusiverPeer=null}const clean=cleanPresence(raw,r.hostId===socket.id,allowGru);if(!clean)return;if(!allowGru)clean.mon=0;
// Server-side movement sanity checks: normal sprint/jump/knockback remain possible,
// while impossible teleports and sustained flight-height values are rejected.
const elapsed=Math.max(0.04,Math.min(0.25,(now-player.lastAcceptedAt)/1000));
const prev=player.presence||{x:clean.x,y:0,z:clean.z};
const horizontal=Math.hypot(clean.x-prev.x,clean.z-prev.z);
const maxHorizontal=19*elapsed+0.9;
if(horizontal>maxHorizontal){clean.x=prev.x;clean.z=prev.z;clean.r=prev.r||clean.r}
if(clean.y>1.85||Math.abs(clean.y-(prev.y||0))>1.7)clean.y=prev.y||0;
player.lastAcceptedAt=now;player.presence=clean;broadcastRoom(joined)});
socket.on('disconnect',()=>{if(!joined)return;const r=rooms.get(joined);if(!r)return;r.players.delete(socket.id);if(r.grusiverPeer===socket.id)r.grusiverPeer=null;electHost(r);if(!r.players.size)rooms.delete(joined);else broadcastRoom(joined)})});
server.listen(PORT,'0.0.0.0',()=>console.log(`Backrooms: Nextbots server listening on ${PORT}`));
