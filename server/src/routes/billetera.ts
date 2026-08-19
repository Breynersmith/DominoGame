// server/src/routes/billetera.ts

import { Router, Request, Response } from 'express';
import { Db, ajustarSaldo, listarTransacciones, obtenerSaldo } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { asyncero } from '../asyncero';

export function crearRouterBilletera(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  // GET /billetera -> saldo + transacciones
  r.get(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      res.json({ saldo: await obtenerSaldo(db, u.id), transacciones: await listarTransacciones(db, u.id) });
    }),
  );

  // POST /billetera/recargar { monto }
  r.post(
    '/recargar',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const monto = Math.floor(Number(req.body?.monto));
      if (!Number.isFinite(monto) || monto <= 0) {
        res.status(400).json({ error: 'monto_invalido' });
        return;
      }
      const saldo = await ajustarSaldo(db, u.id, monto, 'recarga', 'Recarga de saldo');
      res.json({ saldo, transacciones: await listarTransacciones(db, u.id) });
    }),
  );

  return r;
}
