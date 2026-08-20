// supabase/functions/salas/index.ts
// Salas y partidas en línea. Las mutaciones se hacen con POST; los clientes
// reciben los cambios por Supabase Realtime (postgres_changes sobre
// `salas`, `partidas` y `chat_mensajes`).

import { Db, ahora } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';
import {
  abandonarPartida,
  chat,
  crearSala,
  empezar,
  esperar,
  historialChat,
  jugadoresDe,
  jugar,
  leerPartida,
  leerSala,
  pasar,
  robar,
  salirSala,
  snapshotSala,
  unirseSala,
} from '../_shared/sala.ts';

const db = new Db();
const r = new Enrutador(db, 'salas');

// POST /salas { nombre, apuesta } -> crear sala
r.post('/', true, async (ctx: Contexto): Promise<Response> => {
  const res = await crearSala(db, ctx.usuario!, ctx.cuerpo?.nombre as string | undefined, Number(ctx.cuerpo?.apuesta));
  if ('error' in res) return errorJson(res.error);
  return json({ sala: res.snapshot, partida: res.partida, chat: res.chat }, 201);
});

// GET /salas -> salas en espera
r.get('/', true, async (ctx: Contexto): Promise<Response> => {
  const salas = await db.query(
    `SELECT s.codigo, s.nombre, s.apuesta, s.host_id, s.estado,
            (SELECT COUNT(*)::int FROM sala_jugadores sj WHERE sj.sala_id = s.codigo) AS jugadores
     FROM salas s WHERE s.estado = 'espera' ORDER BY s.creado_en DESC LIMIT 50`,
  );
  return json({ salas });
});

// GET /salas/:codigo -> snapshot + partida + chat
r.get('/:codigo', true, async (ctx: Contexto): Promise<Response> => {
  const codigo = ctx.params.codigo!.toUpperCase();
  const sala = await leerSala(db, codigo);
  if (!sala) return errorJson('sala_no_encontrada', 404);
  const partida = await leerPartida(db, codigo);
  const jugadores = await jugadoresDe(db, codigo);
  return json({ sala: snapshotSala(sala, jugadores, Boolean(partida)), partida: partida ?? null, chat: await historialChat(db, codigo) });
});

// POST /salas/:codigo/unirse
r.post('/:codigo/unirse', true, async (ctx: Contexto): Promise<Response> => {
  const res = await unirseSala(db, ctx.usuario!, ctx.params.codigo!);
  if ('error' in res) return errorJson(res.error);
  return json({ sala: res.snapshot, partida: res.partida, chat: res.chat });
});

// POST /salas/:codigo/salir
r.post('/:codigo/salir', true, async (ctx: Contexto): Promise<Response> => {
  const res = await salirSala(db, ctx.usuario!, ctx.params.codigo!);
  if ('error' in res) return errorJson(res.error);
  return json(res);
});

// POST /salas/:codigo/empezar { robarPozo, fichasPorJugador }
r.post('/:codigo/empezar', true, async (ctx: Contexto): Promise<Response> => {
  const res = await empezar(
    db,
    ctx.usuario!,
    ctx.params.codigo!,
    Boolean(ctx.cuerpo?.robarPozo),
    Number(ctx.cuerpo?.fichasPorJugador ?? 7),
  );
  if ('error' in res) return errorJson(res.error);
  return json(res);
});

// POST /salas/:codigo/jugar { fichaId, extremo }
r.post('/:codigo/jugar', true, async (ctx: Contexto): Promise<Response> => {
  const res = await jugar(db, ctx.usuario!, ctx.params.codigo!, String(ctx.cuerpo?.fichaId), (ctx.cuerpo?.extremo as 'izquierdo' | 'derecho') ?? 'derecho');
  if ('error' in res) return errorJson(res.error);
  return json(res);
});

// POST /salas/:codigo/robar
r.post('/:codigo/robar', true, async (ctx: Contexto): Promise<Response> => {
  const res = await robar(db, ctx.usuario!, ctx.params.codigo!);
  if ('error' in res) return errorJson(res.error);
  return json(res);
});

// POST /salas/:codigo/pasar
r.post('/:codigo/pasar', true, async (ctx: Contexto): Promise<Response> => {
  const res = await pasar(db, ctx.usuario!, ctx.params.codigo!);
  if ('error' in res) return errorJson(res.error);
  return json(res);
});

// POST /salas/:codigo/esperar
r.post('/:codigo/esperar', true, async (ctx: Contexto): Promise<Response> => {
  const res = await esperar(db, ctx.usuario!, ctx.params.codigo!);
  if ('error' in res) return errorJson(res.error);
  return json(res);
});

// POST /salas/:codigo/abandonar
r.post('/:codigo/abandonar', true, async (ctx: Contexto): Promise<Response> => {
  const res = await abandonarPartida(db, ctx.usuario!, ctx.params.codigo!);
  if ('error' in res) return errorJson(res.error);
  return json(res);
});

// GET /salas/:codigo/chat -> historial
r.get('/:codigo/chat', true, async (ctx: Contexto): Promise<Response> => {
  return json({ mensajes: await historialChat(db, ctx.params.codigo!) });
});

// POST /salas/:codigo/chat { texto }
r.post('/:codigo/chat', true, async (ctx: Contexto): Promise<Response> => {
  const res = await chat(db, ctx.usuario!, ctx.params.codigo!, String(ctx.cuerpo?.texto ?? ''));
  if ('error' in res) return errorJson(res.error);
  return json({ ok: true, ts: ahora() });
});

Deno.serve((req) => r.manejar(req));