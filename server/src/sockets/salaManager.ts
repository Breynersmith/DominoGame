// server/src/sockets/salaManager.ts
// Gestor de salas y partidas en tiempo real con Socket.IO.
// Las partidas son autoritativas: el servidor valida turnos y mueve a los bots.

import { Server, Socket } from 'socket.io';
import { Db, ajustarSaldo, crearNotificacion, intentarCobrar, obtenerRacha, registrarResultado } from '../db';
import { UsuarioAutenticado } from '../auth';
import { verToken } from '../supabase';
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
} from '../game/engine';
import { EstadoPartida } from '../game/types';

const MIN_JUGADORES = 2;
const MAX_JUGADORES = 4;
const NOMBRES_BOT = ['Bot Esmeralda', 'Bot Zafiro', 'Bot Rubí'];
const COLORES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626'];

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

const MAX_MENSAJES_CHAT = 100;
const CHAT_COOLDOWN_MS = 1200;
const CHAT_MAX_LONGITUD = 300;

interface Partida {
  opciones: { robarPozo: boolean; fichasPorJugador: number };
  estado: EstadoPartida;
  jugadores: JugadorSala[]; // alineados por índice con estado.jugadores
  apuesta: number;
  pagada: boolean;
  humanosInicio: number;
}

export interface Sala {
  codigo: string;
  nombre: string;
  apuesta: number;
  hostId: number;
  estado: 'espera' | 'jugando';
  humanos: Map<number, JugadorSala>;
  partida: Partida | null;
  pausa: { jugadorId: number; nombre: string } | null;
  mensajes: MensajeChat[];
}

function nuevoCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  return codigo;
}

function snapshotSala(sala: Sala) {
  return {
    codigo: sala.codigo,
    nombre: sala.nombre,
    apuesta: sala.apuesta,
    hostId: sala.hostId,
    estado: sala.estado,
    jugadores: [...sala.humanos.values()].map(j => ({
      id: j.usuarioId,
      nombre: j.nombre,
      color: j.color,
      foto: j.foto,
    })),
    partida: sala.partida ? { empezada: true } : null,
  };
}

export class SalaManager {
  private salas = new Map<string, Sala>();
  private socketSala = new Map<string, string>(); // socketId -> codigo
  private ultimoChat = new Map<string, number>(); // socketId -> timestamp último mensaje
  private cerrado = false;
  private timerAvanzar = new Map<string, NodeJS.Timeout>(); // codigo -> timer del avance de bots

  constructor(
    private io: Server,
    private db: Db,
  ) {}

  // Detiene el gestor: cancela los avances pendientes y libera las salas. Se usa
  // al cerrar el servidor para que las partidas en curso no sigan escribiendo en
  // la base de datos después de apagado.
  cerrar(): void {
    this.cerrado = true;
    for (const t of this.timerAvanzar.values()) clearTimeout(t);
    this.timerAvanzar.clear();
    this.salas.clear();
    this.socketSala.clear();
    this.ultimoChat.clear();
  }

  // ---------- Unirse / salir ----------

