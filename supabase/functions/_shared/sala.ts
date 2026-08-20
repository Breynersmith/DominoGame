// supabase/functions/_shared/sala.ts
// Lógica de salas y partidas para Edge Functions. Sustituye al gestor de
// Socket.IO del backend Express:
//  - El estado vive en Postgres (tablas `salas`, `partidas`, `sala_jugadores`).
//  - Cada acción valida, muta en una transacción (FOR UPDATE) y persiste; los
//    clientes reciben los cambios por Supabase Realtime (postgres_changes).
//  - Los turnos de bots se resuelven de forma síncrona tras cada acción humana.

import {
  Conexion,
  ahora,
  ajustarSaldo,
  crearNotificacion,
  intentarCobrar,
  obtenerRacha,
  obtenerSaldo,
  registrarResultado,
} from './db.ts';
import { UsuarioAutenticado } from './auth.ts';
import {
  aplicarJugada,
  fichasPorJugadorPermitidas,
  iniciarPartida,
  obtenerExtremosJugables,
  obtenerFichasJugables,
  obtenerGanadorTrabado,
  pasarTurno,
  resolverColoresDistintos,
  robarDelPozo,
  verificarPartidaTrabada,
} from './game/engine.ts';
import { EstadoPartida } from './game/types.ts';

const MIN_JUGADORES = 2;
const MAX_JUGADORES = 4;
const NOMBRES_BOT = ['Bot Esmeralda', 'Bot Zafiro', 'Bot Rubí'];
const COLORES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626'];

const CHAT_MAX_LONGITUD = 300;
const CHAT_COOLDOWN_MS = 1200;

export interface JugadorSala {
  usuarioId: number;
  nombre: string;
  color: string;
  esBot: boolean;
  foto?: string;
}

export interface MensajeChat {
  id: number;
  usuarioId: number;
  nombre: string;
  color: string;
  foto?: string;
  texto: string;
  ts: number;
}

export interface PartidaRow {
  codigo: string;
  opciones: { robarPozo: boolean; fichasPorJugador: number };
  estado: EstadoPartida;
  jugadores: JugadorSala[];
  apuesta: number;
  pagada: number;
  humanos_inicio: number;
  resultado: { pot: number; pagos: Record<number, { tipo: string; monto: number }>; motivo?: string } | null;
  creado_en: number;
  actualizado_en: number;
}

export interface SnapshotSala {
  codigo: string;
  nombre: string;
  apuesta: number;
  hostId: number;
  estado: 'espera' | 'jugando';
  jugadores: { id: number; nombre: string; color: string; foto?: string | null }[];
  partida: { empezada: boolean } | null;
}

const CODIGO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigo(longitud = 6): string {
  let codigo = '';
  for (let i = 0; i < longitud; i++) {
    codigo += CODIGO_CHARS[Math.floor(Math.random() * CODIGO_CHARS.length)];
  }
  return codigo;
}

export function snapshotSala(
  sala: { codigo: string; nombre: string; apuesta: number; host_id: number; estado: string },
  jugadores: { id: number; nombre: string; color: string; foto?: string | null }[],
  partidaActiva: boolean,
): SnapshotSala {
  return {
    codigo: sala.codigo,
    nombre: sala.nombre,
    apuesta: sala.apuesta,
    hostId: sala.host_id,
    estado: sala.estado === 'jugando' ? 'jugando' : 'espera',
    jugadores,
    partida: partidaActiva ? { empezada: true } : null,
  };
}

export async function leerSala(db: Conexion, codigo: string) {
  return db.one<{ codigo: string; nombre: string; apuesta: number; host_id: number; estado: string }>(
    'SELECT codigo, nombre, apuesta, host_id, estado FROM salas WHERE codigo = $1',
    [codigo],
  );
}

export async function leerPartida(db: Conexion, codigo: string): Promise<PartidaRow | undefined> {
  return db.one<PartidaRow>('SELECT * FROM partidas WHERE codigo = $1', [codigo]);
}

