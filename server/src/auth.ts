// server/src/auth.ts
// Hash de PIN y contraseña, OTP, firma/verificación de JWT y middleware de autenticación.

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Db } from './db';

export interface UsuarioAutenticado {
  id: number;
  nombre: string;
  color: string;
  saldo: number;
  kycEstado: 'no_enviado' | 'pendiente' | 'aprobado' | 'rechazado';
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

const SECRETO = process.env.JWT_SECRET ?? 'domino-secreto-desarrollo';
const RONDAS = 10;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TELEFONO_REGEX = /^\+?[0-9]{8,15}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EDAD_MINIMA = 18;
export const OTP_DIGITOS = 6;
export const OTP_VALIDEZ_MS = 10 * 60 * 1000;

export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, RONDAS);
}

export function verificarPin(pin: string, hash: string): boolean {
  return bcrypt.compareSync(pin, hash);
}

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
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return false;
  }
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) {
    edad -= 1;
  }
  return edad >= EDAD_MINIMA;
}

export function generarCodigoOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_DIGITOS).toString().padStart(OTP_DIGITOS, '0');
}

export function hashOtp(codigo: string): string {
  return bcrypt.hashSync(codigo, RONDAS);
}

export function verificarOtp(codigo: string, hash: string): boolean {
  return bcrypt.compareSync(codigo, hash);
}

export function firmarToken(usuarioId: number): string {
  return jwt.sign({ uid: usuarioId }, SECRETO, { expiresIn: '7d' });
}

export function verToken(token: string): { uid: number } | null {
  try {
    const datos = jwt.verify(token, SECRETO) as { uid: number };
    return typeof datos.uid === 'number' ? datos : null;
  } catch {
    return null;
  }
}

export function serializarUsuario(fila: {
  id: number;
  nombre: string;
  color: string;
  saldo: number;
  kyc_estado?: string;
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
    foto: fila.foto ?? undefined,
  };
}

// Middleware: exige header `Authorization: Bearer <token>` y adjunta req.usuario.
export function requiereAuth(db: Db) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'no_autenticado' });
      return;
    }
    const datos = verToken(header.slice(7));
    if (!datos) {
      res.status(401).json({ error: 'token_invalido' });
      return;
    }
    const fila = db.prepare('SELECT id, nombre, color, saldo, kyc_estado, foto FROM usuarios WHERE id = ?').get(datos.uid) as
      | { id: number; nombre: string; color: string; saldo: number; kyc_estado: string; foto?: string | null }
      | undefined;
    if (!fila) {
      res.status(401).json({ error: 'usuario_no_existe' });
      return;
    }
    (req as Request & { usuario: UsuarioAutenticado }).usuario = serializarUsuario(fila);
    next();
  };
}