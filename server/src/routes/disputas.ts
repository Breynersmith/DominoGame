// server/src/routes/disputas.ts

import { Router, Request, Response } from 'express';
import { Db, ahora, crearNotificacion } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { asyncero } from '../asyncero';

export function crearRouterDisputas(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  // POST /disputas { mensaje }
  r.post(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const mensaje = String(req.body?.mensaje ?? '').trim();
      if (mensaje.length < 3) {
        res.status(400).json({ error: 'mensaje_corto' });
        return;
      }

      const info = (await db.one<{ id: number }>(
        'INSERT INTO disputas (usuario_id, mensaje, estado, creado_en) VALUES ($1, $2, $3, $4) RETURNING id',
        [u.id, mensaje, 'abierta', ahora()],
      ))!;

      await crearNotificacion(db, u.id, 'Disputa recibida', 'Hemos recibido tu consulta. Te responderemos pronto.');

      res.status(201).json({
        disputa: { id: info.id, mensaje, estado: 'abierta' },
      });
    }),
  );

  // GET /disputas (las propias)
  r.get(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const disputas = await db.query(
        'SELECT id, mensaje, estado, creado_en AS fecha FROM disputas WHERE usuario_id = $1 ORDER BY id DESC',
        [u.id],
      );
      res.json({ disputas });
    }),
  );

  return r;
}
