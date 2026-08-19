// server/src/supabase.ts
// Clientes de Supabase (Auth + Storage), verificación de JWT y utilidades de imagen.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const URL = process.env.SUPABASE_URL ?? '';
const CLAVE_ANON = process.env.SUPABASE_ANON_KEY ?? '';
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SECRETO_JWT = process.env.SUPABASE_JWT_SECRET ?? '';

export const BUCKET = process.env.SUPABASE_BUCKET ?? 'domino';

export function supabaseConfigurado(): boolean {
  return Boolean(URL && CLAVE_ANON && CLAVE_SERVICIO && SECRETO_JWT);
}

let _admin: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

function clienteAdmin(): SupabaseClient {
  if (!supabaseConfigurado()) {
    throw new Error(
      'Supabase no configurado: faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET',
    );
  }
  _admin ??= createClient(URL, CLAVE_SERVICIO, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

function clienteAnon(): SupabaseClient {
  if (!supabaseConfigurado()) {
    throw new Error(
      'Supabase no configurado: faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET',
    );
  }
  _anon ??= createClient(URL, CLAVE_ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _anon;
}

export function admin(): SupabaseClient {
  return clienteAdmin();
}

export function anon(): SupabaseClient {
  return clienteAnon();
}

export interface TokenVerificado {
  uid: string;
}

// Caché de claves públicas del JWKS de Supabase (kid -> KeyObject). El `kid` de
// un token que no esté en caché fuerza una recarga.
let jwks: Map<string, crypto.KeyObject> | null = null;

async function clavesJwks(): Promise<Map<string, crypto.KeyObject>> {
  const res = await fetch(`${URL}/auth/v1/.well-known/jwks.json`);
  if (!res.ok) throw new Error('jwks_indisponible');
  const datos = (await res.json()) as { keys?: { kid?: string; kty?: string; [k: string]: unknown }[] };
  const mapa = new Map<string, crypto.KeyObject>();
  for (const clave of datos.keys ?? []) {
    if (clave.kid && clave.kty) {
      try {
        mapa.set(clave.kid, crypto.createPublicKey({ key: clave as crypto.JsonWebKey, format: 'jwk' }));
      } catch {
        // clave inutilizable: se omite
      }
    }
  }
  return mapa;
}

async function clavePublica(kid: string | undefined): Promise<crypto.KeyObject | undefined> {
  if (!kid) return undefined;
  if (!jwks) {
    jwks = await clavesJwks();
  }
  let clave = jwks.get(kid);
  if (!clave) {
    // kid desconocido (rotación de claves): recarga y reintenta una vez
    jwks = await clavesJwks();
    clave = jwks.get(kid);
  }
  return clave;
}

// Verifica el access token emitido por Supabase Auth. Los proyectos recientes
// firman los tokens con ES256 (JWKS); los antiguos usan HS256 con el secreto del
// proyecto. Devuelve el `sub` (UUID del usuario de auth.users) o null.
export async function verToken(token: string): Promise<TokenVerificado | null> {
  try {
    const [cabecera] = token.split('.');
    const { alg, kid } = JSON.parse(Buffer.from(cabecera, 'base64url').toString()) as {
      alg?: string;
      kid?: string;
    };
    let datos: { sub?: string };
    if (alg === 'HS256') {
      datos = jwt.verify(token, SECRETO_JWT, { algorithms: ['HS256'] }) as { sub?: string };
    } else {
      const clave = await clavePublica(kid);
      if (!clave) return null;
      datos = jwt.verify(token, clave, { algorithms: ['ES256', 'RS256'] }) as { sub?: string };
    }
    return typeof datos.sub === 'string' ? { uid: datos.sub } : null;
  } catch {
    return null;
  }
}

// Crea los buckets de storage si aún no existen (idempotente).
export async function asegurarBuckets(): Promise<void> {
  if (!supabaseConfigurado()) return;
  try {
    await clienteAdmin().storage.createBucket(BUCKET, { public: true });
  } catch {
    // el bucket ya existe
  }
}

export function urlPublica(ruta: string): string {
  return clienteAdmin().storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

// Sube una imagen en formato data URI (`data:image/jpeg;base64,...`) al bucket
// y devuelve su URL pública.
export async function subirImagen(datos: string, ruta: string): Promise<string> {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(datos);
  if (!m) throw new Error('imagen_invalida');
  const buffer = Buffer.from(m[2], 'base64');
  const { data, error } = await clienteAdmin()
    .storage.from(BUCKET)
    .upload(ruta, buffer, { contentType: `image/${m[1]}`, upsert: true });
  if (error || !data) throw error ?? new Error('subida_fallida');
  return urlPublica(ruta);
}
