// server/src/routes/billetera.ts

import { Router, Request, Response } from 'express';
import { Db, ajustarSaldo, listarTransacciones, obtenerSaldo } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';

export function crearRouterBilletera(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  // GET /billetera -> saldo + transacciones
  r.get('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    res.json({ saldo: obtenerSaldo(db, u.id), transacciones: listarTransacciones(db, u.id) });
  });

  // POST /billetera/recargar { monto }
  r.post('/recargar', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const monto = Math.floor(Number(req.body?.monto));
    if (!Number.isFinite(monto) || monto <= 0) {
      res.status(400).json({ error: 'monto_invalido' });
      return;
    }
    const saldo = ajustarSaldo(db, u.id, monto, 'recarga', 'Recarga de saldo');
    res.json({ saldo, transacciones: listarTransacciones(db, u.id) });
  });

  return r;
}