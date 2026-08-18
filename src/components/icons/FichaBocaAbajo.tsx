import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  size?: number;
  opacidad?: number;
}

export function FichaBocaAbajo({ size = 20, opacidad = 1 }: Props) {
  return (
    <View style={[styles.ficha, { width: size * 1.35, height: size, opacity: opacidad }]}>
      <View
        style={[styles.detalle, { width: size * 0.45, height: size * 0.45, borderRadius: size * 0.08 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ficha: {
    backgroundColor: '#eef2f6',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detalle: {
    backgroundColor: '#94a3b8',
  },
});