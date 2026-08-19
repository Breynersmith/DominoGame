import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { Db } from '../src/db';
import { prepararServidor, describeSupabase, cerrarPool, registrarUsuario } from './helpers';
import { Express } from 'express';

let db: Db;
let app: Express;
let tokenAna: string;
let tokenLeo: string;

beforeEach(async () => {
  const s = await prepararServidor();
  db = s.db;
  app = s.app;
  const ana = await registrarUsuario(app, 'Ana');
  const leo = await registrarUsuario(app, 'Leo');
  tokenAna = ana.token;
  tokenLeo = leo.token;
});

afterEach(() => {
  db.cerrar();
});

afterAll(() => cerrarPool());

describeSupabase('amigos', () => {
  it('agrega un amigo y lo lista', async () => {
    const res = await supertest(app)
      .post('/amigos')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ nombre: 'leo' });

    expect(res.status).toBe(201);
    expect(res.body.amigos).toHaveLength(1);
    expect(res.body.amigos[0]).toMatchObject({ nombre: 'Leo' });

    // La relación es bidireccional
    const listaLeo = await supertest(app).get('/amigos').set('Authorization', `Bearer ${tokenLeo}`);
    expect(listaLeo.body.amigos).toHaveLength(1);
  });

  it('rechaza duplicados, usuarios inexistentes y agregarse a uno mismo', async () => {
    const dup = await supertest(app)
      .post('/amigos')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ nombre: 'Leo' });
    await dup;
    const duplicado = await supertest(app)
      .post('/amigos')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ nombre: 'Leo' });
    expect(duplicado.status).toBe(409);

    const inexistente = await supertest(app)
      .post('/amigos')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ nombre: 'Fantas' });
    expect(inexistente.status).toBe(404);

    const auto = await supertest(app)
      .post('/amigos')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ nombre: 'Ana' });
    expect(auto.status).toBe(400);
  });

  it('elimina un amigo', async () => {
    await supertest(app).post('/amigos').set('Authorization', `Bearer ${tokenAna}`).send({ nombre: 'Leo' });
    const res = await supertest(app)
      .delete('/amigos/Leo')
      .set('Authorization', `Bearer ${tokenAna}`);
    expect(res.status).toBe(200);
    expect(res.body.amigos).toEqual([]);
  });

  it('busca usuarios por nombre excluyéndose a uno mismo', async () => {
    const res = await supertest(app).get('/usuarios/buscar?q=ana').set('Authorization', `Bearer ${tokenLeo}`);
    expect(res.status).toBe(200);
    expect(res.body.resultados).toHaveLength(1);
    expect(res.body.resultados[0].nombre).toBe('Ana');
  });
});