import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PinPad } from '../components/PinPad';
import { IconoDado } from '../components/icons/IconoDado';
import { IconoPersona } from '../components/icons/IconoPersona';
import { IconoPlay } from '../components/icons/IconoPlay';
import { FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { PREGUNTAS_SEGURIDAD } from '../constants/preguntasSeguridad';
import { IDIOMAS, Traducciones } from '../i18n/traducciones';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';
import { apiEnviarSms, apiRegistro, apiRegistroRapido, ErrorApi } from '../services/api';

// En desarrollo el registro es rápido (solo nombre), igual que el servidor permisivo.
// En producción se muestra el formulario completo. Se puede forzar con
// EXPO_PUBLIC_REGISTRO_RAPIDO=1 (activar) o =0 (desactivar).
const REGISTRO_RAPIDO =
  process.env.EXPO_PUBLIC_REGISTRO_RAPIDO === '1' ||
  (process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_REGISTRO_RAPIDO !== '0');

const COLOR_MENTA = '#6FFBBE';
const COLOR_DORADO = '#FACC15';
const COLORES_AVATAR = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4'];
const LARGO_OTP = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_REGEX = /^\+?[0-9]{8,15}$/;

type ErrorCampo =
  | 'nombreCompleto'
  | 'nombre'
  | 'email'
  | 'telefono'
  | 'password'
  | 'confirmar'
  | 'fecha'
  | 'pais'
  | 'terminos'
  | 'respuestaSeguridad';

function esFechaValida(dia: string, mes: string, anio: string): boolean {
  const d = Number(dia);
  const m = Number(mes);
  const a = Number(anio);
  if (!dia || !mes || !anio || a < 1900) return false;
  const fecha = new Date(a, m - 1, d);
  if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return false;
  const hoy = new Date();
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad -= 1;
  return edad >= 18;
}

export function RegistroScreen() {
  const t = useT();
  const registrar = useAppStore(s => s.registrar);
  const actualizarAjustes = useAppStore(s => s.actualizarAjustes);
  const idioma = useAppStore(s => s.ajustes.idioma);

  const [fase, setFase] = useState<'datos' | 'otp'>('datos');

  const [nombre, setNombre] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState('');
  const [pais, setPais] = useState('');
  const [terminos, setTerminos] = useState(false);
  const [color, setColor] = useState(COLORES_AVATAR[0]);
  const [preguntaSeguridad, setPreguntaSeguridad] = useState('nombre_mascota');
  const [respuestaSeguridad, setRespuestaSeguridad] = useState('');
  const [dosFactores, setDosFactores] = useState(false);

  const [errores, setErrores] = useState<Partial<Record<ErrorCampo, boolean>>>({});

  const [codigoOtp, setCodigoOtp] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoDemo, setCodigoDemo] = useState('');
  const [errorServidor, setErrorServidor] = useState('');

  const limpiarError = (campo: ErrorCampo) =>
    setErrores(e => ({ ...e, [campo]: false }));

  const continuar = () => {
    const nuevos: Partial<Record<ErrorCampo, boolean>> = {};
    if (nombreCompleto.trim().length < 2) nuevos.nombreCompleto = true;
    if (nombre.trim().length < 2) nuevos.nombre = true;
    if (!EMAIL_REGEX.test(email.trim())) nuevos.email = true;
    if (!TELEFONO_REGEX.test(telefono.trim())) nuevos.telefono = true;
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) nuevos.password = true;
    if (confirmar !== password) nuevos.confirmar = true;
    if (!esFechaValida(dia.trim(), mes.trim(), anio.trim())) nuevos.fecha = true;
    if (pais.trim().length < 2) nuevos.pais = true;
    if (!terminos) nuevos.terminos = true;
    if (respuestaSeguridad.trim().length < 2) nuevos.respuestaSeguridad = true;
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setFase('otp');
  };

  const enviarCodigo = async () => {
    setErrorServidor('');
    setEnviando(true);
    try {
      const r = await apiEnviarSms(telefono.trim());
      setCodigoEnviado(true);
      setCodigoDemo(r.demo ? (r.codigo ?? '') : '');
    } catch (err) {
      setErrorServidor(err instanceof ErrorApi && err.codigo === 'sin_conexion' ? 'sinConexion' : 'telefonoInvalido');
    } finally {
      setEnviando(false);
    }
  };

  const crearCuenta = async () => {
    if (codigoOtp.length !== LARGO_OTP) {
      setErrorServidor('otpInvalido');
      return;
    }
    setErrorServidor('');
    setCreando(true);
    try {
      const fechaNacimiento = `${anio.trim()}-${mes.trim().padStart(2, '0')}-${dia.trim().padStart(2, '0')}`;
      const r = await apiRegistro({
        nombre: nombre.trim(),
        nombreCompleto: nombreCompleto.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        password,
        color,
        fechaNacimiento,
        pais: pais.trim(),
        terminosAceptados: true,
        codigoOtp,
        preguntaSeguridad,
        respuestaSeguridad: respuestaSeguridad.trim(),
        dosFactores,
      });
      registrar(
        {
          nombre: nombre.trim(),
          nombreCompleto: nombreCompleto.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          fechaNacimiento,
          pais: pais.trim(),
          color,
        },
        { yaRegistrado: r },
      );
    } catch (err) {
      if (err instanceof ErrorApi) {
        const mapa: Record<string, string> = {
          otp_invalido: 'otpInvalido',
          otp_expirado: 'otpExpirado',
          email_en_uso: 'emailEnUso',
          telefono_en_uso: 'telefonoEnUso',
          nombre_en_uso: 'nombreEnUso',
          sin_conexion: 'sinConexion',
        };
        setErrorServidor(mapa[err.codigo] ?? 'otpInvalido');
      } else {
        setErrorServidor('otpInvalido');
      }
    } finally {
      setCreando(false);
    }
  };

  const crearCuentaRapida = async () => {
    if (nombre.trim().length < 2) {
      setErrores({ nombre: true });
      return;
    }
    setErrores({});
    setCreando(true);
    try {
      const r = await apiRegistroRapido(nombre.trim(), color);
      registrar({ nombre: nombre.trim(), color }, { yaRegistrado: r });
    } catch (err) {
      // En modo pruebas mostramos el código real del servidor para diagnosticar.
      setErrorServidor(err instanceof ErrorApi ? `server:${err.codigo}` : 'sin_conexion');
    } finally {
      setCreando(false);
    }
  };

  if (REGISTRO_RAPIDO) {
    return (
      <LinearGradient
        colors={['#0A4A33', '#022416']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fondo}
      >
        <View style={styles.barraSuperior}>
          <View style={styles.botonIcono}>
            <IconoDado color={COLOR_DORADO} size={22} />
          </View>
          <Text style={styles.tituloBarra}>Domino</Text>
          <View style={styles.reservaIcono} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.cabecera}>
              <Text style={styles.tituloCabecera}>{t('appName')}</Text>
              <Text style={styles.subtituloCabecera}>{t('crearCuenta')}</Text>
            </View>

            <View style={styles.tarjeta}>
              <LinearGradient
                colors={[color, '#003527']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <IconoPersona color="#ffffff" size={40} />
              </LinearGradient>

              <Text style={styles.etiqueta}>{t('nombreUsuario')}</Text>
              <TextInput
                style={[styles.input, errores.nombre && styles.inputError]}
                value={nombre}
                placeholder={t('nombrePlaceholder')}
                placeholderTextColor="#9ca3af"
                maxLength={18}
                autoCapitalize="none"
                onChangeText={text => {
                  setNombre(text);
                  limpiarError('nombre');
                }}
              />
              {errores.nombre && <Text style={styles.errorTexto}>{t('nombreRequerido')}</Text>}
              {errorServidor !== '' && <Text style={styles.errorServidor}>{errorServidor.startsWith('server:') ? errorServidor : t(errorServidor as keyof Traducciones)}</Text>}

              <Text style={styles.etiqueta}>{t('eligeColor')}</Text>
              <View style={styles.filaColores}>
                {COLORES_AVATAR.map(c => (
                  <Pressable
                    key={c}
                    style={[styles.circuloColor, { backgroundColor: c }, c === color && styles.circuloSeleccionado]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <Text style={styles.etiqueta}>{t('idioma')}</Text>
              <View style={styles.filaIdiomas}>
                {IDIOMAS.map(id => (
                  <Pressable
                    key={id.codigo}
                    style={[styles.chipIdioma, idioma === id.codigo && styles.chipIdiomaActivo]}
                    onPress={() => actualizarAjustes({ idioma: id.codigo })}
                  >
                    <Text style={[styles.textoChip, idioma === id.codigo && styles.textoChipActivo]}>
                      {t(id.etiquetaClave)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <LinearGradient
            colors={['rgba(2,36,22,0)', 'rgba(2,36,22,0.9)', '#022416']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.pie}
          >
            <Pressable style={[styles.botonContinuar, creando && styles.deshabilitado]} onPress={crearCuentaRapida} disabled={creando}>
              <LinearGradient
                colors={['#00B96B', '#007A44']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradienteBoton}
              >
                <Text style={styles.textoContinuar}>{creando ? '…' : t('verificarYCrear').toUpperCase()}</Text>
                <IconoPlay color="#ffffff" size={24} />
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0A4A33', '#022416']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.fondo}
    >
      <View style={styles.barraSuperior}>
        <View style={styles.botonIcono}>
          <IconoDado color={COLOR_DORADO} size={22} />
        </View>
        <Text style={styles.tituloBarra}>Domino</Text>
        <View style={styles.reservaIcono} />
      </View>

      {fase === 'datos' ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.cabecera}>
              <Text style={styles.tituloCabecera}>{t('appName')}</Text>
              <Text style={styles.subtituloCabecera}>{t('crearCuenta')}</Text>
            </View>

            <View style={styles.tarjeta}>
              <LinearGradient
                colors={[color, '#003527']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <IconoPersona color="#ffffff" size={40} />
              </LinearGradient>

              <Text style={styles.etiqueta}>{t('nombreCompleto')}</Text>
              <TextInput
                style={[styles.input, errores.nombreCompleto && styles.inputError]}
                value={nombreCompleto}
                placeholder={t('nombreCompleto')}
                placeholderTextColor="#9ca3af"
                maxLength={60}
                onChangeText={text => {
                  setNombreCompleto(text);
                  limpiarError('nombreCompleto');
                }}
              />
              {errores.nombreCompleto && <Text style={styles.errorTexto}>{t('nombreRequerido')}</Text>}

              <Text style={styles.etiqueta}>{t('nombreUsuario')}</Text>
              <TextInput
                style={[styles.input, errores.nombre && styles.inputError]}
                value={nombre}
                placeholder={t('nombrePlaceholder')}
                placeholderTextColor="#9ca3af"
                maxLength={18}
                autoCapitalize="none"
                onChangeText={text => {
                  setNombre(text);
                  limpiarError('nombre');
                }}
              />
              {errores.nombre && <Text style={styles.errorTexto}>{t('nombreRequerido')}</Text>}

              <Text style={styles.etiqueta}>{t('email')}</Text>
              <TextInput
                style={[styles.input, errores.email && styles.inputError]}
                value={email}
                placeholder="usuario@correo.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={80}
                onChangeText={text => {
                  setEmail(text);
                  limpiarError('email');
                }}
              />
              {errores.email && <Text style={styles.errorTexto}>{t('emailInvalido')}</Text>}

              <Text style={styles.etiqueta}>{t('telefono')}</Text>
              <TextInput
                style={[styles.input, errores.telefono && styles.inputError]}
                value={telefono}
                placeholder="+34600000000"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                autoCorrect={false}
                maxLength={16}
                onChangeText={text => {
                  setTelefono(text);
                  limpiarError('telefono');
                }}
              />
              {errores.telefono && <Text style={styles.errorTexto}>{t('telefonoInvalido')}</Text>}

              <Text style={styles.etiqueta}>{t('contrasena')}</Text>
              <TextInput
                style={[styles.input, errores.password && styles.inputError]}
                value={password}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={128}
                onChangeText={text => {
                  setPassword(text);
                  limpiarError('password');
                }}
              />
              <Text style={styles.ayudaTexto}>{t('passwordDebil')}</Text>
              {errores.password && <Text style={styles.errorTexto}>{t('passwordDebil')}</Text>}

              <Text style={styles.etiqueta}>{t('confirmarContrasena')}</Text>
              <TextInput
                style={[styles.input, errores.confirmar && styles.inputError]}
                value={confirmar}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={128}
                onChangeText={text => {
                  setConfirmar(text);
                  limpiarError('confirmar');
                }}
              />
              {errores.confirmar && <Text style={styles.errorTexto}>{t('contrasenasNoCoinciden')}</Text>}

              <Text style={styles.etiqueta}>{t('fechaNacimiento')}</Text>
              <View style={styles.filaFecha}>
                <TextInput
                  style={[styles.input, styles.inputFecha, errores.fecha && styles.inputError]}
                  value={dia}
                  placeholder={t('dia')}
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={text => {
                    setDia(text);
                    limpiarError('fecha');
                  }}
                />
                <TextInput
                  style={[styles.input, styles.inputFecha, errores.fecha && styles.inputError]}
                  value={mes}
                  placeholder={t('mes')}
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={text => {
                    setMes(text);
                    limpiarError('fecha');
                  }}
                />
                <TextInput
                  style={[styles.input, styles.inputFecha, errores.fecha && styles.inputError]}
                  value={anio}
                  placeholder={t('anio')}
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={text => {
                    setAnio(text);
                    limpiarError('fecha');
                  }}
                />
              </View>
              {errores.fecha && <Text style={styles.errorTexto}>{t('menorDeEdad')}</Text>}

              <Text style={styles.etiqueta}>{t('pais')}</Text>
              <TextInput
                style={[styles.input, errores.pais && styles.inputError]}
                value={pais}
                placeholder={t('pais')}
                placeholderTextColor="#9ca3af"
                maxLength={40}
                onChangeText={text => {
                  setPais(text);
                  limpiarError('pais');
                }}
              />
              {errores.pais && <Text style={styles.errorTexto}>{t('paisRequerido')}</Text>}

              <Pressable
                style={styles.filaTerminos}
                onPress={() => {
                  setTerminos(v => !v);
                  limpiarError('terminos');
                }}
              >
                <View style={[styles.checkbox, terminos && styles.checkboxActivo, errores.terminos && styles.checkboxError]}>
                  {terminos && <View style={styles.checkMarca} />}
                </View>
                <Text style={styles.textoTerminos}>{t('terminosAceptar')}</Text>
              </Pressable>
              {errores.terminos && <Text style={styles.errorTexto}>{t('terminosRequerido')}</Text>}

              <Text style={styles.etiqueta}>{t('preguntaSeguridad')}</Text>
              <View style={styles.filaPreguntas}>
                {PREGUNTAS_SEGURIDAD.map(p => (
                  <Pressable
                    key={p.codigo}
                    style={[styles.chipPregunta, preguntaSeguridad === p.codigo && styles.chipPreguntaActivo]}
                    onPress={() => setPreguntaSeguridad(p.codigo)}
                  >
                    <Text style={[styles.textoChip, preguntaSeguridad === p.codigo && styles.textoChipActivo]}>
                      {t(p.clave)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={[styles.input, errores.respuestaSeguridad && styles.inputError]}
                value={respuestaSeguridad}
                placeholder={t('respuestaSeguridad')}
                placeholderTextColor="#9ca3af"
                maxLength={60}
                onChangeText={text => {
                  setRespuestaSeguridad(text);
                  limpiarError('respuestaSeguridad');
                }}
              />
              {errores.respuestaSeguridad && <Text style={styles.errorTexto}>{t('respuestaSeguridadRequerida')}</Text>}

              <Pressable
                style={styles.filaTerminos}
                onPress={() => setDosFactores(v => !v)}
              >
                <View style={[styles.checkbox, dosFactores && styles.checkboxActivo]}>
                  {dosFactores && <View style={styles.checkMarca} />}
                </View>
                <Text style={styles.textoTerminos}>{t('dosFactoresDesc')}</Text>
              </Pressable>

              <Text style={styles.etiqueta}>{t('eligeColor')}</Text>
              <View style={styles.filaColores}>
                {COLORES_AVATAR.map(c => (
                  <Pressable
                    key={c}
                    style={[styles.circuloColor, { backgroundColor: c }, c === color && styles.circuloSeleccionado]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <Text style={styles.etiqueta}>{t('idioma')}</Text>
              <View style={styles.filaIdiomas}>
                {IDIOMAS.map(id => (
                  <Pressable
                    key={id.codigo}
                    style={[styles.chipIdioma, idioma === id.codigo && styles.chipIdiomaActivo]}
                    onPress={() => actualizarAjustes({ idioma: id.codigo })}
                  >
                    <Text style={[styles.textoChip, idioma === id.codigo && styles.textoChipActivo]}>
                      {t(id.etiquetaClave)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <LinearGradient
            colors={['rgba(2,36,22,0)', 'rgba(2,36,22,0.9)', '#022416']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.pie}
          >
            <Pressable style={styles.botonContinuar} onPress={continuar}>
              <LinearGradient
                colors={['#00B96B', '#007A44']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradienteBoton}
              >
                <Text style={styles.textoContinuar}>{t('continuar').toUpperCase()}</Text>
                <IconoPlay color="#ffffff" size={24} />
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.cabecera}>
            <Text style={styles.tituloCabecera}>{t('verificacionSms')}</Text>
            <Text style={styles.subtituloCabecera}>{telefono}</Text>
          </View>

          <View style={styles.tarjeta}>
            <Text style={styles.descripcion}>{t('recuperarDesc')}</Text>

            <Pressable
              style={[styles.botonEnviar, enviando && styles.deshabilitado]}
              onPress={enviarCodigo}
              disabled={enviando}
            >
              <Text style={styles.textoEnviar}>
                {enviando ? '…' : codigoEnviado ? t('reenviarCodigo') : t('enviarCodigo')}
              </Text>
            </Pressable>
            {codigoEnviado && !codigoDemo && (
              <Text style={styles.exitoTexto}>{t('codigoEnviado')}</Text>
            )}
            {codigoDemo ? (
              <Text style={styles.codigoDemo}>
                {t('codigoEnviado')}: {codigoDemo}
              </Text>
            ) : null}

            <Text style={styles.etiqueta}>{t('codigoSms')}</Text>
            <PinPad
              pin={codigoOtp}
              onChange={nuevo => {
                setCodigoOtp(nuevo);
                setErrorServidor('');
              }}
              error={errorServidor === 'otpInvalido' || errorServidor === 'otpExpirado'}
              largo={LARGO_OTP}
            />

            {errorServidor !== '' && <Text style={styles.errorServidor}>{t(errorServidor as keyof import('../i18n/traducciones').Traducciones)}</Text>}
          </View>

          <LinearGradient
            colors={['rgba(2,36,22,0)', 'rgba(2,36,22,0.9)', '#022416']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.pie}
          >
            <Pressable style={[styles.botonContinuar, creando && styles.deshabilitado]} onPress={crearCuenta} disabled={creando}>
              <LinearGradient
                colors={['#00B96B', '#007A44']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradienteBoton}
              >
                <Text style={styles.textoContinuar}>
                  {creando ? '…' : t('verificarYCrear').toUpperCase()}
                </Text>
                <IconoPlay color="#ffffff" size={24} />
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  botonIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  reservaIcono: {
    width: 40,
    height: 40,
  },
  tituloBarra: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 2,
  },
  contenido: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 40,
  },
  cabecera: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tituloCabecera: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtituloCabecera: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  tarjeta: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.15)',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(111,251,190,0.4)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  etiqueta: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  inputFecha: {
    flex: 1,
  },
  filaFecha: {
    flexDirection: 'row',
    gap: 8,
  },
  errorTexto: {
    color: '#ff6b6b',
    fontSize: 13,
    marginTop: -6,
    marginBottom: 8,
  },
  ayudaTexto: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
  },
  filaTerminos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  checkboxActivo: {
    borderColor: COLOR_MENTA,
    backgroundColor: 'rgba(111,251,190,0.2)',
  },
  checkboxError: {
    borderColor: '#ff6b6b',
  },
  checkMarca: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: COLOR_MENTA,
  },
  textoTerminos: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 19,
  },
  filaColores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filaPreguntas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chipPregunta: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipPreguntaActivo: {
    backgroundColor: 'rgba(111,251,190,0.15)',
    borderColor: COLOR_MENTA,
  },
  circuloColor: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  circuloSeleccionado: {
    borderColor: COLOR_MENTA,
    shadowColor: COLOR_MENTA,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  filaIdiomas: {
    flexDirection: 'row',
    gap: 8,
  },
  chipIdioma: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipIdiomaActivo: {
    backgroundColor: 'rgba(111,251,190,0.15)',
    borderColor: COLOR_MENTA,
  },
  textoChip: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  textoChipActivo: {
    color: COLOR_MENTA,
  },
  descripcion: {
    color: '#b0f0d6',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  botonEnviar: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(111,251,190,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.4)',
    marginBottom: 8,
  },
  textoEnviar: {
    color: COLOR_MENTA,
    fontSize: 15,
    fontWeight: '700',
  },
  exitoTexto: {
    color: '#6ffbbe',
    fontSize: 13,
    marginBottom: 8,
  },
  codigoDemo: {
    color: '#ffb95f',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorServidor: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 60,
  },
  botonContinuar: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  gradienteBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.5)',
    borderRadius: 28,
    shadowColor: '#00B96B',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  textoContinuar: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 2,
  },
});