import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconoDado } from '../components/icons/IconoDado';
import { IconoEngranaje } from '../components/icons/IconoEngranaje';
import { IconoGrupo } from '../components/icons/IconoGrupo';
import { IconoPersona } from '../components/icons/IconoPersona';
import { IconoPlay } from '../components/icons/IconoPlay';
import { IconoPozo } from '../components/icons/IconoPozo';
import { IconoRobot } from '../components/icons/IconoRobot';
import { MAX_JUGADORES, MIN_JUGADORES } from '../constants/gameConfig';
import { FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';
import { useGameStore, ConfigJugador } from '../store/gameStore';

const NOMBRES_DEFECTO = ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4'];
const APUESTAS = [0, 10, 25, 50, 100];

const COLOR_MENTA = '#6FFBBE';
const COLOR_DORADO = '#FACC15';
const COLOR_AMBAR = '#ffb95f';

export function SetupScreen() {
  const t = useT();
  const iniciar = useGameStore(s => s.iniciar);
  const abrirAjustes = useAppStore(s => s.abrirAjustes);
  const perfil = useAppStore(s => s.perfil);
  const saldo = useAppStore(s => s.saldo);
  const salaConfig = useAppStore(s => s.salaConfig);
  const [jugadores, setJugadores] = useState<ConfigJugador[]>(
    NOMBRES_DEFECTO.slice(0, MIN_JUGADORES).map((nombre, i) => ({
      nombre: i === 0 && perfil ? perfil.nombre : nombre,
      esBot: false,
    }))
  );
  const [robarPozo, setRobarPozo] = useState(true);
  const [apuesta, setApuesta] = useState(salaConfig?.apuesta ?? 0);

  const cantidad = jugadores.length;
  const pozoTotal = apuesta * cantidad;
  const sinSaldo = apuesta > saldo;
  const todoListo = jugadores.every(j => j.nombre.trim().length > 0) && !sinSaldo;

  const cambiarCantidad = (delta: number) => {
    const nueva = cantidad + delta;
    if (nueva < MIN_JUGADORES || nueva > MAX_JUGADORES) return;
    const nuevos = NOMBRES_DEFECTO.slice(0, nueva).map((nombre, i) =>
      jugadores[i] ?? { nombre, esBot: false }
    );
    setJugadores(nuevos);
  };

  const actualizarNombre = (i: number, nombre: string) => {
    setJugadores(prev => prev.map((j, idx) => (idx === i ? { ...j, nombre } : j)));
  };

  const actualizarBot = (i: number, esBot: boolean) => {
    setJugadores(prev => prev.map((j, idx) => (idx === i ? { ...j, esBot } : j)));
  };

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
        <Text style={styles.tituloBarra}>{t('appName')}</Text>
        <Pressable style={styles.botonIcono} onPress={abrirAjustes}>
          <IconoEngranaje color={COLOR_MENTA} size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <View style={styles.cabecera}>
          <Text style={styles.tituloCabecera}>{t('appName')}</Text>
          <Text style={styles.subtituloCabecera}>{t('subtitulo')}</Text>
        </View>

        {salaConfig && salaConfig.codigo ? (
          <View style={styles.bannerSala}>
            <Text style={styles.textoBannerSala}>
              {t('salaPrivada')}: {salaConfig.nombre} · {t('codigoSala')}: {salaConfig.codigo}
            </Text>
          </View>
        ) : null}

        <View style={styles.seccion}>
          <View style={styles.filaTitulo}>
            <IconoGrupo color={COLOR_MENTA} size={22} />
            <Text style={styles.tituloSeccion}>{t('cuantosJugadores')}</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              style={[styles.botonStepper, cantidad <= MIN_JUGADORES && styles.deshabilitado]}
              onPress={() => cambiarCantidad(-1)}
            >
              <Text style={styles.textoStepper}>-</Text>
            </Pressable>
            <Text style={styles.numeroStepper}>{cantidad}</Text>
            <Pressable
              style={[styles.botonStepper, cantidad >= MAX_JUGADORES && styles.deshabilitado]}
              onPress={() => cambiarCantidad(1)}
            >
              <Text style={styles.textoStepper}>+</Text>
            </Pressable>
          </View>
          <View style={styles.puntos}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.punto, i < cantidad && styles.puntoActivo]} />
            ))}
          </View>
        </View>

        <View style={styles.seccion}>
          {jugadores.map((jugador, i) => (
            <View key={i} style={styles.tarjeta}>
              <LinearGradient
                colors={i === 0 ? ['#006c49', '#003527'] : ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.35)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <IconoPersona color={i === 0 ? COLOR_MENTA : '#d1d5db'} size={22} />
              </LinearGradient>
              <View style={styles.infoJugador}>
                <View style={styles.filaNombre}>
                  <TextInput
                    style={styles.inputNombre}
                    value={jugador.nombre}
                    placeholder={t('jugadorLabel', { n: i + 1 })}
                    placeholderTextColor="#9ca3af"
                    onChangeText={text => actualizarNombre(i, text)}
                  />
                  {jugador.esBot && <Text style={styles.badgeBot}>{t('botBadge')}</Text>}
                </View>
                <Text style={styles.estadoJugador}>{jugador.esBot ? t('bot') : t('humano')}</Text>
              </View>
              <View style={styles.filaToggle}>
                <Switch
                  value={jugador.esBot}
                  onValueChange={val => actualizarBot(i, val)}
                  trackColor={{ false: 'rgba(0,0,0,0.4)', true: 'rgba(111,251,190,0.55)' }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="rgba(0,0,0,0.4)"
                />
                <IconoRobot color={jugador.esBot ? COLOR_MENTA : '#9ca3af'} size={22} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.seccion}>
          <View style={styles.filaTitulo}>
            <IconoEngranaje color={COLOR_DORADO} size={22} />
            <Text style={styles.tituloSeccion}>{t('opcionesPartida')}</Text>
          </View>
          <View style={styles.tarjeta}>
            <View style={styles.iconoOpcion}>
              <IconoPozo size={30} />
            </View>
            <View style={styles.infoOpcion}>
              <Text style={styles.tituloOpcion}>{t('robarDelPozo')}</Text>
              <Text style={styles.descripcionOpcion}>
                {robarPozo ? t('robarDescOn') : t('robarDescOff')}
              </Text>
            </View>
            <View style={styles.filaToggle}>
              <Switch
                value={robarPozo}
                onValueChange={setRobarPozo}
                trackColor={{ false: 'rgba(0,0,0,0.4)', true: 'rgba(111,251,190,0.55)' }}
                thumbColor="#ffffff"
                ios_backgroundColor="rgba(0,0,0,0.4)"
              />
            </View>
          </View>
        </View>

        <View style={styles.seccion}>
          <View style={styles.filaTitulo}>
            <IconoDado color={COLOR_AMBAR} size={22} />
            <Text style={styles.tituloSeccion}>{t('apuestaPartida')}</Text>
          </View>
          <View style={styles.filaApuestas}>
            {APUESTAS.map(valor => (
              <Pressable
                key={valor}
                style={[styles.chipApuesta, apuesta === valor && styles.chipApuestaActiva]}
                onPress={() => setApuesta(valor)}
              >
                <Text
                  style={[styles.textoChipApuesta, apuesta === valor && styles.textoChipApuestaActiva]}
                >
                  {valor === 0 ? t('sinApuesta') : valor}
                </Text>
              </Pressable>
            ))}
          </View>
          {apuesta > 0 && (
            <View style={styles.resumenApuesta}>
              <Text style={styles.textoResumen}>
                {apuesta} {t('creditos')} x {cantidad} {t('jugadores')} = {pozoTotal} {t('creditos')}
              </Text>
              <Text style={[styles.textoSaldo, sinSaldo && styles.textoSinSaldo]}>
                {t('saldo')}: {saldo} {t('creditos')}
              </Text>
              {sinSaldo && <Text style={styles.sinSaldo}>{t('sinSaldo')}</Text>}
            </View>
          )}
        </View>
      </ScrollView>

      <LinearGradient
        colors={['rgba(2,36,22,0)', 'rgba(2,36,22,0.9)', '#022416']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.pie}
      >
        <Pressable
          style={[styles.botonIniciar, !todoListo && styles.deshabilitado]}
          onPress={() => todoListo && iniciar(jugadores, { robarPozo, apuesta })}
        >
          <LinearGradient
            colors={['#00B96B', '#007A44']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradienteBoton}
          >
            <Text style={styles.textoIniciar}>{t('iniciarPartida')}</Text>
            <IconoPlay color="#ffffff" size={24} />
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fondo: {
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
    paddingTop: 100,
    paddingBottom: 100,
  },
  cabecera: {
    alignItems: 'center',
    marginBottom: 8,
  },
  tituloCabecera: {
    color: '#ffffff',
    fontSize: 36,
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
  seccion: {
    marginTop: 24,
  },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tituloSeccion: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  botonStepper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoStepper: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
  },
  numeroStepper: {
    color: COLOR_DORADO,
    fontSize: 36,
    fontWeight: '800',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    minWidth: 64,
    textAlign: 'center',
    textShadowColor: 'rgba(250,204,21,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  puntos: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  puntoActivo: {
    backgroundColor: COLOR_MENTA,
    shadowColor: COLOR_MENTA,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.15)',
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.3)',
  },
  infoJugador: {
    flex: 1,
  },
  filaNombre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputNombre: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
    paddingVertical: 2,
    flexShrink: 1,
  },
  badgeBot: {
    backgroundColor: '#003527',
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.5)',
    color: COLOR_MENTA,
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  estadoJugador: {
    color: '#9ca3af',
    fontSize: 15,
    marginTop: 2,
  },
  filaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconoOpcion: {
    marginTop: 2,
  },
  infoOpcion: {
    flex: 1,
  },
  tituloOpcion: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  descripcionOpcion: {
    color: '#9ca3af',
    fontSize: 15,
    marginTop: 4,
    paddingRight: 4,
  },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100,
  },
  botonIniciar: {
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
  textoIniciar: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  deshabilitado: {
    opacity: 0.4,
  },
  bannerSala: {
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.4)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  textoBannerSala: {
    color: COLOR_DORADO,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filaApuestas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  chipApuesta: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipApuestaActiva: {
    borderColor: COLOR_AMBAR,
    backgroundColor: 'rgba(255,185,95,0.15)',
  },
  textoChipApuesta: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '600',
  },
  textoChipApuestaActiva: {
    color: COLOR_AMBAR,
  },
  resumenApuesta: {
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  textoResumen: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  textoSaldo: {
    color: '#9ca3af',
    fontSize: 14,
  },
  textoSinSaldo: {
    color: '#ff6b6b',
  },
  sinSaldo: {
    color: '#ff6b6b',
    fontSize: 13,
  },
});