// supabase/functions/_shared/auth.ts
// Hash de contraseñas, OTP y preguntas de seguridad, verificación del JWT de
// Supabase Auth y resolución del perfil autenticado.

import bcrypt from 'npm:bcryptjs@2.4.3';
import { Conexion } from './db.ts';
import { verToken } from './supabase.ts';
import { errorJson, json } from './respuesta.ts';

export interface UsuarioAutenticado {
  id: number;
  nombre: string;
  color: string;
  saldo: number;
  kycEstado: 'no_enviado' | 'pendiente' | 'aprobado' | 'rechazado';
  cuentaVerificada: boolean;
  foto?: string;
}

export const PREGUNTAS_SEGURIDAD = ['nombre_mascota', 'ciudad_nacimiento', 'comida_favorita', 'nombre_colegio'] as const;

export function esPreguntaSeguridadValida(pregunta: string): boolean {
  return (PREGUNTAS_SEGURIDAD as readonly string[]).includes(pregunta);
}

export function esRespuestaSeguridadValida(respuesta: string): boolean {
  const limpia = respuesta.trim();
  return limpia.length >= 2 && limpia.length <= 100;
}

export function hashRespuestaSeguridad(respuesta: string): string {
  return bcrypt.hashSync(respuesta.trim().toLowerCase(), RONDAS);
}

export function verificarRespuestaSeguridad(respuesta: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(respuesta.trim().toLowerCase(), hash);
}

const RONDAS = 10;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TELEFONO_REGEX = /^\+?[0-9]{8,15}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EDAD_MINIMA = 18;
export const OTP_DIGITOS = 6;
export const OTP_VALIDEZ_MS = 10 * 60 * 1000;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, RONDAS);
}

export function verificarPassword(password: string, hash: string | undefined | null): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

export function esPasswordFuerte(password: string): boolean {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return false;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return false;
  return true;
}

export function esEmailValido(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function esTelefonoValido(telefono: string): boolean {
  return TELEFONO_REGEX.test(telefono);
}

// fecha en formato AAAA-MM-DD. Devuelve true si el usuario tiene >= EDAD_MINIMA años.
export function esMayorDeEdad(fechaNacimiento: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return false;
  }
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) {
    edad -= 1;
  }
  return edad >= EDAD_MINIMA;
}

// Genera un código OTP de 6 dígitos usando WebCrypto (el servidor Node usaba
// crypto.randomInt; en Deno/Edge Functions se usa getRandomValues).
export function generarCodigoOtp(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const n = ((arr[0]! << 24) | (arr[1]! << 16) | (arr[2]! << 8) | arr[3]!) >>> 0;
  return (n % 10 ** OTP_DIGITOS).toString().padStart(OTP_DIGITOS, '0');
}

export function hashOtp(codigo: string): string {
  return bcrypt.hashSync(codigo, RONDAS);
}

export function verificarOtp(codigo: string, hash: string): boolean {
  return bcrypt.compareSync(codigo, hash);
}

export function serializarUsuario(fila: {
  id: number;
  nombre: string;
  color: string;
  saldo: number;
  kyc_estado?: string;
  cuenta_verificada?: number;
  foto?: string | null;
}): UsuarioAutenticado {
  return {
    id: fila.id,
    nombre: fila.nombre,
    color: fila.color,
    saldo: fila.saldo,
    kycEstado: (['no_enviado', 'pendiente', 'aprobado', 'rechazado'] as const).includes(
      fila.kyc_estado as 'no_enviado',
    )
      ? (fila.kyc_estado as UsuarioAutenticado['kycEstado'])
      : 'no_enviado',
    cuentaVerificada: fila.cuenta_verificada === 1,
    foto: fila.foto ?? undefined,
  };
}

// Resuelve el perfil a partir del header `Authorization: Bearer <token>`.
// Devuelve el usuario o una Response de error (401).
export async function obtenerUsuarioRequerido(
  req: Request,
  db: Conexion,
): Promise<UsuarioAutenticado | Response> {
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return errorJson('no_autenticado', 401);
  }
  const datos = await verToken(header.slice(7));
  if (!datos) {
    return errorJson('token_invalido', 401);
  }
  const fila = await db.one<{
    id: number;
    nombre: string;
    color: string;
    saldo: number;
    kyc_estado: string;
    cuenta_verificada: number;
    foto?: string | null;
  }>(
    'SELECT id, nombre, color, saldo, kyc_estado, cuenta_verificada, foto_url AS foto FROM perfiles WHERE auth_uid = $1',
    [datos.uid],
  );
  if (!fila) {
    return errorJson('usuario_no_existe', 401);
  }
  return serializarUsuario(fila);
}

export type UsuarioOError = UsuarioAutenticado | Response;