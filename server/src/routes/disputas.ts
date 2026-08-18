// server/src/routes/disputas.ts

import { Router, Request, Response } from 'express';
import { Db, ahora, crearNotificacion } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';

export function crearRouterDisputas(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  // POST /disputas { mensaje }
  r.post('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const mensaje = String(req.body?.mensaje ?? '').trim();
    if (mensaje.length < 3) {
      res.status(400).json({ error: 'mensaje_corto' });
      return;
    }

    const info = db
      .prepare('INSERT INTO disputas (usuario_id, mensaje, estado, creado_en) VALUES (?, ?, ?, ?)')
      .run(u.id, mensaje, 'abierta', ahora());

    crearNotificacion(db, u.id, 'Disputa recibida', 'Hemos recibido tu consulta. Te responderemos pronto.');

    res.status(201).json({
      disputa: { id: Number(info.lastInsertRowid), mensaje, estado: 'abierta' },
    });
  });

  // GET /disputas (las propias)
  r.get('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const disputas = db
      .prepare('SELECT id, mensaje, estado, creado_en AS fecha FROM disputas WHERE usuario_id = ? ORDER BY id DESC')
      .all(u.id);
    res.json({ disputas });
  });

  return r;
}