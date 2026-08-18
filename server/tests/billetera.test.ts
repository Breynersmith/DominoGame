import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import { crearApp } from '../src/app';
import { crearDb, Db } from '../src/db';
import { reiniciarLimitador } from '../src/limiter';
import { registrarUsuario } from './helpers';
import { Express } from 'express';

let db: Db;
let app: Express;
let token: string;

beforeEach(async () => {
  db = crearDb(':memory:');
  app = crearApp(db);
  reiniciarLimitador();
  const reg = await registrarUsuario(app, 'Ana');
  token = reg.token;
});

afterEach(() => {
  db.close();
});

describe('billetera', () => {
  it('exige autenticación', async () => {
    const res = await supertest(app).get('/billetera');
    expect(res.status).toBe(401);
  });

  it('devuelve saldo inicial y sin transacciones', async () => {
    const res = await supertest(app).get('/billetera').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.saldo).toBe(1000);
    expect(res.body.transacciones).toEqual([]);
  });

  it('recarga saldo y registra la transacción', async () => {
    const res = await supertest(app)
      .post('/billetera/recargar')
      .set('Authorization', `Bearer ${token}`)
      .send({ monto: 500 });

    expect(res.status).toBe(200);
    expect(res.body.saldo).toBe(1500);
    expect(res.body.transacciones[0]).toMatchObject({ tipo: 'recarga', monto: 500 });
  });

  it('rechaza montos inválidos', async () => {
    for (const monto of [0, -10, 'abc', undefined]) {
      const res = await supertest(app)
        .post('/billetera/recargar')
        .set('Authorization', `Bearer ${token}`)
        .send({ monto });
      expect(res.status).toBe(400);
    }
  });

  it('el perfil /usuarios/yo incluye saldo y transacciones', async () => {
    await supertest(app)
      .post('/billetera/recargar')
      .set('Authorization', `Bearer ${token}`)
      .send({ monto: 300 });
    const res = await supertest(app).get('/usuarios/yo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario.saldo).toBe(1300);
    expect(res.body.transacciones).toHaveLength(1);
  });
});