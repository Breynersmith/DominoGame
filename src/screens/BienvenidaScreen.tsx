import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconoLogin } from '../components/icons/IconoLogin';
import { IconoPersona } from '../components/icons/IconoPersona';
import { FONT_INTER_MEDIUM, FONT_INTER_REGULAR, FONT_INTER_SEMIBOLD, FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

const COLOR_DORADO = '#FACC15';
const COLOR_MENTA = '#6FFBBE';
const COLOR_PRIMARIO = '#003527';
const COLOR_MENTA_CLARO = '#b0f0d6';

// Patrón de puntos del dominó de la portada (ficha 6|2)
const PIPS_SEIS: boolean[] = [true, true, true, true, true, true];
const PIPS_DOS: boolean[] = [true, false, false, false, false, true];

export function BienvenidaScreen() {
  const t = useT();
  const irARegistro = useAppStore(s => s.irARegistro);
  const jugarComoInvitado = useAppStore(s => s.jugarComoInvitado);
  const irA = useAppStore(s => s.irA);

  return (
    <LinearGradient
      colors={['#0A4A33', '#022416']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.fondo}
    >
      <View style={styles.orbSupIzq} />
      <View style={styles.orbInfDer} />

      <View style={styles.centro}>
        <View style={styles.bloqueLogo}>
          <View style={styles.tarjetaLogo}>
            <View style={styles.mitad}>
              <View style={styles.rejillaSeis}>
                <View style={styles.filaSeis}>
                  {PIPS_SEIS.slice(0, 3).map((relleno, i) => (
                    <View
                      key={i}
                      style={[styles.punto, relleno ? styles.puntoRelleno : styles.puntoVacio]}
                    />
                  ))}
                </View>
                <View style={styles.filaSeis}>
                  {PIPS_SEIS.slice(3, 6).map((relleno, i) => (
                    <View
                      key={i}
                      style={[styles.punto, relleno ? styles.puntoRelleno : styles.puntoVacio]}
                    />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.divisorLogo} />
            <View style={styles.mitad}>
              <View style={styles.rejilla}>
                {PIPS_DOS.map((relleno, i) => (
                  <View
                    key={i}
                    style={[styles.punto, relleno ? styles.puntoRelleno : styles.puntoVacio]}
                  />
                ))}
              </View>
            </View>
          </View>
          <Text style={styles.tituloLogo}>
            DOMINO{'\n'}
            <Text style={styles.tituloLogoDorado}>CLUB</Text>
          </Text>
        </View>

        <View style={styles.textoBienvenida}>
          <Text style={styles.tituloBienvenida}>{t('bienvenido')}</Text>
          <Text style={styles.subtituloBienvenida}>{t('experienciaPremium')}</Text>
        </View>

        <View style={styles.botones}>
          <Pressable
            onPress={() => irA('login')}
            style={({ pressed }) => [styles.botonPrimario, pressed && styles.botonPresionado]}
          >
            <LinearGradient
              colors={['#6cf8bb', '#4edea3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientePrimario}
            >
              <IconoLogin color="#002113" size={22} />
              <Text style={styles.textoPrimario}>{t('iniciarSesion')}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={jugarComoInvitado}
            style={({ pressed }) => [styles.botonSecundario, pressed && styles.botonPresionado]}
          >
            <IconoPersona color="#ffffff" size={20} />
            <Text style={styles.textoSecundario}>{t('jugarInvitado')}</Text>
          </Pressable>

          <View style={styles.filaRegistro}>
            <Text style={styles.textoRegistro}>{t('noTienesCuenta')}</Text>
            <Pressable onPress={irARegistro}>
              <Text style={styles.enlaceRegistro}>{t('crearCuentaLink')}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable style={styles.pie} onPress={() => irA('terminos')}>
        <Text style={styles.textoPie}>{t('terminosPrivacidad')}</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    overflow: 'hidden',
  },
  orbSupIzq: {
    position: 'absolute',
    top: -90,
    left: -90,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(108,248,187,0.12)',
  },
  orbInfDer: {
    position: 'absolute',
    bottom: -90,
    right: -90,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(149,211,186,0.12)',
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 100,
    zIndex: 1,
  },
  bloqueLogo: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
  },
  tarjetaLogo: {
    width: 196,
    height: 112,
    borderRadius: 26,
    backgroundColor: '#efeeea',
    borderWidth: 4,
    borderColor: '#efeeea',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    transform: [{ rotate: '-5deg' }],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mitad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  rejilla: {
    width: 52,
    height: 84,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejillaSeis: {
    width: 84,
    height: 84,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filaSeis: {
    flexDirection: 'row',
    gap: 12,
  },
  punto: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  puntoRelleno: {
    backgroundColor: COLOR_PRIMARIO,
  },
  puntoVacio: {
    backgroundColor: 'transparent',
  },
  divisorLogo: {
    position: 'absolute',
    left: '50%',
    marginLeft: -2,
    top: 10,
    bottom: 10,
    width: 4,
    backgroundColor: '#e4e2de',
    zIndex: 10,
  },
  tituloLogo: {
    color: '#ffffff',
    fontSize: 42,
    lineHeight: 50,
    textAlign: 'center',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  tituloLogoDorado: {
    color: COLOR_DORADO,
  },
  textoBienvenida: {
    alignItems: 'center',
    marginBottom: 40,
  },
  tituloBienvenida: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: FONT_INTER_SEMIBOLD,
    textAlign: 'center',
  },
  subtituloBienvenida: {
    color: COLOR_MENTA_CLARO,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FONT_INTER_REGULAR,
    opacity: 0.9,
    maxWidth: 280,
    textAlign: 'center',
    marginTop: 4,
  },
  botones: {
    width: '100%',
    gap: 16,
  },
  filaRegistro: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  textoRegistro: {
    color: '#d1d5db',
    fontSize: 14,
  },
  enlaceRegistro: {
    color: COLOR_MENTA,
    fontSize: 14,
    fontWeight: '700',
  },
  botonPrimario: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gradientePrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  textoPrimario: {
    color: '#002113',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT_INTER_SEMIBOLD,
  },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  textoSecundario: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONT_INTER_MEDIUM,
  },
  botonPresionado: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  pie: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 100,
    paddingTop: 40,
    zIndex: 1,
    opacity: 0.7,
  },
  textoPie: {
    color: COLOR_MENTA_CLARO,
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 40,
    fontFamily: FONT_INTER_MEDIUM,
  },
});