export async function jugadoresDe(
  db: Conexion,
  codigo: string,
): Promise<{ id: number; nombre: string; color: string; foto?: string | null }[]> {
  return db.query(
    `SELECT u.id, u.nombre, u.color, u.foto_url AS foto
     FROM sala_jugadores sj JOIN perfiles u ON u.id = sj.usuario_id
     WHERE sj.sala_id = $1 ORDER BY sj.creado_en`,
    [codigo],
  );
}

async function guardarSnapshot(
  db: Conexion,
  codigo: string,
  snapshot: SnapshotSala,
  aviso: unknown = null,
): Promise<void> {
  await db.ejecutar(
    'UPDATE salas SET snapshot = $1::jsonb, aviso = $2::jsonb, ultimo_cambio = $3 WHERE codigo = $4',
    [JSON.stringify(snapshot), aviso ? JSON.stringify(aviso) : null, ahora(), codigo],
  );
}

async function transferirHostSiAplica(db: Conexion, codigo: string): Promise<void> {
  const sala = await leerSala(db, codigo);
  if (!sala || sala.estado !== 'espera') return;
  const enSala = await db.one('SELECT 1 FROM sala_jugadores WHERE sala_id = $1 AND usuario_id = $2', [
    codigo,
    sala.host_id,
  ]);
  if (enSala) return;
  const primero = await db.one<{ usuario_id: number }>(
    'SELECT usuario_id FROM sala_jugadores WHERE sala_id = $1 ORDER BY creado_en LIMIT 1',
    [codigo],
  );
  if (!primero) return;
  await db.ejecutar('UPDATE salas SET host_id = $1 WHERE codigo = $2', [primero.usuario_id, codigo]);
}

async function eliminarSala(db: Conexion, codigo: string): Promise<void> {
  await db.ejecutar('DELETE FROM salas WHERE codigo = $1', [codigo]);
}

// ---------- Resolución de turnos (bots + auto-pase) ----------

function resolverTurnoBot(estado: EstadoPartida): EstadoPartida {
  let s = estado;
  const jugadorId = s.jugadores[s.turnoActual]!.id;
  while (obtenerFichasJugables(jugadorId, s).length === 0 && s.pozo.length > 0) {
    s = robarDelPozo(s);
  }
  const jugables = obtenerFichasJugables(jugadorId, s);
  if (jugables.length > 0) {
    const ficha = jugables[Math.floor(Math.random() * jugables.length)]!;
    const extremos = obtenerExtremosJugables(ficha, s);
    const extremo = extremos[Math.floor(Math.random() * extremos.length)]!;
    s = aplicarJugada(s, { jugadorId, ficha, extremo });
  } else {
    s = pasarTurno(s);
  }
  return s;
}

// Auto-pasa a quien no puede jugar ni robar y resuelve los turnos de bots de
// forma síncrona hasta llegar a un humano o finalizar la partida.
async function resolverAvance(
  db: Conexion,
  codigo: string,
  partida: PartidaRow,
): Promise<{ estado: EstadoPartida; terminada: boolean }> {
  let estado = partida.estado;
  while (true) {
    while (true) {
      const jugadorActual = estado.jugadores[estado.turnoActual]!;
      const puedeJugar = obtenerFichasJugables(jugadorActual.id, estado).length > 0;
      const puedeRobar = partida.opciones.robarPozo && estado.pozo.length > 0;
      if (puedeJugar || puedeRobar || estado.ganador || verificarPartidaTrabada(estado)) break;
      estado = pasarTurno(estado);
    }
    if (estado.ganador || verificarPartidaTrabada(estado)) {
      return { estado, terminada: true };
    }
    const idx = estado.turnoActual;
    if (idx >= partida.jugadores.length) break;
    if (!partida.jugadores[idx]!.esBot) {
      return { estado, terminada: false };
    }
    estado = resolverTurnoBot(estado);
  }
  return { estado, terminada: false };
}

