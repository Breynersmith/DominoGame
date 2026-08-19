// supabase/functions/_shared/limiter.ts
// Limitador de peticiones en memoria (ventana deslizante por IP + clave).
// En Edge Functions el estado es efímero por instancia: es un control
// best-effort, no una barrera de seguridad.

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

export function permitido({ clave, ventanaMs, max }: OpcionesLimitador, req: Request): boolean {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'desconocida';
  const llave = `${clave}:${ip}`;
  const ahora = Date.now();
  const actual = registros.get(llave);

  if (!actual || ahora - actual.desde >= ventanaMs) {
    registros.set(llave, { contador: 1, desde: ahora });
    return true;
  }
  actual.contador += 1;
  return actual.contador <= max;
}