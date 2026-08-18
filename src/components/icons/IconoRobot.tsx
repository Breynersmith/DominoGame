import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoRobot({ color, size = 24 }: Props) {
  const ojo = size * 0.13;
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.antena,
          {
            width: size * 0.1,
            height: size * 0.26,
            borderRadius: size * 0.05,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.cabeza,
          {
            width: size * 0.8,
            height: size * 0.5,
            borderRadius: size * 0.18,
            backgroundColor: color,
          },
        ]}
      >
        <View style={[styles.ojo, { width: ojo, height: ojo, borderRadius: ojo / 2, backgroundColor: '#022416' }]} />
        <View style={[styles.ojo, { width: ojo, height: ojo, borderRadius: ojo / 2, backgroundColor: '#022416' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    alignItems: 'center',
  },
  antena: {
    marginBottom: 1,
  },
  cabeza: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  ojo: {
    margin: 0,
  },
});