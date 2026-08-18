import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ValorFicha } from '../game/types';

const POSICIONES: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [
    [0.3, 0.3],
    [0.7, 0.7],
  ],
  3: [
    [0.3, 0.3],
    [0.5, 0.5],
    [0.7, 0.7],
  ],
  4: [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
  5: [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.5, 0.5],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
  6: [
    [0.3, 0.25],
    [0.7, 0.25],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.3, 0.75],
    [0.7, 0.75],
  ],
};

interface Props {
  valor: ValorFicha;
  size: number;
}

export function Pips({ valor, size }: Props) {
  const dotSize = size * 0.24;
  const dots = POSICIONES[valor] ?? [];

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {dots.map(([x, y], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: '#1f2937',
            left: x * size - dotSize / 2,
            top: y * size - dotSize / 2,
          }}
        />
      ))}
    </View>
  );
}
