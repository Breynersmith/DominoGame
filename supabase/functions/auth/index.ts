// supabase/functions/auth/index.ts
// Registro, login (con 2FA), recuperación de contraseña y verificación de
// cuenta. Los usuarios viven en Supabase Auth (`auth.users`) y su perfil de
// juego en la tabla `perfiles`.

import { Db, ahora } from '../_shared/db.ts';
import { Enrutador, Contexto } from '../_shared/http.ts';
import { json, errorJson } from '../_shared/respuesta.ts';
import { permitido } from '../_shared/limiter.ts';
import { admin, anon } from '../_shared/supabase.ts';
import { proveedorSms, registroPermisivo } from '../_shared/config.ts';
import {
  esEmailValido,
  esMayorDeEdad,
  esPasswordFuerte,
  esPreguntaSeguridadValida,
  esRespuestaSeguridadValida,
  esTelefonoValido,
  generarCodigoOtp,
  hashOtp,
  hashRespuestaSeguridad,
  serializarUsuario,
  verificarOtp,
  verificarRespuestaSeguridad,
  OTP_VALIDEZ_MS,
  UsuarioAutenticado,
} from '../_shared/auth.ts';

const NOMBRE_MAX = 18;

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
  return db.one<FilaPerfil>('SELECT *, foto_url AS foto FROM perfiles WHERE id = $1', [id]);
}

function buscarPerfilPorIdentificador(db: Db, identificador: string): Promise<FilaPerfil | undefined> {
  return db.one<FilaPerfil>(
    'SELECT *, foto_url AS foto FROM perfiles WHERE LOWER(nombre) = LOWER($1) OR LOWER(email) = LOWER($1)',
    [identificador],
  );
}

function enviarSms(telefono: string, codigo: string): void {
  if (proveedorSms()) {
    // TODO: integración con el proveedor configurado.
    console.log(`[sms] ${telefono}: ${codigo}`);
  }
}

// En demo se devuelve el código en la respuesta para poder probar el flujo.
function codigoDemo(codigo: string): { demo: boolean; codigo?: string } {
  return proveedorSms() ? { demo: false } : { demo: true, codigo };
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

interface DatosCrearCuenta {
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
}

async function crearCuenta(
  db: Db,
  datos: DatosCrearCuenta,
): Promise<{ status: number; cuerpo: { token: string; usuario: UsuarioAutenticado } | { error: string } }> {
  if (await db.one('SELECT 1 FROM perfiles WHERE LOWER(nombre) = LOWER($1)', [datos.nombre])) {
    return { status: 409, cuerpo: { error: 'nombre_en_uso' } };
  }
  if (await db.one('SELECT 1 FROM perfiles WHERE LOWER(email) = LOWER($1)', [datos.email])) {
    return { status: 409, cuerpo: { error: 'email_en_uso' } };
  }
  if (datos.telefono && (await db.one('SELECT 1 FROM perfiles WHERE telefono = $1', [datos.telefono]))) {
    return { status: 409, cuerpo: { error: 'telefono_en_uso' } };
  }

  const { data: creado, error: errorCrear } = await admin().auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: { nombre: datos.nombre },
  });
  if (errorCrear || !creado?.user) {
    const mensaje = (errorCrear?.message ?? '').toLowerCase();
    const enUso =
      errorCrear?.status === 422 ||
      mensaje.includes('already been registered') ||
      mensaje.includes('ya está registrado');
    return { status: enUso ? 409 : 500, cuerpo: { error: enUso ? 'email_en_uso' : 'error_interno' } };
  }
  const authUid = creado.user.id;

  const info = await db.one<{ id: number }>(
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
  );
  if (!info) {
    return { status: 500, cuerpo: { error: 'error_interno' } };
  }

  const sesion = await anon().auth.signInWithPassword({ email: datos.email, password: datos.password });
  if (sesion.error || !sesion.data.session) {
    return { status: 500, cuerpo: { error: 'error_interno' } };
  }
  const fila = await cargarPerfil(db, info.id);
  if (!fila) {
    return { status: 500, cuerpo: { error: 'error_interno' } };
  }
  return {
    status: 201,
    cuerpo: { token: sesion.data.session.access_token, usuario: serializarUsuario(fila) },
  };
}

const db = new Db();
const r = new Enrutador(db);

// //__RUTAS_1__//
// POST /auth/sms/enviar { telefono } → genera y envía un OTP.
r.post('/sms/enviar', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'sms-enviar', ventanaMs: 60 * 1000, max: 3 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const telefono = String(ctx.cuerpo?.telefono ?? '').trim();
  if (!esTelefonoValido(telefono)) {
    return errorJson('telefono_invalido');
  }
  const codigo = await registrarOtp(db, telefono);
  enviarSms(telefono, codigo);
  return json({ ok: true, ...codigoDemo(codigo) });
});

