// src/services/api.ts
// Cliente HTTP hacia el backend Domino Club. Todas las funciones lanzan
// un Error con `.codigo` (id del error del servidor) y `.status`.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  host_id: number;
  estado: string;
  jugadores: number | { id: number; nombre: string; color: string }[];
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

// Registro rápido para pruebas (requiere modo permisivo en el servidor).
export function apiRegistroRapido(nombre: string, color: string) {
  return peticion<{ token: string; usuario: UsuarioApi }>('/auth/registro', {
    method: 'POST',
    body: JSON.stringify({ nombre, color }),
  });
}

export function apiEnviarSms(telefono: string) {
  return peticion<{ ok: true; demo: boolean; codigo?: string }>('/auth/sms/enviar', {
    method: 'POST',
    body: JSON.stringify({ telefono }),
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

export function apiListarSalas() {
  return peticion<{ salas: SalaApi[] }>('/salas');
}

export function apiCrearSala(nombre: string, apuesta: number) {
  return peticion<{ sala: SalaApi }>('/salas', {
    method: 'POST',
    body: JSON.stringify({ nombre, apuesta }),
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