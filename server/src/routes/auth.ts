// server/src/routes/auth.ts

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { Db, ahora } from '../db';
import {
  firmarToken,
  hashOtp,
  hashPassword,
  hashPin,
  hashRespuestaSeguridad,
  esEmailValido,
  esMayorDeEdad,
  esPasswordFuerte,
  esPreguntaSeguridadValida,
  esRespuestaSeguridadValida,
  esTelefonoValido,
  generarCodigoOtp,
  serializarUsuario,
  verificarOtp,
  verificarPassword,
  verificarRespuestaSeguridad,
  OTP_VALIDEZ_MS,
} from '../auth';
import { limitador } from '../limiter';

const NOMBRE_MAX = 18;
const DOCUMENTO_REGEX = /^[A-Za-z0-9-]{5,20}$/;

// Modo de pruebas: con REGISTRO_PERMISIVO=1 (o en desarrollo) el registro solo exige
// el nombre; el resto se rellena con valores por defecto y no se requiere verificación
// SMS. En producción (NODE_ENV=production) y en tests es estricto.
function registroPermisivo(): boolean {
  return process.env.REGISTRO_PERMISIVO === '1' || process.env.NODE_ENV === 'development';
}

interface FilaUsuario {
  id: number;
  nombre: string;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
  color: string;
  saldo: number;
  password_hash: string | null;
  dos_factores: number;
  pregunta_seguridad: string | null;
  respuesta_seguridad_hash: string | null;
  kyc_estado: string;
}

function cargarUsuario(db: Db, id: number): FilaUsuario | undefined {
  return db
    .prepare(
      `SELECT id, nombre, nombre_completo, email, telefono, color, saldo, password_hash,
              dos_factores, pregunta_seguridad, respuesta_seguridad_hash, kyc_estado
       FROM usuarios WHERE id = ?`
    )
    .get(id) as FilaUsuario | undefined;
}

function enviarSms(telefono: string, codigo: string): void {
  if (process.env.SMS_PROVIDER) {
    // TODO: integración con el proveedor configurado.
    console.log(`[sms] ${telefono}: ${codigo}`);
  }
}

function registrarOtp(db: Db, telefono: string): string {
  const codigo = generarCodigoOtp();
  db.prepare(
    'INSERT INTO codigos_otp (telefono, codigo_hash, expira_en, creado_en) VALUES (?, ?, ?, ?)'
  ).run(telefono, hashOtp(codigo), ahora() + OTP_VALIDEZ_MS, ahora());
  return codigo;
}

// Verifica un código OTP para un teléfono y lo consume si es válido.
function verificarYCOnsumirOtp(db: Db, telefono: string, codigo: string): 'ok' | 'invalido' | 'expirado' {
  const fila = db
    .prepare(
      'SELECT id, codigo_hash, consumido, expira_en FROM codigos_otp WHERE telefono = ? ORDER BY id DESC LIMIT 1'
    )
    .get(telefono) as { id: number; codigo_hash: string; consumido: number; expira_en: number } | undefined;
  if (!fila) return 'invalido';
  if (fila.consumido === 1) return 'invalido';
  if (ahora() > fila.expira_en) return 'expirado';
  if (!verificarOtp(codigo, fila.codigo_hash)) return 'invalido';
  db.prepare('UPDATE codigos_otp SET consumido = 1 WHERE id = ?').run(fila.id);
  return 'ok';
}

function enmascararTelefono(telefono: string): string {
  if (telefono.length <= 6) return telefono;
  return `${telefono.slice(0, 3)}••••${telefono.slice(-3)}`;
}

