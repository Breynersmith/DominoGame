// src/store/appStore.ts

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Idioma } from '../i18n/traducciones';
import { useOnlineStore } from './onlineStore';
import {
  apiAgregarAmigo,
  apiEliminarAmigo,
  apiEnviarKyc,
  apiLogin,
  apiLogin2fa,
  apiRecargar,
  apiRecuperar,
  apiRecuperarPregunta,
  apiYo,
  actualizarToken,
  ErrorApi,
  ResultadoLogin,
  UsuarioApi,
} from '../services/api';

export interface PerfilUsuario {
  id?: number;
  nombre: string;
  nombreCompleto?: string;
  email?: string;
  telefono?: string;
  fechaNacimiento?: string;
  pais?: string;
  color: string;
  kycEstado?: string;
  foto?: string;
}

export interface Login2faPendiente {
  identificador: string;
  telefonoEnmascarado: string;
  demo: boolean;
  codigo?: string;
}

export interface Ajustes {
  idioma: Idioma;
  sonido: boolean;
  animarTurno: boolean;
  ayuda: boolean;
}

export type Vista =
  | 'bienvenida'
  | 'registro'
  | 'login'
  | 'recuperar'
  | 'inicio'
  | 'ajustes'
  | 'billetera'
  | 'recargar'
  | 'historial'
  | 'lobby'
  | 'sala'
  | 'perfil'
  | 'editarPerfil'
  | 'kyc'
  | 'pagos'
  | 'amigos'
  | 'notificaciones'
  | 'ayuda'
  | 'terminos'
  | 'juegoResponsable'
  | 'partidaOnline';

export type TipoTransaccion = 'recarga' | 'apuesta' | 'ganancia' | 'reembolso';

export interface Transaccion {
  id: string;
  tipo: TipoTransaccion;
  monto: number;
  fecha: number;
  descripcion: string;
}

export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  fecha: number;
}

const CLAVE_GUARDADO = 'domino:preferencias';
const CLAVE_TOKEN = 'domino:token';

export const AJUSTES_DEFECTO: Ajustes = {
  idioma: 'es',
  sonido: true,
  animarTurno: true,
  ayuda: true,
};

export const SALDO_INICIAL = 1000;

interface DatosGuardados {
  perfil: PerfilUsuario | null;
  ajustes: Ajustes;
  saldo: number;
  transacciones: Transaccion[];
  amigos: string[];
  notificaciones: Notificacion[];
}

export interface SalaConfig {
  nombre: string;
  apuesta: number;
  codigo: string;
}

export type SalaModo = 'crear' | 'unirse';

interface AppStore {
  cargado: boolean;
  perfil: PerfilUsuario | null;
  token: string | null;
  online: boolean;
  login2fa: Login2faPendiente | null;
  ajustes: Ajustes;
  vista: Vista;
  historial: Vista[];
  salaModo: SalaModo;
  modoAmigos: 'lista' | 'invitar';
  salaConfig: SalaConfig | null;
  setSalaModo: (modo: SalaModo) => void;
  setModoAmigos: (modo: 'lista' | 'invitar') => void;
  setSalaConfig: (config: SalaConfig | null) => void;
  saldo: number;
  transacciones: Transaccion[];
  amigos: string[];
  notificaciones: Notificacion[];
  cargar: () => Promise<void>;
  sincronizar: () => Promise<void>;
  registrar: (
    perfil: PerfilUsuario,
    opciones?: { yaRegistrado?: { token: string; usuario: UsuarioApi } },
  ) => void;
  iniciarSesion: (identificador: string, password: string) => Promise<'ok' | '2fa' | 'error'>;
  completar2fa: (codigo: string) => Promise<boolean>;
  cancelar2fa: () => void;
  recuperarContrasena: (telefono: string, codigoOtp: string, nuevoPassword: string) => Promise<boolean>;
  recuperarPorPregunta: (identificador: string, pregunta: string, respuesta: string, nuevoPassword: string) => Promise<boolean>;
  enviarKyc: (tipoDocumento: string, numeroDocumento: string, selfie: string) => Promise<boolean>;
  actualizarAjustes: (cambios: Partial<Ajustes>) => void;
  cerrarSesion: () => void;
  irARegistro: () => void;
  jugarComoInvitado: () => void;
  abrirAjustes: () => void;
  volverInicio: () => void;
  irA: (vista: Vista) => void;
  volverAtras: () => void;
  editarPerfil: (cambios: Partial<PerfilUsuario>) => void;
  recargarSaldo: (monto: number, descripcion: string) => void;
  cobrarApuesta: (monto: number, descripcion: string) => void;
  abonarResultado: (tipo: TipoTransaccion, monto: number, descripcion: string) => void;
  agregarAmigo: (nombre: string) => boolean;
  eliminarAmigo: (nombre: string) => void;
  notificar: (titulo: string, cuerpo: string) => void;
  marcarNotificacionLeida: (id: string) => void;
  limpiarNotificaciones: () => void;
}

function nuevoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function guardar(get: () => AppStore) {
  const { perfil, ajustes, saldo, transacciones, amigos, notificaciones } = get();
  const datos: DatosGuardados = {
    perfil,
    ajustes,
    saldo,
    transacciones,
    amigos,
    notificaciones,
  };
  try {
    await AsyncStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
  } catch {
    // si no se puede persistir, el juego continúa en memoria
  }
}

function mapearUsuario(u: UsuarioApi): PerfilUsuario {
  return { id: u.id, nombre: u.nombre, color: u.color, kycEstado: u.kycEstado ?? 'no_enviado', foto: u.foto };
}

function esErrorDeRed(err: unknown): boolean {
  return err instanceof ErrorApi && err.codigo === 'sin_conexion';
}

async function guardarToken(token: string | null): Promise<void> {
  actualizarToken(token);
  try {
    if (token) await AsyncStorage.setItem(CLAVE_TOKEN, token);
    else await AsyncStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // si no se puede persistir el token, seguimos en memoria
  }
}

async function cargarToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

async function guardarSesionServidor(
  set: (parcial: Partial<AppStore>) => void,
  get: () => AppStore,
  token: string,
  usuario: UsuarioApi
): Promise<void> {
  set({
    token,
    online: true,
    perfil: {
      ...(get().perfil ?? ({} as PerfilUsuario)),
      id: usuario.id,
      nombre: usuario.nombre,
      color: usuario.color,
      kycEstado: usuario.kycEstado ?? 'no_enviado',
      foto: usuario.foto,
    },
    saldo: usuario.saldo,
  });
  actualizarToken(token);
  await guardarToken(token);
}

