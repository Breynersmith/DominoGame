// src/store/onlineStore.ts
// Estado de las partidas en línea: conexión Socket.IO, sala y partida en tiempo real.

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../services/api';
import { EstadoPartida } from '../game/types';
import { useAppStore } from './appStore';

export interface JugadorOnline {
  id: number;
  nombre: string;
  color: string;
  esBot?: boolean;
  orden?: number;
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

export interface SalaSnapshot {
  codigo: string;
  nombre: string;
  apuesta: number;
  hostId: number;
  estado: 'espera' | 'jugando';
  jugadores: JugadorOnline[];
  partida: { empezada: boolean } | null;
}

export type FaseOnline = 'desconectado' | 'espera' | 'jugando' | 'terminado';

export interface PagoOnline {
  tipo: 'ganancia' | 'reembolso' | 'perdida';
  monto: number;
}

interface OnlineStore {
  conectado: boolean;
  fase: FaseOnline;
  sala: SalaSnapshot | null;
  estado: EstadoPartida | null;
  mensaje: string | null;
  pago: PagoOnline | null;
  apuesta: number;
  pot: number;
  robarPozo: boolean;
  fichasPorJugador: number;
  esHost: boolean;
  miOrden: number | null;
  miEsTurno: boolean;
  abandono: { id: number; nombre: string } | null;
  esperando: boolean;
  terminadaPorAbandono: boolean;
  chatMensajes: MensajeChat[];
  chatError: string | null;
  conectarse: () => boolean;
  desconectar: () => void;
  unirseSala: (codigo: string) => void;
  salirSala: () => void;
  actualizarPerfil: () => void;
  empezar: () => void;
  jugar: (fichaId: string, extremo: 'izquierdo' | 'derecho') => void;
  robar: () => void;
  pasar: () => void;
  esperar: () => void;
  abandonarPartida: () => void;
  enviarChat: (texto: string) => void;
  reset: () => void;
}

let socket: Socket | null = null;
let socketToken: string | null = null;

function emitir(evento: string, ...args: unknown[]): void {
  socket?.emit(evento as never, ...(args as never[]));
}

export const useOnlineStore = create<OnlineStore>()((set, get) => {
  const actualizarEstado = (estado: EstadoPartida) =>
    set(s => ({ estado, miEsTurno: estado.turnoActual === s.miOrden }));

  const reiniciarSala = () =>
    set({
      fase: 'desconectado',
      sala: null,
      estado: null,
      mensaje: null,
      pago: null,
      apuesta: 0,
      pot: 0,
      robarPozo: true,
      fichasPorJugador: 7,
      esHost: false,
      miOrden: null,
      miEsTurno: false,
      abandono: null,
      esperando: false,
      terminadaPorAbandono: false,
      chatMensajes: [],
      chatError: null,
    });

  return {
    conectado: false,
    fase: 'desconectado',
    sala: null,
    estado: null,
    mensaje: null,
    pago: null,
    apuesta: 0,
    pot: 0,
    robarPozo: true,
    fichasPorJugador: 7,
    esHost: false,
    miOrden: null,
    miEsTurno: false,
    abandono: null,
    esperando: false,
    terminadaPorAbandono: false,
    chatMensajes: [],
    chatError: null,

    conectarse: () => {
      const token = useAppStore.getState().token;
      const uid = useAppStore.getState().perfil?.id;
      if (!token || uid === undefined) return false;

      // Si existe un socket de una sesión anterior con otro token (p. ej. tras
      // cerrar sesión e iniciar con otra cuenta), se descarta para que la sala
      // se cree y se administre con la identidad actual.
      if (socket && socketToken !== token) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        socketToken = null;
        reiniciarSala();
      }

      if (socket) return true;

      socket = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket'],
      });
      socketToken = token;

      socket.on('connect', () => {
        set({ conectado: true });
        // Tras una reconexión (p. ej. reinicio del servidor) se vuelve a
        // entrar a la sala en la que el jugador estaba.
        const codigo = get().sala?.codigo;
        if (codigo) emitir('sala:unirse', codigo);
      });

      socket.on('sala:actualizada', (snapshot: SalaSnapshot) => {
        const uidActual = useAppStore.getState().perfil?.id;
        set(s => ({
          sala: snapshot,
          esHost: snapshot.hostId === uidActual,
          fase: snapshot.partida?.empezada ? 'jugando' : s.fase === 'terminado' ? 'terminado' : 'espera',
          apuesta: snapshot.apuesta,
        }));
      });

      socket.on('partida:empezada', (datos: { jugadores: JugadorOnline[]; opciones: { robarPozo: boolean; fichasPorJugador?: number }; apuesta: number }) => {
        const uidActual = useAppStore.getState().perfil?.id;
        set({
          fase: 'jugando',
          robarPozo: datos.opciones.robarPozo,
          fichasPorJugador: datos.opciones.fichasPorJugador ?? 7,
          apuesta: datos.apuesta,
          miOrden: datos.jugadores.find(j => j.id === uidActual)?.orden ?? null,
          pago: null,
          mensaje: null,
        });
      });

      socket.on('partida:estado', (datos: { estado: EstadoPartida }) => {
        actualizarEstado(datos.estado);
      });

      socket.on('partida:terminada', (datos: { estado: EstadoPartida; apuesta: number; pot: number; pagos: Record<number, PagoOnline>; motivo?: string }) => {
        const uidActual = useAppStore.getState().perfil?.id;
        actualizarEstado(datos.estado);
        set({
          pot: datos.pot,
          pago: uidActual !== undefined ? datos.pagos[uidActual] ?? null : null,
          fase: 'terminado',
          abandono: null,
          esperando: false,
          terminadaPorAbandono: datos.motivo === 'abandono',
        });
      });

      socket.on('partida:jugador_abandono', (datos: { jugador: { id: number; nombre: string } }) => {
        set({ abandono: datos.jugador, esperando: false });
      });

      socket.on('partida:reanudada', () => {
        set({ abandono: null, esperando: false });
      });

      socket.on('sala:error', (datos: { error: string }) => {
        set({ mensaje: datos.error });
      });

      socket.on('chat:historial', (datos: { mensajes: MensajeChat[] }) => {
        set({ chatMensajes: datos.mensajes ?? [] });
      });

      socket.on('chat:mensaje', (datos: { mensaje: MensajeChat }) => {
        set(s => ({
          chatMensajes: [...s.chatMensajes, datos.mensaje].slice(-100),
          chatError: null,
        }));
      });

      socket.on('chat:error', (datos: { error: string }) => {
        set({ chatError: datos.error });
      });

      socket.on('disconnect', () => {
        // No se borra la sala: si es una caída temporal de la conexión (reinicio
        // del servidor, cambio de red) el cliente se reconecta y se re-une solo.
        set({ conectado: false });
      });

      return true;
    },

