// supabase/functions/notificaciones/index.ts
// Notificaciones e invitaciones.

import { Db, crearNotificacion } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';

const db = new Db();
const r = new Enrutador(db, 'notificaciones');

async function notificacionesDe(usuarioId: number): Promise<unknown[]> {
  return db.query(
    'SELECT id, titulo, cuerpo, leida, creado_en AS fecha FROM notificaciones WHERE usuario_id = $1 ORDER BY id DESC LIMIT 100',
    [usuarioId],
  );
}

// GET /notificaciones
r.get('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  return json({ notificaciones: await notificacionesDe(u.id) });
});

// POST /notificaciones/invitar { nombre, codigo }
r.post('/invitar', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const nombre = String(ctx.cuerpo?.nombre ?? '').trim();
  const codigo = String(ctx.cuerpo?.codigo ?? '').trim();

  const objetivo = await db.one<{ id: number }>('SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1)', [
    nombre,
  ]);
  if (!objetivo) {
    return errorJson('usuario_no_encontrado', 404);
  }
  if (objetivo.id === u.id) {
    return errorJson('no_puedes_invitarte');
  }
  if (!/^[A-Z0-9]{4,8}$/.test(codigo)) {
    return errorJson('codigo_invalido');
  }

  await crearNotificacion(db, objetivo.id, `${u.nombre} te invita a jugar`, `Código de sala: ${codigo}`);
  return json({ ok: true });
});

// POST /notificaciones/:id/leida
r.post('/:id/leida', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const id = Number(ctx.params.id);
  await db.ejecutar('UPDATE notificaciones SET leida = 1 WHERE id = $1 AND usuario_id = $2', [id, u.id]);
  return json({ notificaciones: await notificacionesDe(u.id) });
});

// POST /notificaciones/leer-todas
r.post('/leer-todas', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  await db.ejecutar('UPDATE notificaciones SET leida = 1 WHERE usuario_id = $1', [u.id]);
  return json({ notificaciones: await notificacionesDe(u.id) });
});

// DELETE /notificaciones (borra todas)
r.delete('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  await db.ejecutar('DELETE FROM notificaciones WHERE usuario_id = $1', [u.id]);
  return json({ notificaciones: [] });
});

Deno.serve((req) => r.manejar(req));