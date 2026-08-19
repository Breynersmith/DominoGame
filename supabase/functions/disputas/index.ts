// supabase/functions/disputas/index.ts
// Disputas / soporte.

import { Db, ahora, crearNotificacion } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';

const db = new Db();
const r = new Enrutador(db);

// POST /disputas { mensaje }
r.post('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const mensaje = String(ctx.cuerpo?.mensaje ?? '').trim();
  if (mensaje.length < 3) {
    return errorJson('mensaje_corto');
  }

  const info = await db.one<{ id: number }>(
    'INSERT INTO disputas (usuario_id, mensaje, estado, creado_en) VALUES ($1, $2, $3, $4) RETURNING id',
    [u.id, mensaje, 'abierta', ahora()],
  );
  if (!info) {
    return errorJson('error_interno', 500);
  }

  await crearNotificacion(db, u.id, 'Disputa recibida', 'Hemos recibido tu consulta. Te responderemos pronto.');

  return json({ disputa: { id: info.id, mensaje, estado: 'abierta' } }, 201);
});

// GET /disputas (las propias)
r.get('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const disputas = await db.query(
    'SELECT id, mensaje, estado, creado_en AS fecha FROM disputas WHERE usuario_id = $1 ORDER BY id DESC',
    [u.id],
  );
  return json({ disputas });
});

Deno.serve((req) => r.manejar(req));