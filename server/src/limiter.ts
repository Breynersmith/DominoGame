// server/src/limiter.ts
// Limitador de peticiones en memoria (ventana deslizante por IP + clave).

import { Request, Response, NextFunction } from 'express';

interface Ventana {
  contador: number;
  desde: number;
}

const registros = new Map<string, Ventana>();

export interface OpcionesLimitador {
  clave: string;
  ventanaMs: number;
  max: number;
}

export function limitador({ clave, ventanaMs, max }: OpcionesLimitador) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'desconocida';
    const llave = `${clave}:${ip}`;
    const ahora = Date.now();
    const actual = registros.get(llave);

    if (!actual || ahora - actual.desde >= ventanaMs) {
      registros.set(llave, { contador: 1, desde: ahora });
      next();
      return;
    }

    actual.contador += 1;
    if (actual.contador > max) {
      res.status(429).json({ error: 'demasiadas_peticiones' });
      return;
    }
    next();
  };
}

// Limpia entradas viejas para evitar fugas de memoria.
export function limpiarLimitador(): void {
  const ahora = Date.now();
  for (const [llave, ventana] of registros) {
    if (ahora - ventana.desde >= 60 * 60 * 1000) registros.delete(llave);
  }
}

// Vacía el registro (útil en tests).
export function reiniciarLimitador(): void {
  registros.clear();
}

setInterval(limpiarLimitador, 10 * 60 * 1000).unref();