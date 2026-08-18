// src/store/gameStore.ts

import { create } from 'zustand';
import {
  iniciarPartida,
  aplicarJugada,
  pasarTurno,
  robarDelPozo,
  obtenerFichasJugables,
  obtenerExtremosJugables,
  verificarPartidaTrabada,
  obtenerGanadorTrabado,
} from '../game/engine';
import { EstadoPartida, Jugador, OpcionesPartida } from '../game/types';
import { useAppStore, idiomaActual } from './appStore';
import { traducir } from '../i18n/traducciones';
import { ClaveTraduccion } from '../i18n/useT';
import { reproducir } from '../services/sonido';

export interface ConfigJugador {
  nombre: string;
  esBot: boolean;
}

type Fase = 'configuracion' | 'jugando' | 'terminado';

export type ResultadoPago =
  | { tipo: 'ganancia'; monto: number }
  | { tipo: 'reembolso'; monto: number }
  | { tipo: 'perdida'; monto: number };

interface GameStore {
  fase: Fase;
  config: ConfigJugador[];
  opciones: OpcionesPartida;
  estado: EstadoPartida | null;
  mensaje: string | null;
  pago: ResultadoPago | null;
  iniciar: (config: ConfigJugador[], opciones?: OpcionesPartida) => void;
  jugar: (fichaId: string, extremo: 'izquierdo' | 'derecho') => void;
  robar: () => void;
  pasar: () => void;
  resolverTurnoBot: () => void;
  reiniciar: () => void;
  resolverYpagar: (avanzado: EstadoPartida) => void;
}

// Traduce un mensaje con el idioma de los ajustes actuales
function msg(clave: ClaveTraduccion, params?: Record<string, string | number>): string {
  return traducir(idiomaActual(), clave, params);
}

// Avanza turnos automáticamente cuando el jugador en turno no tiene fichas
// jugables y no puede robar del pozo (o el pozo no está habilitado)
function avanzarAutomatico(estado: EstadoPartida, puedeRobar: boolean): EstadoPartida {
  let s = { ...estado };
  for (let i = 0; i < s.jugadores.length; i++) {
    const jugador = s.jugadores[s.turnoActual];
    if (obtenerFichasJugables(jugador.id, s).length > 0 || (puedeRobar && s.pozo.length > 0)) break;
    s = pasarTurno(s);
  }
  return s;
}

// Cierra la partida si hay ganador o la partida quedó trabada
function resolverFinDePartida(estado: EstadoPartida): { estado: EstadoPartida; fase: Fase } {
  if (estado.ganador) {
    reproducir('ganar');
    return { estado, fase: 'terminado' };
  }
  if (verificarPartidaTrabada(estado)) {
    const ganador = obtenerGanadorTrabado(estado);
    reproducir('ganar');
    return {
      estado: { ...estado, partidaTrabada: true, ganador },
      fase: 'terminado',
    };
  }
  return { estado, fase: 'jugando' };
}

