// server/src/routes/pagos.ts
// Métodos de pago (opcionales): tarjeta, PayPal, cripto, etc.
// Solo se guardan datos enmascarados; nunca datos completos.

import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { limitador } from '../limiter';
import { asyncero } from '../asyncero';

const TIPOS_PAGO = ['tarjeta', 'paypal', 'cripto'] as const;
const PAGOS_MAX = 5;

export function crearRouterPagos(db: Db): Router {
  const r = Router();

  // GET /pagos → lista de métodos de pago del usuario.
  r.get(
    '/',
    requiereAuth(db),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const filas = await db.query<{
        id: number;
        tipo: string;
        datosEnmascarados: string;
        predeterminada: number;
      }>(
        'SELECT id, tipo, datos_enmascarados AS "datosEnmascarados", predeterminada FROM metodos_pago WHERE usuario_id = $1 ORDER BY predeterminada DESC, id ASC',
        [u.id],
      );
      res.json({
        pagos: filas.map(f => ({ id: f.id, tipo: f.tipo, datosEnmascarados: f.datosEnmascarados, predeterminada: f.predeterminada === 1 })),
      });
    }),
  );

  // POST /pagos { tipo, datosEnmascarados } → agrega un método.
  r.post(
    '/',
    requiereAuth(db),
    limitador({ clave: 'pagos', ventanaMs: 60 * 1000, max: 10 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const tipo = String(req.body?.tipo ?? '');
      const datosEnmascarados = String(req.body?.datosEnmascarados ?? '').trim();

      if (!(TIPOS_PAGO as readonly string[]).includes(tipo)) {
        res.status(400).json({ error: 'tipo_pago_invalido' });
        return;
      }
      if (datosEnmascarados.length < 4 || datosEnmascarados.length > 120) {
        res.status(400).json({ error: 'datos_pago_invalidos' });
        return;
      }
      const contador = await db.one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM metodos_pago WHERE usuario_id = $1',
        [u.id],
      );
      if ((contador?.n ?? 0) >= PAGOS_MAX) {
        res.status(400).json({ error: 'maximo_metodos_pago' });
        return;
      }
      const esPrimero = (contador?.n ?? 0) === 0;
      await db.ejecutar(
        'INSERT INTO metodos_pago (usuario_id, tipo, datos_enmascarados, predeterminada, creado_en) VALUES ($1, $2, $3, $4, $5)',
        [u.id, tipo, datosEnmascarados, esPrimero ? 1 : 0, ahora()],
      );
      res.status(201).json({ ok: true });
    }),
  );

  // DELETE /pagos/:id → elimina.
  r.delete(
    '/:id',
    requiereAuth(db),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const id = Number(req.params.id);
      const fila = await db.one<{ predeterminada: number }>(
        'SELECT predeterminada FROM metodos_pago WHERE id = $1 AND usuario_id = $2',
        [id, u.id],
      );
      if (!fila) {
        res.status(404).json({ error: 'pago_no_encontrado' });
        return;
      }
      await db.ejecutar('DELETE FROM metodos_pago WHERE id = $1 AND usuario_id = $2', [id, u.id]);
      if (fila.predeterminada === 1) {
        const primero = await db.one<{ id: number }>(
          'SELECT id FROM metodos_pago WHERE usuario_id = $1 ORDER BY id ASC LIMIT 1',
          [u.id],
        );
        if (primero) await db.ejecutar('UPDATE metodos_pago SET predeterminada = 1 WHERE id = $1', [primero.id]);
      }
      res.json({ ok: true });
    }),
  );

  // POST /pagos/:id/predeterminada → marca como método por defecto.
  r.post(
    '/:id/predeterminada',
    requiereAuth(db),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const id = Number(req.params.id);
      const existe = await db.one('SELECT id FROM metodos_pago WHERE id = $1 AND usuario_id = $2', [id, u.id]);
      if (!existe) {
        res.status(404).json({ error: 'pago_no_encontrado' });
        return;
      }
      await db.ejecutar('UPDATE metodos_pago SET predeterminada = 0 WHERE usuario_id = $1', [u.id]);
      await db.ejecutar('UPDATE metodos_pago SET predeterminada = 1 WHERE id = $1', [id]);
      res.json({ ok: true });
    }),
  );

  return r;
}
