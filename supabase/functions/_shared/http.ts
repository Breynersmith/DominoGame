// supabase/functions/_shared/http.ts
// Mini-enrutador para Edge Functions: despacha por método y path (relativo a la
// función), lee el cuerpo JSON, aplica autenticación opcional y devuelve JSON.

import { Db } from './db.ts';
import { obtenerUsuarioRequerido, UsuarioAutenticado } from './auth.ts';
import { errorJson, json, CORS_HEADERS } from './respuesta.ts';

export interface Contexto {
  req: Request;
  db: Db;
  usuario?: UsuarioAutenticado;
  cuerpo: Record<string, unknown> | undefined;
  params: Record<string, string>;
  query: URLSearchParams;
}

type Respuesta = Response | Promise<Response>;

interface Ruta {
  metodo: string;
  partes: string[];
  handler: (ctx: Contexto) => Respuesta;
  auth: boolean;
}

export class Enrutador {
  private rutas: Ruta[] = [];

  constructor(
    private db: Db,
    private nombre?: string,
  ) {}

  get(ruta: string, auth: boolean, handler: (ctx: Contexto) => Respuesta): void {
    this.agregar('GET', ruta, auth, handler);
  }

  post(ruta: string, auth: boolean, handler: (ctx: Contexto) => Respuesta): void {
    this.agregar('POST', ruta, auth, handler);
  }

  put(ruta: string, auth: boolean, handler: (ctx: Contexto) => Respuesta): void {
    this.agregar('PUT', ruta, auth, handler);
  }

  delete(ruta: string, auth: boolean, handler: (ctx: Contexto) => Respuesta): void {
    this.agregar('DELETE', ruta, auth, handler);
  }

  private agregar(metodo: string, ruta: string, auth: boolean, handler: (ctx: Contexto) => Respuesta): void {
    this.rutas.push({ metodo, partes: ruta.split('/').filter(Boolean), handler, auth });
  }

  // Normaliza el path: la pasarela reescribe la URL como `http://<ref>.supabase.co/<slug>/<resto>`
  // (y también puede llegar como `/functions/v1/<slug>/<resto>`). Deja la ruta relativa a la función.
  private normalizar(camino: string): string {
    const partes = camino.split('/').filter(Boolean);
    if (this.nombre && partes[0] === this.nombre) {
      return `/${partes.slice(1).join('/')}`;
    }
    const m = camino.match(/^\/functions\/v1\/[^/]+(?:\/(.*))?$/);
    if (m) return `/${m[1] ?? ''}`;
    return camino;
  }

  async manejar(req: Request): Promise<Response> {
    // Preflight CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    const camino = this.normalizar(url.pathname);
    const partes = camino.split('/').filter(Boolean);

    let cuerpo: Record<string, unknown> | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const tipo = req.headers.get('content-type') ?? '';
      if (tipo.includes('application/json')) {
        try {
          const c = await req.json();
          cuerpo = typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : undefined;
        } catch {
          cuerpo = undefined;
        }
      }
    }

    for (const ruta of this.rutas) {
      if (ruta.metodo !== req.method) continue;
      if (ruta.partes.length !== partes.length) continue;
      const params: Record<string, string> = {};
      let coincide = true;
      for (let i = 0; i < partes.length; i++) {
        const p = ruta.partes[i]!;
        if (p.startsWith(':')) {
          params[p.slice(1)] = decodeURIComponent(partes[i]!);
        } else if (p !== partes[i]) {
          coincide = false;
          break;
        }
      }
      if (!coincide) continue;

      const ctx: Contexto = { req, db: this.db, cuerpo, params, query: url.searchParams };
      if (ruta.auth) {
        const u = await obtenerUsuarioRequerido(req, this.db);
        if (u instanceof Response) return u;
        ctx.usuario = u;
      }
      try {
        return await ruta.handler(ctx);
      } catch (e) {
        console.error(e);
        return errorJson('error_interno', 500);
      }
    }

    return errorJson('ruta_no_encontrada', 404);
  }
}