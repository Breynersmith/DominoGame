// server/src/routes/notificaciones.ts

import { Router, Request, Response } from 'express';
import { Db, crearNotificacion } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { asyncero } from '../asyncero';

export function crearRouterNotificaciones(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  async function notificacionesDe(usuarioId: number): Promise<unknown[]> {
    return db.query(
      'SELECT id, titulo, cuerpo, leida, creado_en AS fecha FROM notificaciones WHERE usuario_id = $1 ORDER BY id DESC LIMIT 100',
      [usuarioId],
    );
  }

  // GET /notificaciones
  r.get(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      res.json({ notificaciones: await notificacionesDe(u.id) });
    }),
  );

  // POST /notificaciones/invitar { nombre, codigo }
  // Envía una invitación a una sala a un amigo por su nombre de usuario.
  r.post(
    '/invitar',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const nombre = String(req.body?.nombre ?? '').trim();
      const codigo = String(req.body?.codigo ?? '').trim();

      const objetivo = await db.one<{ id: number }>(
        'SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1)',
        [nombre],
      );
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

      await crearNotificacion(db, objetivo.id, `${u.nombre} te invita a jugar`, `Código de sala: ${codigo}`);
      res.json({ ok: true });
    }),
  );

  // POST /notificaciones/:id/leida
  r.post(
    '/:id/leida',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const id = Number(req.params.id);
      await db.ejecutar('UPDATE notificaciones SET leida = 1 WHERE id = $1 AND usuario_id = $2', [id, u.id]);
      res.json({ notificaciones: await notificacionesDe(u.id) });
    }),
  );

  // POST /notificaciones/leer-todas
  r.post(
    '/leer-todas',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      await db.ejecutar('UPDATE notificaciones SET leida = 1 WHERE usuario_id = $1', [u.id]);
      res.json({ notificaciones: await notificacionesDe(u.id) });
    }),
  );

  // DELETE /notificaciones (borra todas)
  r.delete(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      await db.ejecutar('DELETE FROM notificaciones WHERE usuario_id = $1', [u.id]);
      res.json({ notificaciones: [] });
    }),
  );

  return r;
}