  async unirse(socket: Socket, codigo: string): Promise<{ ok: boolean; error?: string }> {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const codigoUp = codigo.toUpperCase();

    let sala = this.salas.get(codigoUp);
    if (!sala) {
      // Cargar desde BD si existe
      const fila = await this.db.one<{
        codigo: string;
        nombre: string;
        apuesta: number;
        host_id: number;
        estado: string;
      }>('SELECT codigo, nombre, apuesta, host_id, estado FROM salas WHERE codigo = $1', [codigoUp]);
      if (!fila) return { ok: false, error: 'sala_no_encontrada' };
      sala = {
        codigo: fila.codigo,
        nombre: fila.nombre,
        apuesta: fila.apuesta,
        hostId: fila.host_id,
        estado: fila.estado === 'jugando' ? 'jugando' : 'espera',
        humanos: new Map(),
        partida: null,
        pausa: null,
        mensajes: [],
      };
      this.salas.set(codigoUp, sala);
    }

    if (sala.estado === 'jugando' && !sala.partida) {
      // partida huérfana (reinicio del server): volver a espera
      sala.estado = 'espera';
    }

    await this.salirDeSalaActual(socket);
    socket.join(codigoUp);
    this.socketSala.set(socket.id, codigoUp);

    if (!sala.humanos.has(usuario.id)) {
      sala.humanos.set(usuario.id, {
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        color: usuario.color,
        esBot: false,
        foto: usuario.foto ?? undefined,
      });
    }
    // Mantener la pertenencia persistida (si la sala fue borrada en BD de forma
    // concurrente, la partida sigue en memoria y no debe romper la conexión).
    await this.db
      .ejecutar(
        'INSERT INTO sala_jugadores (sala_id, usuario_id, creado_en) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [codigoUp, usuario.id, Date.now()],
      )
      .catch(() => {});

    // Si el anfitrión de una sala en espera no está conectado (p. ej. sala
    // huérfana de una sesión anterior), el primer jugador presente toma el rol.
    await this.transferirHostSiAplica(sala);

    // Si el jugador abandonado vuelve a conectarse, se reanuda la partida pausada
    if (sala.pausa && sala.pausa.jugadorId === usuario.id && sala.partida) {
      sala.pausa = null;
      this.io.to(codigoUp).emit('partida:reanudada', {});
      this.emitirEstado(sala);
      void this.avanzar(sala);
    }

    this.emitirSala(sala);
    if (sala.partida) {
      socket.emit('partida:estado', { estado: sala.partida.estado });
    }
    socket.emit('chat:historial', { mensajes: sala.mensajes });
    return { ok: true };
  }

  async salir(socket: Socket): Promise<void> {
    await this.salirDeSalaActual(socket);
  }

  // Refresca el perfil (foto/nombre/color) del usuario en la sala y partida actuales.
  async actualizarPerfil(socket: Socket): Promise<void> {
    const codigo = this.socketSala.get(socket.id);
    const sala = codigo ? this.salas.get(codigo) : undefined;
    const usuario = socket.data.usuario as UsuarioAutenticado | undefined;
    if (!sala || !usuario) return;
    const fila = await this.db.one<{
      id: number;
      nombre: string;
      color: string;
      saldo: number;
      foto?: string | null;
    }>('SELECT id, nombre, color, saldo, foto_url AS foto FROM perfiles WHERE id = $1', [usuario.id]);
    if (!fila) return;
    const humano = sala.humanos.get(usuario.id);
    if (humano) {
      humano.nombre = fila.nombre;
      humano.color = fila.color;
      humano.foto = fila.foto ?? undefined;
    }
    if (sala.partida) {
      sala.partida.jugadores.forEach(j => {
        if (j.usuarioId === usuario.id) {
          j.nombre = fila.nombre;
          j.color = fila.color;
          j.foto = fila.foto ?? undefined;
        }
      });
      this.emitirEstado(sala);
    }
    this.emitirSala(sala);
  }

  async desconectar(socket: Socket): Promise<void> {
    const codigo = this.socketSala.get(socket.id);
    const sala = codigo ? this.salas.get(codigo) : undefined;
    const usuario = socket.data.usuario as UsuarioAutenticado | undefined;

    if (sala && usuario) {
      sala.humanos.delete(usuario.id);
      if (sala.estado === 'espera' && sala.hostId === usuario.id) {
        await this.transferirHostSiAplica(sala);
      }
      await this.abandonarSiAplica(sala, usuario.id, usuario.nombre);
      if (sala.humanos.size === 0 && !sala.partida) {
        await this.eliminarSala(codigo!);
      }
    }
    this.socketSala.delete(socket.id);
  }

