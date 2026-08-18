// server/src/sockets/salaManager.ts
// Gestor de salas y partidas en tiempo real con Socket.IO.
// Las partidas son autoritativas: el servidor valida turnos y mueve a los bots.

import { Server, Socket } from 'socket.io';
import { Db, ajustarSaldo, crearNotificacion, intentarCobrar } from '../db';
import { verToken, UsuarioAutenticado } from '../auth';
import {
  aplicarJugada,
  iniciarPartida,
  obtenerExtremosJugables,
  obtenerFichasJugables,
  obtenerGanadorTrabado,
  pasarTurno,
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
}

interface Partida {
  opciones: { robarPozo: boolean };
  estado: EstadoPartida;
  jugadores: JugadorSala[]; // alineados por índice con estado.jugadores
  apuesta: number;
  pagada: boolean;
}

export interface Sala {
  codigo: string;
  nombre: string;
  apuesta: number;
  hostId: number;
  estado: 'espera' | 'jugando';
  humanos: Map<number, JugadorSala>;
  partida: Partida | null;
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
    })),
    partida: sala.partida ? { empezada: true } : null,
  };
}

export class SalaManager {
  private salas = new Map<string, Sala>();
  private socketSala = new Map<string, string>(); // socketId -> codigo

  constructor(
    private io: Server,
    private db: Db,
  ) {}

  // ---------- Unirse / salir ----------

  unirse(socket: Socket, codigo: string): { ok: boolean; error?: string } {
    const usuario = socket.data.usuario as UsuarioAutenticado;
    const codigoUp = codigo.toUpperCase();

    let sala = this.salas.get(codigoUp);
    if (!sala) {
      // Cargar desde BD si existe
      const fila = this.db.prepare('SELECT codigo, nombre, apuesta, host_id, estado FROM salas WHERE codigo = ?').get(codigoUp) as
        | { codigo: string; nombre: string; apuesta: number; host_id: number; estado: string }
        | undefined;
      if (!fila) return { ok: false, error: 'sala_no_encontrada' };
      sala = {
        codigo: fila.codigo,
        nombre: fila.nombre,
        apuesta: fila.apuesta,
        hostId: fila.host_id,
        estado: fila.estado === 'jugando' ? 'jugando' : 'espera',
        humanos: new Map(),
        partida: null,
      };
      this.salas.set(codigoUp, sala);
    }

    if (sala.estado === 'jugando' && !sala.partida) {
      // partida huérfana (reinicio del server): volver a espera
      sala.estado = 'espera';
    }

    this.salirDeSalaActual(socket);
    socket.join(codigoUp);
    this.socketSala.set(socket.id, codigoUp);

    if (!sala.humanos.has(usuario.id)) {
      sala.humanos.set(usuario.id, {
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        color: usuario.color,
        esBot: false,
      });
    }
    // Mantener la pertenencia persistida
    this.db
      .prepare('INSERT OR IGNORE INTO sala_jugadores (sala_id, usuario_id, creado_en) VALUES (?, ?, ?)')
      .run(codigoUp, usuario.id, Date.now());

    this.emitirSala(sala);
    if (sala.partida) {
      socket.emit('partida:estado', { estado: sala.partida.estado });
    }
    return { ok: true };
  }

  salir(socket: Socket): void {
    this.salirDeSalaActual(socket);
  }

  desconectar(socket: Socket): void {
    const codigo = this.socketSala.get(socket.id);
    const sala = codigo ? this.salas.get(codigo) : undefined;
    const usuario = socket.data.usuario as UsuarioAutenticado | undefined;

    if (sala && usuario) {
      sala.humanos.delete(usuario.id);
      // Si la partida está en curso, su asiento pasa a ser un bot que juega solo
      if (sala.partida) {
        sala.partida.jugadores.forEach(j => {
          if (j.usuarioId === usuario.id) j.esBot = true;
        });
      }
      this.emitirSala(sala);
      if (sala.humanos.size === 0) {
        this.salas.delete(codigo!);
      }
    }
    this.socketSala.delete(socket.id);
  }

