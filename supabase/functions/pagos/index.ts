// supabase/functions/pagos/index.ts
// Métodos de pago (opcionales): tarjeta, PayPal, cripto, etc.
// Solo se guardan datos enmascarados; nunca datos completos.

import { Db, ahora } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';
import { permitido } from '../_shared/limiter.ts';

const TIPOS_PAGO = ['tarjeta', 'paypal', 'cripto'] as const;
const PAGOS_MAX = 5;

const db = new Db();
const r = new Enrutador(db);

// GET /pagos → lista de métodos de pago del usuario.
r.get('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const filas = await db.query<{
    id: number;
    tipo: string;
    datosEnmascarados: string;
    predeterminada: number;
  }>(
    'SELECT id, tipo, datos_enmascarados AS "datosEnmascarados", predeterminada FROM metodos_pago WHERE usuario_id = $1 ORDER BY predeterminada DESC, id ASC',
    [u.id],
  );
  return json({
    pagos: filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      datosEnmascarados: f.datosEnmascarados,
      predeterminada: f.predeterminada === 1,
    })),
  });
});

// POST /pagos { tipo, datosEnmascarados } → agrega un método.
r.post('/', true, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'pagos', ventanaMs: 60 * 1000, max: 10 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const u = ctx.usuario!;
  const tipo = String(ctx.cuerpo?.tipo ?? '');
  const datosEnmascarados = String(ctx.cuerpo?.datosEnmascarados ?? '').trim();

  if (!(TIPOS_PAGO as readonly string[]).includes(tipo)) {
    return errorJson('tipo_pago_invalido');
  }
  if (datosEnmascarados.length < 4 || datosEnmascarados.length > 120) {
    return errorJson('datos_pago_invalidos');
  }
  const contador = await db.one<{ n: number }>('SELECT COUNT(*) AS n FROM metodos_pago WHERE usuario_id = $1', [
    u.id,
  ]);
  if ((contador?.n ?? 0) >= PAGOS_MAX) {
    return errorJson('maximo_metodos_pago');
  }
  const esPrimero = (contador?.n ?? 0) === 0;
  await db.ejecutar(
    'INSERT INTO metodos_pago (usuario_id, tipo, datos_enmascarados, predeterminada, creado_en) VALUES ($1, $2, $3, $4, $5)',
    [u.id, tipo, datosEnmascarados, esPrimero ? 1 : 0, ahora()],
  );
  return json({ ok: true }, 201);
});

// DELETE /pagos/:id → elimina.
r.delete('/:id', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const id = Number(ctx.params.id);
  const fila = await db.one<{ predeterminada: number }>(
    'SELECT predeterminada FROM metodos_pago WHERE id = $1 AND usuario_id = $2',
    [id, u.id],
  );
  if (!fila) {
    return errorJson('pago_no_encontrado', 404);
  }
  await db.ejecutar('DELETE FROM metodos_pago WHERE id = $1 AND usuario_id = $2', [id, u.id]);
  if (fila.predeterminada === 1) {
    const primero = await db.one<{ id: number }>(
      'SELECT id FROM metodos_pago WHERE usuario_id = $1 ORDER BY id ASC LIMIT 1',
      [u.id],
    );
    if (primero) await db.ejecutar('UPDATE metodos_pago SET predeterminada = 1 WHERE id = $1', [primero.id]);
  }
  return json({ ok: true });
});

// POST /pagos/:id/predeterminada → marca como método por defecto.
r.post('/:id/predeterminada', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const id = Number(ctx.params.id);
  const existe = await db.one('SELECT id FROM metodos_pago WHERE id = $1 AND usuario_id = $2', [id, u.id]);
  if (!existe) {
    return errorJson('pago_no_encontrado', 404);
  }
  await db.ejecutar('UPDATE metodos_pago SET predeterminada = 0 WHERE usuario_id = $1', [u.id]);
  await db.ejecutar('UPDATE metodos_pago SET predeterminada = 1 WHERE id = $1', [id]);
  return json({ ok: true });
});

Deno.serve((req) => r.manejar(req));