  // Cuando un humano deja la partida en curso:
  // - Si queda otro humano, la partida se pausa y se le notifica (esperar/abandonar).
  // - Si no queda nadie, la partida se cierra.
  // - Con varios humanos restantes, su asiento pasa a ser un bot y sigue el juego.
  private async abandonarSiAplica(sala: Sala, jugadorId: number, nombre: string): Promise<void> {
    if (!sala.partida || sala.partida.pagada) {
      this.emitirSala(sala);
      return;
    }
    if (sala.humanos.size === 1) {
      await this.pausarPorAbandono(sala, jugadorId, nombre);
    } else if (sala.humanos.size === 0) {
      await this.finalizar(sala);
    } else {
      sala.partida.jugadores.forEach(j => {
        if (j.usuarioId === jugadorId) j.esBot = true;
      });
      this.emitirSala(sala);
    }
  }

  private async pausarPorAbandono(sala: Sala, jugadorId: number, nombre: string): Promise<void> {
    sala.pausa = { jugadorId, nombre };
    // Si el anfitrión se va, pasa el host al jugador que se queda
    if (sala.hostId === jugadorId) {
      const restante = [...sala.humanos.values()][0];
      if (restante) {
        sala.hostId = restante.usuarioId;
        await this.db.ejecutar('UPDATE salas SET host_id = $1 WHERE codigo = $2', [restante.usuarioId, sala.codigo]);
      }
    }
    this.io.to(sala.codigo).emit('partida:jugador_abandono', {
      jugador: { id: jugadorId, nombre },
    });
    this.emitirSala(sala);
  }

  private async salirDeSalaActual(socket: Socket): Promise<void> {
    const previo = this.socketSala.get(socket.id);
    if (previo) {
      const sala = this.salas.get(previo);
      const usuario = socket.data.usuario as UsuarioAutenticado | undefined;
      if (sala && usuario) {
        sala.humanos.delete(usuario.id);
        if (sala.estado === 'espera' && sala.hostId === usuario.id) {
          await this.transferirHostSiAplica(sala);
        }
        await this.abandonarSiAplica(sala, usuario.id, usuario.nombre);
        if (sala.humanos.size === 0 && !sala.partida) {
          await this.eliminarSala(previo);
        }
      }
      socket.leave(previo);
      this.socketSala.delete(socket.id);
    }
  }

  // Si el anfitrión de una sala en espera no está entre los conectados,
  // transfiere el rol al primer jugador presente para que la partida pueda iniciar.
  private async transferirHostSiAplica(sala: Sala): Promise<void> {
    if (sala.estado !== 'espera' || sala.partida) return;
    if (sala.humanos.has(sala.hostId)) return;
    const restante = [...sala.humanos.values()][0];
    if (!restante) return;
    sala.hostId = restante.usuarioId;
    await this.db.ejecutar('UPDATE salas SET host_id = $1 WHERE codigo = $2', [restante.usuarioId, sala.codigo]);
    this.emitirSala(sala);
  }

  private async eliminarSala(codigo: string): Promise<void> {
    this.salas.delete(codigo);
    await this.db.ejecutar('DELETE FROM salas WHERE codigo = $1', [codigo]);
  }

  // ---------- Empezar partida ----------

