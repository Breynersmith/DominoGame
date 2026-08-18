// server/src/routes/usuarios.ts

import { Router, Request, Response } from 'express';
import { Db, ahora, listarTransacciones } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';

export function crearRouterUsuarios(db: Db): Router {
  const r = Router();
  r.use(requiereAuth(db));

  // GET /usuarios/yo -> perfil + saldo + transacciones
  r.get('/yo', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    res.json({
      usuario: u,
      transacciones: listarTransacciones(db, u.id),
    });
  });

  // PUT /usuarios/yo { nombre?, color?, foto? }
  r.put('/yo', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const nombre = req.body?.nombre !== undefined ? String(req.body.nombre).trim() : undefined;
    const color = req.body?.color !== undefined ? String(req.body.color) : undefined;
    const foto = req.body?.foto !== undefined ? String(req.body.foto) : undefined;

    if (nombre !== undefined) {
      if (nombre.length < 2 || nombre.length > 18) {
        res.status(400).json({ error: 'nombre_invalido' });
        return;
      }
      const repetido = db.prepare('SELECT id FROM usuarios WHERE nombre = ? COLLATE NOCASE AND id != ?').get(nombre, u.id);
      if (repetido) {
        res.status(409).json({ error: 'nombre_en_uso' });
        return;
      }
    }

    if (foto !== undefined) {
      // Foto de perfil como data URI (p. ej. data:image/jpeg;base64,...).
      // Una cadena vacía quita la foto.
      if (foto !== '' && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 500_000)) {
        res.status(400).json({ error: 'foto_invalida' });
        return;
      }
    }

    let sql = 'UPDATE usuarios SET nombre = COALESCE(?, nombre), color = COALESCE(?, color)';
    const params: Array<string | number | null> = [nombre ?? null, color ?? null];
    if (foto !== undefined) {
      // '' quita la foto; de lo contrario se guarda la data URI.
      sql += ', foto = ?';
      params.push(foto === '' ? null : foto);
    }
    sql += ' WHERE id = ?';
    params.push(u.id);
    db.prepare(sql).run(...params);

    const fila = db.prepare('SELECT id, nombre, color, saldo, foto FROM usuarios WHERE id = ?').get(u.id) as {
      id: number;
      nombre: string;
      color: string;
      saldo: number;
      foto?: string | null;
    };
    res.json({ usuario: fila });
  });

  // GET /usuarios/buscar?q= -> usuarios que coinciden (excluye a uno mismo)
  r.get('/buscar', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const q = String(req.query.q ?? '').trim();
    if (q.length === 0) {
      res.json({ resultados: [] });
      return;
    }
    const resultados = db
      .prepare('SELECT id, nombre, color FROM usuarios WHERE nombre LIKE ? COLLATE NOCASE AND id != ? ORDER BY nombre LIMIT 20')
      .all(`%${q}%`, u.id);
    res.json({ resultados });
  });

  // GET /usuarios/por-nombre/:nombre -> ficha de un usuario (para agregar amigos)
  r.get('/por-nombre/:nombre', (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const nombre = String(req.params.nombre).trim();
    const fila = db
      .prepare('SELECT id, nombre, color FROM usuarios WHERE nombre = ? COLLATE NOCASE AND id != ?')
      .get(nombre, u.id);
    if (!fila) {
      res.status(404).json({ error: 'usuario_no_encontrado' });
      return;
    }
    res.json({ usuario: fila });
  });

  return r;
}