// server/src/routes/notificaciones.ts

import { Router, Request, Response } from 'express';
import { Db, crearNotificacion } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';

export function crearRouterNotificaciones(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  function notificacionesDe(usuarioId: number): unknown[] {
    return db
      .prepare('SELECT id, titulo, cuerpo, leida, creado_en AS fecha FROM notificaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT 100')
      .all(usuarioId);
  }

  // GET /notificaciones
  r.get('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    res.json({ notificaciones: notificacionesDe(u.id) });
  });

  // POST /notificaciones/:id/leida
  r.post('/:id/leida', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const id = Number(req.params.id);
    db.prepare('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?').run(id, u.id);
    res.json({ notificaciones: notificacionesDe(u.id) });
  });

  // POST /notificaciones/leer-todas
  r.post('/leer-todas', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    db.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?').run(u.id);
    res.json({ notificaciones: notificacionesDe(u.id) });
  });

  // DELETE /notificaciones (borra todas)
  r.delete('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    db.prepare('DELETE FROM notificaciones WHERE usuario_id = ?').run(u.id);
    res.json({ notificaciones: [] });
  });

  return r;
}