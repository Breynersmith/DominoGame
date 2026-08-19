// supabase/functions/kyc/index.ts
// Verificación de identidad (KYC): documento oficial + selfie. La selfie se
// sube a Supabase Storage y se guarda la URL pública.

import { Db, ahora } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';
import { permitido } from '../_shared/limiter.ts';
import { subirImagen } from '../_shared/supabase.ts';

const DOCUMENTO_REGEX = /^[A-Za-z0-9-]{5,20}$/;
const TIPOS_DOCUMENTO = ['dni', 'nie', 'pasaporte'] as const;
const SELFIE_MAX = 3 * 1024 * 1024; // ~3 MB en base64

const db = new Db();
const r = new Enrutador(db);

// POST /kyc { tipoDocumento, numeroDocumento, selfie } → queda en revisión.
r.post('/', true, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'kyc', ventanaMs: 60 * 60 * 1000, max: 3 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const u = ctx.usuario!;
  const tipoDocumento = String(ctx.cuerpo?.tipoDocumento ?? '');
  const numeroDocumento = String(ctx.cuerpo?.numeroDocumento ?? '').trim();
  const selfie = String(ctx.cuerpo?.selfie ?? '');

  if (!(TIPOS_DOCUMENTO as readonly string[]).includes(tipoDocumento)) {
    return errorJson('tipo_documento_invalido');
  }
  if (!DOCUMENTO_REGEX.test(numeroDocumento)) {
    return errorJson('numero_documento_invalido');
  }
  if (!selfie.startsWith('data:image/') || selfie.length > SELFIE_MAX) {
    return errorJson('selfie_invalida');
  }

  const url = await subirImagen(selfie, `kyc/${u.id}-${Date.now()}.jpg`);

  await db.ejecutar(
    `UPDATE perfiles SET kyc_estado = 'pendiente', kyc_tipo_documento = $1, kyc_numero_documento = $2,
            kyc_selfie_url = $3, kyc_enviado_en = $4, kyc_revisado_en = NULL WHERE id = $5`,
    [tipoDocumento, numeroDocumento, url, ahora(), u.id],
  );

  return json({ estado: 'pendiente' }, 202);
});

// GET /kyc → estado de la verificación.
r.get('/', true, async (ctx: Contexto): Promise<Response> => {
  const u = ctx.usuario!;
  const fila = await db.one<{
    kyc_estado: string;
    kyc_tipo_documento: string | null;
    kyc_numero_documento: string | null;
    kyc_enviado_en: number | null;
    kyc_revisado_en: number | null;
  }>(
    'SELECT kyc_estado, kyc_tipo_documento, kyc_numero_documento, kyc_enviado_en, kyc_revisado_en FROM perfiles WHERE id = $1',
    [u.id],
  );
  if (!fila) {
    return errorJson('usuario_no_encontrado', 404);
  }
  return json({
    estado: fila.kyc_estado,
    tipoDocumento: fila.kyc_tipo_documento,
    numeroDocumento: fila.kyc_numero_documento,
    enviadoEn: fila.kyc_enviado_en,
    revisadoEn: fila.kyc_revisado_en,
  });
});

Deno.serve((req) => r.manejar(req));