import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ValorFicha } from '../game/types';
import { Pips } from './Pips';
import { paddingFicha, extraLargoFicha } from './layoutTablero';

interface Props {
  valores: [ValorFicha, ValorFicha];
  size?: number;
  horizontal?: boolean;
  seleccionada?: boolean;
  jugable?: boolean;
  onPress?: () => void;
}

export function Tile({
  valores,
  size = 26,
  horizontal = false,
  seleccionada = false,
  jugable = true,
  onPress,
}: Props) {
  const pad = paddingFicha(size);
  const extra = extraLargoFicha(size);
  const contenido = (
    <View
      style={[
        styles.ficha,
        { padding: pad },
        horizontal
          ? { paddingHorizontal: pad + extra, paddingVertical: pad }
          : { paddingHorizontal: pad, paddingVertical: pad + extra },
        horizontal && styles.horizontal,
        seleccionada && styles.seleccionada,
        !jugable && styles.noJugable,
      ]}
    >
      <Pips valor={valores[0]} size={size} />
      <View
        style={[
          styles.divisor,
          horizontal
            ? { width: 1, height: '100%', marginHorizontal: Math.round(size * 0.12) }
            : { height: 1, width: '100%', marginVertical: Math.round(size * 0.12) },
        ]}
      />
      <Pips valor={valores[1]} size={size} />
    </View>
  );

  if (!onPress) return contenido;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      {contenido}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ficha: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontal: {
    flexDirection: 'row',
  },
  divisor: {
    height: 1,
    width: '100%',
    backgroundColor: '#d1d5db',
  },
  seleccionada: {
    borderColor: '#2563eb',
    borderWidth: 3,
  },
  noJugable: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.6,
  },
});