  async empezar(
    socket: Socket,
    codigo: string,
    robarPozo: boolean,
    fichasPorJugador: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const sala = this.salas.get(codigo.toUpperCase());
    if (!sala) return { ok: false, error: 'sala_no_encontrada' };
    if (sala.hostId !== usuario.id) return { ok: false, error: 'solo_el_anfitrion' };
    if (sala.partida) return { ok: false, error: 'partida_en_curso' };

    const humanos = [...sala.humanos.values()];
    if (humanos.length === 0) return { ok: false, error: 'sin_jugadores' };
    if (humanos.length > MAX_JUGADORES) return { ok: false, error: 'demasiados_jugadores' };

    const total = Math.max(humanos.length, MIN_JUGADORES);
    const jugadores: JugadorSala[] = [...humanos];
    for (let i = humanos.length; i < total; i++) {
      jugadores.push({
        usuarioId: -i - 1,
        nombre: NOMBRES_BOT[i - humanos.length],
        color: COLORES[i % COLORES.length],
        esBot: true,
      });
    }

    const permitidas = fichasPorJugadorPermitidas(total);
    const fichas = permitidas.includes(fichasPorJugador) ? fichasPorJugador : 7;

    // Cobrar apuestas (solo humanos)
    const apuesta = sala.apuesta;
    const cobrados: number[] = [];
    for (const j of jugadores) {
      if (j.esBot) continue;
      if (apuesta > 0) {
        const ok = await intentarCobrar(this.db, j.usuarioId, apuesta, 'Apuesta en partida');
        if (!ok) {
          for (const id of cobrados) {
            await ajustarSaldo(this.db, id, apuesta, 'reembolso', 'Reembolso por apuesta no confirmada');
          }
          return { ok: false, error: 'sin_saldo' };
        }
        cobrados.push(j.usuarioId);
      }
    }

    const coloresResueltos = resolverColoresDistintos(jugadores.map(j => j.color));
    jugadores.forEach((j, i) => {
      j.color = coloresResueltos?.[i] ?? j.color;
    });
    const estado = iniciarPartida(
      jugadores.map(j => j.nombre),
      { robarPozo, fichasPorJugador: fichas },
      jugadores.map(j => j.color),
    );
    // Adjuntar la racha, la foto y el color de cada jugador humano (los bots van a 0 / sin foto)
    const rachas: Record<number, number> = {};
    for (let i = 0; i < estado.jugadores.length; i++) {
      const j = estado.jugadores[i];
      j.racha = jugadores[i].esBot ? 0 : await obtenerRacha(this.db, jugadores[i].usuarioId);
      j.foto = jugadores[i].foto;
      j.color = jugadores[i].color;
      rachas[jugadores[i].usuarioId] = j.racha;
    }
    sala.partida = {
      opciones: { robarPozo, fichasPorJugador: fichas },
      estado,
      jugadores,
      apuesta,
      pagada: false,
      humanosInicio: humanos.length,
    };
    sala.pausa = null;
    sala.estado = 'jugando';
    await this.db.ejecutar("UPDATE salas SET estado = 'jugando' WHERE codigo = $1", [sala.codigo]);

    this.io.to(sala.codigo).emit('partida:empezada', {
      jugadores: jugadores.map((j, i) => ({
        id: j.usuarioId,
        nombre: j.nombre,
        color: j.color,
        esBot: j.esBot,
        orden: i,
        racha: rachas[j.usuarioId],
        foto: j.foto,
      })),
      opciones: sala.partida.opciones,
      apuesta,
    });
    this.emitirSala(sala);

    void this.avanzar(sala);
    return { ok: true };
  }

  // ---------- Acciones del jugador humano ----------

  async jugar(socket: Socket, codigo: string, fichaId: string, extremo: 'izquierdo' | 'derecho'): Promise<{ ok: boolean; error?: string }> {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const sala = this.salas.get(codigo.toUpperCase());
    if (!sala?.partida) return { ok: false, error: 'sin_partida' };
    const partida = sala.partida;
    if (partida.pagada) return { ok: false, error: 'partida_terminada' };

    const idx = partida.jugadores.findIndex(j => j.usuarioId === usuario.id);
    if (idx === -1) return { ok: false, error: 'no_estas_en_la_partida' };
    if (idx !== partida.estado.turnoActual) return { ok: false, error: 'no_es_tu_turno' };

    const jugador = partida.estado.jugadores[idx];
    const ficha = jugador.mano.find(f => f.id === fichaId);
    if (!ficha) return { ok: false, error: 'ficha_no_en_mano' };

    const extremos = obtenerExtremosJugables(ficha, partida.estado);
    if (extremos.length === 0) return { ok: false, error: 'ficha_no_jugable' };
    if (extremos.length === 1 && !extremos.includes(extremo)) return { ok: false, error: 'solo_otro_extremo' };

    try {
      const nuevo = aplicarJugada(partida.estado, { jugadorId: jugador.id, ficha, extremo });
      partida.estado = nuevo;
      void this.avanzar(sala);
      return { ok: true };
    } catch {
      return { ok: false, error: 'jugada_invalida' };
    }
  }

