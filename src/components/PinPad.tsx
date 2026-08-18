import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONT_INTER_SEMIBOLD } from '../constants/fonts';

const COLOR_MENTA = '#6FFBBE';

interface Props {
  pin: string;
  onChange: (pin: string) => void;
  error?: boolean;
  largo?: number;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({ pin, onChange, error = false, largo = 4 }: Props) {
  const pulsar = (d: string) => {
    if (pin.length >= largo) return;
    onChange(pin + d);
  };

  const borrar = () => {
    if (pin.length === 0) return;
    onChange(pin.slice(0, -1));
  };

  return (
    <View style={styles.contenedor}>
      <View style={styles.cajas}>
        {Array.from({ length: largo }).map((_, i) => (
          <View
            key={i}
            style={[styles.caja, i === pin.length && !error && styles.cajaActiva, error && styles.cajaError]}
          >
            <View style={[styles.punto, i < pin.length && styles.puntoLleno]} />
          </View>
        ))}
      </View>

      <View style={styles.teclado}>
        {TECLAS.map(d => (
          <Pressable
            key={d}
            style={({ pressed }) => [styles.tecla, pressed && styles.teclaPresionada]}
            onPress={() => pulsar(d)}
          >
            <Text style={styles.textoTecla}>{d}</Text>
          </Pressable>
        ))}
        <View style={styles.teclaVacia} />
        <Pressable
          style={({ pressed }) => [styles.tecla, pressed && styles.teclaPresionada]}
          onPress={() => pulsar('0')}
        >
          <Text style={styles.textoTecla}>0</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.tecla, pressed && styles.teclaPresionada]}
          onPress={borrar}
        >
          <Text style={styles.textoTecla}>⌫</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
  },
  cajas: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  caja: {
    width: 46,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajaActiva: {
    borderColor: COLOR_MENTA,
  },
  cajaError: {
    borderColor: '#ff6b6b',
  },
  punto: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  puntoLleno: {
    backgroundColor: COLOR_MENTA,
  },
  teclado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 252,
    gap: 12,
  },
  tecla: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teclaVacia: {
    width: 76,
    height: 76,
  },
  teclaPresionada: {
    backgroundColor: 'rgba(111,251,190,0.2)',
    borderColor: COLOR_MENTA,
  },
  textoTecla: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: FONT_INTER_SEMIBOLD,
  },
});