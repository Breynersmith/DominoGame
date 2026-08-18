// server/src/routes/kyc.ts
// Verificación de identidad (KYC): documento oficial + selfie.

import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import { requiereAuth, UsuarioAutenticado } from '../auth';
import { limitador } from '../limiter';

const DOCUMENTO_REGEX = /^[A-Za-z0-9-]{5,20}$/;
const TIPOS_DOCUMENTO = ['dni', 'nie', 'pasaporte'] as const;
const SELFIE_MAX = 3 * 1024 * 1024; // ~3 MB en base64

export function crearRouterKyc(db: Db): Router {
  const r = Router();

  // POST /kyc { tipoDocumento, numeroDocumento, selfie } → queda en revisión.
  r.post(
    '/',
    requiereAuth(db),
    limitador({ clave: 'kyc', ventanaMs: 60 * 60 * 1000, max: 3 }),
    (req: Request, res: Response): void => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const tipoDocumento = String(req.body?.tipoDocumento ?? '');
      const numeroDocumento = String(req.body?.numeroDocumento ?? '').trim();
      const selfie = String(req.body?.selfie ?? '');

      if (!(TIPOS_DOCUMENTO as readonly string[]).includes(tipoDocumento)) {
        res.status(400).json({ error: 'tipo_documento_invalido' });
        return;
      }
      if (!DOCUMENTO_REGEX.test(numeroDocumento)) {
        res.status(400).json({ error: 'numero_documento_invalido' });
        return;
      }
      if (!selfie.startsWith('data:image/') || selfie.length > SELFIE_MAX) {
        res.status(400).json({ error: 'selfie_invalida' });
        return;
      }

      db.prepare(
        `UPDATE usuarios SET kyc_estado = 'pendiente', kyc_tipo_documento = ?, kyc_numero_documento = ?,
                kyc_selfie = ?, kyc_enviado_en = ?, kyc_revisado_en = NULL WHERE id = ?`
      ).run(tipoDocumento, numeroDocumento, selfie, ahora(), u.id);

      res.status(202).json({ estado: 'pendiente' });
    },
  );

  // GET /kyc → estado de la verificación.
  r.get('/', requiereAuth(db), (req: Request, res: Response): void => {
    const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
    const fila = db
      .prepare('SELECT kyc_estado, kyc_tipo_documento, kyc_numero_documento, kyc_enviado_en, kyc_revisado_en FROM usuarios WHERE id = ?')
      .get(u.id) as {
      kyc_estado: string;
      kyc_tipo_documento: string | null;
      kyc_numero_documento: string | null;
      kyc_enviado_en: number | null;
      kyc_revisado_en: number | null;
    };
    res.json({
      estado: fila.kyc_estado,
      tipoDocumento: fila.kyc_tipo_documento,
      numeroDocumento: fila.kyc_numero_documento,
      enviadoEn: fila.kyc_enviado_en,
      revisadoEn: fila.kyc_revisado_en,
    });
  });

  return r;
}