import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color?: string;
  size?: number;
}

export function IconoReiniciar({ color = '#ffffff', size = 20 }: Props) {
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.anillo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: size * 0.14,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.flecha,
          {
            borderLeftWidth: size * 0.22,
            borderRightWidth: size * 0.22,
            borderBottomWidth: size * 0.32,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
            top: -size * 0.14,
            right: -size * 0.1,
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
  anillo: {
    position: 'absolute',
  },
  flecha: {
    position: 'absolute',
    width: 0,
    height: 0,
    transform: [{ rotate: '45deg' }],
  },
});