export function crearRouterAuth(db: Db): Router {
  const r = Router();

  // POST /auth/sms/enviar { telefono } → genera y envía un OTP.
  r.post(
    '/sms/enviar',
    limitador({ clave: 'sms-enviar', ventanaMs: 60 * 1000, max: 3 }),
    (req: Request, res: Response): void => {
      const telefono = String(req.body?.telefono ?? '').trim();
      if (!esTelefonoValido(telefono)) {
        res.status(400).json({ error: 'telefono_invalido' });
        return;
      }
      const codigo = registrarOtp(db, telefono);
      enviarSms(telefono, codigo);
      res.json({ ok: true, demo: !process.env.SMS_PROVIDER, codigo: process.env.SMS_PROVIDER ? undefined : codigo });
    },
  );

  // POST /auth/sms/verificar { telefono, codigo } → marca el teléfono como verificado.
  r.post(
    '/sms/verificar',
    limitador({ clave: 'sms-verificar', ventanaMs: 60 * 1000, max: 5 }),
    (req: Request, res: Response): void => {
      const telefono = String(req.body?.telefono ?? '').trim();
      const codigo = String(req.body?.codigo ?? '');
      if (!esTelefonoValido(telefono)) {
        res.status(400).json({ error: 'telefono_invalido' });
        return;
      }
      const resultado = verificarYCOnsumirOtp(db, telefono, codigo);
      if (resultado !== 'ok') {
        res.status(400).json({ error: resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido' });
        return;
      }
      db.prepare('UPDATE codigos_otp SET verificado = 1 WHERE telefono = ? AND consumido = 1').run(telefono);
      res.json({ ok: true });
    },
  );

  // POST /auth/registro
  // { nombre, nombreCompleto, email, telefono, password, color?, fechaNacimiento, pais,
  //   terminosAceptados, codigoOtp, preguntaSeguridad, respuestaSeguridad, dosFactores? }
  r.post(
    '/registro',
    limitador({ clave: 'registro', ventanaMs: 60 * 1000, max: 5 }),
    (req: Request, res: Response): void => {
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

        const existeNombre = db.prepare('SELECT id FROM usuarios WHERE nombre = ? COLLATE NOCASE').get(nombre);
        if (existeNombre) {
          res.status(409).json({ error: 'nombre_en_uso' });
          return;
        }
        if (db.prepare('SELECT id FROM usuarios WHERE email = ? COLLATE NOCASE').get(emailFinal)) {
          res.status(409).json({ error: 'email_en_uso' });
          return;
        }
        if (db.prepare('SELECT id FROM usuarios WHERE telefono = ?').get(telefonoFinal)) {
          res.status(409).json({ error: 'telefono_en_uso' });
          return;
        }

        const info = db
          .prepare(
            `INSERT INTO usuarios
               (nombre, nombre_completo, email, telefono, pin_hash, password_hash, fecha_nacimiento,
                pais, terminos_aceptados_en, pregunta_seguridad, respuesta_seguridad_hash, dos_factores,
                color, saldo, creado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            nombre,
            nombreCompletoFinal,
            emailFinal,
            telefonoFinal,
            hashPin(String(crypto.randomInt(0, 1_000_000))),
            hashPassword(passwordFinal),
            fechaNacimientoFinal,
            paisFinal,
            ahora(),
            preguntaFinal,
            hashRespuestaSeguridad(respuestaFinal),
            dosFactores,
            color,
            1000,
            ahora(),
          );
        const idPermisivo = Number(info.lastInsertRowid);
        const filaPermisiva = cargarUsuario(db, idPermisivo);
        if (!filaPermisiva) {
          res.status(500).json({ error: 'error_interno' });
          return;
        }
        res.status(201).json({ token: firmarToken(idPermisivo), usuario: serializarUsuario(filaPermisiva) });
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

      const otpResultado = verificarYCOnsumirOtp(db, telefono, codigoOtp);
      if (otpResultado === 'invalido') {
        res.status(400).json({ error: 'otp_invalido' });
        return;
      }
      if (otpResultado === 'expirado') {
        res.status(400).json({ error: 'otp_expirado' });
        return;
      }

      const existeNombre = db.prepare('SELECT id FROM usuarios WHERE nombre = ? COLLATE NOCASE').get(nombre);
      if (existeNombre) {
        res.status(409).json({ error: 'nombre_en_uso' });
        return;
      }
      const existeEmail = db.prepare('SELECT id FROM usuarios WHERE email = ? COLLATE NOCASE').get(email);
      if (existeEmail) {
        res.status(409).json({ error: 'email_en_uso' });
        return;
      }
      const existeTelefono = db.prepare('SELECT id FROM usuarios WHERE telefono = ?').get(telefono);
      if (existeTelefono) {
        res.status(409).json({ error: 'telefono_en_uso' });
        return;
      }

      // El PIN de 4 dígitos ya no existe: pin_hash se rellena con un valor aleatorio
      // para mantener la columna, pero la única credencial es la contraseña.
      const pinInerte = hashPin(String(crypto.randomInt(0, 1_000_000)));

      const info = db
        .prepare(
          `INSERT INTO usuarios
             (nombre, nombre_completo, email, telefono, pin_hash, password_hash, fecha_nacimiento,
              pais, terminos_aceptados_en, pregunta_seguridad, respuesta_seguridad_hash, dos_factores,
              color, saldo, creado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          nombre,
          nombreCompleto,
          email,
          telefono,
          pinInerte,
          hashPassword(password),
          fechaNacimiento,
          pais,
          ahora(),
          preguntaSeguridad,
          hashRespuestaSeguridad(respuestaSeguridad),
          dosFactores,
          color,
          1000,
          ahora(),
        );
      const id = Number(info.lastInsertRowid);
      const fila = cargarUsuario(db, id);
      if (!fila) {
        res.status(500).json({ error: 'error_interno' });
        return;
      }
      res.status(201).json({ token: firmarToken(id), usuario: serializarUsuario(fila) });
    },
  );

  // POST /auth/login { identificador, password }
  // Devuelve token o, si el usuario tiene 2FA, un identificador temporal para el segundo paso.
  r.post(
    '/login',
    limitador({ clave: 'login', ventanaMs: 60 * 1000, max: 10 }),
    (req: Request, res: Response): void => {
      const identificador = String(req.body?.identificador ?? req.body?.nombre ?? '').trim();
      const password = String(req.body?.password ?? '');

      const fila = db
        .prepare(
          `SELECT id, nombre, nombre_completo, email, telefono, color, saldo, password_hash,
                  dos_factores, pregunta_seguridad, respuesta_seguridad_hash, kyc_estado
           FROM usuarios WHERE (nombre = ? COLLATE NOCASE OR email = ? COLLATE NOCASE)`
        )
        .get(identificador, identificador) as FilaUsuario | undefined;

      if (!fila || !verificarPassword(password, fila.password_hash)) {
        res.status(401).json({ error: 'credenciales_invalidas' });
        return;
      }

      if (fila.dos_factores === 1 && fila.telefono) {
        const codigo = registrarOtp(db, fila.telefono);
        enviarSms(fila.telefono, codigo);
        res.json({
          requiere2fa: true,
          telefonoEnmascarado: enmascararTelefono(fila.telefono),
          demo: !process.env.SMS_PROVIDER,
          codigo: process.env.SMS_PROVIDER ? undefined : codigo,
        });
        return;
      }

      res.json({ token: firmarToken(fila.id), usuario: serializarUsuario(fila) });
    },
  );

  // POST /auth/login/2fa { identificador, codigo } → completa el login con el OTP.
  r.post(
    '/login/2fa',
    limitador({ clave: 'login-2fa', ventanaMs: 60 * 1000, max: 5 }),
    (req: Request, res: Response): void => {
      const identificador = String(req.body?.identificador ?? req.body?.nombre ?? '').trim();
      const codigo = String(req.body?.codigo ?? '');

      const fila = db
        .prepare(
          `SELECT id, telefono FROM usuarios WHERE (nombre = ? COLLATE NOCASE OR email = ? COLLATE NOCASE)`
        )
        .get(identificador, identificador) as { id: number; telefono: string | null } | undefined;
      if (!fila || !fila.telefono) {
        res.status(401).json({ error: 'credenciales_invalidas' });
        return;
      }
      const resultado = verificarYCOnsumirOtp(db, fila.telefono, codigo);
      if (resultado !== 'ok') {
        res.status(400).json({ error: resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido' });
        return;
      }
      const usuario = cargarUsuario(db, fila.id) as FilaUsuario;
      res.json({ token: firmarToken(fila.id), usuario: serializarUsuario(usuario) });
    },
  );

  // POST /auth/recuperar
  // Por SMS:  { telefono, codigoOtp, nuevoPassword }
  // Por pregunta de seguridad: { identificador, preguntaSeguridad, respuestaSeguridad, nuevoPassword }
  r.post(
    '/recuperar',
    limitador({ clave: 'recuperar', ventanaMs: 60 * 1000, max: 5 }),
    (req: Request, res: Response): void => {
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
        const fila = db.prepare('SELECT id FROM usuarios WHERE telefono = ?').get(telefono) as
          | { id: number }
          | undefined;
        if (!fila) {
          res.status(404).json({ error: 'usuario_no_encontrado' });
          return;
        }
        const resultado = verificarYCOnsumirOtp(db, telefono, codigoOtp);
        if (resultado !== 'ok') {
          res.status(400).json({ error: resultado === 'expirado' ? 'otp_expirado' : 'otp_invalido' });
          return;
        }
        db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hashPassword(nuevoPassword), fila.id);
        const usuario = cargarUsuario(db, fila.id) as FilaUsuario;
        res.json({ token: firmarToken(fila.id), usuario: serializarUsuario(usuario) });
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
      const fila = db
        .prepare(
          `SELECT id, pregunta_seguridad, respuesta_seguridad_hash FROM usuarios
           WHERE (nombre = ? COLLATE NOCASE OR email = ? COLLATE NOCASE)`
        )
        .get(identificador, identificador) as
        | { id: number; pregunta_seguridad: string | null; respuesta_seguridad_hash: string | null }
        | undefined;
      if (!fila) {
        res.status(404).json({ error: 'usuario_no_encontrado' });
        return;
      }
      if (fila.pregunta_seguridad !== preguntaSeguridad) {
        res.status(400).json({ error: 'respuesta_seguridad_invalida' });
        return;
      }
      if (!verificarRespuestaSeguridad(respuestaSeguridad, fila.respuesta_seguridad_hash)) {
        res.status(400).json({ error: 'respuesta_seguridad_invalida' });
        return;
      }
      db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hashPassword(nuevoPassword), fila.id);
      const usuario = cargarUsuario(db, fila.id) as FilaUsuario;
      res.json({ token: firmarToken(fila.id), usuario: serializarUsuario(usuario) });
    },
  );

  return r;
}