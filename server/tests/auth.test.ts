import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { Db } from '../src/db';
import { prepararServidor, describeSupabase, cerrarPool, registrarUsuario } from './helpers';
import { reiniciarLimitador } from '../src/limiter';
import { Express } from 'express';

let db: Db;
let app: Express;

const REGISTRO_BASE = {
  nombre: 'Ana',
  nombreCompleto: 'Ana García',
  email: 'ana@test.com',
  telefono: '+34600000001',
  password: 'Clave123',
  color: '#2563eb',
  fechaNacimiento: '1990-01-01',
  pais: 'España',
  terminosAceptados: true,
  preguntaSeguridad: 'nombre_mascota',
  respuestaSeguridad: 'Rex',
};

async function enviarOtp(telefono: string): Promise<string> {
  const res = await supertest(app).post('/auth/sms/enviar').send({ telefono });
  expect(res.status).toBe(200);
  return res.body.codigo as string;
}

beforeEach(async () => {
  const s = await prepararServidor();
  db = s.db;
  app = s.app;
});

afterEach(() => {
  db.cerrar();
});

afterAll(() => cerrarPool());

describeSupabase('auth: registro seguro', () => {
  it('registra con contraseña, pregunta de seguridad y saldo inicial', async () => {
    const codigo = await enviarOtp(REGISTRO_BASE.telefono);
    const res = await supertest(app).post('/auth/registro').send({ ...REGISTRO_BASE, codigoOtp: codigo });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario).toMatchObject({ nombre: 'Ana', saldo: 1000, kycEstado: 'no_enviado' });
  });

  it('rechaza el registro sin haber verificado el teléfono', async () => {
    const res = await supertest(app).post('/auth/registro').send({ ...REGISTRO_BASE, codigoOtp: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('otp_invalido');
  });

  it('valida email, teléfono, contraseña, edad, país, términos y pregunta de seguridad', async () => {
    const codigo = await enviarOtp(REGISTRO_BASE.telefono);
    const casos: Array<[Partial<typeof REGISTRO_BASE>, string]> = [
      [{ email: 'no-es-correo' }, 'email_invalido'],
      [{ telefono: '12' }, 'telefono_invalido'],
      [{ password: 'corta' }, 'password_debil'],
      [{ fechaNacimiento: '2015-05-05' }, 'menor_de_edad'],
      [{ pais: '' }, 'pais_requerido'],
      [{ terminosAceptados: false }, 'terminos_no_aceptados'],
      [{ preguntaSeguridad: 'otra' }, 'pregunta_seguridad_invalida'],
      [{ respuestaSeguridad: 'X' }, 'respuesta_seguridad_invalida'],
    ];
    for (const [cambios, error] of casos) {
      reiniciarLimitador();
      const res = await supertest(app)
        .post('/auth/registro')
        .send({ ...REGISTRO_BASE, ...cambios, codigoOtp: codigo });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
    }
  });

  it('rechaza nombre, email o teléfono duplicados', async () => {
    const codigo = await enviarOtp(REGISTRO_BASE.telefono);
    await supertest(app).post('/auth/registro').send({ ...REGISTRO_BASE, codigoOtp: codigo });

    const codigo2 = await enviarOtp('+34600000002');
    const nombreDup = await supertest(app)
      .post('/auth/registro')
      .send({ ...REGISTRO_BASE, email: 'otro@test.com', telefono: '+34600000002', codigoOtp: codigo2 });
    expect(nombreDup.status).toBe(409);
    expect(nombreDup.body.error).toBe('nombre_en_uso');
  });
});

describeSupabase('auth: login con contraseña', () => {
  it('inicia sesión con email y contraseña', async () => {
    await registrarUsuario(app, 'Ana', { email: 'ana@test.com', telefono: '+34600000001' });
    const res = await supertest(app).post('/auth/login').send({ identificador: 'ana@test.com', password: 'Clave123' });
    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Ana');
  });

  it('rechaza contraseña incorrecta', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001' });
    const res = await supertest(app).post('/auth/login').send({ identificador: 'Ana', password: 'Mala123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('credenciales_invalidas');
  });

  it('ya no permite iniciar sesión con un PIN', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001' });
    const res = await supertest(app).post('/auth/login').send({ nombre: 'Ana', pin: '1234' });
    expect(res.status).toBe(401);
  });
});

describeSupabase('auth: doble factor (2FA)', () => {
  it('con 2FA activo el login pide el código SMS y el segundo paso devuelve el token', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001', dosFactores: true });

    const paso1 = await supertest(app).post('/auth/login').send({ identificador: 'Ana', password: 'Clave123' });
    expect(paso1.status).toBe(200);
    expect(paso1.body.requiere2fa).toBe(true);
    expect(paso1.body.token).toBeUndefined();
    expect(paso1.body.demo).toBe(true);

    const paso2 = await supertest(app)
      .post('/auth/login/2fa')
      .send({ identificador: 'Ana', codigo: paso1.body.codigo });
    expect(paso2.status).toBe(200);
    expect(paso2.body.token).toBeTruthy();
  });

  it('rechaza un código 2FA incorrecto', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001', dosFactores: true });
    const paso2 = await supertest(app).post('/auth/login/2fa').send({ identificador: 'Ana', codigo: '000000' });
    expect(paso2.status).toBe(400);
    expect(paso2.body.error).toBe('otp_invalido');
  });
});

