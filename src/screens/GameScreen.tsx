import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Asiento } from '../components/Asiento';
import { Avatar } from '../components/Avatar';
import { Board } from '../components/Board';
import { ChatSala } from '../components/ChatSala';
import { DragTile } from '../components/DragTile';
import { Tile } from '../components/Tile';
import { IconoChat } from '../components/icons/IconoChat';
import { IconoDado } from '../components/icons/IconoDado';
import { IconoEngranaje } from '../components/icons/IconoEngranaje';
import { IconoFlecha } from '../components/icons/IconoFlecha';
import { IconoJugador } from '../components/icons/IconoJugador';
import { IconoPasar } from '../components/icons/IconoPasar';
import { IconoPozo } from '../components/icons/IconoPozo';
import { IconoReiniciar } from '../components/icons/IconoReiniciar';
import { IconoSalir } from '../components/icons/IconoSalir';
import { dimensionesFicha, LayoutResultado, paddingFicha } from '../components/layoutTablero';
import { obtenerExtremosJugables, obtenerFichasJugables, calcularPuntaje } from '../game/engine';
import { fichasPorJugadorPermitidas } from '../constants/gameConfig';
import { Ficha, Jugador } from '../game/types';
import { FONT_INTER_MEDIUM, FONT_INTER_SEMIBOLD, FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { useT } from '../i18n/useT';
import { Traducciones } from '../i18n/traducciones';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';
import { apiAgregarAmigo, apiEliminarAmigo, ErrorApi } from '../services/api';

const COLORES_JUGADORES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626'];
const COLOR_MENTA = '#6FFBBE';
const COLOR_AMBAR = '#ffb95f';
const COLOR_MESA = '#064E3B';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function GameScreen({ modo = 'local' }: { modo?: 'local' | 'online' }) {
  const t = useT();
  const ayuda = useAppStore(s => s.ajustes.ayuda);
  const animarTurno = useAppStore(s => s.ajustes.animarTurno);
  const abrirAjustes = useAppStore(s => s.abrirAjustes);
  const volverAtras = useAppStore(s => s.volverAtras);
  const notificar = useAppStore(s => s.notificar);
  const amigos = useAppStore(s => s.amigos);
  const online = modo === 'online';

  const faseLocal = useGameStore(s => s.fase);
  const estadoLocal = useGameStore(s => s.estado);
  const mensajeLocal = useGameStore(s => s.mensaje);
  const config = useGameStore(s => s.config);
  const opciones = useGameStore(s => s.opciones);
  const jugarLocal = useGameStore(s => s.jugar);
  const robarLocal = useGameStore(s => s.robar);
  const pasarLocal = useGameStore(s => s.pasar);
  const resolverTurnoBot = useGameStore(s => s.resolverTurnoBot);
  const iniciar = useGameStore(s => s.iniciar);
  const reiniciar = useGameStore(s => s.reiniciar);
  const pagoLocal = useGameStore(s => s.pago);

  const onlineStore = useOnlineStore();

  const abandono = onlineStore.abandono;
  const esperando = onlineStore.esperando;

  const fase = online ? onlineStore.fase : faseLocal;
  const estado = online ? onlineStore.estado : estadoLocal;
  const mensaje = online ? onlineStore.mensaje : mensajeLocal;
  const pago = online ? onlineStore.pago : pagoLocal;
  const jugar = online ? onlineStore.jugar : jugarLocal;
  const robar = online ? onlineStore.robar : robarLocal;
  const pasar = online ? onlineStore.pasar : pasarLocal;
  const robarPozoActivo = online ? onlineStore.robarPozo : opciones.robarPozo;

  const [fichaSeleccionada, setFichaSeleccionada] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<Ficha | null>(null);
  const [layout, setLayout] = useState<LayoutResultado | null>(null);
  const [menuJugador, setMenuJugador] = useState<Jugador | null>(null);
  const [verPerfil, setVerPerfil] = useState<Jugador | null>(null);
  const [chatAbierto, setChatAbierto] = useState(false);

  const posicionArrastre = useRef(new Animated.ValueXY()).current;
  const rectoTablero = useRef<Rect | null>(null);
  const zonaTableroRef = useRef<View>(null);

  const onLayoutListo = useCallback((l: LayoutResultado) => setLayout(l), []);

  useEffect(() => {
    if (online) return;
    if (fase !== 'jugando' || !estado) return;
    const jugador = estado.jugadores[estado.turnoActual];
    if (!jugador?.esBot) return;
    const timer = setTimeout(() => resolverTurnoBot(), animarTurno ? 800 : 120);
    return () => clearTimeout(timer);
  }, [estado, fase, resolverTurnoBot, animarTurno, online]);

  useEffect(() => {
    setFichaSeleccionada(null);
    setArrastrando(null);
  }, [estado]);

  if (online) {
    // Mientras no haya partida (conectando, uniéndose o error de sala) se
    // muestra la pantalla de espera en lugar de una pantalla en blanco.
    if (onlineStore.fase === 'espera' || !estado) {
      return <SalaEspera />;
    }
  }

  if (!estado) return null;

  const jugadorActual = estado.jugadores[estado.turnoActual];
  const esTurnoHumano = online ? onlineStore.miEsTurno : !!jugadorActual && !jugadorActual.esBot;

  const indiceHumano = estado.jugadores.findIndex(j => !j.esBot);
  const jugadorInferior = esTurnoHumano
    ? jugadorActual
    : indiceHumano >= 0
      ? estado.jugadores[indiceHumano]
      : estado.jugadores[0];
  const otrosJugadores = estado.jugadores.filter(j => j.id !== jugadorInferior.id);
  const slotsLateral: ('superior' | 'izquierdo' | 'derecho')[] = ['superior', 'izquierdo', 'derecho'];
  const asientos = { superior: null as Jugador | null, izquierdo: null as Jugador | null, derecho: null as Jugador | null };
  otrosJugadores.forEach((j, k) => {
    if (k < slotsLateral.length) asientos[slotsLateral[k]] = j;
  });

  const colorDe = (j: Jugador) =>
    j.color ?? COLORES_JUGADORES[estado.jugadores.findIndex(p => p.id === j.id) % COLORES_JUGADORES.length];
  const asientoActivo = (j: Jugador) => j.id === jugadorActual.id && fase === 'jugando';

  const esTurnoInferior = jugadorActual.id === jugadorInferior.id;
  const habilitarArrastre = fase === 'jugando' && esTurnoHumano && esTurnoInferior;
  const jugablesInferiores = obtenerFichasJugables(jugadorInferior.id, estado);
  const idsJugables = new Set(jugablesInferiores.map(f => f.id));
  const fichaEnSelector = fichaSeleccionada
    ? jugadorInferior.mano.find(f => f.id === fichaSeleccionada)
    : null;
  const extremosArrastre = arrastrando ? obtenerExtremosJugables(arrastrando, estado) : [];
  const noPuedeJugar = habilitarArrastre && jugablesInferiores.length === 0;
  const ganador = estado.ganador
    ? estado.jugadores.find(j => j.id === estado.ganador)
    : null;

  const abandonar = () => {
    if (online) {
      onlineStore.salirSala();
      onlineStore.desconectar();
    } else {
      reiniciar();
    }
    volverAtras();
  };

  const abrirMenuJugador = (j: Jugador) => setMenuJugador(j);

  const cerrarMenu = () => setMenuJugador(null);

  const agregarAmigo = async (j: Jugador) => {
    if (j.esBot) {
      notificar(t('amigos'), t('soloJugadores'));
      return;
    }
    if (!online) {
      notificar(t('amigos'), t('sinConexion'));
      return;
    }
    try {
      const r = await apiAgregarAmigo(j.nombre);
      useAppStore.setState({ amigos: r.amigos.map(a => a.nombre) });
      notificar(t('amigos'), t('amigoAgregado'));
    } catch (err) {
      const codigo = err instanceof ErrorApi ? err.codigo : '';
      notificar(
        t('amigos'),
        codigo === 'no_puedes_agregarte'
          ? t('noTePuedesAgregar')
          : codigo === 'ya_es_amigo'
            ? t('amigoYaExiste')
            : t('sinConexion'),
      );
    }
  };

  const agregarAmigoDesdeMenu = (j: Jugador) => {
    cerrarMenu();
    void agregarAmigo(j);
  };

  const eliminarAmigoDesdePerfil = async (j: Jugador) => {
    if (!online) {
      notificar(t('amigos'), t('sinConexion'));
      return;
    }
    try {
      const r = await apiEliminarAmigo(j.nombre);
      useAppStore.setState({ amigos: r.amigos.map(a => a.nombre) });
      notificar(t('amigos'), t('amigoEliminado'));
    } catch {
      notificar(t('amigos'), t('sinConexion'));
    }
  };

  const medirZonaTablero = () => {
    zonaTableroRef.current?.measureInWindow((left, top, width, height) => {
      rectoTablero.current = { left, top, width, height };
    });
  };

  const tocarFicha = (ficha: Ficha) => {
    if (!habilitarArrastre) return;
    if (!idsJugables.has(ficha.id)) return;
    const extremos = obtenerExtremosJugables(ficha, estado);
    if (extremos.length === 0) return;
    if (extremos.length === 1) {
      jugar(ficha.id, extremos[0]);
      return;
    }
    setFichaSeleccionada(prev => (prev === ficha.id ? null : ficha.id));
  };

  const iniciarArrastre = (ficha: Ficha, x: number, y: number) => {
    if (!habilitarArrastre) return;
    setArrastrando(ficha);
    posicionArrastre.setValue({ x: x - 16, y: y - 32 });
  };

  const moverArrastre = (x: number, y: number) => {
    posicionArrastre.setValue({ x: x - 16, y: y - 32 });
  };

  const soltarArrastre = (x: number, y: number) => {
    const ficha = arrastrando;
    setArrastrando(null);
    if (!ficha || !habilitarArrastre) return;

    const extremos = obtenerExtremosJugables(ficha, estado);
    if (extremos.length === 0) return;

    const rect = rectoTablero.current;
    if (!rect || !layout) {
      jugar(ficha.id, extremos[0]);
      return;
    }

    const dims = dimensionesFicha(ficha.lado1 !== ficha.lado2, layout.tamano);
    const px = x - rect.left;
    const py = y - rect.top;
    const tol = 30;

    const cercaDe = (c: { x: number; y: number }) =>
      px > c.x - dims.width / 2 - tol &&
      px < c.x + dims.width / 2 + tol &&
      py > c.y - dims.height / 2 - tol &&
      py < c.y + dims.height / 2 + tol;

    const aDerecha =
      layout.centroDerecha && extremos.includes('derecho') && cercaDe(layout.centroDerecha);
    const aIzquierda =
      layout.centroIzquierda && extremos.includes('izquierdo') && cercaDe(layout.centroIzquierda);

    if (aDerecha) {
      jugar(ficha.id, 'derecho');
      return;
    }
    if (aIzquierda) {
      jugar(ficha.id, 'izquierdo');
      return;
    }
  };

  const cancelarArrastre = () => setArrastrando(null);

  const colocarEn = (extremo: 'izquierdo' | 'derecho') => {
    if (fichaSeleccionada) jugar(fichaSeleccionada, extremo);
    setFichaSeleccionada(null);
  };

  // Distribución en abanico de la mano (solo interfaz)
  const nFichas = jugadorInferior.mano.length;
  const tamanoMano = nFichas > 6 ? 26 : nFichas > 4 ? 30 : 34;
  const anchoFicha = Math.round(tamanoMano + 2 * paddingFicha(tamanoMano)) + 4;
  const anchoDisp = Dimensions.get('window').width - 28;
  const espaciado = Math.min(
    anchoFicha * 0.9,
    nFichas > 1 ? Math.floor((anchoDisp - 8) / (nFichas - 1)) : anchoFicha
  );
  const pasoAngulo = nFichas > 6 ? 5 : 7;
  const centroMano = (nFichas - 1) / 2;

  return (
    <View style={styles.mesa}>
      <View style={styles.header}>
        <View style={styles.panelInfo}>
          <View style={styles.infoTurno}>
            <Text style={styles.etiquetaTurno}>
              {fase === 'jugando'
                ? t('turnoDe', { name: jugadorActual.nombre }).toUpperCase()
                : t('partidaTerminada').toUpperCase()}
            </Text>
            <Text style={styles.detalleTurno}>
              {robarPozoActivo
                ? t('pozo', { n: estado.pozo.length })
                : t('appName')}
            </Text>
          </View>
          {robarPozoActivo && <IconoPozo size={18} />}
        </View>
        <Pressable style={styles.botonSalir} onPress={abandonar}>
          <IconoSalir color="#ffb4b4" size={20} />
        </Pressable>
        {online && (
          <Pressable style={styles.botonChat} onPress={() => setChatAbierto(true)}>
            <IconoChat color={COLOR_MENTA} size={20} />
          </Pressable>
        )}
        <Pressable style={styles.botonAjustes} onPress={abrirAjustes}>
          <IconoEngranaje color="#ffffff" size={20} />
        </Pressable>
      </View>

      {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}

      {online && esperando && abandono ? (
        <View style={styles.bannerEspera}>
          <Text style={styles.textoBannerEspera}>
            {t('esperandoJugador', { name: abandono.nombre })}
          </Text>
        </View>
      ) : null}

      <View style={styles.asientosSuperior}>
        {asientos.superior && (
          <Pressable onPress={() => abrirMenuJugador(asientos.superior!)}>
            <Asiento
              jugador={asientos.superior}
              color={colorDe(asientos.superior)}
              activo={asientoActivo(asientos.superior)}
              pensando={asientoActivo(asientos.superior) && asientos.superior.esBot}
              soloAvatar
            />
          </Pressable>
        )}
      </View>

      <View style={styles.filaCentral}>
        {asientos.izquierdo && (
          <View style={styles.asientoLateral}>
            <Pressable onPress={() => abrirMenuJugador(asientos.izquierdo!)}>
              <Asiento
                jugador={asientos.izquierdo}
                color={colorDe(asientos.izquierdo)}
                activo={asientoActivo(asientos.izquierdo)}
                pensando={asientoActivo(asientos.izquierdo) && asientos.izquierdo.esBot}
                orientacion="vertical"
                soloAvatar
              />
            </Pressable>
          </View>
        )}

        <View style={styles.marcoTablero}>
          <View style={styles.marcaAgua} pointerEvents="none">
            <IconoDado color="#ffffff" size={84} />
            <Text style={styles.textoMarcaAgua}>Domino Club</Text>
          </View>
          <View ref={zonaTableroRef} style={styles.zonaTablero} onLayout={medirZonaTablero}>
            <Board estado={estado} onLayoutListo={onLayoutListo} />
            {arrastrando && habilitarArrastre && layout && ayuda && (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {extremosArrastre.includes('derecho') && layout.centroDerecha && (
                  <Indicador
                    centro={layout.centroDerecha}
                    ficha={arrastrando}
                    tamano={layout.tamano}
                    vertical={layout.centroDerechaVertical}
                  />
                )}
                {extremosArrastre.includes('izquierdo') && layout.centroIzquierda && (
                  <Indicador
                    centro={layout.centroIzquierda}
                    ficha={arrastrando}
                    tamano={layout.tamano}
                    vertical={layout.centroIzquierdaVertical}
                  />
                )}
              </View>
            )}
          </View>

          {fichaEnSelector && habilitarArrastre && (
            <View style={styles.panelExtremos}>
              <Text style={styles.textoExtremos}>{t('coincideExtremos')}</Text>
              <View style={styles.filaExtremos}>
                <Pressable style={styles.botonExtremo} onPress={() => colocarEn('izquierdo')}>
                  <IconoFlecha direccion="izquierda" size={16} />
                  <Text style={styles.textoExtremo}>{t('izquierda')}</Text>
                </Pressable>
                <Pressable style={styles.botonExtremo} onPress={() => colocarEn('derecho')}>
                  <Text style={styles.textoExtremo}>{t('derecha')}</Text>
                  <IconoFlecha direccion="derecha" size={16} />
                </Pressable>
                <Pressable
                  style={[styles.botonExtremo, styles.botonCancelar]}
                  onPress={() => setFichaSeleccionada(null)}
                >
                  <Text style={[styles.textoExtremo, styles.textoCancelar]}>{t('cancelar')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {asientos.derecho && (
          <View style={styles.asientoLateral}>
            <Pressable onPress={() => abrirMenuJugador(asientos.derecho!)}>
              <Asiento
                jugador={asientos.derecho}
                color={colorDe(asientos.derecho)}
                activo={asientoActivo(asientos.derecho)}
                pensando={asientoActivo(asientos.derecho) && asientos.derecho.esBot}
                orientacion="vertical"
                soloAvatar
              />
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.filaAcciones}>
        {habilitarArrastre && noPuedeJugar && (
          <Pressable
            style={({ pressed }) => [styles.pastilla, pressed && styles.botonPresionado]}
            onPress={robarPozoActivo && estado.pozo.length > 0 ? robar : pasar}
          >
            {robarPozoActivo && estado.pozo.length > 0 ? (
              <IconoPozo size={20} />
            ) : (
              <IconoPasar size={18} color="#002113" />
            )}
            <Text style={styles.textoPastilla}>
              {robarPozoActivo && estado.pozo.length > 0
                ? t('robarDelPozo')
                : t('pasarTurno')}
            </Text>
          </Pressable>
        )}
      </View>

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bandejaInferior}
      >
        <View style={styles.cabeceraBandeja}>
          <Pressable onPress={() => abrirMenuJugador(jugadorInferior)}>
            <Avatar
              foto={jugadorInferior.foto}
              color={colorDe(jugadorInferior)}
              nombre={jugadorInferior.nombre}
              tamano={32}
              estilo={styles.avatarBandeja}
            />
          </Pressable>
          <Text
            style={[
              styles.nombreInferior,
              asientoActivo(jugadorInferior) && styles.nombreInferiorActivo,
            ]}
            numberOfLines={1}
          >
            {jugadorInferior.nombre}
            {jugadorInferior.esBot ? ` (${t('bot')})` : ''}
          </Text>
          <Text style={styles.fichasInferior}>
            {t('fichas', { n: jugadorInferior.mano.length })}
          </Text>
        </View>

        <View style={styles.manoAbanico}>
          {jugadorInferior.mano.map((f, i) => {
            const offset = (i - centroMano) * espaciado;
            const angulo = (i - centroMano) * pasoAngulo;
            const elevacion = Math.abs(Math.sin((angulo * Math.PI) / 180)) * 26;
            const esJugable = habilitarArrastre && idsJugables.has(f.id);
            const zIndex = 10 + Math.round(nFichas - Math.abs(i - centroMano));
            return (
              <View
                key={f.id}
                style={[
                  styles.fichaAbanico,
                  {
                    left: '50%',
                    transform: [
                      { translateX: offset - anchoFicha / 2 },
                      { rotate: `${angulo}deg` },
                      { translateY: elevacion },
                    ],
                    zIndex: fichaSeleccionada === f.id || arrastrando?.id === f.id ? 30 : zIndex,
                  },
                  esJugable && styles.jugableBorde,
                ]}
              >
                <DragTile
                  valores={[f.lado1, f.lado2]}
                  size={tamanoMano}
                  seleccionada={fichaSeleccionada === f.id}
                  jugable={esJugable}
                  oculta={arrastrando?.id === f.id}
                  deshabilitada={!habilitarArrastre}
                  color={jugadorInferior.color}
                  onPress={() => tocarFicha(f)}
                  onDragInicio={(x, y) => iniciarArrastre(f, x, y)}
                  onDragMover={moverArrastre}
                  onDragSoltar={soltarArrastre}
                  onDragCancelar={cancelarArrastre}
                />
                {esJugable && <View style={styles.puntoJugable} />}
              </View>
            );
          })}
        </View>
      </LinearGradient>

      {arrastrando && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fantasma,
            { transform: [...posicionArrastre.getTranslateTransform(), { scale: 1.1 }] },
          ]}
        >
          <Tile valores={[arrastrando.lado1, arrastrando.lado2]} size={tamanoMano} color={jugadorInferior.color} />
        </Animated.View>
      )}

      <Modal visible={fase === 'terminado'} transparent animationType="fade">
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            {online && onlineStore.terminadaPorAbandono ? (
              <>
                <Text style={styles.tituloFinal}>{t('partidaAbandonada')}</Text>
                <Text style={styles.subtituloFinal}>{t('rivalAbandono')}</Text>
              </>
            ) : estado.partidaTrabada ? (
              <>
                <Text style={styles.tituloFinal}>{t('juegoCerrado')}</Text>
                <Text style={styles.subtituloFinal}>
                  {ganador ? t('ganadorEs', { name: ganador.nombre }) : t('empatada')}
                </Text>
              </>
            ) : (
              <Text style={styles.tituloFinal}>
                {ganador ? t('gana', { name: ganador.nombre }) : t('empatada')}
              </Text>
            )}
            <View style={styles.tablaPuntos}>
              {estado.jugadores.map((j, indice) => (
                <View key={j.id} style={styles.filaPuntos}>
                  <View style={styles.filaNombreFinal}>
                    <Avatar
                      foto={j.foto}
                      color={j.color ?? COLORES_JUGADORES[indice % COLORES_JUGADORES.length]}
                      nombre={j.nombre}
                      tamano={28}
                      estilo={styles.avatarFinal}
                    />
                    <Text style={styles.nombreFinal}>{j.nombre}</Text>
                  </View>
                  <Text style={styles.valorPuntos}>
                    {t('puntos', { n: calcularPuntaje(j.mano) })}
                  </Text>
                </View>
              ))}
            </View>
            {pago && (
              <View style={styles.pago}>
                <Text style={[styles.textoPago, pago.tipo !== 'perdida' && styles.textoPagoPositivo]}>
                  {pago.tipo === 'ganancia'
                    ? t('ganaste', { monto: pago.monto, creditos: t('creditos') })
                    : pago.tipo === 'reembolso'
                      ? `${t('reembolsoDesc')}: +${pago.monto} ${t('creditos')}`
                      : t('perdiste', { monto: Math.abs(pago.monto), creditos: t('creditos') })}
                </Text>
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.botonFinal, pressed && styles.botonPresionado]}
              onPress={() => (online ? onlineStore.empezar() : iniciar(config, opciones))}
            >
              <IconoReiniciar size={20} color="#002113" />
              <Text style={styles.textoFinal}>
                {online ? t('jugarOtraPartida') : t('jugarDeNuevo')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.botonFinal, styles.botonSecundario, pressed && styles.botonPresionado]}
              onPress={() => {
                if (online) {
                  onlineStore.salirSala();
                  volverAtras();
                } else {
                  reiniciar();
                }
              }}
            >
              <IconoJugador color="#ffffff" size={20} />
              <Text style={[styles.textoFinal, styles.textoSecundario]}>
                {online ? t('salirSala') : t('cambiarJugadores')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={menuJugador !== null} transparent animationType="fade" onRequestClose={cerrarMenu}>
        <View style={styles.fondoModal}>
          <View style={styles.tarjetaModal}>
            <Text style={styles.tituloModal}>{t('perfilJugador')}</Text>
            <Text style={styles.nombreModal}>{menuJugador?.nombre}</Text>
            <Pressable
              style={({ pressed }) => [styles.botonModal, pressed && styles.botonPresionado]}
              onPress={() => {
                const j = menuJugador;
                cerrarMenu();
                if (j) setVerPerfil(j);
              }}
            >
              <Text style={styles.textoModal}>{t('perfilJugador')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.botonModal, styles.botonModalPrimario, pressed && styles.botonPresionado]}
              onPress={() => menuJugador && agregarAmigoDesdeMenu(menuJugador)}
            >
              <Text style={[styles.textoModal, styles.textoModalPrimario]}>{t('agregarAmigo')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.botonModal, pressed && styles.botonPresionado]}
              onPress={cerrarMenu}
            >
              <Text style={[styles.textoModal, styles.textoCancelar]}>{t('cancelar')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={verPerfil !== null} transparent animationType="fade" onRequestClose={() => setVerPerfil(null)}>
        <View style={styles.fondoModal}>
          <View style={styles.tarjetaModal}>
            <Avatar
              foto={verPerfil?.foto}
              color={verPerfil ? colorDe(verPerfil) : '#555'}
              nombre={verPerfil?.nombre}
              tamano={64}
              estilo={styles.avatarPerfil}
            />
            <Text style={styles.tituloModal}>{verPerfil?.nombre}</Text>
            <View style={styles.detallePerfil}>
              <Text style={styles.detalleEtiqueta}>{t('racha')}</Text>
              <Text style={styles.detalleValor}>{verPerfil?.racha ?? 0}</Text>
            </View>
            <View style={styles.detallePerfil}>
              <Text style={styles.detalleEtiqueta}>{t('fichasEnMano')}</Text>
              <Text style={styles.detalleValor}>{verPerfil ? verPerfil.mano.length : 0}</Text>
            </View>
            <View style={styles.detallePerfil}>
              <Text style={styles.detalleEtiqueta}>{t('puntos')}</Text>
              <Text style={styles.detalleValor}>
                {verPerfil ? calcularPuntaje(verPerfil.mano) : 0}
              </Text>
            </View>
            {online &&
            verPerfil &&
            !verPerfil.esBot &&
            verPerfil.nombre !== useAppStore.getState().perfil?.nombre ? (
              amigos.includes(verPerfil.nombre) ? (
                <Pressable
                  style={({ pressed }) => [styles.botonModal, styles.botonModalEliminar, pressed && styles.botonPresionado]}
                  onPress={() => eliminarAmigoDesdePerfil(verPerfil)}
                >
                  <Text style={[styles.textoModal, styles.textoModalEliminar]}>{t('eliminarDeAmigos')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.botonModal, styles.botonModalPrimario, pressed && styles.botonPresionado]}
                  onPress={() => agregarAmigo(verPerfil)}
                >
                  <Text style={[styles.textoModal, styles.textoModalPrimario]}>{t('agregarAmigo')}</Text>
                </Pressable>
              )
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.botonModal, pressed && styles.botonPresionado]}
              onPress={() => setVerPerfil(null)}
            >
              <Text style={[styles.textoModal, styles.textoCerrar]}>{t('cerrar')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={online && !!onlineStore.abandono && !onlineStore.esperando}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.fondoModal}>
          <View style={styles.tarjetaModal}>
            <Text style={styles.tituloModal}>
              {onlineStore.abandono ? t('jugadorAbandono', { name: onlineStore.abandono.nombre }) : ''}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.botonModal, styles.botonModalPrimario, pressed && styles.botonPresionado]}
              onPress={onlineStore.esperar}
            >
              <Text style={[styles.textoModal, styles.textoModalPrimario]}>
                {onlineStore.abandono ? t('esperarJugador', { name: onlineStore.abandono.nombre }) : ''}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.botonModal, pressed && styles.botonPresionado]}
              onPress={onlineStore.abandonarPartida}
            >
              <Text style={styles.textoModal}>{t('abandonarPartida')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ChatSala visible={chatAbierto} onCerrar={() => setChatAbierto(false)} />
    </View>
  );
}

