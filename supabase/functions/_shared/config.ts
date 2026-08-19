// supabase/functions/_shared/config.ts
// Configuración central: variables de entorno de Supabase y utilidades de modo.

export const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
export const CLAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
export const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const SECRETO_JWT = Deno.env.get('SUPABASE_JWT_SECRET') ?? '';
export const BUCKET = Deno.env.get('SUPABASE_BUCKET') ?? 'domino';

export function supabaseConfigurado(): boolean {
  return Boolean(URL_SUPABASE && CLAVE_ANON && CLAVE_SERVICIO && SECRETO_JWT);
}

// Modo de pruebas: con REGISTRO_PERMISIVO=1 el registro solo exige el nombre.
export function registroPermisivo(): boolean {
  return Deno.env.get('REGISTRO_PERMISIVO') === '1';
}

// Si hay proveedor de SMS/email configurado, no se devuelve el código en demo.
export function proveedorSms(): boolean {
  return Boolean(Deno.env.get('SMS_PROVIDER'));
}