  private salirDeSalaActual(socket: Socket): void {
    const previo = this.socketSala.get(socket.id);
    if (previo) {
      const sala = this.salas.get(previo);
      const usuario = socket.data.usuario as UsuarioAutenticado | undefined;
      if (sala && usuario) {
        sala.humanos.delete(usuario.id);
        if (sala.partida) {
          sala.partida.jugadores.forEach(j => {
            if (j.usuarioId === usuario.id) j.esBot = true;
          });
        }
        if (sala.humanos.size === 0 && sala.estado === 'espera') {
          this.salas.delete(previo);
        } else if (sala.estado === 'espera') {
          this.emitirSala(sala);
        }
      }
      socket.leave(previo);
      this.socketSala.delete(socket.id);
    }
  }

  // ---------- Empezar partida ----------

  empezar(socket: Socket, codigo: string, robarPozo: boolean): { ok: boolean; error?: string } {
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

    // Cobrar apuestas (solo humanos)
    const apuesta = sala.apuesta;
    const cobrados: number[] = [];
    for (const j of jugadores) {
      if (j.esBot) continue;
      if (apuesta > 0) {
        const ok = intentarCobrar(this.db, j.usuarioId, apuesta, 'Apuesta en partida');
        if (!ok) {
          for (const id of cobrados) ajustarSaldo(this.db, id, apuesta, 'reembolso', 'Reembolso por apuesta no confirmada');
          return { ok: false, error: 'sin_saldo' };
        }
        cobrados.push(j.usuarioId);
      }
    }

    const estado = iniciarPartida(jugadores.map(j => j.nombre), { robarPozo });
    sala.partida = {
      opciones: { robarPozo },
      estado,
      jugadores,
      apuesta,
      pagada: false,
    };
    sala.estado = 'jugando';
    this.db.prepare("UPDATE salas SET estado = 'jugando' WHERE codigo = ?").run(sala.codigo);

    this.io.to(sala.codigo).emit('partida:empezada', {
      jugadores: jugadores.map((j, i) => ({
        id: j.usuarioId,
        nombre: j.nombre,
        color: j.color,
        esBot: j.esBot,
        orden: i,
      })),
      opciones: sala.partida.opciones,
      apuesta,
    });
    this.emitirSala(sala);

    this.avanzar(sala);
    return { ok: true };
  }

  // ---------- Acciones del jugador humano ----------

