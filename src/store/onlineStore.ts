// src/store/onlineStore.ts
// Estado de las partidas en línea: Edge Functions (REST) + Supabase Realtime.
// El estado vive en Postgres (`salas`, `partidas`, `chat_mensajes`); los
// clientes envían acciones por HTTP y reciben los cambios por `postgres_changes`.

import { create } from 'zustand';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { EstadoPartida } from '../game/types';
import { useAppStore } from './appStore';
import {
  apiAbandonarPartida,
  apiEmpezarPartida,
  apiEnviarChat,
  apiEsperar,
  apiJugar,
  apiObtenerSala,
  apiPasar,
  apiRobar,
  apiSalirSala,
  apiUnirseSala,
  ErrorApi,
} from '../services/api';

export interface JugadorOnline {
  id: number;
  nombre: string;
  color: string;
  esBot?: boolean;
  orden?: number;
  foto?: string | null;
}

export interface MensajeChat {
  id: number;
  usuarioId: number;
  nombre: string;
  color: string;
  foto?: string | null;
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

interface PartidaFila {
  codigo: string;
  opciones: { robarPozo: boolean; fichasPorJugador: number };
  estado: EstadoPartida;
  jugadores: { usuarioId: number; nombre: string; color: string; esBot: boolean; foto?: string }[];
  apuesta: number;
  pagada: number;
  humanos_inicio: number;
  resultado: { pot: number; pagos: Record<number, PagoOnline>; motivo?: string } | null;
}

interface SalaFila {
  codigo: string;
  nombre: string;
  apuesta: number;
  host_id: number;
  estado: string;
  snapshot: SalaSnapshot | null;
  aviso: { tipo: string; jugador: { id: number; nombre: string } } | null;
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

let cliente: SupabaseClient | null = null;
let canal: RealtimeChannel | null = null;

function obtenerCliente(): SupabaseClient | null {
  const token = useAppStore.getState().token;
  if (!token) return null;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anon) return null;
  // Cliente nuevo por sesión: el token se inyecta en las cabeceras para que
  // Realtime y las funciones autoricen con la identidad actual.
  cliente = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

function suscribir(codigo: string): void {
  if (canal) {
    void canal.unsubscribe();
    canal = null;
  }
  const c = cliente;
  if (!c) return;
  canal = c
    .channel(`sala:${codigo}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'salas', filter: `codigo=eq.${codigo}` },
      (payload) => manejarEventoSala(payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partidas', filter: `codigo=eq.${codigo}` },
      (payload) => manejarEventoPartida(payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_mensajes', filter: `sala_id=eq.${codigo}` },
      (payload) => manejarEventoChat(payload),
    );
  canal.subscribe((status) => {
    if (status === 'SUBSCRIBED') useOnlineStore.setState({ conectado: true });
  });
}

function manejarEventoSala(payload: {
  eventType: string;
  new: Partial<SalaFila>;
  old: Partial<SalaFila>;
}): void {
  if (payload.eventType === 'DELETE') {
    useOnlineStore.getState().reset();
    return;
  }
  const fila = payload.new as SalaFila;
  const snapshot = fila.snapshot;
  if (!snapshot) return;
  const uidActual = useAppStore.getState().perfil?.id;
  useOnlineStore.setState((s) => {
    const cambios: Partial<OnlineStore> = {
      sala: snapshot,
      esHost: snapshot.hostId === uidActual,
      apuesta: snapshot.apuesta,
      fase: snapshot.partida?.empezada ? 'jugando' : s.fase === 'terminado' ? 'terminado' : 'espera',
    };
    if (fila.aviso?.tipo === 'jugador_abandono') {
      cambios.abandono = fila.aviso.jugador;
      cambios.esperando = false;
    }
    return cambios;
  });
}

function manejarEventoPartida(payload: {
  eventType: string;
  new: Partial<PartidaFila>;
  old: Partial<PartidaFila>;
}): void {
  const fila = payload.new as PartidaFila;
  if (!fila?.codigo) return;
  const uidActual = useAppStore.getState().perfil?.id;

  if (payload.eventType === 'INSERT') {
    const orden = fila.jugadores.findIndex((j) => j.usuarioId === uidActual);
    useOnlineStore.setState({
      fase: 'jugando',
      estado: fila.estado,
      robarPozo: fila.opciones.robarPozo,
      fichasPorJugador: fila.opciones.fichasPorJugador ?? 7,
      apuesta: fila.apuesta,
      miOrden: orden >= 0 ? orden : null,
      miEsTurno: orden >= 0 ? fila.estado.turnoActual === orden : false,
      pago: null,
      mensaje: null,
      abandono: null,
      esperando: false,
    });
    return;
  }

  if (fila.pagada === 1) {
    const resultado = fila.resultado;
    useOnlineStore.setState((s) => ({
      estado: fila.estado ?? s.estado,
      pot: resultado?.pot ?? s.pot,
      pago: uidActual !== undefined && resultado?.pagos ? resultado.pagos[uidActual] ?? null : null,
      fase: 'terminado',
      abandono: null,
      esperando: false,
      terminadaPorAbandono: resultado?.motivo === 'abandono',
    }));
    return;
  }

  useOnlineStore.setState((s) => ({
    estado: fila.estado ?? s.estado,
    miEsTurno: s.miOrden !== null ? fila.estado.turnoActual === s.miOrden : false,
  }));
}

function manejarEventoChat(payload: {
  eventType: string;
  new: Partial<{
    id: number;
    sala_id: string;
    usuario_id: number;
    nombre: string;
    color: string;
    foto: string | null;
    texto: string;
    ts: number;
  }>;
}): void {
  if (payload.eventType !== 'INSERT') return;
  const fila = payload.new;
  if (!fila?.id) return;
  useOnlineStore.setState((s) => ({
    chatMensajes: [
      ...s.chatMensajes,
      {
        id: fila.id!,
        usuarioId: fila.usuario_id!,
        nombre: fila.nombre ?? '',
        color: fila.color ?? '#2563eb',
        foto: fila.foto ?? undefined,
        texto: fila.texto ?? '',
        ts: fila.ts ?? 0,
      },
    ].slice(-100),
    chatError: null,
  }));
}

function codigoError(e: unknown): string {
  return e instanceof ErrorApi ? e.codigo : 'error_interno';
}

// Re-sincroniza sala + partida desde el servidor. Se usa al empezar (por si el
// canal de Realtime aún no está suscrito y se pierde el INSERT de `partidas`).
function sincronizarPartida(codigo: string): void {
  void apiObtenerSala(codigo)
    .then(r => {
      if (!r.partida) return;
      const uidActual = useAppStore.getState().perfil?.id;
      const idx = r.partida.jugadores.findIndex(j => j.usuarioId === uidActual);
      const estado = r.partida.estado as EstadoPartida;
      useOnlineStore.setState({
        sala: r.sala,
        esHost: r.sala.hostId === uidActual,
        apuesta: r.partida.apuesta,
        estado,
        robarPozo: r.partida.opciones.robarPozo,
        fichasPorJugador: r.partida.opciones.fichasPorJugador,
        miOrden: idx >= 0 ? idx : null,
        miEsTurno: idx >= 0 ? estado.turnoActual === idx : false,
        fase: 'jugando',
        pago: null,
        mensaje: null,
        abandono: null,
        esperando: false,
      });
    })
    .catch(() => {});
}

export const useOnlineStore = create<OnlineStore>()((set, get) => {
  const reiniciarSala = () =>
    set({
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
      if (cliente) {
        // Recargar identidad: en la sala actual se re-suscribe con el token nuevo.
        cliente = null;
        if (canal) {
          void canal.unsubscribe();
          canal = null;
        }
      }
      obtenerCliente();
      const codigo = get().sala?.codigo;
      if (codigo) suscribir(codigo);
      return true;
    },

    desconectar: () => {
      if (canal) {
        void canal.unsubscribe();
        canal = null;
      }
      cliente = null;
      reiniciarSala();
    },

    unirseSala: codigo => {
      const uidActual = useAppStore.getState().perfil?.id;
      if (uidActual === undefined) return;
      set({ mensaje: null, pago: null, fase: 'espera' });
      const codigoLimpio = codigo.trim().toUpperCase();
      void apiUnirseSala(codigoLimpio)
        .then(r => {
          const snapshot = r.sala;
          set({
            conectado: true,
            sala: snapshot,
            esHost: snapshot.hostId === uidActual,
            apuesta: snapshot.apuesta,
            chatMensajes: r.chat ?? [],
            fase: snapshot.partida?.empezada ? 'jugando' : 'espera',
          });
          if (r.partida) {
            const idx = r.partida.jugadores.findIndex(j => j.usuarioId === uidActual);
            set({
              estado: r.partida.estado as EstadoPartida,
              robarPozo: r.partida.opciones.robarPozo,
              fichasPorJugador: r.partida.opciones.fichasPorJugador,
              apuesta: r.partida.apuesta,
              miOrden: idx >= 0 ? idx : null,
              miEsTurno: idx >= 0 ? (r.partida.estado as EstadoPartida).turnoActual === idx : false,
            });
          }
          suscribir(snapshot.codigo);
        })
        .catch(e => {
          set({ mensaje: codigoError(e) });
        });
    },

    salirSala: () => {
      const codigo = get().sala?.codigo;
      if (codigo) void apiSalirSala(codigo).catch(() => {});
      if (canal) {
        void canal.unsubscribe();
        canal = null;
      }
      reiniciarSala();
    },

    actualizarPerfil: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      void apiUnirseSala(codigo)
        .then(r => {
          const uidActual = useAppStore.getState().perfil?.id;
          set(s => ({
            sala: r.sala,
            esHost: r.sala.hostId === uidActual,
            chatMensajes: r.chat ?? s.chatMensajes,
          }));
        })
        .catch(() => {});
    },

    empezar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      set({ mensaje: null });
      void apiEmpezarPartida(codigo, get().robarPozo, get().fichasPorJugador)
        .then(() => sincronizarPartida(codigo))
        .catch(e => {
          set({ mensaje: codigoError(e) });
        });
    },

    jugar: (fichaId, extremo) => {
      const codigo = get().sala?.codigo;
      if (!codigo || !get().miEsTurno) return;
      void apiJugar(codigo, fichaId, extremo).catch(e => {
        set({ mensaje: codigoError(e) });
      });
    },

    robar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo || !get().miEsTurno) return;
      void apiRobar(codigo).catch(e => {
        set({ mensaje: codigoError(e) });
      });
    },

    pasar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo || !get().miEsTurno) return;
      void apiPasar(codigo).catch(e => {
        set({ mensaje: codigoError(e) });
      });
    },

    esperar: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      void apiEsperar(codigo).catch(() => {});
      set({ abandono: null, esperando: true });
    },

    abandonarPartida: () => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      void apiAbandonarPartida(codigo)
        .then(() => {
          if (canal) {
            void canal.unsubscribe();
            canal = null;
          }
          reiniciarSala();
        })
        .catch(e => {
          set({ mensaje: codigoError(e) });
        });
    },

    enviarChat: texto => {
      const codigo = get().sala?.codigo;
      if (!codigo) return;
      const limpio = texto.trim();
      if (!limpio || limpio.length > 300) return;
      set({ chatError: null });
      void apiEnviarChat(codigo, limpio).catch(e => {
        set({ chatError: codigoError(e) });
      });
    },

    reset: reiniciarSala,
  };
});