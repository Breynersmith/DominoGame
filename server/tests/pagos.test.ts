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

describe('métodos de pago', () => {
  it('exige autenticación', async () => {
    const res = await supertest(app).get('/pagos');
    expect(res.status).toBe(401);
  });

  it('agrega, lista y marca como predeterminado un método', async () => {
    const crear = await supertest(app)
      .post('/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'tarjeta', datosEnmascarados: '•••• 1234' });
    expect(crear.status).toBe(201);

    const lista = await supertest(app).get('/pagos').set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body.pagos).toHaveLength(1);
    expect(lista.body.pagos[0]).toMatchObject({ tipo: 'tarjeta', datosEnmascarados: '•••• 1234', predeterminada: true });

    const segundo = await supertest(app)
      .post('/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'paypal', datosEnmascarados: '••••@paypal.com' });
    expect(segundo.status).toBe(201);

    const id = lista.body.pagos[0].id as number;
    const marcar = await supertest(app)
      .post(`/pagos/${id}/predeterminada`)
      .set('Authorization', `Bearer ${token}`);
    expect(marcar.status).toBe(200);

    const final = await supertest(app).get('/pagos').set('Authorization', `Bearer ${token}`);
    expect(final.body.pagos.find((p: { id: number }) => p.id === id).predeterminada).toBe(true);
  });

  it('elimina un método y mueve el predeterminado', async () => {
    const a = await supertest(app).post('/pagos').set('Authorization', `Bearer ${token}`).send({ tipo: 'tarjeta', datosEnmascarados: '•••• 1111' });
    const b = await supertest(app).post('/pagos').set('Authorization', `Bearer ${token}`).send({ tipo: 'cripto', datosEnmascarados: '0x••••' });
    const lista = await supertest(app).get('/pagos').set('Authorization', `Bearer ${token}`);
    const idA = a.status === 201 ? (lista.body.pagos.find((p: { tipo: string }) => p.tipo === 'tarjeta')?.id as number) : 0;

    const elim = await supertest(app).delete(`/pagos/${idA}`).set('Authorization', `Bearer ${token}`);
    expect(elim.status).toBe(200);

    const final = await supertest(app).get('/pagos').set('Authorization', `Bearer ${token}`);
    expect(final.body.pagos).toHaveLength(1);
    expect(final.body.pagos[0].predeterminada).toBe(true);
  });

  it('rechaza tipos y datos inválidos', async () => {
    const mal = await supertest(app)
      .post('/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'efectivo', datosEnmascarados: 'xxxx' });
    expect(mal.status).toBe(400);
    expect(mal.body.error).toBe('tipo_pago_invalido');
  });
});