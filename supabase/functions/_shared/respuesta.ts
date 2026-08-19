// supabase/functions/_shared/respuesta.ts
// Utilidades de respuesta HTTP con cabeceras CORS (las Edge Functions requieren
// CORS manual, incluido en las respuestas de error).

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export function errorJson(codigo: string, status = 400): Response {
  return json({ error: codigo }, status);
}