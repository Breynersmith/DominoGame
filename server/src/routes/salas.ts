// server/src/routes/salas.ts

import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';

const CODIGO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigo(longitud = 6): string {
  let codigo = '';
  for (let i = 0; i < longitud; i++) {
    codigo += CODIGO_CHARS[Math.floor(Math.random() * CODIGO_CHARS.length)];
  }
  return codigo;
}

export function crearRouterSalas(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  function infoSala(codigo: string): unknown {
    const sala = db.prepare('SELECT * FROM salas WHERE codigo = ?').get(codigo);
    if (!sala) return null;
    const jugadores = db
      .prepare(
        `SELECT u.id, u.nombre, u.color
         FROM sala_jugadores sj JOIN usuarios u ON u.id = sj.usuario_id
         WHERE sj.sala_id = ? ORDER BY sj.creado_en`
      )
      .all(codigo);
    return { ...sala, jugadores };
  }

  // POST /salas { nombre, apuesta }
  r.post('/', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const nombre = String(req.body?.nombre ?? `Sala de ${u.nombre}`).trim().slice(0, 24) || `Sala de ${u.nombre}`;
    const apuesta = Math.max(0, Math.floor(Number(req.body?.apuesta) || 0));
    if (apuesta > 0 && u.saldo < apuesta) {
      res.status(400).json({ error: 'sin_saldo' });
      return;
    }

    let codigo = generarCodigo();
    while (db.prepare('SELECT 1 FROM salas WHERE codigo = ?').get(codigo)) {
      codigo = generarCodigo();
    }

    db.prepare('INSERT INTO salas (codigo, nombre, apuesta, host_id, estado, creado_en) VALUES (?, ?, ?, ?, ?, ?)')
      .run(codigo, nombre, apuesta, u.id, 'espera', ahora());
    db.prepare('INSERT INTO sala_jugadores (sala_id, usuario_id, creado_en) VALUES (?, ?, ?)')
      .run(codigo, u.id, ahora());

    res.status(201).json({ sala: infoSala(codigo) });
  });

  // GET /salas -> salas en espera
  r.get('/', (req: Request, res: Response): void => {
    const salas = db
      .prepare(
        `SELECT s.codigo, s.nombre, s.apuesta, s.host_id, s.estado,
                (SELECT COUNT(*) FROM sala_jugadores sj WHERE sj.sala_id = s.codigo) AS jugadores
         FROM salas s WHERE s.estado = 'espera' ORDER BY s.creado_en DESC LIMIT 50`
      )
      .all();
    res.json({ salas });
  });

  // GET /salas/:codigo
  r.get('/:codigo', (req: Request, res: Response): void => {
    const codigo = String(req.params.codigo).toUpperCase();
    const sala = infoSala(codigo);
    if (!sala) {
      res.status(404).json({ error: 'sala_no_encontrada' });
      return;
    }
    res.json({ sala });
  });

  return r;
}