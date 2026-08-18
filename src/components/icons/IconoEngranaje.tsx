import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoEngranaje({ color, size = 24 }: Props) {
  const e = size * 0.12;
  const brazo = size * 0.56;
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.aro,
          {
            width: brazo,
            height: brazo,
            borderRadius: brazo / 2,
            borderWidth: e,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.diente,
          {
            width: e,
            height: brazo,
            borderRadius: e / 2,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.diente,
          {
            width: brazo,
            height: e,
            borderRadius: e / 2,
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
    justifyContent: 'center',
    position: 'relative',
  },
  aro: {
    position: 'absolute',
  },
  diente: {
    position: 'absolute',
  },
});