// server/src/routes/amigos.ts

import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';

export function crearRouterAmigos(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  function amigosDe(usuarioId: number): unknown[] {
    return db
      .prepare(
        `SELECT u.id, u.nombre, u.color, a.creado_en AS desde
         FROM amigos a JOIN usuarios u ON u.id = a.amigo_id
         WHERE a.usuario_id = ? ORDER BY u.nombre`
      )
      .all(usuarioId);
  }

  // GET /amigos
  r.get('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    res.json({ amigos: amigosDe(u.id) });
  });

  // POST /amigos { nombre }
  r.post('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const nombre = String(req.body?.nombre ?? '').trim();

    const objetivo = db.prepare('SELECT id FROM usuarios WHERE nombre = ? COLLATE NOCASE').get(nombre) as
      | { id: number }
      | undefined;
    if (!objetivo) {
      res.status(404).json({ error: 'usuario_no_encontrado' });
      return;
    }
    if (objetivo.id === u.id) {
      res.status(400).json({ error: 'no_puedes_agregarte' });
      return;
    }
    const yaExiste = db.prepare('SELECT 1 FROM amigos WHERE usuario_id = ? AND amigo_id = ?').get(u.id, objetivo.id);
    if (yaExiste) {
      res.status(409).json({ error: 'ya_es_amigo' });
      return;
    }

    // Relación bidireccional simple
    const insertar = db.prepare('INSERT OR IGNORE INTO amigos (usuario_id, amigo_id, creado_en) VALUES (?, ?, ?)');
    insertar.run(u.id, objetivo.id, ahora());
    insertar.run(objetivo.id, u.id, ahora());

    res.status(201).json({ amigos: amigosDe(u.id) });
  });

  // DELETE /amigos/:nombre
  r.delete('/:nombre', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const nombre = String(req.params.nombre).trim();
    const objetivo = db.prepare('SELECT id FROM usuarios WHERE nombre = ? COLLATE NOCASE').get(nombre) as
      | { id: number }
      | undefined;
    if (!objetivo) {
      res.status(404).json({ error: 'usuario_no_encontrado' });
      return;
    }
    db.prepare('DELETE FROM amigos WHERE (usuario_id = ? AND amigo_id = ?) OR (usuario_id = ? AND amigo_id = ?)')
      .run(u.id, objetivo.id, objetivo.id, u.id);
    res.json({ amigos: amigosDe(u.id) });
  });

  return r;
}