// POST /auth/sms/verificar { telefono, codigo } → marca el teléfono como verificado.
r.post('/sms/verificar', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'sms-verificar', ventanaMs: 60 * 1000, max: 5 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const telefono = String(ctx.cuerpo?.telefono ?? '').trim();
  const codigo = String(ctx.cuerpo?.codigo ?? '');
  if (!esTelefonoValido(telefono)) {
    return errorJson('telefono_invalido');
  }
  const resultado = await verificarYConsumirOtp(db, telefono, codigo);
  if (resultado !== 'ok') {
    return errorJson(resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido');
  }
  await db.ejecutar('UPDATE codigos_otp SET verificado = 1 WHERE telefono = $1 AND consumido = 1', [telefono]);
  return json({ ok: true });
});

// POST /auth/registro
r.post('/registro', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'registro', ventanaMs: 60 * 1000, max: 5 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const nombre = String(ctx.cuerpo?.nombre ?? '').trim();
  const nombreCompleto = String(ctx.cuerpo?.nombreCompleto ?? '').trim();
  const email = String(ctx.cuerpo?.email ?? '').trim().toLowerCase();
  const telefono = String(ctx.cuerpo?.telefono ?? '').trim();
  const password = String(ctx.cuerpo?.password ?? '');
  const color = typeof ctx.cuerpo?.color === 'string' ? ctx.cuerpo.color : '#006c49';
  const fechaNacimiento = String(ctx.cuerpo?.fechaNacimiento ?? '');
  const pais = String(ctx.cuerpo?.pais ?? '').trim();
  const terminosAceptados = ctx.cuerpo?.terminosAceptados === true;
  const codigoOtp = String(ctx.cuerpo?.codigoOtp ?? '');
  const preguntaSeguridad = String(ctx.cuerpo?.preguntaSeguridad ?? '');
  const respuestaSeguridad = String(ctx.cuerpo?.respuestaSeguridad ?? '');
  const dosFactores = ctx.cuerpo?.dosFactores === true ? 1 : 0;

  if (nombre.length < 2 || nombre.length > NOMBRE_MAX) {
    return errorJson('nombre_invalido');
  }

  if (registroPermisivo()) {
    const sufijo = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const base = (nombre.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'jugador').slice(0, 12);
    const emailFinal = email.length > 0 && esEmailValido(email) ? email : `${base}-${sufijo}@prueba.local`;
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

    const res = await crearCuenta(db, {
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
    return json(res.cuerpo, res.status);
  }

  if (nombreCompleto.length < 2) {
    return errorJson('nombre_completo_invalido');
  }
  if (!esEmailValido(email)) {
    return errorJson('email_invalido');
  }
  if (!esTelefonoValido(telefono)) {
    return errorJson('telefono_invalido');
  }
  if (!esPasswordFuerte(password)) {
    return errorJson('password_debil');
  }
  if (!esMayorDeEdad(fechaNacimiento)) {
    return errorJson('menor_de_edad');
  }
  if (pais.length < 2) {
    return errorJson('pais_requerido');
  }
  if (!terminosAceptados) {
    return errorJson('terminos_no_aceptados');
  }
  if (!esPreguntaSeguridadValida(preguntaSeguridad)) {
    return errorJson('pregunta_seguridad_invalida');
  }
  if (!esRespuestaSeguridadValida(respuestaSeguridad)) {
    return errorJson('respuesta_seguridad_invalida');
  }

  const otpResultado = await verificarYConsumirOtp(db, telefono, codigoOtp);
  if (otpResultado === 'invalido') {
    return errorJson('otp_invalido');
  }
  if (otpResultado === 'expirado') {
    return errorJson('otp_expirado');
  }

  const res = await crearCuenta(db, {
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
  return json(res.cuerpo, res.status);
});

// //__RUTAS_2__//
// POST /auth/login { identificador, password }
r.post('/login', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'login', ventanaMs: 60 * 1000, max: 10 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const identificador = String(ctx.cuerpo?.identificador ?? ctx.cuerpo?.nombre ?? '').trim();
  const password = String(ctx.cuerpo?.password ?? '');

  const perfil = await buscarPerfilPorIdentificador(db, identificador);
  if (!perfil?.email) {
    return errorJson('credenciales_invalidas', 401);
  }
  const sesion = await anon().auth.signInWithPassword({ email: perfil.email, password });
  if (sesion.error || !sesion.data.session) {
    return errorJson('credenciales_invalidas', 401);
  }

  if (perfil.dos_factores === 1 && perfil.telefono) {
    await db.ejecutar(
      `INSERT INTO sessions_pendientes (auth_uid, access_token, creado_en)
       VALUES ($1, $2, $3)
       ON CONFLICT (auth_uid) DO UPDATE SET access_token = EXCLUDED.access_token, creado_en = EXCLUDED.creado_en`,
      [perfil.auth_uid, sesion.data.session.access_token, ahora()],
    );
    const codigo = await registrarOtp(db, perfil.telefono);
    enviarSms(perfil.telefono, codigo);
    return json({
      requiere2fa: true,
      telefonoEnmascarado: enmascararTelefono(perfil.telefono),
      ...codigoDemo(codigo),
    });
  }

  return json({ token: sesion.data.session.access_token, usuario: serializarUsuario(perfil) });
});

// POST /auth/login/2fa { identificador, codigo } → completa el login con el OTP.
r.post('/login/2fa', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'login-2fa', ventanaMs: 60 * 1000, max: 5 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const identificador = String(ctx.cuerpo?.identificador ?? ctx.cuerpo?.nombre ?? '').trim();
  const codigo = String(ctx.cuerpo?.codigo ?? '');

  const perfil = await buscarPerfilPorIdentificador(db, identificador);
  if (!perfil?.telefono) {
    return errorJson('credenciales_invalidas', 401);
  }
  const resultado = await verificarYConsumirOtp(db, perfil.telefono, codigo);
  if (resultado !== 'ok') {
    return errorJson(resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido');
  }
  const pendiente = await db.one<{ access_token: string }>(
    'SELECT access_token FROM sessions_pendientes WHERE auth_uid = $1',
    [perfil.auth_uid],
  );
  if (!pendiente) {
    return errorJson('credenciales_invalidas', 401);
  }
  return json({ token: pendiente.access_token, usuario: serializarUsuario(perfil) });
});

// POST /auth/recuperar
// Por SMS:  { telefono, codigoOtp, nuevoPassword }
// Por pregunta de seguridad: { identificador, preguntaSeguridad, respuestaSeguridad, nuevoPassword }
r.post('/recuperar', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'recuperar', ventanaMs: 60 * 1000, max: 5 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const nuevoPassword = String(ctx.cuerpo?.nuevoPassword ?? '');
  if (nuevoPassword.length > 0 && !esPasswordFuerte(nuevoPassword)) {
    return errorJson('password_debil');
  }
  if (nuevoPassword.length === 0) {
    return errorJson('sin_cambio');
  }

  const telefono = String(ctx.cuerpo?.telefono ?? '').trim();
  const codigoOtp = String(ctx.cuerpo?.codigoOtp ?? '');

  if (telefono.length > 0) {
    // Ruta por SMS
    if (!esTelefonoValido(telefono)) {
      return errorJson('telefono_invalido');
    }
    const perfil = await db.one<FilaPerfil>('SELECT * FROM perfiles WHERE telefono = $1', [telefono]);
    if (!perfil?.email) {
      return errorJson('usuario_no_encontrado', 404);
    }
    const resultado = await verificarYConsumirOtp(db, telefono, codigoOtp);
    if (resultado !== 'ok') {
      return errorJson(resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido');
    }
    const cambio = await admin().auth.admin.updateUserById(perfil.auth_uid, { password: nuevoPassword });
    if (cambio.error) {
      return errorJson('error_interno', 500);
    }
    const sesion = await anon().auth.signInWithPassword({ email: perfil.email, password: nuevoPassword });
    if (sesion.error || !sesion.data.session) {
      return errorJson('error_interno', 500);
    }
    const fila = await cargarPerfil(db, perfil.id);
    return json({ token: sesion.data.session.access_token, usuario: fila ? serializarUsuario(fila) : undefined });
  }

  // Ruta por pregunta de seguridad
  const identificador = String(ctx.cuerpo?.identificador ?? '').trim();
  const preguntaSeguridad = String(ctx.cuerpo?.preguntaSeguridad ?? '');
  const respuestaSeguridad = String(ctx.cuerpo?.respuestaSeguridad ?? '');
  if (!esPreguntaSeguridadValida(preguntaSeguridad)) {
    return errorJson('pregunta_seguridad_invalida');
  }
  const perfil = await buscarPerfilPorIdentificador(db, identificador);
  if (!perfil?.email) {
    return errorJson('usuario_no_encontrado', 404);
  }
  if (perfil.pregunta_seguridad !== preguntaSeguridad) {
    return errorJson('respuesta_seguridad_invalida');
  }
  if (!verificarRespuestaSeguridad(respuestaSeguridad, perfil.respuesta_seguridad_hash)) {
    return errorJson('respuesta_seguridad_invalida');
  }
  const cambio = await admin().auth.admin.updateUserById(perfil.auth_uid, { password: nuevoPassword });
  if (cambio.error) {
    return errorJson('error_interno', 500);
  }
  const sesion = await anon().auth.signInWithPassword({ email: perfil.email, password: nuevoPassword });
  if (sesion.error || !sesion.data.session) {
    return errorJson('error_interno', 500);
  }
  const fila = await cargarPerfil(db, perfil.id);
  return json({ token: sesion.data.session.access_token, usuario: fila ? serializarUsuario(fila) : undefined });
});

// POST /auth/email/enviar { email } → genera y envía un OTP por correo.
r.post('/email/enviar', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'email-enviar', ventanaMs: 60 * 1000, max: 3 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const email = String(ctx.cuerpo?.email ?? '').trim().toLowerCase();
  if (!esEmailValido(email)) {
    return errorJson('email_invalido');
  }
  const codigo = await registrarOtpEmail(db, email);
  // TODO: integración con el proveedor de correo.
  console.log(`[email] ${email}: ${codigo}`);
  return json({ ok: true, ...codigoDemo(codigo) });
});

// POST /auth/registro-facil { nombre, email, password, codigoOtp, color? }
r.post('/registro-facil', false, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'registro-facil', ventanaMs: 60 * 1000, max: 10 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const nombre = String(ctx.cuerpo?.nombre ?? '').trim();
  const email = String(ctx.cuerpo?.email ?? '').trim().toLowerCase();
  const password = String(ctx.cuerpo?.password ?? '');
  const codigoOtp = String(ctx.cuerpo?.codigoOtp ?? '');
  const color =
    typeof ctx.cuerpo?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(ctx.cuerpo.color)
      ? ctx.cuerpo.color
      : '#006c49';

  if (nombre.length < 2 || nombre.length > NOMBRE_MAX) {
    return errorJson('nombre_invalido');
  }
  if (!esEmailValido(email)) {
    return errorJson('email_invalido');
  }
  if (!esPasswordFuerte(password)) {
    return errorJson('password_debil');
  }
  if (await db.one('SELECT 1 FROM perfiles WHERE LOWER(email) = LOWER($1)', [email])) {
    return errorJson('email_en_uso', 409);
  }

  const otpResultado = await verificarYConsumirOtpEmail(db, email, codigoOtp);
  if (otpResultado === 'invalido') {
    return errorJson('otp_invalido');
  }
  if (otpResultado === 'expirado') {
    return errorJson('otp_expirado');
  }

  const res = await crearCuenta(db, {
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
  return json(res.cuerpo, res.status);
});

// POST /auth/verificar-cuenta (requiere token)
r.post('/verificar-cuenta', true, async (ctx: Contexto): Promise<Response> => {
  if (!permitido({ clave: 'verificar-cuenta', ventanaMs: 60 * 1000, max: 5 }, ctx.req)) {
    return errorJson('demasiadas_peticiones', 429);
  }
  const u = ctx.usuario!;
  const nombreCompleto = String(ctx.cuerpo?.nombreCompleto ?? '').trim();
  const telefono = String(ctx.cuerpo?.telefono ?? '').trim();
  const codigoOtp = String(ctx.cuerpo?.codigoOtp ?? '');
  const fechaNacimiento = String(ctx.cuerpo?.fechaNacimiento ?? '');
  const pais = String(ctx.cuerpo?.pais ?? '').trim();
  const terminosAceptados = ctx.cuerpo?.terminosAceptados === true;
  const preguntaSeguridad = String(ctx.cuerpo?.preguntaSeguridad ?? '');
  const respuestaSeguridad = String(ctx.cuerpo?.respuestaSeguridad ?? '');
  const dosFactores = ctx.cuerpo?.dosFactores === true ? 1 : 0;

  if (nombreCompleto.length < 2) {
    return errorJson('nombre_completo_invalido');
  }
  if (!esTelefonoValido(telefono)) {
    return errorJson('telefono_invalido');
  }
  if (!esMayorDeEdad(fechaNacimiento)) {
    return errorJson('menor_de_edad');
  }
  if (pais.length < 2) {
    return errorJson('pais_requerido');
  }
  if (!terminosAceptados) {
    return errorJson('terminos_no_aceptados');
  }
  if (!esPreguntaSeguridadValida(preguntaSeguridad)) {
    return errorJson('pregunta_seguridad_invalida');
  }
  if (!esRespuestaSeguridadValida(respuestaSeguridad)) {
    return errorJson('respuesta_seguridad_invalida');
  }

  const telefonoEnUso = await db.one('SELECT 1 FROM perfiles WHERE telefono = $1 AND id != $2', [
    telefono,
    u.id,
  ]);
  if (telefonoEnUso) {
    return errorJson('telefono_en_uso', 409);
  }

  const otpResultado = await verificarYConsumirOtp(db, telefono, codigoOtp);
  if (otpResultado === 'invalido') {
    return errorJson('otp_invalido');
  }
  if (otpResultado === 'expirado') {
    return errorJson('otp_expirado');
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
  return json({ usuario: fila ? serializarUsuario(fila) : undefined });
});

// //__FIN__//

Deno.serve((req) => r.manejar(req));