// ---------- Finalización ----------

async function finalizar(db: Conexion, codigo: string, partida: PartidaRow): Promise<void> {
  let estado = partida.estado;
  if (verificarPartidaTrabada(estado)) {
    const ganadorTrabado = obtenerGanadorTrabado(estado);
    estado = { ...estado, partidaTrabada: true, ganador: ganadorTrabado };
  }

  const humanos = partida.jugadores.filter((j) => !j.esBot);
  const apuesta = partida.apuesta;
  const pot = apuesta * humanos.length;
  const pagos: Record<number, { tipo: string; monto: number }> = {};

  const ganadorIdx = estado.ganador ? parseInt(estado.ganador.replace('jugador-', ''), 10) : -1;
  const ganador =
    Number.isInteger(ganadorIdx) && ganadorIdx >= 0 && ganadorIdx < partida.jugadores.length
      ? partida.jugadores[ganadorIdx]
      : undefined;

  if (ganador && !ganador.esBot) {
    await registrarResultado(db, ganador.usuarioId, 'victoria');
    for (const h of humanos) {
      if (h.usuarioId !== ganador.usuarioId) await registrarResultado(db, h.usuarioId, 'derrota');
    }
  } else if (ganador && ganador.esBot) {
    for (const h of humanos) await registrarResultado(db, h.usuarioId, 'derrota');
  }

  if (apuesta > 0 && humanos.length > 0) {
    if (ganador && !ganador.esBot) {
      await ajustarSaldo(db, ganador.usuarioId, pot, 'ganancia', 'Premio de la partida');
      await crearNotificacion(db, ganador.usuarioId, 'Victoria', `Ganaste ${pot} créditos`);
      for (const h of humanos) {
        pagos[h.usuarioId] =
          h.usuarioId === ganador.usuarioId
            ? { tipo: 'ganancia', monto: pot }
            : { tipo: 'perdida', monto: -apuesta };
      }
    } else {
      for (const h of humanos) {
        await ajustarSaldo(db, h.usuarioId, apuesta, 'reembolso', 'Reembolso por partida trabada');
        pagos[h.usuarioId] = { tipo: 'reembolso', monto: apuesta };
      }
    }
  }

  await db.ejecutar(
    'UPDATE partidas SET estado = $1::jsonb, pagada = 1, resultado = $2::jsonb, actualizado_en = $3 WHERE codigo = $4',
    [JSON.stringify(estado), JSON.stringify({ pot, pagos }), ahora(), codigo],
  );
  await db.ejecutar("UPDATE salas SET estado = 'espera', ultimo_cambio = $1 WHERE codigo = $2", [ahora(), codigo]);

  const sala = await leerSala(db, codigo);
  if (sala) {
    const jugadores = await jugadoresDe(db, codigo);
    await guardarSnapshot(db, codigo, snapshotSala(sala, jugadores, false), null);
  }
}

// Convierte el asiento del jugador en un bot (abandono) y reembolsa su apuesta.
async function salirDePartida(db: Conexion, codigo: string, partida: PartidaRow, u: UsuarioAutenticado): Promise<void> {
  const idx = partida.jugadores.findIndex((j) => j.usuarioId === u.id);
  if (idx === -1) return;
  if (partida.apuesta > 0) {
    await ajustarSaldo(db, u.id, partida.apuesta, 'reembolso', 'Reembolso por salida de partida');
  }
  const jugadores = partida.jugadores.map((j, i) => (i === idx ? { ...j, esBot: true } : j));
  await db.ejecutar('UPDATE partidas SET jugadores = $1::jsonb WHERE codigo = $2', [JSON.stringify(jugadores), codigo]);
}

// ---------- Acciones ----------

