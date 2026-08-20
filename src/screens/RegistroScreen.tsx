import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PinPad } from '../components/PinPad';
import { IconoDado } from '../components/icons/IconoDado';
import { IconoPersona } from '../components/icons/IconoPersona';
import { IconoPlay } from '../components/icons/IconoPlay';
import { FONT_INTER_SEMIBOLD, FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { IDIOMAS, Traducciones } from '../i18n/traducciones';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';
import { apiRegistroFacil, apiEnviarCodigoEmail, ErrorApi } from '../services/api';
import { useResponsive } from '../hooks/useResponsive';

const COLOR_MENTA = '#6FFBBE';
const COLOR_DORADO = '#FACC15';
const COLORES_AVATAR = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4'];
const LARGO_OTP = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ErrorCampo = 'nombre' | 'email' | 'password' | 'confirmar';

export function RegistroScreen() {
  const t = useT();
  const registrar = useAppStore(s => s.registrar);
  const actualizarAjustes = useAppStore(s => s.actualizarAjustes);
  const idioma = useAppStore(s => s.ajustes.idioma);
  const { paddingBarra, paddingContenido, paddingPie } = useResponsive();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [color, setColor] = useState(COLORES_AVATAR[0]);

  const [errores, setErrores] = useState<Partial<Record<ErrorCampo, boolean>>>({});

  const [modalOtp, setModalOtp] = useState(false);
  const [codigoOtp, setCodigoOtp] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoDemo, setCodigoDemo] = useState('');
  const [errorServidor, setErrorServidor] = useState('');

  const limpiarError = (campo: ErrorCampo) => setErrores(e => ({ ...e, [campo]: false }));

  const continuar = async () => {
    const nuevos: Partial<Record<ErrorCampo, boolean>> = {};
    if (nombre.trim().length < 2) nuevos.nombre = true;
    if (!EMAIL_REGEX.test(email.trim())) nuevos.email = true;
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) nuevos.password = true;
    if (confirmar !== password) nuevos.confirmar = true;
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;

    setErrorServidor('');
    setEnviando(true);
    try {
      const r = await apiEnviarCodigoEmail(email.trim().toLowerCase());
      setCodigoOtp('');
      setCodigoEnviado(true);
      setCodigoDemo(r.demo ? (r.codigo ?? '') : '');
      setModalOtp(true);
    } catch (err) {
      setErrorServidor(err instanceof ErrorApi && err.codigo === 'sin_conexion' ? 'sinConexion' : 'emailInvalido');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarModal = () => {
    setModalOtp(false);
    setErrorServidor('');
  };

  const crearCuenta = async () => {
    if (codigoOtp.length !== LARGO_OTP) {
      setErrorServidor('otpInvalido');
      return;
    }
    setErrorServidor('');
    setCreando(true);
    try {
      const emailFinal = email.trim().toLowerCase();
      const r = await apiRegistroFacil(nombre.trim(), emailFinal, password, color, codigoOtp);
      registrar({ nombre: nombre.trim(), email: emailFinal, color }, { yaRegistrado: r });
    } catch (err) {
      if (err instanceof ErrorApi) {
        const mapa: Record<string, string> = {
          otp_invalido: 'otpInvalido',
          otp_expirado: 'otpExpirado',
          email_en_uso: 'emailEnUso',
          nombre_en_uso: 'nombreEnUso',
          sin_conexion: 'sinConexion',
        };
        setErrorServidor(mapa[err.codigo] ?? `server:${err.codigo}`);
      } else {
        setErrorServidor('sinConexion');
      }
    } finally {
      setCreando(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0A4A33', '#022416']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.fondo}
    >
      <View style={[styles.barraSuperior, { paddingTop: paddingBarra }]}>
        <View style={styles.botonIcono}>
          <IconoDado color={COLOR_DORADO} size={22} />
        </View>
        <Text style={styles.tituloBarra}>Domino</Text>
        <View style={styles.reservaIcono} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.contenido, { paddingTop: paddingContenido }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

            {errorServidor !== '' && (
              <Text style={styles.errorServidor}>
                {errorServidor.startsWith('server:') ? errorServidor : t(errorServidor as keyof Traducciones)}
              </Text>
            )}

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
          style={[styles.pie, { paddingBottom: paddingPie }]}
        >
          <Pressable style={[styles.botonContinuar, enviando && styles.deshabilitado]} onPress={continuar} disabled={enviando}>
            <LinearGradient
              colors={['#00B96B', '#007A44']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradienteBoton}
            >
              <Text style={styles.textoContinuar}>{enviando ? '…' : t('continuar').toUpperCase()}</Text>
              <IconoPlay color="#ffffff" size={24} />
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </KeyboardAvoidingView>

      <Modal visible={modalOtp} transparent animationType="slide" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView
          style={styles.fondoModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.tarjetaModal}>
            <View style={styles.cabeceraModal}>
              <View style={styles.tituloFila}>
                <IconoDado color={COLOR_MENTA} size={18} />
                <Text style={styles.tituloModal}>{t('verificacionSms')}</Text>
              </View>
              <Pressable style={styles.botonCerrar} onPress={cerrarModal} disabled={creando} accessibilityLabel="cerrar">
                <Text style={styles.iconoCerrar}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.emailModal}>{email}</Text>
              <Text style={styles.descripcionModal}>{t('codigoEnviadoEmail')}</Text>

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

              {errorServidor !== '' && (
                <Text style={styles.errorServidor}>
                  {errorServidor.startsWith('server:') ? errorServidor : t(errorServidor as keyof Traducciones)}
                </Text>
              )}

              <Pressable
                style={[
                  styles.botonRegistrar,
                  (creando || codigoOtp.length !== LARGO_OTP) && styles.botonRegistrarDeshabilitado,
                ]}
                onPress={crearCuenta}
                disabled={creando || codigoOtp.length !== LARGO_OTP}
              >
                <LinearGradient
                  colors={['#00B96B', '#007A44']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradienteBoton}
                >
                  <Text style={styles.textoContinuar}>{creando ? '…' : t('registrar').toUpperCase()}</Text>
                  <IconoPlay color="#ffffff" size={24} />
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  errorServidor: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  filaColores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  botonRegistrar: {
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 20,
  },
  botonRegistrarDeshabilitado: {
    opacity: 0.5,
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
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  tarjetaModal: {
    backgroundColor: '#0A4A33',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.3)',
    maxHeight: '85%',
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  cabeceraModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tituloModal: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FONT_MONTSERRAT_EXTRA,
  },
  botonCerrar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  iconoCerrar: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  emailModal: {
    color: COLOR_MENTA,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONT_INTER_SEMIBOLD,
    textAlign: 'center',
    marginBottom: 6,
  },
  descripcionModal: {
    color: '#b0f0d6',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  codigoDemo: {
    color: '#ffb95f',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
});