function traducirErrorServidor(mensaje: string | null): keyof Traducciones {
  const mapa: Record<string, keyof Traducciones> = {
    sala_no_encontrada: 'codigoInvalido',
    demasiados_jugadores: 'salaLlena',
    solo_el_anfitrion: 'soloAnfitrion',
    partida_en_curso: 'partidaEnCurso',
    sin_saldo: 'sinSaldo',
    no_es_tu_turno: 'movimientoInvalido',
    ficha_no_jugable: 'movimientoInvalido',
    jugada_invalida: 'movimientoInvalido',
    no_puedes_robar: 'noPuedesRobar',
    pozo_debes_robar: 'pozoDebesRobar',
  };
  return mapa[mensaje ?? ''] ?? 'movimientoInvalido';
}

function SalaEspera() {
  const t = useT();
  const volverAtras = useAppStore(s => s.volverAtras);
  const sala = useOnlineStore(s => s.sala);
  const esHost = useOnlineStore(s => s.esHost);
  const robarPozo = useOnlineStore(s => s.robarPozo);
  const fichasPorJugador = useOnlineStore(s => s.fichasPorJugador);
  const conectado = useOnlineStore(s => s.conectado);
  const mensaje = useOnlineStore(s => s.mensaje);
  const set = useOnlineStore.setState;
  const empezar = useOnlineStore(s => s.empezar);
  const salirSala = useOnlineStore(s => s.salirSala);
  const desconectar = useOnlineStore(s => s.desconectar);

  const [chatAbierto, setChatAbierto] = useState(false);

  const fichasValidas = fichasPorJugadorPermitidas(sala?.jugadores.length ?? 2);

  const salir = () => {
    salirSala();
    desconectar();
    volverAtras();
  };

  return (
    <View style={styles.mesa}>
      <View style={styles.header}>
        <View style={styles.panelInfo}>
          <View style={styles.infoTurno}>
            <Text style={styles.etiquetaTurno}>{t('codigoSala').toUpperCase()}</Text>
            <Text style={styles.codigoEspera}>{sala?.codigo ?? '—'}</Text>
          </View>
        </View>
        <Pressable style={styles.botonChat} onPress={() => setChatAbierto(true)}>
          <IconoChat color={COLOR_MENTA} size={20} />
        </Pressable>
        <Pressable style={styles.botonAjustes} onPress={salir}>
          <IconoSalir size={20} color="#ffffff" />
        </Pressable>
      </View>

      <View style={styles.esperaContenido}>
        <View style={styles.esperaPanel}>
          <Text style={styles.esperaTitulo}>{t('salaEnEspera')}</Text>
          {mensaje ? <Text style={styles.mensaje}>{t(traducirErrorServidor(mensaje))}</Text> : null}
          {!conectado && <Text style={styles.mensaje}>{t('sinConexion')}</Text>}

          <Text style={styles.esperaSubtitulo}>{t('jugadores')}</Text>
          {sala?.jugadores.map(j => (
            <View key={j.id} style={styles.filaJugador}>
              <Avatar foto={j.foto ?? undefined} color={j.color} nombre={j.nombre} tamano={26} estilo={styles.avatarJugador} />
              <Text style={styles.nombreJugador}>
                {j.nombre}
                {j.id === sala.hostId ? ` (${t('anfitrion')})` : ''}
              </Text>
            </View>
          ))}

          {sala?.apuesta ? (
            <Text style={styles.esperaApuesta}>
              {t('apuestaDesc', { monto: sala.apuesta, creditos: t('creditos') })}
            </Text>
          ) : null}

          {esHost ? (
            <View style={styles.esperaControles}>
              <View style={styles.filaToggle}>
                <Text style={styles.textoToggle}>{t('robarPozo')}</Text>
                <Switch
                  value={robarPozo}
                  onValueChange={v => set({ robarPozo: v })}
                  trackColor={{ true: COLOR_MENTA, false: 'rgba(255,255,255,0.2)' }}
                  thumbColor="#ffffff"
                />
              </View>
              <View style={styles.filaToggle}>
                <Text style={styles.textoToggle}>{t('fichasPorJugador')}</Text>
                <View style={styles.filaFichasEspera}>
                  {fichasValidas.map(n => (
                    <Pressable
                      key={n}
                      style={[styles.chipFichasEspera, fichasPorJugador === n && styles.chipFichasEsperaActivo]}
                      onPress={() => set({ fichasPorJugador: n })}
                    >
                      <Text
                        style={[
                          styles.textoChipEspera,
                          fichasPorJugador === n && styles.textoChipEsperaActivo,
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.botonEmpezar, pressed && styles.botonPresionado]}
                onPress={empezar}
              >
                <IconoDado size={22} color="#002113" />
                <Text style={styles.textoEmpezar}>{t('iniciarPartida')}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.esperando}>{t('esperandoJugadores')}</Text>
          )}
        </View>
      </View>

      <ChatSala visible={chatAbierto} onCerrar={() => setChatAbierto(false)} />
    </View>
  );
}

function Indicador({
  centro,
  ficha,
  tamano,
  vertical = false,
}: {
  centro: { x: number; y: number };
  ficha: Ficha;
  tamano: number;
  vertical?: boolean;
}) {
  const esDoble = ficha.lado1 === ficha.lado2;
  const horizontal = esDoble ? false : !vertical;
  const dims = dimensionesFicha(horizontal, tamano);
  return (
    <View
      style={[
        styles.indicador,
        {
          left: centro.x - dims.width / 2,
          top: centro.y - dims.height / 2,
          width: dims.width,
          height: dims.height,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  mesa: {
    flex: 1,
    backgroundColor: COLOR_MESA,
    paddingHorizontal: 12,
    paddingTop: 60,
    paddingBottom: 60,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  infoTurno: {
    flexShrink: 1,
  },
  etiquetaTurno: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
    opacity: 0.8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detalleTurno: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: FONT_INTER_SEMIBOLD,
    marginTop: 1,
  },
  botonAjustes: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  botonSalir: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
    marginRight: 8,
  },
  botonChat: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(111,251,190,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.4)',
    marginRight: 8,
  },
  mensaje: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: COLOR_MENTA,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
    borderRadius: 12,
    textAlign: 'center',
  },
  bannerEspera: {
    position: 'absolute',
    top: 70,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 20,
  },
  textoBannerEspera: {
    color: COLOR_AMBAR,
    fontSize: 14,
    fontWeight: '700',
  },
  asientosSuperior: {
    alignItems: 'center',
  },
  filaCentral: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  asientoLateral: {
    justifyContent: 'center',
  },
  marcoTablero: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 8,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  marcaAgua: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.06,
    zIndex: 0,
  },
  textoMarcaAgua: {
    color: '#ffffff',
    fontSize: 20,
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontFamily: FONT_MONTSERRAT_EXTRA,
  },
  zonaTablero: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 18,
    overflow: 'hidden',
    zIndex: 1,
  },
  indicador: {
    position: 'absolute',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: COLOR_MENTA,
    backgroundColor: 'rgba(111,251,190,0.18)',
    borderRadius: 8,
  },
  panelExtremos: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    zIndex: 5,
  },
  textoExtremos: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  filaExtremos: {
    flexDirection: 'row',
    gap: 8,
  },
  botonExtremo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLOR_MENTA,
    borderRadius: 8,
    paddingVertical: 10,
  },
  botonCancelar: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    flex: 0,
    paddingHorizontal: 16,
  },
  textoExtremo: {
    color: '#002113',
    fontSize: 14,
    fontWeight: '700',
  },
  textoCancelar: {
    color: '#ffffff',
  },
  filaAcciones: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 52,
    alignItems: 'center',
  },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLOR_MENTA,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  textoPastilla: {
    color: '#002113',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONT_INTER_SEMIBOLD,
  },
  bandejaInferior: {
    borderRadius: 18,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 6,
  },
  cabeceraBandeja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  avatarBandeja: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  nombreInferior: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flexShrink: 1,
    fontFamily: FONT_INTER_MEDIUM,
  },
  nombreInferiorActivo: {
    color: COLOR_MENTA,
  },
  fichasInferior: {
    fontSize: 13,
    color: COLOR_AMBAR,
    marginLeft: 'auto',
    fontWeight: '500',
  },
  manoAbanico: {
    height: 148,
    position: 'relative',
  },
  fichaAbanico: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 8,
  },
  jugableBorde: {
    borderColor: COLOR_MENTA,
    shadowColor: COLOR_MENTA,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  puntoJugable: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLOR_MENTA,
    shadowColor: COLOR_MENTA,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  fantasma: {
    position: 'absolute',
    top: 0,
    left: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#0A4A33',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.3)',
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  tarjetaModal: {
    backgroundColor: '#0A4A33',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.3)',
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  tituloModal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 0.5,
  },
  nombreModal: {
    fontSize: 16,
    color: COLOR_MENTA,
    marginTop: 6,
    textAlign: 'center',
  },
  avatarPerfil: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detallePerfil: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  detalleEtiqueta: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '600',
  },
  detalleValor: {
    fontSize: 15,
    color: COLOR_MENTA,
    fontWeight: '700',
  },
  botonModal: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  botonModalPrimario: {
    backgroundColor: COLOR_MENTA,
    borderColor: COLOR_MENTA,
  },
  botonModalEliminar: {
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: 'rgba(255,107,107,0.4)',
  },
  textoModal: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  textoModalPrimario: {
    color: '#002113',
  },
  textoModalEliminar: {
    color: '#ff6b6b',
  },
  textoCerrar: {
    color: '#94a3b8',
  },
  tituloFinal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 0.5,
  },
  subtituloFinal: {
    fontSize: 14,
    color: COLOR_AMBAR,
    textAlign: 'center',
    marginTop: 4,
  },
  tablaPuntos: {
    marginTop: 16,
    marginBottom: 16,
  },
  pago: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 16,
  },
  textoPago: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff6b6b',
  },
  textoPagoPositivo: {
    color: COLOR_MENTA,
  },
  filaPuntos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  filaNombreFinal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarFinal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombreFinal: {
    fontSize: 15,
    color: '#ffffff',
  },
  valorPuntos: {
    fontSize: 15,
    fontWeight: '700',
    color: COLOR_MENTA,
  },
  botonFinal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLOR_MENTA,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 8,
  },
  botonSecundario: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  textoFinal: {
    color: '#002113',
    fontSize: 16,
    fontWeight: '700',
  },
  textoSecundario: {
    color: '#ffffff',
  },
  codigoEspera: {
    fontSize: 22,
    fontWeight: '800',
    color: COLOR_MENTA,
    letterSpacing: 3,
    fontFamily: FONT_MONTSERRAT_EXTRA,
  },
  esperaContenido: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  esperaPanel: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  esperaTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: FONT_INTER_SEMIBOLD,
  },
  esperaSubtitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR_AMBAR,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  filaJugador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  avatarJugador: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  nombreJugador: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  esperaApuesta: {
    fontSize: 14,
    color: COLOR_MENTA,
    textAlign: 'center',
    marginTop: 4,
  },
  esperaControles: {
    gap: 10,
    marginTop: 8,
  },
  filaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  textoToggle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  filaFichasEspera: {
    flexDirection: 'row',
    gap: 6,
  },
  chipFichasEspera: {
    minWidth: 38,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  chipFichasEsperaActivo: {
    borderColor: COLOR_MENTA,
    backgroundColor: 'rgba(111,251,190,0.18)',
  },
  textoChipEspera: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '600',
  },
  textoChipEsperaActivo: {
    color: COLOR_MENTA,
  },
  botonEmpezar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLOR_MENTA,
    borderRadius: 999,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  textoEmpezar: {
    color: '#002113',
    fontSize: 16,
    fontWeight: '700',
  },
  esperando: {
    fontSize: 14,
    color: COLOR_MENTA,
    textAlign: 'center',
    marginTop: 8,
  },
  botonPresionado: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});