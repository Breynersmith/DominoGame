// server/src/routes/usuarios.ts

import { Router, Request, Response } from 'express';
import { Db, listarTransacciones } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { subirImagen } from '../supabase';
import { asyncero } from '../asyncero';

const FOTO_REGEX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const FOTO_MAX = 500_000;

export function crearRouterUsuarios(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  // GET /usuarios/yo -> perfil + saldo + transacciones
  r.get(
    '/yo',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      res.json({
        usuario: u,
        transacciones: await listarTransacciones(db, u.id),
      });
    }),
  );

  // PUT /usuarios/yo { nombre?, color?, foto? }
  // La foto se acepta como data URI (se sube a Supabase Storage) o cadena vacía
  // para quitarla.
  r.put(
    '/yo',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const nombre = req.body?.nombre !== undefined ? String(req.body.nombre).trim() : undefined;
      const color = req.body?.color !== undefined ? String(req.body.color) : undefined;
      const foto = req.body?.foto !== undefined ? String(req.body.foto) : undefined;

      if (nombre !== undefined) {
        if (nombre.length < 2 || nombre.length > 18) {
          res.status(400).json({ error: 'nombre_invalido' });
          return;
        }
        const repetido = await db.one(
          'SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1) AND id != $2',
          [nombre, u.id],
        );
        if (repetido) {
          res.status(409).json({ error: 'nombre_en_uso' });
          return;
        }
      }

      let fotoFinal: string | null | undefined;
      if (foto !== undefined) {
        if (foto === '') {
          fotoFinal = null; // quita la foto
        } else {
          if (!FOTO_REGEX.test(foto) || foto.length > FOTO_MAX) {
            res.status(400).json({ error: 'foto_invalida' });
            return;
          }
          fotoFinal = await subirImagen(foto, `perfil/${u.id}-${Date.now()}.jpg`);
        }
      }

      const cambios: string[] = [];
      const params: unknown[] = [];
      if (nombre !== undefined) {
        cambios.push(`nombre = COALESCE($${params.length + 1}, nombre)`);
        params.push(nombre);
      }
      if (color !== undefined) {
        cambios.push(`color = COALESCE($${params.length + 1}, color)`);
        params.push(color);
      }
      if (foto !== undefined) {
        cambios.push(`foto_url = $${params.length + 1}`);
        params.push(fotoFinal);
      }
      params.push(u.id);
      if (cambios.length > 0) {
        await db.ejecutar(`UPDATE perfiles SET ${cambios.join(', ')} WHERE id = $${params.length}`, params);
      }

      const fila = await db.one<{
        id: number;
        nombre: string;
        color: string;
        saldo: number;
        foto?: string | null;
      }>('SELECT id, nombre, color, saldo, foto_url AS foto FROM perfiles WHERE id = $1', [u.id]);
      res.json({ usuario: fila });
    }),
  );

  // GET /usuarios/buscar?q= -> usuarios que coinciden (excluye a uno mismo)
  r.get(
    '/buscar',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const q = String(req.query.q ?? '').trim();
      if (q.length === 0) {
        res.json({ resultados: [] });
        return;
      }
      const resultados = await db.query(
        'SELECT id, nombre, color FROM perfiles WHERE nombre ILIKE $1 AND id != $2 ORDER BY nombre LIMIT 20',
        [`%${q}%`, u.id],
      );
      res.json({ resultados });
    }),
  );

  // GET /usuarios/por-nombre/:nombre -> ficha de un usuario (para agregar amigos)
  r.get(
    '/por-nombre/:nombre',
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const nombre = String(req.params.nombre).trim();
      const fila = await db.one(
        'SELECT id, nombre, color FROM perfiles WHERE LOWER(nombre) = LOWER($1) AND id != $2',
        [nombre, u.id],
      );
      if (!fila) {
        res.status(404).json({ error: 'usuario_no_encontrado' });
        return;
      }
      res.json({ usuario: fila });
    }),
  );

  return r;
}
