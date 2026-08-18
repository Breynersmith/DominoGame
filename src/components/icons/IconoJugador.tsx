import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoJugador({ color, size = 40 }: Props) {
  return (
    <View
      style={[
        styles.circulo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.cabeza,
          {
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size * 0.17,
            top: size * 0.14,
          },
        ]}
      />
      <View
        style={[
          styles.cuerpo,
          {
            width: size * 0.56,
            height: size * 0.28,
            borderTopLeftRadius: size * 0.28,
            borderTopRightRadius: size * 0.28,
            bottom: size * 0.1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circulo: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cabeza: {
    position: 'absolute',
    backgroundColor: '#ffffff',
  },
  cuerpo: {
    position: 'absolute',
    backgroundColor: '#ffffff',
  },
});