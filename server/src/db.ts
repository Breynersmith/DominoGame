// server/src/db.ts
// Conexión a la base de datos de Supabase (PostgreSQL vía `pg`), esquema y
// utilidades de billetera. Toda la persistencia es asíncrona.

import { Pool, PoolClient, types } from 'pg';

// Postgres devuelve bigint/int8 (p.ej. `bigserial`, timestamps en ms) como
// cadenas por defecto. Los convertimos a número: nuestros ids y épocas caben
// holgadamente en el rango seguro de Number.
types.setTypeParser(20, (v: string) => Number(v));

// Interfaz mínima de consulta usada por rutas y sockets (Db y transacciones).
export interface Conexion {
  query<T = Fila>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Fila>(text: string, params?: unknown[]): Promise<T | undefined>;
  ejecutar(text: string, params?: unknown[]): Promise<{ rowCount: number }>;
}

export interface Fila {
  [clave: string]: unknown;
}

export class Db implements Conexion {
  readonly pool: Pool;
  private dueno: boolean;

  constructor(pool: Pool, dueno = true) {
    this.pool = pool;
    this.dueno = dueno;
  }

  static conectar(connectionString: string): Db {
    return new Db(new Pool({ connectionString, max: 10, ssl: { rejectUnauthorized: false } }));
  }

  async query<T = Fila>(text: string, params: unknown[] = []): Promise<T[]> {
    const r = params.length > 0 ? await this.pool.query(text, params) : await this.pool.query(text);
    return r.rows as T[];
  }

  async one<T = Fila>(text: string, params: unknown[] = []): Promise<T | undefined> {
    const r = params.length > 0 ? await this.pool.query(text, params) : await this.pool.query(text);
    return r.rows[0] as T | undefined;
  }

  async ejecutar(text: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const r = params.length > 0 ? await this.pool.query(text, params) : await this.pool.query(text);
    return { rowCount: r.rowCount ?? 0 };
  }

  // Ejecuta `fn` dentro de una transacción con la misma interfaz de consulta.
  async transaccion<T>(fn: (db: Conexion) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await fn(new DbCliente(cliente));
      await cliente.query('COMMIT');
      return resultado;
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release();
    }
  }

  async cerrar(): Promise<void> {
    if (this.dueno) await this.pool.end();
  }
}

class DbCliente implements Conexion {
  constructor(private cliente: PoolClient) {}

  async query<T = Fila>(text: string, params: unknown[] = []): Promise<T[]> {
    const r = params.length > 0 ? await this.cliente.query(text, params) : await this.cliente.query(text);
    return r.rows as T[];
  }

  async one<T = Fila>(text: string, params: unknown[] = []): Promise<T | undefined> {
    const r = params.length > 0 ? await this.cliente.query(text, params) : await this.cliente.query(text);
    return r.rows[0] as T | undefined;
  }

  async ejecutar(text: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const r = params.length > 0 ? await this.cliente.query(text, params) : await this.cliente.query(text);
    return { rowCount: r.rowCount ?? 0 };
  }
}

// Esquema de Supabase. También está en `supabase/migrations/0001_inicial.sql`.
export const ESQUEMA_SQL = `
  create table if not exists public.perfiles (
    id bigserial primary key,
    auth_uid uuid not null unique references auth.users(id) on delete cascade,
    nombre text not null,
    nombre_completo text not null default '',
    email text,
    telefono text,
    fecha_nacimiento text,
    pais text not null default '',
    terminos_aceptados_en bigint,
    pregunta_seguridad text,
    respuesta_seguridad_hash text,
    dos_factores integer not null default 0,
    kyc_estado text not null default 'no_enviado',
    kyc_tipo_documento text,
    kyc_numero_documento text,
    kyc_selfie_url text,
    kyc_enviado_en bigint,
    kyc_revisado_en bigint,
    color text not null default '#006c49',
    saldo integer not null default 1000,
    victorias integer not null default 0,
    derrotas integer not null default 0,
    racha integer not null default 0,
    foto_url text,
    creado_en bigint not null
  );
  create unique index if not exists idx_perfiles_nombre on public.perfiles (lower(nombre));
  create unique index if not exists idx_perfiles_email on public.perfiles (email) where email is not null;
  create unique index if not exists idx_perfiles_telefono on public.perfiles (telefono) where telefono is not null;

  create table if not exists public.codigos_otp (
    id bigserial primary key,
    telefono text not null,
    codigo_hash text not null,
    verificado integer not null default 0,
    consumido integer not null default 0,
    expira_en bigint not null,
    creado_en bigint not null
  );

  create table if not exists public.sessions_pendientes (
    auth_uid uuid primary key references auth.users(id) on delete cascade,
    access_token text not null,
    creado_en bigint not null
  );

  create table if not exists public.metodos_pago (
    id bigserial primary key,
    usuario_id bigint not null references public.perfiles(id) on delete cascade,
    tipo text not null,
    datos_enmascarados text not null,
    predeterminada integer not null default 0,
    creado_en bigint not null
  );

  create table if not exists public.transacciones (
    id bigserial primary key,
    usuario_id bigint not null references public.perfiles(id) on delete cascade,
    tipo text not null,
    monto integer not null,
    descripcion text not null default '',
    creado_en bigint not null
  );

  create table if not exists public.amigos (
    usuario_id bigint not null references public.perfiles(id) on delete cascade,
    amigo_id bigint not null references public.perfiles(id) on delete cascade,
    creado_en bigint not null,
    primary key (usuario_id, amigo_id)
  );

  create table if not exists public.notificaciones (
    id bigserial primary key,
    usuario_id bigint not null references public.perfiles(id) on delete cascade,
    titulo text not null,
    cuerpo text not null,
    leida integer not null default 0,
    creado_en bigint not null
  );

  create table if not exists public.disputas (
    id bigserial primary key,
    usuario_id bigint not null references public.perfiles(id) on delete cascade,
    mensaje text not null,
    estado text not null default 'abierta',
    creado_en bigint not null
  );

  create table if not exists public.salas (
    codigo text primary key,
    nombre text not null,
    apuesta integer not null default 0,
    host_id bigint not null,
    estado text not null default 'espera',
    creado_en bigint not null
  );

  create table if not exists public.sala_jugadores (
    sala_id text not null references public.salas(codigo) on delete cascade,
    usuario_id bigint not null references public.perfiles(id) on delete cascade,
    creado_en bigint not null,
    primary key (sala_id, usuario_id)
  );
`;

export async function inicializarEsquema(db: Conexion): Promise<void> {
  await db.ejecutar(ESQUEMA_SQL);
}

export function ahora(): number {
  return Date.now();
}

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

// Registra el resultado de una partida: victoria incrementa la racha,
// derrota la reinicia.
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
