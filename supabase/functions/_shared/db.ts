// supabase/functions/_shared/db.ts
// Acceso a la base de datos de Supabase (PostgreSQL) usando el driver `postgres`
// (compatible con Deno/Edge Functions). Mantiene la misma interfaz de consulta
// que usaba el backend Express: query/one/ejecutar/transaccion.

import postgres from 'npm:postgres@3.4.5';

export interface Fila {
  [clave: string]: unknown;
}

// Interfaz mínima de consulta usada por las funciones (Db y transacciones).
export interface Conexion {
  query<T = Fila>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Fila>(text: string, params?: unknown[]): Promise<T | undefined>;
  ejecutar(text: string, params?: unknown[]): Promise<{ rowCount: number }>;
  transaccion<T>(fn: (db: Conexion) => Promise<T>): Promise<T>;
}

let _sql: postgres.Sql<{}> | null = null;

// Cliente `postgres` compartido (una única conexión por instancia de función).
function sql(): postgres.Sql<{}> {
  if (!_sql) {
    const url = Deno.env.get('DATABASE_URL');
    if (!url) throw new Error('Falta DATABASE_URL');
    _sql = postgres(url, {
      max: 1,
      ssl: 'require',
      connect_timeout: 10,
      types: {
        // bigint/int8 (bigserial, timestamps en ms) -> number
        bigint: {
          to: 20,
          from: [20],
          serialize: (x: bigint | number) => x.toString(),
          parse: (x: string) => Number(x),
        },
        // numeric (decimales) -> number
        numeric: {
          to: 1700,
          from: [1700],
          serialize: (x: bigint | number) => x.toString(),
          parse: (x: string) => Number(x),
        },
      },
    });
  }
  return _sql;
}

export class Db implements Conexion {
  async query<T = Fila>(text: string, params: unknown[] = []): Promise<T[]> {
    const r = (await sql().unsafe(text, ...(params as never[]))) as unknown as T[];
    return Array.isArray(r) ? r : [];
  }

  async one<T = Fila>(text: string, params: unknown[] = []): Promise<T | undefined> {
    const r = await this.query<T>(text, params);
    return r[0];
  }

  async ejecutar(text: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const r = await sql().unsafe(text, ...(params as never[]));
    const filas = Array.isArray(r) ? r : [];
    return { rowCount: filas.length };
  }

  async transaccion<T>(fn: (db: Conexion) => Promise<T>): Promise<T> {
    return (await sql().begin(async (tx) => {
      const dbTx: Conexion = {
        query: async <R = Fila>(t: string, p: unknown[] = []) =>
          (await tx.unsafe(t, ...(p as never[]))) as unknown as R[],
        one: async <R = Fila>(t: string, p: unknown[] = []) => {
          const filas = await tx.unsafe(t, ...(p as never[]));
          return (Array.isArray(filas) ? (filas as unknown as R[]) : [])[0];
        },
        ejecutar: async (t: string, p: unknown[] = []) => {
          const filas = await tx.unsafe(t, ...(p as never[]));
          return { rowCount: (Array.isArray(filas) ? filas : []).length };
        },
        transaccion: <R>(fn2: (d: Conexion) => Promise<R>) => fn2(dbTx),
      };
      return await fn(dbTx);
    })) as T;
  }
}

export function ahora(): number {
  return Date.now();
}

// ---------- Billetera ----------

export async function obtenerSaldo(db: Conexion, usuarioId: number): Promise<number> {
  const fila = await db.one<{ saldo: number }>('SELECT saldo FROM perfiles WHERE id = $1', [usuarioId]);
  return fila?.saldo ?? 0;
}

export async function insertarTransaccion(
  db: Conexion,
  usuarioId: number,
  tipo: string,
  monto: number,
  descripcion: string,
): Promise<void> {
  await db.ejecutar(
    'INSERT INTO transacciones (usuario_id, tipo, monto, descripcion, creado_en) VALUES ($1, $2, $3, $4, $5)',
    [usuarioId, tipo, monto, descripcion, ahora()],
  );
}

// Suma un monto (puede ser negativo) al saldo del usuario y registra la transacción.
export async function ajustarSaldo(
  db: Conexion,
  usuarioId: number,
  monto: number,
  tipo: string,
  descripcion: string,
): Promise<number> {
  const fila = await db.one<{ saldo: number }>(
    'UPDATE perfiles SET saldo = saldo + $1 WHERE id = $2 RETURNING saldo',
    [monto, usuarioId],
  );
  if (!fila) return obtenerSaldo(db, usuarioId);
  await insertarTransaccion(db, usuarioId, tipo, monto, descripcion);
  return fila.saldo;
}

// Intenta descontar `monto` del saldo de forma atómica. Devuelve true si fue
// posible (sin quedarse en negativo).
export async function intentarCobrar(
  db: Conexion,
  usuarioId: number,
  monto: number,
  descripcion: string,
): Promise<boolean> {
  const fila = await db.one<{ saldo: number }>(
    'UPDATE perfiles SET saldo = saldo - $1 WHERE id = $2 AND saldo >= $1 RETURNING saldo',
    [monto, usuarioId],
  );
  if (!fila) return false;
  await insertarTransaccion(db, usuarioId, 'apuesta', -monto, descripcion);
  return true;
}

export async function listarTransacciones(db: Conexion, usuarioId: number, limite = 100): Promise<unknown[]> {
  return db.query(
    'SELECT id, tipo, monto, descripcion, creado_en AS fecha FROM transacciones WHERE usuario_id = $1 ORDER BY id DESC LIMIT $2',
    [usuarioId, limite],
  );
}

export async function crearNotificacion(db: Conexion, usuarioId: number, titulo: string, cuerpo: string): Promise<void> {
  await db.ejecutar(
    'INSERT INTO notificaciones (usuario_id, titulo, cuerpo, creado_en) VALUES ($1, $2, $3, $4)',
    [usuarioId, titulo, cuerpo, ahora()],
  );
}

// Racha de victorias consecutivas de un usuario.
export async function obtenerRacha(db: Conexion, usuarioId: number): Promise<number> {
  const fila = await db.one<{ racha: number }>('SELECT racha FROM perfiles WHERE id = $1', [usuarioId]);
  return fila?.racha ?? 0;
}

// Registra el resultado de una partida: victoria incrementa la racha, derrota la reinicia.
export async function registrarResultado(
  db: Conexion,
  usuarioId: number,
  resultado: 'victoria' | 'derrota',
): Promise<void> {
  if (resultado === 'victoria') {
    await db.ejecutar(
      'UPDATE perfiles SET victorias = victorias + 1, racha = racha + 1 WHERE id = $1',
      [usuarioId],
    );
  } else {
    await db.ejecutar('UPDATE perfiles SET derrotas = derrotas + 1, racha = 0 WHERE id = $1', [usuarioId]);
  }
}