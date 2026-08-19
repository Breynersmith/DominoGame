// server/src/index.ts
// Punto de entrada: servidor HTTP + Socket.IO contra Supabase.

import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import { Db, inicializarEsquema } from './db';
import { crearApp } from './app';
import { registrarSockets } from './sockets/salaManager';
import { asegurarBuckets, supabaseConfigurado } from './supabase';

async function arrancar(): Promise<void> {
  const PORT = Number(process.env.PORT ?? 3001);
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('Falta DATABASE_URL (cadena de conexión de Supabase Postgres)');
  }

  const db = Db.conectar(DATABASE_URL);
  await inicializarEsquema(db);
  await asegurarBuckets();

  const app = crearApp(db);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
  });
  registrarSockets(io, db);

  server.listen(PORT, () => {
    console.log(`Domino Club server en http://localhost:${PORT} (Supabase: ${supabaseConfigurado() ? 'sí' : 'NO'})`);
  });
}

arrancar().catch(e => {
  console.error(e);
  process.exit(1);
});
