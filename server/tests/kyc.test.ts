import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { Db } from '../src/db';
import { prepararServidor, describeSupabase, cerrarPool, registrarUsuario } from './helpers';
import { Express } from 'express';

let db: Db;
let app: Express;
let token: string;

beforeEach(async () => {
  const s = await prepararServidor();
  db = s.db;
  app = s.app;
  const reg = await registrarUsuario(app, 'Ana');
  token = reg.token;
});

afterEach(() => {
  db.cerrar();
});

afterAll(() => cerrarPool());

describeSupabase('kyc', () => {
  it('exige autenticación', async () => {
    const res = await supertest(app).post('/kyc').send({ tipoDocumento: 'dni', numeroDocumento: '12345678A', selfie: 'data:image/png;base64,xxxx' });
    expect(res.status).toBe(401);
  });

  it('envía el documento y la selfie y queda en revisión', async () => {
    const res = await supertest(app)
      .post('/kyc')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipoDocumento: 'dni', numeroDocumento: '12345678A', selfie: 'data:image/png;base64,AAAA' });
    expect(res.status).toBe(202);
    expect(res.body.estado).toBe('pendiente');

    const estado = await supertest(app).get('/kyc').set('Authorization', `Bearer ${token}`);
    expect(estado.status).toBe(200);
    expect(estado.body.estado).toBe('pendiente');
    expect(estado.body.numeroDocumento).toBe('12345678A');
  });

  it('rechaza documentos y selfies inválidos', async () => {
    const invalidos: Array<Record<string, string>> = [
      { tipoDocumento: 'otro', numeroDocumento: '12345678A', selfie: 'data:image/png;base64,AAAA' },
      { tipoDocumento: 'dni', numeroDocumento: 'x!', selfie: 'data:image/png;base64,AAAA' },
      { tipoDocumento: 'dni', numeroDocumento: '12345678A', selfie: 'texto-plano' },
    ];
    for (const cuerpo of invalidos) {
      const res = await supertest(app).post('/kyc').set('Authorization', `Bearer ${token}`).send(cuerpo);
      expect(res.status).toBe(400);
    }
  });
});