export async function crearSala(
  db: Conexion,
  u: UsuarioAutenticado,
  nombreRaw: string | undefined,
  apuestaRaw: number,
): Promise<{ error: string } | { ok: true; snapshot: SnapshotSala; partida: PartidaRow | null; chat: MensajeChat[] }> {
  const nombre = String(nombreRaw ?? `Sala de ${u.nombre}`).trim().slice(0, 24) || `Sala de ${u.nombre}`;
  const apuesta = Math.max(0, Math.floor(Number(apuestaRaw) || 0));
  if (apuesta > 0 && (await obtenerSaldo(db, u.id)) < apuesta) return { error: 'sin_saldo' };

  let codigo = generarCodigo();
  while (await db.one('SELECT 1 FROM salas WHERE codigo = $1', [codigo])) {
    codigo = generarCodigo();
  }

  await db.ejecutar(
    'INSERT INTO salas (codigo, nombre, apuesta, host_id, estado, creado_en) VALUES ($1, $2, $3, $4, $5, $6)',
    [codigo, nombre, apuesta, u.id, 'espera', ahora()],
  );
  await db.ejecutar('INSERT INTO sala_jugadores (sala_id, usuario_id, creado_en) VALUES ($1, $2, $3)', [
    codigo,
    u.id,
    ahora(),
  ]);

  return { ok: true, snapshot: snapshotSala({ codigo, nombre, apuesta, host_id: u.id, estado: 'espera' }, [{ id: u.id, nombre: u.nombre, color: u.color, foto: u.foto }], false), partida: null, chat: [] };
}

export async function unirseSala(
  db: Conexion,
  u: UsuarioAutenticado,
  codigoRaw: string,
): Promise<{ error: string } | { ok: true; snapshot: SnapshotSala; partida: PartidaRow | null; chat: MensajeChat[] }> {
  const codigo = codigoRaw.toUpperCase();
  const sala = await leerSala(db, codigo);
  if (!sala) return { error: 'sala_no_encontrada' };

  await db.ejecutar(
    'INSERT INTO sala_jugadores (sala_id, usuario_id, creado_en) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [codigo, u.id, ahora()],
  );
  await transferirHostSiAplica(db, codigo);

  const jugadores = await jugadoresDe(db, codigo);
  const partida = await leerPartida(db, codigo);
  const snapshot = snapshotSala(sala, jugadores, Boolean(partida));
  await guardarSnapshot(db, codigo, snapshot, null);

  return {
    ok: true,
    snapshot,
    partida: partida ?? null,
    chat: await historialChat(db, codigo),
  };
}

export async function salirSala(
  db: Conexion,
  u: UsuarioAutenticado,
  codigoRaw: string,
): Promise<{ error: string } | { ok: true; eliminada: boolean }> {
  const codigo = codigoRaw.toUpperCase();
  const sala = await leerSala(db, codigo);
  if (!sala) return { error: 'sala_no_encontrada' };

  const partida = await leerPartida(db, codigo);
  if (partida && !partida.pagada) {
    await salirDePartida(db, codigo, partida, u);
  }
  await db.ejecutar('DELETE FROM sala_jugadores WHERE sala_id = $1 AND usuario_id = $2', [codigo, u.id]);
  await transferirHostSiAplica(db, codigo);

  const restantes = await jugadoresDe(db, codigo);
  const partidaActual = await leerPartida(db, codigo);
  if (restantes.length === 0) {
    if (partidaActual && !partidaActual.pagada) {
      await finalizar(db, codigo, partidaActual);
    }
    await eliminarSala(db, codigo);
    return { ok: true, eliminada: true };
  }

  if (partidaActual && !partidaActual.pagada) {
    const filaAvance = { ...partidaActual };
    const res = await resolverAvance(db, codigo, filaAvance);
    filaAvance.estado = res.estado;
    if (res.terminada) {
      await finalizar(db, codigo, filaAvance);
    } else {
      await db.ejecutar('UPDATE partidas SET estado = $1::jsonb, actualizado_en = $2 WHERE codigo = $3', [
        JSON.stringify(filaAvance.estado),
        ahora(),
        codigo,
      ]);
    }
  }

  const salaFinal = await leerSala(db, codigo);
  if (salaFinal) {
    const jugadores = await jugadoresDe(db, codigo);
    const partidaFinal = await leerPartida(db, codigo);
    await guardarSnapshot(
      db,
      codigo,
      snapshotSala(salaFinal, jugadores, Boolean(partidaFinal)),
      { tipo: 'jugador_abandono', jugador: { id: u.id, nombre: u.nombre } },
    );
  }
  return { ok: true, eliminada: false };
}

