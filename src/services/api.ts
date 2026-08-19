// src/services/api.ts
// Cliente HTTP hacia el backend Domino Club (Edge Functions de Supabase).
// Todas las funciones lanzan un Error con `.codigo` (id del error del servidor)
// y `.status`.

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export const API_BASE_URL = API_URL;

let tokenActual: string | null = null;

export function actualizarToken(token: string | null): void {
  tokenActual = token;
}

export function obtenerToken(): string | null {
  return tokenActual;
}

export class ErrorApi extends Error {
  status: number;
  codigo: string;

  constructor(status: number, codigo: string) {
    super(codigo);
    this.status = status;
    this.codigo = codigo;
  }
}

async function peticion<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {}),
    ...(opciones.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, { ...opciones, headers });
  } catch {
    throw new ErrorApi(0, 'sin_conexion');
  }

  if (!res.ok) {
    let codigo = `http_${res.status}`;
    try {
      const cuerpo = (await res.json()) as { error?: string };
      if (cuerpo?.error) codigo = cuerpo.error;
    } catch {
      // sin cuerpo JSON
    }
    throw new ErrorApi(res.status, codigo);
  }
  return (await res.json()) as T;
}

export interface UsuarioApi {
  id: number;
  nombre: string;
  color: string;
  saldo: number;
  kycEstado?: string;
  cuentaVerificada?: boolean;
  foto?: string;
}

export interface TransaccionApi {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: number;
}

export interface SalaApi {
  codigo: string;
  nombre: string;
  apuesta: number;
  hostId: number;
  estado: 'espera' | 'jugando';
  jugadores: { id: number; nombre: string; color: string; foto?: string | null }[];
  partida: { empezada: boolean } | null;
}

export interface PartidaApi {
  codigo: string;
  opciones: { robarPozo: boolean; fichasPorJugador: number };
  estado: unknown;
  jugadores: { usuarioId: number; nombre: string; color: string; esBot: boolean; foto?: string }[];
  apuesta: number;
  pagada: number;
  humanos_inicio: number;
  resultado: { pot: number; pagos: Record<number, { tipo: string; monto: number }>; motivo?: string } | null;
}

export interface MensajeChatApi {
  id: number;
  usuarioId: number;
  nombre: string;
  color: string;
  foto?: string | null;
  texto: string;
  ts: number;
}

// ---------- Auth ----------

export interface DatosRegistro {
  nombre: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  password: string;
  color: string;
  fechaNacimiento: string;
  pais: string;
  terminosAceptados: boolean;
  codigoOtp: string;
  preguntaSeguridad: string;
  respuestaSeguridad: string;
  dosFactores: boolean;
}

export type ResultadoLogin =
  | { token: string; usuario: UsuarioApi }
  | { requiere2fa: true; telefonoEnmascarado: string; demo: boolean; codigo?: string };

