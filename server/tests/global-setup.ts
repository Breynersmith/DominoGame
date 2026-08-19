// server/tests/global-setup.ts
// Se ejecuta una vez antes de todos los tests: deja la base de Supabase vacía
// (tablas de datos y usuarios de Supabase Auth) para que cada test arranque limpio.

import { Pool } from 'pg';

export default async function (): Promise<void> {
  const cs = process.env.DATABASE_URL;
  if (!cs) return; // sin Supabase → los tests se saltan
  const pool = new Pool({ connectionString: cs, max: 2, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('DELETE FROM auth.users');
  } catch {
    // el esquema aún no existe (lo crea cada test)
  }
  try {
    await pool.query(
      'TRUNCATE TABLE codigos_otp, sessions_pendientes, sala_jugadores, salas, amigos, notificaciones, disputas, transacciones, metodos_pago, perfiles CASCADE',
    );
  } catch {
    // sin tablas todavía
  }
  await pool.end();
}
