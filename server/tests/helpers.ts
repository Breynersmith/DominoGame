// server/tests/helpers.ts
// Utilidades para levantar el servidor en memoria en los tests.

import http from 'http';
import supertest from 'supertest';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { crearApp } from '../src/app';
import { crearDb, Db } from '../src/db';
import { registrarSockets } from '../src/sockets/salaManager';

export interface ServidorPrueba {
  db: Db;
  app: ReturnType<typeof crearApp>;
  server: http.Server;
  io: Server;
  cerrar: () => Promise<void>;
}

export function crearServidor(): ServidorPrueba {
  const db = crearDb(':memory:');
  const app = crearApp(db);
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true } });
  registrarSockets(io, db);
  return {
    db,
    app,
    server,
    io,
    cerrar: () =>
      new Promise<void>(resolve => {
        io.close(() => {
          server.close(() => {
            db.close();
            resolve();
          });
        });
      }),
  };
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