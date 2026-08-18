// src/services/sonido.ts

import { createAudioPlayer } from 'expo-audio';
import { useAppStore } from '../store/appStore';

export type SonidoTipo = 'colocar' | 'pasar' | 'robar' | 'ganar' | 'error';

const FUENTES: Record<SonidoTipo, number> = {
  colocar: require('../../assets/sonidos/colocar.wav'),
  pasar: require('../../assets/sonidos/pasar.wav'),
  robar: require('../../assets/sonidos/robar.wav'),
  ganar: require('../../assets/sonidos/ganar.wav'),
  error: require('../../assets/sonidos/error.wav'),
};

const jugadores = new Map<SonidoTipo, ReturnType<typeof createAudioPlayer>>();

function jugadorDe(tipo: SonidoTipo) {
  let jugador = jugadores.get(tipo);
  if (!jugador) {
    try {
      jugador = createAudioPlayer(FUENTES[tipo]);
      jugador.volume = 0.7;
      jugadores.set(tipo, jugador);
    } catch {
      return null;
    }
  }
  return jugador;
}

// Reproduce un efecto de sonido si el ajuste está activado.
// Es seguro llamarlo aunque no haya sonidos disponibles.
export function reproducir(tipo: SonidoTipo) {
  const { sonido } = useAppStore.getState().ajustes;
  if (!sonido) return;
  const jugador = jugadorDe(tipo);
  if (!jugador) return;
  try {
    void jugador.seekTo(0);
    jugador.play();
  } catch {
    // el sonido no pudo reproducirse, se ignora
  }
}