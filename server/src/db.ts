// server/src/db.ts
// Conexión SQLite (better-sqlite3), esquema y utilidades de billetera.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type Db = Database.Database;

export function crearDb(archivo: string): Db {
  if (archivo !== ':memory:') {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
  }
  const db = new Database(archivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  inicializarEsquema(db);
  migrar(db);
  return db;
}

// Añade columnas nuevas a tablas ya creadas en bases de datos existentes.
export function migrar(db: Db): void {
  const columnas = new Map<string, Set<string>>();
  for (const tabla of ['usuarios', 'codigos_otp']) {
    columnas.set(
      tabla,
      new Set((db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[]).map(c => c.name)),
    );
  }
  const u = columnas.get('usuarios') as Set<string>;
  const anadir = (columna: string, definicion: string) => {
    if (!u.has(columna)) {
      db.exec(`ALTER TABLE usuarios ADD COLUMN ${columna} ${definicion}`);
    }
  };
  anadir('nombre_completo', "TEXT NOT NULL DEFAULT ''");
  anadir('email', 'TEXT');
  anadir('telefono', 'TEXT');
  anadir('password_hash', 'TEXT');
  anadir('fecha_nacimiento', 'TEXT');
  anadir('pais', "TEXT NOT NULL DEFAULT ''");
  anadir('terminos_aceptados_en', 'INTEGER');
  anadir('pregunta_seguridad', 'TEXT');
  anadir('respuesta_seguridad_hash', 'TEXT');
  anadir('dos_factores', 'INTEGER NOT NULL DEFAULT 0');
  anadir('kyc_estado', "TEXT NOT NULL DEFAULT 'no_enviado'");
  anadir('kyc_tipo_documento', 'TEXT');
  anadir('kyc_numero_documento', 'TEXT');
  anadir('kyc_selfie', 'TEXT');
  anadir('kyc_enviado_en', 'INTEGER');
  anadir('kyc_revisado_en', 'INTEGER');
  anadir('victorias', 'INTEGER NOT NULL DEFAULT 0');
  anadir('derrotas', 'INTEGER NOT NULL DEFAULT 0');
  anadir('racha', 'INTEGER NOT NULL DEFAULT 0');
  anadir('foto', 'TEXT');

  // Unicidad de email y teléfono (índices parciales para permitir NULL).
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_telefono ON usuarios(telefono) WHERE telefono IS NOT NULL;
  `);
}

export function inicializarEsquema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nombre_completo TEXT NOT NULL DEFAULT '',
      email TEXT UNIQUE COLLATE NOCASE,
      telefono TEXT UNIQUE,
      pin_hash TEXT NOT NULL,
      password_hash TEXT,
      fecha_nacimiento TEXT,
      pais TEXT NOT NULL DEFAULT '',
      terminos_aceptados_en INTEGER,
      pregunta_seguridad TEXT,
      respuesta_seguridad_hash TEXT,
      dos_factores INTEGER NOT NULL DEFAULT 0,
      kyc_estado TEXT NOT NULL DEFAULT 'no_enviado',
      kyc_tipo_documento TEXT,
      kyc_numero_documento TEXT,
      kyc_selfie TEXT,
      kyc_enviado_en INTEGER,
      kyc_revisado_en INTEGER,
      color TEXT NOT NULL DEFAULT '#006c49',
      saldo INTEGER NOT NULL DEFAULT 1000,
      victorias INTEGER NOT NULL DEFAULT 0,
      derrotas INTEGER NOT NULL DEFAULT 0,
      racha INTEGER NOT NULL DEFAULT 0,
      foto TEXT,
      creado_en INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS codigos_otp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefono TEXT NOT NULL,
      codigo_hash TEXT NOT NULL,
      verificado INTEGER NOT NULL DEFAULT 0,
      consumido INTEGER NOT NULL DEFAULT 0,
      expira_en INTEGER NOT NULL,
      creado_en INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metodos_pago (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      datos_enmascarados TEXT NOT NULL,
      predeterminada INTEGER NOT NULL DEFAULT 0,
      creado_en INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transacciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      monto INTEGER NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      creado_en INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS amigos (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      amigo_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      creado_en INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, amigo_id)
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      cuerpo TEXT NOT NULL,
      leida INTEGER NOT NULL DEFAULT 0,
      creado_en INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS disputas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      mensaje TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'abierta',
      creado_en INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS salas (
      codigo TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      apuesta INTEGER NOT NULL DEFAULT 0,
      host_id INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'espera',
      creado_en INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sala_jugadores (
      sala_id TEXT NOT NULL REFERENCES salas(codigo) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      creado_en INTEGER NOT NULL,
      PRIMARY KEY (sala_id, usuario_id)
    );
  `);
}

