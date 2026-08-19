// server/src/asyncero.ts
// Envuelve un handler async de Express para que los errores lleguen al
// middleware de error en lugar de lanzarse sin capturar.

import { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncero(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
