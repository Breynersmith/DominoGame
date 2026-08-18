import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color?: string;
  size?: number;
}

export function IconoPasar({ color = '#ffffff', size = 20 }: Props) {
  return (
    <View style={[styles.caja, { width: size * 1.6, height: size }]}>
      <View
        style={[
          styles.triangulo,
          {
            borderTopWidth: size * 0.55,
            borderBottomWidth: size * 0.55,
            borderLeftWidth: size * 0.8,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: color,
            opacity: 0.55,
          },
        ]}
      />
      <View
        style={[
          styles.triangulo,
          {
            marginLeft: -size * 0.5,
            borderTopWidth: size * 0.55,
            borderBottomWidth: size * 0.55,
            borderLeftWidth: size * 0.8,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  triangulo: {
    width: 0,
    height: 0,
  },
});