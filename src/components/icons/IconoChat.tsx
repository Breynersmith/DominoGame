import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoChat({ color, size = 24 }: Props) {
  const m = size * 0.07;
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.burbuja,
          {
            width: size * 0.86,
            height: size * 0.66,
            borderRadius: size * 0.18,
            borderWidth: m,
            borderColor: color,
            top: size * 0.08,
            left: size * 0.07,
          },
        ]}
      />
      <View
        style={[
          styles.punto,
          {
            top: size * 0.26,
            left: size * 0.24,
            width: m * 1.6,
            height: m * 1.6,
            borderRadius: m,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.punto,
          {
            top: size * 0.26,
            left: size * 0.48,
            width: m * 1.6,
            height: m * 1.6,
            borderRadius: m,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.cola,
          {
            borderTopWidth: size * 0.14,
            borderRightWidth: size * 0.18,
            borderTopColor: 'transparent',
            borderRightColor: color,
            left: size * 0.14,
            top: size * 0.6,
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
  burbuja: {
    position: 'absolute',
  },
  punto: {
    position: 'absolute',
  },
  cola: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
});