// server/src/routes/amigos.ts

import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { asyncero } from '../asyncero';

export function crearRouterAmigos(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  async function amigosDe(usuarioId: number): Promise<unknown[]> {
    return db.query(
      `SELECT u.id, u.nombre, u.color, a.creado_en AS desde
       FROM amigos a JOIN perfiles u ON u.id = a.amigo_id
       WHERE a.usuario_id = $1 ORDER BY u.nombre`,
      [usuarioId],
    );
  }

  // GET /amigos
  r.get(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      res.json({ amigos: await amigosDe(u.id) });
    }),
  );

  // POST /amigos { nombre }
  r.post(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const nombre = String(req.body?.nombre ?? '').trim();

      const objetivo = await db.one<{ id: number }>(
        'SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1)',
        [nombre],
      );
      if (!objetivo) {
        res.status(404).json({ error: 'usuario_no_encontrado' });
        return;
      }
      if (objetivo.id === u.id) {
        res.status(400).json({ error: 'no_puedes_agregarte' });
        return;
      }
      const yaExiste = await db.one('SELECT 1 FROM amigos WHERE usuario_id = $1 AND amigo_id = $2', [
        u.id,
        objetivo.id,
      ]);
      if (yaExiste) {
        res.status(409).json({ error: 'ya_es_amigo' });
        return;
      }

      // Relación bidireccional simple
      const ahoraMs = ahora();
      await db.ejecutar(
        `INSERT INTO amigos (usuario_id, amigo_id, creado_en) VALUES ($1, $2, $3), ($2, $1, $3)
         ON CONFLICT DO NOTHING`,
        [u.id, objetivo.id, ahoraMs],
      );

      res.status(201).json({ amigos: await amigosDe(u.id) });
    }),
  );

  // DELETE /amigos/:nombre
  r.delete(
    '/:nombre',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const nombre = String(req.params.nombre).trim();
      const objetivo = await db.one<{ id: number }>(
        'SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1)',
        [nombre],
      );
      if (!objetivo) {
        res.status(404).json({ error: 'usuario_no_encontrado' });
        return;
      }
      await db.ejecutar(
        'DELETE FROM amigos WHERE (usuario_id = $1 AND amigo_id = $2) OR (usuario_id = $2 AND amigo_id = $1)',
        [u.id, objetivo.id],
      );
      res.json({ amigos: await amigosDe(u.id) });
    }),
  );

  return r;
}
