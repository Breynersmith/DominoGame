// server/tests/usuarios.test.ts
// Perfil: nombre, color y foto de perfil (data URI).

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

describe('perfil', () => {
  it('guarda una foto de perfil grande (más de 100 KB)', async () => {
    const foto = `data:image/jpeg;base64,${'A'.repeat(200_000)}`;
    const res = await supertest(app)
      .put('/usuarios/yo')
      .set('Authorization', `Bearer ${token}`)
      .send({ foto });
    expect(res.status).toBe(200);
    expect(res.body.usuario.foto).toBe(foto);
  });

  it('rechaza una foto de perfil inválida', async () => {
    const res = await supertest(app)
      .put('/usuarios/yo')
      .set('Authorization', `Bearer ${token}`)
      .send({ foto: 'http://ejemplo.com/foto.jpg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('foto_invalida');
  });

  it('una cadena vacía quita la foto de perfil', async () => {
    const foto = `data:image/png;base64,${'B'.repeat(10)}`;
    await supertest(app).put('/usuarios/yo').set('Authorization', `Bearer ${token}`).send({ foto });
    const res = await supertest(app)
      .put('/usuarios/yo')
      .set('Authorization', `Bearer ${token}`)
      .send({ foto: '' });
    expect(res.status).toBe(200);
    expect(res.body.usuario.foto).toBeNull();
  });
});