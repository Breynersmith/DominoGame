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
  esHost: boolean;
  miOrden: number | null;
  miEsTurno: boolean;
  conectarse: () => boolean;
  desconectar: () => void;
  unirseSala: (codigo: string) => void;
  salirSala: () => void;
  empezar: () => void;
  jugar: (fichaId: string, extremo: 'izquierdo' | 'derecho') => void;
  robar: () => void;
  pasar: () => void;
  reset: () => void;
}

let socket: Socket | null = null;

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
      esHost: false,
      miOrden: null,
      miEsTurno: false,
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
    esHost: false,
    miOrden: null,
    miEsTurno: false,

    conectarse: () => {
      if (socket) return true;
      const token = useAppStore.getState().token;
      const uid = useAppStore.getState().perfil?.id;
      if (!token || uid === undefined) return false;

      socket = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket'],
      });

      socket.on('connect', () => set({ conectado: true }));

      socket.on('sala:actualizada', (snapshot: SalaSnapshot) => {
        const uidActual = useAppStore.getState().perfil?.id;
        set({
          sala: snapshot,
          esHost: snapshot.hostId === uidActual,
          fase: snapshot.partida?.empezada ? 'jugando' : 'espera',
          apuesta: snapshot.apuesta,
        });
      });

      socket.on('partida:empezada', (datos: { jugadores: JugadorOnline[]; opciones: { robarPozo: boolean }; apuesta: number }) => {
        const uidActual = useAppStore.getState().perfil?.id;
        set({
          fase: 'jugando',
          robarPozo: datos.opciones.robarPozo,
          apuesta: datos.apuesta,
          miOrden: datos.jugadores.find(j => j.id === uidActual)?.orden ?? null,
          pago: null,
          mensaje: null,
        });
      });

      socket.on('partida:estado', (datos: { estado: EstadoPartida }) => {
        actualizarEstado(datos.estado);
      });

      socket.on('partida:terminada', (datos: { estado: EstadoPartida; apuesta: number; pot: number; pagos: Record<number, PagoOnline> }) => {
        const uidActual = useAppStore.getState().perfil?.id;
        actualizarEstado(datos.estado);
        set({
          pot: datos.pot,
          pago: uidActual !== undefined ? datos.pagos[uidActual] ?? null : null,
          fase: 'terminado',
        });
      });

      socket.on('sala:error', (datos: { error: string }) => {
        set({ mensaje: datos.error });
      });

      socket.on('disconnect', () => {
        set({ conectado: false });
        reiniciarSala();
      });

      return true;
    },

    desconectar: () => {
      socket?.disconnect();
      socket = null;
      reiniciarSala();
    },

    unirseSala: codigo => {
      if (!get().conectado) get().conectarse();
      set({ mensaje: null, pago: null });
      emitir('sala:unirse', codigo.trim().toUpperCase());
    },

    salirSala: () => {
      emitir('sala:salir');
      reiniciarSala();
    },

    empezar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      emitir('sala:empezar', { codigo, robarPozo: get().robarPozo });
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

    reset: reiniciarSala,
  };
});