export function apiRegistro(datos: DatosRegistro) {
  return peticion<{ token: string; usuario: UsuarioApi }>('/auth/registro', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

// Registro fácil: nombre, email y contraseña, con código de verificación de
// correo. El resto de datos de seguridad se piden después con apiVerificarCuenta.
export function apiRegistroFacil(
  nombre: string,
  email: string,
  password: string,
  color: string,
  codigoOtp: string,
) {
  return peticion<{ token: string; usuario: UsuarioApi }>('/auth/registro-facil', {
    method: 'POST',
    body: JSON.stringify({ nombre, email, password, color, codigoOtp }),
  });
}

export interface DatosVerificarCuenta {
  nombreCompleto: string;
  telefono: string;
  codigoOtp: string;
  fechaNacimiento: string;
  pais: string;
  terminosAceptados: boolean;
  preguntaSeguridad: string;
  respuestaSeguridad: string;
  dosFactores: boolean;
}

export function apiVerificarCuenta(datos: DatosVerificarCuenta) {
  return peticion<{ usuario: UsuarioApi }>('/auth/verificar-cuenta', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function apiEnviarSms(telefono: string) {
  return peticion<{ ok: true; demo: boolean; codigo?: string }>('/auth/sms/enviar', {
    method: 'POST',
    body: JSON.stringify({ telefono }),
  });
}

export function apiEnviarCodigoEmail(email: string) {
  return peticion<{ ok: true; demo: boolean; codigo?: string }>('/auth/email/enviar', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function apiVerificarSms(telefono: string, codigo: string) {
  return peticion<{ ok: true }>('/auth/sms/verificar', {
    method: 'POST',
    body: JSON.stringify({ telefono, codigo }),
  });
}

export function apiLogin(identificador: string, password: string) {
  return peticion<ResultadoLogin>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identificador, password }),
  });
}

export function apiLogin2fa(identificador: string, codigo: string) {
  return peticion<{ token: string; usuario: UsuarioApi }>('/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ identificador, codigo }),
  });
}

export function apiRecuperar(telefono: string, codigoOtp: string, nuevoPassword: string) {
  return peticion<{ token: string; usuario: UsuarioApi }>('/auth/recuperar', {
    method: 'POST',
    body: JSON.stringify({ telefono, codigoOtp, nuevoPassword }),
  });
}

export function apiRecuperarPregunta(
  identificador: string,
  preguntaSeguridad: string,
  respuestaSeguridad: string,
  nuevoPassword: string,
) {
  return peticion<{ token: string; usuario: UsuarioApi }>('/auth/recuperar', {
    method: 'POST',
    body: JSON.stringify({ identificador, preguntaSeguridad, respuestaSeguridad, nuevoPassword }),
  });
}

// ---------- KYC ----------

export type EstadoKyc = 'no_enviado' | 'pendiente' | 'aprobado' | 'rechazado';

export function apiEnviarKyc(datos: { tipoDocumento: string; numeroDocumento: string; selfie: string }) {
  return peticion<{ estado: string }>('/kyc', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function apiEstadoKyc() {
  return peticion<{ estado: EstadoKyc }>('/kyc');
}

// ---------- Métodos de pago ----------

export interface MetodoPagoApi {
  id: number;
  tipo: string;
  datosEnmascarados: string;
  predeterminada: boolean;
}

export function apiListarPagos() {
  return peticion<{ pagos: MetodoPagoApi[] }>('/pagos');
}

export function apiAgregarPago(tipo: string, datosEnmascarados: string) {
  return peticion<{ ok: true }>('/pagos', {
    method: 'POST',
    body: JSON.stringify({ tipo, datosEnmascarados }),
  });
}

export function apiEliminarPago(id: number) {
  return peticion<{ ok: true }>(`/pagos/${id}`, { method: 'DELETE' });
}

export function apiPagoPredeterminado(id: number) {
  return peticion<{ ok: true }>(`/pagos/${id}/predeterminada`, { method: 'POST' });
}

// ---------- Usuarios ----------

export function apiYo() {
  return peticion<{ usuario: UsuarioApi; transacciones: TransaccionApi[] }>('/usuarios/yo');
}

export function apiEditarPerfil(cambios: { nombre?: string; color?: string; foto?: string }) {
  return peticion<{ usuario: UsuarioApi }>('/usuarios/yo', {
    method: 'PUT',
    body: JSON.stringify(cambios),
  });
}

export function apiBuscarUsuarios(q: string) {
  return peticion<{ resultados: { id: number; nombre: string; color: string }[] }>(
    `/usuarios/buscar?q=${encodeURIComponent(q)}`
  );
}

// ---------- Billetera ----------

export function apiRecargar(monto: number) {
  return peticion<{ saldo: number; transacciones: TransaccionApi[] }>('/billetera/recargar', {
    method: 'POST',
    body: JSON.stringify({ monto }),
  });
}

// ---------- Amigos ----------

export function apiAmigos() {
  return peticion<{ amigos: { id: number; nombre: string; color: string }[] }>('/amigos');
}

export function apiAgregarAmigo(nombre: string) {
  return peticion<{ amigos: { id: number; nombre: string; color: string }[] }>('/amigos', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  });
}

export function apiEliminarAmigo(nombre: string) {
  return peticion<{ amigos: { id: number; nombre: string; color: string }[] }>(
    `/amigos/${encodeURIComponent(nombre)}`,
    { method: 'DELETE' }
  );
}

// ---------- Salas ----------

export interface SalaDatosApi {
  sala: SalaApi;
  partida: PartidaApi | null;
  chat: MensajeChatApi[];
}

export function apiListarSalas() {
  return peticion<{ salas: SalaApi[] }>('/salas');
}

export function apiCrearSala(nombre: string, apuesta: number) {
  return peticion<SalaDatosApi>('/salas', {
    method: 'POST',
    body: JSON.stringify({ nombre, apuesta }),
  });
}

export function apiUnirseSala(codigo: string) {
  return peticion<SalaDatosApi>(`/salas/${encodeURIComponent(codigo)}/unirse`, { method: 'POST' });
}

export function apiObtenerSala(codigo: string) {
  return peticion<SalaDatosApi>(`/salas/${encodeURIComponent(codigo)}`);
}

export function apiSalirSala(codigo: string) {
  return peticion<{ ok: true; eliminada: boolean }>(`/salas/${encodeURIComponent(codigo)}/salir`, {
    method: 'POST',
  });
}

export function apiEmpezarPartida(codigo: string, robarPozo: boolean, fichasPorJugador: number) {
  return peticion<{ ok: true; apuesta: number }>(`/salas/${encodeURIComponent(codigo)}/empezar`, {
    method: 'POST',
    body: JSON.stringify({ robarPozo, fichasPorJugador }),
  });
}

export function apiJugar(codigo: string, fichaId: string, extremo: 'izquierdo' | 'derecho') {
  return peticion<{ ok: true }>(`/salas/${encodeURIComponent(codigo)}/jugar`, {
    method: 'POST',
    body: JSON.stringify({ fichaId, extremo }),
  });
}

export function apiRobar(codigo: string) {
  return peticion<{ ok: true }>(`/salas/${encodeURIComponent(codigo)}/robar`, { method: 'POST' });
}

export function apiPasar(codigo: string) {
  return peticion<{ ok: true }>(`/salas/${encodeURIComponent(codigo)}/pasar`, { method: 'POST' });
}

export function apiEsperar(codigo: string) {
  return peticion<{ ok: true }>(`/salas/${encodeURIComponent(codigo)}/esperar`, { method: 'POST' });
}

export function apiAbandonarPartida(codigo: string) {
  return peticion<{ ok: true }>(`/salas/${encodeURIComponent(codigo)}/abandonar`, { method: 'POST' });
}

export function apiHistorialChat(codigo: string) {
  return peticion<{ mensajes: MensajeChatApi[] }>(`/salas/${encodeURIComponent(codigo)}/chat`);
}

export function apiEnviarChat(codigo: string, texto: string) {
  return peticion<{ ok: true }>(`/salas/${encodeURIComponent(codigo)}/chat`, {
    method: 'POST',
    body: JSON.stringify({ texto }),
  });
}

// ---------- Disputas ----------

export function apiCrearDisputa(mensaje: string) {
  return peticion<{ disputa: { id: number; mensaje: string; estado: string } }>('/disputas', {
    method: 'POST',
    body: JSON.stringify({ mensaje }),
  });
}

// ---------- Invitaciones ----------

export function apiInvitarAmigo(nombre: string, codigo: string) {
  return peticion<{ ok: true }>('/notificaciones/invitar', {
    method: 'POST',
    body: JSON.stringify({ nombre, codigo }),
  });
}