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

describeSupabase('salas', () => {
  it('crea una sala con código y al anfitrión dentro', async () => {
    const res = await supertest(app)
      .post('/salas')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Mesa premium', apuesta: 50 });

    expect(res.status).toBe(201);
    expect(res.body.sala.codigo).toMatch(/^[A-Z2-9]{6}$/);
    expect(res.body.sala.apuesta).toBe(50);
    expect(res.body.sala.jugadores).toHaveLength(1);
    expect(res.body.sala.jugadores[0].nombre).toBe('Ana');
  });

  it('lista las salas en espera', async () => {
    await supertest(app).post('/salas').set('Authorization', `Bearer ${token}`).send({ nombre: 'Sala 1', apuesta: 0 });
    const res = await supertest(app).get('/salas').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.salas).toHaveLength(1);
    expect(res.body.salas[0].jugadores).toBe(1);
  });

  it('obtiene la información de una sala por código', async () => {
    const creada = await supertest(app).post('/salas').set('Authorization', `Bearer ${token}`).send({ nombre: 'Sala 1' });
    const codigo = creada.body.sala.codigo as string;
    const res = await supertest(app).get(`/salas/${codigo}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sala.codigo).toBe(codigo);
  });

  it('rechaza crear una sala con apuesta superior al saldo', async () => {
    const res = await supertest(app)
      .post('/salas')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Cara', apuesta: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sin_saldo');
  });
});