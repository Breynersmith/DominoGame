// server/src/routes/auth.ts
// Registro, login (con 2FA), recuperación de contraseña. Los usuarios viven en
// Supabase Auth (`auth.users`) y su perfil de juego en la tabla `perfiles`.

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import { admin, anon } from '../supabase';
import {
  hashOtp,
  hashRespuestaSeguridad,
  requiereAuth,
  esEmailValido,
  esMayorDeEdad,
  esPasswordFuerte,
  esPreguntaSeguridadValida,
  esRespuestaSeguridadValida,
  esTelefonoValido,
  generarCodigoOtp,
  serializarUsuario,
  verificarOtp,
  verificarRespuestaSeguridad,
  OTP_VALIDEZ_MS,
  UsuarioAutenticado,
} from '../auth';
import { limitador } from '../limiter';
import { asyncero } from '../asyncero';

const NOMBRE_MAX = 18;

// Modo de pruebas: con REGISTRO_PERMISIVO=1 (o en desarrollo) el registro solo exige
// el nombre; el resto se rellena con valores por defecto y no se requiere verificación
// SMS. En producción (NODE_ENV=production) y en tests es estricto.
function registroPermisivo(): boolean {
  return process.env.REGISTRO_PERMISIVO === '1' || process.env.NODE_ENV === 'development';
}

export interface FilaPerfil {
  id: number;
  auth_uid: string;
  nombre: string;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
  color: string;
  saldo: number;
  fecha_nacimiento: string | null;
  pais: string;
  terminos_aceptados_en: number | null;
  pregunta_seguridad: string | null;
  respuesta_seguridad_hash: string | null;
  dos_factores: number;
  kyc_estado: string;
  foto?: string | null;
}

function cargarPerfil(db: Db, id: number): Promise<FilaPerfil | undefined> {
  return db.one<FilaPerfil>(
    `SELECT *, foto_url AS foto FROM perfiles WHERE id = $1`,
    [id],
  );
}

async function buscarPerfilPorIdentificador(db: Db, identificador: string): Promise<FilaPerfil | undefined> {
  return db.one<FilaPerfil>(
    'SELECT *, foto_url AS foto FROM perfiles WHERE LOWER(nombre) = LOWER($1) OR LOWER(email) = LOWER($1)',
    [identificador],
  );
}

function enviarSms(telefono: string, codigo: string): void {
  if (process.env.SMS_PROVIDER) {
    // TODO: integración con el proveedor configurado.
    console.log(`[sms] ${telefono}: ${codigo}`);
  }
}

async function registrarOtp(db: Db, telefono: string): Promise<string> {
  const codigo = generarCodigoOtp();
  await db.ejecutar(
    'INSERT INTO codigos_otp (telefono, codigo_hash, expira_en, creado_en) VALUES ($1, $2, $3, $4)',
    [telefono, hashOtp(codigo), ahora() + OTP_VALIDEZ_MS, ahora()],
  );
  return codigo;
}

async function registrarOtpEmail(db: Db, email: string): Promise<string> {
  const codigo = generarCodigoOtp();
  await db.ejecutar(
    'INSERT INTO codigos_otp (telefono, email, codigo_hash, expira_en, creado_en) VALUES ($1, $2, $3, $4, $5)',
    ['', email, hashOtp(codigo), ahora() + OTP_VALIDEZ_MS, ahora()],
  );
  return codigo;
}

// Verifica un código OTP enviado por correo y lo consume si es válido.
async function verificarYConsumirOtpEmail(
  db: Db,
  email: string,
  codigo: string,
): Promise<'ok' | 'invalido' | 'expirado'> {
  const fila = await db.one<{ id: number; codigo_hash: string; consumido: number; expira_en: number }>(
    'SELECT id, codigo_hash, consumido, expira_en FROM codigos_otp WHERE email = $1 ORDER BY id DESC LIMIT 1',
    [email],
  );
  if (!fila) return 'invalido';
  if (fila.consumido === 1) return 'invalido';
  if (ahora() > fila.expira_en) return 'expirado';
  if (!verificarOtp(codigo, fila.codigo_hash)) return 'invalido';
  await db.ejecutar('UPDATE codigos_otp SET consumido = 1 WHERE id = $1', [fila.id]);
  return 'ok';
}

