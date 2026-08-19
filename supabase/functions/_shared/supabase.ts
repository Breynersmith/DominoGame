// supabase/functions/_shared/supabase.ts
// Clientes de Supabase (Auth + Storage), verificación de JWT y utilidades de imagen.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import * as jose from 'npm:jose@5.9.6';
import { BUCKET, CLAVE_ANON, CLAVE_SERVICIO, SECRETO_JWT, URL_SUPABASE, supabaseConfigurado } from './config.ts';

let _admin: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

function clienteAdmin(): SupabaseClient {
  if (!supabaseConfigurado()) {
    throw new Error('Supabase no configurado: faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET');
  }
  _admin ??= createClient(URL_SUPABASE, CLAVE_SERVICIO, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

function clienteAnon(): SupabaseClient {
  if (!supabaseConfigurado()) {
    throw new Error('Supabase no configurado: faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET');
  }
  _anon ??= createClient(URL_SUPABASE, CLAVE_ANON, {
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

// Conjunto de claves remotas (JWKS) de Supabase. Los proyectos recientes firman
// los tokens con ES256; los antiguos usan HS256 con el secreto del proyecto.
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function obtenerJwks(): ReturnType<typeof jose.createRemoteJWKSet> {
  jwks ??= jose.createRemoteJWKSet(new URL(`${URL_SUPABASE}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

// Verifica el access token emitido por Supabase Auth y devuelve el `sub`
// (UUID del usuario de auth.users) o null.
export async function verToken(token: string): Promise<TokenVerificado | null> {
  try {
    const { alg } = jose.decodeProtectedHeader(token);
    let payload: jose.JWTPayload;
    if (alg === 'HS256') {
      payload = (
        await jose.jwtVerify(token, new TextEncoder().encode(SECRETO_JWT), { algorithms: ['HS256'] })
      ).payload;
    } else {
      payload = (await jose.jwtVerify(token, obtenerJwks(), { algorithms: ['ES256', 'RS256'] })).payload;
    }
    return typeof payload.sub === 'string' ? { uid: payload.sub } : null;
  } catch {
    return null;
  }
}

// Crea el bucket de storage si aún no existe (idempotente).
export async function asegurarBucket(): Promise<void> {
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
  const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
  const { data, error } = await clienteAdmin().storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: `image/${m[1]}`, upsert: true });
  if (error || !data) throw error ?? new Error('subida_fallida');
  return urlPublica(ruta);
}