  jugar(socket: Socket, codigo: string, fichaId: string, extremo: 'izquierdo' | 'derecho'): { ok: boolean; error?: string } {
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
      this.avanzar(sala);
      return { ok: true };
    } catch {
      return { ok: false, error: 'jugada_invalida' };
    }
  }

  robar(socket: Socket, codigo: string): { ok: boolean; error?: string } {
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

  pasar(socket: Socket, codigo: string): { ok: boolean; error?: string } {
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
    this.avanzar(sala);
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
  private avanzar(sala: Sala): void {
    const partida = sala.partida;
    if (!partida || partida.pagada) return;
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
      this.finalizar(sala);
      return;
    }

    const idx = estado.turnoActual;
    if (partida.jugadores[idx].esBot) {
      partida.estado = this.resolverTurnoBot(estado);
      this.emitirEstado(sala);
      if (partida.estado.ganador || verificarPartidaTrabada(partida.estado)) {
        this.finalizar(sala);
      } else {
        // Reencolar en caso de bots consecutivos
        setTimeout(() => this.avanzar(sala), 450);
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

  private finalizar(sala: Sala): void {
    const partida = sala.partida;
    if (!partida || partida.pagada) return;
    partida.pagada = true;

    const humanos = partida.jugadores.filter(j => !j.esBot);
    const apuesta = partida.apuesta;
    const pot = apuesta * humanos.length;

    // Resultado por jugador humano (para mostrarlo en cada cliente)
    const pagos: Record<number, { tipo: 'ganancia' | 'reembolso' | 'perdida'; monto: number }> = {};

    if (apuesta > 0 && humanos.length > 0) {
      const estado = partida.estado;
      const ganadorIdx = estado.ganador ? parseInt(estado.ganador.replace('jugador-', ''), 10) : -1;
      const ganador = Number.isInteger(ganadorIdx) ? partida.jugadores[ganadorIdx] : undefined;

      if (ganador && !ganador.esBot) {
        ajustarSaldo(this.db, ganador.usuarioId, pot, 'ganancia', 'Premio de la partida');
        crearNotificacion(this.db, ganador.usuarioId, 'Victoria', `Ganaste ${pot} créditos`);
        for (const h of humanos) {
          pagos[h.usuarioId] =
            h.usuarioId === ganador.usuarioId
              ? { tipo: 'ganancia', monto: pot }
              : { tipo: 'perdida', monto: -apuesta };
        }
      } else {
        // Ganó un bot o hay empate: se devuelve la apuesta a cada humano
        for (const h of humanos) {
          ajustarSaldo(this.db, h.usuarioId, apuesta, 'reembolso', 'Reembolso por partida trabada');
          pagos[h.usuarioId] = { tipo: 'reembolso', monto: apuesta };
        }
      }
    }

    this.io.to(sala.codigo).emit('partida:terminada', { estado: partida.estado, apuesta, pot, pagos });

    sala.partida = null;
    sala.estado = 'espera';
    this.db.prepare("UPDATE salas SET estado = 'espera' WHERE codigo = ?").run(sala.codigo);
    this.emitirSala(sala);
  }
}

export function registrarSockets(io: Server, db: Db): SalaManager {
  // Autenticación en el handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const datos = typeof token === 'string' ? verToken(token) : null;
    if (!datos) {
      next(new Error('no_autenticado'));
      return;
    }
    const fila = db.prepare('SELECT id, nombre, color, saldo FROM usuarios WHERE id = ?').get(datos.uid) as
      | { id: number; nombre: string; color: string; saldo: number }
      | undefined;
    if (!fila) {
      next(new Error('usuario_no_existe'));
      return;
    }
    socket.data.usuario = fila;
    next();
  });

  const manager = new SalaManager(io, db);

  io.on('connection', socket => {
    socket.on('sala:unirse', (codigo: string) => {
      const res = manager.unirse(socket, String(codigo ?? ''));
      if (!res.ok) socket.emit('sala:error', { error: res.error });
    });

    socket.on('sala:salir', () => manager.salir(socket));

    socket.on('sala:empezar', (payload: { codigo: string; robarPozo?: boolean }) => {
      const res = manager.empezar(socket, String(payload?.codigo ?? ''), payload?.robarPozo !== false);
      if (!res.ok) socket.emit('sala:error', { error: res.error });
    });

    socket.on('partida:jugar', (payload: { codigo: string; fichaId: string; extremo: 'izquierdo' | 'derecho' }) => {
      const res = manager.jugar(socket, String(payload?.codigo ?? ''), String(payload?.fichaId ?? ''), payload?.extremo ?? 'derecho');
      if (!res.ok) socket.emit('sala:error', { error: res.error });
    });

    socket.on('partida:robar', (payload: { codigo: string }) => {
      const res = manager.robar(socket, String(payload?.codigo ?? ''));
      if (!res.ok) socket.emit('sala:error', { error: res.error });
    });

    socket.on('partida:pasar', (payload: { codigo: string }) => {
      const res = manager.pasar(socket, String(payload?.codigo ?? ''));
      if (!res.ok) socket.emit('sala:error', { error: res.error });
    });

    socket.on('disconnect', () => manager.desconectar(socket));
  });

  return manager;
}