import React from 'react';
import { View } from 'react-native';

interface Props {
  direccion: 'izquierda' | 'derecha';
  color?: string;
  size?: number;
}

export function IconoFlecha({ direccion, color = '#ffffff', size = 16 }: Props) {
  const base = {
    width: 0,
    height: 0,
    borderTopWidth: size * 0.7,
    borderBottomWidth: size * 0.7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  } as const;

  const triangulo =
    direccion === 'izquierda'
      ? { ...base, borderRightWidth: size, borderRightColor: color }
      : { ...base, borderLeftWidth: size, borderLeftColor: color };

  return <View style={triangulo} />;
}