describeSupabase('auth: recuperación segura', () => {
  it('recupera la contraseña por pregunta de seguridad', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001', preguntaSeguridad: 'ciudad_nacimiento', respuestaSeguridad: 'Madrid' });

    const res = await supertest(app)
      .post('/auth/recuperar')
      .send({ identificador: 'Ana', preguntaSeguridad: 'ciudad_nacimiento', respuestaSeguridad: 'Madrid', nuevoPassword: 'NuevaClave1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const vieja = await supertest(app).post('/auth/login').send({ identificador: 'Ana', password: 'Clave123' });
    expect(vieja.status).toBe(401);
    const nueva = await supertest(app).post('/auth/login').send({ identificador: 'Ana', password: 'NuevaClave1' });
    expect(nueva.status).toBe(200);
  });

  it('rechaza la recuperación con respuesta de seguridad incorrecta', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001', preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Rex' });
    const res = await supertest(app)
      .post('/auth/recuperar')
      .send({ identificador: 'Ana', preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Otro', nuevoPassword: 'NuevaClave1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('respuesta_seguridad_invalida');
  });

  it('recupera la contraseña por SMS con OTP', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001' });
    const codigo = await enviarOtp('+34600000001');
    const res = await supertest(app)
      .post('/auth/recuperar')
      .send({ telefono: '+34600000001', codigoOtp: codigo, nuevoPassword: 'NuevaClave1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rechaza la recuperación sin ningún método', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001' });
    const res = await supertest(app).post('/auth/recuperar').send({ nuevoPassword: 'NuevaClave1' });
    expect(res.status).toBe(400);
  });
});

describeSupabase('auth: registro fácil y verificación de cuenta', () => {
  it('registro-facil crea la cuenta solo con nombre, email y contraseña tras verificar el código de correo', async () => {
    const sms = await supertest(app).post('/auth/email/enviar').send({ email: 'facil@test.com' });
    expect(sms.status).toBe(200);
    const codigo = sms.body.codigo as string;

    const res = await supertest(app)
      .post('/auth/registro-facil')
      .send({ nombre: 'Facil', email: 'facil@test.com', password: 'Clave123', codigoOtp: codigo, color: '#2563eb' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario).toMatchObject({ nombre: 'Facil', saldo: 1000, cuentaVerificada: false });

    const login = await supertest(app)
      .post('/auth/login')
      .send({ identificador: 'facil@test.com', password: 'Clave123' });
    expect(login.status).toBe(200);
    expect(login.body.usuario.cuentaVerificada).toBe(false);
  });

  it('registro-facil rechaza un código de correo inválido', async () => {
    const res = await supertest(app)
      .post('/auth/registro-facil')
      .send({ nombre: 'Facil2', email: 'facil2@test.com', password: 'Clave123', codigoOtp: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('otp_invalido');
  });

  it('registro-facil valida nombre, email y contraseña', async () => {
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ nombre: 'X', email: 'x@test.com', password: 'Clave123', codigoOtp: '000000' }, 'nombre_invalido'],
      [{ nombre: 'Válido', email: 'no-correo', password: 'Clave123', codigoOtp: '000000' }, 'email_invalido'],
      [{ nombre: 'Válido', email: 'v@test.com', password: 'corta', codigoOtp: '000000' }, 'password_debil'],
    ];
    for (const [cuerpo, error] of casos) {
      const res = await supertest(app).post('/auth/registro-facil').send(cuerpo);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
    }
  });

  it('registro-facil rechaza un email ya en uso', async () => {
    const sms = await supertest(app).post('/auth/email/enviar').send({ email: 'facil3@test.com' });
    const codigo = sms.body.codigo as string;
    await supertest(app)
      .post('/auth/registro-facil')
      .send({ nombre: 'Primero', email: 'facil3@test.com', password: 'Clave123', codigoOtp: codigo });
    const sms2 = await supertest(app).post('/auth/email/enviar').send({ email: 'facil3@test.com' });
    const codigo2 = sms2.body.codigo as string;
    const res = await supertest(app)
      .post('/auth/registro-facil')
      .send({ nombre: 'Segundo', email: 'facil3@test.com', password: 'Clave123', codigoOtp: codigo2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_en_uso');
  });

  it('verificar-cuenta exige autenticación', async () => {
    const res = await supertest(app).post('/auth/verificar-cuenta').send({});
    expect(res.status).toBe(401);
  });

  it('verificar-cuenta completa los datos y marca la cuenta como verificada', async () => {
    const { token } = await registrarUsuario(app, 'Verif', { telefono: '+34600000010' });
    const sms = await supertest(app).post('/auth/sms/enviar').send({ telefono: '+34600000010' });
    const codigo = sms.body.codigo as string;

    const res = await supertest(app)
      .post('/auth/verificar-cuenta')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreCompleto: 'Verif Completo',
        telefono: '+34600000010',
        codigoOtp: codigo,
        fechaNacimiento: '1990-05-05',
        pais: 'España',
        terminosAceptados: true,
        preguntaSeguridad: 'nombre_mascota',
        respuestaSeguridad: 'Rex',
        dosFactores: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.usuario.cuentaVerificada).toBe(true);
  });

  it('verificar-cuenta valida los datos de seguridad', async () => {
    const { token } = await registrarUsuario(app, 'Verif2', { telefono: '+34600000011' });
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ nombreCompleto: 'X', telefono: '+34600000011', codigoOtp: '000000', fechaNacimiento: '1990-01-01', pais: 'España', terminosAceptados: true, preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Rex' }, 'nombre_completo_invalido'],
      [{ nombreCompleto: 'Válido', telefono: '12', codigoOtp: '000000', fechaNacimiento: '1990-01-01', pais: 'España', terminosAceptados: true, preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Rex' }, 'telefono_invalido'],
      [{ nombreCompleto: 'Válido', telefono: '+34600000011', codigoOtp: '000000', fechaNacimiento: '2010-01-01', pais: 'España', terminosAceptados: true, preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Rex' }, 'menor_de_edad'],
      [{ nombreCompleto: 'Válido', telefono: '+34600000011', codigoOtp: '000000', fechaNacimiento: '1990-01-01', pais: 'E', terminosAceptados: true, preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Rex' }, 'pais_requerido'],
      [{ nombreCompleto: 'Válido', telefono: '+34600000011', codigoOtp: '000000', fechaNacimiento: '1990-01-01', pais: 'España', terminosAceptados: false, preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Rex' }, 'terminos_no_aceptados'],
      [{ nombreCompleto: 'Válido', telefono: '+34600000011', codigoOtp: '000000', fechaNacimiento: '1990-01-01', pais: 'España', terminosAceptados: true, preguntaSeguridad: 'otra', respuestaSeguridad: 'Rex' }, 'pregunta_seguridad_invalida'],
      [{ nombreCompleto: 'Válido', telefono: '+34600000011', codigoOtp: '000000', fechaNacimiento: '1990-01-01', pais: 'España', terminosAceptados: true, preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'X' }, 'respuesta_seguridad_invalida'],
      [{ nombreCompleto: 'Válido', telefono: '+34600000011', codigoOtp: '123456', fechaNacimiento: '1990-01-01', pais: 'España', terminosAceptados: true, preguntaSeguridad: 'nombre_mascota', respuestaSeguridad: 'Rex' }, 'otp_invalido'],
    ];
    for (const [cuerpo, error] of casos) {
      reiniciarLimitador();
      const res = await supertest(app)
        .post('/auth/verificar-cuenta')
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
    }
  });
});

describeSupabase('auth: límite de peticiones', () => {
  it('bloquea con 429 tras superar el máximo de intentos de login', async () => {
    await registrarUsuario(app, 'Ana', { telefono: '+34600000001' });
    for (let i = 0; i < 10; i += 1) {
      await supertest(app).post('/auth/login').send({ identificador: 'Ana', password: 'Mala' });
    }
    const res = await supertest(app).post('/auth/login').send({ identificador: 'Ana', password: 'Mala' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('demasiadas_peticiones');
  });
});

describeSupabase('auth: registro permisivo (pruebas)', () => {
  afterEach(() => {
    delete process.env.REGISTRO_PERMISIVO;
  });

  it('con REGISTRO_PERMISIVO=1 crea la cuenta con solo el nombre', async () => {
    process.env.REGISTRO_PERMISIVO = '1';
    const res = await supertest(app).post('/auth/registro').send({ nombre: 'Rapido' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.nombre).toBe('Rapido');
    expect(res.body.usuario.saldo).toBe(1000);

    const login = await supertest(app).post('/auth/login').send({ identificador: 'Rapido', password: 'Prueba123' });
    expect(login.status).toBe(200);
  });

  it('el registro permisivo respeta el nombre en uso', async () => {
    process.env.REGISTRO_PERMISIVO = '1';
    await supertest(app).post('/auth/registro').send({ nombre: 'Unico' });
    const res = await supertest(app).post('/auth/registro').send({ nombre: 'Unico' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('nombre_en_uso');
  });
});