import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoPlay({ color, size = 24 }: Props) {
  return (
    <View
      style={[
        styles.circulo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <View
        style={[
          styles.triangulo,
          {
            borderLeftWidth: size * 0.26,
            borderTopWidth: size * 0.16,
            borderBottomWidth: size * 0.16,
            borderLeftColor: color,
            marginLeft: size * 0.06,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circulo: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangulo: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});