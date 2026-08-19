// server/tests/usuarios.test.ts
// Perfil: nombre, color y foto de perfil (data URI → Supabase Storage).

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

describeSupabase('perfil', () => {
  it('guarda una foto de perfil grande (más de 100 KB) en Storage', async () => {
    const foto = `data:image/jpeg;base64,${'A'.repeat(200_000)}`;
    const res = await supertest(app)
      .put('/usuarios/yo')
      .set('Authorization', `Bearer ${token}`)
      .send({ foto });
    expect(res.status).toBe(200);
    expect(res.body.usuario.foto).toMatch(/^https?:\/\//);
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