export async function empezar(
  db: Conexion,
  u: UsuarioAutenticado,
  codigoRaw: string,
  robarPozo: boolean,
  fichasPorJugador: number,
): Promise<{ error: string } | { ok: true; jugadores: unknown[]; opciones: { robarPozo: boolean; fichasPorJugador: number }; apuesta: number }> {
  const codigo = codigoRaw.toUpperCase();
  const sala = await leerSala(db, codigo);
  if (!sala) return { error: 'sala_no_encontrada' };
  if (sala.host_id !== u.id) return { error: 'solo_el_anfitrion' };
  const existente = await leerPartida(db, codigo);
  if (existente && !existente.pagada) return { error: 'partida_en_curso' };

  const miembros = await jugadoresDe(db, codigo);
  if (miembros.length === 0) return { error: 'sin_jugadores' };
  if (miembros.length > MAX_JUGADORES) return { error: 'demasiados_jugadores' };

  const total = Math.max(miembros.length, MIN_JUGADORES);
  const jugadores: JugadorSala[] = miembros.map((m) => ({
    usuarioId: m.id,
    nombre: m.nombre,
    color: m.color,
    esBot: false,
    foto: m.foto ?? undefined,
  }));
  for (let i = miembros.length; i < total; i++) {
    jugadores.push({
      usuarioId: -i - 1,
      nombre: NOMBRES_BOT[i - miembros.length]!,
      color: COLORES[i % COLORES.length]!,
      esBot: true,
    });
  }

  const permitidas = fichasPorJugadorPermitidas(total);
  const fichas = permitidas.includes(fichasPorJugador) ? fichasPorJugador : 7;
  const apuesta = sala.apuesta;

  const cobrados: number[] = [];
  for (const j of jugadores) {
    if (j.esBot) continue;
    if (apuesta > 0) {
      const ok = await intentarCobrar(db, j.usuarioId, apuesta, 'Apuesta en partida');
      if (!ok) {
        for (const id of cobrados) {
          await ajustarSaldo(db, id, apuesta, 'reembolso', 'Reembolso por apuesta no confirmada');
        }
        return { error: 'sin_saldo' };
      }
      cobrados.push(j.usuarioId);
    }
  }

  const coloresResueltos = resolverColoresDistintos(jugadores.map((j) => j.color));
  jugadores.forEach((j, i) => {
    j.color = coloresResueltos?.[i] ?? j.color;
  });
  const estado = iniciarPartida(
    jugadores.map((j) => j.nombre),
    { robarPozo, fichasPorJugador: fichas },
    jugadores.map((j) => j.color),
  );
  const rachas: Record<number, number> = {};
  for (let i = 0; i < estado.jugadores.length; i++) {
    const j = estado.jugadores[i]!;
    j.racha = jugadores[i]!.esBot ? 0 : await obtenerRacha(db, jugadores[i]!.usuarioId);
    j.foto = jugadores[i]!.foto;
    j.color = jugadores[i]!.color;
    rachas[jugadores[i]!.usuarioId] = j.racha;
  }

  await db.ejecutar(
    `INSERT INTO partidas (codigo, opciones, estado, jugadores, apuesta, pagada, humanos_inicio, resultado, creado_en, actualizado_en)
     VALUES ($1, $2, $3, $4, $5, 0, $6, NULL, $7, $7)
     ON CONFLICT (codigo) DO UPDATE SET
       opciones = EXCLUDED.opciones, estado = EXCLUDED.estado, jugadores = EXCLUDED.jugadores,
       apuesta = EXCLUDED.apuesta, pagada = 0, humanos_inicio = EXCLUDED.humanos_inicio,
       resultado = NULL, actualizado_en = EXCLUDED.actualizado_en`,
    [
      codigo,
      JSON.stringify({ robarPozo, fichasPorJugador: fichas }),
      JSON.stringify(estado),
      JSON.stringify(jugadores),
      apuesta,
      miembros.length,
      ahora(),
    ],
  );

  const filaPartida: PartidaRow = {
    codigo,
    opciones: { robarPozo, fichasPorJugador: fichas },
    estado,
    jugadores,
    apuesta,
    pagada: 0,
    humanos_inicio: miembros.length,
    resultado: null,
    creado_en: ahora(),
    actualizado_en: ahora(),
  };
  // Si el turno inicial cae en un bot, resuélvelo de forma síncrona hasta
  // llegar al primer humano (o finalizar), igual que en las acciones de juego.
  const avance = await resolverAvance(db, codigo, filaPartida);
  filaPartida.estado = avance.estado;
  if (avance.terminada) {
    await finalizar(db, codigo, filaPartida);
  } else if (avance.estado !== estado) {
    await db.ejecutar('UPDATE partidas SET estado = $1::jsonb, actualizado_en = $2 WHERE codigo = $3', [
      JSON.stringify(avance.estado),
      ahora(),
      codigo,
    ]);
  }

  await db.ejecutar("UPDATE salas SET estado = 'jugando', ultimo_cambio = $1 WHERE codigo = $2", [ahora(), codigo]);
  await guardarSnapshot(db, codigo, snapshotSala(sala, miembros, true), null);

  return {
    ok: true,
    jugadores: jugadores.map((j, i) => ({
      id: j.usuarioId,
      nombre: j.nombre,
      color: j.color,
      esBot: j.esBot,
      orden: i,
      racha: rachas[j.usuarioId],
      foto: j.foto,
    })),
    opciones: { robarPozo, fichasPorJugador: fichas },
    apuesta,
  };
}