export function ahora(): number {
  return Date.now();
}

export function obtenerSaldo(db: Db, usuarioId: number): number {
  const fila = db.prepare('SELECT saldo FROM usuarios WHERE id = ?').get(usuarioId) as { saldo: number } | undefined;
  return fila?.saldo ?? 0;
}

export function insertarTransaccion(
  db: Db,
  usuarioId: number,
  tipo: string,
  monto: number,
  descripcion: string,
): void {
  db.prepare(
    'INSERT INTO transacciones (usuario_id, tipo, monto, descripcion, creado_en) VALUES (?, ?, ?, ?, ?)'
  ).run(usuarioId, tipo, monto, descripcion, ahora());
}

// Suma un monto (puede ser negativo) al saldo del usuario y registra la transacción.
export function ajustarSaldo(
  db: Db,
  usuarioId: number,
  monto: number,
  tipo: string,
  descripcion: string,
): number {
  const nuevo = db.prepare('UPDATE usuarios SET saldo = saldo + ? WHERE id = ?').run(monto, usuarioId);
  if (nuevo.changes === 0) return obtenerSaldo(db, usuarioId);
  insertarTransaccion(db, usuarioId, tipo, monto, descripcion);
  return obtenerSaldo(db, usuarioId);
}

// Intenta descontar `monto` del saldo. Devuelve true si fue posible (sin quedarse negativo).
export function intentarCobrar(db: Db, usuarioId: number, monto: number, descripcion: string): boolean {
  const saldo = obtenerSaldo(db, usuarioId);
  if (saldo < monto) return false;
  const nuevo = db.prepare('UPDATE usuarios SET saldo = saldo - ? WHERE id = ?').run(monto, usuarioId);
  if (nuevo.changes === 0) return false;
  insertarTransaccion(db, usuarioId, 'apuesta', -monto, descripcion);
  return true;
}

export function listarTransacciones(db: Db, usuarioId: number, limite = 100): unknown[] {
  return db
    .prepare('SELECT id, tipo, monto, descripcion, creado_en AS fecha FROM transacciones WHERE usuario_id = ? ORDER BY id DESC LIMIT ?')
    .all(usuarioId, limite);
}

export function crearNotificacion(db: Db, usuarioId: number, titulo: string, cuerpo: string): void {
  db.prepare('INSERT INTO notificaciones (usuario_id, titulo, cuerpo, creado_en) VALUES (?, ?, ?, ?)')
    .run(usuarioId, titulo, cuerpo, ahora());
}

// Racha de victorias consecutivas de un usuario.
export function obtenerRacha(db: Db, usuarioId: number): number {
  const fila = db.prepare('SELECT racha FROM usuarios WHERE id = ?').get(usuarioId) as { racha: number } | undefined;
  return fila?.racha ?? 0;
}

// Registra el resultado de una partida: victoria incrementa la racha,
// derrota la reinicia.
export function registrarResultado(db: Db, usuarioId: number, resultado: 'victoria' | 'derrota'): void {
  if (resultado === 'victoria') {
    db.prepare('UPDATE usuarios SET victorias = victorias + 1, racha = racha + 1 WHERE id = ?').run(usuarioId);
  } else {
    db.prepare('UPDATE usuarios SET derrotas = derrotas + 1, racha = 0 WHERE id = ?').run(usuarioId);
  }
}