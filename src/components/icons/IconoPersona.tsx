import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoPersona({ color, size = 24 }: Props) {
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.cabeza,
          {
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: size * 0.18,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.cuerpo,
          {
            width: size * 0.74,
            height: size * 0.42,
            borderTopLeftRadius: size * 0.42,
            borderTopRightRadius: size * 0.42,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cabeza: {
    marginBottom: 0,
  },
  cuerpo: {
    marginTop: 0,
  },
});