export async function jugar(
  db: Conexion,
  u: UsuarioAutenticado,
  codigoRaw: string,
  fichaId: string,
  extremo: 'izquierdo' | 'derecho',
): Promise<{ error: string } | { ok: true }> {
  const codigo = codigoRaw.toUpperCase();
  return db.transaccion(async (tx) => {
    const fila = await tx.one<PartidaRow>('SELECT * FROM partidas WHERE codigo = $1 FOR UPDATE', [codigo]);
    if (!fila) return { error: 'sin_partida' };
    if (fila.pagada === 1) return { error: 'partida_terminada' };
    const idx = fila.jugadores.findIndex((j) => j.usuarioId === u.id);
    if (idx === -1) return { error: 'no_estas_en_la_partida' };
    if (idx !== fila.estado.turnoActual) return { error: 'no_es_tu_turno' };

    const estado = fila.estado;
    const jugador = estado.jugadores[idx]!;
    const ficha = jugador.mano.find((f) => f.id === fichaId);
    if (!ficha) return { error: 'ficha_no_en_mano' };
    const extremos = obtenerExtremosJugables(ficha, estado);
    if (extremos.length === 0) return { error: 'ficha_no_jugable' };
    if (extremos.length === 1 && !extremos.includes(extremo)) return { error: 'solo_otro_extremo' };

    try {
      const filaAvance: PartidaRow = { ...fila, estado: aplicarJugada(estado, { jugadorId: jugador.id, ficha, extremo }) };
      const res = await resolverAvance(tx, codigo, filaAvance);
      filaAvance.estado = res.estado;
      if (res.terminada) {
        await finalizar(tx, codigo, filaAvance);
      } else {
        await tx.ejecutar('UPDATE partidas SET estado = $1::jsonb, actualizado_en = $2 WHERE codigo = $3', [
          JSON.stringify(filaAvance.estado),
          ahora(),
          codigo,
        ]);
      }
      return { ok: true };
    } catch {
      return { error: 'jugada_invalida' };
    }
  });
}

