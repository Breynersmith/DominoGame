import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoLogin({ color, size = 24 }: Props) {
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.puerta,
          {
            width: size * 0.66,
            height: size * 0.8,
            borderRadius: size * 0.12,
            borderColor: color,
            left: size * 0.12,
            top: size * 0.1,
          },
        ]}
      />
      <View
        style={[
          styles.pomo,
          {
            width: size * 0.1,
            height: size * 0.1,
            borderRadius: size * 0.05,
            backgroundColor: color,
            left: size * 0.16,
            top: size * 0.45,
          },
        ]}
      />
      <View
        style={[
          styles.flechaCuerpo,
          {
            height: size * 0.09,
            backgroundColor: color,
            left: size * 0.42,
            top: size * 0.455,
            width: size * 0.42,
          },
        ]}
      />
      <View
        style={[
          styles.flechaCabeza,
          {
            width: 0,
            height: 0,
            borderTopWidth: size * 0.1,
            borderBottomWidth: size * 0.1,
            borderLeftWidth: size * 0.16,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: color,
            left: size * 0.8,
            top: size * 0.36,
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
    borderWidth: 2,
  },
  pomo: {
    position: 'absolute',
  },
  flechaCuerpo: {
    position: 'absolute',
  },
  flechaCabeza: {
    position: 'absolute',
  },
});