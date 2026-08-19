// server/src/app.ts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Db } from './db';
import { crearRouterAuth } from './routes/auth';
import { crearRouterUsuarios } from './routes/usuarios';
import { crearRouterBilletera } from './routes/billetera';
import { crearRouterAmigos } from './routes/amigos';
import { crearRouterNotificaciones } from './routes/notificaciones';
import { crearRouterDisputas } from './routes/disputas';
import { crearRouterSalas } from './routes/salas';
import { crearRouterKyc } from './routes/kyc';
import { crearRouterPagos } from './routes/pagos';

export function crearApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/auth', crearRouterAuth(db));
  app.use('/usuarios', crearRouterUsuarios(db));
  app.use('/billetera', crearRouterBilletera(db));
  app.use('/amigos', crearRouterAmigos(db));
  app.use('/notificaciones', crearRouterNotificaciones(db));
  app.use('/disputas', crearRouterDisputas(db));
  app.use('/salas', crearRouterSalas(db));
  app.use('/kyc', crearRouterKyc(db));
  app.use('/pagos', crearRouterPagos(db));

  // Manejador central de errores (para handlers async que fallen).
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'error_interno' });
  });

  return app;
}
