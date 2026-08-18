import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BotonPrincipal, CampoTexto, PantallaBase } from '../components/ui';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

export function LoginScreen() {
  const t = useT();
  const iniciarSesion = useAppStore(s => s.iniciarSesion);
  const completar2fa = useAppStore(s => s.completar2fa);
  const cancelar2fa = useAppStore(s => s.cancelar2fa);
  const login2fa = useAppStore(s => s.login2fa);
  const volverAtras = useAppStore(s => s.volverAtras);
  const irA = useAppStore(s => s.irA);
  const irARegistro = useAppStore(s => s.irARegistro);

  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [codigo2fa, setCodigo2fa] = useState('');
  const [error, setError] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    if (entrando) return;
    setError(false);
    setEntrando(true);
    const r = await iniciarSesion(identificador.trim(), password);
    setEntrando(false);
    if (r === 'error') setError(true);
  };

  const completar = async () => {
    setError(false);
    const ok = await completar2fa(codigo2fa.trim());
    if (!ok) {
      setError(true);
      setCodigo2fa('');
    }
  };

  return (
    <PantallaBase titulo={t('iniciarSesion')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        {!login2fa ? (
          <>
            <CampoTexto
              etiqueta={t('emailONombre')}
              value={identificador}
              placeholder={t('emailONombre')}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={text => {
                setIdentificador(text);
                if (error) setError(false);
              }}
            />
            <CampoTexto
              etiqueta={t('contrasena')}
              value={password}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={text => {
                setPassword(text);
                if (error) setError(false);
              }}
            />
            {error && <Text style={styles.error}>{t('credencialesIncorrectas')}</Text>}

            <Pressable style={styles.enlace} onPress={() => irA('recuperar')}>
              <Text style={styles.textoEnlace}>{t('olvidasteContrasena')}</Text>
            </Pressable>

            <View style={styles.boton}>
              <BotonPrincipal label={entrando ? '…' : t('iniciarSesion')} onPress={entrar} disabled={entrando} />
            </View>

            <View style={styles.filaRegistro}>
              <Text style={styles.textoRegistro}>{t('noTienesCuenta')}</Text>
              <Pressable onPress={irARegistro}>
                <Text style={styles.enlaceRegistro}>{t('crearCuentaLink')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.descripcion}>{t('verificacion2fa')}</Text>
            <Text style={styles.descripcion}>
              {t('codigo2faDesc').split('{telefono}').join(login2fa.telefonoEnmascarado)}
            </Text>
            {login2fa.demo && login2fa.codigo ? (
              <Text style={styles.codigoDemo}>
                {t('codigoEnviado')}: {login2fa.codigo}
              </Text>
            ) : null}

            <CampoTexto
              etiqueta={t('codigo2fa')}
              value={codigo2fa}
              placeholder="••••••"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={text => {
                setCodigo2fa(text);
                if (error) setError(false);
              }}
            />
            {error && <Text style={styles.error}>{t('codigo2faIncorrecto')}</Text>}

            <View style={styles.boton}>
              <BotonPrincipal label={entrando ? '…' : t('enviar')} onPress={completar} disabled={entrando} />
            </View>

            <Pressable style={styles.enlace} onPress={cancelar2fa}>
              <Text style={styles.textoEnlace}>{t('volver')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  enlace: {
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 20,
  },
  textoEnlace: {
    color: '#b0f0d6',
    fontSize: 14,
    fontWeight: '600',
  },
  boton: {
    marginTop: 4,
  },
  filaRegistro: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  textoRegistro: {
    color: '#d1d5db',
    fontSize: 14,
  },
  enlaceRegistro: {
    color: '#6ffbbe',
    fontSize: 14,
    fontWeight: '700',
  },
  descripcion: {
    color: '#b0f0d6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  codigoDemo: {
    color: '#ffb95f',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
});