export async function robar(db: Conexion, u: UsuarioAutenticado, codigoRaw: string): Promise<{ error: string } | { ok: true }> {
  const codigo = codigoRaw.toUpperCase();
  return db.transaccion(async (tx) => {
    const fila = await tx.one<PartidaRow>('SELECT * FROM partidas WHERE codigo = $1 FOR UPDATE', [codigo]);
    if (!fila) return { error: 'sin_partida' };
    if (fila.pagada === 1) return { error: 'partida_terminada' };
    const idx = fila.jugadores.findIndex((j) => j.usuarioId === u.id);
    if (idx === -1) return { error: 'no_estas_en_la_partida' };
    if (idx !== fila.estado.turnoActual) return { error: 'no_es_tu_turno' };
    if (!fila.opciones.robarPozo) return { error: 'sin_pozo' };
    const jugadorId = fila.estado.jugadores[idx]!.id;
    if (obtenerFichasJugables(jugadorId, fila.estado).length > 0) return { error: 'no_puedes_robar' };
    if (fila.estado.pozo.length === 0) return { error: 'pozo_vacio' };

    const nuevo = robarDelPozo(fila.estado);
    await tx.ejecutar('UPDATE partidas SET estado = $1::jsonb, actualizado_en = $2 WHERE codigo = $3', [
      JSON.stringify(nuevo),
      ahora(),
      codigo,
    ]);
    return { ok: true };
  });
}

export async function pasar(db: Conexion, u: UsuarioAutenticado, codigoRaw: string): Promise<{ error: string } | { ok: true }> {
  const codigo = codigoRaw.toUpperCase();
  return db.transaccion(async (tx) => {
    const fila = await tx.one<PartidaRow>('SELECT * FROM partidas WHERE codigo = $1 FOR UPDATE', [codigo]);
    if (!fila) return { error: 'sin_partida' };
    if (fila.pagada === 1) return { error: 'partida_terminada' };
    const idx = fila.jugadores.findIndex((j) => j.usuarioId === u.id);
    if (idx === -1) return { error: 'no_estas_en_la_partida' };
    if (idx !== fila.estado.turnoActual) return { error: 'no_es_tu_turno' };
    const jugadorId = fila.estado.jugadores[idx]!.id;
    if (obtenerFichasJugables(jugadorId, fila.estado).length > 0) return { error: 'no_puedes_pasar' };
    if (fila.opciones.robarPozo && fila.estado.pozo.length > 0) return { error: 'pozo_debes_robar' };

    const filaAvance: PartidaRow = { ...fila, estado: pasarTurno(fila.estado) };
    const res = await resolverAvance(tx, codigo, filaAvance);
    filaAvance.estado = res.estado;
    if (res.terminada) {
      await finalizar(tx, codigo, filaAvance);
    } else {
      await tx.ejecutar('UPDATE partidas SET estado = $1::jsonb, actualizado_en = $2 WHERE codigo = $3', [
        JSON.stringify(filaAvance.estado),
        ahora(),
        codigo,
      ]);
    }
    return { ok: true };
  });
}

// Legado del flujo de pausa: no-op (en el modelo Realtime no hay pausa).
export async function esperar(db: Conexion, u: UsuarioAutenticado, codigoRaw: string): Promise<{ error: string } | { ok: true }> {
  const codigo = codigoRaw.toUpperCase();
  const enSala = await db.one('SELECT 1 FROM sala_jugadores WHERE sala_id = $1 AND usuario_id = $2', [codigo, u.id]);
  if (!enSala) return { error: 'no_estas_en_la_partida' };
  return { ok: true };
}