  async robar(socket: Socket, codigo: string): Promise<{ ok: boolean; error?: string }> {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const sala = this.salas.get(codigo.toUpperCase());
    if (!sala?.partida) return { ok: false, error: 'sin_partida' };
    const partida = sala.partida;
    if (partida.pagada) return { ok: false, error: 'partida_terminada' };

    const idx = partida.jugadores.findIndex(j => j.usuarioId === usuario.id);
    if (idx === -1) return { ok: false, error: 'no_estas_en_la_partida' };
    if (idx !== partida.estado.turnoActual) return { ok: false, error: 'no_es_tu_turno' };

    if (!partida.opciones.robarPozo) return { ok: false, error: 'sin_pozo' };
    const jugadorId = partida.estado.jugadores[idx].id;
    if (obtenerFichasJugables(jugadorId, partida.estado).length > 0) return { ok: false, error: 'no_puedes_robar' };
    if (partida.estado.pozo.length === 0) return { ok: false, error: 'pozo_vacio' };

    partida.estado = robarDelPozo(partida.estado);
    this.emitirEstado(sala);
    return { ok: true };
  }

  async pasar(socket: Socket, codigo: string): Promise<{ ok: boolean; error?: string }> {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const sala = this.salas.get(codigo.toUpperCase());
    if (!sala?.partida) return { ok: false, error: 'sin_partida' };
    const partida = sala.partida;
    if (partida.pagada) return { ok: false, error: 'partida_terminada' };

    const idx = partida.jugadores.findIndex(j => j.usuarioId === usuario.id);
    if (idx === -1) return { ok: false, error: 'no_estas_en_la_partida' };
    if (idx !== partida.estado.turnoActual) return { ok: false, error: 'no_es_tu_turno' };

    const jugadorId = partida.estado.jugadores[idx].id;
    if (obtenerFichasJugables(jugadorId, partida.estado).length > 0) return { ok: false, error: 'no_puedes_pasar' };
    if (partida.opciones.robarPozo && partida.estado.pozo.length > 0) return { ok: false, error: 'pozo_debes_robar' };

    partida.estado = pasarTurno(partida.estado);
    void this.avanzar(sala);
    return { ok: true };
  }

  // ---------- Chat de la sala ----------

  chat(socket: Socket, codigo: string, texto: string): { ok: boolean; error?: string } {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const sala = this.salas.get(codigo.toUpperCase());
    if (!sala) return { ok: false, error: 'sala_no_encontrada' };
    if (!sala.humanos.has(usuario.id)) return { ok: false, error: 'no_estas_en_la_sala' };

    const limpio = String(texto ?? '').trim();
    if (!limpio || limpio.length > CHAT_MAX_LONGITUD) return { ok: false, error: 'mensaje_invalido' };

    const ahora = Date.now();
    const ultimo = this.ultimoChat.get(socket.id);
    if (ultimo && ahora - ultimo < CHAT_COOLDOWN_MS) return { ok: false, error: 'chat_demasiado_rapido' };
    this.ultimoChat.set(socket.id, ahora);

    const mensaje: MensajeChat = {
      id: (sala.mensajes[sala.mensajes.length - 1]?.id ?? 0) + 1,
      usuarioId: usuario.id,
      nombre: usuario.nombre,
      color: usuario.color,
      foto: usuario.foto ?? undefined,
      texto: limpio,
      ts: ahora,
    };
    sala.mensajes.push(mensaje);
    if (sala.mensajes.length > MAX_MENSAJES_CHAT) {
      sala.mensajes.splice(0, sala.mensajes.length - MAX_MENSAJES_CHAT);
    }
    this.io.to(sala.codigo).emit('chat:mensaje', { mensaje });
    return { ok: true };
  }