    desconectar: () => {
      socket?.disconnect();
      socket = null;
      socketToken = null;
      reiniciarSala();
    },

    unirseSala: codigo => {
      if (!get().conectado) get().conectarse();
      // Al unirse se vuelve a la fase de espera (evita quedarse con la pantalla
      // de una partida anterior terminada).
      set({ mensaje: null, pago: null, fase: 'espera' });
      emitir('sala:unirse', codigo.trim().toUpperCase());
    },

    salirSala: () => {
      emitir('sala:salir');
      reiniciarSala();
    },

    actualizarPerfil: () => {
      emitir('sala:actualizar_perfil');
    },

    empezar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      emitir('sala:empezar', { codigo, robarPozo: get().robarPozo, fichasPorJugador: get().fichasPorJugador });
    },

    jugar: (fichaId, extremo) => {
      const codigo = get().sala?.codigo;
      if (!codigo || !get().miEsTurno) return;
      emitir('partida:jugar', { codigo, fichaId, extremo });
    },

    robar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo || !get().miEsTurno) return;
      emitir('partida:robar', { codigo });
    },

    pasar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo || !get().miEsTurno) return;
      emitir('partida:pasar', { codigo });
    },

    esperar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      emitir('partida:esperar', { codigo });
      set({ abandono: null, esperando: true });
    },

    abandonarPartida: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      emitir('partida:abandonar', { codigo });
    },

    enviarChat: texto => {
      const codigo = get().sala?.codigo;
      if (!codigo || !get().conectado) return;
      const limpio = texto.trim();
      if (!limpio || limpio.length > 300) return;
      set({ chatError: null });
      emitir('chat:enviar', { codigo, texto: limpio });
    },

    reset: reiniciarSala,
  };
});