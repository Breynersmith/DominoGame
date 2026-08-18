import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color?: string;
  size?: number;
}

export function IconoSalir({ color = '#ffffff', size = 20 }: Props) {
  const m = size * 0.12;
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.puerta,
          {
            width: size * 0.8,
            height: size * 0.92,
            borderRadius: size * 0.14,
            borderWidth: m,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.mango,
          {
            top: size * 0.24,
            left: size * 0.26,
            width: m,
            height: m,
            borderRadius: m / 2,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.punta,
          {
            borderTopWidth: m,
            borderBottomWidth: m,
            borderLeftWidth: size * 0.24,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: color,
            left: size * 0.52,
            top: size * 0.24,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    position: 'relative',
  },
  puerta: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  mango: {
    position: 'absolute',
  },
  punta: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
});