// server/src/routes/salas.ts

import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { asyncero } from '../asyncero';

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

  async function infoSala(codigo: string): Promise<unknown | null> {
    const sala = await db.one<{ [k: string]: unknown }>('SELECT * FROM salas WHERE codigo = $1', [codigo]);
    if (!sala) return null;
    const jugadores = await db.query(
      `SELECT u.id, u.nombre, u.color
       FROM sala_jugadores sj JOIN perfiles u ON u.id = sj.usuario_id
       WHERE sj.sala_id = $1 ORDER BY sj.creado_en`,
      [codigo],
    );
    return { ...sala, jugadores };
  }

  // POST /salas { nombre, apuesta }
  r.post(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const nombre = String(req.body?.nombre ?? `Sala de ${u.nombre}`).trim().slice(0, 24) || `Sala de ${u.nombre}`;
      const apuesta = Math.max(0, Math.floor(Number(req.body?.apuesta) || 0));
      if (apuesta > 0 && u.saldo < apuesta) {
        res.status(400).json({ error: 'sin_saldo' });
        return;
      }

      let codigo = generarCodigo();
      while (await db.one('SELECT 1 FROM salas WHERE codigo = $1', [codigo])) {
        codigo = generarCodigo();
      }

      await db.ejecutar(
        'INSERT INTO salas (codigo, nombre, apuesta, host_id, estado, creado_en) VALUES ($1, $2, $3, $4, $5, $6)',
        [codigo, nombre, apuesta, u.id, 'espera', ahora()],
      );
      await db.ejecutar('INSERT INTO sala_jugadores (sala_id, usuario_id, creado_en) VALUES ($1, $2, $3)', [
        codigo,
        u.id,
        ahora(),
      ]);

      res.status(201).json({ sala: await infoSala(codigo) });
    }),
  );

  // GET /salas -> salas en espera
  r.get(
    '/',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const salas = await db.query(
        `SELECT s.codigo, s.nombre, s.apuesta, s.host_id, s.estado,
                (SELECT COUNT(*)::int FROM sala_jugadores sj WHERE sj.sala_id = s.codigo) AS jugadores
         FROM salas s WHERE s.estado = 'espera' ORDER BY s.creado_en DESC LIMIT 50`,
      );
      res.json({ salas });
    }),
  );

  // GET /salas/:codigo
  r.get(
    '/:codigo',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const codigo = String(req.params.codigo).toUpperCase();
      const sala = await infoSala(codigo);
      if (!sala) {
        res.status(404).json({ error: 'sala_no_encontrada' });
        return;
      }
      res.json({ sala });
    }),
  );

  return r;
}
