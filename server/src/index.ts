// server/src/index.ts
// Punto de entrada: servidor HTTP + Socket.IO.

import http from 'http';
import { Server } from 'socket.io';
import { crearDb } from './db';
import { crearApp } from './app';
import { registrarSockets } from './sockets/salaManager';

const PORT = Number(process.env.PORT ?? 3001);
const DB_PATH = process.env.DB_PATH ?? 'data/domino.db';

const db = crearDb(DB_PATH);
const app = crearApp(db);
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});
registrarSockets(io, db);

server.listen(PORT, () => {
  console.log(`Domino Club server en http://localhost:${PORT} (db: ${DB_PATH})`);
});