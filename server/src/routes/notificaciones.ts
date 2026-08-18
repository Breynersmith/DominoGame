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

  // POST /notificaciones/invitar { nombre, codigo }
  // Envía una invitación a una sala a un amigo por su nombre de usuario.
  r.post('/invitar', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const nombre = String(req.body?.nombre ?? '').trim();
    const codigo = String(req.body?.codigo ?? '').trim();

    const objetivo = db.prepare('SELECT id FROM usuarios WHERE nombre = ? COLLATE NOCASE').get(nombre) as
      | { id: number }
      | undefined;
    if (!objetivo) {
      res.status(404).json({ error: 'usuario_no_encontrado' });
      return;
    }
    if (objetivo.id === u.id) {
      res.status(400).json({ error: 'no_puedes_invitarte' });
      return;
    }
    if (!/^[A-Z0-9]{4,8}$/.test(codigo)) {
      res.status(400).json({ error: 'codigo_invalido' });
      return;
    }

    crearNotificacion(db, objetivo.id, `${u.nombre} te invita a jugar`, `Código de sala: ${codigo}`);
    res.json({ ok: true });
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