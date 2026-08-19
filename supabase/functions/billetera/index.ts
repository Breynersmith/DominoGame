// supabase/functions/billetera/index.ts
// Saldo y transacciones.

import { Db, ajustarSaldo, listarTransacciones, obtenerSaldo } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';

const db = new Db();
const r = new Enrutador(db);

// GET /billetera -> saldo + transacciones
r.get('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  return json({ saldo: await obtenerSaldo(db, u.id), transacciones: await listarTransacciones(db, u.id) });
});

// POST /billetera/recargar { monto }
r.post('/recargar', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const monto = Math.floor(Number(ctx.cuerpo?.monto));
  if (!Number.isFinite(monto) || monto <= 0) {
    return errorJson('monto_invalido');
  }
  const saldo = await ajustarSaldo(db, u.id, monto, 'recarga', 'Recarga de saldo');
  return json({ saldo, transacciones: await listarTransacciones(db, u.id) });
});

Deno.serve((req) => r.manejar(req));