  // ---------- Pausa por abandono ----------

  async esperar(socket: Socket, codigo: string): Promise<{ ok: boolean; error?: string }> {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const sala = this.salas.get(codigo.toUpperCase());
    if (!sala?.partida) return { ok: false, error: 'sin_partida' };
    if (!sala.pausa) return { ok: false, error: 'sin_abandono' };
    if (!sala.humanos.has(usuario.id)) return { ok: false, error: 'no_estas_en_la_partida' };
    // El jugador elige esperar: la partida queda pausada hasta que vuelva el rival.
    return { ok: true };
  }

  async abandonarPartida(socket: Socket, codigo: string): Promise<{ ok: boolean; error?: string }> {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const sala = this.salas.get(codigo.toUpperCase());
    const partida = sala?.partida;
    if (!sala || !partida || partida.pagada) return { ok: false, error: 'sin_partida' };
    if (!sala.humanos.has(usuario.id)) return { ok: false, error: 'no_estas_en_la_partida' };

    partida.pagada = true;
    const apuesta = partida.apuesta;
    const pot = apuesta * partida.humanosInicio;

    // Estadísticas: el que se queda gana; quien abandonó pierde y corta su racha
    await registrarResultado(this.db, usuario.id, 'victoria');
    if (sala.pausa) await registrarResultado(this.db, sala.pausa.jugadorId, 'derrota');

    const pagos: Record<number, { tipo: 'ganancia' | 'reembolso' | 'perdida'; monto: number }> = {};
    if (apuesta > 0) {
      // El que se queda gana el pozo: el rival abandonó la partida
      await ajustarSaldo(this.db, usuario.id, pot, 'ganancia', 'Premio por abandono del rival');
      await crearNotificacion(this.db, usuario.id, 'Victoria', `Ganaste ${pot} créditos`);
      pagos[usuario.id] = { tipo: 'ganancia', monto: pot };
    }

    this.io.to(sala.codigo).emit('partida:terminada', {
      estado: partida.estado,
      apuesta,
      pot,
      pagos,
      motivo: 'abandono',
    });

    sala.partida = null;
    sala.pausa = null;
    sala.estado = 'espera';
    await this.db.ejecutar("UPDATE salas SET estado = 'espera' WHERE codigo = $1", [sala.codigo]);
    this.emitirSala(sala);
    return { ok: true };
  }

  // ---------- Internos ----------

  private emitirSala(sala: Sala): void {
    this.io.to(sala.codigo).emit('sala:actualizada', snapshotSala(sala));
  }

  private emitirEstado(sala: Sala): void {
    if (!sala.partida) return;
    this.io.to(sala.codigo).emit('partida:estado', { estado: sala.partida.estado });
  }

  // Avanza turnos: auto-pase, bots y finalización
  private async avanzar(sala: Sala): Promise<void> {
    if (this.cerrado) return;
    const partida = sala.partida;
    if (!partida || partida.pagada || sala.pausa) return;
    let estado = partida.estado;

    // Auto-pase de jugadores que no pueden jugar ni robar
    while (true) {
      const jugadorActual = estado.jugadores[estado.turnoActual];
      const puedeJugar = obtenerFichasJugables(jugadorActual.id, estado).length > 0;
      const puedeRobar = partida.opciones.robarPozo && estado.pozo.length > 0;
      if (puedeJugar || puedeRobar || estado.ganador || verificarPartidaTrabada(estado)) break;
      estado = pasarTurno(estado);
    }
    partida.estado = estado;

    if (estado.ganador || verificarPartidaTrabada(estado)) {
      await this.finalizar(sala);
      return;
    }

    const idx = estado.turnoActual;
    if (partida.jugadores[idx].esBot) {
      partida.estado = this.resolverTurnoBot(estado);
      this.emitirEstado(sala);
      if (partida.estado.ganador || verificarPartidaTrabada(partida.estado)) {
        await this.finalizar(sala);
      } else {
        // Reencolar en caso de bots consecutivos
        const t = setTimeout(() => {
          this.timerAvanzar.delete(sala.codigo);
          void this.avanzar(sala);
        }, 450);
        this.timerAvanzar.set(sala.codigo, t);
      }
      return;
    }

    this.emitirEstado(sala);
  }

