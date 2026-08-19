// server/tests/helpers.ts
// Utilidades para levantar el servidor contra una base Supabase real en los
// tests. Si no hay credenciales configuradas, los tests se saltan (ver
// `describeSupabase` y `supabaseConfigurado`).

import { describe } from 'vitest';
import http from 'http';
import { Pool } from 'pg';
import supertest from 'supertest';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { crearApp } from '../src/app';
import { Db, inicializarEsquema } from '../src/db';
import { registrarSockets, SalaManager } from '../src/sockets/salaManager';
import { supabaseConfigurado, asegurarBuckets } from '../src/supabase';
import { reiniciarLimitador } from '../src/limiter';

let poolCompartido: Pool | null = null;

// Devuelve un Db que comparte un único pool por proceso.
export function baseDatosDePrueba(): Db {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error('Falta DATABASE_URL para los tests de Supabase');
  if (!poolCompartido) poolCompartido = new Pool({ connectionString: cs, max: 5, ssl: { rejectUnauthorized: false } });
  return new Db(poolCompartido, false);
}

export function cerrarPool(): Promise<void> {
  if (poolCompartido) {
    const p = poolCompartido;
    poolCompartido = null;
    return p.end();
  }
  return Promise.resolve();
}

// Vacía todas las tablas y los usuarios de Supabase Auth para aislar los tests.
export async function limpiarBase(db: Db): Promise<void> {
  await db.ejecutar('DELETE FROM auth.users').catch(() => {});
  await db
    .ejecutar(
      'TRUNCATE TABLE codigos_otp, sessions_pendientes, sala_jugadores, salas, amigos, notificaciones, disputas, transacciones, metodos_pago, perfiles CASCADE',
    )
    .catch(() => {});
}

export interface ServidorPrueba {
  db: Db;
  app: ReturnType<typeof crearApp>;
  server: http.Server;
  io: Server;
  manager: SalaManager;
  cerrar: () => Promise<void>;
}

export async function crearServidor(): Promise<ServidorPrueba> {
  const db = baseDatosDePrueba();
  await inicializarEsquema(db);
  await limpiarBase(db);
  await asegurarBuckets();
  const app = crearApp(db);
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true } });
  const manager = registrarSockets(io, db);
  reiniciarLimitador();
  return {
    db,
    app,
    server,
    io,
    manager,
    cerrar: () =>
      new Promise<void>(resolve => {
        manager.cerrar();
        io.close(() => {
          server.close(() => resolve());
        });
      }),
  };
}

// Equivalente al `beforeEach` de los tests antiguos con SQLite: deja un Db y
// una app limpios (esquema aplicado y base vacía).
export async function prepararServidor(): Promise<{ db: Db; app: ReturnType<typeof crearApp>; cerrar: () => void }> {
  const db = baseDatosDePrueba();
  await inicializarEsquema(db);
  await limpiarBase(db);
  await asegurarBuckets();
  const app = crearApp(db);
  reiniciarLimitador();
  return { db, app, cerrar: () => void db.cerrar() };
}

let contadorUsuarios = 0;

// Registra un usuario completo (con verificación por SMS y pregunta de seguridad) y devuelve el token.
export async function registrarUsuario(
  app: ReturnType<typeof crearApp>,
  nombre: string,
  opciones?: { telefono?: string; email?: string; preguntaSeguridad?: string; respuestaSeguridad?: string; dosFactores?: boolean },
): Promise<{ token: string; usuario: { id: number; nombre: string; saldo: number } }> {
  contadorUsuarios += 1;
  const telefono = opciones?.telefono ?? `+3460000${String(contadorUsuarios).padStart(5, '0')}`;
  const email = opciones?.email ?? `usuario${contadorUsuarios}@test.com`;
  const sms = await supertest(app).post('/auth/sms/enviar').send({ telefono });
  if (sms.status !== 200) throw new Error(`no se pudo enviar el OTP: ${JSON.stringify(sms.body)}`);
  const codigo = sms.body.codigo as string;

  const res = await supertest(app).post('/auth/registro').send({
    nombre,
    nombreCompleto: `${nombre} Completo`,
    email,
    telefono,
    password: 'Clave123',
    color: '#2563eb',
    fechaNacimiento: '1990-01-01',
    pais: 'España',
    terminosAceptados: true,
    codigoOtp: codigo,
    preguntaSeguridad: opciones?.preguntaSeguridad ?? 'nombre_mascota',
    respuestaSeguridad: opciones?.respuestaSeguridad ?? 'Rex',
    dosFactores: opciones?.dosFactores ?? false,
  });
  if (res.status !== 201) throw new Error(`registro falló: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, usuario: res.body.usuario };
}

export function escuchar(server: http.Server): Promise<string> {
  return new Promise(resolve => {
    server.listen(0, () => {
      const addr = server.address();
      resolve(`http://localhost:${typeof addr === 'object' && addr ? addr.port : 3001}`);
    });
  });
}

export function conectar(url: string, token: string): Promise<import('socket.io-client').Socket> {
  return new Promise((resolve, reject) => {
    const socket = Client(url, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', err => reject(err));
  });
}

export function esperarEvento<T = unknown>(
  socket: import('socket.io-client').Socket,
  evento: string,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(evento, onEvento);
      reject(new Error(`Timeout esperando "${evento}"`));
    }, timeoutMs);
    const onEvento = (data: T) => {
      clearTimeout(timer);
      resolve(data);
    };
    socket.once(evento, onEvento);
  });
}

// Los tests de Supabase solo se ejecutan si hay credenciales configuradas.
export const describeSupabase = supabaseConfigurado() ? describe : describe.skip;
