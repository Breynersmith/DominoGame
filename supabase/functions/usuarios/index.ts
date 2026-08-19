// supabase/functions/usuarios/index.ts
// Perfil del usuario, edición y búsqueda.

import { Db, listarTransacciones } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';
import { subirImagen } from '../_shared/supabase.ts';

const FOTO_REGEX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const FOTO_MAX = 500_000;

const db = new Db();
const r = new Enrutador(db);

// GET /usuarios/yo -> perfil + saldo + transacciones
r.get('/yo', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  return json({ usuario: u, transacciones: await listarTransacciones(db, u.id) });
});

// PUT /usuarios/yo { nombre?, color?, foto? }
r.put('/yo', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const nombre = ctx.cuerpo?.nombre !== undefined ? String(ctx.cuerpo.nombre).trim() : undefined;
  const color = ctx.cuerpo?.color !== undefined ? String(ctx.cuerpo.color) : undefined;
  const foto = ctx.cuerpo?.foto !== undefined ? String(ctx.cuerpo.foto) : undefined;

  if (nombre !== undefined) {
    if (nombre.length < 2 || nombre.length > 18) {
      return errorJson('nombre_invalido');
    }
    const repetido = await db.one('SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1) AND id != $2', [
      nombre,
      u.id,
    ]);
    if (repetido) {
      return errorJson('nombre_en_uso', 409);
    }
  }

  let fotoFinal: string | null | undefined;
  if (foto !== undefined) {
    if (foto === '') {
      fotoFinal = null; // quita la foto
    } else {
      if (!FOTO_REGEX.test(foto) || foto.length > FOTO_MAX) {
        return errorJson('foto_invalida');
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

  const fila = await db.one<{ id: number; nombre: string; color: string; saldo: number; foto?: string | null }>(
    'SELECT id, nombre, color, saldo, foto_url AS foto FROM perfiles WHERE id = $1',
    [u.id],
  );
  return json({ usuario: fila });
});

// GET /usuarios/buscar?q= -> usuarios que coinciden (excluye a uno mismo)
r.get('/buscar', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const q = String(ctx.query.get('q') ?? '').trim();
  if (q.length === 0) {
    return json({ resultados: [] });
  }
  const resultados = await db.query(
    'SELECT id, nombre, color FROM perfiles WHERE nombre ILIKE $1 AND id != $2 ORDER BY nombre LIMIT 20',
    [`%${q}%`, u.id],
  );
  return json({ resultados });
});

// GET /usuarios/por-nombre/:nombre -> ficha de un usuario (para agregar amigos)
r.get('/por-nombre/:nombre', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const nombre = String(ctx.params.nombre ?? '').trim();
  const fila = await db.one(
    'SELECT id, nombre, color FROM perfiles WHERE LOWER(nombre) = LOWER($1) AND id != $2',
    [nombre, u.id],
  );
  if (!fila) {
    return errorJson('usuario_no_encontrado', 404);
  }
  return json({ usuario: fila });
});

Deno.serve((req) => r.manejar(req));