export const useAppStore = create<AppStore>()((set, get) => ({
  cargado: false,
  perfil: null,
  token: null,
  online: false,
  login2fa: null,
  ajustes: AJUSTES_DEFECTO,
  vista: 'bienvenida',
  historial: [],
  salaModo: 'crear',
  modoAmigos: 'lista',
  salaConfig: null,
  saldo: SALDO_INICIAL,
  transacciones: [],
  amigos: [],
  notificaciones: [],

  cargar: async () => {
    try {
      const bruto = await AsyncStorage.getItem(CLAVE_GUARDADO);
      if (bruto) {
        const datos = JSON.parse(bruto) as DatosGuardados;
        set({
          perfil: datos.perfil ?? null,
          ajustes: { ...AJUSTES_DEFECTO, ...datos.ajustes },
          saldo: typeof datos.saldo === 'number' ? datos.saldo : SALDO_INICIAL,
          transacciones: datos.transacciones ?? [],
          amigos: datos.amigos ?? [],
          notificaciones: datos.notificaciones ?? [],
          vista: datos.perfil ? 'inicio' : 'bienvenida',
          historial: [],
        });
      }
    } catch {
      // si no hay datos guardados o fallan, se muestra la bienvenida
    }
    const token = await cargarToken();
    if (token) {
      actualizarToken(token);
      set({ token });
      await get().sincronizar();
    }
    set({ cargado: true });
  },

  sincronizar: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const { usuario, transacciones } = await apiYo();
      set({
        perfil: get().perfil
          ? {
              ...(get().perfil as PerfilUsuario),
              id: usuario.id,
              nombre: usuario.nombre,
              color: usuario.color,
              kycEstado: usuario.kycEstado ?? 'no_enviado',
              foto: usuario.foto,
            }
          : mapearUsuario(usuario),
        saldo: usuario.saldo,
        transacciones: transacciones.map(t => ({
          id: String(t.id),
          tipo: (['recarga', 'apuesta', 'ganancia', 'reembolso'].includes(t.tipo) ? t.tipo : 'recarga') as TipoTransaccion,
          monto: t.monto,
          fecha: t.fecha,
          descripcion: t.descripcion,
        })),
        online: true,
      });
      void guardar(get);
    } catch (err) {
      if (!esErrorDeRed(err)) {
        // token inválido o usuario eliminado: se cierra la sesión en el servidor
        set({ token: null, online: false });
        await guardarToken(null);
      }
    }
  },

  registrar: (perfil, opciones) => {
    set({ perfil, vista: 'inicio', historial: [] });
    void guardar(get);
    if (opciones?.yaRegistrado) {
      void guardarSesionServidor(set, get, opciones.yaRegistrado.token, opciones.yaRegistrado.usuario);
    }
  },

  iniciarSesion: async (identificador, password) => {
    try {
      const r = await apiLogin(identificador, password);
      if ('requiere2fa' in r) {
        set({
          login2fa: {
            identificador,
            telefonoEnmascarado: r.telefonoEnmascarado,
            demo: r.demo,
            codigo: r.codigo,
          },
        });
        return '2fa';
      }
      await guardarSesionServidor(set, get, r.token, r.usuario);
      set({ login2fa: null, vista: 'inicio', historial: [] });
      return 'ok';
    } catch {
      return 'error';
    }
  },

  completar2fa: async codigo => {
    const pendiente = get().login2fa;
    if (!pendiente) return false;
    try {
      const r = await apiLogin2fa(pendiente.identificador, codigo);
      await guardarSesionServidor(set, get, r.token, r.usuario);
      set({ login2fa: null, vista: 'inicio', historial: [] });
      return true;
    } catch {
      return false;
    }
  },

  cancelar2fa: () => set({ login2fa: null }),

  recuperarContrasena: async (telefono, codigoOtp, nuevoPassword) => {
    try {
      const r = await apiRecuperar(telefono, codigoOtp, nuevoPassword);
      await guardarSesionServidor(set, get, r.token, r.usuario);
      return true;
    } catch {
      return false;
    }
  },

  recuperarPorPregunta: async (identificador, pregunta, respuesta, nuevoPassword) => {
    try {
      const r = await apiRecuperarPregunta(identificador, pregunta, respuesta, nuevoPassword);
      await guardarSesionServidor(set, get, r.token, r.usuario);
      return true;
    } catch {
      return false;
    }
  },

  enviarKyc: async (tipoDocumento, numeroDocumento, selfie) => {
    try {
      const r = await apiEnviarKyc({ tipoDocumento, numeroDocumento, selfie });
      set({
        perfil: get().perfil ? { ...(get().perfil as PerfilUsuario), kycEstado: r.estado } : null,
      });
      void guardar(get);
      return true;
    } catch {
      return false;
    }
  },

  actualizarAjustes: cambios => {
    set({ ajustes: { ...get().ajustes, ...cambios } });
    void guardar(get);
  },

  cerrarSesion: () => {
    useOnlineStore.getState().desconectar();
    set({ perfil: null, token: null, online: false, login2fa: null, vista: 'bienvenida', historial: [] });
    void guardarToken(null);
    void AsyncStorage.removeItem(CLAVE_GUARDADO).catch(() => {});
  },

  irARegistro: () => get().irA('registro'),
  jugarComoInvitado: () => set({ vista: 'inicio', historial: [] }),
  abrirAjustes: () => get().irA('ajustes'),
  volverInicio: () => set({ vista: 'inicio', historial: [] }),

  irA: vista =>
    set(s => ({ vista, historial: s.historial.length > 30 ? s.historial.slice(-30) : [...s.historial, s.vista] })),
  volverAtras: () =>
    set(s => {
      if (s.historial.length === 0) return s;
      const historial = [...s.historial];
      const vista = historial.pop() as Vista;
      return { vista, historial };
    }),
  setSalaModo: modo => set({ salaModo: modo }),
  setModoAmigos: modo => set({ modoAmigos: modo }),
  setSalaConfig: config => set({ salaConfig: config }),

  editarPerfil: cambios => {
    if (!get().perfil) return;
    set({ perfil: { ...(get().perfil as PerfilUsuario), ...cambios } });
    void guardar(get);
  },

  recargarSaldo: (monto, descripcion) => {
    if (monto <= 0) return;
    const t: Transaccion = { id: nuevoId(), tipo: 'recarga', monto, fecha: Date.now(), descripcion };
    set({ saldo: get().saldo + monto, transacciones: [t, ...get().transacciones].slice(0, 200) });
    void guardar(get);
    if (get().online) {
      void apiRecargar(monto)
        .then(r => {
          set({
            saldo: r.saldo,
            transacciones: r.transacciones.map(tr => ({
              id: String(tr.id),
              tipo: (['recarga', 'apuesta', 'ganancia', 'reembolso'].includes(tr.tipo) ? tr.tipo : 'recarga') as TipoTransaccion,
              monto: tr.monto,
              fecha: tr.fecha,
              descripcion: tr.descripcion,
            })),
          });
          void guardar(get);
        })
        .catch(() => {});
    }
  },

  cobrarApuesta: (monto, descripcion) => {
    if (monto <= 0) return;
    const t: Transaccion = { id: nuevoId(), tipo: 'apuesta', monto: -monto, fecha: Date.now(), descripcion };
    set({ saldo: get().saldo - monto, transacciones: [t, ...get().transacciones].slice(0, 200) });
    void guardar(get);
  },

  abonarResultado: (tipo, monto, descripcion) => {
    if (monto <= 0) return;
    const t: Transaccion = { id: nuevoId(), tipo, monto, fecha: Date.now(), descripcion };
    set({ saldo: get().saldo + monto, transacciones: [t, ...get().transacciones].slice(0, 200) });
    void guardar(get);
  },

  agregarAmigo: nombre => {
    const limpio = nombre.trim();
    if (!limpio || get().amigos.includes(limpio)) return false;
    set({ amigos: [...get().amigos, limpio] });
    void guardar(get);
    if (get().online) {
      void apiAgregarAmigo(limpio)
        .then(r => {
          set({ amigos: r.amigos.map(a => a.nombre) });
          void guardar(get);
        })
        .catch(() => {});
    }
    return true;
  },

  eliminarAmigo: nombre => {
    set({ amigos: get().amigos.filter(a => a !== nombre) });
    void guardar(get);
    if (get().online) {
      void apiEliminarAmigo(nombre)
        .then(r => {
          set({ amigos: r.amigos.map(a => a.nombre) });
          void guardar(get);
        })
        .catch(() => {});
    }
  },

  notificar: (titulo, cuerpo) => {
    const n: Notificacion = { id: nuevoId(), titulo, cuerpo, leida: false, fecha: Date.now() };
    set({ notificaciones: [n, ...get().notificaciones].slice(0, 100) });
    void guardar(get);
  },

  marcarNotificacionLeida: id => {
    set({
      notificaciones: get().notificaciones.map(n => (n.id === id ? { ...n, leida: true } : n)),
    });
    void guardar(get);
  },

  limpiarNotificaciones: () => {
    set({ notificaciones: [] });
    void guardar(get);
  },
}));

export function idiomaActual(): Idioma {
  return useAppStore.getState().ajustes.idioma;
}