  private resolverTurnoBot(estado: EstadoPartida): EstadoPartida {
    let s = estado;
    const jugadorId = s.jugadores[s.turnoActual].id;

    while (obtenerFichasJugables(jugadorId, s).length === 0 && s.pozo.length > 0) {
      s = robarDelPozo(s);
    }

    const jugables = obtenerFichasJugables(jugadorId, s);
    if (jugables.length > 0) {
      const ficha = jugables[Math.floor(Math.random() * jugables.length)];
      const extremos = obtenerExtremosJugables(ficha, s);
      const extremo = extremos[Math.floor(Math.random() * extremos.length)];
      s = aplicarJugada(s, { jugadorId, ficha, extremo });
    } else {
      s = pasarTurno(s);
    }
    return s;
  }

  private async finalizar(sala: Sala): Promise<void> {
    const partida = sala.partida;
    if (!partida || partida.pagada) return;
    partida.pagada = true;

    // Partida trabada: se cierra y gana quien tenga menos puntos en la mano
    const estadoInicial = partida.estado;
    if (verificarPartidaTrabada(estadoInicial)) {
      const ganadorTrabado = obtenerGanadorTrabado(estadoInicial);
      partida.estado = { ...estadoInicial, partidaTrabada: true, ganador: ganadorTrabado };
    }

    const humanos = partida.jugadores.filter(j => !j.esBot);
    const apuesta = partida.apuesta;
    const pot = apuesta * humanos.length;

    // Resultado por jugador humano (para mostrarlo en cada cliente)
    const pagos: Record<number, { tipo: 'ganancia' | 'reembolso' | 'perdida'; monto: number }> = {};

    const estado = partida.estado;
    const ganadorIdx = estado.ganador ? parseInt(estado.ganador.replace('jugador-', ''), 10) : -1;
    const ganador = Number.isInteger(ganadorIdx) ? partida.jugadores[ganadorIdx] : undefined;

    // Estadísticas (victoria/derrota/racha) independientemente de la apuesta
    if (ganador && !ganador.esBot) {
      await registrarResultado(this.db, ganador.usuarioId, 'victoria');
      for (const h of humanos) {
        if (h.usuarioId !== ganador.usuarioId) await registrarResultado(this.db, h.usuarioId, 'derrota');
      }
    } else if (ganador && ganador.esBot) {
      // Ganó un bot: los humanos pierden
      for (const h of humanos) await registrarResultado(this.db, h.usuarioId, 'derrota');
    }

    if (apuesta > 0 && humanos.length > 0) {
      if (ganador && !ganador.esBot) {
        await ajustarSaldo(this.db, ganador.usuarioId, pot, 'ganancia', 'Premio de la partida');
        await crearNotificacion(this.db, ganador.usuarioId, 'Victoria', `Ganaste ${pot} créditos`);
        for (const h of humanos) {
          pagos[h.usuarioId] =
            h.usuarioId === ganador.usuarioId
              ? { tipo: 'ganancia', monto: pot }
              : { tipo: 'perdida', monto: -apuesta };
        }
      } else {
        // Ganó un bot o hay empate: se devuelve la apuesta a cada humano
        for (const h of humanos) {
          await ajustarSaldo(this.db, h.usuarioId, apuesta, 'reembolso', 'Reembolso por partida trabada');
          pagos[h.usuarioId] = { tipo: 'reembolso', monto: apuesta };
        }
      }
    }

    this.io.to(sala.codigo).emit('partida:terminada', { estado: partida.estado, apuesta, pot, pagos });

    sala.partida = null;
    sala.pausa = null;
    sala.estado = 'espera';
    await this.db.ejecutar("UPDATE salas SET estado = 'espera' WHERE codigo = $1", [sala.codigo]);
    this.emitirSala(sala);
  }
}