export async function abandonarPartida(
  db: Conexion,
  u: UsuarioAutenticado,
  codigoRaw: string,
): Promise<{ error: string } | { ok: true }> {
  const codigo = codigoRaw.toUpperCase();
  const partida = await leerPartida(db, codigo);
  if (!partida || partida.pagada) return { error: 'sin_partida' };
  const enSala = await db.one('SELECT 1 FROM sala_jugadores WHERE sala_id = $1 AND usuario_id = $2', [codigo, u.id]);
  if (!enSala) return { error: 'no_estas_en_la_partida' };

  await salirDePartida(db, codigo, partida, u);
  await db.ejecutar('DELETE FROM sala_jugadores WHERE sala_id = $1 AND usuario_id = $2', [codigo, u.id]);
  await transferirHostSiAplica(db, codigo);

  const partidaActual = await leerPartida(db, codigo);
  const restantes = await jugadoresDe(db, codigo);
  if (restantes.length === 0) {
    if (partidaActual && !partidaActual.pagada) await finalizar(db, codigo, partidaActual);
    await eliminarSala(db, codigo);
    return { ok: true };
  }
  if (partidaActual && !partidaActual.pagada) {
    const filaAvance = { ...partidaActual };
    const res = await resolverAvance(db, codigo, filaAvance);
    filaAvance.estado = res.estado;
    if (res.terminada) {
      await finalizar(db, codigo, filaAvance);
    } else {
      await db.ejecutar('UPDATE partidas SET estado = $1::jsonb, actualizado_en = $2 WHERE codigo = $3', [
        JSON.stringify(filaAvance.estado),
        ahora(),
        codigo,
      ]);
    }
  }

  const salaFinal = await leerSala(db, codigo);
  if (salaFinal) {
    const jugadores = await jugadoresDe(db, codigo);
    const partidaFinal = await leerPartida(db, codigo);
    await guardarSnapshot(
      db,
      codigo,
      snapshotSala(salaFinal, jugadores, Boolean(partidaFinal)),
      { tipo: 'jugador_abandono', jugador: { id: u.id, nombre: u.nombre } },
    );
  }
  return { ok: true };
}

// ---------- Chat ----------

export async function chat(db: Conexion, u: UsuarioAutenticado, codigoRaw: string, texto: string): Promise<{ error: string } | { ok: true }> {
  const codigo = codigoRaw.toUpperCase();
  const enSala = await db.one('SELECT 1 FROM sala_jugadores WHERE sala_id = $1 AND usuario_id = $2', [codigo, u.id]);
  if (!enSala) return { error: 'no_estas_en_la_sala' };

  const limpio = String(texto ?? '').trim();
  if (!limpio || limpio.length > CHAT_MAX_LONGITUD) return { error: 'mensaje_invalido' };

  const ultimo = await db.one<{ ts: number }>(
    'SELECT MAX(ts) AS ts FROM chat_mensajes WHERE sala_id = $1 AND usuario_id = $2',
    [codigo, u.id],
  );
  if (ultimo && ahora() - ultimo.ts < CHAT_COOLDOWN_MS) return { error: 'chat_demasiado_rapido' };

  await db.ejecutar(
    'INSERT INTO chat_mensajes (sala_id, usuario_id, nombre, color, foto, texto, ts) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [codigo, u.id, u.nombre, u.color, u.foto ?? null, limpio, ahora()],
  );
  return { ok: true };
}

export async function historialChat(db: Conexion, codigoRaw: string): Promise<MensajeChat[]> {
  const codigo = codigoRaw.toUpperCase();
  return db.query(
    `SELECT id, usuario_id AS "usuarioId", nombre, color, foto, texto, ts
     FROM chat_mensajes WHERE sala_id = $1 ORDER BY id DESC LIMIT 100`,
    [codigo],
  );
}