export const useGameStore = create<GameStore>()((set, get) => ({
  fase: 'configuracion',
  config: [],
  opciones: { robarPozo: true, apuesta: 0 },
  estado: null,
  mensaje: null,
  pago: null,

  resolverYpagar: (avanzado: EstadoPartida) => {
    const { estado: final, fase } = resolverFinDePartida(avanzado);
    let pago: ResultadoPago | null = null;
    if (fase === 'terminado') {
      const apuesta = get().opciones.apuesta ?? 0;
      if (apuesta > 0) {
        const local = get().config.findIndex(c => !c.esBot);
        const localId = final.jugadores[local]?.id;
        if (local !== -1 && localId === final.ganador) {
          const monto = apuesta * final.jugadores.length;
          useAppStore.getState().abonarResultado('ganancia', monto, msg('gananciaDescTx'));
          pago = { tipo: 'ganancia', monto };
        } else if (local !== -1 && final.partidaTrabada) {
          useAppStore.getState().abonarResultado('reembolso', apuesta, msg('reembolsoDesc'));
          pago = { tipo: 'reembolso', monto: apuesta };
        } else if (local !== -1) {
          pago = { tipo: 'perdida', monto: -apuesta };
        }
      }
    }
    set({ estado: final, fase, pago, mensaje: null });
  },

  iniciar: (config, opciones = { robarPozo: true, apuesta: 0 }) => {
    const estado = iniciarPartida(config.map(c => c.nombre), opciones);
    const jugadores: Jugador[] = estado.jugadores.map((j, i) => ({
      ...j,
      esBot: config[i].esBot,
    }));

    const local = config.findIndex(c => !c.esBot);
    if ((opciones.apuesta ?? 0) > 0 && local !== -1) {
      useAppStore.getState().cobrarApuesta(opciones.apuesta ?? 0, msg('apuestaDescTx'));
    }

    set({
      config,
      opciones,
      estado: { ...estado, jugadores },
      fase: 'jugando',
      mensaje: null,
      pago: null,
    });
  },

  jugar: (fichaId, extremo) => {
    const { estado, fase } = get();
    if (fase !== 'jugando' || !estado) return;

    const jugador = estado.jugadores[estado.turnoActual];
    if (!jugador || jugador.esBot) return;

    const ficha = jugador.mano.find(f => f.id === fichaId);
    if (!ficha) {
      set({ mensaje: msg('tileNoEnMano') });
      return;
    }

    const extremos = obtenerExtremosJugables(ficha, estado);
    if (extremos.length === 0) {
      set({ mensaje: msg('tileNoJugable') });
      return;
    }
    if (extremos.length === 1 && !extremos.includes(extremo)) {
      set({ mensaje: msg('soloOtroExtremo') });
      return;
    }

    try {
      const nuevo = aplicarJugada(estado, { jugadorId: jugador.id, ficha, extremo });
      reproducir('colocar');
      const avanzado = avanzarAutomatico(nuevo, get().opciones.robarPozo);
      get().resolverYpagar(avanzado);
    } catch {
      reproducir('error');
      set({ mensaje: msg('jugadaInvalida') });
    }
  },

  robar: () => {
    const { estado, fase } = get();
    if (fase !== 'jugando' || !estado) return;

    const jugador = estado.jugadores[estado.turnoActual];
    if (!jugador || jugador.esBot) return;

    if (!get().opciones.robarPozo) {
      set({ mensaje: msg('sinPozo') });
      return;
    }

    if (obtenerFichasJugables(jugador.id, estado).length > 0) {
      set({ mensaje: msg('noPuedesRobar') });
      return;
    }
    if (estado.pozo.length === 0) {
      set({ mensaje: msg('pozoVacioPasar') });
      return;
    }

    const nuevo = robarDelPozo(estado);
    reproducir('robar');
    set({ estado: nuevo, mensaje: null });
  },

  pasar: () => {
    const { estado, fase } = get();
    if (fase !== 'jugando' || !estado) return;

    const jugador = estado.jugadores[estado.turnoActual];
    if (!jugador || jugador.esBot) return;

    if (obtenerFichasJugables(jugador.id, estado).length > 0) {
      set({ mensaje: msg('noPuedesPasar') });
      return;
    }
    if (get().opciones.robarPozo && estado.pozo.length > 0) {
      set({ mensaje: msg('pozoDebesRobar') });
      return;
    }

    const avanzado = avanzarAutomatico(pasarTurno(estado), get().opciones.robarPozo);
    reproducir('pasar');
    get().resolverYpagar(avanzado);
  },

  resolverTurnoBot: () => {
    const { estado, fase } = get();
    if (fase !== 'jugando' || !estado) return;

    const jugador = estado.jugadores[estado.turnoActual];
    if (!jugador || !jugador.esBot) return;

    const puedeRobar = get().opciones.robarPozo;
    let s = estado;

    // Si no puede jugar, roba del pozo hasta poder jugar o hasta agotarlo
    if (puedeRobar) {
      while (obtenerFichasJugables(jugador.id, s).length === 0 && s.pozo.length > 0) {
        s = robarDelPozo(s);
      }
    }

    const jugables = obtenerFichasJugables(jugador.id, s);
    if (jugables.length > 0) {
      const ficha = jugables[Math.floor(Math.random() * jugables.length)];
      const extremos = obtenerExtremosJugables(ficha, s);
      const extremo = extremos[Math.floor(Math.random() * extremos.length)];
      s = aplicarJugada(s, { jugadorId: jugador.id, ficha, extremo });
      reproducir('colocar');
    } else {
      s = pasarTurno(s);
      reproducir('pasar');
    }

    const avanzado = avanzarAutomatico(s, puedeRobar);
    get().resolverYpagar(avanzado);
  },

  reiniciar: () => {
    set({
      fase: 'configuracion',
      config: [],
      opciones: { robarPozo: true, apuesta: 0 },
      estado: null,
      mensaje: null,
      pago: null,
    });
  },
}));