// Verifica un código OTP para un teléfono y lo consume si es válido.
async function verificarYConsumirOtp(
  db: Db,
  telefono: string,
  codigo: string,
): Promise<'ok' | 'invalido' | 'expirado'> {
  const fila = await db.one<{ id: number; codigo_hash: string; consumido: number; expira_en: number }>(
    'SELECT id, codigo_hash, consumido, expira_en FROM codigos_otp WHERE telefono = $1 ORDER BY id DESC LIMIT 1',
    [telefono],
  );
  if (!fila) return 'invalido';
  if (fila.consumido === 1) return 'invalido';
  if (ahora() > fila.expira_en) return 'expirado';
  if (!verificarOtp(codigo, fila.codigo_hash)) return 'invalido';
  await db.ejecutar('UPDATE codigos_otp SET consumido = 1 WHERE id = $1', [fila.id]);
  return 'ok';
}

function enmascararTelefono(telefono: string): string {
  if (telefono.length <= 6) return telefono;
  return `${telefono.slice(0, 3)}••••${telefono.slice(-3)}`;
}

// Crea el usuario en Supabase Auth y el perfil de juego; devuelve el token de
// acceso (o null si algo falla, tras responder el error adecuado).
async function crearCuenta(
  db: Db,
  res: Response,
  datos: {
    nombre: string;
    nombreCompleto: string;
    email: string;
    telefono: string | null;
    password: string;
    color: string;
    fechaNacimiento: string;
    pais: string;
    terminosAceptadosEn: number;
    preguntaSeguridad: string | null;
    respuestaSeguridad: string | null;
    dosFactores: number;
  },
): Promise<{ token: string; usuario: UsuarioAutenticado } | null> {
  if (await db.one('SELECT 1 FROM perfiles WHERE LOWER(nombre) = LOWER($1)', [datos.nombre])) {
    res.status(409).json({ error: 'nombre_en_uso' });
    return null;
  }
  if (await db.one('SELECT 1 FROM perfiles WHERE LOWER(email) = LOWER($1)', [datos.email])) {
    res.status(409).json({ error: 'email_en_uso' });
    return null;
  }
  if (await db.one('SELECT 1 FROM perfiles WHERE telefono = $1', [datos.telefono])) {
    res.status(409).json({ error: 'telefono_en_uso' });
    return null;
  }

  const { data: creado, error: errorCrear } = await admin().auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: { nombre: datos.nombre },
  });
  if (errorCrear || !creado?.user) {
    const mensaje = (errorCrear?.message ?? '').toLowerCase();
    const enUso = errorCrear?.status === 422 || mensaje.includes('already been registered') || mensaje.includes('ya está registrado');
    res.status(enUso ? 409 : 500).json({ error: enUso ? 'email_en_uso' : 'error_interno' });
    return null;
  }
  const authUid = creado.user.id;

  const info = (await db.one<{ id: number }>(
    `INSERT INTO perfiles
       (auth_uid, nombre, nombre_completo, email, telefono, fecha_nacimiento, pais,
        terminos_aceptados_en, pregunta_seguridad, respuesta_seguridad_hash, dos_factores,
        color, saldo, creado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      authUid,
      datos.nombre,
      datos.nombreCompleto,
      datos.email,
      datos.telefono,
      datos.fechaNacimiento,
      datos.pais,
      datos.terminosAceptadosEn,
      datos.preguntaSeguridad,
      datos.respuestaSeguridad ? hashRespuestaSeguridad(datos.respuestaSeguridad) : null,
      datos.dosFactores,
      datos.color,
      1000,
      ahora(),
    ],
  ))!;

  const sesion = await anon().auth.signInWithPassword({ email: datos.email, password: datos.password });
  if (sesion.error || !sesion.data.session) {
    res.status(500).json({ error: 'error_interno' });
    return null;
  }
  const fila = await cargarPerfil(db, info.id);
  if (!fila) {
    res.status(500).json({ error: 'error_interno' });
    return null;
  }
  const resultado = { token: sesion.data.session.access_token, usuario: serializarUsuario(fila) };
  res.status(201).json(resultado);
  return resultado;
}

export function crearRouterAuth(db: Db): Router {
  const r = Router();

  // POST /auth/sms/enviar { telefono } → genera y envía un OTP.
  r.post(
    '/sms/enviar',
    limitador({ clave: 'sms-enviar', ventanaMs: 60 * 1000, max: 3 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const telefono = String(req.body?.telefono ?? '').trim();
      if (!esTelefonoValido(telefono)) {
        res.status(400).json({ error: 'telefono_invalido' });
        return;
      }
      const codigo = await registrarOtp(db, telefono);
      enviarSms(telefono, codigo);
      res.json({ ok: true, demo: !process.env.SMS_PROVIDER, codigo: process.env.SMS_PROVIDER ? undefined : codigo });
    }),
  );

  // POST /auth/sms/verificar { telefono, codigo } → marca el teléfono como verificado.
  r.post(
    '/sms/verificar',
    limitador({ clave: 'sms-verificar', ventanaMs: 60 * 1000, max: 5 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const telefono = String(req.body?.telefono ?? '').trim();
      const codigo = String(req.body?.codigo ?? '');
      if (!esTelefonoValido(telefono)) {
        res.status(400).json({ error: 'telefono_invalido' });
        return;
      }
      const resultado = await verificarYConsumirOtp(db, telefono, codigo);
      if (resultado !== 'ok') {
        res.status(400).json({ error: resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido' });
        return;
      }
      await db.ejecutar('UPDATE codigos_otp SET verificado = 1 WHERE telefono = $1 AND consumido = 1', [telefono]);
      res.json({ ok: true });
    }),
  );

  // POST /auth/registro
  // { nombre, nombreCompleto, email, telefono, password, color?, fechaNacimiento, pais,
  //   terminosAceptados, codigoOtp, preguntaSeguridad, respuestaSeguridad, dosFactores? }
  r.post(
    '/registro',
    limitador({ clave: 'registro', ventanaMs: 60 * 1000, max: 5 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const nombre = String(req.body?.nombre ?? '').trim();
      const nombreCompleto = String(req.body?.nombreCompleto ?? '').trim();
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const telefono = String(req.body?.telefono ?? '').trim();
      const password = String(req.body?.password ?? '');
      const color = typeof req.body?.color === 'string' ? req.body.color : '#006c49';
      const fechaNacimiento = String(req.body?.fechaNacimiento ?? '');
      const pais = String(req.body?.pais ?? '').trim();
      const terminosAceptados = req.body?.terminosAceptados === true;
      const codigoOtp = String(req.body?.codigoOtp ?? '');
      const preguntaSeguridad = String(req.body?.preguntaSeguridad ?? '');
      const respuestaSeguridad = String(req.body?.respuestaSeguridad ?? '');
      const dosFactores = req.body?.dosFactores === true ? 1 : 0;

      if (nombre.length < 2 || nombre.length > NOMBRE_MAX) {
        res.status(400).json({ error: 'nombre_invalido' });
        return;
      }

      if (registroPermisivo()) {
        // Registro de pruebas: solo el nombre es obligatorio.
        const sufijo = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
        const base = (nombre.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'jugador').slice(0, 12);

        const emailFinal =
          email.length > 0 && esEmailValido(email)
            ? email
            : `${base}-${sufijo}@prueba.local`;
        const telefonoFinal =
          telefono.length > 0 && esTelefonoValido(telefono)
            ? telefono
            : `+34${(Number(sufijo.slice(0, 9)) % 900000000) + 600000000}`;
        const nombreCompletoFinal = nombreCompleto.length >= 2 ? nombreCompleto : nombre;
        const passwordFinal = esPasswordFuerte(password) ? password : 'Prueba123';
        const fechaNacimientoFinal = esMayorDeEdad(fechaNacimiento) ? fechaNacimiento : '1990-01-01';
        const paisFinal = pais.length >= 2 ? pais : 'España';
        const preguntaFinal = esPreguntaSeguridadValida(preguntaSeguridad) ? preguntaSeguridad : 'nombre_mascota';
        const respuestaFinal = esRespuestaSeguridadValida(respuestaSeguridad) ? respuestaSeguridad : 'prueba';

        await crearCuenta(db, res, {
          nombre,
          nombreCompleto: nombreCompletoFinal,
          email: emailFinal,
          telefono: telefonoFinal,
          password: passwordFinal,
          color,
          fechaNacimiento: fechaNacimientoFinal,
          pais: paisFinal,
          terminosAceptadosEn: ahora(),
          preguntaSeguridad: preguntaFinal,
          respuestaSeguridad: respuestaFinal,
          dosFactores,
        });
        return;
      }

      if (nombreCompleto.length < 2) {
        res.status(400).json({ error: 'nombre_completo_invalido' });
        return;
      }
      if (!esEmailValido(email)) {
        res.status(400).json({ error: 'email_invalido' });
        return;
      }
      if (!esTelefonoValido(telefono)) {
        res.status(400).json({ error: 'telefono_invalido' });
        return;
      }
      if (!esPasswordFuerte(password)) {
        res.status(400).json({ error: 'password_debil' });
        return;
      }
      if (!esMayorDeEdad(fechaNacimiento)) {
        res.status(400).json({ error: 'menor_de_edad' });
        return;
      }
      if (pais.length < 2) {
        res.status(400).json({ error: 'pais_requerido' });
        return;
      }
      if (!terminosAceptados) {
        res.status(400).json({ error: 'terminos_no_aceptados' });
        return;
      }
      if (!esPreguntaSeguridadValida(preguntaSeguridad)) {
        res.status(400).json({ error: 'pregunta_seguridad_invalida' });
        return;
      }
      if (!esRespuestaSeguridadValida(respuestaSeguridad)) {
        res.status(400).json({ error: 'respuesta_seguridad_invalida' });
        return;
      }

      const otpResultado = await verificarYConsumirOtp(db, telefono, codigoOtp);
      if (otpResultado === 'invalido') {
        res.status(400).json({ error: 'otp_invalido' });
        return;
      }
      if (otpResultado === 'expirado') {
        res.status(400).json({ error: 'otp_expirado' });
        return;
      }

      await crearCuenta(db, res, {
        nombre,
        nombreCompleto,
        email,
        telefono,
        password,
        color,
        fechaNacimiento,
        pais,
        terminosAceptadosEn: ahora(),
        preguntaSeguridad,
        respuestaSeguridad,
        dosFactores,
      });
    }),
  );

  // POST /auth/login { identificador, password }
  // Devuelve token o, si el usuario tiene 2FA, un identificador temporal para el segundo paso.
  r.post(
    '/login',
    limitador({ clave: 'login', ventanaMs: 60 * 1000, max: 10 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const identificador = String(req.body?.identificador ?? req.body?.nombre ?? '').trim();
      const password = String(req.body?.password ?? '');

      const perfil = await buscarPerfilPorIdentificador(db, identificador);
      if (!perfil?.email) {
        res.status(401).json({ error: 'credenciales_invalidas' });
        return;
      }
      const sesion = await anon().auth.signInWithPassword({ email: perfil.email, password });
      if (sesion.error || !sesion.data.session) {
        res.status(401).json({ error: 'credenciales_invalidas' });
        return;
      }

      if (perfil.dos_factores === 1 && perfil.telefono) {
        // Guarda la sesión para el segundo paso y envía el OTP por SMS.
        await db.ejecutar(
          `INSERT INTO sessions_pendientes (auth_uid, access_token, creado_en)
           VALUES ($1, $2, $3)
           ON CONFLICT (auth_uid) DO UPDATE SET access_token = EXCLUDED.access_token, creado_en = EXCLUDED.creado_en`,
          [perfil.auth_uid, sesion.data.session.access_token, ahora()],
        );
        const codigo = await registrarOtp(db, perfil.telefono);
        enviarSms(perfil.telefono, codigo);
        res.json({
          requiere2fa: true,
          telefonoEnmascarado: enmascararTelefono(perfil.telefono),
          demo: !process.env.SMS_PROVIDER,
          codigo: process.env.SMS_PROVIDER ? undefined : codigo,
        });
        return;
      }

      res.json({ token: sesion.data.session.access_token, usuario: serializarUsuario(perfil) });
    }),
  );

  // POST /auth/login/2fa { identificador, codigo } → completa el login con el OTP.
  r.post(
    '/login/2fa',
    limitador({ clave: 'login-2fa', ventanaMs: 60 * 1000, max: 5 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const identificador = String(req.body?.identificador ?? req.body?.nombre ?? '').trim();
      const codigo = String(req.body?.codigo ?? '');

      const perfil = await buscarPerfilPorIdentificador(db, identificador);
      if (!perfil?.telefono) {
        res.status(401).json({ error: 'credenciales_invalidas' });
        return;
      }
      const resultado = await verificarYConsumirOtp(db, perfil.telefono, codigo);
      if (resultado !== 'ok') {
        res.status(400).json({ error: resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido' });
        return;
      }
      const pendiente = await db.one<{ access_token: string }>(
        'SELECT access_token FROM sessions_pendientes WHERE auth_uid = $1',
        [perfil.auth_uid],
      );
      if (!pendiente) {
        res.status(401).json({ error: 'credenciales_invalidas' });
        return;
      }
      res.json({ token: pendiente.access_token, usuario: serializarUsuario(perfil) });
    }),
  );

  // POST /auth/recuperar
  // Por SMS:  { telefono, codigoOtp, nuevoPassword }
  // Por pregunta de seguridad: { identificador, preguntaSeguridad, respuestaSeguridad, nuevoPassword }
  r.post(
    '/recuperar',
    limitador({ clave: 'recuperar', ventanaMs: 60 * 1000, max: 5 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const nuevoPassword = String(req.body?.nuevoPassword ?? '');
      if (nuevoPassword.length > 0 && !esPasswordFuerte(nuevoPassword)) {
        res.status(400).json({ error: 'password_debil' });
        return;
      }
      if (nuevoPassword.length === 0) {
        res.status(400).json({ error: 'sin_cambio' });
        return;
      }

      const telefono = String(req.body?.telefono ?? '').trim();
      const codigoOtp = String(req.body?.codigoOtp ?? '');

      if (telefono.length > 0) {
        // Ruta por SMS
        if (!esTelefonoValido(telefono)) {
          res.status(400).json({ error: 'telefono_invalido' });
          return;
        }
        const perfil = await db.one<FilaPerfil>('SELECT * FROM perfiles WHERE telefono = $1', [telefono]);
        if (!perfil?.email) {
          res.status(404).json({ error: 'usuario_no_encontrado' });
          return;
        }
        const resultado = await verificarYConsumirOtp(db, telefono, codigoOtp);
        if (resultado !== 'ok') {
          res.status(400).json({ error: resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido' });
          return;
        }
        const cambio = await admin().auth.admin.updateUserById(perfil.auth_uid, { password: nuevoPassword });
        if (cambio.error) {
          res.status(500).json({ error: 'error_interno' });
          return;
        }
        const sesion = await anon().auth.signInWithPassword({ email: perfil.email, password: nuevoPassword });
        if (sesion.error || !sesion.data.session) {
          res.status(500).json({ error: 'error_interno' });
          return;
        }
        const fila = await cargarPerfil(db, perfil.id);
        res.json({ token: sesion.data.session.access_token, usuario: fila ? serializarUsuario(fila) : undefined });
        return;
      }

      // Ruta por pregunta de seguridad
      const identificador = String(req.body?.identificador ?? '').trim();
      const preguntaSeguridad = String(req.body?.preguntaSeguridad ?? '');
      const respuestaSeguridad = String(req.body?.respuestaSeguridad ?? '');
      if (!esPreguntaSeguridadValida(preguntaSeguridad)) {
        res.status(400).json({ error: 'pregunta_seguridad_invalida' });
        return;
      }
      const perfil = await buscarPerfilPorIdentificador(db, identificador);
      if (!perfil?.email) {
        res.status(404).json({ error: 'usuario_no_encontrado' });
        return;
      }
      if (perfil.pregunta_seguridad !== preguntaSeguridad) {
        res.status(400).json({ error: 'respuesta_seguridad_invalida' });
        return;
      }
      if (!verificarRespuestaSeguridad(respuestaSeguridad, perfil.respuesta_seguridad_hash)) {
        res.status(400).json({ error: 'respuesta_seguridad_invalida' });
        return;
      }
      const cambio = await admin().auth.admin.updateUserById(perfil.auth_uid, { password: nuevoPassword });
      if (cambio.error) {
        res.status(500).json({ error: 'error_interno' });
        return;
      }
      const sesion = await anon().auth.signInWithPassword({ email: perfil.email, password: nuevoPassword });
      if (sesion.error || !sesion.data.session) {
        res.status(500).json({ error: 'error_interno' });
        return;
      }
      const fila = await cargarPerfil(db, perfil.id);
      res.json({ token: sesion.data.session.access_token, usuario: fila ? serializarUsuario(fila) : undefined });
    }),
  );

  // POST /auth/email/enviar { email } → genera y envía un OTP por correo.
  r.post(
    '/email/enviar',
    limitador({ clave: 'email-enviar', ventanaMs: 60 * 1000, max: 3 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      if (!esEmailValido(email)) {
        res.status(400).json({ error: 'email_invalido' });
        return;
      }
      const codigo = await registrarOtpEmail(db, email);
      // TODO: integración con el proveedor de correo.
      console.log(`[email] ${email}: ${codigo}`);
      res.json({ ok: true, demo: !process.env.SMS_PROVIDER, codigo: process.env.SMS_PROVIDER ? undefined : codigo });
    }),
  );

  // POST /auth/registro-facil { nombre, email, password, codigoOtp, color? }
  // Registro rápido: nombre + email + contraseña y verificación del código de
  // correo. El resto de datos de seguridad se piden después mediante
  // POST /auth/verificar-cuenta.
  r.post(
    '/registro-facil',
    limitador({ clave: 'registro-facil', ventanaMs: 60 * 1000, max: 10 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const nombre = String(req.body?.nombre ?? '').trim();
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      const codigoOtp = String(req.body?.codigoOtp ?? '');
      const color =
        typeof req.body?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(req.body.color)
          ? req.body.color
          : '#006c49';

      if (nombre.length < 2 || nombre.length > NOMBRE_MAX) {
        res.status(400).json({ error: 'nombre_invalido' });
        return;
      }
      if (!esEmailValido(email)) {
        res.status(400).json({ error: 'email_invalido' });
        return;
      }
      if (!esPasswordFuerte(password)) {
        res.status(400).json({ error: 'password_debil' });
        return;
      }
      if (await db.one('SELECT 1 FROM perfiles WHERE LOWER(email) = LOWER($1)', [email])) {
        res.status(409).json({ error: 'email_en_uso' });
        return;
      }

      const otpResultado = await verificarYConsumirOtpEmail(db, email, codigoOtp);
      if (otpResultado === 'invalido') {
        res.status(400).json({ error: 'otp_invalido' });
        return;
      }
      if (otpResultado === 'expirado') {
        res.status(400).json({ error: 'otp_expirado' });
        return;
      }

      await crearCuenta(db, res, {
        nombre,
        nombreCompleto: nombre,
        email,
        telefono: null,
        password,
        color,
        fechaNacimiento: '',
        pais: '',
        terminosAceptadosEn: 0,
        preguntaSeguridad: null,
        respuestaSeguridad: null,
        dosFactores: 0,
      });
    }),
  );

  // POST /auth/verificar-cuenta (requiere token)
  // Completa los datos de seguridad del perfil: nombre completo, teléfono
  // (verificado por SMS), fecha de nacimiento, país, términos, pregunta de
  // seguridad y 2FA. Marca la cuenta como verificada.
  r.post(
    '/verificar-cuenta',
    requiereAuth(db),
    limitador({ clave: 'verificar-cuenta', ventanaMs: 60 * 1000, max: 5 }),
    asyncero(async (req: Request, res: Response): Promise<void> => {
      const u = (req as Request & { usuario: UsuarioAutenticado }).usuario;
      const nombreCompleto = String(req.body?.nombreCompleto ?? '').trim();
      const telefono = String(req.body?.telefono ?? '').trim();
      const codigoOtp = String(req.body?.codigoOtp ?? '');
      const fechaNacimiento = String(req.body?.fechaNacimiento ?? '');
      const pais = String(req.body?.pais ?? '').trim();
      const terminosAceptados = req.body?.terminosAceptados === true;
      const preguntaSeguridad = String(req.body?.preguntaSeguridad ?? '');
      const respuestaSeguridad = String(req.body?.respuestaSeguridad ?? '');
      const dosFactores = req.body?.dosFactores === true ? 1 : 0;

      if (nombreCompleto.length < 2) {
        res.status(400).json({ error: 'nombre_completo_invalido' });
        return;
      }
      if (!esTelefonoValido(telefono)) {
        res.status(400).json({ error: 'telefono_invalido' });
        return;
      }
      if (!esMayorDeEdad(fechaNacimiento)) {
        res.status(400).json({ error: 'menor_de_edad' });
        return;
      }
      if (pais.length < 2) {
        res.status(400).json({ error: 'pais_requerido' });
        return;
      }
      if (!terminosAceptados) {
        res.status(400).json({ error: 'terminos_no_aceptados' });
        return;
      }
      if (!esPreguntaSeguridadValida(preguntaSeguridad)) {
        res.status(400).json({ error: 'pregunta_seguridad_invalida' });
        return;
      }
      if (!esRespuestaSeguridadValida(respuestaSeguridad)) {
        res.status(400).json({ error: 'respuesta_seguridad_invalida' });
        return;
      }

      const telefonoEnUso = await db.one(
        'SELECT 1 FROM perfiles WHERE telefono = $1 AND id != $2',
        [telefono, u.id],
      );
      if (telefonoEnUso) {
        res.status(409).json({ error: 'telefono_en_uso' });
        return;
      }

      const otpResultado = await verificarYConsumirOtp(db, telefono, codigoOtp);
      if (otpResultado === 'invalido') {
        res.status(400).json({ error: 'otp_invalido' });
        return;
      }
      if (otpResultado === 'expirado') {
        res.status(400).json({ error: 'otp_expirado' });
        return;
      }

      await db.ejecutar(
        `UPDATE perfiles SET
           nombre_completo = $1, telefono = $2, fecha_nacimiento = $3, pais = $4,
           terminos_aceptados_en = $5, pregunta_seguridad = $6, respuesta_seguridad_hash = $7,
           dos_factores = $8, cuenta_verificada = 1
         WHERE id = $9`,
        [
          nombreCompleto,
          telefono,
          fechaNacimiento,
          pais,
          ahora(),
          preguntaSeguridad,
          hashRespuestaSeguridad(respuestaSeguridad),
          dosFactores,
          u.id,
        ],
      );

      const fila = await cargarPerfil(db, u.id);
      res.json({ usuario: fila ? serializarUsuario(fila) : undefined });
    }),
  );

  return r;
}
