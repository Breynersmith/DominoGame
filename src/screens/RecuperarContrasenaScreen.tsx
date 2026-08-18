import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BotonPrincipal, CampoTexto, PantallaBase } from '../components/ui';
import { PREGUNTAS_SEGURIDAD } from '../constants/preguntasSeguridad';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';
import { apiEnviarSms, ErrorApi } from '../services/api';

type Metodo = 'sms' | 'pregunta';

export function RecuperarContrasenaScreen() {
  const t = useT();
  const recuperarContrasena = useAppStore(s => s.recuperarContrasena);
  const recuperarPorPregunta = useAppStore(s => s.recuperarPorPregunta);
  const volverAtras = useAppStore(s => s.volverAtras);
  const irA = useAppStore(s => s.irA);

  const [metodo, setMetodo] = useState<Metodo>('sms');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [pregunta, setPregunta] = useState('nombre_mascota');
  const [respuesta, setRespuesta] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [repite, setRepite] = useState('');
  const [error, setError] = useState(false);
  const [exito, setExito] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [codigoDemo, setCodigoDemo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviarCodigo = async () => {
    setError(false);
    setEnviando(true);
    try {
      const r = await apiEnviarSms(telefono.trim());
      setEnviado(true);
      setCodigoDemo(r.demo ? (r.codigo ?? '') : '');
    } catch {
      setError(true);
    } finally {
      setEnviando(false);
    }
  };

  const recuperar = async () => {
    setError(false);
    if (nuevo.length < 8 || nuevo !== repite) {
      setError(true);
      return;
    }
    let ok = false;
    if (metodo === 'sms') {
      ok = await recuperarContrasena(telefono.trim(), codigo, nuevo);
    } else {
      ok = await recuperarPorPregunta(identificador.trim(), pregunta, respuesta.trim(), nuevo);
    }
    if (!ok) {
      setError(true);
      return;
    }
    setExito(true);
  };

  return (
    <PantallaBase titulo={t('recuperarContrasena')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.descripcion}>{t('recuperarDesc')}</Text>

        <View style={styles.filaMetodo}>
          <Pressable style={[styles.chip, metodo === 'sms' && styles.chipActivo]} onPress={() => setMetodo('sms')}>
            <Text style={[styles.textoChip, metodo === 'sms' && styles.textoChipActivo]}>{t('codigoSms')}</Text>
          </Pressable>
          <Pressable style={[styles.chip, metodo === 'pregunta' && styles.chipActivo]} onPress={() => setMetodo('pregunta')}>
            <Text style={[styles.textoChip, metodo === 'pregunta' && styles.textoChipActivo]}>{t('preguntaSeguridad')}</Text>
          </Pressable>
        </View>

        {metodo === 'sms' ? (
          <>
            <CampoTexto
              etiqueta={t('telefono')}
              value={telefono}
              placeholder="+34600000000"
              keyboardType="phone-pad"
              maxLength={16}
              onChangeText={text => {
                setTelefono(text);
                setExito(false);
                setEnviado(false);
              }}
            />
            <Pressable style={[styles.botonEnviar, enviando && styles.deshabilitado]} onPress={enviarCodigo} disabled={enviando}>
              <Text style={styles.textoEnviar}>
                {enviando ? '…' : enviado ? t('reenviarCodigo') : t('enviarCodigo')}
              </Text>
            </Pressable>
            {codigoDemo ? (
              <Text style={styles.codigoDemo}>
                {t('codigoEnviado')}: {codigoDemo}
              </Text>
            ) : null}

            <CampoTexto
              etiqueta={t('codigoSms')}
              value={codigo}
              placeholder="••••••"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={text => {
                setCodigo(text);
                setExito(false);
              }}
            />
          </>
        ) : (
          <>
            <CampoTexto
              etiqueta={t('emailONombre')}
              value={identificador}
              placeholder={t('emailONombre')}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={text => {
                setIdentificador(text);
                setExito(false);
              }}
            />
            <Text style={styles.etiquetaPregunta}>{t('preguntaSeguridad')}</Text>
            <View style={styles.filaPreguntas}>
              {PREGUNTAS_SEGURIDAD.map(p => (
                <Pressable
                  key={p.codigo}
                  style={[styles.chipPregunta, pregunta === p.codigo && styles.chipActivo]}
                  onPress={() => setPregunta(p.codigo)}
                >
                  <Text style={[styles.textoChip, pregunta === p.codigo && styles.textoChipActivo]}>
                    {t(p.clave)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <CampoTexto
              etiqueta={t('respuestaSeguridad')}
              value={respuesta}
              placeholder={t('respuestaSeguridad')}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={text => {
                setRespuesta(text);
                setExito(false);
              }}
            />
          </>
        )}

        <CampoTexto
          etiqueta={t('nuevaContrasena')}
          value={nuevo}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={text => {
            setNuevo(text);
            setExito(false);
          }}
        />
        <CampoTexto
          etiqueta={t('confirmarContrasena')}
          value={repite}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={text => {
            setRepite(text);
            setExito(false);
          }}
        />

        {exito && <Text style={styles.exito}>{t('contrasenaActualizada')}</Text>}
        {!exito && (
          <Text style={styles.error}>
            {error ? (nuevo.length > 0 && nuevo !== repite ? t('contrasenasNoCoinciden') : t('usuarioNoEncontrado')) : ' '}
          </Text>
        )}

        <View style={styles.boton}>
          <BotonPrincipal label={exito ? t('iniciarSesion') : t('enviar')} onPress={exito ? () => irA('login') : recuperar} />
        </View>
        {exito && (
          <View style={styles.botonSecundario}>
            <BotonPrincipal label={t('iniciarSesion')} onPress={() => irA('login')} />
          </View>
        )}
      </ScrollView>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  descripcion: {
    color: '#b0f0d6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  filaMetodo: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActivo: {
    backgroundColor: 'rgba(111,251,190,0.15)',
    borderColor: '#6ffbbe',
  },
  textoChip: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  textoChipActivo: {
    color: '#6ffbbe',
  },
  etiquetaPregunta: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
  botonEnviar: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(111,251,190,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.4)',
    marginBottom: 16,
  },
  textoEnviar: {
    color: '#6ffbbe',
    fontSize: 15,
    fontWeight: '700',
  },
  codigoDemo: {
    color: '#ffb95f',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    marginBottom: 8,
    minHeight: 20,
  },
  exito: {
    color: '#6ffbbe',
    fontSize: 14,
    marginBottom: 8,
  },
  boton: {
    marginTop: 8,
  },
  botonSecundario: {
    marginTop: 12,
  },
});