export function registrarSockets(io: Server, db: Db): SalaManager {
  // Autenticación en el handshake con el JWT de Supabase
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const datos = typeof token === 'string' ? await verToken(token) : null;
      if (!datos) {
        next(new Error('no_autenticado'));
        return;
      }
      const fila = await db.one<{
        id: number;
        nombre: string;
        color: string;
        saldo: number;
        foto?: string | null;
      }>('SELECT id, nombre, color, saldo, foto_url AS foto FROM perfiles WHERE auth_uid = $1', [datos.uid]);
      if (!fila) {
        next(new Error('usuario_no_existe'));
        return;
      }
      socket.data.usuario = fila;
      next();
    } catch (e) {
      next(e as Error);
    }
  });

  const manager = new SalaManager(io, db);

  io.on('connection', socket => {
    socket.on('sala:unirse', async (codigo: string) => {
      const res = await manager.unirse(socket, String(codigo ?? ''));
      if (!res.ok) socket.emit('sala:error', { error: res.error });
    });

    socket.on('sala:salir', () => {
      void manager.salir(socket);
    });

    socket.on('sala:actualizar_perfil', () => {
      void manager.actualizarPerfil(socket);
    });

    socket.on('sala:empezar', (payload: { codigo: string; robarPozo?: boolean; fichasPorJugador?: number }) => {
      void manager
        .empezar(
          socket,
          String(payload?.codigo ?? ''),
          payload?.robarPozo !== false,
          Number(payload?.fichasPorJugador ?? 7),
        )
        .then(res => {
          if (!res.ok) socket.emit('sala:error', { error: res.error });
        });
    });

    socket.on('partida:jugar', (payload: { codigo: string; fichaId: string; extremo: 'izquierdo' | 'derecho' }) => {
      void manager.jugar(socket, String(payload?.codigo ?? ''), String(payload?.fichaId ?? ''), payload?.extremo ?? 'derecho').then(res => {
        if (!res.ok) socket.emit('sala:error', { error: res.error });
      });
    });

    socket.on('partida:robar', (payload: { codigo: string }) => {
      void manager.robar(socket, String(payload?.codigo ?? '')).then(res => {
        if (!res.ok) socket.emit('sala:error', { error: res.error });
      });
    });

    socket.on('partida:pasar', (payload: { codigo: string }) => {
      void manager.pasar(socket, String(payload?.codigo ?? '')).then(res => {
        if (!res.ok) socket.emit('sala:error', { error: res.error });
      });
    });

    socket.on('partida:esperar', (payload: { codigo: string }) => {
      void manager.esperar(socket, String(payload?.codigo ?? '')).then(res => {
        if (!res.ok) socket.emit('sala:error', { error: res.error });
      });
    });

    socket.on('partida:abandonar', (payload: { codigo: string }) => {
      void manager.abandonarPartida(socket, String(payload?.codigo ?? '')).then(res => {
        if (!res.ok) socket.emit('sala:error', { error: res.error });
      });
    });

    socket.on('chat:enviar', (payload: { codigo: string; texto: string }) => {
      const res = manager.chat(socket, String(payload?.codigo ?? ''), String(payload?.texto ?? ''));
      if (!res.ok) socket.emit('chat:error', { error: res.error });
    });

    socket.on('disconnect', () => {
      void manager.desconectar(socket);
    });
  });

  return manager;
}
