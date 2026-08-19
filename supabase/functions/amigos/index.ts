// supabase/functions/amigos/index.ts
// Amigos (relación bidireccional simple).

import { Db, ahora } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';

const db = new Db();
const r = new Enrutador(db);

async function amigosDe(usuarioId: number): Promise<unknown[]> {
  return db.query(
    `SELECT u.id, u.nombre, u.color, a.creado_en AS desde
     FROM amigos a JOIN perfiles u ON u.id = a.amigo_id
     WHERE a.usuario_id = $1 ORDER BY u.nombre`,
    [usuarioId],
  );
}

// GET /amigos
r.get('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  return json({ amigos: await amigosDe(u.id) });
});

// POST /amigos { nombre }
r.post('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const nombre = String(ctx.cuerpo?.nombre ?? '').trim();

  const objetivo = await db.one<{ id: number }>('SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1)', [
    nombre,
  ]);
  if (!objetivo) {
    return errorJson('usuario_no_encontrado', 404);
  }
  if (objetivo.id === u.id) {
    return errorJson('no_puedes_agregarte');
  }
  const yaExiste = await db.one('SELECT 1 FROM amigos WHERE usuario_id = $1 AND amigo_id = $2', [
    u.id,
    objetivo.id,
  ]);
  if (yaExiste) {
    return errorJson('ya_es_amigo', 409);
  }

  const ahoraMs = ahora();
  await db.ejecutar(
    `INSERT INTO amigos (usuario_id, amigo_id, creado_en) VALUES ($1, $2, $3), ($2, $1, $3)
     ON CONFLICT DO NOTHING`,
    [u.id, objetivo.id, ahoraMs],
  );

  return json({ amigos: await amigosDe(u.id) }, 201);
});

// DELETE /amigos/:nombre
r.delete('/:nombre', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const nombre = String(ctx.params.nombre ?? '').trim();
  const objetivo = await db.one<{ id: number }>('SELECT id FROM perfiles WHERE LOWER(nombre) = LOWER($1)', [
    nombre,
  ]);
  if (!objetivo) {
    return errorJson('usuario_no_encontrado', 404);
  }
  await db.ejecutar(
    'DELETE FROM amigos WHERE (usuario_id = $1 AND amigo_id = $2) OR (usuario_id = $2 AND amigo_id = $1)',
    [u.id, objetivo.id],
  );
  return json({ amigos: await amigosDe(u.id) });
});

Deno.serve((req) => r.manejar(req));